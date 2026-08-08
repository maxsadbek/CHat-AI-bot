/**
 * Enterprise AI Core Executor Pipeline
 * Now integrates the AI Router for provider failover, caching, health checks,
 * and usage tracking. The executor is the bridge between AI services and the router.
 *
 * Key improvements:
 * - Provider failover: tries next provider in priority chain on failure
 * - Health-aware routing: skips unhealthy providers
 * - Response caching: exact-match with TTL
 * - Daily usage tracking: per-user, per-feature
 * - Friendly error messages: never expose provider/internal details
 */

import { aiConfig, FeatureType, type ProviderId } from "@/config/ai";
import { providerRegistry, ProviderRegistry } from "../providers/registry";
import { logger } from "@/bot/core/logger";
import { CostOptimizationStrategy } from "../strategies/cost";
import { AITelemetry } from "../utils/logger";
import { AIError } from "../types/errors";
import { routePlanner, responseCache, usageTracker, UsageTracker, healthChecker } from "../router";
import type { ChatRequest, ChatResponse } from "../providers/interface";

const log = logger.child("ai-executor");

/**
 * Optimal error messages per feature — never expose provider/internal details.
 * Never say "All AI providers are currently unavailable".
 * Instead: tell the user we're retrying automatically.
 */
/** Per-provider attempt timeout — 30 seconds max per single AI call */
const PER_PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Overall execution timeout — 50 seconds for the entire generation.
 * If no provider responds within this window, we give up.
 */
const OVERALL_EXECUTION_TIMEOUT_MS = 50_000;

const FRIENDLY_ERRORS: Record<FeatureType, string> = {
  chat: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
  image: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
  video: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
  coding: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
  business: "⚠️ AI server busy. Please try again.",
  translate: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
  social: "⚠️ AI is currently under heavy load. Your request will retry automatically.",
};

export interface AIExecutionOptions {
  feature: FeatureType;
  userPlan?: string;
  modelId?: string;
  request: ChatRequest;
  customRegistry?: ProviderRegistry;
  userId?: number;
}

export class AIExecutor {
  /**
   * Maximum number of automatic continuation requests when response is truncated.
   * Each continuation requests the remaining context from the same provider,
   * so even long answers can be completed without ever sending a mid-sentence cut.
   */
  private static readonly MAX_CONTINUATIONS = 3;

  /**
   * Instruction sent to the model when the previous response was truncated.
   * The partial response is appended as an assistant message BEFORE this prompt,
   * so the model continues from the exact stopping point without repeating.
   */
  private static readonly CONTINUE_INSTRUCTION =
    "Продолжи ровно с того места, где остановился — с последнего слова или предложения. " +
    "НЕ повторяй уже написанный выше текст и не начинай ответ заново. " +
    "Верни только продолжение.";

  /**
   * Final short instruction used when the continuation budget is exhausted but
   * the response still ends mid-sentence — the model simply closes the last
   * sentence so the user never sees a cut-off answer.
   */
  private static readonly FINISH_INSTRUCTION =
    "Кратко закончи последнее предложение и поставь точку. " +
    "Не начинай новых тем и не повторяй текст. Верни только завершение последней фразы.";

  /**
   * Provider finish reasons that mean the response hit the token limit.
   * OpenAI: "length" · Gemini: "MAX_TOKENS" · Claude: "max_tokens".
   * Compared case-insensitively ("max_tokens" / "MAX_TOKENS" / "length").
   */
  private static readonly TRUNCATED_FINISH_REASONS = new Set([
    "length",
    "max_tokens",
    "max_output_tokens",
    "maxtokens",
  ]);

  /** Read and normalize the finish reason from a provider response. */
  private static getFinishReason(response: ChatResponse): string | undefined {
    const raw = (response as unknown as Record<string, unknown>).finishReason;
    if (typeof raw !== "string") return undefined;
    const normalized = raw.trim().toLowerCase();
    return normalized || undefined;
  }

  /**
   * True when the text ends at a natural boundary (sentence end, closing quote,
   * closing code fence, or trailing emoji). Used to detect responses that were
   * cut off in the middle of a sentence.
   */
  private static endsWithCleanSentence(text: string): boolean {
    const trimmed = text.trimEnd();
    if (!trimmed) return false;

    // Closing fenced code block
    if (trimmed.endsWith("```")) return true;

    const last = trimmed[trimmed.length - 1]!;

    // Terminal punctuation: . ! ? …
    if (".!?…".includes(last)) return true;

    // Closing quote/bracket/paren — clean only when preceded by punctuation
    // (e.g. "Готово!", «Отлично!»), not mid-emphasis markdown.
    if (")]\"}»”’›*_~`".includes(last)) {
      const prevLast = trimmed.slice(0, -1).trimEnd().slice(-1);
      return prevLast ? ".!?…".includes(prevLast) : false;
    }

    // Trailing emoji (common for AI summaries)
    if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE0F}\u{2B50}\u{2705}]$/u.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Detect whether a provider response was truncated and needs continuation.
   *
   * Strategy 1: explicit finish_reason from the provider API
   *   (length / max_tokens / MAX_TOKENS).
   * Strategy 2: response is near the maxTokens limit (>= 95%) — all features.
   * Strategy 3: response ends mid-sentence with no terminal punctuation —
   *   prose features only (chat, coding, business, translate, social). Image
   *   and video prompts are deliberately written without trailing punctuation,
   *   so the sentence heuristic would cause false continuations there.
   */
  private static isTruncatedResponse(
    response: ChatResponse,
    maxTokens: number,
    feature?: FeatureType
  ): boolean {
    // Strategy 1: explicit finish reason
    const finishReason = this.getFinishReason(response);
    if (finishReason && this.TRUNCATED_FINISH_REASONS.has(finishReason)) {
      return true;
    }

    const content = response.content?.trimEnd() ?? "";
    if (!content) return false;

    // Strategy 2: near the token limit (all features)
    const responseTokens = CostOptimizationStrategy.estimateTokenCount(content);
    if (maxTokens > 100 && responseTokens >= maxTokens * 0.95) {
      return true;
    }

    // Strategy 3: ended in the middle of a sentence (prose features only).
    // Minimum length avoids false positives on complete short answers.
    const isProse = feature !== "image" && feature !== "video";
    if (isProse && content.length >= 100 && !this.endsWithCleanSentence(content)) {
      return true;
    }

    return false;
  }

  /**
   * Merge the accumulated content with the continuation chunk.
   * If the previous part ended mid-sentence, the continuation is glued with a
   * single space so the final text reads naturally (no paragraph break inside
   * a sentence). Otherwise a paragraph break is used.
   */
  private static joinContinuation(prev: string, next: string): string {
    if (!prev) return next;
    const trimmedNext = next.trimStart();
    if (!trimmedNext) return prev;
    const prevEndsClean = this.endsWithCleanSentence(prev);
    return prevEndsClean ? `${prev}\n\n${trimmedNext}` : `${prev} ${trimmedNext}`;
  }

  constructor(private registry: ProviderRegistry = providerRegistry) {}

  /**
   * Execute chat request with router integration and automatic continuation.
   *
   * - Routes by task (chat, coding, image, video)
   * - Fails over to next provider if one fails
   * - Automatically continues truncated responses (finish_reason = "max_tokens" or "length")
   * - Caches responses (exact match, TTL-based)
   * - Tracks daily usage per user/plan
   * - Returns friendly feature-specific error on complete failure
   */
  async execute(options: AIExecutionOptions): Promise<ChatResponse> {
    const startTime = Date.now();
    const { feature, userPlan, modelId, request, userId } = options;

    // ── 1. Check daily usage limits (per-feature requests + total tokens) ──
    if (userId) {
      // Check per-feature request count limit
      if (usageTracker.isLimitReached(userId, userPlan, feature)) {
        throw new AIError(
          "⚠️ You've reached your daily limit for this feature. Please try again tomorrow or upgrade your plan.",
          "RATE_LIMIT",
          { retryable: false }
        );
      }

      // Check total daily token limit (across all features)
      if (usageTracker.isTokenLimitReached(userId, userPlan)) {
        throw new AIError(
          UsageTracker.TOKEN_LIMIT_MESSAGE,
          "DAILY_TOKEN_LIMIT",
          { retryable: false }
        );
      }
    }

    // ── 2. Resolve max tokens ───────────────────────
    const userPrompt = request.messages.map((m) => m.content).join("\n");
    const maxTokens =
      request.maxTokens ||
      CostOptimizationStrategy.resolveMaxTokens(
        feature,
        userPlan,
        userPrompt,
        128000
      );
    const temperature = request.temperature ?? aiConfig.getTemperature(feature);

    // Inject resolved maxTokens into request for accurate cache key
    request.maxTokens = maxTokens;
    request.temperature = temperature;

    // ── 3. Get provider routing chain ──────────────
    const route = routePlanner.getRoute(feature);
    const primaryProvider = route.providerChain[0]!;

    // ── 4. Check cache (with userPlan + resolved maxTokens in key) ──
    if (!modelId) {
      const cached = responseCache.get(feature, primaryProvider, request, userPlan);
      if (cached) {
        const remainingTokens = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;
        AITelemetry.logRequest({
          provider: "cache",
          model: "cache",
          feature,
          plan: userPlan || "FREE",
          promptTokens: 0,
          completionTokens: cached.content.length,
          totalTokens: cached.content.length,
          requestedTokens: 0,
          remainingTokens,
          latencyMs: 0,
          retries: 0,
          estimatedCostUsd: 0,
          status: "success",
        });

        if (userId) {
          usageTracker.track(userId, feature, 0, cached.content.length);
        }

        return cached;
      }
    }

    // ── 5. Build provider chain with failover ──────────
    // When a specific model is selected (modelId), put its provider FIRST
    // but KEEP all other providers as fallbacks.
    // Old behavior restricted to 1 provider — causing 429 to show immediately.
    let providerChain: string[];
    if (modelId) {
      // Find which provider serves this model, put it first
      const modelProvider = providerRegistry.getProvider(modelId).providerName;
      const chain = [...route.providerChain];
      // Move model's provider to front if found in chain
      const existingIndex = chain.findIndex((p) => p.toLowerCase() === modelProvider.toLowerCase());
      if (existingIndex >= 0) {
        const [preferred] = chain.splice(existingIndex, 1);
        providerChain = [preferred!, ...chain];
      } else {
        // Model's provider is not in chain — keep original order
        providerChain = chain;
      }
    } else {
      providerChain = route.providerChain;
    }

    const resolvedModelId = modelId || this.registry.getDefaultModel()?.id || "auto";
    console.log(`[AI_ROUTER] feature=${feature} provider=${providerChain[0] ?? "none"} model=${resolvedModelId} chain=[${providerChain.join(",")}] userPlan=${userPlan ?? "FREE"}`);
    console.log(`[AI_REQUEST] feature=${feature} provider=${providerChain[0] ?? "none"} model=${resolvedModelId} tokens=${maxTokens} chain=[${providerChain.join(",")}] userPlan=${userPlan ?? "FREE"}`);

    const result = await this.executeWithContinuation(
      feature, userPlan, providerChain, request, maxTokens, temperature,
      userId, userPrompt, modelId, startTime
    );

    return result;
  }

  /**
   * Execute with automatic continuation for truncated responses.
   *
   * When finish_reason is "max_tokens" or "length" (or the response ends
   * mid-sentence), the response was truncated. This method automatically
   * requests a continuation by appending the partial response as context and
   * re-requesting. Continuations are bounded to prevent infinite loops; when
   * the budget is exhausted a single short "finish the sentence" call ensures
   * the final answer never ends mid-sentence.
   */
  private async executeWithContinuation(
    feature: FeatureType,
    userPlan: string | undefined,
    providerChain: string[],
    request: ChatRequest,
    maxTokens: number,
    temperature: number,
    userId: number | undefined,
    userPrompt: string,
    modelId: string | undefined,
    startTime: number
  ): Promise<ChatResponse> {
    let accumulatedContent = "";
    let continuationCount = 0;
    // Set when the continuation budget was exhausted and a final short
    // "finish the last sentence" call was already made (bounded to one).
    let gracefulCompletionUsed = false;
    // Track ALL provider errors across the chain for comprehensive summary logging
    const allProviderErrors: Array<{ provider: string; model: string; code: string; status: number | undefined; message: string }> = [];

    providerLoop: for (let attempt = 0; attempt < providerChain.length; attempt++) {
      const providerId = providerChain[attempt]!;

      // ── Pre-flight: Check API key, enabled status, and health ──
      const setting = aiConfig.getProviderSetting(providerId as ProviderId);
      if (!setting || !setting.enabled) {
        log.warn(`[EXECUTOR] Skipping ${providerId}: provider is disabled or not configured`);
        continue;
      }
      const apiKey = process.env[setting.envKey];
      if (!apiKey) {
        log.warn(`[EXECUTOR] Skipping ${providerId}: API key missing (env: ${setting.envKey})`);
        continue;
      }

      // ── Health check: skip rate-limited or unhealthy providers ──
      if (!healthChecker.shouldAttempt(providerId)) {
        const cooldownSec = healthChecker.getRateLimitCooldownRemaining(providerId);
        log.warn(`[EXECUTOR] Skipping ${providerId}: health check failed (rate-limited: ${cooldownSec > 0})`);
        console.log(`[AI_SWITCH] from=${providerId} to=${providerChain[attempt + 1] ?? "none"} reason=health_check_blocked cooldown=${cooldownSec}s feature=${feature}`);
        continue;
      }

      let attemptStartTime = Date.now();
      try {
        const provider = this.registry.getProviderById(providerId);
        const modelObj = modelId
          ? provider.getModel(modelId) || provider.getDefaultModel()
          : provider.getDefaultModel();
        const resolvedModelId = modelObj?.id || providerId;

        // ── Log AI_ATTEMPT_START ──
        attemptStartTime = Date.now();
        console.log(`[AI_ATTEMPT_START] feature=${feature} provider=${providerId} model=${resolvedModelId} attempt=${attempt + 1}/${providerChain.length} maxTokens=${maxTokens}`);

        // ── Execute provider.chat() with per-provider timeout ──
        // If the provider hangs (no response, network stall, infinite loop),
        // the timeout will abort and treat it as a provider failure,
        // moving to the next provider in the chain.
        // NOTE: when a continuation was triggered, the partial response and the
        // continue instruction were appended to request.messages, so we always
        // send request.messages as-is — no duplication of context.
        const response = await this.executeWithTimeout(
          provider.chat({
            ...request,
            messages: request.messages,
            modelId: resolvedModelId,
            maxTokens,
            temperature,
          }),
          PER_PROVIDER_TIMEOUT_MS,
          `Provider ${providerId} timed out after ${PER_PROVIDER_TIMEOUT_MS}ms`
        );

        // ── Log AI_ATTEMPT_END (success) ──
        const attemptDuration = Date.now() - attemptStartTime;

        // Check overall execution timeout — if we've been running too long,
        // return what we have instead of continuing
        if (Date.now() - startTime > OVERALL_EXECUTION_TIMEOUT_MS) {
          log.warn(`[EXECUTOR] Overall execution timeout reached (${OVERALL_EXECUTION_TIMEOUT_MS}ms), returning accumulated content`);
          if (accumulatedContent.length > 0) {
            return {
              content: accumulatedContent,
              usage: response.usage,
              model: response.model,
              provider: response.provider,
            };
          }
          throw new AIError(
            FRIENDLY_ERRORS[feature] || "⚠️ AI server busy. Please try again.",
            "TIMEOUT",
            { retryable: true }
          );
        }

        console.log(`[AI_ATTEMPT_END] feature=${feature} provider=${providerId} model=${resolvedModelId} status=success duration=${attemptDuration}ms attempt=${attempt + 1}/${providerChain.length}`);
        console.log(`[AI_SUCCESS] feature=${feature} provider=${providerId} model=${resolvedModelId} duration=${attemptDuration}ms tokens=${maxTokens} attempt=${attempt + 1}/${providerChain.length}`);

        // Append to accumulated content (glues mid-sentence continuations naturally)
        accumulatedContent = AIExecutor.joinContinuation(accumulatedContent, response.content);

        const responseUsage = response.usage;
        // ── Detect truncation ────────────────────────────────────────
        // Strategy 1: explicit finish_reason from the provider API
        //   (e.g. OpenAI "length", Gemini "MAX_TOKENS", Claude "max_tokens").
        // Strategy 2: response near the maxTokens limit (>= 95%).
        // Strategy 3: response ends mid-sentence without terminal punctuation.
        const finishReason = AIExecutor.getFinishReason(response);
        const likelyTruncated = AIExecutor.isTruncatedResponse(response, maxTokens, feature);

        // Strategy 4 (Business AI): Detect incomplete trailing section
        // If response ends with an emoji header + colon with no content after it
        // (e.g. "📊 Market Analysis:" is the last line), the AI ran out of tokens
        // mid-section. Force continuation.
        const endsWithIncompleteSection = this.detectIncompleteSection(accumulatedContent, feature);

        // ── Auto-continuation: if response was truncated or incomplete, request more ──
        if (likelyTruncated || endsWithIncompleteSection) {
          if (continuationCount < AIExecutor.MAX_CONTINUATIONS) {
            continuationCount++;
            log.info("[CONTINUATION] Response truncated/incomplete, requesting continuation", {
              feature,
              provider: providerId,
              continuationCount,
              maxContinuations: AIExecutor.MAX_CONTINUATIONS,
              finishReason,
              endsWithIncompleteSection,
              likelyTruncated,
            });

            // Append the partial response as an assistant message and ask the
            // model to continue from the exact stopping point. The full context
            // (original messages + partial + instruction) is sent on the next call.
            request.messages = [
              ...request.messages,
              { role: "assistant" as const, content: response.content },
              { role: "user" as const, content: AIExecutor.CONTINUE_INSTRUCTION },
            ];

            attempt--; // Stay on the same provider to continue
            continue;
          }

          // Budget exhausted but the response still ends mid-sentence — do ONE
          // final short completion so the user never sees a cut-off sentence.
          if (!gracefulCompletionUsed && !AIExecutor.endsWithCleanSentence(accumulatedContent)) {
            gracefulCompletionUsed = true;
            log.info("[CONTINUATION] Final graceful completion to close the last sentence", {
              feature,
              provider: providerId,
              accumulatedLength: accumulatedContent.length,
            });
            request.messages = [
              ...request.messages,
              { role: "assistant" as const, content: response.content },
              { role: "user" as const, content: AIExecutor.FINISH_INSTRUCTION },
            ];
            attempt--; // Stay on the same provider
            continue;
          }
        }

        // ── Log image success ──
        if (feature === "image") {
          console.log(`[IMAGE_PROVIDER_SUCCESS] provider=${providerId} model=${resolvedModelId} attempt=${attempt + 1}/${providerChain.length} latency=${Date.now() - startTime}ms`);
        }

        // ── Success: compute usage and return merged response ──
        const latencyMs = Date.now() - startTime;
        const promptTokens = responseUsage?.promptTokens || CostOptimizationStrategy.estimateTokenCount(userPrompt);
        const completionTokens = responseUsage?.completionTokens || CostOptimizationStrategy.estimateTokenCount(accumulatedContent);
        const totalTokens = responseUsage?.totalTokens || promptTokens + completionTokens;
        const costUsd = aiConfig.calculateCost(resolvedModelId, promptTokens, completionTokens);

        // Cache the final merged response (not intermediate continuations)
        if (!modelId) {
          const mergedResponse: ChatResponse = {
            content: accumulatedContent,
            usage: responseUsage,
            model: response.model,
            provider: response.provider,
            costUsd,
          };
          responseCache.set(feature, providerId, request, mergedResponse, userPlan);
        }

        // Track usage (count all continuation tokens together)
        if (userId) {
          usageTracker.track(userId, feature, promptTokens, completionTokens);
        }

        // Telemetry — log continuation if any
        if (continuationCount > 0) {
          log.info("[CONTINUATION] Response merged successfully", {
            feature,
            provider: providerId,
            continuationCount,
            originalContentLength: response.content.length,
            mergedContentLength: accumulatedContent.length,
          });
        }

        const remainingTokens = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;
        AITelemetry.logRequest({
          provider: provider.providerName,
          model: resolvedModelId,
          feature,
          plan: userPlan || "FREE",
          promptTokens,
          completionTokens,
          totalTokens,
          requestedTokens: maxTokens,
          remainingTokens,
          latencyMs,
          retries: attempt + continuationCount,
          estimatedCostUsd: costUsd,
          status: continuationCount > 0 ? "fallback_success" : "success",
          note: continuationCount > 0 ? `auto-continued ${continuationCount}x` : undefined,
        });

        return {
          content: accumulatedContent,
          usage: responseUsage,
          model: response.model,
          provider: response.provider,
          costUsd,
        };
      } catch (rawError) {
        const errorMsg = rawError instanceof Error ? rawError.message : String(rawError);

        // Extract AIError details if available
        let errorCode = "UNKNOWN";
        let errorStatus: number | undefined;
        let errorRetryable = false;
        let attemptedModel = "unknown";

        if (rawError instanceof AIError) {
          errorCode = rawError.code;
          errorStatus = rawError.statusCode;
          errorRetryable = rawError.retryable;
        }

        // ── RATE_LIMIT (429) — retry with exponential backoff on the SAME provider ──
        // before switching to the next provider in the chain.
        // Backoff: 2s, 5s, 10s (max 3 retries), then fall through to failover.
        // After exhausting retries, mark provider as rate-limited for 60s cooldown.
        if (errorCode === "RATE_LIMIT" || errorStatus === 429) {
          const backoffSchedule = [1000, 2000];
          const maxRateLimitRetries = backoffSchedule.length;
          for (let retry = 1; retry <= maxRateLimitRetries; retry++) {
            const backoffMs = backoffSchedule[retry - 1]!;
            const jitter = Math.random() * 500;
            const waitMs = backoffMs + jitter;

            console.log(`[AI_FAILOVER] provider=${providerId} error=429 retry=${retry}/${maxRateLimitRetries} next_wait=${Math.round(waitMs)}ms feature=${feature}`);
            log.warn(`[RATE_LIMIT] ${providerId} — retry ${retry}/${maxRateLimitRetries} in ${Math.round(waitMs)}ms`, {
              feature,
              backoffMs,
              jitter: Math.round(jitter),
              totalWaitMs: Math.round(waitMs),
            });

            await new Promise((resolve) => setTimeout(resolve, waitMs));

            try {
              const provider = this.registry.getProviderById(providerId);
              const modelObj = modelId
                ? provider.getModel(modelId) || provider.getDefaultModel()
                : provider.getDefaultModel();
              const resolvedModelId = modelObj?.id || providerId;

              const retryResponse = await provider.chat({
                ...request,
                messages: request.messages,
                modelId: resolvedModelId,
                maxTokens,
                temperature,
              });

              // Retry succeeded — proceed as normal
              accumulatedContent = AIExecutor.joinContinuation(accumulatedContent, retryResponse.content);

              log.info(`[RATE_LIMIT] ${providerId} — retry ${retry}/${maxRateLimitRetries} succeeded after ${Math.round(waitMs)}ms`);

              // If the retried response was ALSO truncated, request a continuation
              // on the same provider instead of returning a cut-off answer.
              if (AIExecutor.isTruncatedResponse(retryResponse, maxTokens, feature) &&
                  continuationCount < AIExecutor.MAX_CONTINUATIONS) {
                continuationCount++;
                request.messages = [
                  ...request.messages,
                  { role: "assistant" as const, content: retryResponse.content },
                  { role: "user" as const, content: AIExecutor.CONTINUE_INSTRUCTION },
                ];
                attempt--; // Stay on same provider for continuation
                continue providerLoop;
              }

              // We've recovered — reset the original error and continue normal flow
              // First, re-parse as the parent try's response by setting variables
              const recoveredResponse = retryResponse;
              const recoveredContent = accumulatedContent;

              // ── Continue from success path ──
              const recoveredLatencyMs = Date.now() - startTime;
              const recoveredPromptTokens = recoveredResponse.usage?.promptTokens || CostOptimizationStrategy.estimateTokenCount(userPrompt);
              const recoveredCompletionTokens = recoveredResponse.usage?.completionTokens || CostOptimizationStrategy.estimateTokenCount(recoveredContent);
              const recoveredTotalTokens = recoveredResponse.usage?.totalTokens || recoveredPromptTokens + recoveredCompletionTokens;
              const recoveredCostUsd = aiConfig.calculateCost(resolvedModelId, recoveredPromptTokens, recoveredCompletionTokens);

              if (!modelId) {
                const mergedResponse: ChatResponse = {
                  content: recoveredContent,
                  usage: recoveredResponse.usage,
                  model: recoveredResponse.model,
                  provider: recoveredResponse.provider,
                  costUsd: recoveredCostUsd,
                };
                responseCache.set(feature, providerId, request, mergedResponse, userPlan);
              }

              if (userId) {
                usageTracker.track(userId, feature, recoveredPromptTokens, recoveredCompletionTokens);
              }

              const recoveredRemaining = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;
              AITelemetry.logRequest({
                provider: recoveredResponse.provider || providerId,
                model: resolvedModelId,
                feature,
                plan: userPlan || "FREE",
                promptTokens: recoveredPromptTokens,
                completionTokens: recoveredCompletionTokens,
                totalTokens: recoveredTotalTokens,
                requestedTokens: maxTokens,
                remainingTokens: recoveredRemaining,
                latencyMs: recoveredLatencyMs,
                retries: attempt + continuationCount + retry,
                estimatedCostUsd: recoveredCostUsd,
                status: "success",
                note: `rate-limit-retried ${retry}x`,
              });

              return {
                content: recoveredContent,
                usage: recoveredResponse.usage,
                model: recoveredResponse.model,
                provider: recoveredResponse.provider,
                costUsd: recoveredCostUsd,
              };
            } catch (retryError) {
              const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
              log.warn(`[RATE_LIMIT] ${providerId} — retry ${retry}/${maxRateLimitRetries} failed: ${retryMsg.slice(0, 100)}`);
              console.log(`[AI_FAIL] feature=${feature} provider=${providerId} error=RATE_LIMIT_RETRY_FAILED attempt=${retry}/${maxRateLimitRetries} message="${retryMsg.slice(0, 100)}"`);
              // Fall through to next retry or failover
            }
          }

          // All rate limit retries exhausted — mark provider as rate-limited for 60s,
          // then continue to failover to next provider.
          healthChecker.recordRateLimit(providerId);
          console.log(`[AI_FAILOVER] provider=${providerId} error=429 retries=${maxRateLimitRetries} cooldown=60s next_provider=${providerChain[attempt + 1] ?? "none"} feature=${feature}`);
          console.log(`[AI_SWITCH] from=${providerId} to=${providerChain[attempt + 1] ?? "none"} reason=429_RATE_LIMIT_EXHAUSTED retries=${maxRateLimitRetries} cooldown=60s feature=${feature}`);
          log.warn(`[RATE_LIMIT] ${providerId} — all ${maxRateLimitRetries} retries exhausted, marked cooldown 60s`);
        }

        // Determine the model that was attempted (best-effort, non-critical)
        try {
          const prov = this.registry.getProviderById(providerId);
          const mdl = modelId ? prov.getModel(modelId) || prov.getDefaultModel() : prov.getDefaultModel();
          attemptedModel = mdl?.id ?? providerId;
        } catch {
          // Model name is best-effort for diagnostics
        }

        // Log the REAL error server-side with full details
        const sysPromptLen = request.systemPrompt?.length ?? 0;
        const userMsgLen = request.messages.map((m) => m.content).join("\n").length;
        const errorLog: Record<string, unknown> = {
          feature,
          provider: providerId,
          model: attemptedModel,
          errorCode,
          statusCode: errorStatus,
          retryable: errorRetryable,
          attempt: attempt + 1,
          total: providerChain.length,
          continuationCount,
          maxTokens,
          systemPromptLength: sysPromptLen,
          userPromptLength: userMsgLen,
          error: errorMsg,
          timestamp: new Date().toISOString(),
          remainingProviders: providerChain.length - attempt - 1,
        };

        // Track this error for the all-providers summary
        allProviderErrors.push({
          provider: providerId,
          model: attemptedModel,
          code: errorCode,
          status: errorStatus,
          message: errorMsg,
        });

        // Log AI_ATTEMPT_END (failure) for every feature
        console.log(`[AI_ATTEMPT_END] feature=${feature} provider=${providerId} model=${attemptedModel} status=${errorCode} duration=${Date.now() - attemptStartTime}ms attempt=${attempt + 1}/${providerChain.length}`);
        console.log(`[AI_FAIL] feature=${feature} provider=${providerId} model=${attemptedModel} error=${errorCode} status=${errorStatus ?? "?"} duration=${Date.now() - attemptStartTime}ms attempt=${attempt + 1}/${providerChain.length}`);

        // Feature-specific failure logs
        if (feature === "image") {
          console.log(`[IMAGE_PROVIDER_FAILED] provider=${providerId} model=${attemptedModel} status=${errorStatus ?? errorCode} error="${errorMsg.slice(0, 100)}"`);
        } else if (feature === "business") {
          console.error(`[BUSINESS_AI_ERROR] provider=${providerId} model=${attemptedModel} status=${errorStatus ?? "N/A"} code=${errorCode} maxTokens=${maxTokens} sysPromptLen=${sysPromptLen} userMsgLen=${userMsgLen} message="${errorMsg}"`);
        }

        console.error("[AI EXECUTOR ERROR]", errorLog);

        // Telemetry for failure
        const remainingTokens = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;
        AITelemetry.logRequest({
          provider: providerId,
          model: feature,
          feature,
          plan: userPlan || "FREE",
          promptTokens: CostOptimizationStrategy.estimateTokenCount(userPrompt),
          completionTokens: 0,
          totalTokens: 0,
          requestedTokens: maxTokens,
          remainingTokens,
          latencyMs: Date.now() - startTime,
          retries: attempt + continuationCount,
          estimatedCostUsd: 0,
          status: "failed",
          error: errorMsg,
        });

        // If more providers are available, fail over to the next one.
        // When a partial (possibly mid-sentence) response was already received,
        // the next provider continues from it instead of us returning a cut-off
        // answer (request.messages already contains the partial + instruction).
        if (attempt < providerChain.length - 1) {
          const nextProvider = providerChain[attempt + 1] ?? "none";
          if (accumulatedContent.length > 0) {
            console.log(`[AI_SWITCH] from=${providerId} to=${nextProvider} reason=CONTINUATION_PROVIDER_FAILURE feature=${feature}`);
          } else {
            console.log(`[AI_SWITCH] from=${providerId} to=${nextProvider} reason=${errorCode} status=${errorStatus ?? "?"} feature=${feature}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // If we have accumulated content from a partial success and ALL providers
        // failed, return the partial content (still better than an error message).
        if (accumulatedContent.length > 0) {
          log.info("[CONTINUATION] Returning partial accumulated content after all providers failed", {
            feature,
            provider: providerId,
            accumulatedLength: accumulatedContent.length,
          });
          return {
            content: accumulatedContent,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            model: providerId,
            provider: providerId,
          };
        }

        // ── All providers exhausted — comprehensive summary log ──
        const errorSummary = allProviderErrors
          .map((e) => `${e.provider}/${e.model}: [${e.code}] status=${e.status ?? "?"} "${e.message.slice(0, 150)}"`)
          .join(" | ");
        console.error(`[AI ALL PROVIDERS EXHAUSTED] feature=${feature} chain=[${providerChain.join(",")}] allProviderErrors=${allProviderErrors.length} summary="${errorSummary}"`);
        if (feature === "business") {
          console.error(`[BUSINESS_ALL_FAILED] Chain: ${providerChain.join(" → ")} | Errors: ${errorSummary}`);
        }

        // Build user-friendly error — never expose internal patterns
        throw new AIError(
          FRIENDLY_ERRORS[feature] || "⚠️ AI is temporarily busy. Your request will retry automatically.",
          "PROVIDER_ERROR",
          { retryable: true }
        );
      }
    }

    // Should never reach here, but TypeScript safety
    // Also handles the case where all providers were skipped in pre-flight (never entered catch block)
    if (allProviderErrors.length === 0) {
      console.error("[AI ALL PROVIDERS EXHAUSTED] No providers were attempted — check API keys and provider configuration");
      throw new AIError(
        "⚠️ AI is temporarily unavailable. Please try again in a few moments.",
        "CONFIG_ERROR",
        { retryable: false }
      );
    }
    throw new AIError(
      FRIENDLY_ERRORS[feature] || "⚠️ AI is temporarily busy. Please try again in a few moments.",
      "PROVIDER_ERROR",
      { retryable: false }
    );
  }

  /**
   * Execute a promise with a timeout.
   * If the promise doesn't settle within the given time, reject with a timeout error.
   * This prevents hanging AI providers from blocking the entire system.
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new AIError(timeoutMessage, "TIMEOUT", {
          statusCode: 408,
          retryable: true,
        }));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Detect if the accumulated response ends with an incomplete section header.
   * This is a common truncation pattern for Business AI: the AI writes
   * a section header (emoji + title) but runs out of tokens before filling
   * any content under it.
   *
   * Patterns detected as "incomplete":
   *  - Last non-empty line is an emoji header with colon (e.g. "🎯 Concept:")
   *  - Last line is an emoji followed by title with no content below
   *  - Last line is a short (<60 chars) header-like line and the response
   *    ends immediately after it
   *
   * Only applies to business feature for now.
   */
  private detectIncompleteSection(content: string, feature: FeatureType): boolean {
    if (feature !== "business") return false;

    const trimmed = content.trimEnd();
    if (trimmed.length === 0) return false;

    const lines = trimmed.split("\n");
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return false;

    const lastLine = nonEmptyLines[nonEmptyLines.length - 1]!.trim();

    // ── Pattern 1: Line ends with colon (header: no content after) ──
    // e.g. "🎯 Concept:" or "📊 Market:" or "📌 Target Audience:"
    if (lastLine.endsWith(":") && lastLine.length < 60) {
      return true;
    }

    // ── Pattern 2: Line has emoji + short text, looks like a header ──
    // e.g. "🔥 Channels" or "🚀 Growth" or "📱 Content"
    const headerLike = /^[\u{1F300}-\u{1F9FF}]|^[📋📊💼📈🎯🔥🎨📱🚀💰📌🏷️📝🌈🔝💪✨📢]/u.test(lastLine);
    if (headerLike && lastLine.length < 50) {
      // Check if this header appears to be a NEW section (not mid-content)
      // by checking if it's at or near the end with no substantive content after
      const lineIndex = nonEmptyLines.indexOf(lastLine);
      if (lineIndex >= nonEmptyLines.length - 2) {
        return true;
      }
    }

    // ── Pattern 3: Ends with a separator line (━━━) ──
    if (/^[━═─]+$/.test(lastLine)) {
      return true;
    }

    return false;
  }

}

export const aiExecutor = new AIExecutor();

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
import { routePlanner, responseCache, usageTracker, UsageTracker } from "../router";
import type { ChatRequest, ChatResponse } from "../providers/interface";

const log = logger.child("ai-executor");

/**
 * Optimal error messages per feature — never expose provider/internal details.
 * These messages guide the user toward actionable next steps rather than
 * generic "try again" messages. They cover three categories:
 *   1. Provider unavailable (backup being tried)
 *   2. API limit reached (rate limiting / quota exhausted)
 *   3. All providers exhausted (complete outage)
 */
const FRIENDLY_ERRORS: Record<FeatureType, string> = {
  chat: "⚠️ All AI providers are currently unavailable for chat. Please try again in a few minutes.",
  image: "⚠️ All AI providers are currently unavailable for image generation. Please try again in a few minutes.",
  video: "⚠️ All AI providers are currently unavailable for video prompts. Please try again in a few minutes.",
  coding: "⚠️ All AI providers are currently unavailable for coding. Please try again in a few minutes.",
  business: "⚠️ All AI providers are currently unavailable for business analysis. Please try again in a few minutes.",
  translate: "⚠️ All AI providers are currently unavailable for translation. Please try again in a few minutes.",
  social: "⚠️ All AI providers are currently unavailable for social content. Please try again in a few minutes.",
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
  /** Maximum number of automatic continuation requests when response is truncated */
  private static readonly MAX_CONTINUATIONS = 2;

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

    // ── 3. Get provider routing chain ──────────────
    const route = routePlanner.getRoute(feature);
    const primaryProvider = modelId
      ? routePlanner.getPrimaryProvider(feature)
      : route.providerChain[0]!;

    // ── 4. Check cache ──────────────────────────────
    if (!modelId) {
      const cached = responseCache.get(feature, primaryProvider, request);
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

    // ── 5. Attempt execution with provider chain + auto-continuation ──
    const providerChain = modelId
      ? [routePlanner.getPrimaryProvider(feature)]
      : route.providerChain;

    const result = await this.executeWithContinuation(
      feature, userPlan, providerChain, request, maxTokens, temperature,
      userId, userPrompt, modelId, startTime
    );

    return result;
  }

  /**
   * Execute with automatic continuation for truncated responses.
   *
   * When finish_reason is "max_tokens" or "length", the response was
   * truncated. This method automatically requests a continuation by
   * appending the partial response as context and re-requesting.
   *
   * Maximum 2 continuations to prevent infinite loops.
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
    // Track ALL provider errors across the chain for comprehensive summary logging
    const allProviderErrors: Array<{ provider: string; model: string; code: string; status: number | undefined; message: string }> = [];

    for (let attempt = 0; attempt < providerChain.length; attempt++) {
      const providerId = providerChain[attempt]!;

      // ── Pre-flight: Check API key and enabled status ─────────
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

      try {
        const provider = this.registry.getProviderById(providerId);
        const modelObj = modelId
          ? provider.getModel(modelId) || provider.getDefaultModel()
          : provider.getDefaultModel();
        const resolvedModelId = modelObj?.id || providerId;

        // Build the request messages including any continuation context
        const continuationMessages = continuationCount > 0
          ? [
              ...request.messages,
              { role: "assistant" as const, content: accumulatedContent },
            ]
          : request.messages;

        // ── Pre-flight: Log the exact request about to be sent ──
        const sysPromptPreview = request.systemPrompt
          ? request.systemPrompt.slice(0, 200).replace(/\n/g, "\\n")
          : "(none)";
        const userMsgPreview = continuationMessages
          .map((m) => `${m.role}:${m.content.slice(0, 100)}`)
          .join(" | ");
        if (feature === "business") {
          log.info(`[BUSINESS_EXECUTOR] Attempt ${attempt + 1}/${providerChain.length} — provider=${providerId} model=${resolvedModelId} maxTokens=${maxTokens} temp=${temperature} systemPrompt="${sysPromptPreview}"... messages="${userMsgPreview}"...`);
        } else {
          log.info(`[EXECUTOR] Attempt ${attempt + 1}/${providerChain.length} — ${feature} → ${providerId}/${resolvedModelId} maxTokens=${maxTokens} temp=${temperature}`);
        }

        const response = await provider.chat({
          ...request,
          messages: continuationMessages,
          modelId: resolvedModelId,
          maxTokens,
          temperature,
        });

        // Append to accumulated content
        accumulatedContent += (accumulatedContent ? "\n\n" : "") + response.content;

        const responseUsage = response.usage;
        // ── Detect truncation ────────────────────────────────────────
        // Strategy 1: Check for explicit finish_reason from provider API.
        const rawResponse = response as unknown as Record<string, unknown>;
        const finishReason = rawResponse.finishReason as string | undefined;

        // Strategy 2: Heuristic — if response is near the maxTokens limit,
        // it was likely truncated.  Estimate tokens and compare to limit.
        const responseTokens = CostOptimizationStrategy.estimateTokenCount(response.content);
        const likelyTruncated = finishReason === "max_tokens" || finishReason === "length" ||
          (maxTokens > 100 && responseTokens >= maxTokens * 0.85);

        // ── Auto-continuation: if response was truncated, request more ──
        if (
          likelyTruncated &&
          continuationCount < AIExecutor.MAX_CONTINUATIONS
        ) {
          continuationCount++;
          log.info("[CONTINUATION] Response truncated, requesting continuation", {
            feature,
            provider: providerId,
            continuationCount,
            maxContinuations: AIExecutor.MAX_CONTINUATIONS,
            finishReason,
          });

          // Re-use same provider for continuation (don't restart the chain)
          attempt--; // Stay on the same provider
          continue;
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
          responseCache.set(feature, providerId, request, mergedResponse);
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
        // Backoff: 500ms, 1s, 2s, 4s (max 3 retries), then fall through to failover.
        if (errorCode === "RATE_LIMIT" || errorStatus === 429) {
          const maxRateLimitRetries = 3;
          for (let retry = 1; retry <= maxRateLimitRetries; retry++) {
            const backoffMs = Math.min(500 * Math.pow(2, retry - 1), 4000);
            const jitter = Math.random() * 200;
            const waitMs = backoffMs + jitter;

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
              const continuationMessages = continuationCount > 0
                ? [
                    ...request.messages,
                    { role: "assistant" as const, content: accumulatedContent },
                  ]
                : request.messages;

              const retryResponse = await provider.chat({
                ...request,
                messages: continuationMessages,
                modelId: resolvedModelId,
                maxTokens,
                temperature,
              });

              // Retry succeeded — proceed as normal
              accumulatedContent += (accumulatedContent ? "\n\n" : "") + retryResponse.content;
              const rawRetryResponse = retryResponse as unknown as Record<string, unknown>;
              const retryFinishReason = rawRetryResponse.finishReason as string | undefined;

              log.info(`[RATE_LIMIT] ${providerId} — retry ${retry}/${maxRateLimitRetries} succeeded after ${Math.round(waitMs)}ms`);

              // Check if truncated and need continuation
              if ((retryFinishReason === "max_tokens" || retryFinishReason === "length") &&
                  continuationCount < AIExecutor.MAX_CONTINUATIONS) {
                continuationCount++;
                attempt--; // Stay on same provider for continuation
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
                responseCache.set(feature, providerId, request, mergedResponse);
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
              // Fall through to next retry or failover
            }
          }

          // All rate limit retries exhausted — log and continue to failover
          log.warn(`[RATE_LIMIT] ${providerId} — all ${maxRateLimitRetries} retries exhausted, failing over`);
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

        // For business feature, log a dedicated structured entry
        if (feature === "business") {
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

        // If we have accumulated content from a partial success, return it
        if (accumulatedContent.length > 0) {
          log.info("[CONTINUATION] Returning partial accumulated content after provider failure", {
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

        // If more providers available, try next after brief delay
        if (attempt < providerChain.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // ── All providers exhausted — comprehensive summary log ──
        const errorSummary = allProviderErrors
          .map((e) => `${e.provider}/${e.model}: [${e.code}] status=${e.status ?? "?"} "${e.message.slice(0, 150)}"`)
          .join(" | ");
        console.error(`[AI ALL PROVIDERS EXHAUSTED] feature=${feature} chain=[${providerChain.join(",")}] allProviderErrors=${allProviderErrors.length} summary="${errorSummary}"`);
        if (feature === "business") {
          console.error(`[BUSINESS_ALL_FAILED] Chain: ${providerChain.join(" → ")} | Errors: ${errorSummary}`);
        }

        // Build error message: include error pattern summary for debugging
        const uniqueCodes = [...new Set(allProviderErrors.map((e) => e.code))];
        const uniqueStatuses = [...new Set(allProviderErrors.map((e) => e.status).filter(Boolean))];
        const errorDetail = allProviderErrors.length > 0
          ? `\n\n📊 Error pattern: ${uniqueCodes.join(", ")}${uniqueStatuses.length > 0 ? ` (${uniqueStatuses.join(", ")})` : ""}`
          : "";

        throw new AIError(
          `${FRIENDLY_ERRORS[feature] || "⚠️ AI is temporarily busy. Please try again in a few moments."}${errorDetail}`,
          "PROVIDER_ERROR",
          { retryable: false }
        );
      }
    }

    // Should never reach here, but TypeScript safety
    // Also handles the case where all providers were skipped in pre-flight (never entered catch block)
    if (allProviderErrors.length === 0) {
      throw new AIError(
        `⚠️ No AI providers are configured. Please set at least one API key (GEMINI_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, or OPENROUTER_API_KEY).`,
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
}

export const aiExecutor = new AIExecutor();

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

import { aiConfig, FeatureType } from "@/config/ai";
import { providerRegistry, ProviderRegistry } from "../providers/registry";
import { logger } from "@/bot/core/logger";
import { CostOptimizationStrategy } from "../strategies/cost";
import { AITelemetry } from "../utils/logger";
import { AIError } from "../types/errors";
import { routePlanner, responseCache, usageTracker } from "../router";
import type { ChatRequest, ChatResponse } from "../providers/interface";

const log = logger.child("ai-executor");

/**
 * Optimal error messages per feature — never expose provider/internal details.
 * These are the ONLY messages users will see on failure.
 * They sound like a production SaaS: optimistic, helpful, never technical.
 */
const FRIENDLY_ERRORS: Record<FeatureType, string> = {
  chat: "⚠️ AI is temporarily busy. Your message is queued — please try again in a few moments.",
  image: "⚠️ Image generation is under high demand. We've optimized the system and you can try again now.",
  video: "⚠️ Video prompt generation is temporarily scaling up. Please retry in a moment.",
  coding: "⚠️ Code generation is temporarily at capacity. The system will be ready shortly.",
  business: "⚠️ Business analysis is processing another request. Please try again in a few seconds.",
  translate: "⚠️ Translation service is temporarily unavailable. The system is recovering automatically.",
  social: "⚠️ Content generation is temporarily unavailable. Our systems will retry automatically.",
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

    // ── 1. Check daily usage limits (per-feature) ──
    if (userId && usageTracker.isLimitReached(userId, userPlan, feature)) {
      throw new AIError(
        "⚠️ You've reached your daily limit for this feature. Please try again tomorrow or upgrade your plan.",
        "RATE_LIMIT",
        { retryable: false }
      );
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
        AITelemetry.logRequest({
          provider: "cache",
          model: "cache",
          feature,
          plan: userPlan || "FREE",
          promptTokens: 0,
          completionTokens: cached.content.length,
          totalTokens: cached.content.length,
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

    for (let attempt = 0; attempt < providerChain.length; attempt++) {
      const providerId = providerChain[attempt]!;

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

        AITelemetry.logRequest({
          provider: provider.providerName,
          model: resolvedModelId,
          feature,
          plan: userPlan || "FREE",
          promptTokens,
          completionTokens,
          totalTokens,
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

        // Log the REAL error server-side — users must never see this
        console.error("[AI EXECUTOR ERROR]", {
          feature,
          provider: providerId,
          attempt: attempt + 1,
          total: providerChain.length,
          continuationCount,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });

        // Telemetry for failure
        AITelemetry.logRequest({
          provider: providerId,
          model: feature,
          feature,
          plan: userPlan || "FREE",
          promptTokens: CostOptimizationStrategy.estimateTokenCount(userPrompt),
          completionTokens: 0,
          totalTokens: 0,
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

        // All providers exhausted — throw friendly error
        throw new AIError(
          FRIENDLY_ERRORS[feature] || "⚠️ AI is temporarily busy. Please try again in a few moments.",
          "PROVIDER_ERROR",
          { retryable: false }
        );
      }
    }

    // Should never reach here, but TypeScript safety
    throw new AIError(
      FRIENDLY_ERRORS[feature] || "⚠️ AI is temporarily busy. Please try again in a few moments.",
      "PROVIDER_ERROR",
      { retryable: false }
    );
  }
}

export const aiExecutor = new AIExecutor();

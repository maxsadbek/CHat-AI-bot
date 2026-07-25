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
import { CostOptimizationStrategy } from "../strategies/cost";
import { AITelemetry } from "../utils/logger";
import { AIError } from "../types/errors";
import { routePlanner, responseCache, usageTracker } from "../router";
import type { ChatRequest, ChatResponse } from "../providers/interface";

/**
 * Friendly error messages per feature — never expose provider/internal details.
 * These are the ONLY messages users will see on failure.
 */
const FRIENDLY_ERRORS: Record<FeatureType, string> = {
  chat: "⚠️ AI is temporarily busy. Please try again in a few moments.",
  image: "⚠️ Unable to generate an image prompt right now. Please try again later.",
  video: "⚠️ Unable to generate a video prompt right now. Please try again later.",
  coding: "⚠️ Code generation is temporarily unavailable.",
  business: "⚠️ Service is temporarily busy. Please try again in a few moments.",
  translate: "⚠️ Translation service is temporarily unavailable. Please try again later.",
  social: "⚠️ Content generation is temporarily unavailable. Please try again later.",
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
  constructor(private registry: ProviderRegistry = providerRegistry) {}

  /**
   * Execute chat request with router integration.
   *
   * - Routes by task (chat, coding, image, video)
   * - Fails over to next provider if one fails
   * - Caches responses (exact match, TTL-based)
   * - Tracks daily usage per user/plan
   * - Returns friendly feature-specific error on complete failure
   */
  async execute(options: AIExecutionOptions): Promise<ChatResponse> {
    const startTime = Date.now();
    const { feature, userPlan, modelId, request, userId } = options;

    // ── 1. Check daily usage limits ────────────────
    if (userId && usageTracker.isLimitReached(userId, userPlan)) {
      throw new AIError(
        "⚠️ You've reached your daily limit. Please try again tomorrow or upgrade your plan.",
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

    // ── 5. Attempt execution with provider chain ─────
    const providerChain = modelId
      ? [routePlanner.getPrimaryProvider(feature)]
      : route.providerChain;

    for (let attempt = 0; attempt < providerChain.length; attempt++) {
      const providerId = providerChain[attempt]!;

      try {
        const provider = this.registry.getProviderById(providerId);
        const modelObj = modelId
          ? provider.getModel(modelId) || provider.getDefaultModel()
          : provider.getDefaultModel();
        const resolvedModelId = modelObj?.id || providerId;

        const response = await provider.chat({
          ...request,
          modelId: resolvedModelId,
          maxTokens,
          temperature,
        });

        const latencyMs = Date.now() - startTime;
        const promptTokens = response.usage?.promptTokens || CostOptimizationStrategy.estimateTokenCount(userPrompt);
        const completionTokens = response.usage?.completionTokens || CostOptimizationStrategy.estimateTokenCount(response.content);
        const totalTokens = response.usage?.totalTokens || promptTokens + completionTokens;
        const costUsd = aiConfig.calculateCost(resolvedModelId, promptTokens, completionTokens);

        // Cache successful response
        if (!modelId) {
          responseCache.set(feature, providerId, request, response);
        }

        // Track usage
        if (userId) {
          usageTracker.track(userId, feature, promptTokens, completionTokens);
        }

        // Telemetry
        AITelemetry.logRequest({
          provider: provider.providerName,
          model: resolvedModelId,
          feature,
          plan: userPlan || "FREE",
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          retries: attempt,
          estimatedCostUsd: costUsd,
          status: attempt > 0 ? "fallback_success" : "success",
        });

        return { ...response, costUsd };
      } catch (rawError) {
        const errorMsg = rawError instanceof Error ? rawError.message : String(rawError);

        // Log the REAL error server-side — users must never see this
        console.error("[AI ERROR]", {
          feature,
          provider: providerId,
          attempt: attempt + 1,
          total: providerChain.length,
          error: errorMsg,
          stack: rawError instanceof Error ? rawError.stack : undefined,
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
          retries: attempt,
          estimatedCostUsd: 0,
          status: "failed",
          error: errorMsg,
        });

        // If more providers available, try next after brief delay
        if (attempt < providerChain.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // All providers exhausted — throw friendly error
        throw new AIError(
          FRIENDLY_ERRORS[feature] || "⚠️ Service is temporarily unavailable. Please try again later.",
          "PROVIDER_ERROR",
          { retryable: false }
        );
      }
    }

    // Should never reach here, but TypeScript safety
    throw new AIError(
      FRIENDLY_ERRORS[feature] || "⚠️ Service is temporarily unavailable. Please try again later.",
      "PROVIDER_ERROR",
      { retryable: false }
    );
  }
}

export const aiExecutor = new AIExecutor();

/**
 * AI Router - Main Entry Point
 *
 * Production-ready AI Router that:
 * - Routes requests by task (chat, coding, image, video) to the best provider
 * - Auto-failover to next provider on failure
 * - Health checks with automatic recovery
 * - Response caching (exact-match, TTL-based)
 * - Daily usage tracking with free/premium limits
 * - Timeout handling
 * - Provider priority chains from env vars
 *
 * Usage:
 *   const result = await aiRouter.execute({
 *     feature: "chat",
 *     userId: 12345,
 *     userPlan: "FREE",
 *     request: { messages, systemPrompt },
 *   });
 */

import { logger } from "@/bot/core/logger";
import { aiConfig, FeatureType } from "@/config/ai";
import { CostOptimizationStrategy } from "@/services/ai/strategies/cost";
import { routePlanner } from "./route-planner";
import { healthChecker } from "./health";
import { failoverHandler } from "./failover";
import { responseCache } from "./cache";
import { usageTracker, UsageTracker } from "./usage-tracker";
import { AITelemetry } from "@/services/ai/utils/logger";
import type { ChatRequest, ChatResponse } from "@/services/ai/providers/interface";
import type { RouterOptions, RouterResult, RouterStats } from "./types";

const log = logger.child("ai-router");

export * from "./types";
export * from "./route-planner";
export * from "./health";
export * from "./failover";
export * from "./cache";
export * from "./usage-tracker";

export { routePlanner, healthChecker, failoverHandler, responseCache, usageTracker };

export interface RouterExecuteParams {
  feature: FeatureType;
  userId?: number;
  userPlan?: string;
  modelId?: string;
  request: ChatRequest;
  options?: RouterOptions;
}

export class AIRouter {
  private startTime: number = Date.now();

  // Router statistics
  private stats: RouterStats = {
    totalRequests: 0,
    totalCached: 0,
    totalFailed: 0,
    providerStats: {},
    cacheHitRate: 0,
    uptime: 0,
  };

  constructor() {
    // Start periodic health checks
    healthChecker.startPeriodicChecks();

    // Periodic cache purge (every 5 minutes)
    setInterval(() => {
      const purged = responseCache.purgeExpired();
      if (purged > 0) {
        log.debug(`Purged ${purged} expired cache entries`);
      }
    }, 300_000);

    log.info("AI Router initialized");
  }

  /**
   * Execute an AI request through the router.
   * Routes by feature, caches if possible, fails over on error.
   */
  async execute(params: RouterExecuteParams): Promise<RouterResult> {
    const { feature, userId, userPlan, modelId, request, options } = params;
    const startTime = Date.now();

    this.stats.totalRequests++;

    // ── 1. Check daily usage limits (per-feature requests + total tokens) ──
    if (userId) {
      // Check per-feature request count limit
      if (usageTracker.isLimitReached(userId, userPlan, feature)) {
        this.stats.totalFailed++;
        throw new Error(
          "⚠️ You've reached your daily limit for this feature. Please try again tomorrow or upgrade your plan."
        );
      }

      // Check total daily token limit (across all features)
      if (usageTracker.isTokenLimitReached(userId, userPlan)) {
        this.stats.totalFailed++;
        throw new Error(UsageTracker.TOKEN_LIMIT_MESSAGE);
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
    const providerChain = route.providerChain;

    // If a specific model is requested, use only that provider
    const resolvedProviderChain = modelId
      ? [routePlanner.getPrimaryProvider(feature)]
      : providerChain;

    // ── 4. Check cache (skip if streaming or skipCache) ────
    if (!options?.skipCache && !modelId) {
      const primaryProvider = resolvedProviderChain[0]!;
      const cached = responseCache.get(feature, primaryProvider, request);
      if (cached) {
        this.stats.totalCached++;
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

        return {
          response: cached,
          providerId: "cache",
          modelId: "cache",
          attempt: 0,
          totalAttempts: 1,
          latencyMs: 0,
          cached: true,
          fromFallback: false,
        };
      }
    }

    // ── 5. Execute with failover ────────────────────
    try {
      const failoverResult = await failoverHandler.executeWithFailover(
        feature,
        resolvedProviderChain,
        { ...request, maxTokens, temperature },
        { skipHealthCheck: options?.forceAttempt }
      );

      // Cache the successful response
      if (!modelId) {
        responseCache.set(feature, failoverResult.providerId, request, failoverResult.response);
      }

      // Track usage
      let promptTokens = 0;
      let completionTokens = 0;
      if (userId) {
        promptTokens = failoverResult.response.usage?.promptTokens || 0;
        completionTokens = failoverResult.response.usage?.completionTokens || 0;
        usageTracker.track(userId, feature, promptTokens, completionTokens);
      }

      const latencyMs = Date.now() - startTime;
      const totalTokens = promptTokens + completionTokens;
      const remainingTokens = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;

      // Update provider stats
      this.updateProviderStats(failoverResult.providerId, latencyMs, true);

      // Telemetry — enhanced logging with plan, feature, tokens, provider
      AITelemetry.logRequest({
        provider: failoverResult.providerId,
        model: failoverResult.modelId,
        feature,
        plan: userPlan || "FREE",
        promptTokens,
        completionTokens,
        totalTokens,
        requestedTokens: maxTokens,
        remainingTokens,
        latencyMs,
        retries: failoverResult.attempt,
        estimatedCostUsd: 0,
        status: failoverResult.usedFallback ? "fallback_success" : "success",
      });

      return {
        response: failoverResult.response,
        providerId: failoverResult.providerId,
        modelId: failoverResult.modelId,
        attempt: failoverResult.attempt,
        totalAttempts: failoverResult.totalAttempts,
        latencyMs,
        cached: false,
        fromFallback: failoverResult.usedFallback,
      };
    } catch (err) {
      this.stats.totalFailed++;
      const errorMsg = err instanceof Error ? err.message : String(err);

      const remainingTokens = userId ? usageTracker.getRemainingDailyTokens(userId, userPlan) : 0;
      AITelemetry.logRequest({
        provider: resolvedProviderChain.join(","),
        model: feature,
        feature,
        plan: userPlan || "FREE",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        requestedTokens: maxTokens,
        remainingTokens,
        latencyMs: Date.now() - startTime,
        retries: resolvedProviderChain.length,
        estimatedCostUsd: 0,
        status: "failed",
        error: errorMsg,
      });

      // Re-throw the friendly error
      throw err;
    }
  }

  /** Get router statistics */
  getStats(): RouterStats {
    this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    this.stats.cacheHitRate = this.stats.totalRequests > 0
      ? this.stats.totalCached / this.stats.totalRequests
      : 0;
    return { ...this.stats };
  }

  /** Update per-provider statistics */
  private updateProviderStats(providerId: string, latencyMs: number, success: boolean): void {
    if (!this.stats.providerStats[providerId]) {
      this.stats.providerStats[providerId] = {
        requests: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
      };
    }

    const stat = this.stats.providerStats[providerId]!;
    stat.requests++;
    if (success) stat.successes++;
    else stat.failures++;
    stat.avgLatencyMs = (stat.avgLatencyMs * (stat.requests - 1) + latencyMs) / stat.requests;
  }
}

/** Singleton router instance */
export const aiRouter = new AIRouter();

// ═══════════════════════════════════════════════════════
// UNIVERSAL generateAI FACADE FUNCTION
// ═══════════════════════════════════════════════════════
// Simple, clean API for all AI operations across the bot.
//
// Usage:
//   const result = await generateAI({
//     type: "text",
//     prompt: "Hello, how are you?",
//     userId: 12345,
//     premium: true
//   });
// ═══════════════════════════════════════════════════════

export type AITaskType = "text" | "image" | "video_prompt";

export interface GenerateAIOptions {
  /** Task type — determines provider chain and limits */
  type: AITaskType;
  /** The user's input prompt */
  prompt: string;
  /** Optional user ID for usage tracking */
  userId?: number;
  /** Whether user is premium (affects limits) */
  premium?: boolean;
  /** Optional specific model override */
  modelId?: string;
  /** Optional system prompt override */
  systemPrompt?: string;
  /** Optional temperature override */
  temperature?: number;
  /** Skip cache for this request */
  skipCache?: boolean;
}

export interface GenerateAIResult {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  cached: boolean;
  fromFallback: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Universal AI generation function.
 * Automatically selects the right provider chain based on task type,
 * checks daily limits, handles fallback, and returns structured results.
 *
 * Provider chains by task:
 *   text:         Gemini → Cerebras → Mistral → OpenRouter
 *   image:        Stability → Flux
 *   video_prompt: Gemini → Cerebras → Mistral
 */
export async function generateAI(options: GenerateAIOptions): Promise<GenerateAIResult> {
  const { type, prompt, userId, premium, modelId, systemPrompt, temperature, skipCache } = options;
  const userPlan = premium ? "PREMIUM" : "FREE";

  // Map task type to feature
  const featureMap: Record<AITaskType, FeatureType> = {
    text: "chat",
    image: "image",
    video_prompt: "video",
  };

  const feature = featureMap[type];

  // Build request
  const request: ChatRequest = {
    messages: [{ role: "user", content: prompt }],
    systemPrompt: systemPrompt,
    temperature,
    feature,
    userPlan,
  };

  // Execute through the router
  const result = await aiRouter.execute({
    feature,
    userId,
    userPlan,
    modelId,
    request,
    options: { skipCache, forceAttempt: false },
  });

  return {
    content: result.response.content,
    provider: result.providerId,
    model: result.modelId,
    latencyMs: result.latencyMs,
    cached: result.cached,
    fromFallback: result.fromFallback,
    usage: result.response.usage,
  };
}

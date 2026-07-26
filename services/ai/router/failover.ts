/**
 * AI Router - Provider Failover
 * Implements automatic failover: if the selected provider fails,
 * automatically retry the next provider in the priority chain.
 * Never returns "AI temporarily busy" if another provider is available.
 *
 * Failover strategy:
 * - Pre-flight checks: API key exists, provider enabled, health status, rate-limit cooldown
 * - Try providers in priority order: gemini → cerebras → mistral → openrouter
 * - Skip rate-limited (429 cooldown), unhealthy, misconfigured providers
 * - [AI_FAILOVER] structured logging on every event
 * - After all providers exhausted, throw friendly error
 */

import { aiConfig, type FeatureType, type ProviderId } from "@/config/ai";
import { providerRegistry } from "@/services/ai/providers/registry";
import { logger } from "@/bot/core/logger";
import { AIError } from "@/services/ai/types/errors";
import { healthChecker } from "./health";
import type { ChatRequest, ChatResponse } from "@/services/ai/providers/interface";

const log = logger.child("router-failover");

export interface FailoverResult {
  response: ChatResponse;
  providerId: string;
  modelId: string;
  attempt: number;
  totalAttempts: number;
  usedFallback: boolean;
}

/** Message when all providers are exhausted — never say "unavailable" */
const ALL_PROVIDERS_EXHAUSTED =
  "⚠️ AI is currently under heavy load. Your request will retry automatically.";

export class FailoverHandler {
  /**
   * Check if a provider is usable before attempting a request.
   * Validates:
   *   1. Provider is configured and enabled
   *   2. API key exists (env var is set and non-empty)
   *   3. Not currently rate-limited (429 cooldown)
   *   4. Health status allows attempts
   */
  private isProviderAvailable(providerId: string): { available: boolean; reason?: string } {
    const setting = aiConfig.getProviderSetting(providerId as ProviderId);
    if (!setting) {
      return { available: false, reason: `No configuration found for provider "${providerId}"` };
    }

    // Check if provider is enabled in configuration
    if (!setting.enabled) {
      return { available: false, reason: `Provider "${providerId}" is disabled in configuration` };
    }

    // Check if API key environment variable is set and non-empty
    const apiKey = process.env[setting.envKey];
    if (!apiKey) {
      return { available: false, reason: `API key missing for provider "${providerId}" (env: ${setting.envKey})` };
    }

    // Check rate-limit cooldown (429 within last 60s)
    if (healthChecker.isRateLimited(providerId)) {
      const remaining = healthChecker.getRateLimitCooldownRemaining(providerId);
      return { available: false, reason: `Provider "${providerId}" is rate-limited (cooldown ${remaining}s remaining)` };
    }

    return { available: true };
  }

  /**
   * Execute a request with automatic failover across providers.
   * Includes pre-flight validation so missing API keys or disabled
   * providers are skipped silently before any attempt.
   *
   * @param feature - The task type for routing
   * @param providerChain - Ordered provider IDs (highest priority first)
   * @param request - The chat request to execute
   * @param options - Execution options
   * @returns The successful response with provider metadata
   * @throws Error if all providers fail
   */
  async executeWithFailover(
    feature: FeatureType,
    providerChain: string[],
    request: ChatRequest,
    options: {
      skipHealthCheck?: boolean;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<FailoverResult> {
    const errors: Array<{ provider: string; error: string }> = [];
    const startTime = Date.now();
    const maxAttempts = providerChain.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const providerId = providerChain[attempt]!;

      // ── Pre-flight: Check provider availability ─────────────────
      // 1. Check API key exists and provider is enabled
      const availability = this.isProviderAvailable(providerId);
      if (!availability.available) {
        log.warn(`[FAILOVER] Skipping ${providerId}: ${availability.reason}`);
        errors.push({
          provider: providerId,
          error: `Pre-flight: ${availability.reason}`,
        });
        continue;
      }

      // 2. Skip unhealthy providers unless forceAttempt is set
      if (!options.skipHealthCheck && !healthChecker.shouldAttempt(providerId)) {
        log.warn(`[FAILOVER] Skipping unhealthy provider ${providerId}`);
        errors.push({ provider: providerId, error: "Provider is unhealthy (skipped by health checker)" });
        continue;
      }

      try {
        const provider = providerRegistry.getProviderById(providerId);
        const modelObj = provider.getDefaultModel();
        const modelId = modelObj?.id || providerId;

        console.log(`[AI_FAILOVER] provider=${providerId} model=${modelId} action=attempt attempt=${attempt + 1}/${maxAttempts} feature=${feature}`);
        log.info(`[FAILOVER] Attempt ${attempt + 1}/${maxAttempts}: ${providerId} (${modelId})`, {
          feature,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        const response = await provider.chat({
          ...request,
          modelId,
          maxTokens: options.maxTokens,
          temperature: options.temperature ?? 0.7,
        });

        // Record success in health checker
        const latencyMs = Date.now() - startTime;
        healthChecker.recordSuccess(providerId, latencyMs);

        console.log(`[AI_FAILOVER] provider=${providerId} action=success attempt=${attempt + 1}/${maxAttempts} fallback=${attempt > 0} latency=${latencyMs}ms feature=${feature}`);
        log.info(`[FAILOVER] ${providerId} succeeded on attempt ${attempt + 1}/${maxAttempts}`, {
          latencyMs,
          usedFallback: attempt > 0,
          feature,
        });

        return {
          response,
          providerId,
          modelId,
          attempt,
          totalAttempts: maxAttempts,
          usedFallback: attempt > 0,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCode = err instanceof AIError ? err.code : "UNKNOWN";
        const isRetryable = err instanceof AIError ? err.retryable : true;
        const nextProvider = attempt < maxAttempts - 1 ? providerChain[attempt + 1] : "none";

        // Record 429 specifically with cooldown
        if (errorCode === "RATE_LIMIT" || errorMsg.includes("429")) {
          healthChecker.recordRateLimit(providerId);
        } else {
          healthChecker.recordFailure(providerId, errorMsg);
        }

        // Structured [AI_FAILOVER] log for every failure
        console.log(`[AI_FAILOVER] provider=${providerId} error=${errorCode} attempt=${attempt + 1}/${maxAttempts} next_provider=${nextProvider} feature=${feature} msg="${errorMsg.slice(0, 100)}"`);

        errors.push({
          provider: providerId,
          error: `[${errorCode}] ${errorMsg}`,
        });

        // If there are more providers, brief delay then continue
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // ── All providers exhausted — build detailed error ──────────
    const totalLatency = Date.now() - startTime;
    console.log(`[AI_FAILOVER] action=all_exhausted chain=[${providerChain.join(",")}] errors=${errors.length} latency=${totalLatency}ms feature=${feature}`);
    log.error("[FAILOVER] All providers exhausted for request", {
      feature,
      providerChain,
      totalAttemptsAttempted: maxAttempts,
      totalProvidersSkipped: maxAttempts - errors.length,
      errors: errors.map((e) => `${e.provider}: ${e.error}`),
      totalLatencyMs: totalLatency,
    });

    // Determine if any providers were actually attempted (not skipped in pre-flight)
    const attemptedProviders = errors.filter(
      (e) => !e.error.startsWith("Pre-flight:") && !e.error.includes("rate-limited") && !e.error.includes("skipped by health checker")
    );

    // Build user-friendly message based on failure patterns
    let friendlyMessage: string;
    if (attemptedProviders.length === 0) {
      // All providers were skipped in pre-flight (no API keys, all disabled, or all rate-limited)
      friendlyMessage =
        "⚠️ AI is currently under heavy load. Your request will retry automatically.";
    } else {
      friendlyMessage = ALL_PROVIDERS_EXHAUSTED;
    }

    throw new AIError(friendlyMessage, "PROVIDER_ERROR", {
      retryable: true,
    });
  }
}

/** Singleton failover handler */
export const failoverHandler = new FailoverHandler();

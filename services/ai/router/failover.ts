/**
 * AI Router - Provider Failover
 * Implements automatic failover: if the selected provider fails,
 * automatically retry the next provider in the priority chain.
 * Never returns "AI temporarily busy" if another provider is available.
 *
 * Failover strategy:
 * - Pre-flight checks: API key exists, provider enabled, health status
 * - Try providers in priority order (highest first)
 * - Skip unhealthy/misconfigured providers
 * - Each provider gets 1 retry on failure before moving to next
 * - After all providers are exhausted, throw AIError with details
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

/** Message when all providers are exhausted */
const ALL_PROVIDERS_EXHAUSTED =
  "⚠️ All AI providers are currently unavailable. Please try again in a few minutes.";

export class FailoverHandler {
  /**
   * Check if a provider is usable before attempting a request.
   * Validates API key presence, enabled flag, and health status.
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

        // Record failure in health checker
        healthChecker.recordFailure(providerId, errorMsg);

        errors.push({
          provider: providerId,
          error: `[${errorCode}] ${errorMsg}`,
        });

        // Detailed provider error log
        log.error(`[FAILOVER] Provider ${providerId} failed`, {
          attempt: attempt + 1,
          maxAttempts,
          errorCode,
          error: errorMsg,
          retryable: isRetryable,
          feature,
          remainingProviders: maxAttempts - attempt - 1,
          timestamp: new Date().toISOString(),
        });

        // If there are more providers, brief delay then continue
        if (attempt < maxAttempts - 1) {
          log.warn(`[FAILOVER] Trying next provider after ${providerId} failure`, {
            nextProvider: providerChain[attempt + 1],
            delayMs: 500,
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // ── All providers exhausted — build detailed error ──────────
    const totalLatency = Date.now() - startTime;
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
      (e) => !e.error.startsWith("Pre-flight:") && !e.error.includes("skipped by health checker")
    );

    // Build user-friendly message based on failure patterns
    let friendlyMessage: string;
    if (attemptedProviders.length === 0) {
      // All providers were skipped in pre-flight (no API keys, all disabled)
      friendlyMessage =
        "⚠️ No AI providers are configured. Please set up at least one API key (Gemini, Cerebras, Mistral, or OpenRouter) in your environment variables.";
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

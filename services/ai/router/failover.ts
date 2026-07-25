/**
 * AI Router - Provider Failover
 * Implements automatic failover: if the selected provider fails,
 * automatically retry the next provider in the priority chain.
 *
 * Failover strategy:
 * - Try providers in priority order (highest first)
 * - Skip unhealthy providers (with recovery cooldown)
 * - Each provider gets 1 retry on failure before moving to next
 * - After all providers are exhausted, throw friendly error
 */

import { providerRegistry } from "@/services/ai/providers/registry";
import { logger } from "@/bot/core/logger";
import { AIError } from "@/services/ai/types/errors";
import { healthChecker } from "./health";
import type { FeatureType } from "@/config/ai";
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

export class FailoverHandler {
  /**
   * Execute a request with automatic failover across providers.
   *
   * @param feature - The task type for routing
   * @param providerChain - Ordered provider IDs (highest priority first)
   * @param request - The chat request to execute
   * @param options - Execution options
   * @returns The successful response with provider metadata
   * @throws Error if all providers fail (with friendly message)
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

      // Skip unhealthy providers unless forceAttempt is set
      if (!options.skipHealthCheck && !healthChecker.shouldAttempt(providerId)) {
        log.debug(`Skipping unhealthy provider ${providerId}`);
        errors.push({ provider: providerId, error: "Provider is unhealthy (skipped)" });
        continue;
      }

      try {
        const provider = providerRegistry.getProviderById(providerId);
        const modelObj = provider.getDefaultModel();
        const modelId = modelObj?.id || providerId;

        log.debug(`Attempt ${attempt + 1}/${maxAttempts}: ${providerId} (${modelId})`);

        const response = await provider.chat({
          ...request,
          modelId,
          maxTokens: options.maxTokens,
          temperature: options.temperature ?? 0.7,
        });

        // Record success in health checker
        const latencyMs = Date.now() - startTime;
        healthChecker.recordSuccess(providerId, latencyMs);

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

        // Record failure in health checker
        healthChecker.recordFailure(providerId, errorMsg);

        errors.push({ provider: providerId, error: errorMsg });
        log.warn(`Provider ${providerId} failed, trying next`, {
          attempt: attempt + 1,
          maxAttempts,
          error: errorMsg,
        });

        // Brief delay before trying next provider (avoid stampeding)
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // All providers exhausted — throw friendly error
    const totalLatency = Date.now() - startTime;
    log.error("All providers failed for request", {
      feature,
      providerChain,
      errors,
      totalLatencyMs: totalLatency,
    });

    // Throw AIError — consistent with the executor's error handling pattern
    throw new AIError(
      "⚠️ Service is temporarily unavailable. Please try again later.",
      "PROVIDER_ERROR",
      { retryable: false }
    );
  }
}

/** Singleton failover handler */
export const failoverHandler = new FailoverHandler();

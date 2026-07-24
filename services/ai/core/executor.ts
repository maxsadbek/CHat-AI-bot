/**
 * Enterprise AI Core Executor Pipeline
 * Central orchestrator combining Provider DI, Retry Backoff, Fallback Token Degradation,
 * Cost Optimization, Error Normalization, and Telemetry Logging.
 */

import { aiConfig, FeatureType } from "@/config/ai";
import { providerRegistry, ProviderRegistry } from "../providers/registry";
import { RetryStrategy } from "../strategies/retry";
import { CostOptimizationStrategy } from "../strategies/cost";
import { FallbackStrategy } from "../strategies/fallback";
import { normalizeAIError } from "../utils/errors";
import { AITelemetry } from "../utils/logger";
import { AIError } from "../types/errors";
import type { ChatRequest, ChatResponse } from "../providers/interface";

export interface AIExecutionOptions {
  feature: FeatureType;
  userPlan?: string;
  modelId?: string;
  request: ChatRequest;
  customRegistry?: ProviderRegistry;
}

export class AIExecutor {
  constructor(private registry: ProviderRegistry = providerRegistry) {}

  /**
   * Execute chat request with enterprise resilience pipeline.
   */
  async execute(options: AIExecutionOptions): Promise<ChatResponse> {
    const startTime = Date.now();
    const { feature, userPlan, modelId, request } = options;
    const activeRegistry = options.customRegistry || this.registry;

    // Resolve Provider
    const provider = activeRegistry.getProvider(modelId);
    const modelObj = provider.getModel(modelId || "") || provider.getDefaultModel();
    const resolvedModelId = modelObj.id;

    // Determine initial max tokens via Cost Optimization strategy
    const userPrompt = request.messages.map((m) => m.content).join("\n");
    const initialMaxTokens =
      request.maxTokens ||
      CostOptimizationStrategy.resolveMaxTokens(
        feature,
        userPlan,
        userPrompt,
        modelObj.capabilities.maxContextTokens
      );

    const temperature = request.temperature ?? aiConfig.getTemperature(feature);

    const maxRetries = aiConfig.getRetryPolicy().maxRetries;
    let lastError: AIError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await RetryStrategy.wait(attempt - 1);
      }

      // Compute step-degraded tokens for current attempt
      const currentMaxTokens = FallbackStrategy.getDegradedMaxTokens(
        initialMaxTokens,
        attempt
      );

      try {
        const response = await provider.chat({
          ...request,
          modelId: resolvedModelId,
          maxTokens: currentMaxTokens,
          temperature,
        });

        const latencyMs = Date.now() - startTime;
        const promptTokens = response.usage?.promptTokens || CostOptimizationStrategy.estimateTokenCount(userPrompt);
        const completionTokens = response.usage?.completionTokens || CostOptimizationStrategy.estimateTokenCount(response.content);
        const totalTokens = response.usage?.totalTokens || promptTokens + completionTokens;

        const costUsd = aiConfig.calculateCost(resolvedModelId, promptTokens, completionTokens);

        // Structured Telemetry Log
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

        return {
          ...response,
          costUsd,
        };
      } catch (rawError) {
        const error = normalizeAIError(rawError, provider.providerName);
        lastError = error;

        // Log attempt warning
        AITelemetry.logRequest({
          provider: provider.providerName,
          model: resolvedModelId,
          feature,
          plan: userPlan || "FREE",
          promptTokens: CostOptimizationStrategy.estimateTokenCount(userPrompt),
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime,
          retries: attempt,
          estimatedCostUsd: 0,
          status: "failed",
          error: error.message,
        });

        if (!FallbackStrategy.isFallbackTrigger(error)) {
          // Non-retryable error (e.g. 400 validation error)
          throw error;
        }
      }
    }

    throw lastError || new AIError("AI Execution failed after all fallback attempts");
  }
}

export const aiExecutor = new AIExecutor();

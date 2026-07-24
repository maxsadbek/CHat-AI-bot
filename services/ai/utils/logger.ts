/**
 * Structured Enterprise AI Telemetry Logger
 */

import { logger } from "@/bot/core/logger";

const log = logger.child("ai-telemetry");

export interface AITelemetryPayload {
  provider: string;
  model: string;
  feature: string;
  plan: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  retries: number;
  estimatedCostUsd: number;
  status: "success" | "fallback_success" | "failed";
  error?: string;
}

export class AITelemetry {
  static logRequest(payload: AITelemetryPayload): void {
    const formattedLog = {
      timestamp: new Date().toISOString(),
      provider: payload.provider,
      model: payload.model,
      feature: payload.feature,
      plan: payload.plan,
      tokens: {
        prompt: payload.promptTokens,
        completion: payload.completionTokens,
        total: payload.totalTokens,
      },
      latencyMs: payload.latencyMs,
      retries: payload.retries,
      costUsd: payload.estimatedCostUsd,
      status: payload.status,
      error: payload.error || null,
    };

    if (payload.status === "failed") {
      log.error(`[AI-TELEMETRY] ${payload.provider}:${payload.model} failed after ${payload.retries} retries (${payload.latencyMs}ms)`, formattedLog);
    } else if (payload.status === "fallback_success") {
      log.warn(`[AI-TELEMETRY] ${payload.provider}:${payload.model} succeeded with fallback after ${payload.retries} retries (${payload.latencyMs}ms, $${payload.estimatedCostUsd})`, formattedLog);
    } else {
      log.info(`[AI-TELEMETRY] ${payload.provider}:${payload.model} completed in ${payload.latencyMs}ms (${payload.totalTokens} tokens, $${payload.estimatedCostUsd})`, formattedLog);
    }
  }
}

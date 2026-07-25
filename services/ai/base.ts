/**
 * Enterprise Base AI Service Abstraction
 * Re-exports base types and interfaces for legacy backward compatibility.
 *
 * Prompt Optimization added:
 * - Trims unnecessary whitespace from system prompts before sending to the model.
 * - Keeps all instructions but removes verbose formatting, reducing token usage.
 */

import { aiExecutor, AIExecutor } from "./core/executor";
import type { ChatRequest, ChatResponse } from "./providers/interface";
import type { FeatureType, PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-base");

export interface AIProviderConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AICompletionParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export abstract class BaseAIService {
  constructor(
    protected readonly feature: FeatureType,
    protected readonly executor: AIExecutor = aiExecutor
  ) {}

  /**
   * Optimize a prompt by trimming whitespace and removing excessive blank lines.
   * This reduces token usage without changing meaning.
   */
  protected optimizePrompt(prompt: string): string {
    return prompt
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n") // Collapse 3+ consecutive newlines to 2
      .trim();
  }

  protected async executeAI(
    messages: ChatRequest["messages"],
    systemPrompt?: string,
    modelId?: string,
    userPlan?: string | PlanType,
    temperature?: number
  ): Promise<ChatResponse> {
    // Optimize system prompt: trim whitespace to reduce token usage
    const optimizedSystemPrompt = systemPrompt ? this.optimizePrompt(systemPrompt) : undefined;

    log.info("[AI_PROVIDER] Executing AI request", {
      feature: this.feature,
      modelId: modelId ?? "default",
      userPlan: typeof userPlan === "string" ? userPlan : "none",
      messagesCount: messages.length,
    });

    try {
      const result = await this.executor.execute({
        feature: this.feature,
        userPlan: typeof userPlan === "string" ? userPlan : undefined,
        modelId,
        request: {
          messages,
          systemPrompt: optimizedSystemPrompt,
          temperature,
        },
      });

      log.info("[AI_PROVIDER] Response received", {
        feature: this.feature,
        contentLength: result.content.length,
        usage: result.usage,
      });

      return result;
    } catch (error) {
      // Extract details from AIError if available
      let errorCode = "UNKNOWN";
      let errorStatus: number | undefined;
      let errorProvider: string | undefined;
      let isRetryable = false;

      if (error instanceof Error && "code" in error) {
        const aiErr = error as any;
        errorCode = aiErr.code ?? "UNKNOWN";
        errorStatus = aiErr.statusCode;
        errorProvider = aiErr.provider;
        isRetryable = aiErr.retryable ?? false;
      }

      log.error("[AI_PROVIDER] Execution failed", {
        feature: this.feature,
        modelId: modelId ?? "default",
        userPlan: typeof userPlan === "string" ? userPlan : "none",
        errorCode,
        statusCode: errorStatus,
        provider: errorProvider,
        retryable: isRetryable,
        error: String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}

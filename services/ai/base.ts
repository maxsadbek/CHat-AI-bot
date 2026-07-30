/**
 * Enterprise Base AI Service Abstraction
 * Re-exports base types and interfaces for legacy backward compatibility.
 *
 * Prompt Optimization added:
 * - Trims unnecessary whitespace from system prompts before sending to the model.
 * - Keeps all instructions but removes verbose formatting, reducing token usage.
 *
 * Language Pipeline (v2):
 * - User ALWAYS speaks Uzbek.
 * - Internally everything can be English.
 * - AI responses MUST always be in Russian.
 * - Never answer in Uzbek, English, or any other language. Only Russian.
 *
 * The Russian-only instruction is appended to EVERY system prompt automatically
 * in executeAI(), covering ALL features: chat, business, coding, social,
 * video, image, translate. This is a single enforcement point.
 */

import { aiExecutor, AIExecutor } from "./core/executor";
import type { ChatRequest, ChatResponse } from "./providers/interface";
import type { FeatureType, PlanType } from "@/config/ai";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-base");

/**
 * Russian-only output instruction appended to EVERY system prompt.
 * This enforces the language pipeline:
 *   User Uzbek → AI (internal English) → Russian output
 */
export const RUSSIAN_ONLY_INSTRUCTION =
  "\n\nВАЖНО: Ты MUST always respond in Russian language ONLY. " +
  "Never respond in Uzbek, English, or any other language. " +
  "Even if the user writes to you in Uzbek, YOU MUST ALWAYS answer in Russian. " +
  "This is a hard requirement. Only Russian.";

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
    temperature?: number,
    maxTokens?: number
  ): Promise<ChatResponse> {
    // Append Russian-only instruction to every system prompt for ALL features
    // This enforces: user speaks Uzbek → AI understands → responds in Russian ONLY
    const promptWithRussian =
      systemPrompt != null
        ? systemPrompt + RUSSIAN_ONLY_INSTRUCTION
        : RUSSIAN_ONLY_INSTRUCTION;

    // Optimize system prompt: trim whitespace to reduce token usage
    const optimizedSystemPrompt = this.optimizePrompt(promptWithRussian);

    log.info("[AI_PROVIDER] Executing AI request", {
      feature: this.feature,
      modelId: modelId ?? "default",
      userPlan: typeof userPlan === "string" ? userPlan : "none",
      messagesCount: messages.length,
      maxTokens: maxTokens ?? "auto",
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
          maxTokens,
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

/**
 * AI Provider Abstraction
 * Base class for all AI providers (OpenAI, Anthropic, Google, etc.)
 * New providers can be added by extending this base class.
 */

import { openai } from "@/lib/openai";
import { env } from "@/config";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-base");

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

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

/**
 * Abstract AI provider interface
 */
export interface AIProvider {
  readonly name: string;
  complete(params: AICompletionParams): Promise<AICompletionResult>;
  streamComplete?(params: AICompletionParams): AsyncGenerator<string>;
}

/**
 * OpenAI-compatible AI provider implementation
 * Works with any OpenAI-compatible API (OpenAI, Azure, local LLMs, etc.)
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "OpenAI";
  private defaultConfig: AIProviderConfig;

  constructor(config?: Partial<AIProviderConfig>) {
    this.defaultConfig = {
      model: env.OPENAI_MODEL,
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      ...(config ?? {}),
    };
  }

  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    const { systemPrompt, userPrompt, temperature, maxTokens } = params;

    log.debug("AI completion requested", {
      model: this.defaultConfig.model,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    const completion = await openai.chat.completions.create({
      model: this.defaultConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens ?? this.defaultConfig.maxTokens,
      temperature: temperature ?? this.defaultConfig.temperature,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No response from AI provider");
    }

    return {
      content: choice.message.content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    };
  }
}

/**
 * AI Service Factory
 * Creates AI provider instances based on configuration.
 * Future: Add provider selection logic here (e.g., for different models)
 */
export function createAIProvider(config?: Partial<AIProviderConfig>): AIProvider {
  return new OpenAIProvider(config);
}

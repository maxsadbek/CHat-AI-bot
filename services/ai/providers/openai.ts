/**
 * OpenAI Provider
 * Implements AIProvider using the OpenAI SDK.
 * Supports GPT-4, GPT-4 Turbo, GPT-4o, and o1 models.
 */

import OpenAI from "openai";
import { env } from "@/config";
import { logger } from "@/bot/core/logger";
import { OPENAI_MODELS } from "./models";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-openai");

export class OpenAIProviderImpl implements AIProvider {
  readonly providerName = "OpenAI";
  readonly models: ProviderModel[] = OPENAI_MODELS;

  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
      maxRetries: 3,
      timeout: 60000,
    });
  }

  getModel(modelId: string): ProviderModel | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  getDefaultModel(): ProviderModel {
    return this.models.find((m) => m.default) ?? this.models[0]!;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const resolvedModel =
      (request.modelId ? this.getModel(request.modelId) : undefined) ??
      this.getDefaultModel();

    log.debug("OpenAI chat request", {
      model: resolvedModel.id,
      messages: request.messages.length,
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    // Add message history
    for (const msg of request.messages) {
      if (msg.role === "system") continue; // Skip system messages already handled
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const completion = await this.client.chat.completions.create({
      model: resolvedModel.id,
      messages,
      max_tokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No response from OpenAI");
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
      model: resolvedModel.id,
      provider: "openai",
    };
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<string> {
    const resolvedModel =
      (request.modelId ? this.getModel(request.modelId) : undefined) ??
      this.getDefaultModel();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      if (msg.role === "system") continue;
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const stream = await this.client.chat.completions.create({
      model: resolvedModel.id,
      messages,
      max_tokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

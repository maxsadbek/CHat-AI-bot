/**
 * Groq AI Provider Implementation
 * Uses OpenAI-compatible API protocol.
 */

import OpenAI from "openai";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { GROQ_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-groq");

export class GroqProviderImpl implements AIProvider {
  readonly providerName = "Groq";
  readonly models: ProviderModel[] = GROQ_MODELS;
  private client: OpenAI;

  constructor() {
    const setting = aiConfig.getProviderSetting("groq");
    const apiKey = process.env.GROQ_API_KEY || "groq-dummy-key";

    this.client = new OpenAI({
      apiKey,
      baseURL: setting?.baseUrl || "https://api.groq.com/openai/v1",
      maxRetries: 0, // Retries handled by central execution pipeline
      timeout: setting?.timeoutMs || 30000,
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

    try {
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

      // Map internal ID to Groq model ID if needed
      const actualModelId = resolvedModel.id.replace(/^groq-/, "");

      const completion = await this.client.chat.completions.create({
        model: actualModelId,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Empty response returned from Groq API");
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
        provider: "groq",
        finishReason: choice.finish_reason ?? undefined,
      };
    } catch (err) {
      log.error("Groq provider error", { error: String(err) });
      throw normalizeAIError(err, this.providerName);
    }
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

    const actualModelId = resolvedModel.id.replace(/^groq-/, "");

    const stream = await this.client.chat.completions.create({
      model: actualModelId,
      messages,
      max_tokens: request.maxTokens,
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

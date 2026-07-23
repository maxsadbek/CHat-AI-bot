/**
 * DeepSeek Provider
 * Implements AIProvider using the OpenAI SDK with DeepSeek's API endpoint.
 * DeepSeek uses an OpenAI-compatible API, so we reuse the OpenAI SDK.
 *
 * API: https://api.deepseek.com/v1
 * Model: deepseek-chat (V2/V3)
 */

import OpenAI from "openai";
import { env } from "@/config";
import { logger } from "@/bot/core/logger";
import { DEEPSEEK_MODELS } from "./models";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-deepseek");

export class DeepSeekProviderImpl implements AIProvider {
  readonly providerName = "DeepSeek";
  readonly models: ProviderModel[] = DEEPSEEK_MODELS;

  private client: OpenAI;

  constructor() {
    if (!env.DEEPSEEK_API_KEY) {
      log.warn("DEEPSEEK_API_KEY not configured — DeepSeek provider will fail");
    }
    this.client = new OpenAI({
      apiKey: env.DEEPSEEK_API_KEY ?? "",
      baseURL: env.DEEPSEEK_BASE_URL,
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

    log.debug("DeepSeek chat request", {
      model: resolvedModel.id,
      messages: request.messages.length,
    });

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

    const completion = await this.client.chat.completions.create({
      model: resolvedModel.id,
      messages,
      max_tokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("No response from DeepSeek");
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
      provider: "deepseek",
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

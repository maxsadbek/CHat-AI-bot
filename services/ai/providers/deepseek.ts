/**
 * DeepSeek Provider Implementation
 */

import OpenAI from "openai";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { DEEPSEEK_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-deepseek");

export class DeepSeekProviderImpl implements AIProvider {
  readonly providerName = "DeepSeek";
  readonly models: ProviderModel[] = DEEPSEEK_MODELS;
  private client: OpenAI;

  constructor() {
    const setting = aiConfig.getProviderSetting("deepseek");
    const apiKey = process.env.DEEPSEEK_API_KEY || "deepseek-dummy-key";

    this.client = new OpenAI({
      apiKey,
      baseURL: setting?.baseUrl || "https://api.deepseek.com/v1",
      maxRetries: 0,
      timeout: setting?.timeoutMs || 60000,
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

      const completion = await this.client.chat.completions.create({
        model: resolvedModel.id,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Empty response returned from DeepSeek API");
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
        finishReason: choice.finish_reason ?? undefined,
      };
    } catch (err) {
      log.error("DeepSeek provider error", { error: String(err) });
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

    const stream = await this.client.chat.completions.create({
      model: resolvedModel.id,
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

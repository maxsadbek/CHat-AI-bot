/**
 * OpenRouter AI Provider Implementation
 * Compatible with OpenAI API protocol.
 */

import OpenAI from "openai";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { OPENROUTER_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-openrouter");

export class OpenRouterProviderImpl implements AIProvider {
  readonly providerName = "OpenRouter";
  readonly models: ProviderModel[] = OPENROUTER_MODELS;
  private client: OpenAI;

  constructor() {
    const setting = aiConfig.getProviderSetting("openrouter");
    const apiKey = process.env.OPENROUTER_API_KEY || "openrouter-dummy-key";

    this.client = new OpenAI({
      apiKey,
      baseURL: setting?.baseUrl || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "AI Creator Studio",
      },
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

      const openrouterModel =
        resolvedModel.id === "openrouter-auto"
          ? "openrouter/auto"
          : resolvedModel.id.replace(/^openrouter-/, "");

      const completion = await this.client.chat.completions.create({
        model: openrouterModel,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Empty response returned from OpenRouter API");
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
        provider: "openrouter",
      };
    } catch (err) {
      log.error("OpenRouter provider error", { error: String(err) });
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

    const openrouterModel =
      resolvedModel.id === "openrouter-auto"
        ? "openrouter/auto"
        : resolvedModel.id.replace(/^openrouter-/, "");

    const stream = await this.client.chat.completions.create({
      model: openrouterModel,
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

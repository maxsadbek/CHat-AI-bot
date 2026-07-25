/**
 * Cerebras AI Provider Implementation
 * Uses OpenAI-compatible API protocol.
 */

import OpenAI from "openai";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { CEREBRAS_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-cerebras");

export class CerebrasProviderImpl implements AIProvider {
  readonly providerName = "Cerebras";
  readonly models: ProviderModel[] = CEREBRAS_MODELS;

  /** Lazily initialized client – created on first use to allow env vars to load */
  private _client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this._client) {
      const setting = aiConfig.getProviderSetting("cerebras");
      const apiKey = process.env.CEREBRAS_API_KEY || "";

      if (!apiKey) {
        log.warn("CEREBRAS_API_KEY not configured — Cerebras provider will fail on execution");
      }

      this._client = new OpenAI({
        apiKey,
        baseURL: setting?.baseUrl || "https://api.cerebras.ai/v1",
        maxRetries: 0,
        timeout: setting?.timeoutMs || 60000,
      });
    }
    return this._client;
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

      const completion = await this.getClient().chat.completions.create({
        model: resolvedModel.id,
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Empty response returned from Cerebras API");
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
        provider: "cerebras",
      };
    } catch (err) {
      log.error("Cerebras provider error", { error: String(err) });
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

    const stream = await this.getClient().chat.completions.create({
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

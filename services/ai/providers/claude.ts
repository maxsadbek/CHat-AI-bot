/**
 * Anthropic Claude Provider Implementation
 */

import Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { CLAUDE_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-claude");

export class ClaudeProviderImpl implements AIProvider {
  readonly providerName = "Anthropic Claude";
  readonly models: ProviderModel[] = CLAUDE_MODELS;
  private client: Anthropic;

  constructor() {
    const setting = aiConfig.getProviderSetting("anthropic");
    const apiKey = process.env.ANTHROPIC_API_KEY || "";

    if (!apiKey) {
      log.warn("ANTHROPIC_API_KEY not configured — Claude provider will fail on execution");
    }

    this.client = new Anthropic({
      apiKey,
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
      const systemMessages: string[] = [];
      const anthropicMessages: Anthropic.MessageParam[] = [];

      if (request.systemPrompt) {
        systemMessages.push(request.systemPrompt);
      }

      for (const msg of request.messages) {
        if (msg.role === "system") {
          systemMessages.push(msg.content);
          continue;
        }
        anthropicMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }

      if (anthropicMessages.length === 0) {
        anthropicMessages.push({ role: "user", content: "Hello." });
      }

      const completion = await this.client.messages.create({
        model: resolvedModel.id,
        max_tokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
        temperature: request.temperature ?? 0.7,
        system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
        messages: anthropicMessages,
      });

      const textContent = completion.content
        .filter((block) => block.type === "text")
        .map((block) => (block as Anthropic.TextBlock).text)
        .join("\n");

      if (!textContent) {
        throw new Error("No text content returned from Claude API");
      }

      return {
        content: textContent,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.input_tokens,
              completionTokens: completion.usage.output_tokens,
              totalTokens: completion.usage.input_tokens + completion.usage.output_tokens,
            }
          : undefined,
        model: resolvedModel.id,
        provider: "claude",
        finishReason: completion.stop_reason ?? undefined,
      };
    } catch (err) {
      log.error("Claude provider error", { error: String(err) });
      throw normalizeAIError(err, this.providerName);
    }
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<string> {
    const resolvedModel =
      (request.modelId ? this.getModel(request.modelId) : undefined) ??
      this.getDefaultModel();

    const systemMessages: string[] = [];
    const anthropicMessages: Anthropic.MessageParam[] = [];

    if (request.systemPrompt) {
      systemMessages.push(request.systemPrompt);
    }

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemMessages.push(msg.content);
        continue;
      }
      anthropicMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: "user", content: "Hello." });
    }

    const stream = await this.client.messages.stream({
      model: resolvedModel.id,
      max_tokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
      system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}

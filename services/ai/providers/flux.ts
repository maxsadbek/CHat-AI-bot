/**
 * Flux AI Provider Implementation
 * Uses OpenAI-compatible API protocol for text generation.
 * Supports image prompt generation and general text tasks.
 */

import OpenAI from "openai";
import { aiConfig } from "@/config/ai";
import { logger } from "@/bot/core/logger";
import { FLUX_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-flux");

export class FluxProviderImpl implements AIProvider {
  readonly providerName = "Flux AI";
  readonly models: ProviderModel[] = FLUX_MODELS;

  /** Lazily initialized client – created on first use to allow env vars to load */
  private _client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this._client) {
      const apiKey = process.env.FLUX_API_KEY || "";

      if (!apiKey) {
        log.warn("FLUX_API_KEY not configured — Flux provider will fail on execution");
      }

      this._client = new OpenAI({
        apiKey,
        baseURL: process.env.FLUX_BASE_URL || "https://api.bfl.ml/v1",
        maxRetries: 0,
        timeout: 60000,
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
        throw new Error("Empty response returned from Flux API");
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
        provider: "flux",
        finishReason: choice.finish_reason ?? undefined,
      };
    } catch (err) {
      log.error("Flux provider error", { error: String(err) });
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

  async generateImage(prompt: string, modelId?: string): Promise<string> {
    const resolvedModel =
      (modelId ? this.getModel(modelId) : undefined) ?? this.getDefaultModel();
    const apiKey = process.env.FLUX_API_KEY;
    if (!apiKey) {
      throw new Error("FLUX_API_KEY is not configured");
    }

    const baseUrl = process.env.FLUX_BASE_URL || "https://api.bfl.ml/v1";
    // We assume the modelId matches the endpoint path, e.g. "flux-pro-1.1" or "flux-dev"
    // However, if the modelId doesn't match BFL's endpoint, we could default to flux-pro-1.1
    // The current ai.ts has FLUX.1-schnell, let's normalize or use it directly.
    const endpointModel = resolvedModel.id.toLowerCase().replace(/\./g, "-");

    // 1. Submit Request
    const submitUrl = `${baseUrl}/${endpointModel}`;
    const submitRes = await fetch(submitUrl, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "x-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width: 1024,
        height: 768,
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      log.error("BFL submit error", { status: submitRes.status, body: errText });
      throw new Error(`Flux API error: ${submitRes.statusText}`);
    }

    const submitData = await submitRes.json();
    const requestId = submitData.id;
    if (!requestId) {
      throw new Error("Flux API did not return an ID");
    }

    // 2. Poll for Result
    const pollUrl = `${baseUrl}/get_result?id=${requestId}`;
    const maxAttempts = 30; // Max 60 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((res) => setTimeout(res, 2000)); // wait 2 seconds

      const pollRes = await fetch(pollUrl, {
        headers: {
          "accept": "application/json",
          "x-key": apiKey,
        },
      });

      if (!pollRes.ok) {
        throw new Error(`Flux polling failed: ${pollRes.statusText}`);
      }

      const pollData = await pollRes.json();
      if (pollData.status === "Ready") {
        const imageUrl = pollData.result?.sample;
        if (!imageUrl) {
          throw new Error("Flux API returned Ready but no sample image URL");
        }
        return imageUrl;
      } else if (pollData.status === "Failed" || pollData.status === "Error") {
        throw new Error(`Flux image generation failed: ${pollData.error || "Unknown error"}`);
      }
      // Otherwise, status is likely "Pending"
    }

    throw new Error("Flux image generation timed out");
  }
}

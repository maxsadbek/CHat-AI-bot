/**
 * Google Gemini Provider Implementation
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/bot/core/logger";
import { GEMINI_MODELS } from "./models";
import { normalizeAIError } from "../utils/errors";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-gemini");

export class GeminiProviderImpl implements AIProvider {
  readonly providerName = "Google Gemini";
  readonly models: ProviderModel[] = GEMINI_MODELS;
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      log.warn("GEMINI_API_KEY not configured — Gemini provider will fail on execution");
    }
    this.client = new GoogleGenerativeAI(apiKey);
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
      const model = this.client.getGenerativeModel({
        model: resolvedModel.id,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
          temperature: request.temperature ?? 0.7,
        },
      });

      const contents: Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }> = [];

      let systemInstruction: string | undefined = request.systemPrompt;

      for (const msg of request.messages) {
        if (msg.role === "system") {
          systemInstruction = systemInstruction
            ? `${systemInstruction}\n${msg.content}`
            : msg.content;
          continue;
        }

        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }

      const genRequest: Record<string, unknown> = { contents };
      if (systemInstruction) {
        genRequest.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const result = await model.generateContent(genRequest as any);
      const text = result.response.text();

      if (!text) {
        throw new Error("No response text returned from Gemini API");
      }

      const usageMetadata = result.response.usageMetadata;

      return {
        content: text,
        usage: usageMetadata
          ? {
              promptTokens: usageMetadata.promptTokenCount ?? 0,
              completionTokens: usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
        model: resolvedModel.id,
        provider: "gemini",
      };
    } catch (err) {
      log.error("Gemini provider error", { error: String(err) });
      throw normalizeAIError(err, this.providerName);
    }
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<string> {
    const resolvedModel =
      (request.modelId ? this.getModel(request.modelId) : undefined) ??
      this.getDefaultModel();

    const model = this.client.getGenerativeModel({
      model: resolvedModel.id,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
        temperature: request.temperature ?? 0.7,
      },
    });

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    let systemInstruction: string | undefined = request.systemPrompt;

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n${msg.content}`
          : msg.content;
        continue;
      }
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const genReq: Record<string, unknown> = { contents };
    if (systemInstruction) {
      genReq.systemInstruction = {
        role: "user",
        parts: [{ text: systemInstruction }],
      };
    }

    const result = await model.generateContentStream(genReq as any);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}

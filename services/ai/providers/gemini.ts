/**
 * Google Gemini Provider
 * Implements AIProvider using the Google Generative AI SDK.
 * Supports Gemini 2.0 Flash, 2.0 Pro, 1.5 Flash, and 1.5 Pro.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/config";
import { logger } from "@/bot/core/logger";
import { GEMINI_MODELS } from "./models";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "./interface";

const log = logger.child("provider-gemini");

export class GeminiProviderImpl implements AIProvider {
  readonly providerName = "Google Gemini";
  readonly models: ProviderModel[] = GEMINI_MODELS;

  private client: GoogleGenerativeAI;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      log.warn("GEMINI_API_KEY not configured — Gemini provider will fail");
    }
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY ?? "");
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

    log.debug("Gemini chat request", {
      model: resolvedModel.id,
      messages: request.messages.length,
    });

    const model = this.client.getGenerativeModel({
      model: resolvedModel.id,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
        temperature: request.temperature ?? 0.7,
      },
    });

    // Build content parts
    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    // Add system instruction as a user message if provided
    let systemInstruction: string | undefined = request.systemPrompt;

    // Convert messages to Gemini format
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
        role: "user",
        parts: [{ text: systemInstruction }],
      };
    }
    const result = await model.generateContent(genRequest as any);

    const geminiResponse = result.response;
    const text = geminiResponse.text();

    if (!text) {
      throw new Error("No response from Gemini");
    }

    const usageMetadata = geminiResponse.usageMetadata;

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
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<string> {
    const resolvedModel =
      (req.modelId ? this.getModel(req.modelId) : undefined) ??
      this.getDefaultModel();

    const model = this.client.getGenerativeModel({
      model: resolvedModel.id,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? resolvedModel.capabilities.maxOutputTokens,
        temperature: req.temperature ?? 0.7,
      },
    });

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    let systemInstruction: string | undefined = req.systemPrompt;

    for (const msg of req.messages) {
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

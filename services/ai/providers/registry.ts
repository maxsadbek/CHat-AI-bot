/**
 * Dependency Injection Provider Registry
 * Resolves models to provider instances dynamically with fallbacks.
 */

import { logger } from "@/bot/core/logger";
import { OpenAIProviderImpl } from "./openai";
import { GeminiProviderImpl } from "./gemini";
import { ClaudeProviderImpl } from "./claude";
import { DeepSeekProviderImpl } from "./deepseek";
import { GroqProviderImpl } from "./groq";
import { OpenRouterProviderImpl } from "./openrouter";
import { OllamaProviderImpl } from "./ollama";
import { CerebrasProviderImpl } from "./cerebras";
import { MistralProviderImpl } from "./mistral";
import { StabilityProviderImpl } from "./stability";
import { FluxProviderImpl } from "./flux";
import { ALL_MODELS, findModel, getSelectableModels } from "./models";
import type { AIProvider, ProviderModel } from "./interface";

const log = logger.child("provider-registry");

export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    // Registered factories using lazy instantiation
  }

  getProvider(modelId?: string): AIProvider {
    if (!modelId) {
      return this.getProviderById("openai");
    }

    const model = findModel(modelId);
    if (!model) {
      log.warn(`Unknown model "${modelId}", falling back to default OpenAI provider`);
      return this.getProviderById("openai");
    }

    return this.getProviderById(model.provider);
  }

  getProviderById(providerId: string): AIProvider {
    const key = providerId.toLowerCase();

    if (!this.providers.has(key)) {
      switch (key) {
        case "openai":
          this.providers.set(key, new OpenAIProviderImpl());
          break;
        case "gemini":
          this.providers.set(key, new GeminiProviderImpl());
          break;
        case "claude":
        case "anthropic":
          this.providers.set(key, new ClaudeProviderImpl());
          break;
        case "deepseek":
          this.providers.set(key, new DeepSeekProviderImpl());
          break;
        case "groq":
          this.providers.set(key, new GroqProviderImpl());
          break;
        case "openrouter":
          this.providers.set(key, new OpenRouterProviderImpl());
          break;
        case "ollama":
          this.providers.set(key, new OllamaProviderImpl());
          break;
        case "cerebras":
          this.providers.set(key, new CerebrasProviderImpl());
          break;
        case "mistral":
          this.providers.set(key, new MistralProviderImpl());
          break;
        case "stability":
          this.providers.set(key, new StabilityProviderImpl());
          break;
        case "flux":
          this.providers.set(key, new FluxProviderImpl());
          break;
        default:
          log.warn(`Unrecognized provider "${providerId}", defaulting to OpenAI`);
          this.providers.set(key, new OpenAIProviderImpl());
          break;
      }
    }

    return this.providers.get(key)!;
  }

  registerProvider(id: string, provider: AIProvider): void {
    this.providers.set(id.toLowerCase(), provider);
  }

  isValidModel(modelId: string): boolean {
    return !!findModel(modelId);
  }

  getModel(modelId: string): ProviderModel | undefined {
    return findModel(modelId);
  }

  getAllModels(): ProviderModel[] {
    return [...ALL_MODELS];
  }

  getSelectableModels() {
    return getSelectableModels();
  }

  getDefaultModel(): ProviderModel {
    // Default model follows provider chain: Gemini → Cerebras → Mistral → OpenRouter
    // Use Gemini (first in provider chain) as default.
    // Never default to OpenAI unless explicitly configured.
    const defaultModelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = ALL_MODELS.find((m) => m.id === defaultModelId);
    if (model) return model;
    // Fallback: find the first model from the default provider chain
    const geminiModel = ALL_MODELS.find((m) => m.provider === "gemini");
    if (geminiModel) return geminiModel;
    // Last resort
    return ALL_MODELS[0]!;
  }

  getModelName(modelId: string): string {
    return findModel(modelId)?.name ?? modelId;
  }
}

export const providerRegistry = new ProviderRegistry();

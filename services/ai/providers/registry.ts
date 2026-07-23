/**
 * AI Provider Registry & Factory
 * Central registry that resolves model IDs to providers.
 * The rest of the application ONLY uses this — never direct SDK calls.
 *
 * Usage:
 *   import { providerRegistry } from "@/services/ai/providers/registry";
 *   const provider = providerRegistry.getProvider("gpt-4o");
 *   const response = await provider.chat({ ... });
 */

import { logger } from "@/bot/core/logger";
import { OpenAIProviderImpl } from "./openai";
import { GeminiProviderImpl } from "./gemini";
import { ClaudeProviderImpl } from "./claude";
import { DeepSeekProviderImpl } from "./deepseek";
import { ALL_MODELS, findModel, getSelectableModels } from "./models";
import type { AIProvider, ProviderModel } from "./interface";

const log = logger.child("provider-registry");

// ─── Provider Instance Cache ─────────────────────────
// Providers are instantiated once and reused (singleton pattern)

let _openaiProvider: OpenAIProviderImpl | null = null;
let _geminiProvider: GeminiProviderImpl | null = null;
let _claudeProvider: ClaudeProviderImpl | null = null;
let _deepseekProvider: DeepSeekProviderImpl | null = null;

function getOpenAI(): OpenAIProviderImpl {
  if (!_openaiProvider) {
    _openaiProvider = new OpenAIProviderImpl();
    log.info("OpenAI provider initialized");
  }
  return _openaiProvider;
}

function getGemini(): GeminiProviderImpl {
  if (!_geminiProvider) {
    _geminiProvider = new GeminiProviderImpl();
    log.info("Gemini provider initialized");
  }
  return _geminiProvider;
}

function getClaude(): ClaudeProviderImpl {
  if (!_claudeProvider) {
    _claudeProvider = new ClaudeProviderImpl();
    log.info("Claude provider initialized");
  }
  return _claudeProvider;
}

function getDeepSeek(): DeepSeekProviderImpl {
  if (!_deepseekProvider) {
    _deepseekProvider = new DeepSeekProviderImpl();
    log.info("DeepSeek provider initialized");
  }
  return _deepseekProvider;
}

// ─── Provider Map ────────────────────────────────────
// Maps provider IDs to provider instances

const PROVIDER_MAP: Record<string, () => AIProvider> = {
  openai: getOpenAI,
  gemini: getGemini,
  claude: getClaude,
  deepseek: getDeepSeek,
};

// ─── Provider Registry ───────────────────────────────

class ProviderRegistry {
  /**
   * Get the appropriate provider for a given model ID.
   * This is the main entry point — the application never needs to know which provider.
   *
   * @example
   *   const provider = providerRegistry.getProvider("gpt-4o");
   *   const provider = providerRegistry.getProvider("gemini-2.0-flash");
   *   const provider = providerRegistry.getProvider("claude-sonnet-4-20250514");
   */
  getProvider(modelId?: string): AIProvider {
    if (!modelId) {
      return getOpenAI(); // Default fallback
    }

    const model = findModel(modelId);
    if (!model) {
      log.warn(`Unknown model "${modelId}", falling back to OpenAI`);
      return getOpenAI();
    }

    const providerFactory = PROVIDER_MAP[model.provider];
    if (!providerFactory) {
      log.warn(`Unknown provider "${model.provider}", falling back to OpenAI`);
      return getOpenAI();
    }

    return providerFactory();
  }

  /**
   * Get a provider by its ID directly
   */
  getProviderById(providerId: string): AIProvider {
    const factory = PROVIDER_MAP[providerId];
    if (!factory) {
      log.warn(`Unknown provider ID "${providerId}", falling back to OpenAI`);
      return getOpenAI();
    }
    return factory();
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): AIProvider[] {
    return Object.keys(PROVIDER_MAP).map((id) => this.getProviderById(id));
  }

  /**
   * Check if a model ID is valid and available
   */
  isValidModel(modelId: string): boolean {
    return !!findModel(modelId);
  }

  /**
   * Get a model by its ID
   */
  getModel(modelId: string): ProviderModel | undefined {
    return findModel(modelId);
  }

  /**
   * Get all available models across all providers
   */
  getAllModels(): ProviderModel[] {
    return [...ALL_MODELS];
  }

  /**
   * Get models formatted for user selection in Settings
   */
  getSelectableModels(): Array<{ id: string; label: string; provider: string }> {
    return getSelectableModels();
  }

  /**
   * Get the default model (GPT-4o for OpenAI)
   */
  getDefaultModel(): ProviderModel {
    return ALL_MODELS.find((m) => m.id === "gpt-4o") ?? ALL_MODELS[0]!;
  }

  /**
   * Get a user-friendly name for a model ID
   */
  getModelName(modelId: string): string {
    return findModel(modelId)?.name ?? modelId;
  }
}

export const providerRegistry = new ProviderRegistry();

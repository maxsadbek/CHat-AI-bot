/**
 * AI Model Definitions
 * Central registry of all available AI models across providers.
 * Add new models here — no other code changes needed.
 */

import type { ProviderModel } from "./interface";

// ─── OpenAI Models ────────────────────────────────────

export const OPENAI_MODELS: ProviderModel[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    default: true,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    },
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    },
  },
  {
    id: "o1-mini",
    name: "O1 Mini",
    provider: "openai",
    default: false,
    capabilities: {
      streaming: false,
      vision: true,
      functionCalling: false,
      maxContextTokens: 128000,
      maxOutputTokens: 65536,
    },
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    },
  },
];

// ─── Google Gemini Models ─────────────────────────────

export const GEMINI_MODELS: ProviderModel[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    default: true,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 1048576,
      maxOutputTokens: 8192,
    },
  },
  {
    id: "gemini-2.0-pro",
    name: "Gemini 2.0 Pro",
    provider: "gemini",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 2097152,
      maxOutputTokens: 8192,
    },
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 1048576,
      maxOutputTokens: 8192,
    },
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 2097152,
      maxOutputTokens: 8192,
    },
  },
];

// ─── Anthropic Claude Models ──────────────────────────

export const CLAUDE_MODELS: ProviderModel[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "claude",
    default: true,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: "claude-haiku-3-5-20241022",
    name: "Claude Haiku 3.5",
    provider: "claude",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
];

// ─── DeepSeek Models ──────────────────────────────────
// DeepSeek uses an OpenAI-compatible API endpoint.

export const DEEPSEEK_MODELS: ProviderModel[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    },
  },
];

// ─── All Models Flat List ─────────────────────────────

export const ALL_MODELS: ProviderModel[] = [
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...CLAUDE_MODELS,
  ...DEEPSEEK_MODELS,
];

/**
 * Find a model by its ID across all providers
 */
export function findModel(modelId: string): ProviderModel | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

/**
 * Get models for a specific provider
 */
export function getModelsByProvider(provider: string): ProviderModel[] {
  return ALL_MODELS.filter((m) => m.provider === provider);
}

/**
 * Get all available model IDs for user selection in Settings
 */
export function getSelectableModels(): Array<{
  id: string;
  label: string;
  provider: string;
}> {
  return ALL_MODELS.map((m) => ({
    id: m.id,
    label: `${m.name} (${m.provider.charAt(0).toUpperCase() + m.provider.slice(1)})`,
    provider: m.provider,
  }));
}

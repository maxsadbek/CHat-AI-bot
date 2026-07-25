/**
 * Unified AI Model Catalogue across 7 Providers
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

// ─── Groq Models ──────────────────────────────────────
export const GROQ_MODELS: ProviderModel[] = [
  {
    id: "groq-llama-3.3-70b",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: "groq-mixtral-8x7b",
    name: "Mixtral 8x7B (Groq)",
    provider: "groq",
    default: false,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      maxContextTokens: 32768,
      maxOutputTokens: 4096,
    },
  },
];

// ─── DeepSeek Models ──────────────────────────────────
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
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    provider: "deepseek",
    default: false,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    },
  },
];

// ─── OpenRouter Models ────────────────────────────────
export const OPENROUTER_MODELS: ProviderModel[] = [
  {
    id: "openrouter-auto",
    name: "OpenRouter Auto",
    provider: "openrouter",
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
    id: "openrouter-gpt-4o",
    name: "OpenRouter GPT-4o",
    provider: "openrouter",
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

// ─── Ollama Models ────────────────────────────────────
export const OLLAMA_MODELS: ProviderModel[] = [
  {
    id: "ollama-llama3",
    name: "Llama 3 (Ollama Local)",
    provider: "ollama",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: false,
      maxContextTokens: 8192,
      maxOutputTokens: 2048,
    },
  },
  {
    id: "ollama-codellama",
    name: "CodeLlama (Ollama Local)",
    provider: "ollama",
    default: false,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: false,
      maxContextTokens: 16384,
      maxOutputTokens: 4096,
    },
  },
];

// ─── Cerebras Models ────────────────────────────────
export const CEREBRAS_MODELS: ProviderModel[] = [
  {
    id: "cerebras-llama3.1-8b",
    name: "Llama 3.1 8B (Cerebras)",
    provider: "cerebras",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: false,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
    },
  },
];

// ─── Mistral Models ──────────────────────────────────
export const MISTRAL_MODELS: ProviderModel[] = [
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
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
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    default: false,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    },
  },
];

export const ALL_MODELS: ProviderModel[] = [
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...CLAUDE_MODELS,
  ...GROQ_MODELS,
  ...DEEPSEEK_MODELS,
  ...OPENROUTER_MODELS,
  ...OLLAMA_MODELS,
  ...CEREBRAS_MODELS,
  ...MISTRAL_MODELS,
];

export function findModel(modelId: string): ProviderModel | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

export function getModelsByProvider(provider: string): ProviderModel[] {
  return ALL_MODELS.filter((m) => m.provider === provider);
}

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

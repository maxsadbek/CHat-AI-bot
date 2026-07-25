/**
 * Unified AI Model Catalogue
 * ALL model IDs are loaded from environment variables — NO hardcoded model IDs.
 *
 * Each provider exports a single model entry whose `id` is read from its
 * corresponding *_MODEL env var (e.g. OPENAI_MODEL, GEMINI_MODEL).
 * Sensible fallback defaults are provided so the app works without env vars.
 *
 * The provider chain for TEXT tasks is: Gemini → Cerebras → Mistral → OpenRouter
 * Video prompt generation uses the same TEXT AI router.
 * Image generation remains separate with Stability → Flux.
 */

import type { ProviderModel } from "./interface";

// ─── OpenAI Models ────────────────────────────────────
// Model ID from process.env.OPENAI_MODEL
const openaiModelId = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const OPENAI_MODELS: ProviderModel[] = [
  {
    id: openaiModelId,
    name: `OpenAI (${openaiModelId})`,
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
  // openrouter/free is a special case — accessed through OpenAI-compatible endpoint
  {
    id: "openrouter/free",
    name: "OpenRouter Free",
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
// Model ID from process.env.GEMINI_MODEL
const geminiModelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GEMINI_MODELS: ProviderModel[] = [
  {
    id: geminiModelId,
    name: `Gemini (${geminiModelId})`,
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
];

// ─── Anthropic Claude Models ──────────────────────────
// Model ID from process.env.ANTHROPIC_MODEL
const claudeModelId = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
export const CLAUDE_MODELS: ProviderModel[] = [
  {
    id: claudeModelId,
    name: `Claude (${claudeModelId})`,
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
];

// ─── Groq Models ──────────────────────────────────────
// Model ID from process.env.GROQ_MODEL (fallback: llama-3.3-70b-versatile)
const groqModelId = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
export const GROQ_MODELS: ProviderModel[] = [
  {
    id: groqModelId,
    name: `Groq (${groqModelId})`,
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
];

// ─── DeepSeek Models ──────────────────────────────────
// Model ID from process.env.DEEPSEEK_MODEL
const deepseekModelId = process.env.DEEPSEEK_MODEL || "deepseek-chat";
export const DEEPSEEK_MODELS: ProviderModel[] = [
  {
    id: deepseekModelId,
    name: `DeepSeek (${deepseekModelId})`,
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

// ─── OpenRouter Models ────────────────────────────────
// Model ID from process.env.OPENROUTER_MODEL
const openrouterModelId = process.env.OPENROUTER_MODEL || "openrouter/auto";
export const OPENROUTER_MODELS: ProviderModel[] = [
  {
    id: openrouterModelId,
    name: `OpenRouter (${openrouterModelId})`,
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
];

// ─── Ollama Models ────────────────────────────────────
// Model ID from process.env.OLLAMA_MODEL
const ollamaModelId = process.env.OLLAMA_MODEL || "llama3";
export const OLLAMA_MODELS: ProviderModel[] = [
  {
    id: ollamaModelId,
    name: `Ollama (${ollamaModelId})`,
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
];

// ─── Cerebras Models ────────────────────────────────
// Model ID from process.env.CEREBRAS_MODEL
const cerebrasModelId = process.env.CEREBRAS_MODEL || "gpt-oss-120b";
export const CEREBRAS_MODELS: ProviderModel[] = [
  {
    id: cerebrasModelId,
    name: `Cerebras (${cerebrasModelId})`,
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
// Model ID from process.env.MISTRAL_MODEL
const mistralModelId = process.env.MISTRAL_MODEL || "mistral-large-latest";
export const MISTRAL_MODELS: ProviderModel[] = [
  {
    id: mistralModelId,
    name: `Mistral (${mistralModelId})`,
    provider: "mistral",
    default: true,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    },
  },
];

// ─── Stability AI Models ────────────────────────────
// Model ID from process.env.STABILITY_MODEL
const stabilityModelId = process.env.STABILITY_MODEL || "stable-diffusion-xl-1024-v1-0";
export const STABILITY_MODELS: ProviderModel[] = [
  {
    id: stabilityModelId,
    name: `Stability AI (${stabilityModelId})`,
    provider: "stability",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: false,
      maxContextTokens: 8192,
      maxOutputTokens: 2048,
    },
  },
];

// ─── Flux Models ──────────────────────────────────────
// Model ID from process.env.FLUX_MODEL
const fluxModelId = process.env.FLUX_MODEL || "FLUX.1-schnell";
export const FLUX_MODELS: ProviderModel[] = [
  {
    id: fluxModelId,
    name: `Flux AI (${fluxModelId})`,
    provider: "flux",
    default: true,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: false,
      maxContextTokens: 8192,
      maxOutputTokens: 2048,
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
  ...STABILITY_MODELS,
  ...FLUX_MODELS,
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

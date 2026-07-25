/**
 * Centralized AI Configuration
 * Enterprise Single Source of Truth for Models, Plans, Token Policies,
 * Feature Settings, Provider Settings, Fallback Degradation, and Costs.
 *
 * NO HARDCODED VALUES ARE ALLOWED IN ANY SERVICE.
 */

export type FeatureType =
  | "chat"
  | "business"
  | "coding"
  | "image"
  | "video"
  | "translate"
  | "social";

export type PlanType = "FREE" | "PREMIUM" | "PRO" | "ENTERPRISE";

export interface ModelPricing {
  promptUsdPer1k: number;
  completionUsdPer1k: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderId;
  maxContextTokens: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
  isDefault?: boolean;
}

export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "cerebras"
  | "mistral"
  | "stability"
  | "flux";

export interface ProviderSetting {
  id: ProviderId;
  name: string;
  baseUrl: string;
  envKey: string;
  enabled: boolean;
  timeoutMs: number;
}

export interface FeatureTokenPolicy {
  base: number;
  max: number;
}

export interface AIConfigData {
  defaultProvider: ProviderId;
  fallbackSteps: number[];
  retry: {
    maxRetries: number;
    initialBackoffMs: number;
    maxBackoffMs: number;
    backoffFactor: number;
    jitter: boolean;
  };
  temperatures: Record<FeatureType, number>;
  tokenPolicies: Record<FeatureType, Record<PlanType, FeatureTokenPolicy>>;
  providers: Record<ProviderId, ProviderSetting>;
  models: Record<string, ModelConfig>;
}

/**
 * Standard Plan Normalizer for legacy plan strings (e.g. 'free', 'pro_monthly', 'lifetime')
 */
export function normalizePlanType(planStr?: string | null): PlanType {
  if (!planStr) return "FREE";
  const normalized = planStr.trim().toUpperCase();
  if (normalized === "FREE") return "FREE";
  if (normalized === "PREMIUM") return "PREMIUM";
  if (normalized === "PRO" || normalized.startsWith("PRO_")) return "PRO";
  if (normalized === "ENTERPRISE" || normalized === "LIFETIME") return "ENTERPRISE";
  return "FREE";
}

/**
 * Enterprise AI Configuration Engine
 */
export class AIConfig {
  private static configData: AIConfigData = {
    // AI_PROVIDER_ORDER from env: gemini,cerebras,mistral,openrouter
    defaultProvider: (process.env.AI_PROVIDER_ORDER?.split(",")[0]?.trim() as ProviderId) || "gemini",
    fallbackSteps: [6000, 4000, 3000, 2000, 1200, 800],
    retry: {
      maxRetries: 3,
      initialBackoffMs: 500,
      maxBackoffMs: 10000,
      backoffFactor: 2,
      jitter: true,
    },
    temperatures: {
      chat: 0.7,
      business: 0.8,
      coding: 0.2,
      image: 0.8,
      video: 0.8,
      translate: 0.3,
      social: 0.8,
    },
    // Per-feature max tokens read from environment variables with sensible defaults
    // FREE tier uses minimal tokens (FREE_MAX_TOKENS=250) to reduce costs;
    // premium tiers get more (PREMIUM_MAX_TOKENS=700).
    tokenPolicies: {
      chat: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
      business: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
      coding: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 2048 },
        PRO: { base: 4096, max: 8192 },
        ENTERPRISE: { base: 8192, max: 16384 },
      },
      image: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
      video: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
      translate: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
      social: {
        FREE: { base: Number(process.env.FREE_MAX_TOKENS) || 250, max: Number(process.env.FREE_MAX_TOKENS) || 250 },
        PREMIUM: { base: Number(process.env.PREMIUM_MAX_TOKENS) || 700, max: 1024 },
        PRO: { base: 2048, max: 4096 },
        ENTERPRISE: { base: 4096, max: 8192 },
      },
    },
    providers: {
      openai: {
        id: "openai",
        name: "OpenAI",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        envKey: "OPENAI_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      anthropic: {
        id: "anthropic",
        name: "Anthropic Claude",
        baseUrl: "https://api.anthropic.com/v1",
        envKey: "ANTHROPIC_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      gemini: {
        id: "gemini",
        name: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
        envKey: "GEMINI_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      groq: {
        id: "groq",
        name: "Groq",
        baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        envKey: "GROQ_API_KEY",
        enabled: true,
        timeoutMs: 30000,
      },
      deepseek: {
        id: "deepseek",
        name: "DeepSeek",
        baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        envKey: "DEEPSEEK_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      openrouter: {
        id: "openrouter",
        name: "OpenRouter",
        baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        envKey: "OPENROUTER_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      ollama: {
        id: "ollama",
        name: "Ollama (Local)",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        envKey: "OLLAMA_API_KEY",
        enabled: true,
        timeoutMs: 120000,
      },
      cerebras: {
        id: "cerebras",
        name: "Cerebras",
        baseUrl: process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1",
        envKey: "CEREBRAS_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      mistral: {
        id: "mistral",
        name: "Mistral AI",
        baseUrl: process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
        envKey: "MISTRAL_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      stability: {
        id: "stability",
        name: "Stability AI",
        baseUrl: process.env.STABILITY_BASE_URL || "https://api.stability.ai/v1",
        envKey: "STABILITY_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
      flux: {
        id: "flux",
        name: "Flux AI",
        baseUrl: process.env.FLUX_BASE_URL || "https://api.bfl.ml/v1",
        envKey: "FLUX_API_KEY",
        enabled: true,
        timeoutMs: 60000,
      },
    },
    models: {
      "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.0025, completionUsdPer1k: 0.01 },
        isDefault: true,
      },
      "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        pricing: { promptUsdPer1k: 0.00015, completionUsdPer1k: 0.0006 },
      },
      "claude-sonnet-4-20250514": {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.003, completionUsdPer1k: 0.015 },
      },
      "gemini-2.0-flash": {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        provider: "gemini",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.0001, completionUsdPer1k: 0.0004 },
      },
      "groq-llama-3.3-70b": {
        id: "groq-llama-3.3-70b",
        name: "Llama 3.3 70B (Groq)",
        provider: "groq",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.00059, completionUsdPer1k: 0.00079 },
      },
      "deepseek-chat": {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        provider: "deepseek",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.00014, completionUsdPer1k: 0.00028 },
      },
      "openrouter-auto": {
        id: "openrouter-auto",
        name: "OpenRouter Auto",
        provider: "openrouter",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.002, completionUsdPer1k: 0.008 },
      },
      "ollama-llama3": {
        id: "ollama-llama3",
        name: "Llama 3 (Local)",
        provider: "ollama",
        maxContextTokens: 8192,
        maxOutputTokens: 2048,
        pricing: { promptUsdPer1k: 0, completionUsdPer1k: 0 },
      },
      "cerebras-llama3.1-8b": {
        id: "cerebras-llama3.1-8b",
        name: "Llama 3.1 8B (Cerebras)",
        provider: "cerebras",
        maxContextTokens: 8192,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.0001, completionUsdPer1k: 0.0001 },
      },
      "mistral-small-latest": {
        id: "mistral-small-latest",
        name: "Mistral Small",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.001, completionUsdPer1k: 0.003 },
      },
      "mistral-large-latest": {
        id: "mistral-large-latest",
        name: "Mistral Large",
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.002, completionUsdPer1k: 0.006 },
      },
      "stable-diffusion-xl-1024-v1-0": {
        id: "stable-diffusion-xl-1024-v1-0",
        name: "Stable Diffusion XL 1.0",
        provider: "stability",
        maxContextTokens: 8192,
        maxOutputTokens: 2048,
        pricing: { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
      },
      "FLUX.1-schnell": {
        id: "FLUX.1-schnell",
        name: "FLUX.1 Schnell",
        provider: "flux",
        maxContextTokens: 8192,
        maxOutputTokens: 2048,
        pricing: { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
      },
      "gemini-2.5-flash": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        provider: "gemini",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.00015, completionUsdPer1k: 0.0006 },
      },
      // Cerebras GPT model alias
      "gpt-oss-120b": {
        id: "gpt-oss-120b",
        name: "GPT OSS 120B",
        provider: "cerebras",
        maxContextTokens: 32000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.0001, completionUsdPer1k: 0.0001 },
      },
      // OpenRouter free model (used with OpenAI-compatible endpoint)
      "openrouter/free": {
        id: "openrouter/free",
        name: "OpenRouter Free",
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0, completionUsdPer1k: 0 },
      },
    },
  };

  /**
   * Resolve maximum output tokens dynamically based on feature, plan tier, and prompt size.
   * Uses env-var-configured defaults to avoid hardcoding.
   */
  static getMaxTokens(
    feature: FeatureType,
    plan?: string | PlanType,
    promptLength: number = 0
  ): number {
    const planType = normalizePlanType(plan);
    const policy =
      this.configData.tokenPolicies[feature]?.[planType] ??
      this.configData.tokenPolicies[feature]?.FREE ?? { base: 400, max: 400 };

    // For FREE plan, always use the env-var base value (no dynamic scaling)
    if (planType === "FREE") {
      return policy.base;
    }

    // Dynamic cost optimization: scale limit based on prompt length
    if (promptLength > 4000) {
      return policy.max;
    } else if (promptLength > 1000) {
      return Math.min(policy.max, Math.round(policy.base * 1.5));
    }
    return policy.base;
  }

  /**
   * Get default temperature for a feature
   */
  static getTemperature(feature: FeatureType): number {
    return this.configData.temperatures[feature] ?? 0.7;
  }

  /**
   * Get fallback step limits array
   */
  static getFallbackSteps(): number[] {
    return [...this.configData.fallbackSteps];
  }

  /**
   * Get retry policy
   */
  static getRetryPolicy() {
    return { ...this.configData.retry };
  }

  /**
   * Get provider settings
   */
  static getProviderSetting(providerId: ProviderId): ProviderSetting | undefined {
    return this.configData.providers[providerId];
  }

  /**
   * Get model configuration by ID
   */
  static getModelConfig(modelId: string): ModelConfig | undefined {
    return this.configData.models[modelId];
  }

  /**
   * Calculate cost in USD for a given completion
   */
  static calculateCost(
    modelId: string,
    promptTokens: number = 0,
    completionTokens: number = 0
  ): number {
    const model = this.getModelConfig(modelId);
    if (!model) return 0;

    const promptCost = (promptTokens / 1000) * model.pricing.promptUsdPer1k;
    const completionCost =
      (completionTokens / 1000) * model.pricing.completionUsdPer1k;

    return Number((promptCost + completionCost).toFixed(6));
  }

  /**
   * Get full config data copy
   */
  static getConfigData(): AIConfigData {
    return JSON.parse(JSON.stringify(this.configData));
  }
}

export const aiConfig = AIConfig;

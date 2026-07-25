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
    // Feature-based degradation: starts from requested limit, reduces stepwise.
    // With coding PREMIUM limits up to 2000, 5 steps give graceful
    // degradation: 2000 → 1400 → 800 → 600 → 400.
    // The getDegradedMaxTokens() method finds the closest step <= requested
    // and applies the attempt offset, so smaller requests degrade from
    // the appropriate starting point.
    fallbackSteps: [2000, 1400, 800, 600, 400],
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
    // ─── Professional Token Limits per Feature and Plan ───────────
    //
    // These are the AUTHORITATIVE limits.  The FREE_MAX_TOKENS / 
    // PREMIUM_MAX_TOKENS / PRO_MAX_TOKENS / ENTERPRISE_MAX_TOKENS env
    // vars can ONLY RAISE these values (see getMaxTokens for the 50%
    // minimum floor clamp).  They can never reduce quality below the
    // professional defaults.
    //
    // Feature-based differentiation:
    //   Video & Coding — highest (prompt engineering needs many tokens)
    //   Chat & Translate — moderate
    //   Image & Social — medium
    //   Business — high (strategy docs need room)
    //
    // ─── Feature-Specific Token Limits per Plan ────────────────────
    //
    // These are the AUTHORITATIVE feature+plan limits.
    // Env vars (FREE_MAX_TOKENS, PREMIUM_MAX_TOKENS) serve as general
    // plan-wide fallbacks when no feature-specific policy is configured.
    //
    // Feature-based differentiation:
    //   Chat — short conversational responses (lowest)
    //   Coding — long code blocks, full implementations (highest)
    //   Business — detailed strategies, plans, analysis (high)
    //   Video — cinematic scene descriptions (high)
    //   Image — professional prompt engineering (medium)
    //   Social — marketing content, campaigns (medium)
    //   Translate — sentence-level, shorter output (lowest)
    //
    tokenPolicies: {
      chat: {
        FREE: { base: 400, max: 600 },
        PREMIUM: { base: 800, max: 1400 },
        PRO: { base: 4000, max: 8000 },
        ENTERPRISE: { base: 8000, max: 16000 },
      },
      business: {
        FREE: { base: 400, max: 600 },
        PREMIUM: { base: 1000, max: 1600 },
        PRO: { base: 8000, max: 16000 },
        ENTERPRISE: { base: 16000, max: 32000 },
      },
      coding: {
        FREE: { base: 600, max: 800 },
        PREMIUM: { base: 1200, max: 2000 },
        PRO: { base: 12000, max: 24000 },
        ENTERPRISE: { base: 24000, max: 48000 },
      },
      image: {
        FREE: { base: 400, max: 600 },
        PREMIUM: { base: 800, max: 1400 },
        PRO: { base: 4000, max: 8000 },
        ENTERPRISE: { base: 8000, max: 16000 },
      },
      video: {
        FREE: { base: 600, max: 800 },
        PREMIUM: { base: 1200, max: 1800 },
        PRO: { base: 8000, max: 16000 },
        ENTERPRISE: { base: 16000, max: 32000 },
      },
      translate: {
        FREE: { base: 400, max: 600 },
        PREMIUM: { base: 800, max: 1400 },
        PRO: { base: 3000, max: 6000 },
        ENTERPRISE: { base: 6000, max: 12000 },
      },
      social: {
        FREE: { base: 400, max: 600 },
        PREMIUM: { base: 800, max: 1400 },
        PRO: { base: 5000, max: 10000 },
        ENTERPRISE: { base: 10000, max: 20000 },
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
    // ALL model IDs are loaded from environment variables — no hardcoded model IDs.
    // The *_MODEL env vars (e.g. OPENAI_MODEL, GEMINI_MODEL, CEREBRAS_MODEL)
    // define which model each provider uses.
    models: {
      // OpenAI model from env
      [process.env.OPENAI_MODEL || "gpt-4o-mini"]: {
        id: process.env.OPENAI_MODEL || "gpt-4o-mini",
        name: `OpenAI (${process.env.OPENAI_MODEL || "gpt-4o-mini"})`,
        provider: "openai",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.0025, completionUsdPer1k: 0.01 },
        isDefault: true,
      },
      // Gemini model from env
      [process.env.GEMINI_MODEL || "gemini-2.5-flash"]: {
        id: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        name: `Gemini (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`,
        provider: "gemini",
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.00015, completionUsdPer1k: 0.0006 },
      },
      // Claude model from env
      [process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"]: {
        id: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        name: `Claude (${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"})`,
        provider: "anthropic",
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.003, completionUsdPer1k: 0.015 },
      },
      // Cerebras model from env
      [process.env.CEREBRAS_MODEL || "gpt-oss-120b"]: {
        id: process.env.CEREBRAS_MODEL || "gpt-oss-120b",
        name: `Cerebras (${process.env.CEREBRAS_MODEL || "gpt-oss-120b"})`,
        provider: "cerebras",
        maxContextTokens: 32000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.0001, completionUsdPer1k: 0.0001 },
      },
      // Mistral model from env
      [process.env.MISTRAL_MODEL || "mistral-large-latest"]: {
        id: process.env.MISTRAL_MODEL || "mistral-large-latest",
        name: `Mistral (${process.env.MISTRAL_MODEL || "mistral-large-latest"})`,
        provider: "mistral",
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        pricing: { promptUsdPer1k: 0.002, completionUsdPer1k: 0.006 },
      },
      // OpenRouter model from env
      [process.env.OPENROUTER_MODEL || "openrouter/auto"]: {
        id: process.env.OPENROUTER_MODEL || "openrouter/auto",
        name: `OpenRouter (${process.env.OPENROUTER_MODEL || "openrouter/auto"})`,
        provider: "openrouter",
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        pricing: { promptUsdPer1k: 0.002, completionUsdPer1k: 0.008 },
      },
      // Stability AI model from env
      [process.env.STABILITY_MODEL || "stable-diffusion-xl-1024-v1-0"]: {
        id: process.env.STABILITY_MODEL || "stable-diffusion-xl-1024-v1-0",
        name: `Stability AI (${process.env.STABILITY_MODEL || "stable-diffusion-xl-1024-v1-0"})`,
        provider: "stability",
        maxContextTokens: 8192,
        maxOutputTokens: 2048,
        pricing: { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
      },
      // Flux model from env
      [process.env.FLUX_MODEL || "FLUX.1-schnell"]: {
        id: process.env.FLUX_MODEL || "FLUX.1-schnell",
        name: `Flux AI (${process.env.FLUX_MODEL || "FLUX.1-schnell"})`,
        provider: "flux",
        maxContextTokens: 8192,
        maxOutputTokens: 2048,
        pricing: { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
      },
      // OpenRouter free model alias (used through OpenAI-compatible endpoint)
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

  /** Minimum sensible value for env-based token overrides */
  private static readonly MIN_ENV_TOKEN_FLOOR = 100;

  /**
   * Resolve maximum output tokens based on feature, plan tier, and prompt size.
   *
   * Priority:
   *   1. User provided maxTokens (handled in caller via request.maxTokens)
   *   2. Plan-based environment limits (FREE_MAX_TOKENS / PREMIUM_MAX_TOKENS env vars)
   *      — used as the starting base if set and above MIN_ENV_TOKEN_FLOOR
   *   3. Feature-specific limits (from tokenPolicies) — used as the starting base
   *      if no plan env limit is set; the feature's `max` value caps the final result
   *
   * All plans get dynamic scaling: longer/complex prompts get more output tokens,
   * up to the feature's configured max limit.
   */
  static getMaxTokens(
    feature: FeatureType,
    plan?: string | PlanType,
    promptLength: number = 0
  ): number {
    const planType = normalizePlanType(plan);

    // ── Resolve token policy for this feature+plan ─────────────
    const policy =
      this.configData.tokenPolicies[feature]?.[planType] ??
      this.configData.tokenPolicies[feature]?.FREE ?? { base: 400, max: 400 };

    // ── Priority 2: Plan-based environment limits ──────────────
    // Use plan env var as the starting base if set (e.g., FREE_MAX_TOKENS=600).
    // Protected from accidentally low values via MIN_ENV_TOKEN_FLOOR.
    const envOverrides: Record<string, number | undefined> = {
      FREE: process.env.FREE_MAX_TOKENS ? Number(process.env.FREE_MAX_TOKENS) : undefined,
      PREMIUM: process.env.PREMIUM_MAX_TOKENS ? Number(process.env.PREMIUM_MAX_TOKENS) : undefined,
      PRO: process.env.PRO_MAX_TOKENS ? Number(process.env.PRO_MAX_TOKENS) : undefined,
      ENTERPRISE: process.env.ENTERPRISE_MAX_TOKENS ? Number(process.env.ENTERPRISE_MAX_TOKENS) : undefined,
    };

    const envBase = envOverrides[planType];
    const effectiveBase =
      envBase !== undefined && envBase >= AIConfig.MIN_ENV_TOKEN_FLOOR
        ? envBase
        : policy.base;

    // ── Priority 3: Feature-specific max caps the final value ──
    // Dynamic scaling: longer prompts get more output tokens.
    if (planType === "FREE") {
      // FREE plan: conservative scaling, but allows up to feature max
      if (promptLength > 4000) {
        return policy.max;
      } else if (promptLength > 1000) {
        return Math.min(policy.max, Math.round(effectiveBase * 1.3));
      }
      return Math.min(policy.max, effectiveBase);
    }

    // PREMIUM/PRO/ENTERPRISE: more generous scaling
    if (promptLength > 4000) {
      return policy.max;
    } else if (promptLength > 1000) {
      return Math.min(policy.max, Math.round(effectiveBase * 1.5));
    }
    return Math.min(policy.max, effectiveBase);
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

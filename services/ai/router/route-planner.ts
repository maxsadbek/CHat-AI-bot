/**
 * AI Router - Route Planner
 * Maps task types (chat, coding, image, video) to provider priority chains.
 * Reads provider priorities from environment variables.
 * Easily extensible: add a new provider ID to the env var comma-separated list.
 */

import { env } from "@/config/index";
import type { FeatureType } from "@/config/ai";
import type { RoutePlan } from "./types";

/**
 * Default provider chains per task type.
 * These match the user's specified architecture:
 *   text:         Gemini → Cerebras → Mistral → OpenRouter
 *   image:        Gemini → Cerebras → Mistral → OpenRouter (prompt generation needs TEXT AI, not image generators)
 *   video_prompt: Gemini → Cerebras → Mistral
 *
 * NOTE: The "image" feature is used for IMAGE PROMPT GENERATION (text output),
 * not actual image generation.  Image generation uses provider-specific APIs
 * directly (bypassing the router).  Therefore the image chain uses TEXT providers.
 *
 * Can be overridden via environment variables.
 */
const DEFAULT_PRIORITY_CHAINS: Record<string, string> = {
  text: "gemini,cerebras,mistral,openrouter",
  image: "gemini,cerebras,mistral,openrouter",
  video_prompt: "gemini,cerebras,mistral",
};

/** Map of env var names to their feature types */
const PRIORITY_ENV_MAP: Record<FeatureType, string> = {
  chat: "ROUTER_CHAT_PRIORITY",
  coding: "ROUTER_CODING_PRIORITY",
  image: "ROUTER_IMAGE_PRIORITY",
  video: "ROUTER_VIDEO_PRIORITY",
  business: "ROUTER_BUSINESS_PRIORITY",
  translate: "ROUTER_TRANSLATE_PRIORITY",
  social: "ROUTER_SOCIAL_PRIORITY",
};

export class RoutePlanner {
  /** Resolve the provider priority chain for a given task */
  getRoute(feature: FeatureType): RoutePlan {
    const envVar = PRIORITY_ENV_MAP[feature];
    const envValue = process.env[envVar];

    // Use env var if set, otherwise use task-type-specific default
    const rawValue = envValue
      || DEFAULT_PRIORITY_CHAINS[feature]
      || DEFAULT_PRIORITY_CHAINS.text // Fall back to text chain
      || env.ROUTER_DEFAULT_PRIORITY
      || "gemini,cerebras,mistral,openrouter";

    const providerChain = rawValue
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return {
      feature,
      providerChain: providerChain.length > 0
        ? providerChain
        : ["gemini", "cerebras", "mistral", "openrouter"], // Absolute fallback
    };
  }

  /** Get the primary (highest priority) provider for a task */
  getPrimaryProvider(feature: FeatureType): string {
    const route = this.getRoute(feature);
    return route.providerChain[0] || "openai";
  }

  /** Get the fallback chain (all except primary) */
  getFallbackChain(feature: FeatureType): string[] {
    const route = this.getRoute(feature);
    return route.providerChain.slice(1);
  }

  /** Check if a provider is in the routing chain for this task */
  isProviderInRoute(feature: FeatureType, providerId: string): boolean {
    const route = this.getRoute(feature);
    return route.providerChain.includes(providerId.toLowerCase());
  }

  /** Get all configured provider IDs across all tasks */
  getAllConfiguredProviders(): string[] {
    const allProviders = new Set<string>();
    const features: FeatureType[] = ["chat", "coding", "image", "video", "business", "translate", "social"];

    for (const feature of features) {
      const route = this.getRoute(feature);
      for (const provider of route.providerChain) {
        allProviders.add(provider);
      }
    }

    return Array.from(allProviders);
  }
}

/** Singleton route planner */
export const routePlanner = new RoutePlanner();

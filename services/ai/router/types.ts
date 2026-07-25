/**
 * AI Router Type Definitions
 * Types for provider routing, health checks, caching, and usage tracking.
 */

import type { FeatureType } from "@/config/ai";
import type { AIProvider, ChatRequest, ChatResponse, ProviderModel } from "@/services/ai/providers/interface";

/** Health status of a single provider */
export interface ProviderHealth {
  status: "healthy" | "degraded" | "unhealthy";
  lastChecked: number;      // timestamp
  lastSuccess: number;      // timestamp
  lastFailure: number;      // timestamp
  consecutiveFailures: number;
  latencyMs: number;
  error?: string;
}

/** Priority entry for provider ordering */
export interface ProviderPriorityEntry {
  providerId: string;
  priority: number; // lower = higher priority (1 = highest)
}

/** Task-to-provider mapping resolved from env vars */
export interface RoutePlan {
  feature: FeatureType;
  providerChain: string[]; // ordered by priority (highest first)
}

/** Cached response entry */
export interface CacheEntry {
  response: ChatResponse;
  cachedAt: number;
  ttl: number; // seconds
  feature: FeatureType;
}

/** Router execution options */
export interface RouterOptions {
  /** If true, skip cache lookup */
  skipCache?: boolean;
  /** If true, skip health checks (force try) */
  forceAttempt?: boolean;
  /** Custom timeout per attempt in ms */
  timeout?: number;
}

/** Router execution result with telemetry */
export interface RouterResult {
  response: ChatResponse;
  providerId: string;
  modelId: string;
  attempt: number;          // 0-indexed attempt number
  totalAttempts: number;
  latencyMs: number;
  cached: boolean;
  fromFallback: boolean;
}

/** Daily usage entry for a user */
export interface UsageEntry {
  userId: number;
  feature: FeatureType;
  count: number;
  date: string; // YYYY-MM-DD
  tokensIn: number;
  tokensOut: number;
}

/** Router statistics for monitoring */
export interface RouterStats {
  totalRequests: number;
  totalCached: number;
  totalFailed: number;
  providerStats: Record<string, {
    requests: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
  }>;
  cacheHitRate: number;
  uptime: number; // seconds since router started
}

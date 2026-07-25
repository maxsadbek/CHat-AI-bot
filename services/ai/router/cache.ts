/**
 * AI Router - Response Cache
 * In-memory cache for AI responses based on exact input hash.
 * Cache TTL is configurable via AI_CACHE_TTL env var (default: 300s).
 */

import { env } from "@/config/index";
import type { FeatureType } from "@/config/ai";
import type { ChatRequest, ChatResponse } from "@/services/ai/providers/interface";
import type { CacheEntry } from "./types";

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly defaultTtl: number;

  constructor(ttlSeconds?: number) {
    this.defaultTtl = ttlSeconds ?? env.AI_CACHE_TTL ?? 300;
  }

  /**
   * Generate a deterministic cache key from the request.
   * Uses: feature, model, systemPrompt, messages content, temperature, maxTokens.
   */
  private buildKey(
    feature: FeatureType,
    modelId: string,
    request: ChatRequest
  ): string {
    const parts = [
      feature,
      modelId,
      request.systemPrompt || "",
      ...request.messages.map((m) => `${m.role}:${m.content}`),
      String(request.temperature ?? 0.7),
      String(request.maxTokens ?? 0),
    ];
    // Simple but deterministic hash
    const raw = parts.join("|||");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `cache:${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get a cached response if available and not expired.
   */
  get(
    feature: FeatureType,
    modelId: string,
    request: ChatRequest
  ): ChatResponse | null {
    const key = this.buildKey(feature, modelId, request);
    const entry = this.cache.get(key);

    if (!entry) return null;

    const age = (Date.now() - entry.cachedAt) / 1000;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  /**
   * Store a response in the cache.
   */
  set(
    feature: FeatureType,
    modelId: string,
    request: ChatRequest,
    response: ChatResponse,
    ttl?: number
  ): void {
    const key = this.buildKey(feature, modelId, request);

    this.cache.set(key, {
      response,
      cachedAt: Date.now(),
      ttl: ttl ?? this.defaultTtl,
      feature,
    });
  }

  /**
   * Invalidate all cache entries for a specific feature.
   */
  invalidateFeature(feature: FeatureType): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.feature === feature) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache.
   */
  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // calculated externally by the router
    };
  }

  /**
   * Periodically purge expired entries (called internally or externally).
   */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.cachedAt) / 1000 > entry.ttl) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

/** Singleton cache instance */
export const responseCache = new ResponseCache();

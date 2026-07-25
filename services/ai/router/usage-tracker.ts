/**
 * AI Router - Daily Usage Tracker
 * Tracks per-user daily usage across features with separate free/premium limits.
 * Integrates with the existing usageService for database-backed tracking.
 *
 * Two layers of protection:
 *   1. Per-feature request count limits (e.g., 30 chat requests/day)
 *   2. Total daily token limits (10,000 tokens for FREE, 50,000 for PREMIUM)
 *
 * Per-feature daily limits:
 *            Free    Premium
 *   chat      30      300
 *   image     10      100
 *   video      5       50
 *   code      10      100
 *   social    30      300
 *   business  30      300
 *   translate 30      300
 *
 * Daily token limits:
 *   FREE:     10,000 tokens/day
 *   PREMIUM:  50,000 tokens/day
 */

import { logger } from "@/bot/core/logger";
import type { FeatureType } from "@/config/ai";
import type { UsageEntry } from "./types";

const log = logger.child("router-usage");

/** In-memory usage counters (flushed periodically to DB via usageService) */
const DAILY_USAGE = new Map<string, UsageEntry>();

function buildKey(userId: number, feature: FeatureType, date: string): string {
  return `${userId}:${feature}:${date}`;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export class UsageTracker {
  /** Track a usage event */
  track(
    userId: number,
    feature: FeatureType,
    tokensIn: number = 0,
    tokensOut: number = 0
  ): void {
    const date = getTodayDate();
    const key = buildKey(userId, feature, date);

    const existing = DAILY_USAGE.get(key);
    if (existing) {
      DAILY_USAGE.set(key, {
        ...existing,
        count: existing.count + 1,
        tokensIn: existing.tokensIn + tokensIn,
        tokensOut: existing.tokensOut + tokensOut,
      });
    } else {
      DAILY_USAGE.set(key, {
        userId,
        feature,
        count: 1,
        date,
        tokensIn,
        tokensOut,
      });
    }
  }

  /** Get usage count for a user/feature today */
  getTodayCount(userId: number, feature: FeatureType): number {
    const date = getTodayDate();
    const key = buildKey(userId, feature, date);
    return DAILY_USAGE.get(key)?.count ?? 0;
  }

  /** Get total tokens used by a user/feature today */
  getTodayTokens(userId: number, feature: FeatureType): { in: number; out: number } {
    const date = getTodayDate();
    const key = buildKey(userId, feature, date);
    const entry = DAILY_USAGE.get(key);
    return {
      in: entry?.tokensIn ?? 0,
      out: entry?.tokensOut ?? 0,
    };
  }

  /** Get total daily usage across all features for a user */
  getTotalToday(userId: number): number {
    const date = getTodayDate();
    let total = 0;
    for (const [key, entry] of DAILY_USAGE.entries()) {
      if (key.startsWith(`${userId}:`) && key.endsWith(`:${date}`)) {
        total += entry.count;
      }
    }
    return total;
  }

  /** Daily token limit message in Uzbek */
  static readonly TOKEN_LIMIT_MESSAGE =
    "⚠️ Bugungi AI limit tugadi.\n\nErtaga yana bepul foydalanishingiz mumkin.\nPremium tarif orqali ko‘proq imkoniyat ochiladi 🚀";

  /**
   * Per-feature daily request limits for free users
   */
  private readonly FREE_FEATURE_LIMITS: Record<string, number> = {
    chat: Number(process.env.AI_DAILY_CHAT_LIMIT_FREE) || 30,
    image: Number(process.env.AI_DAILY_IMAGE_LIMIT_FREE) || 10,
    video: Number(process.env.AI_DAILY_VIDEO_LIMIT_FREE) || 5,
    coding: Number(process.env.AI_DAILY_CODING_LIMIT_FREE) || 10,
    social: Number(process.env.AI_DAILY_SOCIAL_LIMIT_FREE) || 30,
    business: Number(process.env.AI_DAILY_BUSINESS_LIMIT_FREE) || 30,
    translate: Number(process.env.AI_DAILY_TRANSLATE_LIMIT_FREE) || 30,
  };

  /**
   * Per-feature daily request limits for premium users
   */
  private readonly PREMIUM_FEATURE_LIMITS: Record<string, number> = {
    chat: Number(process.env.AI_DAILY_CHAT_LIMIT_PREMIUM) || 300,
    image: Number(process.env.AI_DAILY_IMAGE_LIMIT_PREMIUM) || 100,
    video: Number(process.env.AI_DAILY_VIDEO_LIMIT_PREMIUM) || 50,
    coding: Number(process.env.AI_DAILY_CODING_LIMIT_PREMIUM) || 100,
    social: Number(process.env.AI_DAILY_SOCIAL_LIMIT_PREMIUM) || 300,
    business: Number(process.env.AI_DAILY_BUSINESS_LIMIT_PREMIUM) || 300,
    translate: Number(process.env.AI_DAILY_TRANSLATE_LIMIT_PREMIUM) || 300,
  };

  /**
   * Daily token limits (total across all features)
   */
  private getDailyTokenLimit(userPlan?: string): number {
    const normalized = (userPlan || "FREE").toUpperCase();
    if (normalized === "FREE" || normalized === "") {
      return Number(process.env.AI_DAILY_TOKEN_LIMIT_FREE) || 10000;
    }
    return Number(process.env.AI_DAILY_TOKEN_LIMIT_PREMIUM) || 50000;
  }

  /**
   * Get total tokens used today by a user (across all features)
   */
  getTotalTokensToday(userId: number): number {
    const date = getTodayDate();
    let totalTokens = 0;
    for (const [key, entry] of DAILY_USAGE.entries()) {
      if (key.startsWith(`${userId}:`) && key.endsWith(`:${date}`)) {
        totalTokens += entry.tokensIn + entry.tokensOut;
      }
    }
    return totalTokens;
  }

  /**
   * Check if user has exceeded their daily TOKEN limit (across all features)
   * Returns true if limit is reached.
   */
  isTokenLimitReached(userId: number, userPlan?: string): boolean {
    const totalTokens = this.getTotalTokensToday(userId);
    const limit = this.getDailyTokenLimit(userPlan);
    return totalTokens >= limit;
  }

  /**
   * Get remaining tokens for today
   */
  getRemainingDailyTokens(userId: number, userPlan?: string): number {
    const totalTokens = this.getTotalTokensToday(userId);
    const limit = this.getDailyTokenLimit(userPlan);
    return Math.max(0, limit - totalTokens);
  }

  /** Get daily request limit for a specific feature and plan */
  getDailyLimit(feature?: FeatureType | string, userPlan?: string): number {
    const normalized = (userPlan || "FREE").toUpperCase();

    if (normalized === "FREE" || normalized === "") {
      if (feature && this.FREE_FEATURE_LIMITS[feature]) {
        return this.FREE_FEATURE_LIMITS[feature]!;
      }
      return Number(process.env.AI_DAILY_LIMIT_FREE) || 50;
    }

    // Premium and above
    if (feature && this.PREMIUM_FEATURE_LIMITS[feature]) {
      return this.PREMIUM_FEATURE_LIMITS[feature]!;
    }
    return Number(process.env.AI_DAILY_LIMIT_PREMIUM) || 500;
  }

  /** Check if user has exceeded their daily request limit (per-feature) */
  isLimitReached(userId: number, userPlan?: string, feature?: FeatureType | string): boolean {
    if (feature) {
      const todayCount = this.getTodayCount(userId, feature as FeatureType);
      const limit = this.getDailyLimit(feature, userPlan);
      return todayCount >= limit;
    }
    const totalToday = this.getTotalToday(userId);
    const limit = this.getDailyLimit(undefined, userPlan);
    return totalToday >= limit;
  }

  /** Get remaining requests for today (per-feature) */
  getRemaining(userId: number, userPlan?: string, feature?: FeatureType | string): number {
    if (feature) {
      const todayCount = this.getTodayCount(userId, feature as FeatureType);
      const limit = this.getDailyLimit(feature, userPlan);
      return Math.max(0, limit - todayCount);
    }
    const totalToday = this.getTotalToday(userId);
    const limit = this.getDailyLimit(undefined, userPlan);
    return Math.max(0, limit - totalToday);
  }

  /** Get all usage entries for today (for analytics) */
  getAllTodayEntries(): UsageEntry[] {
    const date = getTodayDate();
    const entries: UsageEntry[] = [];
    for (const [, entry] of DAILY_USAGE.entries()) {
      if (entry.date === date) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /** Get usage stats per feature for today */
  getFeatureStats(): Record<FeatureType, number> {
    const date = getTodayDate();
    const stats: Record<string, number> = {};

    for (const [, entry] of DAILY_USAGE.entries()) {
      if (entry.date === date) {
        stats[entry.feature] = (stats[entry.feature] || 0) + entry.count;
      }
    }

    return stats as Record<FeatureType, number>;
  }

  /** Reset all in-memory counters (useful for testing) */
  reset(): void {
    DAILY_USAGE.clear();
    log.debug("Usage tracker reset");
  }
}

/** Singleton usage tracker */
export const usageTracker = new UsageTracker();

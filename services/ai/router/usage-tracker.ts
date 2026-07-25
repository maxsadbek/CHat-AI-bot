/**
 * AI Router - Daily Usage Tracker
 * Tracks per-user daily usage across features with separate free/premium limits.
 * Integrates with the existing usageService for database-backed tracking.
 *
 * Limits:
 * - Free users: 50 requests/day (default, configurable via AI_DAILY_LIMIT_FREE)
 * - Premium users: 500 requests/day (default, configurable via AI_DAILY_LIMIT_PREMIUM)
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

  /** Get daily limit based on user plan (FREE vs PREMIUM) */
  getDailyLimit(userPlan?: string): number {
    const normalized = (userPlan || "FREE").toUpperCase();
    if (normalized === "FREE") {
      return Number(process.env.AI_DAILY_LIMIT_FREE) || 50;
    }
    // Premium and above
    return Number(process.env.AI_DAILY_LIMIT_PREMIUM) || 500;
  }

  /** Check if user has exceeded their daily limit */
  isLimitReached(userId: number, userPlan?: string): boolean {
    const totalToday = this.getTotalToday(userId);
    const limit = this.getDailyLimit(userPlan);
    return totalToday >= limit;
  }

  /** Get remaining requests for today */
  getRemaining(userId: number, userPlan?: string): number {
    const totalToday = this.getTotalToday(userId);
    const limit = this.getDailyLimit(userPlan);
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

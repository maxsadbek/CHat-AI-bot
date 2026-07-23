/**
 * Usage Repository
 * Analytics and usage data access layer.
 * Supports feature tracking, provider tracking, daily stats, and premium analytics.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("usage-repo");

export interface TrackUsageData {
  userId: number;
  feature: string;
  provider?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export class UsageRepository {
  /**
   * Track a usage event
   */
  async track(data: TrackUsageData) {
    try {
      return await prisma.usage.create({
        data: {
          userId: data.userId,
          feature: data.feature,
          provider: data.provider ?? null,
          model: data.model ?? null,
          tokensIn: data.tokensIn ?? 0,
          tokensOut: data.tokensOut ?? 0,
        },
      });
    } catch (error) {
      log.error("Error tracking usage", { error: String(error) });
      throw error;
    }
  }

  // ─── Basic Counts ─────────────────────────────────

  /**
   * Get total usage count, optionally filtered by date
   */
  async getTotalRequests(since?: Date): Promise<number> {
    try {
      return await prisma.usage.count({
        where: since ? { createdAt: { gte: since } } : {},
      });
    } catch (error) {
      log.error("Error getting total requests", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get total messages (chat feature usage)
   */
  async getTotalMessages(since?: Date): Promise<number> {
    try {
      return await prisma.usage.count({
        where: {
          feature: "chat",
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      });
    } catch (error) {
      log.error("Error getting total messages", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get usage count for a specific feature
   */
  async getFeatureUsage(feature: string, since?: Date): Promise<number> {
    try {
      return await prisma.usage.count({
        where: {
          feature,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      });
    } catch (error) {
      log.error("Error getting feature usage", { feature, error: String(error) });
      throw error;
    }
  }

  /**
   * Get total tokens used
   */
  async getTotalTokens(since?: Date): Promise<{ tokensIn: number; tokensOut: number }> {
    try {
      const result = await prisma.usage.aggregate({
        _sum: { tokensIn: true, tokensOut: true },
        where: since ? { createdAt: { gte: since } } : {},
      });
      return {
        tokensIn: result._sum.tokensIn ?? 0,
        tokensOut: result._sum.tokensOut ?? 0,
      };
    } catch (error) {
      log.error("Error getting total tokens", { error: String(error) });
      return { tokensIn: 0, tokensOut: 0 };
    }
  }

  // ─── Feature Analysis ─────────────────────────────

  /**
   * Get top features by usage count
   */
  async getTopFeatures(since: Date, limit = 10) {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["feature"],
        _count: true,
        where: { createdAt: { gte: since } },
        orderBy: { _count: { feature: "desc" } },
        take: limit,
      });
      return usage.map((u) => ({ feature: u.feature, count: u._count }));
    } catch (error) {
      log.error("Error getting top features", { error: String(error) });
      return [];
    }
  }

  /**
   * Get usage breakdown by feature for a date range
   */
  async getFeatureBreakdown(since: Date): Promise<Array<{ feature: string; count: number; tokensIn: number; tokensOut: number }>> {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["feature"],
        _count: true,
        _sum: { tokensIn: true, tokensOut: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { feature: "desc" } },
      });
      return usage.map((u) => ({
        feature: u.feature,
        count: u._count,
        tokensIn: u._sum.tokensIn ?? 0,
        tokensOut: u._sum.tokensOut ?? 0,
      }));
    } catch (error) {
      log.error("Error getting feature breakdown", { error: String(error) });
      return [];
    }
  }

  // ─── Provider Analysis ────────────────────────────

  /**
   * Get provider usage breakdown
   */
  async getProviderBreakdown(since?: Date): Promise<Array<{ provider: string; count: number }>> {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["provider"],
        _count: true,
        where: {
          provider: { not: null },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { _count: { provider: "desc" } },
      });
      return usage.map((u) => ({
        provider: u.provider ?? "unknown",
        count: u._count,
      }));
    } catch (error) {
      log.error("Error getting provider breakdown", { error: String(error) });
      return [];
    }
  }

  /**
   * Get model usage breakdown
   */
  async getModelBreakdown(since?: Date): Promise<Array<{ model: string; count: number }>> {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["model"],
        _count: true,
        where: {
          model: { not: null },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { _count: { model: "desc" } },
      });
      return usage.map((u) => ({
        model: u.model ?? "unknown",
        count: u._count,
      }));
    } catch (error) {
      log.error("Error getting model breakdown", { error: String(error) });
      return [];
    }
  }

  // ─── Daily Analytics ──────────────────────────────

  /**
   * Get daily usage stats for the last N days
   */
  async getDailyStats(days = 30): Promise<Array<{ date: string; count: number; users: number }>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      // Get usage counts per day
      const usage = await prisma.usage.groupBy({
        by: ["createdAt"],
        _count: true,
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
      });

      // Group by date string
      const dailyMap = new Map<string, { count: number; users: Set<number> }>();

      // Also get unique users per day from usage records
      const records = await prisma.usage.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      for (const r of records) {
        const dateKey = r.createdAt.toISOString().slice(0, 10);
        const entry = dailyMap.get(dateKey) ?? { count: 0, users: new Set() };
        entry.count++;
        entry.users.add(r.userId);
        dailyMap.set(dateKey, entry);
      }

      return Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          users: data.users.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      log.error("Error getting daily stats", { error: String(error) });
      return [];
    }
  }

  // ─── User-Specific Analytics ──────────────────────

  /**
   * Get usage stats for a specific user
   */
  async getUserUsageStats(userId: number, since?: Date) {
    try {
      const where = {
        userId,
        ...(since ? { createdAt: { gte: since } } : {}),
      };

      const [total, features, providerUsage] = await Promise.all([
        prisma.usage.count({ where }),
        prisma.usage.groupBy({
          by: ["feature"],
          _count: true,
          where,
          orderBy: { _count: { feature: "desc" } },
        }),
        prisma.usage.groupBy({
          by: ["provider"],
          _count: true,
          where: { ...where, provider: { not: null } },
          orderBy: { _count: { provider: "desc" } },
        }),
      ]);

      return {
        total,
        features: features.map((f) => ({ feature: f.feature, count: f._count })),
        providers: providerUsage.map((p) => ({ provider: p.provider!, count: p._count })),
      };
    } catch (error) {
      log.error("Error getting user usage stats", { userId, error: String(error) });
      return { total: 0, features: [], providers: [] };
    }
  }

  // ─── Premium Analytics ────────────────────────────

  /**
   * Get premium subscription stats
   */
  async getPremiumStats() {
    try {
      const [totalPremium, byPlan, byBilling] = await Promise.all([
        prisma.user.count({ where: { isPremium: true } }),
        prisma.subscription.groupBy({
          by: ["planType"],
          _count: true,
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
        }),
        prisma.subscription.groupBy({
          by: ["billingPeriod"],
          _count: true,
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
        }),
      ]);

      return {
        totalPremium,
        byPlan: byPlan.map((p) => ({ plan: p.planType, count: p._count })),
        byBilling: byBilling.map((b) => ({ period: b.billingPeriod, count: b._count })),
      };
    } catch (error) {
      log.error("Error getting premium stats", { error: String(error) });
      return { totalPremium: 0, byPlan: [], byBilling: [] };
    }
  }

  /**
   * Get conversion rate (premium / total users)
   */
  async getConversionRate(): Promise<{ free: number; premium: number; rate: number }> {
    try {
      const [total, premium] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isPremium: true } }),
      ]);
      return {
        free: total - premium,
        premium,
        rate: total > 0 ? premium / total : 0,
      };
    } catch (error) {
      log.error("Error getting conversion rate", { error: String(error) });
      return { free: 0, premium: 0, rate: 0 };
    }
  }
}

export const usageRepository = new UsageRepository();

/**
 * Analytics Service
 * Comprehensive analytics aggregation for the admin dashboard.
 * Combines data from Usage, User, Subscription, and Message models.
 *
 * Used by: /api/admin/analytics/* routes
 */

import { usageRepository } from "@/repositories/usage";
import { userRepository } from "@/repositories/user";
import { logger } from "@/bot/core/logger";
import { prisma } from "@/lib/prisma";

const log = logger.child("analytics-service");

export class AnalyticsService {
  /**
   * Main dashboard overview — one call to populate the entire dashboard
   */
  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    thisWeek.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(thisMonth.getDate() - 30);
    thisMonth.setHours(0, 0, 0, 0);

    try {
      const [
        totalUsers,
        activeToday,
        activeThisWeek,
        activeThisMonth,
        newUsersToday,
        totalRequests,
        requestsToday,
        requestsThisWeek,
        requestsThisMonth,
        messagesToday,
        imagesToday,
        videosToday,
        premiumStats,
        conversionRate,
        topFeatures,
        totalTokens,
        dailyTrend,
      ] = await Promise.all([
        // Users
        userRepository.countTotal(),
        userRepository.countActiveToday(),
        userRepository.countActiveSince(thisWeek),
        userRepository.countActiveSince(thisMonth),
        userRepository.countNewSince(today),

        // Requests
        usageRepository.getTotalRequests(),
        usageRepository.getTotalRequests(today),
        usageRepository.getTotalRequests(thisWeek),
        usageRepository.getTotalRequests(thisMonth),

        // Feature counts today
        usageRepository.getFeatureUsage("chat", today),
        usageRepository.getFeatureUsage("image", today),
        usageRepository.getFeatureUsage("video", today),

        // Premium
        usageRepository.getPremiumStats(),
        usageRepository.getConversionRate(),

        // Top features today
        usageRepository.getTopFeatures(today, 10),

        // Tokens
        usageRepository.getTotalTokens(),

        // Daily trend for last 30 days
        usageRepository.getDailyStats(30),
      ]);

      return {
        users: {
          total: totalUsers,
          activeToday,
          activeThisWeek,
          activeThisMonth,
          newToday: newUsersToday,
        },
        usage: {
          total: totalRequests,
          today: requestsToday,
          thisWeek: requestsThisWeek,
          thisMonth: requestsThisMonth,
        },
        features: {
          messagesToday,
          imagesToday,
          videosToday,
          topFeatures,
        },
        tokens: totalTokens,
        premium: premiumStats,
        conversion: conversionRate,
        dailyTrend,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      log.error("Failed to get analytics overview", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get provider analytics
   */
  async getProviderAnalytics(since?: Date) {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    monthAgo.setHours(0, 0, 0, 0);

    const start = since ?? monthAgo;

    const [providerBreakdown, modelBreakdown] = await Promise.all([
      usageRepository.getProviderBreakdown(start),
      usageRepository.getModelBreakdown(start),
    ]);

    return {
      period: { from: start.toISOString(), to: new Date().toISOString() },
      byProvider: providerBreakdown,
      byModel: modelBreakdown,
    };
  }

  /**
   * Get user growth stats
   */
  async getUserGrowth(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    try {
      const users = await prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, isPremium: true },
        orderBy: { createdAt: "asc" },
      });

      // Group by date
      const dailyMap = new Map<string, { total: number; premium: number }>();
      for (const u of users) {
        const dateKey = u.createdAt.toISOString().slice(0, 10);
        const entry = dailyMap.get(dateKey) ?? { total: 0, premium: 0 };
        entry.total++;
        if (u.isPremium) entry.premium++;
        dailyMap.set(dateKey, entry);
      }

      return Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          newUsers: data.total,
          newPremium: data.premium,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      log.error("Failed to get user growth", { error: String(error) });
      return [];
    }
  }

  /**
   * Get retention stats — users active on consecutive days
   */
  async getRetentionStats(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    try {
      const users = await prisma.user.findMany({
        where: { lastActiveAt: { gte: since } },
        select: { createdAt: true, lastActiveAt: true },
      });

      const retained = users.filter(
        (u) => u.lastActiveAt.getTime() - u.createdAt.getTime() > 24 * 60 * 60 * 1000
      );

      return {
        totalActive: users.length,
        returned: retained.length,
        retentionRate: users.length > 0 ? retained.length / users.length : 0,
      };
    } catch (error) {
      log.error("Failed to get retention stats", { error: String(error) });
      return { totalActive: 0, returned: 0, retentionRate: 0 };
    }
  }

  /**
   * Get hourly activity distribution (for peak usage times)
   */
  async getHourlyDistribution(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    try {
      const records = await prisma.usage.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      });

      const hourly = new Array(24).fill(0);
      for (const r of records) {
        const hour = r.createdAt.getHours();
        hourly[hour]++;
      }

      return hourly.map((count, hour) => ({
        hour,
        count,
        label: `${hour.toString().padStart(2, "0")}:00`,
      }));
    } catch (error) {
      log.error("Failed to get hourly distribution", { error: String(error) });
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();

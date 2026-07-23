/**
 * Usage Service
 * Analytics and usage tracking for monitoring bot activity.
 * Now supports provider/model tracking and comprehensive analytics.
 */

import { usageRepository } from "@/repositories/usage";
import { userRepository } from "@/repositories/user";
import { logger } from "@/bot/core/logger";

const log = logger.child("usage-service");

export class UsageService {
  /**
   * Track a feature usage event with optional provider/model info
   */
  async track(
    userId: number,
    feature: string,
    tokensIn = 0,
    tokensOut = 0,
    provider?: string,
    model?: string
  ) {
    try {
      await Promise.all([
        usageRepository.track({ userId, feature, tokensIn, tokensOut, provider, model }),
        userRepository.incrementRequests(userId),
      ]);
    } catch (error) {
      log.error("Failed to track usage", { userId, feature, error: String(error) });
    }
  }

  /**
   * Get total usage stats for admin dashboard
   */
  async getAdminStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [totalUsers, activeToday, totalRequests, requestsToday, topFeatures] =
        await Promise.all([
          userRepository.countTotal(),
          userRepository.countActiveToday(),
          usageRepository.getTotalRequests(),
          usageRepository.getTotalRequests(today),
          usageRepository.getTopFeatures(today),
        ]);

      return {
        totalUsers,
        activeUsersToday: activeToday,
        totalRequests,
        requestsToday,
        topFeatures,
      };
    } catch (error) {
      log.error("Failed to get admin stats", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get feature usage for a specific period
   */
  async getFeatureUsage(feature: string, since: Date) {
    return await usageRepository.getFeatureUsage(feature, since);
  }

  /**
   * Get daily usage stats for charts
   */
  async getDailyStats(days = 30) {
    return await usageRepository.getDailyStats(days);
  }

  /**
   * Get provider usage breakdown
   */
  async getProviderStats(since?: Date) {
    return await usageRepository.getProviderBreakdown(since);
  }

  /**
   * Get model usage breakdown
   */
  async getModelStats(since?: Date) {
    return await usageRepository.getModelBreakdown(since);
  }

  /**
   * Get premium subscription analytics
   */
  async getPremiumStats() {
    return await usageRepository.getPremiumStats();
  }

  /**
   * Get conversion rate (free → premium)
   */
  async getConversionRate() {
    return await usageRepository.getConversionRate();
  }

  /**
   * Get feature breakdown with tokens
   */
  async getFeatureBreakdown(since: Date) {
    return await usageRepository.getFeatureBreakdown(since);
  }

  /**
   * Get total token usage
   */
  async getTokenStats(since?: Date) {
    return await usageRepository.getTotalTokens(since);
  }

  /**
   * Get stats for a specific user
   */
  async getUserStats(userId: number, since?: Date) {
    return await usageRepository.getUserUsageStats(userId, since);
  }

  /**
   * Reset daily counters (for cron job)
   */
  async resetDailyCounters() {
    return await userRepository.resetDailyCounters();
  }
}

export const usageService = new UsageService();

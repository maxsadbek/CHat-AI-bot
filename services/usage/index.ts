/**
 * Usage Service
 * Analytics and usage tracking for monitoring bot activity.
 */

import { usageRepository } from "@/repositories/usage";
import { userRepository } from "@/repositories/user";
import { logger } from "@/bot/core/logger";

const log = logger.child("usage-service");

export class UsageService {
  /**
   * Track a feature usage event
   */
  async track(userId: number, feature: string, tokensIn = 0, tokensOut = 0) {
    try {
      await Promise.all([
        usageRepository.track({ userId, feature, tokensIn, tokensOut }),
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
   * Reset daily counters (for cron job)
   */
  async resetDailyCounters() {
    return await userRepository.resetDailyCounters();
  }
}

export const usageService = new UsageService();

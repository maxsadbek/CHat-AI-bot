/**
 * User Service
 * Orchestrates user operations with business logic,
 * using repositories for data access.
 */

import { userRepository } from "@/repositories/user";
import { userSettingsRepository } from "@/repositories/settings";
import { subscriptionRepository } from "@/repositories/subscription";
import { usageRepository } from "@/repositories/usage";
import { getDailyLimit, SUBSCRIPTION_PLANS, type PlanId } from "@/config/plans";
import { logger } from "@/bot/core/logger";
import { isAdmin } from "@/services/admin/admin-guard";

const log = logger.child("user-service");

export class UserService {
  /**
   * Find or create user by Telegram info.
   * Returns { user, created } — "created: true" on first signup,
   * which the /start handler uses to attribute referrals.
   */
  async findOrCreate(from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }) {
    const isUserAdmin = isAdmin(from.id);
    const dailyLimit = isUserAdmin
      ? 999999
      : getDailyLimit("free");

    return await userRepository.upsertByTelegramId(BigInt(from.id), {
      telegramId: BigInt(from.id),
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      languageCode: from.language_code,
      dailyLimit,
    });
  }

  /**
   * Get the user's remaining referral bonus requests
   */
  async getBonusRequests(userId: number): Promise<number> {
    return await userRepository.getBonusRequests(userId);
  }

  /**
   * Get full profile for a user by Telegram ID
   */
  async getProfile(telegramId: bigint) {
    return await userRepository.findByTelegramId(telegramId);
  }

  /**
   * Get full profile for a user by internal Prisma ID.
   * PREFERRED: use this when ctx.session.userId is available.
   * Avoids BigInt conversion and uses the value already verified by middleware.
   */
  async getProfileById(userId: number) {
    return await userRepository.findById(userId);
  }

  /**
   * Track a request and increment counters
   */
  async trackRequest(userId: number, feature: string, tokensUsed?: { in: number; out: number }) {
    try {
      await Promise.all([
        userRepository.incrementRequests(userId),
        usageRepository.track({
          userId,
          feature,
          tokensIn: tokensUsed?.in,
          tokensOut: tokensUsed?.out,
        }),
      ]);
    } catch (error) {
      log.error("Failed to track request", { userId, feature, error: String(error) });
    }
  }

  /**
   * Check if user has reached daily limit
   */
  async checkDailyLimit(telegramId: bigint): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
  }> {
    if (isAdmin(telegramId)) {
      const user = await userRepository.findByTelegramId(telegramId);
      return {
        allowed: true,
        used: user?.requestsToday ?? 0,
        limit: 999999,
      };
    }

    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) {
      return { allowed: true, used: 0, limit: 50 };
    }

    // Referral bonus pool extends the daily allowance (consumed first)
    const effectiveLimit = (user.dailyLimit ?? 50) + (user.bonusRequests ?? 0);
    const isLimited = user.requestsToday >= effectiveLimit;
    return {
      allowed: !isLimited,
      used: user.requestsToday,
      limit: effectiveLimit,
    };
  }

  /**
   * Update user's language preference
   */
  async updateLanguage(userId: number, language: string) {
    return await userSettingsRepository.updateLanguage(userId, language);
  }

  /**
   * Get or create subscription info
   */
  async getSubscription(userId: number) {
    return await subscriptionRepository.findByUserId(userId);
  }

  /**
   * Upgrade user to a plan (payment-ready)
   */
  async upgradeToPlan(userId: number, planId: PlanId, paymentId?: string) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || !plan.isActive) {
      throw new Error(`Plan ${planId} is not available`);
    }

    // Update subscription
    await subscriptionRepository.upsert(userId, {
      tier: plan.id === "free" ? "free" : "pro",
      planType: plan.id,
      billingPeriod: plan.billingPeriod,
      dailyLimit: plan.limits.requestsPerDay,
      paymentId: paymentId ?? null,
    });

    // Update user premium status and daily limit
    await userRepository.update(userId, {
      isPremium: planId !== "free",
      dailyLimit: plan.limits.requestsPerDay,
    });

    log.info(`User ${userId} upgraded to ${planId}`, { paymentId });
  }
}

export const userService = new UserService();

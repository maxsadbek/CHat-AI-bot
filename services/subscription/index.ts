/**
 * Subscription Service
 * Payment-ready architecture for managing user subscriptions.
 * Supports: Free, Pro Monthly, Pro Yearly, Lifetime plans.
 *
 * Responsibilities:
 *   - Activate subscription
 *   - Cancel subscription
 *   - Check expiration
 *   - Get current plan
 *   - Downgrade expired users to FREE
 */

import { subscriptionRepository } from "@/repositories/subscription";
import { userRepository } from "@/repositories/user";
import {
  SUBSCRIPTION_PLANS,
  getActivePlans,
  getPlan,
  getTierFromPlan,
  calculateExpiry,
  getDailyLimit,
  type PlanId,
  type SubscriptionPlan,
  type BillingPeriod,
} from "@/config/plans";

import { logger } from "@/bot/core/logger";

const log = logger.child("subscription-service");

export interface SubscriptionInfo {
  id?: string;
  userId?: number;
  tier: string;
  planType: string;
  status?: string;
  billingPeriod: string;
  dailyLimit: number;
  startsAt?: Date;
  expiresAt?: Date | null;
  canceledAt?: Date | null;
  paymentId?: string | null;
  paymentProvider?: string | null;
}

export class SubscriptionService {
  /**
   * Get user's current plan info with full details
   */
  async getUserPlan(userId: number): Promise<{
    plan: SubscriptionPlan;
    isExpired: boolean;
    daysRemaining: number | null;
    isLifetime: boolean;
  }> {
    const sub = await subscriptionRepository.findByUserId(userId);

    // Determine the plan
    const planType = (sub?.planType ?? "free") as PlanId;
    const plan = SUBSCRIPTION_PLANS[planType] ?? SUBSCRIPTION_PLANS.free;

    // Check expiry
    if (!sub || !sub.expiresAt) {
      const isLifetime = planType === "lifetime";
      return { plan, isExpired: false, daysRemaining: null, isLifetime };
    }

    const now = new Date();
    const isExpired = sub.expiresAt < now || sub.status === "EXPIRED";
    const daysRemaining = isExpired
      ? 0
      : Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      plan,
      isExpired,
      daysRemaining: isExpired ? 0 : daysRemaining,
      isLifetime: planType === "lifetime",
    };
  }

  /**
   * Get the raw subscription record from DB
   */
  async getSubscription(userId: number): Promise<SubscriptionInfo | null> {
    const sub = await subscriptionRepository.findByUserId(userId);
    if (!sub) return null;

    return {
      id: sub.id,
      userId: sub.userId,
      tier: sub.tier,
      planType: sub.planType,
      status: sub.status,
      billingPeriod: sub.billingPeriod,
      dailyLimit: sub.dailyLimit,
      startsAt: sub.startsAt,
      expiresAt: sub.expiresAt,
      canceledAt: (sub as any).canceledAt, // TODO: Remove cast after prisma generate
      paymentId: sub.paymentId,
      paymentProvider: sub.paymentProvider,
    };
  }

  /**
   * Activate subscription for a user
   */
  async activateSubscription(
    userId: number,
    planId: PlanId,
    paymentId?: string,
    paymentProvider?: string
  ): Promise<void> {
    log.info("Activating subscription", { userId, planId, paymentId, paymentProvider });
    await this.upgrade(userId, planId, paymentId, paymentProvider);
  }

  /**
   * Cancel a user's subscription.
   * Sets status to CANCELED and records the cancellation date,
   * but keeps premium access until the expiry date.
   */
  async cancelSubscription(userId: number): Promise<SubscriptionInfo | null> {
    log.info("Canceling subscription", { userId });

    const sub = await subscriptionRepository.findByUserId(userId);
    if (!sub) {
      log.warn("No subscription found to cancel", { userId });
      return null;
    }

    if (sub.planType === "free") {
      log.warn("Cannot cancel free plan", { userId });
      return null;
    }

    try {
      await subscriptionRepository.upsert(userId, {
        tier: sub.tier,
        planType: sub.planType,
        billingPeriod: sub.billingPeriod,
        dailyLimit: sub.dailyLimit,
        expiresAt: sub.expiresAt,
        paymentId: sub.paymentId,
        paymentProvider: sub.paymentProvider,
        autoRenew: false,
        status: "CANCELED",
        canceledAt: new Date(),
      });

      log.info("Subscription canceled", { userId, planType: sub.planType });
      return await this.getSubscription(userId);
    } catch (error) {
      log.error("Error canceling subscription", { userId, error: String(error) });
      throw new Error(`Failed to cancel subscription: ${String(error)}`);
    }
  }

  /**
   * Check if a subscription has expired and update status if so.
   * Returns true if the subscription was just expired.
   */
  async checkExpiry(userId: number): Promise<boolean> {
    try {
      const sub = await subscriptionRepository.findByUserId(userId);
      if (!sub || !sub.expiresAt || sub.planType === "free" || sub.planType === "lifetime") {
        return false;
      }

      const now = new Date();
      if (sub.expiresAt < now && sub.status !== "EXPIRED") {
        await subscriptionRepository.upsert(userId, {
          tier: sub.tier,
          planType: sub.planType,
          billingPeriod: sub.billingPeriod,
          dailyLimit: sub.dailyLimit,
          expiresAt: sub.expiresAt,
          paymentId: sub.paymentId,
          paymentProvider: sub.paymentProvider,
          autoRenew: sub.autoRenew,
          status: "EXPIRED",
        });
        log.info("Subscription marked as expired", { userId, planType: sub.planType });
        return true;
      }

      return false;
    } catch (error) {
      log.error("Error checking subscription expiry", { userId, error: String(error) });
      return false;
    }
  }

  /**
   * Check if a subscription has expired and downgrade if needed
   */
  async checkAndHandleExpiry(userId: number): Promise<boolean> {
    try {
      const { isExpired, plan } = await this.getUserPlan(userId);
      if (isExpired && plan.id !== "free") {
        await this.downgrade(userId);
        log.info(`User ${userId} auto-downgraded due to expiry`);
        return true;
      }
      return false;
    } catch (error) {
      log.error("Error checking subscription expiry", { userId, error: String(error) });
      return false;
    }
  }

  /**
   * Downgrade expired users to FREE plan.
   * Finds all expired subscriptions and downgrades them.
   * Should be called periodically (e.g., via cron job).
   */
  async downgradeExpiredUsers(): Promise<number> {
    log.info("Running downgradeExpiredUsers check");

    try {
      const now = new Date();
      const expiredSubs = await subscriptionRepository.findExpired(now);

      log.info(`Found ${expiredSubs.length} expired subscriptions to downgrade`);

      let downgraded = 0;
      for (const sub of expiredSubs) {
        try {
          await this.downgrade(sub.userId);
          downgraded++;
        } catch (error) {
          log.error("Error downgrading expired user", {
            userId: sub.userId,
            error: String(error),
          });
        }
      }

      if (downgraded > 0) {
        log.info(`Downgraded ${downgraded} expired users to FREE`);
      }

      return downgraded;
    } catch (error) {
      log.error("Error in downgradeExpiredUsers", { error: String(error) });
      return 0;
    }
  }

  /**
   * Get current plan for a user
   */
  async getCurrentPlan(userId: number): Promise<{
    planId: PlanId;
    plan: SubscriptionPlan;
    status: string;
    isExpired: boolean;
    daysRemaining: number | null;
    expiresAt: Date | null;
  }> {
    const sub = await subscriptionRepository.findByUserId(userId);
    const planType = (sub?.planType ?? "free") as PlanId;
    const plan = SUBSCRIPTION_PLANS[planType] ?? SUBSCRIPTION_PLANS.free;

    let isExpired = false;
    let daysRemaining: number | null = null;

    if (sub?.expiresAt && planType !== "lifetime" && planType !== "free") {
      const now = new Date();
      isExpired = sub.expiresAt < now || sub.status === "EXPIRED";
      daysRemaining = isExpired
        ? 0
        : Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      planId: planType,
      plan,
      status: sub?.status ?? "ACTIVE",
      isExpired,
      daysRemaining,
      expiresAt: sub?.expiresAt ?? null,
    };
  }

  /**
   * Upgrade user to a new plan
   */
  async upgrade(
    userId: number,
    planId: PlanId,
    paymentId?: string,
    paymentProvider?: string
  ) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) throw new Error(`Plan "${planId}" not found`);
    if (!plan.isActive) throw new Error(`Plan "${planId}" is not available`);

    const tier = getTierFromPlan(planId);
    const expiresAt = calculateExpiry(plan.billingPeriod);

    // Save subscription to DB
    await subscriptionRepository.upsert(userId, {
      tier,
      planType: planId,
      billingPeriod: plan.billingPeriod,
      dailyLimit: plan.limits.requestsPerDay,
      expiresAt,
      paymentId: paymentId ?? null,
      paymentProvider: paymentProvider ?? null,
      autoRenew: plan.billingPeriod === "monthly" || plan.billingPeriod === "yearly",
      status: "ACTIVE",
    });

    // Update user record
    await userRepository.update(userId, {
      isPremium: planId !== "free",
      dailyLimit: plan.limits.requestsPerDay,
    });

    log.info(`User ${userId} upgraded to ${planId}`, { paymentId, paymentProvider });
  }

  /**
   * Downgrade user back to Free plan
   */
  async downgrade(userId: number) {
    const freePlan = SUBSCRIPTION_PLANS.free;

    await subscriptionRepository.upsert(userId, {
      tier: "free",
      planType: "free",
      billingPeriod: "none",
      dailyLimit: freePlan.limits.requestsPerDay,
      expiresAt: null,
      paymentId: null,
      paymentProvider: null,
      autoRenew: false,
      status: "ACTIVE",
    });

    await userRepository.update(userId, {
      isPremium: false,
      dailyLimit: freePlan.limits.requestsPerDay,
    });

    log.info(`User ${userId} downgraded to free`);
  }

  /**
   * Get all available plans
   */
  getAvailablePlans(): SubscriptionPlan[] {
    return getActivePlans();
  }

  /**
   * Get a specific plan's details
   */
  getPlan(planId: PlanId): SubscriptionPlan | undefined {
    return getPlan(planId);
  }

  /**
   * Check if a plan is the user's current plan or better
   */
  async hasAccessToFeature(
    userId: number,
    featureFlag: keyof SubscriptionPlan
  ): Promise<boolean> {
    const { plan } = await this.getUserPlan(userId);
    const value = plan[featureFlag];
    if (typeof value === "boolean") return value;
    return false;
  }

  /**
   * Payment integration — create a checkout session.
   * Delegates to paymentService for real implementation.
   */
  async createPaymentSession(
    userId: number,
    planId: PlanId
  ): Promise<{ url?: string; sessionId: string }> {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || !plan.isActive) {
      throw new Error(`Plan ${planId} is not available`);
    }

    log.info("Payment session requested", { userId, planId, amount: plan.price.amount });

    // Delegates to paymentService
    // const provider = paymentRegistry.getDefaultProvider();
    // return provider.createPayment({ ... });

    return {
      url: undefined,
      sessionId: `placeholder_${userId}_${planId}_${Date.now()}`,
    };
  }

  /**
   * Activate subscription after successful payment
   */
  async activateAfterPayment(
    userId: number,
    planId: PlanId,
    paymentId: string,
    paymentProvider?: string
  ) {
    log.info("Activating subscription after payment", {
      userId, planId, paymentId, paymentProvider,
    });
    await this.upgrade(userId, planId, paymentId, paymentProvider);
  }
}

export const subscriptionService = new SubscriptionService();

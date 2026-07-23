/**
 * Subscription Service
 * Payment-ready architecture for managing user subscriptions.
 * Handles plan validation, upgrades, and payment integration points.
 */

import { subscriptionRepository } from "@/repositories/subscription";
import { userRepository } from "@/repositories/user";
import {
  SUBSCRIPTION_PLANS,
  getDailyLimit,
  canUpgrade,
  getActivePlans,
  type PlanId,
  type SubscriptionPlan,
} from "@/config/plans";
import { logger } from "@/bot/core/logger";

const log = logger.child("subscription-service");

export class SubscriptionService {
  /**
   * Get user's current plan info
   */
  async getUserPlan(userId: number): Promise<{
    plan: SubscriptionPlan;
    isExpired: boolean;
    daysRemaining: number | null;
  }> {
    const sub = await subscriptionRepository.findByUserId(userId);
    const user = await userRepository.findById(userId);

    const planId: PlanId = user?.isPremium ? "premium" : "free";
    const plan = SUBSCRIPTION_PLANS[planId];

    if (!sub || !sub.expiresAt) {
      return { plan, isExpired: false, daysRemaining: null };
    }

    const now = new Date();
    const isExpired = sub.expiresAt < now;
    const daysRemaining = isExpired
      ? 0
      : Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return { plan, isExpired, daysRemaining };
  }

  /**
   * Upgrade user to a new plan
   * @param userId - Internal user ID
   * @param planId - Target plan
   * @param paymentId - Payment provider transaction ID (optional for free plans)
   */
  async upgrade(userId: number, planId: PlanId, paymentId?: string) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      throw new Error(`Plan "${planId}" not found`);
    }

    if (!plan.isActive) {
      throw new Error(`Plan "${planId}" is not yet available`);
    }

    // For paid plans, require payment ID
    if (plan.price.monthly > 0 && !paymentId) {
      // Payment integration point:
      // Here you would create a payment session with Stripe/Telegram Stars/etc.
      log.info("Payment required for upgrade", { userId, planId });
      // For now, allow upgrade without payment for development
    }

    // Calculate subscription dates
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1); // Monthly by default

    // Save subscription
    await subscriptionRepository.upsert(userId, {
      tier: planId,
      dailyLimit: plan.limits.requestsPerDay,
      expiresAt,
      paymentId: paymentId ?? null,
    });

    // Update user record
    await userRepository.update(userId, {
      isPremium: planId !== "free",
      dailyLimit: plan.limits.requestsPerDay,
    });

    log.info(`User ${userId} upgraded to ${planId}`, { paymentId });
  }

  /**
   * Downgrade user to free plan
   */
  async downgrade(userId: number) {
    const freePlan = SUBSCRIPTION_PLANS.free;

    await subscriptionRepository.upsert(userId, {
      tier: "free",
      dailyLimit: freePlan.limits.requestsPerDay,
      expiresAt: null,
    });

    await userRepository.update(userId, {
      isPremium: false,
      dailyLimit: freePlan.limits.requestsPerDay,
    });

    log.info(`User ${userId} downgraded to free`);
  }

  /**
   * Check if user can upgrade to a plan
   */
  canUpgrade(currentTier: PlanId, targetTier: PlanId): boolean {
    return canUpgrade(currentTier, targetTier);
  }

  /**
   * Get all available plans
   */
  getAvailablePlans(): SubscriptionPlan[] {
    return getActivePlans();
  }

  /**
   * Get plan details
   */
  getPlan(planId: PlanId): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS[planId];
  }

  /**
   * Payment integration placeholder
   * Future: Integrate with Stripe, Telegram Stars, or other payment providers
   */
  async createPaymentSession(
    userId: number,
    planId: PlanId
  ): Promise<{ url: string; sessionId: string }> {
    // Payment integration point
    // Example with Stripe:
    // const session = await stripe.checkout.sessions.create({ ... });
    // return { url: session.url, sessionId: session.id };

    log.info("Payment session requested", { userId, planId });

    // Placeholder — replace with actual payment provider
    return {
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/payment/${planId}`,
      sessionId: `placeholder_${userId}_${planId}_${Date.now()}`,
    };
  }

  /**
   * Verify and activate subscription after payment
   */
  async activateAfterPayment(
    userId: number,
    planId: PlanId,
    paymentId: string
  ) {
    log.info("Activating subscription after payment", { userId, planId, paymentId });
    await this.upgrade(userId, planId, paymentId);
  }
}

export const subscriptionService = new SubscriptionService();

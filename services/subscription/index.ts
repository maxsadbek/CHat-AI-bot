/**
 * Subscription Service
 * Payment-ready architecture for managing user subscriptions.
 * Supports: Free, Pro Monthly, Pro Yearly, Lifetime plans.
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
    const user = await userRepository.findById(userId);

    // Determine the plan
    const planType = (sub?.planType ?? "free") as PlanId;
    const plan = SUBSCRIPTION_PLANS[planType] ?? SUBSCRIPTION_PLANS.free;

    // Check expiry
    if (!sub || !sub.expiresAt) {
      const isLifetime = planType === "lifetime";
      return { plan, isExpired: false, daysRemaining: null, isLifetime };
    }

    const now = new Date();
    const isExpired = sub.expiresAt < now;
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
   * Placeholder — ready for paymentRegistry integration.
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

    // TODO: Use paymentRegistry when payment providers are configured
    // import { paymentRegistry } from "@/services/payment";
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
}

export const subscriptionService = new SubscriptionService();

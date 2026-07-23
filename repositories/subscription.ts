import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("subscription-repo");

export class SubscriptionRepository {
  async findByUserId(userId: number) {
    try {
      return await prisma.subscription.findUnique({
        where: { userId },
      });
    } catch (error) {
      log.error("Error finding subscription", { userId, error: String(error) });
      throw error;
    }
  }

  async upsert(userId: number, data: {
    tier: string;
    planType: string;
    billingPeriod: string;
    dailyLimit: number;
    expiresAt?: Date | null;
    paymentId?: string | null;
    paymentProvider?: string | null;
    autoRenew?: boolean;
    status?: string;
    canceledAt?: Date | null;
  }) {
    try {
      return await prisma.subscription.upsert({
        where: { userId },
        update: {
          tier: data.tier,
          planType: data.planType,
          billingPeriod: data.billingPeriod,
          dailyLimit: data.dailyLimit,
          expiresAt: data.expiresAt ?? null,
          paymentId: data.paymentId ?? null,
          paymentProvider: data.paymentProvider ?? null,
          autoRenew: data.autoRenew ?? false,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.canceledAt !== undefined ? { canceledAt: data.canceledAt } : {}),
        },
        create: {
          userId,
          tier: data.tier,
          planType: data.planType,
          billingPeriod: data.billingPeriod,
          dailyLimit: data.dailyLimit,
          expiresAt: data.expiresAt ?? null,
          paymentId: data.paymentId ?? null,
          paymentProvider: data.paymentProvider ?? null,
          autoRenew: data.autoRenew ?? false,
          status: data.status ?? "ACTIVE",
          canceledAt: data.canceledAt ?? null,
        },
      });
    } catch (error) {
      log.error("Error upserting subscription", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Find all subscriptions with expired non-free, non-lifetime plans
   */
  async findExpired(now: Date) {
    try {
      return await prisma.subscription.findMany({
        where: {
          planType: { notIn: ["free", "lifetime"] },
          expiresAt: { lt: now },
          status: { not: "EXPIRED" },
        },
        select: { userId: true, planType: true, id: true },
      });
    } catch (error) {
      log.error("Error finding expired subscriptions", { error: String(error) });
      throw error;
    }
  }

  /**
   * Count subscriptions by plan type
   */
  async countByPlanType(planType: string): Promise<number> {
    try {
      return await prisma.subscription.count({ where: { planType } });
    } catch (error) {
      log.error("Error counting subscription plan type", { planType, error: String(error) });
      throw error;
    }
  }

  /**
   * Count subscriptions by tier
   */
  async countByTier(tier: string): Promise<number> {
    try {
      return await prisma.subscription.count({ where: { tier } });
    } catch (error) {
      log.error("Error counting subscription tier", { tier, error: String(error) });
      throw error;
    }
  }

  /**
   * Count subscriptions by status
   */
  async countByStatus(status: string): Promise<number> {
    try {
      return await prisma.subscription.count({ where: { status } });
    } catch (error) {
      log.error("Error counting subscription by status", { status, error: String(error) });
      throw error;
    }
  }
}

export const subscriptionRepository = new SubscriptionRepository();

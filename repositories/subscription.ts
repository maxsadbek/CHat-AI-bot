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
    dailyLimit: number;
    expiresAt?: Date | null;
    paymentId?: string | null;
  }) {
    try {
      return await prisma.subscription.upsert({
        where: { userId },
        update: {
          tier: data.tier,
          dailyLimit: data.dailyLimit,
          expiresAt: data.expiresAt ?? null,
          paymentId: data.paymentId ?? null,
        },
        create: {
          userId,
          tier: data.tier,
          dailyLimit: data.dailyLimit,
          expiresAt: data.expiresAt ?? null,
          paymentId: data.paymentId ?? null,
        },
      });
    } catch (error) {
      log.error("Error upserting subscription", { userId, error: String(error) });
      throw error;
    }
  }

  async countByTier(tier: string): Promise<number> {
    try {
      return await prisma.subscription.count({ where: { tier } });
    } catch (error) {
      log.error("Error counting subscription tier", { tier, error: String(error) });
      throw error;
    }
  }
}

export const subscriptionRepository = new SubscriptionRepository();

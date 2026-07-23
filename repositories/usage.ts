import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("usage-repo");

export class UsageRepository {
  async track(data: {
    userId: number;
    feature: string;
    tokensIn?: number;
    tokensOut?: number;
  }) {
    try {
      return await prisma.usage.create({ data });
    } catch (error) {
      log.error("Error tracking usage", { error: String(error) });
      throw error;
    }
  }

  async getFeatureUsage(feature: string, since: Date) {
    try {
      return await prisma.usage.count({
        where: { feature, createdAt: { gte: since } },
      });
    } catch (error) {
      log.error("Error getting feature usage", { feature, error: String(error) });
      throw error;
    }
  }

  async getUserFeatureUsage(userId: number, feature: string, since: Date) {
    try {
      return await prisma.usage.count({
        where: { userId, feature, createdAt: { gte: since } },
      });
    } catch (error) {
      log.error("Error getting user feature usage", { userId, feature, error: String(error) });
      throw error;
    }
  }

  async getTotalRequests(since?: Date) {
    try {
      return await prisma.usage.count({
        where: since ? { createdAt: { gte: since } } : {},
      });
    } catch (error) {
      log.error("Error getting total requests", { error: String(error) });
      throw error;
    }
  }

  async getTopFeatures(since: Date, limit = 5) {
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
      throw error;
    }
  }
}

export const usageRepository = new UsageRepository();

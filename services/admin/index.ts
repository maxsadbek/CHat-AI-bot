/**
 * Admin Service — Consolidated Entry Point
 * Re-exports all admin functionality from specialized modules.
 * Also maintains backward compatibility with existing imports.
 */

import { prisma } from "@/lib/prisma";
import type { AdminStats, AdminLog } from "@/types";
import { isAdmin, logAdminAction } from "./admin-guard";
import { userManagementService } from "./user-management";
import { premiumManagementService } from "./premium-management";
import { systemHealthService } from "./health";

export { isAdmin, logAdminAction } from "./admin-guard";
export { userManagementService } from "./user-management";
export { premiumManagementService } from "./premium-management";
export { systemHealthService, type HealthCheckResult, type ComponentHealth } from "./health";

/**
 * Admin Service
 * Handles admin panel operations, statistics, and management.
 * For specialized operations, import the specific module directly.
 */
export class AdminService {
  /** Check if a user is an admin */
  isAdmin(telegramId: number): boolean {
    return isAdmin(telegramId);
  }

  /** Log an admin action */
  async logAction(adminId: number, action: string, details = ""): Promise<void> {
    return logAdminAction(adminId, action, details);
  }

  /**
   * Get enhanced dashboard statistics with:
   * - Granular feature counts (chat, images, videos, coding, social, business, translate)
   * - Most Used AI Provider
   * - Today's New Users
   * - Payment overview (pending, approved, rejected, revenue)
   */
  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const thisMonthStart = new Date(todayStart);
    thisMonthStart.setDate(thisMonthStart.getDate() - 30);

    const [
      totalUsers,
      activeToday,
      newUsersToday,
      totalRequests,
      todayRequests,
      premiumUsers,
      // Feature-specific counts today
      chatRequests,
      imageRequests,
      videoRequests,
      codingRequests,
      socialRequests,
      businessRequests,
      translateRequests,
      // Provider breakdown
      providerBreakdown,
      topFeatures,
      // Payment stats
      paymentsPending,
      paymentsApproved,
      paymentsFailed,
      revenueResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { isPremium: true } }),

      // Feature counts today
      this.getFeatureUsageCount("chat", todayStart),
      this.getFeatureUsageCount("image", todayStart),
      this.getFeatureUsageCount("video", todayStart),
      this.getFeatureUsageCount("coding", todayStart),
      this.getFeatureUsageCount("social", todayStart),
      this.getFeatureUsageCount("business", todayStart),
      this.getFeatureUsageCount("translate", todayStart),

      // Provider breakdown (all time)
      this.getProviderUsage(),
      this.getTopFeatures(todayStart),

      // Payment stats
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "SUCCESS" } }),
      prisma.payment.count({ where: { status: "FAILED" } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "SUCCESS" },
      }),
    ]);

    // Determine most used provider
    const mostUsedProvider = providerBreakdown.length > 0
      ? providerBreakdown[0]!.provider
      : null;

    return {
      totalUsers,
      activeUsersToday: activeToday,
      totalRequests,
      requestsToday: todayRequests,
      premiumUsers,
      topFeatures,

      // Granular feature counts
      chatRequests,
      imageRequests,
      videoRequests,
      codingRequests,
      socialRequests,
      businessRequests,
      translateRequests,

      // Provider
      mostUsedProvider,
      providers: providerBreakdown,

      // Growth
      newUsersToday,

      // Payment overview
      paymentsPending,
      paymentsApproved,
      paymentsRejected: paymentsFailed,
      totalRevenue: revenueResult._sum.amount ?? 0,
    };
  }

  /**
   * Get usage count for a specific feature
   */
  private async getFeatureUsageCount(feature: string, since: Date): Promise<number> {
    try {
      return await prisma.usage.count({
        where: { feature, createdAt: { gte: since } },
      });
    } catch {
      return 0;
    }
  }

  /**
   * Get provider usage breakdown (all time)
   */
  private async getProviderUsage(): Promise<Array<{ provider: string; count: number }>> {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["provider"],
        _count: true,
        where: { provider: { not: null } },
        orderBy: { _count: { provider: "desc" } },
      });
      return usage.map((u) => ({
        provider: u.provider ?? "unknown",
        count: u._count,
      }));
    } catch {
      return [];
    }
  }

  /** Get top features by usage today */
  private async getTopFeatures(since: Date): Promise<Array<{ feature: string; count: number }>> {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["feature"],
        _count: true,
        where: { createdAt: { gte: since } },
        orderBy: { _count: { feature: "desc" } },
        take: 10,
      });
      return usage.map((u) => ({ feature: u.feature, count: u._count }));
    } catch {
      return [];
    }
  }

  /** Get all users with pagination */
  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { lastActiveAt: "desc" },
        include: {
          subscription: true,
          _count: { select: { messages: true, conversations: true } },
        },
      }),
      prisma.user.count(),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** Get admin logs */
  async getLogs(page = 1, limit = 50): Promise<AdminLog[]> {
    const logs = await prisma.adminLog.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }) as Array<{ id: string; action: string; adminId: bigint; details: string; createdAt: Date }>;

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      adminId: Number(log.adminId),
      details: log.details,
      createdAt: log.createdAt,
    }));
  }

  /** Broadcast a message to all users */
  async broadcast(message: string, excludeUserIds: number[] = []): Promise<number> {
    const users = await prisma.user.findMany({
      where: {
        telegramId: { notIn: excludeUserIds.map((id) => BigInt(id)) },
      },
      select: { telegramId: true },
    });
    return users.length;
  }

  /** Reset all users' daily limits */
  async resetDailyLimits(): Promise<number> {
    try {
      const result = await prisma.user.updateMany({
        where: { lastResetAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
        data: { requestsToday: 0, lastResetAt: new Date() },
      });
      return result.count;
    } catch {
      return 0;
    }
  }
}

export const adminService = new AdminService();

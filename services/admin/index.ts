/**
 * Admin Service — Consolidated Entry Point
 * Re-exports all admin functionality from specialized modules.
 * Also maintains backward compatibility with existing imports.
 */

import { prisma } from "@/lib/prisma";
import { env } from "@/config";
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
   * Get dashboard statistics
   */
  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, activeToday, totalRequests, todayRequests, premiumUsers] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { lastActiveAt: { gte: todayStart } } }),
        prisma.message.count(),
        prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { isPremium: true } }),
      ]);

    return {
      totalUsers,
      activeUsersToday: activeToday,
      totalRequests,
      requestsToday: todayRequests,
      premiumUsers,
      topFeatures: await this.getTopFeatures(todayStart),
    };
  }

  /** Get top features by usage */
  private async getTopFeatures(since: Date) {
    try {
      const usage = await prisma.usage.groupBy({
        by: ["feature"],
        _count: true,
        where: { createdAt: { gte: since } },
        orderBy: { _count: { feature: "desc" } },
        take: 5,
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
    const result = await prisma.user.updateMany({
      where: { lastResetAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
      data: { requestsToday: 0, lastResetAt: new Date() },
    });
    return result.count;
  }
}

export const adminService = new AdminService();

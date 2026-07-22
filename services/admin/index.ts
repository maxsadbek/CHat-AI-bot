import prisma from "@/lib/prisma";
import { env } from "@/config";
import type { AdminStats, AdminLog } from "@/types";



/**
 * Admin Service
 * Handles admin panel operations, statistics, and management
 */
export class AdminService {
  /**
   * Check if a user is an admin
   */
  isAdmin(telegramId: number): boolean {
    return env.ADMIN_IDS.includes(telegramId);
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
        prisma.user.count({
          where: { lastActiveAt: { gte: todayStart } },
        }),
        prisma.message.count(),
        prisma.message.count({
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.user.count({
          where: { isPremium: true },
        }),
      ]);

    return {
      totalUsers,
      activeUsersToday: activeToday,
      totalRequests,
      requestsToday: todayRequests,
      premiumUsers,
      // TODO: Re-implement with Prisma v7's groupBy API once documented
      topFeatures: [],
    };
  }

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { lastActiveAt: "desc" },
        include: {
          subscription: true,
          _count: {
            select: {
              messages: true,
              conversations: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get admin logs
   */
  async getLogs(page: number = 1, limit: number = 50): Promise<AdminLog[]> {
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

  /**
   * Create an admin log entry
   */
  async logAction(
    adminId: number,
    action: string,
    details: string = ""
  ): Promise<void> {
    await prisma.adminLog.create({
      data: {
        adminId: BigInt(adminId),
        action,
        details,
      },
    });
  }

  /**
   * Broadcast a message to all users
   */
  async broadcast(
    message: string,
    excludeUserIds: number[] = []
  ): Promise<number> {
    const users = await prisma.user.findMany({
      where: {
        telegramId: {
          notIn: excludeUserIds.map((id: number) => BigInt(id)),
        },
      },
      select: { telegramId: true },
    });

    return users.length;
  }

  /**
   * Reset daily limits for all users
   */
  async resetDailyLimits(): Promise<number> {
    const result = await prisma.user.updateMany({
      where: {
        lastResetAt: {
          lt: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      data: {
        requestsToday: 0,
        lastResetAt: new Date(),
      },
    });

    return result.count;
  }
}

export const adminService = new AdminService();

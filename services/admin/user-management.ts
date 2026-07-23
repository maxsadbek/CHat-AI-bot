/**
 * User Management Service
 * Admin operations for user management: search, ban, restore, premium toggle, user details.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import { logAdminAction } from "./admin-guard";

const log = logger.child("admin-user-mgmt");

export class UserManagementService {
  /**
   * Get detailed user info by internal ID
   */
  async getUserDetail(userId: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
              usage: true,
              projects: true,
            },
          },
        },
      });
      return user;
    } catch (error) {
      log.error("Error getting user detail", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId: bigint) {
    try {
      return await prisma.user.findUnique({
        where: { telegramId },
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
              usage: true,
            },
          },
        },
      });
    } catch (error) {
      log.error("Error getting user by Telegram ID", { telegramId: String(telegramId), error: String(error) });
      throw error;
    }
  }

  /**
   * Search users by name or username
   */
  async searchUsers(query: string, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const where = {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { username: { contains: query, mode: "insensitive" as const } },
        ],
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { lastActiveAt: "desc" },
          include: {
            subscription: { select: { planType: true, tier: true } },
            _count: { select: { messages: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      log.error("Error searching users", { query, error: String(error) });
      throw error;
    }
  }

  /**
   * Toggle premium status for a user
   */
  async togglePremium(userId: number, adminId: number) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isPremium: !user.isPremium },
      });

      await logAdminAction(
        adminId,
        user.isPremium ? "user_downgrade" : "user_upgrade",
        `User ${userId} (${user.firstName}) premium: ${user.isPremium} → ${!user.isPremium}`
      );

      return updated;
    } catch (error) {
      log.error("Error toggling premium", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Update user's daily limit
   */
  async updateDailyLimit(userId: number, dailyLimit: number, adminId: number) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { dailyLimit },
      });

      await logAdminAction(
        adminId,
        "update_daily_limit",
        `User ${userId}: daily limit ${user.dailyLimit} → ${dailyLimit}`
      );

      return updated;
    } catch (error) {
      log.error("Error updating daily limit", { userId, dailyLimit, error: String(error) });
      throw error;
    }
  }

  /**
   * Reset a user's daily request counter
   */
  async resetUserDaily(userId: number, adminId: number) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { requestsToday: 0, lastResetAt: new Date() },
      });

      await logAdminAction(adminId, "reset_daily", `User ${userId} daily counter reset`);

      return updated;
    } catch (error) {
      log.error("Error resetting user daily", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Ban a user — set dailyLimit to 0 so they can't use the bot
   */
  async banUser(userId: number, adminId: number) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { dailyLimit: 0 },
      });

      await logAdminAction(
        adminId,
        "ban_user",
        `User ${userId} (${updated.firstName}) banned`
      );

      return updated;
    } catch (error) {
      log.error("Error banning user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Unban a user — restore dailyLimit to plan default
   */
  async unbanUser(userId: number, adminId: number) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const defaultLimit = user.isPremium ? 999999 : 50;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { dailyLimit: defaultLimit },
      });

      await logAdminAction(
        adminId,
        "unban_user",
        `User ${userId} (${updated.firstName}) unbanned`
      );

      return updated;
    } catch (error) {
      log.error("Error unbanning user", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Delete all user data (GDPR/privacy)
   */
  async deleteUserData(userId: number, adminId: number) {
    try {
      // Cascade delete handles most relations, but let's log this
      await prisma.user.delete({ where: { id: userId } });

      await logAdminAction(
        adminId,
        "delete_user",
        `User ${userId} and all associated data deleted`
      );

      return true;
    } catch (error) {
      log.error("Error deleting user data", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Get users with expiring subscriptions (within N days)
   */
  async getExpiringSubscriptions(days = 7) {
    try {
      const now = new Date();
      const expiryWindow = new Date();
      expiryWindow.setDate(expiryWindow.getDate() + days);

      return await prisma.user.findMany({
        where: {
          isPremium: true,
          subscription: {
            expiresAt: {
              not: null,
              gte: now,
              lte: expiryWindow,
            },
          },
        },
        include: {
          subscription: { select: { planType: true, expiresAt: true } },
        },
        orderBy: { subscription: { expiresAt: "asc" } },
      });
    } catch (error) {
      log.error("Error getting expiring subscriptions", { error: String(error) });
      return [];
    }
  }
}

export const userManagementService = new UserManagementService();

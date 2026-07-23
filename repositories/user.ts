/**
 * User Repository
 * Data access layer for User model with user-specific queries.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";

const log = logger.child("user-repo");

export interface UserCreateInput {
  telegramId: bigint;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  dailyLimit?: number;
}

export interface UserUpdateInput {
  firstName?: string;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  lastActiveAt?: Date;
  requestsToday?: number;
  totalRequests?: number;
  dailyLimit?: number;
  isPremium?: boolean;
}

export class UserRepository {
  /**
   * Find or create user by Telegram ID
   */
  async upsertByTelegramId(
    telegramId: bigint,
    data: UserCreateInput,
    retries = 1
  ) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await prisma.user.upsert({
          where: { telegramId },
          update: {
            firstName: data.firstName,
            lastName: data.lastName ?? undefined,
            username: data.username ?? undefined,
            languageCode: data.languageCode ?? undefined,
            lastActiveAt: new Date(),
          },
          create: {
            telegramId: data.telegramId,
            firstName: data.firstName,
            lastName: data.lastName ?? null,
            username: data.username ?? null,
            languageCode: data.languageCode ?? null,
            requestsToday: 0,
            totalRequests: 0,
            dailyLimit: data.dailyLimit ?? 50,
          },
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(`Failed to upsert user (attempt ${attempt + 1}/${retries + 1})`, {
          telegramId: String(telegramId),
          error: lastError.message,
        });
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error("Failed to upsert user");
  }

  /**
   * Find user by Telegram ID with full relations
   */
  async findByTelegramId(telegramId: bigint) {
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
            },
          },
        },
      });
    } catch (error) {
      log.error("Error finding user by Telegram ID", {
        telegramId: String(telegramId),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Find user by internal ID with relations
   */
  async findById(id: number) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          subscription: true,
          settings: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
            },
          },
        },
      });
    } catch (error) {
      log.error("Error finding user by ID", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Increment request counters
   */
  async incrementRequests(id: number, amount = 1) {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          requestsToday: { increment: amount },
          totalRequests: { increment: amount },
        },
      });
    } catch (error) {
      log.error("Error incrementing user requests", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Reset daily request counters for all users (cron job)
   */
  async resetDailyCounters() {
    try {
      const result = await prisma.user.updateMany({
        data: { requestsToday: 0, lastResetAt: new Date() },
      });
      log.info("Reset daily counters", { count: result.count });
      return result;
    } catch (error) {
      log.error("Error resetting daily counters", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get active users today
   */
  async countActiveToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      return await prisma.user.count({
        where: { lastActiveAt: { gte: today } },
      });
    } catch (error) {
      log.error("Error counting active users", { error: String(error) });
      throw error;
    }
  }

  /**
   * Count users active since a given date
   */
  async countActiveSince(since: Date): Promise<number> {
    try {
      return await prisma.user.count({
        where: { lastActiveAt: { gte: since } },
      });
    } catch (error) {
      log.error("Error counting active users since", { since, error: String(error) });
      throw error;
    }
  }

  /**
   * Count new users since a given date
   */
  async countNewSince(since: Date): Promise<number> {
    try {
      return await prisma.user.count({
        where: { createdAt: { gte: since } },
      });
    } catch (error) {
      log.error("Error counting new users since", { since, error: String(error) });
      throw error;
    }
  }

  /**
   * Get total user count
   */
  async countTotal(): Promise<number> {
    try {
      return await prisma.user.count();
    } catch (error) {
      log.error("Error counting users", { error: String(error) });
      throw error;
    }
  }

  /**
   * Update user by ID
   */
  async update(id: number, data: UserUpdateInput) {
    try {
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      log.error("Error updating user", { id, error: String(error) });
      throw error;
    }
  }
}

export const userRepository = new UserRepository();

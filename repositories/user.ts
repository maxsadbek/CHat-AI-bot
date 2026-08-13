/**
 * User Repository
 * Data access layer for User model with user-specific queries.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import { isAdmin } from "@/services/admin/admin-guard";
import { Prisma } from "@prisma/client";

const log = logger.child("user-repo");

/**
 * Generate a unique referral code (8 chars, unambiguous alphabet).
 * Collisions are astronomically unlikely; the create path retries on the
 * rare P2002 unique violation with a fresh code.
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return code;
}

export interface UserCreateInput {
  telegramId: bigint;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  dailyLimit?: number;
  referralCode?: string;
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
   * Find or create user by Telegram ID.
   * Returns { user, created } so callers can attribute referrals on signup.
   * A fresh random referral code is generated for every new user.
   */
  async upsertByTelegramId(
    telegramId: bigint,
    data: UserCreateInput,
    retries = 1
  ): Promise<{ user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>; created: boolean }> {
    let lastError: Error | null = null;
    const userIsAdmin = isAdmin(telegramId);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // ── Existing user → update activity, return as-is ──
        const existing = await prisma.user.findUnique({ where: { telegramId } });
        if (existing) {
          const user = await prisma.user.update({
            where: { id: existing.id },
            data: {
              firstName: data.firstName,
              lastName: data.lastName ?? undefined,
              username: data.username ?? undefined,
              languageCode: data.languageCode ?? undefined,
              lastActiveAt: new Date(),
              ...(userIsAdmin ? { isPremium: true, dailyLimit: 999999 } : {}),
            },
            include: { settings: true },
          });
          return { user, created: false };
        }

        // ── New user → create with a fresh referral code ──
        try {
          const user = await prisma.user.create({
            data: {
              telegramId: data.telegramId,
              firstName: data.firstName,
              lastName: data.lastName ?? null,
              username: data.username ?? null,
              languageCode: data.languageCode ?? null,
              requestsToday: 0,
              totalRequests: 0,
              dailyLimit: userIsAdmin ? 999999 : (data.dailyLimit ?? 50),
              isPremium: userIsAdmin,
              referralCode: generateReferralCode(),
            },
            include: { settings: true },
          });
          return { user, created: true };
        } catch (createError) {
          // Extremely rare: referralCode unique collision → retry with a fresh code
          if (
            createError instanceof Prisma.PrismaClientKnownRequestError &&
            createError.code === "P2002"
          ) {
            await new Promise((r) => setTimeout(r, 50));
            continue;
          }
          throw createError;
        }
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
      const user = await prisma.user.findUnique({
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

      if (user && isAdmin(user.telegramId)) {
        return {
          ...user,
          isPremium: true,
          dailyLimit: 999999,
        };
      }

      return user;
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
      const user = await prisma.user.findUnique({
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

      if (user && isAdmin(user.telegramId)) {
        return {
          ...user,
          isPremium: true,
          dailyLimit: 999999,
        };
      }

      return user;
    } catch (error) {
      log.error("Error finding user by ID", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * Increment request counters.
   * Once the user is past their dailyLimit, extra requests consume the
   * referral bonus pool (bonusRequests) so the bonus is truly one-time.
   */
  async incrementRequests(id: number, amount = 1) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { requestsToday: true, dailyLimit: true, bonusRequests: true },
      });
      if (!user) throw new Error(`User ${id} not found`);

      const usingBonus =
        user.requestsToday >= user.dailyLimit && user.bonusRequests > 0;

      return await prisma.user.update({
        where: { id },
        data: {
          requestsToday: { increment: amount },
          totalRequests: { increment: amount },
          ...(usingBonus
            ? { bonusRequests: { decrement: Math.min(amount, user.bonusRequests) } }
            : {}),
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

  /**
   * Find a user by their referral code
   */
  async findByReferralCode(code: string) {
    try {
      return await prisma.user.findUnique({
        where: { referralCode: code },
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          settings: true,
        },
      });
    } catch (error) {
      log.error("Error finding user by referral code", { code, error: String(error) });
      return null;
    }
  }

  /**
   * Count how many users joined through this user's referral link
   */
  async countReferrals(userId: number): Promise<number> {
    try {
      return await prisma.user.count({ where: { referredBy: userId } });
    } catch (error) {
      log.error("Error counting referrals", { userId, error: String(error) });
      return 0;
    }
  }

  /**
   * Get the user's remaining referral bonus requests
   */
  async getBonusRequests(userId: number): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { bonusRequests: true },
      });
      return user?.bonusRequests ?? 0;
    } catch (error) {
      log.error("Error fetching bonus requests", { userId, error: String(error) });
      return 0;
    }
  }
}

export const userRepository = new UserRepository();

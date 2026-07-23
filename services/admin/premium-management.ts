/**
 * Premium Management Service
 * Admin operations for managing subscriptions and premium access.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/bot/core/logger";
import { logAdminAction } from "./admin-guard";
import { subscriptionService } from "@/services/subscription";
import type { PlanId } from "@/config/plans";

const log = logger.child("admin-premium-mgmt");

export class PremiumManagementService {
  /**
   * Grant premium to a user (free method — no payment)
   */
  async grantPremium(userId: number, planId: PlanId, adminId: number, reason?: string) {
    try {
      await subscriptionService.upgrade(userId, planId, `admin_${adminId}_${Date.now()}`, "admin");

      await logAdminAction(
        adminId,
        "grant_premium",
        `User ${userId} granted ${planId}${reason ? ` (${reason})` : ""}`
      );

      return { success: true, userId, planId };
    } catch (error) {
      log.error("Error granting premium", { userId, planId, error: String(error) });
      throw error;
    }
  }

  /**
   * Revoke premium from a user (downgrade to free)
   */
  async revokePremium(userId: number, adminId: number, reason?: string) {
    try {
      await subscriptionService.downgrade(userId);

      await logAdminAction(
        adminId,
        "revoke_premium",
        `User ${userId} premium revoked${reason ? ` (${reason})` : ""}`
      );

      return { success: true, userId };
    } catch (error) {
      log.error("Error revoking premium", { userId, error: String(error) });
      throw error;
    }
  }

  /**
   * Extend an existing subscription by N days
   */
  async extendSubscription(userId: number, days: number, adminId: number) {
    try {
      const sub = await prisma.subscription.findUnique({ where: { userId } });
      if (!sub) throw new Error("No subscription found");

      const currentExpiry = sub.expiresAt ?? new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + days);

      await prisma.subscription.update({
        where: { userId },
        data: { expiresAt: newExpiry },
      });

      await logAdminAction(
        adminId,
        "extend_subscription",
        `User ${userId} extended by ${days} days (new expiry: ${newExpiry.toISOString().slice(0, 10)})`
      );

      return { success: true, userId, newExpiry };
    } catch (error) {
      log.error("Error extending subscription", { userId, days, error: String(error) });
      throw error;
    }
  }

  /**
   * Get all premium users with subscription details
   */
  async getPremiumUsers(page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { isPremium: true },
          skip,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            subscription: true,
          },
        }),
        prisma.user.count({ where: { isPremium: true } }),
      ]);

      return { users, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      log.error("Error getting premium users", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get aggregate premium statistics
   */
  async getPremiumStats() {
    try {
      const [totalPremium, byPlan, byBilling, revenue] = await Promise.all([
        prisma.user.count({ where: { isPremium: true } }),
        prisma.subscription.groupBy({
          by: ["planType"],
          _count: true,
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        }),
        prisma.subscription.groupBy({
          by: ["billingPeriod"],
          _count: true,
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        }),
        prisma.subscription.count({ where: { paymentId: { not: null } } }),
      ]);

      return {
        totalPremium,
        byPlan: byPlan.map((p) => ({ plan: p.planType, count: p._count })),
        byBilling: byBilling.map((b) => ({ period: b.billingPeriod, count: b._count })),
        paidSubscriptions: revenue,
      };
    } catch (error) {
      log.error("Error getting premium stats", { error: String(error) });
      throw error;
    }
  }

  /**
   * Check if a user has an active premium subscription
   */
  async isPremiumActive(userId: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user?.isPremium ?? false;
    } catch {
      return false;
    }
  }
}

export const premiumManagementService = new PremiumManagementService();

/**
 * Referral Service
 * ─────────────────
 * A simple invite-a-friend system:
 *   • Every user gets a unique referral code (generated at signup).
 *   • Referral link: <bot_url>?start=ref_<code>
 *   • When a NEW user signs up through a referral link, BOTH sides get a
 *     free-request bonus:
 *       - Inviter: +REFERRAL_BONUS_INVITER free requests
 *       - New user: +REFERRAL_BONUS_NEW free requests
 *   • Bonus requests are a one-time pool that extends the daily allowance
 *     and is consumed after the regular daily limit is reached.
 *
 * Attribution happens in the /start handler (only for fresh signups), so
 * existing users pressing an old referral link never trigger a bonus.
 */

import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";
import { env } from "@/config";
import { t, resolveLanguage } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import type { BotContext } from "@/types";
import { logger } from "@/bot/core/logger";
import { generateReferralCode } from "@/repositories/user";

const log = logger.child("referral");

export const REFERRAL_BONUS_INVITER = 10;
export const REFERRAL_BONUS_NEW = 5;

export class ReferralService {
  /**
   * Build the public referral link for a code:
   *   https://t.me/<bot>?start=ref_<code>
   */
  getReferralLink(code: string): string {
    const base = process.env.NEXT_PUBLIC_BOT_URL || "https://t.me/your_bot_username";
    return `${base.replace(/\/+$/, "")}?start=ref_${code}`;
  }

  /**
   * Ensure the user has a referral code (backfill for users created
   * before this feature existed). Returns the user's code.
   */
  async ensureReferralCode(userId: number): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });
      if (user?.referralCode) return user.referralCode;

      const code = generateReferralCode();
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (error) {
      log.error("ensureReferralCode failed", { userId, error: String(error) });
      return null;
    }
  }

  /**
   * Apply a referral when a user signs up through a referral link.
   * Safe to call for any /start — it no-ops unless:
   *   1. the code belongs to a real, different user, and
   *   2. the new user has no referrer yet.
   */
  async applyReferral(ctx: BotContext, code: string): Promise<void> {
    const newUserId = ctx.session.userId;
    if (!newUserId) return;

    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: trimmed },
        select: { id: true, telegramId: true },
      });
      if (!referrer || referrer.id === newUserId) return;

      const newUser = await prisma.user.findUnique({
        where: { id: newUserId },
        select: { referredBy: true, telegramId: true },
      });
      if (!newUser || newUser.referredBy !== null) return;

      // Attribute the referral and award bonuses atomically
      await prisma.$transaction([
        prisma.user.update({
          where: { id: newUserId },
          data: {
            referredBy: referrer.id,
            bonusRequests: { increment: REFERRAL_BONUS_NEW },
          },
        }),
        prisma.user.update({
          where: { id: referrer.id },
          data: { bonusRequests: { increment: REFERRAL_BONUS_INVITER } },
        }),
      ]);

      log.info("Referral applied", {
        newUserId,
        referrerId: referrer.id,
        bonusInviter: REFERRAL_BONUS_INVITER,
        bonusNew: REFERRAL_BONUS_NEW,
      });

      await this.notifyReferrer(referrer.id, referrer.telegramId);
      await this.notifyNewUser(newUserId, newUser.telegramId);
    } catch (error) {
      log.error("applyReferral failed", { userId: newUserId, code: trimmed, error: String(error) });
    }
  }

  /**
   * Count how many users joined via this user's referral link
   */
  async countReferrals(userId: number): Promise<number> {
    try {
      return await prisma.user.count({ where: { referredBy: userId } });
    } catch (error) {
      log.error("countReferrals failed", { userId, error: String(error) });
      return 0;
    }
  }

  // ─── Notifications ─────────────────────────────────

  private async getUserLanguage(userId: number): Promise<SupportedLanguage> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { language: true },
      });
      return resolveLanguage(undefined, settings?.language ?? null);
    } catch {
      return resolveLanguage(undefined, null);
    }
  }

  private async notifyReferrer(userId: number, telegramId: bigint): Promise<void> {
    try {
      const lang = await this.getUserLanguage(userId);
      await new Bot(env.TELEGRAM_BOT_TOKEN!).api.sendMessage(
        Number(telegramId),
        t(lang, "referral.notify_referrer", { bonus: String(REFERRAL_BONUS_INVITER) }),
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      log.warn("Referrer notification failed (non-critical)", { userId, error: String(error) });
    }
  }

  private async notifyNewUser(userId: number, telegramId: bigint): Promise<void> {
    try {
      const lang = await this.getUserLanguage(userId);
      await new Bot(env.TELEGRAM_BOT_TOKEN!).api.sendMessage(
        Number(telegramId),
        t(lang, "referral.bonus_received", { bonus: String(REFERRAL_BONUS_NEW) }),
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      log.warn("New-user bonus notification failed (non-critical)", { userId, error: String(error) });
    }
  }
}

export const referralService = new ReferralService();

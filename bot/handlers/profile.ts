/**
 * Profile Page
 *
 * Displays user data from the database:
 *   • Username            • Telegram ID
 *   • Language            • Current AI Model
 *   • Current Plan        • Daily Usage (progress bar)
 *   • Join Date
 *
 * Buttons: ⚙️ Settings  |  ⭐ Premium  |  🏠 Home
 *
 * Architecture:
 *   Uses ctx.session.userId (set by userMiddleware) to look up the user
 *   via userService.getProfileById() — finds by internal Prisma ID.
 *   This avoids:
 *     1. BigInt conversion edge cases with large Telegram IDs
 *     2. A separate findByTelegramId query that can fail independently
 *        of the middleware's successful upsert
 *     3. Transient DB failures (the middleware already proved the DB works)
 *
 *   Falls back to userService.getProfile(BigInt(from.id)) only if the internal ID lookup fails.
 *   Both paths are the same user — the internal ID is always current since
 *   middleware sets it on every request via upsert.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { userService } from "@/services/user";
import { profileKeyboard, getProfileKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { t } from "@/bot/localization";
import { LANGUAGE_NAMES } from "@/bot/localization";
import { providerRegistry } from "@/services/ai/providers";
import { isAdmin } from "@/services/admin/admin-guard";
import { logger } from "@/bot/core/logger";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━";
const log = logger.child("profile-handler");

export async function profileHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.PROFILE;

  const from = ctx.from;
  const lang = ctx.session.language;

  if (!from || !ctx.session.userId) {
    await ctx.reply(t(lang, "profile.not_found"), {
      parse_mode: "Markdown",
    });
    return;
  }

  const userId = ctx.session.userId;
  const isAdminUser = isAdmin(from.id);

  try {
    // ─── PRIMARY: Find by internal ID (already verified by middleware) ──
    let profile = await userService.getProfileById(userId);

    // ─── FALLBACK 1: Find by Telegram ID ─────────────────
    if (!profile) {
      log.warn("Profile not found by internal ID, falling back to telegramId", {
        userId,
        telegramId: from.id,
      });
      profile = await userService.getProfile(BigInt(from.id));
    }

    if (!profile) {
      await ctx.reply(t(lang, "profile.not_found"), {
        parse_mode: "Markdown",
      });
      return;
    }

    // ─── Extract and resolve data ─────────────────────
    const displayName = `${profile.firstName} ${profile.lastName ?? ""}`.trim();
    const telegramUsername = profile.username ? `@${profile.username}` : "—";
    const telegramId = String(from.id);

    const userLangCode = profile.settings?.language ?? ctx.session.language ?? "en";
    const languageName =
      LANGUAGE_NAMES[userLangCode as keyof typeof LANGUAGE_NAMES] ?? "English";

    const selectedModelId = ctx.session.selectedModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const modelName = providerRegistry.getModelName(selectedModelId);

    const isEffectivePremium = profile.isPremium || isAdminUser;
    const planLabel = isAdminUser
      ? "👑 Admin Unlimited"
      : isEffectivePremium
        ? "💎 Premium"
        : "🆓 Free";

    const joinedDate = formatDate(profile.createdAt);

    // ─── Usage stats ──────────────────────────────────
    const used = profile.requestsToday;
    const limit = isAdminUser ? 999999 : profile.dailyLimit;
    const usagePercent = Math.min(Math.round((used / limit) * 100), 100);
    const filledBars = Math.min(Math.floor(usagePercent / 10), 10);
    const progressBar = "▓".repeat(filledBars) + "░".repeat(10 - filledBars);

    // ─── Fetch plan details for premium users ─────────
    let planDetail = "";
    if (isEffectivePremium && !isAdminUser) {
      const sub = profile.subscription;
      const planName = sub?.planType?.replace("_", " ") ?? "Premium";
      const renewText = sub?.expiresAt
        ? `Renew: ${formatDate(sub.expiresAt)}`
        : "Lifetime access";
      planDetail = `\n💎 **${planName}**\n📅 ${renewText}`;
    } else if (isAdminUser) {
      planDetail = `\n👑 **Admin — Unlimited Access**`;
    }

    // ─── Build profile message ────────────────────────
    const profileLines = [
      // Header
      t(lang, "profile.title"),
      "",
      // Identity section
      `👤 **${displayName}**`,
      `📱 ${telegramUsername}`,
      `${t(lang, "profile.id", { id: telegramId })}`,
      "",
      // Preferences section
      `${t(lang, "profile.language", { language: languageName })}`,
      `${t(lang, "profile.model", { model: modelName })}`,
      `${t(lang, "profile.subscription", { status: planLabel })}`,
      `${t(lang, "profile.member_since", { date: joinedDate })}`,
      "",
      // Plan detail for premium/admin users
      ...(planDetail ? [planDetail, ""] : []),
      // Usage section
      DIVIDER,
      t(lang, "profile.stats_title"),
      DIVIDER,
      "",
      `${t(lang, "profile.today", { used: String(used), limit: isAdminUser ? "Unlimited" : String(limit) })}`,
      `${t(lang, "profile.progress", { bar: progressBar, percent: String(usagePercent) })}`,
      `${t(lang, "profile.total", { total: String(profile.totalRequests) })}`,
      "",
      DIVIDER,
      t(lang, "profile.activity_title"),
      DIVIDER,
      "",
      `${t(lang, "profile.conversations", { count: String(profile._count?.conversations ?? 0) })}`,
      `${t(lang, "profile.messages", { count: String(profile._count?.messages ?? 0) })}`,
      `${t(lang, "profile.last_active", { date: formatDate(profile.lastActiveAt) })}`,
      "",
      // Upgrade CTA only for non-premium non-admin users
      isEffectivePremium ? "💎 Premium Active ✓" : t(lang, "profile.upgrade"),
    ];

    const profileText = profileLines.join("\n");
    const keyboard = getProfileKeyboard(profile.isPremium, isAdminUser);

    await ctx.reply(profileText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    // Log the real error for debugging
    log.error("Profile load failed", { 
      userId: ctx.session.userId,
      telegramId: from?.id,
      error: String(error),
    });
    
    // Only show error message on real server failures
    await ctx.reply(t(lang, "profile.error"), {
      parse_mode: "Markdown",
      reply_markup: getProfileKeyboard(false, isAdminUser),
    });
  }
}

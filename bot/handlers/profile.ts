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
import { profileKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { t } from "@/bot/localization";
import { LANGUAGE_NAMES } from "@/bot/localization";
import { providerRegistry } from "@/services/ai/providers";
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

  try {
    // ─── PRIMARY: Find by internal ID (already verified by middleware) ──
    // This uses the same value the middleware set after a successful upsert.
    // It avoids a separate findByTelegramId query that could return null
    // even though the user exists (the root cause of the "Profile not found" bug).
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

    const selectedModelId = ctx.session.selectedModel ?? "gpt-4o";
    const modelName = providerRegistry.getModelName(selectedModelId);

    const planLabel = profile.isPremium ? "⭐ Premium" : "🆓 Free";
    const joinedDate = formatDate(profile.createdAt);

    // ─── Usage stats ──────────────────────────────────
    const used = profile.requestsToday;
    const limit = profile.dailyLimit;
    const usagePercent = Math.min(Math.round((used / limit) * 100), 100);
    const filledBars = Math.min(Math.floor(usagePercent / 10), 10);
    const progressBar = "▓".repeat(filledBars) + "░".repeat(10 - filledBars);

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
      // Usage section
      DIVIDER,
      t(lang, "profile.stats_title"),
      DIVIDER,
      "",
      `${t(lang, "profile.today", { used: String(used), limit: String(limit) })}`,
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
      // Upgrade CTA
      t(lang, "profile.upgrade"),
    ];

    const profileText = profileLines.join("\n");

    await ctx.reply(profileText, {
      parse_mode: "Markdown",
      reply_markup: profileKeyboard,
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
      reply_markup: profileKeyboard,
    });
  }
}

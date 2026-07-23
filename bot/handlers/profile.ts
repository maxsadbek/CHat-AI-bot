/**
 * Modern Profile Page
 *
 * Displays user data from the database:
 *   • Username            • Telegram ID
 *   • Language            • Current AI Model
 *   • Current Plan        • Daily Usage (progress bar)
 *   • Join Date
 *
 * Buttons: ⚙️ Settings  |  ⭐ Premium  |  🏠 Home
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { prisma } from "@/lib/prisma";
import { profileKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { t } from "@/bot/localization";
import { LANGUAGE_NAMES } from "@/bot/localization";
import { providerRegistry } from "@/services/ai/providers";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━";

export async function profileHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.PROFILE;

  const from = ctx.from;
  const lang = ctx.session.language;

  if (!from) return;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
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

    if (!user) {
      await ctx.reply(t(lang, "profile.not_found"), {
        parse_mode: "Markdown",
      });
      return;
    }

    // ─── Extract and resolve data ─────────────────────
    const displayName = `${user.firstName} ${user.lastName ?? ""}`.trim();
    const telegramUsername = user.username ? `@${user.username}` : "—";
    const telegramId = String(from.id);

    const userLangCode = user.settings?.language ?? ctx.session.language ?? "en";
    const languageName =
      LANGUAGE_NAMES[userLangCode as keyof typeof LANGUAGE_NAMES] ?? "English";

    const selectedModelId = ctx.session.selectedModel ?? "gpt-4o";
    const modelName = providerRegistry.getModelName(selectedModelId);

    const planLabel = user.isPremium ? "⭐ Premium" : "🆓 Free";
    const joinedDate = formatDate(user.createdAt);

    // ─── Usage stats ──────────────────────────────────
    const used = user.requestsToday;
    const limit = user.dailyLimit;
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
      `${t(lang, "profile.total", { total: String(user.totalRequests) })}`,
      "",
      DIVIDER,
      t(lang, "profile.activity_title"),
      DIVIDER,
      "",
      `${t(lang, "profile.conversations", { count: String(user._count.conversations) })}`,
      `${t(lang, "profile.messages", { count: String(user._count.messages) })}`,
      `${t(lang, "profile.last_active", { date: formatDate(user.lastActiveAt) })}`,
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
    console.error("Profile error:", error);
    await ctx.reply(t(lang, "profile.error"), {
      parse_mode: "Markdown",
      reply_markup: profileKeyboard,
    });
  }
}

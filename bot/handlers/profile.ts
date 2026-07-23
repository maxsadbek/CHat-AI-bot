import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { prisma } from "@/lib/prisma";
import { profileKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { t } from "@/bot/localization";
import { LANGUAGE_NAMES } from "@/bot/localization";
import { providerRegistry } from "@/services/ai/providers";

/**
 * Profile handler
 * Displays a premium profile screen with user info,
 * usage stats, subscription details, and action buttons.
 */
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

    const premiumStatus = user.isPremium ? "⭐ Premium" : "🆓 Free";
    const userLanguage = user.settings?.language ?? ctx.session.language ?? "en";
    const languageName = LANGUAGE_NAMES[userLanguage as keyof typeof LANGUAGE_NAMES] ?? "English";
    const currentModel = providerRegistry.getModelName(ctx.session.selectedModel ?? "gpt-4o");

    const usagePercent = Math.min(
      Math.round((user.requestsToday / user.dailyLimit) * 100),
      100
    );
    const filledBars = Math.min(Math.floor(usagePercent / 10), 10);
    const progressBar =
      "▓".repeat(filledBars) + "░".repeat(10 - filledBars);

    const profileText = [
      t(lang, "profile.title"),
      "",
      `${t(lang, "profile.name", {
        name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
      })}`,
      `${t(lang, "profile.username", {
        username: user.username ? `@${user.username}` : "—",
      })}`,
      `${t(lang, "profile.id", { id: String(from.id) })}`,
      `${t(lang, "profile.language", { language: languageName })}`,
      `${t(lang, "profile.model", { model: currentModel })}`,
      `${t(lang, "profile.subscription", { status: premiumStatus })}`,
      `${t(lang, "profile.member_since", { date: formatDate(user.createdAt) })}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━",
      t(lang, "profile.stats_title"),
      "━━━━━━━━━━━━━━━━━━━━━",
      "",
      `${t(lang, "profile.today", {
        used: String(user.requestsToday),
        limit: String(user.dailyLimit),
      })}`,
      `${t(lang, "profile.total", { total: String(user.totalRequests) })}`,
      `${t(lang, "profile.progress", {
        bar: progressBar,
        percent: String(usagePercent),
      })}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━",
      t(lang, "profile.activity_title"),
      "━━━━━━━━━━━━━━━━━━━━━",
      "",
      `${t(lang, "profile.conversations", {
        count: String(user._count.conversations),
      })}`,
      `${t(lang, "profile.messages", {
        count: String(user._count.messages),
      })}`,
      `${t(lang, "profile.last_active", { date: formatDate(user.lastActiveAt) })}`,
      "",
      t(lang, "profile.upgrade"),
    ].join("\n");

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

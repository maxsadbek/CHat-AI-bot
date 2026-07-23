import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { prisma } from "@/lib/prisma";
import { profileKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { t } from "@/bot/localization";

/**
 * Profile handler
 * Shows user information, usage stats, and subscription details
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
    const usagePercent = Math.round(
      (user.requestsToday / user.dailyLimit) * 100
    );
    const progressBar =
      "▓".repeat(Math.floor(usagePercent / 10)) +
      "░".repeat(10 - Math.floor(usagePercent / 10));

    const profileText = [
      "━━━━━━━━━━━━━━━━━━━━━",
      t(lang, "profile.title"),
      "━━━━━━━━━━━━━━━━━━━━━\n",
      t(lang, "profile.name", {
        name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
      }),
      t(lang, "profile.username", {
        username: user.username ? `@${user.username}` : "—",
      }),
      t(lang, "profile.status", { status: premiumStatus }),
      t(lang, "profile.member_since", { date: formatDate(user.createdAt) }),
      "\n",
      "━━━━━━━━━━━━━━━━━━━━━",
      t(lang, "profile.stats_title"),
      "━━━━━━━━━━━━━━━━━━━━━\n",
      t(lang, "profile.today", {
        used: String(user.requestsToday),
        limit: String(user.dailyLimit),
      }),
      t(lang, "profile.total", { total: String(user.totalRequests) }),
      t(lang, "profile.progress", {
        bar: progressBar,
        percent: String(usagePercent),
      }),
      "\n",
      "━━━━━━━━━━━━━━━━━━━━━",
      t(lang, "profile.activity_title"),
      "━━━━━━━━━━━━━━━━━━━━━\n",
      t(lang, "profile.conversations", {
        count: String(user._count.conversations),
      }),
      t(lang, "profile.messages", {
        count: String(user._count.messages),
      }),
      t(lang, "profile.last_active", { date: formatDate(user.lastActiveAt) }),
      "\n",
      "━━━━━━━━━━━━━━━━━━━━━\n",
      t(lang, "profile.upgrade"),
    ].join("\n");

    await ctx.reply(profileText, {
      parse_mode: "Markdown",
      reply_markup: profileKeyboard,
    });
  } catch (error) {
    console.error("Profile error:", error);
    await ctx.reply(t(lang, "profile.error"), {
      parse_mode: "Markdown",
      reply_markup: profileKeyboard,
    });
  }
}

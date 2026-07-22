import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { prisma } from "@/lib/prisma";
import { profileKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";

/**
 * Profile handler
 * Shows user information, usage stats, and subscription details
 */
export async function profileHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.PROFILE;

  const from = ctx.from;
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
      await ctx.reply(
        "❌ *Profile not found*\n\nPlease use /start to create your profile.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const premiumStatus = user.isPremium ? "⭐ Premium" : "🆓 Free";
    const usagePercent = Math.round(
      (user.requestsToday / user.dailyLimit) * 100
    );

    const profileText = [
      "━━━━━━━━━━━━━━━━━━━━━",
      "👤 *Your Profile*",
      "━━━━━━━━━━━━━━━━━━━━━\n",
      `*Name:* ${user.firstName} ${user.lastName ?? ""}`.trim(),
      `*Username:* ${user.username ? "@" + user.username : "—"}`,
      `*Status:* ${premiumStatus}`,
      `*Member Since:* ${formatDate(user.createdAt)}\n`,
      "━━━━━━━━━━━━━━━━━━━━━",
      "📊 *Usage Statistics*",
      "━━━━━━━━━━━━━━━━━━━━━\n",
      `*Today:* ${user.requestsToday} / ${user.dailyLimit} requests`,
      `*Total:* ${user.totalRequests} requests`,
      `*Progress:* ${"▓".repeat(Math.floor(usagePercent / 10))}${"░".repeat(10 - Math.floor(usagePercent / 10))} ${usagePercent}%\n`,
      "━━━━━━━━━━━━━━━━━━━━━",
      "💬 *Activity*",
      "━━━━━━━━━━━━━━━━━━━━━\n",
      `*Conversations:* ${user._count.conversations}`,
      `*Messages:* ${user._count.messages}`,
      `*Last Active:* ${formatDate(user.lastActiveAt)}\n`,
      "━━━━━━━━━━━━━━━━━━━━━\n",
      `_Need more requests? Upgrade to Premium!_ 🚀`,
    ].join("\n");

    await ctx.reply(profileText, {
      parse_mode: "Markdown",
      reply_markup: profileKeyboard,
    });
  } catch (error) {
    console.error("Profile error:", error);
    await ctx.reply(
      "❌ *Error loading profile*\n\nPlease try again later.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

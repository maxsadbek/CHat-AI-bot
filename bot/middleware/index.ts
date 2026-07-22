import { Bot } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { rateLimiter } from "@/utils/rate-limit";
import { prisma } from "@/lib/prisma";
import { env } from "@/config";

/**
 * Initialize session data for new users
 */
export function createInitialSession() {
  return {
    step: BotStep.IDLE,
    userId: null as number | null,
    conversationId: null as string | null,
    messages: [] as Array<{ role: "user" | "assistant"; content: string }>,
    tempData: {} as Record<string, string>,
  };
}

/**
 * Rate limiting middleware
 * Prevents spam and abuse
 */
export async function rateLimitMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  const { allowed, remaining } = rateLimiter.check(`user:${userId}`);

  if (!allowed) {
    await ctx.reply(
      "⚠️ *Rate Limit Reached*\\n\\nPlease wait a moment before sending another request.\\n\\n" +
        "This helps us maintain quality service for everyone.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  await next();
}

/**
 * User tracking middleware
 * Creates/updates user in database and tracks activity
 * Stores the Prisma user ID in session for downstream handlers
 */
export async function userMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await next();
    return;
  }

  try {
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      update: {
        firstName: from.first_name,
        lastName: from.last_name ?? undefined,
        username: from.username ?? undefined,
        languageCode: from.language_code ?? undefined,
        lastActiveAt: new Date(),
      },
      create: {
        telegramId: BigInt(from.id),
        firstName: from.first_name,
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        languageCode: from.language_code ?? null,
        requestsToday: 0,
        totalRequests: 0,
        dailyLimit: env.ADMIN_IDS.includes(from.id) ? 999999 : 50,
      },
    });

    // Store the Prisma user ID in session for downstream handlers
    ctx.session.userId = user.id;
  } catch (error) {
    console.error("Failed to upsert user:", error);
  }

  await next();
}

/**
 * Check daily request limit
 */
export async function checkDailyLimit(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await next();
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (user && user.requestsToday >= user.dailyLimit) {
      const isAdmin = env.ADMIN_IDS.includes(from.id);
      if (!isAdmin) {
        await ctx.reply(
          "⚠️ *Daily Limit Reached*\\n\\n" +
            `You've used ${user.requestsToday}/${user.dailyLimit} requests today.\\n\\n` +
            "Your limit resets at midnight UTC.\\n\\n" +
            "Upgrade to Premium for higher limits! 🚀",
          { parse_mode: "Markdown" }
        );
        return;
      }
    }
  } catch (error) {
    console.error("Failed to check daily limit:", error);
  }

  await next();
}

/**
 * Register all middleware on the bot
 */
export function registerMiddleware(bot: Bot<BotContext>): void {
  bot.use(rateLimitMiddleware);
  bot.use(userMiddleware);
  bot.use(checkDailyLimit);
}

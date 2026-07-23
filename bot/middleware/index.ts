import { Bot } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { rateLimiter } from "@/utils/rate-limit";
import { prisma } from "@/lib/prisma";
import { env } from "@/config";
import { createFreshSession } from "@/bot/session";
import { t, resolveLanguage } from "@/bot/localization";

/**
 * Initialize session data for new users
 */
export function createInitialSession(): ReturnType<typeof createFreshSession> {
  return createFreshSession();
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

  const lang = ctx.session?.language ?? "en";
  const { allowed } = rateLimiter.check(`user:${userId}`);

  if (!allowed) {
    await ctx.reply(t(lang, "errors.rate_limit"), {
      parse_mode: "Markdown",
    });
    return;
  }

  await next();
}

/**
 * User tracking middleware
 * Creates/updates user in database and tracks activity
 * Stores the Prisma user ID in session for downstream handlers
 * Also loads user's language preference into session
 * Retries once on failure to handle transient DB issues
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
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
      lastError = null;

      // Load user's language preference from DB settings
      try {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: user.id },
        });
        if (settings?.language) {
          ctx.session.language = resolveLanguage(
            settings.language as any,
            null
          );
          ctx.session.languageSelected = true;
        }
      } catch {
        // Non-critical, continue with default language
      }

      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Failed to upsert user (attempt ${attempt + 1}/2):`,
        lastError.message
      );
      if (attempt === 0) {
        // Wait briefly before retry
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  if (lastError) {
    console.error(
      "User middleware: all retries exhausted. userId will be null."
    );
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

  const lang = ctx.session?.language ?? "en";

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (user && user.requestsToday >= user.dailyLimit) {
      const isAdmin = env.ADMIN_IDS.includes(from.id);
      if (!isAdmin) {
        await ctx.reply(
          t(lang, "errors.daily_limit", {
            used: String(user.requestsToday),
            limit: String(user.dailyLimit),
          }),
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

import { Bot } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { rateLimiter } from "@/utils/rate-limit";
import { env } from "@/config";
import { createFreshSession } from "@/bot/session";
import { t, resolveLanguage } from "@/bot/localization";
import { userService } from "@/services/user";
import { logger } from "@/bot/core/logger";

const log = logger.child("middleware");

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
    log.warn("Rate limit hit", { userId });
    await ctx.reply(t(lang, "errors.rate_limit"), {
      parse_mode: "Markdown",
    });
    return;
  }

  await next();
}

/**
 * User tracking middleware
 * Creates/updates user in database and tracks activity.
 * Stores the Prisma user ID in session for downstream handlers.
 * Also loads user's language preference into session.
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
    const user = await userService.findOrCreate(from);

    // Store the Prisma user ID in session
    ctx.session.userId = user.id;

    // Load user's language preference from DB settings
    try {
      const profile = await userService.getProfile(BigInt(from.id));
      if (
        profile?.settings?.language &&
        profile.settings.language !== ctx.session.language
      ) {
        ctx.session.language = resolveLanguage(
          profile.settings.language as any,
          null
        );
        ctx.session.languageSelected = true;
      }
    } catch {
      // Non-critical, continue with default language
    }

    log.debug("User tracked", {
      userId: user.id,
      telegramId: from.id,
    });
  } catch (error) {
    log.error("Failed to upsert user", {
      telegramId: from.id,
      error: String(error),
    });
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
    const { allowed, used, limit } = await userService.checkDailyLimit(
      BigInt(from.id)
    );

    if (!allowed && !env.ADMIN_IDS.includes(from.id)) {
      await ctx.reply(
        t(lang, "errors.daily_limit", {
          used: String(used),
          limit: String(limit),
        }),
        { parse_mode: "Markdown" }
      );
      return;
    }
  } catch (error) {
    log.error("Failed to check daily limit", {
      telegramId: from.id,
      error: String(error),
    });
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
  log.info("Middleware registered");
}

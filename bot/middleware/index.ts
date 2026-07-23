import { Bot } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { rateLimiter } from "@/utils/rate-limit";
import { env } from "@/config";
import { createFreshSession } from "@/bot/session";
import { t, resolveLanguage } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
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

  // Try to find or create user in DB.
  // If DB fails, attempt ONE retry.
  // Critical: preserve the existing session userId on failure so that
  // users who already completed /start never see "use /start first"
  // due to transient DB issues.
  try {
    const user = await userService.findOrCreate(from);

    // Store the Prisma user ID in session
    ctx.session.userId = user.id;

    // Load user's language preference from the upsert result (no separate query)
    // This eliminates the race condition where a second query could fail after
    // findOrCreate succeeds, causing existing users to see language selection again.
    const dbSettings = (user as any).settings as { language?: string } | null;
    if (dbSettings?.language) {
      ctx.session.language = resolveLanguage(
        dbSettings.language as SupportedLanguage,
        null
      );
      ctx.session.languageSelected = true;
    }

    log.debug("User tracked", {
      userId: user.id,
      telegramId: from.id,
    });
  } catch (error) {
    log.error("Failed to upsert user on first attempt", {
      telegramId: from.id,
      error: String(error),
    });

    // Retry once — transient DB issues should resolve
    try {
      const user = await userService.findOrCreate(from);
      ctx.session.userId = user.id;
      log.info("User resolved on retry", {
        userId: user.id,
        telegramId: from.id,
      });
    } catch (retryError) {
      log.error("Failed to upsert user on retry — preserving existing userId", {
        telegramId: from.id,
        existingUserId: ctx.session.userId,
        error: String(retryError),
      });
      // DO NOT modify ctx.session.userId — preserve the value from the
      // previous successful middleware run. This ensures users who
      // completed /start never see "use /start first" due to transient
      // DB issues. The next middleware run will retry successfully.
    }
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

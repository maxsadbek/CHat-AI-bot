/**
 * Centralized Error Handler
 * Provides typed errors and a consistent way to handle errors
 * across the bot, showing friendly messages to users while logging details.
 */

import type { BotContext } from "@/types";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";

// ─── Typed Errors ─────────────────────────────────────

export class BotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessageKey?: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "BotError";
  }
}

export class AIError extends BotError {
  constructor(
    message: string,
    code: string = "AI_ERROR",
    context?: Record<string, unknown>
  ) {
    super(message, code, "errors.generic", context);
    this.name = "AIError";
  }
}

export class UserError extends BotError {
  constructor(
    message: string,
    code: string,
    userMessageKey: string,
    context?: Record<string, unknown>
  ) {
    super(message, code, userMessageKey, context);
    this.name = "UserError";
  }
}

export class RateLimitError extends BotError {
  constructor(context?: Record<string, unknown>) {
    super("Rate limit exceeded", "RATE_LIMIT", "errors.rate_limit", context);
    this.name = "RateLimitError";
  }
}

export class DailyLimitError extends BotError {
  constructor(used: number, limit: number, context?: Record<string, unknown>) {
    super(
      `Daily limit reached: ${used}/${limit}`,
      "DAILY_LIMIT",
      "errors.daily_limit",
      { used: String(used), limit: String(limit), ...context }
    );
    this.name = "DailyLimitError";
  }
}

// ─── Error Handler ────────────────────────────────────

const errorLogger = logger.child("error-handler");

/**
 * Handle an error in a bot context.
 * Shows a friendly localized message to the user and logs the error internally.
 */
export async function handleBotError(
  ctx: BotContext,
  error: unknown
): Promise<void> {
  const lang = ctx.session?.language ?? "en";

  if (error instanceof BotError) {
    // Log the internal error details
    errorLogger.error(error.message, {
      code: error.code,
      userId: ctx.from?.id,
      context: error.context,
    });

    // Show friendly message to user
    const messageKey = error.userMessageKey ?? "errors.generic";
    let params: Record<string, string | number> = {};

    if (error instanceof DailyLimitError && error.context) {
      params = {
        used: (error.context.used as string) ?? "0",
        limit: (error.context.limit as string) ?? "50",
      };
    }

    await ctx.reply(t(lang, messageKey, params), {
      parse_mode: "Markdown",
    });
    return;
  }

  // Unknown error — log full details, show generic message
  errorLogger.error("Unhandled error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: ctx.from?.id,
  });

  await ctx.reply(t(lang, "errors.friendly"), {
    parse_mode: "Markdown",
  });
}

/**
 * Wrap a handler with error handling
 */
export function withErrorHandling(
  handler: (ctx: BotContext) => Promise<void>
): (ctx: BotContext) => Promise<void> {
  return async (ctx: BotContext) => {
    try {
      await handler(ctx);
    } catch (error) {
      await handleBotError(ctx, error);
    }
  };
}

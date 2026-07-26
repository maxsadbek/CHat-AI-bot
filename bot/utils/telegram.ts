/**
 * Safe Telegram Helper Functions
 *
 * Handles common Telegram API errors gracefully:
 * - "query is too old" — callback query expired, silently ignore
 * - "message is not modified" — same content already shown, silently ignore
 */

import type { BotContext } from "@/types";

/**
 * Safely answer a callback query, ignoring expired query errors.
 *
 * Telegram callback queries expire after ~30 seconds. If the bot processes
 * a callback after that window (e.g., during long AI generation), this
 * silently discards the error instead of crashing the handler.
 */
export async function safeAnswerCallbackQuery(
  ctx: Pick<BotContext, "answerCallbackQuery">,
  text?: string
): Promise<void> {
  try {
    await ctx.answerCallbackQuery(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Ignore expired callback query errors
    if (
      msg.includes("query is too old") ||
      msg.includes("QUERY_ID_INVALID") ||
      msg.includes("query ID is invalid")
    ) {
      return;
    }
    // Re-throw unexpected errors
    throw err;
  }
}

/**
 * Safely edit a message text, ignoring "message is not modified" errors.
 *
 * Telegram returns 400 "message is not modified" if the new content
 * is identical to the current content. This silently discards that error.
 */
export async function safeEditMessageText(
  ctx: BotContext,
  text: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    await ctx.editMessageText(text, extra as any);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("message is not modified")) {
      return;
    }
    // Re-throw unexpected errors
    throw err;
  }
}

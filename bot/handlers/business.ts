import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { businessAIService } from "@/services/ai/business";
import { businessKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import {
  createConversation,
  saveMessagesToDb,
  showHistory,
  resumeConversation,
} from "@/bot/handlers/history";

const log = logger.child("handler-business");

/**
 * Business AI handler
 * Generates business ideas, plans, strategies, and branding
 * Clears stale mode data and sets step to BUSINESS.
 */
export async function businessHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedBusinessType = "startup_idea";
  ctx.session.step = BotStep.BUSINESS;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "business.welcome"), {
    parse_mode: "Markdown",
    reply_markup: businessKeyboard,
  });
}

/**
 * Safely reply to a Telegram chat with fallback from Markdown to plain text.
 * AI-generated content often contains characters (_ * [ `) that break
 * Telegram's Markdown parser. This helper tries Markdown first, and if
 * parsing fails, re-sends without parse_mode.
 */
async function safeReply(
  ctx: BotContext,
  text: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    await ctx.reply(text, { ...extra, parse_mode: "Markdown" } as any);
  } catch (sendErr: unknown) {
    const sendMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // If the error is a Telegram parse error, retry without Markdown
    if (sendMsg.includes("Can't parse entities") || sendMsg.includes("parse_mode")) {
      log.warn("[safeReply] Markdown parse failed, retrying as plain text", {
        error: sendMsg.slice(0, 100),
      });
      await ctx.reply(text, { ...extra, parse_mode: undefined } as any);
    } else {
      throw sendErr;
    }
  }
}

/**
 * Handle business content generation
 * Uses the currently selected type stored in session (selectedBusinessType).
 * Guarantees the user always receives a response — never leaves them hanging.
 */
export async function businessGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const type = ctx.session.selectedBusinessType ?? "startup_idea";
  const userId = ctx.session.userId;

  if (!userId) return;

  log.info("[BUSINESS_HANDLER] Request started", { userId, type, text: text.slice(0, 50) });

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const created = await createConversation(
      ctx,
      `Business: ${text.slice(0, 90)}`,
      "business"
    );
    if (!created) {
      await ctx.reply(t(lang, "business.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "business.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const result = await businessAIService.generate(
      text,
      type,
      ctx.session.selectedModel
    );

    log.info("[BUSINESS_HANDLER] AI response received", {
      contentLength: result.content.length,
    });

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: result.content });

    // Save to database
    await saveMessagesToDb(ctx, "business");

    const typeTitle = type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    const response = `${t(lang, "business.result_title", { type: typeTitle })}\n\n${result.content}`;

    // Replace the "generating" message with the actual result
    // Delete the generating message (best-effort) then send the result
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await safeReply(ctx, response, { reply_markup: businessKeyboard });

    log.info("[BUSINESS_HANDLER] Response sent successfully", { contentLength: response.length });
  } catch (error) {
    log.error("[BUSINESS_HANDLER] Error", {
      userId,
      feature: "business",
      type,
      error: String(error),
    });

    // Try to edit the generating message with the error instead of deleting + sending new
    // This ensures the user always sees SOMETHING
    const friendlyMsg = error instanceof Error ? error.message : null;
    const errorText = friendlyMsg || t(lang, "business.error");

    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        startMsg.message_id,
        errorText,
        { reply_markup: businessKeyboard, parse_mode: undefined }
      ).catch(() => {
        // If edit fails (e.g. message too old), fall back to delete + new message
        return ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
      });
      log.info("[BUSINESS_HANDLER] Error shown by editing generating message");
    } catch {
      // Final fallback: try to send a new error message
      // The generating message may still be visible, which is better than nothing
      try {
        await ctx.reply(errorText, { reply_markup: businessKeyboard });
        log.info("[BUSINESS_HANDLER] Error sent as new message (edit failed)");
      } catch (finalErr) {
        log.error("[BUSINESS_HANDLER] CRITICAL: Could not send any error response", {
          error: String(finalErr),
        });
      }
    }
  }
}

/**
 * Show business conversation history
 */
export async function businessHistoryHandler(ctx: BotContext): Promise<void> {
  await showHistory(ctx, "business");
}

/**
 * Resume a business conversation
 */
export async function resumeBusinessHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const conversationId = data.replace("resume:business:", "");
  if (!conversationId) return;

  const resumed = await resumeConversation(ctx, conversationId);
  if (!resumed) {
    await ctx.reply(t(lang, "business.error"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(t(lang, "business.resumed"), {
    parse_mode: "Markdown",
    reply_markup: businessKeyboard,
  });
}

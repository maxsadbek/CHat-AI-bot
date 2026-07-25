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
 * Handle business content generation
 * Uses the currently selected type stored in session (selectedBusinessType).
 */
export async function businessGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const type = ctx.session.selectedBusinessType ?? "startup_idea";
  const userId = ctx.session.userId;

  if (!userId) return;

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

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: result.content });

    // Save to database
    await saveMessagesToDb(ctx, "business");

    const typeTitle = type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    const response = `${t(lang, "business.result_title", { type: typeTitle })}\n\n${result.content}`;

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: businessKeyboard,
    });
  } catch (error) {
    log.error("Business AI error", {
      userId,
      feature: "business",
      type,
      error: String(error),
    });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    // Show the friendly error from AIError if available, otherwise localized fallback
    const friendlyMsg = error instanceof Error ? error.message : null;
    await ctx.reply(friendlyMsg || t(lang, "business.error"), {
      parse_mode: "Markdown",
      reply_markup: businessKeyboard,
    });
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

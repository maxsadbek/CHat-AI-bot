import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { codingAIService } from "@/services/ai/coding";
import { codingKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import {
  createConversation,
  saveMessagesToDb,
  showHistory,
  resumeConversation,
} from "@/bot/handlers/history";

const log = logger.child("handler-coding");

/**
 * Coding AI handler
 * Generates code, debugs, and explains programming concepts
 * Clears stale mode data and sets step to CODING.
 */
export async function codingHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedCodeLanguage = "Next.js";
  ctx.session.step = BotStep.CODING;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "coding.welcome"), {
    parse_mode: "Markdown",
    reply_markup: codingKeyboard,
  });
}

/**
 * Handle coding language selection and code generation
 * Uses the currently selected language stored in session (selectedCodeLanguage).
 */
export async function codingGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const language = ctx.session.selectedCodeLanguage ?? "Next.js";
  const userId = ctx.session.userId;

  if (!userId) return;

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const created = await createConversation(
      ctx,
      `Coding: ${text.slice(0, 90)}`,
      "coding"
    );
    if (!created) {
      await ctx.reply(t(lang, "coding.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "coding.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const result = await codingAIService.generate(
      text,
      language,
      ctx.session.selectedModel
    );

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: result.code });

    // Save to database
    await saveMessagesToDb(ctx, "coding");

    const response = `${t(lang, "coding.result_title", { language })}\n\n${result.code}`;

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    });
  } catch (error) {
    log.error("Coding AI error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "coding.error"), {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    });
  }
}

/**
 * Show coding conversation history
 */
export async function codingHistoryHandler(ctx: BotContext): Promise<void> {
  await showHistory(ctx, "coding");
}

/**
 * Resume a coding conversation
 */
export async function resumeCodingHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const conversationId = data.replace("resume:coding:", "");
  if (!conversationId) return;

  const resumed = await resumeConversation(ctx, conversationId);
  if (!resumed) {
    await ctx.reply(t(lang, "coding.error"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(t(lang, "coding.resumed"), {
    parse_mode: "Markdown",
    reply_markup: codingKeyboard,
  });
}

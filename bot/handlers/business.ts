import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { businessAIService } from "@/services/ai/business";
import { businessKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";

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

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "business.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const result = await businessAIService.generate(text, type);

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
    console.error("Business AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "business.error"), {
      parse_mode: "Markdown",
      reply_markup: businessKeyboard,
    });
  }
}

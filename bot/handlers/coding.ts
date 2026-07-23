import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { codingAIService } from "@/services/ai/coding";
import { codingKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";

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

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "coding.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const result = await codingAIService.generate(text, language);

    const response = `${t(lang, "coding.result_title", { language })}\n\n${result.code}`;

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    });
  } catch (error) {
    console.error("Coding AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "coding.error"), {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    });
  }
}

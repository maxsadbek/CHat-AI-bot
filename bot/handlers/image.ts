import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { imageAIService } from "@/services/ai/image";
import { imageKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";

/**
 * Image AI handler
 * Generates detailed prompts for various image AI platforms
 * Clears stale mode data and sets step to IMAGE_PROMPT.
 */
export async function imageHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedImagePlatform = "all";
  ctx.session.step = BotStep.IMAGE_PROMPT;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "image.welcome"), {
    parse_mode: "Markdown",
    reply_markup: imageKeyboard,
  });
}

/**
 * Handle image prompt generation
 * Uses the currently selected platform stored in session (selectedImagePlatform).
 */
export async function imageGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedImagePlatform ?? "all";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "image.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await imageAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform
    );

    let response = t(lang, "image.result_title");
    for (const prompt of prompts) {
      response += `*${prompt.platform}*\n`;
      response += `${prompt.fullPrompt}\n\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  } catch (error) {
    console.error("Image AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "image.error"), {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  }
}

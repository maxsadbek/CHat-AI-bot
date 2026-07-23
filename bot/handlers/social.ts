import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { socialAIService } from "@/services/ai/social";
import { socialKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";

/**
 * Social Media handler
 * Generates platform-optimized social media content
 * Clears stale mode data and sets step to SOCIAL_MEDIA.
 */
export async function socialHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedSocialPlatform = "all";
  ctx.session.step = BotStep.SOCIAL_MEDIA;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "social.welcome"), {
    parse_mode: "Markdown",
    reply_markup: socialKeyboard,
  });
}

/**
 * Handle social media content generation
 * Uses the currently selected platform stored in session (selectedSocialPlatform).
 */
export async function socialGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedSocialPlatform ?? "all";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "social.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const contents = await socialAIService.generateContent(
      text,
      platform === "all" ? undefined : platform,
      "professional",
      ctx.session.selectedModel
    );

    let response = t(lang, "social.result_title");
    for (const content of contents) {
      response += `*${content.platform}*\n`;
      response += `${content.caption}\n\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: socialKeyboard,
    });
  } catch (error) {
    console.error("Social Media AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "social.error"), {
      parse_mode: "Markdown",
      reply_markup: socialKeyboard,
    });
  }
}

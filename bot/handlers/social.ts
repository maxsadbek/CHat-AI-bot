import type { BotContext, SocialPlatform } from "@/types";
import { BotStep } from "@/types";
import { socialAIService } from "@/services/ai/social";
import { socialKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";

/**
 * Social Media handler
 * Generates platform-optimized social media content
 * Clears stale mode data and sets step to SOCIAL_MEDIA.
 */
export async function socialHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedSocialPlatform = "all";
  ctx.session.step = BotStep.SOCIAL_MEDIA;

  await ctx.reply(
    "📱 *Social Media Studio*\n\n" +
      "Generate engaging content for:\n" +
      "• Instagram 📸\n" +
      "• TikTok 🎵\n" +
      "• Telegram ✈️\n" +
      "• Facebook 📘\n" +
      "• LinkedIn 💼\n" +
      "• YouTube 🎥\n\n" +
      "_Choose a platform or describe your content idea below:_",
    {
      parse_mode: "Markdown",
      reply_markup: socialKeyboard,
    }
  );
}

/**
 * Handle social media content generation
 * Uses the currently selected platform stored in session (selectedSocialPlatform).
 */
export async function socialGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const platform = ctx.session.selectedSocialPlatform ?? "all";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply("📱 *Generating your social media content...*", {
    parse_mode: "Markdown",
  });

  try {
    const contents = await socialAIService.generateContent(
      text,
      platform === "all" ? undefined : platform
    );

    let response = "📱 *Generated Social Media Content*\n\n";
    for (const content of contents) {
      response += `*${content.platform}*\n`;
      response += `${content.caption}\n\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: socialKeyboard,
    });
  } catch (error) {
    console.error("Social Media AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(
      "❌ *Error generating social media content*\n\nPlease try again.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

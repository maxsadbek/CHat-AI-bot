import type { BotContext, VideoPlatform } from "@/types";
import { BotStep } from "@/types";
import { videoAIService } from "@/services/ai/video";
import { videoKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { prisma } from "@/lib/prisma";
import { clearModeData } from "@/bot/session";

/**
 * Video AI handler
 * Generates professional video prompts for various platforms
 * Clears stale mode data and sets step to VIDEO_PROMPT.
 */
export async function videoHandler(ctx: BotContext): Promise<void> {
  // Clear stale conversation/tempData from other modes
  clearModeData(ctx.session);
  ctx.session.selectedVideoPlatform = "all";
  ctx.session.step = BotStep.VIDEO_PROMPT;

  await ctx.reply(
    "🎬 *Video AI Studio*\n\n" +
      "Generate professional prompts for:\n" +
      "• Hailuo AI\n" +
      "• Kling AI\n" +
      "• Google Veo\n" +
      "• Runway\n" +
      "• PixVerse\n\n" +
      "_Choose a platform or describe your video idea below:_",
    {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    }
  );
}

/**
 * Handle video prompt generation
 * Uses the currently selected platform stored in session (selectedVideoPlatform).
 * Platform is set by callback handlers in bot/index.ts.
 */
export async function videoGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const platform = ctx.session.selectedVideoPlatform ?? "all";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply("🎬 *Generating your video prompts...*", {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await videoAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform
    );

    let response = "🎬 *Generated Video Prompts*\n\n";
    for (const prompt of prompts) {
      response += `*${prompt.platform}*\n`;
      response += `${prompt.fullPrompt}\n\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // Clean up generating message
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });

    // Track usage
    const userId = ctx.session.userId;
    if (userId) {
      try {
        await prisma.usage.create({
          data: {
            userId,
            feature: "video",
          },
        });
      } catch {}

      // Update user request count
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            requestsToday: { increment: 1 },
            totalRequests: { increment: 1 },
          },
        });
      } catch {}
    }
  } catch (error) {
    console.error("Video AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(
      "❌ *Error generating video prompts*\n\nPlease try again with a different description.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

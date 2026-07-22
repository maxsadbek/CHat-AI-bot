import type { BotContext, VideoPlatform } from "@/types";
import { BotStep } from "@/types";
import { videoAIService } from "@/services/ai/video";
import { videoKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { prisma } from "@/lib/prisma";

/**
 * Video AI handler
 * Generates professional video prompts for various platforms
 */
export async function videoHandler(ctx: BotContext): Promise<void> {
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
 * Handle video platform selection and prompt generation
 */
export async function videoGenerateHandler(
  ctx: BotContext,
  platform: VideoPlatform | "all"
): Promise<void> {
  const text = ctx.message?.text;
  if (!text && platform === "all") {
    await ctx.reply(
      "🎬 *Describe Your Video*\n\n" +
        "Send me a description of the video you want to create.\n\n" +
        "For example:\n" +
        "_\"A cinematic drone shot of a futuristic city at sunset with neon lights\"_",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
    return;
  }

  if (!text) return;

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
    try {
      await prisma.usage.create({
        data: {
          userId: Number(ctx.from?.id),
          feature: "video",
        },
      });
    } catch {}

    // Update user request count
    try {
      await prisma.user.update({
        where: { telegramId: BigInt(ctx.from!.id) },
        data: {
          requestsToday: { increment: 1 },
          totalRequests: { increment: 1 },
        },
      });
    } catch {}
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

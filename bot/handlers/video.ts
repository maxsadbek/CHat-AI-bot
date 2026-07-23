import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { videoAIService } from "@/services/ai/video";
import { videoKeyboard } from "@/bot/keyboards";
import { prisma } from "@/lib/prisma";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";

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

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "video.welcome"), {
    parse_mode: "Markdown",
    reply_markup: videoKeyboard,
  });
}

/**
 * Handle video prompt generation
 * Uses the currently selected platform stored in session (selectedVideoPlatform).
 * Platform is set by callback handlers in bot/index.ts.
 */
export async function videoGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedVideoPlatform ?? "all";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "video.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await videoAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform,
      ctx.session.selectedModel
    );

    let response = t(lang, "video.result_title");
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
      } catch {
        // Non-critical
      }

      // Update user request count
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            requestsToday: { increment: 1 },
            totalRequests: { increment: 1 },
          },
        });
      } catch {
        // Non-critical
      }
    }
  } catch (error) {
    console.error("Video AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "video.error"), {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  }
}

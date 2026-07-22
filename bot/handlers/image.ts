import type { BotContext, ImagePlatform } from "@/types";
import { BotStep } from "@/types";
import { imageAIService } from "@/services/ai/image";
import { imageKeyboard, backToMainKeyboard } from "@/bot/keyboards";

/**
 * Image AI handler
 * Generates detailed prompts for various image AI platforms
 */
export async function imageHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.IMAGE_PROMPT;

  await ctx.reply(
    "🎨 *Image AI Studio*\n\n" +
      "Generate stunning prompts for:\n" +
      "• GPT Image\n" +
      "• Flux\n" +
      "• Midjourney\n" +
      "• Leonardo\n" +
      "• Ideogram\n\n" +
      "_Choose a platform or describe your image idea below:_",
    {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    }
  );
}

/**
 * Handle image platform selection and prompt generation
 */
export async function imageGenerateHandler(
  ctx: BotContext,
  platform: ImagePlatform | "all"
): Promise<void> {
  const text = ctx.message?.text;
  if (!text) {
    await ctx.reply(
      "🎨 *Describe Your Image*\n\n" +
        "Send me a description of the image you want to create.\n\n" +
        "For example:\n" +
        "_\"A mystical forest with glowing mushrooms and bioluminescent creatures\"_",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
    return;
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply("🎨 *Generating your image prompts...*", {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await imageAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform
    );

    let response = "🎨 *Generated Image Prompts*\n\n";
    for (const prompt of prompts) {
      response += `*${prompt.platform}*\n`;
      response += `${prompt.fullPrompt}\n\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  } catch (error) {
    console.error("Image AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(
      "❌ *Error generating image prompts*\n\nPlease try again with a different description.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

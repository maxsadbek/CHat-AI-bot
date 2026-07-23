import type { BotContext, BusinessContentType } from "@/types";
import { BotStep } from "@/types";
import { businessAIService } from "@/services/ai/business";
import { businessKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";

/**
 * Business AI handler
 * Generates business ideas, plans, strategies, and branding
 * Clears stale mode data and sets step to BUSINESS.
 */
export async function businessHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedBusinessType = "startup_idea";
  ctx.session.step = BotStep.BUSINESS;

  await ctx.reply(
    "💼 *Business AI Studio*\n\n" +
      "Generate:\n" +
      "• 💡 Startup Ideas\n" +
      "• 📋 Business Plans\n" +
      "• 📈 Marketing Strategies\n" +
      "• 🏷️ Brand Names\n" +
      "• 📝 Slogans\n" +
      "• 🎨 Logo Prompts\n" +
      "• 🎨 Color Palettes\n" +
      "• 🌐 Landing Page Copy\n\n" +
      "_Choose a type or describe your business need below:_",
    {
      parse_mode: "Markdown",
      reply_markup: businessKeyboard,
    }
  );
}

/**
 * Handle business content generation
 * Uses the currently selected type stored in session (selectedBusinessType).
 */
export async function businessGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const type = ctx.session.selectedBusinessType ?? "startup_idea";

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply("💼 *Generating your business content...*", {
    parse_mode: "Markdown",
  });

  try {
    const result = await businessAIService.generate(text, type);

    const response = `💼 *${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}*\n\n${result.content}`;

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: businessKeyboard,
    });
  } catch (error) {
    console.error("Business AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(
      "❌ *Error generating business content*\n\nPlease try again.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

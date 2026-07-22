import type { BotContext, CodeLanguage } from "@/types";
import { BotStep } from "@/types";
import { codingAIService } from "@/services/ai/coding";
import { codingKeyboard, backToMainKeyboard } from "@/bot/keyboards";

/**
 * Coding AI handler
 * Generates code, debugs, and explains programming concepts
 */
export async function codingHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.CODING;

  await ctx.reply(
    "💻 *Coding AI Studio*\n\n" +
      "Generate, debug, and explain code in:\n" +
      "• 🌐 HTML\n" +
      "• 🎨 CSS\n" +
      "• ⚛️ React\n" +
      "• ▲ Next.js\n" +
      "• 🎨 Tailwind\n" +
      "• 🟢 Node.js\n" +
      "• 🚀 Express\n" +
      "• 📊 Prisma\n" +
      "• 🗄️ SQL\n" +
      "• 🔌 API\n\n" +
      "_Choose a language or describe what you want to build:_",
    {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    }
  );
}

/**
 * Handle coding language selection and code generation
 */
export async function codingGenerateHandler(
  ctx: BotContext,
  language: CodeLanguage
): Promise<void> {
  const text = ctx.message?.text;
  if (!text) {
    await ctx.reply(
      "💻 *Describe What to Build*\n\n" +
        `Send me a description of what you want to create in ${language}.\n\n` +
        "For example:\n" +
        "_\"A responsive navbar with dropdown menu and mobile hamburger\"_",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
    return;
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply("💻 *Generating your code...*", {
    parse_mode: "Markdown",
  });

  try {
    const result = await codingAIService.generate(text, language);

    const response = `💻 *${language} Code*\n\n${result.code}`;

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: codingKeyboard,
    });
  } catch (error) {
    console.error("Coding AI error:", error);
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id);
    await ctx.reply(
      "❌ *Error generating code*\n\nPlease try again with a different description.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

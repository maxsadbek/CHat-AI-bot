import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { openai } from "@/lib/openai";
import { env } from "@/config";
import { backToMainKeyboard } from "@/bot/keyboards";

/**
 * Translate AI handler
 * Provides AI-powered text translation between languages
 */
export async function translateHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.TRANSLATE;

  await ctx.reply(
    "🌍 *AI Translator*\n\n" +
      "Translate text between any languages.\n\n" +
      "_Send me text to translate in this format:_\n\n" +
      "```\n" +
      "Translate to [language]:\n" +
      "[your text here]\n" +
      "```\n\n" +
      "_Or just send text and I'll ask you the target language._\n\n" +
      "Examples:\n" +
      '• `Translate to Spanish: Hello, how are you?`\n' +
      '• `Translate to Japanese: I love programming`\n' +
      '• `Translate to French: What time is it?`',
    {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard,
    }
  );
}

/**
 * Handle translation request
 */
export async function translateProcessHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  // Parse language and text
  const translateMatch = text.match(
    /^[Tt]ranslate\s+to\s+(\w+):?\s*([\s\S]*)/
  );

  let targetLanguage: string;
  let sourceText: string;

  if (translateMatch) {
    targetLanguage = translateMatch[1] ?? "English";
    sourceText = translateMatch[2]?.trim() ?? text;
  } else {
    await ctx.reply(
      "🌍 *Target Language?*\n\n" +
        "What language should I translate this to?\n" +
        "Send the language name (e.g., Spanish, French, Japanese)",
      { parse_mode: "Markdown" }
    );
    // Store text for later
    ctx.session.tempData.pendingTranslation = text;
    return;
  }

  await ctx.replyWithChatAction("typing");

  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Translate the text accurately while preserving tone and meaning. Only respond with the translated text.",
        },
        {
          role: "user",
          content: `Translate this to ${targetLanguage}: ${sourceText}`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    const translated = completion.choices[0]?.message?.content;
    if (!translated) throw new Error("No translation");

    const response = [
      "🌍 *Translation*\n",
      `*From:* ${sourceText}\n`,
      `*To (${targetLanguage}):* ${translated}`,
    ].join("\n");

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard,
    });
  } catch (error) {
    console.error("Translate error:", error);
    await ctx.reply(
      "❌ *Error translating text*\n\nPlease try again.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

/**
 * Handle target language response for pending translation
 */
export async function translateLanguageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  const pendingText = ctx.session.tempData.pendingTranslation;
  if (!text || !pendingText) {
    await translateHandler(ctx);
    return;
  }

  ctx.session.tempData.pendingTranslation = "";
  await ctx.replyWithChatAction("typing");

  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Translate accurately while preserving tone and meaning.",
        },
        {
          role: "user",
          content: `Translate this to ${text}: ${pendingText}`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    const translated = completion.choices[0]?.message?.content;
    if (!translated) throw new Error("No translation");

    const response = [
      "🌍 *Translation*\n",
      `*From:* ${pendingText}\n`,
      `*To (${text}):* ${translated}`,
    ].join("\n");

    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard,
    });
  } catch (error) {
    console.error("Translate error:", error);
    await ctx.reply(
      "❌ *Error translating text*\n\nPlease try again.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  }
}

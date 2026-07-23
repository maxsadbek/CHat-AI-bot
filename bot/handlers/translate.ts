import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { backToMainKeyboard } from "@/bot/keyboards";
import { providerRegistry } from "@/services/ai/providers";

/**
 * Translate AI handler
 * Provides AI-powered text translation between languages
 */
export async function translateHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.step = BotStep.TRANSLATE;
  ctx.session.tempData.pendingTranslation = "";

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "translate.welcome"), {
    parse_mode: "Markdown",
    reply_markup: backToMainKeyboard,
  });
}

/**
 * Handle translation request
 */
export async function translateProcessHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;

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
    await ctx.reply(t(lang, "translate.ask_language"), {
      parse_mode: "Markdown",
    });
    // Store text for later
    ctx.session.tempData.pendingTranslation = text;
    return;
  }

  await ctx.replyWithChatAction("typing");

  try {
    const provider = providerRegistry.getProvider(ctx.session.selectedModel);
    const translationResponse = await provider.chat({
      messages: [{ role: "user", content: `Translate this to ${targetLanguage}: ${sourceText}` }],
      systemPrompt: "You are a professional translator. Translate the text accurately while preserving tone and meaning. Only respond with the translated text.",
      maxTokens: 2048,
      temperature: 0.3,
    });

    const translated = translationResponse.content;
    if (!translated) throw new Error("No translation");

    await ctx.reply(
      t(lang, "translate.result", {
        source: sourceText,
        language: targetLanguage,
        translated,
      }),
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  } catch (error) {
    console.error("Translate error:", error);
    await ctx.reply(t(lang, "translate.error"), {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard,
    });
  }
}

/**
 * Handle target language response for pending translation
 */
export async function translateLanguageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  const pendingText = ctx.session.tempData.pendingTranslation;
  const lang = ctx.session.language;

  if (!text || !pendingText) {
    await translateHandler(ctx);
    return;
  }

  await ctx.replyWithChatAction("typing");

  try {
    const provider = providerRegistry.getProvider(ctx.session.selectedModel);
    const translationResponse = await provider.chat({
      messages: [{ role: "user", content: `Translate this to ${text}: ${pendingText}` }],
      systemPrompt: "You are a professional translator. Translate accurately while preserving tone and meaning.",
      maxTokens: 2048,
      temperature: 0.3,
    });

    const translated = translationResponse.content;
    if (!translated) throw new Error("No translation");

    // Clear pending translation after successful processing
    ctx.session.tempData.pendingTranslation = "";

    await ctx.reply(
      t(lang, "translate.result", {
        source: pendingText,
        language: text,
        translated,
      }),
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard,
      }
    );
  } catch (error) {
    console.error("Translate error:", error);
    await ctx.reply(t(lang, "translate.error"), {
      parse_mode: "Markdown",
    });
  }
}

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { translateKeyboard } from "@/bot/keyboards";
import { providerRegistry } from "@/services/ai/providers";
import { logger } from "@/bot/core/logger";
import {
  createConversation,
  saveMessagesToDb,
  showHistory,
  resumeConversation,
} from "@/bot/handlers/history";

const log = logger.child("handler-translate");

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
    reply_markup: translateKeyboard,
  });
}

/**
 * Handle translation request
 */
export async function translateProcessHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  if (!userId) return;

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

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const created = await createConversation(
      ctx,
      `Translation: ${sourceText.slice(0, 90)}`,
      "translate"
    );
    if (!created) {
      await ctx.reply(t(lang, "translate.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
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

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: translated });

    // Save to database
    await saveMessagesToDb(ctx, "translate");

    await ctx.reply(
      t(lang, "translate.result", {
        source: sourceText,
        language: targetLanguage,
        translated,
      }),
      {
        parse_mode: "Markdown",
        reply_markup: translateKeyboard,
      }
    );
  } catch (error) {
    log.error("Translate error", { userId, error: String(error) });
    await ctx.reply(t(lang, "translate.error"), {
      parse_mode: "Markdown",
      reply_markup: translateKeyboard,
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
  const userId = ctx.session.userId;

  if (!text || !pendingText || !userId) {
    await translateHandler(ctx);
    return;
  }

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const created = await createConversation(
      ctx,
      `Translation: ${pendingText.slice(0, 90)}`,
      "translate"
    );
    if (!created) {
      await ctx.reply(t(lang, "translate.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
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

    // Clear pending translation
    ctx.session.tempData.pendingTranslation = "";

    // Store in session
    ctx.session.messages.push({ role: "user", content: pendingText });
    ctx.session.messages.push({ role: "assistant", content: translated });

    // Save to database
    await saveMessagesToDb(ctx, "translate");

    await ctx.reply(
      t(lang, "translate.result", {
        source: pendingText,
        language: text,
        translated,
      }),
      {
        parse_mode: "Markdown",
        reply_markup: translateKeyboard,
      }
    );
  } catch (error) {
    log.error("Translate error", { userId, error: String(error) });
    await ctx.reply(t(lang, "translate.error"), {
      parse_mode: "Markdown",
    });
  }
}

/**
 * Show translate history
 */
export async function translateHistoryHandler(ctx: BotContext): Promise<void> {
  await showHistory(ctx, "translate");
}

/**
 * Resume a translate conversation
 */
export async function resumeTranslateHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const conversationId = data.replace("resume:translate:", "");
  if (!conversationId) return;

  const resumed = await resumeConversation(ctx, conversationId);
  if (!resumed) {
    await ctx.reply(t(lang, "translate.error"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(t(lang, "translate.resumed"), {
    parse_mode: "Markdown",
    reply_markup: translateKeyboard,
  });
}

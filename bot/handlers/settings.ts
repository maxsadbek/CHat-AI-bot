/**
 * Settings Handler
 * Premium settings page with:
 * - Change Language
 * - AI Model
 * - Clear Conversations
 * - Privacy Policy
 * - About
 * - Back to Main Menu
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { t } from "@/bot/localization";
import { settingsKeyboard, modelProviderKeyboard, modelSelectionKeyboard, languageKeyboard, confirmKeyboard, backToMainKeyboard } from "@/bot/keyboards";
import { sessionManager } from "@/bot/core/session-manager";

/**
 * Show settings menu
 */
export async function settingsHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.SETTINGS;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "settings.title"), {
    parse_mode: "Markdown",
    reply_markup: settingsKeyboard,
  });
}

/**
 * Show language settings
 */
export async function settingsLanguageHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  ctx.session.step = BotStep.LANGUAGE;

  await ctx.reply(t(lang, "settings.change_language"), {
    parse_mode: "Markdown",
    reply_markup: languageKeyboard(),
  });
}

/**
 * Show AI model selection — first choose provider
 */
export async function settingsModelHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const currentModel = ctx.session.selectedModel ?? "gpt-4o";

  await ctx.reply(t(lang, "settings.model", { model: currentModel }), {
    parse_mode: "Markdown",
    reply_markup: modelProviderKeyboard,
  });
}

/**
 * Show models for a specific provider
 */
export async function settingsModelProviderHandler(ctx: BotContext, provider: string): Promise<void> {
  const lang = ctx.session.language;
  await ctx.reply(t(lang, "settings.select_model", { provider }), {
    parse_mode: "Markdown",
    reply_markup: modelSelectionKeyboard(provider),
  });
}

/**
 * Handle model selection and save to session
 * NOTE: answerCallbackQuery is already called by the router — do NOT call it here again.
 */
export async function settingsModelSelectHandler(ctx: BotContext, modelId: string): Promise<void> {
  const lang = ctx.session.language;
  sessionManager.setModel(ctx.session, modelId);

  await ctx.editMessageText(t(lang, "settings.model_changed", { model: modelId }), {
    parse_mode: "Markdown",
    reply_markup: settingsKeyboard,
  });
}

/**
 * Show clear conversations confirmation
 */
export async function settingsClearHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  await ctx.reply(t(lang, "settings.clear"), {
    parse_mode: "Markdown",
    reply_markup: confirmKeyboard("clear"),
  });
}

/**
 * Show privacy policy
 */
export async function settingsPrivacyHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  await ctx.reply(t(lang, "settings.privacy"), {
    parse_mode: "Markdown",
    reply_markup: backToMainKeyboard,
  });
}

/**
 * Show about page
 */
export async function settingsAboutHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  await ctx.reply(t(lang, "settings.about"), {
    parse_mode: "Markdown",
    reply_markup: backToMainKeyboard,
  });
}

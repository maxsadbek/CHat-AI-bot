/**
 * Language Selection Handler
 * Handles first-time language selection and changing language from settings.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { t, SUPPORTED_LANGUAGES } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import { languageKeyboard, mainMenuKeyboard } from "@/bot/keyboards";
import { prisma } from "@/lib/prisma";

/**
 * Show language selection screen
 * Used on first /start and from settings
 */
export async function languageSelectionHandler(
  ctx: BotContext,
  fromSettings: boolean = false
): Promise<void> {
  ctx.session.step = BotStep.LANGUAGE;

  const lang = ctx.session.language;

  if (fromSettings) {
    await ctx.reply(t(lang, "settings.change_language"), {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard(),
    });
  } else {
    await ctx.reply(t(lang, "language.select"), {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard(),
    });
  }
}

/**
 * Handle language selection callback
 * Saves the selected language to session and database
 */
export async function handleLanguageSelection(ctx: BotContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData) return;

  const selectedLang = callbackData.replace("lang:", "") as SupportedLanguage;

  if (!SUPPORTED_LANGUAGES.includes(selectedLang)) return;

  // Save to session
  ctx.session.language = selectedLang;
  ctx.session.languageSelected = true;
  ctx.session.step = BotStep.IDLE;

  // Save to database if user exists
  if (ctx.session.userId) {
    try {
      await prisma.userSettings.upsert({
        where: { userId: ctx.session.userId },
        update: { language: selectedLang },
        create: {
          userId: ctx.session.userId,
          language: selectedLang,
        },
      });
    } catch (error) {
      console.error("Failed to save language preference:", error);
    }
  }

  await ctx.answerCallbackQuery();

  // Show confirmation and main menu
  const greeting = t(selectedLang, "language.selected");
  const mainMenu = t(selectedLang, "menu.main");

  await ctx.editMessageText(
    `${greeting}\n\n${mainMenu}`,
    {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    }
  );
}

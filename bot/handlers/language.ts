/**
 * Language Selection Handler
 * Handles first-time language selection and changing language from settings.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { t, SUPPORTED_LANGUAGES } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import { mainMenuKeyboard } from "@/bot/keyboards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/utils/helpers";

/**
 * Handle language selection callback
 * Called when user picks a language from the /start language prompt.
 * Saves language to DB, shows welcome, then opens Main Menu.
 *
 * New user flow:
 *   /start → language selection → handleLanguageSelection → Welcome → Main Menu
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

  // Delete the language selection message
  try {
    await ctx.deleteMessage();
  } catch {
    // Ignore if message can't be deleted
  }

  // ─── Language confirmation + Welcome (shown once, right after language selection) ──
  const firstName = ctx.from?.first_name ?? "there";
  const now = new Date();
  const welcomeMessage = [
    `${t(selectedLang, "language.selected")}\n`,
    "",
    `${t(selectedLang, "welcome.title")}\n`,
    `${t(selectedLang, "welcome.greeting", { name: firstName })}\n`,
    `${t(selectedLang, "welcome.description")}\n`,
    `━━━━━━━━━━━━━━━━━━━━━\n`,
    `${t(selectedLang, "welcome.cta")}`,
    `\n━━━━━━━━━━━━━━━━━━━━━`,
    `\n${t(selectedLang, "welcome.date", { date: formatDate(now) })}`,
  ].join("\n");

  try {
    await ctx.replyWithPhoto(
      "https://img.freepik.com/free-vector/artificial-intelligence-robot-technology-background_1017-33446.jpg",
      {
        caption: welcomeMessage,
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard,
      }
    );
  } catch {
    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
      link_preview_options: { is_disabled: true },
    });
  }
}

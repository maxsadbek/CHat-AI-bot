/**
 * Language Selection Handler
 * Handles first-time language selection and changing language from settings.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { t, SUPPORTED_LANGUAGES } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import { mainMenuKeyboard, onboardingStartKeyboard } from "@/bot/keyboards";
import { safeEditMessageText } from "@/bot/utils/telegram";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/utils/helpers";
import { logger } from "@/bot/core/logger";

const log = logger.child("language-handler");

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

  // ─── Step order: verify DB → write DB → update session ──
  // Never update session before verifying the user exists in DB.
  // Otherwise a cold-start session loss would mark language as selected
  // in memory without persisting it, causing a loop.

  // Step 1: Verify user exists (middleware must have set userId)
  if (!ctx.session.userId) {
    await ctx.answerCallbackQuery();
    await safeEditMessageText(ctx, "❌ *Profile not found.* Please use /start again.", {
      parse_mode: "Markdown",
    });
    return;
  }

  // Step 2: Save language to database first
  // If this fails, session is NOT updated — user stays unconfigured.
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
    await ctx.answerCallbackQuery();
    log.error("Failed to save language preference — profile creation incomplete", {
      userId: ctx.session.userId,
      language: selectedLang,
      error: String(error),
    });
    await safeEditMessageText(ctx, "❌ *Could not save your settings.* Please try /start again.", {
      parse_mode: "Markdown",
    });
    return;
  }

  // Step 3: Update session — only after DB write succeeded
  ctx.session.language = selectedLang;
  ctx.session.languageSelected = true;
  ctx.session.step = BotStep.IDLE;

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

  // ─── Interactive onboarding invite (first-use only) ──
  // Encourages the new user to try each main feature once.
  // Clicking the button opens the guided tour with one button per feature.
  try {
    await ctx.reply(t(selectedLang, "welcome.tour_invite"), {
      parse_mode: "Markdown",
      reply_markup: onboardingStartKeyboard,
    });
  } catch (error) {
    // Non-critical — the main menu already lists all features
    log.debug("Onboarding invite failed (non-critical)", { error: String(error) });
  }
}

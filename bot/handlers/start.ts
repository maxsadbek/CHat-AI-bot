import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard, languageKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { config } from "@/config";
import { resetSession } from "@/bot/session";
import { t } from "@/bot/localization";

/**
 * /start command handler
 * Shows a premium welcome message with animated emojis and inline keyboard.
 * ALWAYS fully resets the user session before showing the main menu.
 * If user hasn't selected a language yet, shows language selection first.
 */
export async function startHandler(ctx: BotContext): Promise<void> {
  const firstName = ctx.from?.first_name ?? "there";
  const now = new Date();

  // ─── Full session reset ───────────────────────────
  // Clear any stale mode data, conversation state, tempData
  // Keep userId and language preferences intact
  resetSession(ctx.session, true);

  // ─── Language Selection for New Users ────────────
  // If user hasn't selected a language yet, show language picker first
  if (!ctx.session.languageSelected) {
    ctx.session.step = BotStep.LANGUAGE;
    await ctx.reply(t(ctx.session.language, "language.select"), {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard(),
    });
    return;
  }

  const lang = ctx.session.language;

  // Welcome message with premium formatting
  const welcomeMessage = [
    `${t(lang, "welcome.title")}\n`,
    `${t(lang, "welcome.greeting", { name: firstName })}\n`,
    `${t(lang, "welcome.description")}\n`,
    `━━━━━━━━━━━━━━━━━━━━━\n`,
    `${t(lang, "welcome.cta")}`,
    `\n━━━━━━━━━━━━━━━━━━━━━`,
    `\n${t(lang, "welcome.date", { date: formatDate(now) })}`,
  ].join("\n");

  // Send welcome message with photo (if available) or text only
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
    // Fallback to text-only if photo fails
    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
      link_preview_options: { is_disabled: true },
    });
  }

  ctx.session.step = BotStep.IDLE;
}

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard, languageKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { resetSession } from "@/bot/session";
import { t } from "@/bot/localization";

/**
 * /start command handler
 * Resets session, keeps user account, opens Main Menu only.
 * Never auto-opens Chat, Image, or any other feature.
 * If user hasn't selected a language yet, shows language selection first.
 */
export async function startHandler(ctx: BotContext): Promise<void> {
  const firstName = ctx.from?.first_name ?? "there";
  const now = new Date();

  // ─── Full session reset ───────────────────────────
  // Reset temporary state, close active mode, keep userId and language
  resetSession(ctx.session, true);
  ctx.session.step = BotStep.IDLE;

  // ─── Language Selection for New Users ────────────
  if (!ctx.session.languageSelected) {
    ctx.session.step = BotStep.LANGUAGE;
    await ctx.reply(t(ctx.session.language, "language.select"), {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard(),
    });
    return;
  }

  const lang = ctx.session.language;

  // Welcome message (same design, preserved branding)
  const welcomeMessage = [
    `${t(lang, "welcome.title")}\n`,
    `${t(lang, "welcome.greeting", { name: firstName })}\n`,
    `${t(lang, "welcome.description")}\n`,
    `━━━━━━━━━━━━━━━━━━━━━\n`,
    `${t(lang, "welcome.cta")}`,
    `\n━━━━━━━━━━━━━━━━━━━━━`,
    `\n${t(lang, "welcome.date", { date: formatDate(now) })}`,
  ].join("\n");

  // Send welcome with photo (preserving existing branding)
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

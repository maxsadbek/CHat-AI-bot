import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { config } from "@/config";
import { resetSession } from "@/bot/session";

/**
 * /start command handler
 * Shows a premium welcome message with animated emojis and inline keyboard
 * ALWAYS fully resets the user session before showing the main menu.
 */
export async function startHandler(ctx: BotContext): Promise<void> {
  const firstName = ctx.from?.first_name ?? "there";
  const now = new Date();

  // ─── Full session reset ───────────────────────────
  // Clear any stale mode data, conversation state, tempData
  // Keep userId intact so downstream handlers can identify the user
  resetSession(ctx.session, true);

  // Welcome message with premium formatting
  const welcomeMessage = [
    `✨ *Welcome to AI Creator Studio!* ✨\n`,
    `Hey ${firstName}! 👋\n`,
    `Your all-in-one AI platform for:\n\n` +
      `🤖 *AI Chat* — Smart conversations\n` +
      `🎬 *Video AI* — Cinematic prompts\n` +
      `🎨 *Image AI* — Stunning visuals\n` +
      `📱 *Social Media* — Viral content\n` +
      `💻 *Coding* — Production code\n` +
      `💼 *Business* — Growth strategies\n` +
      `🌍 *Translate* — Global reach\n`,
    `━━━━━━━━━━━━━━━━━━━━━\n`,
    `🚀 *Ready to create something amazing?*\n`,
    `Choose a feature below 👇`,
    `\n━━━━━━━━━━━━━━━━━━━━━`,
    `\n📅 ${formatDate(now)}`,
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

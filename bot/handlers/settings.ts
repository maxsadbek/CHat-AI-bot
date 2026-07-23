/**
 * Settings Handler
 * Provides user settings interface including language change.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { t } from "@/bot/localization";
import { settingsKeyboard } from "@/bot/keyboards";

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

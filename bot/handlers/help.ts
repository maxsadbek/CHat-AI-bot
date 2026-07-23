import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard } from "@/bot/keyboards";
import { t } from "@/bot/localization";

/**
 * Help handler
 * Shows comprehensive usage guide and available features
 */
export async function helpHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.HELP;
  const lang = ctx.session.language;

  const helpText = [
    "━━━━━━━━━━━━━━━━━━━━━",
    t(lang, "help.title"),
    "━━━━━━━━━━━━━━━━━━━━━\n",
    t(lang, "help.subtitle"),
    "\n\n",
    t(lang, "help.start"),
    "\n",
    t(lang, "help.menu"),
    "\n",
    t(lang, "help.cancel"),
    "\n",
    t(lang, "help.help_cmd"),
    "\n",
    t(lang, "help.chat_cmd"),
    "\n",
    t(lang, "help.image_cmd"),
    "\n",
    t(lang, "help.video_cmd"),
    "\n",
    t(lang, "help.coding_cmd"),
    "\n",
    t(lang, "help.social_cmd"),
    "\n",
    t(lang, "help.business_cmd"),
    "\n",
    t(lang, "help.translate_cmd"),
    "\n\n",
    t(lang, "help.features_title"),
    "\n\n",
    t(lang, "help.chat_desc"),
    "\n\n",
    t(lang, "help.video_desc"),
    "\n\n",
    t(lang, "help.image_desc"),
    "\n\n",
    t(lang, "help.social_desc"),
    "\n\n",
    t(lang, "help.coding_desc"),
    "\n\n",
    t(lang, "help.business_desc"),
    "\n\n",
    t(lang, "help.translate_desc"),
    "\n\n",
    "━━━━━━━━━━━━━━━━━━━━━\n",
    t(lang, "help.tips_title"),
    "\n\n",
    t(lang, "help.tip1"),
    "\n",
    t(lang, "help.tip2"),
    "\n",
    t(lang, "help.tip3"),
    "\n",
    t(lang, "help.tip4"),
    "\n\n",
    "━━━━━━━━━━━━━━━━━━━━━\n",
    t(lang, "help.cta"),
  ].join("");

  await ctx.reply(helpText, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

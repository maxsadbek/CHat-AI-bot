import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { helpKeyboard, mainMenuKeyboard } from "@/bot/keyboards";
import { t } from "@/bot/localization";

/**
 * Help Center handler
 * Shows a visual help menu with categorized feature explanations.
 * Replaces the old command-list help with an interactive UX.
 */
export async function helpHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.HELP;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "help.title"), {
    parse_mode: "Markdown",
    reply_markup: helpKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Show specific feature help
 */
export async function helpFeatureHandler(ctx: BotContext, feature: string): Promise<void> {
  const lang = ctx.session.language;
  const helpKey = `help.${feature}`;

  const helpText = t(lang, helpKey);
  
  // If the key doesn't resolve to a meaningful string, fall back to generic help
  const featureHelp = helpText === helpKey ? 
    `ℹ️ *${feature.charAt(0).toUpperCase() + feature.slice(1)}* feature information coming soon.` : 
    helpText;

  await ctx.reply(featureHelp, {
    parse_mode: "Markdown",
    reply_markup: helpKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Show tips
 */
export async function helpTipsHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  const tipsText = [
    `━━━━━━━━━━━━━━━━━━━━━`,
    t(lang, "help.tips_title"),
    `━━━━━━━━━━━━━━━━━━━━━`,
    "",
    t(lang, "help.tip1"),
    "",
    t(lang, "help.tip2"),
    "",
    t(lang, "help.tip3"),
    "",
    t(lang, "help.tip4"),
    "",
    "━━━━━━━━━━━━━━━━━━━━━",
    t(lang, "help.support"),
  ].join("\n");

  await ctx.reply(tipsText, {
    parse_mode: "Markdown",
    reply_markup: helpKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

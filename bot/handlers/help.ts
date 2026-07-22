import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard, backToMainKeyboard } from "@/bot/keyboards";

/**
 * Help handler
 * Shows comprehensive usage guide and available features
 */
export async function helpHandler(ctx: BotContext): Promise<void> {
  ctx.session.step = BotStep.HELP;

  const helpText = [
    "━━━━━━━━━━━━━━━━━━━━━",
    "❓ *AI Creator Studio Help*",
    "━━━━━━━━━━━━━━━━━━━━━\n",
    "*Available Commands:*\n\n",
    "*/start* — Launch the bot and show main menu\n\n",
    "*Features:*\n\n",
    "🤖 *AI Chat*\n",
    "Chat with AI with conversation memory.\n",
    "Just send a message and I'll respond!\n\n",
    "🎬 *Video AI*\n",
    "Generate professional video prompts for:\n",
    "Hailuo AI, Kling AI, Google Veo, Runway, PixVerse\n\n",
    "🎨 *Image AI*\n",
    "Generate detailed image prompts for:\n",
    "GPT Image, Flux, Midjourney, Leonardo, Ideogram\n\n",
    "📱 *Social Media*\n",
    "Create platform-optimized content for:\n",
    "Instagram, TikTok, Telegram, Facebook, LinkedIn, YouTube\n\n",
    "💻 *Coding*\n",
    "Generate, debug, and explain code in:\n",
    "HTML, CSS, React, Next.js, Tailwind, Node.js, Express, Prisma, SQL, API\n\n",
    "💼 *Business*\n",
    "Generate startup ideas, business plans,\n",
    "marketing strategies, brand names, slogans, and more\n\n",
    "🌍 *Translate*\n",
    "Translate text between any languages\n\n",
    "━━━━━━━━━━━━━━━━━━━━━\n",
    "*Tips:*\n\n",
    "• Be specific in your descriptions for better results\n",
    "• Use the menu buttons to navigate features\n",
    "• Your daily usage resets at midnight UTC\n",
    "• Upgrade to Premium for higher limits\n\n",
    "━━━━━━━━━━━━━━━━━━━━━\n",
    "✨ *Ready to create something amazing?*\n",
    "Choose a feature from the menu below! 👇",
  ].join("");

  await ctx.reply(helpText, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

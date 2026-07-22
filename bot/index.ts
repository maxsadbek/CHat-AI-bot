import { Bot, session } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { env } from "@/config";
import { createInitialSession } from "@/bot/middleware";
import { startHandler } from "@/bot/handlers/start";
import {
  aiChatHandler,
  newChatHandler,
  chatHistoryHandler,
} from "@/bot/handlers/ai-chat";
import { videoHandler, videoGenerateHandler } from "@/bot/handlers/video";
import { imageHandler, imageGenerateHandler } from "@/bot/handlers/image";
import { socialHandler, socialGenerateHandler } from "@/bot/handlers/social";
import { businessHandler, businessGenerateHandler } from "@/bot/handlers/business";
import { codingHandler, codingGenerateHandler } from "@/bot/handlers/coding";
import {
  translateHandler,
  translateProcessHandler,
  translateLanguageHandler,
} from "@/bot/handlers/translate";
import { profileHandler } from "@/bot/handlers/profile";
import { helpHandler } from "@/bot/handlers/help";
import { mainMenuKeyboard } from "@/bot/keyboards";

/**
 * Create and configure the Telegram bot
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // ─── Session Middleware ────────────────────────────
  bot.use(
    session({
      initial: createInitialSession,
    })
  );

  // ─── Commands ──────────────────────────────────────
  bot.command("start", startHandler);
  bot.command("help", helpHandler);
  bot.command("profile", profileHandler);
  bot.command("chat", async (ctx) => {
    ctx.session.step = BotStep.AI_CHAT;
    await ctx.reply(
      "🤖 *AI Chat*\n\nSend me a message and I'll respond!",
      { parse_mode: "Markdown" }
    );
  });

  // ─── Callback Queries ─────────────────────────────
  bot.callbackQuery(/^feature:(.+)/, async (ctx) => {
    const feature = ctx.match[1];
    await ctx.answerCallbackQuery();

    switch (feature) {
      case "chat":
        ctx.session.step = BotStep.AI_CHAT;
        await ctx.editMessageText(
          "🤖 *AI Chat*\n\nSend me a message and I'll respond with AI-powered answers!\n\n_Use /new to start a fresh conversation._",
          { parse_mode: "Markdown" }
        );
        break;
      case "video":
        await videoHandler(ctx);
        break;
      case "image":
        await imageHandler(ctx);
        break;
      case "social":
        await socialHandler(ctx);
        break;
      case "business":
        await businessHandler(ctx);
        break;
      case "coding":
        await codingHandler(ctx);
        break;
      case "translate":
        await translateHandler(ctx);
        break;
      case "profile":
        await profileHandler(ctx);
        break;
      case "help":
        await helpHandler(ctx);
        break;
    }
  });

  // Menu navigation
  bot.callbackQuery("menu:main", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = BotStep.IDLE;
    await ctx.editMessageText(
      "🏠 *Main Menu*\n\nChoose a feature below:",
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard }
    );
  });

  // Chat actions
  bot.callbackQuery("chat:new", newChatHandler);
  bot.callbackQuery("chat:history", chatHistoryHandler);

  // Video platform selection
  bot.callbackQuery(/^video:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const platform = ctx.match[1] === "all" ? "all" : ctx.match[1];
    await ctx.editMessageText(
      `🎬 *Video AI* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your video idea:`,
      { parse_mode: "Markdown" }
    );
  });

  // Image platform selection
  bot.callbackQuery(/^image:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const platform = ctx.match[1] === "all" ? "all" : ctx.match[1];
    await ctx.editMessageText(
      `🎨 *Image AI* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your image:`,
      { parse_mode: "Markdown" }
    );
  });

  // Social platform selection
  bot.callbackQuery(/^social:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const platform = ctx.match[1] === "all" ? "all" : ctx.match[1];
    await ctx.editMessageText(
      `📱 *Social Media* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your content:`,
      { parse_mode: "Markdown" }
    );
  });

  // Business type selection
  bot.callbackQuery(/^business:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const type = ctx.match[1] ?? "startup_idea";
    await ctx.editMessageText(
      `💼 *Business* - ${type.replace(/_/g, " ")}\n\nDescribe your business need:`,
      { parse_mode: "Markdown" }
    );
  });

  // Coding language selection
  bot.callbackQuery(/^coding:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const language = ctx.match[1];
    await ctx.editMessageText(
      `💻 *Coding* - ${language}\n\nDescribe what you want to build:`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Text Messages ────────────────────────────────
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;

    switch (step) {
      case BotStep.AI_CHAT:
        await aiChatHandler(ctx);
        break;
      case BotStep.VIDEO_PROMPT:
        await videoGenerateHandler(ctx, "all");
        break;
      case BotStep.IMAGE_PROMPT:
        await imageGenerateHandler(ctx, "all");
        break;
      case BotStep.SOCIAL_MEDIA:
        await socialGenerateHandler(ctx, "all");
        break;
      case BotStep.BUSINESS:
        await businessGenerateHandler(ctx, "startup_idea");
        break;
      case BotStep.CODING:
        await codingGenerateHandler(ctx, "Next.js");
        break;
      case BotStep.TRANSLATE:
        if (ctx.session.tempData.pendingTranslation) {
          await translateLanguageHandler(ctx);
        } else {
          await translateProcessHandler(ctx);
        }
        break;
      default:
        // Default to AI chat for any text
        ctx.session.step = BotStep.AI_CHAT;
        await aiChatHandler(ctx);
        break;
    }
  });

  return bot;
}

/**
 * Bot instance for use in API routes
 */
export const bot = createBot();

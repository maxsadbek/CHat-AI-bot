import { Bot, session } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { env } from "@/config";
import { createInitialSession } from "@/bot/middleware";
import { registerMiddleware } from "@/bot/middleware";
import { resetSession, clearModeData } from "@/bot/session";
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

  // ─── Global Middleware ─────────────────────────────
  registerMiddleware(bot);

  // ─── Commands ──────────────────────────────────────
  bot.command("start", startHandler);
  bot.command("help", helpHandler);
  bot.command("profile", profileHandler);

  // /menu — return to main menu, reset session
  bot.command("menu", async (ctx) => {
    resetSession(ctx.session, true);
    await ctx.reply(
      "🏠 *Main Menu*\n\nChoose a feature below:",
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard }
    );
  });

  // /cancel — cancel current operation, reset to IDLE
  bot.command("cancel", async (ctx) => {
    resetSession(ctx.session, true);
    await ctx.reply(
      "❌ *Cancelled*\n\nCurrent operation has been cancelled.\n\nUse /menu to see the main menu or /start to restart.",
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard }
    );
  });

  bot.command("chat", async (ctx) => {
    clearModeData(ctx.session);
    ctx.session.step = BotStep.AI_CHAT;
    await ctx.reply(
      "🤖 *AI Chat*\n\nSend me a message and I'll respond!",
      { parse_mode: "Markdown", reply_markup: undefined }
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

  // Menu navigation — full session reset
  bot.callbackQuery("menu:main", async (ctx) => {
    await ctx.answerCallbackQuery();
    resetSession(ctx.session, true);
    await ctx.editMessageText(
      "🏠 *Main Menu*\n\nChoose a feature below:",
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard }
    );
  });

  // Chat actions
  bot.callbackQuery("chat:new", newChatHandler);
  bot.callbackQuery("chat:history", chatHistoryHandler);

  // Video platform selection — store in session
  bot.callbackQuery(/^video:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1];
    const platform: import("@/types").VideoPlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").VideoPlatform);
    ctx.session.selectedVideoPlatform = platform;
    await ctx.editMessageText(
      `🎬 *Video AI* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your video idea:`,
      { parse_mode: "Markdown" }
    );
  });

  // Image platform selection — store in session
  bot.callbackQuery(/^image:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1];
    const platform: import("@/types").ImagePlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").ImagePlatform);
    ctx.session.selectedImagePlatform = platform;
    await ctx.editMessageText(
      `🎨 *Image AI* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your image:`,
      { parse_mode: "Markdown" }
    );
  });

  // Social platform selection — store in session
  bot.callbackQuery(/^social:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1];
    const platform: import("@/types").SocialPlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").SocialPlatform);
    ctx.session.selectedSocialPlatform = platform;
    await ctx.editMessageText(
      `📱 *Social Media* - ${platform === "all" ? "All Platforms" : platform}\n\nDescribe your content:`,
      { parse_mode: "Markdown" }
    );
  });

  // Business type selection — store in session
  bot.callbackQuery(/^business:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const businessType = ctx.match[1] as import("@/types").BusinessContentType ?? "startup_idea";
    ctx.session.selectedBusinessType = businessType;
    await ctx.editMessageText(
      `💼 *Business* - ${businessType.replace(/_/g, " ")}\n\nDescribe your business need:`,
      { parse_mode: "Markdown" }
    );
  });

  // Coding language selection — store in session
  bot.callbackQuery(/^coding:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const language = ctx.match[1] as import("@/types").CodeLanguage;
    ctx.session.selectedCodeLanguage = language;
    await ctx.editMessageText(
      `💻 *Coding* - ${language}\n\nDescribe what you want to build:`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Text Messages ────────────────────────────────
  // Route each text message based on the current session step (active AI mode).
  // Each mode uses session-stored platform/language/type selections,
  // ensuring modes are fully isolated from each other.
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;

    switch (step) {
      case BotStep.AI_CHAT:
        await aiChatHandler(ctx);
        break;
      case BotStep.VIDEO_PROMPT:
        await videoGenerateHandler(ctx);
        break;
      case BotStep.IMAGE_PROMPT:
        await imageGenerateHandler(ctx);
        break;
      case BotStep.SOCIAL_MEDIA:
        await socialGenerateHandler(ctx);
        break;
      case BotStep.BUSINESS:
        await businessGenerateHandler(ctx);
        break;
      case BotStep.CODING:
        await codingGenerateHandler(ctx);
        break;
      case BotStep.TRANSLATE:
        if (ctx.session.tempData.pendingTranslation) {
          await translateLanguageHandler(ctx);
        } else {
          await translateProcessHandler(ctx);
        }
        break;
      default:
        // IDLE or unrecognised step — route to AI chat
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

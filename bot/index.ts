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
import { settingsHandler } from "@/bot/handlers/settings";
import {
  languageSelectionHandler,
  handleLanguageSelection,
} from "@/bot/handlers/language";
import { mainMenuKeyboard } from "@/bot/keyboards";
import { t } from "@/bot/localization";

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

  // /menu — return to main menu, reset session, keep user account
  bot.command("menu", async (ctx) => {
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // /cancel — cancel current operation, clear active mode, return to main menu
  bot.command("cancel", async (ctx) => {
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "cancel.done"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Mode switching commands — close previous mode, activate new one with confirmation
  bot.command("chat", async (ctx) => {
    clearModeData(ctx.session);
    ctx.session.step = BotStep.AI_CHAT;
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "mode.switched.chat"), {
      parse_mode: "Markdown",
    });
  });

  bot.command("image", async (ctx) => {
    await imageHandler(ctx);
  });

  bot.command("video", async (ctx) => {
    await videoHandler(ctx);
  });

  bot.command("coding", async (ctx) => {
    await codingHandler(ctx);
  });

  bot.command("social", async (ctx) => {
    await socialHandler(ctx);
  });

  bot.command("business", async (ctx) => {
    await businessHandler(ctx);
  });

  bot.command("translate", async (ctx) => {
    await translateHandler(ctx);
  });

  bot.command("settings", async (ctx) => {
    await settingsHandler(ctx);
  });

  bot.command("language", async (ctx) => {
    await languageSelectionHandler(ctx, true);
  });

  // ─── Callback Queries ─────────────────────────────
  bot.callbackQuery(/^feature:(.+)/, async (ctx) => {
    const feature = ctx.match[1];
    await ctx.answerCallbackQuery();

    switch (feature) {
      case "chat": {
        clearModeData(ctx.session);
        ctx.session.step = BotStep.AI_CHAT;
        const lang = ctx.session.language;
        await ctx.editMessageText(t(lang, "chat.welcome"), {
          parse_mode: "Markdown",
        });
        break;
      }
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
      case "settings":
        await settingsHandler(ctx);
        break;
    }
  });

  // Language selection callback
  bot.callbackQuery(/^lang:(.+)/, handleLanguageSelection);

  // Settings navigation
  bot.callbackQuery("settings:language", async (ctx) => {
    await ctx.answerCallbackQuery();
    await languageSelectionHandler(ctx, true);
  });

  // Menu navigation — full session reset
  bot.callbackQuery("menu:main", async (ctx) => {
    await ctx.answerCallbackQuery();
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
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
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    ctx.session.step = BotStep.VIDEO_PROMPT;
    await ctx.editMessageText(
      t(lang, "video.platform_selected", { platform: platformName }),
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
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    ctx.session.step = BotStep.IMAGE_PROMPT;
    await ctx.editMessageText(
      t(lang, "image.platform_selected", { platform: platformName }),
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
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    ctx.session.step = BotStep.SOCIAL_MEDIA;
    await ctx.editMessageText(
      t(lang, "social.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  // Business type selection — store in session
  bot.callbackQuery(/^business:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const businessType = ctx.match[1] as import("@/types").BusinessContentType ?? "startup_idea";
    ctx.session.selectedBusinessType = businessType;
    const lang = ctx.session.language;
    const typeName = businessType.replace(/_/g, " ");
    ctx.session.step = BotStep.BUSINESS;
    await ctx.editMessageText(
      t(lang, "business.type_selected", { type: typeName }),
      { parse_mode: "Markdown" }
    );
  });

  // Coding language selection — store in session
  bot.callbackQuery(/^coding:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const language = ctx.match[1] as import("@/types").CodeLanguage;
    ctx.session.selectedCodeLanguage = language;
    const lang = ctx.session.language;
    ctx.session.step = BotStep.CODING;
    await ctx.editMessageText(
      t(lang, "coding.language_selected", { language }),
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
        clearModeData(ctx.session);
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

import { Bot, session } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { env } from "@/config";
import { createInitialSession } from "@/bot/middleware";
import { registerMiddleware } from "@/bot/middleware";
import { resetSession, clearModeData } from "@/bot/session";
import { sessionManager } from "@/bot/core/session-manager";
import { modeManager } from "@/bot/core/mode-manager";
import { logger } from "@/bot/core/logger";
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
import { helpHandler, helpFeatureHandler, helpTipsHandler } from "@/bot/handlers/help";
import {
  settingsHandler,
  settingsLanguageHandler,
  settingsModelHandler,
  settingsModelProviderHandler,
  settingsModelSelectHandler,
  settingsClearHandler,
  settingsPrivacyHandler,
  settingsAboutHandler,
} from "@/bot/handlers/settings";
import { handleLanguageSelection } from "@/bot/handlers/language";
import {
  mainMenuKeyboard,
  chatKeyboard,
  settingsKeyboard,
  backToMainKeyboard,
  premiumKeyboard,
} from "@/bot/keyboards";
import { t } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import { prisma } from "@/lib/prisma";

const log = logger.child("bot");

// ─── Mode Switch Actions ──────────────────────────────

async function switchToChat(ctx: BotContext): Promise<void> {
  const msg = modeManager.switchTo(ctx, "chat");
  await ctx.reply(msg, { parse_mode: "Markdown" });
}

async function switchToVideo(ctx: BotContext): Promise<void> {
  await videoHandler(ctx);
}

async function switchToImage(ctx: BotContext): Promise<void> {
  await imageHandler(ctx);
}

async function switchToSocial(ctx: BotContext): Promise<void> {
  await socialHandler(ctx);
}

async function switchToBusiness(ctx: BotContext): Promise<void> {
  await businessHandler(ctx);
}

async function switchToCoding(ctx: BotContext): Promise<void> {
  await codingHandler(ctx);
}

async function switchToTranslate(ctx: BotContext): Promise<void> {
  await translateHandler(ctx);
}

async function switchToProfile(ctx: BotContext): Promise<void> {
  await profileHandler(ctx);
}

async function switchToSettings(ctx: BotContext): Promise<void> {
  await settingsHandler(ctx);
}

async function switchToPremium(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const premiumText = [
    t(lang, "premium.title"),
    "",
    t(lang, "premium.subtitle"),
    "",
    t(lang, "premium.features"),
    "",
    "━━━━━━━━━━━━━━━━━━━━━",
    t(lang, "premium.coming_soon"),
  ].join("\n");

  await ctx.reply(premiumText, {
    parse_mode: "Markdown",
    reply_markup: premiumKeyboard,
  });
}

// ─── Feature Switch Map ───────────────────────────────
const FEATURE_SWITCHES: Record<string, (ctx: BotContext) => Promise<void>> = {
  chat: switchToChat,
  video: switchToVideo,
  image: switchToImage,
  social: switchToSocial,
  business: switchToBusiness,
  coding: switchToCoding,
  translate: switchToTranslate,
  profile: switchToProfile,
  settings: switchToSettings,
  premium: switchToPremium,
  help: async (ctx) => {
    await helpHandler(ctx);
  },
};

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

  log.info("Bot initializing...", { model: env.OPENAI_MODEL });

  // ─── Commands (minimal set) ───────────────────────
  bot.command("start", startHandler);
  bot.command("menu", async (ctx) => {
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });
  bot.command("help", helpHandler);
  bot.command("cancel", async (ctx) => {
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "cancel.done"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // ─── Main Menu Callbacks ──────────────────────────
  bot.callbackQuery(/^feature:(.+)/, async (ctx) => {
    const feature = ctx.match[1] as string;
    await ctx.answerCallbackQuery();

    const handler = FEATURE_SWITCHES[feature];
    if (handler) {
      log.debug("Feature selected", { feature, userId: ctx.from?.id });
      await handler(ctx);
    }
  });

  // ─── Language Selection ───────────────────────────
  bot.callbackQuery(/^lang:(.+)/, handleLanguageSelection);

  // ─── Menu Navigation ──────────────────────────────
  bot.callbackQuery("menu:main", async (ctx) => {
    await ctx.answerCallbackQuery();
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // ─── Chat Actions ─────────────────────────────────
  bot.callbackQuery("chat:new", newChatHandler);
  bot.callbackQuery("chat:history", chatHistoryHandler);
  bot.callbackQuery("chat:clear", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language;
    sessionManager.clearMessages(ctx.session);
    await ctx.editMessageText(t(lang, "chat.clear_done"), {
      parse_mode: "Markdown",
      reply_markup: chatKeyboard,
    });
  });

  // ─── Settings Navigation ──────────────────────────
  bot.callbackQuery("settings:language", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsLanguageHandler(ctx);
  });
  bot.callbackQuery("settings:model", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsModelHandler(ctx);
  });
  bot.callbackQuery("settings:clear", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsClearHandler(ctx);
  });
  bot.callbackQuery("settings:privacy", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsPrivacyHandler(ctx);
  });
  bot.callbackQuery("settings:about", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsAboutHandler(ctx);
  });

  // ─── Model Selection ─────────────────────────────
  bot.callbackQuery("model:providers", async (ctx) => {
    await ctx.answerCallbackQuery();
    await settingsModelHandler(ctx);
  });
  bot.callbackQuery(/^model:provider:(.+)/, async (ctx) => {
    const provider = ctx.match[1] as string;
    await ctx.answerCallbackQuery();
    await settingsModelProviderHandler(ctx, provider);
  });
  bot.callbackQuery(/^model:select:(.+)/, async (ctx) => {
    const modelId = ctx.match[1] as string;
    await settingsModelSelectHandler(ctx, modelId);
  });

  // ─── Clear Conversation Confirmation ──────────────
  bot.callbackQuery("clear:confirm", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language;
    const userId = ctx.session.userId;
    try {
      if (userId) {
        await prisma.conversation.deleteMany({
          where: { userId, feature: "chat" },
        });
      }
    } catch (error) {
      log.error("Clear conversations error", { userId, error: String(error) });
    }
    sessionManager.clearMessages(ctx.session);
    await ctx.editMessageText(t(lang, "settings.cleared"), {
      parse_mode: "Markdown",
      reply_markup: settingsKeyboard,
    });
  });
  bot.callbackQuery("clear:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "settings.title"), {
      parse_mode: "Markdown",
      reply_markup: settingsKeyboard,
    });
  });

  // ─── Help Center ──────────────────────────────────
  bot.callbackQuery(/^help:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const topic = ctx.match[1] ?? "";
    if (topic === "tips") {
      await helpTipsHandler(ctx);
    } else {
      await helpFeatureHandler(ctx, topic);
    }
  });

  // ─── Premium ──────────────────────────────────────
  bot.callbackQuery("premium:upgrade", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "premium.coming_soon"), {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard,
    });
  });

  // ─── Result Actions (future-ready) ────────────────
  bot.callbackQuery("result:copy", async (ctx) => {
    await ctx.answerCallbackQuery("📋 Copied to clipboard!");
  });
  bot.callbackQuery("result:regenerate", async (ctx) => {
    await ctx.answerCallbackQuery("🔄 Regenerating...");
  });

  // ─── Video / Image / Social / Business / Coding Platform Selection ───
  bot.callbackQuery(/^video:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1] ?? "";
    const platform: import("@/types").VideoPlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").VideoPlatform);
    ctx.session.selectedVideoPlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.VIDEO_PROMPT);
    await ctx.editMessageText(
      t(lang, "video.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/^image:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1] ?? "";
    const platform: import("@/types").ImagePlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").ImagePlatform);
    ctx.session.selectedImagePlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.IMAGE_PROMPT);
    await ctx.editMessageText(
      t(lang, "image.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/^social:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const raw = ctx.match[1] ?? "";
    const platform: import("@/types").SocialPlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").SocialPlatform);
    ctx.session.selectedSocialPlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.SOCIAL_MEDIA);
    await ctx.editMessageText(
      t(lang, "social.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/^business:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const businessType = (ctx.match[1] ?? "startup_idea") as import("@/types").BusinessContentType;
    ctx.session.selectedBusinessType = businessType;
    const lang = ctx.session.language;
    const typeName = businessType.replace(/_/g, " ");
    sessionManager.setStep(ctx.session, BotStep.BUSINESS);
    await ctx.editMessageText(
      t(lang, "business.type_selected", { type: typeName }),
      { parse_mode: "Markdown" }
    );
  });

  bot.callbackQuery(/^coding:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const language = (ctx.match[1] ?? "Next.js") as import("@/types").CodeLanguage;
    ctx.session.selectedCodeLanguage = language;
    const lang = ctx.session.language;
    sessionManager.setStep(ctx.session, BotStep.CODING);
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
        // IDLE or unrecognised — route to AI Chat
        clearModeData(ctx.session);
        sessionManager.setStep(ctx.session, BotStep.AI_CHAT);
        const lang = ctx.session.language;
        await ctx.reply(modeManager.getModeSwitchedMessage(lang, "chat"), {
          parse_mode: "Markdown",
        });
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

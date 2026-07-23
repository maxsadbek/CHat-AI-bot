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
  resumeChatHandler,
} from "@/bot/handlers/ai-chat";
import { videoHandler, videoGenerateHandler, videoHistoryHandler, resumeVideoHandler, regenerateVideoHandler } from "@/bot/handlers/video";
import { imageHandler, imageGenerateHandler, imageHistoryHandler, resumeImageHandler } from "@/bot/handlers/image";
import { socialHandler, socialGenerateHandler } from "@/bot/handlers/social";
import {
  businessHandler,
  businessGenerateHandler,
  businessHistoryHandler,
  resumeBusinessHandler,
} from "@/bot/handlers/business";
import {
  codingHandler,
  codingGenerateHandler,
  codingHistoryHandler,
  resumeCodingHandler,
} from "@/bot/handlers/coding";
import {
  translateHandler,
  translateProcessHandler,
  translateLanguageHandler,
  translateHistoryHandler,
  resumeTranslateHandler,
} from "@/bot/handlers/translate";
import { profileHandler } from "@/bot/handlers/profile";
import { premiumHandler, premiumPlanHandler, premiumUpgradeHandler } from "@/bot/handlers/premium";
import {
  projectsHandler,
  projectCreateHandler,
  projectCreateNameHandler,
  projectOpenHandler,
  projectRenameHandler,
  projectRenameNameHandler,
  projectDeleteHandler,
  projectDeleteConfirmHandler,
  projectDeleteCancelHandler,
  projectHubChatHandler,
  projectHubImagesHandler,
  projectHubVideosHandler,
  projectHubFilesHandler,
  projectHubNotesHandler,
  projectHubHistoryHandler,
  projectNoteCreateHandler,
  projectNoteTitleHandler,
  projectNoteContentHandler,
  projectNoteViewHandler,
  projectNotePinHandler,
  projectNoteDeleteHandler,
  projectFileUploadHandler,
} from "@/bot/handlers/projects";
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
import {
  adminHandler,
  adminUsersHandler,
  adminUserDetailHandler,
  adminUserPremiumHandler,
  adminUserResetHandler,
  adminPremiumHandler,
  adminPremiumUsersHandler,
  adminStatsHandler,
  adminAnalyticsHandler,
  adminBroadcastHandler,
  adminBroadcastSendHandler,
  adminHealthHandler,
  adminLogsHandler,
} from "@/bot/handlers/admin";
import { handleLanguageSelection } from "@/bot/handlers/language";
import {
  mainMenuKeyboard,
  chatKeyboard,
  settingsKeyboard,
  backToMainKeyboard,
  homeCancelKeyboard,
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

async function switchToProjects(ctx: BotContext): Promise<void> {
  await projectsHandler(ctx);
}

async function switchToPremium(ctx: BotContext): Promise<void> {
  await premiumHandler(ctx);
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
  projects: switchToProjects,
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
  // Admin command (only for admin users)
  bot.command("admin", adminHandler);
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
  bot.command("home", async (ctx) => {
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.reply(t(lang, "menu.main"), {
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

  // ─── Global Navigation ────────────────────────────
  // Home — reset session, return to Main Menu
  bot.callbackQuery("nav:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Back — return to previous context
  // If user is in a project hub, go back to project list instead of main menu
  bot.callbackQuery("nav:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.session.step === BotStep.PROJECTS || ctx.session.currentProjectId) {
      await projectsHandler(ctx);
      return;
    }
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Cancel — cancel operation, reset, show Main Menu
  bot.callbackQuery("nav:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await ctx.editMessageText(t(lang, "cancel.done"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Legacy menu:main callback (backward compatibility)
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
  // Resume a specific chat conversation: resume:chat:<conversationId>
  bot.callbackQuery(/^resume:chat:(.+)/, resumeChatHandler);
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

  // ─── Admin Panel ─────────────────────────────────
  bot.callbackQuery("admin:panel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminHandler(ctx);
  });
  bot.callbackQuery("admin:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUsersHandler(ctx);
  });
  bot.callbackQuery(/^admin:user:detail:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserDetailHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:premium:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserPremiumHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:reset:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserResetHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery("admin:premium", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPremiumHandler(ctx);
  });
  bot.callbackQuery("admin:premium:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPremiumUsersHandler(ctx);
  });
  bot.callbackQuery("admin:stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminStatsHandler(ctx);
  });
  bot.callbackQuery("admin:analytics", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminAnalyticsHandler(ctx);
  });
  bot.callbackQuery("admin:broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminBroadcastHandler(ctx);
  });
  bot.callbackQuery("admin:health", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminHealthHandler(ctx);
  });
  bot.callbackQuery("admin:logs", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminLogsHandler(ctx);
  });

  // ─── Image History ──────────────────────────────
  bot.callbackQuery("image:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await imageHistoryHandler(ctx);
  });
  bot.callbackQuery(/^resume:image:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await resumeImageHandler(ctx);
  });

  // ─── Video History ──────────────────────────────
  bot.callbackQuery("video:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await videoHistoryHandler(ctx);
  });
  bot.callbackQuery(/^resume:video:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await resumeVideoHandler(ctx);
  });
  bot.callbackQuery(/^video:regenerate:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await regenerateVideoHandler(ctx);
  });

  // ─── Projects ────────────────────────────────────
  // Open project list
  bot.callbackQuery("project:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectsHandler(ctx);
  });
  // Create new project
  bot.callbackQuery("project:create", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectCreateHandler(ctx);
  });
  // Open a specific project: project:open:<id>
  bot.callbackQuery(/^project:open:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectOpenHandler(ctx, ctx.match[1]!);
  });
  // Rename project
  bot.callbackQuery("project:rename", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectRenameHandler(ctx);
  });
  // Delete project — confirmation
  bot.callbackQuery("project:delete", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectDeleteHandler(ctx);
  });
  // Confirm project deletion
  bot.callbackQuery(/^project:delete:confirm:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectDeleteConfirmHandler(ctx, ctx.match[1]!);
  });
  // Cancel project deletion
  bot.callbackQuery(/^project:delete:cancel:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectDeleteCancelHandler(ctx, ctx.match[1]!);
  });
  // Project hub actions — Chat
  bot.callbackQuery("project:hub:chat", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubChatHandler(ctx);
  });
  // Project hub actions — Images
  bot.callbackQuery("project:hub:images", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubImagesHandler(ctx);
  });
  // Project hub actions — Videos
  bot.callbackQuery("project:hub:videos", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubVideosHandler(ctx);
  });
  // Project hub actions — Files
  bot.callbackQuery("project:hub:files", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubFilesHandler(ctx);
  });
  // Project hub actions — Notes
  bot.callbackQuery("project:hub:notes", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubNotesHandler(ctx);
  });
  // Project hub actions — History
  bot.callbackQuery("project:hub:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectHubHistoryHandler(ctx);
  });
  // Project hub actions — File upload (placeholder)
  bot.callbackQuery("project:file:upload", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectFileUploadHandler(ctx);
  });
  // Notes CRUD — Create
  bot.callbackQuery("project:note:create", async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectNoteCreateHandler(ctx);
  });
  // Notes CRUD — View: project:note:view:<id>
  bot.callbackQuery(/^project:note:view:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectNoteViewHandler(ctx, ctx.match[1]!);
  });
  // Notes CRUD — Pin toggle: project:note:pin:<id>
  bot.callbackQuery(/^project:note:pin:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectNotePinHandler(ctx, ctx.match[1]!);
  });
  // Notes CRUD — Delete: project:note:delete:<id>
  bot.callbackQuery(/^project:note:delete:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await projectNoteDeleteHandler(ctx, ctx.match[1]!);
  });

  // ─── Premium ──────────────────────────────────────
  // Show details for a specific plan
  bot.callbackQuery(/^premium:plan:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await premiumPlanHandler(ctx, ctx.match[1]!);
  });
  // Subscribe to a plan (simulated payment)
  bot.callbackQuery(/^premium:subscribe:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await premiumUpgradeHandler(ctx, ctx.match[1]!);
  });
  // Back to premium plans
  bot.callbackQuery("premium:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await premiumHandler(ctx);
  });
  // Legacy upgrade button (from profile page)
  bot.callbackQuery("premium:upgrade", async (ctx) => {
    await ctx.answerCallbackQuery();
    await premiumHandler(ctx);
  });

  // ─── Result Actions (future-ready) ────────────────
  bot.callbackQuery("result:copy", async (ctx) => {
    await ctx.answerCallbackQuery("📋 Copied to clipboard!");
  });
  bot.callbackQuery("result:regenerate", async (ctx) => {
    await ctx.answerCallbackQuery("🔄 Regenerating...");
  });

  // ─── Coding History ─────────────────────────────
  bot.callbackQuery("coding:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await codingHistoryHandler(ctx);
  });
  bot.callbackQuery(/^resume:coding:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await resumeCodingHandler(ctx);
  });

  // ─── Business History ───────────────────────────
  bot.callbackQuery("business:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await businessHistoryHandler(ctx);
  });
  bot.callbackQuery(/^resume:business:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await resumeBusinessHandler(ctx);
  });

  // ─── Translate History ──────────────────────────
  bot.callbackQuery("translate:history", async (ctx) => {
    await ctx.answerCallbackQuery();
    await translateHistoryHandler(ctx);
  });
  bot.callbackQuery(/^resume:translate:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await resumeTranslateHandler(ctx);
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
      case BotStep.PROJECT_CREATE:
        await projectCreateNameHandler(ctx);
        break;
      case BotStep.PROJECT_RENAME:
        await projectRenameNameHandler(ctx);
        break;
      case BotStep.PROJECT_NOTE_CREATE:
        if (ctx.session.tempData.noteStep === "content") {
          await projectNoteContentHandler(ctx);
        } else {
          await projectNoteTitleHandler(ctx);
        }
        break;
      default:
        // Check for admin broadcast mode
        if (ctx.session.tempData?.adminMode === "broadcast") {
          await adminBroadcastSendHandler(ctx);
          break;
        }
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

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
import {
  historyMenuHandler,
  historyDetailHandler,
  historyContinueHandler,
  historyDeleteHandler,
  historyDeleteConfirmHandler,
} from "@/bot/handlers/history-menu";
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
  adminDashboardHandler,
  adminUsersHandler,
  adminUserSearchHandler,
  adminUserDetailHandler,
  adminUserGivePremiumHandler,
  adminUserRemovePremiumHandler,
  adminUserBanHandler,
  adminUserUnbanHandler,
  adminUserResetHandler,
  adminPaymentsHandler,
  adminPaymentDetailHandler,
  adminPaymentApproveHandler,
  adminPaymentRejectHandler,
  adminBroadcastHandler,
  adminBroadcastTextHandler,
  adminBroadcastPhotoHandler,
  adminBroadcastSendTextHandler,
  adminBroadcastSendPhotoHandler,
  adminSettingsHandler,
  adminSettingsMaintenanceHandler,
  isMaintenanceMode,
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
  history: async (ctx) => {
    await historyMenuHandler(ctx);
  },
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
  // Admin search: /admin search [Telegram ID] or /admin search @[username]
  bot.hears(/^\/admin\s+search/i, adminUserSearchHandler);
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

    // Check maintenance mode — block non-admins from accessing features
    if (isMaintenanceMode()) {
      const tid = ctx.from?.id;
      const { isAdmin } = await import("@/services/admin/admin-guard");
      if (tid && !isAdmin(tid)) {
        await ctx.reply("🚧 *The bot is currently under maintenance. Please try again later.*", {
          parse_mode: "Markdown",
        });
        return;
      }
    }

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

  // ─── Global History (🕒 History menu) ────────────
  bot.callbackQuery("history:menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await historyMenuHandler(ctx);
  });
  bot.callbackQuery(/^history:detail:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await historyDetailHandler(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(/^history:continue:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await historyContinueHandler(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(/^history:delete:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await historyDeleteHandler(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(/^history:delete:confirm:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await historyDeleteConfirmHandler(ctx, ctx.match[1]!);
  });

  // ─── Admin Panel — MVP (5 menus) ─────────────────
  // Main menu
  bot.callbackQuery("admin:panel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminHandler(ctx);
  });

  // Dashboard
  bot.callbackQuery("admin:dashboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminDashboardHandler(ctx);
  });

  // Users
  bot.callbackQuery("admin:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUsersHandler(ctx);
  });
  bot.callbackQuery(/^admin:user:detail:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserDetailHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:givepremium:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserGivePremiumHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:removepremium:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserRemovePremiumHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:ban:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserBanHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:unban:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserUnbanHandler(ctx, parseInt(ctx.match[1]!, 10));
  });
  bot.callbackQuery(/^admin:user:reset:(\d+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminUserResetHandler(ctx, parseInt(ctx.match[1]!, 10));
  });

  // Payments
  bot.callbackQuery("admin:payments", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPaymentsHandler(ctx);
  });
  bot.callbackQuery(/^admin:payment:detail:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPaymentDetailHandler(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(/^admin:payment:approve:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPaymentApproveHandler(ctx, ctx.match[1]!);
  });
  bot.callbackQuery(/^admin:payment:reject:(.+)/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminPaymentRejectHandler(ctx, ctx.match[1]!);
  });

  // Broadcast
  bot.callbackQuery("admin:broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminBroadcastHandler(ctx);
  });
  bot.callbackQuery("admin:broadcast:text", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminBroadcastTextHandler(ctx);
  });
  bot.callbackQuery("admin:broadcast:photo", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminBroadcastPhotoHandler(ctx);
  });

  // Settings
  bot.callbackQuery("admin:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminSettingsHandler(ctx);
  });
  bot.callbackQuery("admin:settings:maintenance", async (ctx) => {
    await ctx.answerCallbackQuery();
    await adminSettingsMaintenanceHandler(ctx);
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
        // Check for admin broadcast modes
        if (ctx.session.tempData?.adminMode === "broadcast_text") {
          await adminBroadcastSendTextHandler(ctx);
          break;
        }
        // IDLE or unrecognised — route to AI Chat
        // Check maintenance mode — block non-admins
        if (isMaintenanceMode()) {
          const tid = ctx.from?.id;
          const { isAdmin } = await import("@/services/admin/admin-guard");
          if (tid && !isAdmin(tid)) {
            await ctx.reply("🚧 *The bot is currently under maintenance. Please try again later.*", {
              parse_mode: "Markdown",
            });
            return;
          }
        }
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

  // ─── Photo Messages (for admin broadcast) ────────
  bot.on("message:photo", async (ctx) => {
    if (ctx.session.tempData?.adminMode === "broadcast_photo") {
      await adminBroadcastSendPhotoHandler(ctx);
    }
  });

  return bot;
}

/**
 * Bot instance for use in API routes
 */
export const bot = createBot();

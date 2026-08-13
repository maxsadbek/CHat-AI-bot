/**
 * Bot Entry Point
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────┐
 *   │ Middleware Chain (order matters)            │
 *   │ 1. Session                                 │
 *   │ 2. Rate Limiter                            │
 *   │ 3. User Auth (always sets userId)          │
 *   │ 4. Daily Limit Check                       │
 *   ├─────────────────────────────────────────────┤
 *   │ Commands (/start, /chat, /image, etc.)     │
 *   ├─────────────────────────────────────────────┤
 *   │ 1 Callback Query Handler                   │
 *   │   → Centralized CallbackRouter.match()     │
 *   ├─────────────────────────────────────────────┤
 *   │ 1 Message Text Handler                     │
 *   │   → Routes by session.step                 │
 *   │   → IDLE shows Main Menu (no auto-switch)  │
 *   └─────────────────────────────────────────────┘
 *
 * Key fixes from previous architecture:
 *   - ALL callbacks routed through ONE handler via CallbackRouter
 *   - Feature commands registered: /chat, /image, /video, etc.
 *   - Default handler shows menu instead of auto-switching to AI_CHAT
 *   - history:delete:confirm registered before history:delete
 *   - Admin search registered before admin command
 *   - User middleware falls back to Telegram ID if DB fails
 */

import { Bot, session } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { env } from "@/config";
import { createInitialSession } from "@/bot/middleware";
import { registerMiddleware } from "@/bot/middleware";
import { resetSession } from "@/bot/session";
import { sessionManager } from "@/bot/core/session-manager";
import { prismaSessionStorage } from "@/bot/core/session-storage";
import { modeManager } from "@/bot/core/mode-manager";
import { callbackRouter } from "@/bot/core/router";
import { logger } from "@/bot/core/logger";
import { voiceManager } from "@/services/voice";
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
  manualPaymentReceiptHandler,
  manualPaymentApproveHandler,
  manualPaymentRejectHandler,
  manualPaymentProcessPhotoHandler,
} from "@/bot/handlers/payment-manual";
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
} from "@/bot/handlers/settings";import { isAdmin } from "@/services/admin/admin-guard";
import { adminHandler,
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
  onboardingTourKeyboard,
} from "@/bot/keyboards";
import { safeAnswerCallbackQuery, safeEditMessageText } from "@/bot/utils/telegram";
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

/** Handle a feature switch (called from both callback and commands) */
async function handleFeatureSwitch(ctx: BotContext, feature: string): Promise<void> {
  // Check maintenance mode — block non-admins
  if (isMaintenanceMode()) {
    const tid = ctx.from?.id;
    if (tid && !isAdmin(tid)) {
      await ctx.reply("🚧 *The bot is currently under maintenance. Please try again later.*", {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  const handler = FEATURE_SWITCHES[feature];
  if (handler) {
    log.debug("Feature selected via feature switch", { feature, userId: ctx.from?.id });
    await handler(ctx);
  } else {
    log.warn("Unknown feature switch", { feature });
  }
}

/**
 * Create and configure the Telegram bot
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN!);

  // ─── 1. Session Middleware ─────────────────────────
  // Uses Prisma-backed storage so sessions survive serverless cold starts.
  // Each update is keyed by chatId. Falls back gracefully on DB errors.
  bot.use(
    session({
      initial: createInitialSession,
      storage: prismaSessionStorage,
      getSessionKey: (ctx) => ctx.chat?.id?.toString(),
    })
  );

  // ─── 2. Global Middleware ──────────────────────────
  registerMiddleware(bot);

  log.info("Bot session storage: Prisma (persistent)");

  // ─── 3. Voice System Init ──────────────────────────────
  log.info("Jarvis Voice Manager initializing...");
  voiceManager.init().then(() => {
    log.info("Jarvis Voice Manager ready");
    // Play startup sequence — non-blocking, don't await
    voiceManager.playStartupSequence().catch(() => {
      log.debug("Startup sound skipped (no WAV file or TTS)");
    });
  }).catch((err) => {
    log.warn("Voice Manager init failed (non-critical)", { error: String(err) });
  });

  log.info("Bot initializing...", { model: env.OPENAI_MODEL });

  // ════════════════════════════════════════════════════════
  // 3. COMMANDS
  // ════════════════════════════════════════════════════════

  // System commands
  bot.command("start", startHandler);
  bot.command("admin", async (ctx) => {
    // Parse arguments for search (/admin search [query])
    const text = ctx.message?.text ?? "";
    const searchMatch = text.match(/^\/admin\s+search\s+(.+)/i);
    if (searchMatch) {
      // adminUserSearchHandler re-parses the text — no need to reassign
      await adminUserSearchHandler(ctx);
      return;
    }
    await adminHandler(ctx);
  });

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

  // Feature commands — each maps to the corresponding feature switch
  const featureCommands: Array<[string, string]> = [
    ["chat", "chat"],
    ["image", "image"],
    ["video", "video"],
    ["coding", "coding"],
    ["social", "social"],
    ["business", "business"],
    ["translate", "translate"],
    ["profile", "profile"],
    ["history", "history"],
    ["settings", "settings"],
    ["premium", "premium"],
    ["projects", "projects"],
  ];

  for (const [cmd, feature] of featureCommands) {
    bot.command(cmd, async (ctx) => {
      await handleFeatureSwitch(ctx, feature);
    });
  }

  // ════════════════════════════════════════════════════════
  // 4. CENTRALIZED CALLBACK ROUTER
  // ════════════════════════════════════════════════════════
  // Register all callback routes in order.
  // More specific patterns MUST come before general ones.

  // ─── Language Selection ───────────────────────────
  callbackRouter.register(/^lang:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await handleLanguageSelection(ctx);
  });

  // ─── Onboarding Tour ──────────────────────────────
  // Turns the tour invite message into the guided tour with
  // one button per main feature (buttons reuse feature:* callbacks).
  callbackRouter.register("onboarding:start", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "welcome.tour"), {
      parse_mode: "Markdown",
      reply_markup: onboardingTourKeyboard,
    });
  });

  // ─── Global Navigation ────────────────────────────
  callbackRouter.register("nav:home", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Back — return to previous context
  callbackRouter.register("nav:back", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    if (ctx.session.step === BotStep.PROJECTS || ctx.session.currentProjectId) {
      await projectsHandler(ctx);
      return;
    }
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Cancel — cancel operation, reset, show Main Menu
  callbackRouter.register("nav:cancel", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "cancel.done"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // Legacy menu:main callback (backward compatibility)
  callbackRouter.register("menu:main", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    resetSession(ctx.session, true);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "menu.main"), {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  });

  // ─── Main Menu Feature Switches ───────────────────
  callbackRouter.register(/^feature:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const feature = (ctx as any).match[1] as string;
    await handleFeatureSwitch(ctx, feature);
  });

  // ─── Chat Actions ─────────────────────────────────
  callbackRouter.register("chat:new", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await newChatHandler(ctx);
  });
  callbackRouter.register("chat:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await chatHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:chat:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeChatHandler(ctx);
  });
  callbackRouter.register("chat:clear", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const lang = ctx.session.language;
    sessionManager.clearMessages(ctx.session);
    await safeEditMessageText(ctx, t(lang, "chat.clear_done"), {
      parse_mode: "Markdown",
      reply_markup: chatKeyboard,
    });
  });

  // ─── Settings Navigation ──────────────────────────
  callbackRouter.register("settings:language", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsLanguageHandler(ctx);
  });
  callbackRouter.register("settings:model", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsModelHandler(ctx);
  });
  callbackRouter.register("settings:clear", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsClearHandler(ctx);
  });
  callbackRouter.register("settings:privacy", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsPrivacyHandler(ctx);
  });
  callbackRouter.register("settings:about", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsAboutHandler(ctx);
  });

  // ─── Model Selection ─────────────────────────────
  callbackRouter.register("model:providers", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await settingsModelHandler(ctx);
  });
  callbackRouter.register(/^model:provider:(.+)/, async (ctx) => {
    const provider = (ctx as any).match[1] as string;
    await safeAnswerCallbackQuery(ctx);
    await settingsModelProviderHandler(ctx, provider);
  });
  callbackRouter.register(/^model:select:(.+)/, async (ctx) => {
    const modelId = (ctx as any).match[1] as string;
    await settingsModelSelectHandler(ctx, modelId);
  });

  // ─── Clear Conversation Confirmation ──────────────
  callbackRouter.register("clear:confirm", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
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
    await safeEditMessageText(ctx, t(lang, "settings.cleared"), {
      parse_mode: "Markdown",
      reply_markup: settingsKeyboard,
    });
  });
  callbackRouter.register("clear:cancel", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const lang = ctx.session.language;
    await safeEditMessageText(ctx, t(lang, "settings.title"), {
      parse_mode: "Markdown",
      reply_markup: settingsKeyboard,
    });
  });

  // ─── Help Center ──────────────────────────────────
  callbackRouter.register(/^help:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const topic = (ctx as any).match[1] ?? "";
    if (topic === "tips") {
      await helpTipsHandler(ctx);
    } else {
      await helpFeatureHandler(ctx, topic);
    }
  });

  // ─── Global History — SPECIFIC patterns first, then general ──
  callbackRouter.register("history:menu", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await historyMenuHandler(ctx);
  });
  callbackRouter.register(/^history:detail:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await historyDetailHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^history:continue:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await historyContinueHandler(ctx, (ctx as any).match[1]!);
  });
  // ⚠️ ALL DELETE PATTERNS: register MORE SPECIFIC (confirm) BEFORE general
  callbackRouter.register(/^history:delete:confirm:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await historyDeleteConfirmHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^history:delete:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await historyDeleteHandler(ctx, (ctx as any).match[1]!);
  });

  // ─── Admin Panel — MVP (5 menus) ─────────────────
  // Main menu
  callbackRouter.register("admin:panel", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminHandler(ctx);
  });
  // Dashboard
  callbackRouter.register("admin:dashboard", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminDashboardHandler(ctx);
  });
  // Users
  callbackRouter.register("admin:users", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUsersHandler(ctx);
  });
  callbackRouter.register(/^admin:user:detail:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserDetailHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  callbackRouter.register(/^admin:user:givepremium:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserGivePremiumHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  callbackRouter.register(/^admin:user:removepremium:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserRemovePremiumHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  callbackRouter.register(/^admin:user:ban:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserBanHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  callbackRouter.register(/^admin:user:unban:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserUnbanHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  callbackRouter.register(/^admin:user:reset:(\d+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminUserResetHandler(ctx, parseInt((ctx as any).match[1]!, 10));
  });
  // Payments
  callbackRouter.register("admin:payments", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminPaymentsHandler(ctx);
  });
  callbackRouter.register(/^admin:payment:detail:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminPaymentDetailHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^admin:payment:approve:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminPaymentApproveHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^admin:payment:reject:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminPaymentRejectHandler(ctx, (ctx as any).match[1]!);
  });
  // Broadcast
  callbackRouter.register("admin:broadcast", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminBroadcastHandler(ctx);
  });
  callbackRouter.register("admin:broadcast:text", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminBroadcastTextHandler(ctx);
  });
  callbackRouter.register("admin:broadcast:photo", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminBroadcastPhotoHandler(ctx);
  });
  // Settings
  callbackRouter.register("admin:settings", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminSettingsHandler(ctx);
  });
  callbackRouter.register("admin:settings:maintenance", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await adminSettingsMaintenanceHandler(ctx);
  });

  // ─── Image History ──────────────────────────────
  callbackRouter.register("image:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await imageHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:image:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeImageHandler(ctx);
  });

  // ─── Video History ──────────────────────────────
  callbackRouter.register("video:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await videoHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:video:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeVideoHandler(ctx);
  });
  callbackRouter.register(/^video:regenerate:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await regenerateVideoHandler(ctx);
  });

  // ─── Projects ────────────────────────────────────
  callbackRouter.register("project:list", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectsHandler(ctx);
  });
  callbackRouter.register("project:create", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectCreateHandler(ctx);
  });
  callbackRouter.register(/^project:open:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectOpenHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register("project:rename", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectRenameHandler(ctx);
  });
  callbackRouter.register("project:delete", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectDeleteHandler(ctx);
  });
  callbackRouter.register(/^project:delete:confirm:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectDeleteConfirmHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^project:delete:cancel:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectDeleteCancelHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register("project:hub:chat", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubChatHandler(ctx);
  });
  callbackRouter.register("project:hub:images", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubImagesHandler(ctx);
  });
  callbackRouter.register("project:hub:videos", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubVideosHandler(ctx);
  });
  callbackRouter.register("project:hub:files", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubFilesHandler(ctx);
  });
  callbackRouter.register("project:hub:notes", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubNotesHandler(ctx);
  });
  callbackRouter.register("project:hub:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectHubHistoryHandler(ctx);
  });
  callbackRouter.register("project:file:upload", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectFileUploadHandler(ctx);
  });
  callbackRouter.register("project:note:create", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectNoteCreateHandler(ctx);
  });
  callbackRouter.register(/^project:note:view:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectNoteViewHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^project:note:pin:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectNotePinHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^project:note:delete:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await projectNoteDeleteHandler(ctx, (ctx as any).match[1]!);
  });

  // ─── Premium ──────────────────────────────────────
  callbackRouter.register(/^premium:plan:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await premiumPlanHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register(/^premium:subscribe:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await premiumUpgradeHandler(ctx, (ctx as any).match[1]!);
  });
  callbackRouter.register("premium:back", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await premiumHandler(ctx);
  });
  callbackRouter.register("premium:upgrade", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await premiumHandler(ctx);
  });

  // ─── Manual Payment ────────────────────────────
  // User clicks "📷 Send Receipt" — wait for photo
  // The planId is already stored in session tempData by manualPaymentShowHandler
  callbackRouter.register("manual:payment:receipt", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const planId = ctx.session.tempData.manualPaymentPlan ?? "pro_monthly";
    log.debug("Manual payment receipt callback triggered", {
      userId: ctx.from?.id,
      planId,
      tempData: ctx.session.tempData,
    });
    await manualPaymentReceiptHandler(ctx, planId);
    log.debug("Manual payment receipt handler completed — session step is now", {
      step: ctx.session.step,
    });
  });

  // Status-only button shown after approve/reject (displays "✅ Approved" or "❌ Rejected")
  // No-op: the button is display-only, just acknowledge the callback to remove loading state
  callbackRouter.register("manual:payment:done", async (ctx) => {
    await safeAnswerCallbackQuery(ctx, "Payment already processed.");
  });

  // Admin approves a manual payment
  callbackRouter.register(/^admin:manual:approve:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await manualPaymentApproveHandler(ctx, (ctx as any).match[1]!);
  });

  // Admin rejects a manual payment
  callbackRouter.register(/^admin:manual:reject:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await manualPaymentRejectHandler(ctx, (ctx as any).match[1]!);
  });

  // ─── Result Actions (future-ready) ────────────────
  callbackRouter.register("result:copy", async (ctx) => {
    await safeAnswerCallbackQuery(ctx, "📋 Copied to clipboard!");
  });
  callbackRouter.register("result:regenerate", async (ctx) => {
    await safeAnswerCallbackQuery(ctx, "🔄 Regenerating...");
  });

  // ─── Feature History (Coding / Business / Translate) ──
  callbackRouter.register("coding:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await codingHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:coding:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeCodingHandler(ctx);
  });
  callbackRouter.register("business:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await businessHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:business:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeBusinessHandler(ctx);
  });
  callbackRouter.register("translate:history", async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await translateHistoryHandler(ctx);
  });
  callbackRouter.register(/^resume:translate:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    await resumeTranslateHandler(ctx);
  });

  // ─── Platform Selection (Video / Image / Social / Business / Coding) ───
  // These use greedy patterns — must be registered last to avoid
  // matching more specific patterns like <feature>:history.
  callbackRouter.register(/^video:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const raw = (ctx as any).match[1] ?? "";
    // Map keyboard slugs to proper platform names
    const VIDEO_PLATFORM_MAP: Record<string, import("@/types").VideoPlatform> = {
      "hailuo": "Hailuo AI",
      "kling": "Kling AI",
      "veo": "Google Veo",
      "runway": "Runway",
      "pixverse": "PixVerse",
    };
    const platform: import("@/types").VideoPlatform | "all" =
      raw === "all" || !raw ? "all" : (VIDEO_PLATFORM_MAP[raw] ?? raw as import("@/types").VideoPlatform);
    ctx.session.selectedVideoPlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.VIDEO_PROMPT);
    log.info("[SESSION] Video platform selected", { platform, step: BotStep.VIDEO_PROMPT });
    await safeEditMessageText(ctx, 
      t(lang, "video.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  callbackRouter.register(/^image:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const raw = (ctx as any).match[1] ?? "";
    // Map keyboard slugs to proper platform names
    const IMAGE_PLATFORM_MAP: Record<string, import("@/types").ImagePlatform> = {
      "gpt": "GPT Image",
      "flux": "Flux",
      "midjourney": "Midjourney",
      "leonardo": "Leonardo",
      "ideogram": "Ideogram",
    };
    const platform: import("@/types").ImagePlatform | "all" =
      raw === "all" || !raw ? "all" : (IMAGE_PLATFORM_MAP[raw] ?? raw as import("@/types").ImagePlatform);
    ctx.session.selectedImagePlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.IMAGE_PROMPT);
    log.info("[SESSION] Image platform selected", { platform, step: BotStep.IMAGE_PROMPT });
    await safeEditMessageText(ctx, 
      t(lang, "image.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  callbackRouter.register(/^social:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const raw = (ctx as any).match[1] ?? "";
    const platform: import("@/types").SocialPlatform | "all" =
      raw === "all" || !raw ? "all" : (raw as import("@/types").SocialPlatform);
    ctx.session.selectedSocialPlatform = platform;
    const lang = ctx.session.language;
    const platformName = platform === "all" ? "All Platforms" : platform;
    sessionManager.setStep(ctx.session, BotStep.SOCIAL_MEDIA);
    await safeEditMessageText(ctx, 
      t(lang, "social.platform_selected", { platform: platformName }),
      { parse_mode: "Markdown" }
    );
  });

  callbackRouter.register(/^business:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const businessType = ((ctx as any).match[1] ?? "startup_idea") as import("@/types").BusinessContentType;
    ctx.session.selectedBusinessType = businessType;
    const lang = ctx.session.language;
    const typeName = businessType.replace(/_/g, " ");
    sessionManager.setStep(ctx.session, BotStep.BUSINESS);
    await safeEditMessageText(ctx, 
      t(lang, "business.type_selected", { type: typeName }),
      { parse_mode: "Markdown" }
    );
  });

  callbackRouter.register(/^coding:(.+)/, async (ctx) => {
    await safeAnswerCallbackQuery(ctx);
    const language = ((ctx as any).match[1] ?? "Next.js") as import("@/types").CodeLanguage;
    ctx.session.selectedCodeLanguage = language;
    const lang = ctx.session.language;
    sessionManager.setStep(ctx.session, BotStep.CODING);
    await safeEditMessageText(ctx, 
      t(lang, "coding.language_selected", { language }),
      { parse_mode: "Markdown" }
    );
  });

  // ════════════════════════════════════════════════════════
  // 5. SINGLE CALLBACK QUERY HANDLER
  // ════════════════════════════════════════════════════════
  bot.callbackQuery(/./, async (ctx) => {
    const handled = await callbackRouter.match(ctx);
    if (!handled) {
      log.warn("Unhandled callback query", { data: ctx.callbackQuery?.data, userId: ctx.from?.id });
      await safeAnswerCallbackQuery(ctx);
    }
  });

  // ════════════════════════════════════════════════════════
  // 6. PHOTO MESSAGES — runs BEFORE message:text
  // ════════════════════════════════════════════════════════
  // IMPORTANT: This handler is registered BEFORE message:text so that
  // for photos WITH captions, the photo handler fires first and can
  // process manual payment receipts before message:text ever runs.
  //
  // Registration order: callbackQuery → message:photo → message:text
  bot.on("message:photo", async (ctx) => {
    const step = ctx.session.step;
    const hasCaption = !!ctx.message?.caption;
    const handlerSelected = step === BotStep.MANUAL_PAYMENT_RECEIPT
      ? "manualPaymentProcessPhotoHandler"
      : ctx.session.tempData?.adminMode === "broadcast_photo"
        ? "adminBroadcastSendPhotoHandler"
        : "SILENTLY_IGNORED";

    log.debug("📸 PHOTO RECEIVED", {
      step,
      stepName: step,
      userId: ctx.from?.id,
      hasCaption,
      messageId: ctx.message?.message_id,
    });
    log.debug("📸 CURRENT STEP", {
      step,
      isManualPaymentReceipt: step === BotStep.MANUAL_PAYMENT_RECEIPT,
    });
    log.debug("📸 HANDLER SELECTED", {
      handler: handlerSelected,
    });

    // ─── Priority 1: Manual payment receipt photo ─────────
    if (step === BotStep.MANUAL_PAYMENT_RECEIPT) {
      await manualPaymentProcessPhotoHandler(ctx);
      return;
    }

    // ─── Priority 2: Admin broadcast photo ───────────────
    if (ctx.session.tempData?.adminMode === "broadcast_photo") {
      const tid = ctx.from?.id;
      if (tid && isAdmin(tid)) {
        await adminBroadcastSendPhotoHandler(ctx);
        return;
      }
    }

    // ─── Default: silently ignore ────────────────────────
    // Non-admin photos in non-broadcast mode are silently ignored
    // to prevent accidental processing of user-uploaded photos
    log.debug("message:photo — silently ignored", {
      step,
      userId: ctx.from?.id,
    });
  });

  // ════════════════════════════════════════════════════════
  // 7. TEXT MESSAGES — routes by session step
  // ════════════════════════════════════════════════════════
  // NOTE: For photos with captions, the message:photo handler (section 6)
  // fires FIRST and handles payment receipts. This handler only sees
  // the text portion if message:photo calls next() — but for payment
  // receipts it returns without calling next(), so message:text never runs.
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;

    log.info("[SESSION] Text message received", {
      telegramId: ctx.from?.id,
      step: step,
      text: ctx.message?.text ? `${ctx.message.text.slice(0, 20)}...` : null,
    });

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
        // If user is in manual payment receipt mode but sent ONLY text (no photo),
        // remind them to send a photo. Photos are handled by the message:photo handler above.
        if (step === BotStep.MANUAL_PAYMENT_RECEIPT) {
          await ctx.reply(
            "📸 *Please send a photo of your payment receipt.*\n\nSend exactly one photo showing the completed payment.",
            { parse_mode: "Markdown" }
          );
          break;
        }
        // Check for admin broadcast modes
        if (ctx.session.tempData?.adminMode === "broadcast_text") {
          await adminBroadcastSendTextHandler(ctx);
          break;
        }
        // IDLE or unrecognised — show Main Menu instead of auto-switching
        // This prevents the confusing "your message was sent to AI Chat" behavior
        if (isMaintenanceMode()) {
          const tid = ctx.from?.id;
          if (tid && !isAdmin(tid)) {
            await ctx.reply("🚧 *The bot is currently under maintenance. Please try again later.*", {
              parse_mode: "Markdown",
            });
            return;
          }
        }
        const lang = ctx.session.language;
        await ctx.reply(t(lang, "menu.main"), {
          parse_mode: "Markdown",
          reply_markup: mainMenuKeyboard,
        });
        break;
    }
  });

  return bot;
}

/**
 * Bot instance for use in API routes
 */
export const bot = createBot();

// ─── Graceful Shutdown ────────────────────────────────
// Play the goodbye sound on process termination
if (typeof process !== "undefined") {
  const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
  for (const signal of shutdownSignals) {
    process.once(signal, async () => {
      log.info(`Received ${signal} — shutting down gracefully...`);
      await voiceManager.playShutdownSequence().catch(() => {
        log.debug("Shutdown sound skipped");
      });
      process.exit(0);
    });
  }
}

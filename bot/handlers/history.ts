/**
 * Chat History Module
 * Shared functionality for conversation history across all features.
 * Handles: saving conversations, resuming, displaying history, limit checks.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { conversationService } from "@/services/conversation";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";

const log = logger.child("history");

// ─── Feature-to-step mapping ──────────────────────────
const FEATURE_STEPS: Record<string, BotStep> = {
  chat: BotStep.AI_CHAT,
  coding: BotStep.CODING,
  business: BotStep.BUSINESS,
  translate: BotStep.TRANSLATE,
  image: BotStep.IMAGE_PROMPT,
  video: BotStep.VIDEO_PROMPT,
};

const FEATURE_HISTORY_KEYS: Record<string, string> = {
  chat: "chat.history_title",
  coding: "coding.history_title",
  business: "business.history_title",
  translate: "translate.history_title",
  image: "image.history_title",
  video: "video.history_title",
};

const FEATURE_NO_HISTORY_KEYS: Record<string, string> = {
  chat: "chat.no_history",
  coding: "coding.no_history",
  business: "business.no_history",
  translate: "translate.no_history",
  image: "image.no_history",
  video: "video.no_history",
};

const FEATURE_HISTORY_ENTRY_KEYS: Record<string, string> = {
  chat: "chat.history_entry",
  coding: "coding.history_entry",
  business: "business.history_entry",
  translate: "translate.history_entry",
  image: "image.history_entry",
  video: "video.history_entry",
};

/**
 * Check if user can create a new conversation for this feature.
 * Returns true if under limit (or premium), false if at limit.
 */
export async function checkConversationLimit(
  ctx: BotContext,
  feature: string
): Promise<{ allowed: boolean; remaining: number }> {
  const userId = ctx.session.userId;
  if (!userId) return { allowed: false, remaining: 0 };

  const allowed = await conversationService.checkLimit(userId, feature);
  const remaining = await conversationService.getRemainingSlots(userId, feature);
  return { allowed, remaining };
}

/**
 * Create a new conversation and set it in the session.
 */
export async function createConversation(
  ctx: BotContext,
  title: string,
  feature: string
): Promise<boolean> {
  const userId = ctx.session.userId;
  if (!userId) return false;

  // Check limit first
  const { allowed } = await checkConversationLimit(ctx, feature);
  if (!allowed) return false;

  try {
    const projectId = ctx.session.currentProjectId ?? undefined;
    const conversation = await conversationService.create(userId, title, feature, projectId);
    ctx.session.conversationId = conversation.id;
    return true;
  } catch (error) {
    log.error("Failed to create conversation", { userId, feature, error: String(error) });
    return false;
  }
}

/**
 * Save the current session messages to the database.
 */
export async function saveMessagesToDb(
  ctx: BotContext,
  feature: string,
  tokensUsed?: { in?: number; out?: number }
): Promise<void> {
  const userId = ctx.session.userId;
  const conversationId = ctx.session.conversationId;
  if (!userId || !conversationId) return;

  try {
    const messages = ctx.session.messages;
    if (messages.length === 0) return;

    await conversationService.saveMessages(conversationId, userId, messages);
  } catch (error) {
    log.error("Failed to save messages", { userId, conversationId, feature, error: String(error) });
  }
}

/**
 * Resume a conversation by loading its messages into the session.
 * Returns true if successful.
 */
export async function resumeConversation(
  ctx: BotContext,
  conversationId: string
): Promise<boolean> {
  try {
    const conversation = await conversationService.getConversationWithMessages(conversationId);
    if (!conversation) return false;

    // Verify ownership
    if (conversation.userId !== ctx.session.userId) return false;

    // Load messages into session
    ctx.session.conversationId = conversation.id;
    ctx.session.messages = conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Set the correct step based on feature
    const step = FEATURE_STEPS[conversation.feature];
    if (step) {
      ctx.session.step = step;
    }

    return true;
  } catch (error) {
    log.error("Failed to resume conversation", { conversationId, error: String(error) });
    return false;
  }
}

/**
 * Show conversation history for a specific feature.
 * Supports pagination.
 */
export async function showHistory(
  ctx: BotContext,
  feature: string
): Promise<void> {
  const userId = ctx.session.userId;
  const lang = ctx.session.language;

  if (!userId) return;

  const conversations = await conversationService.getUserConversations(
    userId,
    feature,
    10
  );

  const historyTitleKey = FEATURE_HISTORY_KEYS[feature] ?? "chat.history_title";
  const noHistoryKey = FEATURE_NO_HISTORY_KEYS[feature] ?? "chat.no_history";
  const entryKey = FEATURE_HISTORY_ENTRY_KEYS[feature] ?? "chat.history_entry";

  if (conversations.length === 0) {
    await ctx.reply(t(lang, noHistoryKey), {
      parse_mode: "Markdown",
    });
    return;
  }

  const historyLines = conversations.map(
    (conv, i) =>
      t(lang, entryKey, {
        index: String(i + 1),
        title: conv.title,
        count: String(conv._count.messages),
        date: conv.updatedAt.toLocaleDateString(),
      })
  );

  const header = t(lang, historyTitleKey);
  await ctx.reply(`${header}\n\n${historyLines.join("\n\n")}`, {
    parse_mode: "Markdown",
  });
}

/**
 * Get the feature name string for a callback data prefix
 */
export function getFeatureForCallback(callbackPrefix: string): string {
  switch (callbackPrefix) {
    case "chat": return "chat";
    case "coding": return "coding";
    case "business": return "business";
    case "translate": return "translate";
    default: return "chat";
  }
}

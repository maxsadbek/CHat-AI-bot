/**
 * History Menu Handler
 * Global conversation history across ALL AI features.
 *
 * Flow:
 *   🕒 History → List latest 10 conversations → Select one → Detail view
 *   Detail: Title, Date, Feature, User Prompt, AI Response
 *   Buttons: ▶ Continue, 🗑 Delete, ⬅ Back
 *
 * Architecture:
 *   - HistoryService for business logic
 *   - HistoryRepository for data access
 *   - Uses conversationService.resumeConversation() for Continue
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { historyService } from "@/services/history";
import { conversationService } from "@/services/conversation";
import { sessionManager } from "@/bot/core/session-manager";
import { addNavRow } from "@/bot/keyboards";
import { logger } from "@/bot/core/logger";
import { formatDate } from "@/utils/helpers";

const log = logger.child("handler-history-menu");

/** Format date short for the list view */
function formatListDate(d: Date): string {
  return historyService.formatRelativeDate(d);
}

/**
 * 🕒 History — Show the latest conversations across all features
 */
export async function historyMenuHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) {
    await ctx.reply("❌ Please use /start first.", { parse_mode: "Markdown" });
    return;
  }

  try {
    const conversations = await historyService.getRecentHistory(userId, 10);

    if (conversations.length === 0) {
      await ctx.reply(
        [
          "🕒 *History*",
          "",
          "No conversations yet.",
          "Start using AI features and your history will appear here!",
        ].join("\n"),
        {
          parse_mode: "Markdown",
          reply_markup: addNavRow(new InlineKeyboard()),
        }
      );
      return;
    }

    const lines = conversations.map((conv, i) => {
      const emoji = historyService.getFeatureEmoji(conv.feature);
      const date = formatListDate(conv.updatedAt);
      return `${emoji} ${conv.title}\n📅 ${date}`;
    });

    const text = [
      "🕒 *History*",
      "",
      ...lines,
      "",
      "Select a conversation to view details:",
    ].join("\n");

    const kb = new InlineKeyboard();
    conversations.forEach((conv, i) => {
      const btnLabel = `${historyService.getFeatureEmoji(conv.feature)} ${conv.title.slice(0, 20)}`;
      kb.text(btnLabel, `history:detail:${conv.id}`);
      kb.row();
    });

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: addNavRow(kb),
    });
  } catch (error) {
    log.error("History menu error", { userId, error: String(error) });
    await ctx.reply("❌ Error loading history", { parse_mode: "Markdown", reply_markup: addNavRow(new InlineKeyboard()) });
  }
}

/**
 * Conversation Detail — show title, date, feature, user prompt, AI response
 */
export async function historyDetailHandler(ctx: BotContext, conversationId: string): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) return;

  try {
    const conv = await historyService.getConversationDetail(conversationId, userId);
    if (!conv) {
      await ctx.reply("❌ Conversation not found.", { parse_mode: "Markdown" });
      return;
    }

    const emoji = historyService.getFeatureEmoji(conv.feature);
    const featureName = historyService.getFeatureName(conv.feature);

    // Extract first user message and first AI response
    const userMsg = conv.messages.find((m) => m.role === "user");
    const aiMsg = conv.messages.find((m) => m.role === "assistant");
    const userPrompt = userMsg ? userMsg.content.slice(0, 300) : "—";
    const aiResponse = aiMsg ? aiMsg.content.slice(0, 500) : "—";

    const text = [
      `${emoji} *${conv.title}*`,
      "",
      `📅 Date: ${formatDate(conv.updatedAt)}`,
      `⚡ Feature: ${featureName}`,
      `💬 Messages: ${conv.messages.length}`,
      "",
      "━━━ *User Prompt* ━━━",
      "",
      userPrompt,
      "",
      "━━━ *AI Response* ━━━",
      "",
      aiResponse + (aiMsg && aiMsg.content.length > 500 ? "\n\n_... (truncated)_" : ""),
    ].join("\n");

    const kb = new InlineKeyboard()
      .text("▶ Continue", `history:continue:${conversationId}`)
      .text("🗑 Delete", `history:delete:${conversationId}`)
      .row()
      .text("⬅ Back", "feature:history");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: addNavRow(kb),
    });
  } catch (error) {
    log.error("History detail error", { conversationId, error: String(error) });
    await ctx.reply("❌ Error loading conversation detail.", { parse_mode: "Markdown" });
  }
}

/**
 * ▶ Continue — resume a previous conversation
 */
export async function historyContinueHandler(ctx: BotContext, conversationId: string): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) return;

  try {
    // Use existing conversation resume logic
    const { resumeConversation } = await import("@/bot/handlers/history");
    const success = await resumeConversation(ctx, conversationId);

    if (!success) {
      await ctx.reply("❌ Could not resume conversation.", { parse_mode: "Markdown" });
      return;
    }

    const conv = await conversationService.getById(conversationId);
    const emoji = historyService.getFeatureEmoji(conv?.feature ?? "chat");

    await ctx.reply(
      `▶ *Conversation resumed* ${emoji}\n\nYou can continue where you left off.`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    log.error("History continue error", { conversationId, error: String(error) });
    await ctx.reply("❌ Error resuming conversation.", { parse_mode: "Markdown" });
  }
}

/**
 * 🗑 Delete — ask confirmation before deleting
 */
export async function historyDeleteHandler(ctx: BotContext, conversationId: string): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) return;

  try {
    const conv = await historyService.getConversationDetail(conversationId, userId);
    if (!conv) {
      await ctx.reply("❌ Conversation not found.", { parse_mode: "Markdown" });
      return;
    }

    const kb = new InlineKeyboard()
      .text("🗑 Yes, Delete", `history:delete:confirm:${conversationId}`)
      .row()
      .text("⬅ No, Keep it", `history:detail:${conversationId}`);

    await ctx.reply(
      [
        "🗑 *Delete Conversation?*",
        "",
        `Are you sure you want to delete:`,
        `"${conv.title}"?`,
        "",
        "This action cannot be undone.",
      ].join("\n"),
      {
        parse_mode: "Markdown",
        reply_markup: addNavRow(kb),
      }
    );
  } catch (error) {
    log.error("History delete prompt error", { conversationId, error: String(error) });
    await ctx.reply("❌ Error.", { parse_mode: "Markdown" });
  }
}

/**
 * Confirm deletion — permanently removes the conversation
 */
export async function historyDeleteConfirmHandler(ctx: BotContext, conversationId: string): Promise<void> {
  const userId = ctx.session.userId;
  if (!userId) return;

  try {
    await historyService.deleteConversation(conversationId, userId);
    log.info("Conversation deleted via history", { userId, conversationId });

    await ctx.reply(
      "🗑 *Conversation deleted.*",
      { parse_mode: "Markdown" }
    );

    // Return to history list
    await historyMenuHandler(ctx);
  } catch (error) {
    log.error("History delete error", { conversationId, error: String(error) });
    await ctx.reply("❌ Error deleting conversation.", { parse_mode: "Markdown" });
  }
}

/**
 * AI Chat Handler
 * ChatGPT-like conversation experience with memory, history, and resume.
 * Uses shared history module for conversation management.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { aiChatService } from "@/services/ai/chat";
import { providerRegistry } from "@/services/ai/providers";
import { chatKeyboard } from "@/bot/keyboards";
import { splitMessage } from "@/utils/markdown";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import { usageService } from "@/services/usage";
import {
  createConversation,
  saveMessagesToDb,
  showHistory,
  resumeConversation,
} from "@/bot/handlers/history";

const log = logger.child("handler-ai-chat");

/**
 * AI Chat handler — handles incoming text messages in AI_CHAT mode
 */
export async function aiChatHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  if (!userId) {
    await ctx.reply(t(lang, "chat.error_no_user"), { parse_mode: "Markdown" });
    return;
  }

  // Create conversation if not exists
  if (!ctx.session.conversationId) {
    const created = await createConversation(ctx, text.slice(0, 100), "chat");
    if (!created) {
      await ctx.reply(t(lang, "chat.limit_reached"), { parse_mode: "Markdown" });
      return;
    }
  }

  // Show typing indicator
  await ctx.replyWithChatAction("typing");

  try {
    const selectedModel = ctx.session.selectedModel;
    const response = await aiChatService.chat(ctx.session.messages, text, selectedModel);

    // Store messages in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: response.content });

    // Save to database
    await saveMessagesToDb(ctx, "chat", {
      in: response.usage?.promptTokens,
      out: response.usage?.completionTokens,
    });

    // Track usage with provider/model info (non-blocking)
    const providerName = selectedModel
      ? providerRegistry.getModel(selectedModel)?.provider
      : undefined;
    usageService.track(
      userId,
      "chat",
      response.usage?.promptTokens,
      response.usage?.completionTokens,
      providerName,
      selectedModel
    );

    // Split and send long responses
    const chunks = splitMessage(response.content);
    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        parse_mode: "Markdown",
        reply_markup:
          chunks.indexOf(chunk) === chunks.length - 1 ? chatKeyboard : undefined,
      });
    }
  } catch (error) {
    log.error("AI Chat error", { userId, error: String(error) });
    await ctx.reply(t(lang, "chat.error_generic"), {
      parse_mode: "Markdown",
      reply_markup: chatKeyboard,
    });
  }
}

/**
 * Start a new chat conversation
 */
export async function newChatHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  // Check limit before allowing new chat
  if (userId) {
    const created = await createConversation(ctx, "New Conversation", "chat");
    if (!created) {
      await ctx.reply(t(lang, "chat.limit_reached"), { parse_mode: "Markdown" });
      return;
    }
  }

  ctx.session.messages = [];
  ctx.session.step = BotStep.AI_CHAT;

  await ctx.reply(t(lang, "chat.new_chat"), {
    parse_mode: "Markdown",
    reply_markup: chatKeyboard,
  });
}

/**
 * Show chat history
 */
export async function chatHistoryHandler(ctx: BotContext): Promise<void> {
  await showHistory(ctx, "chat");
}

/**
 * Resume a chat conversation
 */
export async function resumeChatHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;

  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^resume:chat:(.+)/);
  if (!match) return;

  const conversationId = match[1]!;
  const resumed = await resumeConversation(ctx, conversationId);

  if (!resumed) {
    await ctx.reply(t(lang, "chat.error_generic"), { parse_mode: "Markdown" });
    return;
  }

  await ctx.reply(t(lang, "chat.resumed"), {
    parse_mode: "Markdown",
    reply_markup: chatKeyboard,
  });
}

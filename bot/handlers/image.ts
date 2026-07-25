/**
 * Image AI Handler
 * Generates detailed prompts for various image AI platforms.
 * Now with interactive history (clickable resume buttons),
 * conversation limit enforcement, and platform info in titles.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { imageAIService } from "@/services/ai/image";
import { imageKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import { conversationService } from "@/services/conversation";
import { usageService } from "@/services/usage";
import { providerRegistry } from "@/services/ai/providers";
import {
  createConversation,
  saveMessagesToDb,
  resumeConversation,
} from "@/bot/handlers/history";
import { InlineKeyboard } from "grammy";

const log = logger.child("handler-image");

/**
 * Image AI handler
 * Clears stale mode data and sets step to IMAGE_PROMPT.
 */
export async function imageHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedImagePlatform = "all";
  ctx.session.step = BotStep.IMAGE_PROMPT;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "image.welcome"), {
    parse_mode: "Markdown",
    reply_markup: imageKeyboard,
  });
}

/**
 * Handle image prompt generation
 * Saves to conversation history for later review and reopening.
 */
export async function imageGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedImagePlatform ?? "all";
  const userId = ctx.session.userId;

  if (!userId) return;

  // Create conversation if not exists — title includes platform/provider info
  if (!ctx.session.conversationId) {
    const platformLabel = platform === "all" ? "All Platforms" : platform;
    const title = `Image (${platformLabel}): ${text.slice(0, 70)}`;
    const created = await createConversation(ctx, title, "image");
    if (!created) {
      await ctx.reply(t(lang, "image.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "image.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await imageAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform,
      ctx.session.selectedModel
    );

    // Build structured response with prompt details
    let response = t(lang, "image.result_title");
    for (const prompt of prompts) {
      response += "🖼️ *" + prompt.platform + "*\n";
      response += prompt.fullPrompt + "\n\n";
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: response });

    // Save to database
    await saveMessagesToDb(ctx, "image");

    // Track usage (non-blocking)
    const selectedModel = ctx.session.selectedModel;
    const providerName = selectedModel
      ? providerRegistry.getModel(selectedModel)?.provider
      : undefined;
    usageService.track(userId, "image", 0, 0, providerName, selectedModel);

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  } catch (error) {
    log.error("Image AI error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    const friendlyMsg = error instanceof Error ? error.message : null;
    await ctx.reply(friendlyMsg || t(lang, "image.error"), {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  }
}

/**
 * Show image prompt history with clickable resume buttons
 * Each past prompt session becomes a button the user can tap to reopen.
 */
export async function imageHistoryHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.session.userId;
  const lang = ctx.session.language;

  if (!userId) return;

  const conversations = await conversationService.getUserConversations(
    userId,
    "image",
    10
  );

  if (conversations.length === 0) {
    await ctx.reply(t(lang, "image.no_history"), {
      parse_mode: "Markdown",
    });
    return;
  }

  // Build text + inline keyboard with resume buttons
  const kb = new InlineKeyboard();
  const lines: string[] = [t(lang, "image.history_title"), ""];

  for (const conv of conversations) {
    const date = conv.updatedAt.toLocaleDateString();
    const title = conv.title.length > 40
      ? conv.title.slice(0, 40) + "…"
      : conv.title;
    lines.push(`• *${title}*`);
    lines.push(`  🕐 ${date}`);
    lines.push("");

    // Clean label: remove "Image (prefix): " for button text
    const cleanLabel = conv.title
      .replace(/^Image\s*\([^)]+\):\s*/, "")
      .slice(0, 22);
    kb.text(`📂 ${cleanLabel}`, `resume:image:${conv.id}`).row();
  }

  // Add Back to Image button
  kb.text("🔙 Back to Image AI", "nav:back");

  await ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Resume a previous image prompt generation
 * Loads the conversation messages back into the session.
 */
export async function resumeImageHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^resume:image:(.+)/);
  if (!match) return;

  const conversationId = match[1]!;
  const resumed = await resumeConversation(ctx, conversationId);

  if (!resumed) {
    await ctx.reply(t(lang, "image.error"), { parse_mode: "Markdown" });
    return;
  }

  // Send the last response back to the user so they can see it again
  const lastAssistantMsg = [...ctx.session.messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (lastAssistantMsg) {
    await ctx.reply(`📋 *Previously generated prompts:*

${lastAssistantMsg.content}`, {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  } else {
    await ctx.reply(t(lang, "image.resumed"), {
      parse_mode: "Markdown",
      reply_markup: imageKeyboard,
    });
  }
}

/**
 * Video AI Handler
 * Generates professional video prompts for various platforms.
 * Now with interactive history (clickable resume + regenerate buttons),
 * conversation limit enforcement, and platform info in titles.
 */

import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { videoAIService } from "@/services/ai/video";
import { videoKeyboard } from "@/bot/keyboards";
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

const log = logger.child("handler-video");

/**
 * Video AI handler
 * Generates professional video prompts for various platforms.
 * Clears stale mode data and sets step to VIDEO_PROMPT.
 */
export async function videoHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedVideoPlatform = "all";
  ctx.session.step = BotStep.VIDEO_PROMPT;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "video.welcome"), {
    parse_mode: "Markdown",
    reply_markup: videoKeyboard,
  });
}

/**
 * Handle video prompt generation
 * Saves to conversation history for later review, reopening, and regeneration.
 */
export async function videoGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedVideoPlatform ?? "all";
  const userId = ctx.session.userId;

  if (!userId) return;

  // Create conversation if not exists — title includes platform/provider info
  if (!ctx.session.conversationId) {
    const platformLabel = platform === "all" ? "All Platforms" : platform;
    const title = "Video (" + platformLabel + "): " + text.slice(0, 70);
    const created = await createConversation(ctx, title, "video");
    if (!created) {
      await ctx.reply(t(lang, "video.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "video.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await videoAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform,
      ctx.session.selectedModel
    );

    // Build structured response with prompt details
    let response = t(lang, "video.result_title");
    for (const prompt of prompts) {
      response += "🎬 *" + prompt.platform + "*\n";
      // Show structured fields: Camera, Lighting, Scene (if available)
      if (prompt.cameraMovement || prompt.lens) {
        response += "📷 *Camera:* " + prompt.cameraMovement;
        if (prompt.lens) response += " (" + prompt.lens + ")";
        response += "\n";
      }
      if (prompt.lighting) {
        response += "💡 *Lighting:* " + prompt.lighting + "\n";
      }
      if (prompt.scene) {
        response += "🎭 *Scene:* " + prompt.scene + "\n";
      }
      response += "\n" + prompt.fullPrompt + "\n\n";
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // Store current description in tempData for regeneration
    ctx.session.tempData.lastPromptDescription = text;

    // Store in session
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: response });

    // Save to database
    await saveMessagesToDb(ctx, "video");

    // Track usage (non-blocking)
    const selectedModel = ctx.session.selectedModel;
    const providerName = selectedModel
      ? providerRegistry.getModel(selectedModel)?.provider
      : undefined;
    usageService.track(userId, "video", 0, 0, providerName, selectedModel);

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  } catch (error) {
    log.error("Video AI error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "video.error"), {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  }
}

/**
 * Show video prompt history with clickable resume buttons.
 * Each past prompt session becomes a button the user can tap to reopen.
 */
export async function videoHistoryHandler(ctx: BotContext): Promise<void> {
  const userId = ctx.session.userId;
  const lang = ctx.session.language;

  if (!userId) return;

  const conversations = await conversationService.getUserConversations(
    userId,
    "video",
    10
  );

  if (conversations.length === 0) {
    await ctx.reply(t(lang, "video.no_history"), {
      parse_mode: "Markdown",
    });
    return;
  }

  // Build text + inline keyboard with resume buttons
  const kb = new InlineKeyboard();
  const lines: string[] = [t(lang, "video.history_title"), ""];

  for (const conv of conversations) {
    const date = conv.updatedAt.toLocaleDateString();
    const title = conv.title.length > 40
      ? conv.title.slice(0, 40) + "…"
      : conv.title;
    lines.push("• *" + title + "*");
    lines.push("  🕐 " + date);
    lines.push("");

    // Clean label: remove "Video (prefix): " for button text
    const cleanLabel = conv.title
      .replace(/^Video\s*\([^)]+\):\s*/, "")
      .slice(0, 22);
    kb.text("📂 " + cleanLabel, "resume:video:" + conv.id).row();
  }

  // Add Back to Video button
  kb.text("🔙 Back to Video AI", "nav:back");

  await ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: kb,
  });
}

/**
 * Resume a previous video prompt generation and offer regenerate option.
 * Shows the old prompts with a button to regenerate new ones.
 */
export async function resumeVideoHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^resume:video:(.+)/);
  if (!match) return;

  const conversationId = match[1]!;
  const resumed = await resumeConversation(ctx, conversationId);

  if (!resumed) {
    await ctx.reply(t(lang, "video.error"), { parse_mode: "Markdown" });
    return;
  }

  // Store the original user description for regeneration
  const firstUserMsg = ctx.session.messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    ctx.session.tempData.lastPromptDescription = firstUserMsg.content;
  }

  // Send the last response back with a Regenerate button
  const lastAssistantMsg = [...ctx.session.messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const resumeKb = new InlineKeyboard()
    .text("🔄 Regenerate", "video:regenerate:" + conversationId)
    .row()
    .text("🔙 Back to Video AI", "nav:back");

  if (lastAssistantMsg) {
    await ctx.reply("📋 *Previously generated prompts:*\n\n" + lastAssistantMsg.content, {
      parse_mode: "Markdown",
      reply_markup: resumeKb,
    });
  } else {
    await ctx.reply(t(lang, "video.resumed"), {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  }
}

/**
 * Regenerate video prompts from the original description.
 * Reuses the stored description from the conversation.
 */
export async function regenerateVideoHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^video:regenerate:(.+)/);
  if (!match) return;

  const conversationId = match[1]!;

  // Load the original conversation to get the user's description
  const conversation = await conversationService.getConversationWithMessages(conversationId);
  if (!conversation || conversation.userId !== ctx.session.userId) {
    await ctx.reply(t(lang, "video.error"), { parse_mode: "Markdown" });
    return;
  }

  const firstUserMsg = conversation.messages.find((m) => m.role === "user");
  if (!firstUserMsg) {
    await ctx.reply(t(lang, "video.error"), { parse_mode: "Markdown" });
    return;
  }

  const userDescription = firstUserMsg.content;
  const platform = ctx.session.selectedVideoPlatform ?? "all";
  const userId = ctx.session.userId;

  if (!userId) return;

  // Use the existing conversation (don't create a new one)
  ctx.session.conversationId = conversationId;
  ctx.session.messages = [];
  ctx.session.step = BotStep.VIDEO_PROMPT;

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "video.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const prompts = await videoAIService.generatePrompt(
      userDescription,
      platform === "all" ? undefined : platform,
      ctx.session.selectedModel
    );

    // Build structured response
    let response = t(lang, "video.result_title");
    for (const prompt of prompts) {
      response += "🎬 *" + prompt.platform + "*\n";
      if (prompt.cameraMovement || prompt.lens) {
        response += "📷 *Camera:* " + prompt.cameraMovement;
        if (prompt.lens) response += " (" + prompt.lens + ")";
        response += "\n";
      }
      if (prompt.lighting) {
        response += "💡 *Lighting:* " + prompt.lighting + "\n";
      }
      response += "\n" + prompt.fullPrompt + "\n\n";
      response += "━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // Store in session and save to DB
    ctx.session.tempData.lastPromptDescription = userDescription;
    ctx.session.messages.push({ role: "user", content: userDescription });
    ctx.session.messages.push({ role: "assistant", content: response });
    await saveMessagesToDb(ctx, "video");

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});

    // Show regenerated prompts with confirmation header
    await ctx.reply(t(lang, "video.regenerated") + "\n\n" + response, {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  } catch (error) {
    log.error("Video regenerate error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "video.error"), {
      parse_mode: "Markdown",
      reply_markup: videoKeyboard,
    });
  }
}

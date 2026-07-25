/**
 * Video AI Handler
 * Generates professional video prompts for various platforms.
 * Now with interactive history (clickable resume + regenerate buttons),
 * conversation limit enforcement, and platform info in titles.
 *
 * Uses parse_mode: undefined for video content to avoid Telegram
 * parsing errors from special characters in AI-generated prompts.
 */

import type { BotContext, VideoPrompt } from "@/types";
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
 * Format an array of VideoPrompt objects into a Telegram-friendly string.
 * Only includes fields that have content. Never duplicates text.
 *
 * Sent with parse_mode: undefined (plain text) so special characters
 * like *, _, `, [, ], (, ) never crash Telegram.
 *
 * Example:
 *
 * 🎬 Hailuo AI
 *
 * 🎭 Scene:
 * A cinematic motorcycle rider...
 *
 * 💡 Lighting:
 * Dramatic sunset...
 */
function formatVideoPrompts(prompts: VideoPrompt[]): string {
  const parts: string[] = [];

  for (const prompt of prompts) {
    const block: string[] = [];
    block.push("🎬 " + prompt.platform);
    block.push("");

    if (prompt.title) {
      block.push("📌 " + prompt.title);
      block.push("");
    }

    if (prompt.scene) {
      block.push("🎭 Scene:");
      block.push(prompt.scene);
      block.push("");
    }

    if (prompt.subject) {
      block.push("🎯 Subject:");
      block.push(prompt.subject);
      block.push("");
    }

    if (prompt.action) {
      block.push("⚡ Action:");
      block.push(prompt.action);
      block.push("");
    }

    if (prompt.environment) {
      block.push("🌎 Environment:");
      block.push(prompt.environment);
      block.push("");
    }

    if (prompt.camera) {
      block.push("🎥 Camera:");
      const cameraLine = prompt.lens
        ? prompt.camera + " (" + prompt.lens + ")"
        : prompt.camera;
      block.push(cameraLine);
      block.push("");
    } else if (prompt.lens) {
      block.push("🎥 Lens:");
      block.push(prompt.lens);
      block.push("");
    }

    if (prompt.movement) {
      block.push("🎬 Movement:");
      block.push(prompt.movement);
      block.push("");
    }

    if (prompt.lighting) {
      block.push("💡 Lighting:");
      block.push(prompt.lighting);
      block.push("");
    }

    if (prompt.color_grading) {
      block.push("🎨 Color Grading:");
      block.push(prompt.color_grading);
      block.push("");
    }

    if (prompt.realism) {
      block.push("🔬 Realism:");
      block.push(prompt.realism);
      block.push("");
    }

    if (prompt.negative_prompt) {
      block.push("🚫 Negative Prompt:");
      block.push(prompt.negative_prompt);
      block.push("");
    }

    if (prompt.music) {
      block.push("🎵 Music:");
      block.push(prompt.music);
      block.push("");
    }

    if (prompt.voice) {
      block.push("🎙️ Voice:");
      block.push(prompt.voice);
      block.push("");
    }

    if (prompt.duration) {
      block.push("⏱ Duration:");
      block.push(prompt.duration);
      block.push("");
    }

    // Only show full_prompt if non-empty and doesn't look like raw JSON
    if (prompt.full_prompt && !looksLikeRawJson(prompt.full_prompt)) {
      block.push("📝 Full Prompt:");
      block.push(prompt.full_prompt);
      block.push("");
    }

    block.push("━━━━━━━━━━━━━━━━━━━━━");
    block.push("");

    parts.push(block.join("\n"));
  }

  return parts.join("\n");
}

/**
 * Quick check: does text look like raw JSON (starts with [ or { and has quoted keys)?
 */
function looksLikeRawJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const first = trimmed[0]!;
  return (first === "[" || first === "{") && /"[a-zA-Z]+\s*":/.test(trimmed.slice(0, 200));
}

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

  log.info("[VIDEO_FLOW] Handler started", { userId, platform, text: text.slice(0, 30) });

  // Create conversation if not exists — title includes platform/provider info
  if (!ctx.session.conversationId) {
    const platformLabel = platform === "all" ? "All Platforms" : platform;
    const title = "Video (" + platformLabel + "): " + text.slice(0, 70);
    const created = await createConversation(ctx, title, "video");
    if (!created) {
      log.warn("[VIDEO_FLOW] Limit reached", { userId, platform });
      await ctx.reply(t(lang, "video.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
    log.info("[VIDEO_FLOW] Conversation created", { userId, conversationId: ctx.session.conversationId });
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "video.generating"), {
    parse_mode: "Markdown",
  });

  try {
    log.info("[VIDEO_FLOW] Generating video prompt", { platform, model: ctx.session.selectedModel });

    const prompts = await videoAIService.generatePrompt(
      text,
      platform === "all" ? undefined : platform,
      ctx.session.selectedModel
    );

    // Build structured response with prompt details
    const response = t(lang, "video.result_title") + formatVideoPrompts(prompts);

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
      parse_mode: undefined,
      reply_markup: videoKeyboard,
    });
    log.info("[VIDEO_FLOW] Prompt generation successful");
  } catch (error) {
    log.error("[VIDEO_FLOW] Error during generation", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    const friendlyMsg = error instanceof Error ? error.message : String(error);
    await ctx.reply("❌ Video AI Error\n\nReason:\n" + friendlyMsg, {
      parse_mode: undefined,
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
    lines.push("• " + title);
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
    await ctx.reply("📋 Previously generated prompts:\n\n" + lastAssistantMsg.content, {
      parse_mode: undefined,
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
    const response = t(lang, "video.result_title") + formatVideoPrompts(prompts);

    // Store in session and save to DB
    ctx.session.tempData.lastPromptDescription = userDescription;
    ctx.session.messages.push({ role: "user", content: userDescription });
    ctx.session.messages.push({ role: "assistant", content: response });
    await saveMessagesToDb(ctx, "video");

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});

    // Show regenerated prompts with confirmation header
    await ctx.reply(t(lang, "video.regenerated") + "\n\n" + response, {
      parse_mode: undefined,
      reply_markup: videoKeyboard,
    });
  } catch (error) {
    log.error("Video regenerate error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    const friendlyMsg = error instanceof Error ? error.message : null;
    await ctx.reply("❌ Error\n\n" + (friendlyMsg || t(lang, "video.error")), {
      parse_mode: undefined,
      reply_markup: videoKeyboard,
    });
  }
}

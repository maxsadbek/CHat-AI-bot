import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { socialAIService } from "@/services/ai/social";
import { socialKeyboard } from "@/bot/keyboards";
import { clearModeData } from "@/bot/session";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import { usageService } from "@/services/usage";
import { providerRegistry } from "@/services/ai/providers";
import {
  createConversation,
  saveMessagesToDb,
} from "@/bot/handlers/history";

const log = logger.child("handler-social");

/**
 * Social Media handler
 * Generates platform-optimized social media content.
 * Clears stale mode data and sets step to SOCIAL_MEDIA.
 */
export async function socialHandler(ctx: BotContext): Promise<void> {
  clearModeData(ctx.session);
  ctx.session.selectedSocialPlatform = "all";
  ctx.session.step = BotStep.SOCIAL_MEDIA;

  const lang = ctx.session.language;

  await ctx.reply(t(lang, "social.welcome"), {
    parse_mode: "Markdown",
    reply_markup: socialKeyboard,
  });
}

/**
 * Handle social media content generation
 * Creates conversation history, saves to DB, and tracks usage like other features.
 */
export async function socialGenerateHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const lang = ctx.session.language;
  const platform = ctx.session.selectedSocialPlatform ?? "all";
  const userId = ctx.session.userId;

  if (!userId) return;

  // Create conversation if not exists — consistent with other features
  if (!ctx.session.conversationId) {
    const platformLabel = platform === "all" ? "All Platforms" : platform;
    const title = `Social (${platformLabel}): ${text.slice(0, 70)}`;
    const created = await createConversation(ctx, title, "social");
    if (!created) {
      await ctx.reply(t(lang, "social.limit_reached"), {
        parse_mode: "Markdown",
      });
      return;
    }
  }

  await ctx.replyWithChatAction("typing");
  const startMsg = await ctx.reply(t(lang, "social.generating"), {
    parse_mode: "Markdown",
  });

  try {
    const contents = await socialAIService.generateContent(
      text,
      platform === "all" ? undefined : platform,
      "professional",
      ctx.session.selectedModel
    );

    let response = t(lang, "social.result_title");
    for (const content of contents) {
      response += `📱 ${content.platform}\n`;
      response += "━━━━━━━━━━━━━━━━━━━━━\n";

      // Hook
      if (content.hooks.length > 0) {
        response += `\n🔥 Hook:\n${content.hooks[0]}\n`;
      }

      // Caption
      if (content.caption) {
        response += `\n📝 Caption:\n${content.caption}\n`;
      }

      // CTA
      if (content.cta) {
        response += `\n👉 CTA:\n${content.cta}\n`;
      }

      // Hashtags
      if (content.hashtags.length > 0) {
        response += `\n🏷️ Hashtags:\n${content.hashtags.slice(0, 15).join(" ")}\n`;
      }

      // Keywords
      if (content.trendingKeywords.length > 0) {
        response += `\n📈 Keywords:\n${content.trendingKeywords.join(", ")}\n`;
      }

      response += "\n━━━━━━━━━━━━━━━━━━━━━\n\n";
    }

    // Store in session (consistent with other features)
    ctx.session.messages.push({ role: "user", content: text });
    ctx.session.messages.push({ role: "assistant", content: response });

    // Save to database (consistent with other features)
    await saveMessagesToDb(ctx, "social");

    // Track usage (consistent with other features)
    const selectedModel = ctx.session.selectedModel;
    const providerName = selectedModel
      ? providerRegistry.getModel(selectedModel)?.provider
      : undefined;
    usageService.track(userId, "social", 0, 0, providerName, selectedModel);

    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(response, {
      parse_mode: undefined,
      reply_markup: socialKeyboard,
    });
  } catch (error) {
    log.error("Social Media AI error", { userId, error: String(error) });
    await ctx.api.deleteMessage(ctx.chat!.id, startMsg.message_id).catch(() => {});
    await ctx.reply(t(lang, "social.error"), {
      parse_mode: undefined,
      reply_markup: socialKeyboard,
    });
  }
}

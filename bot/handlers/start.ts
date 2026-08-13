import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { mainMenuKeyboard, languageKeyboard } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { resetSession } from "@/bot/session";
import { t, SUPPORTED_LANGUAGES, resolveLanguage } from "@/bot/localization";
import type { SupportedLanguage } from "@/bot/localization";
import { userSettingsRepository } from "@/repositories/settings";
import { referralService } from "@/services/referral";
import { logger } from "@/bot/core/logger";

const log = logger.child("start-handler");

/**
 * /start command handler
 *
 * Flow:
 *   NEW USER:   /start → language selection → (handled by callback) → welcome → main menu
 *   EXISTING:   /start → main menu only
 *
 * Rules:
 *   - Only one /start handler (no duplicates)
 *   - Check if user exists before creating profile (middleware handles this)
 *   - Never create duplicate profiles (middleware uses upsert)
 *   - Never show Welcome to existing users
 *   - Language selection appears only once (middleware loads from DB)
 *   - All future /start commands open only the Main Menu
 */
export async function startHandler(ctx: BotContext): Promise<void> {
  // ─── Referral flag ────────────────────────────────
  // The middleware marks a brand-new signup with tempData.isNewUser = "1".
  // MUST be read BEFORE resetSession() below clears tempData.
  const isNewUser = ctx.session.tempData.isNewUser === "1";

  // ─── Session reset ────────────────────────────────
  // Reset temporary state, close active mode, keep userId and language
  resetSession(ctx.session, true);
  ctx.session.step = BotStep.IDLE;

  // ─── Referral link handling (fresh signups only) ──
  // /start ref_<code> — attribute the referral and award both sides a bonus.
  const startText = ctx.message?.text ?? "";
  const refMatch = startText.match(/^\/start(?:@\w+)?\s+ref_([A-Za-z0-9_-]+)/i);
  if (refMatch?.[1] && isNewUser) {
    try {
      await referralService.applyReferral(ctx, refMatch[1]);
    } catch (error) {
      log.warn("Referral attribution failed", {
        userId: ctx.session.userId,
        error: String(error),
      });
    }
  }

  // ─── Safety fallback: try to load language from DB if middleware missed it ──
  // This happens only if userMiddleware failed to set languageSelected
  // (which should not occur after the fix, but protects against edge cases).
  if (!ctx.session.languageSelected && ctx.session.userId) {
    try {
      const settings = await userSettingsRepository.findByUserId(ctx.session.userId);
      if (settings?.language && SUPPORTED_LANGUAGES.includes(settings.language as SupportedLanguage)) {
        ctx.session.language = resolveLanguage(settings.language as SupportedLanguage, null);
        ctx.session.languageSelected = true;
      }
    } catch {
      // Non-critical — will show language selection as last resort
    }
  }

  // ─── Language Selection (new users only) ─────────
  if (!ctx.session.languageSelected) {
    ctx.session.step = BotStep.LANGUAGE;
    await ctx.reply(t(ctx.session.language, "language.select"), {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard(),
    });
    return;
  }

  // ─── Existing users — Main Menu only ─────────────
  const lang = ctx.session.language;
  await ctx.reply(t(lang, "menu.main"), {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard,
  });
}

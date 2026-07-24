/**
 * Premium Handler
 * Displays subscription plans with professional SaaS-style messaging.
 * Handles plan selection, upgrade flow, and current plan info.
 * Design inspired by ChatGPT, Claude, and Notion AI premium flows.
 */

import type { BotContext } from "@/types";
import { InlineKeyboard } from "grammy";
import { t } from "@/bot/localization";
import { subscriptionService } from "@/services/subscription";
import { paymentService } from "@/services/payment/payment-service";
import { paymentRegistry } from "@/services/payment/registry";
import { getActivePlans, SUBSCRIPTION_PLANS } from "@/config/plans";
import type { PlanId } from "@/config/plans";
import {
  premiumKeyboard,
  getPremiumKeyboard,
  planSelectionKeyboard,
  premiumNavKeyboard,
} from "@/bot/keyboards";
import { isAdmin } from "@/services/admin/admin-guard";
import { logger } from "@/bot/core/logger";

const log = logger.child("handler-premium");
const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━";

/**
 * Show the premium hub — current plan + plan options
 * Professional SaaS-style display with modern emojis and clean formatting.
 */
export async function premiumHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;

  if (!userId || !telegramId) {
    await ctx.reply(t(lang, "premium.title"), {
      parse_mode: "Markdown",
      reply_markup: premiumKeyboard,
    });
    return;
  }

  const isUserAdmin = isAdmin(telegramId);

  // ─── Admin: show admin status — never see payment/upgrade ───
  if (isUserAdmin) {
    const adminMessage = [
      `💎 *Admin Access — Unlimited*`,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `👑  **Status:**  Active — Full Access`,
      `♾️  **Limit:**   Unlimited requests`,
      `🔓  **Access:**  All AI features unlocked`,
      `⏳  **Expires:** Never`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      "",
      `✨ You have full admin privileges.`,
      `   All features are available without restrictions.`,
    ].join("\n");

    await ctx.reply(adminMessage, {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
    return;
  }

  try {
    const { plan, isExpired, daysRemaining, isLifetime } =
      await subscriptionService.getUserPlan(userId);

    const isPremiumUser = plan.id !== "free" && !isExpired;

    // ─── Premium User: show subscription information ───
    if (isPremiumUser) {
      const sub = await subscriptionService.getSubscription(userId);
      const renewDate = sub?.expiresAt
        ? sub.expiresAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Lifetime";

      const statusBadge = isExpired ? "❌ Expired" : "✅ Active";
      const planEmoji = plan.emoji;

      // Show subscription management with clean status display
      const message = [
        `💎 *Premium Active*`,
        "",
        `━━━━━━━━━━━━━━━━━━━━━`,
        `${planEmoji}  **Plan:**      ${plan.name}`,
        `📅  **Renew:**     ${renewDate}`,
        `📊  **Status:**    ${statusBadge}`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        "",
        `✨ *Unlocked Features:*`,
        ...plan.features
          .filter((f) => f.included)
          .map((f) => `  • ${f.emoji} ${f.label}`),
        "",
        `━━━━━━━━━━━━━━━━━━━━━`,
        `🎉 Thank you for being a Premium member!`,
      ].join("\n");

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: premiumNavKeyboard,
      });
      return;
    }

    // ─── Free User: show plan comparison with upgrade CTA ───
    const currentPlanLine = isLifetime
      ? t(lang, "premium.current_lifetime", { plan: `${plan.emoji} ${plan.name}` })
      : isExpired
        ? t(lang, "premium.expired", { plan: `${plan.emoji} ${plan.name}` })
        : daysRemaining !== null
          ? t(lang, "premium.current_days", {
              plan: `${plan.emoji} ${plan.name}`,
              days: String(daysRemaining),
            })
          : t(lang, "premium.current", { plan: `${plan.emoji} ${plan.name}` });

    const paidPlans = getActivePlans().filter((p) => p.id !== "free");

    // Build professional plan comparison cards
    const planCards = paidPlans
      .map((p) => {
        const badge = p.badge !== p.name ? ` \`${p.badge}\`` : "";
        const featureHighlights = p.features
          .filter((f) => f.included)
          .slice(0, 5) // Show top 5 features as highlights
          .map((f) => `  ✓ ${f.emoji} ${f.label}`)
          .join("\n");

        return [
          `┌─────────────────────────────────┐`,
          `${p.emoji}  *${p.name}*${badge}`,
          `${p.price.label}`,
          `${p.description}`,
          `│`,
          `${featureHighlights}`,
          `└─────────────────────────────────┘`,
        ].join("\n");
      })
      .join("\n\n");

    const message = [
      `✨ *Upgrade to Pro*`,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `${currentPlanLine}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      "",
      `🚀 *Choose your plan and unlock unlimited AI access:*`,
      "",
      planCards,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `💎 All plans include unlimited access to all AI features.`,
      `🔒 Secure payment powered by Stripe. Cancel anytime.`,
    ].join("\n");

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: getPremiumKeyboard(false, false),
    });
  } catch (error) {
    log.error("Premium handler error", { userId, error: String(error) });
    await ctx.reply(t(lang, "premium.title"), {
      parse_mode: "Markdown",
      reply_markup: premiumKeyboard,
    });
  }
}

/**
 * Show detailed plan information with feature breakdown
 */
export async function premiumPlanHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;

  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return;

  const isUserAdmin = telegramId ? isAdmin(telegramId) : false;
  let isPremiumUser = false;

  if (userId) {
    const userPlan = await subscriptionService.getUserPlan(userId);
    isPremiumUser = userPlan.plan.id !== "free" && !userPlan.isExpired;
  }

  const featureLines = plan.features
    .filter((f) => f.included)
    .map((f) => `✅ ${f.emoji} ${f.label}`);

  const priceTag = plan.price.amount === 0
    ? "Free"
    : plan.price.label;

  // Build plan header with savings badge for yearly
  const savingsBadge = plan.id === "pro_yearly"
    ? `🔥 *Save over 30%* — compared to monthly billing`
    : "";

  const bestValueBadge = plan.id === "pro_yearly"
    ? `⭐ *Best Value* — Most popular choice`
    : "";

  const message = [
    `━━━━━━━━━━━━━━━━━━━━━`,
    `${plan.emoji}  *${plan.name}*`,
    `${savingsBadge}`,
    `${bestValueBadge}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    "",
    `💎 *${plan.description}*`,
    "",
    `💰 **${plan.price.label}**`,
    `📆 ${plan.billingPeriod === "monthly" ? "Billed monthly" : plan.billingPeriod === "yearly" ? "Billed annually" : "One-time payment"}`,
    "",
    `━━━━━━━━━━━━━━━━━━━━━`,
    `✨ *Everything included:*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    "",
    ...featureLines,
    "",
    `━━━━━━━━━━━━━━━━━━━━━`,
    plan.price.amount === 0
      ? t(lang, "premium.current_free")
      : isUserAdmin || isPremiumUser
        ? `✅ You already have active ${plan.name} access!`
        : `🚀 ${t(lang, "premium.upgrade_cta", { price: priceTag })}`,
    "",
    plan.price.amount > 0 && !isUserAdmin && !isPremiumUser
      ? `🔒 Secure payment — powered by Stripe`
      : "",
  ].join("\n");

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: planSelectionKeyboard(plan.id, isPremiumUser, isUserAdmin),
  });
}

/**
 * Handle upgrade confirmation — creates payment session & provides payment link
 * Shows a clean secure payment screen without exposing raw payment details.
 */
export async function premiumUpgradeHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;

  if (!userId || !telegramId) return;

  // ─── Admin guard: never show payment ───
  if (isAdmin(telegramId)) {
    await ctx.reply(
      `👑 *Admin Account*\n\nYou already have unlimited access to all features. No payment needed.`,
      {
        parse_mode: "Markdown",
        reply_markup: premiumNavKeyboard,
      }
    );
    return;
  }

  // ─── Already premium guard ───
  const currentSub = await subscriptionService.getUserPlan(userId);
  if (currentSub.plan.id !== "free" && !currentSub.isExpired) {
    await ctx.reply(
      `💎 *Premium Active*\n\nYou already have an active ${currentSub.plan.name} subscription!\n\nEnjoy unlimited access to all AI features. 🚀`,
      {
        parse_mode: "Markdown",
        reply_markup: premiumNavKeyboard,
      }
    );
    return;
  }

  if (planId === "free") {
    await ctx.reply(t(lang, "premium.current_free"), {
      parse_mode: "Markdown",
      reply_markup: premiumKeyboard,
    });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return;

  try {
    const provider = paymentRegistry.getDefaultProvider();
    const paymentResult = await paymentService.createPayment({
      userId,
      telegramUserId: telegramId,
      planId: planId as PlanId,
      providerId: provider.config.id as any,
    });

    // Build secure checkout keyboard — no raw card numbers exposed!
    const kb = new InlineKeyboard();
    if (paymentResult.paymentUrl) {
      kb.url("💳 Subscribe Securely", paymentResult.paymentUrl).row();
    }
    kb.text("📋 Compare Plans", "premium:back");

    // Clean payment screen — inspired by ChatGPT/Claude checkout
    const payMessage = [
      `🔐 *Secure Checkout*`,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `${plan.emoji}  **${plan.name}**`,
      `💰  **${plan.price.label}**`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      "",
      `💳 **Protected by ${provider.providerName}**`,
      "",
      `🔒 Your payment information is encrypted and`,
      `   never stored by Kayzel Creator.`,
      "",
      paymentResult.paymentUrl
        ? `👇 Click the button below to complete your subscription.`
        : `📱 Follow the instructions from ${provider.providerName} to complete payment.`,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Need help? Contact support.`,
    ].join("\n");

    await ctx.reply(payMessage, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });

    log.info(`Payment initiated for user ${userId} plan ${planId}`, {
      paymentId: paymentResult.session.id,
    });
  } catch (error) {
    log.error("Upgrade payment session failed", { userId, planId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
  }
}

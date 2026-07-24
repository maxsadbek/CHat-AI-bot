/**
 * Premium Handler
 * Displays subscription plans with feature comparison.
 * Handles plan selection, upgrade flow, and current plan info.
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

  // Admin users never see payment requirement
  if (isUserAdmin) {
    const adminMessage = [
      t(lang, "premium.title"),
      "",
      "👑 *Admin Status:* Active",
      "♾️ *Daily Limit:* Unlimited (999,999 requests/day)",
      "🔓 *Access:* Full access to all AI features",
      "⏳ *Expires:* Never",
      "",
      DIVIDER,
      "✨ *Admin Account Active*",
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

    const planEmoji = plan.emoji;
    const planName = plan.name;

    const currentPlanLine = isLifetime
      ? t(lang, "premium.current_lifetime", { plan: `${planEmoji} ${planName}` })
      : isExpired
        ? t(lang, "premium.expired", { plan: `${planEmoji} ${planName}` })
        : daysRemaining !== null
          ? t(lang, "premium.current_days", {
              plan: `${planEmoji} ${planName}`,
              days: String(daysRemaining),
            })
          : t(lang, "premium.current", { plan: `${planEmoji} ${planName}` });

    // Premium users see subscription information instead of purchase options
    if (isPremiumUser) {
      const message = [
        t(lang, "premium.title"),
        "",
        currentPlanLine,
        "",
        DIVIDER,
        `✨ *Active Features:*`,
        ...plan.features.filter((f) => f.included).map((f) => `✅ ${f.emoji} ${f.label}`),
        "",
        DIVIDER,
        "🎉 Thank you for subscribing!",
      ].join("\n");

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: premiumNavKeyboard,
      });
      return;
    }

    // Non-premium users see plan options
    const paidPlans = getActivePlans().filter((p) => p.id !== "free");
    const planSummaries = paidPlans
      .map((p) => {
        const badge = p.badge !== p.name ? ` [${p.badge}]` : "";
        return `${p.emoji} *${p.name}*${badge}\n${p.description}\n💰 ${p.price.label}`;
      })
      .join("\n\n");

    const message = [
      t(lang, "premium.title"),
      "",
      currentPlanLine,
      "",
      DIVIDER,
      t(lang, "premium.choose_plan"),
      DIVIDER,
      "",
      planSummaries,
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
 * Show details for a specific plan with upgrade option
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
    .map((f) => `${f.emoji} ${f.label}`);

  const priceTag = plan.price.amount === 0
    ? "Free"
    : plan.price.label;

  const message = [
    `${DIVIDER}`,
    `${plan.emoji} *${plan.name}*`,
    `${DIVIDER}`,
    "",
    `*${plan.description}*`,
    "",
    `💰 *Price:* ${priceTag}`,
    `📆 *Billing:* ${plan.billingPeriod}`,
    "",
    `${DIVIDER}`,
    `✨ *Features:*`,
    `${DIVIDER}`,
    "",
    ...featureLines.map((f) => `✅ ${f}`),
    "",
    `${DIVIDER}`,
    plan.price.amount === 0
      ? t(lang, "premium.current_free")
      : isUserAdmin || isPremiumUser
        ? "✅ You already have active premium access!"
        : t(lang, "premium.upgrade_cta", { price: priceTag }),
  ].join("\n");

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: planSelectionKeyboard(plan.id, isPremiumUser, isUserAdmin),
  });
}

/**
 * Handle upgrade confirmation — creates payment session & provides payment link
 */
export async function premiumUpgradeHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;

  if (!userId || !telegramId) return;

  // Admin should never see payment requirement
  if (isAdmin(telegramId)) {
    await ctx.reply("👑 Admin accounts already have unlimited access to all features.", {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
    return;
  }

  // Check if user is already premium
  const currentSub = await subscriptionService.getUserPlan(userId);
  if (currentSub.plan.id !== "free" && !currentSub.isExpired) {
    await ctx.reply("⭐ You already have an active Premium subscription!", {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
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

    const kb = new InlineKeyboard();
    if (paymentResult.paymentUrl) {
      kb.url("💳 Pay Now", paymentResult.paymentUrl).row();
    }
    kb.text("🔙 Back to Plans", "premium:back");

    const payMessage = [
      `💳 *Complete Your Subscription Payment*`,
      "",
      `Plan: ${plan.emoji} *${plan.name}*`,
      `Price: *${plan.price.label}*`,
      `Provider: *${provider.providerName}*`,
      "",
      paymentResult.paymentUrl
        ? "Please click the button below to complete your payment securely."
        : "Payment session initialized. Follow instructions to proceed.",
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
    // Fallback: If payment provider error occurs, provide direct notification
    await ctx.reply(t(lang, "errors.generic"), {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
  }
}

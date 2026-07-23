/**
 * Premium Handler
 * Displays subscription plans with feature comparison.
 * Handles plan selection, upgrade flow, and current plan info.
 */

import type { BotContext } from "@/types";
import { t } from "@/bot/localization";
import { subscriptionService } from "@/services/subscription";
import { getActivePlans, SUBSCRIPTION_PLANS } from "@/config/plans";
import type { PlanId } from "@/config/plans";
import {
  premiumKeyboard,
  planSelectionKeyboard,
  premiumNavKeyboard,
} from "@/bot/keyboards";
import { logger } from "@/bot/core/logger";

const log = logger.child("handler-premium");
const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━";

/**
 * Show the premium hub — current plan + plan options
 */
export async function premiumHandler(ctx: BotContext): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  if (!userId) {
    await ctx.reply(t(lang, "premium.title"), {
      parse_mode: "Markdown",
      reply_markup: premiumKeyboard,
    });
    return;
  }

  try {
    const { plan, isExpired, daysRemaining, isLifetime } =
      await subscriptionService.getUserPlan(userId);

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

    // Build plan summaries from active paid plans
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
      reply_markup: premiumKeyboard,
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
  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return;

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
      : t(lang, "premium.upgrade_cta", { price: priceTag }),
  ].join("\n");

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: planSelectionKeyboard(plan.id),
  });
}

/**
 * Handle upgrade confirmation — simulate or process payment
 */
export async function premiumUpgradeHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const lang = ctx.session.language;
  const userId = ctx.session.userId;

  if (!userId) return;

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
    await subscriptionService.upgrade(
      userId,
      planId as PlanId,
      "simulated_payment"
    );
    await ctx.reply(
      t(lang, "premium.upgrade_success", {
        plan: `${plan.emoji} ${plan.name}`,
      }),
      {
        parse_mode: "Markdown",
        reply_markup: premiumNavKeyboard,
      }
    );
    log.info(`User ${userId} upgraded to ${planId} (simulated)`);
  } catch (error) {
    log.error("Upgrade failed", { userId, planId, error: String(error) });
    await ctx.reply(t(lang, "errors.generic"), {
      parse_mode: "Markdown",
    });
  }
}

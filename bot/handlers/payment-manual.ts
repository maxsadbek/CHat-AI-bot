/**
 * Manual Payment Handler
 *
 * Temporary manual payment system for users who don't have access to
 * international payment methods (Stripe). Users send a payment receipt
 * screenshot, and admins manually verify and approve/reject the payment.
 *
 * Flow:
 *   1. User clicks "Subscribe Now" → sees manual payment card details
 *   2. User clicks "📷 Send Receipt" → bot waits for a photo
 *   3. User sends photo → receipt saved, forwarded to all admins
 *   4. Admin clicks "✅ Approve" → user gets premium for 30 days
 *   5. Admin clicks "❌ Reject" → user gets rejection message
 *
 * Architecture:
 *   - Keeps all existing Stripe/payment code intact
 *   - Uses a separate ManualPayment DB model (manual_payments table)
 *   - Session step MANUAL_PAYMENT_RECEIPT tracks photo-waiting state
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { sessionManager } from "@/bot/core/session-manager";
import { logger } from "@/bot/core/logger";
import { prisma } from "@/lib/prisma";
import { premiumNavKeyboard, mainMenuKeyboard } from "@/bot/keyboards";
import { env } from "@/config";
import { SUBSCRIPTION_PLANS } from "@/config/plans";
import type { PlanId } from "@/config/plans";
import { subscriptionService } from "@/services/subscription";
import { adminGuard } from "@/bot/middleware/admin";

const log = logger.child("handler-manual-payment");

// ─── Constants ──────────────────────────────────────────

/** Fixed manual payment amount in UZS */
const MANUAL_PAYMENT_AMOUNT = 40000;
const MANUAL_PAYMENT_CURRENCY = "UZS";

// ══════════════════════════════════════════════════════════
// 1. SHOW MANUAL PAYMENT PAGE
// ══════════════════════════════════════════════════════════

/**
 * Display the manual payment page with card details.
 * Called from premiumUpgradeHandler when manual payment is selected.
 *
 * Shows:
 *   💳 Manual Payment
 *   Card holder: Maxsad Baxtiyorov
 *   Card number: 8600 XXXX XXXX XXXX
 *   Amount: 40 000 UZS
 *
 * Buttons:
 *   📷 Send Receipt
 *   ⬅️ Back
 */
export async function manualPaymentShowHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return;

  // Get user info from Telegram
  const user = ctx.from;
  const firstName = user?.first_name ?? "User";
  const lastName = user?.last_name ?? "";

  // Store the planId in session tempData so the receipt callback can read it
  sessionManager.setTempData(ctx.session, "manualPaymentPlan", planId);

  // Build the manual payment info message
  const message = [
    `━━━━━━━━━━━━━━━━━━━━━`,
    `💳 *Manual Payment*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    "",
    `👤 *Card Holder:*`,
    `${firstName} ${lastName}`,
    "",
    `💳 *Card Number:*`,
    `\`8600 XXXX XXXX XXXX\``,
    "",
    `💰 *Amount:*`,
    `${MANUAL_PAYMENT_AMOUNT.toLocaleString()} ${MANUAL_PAYMENT_CURRENCY}`,
    "",
    `━━━━━━━━━━━━━━━━━━━━━`,
    "",
    `📸 *After payment:*`,
    `Send the payment receipt (screenshot).`,
    "",
    `⏳ The administrator will verify the payment.`,
    "",
    `✅ Premium will be activated after confirmation.`,
    "",
    `━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");

  // Import keyboard inline to avoid circular deps
  const { manualPaymentKeyboard } = await import("@/bot/keyboards");

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: manualPaymentKeyboard(),
  });
}

// ══════════════════════════════════════════════════════════
// 2. HANDLE "SEND RECEIPT" BUTTON
// ══════════════════════════════════════════════════════════

/**
 * Called when user clicks "📷 Send Receipt".
 * Sets session step to MANUAL_PAYMENT_RECEIPT so the photo handler
 * knows to process the next photo as a payment receipt.
 *
 * Stores the selected planId in tempData for later use.
 */
export async function manualPaymentReceiptHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  // Store the plan ID so we know what plan they're paying for
  sessionManager.setTempData(ctx.session, "manualPaymentPlan", planId);
  // Set session step so photo handler can intercept the next photo
  sessionManager.setStep(ctx.session, BotStep.MANUAL_PAYMENT_RECEIPT);

  await ctx.reply(
    `📸 *Please send your payment receipt screenshot.*\n\n` +
    `Send exactly one photo showing the completed payment.\n` +
    `The administrator will review and confirm your subscription.`,
    {
      parse_mode: "Markdown",
    }
  );
}

// ══════════════════════════════════════════════════════════
// 3. PROCESS RECEIPT PHOTO
// ══════════════════════════════════════════════════════════

/**
 * Process a photo received as a payment receipt.
 * Called from the message:photo handler in bot/index.ts when
 * session step is MANUAL_PAYMENT_RECEIPT.
 *
 * Steps:
 *   1. Extract photo file_id (largest size)
 *   2. Save manual payment record to database
 *   3. Forward the receipt with details to every ADMIN_ID
 *   4. Confirm to user that receipt was received
 */
export async function manualPaymentProcessPhotoHandler(
  ctx: BotContext
): Promise<void> {
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;
  const planId = sessionManager.getTempData(ctx.session, "manualPaymentPlan") ?? "pro_monthly";

  if (!userId || !telegramId) {
    await ctx.reply("❌ *Error processing your request. Please try again.*", {
      parse_mode: "Markdown",
    });
    sessionManager.clearTempData(ctx.session);
    sessionManager.setStep(ctx.session, BotStep.IDLE);
    return;
  }

  // Get the largest photo (best quality)
  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    await ctx.reply("❌ *Please send a photo.*", { parse_mode: "Markdown" });
    return;
  }

  // Use the largest available photo size
  const fileId = photo[photo.length - 1]!.file_id;
  const firstName = ctx.from?.first_name ?? "User";
  const lastName = ctx.from?.last_name ?? "";
  const username = ctx.from?.username;

  try {
    // Save manual payment record to database
    const manualPayment = await prisma.manualPayment.create({
      data: {
        userId,
        telegramUserId: BigInt(telegramId),
        photoFileId: fileId,
        plan: planId,
        amount: MANUAL_PAYMENT_AMOUNT,
        currency: MANUAL_PAYMENT_CURRENCY,
        status: "PENDING",
      },
    });

    log.info("Manual payment receipt saved", {
      paymentId: manualPayment.id,
      userId,
      planId,
    });

    // Get plan display name
    const plan = SUBSCRIPTION_PLANS[planId as PlanId];
    const planName = plan?.name ?? "Pro Monthly";

    // Build admin notification message
    const adminMessage = [
      `💰 *New Premium Payment*`,
      "",
      `👤 *User:*`,
      username ? `@${username}` : "—",
      "",
      `📛 *Name:*`,
      `${firstName} ${lastName}`,
      "",
      `🆔 *Telegram ID:*`,
      `\`${telegramId}\``,
      "",
      `📋 *Plan:*`,
      `${planName}`,
      "",
      `💰 *Amount:*`,
      `${MANUAL_PAYMENT_AMOUNT.toLocaleString()} ${MANUAL_PAYMENT_CURRENCY}`,
      "",
      `📅 *Date:*`,
      `${manualPayment.createdAt.toLocaleString()}`,
    ].join("\n");

    // Forward receipt to all admins
    const adminIds = env.ADMIN_IDS;
    let forwardedCount = 0;

    for (const adminId of adminIds) {
      try {
        // Send the receipt photo with details as caption
        await ctx.api.sendPhoto(adminId, fileId, {
          caption: adminMessage,
          parse_mode: "Markdown",
          reply_markup: manualPaymentAdminKeyboard(manualPayment.id),
        });
        forwardedCount++;
      } catch (error) {
        log.error("Failed to forward receipt to admin", {
          adminId,
          error: String(error),
        });
      }
    }

    // Confirm to user that receipt was received
    const confirmMessage = [
      `✅ *Receipt Received!*`,
      "",
      `📸 Your payment screenshot has been received.`,
      `⏳ An administrator will verify it shortly.`,
      "",
      `━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *Plan:* ${planName}`,
      `💰 *Amount:* ${MANUAL_PAYMENT_AMOUNT.toLocaleString()} ${MANUAL_PAYMENT_CURRENCY}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      "",
      forwardedCount > 0
        ? `✅ Receipt forwarded to ${forwardedCount} administrator(s) for review.`
        : `⚠️ Could not forward to administrators. Please contact support.`,
    ].join("\n");

    await ctx.reply(confirmMessage, {
      parse_mode: "Markdown",
      reply_markup: premiumNavKeyboard,
    });
  } catch (error) {
    log.error("Error saving manual payment", {
      userId,
      telegramId,
      planId,
      error: String(error),
    });
    await ctx.reply(
      "❌ *Error saving your payment receipt. Please try again or contact support.*",
      { parse_mode: "Markdown" }
    );
  }

  // Clear temp data and reset session step
  sessionManager.clearTempData(ctx.session);
  sessionManager.setStep(ctx.session, BotStep.IDLE);
}

// ══════════════════════════════════════════════════════════
// 4. ADMIN ACTIONS — APPROVE / REJECT
// ══════════════════════════════════════════════════════════

/**
 * Build the admin action keyboard for a manual payment.
 * Shows:
 *   ✅ Approve
 *   ❌ Reject
 */
function manualPaymentAdminKeyboard(paymentId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Approve", `admin:manual:approve:${paymentId}`)
    .text("❌ Reject", `admin:manual:reject:${paymentId}`);
}

/**
 * Admin approves a manual payment.
 * - Sets user.isPremium = true
 * - Sets subscription expiresAt = +30 days
 * - Sends confirmation message to user
 */
export async function manualPaymentApproveHandler(
  ctx: BotContext,
  paymentId: string
): Promise<void> {
  // Verify admin access
  if (!(await adminGuard(ctx))) return;

  const adminId = ctx.from!.id;

  try {
    // Find the manual payment record
    const payment = await prisma.manualPayment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      await ctx.reply("❌ *Payment record not found.*", { parse_mode: "Markdown" });
      return;
    }

    if (payment.status !== "PENDING") {
      await ctx.reply(
        `❌ *Payment already ${payment.status.toLowerCase()}.*`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Update payment status to APPROVED
    await prisma.manualPayment.update({
      where: { id: paymentId },
      data: {
        status: "APPROVED",
        adminId: BigInt(adminId),
      },
    });

    // Activate premium subscription via subscription service
    // This handles isPremium, dailyLimit, subscription record, etc.
    await subscriptionService.upgrade(
      payment.userId,
      payment.plan as PlanId,
      paymentId,
      "manual"
    );

    log.info("Manual payment approved", {
      paymentId,
      userId: payment.userId,
      planId: payment.plan,
      adminId,
    });

    // Notify admin
    await ctx.reply(
      `✅ *Payment approved!*\n\n` +
      `User #${payment.userId} has been granted ${payment.plan} for 30 days.`,
      { parse_mode: "Markdown" }
    );

    // Send confirmation to the user
    try {
      const confirmMessage = [
        `✅ *Premium Activated!* 🎉`,
        "",
        `━━━━━━━━━━━━━━━━━━━━━`,
        `Your payment has been verified and approved.`,
        "",
        `💎 You now have *Premium* access to all AI features!`,
        `📅 Valid for 30 days.`,
        `━━━━━━━━━━━━━━━━━━━━━`,
        "",
        `🚀 Enjoy unlimited access to all AI tools!`,
      ].join("\n");

      await ctx.api.sendMessage(
        Number(payment.telegramUserId),
        confirmMessage,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      log.error("Failed to send approval notification to user", {
        telegramUserId: Number(payment.telegramUserId),
        error: String(error),
      });
    }
  } catch (error) {
    log.error("Error approving manual payment", {
      paymentId,
      adminId,
      error: String(error),
    });
    await ctx.reply("❌ *Error approving payment.*", { parse_mode: "Markdown" });
  }
}

/**
 * Admin rejects a manual payment.
 * - Updates payment status to REJECTED
 * - Sends rejection message to user
 */
export async function manualPaymentRejectHandler(
  ctx: BotContext,
  paymentId: string
): Promise<void> {
  // Verify admin access
  if (!(await adminGuard(ctx))) return;

  const adminId = ctx.from!.id;

  try {
    // Find the manual payment record
    const payment = await prisma.manualPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      await ctx.reply("❌ *Payment record not found.*", { parse_mode: "Markdown" });
      return;
    }

    if (payment.status !== "PENDING") {
      await ctx.reply(
        `❌ *Payment already ${payment.status.toLowerCase()}.*`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Update payment status to REJECTED
    await prisma.manualPayment.update({
      where: { id: paymentId },
      data: {
        status: "REJECTED",
        adminId: BigInt(adminId),
      },
    });

    log.info("Manual payment rejected", {
      paymentId,
      userId: payment.userId,
      planId: payment.plan,
      adminId,
    });

    // Notify admin
    await ctx.reply(
      `❌ *Payment rejected.*\n\n` +
      `User #${payment.userId}'s payment for ${payment.plan} has been rejected.`,
      { parse_mode: "Markdown" }
    );

    // Send rejection notification to the user
    try {
      const rejectMessage = [
        `❌ *Payment Rejected*`,
        "",
        `━━━━━━━━━━━━━━━━━━━━━`,
        `Unfortunately, your payment could not be verified.`,
        "",
        `💡 *Possible reasons:*`,
        `• The receipt screenshot was unclear`,
        `• The payment amount was incorrect`,
        `• The transaction could not be confirmed`,
        "",
        `📩 Please contact support for assistance.`,
        `━━━━━━━━━━━━━━━━━━━━━`,
      ].join("\n");

      await ctx.api.sendMessage(
        Number(payment.telegramUserId),
        rejectMessage,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      log.error("Failed to send rejection notification to user", {
        telegramUserId: Number(payment.telegramUserId),
        error: String(error),
      });
    }
  } catch (error) {
    log.error("Error rejecting manual payment", {
      paymentId,
      adminId,
      error: String(error),
    });
    await ctx.reply("❌ *Error rejecting payment.*", { parse_mode: "Markdown" });
  }
}

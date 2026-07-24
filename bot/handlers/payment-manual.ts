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
 *   - All displayed values read from environment variables
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { sessionManager } from "@/bot/core/session-manager";
import { logger } from "@/bot/core/logger";
import { prisma } from "@/lib/prisma";
import { premiumNavKeyboard } from "@/bot/keyboards";
import { env } from "@/config";
import { SUBSCRIPTION_PLANS } from "@/config/plans";
import type { PlanId } from "@/config/plans";
import { subscriptionService } from "@/services/subscription";
import { adminGuard } from "@/bot/middleware/admin";

const log = logger.child("handler-manual-payment");

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Extract every possible detail from an error object for diagnostic logging.
 * Handles Prisma errors (code + meta), standard Errors (message + stack),
 * and unknown shapes gracefully.
 *
 * Returns a flat object safe for JSON.stringify (no BigInt, no circular refs).
 */
function extractErrorDetails(error: unknown): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  if (error instanceof Error) {
    details.errorMessage = error.message;
    details.errorName = error.name;
    details.stack = error.stack;

    // PrismaClientKnownRequestError has .code and .meta
    const prismaError = error as unknown as Record<string, unknown>;
    if (prismaError.code && typeof prismaError.code === "string") {
      details.prismaCode = prismaError.code;
    }
    if (prismaError.meta !== undefined) {
      try {
        details.prismaMeta = JSON.parse(JSON.stringify(prismaError.meta));
      } catch {
        details.prismaMeta = String(prismaError.meta);
      }
    }
  } else {
    // Non-Error throw — rare but possible
    details.rawError = String(error);
    details.errorType = typeof error;
  }

  return details;
}

/**
 * Format a 16-digit card number with spaces every 4 digits.
 * "8600123412341234" → "8600 1234 1234 1234"
 * Falls back to a generic masked placeholder if the env var is empty.
 * NEVER hardcodes a real card number.
 */
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 16) {
    return digits.slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }
  // Generic placeholder — no real card number hardcoded
  return "XXXX XXXX XXXX XXXX";
}

/**
 * Format a numeric amount with space as thousand separator.
 * 40000 → "40 000"
 */
function formatUZS(amount: number): string {
  return amount.toLocaleString("en-US").replace(/,/g, " ");
}

// ══════════════════════════════════════════════════════════
// 1. SHOW MANUAL PAYMENT PAGE
// ══════════════════════════════════════════════════════════

/**
 * Display the premium manual payment page.
 *
 * All display values (card holder, card number, amounts) are read
 * from environment variables — never hardcoded.
 *
 * Design: Clean, Apple-inspired layout with:
 *   - Generous vertical spacing for readability on mobile
 *   - Section dividers for visual hierarchy
 *   - Minimal but purposeful emoji use
 *   - Clear CTA: only one primary action (Send Receipt)
 */
export async function manualPaymentShowHandler(
  ctx: BotContext,
  planId: string
): Promise<void> {
  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return;

  // Store the planId in session tempData so the receipt callback can read it
  sessionManager.setTempData(ctx.session, "manualPaymentPlan", planId);

  // ─── Read all display values from environment ──────────
  const cardHolder  = env.MANUAL_PAYMENT_CARD_NAME;
  const rawCard     = env.MANUAL_PAYMENT_CARD_NUMBER;
  const amountUZS   = env.MANUAL_PAYMENT_AMOUNT_UZS;
  const priceUSD    = env.MANUAL_PAYMENT_PRICE_USD;

  const formattedCard  = formatCardNumber(rawCard);
  const formattedUZS   = formatUZS(amountUZS);
  const appName        = env.NEXT_PUBLIC_APP_NAME || "Kayzel Creator";
  const divider        = "━━━━━━━━━━━━━━━━━━━━━━";

  // ─── Build the premium payment message ─────────────────
  // Apple-inspired: clean sections, generous line breaks,
  // clear information hierarchy, single primary CTA.
  const message = [
    divider,
    `💎 *${appName} Pro*`,
    divider,
    "",
    `Unlock every premium feature.`,
    "",
    `*Price*`,
    "",
    `💰 *$${priceUSD}*`,
    "",
    `For users in Uzbekistan,`,
    `a local payment method is available.`,
    "",
    divider,
    "",
    `💳 *Payment Details*`,
    "",
    `👤 Card Holder`,
    `${cardHolder}`,
    "",
    `💳 Card Number`,
    `\`${formattedCard}\``,
    "",
    `💰 Local Amount`,
    `${formattedUZS} UZS`,
    "",
    divider,
    "",
    `📌 *Instructions*`,
    "",
    `• Transfer the exact amount.`,
    `• Take a screenshot after payment.`,
    `• Press "📷 Send Receipt".`,
    `• Wait for payment verification.`,
    "",
    divider,
    "",
    `⏱ Average verification`,
    `5–30 minutes`,
    "",
    `🔒 Secure manual verification by ${appName} Team`,
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
 *
 * Diagnostic logging:
 *   - Every input value is logged before the Prisma create() call
 *   - On failure, full Prisma error details (code, meta, stack) are captured
 *   - The user-facing error message stays generic; details go to server logs
 */
export async function manualPaymentProcessPhotoHandler(
  ctx: BotContext
): Promise<void> {
  const userId = ctx.session.userId;
  const telegramId = ctx.from?.id;
  const planId = sessionManager.getTempData(ctx.session, "manualPaymentPlan") ?? "pro_monthly";
  const messageId = ctx.message?.message_id;

  // ─── Log all input values before any processing ─────────
  log.debug("=== MANUAL PAYMENT RECEIPT: PHOTO RECEIVED ===", {
    telegramUserId: telegramId,
    databaseUserId: userId,
    selectedPlan: planId,
    messageId,
  });

  if (!userId || !telegramId) {
    log.warn("Missing userId or telegramId in session — cannot process receipt", {
      databaseUserId: userId,
      telegramUserId: telegramId,
    });
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
    log.warn("Message has no photo array despite message:photo trigger", {
      telegramUserId: telegramId,
      messageId,
    });
    await ctx.reply("❌ *Please send a photo.*", { parse_mode: "Markdown" });
    return;
  }

  // Use the largest available photo size
  const fileId = photo[photo.length - 1]!.file_id;
  log.debug("Photo extracted successfully", {
    fileId,
    totalSizes: photo.length,
    largestWidth: photo[photo.length - 1]!.width,
    largestHeight: photo[photo.length - 1]!.height,
  });

  const firstName = ctx.from?.first_name ?? "User";
  const lastName = ctx.from?.last_name ?? "";
  const username = ctx.from?.username;

  // ─── Read amount from env — NEVER hardcode ────────────
  const rawAmount = env.MANUAL_PAYMENT_AMOUNT_UZS;
  // Ensure amount is a valid positive integer (Prisma Int column rejects NaN/non-integers).
  // If the env var is missing or invalid, use the Zod default (0) as a safe fallback.
  const paymentAmount = Number.isFinite(rawAmount) && rawAmount > 0
    ? Math.floor(rawAmount)
    : env.MANUAL_PAYMENT_AMOUNT_UZS; // Already validated by Zod; 0 means "not configured"
  const paymentCurrency = "UZS";

  log.debug("Amount resolved from env", {
    rawEnvValue: rawAmount,
    resolvedAmount: paymentAmount,
    currency: paymentCurrency,
  });

  try {
    // ─── Build and log the full create() payload ───────────
    // ─── Build and log the full create() payload ───────────
    const createPayload = {
      userId,
      telegramUserId: BigInt(telegramId),
      receiptFileId: fileId,
      receiptMessageId: messageId ?? null,
      plan: planId,
      amount: paymentAmount,
      currency: paymentCurrency,
      status: "PENDING" as const,
    };

    log.debug("Attempting prisma.manualPayment.create()", {
      payload: {
        ...createPayload,
        telegramUserId: String(createPayload.telegramUserId), // BigInt → string for JSON serialisation
      },
    });

    // Save manual payment record to database
    const manualPayment = await prisma.manualPayment.create({
      data: createPayload,
    });

    log.info("Manual payment receipt saved successfully", {
      paymentId: manualPayment.id,
      databaseUserId: userId,
      telegramUserId: telegramId,
      plan: planId,
      fileId,
      createdAt: manualPayment.createdAt.toISOString(),
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
      `${formatUZS(paymentAmount)} ${paymentCurrency}`,
      "",
      `📅 *Date:*`,
      `${manualPayment.createdAt.toLocaleString()}`,
    ].join("\n");

    // Forward receipt to all admins
    const adminIds = env.ADMIN_IDS;
    let forwardedCount = 0;

    log.debug("Forwarding receipt to admin(s)", { adminCount: adminIds.length });

    for (const adminId of adminIds) {
      try {
        // Send the receipt photo with details as caption
        await ctx.api.sendPhoto(adminId, fileId, {
          caption: adminMessage,
          parse_mode: "Markdown",
          reply_markup: manualPaymentAdminKeyboard(manualPayment.id),
        });
        log.debug("Receipt forwarded to admin", { adminId });
        forwardedCount++;
      } catch (error) {
        log.error("Failed to forward receipt to admin", {
          adminId,
          errorDetails: extractErrorDetails(error),
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
      `💰 *Amount:* ${formatUZS(paymentAmount)} ${paymentCurrency}`,
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
    // ─── Comprehensive Prisma error logging ───────────────
    // Extract every possible detail so we can diagnose the root cause.
    const errorDetails = extractErrorDetails(error);

    log.error("=== MANUAL PAYMENT CREATE FAILED ===", {
      databaseUserId: userId,
      telegramUserId: telegramId,
      selectedPlan: planId,
      photoFileId: fileId,
      messageId,
      ...errorDetails,
    });

    // Keep the user-facing message identical — don't leak internal details
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

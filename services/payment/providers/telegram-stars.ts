/**
 * Telegram Stars Payment Provider
 * https://core.telegram.org/bots/api#payments
 *
 * Stub — ready for real integration.
 * Telegram Stars lets users pay with Telegram Stars ⭐
 * via native Telegram invoice flow.
 * Best option for Telegram bots — no external redirect needed.
 */

import type {
  PaymentProvider,
  PaymentProviderConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  WebhookResult,
} from "../interface";
import { logger } from "@/bot/core/logger";

const log = logger.child("payment:telegram-stars");

/**
 * Telegram Stars payment provider.
 *
 * How it works:
 * 1. Bot calls sendInvoice with currency="XTR" (Telegram Stars)
 * 2. User sees a native Telegram popup with price in Stars
 * 3. User confirms payment inside Telegram (no external browser)
 * 4. Telegram sends pre_checkout_query → bot answers
 * 5. On success, Telegram sends message with successful_payment
 *
 * Stars exchange rate: 1 Star ≈ $0.012 (varies by region)
 * Pricing example:
 *   Pro Monthly  → 833 Stars  ($9.99 / $0.012)
 *   Pro Yearly   → 8,333 Stars ($99.99 / $0.012)
 *   Lifetime     → 25,000 Stars ($299.99 / $0.012)
 */

export class TelegramStarsProvider implements PaymentProvider {
  readonly providerName = "Telegram Stars";

  readonly config: PaymentProviderConfig = {
    id: "telegram_stars",
    displayName: "Telegram Stars",
    enabled: false, // Enable via environment: TELEGRAM_STARS_ENABLED=true
    supportedCurrencies: ["XTR"], // Telegram Stars special currency
    supportsWebhooks: false,      // No webhook — handled via Telegram Bot API updates
    supportsRefunds: false,       // Telegram does not support refunds natively
    usesDeepLinks: true,          // Native Telegram UI handles payment
    configKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_PROVIDER_TOKEN"],
    availability: ["Global"],
  };

  async initialize(): Promise<void> {
    log.info("Telegram Stars provider initialized (stub)");
    // TODO: Validate TELEGRAM_BOT_TOKEN, TELEGRAM_PROVIDER_TOKEN
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    log.info("Telegram Stars createPayment (stub)", {
      userId: request.userId,
      amount: request.amount,
    });

    // TODO: Implement Telegram invoice creation
    // const stars = Math.ceil(request.amount / STARS_PER_USD_CENT);
    // Bot sends via Telegram Bot API:
    //   sendInvoice(
    //     chat_id: request.telegramUserId,
    //     title: `AI Creator Studio ${plan.emoji} ${plan.name}`,
    //     description: plan.description,
    //     payload: JSON.stringify({ userId, planId }),
    //     provider_token: "",
    //     currency: "XTR",
    //     prices: [{ label: plan.name, amount: stars }],
    //   );
    // Returns: { message_id, ... }

    return {
      sessionId: `tg_stars_stub_${Date.now()}`,
      paymentUrl: undefined,
      deepLink: undefined, // Telegram handles the UI natively
      raw: { stub: true, provider: "telegram_stars", starsAmount: Math.ceil(request.amount / 1.2) },
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    log.info("Telegram Stars verifyPayment (stub)", { sessionId: request.sessionId });

    // TODO: Verify Telegram Stars payment
    // Verification happens via message handler:
    //   bot.on("message", (ctx) => {
    //     if (ctx.message?.successful_payment) {
    //       const { payload } = ctx.message.successful_payment;
    //       const { userId, planId } = JSON.parse(payload);
    //       // Activate subscription
    //     }
    //   });
    // Also handle pre_checkout_query:
    //   bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

    return {
      verified: true,
      transactionId: request.transactionId ?? `tg_stars_txn_${Date.now()}`,
      amount: 0,
      currency: "XTR",
      status: "succeeded",
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    // Telegram Stars does not use external webhooks.
    // Payment events arrive via Telegram Bot API updates
    // and are handled by bot/index.ts message handlers.
    log.info("Telegram Stars webhook called — not supported (handled via Bot API)");
    return {
      processed: false,
      eventType: "not_supported",
      transactionId: "",
      shouldActivate: false,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    // Telegram does not natively support refunds for Stars payments.
    log.warn("Telegram Stars refund requested — not supported by platform", {
      transactionId: request.transactionId,
    });
    return {
      success: false,
      refundId: "",
      amount: 0,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // TODO: Verify bot token can send invoices (call getMe or similar)
    return {
      healthy: true,
      message: "Telegram Stars provider stub — healthy (not actually connected)",
    };
  }
}

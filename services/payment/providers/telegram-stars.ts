/**
 * Telegram Stars Payment Provider
 * https://core.telegram.org/bots/api#payments
 *
 * Telegram Stars lets users pay with Telegram Stars ⭐
 * via native Telegram invoice flow.
 *
 * Environment variables required:
 *   TELEGRAM_BOT_TOKEN      — Your Telegram bot token
 *   TELEGRAM_PROVIDER_TOKEN — Your Telegram payments provider token
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
 */

export class TelegramStarsProvider implements PaymentProvider {
  readonly providerName = "Telegram Stars";

  readonly config: PaymentProviderConfig = {
    id: "telegram_stars",
    displayName: "Telegram Stars",
    enabled: !!(
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_PROVIDER_TOKEN
    ),
    supportedCurrencies: ["XTR"],
    supportsWebhooks: false,
    supportsRefunds: false,
    usesDeepLinks: true,
    configKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_PROVIDER_TOKEN"],
    availability: ["Global"],
  };

  async initialize(): Promise<void> {
    if (this.config.enabled) {
      log.info("Telegram Stars provider initialized");
    } else {
      log.warn(
        "Telegram Stars provider not initialized: set TELEGRAM_BOT_TOKEN and TELEGRAM_PROVIDER_TOKEN"
      );
    }
  }

  private ensureConfigured(): void {
    if (!this.config.enabled) {
      throw new Error(
        "Telegram Stars is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_PROVIDER_TOKEN environment variables."
      );
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.ensureConfigured();

    log.info("Creating Telegram Stars payment", {
      userId: request.userId,
      amount: request.amount,
      telegramUserId: request.telegramUserId,
    });

    // TODO: Implement Telegram invoice creation via Bot API
    // const stars = Math.ceil(request.amount / STARS_PER_USD_CENT);
    // Bot sends via Telegram Bot API:
    //   sendInvoice(chat_id, title, description, payload, provider_token, "XTR", prices)
    throw new Error("Telegram Stars API integration not yet implemented");
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    this.ensureConfigured();

    log.info("Verifying Telegram Stars payment", { sessionId: request.sessionId });

    // TODO: Implement Telegram Stars payment verification
    // Verification happens via message handler:
    //   bot.on("message", (ctx) => {
    //     if (ctx.message?.successful_payment) { ... }
    //   });
    throw new Error("Telegram Stars API integration not yet implemented");
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    // Telegram Stars does not use external webhooks.
    // Payment events arrive via Telegram Bot API updates.
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
    if (!this.config.enabled) {
      return {
        healthy: false,
        message: "Telegram Stars not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_PROVIDER_TOKEN",
      };
    }
    return { healthy: true, message: "Telegram Stars provider configured" };
  }
}

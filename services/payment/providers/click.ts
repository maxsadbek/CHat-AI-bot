/**
 * Click Payment Provider
 * https://click.uz
 *
 * Click is a popular payment system in Uzbekistan supporting
 * UzCard, Humo, and other local cards.
 *
 * Environment variables required:
 *   CLICK_SERVICE_ID   — Your Click service ID
 *   CLICK_MERCHANT_ID  — Your Click merchant ID
 *   CLICK_SECRET_KEY   — Your Click secret key
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

const log = logger.child("payment:click");

export class ClickProvider implements PaymentProvider {
  readonly providerName = "Click";

  readonly config: PaymentProviderConfig = {
    id: "click",
    displayName: "Click",
    enabled: !!(
      process.env.CLICK_SERVICE_ID &&
      process.env.CLICK_MERCHANT_ID &&
      process.env.CLICK_SECRET_KEY
    ),
    supportedCurrencies: ["UZS"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: false,
    configKeys: ["CLICK_SERVICE_ID", "CLICK_MERCHANT_ID", "CLICK_SECRET_KEY"],
    availability: ["UZ"],
  };

  async initialize(): Promise<void> {
    if (this.config.enabled) {
      log.info("Click provider initialized");
    } else {
      log.warn(
        "Click provider not initialized: set CLICK_SERVICE_ID, CLICK_MERCHANT_ID, and CLICK_SECRET_KEY"
      );
    }
  }

  private ensureConfigured(): void {
    if (!this.config.enabled) {
      throw new Error(
        "Click is not configured. Set CLICK_SERVICE_ID, CLICK_MERCHANT_ID, and CLICK_SECRET_KEY environment variables."
      );
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.ensureConfigured();

    log.info("Creating Click payment", {
      userId: request.userId,
      amount: request.amount,
    });

    // TODO: Implement actual Click API integration
    // POST https://api.click.uz/v2/merchant/invoice/create
    // Request: { service_id, merchant_id, amount, transaction_parameter, ... }
    throw new Error("Click API integration not yet implemented");
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    this.ensureConfigured();

    log.info("Verifying Click payment", { sessionId: request.sessionId });

    // TODO: Implement Click payment verification
    throw new Error("Click API integration not yet implemented");
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    this.ensureConfigured();

    log.info("Click webhook received");

    // TODO: Implement Click webhook validation
    throw new Error("Click API integration not yet implemented");
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    this.ensureConfigured();

    log.info("Processing Click refund", { transactionId: request.transactionId });

    // TODO: Implement Click refund
    throw new Error("Click API integration not yet implemented");
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.config.enabled) {
      return {
        healthy: false,
        message: "Click not configured — set CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY",
      };
    }
    // TODO: Ping Click API
    return { healthy: true, message: "Click provider configured" };
  }
}

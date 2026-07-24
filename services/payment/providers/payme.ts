/**
 * Payme Payment Provider
 * https://payme.uz
 *
 * Payme is a leading payment system in Uzbekistan.
 *
 * Environment variables required:
 *   PAYME_MERCHANT_ID  — Your Payme merchant ID
 *   PAYME_SECRET_KEY   — Your Payme secret key
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

const log = logger.child("payment:payme");

export class PaymeProvider implements PaymentProvider {
  readonly providerName = "Payme";

  readonly config: PaymentProviderConfig = {
    id: "payme",
    displayName: "Payme",
    enabled: !!(
      process.env.PAYME_MERCHANT_ID &&
      process.env.PAYME_SECRET_KEY
    ),
    supportedCurrencies: ["UZS"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: true,
    configKeys: ["PAYME_MERCHANT_ID", "PAYME_SECRET_KEY"],
    availability: ["UZ"],
  };

  async initialize(): Promise<void> {
    if (this.config.enabled) {
      log.info("Payme provider initialized");
    } else {
      log.warn(
        "Payme provider not initialized: set PAYME_MERCHANT_ID and PAYME_SECRET_KEY"
      );
    }
  }

  private ensureConfigured(): void {
    if (!this.config.enabled) {
      throw new Error(
        "Payme is not configured. Set PAYME_MERCHANT_ID and PAYME_SECRET_KEY environment variables."
      );
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.ensureConfigured();

    log.info("Creating Payme payment", {
      userId: request.userId,
      amount: request.amount,
    });

    // TODO: Implement actual Payme API integration
    // POST https://checkout.payme.uz/api
    // Request: { method: "cards.create", params: { amount, account: {...}, ... } }
    throw new Error("Payme API integration not yet implemented");
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    this.ensureConfigured();

    log.info("Verifying Payme payment", { sessionId: request.sessionId });

    // TODO: Implement Payme payment verification
    throw new Error("Payme API integration not yet implemented");
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    this.ensureConfigured();

    log.info("Payme webhook received");

    // TODO: Implement Payme webhook validation
    throw new Error("Payme API integration not yet implemented");
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    this.ensureConfigured();

    log.info("Processing Payme refund", { transactionId: request.transactionId });

    // TODO: Implement Payme refund
    throw new Error("Payme API integration not yet implemented");
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.config.enabled) {
      return {
        healthy: false,
        message: "Payme not configured — set PAYME_MERCHANT_ID and PAYME_SECRET_KEY",
      };
    }
    // TODO: Ping Payme API
    return { healthy: true, message: "Payme provider configured" };
  }
}

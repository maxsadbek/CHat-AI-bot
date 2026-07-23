/**
 * Payme Payment Provider
 * https://payme.uz
 *
 * Stub — ready for real integration.
 * Payme is a leading payment system in Uzbekistan.
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
    enabled: false, // Enable via environment: PAYME_ENABLED=true
    supportedCurrencies: ["UZS"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: true, // Payme supports deep links into its mobile app
    configKeys: ["PAYME_MERCHANT_ID", "PAYME_SECRET_KEY"],
    availability: ["UZ"],
  };

  async initialize(): Promise<void> {
    log.info("Payme provider initialized (stub)");
    // TODO: Validate PAYME_MERCHANT_ID, PAYME_SECRET_KEY
    // TODO: Initialize Payme API client
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    log.info("Payme createPayment (stub)", {
      userId: request.userId,
      amount: request.amount,
    });

    // TODO: Implement Payme payment creation
    // Payme API: POST https://checkout.payme.uz/api
    // Request: { method: "cards.create", params: { amount, account: {...}, ... } }
    // Response: { result: { card: { token, phone, ... }, ... } }

    return {
      sessionId: `payme_stub_${Date.now()}`,
      paymentUrl: undefined,
      deepLink: `payme://pay?amount=${request.amount}&id=stub_${Date.now()}`,
      raw: { stub: true, provider: "payme" },
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    log.info("Payme verifyPayment (stub)", { sessionId: request.sessionId });

    // TODO: Verify Payme payment via API or webhook validation
    // Payme sends webhooks with: { method: "PerformTransaction", params: { id, amount, account, ... } }
    // Signature: Base64(HMAC_SHA_256(request_body, secret_key))
    // Check if Authorization header matches

    return {
      verified: true,
      transactionId: request.transactionId ?? `payme_txn_${Date.now()}`,
      amount: 0,
      currency: "UZS",
      status: "succeeded",
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    log.info("Payme webhook received (stub)");

    // TODO: Validate Payme webhook signature
    // Authorization header: Base64(HMAC_SHA_256(body, secret_key))
    // Parse JSON-RPC method: PerformTransaction, CheckTransaction, CancelTransaction

    return {
      processed: true,
      eventType: "payment.succeeded",
      transactionId: "payme_webhook_stub",
      shouldActivate: true,
      planId: undefined,
      userId: undefined,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    log.info("Payme refund (stub)", { transactionId: request.transactionId });

    // TODO: Implement Payme refund
    // Payme API: POST with method: "cards.unblock" or reverse transaction

    return {
      success: true,
      refundId: `payme_refund_stub_${Date.now()}`,
      amount: request.amount ?? 0,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // TODO: Ping Payme API
    return { healthy: true, message: "Payme provider stub — healthy (not actually connected)" };
  }
}

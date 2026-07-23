/**
 * Click Payment Provider
 * https://click.uz
 *
 * Stub — ready for real integration.
 * Click is a popular payment system in Uzbekistan supporting
 * UzCard, Humo, and other local cards.
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
    enabled: false, // Enable via environment: CLICK_ENABLED=true
    supportedCurrencies: ["UZS"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: false,
    configKeys: ["CLICK_SERVICE_ID", "CLICK_MERCHANT_ID", "CLICK_SECRET_KEY"],
    availability: ["UZ"],
  };

  async initialize(): Promise<void> {
    log.info("Click provider initialized (stub)");
    // TODO: Validate CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY
    // TODO: Initialize Click API client
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    log.info("Click createPayment (stub)", {
      userId: request.userId,
      amount: request.amount,
    });

    // TODO: Implement Click payment creation
    // Click API: POST https://api.click.uz/v2/merchant/invoice/create
    // Request: { service_id, merchant_id, amount, transaction_parameter, ... }
    // Response: { invoice_id, url, ... }

    return {
      sessionId: `click_stub_${Date.now()}`,
      paymentUrl: undefined,
      deepLink: undefined,
      raw: { stub: true, provider: "click" },
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    log.info("Click verifyPayment (stub)", { sessionId: request.sessionId });

    // TODO: Verify Click payment status
    // Click API: GET https://api.click.uz/v2/merchant/invoice/status/{invoice_id}
    // Or validate webhook signature from Click

    return {
      verified: true,
      transactionId: request.transactionId ?? `click_txn_${Date.now()}`,
      amount: 0,
      currency: "UZS",
      status: "succeeded",
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    log.info("Click webhook received (stub)");

    // TODO: Validate Click webhook signature
    // Click sends: { click_trans_id, service_id, merchant_trans_id, amount, ... }
    // Signature validation: signString = click_trans_id + click_paydoc_id + service_id +
    //                      merchant_trans_id + amount + action + secret_key

    return {
      processed: true,
      eventType: "payment.succeeded",
      transactionId: "click_webhook_stub",
      shouldActivate: true,
      planId: undefined,
      userId: undefined,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    log.info("Click refund (stub)", { transactionId: request.transactionId });

    // TODO: Implement Click refund
    // Click API: POST https://api.click.uz/v2/merchant/invoice/cancel/{invoice_id}

    return {
      success: true,
      refundId: `click_refund_stub_${Date.now()}`,
      amount: request.amount ?? 0,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // TODO: Ping Click API to verify connectivity
    return { healthy: true, message: "Click provider stub — healthy (not actually connected)" };
  }
}

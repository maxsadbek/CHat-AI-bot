/**
 * Stripe Payment Provider
 * https://stripe.com
 *
 * Stub — ready for real integration.
 * Stripe supports global payments via credit/debit cards,
 * Apple Pay, Google Pay, and more.
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

const log = logger.child("payment:stripe");

export class StripeProvider implements PaymentProvider {
  readonly providerName = "Stripe";

  readonly config: PaymentProviderConfig = {
    id: "stripe",
    displayName: "Stripe",
    enabled: false, // Enable via environment: STRIPE_ENABLED=true
    supportedCurrencies: ["USD", "EUR", "GBP", "UZS", "RUB"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: false,
    configKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    availability: ["US", "EU", "UK", "UZ", "RU", "Global"],
  };

  async initialize(): Promise<void> {
    log.info("Stripe provider initialized (stub)");
    // TODO: Validate STRIPE_SECRET_KEY
    // TODO: Initialize Stripe SDK: new Stripe(secretKey)
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    log.info("Stripe createPayment (stub)", {
      userId: request.userId,
      amount: request.amount,
      currency: request.currency,
    });

    // TODO: Implement Stripe Checkout Session creation
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const session = await stripe.checkout.sessions.create({
    //   mode: "payment",
    //   line_items: [{ price_data: { currency, product_data: { name }, unit_amount: amount }, quantity: 1 }],
    //   success_url: request.successUrl,
    //   cancel_url: request.cancelUrl,
    //   metadata: { userId: String(request.userId), planId: request.planId },
    // });

    return {
      sessionId: `stripe_stub_${Date.now()}`,
      paymentUrl: `https://checkout.stripe.com/pay/stub_${Date.now()}`,
      deepLink: undefined,
      raw: { stub: true, provider: "stripe" },
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    log.info("Stripe verifyPayment (stub)", { sessionId: request.sessionId });

    // TODO: Verify Stripe payment status via Stripe SDK
    // const session = await stripe.checkout.sessions.retrieve(request.sessionId);
    // Check session.payment_status === "paid"

    return {
      verified: true,
      transactionId: request.transactionId ?? `stripe_txn_${Date.now()}`,
      amount: 0,
      currency: "USD",
      status: "succeeded",
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    log.info("Stripe webhook received (stub)");

    // TODO: Validate Stripe webhook signature
    // const sig = event.headers["stripe-signature"];
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const payload = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    // Handle: checkout.session.completed, invoice.paid, etc.

    return {
      processed: true,
      eventType: "checkout.session.completed",
      transactionId: "stripe_webhook_stub",
      shouldActivate: true,
      planId: undefined,
      userId: undefined,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    log.info("Stripe refund (stub)", { transactionId: request.transactionId });

    // TODO: Implement Stripe refund
    // const refund = await stripe.refunds.create({ payment_intent: request.transactionId });

    return {
      success: true,
      refundId: `stripe_refund_stub_${Date.now()}`,
      amount: request.amount ?? 0,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // TODO: Ping Stripe API (simple balance retrieval)
    return { healthy: true, message: "Stripe provider stub — healthy (not actually connected)" };
  }
}

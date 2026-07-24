/**
 * Stripe Payment Provider
 * https://stripe.com
 *
 * Creates real Stripe Checkout Sessions via the Stripe SDK.
 * The returned URL comes directly from stripe.checkout.sessions.create() → session.url
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY     — Your Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET — Your Stripe webhook signing secret (whsec_...)
 */

import Stripe from "stripe";
import { env } from "@/config";
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
    enabled: !!env.STRIPE_SECRET_KEY,
    supportedCurrencies: ["USD", "EUR", "GBP"],
    supportsWebhooks: true,
    supportsRefunds: true,
    usesDeepLinks: false,
    configKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    availability: ["Global"],
  };

  private stripe: Stripe | null = null;

  async initialize(): Promise<void> {
    this.ensureStripe();
  }

  private ensureStripe(): Stripe {
    if (this.stripe) return this.stripe;

    // ─── Debug logging (temporary — remove after confirming env vars load) ──
    console.log("[stripe] STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
    console.log("[stripe] Environment:", process.env.NODE_ENV);

    const secretKey = env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      log.warn("Stripe provider not initialized: STRIPE_SECRET_KEY is not set");
      throw new Error(
        "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment."
      );
    }

    log.info("Stripe provider initializing");
    this.stripe = new Stripe(secretKey, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
    log.info("Stripe provider initialized successfully");

    return this.stripe;
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const stripe = this.ensureStripe();

    log.info("Creating Stripe Checkout Session", {
      userId: request.userId,
      amount: request.amount,
      currency: request.currency,
      planId: request.planId,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: request.currency.toLowerCase(),
            product_data: {
              name: request.description ?? `Plan: ${request.planId}`,
            },
            unit_amount: request.amount,
          },
          quantity: 1,
        },
      ],
      success_url: request.successUrl ?? `${env.NEXT_PUBLIC_APP_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl ?? `${env.NEXT_PUBLIC_APP_URL}/premium/cancel`,
      metadata: {
        userId: String(request.userId),
        planId: request.planId,
        paymentId: request.metadata?.paymentId ?? "",
      },
    });

    if (!session.url) {
      throw new Error("Stripe Checkout Session creation returned no URL");
    }

    log.info("Stripe Checkout Session created", {
      sessionId: session.id,
      url: session.url,
    });

    return {
      sessionId: session.id,
      paymentUrl: session.url,
      deepLink: undefined,
      raw: {
        stripeSessionId: session.id,
        paymentIntent: session.payment_intent,
        mode: session.mode,
      },
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const stripe = this.ensureStripe();

    log.info("Verifying Stripe payment", { sessionId: request.sessionId });

    const session = await stripe.checkout.sessions.retrieve(request.sessionId, {
      expand: ["payment_intent"],
    });

    const isPaid = session.payment_status === "paid";
    const paymentIntent = session.payment_intent;

    log.info("Stripe payment verification result", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      isPaid,
    });

    return {
      verified: isPaid,
      transactionId:
        typeof paymentIntent === "string"
          ? paymentIntent
          : paymentIntent?.id ?? session.id,
      amount: session.amount_total ?? 0,
      currency: session.currency?.toUpperCase() ?? "USD",
      status: isPaid ? "succeeded" : "failed",
      metadata: {
        stripeSessionId: session.id,
        paymentIntentId:
          typeof paymentIntent === "string"
            ? paymentIntent
            : paymentIntent?.id ?? "",
      },
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    const stripe = this.ensureStripe();

    const sig = event.headers["stripe-signature"];
    if (!sig) {
      throw new Error("Missing stripe-signature header");
    }

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    let constructedEvent: Stripe.Event;
    try {
      constructedEvent = stripe.webhooks.constructEvent(
        event.body as string,
        sig,
        webhookSecret
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook signature verification failed";
      log.error("Stripe webhook signature verification failed", { error: message });
      throw new Error(message);
    }

    const eventType = constructedEvent.type;
    const session = constructedEvent.data?.object as Stripe.Checkout.Session | undefined;

    log.info("Stripe webhook event verified", {
      eventType,
      sessionId: session?.id,
    });

    let shouldActivate = false;
    let transactionId = session?.id ?? "";

    switch (eventType) {
      case "checkout.session.completed": {
        if (session?.payment_status === "paid") {
          shouldActivate = true;
          transactionId =
            (typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id) ?? session.id;
        }
        break;
      }
      case "checkout.session.expired": {
        log.info("Stripe checkout session expired", { sessionId: session?.id });
        break;
      }
      case "invoice.paid": {
        shouldActivate = true;
        break;
      }
      case "invoice.payment_failed": {
        log.warn("Stripe invoice payment failed", { invoiceId: session?.id });
        break;
      }
      default:
        log.debug("Unhandled Stripe webhook event type", { eventType });
    }

    return {
      processed: true,
      eventType,
      transactionId,
      shouldActivate,
      planId: (session?.metadata?.planId as any) ?? undefined,
      userId: session?.metadata?.userId
        ? Number(session.metadata.userId)
        : undefined,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    const stripe = this.ensureStripe();

    log.info("Processing Stripe refund", {
      transactionId: request.transactionId,
      amount: request.amount,
    });

    const refund = await stripe.refunds.create({
      payment_intent: request.transactionId,
      amount: request.amount,
      reason: request.reason === "requested_by_customer" ? "requested_by_customer" : undefined,
    });

    log.info("Stripe refund processed", {
      refundId: refund.id,
      status: refund.status,
    });

    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      amount: refund.amount,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.stripe) {
      return { healthy: false, message: "Stripe not configured — set STRIPE_SECRET_KEY" };
    }
    try {
      const balance = await this.stripe.balance.retrieve();
      const available = balance.available.reduce((sum, b) => sum + b.amount, 0);
      return {
        healthy: true,
        message: `Stripe connected — available balance: ${(available / 100).toFixed(2)} ${balance.available[0]?.currency.toUpperCase() ?? "USD"}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Stripe health check failed: ${String(error).slice(0, 200)}`,
      };
    }
  }
}

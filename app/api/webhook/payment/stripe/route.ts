/**
 * Stripe Payment Webhook
 * Receives webhook events from Stripe.
 *
 * Validates the stripe-signature header using the Stripe SDK,
 * then routes events to the payment service for processing.
 *
 * Environment: STRIPE_WEBHOOK_SECRET must be set.
 */

import { type NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment/payment-service";
import { paymentRegistry } from "@/services/payment/registry";
import { logger } from "@/bot/core/logger";

const log = logger.child("webhook:stripe");

// Initialize Stripe provider once at module level
let stripeProviderInitialized = false;

async function getStripeProvider() {
  const provider = paymentRegistry.getProvider("stripe");
  if (!stripeProviderInitialized) {
    await provider.initialize();
    stripeProviderInitialized = true;
  }
  return provider;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    log.info("Stripe webhook received", {
      signaturePrefix: signature.substring(0, 16) + "...",
    });

    const stripeProvider = await getStripeProvider();
    const result = await stripeProvider.handleWebhook({
      body,
      headers: { "stripe-signature": signature },
    });

    log.info("Stripe webhook processed", {
      eventType: result.eventType,
      transactionId: result.transactionId,
      shouldActivate: result.shouldActivate,
    });

    // If payment was successful, verify and activate subscription
    if (result.shouldActivate && result.transactionId) {
      try {
        await paymentService.verifyPayment({
          sessionId: result.transactionId,
          transactionId: result.transactionId,
          rawData: { eventType: result.eventType },
        });

        log.info("Subscription activated from Stripe webhook", {
          transactionId: result.transactionId,
        });
      } catch (error) {
        log.error("Failed to activate subscription from webhook", {
          transactionId: result.transactionId,
          error: String(error),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error("Stripe webhook processing error", { error: String(error) });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}

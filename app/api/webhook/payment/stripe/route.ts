/**
 * Stripe Payment Webhook
 * Receives webhook events from Stripe.
 *
 * TODO: Implement real webhook verification:
 *   - Validate stripe-signature header
 *   - Construct event with Stripe SDK:
 *     const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *     const event = stripe.webhooks.constructEvent(
 *       body, signature, process.env.STRIPE_WEBHOOK_SECRET
 *     );
 *   - Handle event types: checkout.session.completed, invoice.paid, etc.
 *   - On checkout.session.completed: update payment, activate subscription
 */

import { type NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment/payment-service";
import { logger } from "@/bot/core/logger";

const log = logger.child("webhook:stripe");

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";
    log.info("Stripe webhook received", { signature: signature.substring(0, 20) + "..." });

    // TODO: Validate Stripe webhook signature
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const event = stripe.webhooks.constructEvent(
    //   body, signature, process.env.STRIPE_WEBHOOK_SECRET
    // );
    // const eventType = event.type;
    // const session = event.data.object;

    // For now, parse raw body
    const parsed = JSON.parse(body);
    const eventType = parsed.type;
    const session = parsed.data?.object ?? {};

    log.info("Stripe event received", { eventType, sessionId: session.id });

    switch (eventType) {
      case "checkout.session.completed": {
        // Payment completed successfully
        if (session.payment_status === "paid") {
          // TODO: Extract metadata from session
          // const { userId, planId, paymentId } = session.metadata || {};

          await paymentService.verifyPayment({
            sessionId: session.metadata?.payment_id ?? session.id,
            transactionId: session.payment_intent ?? session.id,
            rawData: parsed,
          });

          log.info("Stripe payment completed", {
            sessionId: session.id,
            paymentIntent: session.payment_intent,
          });
        } else {
          log.warn("Stripe checkout session not paid", {
            sessionId: session.id,
            paymentStatus: session.payment_status,
          });
        }
        break;
      }

      case "checkout.session.expired": {
        log.info("Stripe checkout session expired", { sessionId: session.id });
        break;
      }

      case "invoice.paid": {
        // Recurring invoice paid
        log.info("Stripe invoice paid", { invoiceId: session.id });
        break;
      }

      case "invoice.payment_failed": {
        log.warn("Stripe invoice payment failed", { invoiceId: session.id });
        break;
      }

      default:
        log.debug("Stripe unhandled event type", { eventType });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error("Stripe webhook error", { error: String(error) });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/create
 * Creates a new payment session for a user.
 *
 * Body:
 *   planId: string — "pro_monthly" | "pro_yearly" | "lifetime"
 *   providerId: string — "stripe" | "telegram_stars" | "click" | "payme"
 *   successUrl?: string — URL to redirect after successful payment
 *   cancelUrl?: string — URL to redirect if payment is cancelled
 *
 * Response:
 *   sessionId: string — Payment session ID
 *   paymentUrl?: string — URL to redirect user for payment
 *   deepLink?: string — Deep link for mobile apps
 */

import { type NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment/payment-service";
import { logger } from "@/bot/core/logger";

const log = logger.child("api:payments:create");

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { planId, providerId, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    if (!providerId) {
      return NextResponse.json(
        { error: "providerId is required" },
        { status: 400 }
      );
    }

    // Validate payment provider
    const validProviders = ["stripe", "telegram_stars", "click", "payme"];
    if (!validProviders.includes(providerId)) {
      return NextResponse.json(
        { error: `Invalid provider: ${providerId}. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = ["pro_monthly", "pro_yearly", "lifetime"];
    if (!validPlans.includes(planId)) {
      return NextResponse.json(
        { error: `Invalid plan: ${planId}. Must be one of: ${validPlans.join(", ")}` },
        { status: 400 }
      );
    }

    // TODO: Get authenticated user ID from session/auth
    // For now, use a placeholder user ID
    // Replace with real auth once integrated with the auth system
    const userId = 1; // FIXME: Replace with real authenticated user ID
    const telegramUserId = 0; // FIXME: Replace with real Telegram user ID

    const result = await paymentService.createPayment({
      userId,
      telegramUserId,
      planId: planId as any,
      providerId: providerId as any,
      successUrl: successUrl ?? `${request.headers.get("origin") ?? ""}/premium/success?plan=${planId}&provider=${providerId}`,
      cancelUrl: cancelUrl ?? `${request.headers.get("origin") ?? ""}/premium/cancel?plan=${planId}`,
    });

    log.info("Payment created via API", {
      sessionId: result.session.id,
      planId,
      providerId,
    });

    return NextResponse.json({
      sessionId: result.session.id,
      paymentUrl: result.paymentUrl,
      deepLink: result.deepLink,
      status: result.session.status,
    });
  } catch (error) {
    log.error("Payment creation error", { error: String(error) });

    const message = error instanceof Error ? error.message : "Payment creation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

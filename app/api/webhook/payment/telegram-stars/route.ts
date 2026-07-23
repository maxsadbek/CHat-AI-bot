/**
 * Telegram Stars Payment Webhook
 *
 * NOTE: Telegram Stars does NOT use external webhooks for payment callbacks.
 * Payment events arrive as Telegram Bot API updates (message with successful_payment).
 * This route is a placeholder for potential future integration with a payment
 * verification service or for logging purposes.
 *
 * How real Telegram Stars payments work:
 *   1. Bot sendsInvoice() to user with currency="XTR"
 *   2. Telegram shows a native payment popup in the chat
 *   3. User confirms — Telegram sends pre_checkout_query update
 *   4. Bot answers pre_checkout_query (allow/deny)
 *   5. On success — Telegram sends a message with successful_payment
 *   6. Bot handler in bot/handlers/premium.ts processes the successful_payment
 *
 * This webhook route is kept for:
 *   - Logging any external callbacks that might arrive
 *   - Future integration if Telegram adds webhook-based payment notifications
 *   - Consistency with other payment provider webhook patterns
 */

import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/bot/core/logger";

const log = logger.child("webhook:telegram-stars");

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    log.info("Telegram Stars webhook received", { body });

    // Telegram Stars does not use external webhooks.
    // Payment events arrive via Telegram Bot API updates
    // and are handled by the bot's message handlers.
    //
    // The real flow:
    //   1. Bot sends invoice via sendInvoice with Telegram API
    //   2. User pays in Telegram chat UI
    //   3. Bot receives pre_checkout_query (bot.on("pre_checkout_query"))
    //   4. Bot answers with answerPreCheckoutQuery(true)
    //   5. Bot receives message with successful_payment (ctx.message?.successful_payment)
    //   6. Bot handler activates subscription from the payment payload

    log.warn(
      "Telegram Stars external webhook called — this is unexpected. " +
      "Telegram Stars payments are handled via Bot API updates, not webhooks."
    );

    return NextResponse.json({
      received: true,
      note: "Telegram Stars payments are handled via Bot API updates, not external webhooks.",
    });
  } catch (error) {
    log.error("Telegram Stars webhook error", { error: String(error) });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Health check for Telegram Stars payment endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    provider: "telegram_stars",
    note: "Telegram Stars payments use Bot API updates, not external webhooks.",
    documentation: "https://core.telegram.org/bots/api#payments",
  });
}

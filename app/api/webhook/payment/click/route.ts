/**
 * Click Payment Webhook
 * Receives payment callbacks from Click.
 *
 * TODO: Implement real webhook verification:
 *   - Validate Click webhook signature
 *   - Parse click_trans_id, service_id, merchant_trans_id, amount, action
 *   - Sign string: click_trans_id + click_paydoc_id + service_id +
 *     merchant_trans_id + amount + action + secret_key
 *   - Compare with provided sign_string
 *   - On success: update payment status, activate subscription
 */

import { type NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment/payment-service";
import { logger } from "@/bot/core/logger";

const log = logger.child("webhook:click");

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    log.info("Click webhook received", { body });

    // TODO: Validate Click webhook signature
    // const signString = `${body.click_trans_id}${body.click_paydoc_id}${body.service_id}${body.merchant_trans_id}${body.amount}${body.action}${CLICK_SECRET_KEY}`;
    // const expectedSign = crypto.createHash("md5").update(signString).digest("hex");
    // if (body.sign_string !== expectedSign) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    const { click_trans_id, merchant_trans_id, action, error } = body;

    // Click action codes:
    //   0  - Payment completed successfully
    //   1  - Payment cancelled
    //   2  - Payment failed
    //   3  - Payment in progress

    if (action === 0 && !error) {
      // Payment successful
      await paymentService.verifyPayment({
        sessionId: merchant_trans_id ?? "",
        transactionId: click_trans_id,
        rawData: body,
      });
      log.info("Click payment verified successfully", {
        clickTransId: click_trans_id,
        merchantTransId: merchant_trans_id,
      });
    } else {
      log.warn("Click payment not successful", {
        action,
        error,
        clickTransId: click_trans_id,
      });
    }

    // Click expects: { "click_trans_id": ..., "merchant_trans_id": ..., "merchant_prepare_id": ... }
    return NextResponse.json({
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_prepare_id: String(Date.now()),
      error: 0,
      error_note: "Success",
    });
  } catch (error) {
    log.error("Click webhook error", { error: String(error) });
    return NextResponse.json(
      { error: 9, error_note: "Internal server error" },
      { status: 500 }
    );
  }
}

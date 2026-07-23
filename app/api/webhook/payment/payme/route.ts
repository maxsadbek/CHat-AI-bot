/**
 * Payme Payment Webhook
 * Receives JSON-RPC callbacks from Payme.
 *
 * TODO: Implement real webhook verification:
 *   - Validate Authorization header: Base64(HMAC_SHA_256(body, secret_key))
 *   - Parse JSON-RPC method: CheckPerformTransaction, CreateTransaction,
 *     PerformTransaction, CancelTransaction
 *   - Handle each method appropriately
 *   - On PerformTransaction success: update payment, activate subscription
 */

import { type NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/services/payment/payment-service";
import { logger } from "@/bot/core/logger";

const log = logger.child("webhook:payme");

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    log.info("Payme webhook received", { method: body.method, id: body.id });

    // TODO: Validate Payme webhook signature
    // const signature = request.headers.get("Authorization") ?? "";
    // const expectedSign = crypto
    //   .createHmac("sha256", PAYME_SECRET_KEY)
    //   .update(JSON.stringify(body))
    //   .digest("base64");
    // if (signature !== `Bearer ${expectedSign}`) {
    //   return NextResponse.json({ error: { code: -32504, message: "Invalid authorization" } }, { status: 401 });
    // }

    const { method, params, id } = body;

    switch (method) {
      case "CheckPerformTransaction": {
        // Payme asks if this transaction can be performed
        // Return { result: { allow: true } } or { error: { code, message } }
        log.info("Payme CheckPerformTransaction", { params });
        return NextResponse.json({
          id,
          result: { allow: true },
          jsonrpc: "2.0",
        });
      }

      case "CreateTransaction": {
        // Payme creates a transaction
        // TODO: Look up payment by account or params, validate amount
        log.info("Payme CreateTransaction", { params });
        return NextResponse.json({
          id,
          result: {
            create_time: Date.now(),
            transaction: String(params.id ?? Date.now()),
            state: 1, // 1 = created, 2 = completed, -1 = cancelled
          },
          jsonrpc: "2.0",
        });
      }

      case "PerformTransaction": {
        // Finalize the transaction — payment completed
        // TODO: Verify transaction, activate subscription
        log.info("Payme PerformTransaction", { params });

        await paymentService.verifyPayment({
          sessionId: params.account?.payment_id ?? params.id,
          transactionId: params.id,
          rawData: body,
        });

        log.info("Payme payment performed successfully", {
          transactionId: params.id,
        });

        return NextResponse.json({
          id,
          result: {
            transaction: String(params.id),
            perform_time: Date.now(),
            state: 2, // completed
          },
          jsonrpc: "2.0",
        });
      }

      case "CancelTransaction": {
        // Transaction cancelled
        log.info("Payme CancelTransaction", { params });
        return NextResponse.json({
          id,
          result: {
            transaction: String(params.id),
            cancel_time: Date.now(),
            state: -1, // cancelled
          },
          jsonrpc: "2.0",
        });
      }

      case "CheckTransaction": {
        // Check transaction status
        log.info("Payme CheckTransaction", { params });
        return NextResponse.json({
          id,
          result: {
            create_time: Date.now(),
            perform_time: 0,
            cancel_time: 0,
            transaction: String(params.id),
            state: 2,
            reason: null,
          },
          jsonrpc: "2.0",
        });
      }

      default:
        log.warn("Payme unknown method", { method });
        return NextResponse.json({
          id,
          error: { code: -32601, message: "Method not found" },
          jsonrpc: "2.0",
        });
    }
  } catch (error) {
    log.error("Payme webhook error", { error: String(error) });
    return NextResponse.json(
      { id: null, error: { code: -32300, message: "Internal server error" }, jsonrpc: "2.0" },
      { status: 500 }
    );
  }
}

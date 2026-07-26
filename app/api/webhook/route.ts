export const maxDuration = 60;

import { type NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { bot } from "@/bot";
import { safeCompare } from "@/lib/auth";
import type { BotContext } from "@/types";

/**
 * Telegram webhook handler
 * Processes incoming updates from Telegram via webhook
 * Designed for Vercel serverless functions
 *
 * SECURITY: Requires TELEGRAM_WEBHOOK_SECRET env var to be set.
 * The secret_token is sent by Telegram with every webhook request
 * in the X-Telegram-Bot-Api-Secret-Token header.
 * Verification uses timingSafeEqual to prevent timing attacks.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify the request is from Telegram using timing-safe comparison
  // The secret_token is configured via scripts/set-webhook.ts
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error(
      "❌ TELEGRAM_WEBHOOK_SECRET is not configured! " +
      "The webhook endpoint is exposed to everyone. " +
      "Set TELEGRAM_WEBHOOK_SECRET in your environment and re-run scripts/set-webhook.ts"
    );
    return NextResponse.json(
      { error: "Server misconfigured — missing webhook secret" },
      { status: 500 }
    );
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!receivedSecret || !safeCompare(expectedSecret, receivedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const handler = webhookCallback(bot, "std/http", {
      timeoutMilliseconds: 55_000,
      onTimeout: "return",
    });

    const response = await handler(request);

    // grammY returns a Response object
    return response instanceof Response
      ? new NextResponse(response.body, {
          status: response.status,
          headers: response.headers,
        })
      : NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    name: "AI Creator Studio Bot",
    timestamp: new Date().toISOString(),
  });
}

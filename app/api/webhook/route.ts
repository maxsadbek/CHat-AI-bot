import { type NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { bot } from "@/bot";
import type { BotContext } from "@/types";

/**
 * Telegram webhook handler
 * Processes incoming updates from Telegram via webhook
 * Designed for Vercel serverless functions
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify the request is from Telegram
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret && secret !== process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const handler = webhookCallback(bot, "std/http", {
      timeoutMilliseconds: 25_000,
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

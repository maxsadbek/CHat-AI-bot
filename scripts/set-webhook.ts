/**
 * Script to set the Telegram bot webhook
 * Run: npx tsx scripts/set-webhook.ts
 *
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_URL in environment
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

async function setWebhook(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not set");
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error("❌ TELEGRAM_WEBHOOK_URL is not set");
    process.exit(1);
  }

  const url = `${TELEGRAM_API}${token}/setWebhook`;
  const fullWebhookUrl = `${webhookUrl}/api/webhook`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: fullWebhookUrl,
        allowed_updates: [
          "message",
          "callback_query",
          "my_chat_member",
          "chat_member",
        ],
        drop_pending_updates: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log("✅ Webhook set successfully!");
      console.log(`   URL: ${fullWebhookUrl}`);
    } else {
      console.error("❌ Failed to set webhook:", data.description);
    }
  } catch (error) {
    console.error("❌ Error setting webhook:", error);
    process.exit(1);
  }
}

setWebhook();

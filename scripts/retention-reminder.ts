/**
 * Retention Reminder Script
 * ─────────────────────────
 * Sends a friendly "we miss you" message to users who haven't been active
 * for a while, encouraging them to try the bot's AI features again.
 *
 * Run locally:    npm run retention:run
 * Run in prod:    schedule this as a cron / Vercel Cron Job (see below)
 *
 * ─── Env vars (optional, defaults shown) ──────────────
 *   RETENTION_INACTIVE_DAYS=3          # users inactive longer than this get a reminder
 *   RETENTION_REMINDER_INTERVAL_DAYS=7 # min days between reminders to the same user
 *   RETENTION_DRY_RUN=false            # "true" = log only, don't send messages
 *
 * ─── Cron examples ─────────────────────────────────────
 *   Vercel Cron:      add "cron": ["0 9 * * *"] to vercel.json with the script
 *                     wired to an API route, OR run via external cron:
 *   Classic cron:     0 9 * * * cd /path/to/project && npm run retention:run
 *
 * The message is localized (en/uz/ru) using each user's saved language.
 * Blocked users (403) are marked as reminded so they aren't retried every run.
 */

import "dotenv/config";
import { Bot } from "grammy";
import { prisma } from "../lib/prisma";
import { t, resolveLanguage } from "../bot/localization";
import type { SupportedLanguage } from "../bot/localization";

const INACTIVE_DAYS = Number(process.env.RETENTION_INACTIVE_DAYS || 3);
const REMINDER_INTERVAL_DAYS = Number(process.env.RETENTION_REMINDER_INTERVAL_DAYS || 7);
const DRY_RUN = process.env.RETENTION_DRY_RUN === "true";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => !Number.isNaN(n));

const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not set — cannot send reminders");
    process.exit(1);
  }

  if (INACTIVE_DAYS < 1 || REMINDER_INTERVAL_DAYS < 1) {
    console.error("❌ RETENTION_INACTIVE_DAYS and RETENTION_REMINDER_INTERVAL_DAYS must be >= 1");
    process.exit(1);
  }

  const api = new Bot(token).api;
  const inactiveSince = new Date(Date.now() - INACTIVE_DAYS * DAY_MS);
  const minReminderDate = new Date(Date.now() - REMINDER_INTERVAL_DAYS * DAY_MS);

  console.log(
    `[retention] Scanning users inactive since ${inactiveSince.toISOString()} ` +
    `(interval between reminders: ${REMINDER_INTERVAL_DAYS}d, dry run: ${DRY_RUN})`
  );

  const users = await prisma.user.findMany({
    where: {
      lastActiveAt: { lt: inactiveSince },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: minReminderDate } }],
    },
    include: { settings: true },
  });

  // Exclude admins (they don't need marketing reminders)
  const targets = users.filter((u) => !ADMIN_IDS.includes(Number(u.telegramId)));

  console.log(`[retention] Found ${targets.length} user(s) to remind (${users.length} total matched)`);

  let sent = 0;
  let skippedBlocked = 0;
  let failed = 0;

  for (const user of targets) {
    const lang = resolveLanguage(undefined, user.settings?.language ?? null) as SupportedLanguage;
    const chatId = Number(user.telegramId);
    const text = t(lang, "retention.reminder");

    if (DRY_RUN) {
      console.log(`[retention] [DRY] would remind user=${user.id} chat=${chatId} lang=${lang}`);
      continue;
    }

    try {
      await api.sendMessage(chatId, text, { parse_mode: "Markdown" });
      await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: new Date() } });
      sent++;
      console.log(`[retention] reminded user=${user.id} chat=${chatId} lang=${lang}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isBlocked = String(error).includes("403") || (error as { error_code?: number })?.error_code === 403;
      if (isBlocked) {
        // User blocked the bot — no point retrying them on every run
        await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: new Date() } });
        skippedBlocked++;
        console.warn(`[retention] user=${user.id} chat=${chatId} blocked the bot — marked as reminded`);
      } else {
        failed++;
        console.error(`[retention] failed user=${user.id} chat=${chatId}: ${message.slice(0, 200)}`);
      }
    }
  }

  console.log(
    `[retention] Done: sent=${sent} blocked=${skippedBlocked} failed=${failed} totalTargets=${targets.length}`
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[retention] Fatal error:", error);
  process.exit(1);
});

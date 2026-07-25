/**
 * Admin Bot Handler — MVP Admin Panel
 *
 * Only accessible to users with Telegram IDs in ADMIN_IDS env var.
 * Non-admin users see: ❌ Access Denied
 *
 * Menu sections:
 *   📊 Dashboard   👥 Users   💳 Payments   📢 Broadcast   ⚙️ Settings
 *
 * Architecture:
 *   - adminGuard() wraps every handler with isAdmin check
 *   - Broadcast uses ctx.api (not bot import) to avoid circular deps
 *   - All actions logged via logAdminAction
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { logAdminAction } from "@/services/admin/admin-guard";
import { adminGuard } from "@/bot/middleware/admin";
import { adminService } from "@/services/admin";
import { userManagementService } from "@/services/admin/user-management";
import { premiumManagementService } from "@/services/admin/premium-management";
import { paymentService } from "@/services/payment/payment-service";
import { sessionManager } from "@/bot/core/session-manager";
import { logger } from "@/bot/core/logger";
import { addNavRow } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";
import { escapeMarkdownLegacy } from "@/utils/markdown";
import { prisma } from "@/lib/prisma";

const log = logger.child("admin-handler");

// ─── Maintenance Mode (runtime toggle) ─────────────────
(global as any).__MAINTENANCE_MODE = (global as any).__MAINTENANCE_MODE ?? false;
(global as any).__START_TIME = (global as any).__START_TIME ?? Date.now();

export function isMaintenanceMode(): boolean {
  return (global as any).__MAINTENANCE_MODE === true;
}

export function setMaintenanceMode(enabled: boolean): void {
  (global as any).__MAINTENANCE_MODE = enabled;
}

// ══════════════════════════════════════════════════════════
// KEYBOARDS
// ══════════════════════════════════════════════════════════

function mainMenuKb(): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("📊 Dashboard", "admin:dashboard")
      .text("👥 Users", "admin:users")
      .row()
      .text("💳 Payments", "admin:payments")
      .text("📢 Broadcast", "admin:broadcast")
      .row()
      .text("⚙️ Settings", "admin:settings")
  );
}

function userActionsKb(userId: number, isP: boolean, isBanned: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (isP) {
    kb.text("❌ Remove Premium", `admin:user:removepremium:${userId}`);
  } else {
    kb.text("⭐ Give Premium", `admin:user:givepremium:${userId}`);
  }
  if (isBanned) {
    kb.text("✅ Unban", `admin:user:unban:${userId}`);
  } else {
    kb.text("🚫 Ban", `admin:user:ban:${userId}`);
  }
  kb.row();
  kb.text("🔄 Reset Daily", `admin:user:reset:${userId}`);
  kb.row();
  kb.text("🔙 Back", "admin:users");
  return addNavRow(kb);
}

function paymentActionsKb(paymentId: string): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("✅ Approve", `admin:payment:approve:${paymentId}`)
      .text("❌ Reject", `admin:payment:reject:${paymentId}`)
  );
}

function broadcastTypeKb(): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("📝 Text", "admin:broadcast:text")
      .text("🖼️ Photo", "admin:broadcast:photo")
  );
}

function settingsKb(): InlineKeyboard {
  const mm = isMaintenanceMode() ? "🔴 ON" : "🟢 OFF";
  return addNavRow(
    new InlineKeyboard()
      .text(`${mm} Maintenance`, "admin:settings:maintenance")
  );
}

// ══════════════════════════════════════════════════════════
// 1. DASHBOARD
// ══════════════════════════════════════════════════════════

export async function adminHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const uptime = Math.floor((Date.now() - ((global as any).__START_TIME || Date.now())) / 1000);
  const mmStatus = isMaintenanceMode() ? "🔴 ON" : "🟢 OFF";

  await ctx.reply(
    [
      "🛡️ *Admin Panel*",
      "",
      `👤 Admin ID: ${ctx.from!.id}`,
      `⏱️ Uptime: ${uptime}s`,
      `⚙️ Maintenance: ${mmStatus}`,
      "",
      "Select a module:",
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: mainMenuKb() }
  );
}

export async function adminDashboardHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  try {
    const s = await adminService.getStats();
    const revenue = (s.totalRevenue / 100).toFixed(2);
    await ctx.reply(
      [
        "📊 *Dashboard*",
        "",
        `👥 Total Users: ${s.totalUsers}`,
        `🟢 Active Today: ${s.activeUsersToday}`,
        `⭐ Premium: ${s.premiumUsers}`,
        `💬 Total AI Requests: ${s.totalRequests.toLocaleString()}`,
        `💰 Revenue: $${revenue}`,
      ].join("\n"),
      { parse_mode: "Markdown", reply_markup: mainMenuKb() }
    );
  } catch (error) {
    log.error("Dashboard error", { error: String(error) });
    await ctx.reply("❌ Error loading dashboard", { parse_mode: "Markdown", reply_markup: mainMenuKb() });
  }
}

// ══════════════════════════════════════════════════════════
// 2. USERS
// ══════════════════════════════════════════════════════════

export async function adminUsersHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  try {
    const { users, total } = await adminService.getUsers(1, 10);
    const lines = users.map((u, i) => {
      const name = `${u.firstName} ${u.lastName ?? ""}`.trim();
      const tag = u.isPremium ? "⭐" : "🆓";
      return `${i + 1}. ${tag} ${name} — ID: ${u.id}\n   Telegram: ${u.telegramId} · ${formatDate(u.lastActiveAt)}`;
    });

    await ctx.reply(
      [
        `👥 *Users* (${total} total)`,
        "",
        ...lines.slice(0, 10),
        "",
        "To search: /admin search [Telegram ID]",
        "or /admin search @[username]",
      ].join("\n"),
      { parse_mode: "Markdown", reply_markup: mainMenuKb() }
    );
  } catch (error) {
    log.error("Users error", { error: String(error) });
    await ctx.reply("❌ Error fetching users", { parse_mode: "Markdown", reply_markup: mainMenuKb() });
  }
}

export async function adminUserSearchHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const match = ctx.message?.text?.match(/\/admin\s+search\s+(.+)/i);
  const query = match?.[1]?.trim();
  if (!query) {
    await ctx.reply("Usage: /admin search [Telegram ID] or /admin search @[username]", {
      parse_mode: "Markdown",
    });
    return;
  }

  try {
    if (/^\d+$/.test(query)) {
      const user = await userManagementService.getUserByTelegramId(BigInt(Number(query)));
      if (user) return await showUserDetail(ctx, user.id);
    }

    const username = query.replace(/^@/, "");
    const usersResult = await userManagementService.searchUsers(username, 1, 1);
    if (usersResult.users.length > 0) {
      return await showUserDetail(ctx, usersResult.users[0]!.id);
    }

    await ctx.reply("❌ User not found", { parse_mode: "Markdown" });
  } catch (error) {
    log.error("User search error", { query, error: String(error) });
    await ctx.reply("❌ Search failed", { parse_mode: "Markdown" });
  }
}

export async function adminUserDetailHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  await showUserDetail(ctx, userId);
}

async function showUserDetail(ctx: BotContext, userId: number): Promise<void> {
  try {
    const user = await userManagementService.getUserDetail(userId);
    if (!user) {
      await ctx.reply("❌ User not found", { parse_mode: "Markdown" });
      return;
    }

    const name = `${user.firstName} ${user.lastName ?? ""}`.trim();
    const plan = user.subscription?.planType ?? "free";
    const joined = formatDate(user.createdAt);
    const lastActive = formatDate(user.lastActiveAt);
    const lang = user.settings?.language ?? user.languageCode ?? "—";
    const isBanned = user.dailyLimit === 0;

    await ctx.reply(
      [
        `👤 *${name}*`,
        "",
        `Telegram ID: ${user.telegramId}`,
        `Username: ${user.username ?? "—"}`,
        `Language: ${lang}`,
        `Plan: ${plan}`,
        `Joined: ${joined}`,
        `Last: ${lastActive}`,
        `Daily: ${user.requestsToday} / ${user.dailyLimit}`,
        isBanned ? "🚫 *BANNED*" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      {
        parse_mode: "Markdown",
        reply_markup: userActionsKb(user.id, user.isPremium, isBanned),
      }
    );
  } catch (error) {
    log.error("User detail error", { userId, error: String(error) });
    await ctx.reply("❌ Error loading user", { parse_mode: "Markdown" });
  }
}

export async function adminUserGivePremiumHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await premiumManagementService.grantPremium(userId, "pro_monthly", ctx.from!.id);
    await ctx.reply("✅ *Premium granted!*", { parse_mode: "Markdown" });
    await showUserDetail(ctx, userId);
  } catch (error) {
    log.error("Give premium error", { userId, error: String(error) });
    await ctx.reply("❌ Error granting premium", { parse_mode: "Markdown" });
  }
}

export async function adminUserRemovePremiumHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await premiumManagementService.revokePremium(userId, ctx.from!.id);
    await ctx.reply("✅ *Premium removed!*", { parse_mode: "Markdown" });
    await showUserDetail(ctx, userId);
  } catch (error) {
    log.error("Remove premium error", { userId, error: String(error) });
    await ctx.reply("❌ Error removing premium", { parse_mode: "Markdown" });
  }
}

export async function adminUserBanHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await userManagementService.banUser(userId, ctx.from!.id);
    await ctx.reply("🚫 *User banned!*", { parse_mode: "Markdown" });
    await showUserDetail(ctx, userId);
  } catch (error) {
    log.error("Ban user error", { userId, error: String(error) });
    await ctx.reply("❌ Error banning user", { parse_mode: "Markdown" });
  }
}

export async function adminUserUnbanHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await userManagementService.unbanUser(userId, ctx.from!.id);
    await ctx.reply("✅ *User unbanned!*", { parse_mode: "Markdown" });
    await showUserDetail(ctx, userId);
  } catch (error) {
    log.error("Unban user error", { userId, error: String(error) });
    await ctx.reply("❌ Error unbanning user", { parse_mode: "Markdown" });
  }
}

export async function adminUserResetHandler(ctx: BotContext, userId: number): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await userManagementService.resetUserDaily(userId, ctx.from!.id);
    await ctx.reply("✅ *Daily counter reset!*", { parse_mode: "Markdown" });
    await showUserDetail(ctx, userId);
  } catch (error) {
    log.error("Reset daily error", { userId, error: String(error) });
    await ctx.reply("❌ Error resetting daily counter", { parse_mode: "Markdown" });
  }
}

// ══════════════════════════════════════════════════════════
// 3. PAYMENTS
// ══════════════════════════════════════════════════════════

export async function adminPaymentsHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  try {
    // Batch all Prisma queries in parallel
    const [pendingCount, approvedCount, rejectedCount, revenueResult, pendingPayments] =
      await Promise.all([
        prisma.payment.count({ where: { status: "PENDING" } }),
        prisma.payment.count({ where: { status: "SUCCESS" } }),
        prisma.payment.count({ where: { status: "FAILED" } }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: "SUCCESS" },
        }),
        prisma.payment.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { firstName: true, username: true } } },
        }),
      ]);

    const revenue = (revenueResult._sum.amount ?? 0) / 100;

    const text = [
      "💳 *Payments Overview*",
      "",
      `⏳ Pending: ${pendingCount.toLocaleString()}`,
      `✅ Approved: ${approvedCount.toLocaleString()}`,
      `❌ Rejected: ${rejectedCount.toLocaleString()}`,
      `💰 Revenue: $${revenue.toFixed(2)}`,
      "",
      pendingPayments.length > 0 ? "*Recent Pending:*" : "*No pending payments*",
      ...      pendingPayments.map((p, i) => {
        const rawUserName = p.user ? `${p.user.firstName} ${p.user.username ?? ""}`.trim() : `User #${p.userId}`;
        const userName = escapeMarkdownLegacy(rawUserName);
        const safePlan = escapeMarkdownLegacy(p.plan);
        return `${i + 1}. ${userName} — ${safePlan} (${p.provider})\n   ID: ${p.id.slice(0, 8)}... · ${formatDate(p.createdAt)}`;
      }),
    ].join("\n");

    const kb = new InlineKeyboard();
    pendingPayments.slice(0, 3).forEach((p) => {
      const short = p.id.slice(0, 8);
      kb.text(`💳 ${short}...`, `admin:payment:detail:${p.id}`);
      kb.row();
    });

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: pendingPayments.length > 0 ? addNavRow(kb) : mainMenuKb(),
    });
  } catch (error) {
    log.error("Payments error", { error: String(error) });
    await ctx.reply("❌ Error loading payments", { parse_mode: "Markdown", reply_markup: mainMenuKb() });
  }
}

export async function adminPaymentDetailHandler(ctx: BotContext, paymentId: string): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  try {
    const payment = await paymentService.getPayment(paymentId);
    if (!payment) {
      await ctx.reply("❌ Payment not found", { parse_mode: "Markdown" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: { firstName: true, username: true },
    });
    const rawUserName = user ? `${user.firstName} ${user.username ?? ""}`.trim() : `User #${payment.userId}`;
    const userName = escapeMarkdownLegacy(rawUserName);
    const safePlan = escapeMarkdownLegacy(payment.plan);

    await ctx.reply(
      [
        "💳 *Payment Detail*",
        "",
        `👤 User: ${userName}`,
        `🆔 User ID: ${payment.userId}`,
        `📋 Plan: ${safePlan}`,
        `💳 Method: ${payment.provider}`,
        `💰 Amount: $${(payment.amount / 100).toFixed(2)}`,
        `📌 Status: *${payment.status}*`,
        `📅 Date: ${formatDate(payment.createdAt)}`,
        payment.paidAt ? `✅ Paid at: ${formatDate(payment.paidAt)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      {
        parse_mode: "Markdown",
        reply_markup: payment.status === "PENDING" ? paymentActionsKb(paymentId) : mainMenuKb(),
      }
    );
  } catch (error) {
    log.error("Payment detail error", { paymentId, error: String(error) });
    await ctx.reply("❌ Error loading payment", { parse_mode: "Markdown" });
  }
}

export async function adminPaymentApproveHandler(ctx: BotContext, paymentId: string): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await paymentService.verifyPayment({ sessionId: paymentId });
    await ctx.reply("✅ *Payment approved! Premium activated.*", { parse_mode: "Markdown" });
    await adminPaymentDetailHandler(ctx, paymentId);
  } catch (error) {
    log.error("Payment approve error", { paymentId, error: String(error) });
    await ctx.reply("❌ Error approving payment", { parse_mode: "Markdown" });
  }
}

export async function adminPaymentRejectHandler(ctx: BotContext, paymentId: string): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  try {
    await paymentService.cancelPayment(paymentId);
    await ctx.reply("❌ *Payment rejected.*", { parse_mode: "Markdown" });
    await adminPaymentDetailHandler(ctx, paymentId);
  } catch (error) {
    log.error("Payment reject error", { paymentId, error: String(error) });
    await ctx.reply("❌ Error rejecting payment", { parse_mode: "Markdown" });
  }
}

// ══════════════════════════════════════════════════════════
// 4. BROADCAST — uses ctx.api (no bot import to avoid circular deps)
// ══════════════════════════════════════════════════════════

export async function adminBroadcastHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  await ctx.reply(
    ["📢 *Broadcast*", "", "Choose broadcast type:"].join("\n"),
    { parse_mode: "Markdown", reply_markup: broadcastTypeKb() }
  );
}

export async function adminBroadcastTextHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  sessionManager.setTempData(ctx.session, "adminMode", "broadcast_text");
  await ctx.reply("📝 *Send the text message to broadcast:*\n\nIt will be sent to all registered users.", {
    parse_mode: "Markdown",
  });
}

export async function adminBroadcastPhotoHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;
  sessionManager.setTempData(ctx.session, "adminMode", "broadcast_photo");
  await ctx.reply("🖼️ *Send the photo with caption to broadcast:*\n\nIt will be sent to all registered users.", {
    parse_mode: "Markdown",
  });
}

export async function adminBroadcastSendTextHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const text = ctx.message?.text;
  if (!text) return;

  let sent = 0;
  let failed = 0;

  try {
    const users = await prisma.user.findMany({ select: { telegramId: true } });

    for (const u of users) {
      try {
        await ctx.api.sendMessage(Number(u.telegramId), text, {
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
        });
        sent++;
      } catch {
        failed++;
      }
      if (sent % 20 === 0) await new Promise((r) => setTimeout(r, 1000));
    }

    await logAdminAction(ctx.from!.id, "broadcast_text", `Sent to ${sent}, failed ${failed}`);
    await ctx.reply(
      `✅ *Broadcast complete!*\n\n📨 Sent: ${sent}\n❌ Failed: ${failed}\n👥 Total: ${users.length}`,
      { parse_mode: "Markdown", reply_markup: mainMenuKb() }
    );
  } catch (error) {
    log.error("Broadcast error", { error: String(error) });
    await ctx.reply("❌ Error sending broadcast", { parse_mode: "Markdown", reply_markup: mainMenuKb() });
  }

  sessionManager.clearTempData(ctx.session);
}

export async function adminBroadcastSendPhotoHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const photo = ctx.message?.photo;
  const caption = ctx.message?.caption ?? "";
  if (!photo || photo.length === 0) {
    await ctx.reply("❌ Please send a photo.", { parse_mode: "Markdown" });
    return;
  }

  const fileId = photo[photo.length - 1]!.file_id;
  let sent = 0;
  let failed = 0;

  try {
    const users = await prisma.user.findMany({ select: { telegramId: true } });

    for (const u of users) {
      try {
        await ctx.api.sendPhoto(Number(u.telegramId), fileId, {
          caption: caption || undefined,
          parse_mode: "Markdown",
        });
        sent++;
      } catch {
        failed++;
      }
      if (sent % 20 === 0) await new Promise((r) => setTimeout(r, 1000));
    }

    await logAdminAction(ctx.from!.id, "broadcast_photo", `Sent to ${sent}, failed ${failed}`);
    await ctx.reply(
      `✅ *Photo broadcast complete!*\n\n📨 Sent: ${sent}\n❌ Failed: ${failed}\n👥 Total: ${users.length}`,
      { parse_mode: "Markdown", reply_markup: mainMenuKb() }
    );
  } catch (error) {
    log.error("Photo broadcast error", { error: String(error) });
    await ctx.reply("❌ Error sending photo broadcast", { parse_mode: "Markdown", reply_markup: mainMenuKb() });
  }

  sessionManager.clearTempData(ctx.session);
}

// ══════════════════════════════════════════════════════════
// 5. SETTINGS — Maintenance Mode
// ══════════════════════════════════════════════════════════

export async function adminSettingsHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const mm = isMaintenanceMode() ? "🔴 *ON*" : "🟢 *OFF*";
  await ctx.reply(
    [
      "⚙️ *Admin Settings*",
      "",
      `🟢 Maintenance Mode: ${mm}`,
      "",
      "When enabled, normal users cannot use AI features.",
      "They will see: 🚧 The bot is under maintenance.",
      "Admins still have full access.",
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: settingsKb() }
  );
}

export async function adminSettingsMaintenanceHandler(ctx: BotContext): Promise<void> {
  if (!(await adminGuard(ctx))) return;

  const newState = !isMaintenanceMode();
  setMaintenanceMode(newState);

  await logAdminAction(ctx.from!.id, "maintenance", `Maintenance mode: ${newState ? "ON" : "OFF"}`);

  await ctx.reply(
    newState
      ? "🔴 *Maintenance mode ENABLED*\n\nNormal users cannot access AI features."
      : "🟢 *Maintenance mode DISABLED*\n\nAll users can access AI features.",
    { parse_mode: "Markdown" }
  );

  await adminSettingsHandler(ctx);
}

/**
 * Admin Bot Handler
 * Telegram-based admin panel for managing the platform.
 * Only accessible to users with ADMIN_IDS.
 *
 * Commands:
 *   /admin — Open admin panel
 *   /admin users — List/search users
 *   /admin premium — Premium management
 *   /admin stats — Quick statistics
 *   /admin health — System health
 *   /admin broadcast — Broadcast a message
 */

import { InlineKeyboard } from "grammy";
import type { BotContext } from "@/types";
import { BotStep } from "@/types";
import { isAdmin } from "@/services/admin/admin-guard";
import { logAdminAction } from "@/services/admin/admin-guard";
import { userManagementService } from "@/services/admin/user-management";
import { premiumManagementService } from "@/services/admin/premium-management";
import { systemHealthService } from "@/services/admin/health";
import { analyticsService } from "@/services/analytics";
import { adminService } from "@/services/admin";
import { sessionManager } from "@/bot/core/session-manager";
import { t } from "@/bot/localization";
import { logger } from "@/bot/core/logger";
import { addNavRow } from "@/bot/keyboards";
import { formatDate } from "@/utils/helpers";

// Track process start time for uptime calculation
(global as any).__START_TIME = (global as any).__START_TIME ?? Date.now();

const log = logger.child("admin-handler");

// ═══════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════

function adminMainKeyboard(): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("👥 Users", "admin:users")
      .text("⭐ Premium", "admin:premium")
      .row()
      .text("📊 Stats", "admin:stats")
      .text("📋 Analytics", "admin:analytics")
      .row()
      .text("📢 Broadcast", "admin:broadcast")
      .text("❤️ Health", "admin:health")
      .row()
      .text("📜 Logs", "admin:logs")
  );
}

function adminUserActionsKeyboard(userId: number): InlineKeyboard {
  return addNavRow(
    new InlineKeyboard()
      .text("⭐ Toggle Premium", `admin:user:premium:${userId}`)
      .text("🔄 Reset Daily", `admin:user:reset:${userId}`)
      .row()
      .text("🔙 Back to Users", "admin:users")
  );
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Main admin panel
 */
export async function adminHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) {
    await ctx.reply("⛔ *Access Denied*", { parse_mode: "Markdown" });
    return;
  }

  const uptime = Math.floor((Date.now() - ((global as any).__START_TIME || Date.now())) / 1000);
  const text = [
    "🛡️ *Admin Panel*",
    "",
    `👤 Admin ID: \`${telegramId}\``,
    `⏱️ Uptime: ${uptime}s`,
    "",
    "Select a module:",
  ].join("\n");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: adminMainKeyboard(),
  });
}

/**
 * User management — list/search users
 */
export async function adminUsersHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const { users, total } = await adminService.getUsers(1, 10);
    const lines = users.map((u, i) => {
      const name = `${u.firstName} ${u.lastName ?? ""}`.trim();
      const premium = u.isPremium ? "⭐" : "🆓";
      return `${i + 1}. ${premium} *${name}* — 🆔 \`${u.id}\`\n   📝 ${u._count.messages} msgs · 🕐 ${formatDate(u.lastActiveAt)}`;
    });

    const text = [
      `👥 *Users* (${total} total)`,
      "",
      ...lines.slice(0, 10),
      "",
      "To search: Send a username or name",
    ].join("\n");

    const kb = addNavRow(new InlineKeyboard());
    users.slice(0, 10).forEach((u) => {
      kb.text(`👤 ${u.firstName.slice(0, 15)}`, `admin:user:detail:${u.id}`);
      kb.row();
    });

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } catch (error) {
    log.error("Admin users error", { error: String(error) });
    await ctx.reply("❌ Error fetching users", { parse_mode: "Markdown" });
  }
}

/**
 * User detail view
 */
export async function adminUserDetailHandler(ctx: BotContext, userId: number): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const user = await userManagementService.getUserDetail(userId);
    if (!user) {
      await ctx.reply("❌ User not found", { parse_mode: "Markdown" });
      return;
    }

    const plan = user.subscription?.planType ?? "free";
    const planEmoji = user.isPremium ? "⭐" : "🆓";
    const name = `${user.firstName} ${user.lastName ?? ""}`.trim();
    const date = formatDate(user.createdAt);
    const lastActive = formatDate(user.lastActiveAt);

    const text = [
      `👤 *${name}*`,
      "",
      `🆔 ID: \`${user.id}\``,
      `📱 Telegram: \`${user.telegramId}\``,
      `🌐 Username: ${user.username ?? "—"}`,
      `🌍 Lang: ${user.languageCode ?? "—"}`,
      "",
      `${planEmoji} *Plan:* ${plan}`,
      `📊 Daily: ${user.requestsToday} / ${user.dailyLimit}`,
      `📈 Total: ${user.totalRequests} requests`,
      "",
      `💬 ${user._count.conversations} conversations`,
      `📝 ${user._count.messages} messages`,
      `📊 ${user._count.usage} usage events`,
      `📁 ${user._count.projects} projects`,
      "",
      `📅 Joined: ${date}`,
      `🕐 Last active: ${lastActive}`,
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: adminUserActionsKeyboard(user.id),
    });
  } catch (error) {
    log.error("Admin user detail error", { userId, error: String(error) });
    await ctx.reply("❌ Error fetching user details", { parse_mode: "Markdown" });
  }
}

/**
 * Toggle user premium
 */
export async function adminUserPremiumHandler(ctx: BotContext, userId: number): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    await userManagementService.togglePremium(userId, telegramId);
    await ctx.reply("✅ Premium toggled!", { parse_mode: "Markdown" });
    await adminUserDetailHandler(ctx, userId);
  } catch (error) {
    log.error("Admin toggle premium error", { userId, error: String(error) });
    await ctx.reply("❌ Error toggling premium", { parse_mode: "Markdown" });
  }
}

/**
 * Reset user daily counter
 */
export async function adminUserResetHandler(ctx: BotContext, userId: number): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    await userManagementService.resetUserDaily(userId, telegramId);
    await ctx.reply("✅ Daily counter reset!", { parse_mode: "Markdown" });
    await adminUserDetailHandler(ctx, userId);
  } catch (error) {
    log.error("Admin reset daily error", { userId, error: String(error) });
    await ctx.reply("❌ Error resetting daily counter", { parse_mode: "Markdown" });
  }
}

/**
 * Premium management overview
 */
export async function adminPremiumHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const stats = await premiumManagementService.getPremiumStats();
    const text = [
      "⭐ *Premium Management*",
      "",
      `Total premium: ${stats.totalPremium}`,
      "",
      "*By Plan:*",
      ...stats.byPlan.map((p) => `  • ${p.plan}: ${p.count}`),
      "",
      "*By Billing:*",
      ...stats.byBilling.map((b) => `  • ${b.period}: ${b.count}`),
      "",
      `Paid subscriptions: ${stats.paidSubscriptions}`,
    ].join("\n");

    const kb = addNavRow(
      new InlineKeyboard()
        .text("📋 Premium Users", "admin:premium:users")
    );

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } catch (error) {
    log.error("Admin premium error", { error: String(error) });
    await ctx.reply("❌ Error fetching premium stats", { parse_mode: "Markdown" });
  }
}

/**
 * Premium users list
 */
export async function adminPremiumUsersHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const { users, total } = await premiumManagementService.getPremiumUsers(1, 10);
    const lines = users.map((u, i) => {
      const name = `${u.firstName} ${u.lastName ?? ""}`.trim();
      const plan = u.subscription?.planType ?? "free";
      const expiry = u.subscription?.expiresAt
        ? `exp: ${formatDate(u.subscription.expiresAt)}`
        : "no expiry";
      return `${i + 1}. *${name}* — ${plan} (${expiry})`;
    });

    const text = [
      `⭐ *Premium Users* (${total} total)`,
      "",
      ...(lines.length > 0 ? lines : ["No premium users found."]),
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: addNavRow(new InlineKeyboard()),
    });
  } catch (error) {
    log.error("Admin premium users error", { error: String(error) });
    await ctx.reply("❌ Error fetching premium users", { parse_mode: "Markdown" });
  }
}

/**
 * Quick statistics
 */
export async function adminStatsHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const stats = await adminService.getStats();
    const text = [
      "📊 *Quick Statistics*",
      "",
      `👥 Total users: ${stats.totalUsers}`,
      `🟢 Active today: ${stats.activeUsersToday}`,
      `⭐ Premium: ${stats.premiumUsers}`,
      "",
      `📝 Total messages: ${stats.totalRequests}`,
      `📊 Today: ${stats.requestsToday}`,
      "",
      "*Top Features Today:*",
      stats.topFeatures.length > 0
        ? stats.topFeatures.map((f) => `  • ${f.feature}: ${f.count}`).join("\n")
        : "  • No data yet",
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: adminMainKeyboard(),
    });
  } catch (error) {
    log.error("Admin stats error", { error: String(error) });
    await ctx.reply("❌ Error fetching stats", { parse_mode: "Markdown" });
  }
}

/**
 * Analytics overview
 */
export async function adminAnalyticsHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const overview = await analyticsService.getOverview();
    const text = [
      "📋 *Analytics Dashboard*",
      "",
      "*Users:*",
      `  Total: ${overview.users.total}`,
      `  Active today: ${overview.users.activeToday}`,
      `  Active (7d): ${overview.users.activeThisWeek}`,
      `  New today: ${overview.users.newToday}`,
      "",
      "*Usage:*",
      `  Total: ${overview.usage.total}`,
      `  Today: ${overview.usage.today}`,
      `  This week: ${overview.usage.thisWeek}`,
      `  This month: ${overview.usage.thisMonth}`,
      "",
      "*Features Today:*",
      `  💬 Messages: ${overview.features.messagesToday}`,
      `  🎨 Images: ${overview.features.imagesToday}`,
      `  🎬 Videos: ${overview.features.videosToday}`,
      "",
      "*Premium:*",
      `  Total: ${overview.premium.totalPremium}`,
      `  Conversion: ${(overview.conversion.rate * 100).toFixed(1)}%`,
      "",
      "*Tokens:*",
      `  In: ${overview.tokens.tokensIn.toLocaleString()}`,
      `  Out: ${overview.tokens.tokensOut.toLocaleString()}`,
      "",
      `📅 Generated: ${formatDate(new Date(overview.generatedAt))}`,
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: adminMainKeyboard(),
    });
  } catch (error) {
    log.error("Admin analytics error", { error: String(error) });
    await ctx.reply("❌ Error fetching analytics", { parse_mode: "Markdown" });
  }
}

/**
 * Broadcast message
 */
export async function adminBroadcastHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  const text = [
    "📢 *Broadcast Message*",
    "",
    "Send the message you want to broadcast to all users.",
    "",
    "The message will be sent to every registered user via their last active conversation.",
  ].join("\n");

  sessionManager.setTempData(ctx.session, "adminMode", "broadcast");
  await ctx.reply(text, {
    parse_mode: "Markdown",
  });
}

/**
 * Handle broadcast message text
 */
export async function adminBroadcastSendHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  const text = ctx.message?.text;
  if (!telegramId || !isAdmin(telegramId) || !text) return;

  try {
    const count = await adminService.broadcast(text);
    await logAdminAction(telegramId, "broadcast", `Broadcast to ${count} users: ${text.slice(0, 100)}`);

    await ctx.reply(`✅ *Broadcast sent!*\\n\\nReached ${count} users.`, {
      parse_mode: "Markdown",
      reply_markup: adminMainKeyboard(),
    });
  } catch (error) {
    log.error("Admin broadcast error", { error: String(error) });
    await ctx.reply("❌ Error sending broadcast", { parse_mode: "Markdown" });
  }

  sessionManager.clearTempData(ctx.session);
}

/**
 * System health
 */
export async function adminHealthHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const health = await systemHealthService.getFullHealth();
    const emoji = health.status === "healthy" ? "✅" : health.status === "degraded" ? "⚠️" : "❌";

    const checks = Object.entries(health.checks).map(([key, check]) => {
      const icon = check.status === "healthy" ? "✅" : check.status === "degraded" ? "⚠️" : "❌";
      return `${icon} *${key}*: ${check.message}`;
    });

    const text = [
      `${emoji} *System Health* — ${health.status.toUpperCase()}`,
      "",
      `⏱️ Uptime: ${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`,
      `📅 Generated: ${formatDate(new Date(health.timestamp))}`,
      "",
      ...checks,
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: adminMainKeyboard(),
    });
  } catch (error) {
    log.error("Admin health error", { error: String(error) });
    await ctx.reply("❌ Error checking system health", { parse_mode: "Markdown" });
  }
}

/**
 * Admin logs
 */
export async function adminLogsHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) return;

  try {
    const logs = await adminService.getLogs(1, 10);
    const lines = logs.map(
      (l) => `• *${l.action}* — 🕐 ${formatDate(l.createdAt)}\\n   ${l.details.slice(0, 100)}`
    );

    const text = [
      "📜 *Recent Admin Actions*",
      "",
      ...(lines.length > 0 ? lines : ["No actions logged yet."]),
    ].join("\n");

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: adminMainKeyboard(),
    });
  } catch (error) {
    log.error("Admin logs error", { error: String(error) });
    await ctx.reply("❌ Error fetching logs", { parse_mode: "Markdown" });
  }
}

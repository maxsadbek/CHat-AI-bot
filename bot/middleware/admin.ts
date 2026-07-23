/**
 * AdminMiddleware
 *
 * Explicit middleware module for admin access control.
 * Every admin action must verify ADMIN_IDS before proceeding.
 *
 * Usage:
 *   import { adminGuard } from "@/bot/middleware/admin";
 *
 *   if (!(await adminGuard(ctx))) return;
 */

import type { BotContext } from "@/types";
import { isAdmin } from "@/services/admin/admin-guard";

/**
 * Programmatic admin guard for use inside handlers.
 * Returns true if user is admin, false otherwise.
 * If not admin, replies with "❌ Access Denied".
 */
export async function adminGuard(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) {
    await ctx.reply("❌ *Access Denied*", { parse_mode: "Markdown" });
    return false;
  }
  return true;
}

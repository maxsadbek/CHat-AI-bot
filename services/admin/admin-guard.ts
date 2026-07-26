/**
 * Admin Guard
 * Central permission checker and middleware for admin operations.
 * Used by both API routes and bot handlers to verify admin access.
 */

import { env } from "@/config";
import { prisma } from "@/lib/prisma";
import { verifyAdminSecret } from "@/lib/auth";
import { logger } from "@/bot/core/logger";
import type { BotContext } from "@/types";

const log = logger.child("admin-guard");

export function isAdmin(
  telegramId: number | bigint | string | null | undefined
): boolean {
  if (telegramId === null || telegramId === undefined) return false;
  const numId = typeof telegramId === "number" ? telegramId : Number(telegramId);
  if (isNaN(numId)) return false;
  return env.ADMIN_IDS.includes(numId);
}

/**
 * Verify API request authorization header
 * Returns the admin Telegram ID if valid, or null if unauthorized.
 *
 * Uses timing-safe comparison via verifyAdminSecret() for Bearer token auth.
 */
export function verifyApiAuth(authHeader: string | null): number | null {
  if (!authHeader) return null;

  // Support both Bearer token (for secret-based auth) and direct admin ID
  if (verifyAdminSecret(authHeader, env.ADMIN_SECRET)) {
    return 0; // system admin
  }

  // Check if the auth header is a direct admin Telegram ID
  const adminId = parseInt(authHeader.replace("Bearer ", ""), 10);
  if (isAdmin(adminId)) {
    return adminId;
  }

  return null;
}

/**
 * Bot middleware to check if the user is an admin
 * Call before any admin-only command.
 */
export async function requireAdmin(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !isAdmin(telegramId)) {
    await ctx.reply("⛔ *Access Denied*\\n\\nYou do not have permission to use this command.", {
      parse_mode: "Markdown",
    });
    return false;
  }
  await next();
  return true;
}

/**
 * Get list of admin user IDs (for display/logging)
 */
export function getAdminIds(): number[] {
  return [...env.ADMIN_IDS];
}

/**
 * Log admin action to the database
 */
export async function logAdminAction(
  adminId: number,
  action: string,
  details: string = ""
): Promise<void> {
  try {
    await prisma.adminLog.create({
      data: {
        adminId: BigInt(adminId),
        action,
        details,
      },
    });
    log.info(`Admin action: ${action}`, { adminId, details });
  } catch (error) {
    log.error("Failed to log admin action", { adminId, action, error: String(error) });
  }
}

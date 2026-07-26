/**
 * Authentication Helpers
 *
 * Provides timing-safe comparison utilities for admin API secret verification.
 * All admin API routes MUST use `verifyAdminSecret()` instead of direct
 * string comparison to prevent timing attacks.
 *
 * Usage:
 *   import { verifyAdminSecret } from "@/lib/auth";
 *   const authHeader = request.headers.get("authorization");
 *   if (!verifyAdminSecret(authHeader)) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */

import { timingSafeEqual } from "crypto";

/**
 * Weak/default ADMIN_SECRET values that must be rejected in production.
 * These are known-bad defaults that could be guessed by attackers.
 */
const WEAK_SECRETS = new Set([
  "admin-secret",
  "changeme",
  "secret",
  "password",
  "admin",
  "changeme123",
  "secret123",
  "admin123",
]);

/**
 * Timing-safe comparison of two strings.
 *
 * Uses Node.js `crypto.timingSafeEqual` to prevent timing side-channel
 * attacks. If the lengths differ, returns `false` immediately (no
 * crypto call needed) since differing lengths cannot match.
 */
export function safeCompare(actual: string, provided: string): boolean {
  if (actual.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual), Buffer.from(provided));
}

/**
 * Verify the `Authorization` header against `ADMIN_SECRET`.
 *
 * Accepts both:
 *   - `Authorization: Bearer <secret>` (standard Bearer token)
 *   - `Authorization: <secret>` (raw secret for backward compatibility)
 *
 * Returns `true` if the secret matches the configured `ADMIN_SECRET`.
 */
export function verifyAdminSecret(
  authHeader: string | null,
  adminSecret: string | undefined
): boolean {
  if (!authHeader || !adminSecret) {
    return false;
  }

  // Strip "Bearer " prefix if present
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return safeCompare(adminSecret, token);
}

/**
 * Validate that the ADMIN_SECRET environment variable is not weak or too short.
 *
 * Call this at application startup (in the bot initialization or config loading).
 * In production, exits the process with a clear error if the secret is insecure.
 *
 * Returns `true` if the secret passes validation.
 */
export function validateAdminSecret(
  adminSecret: string,
  isProduction: boolean
): boolean {
  if (!adminSecret || adminSecret.length < 24) {
    console.error(
      "❌ ADMIN_SECRET is too short or not set. " +
        "It must be at least 24 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    if (isProduction) {
      process.exit(1);
    }
    return false;
  }

  if (WEAK_SECRETS.has(adminSecret.toLowerCase())) {
    console.error(
      `❌ ADMIN_SECRET is set to a known weak value ("${adminSecret}"). ` +
        "This is a security risk. " +
        "Generate a random secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    if (isProduction) {
      process.exit(1);
    }
    return false;
  }

  return true;
}

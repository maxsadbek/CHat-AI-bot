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
 * Weak/default ADMIN_SECRET values that must be rejected.
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

let _weakSecretWarningShown = false;

/**
 * Check ADMIN_SECRET strength and log a warning ONCE if it's missing/weak.
 * Never calls process.exit — just logs and returns false.
 * Uses module-level flag so warning only appears once per server instance.
 */
function warnIfWeakAdminSecret(adminSecret: string | undefined): void {
  if (_weakSecretWarningShown) return;

  if (!adminSecret) {
    console.error(
      "❌ ADMIN_SECRET is not set. Admin API endpoints will reject all requests. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    _weakSecretWarningShown = true;
  } else if (adminSecret.length < 24) {
    console.error(
      `❌ ADMIN_SECRET is too short (${adminSecret.length} chars). ` +
      `It must be at least 24 characters. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
    _weakSecretWarningShown = true;
  } else if (WEAK_SECRETS.has(adminSecret.toLowerCase())) {
    console.error(
      `❌ ADMIN_SECRET is set to a known weak value ("${adminSecret}"). ` +
      "This is a security risk. " +
      "Generate a random secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    _weakSecretWarningShown = true;
  }
}

/**
 * Verify the `Authorization` header against `ADMIN_SECRET`.
 *
 * Accepts both:
 *   - `Authorization: Bearer <secret>` (standard Bearer token)
 *   - `Authorization: <secret>` (raw secret for backward compatibility)
 *
 * Also logs a warning if the configured ADMIN_SECRET is weak or too short
 * (runs once per server instance via the weak set check).
 *
 * Returns `true` if the secret matches the configured `ADMIN_SECRET`.
 */
export function verifyAdminSecret(
  authHeader: string | null,
  adminSecret: string | undefined
): boolean {
  if (!authHeader || !adminSecret) {
    // Log warning once when secret is missing/bad
    warnIfWeakAdminSecret(adminSecret);
    return false;
  }

  // Strip "Bearer " prefix if present
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Also log warning if the stored ADMIN_SECRET is weak (for visibility)
  warnIfWeakAdminSecret(adminSecret);

  return safeCompare(adminSecret, token);
}

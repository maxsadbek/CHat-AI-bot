/**
 * Authentication Helpers
 *
 * Provides session-based admin authentication using httpOnly cookies.
 * All admin API routes should use `verifyAdminSession(request)` instead of
 * the old Bearer token approach.
 *
 * Flow:
 *   1. Admin visits /admin/login and submits password
 *   2. POST /api/admin/login verifies password, sets `admin_session` cookie
 *   3. Next.js middleware redirects /admin/* to /admin/login if no cookie
 *   4. API routes verify the cookie via verifyAdminSession()
 *   5. POST /api/admin/logout clears the cookie
 *
 * Cookie:
 *   - Name: admin_session
 *   - Value: timestamp.HMAC-SHA256(admin_secret, "admin_session:" + timestamp)
 *   - httpOnly, secure, sameSite=strict
 *   - Expires: 12 hours
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

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

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

let _weakSecretWarningShown = false;

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
 * DEPRECATED: Use verifyAdminSession() instead.
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
    warnIfWeakAdminSecret(adminSecret);
    return false;
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  warnIfWeakAdminSecret(adminSecret);

  return safeCompare(adminSecret, token);
}

// ─── Session Token Helpers ──────────────────────────────────────────

/**
 * Sign a new admin session token (HMAC-SHA256).
 * Returns: `${timestamp}.${hex_signature}`
 */
export function signAdminToken(adminSecret: string): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac("sha256", adminSecret)
    .update(`admin_session:${timestamp}`)
    .digest("hex");
  return `${timestamp}.${hmac}`;
}

/**
 * Verify an admin session token.
 * Checks HMAC signature and 12-hour expiry.
 */
export function verifyAdminToken(
  token: string,
  adminSecret: string
): boolean {
  if (!token || !adminSecret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  if (!timestampStr || !signature) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  if (Date.now() - timestamp > SESSION_DURATION_MS) return false;

  const expectedHmac = createHmac("sha256", adminSecret)
    .update(`admin_session:${timestampStr}`)
    .digest("hex");

  if (expectedHmac.length !== signature.length) return false;
  return timingSafeEqual(
    Buffer.from(expectedHmac),
    Buffer.from(signature)
  );
}

/**
 * Extract and verify the admin_session cookie from a NextRequest.
 * Returns `true` if valid, `false` otherwise (401 should be returned).
 *
 * Usage in API routes:
 *   import { verifyAdminSession } from "@/lib/auth";
 *   if (!verifyAdminSession(request)) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */
export function verifyAdminSession(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    warnIfWeakAdminSecret(secret);
    return false;
  }
  // secret is narrowed to string here
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return false;

  return verifyAdminToken(cookie, secret);
}
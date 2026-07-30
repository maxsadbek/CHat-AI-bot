import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Verify an admin session token using the Web Crypto API (Edge-compatible).
 * Checks HMAC-SHA256 signature and 12-hour expiry.
 */
async function verifyAdminCookie(
  cookieValue: string,
  secret: string
): Promise<boolean> {
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, signatureHex] = parts;
  if (!timestampStr || !signatureHex) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // 12-hour expiry
  const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
  if (Date.now() - timestamp > SESSION_DURATION_MS) return false;

  try {
    // Recompute HMAC using Web Crypto API (Edge-compatible)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`admin_session:${timestampStr}`)
    );

    // Convert to lowercase hex string
    const expectedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison
    if (expectedHex.length !== signatureHex.length) return false;
    let result = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      result |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Next.js Middleware — Admin Route Protection
 *
 * Protects all /admin/* routes by verifying the `admin_session` cookie.
 * If the cookie is missing, expired, or has an invalid HMAC signature,
 * redirects to /admin/login (with the original path as a `redirect` query param).
 *
 * The /admin/login page itself is excluded from this check.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Skip the login page itself
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("admin_session")?.value;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!sessionCookie || !adminSecret || !(await verifyAdminCookie(sessionCookie, adminSecret))) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

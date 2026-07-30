import { NextResponse } from "next/server";

/**
 * POST /api/admin/logout
 *
 * Clears the `admin_session` cookie, effectively logging the admin out.
 * Returns a 200 response; the client should redirect to /admin/login.
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({
    success: true,
    message: "Выход выполнен",
  });

  // Clear the session cookie
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  return response;
}

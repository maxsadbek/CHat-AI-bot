import { type NextRequest, NextResponse } from "next/server";
import { safeCompare, signAdminToken } from "@/lib/auth";

/**
 * POST /api/admin/login
 *
 * Verifies the provided password against ADMIN_SECRET using timing-safe
 * comparison. If valid, sets an httpOnly, secure, sameSite=strict cookie
 * named `admin_session` with an HMAC-signed token (expires in 12 hours).
 *
 * Body: { password: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Пароль обязателен" },
        { status: 400 }
      );
    }

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || !safeCompare(adminSecret, password)) {
      return NextResponse.json(
        { error: "Неверный пароль" },
        { status: 401 }
      );
    }

    // Sign a session token valid for 12 hours
    const token = signAdminToken(adminSecret);
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const response = NextResponse.json({
      success: true,
      message: "Вход выполнен успешно",
    });

    // Set httpOnly, secure, sameSite=strict cookie
    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

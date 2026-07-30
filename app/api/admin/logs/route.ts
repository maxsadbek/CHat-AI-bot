import { type NextRequest, NextResponse } from "next/server";
import { adminService } from "@/services/admin";
import { verifyAdminSession } from "@/lib/auth";

/**
 * GET /api/admin/logs
 * Returns admin activity logs
 * Protected by admin_session cookie
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const logs = await adminService.getLogs(page, limit);
    return NextResponse.json({ logs, page, limit });
  } catch (error) {
    console.error("Admin logs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

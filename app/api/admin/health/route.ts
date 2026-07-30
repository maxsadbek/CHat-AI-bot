import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { systemHealthService } from "@/services/admin/health";

/**
 * GET /api/admin/health
 * Returns comprehensive system health check results.
 * Protected by admin_session cookie.
 *
 * Query params:
 *   - quick: boolean (default false) — if true, only returns basic status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const isQuick = new URL(request.url).searchParams.get("quick") === "true";

  // Quick check doesn't require auth (for load balancers)
  if (isQuick) {
    const result = await systemHealthService.getQuickHealth();
    return NextResponse.json(result);
  }

  // Full check requires admin session cookie
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await systemHealthService.getFullHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error("System health error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}

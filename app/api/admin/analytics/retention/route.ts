import { type NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics";
import { verifyAdminSession } from "@/lib/auth";

/**
 * GET /api/admin/analytics/retention
 * Returns user retention stats (returning users rate).
 * Protected by admin_session cookie.
 *
 * Query params:
 *   - days: number (default 30) — lookback period
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const retention = await analyticsService.getRetentionStats(days);
    return NextResponse.json({ days, ...retention });
  } catch (error) {
    console.error("Retention analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch retention stats" },
      { status: 500 }
    );
  }
}

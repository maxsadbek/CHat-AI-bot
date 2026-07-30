import { type NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics";
import { verifyAdminSession } from "@/lib/auth";

/**
 * GET /api/admin/analytics/hourly
 * Returns hourly activity distribution for peak usage times.
 * Protected by admin_session cookie.
 *
 * Query params:
 *   - days: number (default 7) — lookback period
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "7", 10);

    const hourly = await analyticsService.getHourlyDistribution(days);
    return NextResponse.json({ days, hourly });
  } catch (error) {
    console.error("Hourly analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch hourly distribution" },
      { status: 500 }
    );
  }
}

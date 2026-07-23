import { type NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics";

/**
 * GET /api/admin/analytics/growth
 * Returns user growth over time (new users per day).
 * Protected by admin secret header.
 *
 * Query params:
 *   - days: number (default 30) — lookback period
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    const growth = await analyticsService.getUserGrowth(days);
    return NextResponse.json({ days, growth });
  } catch (error) {
    console.error("User growth analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user growth" },
      { status: 500 }
    );
  }
}

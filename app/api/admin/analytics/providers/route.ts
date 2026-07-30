import { type NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics";
import { verifyAdminSession } from "@/lib/auth";

/**
 * GET /api/admin/analytics/providers
 * Returns AI provider and model usage breakdown.
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

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const analytics = await analyticsService.getProviderAnalytics(since);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Provider analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider analytics" },
      { status: 500 }
    );
  }
}

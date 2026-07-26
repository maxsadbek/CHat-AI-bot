import { type NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics";
import { verifyAdminSecret } from "@/lib/auth";

/**
 * GET /api/admin/analytics/overview
 * Returns the main dashboard overview with all key metrics.
 * Protected by admin secret header (timing-safe comparison).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSecret(request.headers.get("authorization"), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overview = await analyticsService.getOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics overview" },
      { status: 500 }
    );
  }
}

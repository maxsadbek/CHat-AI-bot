import { type NextRequest, NextResponse } from "next/server";
import { adminService } from "@/services/admin";

/**
 * GET /api/admin/stats
 * Returns admin dashboard statistics
 * Protected by admin secret header
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await adminService.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

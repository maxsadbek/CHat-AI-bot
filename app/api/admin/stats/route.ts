import { type NextRequest, NextResponse } from "next/server";
import { adminService } from "@/services/admin";
import { verifyAdminSecret } from "@/lib/auth";

/**
 * GET /api/admin/stats
 * Returns admin dashboard statistics
 * Protected by admin secret header (timing-safe comparison)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSecret(request.headers.get("authorization"), process.env.ADMIN_SECRET)) {
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

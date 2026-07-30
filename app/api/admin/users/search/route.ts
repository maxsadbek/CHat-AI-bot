import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { userManagementService } from "@/services/admin/user-management";

/**
 * GET /api/admin/users/search?q=term&page=1&limit=20
 * Search users by name or username
 * Protected by admin_session cookie
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    if (!query.trim()) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const result = await userManagementService.searchUsers(query.trim(), page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin user search error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { verifyApiAuth, logAdminAction } from "@/services/admin/admin-guard";
import { userManagementService } from "@/services/admin/user-management";

/**
 * GET /api/admin/users/[id]
 * Returns detailed user information
 * Protected by admin secret header
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminId = verifyApiAuth(request.headers.get("authorization"));
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await userManagementService.getUserDetail(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user settings (premium toggle, daily limit, reset daily)
 * Body: { action: "toggle_premium" | "reset_daily" | "update_limit", dailyLimit?: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminId = verifyApiAuth(request.headers.get("authorization"));
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await request.json();
    const { action, dailyLimit } = body;

    switch (action) {
      case "toggle_premium": {
        const result = await userManagementService.togglePremium(userId, adminId);
        return NextResponse.json({ success: true, isPremium: result.isPremium });
      }
      case "reset_daily": {
        await userManagementService.resetUserDaily(userId, adminId);
        return NextResponse.json({ success: true });
      }
      case "update_limit": {
        if (typeof dailyLimit !== "number" || dailyLimit < 0) {
          return NextResponse.json({ error: "Invalid daily limit" }, { status: 400 });
        }
        await userManagementService.updateDailyLimit(userId, dailyLimit, adminId);
        return NextResponse.json({ success: true, dailyLimit });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user and all associated data (GDPR)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminId = verifyApiAuth(request.headers.get("authorization"));
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    await userManagementService.deleteUserData(userId, adminId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

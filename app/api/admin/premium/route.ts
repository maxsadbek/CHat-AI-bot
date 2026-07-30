import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { premiumManagementService } from "@/services/admin/premium-management";

/**
 * GET /api/admin/premium
 * Returns premium management stats and user list
 * Query params: view=stats|users, page=1, limit=20
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "stats";

    if (view === "users") {
      const page = parseInt(searchParams.get("page") ?? "1", 10);
      const limit = parseInt(searchParams.get("limit") ?? "20", 10);
      const users = await premiumManagementService.getPremiumUsers(page, limit);
      return NextResponse.json(users);
    }

    const stats = await premiumManagementService.getPremiumStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Admin premium error:", error);
    return NextResponse.json({ error: "Failed to fetch premium data" }, { status: 500 });
  }
}

/**
 * POST /api/admin/premium
 * Perform premium management actions
 * Body: { action: "grant" | "revoke" | "extend", userId: number, planId?: string, days?: number }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, userId, planId, days } = body;
    const adminId: number = 0; // System admin (authenticated via cookie)

    if (!userId || typeof userId !== "number") {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }

    switch (action) {
      case "grant": {
        if (!planId) {
          return NextResponse.json({ error: "planId is required for grant" }, { status: 400 });
        }
        const result = await premiumManagementService.grantPremium(userId, planId, adminId);
        return NextResponse.json(result);
      }
      case "revoke": {
        const result = await premiumManagementService.revokePremium(userId, adminId);
        return NextResponse.json(result);
      }
      case "extend": {
        if (!days || typeof days !== "number") {
          return NextResponse.json({ error: "Valid days is required for extend" }, { status: 400 });
        }
        const result = await premiumManagementService.extendSubscription(userId, days, adminId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin premium action error:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  }
}

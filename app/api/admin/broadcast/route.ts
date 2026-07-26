import { type NextRequest, NextResponse } from "next/server";
import { adminService } from "@/services/admin";
import { verifyAdminSecret } from "@/lib/auth";

/**
 * POST /api/admin/broadcast
 * Broadcast a message to all users
 * Protected by admin secret header (timing-safe comparison)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSecret(request.headers.get("authorization"), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const userCount = await adminService.broadcast(message);
    await adminService.logAction(0, "broadcast", `Broadcast to ${userCount} users: ${message.slice(0, 100)}`);

    return NextResponse.json({
      success: true,
      usersReached: userCount,
    });
  } catch (error) {
    console.error("Admin broadcast error:", error);
    return NextResponse.json(
      { error: "Failed to broadcast" },
      { status: 500 }
    );
  }
}

// src/app/api/user-stories/count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getUserStoryStats } from "@/lib/user-stories/access-control";

// GET: Get user's story count and limits
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPremium = session.user.isPremium ?? false;
    const stats = await getUserStoryStats(session.user.id, isPremium);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching story count:", error);
    return NextResponse.json(
      { error: "Failed to fetch story count" },
      { status: 500 }
    );
  }
}

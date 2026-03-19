// src/app/api/admin/cleanup-session-costs/route.ts
// Deletes orphaned cost records when an admin upload session is abandoned ("Clear & Start Fresh")

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const result = await prisma.apiCost.deleteMany({
      where: {
        metadata: {
          path: ["adminSessionId"],
          equals: sessionId,
        },
      },
    });

    console.log(`[cleanup-session-costs] Deleted ${result.count} orphaned cost records for session ${sessionId}`);

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[cleanup-session-costs] Error:", error);
    return NextResponse.json({ error: "Failed to cleanup costs" }, { status: 500 });
  }
}

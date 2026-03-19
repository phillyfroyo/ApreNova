// src/app/api/admin/backfill-session-costs/route.ts
// Backfills cost records with the final story slug when an admin upload is saved.
// Called at Step 7 (Save) to associate all session costs with the correct slug.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, slug } = await req.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    // Find all cost records for this session and update their metadata with the final slug
    const records = await prisma.apiCost.findMany({
      where: {
        metadata: {
          path: ["adminSessionId"],
          equals: sessionId,
        },
      },
      select: { id: true, metadata: true },
    });

    if (records.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    // Update each record's metadata to include the final slug
    // Using a transaction for consistency
    await prisma.$transaction(
      records.map((record) => {
        const existingMetadata = (record.metadata as Record<string, unknown>) || {};
        return prisma.apiCost.update({
          where: { id: record.id },
          data: {
            metadata: {
              ...existingMetadata,
              adminStorySlug: slug,
            } as Prisma.InputJsonValue,
          },
        });
      })
    );

    console.log(`[backfill-session-costs] Updated ${records.length} cost records: session ${sessionId} → slug "${slug}"`);

    return NextResponse.json({ updated: records.length });
  } catch (error) {
    console.error("[backfill-session-costs] Error:", error);
    return NextResponse.json({ error: "Failed to backfill costs" }, { status: 500 });
  }
}

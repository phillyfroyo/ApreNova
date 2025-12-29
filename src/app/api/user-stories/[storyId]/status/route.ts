// src/app/api/user-stories/[storyId]/status/route.ts
// Lightweight endpoint for polling story processing status
// Returns only essential fields to minimize database transfer

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

// GET: Get lightweight story status (optimized for polling)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;

    // Fetch only essential fields - no content, no rawContent
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        descriptionEs: true,
        descriptionEn: true,
        status: true,
        detectedLevel: true,
        sourceLanguage: true,
        thumbnailUrl: true,
        levels: {
          select: {
            id: true,
            level: true,
            status: true,
            processingProgress: true,
          },
          orderBy: { level: "asc" },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json({ story });
  } catch (error: any) {
    console.error("[API/user-stories/[storyId]/status] GET error:", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch story status" },
      { status: 500 }
    );
  }
}

// src/app/api/user-stories/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

// POST: Trigger story processing
// This can be called automatically after story creation or manually to retry
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storyId } = body;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing storyId" },
        { status: 400 }
      );
    }

    // Verify ownership
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Don't reprocess if already ready
    if (story.status === "READY") {
      return NextResponse.json({
        success: true,
        message: "Story is already processed",
        status: story.status,
      });
    }

    // Check if already processing (prevent duplicate processing)
    if (story.status === "PROCESSING") {
      const processingLevels = await prisma.userStoryLevel.findMany({
        where: {
          userStoryId: storyId,
          status: "PROCESSING",
        },
      });

      if (processingLevels.length > 0) {
        return NextResponse.json({
          success: true,
          message: "Story is already being processed",
          status: story.status,
        });
      }
    }

    // Hand off to Inngest. The orchestrator runs as chained background steps;
    // this route returns immediately while the work runs to completion in the
    // background.
    await inngest.send({
      name: "user-story/process",
      data: { storyId, userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: "Processing started",
      storyId,
    });
  } catch (error) {
    console.error("Error triggering story processing:", error);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}

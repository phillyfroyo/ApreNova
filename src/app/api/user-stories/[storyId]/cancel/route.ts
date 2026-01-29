// src/app/api/user-stories/[storyId]/cancel/route.ts
// Handles cancellation of story uploads
// Now much simpler since content is built incrementally to the content field

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface LevelContent {
  chapters?: Record<string, unknown>;
}

// POST: Cancel story upload
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;

    // Verify ownership and get story with levels
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
      include: {
        UserStoryLevel: true,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check if story is already completed - can't cancel completed stories
    if (story.status === "READY") {
      return NextResponse.json(
        { error: "Cannot cancel a completed story" },
        { status: 400 }
      );
    }

    // Check if story is already cancelled
    if (story.cancelledAt) {
      return NextResponse.json(
        { error: "Story is already cancelled" },
        { status: 400 }
      );
    }

    console.log(`[CancelStory] Cancelling story ${storyId} with ${story.UserStoryLevel.length} levels`);

    let totalCompleteChapters = 0;
    const levelUpdates: { levelId: string; status: "READY" | "FAILED" }[] = [];

    // Process each level - content is already built incrementally, just check what's there
    for (const level of story.UserStoryLevel) {
      const content = level.content as LevelContent | null;
      const chapterCount = content?.chapters ? Object.keys(content.chapters).length : 0;

      console.log(`[CancelStory] Level ${level.level}: ${chapterCount} chapters in content`);

      if (chapterCount > 0) {
        // Level has content - mark as READY (content already in correct format)
        levelUpdates.push({
          levelId: level.id,
          status: "READY",
        });
        totalCompleteChapters += chapterCount;
      } else if (level.status === "READY") {
        // Level was already complete
        totalCompleteChapters += chapterCount;
      } else {
        // No content for this level - mark as FAILED
        levelUpdates.push({
          levelId: level.id,
          status: "FAILED",
        });
      }
    }

    // Perform all updates in a transaction with retry for transient DB errors
    const MAX_CANCEL_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_CANCEL_RETRIES; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          // Update each level
          for (const update of levelUpdates) {
            await tx.userStoryLevel.update({
              where: { id: update.levelId },
              data: {
                status: update.status,
                processingProgress: Prisma.DbNull, // Clear processing progress
              },
            });
          }

          // Update story status
          await tx.userStory.update({
            where: { id: storyId },
            data: {
              cancelledAt: new Date(),
              status: "CANCELLED",
              processingProgress: Prisma.DbNull, // Clear processing progress
            },
          });
        });
        break; // Success — exit retry loop
      } catch (txError: any) {
        console.warn(`[CancelStory] Transaction attempt ${attempt}/${MAX_CANCEL_RETRIES} failed:`, txError.message);
        if (attempt === MAX_CANCEL_RETRIES) {
          throw txError; // Exhausted retries, propagate error
        }
        // Wait before retrying: 2s, 4s
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }

    console.log(`[CancelStory] Story ${storyId} cancelled. Total complete chapters across all levels: ${totalCompleteChapters}`);

    return NextResponse.json({
      success: true,
      message: "Story upload cancelled",
      completeChapters: totalCompleteChapters,
    });
  } catch (error: any) {
    console.error("[API/user-stories/[storyId]/cancel] POST error:", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to cancel story" },
      { status: 500 }
    );
  }
}

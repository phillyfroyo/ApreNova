// src/app/api/user-stories/[storyId]/cancel/route.ts
// Handles cancellation of story uploads, cleaning up incomplete chapters

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildContentStructureWithMetadata } from "@/lib/story-processing";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

// Types for processing progress structure
interface ProcessingProgressData {
  stage?: "rewriting" | "translating" | "complete";
  totalChapters?: number;
  completedData?: {
    sourceLines: string[];
    translatedLines: string[];
  }[];
  rewriteData?: {
    originalLines: string[];
    rewrittenLines: string[];
  }[];
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

    // Determine structureType from storyType for proper anthology pagination
    let structureType: "prose" | "anthology" | "epic" | "script" = "prose";
    if (story.storyType === 'poem' || story.storyType === 'song-lyrics') {
      structureType = "anthology";
    } else if (story.storyType === 'epic') {
      structureType = "epic";
    } else if (story.storyType === 'movie-script' || story.storyType === 'tv-script' || story.storyType === 'dialogue') {
      structureType = "script";
    }

    let totalCompleteChapters = 0;
    const levelUpdates: { levelId: string; content: any; status: "READY" | "FAILED" }[] = [];

    // Process each level to salvage complete chapters
    for (const level of story.UserStoryLevel) {
      const progress = level.processingProgress as ProcessingProgressData | null;

      // Check if level has any completed chapter data
      const completedData = progress?.completedData || [];

      // Filter to only chapters that have both source AND translated lines
      const completeChapters = completedData.filter(
        (ch) => ch.sourceLines?.length > 0 && ch.translatedLines?.length > 0
      );

      console.log(`[CancelStory] Level ${level.level}: ${completedData.length} chapters in progress, ${completeChapters.length} complete`);

      if (completeChapters.length > 0) {
        // Build content structure from complete chapters
        // Note: We need to convert level string (e.g., "A2") to number for buildContentStructure
        const levelNum = levelStringToNumber(level.level);

        const content = buildContentStructureWithMetadata(
          story.slug,
          levelNum,
          completeChapters.length > 1, // hasChapters: true if more than 1 chapter
          completeChapters as any, // Cast to allow partial data
          story.sourceLanguage as "en" | "es",
          { structureType } // Pass structureType for proper anthology pagination
        );

        levelUpdates.push({
          levelId: level.id,
          content,
          status: "READY",
        });

        totalCompleteChapters += completeChapters.length;
      } else if (level.status === "READY") {
        // Level was already complete, count its chapters
        const existingContent = level.content as { chapters?: Record<string, any> } | null;
        if (existingContent?.chapters) {
          totalCompleteChapters += Object.keys(existingContent.chapters).length;
        }
      } else {
        // No complete chapters for this level - mark as FAILED
        levelUpdates.push({
          levelId: level.id,
          content: {},
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
                content: update.content,
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
      // The UI will determine "Cancelled" vs "Incomplete" based on completeChapters
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

// Helper to convert level string (e.g., "A2", "B1") to number
function levelStringToNumber(level: string): number {
  const levelMap: Record<string, number> = {
    A1: 1,
    A2: 2,
    B1: 3,
    B2: 4,
    C1: 5,
    C2: 6,
  };
  return levelMap[level] || 3; // Default to B1 (3) if unknown
}

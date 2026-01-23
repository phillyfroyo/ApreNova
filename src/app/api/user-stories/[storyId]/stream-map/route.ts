// src/app/api/user-stories/[storyId]/stream-map/route.ts
// Provides navigation structure for streaming reader
// Returns which chapters are available vs still processing

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { paginateLines } from "@/lib/story-processing/text-processing";
import type { ProcessingProgress, ChapterTranslationData } from "@/lib/user-stories/progress-tracker";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, {
    pages: Record<number, { lines: { es: string; en: string }[] }>;
    metadata?: {
      number: number;
      title: string;
      subtitle?: string;
    };
  }>;
}

interface ChapterInfo {
  chapter: number;
  pages: number[];
  title?: string;
  subtitle?: string;
  status: "ready" | "pending";
}

// GET: Fetch navigation map for streaming reader
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");

    if (!level) {
      return NextResponse.json({ error: "Level parameter required" }, { status: 400 });
    }

    // Fetch story and level data
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        OR: [
          { userId: session.user.id },
          { visibility: "PUBLIC" },
        ],
      },
      select: {
        id: true,
        status: true,
        sourceLanguage: true,
        UserStoryLevel: {
          where: { level },
          select: {
            id: true,
            level: true,
            status: true,
            content: true,
            processingProgress: true,
          },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const levelData = story.UserStoryLevel[0];

    // If level doesn't exist yet, return empty but valid response
    // This happens when user clicks "Read While Uploading" before the level record is created
    if (!levelData) {
      return NextResponse.json({
        hasChapters: false,
        chapters: [],
        totalChapters: 0,
        completedChapters: 0,
        isProcessing: true,
        levelPending: true, // Signal that level is being prepared
      });
    }

    const progress = levelData.processingProgress as ProcessingProgress | null;
    const isProcessing = levelData.status === "PROCESSING" || levelData.status === "PENDING";

    // If level is READY, serve complete map from finalized content
    if (levelData.status === "READY" && levelData.content) {
      const content = levelData.content as unknown as LevelContent;
      const chapters: ChapterInfo[] = [];

      const chapterKeys = Object.keys(content.chapters)
        .map(Number)
        .sort((a, b) => a - b);

      for (const chapterNum of chapterKeys) {
        const chapterData = content.chapters[chapterNum];
        const pageKeys = Object.keys(chapterData.pages)
          .map(Number)
          .sort((a, b) => a - b);

        chapters.push({
          chapter: chapterNum,
          pages: pageKeys,
          title: chapterData.metadata?.title,
          subtitle: chapterData.metadata?.subtitle,
          status: "ready",
        });
      }

      return NextResponse.json({
        hasChapters: content.hasChapters,
        chapters,
        totalChapters: chapters.length,
        completedChapters: chapters.length,
        isProcessing: false,
      });
    }

    // Story is still processing - build map from completedData
    const completedData = progress?.completedData || [];
    const totalChapters = progress?.totalChapters || completedData.length;
    const completedChapters = completedData.length;

    const chapters: ChapterInfo[] = [];

    // Add completed chapters with page counts
    for (let i = 0; i < completedChapters; i++) {
      const chapterData = completedData[i] as ChapterTranslationData;
      // Paginate to get page count
      const sourcePages = paginateLines(chapterData.sourceLines);
      const translatedPages = paginateLines(chapterData.translatedLines);
      const pageCount = Math.max(sourcePages.length, translatedPages.length);

      chapters.push({
        chapter: i + 1,
        pages: Array.from({ length: pageCount }, (_, idx) => idx + 1),
        status: "ready",
      });
    }

    // Add pending chapters (no page info yet)
    for (let i = completedChapters; i < totalChapters; i++) {
      chapters.push({
        chapter: i + 1,
        pages: [], // Unknown until processed
        status: "pending",
      });
    }

    return NextResponse.json({
      hasChapters: totalChapters > 1,
      chapters,
      totalChapters,
      completedChapters,
      isProcessing,
      // Include current processing state for UI
      currentStage: progress?.stage,
      currentChapter: progress?.currentChapter,
    });

  } catch (error: any) {
    console.error("[API/user-stories/[storyId]/stream-map] GET error:", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch stream map" },
      { status: 500 }
    );
  }
}

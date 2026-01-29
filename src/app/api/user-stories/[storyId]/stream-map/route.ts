// src/app/api/user-stories/[storyId]/stream-map/route.ts
// Provides navigation structure for streaming reader
// Now uses the content field directly (single source of truth)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import type { ProcessingProgress } from "@/lib/user-stories/progress-tracker";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface PoemInfo {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
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
    poems?: PoemInfo[];  // For anthologies
  }>;
  structureType?: "prose" | "anthology" | "epic" | "script";
}

interface ChapterInfo {
  chapter: number;
  pages: number[];
  title?: string;
  subtitle?: string;
  status: "ready" | "pending";
  poems?: PoemInfo[];  // For anthologies - poem list for navigation
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
        storyType: true,
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
    if (!levelData) {
      return NextResponse.json({
        hasChapters: false,
        chapters: [],
        totalChapters: 0,
        completedChapters: 0,
        isProcessing: true,
        levelPending: true,
      });
    }

    const progress = levelData.processingProgress as ProcessingProgress | null;
    const isProcessing = levelData.status === "PROCESSING" || levelData.status === "PENDING";
    const content = levelData.content as unknown as LevelContent | null;

    // Build chapter list from content field (single source of truth)
    const chapters: ChapterInfo[] = [];
    const totalChapters = progress?.totalChapters || 0;

    if (content && content.chapters) {
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
          poems: chapterData.poems,
        });
      }
    }

    const completedChapters = chapters.length;

    // Add pending chapters (if we know the total)
    if (totalChapters > completedChapters) {
      for (let i = completedChapters; i < totalChapters; i++) {
        chapters.push({
          chapter: i + 1,
          pages: [],
          status: "pending",
        });
      }
    }

    // Get structure type from content or infer from storyType
    let structureType = content?.structureType;
    if (!structureType) {
      if (story.storyType === 'poem' || story.storyType === 'song-lyrics') {
        structureType = "anthology";
      } else if (story.storyType === 'epic') {
        structureType = "epic";
      } else if (story.storyType === 'movie-script' || story.storyType === 'tv-script' || story.storyType === 'dialogue') {
        structureType = "script";
      }
    }

    return NextResponse.json({
      hasChapters: content?.hasChapters ?? (totalChapters > 1),
      chapters,
      totalChapters: Math.max(totalChapters, completedChapters),
      completedChapters,
      isProcessing,
      currentStage: progress?.stage,
      currentChapter: progress?.currentChapter,
      structureType,
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

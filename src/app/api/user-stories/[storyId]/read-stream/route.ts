// src/app/api/user-stories/[storyId]/read-stream/route.ts
// Endpoint to serve paginated content on-demand during story processing
// Now uses the content field directly (single source of truth)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { ProcessingProgress } from "@/lib/user-stories/progress-tracker";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface PageContent {
  lines?: StoryLine[];
  stanzas?: StoryLine[][];  // Nested stanzas for poems
  // Anthology poem tracking
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}

interface ChapterContent {
  pages: Record<number, PageContent>;
  metadata?: {
    number: number;
    title: string;
    subtitle?: string;
  };
  poems?: { number: number; title: string; startPage: number; endPage: number; pageCount: number }[];
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, ChapterContent>;
  structureType?: "prose" | "anthology" | "epic" | "script";
}

// GET: Fetch paginated content for streaming reader
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");
    const chapter = parseInt(searchParams.get("chapter") || "1");
    const page = parseInt(searchParams.get("page") || "1");

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
        title: true,
        titleEs: true,
        titleEn: true,
        slug: true,
        sourceLanguage: true,
        status: true,
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

    // If level doesn't exist yet, return "preparing" response
    if (!levelData) {
      return NextResponse.json({
        error: "Level is being prepared",
        availableChapters: [],
        totalChapters: 0,
        isProcessing: true,
        chapterPending: true,
        hasChapters: false,
        levelPending: true,
      }, { status: 202 });
    }

    const progress = levelData.processingProgress as ProcessingProgress | null;
    const isProcessing = levelData.status === "PROCESSING" || levelData.status === "PENDING";
    const content = levelData.content as unknown as LevelContent | null;

    // No content yet - level just started processing
    if (!content || !content.chapters) {
      return NextResponse.json({
        error: "Content is being generated",
        availableChapters: [],
        totalChapters: progress?.totalChapters || 0,
        isProcessing,
        chapterPending: true,
        hasChapters: false,
      }, { status: 202 });
    }

    // Get available chapters from content field
    const availableChapterNums = Object.keys(content.chapters).map(Number).sort((a, b) => a - b);
    const completedChapters = availableChapterNums.length;
    const totalChapters = progress?.totalChapters || completedChapters;

    // Check if requested chapter is available
    if (!availableChapterNums.includes(chapter)) {
      return NextResponse.json({
        error: "Chapter not available yet",
        availableChapters: availableChapterNums,
        totalChapters,
        isProcessing,
        chapterPending: true,
        hasChapters: content.hasChapters,
      }, { status: 202 });
    }

    // Get chapter data from content field
    const chapterData = content.chapters[chapter];
    if (!chapterData) {
      return NextResponse.json({ error: "Chapter data not found" }, { status: 404 });
    }

    const totalPages = Object.keys(chapterData.pages).length;

    if (page > totalPages || page < 1) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const pageData = chapterData.pages[page];
    if (!pageData) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Build response
    const response: Record<string, unknown> = {
      storySlug: story.slug,
      title: story.title,
      titleEs: story.titleEs,
      titleEn: story.titleEn,
      chapter,
      page,
      totalPages,
      totalChapters,
      availableChapters: availableChapterNums,
      chapterMetadata: chapterData.metadata,
      isProcessing,
      hasChapters: content.hasChapters,
      storyType: story.storyType,
      structureType: content.structureType,
      // Include poem info for anthology navigation
      poemNumber: pageData.poemNumber,
      poemTitle: pageData.poemTitle,
      isFirstPageOfPoem: pageData.isFirstPageOfPoem,
      isContinuation: pageData.isContinuation,
    };

    // Return stanzas if available (poem content), otherwise lines
    if (pageData.stanzas && pageData.stanzas.length > 0) {
      response.stanzas = pageData.stanzas;
      // Also flatten to lines for backward compatibility
      response.lines = pageData.stanzas.flat();
    } else {
      response.lines = pageData.lines || [];
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[API/user-stories/[storyId]/read-stream] GET error:", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch streaming content" },
      { status: 500 }
    );
  }
}

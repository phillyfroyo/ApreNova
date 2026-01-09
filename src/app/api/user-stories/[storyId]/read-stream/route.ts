// src/app/api/user-stories/[storyId]/read-stream/route.ts
// Endpoint to serve paginated content on-demand during story processing
// Uses processingProgress.completedData[] for partially-completed stories

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { paginateLines, StoryLine } from "@/lib/story-processing/text-processing";
import type { ProcessingProgress, ChapterTranslationData } from "@/lib/user-stories/progress-tracker";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface PageContent {
  lines: StoryLine[];
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, {
    pages: Record<number, PageContent>;
    metadata?: {
      number: number;
      title: string;
      subtitle?: string;
    };
  }>;
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
    if (!levelData) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    const progress = levelData.processingProgress as ProcessingProgress | null;
    const isProcessing = levelData.status === "PROCESSING";

    // If level is READY, serve from finalized content
    if (levelData.status === "READY" && levelData.content) {
      const content = levelData.content as unknown as LevelContent;
      const chapterData = content.chapters?.[chapter];

      if (!chapterData) {
        return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
      }

      const pageData = chapterData.pages?.[page];
      if (!pageData) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      const totalChapters = Object.keys(content.chapters).length;
      const totalPages = Object.keys(chapterData.pages).length;
      const availableChapters = Object.keys(content.chapters).map(Number).sort((a, b) => a - b);

      return NextResponse.json({
        lines: pageData.lines,
        storySlug: story.slug,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        chapter,
        page,
        totalPages,
        totalChapters,
        availableChapters,
        chapterMetadata: chapterData.metadata,
        isProcessing: false,
        hasChapters: content.hasChapters,
      });
    }

    // Story is still processing - serve from completedData
    const completedData = progress?.completedData || [];
    const completedChapters = completedData.length;
    const totalChapters = progress?.totalChapters || completedChapters;

    // Check if requested chapter is available
    if (chapter > completedChapters || chapter < 1) {
      return NextResponse.json({
        error: "Chapter not available yet",
        availableChapters: Array.from({ length: completedChapters }, (_, i) => i + 1),
        totalChapters,
        isProcessing,
        chapterPending: true,
      }, { status: 202 }); // 202 Accepted - processing in progress
    }

    // Get chapter data from completedData (0-indexed)
    const chapterData = completedData[chapter - 1] as ChapterTranslationData;
    if (!chapterData) {
      return NextResponse.json({ error: "Chapter data not found" }, { status: 404 });
    }

    // Paginate the chapter content
    const sourceLanguage = story.sourceLanguage as "en" | "es";
    const sourcePages = paginateLines(chapterData.sourceLines);
    const translatedPages = paginateLines(chapterData.translatedLines);

    const totalPages = Math.max(sourcePages.length, translatedPages.length);

    if (page > totalPages || page < 1) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Build lines for requested page (0-indexed for arrays)
    const sourcePage = sourcePages[page - 1] || [];
    const translatedPage = translatedPages[page - 1] || [];
    const maxLines = Math.max(sourcePage.length, translatedPage.length);

    const lines: StoryLine[] = [];
    for (let i = 0; i < maxLines; i++) {
      const source = sourcePage[i]?.trim() || "";
      const translated = translatedPage[i]?.trim() || "";

      if (sourceLanguage === "es") {
        lines.push({ es: source, en: translated });
      } else {
        lines.push({ en: source, es: translated });
      }
    }

    return NextResponse.json({
      lines,
      storySlug: story.slug,
      title: story.title,
      titleEs: story.titleEs,
      titleEn: story.titleEn,
      chapter,
      page,
      totalPages,
      totalChapters,
      availableChapters: Array.from({ length: completedChapters }, (_, i) => i + 1),
      chapterMetadata: undefined, // Metadata only available after full processing
      isProcessing,
      hasChapters: totalChapters > 1,
    });

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

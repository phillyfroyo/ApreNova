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
  lines?: StoryLine[];
  stanzas?: StoryLine[][];  // Nested stanzas for poems
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
  // Content structure type for navigation labels
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
    // This happens when user clicks "Read While Uploading" before the level record is created
    if (!levelData) {
      return NextResponse.json({
        error: "Level is being prepared",
        availableChapters: [],
        totalChapters: 0,
        isProcessing: true,
        chapterPending: true,
        hasChapters: false,
        levelPending: true, // Distinct from chapterPending
      }, { status: 202 }); // 202 Accepted - processing in progress
    }

    const progress = levelData.processingProgress as ProcessingProgress | null;
    const isProcessing = levelData.status === "PROCESSING" || levelData.status === "PENDING";

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

      // Build response - include stanzas for poems, lines for prose
      const response: Record<string, unknown> = {
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
        storyType: story.storyType,
        // Include structure type for navigation labels (Collection/Poem vs Chapter/Page)
        structureType: content.structureType,
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

    // Check if we have pre-built pages from incremental building
    // This ensures streaming content matches final pagination (especially for anthologies)
    if (chapterData.builtPages) {
      const totalPages = Object.keys(chapterData.builtPages).length;

      if (page > totalPages || page < 1) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      const pageData = chapterData.builtPages[page];
      if (!pageData) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      // For in-progress content, infer structureType from storyType
      let inferredStructureType: "prose" | "anthology" | "epic" | "script" | undefined;
      if (story.storyType === 'poem' || story.storyType === 'song-lyrics') {
        inferredStructureType = "anthology";
      } else if (story.storyType === 'epic') {
        inferredStructureType = "epic";
      } else if (story.storyType === 'movie-script' || story.storyType === 'tv-script' || story.storyType === 'dialogue') {
        inferredStructureType = "script";
      }

      // Build response using pre-built content
      const response: Record<string, unknown> = {
        storySlug: story.slug,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        chapter,
        page,
        totalPages,
        totalChapters,
        availableChapters: Array.from({ length: completedChapters }, (_, i) => i + 1),
        chapterMetadata: chapterData.metadata,
        isProcessing,
        hasChapters: totalChapters > 1,
        storyType: story.storyType,
        structureType: inferredStructureType,
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
    }

    // Fallback: Legacy pagination for stories started before incremental building
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

    // Check if this is a poem type for stanza break detection
    const isPoemType = story.storyType === 'poem' || story.storyType === 'song-lyrics' || story.storyType === 'epic';

    const lines: StoryLine[] = [];
    for (let i = 0; i < maxLines; i++) {
      const sourceRaw = sourcePage[i] ?? "";
      const translatedRaw = translatedPage[i] ?? "";
      const source = sourceRaw.trim();
      const translated = translatedRaw.trim();

      // For poems, detect stanza breaks (empty lines)
      const isStanzaBreak = isPoemType && !source && !translated;

      if (sourceLanguage === "es") {
        lines.push({
          es: source,
          en: translated,
          ...(isStanzaBreak && { isStanzaBreak: true })
        });
      } else {
        lines.push({
          en: source,
          es: translated,
          ...(isStanzaBreak && { isStanzaBreak: true })
        });
      }
    }

    // For in-progress content, infer structureType from storyType
    // (actual structureType will be set when build phase completes)
    let inferredStructureType: "prose" | "anthology" | "epic" | "script" | undefined;
    if (story.storyType === 'poem' || story.storyType === 'song-lyrics') {
      // Poems default to anthology structure for navigation labels
      inferredStructureType = "anthology";
    } else if (story.storyType === 'epic') {
      inferredStructureType = "epic";
    } else if (story.storyType === 'movie-script' || story.storyType === 'tv-script' || story.storyType === 'dialogue') {
      inferredStructureType = "script";
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
      storyType: story.storyType,
      structureType: inferredStructureType,
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

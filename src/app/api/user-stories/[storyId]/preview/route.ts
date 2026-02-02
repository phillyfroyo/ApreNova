// src/app/api/user-stories/[storyId]/preview/route.ts
// Endpoint to fetch preview data for the story viewer modal
// Reconstructs chapter data from level content if processingProgress is empty

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

interface ChapterTranslationData {
  sourceLines: string[];
  translatedLines: string[];
}

interface ChapterRewriteData {
  originalLines: string[];
  rewrittenLines: string[];
}

// Structure stored in level.content
// Note: The actual structure has lines as objects { es, en }, not separate arrays
interface LevelContent {
  storySlug?: string;
  level?: number;
  hasChapters?: boolean;
  chapters: Record<number, {
    pages: Record<number, {
      // New format: array of line objects
      lines?: { es: string; en: string }[];
      // Legacy format: separate arrays (kept for backward compat)
      en?: string[];
      es?: string[];
    }>;
    metadata?: {
      number?: number;
      title?: string;
      subtitle?: string;
      titleEn?: string;
      titleEs?: string;
    };
  }>;
  sourceLanguage?: "en" | "es";
  structureType?: "prose" | "anthology" | "epic" | "script";
  totalPages?: number;
}

/**
 * Extract chapter data from stored level content
 * This reconstructs the preview data from the paginated content
 *
 * Handles both content formats:
 * - New format: page.lines = [{ es, en }, ...]
 * - Legacy format: page.en = [...], page.es = [...]
 */
function extractChaptersFromContent(
  content: LevelContent,
  sourceLanguage: "en" | "es"
): ChapterTranslationData[] {
  const chapters: ChapterTranslationData[] = [];

  // Get chapter keys sorted numerically
  const chapterKeys = Object.keys(content.chapters)
    .map(Number)
    .sort((a, b) => a - b);

  for (const chapterKey of chapterKeys) {
    const chapter = content.chapters[chapterKey];
    if (!chapter || !chapter.pages) continue;

    // Combine all pages into single arrays
    const pageKeys = Object.keys(chapter.pages)
      .map(Number)
      .sort((a, b) => a - b);

    const sourceLines: string[] = [];
    const translatedLines: string[] = [];

    for (const pageKey of pageKeys) {
      const page = chapter.pages[pageKey];
      if (!page) continue;

      // Check for new format (lines array of objects)
      if (page.lines && Array.isArray(page.lines)) {
        for (const line of page.lines) {
          if (sourceLanguage === "en") {
            sourceLines.push(line.en || "");
            translatedLines.push(line.es || "");
          } else {
            sourceLines.push(line.es || "");
            translatedLines.push(line.en || "");
          }
        }
      }
      // Fall back to legacy format (separate arrays)
      else if (page.en || page.es) {
        const sourceLang = sourceLanguage;
        const targetLang = sourceLanguage === "en" ? "es" : "en";

        sourceLines.push(...(page[sourceLang] || []));
        translatedLines.push(...(page[targetLang] || []));
      }
    }

    chapters.push({ sourceLines, translatedLines });
  }

  return chapters;
}

// GET: Fetch preview data for a specific level
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");
    const type = searchParams.get("type"); // "rewriting" or "translating"

    if (!level) {
      return NextResponse.json({ error: "Level parameter required" }, { status: 400 });
    }

    // Fetch the story and level
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
      select: {
        id: true,
        sourceLanguage: true,
        detectedLevel: true,
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

    const processingProgress = levelData.processingProgress as {
      completedData?: ChapterTranslationData[];
      rewriteData?: ChapterRewriteData[];
      totalChapters?: number;
    } | null;

    // For translation preview
    if (type === "translating") {
      // First try processingProgress.completedData
      if (processingProgress?.completedData && processingProgress.completedData.length > 0) {
        return NextResponse.json({
          chapters: processingProgress.completedData,
          totalChapters: processingProgress.totalChapters || processingProgress.completedData.length,
          source: "processingProgress",
        });
      }

      // Fall back to reconstructing from content
      const content = levelData.content as LevelContent | null;
      if (content?.chapters) {
        const chapters = extractChaptersFromContent(content, story.sourceLanguage as "en" | "es");
        return NextResponse.json({
          chapters,
          totalChapters: chapters.length,
          source: "content",
        });
      }

      // No data available
      return NextResponse.json({
        chapters: [],
        totalChapters: 0,
        source: "empty",
      });
    }

    // For rewrite preview
    if (type === "rewriting") {
      // Try processingProgress.rewriteData
      if (processingProgress?.rewriteData && processingProgress.rewriteData.length > 0) {
        return NextResponse.json({
          chapters: processingProgress.rewriteData,
          totalChapters: processingProgress.totalChapters || processingProgress.rewriteData.length,
          source: "processingProgress",
        });
      }

      // For rewrites, we need to compare with the detected level's content
      // This is more complex - we'd need to fetch both levels and compare
      // For now, return empty if not in processingProgress
      return NextResponse.json({
        chapters: [],
        totalChapters: 0,
        source: "empty",
        message: "Rewrite data not available - only stored during processing",
      });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("[API/user-stories/[storyId]/preview] GET error:", {
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch preview data" },
      { status: 500 }
    );
  }
}

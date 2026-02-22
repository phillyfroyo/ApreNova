// src/app/api/user-stories/[storyId]/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { extractTextFromContent, applyTextToContent } from "@/lib/user-stories/content-utils";
import type { LevelContent, ChapterContent } from "@/lib/story-processing/text-processing";
import { detectAlignmentIssues, type ChapterAlignmentResult } from "@/lib/user-stories/alignment-check";
import { hasStanzas, flattenStanzas } from "@/lib/story-processing/text-processing";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

/**
 * Extract alignment issues map from content chapters.
 * Returns only chapters that have issues, keyed by chapter number.
 */
function extractChapterAlignmentMap(
  content: LevelContent
): Record<number, ChapterAlignmentResult> {
  const map: Record<number, ChapterAlignmentResult> = {};
  for (const [key, chapter] of Object.entries(content.chapters)) {
    if (chapter.alignmentIssues?.hasIssues) {
      map[parseInt(key, 10)] = chapter.alignmentIssues;
    }
  }
  return map;
}

/**
 * Re-run alignment detection on a content structure by extracting
 * source/translated lines per chapter from the pages.
 */
function redetectAlignmentForContent(
  content: LevelContent,
  sourceLanguage: "en" | "es"
): void {
  const targetLanguage = sourceLanguage === "en" ? "es" : "en";
  let anyHasIssues = false;

  for (const [key, chapter] of Object.entries(content.chapters)) {
    const sourceLines: string[] = [];
    const translatedLines: string[] = [];

    const pageKeys = Object.keys(chapter.pages).map(Number).sort((a, b) => a - b);
    for (const pageNum of pageKeys) {
      const page = chapter.pages[pageNum];
      if (!page) continue;
      const lines = hasStanzas(page)
        ? flattenStanzas(page.stanzas!)
        : page.lines || [];
      for (const line of lines) {
        sourceLines.push(line[sourceLanguage] ?? "");
        translatedLines.push(line[targetLanguage] ?? "");
      }
    }

    const result = detectAlignmentIssues(sourceLines, translatedLines);
    (chapter as any).alignmentIssues = result.hasIssues ? result : undefined;
    if (result.hasIssues) anyHasIssues = true;
  }

  content.hasAlignmentIssues = anyHasIssues || undefined;
}

// GET: Get story content for a specific level
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
      return NextResponse.json(
        { error: "Missing level parameter" },
        { status: 400 }
      );
    }

    // First verify the user owns this story (or it's public)
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        OR: [
          { userId: session.user.id },
          { visibility: "PUBLIC" },
        ],
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Get the level content
    const levelContent = await prisma.userStoryLevel.findUnique({
      where: {
        userStoryId_level: {
          userStoryId: storyId,
          level,
        },
      },
    });

    if (!levelContent) {
      return NextResponse.json(
        { error: "Level not found" },
        { status: 404 }
      );
    }

    if (levelContent.status !== "READY") {
      return NextResponse.json(
        {
          error: "Level content not ready",
          status: levelContent.status,
        },
        { status: 202 }
      );
    }

    // Raw format: return source/translated text strings for comparison
    const format = searchParams.get("format");
    if (format === "raw") {
      const srcLang = (story.sourceLanguage === "es" ? "es" : "en") as "en" | "es";
      const { sourceText, translatedText } = extractTextFromContent(
        levelContent.content as unknown as LevelContent,
        srcLang
      );
      // Debug: log first few lines to verify blank line spacing
      const srcLines = sourceText.split('\n');
      console.log(`[content/route] extractTextFromContent returned ${srcLines.length} source lines (first 10):`);
      srcLines.slice(0, 10).forEach((l, i) => console.log(`  ${i}: ${l ? `"${l.slice(0, 60)}"` : '(blank)'}`));

      const content = levelContent.content as unknown as LevelContent;

      // For content processed before alignment detection was added,
      // run detection on-the-fly so existing stories get warnings immediately.
      if (content.hasAlignmentIssues === undefined) {
        redetectAlignmentForContent(content, srcLang);
      }

      return NextResponse.json({
        sourceText,
        translatedText,
        sourceLanguage: story.sourceLanguage,
        hasAlignmentIssues: content.hasAlignmentIssues || false,
        chapterAlignmentIssues: extractChapterAlignmentMap(content),
      });
    }

    return NextResponse.json({
      content: levelContent.content,
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        sourceLanguage: story.sourceLanguage,
      },
    });
  } catch (error) {
    console.error("Error fetching story content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}

// PATCH: Save edited source/translated text for a specific level
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const body = await req.json();
    const { level, sourceText, translatedText } = body as {
      level: string;
      sourceText?: string;
      translatedText?: string;
    };

    if (!level) {
      return NextResponse.json(
        { error: "Missing level parameter" },
        { status: 400 }
      );
    }

    if (sourceText === undefined && translatedText === undefined) {
      return NextResponse.json(
        { error: "Nothing to save" },
        { status: 400 }
      );
    }

    // Verify the user owns this story
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Get the existing level content
    const levelRecord = await prisma.userStoryLevel.findUnique({
      where: {
        userStoryId_level: {
          userStoryId: storyId,
          level,
        },
      },
    });

    if (!levelRecord) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    if (levelRecord.status !== "READY") {
      return NextResponse.json(
        { error: "Level content not ready for editing" },
        { status: 400 }
      );
    }

    const srcLang = (story.sourceLanguage === "es" ? "es" : "en") as "en" | "es";
    const existingContent = levelRecord.content as unknown as LevelContent;

    // Apply edits to the content structure
    const updatedContent = applyTextToContent(
      existingContent,
      srcLang,
      sourceText,
      translatedText,
    );

    // Re-run alignment detection on updated content (auto-clear/update)
    redetectAlignmentForContent(updatedContent, srcLang);

    // Save back to DB
    await prisma.userStoryLevel.update({
      where: {
        userStoryId_level: {
          userStoryId: storyId,
          level,
        },
      },
      data: {
        content: updatedContent as any,
      },
    });

    console.log(`[content/PATCH] Saved edited content for story=${storyId} level=${level}`);

    return NextResponse.json({
      success: true,
      hasAlignmentIssues: updatedContent.hasAlignmentIssues || false,
      chapterAlignmentIssues: extractChapterAlignmentMap(updatedContent),
    });
  } catch (error) {
    console.error("Error saving story content:", error);
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}

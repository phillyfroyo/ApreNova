// src/app/api/user-stories/[storyId]/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { extractTextFromContent } from "@/lib/user-stories/content-utils";
import type { LevelContent } from "@/lib/story-processing/text-processing";

interface RouteParams {
  params: Promise<{ storyId: string }>;
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

      return NextResponse.json({
        sourceText,
        translatedText,
        sourceLanguage: story.sourceLanguage,
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

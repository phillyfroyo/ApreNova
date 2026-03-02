// src/app/api/admin/rewrite-level/route.ts
// Admin rewrite API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import {
  rewriteToLevel,
  rewritePoetryChapter,
  type RewriteResult,
} from "@/lib/story-processing";

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLanguage, targetLevel, sourceLevel, isPoetry, slug } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!targetLevel || targetLevel < 1 || targetLevel > 6) {
      return NextResponse.json(
        { error: "Valid target level (1-6) is required" },
        { status: 400 }
      );
    }

    const language = sourceLanguage || "en";
    const effectiveSourceLevel = sourceLevel || targetLevel;

    // For poetry, use chapter-level processing with markers for ~99% cost reduction
    // Falls back to poem-level then stanza-level if markers aren't preserved
    if (isPoetry) {
      const chapterResult = await rewritePoetryChapter(
        text,
        effectiveSourceLevel,
        targetLevel,
        language,
        { isPoetry: true, maxRetries: 3, adminStorySlug: slug }
      );

      if (!chapterResult.wasRewritten && effectiveSourceLevel !== targetLevel) {
        return NextResponse.json(
          {
            error: "AI could not process this poetry chunk. It may be empty or contain only non-story content.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        rewrittenText: chapterResult.rewrittenText,
        targetLevel,
        wasRewritten: chapterResult.wasRewritten,
        originalLength: text.length,
        rewrittenLength: chapterResult.rewrittenText.length,
        poemCount: chapterResult.poemCount,
        // Include fallback info for debugging
        usedFallback: chapterResult.usedFallback,
      });
    }

    // For prose, use standard rewriting with 3 retries
    const result: RewriteResult = await rewriteToLevel(
      text,
      effectiveSourceLevel,
      targetLevel,
      language,
      { isPoetry: false, maxRetries: 3, adminStorySlug: slug }
    );

    if (!result.wasRewritten && effectiveSourceLevel !== targetLevel) {
      const reason = result.failureReason || "unknown";
      console.error(`[rewrite-level] Failed: reason=${reason}, input=${text.length} chars, L${effectiveSourceLevel}→L${targetLevel}`);
      return NextResponse.json(
        {
          error: `Rewrite failed (${reason}). Input: ${text.length} chars.`,
          failureReason: reason,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      rewrittenText: result.rewrittenText,
      targetLevel,
      wasRewritten: result.wasRewritten,
      originalLength: result.originalLength,
      rewrittenLength: result.rewrittenLength,
    });
  } catch (error) {
    console.error("Level rewrite error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to rewrite text",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

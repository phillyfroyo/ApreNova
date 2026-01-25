// src/app/api/admin/rewrite-level/route.ts
// Admin rewrite API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import {
  rewriteToLevel,
  rewritePoemByStanza,
  joinStanzasWithSpacing,
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

    // For poetry, use stanza-by-stanza rewriting for better structure preservation
    if (isPoetry) {
      const stanzaResult = await rewritePoemByStanza(
        text,
        effectiveSourceLevel,
        targetLevel,
        language,
        { isPoetry: true, maxRetries: 3, adminStorySlug: slug }
      );

      // Convert stanza result back to flat text, preserving vertical spacing
      const rewrittenText = joinStanzasWithSpacing(
        stanzaResult.rewrittenStanzas,
        stanzaResult.blankLinesBefore
      );

      if (!stanzaResult.wasRewritten && effectiveSourceLevel !== targetLevel) {
        return NextResponse.json(
          {
            error: "AI could not process this poetry chunk. It may be empty or contain only non-story content.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        rewrittenText,
        targetLevel,
        wasRewritten: stanzaResult.wasRewritten,
        originalLength: text.length,
        rewrittenLength: rewrittenText.length,
        // Include stanza validation info for debugging
        stanzaValidation: stanzaResult.allStanzasValid ? undefined : stanzaResult.stanzaValidation,
      });
    }

    // For prose, use standard rewriting
    const result: RewriteResult = await rewriteToLevel(
      text,
      effectiveSourceLevel,
      targetLevel,
      language,
      { isPoetry: false, maxRetries: 2, adminStorySlug: slug }
    );

    if (!result.wasRewritten && effectiveSourceLevel !== targetLevel) {
      return NextResponse.json(
        {
          error: "AI could not process this text chunk. It may be empty or contain only non-story content.",
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

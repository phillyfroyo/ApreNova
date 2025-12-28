// src/app/api/admin/rewrite-level/route.ts
// Admin rewrite API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import { rewriteToLevel, type RewriteResult } from "@/lib/story-processing";

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLanguage, targetLevel, sourceLevel, isPoetry } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!targetLevel || targetLevel < 1 || targetLevel > 6) {
      return NextResponse.json(
        { error: "Valid target level (1-6) is required" },
        { status: 400 }
      );
    }

    // Use the shared rewrite function
    const result: RewriteResult = await rewriteToLevel(
      text,
      sourceLevel || targetLevel, // If no source level, assume same as target (no rewrite)
      targetLevel,
      sourceLanguage || "en",
      isPoetry ?? false
    );

    if (!result.wasRewritten && sourceLevel !== targetLevel) {
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

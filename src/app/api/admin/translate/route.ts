// src/app/api/admin/translate/route.ts
// Admin translation API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import {
  translateText,
  type TranslationResult,
} from "@/lib/story-processing";

export async function POST(req: NextRequest) {
  try {
    const { text, fromLanguage, level, slug, sessionId, isPoetry } = await req.json();

    console.log(`[/api/admin/translate] Received: L${level}, ${fromLanguage}, ${text?.length || 0} chars, poetry=${isPoetry}, slug=${slug}`);

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!fromLanguage || !["en", "es"].includes(fromLanguage)) {
      return NextResponse.json(
        { error: "Valid fromLanguage (en/es) is required" },
        { status: 400 }
      );
    }

    if (!level || level < 1 || level > 6) {
      return NextResponse.json(
        { error: "Valid level (1-6) is required" },
        { status: 400 }
      );
    }

    // Use the shared translation function with cost tracking
    // Pass isPoetry flag for poetry-specific translation prompts (rhyme, rhythm, etc.)
    const result: TranslationResult = await translateText(
      text,
      fromLanguage as "en" | "es",
      level,
      { adminStorySlug: slug, adminSessionId: sessionId, isPoetry: isPoetry === true }
    );

    console.log(`[/api/admin/translate] Success: L${level}, ${result.alignment.translatedLines}/${result.alignment.contentLines} lines, truncated=${result.truncated}`);

    return NextResponse.json({
      translatedText: result.translatedText,
      fromLanguage,
      toLanguage: fromLanguage === "en" ? "es" : "en",
      level,
      alignment: result.alignment,
      truncated: result.truncated,
      truncationInfo: result.truncationInfo,
    });
  } catch (error) {
    // Log the full error with stack trace for terminal diagnostics
    console.error(`[/api/admin/translate] ERROR:`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[/api/admin/translate] Stack:`, error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to translate text",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

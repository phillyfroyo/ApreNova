// src/app/api/admin/translate/route.ts
// Admin translation API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import {
  translateText,
  type TranslationResult,
} from "@/lib/story-processing";

export async function POST(req: NextRequest) {
  try {
    const { text, fromLanguage, level, slug } = await req.json();

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
    const result: TranslationResult = await translateText(
      text,
      fromLanguage as "en" | "es",
      level,
      { adminStorySlug: slug }
    );

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
    console.error("Translation error:", error);
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

// src/app/api/admin/detect-level/route.ts
// Admin CEFR level detection API using the shared story-processing library

import { NextRequest, NextResponse } from "next/server";
import { detectCEFRLevel, type CEFRDetectionResult } from "@/lib/story-processing";

export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Use the shared detection function
    const result: CEFRDetectionResult = await detectCEFRLevel(
      text,
      (language || "en") as "en" | "es"
    );

    return NextResponse.json({
      level: result.level,
      levelString: result.levelString,
      cefr: result.cefr,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error("CEFR detection error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to detect level",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

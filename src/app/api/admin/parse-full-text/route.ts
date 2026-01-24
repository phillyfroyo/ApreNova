// src/app/api/admin/parse-full-text/route.ts
// Uses algorithmic preprocessing - no AI needed for main parsing
// AI is only used optionally for per-chapter gloss extraction

import { NextRequest, NextResponse } from "next/server";
import { preprocessText } from "@/lib/admin/text-preprocessor";

// Use Edge runtime for faster cold starts (~100ms vs ~60s for Node.js)
// This route only uses pure JS text processing - no Node.js-specific APIs needed
export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { rawText, structureType } = await request.json();

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json(
        { error: "rawText is required" },
        { status: 400 }
      );
    }

    // No size limit for algorithmic processing - it's fast and free
    // Just a sanity check for extremely large files
    if (rawText.length > 5000000) { // 5MB
      return NextResponse.json(
        { error: "File too large. Maximum 5MB." },
        { status: 400 }
      );
    }

    // Run algorithmic preprocessing
    // Pass structureType to control marker preservation (anthologies keep "I. LIFE." etc.)
    const result = preprocessText(rawText, {
      structureType: structureType || "auto"
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error preprocessing text:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preprocess text" },
      { status: 500 }
    );
  }
}

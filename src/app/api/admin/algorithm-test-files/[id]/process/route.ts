// src/app/api/admin/algorithm-test-files/[id]/process/route.ts
// API for running the processing algorithm on a test file

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processFile,
  type FileType,
  type StoryType,
} from "@/lib/story-processing/text-processors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Run algorithm on file and store result
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get the file
    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Run the processing algorithm
    const startTime = Date.now();
    const result = processFile(
      file.rawContent,
      file.fileType as FileType,
      file.storyType as StoryType
    );
    const processingTimeMs = Date.now() - startTime;

    // Store the result - serialize as JSON-compatible object
    const processingResultJson = JSON.parse(JSON.stringify({
      ...result,
      processingTimeMs,
    }));

    const updated = await prisma.algorithmTestFile.update({
      where: { id },
      data: {
        lastProcessedAt: new Date(),
        processingResult: processingResultJson,
      },
    });

    return NextResponse.json({
      success: true,
      processingTimeMs,
      result,
      file: {
        id: updated.id,
        fileName: updated.fileName,
        lastProcessedAt: updated.lastProcessedAt,
      },
    });
  } catch (error) {
    console.error("[algorithm-test-files/[id]/process] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to process test file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

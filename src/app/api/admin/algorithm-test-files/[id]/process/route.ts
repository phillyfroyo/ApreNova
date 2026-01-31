// src/app/api/admin/algorithm-test-files/[id]/process/route.ts
// API for running the processing algorithm on a test file

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processText,
  type FileType,
  type ContentType,
} from "@/lib/text-processing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Run algorithm on file and store result in AlgorithmTestResult table
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
    const result = processText(file.rawContent, {
      fileType: file.fileType as FileType,
      contentType: file.storyType as ContentType,
    });
    const processingTimeMs = Date.now() - startTime;

    // Store the result in the new results table
    const processingResultJson = JSON.parse(JSON.stringify(result));

    const testResult = await prisma.algorithmTestResult.create({
      data: {
        fileId: id,
        result: processingResultJson,
        processingTimeMs,
      },
    });

    return NextResponse.json({
      success: true,
      processingTimeMs,
      result,
      resultId: testResult.id,
      createdAt: testResult.createdAt,
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

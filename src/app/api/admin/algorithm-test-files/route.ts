// src/app/api/admin/algorithm-test-files/route.ts
// API for listing and creating algorithm test files

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { FileType, StoryType } from "@/lib/story-processing/text-processors";

// GET: List test files (filtered by fileType and storyType)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileType = searchParams.get("fileType") as FileType | null;
    const storyType = searchParams.get("storyType") as StoryType | null;

    // Build where clause
    const where: { fileType?: string; storyType?: string } = {};
    if (fileType) where.fileType = fileType;
    if (storyType) where.storyType = storyType;

    const files = await prisma.algorithmTestFile.findMany({
      where,
      select: {
        id: true,
        fileType: true,
        storyType: true,
        fileName: true,
        fileSizeBytes: true,
        lastProcessedAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // Don't include rawContent or processingResult in list (too large)
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[algorithm-test-files] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list test files" },
      { status: 500 }
    );
  }
}

// POST: Create a new test file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileType, storyType, fileName, rawContent, notes } = body;

    // Validate required fields
    if (!fileType || !storyType || !fileName || !rawContent) {
      return NextResponse.json(
        { error: "Missing required fields: fileType, storyType, fileName, rawContent" },
        { status: 400 }
      );
    }

    // Validate fileType
    const validFileTypes = ["html", "txt", "rtf", "md"];
    if (!validFileTypes.includes(fileType)) {
      return NextResponse.json(
        { error: `Invalid fileType: ${fileType}. Must be one of: ${validFileTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate storyType
    const validStoryTypes = ["anthology", "prose", "epic", "script"];
    if (!validStoryTypes.includes(storyType)) {
      return NextResponse.json(
        { error: `Invalid storyType: ${storyType}. Must be one of: ${validStoryTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if file already exists
    const existing = await prisma.algorithmTestFile.findUnique({
      where: {
        fileType_storyType_fileName: {
          fileType,
          storyType,
          fileName,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `File already exists: ${fileName} in ${fileType}/${storyType}` },
        { status: 409 }
      );
    }

    // Create the file
    const file = await prisma.algorithmTestFile.create({
      data: {
        fileType,
        storyType,
        fileName,
        rawContent,
        fileSizeBytes: Buffer.byteLength(rawContent, "utf8"),
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        fileType: file.fileType,
        storyType: file.storyType,
        fileName: file.fileName,
        fileSizeBytes: file.fileSizeBytes,
        notes: file.notes,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    console.error("[algorithm-test-files] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create test file" },
      { status: 500 }
    );
  }
}

// src/app/api/admin/algorithm-test-files/[id]/route.ts
// API for single file operations (get, delete)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get full file with content
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error("[algorithm-test-files/[id]] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get test file" },
      { status: 500 }
    );
  }
}

// DELETE: Delete file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    await prisma.algorithmTestFile.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deletedFile: {
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        storyType: file.storyType,
      },
    });
  } catch (error) {
    console.error("[algorithm-test-files/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete test file" },
      { status: 500 }
    );
  }
}

// PATCH: Update file notes
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { notes } = body;

    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.algorithmTestFile.update({
      where: { id },
      data: { notes },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: updated.id,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("[algorithm-test-files/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update test file" },
      { status: 500 }
    );
  }
}

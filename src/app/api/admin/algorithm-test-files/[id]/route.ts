// src/app/api/admin/algorithm-test-files/[id]/route.ts
// API for single file operations (get, delete)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get full file with content and results history
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
      include: {
        results: {
          orderBy: { createdAt: "desc" },
          take: 10, // Limit to last 10 results
        },
      },
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

// PATCH: Update file (notes, fileName)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { notes, fileName } = body;

    const file = await prisma.algorithmTestFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // If renaming, check for conflicts
    if (fileName && fileName !== file.fileName) {
      const existing = await prisma.algorithmTestFile.findUnique({
        where: {
          fileType_storyType_fileName: {
            fileType: file.fileType,
            storyType: file.storyType,
            fileName,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `A file named "${fileName}" already exists in this category` },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: { notes?: string | null; fileName?: string } = {};
    if (notes !== undefined) updateData.notes = notes;
    if (fileName) updateData.fileName = fileName;

    const updated = await prisma.algorithmTestFile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      file: {
        id: updated.id,
        fileName: updated.fileName,
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

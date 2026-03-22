// src/app/api/user-stories/[storyId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

// GET: Get specific user story details
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;

    // Use select to exclude rawContent (can be very large)
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        titleEs: true,
        titleEn: true,
        description: true,
        descriptionEs: true,
        descriptionEn: true,
        sourceLanguage: true,
        detectedLevel: true,
        thumbnailUrl: true,
        storyType: true,
        targetAudience: true,
        tags: true,
        hook: true,
        hookEs: true,
        hookEn: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        UserStoryLevel: {
          select: {
            id: true,
            level: true,
            status: true,
            processingProgress: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { level: "asc" },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Map UserStoryLevel to levels for frontend compatibility
    const { UserStoryLevel, ...rest } = story;
    const storyWithLevels = { ...rest, levels: UserStoryLevel };

    return NextResponse.json({ story: storyWithLevels });
  } catch (error: any) {
    console.error("[API/user-stories/[storyId]] GET error:", {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json(
      { error: "Failed to fetch story" },
      { status: 500 }
    );
  }
}

// DELETE: Delete user story
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;

    // Verify ownership
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Calculate total API cost for this story before deletion
    const storyCost = await prisma.apiCost.aggregate({
      where: { userStoryId: storyId },
      _sum: { costCents: true },
    });
    const costCents = storyCost._sum.costCents || 0;

    // Create deleted story record to preserve cost data for analytics
    if (costCents > 0) {
      const wordCount = story.rawContent.trim().split(/\s+/).filter(Boolean).length;
      await prisma.deletedUserStory.create({
        data: {
          userId: session.user.id,
          originalStoryId: storyId,
          costCents,
          storyType: story.storyType,
          wordCount,
        },
      });
    }

    // Delete associated ApiCost records (aggregate is preserved in DeletedUserStory)
    await prisma.apiCost.deleteMany({
      where: { userStoryId: storyId },
    });

    // Delete story (cascades to levels and bookmarks)
    await prisma.userStory.delete({
      where: { id: storyId },
    });

    return NextResponse.json({ success: true, message: "Story deleted" });
  } catch (error) {
    console.error("Error deleting user story:", error);
    return NextResponse.json(
      { error: "Failed to delete story" },
      { status: 500 }
    );
  }
}

// PATCH: Update story metadata (title, description, and all new metadata fields)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const body = await req.json();
    const {
      title,
      description,
      titleEs,
      titleEn,
      descriptionEs,
      descriptionEn,
      thumbnailUrl,
      storyType,
      targetAudience,
      tags,
      hook,
      hookEs,
      hookEn,
    } = body;

    // Verify ownership
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Build update object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (titleEs !== undefined) updateData.titleEs = titleEs;
    if (titleEn !== undefined) updateData.titleEn = titleEn;
    if (descriptionEs !== undefined) updateData.descriptionEs = descriptionEs;
    if (descriptionEn !== undefined) updateData.descriptionEn = descriptionEn;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (storyType !== undefined) updateData.storyType = storyType;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (tags !== undefined) updateData.tags = tags;
    if (hook !== undefined) updateData.hook = hook;
    if (hookEs !== undefined) updateData.hookEs = hookEs;
    if (hookEn !== undefined) updateData.hookEn = hookEn;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updatedStory = await prisma.userStory.update({
      where: { id: storyId },
      data: updateData,
    });

    return NextResponse.json({ success: true, story: updatedStory });
  } catch (error) {
    console.error("Error updating user story:", error);
    return NextResponse.json(
      { error: "Failed to update story" },
      { status: 500 }
    );
  }
}

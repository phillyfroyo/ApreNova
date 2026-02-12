// src/app/api/user-stories/[storyId]/submit-for-review/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ storyId: string }>;
}

// POST: Submit story for public review (premium only)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only premium users can submit for public review
    if (!session.user.isPremium) {
      return NextResponse.json(
        {
          error: "Upgrade your plan to submit stories for public review",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    const { storyId } = await params;

    // Verify ownership and that story is ready
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.status !== "READY") {
      return NextResponse.json(
        { error: "Story must be fully processed before submitting for review" },
        { status: 400 }
      );
    }

    if (story.visibility === "SUBMITTED" || story.visibility === "PUBLIC") {
      return NextResponse.json(
        { error: "Story has already been submitted or is already public" },
        { status: 400 }
      );
    }

    // Update visibility to SUBMITTED
    const updatedStory = await prisma.userStory.update({
      where: { id: storyId },
      data: {
        visibility: "SUBMITTED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Story submitted for review. You'll be notified when it's reviewed.",
      story: {
        id: updatedStory.id,
        visibility: updatedStory.visibility,
      },
    });
  } catch (error) {
    console.error("Error submitting story for review:", error);
    return NextResponse.json(
      { error: "Failed to submit story for review" },
      { status: 500 }
    );
  }
}

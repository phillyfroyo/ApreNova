// src/app/api/user-stories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/stories";
import {
  canCreateStory,
  canProcessToday,
  validateContentLength,
} from "@/lib/user-stories/access-control";
import { ALL_CEFR_LEVELS } from "@/lib/cefr";

// GET: List user's stories
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");

    const where: any = { userId: session.user.id };
    if (status) where.status = status;
    if (visibility) where.visibility = visibility;

    // Use select to exclude rawContent (can be very large)
    const stories = await prisma.userStory.findMany({
      where,
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
            level: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map UserStoryLevel to levels for frontend compatibility
    const storiesWithLevels = stories.map(({ UserStoryLevel, ...rest }) => ({
      ...rest,
      levels: UserStoryLevel,
    }));

    return NextResponse.json({ stories: storiesWithLevels });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}

// POST: Create new story
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("[API/user-stories] POST: Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, sourceLanguage, description } = body;

    console.log("[API/user-stories] POST: Creating story", {
      userId: session.user.id,
      contentLength: content?.length || 0,
      title: title || "(auto-generate)",
      sourceLanguage: sourceLanguage || "(auto-detect)",
    });

    // Validate required fields - only content is required now
    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    // Use provided values or defaults (will be auto-detected in pipeline)
    const finalTitle = title || "Untitled Story";
    const finalSourceLanguage = sourceLanguage && ["en", "es"].includes(sourceLanguage)
      ? sourceLanguage
      : "es"; // Default to Spanish, will be auto-detected

    const isPremium = session.user.isPremium ?? false;

    // Check story count limit
    const canCreate = await canCreateStory(session.user.id, isPremium);
    if (!canCreate.allowed) {
      console.log("[API/user-stories] POST: Story limit reached", canCreate);
      return NextResponse.json(
        {
          error: canCreate.reason,
          currentCount: canCreate.currentCount,
          maxCount: canCreate.maxCount,
        },
        { status: 403 }
      );
    }

    // Check daily processing limit
    const canProcess = await canProcessToday(session.user.id, isPremium);
    if (!canProcess.allowed) {
      console.log("[API/user-stories] POST: Daily limit reached", canProcess);
      return NextResponse.json(
        {
          error: canProcess.reason,
          currentCount: canProcess.currentCount,
          maxCount: canProcess.maxCount,
        },
        { status: 429 }
      );
    }

    // Validate content length
    const contentValid = validateContentLength(content, isPremium);
    if (!contentValid.allowed) {
      console.log("[API/user-stories] POST: Content too long", contentValid);
      return NextResponse.json(
        {
          error: contentValid.reason,
          currentLength: contentValid.currentCount,
          maxLength: contentValid.maxCount,
        },
        { status: 400 }
      );
    }

    // Generate unique slug
    let baseSlug = slugify(finalTitle);
    let slug = baseSlug;
    let counter = 1;

    // Check for existing slug and make unique if needed
    while (true) {
      const existing = await prisma.userStory.findUnique({
        where: {
          userId_slug: {
            userId: session.user.id,
            slug,
          },
        },
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create the story with initial progress
    const story = await prisma.userStory.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        slug,
        title: finalTitle,
        description: description || null,
        sourceLanguage: finalSourceLanguage,
        rawContent: content,
        status: "PROCESSING",
        visibility: "PRIVATE",
        updatedAt: new Date(),
        processingProgress: {
          phase: "detecting",
          step: "creating_record",
          stepLabel: "Creating story record",
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Create placeholder level records for all CEFR levels (A1-C1)
    const levels = ALL_CEFR_LEVELS.slice(0, 5); // A1, A2, B1, B2, C1
    await prisma.userStoryLevel.createMany({
      data: levels.map((level) => ({
        id: randomUUID(),
        userStoryId: story.id,
        level,
        content: {},
        status: "PENDING",
        updatedAt: new Date(),
      })),
    });

    // Update progress after creating levels
    await prisma.userStory.update({
      where: { id: story.id },
      data: {
        processingProgress: {
          phase: "detecting",
          step: "creating_levels",
          stepLabel: "Preparing reading levels",
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log("[API/user-stories] POST: Story created", {
      storyId: story.id,
      slug: story.slug,
    });

    // Note: Processing is triggered separately via POST /api/user-stories/process
    // This allows the client to control when processing starts

    return NextResponse.json({
      success: true,
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        status: story.status,
      },
      message: "Story created. Processing will begin shortly.",
    });
  } catch (error: any) {
    console.error("[API/user-stories] POST: Error creating story:", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }
}

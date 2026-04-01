// src/app/api/story-bookmark/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// GET: Retrieve bookmark for a specific story
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const storySlug = searchParams.get("storySlug");

    if (!storySlug) {
      return NextResponse.json({ error: "Missing storySlug" }, { status: 400 });
    }

    const bookmark = await prisma.storyBookmark.findUnique({
      where: {
        userId_storySlug: {
          userId: session.user.id,
          storySlug,
        },
      },
    });

    if (!bookmark) {
      return NextResponse.json({ bookmark: null });
    }

    return NextResponse.json({
      bookmark: {
        level: bookmark.level,
        chapter: bookmark.chapter,
        page: bookmark.page,
      },
    });
  } catch (error) {
    console.error("Error retrieving bookmark:", error);
    return NextResponse.json(
      { error: "Failed to retrieve bookmark" },
      { status: 500 }
    );
  }
}

// POST: Save or update bookmark
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storySlug, level, chapter, page } = body;

    if (!storySlug || !level || chapter === undefined || page === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const bookmark = await prisma.storyBookmark.upsert({
      where: {
        userId_storySlug: {
          userId: session.user.id,
          storySlug,
        },
      },
      update: {
        level,
        chapter,
        page,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        storySlug,
        level,
        chapter,
        page,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, bookmark });
  } catch (error) {
    console.error("Error saving bookmark:", error);
    return NextResponse.json(
      { error: "Failed to save bookmark" },
      { status: 500 }
    );
  }
}

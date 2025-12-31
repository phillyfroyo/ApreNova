// src/app/api/page-visit/route.ts
// Record unique page visits for tracking words read

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// POST: Record a page visit (idempotent - won't duplicate)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storySlug, level, chapter, page, wordCount } = body;

    if (!storySlug || !level || chapter === undefined || page === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upsert to avoid duplicates - only records first visit
    const pageVisit = await prisma.pageVisit.upsert({
      where: {
        userId_storySlug_level_chapter_page: {
          userId: session.user.id,
          storySlug,
          level,
          chapter,
          page,
        },
      },
      update: {}, // Don't update anything on subsequent visits
      create: {
        userId: session.user.id,
        storySlug,
        level,
        chapter,
        page,
        wordCount: wordCount || 0,
      },
    });

    return NextResponse.json({ success: true, isNew: pageVisit.createdAt.getTime() > Date.now() - 1000 });
  } catch (error) {
    console.error("Error recording page visit:", error);
    return NextResponse.json(
      { error: "Failed to record page visit" },
      { status: 500 }
    );
  }
}

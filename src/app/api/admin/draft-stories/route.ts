import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const drafts = await prisma.draftStory.findMany({
    select: { id: true, title: true, audioUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(drafts);
}

export async function POST(request: Request) {
  const { title, content } = await request.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }
  const draft = await prisma.draftStory.create({
    data: { title: title.trim(), content },
  });
  return NextResponse.json(draft);
}

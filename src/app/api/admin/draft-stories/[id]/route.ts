import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTTSCacheService } from "@/lib/tts-cache";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.draftStory.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.audioTimestamp === "number") data.audioTimestamp = body.audioTimestamp;
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });
    const draft = await prisma.draftStory.update({ where: { id }, data });
    return NextResponse.json(draft);
  } catch (err) {
    console.error("[draft-stories] PATCH error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.draftStory.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (draft.audioUrl) {
    const cache = getTTSCacheService();
    await cache.deleteDraftAudio(id);
  }
  await prisma.draftStory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

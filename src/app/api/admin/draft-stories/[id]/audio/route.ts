import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAzureSpeechService } from "@/lib/azure-speech";
import type { ChapterSSMLSegment } from "@/lib/azure-speech";
import { getTTSCacheService } from "@/lib/tts-cache";

const MAX_CHUNK_CHARS = 7500;
const VOICE = "en-US-BrianMultilingualNeural";

function textToSegments(content: string): ChapterSSMLSegment[] {
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  const segments: ChapterSSMLSegment[] = [];

  for (const paragraph of paragraphs) {
    const text = paragraph.replace(/\n/g, " ").trim();
    if (!text) continue;
    segments.push({
      text,
      language: "en-US",
      voice: VOICE,
      rate: 1.0,
      ssmlLang: "en-US",
      contentLang: "en",
      breakBeforeMs: segments.length === 0 ? 0 : 400,
    });
  }
  return segments;
}

function chunkSegments(segments: ChapterSSMLSegment[]): ChapterSSMLSegment[][] {
  const chunks: ChapterSSMLSegment[][] = [];
  let current: ChapterSSMLSegment[] = [];
  let chars = 0;

  for (const seg of segments) {
    if (chars + seg.text.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    if (current.length === 0 && chunks.length > 0) {
      current.push({ ...seg, breakBeforeMs: 0 });
    } else {
      current.push(seg);
    }
    chars += seg.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.draftStory.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const segments = textToSegments(draft.content);
  if (segments.length === 0) {
    return NextResponse.json({ error: "No speakable content" }, { status: 400 });
  }

  const chunks = chunkSegments(segments);
  const speech = getAzureSpeechService();
  const audioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[draft-tts] chunk ${i + 1}/${chunks.length}: ${chunks[i].reduce((s, seg) => s + seg.text.length, 0)} chars`);
    const result = await speech.generateChapterBuffer(chunks[i]);
    audioBuffers.push(Buffer.from(result.buffer));
  }

  const finalBuffer = Buffer.concat(audioBuffers);
  const cache = getTTSCacheService();
  const audioUrl = await cache.saveDraftAudio(id, finalBuffer);

  await prisma.draftStory.update({
    where: { id },
    data: { audioUrl: `${audioUrl}?v=${Date.now()}`, audioTimestamp: 0 },
  });

  console.log(`[draft-tts] Generated ${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)}MB audio for "${draft.title}"`);
  return NextResponse.json({ audioUrl: `${audioUrl}?v=${Date.now()}` });
}

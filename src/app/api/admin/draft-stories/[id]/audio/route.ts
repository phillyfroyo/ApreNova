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

  try {
  // Synthesize chunks sequentially — more reliable than parallel with Azure TTS.
  const CHUNK_TIMEOUT_MS = 120_000; // 2 min per chunk
  const startTime = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const chunkStart = Date.now();
    console.log(`[draft-tts] chunk ${i + 1}/${chunks.length}: ${chunks[i].reduce((s, seg) => s + seg.text.length, 0)} chars`);

    const result = await Promise.race([
      speech.generateChapterBuffer(chunks[i]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Chunk ${i + 1} timed out after 120s`)), CHUNK_TIMEOUT_MS)
      ),
    ]);
    audioBuffers.push(Buffer.from(result.buffer));
    console.log(`[draft-tts] chunk ${i + 1}/${chunks.length} done in ${((Date.now() - chunkStart) / 1000).toFixed(1)}s`);
  }

  const finalBuffer = Buffer.concat(audioBuffers);
  console.log(`[draft-tts] All chunks done in ${((Date.now() - startTime) / 1000).toFixed(1)}s, total ${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Uploading to R2...`);

  const cache = getTTSCacheService();
  const audioUrl = await cache.saveDraftAudio(id, finalBuffer);
  console.log(`[draft-tts] R2 upload done. Updating DB...`);

  await prisma.draftStory.update({
    where: { id },
    data: { audioUrl: `${audioUrl}?v=${Date.now()}`, audioTimestamp: 0 },
  });

  console.log(`[draft-tts] Complete for "${draft.title}"`);
  return NextResponse.json({ audioUrl: `${audioUrl}?v=${Date.now()}` });

  } catch (err: any) {
    console.error(`[draft-tts] Failed:`, err.message);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}

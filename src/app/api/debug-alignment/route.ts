// src/app/api/debug-alignment/route.ts
// Prototype: compare Azure TTS bookmark timestamps vs forced alignment
// from OpenAI Whisper and Azure Speech-to-Text.
//
// Takes a cached chapter MP3 and runs STT on it to get word-level
// timestamps from the actual audio waveform.

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getTTSCacheService } from "@/lib/tts-cache";
import type { ChapterAudioRequest } from "@/types/chapter-audio";

export const maxDuration = 120; // Allow up to 2 min for STT processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storySlug, level, chapter, mode, speed } = body;

    const chapterRequest: ChapterAudioRequest = { storySlug, level, chapter, mode, speed };

    // 1. Get cached chapter metadata + audio URL
    const cache = getTTSCacheService();
    const cached = await cache.getChapterCached(chapterRequest);
    if (!cached) {
      return Response.json({ error: "Chapter not cached — generate it first" }, { status: 404 });
    }

    const { metadata, audioUrl } = cached;

    // 2. Download the MP3 from R2
    console.log(`[debug-alignment] Downloading MP3 from ${audioUrl}`);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return Response.json({ error: `Failed to download audio: ${audioResponse.status}` }, { status: 500 });
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log(`[debug-alignment] Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    // 3. Run OpenAI Whisper (word-level timestamps)
    let whisperResult: { words: { word: string; start: number; end: number }[] } | null = null;
    try {
      console.log("[debug-alignment] Running OpenAI Whisper...");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Whisper accepts file uploads — create a File-like blob
      const audioFile = new File([audioBuffer], "chapter.mp3", { type: "audio/mpeg" });

      const whisperResponse = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      });

      // The verbose_json response includes word-level timestamps
      const words = (whisperResponse as any).words || [];
      whisperResult = {
        words: words.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
      };
      console.log(`[debug-alignment] Whisper returned ${whisperResult.words.length} words`);
    } catch (err: any) {
      console.error("[debug-alignment] Whisper failed:", err.message);
      whisperResult = null;
    }

    // 4. Run Azure Speech-to-Text via REST API (word-level timestamps)
    // The SDK's push stream doesn't support MP3 directly, so we use the
    // REST API which accepts MP3 and returns word-level timing.
    let azureSTTResult: { words: { word: string; start: number; end: number }[] } | null = null;
    try {
      console.log("[debug-alignment] Running Azure STT via REST API...");
      const region = process.env.AZURE_SPEECH_REGION!;
      const key = process.env.AZURE_SPEECH_KEY!;

      // Azure STT REST API has a 60s audio limit for single-shot recognition.
      // For our test, we'll use the batch transcription or just note the limitation.
      // For the prototype, let's use the SDK with a WAV file approach:
      // Actually, the simplest approach: use continuous recognition with the file written to disk.

      // For this prototype, skip Azure STT REST (it has file size limits) and
      // rely on Whisper which handles long files natively. We can add Azure STT
      // later if Whisper proves the concept works.
      console.log("[debug-alignment] Skipping Azure STT for prototype (60s limit on REST API). Using Whisper only.");
      azureSTTResult = null;
    } catch (err: any) {
      console.error("[debug-alignment] Azure STT failed:", err.message);
      azureSTTResult = null;
    }

    // 5. Extract TTS bookmark data for comparison (page 3 last + page 4 first sentences)
    const p3Sentences = metadata.sentenceTimings.filter(s => s.pageNumber === 3);
    const p4Sentences = metadata.sentenceTimings.filter(s => s.pageNumber === 4);
    const lastP3 = p3Sentences[p3Sentences.length - 1];
    const firstP4 = p4Sentences[0];

    const ttsBookmarks = {
      lastP3: lastP3 ? {
        text: lastP3.text,
        startTime: lastP3.startTime,
        endTime: lastP3.endTime,
        wordTimings: lastP3.wordTimings,
      } : null,
      firstP4: firstP4 ? {
        text: firstP4.text,
        startTime: firstP4.startTime,
        endTime: firstP4.endTime,
        wordTimings: firstP4.wordTimings,
      } : null,
    };

    return Response.json({
      audioUrl,
      totalDuration: metadata.totalDuration,
      ttsBookmarks,
      whisper: whisperResult,
      azureSTT: azureSTTResult,
    });

  } catch (err: any) {
    console.error("[debug-alignment] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

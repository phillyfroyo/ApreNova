// src/app/api/azure-tts/chapter/route.ts
// Streams NDJSON progress during chapter audio generation.
// Final line contains { type: "complete", audioUrl, metadata }.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from "@/lib/rate-limiter";
import { generateChapterAudio } from "@/lib/chapter-audio";
import { getTTSCacheService } from "@/lib/tts-cache";
import type { ChapterAudioRequest, ChapterAudioMode } from "@/types/chapter-audio";
import type { TTSSpeed } from "@/types/azure-tts";

const VALID_MODES: ChapterAudioMode[] = ["en", "es", "bilingual-en", "bilingual-es"];
const VALID_SPEEDS: TTSSpeed[] = ["normal", "slow"];

export async function POST(request: NextRequest) {
  try {
    // Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rate limit (2 req/min — chapter gen is heavy)
    const rateLimiter = getRateLimiter("batch");
    const clientId = getClientIdentifier(request);
    const rateResult = rateLimiter.isAllowed(clientId);
    if (!rateResult.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...createRateLimitHeaders(rateResult.info),
        },
      });
    }

    // Parse and validate request
    const body = await request.json();
    const { storySlug, level, chapter, mode, speed } = body;

    if (!storySlug || typeof storySlug !== "string") {
      return new Response(JSON.stringify({ error: "Missing storySlug" }), { status: 400 });
    }
    if (!level || typeof level !== "string") {
      return new Response(JSON.stringify({ error: "Missing level" }), { status: 400 });
    }
    if (typeof chapter !== "number" || chapter < 1) {
      return new Response(JSON.stringify({ error: "Invalid chapter" }), { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return new Response(JSON.stringify({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }), { status: 400 });
    }
    if (!VALID_SPEEDS.includes(speed)) {
      return new Response(JSON.stringify({ error: `Invalid speed. Must be one of: ${VALID_SPEEDS.join(", ")}` }), { status: 400 });
    }

    const chapterRequest: ChapterAudioRequest = { storySlug, level, chapter, mode, speed };

    // Quick check: if already cached, return immediately (no streaming needed)
    const cache = getTTSCacheService();
    const cached = await cache.getChapterCached(chapterRequest);
    if (cached) {
      return new Response(
        JSON.stringify({ type: "complete", audioUrl: cached.audioUrl, metadata: cached.metadata, cached: true }) + "\n",
        {
          status: 200,
          headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
            ...createRateLimitHeaders(rateResult.info),
          },
        }
      );
    }

    // Stream NDJSON progress
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await generateChapterAudio(chapterRequest, (progress) => {
            const line = JSON.stringify({ type: "progress", ...progress }) + "\n";
            controller.enqueue(encoder.encode(line));
          });

          const completeLine = JSON.stringify({
            type: "complete",
            audioUrl: result.audioUrl,
            metadata: result.metadata,
            cached: result.cached,
          }) + "\n";
          controller.enqueue(encoder.encode(completeLine));
          controller.close();
        } catch (err: any) {
          const errorLine = JSON.stringify({
            type: "error",
            error: err.message || "Chapter generation failed",
          }) + "\n";
          controller.enqueue(encoder.encode(errorLine));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
        ...createRateLimitHeaders(rateResult.info),
      },
    });
  } catch (err: any) {
    console.error("[chapter/route] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

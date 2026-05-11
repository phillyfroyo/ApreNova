// src/app/api/azure-tts/chapter/route.ts
//
// Trigger chapter audio generation. Cache check returns the URL inline if
// the audio is already in R2. Otherwise creates an AudioGenerationJob and
// fires an Inngest event; the client polls
// /api/azure-tts/chapter/status?jobId=X for progress and the final URL.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRateLimiter, getClientIdentifier, createRateLimitHeaders } from "@/lib/rate-limiter";
import { getTTSCacheService } from "@/lib/tts-cache";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import type { ChapterAudioRequest, ChapterAudioMode } from "@/types/chapter-audio";
import type { TTSSpeed } from "@/types/azure-tts";

const VALID_MODES: ChapterAudioMode[] = ["en", "es", "bilingual-en", "bilingual-es"];
const VALID_SPEEDS: TTSSpeed[] = ["normal", "slow"];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

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
    const userId = session.user.id;

    // Cache hit → return the URL immediately, no job needed.
    const cache = getTTSCacheService();
    const cached = await cache.getChapterCached(chapterRequest);
    if (cached) {
      return new Response(
        JSON.stringify({
          status: "COMPLETE",
          audioUrl: cached.audioUrl,
          metadata: cached.metadata,
          cached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // De-duplicate concurrent requests for the same audio: if there's
    // already an in-flight job (this user or another) for the same params,
    // return its jobId so all callers poll the same job.
    const existingInflight = await prisma.audioGenerationJob.findFirst({
      where: {
        storySlug,
        level,
        chapter,
        mode,
        speed,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingInflight) {
      return new Response(
        JSON.stringify({ status: existingInflight.status, jobId: existingInflight.id }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    // Rate-limit new-job creation only. Returning an existing in-flight
    // job is cheap so we don't gate that path.
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

    // Create the job row, then fire the Inngest event.
    const job = await prisma.audioGenerationJob.create({
      data: {
        storySlug,
        level,
        chapter,
        mode,
        speed,
        status: "QUEUED",
        userId,
      },
    });

    await inngest.send({
      name: "audio/chapter.generate",
      data: { jobId: job.id, userId },
    });

    return new Response(
      JSON.stringify({ status: "QUEUED", jobId: job.id }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          ...createRateLimitHeaders(rateResult.info),
        },
      },
    );
  } catch (err: any) {
    console.error("[chapter/route] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

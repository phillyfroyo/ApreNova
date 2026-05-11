// src/app/api/azure-tts/chapter/status/route.ts
//
// Polled by the client during chapter audio generation. Returns the
// current state of an AudioGenerationJob. The job belongs to the user
// who initiated the generation (or to any user in the de-duplicated case
// — multiple users can share an in-flight job; we allow any authenticated
// user to read the status of any job since the audio URL is cached
// publicly anyway).

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { getTTSCacheService } from "@/lib/tts-cache";
import type { ChapterAudioRequest } from "@/types/chapter-audio";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return new Response(JSON.stringify({ error: "Missing jobId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const job = await prisma.audioGenerationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        totalSentences: true,
        sentencesComplete: true,
        totalChunks: true,
        chunksComplete: true,
        currentStep: true,
        audioUrl: true,
        errorMessage: true,
        // Needed to look up the metadata from R2 server-side on COMPLETE
        storySlug: true,
        level: true,
        chapter: true,
        mode: true,
        speed: true,
      },
    });

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // On COMPLETE, fetch the metadata server-side and include it inline
    // so the client doesn't need a cross-origin fetch to R2 (which CORS
    // blocks unless the R2 bucket is configured to allow it).
    let metadata = null;
    if (job.status === "COMPLETE" && job.audioUrl) {
      const cache = getTTSCacheService();
      const chapterRequest: ChapterAudioRequest = {
        storySlug: job.storySlug,
        level: job.level,
        chapter: job.chapter,
        mode: job.mode as ChapterAudioRequest["mode"],
        speed: job.speed as ChapterAudioRequest["speed"],
      };
      const cached = await cache.getChapterCached(chapterRequest);
      metadata = cached?.metadata ?? null;
    }

    return new Response(
      JSON.stringify({
        id: job.id,
        status: job.status,
        totalSentences: job.totalSentences,
        sentencesComplete: job.sentencesComplete,
        totalChunks: job.totalChunks,
        chunksComplete: job.chunksComplete,
        currentStep: job.currentStep,
        audioUrl: job.audioUrl,
        errorMessage: job.errorMessage,
        metadata,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (err: any) {
    console.error("[chapter/status/route] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

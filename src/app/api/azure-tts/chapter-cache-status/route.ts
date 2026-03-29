// src/app/api/azure-tts/chapter-cache-status/route.ts
// Returns cache status + generation time estimates for all audio variants of a chapter.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getTTSCacheService } from "@/lib/tts-cache";
import { prisma } from "@/lib/prisma";
import { loadChapterContent, buildSpeechPlan } from "@/lib/chapter-audio";
import type { ChapterAudioMode } from "@/types/chapter-audio";

const VALID_MODES: ChapterAudioMode[] = ["en", "es", "bilingual-en", "bilingual-es"];

/** Compute total character count for a mode+speed variant from chapter content. */
function getCharacterCount(
  pages: Awaited<ReturnType<typeof loadChapterContent>>,
  mode: ChapterAudioMode,
  speed: "normal" | "slow"
): number {
  const plan = buildSpeechPlan(pages, mode, speed);
  return plan.reduce((sum, entry) => sum + entry.text.length, 0);
}

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
    const storySlug = searchParams.get("storySlug");
    const level = searchParams.get("level");
    const chapterStr = searchParams.get("chapter");
    const targetMode = searchParams.get("targetMode") as ChapterAudioMode | null;
    const bilingualMode = searchParams.get("bilingualMode") as ChapterAudioMode | null;

    if (!storySlug || !level || !chapterStr || !targetMode || !bilingualMode) {
      return new Response(JSON.stringify({ error: "Missing required params: storySlug, level, chapter, targetMode, bilingualMode" }), { status: 400 });
    }

    const chapter = parseInt(chapterStr, 10);
    if (isNaN(chapter) || chapter < 1) {
      return new Response(JSON.stringify({ error: "Invalid chapter" }), { status: 400 });
    }
    if (!VALID_MODES.includes(targetMode) || !VALID_MODES.includes(bilingualMode)) {
      return new Response(JSON.stringify({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }), { status: 400 });
    }

    // Cache checks + average generation stats in parallel
    const cache = getTTSCacheService();
    const [targetNormal, targetSlow, bilingualNormal, bilingSlow, avgStats] = await Promise.all([
      cache.isChapterCached({ storySlug, level, chapter, mode: targetMode, speed: "normal" }),
      cache.isChapterCached({ storySlug, level, chapter, mode: targetMode, speed: "slow" }),
      cache.isChapterCached({ storySlug, level, chapter, mode: bilingualMode, speed: "normal" }),
      cache.isChapterCached({ storySlug, level, chapter, mode: bilingualMode, speed: "slow" }),
      // Sum of duration and characters grouped by mode+speed for accurate ms-per-char ratio
      prisma.ttsGenerationStat.groupBy({
        by: ["mode", "speed"],
        _sum: { generationDurationMs: true, totalCharacters: true },
      }),
    ]);

    // Build ms-per-character lookup from historical data (SUM/SUM for accuracy)
    const msPerChar: Record<string, number> = {};
    for (const stat of avgStats) {
      if (stat._sum.generationDurationMs && stat._sum.totalCharacters && stat._sum.totalCharacters > 0) {
        msPerChar[`${stat.mode}:${stat.speed}`] = stat._sum.generationDurationMs / stat._sum.totalCharacters;
      }
    }

    // Compute estimated generation times for uncached variants
    let estimates: Record<string, number | null> = {
      targetNormal: null,
      targetSlow: null,
      bilingualNormal: null,
      bilingualSlow: null,
    };

    // Only compute estimates if we have stats data and there are uncached variants
    const hasUncached = !targetNormal || !targetSlow || !bilingualNormal || !bilingSlow;
    const hasStats = Object.keys(msPerChar).length > 0;

    if (hasUncached && hasStats) {
      try {
        const pages = await loadChapterContent(storySlug, level, chapter);

        const computeEstimate = (mode: ChapterAudioMode, speed: "normal" | "slow", isCached: boolean): number | null => {
          if (isCached) return null; // No estimate needed
          const ratio = msPerChar[`${mode}:${speed}`];
          // Fall back to any available ratio if exact match isn't found
          const fallbackRatio = ratio ?? Object.values(msPerChar)[0];
          if (!fallbackRatio) return null;
          const chars = getCharacterCount(pages, mode, speed);
          return Math.round(fallbackRatio * chars);
        };

        estimates = {
          targetNormal: computeEstimate(targetMode, "normal", targetNormal),
          targetSlow: computeEstimate(targetMode, "slow", targetSlow),
          bilingualNormal: computeEstimate(bilingualMode, "normal", bilingualNormal),
          bilingualSlow: computeEstimate(bilingualMode, "slow", bilingSlow),
        };
      } catch (err) {
        // Content loading failed — skip estimates, not critical
        console.error("[chapter-cache-status] Failed to compute estimates:", err);
      }
    }

    return new Response(JSON.stringify({
      target: { normal: targetNormal, slow: targetSlow },
      bilingual: { normal: bilingualNormal, slow: bilingSlow },
      estimates,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[chapter-cache-status] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

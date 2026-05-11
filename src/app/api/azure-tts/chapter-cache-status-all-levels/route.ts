// src/app/api/azure-tts/chapter-cache-status-all-levels/route.ts
// Returns cache status + estimates + page count for ALL available levels of a chapter.
// Used by the SettingsPicker CEFR tabs so users can browse what's already cached at
// other CEFR levels instead of waiting for generation.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getTTSCacheService } from "@/lib/tts-cache";
import { prisma } from "@/lib/prisma";
import { loadChapterContent, buildSpeechPlan } from "@/lib/chapter-audio";
import { STORY_METADATA } from "@/lib/stories";
import type { ChapterAudioMode } from "@/types/chapter-audio";

const VALID_MODES: ChapterAudioMode[] = ["en", "es", "bilingual-en", "bilingual-es"];

interface LevelCacheEntry {
  target: { normal: boolean; slow: boolean };
  bilingual: { normal: boolean; slow: boolean };
  estimates: {
    targetNormal: number | null;
    targetSlow: number | null;
    bilingualNormal: number | null;
    bilingualSlow: number | null;
  };
  /** Total pages in this chapter at this level — used to clamp target page when jumping levels. */
  pageCount: number;
}

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
    const chapterStr = searchParams.get("chapter");
    const targetMode = searchParams.get("targetMode") as ChapterAudioMode | null;
    const bilingualMode = searchParams.get("bilingualMode") as ChapterAudioMode | null;
    const isUserStoryStr = searchParams.get("isUserStory");
    const userStoryId = searchParams.get("userStoryId");

    if (!storySlug || !chapterStr || !targetMode || !bilingualMode) {
      return new Response(JSON.stringify({ error: "Missing required params: storySlug, chapter, targetMode, bilingualMode" }), { status: 400 });
    }

    const chapter = parseInt(chapterStr, 10);
    if (isNaN(chapter) || chapter < 1) {
      return new Response(JSON.stringify({ error: "Invalid chapter" }), { status: 400 });
    }
    if (!VALID_MODES.includes(targetMode) || !VALID_MODES.includes(bilingualMode)) {
      return new Response(JSON.stringify({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }), { status: 400 });
    }

    const isUserStory = isUserStoryStr === "true";

    // ---- Discover which levels exist for this story ----
    let availableLevels: string[] = [];
    if (isUserStory) {
      if (!userStoryId) {
        return new Response(JSON.stringify({ error: "userStoryId required when isUserStory=true" }), { status: 400 });
      }
      const rows = await prisma.userStoryLevel.findMany({
        where: { userStoryId, status: { in: ["READY", "PROCESSING"] } },
        select: { level: true },
      });
      availableLevels = rows.map(r => r.level);
    } else {
      const meta = STORY_METADATA.find(s => s.slug === storySlug);
      availableLevels = meta?.levels ? [...meta.levels] : [];
    }

    if (availableLevels.length === 0) {
      return new Response(JSON.stringify({
        availableLevels: [],
        cacheStatusByLevel: {},
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ---- Historical msPerChar (shared across all levels) ----
    const avgStats = await prisma.ttsGenerationStat.groupBy({
      by: ["mode", "speed"],
      _sum: { generationDurationMs: true, totalCharacters: true },
    });
    const msPerChar: Record<string, number> = {};
    for (const stat of avgStats) {
      if (stat._sum.generationDurationMs && stat._sum.totalCharacters && stat._sum.totalCharacters > 0) {
        msPerChar[`${stat.mode}:${stat.speed}`] = stat._sum.generationDurationMs / stat._sum.totalCharacters;
      }
    }
    const hasStats = Object.keys(msPerChar).length > 0;

    // ---- Per-level cache lookups + estimates in parallel ----
    const cache = getTTSCacheService();
    const perLevel = await Promise.all(availableLevels.map(async (level): Promise<[string, LevelCacheEntry | null]> => {
      try {
        const [targetNormal, targetSlow, bilNormal, bilSlow] = await Promise.all([
          cache.isChapterCached({ storySlug, level, chapter, mode: targetMode, speed: "normal" }),
          cache.isChapterCached({ storySlug, level, chapter, mode: targetMode, speed: "slow" }),
          cache.isChapterCached({ storySlug, level, chapter, mode: bilingualMode, speed: "normal" }),
          cache.isChapterCached({ storySlug, level, chapter, mode: bilingualMode, speed: "slow" }),
        ]);

        let pageCount = 0;
        let estimates = {
          targetNormal: null as number | null,
          targetSlow: null as number | null,
          bilingualNormal: null as number | null,
          bilingualSlow: null as number | null,
        };

        // Built-in stories: estimates use loadChapterContent (which only works for built-in).
        // User stories: skip estimates for now (estimates are nice-to-have, not blocking).
        if (!isUserStory) {
          try {
            const pages = await loadChapterContent(storySlug, level, chapter);
            pageCount = pages.length;
            if (hasStats) {
              const compute = (mode: ChapterAudioMode, speed: "normal" | "slow", isCached: boolean): number | null => {
                if (isCached) return null;
                const altSpeed = speed === "normal" ? "slow" : "normal";
                const ratio = msPerChar[`${mode}:${speed}`] ?? msPerChar[`${mode}:${altSpeed}`];
                if (!ratio) return null;
                const chars = getCharacterCount(pages, mode, speed);
                return Math.round(ratio * chars);
              };
              estimates = {
                targetNormal: compute(targetMode, "normal", targetNormal),
                targetSlow: compute(targetMode, "slow", targetSlow),
                bilingualNormal: compute(bilingualMode, "normal", bilNormal),
                bilingualSlow: compute(bilingualMode, "slow", bilSlow),
              };
            }
          } catch {
            // Chapter doesn't exist at this level — skip
            return [level, null];
          }
        } else {
          // For user stories, derive page count from UserStoryLevel.content JSON.
          try {
            const levelData = await prisma.userStoryLevel.findUnique({
              where: { userStoryId_level: { userStoryId: userStoryId!, level } },
              select: { content: true },
            });
            const content = (levelData?.content ?? {}) as { chapters?: Record<string, { pages?: Record<string, unknown> }> };
            const chData = content.chapters?.[String(chapter)];
            pageCount = chData?.pages ? Object.keys(chData.pages).length : 0;
            if (pageCount === 0) return [level, null];
          } catch {
            return [level, null];
          }
        }

        return [level, {
          target: { normal: targetNormal, slow: targetSlow },
          bilingual: { normal: bilNormal, slow: bilSlow },
          estimates,
          pageCount,
        }];
      } catch {
        return [level, null];
      }
    }));

    const cacheStatusByLevel: Record<string, LevelCacheEntry> = {};
    const validLevels: string[] = [];
    for (const [level, entry] of perLevel) {
      if (entry) {
        cacheStatusByLevel[level] = entry;
        validLevels.push(level);
      }
    }

    return new Response(JSON.stringify({
      availableLevels: validLevels,
      cacheStatusByLevel,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[chapter-cache-status-all-levels] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

// src/components/user-stories/UserStoryReader.tsx
// Unified reader component for user stories
// Handles both complete content and pending/processing states

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
import ChapterPendingOverlay from "./ChapterPendingOverlay";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

interface StoryLine {
  es: string;
  en: string;
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
}

interface PoemNavInfo {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
}

interface ChapterMapInfo {
  chapter: number;
  pages: number[];
  title?: string;
  subtitle?: string;
  poems?: PoemNavInfo[];
}

interface StoryMapData {
  hasChapters: boolean;
  chapters: ChapterMapInfo[];
  structureType?: "prose" | "anthology" | "epic" | "script";
}

interface UserStoryReaderProps {
  // Story content
  storyId: string;
  storySlug: string;
  title: string;
  lines: StoryLine[];
  stanzas?: StoryLine[][];
  level: string;
  // Alignment warning
  chapterHasAlignmentIssues?: boolean;
  chapter: number;
  page: number;
  storyMap: StoryMapData;
  availableLevels: CEFRCode[];
  storyType: string | null;
  detectedLevel: string | null;
  structureType?: "prose" | "anthology" | "epic" | "script";
  lng: Language;
  // Processing state
  isProcessing?: boolean;
  chapterPending?: boolean;
  levelPending?: boolean;
  availableChapters?: number[];
  totalChapters?: number;
}

export default function UserStoryReader({
  storyId,
  storySlug,
  title,
  lines,
  stanzas,
  level,
  chapter,
  page,
  storyMap,
  availableLevels,
  storyType,
  detectedLevel,
  structureType,
  lng,
  chapterHasAlignmentIssues = false,
  isProcessing = false,
  chapterPending = false,
  levelPending = false,
  availableChapters = [],
  totalChapters = 0,
}: UserStoryReaderProps) {
  const router = useRouter();
  const [dismissedAlignmentWarning, setDismissedAlignmentWarning] = useState(false);
  const [currentChapterPending, setCurrentChapterPending] = useState(chapterPending || levelPending);
  const [currentAvailableChapters, setCurrentAvailableChapters] = useState(availableChapters);
  const [currentTotalChapters, setCurrentTotalChapters] = useState(totalChapters);

  // Sync state with props when they change (e.g., after navigation or server refresh)
  // This is critical because useState only uses initial value once
  useEffect(() => {
    const isPending = chapterPending || levelPending;
    setCurrentChapterPending(isPending);
    setCurrentAvailableChapters(availableChapters);
    setCurrentTotalChapters(totalChapters);
  }, [chapterPending, levelPending, availableChapters, totalChapters]);

  // Poll for chapter availability when chapter is pending
  useEffect(() => {
    if (!currentChapterPending || !isProcessing) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/user-stories/${storyId}/stream-map?level=${level}`);
        if (!res.ok) return;

        const data = await res.json();
        const newAvailable = data.chapters
          .filter((ch: { status: string }) => ch.status === "ready")
          .map((ch: { chapter: number }) => ch.chapter);

        setCurrentAvailableChapters(newAvailable);
        setCurrentTotalChapters(data.totalChapters || newAvailable.length);

        // Check if our chapter is now available
        if (newAvailable.includes(chapter)) {
          setCurrentChapterPending(false);
          // Refresh the page to get the new content
          router.refresh();
        }
      } catch (err) {
        console.error("[UserStoryReader] Failed to poll for chapter availability:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [currentChapterPending, isProcessing, storyId, level, chapter, router]);

  // Handle going back to last available chapter
  const handleGoBack = useCallback(() => {
    const lastAvailable = Math.max(...currentAvailableChapters, 1);
    router.push(`/${lng}/my-stories/${storyId}/${level}/${lastAvailable}/1`);
  }, [currentAvailableChapters, lng, storyId, level, router]);

  // Show pending overlay if chapter is not ready
  if (currentChapterPending) {
    const completedChapters = currentAvailableChapters.length;
    return (
      <ChapterPendingOverlay
        currentChapter={chapter}
        completedChapters={completedChapters}
        totalChapters={currentTotalChapters || completedChapters}
        onGoBack={handleGoBack}
        lng={lng}
      />
    );
  }

  // Render normal story reader
  return (
    <>
      {chapterHasAlignmentIssues && !dismissedAlignmentWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm relative z-10">
          <span className="text-amber-700">
            {lng === "es"
              ? "\u26A0 Este capítulo puede tener problemas de alineación en la traducción."
              : "\u26A0 This chapter may have translation alignment issues."}
          </span>
          <button
            onClick={() => setDismissedAlignmentWarning(true)}
            className="text-amber-400 hover:text-amber-600 text-xs ml-4 shrink-0"
          >
            {lng === "es" ? "Descartar" : "Dismiss"}
          </button>
        </div>
      )}
      <StoryLayoutWithAzureTTS
        title={title}
        storySlug={storySlug}
        sentences={lines}
        stanzas={stanzas}
        initialLevel={level}
        storyMap={storyMap}
        isUserStory={true}
        userStoryId={storyId}
        availableLevels={availableLevels}
        storyType={storyType}
        detectedLevel={detectedLevel}
        structureType={structureType}
      />
    </>
  );
}

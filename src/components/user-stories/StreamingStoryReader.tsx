// src/components/user-stories/StreamingStoryReader.tsx
// Wrapper around StoryLayoutWithAzureTTS that fetches content from streaming APIs
// Handles in-progress stories with partial chapter availability

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
import StoryLoadingSkeleton from "@/components/StoryLoadingSkeleton";
import ChapterPendingOverlay from "./ChapterPendingOverlay";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

interface StoryLine {
  es: string;
  en: string;
}

interface ChapterInfo {
  chapter: number;
  pages: number[];
  title?: string;
  subtitle?: string;
  status: "ready" | "pending";
}

interface StreamMapResponse {
  hasChapters: boolean;
  chapters: ChapterInfo[];
  totalChapters: number;
  completedChapters: number;
  isProcessing: boolean;
  currentStage?: string;
  currentChapter?: number;
}

interface ReadStreamResponse {
  lines: StoryLine[];
  storySlug: string;
  title: string;
  titleEs?: string;
  titleEn?: string;
  chapter: number;
  page: number;
  totalPages: number;
  totalChapters: number;
  availableChapters: number[];
  chapterMetadata?: {
    number: number;
    title: string;
    subtitle?: string;
  };
  isProcessing: boolean;
  hasChapters: boolean;
  // Error case
  error?: string;
  chapterPending?: boolean;
}

interface StreamingStoryReaderProps {
  storyId: string;
  level: string;
  initialChapter: number;
  initialPage: number;
  lng: Language;
  availableLevels: CEFRCode[];
}

export default function StreamingStoryReader({
  storyId,
  level,
  initialChapter,
  initialPage,
  lng,
  availableLevels,
}: StreamingStoryReaderProps) {
  const router = useRouter();
  const params = useParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<ReadStreamResponse | null>(null);
  const [streamMap, setStreamMap] = useState<StreamMapResponse | null>(null);
  const [chapterPending, setChapterPending] = useState(false);

  // Track if we're polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch stream map (for navigation)
  const fetchStreamMap = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-stories/${storyId}/stream-map?level=${level}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch stream map");
      }

      const data: StreamMapResponse = await res.json();

      if (isMountedRef.current) {
        setStreamMap(data);

        // If no longer processing, stop polling
        if (!data.isProcessing && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }

      return data;
    } catch (err) {
      console.error("[StreamingStoryReader] fetchStreamMap error:", err);
      return null;
    }
  }, [storyId, level]);

  // Fetch page content
  const fetchContent = useCallback(async (chapter: number, page: number) => {
    try {
      setLoading(true);
      setChapterPending(false);

      const res = await fetch(
        `/api/user-stories/${storyId}/read-stream?level=${level}&chapter=${chapter}&page=${page}`,
        { credentials: "include" }
      );

      const data: ReadStreamResponse = await res.json();

      if (res.status === 202 && data.chapterPending) {
        // Chapter not ready yet
        setChapterPending(true);
        setContent(null);
        setStreamMap(prev => prev ? {
          ...prev,
          completedChapters: data.availableChapters?.length || 0,
        } : null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch content");
      }

      if (isMountedRef.current) {
        setContent(data);
        setError(null);
      }
    } catch (err: any) {
      console.error("[StreamingStoryReader] fetchContent error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [storyId, level]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      const map = await fetchStreamMap();
      await fetchContent(initialChapter, initialPage);

      // Start polling if still processing
      if (map?.isProcessing) {
        pollIntervalRef.current = setInterval(() => {
          fetchStreamMap();
        }, 5000); // Poll every 5 seconds
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchStreamMap, fetchContent, initialChapter, initialPage]);

  // Handle chapter becoming available
  useEffect(() => {
    if (chapterPending && streamMap) {
      const currentChapter = parseInt(params.chapter as string) || initialChapter;
      const isNowAvailable = streamMap.chapters.some(
        c => c.chapter === currentChapter && c.status === "ready"
      );

      if (isNowAvailable) {
        // Chapter is now available, refetch
        fetchContent(currentChapter, 1);
      }
    }
  }, [streamMap, chapterPending, params.chapter, initialChapter, fetchContent]);

  // Redirect to normal reader when processing completes
  useEffect(() => {
    if (streamMap && !streamMap.isProcessing && content && !loading) {
      // Processing complete - could redirect to normal reader
      // For now, just stop polling (handled in fetchStreamMap)
    }
  }, [streamMap, content, loading, storyId, level, router, lng]);

  // Build storyMap for StoryLayoutWithAzureTTS
  const buildStoryMap = useCallback(() => {
    if (!streamMap) {
      return {
        hasChapters: false,
        chapters: [],
      };
    }

    // Only include ready chapters in the navigation
    return {
      hasChapters: streamMap.hasChapters,
      chapters: streamMap.chapters
        .filter(c => c.status === "ready")
        .map(c => ({
          chapter: c.chapter,
          pages: c.pages,
          title: c.title,
          subtitle: c.subtitle,
        })),
    };
  }, [streamMap]);

  // Show chapter pending overlay
  if (chapterPending && streamMap) {
    return (
      <ChapterPendingOverlay
        currentChapter={parseInt(params.chapter as string) || initialChapter}
        completedChapters={streamMap.completedChapters}
        totalChapters={streamMap.totalChapters}
        onGoBack={() => {
          // Navigate to last available chapter
          const lastReady = streamMap.chapters
            .filter(c => c.status === "ready")
            .pop();
          if (lastReady) {
            router.push(`/${lng}/my-stories/${storyId}/${level}/stream/${lastReady.chapter}/1`);
          }
        }}
        lng={lng}
      />
    );
  }

  // Loading state - uses shared StoryLoadingSkeleton component
  if (loading && !content) {
    return (
      <StoryLoadingSkeleton
        message={lng === "es" ? "Cargando historia..." : "Loading story..."}
      />
    );
  }

  // Error state - also uses emerald theme for consistency
  if (error && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center max-w-md bg-white/90 rounded-2xl p-8 shadow-lg">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {lng === "es" ? "Error al cargar" : "Failed to load"}
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchContent(initialChapter, initialPage)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {lng === "es" ? "Reintentar" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  // Determine title based on language
  const displayTitle = lng === "es"
    ? content.titleEs || content.title
    : content.titleEn || content.title;

  return (
    <>
      <StoryLayoutWithAzureTTS
        title={displayTitle || "My Story"}
        storySlug={content.storySlug}
        sentences={content.lines}
        initialLevel={level}
        storyMap={buildStoryMap()}
        isUserStory={true}
        userStoryId={storyId}
        availableLevels={availableLevels}
      />
    </>
  );
}

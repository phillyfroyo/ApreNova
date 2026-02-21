// src/components/user-stories/ProgressViewerModal.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChapterData, RewriteChapterData } from "@/contexts/StoryUploadContext";
import { getCEFRLabel, toCEFR } from "@/lib/cefr";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

export interface ProgressViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // For translation view
  chapters?: ChapterData[];
  sourceLanguage?: "en" | "es";
  // For rewrite view
  rewriteChapters?: RewriteChapterData[];
  // Common props
  currentChapter: number;
  totalChapters: number;
  stage: "rewriting" | "translating" | "complete";
  detectedLevel?: string;
  targetLevel?: string;
  // For on-demand data fetching when chapters are empty
  storyId?: string;
  // If true, this is a preview of completed work (no loading animations)
  isPreview?: boolean;
  // Language for i18n
  lng?: Language;
}

export function ProgressViewerModal({
  isOpen,
  onClose,
  chapters = [],
  sourceLanguage = "en",
  rewriteChapters = [],
  currentChapter,
  totalChapters,
  stage,
  detectedLevel,
  targetLevel,
  storyId,
  isPreview = false,
  lng = "en",
}: ProgressViewerModalProps) {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // On-demand fetched data
  const [fetchedChapters, setFetchedChapters] = useState<ChapterData[]>([]);
  const [fetchedRewriteChapters, setFetchedRewriteChapters] = useState<RewriteChapterData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Determine which data to show based on stage
  const isRewriting = stage === "rewriting";

  // Use fetched data if original is empty
  const effectiveChapters = chapters.length > 0 ? chapters : fetchedChapters;
  const effectiveRewriteChapters = rewriteChapters.length > 0 ? rewriteChapters : fetchedRewriteChapters;
  const displayChapters = isRewriting ? effectiveRewriteChapters : effectiveChapters;

  // Fetch data on-demand when modal opens with empty chapters
  useEffect(() => {
    if (!isOpen || !storyId || !targetLevel) return;

    const shouldFetch = isRewriting
      ? rewriteChapters.length === 0
      : chapters.length === 0;

    if (!shouldFetch) return;

    const fetchPreviewData = async () => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const type = isRewriting ? "rewriting" : "translating";
        const response = await fetch(
          `/api/user-stories/${storyId}/preview?level=${encodeURIComponent(targetLevel)}&type=${type}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch preview data");
        }

        const data = await response.json();

        if (isRewriting) {
          setFetchedRewriteChapters(data.chapters || []);
        } else {
          setFetchedChapters(data.chapters || []);
        }
      } catch (error: any) {
        console.error("[ProgressViewerModal] Fetch error:", error);
        setFetchError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviewData();
  }, [isOpen, storyId, targetLevel, isRewriting, chapters.length, rewriteChapters.length]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedChapter(0);
      setPosition({ x: 0, y: 0 });
    } else {
      // Clear fetched data when closing to prevent stale data on next open
      setFetchedChapters([]);
      setFetchedRewriteChapters([]);
      setFetchError(null);
    }
  }, [isOpen]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // Don't drag from buttons
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Get the appropriate data based on stage
  const currentChapterData = displayChapters[selectedChapter];

  let leftLines: string[] = [];
  let rightLines: string[] = [];
  let leftTitle = "";
  let rightTitle = "";
  let footerLeftLabel = "";
  let footerRightLabel = "";

  if (isRewriting && currentChapterData) {
    const rewriteData = currentChapterData as RewriteChapterData;
    leftLines = rewriteData.originalLines || [];
    rightLines = rewriteData.rewrittenLines || [];
    const fromLevel = detectedLevel ? getCEFRLabel(toCEFR(detectedLevel), lng) : t(lng, "upload", "original");
    const toLevel = targetLevel ? getCEFRLabel(toCEFR(targetLevel), lng) : t(lng, "upload", "rewritten");
    leftTitle = `${fromLevel} (${t(lng, "upload", "original")})`;
    rightTitle = `${toLevel} (${t(lng, "upload", "rewritten")})`;
    footerLeftLabel = t(lng, "upload", "original").toLowerCase();
    footerRightLabel = t(lng, "upload", "rewritten").toLowerCase();
  } else if (!isRewriting && currentChapterData) {
    const translationData = currentChapterData as ChapterData;
    leftLines = translationData.sourceLines || [];
    rightLines = translationData.translatedLines || [];
    leftTitle = sourceLanguage === "en" ? t(lng, "upload", "englishSource") : t(lng, "upload", "spanishSource");
    rightTitle = sourceLanguage === "en" ? t(lng, "upload", "spanishTranslation") : t(lng, "upload", "englishTranslation");
    footerLeftLabel = t(lng, "upload", "source");
    footerRightLabel = t(lng, "upload", "translated");
  }

  const maxLines = Math.max(leftLines.length, rightLines.length);

  // Calculate overall progress
  const completedChapters = displayChapters.length;
  const progressPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  // Header styling based on stage
  const headerGradient = isRewriting
    ? "bg-gradient-to-r from-amber-500 to-orange-500"
    : "bg-gradient-to-r from-blue-600 to-purple-600";
  const progressBarGradient = isRewriting
    ? "bg-gradient-to-r from-amber-400 to-orange-400"
    : "bg-gradient-to-r from-blue-500 to-purple-500";
  const rightHeaderBg = isRewriting ? "bg-orange-50" : "bg-indigo-50";
  const rightHeaderText = isRewriting ? "text-orange-700" : "text-indigo-700";
  const rightHeaderSubtext = isRewriting ? "text-orange-400" : "text-indigo-400";

  // Build a descriptive title
  // Use simple noun form that works for both live processing and preview
  // For rewriting: "Rewrite C1 → A2"
  // For translating: "Translate C1 (Original)" or "Translate A2 (Rewritten)"
  const getStageTitle = () => {
    if (isRewriting) {
      const fromLevel = detectedLevel ? toCEFR(detectedLevel) : "";
      const toLevel = targetLevel ? toCEFR(targetLevel) : "";
      if (fromLevel && toLevel) {
        return t(lng, "upload", "rewriteFromTo", { from: fromLevel, to: toLevel });
      }
      return t(lng, "upload", "rewrite");
    } else {
      const level = targetLevel ? toCEFR(targetLevel) : "";
      const isOriginalLevel = targetLevel === detectedLevel;
      if (level) {
        return isOriginalLevel
          ? t(lng, "upload", "translateOriginal", { level })
          : t(lng, "upload", "translateRewritten", { level });
      }
      return t(lng, "upload", "translate");
    }
  };
  const stageTitle = getStageTitle();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - uses min-height and padding to ensure modal is always fully visible */}
      <div className="min-h-full flex items-start justify-center p-4 sm:p-6 md:p-8">
        {/* Modal Content - responsive width, max height with scroll, draggable */}
        <div
          ref={modalRef}
          className={`relative w-full max-w-[95vw] xl:max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-4 max-h-[calc(100vh-4rem)] ${isDragging ? "select-none" : ""}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            willChange: isDragging ? "transform" : "auto",
          }}
        >
          {/* Header - draggable */}
          <div
            className={`${headerGradient} text-white px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              <span className="text-base md:text-lg font-semibold">
                {stageTitle}
              </span>
              <span className="text-xs md:text-sm bg-white/20 px-2 md:px-3 py-1 rounded-full">
                {t(lng, "upload", "chaptersCount", { completed: completedChapters, total: totalChapters })}
              </span>
              {/* Only show live processing badge when not in preview mode */}
              {!isPreview && stage !== "complete" && (
                <span className="text-xs md:text-sm bg-yellow-500/80 px-2 md:px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                  {isRewriting
                    ? t(lng, "upload", "rewritingChapter", { current: currentChapter })
                    : t(lng, "upload", "translatingChapterLive", { current: currentChapter })}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0 ml-2"
              title="Close (Esc)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-200 shrink-0">
            <div
              className={`h-full ${progressBarGradient} transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Chapter selector */}
          {displayChapters.length > 1 && (
            <div className="px-4 md:px-6 py-3 bg-gray-50 border-b flex items-center gap-3 overflow-x-auto shrink-0">
              <span className="text-sm text-gray-500 shrink-0">{t(lng, "upload", "chapters")}</span>
              <div className="flex gap-2">
                {displayChapters.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedChapter(idx)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedChapter === idx
                        ? isRewriting ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                {/* Show pending chapters as disabled */}
                {Array.from({ length: totalChapters - displayChapters.length }, (_, idx) => (
                  <button
                    key={`pending-${idx}`}
                    disabled
                    className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-400 border border-gray-200 cursor-default"
                  >
                    {displayChapters.length + idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center">
                <div className={`w-16 h-16 border-4 ${isRewriting ? "border-amber-500" : "border-blue-500"} border-t-transparent rounded-full animate-spin mx-auto mb-4`} />
                <p className="text-gray-600">{t(lng, "upload", "loadingPreview")}</p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center">
                <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-gray-600">{t(lng, "upload", "failedToLoadPreview")}</p>
                <p className="text-sm text-gray-400 mt-2">{fetchError}</p>
              </div>
            </div>
          ) : displayChapters.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center">
                <div className={`w-16 h-16 border-4 ${isRewriting ? "border-amber-500" : "border-blue-500"} border-t-transparent rounded-full animate-spin mx-auto mb-4`} />
                <p className="text-gray-600">{t(lng, "upload", "waitingForFirstChapter")}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {isRewriting
                    ? t(lng, "upload", "rewritingChapterOf", { current: currentChapter, total: totalChapters })
                    : t(lng, "upload", "translatingChapterOf", { current: currentChapter, total: totalChapters })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Column Headers - using CSS Grid for exact equal widths */}
              <div className="grid shrink-0 border-b border-gray-300" style={{ gridTemplateColumns: "3rem 1fr 1fr" }}>
                {/* Line number header */}
                <div className="bg-gray-100 text-gray-500 text-xs font-medium py-2 text-center border-r border-gray-200">
                  #
                </div>
                {/* Left header */}
                <div className="bg-gray-100 px-2 md:px-3 py-2 text-xs md:text-sm font-medium text-gray-600 border-r border-gray-200 flex items-center justify-between min-w-0">
                  <span className="truncate">{leftTitle}</span>
                  <span className="text-gray-400 text-xs hidden sm:inline ml-2 shrink-0">{leftLines.length} {t(lng, "upload", "lines")}</span>
                </div>
                {/* Right header */}
                <div className={`${rightHeaderBg} px-2 md:px-3 py-2 text-xs md:text-sm font-medium ${rightHeaderText} flex items-center justify-between min-w-0`}>
                  <span className="truncate">{rightTitle}</span>
                  <span className={`${rightHeaderSubtext} text-xs hidden sm:inline ml-2 shrink-0`}>{rightLines.length} {t(lng, "upload", "lines")}</span>
                </div>
              </div>

              {/* Scrollable content - using CSS Grid for exact equal widths */}
              <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0">
                <div className="font-mono text-xs md:text-sm leading-relaxed">
                  {Array.from({ length: maxLines }, (_, idx) => {
                    const leftLine = leftLines[idx] ?? "";
                    const rightLine = rightLines[idx] ?? "";
                    const hasMismatch = leftLine && rightLine && leftLines.length !== rightLines.length;
                    // Detect blank/empty line (paragraph or stanza break)
                    const isBlankLine = !leftLine.trim() && !rightLine.trim();

                    return (
                      <div
                        key={idx}
                        className={`grid border-b ${isBlankLine ? "border-gray-200" : "border-gray-100"} ${hasMismatch ? "bg-amber-50" : isBlankLine ? "" : "hover:bg-gray-50"}`}
                        style={{ gridTemplateColumns: "3rem 1fr 1fr" }}
                      >
                        {/* Line number */}
                        <div className={`select-none text-gray-400 text-right pr-2 py-1 border-r border-gray-200 ${isBlankLine ? "bg-gray-100" : "bg-gray-50"}`}>
                          {isBlankLine ? "—" : idx + 1}
                        </div>

                        {/* Left cell */}
                        <div className={`py-1 px-2 md:px-3 border-r border-gray-200 overflow-hidden min-w-0 ${isBlankLine ? "bg-gray-50" : ""}`}>
                          <span className={`whitespace-pre-wrap break-words block ${isBlankLine ? "text-gray-400 text-center italic text-xs" : "text-sm font-mono text-gray-700"}`}>
                            {isBlankLine ? t(lng, "upload", "paragraphBreak") : (leftLine || "\u00A0")}
                          </span>
                        </div>

                        {/* Right cell */}
                        <div className={`py-1 px-2 md:px-3 overflow-hidden min-w-0 ${isBlankLine ? "bg-gray-50" : ""}`}>
                          <span className={`whitespace-pre-wrap break-words block ${isBlankLine ? "text-gray-400 text-center italic text-xs" : "text-sm font-mono text-gray-700"}`}>
                            {isBlankLine ? t(lng, "upload", "paragraphBreak") : (rightLine || "\u00A0")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-4 md:px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              {displayChapters.length > 0 && (
                <>
                  <span className="truncate">
                    {t(lng, "upload", "chapterLabel", { num: selectedChapter + 1, left: leftLines.length, leftLabel: footerLeftLabel, right: rightLines.length, rightLabel: footerRightLabel })}
                  </span>
                  {leftLines.length !== rightLines.length && (
                    <span className="text-amber-600 flex items-center gap-1 shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="hidden sm:inline">{t(lng, "upload", "lineCountMismatch")}</span>
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <span className="text-gray-400">{t(lng, "upload", "progress")}</span>
              <span className="font-medium text-gray-700">{progressPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProgressViewerModal;

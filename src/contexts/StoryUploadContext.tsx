"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { ComparisonModal } from "@/components/ComparisonModal";
import type { ChapterAlignmentResult } from "@/lib/user-stories/alignment-check";
import { toCEFR, getCEFRLabel } from "@/lib/cefr";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

// Upload status stages
export type UploadStage =
  | "idle"
  | "uploading"
  | "detecting-language"
  | "detecting-level"
  | "generating-description"
  | "rewriting-levels"
  | "translating"
  | "finalizing"
  | "review"
  | "complete"
  | "error"
  | "connection-lost" // Network connectivity issue - can retry
  | "reconnecting"; // Recovering from state loss (e.g., after 404 navigation)

// Progress phases from backend (main titles)
export type ProgressPhase = "detecting" | "adapting" | "translating" | "finalizing";

// Phase display names
export const PHASE_TITLES: Record<ProgressPhase, string> = {
  detecting: "Detecting...",
  adapting: "Adapting...",
  translating: "Translating...",
  finalizing: "Wrapping things up...",
};

export interface ChapterData {
  sourceLines: string[];
  translatedLines: string[];
}

export interface RewriteChapterData {
  originalLines: string[];
  rewrittenLines: string[];
}

// Stream progress for parallel processing
export type StreamStatus = "waiting" | "in-progress" | "complete";

export interface StreamProgress {
  id: string; // e.g., "translate-C1", "rewrite-A2", "translate-A2"
  type: "rewriting" | "translating";
  level: string; // Target CEFR level (e.g., "C1", "A2")
  fromLevel?: string; // For rewrites, the source level (e.g., "C1")
  status: StreamStatus;
  levelStatus?: string; // Database level status: "PENDING" | "PROCESSING" | "READY"
  currentChapter: number;
  totalChapters: number;
  chapters: ChapterData[] | RewriteChapterData[];
  label: string; // Display label for UI
  hasAlignmentIssues?: boolean; // True if any chapter has translation alignment issues
}

// Story-level progress from backend
export interface StoryProcessingProgress {
  phase: ProgressPhase;
  step: string;
  stepLabel: string;
  chapterCurrent?: number;
  chapterTotal?: number;
  currentLevel?: string;
  totalWords?: number;
  timestamp: string;
}

export interface UploadProgress {
  stage: UploadStage;
  stageProgress: number; // 0-100 for current stage
  overallProgress: number; // 0-100 for entire process
  currentLevel?: string; // e.g., "l2" when rewriting
  userLevel?: string; // user's CEFR level (e.g., "l3")
  detectedLevel?: string; // source text's detected level
  currentChapter?: number; // current chapter being processed
  totalChapters?: number; // total chapters in the story
  completedChapters?: ChapterData[]; // completed chapter data for translation viewer
  rewriteChapters?: RewriteChapterData[]; // completed chapter data for rewrite viewer
  message: string;
  error?: string;
  // New detailed progress fields
  phase?: ProgressPhase; // Main phase: detecting, adapting, translating, finalizing
  stepLabel?: string; // Detailed step label (subtitle)
  phaseTitle?: string; // Display title for current phase
  // Multi-stream progress for parallel processing
  streams?: StreamProgress[];
}

export interface StoryUploadData {
  id?: string;
  rawContent: string;
  title: string;
  titleGenerated: boolean;
  description: string;
  descriptionGenerated: boolean;
  sourceLanguage: "en" | "es";
  sourceLanguageDetected: boolean;
  detectedLevel: string;
  thumbnailUrl?: string;
  // New metadata fields
  storyType?: string;
  storyTypeDetected?: boolean;
  targetAudience?: string;
  targetAudienceDetected?: boolean;
  tags?: string[];
  tagsDetected?: boolean;
  hook?: string;
  hookEs?: string;
  hookEn?: string;
  hookDetected?: boolean;
}

interface StartUploadOptions {
  content: string;
  title?: string;
  sourceLanguage?: "en" | "es";
  description?: string;
  structureType?: "auto" | "prose" | "anthology" | "epic" | "script";
  processingMode?: "original_only" | "rewritten_only" | "both";
  /** Original HTML content (only for .html/.htm uploads) for semantic stanza detection */
  rawHtml?: string;
  /** Source file format: "html" | "txt" | "rtf" | "md" */
  sourceFormat?: "html" | "txt" | "rtf" | "md";
}

interface StoryUploadContextType {
  // State
  isUploading: boolean;
  isMinimized: boolean;
  progress: UploadProgress;
  storyData: StoryUploadData | null;
  showUploadModal: boolean;
  showReviewModal: boolean;
  showProgressViewer: boolean;
  showCancelConfirm: boolean;
  lastConfirmedAt: number | null; // Timestamp of last story confirmation
  lastCancelledAt: number | null; // Timestamp of last story cancellation
  selectedStreamId: string | null; // Which stream to show in progress viewer
  isReadingCurrentStory: boolean; // Track if user started reading before processing completed

  // Actions
  startUpload: (options: StartUploadOptions) => Promise<void>;
  cancelUpload: () => void;
  requestCancel: () => void;
  dismissCancelConfirm: () => void;
  toggleMinimized: () => void;
  minimize: () => void; // Minimize the progress widget (for auto-minimize on navigation)
  setShowUploadModal: (show: boolean) => void;
  setShowReviewModal: (show: boolean) => void;
  setShowProgressViewer: (show: boolean) => void;
  setSelectedStreamId: (id: string | null) => void;
  updateStoryData: (updates: Partial<StoryUploadData>) => void;
  confirmStory: () => Promise<void>;
  retryConnection: () => void; // Retry after connection lost
  resetProgress: () => void; // Reset progress state (after navigation completes)
  setIsReadingCurrentStory: (reading: boolean) => void; // Set reading state
}

const StoryUploadContext = createContext<StoryUploadContextType | null>(null);

export function useStoryUpload() {
  const context = useContext(StoryUploadContext);
  if (!context) {
    throw new Error("useStoryUpload must be used within StoryUploadProvider");
  }
  return context;
}

// ============================================================================
// TIME-BASED PROGRESS ESTIMATION
// ============================================================================

// Empirical rates from testing (words per second)
const WORDS_PER_SECOND = 40; // ~200 chars/s ÷ 5 chars/word = 40 words/s (conservative)
const DETECTING_TIME_S = 35; // Fixed ~35 seconds for detecting phase
const FINALIZING_TIME_S = 10; // Fixed ~10 seconds for building/saving

/**
 * Calculate dynamic phase percentages based on total word count.
 * Short stories get a large detecting %, novels get almost none.
 */
function calculatePhasePercentages(totalWords: number) {
  const processingTimeS = totalWords / WORDS_PER_SECOND;
  const totalTimeS = DETECTING_TIME_S + processingTimeS + FINALIZING_TIME_S;

  const detectingPct = (DETECTING_TIME_S / totalTimeS) * 100;
  const processingPct = (processingTimeS / totalTimeS) * 100;
  const finalizingPct = (FINALIZING_TIME_S / totalTimeS) * 100;

  return { detectingPct, processingPct, finalizingPct, totalTimeS, processingTimeS };
}

// Fallback fixed weights when totalWords is unknown
const STAGE_WEIGHTS: Record<UploadStage, { start: number; end: number }> = {
  idle: { start: 0, end: 0 },
  uploading: { start: 0, end: 5 },
  "detecting-language": { start: 5, end: 10 },
  "detecting-level": { start: 10, end: 20 },
  "generating-description": { start: 20, end: 30 },
  "rewriting-levels": { start: 30, end: 60 },
  translating: { start: 60, end: 90 },
  finalizing: { start: 90, end: 95 },
  review: { start: 95, end: 95 },
  complete: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
  "connection-lost": { start: 0, end: 0 },
  reconnecting: { start: 0, end: 0 },
};

/**
 * Calculate time-based progress within the processing phase.
 * Tied to one translation pass (totalWords / WORDS_PER_SECOND) since
 * all levels process in parallel and translation is the bottleneck.
 *
 * Each chapter gets an equal time slice. Progress ticks up based on elapsed
 * time within the current chapter's range, capping at 95% until the backend
 * confirms that chapter is complete.
 */
function calculateTimeBasedProcessingProgress(
  elapsedS: number,
  totalWords: number,
  completedChapters: number,
  totalChapters: number,
): number {
  const estimatedTotalS = totalWords / WORDS_PER_SECOND;
  const timePerChapter = estimatedTotalS / totalChapters;

  // Floor: confirmed completed chapters (never go below this)
  const completedPct = (completedChapters / totalChapters) * 100;

  // Time elapsed into the current (incomplete) chapter
  const expectedElapsedForCompleted = completedChapters * timePerChapter;
  const timeIntoCurrentChapter = Math.max(0, elapsedS - expectedElapsedForCompleted);

  // Progress within current chapter (cap at 95% — wait for confirmation before moving on)
  const currentChapterRatio = Math.min(timeIntoCurrentChapter / timePerChapter, 0.95);
  const chapterSlicePct = 100 / totalChapters;

  // Total: completed chapters + time-based partial progress in current chapter
  return Math.max(completedPct + currentChapterRatio * chapterSlicePct, completedPct);
}

// Step ordering for calculating progress during detecting phase
const DETECTING_STEPS = [
  "creating_record",
  "creating_levels",
  "detecting_language",
  "generating_title",
  "generating_description",
  "generating_hook",
  "detecting_story_type",
  "detecting_audience",
  "extracting_tags",
  "detecting_level",
];

/**
 * Calculate progress percentage for detecting phase.
 * Uses dynamic detectingPct based on totalWords when available.
 */
function calculateProgressForPhase(phase: string, step: string, totalWords?: number): number {
  const { detectingPct, processingPct } = totalWords
    ? calculatePhasePercentages(totalWords)
    : { detectingPct: 30, processingPct: 60 };

  if (phase === "detecting") {
    const stepIndex = DETECTING_STEPS.indexOf(step);
    if (stepIndex >= 0) {
      return Math.round((stepIndex / DETECTING_STEPS.length) * detectingPct);
    }
    return Math.round(detectingPct / 2);
  }
  // For non-detecting phases caught in the detecting branch (brief window before
  // a level is PROCESSING), just return detectingPct. The time-based branch will
  // handle granular progress once a level starts processing.
  if (phase === "adapting" || phase === "translating") return Math.round(detectingPct);
  if (phase === "finalizing") return Math.round(detectingPct + processingPct);
  return Math.round(detectingPct);
}

// Build streams array from level data for parallel progress tracking
// Handles both sequential and streaming (parallel) pipelines
function buildStreamsFromLevels(
  levels: Array<{
    id: string;
    level: string;
    status: string;
    processingProgress: any;
  }>,
  detectedLevel: string | null
): StreamProgress[] {
  const streams: StreamProgress[] = [];

  // DEBUG: Log what levels we receive - TODO: Remove after debugging
  console.log('[buildStreamsFromLevels] Input:', {
    levelsCount: levels.length,
    levels: levels.map(l => ({ level: l.level, status: l.status, hasProgress: !!l.processingProgress })),
    detectedLevel,
  });

  for (const level of levels) {
    const levelProgress = level.processingProgress as {
      stage?: 'rewriting' | 'translating' | 'complete';
      currentChapter?: number;
      totalChapters?: number;
      chaptersCompleted?: number[];
      completedData?: { sourceLines: string[]; translatedLines: string[] }[];
      rewriteData?: { originalLines: string[]; rewrittenLines: string[] }[];
      // Streaming pipeline progress tracking
      rewriteProgress?: { currentChapter: number; chaptersCompleted: number };
      translateProgress?: { currentChapter: number; chaptersCompleted: number };
    } | null;

    if (!levelProgress) continue;

    const isDetectedLevel = level.level === detectedLevel;
    const needsRewrite = !isDetectedLevel;
    const totalChapters = levelProgress.totalChapters || 0;

    // Use streaming progress fields if available, fall back to data array length
    const rewriteChaptersCount = levelProgress.rewriteProgress?.chaptersCompleted
      ?? levelProgress.rewriteData?.length
      ?? 0;
    const translateChaptersCount = levelProgress.translateProgress?.chaptersCompleted
      ?? levelProgress.completedData?.length
      ?? 0;
    const hasRewriteData = rewriteChaptersCount > 0 || levelProgress.rewriteData?.length;
    const hasTranslateData = translateChaptersCount > 0 || levelProgress.completedData?.length;
    const isComplete = levelProgress.stage === 'complete' || level.status === 'READY';

    // Add rewrite stream if this level needs rewriting
    // Show rewrite stream if:
    // 1. Has rewriteProgress (streaming mode started)
    // 2. Has rewrite data
    // 3. Currently rewriting
    // 4. Level is complete (means it was rewritten successfully)
    if (needsRewrite && (levelProgress.rewriteProgress || levelProgress.rewriteData?.length || levelProgress.stage === 'rewriting' || isComplete)) {
      // Use rewriteProgress for reliable status in streaming mode
      const rewriteAllDone = rewriteChaptersCount >= totalChapters && totalChapters > 0;

      // Determine status based on progress, not stage (which bounces in streaming mode)
      const rewriteStatus: StreamStatus =
        isComplete ? 'complete' :
        rewriteAllDone ? 'complete' :
        rewriteChaptersCount > 0 ? 'in-progress' :
        levelProgress.stage === 'rewriting' ? 'in-progress' : 'waiting';

      streams.push({
        id: `rewrite-${level.level}`,
        type: 'rewriting',
        level: level.level,
        fromLevel: detectedLevel || undefined,
        status: rewriteStatus,
        levelStatus: level.status,
        currentChapter: rewriteChaptersCount,
        totalChapters: totalChapters,
        chapters: levelProgress.rewriteData || [],
        label: `Rewrite ${detectedLevel || '?'} → ${level.level}`,
      });
    }

    // Add translate stream for this level
    // Show translate stream if:
    // 1. Has translateProgress (streaming mode started)
    // 2. Has translation data
    // 3. Is complete
    // 4. For detected level - show when processing starts
    // 5. For rewritten levels - show when rewrite has started (streaming mode)
    const shouldShowTranslateStream =
      levelProgress.translateProgress ||
      hasTranslateData ||
      isComplete ||
      (isDetectedLevel && levelProgress.stage) ||
      (needsRewrite && hasRewriteData);

    if (shouldShowTranslateStream) {
      const translateAllDone = translateChaptersCount >= totalChapters && totalChapters > 0;

      // Determine status based on progress counts, not stage
      const translateStatus: StreamStatus =
        isComplete || translateAllDone ? 'complete' :
        translateChaptersCount > 0 ? 'in-progress' :
        levelProgress.stage === 'translating' ? 'in-progress' :
        (needsRewrite && rewriteChaptersCount > 0) ? 'waiting' :  // Streaming: waiting for rewrite
        'waiting';

      // Check if any completed chapter has alignment issues
      const translationHasAlignmentIssues = levelProgress.completedData?.some(
        (ch: any) => ch.alignmentIssues?.hasIssues
      ) || false;

      streams.push({
        id: `translate-${level.level}`,
        type: 'translating',
        level: level.level,
        status: translateStatus,
        levelStatus: level.status,
        currentChapter: translateChaptersCount,
        totalChapters: totalChapters,
        chapters: levelProgress.completedData || [],
        label: isDetectedLevel ? `Translate ${level.level} (original)` : `Translate ${level.level} (rewritten)`,
        hasAlignmentIssues: translationHasAlignmentIssues || undefined,
      });
    }
  }

  // DEBUG: Log what streams we built - TODO: Remove after debugging
  console.log('[buildStreamsFromLevels] Output:', {
    streamsCount: streams.length,
    streams: streams.map(s => ({ id: s.id, type: s.type, level: s.level, status: s.status, levelStatus: s.levelStatus, chaptersCount: s.chapters?.length })),
  });

  return streams;
}

// Generate stage message based on context
function getStageMessage(
  stage: UploadStage,
  extra?: { userLevel?: string; detectedLevel?: string; currentLevel?: string; currentChapter?: number; totalChapters?: number }
): string {
  const userCEFR = extra?.userLevel ? toCEFR(extra.userLevel) : null;
  const detectedCEFR = extra?.detectedLevel ? toCEFR(extra.detectedLevel) : null;

  switch (stage) {
    case "idle":
      return "";
    case "uploading":
      return "Uploading your story...";
    case "detecting-language":
      return "Detecting language...";
    case "detecting-level":
      return "Analyzing difficulty level...";
    case "generating-description":
      return "Creating title & description...";
    case "rewriting-levels":
      if (userCEFR && detectedCEFR && userCEFR !== detectedCEFR) {
        return `Adapting ${detectedCEFR}→${userCEFR}`;
      }
      return "Adapting";
    case "translating":
      if (userCEFR && detectedCEFR && userCEFR !== detectedCEFR) {
        return `Translating rewritten ${userCEFR} text...`;
      }
      return `Translating ${detectedCEFR || "original"} text...`;
    case "finalizing":
      return "Finalizing your story...";
    case "review":
      return "Ready for review!";
    case "complete":
      return "Story uploaded successfully!";
    case "error":
      return "Something went wrong";
    default:
      return "";
  }
}

// i18n-aware version of phase titles
export function getLocalizedPhaseTitle(phase: ProgressPhase, lng: Language): string {
  return t(lng, "upload", phase);
}

// i18n-aware version of stage message
export function getLocalizedStageMessage(
  stage: UploadStage,
  lng: Language,
  extra?: { userLevel?: string; detectedLevel?: string; currentLevel?: string; currentChapter?: number; totalChapters?: number }
): string {
  const userCEFR = extra?.userLevel ? toCEFR(extra.userLevel) : null;
  const detectedCEFR = extra?.detectedLevel ? toCEFR(extra.detectedLevel) : null;

  switch (stage) {
    case "idle":
      return "";
    case "uploading":
      return t(lng, "upload", "uploadingStory");
    case "detecting-language":
      return t(lng, "upload", "detectingLanguage");
    case "detecting-level":
      return t(lng, "upload", "analyzingLevel");
    case "generating-description":
      return t(lng, "upload", "creatingDescription");
    case "rewriting-levels":
      if (userCEFR && detectedCEFR && userCEFR !== detectedCEFR) {
        return t(lng, "upload", "adaptingLevel", { from: detectedCEFR, to: userCEFR });
      }
      return t(lng, "upload", "adaptingGeneric");
    case "translating":
      if (userCEFR && detectedCEFR && userCEFR !== detectedCEFR) {
        return t(lng, "upload", "translatingRewritten", { level: userCEFR });
      }
      return t(lng, "upload", "translatingOriginal", { level: detectedCEFR || "original" });
    case "finalizing":
      return t(lng, "upload", "finalizingStory");
    case "review":
      return t(lng, "upload", "readyForReview");
    case "complete":
      return t(lng, "upload", "uploadSuccess");
    case "error":
      return t(lng, "upload", "somethingWentWrong");
    default:
      return "";
  }
}

// Convert chapter arrays (ChapterData[] or RewriteChapterData[]) to text strings
// with "--- Chapter N ---" markers for ComparisonModal's parseChaptersFromText()
function chaptersToText(
  chapters: Array<{ left: string[]; right: string[] }>
): { leftText: string; rightText: string } {
  if (chapters.length === 0) return { leftText: "", rightText: "" };
  if (chapters.length === 1) {
    return {
      leftText: chapters[0].left.join("\n"),
      rightText: chapters[0].right.join("\n"),
    };
  }
  const leftParts: string[] = [];
  const rightParts: string[] = [];
  for (let i = 0; i < chapters.length; i++) {
    leftParts.push(`--- Chapter ${i + 1} ---`);
    leftParts.push(chapters[i].left.join("\n"));
    rightParts.push(`--- Chapter ${i + 1} ---`);
    rightParts.push(chapters[i].right.join("\n"));
  }
  return { leftText: leftParts.join("\n"), rightText: rightParts.join("\n") };
}

// Session storage key for persisting upload state across navigation
const UPLOAD_STATE_KEY = "cuentana_upload_state";

interface PersistedUploadState {
  storyId: string;
  isUploading: boolean;
  timestamp: number;
}

function persistUploadState(state: PersistedUploadState | null) {
  try {
    if (state) {
      sessionStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(UPLOAD_STATE_KEY);
    }
  } catch (e) {
    // Ignore sessionStorage errors (e.g., in SSR or private browsing)
  }
}

function getPersistedUploadState(): PersistedUploadState | null {
  try {
    const stored = sessionStorage.getItem(UPLOAD_STATE_KEY);
    if (!stored) return null;
    const state = JSON.parse(stored) as PersistedUploadState;
    // Ignore if older than 1 hour
    if (Date.now() - state.timestamp > 60 * 60 * 1000) {
      sessionStorage.removeItem(UPLOAD_STATE_KEY);
      return null;
    }
    return state;
  } catch (e) {
    return null;
  }
}

export function StoryUploadProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const params = useParams();
  const providerLng = (params?.lng as Language) || "en";
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showProgressViewer, setShowProgressViewer] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<StoryUploadData | null>(null);
  const [isReadingCurrentStory, setIsReadingCurrentStory] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    stage: "idle",
    stageProgress: 0,
    overallProgress: 0,
    message: "",
  });

  // On-demand fetch state (for when viewport modal opens with empty chapters)
  const [fetchedChapters, setFetchedChapters] = useState<ChapterData[]>([]);
  const [fetchedRewriteChapters, setFetchedRewriteChapters] = useState<RewriteChapterData[]>([]);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [fetchPreviewError, setFetchPreviewError] = useState<string | null>(null);

  // Debug: Log state changes that would hide the widget
  useEffect(() => {
    console.log("[StoryUploadContext] State changed:", {
      isUploading,
      progressStage: progress.stage,
      storyId: storyData?.id,
      isMinimized,
      wouldHideWidget: !isUploading && progress.stage === "idle",
    });
  }, [isUploading, progress.stage, storyData?.id, isMinimized]);

  // Abort controller for cancellation
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Timestamp for when a story was last confirmed (for triggering refetch in UI)
  const [lastConfirmedAt, setLastConfirmedAt] = useState<number | null>(null);
  const [lastCancelledAt, setLastCancelledAt] = useState<number | null>(null);

  // For retry after connection lost
  const [retryTrigger, setRetryTrigger] = useState(0);
  const pollingStoryIdRef = useRef<string | null>(null);
  const pollingAttemptsRef = useRef(0);

  // Store story ID in a ref for immediate access in cancelUpload
  // (React state updates are async, so storyData.id may be stale when cancel is clicked)
  const storyIdRef = useRef<string | null>(null);

  // Track if cancel was requested during upload (before story ID is known)
  // This allows us to cancel the story after creation completes
  const cancelRequestedRef = useRef(false);
  // Word count from uploaded content — used for progress estimation before backend has totalWords
  const uploadedWordCountRef = useRef<number>(0);
  // Timestamp when processing phase started (for time-based progress ticking)
  const processingStartTimeRef = useRef<number>(0);

  // Recover from persisted state if React state was lost (e.g., after 404 navigation)
  useEffect(() => {
    // Only try to recover if we're in idle state (potential state loss)
    if (!isUploading && progress.stage === "idle" && !storyData) {
      const persisted = getPersistedUploadState();
      if (persisted && persisted.isUploading && persisted.storyId) {
        console.log("[StoryUploadContext] Recovering from persisted state:", persisted);
        // We have a story that was uploading - trigger reconnection via polling
        pollingStoryIdRef.current = persisted.storyId;
        storyIdRef.current = persisted.storyId;
        setIsUploading(true);
        setStoryData({ id: persisted.storyId } as StoryUploadData);
        setProgress({
          stage: "reconnecting",
          stageProgress: 0,
          overallProgress: 0,
          message: "Reconnecting...",
          phaseTitle: "Reconnecting to upload...",
        });
      }
    }
  }, []); // Only run once on mount

  // On-demand fetch when viewport modal opens with empty chapters
  useEffect(() => {
    if (!showProgressViewer || !storyData?.id) return;

    const selectedStream = selectedStreamId
      ? progress.streams?.find(s => s.id === selectedStreamId)
      : null;

    // Determine what data we need based on selected stream or legacy progress
    const isRewriting = selectedStream
      ? selectedStream.type === "rewriting"
      : progress.stage === "rewriting-levels";

    const targetLevel = selectedStream?.level || progress.currentLevel;
    const hasData = isRewriting
      ? (selectedStream ? (selectedStream.chapters as RewriteChapterData[]).length > 0 : (progress.rewriteChapters?.length || 0) > 0) || fetchedRewriteChapters.length > 0
      : (selectedStream ? (selectedStream.chapters as ChapterData[]).length > 0 : (progress.completedChapters?.length || 0) > 0) || fetchedChapters.length > 0;

    if (hasData || !targetLevel) return;

    const fetchPreviewData = async () => {
      setIsFetchingPreview(true);
      setFetchPreviewError(null);

      try {
        const type = isRewriting ? "rewriting" : "translating";
        const response = await fetch(
          `/api/user-stories/${storyData.id}/preview?level=${encodeURIComponent(targetLevel)}&type=${type}`
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
        console.error("[StoryUploadContext] Fetch preview error:", error);
        setFetchPreviewError(error.message);
      } finally {
        setIsFetchingPreview(false);
      }
    };

    fetchPreviewData();
  }, [showProgressViewer, storyData?.id, selectedStreamId, progress.streams, progress.stage, progress.currentLevel, progress.rewriteChapters?.length, progress.completedChapters?.length, fetchedChapters.length, fetchedRewriteChapters.length]);

  // Clear fetched data when selected stream changes (not on modal close,
  // so post-save refreshed data persists across close/reopen)
  useEffect(() => {
    setFetchedChapters([]);
    setFetchedRewriteChapters([]);
    setFetchPreviewError(null);
  }, [selectedStreamId]);

  const updateProgress = useCallback((stage: UploadStage, stageProgress: number = 0, extra?: Partial<UploadProgress>) => {
    const weights = STAGE_WEIGHTS[stage];
    const overallProgress = weights.start + ((weights.end - weights.start) * stageProgress) / 100;

    // Merge with existing progress to preserve userLevel/detectedLevel
    setProgress(prev => {
      // Never go backwards (except for error/reset states)
      const newOverall = stage === "error" || stage === "idle"
        ? Math.round(overallProgress)
        : Math.max(prev.overallProgress, Math.round(overallProgress));
      const merged = {
        ...prev,
        stage,
        stageProgress,
        overallProgress: newOverall,
        ...extra,
      };
      // Generate message with context (including chapter info)
      merged.message = getStageMessage(stage, {
        userLevel: merged.userLevel,
        detectedLevel: merged.detectedLevel,
        currentLevel: merged.currentLevel,
        currentChapter: merged.currentChapter,
        totalChapters: merged.totalChapters,
      });
      return merged;
    });
  }, []);

  const startUpload = useCallback(async (options: StartUploadOptions) => {
    const { content, title: optionalTitle, sourceLanguage, description, structureType, processingMode, rawHtml, sourceFormat } = options;
    const controller = new AbortController();
    setAbortController(controller);
    setIsUploading(true);
    setIsMinimized(false);
    setShowUploadModal(false);

    // Clear cancel flag at start of new upload
    cancelRequestedRef.current = false;
    storyIdRef.current = null;
    processingStartTimeRef.current = 0;

    // Calculate word count for progress estimation
    uploadedWordCountRef.current = content.trim().split(/\s+/).length;

    console.log("[StoryUpload] Starting upload", {
      contentLength: content.length,
      wordCount: uploadedWordCountRef.current,
      title: optionalTitle || "(auto-generate)",
      sourceLanguage: sourceLanguage || "(auto-detect)",
      hasDescription: !!description,
    });

    // Initialize story data
    const initialData: StoryUploadData = {
      rawContent: content,
      title: optionalTitle || "",
      titleGenerated: !optionalTitle,
      description: description || "",
      descriptionGenerated: !description,
      sourceLanguage: sourceLanguage || "es",
      sourceLanguageDetected: !sourceLanguage,
      detectedLevel: "",
    };
    setStoryData(initialData);

    try {
      // Stage 1: Upload and create initial record
      console.log("[StoryUpload] Stage 1: Creating story record...");
      updateProgress("uploading", 50, {
        phase: "detecting",
        phaseTitle: PHASE_TITLES.detecting,
        stepLabel: "Creating story record",
      });

      // Note: Don't use abort signal for the create POST
      // If user cancels during upload, we need the story ID to cancel it properly
      // The cancel flag mechanism handles this case
      const createResponse = await fetch("/api/user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title: optionalTitle || "Untitled Story",
          sourceLanguage,
          description,
          structureType: structureType || "auto",
          processingMode: processingMode || "both",
          rawHtml,
          sourceFormat,
        }),
        // Intentionally NOT using signal here - see cancelRequestedRef handling below
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error("[StoryUpload] Failed to create story:", error);
        throw new Error(error.error || "Failed to create story");
      }

      const { story } = await createResponse.json();
      console.log("[StoryUpload] Story created:", { id: story.id, slug: story.slug });

      // Check if cancel was requested while the POST was in flight
      // Do this BEFORE any state updates to avoid modal flashing
      if (cancelRequestedRef.current) {
        console.log("[StoryUpload] Cancel was requested during upload, cancelling story:", story.id);
        try {
          await fetch(`/api/user-stories/${story.id}/cancel`, { method: "POST" });
        } catch (e) {
          console.error("[StoryUpload] Failed to cancel story after deferred cancel:", e);
        }
        // State was already reset in cancelUpload, just clear the flag
        cancelRequestedRef.current = false;
        setLastCancelledAt(Date.now());
        return; // Exit early, don't start processing
      }

      updateProgress("uploading", 100, {
        phase: "detecting",
        phaseTitle: PHASE_TITLES.detecting,
        stepLabel: "Preparing reading levels",
      });

      // Store story ID in ref immediately (for cancel to use before React state updates)
      storyIdRef.current = story.id;
      setStoryData(prev => prev ? { ...prev, id: story.id } : null);

      // Persist upload state to sessionStorage (for recovery after navigation issues like 404)
      persistUploadState({
        storyId: story.id,
        isUploading: true,
        timestamp: Date.now(),
      });

      // Stage 2: Process the story (this triggers the AI pipeline)
      console.log("[StoryUpload] Stage 2: Starting AI processing...");
      updateProgress("detecting-language", 0, {
        phase: "detecting",
        phaseTitle: PHASE_TITLES.detecting,
        stepLabel: "Detecting language",
      });

      const processResponse = await fetch("/api/user-stories/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id }),
        signal: controller.signal,
      });

      if (!processResponse.ok) {
        const error = await processResponse.json();
        console.error("[StoryUpload] Failed to start processing:", error);
        throw new Error(error.error || "Failed to process story");
      }

      console.log("[StoryUpload] Processing started, beginning poll loop...");

      // Store story ID for potential retry
      pollingStoryIdRef.current = story.id;

      // Poll for status updates
      // Large books like Dracula (27 chapters) can take 30-60 minutes
      // Each chapter takes ~30-90 seconds to translate
      // Poll every 5 seconds to reduce database transfer costs
      let attempts = pollingAttemptsRef.current; // Resume from last position on retry
      const maxAttempts = 720; // 1 hour max (720 * 5s = 3600 seconds)
      const pollIntervalMs = 5000;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3; // Show connection-lost after 3 failures (15 seconds)

      while (attempts < maxAttempts) {
        if (controller.signal.aborted) {
          console.log("[StoryUpload] Upload cancelled by user");
          throw new Error("Upload cancelled");
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        // Use lightweight status endpoint to minimize data transfer
        let statusResponse: Response;
        try {
          statusResponse = await fetch(`/api/user-stories/${story.id}/status`, {
            signal: controller.signal,
          });
        } catch (fetchError: any) {
          // Network error (not HTTP error)
          if (fetchError.name === "AbortError") {
            throw fetchError;
          }
          consecutiveFailures++;
          console.warn("[StoryUpload] Network error during poll", {
            attempt: attempts + 1,
            consecutiveFailures,
            error: fetchError.message
          });

          if (consecutiveFailures >= maxConsecutiveFailures) {
            pollingAttemptsRef.current = attempts; // Save position for retry
            updateProgress("connection-lost", 0, {
              error: "Connection lost. Check your internet connection.",
            });
            return; // Exit polling - user can retry
          }
          attempts++;
          continue;
        }

        if (!statusResponse.ok) {
          consecutiveFailures++;
          console.warn("[StoryUpload] Poll attempt failed", {
            attempt: attempts + 1,
            consecutiveFailures,
            status: statusResponse.status
          });

          if (consecutiveFailures >= maxConsecutiveFailures) {
            pollingAttemptsRef.current = attempts; // Save position for retry
            updateProgress("connection-lost", 0, {
              error: "Connection lost. Check your internet connection.",
            });
            return; // Exit polling - user can retry
          }
          attempts++;
          continue;
        }

        // Success - reset consecutive failures
        consecutiveFailures = 0;

        const statusData = await statusResponse.json();
        const storyStatus = statusData.story;

        // Log status every 2 attempts (every 10 seconds)
        if (attempts % 2 === 0 || attempts === 0) {
          console.log("[StoryUpload] Poll status:", {
            attempt: attempts + 1,
            status: storyStatus.status,
            detectedLevel: storyStatus.detectedLevel,
            levelsCount: storyStatus.levels?.length || 0,
          });
        }

        // Update progress based on status
        if (storyStatus.status === "PROCESSING") {
          // Get user's level from session
          const userQuizLevel = session?.user?.quizLevel;
          const userLevel = typeof userQuizLevel === "number" ? `l${userQuizLevel}` : userQuizLevel || null;
          const detectedLevel = storyStatus.detectedLevel;

          // Update sourceLanguage as soon as it's detected (before story is complete)
          // This ensures the progress viewer modal shows the correct language columns
          if (storyStatus.sourceLanguage && storyData?.sourceLanguage !== storyStatus.sourceLanguage) {
            setStoryData(prev => prev ? { ...prev, sourceLanguage: storyStatus.sourceLanguage } : null);
          }

          // Get story-level progress (detailed step info)
          const storyProgress = storyStatus.processingProgress as StoryProcessingProgress | null;

          // Use backend totalWords (available after parsing) or frontend word count as fallback
          const totalWords = storyProgress?.totalWords || uploadedWordCountRef.current || undefined;

          // Check level statuses to determine progress
          const levels = storyStatus.levels || [];
          const processingLevel = levels.find((l: any) => l.status === "PROCESSING");
          const completedLevels = levels.filter((l: any) => l.status === "READY").length;
          // We only process 1-2 levels (detected + user's level if different)
          const totalLevelsToProcess = userLevel && userLevel !== detectedLevel ? 2 : 1;

          // Build streams for parallel progress tracking
          const streams = buildStreamsFromLevels(levels, detectedLevel);

          // Use story-level progress if available for detailed step info
          const phase = storyProgress?.phase;
          const stepLabel = storyProgress?.stepLabel;
          const phaseTitle = phase ? PHASE_TITLES[phase] : undefined;

          // Debug: log branch selection for progress tracking
          if (attempts % 2 === 0) {
            console.log("[StoryUpload] Progress branch:", {
              hasProcessingLevel: !!processingLevel,
              processingLevelStatus: processingLevel?.status,
              hasProcessingProgress: !!processingLevel?.processingProgress,
              processingProgress: processingLevel?.processingProgress ? {
                stage: (processingLevel.processingProgress as any).stage,
                currentChapter: (processingLevel.processingProgress as any).currentChapter,
                totalChapters: (processingLevel.processingProgress as any).totalChapters,
                chaptersCompleted: (processingLevel.processingProgress as any).chaptersCompleted?.length,
              } : null,
              completedLevels,
              totalWords,
              storyPhase: storyProgress?.phase,
              storyStep: storyProgress?.step,
              processingStartTime: processingStartTimeRef.current,
            });
          }

          if (!processingLevel && completedLevels === 0) {
            // Still in early stages (language/level detection, description generation)
            // Use detailed progress from backend if available
            if (storyProgress) {
              const stageMap: Record<string, UploadStage> = {
                detecting_language: "detecting-language",
                generating_title: "detecting-language",
                generating_description: "generating-description",
                generating_hook: "generating-description",
                detecting_story_type: "generating-description",
                detecting_audience: "generating-description",
                extracting_tags: "generating-description",
                detecting_level: "detecting-level",
              };
              const stage = stageMap[storyProgress.step] || "detecting-level";
              setProgress(prev => {
                const newOverall = Math.max(prev.overallProgress, calculateProgressForPhase(storyProgress.phase, storyProgress.step, totalWords));
                return {
                  ...prev,
                  stage,
                  stageProgress: 50,
                  overallProgress: newOverall,
                  detectedLevel,
                  userLevel: userLevel || undefined,
                  message: getStageMessage(stage, { detectedLevel, userLevel: userLevel || undefined }),
                  phase,
                  stepLabel,
                  phaseTitle,
                  streams,
                };
              });
            } else if (detectedLevel) {
              updateProgress("generating-description", 50, { detectedLevel, userLevel: userLevel || undefined });
            } else {
              updateProgress("detecting-level", 50, { userLevel: userLevel || undefined });
            }
          } else if (processingLevel?.processingProgress) {
            // Use granular progress from the backend
            const progress = processingLevel.processingProgress as {
              stage: 'rewriting' | 'translating' | 'complete';
              currentChapter: number;
              totalChapters: number;
              chaptersCompleted: number[];
              completedData?: { sourceLines: string[]; translatedLines: string[] }[];
              rewriteData?: { originalLines: string[]; rewrittenLines: string[] }[];
            };

            // Record when processing started (first time we see a level processing)
            if (!processingStartTimeRef.current) {
              processingStartTimeRef.current = Date.now();
            }

            const completedCount = progress.chaptersCompleted?.length || 0;
            const elapsedS = (Date.now() - processingStartTimeRef.current) / 1000;

            // Calculate phase boundaries
            const { detectingPct, processingPct } = totalWords
              ? calculatePhasePercentages(totalWords)
              : { detectingPct: 30, processingPct: 60 };

            // Time-based progress: ticks smoothly based on elapsed time
            // Tied to one translation pass (totalWords / WORDS_PER_SECOND)
            let chapterProgress: number;
            let overallProgress: number;

            if (progress.stage === 'complete') {
              chapterProgress = 100;
              overallProgress = Math.round(detectingPct + processingPct);
            } else if (totalWords) {
              chapterProgress = calculateTimeBasedProcessingProgress(
                elapsedS, totalWords, completedCount, progress.totalChapters
              );
              overallProgress = Math.round(detectingPct + (chapterProgress / 100) * processingPct);
            } else {
              // Fallback without word count: use chapter completion only
              chapterProgress = progress.totalChapters > 0
                ? (completedCount / progress.totalChapters) * 100
                : 0;
              overallProgress = Math.round(detectingPct + (chapterProgress / 100) * processingPct);
            }

            if (progress.stage === 'rewriting') {
              // Rewriting stage - use calculated overall progress
              setProgress(prev => ({
                ...prev,
                stage: "rewriting-levels",
                stageProgress: chapterProgress,
                overallProgress: Math.max(prev.overallProgress, overallProgress),
                currentLevel: processingLevel.level,
                userLevel: userLevel || undefined,
                detectedLevel,
                currentChapter: progress.currentChapter,
                totalChapters: progress.totalChapters,
                rewriteChapters: progress.rewriteData || [],
                message: getStageMessage("rewriting-levels", {
                  userLevel: userLevel || undefined,
                  detectedLevel,
                  currentLevel: processingLevel.level,
                  currentChapter: progress.currentChapter,
                  totalChapters: progress.totalChapters,
                }),
                phase,
                stepLabel,
                phaseTitle,
                streams,
              }));
            } else if (progress.stage === 'translating') {
              // Translating stage - use calculated overall progress
              setProgress(prev => ({
                ...prev,
                stage: "translating",
                stageProgress: chapterProgress,
                overallProgress: Math.max(prev.overallProgress, overallProgress),
                userLevel: userLevel || undefined,
                detectedLevel,
                currentChapter: progress.currentChapter,
                totalChapters: progress.totalChapters,
                completedChapters: progress.completedData || [],
                message: getStageMessage("translating", {
                  userLevel: userLevel || undefined,
                  detectedLevel,
                  currentChapter: progress.currentChapter,
                  totalChapters: progress.totalChapters,
                }),
                phase,
                stepLabel,
                phaseTitle,
                streams,
              }));
            }
          } else {
            // Fallback: level is processing but no granular progress yet
            if (!processingStartTimeRef.current) {
              processingStartTimeRef.current = Date.now();
            }
            const { detectingPct } = totalWords
              ? calculatePhasePercentages(totalWords)
              : { detectingPct: 30 };
            setProgress(prev => ({
              ...prev,
              stage: "rewriting-levels",
              stageProgress: 0,
              overallProgress: Math.max(prev.overallProgress, Math.round(detectingPct)),
              currentLevel: processingLevel?.level,
              userLevel: userLevel || undefined,
              detectedLevel,
              message: getStageMessage("rewriting-levels", {
                currentLevel: processingLevel?.level,
                userLevel: userLevel || undefined,
                detectedLevel,
              }),
              phase,
              stepLabel,
              phaseTitle,
              streams,
            }));
          }
        } else if (storyStatus.status === "READY" || storyStatus.status === "PARTIAL") {
          // PARTIAL means some levels succeeded (e.g., detected level worked but user's level was too long to rewrite)
          // We treat this as success since the user can still read at the detected level
          console.log("[StoryUpload] Story processing complete!", {
            id: storyStatus.id,
            title: storyStatus.title,
            detectedLevel: storyStatus.detectedLevel,
            sourceLanguage: storyStatus.sourceLanguage,
            status: storyStatus.status,
          });

          // Update story data with final values
          // Use localized description based on source language, with fallbacks
          const finalDescription = storyStatus.description
            || (storyStatus.sourceLanguage === "es" ? storyStatus.descriptionEs : storyStatus.descriptionEn)
            || storyStatus.descriptionEs
            || storyStatus.descriptionEn
            || "";

          // Use localized hook based on source language
          const finalHook = storyStatus.hook
            || (storyStatus.sourceLanguage === "es" ? storyStatus.hookEs : storyStatus.hookEn)
            || "";

          setStoryData(prev => prev ? {
            ...prev,
            id: storyStatus.id,
            title: storyStatus.title || prev.title,
            titleGenerated: !optionalTitle,
            description: finalDescription,
            descriptionGenerated: true,
            sourceLanguage: storyStatus.sourceLanguage || "es",
            sourceLanguageDetected: true,
            detectedLevel: storyStatus.detectedLevel || "B1",
            thumbnailUrl: storyStatus.thumbnailUrl,
            // New metadata fields
            storyType: storyStatus.storyType || undefined,
            storyTypeDetected: !!storyStatus.storyType,
            targetAudience: storyStatus.targetAudience || undefined,
            targetAudienceDetected: !!storyStatus.targetAudience,
            tags: storyStatus.tags || [],
            tagsDetected: Array.isArray(storyStatus.tags) && storyStatus.tags.length > 0,
            hook: finalHook,
            hookEs: storyStatus.hookEs || undefined,
            hookEn: storyStatus.hookEn || undefined,
            hookDetected: !!storyStatus.hook || !!storyStatus.hookEs || !!storyStatus.hookEn,
          } : null);

          // Build final streams from completed levels for preview
          const finalLevels = storyStatus.levels || [];
          const finalStreams = buildStreamsFromLevels(finalLevels, storyStatus.detectedLevel);

          updateProgress("review", 100, {
            phase: "finalizing",
            phaseTitle: PHASE_TITLES.finalizing,
            stepLabel: "Ready for review",
            streams: finalStreams,
            detectedLevel: storyStatus.detectedLevel,
          });
          setShowReviewModal(true);
          setIsMinimized(false);
          break;
        } else if (storyStatus.status === "FAILED") {
          console.error("[StoryUpload] Story processing failed on server");
          throw new Error("Story processing failed");
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.error("[StoryUpload] Processing timed out after", maxAttempts, "attempts");
        throw new Error("Processing timed out");
      }

    } catch (error: any) {
      // Don't log AbortError as an error - it's expected when user cancels
      if (error.name === "AbortError" || error.message === "Upload cancelled") {
        console.log("[StoryUpload] Upload cancelled by user");
        updateProgress("idle", 0);
      } else {
        console.error("[StoryUpload] Error during upload:", error.message, error);
        updateProgress("error", 0, { error: error.message });
      }
    } finally {
      setAbortController(null);
    }
  }, [updateProgress, session?.user?.quizLevel]);

  const cancelUpload = useCallback(async () => {
    console.log("[StoryUpload] cancelUpload called");
    setIsCancelling(true);

    // Use ref for story ID (immediately available, not dependent on React state)
    const storyId = storyIdRef.current;

    // First, call the cancel API to stop server-side processing
    if (storyId) {
      try {
        console.log("[StoryUpload] Calling cancel API for story:", storyId);
        const response = await fetch(`/api/user-stories/${storyId}/cancel`, {
          method: "POST",
        });

        if (!response.ok) {
          console.error("[StoryUpload] Cancel API failed:", response.status);
        } else {
          const result = await response.json();
          console.log("[StoryUpload] Cancel API response:", result);
        }
      } catch (error) {
        console.error("[StoryUpload] Cancel API error:", error);
      }
    } else {
      console.log("[StoryUpload] No story ID yet, setting deferred cancel flag");
      // Set flag so the story will be cancelled after creation completes
      cancelRequestedRef.current = true;
    }

    // Then abort client-side requests
    if (abortController) {
      abortController.abort();
    }

    // Reset UI state
    setIsUploading(false);
    setIsMinimized(false);
    setShowCancelConfirm(false);
    setIsCancelling(false);
    setProgress({
      stage: "idle",
      stageProgress: 0,
      overallProgress: 0,
      message: "",
    });
    setStoryData(null);

    // Clear persisted upload state
    persistUploadState(null);

    // Only clear refs if we had a story ID (immediate cancel)
    // If no story ID, leave cancelRequestedRef set for deferred cancel
    if (storyId) {
      storyIdRef.current = null;
      cancelRequestedRef.current = false;
    }
    // Note: if !storyId, cancelRequestedRef stays true and will be handled
    // when the create POST completes in startUpload

    // Trigger refetch in story list pages
    setLastCancelledAt(Date.now());
  }, [abortController]);

  // Show cancel confirmation dialog
  const requestCancel = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  // Dismiss cancel confirmation without canceling
  const dismissCancelConfirm = useCallback(() => {
    setShowCancelConfirm(false);
  }, []);

  const toggleMinimized = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const updateStoryData = useCallback((updates: Partial<StoryUploadData>) => {
    setStoryData(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const confirmStory = useCallback(async () => {
    if (!storyData?.id) return;

    try {
      // Update story with any user edits (including new metadata fields)
      await fetch(`/api/user-stories/${storyData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyData.title,
          description: storyData.description,
          thumbnailUrl: storyData.thumbnailUrl,
          storyType: storyData.storyType,
          targetAudience: storyData.targetAudience,
          tags: storyData.tags,
          hook: storyData.hook,
          hookEs: storyData.hookEs,
          hookEn: storyData.hookEn,
        }),
      });

      setShowReviewModal(false);
      setIsUploading(false);
      storyIdRef.current = null; // Clear the ref
      setLastConfirmedAt(Date.now()); // Signal to UI to refresh story list

      // Clear persisted upload state - upload is complete
      persistUploadState(null);

      // Show success state - the banner will appear whether user is reading or not
      // This ensures users always know when processing completes
      console.log("[StoryUpload] Processing complete, showing success state", { isReadingCurrentStory });
      updateProgress("complete", 100, {
        phase: "finalizing",
        phaseTitle: PHASE_TITLES.finalizing,
        stepLabel: "All done!",
      });
      // Note: Don't auto-reset the progress state here.
      // The banner will stay visible until the user dismisses it
      // or until a new upload starts.
      // If user is already reading, the banner shows completion status.

    } catch (error: any) {
      updateProgress("error", 0, { error: error.message });
    }
  }, [storyData, updateProgress]);

  // Retry connection after connection-lost - triggers effect to resume polling
  const retryConnection = useCallback(() => {
    if (progress.stage === "connection-lost" && pollingStoryIdRef.current) {
      console.log("[StoryUpload] Retrying connection...");
      setRetryTrigger(prev => prev + 1);
    }
  }, [progress.stage]);

  // Reset progress state (called after navigation completes)
  const resetProgress = useCallback(() => {
    console.log("[StoryUpload] resetProgress called - stack trace:", new Error().stack);
    setProgress({
      stage: "idle",
      stageProgress: 0,
      overallProgress: 0,
      message: "",
    });
    setStoryData(null);
    setIsReadingCurrentStory(false);
    // Clear persisted upload state
    persistUploadState(null);
  }, []);

  // Effect to handle reconnecting after state loss
  useEffect(() => {
    if (progress.stage !== "reconnecting") return;
    if (!pollingStoryIdRef.current) return;

    console.log("[StoryUpload] Reconnecting after state loss...");

    // Trigger the regular polling retry mechanism
    setRetryTrigger(prev => prev + 1);
    // Update stage to connection-lost so the retry effect can pick it up
    setProgress(prev => ({
      ...prev,
      stage: "connection-lost",
    }));
  }, [progress.stage]);

  // Effect to resume polling when retry is triggered
  useEffect(() => {
    if (retryTrigger === 0) return; // Skip initial render
    if (progress.stage !== "connection-lost") return;
    if (!pollingStoryIdRef.current || !storyData?.id) return;

    console.log("[StoryUpload] Resuming polling after retry...");

    // Resume polling with a fresh controller
    const resumePolling = async () => {
      const controller = new AbortController();
      setAbortController(controller);

      // Reset to previous stage (we'll update based on actual status)
      setProgress(prev => ({
        ...prev,
        stage: "translating", // Assume we were translating
        error: undefined,
      }));

      const storyId = pollingStoryIdRef.current!;
      let attempts = pollingAttemptsRef.current;
      const maxAttempts = 720;
      const pollIntervalMs = 5000;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      while (attempts < maxAttempts) {
        if (controller.signal.aborted) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        let statusResponse: Response;
        try {
          statusResponse = await fetch(`/api/user-stories/${storyId}/status`, {
            signal: controller.signal,
          });
        } catch (fetchError: any) {
          if (fetchError.name === "AbortError") return;
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            pollingAttemptsRef.current = attempts;
            updateProgress("connection-lost", 0, {
              error: "Connection lost. Check your internet connection.",
            });
            return;
          }
          attempts++;
          continue;
        }

        if (!statusResponse.ok) {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            pollingAttemptsRef.current = attempts;
            updateProgress("connection-lost", 0, {
              error: "Connection lost. Check your internet connection.",
            });
            return;
          }
          attempts++;
          continue;
        }

        // Success!
        consecutiveFailures = 0;
        const statusData = await statusResponse.json();
        const storyStatus = statusData.story;

        if (storyStatus.status === "READY" || storyStatus.status === "PARTIAL") {
          // Complete - update story data and show review
          setStoryData(prev => prev ? {
            ...prev,
            title: storyStatus.title || prev.title,
            description: storyStatus.description || prev.description,
            detectedLevel: storyStatus.detectedLevel || prev.detectedLevel,
          } : null);
          updateProgress("review", 100);
          setShowReviewModal(true);
          return;
        } else if (storyStatus.status === "FAILED") {
          updateProgress("error", 0, { error: "Story processing failed" });
          return;
        }

        // Still processing - update progress and continue
        attempts++;
      }
    };

    resumePolling();
  }, [retryTrigger, progress.stage, storyData?.id, updateProgress]);

  const value: StoryUploadContextType = {
    isUploading,
    isMinimized,
    progress,
    storyData,
    showUploadModal,
    showReviewModal,
    showProgressViewer,
    showCancelConfirm,
    lastConfirmedAt,
    lastCancelledAt,
    selectedStreamId,
    isReadingCurrentStory,
    startUpload,
    cancelUpload,
    requestCancel,
    dismissCancelConfirm,
    toggleMinimized,
    minimize,
    setShowUploadModal,
    setShowReviewModal,
    setShowProgressViewer,
    setSelectedStreamId,
    updateStoryData,
    confirmStory,
    retryConnection,
    resetProgress,
    setIsReadingCurrentStory,
  };

  // Get selected stream for modal, or fall back to legacy behavior
  const selectedStream = selectedStreamId
    ? progress.streams?.find(s => s.id === selectedStreamId)
    : null;

  // Build ComparisonModal props from stream/progress data
  const getComparisonModalProps = () => {
    // Determine source data
    let chapters: ChapterData[] = [];
    let rewriteChapters: RewriteChapterData[] = [];
    let isRewriting: boolean;
    let currentChapter: number;
    let totalChapters: number;
    let detectedLevel: string | undefined;
    let targetLevel: string | undefined;
    let isInProgress: boolean;

    if (selectedStream) {
      isRewriting = selectedStream.type === "rewriting";
      if (isRewriting) {
        rewriteChapters = selectedStream.chapters as RewriteChapterData[];
      } else {
        chapters = selectedStream.chapters as ChapterData[];
      }
      currentChapter = selectedStream.currentChapter;
      totalChapters = selectedStream.totalChapters;
      detectedLevel = selectedStream.fromLevel || progress.detectedLevel;
      targetLevel = selectedStream.level;
      isInProgress = selectedStream.status === "in-progress";
    } else {
      isRewriting = progress.stage === "rewriting-levels";
      chapters = progress.completedChapters || [];
      rewriteChapters = progress.rewriteChapters || [];
      currentChapter = progress.currentChapter || 0;
      totalChapters = progress.totalChapters || 0;
      detectedLevel = progress.detectedLevel;
      targetLevel = progress.currentLevel;
      isInProgress = progress.stage === "rewriting-levels" || progress.stage === "translating";
    }

    // Prefer fetched data when available (reflects saved edits from DB)
    if (isRewriting && fetchedRewriteChapters.length > 0) {
      rewriteChapters = fetchedRewriteChapters;
    } else if (!isRewriting && fetchedChapters.length > 0) {
      chapters = fetchedChapters;
    }

    // Convert chapter arrays to text strings for ComparisonModal
    const chapterArrays = isRewriting
      ? rewriteChapters.map(ch => ({ left: ch.originalLines || [], right: ch.rewrittenLines || [] }))
      : chapters.map(ch => ({ left: ch.sourceLines || [], right: ch.translatedLines || [] }));
    const { leftText, rightText } = chaptersToText(chapterArrays);

    // Determine titles
    const sourceLanguage = storyData?.sourceLanguage || "es";
    let leftTitle: string;
    let rightTitle: string;
    if (isRewriting) {
      const fromLabel = detectedLevel ? getCEFRLabel(toCEFR(detectedLevel), providerLng) : t(providerLng, "upload", "original");
      const toLabel = targetLevel ? getCEFRLabel(toCEFR(targetLevel), providerLng) : t(providerLng, "upload", "rewritten");
      leftTitle = `${fromLabel} (${t(providerLng, "upload", "original")})`;
      rightTitle = `${toLabel} (${t(providerLng, "upload", "rewritten")})`;
    } else {
      leftTitle = sourceLanguage === "en" ? t(providerLng, "upload", "englishSource") : t(providerLng, "upload", "spanishSource");
      rightTitle = sourceLanguage === "en" ? t(providerLng, "upload", "spanishTranslation") : t(providerLng, "upload", "englishTranslation");
    }

    // Header gradient
    const headerGradient = isRewriting
      ? "bg-gradient-to-r from-amber-500 to-orange-500"
      : "bg-gradient-to-r from-blue-600 to-purple-600";

    // Progress bar gradient
    const barGradient = isRewriting
      ? "bg-gradient-to-r from-amber-400 to-orange-400"
      : "bg-gradient-to-r from-blue-500 to-purple-500";

    // Progress percentage
    const completedChaptersCount = chapterArrays.length;
    const progressPct = totalChapters > 0
      ? Math.round((completedChaptersCount / totalChapters) * 100)
      : undefined;

    // Processing badge (only during live processing, not preview)
    const isPreview = !!selectedStreamId || progress.stage === "review" || progress.stage === "complete";
    let badge: string | undefined;
    if (!isPreview && isInProgress) {
      badge = isRewriting
        ? t(providerLng, "upload", "rewritingChapter", { current: currentChapter })
        : t(providerLng, "upload", "translatingChapterLive", { current: currentChapter });
    }

    // Blank line label (i18n)
    const blankLabel = t(providerLng, "upload", "paragraphBreak");

    // Extract alignment issues from chapter data (if available)
    // The raw data from processingProgress.completedData preserves alignmentIssues
    let chapterAlignmentIssuesMap: Record<number, ChapterAlignmentResult> | undefined;
    if (!isRewriting) {
      const rawChapters = chapters as any[];
      const issueMap: Record<number, ChapterAlignmentResult> = {};
      let hasAny = false;
      for (let i = 0; i < rawChapters.length; i++) {
        const ai = rawChapters[i]?.alignmentIssues;
        if (ai?.hasIssues) {
          issueMap[i + 1] = ai;
          hasAny = true;
        }
      }
      if (hasAny) {
        chapterAlignmentIssuesMap = issueMap;
      }
    }

    return {
      leftText,
      rightText,
      leftTitle,
      rightTitle,
      headerGradient,
      progressPercent: progressPct,
      progressBarGradient: barGradient,
      processingBadge: badge,
      totalExpectedChapters: totalChapters > 0 ? totalChapters : undefined,
      isLoading: isFetchingPreview,
      loadingError: fetchPreviewError || undefined,
      blankLineLabel: blankLabel,
      chapterAlignmentIssues: chapterAlignmentIssuesMap,
    };
  };

  const comparisonProps = getComparisonModalProps();

  // Determine if the current stream is editable (completed translation with a saved story)
  const isStreamEditable = !!(
    selectedStream &&
    selectedStream.type === "translating" &&
    selectedStream.status === "complete" &&
    storyData?.id
  );

  // Save handler for editing translations in the comparison modal
  const handleComparisonSave = async (edits: { left?: string; right?: string }) => {
    if (!storyData?.id || !selectedStream) return;
    try {
      const res = await fetch(`/api/user-stories/${storyData.id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: selectedStream.level,
          sourceText: edits.left,
          translatedText: edits.right,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const result = await res.json();
      console.log(`[StoryUploadContext] Saved comparison edits for level ${selectedStream.level}`);

      // Re-fetch preview data so in-memory state reflects saved edits
      try {
        const previewRes = await fetch(
          `/api/user-stories/${storyData.id}/preview?level=${encodeURIComponent(selectedStream.level)}&type=translating`
        );
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          const refreshedChapters: ChapterData[] = previewData.chapters || [];
          setFetchedChapters(refreshedChapters);

          // Also update the stream's in-memory chapters so close/reopen stays current
          setProgress(prev => ({
            ...prev,
            streams: prev.streams?.map(s =>
              s.id === selectedStream.id
                ? {
                    ...s,
                    chapters: refreshedChapters,
                    hasAlignmentIssues: result.hasAlignmentIssues || undefined,
                  }
                : s
            ),
          }));
        }
      } catch (fetchErr) {
        console.warn("[StoryUploadContext] Failed to refresh preview after save:", fetchErr);
      }
    } catch (error: any) {
      console.error("[StoryUploadContext] Save comparison failed:", error.message);
      alert(error.message || "Failed to save changes");
    }
  };

  return (
    <StoryUploadContext.Provider value={value}>
      {children}

      {/* Progress Viewer Modal - uses unified ComparisonModal */}
      <ComparisonModal
        isOpen={showProgressViewer}
        onClose={() => {
          setShowProgressViewer(false);
          setSelectedStreamId(null);
        }}
        level={null}
        leftTitle={comparisonProps.leftTitle}
        leftText={comparisonProps.leftText}
        rightTitle={comparisonProps.rightTitle}
        rightText={comparisonProps.rightText}
        editableSide={isStreamEditable ? "both" : "none"}
        onSave={isStreamEditable ? handleComparisonSave : undefined}
        headerGradient={comparisonProps.headerGradient}
        blankLineLabel={comparisonProps.blankLineLabel}
        progressPercent={comparisonProps.progressPercent}
        progressBarGradient={comparisonProps.progressBarGradient}
        processingBadge={comparisonProps.processingBadge}
        totalExpectedChapters={comparisonProps.totalExpectedChapters}
        isLoading={comparisonProps.isLoading}
        loadingError={comparisonProps.loadingError}
        chapterAlignmentIssues={comparisonProps.chapterAlignmentIssues}
      />

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t(providerLng, "upload", "cancelUploadTitle")}
            </h3>
            <p className="text-gray-600 mb-6">
              {t(providerLng, "upload", "cancelUploadMessage")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={dismissCancelConfirm}
                disabled={isCancelling}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-default"
              >
                {t(providerLng, "upload", "keepUploading")}
              </button>
              <button
                onClick={cancelUpload}
                disabled={isCancelling}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-default flex items-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t(providerLng, "upload", "cancelling")}
                  </>
                ) : (
                  t(providerLng, "upload", "yesCancelUpload")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </StoryUploadContext.Provider>
  );
}

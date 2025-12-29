"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ProgressViewerModal } from "@/components/user-stories/ProgressViewerModal";

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
  | "error";

export interface ChapterData {
  sourceLines: string[];
  translatedLines: string[];
}

export interface RewriteChapterData {
  originalLines: string[];
  rewrittenLines: string[];
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
}

interface StartUploadOptions {
  content: string;
  title?: string;
  sourceLanguage?: "en" | "es";
  description?: string;
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

  // Actions
  startUpload: (options: StartUploadOptions) => Promise<void>;
  cancelUpload: () => void;
  toggleMinimized: () => void;
  setShowUploadModal: (show: boolean) => void;
  setShowReviewModal: (show: boolean) => void;
  setShowProgressViewer: (show: boolean) => void;
  updateStoryData: (updates: Partial<StoryUploadData>) => void;
  confirmStory: () => Promise<void>;
}

const StoryUploadContext = createContext<StoryUploadContextType | null>(null);

export function useStoryUpload() {
  const context = useContext(StoryUploadContext);
  if (!context) {
    throw new Error("useStoryUpload must be used within StoryUploadProvider");
  }
  return context;
}

// Stage weights for initial processing (before per-level work)
// Levels (rewriting + translating) take 30-90% of total progress
const STAGE_WEIGHTS: Record<UploadStage, { start: number; end: number }> = {
  idle: { start: 0, end: 0 },
  uploading: { start: 0, end: 5 },
  "detecting-language": { start: 5, end: 10 },
  "detecting-level": { start: 10, end: 20 },
  "generating-description": { start: 20, end: 30 },
  // These stages are now calculated dynamically based on level progress
  "rewriting-levels": { start: 30, end: 60 },
  translating: { start: 60, end: 90 },
  finalizing: { start: 90, end: 95 },
  review: { start: 95, end: 95 },
  complete: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
};

// Helper to calculate overall progress accounting for multi-level processing
function calculateMultiLevelProgress(
  stage: 'rewriting' | 'translating' | 'complete',
  currentLevel: number, // 0-indexed
  totalLevels: number,
  chapterProgress: number, // 0-100 within current level
  isRewriteNeeded: boolean
): number {
  // Levels take from 30% to 90% of total progress
  const levelStart = 30;
  const levelEnd = 90;
  const levelRange = levelEnd - levelStart;

  // Each level gets an equal share of the level range
  const perLevelRange = levelRange / totalLevels;
  const levelBase = levelStart + (currentLevel * perLevelRange);

  // Within each level: rewrite (if needed) takes 40%, translate takes 60%
  let withinLevelProgress: number;
  if (stage === 'complete') {
    withinLevelProgress = 100;
  } else if (stage === 'rewriting') {
    // Rewriting is 0-40% of level work
    withinLevelProgress = chapterProgress * 0.4;
  } else {
    // Translating is 40-100% of level work (or 0-100 if no rewrite needed)
    if (isRewriteNeeded) {
      withinLevelProgress = 40 + (chapterProgress * 0.6);
    } else {
      withinLevelProgress = chapterProgress;
    }
  }

  return Math.round(levelBase + (withinLevelProgress / 100) * perLevelRange);
}

// Map level codes to CEFR labels
const levelToCEFR: Record<string, string> = {
  l1: "A1",
  l2: "A2",
  l3: "B1",
  l4: "B2",
  l5: "C1",
  l6: "C2",
};

// Generate stage message based on context
function getStageMessage(
  stage: UploadStage,
  extra?: { userLevel?: string; detectedLevel?: string; currentLevel?: string; currentChapter?: number; totalChapters?: number }
): string {
  const userCEFR = extra?.userLevel ? levelToCEFR[extra.userLevel] || extra.userLevel : null;
  const detectedCEFR = extra?.detectedLevel ? levelToCEFR[extra.detectedLevel] || extra.detectedLevel : null;
  // Chapter info is now displayed as subtitle in UI, not in message

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
      // Show which text is being translated with CEFR level
      if (userCEFR && detectedCEFR && userCEFR !== detectedCEFR) {
        return `Translating (${userCEFR} text)`;
      }
      return `Translating (${detectedCEFR || "original"} text)`;
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

export function StoryUploadProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showProgressViewer, setShowProgressViewer] = useState(false);
  const [storyData, setStoryData] = useState<StoryUploadData | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({
    stage: "idle",
    stageProgress: 0,
    overallProgress: 0,
    message: "",
  });

  // Abort controller for cancellation
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const updateProgress = useCallback((stage: UploadStage, stageProgress: number = 0, extra?: Partial<UploadProgress>) => {
    const weights = STAGE_WEIGHTS[stage];
    const overallProgress = weights.start + ((weights.end - weights.start) * stageProgress) / 100;

    // Merge with existing progress to preserve userLevel/detectedLevel
    setProgress(prev => {
      const merged = {
        ...prev,
        stage,
        stageProgress,
        overallProgress: Math.round(overallProgress),
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
    const { content, title: optionalTitle, sourceLanguage, description } = options;
    const controller = new AbortController();
    setAbortController(controller);
    setIsUploading(true);
    setIsMinimized(false);
    setShowUploadModal(false);

    console.log("[StoryUpload] Starting upload", {
      contentLength: content.length,
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
      updateProgress("uploading", 50);

      const createResponse = await fetch("/api/user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title: optionalTitle || "Untitled Story",
          sourceLanguage,
          description,
        }),
        signal: controller.signal,
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error("[StoryUpload] Failed to create story:", error);
        throw new Error(error.error || "Failed to create story");
      }

      const { story } = await createResponse.json();
      console.log("[StoryUpload] Story created:", { id: story.id, slug: story.slug });
      updateProgress("uploading", 100);

      setStoryData(prev => prev ? { ...prev, id: story.id } : null);

      // Stage 2: Process the story (this triggers the AI pipeline)
      console.log("[StoryUpload] Stage 2: Starting AI processing...");
      updateProgress("detecting-language", 0);

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

      // Poll for status updates
      // Large books like Dracula (27 chapters) can take 30-60 minutes
      // Each chapter takes ~30-90 seconds to translate
      // Poll every 5 seconds to reduce database transfer costs
      let attempts = 0;
      const maxAttempts = 720; // 1 hour max (720 * 5s = 3600 seconds)
      const pollIntervalMs = 5000;

      while (attempts < maxAttempts) {
        if (controller.signal.aborted) {
          console.log("[StoryUpload] Upload cancelled by user");
          throw new Error("Upload cancelled");
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        // Use lightweight status endpoint to minimize data transfer
        const statusResponse = await fetch(`/api/user-stories/${story.id}/status`, {
          signal: controller.signal,
        });

        if (!statusResponse.ok) {
          console.warn("[StoryUpload] Poll attempt failed, retrying...", { attempt: attempts + 1 });
          attempts++;
          continue;
        }

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

          // Check level statuses to determine progress
          const levels = storyStatus.levels || [];
          const processingLevel = levels.find((l: any) => l.status === "PROCESSING");
          const completedLevels = levels.filter((l: any) => l.status === "READY").length;
          // We only process 1-2 levels (detected + user's level if different)
          const totalLevelsToProcess = userLevel && userLevel !== detectedLevel ? 2 : 1;

          if (!processingLevel && completedLevels === 0) {
            // Still in early stages (language/level detection, description generation)
            if (detectedLevel) {
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

            // Calculate chapter progress within current level
            const chapterProgress = progress.totalChapters > 0
              ? (progress.chaptersCompleted.length / progress.totalChapters) * 100
              : 0;

            // Determine if this level needs rewriting (user level differs from detected)
            const isRewriteNeeded = processingLevel.level !== detectedLevel;

            // Calculate overall progress accounting for multi-level processing
            const overallProgress = calculateMultiLevelProgress(
              progress.stage,
              completedLevels, // Current level index (0-indexed based on completed count)
              totalLevelsToProcess,
              chapterProgress,
              isRewriteNeeded
            );

            if (progress.stage === 'rewriting') {
              // Rewriting stage - use calculated overall progress
              setProgress(prev => ({
                ...prev,
                stage: "rewriting-levels",
                stageProgress: chapterProgress,
                overallProgress,
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
              }));
            } else if (progress.stage === 'translating') {
              // Translating stage - use calculated overall progress
              setProgress(prev => ({
                ...prev,
                stage: "translating",
                stageProgress: chapterProgress,
                overallProgress,
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
              }));
            }
          } else {
            // Fallback: level is processing but no granular progress yet
            const levelProgress = (completedLevels / totalLevelsToProcess) * 100;
            updateProgress("rewriting-levels", levelProgress, {
              currentLevel: processingLevel?.level,
              userLevel: userLevel || undefined,
              detectedLevel,
            });
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

          setStoryData(prev => prev ? {
            ...prev,
            id: storyStatus.id,
            title: storyStatus.title || prev.title,
            titleGenerated: !optionalTitle,
            description: finalDescription,
            descriptionGenerated: true,
            sourceLanguage: storyStatus.sourceLanguage || "es",
            sourceLanguageDetected: true,
            detectedLevel: storyStatus.detectedLevel || "l3",
            thumbnailUrl: storyStatus.thumbnailUrl,
          } : null);

          updateProgress("review", 100);
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
      console.error("[StoryUpload] Error during upload:", error.message, error);
      if (error.name === "AbortError" || error.message === "Upload cancelled") {
        updateProgress("idle", 0);
      } else {
        updateProgress("error", 0, { error: error.message });
      }
    } finally {
      setAbortController(null);
    }
  }, [updateProgress, session?.user?.quizLevel]);

  const cancelUpload = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setIsUploading(false);
    setIsMinimized(false);
    setProgress({
      stage: "idle",
      stageProgress: 0,
      overallProgress: 0,
      message: "",
    });
    setStoryData(null);
  }, [abortController]);

  const toggleMinimized = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  const updateStoryData = useCallback((updates: Partial<StoryUploadData>) => {
    setStoryData(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const confirmStory = useCallback(async () => {
    if (!storyData?.id) return;

    try {
      // Update story with any user edits
      await fetch(`/api/user-stories/${storyData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyData.title,
          description: storyData.description,
          thumbnailUrl: storyData.thumbnailUrl,
        }),
      });

      updateProgress("complete", 100);
      setShowReviewModal(false);
      setIsUploading(false);

      // Reset after 5 seconds (giving user time to click "Start reading")
      setTimeout(() => {
        setProgress({
          stage: "idle",
          stageProgress: 0,
          overallProgress: 0,
          message: "",
        });
        setStoryData(null);
      }, 5000);

    } catch (error: any) {
      updateProgress("error", 0, { error: error.message });
    }
  }, [storyData, updateProgress]);

  const value: StoryUploadContextType = {
    isUploading,
    isMinimized,
    progress,
    storyData,
    showUploadModal,
    showReviewModal,
    showProgressViewer,
    startUpload,
    cancelUpload,
    toggleMinimized,
    setShowUploadModal,
    setShowReviewModal,
    setShowProgressViewer,
    updateStoryData,
    confirmStory,
  };

  // Determine modal stage
  const isRewriting = progress.stage === "rewriting-levels";
  const modalStage = isRewriting ? "rewriting" : progress.stage === "translating" ? "translating" : "complete";

  return (
    <StoryUploadContext.Provider value={value}>
      {children}

      {/* Progress Viewer Modal - rendered at provider level for full-screen capability */}
      <ProgressViewerModal
        isOpen={showProgressViewer}
        onClose={() => setShowProgressViewer(false)}
        chapters={progress.completedChapters || []}
        rewriteChapters={progress.rewriteChapters || []}
        sourceLanguage={storyData?.sourceLanguage || "es"}
        currentChapter={progress.currentChapter || 0}
        totalChapters={progress.totalChapters || 0}
        stage={modalStage}
        detectedLevel={progress.detectedLevel}
        targetLevel={progress.currentLevel}
      />
    </StoryUploadContext.Provider>
  );
}

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

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

export interface UploadProgress {
  stage: UploadStage;
  stageProgress: number; // 0-100 for current stage
  overallProgress: number; // 0-100 for entire process
  currentLevel?: string; // e.g., "l2" when rewriting
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

interface StoryUploadContextType {
  // State
  isUploading: boolean;
  isMinimized: boolean;
  progress: UploadProgress;
  storyData: StoryUploadData | null;
  showUploadModal: boolean;
  showReviewModal: boolean;

  // Actions
  startUpload: (content: string, optionalTitle?: string) => Promise<void>;
  cancelUpload: () => void;
  toggleMinimized: () => void;
  setShowUploadModal: (show: boolean) => void;
  setShowReviewModal: (show: boolean) => void;
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

const STAGE_WEIGHTS: Record<UploadStage, { start: number; end: number }> = {
  idle: { start: 0, end: 0 },
  uploading: { start: 0, end: 5 },
  "detecting-language": { start: 5, end: 10 },
  "detecting-level": { start: 10, end: 20 },
  "generating-description": { start: 20, end: 30 },
  "rewriting-levels": { start: 30, end: 70 },
  translating: { start: 70, end: 90 },
  finalizing: { start: 90, end: 95 },
  review: { start: 95, end: 95 },
  complete: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
};

const STAGE_MESSAGES: Record<UploadStage, string> = {
  idle: "",
  uploading: "Uploading your story...",
  "detecting-language": "Detecting language...",
  "detecting-level": "Analyzing difficulty level...",
  "generating-description": "Creating description...",
  "rewriting-levels": "Adapting to different levels...",
  translating: "Translating content...",
  finalizing: "Finalizing your story...",
  review: "Ready for review!",
  complete: "Story uploaded successfully!",
  error: "Something went wrong",
};

export function StoryUploadProvider({ children }: { children: React.ReactNode }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
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

    setProgress({
      stage,
      stageProgress,
      overallProgress: Math.round(overallProgress),
      message: STAGE_MESSAGES[stage],
      ...extra,
    });
  }, []);

  const startUpload = useCallback(async (content: string, optionalTitle?: string) => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsUploading(true);
    setIsMinimized(false);
    setShowUploadModal(false);

    // Initialize story data
    const initialData: StoryUploadData = {
      rawContent: content,
      title: optionalTitle || "",
      titleGenerated: !optionalTitle,
      description: "",
      descriptionGenerated: true,
      sourceLanguage: "es",
      sourceLanguageDetected: true,
      detectedLevel: "",
    };
    setStoryData(initialData);

    try {
      // Stage 1: Upload and create initial record
      updateProgress("uploading", 50);

      const createResponse = await fetch("/api/user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title: optionalTitle || "Untitled Story",
        }),
        signal: controller.signal,
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || "Failed to create story");
      }

      const { story } = await createResponse.json();
      updateProgress("uploading", 100);

      setStoryData(prev => prev ? { ...prev, id: story.id } : null);

      // Stage 2: Process the story (this triggers the AI pipeline)
      updateProgress("detecting-language", 0);

      const processResponse = await fetch("/api/user-stories/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id }),
        signal: controller.signal,
      });

      if (!processResponse.ok) {
        const error = await processResponse.json();
        throw new Error(error.error || "Failed to process story");
      }

      // Poll for status updates
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max

      while (attempts < maxAttempts) {
        if (controller.signal.aborted) {
          throw new Error("Upload cancelled");
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`/api/user-stories/${story.id}`, {
          signal: controller.signal,
        });

        if (!statusResponse.ok) {
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();
        const storyStatus = statusData.story;

        // Update progress based on status
        if (storyStatus.status === "PROCESSING") {
          // Check level statuses to determine progress
          const levels = storyStatus.levels || [];
          const completedLevels = levels.filter((l: any) => l.status === "READY").length;
          const totalLevels = 5;

          if (completedLevels === 0) {
            // Still in early stages
            if (storyStatus.detectedLevel) {
              updateProgress("generating-description", 50);
            } else {
              updateProgress("detecting-level", 50);
            }
          } else {
            // Rewriting/translating levels
            const levelProgress = (completedLevels / totalLevels) * 100;
            if (levelProgress < 100) {
              updateProgress("rewriting-levels", levelProgress, {
                currentLevel: `l${completedLevels + 1}`,
              });
            } else {
              updateProgress("translating", 50);
            }
          }
        } else if (storyStatus.status === "READY") {
          // Update story data with final values
          setStoryData(prev => prev ? {
            ...prev,
            id: storyStatus.id,
            title: storyStatus.title || prev.title,
            titleGenerated: !optionalTitle,
            description: storyStatus.description || "",
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
          throw new Error("Story processing failed");
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error("Processing timed out");
      }

    } catch (error: any) {
      if (error.name === "AbortError" || error.message === "Upload cancelled") {
        updateProgress("idle", 0);
      } else {
        updateProgress("error", 0, { error: error.message });
      }
    } finally {
      setAbortController(null);
    }
  }, [updateProgress]);

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

      // Reset after a short delay
      setTimeout(() => {
        setProgress({
          stage: "idle",
          stageProgress: 0,
          overallProgress: 0,
          message: "",
        });
        setStoryData(null);
      }, 3000);

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
    startUpload,
    cancelUpload,
    toggleMinimized,
    setShowUploadModal,
    setShowReviewModal,
    updateStoryData,
    confirmStory,
  };

  return (
    <StoryUploadContext.Provider value={value}>
      {children}
    </StoryUploadContext.Provider>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  saveDraft,
  updateDraft,
  loadDraft,
  deleteDraft,
  listDrafts,
  cleanupOldDrafts,
  createCheckpoint,
  hasChangedSinceCheckpoint,
  getCheckpoints,
  type StoredState,
  type DraftMetadata,
  type StepCheckpoint,
  MAX_DRAFTS_PER_SLUG,
  MAX_DRAFT_AGE_DAYS,
} from "@/lib/admin/admin-storage";
import type { StoryData } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface DraftInfo extends DraftMetadata {
  isCurrentDraft: boolean;
  ageInDays: number;
}

export interface UseDraftManagerOptions {
  /** Current story data */
  storyData: StoryData;
  /** Current step number */
  currentStep: number;
  /** Callback when draft is loaded */
  onLoad?: (storyData: StoryData, step: number) => void;
  /** Auto-load draft on mount if exists */
  autoLoad?: boolean;
}

export interface UseDraftManagerReturn {
  /** Currently active draft ID */
  activeDraftId: string | null;
  /** List of all drafts */
  drafts: DraftInfo[];
  /** Whether drafts are loading */
  isLoading: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Last save timestamp */
  lastSaved: string | null;
  /** Error message if any */
  error: string | null;
  /** Step checkpoints */
  checkpoints: StepCheckpoint[];
  /** Save current state as a new draft */
  saveNewDraft: (title?: string) => Promise<string | null>;
  /** Update the active draft */
  saveCurrentDraft: () => Promise<boolean>;
  /** Load a draft by ID */
  loadDraftById: (id: string) => Promise<boolean>;
  /** Delete a draft by ID */
  deleteDraftById: (id: string) => Promise<boolean>;
  /** Refresh the drafts list */
  refreshDrafts: () => Promise<void>;
  /** Create a checkpoint at current step */
  createStepCheckpoint: () => StepCheckpoint | null;
  /** Check if current step has unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Run manual cleanup */
  runCleanup: () => Promise<number>;
  /** Clear active draft (start fresh) */
  clearActiveDraft: () => void;
  /** Storage limits info */
  limits: {
    maxDraftsPerSlug: number;
    maxDraftAgeDays: number;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useDraftManager({
  storyData,
  currentStep,
  onLoad,
  autoLoad = false,
}: UseDraftManagerOptions): UseDraftManagerReturn {
  // State
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<StepCheckpoint[]>([]);
  const [internalState, setInternalState] = useState<StoredState | null>(null);

  // Build StoredState from StoryData
  const buildStoredState = useCallback((): StoredState => {
    return {
      version: 2,
      storyData,
      currentStep,
      savedAt: new Date().toISOString(),
      storySlug: storyData.slug || undefined,
      checkpoints: internalState?.checkpoints || [],
    };
  }, [storyData, currentStep, internalState?.checkpoints]);

  // Convert DraftMetadata to DraftInfo
  const toDraftInfo = useCallback((metadata: DraftMetadata): DraftInfo => {
    const now = Date.now();
    const updatedAt = new Date(metadata.updatedAt).getTime();
    const ageInDays = Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000));

    return {
      ...metadata,
      isCurrentDraft: metadata.id === activeDraftId,
      ageInDays,
    };
  }, [activeDraftId]);

  // Refresh drafts list
  const refreshDrafts = useCallback(async () => {
    try {
      const allDrafts = await listDrafts();
      setDrafts(allDrafts.map(toDraftInfo));
    } catch (e) {
      console.error("[DraftManager] Failed to refresh drafts:", e);
    }
  }, [toDraftInfo]);

  // Save as new draft
  const saveNewDraft = useCallback(async (title?: string): Promise<string | null> => {
    setIsSaving(true);
    setError(null);

    try {
      const state = buildStoredState();
      const draftTitle = title || storyData.title.en || storyData.slug || "Untitled Draft";
      const result = await saveDraft(state, draftTitle);

      setActiveDraftId(result.id);
      setLastSaved(new Date().toISOString());
      setInternalState(state);

      console.log(`[DraftManager] Saved new draft: ${result.id} (${result.compressedKB.toFixed(1)}KB)`);

      await refreshDrafts();
      return result.id;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save draft";
      setError(message);
      console.error("[DraftManager] Save failed:", e);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [buildStoredState, storyData.title.en, storyData.slug, refreshDrafts]);

  // Update current draft
  const saveCurrentDraft = useCallback(async (): Promise<boolean> => {
    if (!activeDraftId) {
      // No active draft, save as new
      const id = await saveNewDraft();
      return id !== null;
    }

    setIsSaving(true);
    setError(null);

    try {
      const state = buildStoredState();
      const result = await updateDraft(activeDraftId, state);

      setLastSaved(new Date().toISOString());
      setInternalState(state);

      console.log(`[DraftManager] Updated draft: ${activeDraftId} (${result.compressedKB.toFixed(1)}KB)`);

      await refreshDrafts();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update draft";
      setError(message);
      console.error("[DraftManager] Update failed:", e);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activeDraftId, buildStoredState, saveNewDraft, refreshDrafts]);

  // Load a draft by ID
  const loadDraftById = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const state = await loadDraft(id);
      if (!state) {
        setError("Draft not found");
        return false;
      }

      setActiveDraftId(id);
      setInternalState(state);
      setCheckpoints(getCheckpoints(state));
      setLastSaved(state.savedAt);

      // Notify parent to update story data
      if (onLoad && state.storyData) {
        onLoad(state.storyData as StoryData, state.currentStep);
      }

      console.log(`[DraftManager] Loaded draft: ${id}`);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load draft";
      setError(message);
      console.error("[DraftManager] Load failed:", e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [onLoad]);

  // Delete a draft by ID
  const deleteDraftById = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteDraft(id);

      // If we deleted the active draft, clear it
      if (id === activeDraftId) {
        setActiveDraftId(null);
        setInternalState(null);
        setLastSaved(null);
      }

      console.log(`[DraftManager] Deleted draft: ${id}`);

      await refreshDrafts();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete draft";
      setError(message);
      console.error("[DraftManager] Delete failed:", e);
      return false;
    }
  }, [activeDraftId, refreshDrafts]);

  // Create a checkpoint at current step
  const createStepCheckpoint = useCallback((): StepCheckpoint | null => {
    if (!internalState) return null;

    const updatedState = createCheckpoint(internalState, currentStep);
    setInternalState(updatedState);
    setCheckpoints(getCheckpoints(updatedState));

    const newCheckpoint = updatedState.checkpoints?.find(c => c.step === currentStep);
    console.log(`[DraftManager] Created checkpoint for step ${currentStep}`);

    return newCheckpoint || null;
  }, [internalState, currentStep]);

  // Check if current step has unsaved changes
  const hasUnsavedChanges = useCallback((): boolean => {
    if (!internalState) return false;
    return hasChangedSinceCheckpoint(internalState, currentStep);
  }, [internalState, currentStep]);

  // Run manual cleanup
  const runCleanup = useCallback(async (): Promise<number> => {
    try {
      const result = await cleanupOldDrafts(storyData.slug || undefined);
      await refreshDrafts();
      return result.deleted;
    } catch (e) {
      console.error("[DraftManager] Cleanup failed:", e);
      return 0;
    }
  }, [storyData.slug, refreshDrafts]);

  // Clear active draft
  const clearActiveDraft = useCallback(() => {
    setActiveDraftId(null);
    setInternalState(null);
    setLastSaved(null);
    setCheckpoints([]);
  }, []);

  // Auto-load most recent draft for current slug on mount
  useEffect(() => {
    if (!autoLoad) return;

    const autoLoadDraft = async () => {
      const slug = storyData.slug;
      if (!slug) return;

      const slugDrafts = await listDrafts(slug);
      if (slugDrafts.length > 0) {
        // Load most recent draft for this slug
        await loadDraftById(slugDrafts[0].id);
      }
    };

    autoLoadDraft();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh drafts on mount
  useEffect(() => {
    refreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeDraftId,
    drafts,
    isLoading,
    isSaving,
    lastSaved,
    error,
    checkpoints,
    saveNewDraft,
    saveCurrentDraft,
    loadDraftById,
    deleteDraftById,
    refreshDrafts,
    createStepCheckpoint,
    hasUnsavedChanges,
    runCleanup,
    clearActiveDraft,
    limits: {
      maxDraftsPerSlug: MAX_DRAFTS_PER_SLUG,
      maxDraftAgeDays: MAX_DRAFT_AGE_DAYS,
    },
  };
}

export default useDraftManager;

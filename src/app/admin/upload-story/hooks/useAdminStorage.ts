"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  saveState,
  loadState,
  clearState,
  migrateFromLocalStorage,
  cleanup,
  type StoredState,
  type SaveStatus,
} from "@/lib/admin/admin-storage";

const LEGACY_STORAGE_KEY = "admin-story-upload-state";

export interface UseAdminStorageOptions<T> {
  /** Initial state to use if no saved state exists */
  initialState: T;
  /** Initial step to use if no saved state exists */
  initialStep: number;
  /** Called when state is restored from storage */
  onRestore?: (state: T, step: number) => void;
}

export interface UseAdminStorageReturn<T> {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Whether state was restored from storage */
  hasRestoredState: boolean;
  /** Manually trigger a save (debounced) */
  saveProgress: (state: T, step: number) => void;
  /** Immediately save (for beforeunload) */
  saveImmediately: (state: T, step: number) => Promise<void>;
  /** Clear all saved state */
  clearProgress: () => Promise<void>;
  /** Time since last save (for display) */
  lastSavedAt: Date | null;
}

export function useAdminStorage<T>({
  initialState,
  initialStep,
  onRestore,
}: UseAdminStorageOptions<T>): UseAdminStorageReturn<T> {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Load state on mount
  useEffect(() => {
    async function init() {
      try {
        // First, try to migrate from localStorage (one-time)
        await migrateFromLocalStorage(LEGACY_STORAGE_KEY);

        // Then load from IndexedDB
        const stored = await loadState();
        if (stored && stored.storyData && stored.currentStep) {
          console.log(`[AdminStorage] Restored state (step ${stored.currentStep})`);
          setHasRestoredState(true);
          setLastSavedAt(stored.savedAt ? new Date(stored.savedAt) : null);
          onRestoreRef.current?.(stored.storyData as T, stored.currentStep);
        }
      } catch (e) {
        console.error("[AdminStorage] Failed to load state:", e);
      }
    }

    init();

    // Cleanup worker on unmount
    return () => {
      cleanup();
    };
  }, []);

  // Debounced save
  const saveProgress = useCallback((state: T, step: number) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce for 2 seconds (longer than before since we save less frequently)
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus("saving");

      try {
        const result = await saveState({
          storyData: state,
          currentStep: step,
          savedAt: new Date().toISOString(),
        });

        const ratio = ((1 - result.compressedKB / result.originalKB) * 100).toFixed(0);
        console.log(
          `[AdminStorage] Saved: ${result.originalKB.toFixed(1)}KB → ${result.compressedKB.toFixed(1)}KB (${ratio}% reduction)`
        );

        setLastSavedAt(new Date());
        setSaveStatus("saved");

        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (e) {
        console.error("[AdminStorage] Save failed:", e);
        setSaveStatus("error");
      }
    }, 2000);
  }, []);

  // Immediate save (for beforeunload)
  const saveImmediately = useCallback(async (state: T, step: number) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      await saveState({
        storyData: state,
        currentStep: step,
        savedAt: new Date().toISOString(),
      });
      setLastSavedAt(new Date());
    } catch (e) {
      console.error("[AdminStorage] Immediate save failed:", e);
    }
  }, []);

  // Clear saved state
  const clearProgress = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    await clearState();
    setHasRestoredState(false);
    setLastSavedAt(null);
    setSaveStatus("idle");
    console.log("[AdminStorage] Cleared saved state");
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    hasRestoredState,
    saveProgress,
    saveImmediately,
    clearProgress,
    lastSavedAt,
  };
}

export default useAdminStorage;

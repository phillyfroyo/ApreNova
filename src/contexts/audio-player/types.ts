// src/contexts/audio-player/types.ts
import type { StoryMapForNav } from "@/utils/storyNavigation";
import type { StoryLine } from "@/lib/story-processing/text-processing";

// ============================================================================
// Types
// ============================================================================

export type AudioPlayerStatus =
  | "idle"
  | "playing"
  | "paused"
  | "loading"
  | "generating"
  | "ready"
  | "navigating"
  | "error"
  | "finished";

export type PlaybackMode = "chapter" | "legacy";

export type AudioLanguageMode = "target-only" | "bilingual";

export interface AudioPlayerPosition {
  storySlug: string;
  storyTitle: string;
  level: string;
  chapter: number;
  page: number;
  sentenceIndex: number;
  currentLanguage: "target" | "native";
  isUserStory: boolean;
  userStoryId?: string;
}

export interface VariantCacheStatus {
  target: { normal: boolean; slow: boolean };
  bilingual: { normal: boolean; slow: boolean };
  estimates: {
    targetNormal: number | null;
    targetSlow: number | null;
    bilingualNormal: number | null;
    bilingualSlow: number | null;
  };
}

export interface PendingPlayback {
  options: StartPlaybackOptions;
  resolvedChapter: number;
  resolvedPage: number;
  bookmarkAudioTime: number | null;
  /** Set when picker was triggered mid-playback (toggle mode/speed). Used to resume at same position. */
  seekToPosition?: { pageNumber: number; lineIndex: number };
  /** Whether audio was playing (vs paused) when the picker opened. Only relevant when seekToPosition is set. */
  wasPlaying?: boolean;
  cacheStatus: VariantCacheStatus;
}

export const DEFAULT_CACHE_STATUS: VariantCacheStatus = {
  target: { normal: false, slow: false },
  bilingual: { normal: false, slow: false },
  estimates: { targetNormal: null, targetSlow: null, bilingualNormal: null, bilingualSlow: null },
};

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  position: AudioPlayerPosition | null;
  mode: AudioLanguageMode;
  playbackMode: PlaybackMode;
  currentPageSentences: StoryLine[];
  storyMap: StoryMapForNav | null;
  isVisible: boolean;
  highlightedSentenceIndex: number | null;
  highlightedLanguage: "en" | "es" | null;
  error: string | null;
  playbackRate: number;
  // Chapter mode fields
  chapterCurrentTime: number;
  chapterDuration: number;
  chapterGenerationProgress: { sentencesComplete: number; sentencesTotal: number } | null;
  /** Label shown in the loading overlay — null means default "Preparing Chapter/Section X" */
  generationLabel: string | null;
  /** When set, the settings picker is shown before playback starts */
  pendingPlayback: PendingPlayback | null;
}

export interface StartPlaybackOptions {
  storySlug: string;
  storyTitle: string;
  level: string;
  chapter: number;
  page: number;
  sentenceIndex?: number;
  isUserStory: boolean;
  userStoryId?: string;
  storyMap: StoryMapForNav;
  sentences: StoryLine[];
}

export interface AudioPlayerContextType {
  state: AudioPlayerState;
  startContinuousPlayback: (options: StartPlaybackOptions) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  stopPlayback: () => void;
  toggleMode: () => void;
  registerPageContent: (sentences: StoryLine[], chapter: number, page: number, storySlug?: string, level?: string) => void;
  skipForward: () => void;
  skipBack: () => void;
  nextPage: () => void;
  prevPage: () => void;
  isPlaying: boolean;
  setPlaybackRate: (rate: number) => void;
  seekToTime: (time: number) => void;
  confirmAndPlay: (modeOverride?: AudioLanguageMode, speedOverride?: number) => void;
  dismissPicker: () => void;
  registerSentenceElements: (refs: React.MutableRefObject<(HTMLDivElement | null)[]>) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const AVAILABLE_SPEEDS = [0.7, 1.0];

export const DEFAULT_PLAYBACK_RATE = 1.0;

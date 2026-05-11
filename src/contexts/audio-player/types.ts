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
  /** Per-level cache snapshot for the CEFR tabs in the picker. */
  allLevels?: AllLevelsCacheStatus;
}

export const DEFAULT_CACHE_STATUS: VariantCacheStatus = {
  target: { normal: false, slow: false },
  bilingual: { normal: false, slow: false },
  estimates: { targetNormal: null, targetSlow: null, bilingualNormal: null, bilingualSlow: null },
};

/** Per-level cache snapshot used by the SettingsPicker CEFR tabs.
 *  Lets the user browse other CEFR levels for cached audio of the same chapter. */
export interface AllLevelsCacheStatus {
  /** Levels that exist for this story and have the requested chapter. */
  availableLevels: string[];
  cacheStatusByLevel: Record<string, VariantCacheStatus & { pageCount: number }>;
}

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  position: AudioPlayerPosition | null;
  mode: AudioLanguageMode;
  playbackMode: PlaybackMode;
  currentPageSentences: StoryLine[];
  storyMap: StoryMapForNav | null;
  isVisible: boolean;
  /** Floating widget shown while a chapter is generating. Independent of `isVisible` (the playback bar):
   *  the widget is visible during pre-play generation; the bar only appears once playback actually starts. */
  isGeneratingWidgetVisible: boolean;
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
  /** Whether the story page renders both languages. Independent of audio mode.
   *  Auto-enabled when bilingual audio starts, but can be toggled freely after that. */
  bilingualReadingMode: boolean;
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
  /** True while a chapter audio generation is in flight (widget visible, not yet playing).
   *  Use this to disable Listen buttons on other chapters while one is being generated. */
  isGeneratingActive: boolean;
  setPlaybackRate: (rate: number) => void;
  seekToTime: (time: number) => void;
  confirmAndPlay: (
    modeOverride?: AudioLanguageMode,
    speedOverride?: number,
    levelOverride?: { level: string; page: number },
  ) => void;
  dismissPicker: () => void;
  registerSentenceElements: (refs: React.MutableRefObject<(HTMLDivElement | null)[]>) => void;
  /** Set the bilingual reading mode. Persists to localStorage. */
  setBilingualReadingMode: (enabled: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const AVAILABLE_SPEEDS = [0.7, 1.0];

export const DEFAULT_PLAYBACK_RATE = 1.0;

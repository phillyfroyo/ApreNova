// src/contexts/StoryReaderContext.tsx
"use client";

import React, { createContext, useContext } from "react";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

// ============================================================================
// Types
// ============================================================================

export type ActiveAudio = {
  index: number;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
  duration: number;
  currentWordIndex: number;
};

/** Poem info for anthology navigation */
export interface PoemNavInfo {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
}

export interface StoryMapType {
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
    title?: string;
    subtitle?: string;
    poems?: PoemNavInfo[];
  }[];
  structureType?: "prose" | "anthology" | "epic" | "script";
}

export interface StanzaAITranslationEntry {
  text: string;
  loading: boolean;
  isStatic?: boolean;
  selectedWord?: string;
  authError?: boolean;
  enhancedTranslation?: {
    contextTranslation?: string;
    isDerivative?: boolean;
    rootWord?: string;
    rootTranslation?: string;
    otherCommonTranslations?: Array<string | { translation: string; example?: { en: string; es: string } }>;
    partOfSpeech?: string;
    subject?: string;
    subjectTranslation?: string;
    derivatives?: Array<{ pos: string; word: string; translation: string; example?: { en: string; es: string } }>;
    verbChart?: { tense: string; infinitive: string; conjugations: Record<string, string> };
  };
  otherTranslations?: Array<string | { translation: string; example?: { en: string; es: string } }>;
}

export interface TutorContextType {
  lineIndex: number;
  fullLine: string;
  selectedText?: string;
}

// ============================================================================
// Context value shape
// ============================================================================

export interface StoryReaderContextValue {
  // --- Props passthrough ---
  sentences: StoryLine[];
  stanzas?: StoryLine[][];
  storySlug: string;
  title: string;
  storyMap: StoryMapType;
  isUserStory: boolean;
  userStoryId?: string;
  availableLevels?: CEFRCode[];
  storyType?: string | null;
  detectedLevel?: string | null;
  structureType?: "prose" | "anthology" | "epic" | "script" | null;

  // --- Routing / derived ---
  typedLang: Language;
  oppositeLang: Language;
  currentLevel: string;
  chapterNumber: number;
  pageNumber: number;
  currentChapter: string;
  currentPage: string;
  effectiveStructureType: "prose" | "anthology" | "epic" | "script" | null | undefined;

  // --- Session ---
  session: any;
  isPremiumUser: boolean | undefined;

  // --- TTS ---
  activeAudio: ActiveAudio | null;
  setActiveAudio: React.Dispatch<React.SetStateAction<ActiveAudio | null>>;
  ttsError: string | null;
  setTtsError: React.Dispatch<React.SetStateAction<string | null>>;
  ttsAuthError: boolean;
  setTtsAuthError: React.Dispatch<React.SetStateAction<boolean>>;
  playbackState: any;
  playTTS: any;
  playTTSSegment: any;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  togglePlayback: () => void;
  preCache: any;
  createRequest: any;
  getWordTimings: any;

  // --- Audio UI state ---
  lineWidths: Record<number, number>;
  setLineWidths: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  textRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;

  // --- Menu / dropdowns ---
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeDropdown: string | null;
  setActiveDropdown: React.Dispatch<React.SetStateAction<string | null>>;
  isAnyDropdownOpen: boolean;
  setIsAnyDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // --- Emoji / selection UI ---
  showEmojiButtons: Record<number, boolean>;
  setShowEmojiButtons: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  showStanzaEmojis: Record<number, boolean>;
  setShowStanzaEmojis: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  activeStanzaLine: Record<number, number>;
  setActiveStanzaLine: React.Dispatch<React.SetStateAction<Record<number, number>>>;

  // --- Word selection ---
  wordSelections: Record<number, { start: number; end: number } | null>;
  setWordSelections: React.Dispatch<React.SetStateAction<Record<number, { start: number; end: number } | null>>>;
  pendingStanzaSelection: { stanzaIdx: number; lineIndex: number; wordIndex: number } | null;
  setPendingStanzaSelection: React.Dispatch<React.SetStateAction<{ stanzaIdx: number; lineIndex: number; wordIndex: number } | null>>;
  hasSelectedWords: () => boolean;
  clearAllWordSelections: () => void;

  // --- Translation state ---
  premiumTriggers: Record<number, number>;
  activeTranslations: Record<number, boolean>;
  setActiveTranslations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  translationMode: "free" | "premium";
  stanzaAITranslation: Record<number, StanzaAITranslationEntry>;
  setStanzaAITranslation: React.Dispatch<React.SetStateAction<Record<number, StanzaAITranslationEntry>>>;
  stanzaExampleMap: Record<string, { english: string; spanish: string }>;
  setStanzaExampleMap: React.Dispatch<React.SetStateAction<Record<string, { english: string; spanish: string }>>>;
  visibleStanzaExamples: Set<number>;
  toggleStanzaExample: (i: number) => void;
  stanzaTranslationRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  manualTranslateFunctions: Record<number, () => void>;
  setManualTranslateFunctions: React.Dispatch<React.SetStateAction<Record<number, () => void>>>;
  translationData: Record<number, { word: string; translation: string; enrichedData?: any } | null>;
  setTranslationData: React.Dispatch<React.SetStateAction<Record<number, { word: string; translation: string; enrichedData?: any } | null>>>;
  clearSelectionFunctions: Record<number, () => void>;
  setClearSelectionFunctions: React.Dispatch<React.SetStateAction<Record<number, () => void>>>;
  translationRefs: React.MutableRefObject<(HTMLParagraphElement | null)[]>;

  // --- Save word ---
  saveToast: { message: string; type: "success" | "error" | "exists" } | null;
  setSaveToast: React.Dispatch<React.SetStateAction<{ message: string; type: "success" | "error" | "exists" } | null>>;
  savingWord: number | null;
  setSavingWord: React.Dispatch<React.SetStateAction<number | null>>;
  saveAuthLine: number | null;
  setSaveAuthLine: React.Dispatch<React.SetStateAction<number | null>>;
  skipGlobalClickRef: React.MutableRefObject<boolean>;

  // --- Story tutor ---
  isStoryTutorOpen: boolean;
  shouldRenderTutor: boolean;
  openStoryTutor: () => void;
  closeStoryTutor: () => void;
  tutorContext: TutorContextType | null;
  setTutorContext: React.Dispatch<React.SetStateAction<TutorContextType | null>>;
  preloadedMessages: any[] | null;
  handleMessagesUpdate: (newMessages: any[]) => void;
  scrollYBeforeTutorRef: React.MutableRefObject<number>;
  tabOffsetY: React.MutableRefObject<number>;
  tabDragRef: React.MutableRefObject<{ startY: number; startOffset: number; moved: boolean; prevY: number; prevTime: number; velocityY: number } | null>;
  tabElRef: React.RefObject<HTMLDivElement | null>;
  tabMomentumRef: React.MutableRefObject<number>;

  // --- Navigation ---
  getNavigationUrl: (level: string, chapter: number, page: number) => string;
  getHomeUrl: () => string;
  getNavigationLabel: (type: "chapter" | "page") => string;
  getCurrentPoem: (chapterNum: number, pageNum: number) => PoemNavInfo | null;
  usePoemNavigation: boolean;
  dynamicPageTitle: string;
  currentPagePosition: number;
  totalPages: number;
  isFinalPage: boolean;
  setIsFinalPage: React.Dispatch<React.SetStateAction<boolean>>;

  // --- Theme ---
  theme: any;
  backgroundStyle: React.CSSProperties;
  readOnlyMode: boolean;

  // --- Audio player context (continuous playback) ---
  audioPlayer: any;
  sentenceRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;

  // --- Handlers ---
  handlePlay: (index: number, isSlow: boolean, text: string, skipWordSelection?: boolean) => Promise<void>;
  handleSeek: (newTime: number) => void;
  handleDrag: (e: MouseEvent | TouchEvent) => void;
  handleTranslationStateChange: (index: number, hasActive: boolean) => void;
  handleWordSelectionChange: (index: number, selection: { start: number; end: number } | null) => void;
  handleStanzaWordClick: (stanzaIdx: number, lineIndex: number, wordIndex: number, linesInStanza: { line: StoryLine; lineIndex: number }[]) => void;
  handleManualTranslate: (index: number, translateFn: () => void) => void;
  handleClearSelection: (index: number, clearFn: () => void) => void;
  handleTranslationData: (index: number, data: { word: string; translation: string; enrichedData?: any } | null) => void;
  handleSaveWord: (lineIndex: number, sentence: string, translatedSentence?: string) => Promise<void>;
  renderProgressBar: (audio: ActiveAudio) => React.ReactNode;
}

// ============================================================================
// Context + hook
// ============================================================================

const StoryReaderContext = createContext<StoryReaderContextValue | null>(null);

export function useStoryReader(): StoryReaderContextValue {
  const ctx = useContext(StoryReaderContext);
  if (!ctx) {
    throw new Error("useStoryReader must be used within a <StoryReaderProvider>");
  }
  return ctx;
}

// Provider — currently a passthrough; Phase 3 will move state into here
export function StoryReaderProvider({
  value,
  children,
}: {
  value: StoryReaderContextValue;
  children: React.ReactNode;
}) {
  return (
    <StoryReaderContext.Provider value={value}>
      {children}
    </StoryReaderContext.Provider>
  );
}

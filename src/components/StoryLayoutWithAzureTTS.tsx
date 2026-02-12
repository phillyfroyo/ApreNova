// src/components/StoryLayoutWithAzureTTS.tsx
"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { getTheme } from "@/components/storyThemes";
import Link from "next/link";
import { Menu, X, Volume2, Loader2, AlertCircle } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import UnifiedTranslator from "@/components/UnifiedTranslator";
import StoryTutorChat from "@/components/StoryTutorChat";
import { useSessionLogger } from '@/hooks/useSessionLogger';
import { useAzureTTS } from '@/hooks/useAzureTTS';
import { slugify } from '@/lib/stories';
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';
import { ALL_CEFR_LEVELS, getCEFRLabel, type CEFRCode } from "@/lib/cefr";
import type { StoryLine } from "@/lib/story-processing/text-processing";

type ActiveAudio = {
  index: number;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
  duration: number;
  currentWordIndex: number;
};

/** Poem info for anthology navigation */
interface PoemNavInfo {
  number: number;      // 1-based poem number
  title: string;       // Poem title or Roman numeral
  startPage: number;   // First page of this poem
  endPage: number;     // Last page of this poem
  pageCount: number;   // Total pages this poem spans
}

interface StoryLayoutWithAzureTTSProps {
  sentences: StoryLine[];
  /** Nested stanzas for poems - takes priority over sentences for rendering */
  stanzas?: StoryLine[][];
  initialLevel: string;
  storySlug: string;
  title: string;
  storyMap: {
    hasChapters: boolean;
    chapters: {
      chapter: number;
      pages: number[];
      title?: string;    // Chapter title (e.g., "Down the Rabbit-Hole")
      subtitle?: string; // Optional subtitle
      poems?: PoemNavInfo[];  // For anthologies: poem list for navigation
    }[];
    structureType?: "prose" | "anthology" | "epic" | "script";
  };
  isUserStory?: boolean;
  userStoryId?: string;
  availableLevels?: CEFRCode[];
  /** Story type for special rendering (poems, scripts) */
  storyType?: string | null;
  /** Detected/original CEFR level of the story */
  detectedLevel?: string | null;
  /** Content structure type for navigation labels */
  structureType?: "prose" | "anthology" | "epic" | "script" | null;
}

export default function StoryLayoutWithAzureTTS({
  sentences,
  stanzas,
  initialLevel,
  storySlug,
  title,
  storyMap,
  isUserStory = false,
  userStoryId,
  availableLevels,
  storyType,
  detectedLevel,
  structureType,
}: StoryLayoutWithAzureTTSProps) {
  useSessionLogger('reading');

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

  // TTS Hook
  const {
    playbackState,
    playTTS,
    playTTSSegment,
    pause,
    resume,
    stop,
    seekTo,
    togglePlayback,
    preCache,
    createRequest,
    getWordTimings
  } = useAzureTTS({
    autoCache: true,
    onWordUpdate: (word, index) => {
      setActiveAudio(prev => prev ? { ...prev, currentWordIndex: index } : null);
    },
    onPlaybackComplete: () => {
      setActiveAudio(null);
    },
    onError: (error) => {
      if (error.message.includes("sign in")) {
        setTtsAuthError(true);
      } else {
        console.error('TTS Error:', error);
        setTtsError(error.message);
      }
    }
  });

  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAuthError, setTtsAuthError] = useState(false);
  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Premium restrictions removed - all users get full translation features
  const [translationMode, setTranslationMode] = useState<"free" | "premium">("premium");
  const [premiumTriggers, setPremiumTriggers] = useState<Record<number, number>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [showEmojiButtons, setShowEmojiButtons] = useState<Record<number, boolean>>({});
  const [activeTranslations, setActiveTranslations] = useState<Record<number, boolean>>({});
  const [wordSelections, setWordSelections] = useState<Record<number, { start: number; end: number } | null>>({});
  // Track pending cross-line selection within a stanza: { stanzaIdx, lineIndex, wordIndex }
  const [pendingStanzaSelection, setPendingStanzaSelection] = useState<{
    stanzaIdx: number;
    lineIndex: number;
    wordIndex: number;
  } | null>(null);
  // Stanza-level state for poem emoji interactions
  const [showStanzaEmojis, setShowStanzaEmojis] = useState<Record<number, boolean>>({});
  const [activeStanzaLine, setActiveStanzaLine] = useState<Record<number, number>>({});
  const [stanzaAITranslation, setStanzaAITranslation] = useState<Record<number, {
    text: string;
    loading: boolean;
    isStatic?: boolean; // true if using pre-existing translation (no GPT call)
    selectedWord?: string; // the word/phrase that was translated
    authError?: boolean; // true if auth required (user not signed in)
    enhancedTranslation?: {
      contextTranslation?: string;
      isDerivative?: boolean;
      rootWord?: string;
      rootTranslation?: string;
      otherCommonTranslations?: string[];
    };
    otherTranslations?: string[]; // for phrases
  }>>({});
  const [stanzaExampleMap, setStanzaExampleMap] = useState<Record<string, { english: string; spanish: string }>>({});
  const stanzaTranslationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [manualTranslateFunctions, setManualTranslateFunctions] = useState<Record<number, () => void>>({});
  const [clearSelectionFunctions, setClearSelectionFunctions] = useState<Record<number, () => void>>({});
  const [isStoryTutorOpen, setIsStoryTutorOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<{
    lineIndex: number;
    fullLine: string;
    selectedText?: string;
  } | null>(null);
  const [preloadedMessages, setPreloadedMessages] = useState<any[] | null>(null);
  const hasPreloadedRef = useRef(false);

  // Callback to update preloaded messages when new messages are added
  const handleMessagesUpdate = useCallback((newMessages: any[]) => {
    setPreloadedMessages(newMessages);
  }, []);

  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";

  // Helper function to get navigation labels based on structure type
  // Returns translated label for "chapter" or "page" based on content structure
  // Use storyMap.structureType if available (more reliable), fall back to prop
  const effectiveStructureType = storyMap.structureType || structureType;

  const getNavigationLabel = (type: "chapter" | "page"): string => {
    if (effectiveStructureType === "anthology") {
      return type === "chapter"
        ? t(typedLang, "story", "collection")
        : t(typedLang, "story", "poem");
    }
    if (effectiveStructureType === "epic") {
      return type === "chapter"
        ? t(typedLang, "story", "canto")
        : t(typedLang, "story", "section");
    }
    if (effectiveStructureType === "script") {
      return type === "chapter"
        ? t(typedLang, "story", "act")
        : t(typedLang, "story", "scene");
    }
    // Default: prose
    return t(typedLang, "story", type);
  };

  // For anthologies: determine current poem from page number
  const getCurrentPoem = (chapterNum: number, pageNum: number): PoemNavInfo | null => {
    const chapter = storyMap.chapters.find(ch => ch.chapter === chapterNum);
    if (!chapter?.poems) return null;

    // Find poem that contains this page
    for (const poem of chapter.poems) {
      if (pageNum >= poem.startPage && pageNum <= poem.endPage) {
        return poem;
      }
    }
    return null;
  };

  // Check if we should use poem-based navigation (anthologies with poem data)
  const usePoemNavigation = effectiveStructureType === "anthology";

  const pathname = usePathname() ?? "";
  const router = useRouter();

  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = pathParts[4] || initialLevel || "l1";

  // Handle different URL structures:
  // System stories: /lng/stories/{slug}/{level}/ch1/page-1
  // User stories:   /lng/my-stories/{id}/{level}/{chapter}/{page}
  // Legacy streaming (redirects): /lng/my-stories/{id}/{level}/stream/{chapter}/{page}
  const isLegacyStreamingRoute = pathParts[5] === "stream";
  const rawChapter = isLegacyStreamingRoute ? pathParts[6] : pathParts[5];
  const rawPage = isLegacyStreamingRoute ? pathParts[7] : pathParts[6];

  // Parse chapter number (handles both "ch1" format and plain "1" format)
  const currentChapter = rawChapter || "ch1";
  const currentPage = rawPage || "page-1";

  const chapterNumber = currentChapter.startsWith("ch")
    ? parseInt(currentChapter.replace("ch", ""))
    : parseInt(currentChapter) || 1;
  const pageNumber = currentPage.startsWith("page-")
    ? parseInt(currentPage.replace("page-", ""))
    : parseInt(currentPage) || 1;

  // Helper function to generate navigation URLs
  // Always uses unified reader path (no /stream/ segment)
  const getNavigationUrl = (level: string, chapter: number, page: number) => {
    if (isUserStory && userStoryId) {
      return `/${typedLang}/my-stories/${userStoryId}/${level}/${chapter}/${page}`;
    }
    return `/${typedLang}/stories/${storySlug}/${level}/ch${chapter}/page-${page}`;
  };

  // Helper for home navigation
  const getHomeUrl = () => {
    if (isUserStory) {
      return `/${typedLang}/my-stories`;
    }
    return `/${typedLang}/stories`;
  };

  // Disabled aggressive pre-caching to avoid rate limits
  useEffect(() => {
    console.log('Azure TTS ready for on-demand generation');
  }, [sentences, typedLang, storySlug, currentChapter, currentPage]);

  // Sync playback state with activeAudio
  useEffect(() => {
    if (playbackState.isPlaying && activeAudio) {
      setActiveAudio(prev => prev ? {
        ...prev,
        progress: playbackState.currentTime,
        duration: playbackState.duration,
        currentWordIndex: playbackState.currentWordIndex,
        isPlaying: true
      } : null);
    } else if (!playbackState.isPlaying && activeAudio?.isPlaying) {
      setActiveAudio(prev => prev ? { ...prev, isPlaying: false } : null);
    }
  }, [playbackState.isPlaying, playbackState.currentTime, playbackState.duration, playbackState.currentWordIndex]);

  const handleTranslationStateChange = useCallback((index: number, hasActive: boolean) => {
    setActiveTranslations(prev => ({ ...prev, [index]: hasActive }));
  }, []);

  const handleWordSelectionChange = useCallback((index: number, selection: { start: number; end: number } | null) => {
    setWordSelections(prev => ({ ...prev, [index]: selection }));

    // Show emoji buttons for this specific line when words are selected
    if (selection) {
      setShowEmojiButtons(prev => ({ ...prev, [index]: true }));
    }
  }, []);

  // Handle word click for cross-line stanza selection
  // Preserves the nuanced highlight behavior from UnifiedTranslator:
  // 1. First click: select single word
  // 2. Click same single word again: deselect
  // 3. Click outside current selection: expand
  // 4. Click inside selection (not edges): shrink from right
  // 5. Click at start edge when multi-word: shrink from left
  const handleStanzaWordClick = useCallback((
    stanzaIdx: number,
    lineIndex: number,
    wordIndex: number,
    linesInStanza: { line: StoryLine; lineIndex: number }[]
  ) => {
    // Helper: convert (lineIdx, wordIdx) to global word index within stanza
    const toGlobalIdx = (lineIdx: number, wordIdx: number): number => {
      let globalIdx = 0;
      for (const { line, lineIndex: li } of linesInStanza) {
        const lineText = line[oppositeLang] || '';
        const words = lineText.trimStart().split(/\s+/).filter(w => w);
        if (li === lineIdx) {
          return globalIdx + wordIdx;
        }
        globalIdx += words.length;
      }
      return globalIdx;
    };

    // Helper: convert global word index to (lineIdx, wordIdx)
    const fromGlobalIdx = (globalIdx: number): { lineIdx: number; wordIdx: number } | null => {
      let cumulative = 0;
      for (const { line, lineIndex: li } of linesInStanza) {
        const lineText = line[oppositeLang] || '';
        const words = lineText.trimStart().split(/\s+/).filter(w => w);
        if (globalIdx < cumulative + words.length) {
          return { lineIdx: li, wordIdx: globalIdx - cumulative };
        }
        cumulative += words.length;
      }
      return null;
    };

    // Helper: get total word count for a line
    const getWordCount = (line: StoryLine): number => {
      const lineText = line[oppositeLang] || '';
      return lineText.trimStart().split(/\s+/).filter(w => w).length;
    };

    // Helper: get total word count for entire stanza
    const getTotalWords = (): number => {
      return linesInStanza.reduce((sum, { line }) => sum + getWordCount(line), 0);
    };

    // Helper: build per-line selections from global range
    const buildSelectionsFromGlobalRange = (globalStart: number, globalEnd: number): Record<number, { start: number; end: number } | null> => {
      const newSelections: Record<number, { start: number; end: number } | null> = {};
      let cumulative = 0;

      for (const { line, lineIndex: li } of linesInStanza) {
        const wordCount = getWordCount(line);
        const lineStart = cumulative;
        const lineEnd = cumulative + wordCount - 1;

        if (globalEnd < lineStart || globalStart > lineEnd) {
          // Line not in selection range
          newSelections[li] = null;
        } else {
          // Line overlaps with selection
          const localStart = Math.max(0, globalStart - lineStart);
          const localEnd = Math.min(wordCount - 1, globalEnd - lineStart);
          newSelections[li] = { start: localStart, end: localEnd };
        }
        cumulative += wordCount;
      }
      return newSelections;
    };

    // Helper: get current global selection range from wordSelections state
    const getCurrentGlobalRange = (): { start: number; end: number } | null => {
      let globalStart: number | null = null;
      let globalEnd: number | null = null;
      let cumulative = 0;

      for (const { line, lineIndex: li } of linesInStanza) {
        const wordCount = getWordCount(line);
        const sel = wordSelections[li];
        if (sel) {
          const lineGlobalStart = cumulative + sel.start;
          const lineGlobalEnd = cumulative + sel.end;
          if (globalStart === null || lineGlobalStart < globalStart) {
            globalStart = lineGlobalStart;
          }
          if (globalEnd === null || lineGlobalEnd > globalEnd) {
            globalEnd = lineGlobalEnd;
          }
        }
        cumulative += wordCount;
      }

      if (globalStart !== null && globalEnd !== null) {
        return { start: globalStart, end: globalEnd };
      }
      return null;
    };

    // If clicking in a different stanza, reset and start new selection
    if (pendingStanzaSelection && pendingStanzaSelection.stanzaIdx !== stanzaIdx) {
      // Clear old selections from previous stanza
      const clearedSelections: Record<number, { start: number; end: number } | null> = {};
      linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });

      setPendingStanzaSelection({ stanzaIdx, lineIndex, wordIndex });
      setWordSelections({ ...clearedSelections, [lineIndex]: { start: wordIndex, end: wordIndex } });
      setShowStanzaEmojis({ [stanzaIdx]: true });
      return;
    }

    // Get current global selection
    const currentRange = getCurrentGlobalRange();
    const clickedGlobalIdx = toGlobalIdx(lineIndex, wordIndex);

    // If no current selection, start one
    if (!currentRange) {
      setPendingStanzaSelection({ stanzaIdx, lineIndex, wordIndex });
      setWordSelections(prev => ({ ...prev, [lineIndex]: { start: wordIndex, end: wordIndex } }));
      setShowStanzaEmojis({ [stanzaIdx]: true });
      return;
    }

    const { start: globalStart, end: globalEnd } = currentRange;

    // Same single word clicked again -> deselect
    if (globalStart === clickedGlobalIdx && globalEnd === clickedGlobalIdx) {
      const clearedSelections: Record<number, { start: number; end: number } | null> = {};
      linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });
      setWordSelections(prev => ({ ...prev, ...clearedSelections }));
      setPendingStanzaSelection(null);
      setShowStanzaEmojis({});
      return;
    }

    // Click outside current selection -> expand
    if (clickedGlobalIdx < globalStart || clickedGlobalIdx > globalEnd) {
      const newStart = Math.min(globalStart, clickedGlobalIdx);
      const newEnd = Math.max(globalEnd, clickedGlobalIdx);
      const newSelections = buildSelectionsFromGlobalRange(newStart, newEnd);
      setWordSelections(prev => ({ ...prev, ...newSelections }));
      setPendingStanzaSelection(null);
      return;
    }

    // Click inside selection (not at edges) -> shrink from right
    if (clickedGlobalIdx > globalStart && clickedGlobalIdx < globalEnd) {
      const newSelections = buildSelectionsFromGlobalRange(globalStart, clickedGlobalIdx);
      setWordSelections(prev => ({ ...prev, ...newSelections }));
      setPendingStanzaSelection(null);
      return;
    }

    // Click at start edge when multi-word -> shrink from left
    if (clickedGlobalIdx === globalStart && globalStart !== globalEnd) {
      const newSelections = buildSelectionsFromGlobalRange(globalStart + 1, globalEnd);
      setWordSelections(prev => ({ ...prev, ...newSelections }));
      setPendingStanzaSelection(null);
      return;
    }

    // Fallback: deselect
    const clearedSelections: Record<number, { start: number; end: number } | null> = {};
    linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });
    setWordSelections(prev => ({ ...prev, ...clearedSelections }));
    setPendingStanzaSelection(null);
  }, [pendingStanzaSelection, oppositeLang, wordSelections]);

  const handleManualTranslate = useCallback((index: number, translateFn: () => void) => {
    setManualTranslateFunctions(prev => ({ ...prev, [index]: translateFn }));
  }, []);

  const handleClearSelection = useCallback((index: number, clearFn: () => void) => {
    setClearSelectionFunctions(prev => ({ ...prev, [index]: clearFn }));
  }, []);

  // Helper function to check if any words are currently selected
  const hasSelectedWords = useCallback(() => {
    return Object.values(wordSelections).some(selection => selection !== null);
  }, [wordSelections]);

  // Helper function to clear all word selections
  const clearAllWordSelections = useCallback(() => {
    setWordSelections({});
    // Clear internal selection state in all UnifiedTranslator components
    Object.values(clearSelectionFunctions).forEach(clearFn => clearFn());
  }, [clearSelectionFunctions]);

  // Build dynamic page title - for anthologies, show poem info instead of page number
  const dynamicPageTitle = (() => {
    // Check for anthology with poem data
    const currentChapter = storyMap.chapters.find(c => c.chapter === chapterNumber);
    const hasPoems = usePoemNavigation && currentChapter?.poems && currentChapter.poems.length > 0;

    if (hasPoems) {
      const currentPoem = getCurrentPoem(chapterNumber, pageNumber);
      if (currentPoem) {
        const poemTitle = currentPoem.title.length > 30
          ? `${currentPoem.title.substring(0, 30)}...`
          : currentPoem.title;

        // Show collection and poem info
        if (storyMap.hasChapters) {
          return `${getNavigationLabel("chapter")} ${chapterNumber}, ${getNavigationLabel("page")} ${currentPoem.number}: ${poemTitle}`;
        }
        return `${getNavigationLabel("page")} ${currentPoem.number}: ${poemTitle}`;
      }
    }

    // Default: Chapter X, Page Y or just Page Y
    if (storyMap.hasChapters) {
      return `${getNavigationLabel("chapter")} ${chapterNumber}, ${getNavigationLabel("page")} ${pageNumber}`;
    }
    return `${getNavigationLabel("page")} ${pageNumber}`;
  })();

  // Calculate current page position within the story
  let currentPagePosition = 0;
  let totalPages = 0;
  
  for (const chapter of storyMap.chapters) {
    for (const pg of chapter.pages) {
      totalPages++;
      if (chapter.chapter === chapterNumber && pg === pageNumber) {
        currentPagePosition = totalPages;
      }
    }
  }

  // Premium restrictions removed - all users get full access
  const readOnlyMode = false;

  const theme = getTheme(storySlug);

  // Build background style - prefer image over gradient over color
  const backgroundStyle = theme.backgroundImage
    ? { backgroundImage: `url('${theme.backgroundImage}')` }
    : theme.backgroundGradient
    ? { background: theme.backgroundGradient }
    : { backgroundColor: theme.backgroundColor || "#f5f0e6" };

  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFinalPage, setIsFinalPage] = useState(false);

  function getPrevNextPage(
    currentChapter: number,
    currentPage: number,
    storyMap: {
      hasChapters: boolean;
      chapters: { chapter: number; pages: number[]; title?: string; subtitle?: string }[];
    }
  ): {
    prev: { ch: number; pg: number } | null;
    next: { ch: number; pg: number } | null;
  } {
    const flatPages: { ch: number; pg: number }[] = [];

    for (const ch of storyMap.chapters) {
      for (const pg of ch.pages) {
        flatPages.push({ ch: ch.chapter, pg });
      }
    }

    const index = flatPages.findIndex(
      (p) => p.ch === currentChapter && p.pg === currentPage
    );

    return {
      prev: index > 0 ? flatPages[index - 1] : null,
      next: index >= 0 && index < flatPages.length - 1 ? flatPages[index + 1] : null,
    };
  }

  useEffect(() => {
    const { next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
    setIsFinalPage(!next);

    // Prefetch next page route so navigation is near-instant
    if (next) {
      router.prefetch(getNavigationUrl(currentLevel, next.ch, next.pg));
    }
  }, [chapterNumber, pageNumber, storyMap]);

  // Premium restrictions removed - translationMode is always "premium" for all users

  // Intelligent pre-loading of chat history
  useEffect(() => {
    if (!session?.user || hasPreloadedRef.current) return;

    // Wait 2 seconds to ensure user is actually reading
    const preloadTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/story-tutor?storySlug=${encodeURIComponent(storySlug)}`);
        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];

          // Only store if user has history (optimization)
          if (messages.length > 0) {
            setPreloadedMessages(messages);
            console.log(`✅ Pre-loaded ${messages.length} messages for ${storySlug}`);
          }
        }
        hasPreloadedRef.current = true;
      } catch (error) {
        console.error('Pre-load failed:', error);
        hasPreloadedRef.current = true; // Don't retry
      }
    }, 2000); // 2 second delay

    return () => clearTimeout(preloadTimer);
  }, [session, storySlug]);

  // Save bookmark and record page visit when page changes
  useEffect(() => {
    if (!session?.user) return;

    const saveBookmark = async () => {
      try {
        await fetch('/api/story-bookmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storySlug,
            level: currentLevel,
            chapter: chapterNumber,
            page: pageNumber,
          }),
        });
        console.log(`📖 Bookmark saved: ${storySlug} - ${currentLevel} - Ch${chapterNumber} - Page${pageNumber}`);
      } catch (error) {
        console.error('Failed to save bookmark:', error);
      }
    };

    const recordPageVisit = async () => {
      try {
        // Count words on this page (from the target language sentences)
        const wordCount = sentences.reduce((total, s) => {
          const text = s[oppositeLang] || '';
          return total + text.split(/\s+/).filter(w => w.length > 0).length;
        }, 0);

        await fetch('/api/page-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storySlug,
            level: currentLevel,
            chapter: chapterNumber,
            page: pageNumber,
            wordCount,
          }),
        });
        console.log(`📊 Page visit recorded: ${storySlug} - ${wordCount} words`);
      } catch (error) {
        console.error('Failed to record page visit:', error);
      }
    };

    saveBookmark();
    recordPageVisit();
  }, [session, storySlug, currentLevel, chapterNumber, pageNumber, sentences, oppositeLang]);

  // Enhanced TTS play function
  // handlePlay: plays TTS for given text
  // skipWordSelection: when true, don't apply wordSelections slicing (used for pre-extracted cross-line text)
  const handlePlay = async (index: number, isSlow: boolean, text: string, skipWordSelection: boolean = false) => {
    setTtsError(null);

    // If clicking the same line and mode, toggle play/pause
    if (activeAudio && activeAudio.index === index && activeAudio.isSlow === isSlow) {
      if (activeAudio.isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    // Stop any current playback
    if (activeAudio) {
      stop();
      setActiveAudio(null);
    }

    // Set loading state
    setActiveAudio({
      index,
      isPlaying: false,
      isSlow,
      progress: 0,
      duration: 0,
      currentWordIndex: -1,
    });

    try {
      // Get the full sentence data for speaker/stage direction info
      const sentenceData = sentences[index];

      // Determine language based on which text is being spoken
      // If we're on /en/ route, we speak Spanish text (oppositeLang), so use Spanish voice
      // If we're on /es/ route, we speak English text (oppositeLang), so use English voice
      const isSpanishText = typedLang === "en"; // /en/ route = Spanish text being spoken
      const language = isSpanishText ? "es-ES" : "en-US";
      const speed = isSlow ? "slow" : "normal";

      // Get stage direction in the appropriate language
      const stageDirectionForTTS = isSpanishText
        ? (sentenceData.stageDirectionEs || sentenceData.stageDirection)
        : (sentenceData.stageDirectionEn || sentenceData.stageDirection);

      const request = createRequest(
        text,
        language,
        speed,
        storySlug,
        `${currentChapter}-${currentPage}-line${index + 1}`,
        // Pass speaker name and stage direction for scripts
        sentenceData.speaker,
        stageDirectionForTTS
      );

      // Check if there's a word selection for this sentence (skip if text was pre-extracted)
      const wordSelection = skipWordSelection ? undefined : wordSelections[index];

      // Always use playTTSSegment which handles both word selection and slow speed comma logic
      await playTTSSegment(request, wordSelection || undefined);

      // Update line width for progress bar
      const width = textRefs.current[index]?.offsetWidth || 0;
      setLineWidths(prev => ({ ...prev, [index]: width }));

    } catch (error) {
      console.error('TTS playback failed:', error);
      setActiveAudio(null);
      // Fallback to browser speech synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = typedLang === "es" ? "es-ES" : "en-US";
      utterance.rate = isSlow ? 0.7 : 1.0;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
  };

  const handleSeek = useCallback((newTime: number) => {
    seekTo(newTime);
    if (activeAudio) {
      setActiveAudio(prev => prev ? { ...prev, progress: newTime } : null);
    }
  }, [seekTo, activeAudio]);

  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!progressBarRef.current || !activeAudio?.duration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    let clientX: number;
    
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newTime = (offsetX / rect.width) * activeAudio.duration;
    handleSeek(newTime);
  }, [activeAudio, handleSeek]);

  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleDrag(e);
  }, [isDragging, handleDrag]);

  const handleGlobalUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("touchmove", handleGlobalMove, { passive: false });
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [handleGlobalMove, handleGlobalUp]);

  // Global click handler with line-specific emoji toggle
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target.closest('.dropdown') ||
        target.closest('[data-dropdown]') ||
        target.closest('[data-tooltip]') ||
        target.hasAttribute('data-just-closed-translation')
      ) {
        return;
      }

      // For translator areas, only block clicks if actually clicking on text
      const translatorElement = target.closest('[data-translator]');
      if (translatorElement) {
        // Check if we clicked on actual text content
        if (target.nodeType === Node.TEXT_NODE ||
            target.closest('[data-word]') ||
            (target as HTMLElement).hasAttribute('data-word')) {
          return;
        }
        // If clicked in empty space of translator, allow it to pass through
      }

      if (menuOpen) {
        setMenuOpen(false);
        return;
      }

      if (isAnyDropdownOpen) {
        return;
      }

      const hasActiveTranslations = Object.values(activeTranslations).some(Boolean);
      if (hasActiveTranslations) {
        return;
      }

      if (activeAudio?.isPlaying) {
        pause();
        setActiveAudio(null);
        setShowEmojiButtons({});
        setShowStanzaEmojis({});
        return;
      }

      const hasAnyEmojiButtons = Object.values(showEmojiButtons).some(Boolean);
      const hasAnyStanzaEmojis = Object.values(showStanzaEmojis).some(Boolean);
      if (activeAudio && !activeAudio.isPlaying && (hasAnyEmojiButtons || hasAnyStanzaEmojis)) {
        setActiveAudio(null);
        setShowEmojiButtons({});
        setShowStanzaEmojis({});
        return;
      }

      if (
        target.hasAttribute('data-audio-control') ||
        target.hasAttribute('data-translation-control') ||
        target.closest('[data-audio-scrubber]') ||
        target.closest('[data-audio-control]') ||
        target.closest('[data-translation-control]')
      ) {
        return;
      }

      // Priority 1: If words are selected, deselect them first
      if (hasSelectedWords()) {
        clearAllWordSelections();
        return;
      }

      // Priority 2: Stanza-level detection for poems, or per-line for prose
      const clickY = e.clientY;
      const isPoemWithStanzas = !!document.querySelector('[data-stanza-number]');

      if (isPoemWithStanzas) {
        // Find which stanza was clicked
        const allStanzas = document.querySelectorAll('[data-stanza-number]');
        for (const stanzaEl of Array.from(allStanzas)) {
          const rect = stanzaEl.getBoundingClientRect();
          if (clickY >= rect.top && clickY < rect.bottom) {
            const stanzaIdx = parseInt(stanzaEl.getAttribute('data-stanza-number') || '0') - 1;
            const isAlreadyOpen = showStanzaEmojis[stanzaIdx];

            // Find which line within stanza was clicked
            const textEls = stanzaEl.querySelectorAll('[data-text-content]');
            let clickedOnTextLine = false;
            for (const textEl of Array.from(textEls)) {
              const textRect = textEl.getBoundingClientRect();
              if (clickY >= textRect.top && clickY < textRect.bottom) {
                clickedOnTextLine = true;
                const lineIndex = parseInt(textEl.getAttribute('data-text-content') || '-1');
                if (lineIndex >= 0) {
                  setActiveStanzaLine(prev => ({ ...prev, [stanzaIdx]: lineIndex }));
                }
                break;
              }
            }

            if (clickedOnTextLine) {
              // Clicked on a text line - open if not open, keep open if already open
              if (!isAlreadyOpen) {
                setShowStanzaEmojis({ [stanzaIdx]: true });
              }
            } else {
              // Clicked on blank space within stanza - close if open
              if (isAlreadyOpen) {
                setShowStanzaEmojis({});
                setStanzaAITranslation({});
              }
            }
            return;
          }
        }
        // Click was outside all stanzas — close all
        setShowStanzaEmojis({});
        setStanzaAITranslation({});
        return;
      }

      // Per-line detection for prose/scripts
      const allTextContents = document.querySelectorAll('[data-text-content]');

      // Build array of line boundaries using the TEXT CONTENT position (not the container)
      const lineBounds = Array.from(allTextContents).map((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const index = parseInt(el.getAttribute('data-text-content') || '-1');
        return {
          element: el as HTMLElement,
          top: rect.top,
          bottom: rect.bottom,
          index
        };
      });

      // Check if click is directly on a text line
      let clickedOnTextLine = false;
      let clickedLineIndex = -1;

      for (const line of lineBounds) {
        if (clickY >= line.top && clickY < line.bottom) {
          clickedOnTextLine = true;
          clickedLineIndex = line.index;
          break;
        }
      }

      if (clickedOnTextLine && clickedLineIndex >= 0) {
        // Clicked on a text line - open if not open, keep open if already open
        const isAlreadyOpen = showEmojiButtons[clickedLineIndex];
        if (!isAlreadyOpen) {
          setShowEmojiButtons({ [clickedLineIndex]: true });
        }
      } else {
        // Clicked on blank space - close any open emoji rows
        const hasAnyOpen = Object.values(showEmojiButtons).some(Boolean);
        if (hasAnyOpen) {
          setShowEmojiButtons({});
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [menuOpen, isAnyDropdownOpen, activeAudio, showEmojiButtons, showStanzaEmojis, activeTranslations, pause, hasSelectedWords, clearAllWordSelections]);

  const renderProgressBar = (audio: ActiveAudio) => {
    const percent = audio.duration > 0 ? (audio.progress / audio.duration) * 100 : 0;

    if (status === "loading") return null;

    return (
      <div
        ref={progressBarRef}
        className="relative w-full h-[30px] select-none cursor-pointer flex items-center"
        data-audio-scrubber
        onMouseDown={(e: React.MouseEvent) => {
          setIsDragging(true);
          handleDrag(e.nativeEvent);
        }}
        onTouchStart={(e: React.TouchEvent) => {
          setIsDragging(true);
          handleDrag(e.nativeEvent);
        }}
      >
        <div className="w-full h-[6px] rounded bg-white/30 backdrop-blur-2xl border border-black/10 shadow-inner" />
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 -ml-3 bg-transparent flex items-center justify-center"
          style={{ left: `${percent}%` }}
        >
          <div className="w-5 h-5 bg-white/20 backdrop-blur-md border border-black/10 rounded-full shadow-lg shadow-black/50 pointer-events-auto" />
        </div>
        
        
      </div>
    );
  };


  return (
    <div
      className={`min-h-screen px-1.5 sm:px-4 pt-6 pb-[32rem] bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`}
      style={backgroundStyle}
    >
      {/* TTS Auth Error Display - styled like translation bubble */}
      {ttsAuthError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow-lg max-w-sm">
          <button
            onClick={() => setTtsAuthError(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
          <div className="text-sm pr-6">
            <span className="text-gray-700">{t(typedLang, "translator", "audioSignInRequired")} </span>
            <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
              {t(typedLang, "translator", "signIn")}
            </Link>
            <span className="text-gray-700"> {t(typedLang, "translator", "or")} </span>
            <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
              {t(typedLang, "translator", "createAccount")}
            </Link>
          </div>
        </div>
      )}
      {/* TTS Error Display - for non-auth errors */}
      {ttsError && !ttsAuthError && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>{ttsError}</span>
          <button
            onClick={() => setTtsError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}


      <header className="fixed top-4 left-4 z-50">
        <button
          className="p-2 rounded-md bg-white/80 border border-emerald-300 hover:bg-emerald-50 shadow-md"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Menu and Navigation (same as original) */}
      {menuOpen && (
        <div className="fixed top-16 left-4 right-4 z-40 bg-white/90 backdrop-blur-md shadow-md rounded-xl p-4 space-y-4 border border-emerald-200">
          <div className="flex flex-wrap gap-4">
            <Dropdown
              label={t(typedLang, "story", "navigate")}
              variant="glass"
              options={[{ label: t(typedLang, "story", "home"), value: "home" }]}
              onSelect={(option) => {
                if (option === "home") {
                  router.push(getHomeUrl());
                }
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "navigate" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
            <Dropdown
              label={`${t(typedLang, "story", "levelSelect")} ▾ ${getCEFRLabel(currentLevel as CEFRCode, typedLang)}${detectedLevel && currentLevel === detectedLevel ? (typedLang === "es" ? " (Original)" : " (Original)") : ""}`}
              variant="glass"
              options={ALL_CEFR_LEVELS.map((level) => {
                const isAvailable = !availableLevels || availableLevels.includes(level);
                const isOriginal = detectedLevel && level === detectedLevel;
                const notAvailableText = typedLang === "es" ? "(no disponible)" : "(not available)";
                const originalText = typedLang === "es" ? "(Original)" : "(Original)";

                let label = getCEFRLabel(level, typedLang);
                if (isOriginal) {
                  label += ` ${originalText}`;
                }
                if (!isAvailable) {
                  label += ` ${notAvailableText}`;
                }

                return {
                  label,
                  value: level,
                  disabled: !isAvailable,
                };
              })}
              onSelect={(selectedValue) => {
                router.push(getNavigationUrl(selectedValue, chapterNumber, pageNumber));
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "level" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
            {/* Chapter Dropdown – only if hasChapters */}
            {storyMap.chapters.length > 1 && (
              <Dropdown
                label={`${getNavigationLabel("chapter")} ▾ ${chapterNumber}`}
                variant="glass"
                options={storyMap.chapters.map((ch) => ({
                  // Show chapter title if available (e.g., "Chapter 1: Down the Rabbit-Hole")
                  label: ch.title && ch.title !== `Chapter ${ch.chapter}`
                    ? `${getNavigationLabel("chapter")} ${ch.chapter}: ${ch.title}`
                    : `${getNavigationLabel("chapter")} ${ch.chapter}`,
                  value: ch.chapter.toString(),
                }))}
                onSelect={(selectedValue) => {
                  const selectedChapter = parseInt(selectedValue);
                  const firstPage = storyMap.chapters.find((c) => c.chapter === selectedChapter)?.pages[0] || 1;
                  router.push(getNavigationUrl(currentLevel, selectedChapter, firstPage));
                }}
                onOpenChange={(isOpen) => {
                  setActiveDropdown(isOpen ? "chapter" : null);
                  setIsAnyDropdownOpen(isOpen);
                }}
              />
            )}

            {/* Page/Poem Dropdown – content depends on structure type */}
            {(() => {
              const currentChapter = storyMap.chapters.find((c) => c.chapter === chapterNumber);
              const hasPoems = usePoemNavigation && currentChapter?.poems && currentChapter.poems.length > 0;
              const currentPoem = hasPoems ? getCurrentPoem(chapterNumber, pageNumber) : null;

              if (hasPoems && currentChapter?.poems) {
                // ANTHOLOGY: Show Poem dropdown instead of Page dropdown
                const poemLabel = currentPoem
                  ? `${getNavigationLabel("page")} ${currentPoem.number}: ${currentPoem.title.substring(0, 15)}${currentPoem.title.length > 15 ? '...' : ''}`
                  : `${getNavigationLabel("page")} ▾`;

                return (
                  <Dropdown
                    label={`${poemLabel} ▾`}
                    variant="glass"
                    options={currentChapter.poems.map((poem) => ({
                      label: `${poem.number}. ${poem.title.substring(0, 25)}${poem.title.length > 25 ? '...' : ''}`,
                      value: poem.number.toString(),
                    }))}
                    onSelect={(selectedValue) => {
                      const selectedPoemNum = parseInt(selectedValue);
                      const selectedPoem = currentChapter.poems?.find(p => p.number === selectedPoemNum);
                      if (selectedPoem) {
                        // Navigate to first page of selected poem
                        router.push(getNavigationUrl(currentLevel, chapterNumber, selectedPoem.startPage));
                      }
                    }}
                    onOpenChange={(isOpen) => {
                      setActiveDropdown(isOpen ? "page" : null);
                      setIsAnyDropdownOpen(isOpen);
                    }}
                  />
                );
              }

              // DEFAULT: Show Page dropdown
              return (
                <Dropdown
                  label={`${getNavigationLabel("page")} ▾ ${pageNumber}`}
                  variant="glass"
                  options={
                    (currentChapter?.pages || []).map((pg) => ({
                      label: `${getNavigationLabel("page")} ${pg}`,
                      value: pg.toString(),
                    }))
                  }
                  onSelect={(selectedValue) => {
                    const selectedPage = parseInt(selectedValue);
                    router.push(getNavigationUrl(currentLevel, chapterNumber, selectedPage));
                  }}
                  onOpenChange={(isOpen) => {
                    setActiveDropdown(isOpen ? "page" : null);
                    setIsAnyDropdownOpen(isOpen);
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Navigation buttons (same as original) */}
      <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex justify-center gap-2 ${isStoryTutorOpen ? 'hidden lg:flex' : ''}`}>
        {(() => {
          const { prev, next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
          const buttonClass = (disabled: boolean, color: string) =>
            `px-4 py-2 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold text-white transition transform ${color} ${
              disabled ? "opacity-40 cursor-default" : `${theme.hoverAccentColor} hover:scale-105`
            }`;

          return (
            <div className="flex flex-col items-center space-y-4 mt-8">
              <div className="flex space-x-4">
                {prev ? (
                  <Link
                    className={buttonClass(false, "bg-green-600")}
                    href={getNavigationUrl(currentLevel, prev.ch, prev.pg)}
                  >
                    ⬅
                  </Link>
                ) : (
                  <span className={buttonClass(true, "bg-green-600")}>⬅</span>
                )}
                {next ? (
                  <Link
                    className={buttonClass(false, "bg-green-700")}
                    href={getNavigationUrl(currentLevel, next.ch, next.pg)}
                  >
                    ➡
                  </Link>
                ) : (
                  <span className={buttonClass(true, "bg-green-700")}>➡</span>
                )}
              </div>

              {isFinalPage && (
                <button
                  className="text-sm text-green-700 hover:underline"
                  onClick={() => {
                    fetch('/api/mark-complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        storySlug,
                        level: currentLevel,
                        chapter: chapterNumber,
                        page: pageNumber,
                      }),
                    }).then(() => alert(t(typedLang, "story", "markedComplete")));
                  }}
                >
                  ✅ {t(typedLang, "story", "markComplete")}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap relative overflow-hidden">
        {/* Total page count in top right */}
        <div className="fixed top-4 right-4 text-sm text-gray-600 z-10">
          {currentPagePosition}
        </div>

        {/* Story Content - slides left when chat opens, centered by default */}
        <div className={`flex flex-col items-start w-full max-w-md sm:max-w-lg px-4 transition-transform duration-300 ${
          isStoryTutorOpen ? '-translate-x-full lg:-translate-x-[50%]' : 'translate-x-0 lg:translate-x-0 mx-auto'
        }`}>
          <h1 className="text-2xl sm:text-3xl font-bold text-center w-full">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6 w-full">{dynamicPageTitle}</h2>

          {/* Determine if this is poetry for tight line spacing */}
          {(() => {
            const isPoemType = storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic';
            const isScriptType = storyType === 'movie-script' || storyType === 'tv-script' || storyType === 'dialogue';

            // Helper to render a single line
            // When isInsideStanza=true, emoji row and static translation are handled at stanza level
            // stanzaContext provides info for cross-line selection within stanzas
            const renderLine = (
              s: StoryLine,
              lineIndex: number,
              isInsideStanza: boolean = false,
              stanzaContext?: {
                stanzaIdx: number;
                linesInStanza: { line: StoryLine; lineIndex: number }[];
              }
            ) => {
              // Check if this is a stanza break (poem) - render as simple visual space
              if (s.isStanzaBreak) {
                return (
                  <div
                    key={lineIndex}
                    className="w-full h-6"
                    data-stanza-break={s.stanzaNumber}
                    aria-hidden="true"
                  />
                );
              }

              // Check if this is an empty line (blank line in poem/text)
              const isEmptyLine = !s.es?.trim() && !s.en?.trim();
              if (isEmptyLine) {
                return (
                  <div
                    key={lineIndex}
                    className="w-full h-4"
                    data-empty-line="true"
                    aria-hidden="true"
                  />
                );
              }

              // Get stage direction text
              const stageDirectionText = oppositeLang === 'es'
                ? (s.stageDirectionEs || s.stageDirection)
                : (s.stageDirectionEn || s.stageDirection);

              // Stage-direction-only line
              if (s.isStageDirectionOnly && stageDirectionText) {
                return (
                  <div key={lineIndex} className="my-4 w-full px-2 text-center" data-sentence-index={lineIndex}>
                    <span className="italic text-gray-500 text-sm">
                      ({stageDirectionText})
                    </span>
                  </div>
                );
              }

              // Editorial note (poetry anthologies) - render in italics with muted color
              if (s.isEditorialNote) {
                const displayText = s[oppositeLang] || s.es || s.en;
                return (
                  <div key={lineIndex} className="my-4 w-full px-2" data-sentence-index={lineIndex}>
                    <p className="italic text-gray-500 text-sm leading-relaxed">
                      {displayText}
                    </p>
                  </div>
                );
              }

              // Regular line - tight spacing for poems/stanzas
              const lineSpacing = (isPoemType || isInsideStanza) ? "my-0" : "my-6";

              return (
                <div key={lineIndex} className={`${lineSpacing} w-full relative`} data-sentence-index={lineIndex}>
                  {/* Speaker name for scripts */}
                  {isScriptType && s.speaker && (
                    <div className="px-2 mb-1">
                      <span className="font-bold text-amber-700 text-sm uppercase tracking-wide">
                        {s.speaker}
                      </span>
                      {s.speakerAnnotation && (
                        <span className="font-normal text-gray-500 text-xs ml-1">
                          {s.speakerAnnotation}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline stage direction for scripts */}
                  {isScriptType && stageDirectionText && !s.isStageDirectionOnly && (
                    <div className="px-2 mb-1">
                      <span className="italic text-gray-500 text-sm">
                        ({stageDirectionText})
                      </span>
                    </div>
                  )}

                  {/* Emoji row: skip for stanza poems (handled at stanza level) - overlays space above line */}
                  {!isInsideStanza && (
                  <div className={`absolute left-0 right-0 -top-8 flex items-center gap-1 justify-start px-2 transition-opacity duration-200 z-10 ${
                    showEmojiButtons[lineIndex] ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}>
                      {/* Enhanced emoji buttons with loading states and selection indicators */}
                      <button
                        onClick={() => handlePlay(lineIndex, false, s[oppositeLang])}
                        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                          playbackState.isLoading && activeAudio?.index === lineIndex && !activeAudio?.isSlow
                            ? 'opacity-50 cursor-default'
                            : ''
                        } ${
                          wordSelections[lineIndex] ? 'bg-blue-100' : 'bg-transparent'
                        }`}
                        data-audio-control="speaker"
                        disabled={playbackState.isLoading && activeAudio?.index === lineIndex && !activeAudio?.isSlow}
                        title={wordSelections[lineIndex] ? 'Play selected words' : 'Play full sentence'}
                      >
                        {playbackState.isLoading && activeAudio?.index === lineIndex && !activeAudio?.isSlow ? (
                          <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                          <span className={`text-lg leading-none ${wordSelections[lineIndex] ? 'text-blue-600' : ''}`}>🔊</span>
                        )}
                      </button>
                      <button
                        onClick={() => handlePlay(lineIndex, true, s[oppositeLang])}
                        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                          playbackState.isLoading && activeAudio?.index === lineIndex && activeAudio?.isSlow
                            ? 'opacity-50 cursor-default'
                            : ''
                        } ${
                          wordSelections[lineIndex] ? 'bg-blue-100' : 'bg-transparent'
                        }`}
                        data-audio-control="turtle"
                        disabled={playbackState.isLoading && activeAudio?.index === lineIndex && activeAudio?.isSlow}
                        title={wordSelections[lineIndex] ? 'Play selected words slowly' : 'Play full sentence slowly'}
                      >
                        {playbackState.isLoading && activeAudio?.index === lineIndex && activeAudio?.isSlow ? (
                          <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                          <span className={`text-lg leading-none ${wordSelections[lineIndex] ? 'text-blue-600' : ''}`}>🐢</span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setPreloadedMessages(null);
                          setTutorContext({
                            lineIndex,
                            fullLine: s[oppositeLang],
                            selectedText: wordSelections[lineIndex]
                              ? s[oppositeLang].slice(wordSelections[lineIndex]!.start, wordSelections[lineIndex]!.end)
                              : undefined,
                          });
                          setIsStoryTutorOpen(true);
                        }}
                        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                          wordSelections[lineIndex] ? 'bg-blue-100' : 'bg-transparent'
                        }`}
                        title={wordSelections[lineIndex] ? 'Ask tutor about selection' : 'Ask tutor about this line'}
                      >
                        <span className={`text-lg leading-none ${wordSelections[lineIndex] ? 'text-blue-600' : ''}`}>💬</span>
                      </button>
                      <button
                        onClick={() => {
                          const selectedText = wordSelections[lineIndex]
                            ? s[oppositeLang].slice(wordSelections[lineIndex]!.start, wordSelections[lineIndex]!.end)
                            : s[oppositeLang];
                          if (manualTranslateFunctions[lineIndex]) {
                            manualTranslateFunctions[lineIndex]();
                          }
                        }}
                        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                          wordSelections[lineIndex] ? 'bg-blue-100' : 'bg-transparent'
                        }`}
                        data-translation-control="gpt"
                        title="Translate"
                      >
                        <span className={`text-lg leading-none ${wordSelections[lineIndex] ? 'text-blue-600' : ''}`}>友</span>
                      </button>
                      {/* Pencil button for static translations */}
                      <button
                        onClick={() => {
                          const el = translationRefs.current[lineIndex];
                          if (el) requestAnimationFrame(() => el.classList.toggle("hidden"));
                        }}
                        className="inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition rounded"
                        data-translation-control="pencil"
                        title="Toggle full line translation"
                      >
                        <span className="text-lg leading-none">✍️</span>
                      </button>
                      {/* Audio playback progress bar - inline with emojis */}
                      <div className="relative flex-1 flex items-center h-[30px] ml-3">
                        {activeAudio?.index === lineIndex ? (
                          <>
                            {renderProgressBar(activeAudio)}
                            <button
                              onClick={() => {
                                stop();
                                setActiveAudio(null);
                              }}
                              className="ml-2 text-xl hover:scale-110 transition z-10"
                              data-audio-control="close"
                            >
                              ✖️
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Text content - ensure consistent left alignment */}
                  <div className={`w-full px-2 relative ${isScriptType && s.speaker ? 'pl-4' : ''}`} data-text-content={lineIndex}>
                    <UnifiedTranslator
                      sentence={s[oppositeLang]}
                      staticTranslation={s[typedLang]}
                      enabled={!isAnyDropdownOpen && !menuOpen}
                      readOnlyMode={translationMode === "free"}
                      autoTriggerAll={premiumTriggers[lineIndex] || false}
                      onTranslationStateChange={(hasActive) => handleTranslationStateChange(lineIndex, hasActive)}
                      onSelectionChange={(selection) => handleWordSelectionChange(lineIndex, selection)}
                      onManualTranslate={(translateFn) => handleManualTranslate(lineIndex, translateFn)}
                      onClearSelection={(clearFn) => handleClearSelection(lineIndex, clearFn)}
                      sentenceIndex={lineIndex}
                      contextSentences={sentences}
                      // Cross-line selection for stanzas: parent controls selection
                      externalSelection={stanzaContext ? wordSelections[lineIndex] : undefined}
                      onWordClick={stanzaContext ? (wordIdx) => handleStanzaWordClick(
                        stanzaContext.stanzaIdx,
                        lineIndex,
                        wordIdx,
                        stanzaContext.linesInStanza
                      ) : undefined}
                    />
                    {/* Per-line static translation: skip for stanza poems (handled at stanza level) */}
                    {!isInsideStanza && (
                    <div
                      ref={el => { translationRefs.current[lineIndex] = el; }}
                      className="translation hidden bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 mt-1 -ml-[15px] relative"
                    >
                      <button
                        onClick={() => {
                          const el = translationRefs.current[lineIndex];
                          if (el) el.classList.add("hidden");
                        }}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
                        data-translation-control="close"
                      >
                        ✕
                      </button>
                      <span className="text-lg font-medium text-gray-900 pr-6" style={{ wordSpacing: '0.15em' }}>{s[typedLang]}</span>
                    </div>
                    )}
                  </div>
                </div>
              );
            };

            // Helper to render stanza-level emoji row (replaces per-line emoji rows for poems)
            const renderStanzaEmojiRow = (
              stanzaIdx: number,
              linesInStanza: { line: StoryLine; lineIndex: number }[],
              stanza: StoryLine[]
            ) => {
              // Gather all lines with selections and build the complete selected text
              const linesWithSelection = linesInStanza.filter(
                ({ lineIndex }) => wordSelections[lineIndex]
              );
              const hasSelection = linesWithSelection.length > 0;
              const targetLineIndex = activeStanzaLine[stanzaIdx] ?? linesInStanza[0]?.lineIndex ?? 0;

              // Build the complete selected text across all lines
              const getSelectedText = (): string => {
                if (!hasSelection) return '';

                const selectedParts: string[] = [];
                console.log('[StanzaSelection] Building text from', linesWithSelection.length, 'lines with selections');
                for (const { line, lineIndex } of linesWithSelection) {
                  const sel = wordSelections[lineIndex];
                  if (sel) {
                    const lineText = line[oppositeLang] || '';
                    const words = lineText.trimStart().split(/\s+/).filter(w => w);
                    const selectedWords = words.slice(sel.start, sel.end + 1);
                    console.log('[StanzaSelection] Line', lineIndex, ': sel=', sel, 'words=', selectedWords);
                    selectedParts.push(selectedWords.join(' '));
                  }
                }
                const result = selectedParts.join(' ');
                console.log('[StanzaSelection] Complete text:', result);
                return result;
              };

              // Check if any line in this stanza has active audio
              const stanzaHasAudio = linesInStanza.some(({ lineIndex }) => activeAudio?.index === lineIndex);

              const handleStanzaPlay = (isSlow: boolean) => {
                console.log('[StanzaPlay] hasSelection:', hasSelection, 'linesWithSelection:', linesWithSelection.length);
                if (hasSelection) {
                  // Play all selected text across lines (skip word selection slicing - text is pre-extracted)
                  const selectedText = getSelectedText();
                  console.log('[StanzaPlay] Playing selected text:', selectedText);
                  // Use first selected line's index for audio tracking
                  handlePlay(linesWithSelection[0].lineIndex, isSlow, selectedText, true);
                } else {
                  // Play full stanza concatenated with period-space for natural TTS pauses
                  const fullStanzaText = stanza
                    .filter(l => !l.isStanzaBreak && (l[oppositeLang]?.trim()))
                    .map(l => l[oppositeLang])
                    .join('. ');
                  handlePlay(linesInStanza[0].lineIndex, isSlow, fullStanzaText, true);
                }
              };

              const handleStanzaTranslate = async () => {
                console.log('[StanzaTranslate] hasSelection:', hasSelection, 'linesWithSelection:', linesWithSelection.length);

                // Helper to check if a line is fully selected
                const isLineFullySelected = (line: StoryLine, lineIndex: number): boolean => {
                  const sel = wordSelections[lineIndex];
                  if (!sel) return false;
                  const lineText = line[oppositeLang] || '';
                  const words = lineText.trimStart().split(/\s+/).filter(w => w);
                  return sel.start === 0 && sel.end === words.length - 1;
                };

                // Helper to get static translation for selected lines
                const getStaticTranslation = (): string => {
                  return linesWithSelection
                    .filter(({ line, lineIndex }) => isLineFullySelected(line, lineIndex))
                    .map(({ line }) => line[typedLang] || '')
                    .join('\n');
                };

                // Check if all selected lines are fully selected (use static translation)
                const allLinesFullySelected = hasSelection &&
                  linesWithSelection.every(({ line, lineIndex }) => isLineFullySelected(line, lineIndex));

                // Determine what text we're about to translate
                const getTextToTranslate = (): string => {
                  if (!hasSelection) {
                    // Full stanza
                    return stanza
                      .filter(l => !l.isStanzaBreak && (l[typedLang]?.trim()))
                      .map(l => l[typedLang])
                      .join('\n');
                  } else if (allLinesFullySelected) {
                    // Full line(s) selected
                    return getStaticTranslation();
                  } else {
                    // Partial selection
                    return getSelectedText().replace(/[.,!?;:()"]+/g, "");
                  }
                };

                // Check if translation is already showing for the same content - toggle off
                const existingTranslation = stanzaAITranslation[stanzaIdx];
                if (existingTranslation && !existingTranslation.loading) {
                  const textToTranslate = getTextToTranslate();
                  const isStatic = !hasSelection || allLinesFullySelected;

                  // For static translations, compare the text directly
                  // For GPT translations, compare the selectedWord
                  const isSameTranslation = isStatic
                    ? existingTranslation.isStatic && existingTranslation.text === textToTranslate
                    : !existingTranslation.isStatic && existingTranslation.selectedWord === textToTranslate;

                  if (isSameTranslation) {
                    // Toggle off - close the translation
                    setStanzaAITranslation(prev => {
                      const next = { ...prev };
                      delete next[stanzaIdx];
                      return next;
                    });
                    return;
                  }
                }

                if (!hasSelection) {
                  // No selection = full stanza → use static translation (no GPT)
                  const staticTranslation = stanza
                    .filter(l => !l.isStanzaBreak && (l[typedLang]?.trim()))
                    .map(l => l[typedLang])
                    .join('\n');
                  setStanzaAITranslation(prev => ({
                    ...prev,
                    [stanzaIdx]: { text: staticTranslation, loading: false, isStatic: true }
                  }));
                } else if (allLinesFullySelected) {
                  // Full line(s) selected → use static translation (no GPT)
                  const staticTranslation = getStaticTranslation();
                  setStanzaAITranslation(prev => ({
                    ...prev,
                    [stanzaIdx]: { text: staticTranslation, loading: false, isStatic: true }
                  }));
                } else {
                  // Partial selection (less than full line) → call GPT with rich translation logic
                  const selectedText = getSelectedText();
                  const cleanText = selectedText.replace(/[.,!?;:()"]+/g, "");
                  const wordCount = cleanText.split(/\s+/).filter(w => w).length;
                  const isSingleWord = wordCount === 1;

                  console.log('[StanzaTranslate] Partial selection, calling GPT:', { selectedText, cleanText, isSingleWord });
                  setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: { text: '', loading: true, selectedWord: cleanText } }));

                  // Build context from stanza
                  const stanzaContext = stanza
                    .filter(l => !l.isStanzaBreak && (l[oppositeLang]?.trim()))
                    .map(l => l[oppositeLang])
                    .join(' ');

                  try {
                    if (isSingleWord) {
                      // Single word → use translate-word endpoint for rich info
                      const res = await fetch(`/api/translate-word?lang=${oppositeLang === 'es' ? 'en' : 'es'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          word: cleanText,
                          sentence: stanzaContext,
                          level: currentLevel,
                          context: { previous: '', current: stanzaContext, next: '' },
                        }),
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);

                      setStanzaAITranslation(prev => ({
                        ...prev,
                        [stanzaIdx]: {
                          text: data.contextTranslation || data.translations?.[0] || '',
                          loading: false,
                          isStatic: false,
                          selectedWord: cleanText,
                          enhancedTranslation: data.contextTranslation ? {
                            contextTranslation: data.contextTranslation,
                            isDerivative: data.isDerivative,
                            rootWord: data.rootWord,
                            rootTranslation: data.rootTranslation,
                            otherCommonTranslations: data.otherCommonTranslations,
                          } : undefined,
                        }
                      }));
                    } else {
                      // Multi-word phrase → use translate-phrase endpoint
                      const res = await fetch(`/api/translate-phrase?lang=${oppositeLang === 'es' ? 'en' : 'es'}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          phrase: cleanText,
                          sentence: stanzaContext,
                          level: currentLevel,
                          context: { previous: '', current: stanzaContext, next: '' },
                        }),
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);

                      const primaryTranslation = data.translations?.primary || data.translations?.[0] || '';
                      const otherTranslations = data.translations?.otherCommonTranslations ||
                        (Array.isArray(data.translations) ? data.translations.slice(1) : []);

                      setStanzaAITranslation(prev => ({
                        ...prev,
                        [stanzaIdx]: {
                          text: primaryTranslation,
                          loading: false,
                          isStatic: false,
                          selectedWord: cleanText,
                          otherTranslations: otherTranslations.length > 0 ? otherTranslations : undefined,
                        }
                      }));
                    }
                  } catch (err) {
                    const isAuthError = err instanceof Error && err.message.includes('Authentication required');
                    if (!isAuthError) {
                      console.error('[StanzaTranslate] GPT error:', err);
                    }
                    setStanzaAITranslation(prev => ({
                      ...prev,
                      [stanzaIdx]: {
                        text: isAuthError ? '' : 'Translation failed',
                        loading: false,
                        authError: isAuthError,
                      }
                    }));
                  }
                }
              };

              const isOpen = showStanzaEmojis[stanzaIdx];

              return (
                <div key={`stanza-emoji-${stanzaIdx}`}>
                  {/* Stanza emoji row - overlays space above stanza, doesn't push content */}
                  <div className={`absolute left-0 right-0 -top-8 flex items-center gap-1 justify-start px-2 transition-opacity duration-200 z-10 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}>
                    <button
                      onClick={() => handleStanzaPlay(false)}
                      className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                        playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow
                          ? 'opacity-50 cursor-default'
                          : ''
                      } ${hasSelection ? 'bg-blue-100' : 'bg-transparent'}`}
                      data-audio-control="speaker"
                      disabled={playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow}
                      title={hasSelection ? 'Play selected words' : 'Play full stanza'}
                    >
                      {playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <span className={`text-lg leading-none ${hasSelection ? 'text-blue-600' : ''}`}>🔊</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleStanzaPlay(true)}
                      className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                        playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow
                          ? 'opacity-50 cursor-default'
                          : ''
                      } ${hasSelection ? 'bg-blue-100' : 'bg-transparent'}`}
                      data-audio-control="turtle"
                      disabled={playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow}
                      title={hasSelection ? 'Play selected words slowly' : 'Play full stanza slowly'}
                    >
                      {playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <span className={`text-lg leading-none ${hasSelection ? 'text-blue-600' : ''}`}>🐢</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setPreloadedMessages(null);
                        const stanzaText = stanza
                          .filter(l => !l.isStanzaBreak && (l[oppositeLang]?.trim()))
                          .map(l => l[oppositeLang])
                          .join('\n');
                        // Get cross-line selected text
                        const selectedText = hasSelection ? getSelectedText() : undefined;
                        setTutorContext({
                          lineIndex: targetLineIndex,
                          fullLine: stanzaText,
                          selectedText,
                        });
                        setIsStoryTutorOpen(true);
                      }}
                      className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                        hasSelection ? 'bg-blue-100' : 'bg-transparent'
                      }`}
                      title={hasSelection ? 'Ask tutor about selection' : 'Ask tutor about this stanza'}
                    >
                      <span className={`text-lg leading-none ${hasSelection ? 'text-blue-600' : ''}`}>💬</span>
                    </button>
                    <button
                      onClick={handleStanzaTranslate}
                      className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                        hasSelection ? 'bg-blue-100' : 'bg-transparent'
                      }`}
                      data-translation-control="translate"
                      title={hasSelection ? 'Translate selection' : 'Translate full stanza'}
                    >
                      <span className={`text-lg leading-none ${hasSelection ? 'text-blue-600' : ''}`}>友</span>
                    </button>
                    <button
                      onClick={() => {
                        const el = stanzaTranslationRefs.current[stanzaIdx];
                        if (el) requestAnimationFrame(() => el.classList.toggle("hidden"));
                      }}
                      className="inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition rounded"
                      data-translation-control="pencil"
                      title="Toggle stanza translation"
                    >
                      <span className="text-lg leading-none">✍️</span>
                    </button>
                    {/* Audio progress bar */}
                    <div className="relative flex-1 flex items-center h-[30px] ml-3">
                      {stanzaHasAudio && activeAudio ? (
                        <>
                          {renderProgressBar(activeAudio)}
                          <button
                            onClick={() => {
                              stop();
                              setActiveAudio(null);
                            }}
                            className="ml-2 text-xl hover:scale-110 transition z-10"
                            data-audio-control="close"
                          >
                            ✖️
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            };

            // Helper to fetch example sentences for stanza translations
            const fetchStanzaExample = async (translation: string, selectedWord: string, stanza: StoryLine[]) => {
              const isSpanishSource = oppositeLang === 'es';
              const sourceWord = isSpanishSource ? selectedWord : translation;
              const targetWord = isSpanishSource ? translation : selectedWord;

              // Toggle off if already showing
              if (stanzaExampleMap[translation]) {
                setStanzaExampleMap(prev => {
                  const updated = { ...prev };
                  delete updated[translation];
                  return updated;
                });
                return;
              }

              try {
                const payload = {
                  spanishWord: isSpanishSource ? sourceWord : targetWord,
                  englishWord: isSpanishSource ? targetWord : sourceWord,
                  originalSentence: stanza
                    .filter((l: StoryLine) => !l.isStanzaBreak && (l[oppositeLang]?.trim()))
                    .map((l: StoryLine) => l[oppositeLang])
                    .join(' '),
                  level: currentLevel,
                };

                const res = await fetch(`/api/example-sentence?lang=${oppositeLang === 'es' ? 'en' : 'es'}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });

                const data = await res.json();
                if (data.error) throw new Error(data.error);

                setStanzaExampleMap(prev => ({
                  ...prev,
                  [translation]: {
                    english: data.english,
                    spanish: data.spanish,
                  },
                }));
              } catch (err) {
                console.error('[StanzaExample] Failed to fetch example:', err);
              }
            };

            // Helper to render stanza translations (appears below stanza text, doesn't push content)
            const renderStanzaTranslations = (
              stanzaIdx: number,
              stanza: StoryLine[]
            ) => {
              const aiTranslation = stanzaAITranslation[stanzaIdx];
              const showSpanishFirst = typedLang === 'en';

              return (
                <div key={`stanza-translations-${stanzaIdx}`}>
                  {/* AI translation result (友 full stanza) - matches UnifiedTranslator bubble style */}
                  {aiTranslation && (
                    <div className="px-2 -mt-1">
                      <div className="bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 -ml-[7px]">
                        {aiTranslation.loading ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold">{t(typedLang, "translator", "translating")}…</span>
                            <span className="animate-pulse text-lg">🧠</span>
                          </div>
                        ) : (
                          <div className="text-sm text-left relative">
                            <p className="font-semibold">{t(typedLang, "translator", "translation")}:</p>

                            {/* Enhanced single word translation with root word info */}
                            {aiTranslation.enhancedTranslation ? (
                              <>
                                <div className="text-lg font-medium text-gray-900 mt-1" style={{ wordSpacing: '0.15em' }}>
                                  <span className="font-medium">{aiTranslation.selectedWord}</span> = {aiTranslation.enhancedTranslation.contextTranslation}
                                </div>

                                {aiTranslation.enhancedTranslation.isDerivative && aiTranslation.enhancedTranslation.rootWord && (
                                  <div className="mt-3">
                                    <p className="font-semibold text-sm text-gray-700">{t(typedLang, "translator", "rootWord")}:</p>
                                    <div className="text-sm text-gray-800">
                                      <span className="font-medium">{aiTranslation.enhancedTranslation.rootWord}</span> = {aiTranslation.enhancedTranslation.rootTranslation}
                                    </div>
                                  </div>
                                )}

                                {aiTranslation.enhancedTranslation.otherCommonTranslations && aiTranslation.enhancedTranslation.otherCommonTranslations.length > 0 && (
                                  <>
                                    <p className="font-normal mt-2">
                                      <span className="font-bold italic text-gray-800">{aiTranslation.selectedWord}</span>
                                      {" "}{t(typedLang, "translator", "otherCommonUses")}:
                                    </p>
                                    <ul className="list-disc list-inside">
                                      {aiTranslation.enhancedTranslation.otherCommonTranslations.map((trans, i) => {
                                        const hasExample = !!stanzaExampleMap[trans];
                                        return (
                                          <li key={i}>
                                            <button
                                              onClick={() => fetchStanzaExample(trans, aiTranslation.selectedWord || '', stanza)}
                                              className="text-blue-600 hover:underline"
                                            >
                                              {trans}
                                            </button>
                                            {hasExample && (
                                              <div className="ml-2 mt-1 text-sm">
                                                {showSpanishFirst ? (
                                                  <>
                                                    <p className="text-gray-900">&quot;{stanzaExampleMap[trans].spanish}&quot;</p>
                                                    <p className="text-gray-600 italic">&quot;{stanzaExampleMap[trans].english}&quot;</p>
                                                  </>
                                                ) : (
                                                  <>
                                                    <p className="text-gray-900">&quot;{stanzaExampleMap[trans].english}&quot;</p>
                                                    <p className="text-gray-600 italic">&quot;{stanzaExampleMap[trans].spanish}&quot;</p>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </>
                                )}
                              </>
                            ) : aiTranslation.otherTranslations && aiTranslation.otherTranslations.length > 0 ? (
                              /* Phrase translation with other meanings */
                              <>
                                <div className="text-lg font-medium text-gray-900 mt-1" style={{ wordSpacing: '0.15em' }}>
                                  {aiTranslation.text}
                                </div>
                                <p className="font-normal mt-2">
                                  <span className="font-bold italic text-gray-800">{aiTranslation.selectedWord}</span>
                                  {" "}{t(typedLang, "translator", "otherCommonUses")}:
                                </p>
                                <ul className="list-disc list-inside">
                                  {aiTranslation.otherTranslations.map((trans, i) => {
                                    const hasExample = !!stanzaExampleMap[trans];
                                    return (
                                      <li key={i}>
                                        <button
                                          onClick={() => fetchStanzaExample(trans, aiTranslation.selectedWord || '', stanza)}
                                          className="text-blue-600 hover:underline"
                                        >
                                          {trans}
                                        </button>
                                        {hasExample && (
                                          <div className="ml-2 mt-1 text-sm">
                                            {showSpanishFirst ? (
                                              <>
                                                <p className="text-gray-900">&quot;{stanzaExampleMap[trans].spanish}&quot;</p>
                                                <p className="text-gray-600 italic">&quot;{stanzaExampleMap[trans].english}&quot;</p>
                                              </>
                                            ) : (
                                              <>
                                                <p className="text-gray-900">&quot;{stanzaExampleMap[trans].english}&quot;</p>
                                                <p className="text-gray-600 italic">&quot;{stanzaExampleMap[trans].spanish}&quot;</p>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </>
                            ) : aiTranslation.authError ? (
                              /* Auth required - show sign in prompt */
                              <div className="text-sm pr-6 mt-1">
                                <span className="text-gray-700">{t(typedLang, "translator", "signInRequired")} </span>
                                <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
                                  {t(typedLang, "translator", "signIn")}
                                </Link>
                                <span className="text-gray-700"> {t(typedLang, "translator", "or")} </span>
                                <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
                                  {t(typedLang, "translator", "createAccount")}
                                </Link>
                              </div>
                            ) : (
                              /* Simple translation (static or no extra info) */
                              <div className="text-lg font-medium text-gray-900 mt-1 whitespace-pre-line pr-6" style={{ wordSpacing: '0.15em' }}>
                                {aiTranslation.text}
                              </div>
                            )}

                            <button
                              onClick={() => setStanzaAITranslation(prev => {
                                const next = { ...prev };
                                delete next[stanzaIdx];
                                return next;
                              })}
                              className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 text-sm"
                              data-translation-control="close"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Static stanza translation (✍️ pencil) */}
                  <div
                    ref={el => { stanzaTranslationRefs.current[stanzaIdx] = el; }}
                    className="hidden px-2 mt-1 bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 -ml-[7px] relative"
                  >
                    <button
                      onClick={() => {
                        const el = stanzaTranslationRefs.current[stanzaIdx];
                        if (el) el.classList.add("hidden");
                      }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
                      data-translation-control="close"
                    >
                      ✕
                    </button>
                    <div className="text-lg font-medium text-gray-900 whitespace-pre-line pr-6" style={{ wordSpacing: '0.15em' }}>
                      {stanza
                        .filter(l => !l.isStanzaBreak && (l[typedLang]?.trim()))
                        .map((line, idx) => (
                          <p key={idx}>{line[typedLang]}</p>
                        ))}
                    </div>
                  </div>
                </div>
              );
            };

            // NESTED STANZAS: Render stanzas with visual gaps between them
            if (stanzas && stanzas.length > 0 && isPoemType) {
              let globalLineIndex = 0;
              return stanzas.map((stanza, stanzaIdx) => {
                const stanzaStartIndex = globalLineIndex;
                const linesInStanza = stanza.map((line) => {
                  const currentIndex = globalLineIndex;
                  globalLineIndex++;
                  return { line, lineIndex: currentIndex };
                });
                return (
                  <div
                    key={`stanza-${stanzaIdx}`}
                    className="w-full mb-6 relative"
                    data-stanza-number={stanzaIdx + 1}
                    data-stanza-start={stanzaStartIndex}
                    data-stanza-end={globalLineIndex - 1}
                  >
                    {renderStanzaEmojiRow(stanzaIdx, linesInStanza, stanza)}
                    {linesInStanza.map(({ line, lineIndex }) =>
                      renderLine(line, lineIndex, true, { stanzaIdx, linesInStanza })
                    )}
                    {renderStanzaTranslations(stanzaIdx, stanza)}
                  </div>
                );
              });
            }

            // FLAT SENTENCES: Use renderLine helper for prose, scripts, and legacy poem content
            return sentences.map((s, i) => renderLine(s, i, false));
          })()}
        </div>

        {/* Tab for story page - visible on all screen sizes, fades when chat opens */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Story tab clicked - opening chat');
            setTutorContext(null);
            setIsStoryTutorOpen(true);
          }}
          className={`fixed right-0 top-1/2 -translate-y-1/2 z-[100] bg-amber-100 px-1.5 py-3 rounded-l-lg shadow-lg hover:bg-amber-200 transition-all duration-300 flex items-center justify-center ${
            isStoryTutorOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          title="Open Story Tutor"
        >
          <span className="text-gray-600 text-sm font-bold">||</span>
        </button>

        {/* Tab to close chat - visible on all screen sizes when chat is open */}
        {isStoryTutorOpen && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Close tab clicked - closing chat');
              setIsStoryTutorOpen(false);
              setTutorContext(null);
            }}
            className="fixed left-0 top-1/2 -translate-y-1/2 lg:left-auto lg:right-[400px] z-[100] bg-amber-100 px-1.5 py-3 rounded-r-lg lg:rounded-l-lg lg:rounded-r-none shadow-lg hover:bg-amber-200 transition-all duration-300 flex items-center justify-center"
            title="Close Story Tutor"
          >
            <span className="text-gray-600 text-sm font-bold">||</span>
          </button>
        )}

        {/* AI Story Tutor Chat Panel - slides in from right on all screen sizes */}
        <div className={`fixed inset-y-0 lg:top-auto lg:bottom-0 lg:h-[calc(100vh-120px)] right-0 w-full lg:w-[400px] transition-transform duration-300 z-50 ${
          isStoryTutorOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          {isStoryTutorOpen && (
            <StoryTutorChat
              storySlug={storySlug}
              currentPageText={sentences.map(s => s[oppositeLang])}
              onClose={() => {
                setIsStoryTutorOpen(false);
                setTutorContext(null);
              }}
              isOpen={isStoryTutorOpen}
              initialContext={tutorContext}
              preloadedMessages={preloadedMessages}
              onMessagesUpdate={handleMessagesUpdate}
              backgroundImage={theme.backgroundImage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
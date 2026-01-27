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
      console.error('TTS Error:', error);
      setTtsError(error.message);
    }
  });

  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
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
  // Streaming:      /lng/my-stories/{id}/{level}/stream/{chapter}/{page}
  const isStreamingRoute = pathParts[5] === "stream";
  const rawChapter = isStreamingRoute ? pathParts[6] : pathParts[5];
  const rawPage = isStreamingRoute ? pathParts[7] : pathParts[6];

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
  // Preserves /stream/ segment when on streaming reader route
  const getNavigationUrl = (level: string, chapter: number, page: number) => {
    if (isUserStory && userStoryId) {
      if (isStreamingRoute) {
        return `/${typedLang}/my-stories/${userStoryId}/${level}/stream/${chapter}/${page}`;
      }
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
  const handlePlay = async (index: number, isSlow: boolean, text: string) => {
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

      // Check if there's a word selection for this sentence
      const wordSelection = wordSelections[index];

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
        return;
      }

      const hasAnyEmojiButtons = Object.values(showEmojiButtons).some(Boolean);
      if (activeAudio && !activeAudio.isPlaying && hasAnyEmojiButtons) {
        setActiveAudio(null);
        setShowEmojiButtons({});
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

      // Priority 2: Find which line was clicked and toggle emoji visibility for that line
      // Tapping between lines should activate the line ABOVE the tapped area
      const allTextContents = document.querySelectorAll('[data-text-content]');
      const clickY = e.clientY;

      // Build array of line boundaries using the TEXT CONTENT position (not the container)
      // This is more accurate because the container includes the emoji row above the text
      const lineBounds = Array.from(allTextContents).map((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const index = parseInt(el.getAttribute('data-text-content') || '-1');
        return {
          element: el as HTMLElement,
          top: rect.top,      // Top of the actual text
          bottom: rect.bottom, // Bottom of the actual text
          index
        };
      });

      // Line N owns: from its text TOP down to the next line's text TOP
      // This ensures that clicking anywhere ABOVE a line's text activates the line ABOVE
      // The dividing point is where each line's text begins
      for (let i = 0; i < lineBounds.length; i++) {
        const line = lineBounds[i];
        const nextLine = lineBounds[i + 1];

        // Top boundary: start from where this line's text begins
        // This ensures tapping ABOVE the first line does NOT activate it
        const effectiveTop = line.top;
        // Bottom boundary: extends to where the next line's text begins
        const effectiveBottom = nextLine ? nextLine.top : Infinity;

        if (clickY >= effectiveTop && clickY < effectiveBottom) {
          if (line.index >= 0) {
            setShowEmojiButtons(prev => ({
              ...prev,
              [line.index]: !prev[line.index]
            }));
          }
          return;
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [menuOpen, isAnyDropdownOpen, activeAudio, showEmojiButtons, activeTranslations, pause, hasSelectedWords, clearAllWordSelections]);

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
      {/* TTS Error Display */}
      {ttsError && (
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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex justify-center gap-2">
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
            const renderLine = (s: StoryLine, lineIndex: number, isInsideStanza: boolean = false) => {
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
                <div key={lineIndex} className={`${lineSpacing} w-full`} data-sentence-index={lineIndex}>
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

                  <div className={`flex flex-col w-full ${isScriptType && s.speaker ? 'pl-4' : ''} ${(isPoemType || isInsideStanza) ? '' : 'space-y-2'}`}>
                    {/* Horizontal emoji + audio bar row - collapses for poems when not active */}
                    <div className={`flex items-center gap-1 justify-start px-2 transition-all duration-200 ${
                      showEmojiButtons[lineIndex] ? 'h-auto opacity-100' : ((isPoemType || isInsideStanza) ? 'h-0 overflow-hidden opacity-0' : 'opacity-0 pointer-events-none')
                    }`}>
                      {/* Enhanced emoji buttons with loading states and selection indicators */}
                      <button
                        onClick={() => handlePlay(lineIndex, false, s[oppositeLang])}
                        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${
                          playbackState.isLoading && activeAudio?.index === lineIndex && !activeAudio?.isSlow
                            ? 'opacity-50 cursor-not-allowed'
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
                            ? 'opacity-50 cursor-not-allowed'
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
                  </div>

                  {/* Text content - ensure consistent left alignment */}
                  <div className="w-full px-2 relative" data-text-content={lineIndex}>
                    <UnifiedTranslator
                      sentence={s[oppositeLang]}
                      enabled={!isAnyDropdownOpen && !menuOpen}
                      readOnlyMode={translationMode === "free"}
                      autoTriggerAll={premiumTriggers[lineIndex] || false}
                      onTranslationStateChange={(hasActive) => handleTranslationStateChange(lineIndex, hasActive)}
                      onSelectionChange={(selection) => handleWordSelectionChange(lineIndex, selection)}
                      onManualTranslate={(translateFn) => handleManualTranslate(lineIndex, translateFn)}
                      onClearSelection={(clearFn) => handleClearSelection(lineIndex, clearFn)}
                      sentenceIndex={lineIndex}
                      contextSentences={sentences}
                    />
                    <p
                      ref={el => { translationRefs.current[lineIndex] = el; }}
                      className="translation hidden text-muted-foreground text-sm text-left absolute z-10 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1 shadow-sm mt-1"
                    >
                      {s[typedLang]}
                    </p>
                  </div>
                </div>
              );
            };

            // NESTED STANZAS: Render stanzas with visual gaps between them
            if (stanzas && stanzas.length > 0 && isPoemType) {
              let globalLineIndex = 0;
              return stanzas.map((stanza, stanzaIdx) => (
                <div
                  key={`stanza-${stanzaIdx}`}
                  className="w-full mb-6"
                  data-stanza-number={stanzaIdx + 1}
                >
                  {stanza.map((line) => {
                    const currentIndex = globalLineIndex;
                    globalLineIndex++;
                    return renderLine(line, currentIndex, true);
                  })}
                </div>
              ));
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
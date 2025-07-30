// src/components/StoryLayoutWithAzureTTS.tsx
"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { STORY_THEMES } from "@/components/storyThemes";
import Link from "next/link";
import { Menu, X, Volume2, Turtle, Loader2, AlertCircle } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import UnifiedTranslator from "@/components/UnifiedTranslator";
import { useSessionLogger } from '@/hooks/useSessionLogger';
import { useAzureTTS } from '@/hooks/useAzureTTS';
import { slugify } from '@/lib/stories';
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';

type ActiveAudio = {
  index: number;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
  duration: number;
  currentWordIndex: number;
};

interface StoryLayoutWithAzureTTSProps {
  sentences: Array<{ es: string; en: string }>;
  initialLevel: string;
  storySlug: string;
  title: string;
  storyMap: {
    hasChapters: boolean;
    chapters: { chapter: number; pages: number[] }[];
  };
}

export default function StoryLayoutWithAzureTTS({
  sentences,
  initialLevel,
  storySlug,
  title,
  storyMap,
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
  const [translationMode, setTranslationMode] = useState<"free" | "premium">("free");
  const [premiumTriggers, setPremiumTriggers] = useState<Record<number, number>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [showEmojiButtons, setShowEmojiButtons] = useState(false);
  const [activeTranslations, setActiveTranslations] = useState<Record<number, boolean>>({});
  const [wordSelections, setWordSelections] = useState<Record<number, { start: number; end: number } | null>>({});
  const [manualTranslateFunctions, setManualTranslateFunctions] = useState<Record<number, () => void>>({});
  const [clearSelectionFunctions, setClearSelectionFunctions] = useState<Record<number, () => void>>({});
  
  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = pathParts[4] || initialLevel || "l1";
  const currentChapter = pathParts[5] || "ch1";
  const currentPage = pathParts[6] || "page-1";

  const chapterNumber = parseInt(currentChapter.replace("ch", ""));
  const pageNumber = parseInt(currentPage.replace("page-", ""));

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
    
    // Show emoji buttons when words are selected
    if (selection) {
      setShowEmojiButtons(true);
    }
  }, []); // Remove showEmojiButtons from dependency array to prevent infinite loop

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

  const dynamicPageTitle = storyMap.hasChapters
    ? `${t(typedLang, "story", "chapter")} ${chapterNumber}, ${t(typedLang, "story", "page")} ${pageNumber}`
    : `${t(typedLang, "story", "page")} ${pageNumber}`;

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

  const storyAccessMap: Record<string, "alwaysPremium" | "conditional" | "alwaysFree"> = {
    aventura: "alwaysPremium",
    "the-last-word": "conditional",
    "diego-unplugged": "alwaysPremium",
  };
  const accessType = storyAccessMap[storySlug] || "alwaysFree";
  const readOnlyMode = accessType === "conditional" && !isPremiumUser;

  const theme = STORY_THEMES[storySlug] || STORY_THEMES.default;

  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFinalPage, setIsFinalPage] = useState(false);

  function getPrevNextPage(
    currentChapter: number,
    currentPage: number,
    storyMap: {
      hasChapters: boolean;
      chapters: { chapter: number; pages: number[] }[];
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
  }, [chapterNumber, pageNumber, storyMap]);

  useEffect(() => {
    if (storySlug === "aventura") {
      setTranslationMode("premium");
    } else if (storySlug === "the-last-word") {
      setTranslationMode(isPremiumUser ? "premium" : "free");
    } else if (storySlug === "diego-unplugged") {
      setTranslationMode(isPremiumUser ? "premium" : "free");
    }
  }, [storySlug, isPremiumUser]);

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
      // Determine language based on which text is being spoken
      // If we're on /en/ route, we speak Spanish text (oppositeLang), so use Spanish voice
      // If we're on /es/ route, we speak English text (oppositeLang), so use English voice
      const isSpanishText = typedLang === "en"; // /en/ route = Spanish text being spoken
      const language = isSpanishText ? "es-ES" : "en-US";
      const speed = isSlow ? "slow" : "normal";
      
      const request = createRequest(
        text,
        language,
        speed,
        storySlug,
        `${currentChapter}-${currentPage}-line${index + 1}`
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

  // Global click handler (same as original)
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
        target.closest('[data-translator]') ||
        target.hasAttribute('data-just-closed-translation')
      ) {
        return;
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
        setShowEmojiButtons(false);
        return;
      }
      
      if (activeAudio && !activeAudio.isPlaying && showEmojiButtons) {
        setActiveAudio(null);
        setShowEmojiButtons(false);
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
      
      // Priority 2: Toggle emoji visibility (only when no words are selected)
      setShowEmojiButtons(prev => !prev);
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
      className={`min-h-screen px-1.5 sm:px-4 pt-6 pb-16 bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`}
      style={{ backgroundImage: `url('${theme.backgroundImage}')` }}
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

      {/* Loading indicator */}
      {playbackState.isLoading && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white/90 backdrop-blur-md rounded-lg px-4 py-2 flex items-center">
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          <span>Generating audio...</span>
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
                  router.push(`/${typedLang}/stories`);
                }
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "navigate" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
            <Dropdown
              label={`${t(typedLang, "story", "levelSelect")} ▾ ${t(typedLang, "levels", currentLevel)}`}
              variant="glass"
              options={[
                { label: t(typedLang, "levels", "l1"), value: "l1" },
                { label: t(typedLang, "levels", "l2"), value: "l2" },
                { label: t(typedLang, "levels", "l3"), value: "l3" },
                { label: t(typedLang, "levels", "l4"), value: "l4" },
                { label: t(typedLang, "levels", "l5"), value: "l5" }
              ]}
              onSelect={(selectedValue) => {
                router.push(`/${typedLang}/stories/${storySlug}/${selectedValue}/ch${chapterNumber}/page-${pageNumber}`);
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "level" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
            {/* Chapter Dropdown – only if hasChapters */}
            {storyMap.chapters.length > 1 && (
              <Dropdown
                label={`${t(typedLang, "story", "chapter")} ▾ ${chapterNumber}`}
                variant="glass"
                options={storyMap.chapters.map((ch) => ({
                  label: `${t(typedLang, "story", "chapter")} ${ch.chapter}`,
                  value: ch.chapter.toString(),
                }))}
                onSelect={(selectedValue) => {
                  const selectedChapter = parseInt(selectedValue);
                  const firstPage = storyMap.chapters.find((c) => c.chapter === selectedChapter)?.pages[0] || 1;
                  router.push(`/${typedLang}/stories/${storySlug}/${currentLevel}/ch${selectedChapter}/page-${firstPage}`);
                }}
                onOpenChange={(isOpen) => {
                  setActiveDropdown(isOpen ? "chapter" : null);
                  setIsAnyDropdownOpen(isOpen);
                }}
              />
            )}

            {/* Page Dropdown – always shown */}
            <Dropdown
              label={`${t(typedLang, "story", "page")} ▾ ${pageNumber}`}
              variant="glass"
              options={
                (storyMap.chapters.find((c) => c.chapter === chapterNumber)?.pages || []).map((pg) => ({
                  label: `${t(typedLang, "story", "page")} ${pg}`,
                  value: pg.toString(),
                }))
              }
              onSelect={(selectedValue) => {
                const selectedPage = parseInt(selectedValue);
                router.push(`/${typedLang}/stories/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${selectedPage}`);
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "page" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation buttons (same as original) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex justify-center gap-2">
        {(() => {
          const { prev, next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
          const buttonClass = (disabled: boolean, color: string) =>
            `px-4 py-2 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold text-white transition transform ${color} ${
              disabled ? "opacity-40 cursor-default" : `${theme.hoverAccentColor} hover:scale-105`
            }`;

          return (
            <div className="flex flex-col items-center space-y-4 mt-8">
              <div className="flex space-x-4">
                <a
                  className={buttonClass(!prev, "bg-green-600")}
                  href={
                    prev
                      ? `/${typedLang}/stories/${storySlug}/${currentLevel}/ch${prev.ch}/page-${prev.pg}`
                      : undefined
                  }
                  onClick={(e) => !prev && e.preventDefault()}
                >
                  ⬅
                </a>
                <a
                  className={buttonClass(!next, "bg-green-700")}
                  href={
                    next
                      ? `/${typedLang}/stories/${storySlug}/${currentLevel}/ch${next.ch}/page-${next.pg}`
                      : undefined
                  }
                  onClick={(e) => !next && e.preventDefault()}
                >
                  ➡
                </a>
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

      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap relative">
        {/* Total page count in top right */}
        <div className="fixed top-4 right-4 text-sm text-gray-600 z-10">
          {currentPagePosition}
        </div>
        
        <div className="flex flex-col items-start w-full max-w-md sm:max-w-lg mx-auto px-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-center w-full">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6 w-full">{dynamicPageTitle}</h2>

          {sentences.map((s, i) => (
            <div key={i} className="my-6 w-full">
              <div className="flex flex-col space-y-2 w-full">
                {/* Horizontal emoji + audio bar row */}
                <div className="flex items-center gap-3 justify-start px-2">
                  {/* Enhanced emoji buttons with loading states and selection indicators */}
                  <div className={`flex items-center gap-2 transition-opacity duration-200 ${showEmojiButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                      onClick={() => handlePlay(i, false, s[oppositeLang])}
                      className={`hover:scale-110 transition relative rounded p-1 ${
                        playbackState.isLoading && activeAudio?.index === i && !activeAudio?.isSlow 
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      } ${
                        wordSelections[i] ? 'bg-blue-100' : 'bg-transparent'
                      }`}
                      data-audio-control="speaker"
                      disabled={playbackState.isLoading && activeAudio?.index === i && !activeAudio?.isSlow}
                      title={wordSelections[i] ? 'Play selected words' : 'Play full sentence'}
                    >
                      {playbackState.isLoading && activeAudio?.index === i && !activeAudio?.isSlow ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <span className={`text-xl ${wordSelections[i] ? 'text-blue-600' : ''}`}>🔊</span>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => handlePlay(i, true, s[oppositeLang])}
                      className={`hover:scale-110 transition relative rounded p-1 ${
                        playbackState.isLoading && activeAudio?.index === i && activeAudio?.isSlow 
                          ? 'opacity-50 cursor-not-allowed' 
                          : ''
                      } ${
                        wordSelections[i] ? 'bg-blue-100' : 'bg-transparent'
                      }`}
                      data-audio-control="turtle"
                      disabled={playbackState.isLoading && activeAudio?.index === i && activeAudio?.isSlow}
                      title={wordSelections[i] ? 'Play selected words (slow)' : 'Play full sentence (slow)'}
                    >
                      {playbackState.isLoading && activeAudio?.index === i && activeAudio?.isSlow ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                      ) : (
                        <span className={`text-xl ${wordSelections[i] ? 'text-blue-600' : ''}`}>🐢</span>
                      )}
                    </button>

                    <button 
                      onClick={() => manualTranslateFunctions[i]?.()}
                      className={`hover:scale-110 transition relative rounded p-1 ${
                        wordSelections[i] ? 'bg-blue-100' : 'bg-transparent'
                      }`}
                      data-translation-control="diamond"
                      title={wordSelections[i] ? 'Translate selected words' : 'Translate full sentence'}
                    >
                      <span className={`text-xl ${wordSelections[i] ? 'text-blue-600' : ''}`}>💎</span>
                    </button>
                    
                    {/* Pencil button for static translations */}
                    <button 
                      onClick={() => {
                        const el = translationRefs.current[i];
                        if (el) requestAnimationFrame(() => el.classList.toggle("hidden"));
                      }} 
                      className="hover:scale-110 transition"
                      data-translation-control="pencil"
                    >
                      ✍️
                    </button>
                  </div>

                  {/* Enhanced audio bar with word timing */}
                  <div className="relative flex-1 flex items-center h-[30px]">
                    {activeAudio?.index === i ? (
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
                    ) : (
                      <div className="w-full h-[6px] bg-transparent" />
                    )}
                  </div>
                </div>

                {/* Text content - ensure consistent left alignment */}
                <div className="w-full px-2 relative">
                  <UnifiedTranslator
                    sentence={s[oppositeLang]}
                    enabled={!isAnyDropdownOpen && !menuOpen}
                    readOnlyMode={translationMode === "free"}
                    autoTriggerAll={premiumTriggers[i] || false}
                    onTranslationStateChange={(hasActive) => handleTranslationStateChange(i, hasActive)}
                    onSelectionChange={(selection) => handleWordSelectionChange(i, selection)}
                    onManualTranslate={(translateFn) => handleManualTranslate(i, translateFn)}
                    onClearSelection={(clearFn) => handleClearSelection(i, clearFn)}
                    sentenceIndex={i}
                    contextSentences={sentences}
                  />
                  <p
                    ref={el => { translationRefs.current[i] = el; }}
                    className="translation hidden text-muted-foreground text-sm text-left absolute z-10 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1 shadow-sm mt-1"
                  >
                    {s[typedLang]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
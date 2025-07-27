// src/components/StoryLayoutAzure.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { STORY_THEMES } from "@/components/storyThemes";
import { Menu, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import UnifiedTranslator from "@/components/UnifiedTranslator";
import WordHighlighter from "@/components/WordHighlighter";
import AzureAudioControls from "@/components/AzureAudioControls";
import { useAzureAudioPlayer } from "@/hooks/useAzureAudioPlayer";
import { useSessionLogger } from '@/hooks/useSessionLogger';
import type { Language } from "@/types/i18n";
import { t } from '@/lib/t';

interface StoryLayoutAzureProps {
  sentences: Array<{ [key: string]: string }>;
  initialLevel: string;
  storySlug: string;
  title: string;
  storyMap: {
    hasChapters: boolean;
    chapters: { chapter: number; pages: number[] }[];
  };
}

export default function StoryLayoutAzure({
  sentences,
  initialLevel,
  storySlug,
  title,
  storyMap,
}: StoryLayoutAzureProps) {
  useSessionLogger('reading');

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

  // UI State
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [showEmojiButtons, setShowEmojiButtons] = useState(false);
  const [activeTranslations, setActiveTranslations] = useState<Record<number, boolean>>({});
  const [translationMode, setTranslationMode] = useState<"free" | "premium">("free");
  const [premiumTriggers, setPremiumTriggers] = useState<Record<number, number>>({});

  // Navigation
  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Parse URL
  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = pathParts[4] || initialLevel || "l1";
  const currentChapter = pathParts[5] || "ch1";
  const currentPage = pathParts[6] || "page-1";
  const chapterNumber = parseInt(currentChapter.replace("ch", ""));
  const pageNumber = parseInt(currentPage.replace("page-", ""));

  // Azure Audio Player
  const audioPlayer = useAzureAudioPlayer({
    autoPreload: true,
    fallbackToStaticAudio: true,
    staticAudioBasePath: `/audio/${typedLang}/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${pageNumber}`,
    onWordHighlight: (word, sentenceIndex) => {
      console.log(`Highlighting word "${word.word}" in sentence ${sentenceIndex}`);
    },
    onSentenceComplete: (sentenceIndex) => {
      console.log(`Completed sentence ${sentenceIndex}`);
    },
    onError: (error, sentenceIndex) => {
      console.error(`Audio error for sentence ${sentenceIndex}:`, error);
    }
  });

  // Refs
  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Calculate page position
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

  // Page navigation helper
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

  const [isFinalPage, setIsFinalPage] = useState(false);
  useEffect(() => {
    const { next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
    setIsFinalPage(!next);
  }, [chapterNumber, pageNumber, storyMap]);

  // Story access control
  const storyAccessMap: Record<string, "alwaysPremium" | "conditional" | "alwaysFree"> = {
    aventura: "alwaysPremium",
    "the-last-word": "conditional",
  };
  const accessType = storyAccessMap[storySlug] || "alwaysFree";
  const readOnlyMode = accessType === "conditional" && !isPremiumUser;

  // Theme
  const theme = STORY_THEMES[storySlug] || STORY_THEMES.default;
  const dynamicPageTitle = storyMap.hasChapters
    ? `${t(typedLang, "story", "chapter")} ${chapterNumber}, ${t(typedLang, "story", "page")} ${pageNumber}`
    : `${t(typedLang, "story", "page")} ${pageNumber}`;

  // Set translation mode based on story
  useEffect(() => {
    if (storySlug === "aventura") {
      setTranslationMode("premium");
    } else if (storySlug === "the-last-word") {
      setTranslationMode(isPremiumUser ? "premium" : "free");
    }
  }, [storySlug, isPremiumUser]);

  // Handle translation state changes
  const handleTranslationStateChange = useCallback((index: number, hasActive: boolean) => {
    setActiveTranslations(prev => ({ ...prev, [index]: hasActive }));
  }, []);

  // Audio playback handlers
  const handlePlay = useCallback(async (sentenceIndex: number, isSlow: boolean = false) => {
    const sentence = sentences[sentenceIndex];
    if (!sentence) return;

    const text = sentence[oppositeLang];
    const language = typedLang === "es" ? "es-ES" : "en-US";
    const storyContext = {
      storySlug,
      currentLevel,
      chapterNumber,
      pageNumber
    };

    try {
      await audioPlayer.playAzureAudio(sentenceIndex, text, language, isSlow, storyContext);
    } catch (error) {
      console.warn('Azure TTS failed, falling back to static audio:', error);
      
      // Fallback to static audio
      const staticPath = isSlow
        ? `/audio/${typedLang}/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${pageNumber}-slow/line${sentenceIndex + 1}.mp3`
        : `/audio/${typedLang}/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${pageNumber}/line${sentenceIndex + 1}.mp3`;
      
      audioPlayer.playStaticAudio(sentenceIndex, staticPath, text, isSlow);
    }
  }, [sentences, oppositeLang, typedLang, storySlug, currentLevel, chapterNumber, pageNumber, audioPlayer]);

  // Global click handler
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't process clicks on buttons, dropdowns, or interactive elements
      if (
        target.tagName === 'BUTTON' ||
        target.closest('button') ||
        target.closest('[role="button"]') ||
        target.closest('.dropdown') ||
        target.closest('[data-dropdown]') ||
        target.closest('[data-tooltip]') ||
        target.closest('[data-translator]') ||
        target.closest('[data-audio-controls]') ||
        target.hasAttribute('data-just-closed-translation')
      ) {
        return;
      }
      
      // State hierarchy
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
      
      if (audioPlayer.playerState.isPlaying) {
        audioPlayer.stopPlayback();
        setShowEmojiButtons(false);
        return;
      }
      
      if (audioPlayer.playerState.sentenceIndex !== null && !audioPlayer.playerState.isPlaying && showEmojiButtons) {
        audioPlayer.stopPlayback();
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
      
      setShowEmojiButtons(prev => !prev);
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [menuOpen, isAnyDropdownOpen, activeTranslations, audioPlayer.playerState.isPlaying, audioPlayer.playerState.sentenceIndex, showEmojiButtons, audioPlayer]);

  // Pre-cache audio for better performance
  useEffect(() => {
    if (sentences.length > 0) {
      const sentenceTexts = sentences.map(s => s[oppositeLang]);
      const language = typedLang === "es" ? "es-ES" : "en-US";
      const storyContext = {
        storySlug,
        currentLevel,
        chapterNumber,
        pageNumber
      };
      
      audioPlayer.preCacheAudio(sentenceTexts, language, storyContext);
    }
  }, [sentences, oppositeLang, typedLang, storySlug, currentLevel, chapterNumber, pageNumber, audioPlayer]);

  return (
    <div
      className={`min-h-screen px-1.5 sm:px-4 pt-6 pb-16 bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`}
      style={{ backgroundImage: `url('${theme.backgroundImage}')` }}
    >
      {/* Header */}
      <header className="fixed top-4 left-4 z-50">
        <button
          className="p-2 rounded-md bg-white/80 border border-emerald-300 hover:bg-emerald-50 shadow-md"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Menu */}
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

      {/* Navigation */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex justify-center gap-2">
        {(() => {
          const { prev, next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
          const buttonClass = (disabled, color) =>
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

      {/* Main Content */}
      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap relative">
        {/* Page Count */}
        <div className="fixed top-4 right-4 text-sm text-gray-600 z-10">
          {currentPagePosition}
        </div>
        
        <div className="flex flex-col items-start w-full max-w-md sm:max-w-lg mx-auto px-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-center w-full">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6 w-full">{dynamicPageTitle}</h2>

          {sentences.map((s, i) => (
            <div key={i} className="my-12 w-full">
              <div className="flex flex-col space-y-2 w-full">

                {/* Audio Controls Row */}
                <div className="flex items-center gap-3 justify-start px-2">
                  {/* Emoji buttons */}
                  <div className={`flex items-center gap-2 transition-opacity duration-200 ${showEmojiButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                      onClick={() => handlePlay(i, false)}
                      className="hover:scale-110 transition"
                      data-audio-control="speaker"
                    >
                      🔊
                    </button>
                    <button 
                      onClick={() => handlePlay(i, true)}
                      className="hover:scale-110 transition"
                      data-audio-control="turtle"
                    >
                      🐢
                    </button>
                    {translationMode === "free" && (
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
                    )}
                    {translationMode === "premium" && (
                      <>
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
                        <button 
                          onClick={() => setPremiumTriggers(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }))} 
                          className="hover:scale-110 transition"
                          data-translation-control="diamond"
                        >
                          💎
                        </button>
                      </>
                    )}
                  </div>

                  {/* Azure Audio Controls */}
                  <div className="relative flex-1 flex items-center h-[30px]">
                    {audioPlayer.isCurrentSentence(i) ? (
                      <AzureAudioControls
                        isPlaying={audioPlayer.playerState.isPlaying}
                        progress={audioPlayer.playerState.progress}
                        duration={audioPlayer.playerState.duration}
                        isLoading={audioPlayer.isLoading(i)}
                        hasError={audioPlayer.hasError(i)}
                        errorMessage={audioPlayer.getError(i) || undefined}
                        isSupported={audioPlayer.playerState.isSupported}
                        highlightedWords={audioPlayer.playerState.highlightedWords}
                        currentWordIndex={audioPlayer.playerState.currentWordIndex}
                        onTogglePlayback={audioPlayer.togglePlayback}
                        onStop={audioPlayer.stopPlayback}
                        onSeek={audioPlayer.seekTo}
                        onSeekToWord={audioPlayer.seekToWord}
                        onRetry={() => handlePlay(i, audioPlayer.playerState.isSlow)}
                        onDragStart={() => audioPlayer.setDragging(true)}
                        onDragEnd={() => audioPlayer.setDragging(false)}
                        showWordMarkers={audioPlayer.playerState.isSupported}
                        className="w-full"
                      />
                    ) : (
                      <div className="w-full h-[6px] bg-transparent" />
                    )}
                  </div>
                </div>

                {/* Text Content with Word Highlighting */}
                <div className="w-full px-2">
                  {audioPlayer.isCurrentSentence(i) && audioPlayer.playerState.highlightedWords.length > 0 ? (
                    <WordHighlighter
                      sentence={s[oppositeLang]}
                      highlightedWords={audioPlayer.playerState.highlightedWords}
                      currentWordIndex={audioPlayer.playerState.currentWordIndex}
                      highlightStyle="subtle"
                      isClickable={audioPlayer.playerState.isSupported}
                      onWordClick={(wordIndex) => audioPlayer.seekToWord(wordIndex)}
                      className="text-lg text-left leading-relaxed"
                    />
                  ) : (
                    <UnifiedTranslator
                      sentence={s[oppositeLang]}
                      enabled={!isAnyDropdownOpen && !menuOpen}
                      readOnlyMode={translationMode === "free"}
                      autoTriggerAll={premiumTriggers[i] || false}
                      onTranslationStateChange={(hasActive) => handleTranslationStateChange(i, hasActive)}
                    />
                  )}
                  
                  <p
                    ref={el => { translationRefs.current[i] = el; }}
                    className="translation hidden text-muted-foreground text-sm mt-2 text-left"
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
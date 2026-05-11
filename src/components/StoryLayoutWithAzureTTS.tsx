// src/components/StoryLayoutWithAzureTTS.tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getTheme } from "@/components/storyThemes";
import { useSessionLogger } from "@/hooks/useSessionLogger";
import { useAzureTTS } from "@/hooks/useAzureTTS";
import { getPrevNextPage as getPrevNextPageUtil } from "@/utils/storyNavigation";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { t } from "@/lib/t";
import { getCEFRLabel, type CEFRCode } from "@/lib/cefr";
import type { Language } from "@/types/i18n";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import {
  StoryReaderProvider,
  type StoryReaderContextValue,
  type ActiveAudio,
  type PoemNavInfo,
  type StoryMapType,
} from "@/contexts/StoryReaderContext";
import TourOrchestrator from "@/components/tour/TourOrchestrator";

// Extracted hooks
import { useWordSelection } from "@/hooks/useWordSelection";
import { useStoryAudioPlayback } from "@/hooks/useStoryAudioPlayback";
import { useGlobalClickHandler } from "@/hooks/useGlobalClickHandler";

// Extracted components
import TtsErrorDisplay from "./story-reader/TtsErrorDisplay";
import StoryHeader from "./story-reader/StoryHeader";
import NavigationButtons from "./story-reader/NavigationButtons";
import ListenButton from "./story-reader/ListenButton";
import StoryContent from "./story-reader/StoryContent";
import StoryTutorPanel from "./story-reader/StoryTutorPanel";
import SaveWordToast from "./story-reader/SaveWordToast";

// ============================================================================
// Props
// ============================================================================

interface StoryLayoutWithAzureTTSProps {
  sentences: StoryLine[];
  stanzas?: StoryLine[][];
  initialLevel: string;
  storySlug: string;
  title: string;
  storyMap: StoryMapType;
  isUserStory?: boolean;
  userStoryId?: string;
  availableLevels?: CEFRCode[];
  storyType?: string | null;
  detectedLevel?: string | null;
  structureType?: "prose" | "anthology" | "epic" | "script" | null;
}

// ============================================================================
// Component
// ============================================================================

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
  useSessionLogger("reading", storySlug);

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

  // ── TTS hook ──────────────────────────────────────────────────────────────
  const {
    playbackState, playTTS, playTTSSegment, pause, resume, stop,
    seekTo, togglePlayback, preCache, createRequest, getWordTimings,
  } = useAzureTTS({
    autoCache: true,
    onWordUpdate: (_word, index) => {
      setActiveAudio((prev) => (prev ? { ...prev, currentWordIndex: index } : null));
    },
    onPlaybackComplete: () => setActiveAudio(null),
    onError: (error) => {
      if (error.message.includes("sign in")) setTtsAuthError(true);
      else { console.error("TTS Error:", error); setTtsError(error.message); }
    },
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAuthError, setTtsAuthError] = useState(false);
  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [translationMode] = useState<"free" | "premium">("premium");
  const [premiumTriggers] = useState<Record<number, number>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [showEmojiButtons, setShowEmojiButtons] = useState<Record<number, boolean>>({});
  const [activeTranslations, setActiveTranslations] = useState<Record<number, boolean>>({});
  const [wordSelections, setWordSelections] = useState<Record<number, { start: number; end: number } | null>>({});
  const [pendingStanzaSelection, setPendingStanzaSelection] = useState<{ stanzaIdx: number; lineIndex: number; wordIndex: number } | null>(null);
  const [showStanzaEmojis, setShowStanzaEmojis] = useState<Record<number, boolean>>({});
  const [activeStanzaLine, setActiveStanzaLine] = useState<Record<number, number>>({});
  const [stanzaAITranslation, setStanzaAITranslation] = useState<Record<number, any>>({});
  const [stanzaExampleMap, setStanzaExampleMap] = useState<Record<string, { english: string; spanish: string }>>({});
  const [visibleStanzaExamples, setVisibleStanzaExamples] = useState<Set<number>>(new Set());
  const toggleStanzaExample = (i: number) =>
    setVisibleStanzaExamples((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const [manualTranslateFunctions, setManualTranslateFunctions] = useState<Record<number, () => void>>({});
  const [translationData, setTranslationData] = useState<Record<number, { word: string; translation: string; enrichedData?: any } | null>>({});
  const [clearSelectionFunctions, setClearSelectionFunctions] = useState<Record<number, () => void>>({});
  const [saveToast, setSaveToast] = useState<{ message: string; type: "success" | "error" | "exists" } | null>(null);
  const [savingWord, setSavingWord] = useState<number | null>(null);
  const [saveAuthLine, setSaveAuthLine] = useState<number | null>(null);
  const skipGlobalClickRef = useRef(false);
  const [isStoryTutorOpen, _setIsStoryTutorOpen] = useState(false);
  const [shouldRenderTutor, setShouldRenderTutor] = useState(false);
  const scrollYBeforeTutorRef = useRef(0);
  const tabOffsetY = useRef(0);
  const tabDragRef = useRef<{ startY: number; startOffset: number; moved: boolean; prevY: number; prevTime: number; velocityY: number } | null>(null);
  const tabElRef = useRef<HTMLDivElement>(null);
  const tabMomentumRef = useRef(0);
  const openStoryTutor = useCallback(() => {
    setShouldRenderTutor(true);
    _setIsStoryTutorOpen((prev) => { if (!prev) scrollYBeforeTutorRef.current = window.scrollY; return true; });
  }, []);
  const closeStoryTutor = useCallback(() => {
    _setIsStoryTutorOpen(false);
    setTimeout(() => setShouldRenderTutor(false), 300);
    if (window.innerWidth < 1024) {
      const savedY = scrollYBeforeTutorRef.current;
      requestAnimationFrame(() => window.scrollTo(0, savedY));
    }
  }, []);
  const [tutorContext, setTutorContext] = useState<{ lineIndex: number; fullLine: string; selectedText?: string } | null>(null);
  const [preloadedMessages, setPreloadedMessages] = useState<any[] | null>(null);
  const hasPreloadedRef = useRef(false);
  const handleMessagesUpdate = useCallback((newMessages: any[]) => setPreloadedMessages(newMessages), []);

  // ── Routing / derived values ──────────────────────────────────────────────
  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";
  const effectiveStructureType = storyMap.structureType || structureType;

  const getNavigationLabel = (type: "chapter" | "page"): string => {
    if (effectiveStructureType === "anthology") return type === "chapter" ? t(typedLang, "story", "collection") : t(typedLang, "story", "poem");
    if (effectiveStructureType === "epic") return type === "chapter" ? t(typedLang, "story", "canto") : t(typedLang, "story", "section");
    if (effectiveStructureType === "script") return type === "chapter" ? t(typedLang, "story", "act") : t(typedLang, "story", "scene");
    return t(typedLang, "story", type);
  };

  const getCurrentPoem = (chapterNum: number, pageNum: number): PoemNavInfo | null => {
    const chapter = storyMap.chapters.find((ch) => ch.chapter === chapterNum);
    if (!chapter?.poems) return null;
    for (const poem of chapter.poems) { if (pageNum >= poem.startPage && pageNum <= poem.endPage) return poem; }
    return null;
  };

  const usePoemNavigation = effectiveStructureType === "anthology";
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = pathParts[4] || initialLevel || "l1";
  const isLegacyStreamingRoute = pathParts[5] === "stream";
  const rawChapter = isLegacyStreamingRoute ? pathParts[6] : pathParts[5];
  const rawPage = isLegacyStreamingRoute ? pathParts[7] : pathParts[6];
  const currentChapter = rawChapter || "ch1";
  const currentPage = rawPage || "page-1";
  const chapterNumber = currentChapter.startsWith("ch") ? parseInt(currentChapter.replace("ch", "")) : parseInt(currentChapter) || 1;
  const pageNumber = currentPage.startsWith("page-") ? parseInt(currentPage.replace("page-", "")) : parseInt(currentPage) || 1;

  const getNavigationUrl = (level: string, chapter: number, page: number) => {
    if (isUserStory && userStoryId) return `/${typedLang}/my-stories/${userStoryId}/${level}/${chapter}/${page}`;
    return `/${typedLang}/stories/${storySlug}/${level}/ch${chapter}/page-${page}`;
  };
  const getHomeUrl = () => isUserStory ? `/${typedLang}/my-stories` : `/${typedLang}/stories`;

  // ── Extracted hooks ───────────────────────────────────────────────────────
  const {
    handleWordSelectionChange, handleStanzaWordClick, handleManualTranslate,
    handleClearSelection, handleTranslationData, handleTranslationStateChange,
    hasSelectedWords, clearAllWordSelections, handleSaveWord,
  } = useWordSelection({
    wordSelections, setWordSelections, pendingStanzaSelection, setPendingStanzaSelection,
    setShowEmojiButtons, setShowStanzaEmojis, setManualTranslateFunctions,
    setClearSelectionFunctions, setTranslationData, setActiveTranslations,
    clearSelectionFunctions, translationData, session,
    setSaveToast, setSavingWord, setSaveAuthLine,
    storySlug, currentLevel, oppositeLang,
  });

  const { handlePlay, handleSeek, handleDrag } = useStoryAudioPlayback({
    sentences, typedLang, storySlug, currentChapter, currentPage,
    wordSelections, activeAudio, setActiveAudio, setTtsError, setLineWidths,
    isDragging, setIsDragging, progressBarRef, textRefs,
    pause, resume, stop, seekTo, createRequest, playTTSSegment, audioPlayer: useAudioPlayer(),
  });

  // Audio player context
  const audioPlayer = useAudioPlayer();

  useGlobalClickHandler({
    menuOpen, setMenuOpen, isAnyDropdownOpen, activeAudio, setActiveAudio,
    showEmojiButtons, setShowEmojiButtons, showStanzaEmojis, setShowStanzaEmojis,
    setActiveStanzaLine, activeTranslations, setStanzaAITranslation,
    setSaveAuthLine, skipGlobalClickRef, pause, hasSelectedWords, clearAllWordSelections,
  });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playbackState.isPlaying && activeAudio) {
      setActiveAudio((prev) => prev ? { ...prev, progress: playbackState.currentTime, duration: playbackState.duration, currentWordIndex: playbackState.currentWordIndex, isPlaying: true } : null);
    } else if (!playbackState.isPlaying && activeAudio?.isPlaying) {
      setActiveAudio((prev) => (prev ? { ...prev, isPlaying: false } : null));
    }
  }, [playbackState.isPlaying, playbackState.currentTime, playbackState.duration, playbackState.currentWordIndex]);

  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFinalPage, setIsFinalPage] = useState(false);

  useEffect(() => {
    const { next } = getPrevNextPageUtil(chapterNumber, pageNumber, storyMap);
    setIsFinalPage(!next);
    if (next) router.prefetch(getNavigationUrl(currentLevel, next.ch, next.pg));
  }, [chapterNumber, pageNumber, storyMap]);

  // Prefetch next page early when audio reaches ~75% through this page's sentences
  const hasPrefetchedNextRef = useRef(false);
  useEffect(() => { hasPrefetchedNextRef.current = false; }, [pageNumber]);
  useEffect(() => {
    if (hasPrefetchedNextRef.current) return;
    const idx = audioPlayer.state.highlightedSentenceIndex;
    if (idx === null) return;
    const contentCount = sentences.filter(s => !s.isStanzaBreak && ((s.es && s.es.trim()) || (s.en && s.en.trim()))).length;
    if (contentCount > 0 && idx >= Math.floor(contentCount * 0.75)) {
      const { next } = getPrevNextPageUtil(chapterNumber, pageNumber, storyMap);
      if (next) {
        hasPrefetchedNextRef.current = true;
        router.prefetch(getNavigationUrl(currentLevel, next.ch, next.pg));
      }
    }
  }, [audioPlayer.state.highlightedSentenceIndex, sentences, chapterNumber, pageNumber, storyMap, currentLevel]);

  useEffect(() => { audioPlayer.registerPageContent(sentences, chapterNumber, pageNumber, storySlug, currentLevel); }, [sentences, chapterNumber, pageNumber, storySlug, currentLevel]);

  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => { audioPlayer.registerSentenceElements(sentenceRefs); }, []);
  const lastScrolledStanzaRef = useRef<number | null>(null);
  const skipNextScrollRef = useRef(false);

  // After page navigation, skip the first scroll since the page is already at the top
  useEffect(() => {
    skipNextScrollRef.current = true;
  }, [pageNumber]);

  // Scroll an element into view. On mobile (< 768px), position at upper quarter
  // of viewport to keep text above the audio player bar. On desktop, center as usual.
  const scrollToElement = (el: Element) => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - window.innerHeight * 0.25;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    const idx = audioPlayer.state.highlightedSentenceIndex;
    if (idx === null) return;

    // Only scroll if the audio is playing content for this exact page
    const pos = audioPlayer.state.position;
    if (!pos || pos.storySlug !== storySlug || pos.level !== currentLevel
      || pos.chapter !== chapterNumber || pos.page !== pageNumber) return;

    // Skip scroll on first highlight after page navigation
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }

    const isPoemType = storyType === "poem" || storyType === "song-lyrics" || storyType === "epic";

    if (isPoemType && sentences[idx]?.stanzaNumber) {
      // Poetry: only scroll when stanza changes
      const currentStanza = sentences[idx].stanzaNumber!;
      if (currentStanza === lastScrolledStanzaRef.current) return;
      lastScrolledStanzaRef.current = currentStanza;

      // Scroll to the stanza container (first line of the stanza)
      const stanzaEl = document.querySelector(`[data-stanza-number="${currentStanza}"]`);
      if (stanzaEl) {
        scrollToElement(stanzaEl);
      } else if (sentenceRefs.current[idx]) {
        scrollToElement(sentenceRefs.current[idx]!);
      }
    } else {
      // Prose/scripts: scroll per line as before
      if (sentenceRefs.current[idx]) {
        scrollToElement(sentenceRefs.current[idx]!);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sentences is stable per page; skipNextScrollRef guards page changes
  }, [audioPlayer.state.highlightedSentenceIndex, storyType]);

  useEffect(() => {
    if (!session?.user || hasPreloadedRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/story-tutor?storySlug=${encodeURIComponent(storySlug)}`);
        if (res.ok) { const data = await res.json(); if (data.messages?.length > 0) setPreloadedMessages(data.messages); }
        hasPreloadedRef.current = true;
      } catch { hasPreloadedRef.current = true; }
    }, 2000);
    return () => clearTimeout(timer);
  }, [session, storySlug]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/story-bookmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storySlug, level: currentLevel, chapter: chapterNumber, page: pageNumber }) }).catch(() => {});
    const wordCount = sentences.reduce((t, s) => t + (s[oppositeLang] || "").split(/\s+/).filter((w) => w.length > 0).length, 0);
    fetch("/api/page-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storySlug, level: currentLevel, chapter: chapterNumber, page: pageNumber, wordCount }) }).catch(() => {});
  }, [session, storySlug, currentLevel, chapterNumber, pageNumber, sentences, oppositeLang]);

  // ── Derived values ────────────────────────────────────────────────────────
  const dynamicPageTitle = (() => {
    const ch = storyMap.chapters.find((c) => c.chapter === chapterNumber);
    const hasPoems = usePoemNavigation && ch?.poems && ch.poems.length > 0;
    if (hasPoems) {
      const poem = getCurrentPoem(chapterNumber, pageNumber);
      if (poem) {
        const pt = poem.title.length > 30 ? `${poem.title.substring(0, 30)}...` : poem.title;
        return storyMap.hasChapters ? `${getNavigationLabel("chapter")} ${chapterNumber}, ${getNavigationLabel("page")} ${poem.number}: ${pt}` : `${getNavigationLabel("page")} ${poem.number}: ${pt}`;
      }
    }
    return storyMap.hasChapters ? `${getNavigationLabel("chapter")} ${chapterNumber}, ${getNavigationLabel("page")} ${pageNumber}` : `${getNavigationLabel("page")} ${pageNumber}`;
  })();

  let currentPagePosition = 0;
  let totalPages = 0;
  for (const ch of storyMap.chapters) { for (const pg of ch.pages) { totalPages++; if (ch.chapter === chapterNumber && pg === pageNumber) currentPagePosition = totalPages; } }

  const readOnlyMode = false;
  const theme = getTheme(storySlug);
  const backgroundStyle = theme.backgroundImage
    ? { backgroundImage: `url('${theme.backgroundImage}')` }
    : theme.backgroundGradient
      ? { background: theme.backgroundGradient }
      : { backgroundColor: theme.backgroundColor || "#f5f0e6" };

  // ── renderProgressBar ─────────────────────────────────────────────────────
  const renderProgressBar = (audio: ActiveAudio) => {
    const percent = audio.duration > 0 ? (audio.progress / audio.duration) * 100 : 0;
    if (status === "loading") return null;
    return (
      <div ref={progressBarRef} className="relative w-full h-[30px] select-none cursor-pointer flex items-center" data-audio-scrubber
        onMouseDown={(e: React.MouseEvent) => { setIsDragging(true); handleDrag(e.nativeEvent); }}
        onTouchStart={(e: React.TouchEvent) => { setIsDragging(true); handleDrag(e.nativeEvent); }}>
        <div className="w-full h-[6px] rounded bg-white/30 backdrop-blur-2xl border border-black/10 shadow-inner" />
        <div className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 -ml-3 bg-transparent flex items-center justify-center" style={{ left: `${percent}%` }}>
          <div className="w-5 h-5 bg-white/20 backdrop-blur-md border border-black/10 rounded-full shadow-lg shadow-black/50 pointer-events-auto" />
        </div>
      </div>
    );
  };

  // ── Context value ─────────────────────────────────────────────────────────
  const contextValue: StoryReaderContextValue = {
    sentences, stanzas, storySlug, title, storyMap, isUserStory, userStoryId,
    availableLevels, storyType, detectedLevel, structureType,
    typedLang, oppositeLang, currentLevel, chapterNumber, pageNumber,
    currentChapter, currentPage, effectiveStructureType,
    session, isPremiumUser,
    activeAudio, setActiveAudio, ttsError, setTtsError, ttsAuthError, setTtsAuthError,
    playbackState, playTTS, playTTSSegment, pause, resume, stop, seekTo,
    togglePlayback, preCache, createRequest, getWordTimings,
    lineWidths, setLineWidths, progressBarRef, isDragging, setIsDragging, textRefs,
    menuOpen, setMenuOpen, activeDropdown, setActiveDropdown,
    isAnyDropdownOpen, setIsAnyDropdownOpen,
    showEmojiButtons, setShowEmojiButtons, showStanzaEmojis, setShowStanzaEmojis,
    activeStanzaLine, setActiveStanzaLine,
    wordSelections, setWordSelections, pendingStanzaSelection, setPendingStanzaSelection,
    hasSelectedWords, clearAllWordSelections,
    premiumTriggers, activeTranslations, setActiveTranslations, translationMode,
    stanzaAITranslation, setStanzaAITranslation,
    stanzaExampleMap, setStanzaExampleMap,
    visibleStanzaExamples, toggleStanzaExample,
    manualTranslateFunctions, setManualTranslateFunctions,
    translationData, setTranslationData,
    clearSelectionFunctions, setClearSelectionFunctions, translationRefs,
    saveToast, setSaveToast, savingWord, setSavingWord,
    saveAuthLine, setSaveAuthLine, skipGlobalClickRef,
    isStoryTutorOpen, shouldRenderTutor, openStoryTutor, closeStoryTutor,
    tutorContext, setTutorContext, preloadedMessages, handleMessagesUpdate,
    scrollYBeforeTutorRef, tabOffsetY, tabDragRef, tabElRef, tabMomentumRef,
    getNavigationUrl, getHomeUrl, getNavigationLabel, getCurrentPoem,
    usePoemNavigation, dynamicPageTitle, currentPagePosition, totalPages,
    isFinalPage, setIsFinalPage,
    theme, backgroundStyle, readOnlyMode,
    audioPlayer, sentenceRefs,
    handlePlay, handleSeek, handleDrag,
    handleTranslationStateChange, handleWordSelectionChange,
    handleStanzaWordClick, handleManualTranslate, handleClearSelection,
    handleTranslationData, handleSaveWord, renderProgressBar,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <StoryReaderProvider value={contextValue}>
      <TourOrchestrator
        sentences={sentences}
        storySlug={storySlug}
        chapterNumber={chapterNumber}
        pageNumber={pageNumber}
        targetLang={oppositeLang}
      />
      <div
        className={`min-h-screen px-1.5 sm:px-4 pt-6 pb-[32rem] bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`}
        style={backgroundStyle}
      >
        <TtsErrorDisplay
          ttsAuthError={ttsAuthError} ttsError={ttsError} typedLang={typedLang}
          setTtsAuthError={setTtsAuthError} setTtsError={setTtsError}
        />
        <StoryHeader
          typedLang={typedLang} menuOpen={menuOpen} setMenuOpen={setMenuOpen}
          setActiveDropdown={setActiveDropdown} setIsAnyDropdownOpen={setIsAnyDropdownOpen}
          currentLevel={currentLevel} chapterNumber={chapterNumber} pageNumber={pageNumber}
          storyMap={storyMap} availableLevels={availableLevels} detectedLevel={detectedLevel}
          usePoemNavigation={usePoemNavigation} getNavigationUrl={getNavigationUrl}
          getHomeUrl={getHomeUrl} getNavigationLabel={getNavigationLabel} getCurrentPoem={getCurrentPoem}
        />
        <NavigationButtons
          chapterNumber={chapterNumber} pageNumber={pageNumber} storyMap={storyMap}
          currentLevel={currentLevel} isStoryTutorOpen={isStoryTutorOpen}
          audioPlayerIsVisible={audioPlayer.state.isVisible} getNavigationUrl={getNavigationUrl}
        />
        <ListenButton
          typedLang={typedLang} session={session} sessionStatus={status} audioPlayer={audioPlayer}
          storySlug={storySlug} title={title} currentLevel={currentLevel}
          chapterNumber={chapterNumber} pageNumber={pageNumber} sentences={sentences}
          storyMap={storyMap} isUserStory={isUserStory} userStoryId={userStoryId}
          currentPagePosition={currentPagePosition} setMenuOpen={setMenuOpen}
          setTtsAuthError={setTtsAuthError} stop={stop} setActiveAudio={() => setActiveAudio(null)}
        />

        <div className="flex justify-center mt-12 sm:mt-20 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap relative overflow-hidden">
          <StoryContent />
          <StoryTutorPanel
            storySlug={storySlug} sentences={sentences} oppositeLang={oppositeLang}
            isStoryTutorOpen={isStoryTutorOpen} shouldRenderTutor={shouldRenderTutor}
            tutorContext={tutorContext} preloadedMessages={preloadedMessages}
            backgroundImage={theme.backgroundImage}
            tabElRef={tabElRef} tabOffsetY={tabOffsetY} tabDragRef={tabDragRef}
            tabMomentumRef={tabMomentumRef} openStoryTutor={openStoryTutor}
            closeStoryTutor={closeStoryTutor} setTutorContext={setTutorContext}
            handleMessagesUpdate={handleMessagesUpdate}
          />
          <SaveWordToast toast={saveToast} />
        </div>
      </div>
    </StoryReaderProvider>
  );
}

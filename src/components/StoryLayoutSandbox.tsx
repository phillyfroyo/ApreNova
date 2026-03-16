// src/components/StoryLayoutSandbox.tsx
"use client";
import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { getTheme } from "@/components/storyThemes";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import UnifiedTranslator from "@/components/UnifiedTranslator";
import { useSessionLogger } from '@/hooks/useSessionLogger';
import { slugify } from '@/lib/stories';
import { getStoryUrl } from "@/utils/getStoryUrl";
import type { Language } from "@/types/i18n";
import { useCallback } from "react"; 
import { t } from '@/lib/t';

type ActiveAudio = {
  index: number;
  path: string;
  audio: HTMLAudioElement;
  duration: number;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
};

interface StoryLayoutSandboxProps {
  sentences: Array<{ es: string; en: string; }>;
  initialLevel: string;
  storySlug: string;
  title: string;
  storyMap: any;
}

export default function StoryLayoutSandbox({
  sentences,
  initialLevel,
  storySlug,
  title,
  storyMap,
}: StoryLayoutSandboxProps) {
  useSessionLogger('reading', storySlug);

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);

  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

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

  const [translationMode, setTranslationMode] = useState<"free" | "premium">("free");
  const [devPremiumMode, setDevPremiumMode] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [showEmojiButtons, setShowEmojiButtons] = useState(false);
  const [activeTranslations, setActiveTranslations] = useState<Record<number, boolean>>({});
  
  const handleTranslationStateChange = useCallback((index: number, hasActive: boolean) => {
    setActiveTranslations(prev => ({ ...prev, [index]: hasActive }));
  }, []);

  const { lng } = useParams() ?? {};
  const typedLang = (lng as Language) ?? "es";
  const oppositeLang = typedLang === "en" ? "es" : "en";

  const handleSeek = useCallback((newTime: number) => {
    if (activeAudio?.audio) {
      activeAudio.audio.pause();
      activeAudio.audio.currentTime = newTime;
      setActiveAudio({ ...activeAudio, progress: newTime, isPlaying: false });
    }
  }, [activeAudio]);

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
  }, [activeAudio, progressBarRef, handleSeek]);

  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleDrag(e);
  }, [isDragging, handleDrag]);

  const handleGlobalUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (storySlug === "aventura") {
      setTranslationMode("premium");
    } else if (storySlug === "the-last-word") {
      setTranslationMode(isPremiumUser ? "premium" : "free");
    } else if (storySlug === "sandbox-story") {
      // For sandbox, use dev toggle to control premium mode
      setTranslationMode(devPremiumMode ? "premium" : "free");
    }
  }, [storySlug, isPremiumUser, devPremiumMode]);

  const [premiumTriggers, setPremiumTriggers] = useState<Record<number, number>>({});

  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Parse sandbox URLs like /sandbox/page-2
  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = initialLevel || "l3";
  const currentChapter = "ch1"; // Always chapter 1 for sandbox
  const pageParam = pathParts[pathParts.length - 1];
  const currentPage = pageParam.startsWith('page-') ? pageParam : "page-1";

  const chapterNumber = parseInt(currentChapter.replace("ch", ""));
  const pageNumber = parseInt(currentPage.replace("page-", ""));

  const dynamicPageTitle = storyMap.hasChapters
    ? `Chapter ${chapterNumber}, Page ${pageNumber}`
    : `Page ${pageNumber}`;

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
    "sandbox-story": "conditional", // Treat sandbox as conditional for testing
  };
  const accessType = storyAccessMap[storySlug] || "alwaysFree";
  const readOnlyMode = accessType === "conditional" && !isPremiumUser;

  const theme = getTheme(storySlug);

  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFinalPage, setIsFinalPage] = useState(false);
  
  useEffect(() => {
    const { next } = getPrevNextPage(chapterNumber, pageNumber, storyMap);
    setIsFinalPage(!next);
  }, [chapterNumber, pageNumber, storyMap]);

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

  // Handle global clicks with proper state hierarchy
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
        target.closest('[data-tooltip]') || // UnifiedTranslator tooltip
        target.closest('[data-translator]') || // UnifiedTranslator container
        target.hasAttribute('data-just-closed-translation') // Just closed a translation
      ) {
        return;
      }
      
      // State hierarchy: handle highest priority active state first
      
      // 1. If menu or dropdown is open, close them (highest priority)
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      
      if (isAnyDropdownOpen) {
        // Dropdowns handle their own closing via click outside
        return;
      }
      
      // 2. If any translation is active, don't allow emoji toggle (UnifiedTranslator handles its own closing)
      const hasActiveTranslations = Object.values(activeTranslations).some(Boolean);
      if (hasActiveTranslations) {
        return;
      }
      
      // 3. If audio is playing, clear everything simultaneously (better UX)
      if (activeAudio?.isPlaying) {
        activeAudio.audio.pause(); // Stop audio
        setActiveAudio(null); // Hide scrubber
        setShowEmojiButtons(false); // Hide emojis
        return;
      }
      
      // 4. If audio scrubber is visible (paused), hide it when toggling emojis off
      if (activeAudio && !activeAudio.isPlaying && showEmojiButtons) {
        setActiveAudio(null); // Hide scrubber
        setShowEmojiButtons(false); // Hide emojis
        return;
      }
      
      // 5. Toggle emoji button visibility (lowest priority)
      // Don't toggle for audio/translation control buttons - let them handle their own function
      if (
        target.hasAttribute('data-audio-control') ||       // Audio buttons (speaker, turtle, close)
        target.hasAttribute('data-translation-control') || // Translation buttons (pencil, diamond)
        target.closest('[data-audio-scrubber]') ||         // Audio scrubber area
        target.closest('[data-audio-control]') ||          // Any audio control element
        target.closest('[data-translation-control]')       // Any translation control element
      ) {
        return; // Don't toggle emoji visibility for these buttons
      }
      
      setShowEmojiButtons(prev => !prev);
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [menuOpen, isAnyDropdownOpen, activeAudio, showEmojiButtons, activeTranslations]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const handlePlay = (index: number, path: string, isSlow: boolean, text: string) => {
    // Reuse same audio if same index + slow mode
    if (
      activeAudio &&
      activeAudio.index === index &&
      activeAudio.isSlow === isSlow
    ) {
      // Toggle play/pause on same line + mode
      const audio = activeAudio.audio;
      if (audio.paused) {
        audio.play();
        setActiveAudio({ ...activeAudio, isPlaying: true });
      } else {
        audio.pause();
        setActiveAudio({ ...activeAudio, isPlaying: false });
      }
    } else {
      // Pause any currently playing audio
      if (activeAudio?.audio) {
        activeAudio.audio.pause();
      }

      const audio = new Audio(path);

      audio.addEventListener("loadedmetadata", () => {
        setActiveAudio({
          index,
          path,
          audio,
          duration: audio.duration,
          isPlaying: true,
          isSlow,
          progress: 0,
        });
        audio.play();
      });

      audio.addEventListener("timeupdate", () => {
        if (!isDragging) {
          setActiveAudio((prev) => {
            if (!prev || prev.index !== index || prev.path !== path) return prev;
            return { ...prev, progress: audio.currentTime };
          });
        }
      });

      audio.addEventListener("ended", () => {
        setActiveAudio((prev) => {
          if (!prev) return null;
          return { ...prev, isPlaying: false };
        });
      });

      audio.addEventListener("error", () => speak(text));

      const width = textRefs.current[index]?.offsetWidth || 0;
      setLineWidths((prev) => ({ ...prev, [index]: width }));
    }
  };

  const renderProgressBar = (audio: ActiveAudio) => {
    const percent = (audio.progress / audio.duration) * 100;

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
      <header className="fixed top-4 left-4 z-50">
        <button
          className="p-2 rounded-md bg-white/80 border border-emerald-300 hover:bg-emerald-50 shadow-md"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed top-16 left-4 right-4 z-40 bg-white/90 backdrop-blur-md shadow-md rounded-xl p-4 space-y-4 border border-emerald-200">
          <div className="flex flex-wrap gap-4">
            {/* Disabled Home Navigation */}
            <Dropdown
              label="Navigate"
              variant="glass"
              options={[{ label: "Home (Disabled in Sandbox)", value: "home-disabled" }]}
              onSelect={() => {
                setActiveDropdown(null);
              }} // Disabled
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "navigate" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
            
            {/* Disabled Level Selection */}
            <Dropdown
              label={`Level ▾ L3 (Disabled)`}
              variant="glass"
              options={[
                { label: "L1 (Disabled)", value: "l1-disabled" },
                { label: "L2 (Disabled)", value: "l2-disabled" },
                { label: "L3 (Disabled)", value: "l3-disabled" },
                { label: "L4 (Disabled)", value: "l4-disabled" },
                { label: "L5 (Disabled)", value: "l5-disabled" }
              ]}
              onSelect={() => {}} // Disabled
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "level" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />

            {/* Chapter Dropdown – only if hasChapters (disabled for sandbox) */}
            {storyMap.chapters.length > 1 && (
              <Dropdown
                label={`Chapter ▾ ${chapterNumber} (Disabled)`}
                variant="glass"
                options={storyMap.chapters.map((ch: any) => ({
                  label: `Chapter ${ch.chapter} (Disabled)`,
                  value: `ch${ch.chapter}-disabled`,
                }))}
                onSelect={() => {}} // Disabled
                onOpenChange={(isOpen) => {
                  setActiveDropdown(isOpen ? "chapter" : null);
                  setIsAnyDropdownOpen(isOpen);
                }}
              />
            )}

            {/* FUNCTIONAL Page Dropdown */}
            <Dropdown
              label={`Page ▾ ${pageNumber}`}
              variant="glass"
              options={
                (storyMap.chapters.find((c: any) => c.chapter === chapterNumber)?.pages || []).map((pg: any) => ({
                  label: `Page ${pg}`,
                  value: pg.toString(),
                }))
              }
              onSelect={(selectedValue) => {
                const selectedPage = parseInt(selectedValue);
                // Navigate to sandbox page
                router.push(`/sandbox/page-${selectedPage}`);
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "page" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />

            {/* Dev Toggle Premium */}
            <Dropdown
              label={`Dev: ${devPremiumMode ? "💎 Premium" : "✍️ Free"}`}
              variant="glass"
              options={[
                { label: "✍️ Free Tier", value: "free" },
                { label: "💎 Premium Tier", value: "premium" }
              ]}
              onSelect={(selectedValue) => {
                setDevPremiumMode(selectedValue === "premium");
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "dev" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />

            {/* Experimental Mode Toggle */}
            <Dropdown
              label="🔧 Normal Mode"
              variant="glass"
              options={[
                { label: "🔧 Normal Mode", value: "normal" },
                { label: "🧪 Experimental Mode", value: "experimental" }
              ]}
              onSelect={(selectedValue) => {
                if (selectedValue === "experimental") {
                  router.push(`/sandbox/experimental/page-${pageNumber}`);
                }
                // Stay in normal if normal selected
              }}
              onOpenChange={(isOpen) => {
                setActiveDropdown(isOpen ? "experimental" : null);
                setIsAnyDropdownOpen(isOpen);
              }}
            />
          </div>
        </div>
      )}

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
                      ? `/sandbox/page-${prev.pg}`
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
                      ? `/sandbox/page-${next.pg}`
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
                    // Disabled in sandbox
                    alert("Mark Complete disabled in sandbox");
                  }}
                >
                  ✅ Mark Complete (Disabled)
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
        
        {/* Non-clickable Feedback Button */}
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            variant="muted"
            className="px-[10px] py-0.1 text-xs rounded-xl opacity-75 cursor-default"
            disabled
          >
            💬 Feedback
          </Button>
        </div>
        
        <div className="flex flex-col items-start w-full max-w-md sm:max-w-lg mx-auto px-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-center w-full">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6 w-full">{dynamicPageTitle}</h2>

          {sentences.map((s, i) => (
            <div key={i} className="my-6 w-full">
              <div className="flex flex-col space-y-2 w-full">
                {/* Horizontal emoji + audio bar row */}
                <div className="flex items-center gap-3 justify-start px-2">
                  {/* Emoji buttons - conditionally visible */}
                  <div className={`flex items-center gap-2 transition-opacity duration-200 ${showEmojiButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button 
                      onClick={() => handlePlay(i, `/audio/es/aventura/l1/ch1/page-1/line1.mp3`, false, s[oppositeLang])}
                      className="hover:scale-110 transition"
                      data-audio-control="speaker"
                    >
                      🔊
                    </button>
                    <button 
                      onClick={() => handlePlay(i, `/audio/es/aventura/l1/ch1/page-1-slow/line1.mp3`, true, s[oppositeLang])}
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

                  {/* Audio bar with scrubbing */}
                  <div className="relative flex-1 flex items-center h-[30px]">
                    {activeAudio?.index === i ? (
                      <>
                        {renderProgressBar(activeAudio)}
                        <button onClick={() => setActiveAudio(null)} className="ml-2 text-xl hover:scale-110 transition z-10" data-audio-control="close">✖️</button>
                      </>
                    ) : (
                      <div className="w-full h-[6px] bg-transparent" />
                    )}
                  </div>
                </div>

                {/* Text content - ensure consistent left alignment */}
                <div className="w-full px-2">
                  <UnifiedTranslator
                    sentence={s[oppositeLang]}
                    enabled={!isAnyDropdownOpen && !menuOpen}
                    readOnlyMode={translationMode === "free"}
                    autoTriggerAll={premiumTriggers[i] || false}
                    onTranslationStateChange={(hasActive) => handleTranslationStateChange(i, hasActive)}
                  />
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

      {/* AI Tutor Button */}
      <button
        onClick={() => setAiChatOpen(!aiChatOpen)}
        className="fixed bottom-6 left-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 hover:scale-105"
        title="AI Language Tutor"
      >
        <span className="text-lg">🤖</span>
      </button>

      {/* AI Chat Modal */}
      {aiChatOpen && (
        <div className="fixed bottom-24 left-6 w-80 h-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-semibold text-gray-800">AI Language Tutor</h3>
            </div>
            <button
              onClick={() => setAiChatOpen(false)}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Chat Content */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 mb-2">
                <strong>AI Tutor:</strong> Hi! I&apos;m here to help you understand this story better. 
                Ask me about grammar, vocabulary, or cultural context!
              </p>
              <p className="text-xs text-gray-400 italic">
                (AI features coming soon)
              </p>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about the story..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                disabled
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-default"
                disabled
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
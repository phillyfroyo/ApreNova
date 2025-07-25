// src/components/StoryLayout.tsx
"use client";
import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { STORY_THEMES } from "@/components/storyThemes";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button"; // ✅ correct for default exports
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
export default function StoryLayout({
  sentences,
  initialLevel,
  storySlug,
  title,
  storyMap, // 🍌 <-- Add this line
}) {
  useSessionLogger('reading');

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);

  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
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
}, [activeAudio, progressBarRef, handleSeek]); // ✅ include any used values


  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
  if (!isDragging) return;
  e.preventDefault();
  handleDrag(e);
}, [isDragging, handleDrag]); // ✅ satisfies ESLint

const handleGlobalUp = useCallback(() => {
  setIsDragging(false);
}, []);


useEffect(() => {
  if (storySlug === "aventura") {
    setTranslationMode("premium");
  } else if (storySlug === "el-bosque-perdido") {
    setTranslationMode(isPremiumUser ? "premium" : "free");
  }
}, [storySlug, isPremiumUser]);


  const [premiumTriggers, setPremiumTriggers] = useState<Record<number, number>>({});


  const pathname = usePathname() ?? "";
  const router = useRouter();

  const pathParts = pathname ? pathname.split("/") : [];
  const currentLevel = pathParts[4] || initialLevel || "l1";
  const currentChapter = pathParts[5] || "ch1";
  const currentPage = pathParts[6] || "page-1";

  const chapterNumber = parseInt(currentChapter.replace("ch", ""));
  const pageNumber = parseInt(currentPage.replace("page-", ""));

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
  "el-bosque-perdido": "conditional",
  // add more stories here later
};
const accessType = storyAccessMap[storySlug] || "alwaysFree";
const readOnlyMode = accessType === "conditional" && !isPremiumUser;

  const theme = STORY_THEMES[storySlug] || STORY_THEMES.default;

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
}, [handleGlobalMove, handleGlobalUp]); // ✅ no isDragging here, because it’s inside handleGlobalMove

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const handlePlay = (index, path, isSlow, text) => {

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

  const renderProgressBar = (audio) => {
  const percent = (audio.progress / audio.duration) * 100;

  if (status === "loading") return null;

  return (
    <div
      ref={progressBarRef}
      className="relative w-full h-[30px] select-none cursor-pointer flex items-center"
      onMouseDown={(e: React.MouseEvent) => {
  setIsDragging(true);
  handleDrag(e.nativeEvent); // 🍌 pass the raw banana
}}

onTouchStart={(e: React.TouchEvent) => {
  setIsDragging(true);
  handleDrag(e.nativeEvent); // 🍌 again, raw banana
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
            <Dropdown
  label={t(typedLang, "story", "navigate")}
  variant="glass"
  options={[{ label: t(typedLang, "story", "home"), value: "home" }]}
  onSelect={(option) => {
    if (option === "home") {
      router.push(`/${typedLang}/stories`);
    }
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
/>
          </div>
        </div>
      )}

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

      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap relative">
        {/* Total page count in top right */}
        <div className="fixed top-4 right-4 text-sm text-gray-600 z-10">
          {currentPagePosition}
        </div>
        
        <div className="flex flex-col items-center w-full max-w-md sm:max-w-lg mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6">{dynamicPageTitle}</h2>

          {sentences.map((s, i) => (
  <div key={i} className="my-12">
    <div className="flex flex-col items-center justify-center space-y-2">

      {/* Horizontal emoji + audio bar row */}
      <div className="w-full flex items-center gap-3 px-4 sm:px-6">
        {/* Emoji buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => handlePlay(i, `/audio/${typedLang}/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${pageNumber}/line${i + 1}.mp3`, false, s[oppositeLang])}>🔊</button>
          <button onClick={() => handlePlay(i, `/audio/${typedLang}/${storySlug}/${currentLevel}/ch${chapterNumber}/page-${pageNumber}-slow/line${i + 1}.mp3`, true, s[oppositeLang])}>🐢</button>
          {translationMode === "free" && (
            <button onClick={() => {
              const el = translationRefs.current[i];
              if (el) requestAnimationFrame(() => el.classList.toggle("hidden"));
            }} className="hover:scale-110 transition">✍️</button>
          )}
          {translationMode === "premium" && (
            <button onClick={() => setPremiumTriggers(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }))} className="hover:scale-110 transition">💎</button>
          )}
        </div>

        {/* Audio bar */}
        <div className="relative flex-1 flex items-center h-[30px]">
          {activeAudio?.index === i ? (
            <>
              {renderProgressBar(activeAudio)}
              <button onClick={() => setActiveAudio(null)} className="ml-2 text-xl hover:scale-110 transition z-10">✖️</button>
            </>
          ) : (
            <div className="w-full h-[6px] bg-transparent" />
          )}
        </div>
      </div>

      {/* Translator section */}
<UnifiedTranslator
  sentence={s[oppositeLang]}
  enabled
  readOnlyMode={translationMode === "free"}
  autoTriggerAll={!!premiumTriggers[i]}
/>
<p
  ref={el => { translationRefs.current[i] = el; }}
  className="translation hidden text-muted-foreground text-sm mt-2"
>
  {s[typedLang]}
</p>
    </div>
  </div>
))}

        </div>
      </div>
    </div>
  );
}
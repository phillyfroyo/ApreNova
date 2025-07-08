"use client";
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { STORY_THEMES } from "@/components/storyThemes";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button"; // ✅ correct for default exports
import UnifiedTranslator from "@/components/UnifiedTranslator";
import { useSessionLogger } from '@/hooks/useSessionLogger';
import { getMaxPartForStory } from '@/lib/stories';
import { slugify } from '@/lib/stories';


type ActiveAudio = {
  index: number;
  path: string;
  audio: HTMLAudioElement;
  duration: number;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
};

export default function StoryLayout({ sentences, initialLevel, storySlug, title }) {
  useSessionLogger('reading');

  const { data: session, status } = useSession();
  const isPremiumUser = session?.user?.isPremium;

const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);

  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [translationMode, setTranslationMode] = useState<"free" | "premium">("free");

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
  const currentPart = pathParts[5] || "part-1";
  const partNumber = parseInt(currentPart.replace("part-", ""));
  const dynamicPartTitle = `Part ${partNumber}`;

  const theme = STORY_THEMES[storySlug] || STORY_THEMES.default;

  const translationRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFinalPart, setIsFinalPart] = useState(false);


 useEffect(() => {
  const maxPart = getMaxPartForStory(storySlug, currentLevel);

  console.log({
    slugified: slugify("La Aventura"),
    storySlug, // the one you're currently viewing
    currentLevel,
    partNumber,
    maxPart,
    isFinal: partNumber === maxPart,
  });

  setIsFinalPart(partNumber === maxPart);
}, [storySlug, currentLevel, partNumber]);


    const handleGlobalMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDrag(e);
    };
    const handleGlobalUp = () => setIsDragging(false);

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
  }, [isDragging]);

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

  const handleSeek = (newTime) => {
    if (activeAudio?.audio) {
      activeAudio.audio.pause();
      activeAudio.audio.currentTime = newTime;
      setActiveAudio({ ...activeAudio, progress: newTime, isPlaying: false });
    }
  };

  const handleDrag = (e) => {
    if (!progressBarRef.current || !activeAudio?.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newTime = (offsetX / rect.width) * activeAudio.duration;
    handleSeek(newTime);
  };

  const renderProgressBar = (audio) => {
  const percent = (audio.progress / audio.duration) * 100;

  if (status === "loading") return null;

  return (
    <div
      ref={progressBarRef}
      className="relative w-full h-[30px] select-none cursor-pointer flex items-center"
      onMouseDown={(e) => {
        setIsDragging(true);
        handleDrag(e);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleDrag(e);
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
              label="Navigate ▾"
              variant="glass"
              options={["Home"]}
              onSelect={(option) => {
                if (option === "Home") {
                  window.location.href = "/es/stories";
                }
              }}
            />

            <Dropdown
              label={`Level Select ▾ ${currentLevel.toUpperCase()}`}
              variant="glass"
              options={["l1", "l2", "l3", "l4", "l5"]}
              onSelect={(level) => {
                const part = currentPart || "part-1";
                window.location.href = `/es/stories/${storySlug}/${level}/${part}`;
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[...Array(10)].map((_, i) => {
              const part = `part-${i + 1}`;
              const isActive = currentPart === part;
              return (
                <Button
                  key={part}
                  variant="parts"
                  onClick={() => {
                    window.location.href = `/es/stories/${storySlug}/${currentLevel}/${part}`;
                  }}
                  className={`px-4 py-2 text-sm sm:text-base rounded-lg sm:rounded-xl hover:scale-105 transition ${isActive ? "ring-2 ring-black" : ""}`}
                >
                  PART {i + 1}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex justify-center gap-2">
        {(() => {
          const partNumber = parseInt(currentPart.replace("part-", ""));
          const prevDisabled = partNumber === 1;
          const nextDisabled = partNumber === 10;

          const buttonClass = (disabled, color) =>
            `px-4 py-2 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold text-white transition transform ${color} ${
              disabled ? "opacity-40 cursor-default" : `${theme.hoverAccentColor} hover:scale-105`
            }`;

          return (
  <div className="flex flex-col items-center space-y-4 mt-8">
    <div className="flex space-x-4">
      <a
        className={buttonClass(prevDisabled, "bg-green-600")}
        href={
          prevDisabled ? undefined : `/es/stories/${storySlug}/${currentLevel}/part-${partNumber - 1}`
        }
        onClick={(e) => prevDisabled && e.preventDefault()}
      >
        ⬅ Prev
      </a>
      <a
        className={buttonClass(nextDisabled, "bg-green-700")}
        href={
          nextDisabled ? undefined : `/es/stories/${storySlug}/${currentLevel}/part-${partNumber + 1}`
        }
        onClick={(e) => nextDisabled && e.preventDefault()}
      >
        Next ➡
      </a>
    </div>

    {isFinalPart && (
      <button
        className="text-sm text-green-700 hover:underline"
        onClick={() => {
          fetch('/api/mark-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storySlug,
              level: currentLevel,
              part: `part-${partNumber}`,
            }),
          }).then(() => alert('✅ Story marked as complete!'));
        }}
      >
        ✅ Mark this story as complete
      </button>
    )}
  </div>
);
        })()}
      </div>

      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap">
        <div className="flex flex-col items-center w-full max-w-md sm:max-w-lg mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6">{dynamicPartTitle}</h2>

          {sentences.map((s, i) => (
  <div key={i} className="my-12">
    <div className="flex flex-col items-center justify-center space-y-2">

      {/* Horizontal emoji + audio bar row */}
      <div className="w-full flex items-center gap-3 px-4 sm:px-6">
        {/* Emoji buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => handlePlay(i, `/audio/${storySlug}/${currentLevel}/${currentPart}/line${i + 1}.mp3`, false, s.en)}>🔊</button>
          <button onClick={() => handlePlay(i, `/audio/${storySlug}/${currentLevel}/${currentPart}-slow/line${i + 1}.mp3`, true, s.en)}>🐢</button>
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
      {translationMode === "premium" && (
        <UnifiedTranslator
          sentence={s.en}
          enabled
          autoTriggerAll={!!premiumTriggers[i]}
        />
      )}

      {translationMode === "free" && (
        <>
          <p>
            <span ref={el => { textRefs.current[i] = el; }} className="inline-block">{s.en}</span>
          </p>
          <p
            ref={el => { translationRefs.current[i] = el; }}
            className="translation hidden text-muted-foreground text-sm mt-2"
          >
            {s.es}
          </p>
        </>
      )}
    </div>
  </div>
))}

        </div>
      </div>
    </div>
  );
}
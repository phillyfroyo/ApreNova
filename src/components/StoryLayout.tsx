"use client";
// src\components\StoryLayout.tsx

import UnifiedTranslator from "@/components/UnifiedTranslator";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { STORY_THEMES } from "@/components/storyThemes";

// 🔊 Audio helper
const getAudioPath = (storySlug: string, level: string, part: string, line: number, slow: boolean = false) => {
  const basePath = `/audio/${storySlug}/${level}/${slow ? part + "-slow" : part}`;
  return `${basePath}/line${line}.mp3`;
};

type Props = {
  title: string;
  storySlug: string;
  sentences: { en: string; es: string }[];
  initialLevel: string;
};

export default function StoryLayout({ title, storySlug, sentences, initialLevel }: Props) {
  const pathname = usePathname();
  const pathParts = (pathname ?? "").split("/");
  const currentLevel = pathParts[4] || initialLevel || "l1";
  const currentPart = pathParts[5] || "part-1";
  const partNumber = parseInt(currentPart.replace("part-", ""));
  const dynamicPartTitle = `Part ${partNumber}`;

  const theme = STORY_THEMES[storySlug] ?? STORY_THEMES["aventura"];

  const part = "p1"; // hardcoded for testing
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [lineWidths, setLineWidths] = useState<Record<number, number>>({});
  const textRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const [isDragging, setIsDragging] = useState(false);

  const handlePlay = (id: string, index: number, src: string) => {
    const audio = new Audio(src);

    if (activeAudio && activeAudio !== id) {
      audioRefs.current[activeAudio]?.pause();
      audioRefs.current[activeAudio]?.currentTime && (audioRefs.current[activeAudio].currentTime = 0);
    }

    audioRefs.current[id] = audio; // move this outside the listener
    audio.addEventListener("loadedmetadata", () => {
    setActiveAudio(id);
    audio.play();
    });

    audio.addEventListener("timeupdate", () => {
      if (!isDragging) {
        setActiveAudio((prev) => prev);
      }
    });

    audio.addEventListener("ended", () => {
      setActiveAudio(null);
    });

    const width = textRefs.current[index]?.offsetWidth || 0;
    setLineWidths((prev) => ({ ...prev, [index]: width }));
  };

  const handleSeek = (id: string, newTime: number) => {
    const audio = audioRefs.current[id];
    if (!audio) return;
    audio.pause();
    audio.currentTime = newTime;
    audio.play();
  };

  const handleDrag = (e: MouseEvent | TouchEvent, id: string, duration: number) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newTime = (offsetX / rect.width) * duration;
    handleSeek(id, newTime);
  };

  const renderProgressBar = (id: string, index: number, duration: number) => {
    const audio = audioRefs.current[id];
    if (!audio) return null;
    const percent = (audio.currentTime / duration) * 100;
    const width = lineWidths[index] ? `${lineWidths[index] * 0.8}px` : "80%";
    return (
      <div
        ref={progressBarRef}
        className="relative h-[30px] mt-1 select-none mx-auto cursor-pointer flex items-center"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleDrag(e.nativeEvent, id, duration);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleDrag(e.nativeEvent, id, duration);
        }}
      >
        <div className="w-full h-[6px] rounded bg-transparent backdrop-blur-2xl border border-black/10 shadow-inner" />
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 -ml-3 bg-transparent flex items-center justify-center"
          style={{ left: `${percent}%` }}
        >
          <div className="w-5 h-5 bg-white/20 backdrop-blur-md border border-black/10 rounded-full shadow-lg shadow-black/50 pointer-events-auto" />
        </div>
      </div>
    );
  };

  const testSentences = [
    "My name is Pedro, and I live in a quiet town in Guatemala.",
  ];

  return (
    <div className={`min-h-screen px-4 sm:px-10 pt-6 pb-16 bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`} style={{ backgroundImage: `url('${theme.backgroundImage}')` }}>
      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap">
        <div className="flex flex-col items-center w-full max-w-md sm:max-w-lg mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6">{dynamicPartTitle}</h2>

          {sentences.map((s, idx) => {
            const sentence = s.en;
            const translation = s.es;
            const audioId = `line-${idx}`;
            const normalSrc = "/audio/aventura/l1/part-1/line1.mp3"; 
            const slowSrc = "/audio/aventura/l1/part-1-slow/line1.mp3";

            return (
              <div key={idx} className="my-12">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="flex space-x-4">
                    <button onClick={() => handlePlay(`${audioId}-normal`, idx, normalSrc)}>🔊</button>
                    <button onClick={() => handlePlay(`${audioId}-slow`, idx, slowSrc)}>🐢</button>
                    <button
                      onClick={(e) => {
                        const t = (e.target as HTMLElement).closest("div")?.parentElement?.querySelector(".translation");
                        if (t) t.classList.toggle("hidden");
                      }}
                      className="hover:scale-110 transition"
                    >
                      ✍️
                    </button>
                  </div>
                {(activeAudio === `${audioId}-normal` || activeAudio === `${audioId}-slow`) && renderProgressBar(activeAudio!, idx, 10)}
                  
                </div>

                <UnifiedTranslator sentence={sentence} />

                <p className="translation hidden italic text-muted-foreground text-sm mt-2">{translation}</p>

                <span ref={(el) => {
                  textRefs.current[idx] = el;
                }} className="hidden">
                  {sentence}
                </span>

                
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

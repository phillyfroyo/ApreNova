"use client";
import { useEffect, useRef, useState } from "react";

export default function StoryLayout({ sentences, storySlug }) {
  const [activeAudio, setActiveAudio] = useState(null);
  const [lineWidths, setLineWidths] = useState({});
  const progressBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const textRefs = useRef([]);

  useEffect(() => {
    const handleGlobalMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDrag(e);
    };
    const handleGlobalUp = () => setIsDragging(false);

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
    if (activeAudio && activeAudio.index === index && activeAudio.isSlow === isSlow) {
      if (activeAudio.audio.paused) {
        activeAudio.audio.play();
        setActiveAudio({ ...activeAudio, isPlaying: true });
      } else {
        activeAudio.audio.pause();
        setActiveAudio({ ...activeAudio, isPlaying: false });
      }
    } else {
      if (activeAudio?.audio) activeAudio.audio.pause();
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
        setActiveAudio((prev) => ({ ...prev, isPlaying: false }));
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
    const width = lineWidths[audio.index] ? `${lineWidths[audio.index] * 0.8}px` : "80%";
    return (
      <div
        ref={progressBarRef}
        className="relative h-[30px] mt-1 select-none mx-auto cursor-pointer flex items-center"
        style={{ width }}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleDrag(e);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleDrag(e);
        }}
      >
        <div className="w-full h-[6px] rounded bg-gradient-to-r from-black/10 via-black/30 to-black/10 backdrop-blur-md border border-black/20 shadow-inner" />
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-6 h-6 -ml-3 bg-transparent flex items-center justify-center"
          style={{ left: `${percent}%` }}
        >
          <div className="w-5 h-5 bg-white/20 backdrop-blur-md border border-black/50 rounded-full shadow-md pointer-events-auto" />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 text-center">
      {sentences.map((s, i) => (
        <div key={i} className="my-12">
          <div className="flex space-x-4 items-center justify-center">
            <button onClick={() => handlePlay(i, `/audio/${storySlug}/l1/part-1/line${i + 1}.mp3`, false, s.en)}>🔊</button>
            <button onClick={() => handlePlay(i, `/audio/${storySlug}/l1/part-1-slow/line${i + 1}.mp3`, true, s.en)}>🐢</button>
          </div>

          {activeAudio?.index === i && <div className="my-3">{renderProgressBar(activeAudio)}</div>}

          <p>
            <span ref={(el) => (textRefs.current[i] = el)} className="inline-block">
              {s.en}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

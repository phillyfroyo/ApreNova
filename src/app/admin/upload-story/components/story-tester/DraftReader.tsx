"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface DraftData {
  id: string;
  title: string;
  content: string;
  audioUrl: string | null;
  audioTimestamp: number;
}

interface DraftReaderProps {
  draftId: string;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function DraftReader({ draftId, onBack }: DraftReaderProps) {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch draft
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/draft-stories/${draftId}`)
      .then((r) => r.json())
      .then((data) => {
        setDraft(data);
        setCurrentTime(data.audioTimestamp || 0);
      })
      .finally(() => setLoading(false));
  }, [draftId]);

  // Save timestamp to DB
  const saveTimestamp = useCallback(async () => {
    if (!audioRef.current || !draft) return;
    const time = audioRef.current.currentTime;
    if (time <= 0) return;
    await fetch(`/api/admin/draft-stories/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioTimestamp: time }),
    }).catch(() => {});
  }, [draftId, draft]);

  // Periodic timestamp save during playback
  useEffect(() => {
    if (isPlaying) {
      saveIntervalRef.current = setInterval(saveTimestamp, 30_000);
    } else {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    }
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [isPlaying, saveTimestamp]);

  // Save on page leave
  useEffect(() => {
    const handleUnload = () => saveTimestamp();
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [saveTimestamp]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      // Resume from saved timestamp
      if (draft?.audioTimestamp && draft.audioTimestamp > 0) {
        audio.currentTime = draft.audioTimestamp;
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      saveTimestamp();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [draft?.audioTimestamp, saveTimestamp]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/draft-stories/${draftId}/audio`, { method: "POST" });
      const data = await res.json();
      if (data.audioUrl) {
        setDraft((prev) => prev ? { ...prev, audioUrl: data.audioUrl, audioTimestamp: 0 } : prev);
      }
    } finally {
      setGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      saveTimestamp();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  if (loading) return <p className="text-gray-500 p-4">Loading...</p>;
  if (!draft) return <p className="text-red-500 p-4">Draft not found.</p>;

  const paragraphs = draft.content.split(/\n\s*\n/).filter((p) => p.trim());

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 pb-4 mb-6 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => { saveTimestamp(); onBack(); }} className="text-sm text-blue-600 hover:text-blue-800">
            &larr; Back
          </button>
          <h2 className="text-xl font-semibold text-gray-900">{draft.title}</h2>
        </div>

        {/* Audio Controls */}
        {!draft.audioUrl ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Generating Audio..." : "Generate Audio"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button onClick={() => skip(-30)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">
                -30s
              </button>
              <button
                onClick={togglePlay}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-w-[80px]"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button onClick={() => skip(30)} className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">
                +30s
              </button>
              <span className="text-sm text-gray-500 tabular-nums ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <audio ref={audioRef} src={draft.audioUrl} preload="metadata" />
          </div>
        )}
      </div>

      {/* Story Content */}
      <div className="prose prose-lg max-w-none">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 text-gray-800 leading-relaxed">
            {p.split("\n").map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

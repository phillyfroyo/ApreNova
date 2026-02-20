// src/components/AudioPlayerWrapper.tsx
"use client";

import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import AudioPlayerBar from "@/components/AudioPlayerBar";

export default function AudioPlayerWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AudioPlayerProvider>
      {children}
      <AudioPlayerBar />
    </AudioPlayerProvider>
  );
}

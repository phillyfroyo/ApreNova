// src/contexts/audio-player/helpers.ts
import type { StoryLine } from "@/lib/story-processing/text-processing";

/**
 * Filter story lines to only content sentences (skip stanza breaks and empty lines).
 * Used by both AudioPlayerProvider and AudioPlayerBar.
 */
export function getContentSentences(sentences: StoryLine[]): { line: StoryLine; originalIndex: number }[] {
  return sentences
    .map((line, i) => ({ line, originalIndex: i }))
    .filter(({ line }) => {
      if (line.isStanzaBreak) return false;
      const hasContent = (line.es && line.es.trim()) || (line.en && line.en.trim());
      return hasContent;
    });
}

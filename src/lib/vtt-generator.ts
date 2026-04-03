// src/lib/vtt-generator.ts
// Generates WebVTT track content from chapter audio timing metadata.
// The VTT is attached to the <audio> element as a <track> and drives
// highlight synchronization via native browser cuechange events.

import type { SentenceTiming, PageBoundary } from "@/types/chapter-audio";

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

/**
 * Generate a WebVTT string from sentence timings and page boundaries.
 *
 * Sentence cues carry a JSON payload with:
 *   t:"s"  — cue type (sentence)
 *   i      — index into sentenceTimings[]
 *   p      — page number
 *   l      — line index on the page
 *   lang   — "en" | "es"
 *
 * Page boundary cues carry:
 *   t:"p"  — cue type (page)
 *   p      — page number
 *
 * Page cues are point-in-time markers (1ms duration) so cuechange fires
 * exactly once when audio enters the page.
 */
export function generateVTT(
  sentenceTimings: SentenceTiming[],
  pageBoundaries: PageBoundary[]
): string {
  const lines: string[] = ["WEBVTT", ""];

  // Sentence cues
  for (let i = 0; i < sentenceTimings.length; i++) {
    const st = sentenceTimings[i];
    lines.push(`s-${i}`);
    lines.push(`${formatVTTTime(st.startTime)} --> ${formatVTTTime(st.endTime)}`);
    lines.push(JSON.stringify({ t: "s", i, p: st.pageNumber, l: st.lineIndex, lang: st.language }));
    lines.push("");
  }

  // Page boundary cues (point-in-time: 1ms duration)
  for (const pb of pageBoundaries) {
    lines.push(`page-${pb.pageNumber}`);
    lines.push(`${formatVTTTime(pb.startTime)} --> ${formatVTTTime(pb.startTime + 0.001)}`);
    lines.push(JSON.stringify({ t: "p", p: pb.pageNumber }));
    lines.push("");
  }

  return lines.join("\n");
}

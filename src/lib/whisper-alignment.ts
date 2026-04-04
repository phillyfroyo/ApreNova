// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
// Sends the concatenated chapter MP3 to Whisper to get word-level
// timestamps from the actual audio waveform. Uses silence gaps between
// Whisper words to detect sentence boundaries and map word timestamps
// directly to our known sentence structure.

import OpenAI from "openai";
import type { SentenceTiming } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/** A group of consecutive Whisper words separated by silence gaps */
interface WordGroup {
  words: WhisperWord[];
  startTime: number;
  endTime: number;
}

/**
 * Split Whisper words into groups using silence gaps.
 * Adjacent words with > `gapThreshold` seconds between them are split
 * into separate groups. Each group roughly corresponds to one sentence
 * in the audio.
 */
function groupBysilence(
  whisperWords: WhisperWord[],
  gapThreshold: number
): WordGroup[] {
  if (whisperWords.length === 0) return [];

  const groups: WordGroup[] = [];
  let currentGroup: WhisperWord[] = [whisperWords[0]];

  for (let i = 1; i < whisperWords.length; i++) {
    const gap = whisperWords[i].start - whisperWords[i - 1].end;
    if (gap >= gapThreshold) {
      // Silence gap detected — close current group, start new one
      groups.push({
        words: currentGroup,
        startTime: currentGroup[0].start,
        endTime: currentGroup[currentGroup.length - 1].end,
      });
      currentGroup = [whisperWords[i]];
    } else {
      currentGroup.push(whisperWords[i]);
    }
  }

  // Close final group
  if (currentGroup.length > 0) {
    groups.push({
      words: currentGroup,
      startTime: currentGroup[0].start,
      endTime: currentGroup[currentGroup.length - 1].end,
    });
  }

  return groups;
}

/**
 * Align Whisper word groups to our known sentence structure.
 *
 * Strategy: We have N sentences in exact audio order and M word groups
 * (separated by silence gaps) also in audio order. We match them
 * sequentially. When there are fewer groups than sentences (Whisper
 * merged sentences or missed gaps), we split large groups proportionally.
 * When there are more groups than sentences, we merge adjacent groups.
 */
function alignGroupsToSentences(
  groups: WordGroup[],
  sentences: SentenceTiming[]
): SentenceTiming[] {
  const aligned: SentenceTiming[] = [];

  if (groups.length === 0) return sentences.map(s => ({ ...s }));

  // If group count matches sentence count, perfect 1:1 mapping
  if (groups.length === sentences.length) {
    for (let i = 0; i < sentences.length; i++) {
      aligned.push(buildAlignedSentence(sentences[i], groups[i]));
    }
    return aligned;
  }

  // If more groups than sentences: merge groups to match sentence count.
  // Use sentence duration ratios to decide how many groups each sentence gets.
  if (groups.length > sentences.length) {
    const mergedGroups = mergeGroupsToMatchCount(groups, sentences);
    for (let i = 0; i < sentences.length; i++) {
      aligned.push(buildAlignedSentence(sentences[i], mergedGroups[i]));
    }
    return aligned;
  }

  // If fewer groups than sentences: some sentences share a group.
  // Split groups proportionally based on sentence durations.
  const splitGroups = splitGroupsToMatchCount(groups, sentences);
  for (let i = 0; i < sentences.length; i++) {
    aligned.push(buildAlignedSentence(sentences[i], splitGroups[i]));
  }
  return aligned;
}

/** Build an aligned SentenceTiming from the original sentence + a word group */
function buildAlignedSentence(sentence: SentenceTiming, group: WordGroup): SentenceTiming {
  return {
    ...sentence,
    startTime: group.startTime,
    endTime: group.endTime,
    wordTimings: group.words.map(w => ({
      word: w.word,
      startTime: w.start,
      endTime: w.end,
      confidence: 1.0,
    })),
  };
}

/**
 * Merge adjacent word groups to reduce count to match sentence count.
 * Groups are merged based on which sentences are longest (longest
 * sentences get the most groups).
 */
function mergeGroupsToMatchCount(
  groups: WordGroup[],
  sentences: SentenceTiming[]
): WordGroup[] {
  const n = sentences.length;
  const totalDuration = sentences.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

  // Allocate groups to sentences proportionally by duration
  const allocation: number[] = [];
  let remaining = groups.length;

  for (let i = 0; i < n; i++) {
    const fraction = (sentences[i].endTime - sentences[i].startTime) / totalDuration;
    const count = i === n - 1
      ? remaining // last sentence gets whatever's left
      : Math.max(1, Math.round(fraction * groups.length));
    allocation.push(Math.min(count, remaining));
    remaining -= allocation[i];
  }

  // Merge groups according to allocation
  const merged: WordGroup[] = [];
  let gIdx = 0;
  for (let i = 0; i < n; i++) {
    const count = allocation[i];
    if (count === 0) {
      // No groups allocated — interpolate from neighbors
      const prevEnd = merged.length > 0 ? merged[merged.length - 1].endTime : 0;
      const nextStart = gIdx < groups.length ? groups[gIdx].startTime : prevEnd;
      merged.push({ words: [], startTime: prevEnd, endTime: nextStart });
    } else {
      const slice = groups.slice(gIdx, gIdx + count);
      const allWords = slice.flatMap(g => g.words);
      merged.push({
        words: allWords,
        startTime: slice[0].startTime,
        endTime: slice[slice.length - 1].endTime,
      });
      gIdx += count;
    }
  }

  return merged;
}

/**
 * Split word groups to increase count to match sentence count.
 * When a single Whisper group contains words from multiple sentences
 * (because Whisper didn't detect the inter-sentence silence), we split
 * the group's words proportionally based on sentence durations.
 */
function splitGroupsToMatchCount(
  groups: WordGroup[],
  sentences: SentenceTiming[]
): WordGroup[] {
  const n = sentences.length;
  const m = groups.length;

  // Calculate how many sentences each group should cover
  const totalBookmarkDuration = sentences[sentences.length - 1].endTime - sentences[0].startTime;
  const result: WordGroup[] = [];
  let sIdx = 0;

  for (let gIdx = 0; gIdx < m; gIdx++) {
    const group = groups[gIdx];
    const groupTimeStart = group.startTime;
    const groupTimeEnd = group.endTime;

    // How many sentences fall within this group's time range?
    // Use the proportional mapping to estimate
    const groupFraction = (groupTimeEnd - groupTimeStart) /
      (groups[groups.length - 1].endTime - groups[0].startTime);
    const expectedSentences = Math.max(1, Math.round(groupFraction * n));
    const sentencesForGroup = Math.min(expectedSentences, n - sIdx);

    // If only 1 sentence maps to this group, simple assignment
    if (sentencesForGroup <= 1 || sIdx >= n - 1) {
      result.push(group);
      sIdx++;
      continue;
    }

    // Split this group's words among multiple sentences proportionally
    const sentenceSlice = sentences.slice(sIdx, sIdx + sentencesForGroup);
    const sliceTotalDuration = sentenceSlice.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

    let wIdx = 0;
    for (let j = 0; j < sentencesForGroup; j++) {
      const fraction = (sentenceSlice[j].endTime - sentenceSlice[j].startTime) / sliceTotalDuration;
      const wordCount = j === sentencesForGroup - 1
        ? group.words.length - wIdx
        : Math.max(1, Math.round(fraction * group.words.length));

      const slice = group.words.slice(wIdx, wIdx + wordCount);
      if (slice.length > 0) {
        result.push({
          words: slice,
          startTime: slice[0].start,
          endTime: slice[slice.length - 1].end,
        });
      } else {
        // No words for this sentence — interpolate
        const prevEnd = result.length > 0 ? result[result.length - 1].endTime : groupTimeStart;
        result.push({ words: [], startTime: prevEnd, endTime: prevEnd });
      }
      wIdx += wordCount;
    }
    sIdx += sentencesForGroup;
  }

  // If we haven't covered all sentences, fill remaining with interpolation
  while (result.length < n) {
    const lastEnd = result.length > 0 ? result[result.length - 1].endTime : 0;
    result.push({ words: [], startTime: lastEnd, endTime: lastEnd });
  }

  return result;
}

/**
 * Run Whisper forced alignment on a chapter's audio buffer.
 * Returns sentence timings with corrected timestamps from the actual audio.
 */
export async function alignChapterAudio(
  audioBuffer: Buffer,
  sentenceTimings: SentenceTiming[]
): Promise<SentenceTiming[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[whisper-alignment] Sending ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB MP3 to Whisper...`);
  const startTime = Date.now();

  const audioFile = new File([new Uint8Array(audioBuffer)], "chapter.mp3", { type: "audio/mpeg" });
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const whisperWords: WhisperWord[] = ((response as any).words || []).map((w: any) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));

  const elapsed = Date.now() - startTime;
  console.log(`[whisper-alignment] Whisper returned ${whisperWords.length} words in ${(elapsed / 1000).toFixed(1)}s`);

  if (whisperWords.length === 0) {
    console.warn("[whisper-alignment] No words returned — keeping original timings");
    return sentenceTimings;
  }

  // Detect sentence boundaries via silence gaps.
  // SSML uses 200ms breaks between sentences within a language and 300ms
  // for bilingual pauses. Use 150ms threshold to catch most gaps while
  // not splitting within sentences.
  const GAP_THRESHOLD = 0.15; // seconds
  const groups = groupBysilence(whisperWords, GAP_THRESHOLD);

  console.log(`[whisper-alignment] ${groups.length} word groups detected (${sentenceTimings.length} sentences expected)`);

  // If group count is very different from sentence count, try adjusting threshold
  let finalGroups = groups;
  if (groups.length < sentenceTimings.length * 0.5) {
    // Too few groups — threshold too high, try lower
    const tighterGroups = groupBysilence(whisperWords, 0.10);
    console.log(`[whisper-alignment] Retrying with 100ms threshold: ${tighterGroups.length} groups`);
    if (Math.abs(tighterGroups.length - sentenceTimings.length) < Math.abs(groups.length - sentenceTimings.length)) {
      finalGroups = tighterGroups;
    }
  } else if (groups.length > sentenceTimings.length * 2) {
    // Too many groups — threshold too low, try higher
    const looserGroups = groupBysilence(whisperWords, 0.25);
    console.log(`[whisper-alignment] Retrying with 250ms threshold: ${looserGroups.length} groups`);
    if (Math.abs(looserGroups.length - sentenceTimings.length) < Math.abs(groups.length - sentenceTimings.length)) {
      finalGroups = looserGroups;
    }
  }

  console.log(`[whisper-alignment] Using ${finalGroups.length} groups for ${sentenceTimings.length} sentences`);

  // Align groups to sentences
  const aligned = alignGroupsToSentences(finalGroups, sentenceTimings);

  // Log page boundary diagnostics
  const p3 = aligned.filter(s => s.pageNumber === 3);
  const p4 = aligned.filter(s => s.pageNumber === 4);
  if (p3.length > 0) {
    for (const s of p3.slice(-4)) {
      console.log(`[whisper-alignment] P3 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] words=${s.wordTimings.length} "${s.text.substring(0, 40)}"`);
    }
  }
  if (p4.length > 0) {
    for (const s of p4.slice(0, 2)) {
      console.log(`[whisper-alignment] P4 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] words=${s.wordTimings.length} "${s.text.substring(0, 40)}"`);
    }
  }

  // Quality check: verify alignment is monotonically increasing
  let monotonic = true;
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].startTime < aligned[i - 1].startTime) {
      monotonic = false;
      console.warn(`[whisper-alignment] Non-monotonic at sentence ${i}: ${aligned[i].startTime.toFixed(3)} < ${aligned[i - 1].startTime.toFixed(3)}`);
      break;
    }
  }
  if (monotonic) {
    console.log(`[whisper-alignment] Alignment quality: monotonic ✓`);
  }

  return aligned;
}

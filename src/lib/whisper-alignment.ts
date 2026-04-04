// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
// Sends the concatenated chapter MP3 to Whisper to get word-level
// timestamps from the actual audio waveform, then assigns Whisper words
// to sentences using silence-gap detection for sentence boundaries.

import OpenAI from "openai";
import type { SentenceTiming } from "@/types/chapter-audio";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Assign Whisper words to sentences using silence gaps as boundaries.
 *
 * Key insight: in bilingual mode, Whisper returns ~half the expected words
 * (it merges/skips one language). We can't use word counts for allocation.
 * Instead, we use TIME as the allocation key:
 *
 * 1. Each sentence has an original bookmark startTime and endTime
 * 2. The bookmark times give us the RELATIVE position of each sentence
 *    within the audio (these are accurate relative to each other)
 * 3. We find which Whisper words fall within each sentence's time window
 *    (after adjusting for the global offset between bookmark and Whisper timelines)
 * 4. The sentence's corrected startTime = its first Whisper word's start
 *    The sentence's corrected endTime = its last Whisper word's end
 *
 * For sentences with no Whisper words (Whisper skipped them), we interpolate
 * from neighboring sentences.
 */
function assignWordsToSentences(
  whisperWords: WhisperWord[],
  sentences: SentenceTiming[]
): SentenceTiming[] {
  if (sentences.length === 0 || whisperWords.length === 0) {
    return sentences.map(s => ({ ...s }));
  }

  // Calculate the global offset and scale between bookmark and Whisper timelines
  const bookmarkStart = sentences[0].startTime;
  const bookmarkEnd = sentences[sentences.length - 1].endTime;
  const bookmarkDuration = bookmarkEnd - bookmarkStart;

  const whisperStart = whisperWords[0].start;
  const whisperEnd = whisperWords[whisperWords.length - 1].end;
  const whisperDuration = whisperEnd - whisperStart;

  if (bookmarkDuration <= 0 || whisperDuration <= 0) {
    return sentences.map(s => ({ ...s }));
  }

  const scale = whisperDuration / bookmarkDuration;
  const offset = whisperStart - bookmarkStart * scale;

  // Map a bookmark time to approximate Whisper time
  function toWhisperTime(bookmarkTime: number): number {
    return bookmarkTime * scale + offset;
  }

  console.log(`[whisper-alignment] Timeline mapping: scale=${scale.toFixed(6)}, offset=${offset.toFixed(3)}s`);

  // For each sentence, find Whisper words that fall within its mapped time window.
  // Use a generous window (extend 20% of sentence duration on each side) to catch
  // words that Whisper placed slightly outside the expected range.
  const aligned: SentenceTiming[] = [];

  for (const sentence of sentences) {
    const mappedStart = toWhisperTime(sentence.startTime);
    const mappedEnd = toWhisperTime(sentence.endTime);
    const duration = mappedEnd - mappedStart;
    const margin = duration * 0.2;

    // Find Whisper words within the expanded window
    const windowStart = mappedStart - margin;
    const windowEnd = mappedEnd + margin;

    const matchedWords: WhisperWord[] = [];
    for (const w of whisperWords) {
      if (w.start >= windowEnd) break; // past this sentence
      if (w.end <= windowStart) continue; // before this sentence
      // Word overlaps with sentence window
      if (w.start >= windowStart && w.start < windowEnd) {
        matchedWords.push(w);
      }
    }

    if (matchedWords.length > 0) {
      aligned.push({
        ...sentence,
        startTime: matchedWords[0].start,
        endTime: matchedWords[matchedWords.length - 1].end,
        wordTimings: matchedWords.map(w => ({
          word: w.word,
          startTime: w.start,
          endTime: w.end,
          confidence: 1.0,
        })),
      });
    } else {
      // No Whisper words found — will interpolate after
      aligned.push({
        ...sentence,
        startTime: mappedStart,
        endTime: mappedEnd,
        wordTimings: [],
      });
    }
  }

  // Interpolation pass: fix sentences with no Whisper words by using
  // neighbors' boundaries. Also ensure monotonic ordering.
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].wordTimings.length === 0) {
      // Use previous sentence's end as start, next sentence's start as end
      const prevEnd = i > 0 ? aligned[i - 1].endTime : aligned[i].startTime;
      const nextStart = i < aligned.length - 1 ? aligned[i + 1].startTime : aligned[i].endTime;
      aligned[i].startTime = prevEnd;
      aligned[i].endTime = Math.max(nextStart, prevEnd + 0.001);
    }

    // Ensure monotonic: each sentence starts >= previous sentence's start
    if (i > 0 && aligned[i].startTime < aligned[i - 1].startTime) {
      aligned[i].startTime = aligned[i - 1].endTime;
      if (aligned[i].endTime < aligned[i].startTime) {
        aligned[i].endTime = aligned[i].startTime + 0.001;
      }
    }
  }

  return aligned;
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

  // Assign Whisper words to sentences using time-window matching
  const aligned = assignWordsToSentences(whisperWords, sentenceTimings);

  // Quality metrics
  let withWords = 0;
  let totalAssigned = 0;
  for (const s of aligned) {
    if (s.wordTimings.length > 0) withWords++;
    totalAssigned += s.wordTimings.length;
  }
  console.log(`[whisper-alignment] ${withWords}/${aligned.length} sentences matched, ${totalAssigned} words assigned`);

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

  // Monotonic check
  let monotonic = true;
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].startTime < aligned[i - 1].startTime) {
      monotonic = false;
      console.warn(`[whisper-alignment] Non-monotonic at ${i}: ${aligned[i].startTime.toFixed(3)} < ${aligned[i - 1].startTime.toFixed(3)}`);
      break;
    }
  }
  console.log(`[whisper-alignment] Alignment quality: monotonic ${monotonic ? "✓" : "✗"}`);

  return aligned;
}

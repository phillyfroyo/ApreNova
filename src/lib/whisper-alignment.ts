// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
// Sends the concatenated chapter MP3 to Whisper to get word-level
// timestamps from the actual audio waveform. Uses Whisper's word
// timeline to correct sentence boundaries proportionally — no fuzzy
// text matching needed, works reliably with bilingual content.

import OpenAI from "openai";
import type { SentenceTiming } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Correct sentence timings using Whisper's audio-derived timeline.
 *
 * Strategy: Whisper gives us the true audio timeline via word timestamps.
 * We find the actual audio start (first Whisper word) and end (last word),
 * then map each sentence's bookmark-relative position onto Whisper's
 * timeline proportionally. This preserves the relative sentence durations
 * from Azure (which are accurate) while correcting the absolute positions
 * to match what users actually hear.
 *
 * For word-level timings within each sentence, we assign the Whisper words
 * that fall within that sentence's corrected time range.
 */
function correctTimingsFromWhisper(
  whisperWords: WhisperWord[],
  sentences: SentenceTiming[]
): SentenceTiming[] {
  if (sentences.length === 0 || whisperWords.length === 0) return sentences;

  // Bookmark timeline: first sentence start to last sentence end
  const bookmarkStart = sentences[0].startTime;
  const bookmarkEnd = sentences[sentences.length - 1].endTime;
  const bookmarkDuration = bookmarkEnd - bookmarkStart;

  if (bookmarkDuration <= 0) return sentences;

  // Whisper timeline: first word start to last word end
  const whisperStart = whisperWords[0].start;
  const whisperEnd = whisperWords[whisperWords.length - 1].end;
  const whisperDuration = whisperEnd - whisperStart;

  if (whisperDuration <= 0) return sentences;

  console.log(`[whisper-alignment] Bookmark timeline: ${bookmarkStart.toFixed(3)}-${bookmarkEnd.toFixed(3)} (${bookmarkDuration.toFixed(3)}s)`);
  console.log(`[whisper-alignment] Whisper timeline:  ${whisperStart.toFixed(3)}-${whisperEnd.toFixed(3)} (${whisperDuration.toFixed(3)}s)`);
  console.log(`[whisper-alignment] Offset: ${(whisperStart - bookmarkStart).toFixed(3)}s, scale: ${(whisperDuration / bookmarkDuration).toFixed(6)}`);

  // Map a bookmark time to Whisper time proportionally
  const scale = whisperDuration / bookmarkDuration;
  function toWhisperTime(bookmarkTime: number): number {
    return whisperStart + (bookmarkTime - bookmarkStart) * scale;
  }

  // Pre-sort Whisper words by start time (should already be sorted)
  const sortedWords = [...whisperWords].sort((a, b) => a.start - b.start);

  // Correct each sentence's timing
  const aligned: SentenceTiming[] = [];

  for (const sentence of sentences) {
    const correctedStart = toWhisperTime(sentence.startTime);
    const correctedEnd = toWhisperTime(sentence.endTime);

    // Find Whisper words that fall within this sentence's corrected range
    const sentenceWhisperWords: WordTiming[] = [];
    for (const w of sortedWords) {
      // Word overlaps with sentence if it starts before sentence ends
      // and ends after sentence starts
      if (w.start >= correctedEnd) break; // past this sentence
      if (w.end <= correctedStart) continue; // before this sentence

      sentenceWhisperWords.push({
        word: w.word,
        startTime: w.start,
        endTime: w.end,
        confidence: 1.0,
      });
    }

    aligned.push({
      ...sentence,
      startTime: correctedStart,
      endTime: correctedEnd,
      wordTimings: sentenceWhisperWords.length > 0 ? sentenceWhisperWords : sentence.wordTimings,
    });
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
    console.warn("[whisper-alignment] No words returned from Whisper — keeping original timings");
    return sentenceTimings;
  }

  // Correct sentence timings using Whisper's timeline
  const aligned = correctTimingsFromWhisper(whisperWords, sentenceTimings);

  // Log alignment quality at page 3→4 boundary
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

  return aligned;
}

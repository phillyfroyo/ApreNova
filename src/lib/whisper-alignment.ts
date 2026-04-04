// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
// Sends the concatenated chapter MP3 to Whisper to get word-level
// timestamps from the actual audio waveform, then aligns those words
// back to our known sentence structure. This produces timestamps that
// match audible output (unlike Azure TTS bookmarks which run ~1.5-2s
// ahead due to OS audio pipeline buffering).

import OpenAI from "openai";
import type { SentenceTiming } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Normalize text for fuzzy matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation, keep letters/numbers/spaces (Unicode-aware)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split normalized text into words.
 */
function toWords(text: string): string[] {
  return normalize(text).split(" ").filter(w => w.length > 0);
}

/**
 * Calculate word overlap ratio between two word lists.
 * Returns 0-1 where 1 means every word in `target` appears in `candidate`.
 */
function wordOverlap(target: string[], candidate: string[]): number {
  if (target.length === 0) return 0;
  const candidateSet = new Set(candidate);
  let matches = 0;
  for (const word of target) {
    if (candidateSet.has(word)) matches++;
  }
  return matches / target.length;
}

/**
 * Align Whisper words to our known sentence timings.
 *
 * Strategy: walk through both lists sequentially (they're in audio order).
 * For each sentence, consume Whisper words greedily until we've matched
 * enough of the sentence's text. Uses fuzzy matching because Whisper may
 * transcribe differently than the TTS input (especially for bilingual content
 * where Whisper may use a different language than expected).
 */
function alignWordsToSentences(
  whisperWords: WhisperWord[],
  sentences: SentenceTiming[]
): SentenceTiming[] {
  const aligned: SentenceTiming[] = [];
  let wIdx = 0; // Current position in Whisper word list

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const sentence = sentences[sIdx];
    const sentenceWords = toWords(sentence.text);

    if (sentenceWords.length === 0 || wIdx >= whisperWords.length) {
      // Empty sentence or no more Whisper words — keep original timing
      aligned.push({ ...sentence });
      continue;
    }

    // Estimate how many Whisper words this sentence should consume.
    // Use the sentence's word count as a guide, but allow 50% extra
    // for Whisper's different tokenization.
    const expectedWordCount = sentenceWords.length;
    const maxWords = Math.ceil(expectedWordCount * 1.5) + 3;
    const minWords = Math.max(1, Math.floor(expectedWordCount * 0.5));

    // Try different spans of Whisper words and pick the best match
    let bestSpanEnd = wIdx + expectedWordCount;
    let bestOverlap = 0;

    for (let spanEnd = wIdx + minWords; spanEnd <= Math.min(wIdx + maxWords, whisperWords.length); spanEnd++) {
      const candidateWords = whisperWords.slice(wIdx, spanEnd).map(w => normalize(w.word));
      const overlap = wordOverlap(sentenceWords, candidateWords);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSpanEnd = spanEnd;
      }

      // Good enough match — stop searching
      if (overlap >= 0.6) break;
    }

    // If overlap is very low, this sentence might not have been transcribed
    // (e.g., very short utterance Whisper missed). Use a minimal span.
    if (bestOverlap < 0.2 && sIdx < sentences.length - 1) {
      // Try to estimate position from surrounding sentences
      // For now, use a proportional time estimate from original timings
      const originalDuration = sentence.endTime - sentence.startTime;
      const estimatedStart = wIdx > 0 ? whisperWords[wIdx - 1].end : (wIdx < whisperWords.length ? whisperWords[wIdx].start - originalDuration : sentence.startTime);
      const estimatedEnd = estimatedStart + originalDuration;

      aligned.push({
        ...sentence,
        startTime: estimatedStart,
        endTime: estimatedEnd,
        wordTimings: [], // No reliable word timings for unmatched sentences
      });
      // Don't advance wIdx — these Whisper words belong to the next sentence
      continue;
    }

    // Extract the matched span
    const matchedWords = whisperWords.slice(wIdx, bestSpanEnd);
    const startTime = matchedWords[0].start;
    const endTime = matchedWords[matchedWords.length - 1].end;

    // Build word timings from matched Whisper words
    const wordTimings: WordTiming[] = matchedWords.map(w => ({
      word: w.word,
      startTime: w.start,
      endTime: w.end,
      confidence: 1.0,
    }));

    aligned.push({
      ...sentence,
      startTime,
      endTime,
      wordTimings,
    });

    // Advance past the consumed words
    wIdx = bestSpanEnd;
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

  // Send to Whisper with word-level timestamps
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

  // Log Whisper word distribution around a known boundary for debugging
  const boundaryWords = whisperWords.filter(w => w.start >= 210 && w.start <= 225);
  if (boundaryWords.length > 0) {
    console.log(`[whisper-alignment] Whisper words near 210-225s:`);
    for (const w of boundaryWords) {
      console.log(`  [${w.start.toFixed(3)}-${w.end.toFixed(3)}] "${w.word}"`);
    }
  }

  // Align Whisper words to our sentence structure
  const aligned = alignWordsToSentences(whisperWords, sentenceTimings);

  // Log alignment quality metrics
  let matched = 0;
  let unmatched = 0;
  for (const s of aligned) {
    if (s.wordTimings.length > 0) matched++;
    else unmatched++;
  }
  console.log(`[whisper-alignment] Alignment: ${matched} matched, ${unmatched} unmatched out of ${aligned.length} sentences`);

  // Log page 3 last few sentences to check alignment accuracy
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

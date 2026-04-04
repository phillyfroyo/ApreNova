// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
// Sends the concatenated chapter MP3 to Whisper to get word-level
// timestamps from the actual audio waveform, then assigns Whisper words
// to sentences sequentially based on word count.

import OpenAI from "openai";
import type { SentenceTiming } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Count the speakable words in a sentence text.
 * Strips punctuation, collapses whitespace, filters empties.
 */
function countWords(text: string): number {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(w => w.length > 0)
    .length;
}

/**
 * Assign Whisper words to sentences sequentially by word count.
 *
 * Each sentence expects roughly N words (from its text). We walk through
 * Whisper's word list and assign the next N words to each sentence.
 * This works because both lists are in the same audio order.
 *
 * We also use silence gaps (>150ms) as confirmation boundaries — if we
 * encounter a gap while assigning words to a sentence and we've already
 * assigned at least half the expected words, we treat it as the sentence
 * boundary even if the word count hasn't been fully reached. This handles
 * Whisper tokenizing differently than our text (merging/splitting words).
 */
function assignWordsToSentences(
  whisperWords: WhisperWord[],
  sentences: SentenceTiming[]
): SentenceTiming[] {
  const aligned: SentenceTiming[] = [];
  let wIdx = 0;

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const sentence = sentences[sIdx];
    const expectedWords = countWords(sentence.text);

    if (expectedWords === 0 || wIdx >= whisperWords.length) {
      // Empty sentence or out of Whisper words — keep original timing
      aligned.push({ ...sentence });
      continue;
    }

    const startWordIdx = wIdx;

    // Consume words for this sentence
    let consumed = 0;
    const minWords = Math.max(1, Math.floor(expectedWords * 0.5));
    const maxWords = Math.ceil(expectedWords * 1.8) + 2;

    while (consumed < maxWords && wIdx < whisperWords.length) {
      // Check for silence gap (sentence boundary signal)
      if (consumed >= minWords && wIdx > startWordIdx) {
        const gap = whisperWords[wIdx].start - whisperWords[wIdx - 1].end;
        if (gap >= 0.15) {
          // Silence gap after we've consumed enough words — sentence boundary
          break;
        }
      }

      consumed++;
      wIdx++;

      // If we've hit the expected count, check if the next word has a gap
      if (consumed >= expectedWords && wIdx < whisperWords.length) {
        const gap = whisperWords[wIdx].start - whisperWords[wIdx - 1].end;
        if (gap >= 0.08) {
          // Even a small gap after expected count — good boundary
          break;
        }
      }
    }

    // Build the aligned sentence from consumed Whisper words
    const assignedWords = whisperWords.slice(startWordIdx, wIdx);

    if (assignedWords.length > 0) {
      aligned.push({
        ...sentence,
        startTime: assignedWords[0].start,
        endTime: assignedWords[assignedWords.length - 1].end,
        wordTimings: assignedWords.map(w => ({
          word: w.word,
          startTime: w.start,
          endTime: w.end,
          confidence: 1.0,
        })),
      });
    } else {
      aligned.push({ ...sentence });
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

  const totalSentenceWords = sentenceTimings.reduce((sum, s) => sum + countWords(s.text), 0);
  console.log(`[whisper-alignment] Expected ~${totalSentenceWords} words from ${sentenceTimings.length} sentences, Whisper has ${whisperWords.length}`);

  // Assign Whisper words to sentences
  const aligned = assignWordsToSentences(whisperWords, sentenceTimings);

  // Quality metrics
  let withWords = 0;
  let totalAssigned = 0;
  for (const s of aligned) {
    if (s.wordTimings.length > 0) withWords++;
    totalAssigned += s.wordTimings.length;
  }
  console.log(`[whisper-alignment] ${withWords}/${aligned.length} sentences got Whisper words (${totalAssigned}/${whisperWords.length} words used)`);

  // Log page boundary diagnostics
  const p3 = aligned.filter(s => s.pageNumber === 3);
  const p4 = aligned.filter(s => s.pageNumber === 4);
  if (p3.length > 0) {
    for (const s of p3.slice(-4)) {
      console.log(`[whisper-alignment] P3 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] words=${s.wordTimings.length}/${countWords(s.text)} "${s.text.substring(0, 40)}"`);
    }
  }
  if (p4.length > 0) {
    for (const s of p4.slice(0, 2)) {
      console.log(`[whisper-alignment] P4 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] words=${s.wordTimings.length}/${countWords(s.text)} "${s.text.substring(0, 40)}"`);
    }
  }

  // Monotonic check
  let monotonic = true;
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].startTime < aligned[i - 1].startTime) {
      monotonic = false;
      console.warn(`[whisper-alignment] Non-monotonic at sentence ${i}: ${aligned[i].startTime.toFixed(3)} < ${aligned[i - 1].startTime.toFixed(3)}`);
      break;
    }
  }
  console.log(`[whisper-alignment] Alignment quality: monotonic ${monotonic ? "✓" : "✗"}`);

  return aligned;
}

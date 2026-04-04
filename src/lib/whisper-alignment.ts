// src/lib/whisper-alignment.ts
// Post-generation forced alignment using OpenAI Whisper.
//
// Whisper can only process one language at a time. For bilingual audio
// (alternating ES→EN sentences), we run two parallel Whisper calls —
// one per language — and merge the results. Each pass produces accurate
// word timestamps for its language. Since we know each sentence's
// language from our metadata, we pick the correct pass's results.

import OpenAI from "openai";
import type { SentenceTiming, ChapterAudioMode } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

// ============================================================================
// Whisper API call
// ============================================================================

async function transcribeWithWhisper(
  openai: OpenAI,
  audioBuffer: Buffer,
  language: string
): Promise<WhisperWord[]> {
  const audioFile = new File([new Uint8Array(audioBuffer)], "chapter.mp3", { type: "audio/mpeg" });
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
    language,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  return ((response as any).words || []).map((w: any) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));
}

// ============================================================================
// Time-window word assignment
// ============================================================================

/**
 * For a set of sentences (all same language), find the Whisper words that
 * fall within each sentence's time window. The time window is derived by
 * mapping the sentence's bookmark time onto the Whisper timeline.
 *
 * @param whisperWords - Words from a single-language Whisper pass
 * @param sentences - Only the sentences matching that language (with original indices)
 * @param allSentences - Full sentence list (for computing global timeline mapping)
 */
function assignWordsToLanguageSentences(
  whisperWords: WhisperWord[],
  languageSentences: { sentence: SentenceTiming; originalIndex: number }[],
  allSentences: SentenceTiming[]
): Map<number, { startTime: number; endTime: number; wordTimings: WordTiming[] }> {
  const results = new Map<number, { startTime: number; endTime: number; wordTimings: WordTiming[] }>();

  if (whisperWords.length === 0 || languageSentences.length === 0) return results;

  // Global timeline: map bookmark times to Whisper times
  const bookmarkStart = allSentences[0].startTime;
  const bookmarkEnd = allSentences[allSentences.length - 1].endTime;
  const bookmarkDuration = bookmarkEnd - bookmarkStart;

  const whisperStart = whisperWords[0].start;
  const whisperEnd = whisperWords[whisperWords.length - 1].end;
  const whisperDuration = whisperEnd - whisperStart;

  if (bookmarkDuration <= 0 || whisperDuration <= 0) return results;

  const scale = whisperDuration / bookmarkDuration;
  const offset = whisperStart - bookmarkStart * scale;

  function toWhisperTime(bookmarkTime: number): number {
    return bookmarkTime * scale + offset;
  }

  // For each sentence of this language, find Whisper words in its time window
  for (const { sentence, originalIndex } of languageSentences) {
    const mappedStart = toWhisperTime(sentence.startTime);
    const mappedEnd = toWhisperTime(sentence.endTime);
    const duration = mappedEnd - mappedStart;
    const margin = Math.max(duration * 0.3, 0.3); // at least 300ms margin

    const windowStart = mappedStart - margin;
    const windowEnd = mappedEnd + margin;

    const matchedWords: WhisperWord[] = [];
    for (const w of whisperWords) {
      if (w.start >= windowEnd) break;
      if (w.end <= windowStart) continue;
      if (w.start >= windowStart && w.start < windowEnd) {
        matchedWords.push(w);
      }
    }

    if (matchedWords.length > 0) {
      results.set(originalIndex, {
        startTime: matchedWords[0].start,
        endTime: matchedWords[matchedWords.length - 1].end,
        wordTimings: matchedWords.map(w => ({
          word: w.word,
          startTime: w.start,
          endTime: w.end,
          confidence: 1.0,
        })),
      });
    }
  }

  return results;
}

// ============================================================================
// Interpolation for unmatched sentences
// ============================================================================

/**
 * For sentences that got no Whisper words, interpolate timing from
 * neighboring matched sentences. Ensures monotonic ordering.
 */
function interpolateAndFinalize(
  aligned: SentenceTiming[]
): SentenceTiming[] {
  // Forward pass: interpolate start times from previous sentence's end
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].wordTimings.length === 0 && i > 0) {
      aligned[i].startTime = aligned[i - 1].endTime;
    }
    // Find the next sentence with words to get endTime
    if (aligned[i].wordTimings.length === 0) {
      let nextEnd = aligned[i].endTime;
      for (let j = i + 1; j < aligned.length; j++) {
        if (aligned[j].wordTimings.length > 0) {
          nextEnd = aligned[j].startTime;
          break;
        }
      }
      aligned[i].endTime = nextEnd;
    }
  }

  // Ensure monotonic and valid ranges
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].startTime < aligned[i - 1].startTime) {
      aligned[i].startTime = aligned[i - 1].endTime;
    }
    if (aligned[i].endTime <= aligned[i].startTime) {
      aligned[i].endTime = aligned[i].startTime + 0.001;
    }
  }

  return aligned;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run Whisper forced alignment on a chapter's audio buffer.
 *
 * - Monolingual modes: single Whisper call
 * - Bilingual modes: two parallel Whisper calls (one per language), merged
 */
export async function alignChapterAudio(
  audioBuffer: Buffer,
  sentenceTimings: SentenceTiming[],
  mode: ChapterAudioMode
): Promise<SentenceTiming[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const isBilingual = mode === "bilingual-en" || mode === "bilingual-es";

  console.log(`[whisper-alignment] Mode: ${mode}, ${sentenceTimings.length} sentences, ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  const startTime = Date.now();

  // Determine which languages to transcribe
  let enWords: WhisperWord[] = [];
  let esWords: WhisperWord[] = [];

  if (isBilingual) {
    // Two parallel Whisper calls — one per language
    console.log("[whisper-alignment] Bilingual mode — running EN and ES passes in parallel...");
    const [enResult, esResult] = await Promise.all([
      transcribeWithWhisper(openai, audioBuffer, "en"),
      transcribeWithWhisper(openai, audioBuffer, "es"),
    ]);
    enWords = enResult;
    esWords = esResult;
    console.log(`[whisper-alignment] EN pass: ${enWords.length} words, ES pass: ${esWords.length} words`);
  } else {
    // Single pass for monolingual
    const language = mode === "en" ? "en" : "es";
    console.log(`[whisper-alignment] Monolingual mode — running ${language} pass...`);
    const words = await transcribeWithWhisper(openai, audioBuffer, language);
    if (language === "en") enWords = words;
    else esWords = words;
    console.log(`[whisper-alignment] ${language} pass: ${words.length} words`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[whisper-alignment] Whisper completed in ${(elapsed / 1000).toFixed(1)}s`);

  if (enWords.length === 0 && esWords.length === 0) {
    console.warn("[whisper-alignment] No words from either pass — keeping original timings");
    return sentenceTimings;
  }

  // Split sentences by language (preserving original indices)
  const enSentences: { sentence: SentenceTiming; originalIndex: number }[] = [];
  const esSentences: { sentence: SentenceTiming; originalIndex: number }[] = [];
  for (let i = 0; i < sentenceTimings.length; i++) {
    const s = sentenceTimings[i];
    if (s.language === "en") enSentences.push({ sentence: s, originalIndex: i });
    else esSentences.push({ sentence: s, originalIndex: i });
  }

  console.log(`[whisper-alignment] Sentences: ${enSentences.length} EN, ${esSentences.length} ES`);

  // Assign Whisper words to sentences by language
  const enAligned = assignWordsToLanguageSentences(enWords, enSentences, sentenceTimings);
  const esAligned = assignWordsToLanguageSentences(esWords, esSentences, sentenceTimings);

  console.log(`[whisper-alignment] Matched: ${enAligned.size}/${enSentences.length} EN, ${esAligned.size}/${esSentences.length} ES`);

  // Merge results back into sentence order
  const aligned: SentenceTiming[] = sentenceTimings.map((sentence, i) => {
    const match = sentence.language === "en" ? enAligned.get(i) : esAligned.get(i);
    if (match) {
      return { ...sentence, ...match };
    }
    // No match — keep original timing (will be interpolated)
    return { ...sentence };
  });

  // Interpolate unmatched sentences and ensure monotonic ordering
  interpolateAndFinalize(aligned);

  // Quality metrics
  const matchedCount = enAligned.size + esAligned.size;
  const totalWords = [...enAligned.values(), ...esAligned.values()].reduce((sum, m) => sum + m.wordTimings.length, 0);
  console.log(`[whisper-alignment] ${matchedCount}/${sentenceTimings.length} sentences matched, ${totalWords} total words assigned`);

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

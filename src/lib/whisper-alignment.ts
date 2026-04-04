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
// Whisper API
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
// Sequential word assignment (no double-counting)
// ============================================================================

/**
 * Assign Whisper words to sentences sequentially. Each word is consumed
 * exactly once — the cursor never goes backwards. For each sentence we:
 *
 * 1. Skip Whisper words that are before the sentence's expected position
 * 2. Consume words until we hit a silence gap or reach the expected count
 *
 * For bilingual passes, the skip in step 1 jumps past the garbage words
 * that Whisper produced for the other language's segments.
 */
function assignWordsSequentially(
  whisperWords: WhisperWord[],
  languageSentences: { sentence: SentenceTiming; originalIndex: number }[],
  allSentences: SentenceTiming[]
): Map<number, { startTime: number; endTime: number; wordTimings: WordTiming[] }> {
  const results = new Map<number, { startTime: number; endTime: number; wordTimings: WordTiming[] }>();

  if (whisperWords.length === 0 || languageSentences.length === 0) return results;

  // Map bookmark times → Whisper times (approximate, for seeking)
  const bStart = allSentences[0].startTime;
  const bEnd = allSentences[allSentences.length - 1].endTime;
  const bDur = bEnd - bStart;
  const wStart = whisperWords[0].start;
  const wEnd = whisperWords[whisperWords.length - 1].end;
  const wDur = wEnd - wStart;

  if (bDur <= 0 || wDur <= 0) return results;

  const scale = wDur / bDur;
  const toW = (t: number) => wStart + (t - bStart) * scale;

  let cursor = 0;

  for (const { sentence, originalIndex } of languageSentences) {
    const expectedStart = toW(sentence.startTime);
    const expectedEnd = toW(sentence.endTime);
    const textWords = sentence.text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    // Skip words before this sentence's expected start (with 1s tolerance)
    while (cursor < whisperWords.length && whisperWords[cursor].start < expectedStart - 1.0) {
      cursor++;
    }

    if (cursor >= whisperWords.length) break;

    // Consume words for this sentence
    const startIdx = cursor;
    let consumed = 0;
    const maxWords = Math.ceil(textWords * 1.5) + 3;

    while (consumed < maxWords && cursor < whisperWords.length) {
      const w = whisperWords[cursor];

      // Stop if word is clearly past this sentence (1s past expected end)
      if (w.start > expectedEnd + 1.0 && consumed > 0) break;

      // Silence gap detection: if we've consumed at least half the expected
      // words and there's a gap, treat it as the sentence boundary
      if (consumed >= Math.max(1, Math.floor(textWords * 0.5)) && cursor > startIdx) {
        const gap = w.start - whisperWords[cursor - 1].end;
        if (gap >= 0.12) break;
      }

      cursor++;
      consumed++;
    }

    const assigned = whisperWords.slice(startIdx, cursor);
    if (assigned.length > 0) {
      results.set(originalIndex, {
        startTime: assigned[0].start,
        endTime: assigned[assigned.length - 1].end,
        wordTimings: assigned.map(w => ({
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
// Interpolation
// ============================================================================

function interpolateAndFinalize(aligned: SentenceTiming[]): SentenceTiming[] {
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].wordTimings.length === 0) {
      const prevEnd = i > 0 ? aligned[i - 1].endTime : aligned[i].startTime;
      let nextStart = aligned[i].endTime;
      for (let j = i + 1; j < aligned.length; j++) {
        if (aligned[j].wordTimings.length > 0) {
          nextStart = aligned[j].startTime;
          break;
        }
      }
      aligned[i].startTime = prevEnd;
      aligned[i].endTime = Math.max(nextStart, prevEnd + 0.001);
    }

    if (i > 0 && aligned[i].startTime < aligned[i - 1].startTime) {
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

export async function alignChapterAudio(
  audioBuffer: Buffer,
  sentenceTimings: SentenceTiming[],
  mode: ChapterAudioMode
): Promise<SentenceTiming[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const isBilingual = mode === "bilingual-en" || mode === "bilingual-es";

  console.log(`[whisper-alignment] Mode: ${mode}, ${sentenceTimings.length} sentences, ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  const t0 = Date.now();

  // Run Whisper
  let enWords: WhisperWord[] = [];
  let esWords: WhisperWord[] = [];

  if (isBilingual) {
    console.log("[whisper-alignment] Bilingual — EN + ES passes in parallel...");
    [enWords, esWords] = await Promise.all([
      transcribeWithWhisper(openai, audioBuffer, "en"),
      transcribeWithWhisper(openai, audioBuffer, "es"),
    ]);
    console.log(`[whisper-alignment] EN: ${enWords.length} words, ES: ${esWords.length} words`);
  } else {
    const lang = mode === "en" ? "en" : "es";
    console.log(`[whisper-alignment] Monolingual ${lang} pass...`);
    const words = await transcribeWithWhisper(openai, audioBuffer, lang);
    if (lang === "en") enWords = words; else esWords = words;
    console.log(`[whisper-alignment] ${lang}: ${words.length} words`);
  }

  console.log(`[whisper-alignment] Whisper done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (enWords.length === 0 && esWords.length === 0) {
    console.warn("[whisper-alignment] No words — keeping original timings");
    return sentenceTimings;
  }

  // Split sentences by language
  const enSents: { sentence: SentenceTiming; originalIndex: number }[] = [];
  const esSents: { sentence: SentenceTiming; originalIndex: number }[] = [];
  for (let i = 0; i < sentenceTimings.length; i++) {
    if (sentenceTimings[i].language === "en") enSents.push({ sentence: sentenceTimings[i], originalIndex: i });
    else esSents.push({ sentence: sentenceTimings[i], originalIndex: i });
  }

  // Assign words sequentially (no double-counting)
  const enAligned = assignWordsSequentially(enWords, enSents, sentenceTimings);
  const esAligned = assignWordsSequentially(esWords, esSents, sentenceTimings);

  console.log(`[whisper-alignment] Matched: ${enAligned.size}/${enSents.length} EN, ${esAligned.size}/${esSents.length} ES`);

  // Merge back into sentence order
  const aligned: SentenceTiming[] = sentenceTimings.map((s, i) => {
    const match = s.language === "en" ? enAligned.get(i) : esAligned.get(i);
    return match ? { ...s, ...match } : { ...s };
  });

  interpolateAndFinalize(aligned);

  // Quality
  const matched = enAligned.size + esAligned.size;
  const words = [...enAligned.values(), ...esAligned.values()].reduce((n, m) => n + m.wordTimings.length, 0);
  console.log(`[whisper-alignment] ${matched}/${sentenceTimings.length} matched, ${words} words total`);

  // Diagnostics: page 3→4
  for (const s of aligned.filter(s => s.pageNumber === 3).slice(-4)) {
    console.log(`[whisper-alignment] P3 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] w=${s.wordTimings.length} "${s.text.substring(0, 40)}"`);
  }
  for (const s of aligned.filter(s => s.pageNumber === 4).slice(0, 2)) {
    console.log(`[whisper-alignment] P4 ${s.language}: [${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}] w=${s.wordTimings.length} "${s.text.substring(0, 40)}"`);
  }

  let mono = true;
  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].startTime < aligned[i - 1].startTime) {
      mono = false;
      console.warn(`[whisper-alignment] Non-monotonic at ${i}: ${aligned[i].startTime.toFixed(3)} < ${aligned[i - 1].startTime.toFixed(3)}`);
      break;
    }
  }
  console.log(`[whisper-alignment] Monotonic: ${mono ? "✓" : "✗"}`);

  return aligned;
}

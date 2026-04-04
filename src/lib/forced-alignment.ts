// src/lib/forced-alignment.ts
// Forced alignment using Azure Pronunciation Assessment.
// Given audio (WAV) + known reference text, returns per-word timestamps
// aligned to the EXACT words in our text. No transcription mismatch.

import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type { SentenceTiming, ChapterAudioMode } from "@/types/chapter-audio";
import type { WordTiming } from "@/types/azure-tts";

interface AlignedWord {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

/**
 * Run pronunciation assessment on a WAV buffer with reference text.
 * Returns per-word timestamps aligned to the reference text.
 */
async function alignChunk(
  wavBuffer: Buffer,
  referenceText: string,
  language: string, // "en-US" or "es-ES"
  audioDurationSec?: number
): Promise<AlignedWord[]> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!
  );
  speechConfig.speechRecognitionLanguage = language;

  // Create audio config from WAV buffer
  const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);

  // Configure pronunciation assessment with reference text
  const pronConfig = new sdk.PronunciationAssessmentConfig(
    referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Word,
    false // enableMiscue — must be false for continuous mode
  );

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  pronConfig.applyTo(recognizer);

  const words: AlignedWord[] = [];

  return new Promise((resolve, reject) => {
    // Timeout: audio duration + 60s buffer (PA processes in ~real-time)
    const timeoutMs = ((audioDurationSec || 300) + 60) * 1000;
    const timeout = setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync();
      console.warn(`[forced-alignment] Timeout after ${Math.round(timeoutMs / 1000)}s (got ${words.length} words so far)`);
      resolve(words);
    }, timeoutMs);

    recognizer.recognized = (_sender, event) => {
      if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
        try {
          const json = JSON.parse(
            event.result.properties.getProperty(
              sdk.PropertyId.SpeechServiceResponse_JsonResult
            )
          );
          const nBest = json.NBest?.[0];
          if (nBest?.Words) {
            for (const w of nBest.Words) {
              words.push({
                word: w.Word,
                startTime: w.Offset / 10_000_000, // 100ns ticks → seconds
                endTime: (w.Offset + w.Duration) / 10_000_000,
              });
            }
          }
        } catch { /* ignore parse errors */ }
      }
    };

    recognizer.canceled = (_sender, event) => {
      clearTimeout(timeout);
      if (event.reason === sdk.CancellationReason.Error) {
        console.error("[forced-alignment] Error:", event.errorDetails);
      }
      recognizer.stopContinuousRecognitionAsync(
        () => resolve(words),
        (err) => reject(err)
      );
    };

    recognizer.sessionStopped = () => {
      clearTimeout(timeout);
      recognizer.stopContinuousRecognitionAsync(
        () => resolve(words),
        () => resolve(words)
      );
    };

    recognizer.startContinuousRecognitionAsync(
      () => {},
      (err) => { clearTimeout(timeout); reject(err); }
    );
  });
}

/**
 * Align a chunk's sentences using Azure Pronunciation Assessment.
 *
 * For bilingual chunks: runs two passes (EN + ES) in parallel, each with
 * its own reference text. For monolingual: single pass.
 *
 * Returns updated sentence timings with word-level timestamps from PA.
 */
export async function alignChunkSentences(
  wavBuffer: Buffer,
  chunkSentences: { text: string; language: "en" | "es"; pageNumber: number; lineIndex: number }[],
  timeOffset: number, // seconds to add for chapter-level positioning
  isBilingual: boolean,
  bookmarkTimings?: { startTime: number; endTime: number }[] // original bookmark times for time-window filtering
): Promise<{ startTime: number; endTime: number; wordTimings: WordTiming[] }[]> {

  // Split sentences by language (preserving bookmark time ranges for filtering)
  const enSentences: { idx: number; text: string; bookmarkStart?: number; bookmarkEnd?: number }[] = [];
  const esSentences: { idx: number; text: string; bookmarkStart?: number; bookmarkEnd?: number }[] = [];

  for (let i = 0; i < chunkSentences.length; i++) {
    const s = chunkSentences[i];
    const bm = bookmarkTimings?.[i];
    const entry = {
      idx: i,
      text: s.text,
      bookmarkStart: bm ? bm.startTime - timeOffset : undefined, // chunk-relative
      bookmarkEnd: bm ? bm.endTime - timeOffset : undefined,
    };
    if (s.language === "en") enSentences.push(entry);
    else esSentences.push(entry);
  }

  // Build reference texts (one per language)
  const enRefText = enSentences.map(s => s.text).join(" ");
  const esRefText = esSentences.map(s => s.text).join(" ");

  // Estimate audio duration from WAV buffer (48kHz 16-bit mono = 96000 bytes/sec + 44 byte header)
  const audioDurationSec = Math.max(0, wavBuffer.byteLength - 44) / 96000;

  // Run alignment passes
  const passes: Promise<{ lang: "en" | "es"; words: AlignedWord[] }>[] = [];

  if (enRefText.trim()) {
    passes.push(
      alignChunk(wavBuffer, enRefText, "en-US", audioDurationSec)
        .then(words => ({ lang: "en" as const, words }))
    );
  }
  if (esRefText.trim()) {
    passes.push(
      alignChunk(wavBuffer, esRefText, "es-MX", audioDurationSec)
        .then(words => ({ lang: "es" as const, words }))
    );
  }

  const results = await Promise.all(passes);

  // Collect aligned words per language
  const enWords = results.find(r => r.lang === "en")?.words ?? [];
  const esWords = results.find(r => r.lang === "es")?.words ?? [];

  console.log(`[forced-alignment] Chunk alignment: EN=${enWords.length} words, ES=${esWords.length} words`);

  // Assign words to sentences sequentially (per language)
  const sentenceResults: { startTime: number; endTime: number; wordTimings: WordTiming[] }[] =
    chunkSentences.map(() => ({ startTime: 0, endTime: 0, wordTimings: [] }));

  assignWordsToSentences(enWords, enSentences, sentenceResults, timeOffset);
  assignWordsToSentences(esWords, esSentences, sentenceResults, timeOffset);

  return sentenceResults;
}

/**
 * Assign aligned words sequentially to sentences of the same language.
 * Words and sentences are both in audio order.
 */
function assignWordsToSentences(
  words: AlignedWord[],
  sentences: { idx: number; text: string; bookmarkStart?: number; bookmarkEnd?: number }[],
  results: { startTime: number; endTime: number; wordTimings: WordTiming[] }[],
  timeOffset: number
): void {
  // For bilingual: PA may place words from the wrong language's audio
  // region. Use bookmark time windows to filter — only keep PA words
  // that fall within the sentence's expected time range.

  for (const { idx, text, bookmarkStart, bookmarkEnd } of sentences) {
    const expectedWords = text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    if (expectedWords === 0) continue;

    // Find PA words within this sentence's bookmark time window
    // Use generous margin (50% of sentence duration on each side)
    let matchedWords: AlignedWord[];

    if (bookmarkStart !== undefined && bookmarkEnd !== undefined) {
      const duration = bookmarkEnd - bookmarkStart;
      const margin = Math.max(duration * 0.5, 1.0); // at least 1s margin
      const windowStart = bookmarkStart - margin;
      const windowEnd = bookmarkEnd + margin;

      matchedWords = words.filter(w =>
        w.startTime >= windowStart && w.startTime < windowEnd
      );
    } else {
      // No bookmark data — use all words (monolingual mode)
      matchedWords = words;
    }

    if (matchedWords.length === 0) continue;

    // From the filtered words, take the ones that best match sequentially.
    // Sort by time (should already be sorted) and take up to expectedWords + margin
    matchedWords.sort((a, b) => a.startTime - b.startTime);
    const maxToTake = expectedWords + 3;
    const taken = matchedWords.slice(0, maxToTake);

    if (taken.length > 0) {
      results[idx] = {
        startTime: taken[0].startTime + timeOffset,
        endTime: taken[taken.length - 1].endTime + timeOffset,
        wordTimings: taken.map(w => ({
          word: w.word,
          startTime: w.startTime + timeOffset,
          endTime: w.endTime + timeOffset,
          confidence: 1.0,
        })),
      };
    }
  }
}

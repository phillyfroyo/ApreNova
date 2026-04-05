// src/lib/forced-alignment.ts
// Forced alignment using Azure Pronunciation Assessment.
// Per-sentence WAV slicing: each sentence gets its own audio clip and
// single-language PA call — eliminates cross-language interference in
// bilingual mode and produces clean, accurate word timestamps.

import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type { WordTiming } from "@/types/azure-tts";

// WAV format constants (Riff48Khz16BitMonoPcm)
const WAV_HEADER_SIZE = 44;
const SAMPLE_RATE = 48000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const CHANNELS = 1;
const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS;

interface AlignedWord {
  word: string;
  startTime: number; // seconds (clip-relative)
  endTime: number;   // seconds (clip-relative)
  accuracy: number;  // 0-100 pronunciation accuracy score from PA
}

// ============================================================================
// WAV slicing
// ============================================================================

/**
 * Extract a time range from a WAV buffer, producing a valid WAV buffer.
 * Times are in seconds, relative to the start of the input WAV.
 */
function sliceWav(wav: Buffer, startSec: number, endSec: number): Buffer {
  const dataSize = wav.byteLength - WAV_HEADER_SIZE;
  const totalDurationSec = dataSize / BYTES_PER_SECOND;

  // Clamp to valid range
  const clampedStart = Math.max(0, Math.min(startSec, totalDurationSec));
  const clampedEnd = Math.max(clampedStart, Math.min(endSec, totalDurationSec));

  // Convert to byte offsets (aligned to sample boundary)
  const startByte = Math.round(clampedStart * BYTES_PER_SECOND / BYTES_PER_SAMPLE) * BYTES_PER_SAMPLE;
  const endByte = Math.round(clampedEnd * BYTES_PER_SECOND / BYTES_PER_SAMPLE) * BYTES_PER_SAMPLE;
  const sliceDataSize = endByte - startByte;

  // Build new WAV: copy header + update sizes + copy audio data
  const result = Buffer.alloc(WAV_HEADER_SIZE + sliceDataSize);

  // Copy original header
  wav.copy(result, 0, 0, WAV_HEADER_SIZE);

  // Update RIFF chunk size (file size - 8)
  result.writeUInt32LE(WAV_HEADER_SIZE + sliceDataSize - 8, 4);

  // Update data chunk size (at offset 40 in standard WAV)
  result.writeUInt32LE(sliceDataSize, 40);

  // Copy audio data
  wav.copy(result, WAV_HEADER_SIZE, WAV_HEADER_SIZE + startByte, WAV_HEADER_SIZE + endByte);

  return result;
}

// ============================================================================
// Single-sentence PA alignment
// ============================================================================

/**
 * Run pronunciation assessment on a single sentence's WAV clip.
 * Returns per-word timestamps relative to the clip start.
 */
async function alignSentenceClip(
  clipBuffer: Buffer,
  referenceText: string,
  language: string, // "en-US" or "es-MX"
  clipDurationSec: number
): Promise<AlignedWord[]> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!
  );
  speechConfig.speechRecognitionLanguage = language;

  const audioConfig = sdk.AudioConfig.fromWavFileInput(clipBuffer);

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
    const timeoutMs = (clipDurationSec + 30) * 1000;
    const timeout = setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync();
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
              const accuracy = w.PronunciationAssessment?.AccuracyScore ?? 0;
              words.push({
                word: w.Word,
                startTime: w.Offset / 10_000_000,
                endTime: (w.Offset + w.Duration) / 10_000_000,
                accuracy,
              });
            }
          }
        } catch { /* ignore parse errors */ }
      }
    };

    recognizer.canceled = (_sender, event) => {
      clearTimeout(timeout);
      if (event.reason === sdk.CancellationReason.Error) {
        console.error("[forced-alignment] Sentence clip error:", event.errorDetails);
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

// ============================================================================
// Per-sentence alignment (public API)
// ============================================================================

// Max concurrent PA calls — Azure has rate limits
const PA_CONCURRENCY = 4;

/**
 * Run a batch of async tasks with bounded concurrency.
 */
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Align a chunk's sentences using per-sentence WAV clips + Azure PA.
 *
 * For each sentence: slices the WAV using bookmark boundaries, runs PA
 * with the sentence's language, then offsets timestamps back to
 * chapter-level positioning. No cross-language interference.
 */
export async function alignChunkSentences(
  wavBuffer: Buffer,
  chunkSentences: { text: string; language: "en" | "es"; pageNumber: number; lineIndex: number }[],
  timeOffset: number,
  _isBilingual: boolean,
  bookmarkTimings?: { startTime: number; endTime: number }[]
): Promise<{ startTime: number; endTime: number; wordTimings: WordTiming[] }[]> {

  const LANG_MAP: Record<string, string> = { en: "en-US", es: "es-MX" };

  const results: { startTime: number; endTime: number; wordTimings: WordTiming[] }[] =
    chunkSentences.map(() => ({ startTime: 0, endTime: 0, wordTimings: [] }));

  if (!bookmarkTimings || bookmarkTimings.length !== chunkSentences.length) {
    console.warn("[forced-alignment] No bookmark timings — cannot slice WAV, skipping alignment");
    return results;
  }

  let alignedCount = 0;
  let totalAccuracy = 0;
  let totalWords = 0;

  const tasks = chunkSentences.map((sentence, i) => () => {
    const bm = bookmarkTimings[i];
    // Chunk-relative times (bookmark timings include timeOffset, remove it for slicing)
    const clipStart = bm.startTime - timeOffset;
    const clipEnd = bm.endTime - timeOffset;
    const clipDuration = clipEnd - clipStart;

    if (clipDuration <= 0) return Promise.resolve();

    // Add small padding around the clip (100ms each side) to avoid cutting off
    // the start/end of speech — PA needs a tiny bit of silence context
    const padStart = Math.max(0, clipStart - 0.1);
    const padEnd = clipEnd + 0.1;
    const padOffset = clipStart - padStart; // how much earlier we started

    const clip = sliceWav(wavBuffer, padStart, padEnd);
    const lang = LANG_MAP[sentence.language] || "en-US";

    return alignSentenceClip(clip, sentence.text, lang, padEnd - padStart)
      .then(words => {
        if (words.length === 0) return;

        // Offset word times: clip-relative → chunk-relative → chapter-relative
        // padOffset accounts for the 100ms padding we added before the clip start
        const chapterWords: WordTiming[] = words.map(w => ({
          word: w.word,
          startTime: w.startTime - padOffset + clipStart + timeOffset,
          endTime: w.endTime - padOffset + clipStart + timeOffset,
          confidence: w.accuracy / 100,
        }));

        // Accumulate accuracy stats
        for (const w of words) {
          totalAccuracy += w.accuracy;
          totalWords++;
        }

        results[i] = {
          startTime: chapterWords[0].startTime,
          endTime: chapterWords[chapterWords.length - 1].endTime,
          wordTimings: chapterWords,
        };
        alignedCount++;
      })
      .catch(err => {
        console.warn(`[forced-alignment] Sentence ${i} failed:`, err.message);
      });
  });

  await parallelLimit(tasks, PA_CONCURRENCY);

  const avgAcc = totalWords > 0 ? (totalAccuracy / totalWords).toFixed(1) : "n/a";
  console.log(
    `[forced-alignment] Per-sentence alignment: ${alignedCount}/${chunkSentences.length} sentences, ` +
    `${totalWords} words, avg accuracy ${avgAcc}`
  );

  return results;
}

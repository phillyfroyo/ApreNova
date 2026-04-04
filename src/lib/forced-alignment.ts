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
  isBilingual: boolean
): Promise<{ startTime: number; endTime: number; wordTimings: WordTiming[] }[]> {

  // Split sentences by language
  const enSentences: { idx: number; text: string }[] = [];
  const esSentences: { idx: number; text: string }[] = [];

  for (let i = 0; i < chunkSentences.length; i++) {
    const s = chunkSentences[i];
    if (s.language === "en") enSentences.push({ idx: i, text: s.text });
    else esSentences.push({ idx: i, text: s.text });
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
  sentences: { idx: number; text: string }[],
  results: { startTime: number; endTime: number; wordTimings: WordTiming[] }[],
  timeOffset: number
): void {
  let wCursor = 0;

  for (const { idx, text } of sentences) {
    const expectedWords = text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(w => w.length > 0).length;

    if (wCursor >= words.length || expectedWords === 0) continue;

    const startIdx = wCursor;
    let consumed = 0;

    // Consume words for this sentence. Azure PA returns words aligned to
    // our reference text, so the word count should match closely.
    // Allow some flexibility for punctuation differences.
    const maxWords = expectedWords + 3;

    while (consumed < maxWords && wCursor < words.length) {
      // Check for silence gap indicating sentence boundary
      if (consumed >= Math.max(1, expectedWords - 1) && wCursor > startIdx) {
        const gap = words[wCursor].startTime - words[wCursor - 1].endTime;
        if (gap >= 0.1) break; // sentence boundary
      }

      wCursor++;
      consumed++;

      // If we've hit the expected count exactly, check for gap
      if (consumed === expectedWords && wCursor < words.length) {
        const gap = words[wCursor].startTime - words[wCursor - 1].endTime;
        if (gap >= 0.05) break; // even small gap after exact count = boundary
      }
    }

    const assigned = words.slice(startIdx, wCursor);
    if (assigned.length > 0) {
      results[idx] = {
        startTime: assigned[0].startTime + timeOffset,
        endTime: assigned[assigned.length - 1].endTime + timeOffset,
        wordTimings: assigned.map(w => ({
          word: w.word,
          startTime: w.startTime + timeOffset,
          endTime: w.endTime + timeOffset,
          confidence: 1.0,
        })),
      };
    }
  }
}

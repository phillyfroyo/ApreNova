// src/lib/azure-speech.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { createHash } from 'crypto';
import type { 
  TTSRequest, 
  TTSResponse, 
  WordTiming, 
  TTSLanguage, 
  TTSSpeed,
  VoiceConfig,
  SSMLOptions,
  AudioGenerationOptions,
  TTSError 
} from '@/types/azure-tts';

// Voice configuration: Brian for English, Ava for Spanish
export const VOICE_CONFIG: VoiceConfig = {
  'es-ES': {
    normal: 'en-US-AvaMultilingualNeural',
    slow: 'en-US-AvaMultilingualNeural'
  },
  'en-US': {
    normal: 'en-US-BrianMultilingualNeural',
    slow: 'en-US-BrianMultilingualNeural'
  }
};

// Rate multipliers for different speeds
export const SPEED_RATES: Record<string, number> = {
  normal: 1.0,
  slow: 0.7
};

// Audio format configuration
const AUDIO_CONFIG: AudioGenerationOptions = {
  format: 'mp3',
  sampleRate: 22050,
  bitRate: 128,
  channels: 1
};

export class AzureSpeechService {
  private speechConfig: sdk.SpeechConfig;
  private synthesizer: sdk.SpeechSynthesizer | null = null;

  constructor() {
    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const serviceRegion = process.env.AZURE_SPEECH_REGION;

    if (!subscriptionKey || !serviceRegion) {
      throw new Error('Azure Speech credentials not configured');
    }

    this.speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    
    // Configure audio format for high quality
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;
  }

  /**
   * Generate SSML markup for precise speech control.
   * For scripts: reads speaker name, pauses, then optionally stage direction (softer), then dialogue.
   */
  private generateSSML(options: SSMLOptions & { speakerName?: string; stageDirection?: string; language?: TTSLanguage }): string {
    const { text, voice, rate, pitch = '+0Hz', volume = 'medium', speakerName, stageDirection, language } = options;

    let content = '';

    // Speaker name with emphasis and pause (for scripts)
    if (speakerName) {
      content += `<emphasis level="moderate">${this.escapeXML(speakerName)}</emphasis><break time="300ms"/>`;
    }

    // Stage direction in softer voice (for scripts)
    if (stageDirection) {
      content += `<prosody volume="soft" rate="medium">${this.escapeXML(stageDirection)}</prosody><break time="200ms"/>`;
    }

    // Main text/dialogue with prosody settings
    const textContent = this.escapeXML(text);

    content += `<prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${textContent}</prosody>`;

    // Determine the SSML lang from the content language, falling back to the voice locale.
    // Map es-ES → es-MX to match our Mexican Spanish voices and accent.
    const LOCALE_MAP: Record<string, string> = { 'es-ES': 'es-MX' };
    const rawLang = language || voice.substring(0, 5);
    const ssmlLang = LOCALE_MAP[rawLang] || rawLang;

    // For multilingual voices reading text in a non-primary language,
    // wrap content in <lang> to force correct pronunciation.
    // e.g. en-US-AvaMultilingualNeural reading Spanish needs <lang xml:lang="es-ES">
    const voiceLang = voice.substring(0, 2); // 'en' or 'es'
    const contentLang = ssmlLang.substring(0, 2); // 'en' or 'es'
    const needsLangTag = voiceLang !== contentLang;

    const wrappedContent = needsLangTag
      ? `<lang xml:lang="${ssmlLang}">${content}</lang>`
      : content;

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${ssmlLang}">
        <voice name="${voice}">
          ${wrappedContent}
        </voice>
      </speak>
    `.trim();
  }

  /**
   * Escape XML characters in text
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Resolve the actual voice name for a request (used by cache key generation)
   */
  public static resolveVoice(request: TTSRequest): string {
    return request.voice || VOICE_CONFIG[request.language][request.speed];
  }

  /**
   * Resolve the actual rate for a request
   */
  public static resolveRate(request: TTSRequest): number {
    return request.rate ?? SPEED_RATES[request.speed];
  }

  /**
   * Parse word timing data from Azure Speech SDK events
   */
  private parseWordTimings(wordBoundaryEvents: any[]): WordTiming[] {
    return wordBoundaryEvents.map(event => ({
      word: event.text,
      startTime: event.audioOffset / 10000000, // Convert from 100ns ticks to seconds
      endTime: (event.audioOffset + event.duration) / 10000000,
      confidence: 1.0 // Azure doesn't provide confidence for synthesis, set to 1.0
    }));
  }

  /**
   * Generate speech audio with word-level timing data.
   * Supports script speaker names and stage directions via SSML.
   */
  public async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      const voice = request.voice || VOICE_CONFIG[request.language][request.speed];
      const rate = request.rate ?? SPEED_RATES[request.speed];

      // Generate SSML with optional speaker name, stage direction, and word breaks
      const ssml = this.generateSSML({
        text: request.text,
        voice,
        rate,
        speakerName: request.speakerName,
        stageDirection: request.stageDirection,
        language: request.language,
      });

      // Create synthesizer with audio config
      const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
      this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

      // Track word boundary events for timing data
      const wordTimings: WordTiming[] = [];
      
      return new Promise((resolve, reject) => {
        // Set up word boundary event handler
        this.synthesizer!.wordBoundary = (sender, event) => {
          // Filter out empty words, punctuation-only, and whitespace
          const word = event.text?.trim();
          if (word && word.length > 0 && /\w/.test(word)) {
            wordTimings.push({
              word: word,
              startTime: event.audioOffset / 10000000, // Convert to seconds
              endTime: (event.audioOffset + event.duration) / 10000000,
              confidence: 1.0
            });
          }
        };

        // Perform synthesis
        this.synthesizer!.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioData = result.audioData;
              
              // Calculate accurate duration from word timings (last word end time)
              const duration = wordTimings.length > 0 
                ? Math.max(...wordTimings.map(w => w.endTime))
                : this.calculateAudioDuration(audioData); // Fallback to file size estimation
              
              resolve({
                audioUrl: '', // Will be set by caching layer
                wordTimings,
                duration,
                cached: false
              });
            } else {
              reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
            }
            
            this.synthesizer?.close();
            this.synthesizer = null;
          },
          (error) => {
            reject(new Error(`Speech synthesis error: ${error}`));
            this.synthesizer?.close();
            this.synthesizer = null;
          }
        );
      });

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate speech and return audio buffer.
   * Supports script speaker names and stage directions via SSML.
   */
  public async generateSpeechBuffer(request: TTSRequest): Promise<{ buffer: ArrayBuffer; wordTimings: WordTiming[]; duration: number }> {
    try {
      const voice = request.voice || VOICE_CONFIG[request.language][request.speed];
      const rate = request.rate ?? SPEED_RATES[request.speed];

      // Generate SSML with optional speaker name, stage direction, and word breaks
      const ssml = this.generateSSML({
        text: request.text,
        voice,
        rate,
        speakerName: request.speakerName,
        stageDirection: request.stageDirection,
        language: request.language,
      });

      // Create synthesizer without audio output (for buffer generation)
      const audioConfig = null; // No audio output, we want the buffer
      this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

      // Track word boundary events for timing data
      const wordTimings: WordTiming[] = [];
      
      return new Promise((resolve, reject) => {
        // Set up word boundary event handler
        this.synthesizer!.wordBoundary = (sender, event) => {
          // Filter out empty words, punctuation-only, and whitespace
          const word = event.text?.trim();
          if (word && word.length > 0 && /\w/.test(word)) {
            wordTimings.push({
              word: word,
              startTime: event.audioOffset / 10000000, // Convert to seconds
              endTime: (event.audioOffset + event.duration) / 10000000,
              confidence: 1.0
            });
          }
        };

        // Perform synthesis
        this.synthesizer!.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioData = result.audioData;
              
              // Calculate accurate duration from word timings (last word end time)
              const duration = wordTimings.length > 0 
                ? Math.max(...wordTimings.map(w => w.endTime))
                : this.calculateAudioDuration(audioData); // Fallback to file size estimation
              
              resolve({
                buffer: audioData,
                wordTimings,
                duration
              });
            } else {
              reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
            }
            
            this.synthesizer?.close();
            this.synthesizer = null;
          },
          (error) => {
            reject(new Error(`Speech synthesis error: ${error}`));
            this.synthesizer?.close();
            this.synthesizer = null;
          }
        );
      });

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Calculate audio duration from buffer (rough estimation)
   */
  private calculateAudioDuration(audioData: ArrayBuffer): number {
    // For MP3 at 128kbps, rough calculation
    // This is an approximation - actual duration parsing would require MP3 frame analysis
    const sizeInBytes = audioData.byteLength;
    const bitrate = 128000; // 128 kbps
    const estimatedDuration = (sizeInBytes * 8) / bitrate;
    return estimatedDuration;
  }

  /**
   * Validate TTS request
   */
  public validateRequest(request: TTSRequest): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text is required');
    }

    if (request.text.length > 3000) {
      throw new Error('Text exceeds maximum length of 3000 characters');
    }

    if (!['es-ES', 'en-US'].includes(request.language)) {
      throw new Error('Unsupported language');
    }

    if (!['normal', 'slow'].includes(request.speed)) {
      throw new Error('Unsupported speed');
    }
  }

  /**
   * Get available voices for a language
   */
  public getAvailableVoices(language: TTSLanguage): string[] {
    return Object.values(VOICE_CONFIG[language]);
  }

  /**
   * Test Azure Speech Service connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: TTSRequest = {
        text: 'Test',
        language: 'en-US',
        speed: 'normal'
      };

      await this.generateSpeechBuffer(testRequest);
      return true;
    } catch (error) {
      console.error('Azure Speech Service connection test failed:', error);
      return false;
    }
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any): TTSError {
    if (error instanceof Error) {
      return {
        code: 'AZURE_SPEECH_ERROR',
        message: error.message,
        details: error
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      details: error
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
  }
}

// Singleton instance
let azureSpeechInstance: AzureSpeechService | null = null;

export function getAzureSpeechService(): AzureSpeechService {
  if (!azureSpeechInstance) {
    azureSpeechInstance = new AzureSpeechService();
  }
  return azureSpeechInstance;
}
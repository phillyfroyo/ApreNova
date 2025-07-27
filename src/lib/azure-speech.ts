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

// Voice configuration for different languages and speeds
const VOICE_CONFIG: VoiceConfig = {
  'es-ES': {
    normal: 'es-MX-DaliaNeural',
    slow: 'es-MX-DaliaNeural'
  },
  'en-US': {
    normal: 'en-US-AriaNeural', 
    slow: 'en-US-AriaNeural'
  }
};

// Rate multipliers for different speeds
const SPEED_RATES = {
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
   * Generate SSML markup for precise speech control
   */
  private generateSSML(options: SSMLOptions): string {
    const { text, voice, rate, pitch = '+0Hz', volume = 'medium' } = options;
    
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.substring(0, 5)}">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
            ${this.escapeXML(text)}
          </prosody>
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
   * Generate unique hash for cache key
   */
  public generateCacheKey(request: TTSRequest): string {
    const content = `${request.text}-${request.language}-${request.speed}`;
    return createHash('sha256').update(content).digest('hex');
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
   * Generate speech audio with word-level timing data
   */
  public async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      const voice = VOICE_CONFIG[request.language][request.speed];
      const rate = SPEED_RATES[request.speed];

      // Generate SSML
      const ssml = this.generateSSML({
        text: request.text,
        voice,
        rate
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
   * Generate speech and return audio buffer
   */
  public async generateSpeechBuffer(request: TTSRequest): Promise<{ buffer: ArrayBuffer; wordTimings: WordTiming[]; duration: number }> {
    try {
      const voice = VOICE_CONFIG[request.language][request.speed];
      const rate = SPEED_RATES[request.speed];

      // Generate SSML
      const ssml = this.generateSSML({
        text: request.text,
        voice,
        rate
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
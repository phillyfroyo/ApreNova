// src/hooks/useAzureTTS.ts
"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import type { TTSRequest, TTSResponse, WordTiming } from '@/types/azure-tts';

interface UseTTSOptions {
  autoCache?: boolean;
  onWordUpdate?: (currentWord: string, index: number) => void;
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
}

interface TTSPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentWordIndex: number;
  isLoading: boolean;
  error: string | null;
}

export function useAzureTTS(options: UseTTSOptions = {}) {
  const [playbackState, setPlaybackState] = useState<TTSPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentWordIndex: -1,
    isLoading: false,
    error: null
  });

  const [cache, setCache] = useState<Map<string, TTSResponse>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordTimingsRef = useRef<WordTiming[]>([]);
  const currentRequestRef = useRef<string | null>(null);

  /**
   * Generate cache key for TTS request
   */
  const generateCacheKey = useCallback((request: TTSRequest): string => {
    return `${request.text}-${request.language}-${request.speed}`;
  }, []);

  /**
   * Generate TTS audio
   */
  const generateTTS = useCallback(async (request: TTSRequest): Promise<TTSResponse> => {
    const cacheKey = generateCacheKey(request);
    
    // Check local cache first
    if (options.autoCache && cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    setPlaybackState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/azure-tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TTSResponse = await response.json();

      // Cache the result locally
      if (options.autoCache) {
        setCache(prev => new Map(prev).set(cacheKey, result));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPlaybackState(prev => ({ ...prev, error: errorMessage }));
      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    } finally {
      setPlaybackState(prev => ({ ...prev, isLoading: false }));
    }
  }, [cache, generateCacheKey, options]);

  /**
   * Play TTS audio with word highlighting
   */
  const playTTS = useCallback(async (request: TTSRequest): Promise<void> => {
    try {
      currentRequestRef.current = generateCacheKey(request);
      
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Generate or retrieve TTS
      const ttsResponse = await generateTTS(request);
      
      // Check if this request is still current (user might have triggered another)
      if (currentRequestRef.current !== generateCacheKey(request)) {
        return;
      }

      // Create and configure audio element
      const audio = new Audio(ttsResponse.audioUrl);
      audioRef.current = audio;
      wordTimingsRef.current = ttsResponse.wordTimings;

      // Set up audio event listeners
      audio.addEventListener('loadedmetadata', () => {
        setPlaybackState(prev => ({
          ...prev,
          duration: audio.duration,
          currentTime: 0,
          currentWordIndex: -1,
          error: null
        }));
      });

      audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        setPlaybackState(prev => ({ ...prev, currentTime }));

        // Find current word based on timing
        const currentWordIndex = wordTimingsRef.current.findIndex(
          (timing, index) => {
            const nextTiming = wordTimingsRef.current[index + 1];
            return currentTime >= timing.startTime && 
                   (!nextTiming || currentTime < nextTiming.startTime);
          }
        );

        if (currentWordIndex !== -1 && currentWordIndex !== playbackState.currentWordIndex) {
          const currentWord = wordTimingsRef.current[currentWordIndex];
          setPlaybackState(prev => ({ ...prev, currentWordIndex }));
          options.onWordUpdate?.(currentWord.word, currentWordIndex);
        }
      });

      audio.addEventListener('ended', () => {
        setPlaybackState(prev => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          currentWordIndex: -1
        }));
        options.onPlaybackComplete?.();
      });

      audio.addEventListener('error', (e) => {
        const error = new Error('Audio playback failed');
        setPlaybackState(prev => ({ ...prev, error: error.message, isPlaying: false }));
        options.onError?.(error);
      });

      // Start playback
      await audio.play();
      setPlaybackState(prev => ({ ...prev, isPlaying: true }));

    } catch (error) {
      console.error('TTS playback error:', error);
    }
  }, [generateTTS, generateCacheKey, options, playbackState.currentWordIndex]);

  /**
   * Pause current playback
   */
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  /**
   * Resume current playback
   */
  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    }
  }, []);

  /**
   * Stop current playback
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    wordTimingsRef.current = [];
    currentRequestRef.current = null;
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      currentWordIndex: -1
    }));
  }, []);

  /**
   * Seek to specific time
   */
  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration));
    }
  }, []);

  /**
   * Toggle play/pause
   */
  const togglePlayback = useCallback(() => {
    if (playbackState.isPlaying) {
      pause();
    } else if (audioRef.current) {
      resume();
    }
  }, [playbackState.isPlaying, pause, resume]);

  /**
   * Pre-cache TTS for multiple requests
   */
  const preCache = useCallback(async (requests: TTSRequest[]): Promise<void> => {
    const promises = requests.map(async (request) => {
      try {
        await generateTTS(request);
      } catch (error) {
        console.warn('Failed to pre-cache TTS:', error);
      }
    });

    await Promise.all(promises);
  }, [generateTTS]);

  /**
   * Clear local cache
   */
  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  /**
   * Get word timing for current audio
   */
  const getWordTimings = useCallback((): WordTiming[] => {
    return wordTimingsRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    // State
    playbackState,
    
    // Actions
    playTTS,
    pause,
    resume,
    stop,
    seekTo,
    togglePlayback,
    
    // Utilities
    generateTTS,
    preCache,
    clearCache,
    getWordTimings,
    
    // Cache info
    cacheSize: cache.size,
    
    // Helper to create requests
    createRequest: useCallback((
      text: string, 
      language: 'es-ES' | 'en-US', 
      speed: 'normal' | 'slow',
      storySlug?: string,
      chapterPage?: string
    ): TTSRequest => ({
      text,
      language,
      speed,
      storySlug,
      chapterPage
    }), [])
  };
}
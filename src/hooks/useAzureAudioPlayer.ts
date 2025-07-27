// src/hooks/useAzureAudioPlayer.ts
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAzureTTS } from './useAzureTTS';
import type { TTSRequest, WordTiming } from '@/types/azure-tts';

export interface WordHighlightData {
  word: string;
  isActive: boolean;
  startTime: number;
  endTime: number;
  index: number;
  confidence: number;
}

interface AudioPlayerState {
  sentenceIndex: number | null;
  isPlaying: boolean;
  isSlow: boolean;
  progress: number;
  duration: number;
  currentWordIndex: number;
  highlightedWords: WordHighlightData[];
  loadingStates: Record<number, boolean>;
  errorStates: Record<number, string | null>;
  isSupported: boolean;
}

interface UseAzureAudioPlayerOptions {
  onWordHighlight?: (word: WordHighlightData, sentenceIndex: number) => void;
  onSentenceComplete?: (sentenceIndex: number) => void;
  onError?: (error: Error, sentenceIndex: number) => void;
  autoPreload?: boolean;
  fallbackToStaticAudio?: boolean;
  staticAudioBasePath?: string;
}

export function useAzureAudioPlayer(options: UseAzureAudioPlayerOptions = {}) {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    sentenceIndex: null,
    isPlaying: false,
    isSlow: false,
    progress: 0,
    duration: 0,
    currentWordIndex: -1,
    highlightedWords: [],
    loadingStates: {},
    errorStates: {},
    isSupported: true
  });

  const currentSentenceRef = useRef<string>("");
  const staticAudioRef = useRef<HTMLAudioElement | null>(null);
  const isDraggingRef = useRef(false);

  // Azure TTS integration
  const {
    playbackState: ttsState,
    playTTS,
    pause: ttsPause,
    resume: ttsResume,
    stop: ttsStop,
    seekTo: ttsSeekTo,
    generateTTS,
    preCache,
    createRequest,
    getWordTimings
  } = useAzureTTS({
    autoCache: true,
    onWordUpdate: (word, index) => {
      const wordTimings = getWordTimings();
      const wordData = wordTimings[index];
      
      if (wordData && playerState.sentenceIndex !== null) {
        const highlightData: WordHighlightData = {
          word: wordData.word,
          isActive: true,
          startTime: wordData.startTime,
          endTime: wordData.endTime,
          index,
          confidence: wordData.confidence
        };
        
        setPlayerState(prev => ({
          ...prev,
          currentWordIndex: index,
          highlightedWords: prev.highlightedWords.map((w, i) => ({
            ...w,
            isActive: i === index
          }))
        }));
        
        options.onWordHighlight?.(highlightData, playerState.sentenceIndex);
      }
    },
    onPlaybackComplete: () => {
      if (playerState.sentenceIndex !== null) {
        setPlayerState(prev => ({
          ...prev,
          isPlaying: false,
          currentWordIndex: -1,
          highlightedWords: prev.highlightedWords.map(w => ({ ...w, isActive: false }))
        }));
        options.onSentenceComplete?.(playerState.sentenceIndex);
      }
    },
    onError: (error) => {
      if (playerState.sentenceIndex !== null) {
        options.onError?.(error, playerState.sentenceIndex);
        handleAzureError(error, playerState.sentenceIndex);
      }
    }
  });

  // Sync TTS state with player state
  useEffect(() => {
    setPlayerState(prev => ({
      ...prev,
      isPlaying: ttsState.isPlaying,
      progress: ttsState.currentTime,
      duration: ttsState.duration
    }));
  }, [ttsState.isPlaying, ttsState.currentTime, ttsState.duration]);

  /**
   * Handle Azure TTS errors with fallback to static audio
   */
  const handleAzureError = useCallback((error: Error, sentenceIndex: number) => {
    console.warn(`Azure TTS failed for sentence ${sentenceIndex}:`, error);
    
    setPlayerState(prev => ({
      ...prev,
      errorStates: { ...prev.errorStates, [sentenceIndex]: error.message }
    }));

    // Fallback to static audio if enabled
    if (options.fallbackToStaticAudio && options.staticAudioBasePath) {
      console.log(`Attempting fallback to static audio for sentence ${sentenceIndex}`);
      // This would be handled by the parent component calling playStaticAudio
    }
  }, [options.fallbackToStaticAudio, options.staticAudioBasePath]);

  /**
   * Create word highlighting data from sentence text and timings
   */
  const createWordHighlights = useCallback((sentence: string, wordTimings: WordTiming[]): WordHighlightData[] => {
    const words = sentence.split(/(\s+)/).filter(word => word.trim().length > 0);
    
    return words.map((word, index) => {
      const timing = wordTimings[index];
      return {
        word: word.trim(),
        isActive: false,
        startTime: timing?.startTime ?? 0,
        endTime: timing?.endTime ?? 0,
        index,
        confidence: timing?.confidence ?? 1
      };
    });
  }, []);

  /**
   * Play Azure TTS for a sentence
   */
  const playAzureAudio = useCallback(async (
    sentenceIndex: number,
    sentence: string,
    language: 'es-ES' | 'en-US',
    isSlow: boolean = false,
    storyContext?: { storySlug: string; currentLevel: string; chapterNumber: number; pageNumber: number }
  ) => {
    try {
      // Stop any currently playing audio
      if (playerState.isPlaying) {
        ttsStop();
        if (staticAudioRef.current) {
          staticAudioRef.current.pause();
          staticAudioRef.current = null;
        }
      }

      setPlayerState(prev => ({
        ...prev,
        sentenceIndex,
        isSlow,
        loadingStates: { ...prev.loadingStates, [sentenceIndex]: true },
        errorStates: { ...prev.errorStates, [sentenceIndex]: null }
      }));

      currentSentenceRef.current = sentence;

      // Create TTS request
      const request: TTSRequest = createRequest(
        sentence,
        language,
        isSlow ? 'slow' : 'normal',
        storyContext?.storySlug,
        storyContext ? `ch${storyContext.chapterNumber}/page-${storyContext.pageNumber}` : undefined
      );

      // Generate TTS and get word timings
      const ttsResponse = await generateTTS(request);
      
      // Create word highlights
      const highlights = createWordHighlights(sentence, ttsResponse.wordTimings);
      
      setPlayerState(prev => ({
        ...prev,
        highlightedWords: highlights,
        loadingStates: { ...prev.loadingStates, [sentenceIndex]: false }
      }));

      // Start playback
      await playTTS(request);

    } catch (error) {
      console.error('Azure TTS playback failed:', error);
      setPlayerState(prev => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, [sentenceIndex]: false }
      }));
      
      if (options.fallbackToStaticAudio) {
        // Let parent component handle static fallback
        throw error;
      }
    }
  }, [playerState.isPlaying, ttsStop, createRequest, generateTTS, createWordHighlights, playTTS, options.fallbackToStaticAudio]);

  /**
   * Play static MP3 audio (fallback)
   */
  const playStaticAudio = useCallback((
    sentenceIndex: number,
    audioPath: string,
    sentence: string,
    isSlow: boolean = false
  ) => {
    try {
      // Stop any current playback
      ttsStop();
      if (staticAudioRef.current) {
        staticAudioRef.current.pause();
      }

      const audio = new Audio(audioPath);
      staticAudioRef.current = audio;

      // Create basic word highlights without timing data
      const words = sentence.split(/(\s+)/).filter(word => word.trim().length > 0);
      const highlights: WordHighlightData[] = words.map((word, index) => ({
        word: word.trim(),
        isActive: false,
        startTime: 0,
        endTime: 0,
        index,
        confidence: 1
      }));

      setPlayerState(prev => ({
        ...prev,
        sentenceIndex,
        isSlow,
        highlightedWords: highlights,
        isSupported: false, // Mark as fallback mode
        loadingStates: { ...prev.loadingStates, [sentenceIndex]: false },
        errorStates: { ...prev.errorStates, [sentenceIndex]: null }
      }));

      audio.addEventListener('loadedmetadata', () => {
        setPlayerState(prev => ({
          ...prev,
          duration: audio.duration,
          progress: 0
        }));
      });

      audio.addEventListener('timeupdate', () => {
        if (!isDraggingRef.current) {
          setPlayerState(prev => ({
            ...prev,
            progress: audio.currentTime
          }));
        }
      });

      audio.addEventListener('ended', () => {
        setPlayerState(prev => ({
          ...prev,
          isPlaying: false,
          currentWordIndex: -1,
          highlightedWords: prev.highlightedWords.map(w => ({ ...w, isActive: false }))
        }));
        options.onSentenceComplete?.(sentenceIndex);
      });

      audio.addEventListener('error', () => {
        const error = new Error('Static audio playback failed');
        setPlayerState(prev => ({
          ...prev,
          errorStates: { ...prev.errorStates, [sentenceIndex]: error.message }
        }));
        options.onError?.(error, sentenceIndex);
      });

      audio.play();
      setPlayerState(prev => ({ ...prev, isPlaying: true }));

    } catch (error) {
      console.error('Static audio playback failed:', error);
      const err = error instanceof Error ? error : new Error('Static audio playback failed');
      options.onError?.(err, sentenceIndex);
    }
  }, [ttsStop, options.onSentenceComplete, options.onError]);

  /**
   * Toggle play/pause for current audio
   */
  const togglePlayback = useCallback(() => {
    if (playerState.isSupported) {
      // Azure TTS mode
      if (ttsState.isPlaying) {
        ttsPause();
      } else {
        ttsResume();
      }
    } else {
      // Static audio mode
      if (staticAudioRef.current) {
        if (playerState.isPlaying) {
          staticAudioRef.current.pause();
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
        } else {
          staticAudioRef.current.play();
          setPlayerState(prev => ({ ...prev, isPlaying: true }));
        }
      }
    }
  }, [playerState.isSupported, playerState.isPlaying, ttsState.isPlaying, ttsPause, ttsResume]);

  /**
   * Stop current playback
   */
  const stopPlayback = useCallback(() => {
    ttsStop();
    if (staticAudioRef.current) {
      staticAudioRef.current.pause();
      staticAudioRef.current = null;
    }
    setPlayerState(prev => ({
      ...prev,
      sentenceIndex: null,
      isPlaying: false,
      progress: 0,
      currentWordIndex: -1,
      highlightedWords: [],
      isSupported: true
    }));
  }, [ttsStop]);

  /**
   * Seek to specific time
   */
  const seekTo = useCallback((time: number) => {
    if (playerState.isSupported) {
      ttsSeekTo(time);
    } else if (staticAudioRef.current) {
      staticAudioRef.current.currentTime = Math.max(0, Math.min(time, staticAudioRef.current.duration));
    }
  }, [playerState.isSupported, ttsSeekTo]);

  /**
   * Seek to specific word
   */
  const seekToWord = useCallback((wordIndex: number) => {
    const word = playerState.highlightedWords[wordIndex];
    if (word && word.startTime > 0) {
      seekTo(word.startTime);
    }
  }, [playerState.highlightedWords, seekTo]);

  /**
   * Set dragging state (prevents progress updates during seek)
   */
  const setDragging = useCallback((isDragging: boolean) => {
    isDraggingRef.current = isDragging;
  }, []);

  /**
   * Pre-cache audio for better performance
   */
  const preCacheAudio = useCallback(async (
    sentences: string[],
    language: 'es-ES' | 'en-US',
    storyContext?: { storySlug: string; currentLevel: string; chapterNumber: number; pageNumber: number }
  ) => {
    const requests: TTSRequest[] = [];
    
    sentences.forEach(sentence => {
      // Add both normal and slow versions
      requests.push(
        createRequest(sentence, language, 'normal', storyContext?.storySlug, 
          storyContext ? `ch${storyContext.chapterNumber}/page-${storyContext.pageNumber}` : undefined),
        createRequest(sentence, language, 'slow', storyContext?.storySlug,
          storyContext ? `ch${storyContext.chapterNumber}/page-${storyContext.pageNumber}` : undefined)
      );
    });

    try {
      await preCache(requests);
      console.log(`Pre-cached ${requests.length} TTS requests`);
    } catch (error) {
      console.warn('Pre-caching failed:', error);
    }
  }, [createRequest, preCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (staticAudioRef.current) {
        staticAudioRef.current.pause();
        staticAudioRef.current = null;
      }
    };
  }, []);

  return {
    // State
    playerState,
    
    // Actions
    playAzureAudio,
    playStaticAudio,
    togglePlayback,
    stopPlayback,
    seekTo,
    seekToWord,
    setDragging,
    
    // Utilities
    preCacheAudio,
    
    // Current sentence info
    getCurrentSentence: () => currentSentenceRef.current,
    getWordTimings,
    
    // State checks
    isLoading: (sentenceIndex: number) => playerState.loadingStates[sentenceIndex] || false,
    hasError: (sentenceIndex: number) => !!playerState.errorStates[sentenceIndex],
    getError: (sentenceIndex: number) => playerState.errorStates[sentenceIndex],
    isCurrentSentence: (sentenceIndex: number) => playerState.sentenceIndex === sentenceIndex,
    
    // Word highlighting
    getWordHighlight: (wordIndex: number) => playerState.highlightedWords[wordIndex] || null,
    getCurrentWordIndex: () => playerState.currentWordIndex
  };
}
// src/hooks/useMigrationMetrics.ts
"use client";

import { useCallback, useRef, useEffect } from 'react';
import type { 
  PerformanceMetrics, 
  ErrorMetric, 
  UserMigrationProfile 
} from '@/types/migration';

interface MigrationMetricsOptions {
  storySlug: string;
  level: string;
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of events to track
  batchSize?: number; // Number of metrics to batch before sending
  flushInterval?: number; // ms, how often to flush batched metrics
}

interface PlaybackSession {
  sessionId: string;
  sentenceIndex: number;
  audioSystem: 'azure' | 'static';
  speed: 'normal' | 'slow';
  startTime: number;
  loadTime?: number;
  playbackStartTime?: number;
  wordHighlights: Array<{ word: string; timestamp: number }>;
  errors: ErrorMetric[];
  completed: boolean;
}

export function useMigrationMetrics(options: MigrationMetricsOptions) {
  const {
    storySlug,
    level,
    enabled,
    sampleRate,
    batchSize = 10,
    flushInterval = 30000, // 30 seconds
  } = options;

  const metricsQueueRef = useRef<PerformanceMetrics[]>([]);
  const sessionsRef = useRef<Map<string, PlaybackSession>>(new Map());
  const lastFlushRef = useRef<number>(Date.now());
  const shouldSampleRef = useRef<boolean>(Math.random() < sampleRate);

  /**
   * Generate a unique session ID
   */
  const generateSessionId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Check if we should track this event based on sampling rate
   */
  const shouldTrack = useCallback(() => {
    return enabled && shouldSampleRef.current;
  }, [enabled]);

  /**
   * Add metrics to queue and potentially flush
   */
  const queueMetrics = useCallback((metrics: PerformanceMetrics) => {
    if (!shouldTrack()) return;

    metricsQueueRef.current.push(metrics);

    // Flush if batch size reached or interval exceeded
    const now = Date.now();
    const shouldFlushBatch = metricsQueueRef.current.length >= batchSize;
    const shouldFlushTime = now - lastFlushRef.current >= flushInterval;

    if (shouldFlushBatch || shouldFlushTime) {
      flushMetrics();
    }
  }, [shouldTrack, batchSize, flushInterval]);

  /**
   * Send batched metrics to server
   */
  const flushMetrics = useCallback(async () => {
    if (metricsQueueRef.current.length === 0) return;

    const metricsToSend = [...metricsQueueRef.current];
    metricsQueueRef.current = [];
    lastFlushRef.current = Date.now();

    try {
      await fetch('/api/migration/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToSend,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.warn('Failed to send migration metrics:', error);
      // Re-queue metrics for retry (but limit queue size to prevent memory issues)
      if (metricsQueueRef.current.length < batchSize * 3) {
        metricsQueueRef.current.unshift(...metricsToSend);
      }
    }
  }, []);

  /**
   * Track user assignment to migration group
   */
  const trackUserAssignment = useCallback((group: 'azure' | 'static' | 'control') => {
    if (!shouldTrack()) return;

    // Send user assignment immediately (not batched)
    fetch('/api/migration/user-assignment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storySlug,
        level,
        group,
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.warn('Failed to track user assignment:', error);
    });
  }, [shouldTrack, storySlug, level]);

  /**
   * Track playback start
   */
  const trackPlaybackStart = useCallback((
    sentenceIndex: number,
    audioSystem: 'azure' | 'static',
    isSlow: boolean
  ) => {
    if (!shouldTrack()) return;

    const sessionId = generateSessionId();
    const session: PlaybackSession = {
      sessionId,
      sentenceIndex,
      audioSystem,
      speed: isSlow ? 'slow' : 'normal',
      startTime: Date.now(),
      wordHighlights: [],
      errors: [],
      completed: false,
    };

    sessionsRef.current.set(sessionId, session);

    // Store session ID for this sentence (simple approach)
    (window as any)[`audioSession_${sentenceIndex}`] = sessionId;
  }, [shouldTrack, generateSessionId]);

  /**
   * Track audio load time
   */
  const trackLoadTime = useCallback((
    sentenceIndex: number,
    loadTime: number,
    audioSystem: 'azure' | 'static'
  ) => {
    if (!shouldTrack()) return;

    const sessionId = (window as any)[`audioSession_${sentenceIndex}`];
    const session = sessionId ? sessionsRef.current.get(sessionId) : null;

    if (session) {
      session.loadTime = loadTime;
      session.playbackStartTime = Date.now();
    }
  }, [shouldTrack]);

  /**
   * Track word highlighting (Azure TTS only)
   */
  const trackWordHighlight = useCallback((
    sentenceIndex: number,
    word: string,
    timestamp: number
  ) => {
    if (!shouldTrack()) return;

    const sessionId = (window as any)[`audioSession_${sentenceIndex}`];
    const session = sessionId ? sessionsRef.current.get(sessionId) : null;

    if (session) {
      session.wordHighlights.push({
        word,
        timestamp,
      });
    }
  }, [shouldTrack]);

  /**
   * Track playback completion
   */
  const trackPlaybackComplete = useCallback((sentenceIndex: number) => {
    if (!shouldTrack()) return;

    const sessionId = (window as any)[`audioSession_${sentenceIndex}`];
    const session = sessionId ? sessionsRef.current.get(sessionId) : null;

    if (session) {
      session.completed = true;

      // Create final metrics
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        sessionId: session.sessionId,
        audioSystem: session.audioSystem,
        loadTime: session.loadTime || 0,
        playbackStartTime: session.playbackStartTime || session.startTime,
        wordTimingAccuracy: session.audioSystem === 'azure' ? calculateWordTimingAccuracy(session) : undefined,
        audioQuality: 4, // Default rating (would be user-provided in real scenario)
        syncQuality: session.audioSystem === 'azure' ? 4 : 3,
        errors: session.errors,
        retryCount: session.errors.length,
        fallbackUsed: session.errors.some(e => e.type === 'generation'),
        storyContext: {
          storySlug,
          level,
          chapter: 1, // Would need to be passed in
          page: 1, // Would need to be passed in
          sentenceIndex,
          language: 'es', // Would need to be determined
          speed: session.speed,
        },
      };

      queueMetrics(metrics);

      // Clean up session
      sessionsRef.current.delete(sessionId);
      delete (window as any)[`audioSession_${sentenceIndex}`];
    }
  }, [shouldTrack, storySlug, level, queueMetrics]);

  /**
   * Track errors
   */
  const trackError = useCallback((
    type: 'generation' | 'network' | 'playback' | 'sync' | 'cache' | 'static_audio',
    message: string,
    sentenceIndex?: number,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    if (!shouldTrack()) return;

    const error: ErrorMetric = {
      timestamp: Date.now(),
      type,
      message,
      severity,
      resolved: false,
    };

    // Add to session if available
    if (sentenceIndex !== undefined) {
      const sessionId = (window as any)[`audioSession_${sentenceIndex}`];
      const session = sessionId ? sessionsRef.current.get(sessionId) : null;

      if (session) {
        session.errors.push(error);
      }
    }

    // Also send error immediately for critical issues
    if (severity === 'critical' || severity === 'high') {
      fetch('/api/migration/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error,
          storyContext: {
            storySlug,
            level,
            sentenceIndex,
          },
          timestamp: Date.now(),
        }),
      }).catch(err => {
        console.warn('Failed to send error metric:', err);
      });
    }
  }, [shouldTrack, storySlug, level]);

  /**
   * Calculate word timing accuracy (placeholder implementation)
   */
  const calculateWordTimingAccuracy = useCallback((session: PlaybackSession): number => {
    if (session.wordHighlights.length === 0) return 0;

    // Simple accuracy calculation based on timing consistency
    // In a real implementation, this would compare against expected timing
    const timings = session.wordHighlights.map(h => h.timestamp);
    const averageInterval = timings.length > 1 
      ? (timings[timings.length - 1] - timings[0]) / (timings.length - 1)
      : 0;

    // Return a score between 0 and 1 based on timing consistency
    return Math.min(1, Math.max(0, 1 - (Math.abs(averageInterval - 500) / 1000)));
  }, []);

  /**
   * Track user feedback
   */
  const trackUserFeedback = useCallback((
    type: 'audio_quality' | 'loading_speed' | 'word_sync' | 'error' | 'general',
    rating: number,
    comment?: string,
    context?: {
      storySlug: string;
      level: string;
      chapter: number;
      page: number;
      audioSystem: 'azure' | 'static';
    }
  ) => {
    if (!shouldTrack()) return;

    fetch('/api/migration/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        rating,
        comment,
        context: context || {
          storySlug,
          level,
          chapter: 1,
          page: 1,
          audioSystem: 'static',
        },
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.warn('Failed to send user feedback:', error);
    });
  }, [shouldTrack, storySlug, level]);

  /**
   * Track A/B test conversion event
   */
  const trackConversion = useCallback((
    event: 'page_complete' | 'story_complete' | 'level_complete' | 'user_retention',
    additionalData?: Record<string, any>
  ) => {
    if (!shouldTrack()) return;

    fetch('/api/migration/conversion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        storyContext: {
          storySlug,
          level,
        },
        additionalData,
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.warn('Failed to track conversion:', error);
    });
  }, [shouldTrack, storySlug, level]);

  // Flush metrics on unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (metricsQueueRef.current.length > 0) {
        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify({
          metrics: metricsQueueRef.current,
          timestamp: Date.now(),
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/migration/metrics', data);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also set up periodic flushing
    const flushInterval = setInterval(() => {
      if (metricsQueueRef.current.length > 0) {
        flushMetrics();
      }
    }, flushInterval);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(flushInterval);
      
      // Final flush on cleanup
      if (metricsQueueRef.current.length > 0) {
        flushMetrics();
      }
    };
  }, [flushMetrics, flushInterval]);

  return {
    trackUserAssignment,
    trackPlaybackStart,
    trackLoadTime,
    trackWordHighlight,
    trackPlaybackComplete,
    trackError,
    trackUserFeedback,
    trackConversion,
    flushMetrics,
    
    // Utility functions
    isEnabled: enabled,
    shouldSample: shouldSampleRef.current,
    getQueueSize: () => metricsQueueRef.current.length,
    getActiveSessions: () => sessionsRef.current.size,
  };
}
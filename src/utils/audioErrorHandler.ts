// src/utils/audioErrorHandler.ts
import type { TTSError, TTSSpeed } from '@/types/azure-tts';

export type AudioErrorType = 
  | 'NETWORK_ERROR'
  | 'TTS_SERVICE_ERROR'
  | 'AUDIO_PLAYBACK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_CONTENT'
  | 'BROWSER_NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

export interface AudioErrorDetails {
  type: AudioErrorType;
  message: string;
  originalError?: Error;
  context: {
    sentenceIndex?: number;
    text?: string;
    language?: string;
    speed?: TTSSpeed;
    storySlug?: string;
    timestamp: number;
  };
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
}

export class AudioErrorHandler {
  private errorLog: AudioErrorDetails[] = [];
  private errorCounts: Map<AudioErrorType, number> = new Map();
  private lastErrors: Map<string, number> = new Map(); // For deduplication

  /**
   * Process and categorize an error
   */
  handleError(
    error: Error | TTSError | any,
    context: {
      sentenceIndex?: number;
      text?: string;
      language?: string;
      speed?: TTSSpeed;
      storySlug?: string;
      operation?: string;
    }
  ): AudioErrorDetails {
    const errorDetails = this.categorizeError(error, context);
    
    // Check for duplicate errors to avoid spam
    const errorKey = `${errorDetails.type}-${context.sentenceIndex || 'global'}`;
    const lastErrorTime = this.lastErrors.get(errorKey) || 0;
    const timeSinceLastError = Date.now() - lastErrorTime;
    
    // Only log if it's been more than 5 seconds since the same error
    if (timeSinceLastError > 5000) {
      this.logError(errorDetails);
      this.lastErrors.set(errorKey, Date.now());
    }

    return errorDetails;
  }

  /**
   * Categorize error and determine appropriate response
   */
  private categorizeError(
    error: any,
    context: {
      sentenceIndex?: number;
      text?: string;
      language?: string;
      speed?: TTSSpeed;
      storySlug?: string;
      operation?: string;
    }
  ): AudioErrorDetails {
    const baseContext = {
      ...context,
      timestamp: Date.now()
    };

    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network connection error',
        originalError: error,
        context: baseContext,
        recoverable: true,
        retryable: true,
        userMessage: 'Connection issue. Please check your internet and try again.',
        technicalDetails: error.message
      };
    }

    // TTS service errors
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return {
        type: 'QUOTA_EXCEEDED',
        message: 'TTS service quota exceeded',
        originalError: error,
        context: baseContext,
        recoverable: true,
        retryable: false,
        userMessage: 'Service temporarily unavailable. Falling back to basic audio.',
        technicalDetails: `Status: ${error.status}, Message: ${error.message}`
      };
    }

    if (error.status >= 500 || error.message?.includes('service') || error.message?.includes('Azure')) {
      return {
        type: 'TTS_SERVICE_ERROR',
        message: 'TTS service error',
        originalError: error,
        context: baseContext,
        recoverable: true,
        retryable: true,
        userMessage: 'Audio service issue. Retrying with fallback audio.',
        technicalDetails: `Status: ${error.status}, Message: ${error.message}`
      };
    }

    // Audio playback errors
    if (error.name === 'NotSupportedError' || error.code === 4) {
      return {
        type: 'AUDIO_PLAYBACK_ERROR',
        message: 'Audio format not supported',
        originalError: error,
        context: baseContext,
        recoverable: true,
        retryable: false,
        userMessage: 'Audio format issue. Using alternative audio.',
        technicalDetails: error.message
      };
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
      return {
        type: 'TIMEOUT_ERROR',
        message: 'Request timeout',
        originalError: error,
        context: baseContext,
        recoverable: true,
        retryable: true,
        userMessage: 'Request took too long. Trying again.',
        technicalDetails: `Timeout after ${error.timeout || 'unknown'}ms`
      };
    }

    // Content validation errors
    if (error.status === 400 || error.message?.includes('invalid') || error.message?.includes('content')) {
      return {
        type: 'INVALID_CONTENT',
        message: 'Invalid content for TTS',
        originalError: error,
        context: baseContext,
        recoverable: false,
        retryable: false,
        userMessage: 'Content cannot be processed. Skipping to next sentence.',
        technicalDetails: error.message
      };
    }

    // Browser capability errors
    if (error.name === 'NotAllowedError' || error.message?.includes('permission')) {
      return {
        type: 'PERMISSION_DENIED',
        message: 'Audio permission denied',
        originalError: error,
        context: baseContext,
        recoverable: false,
        retryable: false,
        userMessage: 'Audio permissions required. Please enable audio in your browser.',
        technicalDetails: error.message
      };
    }

    if (!window.AudioContext && !window.webkitAudioContext) {
      return {
        type: 'BROWSER_NOT_SUPPORTED',
        message: 'Browser does not support Web Audio API',
        originalError: error,
        context: baseContext,
        recoverable: false,
        retryable: false,
        userMessage: 'Your browser does not support advanced audio features. Please update your browser.',
        technicalDetails: 'Web Audio API not available'
      };
    }

    // Default case
    return {
      type: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      originalError: error,
      context: baseContext,
      recoverable: true,
      retryable: true,
      userMessage: 'Something went wrong. Please try again.',
      technicalDetails: error.message || error.toString()
    };
  }

  /**
   * Log error details
   */
  private logError(errorDetails: AudioErrorDetails): void {
    this.errorLog.push(errorDetails);
    
    // Update error counts
    const currentCount = this.errorCounts.get(errorDetails.type) || 0;
    this.errorCounts.set(errorDetails.type, currentCount + 1);

    // Limit error log size
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Audio Error: ${errorDetails.type}`);
      console.log('Message:', errorDetails.message);
      console.log('User Message:', errorDetails.userMessage);
      console.log('Context:', errorDetails.context);
      console.log('Recoverable:', errorDetails.recoverable);
      console.log('Retryable:', errorDetails.retryable);
      if (errorDetails.technicalDetails) {
        console.log('Technical Details:', errorDetails.technicalDetails);
      }
      if (errorDetails.originalError) {
        console.log('Original Error:', errorDetails.originalError);
      }
      console.groupEnd();
    }
  }

  /**
   * Get fallback strategy for a specific error
   */
  getFallbackStrategy(errorDetails: AudioErrorDetails): {
    strategy: 'retry' | 'fallback_audio' | 'skip' | 'user_action';
    delay?: number;
    maxRetries?: number;
    message?: string;
  } {
    switch (errorDetails.type) {
      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
        return {
          strategy: 'retry',
          delay: 2000,
          maxRetries: 3,
          message: 'Retrying connection...'
        };

      case 'TTS_SERVICE_ERROR':
        return {
          strategy: 'fallback_audio',
          message: 'Using backup audio...'
        };

      case 'QUOTA_EXCEEDED':
        return {
          strategy: 'fallback_audio',
          message: 'Switching to standard audio mode...'
        };

      case 'AUDIO_PLAYBACK_ERROR':
        return {
          strategy: 'fallback_audio',
          message: 'Trying alternative audio format...'
        };

      case 'INVALID_CONTENT':
        return {
          strategy: 'skip',
          message: 'Skipping problematic content...'
        };

      case 'PERMISSION_DENIED':
      case 'BROWSER_NOT_SUPPORTED':
        return {
          strategy: 'user_action',
          message: errorDetails.userMessage
        };

      default:
        return {
          strategy: 'retry',
          delay: 1000,
          maxRetries: 2,
          message: 'Attempting recovery...'
        };
    }
  }

  /**
   * Check if error rate is concerning
   */
  isErrorRateConcerning(): boolean {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const recentErrors = this.errorLog.filter(error => 
      Date.now() - error.context.timestamp < 300000 // Last 5 minutes
    ).length;

    return totalErrors > 10 || recentErrors > 5;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<AudioErrorType, number>;
    recentErrors: number;
    mostCommonError: AudioErrorType | null;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorsByType = Object.fromEntries(this.errorCounts) as Record<AudioErrorType, number>;
    const recentErrors = this.errorLog.filter(error => 
      Date.now() - error.context.timestamp < 300000
    ).length;

    let mostCommonError: AudioErrorType | null = null;
    let maxCount = 0;
    for (const [type, count] of this.errorCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonError = type;
      }
    }

    return {
      totalErrors,
      errorsByType,
      recentErrors,
      mostCommonError
    };
  }

  /**
   * Generate user-friendly error message
   */
  getUserMessage(errorDetails: AudioErrorDetails): string {
    const strategy = this.getFallbackStrategy(errorDetails);
    return strategy.message || errorDetails.userMessage;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    this.errorCounts.clear();
    this.lastErrors.clear();
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): AudioErrorDetails[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Check if system should switch to fallback mode
   */
  shouldUseFallbackMode(): boolean {
    const stats = this.getErrorStats();
    const quotaErrors = stats.errorsByType.QUOTA_EXCEEDED || 0;
    const serviceErrors = stats.errorsByType.TTS_SERVICE_ERROR || 0;
    
    // Switch to fallback if too many service-related errors
    return quotaErrors > 3 || serviceErrors > 5 || stats.recentErrors > 8;
  }
}

// Global error handler instance
export const audioErrorHandler = new AudioErrorHandler();

// Utility function for consistent error handling
export function handleAudioError(
  error: any,
  context: {
    sentenceIndex?: number;
    text?: string;
    language?: string;
    speed?: TTSSpeed;
    storySlug?: string;
    operation?: string;
  }
): AudioErrorDetails {
  return audioErrorHandler.handleError(error, context);
}

// Helper function to create user-friendly error notifications
export function createErrorNotification(error: AudioErrorDetails): {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions?: Array<{ label: string; action: string }>;
} {
  const strategy = audioErrorHandler.getFallbackStrategy(error);
  
  let type: 'error' | 'warning' | 'info' = 'error';
  if (error.recoverable) {
    type = strategy.strategy === 'retry' ? 'warning' : 'info';
  }

  const actions: Array<{ label: string; action: string }> = [];
  
  if (strategy.strategy === 'retry') {
    actions.push({ label: 'Retry', action: 'retry' });
  }
  
  if (strategy.strategy === 'fallback_audio') {
    actions.push({ label: 'Use Basic Audio', action: 'fallback' });
  }

  return {
    type,
    title: `Audio ${error.type.replace('_', ' ').toLowerCase()}`,
    message: error.userMessage,
    actions
  };
}
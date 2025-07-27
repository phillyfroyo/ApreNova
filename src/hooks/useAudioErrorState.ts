// src/hooks/useAudioErrorState.ts
"use client";

import { useState, useCallback } from 'react';
import type { AudioErrorDetails } from '@/utils/audioErrorHandler';

export function useAudioErrorState() {
  const [errors, setErrors] = useState<AudioErrorDetails[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const addError = useCallback((error: AudioErrorDetails) => {
    setErrors(prev => [...prev.slice(-9), error]); // Keep last 10 errors
    
    // Set global error for severe issues
    if (!error.recoverable || error.type === 'BROWSER_NOT_SUPPORTED') {
      setGlobalError(error.userMessage);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setGlobalError(null);
  }, []);

  const clearGlobalError = useCallback(() => {
    setGlobalError(null);
  }, []);

  const removeError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getLatestError = useCallback(() => {
    return errors[errors.length - 1] || null;
  }, [errors]);

  const hasRecoverableErrors = useCallback(() => {
    return errors.some(error => error.recoverable);
  }, [errors]);

  const hasRetryableErrors = useCallback(() => {
    return errors.some(error => error.retryable);
  }, [errors]);

  return {
    errors,
    globalError,
    addError,
    clearErrors,
    clearGlobalError,
    removeError,
    getLatestError,
    hasErrors: errors.length > 0,
    hasGlobalError: globalError !== null,
    hasRecoverableErrors: hasRecoverableErrors(),
    hasRetryableErrors: hasRetryableErrors(),
    errorCount: errors.length
  };
}
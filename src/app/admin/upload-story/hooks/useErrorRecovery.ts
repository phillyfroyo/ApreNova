"use client";

import { useState, useCallback, useMemo } from "react";
import type { ChunkError, TranslationErrorType } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface ErrorGroup {
  errorType: TranslationErrorType;
  label: string;
  description: string;
  errors: ChunkError[];
  canBatchRetry: boolean;
}

export interface ErrorRecoveryState {
  /** All errors grouped by level */
  errorsByLevel: Record<number, ChunkError[]>;
  /** Currently selected error for manual editing */
  selectedError: ChunkError | null;
  /** Errors being retried */
  retryingErrors: Set<string>;
  /** Manual override text per error key */
  manualOverrides: Record<string, string>;
}

export interface UseErrorRecoveryOptions {
  /** Initial chunk errors by level */
  initialErrors?: Record<number, ChunkError[]>;
  /** Callback when errors change */
  onErrorsChange?: (errors: Record<number, ChunkError[]>) => void;
}

export interface UseErrorRecoveryReturn {
  /** Current error state */
  state: ErrorRecoveryState;
  /** Check if there are any errors */
  hasErrors: boolean;
  /** Get total error count */
  totalErrorCount: number;
  /** Get errors for a specific level */
  getErrorsForLevel: (level: number) => ChunkError[];
  /** Get errors grouped by type for a level */
  getErrorGroupsForLevel: (level: number) => ErrorGroup[];
  /** Add an error */
  addError: (level: number, error: ChunkError) => void;
  /** Add multiple errors */
  addErrors: (level: number, errors: ChunkError[]) => void;
  /** Remove an error by key */
  removeError: (level: number, errorKey: string) => void;
  /** Clear all errors for a level */
  clearErrorsForLevel: (level: number) => void;
  /** Clear all errors */
  clearAllErrors: () => void;
  /** Select an error for manual editing */
  selectError: (error: ChunkError | null) => void;
  /** Set manual override text for an error */
  setManualOverride: (errorKey: string, text: string) => void;
  /** Get manual override text for an error */
  getManualOverride: (errorKey: string) => string | undefined;
  /** Mark an error as being retried */
  markRetrying: (errorKey: string) => void;
  /** Mark an error as done retrying */
  markRetryDone: (errorKey: string) => void;
  /** Check if an error is being retried */
  isRetrying: (errorKey: string) => boolean;
  /** Get error key from error object */
  getErrorKey: (error: ChunkError) => string;
  /** Get error type label */
  getErrorTypeLabel: (errorType: TranslationErrorType) => string;
  /** Get error type description */
  getErrorTypeDescription: (errorType: TranslationErrorType) => string;
  /** Check if error type can be batch retried */
  canBatchRetry: (errorType: TranslationErrorType) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ERROR_TYPE_INFO: Record<TranslationErrorType, { label: string; description: string; canBatchRetry: boolean }> = {
  rate_limit: {
    label: "Rate Limited",
    description: "API rate limit exceeded. Wait a moment and retry.",
    canBatchRetry: true,
  },
  content_refusal: {
    label: "Content Refused",
    description: "AI refused to process this content. May need manual editing.",
    canBatchRetry: false,
  },
  network: {
    label: "Network Error",
    description: "Connection failed. Check your internet and retry.",
    canBatchRetry: true,
  },
  timeout: {
    label: "Timeout",
    description: "Request took too long. The chunk may be too large.",
    canBatchRetry: true,
  },
  malformed: {
    label: "Malformed Response",
    description: "Server returned invalid data. Try again.",
    canBatchRetry: true,
  },
  unknown: {
    label: "Unknown Error",
    description: "An unexpected error occurred.",
    canBatchRetry: true,
  },
};

// ============================================================================
// Hook
// ============================================================================

export function useErrorRecovery(options: UseErrorRecoveryOptions = {}): UseErrorRecoveryReturn {
  const { initialErrors = {}, onErrorsChange } = options;

  // State
  const [errorsByLevel, setErrorsByLevel] = useState<Record<number, ChunkError[]>>(initialErrors);
  const [selectedError, setSelectedError] = useState<ChunkError | null>(null);
  const [retryingErrors, setRetryingErrors] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  // Helper: Generate unique key for an error
  const getErrorKey = useCallback((error: ChunkError): string => {
    return `${error.chapterIndex}-${error.subChunkIndex ?? "main"}`;
  }, []);

  // Helper: Notify parent of changes
  const notifyChange = useCallback((newErrors: Record<number, ChunkError[]>) => {
    if (onErrorsChange) {
      onErrorsChange(newErrors);
    }
  }, [onErrorsChange]);

  // Computed: Has any errors
  const hasErrors = useMemo(() => {
    return Object.values(errorsByLevel).some(errors => errors.length > 0);
  }, [errorsByLevel]);

  // Computed: Total error count
  const totalErrorCount = useMemo(() => {
    return Object.values(errorsByLevel).reduce((sum, errors) => sum + errors.length, 0);
  }, [errorsByLevel]);

  // Get errors for a specific level
  const getErrorsForLevel = useCallback((level: number): ChunkError[] => {
    return errorsByLevel[level] || [];
  }, [errorsByLevel]);

  // Get errors grouped by type for a level
  const getErrorGroupsForLevel = useCallback((level: number): ErrorGroup[] => {
    const errors = errorsByLevel[level] || [];
    const groups: Record<TranslationErrorType, ChunkError[]> = {
      rate_limit: [],
      content_refusal: [],
      network: [],
      timeout: [],
      malformed: [],
      unknown: [],
    };

    errors.forEach(error => {
      groups[error.errorType].push(error);
    });

    return Object.entries(groups)
      .filter(([, errs]) => errs.length > 0)
      .map(([type, errs]) => {
        const errorType = type as TranslationErrorType;
        const info = ERROR_TYPE_INFO[errorType];
        return {
          errorType,
          label: info.label,
          description: info.description,
          errors: errs,
          canBatchRetry: info.canBatchRetry,
        };
      });
  }, [errorsByLevel]);

  // Add a single error
  const addError = useCallback((level: number, error: ChunkError) => {
    setErrorsByLevel(prev => {
      const newErrors = {
        ...prev,
        [level]: [...(prev[level] || []), error],
      };
      notifyChange(newErrors);
      return newErrors;
    });
  }, [notifyChange]);

  // Add multiple errors
  const addErrors = useCallback((level: number, errors: ChunkError[]) => {
    setErrorsByLevel(prev => {
      const newErrors = {
        ...prev,
        [level]: [...(prev[level] || []), ...errors],
      };
      notifyChange(newErrors);
      return newErrors;
    });
  }, [notifyChange]);

  // Remove an error by key
  const removeError = useCallback((level: number, errorKey: string) => {
    setErrorsByLevel(prev => {
      const levelErrors = prev[level] || [];
      const newLevelErrors = levelErrors.filter(e => getErrorKey(e) !== errorKey);
      const newErrors = {
        ...prev,
        [level]: newLevelErrors,
      };
      notifyChange(newErrors);
      return newErrors;
    });
  }, [getErrorKey, notifyChange]);

  // Clear all errors for a level
  const clearErrorsForLevel = useCallback((level: number) => {
    setErrorsByLevel(prev => {
      const newErrors = { ...prev };
      delete newErrors[level];
      notifyChange(newErrors);
      return newErrors;
    });
  }, [notifyChange]);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrorsByLevel({});
    notifyChange({});
  }, [notifyChange]);

  // Select an error for manual editing
  const selectError = useCallback((error: ChunkError | null) => {
    setSelectedError(error);
    if (error) {
      // Initialize manual override with original text if not already set
      const key = getErrorKey(error);
      setManualOverrides(prev => ({
        ...prev,
        [key]: prev[key] ?? error.originalText,
      }));
    }
  }, [getErrorKey]);

  // Set manual override text
  const setManualOverride = useCallback((errorKey: string, text: string) => {
    setManualOverrides(prev => ({
      ...prev,
      [errorKey]: text,
    }));
  }, []);

  // Get manual override text
  const getManualOverride = useCallback((errorKey: string): string | undefined => {
    return manualOverrides[errorKey];
  }, [manualOverrides]);

  // Mark an error as being retried
  const markRetrying = useCallback((errorKey: string) => {
    setRetryingErrors(prev => new Set(prev).add(errorKey));
  }, []);

  // Mark an error as done retrying
  const markRetryDone = useCallback((errorKey: string) => {
    setRetryingErrors(prev => {
      const next = new Set(prev);
      next.delete(errorKey);
      return next;
    });
  }, []);

  // Check if an error is being retried
  const isRetrying = useCallback((errorKey: string): boolean => {
    return retryingErrors.has(errorKey);
  }, [retryingErrors]);

  // Get error type label
  const getErrorTypeLabel = useCallback((errorType: TranslationErrorType): string => {
    return ERROR_TYPE_INFO[errorType].label;
  }, []);

  // Get error type description
  const getErrorTypeDescription = useCallback((errorType: TranslationErrorType): string => {
    return ERROR_TYPE_INFO[errorType].description;
  }, []);

  // Check if error type can be batch retried
  const canBatchRetry = useCallback((errorType: TranslationErrorType): boolean => {
    return ERROR_TYPE_INFO[errorType].canBatchRetry;
  }, []);

  return {
    state: {
      errorsByLevel,
      selectedError,
      retryingErrors,
      manualOverrides,
    },
    hasErrors,
    totalErrorCount,
    getErrorsForLevel,
    getErrorGroupsForLevel,
    addError,
    addErrors,
    removeError,
    clearErrorsForLevel,
    clearAllErrors,
    selectError,
    setManualOverride,
    getManualOverride,
    markRetrying,
    markRetryDone,
    isRetrying,
    getErrorKey,
    getErrorTypeLabel,
    getErrorTypeDescription,
    canBatchRetry,
  };
}

export default useErrorRecovery;

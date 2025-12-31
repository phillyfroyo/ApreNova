// SM-2 Spaced Repetition Algorithm
// Based on Anki's implementation of SuperMemo 2

export interface SM2Input {
  quality: number;      // 0-5 rating
  repetitions: number;  // Current successful review count
  easeFactor: number;   // Current ease factor (minimum 1.3)
  interval: number;     // Current interval in days
}

export interface SM2Output {
  repetitions: number;
  easeFactor: number;
  interval: number;
  nextReviewDate: Date;
}

/**
 * SM-2 Algorithm Quality Ratings:
 * 5 - Perfect response, instant recall
 * 4 - Correct response after hesitation
 * 3 - Correct response with serious difficulty
 * 2 - Incorrect response, but easily recalled when shown
 * 1 - Incorrect response, remembered when shown
 * 0 - Complete blackout, no recall
 */
export function calculateSM2(input: SM2Input): SM2Output {
  const { quality, repetitions, easeFactor, interval } = input;

  let newRepetitions: number;
  let newInterval: number;
  let newEaseFactor: number;

  // If quality < 3, card is failed - reset repetitions
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review again tomorrow
    newEaseFactor = Math.max(1.3, easeFactor - 0.2); // Decrease EF slightly
  } else {
    // Successful recall
    newRepetitions = repetitions + 1;

    // Calculate new ease factor using SM-2 formula:
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    newEaseFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor); // EF minimum is 1.3

    // Calculate interval based on repetition count
    if (newRepetitions === 1) {
      newInterval = 1; // First successful review: 1 day
    } else if (newRepetitions === 2) {
      newInterval = 6; // Second successful review: 6 days
    } else {
      // Subsequent reviews: previous interval * EF
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  nextReviewDate.setHours(0, 0, 0, 0); // Start of day

  return {
    repetitions: newRepetitions,
    easeFactor: Math.round(newEaseFactor * 100) / 100, // Round to 2 decimals
    interval: newInterval,
    nextReviewDate,
  };
}

// Simplified quality ratings for user-friendly UI buttons
export const QUALITY_RATINGS = {
  AGAIN: 0, // Complete failure - show again soon
  HARD: 2, // Recalled with difficulty
  GOOD: 3, // Correct with some effort
  EASY: 5, // Perfect instant recall
} as const;

export type QualityRating = keyof typeof QUALITY_RATINGS;

// Get SM-2 quality value from simplified rating
export function getQualityFromRating(rating: QualityRating): number {
  return QUALITY_RATINGS[rating];
}

// Get human-readable label for quality rating
export function getQualityLabel(
  rating: QualityRating,
  lang: 'en' | 'es' = 'en'
): string {
  const labels: Record<QualityRating, { en: string; es: string }> = {
    AGAIN: { en: 'Again', es: 'Otra vez' },
    HARD: { en: 'Hard', es: 'Difícil' },
    GOOD: { en: 'Good', es: 'Bien' },
    EASY: { en: 'Easy', es: 'Fácil' },
  };
  return labels[rating][lang];
}

// Estimate next review interval for each rating (for preview)
export function getIntervalPreview(
  input: Omit<SM2Input, 'quality'>
): Record<QualityRating, number> {
  return {
    AGAIN: 1,
    HARD: calculateSM2({ ...input, quality: QUALITY_RATINGS.HARD }).interval,
    GOOD: calculateSM2({ ...input, quality: QUALITY_RATINGS.GOOD }).interval,
    EASY: calculateSM2({ ...input, quality: QUALITY_RATINGS.EASY }).interval,
  };
}

// Format interval for display (e.g., "1d", "6d", "2w", "1mo")
export function formatInterval(days: number, lang: 'en' | 'es' = 'en'): string {
  if (days < 1) {
    return lang === 'en' ? '<1d' : '<1d';
  } else if (days === 1) {
    return '1d';
  } else if (days < 7) {
    return `${days}d`;
  } else if (days < 30) {
    const weeks = Math.round(days / 7);
    return lang === 'en' ? `${weeks}w` : `${weeks}sem`;
  } else if (days < 365) {
    const months = Math.round(days / 30);
    return lang === 'en' ? `${months}mo` : `${months}m`;
  } else {
    const years = Math.round(days / 365);
    return lang === 'en' ? `${years}y` : `${years}a`;
  }
}

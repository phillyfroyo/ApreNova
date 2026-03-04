// FSRS-style Adaptive Spaced Repetition Algorithm
// Replaces SM-2 with stability/difficulty model for more varied intervals

export interface SM2Input {
  quality: number;      // 1-4 FSRS rating (Hard=1, Good=2, Easy=3, Mastered=4)
  repetitions: number;  // Current successful review count
  easeFactor: number;   // Repurposed as difficulty (1-10 scale, default 5)
  interval: number;     // Current interval in days
  stability?: number;   // Memory stability in days (new field)
}

export interface SM2Output {
  repetitions: number;
  easeFactor: number;   // Difficulty (1-10)
  interval: number;
  nextReviewDate: Date;
  stability: number;    // New: memory stability
}

// FSRS-4.5 Constants
const RETENTION = 0.9;    // Target 90% recall probability
const DECAY = -0.5;
const FACTOR = 19 / 81;   // FSRS forgetting curve factor

// Initial stability values by rating (days)
const INITIAL_STABILITY: Record<number, number> = {
  1: 0.01,  // Hard  — ~14 minutes
  2: 1.0,   // Good  — 1 day
  3: 7.0,   // Easy  — 1 week
  4: 90,    // Mastered — 3 months
};

// Initial difficulty values by rating
const INITIAL_DIFFICULTY: Record<number, number> = {
  1: 7,     // Hard
  2: 5,     // Good
  3: 3,     // Easy
  4: 1,     // Mastered
};

/**
 * Calculate current recall probability based on stability and elapsed time
 * FSRS forgetting curve: R(t) = (1 + FACTOR × t/S)^DECAY
 */
function getRecallProbability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

/**
 * Convert stability to interval in fractional days.
 * Solves R(t) = RETENTION for t:  t = (S / FACTOR) × (RETENTION^(1/DECAY) - 1)
 * For retention=0.9 this simplifies to interval ≈ stability × 1.0
 */
function stabilityToInterval(stability: number): number {
  return (stability / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * FSRS Algorithm - calculates next review parameters
 */
export function calculateSM2(input: SM2Input): SM2Output {
  const { quality, repetitions, easeFactor, interval, stability = 0 } = input;

  // Map quality to FSRS grade (1-4)
  const grade = clamp(quality, 1, 4);
  const isFirstReview = repetitions === 0 && stability === 0;

  let newStability: number;
  let newDifficulty: number;
  let newRepetitions: number;

  // Mastered: skip FSRS, set fixed 90-day interval
  if (grade === 4) {
    newStability = 90;
    newDifficulty = isFirstReview ? 1 : clamp(easeFactor * 0.9 + 5 * 0.1 - 0.5, 1, 10);
    newRepetitions = repetitions + 1;
  } else if (isFirstReview) {
    // First review: use initial values based on rating
    newStability = INITIAL_STABILITY[grade] ?? 1.0;
    newDifficulty = INITIAL_DIFFICULTY[grade] ?? 5;
    newRepetitions = grade >= 2 ? 1 : 0;
  } else {
    // Subsequent reviews (Hard, Good, Easy)
    const D = easeFactor; // Current difficulty (stored in easeFactor field)
    const S = stability > 0 ? stability : Math.max(interval, 1); // Fallback for migrated cards

    // Calculate elapsed days (approximate from interval)
    const elapsedDays = Math.max(interval, 1);
    const R = getRecallProbability(S, elapsedDays);

    // Update difficulty: D' = clamp(D - 0.5 × (grade - 2), 1, 10) with mean reversion
    // grade 1 (Hard) increases difficulty, grade 3 (Easy) decreases it
    const rawDifficulty = D - 0.5 * (grade - 2);
    newDifficulty = clamp(rawDifficulty * 0.9 + 5 * 0.1, 1, 10);

    if (grade >= 2) {
      // Success (Good, Easy)
      // S' = S × (1 + e^(0.5) × (11-D) × S^(-0.2) × (e^(0.2×(1-R)) - 1)) × gradeBonus
      const growthFactor = Math.exp(0.5) *
        (11 - D) *
        Math.pow(S, -0.2) *
        (Math.exp(0.2 * (1 - R)) - 1);
      // Easy gets 2× growth bonus so intervals always differ from Good
      const gradeBonus = grade === 3 ? 2.0 : 1.0;
      newStability = S * (1 + Math.max(growthFactor, 0.1) * gradeBonus);
      newRepetitions = repetitions + 1;
    } else {
      // Hard (grade 1) — short reset, not full failure
      // S' = S × max(0.5 × (D/10), 0.2)
      newStability = S * Math.max(0.5 * (D / 10), 0.2);
      newRepetitions = 0;
    }
  }

  // Ensure stability is at least 0.001 (~1.4 minutes)
  newStability = Math.max(newStability, 0.001);

  // Calculate interval from stability
  const rawInterval = stabilityToInterval(newStability);
  const newInterval = Math.max(1, Math.round(rawInterval)); // DB stores integer days, min 1

  // Calculate next review date
  const nextReviewDate = new Date();
  if (rawInterval < 1) {
    // Sub-day interval: schedule by minutes
    const minutes = Math.max(10, Math.round(rawInterval * 24 * 60));
    nextReviewDate.setMinutes(nextReviewDate.getMinutes() + minutes);
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
    nextReviewDate.setHours(0, 0, 0, 0);
  }

  return {
    repetitions: newRepetitions,
    easeFactor: Math.round(newDifficulty * 100) / 100,
    interval: newInterval,
    nextReviewDate,
    stability: Math.round(newStability * 1000) / 1000,
  };
}

// FSRS quality ratings (1-4 scale)
export const QUALITY_RATINGS = {
  HARD: 1,
  GOOD: 2,
  EASY: 3,
  MASTERED: 4,
} as const;

export type QualityRating = keyof typeof QUALITY_RATINGS;

// Get FSRS quality value from simplified rating
export function getQualityFromRating(rating: QualityRating): number {
  return QUALITY_RATINGS[rating];
}

// Get human-readable label for quality rating
export function getQualityLabel(
  rating: QualityRating,
  lang: 'en' | 'es' = 'en'
): string {
  const labels: Record<QualityRating, { en: string; es: string }> = {
    HARD: { en: 'Hard', es: 'Difícil' },
    GOOD: { en: 'Good', es: 'Bien' },
    EASY: { en: 'Easy', es: 'Fácil' },
    MASTERED: { en: 'Mastered', es: 'Dominada' },
  };
  return labels[rating][lang];
}

/**
 * Estimate next review interval for each rating (for button preview).
 * Returns fractional days so formatInterval can show minutes/hours.
 */
export function getIntervalPreview(
  input: Omit<SM2Input, 'quality'>
): Record<QualityRating, number> {
  const preview = (grade: number): number => {
    const isFirstReview = input.repetitions === 0 && (input.stability ?? 0) === 0;
    if (isFirstReview) {
      const s = INITIAL_STABILITY[grade] ?? 1.0;
      return stabilityToInterval(s);
    }
    const result = calculateSM2({ ...input, quality: grade });
    return stabilityToInterval(result.stability);
  };

  return {
    HARD: preview(QUALITY_RATINGS.HARD),
    GOOD: preview(QUALITY_RATINGS.GOOD),
    EASY: preview(QUALITY_RATINGS.EASY),
    MASTERED: preview(QUALITY_RATINGS.MASTERED),
  };
}

// Format interval for display (e.g., "14m", "4h", "1d", "2w", "3mo")
export function formatInterval(days: number, lang: 'en' | 'es' = 'en'): string {
  if (days < 1 / 24) {
    // Less than 1 hour → show minutes
    const mins = Math.max(1, Math.round(days * 24 * 60));
    return `${mins}m`;
  } else if (days < 1) {
    // Less than 1 day → show hours
    const hours = Math.round(days * 24);
    return `${hours}h`;
  } else if (days < 2) {
    return '1d';
  } else if (days < 7) {
    return `${Math.round(days)}d`;
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

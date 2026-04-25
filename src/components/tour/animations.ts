// Shared motion design tokens for the discovery tour.
// See dev/RETENTION_TOUR_PLAN.md for the full motion design spec.

export const TOUR_EASING = {
  ambient: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
};

export const TOUR_SPRING = {
  gentle: { type: "spring" as const, stiffness: 180, damping: 22 },
  tap: { type: "spring" as const, stiffness: 260, damping: 18 },
};

export const TOUR_DURATIONS = {
  wordGlowFadeIn: 1.2,
  wordGlowPulseHold: 0.8,
  emojiRowSlideIn: 0.5,
  emojiRowDwell: 5.0,
  emojiRowFadeOut: 0.6,
  audioRingPulse: 1.5,
  audioRingHold: 4.0,
  saveEmojiPulseDelay: 0.6,
  saveEmojiPulseCount: 3,
  saveEmojiPulsePeriod: 0.9,
};

export const TOUR_TIMING = {
  /** Minimum dwell time on a story page before a tour step is eligible to fire (ms). */
  dwellThresholdMs: 5000,
  /** Window within which an organic interaction is considered to "pre-empt" the tour step (ms). */
  adaptiveSkipWindowMs: 5000,
};

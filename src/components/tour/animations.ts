// Shared timing tokens for the discovery tour.
// Visual easing/durations for the gold ring and pulses live in
// src/app/globals.css as keyframes; this file holds only the values the
// JS orchestrator needs (timeouts, dwell thresholds).

export const TOUR_DURATIONS = {
  /** Word glow fade-in before the auto-tap fires (seconds). */
  wordGlowFadeIn: 1.2,
  /** Glow holds at peak before the auto-tap fires (seconds). */
  wordGlowPulseHold: 0.8,
  /** Emoji row visible time after the auto-tap before step completes (seconds). */
  emojiRowDwell: 5.0,
  /** Listen-button glow hold time for step 2 (seconds). */
  audioGlowHold: 6.0,
};

export const TOUR_TIMING = {
  /** Minimum dwell time on a story page before a tour step is eligible to fire (ms). */
  dwellThresholdMs: 2000,
};

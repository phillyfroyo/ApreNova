// Shared timing tokens for the discovery tour.
// Visual easing/durations for the gold ring and pulses live in
// src/app/globals.css as keyframes; this file holds only the values the
// JS orchestrator needs (timeouts, dwell thresholds).

export const TOUR_DURATIONS = {
  /** Emoji row visible time after the auto-tap before step completes (seconds).
      Sized to fit: 1s pre-wave pause + 1.5s wave + 2 full bounce cycles (3.5s × 2 = 7s)
      = 9.5s total. Rounded to 10s so the user sees the bounce repeat at least once. */
  emojiRowDwell: 10.0,
  /** Listen-button glow hold time for step 2 (seconds). */
  audioGlowHold: 6.0,
};

export const TOUR_TIMING = {
  /** Minimum dwell time on a story page before a tour step is eligible to fire (ms). */
  dwellThresholdMs: 2000,
};

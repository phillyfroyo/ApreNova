# In-App Discovery Tour — Implementation Plan

**Branch:** `retention-april2026`
**Parent doc:** `dev/RETENTION_PLAN.md` (item #5)
**Goal:** Make the language-learning magic discoverable to new users so they don't churn at 2-20 minutes thinking it's "just a reader."

---

## Design Principles (Locked)

These are the rules every implementation decision must respect:

1. **Drive curiosity, do not hijack.** Show that features exist; do not perform them on the user's behalf when doing so would feel intrusive (auto-playing audio, auto-saving words). The exception is reversible, low-commitment actions like auto-tapping a word to reveal the action row.
2. **Slow ambient motion, not snap actions.** Animations should feel like the room warming up, not something happening *to* the user. Default duration: 600-1200ms. Default easing: `ease-out` or spring. Never under 300ms for tour effects.
3. **One feature per page.** Don't stack lessons. Trust the user to discover the rest organically.
4. **Track per-step in DB, idempotent.** Each step fires once, ever. Page-back-and-forth doesn't re-hijack.
5. **Adaptive: skip what the user already discovered.** If they organically used a feature before the tour fires for it, mark it complete silently.
6. **Trigger on any story, on the first 3 *qualifying* page visits.** Not specific stories. Not specific pages.
7. **Tour ends when all steps marked complete.** Persist `tourComplete: true` on the user record.

---

## Tour Steps (3 steps, locked)

### Step 1 — Word tap reveals the action row
**What the user sees:** On their first qualifying page visit, after page render and a short delay, a single mid-line word develops a slow pulsing glow. ~800ms later, the word is "auto-tapped" — the emoji action row slides in from below the word with spring physics. No specific emoji is highlighted in this step. The row stays open for ~5s, then fades passively unless dismissed.

**What it teaches:** "I can tap any word, and something appears."

**Mental model:** there's a hidden interaction layer.

### Step 2 — Audiobook button glow
**What the user sees:** On their second qualifying page visit, after render, the audiobook/play button somewhere in the page chrome develops a slow ambient ring (similar to the word glow but anchored to the button). No auto-activation. The ring pulses 2-3x then settles into a faint persistent halo for ~4s before fading.

**What it teaches:** "There's audio. I can play it when I want."

**Why no auto-activation:** sudden audio playback breaks trust irreversibly.

### Step 3 — Save-word emoji highlight inside the row
**What the user sees:** On their third qualifying page visit, the same auto-tap behavior as step 1 fires (different word). Once the emoji row appears, the save-word emoji within the row pulses with a secondary highlight after ~600ms. Other emojis remain visible but un-highlighted.

**What it teaches:** "Inside that row I saw earlier, there are specific actions. Saving is one of them."

**Why this works:** by step 3 the user has seen the emoji row twice (step 1 explicitly, possibly again organically). They have a mental anchor for it. Now we can call out a specific feature without it feeling like a feature dump.

---

## What Counts as a "Qualifying" Page Visit

Not every navigation should count toward the tour's 3-step quota. A user who fast-flips through 3 pages in 10 seconds shouldn't "complete" the tour without engaging.

**Rules:**
- User must spend **≥5 seconds** on the page, OR scroll on the page, before the tour step fires
- The page must be inside a story (not the stories list, not the dashboard)
- Steps fire in order: step 2 only fires if step 1 is complete; step 3 only if step 2 is complete
- If user revisits a page where a step has already fired, no re-fire

**Adaptive skip rule:**
- If on the page where step N is *eligible* to fire, the user organically performs the action being taught (e.g., taps a word for step 1) before the auto-trigger, mark step N complete silently and skip the auto-action. Move to step N+1 on the next qualifying page visit.

---

## Database Schema

Add fields to the `User` model in `prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  tourStep1CompletedAt DateTime?
  tourStep2CompletedAt DateTime?
  tourStep3CompletedAt DateTime?
  tourCompletedAt      DateTime?
}
```

**Why timestamps and not booleans:**
- Lets us answer "when did the user complete each step" — useful for retention analytics later
- Null = not done. Non-null = done. Same boolean semantics with more data.
- Easy to add a 4th step later without breaking the schema

**Migration name:** `add_tour_progress_to_user`

**Backfill:** none needed. Existing users get null for all fields, meaning the tour will fire for them on next qualifying page visit. Acceptable — the existing 94 users probably won't return anyway, and if they do, a tour is fine. (If we want to grandfather existing users out, set `tourCompletedAt = NOW()` for users with `createdAt < migration_date`. My recommendation: don't grandfather. Let returning users get the tour.)

**Important:** apply this migration with the same safe pattern we used for `add_phone_to_user`:
1. `prisma migrate dev --create-only --name add_tour_progress_to_user`
2. Inspect SQL
3. `prisma migrate deploy`

---

## Architecture

### File layout

```
src/
├── components/
│   └── tour/
│       ├── TourProvider.tsx         ← Context: state, completion tracking, step orchestration
│       ├── useTourState.ts          ← Hook: reads/writes tour state from server, exposes step status
│       ├── TourStep1WordReveal.tsx  ← Component: word glow + auto-tap + emoji row reveal
│       ├── TourStep2AudioGlow.tsx   ← Component: audiobook button ring/halo
│       ├── TourStep3SaveHighlight.tsx ← Component: word glow + emoji row + save emoji highlight
│       ├── animations.ts            ← Shared Framer Motion variants + easing curves
│       └── tour-utils.ts            ← Dwell-time tracker, eligibility checks, page counter
├── app/
│   └── api/
│       └── tour/
│           ├── state/route.ts       ← GET current step status for user
│           └── complete/route.ts    ← POST mark step N complete
```

### State flow

1. **Page render** (story page mount) → `TourProvider` reads tour state from server (cached for session)
2. **Eligibility check** → is this user's page visit qualifying? (dwell timer starts)
3. **Step trigger** → after dwell threshold + step-specific delay, the appropriate step component mounts
4. **Step fires** → animation plays
5. **Step completes** (animation finished OR user interacted OR timeout) → POST to `/api/tour/complete` with step number
6. **Server updates DB** → returns updated state
7. **Provider updates context** → next page visit will trigger next step

### Why provider pattern, not global Zustand/Redux

Tour state is read once per session, written 3 times max. Provider with React state is sufficient. Adding a global store would be overkill.

---

## Motion Design Spec

This is the part that determines whether the tour feels "magical" or "cheap." Be deliberate with these values.

### Easing curves

```ts
// In src/components/tour/animations.ts
export const TOUR_EASING = {
  // Slow ambient fade-in. Use for word glow, button rings, halos.
  ambient: [0.16, 1, 0.3, 1] as const, // ease-out-expo

  // Spring for emoji row entrance. Feels alive without being bouncy.
  springGentle: { type: "spring", stiffness: 180, damping: 22 } as const,

  // Spring for the auto-tap "ripple" — slightly snappier
  springTap: { type: "spring", stiffness: 260, damping: 18 } as const,

  // Standard exit. Snappier than entrance — exits should feel decisive.
  exit: [0.4, 0, 1, 1] as const, // ease-in-quad
};

export const TOUR_DURATIONS = {
  wordGlowFadeIn: 1.2,    // seconds
  wordGlowPulseHold: 0.8,
  emojiRowSlideIn: 0.5,   // spring, this is just a hint
  emojiRowDwell: 5.0,     // how long row stays visible passively
  emojiRowFadeOut: 0.6,
  audioRingPulse: 1.5,
  audioRingHold: 4.0,
  saveEmojiPulseDelay: 0.6,
  saveEmojiPulseCount: 3,
  saveEmojiPulsePeriod: 0.9,
};
```

### Step 1 sequence (timeline)

```
t=0.0s   Page mounts. Dwell timer starts.
t=5.0s   Dwell threshold met (assuming user has been on page).
t=5.0s   Word selection: pick word. Glow animation begins (1.2s fade-in).
t=6.2s   Glow at full intensity. Hold for 0.8s.
t=7.0s   Auto-tap fires. Emoji row springs in (~500ms, springGentle).
t=7.5s   Row fully visible.
t=12.5s  Row fade-out begins (0.6s).
t=13.1s  Row gone. Step 1 marked complete in DB.
```

### Step 2 sequence

```
t=0.0s   Page mounts.
t=5.0s   Dwell threshold met.
t=5.0s   Audio button ambient ring fades in (1.2s).
t=6.2s   Ring pulses 2x (1.5s × 2 = 3.0s).
t=9.2s   Ring holds at low intensity for 4.0s.
t=13.2s  Ring fades out (0.6s). Step 2 complete.
```

### Step 3 sequence

```
t=0.0s   Page mounts.
t=5.0s   Dwell threshold met.
t=5.0s   Word glow + auto-tap (same as step 1).
t=7.5s   Emoji row visible.
t=8.1s   Save emoji secondary pulse begins.
t=8.1s   Pulse 1 (0.9s)
t=9.0s   Pulse 2
t=9.9s   Pulse 3
t=10.8s  Pulse complete. Row stays visible for remaining dwell (~2s).
t=12.8s  Row fade-out. Step 3 + tour complete.
```

### Tailwind keyframes (in `tailwind.config.js`)

```js
extend: {
  keyframes: {
    'tour-word-glow': {
      '0%, 100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
      '50%': { boxShadow: '0 0 12px 2px rgba(99, 102, 241, 0.6)' },
    },
    'tour-ring-pulse': {
      '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
      '50%': { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.3)' },
    },
    'tour-emoji-pulse': {
      '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
      '50%': { transform: 'scale(1.18)', filter: 'brightness(1.3)' },
    },
  },
  animation: {
    'tour-word-glow': 'tour-word-glow 2.0s cubic-bezier(0.16, 1, 0.3, 1) infinite',
    'tour-ring-pulse': 'tour-ring-pulse 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
    'tour-emoji-pulse': 'tour-emoji-pulse 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
  },
}
```

### Color choices
- Word glow: indigo (matches existing primary action color in the app)
- Audio ring: emerald (associates with audio/positive action)
- Save emoji pulse: warm amber (saves are personal/cherished)

These can be tuned later. The point is they should be deliberate, not all the same color.

### Reduced motion respect
All tour animations must check `prefers-reduced-motion`. If true, skip animations and just instant-show + immediately mark complete. Build this into `TourProvider` once, not per component.

---

## API Contracts

### `GET /api/tour/state`
Returns the current tour state for the authenticated user.

```ts
// Response
{
  step1CompletedAt: string | null,
  step2CompletedAt: string | null,
  step3CompletedAt: string | null,
  tourCompletedAt: string | null,
  // computed for client convenience
  nextStep: 1 | 2 | 3 | null,
}
```

### `POST /api/tour/complete`
Marks a step complete. Idempotent — calling twice with same step is a no-op.

```ts
// Request
{ step: 1 | 2 | 3 }

// Response
{
  step1CompletedAt: string | null,
  step2CompletedAt: string | null,
  step3CompletedAt: string | null,
  tourCompletedAt: string | null,
}
```

Server logic:
- Set `tourStepNCompletedAt = NOW()` if currently null
- If all 3 steps now complete, set `tourCompletedAt = NOW()`
- Return updated state

---

## Edge Cases & Handling

| Case | Behavior |
|------|----------|
| User signs out mid-tour | State persists in DB. Resume on next login. |
| User completes tour, deletes account, recreates with same email | New user record, fresh tour. |
| User uses a feature naturally before the auto-trigger fires | Mark that step complete silently. Skip auto-action. |
| User navigates away during a step's animation | Mark complete on unmount if dwell threshold was met and animation started. Otherwise leave step pending. |
| User is on page for 4 seconds and clicks to next page | No qualifying visit. Step doesn't fire. |
| User has `prefers-reduced-motion: reduce` | Skip animations. Mark all 3 steps complete after first qualifying page visit. (Or: still gate on 3 visits but no animations.) Decision: mark all complete silently — the tour is for visual discovery; without motion, it doesn't add value. |
| Story page renders but user is on a chapter without standard emoji row | Skip step 1/3 for that page. Try again on next qualifying page. |
| Audio button doesn't exist on current page | Skip step 2 for that page. |
| Tour fires while user is in the AI tutor or a modal | Defer until modal/tutor is closed. Don't fire on top of other UI. |
| User on mobile vs. desktop | Same logic. Animations should look identical. Test both. |

---

## Implementation Phases

Build in this order so each phase is independently shippable.

### Phase 1 — Plumbing
1. Add Prisma schema fields + migration
2. Build `/api/tour/state` and `/api/tour/complete` endpoints
3. Build `TourProvider` + `useTourState` hook
4. Wire provider into the story page layout
5. **Verify:** state reads/writes work; page mount triggers dwell timer; manual API calls update DB

### Phase 2 — Step 1 (word reveal)
6. Build `TourStep1WordReveal` component with full animation sequence
7. Wire into the story page rendering
8. Implement adaptive skip (detect organic word tap)
9. **Verify on real device:** animation feels right, dwell threshold works, completes correctly, doesn't re-fire

### Phase 3 — Step 2 (audio glow)
10. Build `TourStep2AudioGlow`
11. Locate the right anchor element on the story page (audio play button)
12. Implement adaptive skip (detect organic audio play)
13. **Verify**

### Phase 4 — Step 3 (save highlight)
14. Build `TourStep3SaveHighlight` (extends step 1 logic)
15. Implement adaptive skip (detect organic save)
16. **Verify**

### Phase 5 — Polish & ship
17. Add `prefers-reduced-motion` handling
18. Add reduced-data / slow-network fallback (skip if API unavailable)
19. End-to-end test with a fresh account
20. Test on mobile (most CDMX traffic)
21. Add analytics events: `tour_step_started`, `tour_step_completed`, `tour_step_skipped_adaptive`, `tour_completed`

---

## Estimated Effort

- Phase 1: 0.5 day
- Phase 2: 1 day (animation polish is the long pole)
- Phase 3: 0.5 day
- Phase 4: 0.5 day
- Phase 5: 0.5 day

**Total: ~3 days of focused work.** Realistic, not 2 hours.

---

## Open Questions to Answer Before Phase 1

1. **Which word does step 1/3 auto-tap?** Options:
   - First word of the second sentence on the page (skips title)
   - A pseudo-random word in the middle of the page
   - A word the system thinks is "translatable" (filters out proper nouns, articles)
   - **Recommendation:** middle-of-the-page mid-length word, deterministic per page so it doesn't flicker on re-render
2. **What if user already has `tourCompletedAt` from a previous session but new tour steps get added later?** For now, not a concern — there's only v1. If we add step 4 later, we'd add `tourStep4CompletedAt` and treat its absence as "needs to fire" regardless of `tourCompletedAt`.
3. **Where does the audio button live structurally?** Need to confirm the DOM selector / React ref strategy for step 2.

---

## Success Metrics for the Tour

Once shipped, watch for:
- **Step completion rate:** % of new users who complete steps 1, 2, 3
- **Adaptive skip rate:** % of users who organically use a feature before the auto-trigger (high rate = users are already discovering, tour is less needed)
- **Day-2 / day-7 return rate:** compared to pre-tour cohort
- **Feature engagement rate:** % of users who tap a word, play audio, save a word in their first session (the actual proxy we care about)

If after 30 days the tour is firing but engagement isn't improving, the problem isn't discoverability — it's that the features themselves don't deliver enough value to drive return visits. That's a different problem and would change the next set of priorities.

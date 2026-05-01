# Retention Plan — April 2026

**Branch:** `retention-april2026`
**Context:** 94 users acquired via in-person bus speeches in CDMX. Most don't return after 2-20 min of first-session use. Email outreach yielded 2 replies with thin signal. Goal: improve retention *and* the feedback loop so we can learn what users actually need.

## Diagnosis

The retention drop-off is most likely a **discovery problem**, not a quality problem:
- App is designed minimalist/aesthetic; powerful features are hidden behind taps
- New users see "an English reader" and miss the magic in their first session
- Acquisition channel (bus speeches) selects for "willing to try" not "willing to commit to a reading habit"
- Sample is too small + too noisy to draw confident product conclusions

We need to (a) make the magic discoverable, (b) build a tighter feedback loop with real users, and (c) test against a self-selected audience via paid acquisition.

---

## Action Plan (ordered by sequencing, not pure priority)

### 1. Phone collection at signup ✅ DONE
- Added optional `phone` field to signup form with founder framing + privacy reassurance
- EN/ES copy: "I'm Philip, the founder. I might text you personally to ask how it's going (WhatsApp preferred). I'll never sell or share your number."
- Prisma migration `add_phone_to_user` applied to prod
- Phone visible in admin Users tab with click-to-copy pills next to email and phone
- Hard-delete script for test users at `scripts/delete-test-user.mjs`
- **Files touched:** `prisma/schema.prisma`, `src/components/auth/AuthForm.tsx`, `src/app/api/auth/signup/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/admin/upload-story/UsersManager.tsx`, `src/content/ui/{en,es}.ts`
- **Note:** This is forward-looking. Existing 94 users will not have phone numbers — only new signups will. Outreach to existing users is email-only.

### 2. Manual WhatsApp outreach (new signups going forward)
- Personal, non-templated messages from founder's WhatsApp
- Goal: extract real feedback from churned users, re-engage interested ones
- "Do things that don't scale" — this is the unfair advantage at this stage
- Mexico context: WhatsApp is the default communication channel, normal to receive a personal message
- **Existing 94 users are email-only** — phone collection started 2026-04-25, applies to new signups only

### 3. Triage queue for inactive users
- Build/use a digest of inactive users (phone if available, email if not)
- Founder triages: WhatsApp the ones with phone, decide on automated email for the rest
- **Not** an automated WhatsApp drip — point is the personal touch
- Defer building until #2 is exhausted manually

### 4. Landing page → stories page (after auth) ✅ NO CHANGE NEEDED
- **Investigation result:** existing routing is already a defensible split:
  - **New signups** → `/stories` (after onboarding/quiz). Drops them straight into reading. Maximum chance to engage with the magic.
  - **Returning users** → `/dashboard`. Stats can reinforce habit ("3-day streak, don't break it").
- Verified in `src/components/auth/AuthForm.tsx` and `src/app/api/post-login/route.ts`
- Forcing returning users to `/stories` would lose the dashboard's habit-reinforcement role. Skipping.

### 5. In-app discovery tour ✅ DONE
**Why this matters:** users churn because they see a plain reader and don't realize the language-learning features exist. Tour makes the magic discoverable.

**What shipped:**
- **Pre-tour: gold ring + "Start here" toast** on the first Cuentana original on `/stories`. Slowly rotating gold conic gradient with three bright facets, plus a trapezoidal "breathe" pulse. Lives as a real DOM child of the card so banners / side panels / detail modals at higher z-index naturally cover it (no floating-overlay logic).
- **Step 1 (first qualifying story page):** orchestrator picks the longest non-leading word in the first ≥4-word line and synthesizes a real `.click()` on it. Real selection visuals appear, the existing emoji action row fades in, then a "kids trying to time a jump together" wave runs across the row (each icon does its own jump + two diminishing dribbles, with intentionally uneven per-icon delays). Translate icon then picks up an infinite physics-y bounce loop (12px → 6px → 3px → rest, repeat) for the rest of the dwell.
- **Step 2 (second qualifying page):** listen button gets an emerald glow + scale pulse for ~6s, fires immediately on render (no dwell). No auto-activation — sudden audio playback would break trust.
- **Step 3 (third qualifying page):** same word-click + emoji wave as step 1, but the save-word icon picks up the infinite bounce as the focal feature instead of translate.
- **Adaptive skip:** organic word selection on steps 1/3, organic audio playback on step 2 — silently mark complete and don't fire.
- **Reliability:** each step's DB completion is written the moment it fires (not at the end of the visual hold), so navigating away mid-animation still advances the tour.

**Files:** `src/components/tour/TourProvider.tsx`, `src/components/tour/TourOrchestrator.tsx`, `src/components/tour/StoriesPageTourHint.tsx`, `src/components/tour/animations.ts`, `src/components/tour/useDwellTimer.ts`, `src/app/api/tour/{state,complete}/route.ts`, `src/app/globals.css`, `prisma/migrations/20260425182607_add_tour_progress_to_user/`

**Tooling:** `scripts/reset-tour.mjs` for resetting tour state on a test account during iteration.

**Deferred / not done:**
- "Re-offer if user came back without engaging" — currently once a step completes, it never re-fires. Worth revisiting if we see users completing the tour but not engaging.
- `prefers-reduced-motion` skips animations and silently completes — verified via TourProvider `disabled` flag.

### 6. Add more stories
- Genuine content gap, but **be honest about whether quantity is the bottleneck**
- Users churn at 2-20 min — they're not running out of stories, they're not finding the first one compelling
- Pair "add more" with analysis: which existing stories actually get finished? Add more of *those*.
- Ongoing background work, not a sprint

### 7. Landing page (pre-auth) — screenshots/recording first 👈 NEXT
- Currently: onboarding flow only — no explanation of what the app is before the signup wall
- Add: 2-4 screenshots + a 30-60s screen recording showing the magic interactions (tap-to-translate, audiobook, save vocab)
- Goal: filter signups so target users are over-represented (e.g., the "expected private classes" user self-selects out)
- **Why this is next, not the ad campaign:** without a real landing page, paid traffic lands on the signup wall with zero context and bounces. We'd burn the ad budget on people who couldn't tell what the app is. Static landing page is a small lift compared to the tour.
- Defer the **fully interactive story** version — significant lift (auth-less story rendering, audio, highlight state). Revisit only if static version isn't enough once we have paid traffic data.

### 8. Paid social ad campaign ($200-500)
- **Sequence: only after #7-static is live.** Don't drive paid traffic to the current funnel.
- Target intent-based audiences: "learn Spanish/English through reading," book-readers, etc.
- Goal isn't conversion — it's getting 30-50 self-selected users we can actually learn from
- Compare retention/engagement of paid cohort vs. bus-speech cohort — confirms or rules out the "acquisition channel was the problem" hypothesis

### 9. Email follow-up (de-prioritized, automated only)
- Founder's preference: dislikes broadcast email
- WhatsApp is the primary personal channel; email becomes the automated safety net for users with no phone
- Build later, after WhatsApp outreach + tour are live

---

## Deferred / Not doing now

### End-of-page quizzes
- Idea: 2-4 vocab questions at end of pages
- **Punted:** quizzes serve learning outcomes, not retention. Users who churn at 2-20 min haven't reached the question of "am I learning." Quizzes also add friction to the reading flow — the thing we want users addicted to.
- Revisit when engaged users *pull* this feature from us. Don't push it.

### Fully interactive landing page story
- Significant lift, blocked on knowing whether simpler landing page changes are enough
- v2 once we have paid traffic data

---

## Open questions / things to figure out

- **Local dev DB**: `.env` currently points at prod. Already have a dev DB in another worktree. Need to swap `.env` to dev URL and keep prod URL stashed safely (1Password / `.env.prod`). Run migration against dev to keep schemas in sync. *Deferred to a later session.*
- **Story finish-rate analytics**: do we already track which stories users finish vs. abandon? If not, add basic analytics before deciding what stories to add.
- **Tour engagement metrics**: now that the tour is shipped, watch for adaptive-skip rate vs. auto-trigger rate. High adaptive-skip (users discovering organically before the tour fires) means we don't need the tour. Low adaptive-skip + low feature engagement after step 1 means the tour isn't enough — features themselves may be the bottleneck.

---

## Success metrics

Before/after for each cohort change:
- Day-2 return rate
- Day-7 return rate
- Median session length on first 3 sessions
- % of users who tap a word / use audio / save a word in first session (proxy for "discovered the magic")
- Qualitative: how many users we successfully WhatsApp-converse with about why they stayed/left

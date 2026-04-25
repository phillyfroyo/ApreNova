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
- **Files touched:** `prisma/schema.prisma`, `src/components/auth/AuthForm.tsx`, `src/app/api/auth/signup/route.ts`, `src/content/ui/{en,es}.ts`

### 2. Manual WhatsApp outreach to existing 94 users
- Personal, non-templated messages from founder's WhatsApp
- Goal: extract real feedback from churned users, re-engage interested ones
- "Do things that don't scale" — this is the unfair advantage at this stage
- Mexico context: WhatsApp is the default communication channel, normal to receive a personal message

### 3. Triage queue for inactive users
- Build/use a digest of inactive users (phone if available, email if not)
- Founder triages: WhatsApp the ones with phone, decide on automated email for the rest
- **Not** an automated WhatsApp drip — point is the personal touch
- Defer building until #2 is exhausted manually

### 4. Landing page → stories page (after auth)
- Currently: dashboard with stats + quick actions
- Change: take authenticated users straight to stories
- Job-to-be-done on app open is "read" — get them there in zero clicks
- Quick win, low risk

### 5. In-app onboarding tour (the big one)
**Why this matters:** users churn because they see a plain reader and don't realize the language-learning features exist. Tour makes the magic discoverable.

**Design principles:**
- **Short.** ~10 seconds, one "wow" interaction. Not a 30-second feature parade.
- **Coachmarks, not modals.** Tooltips anchored to real UI elements inside a real story. Avoid full-screen tour overlays.
- **Drop into a real story first.** Let user read 1-2 sentences, then interrupt with one specific magical interaction (e.g., "tap any word").
- **Skippable but recoverable.** First-skip should not be permanent — if user returns without engaging features, offer again.
- **One feature highlighted, the rest discovered via a persistent "?" affordance.**

**Pre-work (before building):** List the 3 features that hook users.
- Likely candidates: (a) tap-to-translate/listen on words, (b) audio sync read-along, (c) saved words / vocab review
- Validate with engaged users (1:1 tutoring students, founder's own usage) — the tour should highlight what *actually* causes return visits, not what we hope causes them

**Effort:** 1-3 days for a proper implementation with anchoring, skip state, i18n. Not a 2-hour task.

**State to track:**
- `tourSeen: boolean`
- `tourSkipped: boolean`
- Persisted on user record so a returning user on a different device doesn't re-see it

### 6. Add more stories
- Genuine content gap, but **be honest about whether quantity is the bottleneck**
- Users churn at 2-20 min — they're not running out of stories, they're not finding the first one compelling
- Pair "add more" with analysis: which existing stories actually get finished? Add more of *those*.
- Ongoing background work, not a sprint

### 7. Landing page (pre-auth) — screenshots/recording first
- Currently: onboarding flow only
- Add: 2-4 screenshots + a 30-60s screen recording showing the magic interactions
- Goal: filter signups so target users are over-represented (e.g., the "expected private classes" user self-selects out)
- Defer the **fully interactive story** version — significant lift (auth-less story rendering, audio, highlight state). Revisit only if static version isn't enough once we have paid traffic data.

### 8. Paid social ad campaign ($200-500)
- **Sequence: only after #1, #4, #5, #7-static are live.** Don't drive paid traffic to the current funnel.
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
- **Tour content**: which 3 features does the tour highlight? Confirm with engaged users before building.
- **Story finish-rate analytics**: do we already track which stories users finish vs. abandon? If not, add basic analytics before deciding what stories to add.

---

## Success metrics

Before/after for each cohort change:
- Day-2 return rate
- Day-7 return rate
- Median session length on first 3 sessions
- % of users who tap a word / use audio / save a word in first session (proxy for "discovered the magic")
- Qualitative: how many users we successfully WhatsApp-converse with about why they stayed/left

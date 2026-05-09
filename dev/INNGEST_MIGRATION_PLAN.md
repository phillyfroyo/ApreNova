# Inngest Migration — User Story Pipeline

Living plan for moving the user-uploaded story processing pipeline off
Vercel's HTTP request lifecycle and onto Inngest. Carries state across
sessions.

## Why

Long user-uploaded stories fail to process today because the existing
pipeline runs inline inside `POST /api/user-stories/process`. Vercel
caps function execution at 10s on Hobby and 300s on Pro. A long story
with multiple levels can take 10–30+ minutes — way past either cap.

Upgrading Vercel doesn't fix this; it only delays the wall. The right
architecture is a background-job system where the HTTP route enqueues
work and returns immediately, and a worker grinds through the pipeline
across many short invocations.

We chose **Inngest** because:
- Workers run on Vercel itself as chained short invocations — no new
  hosting platform to manage
- Built-in retries, dead-letter queue, observability dashboard
- Free tier covers ~50,000 step runs/month (we need ~3,000 at current
  scale, ~150,000 at 10k users)
- TypeScript SDK with a `step.run()` model that maps cleanly onto our
  per-chapter LLM workflow

## Phases

### Phase 1 — Inngest infrastructure ✅ Done (2026-05-07)

- Created Inngest app + got event/signing keys
- Installed `inngest` v4 SDK
- Added `src/lib/inngest/client.ts`
- Added `src/app/api/inngest/route.ts` (webhook handler at `/api/inngest`)
- Added a `hello-world` smoke-test function
- Added `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Vercel
  (Production + Preview)
- Synced the app from Inngest dashboard → manually fired
  `test/hello-world` → confirmed end-to-end round trip

Commit: `f2f24cd`

### Phase 2 — Build the orchestrator ✅ Done (2026-05-07)

Originally planned as 2a (whole-level steps) → 2b (per-chapter
slicing). Collapsed into one commit since per-chapter slicing was
needed before ship anyway.

- New file `src/lib/inngest/functions/process-user-story.ts` —
  orchestrator function triggered by event `user-story/process`
- Refactored `src/lib/user-stories/level-processor.ts` to extract
  per-chapter translate logic into exported
  `translateAndStoreSingleChapter()`. Existing `translateLevelChapters()`
  now calls it in a loop — behavior unchanged for the legacy code path.
- Exported the previously-internal `rewriteChapterWithChunking()`
- Added `rewriteCache?: Record<string, string>` field to
  `ProcessingProgress` in `progress-tracker.ts` so the rewrite step can
  stage rewritten chapter text for the translate step to pick up in a
  later invocation

The orchestrator's step structure for a typical 5-chapter, 2-level
story:

| Step | Count | Notes |
|---|---|---|
| `detect-language` | 1 | |
| `generate-metadata` | 1 | Skipped if title/desc already set |
| `detect-level` | 1 | Falls back to B1 if detection junk |
| `detect-story-type` | 1 | Skipped if already set |
| `prepare-levels` | 1 | Determines which levels, creates missing rows |
| `parse-chapters` | 1 | |
| `rewrite-{level}-ch{N}` | N per non-detected level | Skipped for detected level |
| `translate-{level}-ch{N}` | N per level | |
| `build-{level}` | 1 per level | |
| `finalize` | 1 | |

Each step is one LLM call + DB writes — well within Vercel's 60s Hobby
cap.

Concurrency: per-user limit of 3 stories simultaneously
(`concurrency: { key: 'event.data.userId', limit: 3 }`).

Cancellation: `isStoryCancelled()` checked between every chapter and
between every level. Same fidelity as the existing pipeline.

Commit: `de815d6`

### Phase 3 — Cutover ✅ Code shipped, awaits e2e test

- One-line swap in `src/app/api/user-stories/process/route.ts`:
  `processUserStory(storyId).catch(...)` → `await inngest.send({...})`
- `processUserStory()` left exported as a fallback for ad-hoc
  reprocessing scripts. No prod code calls it anymore.

Commit: `b931b48`

**Pending verification:** end-to-end test on the preview deploy. See
"Open work" below.

### Phase 4 — Validate and clean up

Not started. Concrete checklist:

- [ ] After Phase 3 e2e tests pass, decide whether to delete
      `processUserStory()` or document/keep
- [ ] Document the new architecture in `dev/CLAUDE.md` (add a section
      next to the existing translation pipeline architecture notes)
- [ ] Confirm `META_TEST_EVENT_CODE` is **not** set in Vercel
      Production (separate concern, not Inngest-related but worth a
      pre-merge sweep)
- [ ] Add the streaming-parallelism back if wall-clock time regresses
      meaningfully (rewrite chapter N+1 in parallel with translate
      chapter N — currently sequential per level)
- [ ] Merge `inngest-story-pipeline` to `main`

## Architecture

The DB is the state machine. Each step reads inputs from the DB and
writes outputs back. Step return values are kept small (just
identifiers and status flags) — actual content lives on `UserStory`
and `UserStoryLevel` rows.

Per-chapter rewritten text is staged in
`UserStoryLevel.processingProgress.rewriteCache` (a
`Record<string, string>` keyed by 0-indexed chapter number) so the
translate step can pick it up in a later invocation. This is read in
`translateChapterStep` and written in `mergeRewriteCache` — both in
`process-user-story.ts`.

The frontend doesn't change. It already polls
`/api/user-stories/{id}/status` to track progress, and the orchestrator
writes progress to the same DB fields the existing UI reads.
Cancellation also unchanged (frontend POSTs to `/cancel`, the cancel
flag propagates).

## Open work / known gaps

- **Streaming parallelism lost.** The legacy `processLevelStreaming`
  ran rewrite chapter N+1 in parallel with translate chapter N for
  ~50% wall-clock savings. Current Inngest version runs them
  sequentially within a level. Across levels they can run concurrently
  via Inngest, but within a level it's serial. Phase 4 will add this
  back if needed.

- **Vercel deployment protection** is currently disabled (turned off
  during Phase 1 testing so Inngest could reach the preview URL).
  Worth re-enabling on production, but only after we're confident the
  Inngest sync survives the protection wall (it should, but verify).

- **Inngest sync is to a specific preview URL.** Each new preview
  build produces a new URL with a different hash; Inngest keeps firing
  against the originally synced URL until re-synced. For testing, this
  means re-syncing after each push. Not a problem once we merge to
  main and Vercel picks the production URL.

## How to test

1. Push to `inngest-story-pipeline` → Vercel auto-builds preview
2. Get the preview URL from Vercel → Deployments
3. Inngest dashboard → Apps → `cuentana` → re-sync to the new preview
   URL (or delete + re-sync)
4. Visit the preview URL, log in, upload a short test story
5. Watch:
   - Inngest dashboard → Functions → `process-user-story` for a new
     run with all per-chapter steps
   - The story in the app — should hit READY status within a minute
6. Then test a longer story (3,000–5,000 words) that would have
   failed under the old pipeline

Debugging info to grab if a run fails:
- Inngest run details (which step failed, error message)
- Vercel runtime logs around `/api/inngest`
- The story ID

## Future scope: chapter audio generation

Long chapters fail to generate audio in production for the same reason
long stories fail to upload — Azure Speech + R2 upload runs inside a
single HTTP request that exceeds Vercel's per-invocation cap. This
migration will need a second pass for the chapter audio generation
pipeline, using the same Inngest pattern.

Step boundaries will likely be one Inngest step per line (or per small
batch of lines): generate TTS via Azure → upload mp3 to R2 → write
metadata to DB. The cancellation, progress-tracking, and per-step
retry stories all carry over.

### Cleanups to bundle while we're touching these flows

**Story upload:**
- Loading % indicator can exceed 100% mid-upload. 100% should be
  a hard ceiling; clamp the displayed value.
- Mobile view of the upload flow needs polish, especially the
  success modal — currently doesn't lay out cleanly on small screens.

**Chapter audio generation:**
- Allow collapsing the loading modal so users can navigate the app
  while audio generates in the background — same pattern as story
  upload's collapsible loader. Higher value here than for upload
  because users want to *read* while audio renders, rather than
  staring at a spinner.
- Add a bilingual mode for the non-audiobook story view, mirroring
  the existing audiobook bilingual mode. Add a `EN + ES` toggle
  button at the top of the story page next to "Listen". Should be
  small — the bilingual rendering logic already exists in the
  audiobook codepath.

## Cost tracking

Free tier: 50,000 step runs/month. At 98 users with light upload
usage, expect ~3,000/month — easily covered. Tier 1 paid is $20/mo for
100k. We won't need to upgrade until ~10k active users.

## Decisions made

- Inngest > Trigger.dev > roll-our-own — Inngest's `step.run` model
  fits chained AI workflows; same hosting (Vercel)
- Per-chapter steps from day one (not whole-level) — known to be
  needed for long stories, sequential refactor would've been wasted
  work
- Keep `processUserStory()` exported through Phase 3 — fallback if
  Inngest path has issues, decide in Phase 4 whether to delete
- DB is the state machine, not Inngest event payloads — keeps step
  return values small, aligns with how `processingProgress` already
  works
- Sync manually instead of via the Vercel marketplace integration —
  the marketplace install hung twice during Phase 1; manual sync
  worked instantly

## File map

New:
- `src/lib/inngest/client.ts`
- `src/lib/inngest/functions/hello-world.ts`
- `src/lib/inngest/functions/process-user-story.ts`
- `src/app/api/inngest/route.ts`

Modified:
- `src/app/api/user-stories/process/route.ts` (swap to inngest.send)
- `src/lib/user-stories/level-processor.ts` (extract per-chapter
  helper, export rewriteChapterWithChunking)
- `src/lib/user-stories/progress-tracker.ts` (add rewriteCache field)

Untouched:
- `src/lib/user-stories/pipeline.ts` (`processUserStory` still
  exported, no callers in prod)
- All frontend code
- `/api/user-stories/{id}/status`, `/cancel` routes

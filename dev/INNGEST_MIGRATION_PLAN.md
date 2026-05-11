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

## Resolved: Start Reading button disables when its level finishes

**Root cause:** the widget's gate condition required
`levelStatus === "PROCESSING"` AND at least one completed chapter. The
moment a level transitioned to `READY`, that gate failed and the
button disabled — even though the chapters were still readable. The
intent was "show this button only while a level is still processing,"
but in a multi-level upload one level finishes well before the other
and the user is stuck without a way to read the completed level.

Diagnosed via `[FlickerDebug]` console logs that captured the exact
poll where B2 transitioned `PROCESSING → READY` with same
`completedDataLen=2`, and `originalReady` flipped `true → false` in
the widget render that followed.

**Fix:** dropped the `levelStatus === "PROCESSING"` requirement.
A stream is now ready to read whenever it has at least one completed
chapter, regardless of whether the level is still processing or
finished. (`FloatingProgressWidget.tsx`, `originalReady`/
`rewrittenReady` logic.) The widget itself is hidden when
`progress.stage === "complete"` — the post-upload `SuccessBanner`
takes over at that point — so this doesn't cause buttons to hang
around forever.

## Open work / known gaps

- **Two-axis parallelism shipped.** Levels run concurrently, chapters
  within a level also fan out in parallel for both rewrite and
  translate phases. Concurrent JSON column writes are safe because the
  per-chapter writes go through atomic `jsonb_set`-based methods on
  `LevelProgressTracker` (`updateChapterContentAtomic`,
  `updateTranslationProgressAtomic`, `updateRewriteProgressAtomic`).
  These methods replace the legacy read-modify-write equivalents in
  the Inngest path. The legacy methods stay for ad-hoc reprocessing
  scripts that still call `processUserStory()` directly.

  Inngest free-tier function concurrency is capped at 5, so 5 chapter
  steps are in flight at any moment across both levels. For a typical
  14-chapter, 2-level upload that previously took 22-25 min, this
  should drop to roughly 9-12 min in practice.

  Side effect: the per-chapter `completedData` and `rewriteData` are
  now **objects keyed by 0-indexed chapter number** instead of arrays.
  Reason: Postgres `jsonb_set` with an out-of-bounds array index
  appends and *ignores* the index (documented behavior), so parallel
  per-chapter writes to an array silently lost data — chapters
  finishing out of order would either append (extending the array but
  to the wrong slot) or replace whichever slot already existed at the
  array's current length. We confirmed this experimentally by tracing
  rewriteData state across writes. Object-keyed `jsonb_set` updates
  are safe under parallel writes because each updates a distinct path.

  Consumers normalize either shape (legacy array, Inngest object) via
  `chapterMapToArray` and `chapterMapCount` exported from
  `progress-tracker.ts`. The legacy in-process pipeline still writes
  array shape; both shapes are supported indefinitely.

- **Rewrite output: chapter headers merging into first paragraph
  (PRE-EXISTING, not migration-caused).** Observed on a Hemingway
  novel (*A Farewell to Arms*) C1→A1 upload, both in the rendered
  story page and the comparison modal. The A1 rewrite writes
  `CAPÍTULO I En agosto, vivimos en una casa...` as a single first
  paragraph, instead of the title sitting on its own line above a
  blank line above the body the way the C1 original does.

  Diagnosis: the story is being detected as `storyType: "epic"`
  (visible in the rendered page header showing "Canto 1, Section 1"
  navigation labels). When `storyType === 'epic'`, the rewrite step
  sets `isPoetry = true` and routes through `rewritePoetryChapter()`,
  which uses poem/stanza marker preservation — NOT the prose
  paragraph-marker system (`splitPreservingSpacing` +
  `[P1] [P2]` markers + `reassembleWithSpacing`) in
  `src/lib/story-processing/rewriting.ts:201-340`. The prose path
  preserves structure correctly; the poetry path doesn't preserve
  chapter headers.

  Two underlying bugs, both in shared code outside the migration:
  1. `detectStoryType` is misclassifying long prose as `epic`. Look
     at `src/lib/user-stories/metadata.ts:193` and the prompt it
     uses.
  2. The poetry rewrite path doesn't preserve chapter-header lines.
     `rewritePoetryChapter` in `src/lib/story-processing/rewriting.ts:698`.

  Both would fire on `main` too — they just never showed up because
  long stories failed to complete under the legacy pipeline. Both are
  out of scope for this branch but block the migration's main-branch
  merge from a quality standpoint.

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

## Chapter audio generation migration ✅ Done (2026-05-11, branch: inngest-audio-pipeline)

Long chapters were failing in production for the same reason long
stories used to — Azure Speech synthesis + forced alignment + R2
upload exceed Vercel's per-invocation cap. On Hobby with Fluid
Compute the wall is **300 seconds**; Gatsby-length bilingual chapters
take ~12 minutes, failing at exactly the 5-min mark.

**Verified working:**
- Cache hit: inline (no Inngest), ~instant
- Short uncached chapter (1 chunk): 53s total
- Long bilingual Gatsby chapter: **11m 9s, 10 sequential chunks, all
  steps under 1:30**. Previously failed at 5min with zero output.

**One bug found during testing**: the frontend was fetching
`.meta.json` directly from R2, which CORS-blocks because the bucket
isn't configured for browser cross-origin reads. Fixed by inlining
the metadata in the status endpoint response. See the resolved CORS
note below.

The migration mirrors the user-story pattern but with audio-specific
differences:

- **`AudioGenerationJob` table** is the state machine. The HTTP route
  creates a row, fires `audio/chapter.generate`, and returns 202 with
  a jobId. The frontend polls `/api/azure-tts/chapter/status?jobId=X`
  every 3s.
- **Cache check stays inline** in `POST /api/azure-tts/chapter`. An
  R2 cache hit returns the URL directly without going through Inngest.
- **Concurrent same-request dedup**: before creating a new job, the
  route looks for an existing QUEUED/PROCESSING job for the same
  `(storySlug, level, chapter, mode, speed)` and returns its jobId
  if found. Multiple users polling the same job is fine.
- **Per-chunk steps**: each chunk runs a `chunk-N` step that
  synthesizes MP3+WAV in parallel, runs forced alignment, uploads the
  MP3 part to a temporary R2 key. Chunks process **sequentially** to
  avoid Azure rate limits.
- **Part-file assembly**: per-chunk MP3s live in R2 as
  `{cacheKey}.part-{N}.mp3`. The final `assemble` step downloads them
  all, concatenates, builds metadata, uploads to the canonical R2
  audio + meta keys, deletes the part files.
- **No streaming UX**: the old NDJSON progress stream is gone.
  Replaced with polling. Existing simulated-progress animation in
  `useChapterAudio` fills the gap between poll responses.
- **Metadata served via status endpoint, not direct R2 fetch**: R2
  doesn't have CORS configured for browser cross-origin reads, so the
  status endpoint server-side-fetches the metadata blob via
  `cache.getChapterCached()` and inlines it in the response. Caught
  this during first test.
- **Free win**: if the user closes the tab mid-generation, Inngest
  keeps grinding and the result lands in R2 cache for the next caller.
  Previously the work died when the HTTP stream consumer disconnected.

Step boundaries:
1. `prepare` — load content, build plan, chunk, write totals to job
2. `chunk-N` × N — synthesize + align one chunk, upload part to R2,
   update progress
3. `assemble` — download parts, concatenate, build metadata, upload
   canonical R2 audio + meta, mark COMPLETE, delete parts
4. `onFailure` handler marks job FAILED so client doesn't hang

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

## Future work to be done

Tracked-but-deferred items from across both migrations. None of
these block shipping; they're for when we have spare cycles or when
user complaints surface.

### Parallelism for chapter audio chunks

Audio generation today runs chunks sequentially within a chapter.
A 10-chunk Gatsby chapter is ~11 minutes wall-clock. Parallelizing
chunks (Promise.all + bump `concurrency: { scope: 'fn', limit }` from
5 to something higher) could cut that to ~3-4 minutes for the same
chapter.

Trade-off: parallel Azure Speech + Pronunciation Assessment calls
can hit Azure rate limits, especially for bilingual chapters which
already do dual synthesis + dual PA per chunk. Sequential was the
deliberate choice during the initial migration.

**When to do it**: when users start complaining about audio wait
times, or when our Azure quota grows enough to absorb ~5x peak
concurrent synthesis calls. Estimated 30-60 min of work plus rate-
limit testing.

### Story upload: rewrite folds chapter title into first paragraph

Pre-existing bug surfaced by the Inngest migration (long stories
finally complete, so the bug is finally visible). Discovered on a
14-chapter / 25k-word C1→A1 upload of *A Farewell to Arms*.

Root cause (per the diagnosis in this doc's "Open work" section):
the story is being detected as `storyType: "epic"` (visible in
"Canto 1, Section 1" navigation labels), which routes the rewrite
through `rewritePoetryChapter()` instead of the prose path's
paragraph-marker preservation. The poetry path doesn't preserve
chapter-header lines.

Two underlying bugs:
1. `detectStoryType` is misclassifying long prose novels as `epic`.
   See `src/lib/user-stories/metadata.ts` and the prompt it uses.
2. The poetry rewrite path doesn't preserve chapter-header lines.
   See `rewritePoetryChapter` in
   `src/lib/story-processing/rewriting.ts:698`.

Both are pre-existing — they exist on `main` and would fire today
on any uploaded prose long enough to be misclassified. Fixing
either independently helps; fixing both is the complete answer.

### Audio job cleanup (orphaned part files)

If an Inngest run fails mid-chapter (after some chunks have uploaded
their MP3 parts to R2 but before `assemble` runs), the part files
stay in R2 forever costing storage. The `onFailure` handler currently
marks the job FAILED but doesn't sweep parts.

Low impact at our scale — part files are ~1-5MB each and failures
are rare. Worth a scheduled cleanup job (Inngest's cron support) at
some point: scan for FAILED jobs older than 24h, delete their parts.

### Chapter-parallelism within a story-upload level

Documented earlier in this doc. Atomic-jsonb-set methods on
`LevelProgressTracker` could enable parallel chapter processing
within a level. Currently sequential within a level, parallel across
levels.

Estimated 2-3 hours including test cases. Defer until story uploads
are slow enough to justify the work. Today's level-parallel + dual
levels concurrent setup hits ~17 min for a 25k-word story, which is
acceptable.

### Vercel deployment protection on production

Currently disabled (turned off in Phase 1 of the user-story
migration so Inngest could reach preview URLs for testing). Worth
re-enabling on production now that Inngest is synced via dev/prod
environments and the keys are stable. Inngest's signed webhook calls
authenticate independently of Vercel auth, so this should be safe to
turn back on.

### Periodic audio cache pre-warm

Today, every chapter audio is generated on first request — the
listener waits ~11 minutes for the first listen of a long chapter.
A Phase 4-ish project: pre-bake audio for high-traffic chapters via
a scheduled Inngest cron, so users always get a cache hit. Cheap to
build (re-use the same `audio/chapter.generate` event); expensive to
operate (lots of Azure spend for chapters nobody actually listens
to). Defer until we have usage data to target the pre-warm.

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

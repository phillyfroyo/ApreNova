# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## CRITICAL: Commercial-Grade Architecture Standards

**This is a commercial application. Every edit, feature, and restructure must follow industry best practices.**

### Before Writing Code, Always:

1. **Identify the Single Source of Truth** - Before implementing any feature, ask: "Where is the canonical implementation for this logic?" If it exists, use it. If it doesn't, create one in a dedicated module.

2. **Check for Shared Pipelines** - Many features in this app are shared between user and admin portals. Before modifying backend logic, verify which entry points consume it.

3. **Avoid Logic Fragmentation** - Never duplicate transformation logic across files. If the same algorithm runs in multiple places, consolidate it into one module and have others import from there.

4. **Enforce Data Contracts** - Use TypeScript interfaces as contracts between modules. Define canonical types in one place (e.g., `types.ts`) and import everywhere.

5. **Keep Files Under 400 Lines** - Files over 400 lines become hard to debug. When approaching this limit, split into logical sub-modules with clear responsibilities.

6. **Use Barrel Exports** - Create `index.ts` files that export public APIs. This makes refactoring easier and keeps imports clean.

### Anti-Patterns to Avoid:

- **Scattered Detection Logic** - Example: We had stanza detection in 6+ places (text-preprocessor, level-processor, rewriting, text-processing, etc.). Now consolidated in `src/lib/poem-processing/`.

- **Implicit Dependencies** - If Module A transforms data that Module B expects in a certain format, make that contract explicit with shared types.

- **Deep Nesting Without Contracts** - Multi-stage pipelines (parse → detect → rewrite → translate → build) need clear interfaces between each stage.

### Key Shared Modules:

| Module | Purpose | Used By |
|--------|---------|---------|
| `src/lib/text-processing/` | **SINGLE SOURCE OF TRUTH** for all text processing | Admin uploads, User uploads, Dev Tools |
| `src/lib/poem-processing/` | Canonical stanza detection | User pipeline, Admin pipeline, Rewriting |
| `src/lib/story-processing/` | Detection, translation, rewriting, content building | Both portals |
| `src/lib/user-stories/` | User upload orchestration | User portal API routes |
| `src/lib/admin/` | Admin upload orchestration | Admin portal API routes |

### Translation Pipeline Architecture (CRITICAL):

**The admin and user pipelines SHARE translation logic. Do NOT create parallel implementations.**

```
SHARED (src/lib/story-processing/):
  translation.ts        → translateChapter()  — chunking + translate + align + clean
                        → translateText()     — low-level line-numbered translation
  translation-utils.ts  → alignLeadingBlanks(), addLineNumbers(), parseNumberedLines()
  processing-config.ts  → splitChapterForTranslation(), TRANSLATION_SUB_CHUNK_CHARS

USER PIPELINE (src/lib/user-stories/level-processor.ts):
  translateLevelChapters()     → calls translateChapter() from shared module
  translateChaptersConsumer()  → calls translateChapter() from shared module

ADMIN PIPELINE (src/app/admin/upload-story/hooks/useTranslationPipeline.ts):
  translateChunk()     → calls /api/admin/translate (HTTP) → translateText()
  alignLeadingBlanks() → imported from shared translation-utils.ts
  cleanText()          → imported from shared text-utils.ts
```

**Rules:**
- `translateChapter()` is the single source of truth for chapter-level translation
- User pipeline calls it directly (server-side)
- Admin pipeline calls `translateText()` via HTTP API, then applies `alignLeadingBlanks()` + `cleanText()` client-side (same steps, same shared functions)
- NEVER add translation post-processing (alignment, cleaning, blank-line filtering) to pipeline-specific code — put it in the shared module
- Files in `src/lib/story-processing/` are marked with `⚠️ SHARED MODULE` headers

### User Story Pipeline runs on Inngest (CRITICAL):

**User-uploaded stories are processed by Inngest, not inline inside the HTTP request.**

`POST /api/user-stories/process` calls `inngest.send({ name: "user-story/process", data: { storyId, userId } })` and returns immediately. The actual processing (detect language → metadata → level → parse chapters → rewrite → translate → build) runs as a chain of Inngest steps, each of which is its own short Vercel invocation.

```
ENTRY POINT:
  src/app/api/user-stories/process/route.ts
    → inngest.send("user-story/process", { storyId, userId })

ORCHESTRATOR:
  src/lib/inngest/functions/process-user-story.ts
    → processUserStoryFn (Inngest function)
    → fans out per-chapter and per-level steps

WEBHOOK (Inngest cloud → Vercel):
  src/app/api/inngest/route.ts
    → registers all Inngest functions

SHARED PIPELINE LOGIC (unchanged, called from inside steps):
  src/lib/user-stories/level-processor.ts
    → rewriteChapterWithChunking() — used by rewrite step
    → translateAndStoreSingleChapter() — used by translate step
    → buildAndSaveLevel() — used by build step
  src/lib/user-stories/progress-tracker.ts
    → LevelProgressTracker (level lifecycle: startProcessing/Translating, etc.)
    → updateStoryProgress() — story-wide progress writes
```

**Rules:**
- The DB is the state machine. Inngest events carry only `{ storyId, userId }`. Each step reads inputs from the DB and writes outputs back. Step return values are kept small.
- Per-chapter rewritten text is staged in `UserStoryLevel.processingProgress.rewriteCache` (a `Record<string, string>` keyed by 0-indexed chapter number). Written by the rewrite step via atomic `jsonb_set`, read by the translate step.
- `LevelProgressTracker` lifecycle methods (`startProcessing`, `startRewriting`, `startTranslating`) MUST be called from a one-time `begin-{level}` step, NOT from per-chapter steps. They write resets to `processingProgress` that race the per-chapter updates and cause front-end flicker.
- Levels run in parallel (via `Promise.all` over level tasks). Chapters within a level run sequentially because the existing tracker methods do read-modify-write on shared JSON columns and aren't safe under parallel chapter writes. Adding chapter-parallelism within a level requires atomic `jsonb_set` variants of the tracker methods — documented as deferred work in `dev/INNGEST_MIGRATION_PLAN.md`.
- The legacy `processUserStory()` in `src/lib/user-stories/pipeline.ts` is still exported but no longer called from production code paths. Kept as fallback for ad-hoc reprocessing scripts.
- Cancellation: the existing `cancelledAt` flag still works. Each step calls `isStoryCancelled(storyId)` between phases and exits cleanly via `StoryCancelledError`.
- Frontend doesn't change. It polls `/api/user-stories/{id}/status` and reads progress from the same DB fields the orchestrator writes.

### Chapter Audio Generation runs on Inngest (CRITICAL):

**Chapter audio generation is processed by Inngest, not inline inside the HTTP request.**

`POST /api/azure-tts/chapter` either returns the cached audio URL inline (R2 cache hit) or creates an `AudioGenerationJob` row, fires `audio/chapter.generate`, and returns `202 + { jobId }`. The client polls `/api/azure-tts/chapter/status?jobId=X` for progress and the final URL.

```
ENTRY POINT:
  src/app/api/azure-tts/chapter/route.ts
    → cache check → return inline if hit
    → otherwise: create AudioGenerationJob, inngest.send("audio/chapter.generate")

ORCHESTRATOR:
  src/lib/inngest/functions/process-chapter-audio.ts
    → processChapterAudioFn (Inngest function)
    → prepare → chunk-N (sequential) → assemble

STATUS ENDPOINT (polled by client):
  src/app/api/azure-tts/chapter/status/route.ts

SHARED PIPELINE LOGIC (reused inside Inngest steps):
  src/lib/chapter-audio.ts
    → planAndChunkChapter() — load content, build plan, chunk
    → generateChunkAudio() — synthesize MP3+WAV, run forced alignment
    → generateChapterAudio() — legacy synchronous version, still exported
  src/lib/tts-cache.ts
    → saveChapterAudio / getChapterCached — canonical R2 storage
    → saveChapterAudioPart / getChapterAudioPart / deleteChapterAudioParts
      — temporary R2 part files used between Inngest steps
```

**Rules:**
- `AudioGenerationJob` is the state machine. The job row carries progress, intermediate chunk metadata (in the `chunkData` JSON field), and the final `audioUrl`. Chunks live in R2 as temporary part files (`{cacheKey}.part-{N}.mp3`), deleted by the assemble step on success.
- **Chunks run sequentially**, not in parallel. Azure Speech rate limits are easy to hit when both synthesis and forced-alignment fire concurrently; sequential keeps the quota safe.
- **De-duplicate concurrent requests** for the same `(storySlug, level, chapter, mode, speed)` by looking up existing `QUEUED` / `PROCESSING` jobs before creating a new one. Multiple callers poll the same job.
- **The cache check stays inline** in the HTTP route. The streaming NDJSON UX is gone; clients always either get an immediate cached URL or a jobId to poll.
- **`onFailure` handler** on the Inngest function marks the job FAILED so the polling client sees an error instead of hanging.
- The legacy `generateChapterAudio()` is still exported for ad-hoc scripts and the (no-longer-used) synchronous path. It calls the same `planAndChunkChapter` + `generateChunkAudio` helpers.

---

## CRITICAL: Dev Tools Must Use Production Algorithms

**The Admin Dev Tools (SU TP Algorithms testing system) must use 100% the same code as the production upload pipelines.**

### Why This Matters:
- Dev Tools exist to test and validate the **actual algorithms** that will process user uploads
- If Dev Tools use different code, testing is meaningless - you're testing code that won't run in production
- This has caused bugs before: separate `countPoems()` implementations gave different results

### The Rule:
1. **NEVER write new algorithm functions specifically for Dev Tools**
2. **ALWAYS import from the unified `src/lib/text-processing/` module**
3. **If an algorithm doesn't exist for Dev Tools to use, add it to the shared module first**

### Architecture:
```
src/lib/text-processing/           ← SINGLE SOURCE OF TRUTH
├── index.ts                        ← Main entry: processText()
├── file-extractors/                ← HTML, RTF, TXT, MD extraction
├── content-processors/             ← Anthology, Prose, Epic, Script processing
│   └── anthology-processor.ts      ← Re-exports countPoems from shared
└── shared/
    ├── poem-detection.ts           ← detectPoemBoundaries(), countPoems()
    ├── chapter-detection.ts        ← Chapter/section boundary detection
    ├── whitespace.ts               ← Line break handling
    └── cleanup.ts                  ← Footnotes, line numbers, etc.
```

### Consumers (All Use Same Code):
1. **Admin Upload Pipeline** - `src/app/admin/upload-story/`
2. **User Upload Pipeline** - `src/components/user-stories/UploadStoryModal.tsx`
3. **Dev Tools** - `src/app/admin/upload-story/components/dev-tools/`

### Example - Wrong vs Right:

**WRONG** (creates untested code path):
```typescript
// In AlgorithmResultViewer.tsx
function countPoemsForDevTools(text: string) {
  // Custom implementation just for Dev Tools
  return text.split('\n').filter(isPoemTitle).length;
}
```

**RIGHT** (uses production algorithm):
```typescript
// In AlgorithmResultViewer.tsx
import { countPoems } from "@/lib/text-processing";
// Uses exact same algorithm as production uploads
const poemCount = countPoems(chapterText);
```

---

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application (includes `prisma generate`)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Database Commands

- `npx prisma generate` - Generate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database
- `npx prisma studio` - Open Prisma Studio database browser

## High-Level Architecture

This is a **Next.js 15** language learning application called "my-aprenova" with the following core architecture:

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google, Facebook, and credentials providers
- **Styling**: Tailwind CSS with custom themes
- **Language**: TypeScript
- **Audio**: HTML5 Audio API with custom progress controls
- **Payment**: Stripe integration for premium subscriptions

### Core Architecture Patterns

**Story-Based Learning System**:
- Stories organized by slug → level → chapter → page hierarchy
- Content files stored as TypeScript exports in `src/content/[storySlug]/[level]/ch[chapter]/page-[page].[lang].ts`
- Audio files organized in `public/audio/[storySlug]/[level]/ch[chapter]/page-[page]/line[N].mp3`
- Dynamic routing: `/[lng]/stories/[storySlug]/[level]/[chapter]/[page]`

**Internationalization (i18n)**:
- Bilingual support (English/Spanish) with URL-based locale detection
- Translation system via `src/lib/t.ts` with content files in `src/content/ui/[lang].ts`
- Story content includes both English and Spanish text per line

**Premium/Freemium Model**:
- User authentication with premium status tracking
- Story access control based on `isPremiumOnly` flags
- Translation features: "free" (show/hide) vs "premium" (AI-powered via OpenAI)

**Audio System**:
- Sentence-level audio playback with normal and slow speed variants
- Custom audio progress bars with drag-to-seek functionality
- Fallback to speech synthesis if audio files missing

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable React components including UI system
- `src/content/` - Story content files and UI translations
- `src/lib/` - Utility functions, auth configuration, database client
- `src/hooks/` - Custom React hooks for session logging, user level, etc.
- `src/types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

### Database Schema
- `User` - Authentication, premium status, native language, quiz level
- `SessionLog` - User activity tracking by type and duration
- `CompletedStory` - Progress tracking by story/level/chapter/page
- Standard NextAuth tables for sessions and accounts

### Important Implementation Details

**Story Content Format**:
```typescript
export const story = {
  storySlug: "aventura",
  level: 1,
  chapter: 1,
  page: 1,
  hasChapters: true,
  lines: [
    { es: "Spanish text", en: "English text" }
  ]
};
```

**Route Structure**:
- Internationalized routes with `[lng]` parameter
- Dynamic story routes: `/[lng]/stories/[storySlug]/[level]/[chapter]/[page]`
- API routes for user management, translation, audio, and Stripe

**Authentication Flow**:
- Social login (Google/Facebook) and email/password
- Custom user fields stored in database and JWT token
- Premium status affects story access and translation features

**Translation System**:
- Free mode: simple show/hide Spanish translations
- Premium mode: AI-powered contextual translations via OpenAI API
- Phrase and word-level translation endpoints

## Common Patterns

When adding new stories:
1. Create content files in `src/content/[storySlug]/` following the level/chapter/page structure
2. Add story metadata to `STORY_METADATA` in `src/lib/stories.ts`
3. Create corresponding audio files in `public/audio/[storySlug]/`
4. Update story themes in `src/components/storyThemes.ts` if needed

When working with audio:
- Audio files follow naming: `line[N].mp3` for normal speed, `line[N].mp3` in `-slow` directories for slow speed
- Always provide fallback to speech synthesis
- Use the custom audio progress bar component for consistency

When adding translations:
- Add new keys to both `src/content/ui/en.ts` and `src/content/ui/es.ts`
- Use the `t()` function from `src/lib/t.ts` for translations in components
- Follow the nested object structure for organization

## Code Quality Standards

**This application follows industry best practices for commercial-grade software:**

### Architecture Principles
- **Single Responsibility**: Components and functions should do one thing well
- **File Size Limits**: Aim for 200-400 lines per component; split larger files into logical sub-components
- **Separation of Concerns**: Keep UI, business logic, and data fetching in appropriate layers
- **Extract Reusable Logic**: Common patterns should be abstracted into custom hooks or utilities

### Component Structure
When a component exceeds ~400 lines, consider splitting into:
```
components/
├── FeatureName/
│   ├── index.tsx           # Main orchestration component
│   ├── SubComponent1.tsx   # Logical sub-unit
│   ├── SubComponent2.tsx   # Logical sub-unit
│   └── hooks/
│       └── useFeatureLogic.ts
```

### Code Organization
- Group related functionality into directories
- Use barrel exports (index.ts) for cleaner imports
- Keep types close to where they're used, or in dedicated type files for shared types
- Prefer composition over inheritance

### Technical Debt
- Document known technical debt with TODO comments
- Prioritize refactoring when files become difficult to maintain
- Balance shipping speed with code quality - don't let large files grow indefinitely
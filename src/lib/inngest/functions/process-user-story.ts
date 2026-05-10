// Inngest orchestrator for the user story processing pipeline.
//
// Mirrors the existing processUserStory() in pipeline.ts, but each phase is
// a separate Inngest step so the work fits inside Vercel's per-invocation
// timeout. The biggest steps (rewrite and translate) are fanned out per
// chapter, so a long story spans many small steps rather than one long one.
//
// The DB is the state machine. Each step reads inputs from the DB and writes
// outputs back. Step return values are kept small (just identifiers and
// status flags) — actual content lives on UserStory and UserStoryLevel rows.
//
// Per-chapter rewritten text is staged in
// UserStoryLevel.processingProgress.rewriteCache so the translate step can
// pick it up after the rewrite step in a different invocation.

import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { detectLanguage, detectCEFRLevel, cleanText } from '@/lib/story-processing';
import { processText, type FileType, type ContentType } from '@/lib/text-processing';
import { toCEFR } from '@/lib/cefr';
import {
  detectStoryType,
  generateAllMetadata,
} from '@/lib/user-stories/metadata';
import {
  parseStoryContent,
  rewriteChapterWithChunking,
  translateAndStoreSingleChapter,
  buildAndSaveLevel,
  type ProcessedChapter,
} from '@/lib/user-stories/level-processor';
import {
  LevelProgressTracker,
  updateStoryProgress,
  updateStoryStatus,
  determineFinalStatus,
  isStoryCancelled,
  StoryCancelledError,
} from '@/lib/user-stories/progress-tracker';
import type { StoryType } from '@/types/story';

type SourceLanguage = 'en' | 'es';
type StructureType = 'prose' | 'anthology' | 'epic' | 'script';

const VALID_DETECTED_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SUPPORTED_USER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const processUserStoryFn = inngest.createFunction(
  {
    id: 'process-user-story',
    triggers: [{ event: 'user-story/process' }],
    // Anthropic + OpenAI rate limits are real. Two layers of concurrency
    // control:
    // - Per-user limit: one user uploading multiple long stories shouldn't
    //   stomp their own queue
    // - Per-run step limit: caps in-flight LLM calls when chapters fan out
    //   in parallel within a single story. Mirrors the production
    //   STREAMING_LIMITS.QUEUE_BACKPRESSURE_THRESHOLD pattern.
    concurrency: [
      { key: 'event.data.userId', limit: 3 },
      // Inngest free plan caps function concurrency at 5; setting it
      // explicitly here matches what the platform actually enforces and
      // avoids a "limit clamped" warning on sync.
      { scope: 'fn', limit: 5 },
    ],
  },
  async ({ event, step, logger }) => {
    const { storyId } = event.data as { storyId: string; userId?: string };
    if (!storyId) throw new Error('Missing storyId in event payload');

    // Step 1: Load story, detect language, save it.
    const sourceLanguage = await step.run('detect-language', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: { id: true, userId: true, rawContent: true },
      });
      if (!story) throw new Error(`Story ${storyId} not found`);

      await updateStoryProgress(storyId, 'detecting_language');
      const lang = await detectLanguage(story.rawContent, {
        storyId: story.id,
        userId: story.userId,
      });
      await prisma.userStory.update({
        where: { id: storyId },
        data: { sourceLanguage: lang },
      });
      return lang as SourceLanguage;
    });

    if (await checkCancelled(storyId, logger)) return { cancelled: true };

    // Step 2: Generate title and description in one batched call.
    await step.run('generate-metadata', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          userId: true,
          title: true,
          description: true,
          rawContent: true,
          rawHtml: true,
        },
      });
      if (!story) throw new StoryCancelledError(storyId);

      await updateStoryProgress(storyId, 'generating_metadata');
      const isDefaultTitle =
        story.title === 'Untitled Story' || story.title === 'Historia sin título';
      const needsDescription = !story.description;
      if (!isDefaultTitle && !needsDescription) return;

      const metadata = await generateAllMetadata(
        story.rawContent,
        sourceLanguage,
        { storyId: story.id, userId: story.userId },
        {
          existingTitle: isDefaultTitle ? undefined : story.title,
          existingDescription: needsDescription
            ? undefined
            : (story.description ?? undefined),
          essentialOnly: true,
          rawSourceText: story.rawHtml || undefined,
        },
      );

      const data: Record<string, unknown> = {};
      if (isDefaultTitle) {
        data.title = metadata.title.title;
        data.titleEs = metadata.title.titleEs;
        data.titleEn = metadata.title.titleEn;
      }
      if (needsDescription) {
        data.description = metadata.description.description;
        data.descriptionEs = metadata.description.descriptionEs;
        data.descriptionEn = metadata.description.descriptionEn;
      }
      if (Object.keys(data).length > 0) {
        await prisma.userStory.update({ where: { id: storyId }, data });
      }
    });

    if (await checkCancelled(storyId, logger)) return { cancelled: true };

    // Step 3: Detect CEFR level.
    const detectedLevel = await step.run('detect-level', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: { id: true, userId: true, rawContent: true },
      });
      if (!story) throw new StoryCancelledError(storyId);

      await updateStoryProgress(storyId, 'detecting_level');
      const result = await detectCEFRLevel(story.rawContent, sourceLanguage, {
        storyId: story.id,
        userId: story.userId,
      });
      const level = VALID_DETECTED_LEVELS.includes(result.levelString)
        ? result.levelString
        : 'B1';
      await prisma.userStory.update({
        where: { id: storyId },
        data: { detectedLevel: level },
      });
      return level;
    });

    if (await checkCancelled(storyId, logger)) return { cancelled: true };

    // Step 4: Detect story type if not already set.
    const storyType = await step.run('detect-story-type', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: { id: true, userId: true, rawContent: true, storyType: true },
      });
      if (!story) throw new StoryCancelledError(storyId);
      if (story.storyType) return story.storyType;

      const detected = await detectStoryType(story.rawContent, sourceLanguage, {
        storyId: story.id,
        userId: story.userId,
      });
      await prisma.userStory.update({
        where: { id: storyId },
        data: { storyType: detected },
      });
      return detected;
    });

    if (await checkCancelled(storyId, logger)) return { cancelled: true };

    // Step 5: Determine the levels to process and ensure level rows exist.
    const { levelsToProcess } = await step.run('prepare-levels', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          userId: true,
          processingMode: true,
          UserStoryLevel: { select: { id: true, level: true } },
        },
      });
      if (!story) throw new StoryCancelledError(storyId);

      const levels = await determineLevelsToProcess(
        story.userId,
        detectedLevel,
        story.processingMode,
      );
      const existing = new Set(story.UserStoryLevel.map((l) => l.level));
      const missing = levels.filter((l) => !existing.has(l));
      if (missing.length > 0) {
        const { randomUUID } = await import('crypto');
        await prisma.userStoryLevel.createMany({
          data: missing.map((level) => ({
            id: randomUUID(),
            userStoryId: story.id,
            level,
            content: {},
            status: 'PENDING',
            updatedAt: new Date(),
          })),
        });
      }
      return { levelsToProcess: levels };
    });

    if (await checkCancelled(storyId, logger)) return { cancelled: true };

    // Step 6: Parse chapters once. Returns lightweight structure metadata so
    // later steps can rehydrate chapters from the source content cheaply.
    const parsed = await step.run('parse-chapters', async () => {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          rawContent: true,
          rawHtml: true,
          sourceFormat: true,
        },
      });
      if (!story) throw new StoryCancelledError(storyId);

      await updateStoryProgress(storyId, 'parsing_chapters');
      const chapters = parseChaptersFromStory({
        rawContent: story.rawContent,
        rawHtml: story.rawHtml,
        sourceFormat: story.sourceFormat,
        storyType,
      });
      const totalWords = chapters.originalChapters.reduce(
        (sum, ch) => sum + ch.text.trim().split(/\s+/).length,
        0,
      );
      await updateStoryProgress(storyId, 'parsing_chapters', {
        totalWords,
        chapterTotal: chapters.originalChapters.length,
      });
      return {
        hasChapters: chapters.hasChapters,
        structureType: chapters.structureType,
        chapterCount: chapters.originalChapters.length,
      };
    });

    // Step 7+8: Two-axis parallelism.
    // - Across levels: each level runs as its own task (Promise.all over
    //   level tasks), so detected-level translate runs concurrently with
    //   user-level rewrite+translate.
    // - Within a level: chapters fan out in parallel for both rewrite and
    //   translate phases (Promise.all over chapter steps). Safe because
    //   the per-chapter writes go through atomic jsonb_set helpers in
    //   LevelProgressTracker (updateChapterContentAtomic etc.) instead of
    //   the legacy read-modify-write methods.
    // The function-level concurrency cap (limit: 5) caps in-flight LLM
    // calls so we don't blow Anthropic/OpenAI rate limits when many
    // chapter steps fire at once.
    await updateStoryProgress(storyId, 'rewriting_levels');

    const chapterIndices = Array.from({ length: parsed.chapterCount }, (_, i) => i);

    const levelTasks = levelsToProcess.map(async (level) => {
      const isDetectedLevel = level === detectedLevel;

      // Init the level once before any chapter work runs. This sets
      // levelStatus = PROCESSING and seeds processingProgress.translateProgress
      // and (if rewriting) rewriteProgress. Per-chapter steps then only
      // *update* progress, never reset it.
      await step.run(`begin-${level}`, async () => {
        await beginLevelStep({
          storyId,
          level,
          chapterCount: parsed.chapterCount,
          isDetectedLevel,
        });
      });

      // Wave 1 (non-detected only): rewrite all chapters in parallel.
      if (!isDetectedLevel) {
        const rewriteResults = await Promise.all(
          chapterIndices.map((i) =>
            step.run(`rewrite-${level}-ch${i}`, async () => {
              return await rewriteChapterStep({
                storyId,
                level,
                detectedLevel,
                chapterIndex: i,
                sourceLanguage,
                storyType: storyType as StoryType | null,
              });
            }),
          ),
        );
        const failedRewrites = rewriteResults.filter((ok) => !ok).length;
        if (failedRewrites > 0) {
          console.warn(
            `[Inngest] ${failedRewrites}/${parsed.chapterCount} rewrites failed for ${level}; translate will fall back to original text for those chapters`,
          );
        }
      }

      // Wave 2: translate all chapters in parallel.
      const translateResults = await Promise.all(
        chapterIndices.map((i) =>
          step.run(`translate-${level}-ch${i}`, async () => {
            return await translateChapterStep({
              storyId,
              level,
              chapterIndex: i,
              chapterTotal: parsed.chapterCount,
              sourceLanguage,
              storyType: storyType as StoryType | null,
              structureType: parsed.structureType,
              hasChapters: parsed.hasChapters,
            });
          }),
        ),
      );

      if (!translateResults.some(Boolean)) {
        return { level, success: false };
      }

      // Build and save the assembled level content. Update story-level
      // progress to "building_levels" so the front-end shows a
      // "Finalizing..." title between the last translate chapter and
      // the final "complete" marker.
      await step.run(`build-${level}`, async () => {
        await updateStoryProgress(storyId, 'building_levels');
        await runBuildLevel({
          storyId,
          level,
          sourceLanguage,
          structureType: parsed.structureType,
          hasChapters: parsed.hasChapters,
        });
      });

      return { level, success: translateResults.every(Boolean) };
    });

    const settled = await Promise.all(levelTasks);
    const levelResults: Record<string, boolean> = {};
    for (const result of settled) {
      levelResults[result.level] = result.success;
    }

    // Step 9: Finalize.
    await step.run('finalize', async () => {
      await updateStoryProgress(storyId, 'complete');
      const succeededCount = Object.values(levelResults).filter(Boolean).length;
      const allSucceeded = succeededCount === Object.keys(levelResults).length;
      const anySucceeded = succeededCount > 0;
      const finalStatus = determineFinalStatus(allSucceeded, anySucceeded);
      await updateStoryStatus(storyId, finalStatus);
    });

    return {
      ok: true,
      storyId,
      levelResults,
    };
  },
);

// ============================================================================
// HELPERS — small wrappers over existing pipeline functions.
// These exist so the Inngest function stays readable; the actual work still
// runs through the shared pipeline modules.
// ============================================================================

async function checkCancelled(
  storyId: string,
  logger: { info: (msg: string) => void } | undefined,
): Promise<boolean> {
  const cancelled = await isStoryCancelled(storyId);
  if (cancelled) {
    logger?.info(`[Inngest] Story ${storyId} cancelled, exiting`);
  }
  return cancelled;
}

async function determineLevelsToProcess(
  userId: string,
  detectedLevel: string,
  processingMode: string | null | undefined,
): Promise<string[]> {
  const mode = processingMode || 'both';
  const out = new Set<string>();
  if (mode === 'original_only' || mode === 'both') out.add(detectedLevel);
  if (mode === 'rewritten_only' || mode === 'both') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { quizLevel: true },
    });
    const userLevel = user?.quizLevel ? toCEFR(user.quizLevel) : null;
    if (userLevel && SUPPORTED_USER_LEVELS.includes(userLevel)) out.add(userLevel);
  }
  if (out.size === 0) out.add(detectedLevel);
  return Array.from(out);
}

function parseChaptersFromStory(input: {
  rawContent: string;
  rawHtml: string | null;
  sourceFormat: string | null;
  storyType: string | null;
}): {
  hasChapters: boolean;
  originalChapters: {
    text: string;
    metadata: { number: number; title: string; subtitle?: string };
  }[];
  structureType: StructureType;
} {
  if (input.rawHtml && input.sourceFormat === 'html') {
    const validContentTypes: string[] = ['anthology', 'prose', 'epic', 'script'];
    const contentType =
      input.storyType && validContentTypes.includes(input.storyType)
        ? (input.storyType as ContentType)
        : undefined;
    const result = processText(input.rawHtml, {
      fileType: 'html' as FileType,
      contentType,
    });
    const preprocessed = result.preprocessed;
    return {
      hasChapters: preprocessed.chapters.length > 1,
      structureType: preprocessed.stats.structureType,
      originalChapters: preprocessed.chapters.map((ch) => ({
        text: ch.rawText,
        metadata: {
          number: ch.number,
          title: ch.title || `Chapter ${ch.number}`,
          subtitle: ch.subtitle,
        },
      })),
    };
  }
  const parsed = parseStoryContent(input.rawContent, {
    storyType: input.storyType,
  });
  return {
    hasChapters: parsed.hasChapters,
    originalChapters: parsed.chapters,
    structureType: parsed.structureType,
  };
}

// One-time level initialization step. Called once before any chapter
// step for this level runs. Sets levelStatus = PROCESSING and seeds
// processingProgress fields (translateProgress, rewriteProgress) so the
// front-end has stable state to render against. Per-chapter steps only
// *update* these fields after this — they never reset them.
async function beginLevelStep(input: {
  storyId: string;
  level: string;
  chapterCount: number;
  isDetectedLevel: boolean;
}): Promise<void> {
  const story = await prisma.userStory.findUnique({
    where: { id: input.storyId },
    select: {
      UserStoryLevel: { where: { level: input.level }, select: { id: true } },
    },
  });
  const levelRecord = story?.UserStoryLevel[0];
  if (!levelRecord) {
    console.warn(`[Inngest] Level record missing for ${input.level}, skipping begin`);
    return;
  }

  const tracker = new LevelProgressTracker(levelRecord.id, input.chapterCount);
  await tracker.startProcessing();
  if (!input.isDetectedLevel) {
    await tracker.startRewriting();
  }
  await tracker.startTranslating();
}

// Rewrites a single chapter and stashes the result in
// UserStoryLevel.processingProgress.rewriteCache[chapterIndex] so the
// subsequent translate step can read it. Returns true on success, false
// (and logs) on failure — the caller decides whether to abort the level.
async function rewriteChapterStep(input: {
  storyId: string;
  level: string;
  detectedLevel: string;
  chapterIndex: number;
  sourceLanguage: SourceLanguage;
  storyType: StoryType | null;
}): Promise<boolean> {
  const story = await prisma.userStory.findUnique({
    where: { id: input.storyId },
    select: {
      id: true,
      userId: true,
      rawContent: true,
      rawHtml: true,
      sourceFormat: true,
      UserStoryLevel: { where: { level: input.level }, select: { id: true } },
    },
  });
  if (!story) throw new StoryCancelledError(input.storyId);
  const levelRecord = story.UserStoryLevel[0];
  if (!levelRecord) {
    console.warn(`[Inngest] Level record missing for ${input.level}`);
    return false;
  }

  const chapters = parseChaptersFromStory({
    rawContent: story.rawContent,
    rawHtml: story.rawHtml,
    sourceFormat: story.sourceFormat,
    storyType: input.storyType,
  });
  const chapter = chapters.originalChapters[input.chapterIndex];
  if (!chapter) {
    console.warn(`[Inngest] Chapter ${input.chapterIndex} missing for ${input.level}`);
    return false;
  }

  await updateStoryProgress(input.storyId, 'rewriting_chapter', {
    chapterCurrent: input.chapterIndex + 1,
    chapterTotal: chapters.originalChapters.length,
    currentLevel: input.level,
  });

  const isPoetry =
    input.storyType === 'poem' ||
    input.storyType === 'song-lyrics' ||
    input.storyType === 'epic';

  try {
    const rewrittenText = await rewriteChapterWithChunking(
      chapter.text,
      input.detectedLevel,
      input.level,
      input.sourceLanguage,
      { storyId: story.id, userId: story.userId },
      isPoetry,
    );
    await mergeRewriteCache(levelRecord.id, input.chapterIndex, rewrittenText);

    // Surface rewrite progress to the front-end. Without this the UI's
    // rewrite counter sticks at 0/N for the entire rewrite phase because
    // it reads from rewriteData.length / rewriteProgress.chaptersCompleted.
    const tracker = new LevelProgressTracker(levelRecord.id, chapters.originalChapters.length);
    const cleanedOriginal = cleanText(chapter.text);
    const cleanedRewritten = cleanText(rewrittenText);
    await tracker.updateRewriteProgressAtomic(input.chapterIndex + 1, {
      originalLines: cleanedOriginal.split('\n'),
      rewrittenLines: cleanedRewritten.split('\n'),
    });
    return true;
  } catch (err: any) {
    if (err instanceof StoryCancelledError) throw err;
    console.error(
      `[Inngest] rewrite failed for ${input.level} chapter ${input.chapterIndex}:`,
      err.message,
    );
    return false;
  }
}

// Translates a single chapter (using rewritten text from the cache for
// non-detected levels, or original text for the detected level) and writes
// the built page content via the existing LevelProgressTracker.
async function translateChapterStep(input: {
  storyId: string;
  level: string;
  chapterIndex: number;
  chapterTotal: number;
  sourceLanguage: SourceLanguage;
  storyType: StoryType | null;
  structureType: StructureType;
  hasChapters: boolean;
}): Promise<boolean> {
  const story = await prisma.userStory.findUnique({
    where: { id: input.storyId },
    select: {
      id: true,
      slug: true,
      userId: true,
      rawContent: true,
      rawHtml: true,
      sourceFormat: true,
      UserStoryLevel: {
        where: { level: input.level },
        select: { id: true, processingProgress: true },
      },
    },
  });
  if (!story) throw new StoryCancelledError(input.storyId);
  const levelRecord = story.UserStoryLevel[0];
  if (!levelRecord) {
    console.warn(`[Inngest] Level record missing for ${input.level}`);
    return false;
  }

  const chapters = parseChaptersFromStory({
    rawContent: story.rawContent,
    rawHtml: story.rawHtml,
    sourceFormat: story.sourceFormat,
    storyType: input.storyType,
  });
  const originalChapter = chapters.originalChapters[input.chapterIndex];
  if (!originalChapter) {
    console.warn(`[Inngest] Chapter ${input.chapterIndex} missing for ${input.level}`);
    return false;
  }

  // Pull rewritten text from the cache if present; otherwise the chapter is
  // translated from its original text (detected-level path).
  const progress = (levelRecord.processingProgress ?? {}) as {
    rewriteCache?: Record<string, string>;
  };
  const cached = progress.rewriteCache?.[String(input.chapterIndex)];
  const chapter = cached
    ? { text: cached, metadata: originalChapter.metadata }
    : originalChapter;

  // The level-init step (run once before the chapter loop) is responsible
  // for calling startProcessing / startTranslating. We DO NOT call those
  // from inside the per-chapter step — they pass explicit
  // { translateProgress: { ... currentChapter: 0, chaptersCompleted: 0 } }
  // to mergeProgress, which clobbers the running totals every time and
  // makes the front-end "Start Reading" buttons flicker.
  const tracker = new LevelProgressTracker(levelRecord.id, chapters.originalChapters.length);

  try {
    await translateAndStoreSingleChapter({
      storyId: story.id,
      userId: story.userId,
      levelId: levelRecord.id,
      level: input.level,
      storySlug: story.slug,
      chapter,
      chapterIndex: input.chapterIndex,
      chapterTotal: input.chapterTotal,
      sourceLanguage: input.sourceLanguage,
      storyType: input.storyType,
      structureType: input.structureType,
      hasChapters: input.hasChapters,
      sourceFormat: story.sourceFormat as
        | 'html'
        | 'txt'
        | 'rtf'
        | 'md'
        | null
        | undefined,
      rawHtml: story.rawHtml,
      tracker,
    });
    return true;
  } catch (err: any) {
    if (err instanceof StoryCancelledError) throw err;
    console.error(
      `[Inngest] translate failed for ${input.level} chapter ${input.chapterIndex}:`,
      err.message,
    );
    return false;
  }
}

// Atomic single-slot write into
// UserStoryLevel.processingProgress.rewriteCache.{chapterIndex}. Uses
// Postgres jsonb_set so concurrent rewrite steps for the same level (now
// that chapters fan out in parallel) don't clobber each other's writes,
// which a naive read-modify-write JSON update would do.
//
// jsonb_set with create_missing=true initializes the rewriteCache object
// on first write. The two-step approach below ensures rewriteCache exists
// as an object before we set a key inside it.
async function mergeRewriteCache(
  levelId: string,
  chapterIndex: number,
  rewrittenText: string,
): Promise<void> {
  const slotKey = String(chapterIndex);
  // Step 1: ensure rewriteCache exists as an object. coalesce the column
  // to '{}' first so this works even when processingProgress is null.
  await prisma.$executeRaw`
    UPDATE "UserStoryLevel"
    SET "processingProgress" = jsonb_set(
      coalesce("processingProgress", '{}'::jsonb),
      '{rewriteCache}',
      coalesce("processingProgress"->'rewriteCache', '{}'::jsonb),
      true
    )
    WHERE "id" = ${levelId}
  `;
  // Step 2: set the chapter slot inside rewriteCache.
  await prisma.$executeRaw`
    UPDATE "UserStoryLevel"
    SET "processingProgress" = jsonb_set(
      "processingProgress",
      ARRAY['rewriteCache', ${slotKey}],
      to_jsonb(${rewrittenText}::text),
      true
    )
    WHERE "id" = ${levelId}
  `;
}

async function runBuildLevel(input: {
  storyId: string;
  level: string;
  sourceLanguage: SourceLanguage;
  structureType: StructureType;
  hasChapters: boolean;
}): Promise<void> {
  const story = await prisma.userStory.findUnique({
    where: { id: input.storyId },
    select: {
      id: true,
      slug: true,
      UserStoryLevel: {
        where: { level: input.level },
        select: { id: true, content: true },
      },
    },
  });
  if (!story) throw new StoryCancelledError(input.storyId);
  const levelRecord = story.UserStoryLevel[0];
  if (!levelRecord) return;

  // Pull pre-built chapter pages from the level's content (written
  // incrementally during translate). Reconstruct ProcessedChapter list from
  // those for buildAndSaveLevel(). If pages are missing we log and bail.
  const content = levelRecord.content as { chapters?: Record<string, unknown> } | null;
  const chapterMap = (content?.chapters || {}) as Record<
    string,
    { sourceLines?: string[]; translatedLines?: string[]; metadata?: ProcessedChapter['metadata'] }
  >;
  const chapterNumbers = Object.keys(chapterMap)
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  const processedChapters: ProcessedChapter[] = chapterNumbers.map((n) => {
    const ch = chapterMap[String(n)] || {};
    return {
      sourceLines: ch.sourceLines ?? [],
      translatedLines: ch.translatedLines ?? [],
      metadata: ch.metadata ?? { number: n, title: `Chapter ${n}` },
    };
  });

  if (processedChapters.length === 0) {
    console.warn(`[Inngest] No processed chapters found for ${input.level}`);
    return;
  }

  await buildAndSaveLevel({
    storyId: story.id,
    levelId: levelRecord.id,
    level: input.level,
    storySlug: story.slug,
    hasChapters: input.hasChapters,
    processedChapters,
    sourceLanguage: input.sourceLanguage,
    structureType: input.structureType,
  });
}

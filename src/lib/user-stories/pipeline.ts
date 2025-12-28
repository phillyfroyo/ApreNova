// src/lib/user-stories/pipeline.ts
// User story processing pipeline
// Uses the shared story-processing library for all AI operations

import { prisma } from "@/lib/prisma";
import { USER_STORY_LIMITS } from "./limits";

// Import everything from the shared library
import {
  // Detection
  detectLanguage,
  detectCEFRLevel,
  // Rewriting
  rewriteToLevel,
  // Translation
  translateText,
  // Text processing
  parseChapters,
  buildContentStructure,
  quickClean,
  cleanText,
  // Types
  type LevelContent,
} from "@/lib/story-processing";

// ============================================================================
// PROGRESS TRACKING TYPES
// ============================================================================

export interface ProcessingProgress {
  stage: "rewriting" | "translating" | "complete";
  currentChapter: number;
  totalChapters: number;
  chaptersCompleted: number[];
  completedData?: {
    sourceLines: string[];
    translatedLines: string[];
  }[];
  rewriteData?: {
    originalLines: string[];
    rewrittenLines: string[];
  }[];
}

// ============================================================================
// TITLE & DESCRIPTION GENERATION
// (These are user-story-specific and not in shared lib)
// ============================================================================

import { OpenAI } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract or generate a title from the text
 */
export async function extractOrGenerateTitle(
  text: string,
  language: "en" | "es"
): Promise<{ title: string; titleEs: string; titleEn: string }> {
  const prompt =
    language === "es"
      ? `Analiza el siguiente texto en español. Si hay un título obvio al principio, extráelo. Si no, genera un título apropiado y conciso (máximo 5 palabras).

Responde en JSON con este formato exacto:
{"titleEs": "título en español", "titleEn": "title in English"}

Texto:
${text.substring(0, 1000)}`
      : `Analyze the following English text. If there's an obvious title at the beginning, extract it. If not, generate an appropriate and concise title (maximum 5 words).

Respond in JSON with this exact format:
{"titleEs": "título en español", "titleEn": "title in English"}

Text:
${text.substring(0, 1000)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
    max_tokens: 100,
  });

  const response = completion.choices[0]?.message?.content || "";
  const cleaned = response.replace(/```json|```/g, "").trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      title: language === "es" ? result.titleEs : result.titleEn,
      titleEs: result.titleEs || result.title || "Sin título",
      titleEn: result.titleEn || result.title || "Untitled",
    };
  } catch {
    const firstLine = text.split("\n")[0]?.trim() || "";
    if (firstLine.length > 0 && firstLine.length < 100) {
      return { title: firstLine, titleEs: firstLine, titleEn: firstLine };
    }
    return {
      title: language === "es" ? "Mi Historia" : "My Story",
      titleEs: "Mi Historia",
      titleEn: "My Story",
    };
  }
}

/**
 * Generate a description for the story
 */
export async function generateDescription(
  text: string,
  language: "en" | "es"
): Promise<{ description: string; descriptionEs: string; descriptionEn: string }> {
  const prompt =
    language === "es"
      ? `Lee el siguiente texto en español y escribe una descripción atractiva de 1-2 oraciones que capture la esencia de la historia. La descripción debe intrigar al lector sin revelar demasiado.

Responde en JSON con este formato exacto:
{"descriptionEs": "descripción en español", "descriptionEn": "description in English"}

Texto:
${text.substring(0, 2000)}`
      : `Read the following English text and write an engaging 1-2 sentence description that captures the essence of the story. The description should intrigue the reader without revealing too much.

Respond in JSON with this exact format:
{"descriptionEs": "descripción en español", "descriptionEn": "description in English"}

Text:
${text.substring(0, 2000)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
  });

  const response = completion.choices[0]?.message?.content || "";
  const cleaned = response.replace(/```json|```/g, "").trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      description: language === "es" ? result.descriptionEs : result.descriptionEn,
      descriptionEs: result.descriptionEs || "",
      descriptionEn: result.descriptionEn || "",
    };
  } catch {
    return {
      description: "",
      descriptionEs: "",
      descriptionEn: "",
    };
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Helper to update processing progress in the database
 */
async function updateProcessingProgress(
  levelId: string,
  progress: ProcessingProgress
): Promise<void> {
  await prisma.userStoryLevel.update({
    where: { id: levelId },
    data: { processingProgress: progress as any },
  });
}

/**
 * Get the user's current CEFR level
 */
async function getUserLevel(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quizLevel: true },
  });

  if (!user?.quizLevel) return null;

  const level = user.quizLevel;
  if (typeof level === "number") {
    return `l${level}`;
  }
  if (typeof level === "string") {
    return level.startsWith("l") ? level : `l${level}`;
  }
  return null;
}

// ============================================================================
// LEVEL PROCESSING
// ============================================================================

/**
 * Process a single level (rewrite if needed + translate + paginate)
 */
async function processLevel(
  storyId: string,
  levelId: string,
  level: string,
  rawContent: string,
  sourceLanguage: "en" | "es",
  detectedLevel: string,
  storySlug: string
): Promise<void> {
  try {
    // Update status to PROCESSING
    await prisma.userStoryLevel.update({
      where: { id: levelId },
      data: { status: "PROCESSING" },
    });

    // Clean the text using shared utilities
    const cleanedContent = cleanText(quickClean(rawContent));

    // Step 1: Parse chapters FIRST (before rewriting, to enable chunked processing)
    const { hasChapters, chapters: rawChapters } = parseChapters(cleanedContent);

    // Step 2: Rewrite each chapter to target level if different from detected
    const needsRewrite = level !== detectedLevel;
    let chapters: string[] = rawChapters;

    if (needsRewrite) {
      // Initialize progress for rewriting stage
      await updateProcessingProgress(levelId, {
        stage: "rewriting",
        currentChapter: 0,
        totalChapters: rawChapters.length,
        chaptersCompleted: [],
        rewriteData: [],
      });

      const rewrittenChapters: string[] = [];
      const rewriteData: { originalLines: string[]; rewrittenLines: string[] }[] = [];

      for (let i = 0; i < rawChapters.length; i++) {
        const chapterText = rawChapters[i];

        // Update progress - starting this chapter
        await updateProcessingProgress(levelId, {
          stage: "rewriting",
          currentChapter: i + 1,
          totalChapters: rawChapters.length,
          chaptersCompleted: rewrittenChapters.map((_, idx) => idx),
          rewriteData,
        });

        // Rewrite this chapter using shared library
        const result = await rewriteToLevel(
          chapterText,
          detectedLevel,
          level,
          sourceLanguage
        );
        rewrittenChapters.push(result.rewrittenText);

        // Store original and rewritten lines for the viewer
        rewriteData.push({
          originalLines: chapterText.split("\n").filter((l) => l.trim()),
          rewrittenLines: result.rewrittenText.split("\n").filter((l) => l.trim()),
        });

        // Update progress - completed this chapter
        await updateProcessingProgress(levelId, {
          stage: "rewriting",
          currentChapter: i + 1,
          totalChapters: rawChapters.length,
          chaptersCompleted: [...rewrittenChapters.map((_, idx) => idx)],
          rewriteData,
        });

        await new Promise((r) =>
          setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
        );
      }

      chapters = rewrittenChapters;
    }

    // Initialize progress for translation stage
    await updateProcessingProgress(levelId, {
      stage: "translating",
      currentChapter: 0,
      totalChapters: chapters.length,
      chaptersCompleted: [],
      completedData: [],
    });

    // Step 3: Process each chapter - translate to opposite language
    const processedChapters: { sourceLines: string[]; translatedLines: string[] }[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapterText = chapters[i];

      // Update progress - starting this chapter
      await updateProcessingProgress(levelId, {
        stage: "translating",
        currentChapter: i + 1,
        totalChapters: chapters.length,
        chaptersCompleted: processedChapters.map((_, idx) => idx),
        completedData: processedChapters,
      });

      // Translate chapter using shared library (now uses Claude Haiku!)
      const result = await translateText(chapterText, sourceLanguage, level);
      await new Promise((r) =>
        setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
      );

      // Split into lines
      const sourceLines = chapterText.split("\n").filter((l) => l.trim());
      const translatedLines = result.translatedLines.filter((l) => l.trim());

      processedChapters.push({ sourceLines, translatedLines });

      // Update progress - completed this chapter
      await updateProcessingProgress(levelId, {
        stage: "translating",
        currentChapter: i + 1,
        totalChapters: chapters.length,
        chaptersCompleted: processedChapters.map((_, idx) => idx),
        completedData: processedChapters,
      });
    }

    // Step 4: Build content structure using shared library
    const levelNum = parseInt(level.replace("l", ""));
    const content = buildContentStructure(
      storySlug,
      levelNum,
      hasChapters,
      processedChapters,
      sourceLanguage
    );

    // Step 5: Save to database with complete progress
    await prisma.userStoryLevel.update({
      where: { id: levelId },
      data: {
        content: content as any,
        status: "READY",
        processingProgress: {
          stage: "complete",
          currentChapter: chapters.length,
          totalChapters: chapters.length,
          chaptersCompleted: chapters.map((_, idx) => idx),
        } as any,
      },
    });
  } catch (error: any) {
    console.error(`[Pipeline] Level ${level} failed:`, error.message);
    await prisma.userStoryLevel.update({
      where: { id: levelId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Main pipeline: Process entire story
 * Only processes: detected level + user's current level (if different)
 */
export async function processUserStory(storyId: string): Promise<void> {
  console.log(`[Pipeline] Processing story: ${storyId}`);

  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { levels: true },
  });

  if (!story) {
    throw new Error("Story not found");
  }

  try {
    // Step 1: Detect language
    const sourceLanguage = await detectLanguage(story.rawContent);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { sourceLanguage },
    });
    await new Promise((r) =>
      setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
    );

    // Step 2: Generate title if using default
    if (story.title === "Untitled Story" || story.title === "Historia sin título") {
      const titles = await extractOrGenerateTitle(story.rawContent, sourceLanguage);
      await prisma.userStory.update({
        where: { id: storyId },
        data: {
          title: titles.title,
          titleEs: titles.titleEs,
          titleEn: titles.titleEn,
        },
      });
      await new Promise((r) =>
        setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
      );
    }

    // Step 3: Generate description if not provided
    if (!story.description) {
      const descriptions = await generateDescription(story.rawContent, sourceLanguage);
      await prisma.userStory.update({
        where: { id: storyId },
        data: {
          description: descriptions.description,
          descriptionEs: descriptions.descriptionEs,
          descriptionEn: descriptions.descriptionEn,
        },
      });
      await new Promise((r) =>
        setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
      );
    }

    // Step 4: Detect CEFR level
    const detectionResult = await detectCEFRLevel(story.rawContent, sourceLanguage);
    const detectedLevel = detectionResult.levelString;
    console.log(`[Pipeline] Detected: ${sourceLanguage.toUpperCase()}, ${detectionResult.cefr}`);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { detectedLevel },
    });
    await new Promise((r) =>
      setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS)
    );

    // Step 5: Determine which levels to process
    const levelsToProcess = new Set<string>([detectedLevel]);
    const userLevel = await getUserLevel(story.userId);
    if (userLevel && userLevel !== detectedLevel) {
      levelsToProcess.add(userLevel);
    }

    // Step 6: Process each level
    console.log(`[Pipeline] Processing levels: ${Array.from(levelsToProcess).join(", ")}`);
    let allSucceeded = true;
    let anySucceeded = false;

    for (const level of levelsToProcess) {
      const levelRecord = story.levels.find((l) => l.level === level);
      if (!levelRecord) continue;

      try {
        await processLevel(
          storyId,
          levelRecord.id,
          level,
          story.rawContent,
          sourceLanguage,
          detectedLevel,
          story.slug
        );
        anySucceeded = true;
      } catch (error: any) {
        allSucceeded = false;
        console.error(`[Pipeline] Level ${level} error:`, error.message);
      }
    }

    // Update overall status
    const finalStatus =
      allSucceeded && anySucceeded ? "READY" : anySucceeded ? "PARTIAL" : "FAILED";
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: finalStatus },
    });
    console.log(`[Pipeline] Complete: ${finalStatus}`);
  } catch (error: any) {
    console.error(`[Pipeline] Failed:`, error.message);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

// src/lib/user-stories/pipeline.ts

import { OpenAI } from "openai";
import { prisma } from "@/lib/prisma";
import {
  getCEFRDetectionPrompt,
  getLevelRewritePrompt,
  getTranslationPrompt,
} from "./cefr-prompts";
import { USER_STORY_LIMITS } from "./limits";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Content structure that matches existing story content.ts files
interface StoryLine {
  es: string;
  en: string;
}

interface PageContent {
  lines: StoryLine[];
}

interface ChapterContent {
  pages: Record<number, PageContent>;
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, ChapterContent>;
}

/**
 * Detect the language of the source text
 */
export async function detectLanguage(text: string): Promise<"en" | "es"> {
  // Use a simple heuristic first - look for common Spanish indicators
  const spanishIndicators = [
    /\b(el|la|los|las|un|una|unos|unas)\b/gi,
    /\b(que|qué|y|de|en|con|por|para)\b/gi,
    /\b(es|está|son|están|ser|estar)\b/gi,
    /[áéíóúñü]/gi,
    /\b(muy|más|también|pero|porque|cuando)\b/gi,
  ];

  const englishIndicators = [
    /\b(the|a|an)\b/gi,
    /\b(is|are|was|were|be|been|being)\b/gi,
    /\b(and|or|but|if|when|while)\b/gi,
    /\b(have|has|had|do|does|did)\b/gi,
    /\b(this|that|these|those)\b/gi,
  ];

  let spanishScore = 0;
  let englishScore = 0;

  spanishIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    spanishScore += matches ? matches.length : 0;
  });

  englishIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    englishScore += matches ? matches.length : 0;
  });

  // If heuristic is unclear, use AI
  if (Math.abs(spanishScore - englishScore) < 10) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Analyze the following text and determine if it is written in English or Spanish. Respond with only "en" or "es".

Text:
${text.substring(0, 500)}`
      }],
      temperature: 0,
      max_tokens: 5,
    });

    const response = completion.choices[0]?.message?.content?.toLowerCase().trim();
    return response === "en" ? "en" : "es";
  }

  return spanishScore > englishScore ? "es" : "en";
}

/**
 * Extract or generate a title from the text
 */
export async function extractOrGenerateTitle(
  text: string,
  language: "en" | "es"
): Promise<{ title: string; titleEs: string; titleEn: string }> {
  const prompt = language === "es"
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
    // Fallback: try to extract first line as title
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
  const prompt = language === "es"
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

/**
 * Detect CEFR level of the source text
 */
export async function detectCEFRLevel(
  text: string,
  language: "en" | "es"
): Promise<{ level: string; confidence: string; reasoning: string }> {
  const prompt = getCEFRDetectionPrompt(text, language);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const response = completion.choices[0]?.message?.content || "";
  const cleaned = response.replace(/```json|```/g, "").trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      level: result.detectedLevel || "l3",
      confidence: result.confidence || "medium",
      reasoning: result.reasoning || "",
    };
  } catch {
    // Default to intermediate if parsing fails
    return { level: "l3", confidence: "low", reasoning: "Failed to parse response" };
  }
}

/**
 * Rewrite text to a specific CEFR level
 */
export async function rewriteToLevel(
  text: string,
  sourceLevel: string,
  targetLevel: string,
  language: "en" | "es"
): Promise<string> {
  // If target matches source, return original
  if (sourceLevel === targetLevel) {
    return text;
  }

  const prompt = getLevelRewritePrompt(text, sourceLevel, targetLevel, language);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content?.trim() || text;
}

/**
 * Translate text to the other language
 */
export async function translateText(
  text: string,
  sourceLanguage: "en" | "es",
  level: string
): Promise<string> {
  const prompt = getTranslationPrompt(text, sourceLanguage, level);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

/**
 * Parse text into chapters
 */
function parseChapters(text: string): { hasChapters: boolean; chapters: string[] } {
  const lines = text.split("\n").filter((line) => line.trim());

  // Check for chapter markers
  const chapterPattern = /^(chapter|cap[ií]tulo|\-{3,}|[IVX]+\.|[0-9]+[\.:])[\s]*/i;
  const chapterIndices: number[] = [];

  lines.forEach((line, index) => {
    if (chapterPattern.test(line.trim())) {
      chapterIndices.push(index);
    }
  });

  if (chapterIndices.length <= 1) {
    // No chapters or just one marker at the beginning
    return {
      hasChapters: false,
      chapters: [lines.filter((l) => !chapterPattern.test(l.trim())).join("\n")],
    };
  }

  // Split into chapters
  const chapters: string[] = [];
  for (let i = 0; i < chapterIndices.length; i++) {
    const start = chapterIndices[i];
    const end = chapterIndices[i + 1] || lines.length;
    const chapterLines = lines.slice(start + 1, end).filter((l) => !chapterPattern.test(l.trim()));
    if (chapterLines.length > 0) {
      chapters.push(chapterLines.join("\n"));
    }
  }

  // If first content is before first chapter marker, add it as chapter 1
  if (chapterIndices[0] > 0) {
    const preContent = lines.slice(0, chapterIndices[0]).filter((l) => !chapterPattern.test(l.trim()));
    if (preContent.length > 0) {
      chapters.unshift(preContent.join("\n"));
    }
  }

  return { hasChapters: true, chapters };
}

/**
 * Paginate text into pages of ~10 lines
 */
function paginateText(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.trim());
  const pages: string[][] = [];
  const linesPerPage = USER_STORY_LIMITS.LINES_PER_PAGE;

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  // Ensure we have at least one page
  if (pages.length === 0) {
    pages.push([]);
  }

  return pages;
}

/**
 * Build the content structure matching existing content.ts format
 */
function buildContentStructure(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersWithPages: { sourcePages: string[][]; translatedPages: string[][] }[],
  sourceLanguage: "en" | "es"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  chaptersWithPages.forEach((chapter, chapterIndex) => {
    const pages: Record<number, PageContent> = {};

    chapter.sourcePages.forEach((sourcePageLines, pageIndex) => {
      const translatedPageLines = chapter.translatedPages[pageIndex] || [];
      const lines: StoryLine[] = [];

      const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);
      for (let i = 0; i < maxLines; i++) {
        const sourceLine = sourcePageLines[i]?.trim() || "";
        const translatedLine = translatedPageLines[i]?.trim() || "";

        if (sourceLanguage === "es") {
          lines.push({ es: sourceLine, en: translatedLine });
        } else {
          lines.push({ es: translatedLine, en: sourceLine });
        }
      }

      pages[pageIndex + 1] = { lines };
    });

    chapters[chapterIndex + 1] = { pages };
  });

  return {
    storySlug,
    level: levelNum,
    hasChapters,
    chapters,
  };
}

/**
 * Process a single level (rewrite + translate + paginate)
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

    // Step 1: Rewrite to target level
    const rewrittenText = await rewriteToLevel(rawContent, detectedLevel, level, sourceLanguage);

    // Add delay between API calls
    await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

    // Step 2: Parse chapters
    const { hasChapters, chapters } = parseChapters(rewrittenText);

    // Step 3: Process each chapter
    const processedChapters: { sourcePages: string[][]; translatedPages: string[][] }[] = [];

    for (const chapterText of chapters) {
      // Translate chapter
      const translatedChapter = await translateText(chapterText, sourceLanguage, level);

      // Add delay
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

      // Paginate both source and translation
      const sourcePages = paginateText(chapterText);
      const translatedPages = paginateText(translatedChapter);

      processedChapters.push({ sourcePages, translatedPages });
    }

    // Step 4: Build content structure
    const levelNum = parseInt(level.replace("l", ""));
    const content = buildContentStructure(
      storySlug,
      levelNum,
      hasChapters,
      processedChapters,
      sourceLanguage
    );

    // Step 5: Save to database
    await prisma.userStoryLevel.update({
      where: { id: levelId },
      data: {
        content: content as any,
        status: "READY",
      },
    });
  } catch (error) {
    console.error(`Failed to process level ${level} for story ${storyId}:`, error);
    await prisma.userStoryLevel.update({
      where: { id: levelId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

/**
 * Main pipeline: Process entire story
 */
export async function processUserStory(storyId: string): Promise<void> {
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { levels: true },
  });

  if (!story) {
    throw new Error("Story not found");
  }

  try {
    // Step 1: Detect language if not set or needs confirmation
    let sourceLanguage = story.sourceLanguage as "en" | "es";
    if (!sourceLanguage || sourceLanguage === "es") {
      // Auto-detect to confirm/correct
      sourceLanguage = await detectLanguage(story.rawContent);
      await prisma.userStory.update({
        where: { id: storyId },
        data: { sourceLanguage },
      });
    }

    // Add delay
    await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

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

      // Add delay
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));
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

      // Add delay
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));
    }

    // Step 4: Detect CEFR level
    const { level: detectedLevel } = await detectCEFRLevel(
      story.rawContent,
      sourceLanguage
    );

    // Update story with detected level
    await prisma.userStory.update({
      where: { id: storyId },
      data: { detectedLevel },
    });

    // Add delay
    await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

    // Step 5: Process each level
    const levels = ["l1", "l2", "l3", "l4", "l5"];
    let allSucceeded = true;
    let anySucceeded = false;

    for (const level of levels) {
      const levelRecord = story.levels.find((l) => l.level === level);
      if (!levelRecord) continue;

      try {
        await processLevel(
          storyId,
          levelRecord.id,
          level,
          story.rawContent,
          story.sourceLanguage as "en" | "es",
          detectedLevel,
          story.slug
        );
        anySucceeded = true;
      } catch (error) {
        allSucceeded = false;
        console.error(`Failed to process level ${level}:`, error);
      }
    }

    // Update overall status
    const finalStatus = allSucceeded ? "READY" : anySucceeded ? "PARTIAL" : "FAILED";
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: finalStatus },
    });
  } catch (error) {
    console.error(`Pipeline failed for story ${storyId}:`, error);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

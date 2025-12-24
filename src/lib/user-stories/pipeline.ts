// src/lib/user-stories/pipeline.ts

import { OpenAI } from "openai";
import { prisma } from "@/lib/prisma";
import {
  getCEFRDetectionPrompt,
  getLevelRewritePrompt,
} from "./cefr-prompts";
import { USER_STORY_LIMITS } from "./limits";
import { quickClean } from "@/lib/admin/text-preprocessor";

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
 * Add line numbers to non-blank lines for translation alignment
 */
function addLineNumbers(text: string): {
  numberedText: string;
  lineCount: number;
  totalLines: number;
  blankLinePositions: number[];
} {
  const lines = text.split("\n");
  const blankLinePositions: number[] = [];
  const contentLines: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim() === "") {
      blankLinePositions.push(idx);
    } else {
      contentLines.push(`[${contentLines.length + 1}] ${line}`);
    }
  });

  return {
    numberedText: contentLines.join("\n"),
    lineCount: contentLines.length,
    totalLines: lines.length,
    blankLinePositions,
  };
}

/**
 * Parse numbered lines from translation response
 */
function parseNumberedLines(text: string, expectedCount: number): string[] {
  const result: string[] = new Array(expectedCount).fill("");
  const linePattern = /\[(\d+)\]\s*([^\n]*)/g;

  let match;
  while ((match = linePattern.exec(text + "\n")) !== null) {
    const lineNum = parseInt(match[1], 10);
    let lineText = match[2].trim();
    // Strip any remaining [N] prefix
    lineText = lineText.replace(/^\[\d+\]\s*/, "");

    if (lineNum >= 1 && lineNum <= expectedCount) {
      result[lineNum - 1] = lineText;
    }
  }

  return result;
}

/**
 * Reconstruct full text by re-inserting blank lines
 */
function reconstructWithBlankLines(
  translatedLines: string[],
  blankLinePositions: number[],
  totalLines: number
): string[] {
  const result: string[] = [];
  let translatedIdx = 0;

  for (let i = 0; i < totalLines; i++) {
    if (blankLinePositions.includes(i)) {
      result.push("");
    } else {
      result.push(translatedLines[translatedIdx] || "");
      translatedIdx++;
    }
  }

  return result;
}

/**
 * Translate text to the other language using line-by-line alignment
 */
export async function translateText(
  text: string,
  sourceLanguage: "en" | "es",
  level: string
): Promise<string> {
  const toLanguage = sourceLanguage === "en" ? "Spanish" : "English";
  const { numberedText, lineCount, totalLines, blankLinePositions } = addLineNumbers(text);

  const systemPrompt = `You are an expert literary translator specializing in ${sourceLanguage === "en" ? "English to Spanish" : "Spanish to English"} translation for language learners.

CRITICAL RULES:
1. Each line in the input starts with a number in brackets like [1], [2], [3], etc.
2. You MUST preserve these exact line numbers in your output.
3. Each numbered input line produces EXACTLY ONE numbered output line.
4. NEVER split a single input line into multiple output lines.
5. NEVER merge multiple input lines into one output line.
6. Keep the same [N] prefix for each translated line.
7. Translate ALL lines - do not skip any.

Example:
Input:
[1] The cat sat on the mat.
[2] It was a sunny day.

Output:
[1] El gato se sentó en la alfombra.
[2] Era un día soleado.

Maintain CEFR level ${level} complexity. Return ONLY the numbered translated lines.`;

  const userPrompt = `Translate the following ${sourceLanguage === "en" ? "English" : "Spanish"} text to ${toLanguage}. Maintain the same line-by-line structure.

${numberedText}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });

  const rawResponse = completion.choices[0]?.message?.content?.trim() || "";

  // Parse the numbered lines
  let translatedContentLines = parseNumberedLines(rawResponse, lineCount);

  // Strip any remaining [N] prefixes
  translatedContentLines = translatedContentLines.map(line =>
    line.replace(/^\[\d+\]\s*/, "").trim()
  );

  // Reconstruct with blank lines
  const fullTranslatedLines = reconstructWithBlankLines(
    translatedContentLines,
    blankLinePositions,
    totalLines
  );

  return fullTranslatedLines.join("\n");
}

/**
 * Parse text into chapters based on markers
 */
function parseChapters(text: string): { hasChapters: boolean; chapters: string[] } {
  // Clean the text first using admin pipeline's quickClean
  const cleanedText = quickClean(text);

  const lines = cleanedText.split("\n").filter((line) => line.trim());

  // Check for chapter markers
  const chapterPattern = /^(chapter|cap[ií]tulo|---\s*(chapter|cap[ií]tulo))[\s]*/i;
  const dividerPattern = /^-{3,}$|^\*{3,}$|^={3,}$/;
  const chapterIndices: number[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (chapterPattern.test(trimmed)) {
      chapterIndices.push(index);
    }
  });

  if (chapterIndices.length <= 1) {
    // No chapters or just one marker at the beginning
    const filteredLines = lines.filter((l) => {
      const trimmed = l.trim();
      return !chapterPattern.test(trimmed) && !dividerPattern.test(trimmed);
    });
    return {
      hasChapters: false,
      chapters: [filteredLines.join("\n")],
    };
  }

  // Split into chapters
  const chapters: string[] = [];
  for (let i = 0; i < chapterIndices.length; i++) {
    const start = chapterIndices[i];
    const end = chapterIndices[i + 1] || lines.length;
    const chapterLines = lines.slice(start + 1, end).filter((l) => {
      const trimmed = l.trim();
      return !chapterPattern.test(trimmed) && !dividerPattern.test(trimmed);
    });
    if (chapterLines.length > 0) {
      chapters.push(chapterLines.join("\n"));
    }
  }

  // If first content is before first chapter marker, add it as chapter 1
  if (chapterIndices[0] > 0) {
    const preContent = lines.slice(0, chapterIndices[0]).filter((l) => {
      const trimmed = l.trim();
      return !chapterPattern.test(trimmed) && !dividerPattern.test(trimmed);
    });
    if (preContent.length > 0) {
      chapters.unshift(preContent.join("\n"));
    }
  }

  return { hasChapters: true, chapters };
}

/**
 * Paginate text into pages of ~10 lines
 */
function paginateLines(lines: string[], linesPerPage: number = 10): string[][] {
  if (!lines || lines.length === 0) {
    return [[]];
  }

  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    currentPage.push(line);

    if (currentPage.length >= linesPerPage) {
      // Try to find a good breaking point
      const lastLineEndsSentence =
        line.endsWith(".") ||
        line.endsWith("!") ||
        line.endsWith("?") ||
        line.endsWith('"');

      if (lastLineEndsSentence || currentPage.length >= linesPerPage + 2) {
        pages.push([...currentPage]);
        currentPage = [];
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

/**
 * Build the content structure matching existing content.ts format
 */
function buildContentStructure(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: { sourceLines: string[]; translatedLines: string[] }[],
  sourceLanguage: "en" | "es"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  chaptersData.forEach((chapter, chapterIndex) => {
    const sourcePages = paginateLines(chapter.sourceLines);
    const translatedPages = paginateLines(chapter.translatedLines);
    const pages: Record<number, PageContent> = {};

    const maxPages = Math.max(sourcePages.length, translatedPages.length);

    for (let pIdx = 0; pIdx < maxPages; pIdx++) {
      const sourcePageLines = sourcePages[pIdx] || [];
      const translatedPageLines = translatedPages[pIdx] || [];
      const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);

      const lines: StoryLine[] = [];
      for (let lIdx = 0; lIdx < maxLines; lIdx++) {
        const sourceLine = sourcePageLines[lIdx]?.trim() || "";
        const translatedLine = translatedPageLines[lIdx]?.trim() || "";

        // IMPORTANT: es always gets Spanish, en always gets English
        // If source is Spanish, source goes to es, translated goes to en
        // If source is English, source goes to en, translated goes to es
        if (sourceLanguage === "es") {
          lines.push({ es: sourceLine, en: translatedLine });
        } else {
          lines.push({ en: sourceLine, es: translatedLine });
        }
      }

      pages[pIdx + 1] = { lines };
    }

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

    // Clean the text using admin pipeline's quickClean
    const cleanedContent = quickClean(rawContent);

    // Step 1: Rewrite to target level if different from detected
    let contentForLevel = cleanedContent;
    if (level !== detectedLevel) {
      contentForLevel = await rewriteToLevel(cleanedContent, detectedLevel, level, sourceLanguage);
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));
    }

    // Step 2: Parse chapters
    const { hasChapters, chapters } = parseChapters(contentForLevel);

    // Step 3: Process each chapter - translate to opposite language
    const processedChapters: { sourceLines: string[]; translatedLines: string[] }[] = [];

    for (const chapterText of chapters) {
      // Translate chapter to opposite language
      const translatedChapter = await translateText(chapterText, sourceLanguage, level);
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

      // Split into lines
      const sourceLines = chapterText.split("\n").filter(l => l.trim());
      const translatedLines = translatedChapter.split("\n").filter(l => l.trim());

      processedChapters.push({ sourceLines, translatedLines });
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
 * Get the user's current CEFR level
 */
async function getUserLevel(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quizLevel: true },
  });

  if (!user?.quizLevel) return null;

  // quizLevel might be stored as number (1-5) or string (l1-l5)
  const level = user.quizLevel;
  if (typeof level === 'number') {
    return `l${level}`;
  }
  if (typeof level === 'string') {
    return level.startsWith('l') ? level : `l${level}`;
  }
  return null;
}

/**
 * Main pipeline: Process entire story
 * Only processes: detected level + user's current level (if different)
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
    // Step 1: Detect language
    const sourceLanguage = await detectLanguage(story.rawContent);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { sourceLanguage },
    });
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
      await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));
    }

    // Step 4: Detect CEFR level
    const { level: detectedLevel } = await detectCEFRLevel(story.rawContent, sourceLanguage);
    await prisma.userStory.update({
      where: { id: storyId },
      data: { detectedLevel },
    });
    await new Promise((r) => setTimeout(r, USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS));

    // Step 5: Determine which levels to process
    // Only: detected level + user's level (if different)
    const levelsToProcess = new Set<string>([detectedLevel]);

    const userLevel = await getUserLevel(story.userId);
    if (userLevel && userLevel !== detectedLevel) {
      levelsToProcess.add(userLevel);
    }

    console.log(`Processing levels for story ${storyId}: ${Array.from(levelsToProcess).join(", ")}`);

    // Step 6: Process each level
    let allSucceeded = true;
    let anySucceeded = false;

    for (const level of levelsToProcess) {
      const levelRecord = story.levels.find((l) => l.level === level);
      if (!levelRecord) {
        console.warn(`Level record ${level} not found for story ${storyId}`);
        continue;
      }

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
      } catch (error) {
        allSucceeded = false;
        console.error(`Failed to process level ${level}:`, error);
      }
    }

    // Update overall status
    const finalStatus = allSucceeded && anySucceeded ? "READY" : anySucceeded ? "PARTIAL" : "FAILED";
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

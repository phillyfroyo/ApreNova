// src/lib/user-stories/metadata.ts
// Handles title, description, and metadata generation for user stories

import { OpenAI } from "openai";
import type { StoryType, StoryTag } from "@/types/story";
import { logOpenAICost } from "@/lib/cost-tracker";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

export interface TitleResult {
  title: string;
  titleEs: string;
  titleEn: string;
}

export interface DescriptionResult {
  description: string;
  descriptionEs: string;
  descriptionEn: string;
}

export interface HookResult {
  hook: string;
  hookEs: string;
  hookEn: string;
}

export type TargetAudience = "all" | "children" | "teen" | "adult";

export interface MetadataContext {
  storyId?: string;
  userId?: string;
}

// Valid story types for detection
const STORY_TYPES: StoryType[] = [
  "short-story", "poem", "fable", "folktale", "novel", "article",
  "dialogue", "song-lyrics", "epic", "myth", "legend", "movie-script", "tv-script"
];

// Valid tags for extraction
const STORY_TAGS: StoryTag[] = [
  "family", "friendship", "adventure", "mystery", "romance",
  "coming-of-age", "nature", "technology", "travel", "food",
  "humorous", "heartwarming", "suspenseful", "reflective", "inspiring",
  "urban", "rural", "historical", "fantasy", "contemporary",
  "latin-america", "spain", "usa", "multicultural",
  "epic", "mythology", "heroic", "tragedy", "comedy",
  "monsters", "heros-journey", "war", "love", "death", "revenge"
];

// ============================================================================
// TITLE GENERATION
// ============================================================================

/**
 * Extract or generate a title from the text
 * Uses GPT-4o-mini for fast, cost-effective title extraction
 */
export async function extractOrGenerateTitle(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<TitleResult> {
  const { storyId, userId } = context;
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 100,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "title", language },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

    const result = JSON.parse(cleaned);
    return {
      title: language === "es" ? result.titleEs : result.titleEn,
      titleEs: result.titleEs || result.title || "Sin título",
      titleEn: result.titleEn || result.title || "Untitled",
    };
  } catch {
    // Fallback: use first line if it looks like a title
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

// ============================================================================
// DESCRIPTION GENERATION
// ============================================================================

/**
 * Generate a description for the story
 * Uses GPT-4o-mini for fast, cost-effective description generation
 */
export async function generateDescription(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<DescriptionResult> {
  const { storyId, userId } = context;
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "description", language },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

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
// HOOK/TEASER GENERATION
// ============================================================================

/**
 * Generate a short hook/teaser for the story (max 15 words)
 * Uses GPT-4o-mini for fast, cost-effective generation
 */
export async function generateHook(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<HookResult> {
  const { storyId, userId } = context;
  const prompt =
    language === "es"
      ? `Lee el siguiente texto en español y escribe un gancho corto y atractivo (máximo 15 palabras) que capture la esencia y atraiga a los lectores. Debe ser intrigante y conciso.

Responde en JSON con este formato exacto:
{"hookEs": "gancho en español", "hookEn": "hook in English"}

Texto:
${text.substring(0, 1500)}`
      : `Read the following English text and write a short, engaging hook (maximum 15 words) that captures the essence and draws readers in. It should be intriguing and concise.

Respond in JSON with this exact format:
{"hookEs": "gancho en español", "hookEn": "hook in English"}

Text:
${text.substring(0, 1500)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "hook", language },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

    const result = JSON.parse(cleaned);
    return {
      hook: language === "es" ? result.hookEs : result.hookEn,
      hookEs: result.hookEs || "",
      hookEn: result.hookEn || "",
    };
  } catch {
    return {
      hook: "",
      hookEs: "",
      hookEn: "",
    };
  }
}

// ============================================================================
// STORY TYPE DETECTION
// ============================================================================

/**
 * Detect the story type from the content
 * Uses GPT-4o-mini for fast, cost-effective detection
 */
export async function detectStoryType(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<StoryType> {
  const { storyId, userId } = context;
  const typeList = STORY_TYPES.join(", ");

  const prompt =
    language === "es"
      ? `Analiza el siguiente texto y determina qué tipo de contenido es.

Opciones válidas: ${typeList}

Responde SOLO con una de las opciones exactas de arriba, sin explicación.

Texto:
${text.substring(0, 2000)}`
      : `Analyze the following text and determine what type of content it is.

Valid options: ${typeList}

Respond with ONLY one of the exact options above, no explanation.

Text:
${text.substring(0, 2000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 30,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "storyType", language },
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || "";

    // Validate the response is a valid story type
    if (STORY_TYPES.includes(response as StoryType)) {
      return response as StoryType;
    }

    // Fallback to short-story if not recognized
    return "short-story";
  } catch {
    return "short-story";
  }
}

// ============================================================================
// TARGET AUDIENCE DETECTION
// ============================================================================

/**
 * Detect the target audience for the story
 * Uses GPT-4o-mini for fast, cost-effective detection
 */
export async function detectTargetAudience(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<TargetAudience> {
  const { storyId, userId } = context;
  const prompt =
    language === "es"
      ? `Analiza el siguiente texto y determina la audiencia objetivo más apropiada.

Opciones:
- "children" (niños, contenido simple y apropiado para todas las edades)
- "teen" (adolescentes, puede incluir temas más complejos)
- "adult" (adultos, temas maduros o complejos)
- "all" (apropiado para todas las edades)

Responde SOLO con una palabra: children, teen, adult, o all

Texto:
${text.substring(0, 2000)}`
      : `Analyze the following text and determine the most appropriate target audience.

Options:
- "children" (simple content appropriate for all ages)
- "teen" (may include more complex themes)
- "adult" (mature or complex themes)
- "all" (appropriate for all ages)

Respond with ONLY one word: children, teen, adult, or all

Text:
${text.substring(0, 2000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 10,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "targetAudience", language },
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || "";

    if (["children", "teen", "adult", "all"].includes(response)) {
      return response as TargetAudience;
    }

    return "all";
  } catch {
    return "all";
  }
}

// ============================================================================
// TAG EXTRACTION
// ============================================================================

/**
 * Extract relevant tags from the story content
 * Uses GPT-4o-mini for fast, cost-effective extraction
 */
export async function extractTags(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<StoryTag[]> {
  const { storyId, userId } = context;
  const tagList = STORY_TAGS.join(", ");

  const prompt =
    language === "es"
      ? `Analiza el siguiente texto y selecciona de 2 a 5 etiquetas que mejor describan su contenido, temas y tono.

Etiquetas válidas: ${tagList}

Responde en JSON con este formato exacto:
{"tags": ["tag1", "tag2", "tag3"]}

Texto:
${text.substring(0, 2000)}`
      : `Analyze the following text and select 2 to 5 tags that best describe its content, themes, and tone.

Valid tags: ${tagList}

Respond in JSON with this exact format:
{"tags": ["tag1", "tag2", "tag3"]}

Text:
${text.substring(0, 2000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 100,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "tags", language },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

    const result = JSON.parse(cleaned);

    // Validate and filter to only valid tags
    const validTags = (result.tags || [])
      .filter((tag: string) => STORY_TAGS.includes(tag as StoryTag))
      .slice(0, 5) as StoryTag[];

    return validTags.length > 0 ? validTags : ["adventure"];
  } catch {
    return ["adventure"];
  }
}

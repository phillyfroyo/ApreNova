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
 * Extract or generate a title from the text.
 *
 * @deprecated Use generateAllMetadata() for batched API calls
 */
export async function extractOrGenerateTitle(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {}
): Promise<TitleResult> {
  const { storyId, userId } = context;

  // Use AI to extract or generate title
  // (Algorithmic extraction was removed - doesn't work for complex formats like Project Gutenberg)
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

// ============================================================================
// BATCHED METADATA GENERATION (Single API call for all metadata)
// ============================================================================

/**
 * Complete metadata result from batched generation
 */
export interface BatchedMetadataResult {
  title: TitleResult;
  description: DescriptionResult;
  hook: HookResult;
  storyType: StoryType;
  targetAudience: TargetAudience;
  tags: StoryTag[];
}

/**
 * Options for what metadata to include in the batched call
 */
export interface BatchedMetadataOptions {
  /** If provided, use this title instead of finding/generating */
  existingTitle?: string;
  /** If provided, use this description instead of finding/generating */
  existingDescription?: string;
  /**
   * If true, only generate essential metadata (title and description).
   * Skip hook, story type, audience, and tags - user can set these manually.
   * Recommended for user-uploaded stories to minimize cost.
   */
  essentialOnly?: boolean;
}

/**
 * Generate metadata in a single API call.
 *
 * Two modes:
 * - essentialOnly=true (user stories): Just title + description
 * - essentialOnly=false (admin stories): Full metadata including hook, type, audience, tags
 *
 * The AI will look for existing title/description in the text first,
 * and only generate if not found.
 *
 * @param text - The story text to analyze
 * @param language - Source language ("en" or "es")
 * @param context - Optional context for cost tracking
 * @param options - Options for what to include
 * @returns Metadata fields (advanced fields will have defaults if essentialOnly=true)
 */
export async function generateAllMetadata(
  text: string,
  language: "en" | "es",
  context: MetadataContext = {},
  options: BatchedMetadataOptions = {}
): Promise<BatchedMetadataResult> {
  const { storyId, userId } = context;
  const { existingTitle, existingDescription, essentialOnly = false } = options;

  const needsTitle = !existingTitle;
  const needsDescription = !existingDescription;

  // Sample text - first 2500 chars should contain title and enough for description
  const textSample = text.substring(0, 2500);

  // Build prompt based on what we need
  let prompt: string;

  if (essentialOnly) {
    // Minimal prompt for user stories - just title and description
    prompt = language === "es"
      ? `Analiza el siguiente texto en español y extrae/genera los metadatos esenciales.

${needsTitle ? `1. TÍTULO: Busca el título del texto (puede estar al principio, después de información del editor como "Project Gutenberg", etc.). Si no encuentras un título claro, genera uno conciso (máximo 5 palabras) que capture la esencia de la historia.` : ""}
${needsDescription ? `2. DESCRIPCIÓN: Busca si hay una descripción o resumen existente en el texto. Si no, escribe una descripción atractiva de 1-2 oraciones que capture la esencia sin revelar demasiado.` : ""}

Responde en JSON con este formato exacto:
{
  ${needsTitle ? '"titleEs": "título en español",\n  "titleEn": "title in English"' : ""}${needsTitle && needsDescription ? "," : ""}
  ${needsDescription ? '"descriptionEs": "descripción en español",\n  "descriptionEn": "description in English"' : ""}
}

Texto:
${textSample}`
      : `Analyze the following English text and extract/generate essential metadata.

${needsTitle ? `1. TITLE: Look for the title in the text (it may be at the beginning, after publisher information like "Project Gutenberg", etc.). If no clear title is found, generate a concise one (max 5 words) that captures the story's essence.` : ""}
${needsDescription ? `2. DESCRIPTION: Look for an existing description or summary in the text. If none, write an engaging 1-2 sentence description that captures the essence without revealing too much.` : ""}

Respond in JSON with this exact format:
{
  ${needsTitle ? '"titleEs": "título en español",\n  "titleEn": "title in English"' : ""}${needsTitle && needsDescription ? "," : ""}
  ${needsDescription ? '"descriptionEs": "descripción en español",\n  "descriptionEn": "description in English"' : ""}
}

Text:
${textSample}`;
  } else {
    // Full prompt for admin stories - includes hook, type, audience, tags
    const tagList = STORY_TAGS.join(", ");
    const typeList = STORY_TYPES.join(", ");

    prompt = language === "es"
      ? `Analiza el siguiente texto en español y extrae/genera los siguientes metadatos.

${needsTitle ? `1. TÍTULO: Busca el título del texto (puede estar al principio, después de información del editor, etc.). Si no encuentras un título claro, genera uno conciso (máximo 5 palabras).` : ""}
${needsDescription ? `2. DESCRIPCIÓN: Busca si hay una descripción existente. Si no, escribe una descripción atractiva de 1-2 oraciones.` : ""}
3. GANCHO: Escribe un gancho corto (máximo 15 palabras) que atraiga a los lectores.
4. TIPO: Determina el tipo de contenido. Opciones válidas: ${typeList}
5. AUDIENCIA: Determina la audiencia objetivo. Opciones: children, teen, adult, all
6. ETIQUETAS: Selecciona 2-5 etiquetas que describan el contenido. Opciones válidas: ${tagList}

Responde en JSON:
{
  ${needsTitle ? '"titleEs": "título",\n  "titleEn": "title",' : ""}
  ${needsDescription ? '"descriptionEs": "descripción",\n  "descriptionEn": "description",' : ""}
  "hookEs": "gancho",
  "hookEn": "hook",
  "storyType": "tipo",
  "targetAudience": "audiencia",
  "tags": ["tag1", "tag2"]
}

Texto:
${textSample}`
      : `Analyze the following English text and extract/generate metadata.

${needsTitle ? `1. TITLE: Look for the title in the text (may be after publisher info, etc.). If not found, generate a concise one (max 5 words).` : ""}
${needsDescription ? `2. DESCRIPTION: Look for an existing description. If none, write an engaging 1-2 sentence description.` : ""}
3. HOOK: Write a short hook (max 15 words) that draws readers in.
4. TYPE: Determine content type. Valid options: ${typeList}
5. AUDIENCE: Determine target audience. Options: children, teen, adult, all
6. TAGS: Select 2-5 tags. Valid options: ${tagList}

Respond in JSON:
{
  ${needsTitle ? '"titleEs": "título",\n  "titleEn": "title",' : ""}
  ${needsDescription ? '"descriptionEs": "descripción",\n  "descriptionEn": "description",' : ""}
  "hookEs": "gancho",
  "hookEn": "hook",
  "storyType": "type",
  "targetAudience": "audience",
  "tags": ["tag1", "tag2"]
}

Text:
${textSample}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a literary analyst. Always respond with valid JSON. For titles, prefer extracting existing titles from the text over generating new ones.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: essentialOnly ? 200 : 500,
    });

    // Log cost
    logOpenAICost("metadata", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: essentialOnly ? "essential" : "full", language },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleaned);

    // Build title result
    const titleResult: TitleResult = needsTitle
      ? {
          title: language === "es" ? result.titleEs : result.titleEn,
          titleEs: result.titleEs || "Sin título",
          titleEn: result.titleEn || "Untitled",
        }
      : {
          title: existingTitle!,
          titleEs: existingTitle!,
          titleEn: existingTitle!,
        };

    // Build description result
    const descriptionResult: DescriptionResult = needsDescription
      ? {
          description: language === "es" ? result.descriptionEs : result.descriptionEn,
          descriptionEs: result.descriptionEs || "",
          descriptionEn: result.descriptionEn || "",
        }
      : {
          description: existingDescription!,
          descriptionEs: existingDescription!,
          descriptionEn: existingDescription!,
        };

    // For essential-only mode, use empty defaults for advanced fields
    let hookResult: HookResult = { hook: "", hookEs: "", hookEn: "" };
    let storyType: StoryType = "short-story";
    let targetAudience: TargetAudience = "all";
    let tags: StoryTag[] = [];

    if (!essentialOnly) {
      // Build hook result
      hookResult = {
        hook: language === "es" ? result.hookEs : result.hookEn,
        hookEs: result.hookEs || "",
        hookEn: result.hookEn || "",
      };

      // Validate story type
      storyType = STORY_TYPES.includes(result.storyType as StoryType)
        ? (result.storyType as StoryType)
        : "short-story";

      // Validate target audience
      targetAudience = ["children", "teen", "adult", "all"].includes(result.targetAudience)
        ? (result.targetAudience as TargetAudience)
        : "all";

      // Validate tags
      tags = (result.tags || [])
        .filter((tag: string) => STORY_TAGS.includes(tag as StoryTag))
        .slice(0, 5) as StoryTag[];
    }

    console.log(
      `[Metadata] Generation complete (${essentialOnly ? "essential" : "full"}): ` +
      `title="${titleResult.title.substring(0, 40)}..."`
    );

    return {
      title: titleResult,
      description: descriptionResult,
      hook: hookResult,
      storyType,
      targetAudience,
      tags,
    };
  } catch (error) {
    console.error("[Metadata] Generation failed:", error);

    // Return defaults
    return {
      title: {
        title: existingTitle || (language === "es" ? "Mi Historia" : "My Story"),
        titleEs: existingTitle || "Mi Historia",
        titleEn: existingTitle || "My Story",
      },
      description: {
        description: existingDescription || "",
        descriptionEs: existingDescription || "",
        descriptionEn: existingDescription || "",
      },
      hook: { hook: "", hookEs: "", hookEn: "" },
      storyType: "short-story",
      targetAudience: "all",
      tags: [],
    };
  }
}

// src/lib/user-stories/metadata.ts
// Handles title, description, and metadata generation for user stories

import { OpenAI } from "openai";
import type { StoryType, StoryTag } from "@/types/story";
import { logOpenAICost } from "@/lib/cost-tracker";
import { extractFrontMatter } from "@/lib/text-processing";

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
  /**
   * Raw source text (e.g., original HTML before extraction) to use for title detection.
   * This is important because HTML extraction strips the Gutenberg `pg-header` section
   * which contains "Title: ..." metadata. By passing the raw HTML here, we can still
   * find the title even after extraction.
   */
  rawSourceText?: string;
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
  const { existingTitle, existingDescription, essentialOnly = false, rawSourceText } = options;

  const needsTitle = !existingTitle;
  const needsDescription = !existingDescription;

  // For title extraction: prefer raw source text (original HTML) if available
  // This is important because HTML extraction strips the Gutenberg `pg-header` section
  // which contains "Title: ..." metadata. The raw HTML preserves this.
  // Fall back to the processed text if no raw source is available.
  const titleSourceText = rawSourceText || text;
  const rawTextSampleForTitle = titleSourceText.substring(0, 2500);

  // For description: use cleaned content (actual story text after front matter removal)
  const { content: cleanedText } = extractFrontMatter(text);
  const contentSampleForDescription = cleanedText.substring(0, 2500);

  // Log which source is being used for title extraction
  const titleSource = rawSourceText ? "rawSourceText (original HTML)" : "text (processed content)";
  console.log(`[Metadata] Title extraction using: ${titleSource}, sample length: ${rawTextSampleForTitle.length}`);

  // Build prompt based on what we need
  let prompt: string;

  if (essentialOnly) {
    // Minimal prompt for user stories - just title and description
    // We send front matter for title (contains "Title: ..." pattern) and content for description
    prompt = language === "es"
      ? `Extrae/genera los metadatos esenciales para este texto.

${needsTitle ? `1. TÍTULO: Busca el título OFICIAL del libro en este orden de prioridad:
   a) Etiqueta HTML <meta name="dc.title" content="..."> - usa el valor de content exactamente
   b) Línea "Title: ..." en los metadatos - usa el texto después de "Title:" exactamente
   c) Si no encuentras ninguno, genera un título conciso (máximo 5 palabras)

   IMPORTANTE: IGNORA textos promocionales como "The Project Gutenberg eBook of..." o "The Complete Project Gutenberg...". Estos NO son el título oficial.` : ""}
${needsDescription ? `2. DESCRIPCIÓN: Una descripción de 1-2 oraciones del texto, en ambos idiomas. Sigue estas reglas:
   - Si el texto contiene una descripción o resumen existente (en el prefacio, introducción o metadatos), úsalo EXACTAMENTE como está escrito si tiene 2 oraciones o menos.
   - Si la descripción encontrada tiene más de 2 oraciones, condénsala a 1-2 oraciones usando las MISMAS PALABRAS del original, parafraseando solo si es necesario.
   - Si NO se encuentra ninguna descripción en el texto, escribe una descripción profesional de 1-2 oraciones basada en el contenido.` : ""}

Responde en JSON:
{
  ${needsTitle ? '"titleEs": "título en español",\n  "titleEn": "title in English"' : ""}${needsTitle && needsDescription ? "," : ""}
  ${needsDescription ? '"descriptionEs": "descripción en español",\n  "descriptionEn": "description in English"' : ""}
}

${needsTitle ? `TEXTO ORIGINAL (busca el título aquí - puede contener HTML):\n${rawTextSampleForTitle}\n` : ""}
${needsDescription ? `CONTENIDO DE LA HISTORIA (para descripción):\n${contentSampleForDescription}` : ""}`
      : `Extract/generate essential metadata for this text.

${needsTitle ? `1. TITLE: Find the OFFICIAL book title in this priority order:
   a) HTML meta tag <meta name="dc.title" content="..."> - use the content value exactly
   b) "Title: ..." line in metadata - use the text after "Title:" exactly
   c) If neither found, generate a concise title (max 5 words)

   IMPORTANT: IGNORE promotional text like "The Project Gutenberg eBook of..." or "The Complete Project Gutenberg...". These are NOT the official title.` : ""}
${needsDescription ? `2. DESCRIPTION: A 1-2 sentence description of the text, in both languages. Follow these rules:
   - If the text contains an existing description or summary (in a preface, introduction, or metadata), use it EXACTLY as written if it is 2 sentences or fewer.
   - If the found description is longer than 2 sentences, condense it to 1-2 sentences using the SAME WORDS as the original, paraphrasing only slightly if needed.
   - If NO description is found in the text, write a professional 1-2 sentence description based on the content.` : ""}

Respond in JSON:
{
  ${needsTitle ? '"titleEs": "título en español",\n  "titleEn": "title in English"' : ""}${needsTitle && needsDescription ? "," : ""}
  ${needsDescription ? '"descriptionEs": "descripción en español",\n  "descriptionEn": "description in English"' : ""}
}

${needsTitle ? `RAW TEXT (look for title here - may contain HTML):\n${rawTextSampleForTitle}\n` : ""}
${needsDescription ? `STORY CONTENT (for description):\n${contentSampleForDescription}` : ""}`;
  } else {
    // Full prompt for admin stories - includes hook, type, audience, tags
    const tagList = STORY_TAGS.join(", ");
    const typeList = STORY_TYPES.join(", ");

    prompt = language === "es"
      ? `Extrae/genera metadatos para este texto.

${needsTitle ? `1. TÍTULO: Busca el título OFICIAL del libro en este orden de prioridad:
   a) Etiqueta HTML <meta name="dc.title" content="..."> - usa el valor de content exactamente
   b) Línea "Title: ..." en los metadatos - usa el texto después de "Title:" exactamente
   c) Si no encuentras ninguno, genera un título conciso (máximo 5 palabras)
   IMPORTANTE: IGNORA textos promocionales como "The Project Gutenberg eBook of..." o "The Complete Project Gutenberg...".` : ""}
${needsDescription ? `2. DESCRIPCIÓN: Una descripción de 1-2 oraciones del texto. Si el texto contiene una descripción existente, úsala exactamente o condénsala usando las mismas palabras. Si no hay descripción, escribe una profesional basada en el contenido.` : ""}
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

${needsTitle ? `TEXTO ORIGINAL (puede contener HTML):\n${rawTextSampleForTitle}\n` : ""}
CONTENIDO:
${contentSampleForDescription}`
      : `Extract/generate metadata for this text.

${needsTitle ? `1. TITLE: Find the OFFICIAL book title in this priority order:
   a) HTML meta tag <meta name="dc.title" content="..."> - use the content value exactly
   b) "Title: ..." line in metadata - use the text after "Title:" exactly
   c) If neither found, generate a concise title (max 5 words)
   IMPORTANT: IGNORE promotional text like "The Project Gutenberg eBook of..." or "The Complete Project Gutenberg...".` : ""}
${needsDescription ? `2. DESCRIPTION: A 1-2 sentence description. If the text contains an existing description, use it exactly or condense it using the same words. If no description is found, write a professional one based on the content.` : ""}
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

${needsTitle ? `RAW TEXT (may contain HTML):\n${rawTextSampleForTitle}\n` : ""}
CONTENT:
${contentSampleForDescription}`;
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
    // Priority: 1) existing title, 2) AI-extracted/generated title
    const titleResult: TitleResult = !needsTitle
      ? {
          title: existingTitle!,
          titleEs: existingTitle!,
          titleEn: existingTitle!,
        }
      : {
          // AI extracts from front matter "Title: ..." or generates if not found
          title: language === "es" ? result.titleEs : result.titleEn,
          titleEs: result.titleEs || "Sin título",
          titleEn: result.titleEn || "Untitled",
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

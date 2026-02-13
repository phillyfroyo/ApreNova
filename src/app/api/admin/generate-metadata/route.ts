// src/app/api/admin/generate-metadata/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logOpenAICost, logDalleCost } from "@/lib/cost-tracker";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateMetadataRequest {
  storyText: string;
  sourceLanguage: "en" | "es";
  type: "title" | "description" | "image" | "background" | "translate-to-spanish" | "translate-to-english" | "bundle";
  customPrompt?: string;
  slug?: string; // For cost tracking
  frontMatter?: string; // For algorithmic title extraction from Gutenberg
  existingTitle?: { en: string; es: string }; // For translating existing title in bundle
}

export async function POST(req: NextRequest) {
  try {
    const { storyText, sourceLanguage, type, customPrompt, slug, frontMatter, existingTitle }: GenerateMetadataRequest = await req.json();

    if (!storyText || typeof storyText !== "string") {
      return NextResponse.json({ error: "Story text is required" }, { status: 400 });
    }

    if (!type || !["title", "description", "image", "background", "translate-to-spanish", "translate-to-english", "bundle"].includes(type)) {
      return NextResponse.json({ error: "Valid type (title/description/image/background/translate-to-spanish/translate-to-english/bundle) is required" }, { status: 400 });
    }

    // For image generation, use DALL-E
    if (type === "image") {
      return generateImage(storyText, sourceLanguage, customPrompt, "thumbnail", slug);
    }

    // For background image generation, use DALL-E with landscape format
    if (type === "background") {
      return generateImage(storyText, sourceLanguage, customPrompt, "background", slug);
    }

    // For translation to Spanish
    if (type === "translate-to-spanish") {
      return translateText(storyText, "es", slug);
    }

    // For translation to English
    if (type === "translate-to-english") {
      return translateText(storyText, "en", slug);
    }

    // For bundled metadata generation (title, displayTitle, slug, hook in one call)
    if (type === "bundle") {
      return generateBundledMetadata(storyText, sourceLanguage, frontMatter, customPrompt, slug, existingTitle);
    }

    // For title and description, use GPT-4o
    return generateTextMetadata(storyText, sourceLanguage, type, customPrompt, slug);
  } catch (error) {
    console.error("Generate metadata error:", error);
    return NextResponse.json(
      { error: "Failed to generate metadata", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function generateTextMetadata(
  storyText: string,
  sourceLanguage: "en" | "es",
  type: "title" | "description",
  customPrompt?: string,
  slug?: string
) {
  const isTitle = type === "title";
  const langName = sourceLanguage === "en" ? "English" : "Spanish";
  const otherLang = sourceLanguage === "en" ? "Spanish" : "English";

  const systemPrompt = isTitle
    ? `You are a creative writer specializing in crafting compelling story titles for language learners.
Generate exactly 3 unique title options for the story provided.
Each title should be engaging, memorable, and appropriate for the story's tone and content.
Provide titles in both ${langName} and ${otherLang}.`
    : `You are a skilled copywriter creating story descriptions for a language learning app.
Generate exactly 3 unique description options for the story provided.
Each description should be 1-2 sentences, enticing readers to read the story.
Descriptions should hint at the story without spoilers.
Provide descriptions in both ${langName} and ${otherLang}.`;

  const userPrompt = `Story text (${langName}):
"""
${storyText.slice(0, 2000)}${storyText.length > 2000 ? "..." : ""}
"""

${customPrompt ? `Additional guidance: ${customPrompt}\n\n` : ""}Generate 3 ${type} options. Return as JSON in this exact format:
{
  "options": [
    { "en": "English ${type} 1", "es": "Spanish ${type} 1" },
    { "en": "English ${type} 2", "es": "Spanish ${type} 2" },
    { "en": "English ${type} 3", "es": "Spanish ${type} 3" }
  ]
}

Return ONLY the JSON, no other text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  // Log cost (fire-and-forget) - admin operations don't have userId
  logOpenAICost("metadata", "gpt-4o", response.usage, {
    metadata: { type, admin: true, ...(slug && { adminStorySlug: slug }) },
  });

  const content = response.choices[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  try {
    // Parse the JSON response, handling potential markdown code blocks
    const cleanedContent = content
      .replace(/^```json\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();

    const parsed = JSON.parse(cleanedContent);

    return NextResponse.json({
      type,
      options: parsed.options,
    });
  } catch (parseError) {
    console.error("Failed to parse AI response:", content);
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: content },
      { status: 500 }
    );
  }
}

/**
 * Generate title, displayTitle, slug, and hook in a single API call
 */
async function generateBundledMetadata(
  storyText: string,
  sourceLanguage: "en" | "es",
  frontMatter?: string,
  customPrompt?: string,
  slug?: string,
  existingTitle?: { en: string; es: string }
) {
  const langName = sourceLanguage === "en" ? "English" : "Spanish";
  const otherLang = sourceLanguage === "en" ? "Spanish" : "English";

  // Check if we have an existing title that needs translation
  const hasExistingTitle = existingTitle && (existingTitle.en || existingTitle.es);
  const existingTitleText = hasExistingTitle
    ? `The user has already provided this title: EN="${existingTitle?.en || ""}", ES="${existingTitle?.es || ""}". Use this exact title and translate to the missing language.`
    : "";

  const systemPrompt = `You are a metadata extractor for stories in a language learning app.

Generate the following metadata for the story provided:

1. TITLE:
   - IMPORTANT: First check the front matter for an existing title (look for "Title:" field). If found, use that EXACT title - do NOT create a new one.
   - Only create a new title if NO title exists in the front matter.
   - Provide in both ${langName} and ${otherLang} (translate the existing title if needed).
   ${existingTitleText ? `- ${existingTitleText}` : ""}

2. DISPLAY_TITLE: A shorter 1-3 word version for cards/navigation. Remove subtitles, parentheticals, and author names UNLESS removing the author leaves a generic non-descriptive title.
   Examples:
   - "Poems by Emily Dickinson, Three Series, Complete" → "Poems by Emily Dickinson" (keep author because "Poems" alone is too generic)
   - "Beowulf: An Anglo-Saxon Epic Poem" → "Beowulf"
   - "Moby Dick; Or, The Whale" → "Moby Dick"
   - "Pride and Prejudice by Jane Austen" → "Pride and Prejudice"
   - "Romeo and Juliet by William Shakespeare" → "Romeo and Juliet"

3. SLUG: A URL-friendly identifier (lowercase, hyphens, no special chars, max 50 chars)

4. HOOK: A 1-2 sentence teaser that entices readers without spoilers, in both languages

5. DESCRIPTION: A 2-4 sentence description of the work, in both languages. Follow these rules strictly:
   - If the front matter or text contains a description/summary of 4 sentences or fewer, use it EXACTLY as written (word for word).
   - If the front matter or text contains a description/summary longer than 4 sentences, condense it to 2-4 sentences using the SAME WORDS as the original. Paraphrase only slightly if needed to fit.
   - If NO description is found in the text, write a professional 2-4 sentence description based on the metadata and content.
   - The description should be informative and literary in tone, NOT a marketing hook.

   Example — given a long preface about Emily Dickinson's poems, the description should be:
   EN: "This collection brings together the early published poems of Emily Dickinson, edited after her death by Mabel Loomis Todd and T. W. Higginson. Written largely without thought of publication, her verses reflect a fiercely independent spirit and an unconventional style that defied the literary norms of her time. A lifelong recluse from Amherst, Massachusetts, Dickinson produced poems of striking originality—flashes of profound insight into nature, life, faith, and death—marked by vivid imagery, daring thought, and a voice unlike any other in American poetry."
   ES: "Esta colección reúne los primeros poemas publicados de Emily Dickinson, editados después de su muerte por Mabel Loomis Todd y T. W. Higginson. Escritos en su mayoría sin intención de ser publicados, sus versos reflejan un espíritu profundamente independiente y un estilo poco convencional que desafiaba las normas literarias de su época. Reclusa gran parte de su vida en Amherst, Massachusetts, Dickinson creó poemas de una originalidad impactante: destellos de profunda reflexión sobre la naturaleza, la vida, la fe y la muerte, marcados por imágenes vívidas, pensamientos audaces y una voz única en la poesía estadounidense."

Provide 2 options for variety (different hooks/descriptions, but the title should be the same if extracted from front matter).`;

  const userPrompt = `Story text (${langName}):
"""
${storyText.slice(0, 2500)}${storyText.length > 2500 ? "..." : ""}
"""

${frontMatter ? `Front matter:\n"""\n${frontMatter.slice(0, 2000)}\n"""\n\n` : ""}${customPrompt ? `Additional guidance: ${customPrompt}\n\n` : ""}Generate 2 complete metadata options. Return as JSON in this exact format:
{
  "options": [
    {
      "title": { "en": "Full English Title", "es": "Full Spanish Title" },
      "displayTitle": { "en": "Short", "es": "Corto" },
      "slug": "url-friendly-slug",
      "hook": { "en": "English hook teaser.", "es": "Spanish hook teaser." },
      "description": { "en": "Full English description 2-4 sentences.", "es": "Full Spanish description 2-4 sentences." }
    },
    {
      "title": { "en": "Alt Full Title", "es": "Alt Full Title Spanish" },
      "displayTitle": { "en": "Alt Short", "es": "Alt Corto" },
      "slug": "alt-slug",
      "hook": { "en": "Alternative hook.", "es": "Gancho alternativo." },
      "description": { "en": "Alternative description.", "es": "Descripción alternativa." }
    }
  ]
}

Return ONLY the JSON, no other text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2500,
  });

  // Log cost (fire-and-forget)
  logOpenAICost("metadata", "gpt-4o", response.usage, {
    metadata: { type: "bundle", admin: true, ...(slug && { adminStorySlug: slug }) },
  });

  const content = response.choices[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  try {
    const cleanedContent = content
      .replace(/^```json\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();

    const parsed = JSON.parse(cleanedContent);

    return NextResponse.json({
      type: "bundle",
      options: parsed.options,
    });
  } catch (parseError) {
    console.error("Failed to parse bundled metadata response:", content);
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: content },
      { status: 500 }
    );
  }
}

async function generateImage(
  storyText: string,
  sourceLanguage: "en" | "es",
  customPrompt?: string,
  imageType: "thumbnail" | "background" = "thumbnail",
  slug?: string
) {
  // Create a prompt for DALL-E based on the story content
  const langName = sourceLanguage === "en" ? "English" : "Spanish";

  const isThumbnail = imageType === "thumbnail";

  // If admin provides a custom prompt, use it directly as the image description
  // Otherwise, extract key visuals from the story
  const hasCustomPrompt = customPrompt && customPrompt.trim().length > 0;

  const systemContent = hasCustomPrompt
    ? `You create DALL-E image prompts based on the admin's description.

Your job:
1. Take the admin's image description and expand it into a clear DALL-E prompt
2. Keep the core subject/scene exactly as the admin described
3. Add enough detail for DALL-E to generate a good image
4. Keep it under 100 words

The image is for a ${isThumbnail ? "book cover thumbnail (portrait format)" : "reading background (landscape, should be subtle/atmospheric)"}.`
    : `You extract the key visual elements from a story to create a DALL-E image prompt.

Your job:
1. Identify the main subject, setting, or central moment of the story
2. Describe it concisely (under 100 words)
3. Focus on WHAT to show, not HOW to render it

The image is for a ${isThumbnail ? "book cover thumbnail (portrait format)" : "reading background (landscape, should be subtle/atmospheric)"}.`;

  const userContent = hasCustomPrompt
    ? `Admin's image description: ${customPrompt}

Create a DALL-E prompt based on this description. Return ONLY the prompt text.`
    : `Story (${langName}):
"""
${storyText.slice(0, 1500)}
"""

Create a DALL-E prompt describing the key visual from this story. Return ONLY the prompt text.`;

  // First, use GPT to create a good image prompt from the story
  const promptResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  // Log cost (fire-and-forget)
  logOpenAICost("thumbnail", "gpt-4o", promptResponse.usage, {
    metadata: { type: "prompt-generation", imageType, admin: true, ...(slug && { adminStorySlug: slug }) },
  });

  let imagePrompt = promptResponse.choices[0]?.message?.content?.trim();

  if (!imagePrompt) {
    return NextResponse.json({ error: "Failed to generate image prompt" }, { status: 500 });
  }

  // DALL-E 3 sizes:
  // - 1024x1792: Portrait (close to 2:3 ratio for thumbnails)
  // - 1792x1024: Landscape (close to 16:9 for backgrounds)
  // - 1024x1024: Square
  const imageSize = isThumbnail ? "1024x1792" : "1792x1024";

  // Helper to generate a single image with retry logic
  async function generateSingleImage(prompt: string, attempt = 1): Promise<{ url: string; revisedPrompt?: string } | null> {
    try {
      const result = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: imageSize as "1024x1024" | "1024x1792" | "1792x1024",
        quality: "standard",
      });

      if (result.data && result.data[0]?.url) {
        // Log DALL-E cost (fire-and-forget)
        logDalleCost("thumbnail", 1, imageSize, {
          metadata: { imageType, admin: true, ...(slug && { adminStorySlug: slug }) },
        });

        return {
          url: result.data[0].url,
          revisedPrompt: result.data[0].revised_prompt,
        };
      }
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`DALL-E attempt ${attempt} failed:`, errorMessage);

      // Retry once on rate limit or timeout errors
      if (attempt === 1 && (errorMessage.includes("rate") || errorMessage.includes("timeout") || errorMessage.includes("529"))) {
        console.log("Retrying after 2 second delay...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateSingleImage(prompt, 2);
      }

      return null;
    }
  }

  try {
    // Generate images sequentially with a small delay to avoid rate limits
    // This is more reliable than parallel when running multiple image generations
    const image1 = await generateSingleImage(imagePrompt);

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    const image2 = await generateSingleImage(imagePrompt + " (alternative perspective)");

    const options: Array<{ url: string; revisedPrompt?: string }> = [];

    if (image1) options.push(image1);
    if (image2) options.push(image2);

    if (options.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to generate any images. Please try again.",
          prompt: imagePrompt,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      type: imageType === "thumbnail" ? "image" : "background",
      options,
      originalPrompt: imagePrompt,
    });
  } catch (imageError) {
    console.error("DALL-E error:", imageError);
    return NextResponse.json(
      {
        error: "Failed to generate images",
        details: imageError instanceof Error ? imageError.message : "Unknown error",
        prompt: imagePrompt
      },
      { status: 500 }
    );
  }
}

async function translateText(text: string, targetLanguage: "en" | "es", slug?: string) {
  // Text may contain multiple items separated by ---SEPARATOR---
  const items = text.split("\n\n---SEPARATOR---\n\n");

  const sourceLangName = targetLanguage === "es" ? "English" : "Spanish";
  const targetLangName = targetLanguage === "es" ? "Spanish" : "English";

  const systemPrompt = `You are an expert ${sourceLangName} to ${targetLangName} translator. Translate the following text(s) to ${targetLangName}.
- Maintain the original meaning and tone
- For titles, keep proper nouns unchanged
- Return accurate, natural-sounding ${targetLangName}

Return the translations as a JSON array of strings, one for each input item.`;

  const userPrompt = items.length === 1
    ? `Translate to ${targetLangName}:\n"${items[0]}"\n\nReturn as JSON: { "translations": ["${targetLangName} translation here"] }`
    : `Translate each of these ${items.length} texts to ${targetLangName}:\n\n${items.map((item, i) => `${i + 1}. "${item}"`).join("\n\n")}\n\nReturn as JSON: { "translations": ["translation1", "translation2", ...] }`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  // Log cost (fire-and-forget)
  logOpenAICost("translation", "gpt-4o", response.usage, {
    metadata: { targetLanguage, admin: true, ...(slug && { adminStorySlug: slug }) },
  });

  const content = response.choices[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  try {
    const cleanedContent = content
      .replace(/^```json\n?/g, "")
      .replace(/\n?```$/g, "")
      .trim();

    const parsed = JSON.parse(cleanedContent);

    return NextResponse.json({
      translatedTexts: parsed.translations,
    });
  } catch (parseError) {
    console.error("Failed to parse translation response:", content);
    return NextResponse.json(
      { error: "Failed to parse translation response", raw: content },
      { status: 500 }
    );
  }
}

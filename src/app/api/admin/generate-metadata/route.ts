// src/app/api/admin/generate-metadata/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateMetadataRequest {
  storyText: string;
  sourceLanguage: "en" | "es";
  type: "title" | "description" | "image" | "background";
  customPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { storyText, sourceLanguage, type, customPrompt }: GenerateMetadataRequest = await req.json();

    if (!storyText || typeof storyText !== "string") {
      return NextResponse.json({ error: "Story text is required" }, { status: 400 });
    }

    if (!type || !["title", "description", "image", "background"].includes(type)) {
      return NextResponse.json({ error: "Valid type (title/description/image/background) is required" }, { status: 400 });
    }

    // For image generation, use DALL-E
    if (type === "image") {
      return generateImage(storyText, sourceLanguage, customPrompt, "thumbnail");
    }

    // For background image generation, use DALL-E with landscape format
    if (type === "background") {
      return generateImage(storyText, sourceLanguage, customPrompt, "background");
    }

    // For title and description, use GPT-4o
    return generateTextMetadata(storyText, sourceLanguage, type, customPrompt);
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
  customPrompt?: string
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

async function generateImage(
  storyText: string,
  sourceLanguage: "en" | "es",
  customPrompt?: string,
  imageType: "thumbnail" | "background" = "thumbnail"
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

// src/app/api/user-stories/generate-thumbnail/route.ts
// Generate AI thumbnail for user stories using DALL-E 3

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { BlobServiceClient } from "@azure/storage-blob";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "thumbnails";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storyId } = body;

    if (!storyId) {
      return NextResponse.json(
        { error: "storyId is required" },
        { status: 400 }
      );
    }

    // Verify ownership and get story content
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
      select: {
        id: true,
        rawContent: true,
        sourceLanguage: true,
        title: true,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    console.log("[Generate Thumbnail] Starting for story:", storyId);

    // Step 1: Generate image prompt from story content
    const sourceLanguage = story.sourceLanguage as "en" | "es";
    const langName = sourceLanguage === "en" ? "English" : "Spanish";

    const systemContent = `You extract the key visual elements from a story to create a DALL-E image prompt.

Your job:
1. Identify the main subject, setting, or central moment of the story
2. Describe it concisely (under 100 words)
3. Focus on WHAT to show, not HOW to render it

The image is for a book cover thumbnail (portrait format).`;

    const userContent = `Story (${langName}):
"""
${story.rawContent.slice(0, 1500)}
"""

Create a DALL-E prompt describing the key visual from this story. Return ONLY the prompt text.`;

    const promptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const imagePrompt = promptResponse.choices[0]?.message?.content?.trim();

    if (!imagePrompt) {
      return NextResponse.json(
        { error: "Failed to generate image prompt" },
        { status: 500 }
      );
    }

    console.log("[Generate Thumbnail] Image prompt:", imagePrompt);

    // Step 2: Generate images with DALL-E 3
    const generateSingleImage = async (
      prompt: string,
      attempt = 1
    ): Promise<{ url: string; revisedPrompt?: string } | null> => {
      try {
        const result = await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1792", // Portrait format for thumbnails
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
        if (
          attempt === 1 &&
          (errorMessage.includes("rate") ||
            errorMessage.includes("timeout") ||
            errorMessage.includes("529"))
        ) {
          console.log("Retrying after 2 second delay...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return generateSingleImage(prompt, 2);
        }

        return null;
      }
    };

    // Generate two image options
    const image1 = await generateSingleImage(imagePrompt);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));

    const image2 = await generateSingleImage(
      imagePrompt + " (alternative perspective)"
    );

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

    console.log("[Generate Thumbnail] Generated", options.length, "images");

    return NextResponse.json({
      success: true,
      options,
      prompt: imagePrompt,
    });
  } catch (error: any) {
    console.error("[Generate Thumbnail] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate thumbnail", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Upload selected DALL-E image to Azure Blob Storage
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!connectionString) {
      console.error("[Upload] Missing AZURE_STORAGE_CONNECTION_STRING");
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { storyId, imageUrl } = body;

    if (!storyId || !imageUrl) {
      return NextResponse.json(
        { error: "storyId and imageUrl are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const story = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        userId: session.user.id,
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    console.log("[Upload AI Thumbnail] Downloading from DALL-E URL...");

    // Download the image from DALL-E URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download image from DALL-E" },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get("content-type") || "image/png";

    // Generate unique filename
    const timestamp = Date.now();
    const extension = contentType.includes("png") ? "png" : "jpg";
    const blobName = `${session.user.id}/${storyId}-ai-${timestamp}.${extension}`;

    // Upload to Azure Blob Storage
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    const permanentUrl = blockBlobClient.url;

    console.log("[Upload AI Thumbnail] Uploaded to:", permanentUrl);

    // Update story with new thumbnail URL
    await prisma.userStory.update({
      where: { id: storyId },
      data: { thumbnailUrl: permanentUrl },
    });

    return NextResponse.json({
      success: true,
      url: permanentUrl,
    });
  } catch (error: any) {
    console.error("[Upload AI Thumbnail] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to upload thumbnail", details: error.message },
      { status: 500 }
    );
  }
}

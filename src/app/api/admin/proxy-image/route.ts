// src/app/api/admin/proxy-image/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint to fetch images from external URLs (bypassing CORS)
 * Used for DALL-E generated images which are hosted on Azure blob storage
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid imageUrl" },
        { status: 400 }
      );
    }

    // Validate that the URL is from a trusted source (OpenAI/Azure)
    // DALL-E 3 uses various Azure blob storage endpoints
    const trustedPatterns = [
      /\.blob\.core\.windows\.net$/,  // Any Azure blob storage
      /openai\.com$/,
      /oaidalleapiprodscus/,
      /dalleprodsec/,
    ];

    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format", url: imageUrl },
        { status: 400 }
      );
    }

    const isTrusted = trustedPatterns.some(pattern => pattern.test(url.hostname));
    if (!isTrusted) {
      console.log("Untrusted domain rejected:", url.hostname);
      return NextResponse.json(
        { error: "URL is not from a trusted source", hostname: url.hostname },
        { status: 400 }
      );
    }

    // Fetch the image server-side with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Image fetch failed:", response.status, response.statusText);
        return NextResponse.json(
          { error: "Failed to fetch image from source", status: response.status },
          { status: response.status }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const contentType = response.headers.get("content-type") || "image/png";

      // Return as base64 data URL
      const dataUrl = `data:${contentType};base64,${base64}`;

      return NextResponse.json({ dataUrl });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Image fetch timed out after 30 seconds" },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Proxy image error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

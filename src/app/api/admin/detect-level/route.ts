// src/app/api/admin/detect-level/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateDetectionPrompt } from "@/lib/admin/cefr-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Take a sample of the text (first 1500 chars) for analysis
    const sampleText = text.slice(0, 1500);
    const prompt = generateDetectionPrompt(sampleText, language || "en");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a CEFR language level assessment expert. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const result = JSON.parse(content);

    return NextResponse.json({
      level: result.level,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error("CEFR detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect level" },
      { status: 500 }
    );
  }
}

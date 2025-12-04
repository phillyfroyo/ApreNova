// src/app/api/admin/rewrite-level/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateRewritePrompt } from "@/lib/admin/cefr-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLanguage, targetLevel, sourceLevel } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!targetLevel || targetLevel < 1 || targetLevel > 5) {
      return NextResponse.json({ error: "Valid target level (1-5) is required" }, { status: 400 });
    }

    // If target level matches source level, return original text
    if (targetLevel === sourceLevel) {
      return NextResponse.json({
        rewrittenText: text,
        targetLevel,
        wasRewritten: false,
      });
    }

    const prompt = generateRewritePrompt(targetLevel, text, sourceLanguage);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert language educator specializing in CEFR-leveled content creation.
You rewrite stories to match specific CEFR levels while preserving meaning, plot, and character names.
Return ONLY the rewritten text with the same line structure as the input.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const rewrittenText = response.choices[0]?.message?.content?.trim();

    if (!rewrittenText) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json({
      rewrittenText,
      targetLevel,
      wasRewritten: true,
    });
  } catch (error) {
    console.error("Level rewrite error:", error);
    return NextResponse.json({ error: "Failed to rewrite text" }, { status: 500 });
  }
}

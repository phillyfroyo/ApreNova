// src/app/api/admin/translate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateTranslationPrompt } from "@/lib/admin/cefr-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, fromLanguage, level } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!fromLanguage || !["en", "es"].includes(fromLanguage)) {
      return NextResponse.json({ error: "Valid fromLanguage (en/es) is required" }, { status: 400 });
    }

    if (!level || level < 1 || level > 5) {
      return NextResponse.json({ error: "Valid level (1-5) is required" }, { status: 400 });
    }

    const toLanguage = fromLanguage === "en" ? "Spanish" : "English";
    const prompt = generateTranslationPrompt(text, fromLanguage, level);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert translator specializing in ${fromLanguage === "en" ? "English to Spanish" : "Spanish to English"} translation for language learners.
Maintain the same CEFR level complexity in your translations.
Return ONLY the translated text, preserving the exact line-by-line structure of the input.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const translatedText = response.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json({
      translatedText,
      fromLanguage,
      toLanguage: fromLanguage === "en" ? "es" : "en",
      level,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Failed to translate text" }, { status: 500 });
  }
}

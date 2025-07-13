// src\app\api\translate-phrase\route.ts

import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getPhrasePrompt } from '@/lib/getPhrasePrompt';
import { getPhrasePromptToEnglish } from '@/lib/getPhrasePromptToEnglish';


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(req: NextRequest) {
  const inputParam = req.nextUrl.searchParams.get('input');
  const sentenceParam = req.nextUrl.searchParams.get('sentence');
  const levelParam = req.nextUrl.searchParams.get('level');

  if (!inputParam || !sentenceParam || !levelParam) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const phrase = inputParam.trim();
  const sentence = sentenceParam.trim();
  const level = parseInt(levelParam.trim());

const langParam = req.nextUrl.searchParams.get('lang') ?? 'es';
const isSpanishToEnglish = langParam === 'en';

console.log("🌐 langParam:", langParam, "→ using ToEnglish:", isSpanishToEnglish);

const prompt = isSpanishToEnglish
  ? getPhrasePromptToEnglish(phrase, sentence, level)
  : getPhrasePrompt(phrase, sentence, level);
  console.log("🧠 Prompt to GPT:", prompt);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const result = completion.choices[0]?.message?.content;
    console.log("🧠 Raw GPT response:", result);

    const cleaned = result?.replace(/^```json\n?|```$/g, '').trim();

    try {
  const parsed = JSON.parse(cleaned!);

  if (typeof parsed === "object" && parsed.primary) {
    return NextResponse.json({ translations: parsed });
  } else if (Array.isArray(parsed)) {
    return NextResponse.json({ translations: { primary: parsed[0], otherCommonTranslations: parsed.slice(1) } });
  } else {
    throw new Error("Invalid GPT response structure");
  }
} catch (parseErr) {
  console.error("❌ GPT response parsing failed:", cleaned);
  return NextResponse.json({ error: "Invalid GPT response format" }, { status: 500 });
}
  } catch (e) {
    console.error("🔥 GPT request failed:", e);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}

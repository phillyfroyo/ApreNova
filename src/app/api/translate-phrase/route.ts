// src\app\api\translate-phrase\route.ts

import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getPhrasePrompt } from '@/lib/getPhrasePrompt';
import { getPhrasePromptToEnglish } from '@/lib/getPhrasePromptToEnglish';
import { PHRASE_TRANSLATION_RESPONSE_FORMAT, type PhraseTranslationResult } from "@/lib/phraseTranslationSchema";
import { logOpenAICost } from "@/lib/cost-tracker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  // Require authentication for AI API calls
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { phrase, sentence, level, context } = await req.json();

  if (!phrase || !sentence || !level) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

const langParam = req.nextUrl.searchParams.get('lang') ?? 'es';
const isSpanishToEnglish = langParam === 'en';

console.log("🌐 langParam:", langParam, "→ using ToEnglish:", isSpanishToEnglish);

const prompt = isSpanishToEnglish
  ? getPhrasePromptToEnglish(phrase, sentence, level, context)
  : getPhrasePrompt(phrase, sentence, level, context);
  console.log("🧠 Prompt to GPT:", prompt);

  try {
    // Structured output via json_schema (strict): GPT-4o is constrained to our
    // schema, so the reply is always valid JSON — no more ```json``` stripping
    // or parse-failure 500s. Temp lowered 0.7 -> 0.3 for steadier translations.
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: PHRASE_TRANSLATION_RESPONSE_FORMAT,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("translate-phrase", "gpt-4o", completion.usage, { userId: session.user.id });

    const result = completion.choices[0]?.message?.content;
    console.log("🧠 Raw GPT response:", result);

    // A strict-schema refusal/empty completion is the only way content is absent.
    if (!result) {
      console.error("❌ Empty GPT response", completion.choices[0]?.finish_reason);
      return NextResponse.json({ error: "Invalid GPT response format" }, { status: 500 });
    }

    const parsed = JSON.parse(result) as PhraseTranslationResult;
    return NextResponse.json({
      translations: {
        primary: parsed.primary ?? "",
        otherCommonTranslations: parsed.otherCommonTranslations ?? [],
      },
    });
  } catch (e) {
    console.error("🔥 GPT request failed:", e);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}

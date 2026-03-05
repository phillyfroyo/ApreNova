// src/app/api/translate-word/route.ts
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getWordPrompt } from "@/lib/getWordPrompt";
import { getWordPromptToEnglish } from "@/lib/getWordPromptToEnglish";
import { NextRequest, NextResponse } from 'next/server';
import { logOpenAICost } from "@/lib/cost-tracker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: Simple in-memory cache (swap with Redis, KV, etc.)
// Keyed on word|sentence|level for context-dependent responses
const cache = new Map<string, any>();

export async function POST(req: NextRequest) {
  // Require authentication for AI API calls
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { word, sentence, level, context } = await req.json();

  console.log("translate-word input:", { word, level });

  if (!word) {
    return NextResponse.json({ error: "Missing word." }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const isSpanishToEnglish = lang === "en";

  const prompt = isSpanishToEnglish
    ? getWordPromptToEnglish(word, sentence, level, context)
    : getWordPrompt(word, sentence, level, context);

  // Cache key includes sentence for context-dependent POS/verb chart
  const cacheKey = `${word.toLowerCase()}|${(sentence || '').toLowerCase().slice(0, 100)}|${level ?? 2}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: `${prompt}\n\nWord: \"${word}\"` },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("translate-word", "gpt-4o", completion.usage, { userId: session.user.id });

    const reply = completion.choices[0]?.message?.content || "";
    console.log("GPT raw reply:", reply);

    const cleanReply = reply.replace(/```json|```/g, "").trim();

    let result: any = {};

    try {
      const raw = JSON.parse(cleanReply);
      
      // Handle enhanced format with new fields
      if (typeof raw === "object" && raw.contextTranslation) {
        result = {
          contextTranslation: raw.contextTranslation,
          isDerivative: raw.isDerivative || false,
          rootWord: raw.rootWord || null,
          rootTranslation: raw.rootTranslation || null,
          otherCommonTranslations: raw.otherCommonTranslations || [],
          partOfSpeech: raw.partOfSpeech || null,
          subject: raw.subject || null,
          subjectTranslation: raw.subjectTranslation || null,
          derivatives: raw.derivatives || [],
          verbChart: raw.verbChart || null,
          // Legacy support - map contextTranslation to first item in translations
          translations: [raw.contextTranslation, ...(raw.otherCommonTranslations || [])]
        };
      }
      // Handle legacy format for backwards compatibility
      else if (typeof raw === "object" && raw.primary) {
        result = {
          contextTranslation: raw.primary,
          isDerivative: false,
          rootWord: null,
          rootTranslation: null,
          otherCommonTranslations: raw.otherCommonTranslations || [],
          partOfSpeech: null,
          subject: null,
          subjectTranslation: null,
          derivatives: [],
          verbChart: null,
          translations: [raw.primary, ...(raw.otherCommonTranslations || [])]
        };
      } else if (Array.isArray(raw)) {
        result = {
          contextTranslation: raw[0] || "",
          isDerivative: false,
          rootWord: null,
          rootTranslation: null,
          otherCommonTranslations: raw.slice(1) || [],
          partOfSpeech: null,
          subject: null,
          subjectTranslation: null,
          derivatives: [],
          verbChart: null,
          translations: raw
        };
      } else {
        throw new Error("Invalid translation format");
      }
    } catch (parseError) {
      console.error("Failed to parse GPT response:", parseError);
      return NextResponse.json({ error: "Invalid GPT translation format." }, { status: 500 });
    }

    console.log("Parsed result subject:", result.subject, result.subjectTranslation);
    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("OpenAI error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}

// src/app/api/translate-word/route.ts
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getWordPrompt } from "@/lib/getWordPrompt";
import { getWordPromptToEnglish } from "@/lib/getWordPromptToEnglish";
import { NextRequest, NextResponse } from 'next/server';
import { logOpenAICost } from "@/lib/cost-tracker";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: Simple in-memory cache (swap with Redis, KV, etc.)
const cache = new Map<string, { translations: string[] }>();

export async function POST(req: NextRequest) {
  const { word, sentence, level, context } = await req.json();

  console.log("🧪 translate-word input:", { word, level });

  if (!word) {
    return NextResponse.json({ error: "Missing word." }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const isSpanishToEnglish = lang === "en";

  const prompt = isSpanishToEnglish
    ? getWordPromptToEnglish(word, sentence, level, context)
    : getWordPrompt(word, sentence, level, context);

    const fullPrompt = `${prompt}

      Spanish Word: ${word}
      Sentence: ${sentence}
    `;

  const cacheKey = `${word.toLowerCase()}|${level ?? 2}`;
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
    logOpenAICost("translate-word", "gpt-4o", completion.usage);

    const reply = completion.choices[0]?.message?.content || "";
    console.log("🧠 GPT raw reply:", reply);

    const cleanReply = reply.replace(/```json|```/g, "").trim();

    let result: any = {};

    try {
      const raw = JSON.parse(cleanReply);
      
      // Handle new enhanced format
      if (typeof raw === "object" && raw.contextTranslation) {
        result = {
          contextTranslation: raw.contextTranslation,
          isDerivative: raw.isDerivative || false,
          rootWord: raw.rootWord || null,
          rootTranslation: raw.rootTranslation || null,
          otherCommonTranslations: raw.otherCommonTranslations || [],
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
          translations: [raw.primary, ...(raw.otherCommonTranslations || [])]
        };
      } else if (Array.isArray(raw)) {
        result = {
          contextTranslation: raw[0] || "",
          isDerivative: false,
          rootWord: null,
          rootTranslation: null,
          otherCommonTranslations: raw.slice(1) || [],
          translations: raw
        };
      } else {
        throw new Error("Invalid translation format");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse GPT response:", parseError);
      return NextResponse.json({ error: "Invalid GPT translation format." }, { status: 500 });
    }

    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}



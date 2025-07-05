// src/app/api/translate-word/route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: Simple in-memory cache (swap with Redis, KV, etc.)
const cache = new Map<string, { translation: string }>();

const systemPrompt = `
You are a bilingual Spanish-English language tutor.

Given an English word and the sentence it's in, return ONLY the 1:1 Spanish translation as JSON like this:

{
  "translation": "caminar"
}

Do not include extra text or explanation.
`;

export async function POST(req: Request) {
  const { word, sentence } = await req.json();

  console.log("🧪 translate-word input:", { word, sentence });

  if (!word || !sentence) {
    return NextResponse.json({ error: "Missing word or sentence." }, { status: 400 });
  }

  const cacheKey = `${word.toLowerCase()}|${sentence}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Word: "${word}"\nSentence: "${sentence}"` },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content || "";
    const cleanReply = reply.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanReply);

    cache.set(cacheKey, parsed); // ✅ Store in cache

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}


// src/app/api/translate-word/route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getWordPrompt } from "@/lib/getWordPrompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: Simple in-memory cache (swap with Redis, KV, etc.)
const cache = new Map<string, { translations: string[] }>();

export async function POST(req: Request) {
  const { word, level } = await req.json();

  console.log("🧪 translate-word input:", { word, level });

  if (!word) {
    return NextResponse.json({ error: "Missing word." }, { status: 400 });
  }

  const prompt = getWordPrompt(level ?? 2);
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

    const reply = completion.choices[0]?.message?.content || "";
    console.log("🧠 GPT raw reply:", reply);

    const cleanReply = reply.replace(/```json|```/g, "").trim();

    let translations: string[] = [];

    try {
      const raw = JSON.parse(cleanReply);
      if (Array.isArray(raw) && raw.every(item => typeof item === "string")) {
        translations = raw;
      } else {
        throw new Error("Invalid translation format");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse GPT response:", parseError);
      return NextResponse.json({ error: "Invalid GPT translation format." }, { status: 500 });
    }

    const parsed = { translations };
    cache.set(cacheKey, parsed);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}



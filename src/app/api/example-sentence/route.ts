// src/app/api/translate-word/route.ts
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getExamplePrompt } from "@/lib/getExamplePrompt";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TEMP: Simple in-memory cache (swap with Redis, KV, etc.)
const cache = new Map<string, { english: string; spanish: string }>();

export async function POST(req: Request) {
  const { spanishWord, level } = await req.json();

  console.log("🧪 example-sentence input:", { spanishWord, level });

const systemPrompt = getExamplePrompt(level ?? 2);

const messages: ChatCompletionMessageParam[] = [
  { role: "system", content: systemPrompt },
  {
    role: "user",
    content: `Please provide a short example sentence using the Spanish word "${spanishWord}" in its most natural, everyday usage.`,
  },
];

try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content || "";
    const cleanReply = reply.replace(/```json|```/g, "").trim();

    let example: { english: string; spanish: string };

try {
  const raw = JSON.parse(cleanReply);
  if (typeof raw.english === "string" && typeof raw.spanish === "string") {
    example = {
      english: raw.english,
      spanish: raw.spanish,
    };
  } else {
    throw new Error("Invalid example sentence format");
  }
} catch (parseError) {
  console.error("❌ Failed to parse GPT response:", parseError);
  return NextResponse.json({ error: "Invalid GPT response format." }, { status: 500 });
}

const cacheKey = `${spanishWord}|${level ?? 5}`;

cache.set(cacheKey, example);
return NextResponse.json(example);

  } catch (err) {
    console.error("❌ OpenAI error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}
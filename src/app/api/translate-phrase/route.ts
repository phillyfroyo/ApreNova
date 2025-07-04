import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Temp: In-memory cache for phrases
const cache = new Map<string, { translation: string }>();

const systemPrompt = `
You are a bilingual Spanish-English language tutor.

Given a phrase and the sentence it's in, return ONLY the natural Spanish translation of the phrase, in this format:

{
  "translation": "una ciudad tranquila"
}

Do not add explanation, markdown, or commentary.
`;

export async function POST(req: Request) {
  const { phrase, sentence } = await req.json();

  if (!phrase || !sentence) {
    return NextResponse.json({ error: "Missing phrase or sentence." }, { status: 400 });
  }

  const cacheKey = `${phrase.toLowerCase()}|${sentence}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  const messages: ChatCompletionMessageParam[] = [
  { role: "system", content: systemPrompt },
  { role: "user", content: `Phrase: "${phrase}"\nSentence: "${sentence}"` },
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
    console.error("❌ OpenAI error (phrase):", err);
    return NextResponse.json({ error: "Failed to fetch phrase translation." }, { status: 500 });
  }
}

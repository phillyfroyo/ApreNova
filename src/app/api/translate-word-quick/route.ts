// src/app/api/translate-word-quick/route.ts
//
// Call A of the two-call "translation-first" flow. Returns ONLY the headline
// (contextTranslation + subject) via a minimal prompt + 3-field schema, so it
// comes back fast and the card can render the translation while the rich call
// (/api/translate-word, Call B) is still generating.

import Anthropic from "@anthropic-ai/sdk";
import { getWordQuickSystem, getWordQuickUser } from "@/lib/getWordQuickPrompt";
import { WORD_QUICK_TOOL, type WordQuickToolInput } from "@/lib/wordQuickSchema";
import { NextRequest, NextResponse } from 'next/server';
import { logAnthropicCost } from "@/lib/cost-tracker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory headline cache (per-process; mirrors the main route's TEMP cache).
const cache = new Map<string, any>();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { word, sentence, level, context } = await req.json();
  if (!word) {
    return NextResponse.json({ error: "Missing word." }, { status: 400 });
  }

  const lang = req.nextUrl.searchParams.get("lang") ?? "es";
  const isSpanishToEnglish = lang === "en";

  const systemPrompt = getWordQuickSystem(isSpanishToEnglish);
  const userPrompt = getWordQuickUser(word, sentence, level, context, isSpanishToEnglish);

  const cacheKey = `${word.toLowerCase()}|${(sentence || '').toLowerCase().slice(0, 100)}|${level ?? 2}|${lang}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      temperature: 0.3,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: [WORD_QUICK_TOOL],
      tool_choice: { type: "tool", name: WORD_QUICK_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    });

    logAnthropicCost("translate-word", "claude-sonnet-4-6", message.usage, { userId: session.user.id });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      console.error("translate-word-quick: no tool_use block", message.stop_reason);
      return NextResponse.json({ error: "Invalid translation format." }, { status: 500 });
    }

    const raw = toolUse.input as WordQuickToolInput;
    const result = {
      contextTranslation: raw.contextTranslation ?? "",
      subject: raw.subject ?? null,
      subjectTranslation: raw.subjectTranslation ?? null,
    };

    cache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Claude API error (quick):", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}

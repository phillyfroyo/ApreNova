// src/app/api/translate-word/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { getWordPrompt, getWordPromptSystem } from "@/lib/getWordPrompt";
import { getWordPromptToEnglish, getWordPromptToEnglishSystem } from "@/lib/getWordPromptToEnglish";
import { WORD_TRANSLATION_TOOL, type WordTranslationToolInput } from "@/lib/wordTranslationSchema";
import { NextRequest, NextResponse } from 'next/server';
import { logAnthropicCost } from "@/lib/cost-tracker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  // Static instruction block (cacheable) + per-request variable tail.
  const systemPrompt = isSpanishToEnglish
    ? getWordPromptToEnglishSystem()
    : getWordPromptSystem();
  const userPrompt = isSpanishToEnglish
    ? getWordPromptToEnglish(word, sentence, level, context)
    : getWordPrompt(word, sentence, level, context);

  // Cache key includes sentence for context-dependent POS/verb chart
  const cacheKey = `${word.toLowerCase()}|${(sentence || '').toLowerCase().slice(0, 100)}|${level ?? 2}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  try {
    // Structured output via forced tool use: the model is required to call
    // report_word_translation, so its arguments always match our schema —
    // no fenced-```json``` stripping, no parse-failure 500s. The text-based
    // example responses were removed from the prompt accordingly.
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.3,
      // Cache the large static instruction block — it's byte-identical across
      // every request for a given direction, so repeat calls read it from cache
      // (~0.1x cost, faster TTFT) instead of reprocessing it each time.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [WORD_TRANSLATION_TOOL],
      tool_choice: { type: "tool", name: WORD_TRANSLATION_TOOL.name },
      messages: [
        { role: "user", content: userPrompt },
      ],
    });

    // Cache-hit telemetry — if cache_read_input_tokens stays 0 across repeats,
    // a silent invalidator crept into the static block.
    if (message.usage) {
      console.log("translate-word cache:", {
        write: message.usage.cache_creation_input_tokens ?? 0,
        read: message.usage.cache_read_input_tokens ?? 0,
        input: message.usage.input_tokens,
      });
    }

    // Log cost (fire-and-forget)
    logAnthropicCost("translate-word", "claude-sonnet-4-6", message.usage, { userId: session.user.id });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      console.error("translate-word: no tool_use block in response", message.stop_reason);
      return NextResponse.json({ error: "Invalid translation format." }, { status: 500 });
    }

    const raw = toolUse.input as WordTranslationToolInput;
    console.log("translate-word raw:", JSON.stringify(raw));

    // Defensive defaults — mirror prior behavior so a slightly-off response
    // never 500s. The shape is guaranteed by the tool schema; these guard
    // against missing optional fields only.
    const contextTranslation = raw.contextTranslation ?? "";
    const otherCommonTranslations = raw.otherCommonTranslations ?? [];
    const result = {
      contextTranslation,
      isDerivative: raw.isDerivative ?? false,
      rootWord: raw.rootWord ?? null,
      rootTranslation: raw.rootTranslation ?? null,
      otherCommonTranslations,
      partOfSpeech: raw.partOfSpeech ?? null,
      subject: raw.subject ?? null,
      subjectTranslation: raw.subjectTranslation ?? null,
      derivatives: raw.derivatives ?? [],
      verbChart: raw.verbChart ?? null,
      // Legacy support - map contextTranslation to first item in translations
      translations: [contextTranslation, ...otherCommonTranslations],
    };

    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json({ error: "Failed to fetch translation." }, { status: 500 });
  }
}

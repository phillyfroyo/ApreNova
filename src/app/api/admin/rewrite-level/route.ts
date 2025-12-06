// src/app/api/admin/rewrite-level/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateRewritePrompt } from "@/lib/admin/cefr-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLanguage, targetLevel, sourceLevel } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!targetLevel || targetLevel < 1 || targetLevel > 5) {
      return NextResponse.json({ error: "Valid target level (1-5) is required" }, { status: 400 });
    }

    // If target level matches source level, return original text
    if (targetLevel === sourceLevel) {
      return NextResponse.json({
        rewrittenText: text,
        targetLevel,
        wasRewritten: false,
      });
    }

    const prompt = generateRewritePrompt(targetLevel, text, sourceLanguage);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert language educator specializing in CEFR-leveled content creation.
You rewrite stories to match specific CEFR levels while preserving meaning, plot, and character names.

CRITICAL RULES:
- Return ONLY the rewritten text - no preamble, no explanations, no "Here's the text"
- Start immediately with the story content (e.g., the title or first line)
- PRESERVE EVERY LINE BREAK: Each line in the input must remain a separate line in the output
- Never merge multiple lines/paragraphs into one - if the input has 50 lines, output must have ~50 lines
- Rewrite the COMPLETE text - never truncate or summarize
- Do NOT add any commentary before or after the text`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 16000, // Increased for longer chapters
    });

    let rewrittenText = response.choices[0]?.message?.content?.trim();

    // Check for AI error/apology messages (indicates the chunk was invalid)
    if (rewrittenText) {
      const errorPatterns = [
        /^I'm sorry,?\s*(but)?/i,
        /^I apologize,?\s*(but)?/i,
        /^Unfortunately,?\s*(I )?(can't|cannot|couldn't)/i,
        /^(The |It )?seems (that |like )?(the )?(provided )?text is (missing|empty|not visible)/i,
        /^I (can't|cannot|don't) see (any|the) text/i,
        /^(There is )?no text (was )?(provided|given|visible)/i,
        /^Could you (please )?provide/i,
      ];

      for (const pattern of errorPatterns) {
        if (pattern.test(rewrittenText)) {
          console.warn("AI returned error message instead of rewritten text:", rewrittenText.slice(0, 200));
          return NextResponse.json({
            error: "AI could not process this text chunk. It may be empty or contain only non-story content.",
            aiMessage: rewrittenText.slice(0, 200),
          }, { status: 400 });
        }
      }
    }

    // Strip common AI preamble patterns
    if (rewrittenText) {
      const preamblePatterns = [
        /^(Sure!|Okay!|Here's|Here is|Certainly!|Of course!)[^\n]*\n+/i,
        /^(The rewritten text|Rewritten version|Here's the rewritten)[^\n]*\n+/i,
        /^```[^\n]*\n/,  // Opening code block
        /\n```$/,         // Closing code block
      ];
      for (const pattern of preamblePatterns) {
        rewrittenText = rewrittenText.replace(pattern, '');
      }
      rewrittenText = rewrittenText.trim();
    }

    if (!rewrittenText) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json({
      rewrittenText,
      targetLevel,
      wasRewritten: true,
    });
  } catch (error) {
    console.error("Level rewrite error:", error);
    return NextResponse.json({ error: "Failed to rewrite text" }, { status: 500 });
  }
}

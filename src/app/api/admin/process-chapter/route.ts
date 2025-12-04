// src/app/api/admin/process-chapter/route.ts
// Process a single chapter - extract clean narrative vs glosses/notes
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProcessedChapter {
  // Clean narrative text (the actual story)
  narrativeText: string;

  // Marginal glosses/explanatory notes found
  glosses: Array<{
    text: string;
    context?: string;
  }>;

  // Footnote markers found (just references, not the footnotes themselves)
  footnoteRefs: string[];
}

const SYSTEM_PROMPT = `You are an expert at analyzing literary texts and separating narrative content from editorial additions.

Given a chapter or section of a literary work, identify and separate:

1. **NARRATIVE TEXT**: The actual story/poem - the original author's words. This is what readers want to read.

2. **GLOSSES/MARGINAL NOTES**: Explanatory notes added by editors/translators, often:
   - Printed in italics in the original
   - Appearing between verses or paragraphs
   - Providing context like "The hero arrives at the castle" or "Beowulf speaks to the king"
   - These are NOT part of the original work

3. **FOOTNOTE REFERENCES**: Markers like [1], [2], ², ³ that reference footnotes elsewhere.

Return JSON:
{
  "narrativeText": "The clean story text with proper line/paragraph breaks preserved...",
  "glosses": [
    { "text": "The explanatory note", "context": "What it explains (optional)" }
  ],
  "footnoteRefs": ["1", "2", "3"]
}

IMPORTANT:
- Preserve the original formatting of the narrative (line breaks for poetry, paragraphs for prose)
- Remove footnote markers from the narrative text
- The narrative should be clean and ready for a reader
- Return ONLY valid JSON, no markdown`;

export async function POST(request: NextRequest) {
  try {
    const { chapterText, chapterTitle, chapterNumber } = await request.json();

    if (!chapterText || typeof chapterText !== "string") {
      return NextResponse.json(
        { error: "chapterText is required" },
        { status: 400 }
      );
    }

    // Limit per-chapter size (should be reasonable for single chapters)
    if (chapterText.length > 50000) {
      return NextResponse.json(
        { error: "Chapter text too long. Maximum 50,000 characters per chapter." },
        { status: 400 }
      );
    }

    const userPrompt = chapterTitle
      ? `Process this chapter (${chapterTitle}):\n\n${chapterText}`
      : `Process this chapter (Chapter ${chapterNumber || 'Unknown'}):\n\n${chapterText}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency on per-chapter processing
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsed: ProcessedChapter;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return the original text as narrative
      console.error("Failed to parse chapter response, using original text");
      parsed = {
        narrativeText: chapterText,
        glosses: [],
        footnoteRefs: [],
      };
    }

    return NextResponse.json({ result: parsed });
  } catch (error) {
    console.error("Error processing chapter:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process chapter" },
      { status: 500 }
    );
  }
}

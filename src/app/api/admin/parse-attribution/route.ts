// src/app/api/admin/parse-attribution/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { FormAttribution } from "@/lib/admin/attribution-helpers";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { frontMatterText } = await request.json();

    if (!frontMatterText || typeof frontMatterText !== "string") {
      return NextResponse.json(
        { error: "frontMatterText is required" },
        { status: 400 }
      );
    }

    if (frontMatterText.length > 20000) {
      return NextResponse.json(
        { error: "Text too long. Please paste only the relevant front matter (max 20,000 characters)." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert at extracting bibliographic and attribution metadata from book front matter, title pages, and copyright notices.

Given text from the front matter of a book (which may include title pages, translator notes, publication info, copyright notices, etc.), extract all available attribution information and return it as a JSON object.

Return ONLY valid JSON matching this exact structure (omit fields that cannot be determined from the text):

{
  "authorName": "string - the original author's name",
  "authorLifespan": "string - birth-death years if known, e.g., '1564-1616' or 'c. 700-1000 CE'",
  "authorIsUnknown": "boolean - true if author is unknown/anonymous",
  "authorIsCollective": "boolean - true if work is from oral tradition or collective authorship",
  "authorNote": "string - any additional notes about authorship",

  "yearWritten": "string - when the work was composed, can be approximate like 'c. 700-1000 CE'",
  "yearFirstPublished": "string - year of first publication as a number string",

  "sourceTitle": "string - title of the source edition/collection",
  "sourcePublisher": "string - publisher name",
  "sourcePublicationYear": "string - publication year as number string",
  "sourceEditor": "string - editor name if applicable",
  "sourceUrl": "string - URL if mentioned",
  "sourceNotes": "string - any additional source notes",
  "sourceIsPublicDomain": "boolean - true if source is public domain",
  "sourcePublicDomainNote": "string - explanation of public domain status",

  "translatorName": "string - translator's name",
  "translatorLifespan": "string - translator's birth-death years",
  "translatorYear": "string - year of translation as number string",
  "translatorIsPublicDomain": "boolean - true if translation is public domain",
  "translatorPublicDomainNote": "string - explanation of translation's public domain status",

  "region": "string - geographic region of origin",
  "culturalInfluences": "string - comma-separated cultural influences",
  "genres": "string - comma-separated genres",

  "originalWorkStatus": "string - one of: 'public-domain', 'licensed', 'original'",
  "provenanceNote": "string - where the text came from, e.g., 'Text from Project Gutenberg'",
  "provenanceUrl": "string - URL of the source"
}

Important guidelines:
- Only include fields you can confidently extract from the text
- For dates, prefer exact years when available, but approximate ranges are fine
- If the work is clearly in public domain (published before 1928 in the US, or author died 70+ years ago), set sourceIsPublicDomain to true
- For ancient/medieval works, authorIsUnknown or authorIsCollective are often true
- The genres field should contain literary genres like "epic poetry", "folk tale", "fable", etc.
- Return ONLY the JSON object, no additional text or markdown`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract attribution metadata from this front matter text:\n\n${frontMatterText}` },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsed: Partial<FormAttribution>;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Ensure required fields have defaults
    const attribution: Partial<FormAttribution> = {
      authorName: parsed.authorName || "",
      authorLifespan: parsed.authorLifespan,
      authorIsUnknown: parsed.authorIsUnknown,
      authorIsCollective: parsed.authorIsCollective,
      authorNote: parsed.authorNote,
      yearWritten: parsed.yearWritten,
      yearFirstPublished: parsed.yearFirstPublished,
      sourceTitle: parsed.sourceTitle,
      sourcePublisher: parsed.sourcePublisher,
      sourcePublicationYear: parsed.sourcePublicationYear,
      sourceEditor: parsed.sourceEditor,
      sourceUrl: parsed.sourceUrl,
      sourceNotes: parsed.sourceNotes,
      sourceIsPublicDomain: parsed.sourceIsPublicDomain ?? true,
      sourcePublicDomainNote: parsed.sourcePublicDomainNote,
      translatorName: parsed.translatorName,
      translatorLifespan: parsed.translatorLifespan,
      translatorYear: parsed.translatorYear,
      translatorIsPublicDomain: parsed.translatorIsPublicDomain ?? true,
      translatorPublicDomainNote: parsed.translatorPublicDomainNote,
      region: parsed.region,
      culturalInfluences: parsed.culturalInfluences,
      genres: parsed.genres,
      originalWorkStatus: parsed.originalWorkStatus as "public-domain" | "licensed" | "original" || "public-domain",
      provenanceNote: parsed.provenanceNote,
      provenanceUrl: parsed.provenanceUrl,
    };

    return NextResponse.json({ attribution });
  } catch (error) {
    console.error("Error parsing attribution:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse attribution" },
      { status: 500 }
    );
  }
}

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

    // Truncate to first 15000 characters - enough to capture attribution metadata
    // plus any summary/synopsis sections that often come after preface material
    const truncatedText = frontMatterText.slice(0, 15000);
    const wasTruncated = frontMatterText.length > 15000;

    const systemPrompt = `You are an expert at extracting bibliographic and attribution metadata from book front matter, title pages, and copyright notices.

Given text from the front matter of a book (which may include title pages, translator notes, publication info, copyright notices, story summaries, etc.), extract all available attribution information and return it as a JSON object.

Return ONLY valid JSON matching this exact structure (omit fields that cannot be determined from the text):

{
  "authorName": "string - the original author's name",
  "authorLifespan": "string - birth-death years if known, e.g., '1564-1616' or 'c. 700-1000 CE'",
  "authorIsUnknown": "boolean - true if author is unknown/anonymous",
  "authorIsCollective": "boolean - true if work is from oral tradition or collective authorship",
  "authorNote": "string - any additional notes about authorship",

  "yearWritten": "string - when the work was composed, can be approximate like 'c. 700-1000 CE'",
  "yearFirstPublished": "string - year of first publication as a number string",

  "sourceTitle": "string - full title of the source edition/collection",
  "sourceTitleEs": "string - Spanish translation of the title",
  "displayTitle": "string - short display title for cards/navigation (e.g., 'Beowulf' from 'Beowulf: An Anglo-Saxon Epic Poem')",
  "displayTitleEs": "string - Spanish version of the short display title",
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
  "provenanceUrl": "string - URL of the source",

  "summary": "string - if there is a story synopsis, plot summary, or 'THE STORY' section, include the full text here"
}

Important guidelines:
- Only include fields you can confidently extract from the text
- For dates, prefer exact years when available, but approximate ranges are fine
- If the work is clearly in public domain (published before 1928 in the US, or author died 70+ years ago), set sourceIsPublicDomain to true
- For ancient/medieval works, authorIsUnknown or authorIsCollective are often true
- The genres field should contain literary genres like "epic poetry", "folk tale", "fable", etc.
- For displayTitle: if the title has a subtitle (colon, dash), extract just the main title. If it's already short, use the same as sourceTitle
- For Spanish translations (sourceTitleEs, displayTitleEs): provide accurate Spanish translations
- For summary: look for sections labeled "THE STORY", "SUMMARY", "SYNOPSIS", "ARGUMENT", or similar. Include the full text if found.
- Return ONLY the JSON object, no additional text or markdown`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract attribution metadata from this front matter text${wasTruncated ? " (truncated)" : ""}:\n\n${truncatedText}` },
      ],
      temperature: 0.1,
      max_tokens: 4000, // Increased to handle full summaries
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

    // Extract additional metadata fields for auto-fill
    const metadata = {
      sourceTitleEs: (parsed as Record<string, unknown>).sourceTitleEs as string | undefined,
      displayTitle: (parsed as Record<string, unknown>).displayTitle as string | undefined,
      displayTitleEs: (parsed as Record<string, unknown>).displayTitleEs as string | undefined,
      summary: (parsed as Record<string, unknown>).summary as string | undefined,
    };

    return NextResponse.json({ attribution, metadata });
  } catch (error) {
    console.error("Error parsing attribution:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse attribution" },
      { status: 500 }
    );
  }
}

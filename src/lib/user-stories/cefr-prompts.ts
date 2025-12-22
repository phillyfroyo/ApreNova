// src/lib/user-stories/cefr-prompts.ts

/**
 * CEFR Level Characteristics for AI prompts
 */
export const CEFR_CHARACTERISTICS = {
  l1: {
    level: "A1",
    name: "Beginner",
    characteristics: [
      "Simple present tense only",
      "Basic vocabulary (~500 words)",
      "Very short sentences (5-8 words)",
      "Concrete concepts only",
      "Simple subject-verb-object structure",
      "Common everyday words",
      "No idioms or figurative language",
    ],
  },
  l2: {
    level: "A2",
    name: "Elementary",
    characteristics: [
      "Simple past and present tense",
      "Common expressions (~1000 words)",
      "Short sentences (8-12 words)",
      "Familiar everyday topics",
      "Basic connectors (and, but, because)",
      "Simple adjectives and adverbs",
    ],
  },
  l3: {
    level: "B1",
    name: "Intermediate",
    characteristics: [
      "Mixed tenses including future",
      "Idiomatic language (~2000 words)",
      "Compound sentences",
      "Some abstract concepts",
      "Varied connectors",
      "Descriptive language",
      "Simple conditional structures",
    ],
  },
  l4: {
    level: "B2",
    name: "Upper Intermediate",
    characteristics: [
      "Complex grammar structures",
      "Nuanced vocabulary (~4000 words)",
      "Varied sentence structure",
      "Opinions and arguments",
      "Subjunctive mood",
      "Sophisticated connectors",
      "Idiomatic expressions",
    ],
  },
  l5: {
    level: "C1/C2",
    name: "Advanced",
    characteristics: [
      "Literary language",
      "Advanced constructions",
      "Full complexity",
      "Native-like expression",
      "Subtle nuances",
      "Cultural references",
      "Sophisticated vocabulary",
    ],
  },
};

/**
 * Generate prompt for detecting CEFR level of text
 */
export function getCEFRDetectionPrompt(text: string, language: "en" | "es"): string {
  const langName = language === "es" ? "Spanish" : "English";

  return `You are a CEFR language level assessment expert.

Analyze the following ${langName} text and determine its CEFR level.

Consider these factors:
- Vocabulary complexity and range
- Grammar structures used
- Sentence length and complexity
- Use of idiomatic expressions
- Abstract vs concrete concepts

TEXT TO ANALYZE:
"""
${text.slice(0, 2000)}
"""

Respond with ONLY a JSON object in this exact format:
{
  "detectedLevel": "l1" | "l2" | "l3" | "l4" | "l5",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of why this level was chosen"
}

Level mapping:
- l1 = A1 (Beginner)
- l2 = A2 (Elementary)
- l3 = B1 (Intermediate)
- l4 = B2 (Upper Intermediate)
- l5 = C1/C2 (Advanced)`;
}

/**
 * Generate prompt for rewriting text at a specific CEFR level
 */
export function getLevelRewritePrompt(
  text: string,
  sourceLevel: string,
  targetLevel: string,
  language: "en" | "es"
): string {
  const langName = language === "es" ? "Spanish" : "English";
  const targetChars = CEFR_CHARACTERISTICS[targetLevel as keyof typeof CEFR_CHARACTERISTICS];

  if (!targetChars) {
    throw new Error(`Invalid target level: ${targetLevel}`);
  }

  return `You are an expert ${langName} language educator specializing in graded readers.

Rewrite the following story to match CEFR level ${targetChars.level} (${targetChars.name}).

IMPORTANT REQUIREMENTS:
1. Preserve the EXACT plot, characters, and story events
2. Keep character names unchanged
3. Maintain the emotional tone and key story beats
4. Keep approximately the same number of sentences (±20%)
5. Each line should be one complete sentence

TARGET LEVEL CHARACTERISTICS (${targetChars.level}):
${targetChars.characteristics.map((c) => `- ${c}`).join("\n")}

ORIGINAL TEXT (${sourceLevel}):
"""
${text}
"""

Respond with ONLY the rewritten story text. No explanations, no headers, just the rewritten story.
Each sentence should be on its own line.`;
}

/**
 * Generate prompt for translating text
 */
export function getTranslationPrompt(
  text: string,
  sourceLanguage: "en" | "es",
  level: string
): string {
  const sourceLang = sourceLanguage === "es" ? "Spanish" : "English";
  const targetLang = sourceLanguage === "es" ? "English" : "Spanish";
  const levelChars = CEFR_CHARACTERISTICS[level as keyof typeof CEFR_CHARACTERISTICS];

  return `You are an expert translator specializing in educational content.

Translate the following ${sourceLang} text to ${targetLang}.

IMPORTANT REQUIREMENTS:
1. Maintain the same CEFR level (${levelChars?.level || level}) in the translation
2. Keep the same sentence structure and line breaks
3. Preserve character names (do not translate names)
4. Match the vocabulary complexity of the original
5. Each input line should produce exactly one output line

INPUT TEXT (${sourceLang}):
"""
${text}
"""

Respond with ONLY the translated text. Each sentence on its own line.
No explanations, no headers, just the translation.`;
}

/**
 * Generate prompt for parsing chapters from raw text
 */
export function getChapterParsingPrompt(text: string): string {
  return `Analyze this story text and identify any chapter breaks.

Look for:
- Lines containing "CHAPTER" or "Chapter"
- Lines with "---" as separators
- Lines with roman numerals (I, II, III, etc.)
- Lines with numbers followed by periods or colons (1., 2:, etc.)

TEXT:
"""
${text}
"""

Respond with a JSON object:
{
  "hasChapters": boolean,
  "chapterMarkers": [
    { "lineIndex": number, "chapterNumber": number }
  ]
}

If no clear chapter markers exist, respond with:
{ "hasChapters": false, "chapterMarkers": [] }`;
}

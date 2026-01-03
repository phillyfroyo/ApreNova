// src/lib/story-processing/detection.ts
// Server-only detection utilities for language and CEFR level
// Used by both admin and user story pipelines (API routes only)

import "server-only";

import { OpenAI } from "openai";
import { generateDetectionPrompt, levelNumberToString, toNumericLevel, fromNumericLevel } from "./cefr-prompts";
import { logOpenAICost } from "@/lib/cost-tracker";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

export interface DetectionContext {
  storyId?: string;
  userId?: string;
}

// ============================================================================
// LANGUAGE DETECTION (Algorithmic with AI fallback for edge cases)
// ============================================================================

/**
 * Result of algorithmic language detection with confidence score
 */
export interface LanguageDetectionResult {
  language: "en" | "es";
  confidence: number; // 0-1, where 1 is highly confident
  method: "algorithmic" | "ai";
  scores: { en: number; es: number };
}

/**
 * Algorithmic language detection for English vs Spanish.
 * Returns confidence score based on pattern matching.
 *
 * @param text - The text to analyze
 * @returns Detection result with language, confidence, and scores
 */
export function detectLanguageAlgorithmic(text: string): Omit<LanguageDetectionResult, "method"> {
  // Sample text for analysis (first 5000 chars is plenty)
  const sampleText = text.substring(0, 5000);

  // Spanish-specific indicators (weighted by distinctiveness)
  const spanishPatterns: Array<{ pattern: RegExp; weight: number }> = [
    // Articles - very common and distinctive
    { pattern: /\b(el|la|los|las)\b/gi, weight: 1.5 },
    { pattern: /\b(un|una|unos|unas)\b/gi, weight: 1.2 },
    // Common prepositions/conjunctions
    { pattern: /\b(de|del|en|con|por|para|sin|sobre)\b/gi, weight: 1.0 },
    { pattern: /\b(que|qué|pero|porque|aunque|cuando|donde)\b/gi, weight: 1.0 },
    // Verbs (ser/estar distinction is unique to Spanish)
    { pattern: /\b(es|está|son|están|era|estaba|fue|estuvo)\b/gi, weight: 1.3 },
    { pattern: /\b(ser|estar|siendo|sido|estado)\b/gi, weight: 1.2 },
    { pattern: /\b(tiene|tienen|tenía|tengo|hay)\b/gi, weight: 1.0 },
    // Spanish-specific characters (very high weight - definitive)
    { pattern: /[áéíóúüñ¿¡]/gi, weight: 3.0 },
    // Common Spanish words
    { pattern: /\b(muy|más|también|ahora|siempre|nunca|todo|nada)\b/gi, weight: 1.0 },
    { pattern: /\b(yo|tú|él|ella|nosotros|ellos|usted)\b/gi, weight: 1.2 },
  ];

  // English-specific indicators (weighted by distinctiveness)
  const englishPatterns: Array<{ pattern: RegExp; weight: number }> = [
    // Articles - "the" is extremely common in English
    { pattern: /\b(the)\b/gi, weight: 2.0 },
    { pattern: /\b(a|an)\b/gi, weight: 1.2 },
    // Common prepositions/conjunctions
    { pattern: /\b(of|to|in|for|on|with|at|by|from)\b/gi, weight: 1.0 },
    { pattern: /\b(and|or|but|if|when|while|because|although)\b/gi, weight: 1.0 },
    // Verbs - English auxiliary verbs
    { pattern: /\b(is|are|was|were|be|been|being)\b/gi, weight: 1.3 },
    { pattern: /\b(have|has|had|do|does|did|will|would|could|should)\b/gi, weight: 1.2 },
    // Pronouns
    { pattern: /\b(I|you|he|she|it|we|they)\b/gi, weight: 1.0 },
    { pattern: /\b(my|your|his|her|its|our|their)\b/gi, weight: 1.0 },
    // Common English words
    { pattern: /\b(this|that|these|those|here|there)\b/gi, weight: 1.0 },
    { pattern: /\b(not|no|yes|very|just|only|also)\b/gi, weight: 0.8 },
    // English-specific patterns (contractions)
    { pattern: /\b(I'm|you're|he's|she's|it's|we're|they're|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't)\b/gi, weight: 2.5 },
  ];

  let spanishScore = 0;
  let englishScore = 0;

  spanishPatterns.forEach(({ pattern, weight }) => {
    const matches = sampleText.match(pattern);
    spanishScore += (matches ? matches.length : 0) * weight;
  });

  englishPatterns.forEach(({ pattern, weight }) => {
    const matches = sampleText.match(pattern);
    englishScore += (matches ? matches.length : 0) * weight;
  });

  // Calculate confidence based on the ratio of scores
  const totalScore = spanishScore + englishScore;
  const maxScore = Math.max(spanishScore, englishScore);
  const minScore = Math.min(spanishScore, englishScore);

  // Confidence formula:
  // - If total is very low, we're uncertain (might be neither language)
  // - If scores are close, we're uncertain
  // - High ratio of max/total = high confidence
  let confidence = 0;
  if (totalScore > 0) {
    const dominanceRatio = maxScore / totalScore; // 0.5 to 1.0
    const absoluteStrength = Math.min(totalScore / 50, 1); // Need enough matches
    confidence = (dominanceRatio - 0.5) * 2 * absoluteStrength; // Scale to 0-1
  }

  return {
    language: spanishScore > englishScore ? "es" : "en",
    confidence: Math.max(0, Math.min(1, confidence)),
    scores: { en: englishScore, es: spanishScore },
  };
}

/**
 * Minimum confidence threshold for algorithmic detection.
 * Below this, we fall back to AI to verify (handles edge cases like
 * mixed language text, very short text, or non-EN/ES languages).
 */
const LANGUAGE_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Minimum total score to trust algorithmic detection.
 * Very short texts or texts with few indicator words need AI verification.
 */
const LANGUAGE_MIN_SCORE_THRESHOLD = 10;

/**
 * Detect the language of the source text.
 * Uses algorithmic pattern matching with AI fallback for low-confidence cases.
 *
 * This handles:
 * - Clear English text (algorithmic, no API cost)
 * - Clear Spanish text (algorithmic, no API cost)
 * - Mixed/ambiguous text (AI fallback)
 * - Non-EN/ES languages (AI fallback, returns closest match with warning)
 *
 * @param text - The text to analyze
 * @param context - Optional context with storyId and userId for cost tracking
 * @returns "en" for English, "es" for Spanish
 */
export async function detectLanguage(
  text: string,
  context: DetectionContext = {}
): Promise<"en" | "es"> {
  const { storyId, userId } = context;

  // Run algorithmic detection first
  const algorithmicResult = detectLanguageAlgorithmic(text);
  const totalScore = algorithmicResult.scores.en + algorithmicResult.scores.es;

  // If confidence is high enough and we have enough signal, use algorithmic result
  if (
    algorithmicResult.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD &&
    totalScore >= LANGUAGE_MIN_SCORE_THRESHOLD
  ) {
    console.log(
      `[Language Detection] Algorithmic: ${algorithmicResult.language.toUpperCase()} ` +
      `(confidence: ${(algorithmicResult.confidence * 100).toFixed(1)}%, ` +
      `scores: EN=${algorithmicResult.scores.en.toFixed(1)}, ES=${algorithmicResult.scores.es.toFixed(1)})`
    );
    return algorithmicResult.language;
  }

  // Low confidence or insufficient signal - fall back to AI
  console.log(
    `[Language Detection] Low confidence (${(algorithmicResult.confidence * 100).toFixed(1)}%), ` +
    `using AI fallback. Scores: EN=${algorithmicResult.scores.en.toFixed(1)}, ES=${algorithmicResult.scores.es.toFixed(1)}`
  );

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Analyze the following text and determine if it is written primarily in English or Spanish.
If the text is in a different language entirely, indicate which of English or Spanish it is CLOSEST to.

Respond with ONLY "en" or "es".

Text:
${text.substring(0, 500)}`,
        },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("detection", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "language", reason: "low_confidence_fallback" },
    });

    const response = completion.choices[0]?.message?.content?.toLowerCase().trim();
    const result = response === "es" ? "es" : "en";
    console.log(`[Language Detection] AI result: ${result.toUpperCase()}`);
    return result;
  } catch (error) {
    // If AI fails, use algorithmic result as fallback
    console.error(`[Language Detection] AI failed, using algorithmic fallback: ${algorithmicResult.language}`);
    return algorithmicResult.language;
  }
}

// ============================================================================
// CEFR LEVEL DETECTION
// ============================================================================

export interface CEFRDetectionResult {
  level: number; // 1-6
  levelString: string; // CEFR code: "A1", "A2", "B1", "B2", "C1", "C2"
  cefr: string; // CEFR code: "A1", "A2", "B1", "B2", "C1", "C2"
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

/**
 * Detect the CEFR level of the source text.
 * Samples from beginning, middle, and end for representative analysis.
 *
 * @param text - The text to analyze
 * @param language - The language of the text ("en" or "es")
 * @param context - Optional context with storyId and userId for cost tracking
 * @returns Detection result with level, CEFR label, confidence, and reasoning
 */
export async function detectCEFRLevel(
  text: string,
  language: "en" | "es",
  context: DetectionContext = {}
): Promise<CEFRDetectionResult> {
  const { storyId, userId } = context;
  // Sample from multiple parts of the text for better detection
  const textLength = text.length;
  let sampleText = "";

  if (textLength <= 3000) {
    sampleText = text;
  } else {
    // Take samples from beginning, middle, and end for more representative analysis
    const chunkSize = 1000;
    const beginning = text.slice(0, chunkSize);
    const middleStart = Math.floor(textLength / 2) - chunkSize / 2;
    const middle = text.slice(middleStart, middleStart + chunkSize);
    const end = text.slice(-chunkSize);
    sampleText = `[Beginning excerpt]\n${beginning}\n\n[Middle excerpt]\n${middle}\n\n[End excerpt]\n${end}`;
  }

  const prompt = generateDetectionPrompt(sampleText, language);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a CEFR language level assessment expert. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    // Log cost (fire-and-forget)
    logOpenAICost("detection", "gpt-4o-mini", completion.usage, {
      userId,
      userStoryId: storyId,
      metadata: { type: "cefr-level" },
    });

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

    try {
      const result = JSON.parse(cleaned);

      // AI returns level as CEFR string ("A1", "B1", "C2", etc.) - convert to number
      let level: number;
      if (typeof result.level === "number") {
        level = result.level;
      } else if (typeof result.level === "string") {
        // Convert CEFR string to numeric level
        level = toNumericLevel(result.level);
      } else {
        level = 3; // Default to B1
      }

      // Ensure level is valid (1-6)
      if (level < 1 || level > 6) level = 3;

      // Get CEFR code from numeric level (ensures consistency)
      const cefr = fromNumericLevel(level);
      const confidence = result.confidence || "medium";
      const reasoning = result.reasoning || "";

      return {
        level,
        levelString: cefr, // Use CEFR format directly (A1, A2, B1, etc.)
        cefr,
        confidence,
        reasoning,
      };
    } catch {
      // Default to B1 if parsing fails
      return {
        level: 3,
        levelString: "B1",
        cefr: "B1",
        confidence: "low",
        reasoning: "Failed to parse AI response",
      };
    }
  } catch {
    // Default to B1 if AI fails
    return {
      level: 3,
      levelString: "B1",
      cefr: "B1",
      confidence: "low",
      reasoning: "AI detection failed",
    };
  }
}

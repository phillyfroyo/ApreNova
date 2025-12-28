// src/lib/story-processing/detection.ts
// Shared detection utilities for language and CEFR level
// Used by both admin and user story pipelines

import { OpenAI } from "openai";
import { generateDetectionPrompt, levelNumberToString } from "./cefr-prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect the language of the source text.
 * Uses heuristic pattern matching first, falls back to AI if scores are close.
 *
 * @param text - The text to analyze
 * @returns "en" for English, "es" for Spanish
 */
export async function detectLanguage(text: string): Promise<"en" | "es"> {
  // Use a simple heuristic first - look for common Spanish indicators
  const spanishIndicators = [
    /\b(el|la|los|las|un|una|unos|unas)\b/gi,
    /\b(que|qué|y|de|en|con|por|para)\b/gi,
    /\b(es|está|son|están|ser|estar)\b/gi,
    /[áéíóúñü]/gi,
    /\b(muy|más|también|pero|porque|cuando)\b/gi,
  ];

  const englishIndicators = [
    /\b(the|a|an)\b/gi,
    /\b(is|are|was|were|be|been|being)\b/gi,
    /\b(and|or|but|if|when|while)\b/gi,
    /\b(have|has|had|do|does|did)\b/gi,
    /\b(this|that|these|those)\b/gi,
  ];

  let spanishScore = 0;
  let englishScore = 0;

  spanishIndicators.forEach((pattern) => {
    const matches = text.match(pattern);
    spanishScore += matches ? matches.length : 0;
  });

  englishIndicators.forEach((pattern) => {
    const matches = text.match(pattern);
    englishScore += matches ? matches.length : 0;
  });

  // If heuristic is clear (difference > 10), use it
  if (Math.abs(spanishScore - englishScore) >= 10) {
    return spanishScore > englishScore ? "es" : "en";
  }

  // Heuristic unclear, use AI

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Analyze the following text and determine if it is written in English or Spanish. Respond with only "en" or "es".

Text:
${text.substring(0, 500)}`,
        },
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const response = completion.choices[0]?.message?.content?.toLowerCase().trim();
    return response === "en" ? "en" : "es";
  } catch {
    // Fallback to heuristic
    return spanishScore > englishScore ? "es" : "en";
  }
}

// ============================================================================
// CEFR LEVEL DETECTION
// ============================================================================

export interface CEFRDetectionResult {
  level: number; // 1-6
  levelString: string; // "l1" through "l6"
  cefr: string; // "A1", "A2", "B1", "B2", "C1", "C2+"
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

/**
 * Detect the CEFR level of the source text.
 * Samples from beginning, middle, and end for representative analysis.
 *
 * @param text - The text to analyze
 * @param language - The language of the text ("en" or "es")
 * @returns Detection result with level, CEFR label, confidence, and reasoning
 */
export async function detectCEFRLevel(
  text: string,
  language: "en" | "es"
): Promise<CEFRDetectionResult> {
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

    const response = completion.choices[0]?.message?.content || "";
    const cleaned = response.replace(/```json|```/g, "").trim();

    try {
      const result = JSON.parse(cleaned);

      const level = typeof result.level === "number" ? result.level : 3;
      const cefr = result.cefr || ["A1", "A2", "B1", "B2", "C1", "C2+"][level - 1] || "B1";
      const confidence = result.confidence || "medium";
      const reasoning = result.reasoning || "";

      return {
        level,
        levelString: levelNumberToString(level),
        cefr,
        confidence,
        reasoning,
      };
    } catch {
      // Default to B1 if parsing fails
      return {
        level: 3,
        levelString: "l3",
        cefr: "B1",
        confidence: "low",
        reasoning: "Failed to parse AI response",
      };
    }
  } catch {
    // Default to B1 if AI fails
    return {
      level: 3,
      levelString: "l3",
      cefr: "B1",
      confidence: "low",
      reasoning: "AI detection failed",
    };
  }
}

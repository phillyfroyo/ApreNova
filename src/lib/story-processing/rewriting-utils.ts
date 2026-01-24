// src/lib/story-processing/rewriting-utils.ts
// Client-safe rewriting utilities (no AI SDK dependencies)
// These functions handle error detection and response cleanup

// ============================================================================
// ERROR DETECTION
// Detects when AI returns error messages instead of actual content
// ============================================================================

/**
 * Patterns that indicate AI returned an error/refusal instead of content
 */
const ERROR_PATTERNS = [
  /^I'm sorry,?\s*(but)?/i,
  /^I apologize,?\s*(but)?/i,
  /^Unfortunately,?\s*(I )?(can't|cannot|couldn't)/i,
  /^I (can't|cannot|couldn't) (help|assist|complete|fulfill|rewrite|translate)/i,
  /^I cannot rewrite/i,
  /^This (text|content|request) (contains|appears|seems)/i,
  /^I('m| am) not able to/i,
  /^As an AI/i,
  /^(There is )?no (content|text) (provided|to rewrite)/i,
  /^Please provide/i,
];

/**
 * Patterns for preambles that should be stripped from responses
 */
const PREAMBLE_PATTERNS = [
  /^(Sure!|Sure,|Okay,|Here('s| is))[^\n]*\n+/i,
  /^(Here('s| is) the rewritten)[^\n]*:\n+/i,
  /^```[a-z]*\n?/i, // Opening code fence
  /\n?```$/i, // Closing code fence
  /^"""\n?/i, // Opening triple quotes
  /\n?"""$/i, // Closing triple quotes
];

/**
 * Check if the response is an error/refusal message
 */
export function isErrorResponse(text: string): boolean {
  const firstLine = text.split("\n")[0] || "";
  return ERROR_PATTERNS.some((pattern) => pattern.test(firstLine));
}

/**
 * Common words to ignore when checking content overlap
 */
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that',
  // Spanish common words
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia',
  'y', 'o', 'pero', 'que', 'como', 'cuando', 'donde', 'quien',
  'es', 'son', 'está', 'están', 'ser', 'estar', 'hay', 'no', 'sí',
  'yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'ellas', 'su', 'sus',
]);

/**
 * Extract significant words from text (excluding common words)
 */
function getSignificantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-záéíóúñü]+/gi) || [];
  return new Set(words.filter(w => w.length > 2 && !COMMON_WORDS.has(w)));
}

/**
 * Patterns that suggest meta-commentary rather than actual content rewrite
 */
const META_COMMENTARY_PATTERNS = [
  /^(here('s| is)|this is) (the|a|my) (rewritten|simplified|adapted)/i,
  /^(i('ve| have)|let me) (rewritten|simplified|rewrite)/i,
  /rewritten (version|text|content)/i,
  /simplified (version|text|content)/i,
  /(at|for) (the )?(a1|a2|b1|b2|c1|c2) level/i,
  /cefr level/i,
  /here('s| is) (the|a) version/i,
];

/**
 * Check if response looks like meta-commentary about the task
 */
function looksLikeMetaCommentary(text: string): boolean {
  const firstLine = text.split('\n')[0] || '';
  return META_COMMENTARY_PATTERNS.some(pattern => pattern.test(firstLine));
}

/**
 * Check if AI response is valid by verifying it shares content with the original
 * This catches cases where AI returns meta-commentary instead of actual rewrite
 *
 * Strategy: Only reject if BOTH conditions are true:
 * 1. Zero word overlap with original (complete miss)
 * 2. Response looks like an error OR meta-commentary
 *
 * This allows valid simplifications that change most words while catching
 * responses that are clearly not rewrites of the original content.
 *
 * @returns true if response appears valid, false if it looks like an error/refusal
 */
export function isValidRewriteResponse(original: string, response: string): boolean {
  // First check for obvious error responses
  if (isErrorResponse(response)) {
    console.warn(`[RewriteValidation] Response is an error message`);
    return false;
  }

  const originalWords = getSignificantWords(original);
  const responseWords = getSignificantWords(response);

  // If original has very few significant words (like a title), be lenient
  if (originalWords.size <= 2) {
    return true;
  }

  // Check how many original words appear in response
  let matchCount = 0;
  for (const word of originalWords) {
    if (responseWords.has(word)) {
      matchCount++;
    }
  }

  // Only reject if ZERO overlap AND looks like meta-commentary
  // This catches "Here's the rewritten version..." type responses
  // but allows valid simplifications that change vocabulary significantly
  if (matchCount === 0) {
    if (looksLikeMetaCommentary(response)) {
      console.warn(`[RewriteValidation] Zero word overlap AND meta-commentary detected`);
      return false;
    }
    // Zero overlap but doesn't look like meta-commentary - might be aggressive simplification
    // Log it but allow it through
    console.log(`[RewriteValidation] Zero word overlap but no meta-commentary patterns, allowing`);
  }

  return true;
}

/**
 * Check if text looks like a title (should skip rewriting)
 * Titles are: single line, short, often ALL CAPS or Title Case with period
 */
export function isTitleLikeText(text: string): boolean {
  const trimmed = text.trim();
  const lines = trimmed.split('\n').filter(l => l.trim());

  // Must be single line
  if (lines.length !== 1) return false;

  const line = lines[0].trim();
  const words = line.split(/\s+/);

  // Very short (1-4 words)
  if (words.length > 4) return false;

  // Check for title patterns:
  // - ALL CAPS: "SUCCESS." or "ROUGE ET NOIR."
  // - Title with Roman numerals: "I. LIFE." or "II. LOVE"
  // - Ends with period (title style)
  const isAllCaps = /^[A-ZÁÉÍÓÚÑ\s.,!?'"-]+$/.test(line) && line === line.toUpperCase();
  const hasRomanNumeral = /^[IVXLC]+\.\s/.test(line);
  const endsWithPeriod = line.endsWith('.');

  return isAllCaps || hasRomanNumeral || (words.length <= 2 && endsWithPeriod);
}

/**
 * Strip common preambles and formatting from AI response
 */
export function stripPreamble(text: string): string {
  let cleaned = text.trim();

  for (const pattern of PREAMBLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

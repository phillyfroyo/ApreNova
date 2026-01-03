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
  /^I (can't|cannot|couldn't) (help|assist|complete|fulfill)/i,
  /^This (text|content|request) (contains|appears|seems)/i,
  /^I('m| am) not able to/i,
  /^As an AI/i,
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
 * Strip common preambles and formatting from AI response
 */
export function stripPreamble(text: string): string {
  let cleaned = text.trim();

  for (const pattern of PREAMBLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

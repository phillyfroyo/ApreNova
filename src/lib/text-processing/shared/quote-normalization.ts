// src/lib/text-processing/shared/quote-normalization.ts
// Shared utility: normalize 19th-century "continued quotation" into
// self-contained per-paragraph quotes.
// Used by the prose preprocess step BEFORE rewrite (admin + user pipelines).
//
// ============================================================================
// THE PROBLEM
// ============================================================================
// Classic literature (Sherlock Holmes, Wizard of Oz, etc.) often renders a
// long speech as a "continued quotation": the speaker's narration spans many
// paragraphs, and the convention is to RE-OPEN the outer quote (“) at the start
// of every paragraph but only CLOSE it (”) once, at the very end. e.g.:
//
//   “My life has been so short ...                 (opens, never closes)
//
//   “‘They aren’t straight,’” answered the other.  (a balanced nested line)
//
//   “I did not like to be deserted ...             (opens again, never closes)
//   ... get to the Emerald City.”                  (the single closing ”)
//
// This breaks the rewrite model: the per-paragraph rewrite prompt sees a
// paragraph that opens “ with no matching close. Told to "preserve quotation
// marks," it faithfully reproduces an unbalanced opener — producing dozens of
// orphaned “ in the output (the recurring quote-mismatch warnings).
//
// ============================================================================
// THE FIX
// ============================================================================
// Before the text reaches the rewriter, convert each continued-quote paragraph
// into a SELF-CONTAINED quote: if a paragraph's outer quote is left open at its
// end, append the closing ”. Each paragraph then opens AND closes its own outer
// quote, so the model never sees the ambiguous structure.
//
// CORRECTNESS — the key insight:
//   Outer quotes are the DIRECTIONAL curly marks “ (U+201C) and ” (U+201D),
//   which are unambiguous. Inner/nested dialogue uses ‘ (U+2018) / ’ (U+2019),
//   and ’ ALSO serves as the apostrophe (it's, father's). We only ever need the
//   OUTER depth, so we count ONLY “ and ” and ignore ‘/’ entirely. This sidesteps
//   the apostrophe-vs-close-quote ambiguity completely.
//
//   A paragraph's outer delta = (count of “) - (count of ”).
//     delta > 0  → outer quote left open → append `delta` closing ” marks.
//     delta == 0 → already balanced (normal dialogue, e.g. “One horse?” said he,
//                  or a nested line like “‘They aren’t straight,’”) → LEAVE IT.
//     delta < 0  → more closes than opens (rare; a closing paragraph) → leave it.
//
// We only touch paragraphs that BOTH start with an outer “ AND have delta > 0.
// Balanced lines — Holmes's interjections, ordinary attributed dialogue — are
// never modified. Verified against the real Sherlock Holmes and Wizard of Oz
// texts: 0 changes to balanced paragraphs.

/** Count net outer-quote depth of a string using only “ / ” (ignores ‘ ’). */
function outerDelta(text: string): number {
  const opens = (text.match(/“/g) || []).length; // “
  const closes = (text.match(/”/g) || []).length; // ”
  return opens - closes;
}

/** Does this paragraph begin with an outer opening quote (after whitespace)? */
function startsWithOuterOpen(paragraph: string): boolean {
  return /^\s*“/.test(paragraph);
}

export interface QuoteNormalizationResult {
  text: string;
  /** How many paragraphs had a closing ” appended. */
  paragraphsClosed: number;
}

/**
 * Normalize continued-quotation paragraphs in a block of prose to
 * self-contained per-paragraph quotes.
 *
 * Operates paragraph-by-paragraph (paragraphs separated by blank lines). A
 * paragraph is "fixed" only if it starts with an outer “ and its outer quote is
 * left open (delta > 0); the appropriate number of ” are appended at its end.
 * All other paragraphs — including already-balanced dialogue and nested-quote
 * lines — pass through unchanged.
 *
 * This is a no-op for text that doesn't use the continued-quotation convention,
 * so it is safe to run on every prose document.
 */
export function normalizeContinuedQuotes(text: string): QuoteNormalizationResult {
  if (!text || text.indexOf("“") === -1) {
    // No opening curly quotes at all — nothing to normalize.
    return { text, paragraphsClosed: 0 };
  }

  // Split into paragraphs while preserving the exact blank-line separators, so
  // reassembly is lossless. We split on runs of (optional spaces + newline)×2+.
  const parts = text.split(/(\n[ \t]*\n+)/); // keeps separators as odd-index parts
  let paragraphsClosed = 0;

  const out = parts.map((part, idx) => {
    // Odd indices are the separators captured by the split group — leave as-is.
    if (idx % 2 === 1) return part;
    const paragraph = part;
    if (!paragraph.trim()) return paragraph;

    if (startsWithOuterOpen(paragraph)) {
      const delta = outerDelta(paragraph);
      if (delta > 0) {
        paragraphsClosed++;
        // Append the closing marks at the very end of the paragraph's content,
        // before any trailing whitespace, so spacing/line structure is preserved.
        return paragraph.replace(/(\s*)$/, "”".repeat(delta) + "$1");
      }
    }
    return paragraph;
  });

  return { text: out.join(""), paragraphsClosed };
}

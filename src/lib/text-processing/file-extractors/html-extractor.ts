// src/lib/text-processing/file-extractors/html-extractor.ts
// Universal HTML to plain text extraction
// Works in BOTH browser and Node.js (regex-based, no DOM dependency)
//
// This is the SINGLE SOURCE OF TRUTH for HTML extraction.
// Replaces both:
// - extractTextFromHTML() in text-utils.ts (DOM-based, browser-only)
// - extractTextFromHTMLServer() in text-processors.ts (regex-based, server-only)

import type { ExtractionResult, ExtractedAnnotation, ExtractionOptions } from '../types';

// ============================================================================
// HTML ENTITY DECODING
// ============================================================================

/**
 * Decode HTML entities to their text equivalents
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&hellip;/gi, "…")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&#(\d+);/g, (match, code) => {
      const num = parseInt(code, 10);
      return String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
      const num = parseInt(code, 16);
      return String.fromCharCode(num);
    });
}

// ============================================================================
// ANNOTATION EXTRACTION
// ============================================================================

/**
 * Extract annotations (sidenotes, footnotes, marginal notes) from HTML
 * and return both the annotations and the HTML with annotations removed
 */
function extractAnnotations(html: string): { html: string; annotations: ExtractedAnnotation[] } {
  const annotations: ExtractedAnnotation[] = [];
  let annotationIndex = 0;
  let cleanedHtml = html;

  // Pattern 1: <span class="sidenote">...</span>
  const sidenotePattern = /<span[^>]*class="[^"]*sidenote[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  cleanedHtml = cleanedHtml.replace(sidenotePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `sidenote-${annotationIndex++}`,
        type: 'sidenote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 2: <aside>...</aside> (not footnotes)
  const asidePattern = /<aside(?![^>]*class="[^"]*footnote)[^>]*>([\s\S]*?)<\/aside>/gi;
  cleanedHtml = cleanedHtml.replace(asidePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `aside-${annotationIndex++}`,
        type: 'sidenote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 3: <span class="note">, <span class="margin-note">, etc.
  const notePattern = /<span[^>]*class="[^"]*(?:note|margin-note|marginal|marginnote)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  cleanedHtml = cleanedHtml.replace(notePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `marginal-${annotationIndex++}`,
        type: 'marginal',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 4: <div class="footnote">...</div>
  const footnotePattern = /<div[^>]*class="[^"]*footnote[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  cleanedHtml = cleanedHtml.replace(footnotePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: 'footnote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 5: <aside class="footnote">...</aside>
  const footnoteAsidePattern = /<aside[^>]*class="[^"]*footnote[^"]*"[^>]*>([\s\S]*?)<\/aside>/gi;
  cleanedHtml = cleanedHtml.replace(footnoteAsidePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: 'footnote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  return { html: cleanedHtml, annotations };
}

// ============================================================================
// FRONT MATTER REMOVAL
// ============================================================================

/**
 * Remove front matter sections from HTML before text extraction.
 *
 * CONSERVATIVE approach: Only remove clearly identifiable boilerplate sections.
 * Title pages and epigraphs are kept (they won't match poem detection patterns).
 * TOC removal is handled separately by removeTOC().
 */
function removeFrontMatter(html: string): string {
  let result = html;

  // Remove Gutenberg boilerplate header section (safe - always front matter)
  result = result.replace(/<section[^>]*class="[^"]*pg-boilerplate[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
  result = result.replace(/<section[^>]*id="pg-header"[^>]*>[\s\S]*?<\/section>/gi, '');
  result = result.replace(/<div[^>]*id="pg-header"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Note: We intentionally do NOT try to detect and remove title pages or other
  // front matter heuristically. This caused issues with Whitman where BOOK I/II
  // were incorrectly removed. Title page content (h1 tags, etc.) will be extracted
  // as text but won't be detected as poems/chapters by the detection algorithms.

  return result;
}

// ============================================================================
// TOC REMOVAL
// ============================================================================

/**
 * Remove Table of Contents sections from HTML
 *
 * Detection strategies:
 * 1. Explicit TOC classes/IDs (class="toc", id="contents")
 * 2. Sections with many internal anchor links (<a href="#...">)
 * 3. Tables used for TOC layout
 */
function removeTOC(html: string): string {
  let cleanedHtml = html;

  // Remove TOC tables with explicit class/id
  cleanedHtml = cleanedHtml.replace(/<table[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<table[^>]*id="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');

  // Remove tables that look like TOC (many internal links)
  // Whitman's TOC uses <table> with many <a href="#link..."> entries
  cleanedHtml = cleanedHtml.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (match, content) => {
      const internalLinks = (content.match(/<a[^>]*href="#[^"]*"[^>]*>/gi) || []).length;
      // A table with 20+ internal links is almost certainly a TOC
      if (internalLinks >= 20) {
        console.log(`[removeTOC] Removed table with ${internalLinks} internal links (likely TOC)`);
        return ''; // Remove this TOC table
      }
      return match;
    }
  );

  // Remove TOC divs
  cleanedHtml = cleanedHtml.replace(/<div[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<div[^>]*id="[^"]*(?:contents|toc)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove sections that look like TOC (contain many internal links)
  // A TOC typically has 5+ internal links in a small section
  cleanedHtml = cleanedHtml.replace(
    /<(div|section|nav)[^>]*>([\s\S]*?)<\/\1>/gi,
    (match, tag, content) => {
      // Count internal anchor links
      const internalLinks = (content.match(/<a[^>]*href="#[^"]*"[^>]*>/gi) || []).length;
      // If this section has 5+ internal links and relatively little other content, it's likely a TOC
      const textContent = content.replace(/<[^>]+>/g, '').trim();
      const linkDensity = internalLinks / (textContent.length / 100 + 1);

      if (internalLinks >= 5 && linkDensity > 0.3) {
        return ''; // Remove this TOC section
      }
      return match;
    }
  );

  // Remove paragraphs that are TOC-like (many internal links, often used in Gutenberg)
  // Pattern: <p> containing 10+ internal links (like Baudelaire's TOC in <p class="margin">)
  cleanedHtml = cleanedHtml.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (match, content) => {
      const internalLinks = (content.match(/<a[^>]*href="#[^"]*"[^>]*>/gi) || []).length;
      // A paragraph with 10+ internal links is almost certainly a TOC
      if (internalLinks >= 10) {
        console.log(`[removeTOC] Removed paragraph with ${internalLinks} internal links (likely TOC)`);
        return ''; // Remove this TOC paragraph
      }
      return match;
    }
  );

  return cleanedHtml;
}

// ============================================================================
// COLLECTION HEADER DETECTION
// ============================================================================

/**
 * Detect collection headers in HTML by analyzing structure.
 *
 * A collection header is an <h2> (or similar) that is followed by:
 * - Another <h2> with no substantial content between them (just images/whitespace)
 * - OR only contains images/decorative elements before the next header
 *
 * This handles cases like Blake's "Songs of Innocence" where collection titles
 * look identical to poem titles in the text, but structurally have no poem
 * content immediately following them.
 *
 * We inject a special marker [COLLECTION: Title] that chapter detection can recognize.
 */
function detectAndMarkCollectionHeaders(html: string): string {
  // Find all chapter divs with h2 headers
  // Pattern: <div class="chapter">...<h2>TITLE</h2>...content...</div>
  const chapterPattern = /<div[^>]*class="[^"]*chapter[^"]*"[^>]*>([\s\S]*?)<\/div><!--\s*end\s*chapter\s*-->/gi;

  // Extract chapter blocks
  const chapters: { fullMatch: string; title: string; hasPoem: boolean }[] = [];
  let match;

  while ((match = chapterPattern.exec(html)) !== null) {
    const content = match[1];
    const fullMatch = match[0];

    // Extract title from h2
    const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!h2Match) continue;

    const title = h2Match[1].replace(/<[^>]+>/g, '').trim();

    // Check if this chapter has actual poem content (not just images)
    // Look for <p class="poem">, <pre>, or substantial text content
    const hasPoem = /<p[^>]*class="[^"]*poem[^"]*"[^>]*>/i.test(content) ||
                    /<pre[^>]*>/i.test(content) ||
                    // Check for substantial text after the h2 (excluding img tags)
                    ((): boolean => {
                      const afterH2 = content.slice(content.indexOf('</h2>') + 5);
                      const textOnly = afterH2.replace(/<[^>]+>/g, '').trim();
                      return textOnly.length > 50; // More than 50 chars of actual text
                    })();

    chapters.push({ fullMatch, title, hasPoem });
  }

  // Now identify collection headers: headers with no poem content
  // that are followed by headers with poem content
  let result = html;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    // If this chapter has no poem AND is followed by a chapter with poems,
    // it's likely a collection header
    if (!chapter.hasPoem) {
      const nextWithPoem = chapters.slice(i + 1).find(c => c.hasPoem);
      if (nextWithPoem) {
        // This is a collection header - inject marker into the h2
        const markedH2 = chapter.fullMatch.replace(
          /<h2([^>]*)>([\s\S]*?)<\/h2>/i,
          `<h2$1>[COLLECTION] $2</h2>`
        );
        result = result.replace(chapter.fullMatch, markedH2);
      }
    }
  }

  return result;
}

// ============================================================================
// POEM MARKER INJECTION
// ============================================================================

/**
 * Detect poems in HTML by analyzing structure and inject [POEM] markers.
 *
 * This handles anthology formats where poems have Title Case titles in <h2> tags
 * (like Whitman's "One's-Self I Sing", "As I Ponder'd in Silence").
 *
 * Structure detected:
 * - <div class="chapter"> containing <h2> with title and <pre> with poem content
 * - <h2> followed by <pre> or <p class="poem">
 *
 * We inject [POEM] before the title so poem detection can find boundaries.
 * This runs AFTER collection detection, so collection headers are already marked.
 */
function detectAndMarkPoems(html: string): string {
  let result = html;

  // Pattern 1: <div class="chapter"> with <h2> title and <pre> content (Whitman style)
  // This is very reliable - the HTML structure explicitly marks poems
  const chapterPoemPattern = /<div[^>]*class="[^"]*chapter[^"]*"[^>]*>([\s\S]*?)<\/div><!--\s*end\s*chapter\s*-->/gi;

  result = result.replace(chapterPoemPattern, (fullMatch, content) => {
    // Skip if this is already marked as a collection
    if (/\[COLLECTION\]/i.test(content)) {
      return fullMatch;
    }

    // Check if this has poem content (pre tag or substantial text)
    const hasPreContent = /<pre[^>]*>/i.test(content);
    const hasPoemClass = /<p[^>]*class="[^"]*poem[^"]*"[^>]*>/i.test(content);

    if (hasPreContent || hasPoemClass) {
      // Extract the h2 title
      const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      if (h2Match) {
        const titleContent = h2Match[1];
        // Skip if title is ALL CAPS (already detected by text-based detection)
        // or if it's a BOOK/PART marker (chapter, not poem)
        const titleText = titleContent.replace(/<[^>]+>/g, '').trim();
        const isAllCaps = titleText === titleText.toUpperCase() && titleText.length > 3;
        const isBookMarker = /^(BOOK|PART|CANTO|ACT|SCENE)\s/i.test(titleText);

        if (!isAllCaps && !isBookMarker && titleText.length > 0) {
          // Inject [POEM] marker as a separate div with the title text (no nested tags)
          // Use the clean titleText to avoid whitespace issues
          const markedContent = content.replace(
            /<h2([^>]*)>([\s\S]*?)<\/h2>/i,
            `<div class="poem-marker">[POEM] ${titleText}</div><h2$1>$2</h2>`
          );
          return fullMatch.replace(content, markedContent);
        }
      }
    }

    return fullMatch;
  });

  // Pattern 2: Standalone <h2> followed by <pre> (without chapter div wrapper)
  // Less common but handle it for robustness
  result = result.replace(
    /<h2([^>]*)>((?:(?!\[POEM\])[\s\S])*?)<\/h2>(\s*)<pre/gi,
    (match, attrs, title, space) => {
      const titleText = title.replace(/<[^>]+>/g, '').trim();
      const isAllCaps = titleText === titleText.toUpperCase() && titleText.length > 3;
      const isBookMarker = /^(BOOK|PART|CANTO|ACT|SCENE)\s/i.test(titleText);
      const isCollection = /\[COLLECTION\]/i.test(title);

      if (!isAllCaps && !isBookMarker && !isCollection && titleText.length > 0) {
        return `<h2${attrs}>[POEM] ${title}</h2>${space}<pre`;
      }
      return match;
    }
  );

  // Pattern 3: <h3> tags as poem titles (Baudelaire and similar anthology styles)
  // Strategy: Use HTML hierarchy to distinguish front matter from content
  // - <h1> = Book title (skip)
  // - <h2> = Major sections or TOC heading (already handled by Pattern 1 for chapter divs)
  // - <h3> = Poem titles (mark these)
  //
  // To avoid marking front matter <h3> tags, we check if the <h3> is followed by
  // substantial content (poem text in <p> tags) before the next <h3>

  // First, find positions of all h3 tags and check what follows each
  const h3Pattern = /<h3([^>]*)>([\s\S]*?)<\/h3>/gi;
  let h3Match;
  const h3Replacements: { original: string; replacement: string }[] = [];

  while ((h3Match = h3Pattern.exec(result)) !== null) {
    const fullMatch = h3Match[0];
    const attrs = h3Match[1];
    const title = h3Match[2];
    const matchEnd = h3Match.index + fullMatch.length;

    const titleText = title.replace(/<[^>]+>/g, '').trim();

    // Skip conditions (structural markers, etc.)
    const isAllCaps = titleText === titleText.toUpperCase() && titleText.length > 3;
    const isAlreadyMarked = /\[POEM\]/i.test(title);
    const isBookMarker = /^(BOOK|PART|CANTO|ACT|SCENE)\s/i.test(titleText);
    const isRomanNumeral = /^[IVXLC]+\.?$/.test(titleText);
    const isTooShort = titleText.length <= 2;

    if (isAllCaps || isAlreadyMarked || isBookMarker || isRomanNumeral || isTooShort) {
      continue;
    }

    // Check what follows this <h3> - look for content before the next <h3> or end
    const textAfter = result.slice(matchEnd);
    const nextH3Index = textAfter.search(/<h3[^>]*>/i);
    const contentBetween = nextH3Index >= 0 ? textAfter.slice(0, nextH3Index) : textAfter.slice(0, 2000);

    // Look for paragraph content (poem lines) - not just links or metadata
    const paragraphContent = contentBetween.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const totalParagraphText = paragraphContent
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .join('')
      .length;

    // If there's substantial paragraph content after this h3, it's likely a poem title
    // Front matter h3 tags (like "CONTENTS") are followed by links, not paragraphs
    const hasSubstantialContent = totalParagraphText > 50;

    if (hasSubstantialContent) {
      h3Replacements.push({
        original: fullMatch,
        replacement: `<div class="poem-marker">[POEM] ${titleText}</div><h3${attrs}>${title}</h3>`
      });
    }
  }

  // Apply replacements (in reverse order to preserve indices)
  for (const { original, replacement } of h3Replacements) {
    result = result.replace(original, replacement);
  }

  return result;
}

// ============================================================================
// MAIN EXTRACTION
// ============================================================================

// Spacing markers used during processing
const MARKERS = {
  PRE_NEWLINE: '\x00PRENL\x00',
  PRE_START: '\x00PRESTART\x00',
  HEADER_BREAK: '\x00HEADBRK\x00',
  SECTION_BREAK: '\x00SECTION\x00',
  POEM_BREAK: '\x00POEM\x00',
  STANZA_BREAK: '\x00STANZA\x00',
};

/**
 * Extract text from HTML content
 * Universal implementation that works in both browser and Node.js
 *
 * This function:
 * 1. Extracts and removes annotations (sidenotes, footnotes)
 * 2. Removes TOC sections
 * 3. Removes script/style elements
 * 4. Converts HTML structure to text with appropriate spacing
 * 5. Preserves whitespace for poetry when requested
 */
export function extractTextFromHTML(
  html: string,
  options: ExtractionOptions = {}
): ExtractionResult {
  const { preserveWhitespace = false } = options;
  const originalLength = html.length;

  let text = html;

  // Step 0: Remove front matter (Gutenberg header, title page) before processing
  text = removeFrontMatter(text);

  // Step 0b: Detect and mark collection headers before losing HTML structure
  text = detectAndMarkCollectionHeaders(text);

  // Step 0c: Detect and mark poems (Title Case titles in chapter divs with pre content)
  text = detectAndMarkPoems(text);

  // Step 1: Remove script and style elements
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Step 2: Remove TOC sections
  text = removeTOC(text);

  // Step 3: Remove "Contents" headings (orphaned after TOC removal)
  text = text.replace(/<h[1-6][^>]*>\s*(?:Contents|Table of Contents)\s*<\/h[1-6]>/gi, '');

  // Step 4: Extract annotations (removes them from content)
  const { html: annotationFreeHtml, annotations } = extractAnnotations(text);
  text = annotationFreeHtml;

  // Step 5: Handle PRE tags - preserve their content with newlines
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => {
    // Strip any nested tags but preserve whitespace
    const stripped = content.replace(/<[^>]+>/g, '');
    // Mark PRE content to preserve newlines
    const protectedContent = stripped.trim().replace(/\n/g, MARKERS.PRE_NEWLINE);
    return MARKERS.PRE_START + protectedContent + '\n\n';
  });

  // Step 5b: Convert poem-marker divs to have their own lines
  // These were injected by detectAndMarkPoems() and need to stay on separate lines
  text = text.replace(/<div[^>]*class="[^"]*poem-marker[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return '';
    return MARKERS.HEADER_BREAK + stripped + MARKERS.HEADER_BREAK;
  });

  // Step 6: Convert headers to have blank lines before/after
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return '';
    return MARKERS.HEADER_BREAK + stripped + MARKERS.HEADER_BREAK;
  });

  // Step 7: Convert paragraph tags
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    // Empty paragraph = visual spacing (potential stanza break in poetry)
    return stripped ? stripped + '\n' : '\n';
  });

  // Step 8: Convert br tags to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Step 9: Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    return '\n' + stripped + '\n';
  });

  // Step 10: Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Step 11: Decode HTML entities
  text = decodeHTMLEntities(text);

  // Step 12: Normalize whitespace based on preserveWhitespace option
  if (preserveWhitespace) {
    // For poetry: preserve ALL whitespace exactly
    // Only do minimal cleanup (remove trailing spaces, excessive blank lines 10+)
    text = text
      .replace(/[ \t]+$/gm, '')          // Remove trailing horizontal whitespace
      .replace(/\n{11,}/g, '\n\n\n\n\n\n\n\n\n\n')  // Only collapse 10+ blank lines
      // Restore markers
      .replace(new RegExp(MARKERS.HEADER_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_START.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_NEWLINE.replace(/\x00/g, '\\x00'), 'g'), '\n')
      .trim();
  } else {
    // For prose: normalize whitespace while preserving meaningful spacing
    // Preserve hierarchical spacing:
    // - 1 blank line (\n\n) = stanza break
    // - 2 blank lines (\n\n\n) = poem separation
    // - 3+ blank lines (\n\n\n\n+) = section/collection separation
    text = text
      .replace(/[ \t]+/g, ' ')             // Collapse horizontal whitespace
      .replace(/\n /g, '\n')               // Remove space after newline
      .replace(/ \n/g, '\n')               // Remove space before newline
      .replace(/\n{5,}/g, MARKERS.SECTION_BREAK)  // 5+ newlines = section break
      .replace(/\n{4}/g, MARKERS.POEM_BREAK)      // 4 newlines = poem break
      .replace(/\n{3}/g, MARKERS.STANZA_BREAK)    // 3 newlines = stanza break
      .replace(/\n+/g, '\n')               // Collapse remaining newlines to 1
      .replace(new RegExp(MARKERS.SECTION_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n\n\n')
      .replace(new RegExp(MARKERS.POEM_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n\n')
      .replace(new RegExp(MARKERS.STANZA_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.HEADER_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_START.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_NEWLINE.replace(/\x00/g, '\\x00'), 'g'), '\n')
      .trim();
  }

  return {
    text,
    annotations,
    stats: {
      originalLength,
      extractedLength: text.length,
      annotationsExtracted: annotations.length,
    },
  };
}

/**
 * Alias for backward compatibility with server-side code
 * @deprecated Use extractTextFromHTML instead
 */
export function extractTextFromHTMLServer(
  html: string,
  preserveWhitespace: boolean = false
): { text: string; annotationsCount: number } {
  const result = extractTextFromHTML(html, { preserveWhitespace });
  return {
    text: result.text,
    annotationsCount: result.annotations.length,
  };
}

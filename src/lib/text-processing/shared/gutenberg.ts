// src/lib/text-processing/shared/gutenberg.ts
// Utilities for handling Project Gutenberg front/back matter
// Also handles other publisher boilerplate

// ============================================================================
// TITLE EXTRACTION FROM GUTENBERG HEADER
// ============================================================================

/**
 * Result of extracting front matter from text
 */
export interface FrontMatterResult {
  /** The removed front matter text (for metadata extraction) */
  frontMatter: string;
  /** The cleaned content text (actual story/poems) */
  content: string;
  /** Whether any front matter was found and removed */
  removed: boolean;
}

/**
 * Extract and separate front matter from content.
 * Returns both the front matter (useful for title/author extraction)
 * and the cleaned content.
 */
export function extractFrontMatter(text: string): FrontMatterResult {
  // Split by double newlines and scan for metadata sections
  const sections = text.split(/\n\n+/);

  // Patterns for Gutenberg metadata (front matter to remove)
  const metadataPatterns = [
    // Project Gutenberg header/footer markers
    /^The Project Gutenberg (EBook|eBook|Ebook|e-book) of/i,
    /^\*{3}\s*START OF (THE |THIS )?(PROJECT )?GUTENBERG/i,
    /^\*{3}\s*END OF (THE |THIS )?(PROJECT )?GUTENBERG/i,
    // Book metadata fields (short sections with label: value format)
    /^Title:\s*.+/i,
    /^Author:\s*.+/i,
    /^Editor:\s*.+/i,
    /^Illustrator:\s*.+/i,
    /^Translator:\s*.+/i,
    /^Release Date:\s*.+/i,
    /^Posting Date:\s*.+/i,
    /^Last Updated:\s*.+/i,
    /^Language:\s*.+/i,
    /^Character set encoding:\s*.+/i,
    /^Credits?:\s*.+/i,
    /^Produced by\s*.+/i,
    /^E-?text prepared by/i,
    /^Note:\s*.+/i,
    // Transcriber notes and edition info
    /^Transcriber['']?s?\s*[Nn]ote/i,
    /^TRANSCRIBER['']?S?\s*NOTE/i,  // ALL CAPS variant
    /^\[?Most recently updated:/i,
    /^This (e-?book|edition) (is|was)/i,
    // Copyright and license
    /^Copyright\s+\d{4}/i,
    /^Public [Dd]omain/i,
    // URLs and file info
    /^https?:\/\//i,
    /^www\./i,
    /^\*{3}\s*$/,  // Standalone asterisk dividers
  ];

  // Patterns that indicate we've reached ACTUAL CONTENT (stop removing)
  // NOTE: These patterns are checked against individual SECTIONS (text between double newlines)
  // A section must match one of these to be considered "definitely content"
  const contentPatterns = [
    // Thematic section headers for anthologies: "I. LIFE.", "II. LOVE."
    /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".\-—–]+)\.?\s*$/,
    // Chapter/book markers
    /^(CHAPTER|Chapter|BOOK|Book|PART|Part|CANTO|Canto)\s+/i,
    // Roman numeral alone (poem number): "I.", "II." - but NOT just "I" which could be in text
    /^[IVXLC]+\.\s*$/,
  ];

  // Pattern for ALL CAPS titles - needs additional validation (followed by poem-like content)
  const allCapsPattern = /^[A-Z][A-Z\s,.'"-]{2,48}\.?\s*$/;

  // Helper: check if a section looks like metadata
  const isMetadata = (section: string): boolean => {
    const trimmed = section.trim();
    if (!trimmed) return true; // Empty sections are metadata

    // Check if the whole section matches a metadata pattern
    for (const pattern of metadataPatterns) {
      if (pattern.test(trimmed)) return true;
    }

    // For multi-line sections, also check if the FIRST LINE matches a metadata pattern
    // This handles cases like "TRANSCRIBER'S NOTE\n\nLong explanation..."
    const firstLine = trimmed.split('\n')[0].trim();
    for (const pattern of metadataPatterns) {
      if (pattern.test(firstLine)) return true;
    }

    // Check for metadata keywords anywhere in shorter sections
    if (trimmed.length < 500) {
      if (/\b(copyright|license|edition|published|printed|transcrib|ebook|e-book|gutenberg)\b/i.test(trimmed)) {
        return true;
      }
    }

    // Single-line label:value format
    if (/^[A-Za-z\s]{2,20}:\s*.+$/.test(trimmed) && !trimmed.includes('\n')) {
      return true;
    }

    return false;
  };

  // Helper: check if a section looks like poem content (multiple short lines)
  const looksLikePoemContent = (section: string): boolean => {
    const lines = section.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return false;

    // Poems typically have multiple lines with average length 20-60 chars
    const avgLength = lines.reduce((sum, l) => sum + l.trim().length, 0) / lines.length;
    return avgLength >= 15 && avgLength <= 80 && lines.length >= 2;
  };

  // Helper: check if a section looks like actual content
  const isContent = (section: string, nextSection?: string): boolean => {
    const trimmed = section.trim();
    if (!trimmed) return false;

    // Check definitive content patterns first
    for (const pattern of contentPatterns) {
      if (pattern.test(trimmed)) return true;
    }

    // ALL CAPS title needs to be followed by poem-like content to count
    // This prevents TOC entries like "RENUNCIATION" from being detected as content
    if (allCapsPattern.test(trimmed)) {
      // Single ALL CAPS word/phrase - only count if followed by poem content
      if (nextSection && looksLikePoemContent(nextSection)) {
        return true;
      }
      // If the section itself has multiple lines (title + poem), check that
      const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
      if (lines.length >= 3) {
        // First line is title, rest should be poem content
        const poemPart = lines.slice(1).join('\n');
        if (looksLikePoemContent(poemPart)) {
          return true;
        }
      }
      // Otherwise, single ALL CAPS line is likely TOC entry - not content
      return false;
    }

    // Multi-line sections with substantial content
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 4) {
      const avgLineLength = trimmed.length / lines.length;
      // Poems: 4+ lines, avg 15-80 chars
      // Prose: 4+ lines, avg 40+ chars
      if (avgLineLength >= 15) return true;
    }

    // Long single paragraph that's not metadata (prose content)
    if (trimmed.length >= 200 && !isMetadata(section)) {
      return true;
    }

    return false;
  };

  // Scan sections to find where content starts
  // Strategy: Check metadata FIRST, then content. This ensures transcriber notes
  // and other editorial content (which might look like content) are properly skipped.
  let contentStartIndex = 0;
  let consecutiveMetadata = 0;

  for (let i = 0; i < Math.min(30, sections.length); i++) {
    const section = sections[i].trim();
    const nextSection = sections[i + 1]?.trim();

    // Check metadata FIRST - this takes priority
    if (isMetadata(section)) {
      consecutiveMetadata++;
      contentStartIndex = i + 1;
      continue;
    }

    // If it's not metadata, check if it's definite content
    if (isContent(section, nextSection)) {
      contentStartIndex = i;
      break;
    }

    // Ambiguous section - if we've seen metadata before, keep scanning
    if (consecutiveMetadata === 0) {
      // No metadata seen yet, this might be content
      contentStartIndex = i;
      break;
    }
    // Otherwise, keep scanning (could be an oddly formatted metadata section)
  }

  if (contentStartIndex > 0) {
    const frontMatter = sections.slice(0, contentStartIndex).join('\n\n').trim();
    const content = sections.slice(contentStartIndex).join('\n\n').trim();
    // Debug: show what triggered content detection
    const triggerSection = sections[contentStartIndex]?.trim().substring(0, 80);
    console.log(`[extractFrontMatter] Extracted ${contentStartIndex} front matter sections, content starts with: "${triggerSection}..."`);
    return { frontMatter, content, removed: true };
  }

  return { frontMatter: '', content: text.trim(), removed: false };
}

/**
 * Extract the book title from Project Gutenberg front matter.
 * Looks for "Title: ..." line or "The Project Gutenberg eBook of ..." pattern.
 *
 * @deprecated Use AI for title extraction instead - send front matter to AI and let it find/generate the title.
 *             This algorithmic approach is unreliable for edge cases. See metadata.ts for the AI-based approach.
 *
 * @param frontMatter - The front matter text (from extractFrontMatter)
 * @returns The extracted title or null if not found
 */
export function extractTitleFromFrontMatter(frontMatter: string): string | null {
  if (!frontMatter) return null;

  const lines = frontMatter.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Prefer "Title: <TITLE>" format - it's cleaner
    const titleMatch = trimmed.match(/^Title:\s*(.+)$/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }

  // Fall back to "The Project Gutenberg eBook of <TITLE>" pattern
  for (const line of lines) {
    const trimmed = line.trim();
    const ebookMatch = trimmed.match(/^The Project Gutenberg (?:EBook|eBook|Ebook|e-book) of (.+)$/i);
    if (ebookMatch) {
      return ebookMatch[1].trim();
    }
  }

  return null;
}

/**
 * @deprecated Use extractTitleFromFrontMatter with extractFrontMatter instead
 */
export function extractTitleFromGutenbergHeader(text: string): string | null {
  const { frontMatter } = extractFrontMatter(text);
  return extractTitleFromFrontMatter(frontMatter);
}

// ============================================================================
// FRONT MATTER REMOVAL (convenience wrapper)
// ============================================================================

/**
 * Remove Gutenberg front matter markers from the beginning.
 * This is a convenience wrapper around extractFrontMatter that just returns the content.
 *
 * @param text - The full text including front matter
 * @returns The text with front matter removed
 */
export function removeGutenbergFrontMatter(text: string): string {
  const { content } = extractFrontMatter(text);
  return content;
}

// ============================================================================
// BACK MATTER DETECTION
// ============================================================================

/**
 * Detect and remove back matter (Project Gutenberg boilerplate, license text, etc.)
 * Returns the line index where back matter starts, or -1 if not found
 */
export function detectBackMatterStart(lines: string[]): number {
  // DEFINITIVE back matter patterns - these are very unlikely to appear in story content
  // More conservative approach to avoid cutting off chapters prematurely
  const definitiveBackMatterPatterns = [
    /^\*{3}\s*END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^End of (the )?Project Gutenberg/i,
    /^END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^\*{3}\s*END OF THE EBOOK/i,
    /^\*{3}\s*START:?\s*FULL LICENSE/i,
    // Publisher advertisements (common in old scanned books)
    /^GROSSET\s*&\s*DUNLAP/i,
    /^There's More to Follow/i,
    /^There is More to Follow/i,
    /^Ask for .+ list/i,
    /^May be had wherever books are sold/i,
    /^In case the wrapper is lost/i,
    // Other common publishers
    /^PENGUIN BOOKS/i,
    /^BANTAM BOOKS/i,
    /^RANDOM HOUSE/i,
    /^HARPER\s*&\s*(BROTHERS|ROW|COLLINS)/i,
    /^SIMON\s*&\s*SCHUSTER/i,
    /^DOUBLEDAY/i,
  ];

  // POSSIBLE back matter patterns - these need confirmation from surrounding context
  // They could appear in story content (letters, journals, etc.)
  const possibleBackMatterPatterns = [
    /^\s*ADDENDA\s*$/i,     // Only if exactly "ADDENDA" on line
    /^\s*APPENDIX\s*$/i,    // Only if exactly "APPENDIX" on line
    /^\s*FOOTNOTES\s*$/i,   // Footnotes section header
    /^\s*ENDNOTES\s*$/i,    // Endnotes section header
    /^THE END\.?\s*$/i,     // Could be end of story OR end of a letter
    /^FINIS\.?\s*$/i,       // Latin for "the end"
    /^FIN\.?\s*$/i,         // French/Spanish for "the end"
  ];

  // Patterns that strongly indicate Gutenberg boilerplate or publisher ads (not story content)
  const boilerplatePatterns = [
    /Project Gutenberg Literary Archive Foundation/i,
    /This eBook is for the use of anyone anywhere/i,
    /SMALL PRINT!/i,
    /^Section \d+\.\s+General Terms of Use/i,
    /trademark\/copyright agreement/i,
    /gutenberg\.org/i,
    /public domain in the United States/i,
    /copyright laws of most countries/i,
    /^Produced by .+ from/i,
    /^Updated editions will replace the previous one/i,
    // Publisher advertisement patterns
    /Authors' Alphabetical List/i,
    /Popular Copyrighted Fiction/i,
    /books? (here )?you are sure to want/i,
    /greatest Index of Good Fiction/i,
    /Look on the Other Side/i,
    /write to the publishers/i,
    /complete (free )?list/i,
    /DETECTIVE STORIES BY/i,
    /STORIES BY [A-Z]\. [A-Z]\. [A-Z]/i,  // "STORIES BY J. S. FLETCHER" pattern
  ];

  // Search from the LAST 30% of the document for definitive markers
  // This ensures we catch publisher ads that appear after the story ends
  const scanStart = Math.floor(lines.length * 0.7);

  // First pass: look for DEFINITIVE markers (these are 100% reliable)
  for (let i = scanStart; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of definitiveBackMatterPatterns) {
      if (pattern.test(line)) {
        return i;
      }
    }
  }

  // Second pass: look for boilerplate content (3+ consecutive lines)
  let consecutiveBoilerplate = 0;
  let firstBoilerplateLine = -1;

  for (let i = scanStart; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    let isBoilerplate = false;
    for (const pattern of boilerplatePatterns) {
      if (pattern.test(line)) {
        isBoilerplate = true;
        break;
      }
    }

    if (isBoilerplate) {
      if (firstBoilerplateLine === -1) {
        firstBoilerplateLine = i;
      }
      consecutiveBoilerplate++;
      // If we find 3+ lines of boilerplate, consider it back matter
      if (consecutiveBoilerplate >= 3) {
        return firstBoilerplateLine;
      }
    } else {
      // Reset if we find non-boilerplate content
      consecutiveBoilerplate = 0;
      firstBoilerplateLine = -1;
    }
  }

  // Third pass: look for POSSIBLE markers in the LAST 10% (very end of document)
  // These are less reliable so we only trust them near the very end
  const veryEndStart = Math.floor(lines.length * 0.90);
  for (let i = veryEndStart; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of possibleBackMatterPatterns) {
      if (pattern.test(line)) {
        return i;
      }
    }
  }

  return -1; // No back matter detected
}

/**
 * Extract back matter from lines array
 */
export function extractBackMatter(lines: string[]): { contentLines: string[]; backMatter: string; removed: boolean } {
  const backMatterStart = detectBackMatterStart(lines);

  if (backMatterStart > 0) {
    return {
      contentLines: lines.slice(0, backMatterStart),
      backMatter: lines.slice(backMatterStart).join('\n'),
      removed: true,
    };
  }

  return {
    contentLines: lines,
    backMatter: '',
    removed: false,
  };
}

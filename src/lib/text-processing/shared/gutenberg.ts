// src/lib/text-processing/shared/gutenberg.ts
// Utilities for handling Project Gutenberg front/back matter
// Also handles other publisher boilerplate

// ============================================================================
// FRONT MATTER REMOVAL
// ============================================================================

/**
 * Remove Gutenberg front matter markers from the beginning
 * These often appear before the actual story front matter
 *
 * Improved strategy:
 * 1. Scan sections looking for metadata patterns (not just the first 5)
 * 2. DON'T break on first non-match - metadata can be interspersed
 * 3. Stop when we find actual content (thematic headers, chapter markers, substantial prose)
 */
export function removeGutenbergFrontMatter(text: string): string {
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
  const contentPatterns = [
    // Thematic section headers for anthologies: "I. LIFE.", "II. LOVE."
    /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".\-—–]+)\.?\s*$/,
    // Chapter/book markers
    /^(CHAPTER|Chapter|BOOK|Book|PART|Part|CANTO|Canto)\s+/i,
    // Roman numeral alone (poem number): "I.", "II."
    /^[IVXLC]+\.?\s*$/,
    // ALL CAPS poem titles (3-50 chars, at least 2 capital letters)
    /^[A-Z][A-Z\s,.'"-]{2,48}\.?\s*$/,
    // Content that looks like actual prose/poetry (long lines, sentence structure)
  ];

  // Helper: check if a section looks like metadata
  const isMetadata = (section: string): boolean => {
    const trimmed = section.trim();
    if (!trimmed) return true; // Empty sections are metadata

    // Check against metadata patterns
    for (const pattern of metadataPatterns) {
      if (pattern.test(trimmed)) return true;
    }

    // Short sections (under 200 chars) that look like bibliographic info
    if (trimmed.length < 200) {
      // Contains common metadata keywords
      if (/\b(copyright|license|edition|published|printed|transcrib|ebook|e-book|gutenberg)\b/i.test(trimmed)) {
        return true;
      }
      // Looks like a label:value pair on a single line
      if (/^[A-Za-z\s]{2,20}:\s*.+$/.test(trimmed) && !trimmed.includes('\n')) {
        return true;
      }
    }

    return false;
  };

  // Helper: check if a section looks like actual content
  const isContent = (section: string): boolean => {
    const trimmed = section.trim();
    if (!trimmed) return false;

    // Check content patterns
    for (const pattern of contentPatterns) {
      if (pattern.test(trimmed)) return true;
    }

    // Multiple lines of substantial text (likely prose/poetry content)
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 3) {
      const avgLineLength = trimmed.length / lines.length;
      // If we have 3+ lines averaging 20+ chars, likely content
      if (avgLineLength >= 20) return true;
    }

    // Single long line (100+ chars) that's not metadata
    if (trimmed.length >= 100 && !isMetadata(section)) {
      return true;
    }

    return false;
  };

  // Scan sections to find where content starts
  let contentStartIndex = 0;
  let consecutiveMetadata = 0;

  // Allow scanning up to 30 sections (generous for poetry anthologies with lots of front matter)
  for (let i = 0; i < Math.min(30, sections.length); i++) {
    const section = sections[i].trim();

    if (isContent(section)) {
      // Found actual content - this is where the story/poems start
      contentStartIndex = i;
      break;
    }

    if (isMetadata(section)) {
      consecutiveMetadata++;
      contentStartIndex = i + 1; // Skip this metadata section
    } else {
      // Ambiguous section - if we've seen metadata, treat as continuation
      // If we haven't seen any metadata yet, might be content starting
      if (consecutiveMetadata === 0) {
        // No metadata seen yet, this might be content
        contentStartIndex = i;
        break;
      }
      // Otherwise, keep scanning (could be an oddly formatted metadata section)
    }
  }

  if (contentStartIndex > 0) {
    const result = sections.slice(contentStartIndex).join('\n\n').trim();
    console.log(`[removeGutenbergFrontMatter] Removed ${contentStartIndex} front matter sections`);
    return result;
  }

  return text.trim();
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

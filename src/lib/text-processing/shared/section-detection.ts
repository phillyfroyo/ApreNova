// src/lib/text-processing/shared/section-detection.ts
// Section boundary detection for anthologies - SINGLE SOURCE OF TRUTH
//
// Sections are thematic groupings like "I. LIFE.", "II. LOVE.", "III. NATURE."
// that organize poems within an anthology.
//
// This module is used by:
// 1. Production upload pipeline (admin and user story uploads)
// 2. Dev Tools SU TP Algorithms testing system
// 3. Anthology preprocessing
//
// CRITICAL: Never duplicate this logic. Always import from this module.

import { SECTION_HEADER_PATTERN, isSectionHeader } from './poem-detection';
import type { DetectedSection } from '../types';

// Re-export the type for convenience
export type { DetectedSection } from '../types';

/**
 * Detect section/collection boundaries in an anthology.
 * Sections are marked by headers like "I. LIFE.", "II. LOVE.", "III. NATURE."
 *
 * @param lines - Array of text lines
 * @returns Array of detected sections
 */
export function detectSectionBoundaries(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  let currentSectionStart = -1;
  let currentHeader = "";
  let currentNumber = "";
  let currentTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isSectionHeader(trimmed)) {
      // Found a new section header
      if (currentSectionStart >= 0) {
        // Close previous section
        sections.push({
          number: currentNumber,
          title: currentTitle,
          header: currentHeader,
          startLine: currentSectionStart,
          endLine: i,
          lines: lines.slice(currentSectionStart, i),
        });
      }

      // Parse the header
      const match = trimmed.match(SECTION_HEADER_PATTERN);
      currentNumber = match?.[1] || "";
      currentTitle = match?.[2]?.replace(/\.$/, "").trim() || "";
      currentHeader = trimmed;
      currentSectionStart = i;
    }
  }

  // Don't forget the last section
  if (currentSectionStart >= 0) {
    sections.push({
      number: currentNumber,
      title: currentTitle,
      header: currentHeader,
      startLine: currentSectionStart,
      endLine: lines.length,
      lines: lines.slice(currentSectionStart),
    });
  }

  // If no sections detected, treat entire content as one section
  if (sections.length === 0 && lines.length > 0) {
    sections.push({
      number: "1",
      title: "Poems",
      header: "",
      startLine: 0,
      endLine: lines.length,
      lines: lines,
    });
  }

  return sections;
}

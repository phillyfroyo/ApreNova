// src/lib/user-stories/alignment-check.ts
// Pure detection utility for translation alignment issues
// Detects line count mismatches and content-vs-blank shifts between source and translated lines

export type AlignmentIssueType = 'content_vs_blank' | 'line_count_mismatch';

export interface AlignmentIssue {
  lineIndex: number;
  type: AlignmentIssueType;
  sourceContent: string;
  translatedContent: string;
}

export interface ChapterAlignmentResult {
  hasIssues: boolean;
  issueCount: number;
  lineCountMismatch: { sourceLineCount: number; translatedLineCount: number } | null;
  contentVsBlankIssues: AlignmentIssue[];
}

/**
 * Detect alignment issues between source and translated line arrays.
 *
 * Checks for:
 * 1. Line count mismatch — sourceLines.length !== translatedLines.length
 * 2. Content vs blank mismatch — line N has content in one language but is blank in the other
 *
 * @param sourceLines - Source language lines
 * @param translatedLines - Translated lines
 * @returns Alignment result with issue details
 */
export function detectAlignmentIssues(
  sourceLines: string[],
  translatedLines: string[]
): ChapterAlignmentResult {
  const contentVsBlankIssues: AlignmentIssue[] = [];

  // Check line count mismatch
  const lineCountMismatch =
    sourceLines.length !== translatedLines.length
      ? { sourceLineCount: sourceLines.length, translatedLineCount: translatedLines.length }
      : null;

  // Check content vs blank mismatches across the longer array
  const maxLen = Math.max(sourceLines.length, translatedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const src = sourceLines[i] ?? '';
    const tgt = translatedLines[i] ?? '';
    const srcBlank = src.trim() === '';
    const tgtBlank = tgt.trim() === '';

    if (srcBlank !== tgtBlank) {
      contentVsBlankIssues.push({
        lineIndex: i,
        type: 'content_vs_blank',
        sourceContent: src,
        translatedContent: tgt,
      });
    }
  }

  const issueCount =
    (lineCountMismatch ? 1 : 0) + contentVsBlankIssues.length;

  return {
    hasIssues: issueCount > 0,
    issueCount,
    lineCountMismatch,
    contentVsBlankIssues,
  };
}

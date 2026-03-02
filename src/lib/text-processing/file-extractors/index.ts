// src/lib/text-processing/file-extractors/index.ts
// File extraction router - dispatches to appropriate extractor based on file type

import type { FileType, ExtractionResult, ExtractionOptions } from '../types';
import { extractTextFromHTML } from './html-extractor';
import { extractTextFromRTF, stripRTF } from './rtf-extractor';
import { extractTextFromTxt } from './txt-extractor';
import { extractTextFromMd } from './md-extractor';

// Re-export individual extractors for direct use
export { extractTextFromHTML, extractTextFromHTMLServer } from './html-extractor';
export { extractTextFromRTF, stripRTF } from './rtf-extractor';
export { extractTextFromTxt } from './txt-extractor';
export { extractTextFromMd } from './md-extractor';

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

/**
 * Detect file type from filename
 */
export function detectFileTypeFromName(filename: string): FileType {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return 'html';
  }
  if (lowerName.endsWith('.rtf')) {
    return 'rtf';
  }
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return 'md';
  }
  // Default to txt for .txt or unknown extensions
  return 'txt';
}

/**
 * Detect file type from MIME type
 */
export function detectFileTypeFromMime(mimeType: string): FileType {
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime === 'text/html' || lowerMime === 'application/xhtml+xml') {
    return 'html';
  }
  if (lowerMime === 'application/rtf' || lowerMime === 'text/rtf') {
    return 'rtf';
  }
  if (lowerMime === 'text/markdown' || lowerMime === 'text/x-markdown') {
    return 'md';
  }
  // Default to txt for text/plain or unknown types
  return 'txt';
}

/**
 * Detect file type from File object (browser) or filename + MIME type
 */
export function detectFileType(file: { name: string; type?: string }): FileType {
  // Try MIME type first if available
  if (file.type) {
    const mimeType = detectFileTypeFromMime(file.type);
    if (mimeType !== 'txt') {
      return mimeType;
    }
  }

  // Fall back to filename extension
  return detectFileTypeFromName(file.name);
}

// ============================================================================
// MAIN EXTRACTION ROUTER
// ============================================================================

/**
 * Extract text from raw file content based on file type
 *
 * This is the main entry point for file extraction.
 * It routes to the appropriate extractor based on file type.
 *
 * @param rawContent - Raw file content as string
 * @param fileType - Type of file (html, txt, rtf, md)
 * @param options - Extraction options
 * @returns ExtractionResult with extracted text and annotations
 */
export function extractText(
  rawContent: string,
  fileType: FileType,
  options: ExtractionOptions = {}
): ExtractionResult {
  switch (fileType) {
    case 'html':
      return extractTextFromHTML(rawContent, options);
    case 'rtf':
      return extractTextFromRTF(rawContent, options);
    case 'md':
      return extractTextFromMd(rawContent, options);
    case 'txt':
    default:
      return extractTextFromTxt(rawContent, options);
  }
}

// ============================================================================
// SUPPORTED FILE TYPES (for UI validation)
// ============================================================================

export interface SupportedFileType {
  ext: string;
  mime: string;
  label: string;
}

export const SUPPORTED_FILE_TYPES: SupportedFileType[] = [
  { ext: '.txt', mime: 'text/plain', label: 'Plain Text' },
  { ext: '.html', mime: 'text/html', label: 'HTML' },
  { ext: '.htm', mime: 'text/html', label: 'HTML' },
  { ext: '.rtf', mime: 'application/rtf', label: 'Rich Text Format' },
  { ext: '.md', mime: 'text/markdown', label: 'Markdown' },
];

/**
 * Check if a file is an accepted type for story upload
 */
export function isAcceptedFile(file: { name: string; type?: string }): boolean {
  const fileType = detectFileType(file);
  return ['html', 'txt', 'rtf', 'md'].includes(fileType);
}

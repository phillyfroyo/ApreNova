// src/lib/poem-processing/index.ts
// Barrel export for poem processing module
// This is the public API - import from '@/lib/poem-processing'

// Types
export type {
  AnnotatedPoemLine,
  StanzaDetectionResult,
  StanzaDetectorConfig,
  DetectedPoem,
  PoemBoundaryResult,
  BilingualPoemLine,
  PoemPageContent,
  PoemLineMetadata,
  PoemLineMetadataMap,
} from './types';

// Stanza detection (THE single source of truth)
export {
  detectStanzas,
  toMetadataMap,
  toTextLines,
  groupLinesIntoStanzas,
} from './stanza-detector';

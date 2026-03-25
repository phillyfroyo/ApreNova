// src/components/unified-translator/types.ts

export interface EnhancedTranslation {
  contextTranslation?: string;
  isDerivative?: boolean;
  rootWord?: string;
  rootTranslation?: string;
  otherCommonTranslations?: Array<string | { translation: string; example?: { en: string; es: string } }>;
  partOfSpeech?: string;
  subject?: string;
  subjectTranslation?: string;
  derivatives?: Array<{
    pos: string;
    word: string;
    translation: string;
    example: { en: string; es: string };
  }>;
  verbChart?: {
    tense: string;
    infinitive: string;
    conjugations: Record<string, string>;
  };
}

export interface UnifiedTranslatorProps {
  sentence: string;
  staticTranslation?: string;
  enabled?: boolean;
  autoTriggerAll?: boolean | number;
  readOnlyMode?: boolean;
  onTranslationStateChange?: (hasActiveTranslation: boolean) => void;
  onSelectionChange?: (selectedIndices: { start: number; end: number } | null) => void;
  onManualTranslate?: (translateFn: () => void) => void;
  onClearSelection?: (clearFn: () => void) => void;
  onTranslationData?: (data: { word: string; translation: string; enrichedData?: any } | null) => void;
  sentenceIndex?: number;
  contextSentences?: Array<{ es: string; en: string }>;
  externalSelection?: { start: number; end: number } | null;
  onWordClick?: (wordIndex: number) => void;
  parentHasSelection?: boolean;
}

// src/lib/wordQuickSchema.ts
//
// Tiny forced-tool schema for the quick (Call A) word translation — only the
// headline fields. Mirrors the relevant subset of WordTranslationToolInput so
// the frontend can merge it into the same EnhancedTranslation it later replaces
// with the full payload from /api/translate-word.

import type Anthropic from "@anthropic-ai/sdk";

export const WORD_QUICK_TOOL: Anthropic.Tool = {
  name: "report_quick_translation",
  description:
    "Report the context translation of the word (and its subject if it is a finite verb). Call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      contextTranslation: {
        type: "string",
        description: "The context-appropriate translation of the word.",
      },
      subject: {
        type: ["string", "null"],
        description:
          "For a CONJUGATED/finite verb only: the subject from the sentence. Null otherwise.",
      },
      subjectTranslation: {
        type: ["string", "null"],
        description: "Translation of `subject`. Null when `subject` is null.",
      },
    },
    required: ["contextTranslation"],
  },
};

export interface WordQuickToolInput {
  contextTranslation?: string;
  subject?: string | null;
  subjectTranslation?: string | null;
}

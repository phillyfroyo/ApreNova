// src/lib/wordTranslationSchema.ts
//
// Structured-output contract for the word-translation route.
//
// We force the model to emit its answer through a single tool whose
// `input_schema` IS the JSON shape the frontend consumes (the
// `EnhancedTranslation` interface in
// src/components/unified-translator/types.ts). Forcing tool use guarantees a
// well-formed object — no more fenced-```json``` stripping or parse-failure
// 500s — and lets us delete the long example responses from the prompts.
//
// NOTE: this is the SDK-0.71.2-compatible path (forced tool use). When the
// Anthropic SDK is upgraded, this can migrate to `output_config.format` /
// `messages.parse()`; the schema below carries over almost unchanged.

import type Anthropic from "@anthropic-ai/sdk";

const exampleObject = {
  type: "object",
  description: "An example sentence pair demonstrating the translation in use.",
  properties: {
    en: { type: "string", description: "English sentence (8-15 words)." },
    es: { type: "string", description: "Spanish sentence (8-15 words)." },
  },
  required: ["en", "es"],
} as const;

/**
 * The tool the model is forced to call. Its `input_schema` is the canonical
 * word-translation shape. Field semantics live in the prompt; the schema only
 * pins the structure so the response is always parseable.
 */
export const WORD_TRANSLATION_TOOL: Anthropic.Tool = {
  name: "report_word_translation",
  description:
    "Report the structured analysis of the requested word. Call this exactly once with the complete analysis.",
  input_schema: {
    type: "object",
    properties: {
      partOfSpeech: {
        type: ["string", "null"],
        description:
          "Part of speech as used in the sentence (noun, verb, adjective, adverb, preposition, pronoun, conjunction, determiner, modal verb, auxiliary verb).",
      },
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
      isDerivative: {
        type: "boolean",
        description: "True if the word is a conjugated/inflected form.",
      },
      rootWord: {
        type: ["string", "null"],
        description: "Base/root form when isDerivative is true; null otherwise.",
      },
      rootTranslation: {
        type: ["string", "null"],
        description: "Translation of rootWord; null when rootWord is null.",
      },
      otherCommonTranslations: {
        type: "array",
        description:
          "0-2 functionally distinct alternate translations, each with an example.",
        items: {
          type: "object",
          properties: {
            translation: {
              type: "string",
              description: "Alternate translation with a short parenthetical.",
            },
            example: exampleObject,
          },
          required: ["translation"],
        },
      },
      derivatives: {
        type: "array",
        description:
          "Cross-POS derivatives (0-2 typically). Empty array if none.",
        items: {
          type: "object",
          properties: {
            pos: {
              type: "string",
              description: "noun, verb, adjective, or adverb.",
            },
            word: { type: "string", description: "The derivative word form." },
            translation: { type: "string", description: "Its translation." },
            example: exampleObject,
          },
          required: ["pos", "word", "translation"],
        },
      },
      verbChart: {
        type: ["object", "null"],
        description:
          "Conjugation chart when a related verb exists; null otherwise.",
        properties: {
          tense: { type: "string" },
          infinitive: { type: "string" },
          conjugations: {
            type: "object",
            description:
              "Map of the six subject pronouns to their conjugated forms.",
            additionalProperties: { type: "string" },
          },
        },
        required: ["tense", "infinitive", "conjugations"],
      },
    },
    required: ["contextTranslation", "isDerivative"],
  },
};

/** Shape of the validated tool input (kept loose — the route applies defaults). */
export interface WordTranslationToolInput {
  partOfSpeech?: string | null;
  contextTranslation?: string;
  subject?: string | null;
  subjectTranslation?: string | null;
  isDerivative?: boolean;
  rootWord?: string | null;
  rootTranslation?: string | null;
  otherCommonTranslations?: Array<{ translation: string; example?: { en: string; es: string } }>;
  derivatives?: Array<{ pos: string; word: string; translation: string; example?: { en: string; es: string } }>;
  verbChart?: {
    tense: string;
    infinitive: string;
    conjugations: Record<string, string>;
  } | null;
}

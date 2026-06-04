// src/lib/phraseTranslationSchema.ts
//
// Structured-output contract for the phrase-translation route (GPT-4o).
//
// We use OpenAI's native json_schema response_format (strict mode) so the
// model's reply is always a valid object matching this shape — replacing the
// fragile regex ```json``` stripping + JSON.parse that could 500.
//
// The shape mirrors what getPhrasePrompt(...) describes and what the frontend
// consumes via { translations: { primary, otherCommonTranslations } }.
//
// OpenAI strict mode requires: every property listed in `required`, and
// `additionalProperties: false` on every object. Optional-ness is expressed by
// allowing null (the route treats null example as absent).

export const PHRASE_TRANSLATION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "phrase_translation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: {
          type: "string",
          description:
            "The context-based translation of the selected phrase.",
        },
        otherCommonTranslations: {
          type: "array",
          description:
            "0-2 additional common translations (general usage). Empty array if none or if the whole sentence was selected.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              translation: {
                type: "string",
                description: "An alternate translation of the phrase.",
              },
              example: {
                type: ["object", "null"],
                additionalProperties: false,
                description:
                  "Example sentence pair for this alternate; null if not applicable.",
                properties: {
                  en: { type: "string" },
                  es: { type: "string" },
                },
                required: ["en", "es"],
              },
            },
            required: ["translation", "example"],
          },
        },
      },
      required: ["primary", "otherCommonTranslations"],
    },
  },
} as const;

/** Shape of the validated phrase-translation output. */
export interface PhraseTranslationResult {
  primary: string;
  otherCommonTranslations: Array<{
    translation: string;
    example: { en: string; es: string } | null;
  }>;
}

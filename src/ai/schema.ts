/**
 * OpenAI structured-outputs response format for the assistant.
 *
 * MUST stay in shape-sync with the AiBlock union in src/api/types.ts — the
 * validator in src/ai/validate.ts is the runtime bridge between the two.
 * Strict mode requires every property listed in `required` and
 * `additionalProperties: false` on every object; optionality is expressed as
 * nullable union types. The `description` strings are part of the prompt —
 * the model reads them, so keep them instructive.
 */
export const AI_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cidian_assistant_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['blocks'],
      properties: {
        blocks: {
          type: 'array',
          description:
            'The reply as typed blocks in reading order. Prefer several small blocks over one large one.',
          items: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'text', 'sourceIndexes'],
                properties: {
                  kind: { type: 'string', enum: ['text'] },
                  text: {
                    type: 'string',
                    description:
                      'Short plain prose, no markdown. Aim under 120 words. Chinese example sentences never go here — use an example block.',
                  },
                  sourceIndexes: {
                    type: 'array',
                    items: { type: 'integer' },
                    description:
                      '1-based numbers of the grounding sources this passage relies on. Empty array when relying on general model knowledge. Never cite a number not in the provided list.',
                  },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'zh', 'pinyin', 'en', 'note', 'sourceIndexes'],
                properties: {
                  kind: { type: 'string', enum: ['example'] },
                  zh: {
                    type: 'string',
                    description: 'A natural, register-appropriate Chinese example sentence.',
                  },
                  pinyin: {
                    type: 'string',
                    description: "Display-ready pinyin in the user's preferred style.",
                  },
                  en: { type: 'string', description: 'Natural English translation.' },
                  note: {
                    type: ['string', 'null'],
                    description:
                      'One short line on what the example demonstrates; null when self-evident.',
                  },
                  sourceIndexes: {
                    type: 'array',
                    items: { type: 'integer' },
                    description:
                      '1-based grounding source numbers this example is drawn from or supported by; empty if invented for illustration.',
                  },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'simplified', 'traditional', 'pinyin', 'gloss', 'entryId'],
                properties: {
                  kind: { type: 'string', enum: ['term'] },
                  simplified: { type: 'string' },
                  traditional: {
                    type: ['string', 'null'],
                    description: 'Traditional form; null when identical to simplified.',
                  },
                  pinyin: {
                    type: 'string',
                    description: "Display-ready pinyin in the user's preferred style.",
                  },
                  gloss: { type: 'string', description: 'Compact English gloss for this term.' },
                  entryId: {
                    type: ['string', 'null'],
                    description:
                      "The grounding source's entry id, verbatim, ONLY when this term is one of the provided dictionary sources; otherwise null.",
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
} as const;

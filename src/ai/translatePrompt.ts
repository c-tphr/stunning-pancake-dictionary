import type {
  DictionaryEntry,
  RestructuredDocument,
  TranslateSegmentsRequest,
} from '../api';
import { toToneMarks } from '../lib/pinyin';
import type { OpenAiChatMessage } from './prompts';

/**
 * Prompt layer for the Workspace data pipeline: RESTRUCTURE (raw pasted or
 * fetched text → aligned paragraphs/segments) and TRANSLATE (segment batch →
 * English drafts). The future OpenAI adapter sends
 * `{ ...buildRestructurePayload(text), model }` / `{ ...buildTranslatePayload(req), model }`
 * under the SSO-certificate credentials and runs responses through the parse
 * functions below. Nothing in this file performs a network call. The mock
 * adapter calls the builders too, so the plumbing stays exercised.
 */

/* ================================ RESTRUCTURE =============================== */

export const RESTRUCTURE_SYSTEM_PROMPT = `You are the document-preparation engine inside Cídiǎn's translation Workspace, a CAT tool for professional Chinese→English translators. You receive raw pasted text and convert it into structured, aligned segments.

## Your job
1. Decide the input MODE:
   - "source-only": Chinese source text with no accompanying translation.
   - "mixed": Chinese source text interleaved with its English translation (commonly alternating paragraphs or alternating sentences; occasionally side-by-side lines).
   Stray Latin inside otherwise-Chinese text (names, numbers, product codes) does NOT make the input mixed — mixed means an actual running translation is present.
2. Split the source into PARAGRAPHS (respect the input's paragraph breaks; do not invent or remove paragraphs).
3. Split each paragraph into SENTENCE SEGMENTS. Sentence boundaries are 。！？；… and their Western equivalents when used to end a sentence. Keep the terminal punctuation with its sentence. Closing quotes/brackets (」』”）) that immediately follow terminal punctuation belong to the preceding segment.
4. In mixed mode, align each source segment with its translation sentence-by-sentence. If a source sentence has no identifiable translation, its target is "". If a translation sentence covers two source sentences, attach it to the first and leave the second's target "".

## Hard rules
- Preserve ALL source text verbatim — every character, including punctuation and numbers. Never correct, normalize, rewrite, or omit source text.
- Never translate anything yourself during restructuring. Targets come only from translation text actually present in the input.
- Never fabricate alignment: when unsure which translation matches, prefer "" over a guess.
- Headings and list items are paragraphs of one segment each.
- Respond ONLY with JSON conforming to the provided schema.`;

export const RESTRUCTURE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cidian_restructure_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'paragraphs'],
      properties: {
        mode: {
          type: 'string',
          enum: ['source-only', 'mixed'],
          description:
            'Whether the input contained a running English translation alongside the Chinese source.',
        },
        paragraphs: {
          type: 'array',
          description: 'Paragraphs in document order.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['segments'],
            properties: {
              segments: {
                type: 'array',
                description: 'Sentence segments in order within the paragraph.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['source', 'target'],
                  properties: {
                    source: {
                      type: 'string',
                      description:
                        'One source sentence, verbatim from the input, terminal punctuation included.',
                    },
                    target: {
                      type: 'string',
                      description:
                        'The aligned translation sentence taken verbatim from the input in mixed mode; "" in source-only mode or when no translation matches.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** Everything the OpenAI adapter needs except model + auth. */
export function buildRestructurePayload(rawText: string): {
  messages: OpenAiChatMessage[];
  response_format: typeof RESTRUCTURE_RESPONSE_FORMAT;
} {
  return {
    messages: [
      { role: 'system', content: RESTRUCTURE_SYSTEM_PROMPT },
      { role: 'user', content: `RAW INPUT TEXT:\n\n${rawText}` },
    ],
    response_format: RESTRUCTURE_RESPONSE_FORMAT,
  };
}

/** Defensive parse of the restructure response. Throws when nothing usable survives. */
export function parseRestructureResponse(rawContent: string): RestructuredDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Restructure response was not valid JSON');
  }
  const root = parsed as { mode?: unknown; paragraphs?: unknown };
  const mode = root.mode === 'mixed' ? 'mixed' : 'source-only';
  const rawParagraphs = Array.isArray(root.paragraphs) ? root.paragraphs : [];
  const paragraphs = rawParagraphs
    .map((p) => {
      const rawSegments =
        typeof p === 'object' && p !== null && Array.isArray((p as { segments?: unknown }).segments)
          ? ((p as { segments: unknown[] }).segments)
          : [];
      const segments = rawSegments
        .map((s) => {
          const seg = s as { source?: unknown; target?: unknown };
          if (typeof seg.source !== 'string' || !seg.source.trim()) return null;
          return {
            source: seg.source,
            target: typeof seg.target === 'string' ? seg.target : '',
          };
        })
        .filter((s): s is { source: string; target: string } => s !== null);
      return { segments };
    })
    .filter((p) => p.segments.length > 0);
  if (paragraphs.length === 0) {
    throw new Error('Restructure response contained no usable segments');
  }
  return { mode, paragraphs };
}

/* ================================= TRANSLATE ================================ */

export const TRANSLATE_SYSTEM_PROMPT = `You are the machine-translation engine inside Cídiǎn's translation Workspace, drafting Chinese→English translations that a professional translator will post-edit.

## Translation rules
- Translate EVERY segment you are given, one translation per segment id. Never merge, split, reorder, or omit segments — alignment is sacred in a CAT tool.
- Produce natural, professional English that matches the register of the source and the surrounding document context. Legal stays legal ("shall"), officialese stays measured, colloquial stays colloquial.
- GLOSSARY entries are the user's established renderings for real projects. Use them wherever the term appears; deviate only when the context makes the glossary rendering impossible, and then stay as close as you can.
- Preserve numbers, dates, amounts, and proper nouns exactly. Use pinyin (given name order preserved) for personal names without established English forms.
- Use the surrounding context for cohesion (pronouns, tense, register), but translate only the listed segments.
- A segment that is empty or pure whitespace gets an empty translation.
- These are drafts for post-editing: favor accuracy and terminological consistency over stylistic flourish. Do not add translator's notes, brackets, or alternatives — one clean rendering per segment.
- Respond ONLY with JSON conforming to the provided schema.`;

export const TRANSLATE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cidian_translate_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['translations'],
      properties: {
        translations: {
          type: 'array',
          description: 'Exactly one entry per requested segment id, in the same order.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'target'],
            properties: {
              id: { type: 'string', description: 'The segment id, echoed verbatim.' },
              target: {
                type: 'string',
                description: 'The English draft translation of that segment.',
              },
            },
          },
        },
      },
    },
  },
} as const;

/** Compact one-line glossary serialization for the prompt. */
function serializeGlossaryEntry(entry: DictionaryEntry): string {
  const trad = entry.traditional !== entry.simplified ? ` (${entry.traditional})` : '';
  const gloss = entry.senses[0]?.glosses.join('; ') ?? '';
  return `- ${entry.simplified}${trad} ${toToneMarks(entry.pinyin)}: ${gloss}`;
}

/** Everything the OpenAI adapter needs except model + auth. */
export function buildTranslatePayload(request: TranslateSegmentsRequest): {
  messages: OpenAiChatMessage[];
  response_format: typeof TRANSLATE_RESPONSE_FORMAT;
} {
  const glossary =
    request.glossary.length > 0
      ? `GLOSSARY (user's established renderings — keep consistent):\n${request.glossary
          .map(serializeGlossaryEntry)
          .join('\n')}`
      : 'GLOSSARY: none provided.';
  const before = request.contextBefore
    ? `DOCUMENT CONTEXT BEFORE THE SEGMENTS:\n${request.contextBefore}`
    : 'DOCUMENT CONTEXT BEFORE THE SEGMENTS: (document start)';
  const after = request.contextAfter
    ? `DOCUMENT CONTEXT AFTER THE SEGMENTS:\n${request.contextAfter}`
    : 'DOCUMENT CONTEXT AFTER THE SEGMENTS: (document end)';
  const segments = request.segments
    .map((s) => `[${s.id}] ${s.source}`)
    .join('\n');

  return {
    messages: [
      { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${glossary}\n\n${before}\n\n${after}\n\nSEGMENTS TO TRANSLATE (one translation per id):\n${segments}`,
      },
    ],
    response_format: TRANSLATE_RESPONSE_FORMAT,
  };
}

/**
 * Defensive parse of the translate response. Only translations for requested
 * ids survive (the model cannot invent segments); missing ids are simply
 * absent — the caller decides whether to retry them.
 */
export function parseTranslateResponse(
  rawContent: string,
  requestedIds: string[],
): { id: string; target: string }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Translate response was not valid JSON');
  }
  const allowed = new Set(requestedIds);
  const rawList = Array.isArray((parsed as { translations?: unknown }).translations)
    ? ((parsed as { translations: unknown[] }).translations)
    : [];
  const seen = new Set<string>();
  const translations: { id: string; target: string }[] = [];
  for (const item of rawList) {
    const t = item as { id?: unknown; target?: unknown };
    if (typeof t.id !== 'string' || typeof t.target !== 'string') continue;
    if (!allowed.has(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    translations.push({ id: t.id, target: t.target.trim() });
  }
  if (translations.length === 0) {
    throw new Error('Translate response contained no usable translations');
  }
  return translations;
}

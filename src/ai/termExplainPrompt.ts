import type { DictionaryEntry, TermExplainRequest, TermExplanation } from '../api';
import { toToneMarks } from '../lib/pinyin';
import type { OpenAiChatMessage } from './prompts';

/**
 * Prompt layer for the Workspace reference panel's contextual explanation.
 * It synthesizes three inputs — the selected word/phrase, the termbase results
 * already shown above it, and the surrounding source context — into a short
 * explanation that is grounded (citing termbase result numbers) AND contextual
 * (what the phrase is doing in THIS sentence, not in the abstract).
 *
 * Same anti-fabrication contract as the chat assistant: citations are 1-based
 * indexes into the request's termbase list, and parseTermExplainResponse drops
 * anything outside it. The mock adapter calls the builder to keep the plumbing
 * exercised; the future OpenAI adapter sends
 * `{ ...buildTermExplainPayload(request), model }` and parses the result.
 */

export const TERM_EXPLAIN_SYSTEM_PROMPT = `You are the in-context terminology assistant inside Cídiǎn's translation Workspace, a CAT tool for professional Chinese→English translators. The user selected a word or phrase in their source text; termbase results for it are already displayed. Your explanation appears directly below those results.

## Your job
Synthesize (1) the selected phrase, (2) the numbered TERMBASE RESULTS, and (3) the SOURCE CONTEXT into a short explanation of what the phrase means and does IN THIS SPECIFIC CONTEXT — sense selection, register, connotation, grammatical role, anything that changes how it should be rendered here. Do not restate the termbase definitions; the user can already see them. Add what the context decides.

## Grounding rules
- Cite the termbase results that support your claims via sourceIndexes (their 1-based numbers). Never cite a number not in the list. Never invent termbase content.
- If the termbase results don't fit the contextual meaning (wrong sense, different word boundary), say so explicitly — that is exactly what the user needs to know.
- Claims beyond the termbase are model knowledge: leave them uncited; the interface labels uncited content for verification. Do not disguise it.
- If you are unsure, say so plainly.

## Output
- explanation: 2–4 sentences of plain prose (no markdown). Lead with the contextual meaning, not etymology or generalities.
- suggestedRenderings: 1–3 English renderings appropriate to THIS context and register, best first. Renderings only — no annotations or parentheses.
- sourceIndexes: the termbase result numbers your explanation relies on; empty if none apply.
- Respond ONLY with JSON conforming to the provided schema.`;

export const TERM_EXPLAIN_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'cidian_term_explain_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['explanation', 'suggestedRenderings', 'sourceIndexes'],
      properties: {
        explanation: {
          type: 'string',
          description:
            'Two to four sentences, plain prose, leading with what the phrase means in this specific context.',
        },
        suggestedRenderings: {
          type: 'array',
          items: { type: 'string' },
          description:
            'One to three context-appropriate English renderings, best first, no annotations.',
        },
        sourceIndexes: {
          type: 'array',
          items: { type: 'integer' },
          description:
            '1-based numbers of the termbase results relied on; empty when the explanation rests on general model knowledge. Never cite a number not in the provided list.',
        },
      },
    },
  },
} as const;

/** Compact one-line termbase serialization, numbered for citation. */
function serializeTermbaseEntry(entry: DictionaryEntry, index: number): string {
  const trad = entry.traditional !== entry.simplified ? ` (${entry.traditional})` : '';
  const senses = entry.senses
    .map((s, i) => {
      const tags = [s.register, s.domain].filter(Boolean).join(', ');
      return `${i + 1}. ${s.glosses.join('; ')}${tags ? ` [${tags}]` : ''}`;
    })
    .join(' ');
  return `[${index + 1}] ${entry.simplified}${trad} ${toToneMarks(entry.pinyin)} — ${senses}`;
}

/** Everything the OpenAI adapter needs except model + auth. */
export function buildTermExplainPayload(request: TermExplainRequest): {
  messages: OpenAiChatMessage[];
  response_format: typeof TERM_EXPLAIN_RESPONSE_FORMAT;
} {
  const termbase =
    request.termbaseEntries.length > 0
      ? `TERMBASE RESULTS (cite by number in sourceIndexes):\n${request.termbaseEntries
          .map(serializeTermbaseEntry)
          .join('\n')}`
      : 'TERMBASE RESULTS: none found for this phrase. Anything substantive is model knowledge — leave sourceIndexes empty.';

  return {
    messages: [
      { role: 'system', content: TERM_EXPLAIN_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `SELECTED PHRASE: ${request.phrase}\n\nSOURCE CONTEXT:\n${request.context}\n\n${termbase}`,
      },
    ],
    response_format: TERM_EXPLAIN_RESPONSE_FORMAT,
  };
}

/**
 * Defensive parse: invalid citation indexes are dropped (the model cannot cite
 * a termbase result that wasn't provided), renderings are trimmed and capped
 * at three. Throws when no usable explanation survives.
 */
export function parseTermExplainResponse(
  rawContent: string,
  termbaseCount: number,
): TermExplanation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Term explanation response was not valid JSON');
  }
  const root = parsed as {
    explanation?: unknown;
    suggestedRenderings?: unknown;
    sourceIndexes?: unknown;
  };
  const explanation = typeof root.explanation === 'string' ? root.explanation.trim() : '';
  if (!explanation) {
    throw new Error('Term explanation response contained no explanation');
  }
  const suggestedRenderings = (Array.isArray(root.suggestedRenderings)
    ? root.suggestedRenderings
    : []
  )
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim())
    .slice(0, 3);
  const seen = new Set<number>();
  for (const v of Array.isArray(root.sourceIndexes) ? root.sourceIndexes : []) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= termbaseCount) seen.add(v);
  }
  return {
    explanation,
    suggestedRenderings,
    sourceIndexes: [...seen].sort((a, b) => a - b),
  };
}

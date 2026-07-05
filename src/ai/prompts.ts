import type {
  AiChatRequest,
  AiGrounding,
  AiMessage,
  AiPreferences,
  DictionaryEntry,
} from '../api';
import { toToneMarks, toToneNumbers } from '../lib/pinyin';
import { AI_RESPONSE_FORMAT } from './schema';

/**
 * Prompt layer for the AI assistant tab.
 *
 * The future OpenAI adapter calls `buildAiApiPayload(request)` and sends the
 * result (plus model + auth, which arrive via the SSO certificate) to the
 * chat-completions endpoint. Nothing in this file performs a network call.
 * The mock adapter also calls the builder so the variable plumbing stays
 * exercised and typechecked end to end.
 */

/** Keep long conversations bounded; older turns are dropped, newest kept. */
export const AI_HISTORY_LIMIT = 12;

export const AI_SYSTEM_PROMPT = `You are the assistant inside Cídiǎn, a Chinese–English dictionary used by professional Chinese→English translators. Users are native English speakers who read Chinese professionally. You explain terms, usage distinctions, register, connotation, and grammar points.

## Audience
- Professional translators. Be precise and concise; do not explain basics unless asked.
- Register, domain, and connotation distinctions are the core of most questions — lead with them.
- When two terms are contrasted, state the operative difference first, then illustrate.

## Grounding rules
- A numbered list of GROUNDING SOURCES (dictionary entries and the user's personal glossary terms) may be provided below.
- When a claim is supported by a source, cite it by putting the source number in that block's sourceIndexes.
- Never cite a number that is not in the list. Never invent dictionary content, senses, or glossary terms.
- For claims that go beyond the sources, leave sourceIndexes empty. The interface labels uncited content as model knowledge that the user must verify — do not disguise it.
- The user's glossary reflects their established term choices for real projects. Stay consistent with it; if your advice conflicts with a glossary term, say so explicitly.
- If you are not confident about something, say so plainly.

## Output format
You respond ONLY with JSON conforming to the provided schema: an array of blocks.
- "text" blocks: short plain-prose passages (aim under 120 words each). No markdown syntax — no asterisks, backticks, or headings.
- "example" blocks: EVERY Chinese example sentence goes in its own example block, never inline in text. Give natural, register-appropriate Chinese, display-ready pinyin, a natural English translation, and a brief note on what the example demonstrates when that isn't obvious.
- "term" blocks: when you introduce a Chinese word or phrase as a term of discussion, emit a term block for it (simplified, traditional if it differs, pinyin, a compact gloss). Set entryId ONLY when the term is one of the grounding sources' dictionary entries — use that source's entry id verbatim; otherwise set entryId to null.
- Interleave blocks in reading order: typically term → text → example(s) → text.

## Chinese conventions
- {{SCRIPT_RULE}}
- {{PINYIN_RULE}} Apply this everywhere pinyin appears, including example blocks and term blocks.
- Always provide pinyin alongside any Chinese text.

## Scope
Chinese language, usage, grammar, and translation craft only. For off-topic requests, reply with a single brief text block declining and noting what you can help with.`;

const SCRIPT_RULES: Record<AiPreferences['characterPriority'], string> = {
  simplified:
    'Write Chinese in simplified characters; add the traditional form in parentheses only when the difference is relevant.',
  traditional:
    'Write Chinese in traditional characters; add the simplified form in parentheses only when the difference is relevant.',
  both: 'When simplified and traditional forms differ, give both as a "simplified / traditional" pair.',
};

const PINYIN_RULES: Record<AiPreferences['pinyinStyle'], string> = {
  marks: 'Write pinyin with tone marks (e.g. yínháng).',
  numbers: 'Write pinyin with tone numbers (e.g. yin2hang2).',
};

/** One grounding source, serialized compactly for the prompt. */
function serializeEntry(entry: DictionaryEntry, preferences: AiPreferences): string {
  const pinyin =
    preferences.pinyinStyle === 'marks' ? toToneMarks(entry.pinyin) : toToneNumbers(entry.pinyin);
  const trad = entry.traditional !== entry.simplified ? ` (${entry.traditional})` : '';
  const senses = entry.senses
    .map((s, i) => {
      const tags = [s.register, s.domain].filter(Boolean).join(', ');
      return `${i + 1}. ${s.glosses.join('; ')}${tags ? ` [${tags}]` : ''}`;
    })
    .join(' ');
  const mw = entry.measureWords?.length ? ` MW: ${entry.measureWords.join('、')}.` : '';
  const example = entry.senses.flatMap((s) => s.examples ?? [])[0];
  const ex = example ? ` Example: ${example.zh} — ${example.en}` : '';
  return `${entry.simplified}${trad} ${pinyin} (entry id: ${entry.id}) — ${senses}${mw}${ex}`;
}

function serializeGrounding(grounding: AiGrounding, preferences: AiPreferences): string {
  if (grounding.sources.length === 0) {
    return 'GROUNDING SOURCES: none provided for this turn. Any substantive claim is model knowledge — leave sourceIndexes empty.';
  }
  const lines = grounding.sources.map((source, i) => {
    const origin = source.kind === 'glossary' ? "user's glossary" : 'Cídiǎn dictionary';
    return `[${i + 1}] (${origin}) ${serializeEntry(source.entry, preferences)}`;
  });
  const focus = grounding.focusEntryId
    ? `\nThe user opened this chat from the dictionary entry with id "${grounding.focusEntryId}" — treat it as the default topic when the question is ambiguous.`
    : '';
  return `GROUNDING SOURCES (cite by number in sourceIndexes):\n${lines.join('\n')}${focus}`;
}

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** System prompt with preference rules substituted and grounding appended. */
export function buildSystemMessage(request: AiChatRequest): OpenAiChatMessage {
  const content =
    AI_SYSTEM_PROMPT.replace('{{SCRIPT_RULE}}', SCRIPT_RULES[request.preferences.characterPriority])
      .replace('{{PINYIN_RULE}}', PINYIN_RULES[request.preferences.pinyinStyle]) +
    '\n\n' +
    serializeGrounding(request.grounding, request.preferences);
  return { role: 'system', content };
}

function serializeHistoryTurn(message: AiMessage): OpenAiChatMessage {
  if (message.role === 'user') return { role: 'user', content: message.text };
  // The model produced structured JSON; replay it in the same shape so the
  // conversation it sees matches what it actually said.
  return { role: 'assistant', content: JSON.stringify({ blocks: message.blocks }) };
}

/** Full message array for the chat-completions call. */
export function buildAiMessages(request: AiChatRequest): OpenAiChatMessage[] {
  return [
    buildSystemMessage(request),
    ...request.history.slice(-AI_HISTORY_LIMIT).map(serializeHistoryTurn),
    { role: 'user', content: request.message },
  ];
}

/**
 * Everything the OpenAI adapter needs except model + auth:
 * `{ ...buildAiApiPayload(request), model }` is the request body.
 */
export function buildAiApiPayload(request: AiChatRequest): {
  messages: OpenAiChatMessage[];
  response_format: typeof AI_RESPONSE_FORMAT;
} {
  return {
    messages: buildAiMessages(request),
    response_format: AI_RESPONSE_FORMAT,
  };
}

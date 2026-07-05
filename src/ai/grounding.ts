import { api } from '../api';
import type { AiGrounding, AiGroundingSource, DictionaryEntry } from '../api';

/**
 * Assembles the numbered grounding list for a chat turn: the focus entry (if
 * any), glossary terms mentioned in the message, then dictionary matches for
 * each Chinese run in the message. This runs client-side before every send —
 * the model only ever sees what's assembled here, which is what makes its
 * citations trustworthy (src/ai/validate.ts enforces the other half: it can't
 * cite anything outside this list).
 */

/** Contiguous CJK ideograph runs, e.g. "银行的意思" → ["银行的意思"]. */
const CJK_RUN = /[㐀-鿿豈-﫿]+/g;
const MAX_RUNS = 4;
const MAX_SOURCES = 8;

export async function buildGrounding(
  message: string,
  focusEntry: DictionaryEntry | null,
  glossaryEntries: DictionaryEntry[],
): Promise<AiGrounding> {
  const sources: AiGroundingSource[] = [];
  const seenIds = new Set<string>();
  const isGlossaryEntry = (entry: DictionaryEntry) => glossaryEntries.some((g) => g.id === entry.id);

  const add = (entry: DictionaryEntry, kind: AiGroundingSource['kind']) => {
    if (seenIds.has(entry.id) || sources.length >= MAX_SOURCES) return;
    seenIds.add(entry.id);
    sources.push({ kind, entry });
  };

  // Order: focus entry, then glossary mentions, then dictionary search hits.
  if (focusEntry) {
    add(focusEntry, isGlossaryEntry(focusEntry) ? 'glossary' : 'entry');
  }

  for (const entry of glossaryEntries) {
    if (sources.length >= MAX_SOURCES) break;
    if (message.includes(entry.simplified) || message.includes(entry.traditional)) {
      add(entry, 'glossary');
    }
  }

  const runs = [...new Set(message.match(CJK_RUN) ?? [])].slice(0, MAX_RUNS);
  for (const run of runs) {
    if (sources.length >= MAX_SOURCES) break;
    const result = await api.search(run);
    for (const entry of result.entries.slice(0, 2)) {
      if (sources.length >= MAX_SOURCES) break;
      add(entry, isGlossaryEntry(entry) ? 'glossary' : 'entry');
    }
  }

  return { sources, focusEntryId: focusEntry?.id };
}

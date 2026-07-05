import type { AiAssistantMessage, AiBlock, AiGrounding, AiSource } from '../api';
import { toToneMarks } from '../lib/pinyin';

/**
 * Runtime bridge between raw model output and the typed AiAssistantMessage.
 *
 * Groundedness is enforced HERE, not trusted from the model:
 * - sourceIndexes outside the grounding list are dropped;
 * - term entryIds that don't match a grounding entry become null;
 * - the message's sources array is derived from the surviving citations.
 * Malformed blocks are skipped rather than failing the whole reply; if nothing
 * survives, parsing fails and the adapter should surface an error state.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanSourceIndexes(value: unknown, sourceCount: number): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const v of value) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= sourceCount) seen.add(v);
  }
  return [...seen].sort((a, b) => a - b);
}

function parseBlock(raw: unknown, grounding: AiGrounding): AiBlock | null {
  if (!isRecord(raw)) return null;
  const sourceCount = grounding.sources.length;

  if (raw.kind === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
    return {
      kind: 'text',
      text: raw.text.trim(),
      sourceIndexes: cleanSourceIndexes(raw.sourceIndexes, sourceCount),
    };
  }

  if (
    raw.kind === 'example' &&
    typeof raw.zh === 'string' &&
    raw.zh.trim() &&
    typeof raw.pinyin === 'string' &&
    typeof raw.en === 'string'
  ) {
    return {
      kind: 'example',
      zh: raw.zh.trim(),
      pinyin: raw.pinyin.trim(),
      en: raw.en.trim(),
      note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : null,
      sourceIndexes: cleanSourceIndexes(raw.sourceIndexes, sourceCount),
    };
  }

  if (
    raw.kind === 'term' &&
    typeof raw.simplified === 'string' &&
    raw.simplified.trim() &&
    typeof raw.pinyin === 'string' &&
    typeof raw.gloss === 'string'
  ) {
    // A term may only link to an entry the request actually provided.
    const claimedId = typeof raw.entryId === 'string' ? raw.entryId : null;
    const entryId =
      claimedId && grounding.sources.some((s) => s.entry.id === claimedId) ? claimedId : null;
    return {
      kind: 'term',
      simplified: raw.simplified.trim(),
      traditional:
        typeof raw.traditional === 'string' && raw.traditional.trim()
          ? raw.traditional.trim()
          : null,
      pinyin: raw.pinyin.trim(),
      gloss: raw.gloss.trim(),
      entryId,
    };
  }

  return null;
}

/** Sources cited by at least one surviving block, resolved to display records. */
function resolveSources(blocks: AiBlock[], grounding: AiGrounding): AiSource[] {
  const cited = new Set<number>();
  for (const block of blocks) {
    if (block.kind === 'term') continue;
    for (const index of block.sourceIndexes) cited.add(index);
  }
  return [...cited]
    .sort((a, b) => a - b)
    .map((index) => {
      const source = grounding.sources[index - 1];
      const { entry } = source;
      return {
        kind: source.kind,
        entryId: entry.id,
        label: `${entry.simplified} ${toToneMarks(entry.pinyin)} — ${entry.senses[0]?.glosses[0] ?? ''}`,
        index,
      };
    });
}

/**
 * Parse a raw chat-completions message content string into a validated
 * assistant message. Throws when nothing usable can be recovered.
 */
export function parseAiResponse(rawContent: string, grounding: AiGrounding): AiAssistantMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Assistant response was not valid JSON');
  }
  const rawBlocks = isRecord(parsed) && Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const blocks = rawBlocks
    .map((raw) => parseBlock(raw, grounding))
    .filter((b): b is AiBlock => b !== null);
  if (blocks.length === 0) {
    throw new Error('Assistant response contained no usable blocks');
  }
  return { role: 'assistant', blocks, sources: resolveSources(blocks, grounding) };
}

/** Convenience for adapters composing a message from already-typed blocks (e.g. the mock). */
export function assembleAssistantMessage(
  blocks: AiBlock[],
  grounding: AiGrounding,
): AiAssistantMessage {
  return { role: 'assistant', blocks, sources: resolveSources(blocks, grounding) };
}

import { ENTRIES } from '../api/data';

/**
 * Text-structuring utilities for the Workspace: sentence splitting (used by
 * both the source and target sides when restructuring pasted/fetched text)
 * and Chinese word segmentation (used to make source text clickable
 * word-by-word rather than character-by-character).
 */

const TERMINAL = '。！？；.!?;…';
const CLOSERS = '」』"\'）)\\]}”’»';
const SENTENCE_RE = new RegExp(`[^${TERMINAL}]*[${TERMINAL}]+[${CLOSERS}]*`, 'g');

/**
 * Splits text into sentences on 。！？；… and Western equivalents (.!?;).
 * Terminal punctuation stays attached to the sentence it ends; trailing
 * closing quotes/brackets attach to the preceding sentence rather than
 * starting a new one. A trailing fragment with no terminal punctuation
 * (e.g. a heading) is kept as its own sentence.
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(SENTENCE_RE) ?? [];
  const consumedLength = matches.reduce((sum, m) => sum + m.length, 0);
  const remainder = trimmed.slice(consumedLength);
  const sentences = [...matches, remainder].map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [trimmed];
}

/** True if CJK ideographs outnumber (or tie) Latin letters in the block. */
export function classifyBlock(text: string): 'source' | 'target' {
  const cjkCount = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjkCount >= latinCount ? 'source' : 'target';
}

/* ---- Word segmentation ---- */

const KNOWN_WORDS = new Set<string>();
for (const entry of ENTRIES) {
  if (entry.simplified.length > 1) KNOWN_WORDS.add(entry.simplified);
  if (entry.traditional.length > 1) KNOWN_WORDS.add(entry.traditional);
}
const MAX_WORD_LEN = Math.max(1, ...[...KNOWN_WORDS].map((w) => w.length));

/** Greedy longest-match against known dictionary headwords; single char otherwise. */
function greedySegment(text: string): string[] {
  const words: string[] = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (let len = Math.min(MAX_WORD_LEN, text.length - i); len >= 2; len--) {
      const candidate = text.slice(i, i + len);
      if (KNOWN_WORDS.has(candidate)) {
        words.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      words.push(text[i]);
      i += 1;
    }
  }
  return words;
}

const segmentCache = new Map<string, string[]>();
let sharedSegmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (sharedSegmenter !== undefined) return sharedSegmenter;
  try {
    sharedSegmenter =
      typeof Intl !== 'undefined' && 'Segmenter' in Intl
        ? new Intl.Segmenter('zh', { granularity: 'word' })
        : null;
  } catch {
    sharedSegmenter = null;
  }
  return sharedSegmenter;
}

/**
 * Splits Chinese text into word-ish spans for click targets. Prefers the
 * browser's ICU word segmenter; falls back to a greedy dictionary
 * longest-match, then single characters. Cached per exact string.
 */
export function segmentWords(text: string): string[] {
  const cached = segmentCache.get(text);
  if (cached) return cached;

  const segmenter = getSegmenter();
  let words: string[];
  if (segmenter) {
    try {
      words = [...segmenter.segment(text)].map((s) => s.segment);
    } catch {
      words = greedySegment(text);
    }
  } else {
    words = greedySegment(text);
  }

  segmentCache.set(text, words);
  return words;
}

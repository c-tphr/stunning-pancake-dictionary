import type { DictionaryApi } from './client';
import type {
  CharacterComponent,
  CharacterDetail,
  CharacterInfo,
  DictionaryEntry,
  PronunciationClip,
  SearchMode,
  Session,
} from './types';
import { ENTRIES } from './data';
import { CHARACTERS, COMPONENT_STROKES } from './characterData';
import { hasCJK, looksLatin, normalizePinyin } from '../lib/pinyin';

/**
 * Mock adapter. Simulates network latency, persists glossary and session to
 * localStorage, and implements the smart-search detection the real API will own.
 */

const GLOSSARY_KEY = 'cidian.glossary.v1';
const SESSION_KEY = 'cidian.session.v1';

const MOCK_USER = { name: 'Morgan Wells', email: 'morgan.wells@example.com' };

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 150));
}

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  localStorage.setItem(GLOSSARY_KEY, JSON.stringify(ids));
}

// Pre-computed tone-insensitive pinyin keys, e.g. "yin2 hang2" → "yinhang".
const pinyinIndex = new Map<string, string>(
  ENTRIES.map((e) => [e.id, normalizePinyin(e.pinyin)]),
);

function rankSort(a: DictionaryEntry, b: DictionaryEntry): number {
  return (a.frequencyRank ?? Infinity) - (b.frequencyRank ?? Infinity);
}

function searchHanzi(query: string): DictionaryEntry[] {
  const exact: DictionaryEntry[] = [];
  const partial: DictionaryEntry[] = [];
  for (const e of ENTRIES) {
    if (e.simplified === query || e.traditional === query) exact.push(e);
    else if (e.simplified.includes(query) || e.traditional.includes(query)) partial.push(e);
  }
  return [...exact.sort(rankSort), ...partial.sort(rankSort)];
}

function searchPinyin(query: string): DictionaryEntry[] {
  const q = normalizePinyin(query);
  if (!q) return [];
  const exact: DictionaryEntry[] = [];
  const prefix: DictionaryEntry[] = [];
  const infix: DictionaryEntry[] = [];
  for (const e of ENTRIES) {
    const key = pinyinIndex.get(e.id)!;
    if (key === q) exact.push(e);
    else if (key.startsWith(q)) prefix.push(e);
    // Infix matches only for longer queries — a bare "a" shouldn't hit everything.
    else if (q.length >= 4 && key.includes(q)) infix.push(e);
  }
  return [...exact.sort(rankSort), ...prefix.sort(rankSort), ...infix.sort(rankSort)];
}

function searchEnglish(query: string): DictionaryEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const wordBoundary = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const strong: DictionaryEntry[] = [];
  const weak: DictionaryEntry[] = [];
  for (const e of ENTRIES) {
    const glosses = e.senses.flatMap((s) => s.glosses);
    if (glosses.some((g) => wordBoundary.test(g))) strong.push(e);
    else if (glosses.some((g) => g.toLowerCase().includes(q))) weak.push(e);
  }
  return [...strong.sort(rankSort), ...weak.sort(rankSort)];
}

/**
 * Stands in for backend TTS with the browser's speech synthesis, which speaks
 * Mandarin offline on macOS and Windows. speechSynthesis is a global channel,
 * so starting a clip cancels whatever else is playing — which is also the UX
 * we want (one pronunciation at a time).
 */
function speechClip(text: string): PronunciationClip {
  return {
    play() {
      return new Promise<void>((resolve, reject) => {
        if (!('speechSynthesis' in window)) {
          reject(new Error('Speech synthesis unavailable in this browser'));
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('zh'));
        if (voice) utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          // stop() cancels the channel; that's a normal end, not a failure.
          if (event.error === 'interrupted' || event.error === 'canceled') resolve();
          else reject(new Error(`Speech synthesis failed: ${event.error}`));
        };
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      });
    },
    stop() {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
  };
}

function charRankSort(a: CharacterInfo, b: CharacterInfo): number {
  if (a.strokeCount !== b.strokeCount) return a.strokeCount - b.strokeCount;
  return (a.frequencyRank ?? Infinity) - (b.frequencyRank ?? Infinity);
}

function findCharacter(char: string): CharacterInfo | undefined {
  return CHARACTERS.find((c) => c.char === char || c.traditional === char);
}

/** Word formations containing `char`, split by whether it leads the headword. */
function wordsContaining(
  char: string,
  traditional: string,
): { entry: DictionaryEntry; position: 'leading' | 'other' }[] {
  const hits: { entry: DictionaryEntry; position: 'leading' | 'other' }[] = [];
  for (const entry of ENTRIES) {
    const idx = entry.simplified.indexOf(char);
    const tradIdx = entry.traditional.indexOf(traditional);
    if (idx === -1 && tradIdx === -1) continue;
    const leadIdx = idx !== -1 ? idx : tradIdx;
    hits.push({ entry, position: leadIdx === 0 ? 'leading' : 'other' });
  }
  return hits.sort((a, b) => (a.entry.frequencyRank ?? Infinity) - (b.entry.frequencyRank ?? Infinity));
}

export const mockApi: DictionaryApi = {
  async search(query) {
    await delay();
    const q = query.trim();
    if (!q) return { entries: [], detectedMode: 'english' as SearchMode };

    if (hasCJK(q)) {
      return { entries: searchHanzi(q), detectedMode: 'hanzi' as SearchMode };
    }

    // Latin input is ambiguous between pinyin and English. Try pinyin first
    // (tone-insensitive); if nothing matches, treat it as an English gloss search.
    // English words rarely collide with normalized pinyin keys in practice.
    if (looksLatin(q)) {
      const pinyinHits = searchPinyin(q);
      if (pinyinHits.length > 0) {
        return { entries: pinyinHits, detectedMode: 'pinyin' as SearchMode };
      }
    }
    return { entries: searchEnglish(q), detectedMode: 'english' as SearchMode };
  },

  async getEntry(id) {
    await delay();
    return ENTRIES.find((e) => e.id === id) ?? null;
  },

  async getPronunciation(text) {
    // Real adapter: fetch the TTS asset and wrap it in an <audio> clip.
    await delay();
    return speechClip(text);
  },

  async listCharacterComponents() {
    await delay();
    return Object.entries(COMPONENT_STROKES)
      .map(([component, strokeCount]): CharacterComponent => ({ component, strokeCount }))
      .sort((a, b) => a.strokeCount - b.strokeCount);
  },

  async searchByComponents(components) {
    await delay();
    if (components.length === 0) return [];
    return CHARACTERS.filter((c) => components.every((comp) => c.components.includes(comp))).sort(
      charRankSort,
    );
  },

  async recognizeCharacter(sample) {
    // Heuristic stand-in for a real recognition model: rank the character index by
    // how close its stroke count is to the number of strokes drawn, then by
    // frequency. This is the only honest signal available without a model — do
    // not attempt shape matching here.
    await delay();
    const drawnStrokes = sample.strokes.length;
    if (drawnStrokes === 0) return [];
    return [...CHARACTERS]
      .sort((a, b) => {
        const da = Math.abs(a.strokeCount - drawnStrokes);
        const db = Math.abs(b.strokeCount - drawnStrokes);
        if (da !== db) return da - db;
        return (a.frequencyRank ?? Infinity) - (b.frequencyRank ?? Infinity);
      })
      .slice(0, 10);
  },

  async getCharacter(char) {
    await delay();
    const info = findCharacter(char);
    if (!info) return null;
    const detail: CharacterDetail = {
      ...info,
      words: wordsContaining(info.char, info.traditional),
    };
    return detail;
  },

  async listGlossary() {
    await delay();
    const ids = readIds();
    return ids
      .map((id) => ENTRIES.find((e) => e.id === id))
      .filter((e): e is DictionaryEntry => e !== undefined);
  },

  async addToGlossary(entryId) {
    await delay();
    const ids = readIds();
    if (!ids.includes(entryId)) writeIds([...ids, entryId]);
  },

  async removeFromGlossary(entryId) {
    await delay();
    writeIds(readIds().filter((id) => id !== entryId));
  },

  async getSession() {
    await delay();
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : { user: null };
    } catch {
      return { user: null };
    }
  },

  async signIn() {
    // Longer pause to stand in for the SSO redirect round-trip.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const session: Session = { user: MOCK_USER };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async signOut() {
    await delay();
    localStorage.removeItem(SESSION_KEY);
  },
};

/** API contract shared with the future backend. Keep in sync with the server team. */

export type Register = 'formal' | 'literary' | 'colloquial' | 'archaic';

export interface Example {
  zh: string;
  /** Tone-marked pinyin, pre-rendered for display. */
  pinyin: string;
  en: string;
}

export interface Sense {
  /** English equivalents, translator-ready, in priority order. */
  glosses: string[];
  register?: Register;
  /** Subject domain, e.g. "law", "finance", "medicine". */
  domain?: string;
  examples?: Example[];
}

export interface DictionaryEntry {
  id: string;
  simplified: string;
  traditional: string;
  /** Tone-numbered pinyin, one syllable per token, e.g. "yin2 hang2". Neutral tone = 5. */
  pinyin: string;
  /** Lower = more frequent. Used for result ordering. */
  frequencyRank?: number;
  hskLevel?: number;
  /** Measure words (classifiers), e.g. ["家", "个"]. */
  measureWords?: string[];
  senses: Sense[];
}

/**
 * A playable pronunciation. Adapters own the audio source: the real backend
 * serves TTS audio (the HTTP adapter will wrap the fetched asset in an
 * <audio>-backed clip); the mock uses the browser's built-in speech synthesis.
 */
export interface PronunciationClip {
  /** Starts playback; resolves when it finishes or is stopped. */
  play(): Promise<void>;
  stop(): void;
}

export interface CharacterReading {
  /** Tone-numbered pinyin for this reading, e.g. "hang2". */
  pinyin: string;
  glosses: string[];
}

export interface CharacterInfo {
  /** Simplified form — the canonical key. */
  char: string;
  traditional: string; // equals `char` when identical
  readings: CharacterReading[]; // ≥1; order = frequency of the reading
  radical: string;
  /** Direct visual components, simplified forms, e.g. 银 → ["钅", "艮"]. */
  components: string[];
  strokeCount: number; // simplified form
  hskLevel?: number;
  frequencyRank?: number;
}

export interface CharacterWordFormation {
  entry: DictionaryEntry;
  position: 'leading' | 'other';
}

export interface CharacterDetail extends CharacterInfo {
  words: CharacterWordFormation[];
}

export interface CharacterComponent {
  component: string;
  strokeCount: number;
}

export interface HandwritingSample {
  /** Strokes in draw order; points normalized to 0–1 canvas space. */
  strokes: { x: number; y: number; t: number }[][];
  width: number; // source canvas px, for the backend to denormalize
  height: number;
}

export type SearchMode = 'hanzi' | 'pinyin' | 'english';

export interface SearchResult {
  entries: DictionaryEntry[];
  /** How the query was interpreted — surfaced in the UI so translators can trust the match. */
  detectedMode: SearchMode;
}

export interface User {
  name: string;
  email: string;
}

export interface Session {
  user: User | null;
}

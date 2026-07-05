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

/* ---- AI assistant (chat) ----
 *
 * The assistant answers term/grammar questions with STRUCTURED output: an array
 * of typed blocks rather than free markdown. Groundedness is enforced by design:
 * the request carries a numbered list of grounding sources (dictionary entries,
 * the user's glossary), blocks cite 1-based indexes into that list, and the
 * adapter — never the model — resolves indexes into AiSource records. A model
 * cannot fabricate a citation to a source that wasn't provided.
 */

export interface AiSource {
  kind: 'entry' | 'glossary';
  entryId: string;
  /** Display label, e.g. "银行 yínháng — bank". */
  label: string;
  /** The 1-based grounding-list number this source was cited under — matches sourceIndexes. */
  index: number;
}

export interface AiTextBlock {
  kind: 'text';
  /** Plain prose (no markdown). */
  text: string;
  /** 1-based indexes into the request's grounding sources. Empty = model knowledge. */
  sourceIndexes: number[];
}

export interface AiExampleBlock {
  kind: 'example';
  zh: string;
  /** Display-ready pinyin in the user's preferred style. */
  pinyin: string;
  en: string;
  /** What the example demonstrates, when useful. */
  note: string | null;
  sourceIndexes: number[];
}

export interface AiTermBlock {
  kind: 'term';
  simplified: string;
  traditional: string | null;
  pinyin: string;
  gloss: string;
  /** Set only when the term is one of the grounding sources' entries. */
  entryId: string | null;
}

export type AiBlock = AiTextBlock | AiExampleBlock | AiTermBlock;

export interface AiUserMessage {
  role: 'user';
  text: string;
}

export interface AiAssistantMessage {
  role: 'assistant';
  blocks: AiBlock[];
  /** Resolved by the adapter from cited sourceIndexes — never model-authored. */
  sources: AiSource[];
}

export type AiMessage = AiUserMessage | AiAssistantMessage;

export interface AiGroundingSource {
  kind: 'entry' | 'glossary';
  entry: DictionaryEntry;
}

export interface AiGrounding {
  /** Numbered list; blocks' sourceIndexes are 1-based positions in this array. */
  sources: AiGroundingSource[];
  /** Entry the chat was launched from, if any (also present in sources). */
  focusEntryId?: string;
}

export interface AiPreferences {
  characterPriority: 'simplified' | 'traditional' | 'both';
  pinyinStyle: 'marks' | 'numbers';
}

export interface AiChatRequest {
  history: AiMessage[];
  message: string;
  grounding: AiGrounding;
  preferences: AiPreferences;
}

export interface AiChatResponse {
  message: AiAssistantMessage;
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

import type { DictionaryApi } from './client';
import type {
  AiBlock,
  AiChatRequest,
  CharacterComponent,
  CharacterDetail,
  CharacterInfo,
  DictionaryEntry,
  PronunciationClip,
  RestructuredSegmentDraft,
  SearchMode,
  SegmentStatus,
  Session,
  WorkspaceProject,
  WorkspaceProjectSummary,
} from './types';
import { ENTRIES } from './data';
import { CHARACTERS, COMPONENT_STROKES } from './characterData';
import {
  MIXED_DOC_ID,
  MIXED_DOC_TEXT,
  SOURCE_ONLY_DOC_ID,
  SOURCE_ONLY_DOC_TEXT,
} from './workspaceData';
import { hasCJK, looksLatin, normalizePinyin, toToneMarks, toToneNumbers } from '../lib/pinyin';
import { classifyBlock, splitSentences } from '../lib/segmentation';
import { buildAiApiPayload } from '../ai/prompts';
import { assembleAssistantMessage } from '../ai/validate';
import { buildRestructurePayload, buildTranslatePayload } from '../ai/translatePrompt';
import { buildTermExplainPayload } from '../ai/termExplainPrompt';

/**
 * Mock adapter. Simulates network latency, persists glossary and session to
 * localStorage, and implements the smart-search detection the real API will own.
 */

const GLOSSARY_KEY = 'cidian.glossary.v1';
const SESSION_KEY = 'cidian.session.v1';
const WORKSPACE_KEY = 'cidian.workspace.projects.v1';

const MOCK_USER = { name: 'Morgan Wells', email: 'morgan.wells@example.com' };

function readSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : { user: null };
  } catch {
    return { user: null };
  }
}

/** Workspace calls that touch the LLM require a session, like the real backend will. */
function requireSession(): void {
  if (!readSession().user) {
    throw new Error('Not authenticated');
  }
}

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

/**
 * Deterministic canned reply for the mock `chat()`. Real adapter: send
 * buildAiApiPayload(request) to the chat-completions endpoint and run the
 * response through parseAiResponse(). Here we hand-assemble the same typed
 * blocks so the UI is exercised end to end without a model.
 */
function pinyinFor(numbered: string, style: AiChatRequest['preferences']['pinyinStyle']): string {
  return style === 'marks' ? toToneMarks(numbered) : toToneNumbers(numbered);
}

function buildCannedBlocks(request: AiChatRequest): AiBlock[] {
  const primary = request.grounding.sources[0];

  if (!primary) {
    return [
      {
        kind: 'text',
        text: "I don't have a dictionary entry to ground this one — here's a general answer, but double-check it against a grammar reference before you rely on it.",
        sourceIndexes: [],
      },
      {
        kind: 'example',
        zh: '这句话应该怎么翻译比较合适？',
        pinyin: pinyinFor(
          'zhe4 ju4 hua4 ying1 gai1 zen3 me5 fan1 yi4 bi3 jiao4 he2 shi4',
          request.preferences.pinyinStyle,
        ),
        en: 'How would this sentence best be translated?',
        note: 'A generic illustrative example — not drawn from the dictionary.',
        sourceIndexes: [],
      },
    ];
  }

  const entry = primary.entry;
  const sense = entry.senses[0];
  const example = entry.senses.flatMap((s) => s.examples ?? [])[0];

  const blocks: AiBlock[] = [
    {
      kind: 'term',
      simplified: entry.simplified,
      traditional: entry.traditional !== entry.simplified ? entry.traditional : null,
      pinyin: pinyinFor(entry.pinyin, request.preferences.pinyinStyle),
      gloss: sense?.glosses[0] ?? '',
      entryId: entry.id,
    },
    {
      kind: 'text',
      text: `${entry.simplified} most directly means "${sense?.glosses.join('; ') ?? ''}"${
        sense?.register ? `, with a ${sense.register} register` : ''
      }${sense?.domain ? ` in ${sense.domain} contexts` : ''}. That's the sense to lead with unless the surrounding text points elsewhere.`,
      sourceIndexes: [1],
    },
  ];

  if (example) {
    blocks.push({
      kind: 'example',
      zh: example.zh,
      pinyin: example.pinyin,
      en: example.en,
      note: null,
      sourceIndexes: [1],
    });
  } else {
    blocks.push({
      kind: 'example',
      zh: `我们需要再确认一下${entry.simplified}的用法。`,
      pinyin: pinyinFor(
        `wo3 men5 xu1 yao4 zai4 que4 ren4 yi2 xia4 ${entry.pinyin} de5 yong4 fa3`,
        request.preferences.pinyinStyle,
      ),
      en: `We need to double-check the usage of ${entry.simplified} once more.`,
      note: 'Illustrative — not one of the dictionary entry\'s stored examples.',
      sourceIndexes: [],
    });
  }

  blocks.push({
    kind: 'text',
    text: 'Beyond the dictionary sense, weigh how formal the surrounding document is and whether a near-synonym might carry the connotation you actually want — that judgment call is on you, not the dictionary.',
    sourceIndexes: [],
  });

  return blocks;
}

/** Best-effort per-character romanization for phrases with no termbase entry. */
function romanizePhrase(phrase: string): string {
  return [...phrase]
    .map((ch) => {
      const info = CHARACTERS.find((c) => c.char === ch || c.traditional === ch);
      return info ? toToneMarks(info.readings[0].pinyin) : ch;
    })
    .join('');
}

function normalizeSegmentStatus(status: SegmentStatus): SegmentStatus {
  // 'translating' is a transient in-flight state — never persisted.
  return status === 'translating' ? 'untranslated' : status;
}

function normalizeProject(project: WorkspaceProject): WorkspaceProject {
  return {
    ...project,
    paragraphs: project.paragraphs.map((paragraph) => ({
      ...paragraph,
      segments: paragraph.segments.map((segment) => ({
        ...segment,
        status: normalizeSegmentStatus(segment.status),
      })),
    })),
  };
}

function summarizeProject(project: WorkspaceProject): WorkspaceProjectSummary {
  const counts: Record<SegmentStatus, number> = {
    untranslated: 0,
    translating: 0,
    draft: 0,
    good: 0,
    'needs-revision': 0,
  };
  for (const paragraph of project.paragraphs) {
    for (const segment of paragraph.segments) {
      counts[normalizeSegmentStatus(segment.status)]++;
    }
  }
  return { id: project.id, name: project.name, updatedAt: project.updatedAt, counts };
}

function readWorkspaceProjects(): Record<string, WorkspaceProject> {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WorkspaceProject>) : {};
  } catch {
    return {};
  }
}

function writeWorkspaceProjects(projects: Record<string, WorkspaceProject>): void {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(projects));
}

/**
 * Rule-based restructuring (no LLM in the mock): split on every newline,
 * classify each block as source (majority CJK) or target (majority Latin),
 * and pair alternating source→target blocks when a translation is present.
 * See src/ai/translatePrompt.ts for the real LLM-based restructure prompt
 * this stands in for.
 */
function restructureBlocks(text: string): { mode: 'source-only' | 'mixed'; paragraphs: { segments: RestructuredSegmentDraft[] }[] } {
  const blocks = text
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => ({ text: b, kind: classifyBlock(b) }));

  const hasTargetBlock = blocks.some((b) => b.kind === 'target');
  const alternates = blocks.some(
    (b, i) => b.kind === 'source' && blocks[i + 1]?.kind === 'target',
  );
  const mode: 'source-only' | 'mixed' = hasTargetBlock && alternates ? 'mixed' : 'source-only';

  if (mode === 'source-only') {
    return {
      mode,
      paragraphs: blocks.map((b) => ({
        segments: splitSentences(b.text).map((source) => ({ source, target: '' })),
      })),
    };
  }

  const paragraphs: { segments: RestructuredSegmentDraft[] }[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const next = blocks[i + 1];
    if (block.kind === 'source' && next?.kind === 'target') {
      const sourceSentences = splitSentences(block.text);
      const targetSentences = splitSentences(next.text);
      const segments: RestructuredSegmentDraft[] = sourceSentences.map((source, idx) => ({
        source,
        target: idx < targetSentences.length ? targetSentences[idx] : '',
      }));
      if (targetSentences.length > sourceSentences.length && segments.length > 0) {
        const extra = targetSentences.slice(sourceSentences.length).join(' ');
        const last = segments[segments.length - 1];
        last.target = last.target ? `${last.target} ${extra}` : extra;
      }
      paragraphs.push({ segments });
      i += 2;
    } else if (block.kind === 'source') {
      // Unpaired CJK block — its own source-only paragraph.
      paragraphs.push({
        segments: splitSentences(block.text).map((source) => ({ source, target: '' })),
      });
      i += 1;
    } else {
      // Stray target-only block (no preceding source pair) — keep the text
      // rather than silently dropping it.
      paragraphs.push({
        segments: splitSentences(block.text).map((target) => ({ source: '', target })),
      });
      i += 1;
    }
  }
  return { mode, paragraphs };
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

  async chat(request) {
    // A beat slower than the data methods — it should read as "thinking".
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 300));

    // Exercises the real prompt-building path end to end (messages + schema)
    // even though the mock never sends it anywhere.
    buildAiApiPayload(request);

    const blocks = buildCannedBlocks(request);
    return { message: assembleAssistantMessage(blocks, request.grounding) };
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
    return readSession();
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

  async getRemoteDocument(uuid) {
    await delay();
    if (uuid === SOURCE_ONLY_DOC_ID) {
      return { uuid, name: '供货合同（节选）', text: SOURCE_ONLY_DOC_TEXT };
    }
    if (uuid === MIXED_DOC_ID) {
      return { uuid, name: '供货合同（双语）', text: MIXED_DOC_TEXT };
    }
    return null;
  },

  async restructureDocument(text) {
    await delay();
    // Exercises the real LLM-restructure prompt plumbing end to end even
    // though this rule-based mock never sends it anywhere.
    buildRestructurePayload(text);
    return restructureBlocks(text);
  },

  async translateSegments(request) {
    requireSession();
    buildTranslatePayload(request);

    const delayMs = Math.min(600 + 150 * request.segments.length, 3000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const exampleByZh = new Map(
      ENTRIES.flatMap((e) => e.senses.flatMap((s) => s.examples ?? [])).map((ex) => [ex.zh, ex]),
    );

    const translations = request.segments.map(({ id, source }) => {
      if (!source.trim()) return { id, target: '' };
      const example = exampleByZh.get(source);
      const target = example ? example.en : `(draft) English rendering of "${source}"`;
      return { id, target };
    });

    return { translations };
  },

  async explainTerm(request) {
    requireSession();
    buildTermExplainPayload(request);
    await delay();

    const first = request.termbaseEntries[0];
    if (!first) {
      return {
        explanation: `No termbase coverage for "${request.phrase}" — this may be a name, a rare term, or a compound the segmenter split incorrectly. Read it in context and consider searching for a shorter substring.`,
        suggestedRenderings: [romanizePhrase(request.phrase)],
        sourceIndexes: [],
      };
    }

    const sense = first.senses[0];
    const tag = [sense?.register, sense?.domain].filter(Boolean).join('/') || 'general';
    return {
      explanation: `In this passage, ${request.phrase} is functioning in its ${tag} sense — ${
        sense?.glosses[0] ?? ''
      }. Read the surrounding clause before committing to a rendering.`,
      suggestedRenderings: (sense?.glosses ?? []).slice(0, 2),
      sourceIndexes: [1],
    };
  },

  async listWorkspaceProjects() {
    await delay();
    return Object.values(readWorkspaceProjects())
      .map(summarizeProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getWorkspaceProject(id) {
    await delay();
    const project = readWorkspaceProjects()[id];
    return project ? normalizeProject(project) : null;
  },

  async saveWorkspaceProject(project) {
    await delay();
    const projects = readWorkspaceProjects();
    projects[project.id] = normalizeProject(project);
    writeWorkspaceProjects(projects);
  },

  async deleteWorkspaceProject(id) {
    await delay();
    const projects = readWorkspaceProjects();
    delete projects[id];
    writeWorkspaceProjects(projects);
  },
};

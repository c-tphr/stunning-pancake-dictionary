# PRD: Workspace (CAT-style Editor)

**Status:** Approved for implementation
**Target implementer:** Claude Sonnet, working in this repository
**Prerequisite reading:** [DESIGN.md](../DESIGN.md), [README.md](../README.md), `src/api/client.ts` (adapter pattern), the AI tab's groundedness machinery (`src/ai/validate.ts`, `src/components/AiMessage.tsx`), and — critically — the **already-authored workspace types and prompt layer** (§8). Do not rewrite those files; build against them.

---

## 1. Context

Cídiǎn's users translate documents for a living. Everything built so far serves lookup;
the Workspace is where the actual work happens: a CAT-style (computer-assisted
translation) editor with machine-translation drafting and a fast MTPE (machine
translation post-editing) review loop, with the dictionary, the user's glossary, and the
AI assistant one glance away in a side panel.

Architectural constants carried over from every prior feature:

1. **Adapter pattern** — every remote-ish capability (document fetch, restructuring, MT,
   term explanation, project persistence) is a `DictionaryApi` promise. The mock
   implements deterministic stand-ins; the real backend swaps in via `src/api/index.ts`.
2. **LLM calls are grounded and honest** — MT drafts and explanations are clearly
   machine output; the term explanation cites termbase results by index and cannot
   fabricate citations (enforced in the already-written parsers).
3. **Design system** — editorial cards, ink pills, quiet states, tokens only.

## 2. Goals

- A three-pane workspace: optional source-document panel (left), Tiptap-based editor
  (center), reference panel (right: termbase lookup + contextual AI explanation,
  glossary, assistant).
- Source/target text as **structured data** (paragraphs → aligned sentence segments) so
  three editor views — target-only, sentence-by-sentence, paragraph-by-paragraph — are
  lossless projections the user can switch between freely.
- A project lifecycle: resume existing Workspace projects, or start new from a backend
  UUID or pasted text (with automatic source-only vs. mixed detection and restructuring).
- Fast-start MT: offer to translate the first few segments immediately (or all, for
  short texts) so post-editing begins in seconds; on-demand MT for any segment(s) after.
- A keyboard-first MTPE loop: navigate pairs, mark Good / Needs revision, drop into and
  out of editing without touching the mouse.
- One-click term help: click a source word (word-level, not character-level — real
  segmentation) to load termbase results and a grounded, context-aware LLM explanation
  in the reference panel.

## 3. Non-goals

- Rich text formatting in targets (bold/lists/etc.) — targets are plain-text sentences
  for v1; Tiptap is the editing surface, not a formatting tool yet.
- Cross-paragraph segment merging; drag-reorder of segments; undo history beyond
  Tiptap's per-edit-session undo.
- TM (translation memory) matching, QA checks, export to TMX/XLIFF — future work.
- Real MT/restructure/explanation quality in the mock (deterministic stand-ins, §9).
- Same-line bilingual input ("中文。English." on one line) in the mock's mixed
  detection — LLM restructuring will handle it later; the mock's paste hint says
  paragraph- or sentence-alternating bilingual text works best.
- Mobile/touch. Desktop-only, 800px floor, like everything else.

## 4. User stories

1. I paste a 3-paragraph Chinese contract excerpt. The app detects source-only text,
   splits it into 6 segments, offers to machine-translate the first 5 now. I accept,
   and by the time I've read the brief, drafts are in place and I'm post-editing.
2. I paste a bilingual review file (Chinese paragraphs each followed by their English).
   The app detects mixed text, aligns pairs, and I go straight to reviewing — `g`,
   `g`, `r`, `e` to fix one, `Enter` to confirm — without the MT step.
3. My agency PM gives me a document UUID. I enter it, the text loads from the backend,
   and the same flow continues.
4. Mid-review I click 违约 in the source; the right panel shows the termbase entry and,
   below it, a two-sentence explanation of what it means in this clause with a
   suggested rendering. I keep typing without losing my place.
5. The sentence splitter broke 即"双方" off wrongly — I merge two source segments with
   one keypress and carry on.
6. I close the tab; tomorrow the Workspace greets me with the project card showing
   14/20 Good and I resume where I left off.

## 5. Information architecture

- New top-nav link **Workspace** between AI and Glossary; route `/workspace` → `WorkspacePage`.
- `WorkspacePage` has two states: **launcher** (no active project) and **editor**
  (active project). Active project id in the URL: `/workspace?project=<id>` so reload
  resumes it; bare `/workspace` shows the launcher.
- ⚠️ **Nav width guard**: this is the 6th nav item. The 800px wordmark-wrap regression
  from the AI tab must not recur. After wiring the link, verify all pages at 800px; if
  the nav overflows, hide the compact `SearchBox` below 900px viewport width (it remains
  available on Home and at ≥900px) and re-verify. This fallback is pre-approved.

## 6. Feature specification

### 6.1 Data model (already in `src/api/types.ts` — consume as-is)

`WorkspaceProject` → ordered `WorkspaceParagraph[]` → ordered `WorkspaceSegment[]`
(`{ id, source, target, status }`). Statuses: `untranslated`, `translating` (transient —
**never persisted**; normalize to `untranslated` on save/load), `draft`, `good`,
`needs-revision`. Views are projections of this one structure; switching views never
transforms data.

### 6.2 Launcher

**Resume list** (when `listWorkspaceProjects()` returns any): editorial cards (like
feature-cards) per project — name, "Updated ‹relative time›", and a progress caption
("14 good · 3 needs revision · 3 untranslated" — counts from the summary). Click →
opens editor. A quiet delete affordance per card (text button "Delete" with a
confirm-on-second-click pattern; no modal). Below the list: an ink-pill **New project**.

**New project** (also the whole screen when no projects exist): a card with two paths,
presented together (no wizard):

- **From a document ID**: `text-input` for the UUID + outline "Fetch" button →
  `api.getRemoteDocument(uuid)`. Null result → inline `body-sm` error in
  `--color-error`: "No document found for this ID." In mock mode show a `caption` hint
  listing the two demo IDs (§9.1).
- **Paste text**: a large textarea (search-input styling, ~10 rows) + ink-pill
  "Continue".

Either path yields raw text → `api.restructureDocument(text)` → **confirm step** on the
same screen:

- Detection summary as a `badge-pill` + caption: "SOURCE ONLY — 6 segments in 3
  paragraphs" or "MIXED SOURCE AND TARGET — 6 aligned pairs in 3 paragraphs". (Trust
  pattern: same reasoning as search's "Matched as pinyin" badge.)
- Editable project-name input, prefilled: remote doc name, or first ~12 chars of the
  first segment + "…".
- **MT offer** — only when ≥1 segment is untranslated:
  - Total segments ≤ 8: "Translate all now" (primary) / "Skip — translate as I go" (text).
  - Otherwise: "Translate first 5 now" (primary) / "Translate all" (outline) / "Skip" (text).
  - Caption under the buttons: "Starting small gets you post-editing sooner. You can
    send more segments anytime."
  - If signed out, the translate buttons are disabled with the standard compact
    SSO-gate caption (reuse the AI-tab copy, one line); Skip still works.
- Confirm → create project (`crypto.randomUUID()` for ids), `saveWorkspaceProject`,
  navigate to `/workspace?project=<id>`, fire the chosen MT batch (§6.6).

### 6.3 Editor layout

Full-width (not `container`-boxed): a workspace should use the screen.

```
┌────────────────────────────────────────────────────────────┐
│ Toolbar: [◀ Projects] name · view switcher · Translate ▾ · │
│          progress caption · [⌸ source] [⌸ reference] · Saved│
├──────────┬──────────────────────────────────┬──────────────┤
│ Source   │  Editor column (max 760px,       │ Reference    │
│ document │  centered in remaining space)    │ panel        │
│ (left,   │                                  │ (right,      │
│ 280px,   │                                  │ 320px, open  │
│ closed   │                                  │ by default)  │
│ default) │                                  │              │
└──────────┴──────────────────────────────────┴──────────────┘
```

- Toolbar: canvas background, hairline bottom border, sticky under the top nav.
  Contents: back-to-launcher text button; project name (click-to-rename inline input);
  the existing `SegmentedControl` with **Target / Sentences / Paragraphs**; a
  "Translate" primary pill (acts on selection, §6.6); progress caption ("12 / 20 good");
  panel toggles; autosave indicator ("Saved" / "Saving…" caption).
- Panels: hairline-bordered columns on canvas-soft. Left panel closed by default,
  right open. Toggles in toolbar + shortcuts `[` / `]`. Below 1024px both panels
  default closed; opening one at ≤1024px overlays the editor (absolute, shadow-soft)
  rather than squeezing it.
- **Left panel (source document)**: the full source as flowing paragraphs
  (`hanzi-sans`, `body-md`), read-only. The active segment's sentence is highlighted
  (`--color-surface-strong` plate). Clicking any sentence jumps the editor to that
  segment.

### 6.4 Editor views (center column)

All three views render from the same segment list and share the **active segment**
(one segment is always active; kept when switching views; scrolled into view).

1. **Paragraphs** (default): per paragraph, a source block (all source segments as
   continuous text, word-segmented per §6.8, each segment's span subtly delimited on
   hover) followed by the paragraph's target block (target segments as continuous
   text). Reads like a bilingual document.
2. **Sentences**: the classic CAT grid — one row per segment: status gutter | source
   cell | target cell. Best for MTPE; the shortcut flow (§6.7) is optimized here but
   works in all views.
3. **Target**: target paragraphs only, reading like the final English document.
   Segments still click-activate and edit; status gutter hidden, status shown only on
   the active segment.

**Status visuals** (uses the existing semantic tokens — these are validation states,
which is what `--color-success`/`--color-error` exist for; never as fills):

| Status | Left border (3px) | Gutter glyph |
|---|---|---|
| untranslated | dashed `--color-hairline-strong` | – |
| translating | `--color-hairline-strong` | animated ▍▌▍ (reuse the audio-wave keyframes at caption size) |
| draft | `--color-hairline-strong` | MT (caption, muted) |
| good | `--color-success` | ✓ |
| needs-revision | `--color-error` | ! |

Active segment: `--color-surface-strong` background plate + 2px ink outline on the
target cell. Selected range (for batch ops): surface-strong plate without the outline.

### 6.5 Target editing (Tiptap)

**Architecture decision (binding): one Tiptap instance, mounted on demand for the
segment being edited — never a monolithic document, never hundreds of live editors.**
Segments render as plain React text nodes; entering edit mode swaps the active target
cell for a `SegmentEditor` component that mounts a Tiptap editor seeded with the
segment's target text; exiting unmounts it and writes back `editor.getText()`. This
keeps the three views trivial re-projections and makes merge/split pure data
operations, while the editing surface itself is genuinely Tiptap (extensible later to
marks/comments).

- Dependencies: `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`.
  Configure StarterKit minimally: disable headings, lists, blockquote, code, bold,
  italic, strike, horizontalRule — keep document/paragraph/text/history/hardBreak.
  Bundled and offline like every other dependency.
- Editor chrome: the target cell keeps its plate; the Tiptap content area inherits
  `body-md`; caret ink. No floating toolbar.
- Key bindings inside the editor (via Tiptap `editorProps.handleKeyDown` or a small
  extension):
  - `Enter` → save, mark **Good**, exit, advance to next segment (CAT confirm
    convention).
  - `Shift+Enter` → hard line break (rare, but allowed).
  - `Escape` → save and exit without advancing. Mark **Good** only if the text
    changed during this edit session; otherwise keep the prior status.
  - `Mod+Enter` → same as `Enter` (muscle-memory alias).
- Editing an `untranslated` segment (typing a translation from scratch) follows the
  same rules — changed text ⇒ Good on exit.

### 6.6 Machine translation flow

- **Selection model**: the active segment, extendable to a contiguous range with
  `Shift+↓/↑` (or `Shift+J/K`). The toolbar "Translate" pill and the `t` shortcut send
  every `untranslated` (or `needs-revision`? **no — only untranslated**; re-translating
  reviewed work must be explicit) segment in the selection. A small dropdown caret on
  the pill offers "Translate all untranslated".
- On send: statuses → `translating` (loading glyph per §6.4), call
  `api.translateSegments({ segments, contextBefore, contextAfter, glossary })` where
  context = up to 2 segments of source+target on each side of the batch, glossary =
  `useGlossary().entries`.
- On response: fill targets, status → `draft`. Missing ids in the response revert to
  `untranslated` (the parser already permits partial results).
- On rejection: all `translating` segments revert to `untranslated`; standard toast
  ("Translation failed — the segments were left untouched.").
- Signed out: translate affordances disabled with the one-line SSO caption (§6.2).

### 6.7 MTPE review loop & keyboard shortcuts

A persistent keyboard layer (one `keydown` listener on the workspace root) active
whenever focus is NOT inside the Tiptap editor or any input/textarea. Shortcuts never
fire during text entry.

| Key | Action |
|---|---|
| `↓` / `j` | Activate next segment |
| `↑` / `k` | Activate previous segment |
| `Shift+↓/↑` (or `Shift+J/K`) | Extend selection range |
| `g` | Mark active (or selected range) **Good**, advance to next |
| `r` | Mark active (or selected range) **Needs revision**, advance |
| `Enter` or `e` | Edit the active segment's target (mount Tiptap) |
| `t` | Translate active/selected untranslated segments |
| `m` | Merge active source segment with the next (same paragraph only) |
| `s` | Split active source segment at the caret (§6.9; disabled without a caret) |
| `d` | Define: send the current source selection (or the last-clicked word) to the reference panel |
| `1` / `2` / `3` | Switch view: Target / Sentences / Paragraphs |
| `[` / `]` | Toggle left / right panel |
| `?` | Toggle the shortcuts overlay |

- `g`/`r` on an `untranslated` segment does nothing (nothing to review) — advance only.
- The shortcuts overlay: a quiet centered card (empty-state styling) listing this
  table; `?` or `Escape` closes. Also a `caption` "Press ? for shortcuts" hint in the
  toolbar's right corner.
- In-editor keys are in §6.5. The full loop the design optimizes for:
  `j` → read → `g` → read → `e` → fix → `Enter` (auto-Good + advance) → `g` → …

### 6.8 Word lookup from source text (reference panel: Lookup)

- **Word segmentation** (`src/lib/segmentation.ts`, new): source text renders as
  clickable word spans. Segment via `Intl.Segmenter('zh', { granularity: 'word' })`
  when available (Chromium/Safari ship ICU Chinese segmentation); fallback: greedy
  longest-match against dictionary headwords (`ENTRIES` simplified/traditional, then
  `CHARACTERS`); final fallback: single character. (If the TS lib lacks
  `Intl.Segmenter` types, add a minimal ambient declaration in the lib file — do not
  loosen tsconfig.) Cache segmentation per segment id + source text.
- **Click a word span** → it becomes the lookup phrase: right panel opens to the
  Lookup tab, fires `api.search(phrase)` (termbase results, §6.10), and — when signed
  in — `api.explainTerm({ phrase, context, termbaseEntries })` where `context` is the
  full source of the containing segment (or the paragraph, if the segment is <10
  chars). Clicked word gets a temporary surface-strong highlight.
- **Selection fallback**: when the user finishes a text selection inside source text
  (mouseup / keyboard selection), a floating chip appears at the selection —
  badge-pill styling, label "Look up" — and `d` triggers the same. This is the escape
  hatch when auto-segmentation picks the wrong boundary.
- Also expose the sentence-splitting utilities in the same lib
  (`splitSentences(text: string): string[]` — boundaries 。！？；… and Western
  equivalents; terminal punctuation stays attached; trailing closing quotes/brackets
  attach to the preceding sentence) — the mock adapter imports these (§9.2).

### 6.9 Source merge / split

Source text is **never editable as text** — no keystrokes mutate it. Structure only:

- **Merge (`m` or a gutter action on hover)**: joins the active segment with the next
  segment in the same paragraph. New source = concatenation (no separator — Chinese).
  New target = both targets joined with a space (trimmed). New status: `draft` if the
  merged target is non-empty, else `untranslated`. Disabled on a paragraph's last
  segment. Review state intentionally resets — a merged pair needs re-review.
- **Split (`s`)**: the user clicks a position inside the active segment's source text
  (a caret marker — thin ink bar — renders at the nearest character boundary via the
  Selection API); `s` splits there. First part keeps the entire existing target and,
  if it had one, status `needs-revision` (the alignment is now suspect — honest CAT
  behavior); second part gets `''` / `untranslated`. If the original was
  untranslated, both are untranslated. Splitting at position 0 or end is a no-op.
- Both operations preserve total source text exactly (acceptance-tested).

### 6.10 Reference panel (right)

Three tabs (reuse `SegmentedControl`, compact — reduce height via a `.segmented-sm`
variant if needed):

1. **Lookup** (default): a compact search input (prefilled by word-clicks; manual
   entry works too) → termbase results as compact expandable rows: headword · pinyin ·
   first gloss; expanding reveals all senses with register/domain badges (reuse
   SenseList-style rendering, tightened) and a small "open entry ↗" link to
   `/entry/:id` (`target="_blank"` — don't navigate away from work).
   **Below the results**: the **In context** section — `caption-uppercase` header —
   showing the `TermExplanation`: the explanation prose, suggested renderings as
   click-to-copy chips (`CopyText`), superscript citation markers on the explanation
   citing termbase result numbers (reuse the AI-tab marker pattern; clicking one
   highlights that result row), and the standard model-knowledge caption when
   `sourceIndexes` is empty. Signed out: this section shows the one-line SSO caption
   instead. Loading: quiet "Reading the context…" state-note. Failure: quiet inline
   "Couldn't generate an explanation." + retry text-button.
2. **Glossary**: the user's starred terms (from `useGlossary`), compact rows; clicking
   a row loads it into Lookup. Same "synced once SSO lands" caption as the glossary page.
3. **Assistant**: a compact chat reusing the existing `AiMessage` + `AiComposer`
   components and the AI-tab send loop, with workspace-local conversation state and
   grounding built from the message plus **the active segment's source as focus
   context**. Signed-out: compact gate. This is a narrow column — messages stack fine;
   no starter chips, placeholder "Ask about this document…".

### 6.11 Persistence & autosave

- Any mutation (target edit, status change, merge/split, rename) debounces 800ms →
  `saveWorkspaceProject(project)` with `updatedAt` bumped; toolbar shows "Saving…" →
  "Saved". Flush pending saves on unmount and `beforeunload`.
- `'translating'` is normalized to `'untranslated'` in what's saved AND on load.
- Mock persistence: localStorage key `cidian.workspace.projects.v1` holding
  `Record<projectId, WorkspaceProject>`; summaries derived on `listWorkspaceProjects()`.

### 6.12 States & edge cases

- Empty paste / whitespace-only → inline error, no restructure call.
- Paste with no CJK at all → restructure still runs; mock returns source-only with the
  text as segments (the user may be doing something unusual; don't block), but the
  confirm step shows a caption warning: "No Chinese text detected."
- `?project=<unknown id>` → launcher with a toast ("Project not found").
- Deleting the currently-open project → back to launcher.
- Merge/split during an in-flight translation of the affected segment: disable `m`/`s`
  on `translating` segments.
- Very long documents: render all segments (no virtualization in v1 — note as future
  work if paste exceeds ~500 segments, cap paste at 20,000 chars with an inline error).
- The workspace page never uses the compact nav SearchBox for its own lookup —
  reference panel owns that.

## 7. Contract & implementation work

### 7.1 `DictionaryApi` additions (src/api/client.ts)

```ts
/** Fetch a raw document from the backend by UUID. Null when unknown. */
getRemoteDocument(uuid: string): Promise<RemoteDocument | null>;
/** Raw text → aligned paragraphs/segments; detects source-only vs mixed. */
restructureDocument(text: string): Promise<RestructuredDocument>;
/** MT drafts for a segment batch. Requires an authenticated session. */
translateSegments(request: TranslateSegmentsRequest): Promise<TranslateSegmentsResponse>;
/** Grounded, context-aware explanation for the reference panel. Requires session. */
explainTerm(request: TermExplainRequest): Promise<TermExplanation>;

listWorkspaceProjects(): Promise<WorkspaceProjectSummary[]>;
getWorkspaceProject(id: string): Promise<WorkspaceProject | null>;
saveWorkspaceProject(project: WorkspaceProject): Promise<void>;
deleteWorkspaceProject(id: string): Promise<void>;
```

## 8. Already-authored prompt layer (consume, don't rewrite)

| File | Provides |
|---|---|
| `src/api/types.ts` | All workspace + request/response types (§6.1, §7) — **already added**. |
| `src/ai/translatePrompt.ts` | `RESTRUCTURE_SYSTEM_PROMPT` + `buildRestructurePayload()` + `parseRestructureResponse()`; `TRANSLATE_SYSTEM_PROMPT` + `buildTranslatePayload()` + `parseTranslateResponse()`; strict OpenAI schemas for both. |
| `src/ai/termExplainPrompt.ts` | `TERM_EXPLAIN_SYSTEM_PROMPT` + `buildTermExplainPayload()` + `parseTermExplainResponse()` (drops fabricated citation indexes) + strict schema. |

The mock adapter must call `buildRestructurePayload` / `buildTranslatePayload` /
`buildTermExplainPayload` on each corresponding call and discard the result — same
plumbing-stays-exercised rule as `chat()`.

## 9. Mock adapter behavior (deterministic)

### 9.1 `getRemoteDocument`

Two built-in demo documents (define the texts in `src/api/workspaceData.ts`, new file —
exact content in Appendix A):

- `00000000-0000-4000-8000-000000000001` → "供货合同（节选）" — source-only, 3 paragraphs.
- `00000000-0000-4000-8000-000000000002` → "供货合同（双语）" — the same text with
  English translations as alternating paragraphs (mixed).

Any other uuid → `null` after the standard delay. The launcher's mock hint lists both ids.

### 9.2 `restructureDocument` (rule-based; no LLM)

1. Split into blocks on blank lines (`\n{2,}`) — single newlines also break paragraphs
   (`\n`) since pasted CAT text rarely uses hard wrapping; treat every newline as a
   paragraph boundary, then drop empty blocks.
2. Classify each block: majority-CJK (source) vs majority-Latin (target) by counting
   CJK codepoints vs A–Za-z.
3. **Mixed** when ≥1 Latin block exists AND blocks alternate CJK→Latin at least once;
   pair each CJK block with the immediately following Latin block. Sentence-split both
   sides (`splitSentences` from §6.8 for Chinese; split English on `.!?` + closing
   quotes, keeping delimiters) and align by index; extra source sentences get `''`
   targets; extra target sentences append (space-joined) onto the last pair's target.
   Unpaired CJK blocks become source-only paragraphs.
4. **Source-only** otherwise: each block = paragraph, sentence-split into segments.
5. Return after the standard `delay()`.

### 9.3 `translateSegments`

- Requires a session: if `getSession()` has no user, reject with an error (the real
  backend will 401 — the UI should never let this fire, but the mock stays honest).
- Delay `600 + 150 × segments.length` ms, capped at 3000.
- Deterministic canned drafts: for each segment,
  `target = '(draft) English rendering of “' + source + '”'` — except when the source
  exactly equals a dictionary entry's example `zh`, in which case return that
  example's real `en` (the demo docs reuse entry examples, so demo translations look
  real while remaining deterministic).

### 9.4 `explainTerm`

- Requires a session (as above). Standard delay.
- Canned but grounded: when `termbaseEntries` is non-empty, return
  `explanation` = "In this passage, ‹phrase› is functioning in its ‹domain/register of
  first sense› sense — ‹first gloss›. Read the surrounding clause before committing to
  a rendering." with `sourceIndexes: [1]` and `suggestedRenderings` = first two glosses
  of the first entry. When empty: a generic "no termbase coverage" explanation,
  `sourceIndexes: []`, one generic rendering suggestion (the phrase romanized is fine).

### 9.5 Workspace CRUD

localStorage-backed per §6.11, standard `delay()` on each call.

## 10. New/modified file map

| File | Change |
|---|---|
| `src/api/client.ts` | add §7.1 methods |
| `src/api/mock.ts` | implement §9 |
| `src/api/workspaceData.ts` | **new** — demo documents (Appendix A) |
| `src/lib/segmentation.ts` | **new** — sentence split, word segmentation, CJK/Latin block classification |
| `src/pages/WorkspacePage.tsx` | **new** — launcher/editor switch |
| `src/components/workspace/WorkspaceLauncher.tsx` | **new** — §6.2 |
| `src/components/workspace/WorkspaceEditor.tsx` | **new** — layout, keyboard layer, selection/active state, MT orchestration, autosave |
| `src/components/workspace/WorkspaceToolbar.tsx` | **new** |
| `src/components/workspace/SegmentList.tsx` | **new** — renders the three views |
| `src/components/workspace/SourceText.tsx` | **new** — word-segmented clickable source, split caret |
| `src/components/workspace/SegmentEditor.tsx` | **new** — the on-demand Tiptap instance |
| `src/components/workspace/ReferencePanel.tsx` | **new** — Lookup / Glossary / Assistant tabs |
| `src/components/workspace/SourceDocPanel.tsx` | **new** — left panel |
| `src/components/workspace/ShortcutsOverlay.tsx` | **new** |
| `src/components/TopNav.tsx`, `src/App.tsx` | nav link + route (+ §5 nav-width guard) |
| `src/theme/components.css`, `src/theme/pages.css` | styles |
| `package.json` | add the four Tiptap packages |
| `README.md` | Workspace paragraph: structured segments, demo UUIDs, mock caveats |

Keeping workspace components in `src/components/workspace/` (first subdirectory —
warranted at this component count).

## 11. Design-system directives (binding)

- Tokens only; no inline hex. Status colors use ONLY the existing semantic tokens, only
  as 3px left borders and small gutter glyphs — never fills, never text blocks.
- Editorial surfaces: panels on canvas-soft with hairlines; segment rows are quiet —
  the plate/outline treatment marks activity, not color.
- Pills for CTAs; `SegmentedControl` for the view switcher and panel tabs; quiet
  loading states everywhere ("Saving…", "Reading the context…", the small translating
  glyph). No spinners, no skeleton screens.
- Both themes via tokens (the translating animation reuses existing keyframes).
- Desktop-only; usable at the 800px floor with both panels closed; no horizontal
  overflow at 800/1024/1280 (checked on workspace AND all existing pages after the nav
  change).

## 12. Accessibility

- Segment list: `role="listbox"`-style semantics are overkill; instead each segment row
  is a focusable element (`tabIndex={-1}`, programmatic focus follows the active
  segment) with an `aria-label` like "Segment 4, needs revision". Status changes
  announce via a single visually-hidden `aria-live="polite"` region ("Segment 4 marked
  good").
- The keyboard layer must not trap focus; Tab order remains natural. All single-letter
  shortcuts are suppressed while any input/textarea/contenteditable has focus.
- Shortcuts overlay is a `role="dialog"` with focus trap and Escape-to-close.
- Word spans are buttons (`aria-label`: "Look up 违约"). The floating "Look up" chip is
  a real button reachable via `d`.
- Panel toggles have `aria-expanded`; the reference tabs use the SegmentedControl's
  existing tablist semantics.

## 13. Acceptance criteria

1. `npm run build` clean (with Tiptap installed); no console errors through the QA
   script; no 800px nav regression on any page.
2. Launcher: with no projects → new-project card; after creating one and reloading →
   resume card with correct progress counts; delete works; `?project=<bad>` → launcher + toast.
3. Demo UUID …0001 → detected SOURCE ONLY, 6 segments / 3 paragraphs; …0002 → MIXED
   with 6 aligned pairs and real English targets (status `draft`); unknown UUID →
   inline error.
4. Pasting the Appendix A source text reproduces criterion 3's source-only result;
   pasting the bilingual text reproduces the mixed result.
5. MT offer: accepting "first 5" marks exactly the first 5 untranslated segments
   `translating` (animated glyph) then `draft` with the canned/example-backed targets;
   `t` on a later segment translates it on demand; rejection path (temporarily forced)
   reverts to `untranslated` + toast.
6. View switching 1/2/3 is lossless and preserves the active segment; default view is
   Paragraphs.
7. MTPE loop: `j/k` navigate; `g`/`r` mark + advance with correct border/glyph
   visuals; `e` opens Tiptap; typing + `Enter` saves, auto-marks Good, advances;
   `Escape` after no changes preserves the prior status.
8. Merge joins two segments (source concatenated exactly; review state reset per
   §6.9); split at a clicked caret produces two segments whose sources concatenate to
   the original, first keeping the target with `needs-revision`.
9. Clicking 违约 in source text loads Lookup with the 违约 termbase entry AND (signed
   in) an In-context explanation citing result [1], with suggested renderings as
   copy chips; the selection-fallback chip works for an arbitrary highlighted span;
   signed out, the explanation section shows the SSO caption while termbase results
   still load.
10. Reference panel Glossary tab lists starred terms and click-throughs to Lookup;
    Assistant tab holds a working compact chat grounded on the active segment.
11. Left panel highlights the active segment's sentence and click-jumps; `[`/`]`
    toggle panels; `?` shows the overlay.
12. Autosave: edits persist across reload (including statuses); `translating` is never
    persisted; the mock calls the three prompt builders on their respective API calls
    (verifiable via a temporary log or breakpoint — then removed).
13. Dark mode correct throughout; 800px floor usable with panels closed.

## 14. Verification script (manual QA)

1. Build; open `/workspace` signed out. Create a project via paste (Appendix A source
   text): confirm detection badge, disabled MT buttons with SSO caption, Skip → editor
   loads, Paragraphs view, all segments untranslated.
2. Sign in (nav). Select segments 1–3 (`Shift+↓`), `t` → watch translating → draft.
   Run the MTPE loop of criterion 7. Toggle views 1/2/3 mid-loop.
3. Click 违约 → verify criterion 9 end to end; highlight a two-word span → chip → `d`.
4. `m` on segments 2+3 of paragraph 1, then split them apart again; verify source
   text integrity (concatenation identical) and statuses.
5. New project from UUID …0002 (mixed) → review a few pairs with `g`/`r`; rename the
   project in the toolbar; reload → resume card shows the new name and counts.
6. Dark mode + 800px pass; check the nav on Home, Entry, AI, and Workspace at 800px.

## 15. Future work (out of scope)

Translation-memory matches and concordance search; QA checks (numbers, punctuation,
untranslated-term detection); XLIFF/TMX/DOCX export; segment comments; virtualized
rendering for very long documents; same-line bilingual restructuring (LLM path);
streaming MT; project sharing once accounts land.

---

## Appendix A — Demo document texts (verbatim, for `src/api/workspaceData.ts`)

**Source-only (uuid …0001, name 供货合同（节选）):**

```
双方已于本周签署了合同。合同自签署之日起生效。任何一方违约，均应承担赔偿责任。
鉴于人民币汇率保持基本稳定，银行同意为该项目提供融资。双方谈判仍在进行中。
各部门要认真学习会议精神，切实落实各项政策，推进可持续发展。
```

(3 paragraphs; sentence-splits to 3 + 2 + 1 = 6 segments. Sentences deliberately reuse
dictionary-entry examples/vocabulary so termbase lookups and the mock's example-backed
translations hit.)

**Mixed (uuid …0002, name 供货合同（双语）):** the same three Chinese paragraphs, each
immediately followed by its English paragraph:

```
双方已于本周签署了合同。合同自签署之日起生效。任何一方违约，均应承担赔偿责任。
The two parties signed the contract this week. The contract takes effect from the date of signature. Any party in breach shall bear liability for compensation.
鉴于人民币汇率保持基本稳定，银行同意为该项目提供融资。双方谈判仍在进行中。
In view of the renminbi exchange rate remaining basically stable, the bank agreed to provide financing for the project. Negotiations between the parties are still ongoing.
各部门要认真学习会议精神，切实落实各项政策，推进可持续发展。
All departments must earnestly study the spirit of the meeting, faithfully implement the policies, and advance sustainable development.
```

(Aligns to the same 6 segments, each with a real English target, status `draft`.)

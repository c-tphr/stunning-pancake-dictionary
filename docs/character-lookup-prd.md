# PRD: Character Look-up Tab

**Status:** Approved for implementation
**Target implementer:** Claude Sonnet, working in this repository
**Prerequisite reading:** [DESIGN.md](../DESIGN.md) (design system), [README.md](../README.md) (constraints), `src/api/client.ts` (adapter pattern)

---

## 1. Context

Cídiǎn is a dictionary frontend for Chinese→English translators (L1 English). Today the app
supports word lookup via one smart search box (hanzi / pinyin / English). Translators regularly
meet **characters they cannot type**: they don't know the reading, so pinyin input fails, and
IME lookup is a dead end. The two standard escape hatches are component-based lookup and
handwriting input. This feature adds both, plus a character-focused detail view, because once a
user finds a character they almost always want its readings, its structure, and the common
words it forms.

Everything data- or recognition-shaped goes through the `DictionaryApi` interface
(`src/api/client.ts`) and is implemented in the mock adapter (`src/api/mock.ts`), exactly like
search/glossary/auth/pronunciation before it. The real backend replaces `src/api/index.ts`
only.

## 2. Goals

- Let users find a character they cannot type, using either component selection or drawing.
- Give each character a focus view: readings, meanings, structure (radical + components),
  and word formations drawn from the existing dictionary.
- Keep 100% design-system compliance and both themes for free via existing tokens.
- Extend the API contract so the future backend slots in without component changes.

## 3. Non-goals

- Real handwriting recognition in the client. The mock returns plausible ranked candidates
  (see §7.3); the model lives behind the API later.
- Stroke-order animation, cursive/running-hand support, full Unihan coverage, rare-character
  IDS decomposition trees. All future work.
- Mobile/touch-first ergonomics (app is desktop-only; the canvas must still accept touch
  events since some desktops have touchscreens, but do not optimize layout for them).
- Changing existing word-search behavior.

## 4. User stories

1. As a translator with a scanned contract, I see 仲 but can't type it. I open Characters,
   pick 亻 from the component grid, narrow by stroke count, spot 仲, and land on its focus
   view showing 仲裁 — the word I actually needed.
2. As a user who can see a character but not decompose it, I draw it with my trackpad and
   pick the right candidate from the strip.
3. As a user examining 行, I want both readings (xíng / háng), its radical, and the words in
   the dictionary that contain it (银行, 履行), each one click away.
4. As a user on an entry page (银行), I want to jump to the focus view of either character.

## 5. Information architecture

- New top-nav link **Characters** between Search and Glossary
  (`src/components/TopNav.tsx` — add to the existing NavLink array).
- New routes in `src/App.tsx`:
  - `/characters` — the look-up tab (both modes).
  - `/characters/:char` — character focus view (`:char` is the literal character,
    URL-encoded; simplified or traditional both resolve, see §7.4).
- Mode and picker state are URL-reflected for shareability/back-button sanity:
  - `/characters?mode=components&c=氵,讠` (selected components, comma-separated)
  - `/characters?mode=draw`
  - Default mode when absent: `components`.

## 6. Feature specification

### 6.1 Mode switcher

A two-segment control at the top of the Characters page: **By component** | **Draw**.

- New reusable component `SegmentedControl` (`src/components/SegmentedControl.tsx`):
  a pill-shaped track (`{rounded.pill}`, background `--color-surface-strong`), with the
  active segment as an ink pill (`--color-primary` bg, `--color-on-primary` text) —
  visually consistent with the existing button system. Height 40px. Keyboard: arrow keys
  move between segments; implement as `role="tablist"` / `role="tab"` with
  `aria-selected`.
- Switching modes preserves nothing between modes (independent state) but must not lose
  the current mode's state during a session (keep component state mounted or lift it).

### 6.2 Mode 1 — Component look-up

**Layout:** picker card on top, results section below (single column, `container` width).

**Picker card** (`ComponentPicker`): white card, `{rounded.xl}`, hairline border, padding 24px.

- A grid of tappable component tiles, **grouped by component stroke count** with
  `caption-uppercase` group headers ("1 stroke", "2 strokes", …). Tiles are 40px squares,
  `{rounded.sm}`, hairline border, hanzi-serif glyph 20px, hover `--color-surface-strong`.
- Clicking a tile toggles selection. Selected tiles invert (ink background, on-primary
  glyph). Selected components also render as removable chips (badge-pill + ×) in a row
  above the grid, with a "Clear all" `btn-text`.
- **Live narrowing:** after each toggle, call `searchByComponents(selected)`. Components
  that cannot co-occur with the current selection (i.e., appear in none of the remaining
  candidate characters' component sets) render dimmed (`--color-muted-soft`, not
  clickable). Compute this client-side from the returned candidates' `components` arrays.
- Selection state syncs to the `c=` query param (replace, not push, per toggle).

**Results** (shared with Draw mode, see §6.4): all characters whose component set is a
superset of the selection, grouped by total stroke count ascending, ranked by frequency
within a group. Empty selection shows a hint state ("Select components to see matching
characters"), not the full inventory.

### 6.3 Mode 2 — Handwriting / draw

**Layout:** canvas card left (fixed ~320px), candidates panel right; stacks to single
column below 1024px (consistent with the entry page's collapse behavior).

**Canvas card** (`HandwritingCanvas`): white card, `{rounded.xl}`, hairline border. Inside:

- A 280×280 `<canvas>` drawing surface with a faint 米字格 guide (dashed hairline cross +
  diagonals, `--color-hairline-soft`) so users center their character. Ink strokes render
  in `--color-ink` at 6px round-cap width. **Read canvas colors from CSS custom properties
  at draw time** (`getComputedStyle`) and redraw strokes on theme change so dark mode
  works; never hardcode hex (DESIGN.md rule).
- Pointer handling: Pointer Events (mouse/pen/touch unified); `touch-action: none` on the
  canvas; capture the pointer during a stroke; points recorded as normalized 0–1
  coordinates with timestamps.
- Controls row under the canvas: **Undo stroke** (`btn-outline`, sm), **Clear**
  (`btn-text`), and a `caption` stroke counter ("4 strokes").
- After each completed stroke, debounce 400ms, then call `recognizeCharacter(sample)`.
  Undo/clear also re-trigger (clear empties the candidates instead of calling with zero
  strokes).

**Candidates panel:** `caption-uppercase` header "Candidates", then a wrap-grid of
character tiles (§6.4 tile spec) showing up to 10 ranked candidates. Clicking a candidate
navigates to its focus view. While recognition is in flight show the previous candidates
(no flicker); show a subtle "Recognizing…" `caption` only if >300ms elapse.

An always-visible `caption` note under the panel: "Candidate quality improves once the
recognition service is connected." — because the mock ranks heuristically (§7.3) and user
trust must be protected.

### 6.4 Character results display (shared)

Character results are **not** word `EntryCard`s. New `CharacterTile` component:

- A square-ish tile: glyph in hanzi-serif at 32px, first reading's pinyin below in
  `caption` muted (respect `pinyinStyle` setting). ~72px wide, `{rounded.lg}`, hairline
  border, white card background, hover: soft shadow + `--color-surface-strong` (match
  `entry-card` hover feel). Whole tile is a link to `/characters/:char`.
- `aria-label`: "字 zì — view character details".
- Grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr))`,
  16px gap.
- Component-mode grouping headers: "6 strokes" etc. in `caption-uppercase` muted.

### 6.5 Character focus view (`/characters/:char`)

Mirrors the entry page's editorial two-zone grid (reuse `.entry-layout` patterns;
left block sticky, stacks below 1024px).

**Left block:**
- Giant glyph in hanzi-serif: 120px (140px when `headwordSize` = large), rendered with
  `CopyText` (click-to-copy, consistent with entry page).
- Traditional/simplified variant line per `characterPriority` setting (reuse the
  `headwordParts` approach from `src/lib/format.ts`, adapted for single characters).
- **Readings list:** one row per reading — pinyin (via `formatPinyin`, respects
  `pinyinStyle`) as `CopyText`, an `AudioButton` (existing component, `text` = the
  character), and the reading's gloss summary in `body-sm` muted. Multi-reading
  characters (行 → xíng, háng) are first-class: never collapse readings.
- Meta row of badges: "RADICAL 亻", "11 STROKES", "HSK 3" (when known) — existing `Badge`.

**Right column — three stacked cards** (white, `{rounded.xl}`, hairline, 32px padding,
`caption-uppercase` section labels):

1. **Meanings** — per-reading glosses as a numbered list (reuse `SenseList` layout
   conventions; glosses are `CopyText` targets).
2. **Structure** — the radical and component breakdown as a row of `CharacterTile`-style
   mini-tiles; clicking a component navigates to
   `/characters?mode=components&c=<component>` (pre-seeded picker). If the character is
   itself a basic component, say so ("基础部件 — this character is a basic component") in
   `body-sm` muted.
3. **Words with 〈char〉** — words from the dictionary containing the character, split
   into two groups with `caption` subheads: "As first character" and "In other positions".
   Rows reuse the glossary-row pattern (`.glossary-row-main`: hanzi 22px · pinyin ·
   first gloss), linking to `/entry/:id`. Sort by `frequencyRank`. Cap 20 per group.
   Empty state: "No words with this character in the dictionary yet."

**Cross-link from entry pages:** in `EntryPage`'s headword block meta area, add a
"Characters:" row — one small link per unique character of the simplified headword
(hanzi-serif 20px, underline on hover) to its focus view. This is the primary discovery
path for the whole feature.

### 6.6 States & edge cases (all modes)

- Loading: existing quiet pattern (`state-note` muted text), never spinners.
- Component combo with zero candidates: empty-state card "No character contains all of
  these components" + "Clear all" action.
- `/characters/:char` where `char` is unknown to the dataset: empty-state card with the
  glyph still rendered big (it's still useful to copy/hear it), "Structure and word data
  not available for this character yet", and an AudioButton — degrade gracefully, don't 404.
- `:char` with a multi-char string or non-CJK input: redirect to `/characters`.
- Traditional input (e.g. `/characters/銀`): resolve to the same record as 银 (§7.4).
- Drawing with zero strokes: candidates panel shows its hint state; never call the API.
- The existing compact nav SearchBox stays functional on these pages (word search and
  character lookup are parallel tools).

## 7. API contract & mock implementation

### 7.1 New types (`src/api/types.ts`)

```ts
export interface CharacterReading {
  /** Tone-numbered pinyin for this reading, e.g. "hang2". */
  pinyin: string;
  glosses: string[];
}

export interface CharacterInfo {
  /** Simplified form — the canonical key. */
  char: string;
  traditional: string;          // equals `char` when identical
  readings: CharacterReading[]; // ≥1; order = frequency of the reading
  radical: string;
  /** Direct visual components, simplified forms, e.g. 银 → ["钅", "艮"]. */
  components: string[];
  strokeCount: number;          // simplified form
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
  width: number;   // source canvas px, for the backend to denormalize
  height: number;
}
```

### 7.2 New `DictionaryApi` methods (`src/api/client.ts`)

```ts
/** Component inventory for the picker, ready to group by strokeCount. */
listCharacterComponents(): Promise<CharacterComponent[]>;

/** Characters whose component sets contain ALL of the given components. */
searchByComponents(components: string[]): Promise<CharacterInfo[]>;

/** Ranked candidates for a drawn character. Real impl: recognition model. */
recognizeCharacter(sample: HandwritingSample): Promise<CharacterInfo[]>;

/** Full character record; accepts simplified or traditional form. Null if unknown. */
getCharacter(char: string): Promise<CharacterDetail | null>;
```

### 7.3 Mock adapter behavior (`src/api/mock.ts`)

- All methods reuse the existing `delay()` latency simulation.
- `searchByComponents`: superset filter over the character index; sort by
  `strokeCount`, then `frequencyRank`.
- `recognizeCharacter` — **heuristic stand-in, clearly commented as such**: rank the
  index by `|drawnStrokeCount − char.strokeCount|` ascending, then `frequencyRank`;
  return top 10. (Stroke count is the only honest signal available without a model. Do
  not attempt shape matching.) The drawn stroke count is `sample.strokes.length`.
- `getCharacter`: look up by simplified or traditional; compute `words` at call time by
  scanning `ENTRIES` (`src/api/data.ts`) for `entry.simplified.includes(char)` (also
  check traditional against the traditional form), `position` = index 0 → 'leading'.
- `listCharacterComponents`: distinct components across the index with curated stroke
  counts.

### 7.4 Mock character data (`src/api/characterData.ts`, new file)

A curated `CHARACTERS: CharacterInfo[]` covering **every unique character appearing in
`ENTRIES` headwords** (~100 characters; derive the list mechanically from
`src/api/data.ts` first, then curate each record by hand). Accuracy matters — this is a
dictionary; wrong decompositions or readings are worse than missing entries.

Curation rules:
- `readings`: include genuinely common multi-readings (行: xíng + háng; 打: dǎ + dá is
  NOT needed — dá is rare; use judgment, favor what a translator meets).
- `components`: direct top-level decomposition only (银 → 钅 + 艮), not recursive.
  Characters that don't decompose usefully (一, 人, 口, 心, 行…) get `components: []`
  and appear in the picker inventory themselves where appropriate.
- `radical`: the standard Kangxi-style radical as used in mainland dictionaries
  (simplified form, e.g. 钅 not 金 for 银).
- `strokeCount`: simplified stroke counts.
- Reference examples to match exactly:
  - 银: traditional 銀, reading yin2 ("silver; relating to money"), radical 钅,
    components [钅, 艮], 11 strokes, HSK 3-ish.
  - 行: traditional 行, readings xing2 ("to walk; to be OK; capable") and hang2
    ("row; profession; firm"), radical 行, components [彳, 亍], 6 strokes.
  - 意: traditional 意, reading yi4 ("idea; meaning; intention"), radical 心,
    components [音, 心], 13 strokes.

## 8. New/modified file map

| File | Change |
|---|---|
| `src/api/types.ts` | add §7.1 types |
| `src/api/client.ts` | add §7.2 methods |
| `src/api/characterData.ts` | **new** — curated character index |
| `src/api/mock.ts` | implement §7.3 |
| `src/components/SegmentedControl.tsx` | **new** |
| `src/components/CharacterTile.tsx` | **new** |
| `src/components/ComponentPicker.tsx` | **new** |
| `src/components/HandwritingCanvas.tsx` | **new** |
| `src/pages/CharactersPage.tsx` | **new** — modes + results |
| `src/pages/CharacterDetailPage.tsx` | **new** — focus view |
| `src/pages/EntryPage.tsx` | add per-character links row (§6.5) |
| `src/components/TopNav.tsx` | add Characters nav link |
| `src/App.tsx` | add routes |
| `src/theme/components.css`, `src/theme/pages.css` | styles for the above |
| `README.md` | one short paragraph on the feature + mock recognition caveat |

## 9. Design-system directives (binding)

- Tokens only — zero inline hex, including **inside the canvas drawing code** (§6.3).
- Display/serif stays weight 300; hanzi glyphs use `--font-hanzi-serif` (`.hanzi`).
- Pills for CTAs and the segmented control; cards `{rounded.xl}`; tiles `{rounded.lg}`/`{rounded.sm}`.
- No new accent colors. Selected states use ink inversion (like `btn-primary`), not color.
- Both themes must work with **no theme-conditional component code** except the canvas
  redraw-on-theme-change (observe `data-theme` via a `MutationObserver` or re-read
  computed styles on each stroke render).
- Desktop-only: usable from 800px (canvas + candidates stack), optimized ≥1024px.
- Quiet loading states; generous whitespace; no hover-state documentation needed.

## 10. Accessibility

- Component mode **is** the keyboard-accessible alternative to drawing; ensure the whole
  picker is tabbable with visible focus (existing `:focus-visible` outline).
- Segmented control: `tablist` semantics + arrow keys (§6.1).
- Canvas: `role="img"` with `aria-label` "Handwriting input area — draw a Chinese
  character"; Undo/Clear are real buttons; candidates are links.
- All tiles/links carry the character *and* its pinyin in accessible names.

## 11. Acceptance criteria

1. `npm run build` clean (tsc + vite), no console errors in dev.
2. Nav shows Characters; `/characters` defaults to component mode.
3. Component mode: selecting 讠 lists (at least) 诉, 讼, 谈, 谱, 译 grouped by stroke
   count; adding 圣-type second components narrows correctly; impossible components dim;
   chips + Clear all work; state round-trips through the URL (`?c=讠`).
4. Selecting 钅 → 银 appears; clicking it opens `/characters/银`.
5. Draw mode: strokes render smoothly in both themes; undo/clear work; after ≥1 stroke,
   ≤10 candidates appear ranked by stroke-count proximity; clicking one opens its focus view.
6. Focus view for 行 shows **both** readings with working AudioButtons and copyable
   pinyin, radical/stroke badges, components 彳+亍 (clickable into the picker), and 银行 +
   履行 under "Words with 行" in the correct position groups, linking to entry pages.
7. Focus view honors settings: `characterPriority` (traditional display), `pinyinStyle`,
   `headwordSize`; everything readable in dark mode.
8. `/characters/銀` (traditional) resolves to 银's record. `/characters/xyz` redirects to
   `/characters`. An unknown-but-valid CJK char shows the graceful degraded view (§6.6).
9. Entry page 银行 shows a "Characters: 银 · 行" row linking to both focus views.
10. All new API surface lives behind `DictionaryApi`; components import only from
    `src/api` (the swap point is preserved).

## 12. Verification script (manual QA)

1. Build; open `/`. Nav → Characters.
2. Pick 亻(2 strokes) → confirm narrowing + dimming; add 中 → 仲 remains; open 仲;
   confirm 仲裁 listed; click through to the 仲裁 entry page.
3. Back → Draw mode; draw ~6 strokes; confirm candidate strip and the caveat caption;
   click a candidate.
4. Open `/entry/yinhang`; click 行 in the Characters row; verify both readings + words;
   click component 彳 → picker opens pre-seeded.
5. Toggle dark mode in Settings; redraw on the canvas; confirm ink + guide colors adapt.
6. Resize to 800px; confirm canvas/candidates and the two-zone focus view stack cleanly.

## 13. Future work (explicitly out of scope now)

Real recognition model behind `recognizeCharacter`; stroke-order animation data;
recursive decomposition trees; character sets beyond the current dictionary's coverage;
search-by-radical within the main word search box; drawing-input for the main search box.

# Workspace: Status, Bug Report, and Known Rough Edges

**Status:** Implemented per [workspace-prd.md](./workspace-prd.md), typechecked, built, and smoke-tested
against most of the PRD's acceptance criteria. Two real bugs were found after that pass (reported by
the user testing manually) and are documented below with verified root causes.

> **Update (2026-07):** Both bugs below are **fixed**, along with rough-edge item 1 (chip positioning
> math), as part of a look-and-feel pass over the whole Workspace (row status bars, sheet layout,
> toolbar cleanup, self-sizing editor shell). Each fixed section carries a "Fixed" note describing
> what changed. The original diagnostic write-ups are kept for the record.

## What's implemented

All PRD sections (§1–§15) were built: the launcher (resume list, UUID fetch / paste-text paths,
restructure-confirm step with the tiered MT offer), the three-pane editor (toolbar, optional source
panel, center editor, reference panel), all three views (Target / Sentences / Paragraphs) as
projections of one segment structure, an on-demand Tiptap segment editor, word-level source lookup
via `Intl.Segmenter`, merge/split as pure data operations, the full keyboard-driven MTPE loop, and the
reference panel's Lookup/Glossary/Assistant tabs with a grounded, citation-bearing contextual
explanation. See the [PRD](./workspace-prd.md) for the full spec and the
[README](../README.md#design--constraints) for the user-facing summary.

**Verified working** during the initial pass: source-only/mixed detection and segment counts on the
demo corpus; the MT batch producing genuine dictionary-example translations; the `j/k → g/r → e →
Enter` MTPE loop with correct status borders and auto-advance; Escape's "only promote to Good if
changed" rule; merge and split producing byte-exact source concatenation; word-click lookup with a
grounded in-context explanation and citation highlighting; the Glossary and Assistant reference tabs;
autosave persistence across reload; dark mode; and the 800px floor / nav-width guard.

**Two bugs surfaced after that pass** (reported by the user) that were **not** caught by the initial
QA — the selection-fallback chip and the post-split visual seam were not exercised in that pass. Both
are root-caused below via live reproduction in the browser (not just code review).

---

## Bug 1: Arbitrary text-selection lookup doesn't work — FIXED

> **Fixed:** words now render as focusable `<span role="button">` elements instead of `<button>`s, so
> native drag-selection works; the chip-dismiss listener moved from `click` to `mousedown` (a fresh
> gesture dismisses, the trailing click of the creating drag doesn't); the chip's coordinates now use
> viewport values directly (matching its `position: fixed`), it dismisses on scroll, and a word click
> is skipped when a non-collapsed selection exists so the drag's trailing click doesn't also trigger a
> word lookup. Verified live: chip appears centered above the selection, survives the trailing click,
> looks up the selected phrase on click, and dismisses on the next mousedown elsewhere.

**Symptom:** Highlighting a span of source text that crosses word boundaries (the documented escape
hatch for when word-click segmentation picks the wrong boundary, §6.8 of the PRD) does not produce
the floating "Look up" chip in real use.

### Steps taken to diagnose

1. Confirmed the chip-rendering and click-handling logic (`SourceText.tsx`) is sound in isolation: I
   created a genuine DOM `Range`/`Selection` programmatically spanning two word buttons and dispatched
   a synthetic `mouseup` on the selection's endpoint. The chip appeared correctly (`Look up` text,
   `.workspace-lookup-chip` present in the DOM). This rules out the `handleMouseUp` logic itself as
   the problem.
2. Reasoned about why a *real* mouse drag wouldn't reach that same code path, and confirmed a second,
   independent bug in the process (below).

### Root causes (two, compounding)

1. **Each source word renders as a `<button>` element** (`.workspace-word` in `SourceText.tsx`).
   Browsers generally treat a mousedown-and-drag that starts on a button as a *press* gesture, not a
   *text-selection* gesture — buttons are not designed to support click-drag text selection the way
   plain inline text does. In practice this means a user almost certainly can never create a
   multi-word selection by dragging across the rendered word buttons in the first place, because the
   drag never starts a native selection. This is very likely the primary cause of "highlighting does
   nothing."
2. **Even where a selection is somehow created**, I found a second bug: the `document`-level "click
   outside to dismiss" listener added in `SourceText.tsx` (to close the floating chip when the user
   clicks elsewhere) fires on the native `click` event that immediately follows the `mouseup` which
   ends a selection drag. Verified directly: after programmatically creating a selection and firing
   `mouseup` (chip appears), dispatching the `click` that a real browser would fire immediately after
   causes the chip to disappear ~100ms later (once React processes the listener). The listener's
   target check (`chipRef.current?.contains(e.target)`) correctly identifies that this trailing click
   isn't on the chip itself — but that click is the *tail end of the same gesture that created the
   chip*, not a later, unrelated "click away," and the current logic can't tell the difference. So
   even if bug (1) were fixed, this second bug would still clear the chip before a user could ever
   click it.

### Suggested fix directions (not implemented)

- For (1): render words as non-interactive elements (e.g. `<span>` with a click handler, or explicit
  `user-select: text` styling) rather than `<button>`, so native drag-selection isn't fighting the
  browser's button-press handling. Word-click-to-look-up can still work via a plain click handler on
  the span; only the *drag* behavior needs to change.
- For (2): the dismissal listener needs to ignore the click that concludes the very drag that produced
  the current chip — e.g. suppress the "click outside" check for one tick after `mouseup` sets the
  chip, or key off `mousedown` position/timing instead of a same-tick `click`.

---

## Bug 2: Post-split segment status indicator looks "split in the middle" / spacing is off — FIXED

> **Fixed:** sentence rows within a paragraph group now sit in a flex column with an 8px gap, and the
> status indicator changed from a full-height `border-left` to a rounded bar (`::before`) inset from
> the row's top and bottom — adjacent bars can never read as one continuous strip, even at a glance.
> Verified live after a split: the two new rows are 8px apart, each with its own distinct bar.

**Symptom:** After splitting a segment (or generally between any two adjacent segments in Sentences
view), the 3px left status-border strip reads as one continuous bar that changes color/style partway
down, rather than two visually distinct, well-separated rows.

### Steps taken to diagnose

Inspected computed styles on three consecutive `.workspace-sentence-row` elements directly in the
browser. Confirmed:

- `margin-top` and `margin-bottom` are `0px` on every row.
- Row 1's `bottom` edge (302px) is pixel-identical to Row 2's `top` edge (302px) — the rows are
  perfectly flush, with zero gap between them.
- Row 1 (status `needs-revision`) renders a solid red left border; Row 2 (status `untranslated`)
  renders a dashed grey left border. Because the rows touch exactly, the two borders read as one bar
  that abruptly changes from solid-red to dashed-grey at the seam, which is what reads as "split in
  the middle."

### Root cause

`.workspace-sentence-row` has no margin/gap between siblings, and its container,
`.workspace-paragraph-group`, is a plain block element that doesn't establish a gap for its children
either (`workspace.css`). This is a general spacing gap affecting *any* two adjacent segments in
Sentences view — it's most visible right after a split specifically because a split deliberately
produces two segments with *different* statuses (the first keeps its prior target and becomes
`needs-revision`; the second is fresh `untranslated`) sitting directly next to each other, so the
color discontinuity at the seam is stark. The same zero-gap issue exists between any two rows
regardless of split; it's just less noticeable when neighboring segments happen to share a status.

### Suggested fix direction (not implemented)

Add spacing between sibling rows — e.g. a `gap` on `.workspace-paragraph-group` (turning it into a
flex/grid container) or `margin-bottom` on `.workspace-sentence-row` (excluding the last child in each
group). This should also generally improve the legibility of the Sentences/CAT-grid view beyond just
the post-split case.

---

## Other known rough edges (self-reported, not raised by the user)

While diagnosing the above, and reviewing the implementation more broadly, the following are worth
flagging — none of these block the feature, but they're honest gaps or simplifications:

1. **Floating chip position math is inconsistent with its own CSS.** *(FIXED with Bug 1 — the chip
   now uses viewport coordinates directly and dismisses on scroll.)* `.workspace-lookup-chip` is
   styled `position: fixed` (viewport-relative) in `workspace.css`, but the JS in `SourceText.tsx`
   computed `top`/`left` by adding `window.scrollY` / `window.scrollX` to `getBoundingClientRect()` —
   that scroll-offset addition is correct for `position: absolute` (document-relative), not `fixed`.
2. **Tiptap's `autofocus: 'end'` was not confirmed with a real keystroke.** In automated testing, a
   synthetic `keydown` for `e`/`Enter` opened the editor but didn't carry real user-activation, so
   `autofocus` didn't visibly focus the field (manual click-to-focus worked fine, and typing/Enter/
   Escape all worked correctly once focused). This is very likely a testing-tool artifact rather than
   a real bug — a genuine physical keypress should carry proper user-activation — but it was never
   confirmed with an actual keyboard press, so it's worth a manual spot-check.
3. **The toolbar's "Translate" affordance is two separate buttons** (`Translate` / `Translate all`)
   rather than a single pill with a dropdown, as sketched in the PRD. This was a deliberate,
   documented simplification made during implementation since no dropdown-menu component exists yet
   in the design system — not a bug, but worth knowing if a true dropdown is wanted later.
4. **Word segmentation quality depends on the browser's built-in `Intl.Segmenter('zh')`** (ICU), which
   doesn't always agree with this app's curated ~120-entry dictionary boundaries — e.g. 侵权方 was
   observed segmenting into individual characters rather than 侵权 + 方 in Chromium. This is expected/
   documented behavior (ICU segmentation is linguistically real, just not identical to a small curated
   list), not a defect, but translators may notice occasionally unintuitive word-click boundaries.
5. **A citation-highlight race condition was found and fixed during this session** (a stale revert
   timer from an earlier citation click in the reference panel's "In context" section could clear a
   newer highlight early) — fixed with a sequence guard. I have not done a systematic audit for the
   same overlapping-`setTimeout` pattern elsewhere in the codebase, so it's possible (though I have no
   specific evidence) that a similar pattern exists in an untested corner.
6. **No virtualization for long documents** — all paragraphs/segments render at once. This is
   explicitly deferred as future work per the PRD, but worth restating: performance with a very long
   pasted document (hundreds of segments) has not been tested.
7. **The reference panel's Lookup tab doesn't reset when navigating to a different segment** without
   clicking a new word — it keeps showing the last-looked-up phrase. This is intentional per the PRD,
   but could read as mildly stale if a translator moves on without looking anything else up.
8. **Testing so far has used only the ~6–8 segment demo corpus.** A heavier stress test with a larger,
   more realistic document (dozens of paragraphs, mixed formatting) hasn't been done.

## Suggested next steps

1. ~~Fix Bug 1 (both root causes) and Bug 2~~ — done (see the Fixed notes above), but a **real manual
   mouse-drag pass on the selection chip is still worth doing**: automated verification can create
   genuine selections and dispatch the surrounding events, but it cannot reproduce the browser's
   native drag gesture — the very gap that let Bug 1 slip through the first QA pass.
2. ~~Fix the chip's `position: fixed` vs. scroll-offset math~~ — done with Bug 1.
3. Manually confirm Tiptap's autofocus with a real keypress.
4. Consider a quick systemic grep for other `setTimeout`-based "revert after N ms" patterns to rule out
   the same race class as item 5 above.

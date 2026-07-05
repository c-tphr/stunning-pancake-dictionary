# PRD: AI Assistant Tab

**Status:** Approved for implementation
**Target implementer:** Claude Sonnet, working in this repository
**Prerequisite reading:** [DESIGN.md](../DESIGN.md), [README.md](../README.md), `src/api/client.ts` (adapter pattern), and — critically — the **already-authored prompt layer** in `src/ai/` (§7). Do not rewrite those files; build against them.

---

## 1. Context

Cídiǎn users are professional CN→EN translators. Dictionary entries answer "what does this
mean"; they don't answer "which of these two near-synonyms fits a contract" or "why is 了
here". This feature adds an **AI** tab: a chat assistant for term and grammar explanations,
backed by the OpenAI API.

Two constraints shape everything:

1. **Auth**: the OpenAI key is attached server-side to the user's SSO certificate. The
   frontend never sees a key; the chat method is just another `DictionaryApi` promise, and
   the feature is **unavailable until the user signs in**.
2. **Groundedness**: translators cannot publish hallucinated dictionary content. The
   response is structured (typed blocks, not markdown), citations index into a
   request-provided source list so the model *cannot* fabricate a source, and uncited
   content is visibly labeled model knowledge. The plumbing for this already exists in
   `src/ai/` — the UI's job is to surface it without being preachy.

## 2. Goals

- A chat interface stylistically indistinguishable from the rest of the app (editorial
  cards, ink pills, quiet states — no bubbly chat-app look).
- Structured assistant replies rendered with dedicated components: prose, example
  sentences (reusing the entry-page example treatment), and term chips that deep-link into
  the dictionary.
- Non-intrusive but ever-present grounding signals: superscript citation markers, a
  collapsed per-message sources row, and a subtle "model knowledge" label for uncited content.
- All data flow behind `DictionaryApi`; the real OpenAI adapter later swaps in via
  `src/api/index.ts` and consumes `src/ai/prompts.ts` unchanged.

## 3. Non-goals

- Streaming responses (contract is a single promise; revisit later).
- Conversation persistence across reloads, multi-conversation management, or server-side
  history (in-memory for v1; note as future work).
- Model choice UI, temperature controls, or any raw-prompt visibility.
- Passage translation / document mode. This is term & grammar Q&A.
- Writing or modifying the prompt/schema/validator files (§7) beyond genuine bug fixes.

## 4. User stories

1. Translating a supply contract, I ask "Is 应该 or 应当 more appropriate in a statutory
   obligation clause?" and get a register-focused contrast with cited dictionary senses
   and example sentences I can copy or listen to.
2. I ask "Why 了 twice in 我吃了饭了?" and get a grammar explanation — clearly labeled as
   model knowledge since no dictionary source covers it — with example blocks.
3. From the 把握 entry page I click "Ask AI", and the chat opens already knowing which
   entry I'm asking about.
4. The assistant mentions 违约 in an answer; the term chip links me straight to
   `/entry/weiyue`, and the sources row shows exactly which entries grounded the answer.
5. Signed out, I open the AI tab and am told plainly that the assistant needs SSO sign-in
   (the key rides on my certificate), with a sign-in button right there.

## 5. Information architecture

- New top-nav link **AI** between Characters and Glossary
  (`src/components/TopNav.tsx` nav array).
- New route in `src/App.tsx`: `/ai` → `AiPage`.
- Optional query param `?entry=<entryId>` — the entry the user launched from (§6.6).
- Chat state lives in `AiPage` component state (in-memory; resets on navigation away is
  acceptable for v1 — do NOT lift into a provider yet).

## 6. Feature specification

### 6.1 Page layout

`container` width, `page` padding, max content column ~820px (match `.results-list`).

- **Header**: `display-lg` "AI assistant", `page-header-sub`: "Term and grammar help,
  grounded in the dictionary and your glossary."
- **Message list**: vertical stack, oldest first, auto-scroll to newest on append
  (`scrollIntoView` on the last message; respect `prefers-reduced-motion` by using
  `behavior: 'auto'` when set).
- **Composer** pinned under the list (not fixed-position; it follows the flow).
- **Footer caption** under the composer, `caption` muted, always visible:
  "AI explanations can be wrong — verify against the cited sources before you publish."

### 6.2 Signed-out gate

If `useSession().user` is null: render the header plus an `empty-state` card in place of
list + composer:

- `display-sm`: "Sign in to use the assistant."
- `body-sm`: "The AI service authenticates with your SSO certificate — your
  organization's API access is attached to it. Nothing is sent until you're signed in."
- The existing sign-in `Button` (`variant="outline"`), wired to `useSession().signIn`,
  disabled while `initializing || signingIn` (mirror TopNav's logic).

While `initializing`, show the standard `state-note` loading text instead of flashing the gate.

### 6.3 Empty state (signed in, no messages)

Centered-ish quiet start, not a giant hero:

- `body-md` muted: "Ask about a term, a distinction between near-synonyms, or a grammar
  point."
- Three starter chips (reuse `.hero-sample` badge styling), each fills the composer and
  sends immediately:
  - `应该 vs 应当 in legal drafting`
  - `When does 把握 take 有?`
  - `Why does 了 appear twice in 我吃了饭了？`
- If `?entry=` resolved to an entry, additionally show a `caption` line: "Asking about
  银行 yínháng" with a small unlink (×) button that clears the focus entry.

### 6.4 Composer

- `<textarea>` styled like `.search-input` (white card surface, `rounded-md`, hairline-strong
  border, 2px ink focus border), min-height 44px, auto-grows to ~5 lines, then scrolls.
- Send button: ink pill (`Button variant="primary"`), label "Send". Disabled when the
  trimmed input is empty or a reply is in flight.
- Enter sends; Shift+Enter inserts a newline. `aria-label="Ask the AI assistant"`.
- While awaiting a reply: keep the user's message visible in the list immediately
  (optimistic append), show `state-note` "Thinking…" where the reply will land, disable
  the composer but preserve its text buffer for the next message.

### 6.5 Message rendering

**User messages** — right-aligned, compact plate: `surface-strong` background,
`rounded-lg`, padding `--space-sm` `--space-base`, max-width ~75%, `body-md` ink. No
avatar, no timestamp.

**Assistant messages** — full-width editorial card (`surface-card`, 1px hairline,
`rounded-xl`, padding `--space-lg`), containing the block sequence, then a footer row.
Component: `AiMessage.tsx`, rendering per block `kind`:

- **`text`** → paragraph, `body-md`, `--color-body-strong`. If `sourceIndexes` is
  non-empty, append superscript citation markers: small buttons rendered as `¹ ² ³`
  (the source number), `caption` size, `--color-muted`, no underline;
  `aria-label="Show source 1"`. Clicking one expands the sources row (§6.5.1) —
  markers must never interrupt reading flow (no brackets, no color).
- **`example`** → reuse the **exact** entry-page example treatment: `.example` card
  (canvas-soft, hairline-soft border, `rounded-lg`) with `.example-zh-row` — a small
  `AudioButton size="sm"` (text = the `zh` sentence) beside the Chinese, then pinyin
  `caption`, then the English `body-sm`. The `zh` line is a `CopyText` target. If `note`
  is present, add a `caption` muted line beneath. Citation markers (if any) go at the end
  of the English line.
- **`term`** → `AiTermChip.tsx`: an inline-block chip on its own line — hanzi
  (`hanzi` class, 20px) + pinyin (`caption` muted) + gloss (`body-sm`), inside a
  hairline-bordered `rounded-lg` plate (like a slimmed `.settings-option`). When
  `entryId` is non-null, the whole chip is a `Link` to `/entry/:id` with a hover
  underline on the hanzi (mirror `.glossary-row-main`); when null, the hanzi is a
  `CopyText` target instead and there is no link affordance.

#### 6.5.1 Sources row (the groundedness footer)

Every assistant message ends with a footer row, hairline-soft top border, containing
either or both of:

- **Sources toggle** (when `message.sources.length > 0`): a `caption-uppercase` muted
  button — "Sources (2)" — with `aria-expanded`. Collapsed by default. Expanded, it
  reveals one row per source: `[n]` number, the source `label`
  ("银行 yínháng — bank"), a `badge-pill` "GLOSSARY" when `kind === 'glossary'`, and the
  whole row links to `/entry/:entryId`. Clicking an inline citation marker expands this
  row and visually highlights the matching source row (e.g. brief
  `--color-surface-strong` background; no new colors).
- **Model-knowledge note** (when any `text`/`example` block has empty `sourceIndexes`):
  a `caption` muted line — "Includes model knowledge — verify before use." This is the
  *only* labeling for ungrounded content: no per-block warning icons, no red. Absence of
  a citation marker + this one quiet line is the design.

### 6.6 Entry-page cross-link

In `EntryPage`'s `entry-actions` area, beside the existing StarButton: a
`Button variant="outline"` labeled "Ask AI" linking to `/ai?entry=<id>`. On `AiPage`,
resolve the param via `api.getEntry(id)`; invalid ids are silently ignored. The resolved
entry becomes `grounding.focusEntryId` and is always included in the grounding list while
set (§8); it stays set for the whole conversation unless the user clears it (§6.3).

### 6.7 States & edge cases

- **Adapter error** (rejected promise): replace "Thinking…" with an inline error line in
  the reply slot — `body-sm`, `--color-error`: "The assistant couldn't respond. Your
  message wasn't lost — try sending again." Re-enable the composer with the failed
  message text restored into it. Also fire the standard toast.
- Whitespace-only input never sends.
- History cap: the prompt layer already truncates to `AI_HISTORY_LIMIT` (12) turns;
  the UI renders the full conversation regardless.
- Signing out mid-conversation: gate replaces the UI; conversation state is discarded.
- Long replies: no truncation; the message list scrolls (page scroll, not an inner
  scroll region).
- Model-knowledge note computed from blocks, not trusted from anywhere else.

## 7. Already-authored prompt layer (consume, don't rewrite)

| File | What it provides |
|---|---|
| `src/api/types.ts` | `AiBlock` union, `AiMessage`, `AiSource`, `AiGrounding`, `AiChatRequest/Response` — **already added**. |
| `src/ai/prompts.ts` | `AI_SYSTEM_PROMPT`, preference substitution, grounding serialization, `buildAiMessages()`, `buildAiApiPayload()` (messages + `response_format`, ready for the OpenAI adapter). |
| `src/ai/schema.ts` | `AI_RESPONSE_FORMAT` — strict structured-outputs JSON schema matching `AiBlock`. |
| `src/ai/validate.ts` | `parseAiResponse()` (raw model JSON → validated message; drops fabricated citations/entryIds) and `assembleAssistantMessage()` (for the mock). |

The real adapter's future job, for reference (do not build it):
`POST /chat/completions` with `{ ...buildAiApiPayload(request), model }` under the
SSO-certificate credentials, then `parseAiResponse(content, request.grounding)`.

## 8. Contract & implementation work

### 8.1 `DictionaryApi` (src/api/client.ts)

```ts
/** Structured chat turn with the AI assistant. Requires an authenticated session. */
chat(request: AiChatRequest): Promise<AiChatResponse>;
```

### 8.2 Grounding assembly (`src/ai/grounding.ts`, new)

```ts
buildGrounding(message: string, focusEntry: DictionaryEntry | null,
               glossaryEntries: DictionaryEntry[]): Promise<AiGrounding>
```

- Extract contiguous CJK runs from `message` (reuse `hasCJK` / the CJK ranges in
  `src/lib/pinyin.ts`).
- For each run (cap 4 runs): `api.search(run)`, keep the top 2 entries.
- Include every glossary entry whose simplified or traditional headword appears as a
  substring of the message.
- Include `focusEntry` first when present; set `focusEntryId`.
- Dedupe by entry id (glossary membership wins for `kind` — check via `useGlossary`
  ids passed in), cap at 8 sources total, preserving order: focus → glossary → search.

`AiPage` builds the request per send: `preferences` from `useSettings`
(`characterPriority`, `pinyinStyle`), `glossaryEntries` from `useGlossary`, history =
prior `AiMessage[]`.

### 8.3 Mock adapter (`src/api/mock.ts`)

- `await` 600–900ms (a beat slower than the data methods — it reads as thinking).
- **Call `buildAiApiPayload(request)` and discard the result** — this keeps the prompt
  plumbing exercised and typechecked end to end.
- Compose deterministic canned blocks (clearly commented as such), then return
  `{ message: assembleAssistantMessage(blocks, request.grounding) }`:
  - If `grounding.sources` is non-empty, for the first source's entry: a `term` block
    (with its real `entryId`), a `text` block referencing its first sense with
    `sourceIndexes: [1]`, an `example` block (reuse the entry's stored example when it
    has one, `sourceIndexes: [1]`; otherwise a generic canned example with empty
    indexes), and a closing `text` block of generic usage advice with **empty**
    `sourceIndexes` (so the model-knowledge note is exercised).
  - Otherwise: a `text` block (empty indexes) noting it has no dictionary grounding for
    this question and answering generically, plus one canned `example` block.
- Honor `preferences.pinyinStyle` in canned pinyin via `toToneMarks`/`toToneNumbers`.

## 9. New/modified file map

| File | Change |
|---|---|
| `src/api/client.ts` | add `chat()` (§8.1) |
| `src/api/mock.ts` | implement `chat()` (§8.3) |
| `src/ai/grounding.ts` | **new** (§8.2) |
| `src/components/AiMessage.tsx` | **new** — assistant card, block renderers, sources row |
| `src/components/AiTermChip.tsx` | **new** (§6.5) |
| `src/components/AiComposer.tsx` | **new** (§6.4) |
| `src/pages/AiPage.tsx` | **new** — gate, empty state, chat loop |
| `src/components/TopNav.tsx`, `src/App.tsx` | nav link + route |
| `src/pages/EntryPage.tsx` | "Ask AI" action (§6.6) |
| `src/theme/components.css`, `src/theme/pages.css` | styles for the above |
| `README.md` | short feature paragraph incl. SSO-key note and mock caveat |

## 10. Design-system directives (binding)

- Tokens only; no inline hex. No new accent colors — groundedness signaling uses
  typography and muted tones, never color-coding (no green "verified", no yellow
  warnings). `--color-error` appears only in the adapter-failure state.
- Assistant cards are editorial cards, not chat bubbles: `rounded-xl`, hairline, white
  surface. User plates use `surface-strong` — the same neutral family as badges.
- Citation markers: text-level, muted, superscript; never badges, never colored.
- Both themes must work with zero theme-conditional code (tokens handle it).
- Quiet loading ("Thinking…" as `state-note`); pill CTAs; desktop-only, usable at the
  800px floor (message column and composer full-width; nothing fixed-positioned that
  collides with the footer).

## 11. Accessibility

- Message list: `aria-live="polite"` region so new replies are announced.
- Composer textarea labeled; Enter/Shift+Enter behavior documented in `aria-description`
  or placeholder ("Ask… (Enter to send)").
- Citation markers and the sources toggle are real buttons (`aria-expanded` on the
  toggle); source rows are links.
- Starter chips are buttons. The signed-out gate's sign-in control is the standard Button.

## 12. Acceptance criteria

1. `npm run build` clean; no console errors in dev.
2. Signed out → `/ai` shows the gate with a working sign-in button; after mock sign-in
   the chat UI appears without a reload.
3. Sending "什么时候用 银行?" produces: user plate; "Thinking…"; then an assistant card
   containing a linked 银行 term chip, cited text with a superscript ¹, an example block
   with a working AudioButton and copyable Chinese, and a closing uncited text block.
4. The same reply's footer shows "Sources (1)" (collapsed) **and** the model-knowledge
   note; expanding sources reveals "[1] 银行 yínháng — bank" linking to `/entry/yinhang`;
   clicking the inline ¹ also expands and highlights it.
5. A question that produces no grounding (pure English like "Explain resultative
   complements", and also "How does 了 work?" — CJK present but no dictionary match)
   yields an answer with no sources toggle and the model-knowledge note present.
6. Starter chips send immediately; `?entry=yinhang` shows the focus caption, its ×
   clears it, and an invalid `?entry=zzz` is ignored.
7. Entry pages show "Ask AI" beside the star button, landing on `/ai` with focus context.
8. Pinyin in canned mock output follows the tone marks / numbers setting; the whole tab
   is correct in dark mode and at 800px.
9. Composer: Enter sends, Shift+Enter newlines, empty input can't send, in-flight state
   disables sending, adapter failure shows the inline error, restores the draft, and
   allows retry.
10. All data access goes through `api.*`; components import prompts/validation helpers
    only from `src/ai/`; `buildAiApiPayload` is invoked by the mock on every `chat()` call.

## 13. Verification script (manual QA)

1. Build, open `/ai` signed out → gate. Sign in → empty state with starter chips.
2. Click the 应该/应当 starter → confirm full reply anatomy from criteria 3–4
   (grounding will match 应该's entry).
3. From `/entry/bawo`, click "Ask AI" → focus caption; ask "有把握 examples" → sources
   include 把握; clear focus with ×; ask a pure-English grammar question → no sources,
   model-knowledge note only.
4. Kill the reply path temporarily (make mock `chat` reject once) → inline error +
   draft restoration + successful retry.
5. Toggle dark mode and tone numbers in Settings; re-ask; verify rendering. Resize to
   800px; verify composer and cards.

## 14. Future work (out of scope)

Streaming tokens; conversation persistence + history list; "insert into glossary" action
on term chips; passage-level translation review mode; feedback (👍/👎) telemetry to tune
prompts; model/temperature configuration surface; sending the current search query as
implicit context.

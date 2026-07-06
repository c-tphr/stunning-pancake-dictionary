# Cídiǎn — Chinese–English Dictionary for Translators

A desktop web frontend for Chinese→English translators (L1 English). Search accepts hanzi
(simplified or traditional), pinyin (tone marks, tone numbers, or toneless), or English, and
auto-detects which one you typed. Entries carry translator-oriented affordances: one-click copy
of headwords/pinyin/glosses, register and domain labels, and a personal glossary exportable as
TSV for CAT term bases.

Search, retrieval, pronunciation audio, and SSO auth are designed to be served by an API. Until
that exists, the app runs against a typed mock adapter (`src/api/mock.ts`) with CC-CEDICT-style
sample data; pronunciation is mocked with the browser's built-in Mandarin speech synthesis.
Swapping in the real API is a one-file change in `src/api/index.ts`.

## Prerequisites (fresh macOS)

Only Node.js needs a system install — everything else arrives via `npm install`.

1. **Xcode Command Line Tools** (provides git; needed by Homebrew):
   ```sh
   xcode-select --install
   ```
   Accept the GUI prompt and let it finish.
2. **Homebrew**:
   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Follow the `eval` instruction it prints at the end to add `brew` to your PATH.
3. **Node.js LTS** (includes npm):
   ```sh
   brew install node@22
   brew link node@22
   ```
   Alternative: skip Homebrew and install the macOS `.pkg` from <https://nodejs.org> (then steps
   1–2 are unnecessary).

Verify: `node -v` and `npm -v` both print versions.

## Run

```sh
npm install
npm run dev        # dev server at http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production bundle to `dist/`), `npm run preview`
(serve the production build).

## Design & constraints

- Visual system: see [DESIGN.md](./DESIGN.md). All tokens live in `src/theme/tokens.css` as CSS
  custom properties — never inline hex values.
- **Offline-capable fonts**: EB Garamond (display) and Inter (body) are self-hosted via
  `@fontsource` packages and bundled by Vite — no runtime font fetches. Chinese text uses
  built-in system fonts (Songti SC / PingFang SC on macOS, SimSun / Microsoft YaHei on
  Windows 11). Every font stack falls back to Windows 11 built-ins (Georgia, Segoe UI) in case
  security policy blocks packaged fonts.
- **Desktop-only**: no mobile layout. Responsive from full-screen down to a hard floor of 800px
  (half of a 1080p display); below that the page scrolls horizontally rather than breaking.
- **Dark mode**: Settings → Appearance (System / Light / Dark, default System). Dark palette
  extends DESIGN.md's dark-surface tokens; the resolved theme is applied as `data-theme` on
  `<html>`, with an inline bootstrap script in `index.html` to prevent a light-mode flash.
- **Character look-up** (`/characters`): for looking up a character you can't type. Two modes —
  select known components (with live narrowing) or draw the character on a canvas. Component
  data lives in `src/api/characterData.ts`; handwriting recognition is mocked with a
  stroke-count heuristic (`recognizeCharacter` in `src/api/mock.ts`) until a real recognition
  service is connected — the UI carries a small caption saying so. Each character has a focus
  view (`/characters/:char`) with its readings, radical/component breakdown, and the dictionary
  words that use it.
- **AI assistant** (`/ai`, requires sign-in): a chat interface for term and grammar questions,
  backed by the OpenAI API. The frontend never handles an API key — the real adapter attaches it
  server-side to the user's SSO certificate, so `chat()` is just another `DictionaryApi` promise.
  Groundedness is structural, not a prompt suggestion: replies are typed blocks (`src/api/types.ts`
  — `AiBlock`) that cite 1-based indexes into a request-supplied source list
  (`src/ai/grounding.ts` assembles it from dictionary/glossary matches before every send), and
  `src/ai/validate.ts` strips any citation or `entryId` that doesn't resolve to a real source
  before the UI ever sees it. The system prompt and OpenAI structured-outputs schema
  (`src/ai/prompts.ts`, `src/ai/schema.ts`) are written to be sent as-is once the real adapter
  lands; the mock (`src/api/mock.ts`) calls the same prompt builder on every turn so that path
  stays exercised, then returns deterministic canned blocks instead of calling a model.
- **Workspace** (`/workspace`): a CAT-style editor — paste text or fetch a document by UUID,
  post-edit machine-translation drafts, and switch freely between Target/Sentences/Paragraphs
  views of the same structured paragraph→segment data (`WorkspaceProject` in `src/api/types.ts`).
  The editing surface is [Tiptap](https://tiptap.dev), mounted on demand only for the segment
  being edited (never a monolithic document), which is what keeps merge/split pure data
  operations. Source text is click-to-look-up at the word level via `Intl.Segmenter` (falling
  back to a dictionary longest-match) in `src/lib/segmentation.ts`. Two LLM-backed capabilities
  ride the same grounded-citation pattern as the AI tab: `translateSegments` (glossary-consistent
  MT drafts) and `explainTerm` (a contextual, citation-bearing explanation of a selected phrase,
  synthesizing the termbase results already shown above it with the surrounding source sentence)
  — both prompts live in `src/ai/translatePrompt.ts` and `src/ai/termExplainPrompt.ts` and are
  exercised by the mock on every call. Two demo document UUIDs are listed in the launcher
  (`src/api/workspaceData.ts`) — one source-only, one bilingual — built from real dictionary
  example sentences so the mock's translations are genuine, not filler. A full keyboard-driven
  MTPE review loop (`j`/`k` navigate, `g`/`r` mark, `e` edit, `?` for the full shortcut list) is
  built for fast post-editing without leaving the keyboard.

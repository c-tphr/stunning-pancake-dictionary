# PRD: Elasticsearch Backend for Dictionary, Glossary, and Character Data

**Audience:** backend engineers building the real API behind the Cídiǎn frontend.
**Status:** draft for review.
**Frontend contract:** [`src/api/client.ts`](../src/api/client.ts) (`DictionaryApi`) and
[`src/api/types.ts`](../src/api/types.ts). The mock adapter
([`src/api/mock.ts`](../src/api/mock.ts)) is the **behavioral reference implementation** — where
this document and the mock disagree, flag it; do not silently pick one.

---

## 1. Overview

The frontend ships complete and runs against a typed mock adapter. Swapping in the real API is a
one-file change on our side (`src/api/index.ts`), so the backend's job is precisely scoped: serve
the `DictionaryApi` methods below from Elasticsearch with the same observable behavior the mock
implements today, at production scale (full CC-CEDICT, ~120k entries, instead of the mock's ~120
curated entries).

### In scope

| Domain | Frontend methods to serve |
|---|---|
| Dictionary search & retrieval | `search(query)`, `getEntry(id)` |
| Personal glossary (per user) | `listGlossary()`, `addToGlossary(entryId)`, `removeFromGlossary(entryId)` |
| Character look-up | `listCharacterComponents()`, `searchByComponents(components)`, `getCharacter(char)` |

### Out of scope (separate services; listed so interfaces don't drift)

- **TTS** (`getPronunciation`) — a TTS service serves audio; ES stores no audio. The text it
  speaks comes from entry/example fields defined here.
- **Handwriting recognition** (`recognizeCharacter`) — a model service. Its *response* type is
  `CharacterInfo[]`, i.e. documents from the characters index defined here, so the service will
  read from this index to hydrate candidates.
- **LLM endpoints** (`chat`, `translateSegments`, `explainTerm`, `restructureDocument`) — the LLM
  gateway. Note §6.3: these features hit `search()` heavily for grounding.
- **Workspace project storage** (`*WorkspaceProject`) and **remote documents**
  (`getRemoteDocument`) — document store, separate PRD.
- **Auth/SSO** — assumed to exist; endpoints below state what they require of it.

---

## 2. Data model

The API returns `DictionaryEntry` / `CharacterInfo` / `CharacterDetail` JSON exactly as typed in
`src/api/types.ts`. Recommended approach: store each API object verbatim in `_source` and add
**derived, search-only fields** at ingest. The frontend must never need to transform a response.

### 2.1 `dictionary-entries` index

One document per dictionary entry. `_id` = the entry's public `id` (see §5.2 on id stability —
ids are referenced durably by user glossaries and AI citations, so they must survive reindexes).

```jsonc
{
  // ---- verbatim API payload (returned to the client as-is) ----
  "id": "yinhang-bank",
  "simplified": "银行",
  "traditional": "銀行",
  "pinyin": "yin2 hang2",          // tone-numbered, one syllable per token, neutral = 5
  "frequencyRank": 120,             // optional; lower = more frequent
  "hskLevel": 1,                    // optional
  "measureWords": ["家", "个"],     // optional
  "senses": [
    {
      "glosses": ["bank (financial institution)"],
      "register": null,             // 'formal' | 'literary' | 'colloquial' | 'archaic'
      "domain": "finance",          // optional free string
      "examples": [
        { "zh": "…", "pinyin": "…", "en": "…" }   // example pinyin is display-ready tone marks
      ]
    }
  ],

  // ---- derived search fields (ingest-time only, never returned) ----
  "search": {
    "simplified_exact": "银行",          // keyword
    "traditional_exact": "銀行",         // keyword
    "simplified_sub": "银行",            // wildcard field type (substring matching)
    "traditional_sub": "銀行",           // wildcard field type
    "pinyin_normalized": "yinhang",     // keyword; see §3.2 for the exact algorithm
    "glosses": ["bank (financial institution)"],  // text, english analyzer (strong match)
    "glosses_raw": ["bank (financial institution)"], // keyword lowercase (weak substring match)
    "chars_contained": ["银", "行", "銀"], // keyword[]; unique chars of simplified+traditional
    "leading_chars": ["银", "銀"]         // keyword[]; first char of each form
  }
}
```

Mapping notes:

- `senses` does **not** need `nested` — the API never queries sense-level combinations; glosses
  are flattened into `search.glosses` at ingest.
- `simplified_sub`/`traditional_sub`: use the [`wildcard` field type] rather than n-grams. Hanzi
  queries are short (1–6 chars), corpus is small, and `wildcard` avoids CJK n-gram index bloat
  while supporting the required *infix* semantics.
- `chars_contained`/`leading_chars` exist so `getCharacter`'s "words using this character" list
  (§4.6) is two cheap `term` filters instead of a scan.

### 2.2 `characters` index

One document per character (`CharacterInfo`). `_id` = the simplified form (`char`), which the
frontend treats as the canonical key.

```jsonc
{
  "char": "银",
  "traditional": "銀",              // equals char when identical
  "readings": [ { "pinyin": "yin2", "glosses": ["silver"] } ],  // ordered by reading frequency
  "radical": "钅",
  "components": ["钅", "艮"],       // keyword[]; direct visual components, simplified forms
  "strokeCount": 11,
  "hskLevel": 1,                    // optional
  "frequencyRank": 300              // optional
}
```

- `components`, `char`, `traditional`, `radical`: `keyword`.
- `getCharacter` accepts **either** form (frontend passes whatever the user tapped/typed), so
  queries hit `char OR traditional`.

### 2.3 `character-components` index (tiny, curated)

The component picker's inventory — currently the curated `COMPONENT_STROKES` map in
`src/api/characterData.ts`. One doc per pickable component:

```jsonc
{ "component": "钅", "strokeCount": 5 }
```

This is curated editorial data, not derivable by aggregation (the picker deliberately shows a
subset of high-value components with their own stroke counts). Ship it with the dataset release
(§5). `listCharacterComponents` returns all docs sorted by `strokeCount` asc.

### 2.4 `glossary` index (per-user state)

```jsonc
{
  "user_id": "sso-subject-or-stable-user-id",
  "entry_id": "yinhang-bank",
  "added_at": "2026-07-07T12:00:00Z"
}
```

- `_id` = `"{user_id}:{entry_id}"` → add/remove are idempotent by construction (the mock's add
  is a no-op when present; delete of a missing item succeeds silently — preserve both).
- All operations require an authenticated session; `user_id` always comes from the session,
  **never** from the request body.
- `listGlossary` returns full `DictionaryEntry[]` (order: `added_at` asc — the mock preserves
  insertion order and the TSV export inherits it): query glossary by `user_id`, then `mget` the
  entries index. Entries whose id no longer resolves are silently dropped (mock behavior) — but
  see §5.2; this should be a data bug, not a routine event.

---

## 3. Search behavior specification

`search(query)` is the core of the product and the AI features. The mock's behavior is the spec;
this section restates it precisely. Reference implementations: `search`/`searchHanzi`/
`searchPinyin`/`searchEnglish` in `src/api/mock.ts`, normalizers in `src/lib/pinyin.ts`.

### 3.1 Mode detection (server-side; returned as `detectedMode`)

The UI displays the detected mode as a badge ("Matched as pinyin") so translators can trust the
interpretation — it is part of the response contract, not an internal detail.

1. Trim the query. Empty → `{ entries: [], detectedMode: "english" }`.
2. If it contains **any CJK ideograph** — regex character classes `U+3400–U+9FFF` or
   `U+F900–U+FAFF` (frontend: `/[㐀-鿿豈-﫿]/`) → mode `hanzi`.
3. Else if it **looks like pinyin** — every char matches
   `/^[a-zA-ZüÜ + tone-marked vowels + 0-5 + ':' + "'" + '-' + whitespace]+$/`
   (frontend: `looksLatin` in `src/lib/pinyin.ts`) → run the **pinyin** search; if it returns
   ≥ 1 hit, mode `pinyin` with those hits.
4. Otherwise (or when pinyin found nothing) → mode `english`. This fallback is deliberate:
   Latin input is ambiguous, pinyin wins when it matches anything, and English words rarely
   collide with normalized pinyin keys.

### 3.2 Pinyin matching (tone- and format-insensitive)

Both the indexed key and the query are collapsed with the **same normalization** — replicate
`normalizePinyin` (`src/lib/pinyin.ts`) exactly, in an ES custom analyzer or in the service:

1. lowercase;
2. `u:` → `v`; any of `ü ǖ ǘ ǚ ǜ` → `v`;
3. Unicode NFD, then strip combining marks (removes tone marks);
4. strip every remaining non-`[a-z]` character (removes tone digits, spaces, apostrophes,
   hyphens).

So `"yín háng"`, `"yin2hang2"`, `"yinhang"`, `"YIN HANG"` all become `yinhang`.

Match tiers against `search.pinyin_normalized`:

| Tier | Condition | Example |
|---|---|---|
| exact | key == normalized query | `yinhang` → 银行 |
| prefix | key starts with query | `yin` → 银行, 银… |
| infix | key contains query, **only when normalized query length ≥ 4** | `hang` (4 chars) may hit; `a` never floods results |

### 3.3 Hanzi matching

Against both `simplified` and `traditional`:

| Tier | Condition |
|---|---|
| exact | query == simplified or == traditional |
| partial | query is a substring of either form |

### 3.4 English matching

Against flattened sense glosses:

| Tier | Condition |
|---|---|
| strong | query matches at a **word boundary** in any gloss (mock: `\b{q}\b`, case-insensitive) — an analyzed `match` on `search.glosses` is the ES-native equivalent |
| weak | query is a case-insensitive substring of any gloss |

### 3.5 Ranking

Within the tiers above, order is always `frequencyRank` **ascending, missing last**
(`rankSort` in the mock). Final order = tier order, then frequencyRank. In ES terms: express
tiers as `bool`/`dis_max` clauses with fixed `constant_score` boosts spaced widely enough that
frequency can act as the tiebreaker (e.g. sort by `_score desc, frequencyRank asc missing _last`),
or run tiered queries and concatenate server-side. Either is fine; the observable order is the
contract.

### 3.6 Result size

The mock returns everything; the real corpus can't. **Default limit: 50 entries**, no pagination
in v1 (no UI for it). The two result consumers that matter: the search page shows a flat list;
the AI grounding assembler (§6.3) takes only the **top 2** hits per query — so precision at the
head of the list is what matters, not recall depth.

---

## 4. Endpoints

Transport is REST + JSON. Names are suggestions; the response *shapes* are the contract (they
must deserialize into `src/api/types.ts` types untouched).

| # | Endpoint | Maps to | Auth | Notes |
|---|---|---|---|---|
| 4.1 | `GET /api/search?q={query}` | `search` | none | Returns `{ entries: DictionaryEntry[], detectedMode: "hanzi"\|"pinyin"\|"english" }` |
| 4.2 | `GET /api/entries/{id}` | `getEntry` | none | 404 → frontend receives `null` |
| 4.3 | `GET /api/characters/components` | `listCharacterComponents` | none | Sorted by strokeCount asc |
| 4.4 | `GET /api/characters/search?components=钅,艮` | `searchByComponents` | none | **ALL** listed components must be present (`term` filter per component). Empty param → `[]`. Sort: strokeCount asc, then frequencyRank asc missing last (`charRankSort`) |
| 4.5 | `GET /api/characters/{char}` | `getCharacter` | none | Match on `char` **or** `traditional`; 404 → `null` |
| 4.6 | ↳ (same response) | `CharacterDetail.words` | — | Entries where `search.chars_contained` has the char (either form). `position: "leading"` when `search.leading_chars` contains it, else `"other"`. Sorted frequencyRank asc missing last. Cap at 50 |
| 4.7 | `GET /api/glossary` | `listGlossary` | **required** | Full `DictionaryEntry[]`, added_at asc |
| 4.8 | `PUT /api/glossary/{entryId}` | `addToGlossary` | **required** | Idempotent; 204. Validate the entry id resolves (400 if not) |
| 4.9 | `DELETE /api/glossary/{entryId}` | `removeFromGlossary` | **required** | Idempotent; 204 |

Cross-cutting:

- **Latency budget:** p95 ≤ 250 ms per call as seen by the client. The mock simulates 150–300 ms
  and the UI's loading states are tuned to that; anything materially slower degrades the
  keyboard-driven flows (the Workspace reference panel fires a search on every word click).
- **Errors:** non-2xx with a JSON problem body. The frontend treats thrown errors as transient
  and surfaces retry affordances; it never parses error bodies for logic.
- **CORS:** the app is a separate origin; standard allowlist + credentials for glossary routes.

---

## 5. Data ingestion & operations

### 5.1 Sources

- **Dictionary:** CC-CEDICT (the mock data is CC-CEDICT-style by design). Licensing: CC BY-SA
  4.0 — attribution is already in the frontend footer; keep the license note in the dataset repo.
- **Characters:** curated dataset (readings, radical, components, stroke counts) — the mock's
  `src/api/characterData.ts` documents the exact shape and the component-inventory subset.
  Components use **simplified forms** as their canonical representation.

### 5.2 Entry id stability (hard requirement)

User glossaries, AI citation `entryId`s, and frontend routes (`/entry/{id}`) all reference entry
ids durably. Ids must be **deterministic across reindexes and dataset updates**: derive them from
content identity (recommended: `hash(traditional + "|" + pinyin)` — the CC-CEDICT line identity),
not from ingest order or ES-generated ids. A dataset update that changes an entry's meaning in
place keeps its id; deletions should be tombstoned in release notes since stale glossary
references degrade silently (§2.4).

### 5.3 Indexing lifecycle

- Versioned indices behind aliases (`dictionary-entries` → `dictionary-entries-v3`); reindex to a
  new version and flip the alias atomically. Analyzer changes always require a reindex.
- The corpus is small (~120k entries, ~10k characters): 1 primary shard per index + replicas is
  plenty. Ingest is a batch job, not a stream; `refresh_interval` can stay default.
- Snapshot the glossary index on the normal backup cadence — it is the only index holding
  user-generated state.

### 5.4 Glossary migration

The shipped frontend persists glossary ids in `localStorage` (`cidian.glossary.v1`). On first
authenticated run against the real API, the frontend will bulk-import via repeated
`PUT /api/glossary/{id}` (or, if you prefer, expose `POST /api/glossary:import` accepting an id
array — coordinate with us; either works, the import is client-initiated).

---

## 6. Consumers to keep in mind

### 6.1 Search page & compact nav search

Human-typed queries, all three modes, latency-sensitive, detection badge visible.

### 6.2 Workspace reference panel

Fires `search(word)` on **every source-word click** in the CAT editor, then feeds the results
into `explainTerm` as its grounding list. High call frequency, small queries (1–4 hanzi),
head-precision matters.

### 6.3 AI grounding assembler (`src/ai/grounding.ts`)

Before every chat turn, the client extracts up to **4 unique CJK runs** from the user's message
and calls `search()` once per run, keeping the **top 2** hits each (cap 8 sources). That's up to
4 sequential search calls per chat send. If this shows up in load profiles, we'd accept a batch
endpoint (`POST /api/search:batch` with `{ queries: string[] }` → array of results) — optional,
not required for v1.

### 6.4 Character pages

`searchByComponents` narrows live as the user toggles components (a call per toggle);
`getCharacter` powers the focus view including its word-formation list.

---

## 7. Acceptance criteria

Golden queries — run against the staging index; every row must hold. (These mirror the mock's
behavior with its curated data; adapt expected *entries* to the full corpus, but the *relations*
must hold.)

| Query | detectedMode | Expectation |
|---|---|---|
| `银行` | hanzi | Exact entry 银行 first |
| `銀行` | hanzi | Same entry (traditional matches) |
| `银` | hanzi | Entries containing 银 (银行 among them); exact single-char entry (if present) first |
| `yinhang` | pinyin | 银行 first (exact normalized key) |
| `yin2hang2` | pinyin | Identical results to `yinhang` |
| `yínháng` | pinyin | Identical results to `yinhang` |
| `YIN HANG` | pinyin | Identical results to `yinhang` |
| `yin` | pinyin | Prefix tier: entries whose key starts with `yin`, frequencyRank order |
| `a` | (any) | Must **not** return the whole corpus (infix requires length ≥ 4) |
| `bank` | english | Entries glossed "bank" at a word boundary before any substring-only matches |
| `xyzzyq` | english | `[]`, no error |
| *(empty)* | english | `[]` |

Characters & glossary:

- `GET /api/characters/search?components=钅,艮` returns 银 (and only characters containing
  **both**); results ordered strokeCount asc.
- `GET /api/characters/銀` and `/api/characters/银` return the same `CharacterDetail`; its
  `words` list includes 银行 with `position: "leading"`.
- Glossary: PUT → GET shows the entry (in insertion order) → DELETE → GET no longer shows it;
  repeating the PUT or DELETE is a 204 no-op. All three reject unauthenticated calls.
- Every response body deserializes into the corresponding `src/api/types.ts` type with no
  unknown-field or missing-field errors.

Performance:

- p95 ≤ 250 ms per endpoint under nominal load; `search` p99 ≤ 500 ms.

Parity harness (recommended): we can hand over the mock's dataset as fixtures; loading it into a
staging index and diffing API responses against the mock for the golden queries is the cheapest
way to prove behavioral parity before switching the frontend adapter.

---

## 8. Open questions

1. **Pinyin syllable ambiguity** — normalization deliberately discards syllable boundaries
   (`xian` = 先 or 西安-style `xi'an`). The mock accepts this; apostrophes are stripped. Fine for
   v1, flagging in case CC-CEDICT scale makes prefix-tier noise noticeable.
2. **English fuzziness** — the mock does no typo tolerance. Proposal: keep v1 exact (spec
   parity), consider `fuzziness: AUTO` on the weak tier later behind a flag.
3. **Example-text search** — examples are stored but not searched in v1. A future "search
   example sentences" feature would want `senses.examples.zh/en` indexed; cheap to add at ingest
   now (flattened `search.examples_zh` / `search.examples_en`), even if unqueried.
4. **Traditional variant granularity** — CC-CEDICT maps variants at the entry level; the
   character dataset needs its own simplified↔traditional mapping and they should agree. Who owns
   reconciliation?
5. **Glossary write concurrency** — same user on two devices: last-write-wins per entry id is
   acceptable (adds/removes are idempotent and per-entry). Confirm no stronger guarantee needed.

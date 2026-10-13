> Ported from CucCut v2. The data model names in this document (TranscriptDoc, etc.) refer to the v2 models. For how they correspond to the v3 document models, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Glossary Library Design Draft (Cross-Project Terminology Table)

> Status: 2026-09-20 prototype first (`designs/cuccut`, product spec [§15.10](../product/product-design/15-glossary.md)). The same day it was narrowed to **two kinds of table** (transcription glossary / translation glossary, §2). The pure layer and App v2 have landed; the CLI and the recognition-hint channel are not built yet (§6).

## 1. Why a second layer is needed

The project already has a glossary: `# Canonical Terms` in `ai/context.md` (`Source | Category | Variants | Note | Lock | Origin`) and `# Bilingual Glossary` in `ai/context.<lang>.md` (`Source | Target | Note | Lock | Origin`). The analysis stage's model extracts them, and they travel with the project ([file contract §5](ccut-file-contract-subtitle-ai-design/05.md)). The translation stage reads their projection in `ai/brief-<lang>.json` as `glossary[]` (`GlossaryEntry { source, target, note, locked }`, `engines/brief.rs`). It already has four hard constraints:

1. Bilingual rows with `Lock=yes` are compiled into the translation payload's `rt` (required targets);
2. `validate_translated_page` marks a page `Malformed` when `rt` is missing;
3. The local Agent path `lint_agent_answer` uses the same criterion;
4. `ccut … check` aggregates `missingTargets`.

What is missing is the **user's own, cross-project** layer. Field conventions (`commit` in volume-price methods means “突破确认” (breakout confirmation)) are neither guessed correctly by the model nor should they be re-extracted for every project.

**The glossary library is upstream of that table, not a parallel mechanism.** The library does one thing: it writes the entries **hit by the current piece** into the project's table with `Origin=user`. Downstream then needs no changes, and the `ccut lint` / `check` / translation validation rules all stay as they are. Users' manual edits to the project table remain valid (`Origin=user` rows already take precedence over `analyzed` in the existing merge).

For the same reason, **the library file format is the same-shaped Markdown table**: people can read it, edit it by hand, and send it to colleagues. Import and export need no second format and no second parser (it reuses `filepipe::context_md`; user files use `ParseMode::Strict`, while clipboard import can be relaxed to `Model` and report the places it resolved as warnings).

## 2. Data model

**The library holds two kinds of table, one table per Markdown file.** The first version recorded misrecognitions and translated names in the same entry, so adding one word meant filling six cells, translated names had to be stored per target language, and the direction had nowhere to go. The second version splits them:

| Kind | Front matter | Body | What one entry is | Used for |
| --- | --- | --- | --- | --- |
| Transcription glossary | `kind: transcribe`, optional `lang` (spoken language; default = any) | `# Canonical Terms` | Canonical spelling + commonly misheard forms (`Variants`, may be empty) | Transcription recognition hints and polishing corrections; when a translation hits, it borrows the misrecognitions |
| Translation glossary | `kind: translate`, `from` (may be omitted = any), `to` (required) | `# Bilingual Glossary` | Source → target, optional note, `Lock` defaults to `yes` | Translation; **only tables whose direction matches take part** |

```markdown
---
name: 交易 · 量价方法
kind: translate
from: en
to: zh
default: true
---

# Bilingual Glossary

| Source | Target | Note | Lock | Origin |
|---|---|---|---|---|
| Wyckoff | 威科夫 |  | yes | user |
| commit | 突破确认 | 量价语境，不是「提交」 | yes | user |
```

```markdown
---
name: 机器学习
kind: transcribe
lang: zh
default: true
---

# Canonical Terms

| Source | Category | Variants | Note | Lock | Origin |
|---|---|---|---|---|---|
| KV cache | other | 开维缓存, KV 换成 |  | no | user |
```

The constraints share a source with the project table and add no new semantics:

- The table columns follow the shape of the project table, so the parser is still the `filepipe::context_md` one. **`Category` is no longer filled in by users**: the library always writes `other` (values outside the closed set are downgraded to `other` on read, with a warning). The `Lock` of a transcription table is always `no`.
- Merge key = `term_merge_key` (lowercase, whitespace removed, ASCII punctuation removed). `KV cache` / `kv-cache` / `KV Cache` are the same entry.
- `Variants` lists only spellings that **were actually misheard**. This is an anti-hallucination clause: invented near-synonyms would corrupt correct sentences, and the cost is asymmetric.
- **Translation entries default to `Lock=yes`**: a translation the user wrote is meant to be enforced. `Lock=no` is called “可变通” (flexible) in the UI: it is preferred, but may be replaced when the context does not fit. Both cells of a translation entry are required, so there is no row that is locked but has no translated name.
- **Direction matching**: `from` is compared by primary subtag (`zh-Hans` / `zh-CN` / `zh` are all `zh`); omitted or `auto` = any source language. `to` is compared by the canonical code in the language catalog (`zh` ≠ `zh-Hant`: translating into Simplified and into Traditional are two tables). Language codes and names always come from the language catalog shared by the whole App (the real one is the dependency-free leaf crate `ccut-lang`; `ccut-editor-core::translate_list::LANGS` is its translation-subset facade; the prototype mirrors `app/model-languages.js`). **The glossary library carries no language table of its own**: transcription, translation and dubbing read the same one.
- **Conflicts count only within the same direction**: within one direction, if two enabled tables translate the same source term into different words, the table earlier in the enabled order wins. Different directions do not interact. There are no conflicts between transcription tables; their `Variants` are unioned.
- **Reversal**: a translation table can generate a reverse table (source and target swapped, `from`/`to` swapped). When reversal makes merge keys collide, only the first entry is kept. When `from` is any, the reverse table's `to` cannot be known, so reversal is not offered. The generated table is disabled by default, because translated names are not always reversible and a person should check it.

**Mixed files from the first version** (no `kind`, both sections present) are **losslessly split into two tables** on read. `# Canonical Terms` goes into a transcription table of the same name (`lang` defaults). `# Bilingual Glossary` goes into a translation table of the same name (`from` defaults, `to` takes the old front matter's `targetLang`, or else the first of `targets`). Old files with only one section are classified by that section. Old files on disk are written in the new shape on their first write-back (the translation half gets its own file). This also settles the old Q1 / Q2: **a translation table has exactly one direction, and one file per direction**, with no language column.

**Bulk-entry line format** (shared by the UI's “一次粘一批” (paste a batch at once), clipboard import, and CLI `add --from-file`, parsed by one parser): one entry per line. Separators accept `=`, `→`, `->`, `=>`, and Tab. The third cell is the note. On a transcription table, the right side uses `、` `,` `·` to separate multiple misrecognitions, and writing only the canonical spelling is also fine. Lines starting with `|` are read as Markdown table rows; if there is a header, columns are found by the header (`Source / Target / Variants / Note`). Lines that cannot be parsed are **returned together with the reason**, not silently dropped.

**Storage location**: the user data directory (macOS `~/Library/Application Support/CucCut/glossary/*.md`, Windows `%LOCALAPPDATA%\ccut\glossary\*.md`), shared by the App and the CLI, at the same level and under the same rules as `tts-pace.json`. The project side stores only **which tables are enabled** (an array of ids, shared by both kinds), not their contents. Projects that have not set anything take the tables with `default: true`.

## 3. Compiled into the project: only what is hit

Before running polishing or translation, merge the tables the project has enabled that **are useful for this step** (polishing = transcription tables whose spoken language matches; translation = translation tables whose direction matches) into one term set, then find hits in this document:

- Latin words respect word boundaries (`(?<![A-Za-z0-9])…(?![A-Za-z0-9])`, so `commit` inside `commitment` is not a hit). CJK matches as direct substrings. Case-insensitive.
- **On translation hits, borrow the transcription tables' misrecognitions.** Translation tables do not record misrecognitions themselves, but before the text is polished, the body may say “维科夫” (a misrecognition of `Wyckoff`) rather than `Wyckoff`. A wrong spelling recorded for the same merge key in the enabled transcription tables also counts as a hit.
- Only hit entries are written into `ai/context.md` (transcription table) / `ai/context.<lang>.md` (translation table), with `Origin=user`. **Non-hits are not written**: dumping the whole library in would bloat a table meant for the model to read with hundreds of lines of noise, and would make the truncation at `ANALYSIS_MAX_TERMS` (400) start dropping the rows that are actually useful.
- Same-named rows extracted by the model (`Origin=analyzed`) are overwritten by the library's rows, with `Variants` unioned.

**The translation prompt layer also carries only hits.** After the project table is compiled into `glossary[]` in `ai/brief-<lang>.json`, `DocumentBrief::glossary_for_prompt(source_text, 80)` used to **sort by hit count and take the first 80**. Entries with zero hits still ranked lower and got into the system prompt (words from fragments extracted in the analysis stage and later trimmed got mixed in this way). Since 2026-09-20 it **keeps only entries that actually appear in the source text** (same criterion as `term_present`: Latin words respect word boundaries, CJK matches by substring), then sorts by count and takes the first 80. `rt` (per-page required targets) already judges hits per page and is unaffected.

**Staleness scope**: changing one term only makes **the sentences that hit it** stale. The existing `term_hashes` in `provenance.rs` already records, per sentence, the hashes of the terms that were hit at the time (covering the four fields `source / target / note / lock`). Library changes therefore reuse the same channel, requiring no new stale semantics and not triggering a full retranslation.

## 4. The three points of use

### 4.1 Transcription: recognition hints (table selection + custom prompt, capability gate)

| Channel | Backend | Budget | Form |
| --- | --- | --- | --- |
| `prompt` | whisper.cpp / whisper-rs, `gpt-4o-transcribe` | ~224 tokens (UI reports about 180 characters) | Initial prompt: the model reads it as **preceding text**, not as an instruction |
| `context` | Qwen3-ASR | Much wider (UI reports about 1200 characters) | Context text; can say what the recording is about |
| `none` | MOSS, etc. | — | No such channel |

For each transcription, the user decides two things (the same block appears in the “more options” of the new-project wizard and in the re-transcribe panel): **which transcription glossaries to include** (only those whose spoken language matches are listed; if untouched, the default ones are used) and **a custom prompt** (may be empty). Models with no channel have the whole block collapsed into one sentence, so no control is shown that does nothing. The first version's single global switch (`glossaryHint`) has been removed.

**Composition rule** (`hint_compose(custom, terms, budget)`, pure layer, one function shared by UI and backend): the custom prompt comes first, **not a single character cut**. The canonical spellings of the terms are appended after it, separated by `、`, to fill the remaining budget, in the tables' enabled order. Terms that do not fit are dropped at the end and **the number dropped is reported**. If the prompt itself exceeds the budget, `over` is reported (the UI turns orange and states by how much it exceeds; the backend truncates at the tail according to the channel's own rules). The JSON receipt must likewise carry `dropped / over`, with no silent truncation.

**Wired up on 2026-09-20** (spec `1.153.0`). The landed shape matches the table above. The actual implementation of each of the three items:

1. **Backend input**: `SpeechRecognition::transcribe_with_hint(audio, language, hint: Option<&TranscribeHint>)`. `transcribe` becomes the `hint = None` branch of it, so existing callers need no changes. Whisper CoreML encodes the hint as `<|startofprev|> + BPE` attached to the decoding prefix (sharing the KV cache with generation). When over budget it **truncates the head, not the tail**: cutting the tail would cut the speech mid-sentence, while cutting the head only drops the earliest terms. whisper.cpp uses `initial_prompt` (`no_context` clears the history before it; the two coexist, so the hint takes effect in every segment). Qwen3-ASR writes `Qwen3DecodingOptions.context`. MOSS explicitly accepts it and discards it.
2. **Capability query**: the backend self-reports `SpeechRecognition::hint_kind()`, cross-checked against the model-id-based `ccut_speech_core::asr_hint`. The orchestration layer (`transcribe_all_hinted`) reports a line “已忽略” (ignored) when it finds the backend has no channel, rather than silently dropping it. There are two copies of the capability table (one in the speech crate, one in the editor pure layer, which must compile to wasm). `core/crates/ccut-kernel/tests/asr_hint_parity.rs` compares them one by one, and if they drift, the test goes red.
3. **CLI / serve**: `ccut transcribe --prompt <TEXT>` (env `CCUT_TRANSCRIBE_PROMPT`). `ccut auto` and `ccut clip transcribe` have the same name and meaning. serve's `POST /projects`, `POST /imports` and task `options` each also accept a `prompt`. On the remote node, `options.prompt` of `POST /v1/asr/jobs` and the `prompt` form field of the OpenAI-compatible surface are both really forwarded to the engine.

**`--glossary <pack,…>` is not implemented**: the `ccut glossary` subcommand family (§5) does not exist yet, so on the CLI side it cannot recognize pack ids. The contract takes the simplest form: **it takes the assembled prompt text**. Assembly is still done by the single `hint_compose`, and the App page shows how many characters will be sent, so the same number is sent when the task starts. After `ccut glossary` lands, `--glossary` will be added as an “帮你拼” (assemble it for you) convenience on top; this channel does not change.

### 4.2 Polishing: per-spot correction + candidate backflow

The polish task adds the matched entries to the existing prompt and tells the model to rewrite only by “misrecognition → canonical form” and not to expand the explanation. The deterministic part (which paragraphs have which hits, and the full paragraph after replacement) can be computed up front on the Rust side as expected values for validation: one suggestion per paragraph; repeated misrecognitions of the same term within a paragraph are merged into one; when two terms overlap the same span of text, keep the earlier and longer one.

**Candidate backflow**: polish also proposes suspected proper nouns that are “not yet in the library but recur in this article (≥2 times)”. The criterion should be that deterministic code supplies the candidate pool (repeated unregistered fragments), and the model only filters and classifies. If the model lists them on its own, it will also pick up “嗯 / 论文 / 学习” (“um / paper / study”, filler words), the same lesson learned from the measured `ANALYSIS_MAX_TERMS_PER_PAGE` case.

### 4.3 Translation: direction-matched tables, matched entries only

No new mechanism. In translation tables whose direction matches, the **entries matched in this article** go into `ai/context.<lang>.md`. Entries with `Lock=yes` (the default) go through the existing four gates `rt` → `validate` → `lint` → `check`; entries with `Lock=no` (flexible) go only into the prompt. In the settings state, the UI states “N 张表 · M 条 · 本篇命中 K 条，只把命中的交给模型” (“N tables · M entries · K entries matched in this article; only the matched ones are passed to the model”) and can expand to show which entries they are. The intent sentence on the Agent path uses the same basis: “翻译术语表里本篇命中的 K 条照着译，其中 J 条必须逐字照用” (“Translate the K glossary entries matched in this article as written, J of which must be used verbatim”).

## 5. CLI

The CLI currently has **no** glossary-related commands at all (terms can only be edited by hand in `ai/context.md` and `ai/brief-<lang>.json`). The library needs its own subcommand family:

```
ccut glossary list
ccut glossary show <pack>
ccut glossary new <name> --kind transcribe [--lang <l>] | --kind translate [--from <l>] --to <l>
ccut glossary add <pack> <source> [<target 或 误识,…>] [--note <n>] [--flexible]
ccut glossary add <pack> --from-file <file|->   # one entry per line, parsed by the same code as the UI's “paste a batch at once”
ccut glossary reverse <pack>
ccut glossary import <file> [--pack <name>]
ccut glossary export <pack> [--out <file>]
ccut glossary enable <pack> --project <p> / disable
ccut glossary compile --project <p>     # print the lines that will be written into context.md for this article
```

All commands go through a stable JSON envelope. `compile --json` is the integration point for the skill and the Agent path (the transcription/translation flow in [`skills/cuccut`](../../../skills/cuccut/SKILL.md) can get at this step which terms to use, without reading the user directory itself). Adding any command or field must sync the CLI reference body in the same task.

## 6. Three surfaces

| Surface | Current state | Plan |
| --- | --- | --- |
| `designs/cuccut` | Drawn 2026-09-20 (one settings section + three in-project surfaces + capability gate); second consolidation the same day (two table kinds / two-cell word addition / paste a batch at once / translation carries only matches / transcription picks a table and custom prompt / shared language catalog) | — |
| `apps/cuccut` | **Landed 2026-09-20** ([first version](../../changelog/app-v2/2026-09-20-050743.md), [second consolidation](../../changelog/app-v2/2026-09-20-161926.md), [recognition hint powered on](../../changelog/app-v2/2026-09-20-201317.md)) | Settings section (two table kinds / two-cell word addition / paste a batch at once / direction flip / import and export) + one-line glossary state in the polish and translation settings (translation states the entries matched in this article and can expand) + **the transcription settings in the new-project wizard and re-transcription**, using the same recognition-hint block (table selection + custom prompt, scaled to model capability, actually sent as `--prompt` when a job starts) + glossary cards and backflow in results; language uses the shared catalog; the pure layer lives in `ccut-editor-core`, and the GPUI side only draws |
| `apps/web` | None | **Not applicable**: Web has no AI entry point and no settings page ([§22](../product/product-design/22.md)) |
| `core` | **Pure layer exists**: `ccut-editor-core::glossary` (two table kinds / merging by context / matching / prompt assembly and budget / line-by-line parsing / direction flip / proofreading / candidates / capability gate / Markdown round-trip / generation of compiled lines, 25 unit tests); the translation engine's `glossary_for_prompt` only collects matched entries; **recognition-hint channel powered on 2026-09-20** (`ccut_speech_core::hint`, `transcribe_with_hint` in each backend, `--prompt` and the three dispatch paths) | CLI orchestration (`ccut glossary` subcommand family in `apps/cli`, §5) |

Suggested rollout order: **core library read/write and compile → CLI → App v2 → recognition-hint channel → Web**. The recognition hint is placed later because it is the only part that touches the speech backend, while the first three steps already make the library truly effective in both polish and translation.

**Actual order** (2026-09-20): the pure layer and App v2 were done together, and the CLI moved later. The pure layer's criteria and disk format were already frozen in `ccut-editor-core::glossary` and `apps/cuccut/src/engine/glossary.rs`, and `ccut glossary` would use the same format, so which goes first does not change the contract. App went first because for the library to grow, the only route is the candidate backflow on the result page, and that path lives in the App. The recognition-hint channel was inserted ahead of the CLI on the same day (originally scheduled after it): it is the answer to the question “do the on-page toggles actually count”, and delaying it would keep the UI saying “not wired yet”. What remains is only the **CLI (`ccut glossary`)**; Web does not apply.

The library's on-disk surface today lives in `apps/cuccut/src/engine/glossary.rs` (thin: directory scanning, atomic writes, compiled output to disk), and the criteria are all in the pure layer. When doing `ccut glossary`, just move this layer into core so the two sides do not each keep their own copy.

## 7. Pending decisions

- ~~Q1 can one table be shared across languages~~ / ~~Q2 the multi-language carrier of the library file~~: **Decided (2026-09-20)**: one translation table per direction, one file each; see §2.
- **Q3 case and word-form matching**: English plurals and possessives (`Wyckoff's`) do not match currently. Should limited word-form normalization be added (only the suffixes `s / 's`), or should users always be required to write word forms into `Variants`?
- **Q4 source of backflow candidates**: the extraction algorithm for the deterministic candidate pool (unregistered repeated fragments) is not yet settled. Word segmentation of CJK text without spaces is the main difficulty, so a conservative version may need to land first (only collect fragments that contain Latin letters or known boundaries).
- **Q5 sync**: the library lives in the user data directory and is lost when switching to another computer. Whether to offer a sync method beyond “export all / import all” (for example, placing it in a user-specified directory for the user to sync himself) needs a product decision.

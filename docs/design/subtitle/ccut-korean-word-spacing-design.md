> Ported from CucCut v2. The data-model names in the text (such as TranscriptDoc) refer to v2's models; for the mapping to the v3 document models, see [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Korean words and spaces: current state, the fix, and open decisions

Status: **Option 1 implemented** (decided and landed 2026-09-30; transcript 0.5 / `specVersion 1.302.0`). Where the implementation differs from the original draft, the values chosen for each decision, and the verification results are in §8. §1–§7 keep the original proposal text, with an "Implementation note" added only where it differs from the implementation.

Source: the fourth item from the multilingual re-check of `lines/1` (dataset `3e7e4f1a6`). The first three are fixed (`d9fd2eb4d`, `8ba2f112f`, `7fa215bb5`). This one is not in the carrier; it sits in the shared tokenization and concatenation layer. Changing it changes how all Korean scripts are read, so it is written up separately.

The call-site inventory in this document comes from a read-only survey (code reading only; no tests were run). Line numbers refer to `8ba2f112f` and will drift, so go by function name. The only things I verified myself are the places marked "measured".

## 1. Symptoms

**Tokenization is lossy for Korean.** Korean is split by spaces (a space-delimited unit is called 어절, eojeol), but the code treats it like a script without spaces: it splits by syllable and joins back without adding spaces. Measured (`lean_carrier_grade atomize`, current `main`):

```
Input       저는 내일 학교에 갑니다.
Split into  ["저","는","내","일","학","교","에","갑","니","다."]
Joined back 저는내일학교에갑니다.
```

Sample from a real project (`ko-real` in the multilingual dataset, 12 sentences, Korean→Chinese):

```
Source text 도쿄여행앞두고이것저것알아보다보면뭐어디서부터어떻게계획을짜야할지막막한분들많으실거예요.
Tokens      [1]도 [2]쿄 [3]여 [4]행 [5]앞 [6]두 [7]고 …（44 total）
```

These 12 sentences align 12/12 on `lines/1` and locate 107/107 blocks (the same before and after the first three fixes). In other words, **the carrier's metrics cannot show this problem**: the model reads unspaced Korean fine and can still cite it. The damage is elsewhere:

- The source text sent to the model has no spaces (the same for translation, polishing and segmentation). The Korean subtitles on screen, the exported SRT / VTT, and the text used for search also have no spaces. `skills/cuccut/references/video/music.md` already describes this to the agent as the engine's existing behaviour (「默认引擎识别韩文就是这样」, “that is how the default engine recognizes Korean”).
- Each syllable is a "word", so when splitting subtitle lines or translation blocks, any boundary between two syllables counts as a word boundary, and a cut can land in the middle of a word.
- Korean as a target language also loses its spaces: the seams between `lines/1` blocks (no space when both sides are Hangul; the model writes one and it is deleted anyway), `rows` carrier parsing (`collapse_cjk_spaces`), and the re-joining of translations by segment (`split.rs`, and the write-back to `trans` in `engines/align.rs`). This item comes from reading the code; an actual English→Korean call has not been run.

## 2. Root cause: one predicate answering four questions

`is_cjk_char` (Han characters + kana + Hangul syllables U+AC00–D7AF) and the predicates derived from it, `is_cjk_adjacent` / `is_cjk_text` / `is_cjk_language`, are used to answer four different questions. For Chinese and Japanese the four answers are the same; for Korean they differ; for Thai and similar scripts they form yet another set of answers.

| Question | Chinese / Japanese | Korean | Thai / Lao / Burmese / Khmer / Tibetan |
| --- | --- | --- | --- |
| **S** No spaces between words (split per character, join without spaces) | Yes | **No** (split by spaces) | Yes (but not split per character: there is no segmentation, so the whole run between whitespace is one word. **Implementation note**: scripts created from 2026-10-01 onward are split into words, and the intra-phrase word seams carry a "glue to previous" marker; existing scripts are unchanged. See [`ccut-unspaced-script-segmentation-design.md`](ccut-unspaced-script-segmentation-design.md)) |
| **W** One character counts as one reading unit and takes two cells of width | Yes | Yes | No |
| **B** Line breaks / block cuts allowed between any two characters | Yes (then lint checks it) | **No** (only at spaces) | No |
| **L** Language-level typesetting (full-width punctuation, spacing between CJK and Western text, appending `。` at sentence end) | Yes | Partial (CJK/Western spacing applies; punctuation is half-width, no `。` appended) | No |

Today Korean gets "yes" on all four questions. The `is_unspaced_script_language` that `7fa215bb5` added for Thai and similar scripts covers only the language-tag half of question S, and does not touch Korean.

Existing precedents all side with "Korean is split by spaces": the line breaking in `ccut-subtitle-render/raster.rs` ("Hangul is split by spaces", tested), and what `ccut-subtitle-agent-workflow.md` and `ccut-subtitle-pipeline-implementation.md` say about Korean units. The only source of per-syllable splitting is the early test vector checked against voice-ink (the `いい天気 한국어` case in `atomize.rs`); no design document has argued for it.

## 3. Call sites, grouped by which question they ask

### 3.1 Asks S: Korean must change its answer

- `ccut-flow-core/atomize.rs`: the per-character branch of `atomize`, `sep_len` (via `is_cjk_adjacent`), `join_word_texts`, `join_prefix_char_lens`. The source.
- `build.rs`'s `atomized`: when a script is built, every transcript word goes through `atomize`. This is where the per-syllable words come from.
- `engines/markers.rs`'s `collapse_cjk_spaces`: removes the spaces the model writes back into Korean. `polish.rs` uses it for the "was this sentence changed?" comparison, and `filepipe/html.rs` (`rows` carrier parsing) uses it too.
- `seam.rs`'s `is_ideograph` → `cjk_midword_boundary`: looks only at the characters on either side of a seam, not at whitespace, so every Korean word boundary is treated as "inside a word". `split.rs`, `align_block.rs`, `align_table.rs` and `engines/align.rs` all go through it.
- `filepipe/lines_translation.rs`: `is_cjk_language(source_lang)` is taken to mean "the source text has no spaces", and it decides how the `≥k` splits and the `¦` segment markers are placed. `tidy_joints`' `wide` branch deletes the spaces at Korean block seams. The block concatenation in `filepipe/lines.rs` works the same way.
- Several places that re-join translated text and write it back to `trans`: `join_atoms` / `canonical` in `split.rs`, the write-back in the rewrite loop of `engines/align.rs`, `apply.rs` and `studio/apply.rs` in `ccut-workspace`, and `kernel/cmd/upgrade.rs`.
- Break-point decisions in `cue.rs`, `layout.rs`, `layout_profile.rs`, `engines/segment.rs`, `source_boundary.rs` and `speaker_apply.rs`: all of them go through `sep_len`, so they follow the source.
- **Second implementation**: `ccut-editor-core/subtext.rs` (`is_cjk`, `is_cjk_adjacent`, `sep_len`, `join_word_texts`, `join_words`, `join_prefix_char_lens`, `collapse_cjk_spaces`, `normalize_cjk_boundaries`). The App's cursor ↔ word mapping, the polish diff, and editing of the translation source all use it.
- Private copies: `join_pieces` in `ccut-subtitle-render/document.rs`; `ccut-timeline/match_text.rs` (`ccut cut --query`, where a Korean query with spaces never matches today); `join_words` in `ccut-flow-core/script.rs`; `paras.rs` in `ccut-editor-core` (which joins Cues into paragraphs) and `transcript_lang.rs`; and the prototype `designs/cuccut/app/model-wordanim.js` (its regex contains `가-힯`).
- The Web has no concatenation implementation of its own; its text comes from the projection of `ccut serve`. However, `transcript.logic.ts` has one comparison that joins with a hard-coded single space, which is already wrong for Chinese and Japanese today. It has nothing to do with Korean, but it can be fixed in passing.

### 3.2 Asks W: Korean keeps its current answer

`visual_width` (two copies), `display_width` in `script.rs`, `cjk_cell_lang` in `split.rs`, `reading_budget` in `layout.rs`, CPS and `fast_count`, `target_is_cjk` in `translate_list.rs`, `repeat_units` in `lines_translation.rs`, the word counting in `initial_segment.rs`, the text-share and copy-detection in `language_quality.rs`, and `is_char_token` in `metrics.rs` (checked against sacrebleu; **must not change**).

### 3.3 Asks L

`is_cjk_language` in `autocorrect.rs` (including `ko`) as the switch for CJK/Western spacing is correct. The existing case `한국어hello` → `한국어 hello` must keep passing.

Two places are existing errors on Korean with the same root: `normalize_cjk_ascii_punctuation` turns a `,` next to Korean into a full-width `，`, and `polish.rs` appends `。` to Korean sentence ends.

> **Correction after implementation (2026-10-01):** the first item above does not hold on the **source-text side**. Once Korean is segmented into 어절, a word often contains digits or Latin letters (`2박`, `600원`, `AI가`), and the CJK/Western spacing rule turns it into `2 박`: a space appears inside a word, and when a polish is rebound it is split into two words. The rule that removes spaces next to quotation marks also merges two words into one. The source-side whitespace in text containing Hangul is now left alone. **The translation side does not hold either**: in a real en→ko run the model wrote `AI 는` and `PM 이라는`, with spaces between CJK and Western text, which splits the particles apart (Korean spacing rules attach particles to the preceding word). The brief prompt and the translation typesetting were both changed so that Korean keeps its own word spacing (see the last two items of §8.2). The default behaviour of `format()` has not changed; the `한국어hello` → `한국어 hello` vector still stands, but it now only governs Hangul inside Chinese or Japanese text.

### 3.4 Points that need the scope settled first

- `atomize::word_count` (pagination, translation page budget, chapters, writing prompts): Korean changes from being counted by syllable to being counted by 어절. The numbers shrink to about a third, so the same "500 words per page" would fit three times as much content.
- Polish write-back and rebinding (`rebind.rs`, `polish.rs`, the LCS in `polish_txt.rs`): the granularity changes from syllable to whole word, so editing one particle re-mints the id of the whole word. English has always been at this granularity.
- Word-by-word highlighting / karaoke: follows 어절. The transcription engine already provides timing per 어절; the per-syllable timing was spread out by weighting characters, so there is no information loss. Per-character animation (`ccut-motion/text_parts.rs`; `edit-domain-design/03.md` specifies per-character for CJK) is not affected.

## 4. Coupling: why half a fix is not possible

- **Only stop removing spaces, without changing tokenization**: source words are still per-syllable and join back without spaces. After the model polishes, it writes back a sentence with spaces, and the change check in `polish.rs` marks every sentence as "changed".
- **Only change `sep_len`, without touching existing scripts**: the words in existing Korean scripts are all single syllables, so they would immediately display as `도 쿄 여 행`, and subtitles, exports and the source text sent to the model would all look like this. That is worse than today.
- **Only change the target side**: `trans` is a string and looks independent, but after a translation segment is sliced, re-joining goes through the same `atomize` + `join`. If tokenization does not change, the spaces inside a segment are still dropped.

So this is one change to make in full: split the S predicate out of the W predicate, change the two implementations and the several private copies together, and provide a migration path for existing scripts.

## 5. What to do with existing scripts

Words store no whitespace (`Word { id, t0, t1, text, sp }`); spaces are recomputed every time by `sep_len`. Once the rule changes, old scripts have nothing recording that "these two syllables were joined". The only clues available are:

- Words that have not been touched by polishing or editing keep the id they had when the script was built. A sub-word split from the same transcript word is `<id>~k`, and `~k` means "glued to the previous one". Words re-minted by polishing / editing (`w<timestamp>-<n>`) have no such clue.
- The raw line text in `ai/asr-rows.json` contains spaces. When lines can be matched to words, word boundaries can be re-derived. Sentences whose text was changed by polishing cannot be matched.

### Option 1 (recommended): add a sparse "glue to previous" marker on words

Add an optional boolean to `Word` (provisional name `glue`, omitted by default). When it is true, there is no space between this word and the previous one, regardless of what the default rules say. The script format version goes up to 0.5.

- Migration of old Korean scripts is **lossless and does not change ids**: every Hangul word that directly follows a Hangul word gets the marker, and the display is the same as per-character today. `breaks`, `autoBreaks`, `hidden`, `paraBreaks`, `transAlign.sourceWordIds`, the segment keys `s-<first word id>`, and the fingerprint (computed only from word text and first and last ids) need no change. Old projects will not suddenly look different, and will not all be marked as stale.
- Newly created Korean scripts store words by 어절, need no marker, and spaces appear naturally.
- To get spaces back in an old project: re-transcribe, or re-polish (the model writes back sentences with spaces, and rebinding segments them by the new rules). A separate command could re-derive word boundaries directly for sentences that still match `asr-rows`.
  - **Implementation note**: re-polishing **does not** bring the spaces back. Old per-syllable ranges, when rewritten, keep the per-syllable granularity and the markers are re-determined under the old rules (§8.2), so the spaces the model writes never enter this kind of script. Only re-transcription can bring them back. The command to re-derive word boundaries was not built.
- (**Implementation note**: the item below was not done. At present only the migration that reads old scripts writes this marker. Update 2026-10-01: Thai, Lao, Burmese, Khmer and Tibetan scripts created new also write this marker, used on the seams between words inside a phrase; see [`ccut-unspaced-script-segmentation-design.md`](ccut-unspaced-script-segmentation-design.md). An opening quote mark that sits right after a word no longer gets an extra space in newly created scripts (the test `atomize_words_splits_unspaced_scripts_and_leaves_the_rest_alone`, with the sentence `คำว่า“ยืนยันแล้ว”`, rejoins to the same text as the original). Existing scripts were not migrated and still gain one extra space.) This marker also solves other lossy cases: in Thai, an opening quote mark placed right after a word (`คำว่า“ยืนยันแล้ว”` gains an extra space when re-joined today; `7fa215bb5` only made quote matching bypass it), and any place where "the source has no space but the rule adds one".
- Cost: every place that builds text by joining a script's words has to recognize this marker (the places listed in §3.1; places that re-segment by text and then join are not involved). **Places that ask B must also recognize it**: a word with the marker is not a word boundary relative to the previous word, so line breaks, block cuts, and speaker-based splitting (`seam.rs`'s `is_ideograph` / `cjk_midword_boundary`, the cut candidates in `split.rs`, `speaker_apply.rs`) must not treat it as a legal break point. Otherwise, after migrating an old Korean script the display is unchanged but the splitting behaviour changes: once Hangul is no longer "breakable per character", every syllable seam would be treated as an ordinary word seam. Today the seams in old scripts are breakable (and are treated as within-word seams, which suppresses them). After migration, a decision is needed during implementation: keep them breakable, or make them all unbreakable uniformly. Write that decision into the migration test. Old versions of the program cannot read 0.5 scripts. **This step is irreversible**: a project that has been upgraded cannot go back to the old App.

### Option 2: re-derive word boundaries and re-mint words during migration

Merge the transcript's syllables into eojeol (Korean word units) using `~k` and `asr-rows`, re-mint the IDs, remap every overlay keyed by ID, and all fingerprints change and every stage goes stale. Sentences that do not line up (those reworded by polishing) have no reliable source for word boundaries. The change surface is the same as Option 1, plus a separate remapping pass, and some sentences cannot be migrated at all. Not recommended.

### Option 3: no migration

The old Korean project is read directly under the new rules and displays as `도 쿄 여 행`. Not acceptable; listed only to show why a migration is required.

## 6. Decisions needed

1. **Whether to raise the transcript format to 0.5 and add the “贴前” (attach-to-previous) marker (Option 1).** Irreversible: after the upgrade, the old App cannot open the project.
2. **Default handling for existing Korean projects**: keep the current display (no spaces) until the user re-transcribes or re-polishes; or, on open, prompt and offer a command that re-derives word boundaries from `asr-rows`. I have not counted how many Korean projects are on hand; counting them would mean reading real project data, which has not been done.
3. **How the Korean page budget is measured**: I suggest that page-capacity budgets (translation pages, chapters, writing) keep counting syllables (behaviour unchanged), and only the word-granularity operations (cut points, rebinding, highlighting) switch to eojeol.
4. **Scope**: core (both implementations plus the private copy), App (via `ccut-editor-core`), and the prototype `model-wordanim.js` change in the same task; Web follows automatically via projection. Should the two Korean punctuation errors in §3.3 be fixed in the same batch?
5. **Verification data**: the existing data is only the 12 sentences of `ko-real` and synthetic sentences. Before changing anything, we need at least one real Korean project for before/after comparison (transcription → polishing → translation → subtitle lines), plus one English→Korean translation. Which project to use needs to be named.

## 7. Implementation order (after decisions)

1. Split the S predicate out of `atomize.rs` (Han characters and kana; Thai and similar scripts counted separately). The W predicate keeps its existing scope. `sep_len` and `join_*` switch to the S predicate and recognise the “贴前” marker; the break-point check (B) also recognises this marker. Sync `ccut-editor-core/subtext.rs`, and check the two implementations against the same test table.
2. Transcript 0.5: `Word.glue`, lossless migration when reading old versions, the version table in `ccut-protocol`, and `docs/generated/`.
3. Close out the remaining §3.1 call sites and private copies one by one; change `collapse_cjk_spaces` together with the change-detection in `polish.rs`.
4. Apply the §3.4 scope as decided; fix the two punctuation errors in §3.3.
5. Three surfaces: App's cursor mapping and editing, the prototype `model-wordanim.js`, and the one comparison in Web.
6. Acceptance: before/after comparison on a real Korean project; multilingual replay of `lines/1` (`ko-real` should still be 12/12); Chinese, Japanese and English projects with zero per-sentence differences; after migrating an old Korean project, its display is unchanged character for character.

## 8. Implementation log (2026-09-30)

### 8.1 Decisions

| §6 | Value |
| --- | --- |
| 1 Format | Upgrade to 0.5 and add `glue`. Irreversible: 0.5 transcripts cannot be read by the old `ccut` / `ccut-serve` / App |
| 2 Existing Korean projects | Keep the current display (no spaces) until re-transcription. No prompt, and no command to re-derive word boundaries |
| 3 Page budget | Keep counting syllables (`word_count` uses `atomize_syllables`); behaviour unchanged |
| 4 Scope | Both core implementations plus the private copy, App (via `ccut-editor-core`), the prototype `model-wordanim.js`, and Web; the two Korean punctuation errors fixed in the same batch |
| 5 Verification data | The two real Korean projects named by the user (run only on copies) |

The last two items in §8.2 (leaving the Hangul whitespace in the original typesetting untouched, and Korean translations keeping their own word spacing) were added during implementation based on real-run evidence, going beyond the judgment in the original draft §3.3. **The 2026-10-01 decision stands** (translation-side commit `094e28bf1`). The original rule applied Chinese/Japanese spacing between Chinese and Western text, because the term “CJK” had been extended to Hangul; Korean orthography itself attaches particles to the preceding word (`AI가`) and counters to the numeral (`2박`). Real-run data (the pm and altman projects, [`2026-10-01-011216`](../../changelog/core/2026-10-01-011216.md)): split particles and counters went from 8 to 0 and from 85 to 0. The positioning and fallback counts changing from 14/4 to 16/1 and from 245/65 to 294/6 are the combined result of this change and the marker-fragment fix (`7dcd4b5f7`).

### 8.2 Where this differs from the draft

- **Three kinds of atomization, not one.** `atomize` handles word formation and finding break points (Korean by eojeol). `atomize_syllables` is the splitting used before 0.5, and is only used for the LCS alignment key, the surface-text signature and the page budget. These quantities are comparison keys, which are more stable compared syllable by syllable than eojeol by eojeol, and this way they stay unchanged for all existing transcripts. `atomize_like(words, text)` follows the span; within a span that contains a marked word, it goes syllable by syllable. The claim in §3.4 that “the granularity of polish write-back and rebinding changes from syllable to whole word” holds only for new transcripts.
- **Rewrites of old transcripts stay at the old granularity.** When a syllable-level span is polished, re-segmented, replaced in the transcript, edited as text, or accepted item by item as a polish rewrite, the new words are still syllables, and their markers are re-set using the rule “the old rules add no space, the new rules do” (`rebind::reglue_legacy_span`, the same rule as the migration on read). The benefit: untouched syllables keep their IDs and timings, and a rewritten passage displays character for character as it did before. The cost: the “re-polish to regain spaces” described in §5 does not hold.
- **The migration rule judges by visible words.** A visible word is compared with the nearest visible word before it; a hidden word is compared with the immediately preceding word. What is guaranteed is that “visible text stays character for character identical”. When a non-Hangul word sitting between two Hangul words is unhidden, the later word loses one space.
- **`sep_len` gets one extra rule**: Hangul adjacent to Han characters or kana gets no space (otherwise Korean mixed into Chinese or Japanese transcripts would be altered). A space is added only when both sides are Hangul, or when Hangul is adjacent to Latin letters or digits.
- **`seam.rs::is_ideograph` is unchanged**; only `cjk_midword_boundary` changed (two Hangul sides are not treated as within a word). The other call sites of `is_ideograph` are Chinese lexical heuristics, which Hangul cannot enter.
- **The original typesetting leaves Korean whitespace alone** (2026-10-01, found when creating a new transcript on a real-project copy). `autocorrect::Options::source()` (`hangul_spacing: false`) is used at the three original-text entry points: transcription to create the transcript, `project seed-transcript`, and polish write-back. Segments containing Hangul, and whole paragraphs containing Hangul, skip the spacing and space-removal rules; full-width letter and digit normalisation, and case handling of technical terms that stand as separate words, still apply. The word-level entry point has an additional safeguard: words whose formatted result contains whitespace are kept as they are (`autocorrect::format_words`).
- **Korean translations keep their own word spacing** (2026-10-01, found in an en→ko real run). The brief prompt's Chinese/Western spacing rule is limited to target languages written in Han characters or kana, and explicitly states that it does not apply to Hangul. The translation rules line states that Korean is spaced by word and that particles attach to the preceding word. `format_translation*` turns `hangul_spacing` off for `ko` targets. Both translation paths share this prompt and formatting function. In the sample (31 sentences), split words went from 17 to 0; in the 423-sentence interview, split-off particles and counters went from 85 to 0.
- **The migration hangs on deserialization, not only on `from_json`**: several places in the repo call `serde_json::from_*::<TranscriptDoc>` directly (candidate transcripts, cloning), so attaching it to serde ensures none are missed.

### 8.3 Verification

See [`docs/changelog/core/2026-09-30-235033.md`](../../changelog/core/2026-09-30-235033.md): on two real Korean projects (copies), all derived output is byte-identical before and after the switch; the multilingual replay and 508-sentence replay scores are byte-identical; crate tests are all green apart from existing failures.

The real run of this path for new transcripts and Korean translations (DeepSeek Flash) is in [`docs/changelog/core/2026-10-01-011216.md`](../../changelog/core/2026-10-01-011216.md).

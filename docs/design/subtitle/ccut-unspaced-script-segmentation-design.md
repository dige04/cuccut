> Ported from CucCut v2; the data-model names in this document (such as TranscriptDoc) refer to the v2 models. For the mapping to the v3 document model, see [architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# Word segmentation for Thai-class scripts: new scripts are stored by word, and intra-phrase seams carry a “glued-to-previous” mark

Status: **Implemented** (2026-10-01). Only newly created scripts change. Existing scripts are not migrated and stay byte-for-byte identical. The script format is still 0.5, and `specVersion` is unchanged.

Source: In the 2026-10-01 multilingual acceptance run ([`lean-carrier-acceptance-2026-10-01`](../../../scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01/README.md)), the Thai→English `th-01`…`th-06` sentences were `needs-rewrite` in both the first round and the fix round. Each sentence had only one block, so it could not be split finely. After §8.11 ([`ccut-lean-llm-carrier-design.md`](ccut-lean-llm-carrier-design.md)) fixed Hindi, the remaining six `needs-rewrite` sentences were all in this group.

## 1. Root cause

Thai, Lao, Burmese and Khmer scripts do not write spaces between words; spaces appear only between phrases or clauses. Script building (`atomized` in `build.rs`) uses `atomize`: everything between whitespace is one atom, so a Thai phrase becomes **one word** in the script. Each sentence on the acceptance page `th-01`…`th-06` is one phrase, which means one source word.

Consequences (measured with the grading tool `lean_carrier_grade`, which reads the saved answer):

- The translation can only be split into one block. The block-count ceiling for `lines/1` is `words.div_ceil(2)`, so a sentence of one word has a ceiling of 1. Chunking hints and `¦` echoes cannot produce more cut points. This is the real floor for old scripts, not a model problem.
- The model cites the words it reads (`พลอย`, `นัท`), but the script has no such word boundaries, so the quotes cannot be located.

Tibetan (including Dzongkha) is split at the syllable mark `་` in `atomize`, but when rejoined, a space is inserted at the seam. `sep_len` only recognises the CJK and legacy Hangul marks. This lossy behaviour predates this round; see §8.

## 2. The fix

1. **Segment with ICU4X's LSTM word segmenter** (`ccut-speech-core/src/word_breaks.rs`: `lstm_word_boundaries`, `grapheme_count`). It covers exactly these four scripts: Thai, Lao, Burmese and Khmer.
2. **`atomize_words`** (`ccut-flow-core/src/atomize.rs`) first splits by `atomize`, then splits atoms that contain these four scripts into words:
   - Only use boundaries where at least one side is one of these four scripts. Latin or digit runs in between, such as `F-07` and `14:30`, stay intact.
   - Do not split before combining marks.
   - Segments that are only punctuation are merged into a neighbouring word. Opening delimiters (Ps/Pi) go to the following word; all others go to the preceding word. The repetition marks `ๆ` / `ໆ` go to the preceding word.
3. **Within a word, each later segment carries a “glued-to-previous” mark** (`Word.glue`, the same field as the old 0.5 Korean scripts). Rejoining by the marks (`join_word_texts`) gives exactly the original text, and the spaces between phrases are kept. The seams in Tibetan split at syllable marks also carry the mark.
4. **Timing.** For lines where the engine gives per-word timing (the forced aligner `text_prep` uses `WordSegmenter::new_auto`, which for Thai text segments words first and then aligns), use the engine's words and times directly, and fill in the marks at seams from the line text (`script_glue_from_text`). For lines that only have line-level timing, divide the phrase's time window by the number of grapheme clusters. The first word of a line is never glued to the previous line.
5. **Grapheme-cluster boundaries are never used as word boundaries.** Grapheme clusters are used only to apportion time.

`Word.glue` now has two meanings, distinguished by the word text:

| Predicate | Criterion | Source |
| --- | --- | --- |
| `is_legacy_glued` | Carries a mark and contains Hangul syllables | The mark applied on read to pre-0.5 Korean scripts written syllable by syllable |
| `is_script_glued` | Carries a mark and is not the above | This document: newly created Thai-class scripts split by word |

`rebind::is_legacy_span` is changed to “a span that has a word with `is_legacy_glued`”. The old criterion was “any word that carries a mark”, which treated Thai word spans as legacy Korean written syllable by syllable.

## 3. Audit

| Item | Result |
| --- | --- |
| Licence | No new crate. `icu_segmenter` and the others are Unicode-3.0. Version 2.2 was already in the dependency tree (`text_prep` uses it), and the LSTM symbols were already in the release build of `ccut-serve` |
| `--locked` | `cargo build -p ccut -p ccut-serve-bin --locked` passes; `Cargo.lock` unchanged |
| Size | Debug `ccut-serve` 434,745,352 → 435,059,608 bytes (+314,256). Release not measured |
| wasm | `wasm-release` cdylib, raw / gzip -9: editor 5,320,607 / 1,388,760 → 5,320,557 / 1,388,768; subtitle 4,207,002 / 1,242,626 → 4,207,002 / 1,242,623. Subtitle is within the 1.5 MiB gate, and the wasm exports do not reach the LSTM |
| Windows | `cargo check --target x86_64-pc-windows-gnu -p ccut-speech-core -p ccut-flow-core -p ccut-workspace` passes |
| App | `cargo metadata --manifest-path apps/cuccut/Cargo.toml --locked` passes |

### 3.1 LSTM vs. dictionary segmentation

Measured (`icu_segmenter 2.2.0`, using the Thai sentences on the acceptance page plus one Lao, one Khmer and one Burmese sentence; `|` marks a boundary):

| Sentence | LSTM | Dictionary |
| --- | --- | --- |
| `th-01` sentence-initial name | `ลลิตา` | `ลลิต\|า` (splits the name wrongly) |
| `th-02` | `อง\|ศา`, `หน้า\|ต่าง` | `องศา`, `หน้าต่าง` |
| `th-04` | `ที่\|มาลี`, `ก้องยืม` | `ที่มา\|ลี`, `ก้อง\|ยืม` |
| `th-05` | `ร\|หัส` (wrongly splits รหัส, “code”) | `รหัส` |
| `th-06` | `นัทแต่` (name and conjunction run together) | `นัท\|แต่` |
| Lao | `ສະບາຍ\|ດີ` | `ສະບາຍດີ` |
| Burmese | `မြန်\|မာ\|ဘာသာ` | `မြန်မာဘာသာ` |

Both are wrong, in different places. The LSTM is too fine-grained and occasionally fuses two words together. The dictionary is too coarse and splits names that are not in its lexicon. The LSTM was chosen for size: dictionary mode needs the Chinese and Japanese dictionaries, whereas the LSTM ships models only for these four scripts, and it is already in the release binary. Segmentation errors are covered by the quote-level tolerance in §6, not eliminated by changing the segmenter.

Seams that **both** segmenters split are all correct in the table above (`องศา`, `หน้าต่าง`, `ลลิตา`, `รหัส` are all kept). Words stored in the script remain the LSTM's. The dictionary is used only as a second opinion, to decide which seams may take split hints; see §10.

## 4. Rewrite spans are anchored to the existing words

The LSTM depends on context, so segmenting a part of a phrase on its own can give different boundaries from segmenting the whole phrase. Measured: for the Thai phrases on the acceptance page, re-segmenting the prefix and suffix at each word boundary separately gave 18 of 210 sub-spans that differ from the whole-phrase result (18 of 1508 boundaries). The differences always fall at the ends of spans (`ล|ลิตา`, `ได้ยก`, `อุณหภูมิลด`).

So rewriting (polish re-binding, text edits) cannot re-cut the rewritten text directly. Otherwise, a span whose text did not change would get new words and new ids. `atomize_words_anchored`:

- From the start and from the end, keep the old words until the text first differs. Pass only the changed middle to `atomize_words`.
- When keeping words at the ends, a seam guard applies: no split before combining marks, and no split after Thai or Lao leading vowels (U+0E40–0E44, U+0EC0–0EC4).
- When the first or last segment of the middle cut is pure punctuation, the adjacent anchored word is returned to the middle to be cut together with it, at most one per side. Punctuation that already stood alone, such as an `—` with spaces on both sides, gets nothing back, because returning more would only change the cut of unchanged words. (Sandbox run: polish added a space outside a quote, `ว่า“ยืนยัน` → `ว่า “ยืนยัน`. The tail anchor `ยืนยัน` stayed as it was, so only `ว่า “` was left in the middle and the quote became a word on its own. After returning the anchor, the cut became `ว่า` and `“ยืนยัน`, consistent with a whole-phrase re-cut.)
- Marks are recomputed from the rewritten text (`script_glue_from_text`).
- A final check confirms that the rejoined result by marks equals the rejoined result of a whole-phrase re-cut. If not, fall back to a whole-phrase re-cut.

The test `script_word_spans_are_recut_only_where_the_text_changed` covers two things: when each sub-span's original text is unchanged, it is cut back to its original words; when only the middle changes, the words at the ends stay put. `a_space_added_outside_a_thai_quote_keeps_the_quote_on_a_word` covers the pure-punctuation rule (it fails when that rule is removed).

## 5. Call sites

| Call site | Question asked | Handling |
| --- | --- | --- |
| `build.rs` `atomized` | Building the script into words | `atomize_words`; time apportioned by grapheme cluster; lines that the engine gave per word get marks filled from the line text |
| `rebind.rs` `rebind_corrected` | Segmenting a rewritten span into words | `atomize_words_like`: Thai spans use the anchoring in §4 |
| `rebind.rs` `reglue_legacy_span` | Re-marking old Korean by the old rules | Skip words with `is_script_glued` |
| `atomize.rs` `atomize_like` / `atomize_word_like` | Comparison keys | Thai spans: the rewritten-text side is cut with anchoring; existing words are already words and are no longer sent for segmentation |
| `engines/polish.rs` `sentence_alignment` | Source-side key for polish alignment | Switch to `atomize_word_like` |
| `engines/polish.rs` `map_corrected_page` (also used to split over-long sentences) | Mapping polish-answer sentences back to word spans (atom LCS) | When a span has `is_script_glued` words, use `comparison_atoms(text, true)` on both sides: each atom is further cut to grapheme clusters. See below |
| `engines/segment.rs` `map_paragraphs_by_diff` | Mapping paragraph-split answers back to word spans | Same as above |
| `engines/polish.rs` `fallback_sentences` | Hard-cutting sentences at 30 words when whole-page polish fails | Do not cut when the next word is `is_script_glued` (no cutting inside a phrase); still hard-cut at 60 words |
| `engines/markers.rs` `collapse_cjk_spaces_like` | Whether to collapse spaces between Hangul syllables when comparing | Looks only at `is_legacy_glued`; Thai spaces are phrase pauses and are compared as they are |
| `filepipe/lines_translation.rs` `pieces_with_params` | Whether the source is verbatim; where `¦` goes | Verbatim check looks only at `is_legacy_glued`; `¦` is not placed at seams the dictionary does not recognise (§10) |
| `filepipe/lines.rs` quote location | Quote boundary falls mid-word | Adds the widest level, Snap (§6) |
| `ccut-workspace` `studio/apply.rs` | Writing back text edits | Existing script-glue handling; test `thai_text_edits_keep_word_glue` |
| `ccut-workspace` `review.rs` `restrict_polish_candidate` | Whether to re-mark by the old rules after blocks are joined | Use `is_legacy_span` |
| `layout.rs` `seam_grade` | Grade of subtitle line-break seams | No code change. Seams with marks are already graded in the “within-word seam” tier (3.0, more expensive than an ordinary word seam at 0.8). So in new Thai scripts, long phrases **can** break lines internally, but those breaks rank after the spaces between phrases |
| `ccut-subtitle-render` `timed_runs` | Rendering per-word highlight | No change. Each word is located by substring within the Cue text, independent of marks |
| `ccut-editor-core` `subtext.rs` | Editor joining / width measurement | No change. `JoinWord::glued()` already recognises marks |

**Why mapping in polish and paragraph segmentation is cut to grapheme clusters.** The first commit (`507c7b532`) missed these two places. The script side was already individual words, while the model's answer side could only be split by whitespace into phrases. The atom LCS match rate dropped below 0.7, so the whole page reported `source-drift` and fell back to the original. (Sandbox run: 9 sentences on 2 pages, all fell back, `fallbackSentences` 6.) Cutting the answer with the segmentation model is also wrong: it depends on context, so if the model changes one space, the cut changes. Cutting both sides to grapheme clusters is symmetric. All atoms are cut, not only those containing Thai; otherwise a segment such as `14:30` inside Thai would be whole on one side and fragmented on the other. **The grapheme cluster here is only a comparison key.** Matches map back to indices of script words, and sentence and paragraph boundaries still fall only on script word boundaries. Grapheme clusters are never used as word boundaries. For spans without a Thai-class mark (old scripts, other languages), the comparison keys are identical, one by one, to those before this change.

**No UI code was changed.** Word-level interactions in the editor and in both clients (per-word highlight, word selection, split by word) get Thai word granularity through the existing mark-aware joining. In new scripts, the unit there changes from phrase to word. This was derived by reading the code; it was not tested in the App or on the Web.

## 6. Snap Level for Quote Anchoring

The model cannot see the tokenizer's boundaries. It cuts off at the end of the word it has just read, and the tokenizer sometimes glues two words together (`นัทแต่`). So `lines/1` quote anchoring, after the existing five levels (Exact → Punct → Fold → Stem → Glued), adds the widest level, Snap:

- The quote is normalized by Fold and stripped of whitespace, and it must appear in the normalized text of this sentence;
- It expands to whole words only when at least one side's boundary falls in the middle of a word. Every word whose middle contains a boundary must abut its neighbor and contain text that is written without spaces;
- Text in old transcripts that is one atom per phrase and segmented by spaces will never match at this level; `cat` will not expand to `catalog`.

Test: `a_quote_stopping_inside_a_segmented_word_widens_to_that_word`. The CLI reference [`ccut-translate.md`](../cli/ccut-cli-server-reference/06/ccut-translate.md) is synced with this quote grading. `lines/1` applies only to direct provider connections; the Agent path does not apply. The `rows` carrier uses source word indices and is not involved.

## 7. Existing Transcripts and Compatibility

- **No migration.** Existing Thai-type transcripts have no markers, so their granularity is judged as ordinary word intervals. When rewriting, they still go through `atomize`, one phrase per atom, and the result is byte-identical to before. To get word granularity, the transcript must be re-transcribed.
- If, in a new transcript, every phrase of a sentence has exactly one word (no markers at all), that sentence is also treated as an ordinary interval when rewriting, and newly appearing multi-word phrases are not split. Display is unaffected.
- **Old program versions reading new transcripts** (inferred from reading the code, not tested): programs after 0.5 but before this round decide "per-syllable old transcript" by checking "has any marker". They will treat the rewrite intervals of new Thai transcripts as old Korean. The old rule joined only between Hangul syllables, so Thai markers inside rewrite intervals are cleared and spaces appear inside phrases. Such programs already join Thai rows whose per-word timing comes from `text_prep` with spaces (§8), so this is not a new class of error. However, the scope extends to all new Thai transcripts.

## 8. Known Issues Not Fixed

- **Thai rows that the forced aligner timed word by word came out with spaces before this round.** `text_prep` segments first and then aligns. When the transcript was built, there were no markers at word seams, so `join_word_texts` inserted a space between each word. After this round, newly created transcripts get markers from the row text. Existing transcripts are unchanged.
- **Space after the Tibetan syllable mark.** Same as above: existing transcripts are unchanged, and only newly created ones are fixed.
- **`ccut-subtitle-render`'s `source_word_fields` joins source words with spaces.** Chinese and Japanese are affected too. This is unrelated to this round and was not touched.
- **The polish mapping for old Thai transcripts is still fragile.** In old transcripts each phrase is one atom. When the model adds a space inside a phrase (`เวลา14:30น.` → `เวลา 14:30 น.`), that atom no longer matches on both sides. The sandbox page's answer also reports `source-drift` against the old-transcript mapping (the test `a_legacy_thai_transcript_keeps_phrase_level_comparison` pins this current state). This predates this round and is not fixed. Relaxing the grapheme-cluster comparison key to cover old Thai transcripts would change the polish results of those transcripts. **Ruling (2026-10-01): do not relax; keep the state pinned by this test.** §7 settled that old transcripts are not migrated and stay byte-identical. Relaxing would change polish results for existing transcripts. For word granularity, re-transcribe and use the new path.
- ~~When the segmentation hint `¦` falls at a segmentation error, the model cuts along it.~~ Fixed; see §10.
- **Language pairs without a length estimate produce multiple chunks.** Thai→English and Thai→Chinese have no `estimated_units`, so `chunk_hint` falls back to estimating by word count. A sentence of about 13 words gets ≥4, producing over-fragmented chunks such as `120 | baht` and `three | tickets`. This is `chunk_hint`'s original behavior and is unrelated to segmentation. (Also: `estimated_units` once treated any ASCII letter in the source as Latin.)
  **Ruling and handling (2026-10-01):** The source now takes the dominant script by letter count, so `รหัสF-07…` no longer uses the Latin factor 0.34. Only the language pairs that were measured are registered. Thai→English is 1.3 (the per-sentence median over 8 sentences and 189 translation rows, taking p75). In the first round, the `≥k` total went from 33 to 25, and `120 | baht` no longer appears. Thai→Chinese was also measured (0.40), but its `≥3` yields three very long Thai pieces, and DeepSeek Flash echoed the source back on 8/16 pages (0/16 with the budgeted five pieces). So it is not registered and still uses the budget. Thai→other target languages, and Lao, Khmer, and Burmese sources, have not been measured and also use the budget.
- **The model cites words that are not in the source.** In a real sandbox run of s-g6.0, the quote was written as `สิบห้านาที` (fifteen minutes), while the source is `สิบนาที` (ten minutes). Nine of ten chunks were located. The remaining chunk exceeded the hard limit and went to the rewrite round, ending `aligned`. The translation itself was correct (ten minutes).

## 9. Verification

See the two 2026-10-01 entries in [`docs/changelog/core/`](../../changelog/core/README.md). The first covers the implementation and offline regression. The second covers the real Thai run, the sandbox end-to-end test, and two fixes found in the sandbox: the polish fallback and the quote mark counted as a single word.

## 10. Segmentation Hints Fall Only on Seams Both Segmenters Agree On

Source: 2026-10-01 re-verification ([`lean-carrier-acceptance-2026-10-01-915bfef13`](../../../scripts/bench/fixtures/lean-carrier-acceptance-2026-10-01-915bfef13/README.md)). The budgeted Thai supplementary test got 8/8 aligned, but `th-02` translated `ปิดหน้าต่าง` (close the window) as `close the front panel`. That page's hint was `ต่ำกว่า5อง ¦ ศาให้ปิดหน้า ¦ ต่างก่อนเปิดเครื่อง`. The evenly spaced cut points fell exactly inside `อง|ศา` (degree) and `หน้า|ต่าง` (window), which the LSTM had split. The model translates piece by piece: `หน้า` on its own as a piece became "front", and `5อง` on its own as a piece produced `5 de|grees`.

**Fix** (`lines_translation.rs` `unsure_boundaries` / `piece_boundaries_over`): a seam between two adjacent source words is "unsure" when the two words touch in the source text, both characters on either side are Thai, Lao, Myanmar, or Khmer letters, and the ICU4X dictionary word segmentation (`word_breaks::dictionary_word_boundaries`) does not break there. `¦` is not placed on unsure seams:

- If the window near an evenly spaced cut point still contains trusted seams, choose among those using the original scoring;
- If the whole window is unsure, look outward for the trusted seam nearest the cut point (again not cutting into digits);
- If there are none at all, drop one piece. In that case `≥k` will be one more than the actual piece count, the same as the earlier case where an empty window skipped a piece.

Spaces, punctuation, digits, and script changes are all trusted seams. Text such as Tibetan, which neither segmenter covers, is unaffected. Only the position of `¦` in the hint changes (along with the piece start points used when reading answers from the same set). **The words stored in the transcript are unchanged.**

**Storage granularity ruling (2026-10-01): keep storing the LSTM words.** The only measured harm from finer granularity was `¦` falling inside compound words, which this section fixes on the hint side (`37d274245`). Storing dictionary or intersection segments would touch the alignment anchors, time apportioning, and highlight units, and no benefit is visible at present.

**Cost:** The dictionary data (Thai, Lao, Myanmar, and Khmer word lists) is about 1.8 MB and goes into the CLI, Runtime, and App binaries. The Web editing WASM does not use this path: the `wasm-release` artifact of `ccut-wasm-editor` is 5,105,682 B both before and after the change.

**Verification** (data in `/Volumes/ExtremeSSD/cuccut-lean-validation/round12/th-pieces/`, script `scripts/th-pieces-ab.py`): the same budgeted set of 8 Thai sentences. The old hints and the new hints were each sampled 8 times (DeepSeek V4.1 Flash, temperature 0.2):

| | Old `¦` | New `¦` |
| --- | ---: | ---: |
| aligned | 64/64 | 64/64 |
| Translation splits an English word (`de\|grees`) | 8/8 runs | 0 |
| `th-02` translates the window | 6/8 (2 runs `front door`) | 8/8 |
| Quote-location problems | 2 | 0 |

The sample is small, so it shows only the direction. Replay of 508 English source sentences and replay of the Codex fixtures are unchanged, sentence by sentence. In Chinese and Japanese per-character source text, `¦` also falls mid-word ([`ccut-lean-llm-carrier-design.md`](ccut-lean-llm-carrier-design.md) §8.5).

**Chinese and Japanese (continued 2026-10-01):** The same gate extends to Han characters and kana. A seam where both sides are Han characters or kana, and where dictionary segmentation does not break, is unsure. Chinese and Japanese transcripts have one character per word and no LSTM side, so only the dictionary is consulted. The real-run A/B and blind review are in the lean design doc §8.14. For Japanese, the dictionary still separates some stems from their endings (`集 ¦ まって`), and those seams remain trusted as before. Korean syllables are not in these two families and are unaffected.

**Inside of brackets and quotes (continued 2026-10-01):** Regardless of script, a seam after an opening bracket or quote and before a closing bracket or quote is unsure. In source text without spaces, an opening quote attaches to the end of the preceding word (`ว่า“`). When a piece mark falls after it, the model leaves the quote in the previous chunk, and the translation becomes `“ confirmed”`. Quote direction varies by language, so this applies only when the quote touches the other side or stands alone as a word. Details are in the lean design doc §8.15.

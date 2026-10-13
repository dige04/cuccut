# Lean carrier multilingual benchmark (2026-09-30)

This fixed dataset is used to replay the results of the `lines/1` translation carrier, source-side quote localization, and subtitle segmentation. The baseline comes from commit `d59f06d23`, with the model DeepSeek V4.1 Flash (`deepseek-flash`). The repository stores only test text and results; the replay script does not call the model or modify `.ccut` projects.

## Scope

| Source | Sample | Target language |
| --- | ---: | --- |
| `东京旅行行程推荐-10_taRWL9Ao` (Korean) | 12 / 73 sentences | Simplified Chinese |
| `8 个必装 Skill - 顶级 AI 生产力` (Chinese) | 12 / 84 sentences | English |
| `东京观光：15 处推荐景点` (Japanese) | 12 / 189 sentences | Simplified Chinese |
| Arabic, German, Spanish, Turkish, Hindi, and Thai synthetic source texts | 8 sentences each | 6 sentences each to English, 2 to Simplified Chinese |
| English synthetic source text | 8 sentences | Arabic |

The real projects each take 9 sentences evenly sampled by sentence order, plus the 3 longest unselected sentences. The source texts, words, word IDs and timings come from the `studio/data.json` and `transcript.json` snapshots at that time; the full media, the full project corpus and local project paths are not in the repository. Synthetic texts were written by the Agent; `reference_en` is an aid for content review, not a human gold standard. The Japanese project already had transcription at the time; this benchmark does not depend on its historical translations.

## Files

- [`dataset.json`](dataset.json): source, source text, source words, actual or default timing information for the 92 sentences, and risk labels for synthetic samples. Only sentences from the real projects have `word_times`.
- [`pages/`](pages/): the 16 HTML source carrier pages actually scored, with a per-sentence manifest. Sentence order, budgets and word references within the pages are kept as they are.
- [`requests.json`](requests.json), [`fix-requests.json`](fix-requests.json): the model request texts for the first round and for one targeted fix round. The fix round emphasizes the target language via `retry_reason`; do not treat the first-round and post-fix scores as the effect of a single call.
- [`responses/`](responses/): the raw model response bodies and timings for the 16 first-round calls and the 9 fix calls; file names correspond one-to-one with page names.
- [`baseline.json`](baseline.json): first-round and post-fix scores by page and by sentence, plus per-language summaries, total token usage, a build summary, and the results of a limited-shape cross-interval probe.
- [`semantic-audit.json`](semantic-audit.json): Agent content review of the 48 synthetic source texts; 46 showed no core factual errors, and 2 were clearly wrong. This is not a blind review by native speakers.
- [`property-results.json`](property-results.json): cross-judgment probe of 10 source languages × 100 dual-interval combinations.
- [`comparison.svg`](comparison.svg): per-language translation acceptance and direct alignment chart.

In this round, the first pass accepted **51/92** translated sentences and directly aligned **38/92**; after one fix pass the figures are **87/92** and **74/92**. `strictFirst` in `baseline.json` is a diagnostic value obtained at the time by using the same responses with re-splitting inside newly added blocks turned off; its first-pass direct alignment is 36/92. The standard replay script verifies only the `first` and `merged` values of the production logic. These are carrier and planner results, not translation accuracy. The synthetic set has two content errors, and one of them is still judged `aligned`.

## Offline replay

Run from the repository root:

```bash
cd core && cargo build --locked -p ccut-flow-core --example lean_carrier_grade
cd ..
CCUT_BENCH_TARGET="$(cd core && cargo metadata --no-deps --format-version 1 \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')"
python3 scripts/bench/replay_lean_carrier_multilingual.py \
  --grader "$CCUT_BENCH_TARGET/debug/examples/lean_carrier_grade"
```

The script recomputes page by page, merges the fix results, and checks the status, translations, problem codes and totals of all 92 sentences; on success it prints `ok: 92 samples ...`. Because the baseline compares model text and planner results exactly, when you intentionally change the protocol or algorithm, review each difference before establishing a new baseline.

In the first pass, the model returned many source-language texts unchanged; the fix round restored most of them. Chinese→English also had 5 sentences left untranslated because the answer format was invalid. All 8 Thai sentences only reached sentence-level correspondence. This synthetic set uses `atomize` to construct source atoms, so the error rate on the real Thai project cannot be inferred from it.

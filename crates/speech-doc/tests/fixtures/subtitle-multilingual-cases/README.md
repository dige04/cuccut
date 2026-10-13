# Multilingual Subtitle Polishing and Translation Cases

25 synthetic scenarios, each with two tasks (polishing and translation), for **50 tasks** in total. The scenarios cover English, Chinese, Japanese, Korean, Arabic, German, Spanish, Turkish, Hindi, Thai, French and Portuguese. There are 3 Thai scenarios; each of the others has 2. Target languages include English, Simplified Chinese, Japanese, Korean, Arabic, French, German and Spanish.

Use this together with the [multilingual real-response benchmark](../lean-carrier-multilingual-2026-09-30/README.md). This directory provides repeatable inputs, reference outputs and erroneous counterexamples. It does not call the Agent-written references a native-speaker human gold standard, and it does not call replay of fixed answers a new model quality test.

## Coverage

| Scenario | Check focus |
| --- | --- |
| Negation and rescheduling | "未取消，改到周四14:30" (not cancelled, moved to Thursday 14:30) must not become "cancelled" |
| Conditions and character roles | Approver, approval target and file recipient must not be swapped |
| Temporal order | "Left first but arrived late": "ten minutes later" must not become "ten minutes earlier" |
| Quantities and units | Three tickets, 120 rupees (卢比), excluding dinner; "2,5公斤" (2.5 kg) must not become 25 kg |
| Reference and ownership | Lender, borrower and book owner are each kept distinct |
| Status and codes | P-08 being confirmed does not mean it has shipped |
| Korean | Keep the spacing and "2박"; do not insert a space to make it "2 박" |
| Thai | Unspaced word stream. "หน้าต่าง" must be understood as "window", not "front panel". Sentences containing Latin-letter codes (F-07) are still treated as Thai |
| Unicode | Arabic combining marks, Devanagari combining marks and danda, Latin accents, apostrophes, quotation marks |
| Conservative polishing | Sentences that are already correct stay as they are. Polishing must not change the language, alter facts or rewrite the style |

Polishing tasks: 10 cases with typo fixes plus sentence-final punctuation fixes, 2 cases that only add sentence-final punctuation, and 13 cases of correct text that stays unchanged. `allowedCorrection` marks the artificially injected typos, for scoring reference. It is not sent to the model. All changes are small. This batch does not cover long pagination, multiple speakers or large deletions.

## Data Fields

[`cases.json`](cases.json) is the only source of cases:

- `source` / `sourceLang` / `targetLang`: the correct source sentence and the translation direction.
- `polish.input`: the text to polish. `polish.reference`: one conservative correction. `instruction`: the task requirement for this case.
- `translation.reference`: one acceptable translation. `counterexample`: a deliberately written wrong translation. `requiredFacts`: the relationships and facts that human review must check.
- `syntheticDurationSeconds`: a 16-second timeline constructed for the test. It is not a measured reading time or a real media duration.
- `provenance`: Agent-synthesized, with no native-speaker human certification yet.

Reference translations are not the only correct answers. Semantic acceptance uses `requiredFacts` and does not require the candidate output to equal the reference word for word. Counterexamples are for testing later semantic scorers. They do not mean the current production validator can already reject these errors.

## Deterministic Automated Regression

The new [`multilingual_subtitle_cases.rs`](../../../../core/crates/ccut-flow-core/tests/multilingual_subtitle_cases.rs) reads this file directly and calls the production path:

```bash
cd core
cargo test --locked -p ccut-flow-core --test multilingual_subtitle_cases
```

There are three data-driven tests, which iterate over all 25 cases:

1. **Polish write-back**: calls `run_polish_file_contract` with fixed provider answers. It checks that there is no degradation, that the corrected results are correct, that the word count and timing are unchanged, and that the IDs of unmodified words are kept. Words whose text or punctuation was changed may get new IDs under the current rebinding contract. Text comparison uses the form normalized by production draft-building rules, so this test cannot be used to infer that the original whitespace is preserved byte for byte.
2. **Translation carrier**: renders and parses through the production `lines/1`, and confirms that the reference translation is received and its text kept. When the output copies the source text in the same direction, it is rejected and goes to retry. This test does not assert that fluent mistranslations are rejected, and it does not verify subtitle segmentation quality.
3. **Chunk positions**: after rendering each case with a reading budget under production rules, `¦` in unspaced text such as Thai falls only where the dictionary segmenter also breaks, and never cuts into a word.

The first two use fixed answers. All three make no network requests, incur no model cost and modify no real project. Production semantics and prompts are unchanged. The local Agent and Cloud protocols stay as they are. The App, Web, prototypes and product skills need no matching implementation.

## Preparing New Model Collection

```bash
python3 scripts/bench/fixtures/subtitle-multilingual-cases/prepare.py \
  --out /private/tmp/subtitle-multilingual-new-run
```

The output directory must be a new directory. The script produces:

- `tasks.jsonl`: 48 independent tasks. They contain only the text to process, the languages and the instruction. They contain no reference answers, counterexamples or review points.
- `review.csv`: a separate review sheet with the source text, references, facts and counterexamples. The actual responses, semantic conclusions and notes are left blank.

This task export is for comparing models' text polishing and translation ability. It is not packaged as a production carrier and cannot stand in for an end-to-end test of the whole subtitle pipeline. Later, responses can be collected from a model the user specifies. The raw responses, model ID, version, parameters and latency are then saved once to an acceptance directory. No new model responses were collected this time.

For semantic judgments, fill in `pass` / `fail` / `needs-native-review`, and state the specific facts. Keyword presence, BLEU or "format is valid" alone must not be used to give a semantic pass.

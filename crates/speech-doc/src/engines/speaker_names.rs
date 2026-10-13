//! speaker-names: the speaker real-name inference wave that runs at the **end** of polish (`kind = "speaker-names"`).
//!
//! Background: diarization can only produce voice ids such as `s1` and `s2`, so the three UI surfaces have been showing `S01` and `S02` placeholder names. The deterministic heuristic in [`crate::speaker::propose_names`] only recognizes **self-introductions** (`my name is …`, `我是…`, `我叫…`, "I am…", "my name is…"). But in interviews, podcasts and panel discussions, most real names are given by **the other party** ("today I'm joined by Andrew Ng", "有请张三" ("please welcome Zhang San")), or appear only in titles and descriptions. That evidence has no sentence pattern to write a rule for, so the heuristic necessarily comes back empty. This wave hands the task to the model. The evidence (the opening remarks, the first-appearance context of each speaker still awaiting a name, the project and source metadata, and the named entities from analysis) goes in, and the answer comes back only as `S2 = Andrew Ng`.
//!
//! The wave runs last in polish, after the body text has been persisted by [`super::polish::apply`]:
//!
//! - `speaker-repair` rewrites `words[].sp` and may absorb a false cluster entirely. Naming first would hang a name on a speaker who no longer has any words.
//! - Only polished text has punctuation, and third-party introductions ("欢迎 Andrew Ng。" ("Welcome, Andrew Ng.")) are far easier to read than raw ASR.
//!
//! The only edit surface is **`speakers[<id>].name`**. Neither `sp` nor `speakers[].name` enters the stage fingerprint (see [`crate::doc::TranscriptDoc::stage_stamp`]), so renaming does not make polish, segment, translate or align stale. That makes this wave safe for projects that are already translated. It also writes only **placeholder names**: a name the user has edited is never touched.

use serde::Serialize;

use crate::doc::TranscriptDoc;
use crate::engines::markers::marked_text_labeled;
use crate::filepipe::PageAttempt;
use crate::filepipe::common::{Problem, ProblemCode, ProblemScope};
use crate::llm::{LlmError, LlmJson, LlmRequest};
use crate::speaker::{SpeakerLabels, is_placeholder_name};

/// Opening-remarks evidence window: this many words from the start of the document. Third-party introductions almost always come in the first minute or two ("welcome back… today I'm joined by…"). 400 words covers about 2–3 minutes of speech.
pub const SPEAKER_NAMES_OPENING_WORDS: usize = 400;
/// Evidence window before each awaiting speaker's first appearance: this many words before it. Introductions usually come from **the other party**, so the context before matters more than the context after.
pub const SPEAKER_NAMES_CONTEXT_WORDS: usize = 60;
/// Evidence window after each awaiting speaker's first appearance: this many words after it.
pub const SPEAKER_NAMES_SPEAKER_WORDS: usize = 120;
/// Character cap on a single name (including spaces). Anything over the limit is always invalid. The typical failure mode of the model when it goes out of bounds is copying the whole introduction sentence back.
pub const SPEAKER_NAMES_MAX_NAME_CHARS: usize = 40;
/// Upper limit on resends after a rejected answer (including the first round).
pub const SPEAKER_NAMES_MAX_ROUNDS: u32 = 2;

pub const FENCE_OPENING: &str = "<<<OPENING";
pub const FENCE_OPENING_END: &str = "<<<OPENING-END>>>";
pub const FENCE_SPEAKER: &str = "<<<SPEAKER";
pub const FENCE_SPEAKER_END: &str = "<<<SPEAKER-END>>>";
pub const FENCE_ASK: &str = "<<<NAMES-ASK>>>";
pub const FENCE_ASK_END: &str = "<<<NAMES-ASK-END>>>";
pub const FENCE_NAMES: &str = "<<<NAMES>>>";
pub const FENCE_NAMES_END: &str = "<<<NAMES-END>>>";

/// Answer value when the model gives up on naming.
pub const UNKNOWN_ANSWER: &str = "?";

/// Accounting for speaker-names (goes into the polish envelope as `speakerNames.wave`).
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakerNamesReport {
    /// Reasons for skipping the whole wave: `disabled` / `no-words` / `scoped-run` / `no-placeholders`. `None` means the call was actually made.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<String>,
    /// Number of speakers awaiting a name (the name is still a placeholder and the speaker still has words in the body).
    pub targets: u32,
    /// Number of calls (including retry rounds).
    pub calls: u32,
    /// Number of speakers for whom the model gave a name (including those the engine rejected).
    pub proposed: u32,
    /// Number of speakers actually written to `speakers[].name`.
    pub named: u32,
    /// Number of speakers for whom the model explicitly answered `?` (insufficient evidence).
    pub unknown: u32,
    /// If the rounds are exhausted with no usable answer, the whole wave yields nothing.
    pub rejected: bool,
    /// Persisted real names, `(speaker id, name)`, sorted by id ascending.
    pub names: Vec<(String, String)>,
}

/// Evidence plan for one speaker-names wave.
#[derive(Debug, Clone, PartialEq)]
pub struct SpeakerNamesPlan {
    /// Speakers awaiting a name: `(speaker id, label)`, in the order their label first appears in the document.
    pub targets: Vec<(String, String)>,
    /// Full label table for the whole transcript. Single-speaker documents also get labels (see [`SpeakerLabels::from_words_allow_single`]).
    pub labels: SpeakerLabels,
    /// Word range (half-open) of the opening-remarks evidence.
    pub opening: std::ops::Range<usize>,
    /// First-appearance evidence range for each speaker awaiting a name, in the same order as `targets`. A speaker who falls inside the opening window is `None`, because their evidence is already in the opening remarks and is not sent again.
    pub spotlights: Vec<Option<std::ops::Range<usize>>>,
}

/// Filters the speakers awaiting a name and plans their evidence windows.
///
/// Awaiting a name means the name is still a placeholder ([`is_placeholder_name`]) **and** the speaker still has words in `doc.words`. The second condition is required. `speaker-repair` may absorb a false cluster entirely, leaving a speaker entry with zero words, and naming it would mean inventing a person out of nothing.
pub fn plan_speaker_names(doc: &TranscriptDoc) -> SpeakerNamesPlan {
    let labels = SpeakerLabels::from_words_allow_single(&doc.words);
    let opening_end = doc.words.len().min(SPEAKER_NAMES_OPENING_WORDS);
    let mut targets: Vec<(String, String)> = Vec::new();
    let mut spotlights: Vec<Option<std::ops::Range<usize>>> = Vec::new();
    // Iterate in the label table's order, so the label order in the answer matches the payload.
    for (id, speaker) in &doc.speakers {
        if !is_placeholder_name(&speaker.name, id) {
            continue;
        }
        let Some(label) = labels.label(id) else {
            continue;
        };
        let Some(first) = doc.words.iter().position(|word| &word.sp == id) else {
            continue;
        };
        targets.push((id.clone(), label.to_owned()));
        spotlights.push(if first < opening_end {
            None
        } else {
            let start = first.saturating_sub(SPEAKER_NAMES_CONTEXT_WORDS);
            let end = doc
                .words
                .len()
                .min(first.saturating_add(SPEAKER_NAMES_SPEAKER_WORDS));
            Some(start..end)
        });
    }
    // Labels are `S<number>`. Sorting by the number gives the "speaker number in the document" order.
    let mut order: Vec<usize> = (0..targets.len()).collect();
    order.sort_by_key(|&index| label_number(&targets[index].1));
    let sorted_targets = order.iter().map(|&index| targets[index].clone()).collect();
    let sorted_spotlights = order
        .iter()
        .map(|&index| spotlights[index].clone())
        .collect();
    SpeakerNamesPlan {
        targets: sorted_targets,
        labels,
        opening: 0..opening_end,
        spotlights: sorted_spotlights,
    }
}

/// `S12` → 12. Anything unparseable (should not happen in theory) sorts last.
fn label_number(label: &str) -> usize {
    label
        .trim_start_matches(['S', 's'])
        .parse::<usize>()
        .unwrap_or(usize::MAX)
}

fn timecode(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    format!(
        "{:02}:{:02}:{:02}",
        total / 3600,
        (total / 60) % 60,
        total % 60
    )
}

/// Renders the evidence payload (the file-v1 plain-text carrier for `speaker-names`).
pub fn render_speaker_names_page(doc: &TranscriptDoc, plan: &SpeakerNamesPlan) -> String {
    let labels = Some(&plan.labels);
    let mut out = String::new();
    let opening = &doc.words[plan.opening.clone()];
    out.push_str(&format!(
        "{FENCE_OPENING} | {} words | speakers {}>>>\n",
        opening.len(),
        plan.labels.all_labels().join(",")
    ));
    // The speaker who starts the opening remarks has no switch marker, so one is added explicitly. Otherwise the model cannot tell who said the first segment.
    if let Some(first) = opening.first()
        && let Some(label) = plan.labels.label(&first.sp)
    {
        out.push_str(&format!("⏹{label} "));
    }
    out.push_str(&marked_text_labeled(opening, labels));
    out.push('\n');
    out.push_str(FENCE_OPENING_END);
    out.push('\n');
    for ((_, label), spotlight) in plan.targets.iter().zip(&plan.spotlights) {
        let Some(range) = spotlight else {
            continue;
        };
        let words = &doc.words[range.clone()];
        let at = words.first().map(|word| word.t0).unwrap_or_default();
        out.push('\n');
        out.push_str(&format!(
            "{FENCE_SPEAKER} {label} | first speaks around {} | {} words>>>\n",
            timecode(at),
            words.len()
        ));
        if let Some(first) = words.first()
            && let Some(label) = plan.labels.label(&first.sp)
        {
            out.push_str(&format!("⏹{label} "));
        }
        out.push_str(&marked_text_labeled(words, labels));
        out.push('\n');
        out.push_str(FENCE_SPEAKER_END);
        out.push('\n');
    }
    out.push('\n');
    out.push_str(FENCE_ASK);
    out.push('\n');
    for (_, label) in &plan.targets {
        out.push_str(label);
        out.push('\n');
    }
    out.push_str(FENCE_ASK_END);
    out.push('\n');
    out
}

/// Labels asked about in the payload (the `<<<NAMES-ASK>>>` block), in payload order.
///
/// This is the **only** source of the expected set, shared by lint and engine. The agent side only has the payload and the answer, not `SpeakerNamesPlan`.
pub fn speaker_names_asked(payload: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut inside = false;
    for line in payload.lines() {
        let line = line.trim();
        if line == FENCE_ASK {
            inside = true;
            continue;
        }
        if line == FENCE_ASK_END {
            break;
        }
        if inside && !line.is_empty() {
            out.push(line.to_owned());
        }
    }
    out
}

/// Parse result: same order as the labels asked in the payload. `None` means the model answered `?`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SpeakerNamesParsed {
    /// `(label, name)`. Empty when the whole answer is unusable.
    pub names: Vec<(String, Option<String>)>,
    pub problems: Vec<Problem>,
}

/// Whether a name is acceptable: non-empty, single line, not overlong, no `=`, and not itself a placeholder name.
fn valid_name(label: &str, name: &str) -> Result<(), &'static str> {
    if name.is_empty() {
        return Err("名字为空——证据不足时回 `?`，不要回空值");
    }
    if name.chars().count() > SPEAKER_NAMES_MAX_NAME_CHARS {
        return Err("名字超过长度上限——只回名字本身，不要复述介绍语");
    }
    if name.contains('=') || name.contains('\t') {
        return Err("名字含非法字符（`=` / 制表符）");
    }
    if is_placeholder_name(name, label) {
        return Err("名字仍是占位标签（`S1` / `Speaker 1`）——证据不足时回 `?`");
    }
    Ok(())
}

/// Parses and validates the answer. Every criterion is arithmetic or string-level: the label set must be **exactly equal** to the labels the payload asked about, with no duplicates, and each value must be either `?` or a valid name. If any condition fails, the whole answer is unusable. This wave makes only one call, so "partial acceptance" has no meaning here. Resending once is more economical than landing half the names.
pub fn parse_speaker_names_page(payload: &str, answer: &str) -> SpeakerNamesParsed {
    let asked = speaker_names_asked(payload);
    let mut parsed = SpeakerNamesParsed::default();
    let Some(body) = fenced_body(answer) else {
        parsed.problems.push(Problem {
            code: ProblemCode::DocumentWrapped,
            scope: ProblemScope::Document,
            detail: format!("答案必须整段包在 `{FENCE_NAMES}` … `{FENCE_NAMES_END}` 之间"),
        });
        return parsed;
    };
    let mut seen: Vec<(String, Option<String>)> = Vec::new();
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Some((label, value)) = line.split_once('=') else {
            parsed.problems.push(Problem {
                code: ProblemCode::SpeakerNameInvalid,
                scope: ProblemScope::Document,
                detail: format!("`{line}` 不是 `标签 = 名字` 形式"),
            });
            return parsed;
        };
        let label = label.trim().to_ascii_uppercase();
        let value = value.trim();
        if !asked
            .iter()
            .any(|wanted| wanted.eq_ignore_ascii_case(&label))
        {
            parsed.problems.push(Problem {
                code: ProblemCode::UnknownId,
                scope: ProblemScope::Document,
                detail: format!("`{label}` 不在被问的标签里（{}）", asked.join(", ")),
            });
            return parsed;
        }
        if seen.iter().any(|(seen_label, _)| *seen_label == label) {
            parsed.problems.push(Problem {
                code: ProblemCode::DuplicateId,
                scope: ProblemScope::Document,
                detail: format!("`{label}` 出现了多次，每个标签只回一行"),
            });
            return parsed;
        }
        if value == UNKNOWN_ANSWER {
            seen.push((label, None));
            continue;
        }
        if let Err(reason) = valid_name(&label, value) {
            parsed.problems.push(Problem {
                code: ProblemCode::SpeakerNameInvalid,
                scope: ProblemScope::Document,
                detail: format!("`{label}` 的答案不合法：{reason}"),
            });
            return parsed;
        }
        seen.push((label, Some(value.to_owned())));
    }
    let missing: Vec<&str> = asked
        .iter()
        .filter(|wanted| {
            !seen
                .iter()
                .any(|(label, _)| label.eq_ignore_ascii_case(wanted))
        })
        .map(String::as_str)
        .collect();
    if !missing.is_empty() {
        parsed.problems.push(Problem {
            code: ProblemCode::MissingId,
            scope: ProblemScope::Document,
            detail: format!(
                "缺少标签 {}——每个被问到的标签都要回一行，不知道就回 `?`",
                missing.join(", ")
            ),
        });
        return parsed;
    }
    parsed.names = seen;
    parsed
}

/// Gets the body between `<<<NAMES>>>` and `<<<NAMES-END>>>`. Returns `None` if the fence is missing.
fn fenced_body(answer: &str) -> Option<String> {
    let mut inside = false;
    let mut closed = false;
    let mut body = String::new();
    for line in answer.lines() {
        let trimmed = line.trim();
        if trimmed == FENCE_NAMES {
            inside = true;
            body.clear();
            continue;
        }
        if trimmed == FENCE_NAMES_END {
            if !inside {
                return None;
            }
            closed = true;
            break;
        }
        if inside {
            body.push_str(line);
            body.push('\n');
        }
    }
    (inside && closed).then_some(body)
}

/// Mirror lint on the agent side for speaker-names answers submitted through `task submit`.
pub fn lint_agent_answer_speaker_names(payload: &str, answer: &str) -> Vec<String> {
    parse_speaker_names_page(payload, answer)
        .problems
        .iter()
        .map(|problem| format!("{}: {}", problem.code.as_str(), problem.detail))
        .collect()
}

/// System prompt. Unlike [`super::speaker_repair::speaker_repair_system_prompt`], this **must** receive the project and source metadata and the named entities from analysis. Third-party introductions often give the full name only in the title, channel name or description ("Andrew Ng"), while the body has only "Andrew".
pub fn speaker_names_system_prompt(
    reference_context: Option<&str>,
    summary: Option<&str>,
    named_entities: &[String],
) -> String {
    let mut prompt = format!(
        r#"You identify WHO IS SPEAKING in a transcript whose speakers are still anonymous.

Automatic diarization only produces voice ids (S1, S2 …). Your job is to attach a real name to each anonymous speaker USING THE EVIDENCE BELOW AND NOTHING ELSE.

The payload contains the opening of the transcript, then one excerpt per speaker you are asked about, then the list of labels to answer. `⏹S2` marks the point where S2 starts talking; `⏸` marks a pause. Both are metadata — never copy them back.

Answer with ONE LINE PER ASKED LABEL, wrapped in the fences, and NOTHING else:

{FENCE_NAMES}
S1 = Jordan Wilson
S2 = Andrew Ng
{FENCE_NAMES_END}

Rules:
- Answer every asked label exactly once, in the order they are asked. No extra labels.
- Give the person's name as it is actually used in this material — usually the full name ("Andrew Ng"), otherwise the form that appears ("Andrew"). Keep the original script and spelling; do not translate or transliterate a name.
- Evidence that counts: a self-introduction ("my name is …", "我是…"), an introduction by the other side ("today I'm joined by …", "有请…", "welcome, …"), being addressed by name ("Andrew, what do you think"), a sign-off, or the project/source metadata below when it unambiguously names one of the voices.
- When the speaker has no name in the evidence but the material clearly states their role (the host of a named show, the interviewer, the narrator), a short role label is acceptable — never invent one from the mere shape of the conversation.
- If you cannot name a speaker from the evidence, answer `{UNKNOWN_ANSWER}`. Guessing is strictly worse than `{UNKNOWN_ANSWER}`: a wrong name is shown to the user on every subtitle line and in the exported file.
- Never answer with a placeholder such as `S1`, `Speaker 1`, `Unknown`, `未知` — those are exactly what `{UNKNOWN_ANSWER}` is for.
- Do not add titles, honorifics, affiliations, parentheses, quotes or explanations. The name only, at most {SPEAKER_NAMES_MAX_NAME_CHARS} characters."#
    );
    if let Some(context) = reference_context.map(str::trim).filter(|s| !s.is_empty()) {
        prompt.push_str("\n\nProject / source metadata:\n");
        prompt.push_str(context);
    }
    if let Some(summary) = summary.map(str::trim).filter(|s| !s.is_empty()) {
        prompt.push_str("\n\nWhat this material is about:\n");
        prompt.push_str(summary);
    }
    if !named_entities.is_empty() {
        prompt.push_str("\n\nNames and proper nouns already extracted from this material (a speaker's name is often among them, but many of these are merely mentioned, not present):\n");
        prompt.push_str(&named_entities.join(", "));
    }
    prompt
}

/// speaker-names wave. Returns whether any name was actually written.
///
/// The whole wave is skipped when `enabled=false`, the document is empty, the run is a targeted re-polish (`scoped`), or there are no placeholder speakers. `report.skipped` gives the reason. When an answer is rejected, the request is resent up to [`SPEAKER_NAMES_MAX_ROUNDS`] rounds. If it is still unusable, the placeholder names are kept (`report.rejected`).
///
/// Only `speakers[<id>].name` is written, and **only placeholders are overwritten**. The placeholder test is read twice within one wave (at planning time and again before writing to disk), so a speaker whose name the user changed in between is not overwritten.
pub fn speaker_names_wave(
    doc: &mut TranscriptDoc,
    llm: &mut dyn LlmJson,
    enabled: bool,
    scoped: bool,
    reference_context: Option<&str>,
    summary: Option<&str>,
    named_entities: &[String],
    report: &mut SpeakerNamesReport,
    on_attempt: &mut dyn FnMut(&PageAttempt<'_>),
) -> Result<bool, LlmError> {
    if !enabled {
        report.skipped = Some("disabled".to_owned());
        return Ok(false);
    }
    if doc.words.is_empty() {
        report.skipped = Some("no-words".to_owned());
        return Ok(false);
    }
    if scoped {
        report.skipped = Some("scoped-run".to_owned());
        return Ok(false);
    }
    let plan = plan_speaker_names(doc);
    if plan.targets.is_empty() {
        report.skipped = Some("no-placeholders".to_owned());
        return Ok(false);
    }
    report.targets = plan.targets.len() as u32;
    let payload = render_speaker_names_page(doc, &plan);
    let system = speaker_names_system_prompt(reference_context, summary, named_entities);
    let mut retry_reason: Option<String> = None;
    let mut answer: Option<Vec<(String, Option<String>)>> = None;
    for round in 1..=SPEAKER_NAMES_MAX_ROUNDS {
        let request = LlmRequest {
            kind: "speaker-names",
            system: system.clone(),
            user: payload.clone(),
            temperature: 0.0,
            attempt: round,
            retry_reason: retry_reason.take(),
        };
        report.calls += 1;
        let raw = match llm.complete_batch(std::slice::from_ref(&request)).pop() {
            Some(Ok(raw)) => raw,
            Some(Err(error)) if error.is_retryable() => continue,
            Some(Err(error)) => return Err(error),
            // The host returned an empty batch. Treat it as a non-retryable protocol failure and keep the placeholder names.
            None => break,
        };
        let parsed = parse_speaker_names_page(&payload, &raw);
        on_attempt(&PageAttempt {
            page_id: &format!("sn-{round:03}"),
            attempt: round,
            input: &payload,
            output: &raw,
            problems: &parsed.problems,
            accepted: !parsed.names.is_empty(),
        });
        if !parsed.names.is_empty() {
            answer = Some(parsed.names);
            break;
        }
        retry_reason = Some(format!(
            "[{}] {}",
            parsed
                .problems
                .first()
                .map(|problem| problem.code.as_str())
                .unwrap_or("speaker-name-invalid"),
            parsed
                .problems
                .first()
                .map(|problem| problem.detail.as_str())
                .unwrap_or("答案不可用，请按契约只回 `标签 = 名字` 行")
        ));
    }
    let Some(names) = answer else {
        report.rejected = true;
        return Ok(false);
    };
    let mut changed = false;
    for (label, name) in names {
        let Some(name) = name else {
            report.unknown += 1;
            continue;
        };
        report.proposed += 1;
        let Some(id) = plan.labels.speaker_for_label(&label).map(str::to_owned) else {
            continue;
        };
        let Some(speaker) = doc.speakers.get_mut(&id) else {
            continue;
        };
        // Re-check the placeholder test before writing to disk. A speaker whose name the user has changed is never overwritten.
        if !is_placeholder_name(&speaker.name, &id) {
            continue;
        }
        speaker.name = name.clone();
        report.names.push((id, name));
        report.named += 1;
        changed = true;
    }
    report.names.sort();
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::doc::{DocEngine, DocMedia, Speaker, Word};

    fn word(index: usize, text: &str, sp: &str) -> Word {
        let t0 = index as f64 * 0.4;
        Word {
            id: format!("w{index}"),
            t0,
            t1: t0 + 0.35,
            text: text.to_owned(),
            sp: sp.to_owned(),
            glue: false,
        }
    }

    /// The host introduces the guest in the opening remarks. The evidence is in the opening, but the guest's name is spoken only by **the other party**.
    fn interview(ids: [&str; 2], names: [&str; 2]) -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: None,
                hash: String::new(),
                duration: 60.0,
                sample_rate: None,
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        for (id, name) in ids.iter().zip(names) {
            doc.speakers.insert(
                (*id).to_owned(),
                Speaker {
                    name: name.to_owned(),
                    hue: None,
                },
            );
        }
        let script: Vec<(&str, usize)> = vec![
            ("Welcome", 0),
            ("back.", 0),
            ("Today", 0),
            ("I'm", 0),
            ("joined", 0),
            ("by", 0),
            ("Andrew", 0),
            ("Ng.", 0),
            ("Thanks", 1),
            ("for", 1),
            ("having", 1),
            ("me,", 1),
            ("Jordan.", 1),
        ];
        doc.words = script
            .into_iter()
            .enumerate()
            .map(|(index, (text, who))| word(index, text, ids[who]))
            .collect();
        doc
    }

    fn answer(lines: &[&str]) -> String {
        format!("{FENCE_NAMES}\n{}\n{FENCE_NAMES_END}\n", lines.join("\n"))
    }

    /// Fake LLM that replays its responses in order.
    struct Scripted {
        answers: Vec<String>,
        seen: Vec<LlmRequest>,
    }

    impl LlmJson for Scripted {
        fn complete(&mut self, request: &LlmRequest) -> Result<String, LlmError> {
            self.seen.push(request.clone());
            if self.answers.is_empty() {
                return Err(LlmError::Malformed("no more scripted answers".to_owned()));
            }
            Ok(self.answers.remove(0))
        }
    }

    fn run(
        doc: &mut TranscriptDoc,
        llm: &mut Scripted,
        enabled: bool,
        scoped: bool,
    ) -> (bool, SpeakerNamesReport) {
        let mut report = SpeakerNamesReport::default();
        let changed = speaker_names_wave(
            doc,
            llm,
            enabled,
            scoped,
            None,
            None,
            &[],
            &mut report,
            &mut |_| {},
        )
        .unwrap();
        (changed, report)
    }

    #[test]
    fn plan_targets_placeholders_that_still_have_words() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        // speaker-repair absorbed s3's false cluster entirely, leaving a single entry with zero words.
        doc.speakers.insert(
            "s3".to_owned(),
            Speaker {
                name: "S03".to_owned(),
                hue: None,
            },
        );
        let plan = plan_speaker_names(&doc);
        assert_eq!(
            plan.targets,
            vec![
                ("s1".to_owned(), "S1".to_owned()),
                ("s2".to_owned(), "S2".to_owned())
            ]
        );
    }

    #[test]
    fn plan_skips_speakers_the_user_already_named() {
        let doc = interview(["s1", "s2"], ["Jordan Wilson", "S02"]);
        let plan = plan_speaker_names(&doc);
        assert_eq!(plan.targets, vec![("s2".to_owned(), "S2".to_owned())]);
    }

    #[test]
    fn single_speaker_document_still_gets_a_label() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        for w in &mut doc.words {
            w.sp = "s1".to_owned();
        }
        doc.speakers.remove("s2");
        let plan = plan_speaker_names(&doc);
        assert_eq!(plan.targets, vec![("s1".to_owned(), "S1".to_owned())]);
        let payload = render_speaker_names_page(&doc, &plan);
        assert_eq!(speaker_names_asked(&payload), vec!["S1".to_owned()]);
    }

    #[test]
    fn payload_asks_every_target_and_carries_the_opening() {
        let doc = interview(["s1", "s2"], ["S01", "S02"]);
        let plan = plan_speaker_names(&doc);
        let payload = render_speaker_names_page(&doc, &plan);
        assert_eq!(
            speaker_names_asked(&payload),
            vec!["S1".to_owned(), "S2".to_owned()]
        );
        assert!(payload.contains("Today I'm joined by Andrew Ng."));
        // The speaker of the opening sentence is marked explicitly, so the model can tell who said the first segment.
        assert!(payload.contains("⏹S1 Welcome"));
        assert!(payload.contains("⏹S2"));
        // Both speakers are inside the opening window, so no separate first-appearance evidence block is sent.
        assert!(!payload.contains(FENCE_SPEAKER));
    }

    #[test]
    fn payload_adds_a_spotlight_for_a_late_speaker() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        let tail: Vec<Word> = (0..SPEAKER_NAMES_OPENING_WORDS)
            .map(|index| word(100 + index, "filler", "s1"))
            .collect();
        let late = word(9000, "Hi.", "s2");
        doc.words.retain(|w| w.sp == "s1");
        doc.words.extend(tail);
        doc.words.push(late);
        let plan = plan_speaker_names(&doc);
        assert_eq!(plan.spotlights[0], None);
        assert!(plan.spotlights[1].is_some());
        let payload = render_speaker_names_page(&doc, &plan);
        assert!(payload.contains(&format!("{FENCE_SPEAKER} S2 |")));
    }

    #[test]
    fn wave_writes_names_and_reports() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        let mut llm = Scripted {
            answers: vec![answer(&["S1 = Jordan Wilson", "S2 = Andrew Ng"])],
            seen: Vec::new(),
        };
        let (changed, report) = run(&mut doc, &mut llm, true, false);
        assert!(changed);
        assert_eq!(llm.seen.len(), 1);
        assert_eq!(llm.seen[0].kind, "speaker-names");
        assert_eq!(doc.speakers["s1"].name, "Jordan Wilson");
        assert_eq!(doc.speakers["s2"].name, "Andrew Ng");
        assert_eq!(report.skipped, None);
        assert_eq!((report.targets, report.calls, report.named), (2, 1, 2));
        assert_eq!(
            (report.proposed, report.unknown, report.rejected),
            (2, 0, false)
        );
        assert_eq!(
            report.names,
            vec![
                ("s1".to_owned(), "Jordan Wilson".to_owned()),
                ("s2".to_owned(), "Andrew Ng".to_owned())
            ]
        );
    }

    #[test]
    fn wave_maps_labels_back_through_the_label_table_not_the_digits() {
        // If the id is not `s<number>`, the label falls back to first-appearance order. `S2` does not imply id `s2`.
        let mut doc = interview(["spk-b", "spk-a"], ["S01", "S02"]);
        let plan = plan_speaker_names(&doc);
        assert_eq!(
            plan.targets,
            vec![
                ("spk-b".to_owned(), "S1".to_owned()),
                ("spk-a".to_owned(), "S2".to_owned())
            ]
        );
        let mut llm = Scripted {
            answers: vec![answer(&["S1 = Jordan Wilson", "S2 = Andrew Ng"])],
            seen: Vec::new(),
        };
        let (changed, _) = run(&mut doc, &mut llm, true, false);
        assert!(changed);
        assert_eq!(doc.speakers["spk-b"].name, "Jordan Wilson");
        assert_eq!(doc.speakers["spk-a"].name, "Andrew Ng");
    }

    #[test]
    fn wave_keeps_placeholder_when_the_model_answers_unknown() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        let mut llm = Scripted {
            answers: vec![answer(&["S1 = Jordan Wilson", "S2 = ?"])],
            seen: Vec::new(),
        };
        let (changed, report) = run(&mut doc, &mut llm, true, false);
        assert!(changed);
        assert_eq!(doc.speakers["s2"].name, "S02");
        assert_eq!((report.named, report.unknown), (1, 1));
    }

    #[test]
    fn wave_retries_once_then_accepts() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        let mut llm = Scripted {
            answers: vec![
                "S1 = Jordan Wilson\nS2 = Andrew Ng".to_owned(),
                answer(&["S1 = Jordan Wilson", "S2 = Andrew Ng"]),
            ],
            seen: Vec::new(),
        };
        let (changed, report) = run(&mut doc, &mut llm, true, false);
        assert!(changed);
        assert_eq!(report.calls, 2);
        assert_eq!(llm.seen[0].retry_reason, None);
        let retry = llm.seen[1].retry_reason.as_deref().unwrap_or_default();
        assert!(retry.contains("document-wrapped"), "{retry}");
        assert_eq!(doc.speakers["s2"].name, "Andrew Ng");
    }

    #[test]
    fn wave_gives_up_after_the_round_cap_and_keeps_placeholders() {
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        let mut llm = Scripted {
            answers: vec![
                answer(&["S1 = Jordan Wilson"]),
                answer(&["S9 = Nobody"]),
                answer(&["S1 = Jordan Wilson", "S2 = Andrew Ng"]),
            ],
            seen: Vec::new(),
        };
        let (changed, report) = run(&mut doc, &mut llm, true, false);
        assert!(!changed);
        assert!(report.rejected);
        assert_eq!(report.calls, SPEAKER_NAMES_MAX_ROUNDS);
        assert_eq!(doc.speakers["s1"].name, "S01");
        assert_eq!(doc.speakers["s2"].name, "S02");
    }

    #[test]
    fn wave_skips_when_disabled_scoped_or_without_placeholders() {
        for (enabled, scoped, names, reason) in [
            (false, false, ["S01", "S02"], "disabled"),
            (true, true, ["S01", "S02"], "scoped-run"),
            (
                true,
                false,
                ["Jordan Wilson", "Andrew Ng"],
                "no-placeholders",
            ),
        ] {
            let mut doc = interview(["s1", "s2"], names);
            let mut llm = Scripted {
                answers: Vec::new(),
                seen: Vec::new(),
            };
            let (changed, report) = run(&mut doc, &mut llm, enabled, scoped);
            assert!(!changed);
            assert_eq!(report.skipped.as_deref(), Some(reason));
            assert_eq!(report.calls, 0);
            assert!(llm.seen.is_empty());
        }
        let mut doc = interview(["s1", "s2"], ["S01", "S02"]);
        doc.words.clear();
        let mut llm = Scripted {
            answers: Vec::new(),
            seen: Vec::new(),
        };
        let (changed, report) = run(&mut doc, &mut llm, true, false);
        assert!(!changed);
        assert_eq!(report.skipped.as_deref(), Some("no-words"));
    }

    #[test]
    fn parse_accepts_the_contract_and_rejects_every_deviation() {
        let doc = interview(["s1", "s2"], ["S01", "S02"]);
        let payload = render_speaker_names_page(&doc, &plan_speaker_names(&doc));
        let good = answer(&["S1 = Jordan Wilson", "S2 = ?"]);
        let parsed = parse_speaker_names_page(&payload, &good);
        assert!(parsed.problems.is_empty());
        assert_eq!(
            parsed.names,
            vec![
                ("S1".to_owned(), Some("Jordan Wilson".to_owned())),
                ("S2".to_owned(), None)
            ]
        );
        assert!(lint_agent_answer_speaker_names(&payload, &good).is_empty());

        let long = "N".repeat(SPEAKER_NAMES_MAX_NAME_CHARS + 1);
        for (bad, code) in [
            (
                "S1 = Jordan Wilson\nS2 = Andrew Ng".to_owned(),
                "document-wrapped",
            ),
            (
                answer(&["S1 Jordan Wilson", "S2 = Andrew Ng"]),
                "speaker-name-invalid",
            ),
            (
                answer(&["S1 = Jordan Wilson", "S7 = Andrew Ng"]),
                "unknown-id",
            ),
            (
                answer(&["S1 = Jordan Wilson", "S1 = Andrew Ng"]),
                "duplicate-id",
            ),
            (answer(&["S1 = Jordan Wilson"]), "missing-id"),
            (answer(&["S1 = ", "S2 = Andrew Ng"]), "speaker-name-invalid"),
            (
                answer(&["S1 = Speaker 1", "S2 = Andrew Ng"]),
                "speaker-name-invalid",
            ),
            (
                answer(&[&format!("S1 = {long}"), "S2 = Andrew Ng"]),
                "speaker-name-invalid",
            ),
        ] {
            let parsed = parse_speaker_names_page(&payload, &bad);
            assert!(parsed.names.is_empty(), "{bad}");
            assert_eq!(
                parsed.problems.first().map(|problem| problem.code.as_str()),
                Some(code),
                "{bad}"
            );
            assert!(!lint_agent_answer_speaker_names(&payload, &bad).is_empty());
        }
    }

    #[test]
    fn system_prompt_carries_the_metadata_evidence() {
        let prompt = speaker_names_system_prompt(
            Some("Title: Andrew Ng on agentic AI"),
            Some("An interview about AI agents."),
            &["Andrew Ng".to_owned(), "Stanford".to_owned()],
        );
        assert!(prompt.contains("Title: Andrew Ng on agentic AI"));
        assert!(prompt.contains("An interview about AI agents."));
        assert!(prompt.contains("Andrew Ng, Stanford"));
        assert!(prompt.contains(FENCE_NAMES));
        // Empty metadata does not leave an empty title.
        let bare = speaker_names_system_prompt(Some("  "), None, &[]);
        assert!(!bare.contains("Project / source metadata"));
    }
}

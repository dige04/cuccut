//! Word tokenization written to disk (stage 0): ASR rows → §18 word-atom transcript.
//!
//! Matches voice-ink `DocBuilder`: if a row has real word timings, they are clamped monotonically into the row's window; otherwise they are synthesized by `wWeight` character weights. Words are then subdivided by atomize (CJK character by character, sub-id `~k`); the row-level speaker is pushed down to each word's `sp`; speaker-switch points snap to natural pauses; finally normalization and repair.

use std::collections::BTreeMap;

use crate::asr_rows::{RowIn, WordIn};

use crate::word_breaks::grapheme_count;

use crate::atomize::{
    atomize_words, ends_sentence, is_unspaced_script_char, script_glue_from_text, w_weight,
};
use crate::doc::{DocEngine, DocMedia, Speaker, TranscriptDoc, Word};
use crate::fingerprint::fingerprint;
use crate::timing::{normalize_doc_words, r2, word_timing_repair};

/// Minimum pause and search window for snapping a speaker-switch point (`DocBuilder.snapPause/snapWindow`).
const SPEAKER_SNAP_MIN_PAUSE: f64 = 0.25;
const SPEAKER_SNAP_WINDOW: f64 = 1.0;
/// Speaker hue wheel (`DocBuilder.speakerHues`).
const SPEAKER_HUES: [u32; 8] = [222, 152, 28, 282, 350, 82, 190, 330];

/// Whitespace split (`TranscriptModel.tokenize`).
fn tokenize(text: &str) -> Vec<String> {
    text.split_whitespace().map(str::to_owned).collect()
}

/// Fallback for when there are no real word timings: the row duration is split across tokens in proportion to `wWeight` (`wordsFromSegments`).
pub fn synthesize_words(text: &str, row_start: f64, row_end: f64) -> Vec<WordIn> {
    let tokens = tokenize(text);
    if tokens.is_empty() {
        return Vec::new();
    }
    let weights: Vec<f64> = tokens.iter().map(|token| w_weight(token)).collect();
    let total: f64 = weights.iter().sum::<f64>().max(1e-9);
    let duration = (row_end - row_start).max(0.01);
    let mut words = Vec::with_capacity(tokens.len());
    let mut accumulated = 0.0;
    for (token, weight) in tokens.into_iter().zip(weights) {
        let start = row_start + duration * (accumulated / total);
        accumulated += weight;
        let end = row_start + duration * (accumulated / total);
        words.push(WordIn {
            start: r2(start),
            end: r2(end),
            text: token,
        });
    }
    words
}

/// Intra-word atomization (`TranscriptModel.atomized`): CJK character by character, punctuation attached to the preceding character; for a word that splits into several atoms, time is divided in proportion to `wWeight`, with sub-ids `<id>~<k>`.
///
/// Words in Thai, Lao, Burmese and Khmer scripts are further split into words ([`atomize_words`]), and Tibetan is split at syllable marks. Later segments within a word carry a “glue to previous” flag (the source text has no space there), and time is apportioned by the number of grapheme clusters. The third item of the input is the marker between this transcribed word and the previous one ([`script_glue_from_text`]), and it falls on the word's first segment. Words that contain none of these scripts are byte-for-byte identical to before.
fn atomized(words: Vec<(String, WordIn, bool)>) -> Vec<(String, WordIn, bool)> {
    let mut output = Vec::with_capacity(words.len());
    for (id, word, glue) in words {
        let atoms = atomize_words(&word.text);
        if atoms.len() <= 1 {
            match atoms.into_iter().next() {
                Some((only, _)) => {
                    let mut fixed = word;
                    fixed.text = only;
                    output.push((id, fixed, glue));
                }
                None => output.push((id, word, glue)),
            }
            continue;
        }
        let by_graphemes = word.text.chars().any(is_unspaced_script_char);
        let weights: Vec<f64> = atoms
            .iter()
            .map(|(atom, _)| {
                if by_graphemes {
                    grapheme_count(atom).max(1) as f64
                } else {
                    w_weight(atom)
                }
            })
            .collect();
        let total: f64 = weights.iter().sum::<f64>().max(1e-9);
        let duration = (word.end - word.start).max(0.0);
        let mut accumulated = 0.0;
        let mut t0 = word.start;
        let count = atoms.len();
        for (k, (atom, atom_glue)) in atoms.into_iter().enumerate() {
            accumulated += weights[k];
            let t1 = if k == count - 1 {
                word.end
            } else {
                r2(word.start + duration * (accumulated / total))
            };
            let atom_id = if k == 0 {
                id.clone()
            } else {
                format!("{id}~{k}")
            };
            output.push((
                atom_id,
                WordIn {
                    start: t0,
                    end: t1.max(t0),
                    text: atom,
                },
                if k == 0 { glue } else { atom_glue },
            ));
            t0 = t1.max(t0);
        }
    }
    output
}

/// An already-timed word is split into atoms by the same rules as [`atomized`]: CJK character by character, punctuation attached to the preceding character, and for a multi-atom word the time is divided by character weight, with sub-ids `<id>~<k>`; `glue` falls on the first segment. Returns `(id, text, start, end, glue_to_previous)`; a word that need not be split is returned as one segment unchanged.
///
/// Subtitles use this when handing transcribed words to the rendering kernel: transcripts from before per-character write-out still contain multi-character words, and word-by-word animation still has to advance character by character.
pub fn atomize_timed_word(
    id: &str,
    text: &str,
    start: f64,
    end: f64,
    glue: bool,
) -> Vec<(String, String, f64, f64, bool)> {
    let word = WordIn {
        start,
        end,
        text: text.to_owned(),
    };
    atomized(vec![(id.to_owned(), word, glue)])
        .into_iter()
        .map(|(id, word, glue)| (id, word.text, word.start, word.end, glue))
        .collect()
}

/// Whether to touch the switch points again after row-level speaker labels have been pushed down to word `sp`.
///
/// The two strategies correspond to two sources of evidence, not to a “loose/strict” pair:
///
/// - [`SnapToPauses`](Self::SnapToPauses): the labels come from interval projections separate from the text (the traditional form of voice-ink `DocBuilder`, and intervals such as pyannote's “who is speaking when”). The boundary is only the maximum temporal overlap, so it often falls in the middle of a word. Two passes of snapping are used: short islands sandwiched between one speaker's words are merged back, and each switch point moves to the best pause or sentence end within ±1s.
/// - [`RowAuthoritative`](Self::RowAuthoritative): the label is the **text attribution verdict** that the joint ASR+diarization model (MOSS) gives while generating the text. Row boundaries are only timestamps with some slop. In this case snapping only does harm. In a measured 7h two-person interview, Pass 2 moved the “er” that opens an answer and the “a pair of experiences” that closes an answer over to the other speaker. Pass 1, in MOSS chunks with no punctuation, merged 142 real acknowledgements (「嗯」「哦是吗」「当然」, "mm", "oh really?", "of course") wholesale into the other person's sentence, because with no punctuation the preceding word is never sentence-final. With row-level attribution authoritative, no word moves. Time overlaps are left to [`word_timing_repair`], which clamps the timings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SpeakerBoundaryPolicy {
    #[default]
    SnapToPauses,
    RowAuthoritative,
}

/// rows → §18 word-atom transcript. `engine.aligned_words` says whether the engine has ever given real word timestamps. The synthesis path still meets all the time constraints, so consumers need not tell them apart.
///
/// Speaker switch points are handled by [`SpeakerBoundaryPolicy::SnapToPauses`]. When row-level labels come from the joint model (MOSS), pass [`SpeakerBoundaryPolicy::RowAuthoritative`] through [`build_doc_with_policy`].
pub fn build_doc(
    rows: &[RowIn],
    media: DocMedia,
    lang: &str,
    engine: DocEngine,
    created_at: Option<String>,
) -> TranscriptDoc {
    build_doc_with_policy(
        rows,
        media,
        lang,
        engine,
        created_at,
        SpeakerBoundaryPolicy::SnapToPauses,
    )
}

/// The explicit speaker-boundary policy form of [`build_doc`].
pub fn build_doc_with_policy(
    rows: &[RowIn],
    media: DocMedia,
    lang: &str,
    engine: DocEngine,
    created_at: Option<String>,
    speaker_policy: SpeakerBoundaryPolicy,
) -> TranscriptDoc {
    let mut doc = TranscriptDoc::new(media, lang, engine);
    doc.created_at = created_at;
    let duration = doc.media.duration;

    let mut sorted: Vec<&RowIn> = rows
        .iter()
        .filter(|row| !row.text.trim().is_empty())
        .collect();
    sorted.sort_by(|a, b| a.start.total_cmp(&b.start));

    let mut speaker_ids: BTreeMap<String, String> = BTreeMap::new();
    let mut speaker_order: Vec<(String, String)> = Vec::new(); // (speaker id, display name)

    for (row_index, row) in sorted.iter().enumerate() {
        let row_start = row.start.clamp(0.0, duration);
        let row_end = row.end.clamp(row_start, duration);
        let seg_id = format!("g{}", row_index + 1);

        let mut row_words: Vec<(String, WordIn, bool)> =
            match row.words.as_ref().filter(|words| !words.is_empty()) {
                Some(real) => {
                    // Clamp monotonically into the window (the aligner occasionally overshoots by one cell).
                    let mut previous = row_start;
                    let timed: Vec<(String, WordIn)> = real
                        .iter()
                        .enumerate()
                        .map(|(column, word)| {
                            let t0 = r2(row_end.min(previous.max(word.start)));
                            let t1 = r2(row_end.min(t0.max(word.end)));
                            previous = t0;
                            (
                                format!("{seg_id}.{column}"),
                                WordIn {
                                    start: t0,
                                    end: t1,
                                    text: word.text.trim().to_owned(),
                                },
                            )
                        })
                        .filter(|(_, word)| !word.text.is_empty())
                        .collect();
                    // When the engine gives timings per word (forced aligners such as the Thai one segment words before aligning): between words where the source text has no space, add a “glue to previous” marker from the line text.
                    let texts: Vec<&str> =
                        timed.iter().map(|(_, word)| word.text.as_str()).collect();
                    let glue = script_glue_from_text(&texts, &row.text)
                        .unwrap_or_else(|| vec![false; timed.len()]);
                    timed
                        .into_iter()
                        .zip(glue)
                        .map(|((id, word), glue)| (id, word, glue))
                        .collect()
                }
                None => synthesize_words(row.text.trim(), row_start, row_end)
                    .into_iter()
                    .enumerate()
                    .map(|(column, word)| (format!("{seg_id}.{column}"), word, false))
                    .collect(),
            };
        row_words = atomized(row_words);
        if row_words.is_empty() {
            continue;
        }

        let sp = match row.speaker.as_deref() {
            Some(label) => speaker_ids
                .entry(label.to_owned())
                .or_insert_with(|| {
                    let id = format!("s{}", speaker_order.len() + 1);
                    speaker_order.push((id.clone(), label.to_owned()));
                    id
                })
                .clone(),
            None => {
                if speaker_order.is_empty() {
                    speaker_order.push(("s1".to_owned(), "S1".to_owned()));
                }
                speaker_order[0].0.clone()
            }
        };
        let first = doc.words.len();
        for (index, (id, word, glue)) in row_words.into_iter().enumerate() {
            doc.words.push(Word {
                id,
                t0: word.start,
                t1: word.end,
                text: word.text,
                sp: sp.clone(),
                // The first word of a line is separated from the previous line by the line break, so it is not glued.
                glue: glue && index > 0,
            });
        }
        normalize_row(&mut doc.words[first..], row_start, row_end);
    }

    for (index, (id, name)) in speaker_order.into_iter().enumerate() {
        doc.speakers.insert(
            id,
            Speaker {
                name,
                hue: Some(SPEAKER_HUES[index % SPEAKER_HUES.len()]),
            },
        );
    }

    if speaker_policy == SpeakerBoundaryPolicy::SnapToPauses {
        snap_to_pauses(&mut doc.words);
    }
    word_timing_repair(&mut doc.words);

    doc.stages.asr = Some(fingerprint(&doc.words));
    doc.stages.asr_layout = Some(crate::layout::layout_fingerprint(&doc));
    doc
}

fn normalize_row(words: &mut [Word], row_start: f64, row_end: f64) {
    normalize_doc_words(words, row_start, row_end);
}

fn gap_at(words: &[Word], index: usize) -> f64 {
    (words[index].t0 - words[index - 1].t1).max(0.0)
}

/// Boundary scoring (`TranscriptBoundary.features`): score = gap + 0.6 sentence-end bonus.
fn boundary_score(words: &[Word], index: usize) -> Option<f64> {
    if index == 0 || index >= words.len() {
        return None;
    }
    let gap = gap_at(words, index);
    let bonus = if ends_sentence(&words[index - 1].text) {
        0.6
    } else {
        0.0
    };
    Some(gap + bonus)
}

/// Speaker switch-point snapping (`DocBuilder.snapToPauses`, two passes).
fn snap_to_pauses(words: &mut [Word]) {
    if words.len() < 2 {
        return;
    }
    // Pass 1: a short foreign island sandwiched in one speaker's run is absorbed back. [i, j) is a foreign speaker with the same speaker on both sides; if j-i < 4, total duration ≤ 1.2s, there is no pause before the island, and the preceding word is not sentence-final ⇒ merge it back.
    let mut i = 1;
    while i < words.len() {
        if words[i].sp == words[i - 1].sp {
            i += 1;
            continue;
        }
        let island_sp = words[i].sp.clone();
        let mut j = i;
        while j < words.len() && words[j].sp == island_sp {
            j += 1;
        }
        if j < words.len()
            && words[j].sp == words[i - 1].sp
            && j - i < 4
            && words[j - 1].t1 - words[i].t0 <= 1.2
            && gap_at(words, i) < SPEAKER_SNAP_MIN_PAUSE
            && !ends_sentence(&words[i - 1].text)
        {
            let host = words[i - 1].sp.clone();
            for word in &mut words[i..j] {
                word.sp = host.clone();
            }
        }
        i = j;
    }
    // Pass 2: among the remaining switch points, pick the best pause or sentence boundary within a ±1s window.
    let boundaries: Vec<usize> = (1..words.len())
        .filter(|&index| words[index].sp != words[index - 1].sp)
        .collect();
    for boundary in boundaries {
        let boundary_time = words[boundary].t0;
        if gap_at(words, boundary) >= SPEAKER_SNAP_MIN_PAUSE
            || ends_sentence(&words[boundary - 1].text)
        {
            continue; // Already on a natural boundary
        }
        let mut best: Option<(usize, f64)> = None; // (candidate cut point, score)
        // Leftward: candidate j; words[..j] stay with the left-side speaker.
        let mut j = boundary;
        while j >= 1 && words[j - 1].sp == words[boundary - 1].sp {
            if (boundary_time - words[j].t0).abs() > SPEAKER_SNAP_WINDOW {
                break;
            }
            if j != boundary
                && let Some(score) = boundary_score(words, j)
                && best.is_none_or(|(_, best_score)| score > best_score)
            {
                best = Some((j, score));
            }
            if j == 1 {
                break;
            }
            j -= 1;
        }
        // Rightward: candidate j; words[boundary..j] go to the left-side speaker.
        let mut j = boundary + 1;
        while j < words.len() && words[j].sp == words[boundary].sp {
            if (words[j].t0 - boundary_time).abs() > SPEAKER_SNAP_WINDOW {
                break;
            }
            if let Some(score) = boundary_score(words, j)
                && best.is_none_or(|(_, best_score)| score > best_score)
            {
                best = Some((j, score));
            }
            j += 1;
        }
        if let Some((snap, _)) = best {
            let accept = gap_at(words, snap) >= SPEAKER_SNAP_MIN_PAUSE
                || ends_sentence(&words[snap - 1].text);
            if !accept {
                continue;
            }
            if snap < boundary {
                let sp = words[boundary].sp.clone();
                for word in &mut words[snap..boundary] {
                    word.sp = sp.clone();
                }
            } else if snap > boundary {
                let sp = words[boundary - 1].sp.clone();
                for word in &mut words[boundary..snap] {
                    word.sp = sp.clone();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn media() -> DocMedia {
        DocMedia {
            id: None,
            path: Some("talk.wav".to_owned()),
            hash: "sha256-00".to_owned(),
            duration: 100.0,
            sample_rate: Some(16_000),
        }
    }

    fn engine() -> DocEngine {
        DocEngine {
            name: "test".to_owned(),
            version: None,
            aligned_words: false,
        }
    }

    #[test]
    fn synthesized_words_cover_row_and_stay_monotone() {
        let words = synthesize_words("hello there world", 1.0, 3.0);
        assert_eq!(words.len(), 3);
        assert_eq!(words.first().unwrap().start, 1.0);
        assert_eq!(words.last().unwrap().end, 3.0);
        for pair in words.windows(2) {
            assert!(pair[0].end <= pair[1].start + 1e-9);
        }
    }

    #[test]
    fn build_splits_cjk_rows_per_character_with_tilde_ids() {
        let doc = build_doc(
            &[RowIn::new(0.0, 2.0, "大家好")],
            media(),
            "zh",
            engine(),
            None,
        );
        doc.validate().unwrap();
        let ids: Vec<&str> = doc.words.iter().map(|word| word.id.as_str()).collect();
        assert_eq!(ids, vec!["g1.0", "g1.0~1", "g1.0~2"]);
        let texts: Vec<&str> = doc.words.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, vec!["大", "家", "好"]);
        assert_eq!(doc.words[0].t0, 0.0);
        assert_eq!(doc.words[2].t1, 2.0);
    }

    #[test]
    fn timed_words_split_per_character_like_the_build() {
        let atoms = atomize_timed_word("w1", "大家好。", 1.0, 1.6, true);
        let ids: Vec<&str> = atoms.iter().map(|a| a.0.as_str()).collect();
        assert_eq!(ids, vec!["w1", "w1~1", "w1~2"]);
        let texts: Vec<&str> = atoms.iter().map(|a| a.1.as_str()).collect();
        assert_eq!(texts, vec!["大", "家", "好。"]);
        assert_eq!((atoms[0].2, atoms[2].3), (1.0, 1.6));
        for pair in atoms.windows(2) {
            assert!(pair[0].3 <= pair[1].2 + 1e-9);
        }
        assert!(atoms[0].4 && !atoms[1].4);
        // Western words and single characters are each kept as one segment.
        assert_eq!(
            atomize_timed_word("w2", "Labs.", 0.0, 1.0, false),
            vec![("w2".into(), "Labs.".into(), 0.0, 1.0, false)]
        );
        assert_eq!(atomize_timed_word("w3", "了。", 0.0, 1.0, false).len(), 1);
    }

    fn joined(doc: &TranscriptDoc) -> String {
        crate::atomize::join_word_texts(doc.words.iter())
    }

    /// Thai line (the engine gives only the line text): phrases are split into words; later segments within a word carry the “glue to previous” marker; time is apportioned by grapheme clusters within the phrase's time window. Read back, it is identical to the line text, and the spaces between phrases remain.
    #[test]
    fn build_splits_thai_phrases_into_glued_words() {
        let text = "ลลิตาไม่ได้ยกเลิกการประชุม แต่เลื่อนไปเป็นวันพฤหัสบดี";
        let doc = build_doc(&[RowIn::new(0.0, 6.0, text)], media(), "th", engine(), None);
        doc.validate().unwrap();
        assert_eq!(joined(&doc), text);
        assert!(doc.words.len() >= 6, "{:?}", doc.words);
        assert!(!doc.words[0].glue);
        let second_phrase = doc
            .words
            .iter()
            .position(|word| word.text.starts_with("แต่"))
            .unwrap();
        assert!(
            !doc.words[second_phrase].glue,
            "the space between phrases stays"
        );
        assert!(doc.words[1..second_phrase].iter().all(|word| word.glue));
        assert!(doc.words[1].id.starts_with("g1.0~"));
        for pair in doc.words.windows(2) {
            assert!(pair[0].t1 <= pair[1].t0 + 1e-9);
        }
    }

    /// The forced aligner segments Thai before aligning, and the engine gives time per word. Markers are added between words from the line text, and the engine's times are used. Without this step, the words stand alone, and joining them adds a space between words (`join_word_texts` adds one space between two unmarked Thai words).
    #[test]
    fn build_glues_engine_timed_thai_words_from_the_row_text() {
        let text = "ลลิตาไม่ได้ยกเลิก การประชุม";
        let mut row = RowIn::new(0.0, 4.0, text);
        row.words = Some(
            [
                ("ลลิตา", 0.0, 0.8),
                ("ไม่ได้", 0.8, 1.4),
                ("ยกเลิก", 1.4, 2.2),
                ("การประชุม", 2.6, 4.0),
            ]
            .iter()
            .map(|(text, start, end)| WordIn {
                start: *start,
                end: *end,
                text: (*text).to_owned(),
            })
            .collect(),
        );
        assert_eq!(
            crate::atomize::join_word_texts(["ลลิตา", "ไม่ได้"]),
            "ลลิตา ไม่ได้",
            "unglued Thai words are joined with a space"
        );
        let doc = build_doc(&[row], media(), "th", engine(), None);
        doc.validate().unwrap();
        assert_eq!(joined(&doc), text);
        let first = |prefix: &str| {
            doc.words
                .iter()
                .find(|word| word.text.starts_with(prefix))
                .unwrap()
        };
        assert!(first("ไม่").glue);
        assert!(first("ยก").glue);
        assert!(!first("การ").glue);
        assert_eq!(first("การ").t0, 2.6);
    }

    /// Lines without these scripts are byte-for-byte identical to before: no markers.
    #[test]
    fn build_leaves_other_scripts_unglued() {
        for (text, lang) in [
            ("hello there, world", "en"),
            ("大家好，今天", "zh"),
            ("저는 내일 아이폰을 샀다.", "ko"),
            ("اشترينا 2.5 كيلوغرام من الأرز،", "ar"),
            ("मैंने कल किताब पढ़ी।", "hi"),
        ] {
            let doc = build_doc(&[RowIn::new(0.0, 3.0, text)], media(), lang, engine(), None);
            assert!(doc.words.iter().all(|word| !word.glue), "{text}");
        }
    }

    /// Korean is split into words at spaces: one eojeol is one word, not split into syllables, and no “glue to previous” marker. Read back, all the spaces are there.
    #[test]
    fn build_keeps_korean_rows_one_word_per_space_delimited_unit() {
        let doc = build_doc(
            &[RowIn::new(0.0, 3.0, "저는 내일 아이폰을 샀다.")],
            media(),
            "ko",
            engine(),
            None,
        );
        doc.validate().unwrap();
        let texts: Vec<&str> = doc.words.iter().map(|word| word.text.as_str()).collect();
        assert_eq!(texts, vec!["저는", "내일", "아이폰을", "샀다."]);
        assert!(doc.words.iter().all(|word| !word.glue));
        assert_eq!(
            crate::atomize::join_word_texts(doc.words.iter()),
            "저는 내일 아이폰을 샀다."
        );
        let json = serde_json::to_vec(&doc).unwrap();
        let read = TranscriptDoc::from_json(&json).unwrap();
        assert_eq!(read.words, doc.words);
    }

    #[test]
    fn build_assigns_row_column_ids_speakers_and_hues() {
        let mut row_a = RowIn::new(0.0, 2.0, "hello there");
        row_a.speaker = Some("S1".to_owned());
        let mut row_b = RowIn::new(3.0, 5.0, "good bye");
        row_b.speaker = Some("S2".to_owned());
        let doc = build_doc(&[row_a, row_b], media(), "en", engine(), None);
        doc.validate().unwrap();
        assert_eq!(doc.words[0].id, "g1.0");
        assert_eq!(doc.words[2].id, "g2.0");
        assert_eq!(doc.words[0].sp, "s1");
        assert_eq!(doc.words[2].sp, "s2");
        assert_eq!(doc.speakers["s1"].hue, Some(222));
        assert_eq!(doc.speakers["s2"].hue, Some(152));
        assert!(doc.stages.asr.is_some());
        assert!(doc.stages.asr_layout.is_some());
    }

    #[test]
    fn build_without_speakers_uses_constant_s1() {
        let doc = build_doc(
            &[RowIn::new(0.0, 1.0, "hi there")],
            media(),
            "en",
            engine(),
            None,
        );
        doc.validate().unwrap();
        assert!(doc.words.iter().all(|word| word.sp == "s1"));
    }

    #[test]
    fn real_word_times_are_kept_and_clamped_into_row() {
        let mut row = RowIn::new(1.0, 2.0, "hello world");
        row.words = Some(vec![
            WordIn {
                start: 0.8,
                end: 1.5,
                text: "hello".to_owned(),
            },
            WordIn {
                start: 1.5,
                end: 2.6,
                text: "world".to_owned(),
            },
        ]);
        let doc = build_doc(&[row], media(), "en", engine(), None);
        doc.validate().unwrap();
        assert!(doc.words[0].t0 >= 1.0);
        assert!(doc.words[1].t1 <= 2.0 + 1e-9);
    }

    #[test]
    fn short_foreign_island_is_absorbed() {
        // If a B word sits tightly in A's word stream (short, no pause, preceding word not sentence-final) ⇒ absorb it back into A.
        let mut row_a = RowIn::new(0.0, 2.0, "one two");
        row_a.speaker = Some("A".to_owned());
        let mut row_b = RowIn::new(2.0, 2.4, "blip");
        row_b.speaker = Some("B".to_owned());
        let mut row_c = RowIn::new(2.4, 4.0, "three four");
        row_c.speaker = Some("A".to_owned());
        let doc = build_doc(&[row_a, row_b, row_c], media(), "en", engine(), None);
        assert!(doc.words.iter().all(|word| word.sp == "s1"));
    }

    #[test]
    fn speaker_boundary_snaps_to_nearby_pause() {
        let mut row_a = RowIn::new(0.0, 2.0, "one two");
        row_a.speaker = Some("A".to_owned());
        row_a.words = Some(vec![
            WordIn {
                start: 0.0,
                end: 1.0,
                text: "one".to_owned(),
            },
            WordIn {
                start: 1.7,
                end: 2.0,
                text: "two".to_owned(),
            }, // 1.0→1.7 pause
        ]);
        let mut row_b = RowIn::new(2.0, 6.0, "three four five six seven");
        row_b.speaker = Some("B".to_owned());
        let doc = build_doc(&[row_a, row_b], media(), "en", engine(), None);
        // "two" is tightly adjacent to "three" (gap 0). The cut snaps to the 0.7s pause, and "two" goes to B.
        assert_eq!(doc.words[1].text, "two");
        assert_eq!(doc.words[1].sp, doc.words[2].sp);
    }

    /// The `(speaker, concatenated text)` sequence of the word stream after it is split by `sp`.
    fn turns(doc: &TranscriptDoc) -> Vec<(String, String)> {
        let mut out: Vec<(String, String)> = Vec::new();
        for word in &doc.words {
            match out.last_mut() {
                Some((sp, text)) if *sp == word.sp => text.push_str(&word.text),
                _ => out.push((word.sp.clone(), word.text.clone())),
            }
        }
        out
    }

    /// A CJK line with characters given equal time shares (the form of MOSS's word timestamps).
    fn cjk_row(start: f64, end: f64, text: &str, speaker: &str) -> RowIn {
        let chars: Vec<char> = text.chars().collect();
        let step = (end - start) / chars.len() as f64;
        let mut row = RowIn::new(start, end, text);
        row.speaker = Some(speaker.to_owned());
        row.words = Some(
            chars
                .iter()
                .enumerate()
                .map(|(index, character)| WordIn {
                    start: start + step * index as f64,
                    end: start + step * (index + 1) as f64,
                    text: character.to_string(),
                })
                .collect(),
        );
        row
    }

    /// Fixture from the raw MOSS 7h two-person interview rows (`asr-rows.json`, 719–725s). The question “what game were you playing back then” and the answer “er, lots of them…” are only 0.19s apart, but there is a 0.48s pause after 「呃」. The interval-projection strategy would snap the cut to that pause and give the 「呃」 that opens the answer to the questioner. The row-authoritative strategy moves no word at all.
    #[test]
    fn row_authoritative_policy_keeps_the_answer_opening_filler_with_the_answerer() {
        let question = cjk_row(718.14, 719.22, "当时打什么游戏", "S01");
        let mut answer = cjk_row(719.41, 724.99, "呃很多啊打DOTA啊什么的", "S02");
        // 0.48s pause after 「呃」.
        let words = answer.words.as_mut().unwrap();
        words[0].end = 719.41;
        words[1].start = 719.89;
        let rows = vec![question, answer];
        let media = DocMedia {
            duration: 800.0,
            ..media()
        };

        let snapped = build_doc(&rows, media.clone(), "zh", engine(), None);
        assert_eq!(
            turns(&snapped),
            vec![
                ("s1".to_owned(), "当时打什么游戏呃".to_owned()),
                ("s2".to_owned(), "很多啊打DOTA啊什么的".to_owned()),
            ],
            "the range-projection strategy snapped the answer's opening interjection to the questioner (regression lock: existing behaviour)"
        );

        let authoritative = build_doc_with_policy(
            &rows,
            media,
            "zh",
            engine(),
            None,
            SpeakerBoundaryPolicy::RowAuthoritative,
        );
        authoritative.validate().unwrap();
        assert_eq!(
            turns(&authoritative),
            vec![
                ("s1".to_owned(), "当时打什么游戏".to_owned()),
                ("s2".to_owned(), "呃很多啊打DOTA啊什么的".to_owned()),
            ]
        );
    }

    /// Same fixture at 154s: in an unpunctuated MOSS chunk, an S01 “0.31s, with gaps of 0.13s and 0.01s on either side” sits in the middle of a long S02 sentence. Pass 1's “preceding word is not sentence-final” always holds in an unpunctuated chunk, so it would merge this real acknowledgement wholesale into S02. The row-authoritative strategy keeps it.
    #[test]
    fn row_authoritative_policy_keeps_backchannel_rows_in_unpunctuated_chunks() {
        let rows = vec![
            cjk_row(151.0, 154.57, "呃NYU其实确实做得很不错", "S02"),
            cjk_row(154.70, 155.01, "嗯", "S01"),
            cjk_row(155.02, 158.0, "但另一方面NYU还有很强的电影学院", "S02"),
        ];
        let media = DocMedia {
            duration: 200.0,
            ..media()
        };
        let snapped = build_doc(&rows, media.clone(), "zh", engine(), None);
        assert!(
            snapped.words.iter().all(|word| word.sp == "s1"),
            "regression lock: the range-projection strategy absorbs a backchannel island inside an unpunctuated block (existing behaviour)"
        );

        let authoritative = build_doc_with_policy(
            &rows,
            media,
            "zh",
            engine(),
            None,
            SpeakerBoundaryPolicy::RowAuthoritative,
        );
        let turned = turns(&authoritative);
        assert_eq!(turned.len(), 3, "{turned:?}");
        assert_eq!(turned[1], ("s2".to_owned(), "嗯".to_owned()));
    }

    /// Same fixture at 742s: adjacent MOSS rows overlap in time (the S02 row runs to 742.51, and the S01 row starts at 742.30). The row-authoritative strategy only clamps the timings, and does not give the words in the overlap to the other speaker.
    #[test]
    fn row_authoritative_policy_resolves_overlap_by_time_not_by_relabeling() {
        let rows = vec![
            cjk_row(737.41, 742.51, "这样的一个一个经历对", "S02"),
            cjk_row(742.30, 747.14, "哦所以现在您的人生高光时刻", "S01"),
        ];
        let media = DocMedia {
            duration: 800.0,
            ..media()
        };
        let doc = build_doc_with_policy(
            &rows,
            media,
            "zh",
            engine(),
            None,
            SpeakerBoundaryPolicy::RowAuthoritative,
        );
        doc.validate().unwrap();
        assert_eq!(
            turns(&doc),
            vec![
                ("s1".to_owned(), "这样的一个一个经历对".to_owned()),
                ("s2".to_owned(), "哦所以现在您的人生高光时刻".to_owned()),
            ]
        );
        for pair in doc.words.windows(2) {
            assert!(
                pair[0].t1 <= pair[1].t0 + 1e-9,
                "{:?} → {:?}",
                pair[0],
                pair[1]
            );
        }
    }
}

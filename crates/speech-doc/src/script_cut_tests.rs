use super::*;

/// Each word takes 0.4 s, with 0.1 s between words.
fn rec_words(texts: &[&str]) -> Vec<RecWord> {
    texts
        .iter()
        .enumerate()
        .map(|(index, text)| RecWord {
            text: (*text).to_owned(),
            t0: index as f64 * 0.5,
            t1: index as f64 * 0.5 + 0.4,
        })
        .collect()
}

fn lines(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn spans(plan: &MatchPlan) -> Vec<(usize, usize, Reason)> {
    plan.segments
        .iter()
        .map(|segment| (segment.first, segment.last, segment.reason))
        .collect()
}

fn en_fillers() -> Vec<Vec<String>> {
    [&["um"][..], &["uh"], &["you", "know"]]
        .iter()
        .map(|phrase| phrase.iter().map(|word| (*word).to_owned()).collect())
        .collect()
}

#[test]
fn tokens_fold_width_case_and_punctuation_across_scripts() {
    assert_eq!(tokens("Don't STOP, now!"), vec!["dont", "stop", "now"]);
    assert_eq!(tokens("well-known"), vec!["well", "known"]);
    // Full-width letters and digits are the same as half-width after compatibility decomposition and composition.
    assert_eq!(tokens("ＡＢＣ１２"), tokens("abc12"));
    // Text that is not split by spaces becomes tokens one character per position, while Latin runs still form words as before.
    assert_eq!(
        tokens("我们用iPhone15拍。"),
        vec!["我", "们", "用", "iphone15", "拍"]
    );
    // Thai: vowels and tone marks are merged into their base character, not made into separate tokens.
    let thai = tokens("สวัสดี");
    assert!(!thai.is_empty());
    assert_eq!(thai.concat(), "สวัสดี");
    assert!(thai.len() < "สวัสดี".chars().count());
    // Pure punctuation produces no tokens.
    assert!(tokens("——！？…").is_empty());
}

#[test]
fn repeated_take_keeps_the_last_or_the_first_pass() {
    let script = lines(&["the quick brown fox jumps"]);
    let words = rec_words(&["the", "quick", "the", "quick", "brown", "fox", "jumps"]);
    let last = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&last), vec![(0, 1, Reason::Repeat)]);
    assert_eq!(last.matched, 5);
    assert_eq!(last.coverage(), 1.0);
    let first = plan(&script, &words, Take::First, None);
    assert_eq!(spans(&first), vec![(2, 3, Reason::Repeat)]);
}

#[test]
fn repeated_take_in_a_spaceless_script_is_found_per_character() {
    let script = lines(&["我们今天讲一下剪辑。"]);
    let words = rec_words(&["我们", "今天", "我们", "今天", "讲", "一下", "剪辑"]);
    let last = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&last), vec![(0, 1, Reason::Repeat)]);
    let first = plan(&script, &words, Take::First, None);
    assert_eq!(spans(&first), vec![(2, 3, Reason::Repeat)]);
}

#[test]
fn replacements_are_never_cut() {
    // Recognition mishears / rewording: both sides have unmatched tokens in the same gap.
    let script = lines(&["I have three apples here"]);
    let words = rec_words(&["I", "have", "3", "apples", "here"]);
    let plan = plan(&script, &words, Take::Last, None);
    assert!(plan.segments.is_empty());
    assert_eq!(plan.script_tokens, 5);
    assert_eq!(plan.matched, 4);
    assert!(plan.missing_lines.is_empty());
}

#[test]
fn fillers_need_a_table_and_otherwise_fall_back_to_extra() {
    let script = lines(&["so we start"]);
    let words = rec_words(&["so", "um,", "you", "know", "we", "start"]);
    let fillers = en_fillers();
    let with_table = plan(&script, &words, Take::Last, Some(&fillers));
    assert_eq!(spans(&with_table), vec![(1, 3, Reason::Filler)]);
    let without = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&without), vec![(1, 3, Reason::Extra)]);
}

#[test]
fn fillers_inside_a_false_start_do_not_hide_the_repeat() {
    let script = lines(&["we start now"]);
    let words = rec_words(&["we", "um", "we", "start", "now"]);
    let fillers = en_fillers();
    let plan = plan(&script, &words, Take::Last, Some(&fillers));
    assert_eq!(spans(&plan), vec![(0, 1, Reason::Repeat)]);
}

/// The same sentence is started several times: the whole span is not a single substring, but it can be assembled in order from substrings in the retained segments. If words not in the retained segments (corrective words) sit between the pieces, it does not count; they go to `extra` (a known boundary).
#[test]
fn several_false_starts_in_a_row_are_one_repeat() {
    let script = lines(&["the first step reads the timeline"]);
    let words = rec_words(&[
        "the", "first", "step", "reads", "the", "first", "the", "first", "step", "reads", "the",
        "timeline",
    ]);
    let plan = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&plan), vec![(0, 5, Reason::Repeat)]);

    let script = lines(&["第一步读取时间轴"]);
    let words = rec_words(&["第一步", "读取", "第一步", "第一步", "读取", "时间轴"]);
    let plan = super::plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&plan), vec![(0, 2, Reason::Repeat)]);

    let script = lines(&["the first step reads the timeline"]);
    let words = rec_words(&[
        "the", "first", "step", "reads", "sorry", "the", "first", "step", "reads", "the",
        "timeline",
    ]);
    let plan = super::plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&plan), vec![(0, 4, Reason::Extra)]);
}

#[test]
fn off_script_speech_is_extra_and_unspoken_lines_are_missing() {
    let script = lines(&["hello world", "this line was never read", "see you today"]);
    let words = rec_words(&[
        "hello", "world", "buy", "my", "course", "see", "you", "today",
    ]);
    let plan = plan(&script, &words, Take::Last, None);
    // Script line 2 and the recording "buy my course" fall in the same gap: both sides have content → replacement, kept.
    assert!(plan.segments.is_empty());
    assert!(plan.missing_lines.is_empty());

    let script = lines(&["hello world", "see you today"]);
    let plan = super::plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&plan), vec![(2, 4, Reason::Extra)]);

    let script = lines(&["hello world", "this line was never read", "see you today"]);
    let words = rec_words(&["hello", "world", "see", "you", "today"]);
    let plan = super::plan(&script, &words, Take::Last, None);
    assert!(plan.segments.is_empty());
    assert_eq!(plan.missing_lines, vec![1]);
}

/// Known boundary: when the two takes are not exactly the same (the first take says X, while the script and the second take say Y), `repeat` cannot tell by contiguous substrings, and the earlier take is recorded as `extra`. With `--take first`, LCS pins the script's first word to the first take, so what gets cut is the stretch between the two takes. The result is deterministic; it is pinned here and left for a later batch.
#[test]
fn takes_that_differ_by_a_word_are_a_pinned_boundary() {
    let script = lines(&["alpha yankee charlie"]);
    let words = rec_words(&["alpha", "xray", "charlie", "alpha", "yankee", "charlie"]);
    let last = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&last), vec![(0, 2, Reason::Extra)]);
    let first = plan(&script, &words, Take::First, None);
    assert_eq!(spans(&first), vec![(1, 3, Reason::Extra)]);
}

#[test]
fn words_without_tokens_join_a_segment_only_between_extra_words() {
    let script = lines(&["one two three"]);
    let words = rec_words(&["one", "…", "two", "zzz", "—", "yyy", "three", "—"]);
    let plan = plan(&script, &words, Take::Last, None);
    assert_eq!(spans(&plan), vec![(3, 5, Reason::Extra)]);
}

/// Deterministic pseudo-random generator (LCG); does not pull in `rand`.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self, bound: u64) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (self.0 >> 33) % bound
    }
}

/// Generate a script and a "read-aloud recording": every few hundred words a re-take is inserted (repeating the preceding few words), along with an off-script aside and a verbal tic; occasionally a word is replaced and a line is skipped. Returns (script lines, recording words, number of insertions).
fn synthetic(
    seed: u64,
    lines_count: usize,
    word: impl Fn(u64) -> String,
    vocabulary: u64,
) -> (Vec<String>, Vec<RecWord>, usize) {
    let mut rng = Lcg(seed);
    let mut script = Vec::new();
    let mut spoken: Vec<String> = Vec::new();
    let mut inserts = 0;
    for line_index in 0..lines_count {
        let length = 8 + rng.next(8) as usize;
        let line = (0..length)
            .map(|_| word(rng.next(vocabulary)))
            .collect::<Vec<_>>();
        script.push(line.join(" "));
        // The three kinds of events are staggered so that each insertion forms its own segment and does not fall into the same gap as a skipped line (which would make it a replacement).
        if line_index % 97 == 50 {
            continue; // skip a line
        }
        let after_missing = line_index % 97 == 51;
        let before_missing = line_index % 97 == 49;
        let repeat = line_index % 23 == 7 && !after_missing;
        if repeat {
            // Re-take: say the first 3 words, then read the whole line again.
            spoken.extend(line[..3].iter().cloned());
            inserts += 1;
        }
        for (position, token) in line.iter().enumerate() {
            if line_index % 31 == 3 && !repeat && position == 2 {
                spoken.push("replacedword".to_owned());
            } else {
                spoken.push(token.clone());
            }
        }
        if line_index % 41 == 11 && !before_missing && (line_index + 1) % 23 != 7 {
            spoken.extend(["um", "offscriptaaa", "offscriptbbb"].map(str::to_owned));
            inserts += 1;
        }
    }
    let words = spoken
        .iter()
        .enumerate()
        .map(|(index, text)| RecWord {
            text: text.clone(),
            t0: index as f64 * 0.3,
            t1: index as f64 * 0.3 + 0.25,
        })
        .collect();
    (script, words, inserts)
}

/// Scale: a script of about 100k tokens against a recording of about 100k tokens. The number of cells in exact LCS is linear in n+m, far less than n·m; every re-take and off-script aside is found. Wall-clock time is not measured.
#[test]
fn alignment_work_stays_linear_on_hours_of_speech() {
    let (script, words, inserts) = synthetic(7, 9000, |id| format!("w{id}"), 6000);
    let plan = plan(&script, &words, Take::Last, None);
    let n = plan.script_tokens as u64;
    let m = words.len() as u64;
    assert!(n > 90_000 && m > 90_000, "fixture too small: {n} × {m}");
    assert!(
        plan.stats.lcs_cells <= 64 * (n + m),
        "lcs cells {} not linear in n+m={}",
        plan.stats.lcs_cells,
        n + m
    );
    assert!(
        plan.stats.hashed <= 16 * (n + m),
        "hashed {}",
        plan.stats.hashed
    );
    assert_eq!(plan.stats.unresolved_script_tokens, 0);
    assert_eq!(plan.segments.len(), inserts);
    assert!(
        plan.segments
            .iter()
            .all(|segment| segment.reason != Reason::Filler)
    );
    assert!(plan.coverage() > 0.95);
}

/// The same scale on text tokenized character by character: the character set is small and individual characters are almost never unique, so anchors rely on k-tuples.
#[test]
fn alignment_work_stays_linear_for_per_character_tokens() {
    let (script, words, inserts) = synthetic(
        11,
        6000,
        |id| char::from_u32(0x4E00 + id as u32).unwrap().to_string(),
        2500,
    );
    // The placeholder words for re-takes and replacements are also swapped for Chinese characters here, to avoid a Latin run becoming a single long token.
    let words = words
        .into_iter()
        .map(|mut word| {
            word.text = match word.text.as_str() {
                "um" => "龖".to_owned(),
                "offscriptaaa" => "龘".to_owned(),
                "offscriptbbb" => "靐".to_owned(),
                "replacedword" => "齉".to_owned(),
                _ => word.text,
            };
            word
        })
        .collect::<Vec<_>>();
    let plan = plan(&script, &words, Take::First, None);
    let n = plan.script_tokens as u64;
    let m = words.len() as u64;
    assert!(n > 60_000, "fixture too small: {n}");
    assert!(
        plan.stats.lcs_cells <= 64 * (n + m),
        "cells {}",
        plan.stats.lcs_cells
    );
    assert_eq!(plan.stats.unresolved_script_tokens, 0);
    assert_eq!(plan.segments.len(), inserts);
}

/// Pathological input: no unique anchor at all, and it exceeds the single-gap cap. The whole span is deterministically recorded as unmatched, without panicking.
#[test]
fn a_gap_without_anchors_beyond_the_cap_is_left_unmatched() {
    let script = lines(&[&"a b ".repeat(3000)]);
    let text = "b a ".repeat(3000);
    let words = rec_words(&text.split_whitespace().collect::<Vec<_>>());
    let first = plan(&script, &words, Take::Last, None);
    let second = plan(&script, &words, Take::Last, None);
    assert_eq!(first, second);
    assert_eq!(first.matched, 0);
    assert_eq!(first.stats.unresolved_script_tokens, 6000);
    assert_eq!(first.stats.lcs_cells, 0);
    assert_eq!(first.coverage(), 0.0);
}

#[test]
fn silence_threshold_follows_the_material_and_needs_two_bins() {
    // 50 bins/s: speech of 200 and a pause of 2; a single-bin dip does not count.
    let mut levels = vec![200u8; 100];
    levels[20..30].fill(2);
    levels[60] = 2;
    levels[80..83].fill(3);
    let map = SilenceMap::from_levels(&levels, 50.0);
    assert_eq!(map.runs(), &[(0.4, 0.6), (1.6, 1.66)]);
    // Material with an overall high noise floor: the threshold rises with the noise floor, but not above 15 dB below the 95th percentile.
    let mut noisy = vec![200u8; 100];
    noisy[10..40].fill(20);
    let map = SilenceMap::from_levels(&noisy, 50.0);
    assert_eq!(map.runs(), &[(0.2, 0.8)]);
    assert!(SilenceMap::from_levels(&[], 50.0).runs().is_empty());
}

#[test]
fn snap_takes_the_nearest_silence_inside_the_window() {
    let map = SilenceMap::from_runs(vec![(1.0, 1.2), (1.5, 1.6), (3.0, 4.0)]);
    assert_eq!(map.snap(1.3, 1.8, 1.4), Some(1.55));
    // When the window only covers part of the silence, take the midpoint of the intersection.
    assert_eq!(map.snap(1.1, 1.3, 1.25), Some(1.15));
    assert_eq!(map.snap(2.0, 2.9, 2.5), None);
    assert_eq!(map.snap(2.0, 2.0, 2.0), None);
}

#[test]
fn cut_points_snap_or_fall_back_to_the_gap_midpoint_without_crossing_kept_words() {
    let words = vec![
        RecWord {
            text: "keep".into(),
            t0: 0.0,
            t1: 1.0,
        },
        RecWord {
            text: "drop".into(),
            t0: 1.4,
            t1: 2.0,
        },
        RecWord {
            text: "keep".into(),
            t0: 2.6,
            t1: 3.0,
        },
    ];
    let segment = PlanSegment {
        first: 1,
        last: 1,
        reason: Reason::Extra,
    };
    // Silence at both ends: the start snaps to the midpoint of 1.1–1.3; the end window [1.7, 2.3] covers 2.2–2.3, so take its midpoint.
    let map = SilenceMap::from_runs(vec![(1.1, 1.3), (2.2, 2.4)]);
    let placed = place_cuts(std::slice::from_ref(&segment), &words, 5.0, Some(&map), 0.3);
    assert_eq!(
        placed,
        vec![PlacedCut {
            segment: 0,
            t0: 1.2,
            t1: 2.25,
            snapped: true
        }]
    );
    // The silence on the start side is outside the window (and past the preceding retained word): it lands at the midpoint of the inter-word gap, so only one end counts as snapped.
    let map = SilenceMap::from_runs(vec![(0.2, 0.9), (2.2, 2.4)]);
    let placed = place_cuts(std::slice::from_ref(&segment), &words, 5.0, Some(&map), 0.3);
    assert_eq!(
        placed,
        vec![PlacedCut {
            segment: 0,
            t0: 1.2,
            t1: 2.25,
            snapped: false
        }]
    );
    // No snapping (no energy, or --snap 0): both ends take the gap midpoint.
    let placed = place_cuts(std::slice::from_ref(&segment), &words, 5.0, Some(&map), 0.0);
    assert_eq!(
        placed,
        vec![PlacedCut {
            segment: 0,
            t0: 1.2,
            t1: 2.3,
            snapped: false
        }]
    );
    // When there is no adjacent word at the head or tail, cut all the way to 0 and the end of the material.
    let edge = PlanSegment {
        first: 0,
        last: 2,
        reason: Reason::Extra,
    };
    let placed = place_cuts(&[edge], &words, 5.0, None, 0.3);
    assert_eq!(
        placed,
        vec![PlacedCut {
            segment: 0,
            t0: 0.0,
            t1: 5.0,
            snapped: false
        }]
    );
}

#[test]
fn too_short_cuts_are_dropped() {
    let words = vec![
        RecWord {
            text: "a".into(),
            t0: 0.0,
            t1: 1.0,
        },
        RecWord {
            text: "b".into(),
            t0: 1.0,
            t1: 1.02,
        },
        RecWord {
            text: "c".into(),
            t0: 1.02,
            t1: 2.0,
        },
    ];
    let segment = PlanSegment {
        first: 1,
        last: 1,
        reason: Reason::Extra,
    };
    assert!(place_cuts(&[segment], &words, 2.0, None, 0.3).is_empty());
}

/// The three fixtures from plan draft §10.5, one per script: when script and recording match, nothing is cut; when the wrong script is used, coverage is below 0.6 (the threshold lives in the CLI layer).
#[test]
fn a_faithful_reading_cuts_nothing_and_a_wrong_script_scores_low() {
    let latin_script = lines(&[
        "Today we look at how a long recording becomes a short film.",
        "First we transcribe it, then we compare it with the script.",
    ]);
    let latin_words = latin_script
        .iter()
        .flat_map(|line| line.split_whitespace())
        .collect::<Vec<_>>();
    let faithful = plan(&latin_script, &rec_words(&latin_words), Take::Last, None);
    assert!(faithful.segments.is_empty());
    assert!(faithful.missing_lines.is_empty());
    assert_eq!(faithful.coverage(), 1.0);

    let han_script = lines(&[
        "今天我们来看一段长录音怎么变成短片。",
        "先转录，再和稿子逐字比对。",
    ]);
    let han_words = rec_words(&[
        "今天",
        "我们",
        "来",
        "看",
        "一段",
        "长",
        "录音",
        "怎么",
        "变成",
        "短片。",
        "先",
        "转录，",
        "再",
        "和",
        "稿子",
        "逐字",
        "比对。",
    ]);
    let faithful = plan(&han_script, &han_words, Take::First, None);
    assert!(faithful.segments.is_empty());
    assert_eq!(faithful.coverage(), 1.0);

    // Wrong script: the recording is about something else.
    let wrong_latin = lines(&[
        "Bake the bread for forty minutes until the crust turns golden.",
        "Let it cool on a rack before you slice it.",
    ]);
    assert!(plan(&wrong_latin, &rec_words(&latin_words), Take::Last, None).coverage() < 0.6);
    let wrong_han = lines(&[
        "面包放进烤箱烤四十分钟，直到外皮金黄。",
        "放在架子上晾凉之后再切片。",
    ]);
    assert!(plan(&wrong_han, &han_words, Take::Last, None).coverage() < 0.6);
}

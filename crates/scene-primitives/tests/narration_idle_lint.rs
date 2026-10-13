//! `narration-idle` (spec §16): the narration is speaking, but the picture has not moved for more than 4 s. Only narration under `assets/vo/` is checked.

use scene_primitives::HostInputs;
use scene_primitives::lint::{Diagnostic, Severity, lint, lint_with_inputs};
use serde_json::{Value, json};

/// One scene, one full-coverage visual clip, and one audio clip over `[0, audio_end]`.
/// `nodes` is `(id, frames)`: each has its own opacity keyframe track; `t` is in seconds within the clip.
fn doc(scene_dur: f64, audio_src: &str, audio_end: f64, nodes: &[(&str, Value)]) -> Value {
    let children: Vec<Value> = nodes
        .iter()
        .map(|(id, frames)| {
            json!({"type": "box", "id": id, "style": {"width": 10, "height": 10},
                   "animate": {"keyframes": [{"prop": "opacity", "frames": frames}]}})
        })
        .collect();
    json!({
        "ccut": "0.2",
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 24},
        "assets": {"voice": {"type": "audio", "src": audio_src}},
        "scenes": [{"id": "s", "dur": scene_dur, "desc": "一场"}],
        "tracks": [
            {"id": "board", "kind": "visual", "clips": [
                {"id": "c", "start": "@s", "end": "@s.end",
                 "element": {"type": "box", "id": "root", "children": children}}]},
            {"id": "vo", "kind": "audio", "clips": [
                {"id": "vo-s", "start": "@s", "end": format!("@s+{audio_end}"), "src": "$assets.voice"}]},
        ],
    })
}

fn idle(doc: &Value) -> Vec<Diagnostic> {
    let all = lint(doc);
    assert!(
        all.iter().all(|d| d.severity != Severity::Error),
        "{all:#?}"
    );
    all.into_iter()
        .filter(|d| d.rule == "narration-idle")
        .collect()
}

/// 0–2 s moves; 2–11 s has a track whose value does not change (not counted as change); from 11 s it moves again.
fn stalled(audio_src: &str) -> Value {
    doc(
        14.0,
        audio_src,
        12.0,
        &[
            ("a", json!([{"t": 0, "v": 0}, {"t": 2, "v": 1}])),
            ("hold", json!([{"t": 2, "v": 1}, {"t": 11, "v": 1}])),
            ("b", json!([{"t": 11, "v": 0}, {"t": 11.5, "v": 1}])),
        ],
    )
}

#[test]
fn lint_narration_idle_reports_the_gap_inside_a_narration_clip() {
    let found = idle(&stalled("assets/vo/s.wav"));
    assert_eq!(found.len(), 1, "{found:#?}");
    let d = &found[0];
    assert_eq!(d.severity, Severity::Warn);
    assert_eq!(d.pointer, "/clips/vo-s");
    assert!(
        d.message.contains("\"vo-s\"")
            && d.message.contains("scene \"s\"")
            && d.message.contains("2.00–11.00s"),
        "{}",
        d.message
    );
}

#[test]
fn lint_narration_idle_is_clean_when_something_moves_every_three_seconds() {
    let nodes: Vec<(String, Value)> = (1..=4)
        .map(|k| {
            let t = 3.0 * k as f64;
            (
                format!("n{k}"),
                json!([{"t": t - 0.05, "v": 0}, {"t": t, "v": 1}]),
            )
        })
        .collect();
    let refs: Vec<(&str, Value)> = nodes
        .iter()
        .map(|(id, f)| (id.as_str(), f.clone()))
        .collect();
    assert!(idle(&doc(14.0, "assets/vo/s.wav", 12.0, &refs)).is_empty());
}

#[test]
fn lint_narration_idle_ignores_audio_outside_assets_vo_and_short_clips() {
    assert!(idle(&stalled("assets/music/bed.wav")).is_empty());
    // The whole segment is still, but the narration clip is only 5 s (< 6 s)
    let short = doc(
        14.0,
        "assets/vo/s.wav",
        5.0,
        &[("a", json!([{"t": 0, "v": 0}, {"t": 0.5, "v": 1}]))],
    );
    assert!(idle(&short).is_empty());
}

#[test]
fn lint_narration_idle_caps_reports_and_gives_the_total_in_the_last_one() {
    // Ten scenes, each with 10 s of narration, picture completely still: ten gaps, only 8 reported
    let scenes: Vec<Value> = (0..10)
        .map(|i| json!({"id": format!("s{i}"), "dur": 10, "desc": "一场"}))
        .collect();
    let voice: Vec<Value> = (0..10)
        .map(|i| {
            json!({"id": format!("vo-{i}"), "start": format!("@s{i}"), "end": format!("@s{i}.end"),
                   "src": "$assets.voice"})
        })
        .collect();
    let doc = json!({
        "ccut": "0.2",
        "meta": {"id": "t", "width": 1920, "height": 1080, "fps": 24},
        "assets": {"voice": {"type": "audio", "src": "assets/vo/all.wav"}},
        "scenes": scenes,
        "tracks": [
            {"id": "board", "kind": "visual", "clips": [
                {"id": "c", "start": "@s0", "end": "@s9.end",
                 "element": {"type": "box", "id": "root", "style": {"width": 10, "height": 10}}}]},
            {"id": "vo", "kind": "audio", "clips": voice},
        ],
    });
    let found = idle(&doc);
    assert_eq!(found.len(), 8);
    let with_total: Vec<_> = found
        .iter()
        .filter(|d| d.message.contains("the film has 10 such gaps in total"))
        .collect();
    assert_eq!(with_total.len(), 1, "{found:#?}");
}

/// Declared window 0–25 s (the `@scene.end` ending of an old project); the picture moves once every 3 s and freezes after 12 s.
fn frozen_after_12s() -> Value {
    let nodes: Vec<(String, Value)> = (1..=4)
        .map(|k| {
            let t = 3.0 * k as f64;
            (
                format!("n{k}"),
                json!([{"t": t - 0.05, "v": 0}, {"t": t, "v": 1}]),
            )
        })
        .collect();
    let nodes: Vec<(&str, Value)> = nodes.iter().map(|(i, f)| (i.as_str(), f.clone())).collect();
    doc(26.0, "assets/vo/s.wav", 25.0, &nodes)
}

fn idle_with_audio(doc: &Value, duration: Option<f64>) -> Vec<Diagnostic> {
    let mut inputs = HostInputs::default();
    if let Some(duration) = duration {
        inputs.insert_audio("voice", duration);
    }
    let all = lint_with_inputs(doc, Some(&inputs));
    assert!(
        all.iter().all(|d| d.severity != Severity::Error),
        "{all:#?}"
    );
    all.into_iter()
        .filter(|d| d.rule == "narration-idle")
        .collect()
}

#[test]
fn lint_narration_idle_stops_where_the_audio_actually_ends() {
    let doc = frozen_after_12s();
    // Actual length 15 s: the freeze from 15–25 s after speech ends does not count; 12–15 has only 3 s.
    assert!(idle_with_audio(&doc, Some(15.0)).is_empty());
    // Actual length 25 s: the narration really is speaking, and the picture does not move from 12–25 s.
    let found = idle_with_audio(&doc, Some(25.0));
    assert_eq!(found.len(), 1, "{found:#?}");
    assert!(
        found[0].message.contains("12.00–25.00s"),
        "{}",
        found[0].message
    );
    // Actual length exceeds the declared window: the declared end point governs.
    let found = idle_with_audio(&doc, Some(40.0));
    assert!(
        found[0].message.contains("12.00–25.00s"),
        "{}",
        found[0].message
    );
    // Actual length unavailable: fall back to the declared window.
    let found = idle_with_audio(&doc, None);
    assert!(
        found[0].message.contains("12.00–25.00s"),
        "{}",
        found[0].message
    );
}

#[test]
fn lint_narration_idle_counts_media_start_into_the_real_length() {
    let mut doc = frozen_after_12s();
    doc["tracks"][1]["clips"][0]["mediaStart"] = json!(10);
    // The 25 s material starts playing at 10 s, so only 15 s of speech remains.
    assert!(idle_with_audio(&doc, Some(25.0)).is_empty());
    // Less than 6 s remains: the whole clip is not checked.
    assert!(idle_with_audio(&doc, Some(15.0)).is_empty());
}

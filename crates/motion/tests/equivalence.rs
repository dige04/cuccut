//! Equivalent Timeline and BCF documents must yield the same `MotionProgram` fingerprint (design §10 stage 1 acceptance).
//!
//! The mapping table is deliberately kept in the test and not in production code: only combinations that are **semantically the same recipe** are eligible. `timeline.enter.fade`'s default curve is `easeOutCubic`, while BCF `fadeIn`'s keyframes have no ease (equivalent to `linear`), so the Timeline side explicitly writes `ease: "linear"`. `exit: none` is used to block the mirrored exit.

use motion::lower_bcf::{preset_channels, to_program};
use motion::lower_timeline::{AnimationInput, SlotInput, Window, lower_timeline_animation};
use motion::preset_registry::bcf_builtin;
use serde_json::Value;

const START: f64 = 1.0;
const DUR: f64 = 0.4;

fn timeline_fade(dur: f64) -> motion::MotionProgram {
    let animation = AnimationInput {
        enter: Some(SlotInput {
            preset: "fade",
            dur: Some(dur),
            ease: Some("linear"),
            ..SlotInput::default()
        }),
        exit: Some(SlotInput {
            preset: "none",
            ..SlotInput::default()
        }),
        r#loop: None,
    };
    let lowered = lower_timeline_animation(
        &animation,
        Window {
            start: START,
            end: Some(5.0),
            project_end: 10.0,
        },
    )
    .expect("timeline program");
    // The Timeline window is element-local time; shift to absolute time before comparing.
    lowered.program.rebased(START)
}

fn bcf_fade_in(t0: f64, dur: f64) -> motion::MotionProgram {
    let keyframes = bcf_builtin("fadeIn")
        .and_then(|def| def.get("keyframes"))
        .and_then(Value::as_array)
        .cloned()
        .expect("fadeIn keyframes");
    to_program(&preset_channels(&keyframes, t0, dur))
}

#[test]
fn timeline_fade_and_bcf_fade_in_share_one_fingerprint() {
    let timeline = timeline_fade(DUR);
    let bcf = bcf_fade_in(START, DUR);
    assert_eq!(timeline.property_tracks.len(), 1);
    assert_eq!(bcf.property_tracks.len(), 1);
    assert_eq!(
        timeline.fingerprint(),
        bcf.fingerprint(),
        "\ntimeline:\n{}\nbcf:\n{}",
        String::from_utf8_lossy(&timeline.canonical_bytes()),
        String::from_utf8_lossy(&bcf.canonical_bytes())
    );
}

#[test]
fn the_provenance_fingerprint_still_separates_the_two_registries() {
    // Equivalent fingerprints, but the recipe sources differ: the full fingerprint must be able to tell them apart.
    assert_ne!(
        timeline_fade(DUR).full_fingerprint(),
        bcf_fade_in(START, DUR).full_fingerprint()
    );
}

#[test]
fn the_fingerprint_is_sensitive_to_time_and_duration() {
    assert_ne!(
        timeline_fade(DUR).fingerprint(),
        bcf_fade_in(START, 0.5).fingerprint()
    );
    assert_ne!(
        timeline_fade(DUR).fingerprint(),
        bcf_fade_in(START + 0.1, DUR).fingerprint()
    );
}

#[test]
fn integer_and_float_endpoints_do_not_split_the_fingerprint() {
    // BCF `fadeIn`'s endpoints are integer `0`/`1`; on the Timeline side they are `0.0`/`1.0`.
    let bcf = bcf_fade_in(START, DUR);
    let track = &bcf.property_tracks[0];
    assert_eq!(track.property.as_str(), "opacity");
    assert!(matches!(
        &track.segments[0].kind,
        motion::SegmentKind::Tween { from, .. }
            if matches!(from, motion::MotionValue::Discrete(_))
    ));
    assert_eq!(timeline_fade(DUR).fingerprint(), bcf.fingerprint());
}

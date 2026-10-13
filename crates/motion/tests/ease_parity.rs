//! The easing implementation of `ccut-motion::curve` must be bit-identical to `ccut-core::ease`.
//!
//! The move (`ease.rs` → `curve.rs`) is evidenced by this test. After `ccut-core` is changed to re-export, the test degrades into a check of the re-export itself, which is still meaningful: it prevents anyone from writing a local copy back on either side.

use motion::curve::{EASE_NAMES, apply_ease};

#[test]
fn ease_tables_are_identical() {
    assert_eq!(EASE_NAMES, scene_primitives::ease::EASE_NAMES);
}

#[test]
fn every_ease_matches_bit_for_bit_over_ten_thousand_points() {
    const SAMPLES: u32 = 10_000;
    for name in EASE_NAMES {
        for i in 0..=SAMPLES {
            let t = i as f64 / SAMPLES as f64;
            let ours = apply_ease(Some(name), t);
            let theirs = scene_primitives::ease::apply_ease(Some(name), t);
            assert_eq!(
                ours.to_bits(),
                theirs.to_bits(),
                "{name}({t}) = {ours} vs {theirs}"
            );
        }
    }
}

#[test]
fn unknown_and_absent_names_agree_too() {
    for name in [None, Some("linear"), Some("magic-spring"), Some("")] {
        for i in 0..=1000 {
            let t = i as f64 / 1000.0;
            assert_eq!(
                apply_ease(name, t).to_bits(),
                scene_primitives::ease::apply_ease(name, t).to_bits()
            );
        }
    }
}

#[test]
fn samples_outside_the_unit_interval_agree() {
    for name in EASE_NAMES {
        for t in [-1.0, -0.001, 1.001, 2.0, 37.5] {
            assert_eq!(
                apply_ease(Some(name), t).to_bits(),
                scene_primitives::ease::apply_ease(Some(name), t).to_bits(),
                "{name}({t})"
            );
        }
    }
}

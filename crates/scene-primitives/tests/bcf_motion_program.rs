//! Lossless round trip between BCF channels and `MotionProgram` (plan §4.4).
//!
//! The corpus is the stage-0 golden corpus: all channels after resolving `tests/fixtures/media-demo.ccut.json` and `tests/fixtures/launch-golden/launch.ccut.json`, including the node channels of visual clips, the wrap (transition) channels, and the camera and audio channels.
//!
//! Invariant: `to_channels(to_program(chs)) == chs`, **byte for byte**. This is the constructive proof that the output of `ccut render` is unchanged: the integer `0` has always been `Number(0)` and does not become `0.0` in the round trip.

use std::path::PathBuf;

use motion::lower_bcf::{ChannelIr, KfIr, to_channels, to_program};
use scene_primitives::resolve::{Ir, RNode, Resolver};
use scene_primitives::sample::Channel;
use scene_primitives::{HostInputs, Kf};
use serde_json::Value;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

/// Host metadata for media-demo: the same fixed values as `motion_channels_baseline.rs`.
fn media_demo_inputs() -> HostInputs {
    let mut inputs = HostInputs::default();
    inputs.insert_image("card", 640.0, 360.0);
    inputs.insert_image("logo", 128.0, 128.0);
    inputs.insert_video("clip", 1280.0, 720.0, 12.0, 24.0);
    inputs.insert_audio("tone", 30.0);
    inputs
}

fn collect_node(node: &RNode, out: &mut Vec<Channel>) {
    out.extend(node.channels.iter().cloned());
    for child in &node.children {
        collect_node(child, out);
    }
}

fn all_channels(ir: &Ir) -> Vec<Channel> {
    let mut out = Vec::new();
    for clip in &ir.visual_clips {
        out.extend(clip.wrap_channels.iter().cloned());
        collect_node(&clip.tree, &mut out);
    }
    for clip in &ir.camera_clips {
        out.push(Channel::replace(
            "camera".to_owned(),
            clip.frames.clone(),
            None,
        ));
    }
    for clip in &ir.audio_clips {
        out.push(Channel::replace(
            "volume".to_owned(),
            clip.volume.clone(),
            None,
        ));
    }
    out
}

fn to_ir(channel: &Channel) -> ChannelIr {
    ChannelIr {
        prop: channel.prop.clone(),
        frames: channel
            .frames
            .iter()
            .map(|frame: &Kf| {
                KfIr::new(&channel.prop, frame.t, frame.v.clone(), frame.ease.clone())
            })
            .collect(),
    }
}

fn resolve(path: &str) -> Option<Ir> {
    let file = fixture_root().join(path);
    let doc: Value = serde_json::from_slice(&std::fs::read(&file).ok()?).ok()?;
    let mut resolver = Resolver::new(doc, None).expect("construct Resolver");
    resolver.set_host_inputs(media_demo_inputs());
    Some(resolver.resolve().expect("resolve"))
}

fn assert_round_trip(label: &str, channels: &[Channel]) {
    assert!(!channels.is_empty(), "{label}: corpus is empty");
    let corpus: Vec<ChannelIr> = channels.iter().map(to_ir).collect();
    let program = to_program(&corpus);
    assert_eq!(to_channels(&program), corpus, "{label}: round trip is not lossless");
    // The strongly typed view of numeric channels must match the source numbers
    for channel in &corpus {
        for frame in &channel.frames {
            if let Some(n) = frame.v.as_f64() {
                assert_eq!(
                    frame.typed.as_f64().map(f64::to_bits),
                    Some(n.to_bits()),
                    "{label}/{}",
                    channel.prop
                );
            }
        }
    }
}

#[test]
fn media_demo_channels_round_trip_through_the_motion_program() {
    let ir = resolve("media-demo.ccut.json").expect("media-demo.ccut.json");
    assert_round_trip("media-demo", &all_channels(&ir));
}

/// `tests/fixtures/launch-golden/launch.ccut.json` is a fixture tracked in the repository.
#[test]
fn launch_channels_round_trip_through_the_motion_program() {
    let ir = resolve("launch-golden/launch.ccut.json").expect("launch.ccut.json");
    assert_round_trip("launch", &all_channels(&ir));
}

fn two_scenes_with_transition(preset: &str) -> Value {
    serde_json::json!({
        "meta": {"id": "t", "width": 320, "height": 180, "fps": 30},
        "scenes": [{"id": "a", "dur": 1}, {"id": "b", "dur": 1}],
        "tracks": [{"id": "main", "kind": "visual", "clips": [
            {"id": "a", "start": 0, "end": "@a.end",
             "transitionOut": {"preset": preset, "dur": 0.4},
             "element": {"type": "box", "id": "ra", "style": {"width": 320, "height": 180}}},
            {"id": "b", "start": "@b", "end": "@b.end",
             "element": {"type": "box", "id": "rb", "style": {"width": 320, "height": 180}}}
        ]}]
    })
}

/// The error strings of the transition branch are a lint / diagnostic contract and must stay byte-for-byte unchanged.
#[test]
fn unknown_transitions_keep_their_diagnostic_string() {
    let mut resolver =
        Resolver::new(two_scenes_with_transition("notATransition"), None).expect("construct Resolver");
    let error = match resolver.resolve() {
        Ok(_) => panic!("notATransition should return an error"),
        Err(error) => error,
    };
    assert_eq!(error.to_string(), "transition-unknown: \"notATransition\"");
}

/// Every Motion Transition term in spec §9 must be able to materialize channels. Before stage 5, the four terms `wipeLeft` / `wipeRight` / `zoomThrough` / `whipPan` report `transition-unknown` here.
#[test]
fn the_whole_spec_section_nine_vocabulary_resolves() {
    let expected: &[(&str, &[&str], &[&str])] = &[
        ("cut", &[], &[]),
        ("crossfade", &["opacity"], &["opacity"]),
        ("slideLeft", &["x"], &["x"]),
        ("slideRight", &["x"], &["x"]),
        ("slideUp", &["y"], &["y"]),
        ("slideDown", &["y"], &["y"]),
        ("wipeLeft", &["clipInsetRight"], &["clipInsetLeft"]),
        ("wipeRight", &["clipInsetLeft"], &["clipInsetRight"]),
        ("zoomThrough", &["scale", "opacity"], &["scale", "opacity"]),
        ("whipPan", &["x", "opacity"], &["x", "opacity"]),
    ];
    for (preset, out_props, in_props) in expected {
        let mut resolver =
            Resolver::new(two_scenes_with_transition(preset), None).expect("construct Resolver");
        let ir = resolver
            .resolve()
            .unwrap_or_else(|error| panic!("{preset}: {error}"));
        let props = |id: &str| -> Vec<String> {
            ir.visual_clips
                .iter()
                .find(|clip| clip.id == id)
                .unwrap()
                .wrap_channels
                .iter()
                .map(|channel| channel.prop.clone())
                .collect()
        };
        assert_eq!(props("a"), *out_props, "{preset} out channels");
        assert_eq!(props("b"), *in_props, "{preset} in channels");
        // Overlapping windows expand symmetrically, independent of the vocabulary.
        let a = ir.visual_clips.iter().find(|c| c.id == "a").unwrap();
        let b = ir.visual_clips.iter().find(|c| c.id == "b").unwrap();
        if *preset == "cut" {
            continue;
        }
        assert!((a.render_end - 1.2).abs() < 1e-9, "{preset}");
        assert!((b.render_start - 0.8).abs() < 1e-9, "{preset}");
    }
}

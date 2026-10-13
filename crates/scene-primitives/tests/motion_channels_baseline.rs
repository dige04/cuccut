//! Stage 0 semantic baseline: consistency between the absolute-time `Vec<Channel>` golden produced by BCF `resolve` and out-of-order sampling via `sample_frames`.
//!
//! Fixture: `tests/fixtures/motion/bcf-channels.json`.
//! Regenerate: `CCUT_UPDATE_GOLDEN=1 cargo test -p ccut-core --test motion_channels_baseline`.
//!
//! Comparison strategy: **byte-for-byte comparison of the serialized text**, with no epsilon. The output of `to_string_pretty` (ryu shortest round-trip representation + BTreeMap key order) is itself deterministic, and byte-level comparison is the real “bit-for-bit unchanged”. It also does not depend on the parse-direction setting (the workspace-level serde_json has `float_roundtrip` enabled, see `core/Cargo.toml`).
//! Out-of-order sampling assertions additionally compare bit by bit using `f64::to_bits`.

use std::path::PathBuf;

use scene_primitives::layout::{TextMeasure, TextMetricsLine};
use scene_primitives::resolve::{Ir, RNode, Resolver};
use scene_primitives::sample::{Channel, sample_frames};
use scene_primitives::{HostInputs, Rgba};
use serde_json::{Value, json};

/// Fixed text metrics: core does no I/O, and fonts are injected by the host. Here a purely arithmetic fake metric is provided, so the fixture is independent of system fonts.
struct FixedMeasure;

impl TextMeasure for FixedMeasure {
    fn measure(&mut self, text: &str, _family: &str, size: f64, _w: u16) -> TextMetricsLine {
        TextMetricsLine {
            width: text.chars().count() as f64 * size * 0.6,
            ascent: size * 0.8,
            descent: size * 0.2,
        }
    }
}

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/motion")
}

fn updating() -> bool {
    std::env::var_os("CCUT_UPDATE_GOLDEN").is_some_and(|value| !value.is_empty())
}

fn assert_golden(name: &str, actual: &Value) {
    let path = fixture_dir().join(name);
    let mut text = serde_json::to_string_pretty(actual).expect("serialize golden");
    text.push('\n');
    if updating() {
        std::fs::create_dir_all(fixture_dir()).expect("create fixtures/motion");
        std::fs::write(&path, &text).expect("write golden");
        return;
    }
    let expected = std::fs::read_to_string(&path).unwrap_or_else(|error| {
        panic!(
            "failed to read {}: {error}; regenerate with CCUT_UPDATE_GOLDEN=1",
            path.display()
        )
    });
    if expected == text {
        return;
    }
    let (line, want, got) = expected
        .lines()
        .zip(text.lines())
        .enumerate()
        .find(|(_, (a, b))| a != b)
        .map(|(index, (a, b))| (index + 1, a.to_owned(), b.to_owned()))
        .unwrap_or_else(|| {
            (
                expected.lines().count().min(text.lines().count()) + 1,
                format!("<{} lines>", expected.lines().count()),
                format!("<{} lines>", text.lines().count()),
            )
        });
    panic!(
        "{} differs from the current implementation (line {line}):\n  golden: {want}\n  actual: {got}\n\
         This is a semantic change; confirm it first, then regenerate with CCUT_UPDATE_GOLDEN=1.",
        path.display()
    );
}

/// Host metadata for media-demo: fixed values; the fixture does not depend on real media probing.
fn media_demo_inputs() -> HostInputs {
    let mut inputs = HostInputs::default();
    inputs.insert_image("card", 640.0, 360.0);
    inputs.insert_image("logo", 128.0, 128.0);
    inputs.insert_video("clip", 1280.0, 720.0, 12.0, 24.0);
    inputs.insert_audio("tone", 30.0);
    inputs
}

fn rgba_json(color: &Rgba) -> Value {
    json!({"r": color.r, "g": color.g, "b": color.b, "a": color.a})
}

/// Adaptive sampling points for channels: one point just outside each end of the interval, each keyframe, and the midpoint of each segment.
fn channel_probe_times(channel: &Channel) -> Vec<f64> {
    let mut times = Vec::new();
    if channel.frames.is_empty() {
        return times;
    }
    let first = channel.frames[0].t;
    let last = channel.frames[channel.frames.len() - 1].t;
    times.push(first - 0.25);
    for window in channel.frames.windows(2) {
        times.push(window[0].t);
        times.push((window[0].t + window[1].t) / 2.0);
    }
    times.push(last);
    times.push(last + 0.25);
    times
}

fn channel_json(channel: &Channel) -> Value {
    let frames = channel
        .frames
        .iter()
        .map(|frame| {
            json!({
                "t": frame.t,
                "v": frame.v,
                "ease": frame.ease,
            })
        })
        .collect::<Vec<_>>();
    let samples = channel_probe_times(channel)
        .into_iter()
        .map(|time| json!({"t": time, "v": sample_frames(&channel.frames, time)}))
        .collect::<Vec<_>>();
    json!({
        "prop": channel.prop,
        "meta": channel.meta,
        "frames": frames,
        "samples": samples,
    })
}

fn channels_json(channels: &[Channel]) -> Value {
    Value::Array(channels.iter().map(channel_json).collect())
}

/// Expands the render tree depth-first, keeping only nodes that carry channels or an extraDelay, so the fixture focuses on animation.
fn node_rows(node: &RNode, path: &str, rows: &mut Vec<Value>) {
    let here = if path.is_empty() {
        node.id.clone()
    } else {
        format!("{path}/{}", node.id)
    };
    if !node.channels.is_empty() || node.extra_delay != 0.0 {
        rows.push(json!({
            "path": here,
            "ntype": node.ntype,
            "extraDelay": node.extra_delay,
            "channels": channels_json(&node.channels),
        }));
    }
    for child in &node.children {
        node_rows(child, &here, rows);
    }
}

fn ir_json(ir: &Ir) -> Value {
    let visual = ir
        .visual_clips
        .iter()
        .map(|clip| {
            let mut rows = Vec::new();
            node_rows(&clip.tree, "", &mut rows);
            json!({
                "id": clip.id,
                "start": clip.start,
                "end": clip.end,
                "renderStart": clip.render_start,
                "renderEnd": clip.render_end,
                "z": clip.z,
                "order": clip.order,
                "wrapChannels": channels_json(&clip.wrap_channels),
                "nodes": rows,
            })
        })
        .collect::<Vec<_>>();
    let camera = ir
        .camera_clips
        .iter()
        .map(|clip| {
            let channel = Channel::replace("camera".to_owned(), clip.frames.clone(), None);
            json!({
                "start": clip.start,
                "end": clip.end,
                "channel": channel_json(&channel),
            })
        })
        .collect::<Vec<_>>();
    let audio = ir
        .audio_clips
        .iter()
        .map(|clip| {
            let channel = Channel::replace("volume".to_owned(), clip.volume.clone(), None);
            json!({
                "assetId": clip.asset_id,
                "start": clip.start,
                "end": clip.end,
                "mediaStart": clip.media_start,
                "rate": clip.rate,
                "baseVolume": clip.base_volume,
                "channel": channel_json(&channel),
            })
        })
        .collect::<Vec<_>>();
    json!({
        "meta": {
            "total": ir.total,
            "fps": ir.fps,
            "w": ir.w,
            "h": ir.h,
            "bg": rgba_json(&ir.bg),
        },
        "visualClips": visual,
        "cameraClips": camera,
        "audioClips": audio,
    })
}

fn resolve_document(doc: Value, inputs: Option<HostInputs>) -> Ir {
    let mut resolver = Resolver::new(doc, None).expect("construct Resolver");
    if let Some(inputs) = inputs {
        resolver.set_host_inputs(inputs);
    }
    let mut ir = resolver.resolve().expect("resolve");
    // Stage 2: the production order is resolve → layout → `build_channels_after_layout`
    // (relative-length evaluation), which `FrameRenderer::new` has already fixed as a contract.
    // media-demo / launch contain no relative lengths ⇒ this step changes **not a single byte**,
    // which is the hard evidence that “absolute channel output is unchanged”; the golden is therefore not regenerated.
    let before: Vec<String> = ir
        .visual_clips
        .iter()
        .map(|clip| serde_json::to_string(&channels_json(&clip.tree.channels)).unwrap())
        .collect();
    let (w, h) = (ir.w, ir.h);
    for clip in &mut ir.visual_clips {
        scene_primitives::layout::layout_tree(&mut clip.tree, w, h, &mut FixedMeasure);
    }
    scene_primitives::resolve::build_channels_after_layout(&mut ir).expect("finalize");
    for (index, clip) in ir.visual_clips.iter().enumerate() {
        let after = serde_json::to_string(&channels_json(&clip.tree.channels)).unwrap();
        assert_eq!(
            before[index], after,
            "layout and relative-length evaluation must not change the channels of documents without relative lengths"
        );
    }
    ir
}

fn media_demo_doc() -> Value {
    let path = fixture_root().join("media-demo.ccut.json");
    serde_json::from_slice(&std::fs::read(&path).expect("read media-demo.ccut.json")).unwrap()
}

/// `tests/fixtures/launch-golden/launch.ccut.json` is a fixture tracked in the repository.
fn launch_doc() -> Value {
    let path = fixture_root().join("launch-golden/launch.ccut.json");
    serde_json::from_slice(&std::fs::read(&path).expect("read launch.ccut.json")).unwrap()
}

// The "path" / "note" / "generator" entries in the two goldens record the v2 location and command; they are cross-checked byte for byte against the fixture, so they are kept as originally written. The fixture is in fact read from this crate's `tests/fixtures/`.
#[test]
fn bcf_channels_match_golden() {
    let document = json!({
        "note": "BCF resolve 后的绝对时间通道语义基线（阶段 0）。",
        "generator": "cargo test -p ccut-core --test motion_channels_baseline（CCUT_UPDATE_GOLDEN=1 重生成）",
        "documents": [{
            "id": "media-demo",
            "path": "core/fixtures/media-demo.ccut.json",
            "hostInputs": {
                "card": {"kind": "image", "width": 640.0, "height": 360.0},
                "clip": {"kind": "video", "width": 1280.0, "height": 720.0, "duration": 12.0, "fps": 24.0},
                "logo": {"kind": "image", "width": 128.0, "height": 128.0},
                "tone": {"kind": "audio", "duration": 30.0},
            },
            "ir": ir_json(&resolve_document(media_demo_doc(), Some(media_demo_inputs()))),
        }],
    });
    assert_golden("bcf-channels.json", &document);
}

/// `tests/fixtures/launch-golden/launch.ccut.json` and this baseline golden are both in the repository, checked bit by bit, and no longer skipped.
#[test]
fn bcf_channels_launch_matches_golden() {
    let doc = launch_doc();
    let document = json!({
        "note": "core/fixtures/launch-golden/launch.ccut.json 的通道语义基线（阶段 0）。",
        "generator": "cargo test -p ccut-core --test motion_channels_baseline（CCUT_UPDATE_GOLDEN=1 重生成）",
        "documents": [{
            "id": "launch",
            "path": "core/fixtures/launch-golden/launch.ccut.json",
            "hostInputs": Value::Null,
            "ir": ir_json(&resolve_document(doc, None)),
        }],
    });
    assert_golden("bcf-channels-launch.json", &document);
}

#[test]
fn sample_frames_is_order_independent() {
    let ir = resolve_document(media_demo_doc(), Some(media_demo_inputs()));
    let mut channels = Vec::new();
    for clip in &ir.visual_clips {
        channels.extend(clip.wrap_channels.iter().cloned());
        collect_channels(&clip.tree, &mut channels);
    }
    for clip in &ir.camera_clips {
        channels.push(Channel::replace(
            "camera".to_owned(),
            clip.frames.clone(),
            None,
        ));
    }
    for clip in &ir.audio_clips {
        channels.push(Channel::replace(
            "volume".to_owned(),
            clip.volume.clone(),
            None,
        ));
    }
    assert!(!channels.is_empty(), "media-demo must produce channels");

    // Dense grid covering [-0.5, total+0.5] plus a few intra-frame offsets.
    let mut times = Vec::new();
    let mut frame = -15_i32;
    while frame <= (ir.total * 30.0) as i32 + 15 {
        times.push(f64::from(frame) / 30.0);
        frame += 1;
    }
    times.extend([0.0111, 1.4999, 2.50001, 3.7777, 6.66666]);
    let order = shuffled(times.len(), 0x5EED_1234_ABCD_0003);

    for channel in &channels {
        if channel.frames.is_empty() {
            continue;
        }
        let sorted = times
            .iter()
            .map(|time| sample_frames(&channel.frames, *time))
            .collect::<Vec<_>>();
        let mut out = vec![Value::Null; times.len()];
        for index in &order {
            out[*index] = sample_frames(&channel.frames, times[*index]);
        }
        for (index, (a, b)) in sorted.iter().zip(out.iter()).enumerate() {
            assert!(
                value_bitwise_eq(a, b),
                "{} sampling differs between in-order and out-of-order at t={}: {a} vs {b}",
                channel.prop,
                times[index]
            );
        }
    }
}

fn collect_channels(node: &RNode, out: &mut Vec<Channel>) {
    out.extend(node.channels.iter().cloned());
    for child in &node.children {
        collect_channels(child, out);
    }
}

/// Equality of `Value` on f64 goes through `PartialEq`, where `0.0 == -0.0` would let a sign flip slip through; here the comparison is explicitly bitwise, and out-of-order sampling must match bit for bit.
fn value_bitwise_eq(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => match (x.as_f64(), y.as_f64()) {
            (Some(x), Some(y)) => x.to_bits() == y.to_bits(),
            _ => x == y,
        },
        (Value::Array(x), Value::Array(y)) => {
            x.len() == y.len() && x.iter().zip(y).all(|(x, y)| value_bitwise_eq(x, y))
        }
        (Value::Object(x), Value::Object(y)) => {
            x.len() == y.len()
                && x.iter()
                    .all(|(key, x)| y.get(key).is_some_and(|y| value_bitwise_eq(x, y)))
        }
        _ => a == b,
    }
}

/// Deterministic permutation with a fixed seed (splitmix64 → Fisher-Yates), without introducing a rand dependency.
fn shuffled(len: usize, mut seed: u64) -> Vec<usize> {
    let mut next = move || {
        seed = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = seed;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    };
    let mut order = (0..len).collect::<Vec<_>>();
    for index in (1..len).rev() {
        let pick = (next() % (index as u64 + 1)) as usize;
        order.swap(index, pick);
    }
    order
}

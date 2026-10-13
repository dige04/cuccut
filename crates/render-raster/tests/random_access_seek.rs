//! Frame equivalence for random-access seeking (`MediaStore::set_random_access`).
//!
//! When the interactive preview drags the playhead, it can skip thousands of frames forward in one go, and draining sequentially would decode the whole video (measured: jumping to 600 s takes about 75 s of wall-clock time). With random access enabled, a long jump reopens the decoder, but "which frame to pick" in `docs/design/bcf/cuccut-format-spec.md` §15.1 is a hard promise: the reopen path and the drain path must land on **the same source frame**, otherwise preview and export would show a half-frame misalignment.
//!
//! The fixture is generated with ffmpeg at test time; if the probe finds nothing, the whole test is skipped (the repo's existing convention).
//!
//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` (host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use render_raster::{MediaStore, load_assets};
use serde_json::{Value, json};

/// The composition frame rate is deliberately different from the source frame rate. Target times mostly fall between source frames, which actually exercises the boundary decision of "which frame to pick after reopening".
const PLAN_FPS: f64 = 30.0;
const SOURCE_FPS: u32 = 24;
const DURATION_SECONDS: u32 = 6;

fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// `testsrc` carries a visible frame counter in every frame, so per-frame pixels all differ. A one-frame error is guaranteed to be caught by the byte comparison.
fn fixture() -> Option<(tempfile::TempDir, PathBuf)> {
    if !ffmpeg_available() {
        return None;
    }
    let dir = tempfile::tempdir().ok()?;
    let assets = dir.path().join("assets");
    std::fs::create_dir_all(&assets).ok()?;
    let source = format!("testsrc=size=160x90:rate={SOURCE_FPS}:duration={DURATION_SECONDS}");
    let ok = Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error", "-f", "lavfi", "-i", &source])
        .args(["-pix_fmt", "yuv420p", "-c:v", "libx264"])
        .arg(assets.join("clip.mp4"))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    ok.then_some((dir, assets))
}

fn video_doc() -> Value {
    json!({
        "meta": { "id": "seek", "width": 160, "height": 90, "fps": PLAN_FPS },
        "scenes": [ { "id": "s", "dur": DURATION_SECONDS, "desc": "随机访问" } ],
        "assets": { "clip": { "type": "video", "src": "assets/clip.mp4" } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": 0, "end": DURATION_SECONDS, "element": {
                    "type": "video", "id": "v", "src": "$assets.clip",
                    "style": { "x": 0, "y": 0, "width": 160, "height": 90 } } }
            ] }
        ]
    })
}

fn store(dir: &Path, random_access: bool) -> MediaStore {
    let doc = video_doc();
    let assets = Arc::new(load_assets(&doc, dir).expect("load_assets"));
    let mut media = MediaStore::new(assets, PLAN_FPS);
    media.set_random_access(random_access);
    media
}

/// Advance sequentially from `0.0` up to each time in `times`, and return each one's frame bytes.
/// With `random_access = false`, the intermediate frames are all drained; that is the path export takes.
fn frames_after_jump(dir: &Path, random_access: bool, times: &[f64]) -> Vec<Vec<u8>> {
    let mut media = store(dir, random_access);
    media.video_frame("clip", 0.0).expect("首帧");
    times
        .iter()
        .map(|time| {
            media
                .video_frame("clip", *time)
                .expect("取帧")
                .data()
                .to_vec()
        })
        .collect()
}

/// A long jump with a reopen and a sequential drain land on the same source frame: the hard promise of §15.1 "which frame to pick".
///
/// The times are deliberately chosen on the composition grid but **not on source frame boundaries** (30 fps grid, 24 fps source). They cover the jump point itself and several frames of sequential advance after the jump, verifying that the reopen did not shift the grid.
#[test]
fn a_far_forward_jump_lands_on_the_same_frame_as_draining() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let step = 1.0 / PLAN_FPS;
    let mut times = vec![4.0, 4.0 + step, 4.0 + 2.0 * step, 4.0 + 3.0 * step];
    // After the jump point, one more backward step and another long jump, confirming that the origin after reopening did not skew the grid.
    times.extend([1.5, 1.5 + step, 5.5, 5.5 + step]);
    // Passing the end of the clip sets `eof`, and the long-jump reopen is gated on `!eof`. Here both paths first run past the end and then return to the middle of the clip to keep jumping, confirming that the reopen capability is not permanently disabled after `eof`.
    times.extend([f64::from(DURATION_SECONDS) + 2.0, 2.0, 5.0]);
    let drained = frames_after_jump(dir.path(), false, &times);
    let jumped = frames_after_jump(dir.path(), true, &times);
    for (index, time) in times.iter().enumerate() {
        assert_eq!(
            drained[index], jumped[index],
            "t={time:.4} 的帧在抽干路径与重开路径上不一致"
        );
    }
}

/// When passing the end, both paths freeze on the same last frame (the reopen point clamps to the last decodable instant).
#[test]
fn a_jump_past_the_end_freezes_on_the_same_last_frame() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let times = [f64::from(DURATION_SECONDS) + 3.0];
    let drained = frames_after_jump(dir.path(), false, &times);
    let jumped = frames_after_jump(dir.path(), true, &times);
    assert_eq!(drained[0], jumped[0], "片尾冻结帧应当一致");
}

/// After playback runs to the end, continuing to advance frame by frame (a clip or project is longer than the video stream by tens of milliseconds): every frame freezes on the same last frame, and returning to the middle of the clip decodes as usual.
///
/// Regression: after EOF closed the decoder, the next frame reopened an empty decoder past the end of the clip. It then compared the new origin's frame number against the old origin's `last_idx`, which falsely triggered the loop-wrap guard and cleared the last frame. From the second frame on it reported "no frame readable", the App's overlay scheduler entered its failure state, and on replay the picture froze.
#[test]
fn stepping_past_the_end_keeps_the_frozen_last_frame() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let end = f64::from(DURATION_SECONDS);
    let step = 1.0 / PLAN_FPS;
    let last = frames_after_jump(dir.path(), false, &[end + 3.0]).remove(0);
    for random_access in [false, true] {
        let mut media = store(dir.path(), random_access);
        media.video_frame("clip", 0.0).expect("首帧");
        for tick in -4..8 {
            let time = end + f64::from(tick) * step;
            let frame = media.video_frame("clip", time).unwrap_or_else(|error| {
                panic!("random_access={random_access} t={time:.4}: {error:#}")
            });
            if tick >= 1 {
                assert_eq!(
                    frame.data(),
                    last.as_slice(),
                    "random_access={random_access} t={time:.4} 应冻结在末帧"
                );
            }
        }
        let inside = media.video_frame("clip", 1.0).expect("回到片内");
        assert_ne!(inside.data(), last.as_slice(), "回到片内不能还冻结在末帧");
    }
}

/// When the very first frame fetched after a cold start falls past the end of the clip (seek to the end of the project), fall back to the last frame and freeze on it. The result matches draining from the start to the end, rather than reporting "no frame readable"; subsequent forward advances still return that frame.
#[test]
fn a_first_request_past_the_end_freezes_on_the_last_frame() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let end = f64::from(DURATION_SECONDS);
    let last = frames_after_jump(dir.path(), false, &[end + 3.0]).remove(0);
    for random_access in [false, true] {
        let mut media = store(dir.path(), random_access);
        for time in [end + 0.05, end + 0.1, end + 2.0] {
            let frame = media.video_frame("clip", time).unwrap_or_else(|error| {
                panic!("random_access={random_access} t={time:.4}: {error:#}")
            });
            assert_eq!(
                frame.data(),
                last.as_slice(),
                "random_access={random_access} t={time:.4} 应冻结在末帧"
            );
        }
    }
}

/// Off by default: when not explicitly enabled, behavior is identical to before the change (export takes this path).
#[test]
fn random_access_is_off_by_default() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let doc = video_doc();
    let assets = Arc::new(load_assets(&doc, dir.path()).expect("load_assets"));
    let mut default_store = MediaStore::new(assets, PLAN_FPS);
    default_store.video_frame("clip", 0.0).expect("首帧");
    let default_frame = default_store.video_frame("clip", 4.0).expect("取帧");
    let drained = frames_after_jump(dir.path(), false, &[4.0]);
    assert_eq!(default_frame.data(), drained[0].as_slice());
}

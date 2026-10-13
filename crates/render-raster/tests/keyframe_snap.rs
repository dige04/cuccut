//! Frame-fetch semantics of keyframe snapping (`MediaStore::set_keyframe_snap`).
//!
//! During **dragging** in interactive preview, the frame-fetch time snaps to the nearest keyframe before it: each jump only pays the cost of “reopen + decode one frame”, and the picture is at most one GOP away from the target time. After release, when returning to the exact path, the frame obtained must be exactly the same as if it had never been snapped — the hard guarantee of “which frame to take” in §15.1 of `docs/design/bcf/cuccut-format-spec.md` is not affected by dragging.
//!
//! Only the native stream (macOS AVFoundation) can answer with a keyframe table; on other backends snapping is a no-op, and the equivalence assertions in this file still hold (approximate frame = exact frame). The fixture is generated on the fly with ffmpeg; if it cannot be probed, the whole file is skipped (the repository's existing convention).
#![cfg(feature = "media")]

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use render_raster::{MediaStore, load_assets};
use serde_json::{Value, json};

const PLAN_FPS: f64 = 30.0;
const SOURCE_FPS: u32 = 30;
const DURATION_SECONDS: u32 = 6;
/// Fixed GOP: one keyframe every 30 frames (1 second), so snap targets can be computed in advance.
const GOP_FRAMES: u32 = 30;

fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// `testsrc` carries a visible frame counter in every frame, so per-frame pixels all differ; `-g 30 -keyint_min 30
/// -sc_threshold 0` pins the keyframes to whole seconds.
fn fixture() -> Option<(tempfile::TempDir, PathBuf)> {
    if !ffmpeg_available() {
        return None;
    }
    let dir = tempfile::tempdir().ok()?;
    let assets = dir.path().join("assets");
    std::fs::create_dir_all(&assets).ok()?;
    let source = format!("testsrc=size=160x90:rate={SOURCE_FPS}:duration={DURATION_SECONDS}");
    let gop = GOP_FRAMES.to_string();
    let ok = Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error", "-f", "lavfi", "-i", &source])
        .args(["-pix_fmt", "yuv420p", "-c:v", "libx264"])
        .args([
            "-g",
            &gop,
            "-keyint_min",
            &gop,
            "-sc_threshold",
            "0",
            "-bf",
            "0",
        ])
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
        "meta": { "id": "snap", "width": 160, "height": 90, "fps": PLAN_FPS },
        "scenes": [ { "id": "s", "dur": DURATION_SECONDS, "desc": "关键帧吸附" } ],
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

fn store(dir: &Path) -> MediaStore {
    store_with_decoder(dir, None)
}

fn store_with_decoder(dir: &Path, decoder: Option<&str>) -> MediaStore {
    let doc = video_doc();
    let mut assets = load_assets(&doc, dir).expect("load_assets");
    assets.videos.get_mut("clip").unwrap().decoder = decoder.map(str::to_owned);
    let mut media = MediaStore::new(Arc::new(assets), PLAN_FPS);
    media.set_random_access(true);
    media
}

fn frame(media: &mut MediaStore, time: f64) -> Vec<u8> {
    media
        .video_frame("clip", time)
        .expect("get frame")
        .data()
        .to_vec()
}

/// The frame obtained at `time` when the exact path has never snapped.
fn exact_frame(dir: &Path, time: f64) -> Vec<u8> {
    let mut media = store(dir);
    frame(&mut media, time)
}

/// A frame during snapping is either equal to the exact frame at the target time (the backend cannot answer with a keyframe table), or equal to the exact frame of the whole-second keyframe before the target; after release, an exact request obtains a frame identical to one that was never snapped.
#[test]
fn snapping_lands_on_the_preceding_keyframe_and_releases_exactly() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let native = media_native::available();
    let mut media = store(dir.path());
    frame(&mut media, 0.0);
    media.set_keyframe_snap(true);
    // 3.5 s falls in the middle of a GOP: the keyframe is at 3.0 s.
    let snapped = frame(&mut media, 3.5);
    let expected = if native {
        exact_frame(dir.path(), 3.0)
    } else {
        exact_frame(dir.path(), 3.5)
    };
    assert_eq!(snapped, expected, "while dragging, t=3.5 should land on the keyframe before it");
    // The native stream reuses the approximate frame within the same GOP; the ffmpeg backend does not snap and keeps fetching exact frames.
    let expected_next = if native {
        snapped
    } else {
        exact_frame(dir.path(), 3.8)
    };
    assert!(
        frame(&mut media, 3.8) == expected_next,
        "later frames within the same GOP should respect the backend's snapping capability"
    );
    // Release: the exact path must give the same frame as one that was never snapped.
    media.set_keyframe_snap(false);
    assert_eq!(
        frame(&mut media, 3.8),
        exact_frame(dir.path(), 3.8),
        "the exact frame after release must match one that was never snapped"
    );
    // Afterwards, sequential advance (playback) is also unaffected.
    let step = 1.0 / PLAN_FPS;
    assert_eq!(
        frame(&mut media, 3.8 + step),
        exact_frame(dir.path(), 3.8 + step)
    );
}

/// Dragging backwards while snapping likewise fetches by keyframe, and after switching back to the exact path, the frames for a backward jump are also correct.
#[test]
fn snapping_backwards_and_far_forward_stays_consistent() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let native = media_native::available();
    let mut media = store(dir.path());
    frame(&mut media, 4.2);
    media.set_keyframe_snap(true);
    let back = frame(&mut media, 1.4);
    let expected_back = exact_frame(dir.path(), if native { 1.0 } else { 1.4 });
    assert_eq!(back, expected_back, "a backward drag should land on the 1.0 s keyframe");
    let far = frame(&mut media, 5.9);
    let expected_far = exact_frame(dir.path(), if native { 5.0 } else { 5.9 });
    assert_eq!(far, expected_far, "a long jump should land on the 5.0 s keyframe");
    media.set_keyframe_snap(false);
    assert_eq!(frame(&mut media, 2.3), exact_frame(dir.path(), 2.3));
}

/// Off by default: when not explicitly enabled, behaviour is word-for-word identical to before the change (export takes this path).
#[test]
fn keyframe_snap_is_off_by_default() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let mut media = store(dir.path());
    frame(&mut media, 0.0);
    assert_eq!(frame(&mut media, 3.5), exact_frame(dir.path(), 3.5));
}

/// Names ffmpeg's H.264 decoder explicitly, so that the non-snapping path is also covered on machines that have a native backend.
#[test]
fn ffmpeg_keyframe_snap_keeps_exact_frames_within_the_same_gop() {
    let Some((dir, _assets)) = fixture() else {
        return;
    };
    let exact = |time| frame(&mut store_with_decoder(dir.path(), Some("h264")), time);
    let expected_start = exact(3.5);
    let expected_next = exact(3.8);
    assert!(
        expected_start != expected_next,
        "the fixture must show different pictures at the two times"
    );
    let mut media = store_with_decoder(dir.path(), Some("h264"));
    frame(&mut media, 0.0);
    assert_eq!(
        media.video_backend("clip"),
        Some(render_raster::media::FFMPEG_BACKEND)
    );
    media.set_keyframe_snap(true);
    assert!(frame(&mut media, 3.5) == expected_start);
    assert!(frame(&mut media, 3.8) == expected_next);
    media.set_keyframe_snap(false);
    assert!(frame(&mut media, 3.8) == expected_next);
}

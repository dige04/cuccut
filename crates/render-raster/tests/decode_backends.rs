//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `audio::mix_audio_reported` (the host byte layer), and it does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Acceptance test for decode backend selection (WP6a): whether video frames and audio clips each went through the native path or ffmpeg.
//!
//! Per `docs/design/bcf/cuccut-format-spec.md` §15.1 “decode backends must be observable”, the pixels/samples of these two paths only promise semantic equivalence plus tolerance, so “which backend was actually used” must be queryable. This file pins down exactly that selection rule:
//!
//! - MP4 on macOS / Windows → platform native (AVFoundation / Media Foundation)
//! - WebM (a container the platform decoder cannot open) → ffmpeg fallback
//! - Linux (`media_native::available()` is false) → always ffmpeg
//! - Constant-speed audio clip → Symphonia; variable-speed clip → ffmpeg `atempo`
//!
//! Fixtures are generated with ffmpeg on the fly; if ffmpeg is not detected, the whole test is skipped (the repository's existing convention).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use render_raster::{MediaStore, audio, load_assets};
use serde_json::{Value, json};

fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn ff(args: &[&str]) -> bool {
    Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error"])
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// A minimal fixture set:
///
/// - `clip.mp4`: H.264, no audio track.
/// - `clip.webm`: VP9, **no alpha**: purely a “container the platform decoder cannot open”.
/// - `rotated.mp4`: a stream copy of `clip.mp4` with only a 90° display matrix added.
/// - `tone.wav`: 44.1 kHz stereo sine (deliberately not 48 kHz, so resampling really runs).
/// - `av.mp4`: 2-second H.264 + AAC material, for the variable-speed clip that `withAudio` expands to
///   (a clip on an audio track is always 1× speed; `rate != 1` can only come from the video element's
///   `playbackRate`, see `collect_with_audio` in `ccut-core`).
fn fixtures() -> Option<(tempfile::TempDir, PathBuf)> {
    if !ffmpeg_available() {
        return None;
    }
    let dir = tempfile::tempdir().ok()?;
    let assets = dir.path().join("assets");
    std::fs::create_dir_all(&assets).ok()?;
    let source = "testsrc=size=160x90:rate=25:duration=1";
    let ok = ff(&[
        "-f",
        "lavfi",
        "-i",
        source,
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        assets.join("clip.mp4").to_str()?,
    ]) && ff(&[
        "-f",
        "lavfi",
        "-i",
        source,
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libvpx-vp9",
        // Encoding quality does not matter, as long as it is a WebM that can be decoded: realtime + fastest preset, so that fixture generation itself does not become the slowest step in the test.
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        assets.join("clip.webm").to_str()?,
    ]) && ff(&[
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2:sample_rate=44100",
        "-ac",
        "2",
        assets.join("tone.wav").to_str()?,
    ]) && ff(&[
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=160x90:rate=25:duration=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2:sample_rate=44100",
        "-ac",
        "2",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        assets.join("av.mp4").to_str()?,
    ]);
    if !ok {
        return None;
    }
    let rotated = assets.join("rotated.mp4");
    if !ff(&[
        // The explicit display-matrix syntax for FFmpeg 7+. When an old ffmpeg fails, the other baseline fixtures are kept, and the rotation case skips itself.
        "-display_rotation",
        "90",
        "-i",
        assets.join("clip.mp4").to_str()?,
        "-c",
        "copy",
        rotated.to_str()?,
    ]) {
        let _ = std::fs::remove_file(rotated);
    }
    Some((dir, assets))
}

/// A minimal document containing only one video element.
fn video_doc(src: &str) -> Value {
    json!({
        "meta": { "id": "backend", "width": 160, "height": 90, "fps": 25 },
        "scenes": [ { "id": "s", "dur": 1, "desc": "解码后端" } ],
        "assets": { "clip": { "type": "video", "src": src } },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "shot", "start": 0, "end": 1, "element": {
                    "type": "video", "id": "v", "src": "$assets.clip",
                    "style": { "x": 0, "y": 0, "width": 160, "height": 90 } } }
            ] }
        ]
    })
}

fn backend_for(dir: &Path, src: &str) -> Option<&'static str> {
    let doc = video_doc(src);
    let assets = Arc::new(load_assets(&doc, dir).expect("load_assets"));
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let ir = resolver.resolve().unwrap();
    let mut media = MediaStore::new(assets, ir.fps);
    // Actually decode one frame: the backend is only determined when the decoder is opened.
    media.video_frame("clip", 0.2).expect("decode a frame");
    media.video_backend("clip")
}

/// MP4 uses native decoding (on platforms that have a native backend); WebM always falls back to ffmpeg.
#[test]
fn an_mp4_decodes_natively_while_a_webm_falls_back_to_ffmpeg() {
    let Some((dir, _assets)) = fixtures() else {
        return;
    };
    let expected_mp4 = if media_native::available() {
        media_native::backend()
    } else {
        render_raster::media::FFMPEG_BACKEND
    };
    assert_eq!(
        backend_for(dir.path(), "assets/clip.mp4"),
        Some(expected_mp4),
        "MP4 should use {expected_mp4}"
    );
    assert_eq!(
        backend_for(dir.path(), "assets/clip.webm"),
        Some(render_raster::media::FFMPEG_BACKEND),
        "WebM: the platform decoder cannot open it, so it must fall back to ffmpeg"
    );
}

/// The frames produced by the two backends agree within the cross-backend tolerance (§15.1): the same footage, once through native and once through ffmpeg (WebM is another container of the same `testsrc`), must have matching dominant structure at the center pixels. Here a coarse check uses the whole-frame average color; fine-grained SSIM comparison lives in `frame_stream.rs` in `ccut-media-native`.
#[test]
fn both_backends_agree_on_what_the_frame_looks_like() {
    let Some((dir, _assets)) = fixtures() else {
        return;
    };
    let mean = |src: &str| -> [u64; 3] {
        let doc = video_doc(src);
        let assets = Arc::new(load_assets(&doc, dir.path()).expect("load_assets"));
        let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
        resolver.set_host_inputs(assets.inputs.clone());
        let ir = resolver.resolve().unwrap();
        let mut media = MediaStore::new(assets, ir.fps);
        let pixmap = media.video_frame("clip", 0.2).expect("decode a frame");
        let mut totals = [0_u64; 3];
        for pixel in pixmap.data().chunks_exact(4) {
            totals[0] += u64::from(pixel[0]);
            totals[1] += u64::from(pixel[1]);
            totals[2] += u64::from(pixel[2]);
        }
        let count = (pixmap.width() * pixmap.height()) as u64;
        [totals[0] / count, totals[1] / count, totals[2] / count]
    };
    let native = mean("assets/clip.mp4");
    let fallback = mean("assets/clip.webm");
    for channel in 0..3 {
        let delta = native[channel].abs_diff(fallback[channel]);
        assert!(
            delta <= 12,
            "channel {channel} whole-frame average differs by {delta} (native {:?} vs ffmpeg {:?})",
            native,
            fallback
        );
    }
}

/// Both decode paths for 90°-rotated footage must deliver frames according to the display geometry:
///
/// - The native path no longer falls back by mistake because it validates against the natural encoded size;
/// - The rawvideo from the ffmpeg autorotate path is no longer used to construct a Pixmap based on the natural row width.
#[test]
fn rotated_video_uses_display_geometry_on_native_and_ffmpeg_paths() {
    let Some((dir, assets_dir)) = fixtures() else {
        return;
    };
    let rotated = assets_dir.join("rotated.mp4");
    if !rotated.exists() {
        eprintln!("skipping: this machine's ffmpeg does not support the -display_rotation fixture");
        return;
    }

    let (natural_width, natural_height, _, _) =
        render_raster::assets::probe_media(&rotated, true).expect("probe rotated MP4");
    assert_eq!(
        (natural_width, natural_height),
        (160, 90),
        "public probe_media still reports the natural encoded size"
    );

    let doc = video_doc("assets/rotated.mp4");
    let loaded = load_assets(&doc, dir.path()).expect("load rotated video");
    let info = loaded.videos.get("clip").expect("video asset");
    assert_eq!(
        (info.width, info.height),
        (90, 160),
        "render asset must use the upright display size"
    );

    let mut preferred = MediaStore::new(Arc::new(loaded), 25.0);
    let frame = preferred.video_frame("clip", 0.2).expect("decode a frame on the preferred path");
    assert_eq!((frame.width(), frame.height()), (90, 160));
    let expected = if media_native::available() {
        media_native::backend()
    } else {
        render_raster::media::FFMPEG_BACKEND
    };
    assert_eq!(preferred.video_backend("clip"), Some(expected));

    // Naming the decoder explicitly makes VideoReader skip the native backend. This is the same selection mechanism that already sends alpha WebM to ffmpeg, and naming H.264 is only to force that path in the test.
    let mut fallback_assets = load_assets(&doc, dir.path()).expect("reload rotated video");
    fallback_assets
        .videos
        .get_mut("clip")
        .expect("video asset")
        .decoder = Some("h264".to_owned());
    let mut fallback = MediaStore::new(Arc::new(fallback_assets), 25.0);
    let frame = fallback.video_frame("clip", 0.2).expect("decode a frame on the ffmpeg path");
    assert_eq!((frame.width(), frame.height()), (90, 160));
    assert_eq!(
        fallback.video_backend("clip"),
        Some(render_raster::media::FFMPEG_BACKEND)
    );
}

/// Mid-section RMS (trimming the 10 ms resampling transition band at both the start and the end).
fn middle_rms(samples: &[f32]) -> f64 {
    let skip = audio::SAMPLE_RATE as usize / 100 * 2;
    let core = &samples[skip..samples.len() - skip];
    (core
        .iter()
        .map(|v| f64::from(*v) * f64::from(*v))
        .sum::<f64>()
        / core.len() as f64)
        .sqrt()
}

fn to_samples(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

fn mix(doc: Value, dir: &Path) -> audio::AudioMix {
    let assets = load_assets(&doc, dir).expect("load_assets");
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let ir = resolver.resolve().unwrap();
    audio::mix_audio_reported(&ir, &assets)
        .expect("mix audio")
        .expect("has an audio clip")
}

#[test]
fn prepared_video_rejects_replacement_without_touching_inactive_media() {
    use std::io::Write;
    let Some((dir, _)) = fixtures() else {
        return;
    };
    let asset = dir.path().join("assets/clip.mp4");
    let unused = dir.path().join("assets/unused.mp4");
    std::fs::copy(&asset, &unused).unwrap();
    let doc = json!({"assets":{
        "clip":{"type":"video","src":"assets/clip.mp4"},
        "unused":{"type":"video","src":"assets/unused.mp4"}
    }});
    let assets = load_assets(&doc, dir.path()).unwrap();
    std::fs::remove_file(unused).unwrap();
    let mut media = MediaStore::new(Arc::new(assets), 25.0);
    media.video_frame("clip", 0.0).unwrap();
    std::fs::OpenOptions::new()
        .append(true)
        .open(asset)
        .unwrap()
        .write_all(b"changed")
        .unwrap();
    assert!(
        media
            .video_frame("clip", 0.04)
            .unwrap_err()
            .to_string()
            .contains("changed after preparation")
    );
}

#[test]
fn streamed_mix_matches_reference_across_windows_and_clip_block_boundaries() {
    let Some((dir, _)) = fixtures() else {
        return;
    };
    let doc = json!({
        "meta":{"id":"streamed","width":160,"height":90,"fps":25},
        "scenes":[{"id":"s","dur":6,"desc":"bounded audio"}],
        "assets":{"tone":{"type":"audio","src":"assets/tone.wav"}},
        "tracks":[{"id":"sound","kind":"audio","clips":[
            {"id":"a","start":3.70007,"end":5.6,"src":"$assets.tone","volume":0.8,
             "animate":{"keyframes":[{"prop":"volume","frames":[{"t":0,"v":0.1},{"t":1.9,"v":0.9}]}]}},
            {"id":"b","start":3.8,"end":5.5,"src":"$assets.tone","volume":0.4}
        ]}]
    });
    let assets = load_assets(&doc, dir.path()).unwrap();
    let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
    resolver.set_host_inputs(assets.inputs.clone());
    let mut ir = resolver.resolve().unwrap();
    // Exercise both the native and the streaming atempo decoder.
    ir.audio_clips[1].rate = 1.25;
    let expected = audio::mix_audio_reported(&ir, &assets).unwrap().unwrap();
    let actual = audio::mix_audio_file(&ir, &assets, &Default::default(), || Ok(()))
        .unwrap()
        .unwrap();
    assert_eq!(actual.clips, expected.clips);
    let wav = std::fs::read(actual.wav.path()).unwrap();
    assert_eq!(&wav[44..], expected.pcm);
    let info = media_probe::probe(actual.wav.path()).unwrap();
    assert!(info.has_audio());
    assert!(
        audio::mix_audio_file(&ir, &assets, &Default::default(), || anyhow::bail!(
            "cancelled"
        ))
        .is_err()
    );
}

/// Mix chain (§4 `audio`, §8.4 fades / pan / bus / muted): the in-memory and streaming paths are bit-for-bit identical, the master limits the true peak, and a muted track is equivalent to having no such track.
#[test]
fn mix_chain_streamed_matches_memory_and_muted_track_is_silent() {
    let Some((dir, _)) = fixtures() else {
        return;
    };
    let doc = |muted: bool, with_bed: bool| {
        let mut tracks = vec![json!({"id":"vo-sea","kind":"audio","clips":[
            {"id":"line","start":1.0,"end":3.0,"src":"$assets.tone","volume":0.5}
        ]})];
        if with_bed {
            tracks.push(
                json!({"id":"score-music","kind":"audio","muted":muted,"clips":[
                    {"id":"bed","start":0,"end":5.5,"src":"$assets.tone","volume":0.9,
                     "fadeIn":0.5,"fadeOut":1.0,"pan":-0.4}
                ]}),
            );
        }
        json!({
            "meta":{"id":"chain","width":160,"height":90,"fps":25},
            "scenes":[{"id":"s","dur":6,"desc":"mix chain"}],
            "assets":{"tone":{"type":"audio","src":"assets/tone.wav"}},
            "tracks":tracks,
            "audio":{"buses":{"music":{"gainDb":-2}},
                     "duck":[{"from":"vo","to":"music","depthDb":12}],
                     "master":{"lufs":-18,"truePeak":-1.5}}
        })
    };
    let resolved = |doc: Value| {
        let assets = load_assets(&doc, dir.path()).unwrap();
        let mut resolver = scene_primitives::Resolver::new(doc, None).unwrap();
        resolver.set_host_inputs(assets.inputs.clone());
        (resolver.resolve().unwrap(), assets)
    };
    let (ir, assets) = resolved(doc(false, true));
    assert_eq!(ir.audio_clips[1].bus, "music");
    let memory = audio::mix_audio_reported(&ir, &assets).unwrap().unwrap();
    let streamed = audio::mix_audio_file(&ir, &assets, &Default::default(), || Ok(()))
        .unwrap()
        .unwrap();
    assert_eq!(
        &std::fs::read(streamed.wav.path()).unwrap()[44..],
        memory.pcm
    );
    assert_eq!(streamed.master, memory.master);
    let master = memory.master.expect("wrote audio.master");
    assert!(master.true_peak <= -1.5 + 1e-6, "{master:?}");
    assert!((master.lufs + 18.0).abs() < 1.0, "{master:?}");

    // A narration is placed elsewhere on the timeline: ducking still follows it, the master does not apply it, and a warning is reported.
    let exclude = std::collections::BTreeSet::from(["line".to_string()]);
    let partial = audio::mix_audio_file(&ir, &assets, &exclude, || Ok(()))
        .unwrap()
        .unwrap();
    assert!(partial.master.is_none());
    assert!(partial.warnings[0].starts_with("audio-master-skipped"));

    // A muted track is bit-for-bit identical to deleting that track.
    let (muted_ir, assets) = resolved(doc(true, true));
    assert_eq!(muted_ir.audio_clips.len(), 2, "compilation keeps the clip on the muted track");
    let muted = audio::mix_audio_reported(&muted_ir, &assets)
        .unwrap()
        .unwrap();
    let (without_ir, assets) = resolved(doc(false, false));
    let without = audio::mix_audio_reported(&without_ir, &assets)
        .unwrap()
        .unwrap();
    assert_eq!(muted.pcm, without.pcm);
    assert_eq!(muted.clips, without.clips);
    assert_ne!(muted.pcm, memory.pcm);
}

/// A document with a single audio-track clip containing only `tone.wav` (always 1× speed).
fn mix_tone(dir: &Path) -> audio::AudioMix {
    mix(
        json!({
            "meta": { "id": "audio-backend", "width": 160, "height": 90, "fps": 25 },
            "scenes": [ { "id": "s", "dur": 1, "desc": "音频后端" } ],
            "assets": { "tone": { "type": "audio", "src": "assets/tone.wav" } },
            "tracks": [
                { "id": "sound", "kind": "audio", "clips": [
                    { "id": "bgm", "start": 0, "end": 1, "src": "$assets.tone", "volume": 1.0 }
                ] }
            ]
        }),
        dir,
    )
}

/// A clip expanded from `withAudio`: its speed is set by the video element's `playbackRate`. This is the **only** source of `AudioClip::rate != 1`.
fn mix_video_audio(dir: &Path, rate: f64) -> audio::AudioMix {
    mix(
        json!({
            "meta": { "id": "av-backend", "width": 160, "height": 90, "fps": 25 },
            "scenes": [ { "id": "s", "dur": 1, "desc": "withAudio 倍速" } ],
            "assets": { "av": { "type": "video", "src": "assets/av.mp4" } },
            "tracks": [
                { "id": "main", "kind": "visual", "clips": [
                    { "id": "shot", "start": 0, "end": 1, "element": {
                        "type": "video", "id": "v", "src": "$assets.av",
                        "withAudio": true, "playbackRate": rate, "volume": 1.0,
                        "style": { "x": 0, "y": 0, "width": 160, "height": 90 } } }
                ] }
            ]
        }),
        dir,
    )
}

/// Constant-speed audio clips go through Symphonia; variable-speed clips are left to ffmpeg's `atempo` (a WP6a trade-off: there is no pure-Rust implementation of pitch-preserving time stretching that can be safely adopted; see the header of `audio.rs`).
/// The output contract of the two paths (48 kHz stereo, length, level) must match.
#[test]
fn constant_rate_audio_uses_symphonia_and_rate_changed_audio_uses_ffmpeg() {
    let Some((dir, _assets)) = fixtures() else {
        return;
    };
    let mut measured = Vec::new();
    for (rate, expected) in [
        (1.0, audio::SYMPHONIA_BACKEND),
        (2.0, audio::FFMPEG_BACKEND),
    ] {
        let mix = mix_video_audio(dir.path(), rate);
        assert_eq!(
            mix.clips
                .iter()
                .map(|record| record.backend)
                .collect::<Vec<_>>(),
            vec![expected],
            "rate={rate} should use {expected}"
        );
        // The mix-length contract is independent of the backend: for the whole film, 1 second × 48 kHz × stereo × f32.
        assert_eq!(
            mix.pcm.len(),
            audio::SAMPLE_RATE as usize * 2 * 4,
            "PCM length for rate={rate}"
        );
        measured.push(middle_rms(&to_samples(&mix.pcm)));
    }
    // Variable speed changes the **timeline**, not the level: the same sine should have the same RMS at 1× and 2×.
    // This pins down “the backend changed but the sound did not”, without relying on the absolute amplitude of the lavfi sine.
    let (constant, stretched) = (measured[0], measured[1]);
    assert!(constant > 0.02, "constant-speed RMS {constant:.4} is abnormal (almost silent)");
    assert!(
        (constant - stretched).abs() < constant * 0.15,
        "Symphonia path RMS {constant:.4} differs too much from ffmpeg atempo path {stretched:.4}"
    );
}

/// Resampling correctness on the constant-speed path: the output of Symphonia + polyphase sinc (44.1 kHz → 48 kHz) and the output of `ffmpeg -f f32le -ac 2 -ar 48000` from before the migration match sample for sample in length, with RMS within 2%.
///
/// This is stronger than “comparing against itself”: the reference is **a real ffmpeg decode + swresample**, and what it measures is whether the sound changed after the decoder was swapped.
#[test]
fn the_symphonia_path_matches_the_ffmpeg_reference_pcm() {
    symphonia_matches_ffmpeg(2);
}

#[test]
fn mono_resampling_matches_the_ffmpeg_reference_pcm() {
    symphonia_matches_ffmpeg(1);
}

fn symphonia_matches_ffmpeg(channels: u16) {
    let Some((dir, assets)) = fixtures() else {
        return;
    };
    if channels == 1 {
        assert!(ff(&[
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2:sample_rate=44100",
            "-ac",
            "1",
            assets.join("tone.wav").to_str().unwrap(),
        ]));
    }
    let mix = mix_tone(dir.path());
    assert_eq!(mix.clips[0].backend, audio::SYMPHONIA_BACKEND);
    let ours = to_samples(&mix.pcm);

    let reference = Command::new("ffmpeg")
        .args(["-nostdin", "-loglevel", "error", "-t", "1.000000"])
        .arg("-i")
        .arg(assets.join("tone.wav"))
        .args(["-f", "f32le", "-ac", "2", "-ar", "48000", "-"])
        .stderr(Stdio::null())
        .output()
        .expect("ffmpeg reference decode");
    assert!(reference.status.success());
    let theirs = to_samples(&reference.stdout);
    // Both sides are 1 second of 48 kHz stereo. The mix side is zero-padded to the full film length, and the reference side is exactly the length given by -t.
    assert_eq!(
        theirs.len(),
        audio::SAMPLE_RATE as usize * 2,
        "reference PCM should be 1 second of stereo"
    );
    assert_eq!(ours.len(), theirs.len(), "both paths must produce the same number of samples");
    let (ours_rms, theirs_rms) = (middle_rms(&ours), middle_rms(&theirs));
    assert!(
        (ours_rms - theirs_rms).abs() < theirs_rms * 0.02,
        "Symphonia RMS {ours_rms:.5} and ffmpeg RMS {theirs_rms:.5} differ by more than 2%"
    );
    // Maximum per-sample deviation: the interpolation kernels for 44.1 → 48 differ, but on the same 440 Hz sine they should not differ by much.
    let worst = ours
        .iter()
        .zip(&theirs)
        .map(|(a, b)| (f64::from(*a) - f64::from(*b)).abs())
        .fold(0.0_f64, f64::max);
    assert!(
        worst < 0.05,
        "per-sample max deviation {worst:.5} is too large (full scale 1.0, sine amplitude about {:.3})",
        theirs_rms * std::f64::consts::SQRT_2
    );
    println!("symphonia rms={ours_rms:.5} ffmpeg rms={theirs_rms:.5} max per-sample deviation={worst:.5}");
}

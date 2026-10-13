//! Audio mixing (spec §8.4): clips are decoded to f32 PCM, the volume envelope is applied sample by sample on the Rust side (sample_frames is a pure function, so mixing is deterministic), multiple clips are summed into an f32le master mix, and that is merged into the MP4 as a second input during encoding.
//!
//! ## Decoding backend: constant speed via Symphonia, variable speed left to ffmpeg (WP6a)
//!
//! - **Constant-speed clips (`rate == 1`)**: [`decode`] uses Symphonia to decode, then polyphase sinc resampling to 48 kHz stereo. It is pure Rust and spawns no subprocess. Where it cannot (container or codec unsupported, or 3+ channels that need a downmix matrix), it falls back to ffmpeg.
//! - **Variable-speed clips (`rate != 1`)**: still `ffmpeg -filter:a atempo`. There is no pure Rust pitch-preserving time stretch that can be adopted safely. Among the candidates investigated: `wsola` (the only pure Rust one with quality comparable to atempo) has a single 0.1.0 release, its upstream is a personal repository, and the crate package ships no LICENSE file (the crate metadata says MIT, the repository says Apache-2.0). `signalsmith-stretch` has better quality and performance but is C++ FFI, which would add a C++ compiler and libclang dependency to every platform build (the Windows locked-build CI would be hit first). `timestretch` measured half of its output as silence at 0.25x. `rubato` is sample-rate conversion and does not preserve pitch at all. **Variable-speed material is a minority in BCF**, so it is not worth taking on these costs for it. Keeping ffmpeg is a deliberate trade-off, not an oversight.
//!
//! Which backend each clip actually used is reported by [`mix_audio_reported`] (`docs/design/bcf/cuccut-format-spec.md` §15.1, "the decoding backend must be observable").

mod chain;
mod decode;
mod streamed;
pub use chain::MasterMeasure;
pub use streamed::{FileAudioMix, mix_audio_file};

use crate::assets::LoadedAssets;
use anyhow::{Context, Result, anyhow, bail};
use scene_primitives::resolve::Ir;
use scene_primitives::sample::sample_frames;

pub const SAMPLE_RATE: u32 = 48_000;
pub const CHANNELS: usize = 2;

/// Identifier of the pure Rust decoding backend.
pub const SYMPHONIA_BACKEND: &str = "symphonia";
/// Identifier of the ffmpeg fallback decoding backend (same name as [`crate::media::FFMPEG_BACKEND`]).
pub const FFMPEG_BACKEND: &str = "ffmpeg";

/// The decoding record for one audio clip.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClipDecodeRecord {
    pub clip_id: String,
    /// [`SYMPHONIA_BACKEND`] or [`FFMPEG_BACKEND`].
    pub backend: &'static str,
}

/// The output of one full-timeline mix.
pub struct AudioMix {
    /// f32le interleaved stereo bytes.
    pub pcm: Vec<u8>,
    /// Decoding backend per clip (same order as `ir.audio_clips`; zero-duration and muted clips are skipped).
    pub clips: Vec<ClipDecodeRecord>,
    /// Mastering measurements, when the document specifies `audio.master`.
    pub master: Option<MasterMeasure>,
}

/// Whether this IR goes through the mixing chain (§4 `audio`, §8.4 fades and panning). When it does not, the old path is used, and the output is bit-identical to what it was before these fields existed. Muted clips are skipped directly on both paths.
fn needs_chain(ir: &Ir) -> bool {
    ir.audio.is_some() || ir.audio_clips.iter().any(|c| !c.muted && !c.is_plain())
}

/// Mastering for an already-mixed full PCM (48 kHz interleaved stereo f32): loudness normalization and true-peak limiting alternate over three rounds, followed by a static true-peak fallback. Used by `ccut export --loudness / --true-peak`.
pub fn master_interleaved(
    pcm: &[f32],
    target: scene_primitives::audio_mix::MasterTarget,
) -> Result<(Vec<f32>, MasterMeasure)> {
    let frames = (pcm.len() / CHANNELS) as u64;
    let clip = scene_primitives::resolve::AudioClip {
        id: "master".into(),
        asset_id: String::new(),
        start: 0.0,
        end: frames as f64 / SAMPLE_RATE as f64,
        media_start: 0.0,
        rate: 1.0,
        media_duration: 0.0,
        base_volume: 1.0,
        volume: Vec::new(),
        track: None,
        fade_in: 0.0,
        fade_out: 0.0,
        fade_span: (0.0, 0.0),
        pan: 0.0,
        bus: scene_primitives::audio_mix::MAIN_BUS.into(),
        muted: false,
    };
    let clips = [chain::ChainClip {
        clip: &clip,
        pcm: chain::ClipPcm::Mem(pcm.to_vec()),
        frames,
        start: 0,
        audible: true,
    }];
    let mut out = Vec::with_capacity(pcm.len());
    let report = chain::run(
        frames,
        &clips,
        &scene_primitives::audio_mix::DocAudio::default(),
        Some(target),
        false,
        chain::WINDOW,
        &mut |x| {
            out.extend_from_slice(x);
            Ok(())
        },
        &mut || Ok(()),
    )?;
    let measure = report.master.context("the master produced no measurement")?;
    Ok((out, measure))
}

/// Decodes the samples of the first audio track of `path` over `[start, start + duration)` in pure Rust, yielding 48 kHz interleaved stereo f32 ([`SAMPLE_RATE`] / [`CHANNELS`]).
///
/// The semantics match `ffmpeg -ss <start> -t <duration> -i <src> -f f32le -ac 2 -ar 48000 -`. `Err` always means "this source cannot be handled by the pure Rust path" (container or codec unsupported, or 3+ channels that need a downmix matrix), and the caller then falls back to ffmpeg. **Pitch-preserving speed change still has no pure Rust implementation**, so variable-speed material must not be passed in here.
///
/// Besides this module's mixing, the timeline assembly in `apps/cli` (`services/timeline_media`) also uses it to lay out the main track and audio elements. Both paths need a "48 kHz stereo f32 window", so it should not be written twice.
pub fn decode_stereo_48k(path: &std::path::Path, start: f64, duration: f64) -> Result<Vec<f32>> {
    decode::decode_stereo_48k(path, start, duration)
}

/// Decodes the whole first audio track of `path` in pure Rust, yielding 48 kHz mono f32: channels are averaged, and a mono source is used as-is. The spectrum of the sound wave (BCS1) is computed from it. On `Err` the caller falls back to ffmpeg.
pub fn decode_mono_48k(path: &std::path::Path) -> Result<Vec<f32>> {
    decode::decode_mono_48k(path)
}

/// Full-timeline mix → f32le interleaved stereo bytes. Returns None when there are no audio clips.
pub fn mix_audio(ir: &Ir, assets: &LoadedAssets) -> Result<Option<Vec<u8>>> {
    Ok(mix_audio_reported(ir, assets)?.map(|mix| mix.pcm))
}

/// Same as [`mix_audio`], also carrying the per-clip decoding backend record.
pub fn mix_audio_reported(ir: &Ir, assets: &LoadedAssets) -> Result<Option<AudioMix>> {
    if ir.audio_clips.is_empty() {
        return Ok(None);
    }
    let sr = SAMPLE_RATE as f64;
    let total_frames = (ir.total * sr).round() as usize;
    let chained = needs_chain(ir);
    let mut master = vec![0f32; if chained { 0 } else { total_frames * CHANNELS }];
    let mut records = Vec::with_capacity(ir.audio_clips.len());
    let mut decoded = Vec::new();

    for clip in &ir.audio_clips {
        if clip.muted {
            continue;
        }
        // Clips expanded from withAudio reference a video asset: the audio track is taken directly from the video file (§6.5).
        let path = assets
            .audios
            .get(&clip.asset_id)
            .or_else(|| assets.videos.get(&clip.asset_id).map(|v| &v.path))
            .ok_or_else(|| anyhow!("audio resource \"{}\" is not loaded", clip.asset_id))?;
        let dur = (clip.end - clip.start).max(0.0);
        if dur <= 0.0 {
            continue;
        }
        let rate = if clip.rate > 0.0 { clip.rate } else { 1.0 };
        // The source side needs dur × rate seconds of material (back to dur seconds after atempo).
        let source_seconds = dur * rate;
        let constant_rate = (rate - 1.0).abs() <= 1e-9;
        let (samples, backend) = match constant_rate
            .then(|| decode::decode_stereo_48k(path, clip.media_start, source_seconds))
        {
            Some(Ok(samples)) => (samples, SYMPHONIA_BACKEND),
            // Pure Rust cannot handle it (or it is a variable-speed clip to begin with): fall back to ffmpeg.
            _ => (
                decode_with_ffmpeg(&clip.id, path, clip.media_start, source_seconds, rate)?,
                FFMPEG_BACKEND,
            ),
        };
        records.push(ClipDecodeRecord {
            clip_id: clip.id.clone(),
            backend,
        });
        let clip_frames = samples.len() / CHANNELS;
        let start_frame = (clip.start * sr).round() as usize;
        if chained {
            decoded.push(chain::ChainClip {
                clip,
                frames: clip_frames as u64,
                pcm: chain::ClipPcm::Mem(samples),
                start: start_frame as u64,
                audible: true,
            });
            continue;
        }

        // Volume envelope: sampled in blocks of 64 frames (≈1.3 ms), constant within each block
        const BLOCK: usize = 64;
        let mut i = 0usize;
        while i < clip_frames {
            let gi = start_frame + i;
            if gi >= total_frames {
                break;
            }
            let t = clip.start + i as f64 / sr;
            let vol = if clip.volume.is_empty() {
                clip.base_volume
            } else {
                sample_frames(&clip.volume, t)
                    .as_f64()
                    .unwrap_or(clip.base_volume)
            } as f32;
            let n = BLOCK.min(clip_frames - i).min(total_frames - gi);
            for k in 0..n * CHANNELS {
                master[gi * CHANNELS + k] += samples[i * CHANNELS + k] * vol;
            }
            i += n;
        }
    }

    if chained {
        let doc = ir.audio.clone().unwrap_or_default();
        let mut bytes = Vec::with_capacity(total_frames * CHANNELS * 4);
        let report = chain::run(
            total_frames as u64,
            &decoded,
            &doc,
            doc.master,
            false,
            chain::WINDOW,
            &mut |x| {
                for s in x {
                    bytes.extend_from_slice(&s.to_le_bytes());
                }
                Ok(())
            },
            &mut || Ok(()),
        )?;
        return Ok(Some(AudioMix {
            pcm: bytes,
            clips: records,
            master: report.master,
        }));
    }
    let mut bytes = Vec::with_capacity(master.len() * 4);
    for s in &master {
        bytes.extend_from_slice(&s.clamp(-1.0, 1.0).to_le_bytes());
    }
    Ok(Some(AudioMix {
        pcm: bytes,
        clips: records,
        master: None,
    }))
}

/// ffmpeg fallback decoding: `-ss`/`-t` for windowing, `atempo` stacked when the speed changes, output 48 kHz stereo f32.
fn decode_with_ffmpeg(
    clip_id: &str,
    path: &std::path::Path,
    media_start: f64,
    source_seconds: f64,
    rate: f64,
) -> Result<Vec<f32>> {
    let out = ffmpeg_decode_command(path, media_start, source_seconds, rate)
        .output()
        .context("failed to start ffmpeg audio decode")?;
    if !out.status.success() {
        bail!(
            "audio clip \"{clip_id}\" failed to decode: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }
    Ok(out
        .stdout
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect())
}

fn ffmpeg_decode_command(
    path: &std::path::Path,
    media_start: f64,
    source_seconds: f64,
    rate: f64,
) -> std::process::Command {
    let mut cmd = crate::exec::command("ffmpeg");
    cmd.args([
        "-loglevel",
        "error",
        "-ss",
        &format!("{media_start:.6}"),
        "-t",
        &format!("{source_seconds:.6}"),
    ])
    .arg("-i")
    .arg(path);
    if (rate - 1.0).abs() > 1e-9 {
        cmd.args(["-filter:a", &atempo_chain(rate)]);
    }
    cmd.args(["-f", "f32le", "-ac", "2", "-ar", "48000", "-"]);
    cmd
}

/// A single ffmpeg atempo filter stage only accepts [0.5, 100]; speeds below 0.5 are expressed by cascading stages.
fn atempo_chain(rate: f64) -> String {
    let mut stages: Vec<String> = Vec::new();
    let mut r = rate;
    while r < 0.5 {
        stages.push("atempo=0.5".into());
        r /= 0.5;
    }
    stages.push(format!("atempo={r:.6}"));
    stages.join(",")
}

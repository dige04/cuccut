//! Source conformance for `VizTrack` (element plan ADR-E04 / §8.7).
//!
//! The four sampling obligations are identical to those of `AnimatedImage` / `Lottie`; only "one frame" is replaced by "a spectrum":
//! * **Direct seek to any instant** — `a_cold_track_seeks_straight_to_any_instant`
//! * **In-order == out-of-order** — `shuffled_sampling_equals_sorted_sampling`
//! * **Sub-resources enter the hash** — `the_fingerprint_covers_the_spectrum_and_the_params`
//! * **The source holds no incremental clock** — `sampling_takes_only_a_shared_reference`
//!
//! The fixtures are in `core/fixtures/visualizer/`: `cases.json` is the **input** (two fixed BCS1 files × four sets of element parameters × an instant table + an out-of-order sequence), and `expected-track.json` is this stage's golden. The P3 / P5 / P6 executors reuse the same `cases.json`, each appending its own expected file (convention in the fixture README).

use std::path::{Path, PathBuf};

use render_raster::drawop::fnv1a64;
use render_raster::source::visualizer::{VizFrame, VizParams, VizSource, VizTrack};
use serde_json::{Value, json};
use waveform::bcs1;

// ── Programmatic generator side of the fixture ───────────────────────────────

/// Number of frames of the synthetic spectrum: 3.0 s × 60 Hz. The largest instant in the time table, 2.5 s, therefore **falls within the track**, rather than all hitting the last frame.
const SWEEP_FRAMES: usize = 180;

/// Seed for the out-of-order sequence (motion stage 0's approach: splitmix64 + Fisher–Yates).
const SHUFFLE_SEED: u64 = 0x5EED_5EED_5EED_5EED;

/// Sampling instant table (the five instants frozen in design §8.7).
const INSTANTS: [f64; 5] = [0.0, 0.1, 0.5, 1.0, 2.5];

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/visualizer")
}

fn spectrum_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/spectrum")
}

fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// A programmatically generated 3 s BCS1.
///
/// **Deliberately does not go through `dsp::analyze`**: that path's bytes depend on rustfft's trigonometric functions, and nobody has promised bit-identical results across platforms. This fixture pins the chain "remap → smooth → round → table lookup", and canonical bytes built with **pure integer arithmetic** are better suited as its input. The real DSP byte golden is handled by P1's `core/fixtures/spectrum/tone-48k-mono-f32.bcs1`; this use case runs it as a second input alongside.
fn synth_spectrum(frames: usize) -> Vec<u8> {
    let time_bins = bcs1::TIME_BINS as usize;
    let freq_bins = bcs1::FREQ_BINS as usize;
    let mut payload = Vec::with_capacity(frames * bcs1::FRAME_LEN);
    let mut state = 0x0BCD_5EED_0BCD_5EEDu64;
    for frame in 0..frames {
        // Time-domain row: a triangle wave whose period and amplitude oscillate slowly with the frame number, centered at 128 (the silence baseline).
        let period = 8 + frame % 17;
        let amplitude = 20 + (frame * 7) % 100;
        for bin in 0..time_bins {
            let phase = (bin + frame) % period;
            let ramp = if phase * 2 <= period {
                phase * 2
            } else {
                period * 2 - phase * 2
            };
            let value = 128 + (ramp * 2 * amplitude / period) as i64 - amplitude as i64;
            payload.push(value.clamp(0, 255) as u8);
        }
        // Frequency-domain row: strong at low frequencies, attenuated at high frequencies, with three formant peaks, frame-level pulses, plus low-amplitude deterministic jitter.
        let pulse = (40 + (frame * 13) % 60) as i64;
        for bin in 0..freq_bins {
            let decay = 200 - (bin as i64 * 200 / 96).min(200);
            let mut bump = 0i64;
            for (center, width, height) in [(12i64, 6i64, 45i64), (40, 10, 30), (88, 14, 20)] {
                let distance = (bin as i64 - center).abs();
                if distance < width {
                    bump += height * (width - distance) / width;
                }
            }
            let jitter = (splitmix64(&mut state) % 9) as i64 - 4;
            let value = decay + bump + pulse * decay / 255 + jitter;
            payload.push(value.clamp(0, 255) as u8);
        }
    }
    let hash = fnv1a64(&payload);
    bcs1::encode(
        &bcs1::Bcs1Header::new(bcs1::SpectrumBackend::Symphonia, frames as u32, hash),
        &payload,
    )
    .expect("synthesized BCS1 must be self-consistent")
}

/// Four sets of element parameters: covering the canonical identity window, the newly created default window, the bicubic all-bins window, and gain amplification.
fn param_sets() -> Vec<(&'static str, VizParams)> {
    vec![
        (
            "canonical",
            VizParams {
                min_db: -120.0,
                max_db: 40.0,
                smoothing: 0.0,
                gain: 1.0,
            },
        ),
        (
            "default",
            VizParams {
                min_db: -80.0,
                max_db: 40.0,
                smoothing: 0.8,
                gain: 1.0,
            },
        ),
        (
            "bicubic",
            VizParams {
                min_db: -120.0,
                max_db: -10.0,
                smoothing: 0.5,
                gain: 1.0,
            },
        ),
        (
            "hot",
            VizParams {
                min_db: -80.0,
                max_db: 40.0,
                smoothing: 0.8,
                gain: 2.5,
            },
        ),
    ]
}

fn spectra() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        (
            "tone",
            "../spectrum/tone-48k-mono-f32.bcs1",
            "P1 的真实 DSP golden，0.2 s：时刻表里 0.5 / 1.0 / 2.5 全部越界，专钉 clamp",
        ),
        (
            "sweep",
            "sweep-48k-mono.bcs1",
            "程序生成的 3.0 s 合成频谱：五个时刻全部落在轨内",
        ),
    ]
}

/// Sampling sequence = the Cartesian product of (spectrum × parameter set × instant), numbered in the order written in `cases.json`. The three executors share this numbering; `shuffle.order` is a permutation of it.
fn sequence_len() -> usize {
    spectra().len() * param_sets().len() * INSTANTS.len()
}

fn shuffled_order() -> Vec<usize> {
    let mut order: Vec<usize> = (0..sequence_len()).collect();
    let mut state = SHUFFLE_SEED;
    for index in (1..order.len()).rev() {
        let pick = (splitmix64(&mut state) % (index as u64 + 1)) as usize;
        order.swap(index, pick);
    }
    order
}

fn cases_json() -> Value {
    json!({
        "note": "P2 conformance 夹具的**输入**。P3 / P5 / P6 复用同一份，各自追加 expected-*.json。",
        "spectra": spectra()
            .into_iter()
            .map(|(name, path, note)| json!({"name": name, "path": path, "note": note}))
            .collect::<Vec<_>>(),
        "params": param_sets()
            .into_iter()
            .map(|(name, params)| json!({
                "name": name,
                "minDb": params.min_db,
                "maxDb": params.max_db,
                "smoothing": params.smoothing,
                "gain": params.gain,
            }))
            .collect::<Vec<_>>(),
        "instants": INSTANTS.to_vec(),
        "sequence": {
            "order": "spectra × params × instants，按本文件的书写顺序展开",
            "length": sequence_len(),
        },
        "shuffle": {
            "algorithm": "splitmix64 + Fisher–Yates（自 len-1 递减，pick = next % (i+1)）",
            "seed": format!("0x{SHUFFLE_SEED:016X}"),
            "order": shuffled_order(),
        },
        "styles": motion::preset_registry::timeline_visualizers()
            .iter()
            .map(|recipe| recipe.qualified_id())
            .collect::<Vec<_>>(),
    })
}

fn row_digest(row: &[u8]) -> String {
    format!("{:016x}", fnv1a64(row))
}

fn load_spectrum(relative: &str) -> Vec<u8> {
    if let Some(name) = relative.strip_prefix("../spectrum/") {
        let path = spectrum_dir().join(name);
        return std::fs::read(&path).unwrap_or_else(|e| panic!("reading {}: {e}", path.display()));
    }
    if relative == "sweep-48k-mono.bcs1" {
        // The generator and the consumer share the same function, so the gate is "recompute on the spot, then compare byte for byte".
        return synth_spectrum(SWEEP_FRAMES);
    }
    panic!("cases.json contains unknown spectrum {relative}");
}

fn tracks() -> Vec<(String, String, VizTrack)> {
    let mut out = Vec::new();
    for (spectrum_name, path, _) in spectra() {
        let bytes = load_spectrum(path);
        for (param_name, params) in param_sets() {
            let track = VizTrack::derive(&bytes, params)
                .unwrap_or_else(|e| panic!("{spectrum_name}/{param_name} derivation failed: {e:#}"));
            out.push((spectrum_name.to_owned(), param_name.to_owned(), track));
        }
    }
    out
}

fn expected_json() -> Value {
    let entries = tracks()
        .into_iter()
        .map(|(spectrum, params, track)| {
            let samples = INSTANTS
                .iter()
                .map(|instant| {
                    let index = track.frame_index_at(*instant).expect("track is non-empty");
                    let frame = track.sample(*instant).expect("track is non-empty");
                    json!({
                        "t": instant,
                        "index": index,
                        "timeDigest": row_digest(&frame.time),
                        "freqDigest": row_digest(&frame.freq),
                        "freqHead": frame.freq_window(8).to_vec(),
                    })
                })
                .collect::<Vec<_>>();
            json!({
                "spectrum": spectrum,
                "params": params,
                "analysisRate": track.analysis_rate(),
                "frameCount": track.frame_count(),
                "timeBins": track.time_bins(),
                "freqBins": track.freq_bins(),
                "fingerprint": track.fingerprint().to_string(),
                "samples": samples,
            })
        })
        .collect::<Vec<_>>();
    json!({
        "note": "P2 golden：整轨指纹 + 五个时刻的帧号与逐行摘要。改了派生语义才该动它。",
        "tracks": entries,
    })
}

fn pretty(value: &Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec_pretty(value).expect("serialize fixture");
    bytes.push(b'\n');
    bytes
}

/// Regenerate the fixture. Run only after confirming:
/// `cargo test -p ccut-render --test visualizer_source -- --ignored`
#[test]
#[ignore]
fn write_visualizer_fixtures() {
    let dir = fixture_dir();
    std::fs::create_dir_all(&dir).expect("create fixture directory");
    std::fs::write(
        dir.join("sweep-48k-mono.bcs1"),
        synth_spectrum(SWEEP_FRAMES),
    )
    .unwrap();
    std::fs::write(dir.join("cases.json"), pretty(&cases_json())).unwrap();
    std::fs::write(dir.join("expected-track.json"), pretty(&expected_json())).unwrap();
}

/// Daily gate: recompute on the spot and compare byte for byte, catching "changed the generator but forgot to write to disk".
#[test]
fn visualizer_fixtures_are_up_to_date() {
    let dir = fixture_dir();
    for (name, expected) in [
        ("sweep-48k-mono.bcs1", synth_spectrum(SWEEP_FRAMES)),
        ("cases.json", pretty(&cases_json())),
        ("expected-track.json", pretty(&expected_json())),
    ] {
        let path = dir.join(name);
        let actual = std::fs::read(&path).unwrap_or_else(|e| {
            panic!("{name} is missing (run --ignored write_visualizer_fixtures): {e}")
        });
        assert_eq!(actual, expected, "{name} does not match the generator");
    }
}

// ── Sampling rules ───────────────────────────────────────────────────────

/// The rounding rule is part of the contract: `floor(t × analysisRate)`, with no interpolation and no rounding.
/// The source of truth lives in `waveform::bcs1::frame_index_at`. This cross-check ensures that `VizTrack` and the BCS1 format layer give the **same frame index at every instant**, rather than each writing its own floor.
#[test]
fn the_rounding_rule_matches_the_spectrum_format_layer() {
    for (_, path, _) in spectra() {
        let bytes = load_spectrum(path);
        let view = bcs1::parse(&bytes).unwrap();
        let track = VizTrack::derive(&bytes, param_sets()[0].1).unwrap();
        assert_eq!(track.frame_count(), view.frame_count());
        for step in -50..4000 {
            let seconds = f64::from(step) / 1000.0;
            assert_eq!(
                track.frame_index_at(seconds),
                view.frame_index_at(seconds),
                "{seconds}s"
            );
        }
        // On either side of a frame boundary: slightly earlier than 1 / analysisRate is still frame 0; exactly on the boundary it is already frame 1.
        let first_boundary = 1.0 / f64::from(view.header().analysis_rate);
        assert_eq!(track.frame_index_at(first_boundary - f64::EPSILON), Some(0));
        assert_eq!(track.frame_index_at(first_boundary), Some(1));
    }
}

/// Out-of-range values are always clamped: negative instants land on the first frame, instants after the end freeze on the last frame, and NaN / infinity are treated as the first frame.
#[test]
fn out_of_range_instants_clamp_instead_of_failing() {
    let bytes = load_spectrum("../spectrum/tone-48k-mono-f32.bcs1");
    let track = VizTrack::derive(&bytes, param_sets()[1].1).unwrap();
    let last = track.frame_count() - 1;
    assert_eq!(track.frame_index_at(-3.0), Some(0));
    assert_eq!(track.frame_index_at(f64::NEG_INFINITY), Some(0));
    assert_eq!(track.frame_index_at(f64::NAN), Some(0));
    assert_eq!(track.frame_index_at(1e9), Some(last));
    // `+∞` takes the "non-finite → frame 0" branch (behavior frozen in P1, the same path as NaN), not "too large → out of range → last frame". It is pinned here honestly, so that no one later mistakes it for a bug and changes it in passing. The source of truth is `waveform::bcs1::frame_index_at`; changing it means changing BCS1 too.
    assert_eq!(track.frame_index_at(f64::INFINITY), Some(0));
    // All three out-of-range instants in the time table map to the same frame. This is exactly why the tone fixture exists.
    assert_eq!(track.sample(0.5), track.sample(2.5));
    assert_eq!(track.sample(2.5).unwrap(), track.frame(last).unwrap());
}

/// **Mandatory for conformance**: out-of-order sampling and in-order sampling are bit-for-bit identical.
///
/// The sequence is the (spectrum × parameter × instant) Cartesian product of `cases.json`, permuted with the splitmix64 Fisher–Yates from the fixture. The source has no mutable state at all, so this can only pass if that is true.
#[test]
fn shuffled_sampling_equals_sorted_sampling() {
    let all = tracks();
    let read = |index: usize| -> (usize, String, String) {
        let instant = INSTANTS[index % INSTANTS.len()];
        let (_, _, track) = &all[index / INSTANTS.len()];
        let frame = track.sample(instant).expect("track is non-empty");
        (
            track.frame_index_at(instant).unwrap(),
            row_digest(&frame.time),
            row_digest(&frame.freq),
        )
    };
    let sorted: Vec<_> = (0..sequence_len()).map(read).collect();
    let mut shuffled = vec![(usize::MAX, String::new(), String::new()); sequence_len()];
    for index in shuffled_order() {
        shuffled[index] = read(index);
    }
    assert_eq!(sorted, shuffled);
    // The permutation itself must be a real permutation; otherwise the assertion above could be fooled by "executing in order".
    let mut seen = shuffled_order();
    seen.sort_unstable();
    assert_eq!(seen, (0..sequence_len()).collect::<Vec<_>>());
    assert_ne!(shuffled_order(), (0..sequence_len()).collect::<Vec<_>>());
}

/// A cold track jumping straight to any instant is byte-identical to "playing through from the start and then jumping": there is no warm-up.
#[test]
fn a_cold_track_seeks_straight_to_any_instant() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let cold = VizTrack::derive(&bytes, param_sets()[3].1).unwrap();
    let warm = VizTrack::derive(&bytes, param_sets()[3].1).unwrap();
    for step in 0..120 {
        let _ = warm.sample(f64::from(step) * 0.025);
    }
    for instant in INSTANTS {
        assert_eq!(cold.sample(instant), warm.sample(instant), "{instant}s");
    }
}

/// Sampling takes only a shared reference: repeated sampling through `&dyn VizSource` is the identity, and the source contains no incremental clock to hold.
#[test]
fn sampling_takes_only_a_shared_reference() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let track = VizTrack::derive(&bytes, param_sets()[1].1).unwrap();
    let source: &dyn VizSource = &track;
    let first = source.sample(1.0).unwrap().clone();
    for _ in 0..5 {
        assert_eq!(source.sample(1.0).unwrap(), &first);
    }
}

// ── Derived semantics ───────────────────────────────────────────────────────

/// Smoothing recurrence golden: `y[n] = τ·y[n-1] + (1-τ)·x[n]`, `y[-1] = 0`, **advanced in order from frame 0**, with gain multiplied at the last step and not entering the recurrence state.
///
/// This test does not read the fixture. It compares byte for byte the result of deriving the whole track against `waveform::remap::Remapper`'s frame-by-frame advance, pinning that "deriving the whole track did not advance in the wrong order and did not fold gain into the state".
#[test]
fn the_smoothing_recursion_matches_the_reference_advance() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let view = bcs1::parse(&bytes).unwrap();
    for (name, params) in param_sets() {
        let track = VizTrack::derive(&bytes, params).unwrap();
        let mut reference = waveform::remap::Remapper::new(
            view.header().freq_bins as usize,
            params.min_db,
            params.max_db,
            params.smoothing,
            params.gain,
        );
        for index in 0..view.frame_count() {
            let expected = reference.map_row(view.freq_row(index).unwrap());
            assert_eq!(
                track.frame(index).unwrap().freq.as_ref(),
                expected.as_slice(),
                "{name} frequency row of frame {index}"
            );
        }
    }
    // The first three frames for τ = 0.8 are fixed: `x` is always canonical 255 (= 100 in linear amplitude); in the linear domain we get 20 / 36 / 48.8, which is then converted to dB and mapped to [-80, 40].
    let flat = flat_spectrum(255);
    let track = VizTrack::derive(
        &flat,
        VizParams {
            min_db: -80.0,
            max_db: 40.0,
            smoothing: 0.8,
            gain: 1.0,
        },
    )
    .unwrap();
    assert_eq!(track.frame(0).unwrap().freq[0], 225);
    assert_eq!(track.frame(1).unwrap().freq[0], 236);
    assert_eq!(track.frame(2).unwrap().freq[0], 242);
}

fn flat_spectrum(freq_byte: u8) -> Vec<u8> {
    let mut payload = Vec::new();
    for _ in 0..8 {
        payload.extend(std::iter::repeat_n(128u8, bcs1::TIME_BINS as usize));
        payload.extend(std::iter::repeat_n(freq_byte, bcs1::FREQ_BINS as usize));
    }
    bcs1::encode(
        &bcs1::Bcs1Header::new(bcs1::SpectrumBackend::Symphonia, 8, 7),
        &payload,
    )
    .unwrap()
}

/// **The time-domain row is carried through unchanged**: the dB window, smoothing and gain act only on the frequency-domain row.
///
/// The basis is Web Audio semantics (`smoothingTimeConstant` only governs `getByteFrequencyData`), and common sense as well: applying a dB window to a centered waveform where "silence ≈ 128" makes no sense. This is one refinement of this stage relative to the ADR-E04 text, recorded in the implementation notes.
#[test]
fn the_time_row_is_carried_through_verbatim() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let view = bcs1::parse(&bytes).unwrap();
    for (name, params) in param_sets() {
        let track = VizTrack::derive(&bytes, params).unwrap();
        for index in 0..view.frame_count() {
            assert_eq!(
                track.frame(index).unwrap().time.as_ref(),
                view.time_row(index).unwrap(),
                "{name} time-domain row of frame {index}"
            );
        }
    }
}

/// The fingerprint covers the upstream BCS1 and the derived parameters: changing one byte or one dB endpoint changes the fingerprint; deriving twice from the same input gives the same fingerprint.
#[test]
fn the_fingerprint_covers_the_spectrum_and_the_params() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let base = VizTrack::derive(&bytes, param_sets()[1].1).unwrap();
    assert_eq!(
        base.fingerprint(),
        VizTrack::derive(&bytes, param_sets()[1].1)
            .unwrap()
            .fingerprint(),
        "same bytes and same parameters must give the same fingerprint"
    );
    for (name, params) in param_sets() {
        if name == "default" {
            continue;
        }
        assert_ne!(
            base.fingerprint(),
            VizTrack::derive(&bytes, params).unwrap().fingerprint(),
            "parameter set {name} must change the fingerprint"
        );
    }
    // Changing one payload byte → changes the BCS1 content_hash → changes the track fingerprint.
    let mut tweaked = bytes.clone();
    let offset = bcs1::HEADER_LEN + bcs1::TIME_BINS as usize;
    tweaked[offset] = tweaked[offset].wrapping_add(1);
    assert_ne!(
        base.fingerprint(),
        VizTrack::derive(&tweaked, param_sets()[1].1)
            .unwrap()
            .fingerprint()
    );
}

/// The fixture golden matches the current implementation (`expected-track.json` is its written form).
#[test]
fn the_committed_golden_matches_the_derivation() {
    let path = fixture_dir().join("expected-track.json");
    let committed: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(committed, expected_json());
    // The golden must actually contain 8 tracks (2 spectra × 4 parameter sets).
    assert_eq!(committed["tracks"].as_array().unwrap().len(), 8);
}

/// `VizFrame` is pure data; the widths of both rows come from BCS1, not from the recipe. Choosing the window for `binWidth` is a drawing-time matter (§8.4).
#[test]
fn the_row_widths_come_from_the_spectrum_not_from_the_recipe() {
    let bytes = load_spectrum("sweep-48k-mono.bcs1");
    let track = VizTrack::derive(&bytes, param_sets()[0].1).unwrap();
    assert_eq!(track.time_bins(), bcs1::TIME_BINS as usize);
    assert_eq!(track.freq_bins(), bcs1::FREQ_BINS as usize);
    let frame: &VizFrame = track.sample(1.0).unwrap();
    assert_eq!(frame.freq_window(64).len(), 64);
    assert_eq!(frame.freq_window(512).len(), 512);
}

//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

//! Media pipeline integration tests (self-generated assets; requires ffmpeg/ffprobe on PATH):
//! asset loading + hash verification / strict document fonts / image, svg and video rasterization /
//! byte-level determinism of DrawOps / audio mix envelope.

use render_raster::{FrameRenderer, MediaStore, TextEngine, drawop, load_assets};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

fn ff(args: &[&str]) {
    let st = Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error"])
        .args(args)
        .status()
        .expect("ffmpeg must be on PATH");
    assert!(st.success(), "ffmpeg {args:?}");
}

fn find_font() -> PathBuf {
    for c in [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Verdana.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ] {
        if Path::new(c).is_file() {
            return PathBuf::from(c);
        }
    }
    panic!("no system font found");
}

/// Generate the one-off test asset directory (idempotent within the process)
fn assets_dir() -> PathBuf {
    static DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    DIR.get_or_init(make_assets_dir).clone()
}

fn make_assets_dir() -> PathBuf {
    // A suite owns its fixture directory; parallel tests never rewrite a loaded asset.
    let dir = tempfile::Builder::new()
        .prefix("ccut-media-fixtures-")
        .tempdir()
        .unwrap()
        .keep();
    let a = dir.join("assets");
    std::fs::create_dir_all(&a).unwrap();
    if !a.join("card.png").exists() {
        ff(&[
            "-f",
            "lavfi",
            "-i",
            "color=c=0x3a6ea5:s=320x240:d=1",
            "-frames:v",
            "1",
            a.join("card.png").to_str().unwrap(),
        ]);
    }
    if !a.join("clip.mp4").exists() {
        ff(&[
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=640x360:rate=30:duration=3",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-crf",
            "20",
            a.join("clip.mp4").to_str().unwrap(),
        ]);
    }
    if !a.join("tone.wav").exists() {
        ff(&[
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=6",
            "-ac",
            "2",
            a.join("tone.wav").to_str().unwrap(),
        ]);
    }
    std::fs::write(
        a.join("logo.svg"),
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect x="8" y="8" width="104" height="104" rx="24" fill="#e8906a"/></svg>"##,
    )
    .unwrap();
    if !a.join("main.ttf").exists() {
        let font = std::fs::read(find_font()).unwrap();
        std::fs::write(a.join("main.ttf"), font).unwrap();
    }
    dir
}

fn demo_doc() -> Value {
    json!({
        "meta": { "id": "media-demo", "width": 960, "height": 540, "fps": 30, "background": "#101014" },
        "scenes": [
            { "id": "intro",   "dur": 3, "desc": "标题与图片" },
            { "id": "footage", "dur": 4, "desc": "视频素材 + 音量闪避" }
        ],
        "assets": {
            "card": { "type": "image", "src": "assets/card.png" },
            "logo": { "type": "image", "src": "assets/logo.svg" },
            "clip": { "type": "video", "src": "assets/clip.mp4" },
            "tone": { "type": "audio", "src": "assets/tone.wav" },
            "main": { "type": "font",  "src": "assets/main.ttf" }
        },
        "tracks": [
            { "id": "main", "kind": "visual", "clips": [
                { "id": "intro-shot", "start": 0, "end": "@intro.end",
                  "element": { "type": "box", "id": "r1",
                    "style": { "width": 960, "height": 540 },
                    "children": [
                        { "type": "image", "id": "card", "src": "$assets.card",
                          "style": { "x": 100, "y": 100, "width": 320 } },
                        { "type": "image", "id": "logo", "src": "$assets.logo",
                          "style": { "x": 600, "y": 100, "width": 96 } },
                        { "type": "text", "id": "t", "text": "Media Demo",
                          "style": { "x": 100, "y": 420, "fontSize": 48, "color": "#f6f4ef" } }
                    ] } },
                { "id": "footage-shot", "start": "@footage", "end": "@footage.end",
                  "element": { "type": "box", "id": "r2",
                    "style": { "width": 960, "height": 540 },
                    "children": [
                        { "type": "video", "id": "v", "src": "$assets.clip", "mediaStart": 0.5,
                          "style": { "x": 0, "y": 0, "width": 960, "height": 540 } }
                    ] } }
            ] },
            { "id": "sound", "kind": "audio", "clips": [
                { "id": "bgm", "start": 0, "end": "@footage.end",
                  "src": "$assets.tone", "volume": 0.8,
                  "animate": { "keyframes": [ { "prop": "volume", "frames": [
                      { "t": "@footage-0.5", "v": 0.8 },
                      { "t": "@footage+0.5", "v": 0.3, "ease": "easeInOutSine" } ] } ] } }
            ] }
        ]
    })
}

fn build() -> (
    scene_primitives::Ir,
    Arc<render_raster::LoadedAssets>,
    TextEngine,
    FrameRenderer,
) {
    let dir = assets_dir();
    let doc = demo_doc();
    assert!(
        !scene_primitives::lint::lint(&doc)
            .iter()
            .any(|d| d.severity == scene_primitives::lint::Severity::Error),
        "demo doc should pass lint"
    );
    let assets = Arc::new(load_assets(&doc, &dir).expect("load_assets"));
    let mut r = scene_primitives::Resolver::new(doc, None).unwrap();
    r.set_host_inputs(assets.inputs.clone());
    let mut ir = r.resolve().unwrap();
    let mut engine = TextEngine::with_document_fonts(&assets.fonts);
    assert!(engine.strict, "a font asset is present ⇒ strict mode");
    let renderer = FrameRenderer::new(&mut ir, &mut engine).unwrap();
    (ir, assets, engine, renderer)
}

#[test]
fn drawops_are_byte_deterministic() {
    let (ir, assets, _e, renderer) = build();
    // Two fresh engines recording the same frame → the encoded bytes must be exactly identical
    let mut e1 = TextEngine::with_document_fonts(&assets.fonts);
    let mut e2 = TextEngine::with_document_fonts(&assets.fonts);
    for t in [1.0, 4.5] {
        let a = drawop::encode(&renderer.record(&ir, &mut e1, t));
        let b = drawop::encode(&renderer.record(&ir, &mut e2, t));
        assert_eq!(a, b, "t={t} two recordings differ in bytes");
        assert_eq!(drawop::fnv1a64(&a), drawop::fnv1a64(&b));
    }
    // Different frame fingerprints should differ (the video media time is changing)
    let f1 = drawop::fingerprint(&renderer.record(&ir, &mut e1, 4.5));
    let f2 = drawop::fingerprint(&renderer.record(&ir, &mut e1, 4.6));
    assert_ne!(f1, f2);
}

#[test]
fn media_rasterizes() {
    let (ir, assets, mut engine, renderer) = build();
    let mut media = MediaStore::new(assets.clone(), ir.fps);

    // t=1.0: the png card area should be #3a6ea5
    let pm = renderer.draw(&ir, &mut engine, &mut media, 1.0).unwrap();
    let px = |pm: &tiny_skia::Pixmap, x: u32, y: u32| {
        let i = ((y * pm.width() + x) * 4) as usize;
        (pm.data()[i], pm.data()[i + 1], pm.data()[i + 2])
    };
    let (r, g, b) = px(&pm, 200, 200); // Inside the card
    assert!(
        (r as i32 - 0x3a).abs() < 8 && (g as i32 - 0x6e).abs() < 8 && (b as i32 - 0xa5).abs() < 8,
        "card pixel {r:02x}{g:02x}{b:02x} ≠ 3a6ea5"
    );
    let (r2, g2, _b2) = px(&pm, 650, 150); // Inside the svg logo's rounded rectangle, #e8906a
    assert!(
        (r2 as i32 - 0xe8).abs() < 8 && (g2 as i32 - 0x90).abs() < 8,
        "svg pixel mismatch"
    );

    // t=4.5: the testsrc video fills the frame, so the center cannot equal the background color #101014
    let pm2 = renderer.draw(&ir, &mut engine, &mut media, 4.5).unwrap();
    let (r3, g3, b3) = px(&pm2, 480, 270);
    assert!(
        !(r3 == 0x10 && g3 == 0x10 && b3 == 0x14),
        "t=4.5 center is still the background color; the video was not drawn"
    );
}

#[test]
fn audio_mix_duck() {
    let (ir, assets, _e, _r) = build();
    let bytes = render_raster::audio::mix_audio(&ir, &assets)
        .unwrap()
        .expect("an audio clip is required");
    let sr = render_raster::audio::SAMPLE_RATE as f64;
    assert_eq!(
        bytes.len(),
        (ir.total * sr).round() as usize * 2 * 4,
        "PCM length"
    );
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();
    let rms = |t0: f64, t1: f64| -> f64 {
        let (i0, i1) = ((t0 * sr) as usize * 2, (t1 * sr) as usize * 2);
        let s: f64 = samples[i0..i1]
            .iter()
            .map(|v| (*v as f64) * (*v as f64))
            .sum();
        (s / (i1 - i0) as f64).sqrt()
    };
    let loud = rms(1.8, 2.2); // vol 0.8
    let duck = rms(4.3, 4.7); // vol 0.3
    assert!(
        loud > 0.02,
        "loud-segment RMS {loud:.4} is off (lavfi sine amplitude is about 1/8 of full scale)"
    );
    assert!(
        duck < loud * 0.55,
        "ducking had no effect: loud {loud:.3} duck {duck:.3}"
    );
    assert!(samples.iter().all(|s| s.abs() <= 1.0), "mix overflow");
}

#[test]
fn hash_mismatch_rejected() {
    let dir = assets_dir();
    let mut doc = demo_doc();
    doc["assets"]["card"]["hash"] = json!(format!("sha256-{}", "0".repeat(64)));
    let err = match load_assets(&doc, &dir) {
        Ok(_) => panic!("a bad hash should be rejected"),
        Err(e) => format!("{e:#}"),
    };
    assert!(err.contains("hash"), "should report a hash mismatch: {err}");
}

#[test]
fn strict_fonts_shape() {
    let dir = assets_dir();
    let bytes = std::fs::read(dir.join("assets/main.ttf")).unwrap();
    let mut engine = TextEngine::with_document_fonts(&[bytes]);
    let line = engine.shape("Hello 123", "", 32.0, 400);
    assert!(
        line.width > 0.0 && !line.glyphs.is_empty(),
        "strict engine should be able to shape"
    );
}

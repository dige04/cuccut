//! Preview and export draw the same frame. Each scene is drawn the way export does it (`plan_frame` computes the plan, built-in fonts, native build), and the frame digest is recorded together with the inputs in `tests/fixtures/parity.json`. The UI package's test (`packages/ui/src/render/parity.test.ts`) feeds the same inputs into the compiled preview WASM and compares digests frame by frame. The scenes cover every kind of picture instance, every transition, `fx`, masks, tiling, element animation, keyframes, template layers and captions, plus three switches: output scaling, not painting the background, and not drawing captions.
//!
//! When the kernel's drawing changes, first run `CUCCUT_UPDATE_PARITY=1 cargo test -p frame-render --test parity` to rewrite the fixture, then run the UI package's test.
//! Source pictures are written in the fixture as vertical bands (`bands`). Both sides tile them into non-premultiplied RGBA by the same rule, and feed them through the same `premultiplied` into the renderer. Browser decoding (video, bitmaps) is not covered here; what is fed in is always an already-decoded picture. SVG and GIF images, like Lottie, are fed in as asset bytes, and each side rasterizes or decodes them in the kernel.

mod common;

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use common::*;
use editor_semantics::Ratio;
use frame_render::{Documents, FrameRenderer, FrozenDocument, LayerMedia, RenderError, RenderOptions, demultiplied, premultiplied};
use render_graph::audio_plan::speaker_activity;
use render_graph::{VideoView, VisualLayer, plan_frame};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tiny_skia::Pixmap;
use video_model::{DocumentRecord, TimelineItem, VersionRef, VideoSnapshot};

const LOTTIE: &str = include_str!("../../render-raster/tests/fixtures/lottie/cases/shapes.json");
const LOTTIE_IMAGE: &str = include_str!("../../render-raster/tests/fixtures/lottie/cases/image-embedded.json");
const STUDIO: &str = "cuccut.legacy-studio-style/0.1";
/// A solid-fill SVG sticker with a `<text>` run: neither side's resvg has fonts, so the text is not drawn (the preview wasm is built without `text`, and the export font library is empty).
const SVG_STICKER: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30" viewBox="0 0 40 30"><rect width="40" height="15" fill="#FF4000"/><circle cx="20" cy="22" r="7" fill="#2060FF"/><text x="2" y="12" font-size="10" fill="#FFFFFF">Hi</text></svg>"##;

/// One frame: the sequence frame number (30 fps), the output size, and two switches.
#[derive(Clone, Copy)]
struct Shot {
    frame: i64,
    width: u32,
    height: u32,
    captions: bool,
    transparent: bool,
}

fn shot(frame: i64) -> Shot {
    Shot {
        frame,
        width: W,
        height: H,
        captions: true,
        transparent: false,
    }
}

fn shots(frames: &[i64]) -> Vec<Shot> {
    frames.iter().map(|&f| shot(f)).collect()
}

struct Scene {
    name: &'static str,
    video: VideoSnapshot,
    documents: Vec<Value>,
    /// Instance ID → (width, height, colored vertical bands of equal width from left to right).
    pictures: Vec<(&'static str, u32, u32, Vec<[u8; 4]>)>,
    /// `asset ID@version` → text bytes.
    assets: Vec<(&'static str, String)>,
    /// `asset ID@version` → binary bytes (written as hex in the fixture).
    binary_assets: Vec<(&'static str, Vec<u8>)>,
    /// Instance ID → BCS1.
    spectra: Vec<(&'static str, Vec<u8>)>,
    /// `asset ID@version` → asset spectrum (BCS1).
    audio_spectra: Vec<(&'static str, Vec<u8>)>,
    /// Transcript for the video (`{documentId, sourceAssetId?, body}`, same as preview's `bc_set_speech`): used by the waveform's `speaker`.
    speech: Vec<Value>,
    shots: Vec<Shot>,
}

impl Scene {
    fn new(name: &'static str, video: VideoSnapshot, frames: &[i64]) -> Scene {
        Scene {
            name,
            video,
            documents: Vec::new(),
            pictures: Vec::new(),
            assets: Vec::new(),
            binary_assets: Vec::new(),
            spectra: Vec::new(),
            audio_spectra: Vec::new(),
            speech: Vec::new(),
            shots: shots(frames),
        }
    }

    fn picture(mut self, item: &'static str, w: u32, h: u32, bands: &[[u8; 4]]) -> Scene {
        self.pictures.push((item, w, h, bands.to_vec()));
        self
    }
}

/// Band picture: the color of column x is `bands[x * n / w]` (non-premultiplied RGBA). The UI package's test tiles by the same rule.
fn bands_rgba(w: u32, h: u32, bands: &[[u8; 4]]) -> Vec<u8> {
    let n = bands.len() as u32;
    let mut row = Vec::with_capacity(w as usize * 4);
    for x in 0..w {
        row.extend(bands[(x * n / w) as usize]);
    }
    row.repeat(h as usize)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(text: &str) -> Vec<u8> {
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
        .collect()
}

/// Input in the fixture is fed to the renderer unchanged: pictures and spectra by instance, asset bytes and asset spectra by `asset ID@version` (same as preview WASM).
#[derive(Default)]
struct FixtureMedia {
    pictures: BTreeMap<String, Pixmap>,
    assets: BTreeMap<String, Vec<u8>>,
    spectra: BTreeMap<String, Vec<u8>>,
    audio_spectra: BTreeMap<String, Vec<u8>>,
}

impl LayerMedia for FixtureMedia {
    fn picture(&mut self, layer: &VisualLayer) -> Result<Option<&Pixmap>, RenderError> {
        Ok(self.pictures.get(&layer.item_id))
    }

    fn asset_bytes(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        self.assets.get(&format!("{}@{}", asset.id, asset.revision)).cloned()
    }

    fn spectrum(&mut self, item_id: &str) -> Option<Vec<u8>> {
        self.spectra.get(item_id).cloned()
    }

    fn audio_spectrum(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        self.audio_spectra.get(&format!("{}@{}", asset.id, asset.revision)).cloned()
    }
}

fn with(mut value: Value, extra: Value) -> Value {
    if let (Some(base), Value::Object(extra)) = (value.as_object_mut(), extra) {
        base.extend(extra);
    }
    value
}

/// Picture-in-picture red image (16×9), 50% wide, centered in the canvas; `body` is merged into the instance.
fn pip(name: &'static str, body: Value, frames: &[i64]) -> Scene {
    let item = with(image("a", 0, 0, 90, json!({ "place": { "w": 50 } })), body);
    Scene::new(name, video(vec![item], vec![image_asset("a_a", 16, 9)], json!({})), frames).picture("a", 16, 9, &[RED, YELLOW])
}

/// An instance of the generator class (does not read media): 60% wide, 90 frames from frame 0.
fn generator(name: &'static str, body: Value, frames: &[i64]) -> Scene {
    let item = with(item("g", 0, 90, json!({ "place": { "w": 60 } })), body);
    Scene::new(name, video(vec![item], vec![], json!({})), frames)
}

fn caption_doc(id: &str, clock: &str, cues: &[(f64, f64, &str)], line_kind: &str) -> Value {
    json!({
        "documentId": id, "kind": "caption", "schema": "cuccut.caption/1", "lineKind": line_kind,
        "body": {
            "schema": "cuccut.caption/1", "clock": clock, "timescale": 1000,
            "cues": cues.iter().enumerate().map(|(i, (s, e, t))| json!({
                "id": format!("c{i}"), "start": (s * 1000.0) as i64, "end": (e * 1000.0) as i64, "text": t
            })).collect::<Vec<_>>(),
        }
    })
}

fn style_doc(id: &str, body: Value) -> Value {
    json!({ "documentId": id, "kind": "caption-style", "schema": body.get("schema").cloned(), "body": body })
}

fn caption(id: &str, document: &str, style: Option<&str>, frames: i64, scopes: &[&str]) -> Value {
    let mut value = item(
        id,
        0,
        frames,
        json!({ "type": "caption", "documentId": document, "scopeItemIds": scopes }),
    );
    value["trackId"] = json!("trk_s1");
    if let Some(style) = style {
        value["styleDocumentId"] = json!(style);
    }
    value
}

/// A [0, 30) followed by B [30, 60), with a 20-frame two-sided transition in between.
fn two_sided(name: &'static str, kind: &str, params: Value) -> Scene {
    let video = video(
        vec![full_image("a", 0, 0, 30), full_image("b", 0, 30, 30)],
        vec![image_asset("a_a", W, H), image_asset("a_b", W, H)],
        json!({ "transitions": [transition("tr", Some("a"), Some("b"), kind, params, 20)] }),
    );
    Scene::new(name, video, &[22, 30, 37])
        .picture("a", W, H, &[RED, YELLOW])
        .picture("b", W, H, &[BLUE, GREEN, WHITE])
}

fn scenes() -> Vec<Scene> {
    let mut scenes = vec![
        // —— Media instances ——
        Scene::new(
            "image-fullscreen",
            video(vec![full_image("img", 0, 0, 30)], vec![image_asset("a_img", W, H)], json!({})),
            &[0, 15],
        )
        .picture("img", W, H, &[RED, BLUE]),
        Scene::new(
            "image-pip-crop-flip",
            video(
                vec![image(
                    "img",
                    0,
                    0,
                    30,
                    json!({ "place": { "x": 40, "y": 55, "w": 50, "rot": 20, "flipX": true, "opacity": 0.8 },
                            "crop": { "left": 0.1, "top": 0.4, "right": 0, "bottom": 0.05 } }),
                )],
                vec![image_asset("a_img", 160, 90)],
                json!({}),
            ),
            &[10],
        )
        .picture("img", 160, 90, &[GREEN, RED, BLUE]),
        Scene::new(
            "video-source-time",
            video(
                vec![video_item(
                    "v",
                    "a_v",
                    0,
                    60,
                    json!({ "mode": "pip", "place": { "w": 70 }, "fit": "contain", "timeMap": {
                        "kind": "linear", "sourceIn": { "ticks": "2", "timescale": 1 }, "rate": { "num": 1, "den": 1 }
                    } }),
                )],
                vec![video_asset("a_v", 64, 64)],
                json!({}),
            ),
            &[15],
        )
        .picture("v", 64, 64, &[GREEN, BLUE]),
        two_piece_crop().picture("v1", W, H, &[RED, GREEN, BLUE, YELLOW]).picture("v2", W, H, &[RED, GREEN, BLUE, YELLOW]),
        Scene::new(
            "stacked-layers",
            video(
                vec![
                    full_image("b", 0, 0, 30),
                    image("a", 1, 0, 30, json!({ "place": { "x": 25, "y": 50, "w": 50 } })),
                ],
                vec![image_asset("a_a", 16, 9), image_asset("a_b", 16, 9)],
                json!({ "canvas": { "width": W, "height": H, "workingSpace": "srgb", "background": "#336699" } }),
            ),
            &[0],
        )
        .picture("a", 16, 9, &[RED])
        .picture("b", 16, 9, &[RED, BLUE]),
        // —— Text and graphics ——
        generator(
            "text-plain",
            json!({ "type": "text", "text": "Hello 你好", "style": { "fontSize": 60, "color": "#FFFFFF" },
                    "place": { "x": 50, "y": 50, "w": 90, "opacity": 0.7 } }),
            &[15],
        ),
        generator(
            "text-styled",
            json!({ "type": "text", "text": "HHHH",
                    "style": { "fontSize": 60, "fontColor": "#FF0000", "background": true, "backgroundColor": "#0000FF" },
                    "place": { "x": 50, "y": 50, "w": 90 } }),
            &[15],
        ),
        generator(
            "text-typewriter",
            json!({ "type": "text", "text": "TYPE IT", "style": { "fontSize": 50 },
                    "animate": { "enter": { "preset": "typewriter", "dur": 1.5 } } }),
            &[5, 20, 60],
        ),
        generator(
            "shape-rect",
            json!({ "type": "shape", "shape": { "shape": "rect", "fill": "#FF0000", "stroke": "#FFFFFF", "strokeWidth": 12 } }),
            &[0],
        ),
        generator(
            "shape-rounded",
            json!({ "type": "shape", "shape": { "shape": "rect", "fill": "#00FF00", "cornerRadius": [150, 40, 150, 0] } }),
            &[0],
        ),
        generator(
            "shape-ellipse",
            json!({ "type": "shape", "shape": { "shape": "ellipse", "fill": "#0000FF" }, "place": { "w": 60, "rot": 30 } }),
            &[0],
        ),
        // —— fx ——
        pip("fx-colour", json!({ "fx": { "saturation": -1, "temperature": 1 } }), &[15]),
        pip(
            "fx-adjust",
            json!({ "fx": { "grayscale": 0.3, "brightness": -0.2, "exposure": 0.3, "contrast": 0.4, "hue": 0.25 },
                    "place": { "w": 50, "opacity": 0.5 } }),
            &[15],
        ),
        pip(
            "fx-presets",
            json!({ "fx": { "filterPreset": "calm1", "effectPreset": "polaroid", "effectIntensity": 0.7 } }),
            &[15],
        ),
        pip(
            "fx-detail",
            json!({ "fx": { "blur": 20, "sharpen": 0.5, "noise": 0.4, "vignette": 0.6 } }),
            &[15],
        ),
        pip(
            "fx-stroke-shadow",
            json!({ "fx": {
                "stroke": { "width": 20, "color": "#00FF00" },
                "shadow": { "offsetX": 40, "offsetY": 30, "blur": 15, "color": "#FFFFFF", "opacity": 0.8 }
            }, "place": { "w": 50, "rot": 25 } }),
            &[15],
        ),
        // —— Masks, tiling, animation, keyframes ——
        pip("mask-ellipse", json!({ "mask": { "shape": "ellipse", "feather": 0.3 } }), &[15]),
        pip("tile", json!({ "place": { "w": 20, "rot": 10 }, "tile": { "on": true } }), &[15]),
        pip(
            "animate-enter-exit",
            json!({ "animate": { "enter": { "preset": "fade", "dur": 1.0 }, "exit": { "preset": "pop", "dur": 0.8 } } }),
            &[3, 45, 85],
        ),
        pip(
            "animate-reveal",
            json!({ "animate": { "enter": { "preset": "wipe", "dur": 1.5 } } }),
            &[10, 25],
        ),
        pip(
            "animate-loop",
            json!({ "animate": { "loop": { "preset": "rotate" }, "enter": { "preset": "blurIn", "dur": 0.5 } } }),
            &[6, 21, 50],
        ),
    ];

    let mut keyframed = pip("keyframes", json!({}), &[0, 30, 60]);
    for (id, property, from, to) in [("kx", "x", 25.0, 75.0), ("ko", "opacity", 0.2, 1.0), ("kr", "rot", 0.0, 90.0)] {
        let binding = serde_json::from_value(json!({
            "id": id, "targetId": "a", "propertyPath": property,
            "keyframes": [{ "localFrame": 0, "value": from }, { "localFrame": 60, "value": to }]
        }))
        .unwrap();
        keyframed
            .video
            .sequences
            .get_mut("seq")
            .unwrap()
            .header
            .animation_bindings
            .push(binding);
    }
    scenes.push(keyframed);

    // —— Generators and stickers ——
    scenes.extend([
        generator(
            "counter",
            json!({ "type": "text", "counter": { "mode": "countdown" }, "style": { "fontSize": 80 } }),
            &[6, 66],
        ),
        generator(
            "progress",
            json!({ "type": "progress", "progress": { "style": "normal", "mainColor": "#FFFFFF" }, "place": { "y": 90, "w": 80 } }),
            &[9, 81],
        ),
        generator(
            "visualizer-static",
            json!({ "type": "visualizer", "visualizer": { "style": "bars", "mainColor": "#FFFFFF" } }),
            &[15],
        ),
        generator(
            "confetti",
            json!({ "type": "confetti", "confetti": { "style": "pastel-fall", "seed": 7 }, "place": { "w": 100 } }),
            &[15, 30],
        ),
        generator(
            "draw",
            json!({ "type": "draw", "draw": {
                "brush": "round", "color": "#FFFFFF", "size": 8,
                "strokes": [{ "points": [[10, 50], [50, 20], [90, 50]] }, { "points": [[20, 80], [80, 80]] }]
            } }),
            &[20, 87],
        ),
        generator(
            "placeholder-empty",
            json!({ "type": "placeholder", "placeholder": { "variant": "camera" } }),
            &[15],
        ),
        generator(
            "sticker-template",
            json!({ "type": "sticker", "sticker": { "source": "template", "templateId": "heart" } }),
            &[15],
        ),
    ]);

    let mut visualizer = generator(
        "visualizer-spectrum",
        json!({ "type": "visualizer", "visualizer": { "style": "bars", "mainColor": "#FFFFFF", "minDb": -80, "maxDb": 40 } }),
        &[10, 25],
    );
    visualizer.spectra.push(("g", spectrum(30, |bin| if bin < 128 { 220 } else { 40 })));
    scenes.push(visualizer);
    scenes.push(visualizer_audio());
    scenes.push(visualizer_speaker());

    let media_item = |kind: &str, body: Value| item("m", 0, 90, with(json!({ "type": kind, "place": { "w": 50 } }), body));
    let asset = json!({ "assetRef": { "id": "a_m", "revision": "rev_1" } });
    scenes.extend([
        Scene::new(
            "placeholder-filled",
            video(
                vec![media_item(
                    "placeholder",
                    with(json!({ "placeholder": { "variant": "media" } }), asset.clone()),
                )],
                vec![image_asset("a_m", 16, 9)],
                json!({}),
            ),
            &[15],
        )
        .picture("m", 16, 9, &[GREEN, BLUE]),
        Scene::new(
            "sticker-image",
            video(
                vec![media_item(
                    "sticker",
                    with(json!({ "sticker": { "source": "asset" } }), asset.clone()),
                )],
                vec![image_asset("a_m", 10, 10)],
                json!({}),
            ),
            &[15],
        )
        .picture("m", 10, 10, &[[0, 0, 255, 255], [0, 0, 255, 0]]),
        Scene::new(
            "whiteboard",
            video(
                vec![media_item("whiteboard", with(json!({ "whiteboard": {} }), asset.clone()))],
                vec![image_asset("a_m", 32, 18)],
                json!({}),
            ),
            &[3, 40, 87],
        )
        .picture("m", 32, 18, &[WHITE, BLACK, WHITE, RED, WHITE]),
        Scene::new(
            "composition-prerender",
            video(
                vec![item(
                    "comp",
                    0,
                    30,
                    json!({
                        "type": "composition", "source": { "kind": "bundle", "assetRef": { "id": "a_bundle", "revision": "rev_1" } },
                        "prerender": { "id": "a_v", "revision": "rev_1" }, "parameterValues": {},
                        "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
                        "place": {}
                    }),
                )],
                vec![video_asset("a_v", W, H)],
                json!({}),
            ),
            &[15],
        )
        .picture("comp", W, H, &[GREEN, BLACK]),
    ]);

    let mut lottie = Scene::new(
        "sticker-lottie",
        video(
            vec![media_item(
                "sticker",
                json!({ "sticker": { "source": "asset" }, "assetRef": { "id": "a_lottie", "revision": "rev_1" } }),
            )],
            vec![lottie_asset("a_lottie")],
            json!({}),
        ),
        &[3, 18],
    );
    lottie.assets.push(("a_lottie@rev_1", LOTTIE.to_string()));
    scenes.push(lottie);

    // Recolored Lottie and Lottie with embedded bitmaps: the same decoding and recoloring in WASM.
    let mut recoloured = Scene::new(
        "sticker-lottie-recoloured",
        video(
            vec![
                item(
                    "recoloured",
                    0,
                    90,
                    json!({ "type": "sticker", "sticker": { "source": "asset", "fillOverrides": { "#FF4000": "#FF00FF" } },
                            "assetRef": { "id": "a_lottie", "revision": "rev_1" }, "place": { "x": 30, "y": 50, "w": 50 } }),
                ),
                item(
                    "bitmap",
                    1,
                    90,
                    json!({ "type": "sticker", "sticker": { "source": "asset" }, "assetRef": { "id": "a_bitmap", "revision": "rev_1" },
                            "place": { "x": 75, "y": 50, "w": 40 } }),
                ),
            ],
            vec![lottie_asset("a_lottie"), lottie_asset("a_bitmap")],
            json!({}),
        ),
        &[5, 20],
    );
    recoloured.assets.push(("a_lottie@rev_1", LOTTIE.to_string()));
    recoloured.assets.push(("a_bitmap@rev_1", LOTTIE_IMAGE.to_string()));
    scenes.push(recoloured);

    // SVG sticker: one with the original color, and one recolored by `fillOverrides`. Both are rasterized by the kernel from the asset bytes at the output's long side.
    let mut svg = Scene::new(
        "sticker-svg-recoloured",
        video(
            vec![
                item(
                    "plain",
                    0,
                    90,
                    json!({ "type": "sticker", "sticker": { "source": "asset" },
                            "assetRef": { "id": "a_svg", "revision": "rev_1" }, "place": { "x": 28, "y": 50, "w": 40 } }),
                ),
                item(
                    "recoloured",
                    1,
                    90,
                    json!({ "type": "sticker", "sticker": { "source": "asset", "fillOverrides": { "#ff4000": "#00FF80" } },
                            "assetRef": { "id": "a_svg", "revision": "rev_1" }, "place": { "x": 72, "y": 50, "w": 40, "rot": 10 } }),
                ),
            ],
            vec![svg_asset("a_svg", 40, 30)],
            json!({}),
        ),
        &[10],
    );
    svg.assets.push(("a_svg@rev_1", SVG_STICKER.to_string()));
    svg.shots.push(Shot {
        width: 2 * W,
        height: 2 * H,
        ..shot(10)
    });
    scenes.push(svg);

    // GIF: a GIF picture in an image instance loops forever. A sticker follows `loop` (here it plays once and stops on the last frame). Both are decoded by the kernel from the asset bytes, with frames picked by time.
    let mut gif = Scene::new(
        "gif-image-and-sticker",
        video(
            vec![
                image("im", 0, 0, 90, json!({ "place": { "x": 30, "y": 50, "w": 40 } })),
                item(
                    "once",
                    1,
                    90,
                    json!({ "type": "sticker", "sticker": { "source": "asset", "loop": "once" },
                            "assetRef": { "id": "a_im", "revision": "rev_1" }, "place": { "x": 75, "y": 50, "w": 30 } }),
                ),
            ],
            vec![gif_asset("a_im", 8, 8)],
            json!({}),
        ),
        // At frame 4 (133 ms) both are on the second frame. At frame 40 (1333 ms) the image has cycled back and lands on the third frame, while the sticker stays on its last frame.
        &[4, 40],
    );
    gif.binary_assets.push(("a_im@rev_1", STRIPES_GIF.to_vec()));
    scenes.push(gif);

    // `.lottie` archive: the animation from the manifest, the PNG in the package, and the embedded SVG image. The same unpacking and rasterization happen in WASM.
    let mut archive = Scene::new(
        "sticker-dotlottie",
        video(
            vec![item(
                "archive",
                0,
                90,
                json!({ "type": "sticker", "sticker": { "source": "asset" }, "assetRef": { "id": "a_dotlottie", "revision": "rev_1" },
                        "place": { "w": 75 } }),
            )],
            vec![dotlottie_asset("a_dotlottie")],
            json!({}),
        ),
        &[0, 15],
    );
    archive.binary_assets.push(("a_dotlottie@rev_1", dotlottie_fixture()));
    scenes.push(archive);

    scenes.push(Scene::new(
        "template-layers",
        video(
            vec![],
            vec![],
            json!({
                "durationPolicy": { "kind": "fixed", "frames": 90 },
                "template": { "id": "tpl", "name": "条", "layers": [
                    { "id": "bar", "box": { "x": 0, "y": 90, "w": 100, "h": 10 }, "kind": "progress", "accent": "#FF0000", "track": "#0000FF" },
                    { "id": "logo", "box": { "x": 2, "y": 4, "w": 20, "h": 12 }, "kind": "logo", "src": "text", "text": "T", "color": "#FFFFFF", "bg": "#00FF00" }
                ] }
            }),
        ),
        &[45],
    ));

    // —— Transitions ——
    scenes.extend([
        two_sided("transition-dissolve", "dissolve", json!({})),
        two_sided("transition-wipe", "wipe", json!({})),
        two_sided("transition-slide", "slide", json!({})),
        two_sided("transition-zoom", "zoom", json!({})),
        two_sided("transition-iris", "iris", json!({})),
        two_sided("transition-dip", "dip-to-color", json!({ "color": "#00FF00" })),
        two_sided("transition-push", "push", json!({ "direction": "left" })),
    ]);
    for (name, left, right) in [
        ("transition-single-in", None, Some("top")),
        ("transition-single-out", Some("top"), None),
    ] {
        scenes.push(
            Scene::new(
                name,
                video(
                    vec![
                        full_image("under", 0, 0, 90),
                        image("top", 1, 0, 60, json!({ "place": { "w": 70, "rot": 15 } })),
                    ],
                    vec![image_asset("a_under", W, H), image_asset("a_top", W, H)],
                    json!({ "transitions": [transition("tr", left, right, "wipe", json!({}), 20)] }),
                ),
                &[10, 45],
            )
            .picture("under", W, H, &[BLUE, WHITE])
            .picture("top", W, H, &[RED, YELLOW]),
        );
    }

    // —— Captions ——
    let mut studio = Scene::new(
        "captions-studio",
        video(vec![caption("cap", "doc", Some("style"), 240, &[])], vec![], json!({})),
        &[45, 75],
    );
    studio.documents = vec![
        caption_doc("doc", "sequence", &[(1.0, 2.0, "AB 字幕"), (2.0, 3.0, "Next line")], "original"),
        style_doc(
            "style",
            json!({ "schema": STUDIO, "style": { "fontSize": 100, "displayTiming": { "leadIn": 0.5, "tail": 1.0 } } }),
        ),
    ];
    studio.shots.push(Shot {
        captions: false,
        ..shot(45)
    });
    scenes.push(studio);

    let mut bilingual = Scene::new(
        "captions-bilingual",
        video(
            vec![
                caption("a", "orig", Some("style"), 60, &[]),
                caption("b", "trans", Some("style"), 60, &[]),
            ],
            vec![],
            json!({}),
        ),
        &[30],
    );
    bilingual.documents = vec![
        caption_doc("orig", "sequence", &[(0.0, 2.0, "AB")], "original"),
        caption_doc("trans", "sequence", &[(0.0, 2.0, "一二")], "translation"),
        style_doc(
            "style",
            json!({ "schema": STUDIO, "style": {
                "y": 50, "order": "trans", "fontSize": 90, "anim": { "name": "None" },
                "origStyle": { "fontColor": "#FFFFFF" }, "transStyle": { "fontColor": "#FF0000" }
            } }),
        ),
    ];
    scenes.push(bilingual);

    let mut source_clock = Scene::new(
        "captions-source-clock",
        video(
            vec![
                video_item(
                    "clip",
                    "a_clip",
                    0,
                    60,
                    json!({ "timeMap": { "kind": "linear", "sourceIn": { "ticks": "10", "timescale": 1 }, "rate": { "num": 1, "den": 1 } } }),
                ),
                caption("cap", "doc", Some("style"), 60, &["clip"]),
            ],
            vec![video_asset("a_clip", 16, 9)],
            json!({}),
        ),
        &[15],
    )
    .picture("clip", 16, 9, &[BLUE]);
    source_clock.documents = vec![
        caption_doc("doc", "source-asset", &[(10.0, 11.0, "AB")], "original"),
        style_doc(
            "style",
            json!({ "schema": STUDIO, "style": { "fontSize": 120, "anim": { "name": "None" } } }),
        ),
    ];
    scenes.push(source_clock);

    // Caption words come from the transcript (`sourceDocumentId` in the document header). Unspaced Chinese changes color character by character, and the cut character (“的”, the particle “de”, at source 10.5–11.0) and the hidden character (“再”, “again”) are not drawn. Export freezes the transcript into `documents`, and preview sends the same one through `bc_set_speech`.
    let clip_from = |id: &str, from: i64, frames: i64, source_ms: i64| {
        video_item(
            id,
            "a_clip",
            from,
            frames,
            json!({ "timeMap": { "kind": "linear", "sourceIn": { "ticks": source_ms.to_string(), "timescale": 1000 },
                                 "rate": { "num": 1, "den": 1 } } }),
        )
    };
    let mut words = Scene::new(
        "captions-transcript-words",
        video(
            vec![
                clip_from("left", 0, 15, 10_000),
                clip_from("right", 15, 45, 11_000),
                caption("cap", "doc", Some("style"), 60, &["left", "right"]),
            ],
            vec![video_asset("a_clip", 16, 9)],
            json!({}),
        ),
        &[4, 20, 35, 50],
    )
    .picture("left", 16, 9, &[BLUE])
    .picture("right", 16, 9, &[BLUE]);
    words.documents = vec![
        json!({
            "documentId": "doc", "kind": "caption", "schema": "cuccut.caption/1", "lineKind": "original",
            "sourceDocumentId": "doc_speech", "sourceAssetId": "a_clip",
            "body": { "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000,
                      "cues": [{ "id": "q-w1", "start": 10_000, "end": 13_000, "text": "真的别再说了",
                                 "words": { "first": "w1", "last": "w5" } }] }
        }),
        style_doc(
            "style",
            json!({ "schema": STUDIO, "style": { "fontSize": 90, "anim": { "name": "Color" }, "displayTiming": { "leadIn": 0, "tail": 0 } } }),
        ),
    ];
    let word = |id: &str, text: &str, start: i64, end: i64| json!({ "id": id, "text": text, "start": start, "end": end });
    let mut hidden = word("w4", "再", 11_500, 12_000);
    hidden["hidden"] = json!(true);
    words.speech.push(json!({
        "documentId": "doc_speech", "sourceAssetId": "a_clip",
        "body": { "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
                  "words": [word("w1", "真", 10_000, 10_500), word("w2", "的", 10_500, 11_000), word("w3", "别", 11_000, 11_500),
                            hidden, word("w5", "说了", 12_000, 13_000)] }
    }));
    scenes.push(words);

    // The emphasis on the design caption is keyed by transcript word ID (emphasis written on a multi-character word lands on each split character). The bottom template bar lifts the caption above it.
    let mut emphasis = Scene::new(
        "captions-emphasis-template",
        video(
            vec![
                clip_from("clip", 0, 60, 10_000),
                caption("cap", "doc", Some("style"), 60, &["clip"]),
            ],
            vec![video_asset("a_clip", 16, 9)],
            json!({ "template": { "id": "tpl", "name": "条", "layers": [
                { "id": "bar", "box": { "x": 0, "y": 85, "w": 100, "h": 15 }, "kind": "progress", "accent": "#FF0000", "track": "#0000FF" }
            ] } }),
        ),
        &[8, 40],
    )
    .picture("clip", 16, 9, &[BLUE]);
    emphasis.documents = vec![
        json!({
            "documentId": "doc", "kind": "caption", "schema": "cuccut.caption/1", "lineKind": "original",
            "sourceDocumentId": "doc_speech", "sourceAssetId": "a_clip",
            "body": { "schema": "cuccut.caption/1", "clock": "source-asset", "timescale": 1000,
                      "cues": [{ "id": "q-w1", "start": 10_000, "end": 12_000, "text": "真的说了",
                                 "words": { "first": "w1", "last": "w3" } }] }
        }),
        style_doc(
            "style",
            json!({ "schema": STUDIO, "style": {
                "fontSize": 90, "verticalAlign": "bottom", "displayTiming": { "leadIn": 0, "tail": 0 },
                "wordAnimation": { "caption": { "schema": 1, "style": { "id": "caption-highlight", "version": 1 }, "content": "orig",
                                                "palette": { "primary": "#FFFFFF", "accent": "#00FF66" } } },
                "captionEmphasis": { "w3": { "anchorText": "说了", "role": "hero", "color": "#FF00AA" } },
            } }),
        ),
    ];
    emphasis.speech.push(json!({
        "documentId": "doc_speech", "sourceAssetId": "a_clip",
        "body": { "schema": "cuccut.speech/1", "clock": "source-asset", "timescale": 1000,
                  "words": [word("w1", "真", 10_000, 10_500), word("w2", "的", 10_500, 11_000), word("w3", "说了", 11_000, 12_000)] }
    }));
    scenes.push(emphasis);

    let mut boxed = Scene::new(
        "captions-boxed",
        video(vec![caption("cap", "doc", Some("style"), 60, &[])], vec![], json!({})),
        &[15],
    );
    boxed.documents = vec![
        caption_doc("doc", "sequence", &[(0.0, 1.0, "Boxed 字幕 line")], "original"),
        style_doc(
            "style",
            json!({
                "schema": "cuccut.boxed-caption-style/1",
                "canvas": { "width": 320, "height": 180 },
                "box": { "x": 0, "y": -60, "width": 240, "height": 40 },
                "style": { "fontSize": 24, "color": "#00FF00", "verticalAlign": "top", "backgroundColor": "#0000FF", "textPadding": 8 },
            }),
        ),
    ];
    scenes.push(boxed);

    // Left and right alignment of a positioned-box style: each line is aligned within the wrap width, against the left and right edges of the box (two lines, so you can see that each line is aligned on its own).
    for (name, side) in [("captions-boxed-left", "left"), ("captions-boxed-right", "right")] {
        let mut aligned = Scene::new(
            name,
            video(vec![caption("cap", "doc", Some("style"), 60, &[])], vec![], json!({})),
            &[15],
        );
        aligned.documents = vec![
            caption_doc("doc", "sequence", &[(0.0, 1.0, "Boxed 字幕 line that wraps")], "original"),
            style_doc(
                "style",
                json!({
                    "schema": "cuccut.boxed-caption-style/1",
                    "canvas": { "width": 320, "height": 180 },
                    "box": { "x": 0, "y": 40, "width": 200, "height": 60 },
                    "style": { "fontSize": 20, "color": "#FFFF00", "verticalAlign": "center", "textAlign": side,
                               "backgroundColor": "#0000FF", "textPadding": 6 },
                }),
            ),
        ];
        scenes.push(aligned);
    }

    // Word-by-word reveal in a positioned box: three equally long words, each taking one second. Frames are taken at the start, when the first word is spoken, just after the second word is spoken, and after the third word is spoken.
    let mut reveal = Scene::new(
        "captions-boxed-reveal",
        video(vec![caption("cap", "doc", Some("style"), 90, &[])], vec![], json!({})),
        &[0, 15, 31, 75],
    );
    reveal.documents = vec![
        caption_doc("doc", "sequence", &[(0.0, 3.0, "AA BB CC")], "original"),
        style_doc(
            "style",
            json!({
                "schema": "cuccut.boxed-caption-style/18",
                "canvas": { "width": 320, "height": 180 },
                "box": { "x": 0, "y": 0, "width": 300, "height": 60 },
                "style": { "fontSize": 24, "color": "#00FF00", "verticalAlign": "center", "backgroundColor": "#0000FF",
                           "textPadding": 8, "animationPresetId": "reveal" },
            }),
        ),
    ];
    scenes.push(reveal);

    // —— Output scaling and not painting the background ——
    let mut scaled = pip(
        "output-scaled-transparent",
        json!({ "place": { "x": 70, "y": 40, "w": 50, "rot": 15 }, "fx": { "shadow": { "offsetX": 20, "offsetY": 20, "blur": 10, "color": "#000000", "opacity": 0.6 } } }),
        &[],
    );
    scaled.shots = vec![
        Shot {
            width: 2 * W,
            height: 2 * H,
            ..shot(15)
        },
        Shot {
            width: 96,
            height: 54,
            ..shot(15)
        },
        Shot {
            transparent: true,
            ..shot(15)
        },
    ];
    scenes.push(scaled);
    scenes
}

/// The waveform listens to this sequence's mix: two sounds (one fading in, one turned down) are layered on different tracks, and each asset spectrum varies with its source time.
fn visualizer_audio() -> Scene {
    let track = |id: &str, order: i64, kind: &str| {
        json!({ "id": id, "order": order, "kind": kind, "locked": false, "visible": true, "muted": false,
                "solo": { "enabled": false, "group": if kind == "audio" { "audio" } else { "visual" } } })
    };
    let sound = |id: &str, track: &str, asset: &str, from: i64, seconds: i64, mix: Value| {
        json!({
            "id": id, "trackId": track, "enabled": true, "locked": false, "paintOrder": 0,
            "followPolicy": { "kind": "sequence-fixed" },
            "type": "audio", "assetRef": { "id": asset, "revision": "rev_1" }, "fromFrame": from, "subframeOffset": { "ticks": "0", "timescale": 1 },
            "playDuration": { "ticks": seconds.to_string(), "timescale": 1 },
            "timeMap": { "kind": "linear", "sourceIn": { "ticks": "0", "timescale": 1 }, "rate": { "num": 1, "den": 1 } },
            "mix": mix
        })
    };
    let viz = item(
        "g",
        0,
        90,
        json!({ "type": "visualizer", "place": { "w": 60 },
                "visualizer": { "style": "bars", "mainColor": "#FFFFFF", "minDb": -80, "maxDb": 40 } }),
    );
    let items = vec![
        viz,
        sound(
            "low",
            "trk_a1",
            "a_low",
            6,
            2,
            json!({ "volume": 1, "fadeIn": { "ticks": "1", "timescale": 2 } }),
        ),
        sound("high", "trk_a2", "a_high", 30, 2, json!({ "volume": 0.3 })),
    ];
    let video = video(
        items,
        vec![audio_asset("a_low"), audio_asset("a_high")],
        json!({ "tracks": [track("trk_v1", 0, "visual"), track("trk_a1", 0, "audio"), track("trk_a2", 1, "audio")] }),
    );
    let mut scene = Scene::new("visualizer-audio", video, &[12, 40, 75, 3]);
    // The low-frequency one grows louder with source time, while the high-frequency one stays loud throughout.
    scene.audio_spectra.push((
        "a_low@rev_1",
        spectrum_by_frame(120, |frame, bin| if bin < 96 { (100 + frame) as u8 } else { 0 }),
    ));
    scene
        .audio_spectra
        .push(("a_high@rev_1", spectrum(120, |bin| if (200..320).contains(&bin) { 210 } else { 0 })));
    scene
}

/// The same mix, with the waveform listening only to spk_a (`alwaysShow: false`): spk_a speaks at [0.2, 0.8) and [2.2, 2.8) seconds, and spk_b at [1.2, 2.0).
/// Frame 30 (1 second): spk_a stopped less than 0.5 seconds ago, so it draws the still look. Frame 40: already hidden. Frame 75: spk_a is speaking again.
fn visualizer_speaker() -> Scene {
    let mut scene = visualizer_audio();
    scene.name = "visualizer-speaker";
    for item in scene.video.sequences.values_mut().flat_map(|s| s.items.iter_mut()) {
        if let TimelineItem::Visualizer(viz) = item {
            viz.visualizer.speaker = Some("spk_a".into());
            viz.visualizer.always_show = Some(false);
        }
    }
    scene.shots = shots(&[75, 12, 30, 40]);
    let word =
        |id: &str, start: i64, end: i64, speaker: &str| json!({ "id": id, "text": id, "start": start, "end": end, "speaker": speaker });
    scene.speech.push(json!({
        "documentId": "doc_speech",
        "body": { "schema": "cuccut.speech/1", "clock": "sequence", "timescale": 1000,
                  "words": [word("w1", 200, 800, "spk_a"), word("w2", 1200, 2000, "spk_b"), word("w3", 2200, 2800, "spk_a")] }
    }));
    scene
}

/// Speaker intervals are derived from the fixture's transcript (same derivation as preview WASM's `bc_set_speech`); `None` if there is no transcript at all.
fn speakers_of(video: &VideoSnapshot, speech: &[Value]) -> Option<Arc<frame_render::SpeakerActivity>> {
    if speech.is_empty() {
        return None;
    }
    let records: Vec<DocumentRecord> = speech
        .iter()
        .map(|s| DocumentRecord {
            id: s["documentId"].as_str().unwrap().into(),
            kind: "speech".into(),
            name: String::new(),
            language: None,
            source_asset_id: s["sourceAssetId"].as_str().map(Into::into),
            source_document_id: None,
            current_revision: String::new(),
            revisions: Default::default(),
            extensions: Default::default(),
        })
        .collect();
    let pairs: Vec<_> = records.iter().zip(speech).map(|(record, s)| (record, &s["body"])).collect();
    Some(Arc::new(speaker_activity(VideoView::from(video), "seq", &pairs).unwrap()))
}

/// Draws every frame of one scene the way export does: one renderer per scene (reusing caches across frames, as preview does), with frame times as the rational number `frame number / 30`.
fn render_scene(scene: &Value) -> Vec<Value> {
    let video: VideoSnapshot = serde_json::from_value(scene["video"].clone()).unwrap();
    let mut documents: Vec<FrozenDocument> = serde_json::from_value(scene["documents"].clone()).unwrap();
    // The export plan freezes the transcript containing the caption's words in `documents`. Preview sends the same one through `bc_set_speech`.
    for speech in scene.get("speech").and_then(Value::as_array).into_iter().flatten() {
        documents.push(
            serde_json::from_value(json!({
                "documentId": speech["documentId"], "kind": "speech", "schema": speech["body"]["schema"],
                "sourceAssetId": speech.get("sourceAssetId"), "body": speech["body"],
            }))
            .unwrap(),
        );
    }
    let mut media = FixtureMedia::default();
    for picture in scene["pictures"].as_array().unwrap() {
        let (w, h) = (
            picture["width"].as_u64().unwrap() as u32,
            picture["height"].as_u64().unwrap() as u32,
        );
        let bands: Vec<[u8; 4]> = serde_json::from_value(picture["bands"].clone()).unwrap();
        let pixmap = premultiplied(w, h, bands_rgba(w, h, &bands)).unwrap();
        media.pictures.insert(picture["itemId"].as_str().unwrap().into(), pixmap);
    }
    for asset in scene["assets"].as_array().unwrap() {
        let bytes = match asset["hex"].as_str() {
            Some(hex) => unhex(hex),
            None => asset["text"].as_str().unwrap().as_bytes().to_vec(),
        };
        media.assets.insert(asset["key"].as_str().unwrap().into(), bytes);
    }
    for spectrum in scene["spectra"].as_array().unwrap() {
        media.spectra.insert(
            spectrum["itemId"].as_str().unwrap().into(),
            unhex(spectrum["hex"].as_str().unwrap()),
        );
    }
    for spectrum in scene["audioSpectra"].as_array().unwrap() {
        media
            .audio_spectra
            .insert(spectrum["key"].as_str().unwrap().into(), unhex(spectrum["hex"].as_str().unwrap()));
    }
    let mut renderer: Option<FrameRenderer> = None;
    let speech: Vec<Value> = scene.get("speech").and_then(Value::as_array).cloned().unwrap_or_default();
    let speakers = speakers_of(&video, &speech);
    let view = VideoView::from(&video);
    scene["shots"]
        .as_array()
        .unwrap()
        .iter()
        .map(|shot| {
            let (width, height) = (shot["width"].as_u64().unwrap() as u32, shot["height"].as_u64().unwrap() as u32);
            let (captions, transparent) = (shot["captions"].as_bool().unwrap(), shot["transparent"].as_bool().unwrap());
            let renderer = renderer.get_or_insert_with(|| {
                FrameRenderer::new(
                    RenderOptions {
                        width,
                        height,
                        skip_unsupported: true,
                        captions,
                    },
                    Documents::new(documents.clone()),
                    fonts(),
                )
                .unwrap()
            });
            renderer.resize(width, height).unwrap();
            renderer.set_captions(captions);
            renderer.set_transparent(transparent);
            renderer.set_speakers(speakers.clone());
            renderer.clear_reports();
            let t = Ratio::new(i128::from(shot["frame"].as_i64().unwrap()), 30).unwrap();
            let plan = plan_frame(view, "seq", t).unwrap();
            let frame = renderer.render(view, &plan, t.to_f64(), &mut media).unwrap();
            let bytes = if transparent { demultiplied(frame) } else { frame.to_vec() };
            let mut out = shot.clone();
            out["sha256"] = json!(hex(&Sha256::digest(&bytes)));
            out["warnings"] = json!(renderer.warnings());
            out["skipped"] = json!(renderer.skipped());
            out
        })
        .collect()
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/parity.json")
}

/// The look of framing by shot segments (the derived sub-video's `crops`): the same asset is split into two segments at a shot boundary. The right segment's `sourceIn` continues from the left one, and each segment carries a different `crop` (the left takes the left half, the right takes the right half), filling the canvas. Frames are taken between the two segments and on either side of the seam.
fn two_piece_crop() -> Scene {
    Scene::new(
        "video-two-piece-crop",
        video(
            vec![
                video_item("v1", "a_v", 0, 30, json!({ "crop": { "left": 0, "top": 0, "right": 0.5, "bottom": 0 } })),
                video_item(
                    "v2",
                    "a_v",
                    30,
                    30,
                    json!({ "crop": { "left": 0.5, "top": 0, "right": 0, "bottom": 0 }, "timeMap": {
                        "kind": "linear", "sourceIn": { "ticks": "1", "timescale": 1 }, "rate": { "num": 1, "den": 1 }
                    } }),
                ),
            ],
            vec![video_asset("a_v", W, H)],
            json!({}),
        ),
        &[15, 29, 30, 45],
    )
}

/// Confirms that the two segments really use their own crops: the source is red on the left and blue on the right. The left segment shows only red and the right only blue, so the frame at the seam switches.
#[test]
fn two_piece_crop_switches_at_the_seam() {
    let scene = two_piece_crop();
    let mut media = Media::default().with("v1", halves(W, H, RED, BLUE)).with("v2", halves(W, H, RED, BLUE));
    for (frame, color) in [(15.0, RED), (29.0, RED), (30.0, BLUE), (45.0, BLUE)] {
        let pixels = render(&scene.video, at(frame), &mut media);
        for (x, y) in [(5, 5), (W / 2, H / 2), (W - 5, H - 5)] {
            near(px(&pixels, x, y), color, 2);
        }
    }
}

fn build_fixture() -> Value {
    let scenes: Vec<Value> = scenes()
        .into_iter()
        .map(|scene| {
            let mut value = json!({
                "name": scene.name,
                "video": serde_json::to_value(&scene.video).unwrap(),
                "documents": scene.documents,
                "pictures": scene.pictures.iter().map(|(item, w, h, bands)| json!({
                    "itemId": item, "width": w, "height": h, "bands": bands
                })).collect::<Vec<_>>(),
                "assets": scene.assets.iter().map(|(key, text)| json!({ "key": key, "text": text }))
                    .chain(scene.binary_assets.iter().map(|(key, bytes)| json!({ "key": key, "hex": hex(bytes) })))
                    .collect::<Vec<_>>(),
                "spectra": scene.spectra.iter().map(|(item, bytes)| json!({ "itemId": item, "hex": hex(bytes) })).collect::<Vec<_>>(),
                "audioSpectra": scene.audio_spectra.iter().map(|(key, bytes)| json!({ "key": key, "hex": hex(bytes) })).collect::<Vec<_>>(),
                "shots": scene.shots.iter().map(|s| json!({
                    "frame": s.frame, "width": s.width, "height": s.height, "captions": s.captions, "transparent": s.transparent
                })).collect::<Vec<_>>(),
            });
            if !scene.speech.is_empty() {
                value["speech"] = json!(scene.speech);
            }
            value["shots"] = json!(render_scene(&value));
            value
        })
        .collect();
    json!({ "fps": 30, "sequenceId": "seq", "scenes": scenes })
}

#[test]
fn parity_fixture_is_current() {
    let fixture = build_fixture();
    // Each scene drew its own content: no skipped layers, and first frames differ between scenes.
    let mut seen = BTreeMap::new();
    for scene in fixture["scenes"].as_array().unwrap() {
        for shot in scene["shots"].as_array().unwrap() {
            assert_eq!(shot["skipped"], json!([]), "{}", scene["name"]);
        }
        // The waveform got its spectrum (or this sequence really has no sound): no hint about a missing spectrum is reported.
        if scene["name"].as_str().unwrap().starts_with("visualizer-") {
            for shot in scene["shots"].as_array().unwrap() {
                assert_eq!(shot["warnings"], json!([]), "{}", scene["name"]);
            }
        }
        let digest = scene["shots"][0]["sha256"].as_str().unwrap().to_string();
        if let Some(other) = seen.insert(digest, scene["name"].clone()) {
            panic!("{} 与 {} 画出了同一帧", scene["name"], other);
        }
    }
    let text = serde_json::to_string_pretty(&fixture).unwrap() + "\n";
    if std::env::var_os("CUCCUT_UPDATE_PARITY").is_some() {
        std::fs::write(fixture_path(), &text).unwrap();
        return;
    }
    let stored = std::fs::read_to_string(fixture_path()).expect("no fixture: rewrite with CUCCUT_UPDATE_PARITY=1");
    let stored: Value = serde_json::from_str(&stored).unwrap();
    for (now, before) in fixture["scenes"]
        .as_array()
        .unwrap()
        .iter()
        .zip(stored["scenes"].as_array().unwrap())
    {
        assert_eq!(
            now, before,
            "场景 {} 与夹具不同：画法改了就 CUCCUT_UPDATE_PARITY=1 重写",
            now["name"]
        );
    }
    assert_eq!(fixture, stored, "场景的个数或次序与夹具不同");
}

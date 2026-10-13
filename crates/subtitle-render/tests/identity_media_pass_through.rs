//! Pass-through fast path for identity media elements (`render_media_element`).
//!
//! After `detach_main_video` normalizes the main picture into a full-length `mode:"pip"` / `place.w:100` overlay video element, every exported frame goes through `render_media_element`. In this identity form it would otherwise do three full-size 8.3 MB allocations, two full-size Bilinear resamples and one full-size alpha scan, all of them identity operations. The fast path skips them, on the premise that under identity parameters these steps **do not change the picture byte for byte**. The first two tests below measure that premise. The third checks that the full `render_media_element` output still equals the source image, and the fourth checks that non-identity forms are not misclassified as pass-through.
use serde_json::{Value, json};
use std::sync::Arc;
use subtitle_render::{OverlayRenderPlan, draw_fit_pixmap};
use timeline::schema::Fit;
use tiny_skia::{FilterQuality, Pixmap, PixmapPaint, Transform};

const WIDTH: u32 = 640;
const HEIGHT: u32 = 360;

/// Deterministic noise, premultiplied: every channel is at most alpha, so no illegal pixels are produced.
fn noise(width: u32, height: u32) -> Pixmap {
    let mut pixmap = Pixmap::new(width, height).unwrap();
    let mut state: u32 = 0x1234_5678;
    for chunk in pixmap.data_mut().chunks_exact_mut(4) {
        let mut next = |bound: u32| {
            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            ((state >> 16) % bound) as u8
        };
        let alpha = next(256);
        let cap = u32::from(alpha) + 1;
        chunk[0] = next(cap);
        chunk[1] = next(cap);
        chunk[2] = next(cap);
        chunk[3] = alpha;
    }
    pixmap
}

#[test]
fn identity_draw_fit_pixmap_is_bit_exact() {
    let source = noise(WIDTH, HEIGHT);
    let mut destination = Pixmap::new(WIDTH, HEIGHT).unwrap();
    draw_fit_pixmap(&mut destination, &source, Fit::Contain, 1.0);
    assert_eq!(destination.data(), source.data());
}

#[test]
fn identity_draw_pixmap_onto_transparent_field_is_bit_exact() {
    let local = noise(WIDTH, HEIGHT);
    let mut field = Pixmap::new(WIDTH, HEIGHT).unwrap();
    let transform = Transform::from_translate(-(WIDTH as f32) / 2.0, -(HEIGHT as f32) / 2.0)
        .post_scale(1.0, 1.0)
        .post_rotate(0.0)
        .post_translate(WIDTH as f32 / 2.0, HEIGHT as f32 / 2.0);
    assert!(
        transform.is_identity(),
        "构造出的变换不是恒等：{transform:?}"
    );
    field.draw_pixmap(
        0,
        0,
        local.as_ref(),
        &PixmapPaint {
            quality: FilterQuality::Bilinear,
            ..Default::default()
        },
        transform,
        None,
    );
    assert_eq!(field.data(), local.data());
}

#[test]
fn full_opacity_alpha_multiply_writes_nothing() {
    let source = noise(64, 64);
    let mut data = source.data().to_vec();
    render_raster::effects::multiply_premultiplied_alpha(&mut data, 1.0);
    assert_eq!(data, source.data());
}

fn studio_document() -> Value {
    json!({
        "meta": {"duration": 3.0},
        "style": {"mode": "orig", "fontFamily": "montserrat", "fontSize": 30},
        "cues": [], "sentences": [], "transCues": []
    })
}

/// `place.w` percentage → whether the source image is passed through unchanged.
fn render_pip(width_percent: f64) -> Pixmap {
    let mut assets = render_raster::LoadedAssets::default();
    assets
        .images
        .insert("probe".to_owned(), Arc::new(noise(WIDTH, HEIGHT)));
    let mut plan =
        OverlayRenderPlan::compile(&studio_document(), WIDTH, HEIGHT, 3.0, 30.0, None).unwrap();
    plan.media.base = render_raster::MediaStore::new(Arc::new(assets), 30.0);
    plan.load_projected_timeline_elements(&json!({
        "timeline": {"tracks": [{"id": "t1", "kind": "overlay", "elements": [{
            "id": "el-1", "kind": "image", "srcId": "probe",
            "start": 0.0, "end": 3.0,
            "mode": "pip", "fit": "contain",
            "place": {"w": width_percent}
        }]}]}
    }))
    .unwrap();
    let element = plan.elements[0].clone();
    plan.render_media_element(&element, 1.0, Default::default())
        .unwrap()
        .expect("媒体元素必须出图")
}

/// An identity PIP (box equal to the canvas, no fx/mask/tile/transform, fully opaque) must pass the source image through byte for byte.
/// This is both the correctness of the fast path and exactly the criterion for when the fast path applies.
#[test]
fn identity_pip_element_passes_the_source_through_unchanged() {
    let expected = noise(WIDTH, HEIGHT);
    let rendered = render_pip(100.0);
    assert_eq!(rendered.width(), WIDTH);
    assert_eq!(rendered.height(), HEIGHT);
    assert_eq!(rendered.data(), expected.data());
}

/// A non-identity form must not be misjudged as pass-through: a half-width PIP must still be truly resampled and sit centered on the canvas.
#[test]
fn scaled_pip_element_still_resamples() {
    let source = noise(WIDTH, HEIGHT);
    let rendered = render_pip(50.0);
    assert_eq!(rendered.width(), WIDTH);
    assert_eq!(rendered.height(), HEIGHT);
    assert_ne!(rendered.data(), source.data());
    // After shrinking to half size, the canvas corners must be empty. This proves a real transform ran rather than pass-through.
    assert_eq!(&rendered.data()[..4], &[0, 0, 0, 0]);
}

/// Opaque noise: on top of `noise`, alpha is pushed to full (under premultiplied, color channels stay ≤ alpha).
fn opaque_noise(width: u32, height: u32) -> Pixmap {
    let mut pixmap = noise(width, height);
    for chunk in pixmap.data_mut().chunks_exact_mut(4) {
        chunk[3] = 255;
    }
    pixmap
}

/// A fullscreen + contain + `bg` element is rendered once on the canvas.
fn render_fullscreen(source: Pixmap, bg: &str) -> Pixmap {
    let mut assets = render_raster::LoadedAssets::default();
    assets.images.insert("probe".to_owned(), Arc::new(source));
    let mut plan =
        OverlayRenderPlan::compile(&studio_document(), WIDTH, HEIGHT, 3.0, 30.0, None).unwrap();
    plan.media.base = render_raster::MediaStore::new(Arc::new(assets), 30.0);
    plan.load_projected_timeline_elements(&json!({
        "timeline": {"tracks": [{"id": "t1", "kind": "overlay", "elements": [{
            "id": "el-1", "kind": "image", "srcId": "probe",
            "start": 0.0, "end": 3.0,
            "mode": "fullscreen", "fit": "contain", "bg": bg
        }]}]}
    }))
    .unwrap();
    let element = plan.elements[0].clone();
    plan.render_media_element(&element, 1.0, Default::default())
        .unwrap()
        .expect("媒体元素必须出图")
}

/// Reference result of the old background-plate path: fill the canvas with the base color, then contain-paste the source image.
fn backdrop_reference(source: &Pixmap, color: tiny_skia::Color) -> Pixmap {
    let mut local = Pixmap::new(WIDTH, HEIGHT).unwrap();
    local.fill(color);
    draw_fit_pixmap(&mut local, source, Fit::Contain, 1.0);
    local
}

/// Same-size opaque source with black background: the background plate is completely covered, and the output equals the source image byte for byte, and also equals the old path.
#[test]
fn opaque_fullscreen_contain_with_black_bg_passes_the_source_through() {
    let source = opaque_noise(WIDTH, HEIGHT);
    let reference = backdrop_reference(&source, tiny_skia::Color::BLACK);
    assert_eq!(
        reference.data(),
        source.data(),
        "旧背景板路径对不透明源应是恒等"
    );
    let rendered = render_fullscreen(source.clone(), "black");
    assert_eq!(rendered.data(), source.data());
    assert_eq!(rendered.data(), reference.data());
}

/// As long as there is one semi-transparent pixel, it must still take the background-plate path: the black background shows through at that pixel.
#[test]
fn translucent_fullscreen_contain_with_black_bg_keeps_the_backdrop() {
    let mut source = opaque_noise(WIDTH, HEIGHT);
    let index = ((HEIGHT / 2 * WIDTH + WIDTH / 2) * 4) as usize;
    source.data_mut()[index..index + 4].copy_from_slice(&[10, 20, 30, 64]);
    let reference = backdrop_reference(&source, tiny_skia::Color::BLACK);
    assert_ne!(reference.data(), source.data());
    let rendered = render_fullscreen(source.clone(), "black");
    assert_eq!(rendered.data(), reference.data());
    assert_ne!(rendered.data(), source.data());
    assert_eq!(
        rendered.data()[index + 3],
        255,
        "黑底应把半透明像素垫成不透明"
    );
}

/// A solid-color background is likewise completely covered by an opaque source.
#[test]
fn opaque_fullscreen_contain_with_color_bg_passes_the_source_through() {
    let source = opaque_noise(WIDTH, HEIGHT);
    let reference =
        backdrop_reference(&source, tiny_skia::Color::from_rgba8(0x33, 0x66, 0x99, 255));
    let rendered = render_fullscreen(source.clone(), "#336699");
    assert_eq!(rendered.data(), source.data());
    assert_eq!(rendered.data(), reference.data());
}

/// With different sizes (requiring scaling and margins) it still takes the background-plate path: the result equals the old path's letterbox reference.
#[test]
fn smaller_fullscreen_contain_with_bg_still_letterboxes() {
    let source = opaque_noise(WIDTH / 2, HEIGHT / 2 - 20);
    let color = tiny_skia::Color::from_rgba8(0x33, 0x66, 0x99, 255);
    let reference = backdrop_reference(&source, color);
    let rendered = render_fullscreen(source, "#336699");
    assert_eq!(rendered.width(), WIDTH);
    assert_eq!(rendered.height(), HEIGHT);
    assert_eq!(rendered.data(), reference.data());
    // The top-left corner is margin, exposing the background color.
    assert_eq!(&rendered.data()[..4], &[0x33, 0x66, 0x99, 255]);
}

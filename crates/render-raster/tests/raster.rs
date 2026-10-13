//! Inside the `media` gate: this file uses `LoadedAssets` / `MediaStore` / `FrameRenderer`
//! (the BCF document rendering path and the host byte layer). It does not exist in `wasm-safe` builds (design §9.1).
#![cfg(feature = "media")]

use motion::effect::BlendMode;
use render_raster::drawop::{
    BitmapData, DrawOp, FrameOps, GradientStop, PaintData, PathData, PathSeg,
};
use render_raster::{LoadedAssets, MediaStore};
use std::sync::Arc;

const IDENTITY: [f32; 6] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

fn square_path(x: f32, y: f32, size: f32) -> PathData {
    PathData(vec![
        PathSeg {
            verb: 0,
            pts: [x, y, 0.0, 0.0, 0.0, 0.0],
        },
        PathSeg {
            verb: 1,
            pts: [x + size, y, 0.0, 0.0, 0.0, 0.0],
        },
        PathSeg {
            verb: 1,
            pts: [x + size, y + size, 0.0, 0.0, 0.0, 0.0],
        },
        PathSeg {
            verb: 1,
            pts: [x, y + size, 0.0, 0.0, 0.0, 0.0],
        },
        PathSeg {
            verb: 4,
            pts: [0.0; 6],
        },
    ])
}

fn empty_media() -> MediaStore {
    MediaStore::new(Arc::new(LoadedAssets::default()), 30.0)
}

fn pixel(pm: &tiny_skia::Pixmap, x: u32, y: u32) -> [u8; 4] {
    let i = ((y * pm.width() + x) * 4) as usize;
    pm.data()[i..i + 4].try_into().unwrap()
}

#[test]
fn rounded_rect_path_handles_square_rounded_and_invalid_rectangles() {
    let square = render_raster::raster::rounded_rect_path(0.0, 0.0, 10.0, 8.0, 0.0).unwrap();
    let rounded = render_raster::raster::rounded_rect_path(0.0, 0.0, 10.0, 8.0, 100.0).unwrap();
    assert!(!square.segments().collect::<Vec<_>>().is_empty());
    assert!(
        rounded
            .segments()
            .any(|segment| matches!(segment, tiny_skia::PathSegment::CubicTo(_, _, _)))
    );
    assert!(render_raster::raster::rounded_rect_path(0.0, 0.0, -1.0, 8.0, 0.0).is_none());
}

#[test]
fn rasterize_replays_shapes_strokes_and_translucent_layers() {
    let frame = FrameOps {
        static_prefix: None,
        paths: vec![square_path(11.0, 1.0, 6.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        ops: vec![
            DrawOp::Clear {
                color: [0.0, 0.0, 0.0, 1.0],
            },
            DrawOp::FillRect {
                x: 1.0,
                y: 1.0,
                w: 8.0,
                h: 8.0,
                radius: 2.0,
                color: [1.0, 0.0, 0.0, 1.0],
                tf: IDENTITY,
            },
            DrawOp::FillPath {
                path: 0,
                color: [0.0, 1.0, 0.0, 1.0],
                tf: IDENTITY,
            },
            DrawOp::StrokePath {
                path: 0,
                color: [1.0, 1.0, 1.0, 1.0],
                width: 1.0,
                tf: IDENTITY,
            },
            DrawOp::PushLayer {
                opacity: 0.5,
                blend: BlendMode::Normal,
            },
            DrawOp::FillRect {
                x: 2.0,
                y: 12.0,
                w: 6.0,
                h: 6.0,
                radius: 0.0,
                color: [0.0, 0.0, 1.0, 1.0],
                tf: IDENTITY,
            },
            DrawOp::PopLayer,
        ],
    };

    let pixmap = render_raster::raster::rasterize(&frame, 20, 20, &mut empty_media()).unwrap();

    let red = pixel(&pixmap, 4, 4);
    assert!(red[0] > 240 && red[1] < 10 && red[2] < 10);
    let green = pixel(&pixmap, 13, 4);
    assert!(green[1] > green[0] && green[1] > green[2]);
    let blue = pixel(&pixmap, 4, 14);
    assert!(blue[2] >= 120 && blue[2] <= 135);
}

#[test]
fn rasterize_draws_loaded_images_and_rejects_unknown_references() {
    let mut image = tiny_skia::Pixmap::new(2, 2).unwrap();
    image.fill(tiny_skia::Color::from_rgba8(12, 34, 56, 255));
    let mut assets = LoadedAssets::default();
    assets.images.insert("logo".into(), Arc::new(image));
    let mut media = MediaStore::new(Arc::new(assets), 30.0);
    let frame = FrameOps {
        static_prefix: None,
        strings: vec!["logo".into()],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![],
        ops: vec![
            DrawOp::Clear {
                color: [0.0, 0.0, 0.0, 1.0],
            },
            DrawOp::DrawMedia {
                asset: 0,
                media_ms: -1,
                src: [0.0; 4],
                tf: IDENTITY,
            },
        ],
    };
    let pixmap = render_raster::raster::rasterize(&frame, 2, 2, &mut media).unwrap();
    assert_eq!(pixel(&pixmap, 0, 0), [12, 34, 56, 255]);

    let unknown_string = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![],
        ops: vec![DrawOp::DrawMedia {
            asset: 0,
            media_ms: -1,
            src: [0.0; 4],
            tf: IDENTITY,
        }],
    };
    let err = render_raster::raster::rasterize(&unknown_string, 2, 2, &mut empty_media())
        .unwrap_err()
        .to_string();
    assert!(err.contains("unknown string"));
}

#[test]
fn rasterize_reports_unbalanced_layers() {
    let pop = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![],
        ops: vec![DrawOp::PopLayer],
    };
    assert!(
        render_raster::raster::rasterize(&pop, 2, 2, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("no matching PushMatte")
    );

    let push = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![],
        ops: vec![DrawOp::PushLayer {
            opacity: 1.0,
            blend: BlendMode::Normal,
        }],
    };
    assert!(
        render_raster::raster::rasterize(&push, 2, 2, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("layer stack is not empty")
    );
}

// ── DrawOp v3: clip stack and layer blending ────────────────────────────────

fn clear_white() -> DrawOp {
    DrawOp::Clear {
        color: [1.0, 1.0, 1.0, 1.0],
    }
}

fn fill_all(color: [f32; 4]) -> DrawOp {
    DrawOp::FillRect {
        x: 0.0,
        y: 0.0,
        w: 20.0,
        h: 20.0,
        radius: 0.0,
        color,
        tf: IDENTITY,
    }
}

#[test]
fn clip_path_limits_drawing_to_the_clipped_region() {
    let frame = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![square_path(0.0, 0.0, 10.0)],
        ops: vec![
            clear_white(),
            DrawOp::ClipPath {
                path: 0,
                tf: IDENTITY,
            },
            fill_all([1.0, 0.0, 0.0, 1.0]),
            DrawOp::PopClip,
        ],
    };
    let pixmap = render_raster::raster::rasterize(&frame, 20, 20, &mut empty_media()).unwrap();
    // Inside the clip: red; outside the clip: still the clear-screen white
    assert_eq!(pixel(&pixmap, 4, 4), [255, 0, 0, 255]);
    assert_eq!(pixel(&pixmap, 15, 15), [255, 255, 255, 255]);
}

#[test]
fn nested_clip_paths_intersect_and_pop_restores_the_outer_one() {
    let frame = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![
            square_path(0.0, 0.0, 12.0),
            square_path(6.0, 6.0, 12.0),
            square_path(0.0, 0.0, 20.0),
        ],
        ops: vec![
            clear_white(),
            DrawOp::ClipPath {
                path: 0,
                tf: IDENTITY,
            },
            DrawOp::ClipPath {
                path: 1,
                tf: IDENTITY,
            },
            fill_all([1.0, 0.0, 0.0, 1.0]),
            DrawOp::PopClip,
            // Back to the outer clip (0..12): blue drawn here should only land within 0..12
            DrawOp::FillRect {
                x: 0.0,
                y: 0.0,
                w: 4.0,
                h: 20.0,
                radius: 0.0,
                color: [0.0, 0.0, 1.0, 1.0],
                tf: IDENTITY,
            },
            DrawOp::PopClip,
        ],
    };
    let pixmap = render_raster::raster::rasterize(&frame, 20, 20, &mut empty_media()).unwrap();
    // The intersection 6..12 is red
    assert_eq!(pixel(&pixmap, 8, 8), [255, 0, 0, 255]);
    // Only inside the outer clip and not inside the inner clip ⇒ red not drawn, blue drawn
    assert_eq!(pixel(&pixmap, 2, 2), [0, 0, 255, 255]);
    // Outside the outer clip (y >= 12): blue not drawn either
    assert_eq!(pixel(&pixmap, 2, 16), [255, 255, 255, 255]);
}

#[test]
fn clip_path_transform_is_applied() {
    let frame = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![square_path(0.0, 0.0, 8.0)],
        ops: vec![
            clear_white(),
            DrawOp::ClipPath {
                path: 0,
                tf: [1.0, 0.0, 0.0, 1.0, 10.0, 10.0],
            },
            fill_all([1.0, 0.0, 0.0, 1.0]),
            DrawOp::PopClip,
        ],
    };
    let pixmap = render_raster::raster::rasterize(&frame, 20, 20, &mut empty_media()).unwrap();
    assert_eq!(pixel(&pixmap, 2, 2), [255, 255, 255, 255]);
    assert_eq!(pixel(&pixmap, 13, 13), [255, 0, 0, 255]);
}

#[test]
fn clip_stack_must_be_balanced_and_may_not_cross_a_layer_boundary() {
    let square = || square_path(0.0, 0.0, 8.0);

    let orphan_pop = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![],
        ops: vec![DrawOp::PopClip],
    };
    assert!(
        render_raster::raster::rasterize(&orphan_pop, 4, 4, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("PopClip has no matching")
    );

    let unbalanced = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![square()],
        ops: vec![DrawOp::ClipPath {
            path: 0,
            tf: IDENTITY,
        }],
    };
    assert!(
        render_raster::raster::rasterize(&unbalanced, 4, 4, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("clip stack is not empty")
    );

    // Push a layer outside, pop inside
    let pop_inside_layer = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![square()],
        ops: vec![
            DrawOp::ClipPath {
                path: 0,
                tf: IDENTITY,
            },
            DrawOp::PushLayer {
                opacity: 1.0,
                blend: BlendMode::Normal,
            },
            DrawOp::PopClip,
            DrawOp::PopLayer,
        ],
    };
    assert!(
        render_raster::raster::rasterize(&pop_inside_layer, 4, 4, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("crossed")
    );

    // Push a layer inside, pop outside
    let pop_outside_layer = FrameOps {
        static_prefix: None,
        strings: vec![],
        bitmaps: Vec::new(),
        paints: Vec::new(),
        paths: vec![square()],
        ops: vec![
            DrawOp::PushLayer {
                opacity: 1.0,
                blend: BlendMode::Normal,
            },
            DrawOp::ClipPath {
                path: 0,
                tf: IDENTITY,
            },
            DrawOp::PopLayer,
            DrawOp::PopClip,
        ],
    };
    assert!(
        render_raster::raster::rasterize(&pop_outside_layer, 4, 4, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("must not cross layer boundaries")
    );
}

/// Reference semantics of `PushLayer{blend}`: under `multiply`, 50% grey over a white backdrop should darken, whereas `normal` is just alpha compositing.
#[test]
fn pop_layer_applies_the_declared_blend_mode() {
    let render = |blend| {
        let frame = FrameOps {
            static_prefix: None,
            strings: vec![],
            bitmaps: Vec::new(),
            paints: Vec::new(),
            paths: vec![],
            ops: vec![
                DrawOp::FillRect {
                    x: 0.0,
                    y: 0.0,
                    w: 4.0,
                    h: 4.0,
                    radius: 0.0,
                    color: [0.5, 0.5, 1.0, 1.0],
                    tf: IDENTITY,
                },
                DrawOp::PushLayer {
                    opacity: 1.0,
                    blend,
                },
                DrawOp::FillRect {
                    x: 0.0,
                    y: 0.0,
                    w: 4.0,
                    h: 4.0,
                    radius: 0.0,
                    color: [1.0, 1.0, 0.5, 1.0],
                    tf: IDENTITY,
                },
                DrawOp::PopLayer,
            ],
        };
        pixel(
            &render_raster::raster::rasterize(&frame, 4, 4, &mut empty_media()).unwrap(),
            1,
            1,
        )
    };
    let normal = render(BlendMode::Normal);
    let multiply = render(BlendMode::Multiply);
    // normal: the upper layer is opaque ⇒ exactly the upper layer's color
    assert_eq!(&normal[..3], &[255, 255, 128]);
    // multiply: channels multiplied ⇒ necessarily darker, and the red and green channels come from the lower layer
    assert!(
        multiply[0] < normal[0] && multiply[1] < normal[1],
        "{multiply:?}"
    );
    assert_eq!(multiply[3], 255);
}

// ── v4: gradient paint, even-odd fill and track mattes (ADR-M11) ─────────────

fn ring_path(cx: f32, cy: f32, outer: f32, inner: f32) -> PathData {
    // Two concentric squares with the same winding direction: nonzero fills everything, even-odd hollows out the center.
    let mut segs = square_path(cx - outer, cy - outer, outer * 2.0).0;
    segs.extend(square_path(cx - inner, cy - inner, inner * 2.0).0);
    PathData(segs)
}

#[test]
fn a_linear_gradient_paint_sweeps_between_its_stops() {
    let frame = FrameOps {
        static_prefix: None,
        paths: vec![square_path(0.0, 0.0, 16.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Linear {
            p0: [0.0, 0.0],
            p1: [16.0, 0.0],
            stops: vec![
                GradientStop {
                    offset: 0.0,
                    color: [1.0, 0.0, 0.0, 1.0],
                },
                GradientStop {
                    offset: 1.0,
                    color: [0.0, 0.0, 1.0, 1.0],
                },
            ],
        }],
        ops: vec![DrawOp::FillPathPaint {
            path: 0,
            paint: 0,
            even_odd: false,
            tf: IDENTITY,
        }],
    };
    let pm = render_raster::raster::rasterize(&frame, 16, 16, &mut empty_media()).unwrap();
    let left = pixel(&pm, 1, 8);
    let right = pixel(&pm, 14, 8);
    assert!(left[0] > 200 && left[2] < 60, "左端应当偏红：{left:?}");
    assert!(right[2] > 200 && right[0] < 60, "右端应当偏蓝：{right:?}");
}

#[test]
fn even_odd_hollows_out_what_nonzero_fills_in() {
    let make = |even_odd| FrameOps {
        static_prefix: None,
        paths: vec![ring_path(8.0, 8.0, 7.0, 3.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Solid([1.0, 1.0, 1.0, 1.0])],
        ops: vec![DrawOp::FillPathPaint {
            path: 0,
            paint: 0,
            even_odd,
            tf: IDENTITY,
        }],
    };
    let nonzero =
        render_raster::raster::rasterize(&make(false), 16, 16, &mut empty_media()).unwrap();
    let evenodd =
        render_raster::raster::rasterize(&make(true), 16, 16, &mut empty_media()).unwrap();
    assert_eq!(pixel(&nonzero, 8, 8)[3], 255, "nonzero 中心应当被填满");
    assert_eq!(pixel(&evenodd, 8, 8)[3], 0, "even-odd 中心应当被挖空");
    // The ring band is consistent under both rules
    assert_eq!(pixel(&nonzero, 8, 2)[3], pixel(&evenodd, 8, 2)[3]);
}

#[test]
fn an_alpha_matte_cuts_the_layer_below_it() {
    let frame = FrameOps {
        static_prefix: None,
        paths: vec![square_path(0.0, 0.0, 16.0), square_path(0.0, 0.0, 8.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Solid([1.0, 1.0, 1.0, 1.0])],
        ops: vec![
            DrawOp::PushLayer {
                opacity: 1.0,
                blend: BlendMode::Normal,
            },
            // Content: entirely white
            DrawOp::FillPathPaint {
                path: 0,
                paint: 0,
                even_odd: false,
                tf: IDENTITY,
            },
            // Matte source: top-left 8×8
            DrawOp::PushMatte,
            DrawOp::FillPathPaint {
                path: 1,
                paint: 0,
                even_odd: false,
                tf: IDENTITY,
            },
            DrawOp::PopMatte { mode: 0 },
            DrawOp::PopLayer,
        ],
    };
    let pm = render_raster::raster::rasterize(&frame, 16, 16, &mut empty_media()).unwrap();
    assert_eq!(pixel(&pm, 2, 2)[3], 255, "遮罩内保留");
    assert_eq!(pixel(&pm, 13, 13)[3], 0, "遮罩外抹掉");
}

#[test]
fn an_inverted_alpha_matte_keeps_exactly_the_complement() {
    let make = |mode| FrameOps {
        static_prefix: None,
        paths: vec![square_path(0.0, 0.0, 16.0), square_path(0.0, 0.0, 8.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Solid([1.0, 1.0, 1.0, 1.0])],
        ops: vec![
            DrawOp::PushLayer {
                opacity: 1.0,
                blend: BlendMode::Normal,
            },
            DrawOp::FillPathPaint {
                path: 0,
                paint: 0,
                even_odd: false,
                tf: IDENTITY,
            },
            DrawOp::PushMatte,
            DrawOp::FillPathPaint {
                path: 1,
                paint: 0,
                even_odd: false,
                tf: IDENTITY,
            },
            DrawOp::PopMatte { mode },
            DrawOp::PopLayer,
        ],
    };
    let pm = render_raster::raster::rasterize(&make(1), 16, 16, &mut empty_media()).unwrap();
    assert_eq!(pixel(&pm, 2, 2)[3], 0);
    assert_eq!(pixel(&pm, 13, 13)[3], 255);
}

#[test]
fn matte_primitives_refuse_unbalanced_streams() {
    let base = |ops| FrameOps {
        static_prefix: None,
        paths: vec![square_path(0.0, 0.0, 4.0)],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Solid([1.0, 1.0, 1.0, 1.0])],
        ops,
    };
    // PushMatte must be inside some layer
    let orphan = base(vec![DrawOp::PushMatte, DrawOp::PopMatte { mode: 0 }]);
    assert!(
        render_raster::raster::rasterize(&orphan, 8, 8, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("PushMatte")
    );
    // If a matte is pushed inside a layer, you must PopMatte before PopLayer
    let leaked = base(vec![
        DrawOp::PushLayer {
            opacity: 1.0,
            blend: BlendMode::Normal,
        },
        DrawOp::PushMatte,
        DrawOp::PopLayer,
    ]);
    assert!(
        render_raster::raster::rasterize(&leaked, 8, 8, &mut empty_media())
            .unwrap_err()
            .to_string()
            .contains("PopMatte")
    );
}

#[test]
fn a_stroke_paint_honours_cap_and_join() {
    let make = |cap| FrameOps {
        static_prefix: None,
        paths: vec![PathData(vec![
            PathSeg {
                verb: 0,
                pts: [4.0, 8.0, 0.0, 0.0, 0.0, 0.0],
            },
            PathSeg {
                verb: 1,
                pts: [12.0, 8.0, 0.0, 0.0, 0.0, 0.0],
            },
        ])],
        strings: vec![],
        bitmaps: Vec::new(),
        paints: vec![PaintData::Solid([1.0, 1.0, 1.0, 1.0])],
        ops: vec![DrawOp::StrokePathPaint {
            path: 0,
            paint: 0,
            width: 4.0,
            cap,
            join: 1,
            miter: 4.0,
            tf: IDENTITY,
        }],
    };
    let butt = render_raster::raster::rasterize(&make(0), 16, 16, &mut empty_media()).unwrap();
    let square = render_raster::raster::rasterize(&make(2), 16, 16, &mut empty_media()).unwrap();
    // One pixel outside the endpoint: butt is empty, square extends the line cap outward
    assert_eq!(pixel(&butt, 13, 8)[3], 0);
    assert_eq!(pixel(&square, 13, 8)[3], 255);
}

/// `DrawBitmap` (v5, color glyphs): pixels are pasted as-is (premultiplied) at the position given by `tf`, not affected by any text color; `opacity` multiplies over the whole image; clipping applies as with other primitives.
#[test]
fn draw_bitmap_places_premultiplied_pixels_with_opacity_and_clip() {
    // 2×2: top-left opaque red, top-right semi-transparent green (premultiplied 128), bottom row opaque blue.
    let rgba: Vec<u8> = [
        [255, 0, 0, 255],
        [0, 128, 0, 128],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
    ]
    .concat();
    let checker = BitmapData {
        width: 2,
        height: 2,
        rgba: rgba.into(),
    };
    let solid = BitmapData {
        width: 2,
        height: 2,
        rgba: [[200, 40, 0, 255]; 4].concat().into(),
    };
    let frame = FrameOps {
        paths: vec![square_path(0.0, 0.0, 14.0)],
        bitmaps: vec![checker, solid],
        ops: vec![
            // Integer translation, unit scale: pixel-for-pixel as-is.
            DrawOp::DrawBitmap {
                bitmap: 0,
                opacity: 1.0,
                tf: [1.0, 0.0, 0.0, 1.0, 3.0, 4.0],
            },
            // Semi-transparent over the whole image.
            DrawOp::DrawBitmap {
                bitmap: 1,
                opacity: 0.5,
                tf: [1.0, 0.0, 0.0, 1.0, 0.0, 12.0],
            },
            // 2× magnification, right half clipped away (clip box is [0,14)²).
            DrawOp::ClipPath {
                path: 0,
                tf: IDENTITY,
            },
            DrawOp::DrawBitmap {
                bitmap: 1,
                opacity: 1.0,
                tf: [4.0, 0.0, 0.0, 4.0, 10.0, 0.0],
            },
            DrawOp::PopClip,
        ],
        ..FrameOps::default()
    };
    let pm = render_raster::raster::rasterize(&frame, 20, 16, &mut empty_media()).unwrap();
    assert_eq!(pixel(&pm, 3, 4), [255, 0, 0, 255]);
    assert_eq!(pixel(&pm, 4, 4), [0, 128, 0, 128]);
    assert_eq!(pixel(&pm, 3, 5), [0, 0, 255, 255]);
    assert_eq!(pixel(&pm, 2, 4), [0, 0, 0, 0], "位图之外不画");
    let half = pixel(&pm, 0, 12);
    assert!((126..=129).contains(&half[3]), "opacity 0.5：{half:?}");
    assert!(
        (99..=101).contains(&half[0]),
        "预乘红按 opacity 减半：{half:?}"
    );
    assert_eq!(pixel(&pm, 12, 2), [200, 40, 0, 255], "缩放后的内部像素");
    assert_eq!(pixel(&pm, 15, 2), [0, 0, 0, 0], "裁剪框外不画");
}

#[test]
fn draw_bitmap_refuses_unknown_or_malformed_bitmaps() {
    let unknown = FrameOps {
        ops: vec![DrawOp::DrawBitmap {
            bitmap: 3,
            opacity: 1.0,
            tf: IDENTITY,
        }],
        ..FrameOps::default()
    };
    let error = render_raster::raster::rasterize(&unknown, 4, 4, &mut empty_media())
        .unwrap_err()
        .to_string();
    assert!(error.contains("unknown bitmap"), "got {error}");

    let short = FrameOps {
        bitmaps: vec![BitmapData {
            width: 2,
            height: 2,
            rgba: vec![0; 12].into(),
        }],
        ops: vec![DrawOp::DrawBitmap {
            bitmap: 0,
            opacity: 1.0,
            tf: IDENTITY,
        }],
        ..FrameOps::default()
    };
    let error = render_raster::raster::rasterize(&short, 4, 4, &mut empty_media())
        .unwrap_err()
        .to_string();
    assert!(error.contains("size does not match its bytes"), "got {error}");
}

/// `static_prefix` is a raster cache hint: when the same key appears a second time, the cached prefix picture is copied directly, and the instructions in the prefix are not executed again. Two frames with the same key but different content expose the hit (the recorder guarantees same key ⇒ same content; here it is deliberately violated only to observe the cache), and confirm that instructions after the prefix still execute as usual and that frames without the hint are unaffected. The key is a value unique to this file, so other tests will not evict it.
#[test]
fn static_prefix_is_rasterized_once_per_key_and_size() {
    use render_raster::drawop::StaticPrefix;
    const KEY: u64 = 0x5a7e_bac0_0000_0001;
    let frame = |bg: [f32; 4], hint: bool| FrameOps {
        paths: vec![square_path(1.0, 1.0, 2.0)],
        ops: vec![
            DrawOp::Clear { color: bg },
            DrawOp::FillPath {
                path: 0,
                color: [0.0, 1.0, 0.0, 1.0],
                tf: IDENTITY,
            },
        ],
        static_prefix: hint.then_some(StaticPrefix { key: KEY, ops: 1 }),
        ..FrameOps::default()
    };
    let red = [1.0, 0.0, 0.0, 1.0];
    let blue = [0.0, 0.0, 1.0, 1.0];
    let draw = |frame: &FrameOps, size: u32| {
        render_raster::raster::rasterize(frame, size, size, &mut empty_media()).unwrap()
    };

    let first = draw(&frame(red, true), 6);
    assert_eq!(
        first.data(),
        draw(&frame(red, false), 6).data(),
        "未命中=从头重放"
    );
    let hit = draw(&frame(blue, true), 6);
    assert_eq!(pixel(&hit, 0, 0), [255, 0, 0, 255], "同键命中：前缀取缓存");
    assert_eq!(pixel(&hit, 2, 2), [0, 255, 0, 255], "前缀之后照常画");
    assert_eq!(hit.data(), first.data());
    // Size is part of the key; frames without the hint do not consult the cache.
    assert_eq!(pixel(&draw(&frame(blue, true), 7), 0, 0), [0, 0, 255, 255]);
    assert_eq!(pixel(&draw(&frame(blue, false), 6), 0, 0), [0, 0, 255, 255]);
    // An out-of-range hint is ignored (no panic, no caching).
    let mut bogus = frame(blue, false);
    bogus.static_prefix = Some(StaticPrefix {
        key: KEY + 1,
        ops: 9,
    });
    assert_eq!(pixel(&draw(&bogus, 6), 0, 0), [0, 0, 255, 255]);
}

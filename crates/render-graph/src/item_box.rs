//! A visual instance's box on the canvas (format spec §3.5). The frame plan's layers, the stage's selection and hit boxes, and the property panel's position and size all take it from here; there is only one copy: `place` (percent of the frame) → pixel box is [`item_box`], and after the stage changes the box it is written back to `place` via [`place_from_box`].
//! The height and defaults depend on the kind; see `timeline::geometry`.

use std::collections::BTreeMap;

use editor_semantics::Rate;
use serde::{Deserialize, Serialize};
use timeline::geometry::{DEFAULT_ELEMENT_X, ElementGeometry, default_place, media_box, media_default_w, static_box, width_basis};
use timeline::schema::ElementKind;
use video_model::{AssetKind, AssetRecord, Crop, Id, Place, ShapeProps, StickerProps, TimelineItem, VersionRef, VisualMode};

use crate::{PixelBox, clean};

/// Instance kinds that have a box (those whose `TimelineItem` has `place`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum VisualKind {
    Video,
    Image,
    Text,
    Shape,
    Sticker,
    Visualizer,
    Progress,
    Draw,
    Placeholder,
    Confetti,
    Whiteboard,
    Composition,
}

/// The part of the referenced material that concerns the box: the kind, and the source's display size ([`display_size`], `None` if unknown).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AssetFacts {
    pub kind: AssetKind,
    pub display: Option<(f64, f64)>,
}

impl AssetFacts {
    /// Looked up from the material table: `None` if the material is not in the table.
    pub fn lookup(assets: &BTreeMap<Id, AssetRecord>, asset: &VersionRef) -> Option<AssetFacts> {
        let record = assets.get(&asset.id)?;
        Some(AssetFacts {
            kind: record.kind,
            display: display_size(assets, asset),
        })
    }
}

/// The fields that box-pushing needs: kind, `place`, the visual media's `mode` (compositions have none), the properties of shapes and stickers (height is determined by them), cropping (the aspect ratio of the remaining region determines the box height), and the referenced material (compositions are pre-rendered).
#[derive(Clone, Copy, Debug)]
pub struct ItemGeometry<'a> {
    pub kind: VisualKind,
    pub place: &'a Place,
    pub mode: Option<VisualMode>,
    pub shape: Option<&'a ShapeProps>,
    pub sticker: Option<&'a StickerProps>,
    pub crop: Option<&'a Crop>,
    /// `None` when there is no reference or the material is not found in the table.
    pub asset: Option<AssetFacts>,
}

/// Box-pushing input for timeline instances; audio and captions have no box.
pub fn item_geometry<'a>(item: &'a TimelineItem, assets: &BTreeMap<Id, AssetRecord>) -> Option<ItemGeometry<'a>> {
    let facts = |asset: Option<&VersionRef>| asset.and_then(|a| AssetFacts::lookup(assets, a));
    let base = |kind, place| ItemGeometry {
        kind,
        place,
        mode: None,
        shape: None,
        sticker: None,
        crop: None,
        asset: None,
    };
    Some(match item {
        TimelineItem::Video(v) => ItemGeometry {
            mode: v.media.mode,
            crop: v.crop.as_ref(),
            asset: facts(Some(&v.asset_ref)),
            ..base(VisualKind::Video, &v.place)
        },
        TimelineItem::Image(i) => ItemGeometry {
            mode: i.media.mode,
            crop: i.crop.as_ref(),
            asset: facts(Some(&i.asset_ref)),
            ..base(VisualKind::Image, &i.place)
        },
        TimelineItem::Text(t) => base(VisualKind::Text, &t.place),
        TimelineItem::Shape(s) => ItemGeometry {
            shape: Some(&s.shape),
            ..base(VisualKind::Shape, &s.place)
        },
        TimelineItem::Sticker(s) => ItemGeometry {
            mode: s.media.mode,
            sticker: Some(&s.sticker),
            asset: facts(s.asset_ref.as_ref()),
            ..base(VisualKind::Sticker, &s.place)
        },
        TimelineItem::Visualizer(v) => base(VisualKind::Visualizer, &v.place),
        TimelineItem::Progress(p) => base(VisualKind::Progress, &p.place),
        TimelineItem::Draw(d) => base(VisualKind::Draw, &d.place),
        TimelineItem::Placeholder(p) => ItemGeometry {
            mode: p.media.mode,
            asset: facts(p.asset_ref.as_ref()),
            ..base(VisualKind::Placeholder, &p.place)
        },
        TimelineItem::Confetti(c) => base(VisualKind::Confetti, &c.place),
        TimelineItem::Whiteboard(w) => ItemGeometry {
            mode: w.media.mode,
            asset: facts(Some(&w.asset_ref)),
            ..base(VisualKind::Whiteboard, &w.place)
        },
        TimelineItem::Composition(c) => ItemGeometry {
            asset: facts(c.prerender.as_ref()),
            ..base(VisualKind::Composition, &c.place)
        },
        TimelineItem::Audio(_) | TimelineItem::Caption(_) => return None,
    })
}

/// An instance's box: center, unrotated width and height (pixels, origin at top-left), angle clockwise about the center (degrees), and flip.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemBox {
    pub cx: f64,
    pub cy: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub flip_x: bool,
    pub flip_y: bool,
    /// Fills the canvas (visual media in fill mode, compositions with no position and width given): the box ignores `place`'s position, width and scale, and can only rotate.
    pub fullscreen: bool,
}

/// How the box is pushed: media boxes take height from the source's aspect ratio; static boxes take height from their kind.
enum Frame<'a> {
    Media {
        kind: ElementKind,
        fullscreen: bool,
        natural: Option<(f64, f64)>,
    },
    Static {
        kind: ElementKind,
        geometry: ElementGeometry<'a>,
    },
}

fn frame_of<'a>(item: &ItemGeometry<'a>) -> Frame<'a> {
    let media_mode = item.mode == Some(VisualMode::Fullscreen);
    let display = item.asset.and_then(|a| a.display);
    let media = |kind, natural| Frame::Media {
        kind,
        fullscreen: media_mode,
        natural,
    };
    let plain = |kind| Frame::Static {
        kind,
        geometry: ElementGeometry::default(),
    };
    // Stickers and placeholder boxes are positioned like media only when the material is an image or video.
    let visual_asset = matches!(item.asset.map(|a| a.kind), Some(AssetKind::Image | AssetKind::Video));
    match item.kind {
        VisualKind::Video => media(ElementKind::Video, cropped_size(display, item.crop)),
        VisualKind::Image => media(ElementKind::Image, cropped_size(display, item.crop)),
        VisualKind::Whiteboard => media(ElementKind::Whiteboard, display),
        VisualKind::Sticker if visual_asset => media(ElementKind::Sticker, display),
        VisualKind::Sticker => Frame::Static {
            kind: ElementKind::Sticker,
            geometry: ElementGeometry {
                sticker: item.sticker,
                ..ElementGeometry::default()
            },
        },
        VisualKind::Placeholder if visual_asset => media(ElementKind::Placeholder, display),
        VisualKind::Placeholder => plain(ElementKind::Placeholder),
        // Compositions have no `mode`: when `place` gives no position and width, they fill the canvas; otherwise they are positioned as picture-in-picture.
        VisualKind::Composition => Frame::Media {
            kind: ElementKind::Video,
            fullscreen: item.place.x.is_none() && item.place.y.is_none() && item.place.w.is_none(),
            natural: display,
        },
        VisualKind::Text => plain(ElementKind::Text),
        VisualKind::Shape => Frame::Static {
            kind: ElementKind::Shape,
            geometry: ElementGeometry {
                shape: item.shape,
                ..ElementGeometry::default()
            },
        },
        VisualKind::Visualizer => plain(ElementKind::Visualizer),
        VisualKind::Progress => plain(ElementKind::Progress),
        VisualKind::Draw => plain(ElementKind::Draw),
        VisualKind::Confetti => plain(ElementKind::Confetti),
    }
}

/// The instance's box on the canvas (the frame plan draws with it).
pub fn item_box(item: &ItemGeometry<'_>, canvas: (f64, f64)) -> ItemBox {
    let (pixel, fullscreen) = pixel_box(item, canvas);
    ItemBox {
        cx: pixel.cx,
        cy: pixel.cy,
        width: pixel.width,
        height: pixel.height,
        rotation: pixel.rotation,
        flip_x: pixel.flip_x,
        flip_y: pixel.flip_y,
        fullscreen,
    }
}

pub(crate) fn pixel_box(item: &ItemGeometry<'_>, canvas: (f64, f64)) -> (PixelBox, bool) {
    match frame_of(item) {
        Frame::Media { kind, fullscreen, natural } => (media_pixel_box(kind, fullscreen, item.place, natural, canvas), fullscreen),
        Frame::Static { kind, geometry } => (element_box(kind, geometry, item.place, canvas), false),
    }
}

/// The kind's default placement: where the box falls when `place` has no fields at all (center `x`, `y` as percentages of the frame; width `w` as a percentage of the width basis). When creating a new instance, `place` is filled from this, so the drawn result is the kind's natural box. Computed with no material, as picture-in-picture; compositions are the exception: once a position is given they no longer fill the canvas.
pub fn place_defaults(kind: VisualKind) -> Place {
    let empty = Place::default();
    let item = ItemGeometry {
        kind,
        place: &empty,
        mode: None,
        shape: None,
        sticker: None,
        crop: None,
        asset: None,
    };
    let (w, y) = match frame_of(&item) {
        Frame::Media { kind, .. } => (media_default_w(kind), 50.0),
        Frame::Static { kind, geometry } => {
            let defaults = default_place(kind, geometry.aspect);
            (defaults.w, defaults.y)
        }
    };
    Place {
        x: Some(DEFAULT_ELEMENT_X),
        y: Some(y),
        w: Some(w),
        ..Place::default()
    }
}

/// The box given by the stage (center, unrotated width and height in pixels; angle in degrees).
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoxPose {
    pub cx: f64,
    pub cy: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
}

/// The fields to write back to `place`: only those that differ from the current value after rounding.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceChange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rot: Option<f64>,
}

/// Whether the computed value counts as changed: it differs from the current value, and still differs after rounding.
const CHANGE_EPS: f64 = 1e-6;

fn round_to(value: f64, k: f64) -> f64 {
    clean(libm::round(value * k) / k)
}

fn differs(value: f64, current: f64, k: f64) -> bool {
    (value - current).abs() > CHANGE_EPS && (round_to(value, k) - current).abs() > CHANGE_EPS
}

/// Angle wrapped into (−180, 180]; 0 if not a finite number.
pub fn wrap_rotation(degrees: f64) -> f64 {
    if !degrees.is_finite() {
        return 0.0;
    }
    let r = libm::fmod(libm::fmod(degrees + 180.0, 360.0) + 360.0, 360.0) - 180.0;
    if r == -180.0 { 180.0 } else { clean(r) }
}

/// Box → `place` (the inverse of [`item_box`]). `scale` is untouched; the box width is converted to `w`; the box height is written to `scaleY` (height ÷ the natural height inferred from the width as saved, so converting back gives the given height). Percentages and angles keep one decimal place, `scaleY` keeps three; for a fill-canvas item only the angle is written.
pub fn place_from_box(item: &ItemGeometry<'_>, pose: BoxPose, canvas: (f64, f64)) -> PlaceChange {
    let place = item.place;
    let mut out = PlaceChange::default();
    let rotation = wrap_rotation(pose.rotation);
    if differs(rotation, wrap_rotation(place.rot.unwrap_or(0.0)), 10.0) {
        out.rot = Some(round_to(rotation, 10.0));
    }
    let (width, height) = canvas;
    if !(width > 0.0 && height > 0.0) {
        return out;
    }
    // The default when omitted, and which edge `w` measures, depend on how the box is derived.
    let (default_w, default_y, basis) = match frame_of(item) {
        Frame::Media { fullscreen: true, .. } => return out,
        Frame::Media { kind, .. } => (media_default_w(kind), 50.0, width),
        Frame::Static { kind, geometry } => {
            let defaults = default_place(kind, geometry.aspect);
            (defaults.w, defaults.y, width_basis(kind, &geometry, canvas))
        }
    };
    let scale = place.scale.unwrap_or(1.0);
    let x = pose.cx / width * 100.0;
    let y = pose.cy / height * 100.0;
    let w = pose.width / (basis * scale) * 100.0;
    if differs(x, place.x.unwrap_or(DEFAULT_ELEMENT_X), 10.0) {
        out.x = Some(round_to(x, 10.0));
    }
    if differs(y, place.y.unwrap_or(default_y), 10.0) {
        out.y = Some(round_to(y, 10.0));
    }
    if differs(w, place.w.unwrap_or(default_w), 10.0) {
        out.w = Some(round_to(w, 10.0));
    }
    // The natural height is inferred from the width as saved: the same function converting back yields a box height consistent with this.
    let stored = Place {
        w: out.w.or(place.w),
        scale_y: None,
        ..place.clone()
    };
    let (natural, _) = pixel_box(&ItemGeometry { place: &stored, ..*item }, canvas);
    let scale_y = pose.height / natural.height;
    if natural.height > 0.0 && scale_y.is_finite() && differs(scale_y, place.scale_y.unwrap_or(1.0), 1000.0) {
        out.scale_y = Some(round_to(scale_y, 1000.0));
    }
    out
}

/// The source's display size: width and height already swapped for rotation metadata, multiplied by the pixel aspect ratio. When unknown, it is handled as the layout box (fill).
pub fn display_size(assets: &BTreeMap<Id, AssetRecord>, asset: &VersionRef) -> Option<(f64, f64)> {
    let video = assets.get(&asset.id)?.revisions.get(&asset.revision)?.video.as_ref()?;
    display_dims(video.display_width, video.display_height, video.pixel_aspect_ratio)
}

/// The algorithm of [`display_size`] itself: display width and height (already swapped for rotation), multiplied by the pixel aspect ratio.
pub fn display_dims(display_width: u32, display_height: u32, par: Rate) -> Option<(f64, f64)> {
    par.validate("pixelAspectRatio").ok()?;
    let width = display_width as f64 * par.num as f64 / par.den as f64;
    let height = display_height as f64;
    (width > 0.0 && height > 0.0).then_some((width, height))
}

/// The box of a non-media element: `timeline::geometry::static_box` (includes `scale` and `scaleY`; square variants measure width by the short side).
fn element_box(kind: ElementKind, geometry: ElementGeometry<'_>, place: &Place, canvas: (f64, f64)) -> PixelBox {
    let v2 = place.to_timeline();
    PixelBox::new(place, static_box(kind, &geometry, Some(&v2), canvas))
}

/// The source size remaining after cropping (format spec §3.5: the aspect ratio of the remaining region participates in the box height and `fit`).
fn cropped_size(dims: Option<(f64, f64)>, crop: Option<&Crop>) -> Option<(f64, f64)> {
    let [cl, ct, cr, cb] = crop.filter(|c| c.is_valid()).map_or([0.0, 0.0, 1.0, 1.0], Crop::rect);
    dims.map(|(w, h)| (w * (cr - cl), h * (cb - ct)))
}

/// A media element's box: fill is the entire canvas (ignoring `place`'s position and width); picture-in-picture takes its height from the source's aspect ratio (or the canvas's when unknown), then multiplied by `scale` and `scaleY`.
fn media_pixel_box(kind: ElementKind, fullscreen: bool, place: &Place, natural: Option<(f64, f64)>, canvas: (f64, f64)) -> PixelBox {
    let v2 = place.to_timeline();
    let (mut width, mut height, cx, cy) = media_box(kind, fullscreen, &v2, natural.unwrap_or(canvas), canvas);
    if !fullscreen {
        let scale = place.scale.unwrap_or(1.0);
        width *= scale;
        height *= scale * place.scale_y.unwrap_or(1.0);
    }
    PixelBox::new(place, (cx - width / 2.0, cy - height / 2.0, width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CANVAS: (f64, f64) = (1920.0, 1080.0);

    fn geometry(kind: VisualKind, place: &Place) -> ItemGeometry<'_> {
        ItemGeometry {
            kind,
            place,
            mode: None,
            shape: None,
            sticker: None,
            crop: None,
            asset: None,
        }
    }

    fn pose(b: ItemBox) -> BoxPose {
        BoxPose {
            cx: b.cx,
            cy: b.cy,
            width: b.width,
            height: b.height,
            rotation: b.rotation,
        }
    }

    fn tall_video() -> Option<AssetFacts> {
        Some(AssetFacts {
            kind: AssetKind::Video,
            display: Some((1080.0, 1920.0)),
        })
    }

    fn change(x: Option<f64>, y: Option<f64>, w: Option<f64>, scale_y: Option<f64>, rot: Option<f64>) -> PlaceChange {
        PlaceChange { x, y, w, scale_y, rot }
    }

    #[test]
    fn fullscreen_media_fills_the_canvas_and_only_turns() {
        let place = Place {
            x: Some(10.0),
            w: Some(50.0),
            rot: Some(30.0),
            ..Place::default()
        };
        let video = ItemGeometry {
            mode: Some(VisualMode::Fullscreen),
            ..geometry(VisualKind::Video, &place)
        };
        let b = item_box(&video, CANVAS);
        assert_eq!(
            (b.cx, b.cy, b.width, b.height, b.rotation, b.fullscreen),
            (960.0, 540.0, 1920.0, 1080.0, 30.0, true)
        );
        let moved = BoxPose {
            cx: 100.0,
            cy: 100.0,
            width: 300.0,
            height: 300.0,
            rotation: 45.0,
        };
        assert_eq!(place_from_box(&video, moved, CANVAS), change(None, None, None, None, Some(45.0)));
        // Compositions fill when no position and width are given.
        let empty = Place::default();
        assert!(item_box(&geometry(VisualKind::Composition, &empty), CANVAS).fullscreen);
    }

    #[test]
    fn pip_media_takes_the_source_aspect_and_round_trips() {
        let place = Place {
            x: Some(25.0),
            y: Some(50.0),
            w: Some(30.0),
            ..Place::default()
        };
        let video = ItemGeometry {
            asset: tall_video(),
            ..geometry(VisualKind::Video, &place)
        };
        let b = item_box(&video, CANVAS);
        assert_eq!((b.cx, b.cy, b.width, b.fullscreen), (480.0, 540.0, 576.0, false));
        assert!((b.height - 1024.0).abs() < 1e-9);
        // When the source size is unknown, the canvas aspect ratio is used.
        assert!((item_box(&geometry(VisualKind::Video, &place), CANVAS).height - 324.0).abs() < 1e-9);
        let target = BoxPose {
            cx: 576.0,
            cy: 432.0,
            width: 384.0,
            height: 384.0 * 1920.0 / 1080.0,
            rotation: 0.0,
        };
        assert_eq!(
            place_from_box(&video, target, CANVAS),
            change(Some(30.0), Some(40.0), Some(20.0), None, None)
        );
        let squashed = BoxPose {
            height: b.height / 2.0,
            ..pose(b)
        };
        assert_eq!(place_from_box(&video, squashed, CANVAS), change(None, None, None, Some(0.5), None));
    }

    #[test]
    fn crop_changes_the_media_aspect() {
        let place = Place {
            w: Some(50.0),
            ..Place::default()
        };
        let crop = Crop {
            left: 0.0,
            top: 0.0,
            right: 0.5,
            bottom: 0.0,
        };
        let video = ItemGeometry {
            crop: Some(&crop),
            asset: Some(AssetFacts {
                kind: AssetKind::Video,
                display: Some((1920.0, 1080.0)),
            }),
            ..geometry(VisualKind::Video, &place)
        };
        let b = item_box(&video, CANVAS);
        assert_eq!((b.width, b.height), (960.0, 1080.0));
    }

    #[test]
    fn stickers_with_video_or_image_assets_use_the_media_box() {
        let place = Place::default();
        let props = StickerProps::new("asset");
        let sticker = ItemGeometry {
            sticker: Some(&props),
            asset: tall_video(),
            ..geometry(VisualKind::Sticker, &place)
        };
        let b = item_box(&sticker, CANVAS);
        assert_eq!(b.width, 384.0);
        assert!((b.height - 384.0 * 1920.0 / 1080.0).abs() < 1e-9);
        // Template stickers are static boxes: the template box's height is 0.62 times its width.
        let mut boxed = StickerProps::new("template");
        boxed.template_id = Some("box".into());
        let template = ItemGeometry {
            sticker: Some(&boxed),
            ..geometry(VisualKind::Sticker, &place)
        };
        let b = item_box(&template, CANVAS);
        assert_eq!(b.width, 384.0);
        assert!((b.height - 238.08).abs() < 1e-9);
        assert_eq!(place_from_box(&template, pose(b), CANVAS), PlaceChange::default());
        let moved = BoxPose {
            cx: 480.0,
            width: 192.0,
            height: 119.04,
            ..pose(b)
        };
        assert_eq!(
            place_from_box(&template, moved, CANVAS),
            change(Some(25.0), None, Some(10.0), None, None)
        );
    }

    #[test]
    fn fixed_height_kinds_store_height_in_scale_y() {
        let place = Place {
            w: Some(20.0),
            scale: Some(2.0),
            ..Place::default()
        };
        let mut props = ShapeProps::new("rect");
        props.h = Some(10.0);
        let shape = ItemGeometry {
            shape: Some(&props),
            ..geometry(VisualKind::Shape, &place)
        };
        let b = item_box(&shape, CANVAS);
        assert_eq!((b.cx, b.cy, b.width, b.height), (960.0, 540.0, 768.0, 216.0));
        let narrower = BoxPose { width: 384.0, ..pose(b) };
        assert_eq!(place_from_box(&shape, narrower, CANVAS), change(None, None, Some(10.0), None, None));
        let taller = BoxPose {
            width: 384.0,
            height: 432.0,
            ..pose(b)
        };
        assert_eq!(
            place_from_box(&shape, taller, CANVAS),
            change(None, None, Some(10.0), Some(2.0), None)
        );
    }

    #[test]
    fn square_text_widens_with_scale_y_compensating() {
        let place = Place {
            x: Some(50.0),
            y: Some(50.0),
            w: Some(20.0),
            ..Place::default()
        };
        let text = geometry(VisualKind::Text, &place);
        let b = item_box(&text, CANVAS);
        assert_eq!((b.width, b.height), (384.0, 384.0));
        let wider = BoxPose { width: 576.0, ..pose(b) };
        assert_eq!(
            place_from_box(&text, wider, CANVAS),
            change(None, None, Some(30.0), Some(0.667), None)
        );
    }

    #[test]
    fn kind_defaults_and_rotation_wrap() {
        let place = Place::default();
        let wave = geometry(VisualKind::Visualizer, &place);
        let b = item_box(&wave, CANVAS);
        assert_eq!((b.cx, b.cy, b.width, b.height), (960.0, 918.0, 1920.0, 216.0));
        let bar = item_box(&geometry(VisualKind::Progress, &place), CANVAS);
        assert_eq!((bar.cx, bar.cy, bar.width, bar.height), (960.0, 540.0, 1536.0, 54.0));
        assert_eq!(place_from_box(&wave, pose(b), CANVAS), PlaceChange::default());
        let turned = BoxPose {
            rotation: 370.0,
            ..pose(b)
        };
        assert_eq!(place_from_box(&wave, turned, CANVAS), change(None, None, None, None, Some(10.0)));
        assert_eq!(wrap_rotation(-180.0), 180.0);
        assert_eq!(wrap_rotation(f64::NAN), 0.0);
        // A placeholder box with image material is positioned like media: width defaults to 42%, height is 24% of the frame height.
        let holder = ItemGeometry {
            asset: Some(AssetFacts {
                kind: AssetKind::Image,
                display: Some((100.0, 100.0)),
            }),
            ..geometry(VisualKind::Placeholder, &place)
        };
        let b = item_box(&holder, CANVAS);
        assert!((b.width - 806.4).abs() < 1e-9 && (b.height - 259.2).abs() < 1e-9);
    }

    #[test]
    fn place_defaults_draw_the_kind_default_box() {
        let wave = place_defaults(VisualKind::Visualizer);
        assert_eq!((wave.x, wave.y, wave.w), (Some(50.0), Some(85.0), Some(100.0)));
        let bar = place_defaults(VisualKind::Progress);
        assert_eq!((bar.x, bar.y, bar.w), (Some(50.0), Some(50.0), Some(80.0)));
        for kind in [
            VisualKind::Video,
            VisualKind::Text,
            VisualKind::Placeholder,
            VisualKind::Confetti,
            VisualKind::Sticker,
        ] {
            let empty = Place::default();
            let filled = place_defaults(kind);
            assert_eq!(
                item_box(&geometry(kind, &empty), CANVAS),
                item_box(&geometry(kind, &filled), CANVAS),
                "{kind:?}"
            );
        }
    }
}

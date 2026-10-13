//! Stage boxes: the UI's instance placement, box resizing, and the position and size in the property panel all go through here. The algorithm is the same one the frame-plan layer uses (`render_graph::item_box`).
//!
//! The input reads only the fields that box-pushing needs; other fields (`span`, text, style…) are ignored, so it also works for draft layers before they are created. Pass only the asset that the instance references; for compositions pass the pre-rendered form: `{ kind, video?: { displayWidth, displayHeight, pixelAspectRatio } }`.

use editor_semantics::Rate;
use render_graph::item_box::{
    AssetFacts, BoxPose, ItemBox, ItemGeometry, PlaceChange, VisualKind, display_dims, item_box, place_defaults, place_from_box,
};
use serde::{Deserialize, Serialize};
use video_model::{AssetKind, Crop, Place, ShapeProps, StickerProps, VisualMode};

use crate::{EntryError, invalid_input};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ItemInput {
    #[serde(rename = "type")]
    kind: VisualKind,
    #[serde(default)]
    place: Place,
    #[serde(default)]
    mode: Option<VisualMode>,
    #[serde(default)]
    shape: Option<ShapeInput>,
    #[serde(default)]
    sticker: Option<StickerInput>,
    #[serde(default)]
    crop: Option<Crop>,
}

/// Only one field of a graphic or sticker takes part in the box: the graphic's `h` (frame height %), the sticker's `templateId` (the `box` height is 0.62 of its width).
#[derive(Deserialize)]
struct ShapeInput {
    #[serde(default)]
    h: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StickerInput {
    #[serde(default)]
    template_id: Option<String>,
}

/// Graphic and sticker properties for box-pushing: fill only the field that takes part in the box, leave the others empty.
struct Props {
    shape: Option<ShapeProps>,
    sticker: Option<StickerProps>,
}

impl Props {
    fn of(item: &ItemInput) -> Props {
        Props {
            shape: item.shape.as_ref().map(|input| ShapeProps {
                h: input.h,
                ..ShapeProps::new("")
            }),
            sticker: item.sticker.as_ref().map(|input| StickerProps {
                template_id: input.template_id.clone(),
                ..StickerProps::new("")
            }),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssetInput {
    kind: AssetKind,
    #[serde(default)]
    video: Option<VideoInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoInput {
    display_width: u32,
    display_height: u32,
    pixel_aspect_ratio: Rate,
}

#[derive(Clone, Copy, Deserialize)]
struct Canvas {
    width: f64,
    height: f64,
}

/// The UI box: center, unrotated width and height (canvas pixels), angle (degrees).
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Pose {
    cx: f64,
    cy: f64,
    w: f64,
    h: f64,
    rotation: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoxRequest {
    item: ItemInput,
    #[serde(default)]
    asset: Option<AssetInput>,
    canvas: Canvas,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaceRequest {
    item: ItemInput,
    #[serde(default)]
    asset: Option<AssetInput>,
    canvas: Canvas,
    pose: Pose,
}

#[derive(Deserialize)]
struct DefaultsRequest {
    #[serde(rename = "type")]
    kind: VisualKind,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BoxOutput {
    #[serde(flatten)]
    pose: Pose,
    flip_x: bool,
    flip_y: bool,
    /// Fill the canvas: the box ignores `place`'s position and size and can only rotate.
    fullscreen: bool,
}

fn geometry<'a>(item: &'a ItemInput, props: &'a Props, asset: Option<&AssetInput>) -> ItemGeometry<'a> {
    ItemGeometry {
        kind: item.kind,
        place: &item.place,
        mode: item.mode,
        shape: props.shape.as_ref(),
        sticker: props.sticker.as_ref(),
        crop: item.crop.as_ref(),
        asset: asset.map(|asset| AssetFacts {
            kind: asset.kind,
            display: asset
                .video
                .as_ref()
                .and_then(|v| display_dims(v.display_width, v.display_height, v.pixel_aspect_ratio)),
        }),
    }
}

fn output(b: ItemBox) -> BoxOutput {
    BoxOutput {
        pose: Pose {
            cx: b.cx,
            cy: b.cy,
            w: b.width,
            h: b.height,
            rotation: b.rotation,
        },
        flip_x: b.flip_x,
        flip_y: b.flip_y,
        fullscreen: b.fullscreen,
    }
}

/// `{ item, asset?, canvas }` → `{ cx, cy, w, h, rotation, flipX, flipY, fullscreen }`。
pub fn stage_box(input: &[u8]) -> Result<String, EntryError> {
    let request: BoxRequest = serde_json::from_slice(input).map_err(invalid_input)?;
    let b = item_box(
        &geometry(&request.item, &Props::of(&request.item), request.asset.as_ref()),
        (request.canvas.width, request.canvas.height),
    );
    Ok(serde_json::to_string(&output(b)).expect("frame always serializes"))
}

/// `{ item, asset?, canvas, pose }` → the `place` fields to write (`x` / `y` / `w` / `scaleY` / `rot`, only those that changed).
pub fn stage_place(input: &[u8]) -> Result<String, EntryError> {
    let request: PlaceRequest = serde_json::from_slice(input).map_err(invalid_input)?;
    let pose = BoxPose {
        cx: request.pose.cx,
        cy: request.pose.cy,
        width: request.pose.w,
        height: request.pose.h,
        rotation: request.pose.rotation,
    };
    let change: PlaceChange = place_from_box(
        &geometry(&request.item, &Props::of(&request.item), request.asset.as_ref()),
        pose,
        (request.canvas.width, request.canvas.height),
    );
    Ok(serde_json::to_string(&change).expect("field always serializes"))
}

/// `{ type }` → the default placement `{ x, y, w }` for this kind.
pub fn place_default(input: &[u8]) -> Result<String, EntryError> {
    let request: DefaultsRequest = serde_json::from_slice(input).map_err(invalid_input)?;
    Ok(serde_json::to_string(&place_defaults(request.kind)).expect("placement defaults always serialize"))
}

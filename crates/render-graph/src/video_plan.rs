//! Overview of picture intervals (architecture design §9.11, §9.13 finished export): which picture layers and transitions appear in a sequence range, and which assets and documents they need.
//!
//! The finished export calls [`plan_frame`](super::plan_frame) frame by frame, so the picture rules exist in one place only. Here, at startup, we only answer "what must be frozen for this range, and what must the preflight check": for each visual instance that appears in the range, take the layer from the first frame where it appears (including its effect stack and content), and include the other side of any transition. Each transition whose window intersects the range is listed once. The `transition` on a layer is removed (the other side is listed separately) and does not represent the picture on any frame.
//!
//! Output size and the picture's position within the output are also determined here ([`output_geometry`]).

use std::collections::{BTreeSet, HashMap};

use editor_semantics::{Rate, Ratio, frame_time, frames_at};
use serde::{Deserialize, Serialize};
use video_model::{Id, TimelineItem, TransitionKind, VersionRef};

use super::audio_plan::{PlanRange, resolve_range};
use super::{LayerContent, PlanCanvas, PlanError, VideoView, VisualLayer, checked_fps, plan_frame, transition_window};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoPlan {
    pub sequence_id: Id,
    pub range: PlanRange,
    pub fps: Rate,
    pub canvas: PlanCanvas,
    /// Picture layers that appear in the range, one per instance (the frame where it first appears), sorted by instance ID.
    pub layers: Vec<VisualLayer>,
    /// Transitions whose window intersects the range.
    pub transitions: Vec<PlannedTransition>,
    /// Asset versions the picture needs (video, images, pre-rendered substitutes and code packages, plus assets in Lottie sticker parameters), deduplicated and sorted.
    pub assets: Vec<VersionRef>,
    /// Documents and style documents read by caption instances in the range, deduplicated and sorted.
    pub documents: Vec<Id>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedTransition {
    pub id: Id,
    pub kind: String,
    /// Unrecognized kinds: the picture is hard-cut.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported: Option<String>,
}

/// Picture overview of sequence `sequence_id` within `range` (sequence time). The range rules are the same as [`plan_audio`](super::audio_plan::plan_audio).
pub fn plan_video(video: VideoView<'_>, sequence_id: &str, range: Option<(Ratio, Ratio)>) -> Result<VideoPlan, PlanError> {
    let sequence = video
        .sequences
        .get(sequence_id)
        .ok_or_else(|| PlanError::new("SEQUENCE_NOT_FOUND", format!("no sequence {sequence_id}")))?;
    let fps = checked_fps(sequence)?;
    let (start, end) = resolve_range(sequence, range)?;
    // Frames covered by the range `[f0, f1)`: from the frame where the start lies up to the last frame before the end.
    let f0 = frame_index(frames_at(start, fps).map(|f| f.floor()))?;
    let f1 = frame_index(frames_at(end, fps).map(|f| f.ceil()))?;
    let at = |frame: i64| -> Result<Ratio, PlanError> {
        let t = frame_time(frame as i128, fps).ok_or_else(|| PlanError::overflow("frame"))?;
        Ok(t.max(start))
    };

    let items: HashMap<&str, &TimelineItem> = sequence.items.iter().map(|item| (item.base().id.as_str(), item)).collect();
    let mut probes: BTreeSet<i64> = BTreeSet::new();
    let mut documents: BTreeSet<Id> = BTreeSet::new();
    for item in &sequence.items {
        let Some(span) = item.span() else { continue };
        if !item.base().enabled || span.end_frame() <= f0 || span.from_frame >= f1 {
            continue;
        }
        if let TimelineItem::Caption(caption) = item {
            documents.insert(caption.document_id.clone());
            documents.extend(caption.style_document_id.clone());
        }
        probes.insert(span.from_frame.max(f0));
    }
    let mut transitions = Vec::new();
    for tr in &sequence.transitions {
        let Some((_, _, from, to)) = transition_window(&items, tr) else {
            continue;
        };
        if to <= f0 || from >= f1 {
            continue;
        }
        probes.insert(from.max(f0));
        transitions.push(PlannedTransition {
            id: tr.id.clone(),
            kind: tr.kind.name().to_string(),
            unsupported: matches!(tr.kind, TransitionKind::Unsupported { .. }).then(|| "unknown-kind".to_string()),
        });
    }

    let mut layers: Vec<VisualLayer> = Vec::new();
    let mut canvas = None;
    for frame in probes {
        let plan = plan_frame(video, sequence_id, at(frame)?)?;
        for mut layer in plan.layers {
            let partner = layer.transition.take().and_then(|tr| tr.partner);
            for layer in std::iter::once(layer).chain(partner.map(|p| *p)) {
                if !layers.iter().any(|l| l.item_id == layer.item_id) {
                    layers.push(layer);
                }
            }
        }
        canvas.get_or_insert(plan.canvas);
    }
    let canvas = match canvas {
        Some(canvas) => canvas,
        None => plan_frame(video, sequence_id, start)?.canvas,
    };
    layers.sort_by(|a, b| a.item_id.cmp(&b.item_id));
    let assets: BTreeSet<(Id, String)> = layers
        .iter()
        .flat_map(|layer| layer.asset.clone().into_iter().chain(generator_asset(layer)))
        .map(|asset| (asset.id, asset.revision))
        .collect();
    Ok(VideoPlan {
        sequence_id: sequence.id.clone(),
        range: PlanRange::new(start, end)?,
        fps,
        canvas,
        layers,
        transitions,
        assets: assets.into_iter().map(|(id, revision)| VersionRef { id, revision }).collect(),
        documents: documents.into_iter().collect(),
    })
}

/// Assets referenced by generator layer parameters (the `asset` of a Lottie sticker). The layer itself carries no asset, but export must freeze it, since frame rasterization reads from bytes.
fn generator_asset(layer: &VisualLayer) -> Option<VersionRef> {
    match &layer.content {
        Some(LayerContent::Generator { parameters, .. }) => parameters.get("asset").cloned().and_then(|v| serde_json::from_value(v).ok()),
        _ => None,
    }
}

/// Output size of the finished export and the picture's position within it (pixels).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputGeometry {
    pub width: u32,
    pub height: u32,
    /// The picture (the part drawn onto the canvas). It fills the output when the sizes match; when the desired aspect ratio differs from the canvas, it is a centered piece with black bars around it.
    pub picture: PictureRect,
    /// Output width or height differs from the desired (or canvas) one: adjusted to even numbers.
    pub adjusted: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PictureRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Output size of the finished export (width and height both made even, as yuv420p requires; not less than 2).
///
/// - Neither given: canvas size. Only height given: width follows the canvas ratio. Only width given: height follows the canvas ratio. In these three cases the picture fills the output.
/// - Both given: the output is that size. The picture is the largest piece at the canvas ratio that fits (a dimension that cannot be filled is made even), centered, with black bars elsewhere (a wider canvas gives top and bottom bars, a narrower one gives left and right bars). Layout inside the picture follows the canvas and is not rescaled to the output's ratio.
pub fn output_geometry(canvas_width: u32, canvas_height: u32, width: Option<u32>, height: Option<u32>) -> OutputGeometry {
    let even = |v: f64| ((v / 2.0).round() * 2.0).max(2.0) as u32;
    let (cw, ch) = (f64::from(canvas_width.max(1)), f64::from(canvas_height.max(1)));
    let full = |width: u32, height: u32, adjusted: bool| OutputGeometry {
        width,
        height,
        picture: PictureRect { x: 0, y: 0, width, height },
        adjusted,
    };
    match (width, height) {
        (Some(w), Some(h)) => {
            let (out_w, out_h) = (even(f64::from(w)), even(f64::from(h)));
            let (fw, fh) = (f64::from(out_w), f64::from(out_h));
            // If the canvas is relatively wider: width fills and height follows the ratio; otherwise height fills and width follows the ratio. The dimension that follows the ratio does not exceed the output (the output is even, so rounding to even will not overshoot).
            let (pw, ph) = if cw * fh >= ch * fw {
                (out_w, even(ch * fw / cw).min(out_h))
            } else {
                (even(cw * fh / ch).min(out_w), out_h)
            };
            OutputGeometry {
                width: out_w,
                height: out_h,
                picture: PictureRect {
                    x: (out_w - pw) / 2,
                    y: (out_h - ph) / 2,
                    width: pw,
                    height: ph,
                },
                adjusted: out_w != w || out_h != h,
            }
        }
        (Some(w), None) => {
            let out_w = even(f64::from(w));
            let exact = ch * f64::from(out_w) / cw;
            let out_h = even(exact);
            full(out_w, out_h, out_w != w || f64::from(out_h) != exact)
        }
        (None, wanted) => {
            let wanted = wanted.unwrap_or(canvas_height);
            let out_h = even(f64::from(wanted));
            let exact = cw * f64::from(out_h) / ch;
            let out_w = even(exact);
            full(out_w, out_h, out_h != wanted || f64::from(out_w) != exact)
        }
    }
}

fn frame_index(frame: Option<i128>) -> Result<i64, PlanError> {
    frame
        .and_then(|f| i64::try_from(f).ok())
        .ok_or_else(|| PlanError::overflow("range"))
}

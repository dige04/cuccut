//! v3 picture instances are converted into elements of the rendering kernel (`subtitle-render`).
//!
//! Fields map one to one (the video format spec §3.4–§3.7 uses the v2 element model): time is the instance's range converted into seconds, and geometry, masks, tiling, element animation, text styles and each kind's props are carried over as is; keyframe bindings are converted to v2 `keyframes` by `bindings_to_timeline`.
//! Three things are not handed to the kernel: the source picture is injected by the caller (the [`SOURCE_PREFIX`] plus the instance ID), `fx` is applied to the source picture first by [`crate::effects`], and transitions are drawn on the finished layers by [`crate::transition`].

use subtitle_render::{TimelineVisualElement, vertical_align_from_str};
use timeline::schema::{Background, ElementKind, Fit, VisualMode};
use video_model::{AnimationBinding, TimelineItem};

/// ID prefix of the injected source picture: `layer:<instance ID>`.
pub const SOURCE_PREFIX: &str = "layer:";

/// The instance's source picture ID in the kernel.
pub fn source_id(item_id: &str) -> String {
    format!("{SOURCE_PREFIX}{item_id}")
}

/// Converts a picture instance into a kernel element; audio and captions have none. `bindings` are the keyframe bindings on the sequence that point to this instance; bindings that cannot be read are treated as absent (the engine validates them when writing).
pub fn visual_element<'a>(
    item: &TimelineItem,
    fps: f64,
    bindings: impl IntoIterator<Item = &'a AnimationBinding>,
) -> Option<TimelineVisualElement> {
    let span = item.span()?;
    let place = item.place()?;
    let kind = element_kind(item)?;
    let fps = if fps.is_finite() && fps > 0.0 { fps } else { 30.0 };
    let keyframes = video_model::bindings_to_timeline(bindings, fps)
        .ok()
        .filter(|k| *k != timeline::keyframes::Keyframes::default());
    let media = item.media();
    // Composition instances have no `mode`: when `place` sets no position or width, they fill the frame; otherwise they are placed as picture-in-picture (same as the frame plan).
    let (mode, fit) = match item {
        TimelineItem::Composition(_) => {
            let fullscreen = place.x.is_none() && place.y.is_none() && place.w.is_none();
            (if fullscreen { VisualMode::Fullscreen } else { VisualMode::Pip }, Fit::Contain)
        }
        // Stickers are placed at their own aspect ratio, without cropping.
        TimelineItem::Sticker(_) => (VisualMode::Pip, Fit::Contain),
        _ => (media.map_or(VisualMode::Pip, |m| m.mode()), media.map_or(Fit::Cover, |m| m.fit())),
    };
    let mut element = TimelineVisualElement {
        id: item.base().id.clone(),
        kind,
        start: span.from_frame as f64 / fps,
        end: span.end_frame() as f64 / fps,
        place: place.to_timeline(),
        vertical_align: None,
        src_id: None,
        src_start: 0.0,
        rate: 1.0,
        audio_fade_in: 0.0,
        audio_fade_out: 0.0,
        mode,
        fit,
        // A composition stand-in has no background: with full screen and contain, the letterbox margins and transparent pixels reveal the layer below (video format spec §3.7).
        bg: match item {
            TimelineItem::Composition(_) => None,
            _ => Some(media.map_or(Background::Black, |m| m.bg())),
        },
        text: None,
        counter: None,
        style: serde_json::json!({}),
        tile: None,
        mask: item.mask().map(video_model::Mask::to_timeline),
        fx: None,
        animation: item.animate().map(video_model::Animation::to_timeline),
        transitions: None,
        keyframes,
        shape: None,
        sticker: None,
        visualizer: None,
        progress: None,
        draw: None,
        placeholder: None,
        confetti: None,
        whiteboard: None,
    };
    match item {
        TimelineItem::Image(image) => element.tile = image.tile.as_ref().map(video_model::Tile::to_timeline),
        TimelineItem::Text(text) => {
            element.text = text.text.clone();
            element.counter = text.counter.clone();
            element.style = text.style.clone().unwrap_or_else(|| serde_json::json!({}));
            element.vertical_align = text.vertical_align.as_deref().and_then(vertical_align_from_str);
            element.tile = text.tile.as_ref().map(video_model::Tile::to_timeline);
        }
        TimelineItem::Shape(shape) => element.shape = Some(shape.shape.clone()),
        TimelineItem::Sticker(sticker) => element.sticker = Some(sticker.sticker.clone()),
        TimelineItem::Visualizer(v) => element.visualizer = Some(v.visualizer.clone()),
        TimelineItem::Progress(p) => element.progress = Some(p.progress.clone()),
        TimelineItem::Draw(d) => element.draw = Some(d.draw.clone()),
        TimelineItem::Placeholder(p) => element.placeholder = Some(p.placeholder.clone()),
        TimelineItem::Confetti(c) => element.confetti = Some(c.confetti.clone()),
        TimelineItem::Whiteboard(w) => element.whiteboard = Some(w.whiteboard.clone()),
        _ => {}
    }
    Some(element)
}

/// The kernel's element kinds. A composition instance is drawn as video (its picture is a pre-rendered stand-in).
fn element_kind(item: &TimelineItem) -> Option<ElementKind> {
    Some(match item {
        TimelineItem::Video(_) | TimelineItem::Composition(_) => ElementKind::Video,
        TimelineItem::Image(_) => ElementKind::Image,
        TimelineItem::Text(_) => ElementKind::Text,
        TimelineItem::Shape(_) => ElementKind::Shape,
        TimelineItem::Sticker(_) => ElementKind::Sticker,
        TimelineItem::Visualizer(_) => ElementKind::Visualizer,
        TimelineItem::Progress(_) => ElementKind::Progress,
        TimelineItem::Draw(_) => ElementKind::Draw,
        TimelineItem::Placeholder(_) => ElementKind::Placeholder,
        TimelineItem::Confetti(_) => ElementKind::Confetti,
        TimelineItem::Whiteboard(_) => ElementKind::Whiteboard,
        TimelineItem::Audio(_) | TimelineItem::Caption(_) => return None,
    })
}

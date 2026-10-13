//! Decoder-side delivery size: when a full-canvas video is larger than the canvas, let the decoder output directly the size the picture needs (architecture design §9.11 “picture”).
//!
//! The frame raster first draws the full-canvas video, per `fit`, into a partial picture the size of the canvas, then overlays pose and transitions. A 4K clip in a 1080p canvas would be resampled as a whole on the CPU for every frame. Here we compute the size the source takes in the canvas using the same `fit` formula, and pass it to [`media_core::decode::VideoDecoder`]: native decoding (AVFoundation / Media Foundation) scales in the decode chain, and the ffmpeg fallback scales with the `scale` filter. The frame raster receives a source already at its canvas size, and with `contain` and a matching aspect ratio it passes straight through as identity.
//!
//! Only scales down, never up. The bound edge is exactly the canvas edge, and the other edge is rounded proportionally to an even number (`cover` rounds up, not less than the canvas), so the frame raster's `fit` scale computes to exactly 1 and what remains is only an integer-offset copy. Instances with a crop (which takes effect before `fit`) or effects (effect lengths are computed against the canvas and act on source pixels, so the picture changes when the source resolution changes) are not scaled and still get the source size. An all-zero crop and an empty effects object are treated as absent.

use video_model::{Fit, TimelineItem, VisualMode};

/// Delivery size of the video instance in `canvas`; `None` when not scaled (use source size). `source` is the source size after orientation correction.
pub fn delivery_size(item: &TimelineItem, source: (u32, u32), canvas: (u32, u32)) -> Option<(u32, u32)> {
    let TimelineItem::Video(video) = item else {
        return None;
    };
    // Crop and effects are judged “present” the same way as in the frame raster: an all-zero crop and an empty effects object both count as absent.
    let cropped = video.crop.as_ref().is_some_and(|crop| crop.is_valid() && !crop.is_empty());
    let effects = video.media.fx.as_ref().is_some_and(|fx| !fx.is_empty());
    if video.media.mode() != VisualMode::Fullscreen || cropped || effects {
        return None;
    }
    fitted_size(video.media.fit(), source, canvas)
}

/// The size of the source after `fit` puts it into the canvas, given only when neither edge is enlarged; `None` when equal to the source.
pub fn fitted_size(fit: Fit, source: (u32, u32), canvas: (u32, u32)) -> Option<(u32, u32)> {
    let (sw, sh) = (f64::from(source.0), f64::from(source.1));
    let (cw, ch) = (f64::from(canvas.0), f64::from(canvas.1));
    if source.0 == 0 || source.1 == 0 || canvas.0 == 0 || canvas.1 == 0 {
        return None;
    }
    let (scale_w, scale_h) = (cw / sw, ch / sh);
    // Whether the width reaches its place first (in contain the width is the bound edge; in cover the height is) or the height does first.
    let width_binds = match fit {
        Fit::Contain => scale_w <= scale_h,
        Fit::Cover => scale_w >= scale_h,
    };
    let scale = if width_binds { scale_w } else { scale_h };
    if scale >= 1.0 {
        return None;
    }
    // The non-bound edge is rounded proportionally to an even number: contain rounds down (not exceeding the canvas), cover rounds up (not less than the canvas).
    let even = |value: f64| match fit {
        Fit::Contain => (value / 2.0).floor() as u32 * 2,
        Fit::Cover => (value / 2.0).ceil() as u32 * 2,
    };
    let size = if width_binds {
        (canvas.0, even(sh * scale).clamp(2, source.1))
    } else {
        (even(sw * scale).clamp(2, source.0), canvas.1)
    };
    (size != source).then_some(size)
}

#[cfg(test)]
mod tests {
    use super::*;

    const CANVAS: (u32, u32) = (1920, 1080);

    #[test]
    fn contain_downscales_to_the_canvas_when_the_aspect_matches() {
        assert_eq!(fitted_size(Fit::Contain, (3840, 2160), CANVAS), Some((1920, 1080)));
        assert_eq!(fitted_size(Fit::Cover, (3840, 2160), CANVAS), Some((1920, 1080)));
    }

    #[test]
    fn contain_binds_the_tighter_edge_and_rounds_the_other_down_to_even() {
        // Portrait 4K: height-bound, width 2160 × (1080 / 3840) = 607.5 → 606.
        assert_eq!(fitted_size(Fit::Contain, (2160, 3840), CANVAS), Some((606, 1080)));
        // Ultrawide: width-bound, height 1600 × 0.5 = 800.
        assert_eq!(fitted_size(Fit::Contain, (3840, 1600), CANVAS), Some((1920, 800)));
        // 4096×2160: width-bound, height 2160 × (1920 / 4096) = 1012.5 → 1012.
        assert_eq!(fitted_size(Fit::Contain, (4096, 2160), CANVAS), Some((1920, 1012)));
    }

    #[test]
    fn cover_binds_the_looser_edge_and_rounds_the_other_up_to_even() {
        // Portrait 4K cover: width-bound, height 3840 × (1920 / 2160) = 3413.3 → 3414.
        assert_eq!(fitted_size(Fit::Cover, (2160, 3840), CANVAS), Some((1920, 3414)));
        // Ultrawide cover: height-bound, width 3840 × (1080 / 1600) = 2592.
        assert_eq!(fitted_size(Fit::Cover, (3840, 1600), CANVAS), Some((2592, 1080)));
        // 4096×2160 cover: height-bound, width 4096 × 0.5 = 2048.
        assert_eq!(fitted_size(Fit::Cover, (4096, 2160), CANVAS), Some((2048, 1080)));
    }

    #[test]
    fn never_upscales_or_touches_sources_that_already_fit() {
        assert_eq!(fitted_size(Fit::Contain, (1920, 1080), CANVAS), None);
        assert_eq!(fitted_size(Fit::Contain, (1280, 720), CANVAS), None);
        assert_eq!(fitted_size(Fit::Cover, (1280, 720), CANVAS), None);
        // One edge larger than the canvas and the other not: contain scales down, while cover would have to scale up, so it is left alone.
        assert_eq!(fitted_size(Fit::Contain, (3840, 1000), CANVAS), Some((1920, 500)));
        assert_eq!(fitted_size(Fit::Cover, (3840, 1000), CANVAS), None);
        assert_eq!(fitted_size(Fit::Contain, (0, 0), CANVAS), None);
    }

    #[test]
    fn fitted_size_keeps_the_fit_scale_at_one() {
        // The frame raster recomputes the fit scale from the delivery size: the bound edge is exactly the canvas and the other edge does not exceed it, so the scale is exactly 1.
        for (fit, source) in [
            (Fit::Contain, (2160, 3840)),
            (Fit::Contain, (4096, 2160)),
            (Fit::Cover, (2160, 3840)),
            (Fit::Cover, (3840, 1600)),
        ] {
            let (w, h) = fitted_size(fit, source, CANVAS).unwrap();
            let (sw, sh) = (f64::from(w), f64::from(h));
            let (cw, ch) = (f64::from(CANVAS.0), f64::from(CANVAS.1));
            let scale = match fit {
                Fit::Contain => (cw / sw).min(ch / sh),
                Fit::Cover => (cw / sw).max(ch / sh),
            };
            assert_eq!(scale, 1.0, "{fit:?} {source:?} → {w}×{h}");
        }
    }

    fn video(json: serde_json::Value) -> TimelineItem {
        serde_json::from_value(json).unwrap()
    }

    fn item(extra: serde_json::Value) -> TimelineItem {
        let mut value = serde_json::json!({
            "id": "clip", "type": "video", "trackId": "t", "enabled": true, "locked": false, "paintOrder": 0,
            "assetRef": { "id": "a", "revision": "r" },
            "embeddedAudio": { "enabled": false, "volume": 1 },
            "mode": "fullscreen", "fit": "contain", "place": {},
            "span": { "fromFrame": 0, "durationFrames": 30 },
            "timeMap": { "kind": "linear", "rate": { "num": 1, "den": 1 }, "sourceIn": { "ticks": "0", "timescale": 1 } }
        });
        for (key, v) in extra.as_object().unwrap() {
            value[key] = v.clone();
        }
        video(value)
    }

    #[test]
    fn only_plain_fullscreen_videos_are_delivered_smaller() {
        let source = (3840, 2160);
        assert_eq!(delivery_size(&item(serde_json::json!({})), source, CANVAS), Some((1920, 1080)));
        assert_eq!(
            delivery_size(&item(serde_json::json!({ "fit": "cover" })), source, CANVAS),
            Some((1920, 1080))
        );
        assert_eq!(delivery_size(&item(serde_json::json!({ "mode": "pip" })), source, CANVAS), None);
        assert_eq!(
            delivery_size(
                &item(serde_json::json!({ "crop": { "left": 0.1, "top": 0.0, "right": 0.0, "bottom": 0.0 } })),
                source,
                CANVAS
            ),
            None
        );
        assert_eq!(
            delivery_size(&item(serde_json::json!({ "fx": { "blur": 4.0 } })), source, CANVAS),
            None
        );
        assert_eq!(delivery_size(&item(serde_json::json!({})), (1920, 1080), CANVAS), None);
        // An all-zero crop and an empty effects object equal “none” (consistent with the frame raster's `crop_of` / `Fx::is_empty`).
        let empty = serde_json::json!({ "crop": { "left": 0.0, "top": 0.0, "right": 0.0, "bottom": 0.0 }, "fx": {} });
        assert_eq!(delivery_size(&item(empty), source, CANVAS), Some((1920, 1080)));
    }
}

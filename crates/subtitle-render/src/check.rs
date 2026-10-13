//! Pure checks in the inspection report that depend on the timeline schema.
//!
//! Ported from `flows/check.rs` in CucCut v2 `ccut-engine`: `place_out_of_canvas` and its tests are brought over as-is, with only the private functions made `pub`. `check_verdict` / `run_check`, which read and write the project directory in the same file, are not ported. The `check` in `speech-doc` depends only on the transcript document and does not recognise the timeline schema, so this rule lives here.

/// `place` extends beyond the canvas (`element-rect-out-of-canvas`): one side of the box extends beyond the canvas, or its centre y is not within the canvas.
///
/// A video or image enlarged so that it extends beyond both left and right and covers the full width is not reported. That is a crop for “zoom in and drag the framing” (the box written by `ccut shorts cut --focus-x` is exactly this kind), which was wrongly reported as misplaced in the podcast-clip acceptance check.
pub fn place_out_of_canvas(
    kind: timeline::schema::ElementKind,
    place: &timeline::schema::Place,
) -> bool {
    use timeline::schema::ElementKind;
    let x = place.x.unwrap_or(50.0);
    let y = place.y.unwrap_or(50.0);
    let width = place.w.unwrap_or(0.0) * place.scale.unwrap_or(1.0).abs();
    let (left, right) = (x - width / 2.0, x + width / 2.0);
    let zoom_crop =
        matches!(kind, ElementKind::Video | ElementKind::Image) && left <= 0.0 && right >= 100.0;
    (!zoom_crop && (left < 0.0 || right > 100.0)) || !(0.0..=100.0).contains(&y)
}

#[cfg(test)]
mod place_tests {
    use super::place_out_of_canvas;
    use timeline::schema::{ElementKind, Place};

    fn place(x: f64, w: f64) -> Place {
        Place {
            x: Some(x),
            y: Some(50.0),
            w: Some(w),
            ..Place::default()
        }
    }

    /// Podcast-clip acceptance: the main video box from `shorts cut --focus-x 0.6` (x -32.26, w 316.37) extends beyond both left and right and covers the full canvas. It is a framing crop and is not reported. A box that extends beyond only one side is still reported.
    #[test]
    fn a_zoom_crop_that_covers_the_canvas_is_not_out_of_canvas() {
        assert!(!place_out_of_canvas(
            ElementKind::Video,
            &place(-32.26, 316.37)
        ));
        assert!(!place_out_of_canvas(
            ElementKind::Image,
            &place(50.0, 180.0)
        ));
        assert!(place_out_of_canvas(ElementKind::Video, &place(90.0, 40.0)));
        // A text box has no concept of “framing”, so if it extends beyond the canvas, it is reported.
        assert!(place_out_of_canvas(ElementKind::Text, &place(50.0, 180.0)));
        assert!(!place_out_of_canvas(ElementKind::Text, &place(50.0, 60.0)));
    }
}

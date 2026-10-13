//! Measure the box of a text element (`FrameRenderer::measure_text`): the measured width fits the drawn text, so a box laid out at that width does not wrap.

mod common;

use common::*;
use frame_render::Documents;
use serde_json::{Value, json};

/// A style like “Add text box”: white text, a backing plate hugging the text, centred. Font size is based on the 540 short side, so on this 160×90 canvas it is 20 px.
fn style() -> Value {
    json!({
        "fontSize": 120, "fontWeight": "bold", "fontColor": "#FFFFFF", "lineHeight": 1.2, "textAlign": "center",
        "backgroundColor": "#000000CC", "backgroundStyle": "wrap", "backgroundPadding": 14, "borderRadius": 12
    })
}

fn titled(text: &str, w: f64) -> Vec<u8> {
    let video = video(
        vec![item(
            "title",
            0,
            30,
            json!({ "type": "text", "text": text, "style": style(), "place": { "x": 50, "y": 50, "w": w } }),
        )],
        vec![],
        json!({}),
    );
    render(&video, 0.5, &mut Media::default())
}

#[test]
fn a_box_as_wide_as_measured_keeps_the_text_on_one_line() {
    for text in ["输入文字", "Hello world"] {
        let measured = renderer(false, Documents::default()).measure_text(text, &style(), None, (W, H));
        assert!(measured.width > 20.0 && measured.width < f64::from(W), "{text}：{measured:?}");
        let w = measured.width / f64::from(W) * 100.0;
        // The box width is the measured width: it draws the same as a much wider box (centred, one line).
        assert_eq!(titled(text, w), titled(text, 100.0), "{text} wrapped onto two lines at its measured box width");
        // Narrower, it wraps to two lines and draws taller. That shows the check above compares wrapping, not a coincidence.
        let (_, top, _, bottom) = painted_bounds(&titled(text, w * 0.55)).unwrap();
        let (_, one_top, _, one_bottom) = painted_bounds(&titled(text, w)).unwrap();
        assert!(bottom - top > one_bottom - one_top, "{text}: a narrow box should wrap");
    }
}

#[test]
fn a_given_wrap_width_is_the_box_width_and_extra_lines_add_height() {
    let mut renderer = renderer(false, Documents::default());
    let one = renderer.measure_text("输入文字", &style(), None, (W, H));
    let wrapped = renderer.measure_text("输入文字", &style(), Some(one.width * 0.55), (W, H));
    assert_eq!(wrapped.width, one.width * 0.55);
    assert!(wrapped.height > one.height * 1.5, "{one:?} → {wrapped:?}");
    // Font size follows the canvas short side: double the canvas, and the box roughly doubles too.
    let large = renderer.measure_text("输入文字", &style(), None, (W * 2, H * 2));
    assert!((large.width / one.width - 2.0).abs() < 0.1, "{one:?} → {large:?}");
}

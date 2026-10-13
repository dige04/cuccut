//! Measures the box of a text element. When text is created, the UI needs to know how wide the laid-out text will be. It uses the same typesetting engine and the same fonts that draw it (`subtitle-render`'s [`layout_text`]), so the measured box matches the drawn text.
//!
//! The rules are the same as for drawing a text element: the style is interpreted on the sequence canvas (font size is based on the 540 short side), text wraps at Unicode word boundaries, and the line height is taken from the laid-out lines.

use render_raster::TextEngine;
use serde::Serialize;
use serde_json::Value;
use subtitle_render::{LineKind, TimedItem, layout_lines_height, layout_text, resolve_line_style};

/// The box a text needs as a text element (in sequence pixels, including the backing padding).
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct TextBox {
    pub width: f64,
    pub height: f64,
}

/// Measures how large the box is for `text` laid out with `style` on `canvas`. If `wrap_width` is given, text wraps to it and the box width is that width. Otherwise it is laid out as one unwrapped block, the box width is the widest line plus left and right padding, and an extra quarter of the font size is added as margin. (Preview and export lay out at output size, so the result differs slightly from measuring at sequence canvas size because of rounding.)
pub fn measure_text_element(engine: &mut TextEngine, text: &str, style: &Value, wrap_width: Option<f64>, canvas: (u32, u32)) -> TextBox {
    let (canvas_width, canvas_height) = (canvas.0.max(1), canvas.1.max(1));
    let line = resolve_line_style(style, LineKind::Original, canvas_width, canvas_height, false);
    let item = TimedItem {
        id: String::new(),
        series_index: 0,
        text: text.to_string(),
        display_start: 0.0,
        display_end: 1.0,
        words: Vec::new(),
    };
    let wrap = wrap_width.filter(|w| w.is_finite()).map(|w| w.max(1.0));
    let (lines, width) = layout_text(engine, &item, &line, wrap.unwrap_or(f64::INFINITY), None);
    let height = (layout_lines_height(&lines) + line.background_pad_v * 2.0).ceil();
    match wrap {
        Some(wrap) => TextBox { width: wrap, height },
        None => TextBox {
            width: (width + line.background_pad_h * 2.0 + line.font_size * 0.25).ceil(),
            height,
        },
    }
}

//! ASS soft subtitle header: the main style name, the bilingual translation style name, and the fixed header for `--no-style`.
//!
//! Ported from CucCut v2 `ccut-kernel`'s `cmd/studio_export/ass_style.rs`. The `ass_style_sheet` that composes `[V4+ Styles]` from the project style, and its conversions (`ass_style_row`, `ass_number`, `ass_color`, `ass_font_*`, `line_block_height`), depend on the subtitle rendering kernel's `LineStyle` / `resolve_line_style`, which live in `subtitle-render`'s `ass_style` (this crate does not depend on rendering). `ass_play_res*`, which reads the frame dimensions, reads the project file and is not ported. The two `Format:` lines are shared by both sides, so they are `pub`.

/// The style name that Dialogue declares as its main style. Historically it has always been called `CucCut`; kept unchanged.
pub const ASS_PRIMARY_STYLE: &str = "CucCut";
/// The style name of the bilingual second line (the translation), switched to via the inline `{\r}`.
pub const ASS_TRANSLATION_STYLE: &str = "CucCutTrans";

/// The ASS header, plus the style name that the bilingual second line switches to.
#[derive(Debug, Clone)]
pub struct AssStyleSheet {
    pub header: String,
    /// When `Some`, `{\r<name>}` is inserted before the second line of a bilingual body.
    pub translation_style: Option<String>,
}

pub const ASS_STYLE_FORMAT: &str = "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding";
pub const ASS_EVENT_FORMAT: &str =
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text";

impl AssStyleSheet {
    /// The `--no-style` escape hatch: the fixed header from the VoiceInk era, byte-identical to 1.x output.
    pub fn legacy() -> Self {
        Self {
            header: format!(
                "[Script Info]\nTitle: CucCut\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n\
[V4+ Styles]\n{ASS_STYLE_FORMAT}\n\
Style: CucCut,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,30,30,40,1\n\n\
[Events]\n{ASS_EVENT_FORMAT}\n"
            ),
            translation_style: None,
        }
    }
}

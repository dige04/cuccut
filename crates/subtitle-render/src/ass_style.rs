//! Synthesizes the full ASS `[V4+ Styles]` header from the project's flat style blob.
//!
//! Same source as MP4 burn-in: font size, colour, outline, and background box all go through [`resolve_line_style`], so
//! the per-line partial overrides of `origStyle` / `transStyle` and the bilingual font-size ratio semantics apply automatically. This file is only responsible for
//! "translating [`LineStyle`] into ASS fields". It does not reimplement that here.
//!
//! ## Unit conversion
//!
//! - **Outline**: `textOutline.width` in the project is the visible outward extent as a percentage of font size.
//!   [`LineStyle::outline_width`] stores the full line width centred across the outline (`w/100·fontSize·0.5`),
//!   while ASS `Outline` is the border thickness that grows outward. So here we take half of it, which is equivalent to
//!   `w/400·fontSize`. The three figures are not the same thing: before changing any one of them, confirm which one you are talking about.
//!
//! ## Fields that cannot be mapped 1:1 (approximation rules)
//!
//! ASS's style model is weaker than CucCut's subtitle styles, so the semantics below can only be approximated or are dropped outright. Before changing this,
//! sync the same-named notes in `docs/design/cli/ccut-cli-server-reference.md`.
//!
//! - **Horizontal position `x`**: ASS only has a 3x3 numpad Alignment and no percentage anchor. `x` is only used to pick left,
//!   centre or right (`<33.3` left, `>66.7` right, otherwise centred), so exact percentages are lost.
//! - **`width` (wrap width)**: folded into symmetric `MarginL`/`MarginR`. When the anchor is not at the centre of the frame,
//!   this symmetric margin pair will be offset from the real placement.
//! - **Vertical position `y` + `verticalAlign`**: uniformly folded into "bottom-aligned + `MarginV`". The text block
//!   height is estimated as `fontSize × lineHeight` (plus `gap` for bilingual), with no real typesetting metrics, so
//!   it differs from burn-in by up to half a line. When `verticalAlign` is absent it is approximated as `center`. Real rendering in that case
//!   uses the seam rule, so the two are not equivalent.
//! - **Per-line `origStyle.x/y` / `verticalAlign` (lines taken out of the stack)**: ignored entirely. ASS's
//!   two Styles share one set of Alignment/Margin and cannot be placed independently.
//! - **`order` (translation on top)**: has no effect. The sidecar subtitle body has always been "source line first". This
//!   is the existing srt/vtt behaviour, and ASS keeps it.
//! - **`rotation`**: written to `Angle` with the sign inverted (ASS is counter-clockwise positive). Transition animations are not exported.
//! - **`textTransform`**: has no effect. The body text comes from the projection shared with the sidecar, and no case transform is applied.
//! - **`glow` / `dropShadow.blur`**: ASS has no blur radius field. Only the colour and offset are kept for glow / shadow
//!   (glow offset is 0, equivalent to shadow off). The blur is lost.
//! - **Background box vertical padding**: `BorderStyle=3` has only one `Outline` field serving as padding, so here we use
//!   the horizontal `background_pad_h`, and the vertical padding is lost.
//! - **`backgroundMode: "shared"` (shared background box)**: ASS gives each line its own box, so one box cannot be shared.
//!
//! v3: ported from CucCut v2 `ccut-kernel`'s `cmd/studio_export/ass_style.rs`. There it was pulled in via `include!` into
//! `studio_export`, sharing names with this crate's flat namespace. The two style names, [`AssStyleSheet`],
//! the fixed header for `--no-style`, and the two `Format:` lines already live in `speech-doc` (subtitle export uses them), so they are taken from there
//! and not defined a second time. `ass_play_res` / `ass_play_res_from_manifest`, which read the project file, are not ported; the frame size is
//! passed in by the caller.

use serde_json::Value;
use speech_doc::export::ass_style::{ASS_EVENT_FORMAT, ASS_STYLE_FORMAT};
pub use speech_doc::export::{ASS_PRIMARY_STYLE, ASS_TRANSLATION_STYLE, AssStyleSheet};

use crate::{
    LineKind, LineStyle, REFERENCE_SHORT_EDGE, StudioMode, SubtitleColor, VerticalAlign, clamp,
    finite, parse_vertical_align, resolve_line_style,
};

/// ASS numeric fields: integers have no decimal point, others keep one decimal place, to avoid values like `2.0000000001` appearing in the header.
fn ass_number(value: f64) -> String {
    let value = if value.is_finite() { value } else { 0.0 };
    let rounded = (value * 10.0).round() / 10.0;
    if (rounded - rounded.round()).abs() < f64::EPSILON {
        format!("{}", rounded.round() as i64)
    } else {
        format!("{rounded:.1}")
    }
}

/// `&HAABBGGRR`. [`SubtitleColor::a`] already stores the ASS-semantic "transparency"
/// (`0` opaque, `255` fully transparent), so it is written directly here without inversion.
fn ass_color(color: SubtitleColor) -> String {
    format!(
        "&H{:02X}{:02X}{:02X}{:02X}",
        color.a, color.b, color.g, color.r
    )
}

/// A comma in a style name would split the `Style:` line. This also blocks newlines and the ASS override-tag delimiters.
fn ass_font_field(name: &str) -> String {
    name.replace(',', " ")
        .replace(['\r', '\n', '{', '}'], "")
        .trim()
        .to_owned()
}

/// Sidecar font names are shown to external players, so the SwiftPM-internal family mapping that [`font_name`] applies for MP4 shaping
/// is mapped back to the user-visible product name. Other aliases (system / montserrat …)
/// share the same table as burn-in and are not rewritten here.
fn ass_font_name(shaped: &str) -> String {
    let product = match shaped {
        "VK Sans" => "Source Sans 3",
        "VK Code" => "Source Code Pro",
        other => other,
    };
    ass_font_field(product)
}

/// Estimated height of a single-line text block: `fontSize × lineHeight`. No real typesetting metrics are used.
fn line_block_height(style: &LineStyle) -> f64 {
    style.font_size * style.line_height
}

/// One `Style:` line.
#[allow(clippy::too_many_arguments)]
fn ass_style_row(
    name: &str,
    style: &LineStyle,
    alignment: u8,
    margin_l: i64,
    margin_r: i64,
    margin_v: i64,
    angle: f64,
) -> String {
    // With a background box → BorderStyle=3 (opaque box): OutlineColour is then the box colour,
    // and the Outline field is the box padding. Without one → BorderStyle=1 (outline + shadow).
    let border_style = if style.background_on { 3 } else { 1 };
    let outline_colour = if style.background_on {
        style.background_color
    } else {
        style.outline_color
    };
    let outline = if style.background_on {
        style.background_pad_h
    } else if style.outline_on {
        // libass / VSFilter's `Outline` is the border thickness that grows **outward**, whereas
        // [`LineStyle::outline_width`] stores the full line width centred across the outline, so the outward extent is only half.
        // Writing it directly would make the player draw an outline twice as thick (= the persisted `textOutline.width`'s
        // `w/100·fontSize`, instead of the correct `w/400·fontSize`).
        style.outline_width / 2.0
    } else {
        0.0
    };
    let shadow = if style.effect_on {
        style.effect_x.hypot(style.effect_y)
    } else {
        0.0
    };
    let back_colour = if style.effect_on {
        style.effect_color
    } else {
        SubtitleColor {
            r: 0,
            g: 0,
            b: 0,
            a: 255,
        }
    };
    let flag = |on: bool| if on { -1 } else { 0 };
    format!(
        "Style: {name},{font},{size},{primary},{secondary},{outline_colour},{back_colour},\
{bold},{italic},{underline},0,100,100,{spacing},{angle},{border_style},{outline},{shadow},\
{alignment},{margin_l},{margin_r},{margin_v},1",
        font = ass_font_name(&style.font_name),
        size = ass_number(style.font_size.max(1.0).round()),
        primary = ass_color(style.color),
        // Karaoke not-yet-sung colour: the sidecar does no word-by-word highlighting, so it matches the main colour.
        secondary = ass_color(style.color),
        outline_colour = ass_color(outline_colour),
        back_colour = ass_color(back_colour),
        bold = flag(style.bold),
        italic = flag(style.italic),
        underline = flag(style.underline),
        spacing = ass_number(style.letter_spacing),
        angle = ass_number(angle),
        outline = ass_number(outline),
        shadow = ass_number(shadow),
    )
}

/// Synthesizes the full ASS header from the flat style blob.
///
/// `mode` is `orig` / `trans` / `bi` (same as `StudioMode::parse`). When unrecognized it falls back to
/// `orig`. The sidecar's content mode is decided by `--mode`, and must not switch to a different set of font sizes just because the style blob stores some other mode string.
pub fn ass_style_sheet(style_root: &Value, mode: &str, play_res: (u32, u32)) -> AssStyleSheet {
    let (width, height) = play_res;
    let mode = StudioMode::parse(mode).unwrap_or(StudioMode::Original);
    let bilingual = mode == StudioMode::Bilingual;
    let original = resolve_line_style(style_root, LineKind::Original, width, height, bilingual);
    let translation =
        resolve_line_style(style_root, LineKind::Translation, width, height, bilingual);
    // The main style declared by Dialogue: a monolingual translation export has only translation lines, so the main style should be the translation style.
    let primary = match mode {
        StudioMode::Translated => &translation,
        StudioMode::Original | StudioMode::Bilingual => &original,
    };

    let canvas_scale = (f64::from(width.min(height)) / REFERENCE_SHORT_EDGE)
        * finite(style_root.get("scale"), 1.0).max(0.05);
    let gap = finite(style_root.get("gap"), 6.0).max(0.0) * canvas_scale;
    let block_height = if bilingual {
        line_block_height(&original) + gap + line_block_height(&translation)
    } else {
        line_block_height(primary)
    };
    // Anchor line: `y` is the frame percentage of the text block's anchor point. It is converted to "the distance from the bottom edge of the block to the bottom edge of the frame",
    // so whether the subtitle is at the top or bottom, it can be expressed with bottom alignment + MarginV.
    let anchor = f64::from(height) * finite(style_root.get("y"), 86.0) / 100.0;
    let block_bottom = match parse_vertical_align(style_root.get("verticalAlign")) {
        Some(VerticalAlign::Top) => anchor + block_height,
        Some(VerticalAlign::Bottom) => anchor,
        Some(VerticalAlign::Center) | None => anchor + block_height / 2.0,
    };
    let margin_v = clamp(f64::from(height) - block_bottom, 0.0, f64::from(height)).round() as i64;
    let x = finite(style_root.get("x"), 50.0);
    // The three bottom-alignment cells: 1 left / 2 centre / 3 right.
    let alignment = if x < 33.3 {
        1
    } else if x > 66.7 {
        3
    } else {
        2
    };
    let side = (f64::from(width)
        * (100.0 - clamp(finite(style_root.get("width"), 80.0), 5.0, 100.0))
        / 200.0)
        .round()
        .max(0.0) as i64;
    // Screen coordinates are clockwise-positive; ASS `Angle` is counter-clockwise-positive.
    let angle = -finite(style_root.get("rotation"), 0.0);

    let mut styles = vec![ass_style_row(
        ASS_PRIMARY_STYLE,
        primary,
        alignment,
        side,
        side,
        margin_v,
        angle,
    )];
    if bilingual {
        styles.push(ass_style_row(
            ASS_TRANSLATION_STYLE,
            &translation,
            alignment,
            side,
            side,
            margin_v,
            angle,
        ));
    }
    let header = format!(
        "[Script Info]\nTitle: CucCut\nScriptType: v4.00+\nWrapStyle: 0\n\
ScaledBorderAndShadow: yes\nPlayResX: {width}\nPlayResY: {height}\n\n\
[V4+ Styles]\n{ASS_STYLE_FORMAT}\n{styles}\n\n[Events]\n{ASS_EVENT_FORMAT}\n",
        styles = styles.join("\n"),
    );
    AssStyleSheet {
        header,
        translation_style: bilingual.then(|| ASS_TRANSLATION_STYLE.to_owned()),
    }
}

// v3: the two tests are taken verbatim from v2 `ccut-kernel`'s `cmd/studio_export/tests.rs` (outline convention) and
// `cmd/media/tests.rs` (bilingual missing translation). The fixture helpers (`document`, `word_doc`) are JSON / line literals,
// and each is kept in place, as v2 did.
#[cfg(test)]
mod tests {
    use super::*;

    use serde_json::json;
    use speech_doc::asr_rows::RowIn;
    use speech_doc::build::build_doc;
    use speech_doc::cue::{CueParams, derive_cues};
    use speech_doc::doc::{DocEngine, DocMedia, TranscriptDoc};
    use speech_doc::export::{
        ExportMode, SubtitleFlavor, SubtitleRenderOptions, build_subtitle_events,
        render_subtitle_events,
    };
    use speech_doc::sentence::derive_sentences;
    use speech_doc::split::derive_trans_cues;

    fn document(animation: &str, transition: &str) -> Value {
        json!({
            "meta": {"duration": 3.0},
            "style": {
                "mode": "orig", "fontFamily": "montserrat", "fontSize": 30,
                "fontColor": "#FFFFFF", "bold": true, "outline": true,
                "background": true, "backgroundColor": "#000000B3",
                "backgroundPadding": 10, "lineHeight": 1.2,
                "x": 50, "y": 86, "width": 80, "scale": 1, "rotation": 0,
                "wordAnimation": {"animationName": animation},
                "transition": {"transitionId": transition, "transitionSpeed": 50},
                "displayTiming": {"leadIn": 0.5, "tail": 1.0}
            },
            "cues": [{
                "id": "q1", "start": 0.5, "end": 2.5, "text": "Hello world",
                "words": [
                    {"text": "Hello", "t0": 0.5, "t1": 1.2},
                    {"text": "world", "t0": 1.3, "t1": 2.5}
                ]
            }],
            "sentences": [], "transCues": []
        })
    }

    fn word_doc() -> TranscriptDoc {
        let mut row_a = RowIn::new(1.23, 5.0, "hello there");
        row_a.speaker = Some("S01".to_owned());
        let mut row_b = RowIn::new(6.0, 65.5, "goodbye now");
        row_b.speaker = Some("S02".to_owned());
        build_doc(
            &[row_a, row_b],
            DocMedia {
                id: None,
                path: Some("sample.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 65.5,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: false,
            },
            None,
        )
    }

    /// Closed-loop convention for the outline width. The persisted `textOutline.width` is the "visible outward extent" as a percentage of font size (Mac `StagePaneView`'s `.strokeWidth = -width * 0.5`), so:
    ///
    /// - [`LineStyle::outline_width`] (the full line width of a tiny-skia centred stroke) = `w/200 × fontSize`
    /// - ASS `Outline` (outward-growing thickness) = half of that = `w/400 × fontSize`
    ///
    /// Both places used to miss a factor of 0.5 once, so burn-in and the sidecar outline came out twice as thick as the preview.
    #[test]
    fn outline_width_is_the_centred_line_width_and_ass_takes_half_of_it() {
        let mut style = document("None", "none")["style"].clone();
        style["textOutline"] = json!({"color": "#000000", "width": 15, "on": true});
        // With the background box on, ASS uses BorderStyle=3, and the `Outline` field becomes the box padding.
        style["background"] = json!(false);

        // 1080p ⇒ canvas_scale = 1080/540 = 2；fontSize 30 ⇒ 60px。
        let line = resolve_line_style(&style, LineKind::Original, 1920, 1080, false);
        assert!((line.font_size - 60.0).abs() < 1e-9);
        assert!(line.outline_on);
        assert!(
            (line.outline_width - 4.5).abs() < 1e-9,
            "15/200 × 60 = 4.5, got {}",
            line.outline_width
        );

        let header = ass_style_sheet(&style, "orig", (1920, 1080)).header;
        let row = header
            .lines()
            .find(|line| line.starts_with("Style: CucCut,"))
            .expect("the main style line must exist");
        // The 17th field of Format (0-based, index 16) is Outline.
        let outline = row
            .trim_start_matches("Style: ")
            .split(',')
            .nth(16)
            .expect("Outline field");
        assert_eq!(
            outline, "2.3",
            "15/400 × 60 = 2.25, the header keeps one decimal place; row={row}"
        );
    }

    /// ASS bilingual is "one Dialogue, two lines". When the translation is missing, that event keeps only the source line:
    /// the body has no `\N`, so there should be no `{\r...}` tag that switches to the translation style.
    #[test]
    fn ass_bilingual_missing_translation_stays_a_single_primary_line() {
        let mut doc = word_doc();
        let cues = derive_cues(&doc, &CueParams::default());
        let sentences = derive_sentences(&doc, &cues);
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert(sentences[0].id.clone(), "你好".to_owned());
        let stream = derive_trans_cues(&doc, &sentences, "zh");
        let mut missing = 0;
        let events = build_subtitle_events(
            &doc,
            &cues,
            &sentences,
            &stream,
            ExportMode::Bilingual,
            Some("zh"),
            true,
            &mut missing,
        );
        let ass = ass_style_sheet(&json!({}), "bi", (1920, 1080));
        let translation_style = ass.translation_style.clone();
        assert!(translation_style.is_some(), "the bilingual header must carry a translation style");
        let rendered = render_subtitle_events(
            &doc,
            &events,
            SubtitleFlavor::Ass,
            &SubtitleRenderOptions {
                speakers: true,
                ass,
                ..SubtitleRenderOptions::default()
            },
        );
        assert_eq!(missing, 1);
        let dialogues: Vec<&str> = rendered
            .lines()
            .filter(|line| line.starts_with("Dialogue:"))
            .collect();
        assert_eq!(dialogues.len(), 2, "{rendered}");
        assert!(dialogues[0].contains("hello there\\N"), "{rendered}");
        // The missing-translation case: a single source line, with no line break and no switch to the translation style.
        let missing_line = dialogues[1];
        assert!(missing_line.contains("goodbye now"), "{rendered}");
        assert!(!missing_line.contains("\\N"), "{rendered}");
        if let Some(style) = translation_style.as_deref() {
            assert!(!missing_line.contains(style), "{rendered}");
        }
    }
}

// Unit tests for the overlay kernel, moved along with the kernel from `core/crates/ccut-kernel/src/cmd/studio_export/tests.rs` (master plan D2).
//
// The axis of the split is **whether an `OverlayHost` is needed**, not whether the test belongs to subtitles.
// `OverlayRenderPlan::compile*` only consumes an in-memory Studio body. It is a pure function, so its tests stay here. `compile_project*` and `load_overlay_document` need `studio_timeline_projection` as their very first step (timeline projection, word clock and HistoryStore rev). That is an injected item whose real implementation lives in the CLI, so those tests stay in `cargo test -p ccut`, together with `motion_baseline_tests`. Creating a fake host inside this crate for them would turn into exactly the second implementation this crate explicitly forbids.
//
// A few fixture helpers (document, style_document and so on) are needed on both sides, so each side keeps its own copy. They are JSON literals, not a second implementation.
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use sha2::{Digest, Sha256};

    /// The sha2 0.11 digest (hybrid-array) has no `LowerHex`, so write it out byte by byte. The value is the same as v2's `{:x}`.
    fn lower_hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    /// Synthetic tokens: CJK characters and full-width punctuation are one font size wide; everything else is 0.55 font size. No font is used; only the breaking algorithm is tested.
    fn synthetic_tokens(text: &str, font_size: f64) -> Vec<(String, LayoutToken)> {
        text.split_word_bounds()
            .map(|piece| {
                let width = piece
                    .chars()
                    .map(|c| {
                        if is_cjk_char(c) {
                            font_size
                        } else {
                            0.55 * font_size
                        }
                    })
                    .sum::<f64>();
                let chunk = GlyphChunk {
                    text: piece.to_owned(),
                    word: None,
                    part: None,
                    width,
                    font_name: String::new(),
                    font_size,
                    font_weight: 400,
                    italic: false,
                    shaped: Default::default(),
                    color: None,
                    metric_scale: 1.0,
                };
                let token = if piece == "\n" {
                    LayoutToken::HardBreak
                } else if piece.trim().is_empty() {
                    LayoutToken::Space(chunk)
                } else {
                    LayoutToken::Glyph(piece.to_owned(), chunk)
                };
                (piece.to_owned(), token)
            })
            .collect()
    }

    fn broken_lines(text: &str, chars_per_line: f64) -> Vec<String> {
        let tokens = synthetic_tokens(text, 10.0);
        let (texts, tokens): (Vec<_>, Vec<_>) = tokens.into_iter().unzip();
        let breaks = cjk_line_breaks(&tokens, chars_per_line * 10.0, 10.0);
        let mut lines = vec![String::new()];
        for (index, piece) in texts.iter().enumerate() {
            if breaks.contains(&index) {
                lines.push(String::new());
            }
            lines.last_mut().unwrap().push_str(piece);
        }
        lines
            .into_iter()
            .map(|line| line.trim().to_owned())
            .collect()
    }

    fn greedy_line_count(text: &str, chars_per_line: f64) -> usize {
        let mut count = 1;
        let mut used = 0.0;
        let mut pending = 0.0;
        for (_, token) in synthetic_tokens(text, 10.0) {
            match token {
                LayoutToken::Space(chunk) => {
                    if used > 0.0 {
                        pending += chunk.width;
                    }
                }
                LayoutToken::Glyph(_, chunk) => {
                    if used > 0.0 && used + pending + chunk.width > chars_per_line * 10.0 {
                        count += 1;
                        used = 0.0;
                    } else {
                        used += pending;
                    }
                    pending = 0.0;
                    used += chunk.width;
                }
                LayoutToken::HardBreak => unreachable!(),
            }
        }
        count
    }

    #[test]
    fn cjk_breaks_keep_kinsoku_units_and_balance_without_extra_lines() {
        // Sentences that were broken wrongly in the real measurements of a three-episode podcast: 利/益, 10/亿, 1870/年代, a line starting with “：？”, and a lone character stranded on the last line.
        let sentences = [
            "这就是问题所在：我们到底应该如何去衡量利益？还是说根本就无法衡量",
            "1870年代的铁路泡沫破裂之后，大家又花了10亿美元去建设新的网络",
            "ChatGPT 发布之后 所有人都在问：这个东西到底能不能真正赚钱？",
            "他说：「我们必须先解决自己的问题」，然后才能谈合作、谈发布、谈超越。",
            "用 GPT-4 做的实验 比原来快了200倍 便宜了400倍",
        ];
        // The punctuation prohibition rules can always be satisfied by moving one character, so they must hold in every case. Keeping a number with its unit, not splitting Latin runs and not leaving a lone character are soft constraints. When the line count is capped tightly (exactly three full lines), conceding is allowed. The requirement is only that across the whole sweep, the majority hold.
        let (mut soft, mut cases) = (0, 0);
        for text in sentences {
            for tenths in 60..=200 {
                let per_line = f64::from(tenths) / 10.0;
                let lines = broken_lines(text, per_line);
                let context = format!("{per_line}: {lines:?}");
                assert_eq!(lines.concat().replace(' ', ""), text.replace(' ', ""));
                assert!(
                    lines.len() <= greedy_line_count(text, per_line),
                    "{context}"
                );
                cases += 1;
                let mut bent = false;
                for (index, line) in lines.iter().enumerate() {
                    bent |= lines.len() > 1 && line.chars().count() == 1;
                    if index == 0 {
                        continue;
                    }
                    let first = line.chars().next().unwrap();
                    let prev = lines[index - 1].chars().next_back().unwrap();
                    assert!(!cannot_start_line(first), "{context}");
                    assert!(!cannot_end_line(prev), "{context}");
                    bent |= prev.is_ascii_digit() && is_han(first);
                    bent |= prev.is_ascii_alphanumeric() && first.is_ascii_alphanumeric();
                }
                soft += usize::from(bent);
            }
        }
        assert!(
            soft * 20 <= cases,
            "{soft} of {cases} layouts bent a soft rule"
        );
        // With two lines, break at a pause rather than filling the first line: the space left by a hidden comma, and the spot after a question mark.
        assert_eq!(
            broken_lines("ChatGPT 发布之后 所有人都在问这件事", 12.0),
            ["ChatGPT 发布之后", "所有人都在问这件事"]
        );
        assert_eq!(
            broken_lines("我们到底应该如何衡量？还是说根本无法衡量", 12.0),
            ["我们到底应该如何衡量？", "还是说根本无法衡量"]
        );
        // In the translation, a space between a number and its unit ("10 亿") is not a pause, so it must still not be split. It was split into "10 / 亿" in the podcast re-check. This is also a soft constraint: concede only when not splitting would need one more line.
        let text = "用户始终不到 10 亿 差不多就是这样？";
        let split = |lines: &[String]| {
            lines
                .windows(2)
                .any(|pair| pair[0].ends_with("10") && pair[1].starts_with('亿'))
        };
        assert_eq!(
            broken_lines(text, 11.0),
            ["用户始终不到 10 亿", "差不多就是这样？"]
        );
        let bent = (60..=200)
            .filter(|tenths| split(&broken_lines(text, f64::from(*tenths) / 10.0)))
            .count();
        assert!(bent * 20 <= 141, "{bent} of 141 widths split 10 / 亿");
    }

    #[test]
    fn text_without_cjk_is_not_rebalanced() {
        assert!(
            !"towards models that can really help"
                .chars()
                .any(is_cjk_char)
        );
        assert!(!"한국어 자막".chars().any(is_cjk_char));
    }

    /// A comparable projection of a node: only the type and key geometry are considered, so `Arc` addresses are not written into assertions.
    fn scene_node_shapes(nodes: &[element_draw::SceneNode]) -> Vec<String> {
        nodes
            .iter()
            .map(|node| match node {
                element_draw::SceneNode::Texture(texture) => format!(
                    "texture:{}:{}:{:?}",
                    texture.texture, texture.media_ms, texture.rect
                ),
                other => format!("{other:?}"),
            })
            .collect()
    }

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

    /// The minimal provable form of "preview = export" (master plan M1-R3).
    ///
    /// The App v2 path uploads premultiplied RGBA directly through [`OverlayRenderPlan::render_rgba_frame`], and serve sends a PNG through [`OverlayRenderPlan::render_png`]. The two paths must be two encodings of the same frame: the pixels decoded from the PNG must be byte-identical to the RGBA buffer, and the three identities (the subtitle content key, the DrawOp fingerprint and the next-change moment) must also agree.
    ///
    /// This deliberately uses `compile`, which takes the in-memory body without touching the project projection, so the assertions depend on no host injection. It is a pure kernel cross-check.
    #[test]
    fn render_png_is_the_encoded_form_of_render_rgba_frame() {
        let document = document("Karaoke", "fade");
        let mut plan = OverlayRenderPlan::compile(&document, 320, 180, 3.0, 30.0, None).unwrap();

        // Three moments are taken within the word animation: before entry, while the first word is highlighted, and while the second word is highlighted.
        for time in [0.4, 0.9, 1.8] {
            let rgba = plan.render_rgba_frame(time).unwrap();
            let png = plan.render_png(time).unwrap();

            assert_eq!(rgba.width, 320);
            assert_eq!(rgba.height, 180);
            assert_eq!(
                rgba.rgba.len(),
                320 * 180 * 4,
                "t={time}: RGBA buffer length must be width * height * 4"
            );

            let decoded = Pixmap::decode_png(&png.png).unwrap();
            assert_eq!(decoded.width(), rgba.width, "t={time}");
            assert_eq!(decoded.height(), rgba.height, "t={time}");
            assert_eq!(
                decoded.data(),
                rgba.rgba.as_slice(),
                "t={time}: PNG-decoded pixels differ from render_rgba_frame, \
                 so the two entry points did not take the same render path"
            );

            assert_eq!(png.subtitle_key, rgba.subtitle_key, "t={time}: subtitle content key");
            assert_eq!(
                png.draw_op_fingerprint, rgba.draw_op_fingerprint,
                "t={time}: DrawOp fingerprint"
            );
            assert_eq!(
                png.next_change, rgba.next_change,
                "t={time}: next change time"
            );
        }
    }

    #[test]
    fn mac_style_picker_fonts_are_loaded_by_video_burn_in() {
        let mut plan =
            OverlayRenderPlan::compile(&document("None", "none"), 320, 180, 3.0, 30.0, None)
                .unwrap();
        for family in [
            "Alata",
            "Archivo Black",
            "Bangers",
            "Carter One",
            "Dancing Script",
            "Fredoka One",
            "Paytone One",
            "Permanent Marker",
            "Press Start 2P",
            "VK Sans",
            "VK Code",
        ] {
            assert!(
                plan.text.has_family(family),
                "built-in Mac font {family:?} must not fall back in MP4 export"
            );
        }
        let archivo = plan.text.shape("CucCut", "Archivo Black", 36.0, 400);
        let fallback = plan.text.shape("CucCut", "Noto Sans SC", 36.0, 400);
        assert_ne!(
            archivo.glyphs.first().map(|glyph| glyph.cache_key.font_id),
            fallback.glyphs.first().map(|glyph| glyph.cache_key.font_id),
            "Archivo Black should use its own glyphs, not the Noto fallback"
        );
        assert_eq!(
            font_name(&json!({"fontFamily": "Source Sans 3"})),
            "VK Sans"
        );
        assert_eq!(
            font_name(&json!({"fontFamily": "Source Code Pro"})),
            "VK Code"
        );
    }

    #[test]
    fn latin_display_families_fall_back_to_weighted_noto_for_cjk_glyphs() {
        let mut plan =
            OverlayRenderPlan::compile(&document("None", "none"), 320, 180, 3.0, 30.0, None)
                .unwrap();
        let display = plan.text.shape("中文", "Anton", 36.0, 800);
        let noto = plan.text.shape("中文", "Noto Sans SC", 36.0, 800);
        let regular = plan.text.shape("中文", "Anton", 36.0, 400);
        let mixed = plan.text.shape("A中", "Anton", 36.0, 800);
        let latin = plan.text.shape("A", "Anton", 36.0, 800);
        assert!(!display.glyphs.is_empty());
        assert_eq!(display.glyphs.len(), noto.glyphs.len());
        for (fallback, direct) in display.glyphs.iter().zip(&noto.glyphs) {
            assert_eq!(fallback.cache_key.font_id, direct.cache_key.font_id);
            assert_eq!(fallback.cache_key.font_weight.0, 800);
        }
        assert!(
            regular
                .glyphs
                .iter()
                .all(|glyph| glyph.cache_key.font_weight.0 == 400)
        );
        assert_eq!(mixed.glyphs.len(), 2);
        assert_eq!(
            mixed.glyphs[0].cache_key.font_id,
            latin.glyphs[0].cache_key.font_id
        );
        assert_eq!(
            mixed.glyphs[1].cache_key.font_id,
            noto.glyphs[0].cache_key.font_id
        );
    }

    #[test]
    fn injected_font_compile_is_strict_and_does_not_load_the_bundled_catalog() {
        let fonts = vec![include_bytes!("../../render-raster/assets/fonts/NotoSansSC-Variable.ttf").to_vec()];
        let plan = OverlayRenderPlan::compile_with_injected_fonts(
            &document("None", "none"),
            320,
            180,
            3.0,
            30.0,
            None,
            OverlayIncludes::ALL,
            fonts,
        )
        .unwrap();
        assert!(plan.text.strict);
        assert_eq!(plan.fonts_loaded, 1);
        assert!(plan.text.has_family("Noto Sans SC"));
        assert!(!plan.text.has_family("Montserrat"));

        let error = OverlayRenderPlan::compile_with_injected_fonts(
            &document("None", "none"),
            320,
            180,
            3.0,
            30.0,
            None,
            OverlayIncludes::ALL,
            Vec::new(),
        )
        .err()
        .expect("an empty font list must be rejected")
        .to_string();
        assert!(error.contains("fallback font"), "{error}");
    }

    #[test]
    fn subtitle_scene_static_fallback_accepts_plain_underlines_in_both_lines() {
        let source = document("None", "none");
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.mode = StudioMode::Translated;
        plan.original_style.underline = true;
        assert_eq!(plan.subtitle_scene_static_fallback(), None);
        plan.translation_style.underline = true;
        assert_eq!(plan.subtitle_scene_static_fallback(), None);
    }

    #[test]
    fn video_burn_in_loads_only_registered_cuccut_font_files() {
        let temp = tempfile::tempdir().unwrap();
        let fonts = temp.path().join("fonts");
        fs::create_dir_all(&fonts).unwrap();
        fs::write(
            fonts.join("lf-alata.ttf"),
            include_bytes!("../../render-raster/assets/fonts/Alata-Regular.ttf"),
        )
        .unwrap();
        fs::write(fonts.join("orphan.ttf"), b"not a registered font").unwrap();
        fs::write(
            fonts.join("library.json"),
            serde_json::to_vec(&json!([
                {"family":"Alata","file":"lf-alata.ttf"},
                {"family":"escape","file":"../outside.ttf"},
                {"family":"duplicate","file":"lf-alata.ttf"}
            ]))
            .unwrap(),
        )
        .unwrap();

        let loaded = font_library_fonts_at(&fonts);
        assert_eq!(loaded.len(), 1);
        let engine = TextEngine::with_document_fonts(&loaded);
        assert!(engine.has_family("Alata"));
    }

    #[test]
    fn overlay_items_follow_cut_clip_reuse_rate_and_multisource_clock() {
        let timeline: timeline::TimelineDocument = serde_json::from_value(json!({
            "ccutTimeline": "0.1",
            "sources": {
                "main": {"cuts": [{"id": "cut-1", "t0": 1.0, "t1": 2.0}]},
                "insert": {"path": "insert.mp4", "kind": "video", "duration": 2.0}
            },
            "clips": [
                {"id": "c1", "in": 0.0, "out": 4.0},
                {"id": "c2", "srcId": "insert", "in": 0.0, "out": 2.0, "rate": 2.0}
            ]
        }))
        .unwrap();
        let projection = timeline::TimelineProjection::build(
            &timeline,
            &std::collections::BTreeMap::from([
                ("main".to_owned(), 4.0),
                ("insert".to_owned(), 2.0),
            ]),
        )
        .unwrap();
        let mut document = json!({
            "meta": {"duration": 4.0},
            "cues": [{
                "id": "q-main", "start": 0.0, "end": 4.0, "text": "A CUT B",
                "words": [
                    {"id": "w1", "text": "A", "t0": 0.0, "t1": 1.0},
                    {"id": "w2", "text": "CUT", "t0": 1.0, "t1": 2.0},
                    {"id": "w3", "text": "B", "t0": 2.0, "t1": 3.0}
                ]
            }],
            "sentences": [],
            "transCues": [{"id": "s-main#0", "sid": "s-main", "kind": "piece",
                "start": 0.5, "end": 2.5, "text": "VISIBLE"}],
            "sourceDocs": {
                "main": {"cues": [], "sentences": [], "transCues": []},
                "insert": {"cues": [{
                    "id": "q-insert", "start": 0.0, "end": 2.0, "text": "INSERT",
                    "words": [{"id": "wi", "text": "INSERT", "t0": 0.0, "t1": 2.0}]
                }], "sentences": [], "transCues": []}
            }
        });
        project_overlay_timed_items(&mut document, &projection);
        let cues = document["cues"].as_array().unwrap();
        assert_eq!(document["meta"]["duration"], 4.0);
        assert_eq!(cues.len(), 3);
        assert_eq!(
            (cues[0]["start"].as_f64(), cues[0]["end"].as_f64()),
            (Some(0.0), Some(1.0))
        );
        assert_eq!(cues[0]["text"], "A");
        assert_eq!(
            (cues[1]["start"].as_f64(), cues[1]["end"].as_f64()),
            (Some(1.0), Some(3.0))
        );
        assert_eq!(cues[1]["text"], "B");
        assert_eq!(cues[1]["words"][0]["t0"], 1.0);
        assert_eq!(cues[1]["words"][0]["t1"], 2.0);
        assert_eq!(cues[2]["sourceId"], "insert");
        assert_eq!(
            (cues[2]["start"].as_f64(), cues[2]["end"].as_f64()),
            (Some(3.0), Some(4.0))
        );
        assert_eq!(cues[2]["words"][0]["t1"], 4.0);
        let translated = document["transCues"].as_array().unwrap();
        assert_eq!(translated.len(), 1);
        assert_eq!(translated[0]["text"], "VISIBLE");
        assert_eq!(
            (
                translated[0]["start"].as_f64(),
                translated[0]["end"].as_f64()
            ),
            (Some(0.5), Some(1.5))
        );
    }

    #[test]
    fn parses_css_alpha_into_internal_transparency() {
        let color = parse_css_color("#11223380").unwrap();
        assert_eq!(
            (color.r, color.g, color.b, color.a),
            (0x11, 0x22, 0x33, 0x7f)
        );
    }

    #[test]
    fn main_place_transforms_the_native_bgra_before_overlay_compositing() {
        let mut pixels = vec![0_u8; 8 * 4 * 4];
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.copy_from_slice(&[0, 0, 255, 255]);
        }
        let main: Main = serde_json::from_value(json!({
            "place": {"x": 75, "y": 50, "scale": 0.5},
            "background": "black"
        }))
        .unwrap();
        apply_main_transform_bgra(&mut pixels, 8 * 4, 8, 4, Some(&main)).unwrap();
        let pixel = |x: usize, y: usize| &pixels[(y * 8 + x) * 4..(y * 8 + x + 1) * 4];
        assert_eq!(pixel(0, 2), &[0, 0, 0, 255]);
        assert!(pixel(5, 2)[2] > 200);
        assert_eq!(pixel(7, 0), &[0, 0, 0, 255]);
    }

    /// `place.opacity = 0` plus a black background is **what every frame of a normal project export looks like**. After the media is moved onto the timeline (`main.detached`), the main layer is hidden by exactly this. This case takes a short circuit in `raster.rs` that fills black row by row and bypasses the whole tiny-skia path (measured 249 ms/frame → ~0). This test pins two contracts of the short circuit: the output is an opaque pure-black background, and the row-end padding of the stride is not written out of bounds.
    #[test]
    fn opacity_zero_on_black_background_yields_an_opaque_black_frame() {
        let stride = 8 * 4 + 12;
        let mut pixels = vec![0_u8; stride * 4];
        for row in 0..4 {
            for column in 0..8 {
                pixels[row * stride + column * 4..row * stride + column * 4 + 4]
                    .copy_from_slice(&[10, 120, 250, 255]);
            }
            pixels[row * stride + 8 * 4..(row + 1) * stride].fill(0x5a);
        }
        let main: Main = serde_json::from_value(json!({
            "place": {"opacity": 0},
            "background": "black"
        }))
        .unwrap();
        apply_main_transform_bgra(&mut pixels, stride, 8, 4, Some(&main)).unwrap();
        for row in 0..4 {
            let visible = &pixels[row * stride..row * stride + 8 * 4];
            assert!(
                visible.chunks_exact(4).all(|pixel| pixel == [0, 0, 0, 255]),
                "row {row} is not opaque black: {visible:?}"
            );
            assert!(
                pixels[row * stride + 8 * 4..(row + 1) * stride]
                    .iter()
                    .all(|byte| *byte == 0x5a),
                "row {row}'s stride padding was overwritten"
            );
        }
    }

    /// The blurred-background case must not take the short circuit. Its content is a blurred version of the source frame. `opacity = 0` only stops the source frame from being layered over the blurred background; the background itself must still be truly computed.
    #[test]
    fn opacity_zero_on_blur_background_still_derives_from_the_source_frame() {
        let mut pixels = vec![0_u8; 8 * 4 * 4];
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.copy_from_slice(&[0, 0, 255, 255]);
        }
        let main: Main = serde_json::from_value(json!({
            "place": {"opacity": 0},
            "background": "blur"
        }))
        .unwrap();
        apply_main_transform_bgra(&mut pixels, 8 * 4, 8, 4, Some(&main)).unwrap();
        assert!(
            pixels.chunks_exact(4).all(|pixel| pixel[2] > 200),
            "the blur backing was short-circuited as a black backing"
        );
    }

    /// The row-fill-black fast path and the export side's short circuit that skips painting the background or uploading altogether must share the same criterion. Otherwise, if the two drift apart, the loop believes there is no need to feed source frames while the rasteriser actually draws them. [`main_transform_is_uniform_black`] is the only real implementation. This test pins its boundary: it holds only when `opacity == 0` and the background is black. A blurred background, partial transparency and the defaults do not qualify.
    #[test]
    fn only_a_fully_transparent_main_on_black_counts_as_a_uniform_black_base() {
        let main = |value: serde_json::Value| serde_json::from_value::<Main>(value).unwrap();
        assert!(main_transform_is_uniform_black(Some(&main(json!({
            "place": {"opacity": 0},
            "background": "black"
        })))));
        // The background defaults to black.
        assert!(main_transform_is_uniform_black(Some(&main(
            json!({"place": {"opacity": 0}})
        ))));
        // The content of a blurred background comes from the source frame, so it cannot be skipped.
        assert!(!main_transform_is_uniform_black(Some(&main(json!({
            "place": {"opacity": 0},
            "background": "blur"
        })))));
        // If even a little still shows through, it must be drawn as usual.
        assert!(!main_transform_is_uniform_black(Some(&main(json!({
            "place": {"opacity": 0.01},
            "background": "black"
        })))));
        // With no `place`, the opacity defaults to 1.
        assert!(!main_transform_is_uniform_black(Some(&main(
            json!({"background": "black"})
        ))));
        assert!(!main_transform_is_uniform_black(None));
    }

    #[test]
    fn decoded_texture_passthrough_requires_an_identity_main_transform() {
        assert!(main_transform_is_identity(None, 1920, 1080));
        for value in [
            json!({}),
            json!({"place": {"x":50,"y":50,"scale":1,"scaleY":1,"rot":0,"opacity":1}}),
        ] {
            let main: Main = serde_json::from_value(value).unwrap();
            assert!(main_transform_is_identity(Some(&main), 1920, 1080));
        }
        for (key, value) in [
            ("x", 49.0),
            ("y", 51.0),
            ("scale", 0.9),
            ("scaleY", 1.1),
            ("rot", 0.01),
            ("opacity", 0.5),
            ("opacity", 0.0),
        ] {
            let mut document = json!({"place": {}});
            document["place"][key] = json!(value);
            let main: Main = serde_json::from_value(document).unwrap();
            assert!(
                !main_transform_is_identity(Some(&main), 1920, 1080),
                "{key}={value}"
            );
        }
    }

    #[test]
    fn media_effects_masks_reveal_and_tile_geometry_are_deterministic() {
        let mut pixel =
            Pixmap::from_vec(vec![100, 150, 200, 255], IntSize::from_wh(1, 1).unwrap()).unwrap();
        apply_media_effects(
            &mut pixel,
            Some(&Fx {
                grayscale: Some(1.0),
                blur: None,
                brightness: Some(0.1),
                contrast: None,
                exposure: None,
                hue: None,
                saturation: None,
                sharpen: None,
                noise: None,
                vignette: None,
                filter_preset: None,
                effect_preset: None,
                effect_intensity: None,
            }),
            1.0,
        );
        assert_eq!(pixel.data()[0], pixel.data()[1]);
        assert_eq!(pixel.data()[1], pixel.data()[2]);
        assert!(pixel.data()[0] > 150);

        let mut clipped = Pixmap::new(9, 9).unwrap();
        clipped.fill(tiny_skia::Color::WHITE);
        apply_local_clip(&mut clipped, 0.0, true, 0.0);
        assert_eq!(clipped.pixel(0, 0).unwrap().alpha(), 0);
        assert_eq!(clipped.pixel(4, 4).unwrap().alpha(), 255);
        apply_horizontal_reveal(&mut clipped, 0.5);
        assert_eq!(clipped.pixel(8, 4).unwrap().alpha(), 0);
        assert!(clipped.pixel(2, 4).unwrap().alpha() > 200);

        let tile = Tile {
            on: true,
            angle: Some(-30.0),
            gap_x: Some(8.0),
            gap_y: Some(10.0),
            stagger: Some(true),
        };
        let first = tile_stamp_points(320, 180, 64, 32, &tile);
        let second = tile_stamp_points(320, 180, 64, 32, &tile);
        assert_eq!(first, second);
        assert!(first.len() > 20);
    }

    /// M118 cross-check: the Mac now projects each line's appearance as `origStyle` / `transStyle`.
    /// The burned-in translation line must use its own font, colour, weight, outline and background, not those of the line at the root node. The font size is still derived from `bilingualOrigScale` / `transScale`. The partial has no `fontSize`, so the compact original text does not fall back to the font size of a separate line.
    #[test]
    fn per_line_style_overrides_reach_the_burned_bilingual_lines() {
        let mut style = document("None", "none")["style"].clone();
        style["mode"] = json!("bi");
        style["bilingualOrigScale"] = json!(0.6);
        style["transScale"] = json!(1.25);
        style["origStyle"] = json!({
            "fontFamily": "montserrat", "fontColor": "#FFFFFF", "bold": true,
            "outline": true, "textOutline": {"color": "#000000", "width": 10, "on": true},
            "background": true, "letterSpacing": 0
        });
        style["transStyle"] = json!({
            "fontFamily": "Bebas Neue", "fontColor": "#FFCC00", "bold": false,
            "outline": false, "textOutline": {"color": "#FF0000", "width": 8, "on": false},
            "background": false, "letterSpacing": 4
        });

        let orig = resolve_line_style(&style, LineKind::Original, 1920, 1080, true);
        let trans = resolve_line_style(&style, LineKind::Translation, 1920, 1080, true);

        assert_eq!(orig.font_name, "Montserrat");
        assert_eq!(trans.font_name, "Bebas Neue");
        // The root node is the original line in bold, outlined and with a background. These three flat booleans take priority over the structured fields, so the partial must be able to override them.
        assert!(orig.bold && !trans.bold);
        assert!(orig.outline_on && !trans.outline_on);
        assert!(orig.background_on && !trans.background_on);
        assert_eq!(
            (trans.color.r, trans.color.g, trans.color.b),
            (0xFF, 0xCC, 0x00)
        );
        assert_eq!(
            (orig.color.r, orig.color.g, orig.color.b),
            (0xFF, 0xFF, 0xFF)
        );

        let canvas = f64::from(1080_u32) / REFERENCE_SHORT_EDGE;
        assert!((orig.font_size - 30.0 * 0.6 * canvas).abs() < 1e-9);
        assert!((trans.font_size - 30.0 * 0.6 * 1.25 * canvas).abs() < 1e-9);
        // Letter spacing is also normalised to this line's own font size (the prototype's `letterSpacing` is 1/100 em). Translation logical font size 30 × 0.6 × 1.25 = 22.5 ⇒ size_scale = 0.75 · canvas.
        assert!((trans.letter_spacing - 4.0 * 0.75 * canvas).abs() < 1e-9);
    }

    /// Two original-text subtitles with no in or out margin, so that one can easily be picked at each moment.
    fn two_cue_document(style: Value) -> Value {
        let mut base = document("None", "none")["style"].clone();
        base["displayTiming"] = json!({"leadIn": 0, "tail": 0});
        for (key, value) in style.as_object().unwrap() {
            base[key] = value.clone();
        }
        json!({
            "meta": {"duration": 3.0},
            "style": base,
            "cues": [
                {"id": "q1", "start": 0.0, "end": 1.5, "text": "Hello world",
                 "words": [{"text": "Hello", "t0": 0.0, "t1": 0.7}, {"text": "world", "t0": 0.8, "t1": 1.5}]},
                {"id": "q2", "start": 1.5, "end": 3.0, "text": "Second line",
                 "words": [{"text": "Second", "t0": 1.5, "t1": 2.2}, {"text": "line", "t0": 2.3, "t1": 3.0}]}
            ],
            "sentences": [],
            "transCues": [
                {"id": "s1#0", "sid": "s1", "kind": "piece", "text": "你好世界", "start": 0.0, "end": 1.5},
                {"id": "s2#0", "sid": "s2", "kind": "piece", "text": "第二行", "start": 1.5, "end": 3.0}
            ]
        })
    }

    fn has_red_pixel(rgba: &[u8]) -> bool {
        rgba.chunks_exact(4)
            .any(|pixel| pixel[0] > 180 && pixel[1] < 40 && pixel[2] < 40 && pixel[3] > 180)
    }

    #[test]
    fn a_cue_style_restyles_only_its_own_cue_in_layout_and_pixels() {
        let document = two_cue_document(json!({
            // In single-line mode, the same-named keys in `origStyle` must not override the per-cue overrides.
            "origStyle": {"fontColor": "#00FF00"},
            "cueStyles": {"q2": {"source": {"fontColor": "#FF0000", "fontSize": 60}}}
        }));
        let mut plan = OverlayRenderPlan::compile(&document, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.active_layouts(0.8);
        let second = plan.active_layouts(2.0);
        assert_eq!(first[0].item.id, "q1");
        assert_eq!(second[0].item.id, "q2");
        assert_eq!(
            (first[0].style.color.r, first[0].style.color.g),
            (0x00, 0xFF)
        );
        assert_eq!(
            (second[0].style.color.r, second[0].style.color.g),
            (0xFF, 0x00)
        );
        assert!((second[0].style.font_size - first[0].style.font_size * 2.0).abs() < 1e-9);
        assert!(!has_red_pixel(&plan.render_rgba_frame(0.8).unwrap().rgba));
        assert!(has_red_pixel(&plan.render_rgba_frame(2.0).unwrap().rgba));
    }

    #[test]
    fn an_empty_cue_style_renders_exactly_like_the_track() {
        let plain = two_cue_document(json!({}));
        let detached = two_cue_document(json!({"cueStyles": {"q1": {"source": {}}}}));
        let mut plain = OverlayRenderPlan::compile(&plain, 320, 180, 3.0, 30.0, None).unwrap();
        let mut detached =
            OverlayRenderPlan::compile(&detached, 320, 180, 3.0, 30.0, None).unwrap();
        assert!(detached.cue_original.is_empty());
        let (plain_frame, detached_frame) = (
            plain.subtitle_layout(0.8).unwrap(),
            detached.subtitle_layout(0.8).unwrap(),
        );
        assert_eq!(plain_frame.anchor, detached_frame.anchor);
        assert_eq!(plain_frame.lines.len(), detached_frame.lines.len());
        assert_eq!(
            plain.render_rgba_frame(0.8).unwrap().rgba,
            detached.render_rgba_frame(0.8).unwrap().rgba
        );
    }

    #[test]
    fn a_single_mode_cue_position_moves_the_whole_group() {
        let document = two_cue_document(json!({
            "cueStyles": {"q2": {"source": {"y": 20}}}
        }));
        let mut plan = OverlayRenderPlan::compile(&document, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_layout(0.8).unwrap();
        let second = plan.subtitle_layout(2.0).unwrap();
        assert!(
            second.anchor.1 < first.anchor.1 - 50.0,
            "q2's per-item y=20 should lift the whole group: {:?} vs {:?}",
            second.anchor,
            first.anchor
        );
        assert_eq!(first.anchor.0, second.anchor.0);
    }

    #[test]
    fn a_bilingual_translation_cue_style_detaches_only_that_line() {
        let document = two_cue_document(json!({
            "mode": "bi",
            "cueStyles": {"s2#0": {"translation": {"y": 20, "fontColor": "#FF0000"}}}
        }));
        let mut plan = OverlayRenderPlan::compile_with(
            &document,
            320,
            180,
            3.0,
            30.0,
            Some("bi"),
            OverlayIncludes::ALL,
        )
        .unwrap();
        assert_eq!(plan.cue_translation.len(), 1);
        let first = plan.subtitle_layout(0.8).unwrap();
        assert!(first.lines.iter().all(|line| !line.detached));
        let second = plan.subtitle_layout(2.0).unwrap();
        let translation = second
            .lines
            .iter()
            .find(|line| line.cue_id == "s2#0")
            .unwrap();
        let original = second
            .lines
            .iter()
            .find(|line| line.cue_id == "q2")
            .unwrap();
        assert!(translation.detached && !original.detached);
        assert!(translation.y < original.y);
        let styles = plan.active_layouts(2.0);
        let translated = styles
            .iter()
            .find(|line| line.kind == LineKind::Translation)
            .unwrap();
        assert_eq!(translated.style.color.r, 0xFF);
        assert_eq!(translated.style.color.g, 0x00);
    }

    #[test]
    fn a_portrait_and_a_landscape_canvas_with_the_same_short_edge_share_the_font_pixel() {
        let style = document("None", "none")["style"].clone();
        let landscape = resolve_line_style(&style, LineKind::Original, 1920, 1080, false);
        let portrait = resolve_line_style(&style, LineKind::Original, 1080, 1920, false);
        assert_eq!(landscape.font_size, 60.0);
        assert_eq!(portrait.font_size, 60.0);
        assert_eq!(1920.0 * 0.8, 1536.0);
        assert_eq!(1080.0 * 0.8, 864.0);
    }

    #[test]
    fn numeric_and_legacy_string_weights_reach_the_line_style() {
        let mut style = document("None", "none")["style"].clone();
        style["fontWeight"] = json!(600);
        style["bold"] = json!(false);
        let resolved = resolve_line_style(&style, LineKind::Original, 960, 540, false);
        assert_eq!(resolved.font_weight, 600);
        assert!(!resolved.bold);

        style["fontWeight"] = json!("700");
        let legacy = resolve_line_style(&style, LineKind::Original, 960, 540, false);
        assert_eq!(legacy.font_weight, 700);
        assert!(legacy.bold);
    }

    #[test]
    fn caption_projection_spaces_mixed_scripts_without_changing_word_timing() {
        let text = "让Claude创建一个Artifact，使用v3版本。";
        let expected = "让 Claude 创建一个 Artifact，使用 v3 版本。";
        let data = json!({"text": text, "start": 0.0, "end": 3.0, "words": [
            {"id": "w0", "text": "让", "t0": 0.0, "t1": 0.2},
            {"id": "w1", "text": "Claude", "t0": 0.2, "t1": 0.8},
            {"id": "w2", "text": "创建一个Artifact", "t0": 0.8, "t1": 2.0},
            {"id": "w3", "text": "，使用v3版本。", "t0": 2.0, "t1": 3.0}
        ]});
        let original = data.clone();
        let items = timed_items(&[data.clone()], "text", &json!({"punct": false}), "zh");
        let item = &items[0];
        assert_eq!(item.text, expected);
        assert_eq!(data, original);
        let runs = timed_runs(&item.text, &item.words, "");
        assert_eq!(
            runs.iter().map(|run| run.text.as_str()).collect::<String>(),
            expected
        );
        assert_eq!(
            runs.iter().filter_map(|run| run.word).collect::<Vec<_>>(),
            [0, 1, 2, 3]
        );
        for (index, word) in item.words.iter().enumerate() {
            assert_eq!(word.id, original["words"][index]["id"].as_str().unwrap());
            assert_eq!(word.start, original["words"][index]["t0"].as_f64().unwrap());
            assert_eq!(word.end, original["words"][index]["t1"].as_f64().unwrap());
        }
        assert_eq!(
            projected_text(text, "zh", true),
            "让 Claude 创建一个 Artifact 使用 v3 版本"
        );
        assert_eq!(projected_text(expected, "zh", false), expected);
        let inferred = |text| {
            derived_words(&json!({}), text, 0.0, 3.0, "zh", false)
                .into_iter()
                .map(|word| (word.id, word.text, word.start, word.end))
                .collect::<Vec<_>>()
        };
        assert_eq!(inferred(text), inferred(expected));
        // Content determines spacing even for imported subtitles without a language tag.
        assert_eq!(projected_text(text, "", false), expected);
        assert_eq!(projected_text("AIを使う", "ja", false), "AI を使う");
        assert_eq!(projected_text("中文AI AI가", "ko", false), "中文 AI AI가");
        for text in [
            "Hello, world.",
            "AI가 2박 3일 600원",
            "중국어中文AI가",
            "ᄀAI ᄂ2",
            "https://example.com/中文AI",
            "中文，English。",
            "让 Claude\n创建 Artifact",
            "รหัสF07",
        ] {
            assert_eq!(projected_text(text, "", false), text);
        }
    }

    #[test]
    fn title_case_preserves_word_timing_across_mixed_cjk_and_latin_text() {
        let words = vec![
            Word {
                id: "w0".into(),
                text: "world".into(),
                start: 0.0,
                end: 0.5,
            },
            Word {
                id: "w1".into(),
                text: "ACME".into(),
                start: 0.5,
                end: 1.0,
            },
        ];
        let runs = timed_runs("你好world ACME", &words, "title");
        assert_eq!(
            runs.iter().map(|run| run.text.as_str()).collect::<String>(),
            "你好world ACME"
        );
        assert_eq!(
            runs.iter()
                .filter_map(|run| run.word.map(|word| (word, run.text.as_str())))
                .collect::<Vec<_>>(),
            [(0, "world"), (1, "ACME")]
        );
    }

    #[test]
    fn a_missing_border_radius_keeps_the_legacy_render_bytes() {
        let mut legacy = document("None", "none");
        legacy["style"]
            .as_object_mut()
            .unwrap()
            .remove("borderRadius");
        let mut explicit = legacy.clone();
        explicit["style"]["borderRadius"] = json!(10.0 * 0.8 / 0.55);
        let mut old_plan = OverlayRenderPlan::compile(&legacy, 320, 180, 3.0, 30.0, None).unwrap();
        let mut new_plan =
            OverlayRenderPlan::compile(&explicit, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(
            old_plan.render_rgba(1.0).unwrap(),
            new_plan.render_rgba(1.0).unwrap()
        );
    }

    #[test]
    fn short_gaps_are_split_exactly_between_tail_and_lead_in() {
        for (gap, lead_in, tail) in [(0.1, 0.5, 1.0), (0.6, 0.7, 0.4), (1.2, 2.0, 1.0)] {
            assert!(gap < lead_in + tail);
            let sum = display_padding(tail, gap, lead_in, tail)
                + display_padding(lead_in, gap, lead_in, tail);
            assert!((sum - gap).abs() < 1e-12, "{gap}/{lead_in}/{tail}");
        }
    }

    /// The upper limit of the effect layer's blur radius must follow the font size. The Mac and Web previews do not clamp it. The panel limits (glow range 100 ⇒ 0.9·fontSize, shadow blur 0.5 ⇒ 0.5·fontSize) must carry through unchanged to the burn-in. The old hard-coded 10px would turn soft shadows into hard edges at 4K.
    #[test]
    fn effect_blur_ceiling_scales_with_font_size() {
        let mut style = document("None", "none")["style"].clone();
        style["dropShadow"] =
            json!({"on": true, "blur": 0.5, "distance": 0.0, "opacity": 0.6, "color": "#000000"});
        let shadow = resolve_line_style(&style, LineKind::Original, 1920, 1080, false);
        assert!(shadow.effect_on);
        assert!(
            (shadow.effect_blur - 30.0).abs() < 1e-9,
            "0.5 × 60 = 30 (the old basis would be clamped to 10), got {}",
            shadow.effect_blur
        );

        style["glow"] = json!({"on": true, "intensity": 50, "range": 100, "color": "#FFFFFF"});
        let glow = resolve_line_style(&style, LineKind::Original, 1920, 1080, false);
        assert!(
            (glow.effect_blur - 54.0).abs() < 1e-9,
            "100/100 × 60 × 0.9 = 54, got {}",
            glow.effect_blur
        );
    }

    const PLACE_ANCHOR: (f64, f64) = (500.0, 860.0);

    const PLACE_FRAME: (f64, f64) = (1000.0, 1000.0);

    const PLACE_GAP: f64 = 6.0;

    /// A stack input in which every line takes exactly one line (actual height equals reference height) and there are no explicit anchors at all.
    /// This is the baseline that must be bit-identical before and after the vertical anchor was introduced.
    fn single_row_boxes(heights: &[f64], overrides: &[Option<(f64, f64)>]) -> Vec<LineBox> {
        heights
            .iter()
            .zip(overrides)
            .map(|(height, over)| LineBox {
                height: *height,
                reference: *height,
                pad_v: 0.0,
                over: *over,
                align: None,
            })
            .collect()
    }

    /// Equivalence sentinel (must not be loosened): when every line occupies exactly one line, the new slot-and-seam algorithm must restore, bit for bit, the old formula of "centre the total height, then accumulate each line's actual height". The three landing points below are the output from before the refactor.
    ///
    /// The three cases of line-level position override are also computed here in one pass. When both lines are overridden, each is centred independently. When only one line is overridden, the stack holds only the other line, and it collapses to a single line centred on the anchor. When neither is overridden, the old formula applies.
    #[test]
    fn line_positions_lift_only_the_covered_lines_out_of_the_stack() {
        let heights = [40.0, 20.0];
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);

        let stacked = single_row_boxes(&heights, &[None, None]);
        assert_eq!(
            stacked_extent(&stacked, gap, StackPlate::Separate),
            StackExtent {
                count: 2,
                total_height: 66.0,
            }
        );
        assert_eq!(
            place_lines(&stacked, anchor, gap, frame, None, StackPlate::Separate),
            vec![(500.0, 827.0), (500.0, 873.0)]
        );

        let both = single_row_boxes(&heights, &[Some((20.0, 30.0)), Some((80.0, 70.0))]);
        assert_eq!(
            stacked_extent(&both, gap, StackPlate::Separate),
            StackExtent {
                count: 0,
                total_height: 0.0,
            }
        );
        assert_eq!(
            place_lines(&both, anchor, gap, frame, None, StackPlate::Separate),
            vec![(200.0, 280.0), (800.0, 690.0)]
        );

        let first = single_row_boxes(&heights, &[Some((20.0, 30.0)), None]);
        assert_eq!(
            stacked_extent(&first, gap, StackPlate::Separate),
            StackExtent {
                count: 1,
                total_height: 20.0,
            }
        );
        let placed = place_lines(&first, anchor, gap, frame, None, StackPlate::Separate);
        assert_eq!(placed, vec![(200.0, 280.0), (500.0, 850.0)]);
        // Contract: the remaining line must land in the same place as it would if it were the only line from the start.
        assert_eq!(
            place_lines(
                &single_row_boxes(&heights[1..], &[None]),
                anchor,
                gap,
                frame,
                None,
                StackPlate::Separate,
            ),
            vec![placed[1]]
        );
    }

    /// Seam pinning: wrapping grows only on its own side, and the other line's landing point does not move at all.
    ///
    /// The slot height is taken as the "single-line reference height", not the actual height after wrapping. So when the upper line wraps to two lines it grows upward, and when the lower line wraps it grows downward. The two endpoints of the gap between them both stay in place. This is the whole basis for bilingual subtitles' "changing one line does not move the other".
    #[test]
    fn wrapped_lines_grow_away_from_the_seam() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let reference = [40.0, 20.0];
        let boxes = |heights: [f64; 2]| {
            vec![
                LineBox {
                    height: heights[0],
                    reference: reference[0],
                    pad_v: 0.0,
                    over: None,
                    align: None,
                },
                LineBox {
                    height: heights[1],
                    reference: reference[1],
                    pad_v: 0.0,
                    over: None,
                    align: None,
                },
            ]
        };
        let baseline = place_lines(
            &boxes(reference),
            anchor,
            gap,
            frame,
            None,
            StackPlate::Separate,
        );
        assert_eq!(baseline, vec![(500.0, 827.0), (500.0, 873.0)]);

        // The upper line wraps to two lines (40 → 80): it grows upward from the slot bottom, and the lower line does not move at all.
        let upper = place_lines(
            &boxes([80.0, 20.0]),
            anchor,
            gap,
            frame,
            None,
            StackPlate::Separate,
        );
        assert_eq!(upper, vec![(500.0, 787.0), (500.0, 873.0)]);
        // The seam is still 6: the upper line's bottom edge is 787+80=867, and the lower line's top edge is 873.
        assert!((873.0 - (787.0 + 80.0) - gap).abs() < 1e-9);

        // The lower line wraps to two lines (20 → 40): it grows downward from the slot top, and the upper line does not move at all.
        let lower = place_lines(
            &boxes([40.0, 40.0]),
            anchor,
            gap,
            frame,
            None,
            StackPlate::Separate,
        );
        assert_eq!(lower, vec![(500.0, 827.0), (500.0, 873.0)]);
    }

    /// When only one line is left in the stack, the slot falls back to the actual height, and a wrapped block is still centred on the anchor.
    ///
    /// If one copied "the slot is always the single-line reference height", everything would shift by `reference height / 2`, moving every existing single-language wrapped subtitle. The equivalence sentinel (no wrapping) cannot catch this, so it gets its own test.
    #[test]
    fn a_lone_wrapped_line_still_centers_on_the_anchor() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let wrapped = vec![LineBox {
            height: 80.0,
            reference: 40.0,
            pad_v: 0.0,
            over: None,
            align: None,
        }];
        assert_eq!(
            stacked_extent(&wrapped, gap, StackPlate::Separate),
            StackExtent {
                count: 1,
                total_height: 80.0,
            }
        );
        assert_eq!(
            place_lines(&wrapped, anchor, gap, frame, None, StackPlate::Separate),
            vec![(500.0, 820.0)]
        );
        // The same holds when only one line is overridden and the other line has wrapped: it falls back to the landing point it would have as the only line.
        let mixed = vec![
            LineBox {
                height: 40.0,
                reference: 40.0,
                pad_v: 0.0,
                over: Some((20.0, 30.0)),
                align: None,
            },
            wrapped[0],
        ];
        assert_eq!(
            place_lines(&mixed, anchor, gap, frame, None, StackPlate::Separate)[1],
            place_lines(&wrapped, anchor, gap, frame, None, StackPlate::Separate)[0]
        );
    }

    /// The block-level anchor acts on the whole stack. top → the top edge of the stack presses on the anchor line; bottom → the bottom edge of the stack presses on the anchor line; center (and absent) → the centre of the stack presses on the anchor line (the current behaviour). The order of lines never flips.
    #[test]
    fn the_block_anchor_hangs_the_whole_stack_off_the_anchor_line() {
        let heights = [40.0, 20.0];
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let stacked = single_row_boxes(&heights, &[None, None]);
        let placed = |align| place_lines(&stacked, anchor, gap, frame, align, StackPlate::Separate);

        assert_eq!(placed(None), placed(Some(VerticalAlign::Center)));
        assert_eq!(
            placed(Some(VerticalAlign::Center)),
            vec![(500.0, 827.0), (500.0, 873.0)]
        );
        assert_eq!(
            placed(Some(VerticalAlign::Top)),
            vec![(500.0, 860.0), (500.0, 906.0)]
        );
        assert_eq!(
            placed(Some(VerticalAlign::Bottom)),
            vec![(500.0, 794.0), (500.0, 840.0)]
        );

        // Single-line block (including a wrapped one): the three states are "top edge, centre, or bottom edge pressed onto the line".
        let lone = vec![LineBox {
            height: 80.0,
            reference: 40.0,
            pad_v: 0.0,
            over: None,
            align: None,
        }];
        let lone_top =
            |align| place_lines(&lone, anchor, gap, frame, align, StackPlate::Separate)[0].1;
        assert_eq!(lone_top(Some(VerticalAlign::Top)), 860.0);
        assert_eq!(lone_top(Some(VerticalAlign::Center)), 820.0);
        assert_eq!(lone_top(Some(VerticalAlign::Bottom)), 780.0);
    }

    /// Line-level anchors override the default seam placement inside the slot. A line detached from the stack hangs on `(x%, y%)` by its own anchor. When absent, it is still centre, so old documents have zero regressions.
    #[test]
    fn line_anchors_override_the_seam_and_place_detached_lines() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        // The upper line wraps to two lines, but is explicitly asked to stick to the slot top, so it grows downward and overrides the seam.
        let forced = vec![
            LineBox {
                height: 80.0,
                reference: 40.0,
                pad_v: 0.0,
                over: None,
                align: Some(VerticalAlign::Top),
            },
            LineBox {
                height: 20.0,
                reference: 20.0,
                pad_v: 0.0,
                over: None,
                align: None,
            },
        ];
        assert_eq!(
            place_lines(&forced, anchor, gap, frame, None, StackPlate::Separate),
            vec![(500.0, 827.0), (500.0, 873.0)]
        );

        // Detached line: y% = 30 → 300px anchor line, block height 40.
        let detached = |align| {
            place_lines(
                &[LineBox {
                    height: 40.0,
                    reference: 40.0,
                    pad_v: 0.0,
                    over: Some((20.0, 30.0)),
                    align,
                }],
                anchor,
                gap,
                frame,
                None,
                StackPlate::Separate,
            )[0]
        };
        assert_eq!(detached(None), (200.0, 280.0));
        assert_eq!(detached(Some(VerticalAlign::Center)), (200.0, 280.0));
        assert_eq!(detached(Some(VerticalAlign::Top)), (200.0, 300.0));
        assert_eq!(detached(Some(VerticalAlign::Bottom)), (200.0, 260.0));
    }

    /// The shared plate uses the actual range after placement. When wrapped lines grow beyond the slot, the plate must grow with them. When nothing wraps, the result is bit-identical to "anchor ± total height / 2".
    #[test]
    fn the_shared_background_spans_the_placed_lines() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let flat = single_row_boxes(&[40.0, 20.0], &[None, None]);
        let placed = place_lines(&flat, anchor, gap, frame, None, StackPlate::Separate);
        assert_eq!(stacked_span(&placed, &flat), Some((827.0, 893.0)));

        let wrapped = vec![
            LineBox {
                height: 80.0,
                reference: 40.0,
                pad_v: 0.0,
                over: None,
                align: None,
            },
            LineBox {
                height: 40.0,
                reference: 20.0,
                pad_v: 0.0,
                over: None,
                align: None,
            },
        ];
        let placed = place_lines(&wrapped, anchor, gap, frame, None, StackPlate::Separate);
        // The upper line spans 787..867 and the lower line 873..913, so the plate has grown out at both ends.
        assert_eq!(stacked_span(&placed, &wrapped), Some((787.0, 913.0)));

        // Lines detached from the stack do not enter the shared plate. If all lines are detached, there is no shared plate to draw.
        let detached = vec![
            LineBox {
                over: Some((20.0, 5.0)),
                ..flat[0]
            },
            flat[1],
        ];
        let placed = place_lines(&detached, anchor, gap, frame, None, StackPlate::Separate);
        assert_eq!(stacked_span(&placed, &detached), Some((850.0, 870.0)));
        assert_eq!(stacked_span(&[], &[]), None);
    }

    /// A two-line stack with asymmetric inner padding: the upper line's `pad_v` is 10, the lower line's is 4.
    ///
    /// The guards all use unequal values. With symmetric fixtures, both "each line uses its own pad_v" and "both lines share one pad_v" would pass. Only an asymmetric fixture pins down the Mac's per-line semantics.
    fn padded_pair() -> Vec<LineBox> {
        vec![
            LineBox {
                height: 40.0,
                reference: 40.0,
                pad_v: 10.0,
                over: None,
                align: None,
            },
            LineBox {
                height: 20.0,
                reference: 20.0,
                pad_v: 4.0,
                over: None,
                align: None,
            },
        ]
    }

    /// Per-line plates: the slot includes `2 × pad_v`, and the gap falls between the two **plates**, not between the glyphs.
    ///
    /// The visible gap is the spacing between the two plates. If the gap were still recorded between glyphs, the two bilingual plates would touch or even overlap. So the space between glyphs is widened by `gap + upper pad_v + lower pad_v`, and it is not split evenly when the padding is asymmetric.
    #[test]
    fn padded_slots_put_the_gap_between_the_plates_not_the_glyphs() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let lines = padded_pair();
        // Slot height = reference height + 2 × its own pad_v: 60 and 28, total 60 + 28 + 6 = 94.
        assert_eq!(
            stacked_extent(&lines, gap, StackPlate::Separate),
            StackExtent {
                count: 2,
                total_height: 94.0,
            }
        );
        // The return value is always the glyph top edge: the box top, which includes padding, is further inset by pad_v.
        let placed = place_lines(&lines, anchor, gap, frame, None, StackPlate::Separate);
        assert_eq!(placed, vec![(500.0, 823.0), (500.0, 883.0)]);

        let upper_plate_bottom = placed[0].1 + lines[0].height + lines[0].pad_v;
        let lower_plate_top = placed[1].1 - lines[1].pad_v;
        assert_eq!(lower_plate_top - upper_plate_bottom, gap);
        assert_eq!(
            placed[1].1 - (placed[0].1 + lines[0].height),
            gap + lines[0].pad_v + lines[1].pad_v
        );

        // When all pad_v values are 0, it falls back bit for bit to the old landing point without padding (the three numbers in the equivalence sentinel).
        let bare = single_row_boxes(&[40.0, 20.0], &[None, None]);
        assert_eq!(
            place_lines(&bare, anchor, gap, frame, None, StackPlate::Separate),
            vec![(500.0, 827.0), (500.0, 873.0)]
        );
    }

    /// The block-level anchor pins the whole stack's box **including padding**: top → the top edge of the plate presses on the anchor line; bottom → the bottom edge of the plate presses on the anchor line.
    ///
    /// Pinning the glyph edge would push a subtitle with a plate out of bounds, because the plate has one extra pad_v beyond the glyphs.
    #[test]
    fn the_block_anchor_pins_the_padded_stack_edges() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let lines = padded_pair();
        let placed = |align| place_lines(&lines, anchor, gap, frame, align, StackPlate::Separate);

        assert_eq!(placed(None), vec![(500.0, 823.0), (500.0, 883.0)]);
        assert_eq!(
            placed(Some(VerticalAlign::Top)),
            vec![(500.0, 870.0), (500.0, 930.0)]
        );
        assert_eq!(
            placed(Some(VerticalAlign::Bottom)),
            vec![(500.0, 776.0), (500.0, 836.0)]
        );
        // The upper line's plate top is the anchor line; the lower line's plate bottom is the anchor line.
        assert_eq!(
            placed(Some(VerticalAlign::Top))[0].1 - lines[0].pad_v,
            anchor.1
        );
        let bottom = placed(Some(VerticalAlign::Bottom));
        assert_eq!(bottom[1].1 + lines[1].height + lines[1].pad_v, anchor.1);
    }

    /// Shared plate: the slot and the gap both remain on the bare glyphs, and the block-level anchor pins the edges of **that plate**.
    ///
    /// The padding inside the plate is recorded outside the whole stack (the Mac's `platePadV`), so the glyph placement is bit-identical to the per-line mode with pad = 0. In shared mode, changing `backgroundPadding` should only make the plate grow; it should not move the text.
    #[test]
    fn the_shared_plate_edge_is_what_the_block_anchor_pins() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let lines = padded_pair();
        let plate = StackPlate::Shared { pad_v: 12.0 };
        // The slot is still the bare reference height (40 + 20 + 6), and the in-plate padding 12 × 2 is recorded outside it.
        assert_eq!(
            stacked_extent(&lines, gap, plate),
            StackExtent {
                count: 2,
                total_height: 90.0,
            }
        );
        let placed = |align| place_lines(&lines, anchor, gap, frame, align, plate);
        assert_eq!(placed(None), vec![(500.0, 827.0), (500.0, 873.0)]);

        // Plate = the glyph range expanded outward by one `platePadV`. The source line's glyph top sits exactly `platePadV` below the plate top.
        let span = stacked_span(&placed(None), &lines).expect("the stack has two lines");
        assert_eq!((span.0 - 12.0, span.1 + 12.0), (815.0, 905.0));
        assert_eq!(placed(None)[0].1 - (span.0 - 12.0), 12.0);

        let top = placed(Some(VerticalAlign::Top));
        assert_eq!(top, vec![(500.0, 872.0), (500.0, 918.0)]);
        assert_eq!(stacked_span(&top, &lines).expect("two lines").0 - 12.0, anchor.1);
        let bottom = placed(Some(VerticalAlign::Bottom));
        assert_eq!(bottom, vec![(500.0, 782.0), (500.0, 828.0)]);
        assert_eq!(
            stacked_span(&bottom, &lines).expect("two lines").1 + 12.0,
            anchor.1
        );
    }

    /// Shared-plate line selection: `!source line has a real background && translation line has a real background ? translation line : source line`.
    ///
    /// The crux is the branch where neither line has a real background. Even then, the **source line** is still chosen. The plate is indeed not drawn, but its pad still stretches the whole slot box through the `plate_pad_v` of `StackPlate::Shared`. Choosing the wrong line when the two lines' `backgroundPadding` is asymmetric is a real geometric divergence from the Mac and Web, not a case of "it's invisible anyway".
    ///
    /// The fixture's two pads are deliberately unequal. When they are equal, either choice passes, and nothing is pinned down.
    #[test]
    fn the_shared_plate_spec_falls_back_to_the_translation_only_when_it_has_a_background() {
        // Each candidate is (the pad derived from backgroundPadding, whether this line can draw a real plate).
        let (source_pad, trans_pad) = (20.0_f64, 5.0_f64);
        let pad_of = |line: Option<(f64, bool)>| line.map(|(pad, _)| pad);
        let pick = |source: Option<(f64, bool)>, trans: Option<(f64, bool)>| {
            pad_of(shared_plate_line(source, trans, |(_, bg): (f64, bool)| bg))
        };
        let source = |bg| Some((source_pad, bg));
        let trans = |bg| Some((trans_pad, bg));

        // Neither line has a real background → the source line. The fallback requires the translation line **itself** to have a background; both conditions are necessary.
        assert_eq!(pick(source(false), trans(false)), Some(source_pad));
        assert_eq!(pick(source(false), trans(true)), Some(trans_pad));
        // When the source line itself can draw a plate, whether the translation line has one makes no difference.
        assert_eq!(pick(source(true), trans(false)), Some(source_pad));
        assert_eq!(pick(source(true), trans(true)), Some(source_pad));
        // When only one line remains in the stack (the other is detached or disabled), that line decides on its own.
        assert_eq!(pick(source(false), None), Some(source_pad));
        assert_eq!(pick(None, trans(false)), Some(trans_pad));
        assert_eq!(pick(None, None), None);

        // The selected pad does enter the placement: the difference in slot box height between the two candidates is (20 − 5) × 2.
        let extent = |pad| {
            stacked_extent(&padded_pair(), PLACE_GAP, StackPlate::Shared { pad_v: pad })
                .total_height
        };
        assert_eq!(
            extent(source_pad) - extent(trans_pad),
            (source_pad - trans_pad) * 2.0
        );
    }

    /// A line detached from the stack hangs on `(x%, y%)` by its own box **including padding**:
    /// top → the top of the plate presses on the line; center (including absent) → the middle of the plate presses on the line; bottom → the bottom of the plate presses on the line.
    ///
    /// A detached line always draws its own plate, because a shared plate cannot cover a discontinuous range, so the plate mode does not affect it.
    #[test]
    fn detached_line_anchors_pin_the_padded_box_edges() {
        let (anchor, frame, gap) = (PLACE_ANCHOR, PLACE_FRAME, PLACE_GAP);
        let line = |align| LineBox {
            height: 40.0,
            reference: 40.0,
            pad_v: 10.0,
            over: Some((20.0, 30.0)),
            align,
        };
        let detached = |align| {
            place_lines(
                &[line(align)],
                anchor,
                gap,
                frame,
                None,
                StackPlate::Separate,
            )[0]
        };

        assert_eq!(detached(None), (200.0, 280.0));
        assert_eq!(detached(Some(VerticalAlign::Center)), (200.0, 280.0));
        assert_eq!(detached(Some(VerticalAlign::Top)), (200.0, 310.0));
        assert_eq!(detached(Some(VerticalAlign::Bottom)), (200.0, 250.0));
        // The three edges of a box 60 tall each press on the y% = 30 → 300 line.
        assert_eq!(detached(Some(VerticalAlign::Top)).1 - 10.0, 300.0);
        assert_eq!(detached(None).1 - 10.0 + 30.0, 300.0);
        assert_eq!(detached(Some(VerticalAlign::Bottom)).1 + 40.0 + 10.0, 300.0);
        // The plate mode is irrelevant to detached lines.
        assert_eq!(
            place_lines(
                &[line(None)],
                anchor,
                gap,
                frame,
                None,
                StackPlate::Shared { pad_v: 12.0 }
            )[0],
            detached(None)
        );
    }

    /// `pad_v` always equals `pad_h / PLATE_PAD_ASPECT`. The prototype `designs/cuccut/app/panel-substyle.jsx:82-86` `padOf` has only one `pad`: vertically `pad·fz/100`, and horizontally multiplied by 1.4. Previously the core chose a coefficient between 0.62 and 0.45 depending on whether the plate was a block. Both resulting aspect ratios (1.6 and 2.2) were flatter than the prototype's 1.4, so the text sat pressed against the plate edges top and bottom. `backgroundStyle == "block"` now determines only the minimum width.
    ///
    /// Turning the plate off does not bring `pad_v` to zero. A line that does not draw a plate still stretches its own slot. Otherwise, "toggling the background once" on the same document would move the other line.
    #[test]
    fn the_plate_padding_keeps_the_prototype_aspect_ratio() {
        let mut style = document("None", "none")["style"].clone();
        style["backgroundPadding"] = json!(20);
        style["background"] = json!(true);
        style["backgroundStyle"] = json!("wrap");
        // Short side 1080 → canvas_scale 2.0; pad_h = 20 × 2 × 0.8 = 32.
        let resolve =
            |style: &Value| resolve_line_style(style, LineKind::Original, 1920, 1080, false);

        let wrap = resolve(&style);
        assert!((wrap.background_pad_h - 32.0).abs() < 1e-9);
        assert!((wrap.background_pad_v - 32.0 / PLATE_PAD_ASPECT).abs() < 1e-9);

        style["backgroundStyle"] = json!("block");
        let block = resolve(&style);
        assert!((block.background_pad_h - 32.0).abs() < 1e-9);
        assert!((block.background_pad_v - 32.0 / PLATE_PAD_ASPECT).abs() < 1e-9);
        assert_eq!(block.background_pad_v, wrap.background_pad_v);

        style["background"] = json!(false);
        let off = resolve(&style);
        assert!(!off.background_on);
        assert!((off.background_pad_h - 32.0).abs() < 1e-9);
        assert!((off.background_pad_v - 32.0 / PLATE_PAD_ASPECT).abs() < 1e-9);

        // Line-level partials each override `backgroundPadding`. An asymmetric `pad_v` is a legal input, so the shared plate cannot pick a line arbitrarily for its padding.
        //
        // The translation line's `pad_h` also follows **its own font size**. Here the translation's logical font size is 30 × (20/30) × (32/20) = 32, and with short side 1080 ⇒ font_size 64, so pad_h = 5 × (64/30) × 0.8. Previously it was multiplied by canvas_scale (2.0), so the translation line's plate was as thick as the original line's, and the bilingual lines looked like two plates of different proportions.
        style["mode"] = json!("bi");
        style["transStyle"] = json!({"backgroundPadding": 5});
        let trans = resolve_line_style(&style, LineKind::Translation, 1920, 1080, true);
        assert!((trans.font_size - 64.0).abs() < 1e-9);
        assert!((trans.background_pad_h - 5.0 * (64.0 / REFERENCE_FONT_SIZE) * 0.8).abs() < 1e-9);
        assert!((trans.background_pad_v - trans.background_pad_h / PLATE_PAD_ASPECT).abs() < 1e-9);
    }

    /// Strict whitelist: only the three strings `"top" | "center" | "bottom"` count; anything else is treated as absent.
    /// "Explicit center" and "absent" must be distinguishable, since only absence goes through the seam rule.
    #[test]
    fn vertical_align_only_accepts_the_three_legal_strings() {
        for (value, expected) in [
            (json!("top"), Some(VerticalAlign::Top)),
            (json!("center"), Some(VerticalAlign::Center)),
            (json!("bottom"), Some(VerticalAlign::Bottom)),
            (json!("middle"), None),
            (json!("Top"), None),
            (json!("BOTTOM"), None),
            (json!(""), None),
            (json!(1), None),
            (json!(true), None),
            (json!(null), None),
            (json!({"value": "top"}), None),
            (json!(["top"]), None),
        ] {
            assert_eq!(
                parse_vertical_align(Some(&value)),
                expected,
                "verticalAlign = {value} is not accepted by the allowlist"
            );
        }
        assert_eq!(parse_vertical_align(None), None);
    }

    /// Line-level vertical anchors follow the same discipline as line-level position: they read only partials and are consumed only in bilingual contexts.
    /// Reading them from the merged style would let the root node's block-level anchor pass as an explicit value on every line, and the seam rule would be pointless.
    #[test]
    fn line_vertical_align_reads_the_partial_in_a_bilingual_context_only() {
        let style = json!({
            "verticalAlign": "top",
            "origStyle": {"verticalAlign": "bottom"},
            "transStyle": {"verticalAlign": "oops"}
        });
        assert_eq!(
            line_vertical_align(&style, LineKind::Original, StudioMode::Bilingual),
            Some(VerticalAlign::Bottom)
        );
        // The root node's "top" must not leak into the translation line.
        assert_eq!(
            line_vertical_align(&style, LineKind::Translation, StudioMode::Bilingual),
            None
        );
        // Single-line export ignores stale line-level anchors.
        assert_eq!(
            line_vertical_align(&style, LineKind::Original, StudioMode::Original),
            None
        );
        assert_eq!(
            line_vertical_align(&style, LineKind::Original, StudioMode::Translated),
            None
        );
        let plain = json!({"verticalAlign": "bottom"});
        assert_eq!(
            line_vertical_align(&plain, LineKind::Original, StudioMode::Bilingual),
            None
        );
    }

    /// `x` and `y` must appear as a pair to count as a line-level override, and they are consumed only in bilingual contexts. Together these guard against two regressions: reading the root anchor from the merged style, and a single-line export being moved by an earlier bilingual placement.
    #[test]
    fn line_positions_need_both_axes_and_a_bilingual_context() {
        let style = json!({
            "x": 50, "y": 86,
            "origStyle": {"x": 30},
            "transStyle": {"x": 30, "y": 40}
        });
        assert_eq!(
            line_position_override(&style, LineKind::Original, StudioMode::Bilingual),
            None
        );
        assert_eq!(
            line_position_override(&style, LineKind::Translation, StudioMode::Bilingual),
            Some((30.0, 40.0))
        );
        assert_eq!(
            line_position_override(&style, LineKind::Translation, StudioMode::Translated),
            None
        );
        let plain = json!({"x": 50, "y": 86});
        assert_eq!(
            line_position_override(&plain, LineKind::Original, StudioMode::Bilingual),
            None
        );
        let nulled = json!({"x": 50, "y": 86, "origStyle": {"x": 30, "y": null}});
        assert_eq!(
            line_position_override(&nulled, LineKind::Original, StudioMode::Bilingual),
            None
        );
    }

    fn positioned_bilingual_document() -> Value {
        let mut document = document("None", "none");
        document["style"]["mode"] = json!("bi");
        document["style"]["displayTiming"] = json!({"leadIn": 0.1, "tail": 0.1});
        document["cues"] = json!([{
            "id": "q1", "start": 1.0, "end": 2.0, "text": "Hello world",
            "words": [
                {"text": "Hello", "t0": 1.0, "t1": 1.5},
                {"text": "world", "t0": 1.5, "t1": 2.0}
            ]
        }]);
        document["transCues"] = json!([{
            "id": "s1#0", "sid": "s1", "kind": "piece",
            "start": 1.0, "end": 2.0, "text": "你好世界"
        }]);
        document
    }

    fn burned_rgba(document: &Value) -> Vec<u8> {
        OverlayRenderPlan::compile(document, 640, 360, 3.0, 30.0, None)
            .unwrap()
            .render_rgba(1.5)
            .unwrap()
    }

    /// Regression guard: if only one axis is written, or both axes are left in single-line mode, the burned-in result must be byte-identical to the result when none of these keys exist.
    #[test]
    fn half_written_line_positions_leave_the_burn_in_byte_identical() {
        let base = positioned_bilingual_document();
        let baseline = burned_rgba(&base);

        for partial in [
            json!({"x": 18}),
            json!({"y": 22}),
            json!({"x": null, "y": 22}),
        ] {
            let mut document = base.clone();
            document["style"]["origStyle"] = partial.clone();
            assert_eq!(
                burned_rgba(&document),
                baseline,
                "a half-done line position {partial} must not move the burned-in subtitle"
            );
        }

        let mut single = base.clone();
        single["style"]["mode"] = json!("trans");
        let single_baseline = burned_rgba(&single);
        single["style"]["transStyle"] = json!({"x": 18, "y": 22});
        assert_eq!(burned_rgba(&single), single_baseline);
    }

    /// Pixel-level seam pinning: when one line wraps, it grows only on its own side, and the other line burned in at its original place does not move at all.
    ///
    /// Before the refactor, the whole stack was re-centred by its actual total height, so when the original text wrapped, the translation was pushed away. This assertion is the acceptance point on the burn-in path for bilingual subtitles' "changing one line does not move the other". Both `order` values are tested, because the wrapping line grows in opposite directions depending on whether it is above or below.
    #[test]
    fn a_wrapped_burned_line_grows_away_from_the_seam() {
        let rows = |document: &Value| {
            alpha_bbox(&burned_rgba(document), 640, 360)
                .expect("subtitle frame must have non-zero pixels")
                .rows
        };
        for (order, original_on_top) in [(json!("trans"), false), (json!("orig"), true)] {
            let mut flat = positioned_bilingual_document();
            flat["style"]["order"] = order.clone();
            let mut wrapped = flat.clone();
            // A hard line break splits the original text into two lines, while the translation's four Chinese characters remain one line.
            wrapped["cues"][0]["text"] = json!("Hello\nworld");
            let (pinned, pushed) = (rows(&flat), rows(&wrapped));
            if original_on_top {
                assert_eq!(
                    pinned.end, pushed.end,
                    "with order={order}, source wrapping pushed the translation line below away: {pinned:?} → {pushed:?}"
                );
                assert!(
                    pushed.start < pinned.start,
                    "with order={order}, the source did not grow upward: {pinned:?} → {pushed:?}"
                );
            } else {
                assert_eq!(
                    pinned.start, pushed.start,
                    "with order={order}, source wrapping pushed the translation line above away: {pinned:?} → {pushed:?}"
                );
                assert!(
                    pushed.end > pinned.end,
                    "with order={order}, the source did not grow downward: {pinned:?} → {pushed:?}"
                );
            }
        }
    }

    /// Pixel landing points for the three cases. Both lines overridden → each is centred independently. Only one line overridden → the other line collapses back to the single-line position at the anchor. Neither overridden → it still sits near the bottom anchor.
    #[test]
    fn line_positions_move_only_the_covered_burned_lines() {
        let base = positioned_bilingual_document();
        let rows = |document: &Value| {
            let rgba = burned_rgba(document);
            alpha_bbox(&rgba, 640, 360)
                .expect("subtitle frame must have non-zero pixels")
                .rows
        };

        // Neither overridden: the whole group still sits near the y=86% anchor.
        let stacked = rows(&base);
        assert!(stacked.start > 240, "the anchor stack must not move up: {stacked:?}");

        // Both overridden: one line in the top quarter and one in the bottom quarter, with nothing in between.
        let mut both = base.clone();
        both["style"]["origStyle"] = json!({"x": 25, "y": 15});
        both["style"]["transStyle"] = json!({"x": 75, "y": 85});
        let both_rows = rows(&both);
        assert!(
            both_rows.start < 90,
            "the covered source line did not move up: {both_rows:?}"
        );
        assert!(both_rows.end > 280, "the covered translation line did not move down: {both_rows:?}");

        // Only the original line overridden: the translation line's stack holds only itself, so it must match the landing point of single-line mode exactly.
        let mut only_original = base.clone();
        only_original["style"]["origStyle"] = json!({"x": 25, "y": 15});
        let mixed = burned_rgba(&only_original);
        let lifted = alpha_bbox(&mixed, 640, 360).expect("subtitle frame must have non-zero pixels");
        assert!(lifted.rows.start < 90, "the source line did not leave the stack: {lifted:?}");

        let mut translation_only = base.clone();
        translation_only["style"]["mode"] = json!("trans");
        let solo = burned_rgba(&translation_only);
        let solo_box = alpha_bbox(&solo, 640, 360).expect("subtitle frame must have non-zero pixels");
        // The translation line's pixels are byte-identical to single-line mode. Compare only the rows that contain the translation.
        let band = |rgba: &[u8], rows: std::ops::Range<usize>| {
            rgba[rows.start * 640 * 4..rows.end * 640 * 4].to_vec()
        };
        assert_eq!(
            band(&mixed, solo_box.rows.clone()),
            band(&solo, solo_box.rows.clone()),
            "uncovered translation lines must collapse back to a single-line anchor"
        );
    }

    /// Cross-platform convention: `width`, `scale`, `rotation` and transitions remain whole-group properties, with the pivot at the global anchor.
    /// An overridden line merely has a different landing point and still follows the same group transform. So the farther a line is from the anchor, the more it is pulled during a transition. This is not an implementation detail; it is a trade-off that all three platforms must keep consistent.
    #[test]
    fn floating_lines_still_ride_the_group_transition() {
        let mut document = positioned_bilingual_document();
        document["style"]["transition"] =
            json!({"transitionId": "magic-pop", "transitionSpeed": 50});
        document["style"]["origStyle"] = json!({"x": 25, "y": 15});

        let mut plan = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        // The display window starts at 0.9 (cue 1.0 minus leadIn 0.1); magic-pop@50 lasts 0.1s.
        let opening = plan.render_rgba(0.9).unwrap();
        let settled = plan.render_rgba(1.5).unwrap();
        let opening_box = alpha_bbox(&opening, 640, 360).expect("the first transition frame must have non-zero pixels");
        let settled_box = alpha_bbox(&settled, 640, 360).expect("the settled frame must have non-zero pixels");

        assert!(
            opening_box.rows.start > settled_box.rows.start + 20,
            "floating lines must be pulled toward the anchor by the pivot during the transition: {opening_box:?} vs {settled_box:?}"
        );
        assert!(
            opening_box.cols.start > settled_box.cols.start,
            "the horizontal extent of floating lines must also scale with the group: {opening_box:?} vs {settled_box:?}"
        );
    }

    #[test]
    fn glow_blurs_only_the_effect_layer_and_keeps_solid_glyphs_crisp() {
        let mut plain_document = document("None", "none");
        plain_document["style"]["background"] = json!(false);
        plain_document["style"]["outline"] = json!(false);
        let mut plain =
            OverlayRenderPlan::compile(&plain_document, 640, 360, 3.0, 30.0, None).unwrap();
        let plain_rgba = plain.render_rgba(1.0).unwrap();

        let mut glow_document = plain_document;
        glow_document["style"]["glow"] = json!({
            "on": true, "color": "#FF0000", "intensity": 100, "range": 100
        });
        let mut glow =
            OverlayRenderPlan::compile(&glow_document, 640, 360, 3.0, 30.0, None).unwrap();
        let glow_rgba = glow.render_rgba(1.0).unwrap();

        let solid_glyphs = plain_rgba
            .chunks_exact(4)
            .zip(glow_rgba.chunks_exact(4))
            .filter(|(plain, _)| plain[3] == 255)
            .collect::<Vec<_>>();
        assert!(solid_glyphs.len() > 100);
        assert!(solid_glyphs.iter().all(|(plain, glowing)| plain == glowing));
        assert!(
            glow_rgba
                .chunks_exact(4)
                .zip(plain_rgba.chunks_exact(4))
                .any(|(glowing, plain)| glowing[0] > plain[0] && glowing[3] > plain[3])
        );
    }

    #[test]
    fn premultiplied_effect_layer_composites_under_crisp_text() {
        let mut destination = [128, 0, 0, 128];
        composite_premultiplied_rgba(
            &mut destination,
            &[0, 0, 128, 128],
            1,
            &ContentBox {
                rows: 0..1,
                cols: 0..1,
            },
        );
        assert_eq!(destination, [63, 0, 128, 191]);
    }

    #[test]
    fn caption_composite_modes_read_the_real_bgra_backdrop() {
        let source = [128, 128, 128, 255];
        for (mode, expected) in [
            (CaptionCompositeMode::Normal, 128),
            (CaptionCompositeMode::Difference, 64),
            (CaptionCompositeMode::Exclusion, 128),
            (CaptionCompositeMode::Screen, 160),
        ] {
            let mut target = [64, 64, 64, 255];
            composite_caption_pixel_bgra(&mut target, &source, mode);
            assert_eq!(target, [expected, expected, expected, 255], "{mode:?}");
        }

        let mut translucent = [64, 64, 64, 255];
        composite_caption_pixel_bgra(
            &mut translucent,
            &[64, 64, 64, 128],
            CaptionCompositeMode::Screen,
        );
        assert_eq!(translucent, [112, 112, 112, 255]);
    }

    #[test]
    fn difference_caption_is_composited_against_the_video_frame() {
        let mut plan = OverlayRenderPlan::compile(
            &designed_layout_document("caption-blend-difference"),
            320,
            180,
            3.0,
            30.0,
            None,
        )
        .unwrap();
        let overlay = plan.render_rgba(0.8).unwrap();
        let sample = overlay
            .chunks_exact(4)
            .position(|pixel| pixel[3] > 240)
            .expect("difference recipe should produce nearly opaque glyph pixels");
        let source = &overlay[sample * 4..sample * 4 + 4];
        let mut expected = [32_u8, 64, 96, 255];
        composite_caption_pixel_bgra(&mut expected, source, CaptionCompositeMode::Difference);

        let mut dark = vec![32_u8, 64, 96, 255].repeat(320 * 180);
        plan.composite_bgra(&mut dark, 320 * 4, 0.8).unwrap();
        let dark_changed = dark
            .chunks_exact(4)
            .filter(|pixel| *pixel != [32, 64, 96, 255])
            .count();
        assert!(dark_changed > 100);
        assert_eq!(&dark[sample * 4..sample * 4 + 4], &expected);
    }

    /// CPU export (`composite_bgra`) and the GPU scene share the same layer order: element → subtitle → template foreground. An element that covers the whole frame (as happens when the main video is turned into an element) must not hide the subtitles. For non-normal subtitles, the background is "video + element", the same sampling convention the GPU uses when sampling per target.
    #[test]
    fn cpu_composite_keeps_captions_above_full_canvas_elements() {
        let full_canvas_element = json!({"tracks": [{"elements": [{
            "id": "cover", "kind": "shape", "start": 0.0, "end": 3.0,
            "shape": {"shape": "rect", "fill": "#FF0000"},
            "place": {"x": 50, "y": 50, "w": 100}
        }]}]});
        for (source, mode) in [
            (document("None", "none"), CaptionCompositeMode::Normal),
            (
                designed_layout_document("caption-blend-difference"),
                CaptionCompositeMode::Difference,
            ),
        ] {
            let caption = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None)
                .unwrap()
                .render_rgba(0.8)
                .unwrap();
            let sample = caption
                .chunks_exact(4)
                .position(|pixel| pixel[3] > 240)
                .expect("subtitles should have nearly opaque pixels");

            let mut covered = source.clone();
            covered["timeline"] = full_canvas_element.clone();
            let mut backdrop_source = covered.clone();
            backdrop_source["cues"] = json!([]);
            let mut backdrop_plan =
                OverlayRenderPlan::compile(&backdrop_source, 320, 180, 3.0, 30.0, None).unwrap();
            backdrop_plan
                .load_projected_timeline_elements(&backdrop_source)
                .unwrap();
            let mut backdrop = vec![32_u8, 64, 96, 255].repeat(320 * 180);
            backdrop_plan
                .composite_bgra(&mut backdrop, 320 * 4, 0.8)
                .unwrap();
            assert_eq!(
                &backdrop[sample * 4..sample * 4 + 4],
                &[0, 0, 255, 255],
                "the element should cover the frame"
            );

            let mut plan = OverlayRenderPlan::compile(&covered, 320, 180, 3.0, 30.0, None).unwrap();
            plan.load_projected_timeline_elements(&covered).unwrap();
            let mut frame = vec![32_u8, 64, 96, 255].repeat(320 * 180);
            plan.composite_bgra(&mut frame, 320 * 4, 0.8).unwrap();
            let mut expected = [0_u8, 0, 255, 255];
            composite_caption_pixel_bgra(
                &mut expected,
                &caption[sample * 4..sample * 4 + 4],
                mode,
            );
            assert_ne!(expected, [0, 0, 255, 255], "{mode:?}");
            assert_eq!(&frame[sample * 4..sample * 4 + 4], &expected, "{mode:?}");
        }
    }

    #[test]
    fn render_plan_draws_styled_word_animation() {
        let mut plan = OverlayRenderPlan::compile(
            &document("Highlight", "magic-pop"),
            640,
            360,
            3.0,
            30.0,
            None,
        )
        .unwrap();
        let rgba = plan.render_rgba(0.8).unwrap();
        assert_eq!(rgba.len(), 640 * 360 * 4);
        assert!(rgba.chunks_exact(4).any(|pixel| pixel[3] > 0));
        assert!(
            rgba.chunks_exact(4).any(|pixel| {
                pixel[0] > 180 && pixel[1] > 120 && pixel[2] < 100 && pixel[3] > 0
            })
        );
        let bounds = rgba
            .chunks_exact(4)
            .enumerate()
            .filter(|(_, pixel)| pixel[3] > 0)
            .fold(
                None::<(usize, usize, usize, usize)>,
                |bounds, (index, _)| {
                    let point = (index % 640, index / 640);
                    Some(match bounds {
                        None => (point.0, point.1, point.0, point.1),
                        Some((left, top, right, bottom)) => (
                            left.min(point.0),
                            top.min(point.1),
                            right.max(point.0),
                            bottom.max(point.1),
                        ),
                    })
                },
            );
        // The plate's vertical inner padding is pad_h ÷ 1.4 (prototype `panel-substyle.jsx`'s `padOf`: horizontally 1.4 times wider than vertically), no longer pad_h × 0.45. So the bounding box is 2px taller at the top and bottom than in the previous version. The glyph placement has not changed: for a single-line block centred on the anchor, pad_v cancels out top and bottom.
        assert_eq!(bounds, Some((255, 293, 384, 325)));
        // After the outline width's basis changed (`textOutline.width` is the visible outward spread, so the centred stroke width is multiplied by 0.5), the glyph outline became half as thick. This round, to align the geometry with the prototype, the plate's vertical inner padding changed (pad_h ÷ 1.4), letter spacing scales with this line's font size, and the shadow blur is no longer clamped to 0.9·font size. The pixels were recomputed accordingly.
        assert_eq!(
            lower_hex(&Sha256::digest(&rgba)),
            "86559b4099654620b8a690e0cda9dfcb171128e13f5b77a5ca01a24833ab6bc9"
        );
    }

    #[test]
    fn block_motion_hides_background_and_shadow_together_at_entry() {
        let mut doc = document("flipClock", "none");
        doc["style"]["wordAnimation"]["catalogId"] = json!("flipClock");
        doc["style"]["displayTiming"] = json!({"leadIn":0,"tail":0});
        doc["style"]["dropShadow"] = json!({"on":true,"color":"#000000","blur":0.1,"distance":0.1});
        let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        assert!(
            plan.render_rgba(0.5)
                .unwrap()
                .chunks_exact(4)
                .all(|p| p[3] == 0)
        );
        assert!(
            plan.render_rgba(0.9)
                .unwrap()
                .chunks_exact(4)
                .any(|p| p[3] != 0)
        );
    }

    #[test]
    fn word_motion_block_scale_uses_both_axes_and_centering_preserves_the_pivot() {
        let mut pose = word_motion::Pose {
            scale: 1.5,
            block_scaled: true,
            ..Default::default()
        };
        let mut point = tiny_skia::Point::from_xy(20.0, 10.0);
        word_transform_for_motion(&pose, 20.0, 10.0, 50.0, 30.0, 20.0).map_point(&mut point);
        assert_eq!(point, tiny_skia::Point::from_xy(5.0, 0.0));
        pose.centered = true;
        pose.scale = 0.88;
        let mut point = tiny_skia::Point::from_xy(20.0, 10.0);
        word_transform_for_motion(&pose, 20.0, 10.0, 50.0, 30.0, 20.0).map_point(&mut point);
        assert!((point.x - 50.0).abs() < 1e-5 && (point.y - 30.0).abs() < 1e-5);
    }

    #[test]
    fn every_catalog_motion_has_a_retained_gpu_scene_and_seek_safe_cpu_reference() {
        for anim in word_motion::WORD_ANIM_TRACKS
            .iter()
            .filter(|a| a.catalog_id != "none")
        {
            let id = anim.catalog_id;
            let mut doc = document(id, "none");
            doc["style"]["wordAnimation"] = json!({"animationName": id, "catalogId": id,
                "active": {"color":"#635bff", "backgroundColor":"#635bff"}});
            doc["style"]["background"] = json!(false);
            doc["style"]["displayTiming"] = json!({"leadIn":0,"tail":0});
            let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
            assert_eq!(
                plan.subtitle_scene_static_fallback(),
                None,
                "{id} must not force the whole preview onto CPU"
            );
            let early_scene = plan
                .subtitle_scene_frame(0.54)
                .unwrap_or_else(|fallback| panic!("{id} GPU scene: {fallback}"));
            let later_scene = plan
                .subtitle_scene_frame(1.6)
                .unwrap_or_else(|fallback| panic!("{id} later GPU scene: {fallback}"));
            assert!(
                !early_scene.scene.nodes.is_empty(),
                "{id} GPU scene disappeared"
            );
            assert!(
                !later_scene.scene.nodes.is_empty(),
                "{id} later GPU scene disappeared"
            );
            assert_ne!(
                early_scene.scene.fingerprint, later_scene.scene.fingerprint,
                "{id} GPU scene identity must follow its per-frame motion"
            );
            let early = plan.render_rgba(0.54).unwrap();
            let later = plan.render_rgba(1.6).unwrap();
            assert_ne!(early, later, "{id} must animate between keyframes");
            assert!(later.chunks_exact(4).any(|p| p[3] != 0), "{id} disappeared");
            let png = plan.render_png(1.6).unwrap();
            assert_eq!(
                Pixmap::decode_png(&png.png).unwrap().data(),
                later.as_slice(),
                "{id}: export"
            );
            plan.render_rgba(1.8).unwrap();
            assert_eq!(
                plan.render_rgba(0.54).unwrap(),
                early,
                "{id}: seeking must be deterministic"
            );
            let mut cold = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
            assert_eq!(
                cold.render_rgba(1.6).unwrap(),
                later,
                "{id}: cache must not freeze motion"
            );
        }
    }

    /// The explicit raster delivery port kept for the browser must have a shape that `putImageData` can consume directly (straight alpha plus a non-zero sub-rectangle). Published styles should all go through the GPU scene. This entry serves only runtime fallbacks such as invalid glyphs or scene limits, and catalogue styles must no longer trigger it.
    #[test]
    fn browser_raster_layer_is_the_straight_alpha_subrect_of_the_cpu_subtitle_frame() {
        let mut doc = document("boxHighlight", "none");
        doc["style"]["wordAnimation"] = json!({
            "animationName": "boxHighlight", "catalogId": "boxHighlight",
            "active": {"color": "#FFFFFF", "backgroundColor": "#6147FF"}
        });
        let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(plan.subtitle_scene_static_fallback(), None);

        let premultiplied = plan.render_subtitle_frame(0.54).unwrap();
        let bounds = premultiplied.bounds.clone().expect("the subtitle must have pixels at this moment");
        let layer = plan.render_subtitle_raster_layer(0.54).unwrap();
        assert_eq!(layer.key, premultiplied.key);
        assert_eq!(layer.composite, CaptionCompositeMode::Normal);
        assert_eq!(
            (layer.x as usize, layer.y as usize),
            (bounds.cols.start, bounds.rows.start)
        );
        assert_eq!(layer.width as usize, bounds.cols.end - bounds.cols.start);
        assert_eq!(layer.height as usize, bounds.rows.end - bounds.rows.start);
        assert_eq!(
            layer.rgba.len(),
            layer.width as usize * layer.height as usize * 4
        );

        // Pixel-by-pixel alignment: alpha stays unchanged and only the colour channels may be amplified. If not a single semi-transparent edge was amplified, un-premultiplication was not done, and that would draw a dark outline on every anti-aliased glyph edge.
        let mut lifted = 0usize;
        for row in 0..layer.height as usize {
            for col in 0..layer.width as usize {
                let source = ((bounds.rows.start + row) * 320 + bounds.cols.start + col) * 4;
                let target = (row * layer.width as usize + col) * 4;
                assert_eq!(layer.rgba[target + 3], premultiplied.rgba[source + 3]);
                for channel in 0..3 {
                    assert!(layer.rgba[target + channel] >= premultiplied.rgba[source + channel]);
                }
                let alpha = premultiplied.rgba[source + 3];
                if (1..255).contains(&alpha)
                    && (0..3).any(|c| layer.rgba[target + c] > premultiplied.rgba[source + c])
                {
                    lifted += 1;
                }
            }
        }
        assert!(lifted > 0, "no semi-transparent pixel was un-premultiplied; un-premultiply had no effect");

        // Asking the same question at the same moment must yield byte-identical results (the host uses the key to decide whether it can keep the previous frame bitmap).
        let again = plan.render_subtitle_raster_layer(0.54).unwrap();
        assert_eq!(again.key, layer.key);
        assert_eq!(again.rgba, layer.rgba);

        // The key must advance frame by frame **within the same word**. The host's `unchanged` looks only at the key. If the key were identified by (cue, current word), every frame after the first would be `unchanged`, so the subtitle would show but its animation would freeze. That is a fake fix that a static screenshot cannot reveal. Word-level animation is exactly why `motion_id.is_some()` also lights `word_box_animated`, so the cache key carries the frame number.
        let mid_word = plan.render_subtitle_raster_layer(1.5).unwrap();
        let late_word = plan.render_subtitle_raster_layer(2.0).unwrap();
        assert_ne!(
            mid_word.key, late_word.key,
            "the key is unchanged within the same word, so the host would freeze the whole animation on its first frame"
        );
        assert_ne!(
            mid_word.rgba, late_word.rgba,
            "pixels are unchanged within the same word, so the per-word animation is not moving at all"
        );

        // At a transparent moment, deliver an empty layer rather than a whole transparent buffer (the host uses this to drop the layer entirely).
        doc["style"]["displayTiming"] = json!({"leadIn": 0, "tail": 0});
        doc["cues"][0]["start"] = json!(1.5);
        let mut quiet = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        let blank = quiet.render_subtitle_raster_layer(0.2).unwrap();
        assert_eq!((blank.width, blank.height), (0, 0));
        assert!(blank.rgba.is_empty());
    }

    fn emphasis_document(look: Option<Value>, emphasis: Option<Value>) -> Value {
        let mut doc = document("None", "none");
        doc["cues"][0]["words"][0]["id"] = json!("w1");
        doc["cues"][0]["words"][1]["id"] = json!("w2");
        if let Some(look) = look {
            doc["style"]["emphasisLook"] = look;
        }
        if let Some(emphasis) = emphasis {
            doc["style"]["captionEmphasis"] = emphasis;
        }
        doc
    }

    /// Opaque, saturated `#FF00AA`-ish pixels.
    fn magenta_pixels(rgba: &[u8]) -> usize {
        rgba.chunks_exact(4)
            .filter(|p| p[3] == 255 && p[0] > 230 && p[1] < 40 && (140..200).contains(&p[2]))
            .count()
    }

    #[test]
    fn emphasis_look_recolours_and_widens_emphasised_words_in_line_captions() {
        let plain = emphasis_document(None, None);
        let styled = emphasis_document(
            Some(json!({"color": "#FF00AA", "bold": true, "scale": 1.4})),
            Some(json!({"w2": {"anchorText": "world", "role": "emphasis"}})),
        );
        let mut base = OverlayRenderPlan::compile(&plain, 640, 360, 3.0, 30.0, None).unwrap();
        let mut plan = OverlayRenderPlan::compile(&styled, 640, 360, 3.0, 30.0, None).unwrap();
        let chunks = |plan: &mut OverlayRenderPlan| {
            plan.active_layouts(1.5)[0].lines[0]
                .chunks
                .iter()
                .map(|chunk| {
                    (
                        chunk.word,
                        chunk.width,
                        chunk.font_size,
                        chunk.color,
                        chunk.metric_scale,
                    )
                })
                .collect::<Vec<_>>()
        };
        let (before, after) = (chunks(&mut base), chunks(&mut plan));
        let word = |chunks: &[(Option<usize>, f64, f64, Option<SubtitleColor>, f64)], index| {
            chunks
                .iter()
                .copied()
                .find(|chunk| chunk.0 == Some(index))
                .unwrap()
        };
        // The first word is untouched; the emphasised one is 1.4× and wider.
        assert_eq!(word(&before, 0), word(&after, 0));
        let (plain_world, styled_world) = (word(&before, 1), word(&after, 1));
        assert!((styled_world.2 - plain_world.2 * 1.4).abs() < 1e-9);
        assert!(
            styled_world.1 > plain_world.1 * 1.3,
            "{styled_world:?} vs {plain_world:?}"
        );
        assert_eq!(styled_world.3, parse_css_color("#FF00AA"));
        assert_eq!(styled_world.4, 1.4);
        let line_width = |plan: &mut OverlayRenderPlan| plan.active_layouts(1.5)[0].lines[0].width;
        assert!(line_width(&mut plan) - line_width(&mut base) > plain_world.1 * 0.3);
        // The scaled word sits on the same baseline as its neighbour.
        let layout = plan.active_layouts(1.5).remove(0);
        let line = &layout.lines[0];
        let baselines = line
            .chunks
            .iter()
            .filter(|chunk| chunk.word.is_some())
            .map(|chunk| glyph_baseline(0.0, line.height, chunk, 0.0))
            .collect::<Vec<_>>();
        assert!((baselines[0] - baselines[1]).abs() < 1e-6, "{baselines:?}");

        assert_eq!(
            magenta_pixels(&base.render_subtitle_frame(1.5).unwrap().rgba),
            0
        );
        assert!(magenta_pixels(&plan.render_subtitle_frame(1.5).unwrap().rgba) > 100);
        // The GPU scene path paints the same per-word fill.
        let magenta_uniform = "color: [1.0, 0.0, 0.6666667, 1.0]";
        let scene = |plan: &mut OverlayRenderPlan| {
            format!(
                "{:?}",
                plan.subtitle_scene_frame(1.5)
                    .expect("GPU scene")
                    .scene
                    .nodes
            )
        };
        assert!(!scene(&mut base).contains(magenta_uniform));
        assert!(scene(&mut plan).contains(magenta_uniform));
        // The animated GPU path too: under a Color animation the unspoken
        // emphasised word keeps its own fill while "Hello" is active.
        let mut animated = styled.clone();
        animated["style"]["wordAnimation"] = json!({"animationName": "Color"});
        let mut animated =
            OverlayRenderPlan::compile(&animated, 640, 360, 3.0, 30.0, None).unwrap();
        let nodes = format!(
            "{:?}",
            animated
                .subtitle_scene_frame(0.9)
                .expect("animated GPU scene")
                .scene
                .nodes
        );
        assert!(nodes.contains(magenta_uniform));

        // A per-word colour in `captionEmphasis` wins over the look colour; hero
        // grows a little more than emphasis.
        let hero = emphasis_document(
            Some(json!({"color": "#FF00AA", "scale": 1.2})),
            Some(json!({"w2": {"role": "hero", "color": "#00FF66"}})),
        );
        let mut hero = OverlayRenderPlan::compile(&hero, 640, 360, 3.0, 30.0, None).unwrap();
        let hero_world = word(&chunks(&mut hero), 1);
        assert_eq!(hero_world.3, parse_css_color("#00FF66"));
        assert!((hero_world.4 - 1.2 * EMPHASIS_LOOK_HERO_FACTOR).abs() < 1e-9);
        assert_eq!(
            magenta_pixels(&hero.render_subtitle_frame(1.5).unwrap().rgba),
            0
        );

        // Scale is clamped to the documented range.
        let big = emphasis_document(
            Some(json!({"scale": 9})),
            Some(json!({"w2": {"role": "hero"}})),
        );
        let mut big = OverlayRenderPlan::compile(&big, 640, 360, 3.0, 30.0, None).unwrap();
        assert_eq!(word(&chunks(&mut big), 1).4, EMPHASIS_LOOK_SCALE_RANGE.1);
    }

    #[test]
    fn emphasis_look_is_inert_without_the_look_and_under_designed_captions() {
        let plain = emphasis_document(None, None);
        let roles_only = emphasis_document(
            None,
            Some(json!({"w2": {"role": "hero", "color": "#FF00AA"}})),
        );
        let normal_role = emphasis_document(
            Some(json!({"color": "#FF00AA", "scale": 1.4})),
            Some(json!({"w2": {"role": "normal"}})),
        );
        let mut base = OverlayRenderPlan::compile(&plain, 640, 360, 3.0, 30.0, None).unwrap();
        for doc in [&roles_only, &normal_role] {
            let mut plan = OverlayRenderPlan::compile(doc, 640, 360, 3.0, 30.0, None).unwrap();
            assert!(plan.active_layouts(1.5)[0].style.emphasis.is_none());
            for time in [0.6, 1.5, 2.4] {
                assert_eq!(
                    plan.render_subtitle_frame(time).unwrap().rgba,
                    base.render_subtitle_frame(time).unwrap().rgba,
                    "emphasis changed pixels at {time}"
                );
            }
        }
        // Designed captions keep their own emphasis channel.
        let mut designed = emphasis_document(
            Some(json!({"color": "#FF00AA", "scale": 1.4})),
            Some(json!({"w2": {"role": "hero"}})),
        );
        designed["style"]["wordAnimation"]["caption"] = json!({
            "schema": 1, "style": {"id": "caption-highlight", "version": 1}, "content": "orig"
        });
        assert!(emphasis_look(&designed["style"]).is_none());
        let line = resolve_line_style(&designed["style"], LineKind::Original, 640, 360, false);
        assert!(line.emphasis.is_none());
    }
    #[test]
    fn designed_caption_palette_tuning_and_word_roles_reach_the_renderer() {
        let mut styled = document("None", "none");
        styled["cues"][0]["words"][0]["id"] = json!("w1");
        styled["cues"][0]["words"][1]["id"] = json!("w2");
        styled["style"]["wordAnimation"]["caption"] = json!({
            "schema": 1,
            "style": {"id": "caption-highlight", "version": 1},
            "content": "orig",
            "palette": {"primary": "#EAEAEA", "accent": "#00FF66"},
            "intensity": 80,
            "speed": 1.5
        });
        styled["style"]["captionEmphasis"] = json!({
            "w2": {"anchorText":"world", "role":"hero", "color":"#FF00AA"}
        });

        let animation = word_animation(&styled["style"]);
        assert_eq!(animation.name, "Designed");
        let design = animation.caption.as_ref().unwrap();
        assert_eq!(design.style_id, "caption-highlight");
        assert_eq!(design.speed, 1.5);
        assert_eq!(design.intensity, 0.8);
        assert_eq!(design.overrides["w2"].role, "hero");

        let items = timed_items(
            styled["cues"].as_array().unwrap(),
            "text",
            &styled["style"],
            "und",
        );
        let active = word_visual(&animation, &items[0], 0, 0, 0.8, 30.0);
        assert_eq!(active.background, parse_css_color("#00FF66"));
        assert_eq!(active.color, parse_css_color("#00FF66"));
        let hero = word_visual(&animation, &items[0], 1, 0, 0.8, 30.0);
        assert_eq!(hero.color, parse_css_color("#FF00AA"));
        assert_eq!(
            hero.recipe.as_ref().map(|value| value.role.as_str()),
            Some("hero")
        );

        let mut designed = OverlayRenderPlan::compile(&styled, 640, 360, 3.0, 30.0, None).unwrap();
        let mut plain =
            OverlayRenderPlan::compile(&document("None", "none"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        assert_ne!(
            designed.render_rgba(0.8).unwrap(),
            plain.render_rgba(0.8).unwrap(),
            "Designed Caption must not show a selected state only in the panel"
        );
        assert_ne!(
            designed.render_png(0.80).unwrap().subtitle_key,
            designed.render_png(0.84).unwrap().subtitle_key,
            "during attack the frame must be invalidated per frame, so speed/intensity actually reach the picture"
        );
    }

    #[test]
    fn designed_caption_gradient_and_texture_use_native_pattern_paints() {
        let make = |style_id: &str, options: Value| {
            let style = json!({
                "wordAnimation": {
                    "caption": {
                        "schema": 1,
                        "style": {"id": style_id, "version": 1},
                        "content": "orig",
                        "palette": {"primary": "#FFFFFF", "accent": "#FFD43B"},
                        "options": options
                    }
                }
            });
            let animation = word_animation(&style);
            let source = document("None", "none");
            let items = timed_items(source["cues"].as_array().unwrap(), "text", &style, "und");
            let visual = word_visual(&animation, &items[0], 0, 0, 0.8, 30.0);
            (animation, visual)
        };

        let (gradient, gradient_visual) = make("caption-gradient-fill", json!([]));
        let gradient_paint = caption_recipe_glyph_paint(
            &gradient,
            &gradient_visual,
            SubtitleColor::WHITE,
            1.0,
            true,
        )
        .unwrap();
        assert!(matches!(
            gradient_paint.shader,
            tiny_skia::Shader::LinearGradient(_)
        ));

        let (texture, texture_visual) = make(
            "caption-texture",
            json!([{"kind":"text", "key":"texture", "text":"wood"}]),
        );
        let texture_paint =
            caption_recipe_glyph_paint(&texture, &texture_visual, SubtitleColor::WHITE, 1.0, true)
                .unwrap();
        assert!(matches!(
            texture_paint.shader,
            tiny_skia::Shader::Pattern(_)
        ));
    }

    #[test]
    fn unavailable_or_non_original_designed_caption_never_falls_back_to_basic() {
        for (style_id, content) in [
            ("caption-not-installed", "orig"),
            ("caption-highlight", "trans"),
        ] {
            let style = json!({
                "wordAnimation": {
                    "caption": {
                        "schema": 1,
                        "style": {"id": style_id, "version": 1},
                        "content": content
                    }
                }
            });
            let animation = word_animation(&style);
            let source = document("None", "none");
            let items = timed_items(source["cues"].as_array().unwrap(), "text", &style, "und");
            let visual = word_visual(&animation, &items[0], 0, 0, 0.8, 30.0);
            assert_eq!(visual.opacity, Some(0.0));
        }
    }

    #[test]
    fn all_sixteen_designed_caption_recipes_render_seek_safe_pixels() {
        for descriptor in caption_recipe_descriptors() {
            let mut styled = document("None", "none");
            styled["cues"][0]["words"][0]["id"] = json!("w1");
            styled["cues"][0]["words"][1]["id"] = json!("w2");
            styled["style"]["wordAnimation"]["caption"] = json!({
                "schema": 1,
                "style": {"id": descriptor.id, "version": descriptor.version},
                "content": "orig",
                "palette": {"primary": "#FFFFFF", "accent": "#FFD43B"},
                "intensity": 60,
                "speed": 1,
                "seed": 42
            });
            styled["style"]["captionEmphasis"] = json!({
                "w1": {"anchorText":"Hello", "role":"hero"}
            });
            let mut first = OverlayRenderPlan::compile(&styled, 640, 360, 3.0, 30.0, None).unwrap();
            let mut second =
                OverlayRenderPlan::compile(&styled, 640, 360, 3.0, 30.0, None).unwrap();
            let first = first.render_rgba(0.8).unwrap();
            let second = second.render_rgba(0.8).unwrap();
            assert_eq!(first, second, "{} must be seek-safe", descriptor.id);
            assert!(
                first.chunks_exact(4).any(|pixel| pixel[3] != 0),
                "{} must not render an empty frame",
                descriptor.id
            );
        }
    }

    /// Daoyazi (倒鸭子) end-to-end: the `caption-daoyazi` style makes `OverlayRenderPlan` take over the original-text track. Both the CPU and GPU paths draw the sequence layer (cropped to the subtitle area), and it is seek-safe. The translation line still goes through cue-level layout.
    #[test]
    fn daoyazi_sequence_takes_over_the_original_track_on_both_render_paths() {
        let mut styled = document("None", "none");
        styled["cues"][0]["words"][0]["id"] = json!("w1");
        styled["cues"][0]["words"][1]["id"] = json!("w2");
        styled["style"]["wordAnimation"]["caption"] = json!({
            "schema": 1,
            "style": {"id": "caption-daoyazi", "version": 1},
            "content": "orig",
            "palette": {"primary": "#FFFFFF", "accent": "#FF9B42", "secondary": "#59BAF2"},
            "intensity": 60,
            "speed": 1,
            "seed": 137,
            "options": [{
                "kind": "object",
                "key": "daoyazi",
                "value": {"camera": {"motion": "stopAndGo"}, "presentation": {"viewportMode": "full"}}
            }]
        });
        let compile = || OverlayRenderPlan::compile(&styled, 640, 360, 3.0, 30.0, None).unwrap();
        let mut plan = compile();
        assert!(plan.caption_sequence_active());
        let sequence = plan.ensure_caption_sequence().expect("sequence plan");
        assert!(!sequence.sequences.is_empty(), "{:?}", sequence.diagnostics);
        assert_eq!(sequence.seed, 137);
        assert!(
            plan.active_layouts(0.8).is_empty(),
            "after takeover, source lines no longer go through cue-level layout"
        );

        let frame = plan.render_subtitle_frame(0.8).unwrap();
        assert!(frame.key.starts_with("dz"), "{}", frame.key);
        assert!(
            frame.rgba.chunks_exact(4).any(|pixel| pixel[3] != 0),
            "the sequence layer must not be an empty frame"
        );
        let bounds = frame.bounds.clone().expect("stroke bounding box");
        let [vx, vy, vw, vh] = sequence.viewport;
        assert!(
            bounds.cols.start as f64 >= vx.floor() && bounds.cols.end as f64 <= (vx + vw).ceil()
        );
        assert!(
            bounds.rows.start as f64 >= vy.floor() && bounds.rows.end as f64 <= (vy + vh).ceil()
        );
        let again = compile().render_subtitle_frame(0.8).unwrap();
        assert_eq!(again.key, frame.key);
        assert_eq!(*again.rgba, *frame.rgba, "seek-safe");
        assert_eq!(
            *plan.render_subtitle_frame(0.8).unwrap().rgba,
            *frame.rgba,
            "cache hit on the same frame"
        );

        let scene = plan.subtitle_scene_frame(0.8).expect("sequence layer goes through the GPU scene");
        let runs: Vec<_> = scene
            .scene
            .nodes
            .iter()
            .filter_map(|node| match node {
                element_draw::SceneNode::Glyphs(run) => Some(run),
                _ => None,
            })
            .collect();
        assert!(!runs.is_empty(), "the scene must carry sequence-layer glyph runs");
        assert!(
            runs.iter()
                .all(|run| run.uniforms.iter().all(|uniform| uniform.clip.is_some())),
            "every uniform of the sequence layer is clipped to the subtitle area"
        );
        assert!(scene.key.starts_with("dz"), "{}", scene.key);
        assert!(scene.scene.next_change.is_some_and(|next| next > 0.8));
    }

    fn designed_layout_document(style_id: &str) -> Value {
        let mut styled = document("None", "none");
        styled["cues"][0]["words"][0]["id"] = json!("w1");
        styled["cues"][0]["words"][1]["id"] = json!("w2");
        styled["style"]["wordAnimation"]["caption"] = json!({
            "schema": 1,
            "style": {"id": style_id, "version": 1},
            "content": "orig",
            "palette": {"primary": "#FFFFFF", "accent": "#FFD43B"}
        });
        styled
    }

    #[test]
    fn every_bundled_caption_recipe_has_exact_scene_ownership_or_target_sampling_only() {
        for descriptor in caption_recipe_descriptors() {
            let mut source = designed_layout_document(&descriptor.id);
            source["style"]["background"] = json!(false);
            source["style"]["outline"] = json!(false);
            source["style"]["underline"] = json!(false);
            source["style"]["glow"] = json!({"on": false});
            source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
            let plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None)
                .unwrap_or_else(|error| panic!("compile {}: {error}", descriptor.id));

            if descriptor.id == "caption-blend-difference" {
                assert_eq!(
                    plan.subtitle_scene_static_fallback(),
                    Some(SubtitleSceneFallback::CompositeMode),
                    "public overlay scene cannot sample the video backdrop"
                );
            } else {
                assert_eq!(
                    plan.subtitle_scene_static_fallback(),
                    None,
                    "{} must have an exact retained scene",
                    descriptor.id
                );
            }
            plan.compositor_scene_support().unwrap_or_else(|error| {
                panic!(
                    "{} must be supported when the host provides target sampling: {error}",
                    descriptor.id
                )
            });
        }
    }

    #[cfg(target_os = "macos")]
    fn caption_golden_document(style_id: &str, texts: &[&str], language: &str) -> Value {
        let words = texts
            .iter()
            .enumerate()
            .map(|(index, text)| {
                json!({
                    "id": format!("gold-{index}"),
                    "text": text,
                    "t0": index as f64 * 0.5,
                    "t1": index as f64 * 0.5 + 0.42,
                    "sp": "s"
                })
            })
            .collect::<Vec<_>>();
        let text = if language == "zh" {
            texts.concat()
        } else {
            texts.join(" ")
        };
        let options = (style_id == "caption-particle-burst")
            .then(|| vec![json!({"kind":"number", "key":"particleCount", "number":12})])
            .unwrap_or_default();
        json!({
            "meta": {"duration": 1.92, "sourceLang": {"code": language}},
            "style": {
                "mode": "orig",
                "fontFamily": {"type":"default", "fontFamily":"Montserrat"},
                "fontSize": 34,
                "fontColor": "#FFFFFF",
                "bold": true,
                "background": false,
                "backgroundPadding": 10,
                "lineHeight": 1.2,
                "x": 50,
                "y": 50,
                "width": 84,
                "scale": 1,
                "captionEmphasis": {
                    "gold-1": {
                        "anchorText": texts[1],
                        "role": "hero",
                        "color": "#00E5FF",
                        "emoji": "✨"
                    }
                },
                "wordAnimation": {"animationName":"None", "caption": {
                    "schema": 1,
                    "style": {"id": style_id, "version": 1},
                    "content": "orig",
                    "palette": {
                        "primary": "#FFFFFF",
                        "accent": "#FF4D6D",
                        "backdrop": "#07111F"
                    },
                    "intensity": 72,
                    "speed": 1.1,
                    "seed": 31415,
                    "options": options
                }}
            },
            "cues": [{
                "id": "gold-cue",
                "start": 0.0,
                "end": 1.92,
                "text": text,
                "sp": "s",
                "words": words
            }],
            "sentences": [],
            "transCues": []
        })
    }

    #[cfg(target_os = "macos")]
    fn caption_golden_backdrop(width: u32, height: u32, variant: usize) -> Pixmap {
        fn fill(pixmap: &mut Pixmap, rect: tiny_skia::Rect, rgba: [u8; 4]) {
            let mut paint = tiny_skia::Paint::default();
            paint.set_color_rgba8(rgba[0], rgba[1], rgba[2], rgba[3]);
            pixmap.fill_rect(rect, &paint, Transform::identity(), None);
        }

        let mut pixmap = Pixmap::new(width, height).unwrap();
        fill(
            &mut pixmap,
            tiny_skia::Rect::from_xywh(0.0, 0.0, width as f32, height as f32).unwrap(),
            [9, 35, 67, 255],
        );
        let split = width as f32 * (0.38 + variant as f32 * 0.08);
        fill(
            &mut pixmap,
            tiny_skia::Rect::from_xywh(split, 0.0, width as f32 - split, height as f32).unwrap(),
            [241, 95, 39, 255],
        );
        let square = 18_u32;
        let mut y = 0_u32;
        let mut row = 0_u32;
        while y < height {
            let mut x = if row.is_multiple_of(2) { 0 } else { square };
            while x < width {
                fill(
                    &mut pixmap,
                    tiny_skia::Rect::from_xywh(x as f32, y as f32, square as f32, square as f32)
                        .unwrap(),
                    [255, 255, 255, 31],
                );
                x += square * 2;
            }
            y += square;
            row += 1;
        }
        pixmap
    }

    #[cfg(target_os = "macos")]
    fn caption_golden_contact_sheet(style_id: &str) -> Pixmap {
        let scenarios = [
            (
                256_u32,
                144_u32,
                ["Designed", "captions", "stay", "editable"],
                "en",
            ),
            (144, 256, ["Designed", "captions", "stay", "editable"], "en"),
            (256, 144, ["设计", "字幕", "保持", "可编辑"], "zh"),
        ];
        let times = [0.0, 0.24, 0.76, 1.82];
        let mut sheet = Pixmap::new(816, 1088).unwrap();
        sheet.fill(tiny_skia::Color::BLACK);
        for (column, (width, height, texts, language)) in scenarios.iter().enumerate() {
            for (row, time) in times.iter().copied().enumerate() {
                let backdrop = caption_golden_backdrop(*width, *height, row);
                let mut bgra = backdrop
                    .data()
                    .chunks_exact(*width as usize * 4)
                    .rev()
                    .flat_map(|row| row.chunks_exact(4))
                    .flat_map(|pixel| [pixel[2], pixel[1], pixel[0], pixel[3]])
                    .collect::<Vec<_>>();
                let document = caption_golden_document(style_id, texts, language);
                let mut plan =
                    OverlayRenderPlan::compile(&document, *width, *height, 1.92, 60.0, None)
                        .unwrap();
                plan.composite_bgra(&mut bgra, *width as usize * 4, time)
                    .unwrap();
                let rgba = bgra
                    .chunks_exact(4)
                    .flat_map(|pixel| [pixel[2], pixel[1], pixel[0], pixel[3]])
                    .collect::<Vec<_>>();
                let rendered =
                    Pixmap::from_vec(rgba, tiny_skia::IntSize::from_wh(*width, *height).unwrap())
                        .unwrap();
                let x = column as i32 * 272 + (272 - *width as i32) / 2;
                let y = (3 - row) as i32 * 272 + (272 - *height as i32) / 2;
                sheet.draw_pixmap(
                    x,
                    y,
                    rendered.as_ref(),
                    &tiny_skia::PixmapPaint::default(),
                    Transform::identity(),
                    None,
                );
            }
        }
        sheet
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn all_caption_recipes_stay_within_the_mac_renderer_goldens() {
        let directory =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/caption-goldens");
        // CoreText and cosmic-text rasterize the same font outlines differently.
        // These per-recipe envelopes are the frozen cross-engine baseline plus
        // 0.1–0.2 percentage points; backdrop/layout/timing/effect drift still
        // crosses the gate, while subpixel antialiasing does not.
        let limits = HashMap::from([
            ("caption-blend-difference", 0.014),
            ("caption-clip-wipe", 0.011),
            ("caption-editorial-emphasis", 0.012),
            ("caption-emoji-pop", 0.011),
            ("caption-glitch-rgb", 0.016),
            ("caption-gradient-fill", 0.015),
            ("caption-highlight", 0.014),
            // The current CoreText ↔ cosmic-text baseline is 3.2569%. The established cross-engine rasterisation margin of 0.14 percentage points is kept, so drift in layout, timing or effects is still caught.
            ("caption-kinetic-slam", 0.034),
            ("caption-matrix-decode", 0.012),
            ("caption-neon-accent", 0.014),
            ("caption-neon-glow", 0.017),
            ("caption-parallax-layers", 0.012),
            ("caption-particle-burst", 0.011),
            ("caption-pill-karaoke", 0.015),
            ("caption-texture", 0.014),
            ("caption-weight-shift", 0.016),
        ]);
        for descriptor in caption_recipe_descriptors() {
            // The picture for the cross-sentence sequence recipe (Daoyazi) is taken over by `CaptionSequencePlan`, not by a cue-level contact sheet. Its pixel regression lives in `caption_sequence_tests` and the end-to-end tests.
            if descriptor.is_sequence() {
                continue;
            }
            let fixture = directory.join(format!("{}.png", descriptor.id));
            let expected = Pixmap::decode_png(&std::fs::read(fixture).unwrap()).unwrap();
            let actual = caption_golden_contact_sheet(&descriptor.id);
            assert_eq!(actual.width(), expected.width(), "{} width", descriptor.id);
            assert_eq!(
                actual.height(),
                expected.height(),
                "{} height",
                descriptor.id
            );
            let mut changed = 0_usize;
            let mut max_delta = 0_u8;
            for (actual, expected) in actual.data().iter().zip(expected.data()) {
                let delta = actual.abs_diff(*expected);
                changed += usize::from(delta > 2);
                max_delta = max_delta.max(delta);
            }
            let fraction = changed as f64 / actual.data().len() as f64;
            let limit = limits[descriptor.id.as_str()];
            assert!(
                fraction <= limit,
                "{}: {:.4}% bytes changed (limit {:.4}%), max delta {max_delta}",
                descriptor.id,
                fraction * 100.0,
                limit * 100.0,
            );
        }
    }

    #[test]
    fn dual_band_and_editorial_layouts_follow_mac_band_order_and_font_roles() {
        let mut dual = OverlayRenderPlan::compile(
            &designed_layout_document("caption-parallax-layers"),
            640,
            360,
            3.0,
            30.0,
            None,
        )
        .unwrap();
        let dual = dual.active_layouts(0.8);
        let dual = &dual[0];
        assert_eq!(dual.lines.len(), 2);
        assert_eq!(
            dual.lines[0].chunks.iter().find_map(|chunk| chunk.word),
            Some(0)
        );
        assert_eq!(
            dual.lines[1].chunks.iter().find_map(|chunk| chunk.word),
            Some(1)
        );
        assert!(dual.lines[0].chunks[0].font_size > dual.lines[1].chunks[0].font_size);
        assert!(dual.lines[0].gap_after > 0.0);

        let mut editorial = designed_layout_document("caption-editorial-emphasis");
        editorial["style"]["captionEmphasis"] = json!({
            "w2": {"anchorText":"world", "role":"hero"}
        });
        let mut editorial =
            OverlayRenderPlan::compile(&editorial, 640, 360, 3.0, 30.0, None).unwrap();
        let editorial = editorial.active_layouts(0.8);
        let editorial = &editorial[0];
        assert_eq!(editorial.lines.len(), 2);
        assert_eq!(
            editorial.lines[0]
                .chunks
                .iter()
                .find_map(|chunk| chunk.word),
            Some(0),
            "editorialBlock lays out the ordinary band first"
        );
        let hero = editorial.lines[1]
            .chunks
            .iter()
            .find(|chunk| chunk.word == Some(1))
            .unwrap();
        assert!(hero.italic);
        assert_eq!(hero.font_weight, 700);
        assert!(hero.font_size > editorial.lines[0].chunks[0].font_size);
    }

    #[test]
    fn full_screen_word_layout_uses_visible_group_fit_and_center_anchor() {
        let mut plan = OverlayRenderPlan::compile(
            &designed_layout_document("caption-kinetic-slam"),
            640,
            360,
            3.0,
            30.0,
            None,
        )
        .unwrap();
        let layouts = plan.active_layouts(0.8);
        assert_eq!(layouts[0].lines.len(), 1);
        assert_eq!(
            layouts[0].lines[0]
                .chunks
                .iter()
                .find_map(|chunk| chunk.word),
            Some(0)
        );
        assert!(layouts[0].width <= 640.0 * 0.86 + 0.5);
        let stack = plan.stack_layout(&layouts, 640.0_f64.min(360.0) / 540.0);
        assert_eq!(stack.anchor, (320.0, 180.0));
    }

    #[test]
    fn overlay_png_reuses_settled_word_state_and_reports_next_boundary() {
        let mut plan =
            OverlayRenderPlan::compile(&document("Highlight", "none"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        let first = plan.render_png(0.8).unwrap();
        let settled = plan.render_png(0.9).unwrap();
        let next_word = plan.render_png(1.25).unwrap();
        assert_eq!(&first.png[..8], b"\x89PNG\r\n\x1a\n");
        assert_eq!(first.subtitle_key, settled.subtitle_key);
        assert_eq!(first.next_change, Some(1.2));
        assert_ne!(first.subtitle_key, next_word.subtitle_key);
        assert!(next_word.next_change.is_some_and(|value| value > 1.25));

        let mut animated =
            OverlayRenderPlan::compile(&document("None", "magic-fade"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        let animation_frame = animated.render_png(0.01).unwrap();
        assert!(
            (animation_frame.next_change.unwrap() - 1.0 / 60.0).abs() < 1e-6,
            "transition invalidation must follow the renderer's rounded frame buckets"
        );
    }

    /// Plan §5.4 S14: the subtitle's entry pose is baked into the PNG by serve. The client cannot and should not apply it again, so the two suppressions in the Mac's `Stage/Frame/StageFrameMotion.swift::subtitlePoseNodes` (any subtitle being selected, and a Designed Caption yielding) can only be opened from here.
    ///
    /// Three invariants: after suppression, the entry frame equals the settled frame; the keys must be distinguishable from the unsuppressed case (otherwise a Designed Caption's per-frame keys would collide into one image on the same frame number); and the default remains unsuppressed.
    #[test]
    fn suppressed_transition_renders_the_settled_pose_without_colliding_keys() {
        let pixels = |frame: &OverlayFrame| Pixmap::decode_png(&frame.png).unwrap().data().to_vec();
        let mut plan =
            OverlayRenderPlan::compile(&document("None", "magic-fade"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        let animating = plan.render_png(0.01).unwrap();

        let mut suppressed =
            OverlayRenderPlan::compile(&document("None", "magic-fade"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        suppressed.set_suppress_transition(true);
        let suppressed_entrance = suppressed.render_png(0.01).unwrap();

        // The document at the same moment with no transition is exactly what it should look like after suppression (the per-word state matches too).
        let mut without =
            OverlayRenderPlan::compile(&document("None", "none"), 640, 360, 3.0, 30.0, None)
                .unwrap();
        let plain = without.render_png(0.01).unwrap();
        assert_eq!(pixels(&suppressed_entrance), pixels(&plain));
        assert_ne!(pixels(&animating), pixels(&plain));

        // The keys must be distinguishable: the same instance switching between the two suppression states must not reuse the previously cached frame.
        assert_ne!(animating.subtitle_key, suppressed_entrance.subtitle_key);
        // Once settled, the two paths are already the same image, so the keys should match as well (the cache should not be needlessly split).
        assert_eq!(
            plan.render_png(1.0).unwrap().subtitle_key,
            suppressed.render_png(1.0).unwrap().subtitle_key
        );
    }

    #[test]
    fn transition_pose_matches_preview_contract() {
        let style = &document("None", "magic-fade")["style"];
        let start = transition_pose(style, 0.0, 0.0, 1.0, 30.0);
        let settled = transition_pose(style, 0.0, 0.3, 1.0, 30.0);
        assert!(start.active);
        assert_eq!(start.opacity, 0.0);
        assert_eq!(start.blur, 6.0);
        assert_eq!(settled, TransitionPose::IDENTITY);
    }

    #[test]
    fn rust_transition_and_word_states_match_shared_preview_fixtures() {
        let contract: Value = serde_json::from_str(include_str!(
            "../../speech-doc/tests/fixtures/subtitle-render-contract.json"
        ))
        .unwrap();
        for row in contract["displayWindows"].as_array().unwrap() {
            let items = timed_items(row["items"].as_array().unwrap(), "text", &json!({}), "und");
            let actual = &items[row["index"].as_u64().unwrap() as usize];
            assert!(
                (actual.display_start - row["expected"]["start"].as_f64().unwrap()).abs() < 1e-9
            );
            assert!((actual.display_end - row["expected"]["end"].as_f64().unwrap()).abs() < 1e-9);
        }
        for row in contract["modes"].as_array().unwrap() {
            let mode = StudioMode::parse(row["mode"].as_str().unwrap()).unwrap();
            let actual = mode_lines(mode, row["order"].as_str().unwrap())
                .into_iter()
                .map(|kind| match kind {
                    LineKind::Original => "orig",
                    LineKind::Translation => "trans",
                })
                .collect::<Vec<_>>();
            assert_eq!(
                actual,
                serde_json::from_value::<Vec<String>>(row["expected"].clone()).unwrap()
            );
        }
        for row in contract["punctuationProjections"].as_array().unwrap() {
            let text = row["text"].as_str().unwrap();
            let actual = projected_text(
                text,
                row["language"].as_str().unwrap(),
                row["enabled"].as_bool().unwrap(),
            );
            assert_eq!(actual, row["expected"].as_str().unwrap());
        }
        for row in contract["transitions"].as_array().unwrap() {
            let style = json!({"transition": {
                "transitionId": row["id"], "transitionSpeed": row["speed"]
            }});
            let pose = transition_pose(
                &style,
                row["displayStart"].as_f64().unwrap(),
                row["time"].as_f64().unwrap(),
                row["scale"].as_f64().unwrap(),
                row["fps"].as_f64().unwrap(),
            );
            let expected = &row["expected"];
            assert!((pose.opacity - expected["opacity"].as_f64().unwrap()).abs() < 1e-9);
            assert!((pose.scale_x - expected["scaleX"].as_f64().unwrap()).abs() < 1e-9);
            assert!((pose.scale_y - expected["scaleY"].as_f64().unwrap()).abs() < 1e-9);
            assert!((pose.blur - expected["blur"].as_f64().unwrap()).abs() < 1e-9);
            assert_eq!(pose.active, expected["active"]);
        }
        for row in contract["lineFontSizes"].as_array().unwrap() {
            let kind = match row["line"].as_str().unwrap() {
                "trans" => LineKind::Translation,
                _ => LineKind::Original,
            };
            let style = resolve_line_style(
                &row["style"],
                kind,
                row["frame"]["width"].as_u64().unwrap() as u32,
                row["frame"]["height"].as_u64().unwrap() as u32,
                row["compactOriginal"].as_bool().unwrap(),
            );
            assert!(
                (style.font_size - row["expected"].as_f64().unwrap()).abs() < 1e-9,
                "{}",
                row["name"].as_str().unwrap()
            );
        }
        for row in contract["styleMetrics"].as_array().unwrap() {
            let style = resolve_line_style(
                &row["style"],
                LineKind::Original,
                row["frame"]["width"].as_u64().unwrap() as u32,
                row["frame"]["height"].as_u64().unwrap() as u32,
                false,
            );
            let expected = &row["expected"];
            assert!(
                (style.background_radius - expected["borderRadius"].as_f64().unwrap()).abs() < 1e-9,
                "{}",
                row["name"]
            );
            assert!(
                (style.background_min_width - expected["blockMinWidth"].as_f64().unwrap()).abs()
                    < 1e-9,
                "{}",
                row["name"]
            );
            assert!(
                (style.letter_spacing - expected["letterSpacing"].as_f64().unwrap()).abs() < 1e-9,
                "{}",
                row["name"]
            );
        }
        for row in contract["textTransforms"].as_array().unwrap() {
            assert_eq!(
                transform_text(
                    row["text"].as_str().unwrap(),
                    row["transform"].as_str().unwrap()
                ),
                row["expected"].as_str().unwrap()
            );
        }
        for row in contract["wordAnimations"].as_array().unwrap() {
            let style = json!({"wordAnimation": {"animationName": row["name"]}});
            let animation = word_animation(&style);
            let visual = word_state(
                &animation,
                row["index"].as_u64().unwrap() as usize,
                row["current"].as_u64().unwrap() as usize,
                // No effect in the shared fixture has a block track. Phase 0 is enough, and an effect without a `box_track` is immune to it.
                0.0,
            );
            let expected = &row["expected"];
            if let Some(color) = expected.get("color").and_then(Value::as_str) {
                assert_eq!(visual.color, parse_css_color(color));
            }
            if let Some(opacity) = expected.get("opacity").and_then(Value::as_f64) {
                assert_eq!(visual.opacity, Some(opacity));
            }
            if let Some(background) = expected.get("backgroundColor").and_then(Value::as_str) {
                assert_eq!(visual.background, parse_css_color(background));
            }
            if let Some(radius) = expected.get("borderRadiusEm").and_then(Value::as_f64) {
                assert_eq!(visual.border_radius_em, Some(radius));
            }
            if let Some(bottom) = expected.get("bottomEm").and_then(Value::as_f64) {
                assert_eq!(visual.bottom_em, Some(bottom));
            }
            if let Some(underline) = expected.get("underline").and_then(Value::as_bool) {
                assert_eq!(visual.underline, Some(underline));
            }
            if let Some(offset) = expected.get("underlineOffsetEm").and_then(Value::as_f64) {
                assert_eq!(visual.underline_offset_em, Some(offset));
            }
            if let Some(shadow_off) = expected.get("shadowOff").and_then(Value::as_bool) {
                assert_eq!(visual.shadow_off, shadow_off);
            }
        }
    }

    #[test]
    fn pending_style_and_text_are_merged_without_mutating_project_truth() {
        let mut data = document("None", "none");
        let base = serde_json::to_string(&data["style"]).unwrap();
        let overlay = json!({
            "style": {"base": base, "value": {"fontSize": 44, "mode": "orig"}},
            "edits": {"q1": {"text": {"base": "Hello world", "value": "Edited text"}}}
        });
        apply_preview_overlays(&mut data, &overlay);
        assert_eq!(data["style"]["fontSize"], 44);
        assert_eq!(data["cues"][0]["text"], "Edited text");
        assert!(data["cues"][0].get("words").is_none());
    }

    #[test]
    fn video_plan_projects_punctuation_in_every_language_and_honors_the_style_switch() {
        let mut data = document("None", "none");
        data["meta"]["sourceLang"] = json!({"code": "zh"});
        data["cues"][0]["text"] = json!("你好，世界。");
        data["cues"][0]["words"] = json!([
            {"text": "你好，", "t0": 0.5, "t1": 1.2},
            {"text": "世界。", "t0": 1.3, "t1": 2.5}
        ]);

        let mut projected = OverlayRenderPlan::compile(&data, 640, 360, 3.0, 30.0, None).unwrap();
        assert_eq!(projected.active_layouts(0.8)[0].item.text, "你好 世界");

        data["style"]["punct"] = json!(false);
        let mut literal = OverlayRenderPlan::compile(&data, 640, 360, 3.0, 30.0, None).unwrap();
        assert_eq!(literal.active_layouts(0.8)[0].item.text, "你好，世界。");

        data["style"]["punct"] = json!(true);
        data["meta"]["sourceLang"] = json!({"code": "en"});
        data["cues"][0]["text"] = json!("Hello, world.");
        data["cues"][0]["words"] = json!([
            {"text": "Hello,", "t0": 0.5, "t1": 1.2},
            {"text": "world.", "t0": 1.3, "t1": 2.5}
        ]);
        let mut english = OverlayRenderPlan::compile(&data, 640, 360, 3.0, 30.0, None).unwrap();
        assert_eq!(english.active_layouts(0.8)[0].item.text, "Hello world");
    }

    #[test]
    fn pending_source_and_translation_structure_match_the_preview() {
        let mut data = json!({
            "rev": 7,
            "style": {},
            "cues": [{
                "id": "q1", "sp": "speaker", "start": 0.0, "end": 2.0,
                "text": "Hello world", "words": [{"text": "Hello"}]
            }],
            "sentences": [{
                "id": "s1", "start": 0.0, "end": 2.0, "trans": "你好世界"
            }],
            "transCues": [{
                "id": "s1#0", "sid": "s1", "kind": "piece", "text": "你好世界",
                "start": 0.0, "end": 2.0, "wordFrom": 0, "wordTo": 1,
                "sourceWords": [
                    {"id": "w1", "text": "Hello", "start": 0.0, "end": 1.0},
                    {"id": "w2", "text": "world", "start": 1.0, "end": 2.0}
                ]
            }]
        });
        let overlay = json!({
            "struct": {"baseRev": 7, "ops": [{
                "kind": "split", "id": "q1", "baseText": "Hello world", "offset": 5,
                "textA": "Hello", "textB": "world"
            }]},
            "transStruct": {"baseRev": 7, "ops": [{
                "kind": "split", "sid": "s1", "from": 0, "to": 1, "at": 0,
                "baseText": "你好世界", "textA": "你好", "textB": "世界"
            }]}
        });
        apply_preview_overlays(&mut data, &overlay);
        assert_eq!(data["cues"][0]["id"], "q1a");
        assert_eq!(data["cues"][1]["id"], "q1b");
        assert!(data["cues"][0].get("words").is_none());
        assert_eq!(data["transCues"][0]["id"], "s1#0");
        assert_eq!(data["transCues"][0]["text"], "你好");
        assert_eq!(data["transCues"][0]["end"], 1.0);
        assert_eq!(data["transCues"][1]["id"], "s1#1");
        assert_eq!(data["transCues"][1]["text"], "世界");
        assert_eq!(data["sentences"][0]["trans"], "你好世界");
    }

    #[test]
    fn pending_unaligned_translation_split_seeds_preview_pieces() {
        let mut data = json!({
            "rev": 7,
            "style": {},
            "cues": [{
                "id": "q-w1", "sp": "speaker", "start": 0.0, "end": 2.0,
                "text": "Hello world", "words": [
                    {"id": "w1", "text": "Hello", "t0": 0.0, "t1": 1.0},
                    {"id": "w2", "text": "world", "t0": 1.0, "t1": 2.0}
                ]
            }],
            "sentences": [{
                "id": "s-w1", "start": 0.0, "end": 2.0, "trans": "你好世界",
                "sourceWordIds": ["w1", "w2"]
            }],
            "transCues": [{
                "id": "s-w1", "sid": "s-w1", "kind": "sentence", "text": "你好世界",
                "start": 0.0, "end": 2.0
            }]
        });
        let overlay = json!({
            "transStruct": {"baseRev": 7, "ops": [{
                "kind": "split", "sid": "s-w1", "from": 0, "to": 1, "at": 0,
                "baseText": "你好世界", "textA": "您好", "textB": "世界",
                "seedUnaligned": true
            }]}
        });

        apply_preview_overlays(&mut data, &overlay);
        assert_eq!(data["transCues"][0]["kind"], "piece");
        assert_eq!(data["transCues"][0]["id"], "s-w1#0");
        assert_eq!(data["transCues"][0]["text"], "您好");
        assert_eq!(data["transCues"][0]["sourceWordIds"], json!(["w1"]));
        assert_eq!(data["transCues"][1]["id"], "s-w1#1");
        assert_eq!(data["transCues"][1]["text"], "世界");
        assert_eq!(data["transCues"][1]["sourceWordIds"], json!(["w2"]));
        assert_eq!(data["sentences"][0]["trans"], "您好世界");
    }

    #[test]
    fn a_piece_edit_rebuilds_the_sentence_from_all_translation_pieces() {
        let mut data = json!({
            "rev": 1,
            "style": {},
            "cues": [],
            "sentences": [{"id": "s1", "trans": "Alpha Beta"}],
            "transCues": [
                {"id": "s1#0", "sid": "s1", "kind": "piece", "text": "Alpha", "start": 0.0},
                {"id": "s1#1", "sid": "s1", "kind": "piece", "text": "Beta", "start": 1.0}
            ]
        });
        let overlay = json!({
            "trans": {"s1#1": {"kind": "piece", "base": "Beta", "value": "Gamma"}}
        });
        apply_preview_overlays(&mut data, &overlay);
        assert_eq!(data["transCues"][0]["text"], "Alpha");
        assert_eq!(data["transCues"][1]["text"], "Gamma");
        assert_eq!(data["sentences"][0]["trans"], "Alpha Gamma");
    }

    #[test]
    fn bgra_compositor_blends_without_external_media_tools() {
        let mut plan =
            OverlayRenderPlan::compile(&document("Color", "none"), 320, 180, 3.0, 30.0, None)
                .unwrap();
        let mut frame = vec![24_u8; 320 * 180 * 4];
        plan.composite_bgra(&mut frame, 320 * 4, 0.8).unwrap();
        assert!(
            frame
                .chunks_exact(4)
                .any(|pixel| { pixel[0] > 100 || pixel[1] > 100 || pixel[2] > 100 })
        );
    }

    /// The correctness premise of the frame-level compositing cache: sequential rendering (cache active) and a cold-start single-frame render are byte-identical. The sampling points cover the entry transition, word boundaries, still segments and the edges of the display window. The full-film export and the interval re-render (a cold start for a patch window) share this equivalence.
    #[test]
    fn sequential_cached_composites_match_cold_renders() {
        let doc = document("Color", "magic-fade");
        let mut warm = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        let sampled = [0, 1, 2, 12, 27, 36, 39, 60, 78, 89];
        for frame_index in 0..90 {
            let time = frame_index as f64 / 30.0;
            let mut warm_frame = vec![24_u8; 320 * 180 * 4];
            warm.composite_bgra(&mut warm_frame, 320 * 4, time).unwrap();
            if !sampled.contains(&frame_index) {
                continue;
            }
            let mut cold = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
            let mut cold_frame = vec![24_u8; 320 * 180 * 4];
            cold.composite_bgra(&mut cold_frame, 320 * 4, time).unwrap();
            assert_eq!(
                warm_frame, cold_frame,
                "cache-reuse result for frame {frame_index} differs from a cold render"
            );
        }
    }

    /// A document with glow (`effect_on`) and bilingual lines: subtitle rendering takes the path "one full-frame effect layer per line → blur → premultiplied compositing", which is the target of the bbox and scratch-reuse changes.
    fn glowing_bilingual_document(transition: &str) -> Value {
        let mut document = document("Highlight", transition);
        document["style"]["mode"] = json!("bi");
        document["style"]["glow"] = json!({
            "on": true, "color": "#FF3366", "intensity": 80, "range": 40
        });
        // Narrow the display window so that the head and tail leave genuinely blank frames.
        document["style"]["displayTiming"] = json!({"leadIn": 0.1, "tail": 0.1});
        document["cues"] = json!([{
            "id": "q1", "start": 1.0, "end": 2.0, "text": "Hello world",
            "words": [
                {"text": "Hello", "t0": 1.0, "t1": 1.5},
                {"text": "world", "t0": 1.5, "t1": 2.0}
            ]
        }]);
        document["transCues"] = json!([{
            "id": "s1#0", "sid": "s1", "kind": "piece",
            "start": 1.0, "end": 2.0, "text": "你好世界"
        }]);
        document
    }

    /// The bounding box returned after blurring must cover all non-zero bytes. Both the bbox compositing and the clearing of the scratch reuse are built on this invariant.
    #[test]
    fn blur_bounds_cover_every_nonzero_byte() {
        let width = 96_u32;
        let height = 64_u32;
        for &(corner_x, corner_y) in &[(40_usize, 30_usize), (0, 0), (93, 61), (0, 30), (50, 0)] {
            for radius in [1_usize, 3, 9, 20] {
                let mut data = vec![0_u8; 96 * 64 * 4];
                for dy in 0..3 {
                    for dx in 0..4 {
                        let x = (corner_x + dx).min(95);
                        let y = (corner_y + dy).min(63);
                        let offset = (y * 96 + x) * 4;
                        data[offset..offset + 4].copy_from_slice(&[120, 40, 200, 220]);
                    }
                }
                let bounds = box_blur_rgba_content(&mut data, width, height, radius).unwrap();
                for y in 0..height as usize {
                    for x in 0..width as usize {
                        if bounds.rows.contains(&y) && bounds.cols.contains(&x) {
                            continue;
                        }
                        let offset = (y * 96 + x) * 4;
                        assert_eq!(
                            &data[offset..offset + 4],
                            &[0, 0, 0, 0],
                            "radius {radius}: corner ({corner_x},{corner_y}) still has non-zero pixels outside the bounding box at ({x},{y})"
                        );
                    }
                }
            }
        }
    }

    /// The same equivalence as [`sequential_cached_composites_match_cold_renders`], but the document enables glow and uses bilingual lines. One frame then has two effect lines, which can catch residue across frames and lines caused by the scratch buffer not being cleared.
    #[test]
    fn glowing_bilingual_cached_composites_match_cold_renders() {
        let doc = glowing_bilingual_document("magic-fade");
        let mut warm = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        for frame_index in 0..90 {
            let time = frame_index as f64 / 30.0;
            let mut warm_frame = vec![24_u8; 320 * 180 * 4];
            warm.composite_bgra(&mut warm_frame, 320 * 4, time).unwrap();
            let mut cold = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
            let mut cold_frame = vec![24_u8; 320 * 180 * 4];
            cold.composite_bgra(&mut cold_frame, 320 * 4, time).unwrap();
            assert_eq!(
                warm_frame, cold_frame,
                "cache-reuse result for frame {frame_index} differs from a cold render"
            );
        }
    }

    /// Outside the display window, the frame must be judged fully transparent, and compositing must not touch the target buffer at all.
    #[test]
    fn blank_overlay_windows_leave_the_destination_untouched() {
        let doc = glowing_bilingual_document("none");
        let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        // The display window is [0.9, 2.1), so both the head and the tail are genuinely blank frames.
        assert!(plan.overlay_is_blank(0.0).unwrap());
        assert!(!plan.overlay_is_blank(1.5).unwrap());
        assert!(plan.overlay_is_blank(2.9).unwrap());
        let mut blank = vec![24_u8; 320 * 180 * 4];
        plan.composite_bgra(&mut blank, 320 * 4, 0.0).unwrap();
        assert!(blank.iter().all(|&byte| byte == 24));
    }

    /// Local blur over the content bounding box must be byte-identical to full-frame blur, including the alignment of the window-shrinking semantics when content touches an edge or a corner.
    #[test]
    fn content_box_blur_matches_full_frame_blur() {
        let width = 64_u32;
        let height = 36_u32;
        for &(corner_x, corner_y) in &[(5_usize, 5_usize), (58, 30), (0, 0), (60, 33), (30, 0)] {
            let mut full = vec![0_u8; 64 * 36 * 4];
            for dy in 0..3 {
                for dx in 0..4 {
                    let x = (corner_x + dx).min(63);
                    let y = (corner_y + dy).min(35);
                    let offset = (y * 64 + x) * 4;
                    full[offset..offset + 4].copy_from_slice(&[120, 40, 200, 220]);
                }
            }
            let mut content = full.clone();
            box_blur_rgba(&mut full, width, height, 4);
            box_blur_rgba_content(&mut content, width, height, 4);
            assert_eq!(full, content, "content blob at ({corner_x},{corner_y})");
        }
    }

    /// `OverlayIncludes` and `ccut-editable::builder::include_element` must be isomorphic item by item. Under the same `--no-*` combination, the element set seen by "burn-in preview first, then export an editable project" must agree on both sides.
    #[test]
    fn overlay_includes_mirror_the_editable_export_element_gates() {
        let element = |kind: &str, role: Option<&str>| -> Element {
            let mut raw = json!({"id": "el", "kind": kind});
            if let Some(role) = role {
                raw["role"] = json!(role);
            }
            serde_json::from_value(raw).unwrap()
        };
        let all = OverlayIncludes::ALL;
        assert!(all.allows(&element("text", None)));
        assert!(all.allows(&element("image", None)));
        assert!(all.allows(&element("video", None)));
        // The overlay carries no audio: the audio track is pre-mixed into the source media by timeline_media.
        assert!(!all.allows(&element("audio", None)));

        let no_texts = OverlayIncludes {
            texts: false,
            ..OverlayIncludes::ALL
        };
        assert!(!no_texts.allows(&element("text", None)));
        assert!(no_texts.allows(&element("image", None)));

        let no_overlays = OverlayIncludes {
            media_overlays: false,
            ..OverlayIncludes::ALL
        };
        assert!(!no_overlays.allows(&element("image", None)));
        assert!(!no_overlays.allows(&element("video", None)));
        assert!(no_overlays.allows(&element("text", None)));

        // The watermark role is judged before kind, but it short-circuits only when the watermark is excluded.
        let no_watermarks = OverlayIncludes {
            watermarks: false,
            ..OverlayIncludes::ALL
        };
        assert!(!no_watermarks.allows(&element("text", Some("watermark"))));
        assert!(!no_watermarks.allows(&element("image", Some("watermark"))));
        assert!(no_watermarks.allows(&element("text", None)));
        // Keep the watermark but exclude the text: the watermark text must still pass the kind check, and it disappears together with the text.
        assert!(!no_texts.allows(&element("text", Some("watermark"))));
        // No other role enjoys any exemption.
        assert!(!no_texts.allows(&element("text", Some("screentext"))));
        assert!(!no_overlays.allows(&element("video", Some("broll"))));
    }

    /// After burn-in is turned off, the precondition check of the display mode must also yield. A clean picture can be exported even without a translation, rather than the whole export being rejected because "the mode requires a translation".
    #[test]
    fn disabled_subtitles_skip_the_display_mode_preconditions() {
        let document = document("none", "none");
        let compile = |includes: OverlayIncludes, mode: &str| {
            OverlayRenderPlan::compile_with(&document, 320, 180, 3.0, 30.0, Some(mode), includes)
        };
        let no_subtitles = OverlayIncludes {
            subtitles: false,
            ..OverlayIncludes::ALL
        };
        for mode in ["translated", "bilingual"] {
            assert!(
                compile(OverlayIncludes::ALL, mode).is_err(),
                "{mode} with a missing translation must report an error"
            );
            let mut plan = compile(no_subtitles, mode).unwrap();
            let mut frame = vec![24_u8; 320 * 180 * 4];
            plan.composite_bgra(&mut frame, 320 * 4, 1.5).unwrap();
            assert!(
                frame.iter().all(|&byte| byte == 24),
                "{mode} must draw no subtitles once burn-in is turned off"
            );
        }
        // Control group: with burn-in retained, the same document still draws the original text.
        let mut plan = compile(OverlayIncludes::ALL, "original").unwrap();
        let mut frame = vec![24_u8; 320 * 180 * 4];
        plan.composite_bgra(&mut frame, 320 * 4, 1.5).unwrap();
        assert!(frame.iter().any(|&byte| byte != 24));
    }

    /// A missing translation is a failure that is certain before projection. This test deliberately does not register an OverlayHost for the project. If the implementation first tried to read the live timeline, the error would become "host not registered", and it would reintroduce the peak caused by deep-copying an overlong document.
    #[test]
    fn project_compile_rejects_missing_translation_before_live_projection() {
        let project = tempfile::tempdir().unwrap();
        let document = json!({
            "style": {"mode": "translated"},
            "cues": [{
                "id": "q1", "start": 0.0, "end": 1.0, "text": "hello",
                "words": [{"id": "w1", "text": "hello", "t0": 0.0, "t1": 1.0}]
            }],
            "sentences": [],
            "transCues": [],
            "sourceDocs": {
                "main": {"cues": [], "sentences": [], "transCues": []}
            }
        });
        let error = OverlayRenderPlan::compile_project(
            project.path(),
            &document,
            320,
            180,
            1.0,
            30.0,
            None,
        )
        .err()
        .expect("a missing translation must fail before timeline projection");
        assert_eq!(
            format!("{error:#}"),
            "the current Studio projection has no translation; cannot export translated or bilingual video"
        );
    }

    #[test]
    fn translated_mode_leaves_untranslated_groups_blank_instead_of_showing_source() {
        let document = json!({
            "meta": {
                "duration": 4.0,
                "sourceLang": {"code": "en"},
                "targetLang": {"code": "zh"}
            },
            "style": {
                "mode": "trans", "fontFamily": "montserrat", "fontSize": 30,
                "fontColor": "#FFFFFF", "punct": true,
                "transStyle": {"fontFamily": "Bebas Neue", "fontColor": "#FFCC00"},
                "displayTiming": {"leadIn": 0.0, "tail": 0.0}
            },
            "cues": [
                {"id": "q1", "start": 0.0, "end": 2.0, "text": "Hello there."},
                {"id": "q2", "start": 2.0, "end": 4.0, "text": "Source fallback."}
            ],
            "sentences": [
                {"id": "s1", "cueIds": ["q1"], "start": 0.0, "end": 2.0,
                    "text": "Hello there.", "trans": "你好"},
                {"id": "s2", "cueIds": ["q2"], "start": 2.0, "end": 4.0,
                    "text": "Source fallback.", "trans": ""}
            ],
            "transCues": [
                {"id": "s1", "sid": "s1", "kind": "sentence",
                    "start": 0.0, "end": 2.0, "text": "你好"}
            ]
        });
        let mut translated =
            OverlayRenderPlan::compile(&document, 640, 360, 4.0, 30.0, Some("translated")).unwrap();

        let translated_line = translated.active_layouts(1.0);
        assert_eq!(translated_line.len(), 1);
        assert_eq!(translated_line[0].kind, LineKind::Translation);
        assert_eq!(translated_line[0].item.text, "你好");

        // A missing translation sentence: the translation track has no such sentence, so the picture should show nothing. The original must never be substituted in.
        assert!(
            translated.active_layouts(3.0).is_empty(),
            "a sentence missing its translation lays out no lines in translation mode"
        );
        // Pixel-by-pixel confirmation that "nothing" also includes the subtitle background box: not a single byte of the whole frame may change.
        let mut frame = vec![24_u8; 640 * 360 * 4];
        translated.composite_bgra(&mut frame, 640 * 4, 3.0).unwrap();
        assert!(
            frame.iter().all(|&byte| byte == 24),
            "no text and no background box is drawn while a sentence is missing its translation"
        );

        // Bilingual mode semantics are unchanged: the original line appears as usual, only the missing translation line is absent, and no extra translation line appears using the original as a stand-in.

        let mut bilingual =
            OverlayRenderPlan::compile(&document, 640, 360, 4.0, 30.0, Some("bilingual")).unwrap();
        let bilingual_fallback = bilingual.active_layouts(3.0);
        assert_eq!(bilingual_fallback.len(), 1);
        assert_eq!(bilingual_fallback[0].kind, LineKind::Original);
        assert_eq!(bilingual_fallback[0].item.text, "Source fallback");

        // Left blank, so the envelope must count it even more clearly. Coverage comes from the same source as the line actually burned in above, and the difference is exactly the blanked s2. A missing translation that is invisible becomes a silent drop of a sentence only if it is not paired with a count.
        assert_eq!(sentence_translation_coverage(&document), (1, 2));
    }

    /// A sentence-boundary drift makes the old translation keys orphans: no entry in `trans` is missing, yet none of them attaches to any currently derived sentence id. Coverage must report 0/N, rather than being glossed over by the coarse "has a translation" check.
    #[test]
    fn sentence_coverage_counts_orphaned_translation_keys_as_missing() {
        let drifted = json!({
            "cues": [
                {"id": "q1", "start": 0.0, "end": 2.0, "text": "Hello there."},
                {"id": "q2", "start": 2.0, "end": 4.0, "text": "Source fallback."}
            ],
            "sentences": [
                {"id": "s-w1", "cueIds": ["q1"], "start": 0.0, "end": 2.0,
                    "text": "Hello there.", "trans": ""},
                {"id": "s-w4", "cueIds": ["q2"], "start": 2.0, "end": 4.0,
                    "text": "Source fallback.", "trans": ""}
            ],
            // Sentence ids under the old boundaries: the content is still there, but the keys no longer point to any sentence.
            "transCues": [
                {"id": "s-w0", "sid": "s-w0", "kind": "sentence",
                    "start": 0.0, "end": 4.0, "text": "你好，回退。"}
            ]
        });
        assert_eq!(sentence_translation_coverage(&drifted), (0, 2));

        // The same batch of transCues reattached to the correct sentence ids should give full coverage. The criterion is that the sids match, not that "transCues is non-empty".
        let mut anchored = drifted.clone();
        anchored["transCues"] = json!([
            {"id": "s-w1", "sid": "s-w1", "kind": "sentence",
                "start": 0.0, "end": 2.0, "text": "你好"},
            {"id": "s-w4", "sid": "s-w4", "kind": "sentence",
                "start": 2.0, "end": 4.0, "text": "回退"}
        ]);
        assert_eq!(sentence_translation_coverage(&anchored), (2, 2));
    }

    /// `--no-*` does not change the document, yet it decides which elements are drawn, so it must form a segment of its own in the frame cache key. The quality preset only changes the bitrate, not the pixels, so it must stay out of the key.
    #[test]
    fn include_flags_split_the_frame_cache_key() {
        let document = document("none", "none");
        let key = |includes: OverlayIncludes| {
            OverlayRenderPlan::compile_with(&document, 320, 180, 3.0, 30.0, None, includes)
                .unwrap()
                .definition_key
        };
        let base = key(OverlayIncludes::ALL);
        for includes in [
            OverlayIncludes {
                subtitles: false,
                ..OverlayIncludes::ALL
            },
            OverlayIncludes {
                texts: false,
                ..OverlayIncludes::ALL
            },
            OverlayIncludes {
                media_overlays: false,
                ..OverlayIncludes::ALL
            },
            OverlayIncludes {
                watermarks: false,
                ..OverlayIncludes::ALL
            },
        ] {
            assert_ne!(base, key(includes), "{includes:?} must produce a different cache key");
        }
        assert_eq!(base, key(OverlayIncludes::default()));
    }

    /// An export-time style override (`ccut export --to mp4 --sub-style`): this burn-in must be pixel-identical to "the project style is exactly this blob". The project's `studio/style.json` projection and the uncommitted style changes in `edits.json` are both excluded. And not a single byte of project state may be written.
    #[test]
    fn export_time_subtitle_style_override_replaces_project_style_and_pending_edits() {
        let temp = tempfile::tempdir().unwrap();
        let project = temp.path();
        fs::create_dir_all(project.join("studio")).unwrap();

        let mut data = positioned_bilingual_document();
        data["rev"] = json!(7);
        let project_style = data["style"].clone();
        let data_bytes = serde_json::to_vec_pretty(&data).unwrap();
        // A colour was changed on the page but not yet applied: this override is normally in effect.
        let edits = json!({
            "style": {
                "base": serde_json::to_string(&project_style).unwrap(),
                "value": {"fontColor": "#FF0000"}
            }
        });
        let edits_bytes = serde_json::to_vec_pretty(&edits).unwrap();
        fs::write(project.join("studio/data.json"), &data_bytes).unwrap();
        fs::write(project.join("studio/edits.json"), &edits_bytes).unwrap();

        let pending = load_preview_document(project).unwrap();
        assert_eq!(
            pending["style"]["fontColor"],
            json!("#FF0000"),
            "baseline premise: uncommitted style changes would otherwise reach the export"
        );

        let mut override_style = project_style.clone();
        override_style["fontColor"] = json!("#00FF00");
        override_style["fontSize"] = json!(44);
        override_style["transStyle"] = json!({"fontColor": "#FFCC00"});
        let style_path = temp.path().join("preset-style.json");
        fs::write(
            &style_path,
            serde_json::to_vec_pretty(&override_style).unwrap(),
        )
        .unwrap();

        let mut document = load_preview_document(project).unwrap();
        apply_subtitle_style_override(
            &mut document,
            load_subtitle_style_override(&style_path).unwrap(),
        );
        assert_eq!(
            document["style"], override_style,
            "the override replaces the whole style, it is not merged with the project style"
        );

        let mut expected = data.clone();
        expected["style"] = override_style.clone();
        assert_eq!(
            burned_rgba(&document),
            burned_rgba(&expected),
            "burn-in must be pixel-identical to the case where the project style already is this blob"
        );
        assert_ne!(
            burned_rgba(&document),
            burned_rgba(&pending),
            "uncommitted style changes must not take part in the preset export"
        );
        assert_ne!(
            burned_rgba(&document),
            burned_rgba(&data),
            "the project's own style must also not override the override blob"
        );

        assert_eq!(
            fs::read(project.join("studio/data.json")).unwrap(),
            data_bytes
        );
        assert_eq!(
            fs::read(project.join("studio/edits.json")).unwrap(),
            edits_bytes
        );
        assert!(
            !project.join("studio/style.json").exists(),
            "an export-time override must never be written back to project state"
        );
    }

    /// If the override file cannot be read, it must fail loudly. Silently falling back to the project style would give the user an output that looks normal but has the wrong style. Non-object JSON is especially dangerous: every `style.get()` would miss, and rendering would use an entire set of defaults.
    #[test]
    fn subtitle_style_override_rejects_missing_broken_and_non_object_files() {
        let temp = tempfile::tempdir().unwrap();
        let missing = temp.path().join("nope.json");
        let error = format!("{:#}", load_subtitle_style_override(&missing).unwrap_err());
        assert!(error.contains("read --sub-style"), "{error}");

        let broken = temp.path().join("broken.json");
        fs::write(&broken, b"{ \"fontSize\": ").unwrap();
        let error = format!("{:#}", load_subtitle_style_override(&broken).unwrap_err());
        assert!(error.contains("parse --sub-style"), "{error}");

        for raw in ["[]", "\"classic\"", "null", "42"] {
            let path = temp.path().join("not-object.json");
            fs::write(&path, raw).unwrap();
            let error = format!("{:#}", load_subtitle_style_override(&path).unwrap_err());
            assert!(
                error.contains("must have a top-level JSON object"),
                "{raw} must be rejected: {error}"
            );
        }
    }

    /// In intervals with no subtitles the frame is fully transparent, so mixing must be skipped entirely and the decoded base frame kept as is.
    #[test]
    fn blank_gap_frames_leave_base_untouched() {
        let mut doc = document("Color", "none");
        doc["cues"][0]["start"] = json!(2.0);
        doc["cues"][0]["end"] = json!(2.5);
        doc["cues"][0]["words"] = json!([]);
        let mut plan = OverlayRenderPlan::compile(&doc, 320, 180, 3.0, 30.0, None).unwrap();
        let mut frame = vec![24_u8; 320 * 180 * 4];
        plan.composite_bgra(&mut frame, 320 * 4, 0.5).unwrap();
        assert!(frame.iter().all(|&byte| byte == 24));
        let mut visible = vec![24_u8; 320 * 180 * 4];
        plan.composite_bgra(&mut visible, 320 * 4, 2.2).unwrap();
        assert!(visible.iter().any(|&byte| byte != 24));
    }

    /// The watermark is lifted to the top layer at render time (M5-B8, design document §20 #10).
    ///
    /// Two things are asserted together, because asserting only the first would let an implementation that reverses everything also pass:
    ///
    /// 1. **Across classes**: wherever the watermark is written, on whichever track and at whatever position within the track, it sorts after all non-watermarks.
    /// 2. **Stable within a class**: watermarks remain in document order (track first, then element) and are not reordered.
    ///
    /// This path serves both preview and CLI export, so it is also the guard that keeps the layer order identical at both ends.
    #[test]
    fn watermarks_are_hoisted_above_every_other_element_but_keep_their_own_order() {
        fn element(id: &str, watermark: bool) -> Value {
            let mut value = json!({
                "id": id, "kind": "text", "start": 0.0, "end": 3.0, "text": id
            });
            if watermark {
                value["role"] = json!("watermark");
            }
            value
        }

        let mut document = document("none", "none");
        document["timeline"] = json!({
            "tracks": [
                {"elements": [element("wm-first", true), element("plain-a", false)]},
                {"elements": [element("plain-b", false), element("wm-second", true)]}
            ]
        });

        let mut plan = OverlayRenderPlan::compile(&document, 320, 180, 3.0, 30.0, None).unwrap();
        // If timeline.json does not exist, the result is an empty TimelineDocument. These elements reference no media source, so the whole path never touches the disk, and the project directory can be given a path that does not exist.
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-b8-watermark-order"),
            &document,
        )
        .unwrap();

        let order: Vec<&str> = plan
            .elements
            .iter()
            .map(|element| element.id.as_str())
            .collect();
        assert_eq!(order, ["plain-a", "plain-b", "wm-first", "wm-second"]);
    }

    #[test]
    fn empty_optional_timeline_keeps_projected_video_pixels() {
        let project = tempfile::tempdir().unwrap();
        let media = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../render-raster/tests/fixtures/native-export/source.mp4");
        fs::write(
            project.path().join("project.json"),
            serde_json::to_vec(&json!({"media": {"path": media}})).unwrap(),
        )
        .unwrap();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "main": {"detached": true, "muted": true, "place": {"opacity": 0}},
            "tracks": [{"id": "video", "kind": "overlay", "elements": [{
                "id": "video-c1-1", "kind": "video", "srcId": "main",
                "start": 0.0, "end": 1.0, "srcStart": 0.0,
                "place": {"x": 50, "y": 50, "w": 100}
            }]}]
        });
        let render = || {
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 1.0, 30.0, None).unwrap();
            plan.load_timeline_elements(project.path(), &source)
                .unwrap();
            assert_eq!(plan.elements.len(), 1);
            let scene = plan.compositor_scene_frame(0.2).unwrap();
            assert!(!scene.nodes.is_empty(), "GPU preview must keep the video node");
            plan.render_rgba_frame(0.2).unwrap().rgba
        };
        let expected = render();
        assert!(
            expected
                .chunks_exact(4)
                .any(|p| p[3] > 0 && p[..3].iter().any(|c| *c > 20))
        );
        for contents in ["", " \t\r\n"] {
            fs::write(project.path().join("timeline.json"), contents).unwrap();
            assert_eq!(render(), expected, "an empty timeline should render the same pixels as no timeline");
            assert_eq!(
                fs::read_to_string(project.path().join("timeline.json")).unwrap(),
                contents,
                "preview is read-only and must not modify the user's project"
            );
        }
        fs::write(project.path().join("timeline.json"), "{\"ccutTimeline\":").unwrap();
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 1.0, 30.0, None).unwrap();
        assert!(
            plan.load_timeline_elements(project.path(), &source)
                .is_err(),
            "a non-empty corrupt JSON must not swallow the error and be treated as a default timeline"
        );
    }

    /// A separated main video is an ordinary video element. Stacking depends only on track order (the later in `tracks[]`, the higher). Moved above the graphics track, it covers the graphics, and the CPU raster and the GPU scene use the same order. Export restores the identity main video to the base image only when it was already the bottom layer (`reattach_identity_main` in `ccut-kernel`). This test guards that the rendering layer itself does not give `srcId: main` a separate special case.
    #[test]
    fn detached_main_video_stacks_by_track_order() {
        let project = tempfile::tempdir().unwrap();
        let media = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../render-raster/tests/fixtures/native-export/source.mp4");
        fs::write(
            project.path().join("project.json"),
            serde_json::to_vec(&json!({"media": {"path": media}})).unwrap(),
        )
        .unwrap();
        let video_track = json!({"id": "video-track", "kind": "overlay", "elements": [{
            "id": "video-c1-1", "kind": "video", "srcId": "main",
            "start": 0.0, "end": 1.0, "srcStart": 0.0, "mode": "pip", "fit": "contain",
            "place": {"w": 100}
        }]});
        let shape_track = json!({"id": "shapes", "kind": "overlay", "elements": [{
            "id": "cover", "kind": "shape", "start": 0.0, "end": 1.0,
            "shape": {"shape": "rect", "fill": "#FF00FF"},
            "place": {"x": 50, "y": 50, "w": 100}
        }]});
        for (tracks, video_on_top) in [
            (json!([shape_track, video_track]), true),
            (json!([video_track, shape_track]), false),
        ] {
            let mut source = document("none", "none");
            source["cues"] = json!([]);
            source["timeline"] = json!({
                "main": {"detached": true, "muted": true, "place": {"opacity": 0}},
                "tracks": tracks
            });
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 1.0, 30.0, None).unwrap();
            plan.load_timeline_elements(project.path(), &source)
                .unwrap();
            let order: Vec<&str> = plan.elements.iter().map(|e| e.id.as_str()).collect();
            let expected = if video_on_top {
                ["cover", "video-c1-1"]
            } else {
                ["video-c1-1", "cover"]
            };
            assert_eq!(order, expected);

            let rgba = plan.render_rgba_frame(0.2).unwrap().rgba;
            let centre = (90 * 320 + 160) * 4;
            let [r, g, b] = [rgba[centre], rgba[centre + 1], rgba[centre + 2]];
            let magenta = r > 200 && g < 60 && b > 200;
            assert_eq!(
                magenta, !video_on_top,
                "video_on_top={video_on_top}: centre pixel {:?}",
                [r, g, b]
            );

            let scene = plan.compositor_scene_frame(0.2).unwrap();
            assert_eq!(
                matches!(
                    scene.nodes.last(),
                    Some(element_draw::SceneNode::Texture(_))
                ),
                video_on_top,
                "top-most node of the GPU scene: {:?}",
                scene.nodes.last().map(std::mem::discriminant)
            );
        }
    }

    #[test]
    fn timeline_image_sources_decode_and_loop_gif_frames() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/stripes.gif"),
            include_bytes!("../../render-raster/tests/fixtures/animated/stripes.gif"),
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.3",
            "sources": {
                "gif": {"path": "media/stripes.gif", "kind": "image", "duration": 0.0}
            },
            "tracks": [{"id": "broll", "kind": "overlay", "elements": [{
                "id": "gif-broll", "kind": "image", "role": "broll",
                "start": 0.0, "end": 3.0, "srcId": "gif",
                "place": {"x": 50, "y": 50, "w": 50}
            }]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();

        assert!(plan.media.base.has_animated("gif"));
        let first = plan.render_rgba_frame(0.05).unwrap();
        let second = plan.render_rgba_frame(0.15).unwrap();
        let looped = plan.render_rgba_frame(1.05).unwrap();
        assert_ne!(first.draw_op_fingerprint, second.draw_op_fingerprint);
        assert_eq!(first.draw_op_fingerprint, looped.draw_op_fingerprint);
        assert_eq!(first.rgba, looped.rgba);
        assert!(
            first
                .next_change
                .is_some_and(|next| next <= 0.05 + 1.0 / 30.0)
        );
    }

    #[test]
    fn preview_media_failure_skips_only_its_element_and_strict_export_still_fails() {
        let project = tempfile::tempdir().unwrap();
        let timeline = json!({
            "ccutTimeline": "0.3",
            "sources": {
                "missing": {"path": "media/missing.png", "kind": "image", "duration": 0.0}
            },
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [
                {
                    "id": "title", "kind": "text", "start": 0.0, "end": 3.0,
                    "text": "still visible", "place": {"x": 50, "y": 50, "w": 60}
                },
                {
                    "id": "broken", "kind": "image", "start": 0.0, "end": 3.0,
                    "srcId": "missing", "place": {"x": 20, "y": 20, "w": 20}
                }
            ]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;

        let mut strict = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert!(
            strict
                .load_timeline_elements(project.path(), &source)
                .unwrap_err()
                .to_string()
                .contains("source media does not exist")
        );

        let mut preview = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        preview
            .load_timeline_elements_with_policy(
                project.path(),
                &source,
                TimelineMediaFailurePolicy::SkipFailedElement,
            )
            .unwrap();
        assert_eq!(
            preview
                .elements
                .iter()
                .map(|element| element.id.as_str())
                .collect::<Vec<_>>(),
            ["title"]
        );
        assert!(
            preview
                .warnings()
                .iter()
                .any(|warning| warning.contains("missing") && warning.contains("skipped"))
        );
        assert!(
            preview
                .render_rgba_frame(1.0)
                .unwrap()
                .rgba
                .chunks_exact(4)
                .any(|pixel| pixel[3] > 0),
            "a broken image must not also clear the text on the same overlay"
        );
    }

    // ── Template layer ────────────────────────────────────────────────────────

    /// A template with only one full-width chapter bar: `y` and `h` are percentages of the frame.
    ///
    /// It constructs `TemplateScene` directly rather than registering a fake host. The discipline stated at the top of this file forbids creating a second `OverlayHost` implementation. It does not forbid feeding that host its outputs.
    fn chapter_bar_doc(y: f64, h: f64) -> timeline::template::TemplateDoc {
        use timeline::template::{ChapterFill, LayerBox, LayerKind, TemplateLayer};
        let mut doc = timeline::template::blank(timeline::template::TemplateCanvas::Wide);
        doc.layers.push(TemplateLayer {
            id: "bar".to_string(),
            on: true,
            rect: LayerBox::new(0.0, y, 100.0, h),
            kind: LayerKind::Chapters {
                fill: ChapterFill::Bar,
                bg: "#F5D642".to_string(),
                color: "#000000".to_string(),
                accent: "#000000".to_string(),
                color_done: None,
                divider: false,
                size: 3.0,
            },
        });
        doc
    }

    fn chrome_scene(y: f64, h: f64) -> TemplateScene {
        TemplateScene::new(chapter_bar_doc(y, h), vec![], "T", vec![])
    }

    fn sha256_hex(bytes: &[u8]) -> String {
        lower_hex(&Sha256::digest(bytes))
    }

    fn alpha_rows(rgba: &[u8], width: u32, row: u32) -> u64 {
        let start = (row as usize) * (width as usize) * 4;
        rgba[start..start + width as usize * 4]
            .chunks_exact(4)
            .map(|pixel| u64::from(pixel[3]))
            .sum()
    }

    /// The template layer is really drawn into the frame that appears on screen or in export, and it lands where the layer declares.
    ///
    /// Two discriminators: ① without a template, that row must be fully transparent (otherwise the test measures something else); ② outside the template band, the rows must still be fully transparent (otherwise the whole frame would have been painted).
    #[test]
    fn a_template_layer_paints_into_the_overlay_frame() {
        let document = document("none", "none");
        let mut plain = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        let before = plain.render_rgba(1.0).unwrap();
        assert_eq!(alpha_rows(&before, 640, 4), 0, "the top bar must be fully transparent without a template");

        let mut plan = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        // Top 48px ⇒ 13.33% of a 360-high canvas
        plan.set_template_scene(Some(chrome_scene(0.0, 48.0 / 3.6)));
        let after = plan.render_rgba(1.0).unwrap();
        assert!(alpha_rows(&after, 640, 4) > 0, "the top bar should be filled by the template layer");
        // A top template does not trigger subtitle avoidance: line 200 has a subtitle, and the two renders must be byte-identical
        let row = |rgba: &[u8]| rgba[200 * 640 * 4..201 * 640 * 4].to_vec();
        assert_eq!(row(&before), row(&after), "nothing outside the template band should be painted");
        assert_ne!(before, after, "this frame with a template must not be byte-identical to one without");
    }

    /// The browser's template-layer output: cropped to the template band's sub-rectangle, with alpha consistent with that band in the full overlay.
    #[test]
    fn the_template_raster_layer_is_the_cropped_chrome_band() {
        let document = document("none", "none");
        let mut plain = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        assert!(plain.render_template_raster_layer(1.0).unwrap().is_none());

        let mut plan = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        plan.set_template_scene(Some(chrome_scene(0.0, 48.0 / 3.6)));
        let layer = plan.render_template_raster_layer(1.0).unwrap().unwrap();
        assert!(layer.key.starts_with("tplchrome:"), "{}", layer.key);
        assert_eq!((layer.x, layer.y, layer.width), (0, 0, 640));
        assert!(
            (1..=49).contains(&layer.height),
            "band containing only the top 48px: {}",
            layer.height
        );
        assert_eq!(layer.rgba.len(), (layer.width * layer.height * 4) as usize);
        assert_eq!(layer.composite, CaptionCompositeMode::Normal);
        let overlay = plan.render_rgba(1.0).unwrap();
        assert_eq!(
            alpha_rows(&layer.rgba, layer.width, 4),
            alpha_rows(&overlay, 640, 4),
            "the sub-rectangle's alpha matches the same row of the full overlay"
        );
        let again = plan.render_template_raster_layer(1.0).unwrap().unwrap();
        assert_eq!(again.key, layer.key, "same frame, same key");
        assert!(layer.next_change.is_some(), "the template layer must give the next change frame by frame");
    }

    /// The wasm host's template input: the chapter table is filtered by the stated criteria, the logo keys are taken from the document, and the pixels passed in are premultiplied.
    #[test]
    fn template_source_parses_chapters_and_premultiplies_logos() {
        let mut doc = logo_doc((10.0, 10.0, 20.0, 10.0), false, 1.0);
        let mut second = doc.layers[0].clone();
        second.id = "wm2".to_string();
        for layer in [&mut doc.layers[0], &mut second] {
            if let timeline::template::LayerKind::Logo { src, .. } = &mut layer.kind {
                *src = timeline::template::LogoSrc::File {
                    file: "media/logo.png".to_string(),
                };
            }
        }
        doc.layers.push(second);
        let value = serde_json::to_value(&doc).unwrap();
        let chapters = json!([
            {"id": "c1", "title": "开场", "start": 0.0, "end": 2.0},
            {"id": "c2", "title": "缺尾", "start": 2.0},
            {"id": "c3", "title": "零长", "start": 3.0, "end": 3.0},
        ]);
        let mut source =
            TemplateSource::from_json(&value.to_string(), &chapters.to_string(), "标题").unwrap();
        assert_eq!(source.logo_keys(), vec!["media/logo.png".to_string()]);
        let scene = source.scene();
        assert_eq!(scene.chapters.len(), 1);
        assert_eq!(scene.chapters[0].title, "开场");
        assert_eq!(scene.title, "标题");
        assert!(scene.logos.is_empty());

        assert!(
            source
                .set_logo_rgba("media/logo.png", 2, 1, vec![0; 4])
                .is_err()
        );
        source
            .set_logo_rgba("media/logo.png", 1, 1, vec![255, 0, 0, 128])
            .unwrap();
        let with_logo = source.scene();
        assert_eq!(with_logo.logos["media/logo.png"].data(), &[128, 0, 0, 128]);
        assert_ne!(
            with_logo.fingerprint, scene.fingerprint,
            "logo pixels enter the scene fingerprint"
        );
        assert!(TemplateSource::from_json("{", "[]", "").is_err());
    }

    /// The DrawOp fingerprint must follow the template layer's pixels. If the resource name does not carry this frame's pixel identity, the client would treat a moving chapter bar as "unchanged" and reuse the old image.
    #[test]
    fn the_frame_identity_follows_the_template_pixels() {
        let document = document("none", "none");
        let mut plain = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        let bare = plain.render_overlay_frame(1.0).unwrap().draw_op_fingerprint;

        let mut thin = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        thin.set_template_scene(Some(chrome_scene(0.0, 6.0)));
        let thin_id = thin.render_overlay_frame(1.0).unwrap().draw_op_fingerprint;

        let mut thick = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        thick.set_template_scene(Some(chrome_scene(0.0, 12.0)));
        let thick_id = thick.render_overlay_frame(1.0).unwrap().draw_op_fingerprint;
        let later_id = thick.render_overlay_frame(2.0).unwrap().draw_op_fingerprint;

        assert_ne!(bare, thin_id, "applying a template must change the whole-frame identity");
        assert_ne!(thin_id, thick_id, "a different template drawing must change the whole-frame identity");
        assert_ne!(
            thick_id, later_id,
            "the chapter bar's progress colour advances over time, so frame identity must change frame by frame"
        );
    }

    /// Layer boxes are percentages of the frame. The same template drawn on canvases of different sizes takes up rows in proportion.
    #[test]
    fn a_template_layer_scales_to_the_overlay_canvas() {
        let document = document("none", "none");
        let mut plan = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        // A top bar of 6.67% ⇒ 24px on a 360-high canvas
        plan.set_template_scene(Some(chrome_scene(0.0, 24.0 / 3.6)));
        let rgba = plan.render_rgba(1.0).unwrap();
        assert!(alpha_rows(&rgba, 640, 20) > 0, "row 20 should still be inside the top bar");
        assert_eq!(alpha_rows(&rgba, 640, 30), 0, "row 30 should already be below the top bar");
        // The whole row is filled: if the horizontal percentage were dropped, only the left half would remain.
        let row = &rgba[4 * 640 * 4..5 * 640 * 4];
        assert!(
            row.chunks_exact(4).all(|pixel| pixel[3] > 0),
            "the top bar must span the whole frame, not just the left half"
        );
    }

    /// Subtitle avoidance: when a full-width template band sits at the bottom, the subtitle anchor line is raised to the band's upper edge (prototype `subsBottom`).
    ///
    /// It goes through `stack_layout`, the only funnel. The discriminator is that it "only moves the position and does not change the appearance": the font size must not change by a single pixel. With a top template, or with `subsAvoid` off, it does not raise.
    #[test]
    fn a_bottom_template_strip_lifts_the_subtitle_stack_without_restyling_it() {
        let document = document("none", "none");
        let plain = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        let plain_anchor = plain.stack_layout(&[], 1.0).anchor;
        let plain_size = plain.original_style.font_size;
        assert!(
            (plain_anchor.1 - 360.0 * 0.86).abs() < 1e-6,
            "the default anchor line is at 86%"
        );

        // A bottom chapter bar at y=80% with height 20% ⇒ subs_bottom = 22 ⇒ the anchor line is at most 78%
        let mut lifted = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        lifted.set_template_scene(Some(chrome_scene(80.0, 20.0)));
        let lifted_anchor = lifted.stack_layout(&[], 1.0).anchor;
        assert!(
            (lifted_anchor.1 - 360.0 * 0.78).abs() < 1e-6,
            "{lifted_anchor:?}"
        );
        assert_eq!(
            lifted.original_style.font_size, plain_size,
            "avoidance only affects placement; font size must not change"
        );

        // A top template does not trigger avoidance
        let mut top = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        top.set_template_scene(Some(chrome_scene(0.0, 12.0)));
        assert_eq!(top.stack_layout(&[], 1.0).anchor, plain_anchor);

        // With subsAvoid turned off, there is no avoidance either
        let mut doc = chapter_bar_doc(80.0, 20.0);
        doc.subs_avoid = false;
        let mut off = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        off.set_template_scene(Some(TemplateScene::new(doc, vec![], "T", vec![])));
        assert_eq!(off.stack_layout(&[], 1.0).anchor, plain_anchor);

        // Removing the template restores the original position
        lifted.set_template_scene(None);
        assert_eq!(lifted.stack_layout(&[], 1.0).anchor, plain_anchor);
    }

    /// The element fingerprint output is the cross-engine gate. The template layer is rasterised by the host, so it must actively refuse rather than return a number it cannot match.
    #[test]
    fn the_element_fingerprint_refuses_to_speak_for_a_template_layer() {
        let document = document("none", "none");
        let mut plan = OverlayRenderPlan::compile(&document, 640, 360, 3.0, 30.0, None).unwrap();
        plan.set_template_scene(Some(chrome_scene(0.0, 12.0)));
        let error = plan
            .element_drawop_fingerprint(1.0)
            .unwrap_err()
            .to_string();
        assert!(error.contains("template layer"), "{error}");
    }

    /// The seventeen built-in templates (Simplified Chinese word list): one frame each in two aspect ratios, plus three font states, with pixel sha256 cross-checked against golden.
    ///
    /// As with the other goldens, `CCUT_UPDATE_GOLDEN=1` rewrites them. The discriminator is that each one is different: between the seventeen templates, between the two aspect ratios of the same template, and between the three font resolutions, no two images may be identical.
    #[test]
    fn builtin_templates_render_to_golden_frames() {
        use timeline::template::ChapterSpan;
        let chapters = vec![
            // Latin title: CJK would be forced by the font engine onto Noto Sans SC, so the three font states would show no difference
            ChapterSpan {
                id: "c1".into(),
                title: "Intro".into(),
                start: 0.0,
                end: 1.0,
            },
            ChapterSpan {
                id: "c2".into(),
                title: "Method".into(),
                start: 1.0,
                end: 2.2,
            },
            ChapterSpan {
                id: "c3".into(),
                title: "Wrap".into(),
                start: 2.2,
                end: 3.0,
            },
        ];
        // Built-in font set in strict mode: system fonts are not touched, so the pixels are bit-identical on any machine
        let fonts = bundled_studio_fonts();
        let mut hashes = std::collections::BTreeMap::new();
        for doc in timeline::template::builtins() {
            for (label, w, h) in [("16x9", 320u32, 180u32), ("9x16", 180, 320)] {
                let scene = TemplateScene::new(doc.clone(), chapters.clone(), "科浪访谈", vec![]);
                let mut engine = TextEngine::with_document_fonts(&fonts);
                let pixmap = crate::template_layer::raster(
                    &scene,
                    crate::template_layer::FrameParams {
                        time: 1.5,
                        duration: 3.0,
                        width: w,
                        height: h,
                        fallback_family: "VK Sans",
                    },
                    &mut engine,
                    false,
                )
                .unwrap();
                assert!(
                    pixmap.data().iter().any(|byte| *byte > 0),
                    "{}/{label} was drawn empty",
                    doc.id
                );
                hashes.insert(format!("{}/{label}", doc.id), sha256_hex(pixmap.data()));
            }
        }
        // Three font states: the mono layer is always monospace, the template carries its own font, and a missing family falls back to the subtitle font
        let mut mono = chapter_bar_doc(0.0, 12.0);
        mono.layers.push(timeline::template::TemplateLayer {
            id: "clock".to_string(),
            on: true,
            rect: timeline::template::LayerBox::new(60.0, 40.0, 36.0, 12.0),
            kind: timeline::template::LayerKind::Text {
                text: "{time} / {total}".to_string(),
                color: "#FFFFFF".to_string(),
                bg: Some("#000000A0".to_string()),
                align: timeline::template::TextAlign::Right,
                size: 6.0,
                pad: None,
                mono: true,
                weight: 700,
            },
        });
        let render = |doc: timeline::template::TemplateDoc| {
            let scene = TemplateScene::new(doc, chapters.clone(), "T", vec![]);
            let mut engine = TextEngine::with_document_fonts(&fonts);
            crate::template_layer::raster(
                &scene,
                crate::template_layer::FrameParams {
                    time: 1.5,
                    duration: 3.0,
                    width: 320,
                    height: 180,
                    fallback_family: "VK Sans",
                },
                &mut engine,
                false,
            )
            .unwrap()
        };
        hashes.insert(
            "font/mono".to_string(),
            sha256_hex(render(mono.clone()).data()),
        );
        let mut serif = mono.clone();
        serif.font = Some("Alata".to_string());
        hashes.insert("font/custom".to_string(), sha256_hex(render(serif).data()));
        let mut missing = mono.clone();
        missing.font = Some("No Such Family 42".to_string());
        hashes.insert(
            "font/missing".to_string(),
            sha256_hex(render(missing).data()),
        );
        // Missing-family fallback = follow the subtitle font, byte-identical to not declaring a font at all
        assert_eq!(
            hashes["font/missing"], hashes["font/mono"],
            "a missing family must fall back to fallback_family"
        );

        let distinct: std::collections::BTreeSet<_> = hashes.values().collect();
        // Only font/missing and font/mono are allowed to be the same
        assert_eq!(distinct.len(), hashes.len() - 1, "{hashes:#?}");

        let golden = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/golden/template-layer-frames.json");
        let actual = serde_json::to_string_pretty(&hashes).unwrap();
        if std::env::var_os("CCUT_UPDATE_GOLDEN").is_some() {
            std::fs::create_dir_all(golden.parent().unwrap()).unwrap();
            std::fs::write(&golden, format!("{actual}\n")).unwrap();
        }
        let expected = std::fs::read_to_string(&golden).unwrap_or_else(|e| {
            panic!("read {}: {e} (generate with CCUT_UPDATE_GOLDEN=1)", golden.display())
        });
        assert_eq!(
            expected.trim_end(),
            actual,
            "template layer golden drift (if the change is intended, rewrite with CCUT_UPDATE_GOLDEN=1)"
        );
    }

    /// A template with one text-logo layer (a black badge, so alpha can be measured precisely). The box, `tile` and `opacity` are adjustable.
    fn logo_doc(
        rect: (f64, f64, f64, f64),
        tile: bool,
        opacity: f64,
    ) -> timeline::template::TemplateDoc {
        use timeline::template::{
            LayerBox, LayerKind, LogoShape, LogoSrc, TemplateLayer, TextAlign,
        };
        let mut doc = timeline::template::blank(timeline::template::TemplateCanvas::Wide);
        doc.layers.push(TemplateLayer {
            id: "wm".to_string(),
            on: true,
            rect: LayerBox::new(rect.0, rect.1, rect.2, rect.3),
            kind: LayerKind::Logo {
                src: LogoSrc::TEXT,
                text: "BRAND".to_string(),
                bg: Some("#000000".to_string()),
                color: "#FFFFFF".to_string(),
                shape: LogoShape::Badge,
                size: 6.0,
                pad: None,
                tile,
                opacity,
                align: TextAlign::Center,
            },
        });
        doc
    }

    fn render_logo_doc(doc: timeline::template::TemplateDoc, editing_dim: bool) -> Pixmap {
        let fonts = bundled_studio_fonts();
        let mut engine = TextEngine::with_document_fonts(&fonts);
        crate::template_layer::raster(
            &TemplateScene::new(doc, vec![], "T", vec![]),
            crate::template_layer::FrameParams {
                time: 0.0,
                duration: 3.0,
                width: 320,
                height: 180,
                fallback_family: "VK Sans",
            },
            &mut engine,
            editing_dim,
        )
        .unwrap()
    }

    fn max_alpha(pixmap: &Pixmap) -> u8 {
        pixmap
            .pixels()
            .iter()
            .map(|px| px.alpha())
            .max()
            .unwrap_or(0)
    }

    /// The logo layer's `opacity` is the opacity of the whole layer (clamped to 0.05–1). A layer that is off is fixed at 0.35 in editing mode and is not multiplied by the layer's own opacity (prototype `opacity: !l.on ? 0.35 : layerOpacity(l)`).
    #[test]
    fn logo_opacity_fades_the_whole_layer() {
        let solid = render_logo_doc(logo_doc((10.0, 10.0, 40.0, 20.0), false, 1.0), false);
        assert_eq!(max_alpha(&solid), 255);
        let half = max_alpha(&render_logo_doc(
            logo_doc((10.0, 10.0, 40.0, 20.0), false, 0.5),
            false,
        ));
        assert!((127..=128).contains(&half), "0.5 → {half}");
        let floor = max_alpha(&render_logo_doc(
            logo_doc((10.0, 10.0, 40.0, 20.0), false, 0.0),
            false,
        ));
        assert!((12..=13).contains(&floor), "0 clamped to 0.05 → {floor}");
        let mut off = logo_doc((10.0, 10.0, 40.0, 20.0), false, 0.5);
        off.layers[0].on = false;
        let dim = max_alpha(&render_logo_doc(off, true));
        assert!((89..=90).contains(&dim), "edit state of the hidden layer at 0.35 → {dim}");
    }

    /// Logo layer `align` (2026-09-15): the badge background still fills the box, and the text sits left, centred or right within the badge's padding. For an image logo, after it is fitted proportionally into the box, the horizontal slack is likewise split by the alignment.
    #[test]
    fn logo_align_places_text_and_image_inside_the_box() {
        use timeline::template::{LayerKind, LogoSrc, TemplateDoc, TextAlign};
        fn aligned(mut doc: TemplateDoc, value: TextAlign) -> TemplateDoc {
            if let LayerKind::Logo { align, .. } = &mut doc.layers[0].kind {
                *align = value;
            }
            doc
        }
        // Horizontal span of the qualifying pixels: (leftmost column, rightmost column)
        fn span(pixmap: &Pixmap, lit: impl Fn(u8, u8) -> bool) -> (usize, usize) {
            let width = pixmap.width() as usize;
            let xs: Vec<usize> = pixmap
                .pixels()
                .iter()
                .enumerate()
                .filter(|(_, px)| lit(px.red(), px.alpha()))
                .map(|(i, _)| i % width)
                .collect();
            (
                *xs.iter().min().expect("expected ink"),
                *xs.iter().max().expect("expected ink"),
            )
        }
        // Box = frame (32,18)–(160,54); font size 6% × 180 = 10.8px; badge padding 0.6em ≈ 6.5px
        let frame = |value| {
            render_logo_doc(
                aligned(logo_doc((10.0, 10.0, 40.0, 20.0), false, 1.0), value),
                false,
            )
        };
        let white = |pixmap: &Pixmap| span(pixmap, |red, _| red > 128);
        let (left, center, right) = (
            frame(TextAlign::Left),
            frame(TextAlign::Center),
            frame(TextAlign::Right),
        );
        for pixmap in [&left, &center, &right] {
            assert_eq!(
                span(pixmap, |_, alpha| alpha == 255),
                (32, 159),
                "background fills the box"
            );
        }
        let (l, c, r) = (white(&left), white(&center), white(&right));
        assert!((38..=42).contains(&l.0), "left-aligned: text starts at the inner padding {l:?}");
        assert!((150..=154).contains(&r.1), "right-aligned: text ends before the inner padding {r:?}");
        let mid = (c.0 + c.1) as f64 / 2.0;
        assert!((mid - 96.0).abs() <= 2.0, "centered {c:?}");
        assert!(l.0 < c.0 && c.0 < r.0, "{l:?} {c:?} {r:?}");
        assert!(
            (l.1 - l.0).abs_diff(r.1 - r.0) <= 1,
            "only translated, not distorted {l:?} {r:?}"
        );

        let mut image = Pixmap::new(10, 10).unwrap();
        image.fill(tiny_skia::Color::from_rgba8(255, 0, 0, 255));
        let fonts = bundled_studio_fonts();
        let mut engine = TextEngine::with_document_fonts(&fonts);
        let mut picture = |value| {
            let mut doc = aligned(logo_doc((10.0, 10.0, 40.0, 20.0), false, 1.0), value);
            if let LayerKind::Logo { src, .. } = &mut doc.layers[0].kind {
                *src = LogoSrc::brand("logo-1");
            }
            let scene =
                TemplateScene::new(doc, vec![], "T", vec![("logo-1".into(), image.clone())]);
            let pixmap = crate::template_layer::raster(
                &scene,
                crate::template_layer::FrameParams {
                    time: 0.0,
                    duration: 3.0,
                    width: 320,
                    height: 180,
                    fallback_family: "VK Sans",
                },
                &mut engine,
                false,
            )
            .unwrap();
            span(&pixmap, |_, alpha| alpha > 128)
        };
        // 10×10 fitted into 128×36 gives 36×36; the 92px of slack is entirely on the right, split evenly on both sides, or entirely on the left
        assert_eq!(picture(TextAlign::Left), (32, 67));
        assert_eq!(picture(TextAlign::Center), (78, 113));
        assert_eq!(picture(TextAlign::Right), (124, 159));
    }

    /// A fixed `pad` is computed against the frame height and is independent of font size, so logo text and text layers of different font sizes start from the same vertical line. When it is not set, each still derives from its own font size (badge 0.6em, text layer 0.5em), so their starting lines are offset by font size.
    #[test]
    fn explicit_pad_lines_up_text_of_different_sizes() {
        use timeline::template::{LayerBox, LayerKind, TemplateLayer, TextAlign};
        // Box = frame (32,18)–(288,72); font sizes 6% / 9% / 14% × 180 = 10.8 / 16.2 / 25.2px
        let doc = |size: f64, logo: bool, pad: Option<f64>| {
            let mut doc = logo_doc((10.0, 10.0, 80.0, 30.0), false, 1.0);
            if logo {
                if let LayerKind::Logo {
                    size: slot,
                    align,
                    pad: inset,
                    ..
                } = &mut doc.layers[0].kind
                {
                    *slot = size;
                    *align = TextAlign::Left;
                    *inset = pad;
                }
            } else {
                doc.layers[0] = TemplateLayer {
                    id: "tx".to_string(),
                    on: true,
                    rect: LayerBox::new(10.0, 10.0, 80.0, 30.0),
                    kind: LayerKind::Text {
                        text: "BRAND".to_string(),
                        color: "#FFFFFF".to_string(),
                        bg: Some("#000000".to_string()),
                        align: TextAlign::Left,
                        size,
                        pad,
                        mono: false,
                        weight: 800,
                    },
                };
            }
            doc
        };
        // Leftmost column of the white text
        let start = |doc| {
            let pixmap = render_logo_doc(doc, false);
            let width = pixmap.width() as usize;
            pixmap
                .pixels()
                .iter()
                .enumerate()
                .filter(|(_, px)| px.red() > 128)
                .map(|(i, _)| i % width)
                .min()
                .expect("expected ink")
        };
        let cases = [(6.0, true), (9.0, false), (14.0, false)];
        let starts = |pad: Option<f64>| -> Vec<usize> {
            cases
                .iter()
                .map(|&(size, logo)| start(doc(size, logo, pad)))
                .collect()
        };
        let spread = |xs: &[usize]| xs.iter().max().unwrap() - xs.iter().min().unwrap();
        // pad 5% × 180 = 9px: the text starts at 32 + 9 = 41, differing only by the glyph's own left-side bearing (which grows slightly with font size)
        let fixed = starts(Some(5.0));
        assert!(
            fixed.iter().all(|x| (41..=44).contains(x)),
            "stroke starts at the box's left edge + 9px: {fixed:?}"
        );
        assert!(spread(&fixed) <= 2, "three layers share one stroke start line: {fixed:?}");
        // Not set: 6.5 / 8.1 / 12.6px, so the three starting lines are offset
        let legacy = starts(None);
        assert!(spread(&legacy) >= 5, "padding derived from font size is misaligned: {legacy:?}");
        // 0 means flush against the box's left edge
        let flush = starts(Some(0.0));
        assert!(flush.iter().all(|x| (32..=35).contains(x)), "{flush:?}");
    }

    /// Tiled logo: the same logo is tiled into the box and then tilted diagonally about the box centre and enlarged. The ink spills beyond the box (the corners after enlargement and rotation), but the four corners of the frame stay clean (`overflow: hidden` clips against the box before the transform, so it rotates with the layer).
    #[test]
    fn tiled_logo_spills_past_its_box_but_clips_to_the_rotated_box() {
        let flat = render_logo_doc(logo_doc((25.0, 25.0, 50.0, 50.0), false, 1.0), false);
        let tiled = render_logo_doc(logo_doc((25.0, 25.0, 50.0, 50.0), true, 1.0), false);
        assert_ne!(sha256_hex(flat.data()), sha256_hex(tiled.data()));
        // Box = frame (80,45)–(240,135)
        let outside = |pixmap: &Pixmap| {
            (0..pixmap.height())
                .flat_map(|y| (0..pixmap.width()).map(move |x| (x, y)))
                .filter(|&(x, y)| !(80..240).contains(&x) || !(45..135).contains(&y))
                .filter(|&(x, y)| pixmap.pixel(x, y).is_some_and(|px| px.alpha() > 0))
                .count()
        };
        assert_eq!(outside(&flat), 0, "non-tiled layers do not extend past the box");
        assert!(outside(&tiled) > 0, "tiled and rotated then scaled up should extend past the box");
        for (x, y) in [(0, 0), (319, 0), (0, 179), (319, 179)] {
            assert_eq!(
                tiled.pixel(x, y).unwrap().alpha(),
                0,
                "({x},{y}) is outside the rotated box"
            );
        }
    }

    /// The tile arrangement is the prototype's flex wrapping: `padding: 1em`, `gap: 1.6em 2.4em`, with both in-line and between-line `space-around`. When it does not fit, it sticks to the start per `safe center` and overflows.
    #[test]
    fn tile_layout_follows_flex_wrap_space_around() {
        use crate::template_layer::{TILE_UNITS, tile_positions};
        // 1000×500 box, em 10, cell 50×12: content 980×480, 13 per row (13·50 + 12·24 = 938 ≤ 980)
        let pos = tile_positions(1000.0, 500.0, 10.0, 50.0, 12.0, TILE_UNITS);
        assert_eq!(pos.len(), 24);
        let (first, second) = pos.split_at(13);
        assert!(first.iter().all(|p| p.1 == first[0].1));
        assert!(second.iter().all(|p| p.1 == second[0].1));
        assert!(second[0].1 > first[0].1);
        // In-line space-around: equal margins at the first and last items; the first item's margin = remainder / (2n)
        let lead = first[0].0 - 10.0;
        assert!((lead - 42.0 / 26.0).abs() < 1e-9, "{lead}");
        assert!((lead - (990.0 - (first[12].0 + 50.0))).abs() < 1e-9);
        let lead2 = second[0].0 - 10.0;
        assert!((lead2 - (990.0 - (second[10].0 + 50.0))).abs() < 1e-9);
        // Between-line space-around: equal margins above and below
        let top = first[0].1 - 10.0;
        assert!((top - (490.0 - (second[0].1 + 12.0))).abs() < 1e-9);
        assert!((top - (480.0 - 24.0 - 16.0) / 4.0).abs() < 1e-9, "{top}");
        // Not even one fits: still lay out one, overflowing horizontally from the start (`safe center`); vertically, if it fits, still use space-around as usual
        let tight = tile_positions(40.0, 40.0, 10.0, 50.0, 12.0, 1);
        assert_eq!(tight, vec![(10.0, 10.0 + 4.0)]);
        // Row overflow (the prototype stage's 14% × 8% logo box tiling 24 rows): the first row sticks to the padding and does not overflow upward
        let rows = tile_positions(82.3, 26.5, 10.6, 33.9, 16.9, TILE_UNITS);
        assert_eq!(rows.len(), 24);
        assert!((rows[0].1 - 10.6).abs() < 1e-9, "{:?}", rows[0]);
        assert!(
            (rows[1].1 - rows[0].1 - (16.9 + 16.96)).abs() < 1e-9,
            "{:?}",
            rows[1]
        );
        assert!((rows[0].0 - 24.2).abs() < 0.05, "{:?}", rows[0]);
    }

    /// The R1 scene output must be assembled from a real Overlay plan, not a `SceneFrame` hand-written by the test. The three identities (node order, fingerprint and scheduled moment) are pinned down together here.
    #[test]
    fn the_element_scene_is_assembled_from_the_canonical_overlay_plan() {
        let mut source = document("none", "none");
        source["timeline"] = json!({
            "tracks": [{
                "elements": [
                    {
                        "id": "shape-back", "kind": "shape", "start": 0.25, "end": 2.75,
                        "place": {"x": 50, "y": 50, "w": 40},
                        "shape": {"shape": "rect", "fill": "#00ff00"}
                    },
                    {
                        "id": "progress-front", "kind": "progress", "start": 0.25, "end": 2.75,
                        "place": {"x": 50, "y": 70, "w": 60, "rot": 25},
                        "progress": {
                            "style": "normal",
                            "mainColor": "#ff0000",
                            "secondaryColor": "#0000ff"
                        }
                    }
                ]
            }]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-r1-scene-plan"),
            &source,
        )
        .unwrap();

        let scene = plan.element_scene_frame(1.25).unwrap();
        assert_eq!(scene.nodes.len(), 2);
        assert!(matches!(
            scene.nodes[0],
            element_draw::SceneNode::Vectors(_)
        ));
        let element_draw::SceneNode::ShaderQuad { transform, .. } = &scene.nodes[1] else {
            panic!("progress must keep z order and output as ShaderQuad")
        };
        assert!(
            transform.transform[1].abs() > 0.01,
            "rotation must not be lost during scene assembly"
        );
        assert!(
            transform.transform[4].abs() > 0.01,
            "rotation must not degrade into an axis-aligned box"
        );

        let canonical =
            u64::from_str_radix(&plan.element_drawop_fingerprint(1.25).unwrap(), 16).unwrap();
        assert_eq!(scene.fingerprint, canonical);
        assert_eq!(scene.next_change, Some(38.0 / 30.0));
    }

    /// The R2 glyph scene must consume the layout result of the existing OverlayRenderPlan. When the scene is requested again at the same moment, the mask pixels hit the TextEngine's Arc cache, rather than running swash again or rasterising the whole frame again.
    #[test]
    fn plain_subtitles_become_reusable_glyph_scene_masks() {
        let mut source = document("None", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(1.0).unwrap();
        assert_eq!(first.scene.nodes.len(), 1);
        assert_eq!(
            first.scene.fingerprint,
            subtitle_scene_fingerprint(&plan.definition_key, &first.key)
        );
        let element_draw::SceneNode::Glyphs(first_run) = &first.scene.nodes[0] else {
            panic!("a plain subtitle must become a glyph run")
        };
        assert!(!first_run.glyphs.is_empty());
        assert!(first_run.glyphs.iter().all(|glyph| matches!(
            &glyph.mask.pixels,
            element_draw::GlyphPixels::Alpha(alpha)
                if alpha.len() == glyph.mask.width as usize * glyph.mask.height as usize
        )));

        let second = plan.subtitle_scene_frame(1.0).unwrap();
        let element_draw::SceneNode::Glyphs(second_run) = &second.scene.nodes[0] else {
            panic!("a stable frame must still be a glyph run")
        };
        assert_eq!(first.key, second.key);
        assert!(
            Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs),
            "a stable cue must reuse the whole glyph geometry"
        );
        assert_eq!(first_run.uniforms, second_run.uniforms);

        let mut recolored = source;
        recolored["style"]["fontColor"] = json!("#ff0000");
        let mut recolored =
            OverlayRenderPlan::compile(&recolored, 320, 180, 3.0, 30.0, None).unwrap();
        let recolored = recolored.subtitle_scene_frame(1.0).unwrap();
        assert_ne!(
            first.scene.fingerprint, recolored.scene.fingerprint,
            "with the same subtitle key, the plan definition must still take part in retained scene identity"
        );
    }

    #[test]
    fn colr_subtitles_keep_premultiplied_rgba_in_the_glyph_scene() {
        let mut source = document("None", "none");
        source["style"]["fontFamily"] = json!("ColrProbe");
        source["style"]["fontColor"] = json!("#00FF0080");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["cues"][0]["text"] = json!("A");
        source["cues"][0]["words"] = json!([{"text": "A", "t0": 0.5, "t1": 2.5}]);
        let mut plan = OverlayRenderPlan::compile_with_injected_fonts(
            &source,
            320,
            180,
            3.0,
            30.0,
            None,
            OverlayIncludes::ALL,
            vec![include_bytes!("../../render-raster/tests/fixtures/fonts/ColrProbe.ttf").to_vec()],
        )
        .unwrap();

        let frame = plan.subtitle_scene_frame(1.0).unwrap();
        let [element_draw::SceneNode::Glyphs(run)] = frame.scene.nodes.as_slice() else {
            panic!("COLR subtitles must stay in the existing glyph run order")
        };
        let [glyph] = run.glyphs.as_ref() else {
            panic!("a single-character probe must produce exactly one glyph")
        };
        let element_draw::GlyphPixels::Color(rgba) = &glyph.mask.pixels else {
            panic!("COLR subtitles must carry premultiplied RGBA atlas pixels")
        };
        assert_eq!(
            rgba.len(),
            glyph.mask.width as usize * glyph.mask.height as usize * 4
        );
        assert!(rgba.chunks_exact(4).any(|pixel| pixel[3] > 0));
        assert_eq!(
            run.uniforms[glyph.uniform_index as usize].color_opacity, 1.0,
            "colour glyphs must not consume the alpha of fontColor itself"
        );
    }

    #[test]
    fn subtitle_backgrounds_become_a_vector_pass_before_glyphs() {
        let mut source = document("None", "none");
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let frame = plan.subtitle_scene_frame(1.0).unwrap();
        assert_eq!(frame.scene.nodes.len(), 2);
        let element_draw::SceneNode::Vectors(plate) = &frame.scene.nodes[0] else {
            panic!("the subtitle plate must enter the vector pass first")
        };
        let [
            DrawOp::FillRect {
                w,
                h,
                radius,
                color,
                ..
            },
        ] = plate.ops.as_slice()
        else {
            panic!("a single-line subtitle plate must be one FillRect")
        };
        assert!(*w > 0.0 && *h > 0.0 && *radius >= 0.0);
        assert!((color[3] - 0.701_960_8).abs() < 1e-6, "{color:?}");
        assert!(matches!(
            frame.scene.nodes[1],
            element_draw::SceneNode::Glyphs(_)
        ));
    }

    #[test]
    fn plain_subtitle_underlines_become_a_vector_pass_after_glyphs() {
        let mut source = document("None", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(true);
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let frame = plan.subtitle_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::Glyphs(_),
            element_draw::SceneNode::AnimatedVectors {
                frame: underlines,
                pose,
                motion,
            },
        ] = frame.scene.nodes.as_slice()
        else {
            panic!("a plain underline must enter the vector pass after the body glyph")
        };
        assert_eq!(*pose, element_draw::ScenePose::IDENTITY);
        assert!(motion.is_none());
        assert!(!underlines.ops.is_empty());
        assert!(underlines.ops.iter().all(|op| matches!(
            op,
            DrawOp::FillRect {
                h,
                radius,
                color,
                ..
            } if *h >= 1.0 && *radius > 0.0 && color[3] > 0.0
        )));
    }

    #[test]
    fn simple_word_animations_update_only_glyph_run_uniforms() {
        let mut source = document("Color", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.8).unwrap();
        let second = plan.subtitle_scene_frame(1.5).unwrap();
        let element_draw::SceneNode::Glyphs(first_run) = &first.scene.nodes[0] else {
            panic!("Color animation must use a glyph run")
        };
        let element_draw::SceneNode::Glyphs(second_run) = &second.scene.nodes[0] else {
            panic!("Color animation must still use a glyph run after splitting words")
        };
        assert!(Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs));
        assert_ne!(first_run.uniforms, second_run.uniforms);
        assert_eq!(first.scene.next_change, Some(1.2));
        assert!(first_run.uniforms.iter().any(|uniform| {
            uniform.color[0] == 1.0
                && (uniform.color[1] - 212.0 / 255.0).abs() < 1e-6
                && (uniform.color[2] - 59.0 / 255.0).abs() < 1e-6
        }));

        source["style"]["wordAnimation"] = json!({"animationName": "Reveal"});
        let mut reveal = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let reveal = reveal.subtitle_scene_frame(0.8).unwrap();
        let element_draw::SceneNode::Glyphs(reveal) = &reveal.scene.nodes[0] else {
            panic!("Reveal animation must use a glyph run")
        };
        assert!(
            reveal
                .uniforms
                .iter()
                .any(|uniform| uniform.color[3] == 0.0)
        );

        source["style"]["wordAnimation"] = json!({"animationName": "Bounce"});
        let mut bounce = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let bounce = bounce.subtitle_scene_frame(0.8).unwrap();
        let element_draw::SceneNode::Glyphs(bounce) = &bounce.scene.nodes[0] else {
            panic!("Bounce animation must use a glyph run")
        };
        assert!(
            bounce
                .uniforms
                .iter()
                .any(|uniform| uniform.transform[5] < -0.1)
        );
    }

    #[test]
    fn subtitle_scene_exposes_one_motion_interval_instead_of_frame_bucket_rebuilds() {
        let mut source = document("None", "magic-pop");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 640, 360, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.01).unwrap();
        assert!((first.scene.next_change.unwrap() - 0.1).abs() < 1e-9);
        assert!((first.scene.active_until.unwrap() - 0.1).abs() < 1e-9);
        let element_draw::SceneNode::Glyphs(first_run) = &first.scene.nodes[0] else {
            panic!("a subtitle without a plate must produce glyph motion directly")
        };
        let motion = first_run.motion.as_ref().expect("magic-pop motion");
        assert!((motion.start - 0.0).abs() < 1e-9);
        assert!((motion.end - 0.1).abs() < 1e-9);

        // On project frame boundaries, the compositor's continuous sampling must match field by field the round-both-ends sampling of the old CPU recipe. Only sub-frames generated by the display are allowed to be a continuous intermediate state.
        let frame_time = 1.0 / 30.0;
        let sampled = motion.sample(frame_time);
        let second = plan.subtitle_scene_frame(frame_time).unwrap();
        let element_draw::SceneNode::Glyphs(second_run) = &second.scene.nodes[0] else {
            panic!("the next project frame must still be glyph motion")
        };
        for (sampled, reference) in sampled.transform.into_iter().zip(second_run.pose.transform) {
            assert!(
                (sampled - reference).abs() <= 2e-5,
                "sampled={sampled} reference={reference} delta={}",
                (sampled - reference).abs()
            );
        }
        assert!((sampled.opacity - second_run.pose.opacity).abs() < 1e-6);

        let mut cpu = OverlayRenderPlan::compile(&source, 640, 360, 3.0, 30.0, None).unwrap();
        let cpu_frame = cpu.render_png(0.01).unwrap();
        assert!(
            (cpu_frame.next_change.unwrap() - 1.0 / 60.0).abs() < 1e-9,
            "CPU reference still keeps historical frame-bucket scheduling"
        );
    }

    #[test]
    fn magic_fade_wraps_the_retained_scene_in_one_animated_blur_group() {
        let mut source = document("None", "magic-fade");
        source["style"]["glow"] = json!({"on": false});
        let mut plan = OverlayRenderPlan::compile(&source, 640, 360, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(0.01).unwrap();
        let [element_draw::SceneNode::BlurredGroup(first_group)] = first.scene.nodes.as_slice()
        else {
            panic!("magic-fade must wrap the full subtitle scene in one blur group")
        };
        assert!(first_group.radius > 0.0);
        assert_eq!(first_group.nodes.len(), 3, "plate, outline and body must blur together");
        let motion = first_group.motion.as_ref().expect("fade blur motion");
        assert!(motion.from.blur > 0.0);
        assert_eq!(motion.to.blur, 0.0);
        assert!((first.scene.active_until.unwrap() - motion.end).abs() < 1e-9);

        let frame_time = 1.0 / 30.0;
        let second = plan.subtitle_scene_frame(frame_time).unwrap();
        let [element_draw::SceneNode::BlurredGroup(second_group)] = second.scene.nodes.as_slice()
        else {
            panic!("the fade project frame must still be the same blur group")
        };
        assert!((motion.sample(frame_time).blur - second_group.radius).abs() < 2e-5);
        let element_draw::SceneNode::Glyphs(first_fill) = &first_group.nodes[2] else {
            panic!("the third layer inside the blur group must be the body glyph")
        };
        let element_draw::SceneNode::Glyphs(second_fill) = &second_group.nodes[2] else {
            panic!("the next project frame must still keep the body glyph")
        };
        assert!(Arc::ptr_eq(&first_fill.glyphs, &second_fill.glyphs));
    }

    #[test]
    fn subtitle_outlines_become_a_retained_atlas_pass_before_fill() {
        let mut source = document("None", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(true);
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::Glyphs(outline),
            element_draw::SceneNode::Glyphs(fill),
        ] = first.scene.nodes.as_slice()
        else {
            panic!("an outlined subtitle without a plate must emit two glyph passes, outline then fill")
        };
        assert_eq!(outline.glyphs.len(), fill.glyphs.len());
        assert!(outline.glyphs.iter().zip(fill.glyphs.iter()).all(
            |(outline, fill)| outline.mask.key != fill.mask.key
                && outline.mask.width >= fill.mask.width
                && outline.mask.height >= fill.mask.height
        ));
        assert!(outline.uniforms.iter().all(|uniform| {
            uniform.color[0] == 0.0
                && uniform.color[1] == 0.0
                && uniform.color[2] == 0.0
                && uniform.color[3] > 0.0
        }));
        assert!(fill.uniforms.iter().all(|uniform| {
            uniform.color[0] == 1.0
                && uniform.color[1] == 1.0
                && uniform.color[2] == 1.0
                && uniform.color[3] > 0.0
        }));

        let second = plan.subtitle_scene_frame(1.5).unwrap();
        let [
            element_draw::SceneNode::Glyphs(second_outline),
            element_draw::SceneNode::Glyphs(second_fill),
        ] = second.scene.nodes.as_slice()
        else {
            panic!("a steady-state outlined subtitle must still keep two glyph passes")
        };
        assert!(Arc::ptr_eq(&outline.glyphs, &second_outline.glyphs));
        assert!(Arc::ptr_eq(&fill.glyphs, &second_fill.glyphs));
    }

    #[test]
    fn subtitle_glow_merges_outline_and_fill_before_one_retained_blur() {
        let mut source = document("None", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(true);
        source["style"]["glow"] = json!({
            "on": true,
            "intensity": 60,
            "range": 20,
            "color": "#40A0FF"
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::BlurredGlyphs(effect),
            element_draw::SceneNode::Glyphs(outline),
            element_draw::SceneNode::Glyphs(fill),
        ] = first.scene.nodes.as_slice()
        else {
            panic!("glow must first composite one effect from outline + fill, then draw the sharp body")
        };
        assert_eq!(effect.layers.len(), 2);
        assert_eq!(
            effect.radius,
            plan.original_style.effect_blur.round() as u32
        );
        assert_eq!(effect.layers[0].glyphs.len(), outline.glyphs.len());
        assert_eq!(effect.layers[1].glyphs.len(), fill.glyphs.len());
        assert!(
            effect
                .layers
                .iter()
                .all(|layer| layer.uniforms.iter().all(|uniform| uniform.color[3] > 0.0))
        );

        let second = plan.subtitle_scene_frame(1.5).unwrap();
        let element_draw::SceneNode::BlurredGlyphs(second_effect) = &second.scene.nodes[0] else {
            panic!("steady-state glow must still be a GPU effect node")
        };
        assert!(Arc::ptr_eq(
            &effect.layers[0].glyphs,
            &second_effect.layers[0].glyphs
        ));
        assert!(Arc::ptr_eq(
            &effect.layers[1].glyphs,
            &second_effect.layers[1].glyphs
        ));
    }

    #[test]
    fn subtitle_shadow_offset_is_frozen_into_retained_effect_geometry() {
        let mut source = document("None", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["dropShadow"] = json!({
            "on": true,
            "color": "#000000",
            "opacity": 0.6,
            "distance": 0.1,
            "rotation": 0,
            "blur": 0.08
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let frame = plan.subtitle_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::BlurredGlyphs(effect),
            element_draw::SceneNode::Glyphs(fill),
        ] = frame.scene.nodes.as_slice()
        else {
            panic!("drop shadow must enter the effect node before the sharp body")
        };
        assert_eq!(effect.layers.len(), 1);
        let shadow = &effect.layers[0];
        assert_eq!(shadow.glyphs.len(), fill.glyphs.len());
        let dx = shadow.glyphs[0].transform[4] - fill.glyphs[0].transform[4];
        let dy = shadow.glyphs[0].transform[5] - fill.glyphs[0].transform[5];
        assert!((dx - plan.original_style.effect_x as f32).abs() < 1e-5);
        assert!((dy - plan.original_style.effect_y as f32).abs() < 1e-5);
    }

    #[test]
    fn reveal_shadow_off_updates_effect_uniforms_without_changing_geometry() {
        let mut source = document("Reveal", "none");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["glow"] = json!({
            "on": true,
            "intensity": 50,
            "range": 12,
            "color": "#FFFFFF"
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(0.8).unwrap();
        let second = plan.subtitle_scene_frame(1.5).unwrap();
        let element_draw::SceneNode::BlurredGlyphs(first_effect) = &first.scene.nodes[0] else {
            panic!("Reveal glow must enter the effect node")
        };
        let element_draw::SceneNode::BlurredGlyphs(second_effect) = &second.scene.nodes[0] else {
            panic!("Reveal glow must still enter the effect node after splitting words")
        };
        assert!(Arc::ptr_eq(
            &first_effect.layers[0].glyphs,
            &second_effect.layers[0].glyphs
        ));
        assert_ne!(
            first_effect.layers[0].uniforms,
            second_effect.layers[0].uniforms
        );
        assert!(
            first_effect.layers[0]
                .uniforms
                .iter()
                .any(|uniform| uniform.color[3] == 0.0)
        );
    }

    #[test]
    fn text_elements_become_ordered_glyph_scene_passes() {
        let mut source = document("None", "none");
        source["timeline"] = json!({
            "tracks": [{"kind": "overlay", "elements": [{
                "id": "title", "kind": "text", "start": 0.25, "end": 2.75,
                "text": "Retained title",
                "place": {"x": 42, "y": 38, "w": 55, "scale": 1.1,
                    "rot": 7, "opacity": 0.8},
                "style": {
                    "fontFamily": "Montserrat", "fontSize": 34,
                    "fontColor": "#fefefe", "background": true,
                    "backgroundColor": "#122033cc", "backgroundPadding": 8,
                    "outline": true,
                    "textOutline": {"on": true, "width": 4, "color": "#000000"},
                    "dropShadow": {"on": true, "color": "#000000", "opacity": 0.6,
                        "distance": 0.1, "rotation": 0, "blur": 0.08}
                }
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-r3-text-scene"),
            &source,
        )
        .unwrap();

        let first = plan.text_element_scene_frame(1.0).unwrap();
        assert_eq!(first.next_change, Some(2.75));
        assert!(matches!(
            first.nodes.as_slice(),
            [
                element_draw::SceneNode::AnimatedVectors { .. },
                element_draw::SceneNode::BlurredGlyphs(_),
                element_draw::SceneNode::Glyphs(_),
                element_draw::SceneNode::Glyphs(_),
            ]
        ));
        let element_draw::SceneNode::Glyphs(fill) = first.nodes.last().unwrap() else {
            panic!("the text body must be the last sharp glyph pass")
        };
        assert!(!fill.glyphs.is_empty());
        assert_eq!(fill.pose.opacity, 0.8);
        assert!(
            fill.pose.transform[1].abs() > 0.01,
            "rotation must go into the container pose"
        );

        let second = plan.text_element_scene_frame(1.0).unwrap();
        let element_draw::SceneNode::Glyphs(second_fill) = second.nodes.last().unwrap() else {
            panic!("a stable frame must still be a glyph pass")
        };
        assert_eq!(fill.glyphs[0].mask.key, second_fill.glyphs[0].mask.key);
        assert!(
            Arc::ptr_eq(
                fill.glyphs[0].mask.pixels.data(),
                second_fill.glyphs[0].mask.pixels.data()
            ),
            "the same text element must hit the TextEngine swash mask cache"
        );
    }

    /// Round 156: the `block` plate of a text element fills the wrapping width only when the user has given `place.w`. When no width is given, the plate hugs the text (prototype `padOf` / `block` is the same).
    #[test]
    fn text_element_block_plate_hugs_text_unless_width_is_set() {
        let render = |place: serde_json::Value| {
            let mut source = document("None", "none");
            source["cues"] = json!([]);
            source["timeline"] = json!({
                "tracks": [{"kind": "overlay", "elements": [{
                    "id": "plated", "kind": "text", "start": 0.0, "end": 2.0,
                    "text": "Hi",
                    "place": place,
                    "style": {
                        "fontFamily": "Montserrat", "fontSize": 40,
                        "fontColor": "#ffffff", "background": true,
                        "backgroundStyle": "block",
                        "backgroundColor": "#2455d6", "backgroundPadding": 6
                    }
                }]}]
            });
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 2.0, 30.0, None).unwrap();
            plan.load_timeline_elements(
                std::path::Path::new("/nonexistent/cuccut-text-plate"),
                &source,
            )
            .unwrap();
            let element = plan.elements[0].clone();
            let pixmap = plan.render_text_element(&element, 1.0).unwrap();
            alpha_bbox(pixmap.data(), 320, 180).expect("the plate should have pixels")
        };
        let hugged = render(json!({"x": 50, "y": 50}));
        let filled = render(json!({"x": 50, "y": 50, "w": 90}));
        let hugged_w = hugged.cols.end - hugged.cols.start;
        let filled_w = filled.cols.end - filled.cols.start;
        assert!(
            hugged_w < 320 * 60 / 100,
            "without place.w the plate must hug the two characters: {hugged_w}px"
        );
        assert!(
            filled_w > hugged_w + 100,
            "with place.w=90 the plate fills the wrap width: hugged={hugged_w}px filled={filled_w}px"
        );
    }

    #[test]
    fn text_element_wipe_masks_the_cpu_layer_and_stays_in_retained_scene() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "tracks": [{"kind": "overlay", "elements": [{
                "id": "wiped-title", "kind": "text", "start": 0.0, "end": 2.0,
                "text": "WIPE TITLE",
                "place": {"x": 50, "y": 50, "w": 90},
                "style": {
                    "fontFamily": "Montserrat", "fontSize": 44,
                    "fontColor": "#ffffff", "background": true,
                    "backgroundColor": "#2455d6dd", "backgroundPadding": 12,
                    "outline": true,
                    "textOutline": {"on": true, "width": 3, "color": "#000000"}
                },
                "animate": {"enter": {"preset": "wipe", "presetVersion": 1, "dur": 0.6}}
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 2.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-text-wipe"),
            &source,
        )
        .unwrap();

        let time = 0.067;
        let scene = plan.text_element_scene_frame(time).unwrap();
        let [element_draw::SceneNode::BlurredGroup(group)] = scene.nodes.as_slice() else {
            panic!("wipe must keep all text passes in one reveal group")
        };
        let reveal = group.reveal.expect("wipe group must carry a reveal uniform");
        assert!((0.0..1.0).contains(&reveal));
        assert_eq!(group.radius, 0.0);
        assert!(group.nodes.len() >= 3, "plate, outline and body must be wiped together");

        let element = plan.elements[0].clone();
        let partial = plan.render_text_element(&element, time).unwrap();
        let partial_bounds = alpha_bbox(partial.data(), 320, 180).expect("wipe midpoint should have pixels");
        let boundary = (f64::from(reveal) * 320.0).ceil() as usize;
        assert!(
            partial_bounds.cols.end <= boundary,
            "CPU reference must clip the whole layer at the same reveal boundary: {:?} > {boundary}",
            partial_bounds.cols
        );
        let full = plan.render_text_element(&element, 1.0).unwrap();
        let full_bounds = alpha_bbox(full.data(), 320, 180).expect("pixels should exist after the wipe completes");
        assert!(
            full_bounds.cols.end > partial_bounds.cols.end,
            "the text's right side should be restored after the wipe completes: partial={:?}, full={:?}, reveal={reveal}",
            partial_bounds.cols,
            full_bounds.cols
        );
    }

    #[test]
    fn plain_text_element_underlines_follow_the_glyph_pass() {
        let mut source = document("None", "none");
        source["timeline"] = json!({
            "tracks": [{"elements": [{
                "id": "underlined", "kind": "text", "start": 0.0, "end": 3.0,
                "text": "UNDER LINE",
                "style": {
                    "fontFamily": "Montserrat", "fontSize": 32,
                    "fontColor": "#ffffff", "underline": true,
                    "background": false, "outline": false,
                    "textOutline": {"on": false}, "dropShadow": {"on": false},
                    "glow": {"on": false}
                }
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-text-underline"),
            &source,
        )
        .unwrap();

        let scene = plan.text_element_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::Glyphs(_),
            element_draw::SceneNode::AnimatedVectors {
                frame: underlines, ..
            },
        ] = scene.nodes.as_slice()
        else {
            panic!("a plain text underline must enter the vector pass after the body glyph")
        };
        assert!(!underlines.ops.is_empty());

        source["timeline"]["tracks"][0]["elements"][0]["animate"] =
            json!({"enter": {"preset": "riseWords", "presetVersion": 1}});
        let mut cascade = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        cascade
            .load_timeline_elements(
                std::path::Path::new("/nonexistent/cuccut-text-underline-cascade"),
                &source,
            )
            .unwrap();
        let scene = cascade.text_element_scene_frame(0.1).unwrap();
        assert!(scene.nodes.len() >= 4);
        let mut runs = Vec::new();
        for (index, node) in scene.nodes.iter().enumerate() {
            match node {
                element_draw::SceneNode::Glyphs(run) => {
                    assert_eq!(run.uniforms.len(), 1);
                    assert!(matches!(
                        scene.nodes.get(index + 1),
                        Some(element_draw::SceneNode::AnimatedVectors { .. })
                    ));
                    runs.push(run);
                }
                element_draw::SceneNode::AnimatedVectors {
                    frame: underline, ..
                } => assert_eq!(underline.ops.len(), 1),
                _ => panic!("per-word moving text must keep the CPU z order of chunk glyph then underline"),
            }
        }
        let first = runs.first().expect("at least one glyph chunk");
        assert!(
            runs.iter()
                .skip(1)
                .any(|run| run.uniforms != first.uniforms),
            "each part must keep its own cascade pose"
        );
    }

    #[test]
    fn text_element_alignment_moves_cpu_and_retained_glyphs_inside_place_width() {
        let render = |align: &str| {
            let mut source = document("None", "none");
            source["timeline"] = json!({
                "tracks": [{"elements": [{
                    "id": "aligned", "kind": "text", "start": 0.0, "end": 3.0,
                    "text": "ALIGN",
                    "place": {"x": 50, "y": 50, "w": 80},
                    "style": {
                        "fontFamily": "Montserrat", "fontSize": 24,
                        "fontColor": "#ffffff", "textAlign": align,
                        "background": false, "outline": false,
                        "textOutline": {"on": false}, "dropShadow": {"on": false},
                        "glow": {"on": false}
                    }
                }]}]
            });
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
            plan.load_timeline_elements(
                std::path::Path::new("/nonexistent/cuccut-text-align"),
                &source,
            )
            .unwrap();

            let scene = plan.text_element_scene_frame(1.0).unwrap();
            let [element_draw::SceneNode::Glyphs(glyphs)] = scene.nodes.as_slice() else {
                panic!("undecorated text must produce only one glyph pass")
            };
            let retained_x = glyphs.glyphs[0].transform[4];

            let element = plan.elements[0].clone();
            let pixmap = plan.render_text_element(&element, 1.0).unwrap();
            let cpu_x = alpha_bbox(pixmap.data(), 320, 180)
                .expect("text element must have non-zero pixels")
                .cols
                .start;
            (retained_x, cpu_x)
        };

        let left = render("left");
        let center = render("center");
        let right = render("right");
        assert!(
            left.0 < center.0 && center.0 < right.0,
            "retained: {left:?} {center:?} {right:?}"
        );
        assert!(
            left.1 < center.1 && center.1 < right.1,
            "CPU: {left:?} {center:?} {right:?}"
        );
    }

    /// A subtitle line is aligned by default within its subtitle block's own width (the block is centred on the anchor, as v2's Studio style does). When the root style carries `alignWithinWrap`, alignment happens within the wrap width, and the block sticks to the left or right edge of the wrap area (positioned-box styles use this).
    #[test]
    fn captions_align_within_the_wrap_width_only_when_the_root_asks() {
        let layouts = |within: Option<bool>, align: &str| {
            let mut source = document("None", "none");
            source["style"]["textAlign"] = json!(align);
            if let Some(on) = within {
                source["style"][crate::ALIGN_WITHIN_WRAP_KEY] = json!(on);
            }
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
            plan.active_layouts(1.0)
        };
        let wrap = 320.0 * 0.8;
        let studio = layouts(None, "left");
        assert_eq!(studio[0].text_align, LineTextAlign::Left);
        assert!(studio[0].width < wrap, "this line is shorter than the wrap width: {}", studio[0].width);
        assert_eq!(studio[0].align_width, studio[0].width);
        assert_eq!(layouts(Some(false), "left")[0].align_width, studio[0].width);
        let boxed = layouts(Some(true), "right");
        assert_eq!(boxed[0].text_align, LineTextAlign::Right);
        assert_eq!(boxed[0].align_width, wrap);
        assert_eq!(boxed[0].width, studio[0].width);
    }

    #[test]
    fn text_element_cascade_updates_run_uniforms_without_rasterizing_a_full_frame() {
        let mut source = document("None", "none");
        source["timeline"] = json!({
            "tracks": [{"elements": [{
                "id": "cascade", "kind": "text", "start": 0.0, "end": 3.0,
                "text": "ONE TWO", "style": {
                    "fontFamily": "Montserrat", "fontSize": 32,
                    "background": false, "outline": false
                },
                "animate": {"enter": {"preset": "riseWords", "presetVersion": 1}}
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-r3-text-cascade"),
            &source,
        )
        .unwrap();

        let first_frame = plan.text_element_scene_frame(0.01).unwrap();
        let second_frame = plan.text_element_scene_frame(0.35).unwrap();
        assert_eq!(first_frame.next_change, Some(1.0 / 30.0));
        let [element_draw::SceneNode::Glyphs(first)] = first_frame.nodes.as_slice() else {
            panic!("plain text cascade must produce only one glyph pass")
        };
        let [element_draw::SceneNode::Glyphs(second)] = second_frame.nodes.as_slice() else {
            panic!("the following cascade frame must still produce only one glyph pass")
        };
        assert_eq!(first.glyphs[0].mask.key, second.glyphs[0].mask.key);
        assert_ne!(first.uniforms, second.uniforms);
    }

    #[test]
    fn classic_word_decorations_keep_cpu_chunk_order_in_the_scene() {
        let scene_for = |animation: &str, time: f64| {
            let mut source = document(animation, "none");
            source["style"]["background"] = json!(false);
            source["style"]["outline"] = json!(false);
            source["style"]["glow"] = json!({"on": false});
            OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None)
                .unwrap()
                .subtitle_scene_frame(time)
                .unwrap()
                .scene
        };

        let highlight = scene_for("Highlight", 1.5);
        assert!(matches!(
            highlight.nodes.as_slice(),
            [
                element_draw::SceneNode::Glyphs(_),
                element_draw::SceneNode::AnimatedVectors { .. },
                element_draw::SceneNode::Glyphs(_),
            ]
        ));
        let element_draw::SceneNode::AnimatedVectors { frame: plate, .. } = &highlight.nodes[1]
        else {
            unreachable!()
        };
        assert!(matches!(
            plate.ops.as_slice(),
            [DrawOp::FillRect {
                w,
                h,
                radius,
                color,
                ..
            }] if *w > 0.0 && *h > 0.0 && *radius > 0.0 && color[3] == 1.0
        ));

        let paint = scene_for("Paint", 1.0);
        assert!(matches!(
            paint.nodes.as_slice(),
            [
                element_draw::SceneNode::Glyphs(_),
                element_draw::SceneNode::AnimatedVectors { .. },
                element_draw::SceneNode::Glyphs(_),
            ]
        ));
        let element_draw::SceneNode::AnimatedVectors {
            frame: underline, ..
        } = &paint.nodes[1]
        else {
            unreachable!()
        };
        assert!(matches!(
            underline.ops.as_slice(),
            [DrawOp::FillRect { h, radius, .. }] if *h >= 1.0 && *radius > 0.0
        ));

        let custom = scene_for("Custom", 1.5);
        assert!(matches!(
            custom.nodes.as_slice(),
            [
                element_draw::SceneNode::Glyphs(_),
                element_draw::SceneNode::AnimatedVectors { .. },
                element_draw::SceneNode::Glyphs(_),
            ]
        ));
    }

    /// The "pill highlight" block expands and contracts within the word's window. Sampling two moments, both `w`/`h` and the block alpha must differ. A constant rectangle (as all other classic effects are today) would turn this assertion red immediately.
    ///
    /// The phase is taken from **the current word's own window** (`world` is 1.3–2.5s). `t=1.3` falls on `phase 0` (scale .9 / alpha .75), and `t=2.14` falls on `phase 0.7` (scale 1.1 / alpha 1).
    #[test]
    fn legacy_pill_highlight_scene_breathes_across_the_word_window() {
        let scene_for = |time: f64| {
            let mut source = document("Highlight", "none");
            source["style"]["background"] = json!(false);
            source["style"]["outline"] = json!(false);
            source["style"]["glow"] = json!({"on": false});
            source["style"]["wordAnimation"] = json!({
                "animationName": "Highlight",
                "active": {
                    "backgroundColor": "#FFD43B",
                    "color": "#0D0D0D",
                    "borderRadiusEm": 1.0,
                    "boxScale": [[0.0, 0.9], [0.7, 1.1], [1.0, 1.0]],
                    "boxOpacity": [[0.0, 0.75], [0.7, 1.0], [1.0, 1.0]],
                    "boxEasing": "sinInOut",
                },
            });
            OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None)
                .unwrap()
                .subtitle_scene_frame(time)
                .unwrap()
                .scene
        };
        let plate_of = |scene: &element_draw::SceneFrame| {
            let element_draw::SceneNode::AnimatedVectors { frame, .. } = &scene.nodes[1] else {
                panic!("the pill base must still be the AnimatedVectors layer between chunks")
            };
            let [
                DrawOp::FillRect {
                    x,
                    y,
                    w,
                    h,
                    radius,
                    color,
                    ..
                },
            ] = frame.ops.as_slice()
            else {
                panic!("the pill base should be a single FillRect")
            };
            (*x, *y, *w, *h, *radius, color[3])
        };

        let (low_x, low_y, low_w, low_h, low_r, low_a) = plate_of(&scene_for(1.3));
        let (high_x, high_y, high_w, high_h, high_r, high_a) = plate_of(&scene_for(2.14));

        // The expansion and contraction are real: width, height and corner radius all grow by the same factor, and the block alpha is no longer constant.
        assert!(high_w > low_w, "{low_w} → {high_w}");
        assert!(high_h > low_h, "{low_h} → {high_h}");
        assert!(high_r > low_r, "{low_r} → {high_r}");
        assert!(high_a > low_a, "{low_a} → {high_a}");
        // The block alpha is separate from the word opacity: the Highlight's word opacity is always 1, while the block is .75.
        assert!((f64::from(low_a) - 0.75).abs() < 1e-3, "{low_a}");
        assert!((f64::from(high_a) - 1.0).abs() < 1e-3, "{high_a}");
        // Scaling about the rectangle's centre: the centres of the two frames must coincide (aligning the top-left corner would drift to the bottom-right).
        assert!((f64::from(low_x + low_w / 2.0 - high_x - high_w / 2.0)).abs() < 1e-3);
        assert!((f64::from(low_y + low_h / 2.0 - high_y - high_h / 2.0)).abs() < 1e-3);
        // The ratio goes from .9 to 1.1 (width and height each follow the same factor).
        assert!((f64::from(high_w / low_w) - 11.0 / 9.0).abs() < 1e-3);
        assert!((f64::from(high_h / low_h) - 11.0 / 9.0).abs() < 1e-3);
    }

    /// An exact check of the curve values (the prototype `designs/cuccut/app/model-subanim.test.js:91-113` static baseline `SAMPLE_ON = 0.35`: `scale ≈ 1.0`, `alpha = 0.875`).
    #[test]
    fn the_pill_highlight_track_samples_match_the_prototype_curve() {
        let animation = word_animation(&json!({"wordAnimation": {
            "animationName": "Highlight",
            "active": {
                "backgroundColor": "#FFD43B",
                "boxScale": [[0.0, 0.9], [0.7, 1.1], [1.0, 1.0]],
                "boxOpacity": [[0.0, 0.75], [0.7, 1.0], [1.0, 1.0]],
                "boxEasing": "sinInOut",
            },
        }}));
        let track = animation.box_track.clone().expect("pill highlight must resolve a block track");
        assert!(track.is_animated());
        for (phase, scale, alpha) in [
            (0.0, 0.9, 0.75),
            // sinInOut is symmetric about the midpoint of the segment, and 0.35 is exactly the midpoint of [0, 0.7].
            (0.35, 1.0, 0.875),
            (0.7, 1.1, 1.0),
            (1.0, 1.0, 1.0),
        ] {
            let sampled_scale = track.scale_at(phase).unwrap();
            let sampled_alpha = track.opacity_at(phase).unwrap();
            assert!(
                (sampled_scale - scale).abs() < 1e-9,
                "phase {phase} scale {sampled_scale}"
            );
            assert!(
                (sampled_alpha - alpha).abs() < 1e-9,
                "phase {phase} alpha {sampled_alpha}"
            );
        }
        // The phase applies only to the current word, and the block is drawn only on the current word.
        let on = word_state(&animation, 1, 1, 0.0);
        assert_eq!(on.box_scale, Some(0.9));
        assert_eq!(on.box_opacity, Some(0.75));
        let off = word_state(&animation, 0, 1, 0.0);
        assert_eq!(off.box_scale, None);
        assert_eq!(off.box_opacity, None);

        // An effect without a block track is unchanged: `box_*` is always `None`, and the block reverts to a constant rectangle.
        let plain = word_animation(&json!({"wordAnimation": {"animationName": "Highlight"}}));
        assert!(plain.box_track.is_none());
        assert_eq!(word_state(&plain, 1, 1, 0.35).box_scale, None);
        assert_eq!(word_state(&plain, 1, 1, 0.35).box_opacity, None);

        // The in-word phase reads that word's own window.
        let item = TimedItem {
            id: "q1".to_owned(),
            series_index: 0,
            text: "Hello world".to_owned(),
            display_start: 0.5,
            display_end: 2.5,
            words: vec![
                Word {
                    id: "w0".to_owned(),
                    text: "Hello".to_owned(),
                    start: 0.5,
                    end: 1.5,
                },
                Word {
                    id: "w1".to_owned(),
                    text: "world".to_owned(),
                    start: 1.5,
                    end: 2.5,
                },
            ],
        };
        assert!((word_phase(&item, 0, 0.85) - 0.35).abs() < 1e-9);
        assert!((word_phase(&item, 1, 1.85) - 0.35).abs() < 1e-9);
        // Out-of-range and zero-length windows give 0, not NaN.
        assert_eq!(word_phase(&item, 0, 0.0), 0.0);
        assert_eq!(word_phase(&item, 9, 1.0), 0.0);
    }

    #[test]
    fn kinetic_slam_updates_retained_glyph_uniforms_on_the_project_fps_grid() {
        let mut source = designed_layout_document("caption-kinetic-slam");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.51).unwrap();
        let second = plan.subtitle_scene_frame(0.55).unwrap();
        let [element_draw::SceneNode::Glyphs(first_run)] = first.scene.nodes.as_slice() else {
            panic!("kinetic slam must be expressed by a single retained glyph scene layer")
        };
        let [element_draw::SceneNode::Glyphs(second_run)] = second.scene.nodes.as_slice() else {
            panic!("later samples of the same visible word must still be a glyph scene")
        };
        assert!(Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs));
        assert_ne!(first_run.uniforms, second_run.uniforms);
        assert!(
            first_run
                .uniforms
                .iter()
                .any(|uniform| uniform.transform != element_draw::ScenePose::IDENTITY.transform)
        );
        let next = first
            .scene
            .next_change
            .expect("recipe animation must report the next fps sample");
        assert!(next > 0.51 && next <= 0.51 + 1.0 / 30.0 + 1e-9, "{next}");

        let next_word = plan.subtitle_scene_frame(1.31).unwrap();
        let [element_draw::SceneNode::Glyphs(next_word_run)] = next_word.scene.nodes.as_slice()
        else {
            panic!("the next visible word must still be a glyph scene")
        };
        assert!(
            !Arc::ptr_eq(&first_run.glyphs, &next_word_run.glyphs),
            "fullScreenWord must change geometry when the word changes within the same cue, not reuse the previous word"
        );
    }

    #[test]
    fn clip_wipe_updates_only_the_retained_glyph_clip_uniform() {
        let mut source = designed_layout_document("caption-clip-wipe");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let second = plan.subtitle_scene_frame(0.62).unwrap();
        let [element_draw::SceneNode::Glyphs(first_run)] = first.scene.nodes.as_slice() else {
            panic!("clip wipe must be expressed by a single retained glyph scene layer")
        };
        let [element_draw::SceneNode::Glyphs(second_run)] = second.scene.nodes.as_slice() else {
            panic!("later clip wipe samples must still be a glyph scene")
        };
        assert!(Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs));
        let first_clips = first_run
            .uniforms
            .iter()
            .map(|uniform| uniform.clip)
            .collect::<Vec<_>>();
        let second_clips = second_run
            .uniforms
            .iter()
            .map(|uniform| uniform.clip)
            .collect::<Vec<_>>();
        assert!(first_clips.iter().any(Option::is_some));
        assert_ne!(first_clips, second_clips);
        assert_ne!(first_run.uniforms, second_run.uniforms);
        let next = first
            .scene
            .next_change
            .expect("clip recipe must report the next fps sample");
        assert!(next > 0.58 && next <= 0.58 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn gradient_fill_updates_only_the_retained_glyph_paint_uniform() {
        let mut source = designed_layout_document("caption-gradient-fill");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let second = plan.subtitle_scene_frame(0.62).unwrap();
        let [element_draw::SceneNode::Glyphs(first_run)] = first.scene.nodes.as_slice() else {
            panic!("gradient fill must be expressed by a single retained glyph scene layer")
        };
        let [element_draw::SceneNode::Glyphs(second_run)] = second.scene.nodes.as_slice() else {
            panic!("later gradient fill samples must still be a glyph scene")
        };
        assert!(Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs));
        assert!(first_run.uniforms.iter().any(|uniform| matches!(
            uniform.paint,
            element_draw::GlyphPaint::RepeatLinearGradient { .. }
        )));
        let first_paints = first_run
            .uniforms
            .iter()
            .map(|uniform| uniform.paint)
            .collect::<Vec<_>>();
        let second_paints = second_run
            .uniforms
            .iter()
            .map(|uniform| uniform.paint)
            .collect::<Vec<_>>();
        assert_ne!(first_paints, second_paints);
        assert_ne!(first_run.uniforms, second_run.uniforms);
        let next = first
            .scene
            .next_change
            .expect("gradient recipe must report the next fps sample");
        assert!(next > 0.58 && next <= 0.58 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn designed_caption_plates_update_procedural_uniforms_without_vector_geometry() {
        for style_id in ["caption-highlight", "caption-pill-karaoke"] {
            let (first_time, second_time) = if style_id == "caption-pill-karaoke" {
                (1.35, 1.39)
            } else {
                (0.58, 0.62)
            };
            let mut source = designed_layout_document(style_id);
            source["style"]["background"] = json!(false);
            source["style"]["outline"] = json!(false);
            source["style"]["underline"] = json!(false);
            source["style"]["glow"] = json!({"on": false});
            source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

            let first = plan.subtitle_scene_frame(first_time).unwrap();
            let second = plan.subtitle_scene_frame(second_time).unwrap();
            let first_plate = first
                .scene
                .nodes
                .iter()
                .find_map(|node| match node {
                    element_draw::SceneNode::RoundedRect(node) => Some(node),
                    _ => None,
                })
                .unwrap_or_else(|| panic!("{style_id} must produce a procedural rounded plate"));
            let second_plate = second
                .scene
                .nodes
                .iter()
                .find_map(|node| match node {
                    element_draw::SceneNode::RoundedRect(node) => Some(node),
                    _ => None,
                })
                .unwrap_or_else(|| panic!("{style_id} later samples must still keep the rounded plate"));
            assert_ne!(first_plate.rect, second_plate.rect, "{style_id}");
            assert!(first_plate.rect[2] > 0.0 && first_plate.rect[3] > 0.0);
            assert!(first_plate.radius > 0.0 && first_plate.color[3] > 0.0);
            assert!(first.scene.nodes.iter().all(|node| !matches!(
                node,
                element_draw::SceneNode::Vectors(_)
                    | element_draw::SceneNode::AnimatedVectors { .. }
            )));

            let first_run = first
                .scene
                .nodes
                .iter()
                .find_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .expect("glyph run must be kept after the plate");
            let second_run = second
                .scene
                .nodes
                .iter()
                .find_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .expect("later frames after the plate must keep the glyph run");
            assert!(
                Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs),
                "{style_id} plate animation must not rebuild glyph geometry"
            );
            let next = first
                .scene
                .next_change
                .expect("plate recipe must report the next fps sample");
            assert!(
                next > first_time && next <= first_time + 1.0 / 30.0 + 1e-9,
                "{next}"
            );
        }
    }

    #[test]
    fn designed_caption_duplicate_layers_reuse_glyph_geometry_and_only_update_uniforms() {
        let mut source = designed_layout_document("caption-parallax-layers");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["captionEmphasis"] = json!({
            "w1": {"anchorText": "Hello", "role": "hero"}
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.8).unwrap();
        let second = plan.subtitle_scene_frame(1.32).unwrap();
        fn glyph_runs(frame: &SubtitleSceneFrame) -> Vec<&Arc<element_draw::GlyphRun>> {
            frame
                .scene
                .nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .collect::<Vec<_>>()
        }
        let first_runs = glyph_runs(&first);
        let second_runs = glyph_runs(&second);
        assert_eq!(first_runs.len(), 6, "each of the two words should have two duplicate layers and one body layer");
        assert_eq!(second_runs.len(), first_runs.len());
        let active_duplicate = first_runs
            .chunks_exact(3)
            .find(|word| word[0].uniforms[0].color[3] > 0.0)
            .expect("the hero word must produce a visible duplicate");
        assert_ne!(
            active_duplicate[0].uniforms[0],
            active_duplicate[1].uniforms[0]
        );
        for word in first_runs.chunks_exact(3) {
            assert!(Arc::ptr_eq(&word[0].glyphs, &word[1].glyphs));
            assert!(Arc::ptr_eq(&word[1].glyphs, &word[2].glyphs));
        }
        for (first, second) in first_runs.iter().zip(&second_runs) {
            assert!(Arc::ptr_eq(&first.glyphs, &second.glyphs));
        }
        assert!(
            first_runs
                .iter()
                .zip(&second_runs)
                .any(|(first, second)| first.uniforms != second.uniforms),
            "the attack interval may only change duplicate/main uniforms"
        );
        assert!(first.scene.nodes.iter().all(|node| !matches!(
            node,
            element_draw::SceneNode::Vectors(_)
                | element_draw::SceneNode::AnimatedVectors { .. }
                | element_draw::SceneNode::RoundedRect(_)
        )));
        let next = first
            .scene
            .next_change
            .expect("duplicate recipe must report the next fps sample");
        assert!(next > 0.8 && next <= 0.8 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn editorial_color_mix_uses_one_retained_fill_without_a_transparent_duplicate() {
        let mut source = designed_layout_document("caption-editorial-emphasis");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["captionEmphasis"] = json!({
            "w1": {"anchorText": "Hello", "role": "hero"}
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(
            caption_recipe_glyph_duplicate_layer_count(&plan.original_animation),
            1,
            "the descriptor's visual layering declaration must be kept"
        );
        assert_eq!(
            caption_recipe_echo_duplicate_layer_count(&plan.original_animation),
            0,
            "an editorial recipe with only colorMix must not produce a transparent echo pass"
        );

        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let second = plan.subtitle_scene_frame(0.62).unwrap();
        fn runs(frame: &SubtitleSceneFrame) -> Vec<&Arc<element_draw::GlyphRun>> {
            frame
                .scene
                .nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .collect::<Vec<_>>()
        }
        let first_runs = runs(&first);
        let second_runs = runs(&second);
        assert_eq!(first_runs.len(), 1, "editorial should submit only one body glyph run");
        assert_eq!(second_runs.len(), 1);
        assert_eq!(first_runs[0].uniforms.len(), 2);
        assert!(
            first_runs[0]
                .uniforms
                .iter()
                .any(|uniform| uniform.color[2] < 0.5),
            "the hero word's colorMix must feed the body colour uniform"
        );
        assert!(Arc::ptr_eq(&first_runs[0].glyphs, &second_runs[0].glyphs));
        assert_ne!(first_runs[0].uniforms, second_runs[0].uniforms);
        assert!(first.scene.nodes.iter().all(|node| !matches!(
            node,
            element_draw::SceneNode::Vectors(_)
                | element_draw::SceneNode::AnimatedVectors { .. }
                | element_draw::SceneNode::RoundedRect(_)
        )));
        let next = first
            .scene
            .next_change
            .expect("editorial enter must report the next fps sample");
        assert!(next > 0.58 && next <= 0.58 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn emoji_pop_keeps_word_local_decoration_geometry_and_only_updates_uniforms() {
        let mut source = designed_layout_document("caption-emoji-pop");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["captionEmphasis"] = json!({
            "w1": {"anchorText": "Hello", "role": "hero"}
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let second = plan.subtitle_scene_frame(0.62).unwrap();
        fn runs(frame: &SubtitleSceneFrame) -> Vec<&Arc<element_draw::GlyphRun>> {
            frame
                .scene
                .nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .collect::<Vec<_>>()
        }
        let first_runs = runs(&first);
        let second_runs = runs(&second);
        assert_eq!(
            first_runs.len(),
            4,
            "the two words must keep the per-word emoji-then-body layer order, and inactive words keep a transparent emoji run"
        );
        assert_eq!(second_runs.len(), first_runs.len());
        assert!(first_runs[0].uniforms[0].color_opacity > 0.0);
        assert_eq!(first_runs[2].uniforms[0].color_opacity, 0.0);
        for (first, second) in first_runs.iter().zip(second_runs.iter()) {
            assert!(Arc::ptr_eq(&first.glyphs, &second.glyphs));
        }
        assert_ne!(first_runs[1].uniforms, second_runs[1].uniforms);
        assert!(
            first
                .scene
                .nodes
                .iter()
                .all(|node| matches!(node, element_draw::SceneNode::Glyphs(_)))
        );
        let next = first
            .scene
            .next_change
            .expect("emoji pop must report the next fps sample");
        assert!(next > 0.58 && next <= 0.58 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn a_user_emoji_override_joins_other_supported_recipes_without_a_style_id_gate() {
        let mut source = designed_layout_document("caption-editorial-emphasis");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["captionEmphasis"] = json!({
            "w1": {"anchorText": "Hello", "role": "hero", "emoji": "B"}
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let frame = plan.subtitle_scene_frame(0.8).unwrap();
        let runs = frame
            .scene
            .nodes
            .iter()
            .filter_map(|node| match node {
                element_draw::SceneNode::Glyphs(run) => Some(run),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(
            runs.len(),
            3,
            "the two editorial body lines must split before and after the user emoji's per-word slot"
        );
        assert!(runs.iter().all(|run| !run.glyphs.is_empty()));
        assert!(
            runs[1].uniforms[0].color_opacity > 0.0,
            "user emoji overrides must be truly visible in supported recipes without an emojiPop channel"
        );
    }

    #[test]
    fn matrix_decode_switches_retained_glyph_geometry_without_a_full_frame_raster() {
        let mut source = designed_layout_document("caption-matrix-decode");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(plan.subtitle_scene_static_fallback(), None);

        let samples = [0.52, 0.62, 0.72, 0.82, 0.92, 1.02];
        let mut sampled = Vec::new();
        for time in samples {
            let frame = plan.subtitle_scene_frame(time).unwrap();
            let [element_draw::SceneNode::Glyphs(run)] = frame.scene.nodes.as_slice() else {
                panic!("matrix decode must submit only local glyph geometry, not a full-frame bitmap")
            };
            sampled.push((time, Arc::clone(&run.glyphs), frame.scene.next_change));
        }
        let (changed_time, changed_geometry, next_change) = sampled
            .iter()
            .skip(1)
            .find(|(_, geometry, _)| !Arc::ptr_eq(&sampled[0].1, geometry))
            .cloned()
            .expect("a scramble phase change must switch to the replacement glyph geometry");
        assert!(
            next_change.is_some_and(|next| {
                next > changed_time && next <= changed_time + 1.0 / 30.0 + 1e-9
            }),
            "scramble animation must keep reporting the next sample point on the project fps grid: {next_change:?}"
        );

        let same_phase_time = changed_time + 0.001;
        let repeated = plan.subtitle_scene_frame(same_phase_time).unwrap();
        let [element_draw::SceneNode::Glyphs(repeated)] = repeated.scene.nodes.as_slice() else {
            unreachable!()
        };
        assert!(
            Arc::ptr_eq(&changed_geometry, &repeated.glyphs),
            "different sample times in the same scramble phase must hit the bounded Arc geometry cache"
        );
    }

    #[test]
    fn glitch_rgb_keeps_scanlines_and_rgb_duplicates_in_one_retained_screen_scene() {
        let mut source = designed_layout_document("caption-glitch-rgb");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(plan.subtitle_scene_static_fallback(), None);

        let first = plan.subtitle_scene_frame(0.80).unwrap();
        let second = plan.subtitle_scene_frame(0.84).unwrap();
        fn parts(
            nodes: &[element_draw::SceneNode],
        ) -> (
            Vec<&Arc<element_draw::RoundedRectNode>>,
            Vec<&Arc<element_draw::GlyphRun>>,
        ) {
            let rects = nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::RoundedRect(rect) => Some(rect),
                    _ => None,
                })
                .collect();
            let runs = nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .collect();
            (rects, runs)
        }
        let [element_draw::SceneNode::BlurredGroup(first_group)] = first.scene.nodes.as_slice()
        else {
            panic!("glitch must first composite a transparent layer, then Screen the whole group")
        };
        let [element_draw::SceneNode::BlurredGroup(second_group)] = second.scene.nodes.as_slice()
        else {
            panic!("later glitch frames must still keep the Screen group")
        };
        assert_eq!(
            first_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        assert_eq!(
            second_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        let (first_rects, first_runs) = parts(&first_group.nodes);
        let (second_rects, second_runs) = parts(&second_group.nodes);
        assert!(!first_rects.is_empty(), "scanline must be expressed by procedural rects");
        assert_eq!(first_rects.len(), second_rects.len());
        assert_eq!(first_runs.len(), 6, "each of the two words keeps three runs: red/cyan/main");
        assert_eq!(first_runs.len(), second_runs.len());
        assert!(first_rects.iter().all(|rect| rect.radius == 0.0));
        assert!(first_runs.iter().all(|run| {
            run.composite == element_draw::SceneCompositeMode::Normal && !run.glyphs.is_empty()
        }));
        assert!(
            first_runs
                .iter()
                .flat_map(|run| &run.uniforms)
                .any(|uniform| {
                    uniform.color[0] > 0.9 && uniform.color[1] < 0.4 && uniform.color[3] > 0.0
                })
        );
        assert!(
            first_runs
                .iter()
                .flat_map(|run| &run.uniforms)
                .any(|uniform| {
                    uniform.color[2] > 0.9 && uniform.color[1] > 0.7 && uniform.color[3] > 0.0
                })
        );
        for (first, second) in first_runs.iter().zip(second_runs) {
            assert!(Arc::ptr_eq(&first.glyphs, &second.glyphs));
        }
        assert!(first_group.nodes.iter().all(|node| !matches!(
            node,
            element_draw::SceneNode::Vectors(_) | element_draw::SceneNode::AnimatedVectors { .. }
        )));
        let next = first.scene.next_change.expect("glitch must report the next fps sample");
        assert!(next > 0.80 && next <= 0.80 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn particle_burst_keeps_fixed_transparent_slots_and_retained_glyph_geometry() {
        let mut source = designed_layout_document("caption-particle-burst");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["captionEmphasis"] = json!({
            "w1": {"anchorText": "Hello", "role": "hero"}
        });
        source["style"]["wordAnimation"]["caption"]["options"] =
            json!([{"kind": "number", "key": "particleCount", "number": 12}]);
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(plan.subtitle_scene_static_fallback(), None);

        let transparent = plan.subtitle_scene_frame(0.50).unwrap();
        let first = plan.subtitle_scene_frame(0.70).unwrap();
        let second = plan.subtitle_scene_frame(0.76).unwrap();
        fn rects(nodes: &[element_draw::SceneNode]) -> Vec<&Arc<element_draw::RoundedRectNode>> {
            nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::RoundedRect(rect) => Some(rect),
                    _ => None,
                })
                .collect()
        }
        fn runs(nodes: &[element_draw::SceneNode]) -> Vec<&Arc<element_draw::GlyphRun>> {
            nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run) => Some(run),
                    _ => None,
                })
                .collect()
        }
        let [element_draw::SceneNode::BlurredGroup(transparent_group)] =
            transparent.scene.nodes.as_slice()
        else {
            panic!("the transparent first particle frame must also keep the Screen group")
        };
        let transparent_rects = rects(&transparent_group.nodes);
        assert_eq!(transparent_rects.len(), 12);
        assert!(
            transparent_rects.iter().all(|rect| rect.color[3] == 0.0),
            "before the burst starts, the fixed particle slots must be transparent only"
        );
        let [element_draw::SceneNode::BlurredGroup(first_group)] = first.scene.nodes.as_slice()
        else {
            panic!("particle must first composite a transparent layer, then Screen the whole group")
        };
        let [element_draw::SceneNode::BlurredGroup(second_group)] = second.scene.nodes.as_slice()
        else {
            panic!("later particle frames must still keep the Screen group")
        };
        assert_eq!(
            first_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        assert_eq!(
            second_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        let first_rects = rects(&first_group.nodes);
        let second_rects = rects(&second_group.nodes);
        assert_eq!(first_rects.len(), 12, "fixed particle slots are kept only for the hero word");
        assert_eq!(second_rects.len(), first_rects.len());
        assert!(
            first_rects.iter().all(|rect| {
                rect.radius > 0.0 && (rect.rect[2] - rect.radius * 2.0).abs() < 1e-4
            })
        );
        assert!(
            first_rects
                .iter()
                .zip(&second_rects)
                .any(|(first, second)| {
                    first.rect != second.rect || first.color != second.color
                })
        );
        let first_runs = runs(&first_group.nodes);
        let second_runs = runs(&second_group.nodes);
        assert_eq!(first_runs.len(), second_runs.len());
        for (first, second) in first_runs.iter().zip(second_runs) {
            assert_eq!(first.composite, element_draw::SceneCompositeMode::Normal);
            assert!(Arc::ptr_eq(&first.glyphs, &second.glyphs));
        }
        assert!(first_group.nodes.iter().all(|node| !matches!(
            node,
            element_draw::SceneNode::Vectors(_) | element_draw::SceneNode::AnimatedVectors { .. }
        )));
        let next = first
            .scene
            .next_change
            .expect("particle must report the next fps sample");
        assert!(next > 0.70 && next <= 0.70 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn neon_and_weight_recipes_keep_fixed_stroke_runs_and_only_update_uniforms() {
        fn stroke_runs(nodes: &[element_draw::SceneNode]) -> Vec<&Arc<element_draw::GlyphRun>> {
            nodes
                .iter()
                .filter_map(|node| match node {
                    element_draw::SceneNode::Glyphs(run)
                        if run.uniforms.iter().any(|uniform| {
                            matches!(
                                uniform.paint,
                                element_draw::GlyphPaint::DilatedStroke { .. }
                            )
                        }) =>
                    {
                        Some(run)
                    }
                    _ => None,
                })
                .collect()
        }

        fn children<'a>(
            scene: &'a element_draw::SceneFrame,
            expected_composite: element_draw::SceneCompositeMode,
            style_id: &str,
        ) -> &'a [element_draw::SceneNode] {
            if expected_composite == element_draw::SceneCompositeMode::Screen {
                let [element_draw::SceneNode::BlurredGroup(group)] = scene.nodes.as_slice() else {
                    panic!("{style_id} must use one Screen group")
                };
                assert_eq!(group.composite, expected_composite, "{style_id}");
                &group.nodes
            } else {
                &scene.nodes
            }
        }

        for (style_id, expected_layers, expected_composite) in [
            (
                "caption-neon-accent",
                6,
                element_draw::SceneCompositeMode::Screen,
            ),
            (
                "caption-neon-glow",
                6,
                element_draw::SceneCompositeMode::Screen,
            ),
            (
                "caption-weight-shift",
                2,
                element_draw::SceneCompositeMode::Normal,
            ),
        ] {
            let mut source = designed_layout_document(style_id);
            source["style"]["background"] = json!(false);
            source["style"]["outline"] = json!(false);
            source["style"]["underline"] = json!(false);
            source["style"]["glow"] = json!({"on": false});
            source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None)
                .unwrap_or_else(|error| panic!("compile {style_id}: {error}"));
            assert_eq!(plan.subtitle_scene_static_fallback(), None, "{style_id}");

            let transparent = plan.subtitle_scene_frame(0.50).unwrap();
            let first = plan.subtitle_scene_frame(0.54).unwrap();
            let second = plan.subtitle_scene_frame(0.58).unwrap();
            let transparent_runs =
                stroke_runs(children(&transparent.scene, expected_composite, style_id));
            let first_runs = stroke_runs(children(&first.scene, expected_composite, style_id));
            let second_runs = stroke_runs(children(&second.scene, expected_composite, style_id));
            assert_eq!(transparent_runs.len(), expected_layers, "{style_id}");
            assert_eq!(first_runs.len(), expected_layers, "{style_id}");
            assert_eq!(second_runs.len(), expected_layers, "{style_id}");
            assert!(transparent_runs.iter().all(|run| {
                run.uniforms.iter().all(|uniform| {
                    uniform.color[3] == 0.0
                        && matches!(
                            uniform.paint,
                            element_draw::GlyphPaint::DilatedStroke { width } if width == 0.0
                        )
                })
            }));
            assert!(first_runs.iter().any(|run| {
                run.uniforms.iter().any(|uniform| {
                    uniform.color[3] > 0.0
                        && matches!(
                            uniform.paint,
                            element_draw::GlyphPaint::DilatedStroke { width } if width > 0.0
                        )
                })
            }));
            for (first, second) in first_runs.iter().zip(&second_runs) {
                assert!(Arc::ptr_eq(&first.glyphs, &second.glyphs), "{style_id}");
            }
            assert!(
                first_runs
                    .iter()
                    .zip(second_runs)
                    .any(|(first, second)| first.uniforms != second.uniforms),
                "{style_id} must update stroke uniforms on the fps grid"
            );
        }
    }

    #[test]
    fn target_sampling_caption_still_requests_an_explicit_scene_fallback() {
        let mut source = designed_layout_document("caption-blend-difference");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(
            plan.subtitle_scene_frame(1.0).unwrap_err(),
            SubtitleSceneFallback::CompositeMode,
            "a composite that reads the real backdrop must not bypass the capability gate"
        );
        assert_eq!(plan.subtitle_scene_static_fallback_with_backdrop(), None);
        let target_scene = plan.subtitle_scene_frame_with_backdrop(1.0).unwrap();
        let [element_draw::SceneNode::BlurredGroup(group)] = target_scene.scene.nodes.as_slice()
        else {
            panic!("a backdrop-aware subtitle scene should keep the target composite in the top-level group")
        };
        assert_eq!(
            group.composite,
            element_draw::SceneCompositeMode::Difference
        );
        plan.compositor_scene_support().unwrap();
        let scene = plan.compositor_scene_frame(1.0).unwrap();
        let [element_draw::SceneNode::BlurredGroup(group)] = scene.nodes.as_slice() else {
            panic!("an offline scene should collapse target-sampling subtitles into a top-level group")
        };
        assert_eq!(
            group.composite,
            element_draw::SceneCompositeMode::Difference
        );
        assert!(group.nodes.iter().all(|node| match node {
            element_draw::SceneNode::Glyphs(run) => {
                run.composite == element_draw::SceneCompositeMode::Normal
            }
            _ => true,
        }));
    }

    #[test]
    fn texture_fill_keeps_one_content_addressed_resource_and_retained_geometry() {
        let mut source = designed_layout_document("caption-texture");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["wordAnimation"]["caption"]["options"] =
            json!([{"kind": "text", "key": "texture", "text": "wood"}]);
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();

        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let second = plan.subtitle_scene_frame(0.62).unwrap();
        let [element_draw::SceneNode::Glyphs(first_run)] = first.scene.nodes.as_slice() else {
            panic!("texture fill must be expressed by a single retained glyph scene layer")
        };
        let [element_draw::SceneNode::Glyphs(second_run)] = second.scene.nodes.as_slice() else {
            panic!("later texture fill samples must still be a glyph scene")
        };
        assert!(Arc::ptr_eq(&first_run.glyphs, &second_run.glyphs));
        assert!(
            first_run
                .uniforms
                .iter()
                .all(|uniform| { uniform.paint == element_draw::GlyphPaint::RepeatTexture })
        );
        let first_texture = first_run.texture.as_ref().expect("wood texture resource");
        let second_texture = second_run
            .texture
            .as_ref()
            .expect("retained texture resource");
        assert!(Arc::ptr_eq(first_texture, second_texture));
        assert_eq!((first_texture.width, first_texture.height), (181, 181));
        assert_eq!(
            first_texture.rgba.len(),
            first_texture.width as usize * first_texture.height as usize * 4
        );
        assert_ne!(first_run.uniforms, second_run.uniforms);
        let next = first
            .scene
            .next_change
            .expect("texture recipe must report the next fps sample");
        assert!(next > 0.58 && next <= 0.58 + 1.0 / 30.0 + 1e-9, "{next}");
    }

    #[test]
    fn screen_caption_keeps_retained_geometry_without_weakening_target_sampling_fallbacks() {
        let mut source = designed_layout_document("caption-blend-difference");
        source["style"]["background"] = json!(false);
        source["style"]["outline"] = json!(false);
        source["style"]["underline"] = json!(false);
        source["style"]["glow"] = json!({"on": false});
        source["style"]["transition"] = json!({"transitionId": "none", "transitionSpeed": 50});
        source["style"]["wordAnimation"]["caption"]["options"] =
            json!([{"kind": "text", "key": "composite", "text": "screen"}]);

        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let first = plan.subtitle_scene_frame(0.58).unwrap();
        let later = plan.subtitle_scene_frame(0.62).unwrap();
        let [element_draw::SceneNode::BlurredGroup(first_group)] = first.scene.nodes.as_slice()
        else {
            panic!("Screen subtitles must use a group-level composite")
        };
        let [element_draw::SceneNode::BlurredGroup(later_group)] = later.scene.nodes.as_slice()
        else {
            panic!("later Screen subtitle frames must keep the group-level composite")
        };
        assert_eq!(
            first_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        assert_eq!(
            later_group.composite,
            element_draw::SceneCompositeMode::Screen
        );
        let first_runs = first_group
            .nodes
            .iter()
            .filter_map(|node| match node {
                element_draw::SceneNode::Glyphs(run) => Some(run),
                _ => None,
            })
            .collect::<Vec<_>>();
        let later_runs = later_group
            .nodes
            .iter()
            .filter_map(|node| match node {
                element_draw::SceneNode::Glyphs(run) => Some(run),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert!(!first_runs.is_empty());
        assert_eq!(first_runs.len(), later_runs.len());
        for (first, later) in first_runs.iter().zip(later_runs) {
            assert_eq!(first.composite, element_draw::GlyphCompositeMode::Normal);
            assert_eq!(later.composite, element_draw::GlyphCompositeMode::Normal);
            assert!(std::sync::Arc::ptr_eq(&first.glyphs, &later.glyphs));
        }

        source["style"]["background"] = json!(true);
        let mut with_vector_plate =
            OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(
            with_vector_plate.subtitle_scene_frame(0.58).unwrap_err(),
            SubtitleSceneFallback::CompositeMode,
            "Screen is admitted only when the whole subtitle layer can be expressed exactly by a retained scene"
        );
        source["style"]["background"] = json!(false);

        source["style"]["wordAnimation"]["caption"]["options"] =
            json!([{"kind": "text", "key": "composite", "text": "exclusion"}]);
        let mut exclusion = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        assert_eq!(
            exclusion.subtitle_scene_frame(0.58).unwrap_err(),
            SubtitleSceneFallback::CompositeMode,
            "exclusion still needs to sample the real target and must not pose as a fixed blend"
        );
    }

    /// A host raster element that the R2/R4 compositor hand-off has not yet delivered must explicitly trigger the CPU fallback. It must not quietly disappear, only in the GPU scene.
    #[test]
    fn the_element_scene_rejects_host_rasterized_elements() {
        let mut source = document("none", "none");
        source["timeline"] = json!({
            "tracks": [{"elements": [{
                "id": "host-text", "kind": "text", "start": 0.0, "end": 3.0,
                "text": "still CPU"
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-r1-scene-fallback"),
            &source,
        )
        .unwrap();

        let error = plan.element_scene_frame(1.0).unwrap_err().to_string();
        assert!(error.contains("compositor-scene-unsupported"), "{error}");
        assert!(error.contains("host-text"), "{error}");
    }

    /// The material sticker's `sticker.fillOverrides` must be applied to the **picture**.
    ///
    /// The raster cache is keyed by source id, and recolouring is element-level. Without a separate variant, the property page would turn an orange dot green, and the toolbar colour block would turn green as well, while the stage stayed orange (reported by a user on 2026-09-08). Here, two stickers from the same source each carry a colour override table, and the picture must show two colours.
    #[test]
    fn an_asset_stickers_fill_override_reaches_the_pixels() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media/elements")).unwrap();
        std::fs::write(
            project.path().join("media/elements/face.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#FF7944"/></svg>"##,
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.2",
            "sources": {"face": {
                "path": "media/elements/face.svg", "kind": "image",
                "naturalW": 40, "naturalH": 40
            }},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [
                {
                    "id": "plain", "kind": "sticker", "start": 0.0, "end": 3.0,
                    "srcId": "face", "place": {"x": 25, "y": 50, "w": 20},
                    "sticker": {"source": "asset", "path": "media/elements/face.svg"}
                },
                {
                    "id": "green", "kind": "sticker", "start": 0.0, "end": 3.0,
                    "srcId": "face", "place": {"x": 75, "y": 50, "w": 20},
                    "sticker": {
                        "source": "asset", "path": "media/elements/face.svg",
                        "fillOverrides": {"#FF7944": "#00C853"}
                    }
                }
            ]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        let rgba = plan.render_rgba(1.0).unwrap();
        let sample = |x: usize, y: usize| {
            let at = (y * 320 + x) * 4;
            (rgba[at], rgba[at + 1], rgba[at + 2])
        };
        // Each of the two stickers takes 20% of the frame width, with centres at 25% and 75%.
        let (left_r, left_g, _) = sample(80, 90);
        let (right_r, right_g, _) = sample(240, 90);
        assert!(
            left_r > left_g,
            "a sticker without an override table must keep its original colour (orange-ish), measured {left_r},{left_g}"
        );
        assert!(
            right_g > right_r,
            "a sticker with fillOverrides must turn green, measured {right_r},{right_g}"
        );

        // The GPU compositing path fetches frames through another route (`compositor_media_nodes`), and it must get the same recoloured image, otherwise preview and export would diverge on recolouring.
        plan.compositor_scene_support().unwrap();
        plan.compositor_scene_frame(1.0).unwrap();
        let texture = plan
            .compositor_texture_frame("timeline-media:green", -1)
            .unwrap();
        let center = texture
            .pixel(texture.width() / 2, texture.height() / 2)
            .unwrap();
        assert!(
            center.green() > center.red(),
            "the GPU texture must also be the recoloured green, measured {},{}",
            center.red(),
            center.green()
        );
    }

    /// Timeline 0.7: `sources[].kind: "lottie"` is referenced by material stickers and sampled frame by frame per `sticker.loop`. `fillOverrides` replaces the bodymovin solid fill. The CPU overlay and the GPU compositing frame-fetch routes must get the same image.
    #[test]
    fn a_lottie_source_renders_as_an_asset_sticker_with_fill_overrides() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media/elements")).unwrap();
        std::fs::copy(
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../render-raster/tests/fixtures/lottie/samples/shapes-only.json"
            ),
            project.path().join("media/elements/circle.json"),
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.7",
            "sources": {"circle": {
                "path": "media/elements/circle.json", "kind": "lottie",
                "naturalW": 200, "naturalH": 200, "duration": 2.0, "hasAudio": false
            }},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [
                {
                    "id": "plain", "kind": "sticker", "start": 0.0, "end": 6.0,
                    "srcId": "circle", "place": {"x": 25, "y": 50, "w": 40},
                    "sticker": {"source": "asset", "path": "media/elements/circle.json", "loop": "loop"}
                },
                {
                    "id": "green", "kind": "sticker", "start": 0.0, "end": 6.0,
                    "srcId": "circle", "place": {"x": 75, "y": 50, "w": 40},
                    "sticker": {
                        "source": "asset", "path": "media/elements/circle.json",
                        "fillOverrides": {"#2170E6": "#00C853"}
                    }
                }
            ]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 320, 6.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        // The sticker lasts 2 s and the element placeholder is 6 s. At 3.5 s it has already wrapped into the second cycle, and under loop semantics there must still be pixels.
        let rgba = plan.render_rgba(3.5).unwrap();
        let sample = |x: usize, y: usize| {
            let at = (y * 320 + x) * 4;
            (rgba[at], rgba[at + 1], rgba[at + 2], rgba[at + 3])
        };
        let (left_r, left_g, left_b, left_a) = sample(80, 160);
        let (right_r, right_g, right_b, right_a) = sample(240, 160);
        assert!(
            left_a > 200,
            "the Lottie sticker centre must have pixels, measured alpha {left_a}"
        );
        assert!(
            left_b > left_g && left_b > left_r,
            "a Lottie without an override table must keep its original colour (bluish), measured {left_r},{left_g},{left_b}"
        );
        assert!(
            right_a > 200,
            "the recoloured Lottie sticker centre must have pixels, measured alpha {right_a}"
        );
        assert!(
            right_g > right_b && right_g > right_r,
            "a Lottie with fillOverrides must turn green, measured {right_r},{right_g},{right_b}"
        );
        // Outside the circle (the corners of the frame) must be transparent. This shows it was rasterised at the material's native 200×200 size and was not stretched into a square.
        let (_, _, _, corner_a) = sample(16, 16);
        assert_eq!(corner_a, 0, "the area outside the circle of the Lottie sticker must be transparent");

        plan.compositor_scene_support().unwrap();
        plan.compositor_scene_frame(3.5).unwrap();
        let texture = plan
            .compositor_texture_frame("timeline-media:green", 1_500)
            .unwrap();
        let center = texture
            .pixel(texture.width() / 2, texture.height() / 2)
            .unwrap();
        // The texture is rasterised at the **actual pixel size of the element box**, not at the material's native 200×200 size. On a 320-wide frame, 40% is 128 px. The extra pixels computed at a vector animation's native size would be scaled away by the GPU in the end, so computing them is wasted (see the target-size derivation in `compositor_media_nodes`).
        assert_eq!((texture.width(), texture.height()), (128, 128));
        assert!(
            center.green() > center.blue(),
            "the GPU texture must also be the recoloured green, measured {},{},{}",
            center.red(),
            center.green(),
            center.blue()
        );
    }

    #[test]
    fn compositor_export_scene_imports_a_host_decoded_image_texture() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/dot.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#00ff00"/></svg>"##,
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.2",
            "sources": {"dot": {"path": "media/dot.svg", "kind": "image", "duration": 0.0}},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [
                {
                    "id": "image-1", "kind": "image", "start": 0.0, "end": 3.0,
                    "srcId": "dot", "mode": "fullscreen", "fit": "contain", "bg": "blur",
                    "place": {"x": 30, "y": 40, "w": 25, "opacity": 0.75, "radius": 4}
                },
                {
                    "id": "sticker-1", "kind": "sticker", "start": 0.0, "end": 3.0,
                    "srcId": "dot", "place": {"x": 70, "y": 60, "w": 20},
                    "sticker": {"source": "asset", "path": "media/dot.svg"}
                }
            ]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();

        plan.compositor_scene_support().unwrap();
        let scene = plan.compositor_scene_frame(1.0).unwrap();
        let [
            element_draw::SceneNode::Texture(node),
            element_draw::SceneNode::Texture(sticker),
        ] = scene.nodes.as_slice()
        else {
            panic!(
                "image and asset sticker must stay two separate TextureNodes: {:?}",
                scene.nodes
            )
        };
        assert_eq!(node.texture, "timeline-media:image-1");
        assert_eq!((node.source_width, node.source_height), (64, 32));
        assert_eq!(node.media_ms, -1);
        assert_eq!(node.opacity, 0.75);
        assert_eq!(node.fit, element_draw::TextureFit::Contain);
        assert_eq!(node.background, element_draw::TextureBackground::Blur);
        assert_eq!(sticker.texture, "timeline-media:sticker-1");
        assert_eq!(sticker.media_ms, -1);
        assert_ne!(node.texture, sticker.texture, "elements from the same source must not compete for a texture slot");
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert_eq!((pixels.width(), pixels.height()), (64, 32));
        assert!(
            pixels
                .data()
                .chunks_exact(4)
                .all(|pixel| pixel == [0, 255, 0, 255])
        );

        source["timeline"]["tracks"][0]["elements"][0]["fx"] = json!({"contrast": 0.25});
        let mut supported = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        supported
            .load_timeline_elements(project.path(), &source)
            .unwrap();
        assert!(supported.compositor_scene_frame(1.0).is_ok());

        source["timeline"]["tracks"][0]["elements"][0]["fx"] = json!({
            "filterPreset": "cottage3",
            "effectPreset": "bokeh_blur",
            "effectIntensity": 0.5,
            "sharpen": 0.25,
            "noise": 0.2,
            "vignette": 0.3
        });
        let mut advanced = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        advanced
            .load_timeline_elements(project.path(), &source)
            .unwrap();
        let scene = advanced.compositor_scene_frame(1.0).unwrap();
        let element_draw::SceneNode::Texture(node) = &scene.nodes[0] else {
            panic!("advanced media effects must stay in one texture node")
        };
        assert!(
            node.source_effects
                .iter()
                .any(|effect| matches!(effect, element_draw::TextureEffect::Sepia(_)))
        );
        assert!(
            node.source_effects
                .iter()
                .any(|effect| matches!(effect, element_draw::TextureEffect::Blur(_)))
        );
        assert!(
            node.source_effects
                .iter()
                .any(|effect| matches!(effect, element_draw::TextureEffect::Sharpen(_)))
        );
        assert!(
            node.source_effects
                .iter()
                .any(|effect| matches!(effect, element_draw::TextureEffect::Noise(_)))
        );
        assert!(
            node.source_effects
                .iter()
                .any(|effect| matches!(effect, element_draw::TextureEffect::Vignette(_)))
        );
    }

    /// [`SceneIdentity::Skip`] may only economise on identity computation; it must not change the picture.
    ///
    /// Export uses Skip to avoid the per-frame FNV-1a over all frame pixels (measured at 3.3 ms/frame at 720p), on the premise that it has zero effect on the scene itself. The nodes, the sampling clock and `next_change` must all be identical item by item to [`SceneIdentity::Full`], and only `fingerprint` is zeroed.
    #[test]
    fn skipping_scene_identity_changes_nothing_but_the_fingerprint() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/dot.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#00ff00"/></svg>"##,
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.2",
            "sources": {"dot": {"path": "media/dot.svg", "kind": "image", "duration": 0.0}},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [{
                "id": "image-1", "kind": "image", "start": 0.0, "end": 3.0,
                "srcId": "dot", "mode": "fullscreen", "fit": "contain", "bg": "blur",
                "place": {"x": 30, "y": 40, "w": 25, "opacity": 0.75, "radius": 4}
            }]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("Karaoke", "fade");
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        plan.compositor_scene_support().unwrap();

        for time in [0.4, 0.9, 1.8] {
            let full = plan
                .compositor_scene_frame_with(time, SceneIdentity::Full)
                .unwrap();
            let skipped = plan
                .compositor_scene_frame_with(time, SceneIdentity::Skip)
                .unwrap();
            assert_eq!(skipped.next_change, full.next_change, "t={time}");
            assert_eq!(skipped.active_until, full.active_until, "t={time}");
            assert_eq!(
                scene_node_shapes(&skipped.nodes),
                scene_node_shapes(&full.nodes),
                "t={time}"
            );
            assert_ne!(full.fingerprint, 0, "t={time}: Full must really compute identity");
            assert_eq!(skipped.fingerprint, 0, "t={time}: Skip identity must be zero");
        }
    }

    /// [`SceneIdentity::Structural`] is the preview's de-duplication identity. It does not read pixels, but the nodes, the sampling clock and `next_change` are identical item by item to [`SceneIdentity::Full`]. At the same moment, two evaluations give a stable identity, and any change in element geometry changes the identity (the pixel proxy replaces only the pixel position; the geometry is still frozen field by field).
    #[test]
    fn structural_scene_identity_matches_full_scene_without_reading_pixels() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/dot.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#00ff00"/></svg>"##,
        )
        .unwrap();
        let compile = |x: f64| {
            let timeline = json!({
                "ccutTimeline": "0.2",
                "sources": {"dot": {"path": "media/dot.svg", "kind": "image", "duration": 0.0}},
                "tracks": [{"id": "overlay", "kind": "overlay", "elements": [{
                    "id": "image-1", "kind": "image", "start": 0.0, "end": 3.0,
                    "srcId": "dot", "mode": "pip", "fit": "contain",
                    "place": {"x": x, "y": 40, "w": 25, "opacity": 0.75, "radius": 4}
                }]}]
            });
            std::fs::write(
                project.path().join("timeline.json"),
                serde_json::to_vec(&timeline).unwrap(),
            )
            .unwrap();
            let mut source = document("None", "none");
            source["cues"] = json!([]);
            source["timeline"] = timeline;
            let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
            plan.load_timeline_elements(project.path(), &source)
                .unwrap();
            plan.compositor_scene_support().unwrap();
            plan
        };
        let mut plan = compile(30.0);
        let mut structural_at = Vec::new();
        for time in [0.4, 0.9, 1.8] {
            let full = plan
                .compositor_scene_frame_with(time, SceneIdentity::Full)
                .unwrap();
            let structural = plan
                .compositor_scene_frame_with(time, SceneIdentity::Structural)
                .unwrap();
            assert_eq!(structural.next_change, full.next_change, "t={time}");
            assert_eq!(structural.active_until, full.active_until, "t={time}");
            assert_eq!(
                scene_node_shapes(&structural.nodes),
                scene_node_shapes(&full.nodes),
                "t={time}"
            );
            assert_ne!(
                structural.fingerprint, 0,
                "t={time}: Structural must really compute identity"
            );
            let again = plan
                .compositor_scene_frame_with(time, SceneIdentity::Structural)
                .unwrap();
            assert_eq!(
                again.fingerprint, structural.fingerprint,
                "t={time}: identity at the same instant must be stable"
            );
            structural_at.push(structural.fingerprint);
        }
        // Static image with no subtitles: the three moments give the same picture, and the de-duplication identity must also be the same, otherwise every frame would wastefully re-upload.
        assert_eq!(structural_at[0], structural_at[1]);
        assert_eq!(structural_at[1], structural_at[2]);

        let mut moved = compile(31.0);
        let moved = moved
            .compositor_scene_frame_with(0.4, SceneIdentity::Structural)
            .unwrap();
        assert_ne!(
            moved.fingerprint, structural_at[0],
            "element geometry changed, so structural identity must change with it"
        );
    }

    #[test]
    fn compositor_export_scene_freezes_media_animation_pose_blur() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/dot.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#00ff00"/></svg>"##,
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.2",
            "sources": {"dot": {"path": "media/dot.svg", "kind": "image", "duration": 0.0}},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [{
                "id": "animated-image", "kind": "image", "start": 0.0, "end": 3.0,
                "srcId": "dot", "place": {"w": 25},
                "animate": {"enter": {"preset": "blurIn", "presetVersion": 1}}
            }]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();

        let animated = plan.compositor_scene_frame(0.1).unwrap();
        let [element_draw::SceneNode::BlurredGroup(group)] = animated.nodes.as_slice() else {
            panic!("blurIn's active window must freeze into a whole-element BlurredGroup")
        };
        assert!(group.radius > 0.0);
        let [element_draw::SceneNode::Texture(node)] = group.nodes.as_slice() else {
            panic!("the animation group must keep the external texture child node")
        };
        assert_eq!(node.texture, "timeline-media:animated-image");
        assert_eq!(node.reveal, 1.0);
        plan.compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();

        let settled = plan.compositor_scene_frame(1.0).unwrap();
        let [element_draw::SceneNode::Texture(node)] = settled.nodes.as_slice() else {
            panic!("no empty intermediate pass should remain after blurIn ends")
        };
        assert_eq!(node.reveal, 1.0);
        assert_ne!(animated.fingerprint, settled.fingerprint);
    }

    #[test]
    fn compositor_export_scene_expands_masked_image_tile_without_reuploading_the_source() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        std::fs::write(
            project.path().join("media/dot.svg"),
            br##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#00ff00"/></svg>"##,
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.2",
            "sources": {"dot": {"path": "media/dot.svg", "kind": "image", "duration": 0.0}},
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [{
                "id": "tile-1", "kind": "image", "start": 0.0, "end": 3.0,
                "srcId": "dot", "fit": "cover",
                "place": {"w": 20, "scale": 1.1, "scaleY": 0.9, "rot": 5},
                "mask": {"shape": "ellipse", "feather": 4},
                "fx": {"grayscale": 0.6, "blur": 4, "brightness": -0.2},
                "tile": {"on": true, "angle": -30, "gapX": 8, "gapY": 10}
            }]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();

        let scene = plan.compositor_scene_frame(1.0).unwrap();
        assert!(scene.nodes.len() > 20);
        let textures = scene
            .nodes
            .iter()
            .map(|node| match node {
                element_draw::SceneNode::Texture(node) => node,
                other => panic!("tile can only expand into a TextureNode: {other:?}"),
            })
            .collect::<Vec<_>>();
        assert!(
            textures
                .iter()
                .all(|node| node.texture == "timeline-media:tile-1"
                    && node.media_ms == -1
                    && node.mask_shape == element_draw::TextureMaskShape::Ellipse
                    && node.radius == 0.0
                    && node.mask_feather > 0.0
                    && node.source_effects.as_ref()
                        == [
                            element_draw::TextureEffect::ColorAdjust {
                                grayscale: 0.6,
                                brightness: -0.2,
                            },
                            element_draw::TextureEffect::Blur(1),
                        ])
        );
        let pixels = plan
            .compositor_texture_frame(&textures[0].texture, textures[0].media_ms)
            .unwrap();
        assert_eq!((pixels.width(), pixels.height()), (64, 32));
    }

    #[test]
    fn compositor_export_scene_places_template_chrome_last() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        let template = chrome_scene(0.0, 24.0 / 1.8);
        let fingerprint = template.fingerprint;
        plan.set_template_scene(Some(template));

        plan.compositor_scene_support().unwrap();
        let scene = plan.compositor_scene_frame(1.0).unwrap();
        let Some(element_draw::SceneNode::Texture(node)) = scene.nodes.last() else {
            panic!("template chrome must become the last TextureNode")
        };
        assert_eq!(node.texture, format!("template-chrome:{fingerprint:016x}"));
        assert_eq!(node.rect, [0.0, 0.0, 320.0, 180.0]);
        assert_eq!(node.media_ms, 1_000);
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert!(alpha_rows(pixels.data(), 320, 4) > 0);
        assert_eq!(alpha_rows(pixels.data(), 320, 40), 0);
    }

    #[test]
    fn compositor_export_scene_keeps_vector_before_retained_text() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "tracks": [{"elements": [
                {
                    "id": "shape", "kind": "shape", "start": 0.0, "end": 3.0,
                    "shape": {"shape": "rect", "fill": "#ff0000"},
                    "place": {"x": 30, "y": 30, "w": 20}
                },
                {
                    "id": "title", "kind": "text", "start": 0.0, "end": 3.0,
                    "text": "GPU", "style": {
                        "fontFamily": "Montserrat", "fontSize": 28,
                        "background": false, "outline": false
                    }
                }
            ]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();

        plan.compositor_scene_support().unwrap();
        let scene = plan.compositor_scene_frame(1.0).unwrap();
        assert!(matches!(
            scene.nodes.first(),
            Some(element_draw::SceneNode::Vectors(_))
        ));
        assert!(matches!(
            scene.nodes.last(),
            Some(element_draw::SceneNode::Glyphs(_))
        ));
        assert_eq!(scene.next_change, Some(3.0));
    }

    #[test]
    fn local_text_audition_moves_only_the_target_and_restores_the_frame() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({"tracks":[{"elements":[
            {"id":"shape","kind":"shape","start":0,"end":3,"shape":{"shape":"rect","fill":"#FF0000"},"place":{"x":20,"y":20,"w":10},"animate":{"loop":{"preset":"pulse","period":2}}},
            {"id":"title","kind":"text","start":1,"end":3,"text":"LOCAL","place":{"x":60,"y":65,"w":50},"style":{"fontFamily":"Montserrat","fontSize":28,"background":false,"outline":false},"animate":{"enter":{"preset":"fade","dur":1},"exit":{"preset":"none"}}}
        ]}]});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();
        let base = plan.render_rgba_frame(0.5).unwrap();
        let before = plan.compositor_scene_frame(0.5).unwrap();
        plan.set_element_sample_time(Some(("title".into(), 1.2)));
        let first = plan.compositor_scene_frame(0.5).unwrap();
        let cpu_first = plan.render_rgba_frame(0.5).unwrap();
        plan.set_element_sample_time(Some(("title".into(), 1.8)));
        let second = plan.compositor_scene_frame(0.5).unwrap();
        let cpu_second = plan.render_rgba_frame(0.5).unwrap();
        assert_eq!(
            format!("{:?}", before.nodes.first()),
            format!("{:?}", first.nodes.first()),
            "background keeps timeline time"
        );
        assert_eq!(
            format!("{:?}", first.nodes.first()),
            format!("{:?}", second.nodes.first())
        );
        assert!(
            first.nodes.len() > before.nodes.len(),
            "selected text can be auditioned outside its timeline span"
        );
        assert_ne!(first.fingerprint, second.fingerprint);
        assert_ne!(cpu_first.rgba, cpu_second.rgba);
        plan.set_element_sample_time(None);
        assert_eq!(
            plan.compositor_scene_frame(0.5).unwrap().fingerprint,
            before.fingerprint
        );
        assert_eq!(plan.render_rgba_frame(0.5).unwrap().rgba, base.rgba);
    }

    /// The source image shared by the whiteboard tests: the left half is one black ink stroke (a thin line), and the right half is a red colour block.
    fn ccut_subtitle_render_whiteboard_project() -> (tempfile::TempDir, Value) {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(project.path().join("media")).unwrap();
        let mut pixmap = tiny_skia::Pixmap::new(240, 120).unwrap();
        pixmap.fill(tiny_skia::Color::WHITE);
        let mut ink = tiny_skia::Paint::default();
        ink.set_color_rgba8(20, 20, 20, 255);
        let mut stroke = tiny_skia::Stroke::default();
        stroke.width = 4.0;
        let mut pb = tiny_skia::PathBuilder::new();
        pb.move_to(20.0, 20.0);
        pb.line_to(100.0, 100.0);
        pb.line_to(100.0, 20.0);
        let path = pb.finish().unwrap();
        pixmap.stroke_path(&path, &ink, &stroke, tiny_skia::Transform::identity(), None);
        let mut red = tiny_skia::Paint::default();
        red.set_color_rgba8(230, 40, 40, 255);
        pixmap.fill_rect(
            tiny_skia::Rect::from_xywh(150.0, 30.0, 60.0, 60.0).unwrap(),
            &red,
            tiny_skia::Transform::identity(),
            None,
        );
        std::fs::write(
            project.path().join("media/board.png"),
            pixmap.encode_png().unwrap(),
        )
        .unwrap();
        let timeline = json!({
            "ccutTimeline": "0.8",
            "sources": {
                "board": {"path": "media/board.png", "kind": "image", "duration": 0.0}
            },
            "tracks": [{"id": "overlay", "kind": "overlay", "elements": [{
                "id": "wb", "kind": "whiteboard", "start": 0.0, "end": 4.0, "srcId": "board",
                "place": {"x": 50, "y": 50, "w": 80},
                "whiteboard": {"draw": 2.0, "hand": "none"}
            }]}]
        });
        std::fs::write(
            project.path().join("timeline.json"),
            serde_json::to_vec(&timeline).unwrap(),
        )
        .unwrap();
        (project, timeline)
    }

    fn ccut_subtitle_render_count_reddish(rgba: &[u8]) -> usize {
        rgba.chunks_exact(4)
            .filter(|px| px[0] > 150 && px[1] < 90 && px[2] < 90)
            .count()
    }

    /// In the GPU compositing scene (offscreen export and App preview), a whiteboard piece must not be silently dropped. The CPU produces only the reveal texture at its natural size, while fit, mask and pose are left to the GPU TextureNode. The pixels come from the same source as the CPU overlay (no red in the front section, the red block complete in the hold section), and the reveal is scheduled per frame.
    #[test]
    fn compositor_scene_keeps_whiteboard_at_source_size_and_gpu_places_it() {
        let (project, timeline) = ccut_subtitle_render_whiteboard_project();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 4.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        plan.compositor_scene_support().unwrap();

        let early = plan.compositor_scene_frame(0.5).unwrap();
        let [element_draw::SceneNode::Texture(node)] = early.nodes.as_slice() else {
            panic!("the whiteboard piece should become the only TextureNode: {:?}", early.nodes.len())
        };
        assert_eq!(node.texture, "whiteboard:wb");
        assert_eq!(node.rect, [32.0, 26.0, 256.0, 128.0]);
        assert_eq!((node.source_width, node.source_height), (240, 120));
        assert_eq!(node.media_ms, 500);
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert_eq!((pixels.width(), pixels.height()), (240, 120));
        assert_eq!(
            ccut_subtitle_render_count_reddish(pixels.data()),
            0,
            "the early part only has ink strokes"
        );
        assert_eq!(
            early.next_change,
            Some(16.0 / 30.0),
            "revealed frame by frame during drawing, so the next frame must resample"
        );

        let held = plan.compositor_scene_frame(3.0).unwrap();
        let [element_draw::SceneNode::Texture(node)] = held.nodes.as_slice() else {
            panic!("the hold segment must still be one TextureNode")
        };
        assert_eq!(held.next_change, Some(4.0), "after draw it should be reused directly to the end of the element");
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert!(
            ccut_subtitle_render_count_reddish(pixels.data()) > 1000,
            "the red block is complete in the hold segment"
        );
        assert_ne!(
            early.fingerprint, held.fingerprint,
            "scene fingerprints differ for different sampling clocks"
        );
        let structural = plan
            .compositor_scene_frame_with(3.0, SceneIdentity::Structural)
            .unwrap();
        assert!(!structural.nodes.is_empty());
    }

    /// When the source image is larger than the element box, the reveal field runs at **the box's pixel size**, not at the source image's natural size.
    ///
    /// On a 160×90 frame, a box with `w: 80` is 128 px wide, while the source is 240×120. It is scaled to 128×64 for the reveal, so the final texture is 128×64. When the box is larger than the source, it is not scaled down (see [`Self::compositor_scene_keeps_whiteboard_at_source_size_and_gpu_places_it`]: on a 320 frame the box is 256 px, wider than the 240 source, so enlargement is left to the GPU).
    #[test]
    fn a_whiteboard_larger_than_its_box_reveals_at_the_box_size() {
        let (project, timeline) = ccut_subtitle_render_whiteboard_project();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 160, 90, 4.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        plan.compositor_scene_support().unwrap();

        let early = plan.compositor_scene_frame(0.5).unwrap();
        let [element_draw::SceneNode::Texture(node)] = early.nodes.as_slice() else {
            panic!("the whiteboard piece should become the only TextureNode")
        };
        assert_eq!(
            (node.source_width, node.source_height),
            (128, 64),
            "the texture is produced at the element box's pixel size, not the source image's 240×120"
        );
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert_eq!((pixels.width(), pixels.height()), (128, 64));
        assert_eq!(
            ccut_subtitle_render_count_reddish(pixels.data()),
            0,
            "after scaling down, the early part still only has ink strokes"
        );

        // The reveal progresses as usual: after `draw`, the red block must appear in full (scaled by area, roughly 1/3.5).
        let held = plan.compositor_scene_frame(3.0).unwrap();
        let [element_draw::SceneNode::Texture(node)] = held.nodes.as_slice() else {
            panic!("the hold segment must still be one TextureNode")
        };
        let pixels = plan
            .compositor_texture_frame(&node.texture, node.media_ms)
            .unwrap();
        assert!(
            ccut_subtitle_render_count_reddish(pixels.data()) > 250,
            "the red block is complete in the hold segment, measured {}",
            ccut_subtitle_render_count_reddish(pixels.data())
        );
    }

    /// The whiteboard piece follows the Image geometry and mask path, and is revealed on the pixels only by the exposure field. Before `draw`, it appears step by step (ink before colour). After `draw`, it is pixel-identical to the same-source image piece. A frame at any moment is only a function of `t`: out-of-order sampling and sequential sampling must yield the same pixels.
    #[test]
    fn whiteboard_reveals_ink_before_color_and_is_order_independent() {
        let (project, timeline) = ccut_subtitle_render_whiteboard_project();
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline.clone();
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 4.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();

        let start = plan.render_rgba_frame(0.0).unwrap();
        let early = plan.render_rgba_frame(0.5).unwrap();
        let mid = plan.render_rgba_frame(1.7).unwrap();
        let held = plan.render_rgba_frame(3.0).unwrap();
        let red_start = ccut_subtitle_render_count_reddish(&start.rgba);
        let red_early = ccut_subtitle_render_count_reddish(&early.rgba);
        let red_mid = ccut_subtitle_render_count_reddish(&mid.rgba);
        let red_held = ccut_subtitle_render_count_reddish(&held.rgba);
        assert_eq!(red_start, 0, "nothing is drawn yet at t=0");
        assert_eq!(red_early, 0, "ink before colour: the early part of draw only paints black lines, the red block has not started");
        assert!(
            red_mid > 0 && red_mid < red_held,
            "the red block is partly drawn in the middle: {red_mid} / {red_held}"
        );
        assert!(red_held > 1000, "the red block is complete in the hold segment: {red_held}");
        assert_ne!(start.rgba, early.rgba, "ink strokes should already appear in the early part");

        // The hold section is pixel-identical to the same-source image piece: the whiteboard does not change geometry, mask or compositing.
        let mut as_image = source.clone();
        as_image["timeline"]["tracks"][0]["elements"][0]["kind"] = json!("image");
        as_image["timeline"]["tracks"][0]["elements"][0]
            .as_object_mut()
            .unwrap()
            .remove("whiteboard");
        let mut image_plan =
            OverlayRenderPlan::compile(&as_image, 320, 180, 4.0, 30.0, None).unwrap();
        image_plan
            .load_timeline_elements(project.path(), &as_image)
            .unwrap();
        assert_eq!(image_plan.render_rgba_frame(3.0).unwrap().rgba, held.rgba);

        // Out-of-order sampling: the new plan first samples at 3.0, then at 1.7, 0.5 and 0.0. The pixels must match sequential sampling.
        let mut shuffled = OverlayRenderPlan::compile(&source, 320, 180, 4.0, 30.0, None).unwrap();
        shuffled
            .load_timeline_elements(project.path(), &source)
            .unwrap();
        assert_eq!(shuffled.render_rgba_frame(3.0).unwrap().rgba, held.rgba);
        assert_eq!(shuffled.render_rgba_frame(1.7).unwrap().rgba, mid.rgba);
        assert_eq!(shuffled.render_rgba_frame(0.5).unwrap().rgba, early.rgba);
        assert_eq!(shuffled.render_rgba_frame(0.0).unwrap().rgba, start.rgba);
        assert_eq!(plan.whiteboard_cache.len(), 1, "the same source with the same parameters is analysed only once");
    }

    /// `beats` changes the reveal order. Pin the red block to 0 seconds and the ink line to a later time, and red should appear first in the front section.
    #[test]
    fn whiteboard_beats_override_reading_order() {
        let (project, mut timeline) = ccut_subtitle_render_whiteboard_project();
        timeline["tracks"][0]["elements"][0]["whiteboard"] = json!({
            "draw": 2.0, "hand": "none",
            "beats": [
                {"at": 0.0, "box": [60, 20, 35, 60]},
                {"at": 1.2, "box": [5, 10, 45, 80]}
            ]
        });
        let mut source = document("none", "none");
        source["cues"] = json!([]);
        source["timeline"] = timeline;
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 4.0, 30.0, None).unwrap();
        plan.load_timeline_elements(project.path(), &source)
            .unwrap();
        let early = plan.render_rgba_frame(0.5).unwrap();
        assert!(
            ccut_subtitle_render_count_reddish(&early.rgba) > 0,
            "beats put the red block on the first beat, so red should be visible in the early part"
        );
    }

    /// The shared setup for the two confetti try-on tests. The window is needed only when a ghost is filled in.
    fn ccut_subtitle_render_confetti_peek(id: &str, style: &str) -> ConfettiPeek {
        ConfettiPeek {
            id: id.to_owned(),
            props: timeline::schema::ConfettiProps {
                seed: Some(7),
                ..timeline::schema::ConfettiProps::new(style)
            },
            window: (0.0, 6.0),
        }
    }

    /// Confetti try-on uses an **in-place patch**. Switching styles changes only that one piece's `confetti` in the plan, and undoing writes the original recipe back. The host therefore does not have to fully recompile once just to recover the original value (round 236).
    #[test]
    fn confetti_peek_swaps_a_recipe_in_place_and_restores_it() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({"tracks":[{"elements":[
            {"id":"cft","kind":"confetti","start":0,"end":6,
             "confetti":{"style":"rainbow-paper","seed":7}}
        ]}]});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 6.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();
        let base = plan.render_rgba_frame(1.0).unwrap();
        let elements_before = plan.elements.len();

        plan.set_confetti_peek(Some(ccut_subtitle_render_confetti_peek(
            "cft",
            "neon-streamers",
        )));
        let swapped = plan.render_rgba_frame(1.0).unwrap();
        assert_eq!(plan.elements.len(), elements_before, "an in-place patch adds no elements");
        assert_ne!(
            swapped.draw_op_fingerprint, base.draw_op_fingerprint,
            "a style change must really change the draw ops, otherwise the host's same-fingerprint dedupe would swallow the preview frame"
        );

        // Switching twice in a row: the second style must start from the **original recipe**, not from the first style.
        plan.set_confetti_peek(Some(ccut_subtitle_render_confetti_peek(
            "cft",
            "hearts-petals",
        )));
        let second = plan.render_rgba_frame(1.0).unwrap();
        assert_ne!(second.draw_op_fingerprint, swapped.draw_op_fingerprint);

        plan.set_confetti_peek(None);
        let restored = plan.render_rgba_frame(1.0).unwrap();
        assert_eq!(plan.elements.len(), elements_before);
        assert_eq!(
            restored.draw_op_fingerprint, base.draw_op_fingerprint,
            "undo must return to the original recipe; the plan stores the original value, so no recompile is needed"
        );
        assert_eq!(restored.rgba, base.rgba);
    }

    /// When the target piece is absent from the plan, a ghost piece is conjured out of nothing. On the material library grid no piece is selected yet, and this is the only way that chain can show an effect on the stage (round 236). Undoing removes the whole piece, leaving not a pixel behind.
    #[test]
    fn confetti_peek_conjures_a_ghost_when_the_element_is_absent() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({"tracks":[{"elements":[
            {"id":"shape","kind":"shape","start":0,"end":6,
             "shape":{"shape":"rect","fill":"#FF0000"},"place":{"x":20,"y":20,"w":10}}
        ]}]});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 6.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();
        let base = plan.render_rgba_frame(1.0).unwrap();
        let elements_before = plan.elements.len();

        let mut ghost = ccut_subtitle_render_confetti_peek("__confetti_peek__", "party-cannons");
        ghost.window = (0.0, 6.0);
        plan.set_confetti_peek(Some(ghost));
        let with_ghost = plan.render_rgba_frame(1.0).unwrap();
        assert_eq!(plan.elements.len(), elements_before + 1, "the ghost piece is appended at the end");
        assert_eq!(
            plan.elements.last().map(|e| e.id.as_str()),
            Some("__confetti_peek__")
        );
        assert_ne!(with_ghost.rgba, base.rgba, "the ghost piece must really be drawn");

        plan.set_confetti_peek(None);
        let cleared = plan.render_rgba_frame(1.0).unwrap();
        assert_eq!(plan.elements.len(), elements_before, "undo removes the whole piece");
        assert_eq!(cleared.rgba, base.rgba);
    }

    /// The hover try-on's local clock must also count on the **GPU compositing path**. The macOS App's stage goes through `compositor_scene_frame`. At one point only the text branch consulted `sample_time_for`, while the other elements were evaluated at the global playhead. The ghost confetti's `start` happened to equal the playhead, so it stayed stuck at local time 0, no particle was ever emitted, and nothing appeared on the stage (round 236).
    #[test]
    fn the_peek_clock_drives_non_text_elements_on_the_gpu_path() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({"tracks":[{"elements":[
            {"id":"cft","kind":"confetti","start":1,"end":6,
             "confetti":{"style":"rainbow-paper","seed":7}}
        ]}]});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 6.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();

        // The playhead is pinned to the start of this piece: without consulting the local clock, it equals local time 0.
        let at_start = plan.compositor_scene_frame(1.0).unwrap().fingerprint;
        let cpu_at_start = plan.render_rgba_frame(1.0).unwrap().draw_op_fingerprint;

        plan.set_element_sample_time(Some(("cft".to_owned(), 3.0)));
        assert_ne!(
            plan.compositor_scene_frame(1.0).unwrap().fingerprint,
            at_start,
            "the GPU composite path does not recognise the local clock: the try-on is not visible on stage"
        );
        assert_ne!(
            plan.render_rgba_frame(1.0).unwrap().draw_op_fingerprint,
            cpu_at_start,
            "the CPU overlay path must also recognise the local clock"
        );

        // Undoing the local clock returns to the playhead; both paths must return to their original state.
        plan.set_element_sample_time(None);
        assert_eq!(
            plan.compositor_scene_frame(1.0).unwrap().fingerprint,
            at_start
        );
        assert_eq!(
            plan.render_rgba_frame(1.0).unwrap().draw_op_fingerprint,
            cpu_at_start
        );
    }

    /// The previous test, together with the ghost piece, makes up the user's real scenario. When **no piece is selected** on the material library grid, hover uses `set_confetti_peek` to conjure a `__confetti_peek__` out of nothing, with the window starting at the current playhead. The macOS App's stage goes through the GPU compositing path. The ghost must squeeze into the `active` filter, survive `compositor_scene_support`, and run forward according to the local clock (round 236).
    #[test]
    fn a_confetti_ghost_lands_on_the_gpu_compositor_scene() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({"tracks":[{"elements":[]}]});
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 6.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();
        let bare = plan.compositor_scene_frame(1.0).unwrap().fingerprint;

        let mut ghost = ccut_subtitle_render_confetti_peek("__confetti_peek__", "rainbow-paper");
        ghost.window = (1.0, 3.0);
        plan.set_confetti_peek(Some(ghost));
        let at_local_zero = plan.compositor_scene_frame(1.0).unwrap().fingerprint;

        // Advance the local clock by 1 second: the clock being honoured is what produces particles. If it were not honoured, the ghost would stay stuck at the window start.
        plan.set_element_sample_time(Some(("__confetti_peek__".to_owned(), 2.0)));
        let running = plan.compositor_scene_frame(1.0).unwrap().fingerprint;
        assert_ne!(running, bare, "the ghost piece is not in the GPU composite scene: nothing on stage");
        assert_ne!(
            running, at_local_zero,
            "the ghost piece is stuck at local 0 seconds: not a single particle has been emitted"
        );

        // Undoing the try-on must leave not a single pixel behind.
        plan.set_element_sample_time(None);
        plan.set_confetti_peek(None);
        assert_eq!(plan.compositor_scene_frame(1.0).unwrap().fingerprint, bare);
    }

    /// During stage dragging, the preview changes only the `place` in memory; the on-disk projection document does not move, so `definition_key` does not change. The SceneFrame identity must itself cover the text geometry. Otherwise every preview frame would be dropped by the host's `overlay_fingerprint` de-duplication guard: the selection box moves while the glyphs stay pinned in place, until release commits and they jump.
    #[test]
    fn compositor_scene_fingerprint_follows_in_memory_text_geometry() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "tracks": [{"elements": [{
                "id": "title", "kind": "text", "start": 0.0, "end": 3.0,
                "text": "GPU", "place": {"x": 50, "y": 50, "w": 40},
                "style": {
                    "fontFamily": "Montserrat", "fontSize": 28,
                    "background": false, "outline": false
                }
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();

        let base = plan.compositor_scene_frame(1.0).unwrap().fingerprint;
        let repeat = plan.compositor_scene_frame(1.0).unwrap().fingerprint;
        assert_eq!(
            base, repeat,
            "the same plan at the same instant must reproduce the same identity, or the dedupe guard does not hold"
        );

        // This is how `apply_element_preview` in `apps/cuccut` does it: it writes only Place.
        for (field, patch) in [
            (
                "x",
                Box::new(|place: &mut Place| place.x = Some(62.0)) as Box<dyn Fn(&mut Place)>,
            ),
            ("y", Box::new(|place: &mut Place| place.y = Some(38.0))),
            ("w", Box::new(|place: &mut Place| place.w = Some(55.0))),
            (
                "scale",
                Box::new(|place: &mut Place| place.scale = Some(1.4)),
            ),
            ("rot", Box::new(|place: &mut Place| place.rot = Some(12.0))),
            (
                "opacity",
                Box::new(|place: &mut Place| place.opacity = Some(0.5)),
            ),
        ] {
            let mut moved = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
            moved.load_projected_timeline_elements(&source).unwrap();
            let element = moved
                .elements
                .iter_mut()
                .find(|element| element.id == "title")
                .expect("text element after projection");
            patch(&mut element.place);
            let after = moved.compositor_scene_frame(1.0).unwrap().fingerprint;
            assert_ne!(
                base, after,
                "changing place.{field} in memory must change the SceneFrame identity"
            );
        }
    }

    #[test]
    fn compositor_export_support_accepts_external_texture_elements_after_r5() {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "tracks": [{"elements": [{
                "id": "photo", "kind": "image", "start": 0.0, "end": 3.0,
                "srcId": "asset-photo"
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_projected_timeline_elements(&source).unwrap();

        plan.compositor_scene_support().unwrap();
    }

    // ── Subtitle track set: document truth and the `mode` compatibility projection ──

    #[test]
    fn a_track_set_derives_the_compatibility_mode() {
        let cases = [
            (json!([{"role": "source"}]), StudioMode::Original),
            (json!([{"role": "translation"}]), StudioMode::Translated),
            (
                json!([{"role": "source"}, {"role": "translation"}]),
                StudioMode::Bilingual,
            ),
        ];
        for (tracks, expected) in cases {
            let style = json!({"tracks": tracks});
            assert_eq!(StudioMode::of_style(&style), expected);
        }
    }

    #[test]
    fn a_malformed_track_entry_is_dropped_and_a_repeated_role_keeps_the_first() {
        let style = json!({"tracks": [
            {"role": "nonsense"},
            {"lang": "zh"},
            {"role": "source", "lang": "en"},
            {"role": "source", "lang": "ja"},
            42,
        ]});
        assert_eq!(
            resolve_track_set(&style),
            vec![SubtitleTrack::source(Some("en".to_owned()))]
        );
    }

    /// An old document has no `tracks`: they are derived from the compatibility `mode`. If both are absent, it is a single original-text track.
    #[test]
    fn a_legacy_style_without_tracks_migrates_from_its_mode_at_read_time() {
        assert_eq!(
            resolve_track_set(&json!({"mode": "bilingual"})),
            vec![
                SubtitleTrack::source(None),
                SubtitleTrack::translation(None)
            ]
        );
        assert_eq!(
            resolve_track_set(&json!({"mode": "translated"})),
            vec![SubtitleTrack::translation(None)]
        );
        assert_eq!(
            resolve_track_set(&json!({})),
            vec![SubtitleTrack::source(None)]
        );
        // An unrecognised `mode` is treated the same as absent: no panic and no guessing.
        assert_eq!(
            resolve_track_set(&json!({"mode": "nonsense"})),
            vec![SubtitleTrack::source(None)]
        );
    }

    /// apps/mac unconditionally writes back the flat `mode`. When the two conflict, `mode` wins and the track set is re-derived, and the language annotations of the same role are kept.
    #[test]
    fn a_conflicting_legacy_mode_rederives_the_track_set_and_keeps_langs() {
        let style = json!({
            "mode": "orig",
            "tracks": [{"role": "source", "lang": "en"}, {"role": "translation", "lang": "zh"}],
        });
        assert_eq!(
            resolve_track_set(&style),
            vec![SubtitleTrack::source(Some("en".to_owned()))]
        );
        let style = json!({
            "mode": "bi",
            "tracks": [{"role": "translation", "lang": "zh"}],
        });
        assert_eq!(
            resolve_track_set(&style),
            vec![
                SubtitleTrack::source(None),
                SubtitleTrack::translation(Some("zh".to_owned())),
            ]
        );
    }

    #[test]
    fn tracks_serialize_without_an_empty_lang_key() {
        let tracks = vec![
            SubtitleTrack::source(None),
            SubtitleTrack::translation(Some("zh".to_owned())),
        ];
        assert_eq!(
            tracks_json(&tracks),
            json!([{"role": "source"}, {"role": "translation", "lang": "zh"}])
        );
    }

    /// An export without `--mode` burns the translation track according to the track set, and no longer reads the flat `mode`.
    #[test]
    fn the_burn_in_mode_falls_back_to_the_document_track_set() {
        let mut document =
            json!({"style": {"tracks": [{"role": "source"}, {"role": "translation"}]}});
        assert_eq!(translation_burn_in_mode(&document, None), Some("bilingual"));
        document["style"]["tracks"] = json!([{"role": "translation"}]);
        assert_eq!(
            translation_burn_in_mode(&document, None),
            Some("translated")
        );
        document["style"]["tracks"] = json!([{"role": "source"}]);
        assert_eq!(translation_burn_in_mode(&document, None), None);
        // `--mode` is still a one-off compile parameter and takes precedence over the document's track set.
        document["style"]["tracks"] = json!([{"role": "source"}]);
        assert_eq!(
            translation_burn_in_mode(&document, Some("bilingual")),
            Some("bilingual")
        );
    }

    /// D10: `hidden` is not written to disk by default (so old document bytes are unchanged). It is written out only when set, and it passes through read-time migration unchanged.
    #[test]
    fn a_hidden_track_round_trips_through_the_track_set() {
        let tracks = vec![
            SubtitleTrack::source(None),
            SubtitleTrack::translation(Some("zh".to_owned())).with_hidden(true),
        ];
        let json = tracks_json(&tracks);
        assert_eq!(
            json,
            json!([
                {"role": "source"},
                {"role": "translation", "lang": "zh", "hidden": true},
            ])
        );
        assert_eq!(resolve_track_set(&json!({"tracks": json})), tracks);
        // `hidden: false` is treated the same as absent.
        assert_eq!(
            resolve_track_set(&json!({"tracks": [{"role": "source", "hidden": false}]})),
            vec![SubtitleTrack::source(None)]
        );
    }

    /// D10's core invariant: the root `mode` describes the **declared** track set (turning a track off does not change the declaration), and only the effective mode skips `hidden`. Keeping the two separate is what allows "putting it back" to recover the original.
    #[test]
    fn hidden_narrows_the_effective_mode_but_not_the_declared_one() {
        let style = json!({"tracks": [
            {"role": "source"},
            {"role": "translation", "lang": "zh", "hidden": true},
        ]});
        assert_eq!(StudioMode::of_style(&style), StudioMode::Bilingual);
        assert_eq!(mode_of(&resolve_track_set(&style)), StudioMode::Bilingual);
        assert_eq!(
            effective_track_set(&style),
            vec![SubtitleTrack::source(None)]
        );
        assert_eq!(effective_mode(&style), Some(StudioMode::Original));
        // The write path still canonicalizes the declared `mode` and carries `hidden` through unchanged.
        let mut settled = style.clone();
        crate::style_sync::canonicalize_track_set(
            &mut settled,
            crate::style_sync::TranslationGuard::Keep,
            crate::style_sync::TrackSetIntent::Authored,
        );
        assert_eq!(settled["mode"], json!("bi"));
        assert_eq!(settled["tracks"], style["tracks"]);
    }

    /// With all subtitle tracks turned off, this export burns no subtitles at all (equivalent to `--no-subs`).
    #[test]
    fn an_all_hidden_track_set_has_no_effective_mode() {
        let style = json!({"tracks": [
            {"role": "source", "hidden": true},
            {"role": "translation", "hidden": true},
        ]});
        assert!(effective_track_set(&style).is_empty());
        assert_eq!(effective_mode(&style), None);
        let document = json!({"style": style});
        assert_eq!(translation_burn_in_mode(&document, None), None);
    }

    /// After the translation track is turned off, an export without `--mode` no longer burns the translation.
    #[test]
    fn the_burn_in_mode_skips_hidden_tracks() {
        let mut document = json!({"style": {"tracks": [
            {"role": "source"},
            {"role": "translation", "lang": "zh"},
        ]}});
        assert_eq!(translation_burn_in_mode(&document, None), Some("bilingual"));
        document["style"]["tracks"][1]["hidden"] = json!(true);
        assert_eq!(translation_burn_in_mode(&document, None), None);
        // An explicit `--mode` still takes precedence.
        assert_eq!(
            translation_burn_in_mode(&document, Some("translated")),
            Some("translated")
        );
    }

    /// Duplicate entries for the same role are dropped at parse time, so the warning criterion for "more than one effective translation track" can only be taken from the raw array.
    #[test]
    fn duplicate_roles_are_reported_from_the_raw_track_array() {
        let style = json!({"tracks": [
            {"role": "source"},
            {"role": "translation", "lang": "zh"},
            {"role": "translation", "lang": "ja"},
            {"role": "translation", "lang": "ko"},
        ]});
        assert_eq!(duplicate_track_roles(&style), vec![TrackRole::Translation]);
        assert_eq!(
            resolve_track_set(&style),
            vec![
                SubtitleTrack::source(None),
                SubtitleTrack::translation(Some("zh".to_owned())),
            ]
        );
        assert!(duplicate_track_roles(&json!({"tracks": [{"role": "source"}]})).is_empty());
        assert!(duplicate_track_roles(&json!({})).is_empty());
    }

    /// The track-set adjudication and Studio's JS mirror share one golden table. Both sides consume the same fixture row by row, so whichever side changes the rules out of sync turns the other side red.
    #[test]
    fn the_track_set_resolver_matches_the_shared_contract_fixture() {
        let contract: Value = serde_json::from_str(include_str!(
            "../../speech-doc/tests/fixtures/subtitle-render-contract.json"
        ))
        .unwrap();
        let rows = contract["trackSet"]["resolve"]
            .as_array()
            .expect("fixture is missing trackSet.resolve");
        assert!(!rows.is_empty());
        for row in rows {
            let case = row["description"].as_str().unwrap_or("<no description>");
            let tracks = resolve_track_set(&row["style"]);
            assert_eq!(tracks_json(&tracks), row["expected"]["tracks"], "{case}");
            assert_eq!(
                mode_token(mode_of(&tracks)),
                row["expected"]["mode"].as_str().expect("expected.mode"),
                "{case}"
            );
            // Read-time migration must be idempotent: parsing the adjudicated track set again gives the same result.
            let settled = json!({"tracks": tracks_json(&tracks)});
            assert_eq!(
                tracks_json(&resolve_track_set(&settled)),
                tracks_json(&tracks),
                "{case}"
            );
        }
    }

    #[test]
    fn gpu_normal_overlay_uses_the_cpu_source_over_formula() {
        let overlay = [64, 32, 16, 128, 0, 0, 0, 0];
        let mut expected = [40, 80, 120, 255, 1, 2, 3, 255];
        composite_caption_pixel_bgra(
            &mut expected[..4],
            &overlay[..4],
            CaptionCompositeMode::Normal,
        );
        let mut actual = [40, 80, 120, 255, 1, 2, 3, 255];
        composite_normal_rgba_bgra(&mut actual, 8, 2, 1, &overlay).unwrap();

        assert_eq!(actual, expected);
    }

    /// After a shared body is borrowed: if someone else still holds it, deep-copy it; if it is exclusive, split it out in place. Both paths overlay edits.json.
    #[cfg(feature = "host")]
    #[test]
    fn preview_document_from_shared_clones_only_when_shared() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path();
        std::fs::create_dir_all(project.join("studio")).unwrap();
        std::fs::write(
            project.join("studio/edits.json"),
            serde_json::to_vec(&json!({
                "edits": { "q1": { "text": { "base": "Hello", "value": "Edited" } } }
            }))
            .unwrap(),
        )
        .unwrap();
        let base = json!({
            "meta": { "duration": 3.0 },
            "cues": [ { "id": "q1", "start": 0.0, "end": 1.0, "text": "Hello" } ]
        });

        let shared = std::sync::Arc::new(base.clone());
        let keep = std::sync::Arc::clone(&shared);
        let edited = preview_document_from_shared(project, shared).unwrap();
        assert_eq!(
            edited["cues"][0]["text"], "Edited",
            "the shared path must apply edits on top"
        );
        assert_eq!(keep["cues"][0]["text"], "Hello", "the cached copy must not be rewritten");

        let unique = std::sync::Arc::new(base);
        let edited = preview_document_from_shared(project, unique).unwrap();
        assert_eq!(
            edited["cues"][0]["text"], "Edited",
            "the exclusive path also applies edits on top"
        );
    }

    /// A live segment during transcription (ledger #219, gap ①): the cue stream is replaced wholesale and the translation axis is emptied, but `timeline` is left as is. The main video of a detached main track lives in the element layer, and deleting it by accident would turn the whole stage black.
    #[test]
    fn live_cues_replace_the_cue_stream_and_keep_the_timeline() {
        let mut document = json!({
            "meta": { "duration": 30.0 },
            "cues": [ { "id": "q1", "start": 0.0, "end": 1.0, "text": "盘上的旧稿" } ],
            "sentences": [ { "id": "s1", "text": "盘上的旧稿" } ],
            "transCues": [ { "id": "t1", "start": 0.0, "end": 1.0, "text": "old" } ],
            "timeline": { "tracks": [] }
        });
        apply_live_cues(&mut document, &[(0.0, 1.5, "第一句"), (1.5, 3.0, "第二句")]);
        let cues = document["cues"].as_array().unwrap();
        assert_eq!(cues.len(), 2, "the cue stream is replaced with live segments");
        assert_eq!(cues[0]["text"], "第一句");
        assert_eq!(cues[0]["start"], 0.0);
        assert_eq!(cues[1]["end"], 3.0);
        assert_ne!(cues[0]["id"], cues[1]["id"], "ids must be distinct");
        assert!(
            document["sentences"].as_array().unwrap().is_empty(),
            "live segments have no sentence axis, so the old draft's word ids must not survive"
        );
        assert!(
            document["transCues"].as_array().unwrap().is_empty(),
            "live segments have no translation axis"
        );
        assert!(
            document["timeline"].is_object(),
            "the timeline must not be passive: the main video lives in it as an element"
        );
    }

    /// A reversed segment (a corner case where the recogniser revised the start) must not produce a cue with negative length.
    #[test]
    fn live_cues_clamp_inverted_spans() {
        let mut document = json!({ "cues": [] });
        apply_live_cues(&mut document, &[(4.0, 2.0, "倒挂")]);
        assert_eq!(document["cues"][0]["start"], 4.0);
        assert_eq!(document["cues"][0]["end"], 4.0);
    }

    /// Two kinetic-wave cues: 0–2s with motion, and 2–4s with the motion removed by a per-cue override.
    #[cfg(feature = "host")]
    fn text_motion_split_document() -> Value {
        let design = crate::text_design::designs()
            .iter()
            .find(|design| design["id"] == "kinetic-wave")
            .expect("kinetic-wave design");
        let mut document = crate::text_design::demo_document(&design["style"], "Make every word");
        document["cues"] = json!([
            {"id": "moving", "start": 0.0, "end": 2.0, "text": "Make every word",
             "words": [
                {"id": "m0", "text": "Make", "t0": 0.0, "t1": 0.5},
                {"id": "m1", "text": "every", "t0": 0.6, "t1": 1.1},
                {"id": "m2", "text": "word", "t0": 1.2, "t1": 1.8}]},
            {"id": "plain", "start": 2.0, "end": 4.0, "text": "Plain line",
             "words": [
                {"id": "p0", "text": "Plain", "t0": 2.0, "t1": 2.8},
                {"id": "p1", "text": "line", "t0": 2.9, "t1": 3.8}]}
        ]);
        document["style"]["cueStyles"] = json!({
            "plain": {"source": {"textMotion": null, "wordBackground": null}}
        });
        document
    }

    #[cfg(feature = "host")]
    fn crop_rgba(rgba: &[u8], width: usize, rect: [f32; 4]) -> Vec<u8> {
        let [x, y, w, h] = rect.map(|value| value as usize);
        let mut out = Vec::with_capacity(w * h * 4);
        for row in y..y + h {
            out.extend_from_slice(&rgba[(row * width + x) * 4..(row * width + x + w) * 4]);
        }
        out
    }

    /// Layered text animation is judged per frame: a subtitle layer reports `WordAnimation` while a cue with animation is active, and another cue whose animation is removed by a per-cue override still produces a glyph scene as usual. The whole-film GPU scene is no longer ruled out by this. The subtitle layer on an animated frame is a 1:1 texture cropped from the CPU raster, byte-identical to the sub-rectangle of the image from `render_subtitle_frame`, and the slot name stays stable between frames.
    #[cfg(feature = "host")]
    #[test]
    fn text_motion_subtitles_rasterize_into_a_texture_node_per_frame() {
        let document = text_motion_split_document();
        let mut plan = OverlayRenderPlan::compile(&document, 320, 180, 4.0, 30.0, None).unwrap();
        assert!(plan.has_text_motion());
        assert_eq!(plan.subtitle_scene_static_fallback(), None);
        assert_eq!(plan.subtitle_scene_static_fallback_with_backdrop(), None);
        plan.compositor_scene_support().unwrap();
        assert!(plan.text_motion_active_at(1.0));
        assert!(!plan.text_motion_active_at(3.0));
        assert_eq!(
            plan.subtitle_scene_frame(1.0).err(),
            Some(SubtitleSceneFallback::WordAnimation),
            "frames where a motion cue is active must still let the Web fall back to the subtitle layer"
        );
        let plain = plan
            .subtitle_scene_frame(3.0)
            .expect("a cue with its motion removed must still enter the glyph scene");
        assert!(!plain.scene.nodes.is_empty());

        let mut slots = Vec::new();
        for time in [0.1, 1.0] {
            let scene = plan
                .compositor_scene_frame_with(time, SceneIdentity::Structural)
                .unwrap();
            let [element_draw::SceneNode::Texture(node)] = scene.nodes.as_slice() else {
                panic!("the subtitle layer of a motion frame must be one texture node: {:?}", scene.nodes.len())
            };
            assert!(node.texture.starts_with("subtitle-motion:"));
            assert_eq!(node.transform, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
            assert_eq!(
                (node.rect[2] as u32, node.rect[3] as u32),
                (node.source_width, node.source_height),
                "the texture must land 1:1 on an integer rectangle"
            );
            assert!(node.rect.iter().all(|value| value.fract() == 0.0));
            let next = scene.next_change.expect("a motion frame must declare the next frame boundary");
            assert!(next > time && next <= time + 1.0 / 30.0 + 1e-9, "{next}");
            let texture = plan
                .compositor_texture_frame(&node.texture, node.media_ms)
                .unwrap();
            let reference = plan.render_subtitle_frame(time).unwrap();
            assert_eq!(
                texture.data(),
                crop_rgba(&reference.rgba, 320, node.rect).as_slice(),
                "the texture must be byte-identical to the sub-rectangle of the CPU subtitle layer"
            );
            let [x, y, w, h] = node.rect.map(|value| value as usize);
            for (index, pixel) in reference.rgba.chunks_exact(4).enumerate() {
                let (px, py) = (index % 320, index / 320);
                if px < x || px >= x + w || py < y || py >= y + h {
                    assert_eq!(pixel[3], 0, "there must be no subtitle pixels outside the texture window ({px},{py})");
                }
            }
            slots.push(node.texture.clone());
        }
        assert_eq!(slots[0], slots[1], "subtitle motion texture slots must be stable across frames");

        let plain_scene = plan
            .compositor_scene_frame_with(3.0, SceneIdentity::Structural)
            .unwrap();
        assert!(!plain_scene.nodes.is_empty());
        assert!(
            plain_scene
                .nodes
                .iter()
                .all(|node| !matches!(node, element_draw::SceneNode::Texture(_))),
            "frames with no active motion cue use the glyph scene"
        );
    }

    /// A text element from 0–3 seconds, with only a 0.6-second `rise` entrance (no loop, no exit).
    #[cfg(feature = "host")]
    fn rise_title_plan() -> OverlayRenderPlan {
        let mut source = document("None", "none");
        source["cues"] = json!([]);
        source["timeline"] = json!({
            "tracks": [{"kind": "overlay", "elements": [{
                "id": "title", "kind": "text", "start": 0.0, "end": 3.0,
                "text": "Moving title",
                "place": {"x": 50, "y": 40},
                "style": {
                    "fontFamily": "Montserrat", "fontSize": 34, "fontColor": "#fefefe",
                    "textMotion": {"version": 1, "in": {"preset": "rise", "unit": "cue",
                        "durationSeconds": 0.6, "staggerSeconds": 0, "intensity": 0.8,
                        "easing": "easeOutQuad"}}
                }
            }]}]
        });
        let mut plan = OverlayRenderPlan::compile(&source, 320, 180, 3.0, 30.0, None).unwrap();
        plan.load_timeline_elements(
            std::path::Path::new("/nonexistent/cuccut-text-motion-element"),
            &source,
        )
        .unwrap();
        plan
    }

    /// After the entrance ends, the hold section is completely still: Structural identity is unchanged for the whole segment, and `next_change` points directly to the element's end (there is no exit). There is no per-frame re-rasterise or re-upload. It changes frame by frame during the entrance.
    #[test]
    #[cfg(feature = "host")]
    fn text_motion_elements_hold_one_identity_while_still() {
        let mut plan = rise_title_plan();
        let mut frame = |time: f64| {
            let scene = plan
                .compositor_scene_frame_with(time, SceneIdentity::Structural)
                .unwrap();
            let [element_draw::SceneNode::Texture(node)] = scene.nodes.as_slice() else {
                panic!("the text motion element must be one texture node")
            };
            let texture = plan
                .compositor_texture_frame(&node.texture, node.media_ms)
                .unwrap()
                .data()
                .to_vec();
            (scene.fingerprint, scene.next_change, texture)
        };
        let (moving_a, next_a, _) = frame(0.1);
        let (moving_b, _, _) = frame(0.3);
        assert_ne!(moving_a, moving_b, "during entrance, each frame has a different identity");
        assert!(next_a.is_some_and(|next| next <= 0.1 + 1.0 / 30.0 + 1e-9));
        let (still_a, next_still_a, pixels_a) = frame(1.0);
        let (still_b, next_still_b, pixels_b) = frame(2.0);
        assert_eq!(still_a, still_b, "the still segment has one Structural identity throughout");
        assert_eq!(pixels_a, pixels_b, "the same identity must really be the same image");
        for next in [next_still_a, next_still_b] {
            let next = next.expect("the still segment must still give the element end");
            assert!((next - 3.0).abs() < 1e-9, "the still segment jumps straight to end: {next}");
        }
    }

    /// `ccut element style --patch` can write `textMotion` into a text element. In the GPU scene this piece is likewise a CPU-rasterised texture at the element's position. Moving frames are rebuilt per frame, and still segments jump to the next boundary.
    #[cfg(feature = "host")]
    #[test]
    fn text_elements_with_text_motion_become_texture_nodes() {
        let mut plan = rise_title_plan();
        let mut pixels = Vec::new();
        for time in [0.1, 1.5] {
            let scene = plan
                .compositor_scene_frame_with(time, SceneIdentity::Full)
                .unwrap();
            let [element_draw::SceneNode::Texture(node)] = scene.nodes.as_slice() else {
                panic!("the text motion element must be one texture node")
            };
            assert_eq!(node.texture, "text-motion:title");
            let next = scene.next_change.expect("the text motion element must give the next boundary");
            if time < 0.6 {
                assert!(next > time && next <= time + 1.0 / 30.0 + 1e-9, "{next}");
            } else {
                assert!(
                    (next - 3.0).abs() < 1e-9,
                    "no exit after settling, jumps straight to end: {next}"
                );
            }
            let texture = plan
                .compositor_texture_frame(&node.texture, node.media_ms)
                .unwrap();
            let element = plan.elements[0].clone();
            let reference = plan.render_text_element(&element, time).unwrap();
            assert_eq!(
                texture.data(),
                crop_rgba(reference.data(), 320, node.rect).as_slice()
            );
            pixels.push(reference.data().to_vec());
        }
        assert_ne!(pixels[0], pixels[1], "during entrance and after settling there must be two images");
    }
}

pub fn draw_fit_pixmap(destination: &mut Pixmap, source: &Pixmap, fit: Fit, opacity: f32) {
    draw_fit_pixmap_at(destination, source, fit, opacity, 0.5);
}

/// Same as [`draw_fit_pixmap`], but the horizontal slack is distributed according to `anchor_x`: 0 sticks to the left, 0.5 centers, 1 sticks to the right. Vertically it is still centered (the `align` of the template logo layer).
pub fn draw_fit_pixmap_at(
    destination: &mut Pixmap,
    source: &Pixmap,
    fit: Fit,
    opacity: f32,
    anchor_x: f64,
) {
    let source_width = f64::from(source.width().max(1));
    let source_height = f64::from(source.height().max(1));
    let destination_width = f64::from(destination.width());
    let destination_height = f64::from(destination.height());
    let scale = match fit {
        Fit::Cover => (destination_width / source_width).max(destination_height / source_height),
        Fit::Contain => (destination_width / source_width).min(destination_height / source_height),
    };
    let width = source_width * scale;
    let height = source_height * scale;
    let transform = Transform::from_scale(scale as f32, scale as f32).post_translate(
        ((destination_width - width) * anchor_x) as f32,
        ((destination_height - height) / 2.0) as f32,
    );
    destination.draw_pixmap(
        0,
        0,
        source.as_ref(),
        &PixmapPaint {
            opacity,
            quality: FilterQuality::Bilinear,
            ..Default::default()
        },
        transform,
        None,
    );
}

/// Timeline 0.1 `fx {grayscale, blur, brightness}`.
///
/// The implementation has moved to `render_raster::effects` (the strict CPU reference for `filter.colorAdjust@1` + `filter.blur@1`). What remains here is turning the persisted fields into an effect stack and executing it. `reference_scale = canvas short edge / 540`, which is the reciprocal of the `canvasShortEdge` baseline in lowering. So the short edge passed to the effect is `reference_scale * 540`.
pub fn apply_media_effects(pixmap: &mut Pixmap, fx: Option<&Fx>, reference_scale: f64) {
    let Some(fx) = fx else {
        return;
    };
    let short_edge = reference_scale * timeline::REFERENCE_SHORT_EDGE;
    for lowered in timeline::lower_element_effects(Some(fx), None, None, None, false) {
        render_raster::effects::apply_filter_in_place(
            &lowered.effect,
            &lowered.uniforms,
            pixmap,
            short_edge,
        )
        .expect("built-in filter recipe must be executable");
    }
}

/// Brightens only (darkens the blurred background plate of a full-screen `fit: contain`).
pub fn adjust_brightness(data: &mut [u8], amount: f64) {
    render_raster::effects::filters::color_adjust::brightness_only(data, amount);
}

/// Premultiplied RGBA → straight alpha, in place.
///
/// The rounding rule borrows tiny-skia's `PremultipliedColorU8::demultiply()`. `render_png` goes through `Pixmap::encode_png`, which also uses it, so there is only one un-premultiply rule in the whole repo. A pixel whose channel is greater than its alpha is not a valid premultiplied value. It is left as is rather than guessed at.
pub fn demultiply_rgba_in_place(data: &mut [u8]) {
    for pixel in data.chunks_exact_mut(4) {
        let Some(premultiplied) =
            tiny_skia::PremultipliedColorU8::from_rgba(pixel[0], pixel[1], pixel[2], pixel[3])
        else {
            continue;
        };
        let straight = premultiplied.demultiply();
        pixel[0] = straight.red();
        pixel[1] = straight.green();
        pixel[2] = straight.blue();
        pixel[3] = straight.alpha();
    }
}

pub fn multiply_premultiplied_alpha(data: &mut [u8], opacity: f64) {
    render_raster::effects::multiply_premultiplied_alpha(data, opacity);
}

pub fn multiply_pixel_coverage(pixel: &mut [u8], coverage: f64) {
    render_raster::effects::multiply_pixel_coverage(pixel, coverage);
}

/// The left edge of one visual line within its own typesetting box. The CPU raster, the GPU retained scene, the backplate and animation hit-testing all go through this one place, so `textAlign` does not take effect in only one output backend.
pub fn line_start_x(layout: &LineLayout, line_width: f64, center_x: f64) -> f64 {
    let align_width = layout.align_width.max(line_width);
    let box_left = center_x - align_width / 2.0;
    match layout.text_align {
        LineTextAlign::Left => box_left,
        LineTextAlign::Center => center_x - line_width / 2.0,
        LineTextAlign::Right => box_left + align_width - line_width,
    }
}

/// SDF coverage mask for rounded rectangles and ellipses (the CPU reference for `mask.shape@1`).
///
/// Here `radius` and `feather` are already **canvas pixels** and go straight to the kernel. The uniform path through the manifest must first convert them to short-edge ratios (the value range of `mask.shape` is a ratio, and plugging in pixel values would be clamped to 0.5 by `resolve_uniforms`). The entry point with a basis is `render_media_element`, where `lower_element_effects` supplies the parameters.
pub fn apply_local_clip(pixmap: &mut Pixmap, radius: f64, ellipse: bool, feather: f64) {
    let (width, height) = (pixmap.width(), pixmap.height());
    render_raster::effects::filters::mask_shape::mask_shape(
        pixmap.data_mut(),
        width,
        height,
        radius,
        ellipse,
        feather,
    );
}

/// Whether the main picture layer is identically “one opaque pure-black base”: `place.opacity == 0` and the background is black.
///
/// When this holds, not a single pixel of the source picture reaches the output, and the result is independent of the source frame's content. `place` does not change over time, so this only needs to be judged once for a whole export. [`OverlayRenderPlan::base_frame_is_uniform_black`] gives it to the platform export loop and the compositor as the basis for short-circuiting the whole path.
///
/// This is the **only** copy of this criterion. The row-by-row black-fill fast path in [`apply_main_transform_bgra`] below also goes through it, so the two cannot drift.
pub fn main_transform_is_uniform_black(main: Option<&Main>) -> bool {
    let Some(main) = main else {
        return false;
    };
    let opacity = main
        .place
        .as_ref()
        .and_then(|place| place.opacity)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    opacity <= f64::EPSILON
        && matches!(
            main.background.unwrap_or(Background::Black),
            Background::Black
        )
}

/// When the main picture layer is a single opaque solid-colour base throughout, gives that colour (RGB). That is `opacity == 0` with a background that is black (the default) or `#RRGGBB` at 0.12. The black case is equally true for [`main_transform_is_uniform_black`]. A blurred base has to be computed for real, so it returns `None`.
pub fn main_transform_uniform_fill(main: Option<&Main>) -> Option<[u8; 3]> {
    let main = main?;
    let opacity = main
        .place
        .as_ref()
        .and_then(|place| place.opacity)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    if opacity > f64::EPSILON {
        return None;
    }
    main.background.unwrap_or(Background::Black).solid_rgb()
}

/// Horizontal progress wipe (the CPU reference for `mask.progress@1`).
pub fn apply_horizontal_reveal(pixmap: &mut Pixmap, reveal: f64) {
    let (width, height) = (pixmap.width(), pixmap.height());
    render_raster::effects::filters::reveal::horizontal_reveal(
        pixmap.data_mut(),
        width,
        height,
        reveal,
    );
}

pub use timeline::geometry::tile_stamp_points;

/// Shared admission rule for CPU passthrough and native GPU decoded textures.
pub fn main_transform_is_identity(main: Option<&Main>, width: u32, height: u32) -> bool {
    let Some(main) = main else {
        return true;
    };
    let place = main.place.as_ref();
    let x = f64::from(width) * place.and_then(|place| place.x).unwrap_or(50.0) / 100.0;
    let y = f64::from(height) * place.and_then(|place| place.y).unwrap_or(50.0) / 100.0;
    let scale_x = place.and_then(|place| place.scale).unwrap_or(1.0);
    let scale_y = place.and_then(|place| place.scale_y).unwrap_or(scale_x);
    let rotation = place.and_then(|place| place.rot).unwrap_or(0.0);
    let opacity = place
        .and_then(|place| place.opacity)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    (x - f64::from(width) / 2.0).abs() <= 1e-9
        && (y - f64::from(height) / 2.0).abs() <= 1e-9
        && (scale_x - 1.0).abs() <= 1e-9
        && (scale_y - 1.0).abs() <= 1e-9
        && rotation.abs() <= 1e-9
        && (opacity - 1.0).abs() <= 1e-9
}

pub fn apply_main_transform_bgra(
    pixels: &mut [u8],
    stride: usize,
    width: u32,
    height: u32,
    main: Option<&Main>,
) -> Result<()> {
    let Some(main) = main else {
        return Ok(());
    };
    let width_usize = width as usize;
    let height_usize = height as usize;
    if pixels.len() < stride.saturating_mul(height_usize) || stride < width_usize * 4 {
        bail!("main picture BGRA buffer size is invalid");
    }
    if main_transform_is_identity(Some(main), width, height) {
        return Ok(());
    }
    let place = main.place.as_ref();
    let x = f64::from(width) * place.and_then(|place| place.x).unwrap_or(50.0) / 100.0;
    let y = f64::from(height) * place.and_then(|place| place.y).unwrap_or(50.0) / 100.0;
    let scale_x = place.and_then(|place| place.scale).unwrap_or(1.0);
    let scale_y = place.and_then(|place| place.scale_y).unwrap_or(scale_x);
    let rotation = place.and_then(|place| place.rot).unwrap_or(0.0);
    let opacity = place
        .and_then(|place| place.opacity)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);

    // `opacity == 0`: not a single pixel of the source picture reaches the output, so the result is **determined entirely by background**.
    //
    // This is not a rare branch. After media is "elementized" and moved onto the timeline (`main.detached`), the main layer is hidden precisely through `place.opacity = 0`, and the picture is drawn instead by timeline elements through the compositor. In other words, **every frame** of an ordinary project export passes through here.
    //
    // Taking the path below, each frame would need two width×height×4 heap allocations, one per-pixel BGRA→RGBA swizzle pass, one `draw_pixmap` (at opacity 0, drawing it is the same as not drawing it), and another per-pixel swizzle pass to write back. Measured on 1799 frames of 720p, that is **249 ms per frame**, which is 69% of the whole "subtitle compositing" stage, all spent producing a pure black base. The black-base tier can simply fill row by row.
    //
    // The blurred-base tier still has to be computed for real. Its content is a blurred copy of the source picture, so it cannot be skipped. But the `draw_pixmap` that is necessarily a no-op can be omitted (see the `opacity > 0` check below).
    if let Some([r, g, b]) = main_transform_uniform_fill(Some(main)) {
        // A solid-colour base (black, or `#RRGGBB` at 0.12) uses the same row-fill fast path. The buffer is BGRA.
        for row in 0..height_usize {
            let target = &mut pixels[row * stride..row * stride + width_usize * 4];
            for pixel in target.chunks_exact_mut(4) {
                pixel.copy_from_slice(&[b, g, r, 255]);
            }
        }
        return Ok(());
    }

    let mut source_rgba = vec![0_u8; width_usize * height_usize * 4];
    for row in 0..height_usize {
        let input = &pixels[row * stride..row * stride + width_usize * 4];
        let output = &mut source_rgba[row * width_usize * 4..(row + 1) * width_usize * 4];
        for column in 0..width_usize {
            output[column * 4] = input[column * 4 + 2];
            output[column * 4 + 1] = input[column * 4 + 1];
            output[column * 4 + 2] = input[column * 4];
            output[column * 4 + 3] = 255;
        }
    }
    let source = Pixmap::from_vec(
        source_rgba,
        IntSize::from_wh(width, height).context("invalid main picture size")?,
    )
    .context("invalid main picture RGBA size")?;
    let mut destination = Pixmap::new(width, height).context("could not create main picture transform layer")?;
    match main.background.unwrap_or(Background::Black) {
        Background::Black => destination.fill(tiny_skia::Color::BLACK),
        Background::Color([r, g, b]) => {
            destination.fill(tiny_skia::Color::from_rgba8(r, g, b, 255));
        }
        Background::Blur => {
            destination.data_mut().copy_from_slice(source.data());
            box_blur_rgba(
                destination.data_mut(),
                width,
                height,
                ((width.min(height) as f64) * 0.025).round().max(1.0) as usize,
            );
        }
    }
    let transform = Transform::from_translate(-(width as f32) / 2.0, -(height as f32) / 2.0)
        .post_scale(scale_x as f32, scale_y as f32)
        .post_rotate(rotation as f32)
        .post_translate(x as f32, y as f32);
    // At opacity 0 this stroke is an identity operation (SourceOver of a source with 0 opacity). The black-base tier above is already short-circuited entirely. This guards the blurred-base tier, saving one full-frame blit with bilinear sampling at 1080p.
    if opacity > f64::EPSILON {
        destination.draw_pixmap(
            0,
            0,
            source.as_ref(),
            &PixmapPaint {
                opacity: opacity as f32,
                quality: FilterQuality::Bilinear,
                blend_mode: tiny_skia::BlendMode::SourceOver,
            },
            transform,
            None,
        );
    }
    for row in 0..height_usize {
        let input = &destination.data()[row * width_usize * 4..(row + 1) * width_usize * 4];
        let output = &mut pixels[row * stride..row * stride + width_usize * 4];
        for column in 0..width_usize {
            output[column * 4] = input[column * 4 + 2];
            output[column * 4 + 1] = input[column * 4 + 1];
            output[column * 4 + 2] = input[column * 4];
            output[column * 4 + 3] = 255;
        }
    }
    Ok(())
}

/// Typesetting shared by text elements and subtitles: greedy line breaking at Unicode word boundaries.
pub fn layout_text(
    text_engine: &mut TextEngine,
    item: &TimedItem,
    style: &LineStyle,
    wrap_width: f64,
    part_ranges: Option<&[Range<usize>]>,
) -> (Vec<LayoutLine>, f64) {
    layout_text_with(text_engine, item, style, wrap_width, part_ranges, false)
}

/// Subtitle line typesetting. It uses the same segmentation and glyphs as [`layout_text`], except that lines containing CJK text no longer fill greedily. Break points are chosen by [`cjk_line_breaks`] instead (no more lines than greedy, preferring positions by kinsoku rules, numbers joined to their units, and punctuation or spaces, while balancing the lines). Lines without CJK text are byte-for-byte identical to [`layout_text`].
pub fn layout_subtitle_text(
    text_engine: &mut TextEngine,
    item: &TimedItem,
    style: &LineStyle,
    wrap_width: f64,
) -> (Vec<LayoutLine>, f64) {
    layout_text_with(text_engine, item, style, wrap_width, None, true)
}

enum LayoutToken {
    HardBreak,
    Space(GlyphChunk),
    Glyph(String, GlyphChunk),
}

fn layout_text_with(
    text_engine: &mut TextEngine,
    item: &TimedItem,
    style: &LineStyle,
    wrap_width: f64,
    part_ranges: Option<&[Range<usize>]>,
    balance_cjk: bool,
) -> (Vec<LayoutLine>, f64) {
    let mut tokens = Vec::new();
    for run in timed_runs(&item.text, &item.words, &style.text_transform) {
        // `emphasisLook`: emphasized words switch font family, weight and italic, and scale the font size by `scale`. The width changes together with shaping, so neighbouring words do not overlap. Non-emphasized words keep the line style and stay bit-for-bit unchanged.
        let variant = run
            .word
            .and_then(|index| item.words.get(index))
            .and_then(|word| style.emphasis.as_deref()?.variant(&word.id));
        let scale = variant.as_ref().map_or(1.0, |variant| variant.scale);
        let font_name = variant
            .as_ref()
            .and_then(|variant| variant.font_name)
            .unwrap_or(&style.font_name);
        let font_size = if variant.is_some() {
            style.font_size * scale
        } else {
            style.font_size
        };
        // Letter spacing does not scale with emphasis. The drawing side places each glyph according to the line style's `letter_spacing`.
        let letter_spacing = style.letter_spacing;
        let weight = match variant.as_ref().and_then(|variant| variant.bold) {
            Some(true) => style.font_weight.max(700),
            Some(false) if style.font_weight >= 700 => 400,
            _ => style.font_weight,
        };
        let italic = variant
            .as_ref()
            .and_then(|variant| variant.italic)
            .unwrap_or(style.italic);
        let shaped_italic = style.shaped_italic && italic;
        let color = variant.as_ref().and_then(|variant| variant.color);
        // A time span is not necessarily an unbreakable word. A translated track may put a whole sentence in one timed run.
        // First typeset at Unicode word boundaries. Overlong words fall back to grapheme clusters. Each piece keeps its original word and byte offset, so per-word animation and piece highlighting still reference the original time span.
        let mut pieces = Vec::new();
        let run_width = text_engine
            .shape_styled(&run.text, font_name, font_size, weight, shaped_italic)
            .width
            + letter_spacing * run.text.graphemes(true).count().saturating_sub(1) as f64;
        let boundaries = if run.word.is_some()
            && run_width <= wrap_width
            && !run.text.contains(['\n', '\r'])
            && !(style.text_motion.is_some() && run.text.chars().any(char::is_whitespace))
        {
            // Normal-length timed words keep whole-word shaping (ligatures, letter spacing and animation geometry unchanged).
            vec![(0, run.text.as_str())]
        } else if run.word.is_none() && part_ranges.is_some() {
            // Untimed pieces of a text element may fall inside a word, and keep the original per-glyph part mapping.
            run.text.grapheme_indices(true).collect::<Vec<_>>()
        } else {
            run.text.split_word_bound_indices().collect::<Vec<_>>()
        };
        for (offset, piece) in boundaries {
            let shaped =
                text_engine.shape_styled(piece, font_name, font_size, weight, shaped_italic);
            let width = shaped.width
                + letter_spacing * piece.graphemes(true).count().saturating_sub(1) as f64;
            if width > wrap_width {
                pieces.extend(
                    piece
                        .grapheme_indices(true)
                        .map(|(at, grapheme)| (grapheme.to_owned(), run.start + offset + at)),
                );
            } else {
                pieces.push((piece.to_owned(), run.start + offset));
            }
        }
        for (piece, offset) in pieces {
            if piece == "\n" || piece == "\r\n" || piece == "\r" {
                tokens.push(LayoutToken::HardBreak);
                continue;
            }
            let shaped =
                text_engine.shape_styled(&piece, font_name, font_size, weight, shaped_italic);
            let width = shaped.width
                + letter_spacing * piece.graphemes(true).count().saturating_sub(1) as f64;
            let chunk = GlyphChunk {
                text: piece.clone(),
                word: run.word,
                part: part_ranges
                    .and_then(|ranges| ranges.iter().position(|range| range.contains(&offset))),
                width,
                font_name: font_name.to_owned(),
                font_size,
                font_weight: weight,
                italic: italic && !shaped_italic,
                shaped,
                color,
                metric_scale: scale,
            };
            if piece.trim().is_empty() {
                tokens.push(LayoutToken::Space(chunk));
            } else {
                tokens.push(LayoutToken::Glyph(piece, chunk));
            }
        }
    }
    let breaks = (balance_cjk && item.text.chars().any(is_cjk_char))
        .then(|| cjk_line_breaks(&tokens, wrap_width, style.font_size));
    let mut lines = vec![LayoutLine::default()];
    let mut spaces: Vec<GlyphChunk> = Vec::new();
    for (index, token) in tokens.into_iter().enumerate() {
        let chunk = match token {
            LayoutToken::HardBreak => {
                spaces.clear();
                lines.push(LayoutLine::default());
                continue;
            }
            LayoutToken::Space(chunk) => {
                if lines.last().expect("layout line").width > 0.0 {
                    spaces.push(chunk);
                }
                continue;
            }
            LayoutToken::Glyph(_, chunk) => chunk,
        };
        let spaces_width = spaces.iter().map(|chunk| chunk.width).sum::<f64>();
        let line = lines.last().expect("layout line");
        let wrap = match &breaks {
            Some(breaks) => breaks.contains(&index),
            None => line.width > 0.0 && line.width + spaces_width + chunk.width > wrap_width,
        };
        if wrap {
            spaces.clear();
            lines.push(LayoutLine::default());
        }
        let line = lines.last_mut().expect("layout line");
        // Leading and trailing whitespace does not take part in width or alignment. Whitespace between words still keeps its time and glyph information.
        for space in spaces.drain(..) {
            line.width += space.width;
            line.chunks.push(space);
        }
        line.width += chunk.width;
        line.chunks.push(chunk);
    }
    lines.retain(|line| !line.chunks.is_empty());
    if lines.is_empty() {
        lines.push(LayoutLine::default());
    }
    for line in &mut lines {
        line.height = style.font_size * style.line_height;
    }
    let width = lines.iter().map(|line| line.width).fold(0.0, f64::max);
    (lines, width)
}

/// CJK text (Han characters, kana, full-width punctuation). Hangul is split into words by spaces and goes through the original greedy line breaking.
fn is_cjk_char(c: char) -> bool {
    matches!(c,
        '\u{3000}'..='\u{303F}'
            | '\u{3040}'..='\u{30FF}'
            | '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{F900}'..='\u{FAFF}'
            | '\u{FF00}'..='\u{FFEF}'
            | '\u{20000}'..='\u{2FA1F}')
}

fn is_han(c: char) -> bool {
    matches!(c,
        '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{F900}'..='\u{FAFF}'
            | '\u{20000}'..='\u{2FA1F}')
}

/// Characters that must not start a line (kinsoku): sentence punctuation, closing brackets, closing quotes, ellipses and dashes, percent sign, small kana.
fn cannot_start_line(c: char) -> bool {
    "，。、；：？！）］｝」』】〉》〕…‥—・ー％‰℃,.;:?!)]}%”’".contains(c)
        || "ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々ゝゞヽヾ".contains(c)
}

/// Characters that must not end a line: opening brackets and opening quotes.
fn cannot_end_line(c: char) -> bool {
    "（［｛「『【〈《〔“‘([{".contains(c)
}

/// A natural pause: breaking after this character is natural.
fn is_pause_punct(c: char) -> bool {
    "，。、；：？！…）」』,.;:?!)".contains(c)
}

/// How a subtitle containing CJK text is wrapped. Returns the index of the token from which a new line starts.
///
/// Greedily filling every line breaks words at line ends (利/益, 10/亿), pushes “？：、” to the start of a line, and leaves a lone character on the last line. Here the break point is chosen with the fewest lines (hanging punctuation can sometimes save one line over greedy). Costs run from heavy to light:
///
/// 1. Number of lines (1e9 each). Do not add a line just to look nicer.
/// 2. Kinsoku, numbers split from their following measure word or unit (10亿, 10 亿, 1870年代), and adjacent Latin runs (GPT-4) being split, along with a line consisting of a single character (1e6 each).
/// 3. The sum of squared blank space across the lines. Line widths should be as equal as possible.
/// 4. Breaking at a space (the gap left by hidden punctuation, or between Chinese and English) or after a pause punctuation mark gets a bonus of `8 × font size²`. This roughly trades for an imbalance of up to two characters.
///
/// Sentence punctuation at the end of a line may hang outside the line width (1e5 each). It is used only when not hanging would force it to the start of the next line. In that case the returned line width may exceed `wrap_width` by one punctuation mark.
///
/// Chinese has no word segmenter, so breaking inside a word (利/益) can only be avoided indirectly, through balancing and punctuation priority. This is not guaranteed.
fn cjk_line_breaks(tokens: &[LayoutToken], wrap_width: f64, font_size: f64) -> Vec<usize> {
    struct Item<'a> {
        token: usize,
        text: &'a str,
        width: f64,
        gap: f64,
    }
    let mut breaks = Vec::new();
    let mut paragraph: Vec<Item> = Vec::new();
    let mut gap = 0.0;
    let flush = |paragraph: &mut Vec<Item>, breaks: &mut Vec<usize>| {
        let n = paragraph.len();
        if n < 2 {
            paragraph.clear();
            return;
        }
        let mut prefix_width = vec![0.0; n + 1];
        let mut prefix_gap = vec![0.0; n + 1];
        for (j, item) in paragraph.iter().enumerate() {
            prefix_width[j + 1] = prefix_width[j] + item.width;
            prefix_gap[j + 1] = prefix_gap[j] + item.gap;
        }
        let line_width = |a: usize, b: usize| {
            prefix_width[b + 1] - prefix_width[a] + prefix_gap[b + 1] - prefix_gap[a + 1]
        };
        if line_width(0, n - 1) <= wrap_width + 1e-6 {
            paragraph.clear();
            return;
        }
        let bonus = 8.0 * font_size * font_size;
        let break_cost = |a: usize| {
            let prev = &paragraph[a - 1];
            let next = &paragraph[a];
            let prev_last = prev.text.chars().next_back().unwrap_or(' ');
            let next_first = next.text.chars().next().unwrap_or(' ');
            let joined = next.gap <= 0.0;
            // A number followed by a unit is not affected by whether there is a space between them. Translations often write “10 亿”, and that space is not a pause.
            let forbidden = cannot_start_line(next_first)
                || cannot_end_line(prev_last)
                || (prev_last.is_ascii_digit() && is_han(next_first))
                || (joined && prev_last.is_ascii_graphic() && next_first.is_ascii_graphic());
            let mut cost = if forbidden { 1e6 } else { 0.0 };
            if !joined || is_pause_punct(prev_last) {
                cost -= bonus;
            }
            cost
        };
        let mut best = vec![f64::INFINITY; n + 1];
        let mut from = vec![0usize; n + 1];
        best[0] = 0.0;
        for end in 1..=n {
            // Punctuation hanging: sentence punctuation at the end of a line may protrude beyond the line width, so that it is not pushed to the start of the next line.
            let last = &paragraph[end - 1];
            let hang = if last
                .text
                .chars()
                .all(|c| "，。、；：？！,.;:?!".contains(c))
            {
                last.width
            } else {
                0.0
            };
            for start in (0..end).rev() {
                let width = line_width(start, end - 1);
                if width - hang > wrap_width + 1e-6 && start + 1 < end {
                    break;
                }
                if !best[start].is_finite() {
                    continue;
                }
                let single = paragraph[start..end]
                    .iter()
                    .map(|item| item.text.graphemes(true).count())
                    .sum::<usize>()
                    == 1;
                let mut cost = best[start] + 1e9 + (wrap_width - width).max(0.0).powi(2);
                if width > wrap_width + 1e-6 && start + 1 < end {
                    cost += 1e5;
                }
                if start > 0 {
                    cost += break_cost(start);
                }
                if single {
                    cost += 1e6;
                }
                if cost < best[end] {
                    best[end] = cost;
                    from[end] = start;
                }
            }
        }
        let mut at = n;
        let mut starts = Vec::new();
        while at > 0 {
            let start = from[at];
            if start > 0 {
                starts.push(paragraph[start].token);
            }
            at = start;
        }
        breaks.extend(starts.into_iter().rev());
        paragraph.clear();
    };
    for (index, token) in tokens.iter().enumerate() {
        match token {
            LayoutToken::HardBreak => {
                flush(&mut paragraph, &mut breaks);
                gap = 0.0;
            }
            LayoutToken::Space(chunk) => {
                if !paragraph.is_empty() {
                    gap += chunk.width;
                }
            }
            LayoutToken::Glyph(text, chunk) => {
                paragraph.push(Item {
                    token: index,
                    text,
                    width: chunk.width,
                    gap,
                });
                gap = 0.0;
            }
        }
    }
    flush(&mut paragraph, &mut breaks);
    breaks
}

pub fn layout_lines_height(lines: &[LayoutLine]) -> f64 {
    lines.iter().map(|line| line.height + line.gap_after).sum()
}

#[derive(Clone)]
pub struct CaptionFontSpec {
    pub name: String,
    pub size: f64,
    pub weight: u16,
    pub italic: bool,
}

pub fn caption_manifest_font(
    text_engine: &TextEngine,
    descriptor: &CaptionRecipeDescriptor,
    role: &str,
    style: &LineStyle,
    size: f64,
    italic: bool,
) -> CaptionFontSpec {
    let manifest = descriptor
        .fonts
        .iter()
        .find(|font| font.role == role)
        .or_else(|| descriptor.fonts.first());
    let mut name = None;
    let mut weight = if style.bold { 700 } else { 400 };
    if let Some(manifest) = manifest {
        let candidates = std::iter::once(manifest.family.as_str()).chain(
            (manifest.substitution != "strict")
                .then_some(manifest.fallback.iter().map(String::as_str))
                .into_iter()
                .flatten(),
        );
        name = candidates
            .into_iter()
            .find(|candidate| text_engine.has_family(candidate))
            .map(str::to_owned);
        if name.is_some() {
            // `NSFont(name:size:)` selects the named family's default face;
            // descriptor weights only choose the generic system fallback.
            weight = 400;
        } else if manifest.substitution != "strict" {
            weight = if manifest.weights.iter().copied().max().unwrap_or(600) >= 700 {
                700
            } else {
                400
            };
        }
    }
    let name = name.unwrap_or_else(|| {
        if manifest.is_some_and(|manifest| manifest.substitution == "strict") {
            style.font_name.clone()
        } else {
            // Mac falls back to its system font only after exhausting the
            // descriptor chain. An empty family asks TextEngine for the same
            // generic system sans; mono manifests normally resolve Menlo first.
            String::new()
        }
    });
    CaptionFontSpec {
        name,
        size,
        weight,
        italic,
    }
}

pub fn caption_base_font_role(descriptor: &CaptionRecipeDescriptor) -> &'static str {
    if descriptor.layers.iter().any(|layer| layer == "scanlines")
        || descriptor.events.iter().any(|event| event.op == "textSwap")
    {
        "mono"
    } else if descriptor.layout == "fullScreenWord" {
        "sansHeavy"
    } else {
        "sans"
    }
}

#[allow(clippy::too_many_arguments)]
pub fn caption_word_font(
    text_engine: &mut TextEngine,
    descriptor: &CaptionRecipeDescriptor,
    token: Option<&CaptionRecipeLayoutToken>,
    role: &str,
    text: &str,
    style: &LineStyle,
    wrap_width: f64,
    frame_height: u32,
    canvas_scale: f64,
) -> CaptionFontSpec {
    let emphasized = matches!(role, "emphasis" | "hero");
    let (font_role, mut scale, italic) = match descriptor.layout.as_str() {
        "fullScreenWord" => {
            let count = text.chars().count().max(1) as f64;
            (
                "sansHeavy",
                (2.5 - (count * 0.17).min(1.2)).max(1.15),
                false,
            )
        }
        "dualBand" => (
            if emphasized { "sansHeavy" } else { "sans" },
            if emphasized { 1.35 } else { 0.82 },
            false,
        ),
        "editorialBlock" => (
            if emphasized { "editorialSerif" } else { "sans" },
            if role == "hero" {
                1.42
            } else if emphasized {
                1.24
            } else {
                0.94
            },
            emphasized,
        ),
        "centerBand" => (
            if emphasized { "sansHeavy" } else { "sans" },
            if emphasized { 1.18 } else { 1.0 },
            false,
        ),
        _ => (
            if emphasized {
                "sansHeavy"
            } else {
                caption_base_font_role(descriptor)
            },
            1.0,
            false,
        ),
    };
    scale *= token.map_or(1.0, |token| token.font_scale);
    let proposed = style.font_size * scale;
    let mut spec = caption_manifest_font(
        text_engine,
        descriptor,
        font_role,
        style,
        proposed,
        italic || style.italic,
    );
    if descriptor.layout == "fullScreenWord" {
        let minimum = token
            .map_or(24.0, |token| token.min_font_size)
            .mul_add(canvas_scale, 0.0)
            .max(8.0);
        let max_height = f64::from(frame_height) * token.map_or(0.46, |token| token.max_height);
        let max_height = max_height.max(style.font_size);
        let max_width = (wrap_width - style.background_pad_h * 2.0).max(10.0);
        let fits = |engine: &mut TextEngine, size: f64, spec: &CaptionFontSpec| {
            let shaped = engine.shape(text, &spec.name, size, spec.weight);
            shaped.width <= max_width && shaped.ascent + shaped.descent <= max_height
        };
        let mut low = minimum.min(proposed);
        let mut high = minimum.max(proposed);
        if fits(text_engine, high, &spec) {
            spec.size = high;
        } else {
            for _ in 0..16 {
                let middle = (low + high) / 2.0;
                if fits(text_engine, middle, &spec) {
                    low = middle;
                } else {
                    high = middle;
                }
            }
            spec.size = low;
        }
    }
    if descriptor.layout == "editorialBlock" && emphasized {
        spec.weight = 700;
    }
    spec
}

pub fn caption_recipe_bands(
    design: &DesignedCaption,
    descriptor: &CaptionRecipeDescriptor,
    item: &TimedItem,
    time: f64,
    fps: f64,
) -> Vec<Vec<usize>> {
    let roles = caption_recipe_roles(design, item, descriptor);
    let group_indices = caption_recipe_group_indices(&item.words, descriptor.grouping.as_ref());
    if !caption_recipe_owns_layout(descriptor, item) {
        return vec![(0..item.words.len()).collect()];
    }
    let Some(group) = caption_recipe_visible_group(design, item, time, fps) else {
        return Vec::new();
    };
    let members = group_indices
        .iter()
        .enumerate()
        .filter_map(|(index, group_index)| (*group_index == group.index).then_some(index))
        .collect::<Vec<_>>();
    match descriptor.layout.as_str() {
        "fullScreenWord" => members.into_iter().map(|index| vec![index]).collect(),
        "dualBand" | "editorialBlock" => {
            let (marked, ordinary): (Vec<_>, Vec<_>) = members
                .into_iter()
                .partition(|index| matches!(roles[*index].as_str(), "emphasis" | "hero"));
            let bands = if descriptor.layout == "dualBand" {
                vec![marked, ordinary]
            } else {
                vec![ordinary, marked]
            };
            bands.into_iter().filter(|band| !band.is_empty()).collect()
        }
        _ => vec![members],
    }
}

#[allow(clippy::too_many_arguments)]
pub fn layout_inline_caption_text(
    text_engine: &mut TextEngine,
    item: &TimedItem,
    style: &LineStyle,
    descriptor: &CaptionRecipeDescriptor,
    token: Option<&CaptionRecipeLayoutToken>,
    roles: &[String],
    base_font: &CaptionFontSpec,
    wrap_width: f64,
    frame_height: u32,
    canvas_scale: f64,
) -> (Vec<LayoutLine>, f64) {
    let mut lines = vec![LayoutLine::default()];
    for run in timed_runs(&item.text, &item.words, &style.text_transform) {
        let pieces = if run.word.is_some() {
            vec![(run.text, run.start)]
        } else {
            run.text
                .grapheme_indices(true)
                .map(|(offset, grapheme)| (grapheme.to_owned(), run.start + offset))
                .collect()
        };
        for (piece, _) in pieces {
            if piece == "\n" {
                lines.push(LayoutLine::default());
                continue;
            }
            let spec = run.word.map_or_else(
                || base_font.clone(),
                |index| {
                    caption_word_font(
                        text_engine,
                        descriptor,
                        token,
                        &roles[index],
                        &piece,
                        style,
                        wrap_width,
                        frame_height,
                        canvas_scale,
                    )
                },
            );
            let shaped = text_engine.shape(&piece, &spec.name, spec.size, spec.weight);
            let width = shaped.width
                + style.letter_spacing * piece.graphemes(true).count().saturating_sub(1) as f64;
            let line = lines.last_mut().expect("inline caption line");
            if line.width > 0.0 && line.width + width > wrap_width && !piece.trim().is_empty() {
                lines.push(LayoutLine::default());
            }
            let line = lines.last_mut().expect("inline caption line");
            if line.width == 0.0 && piece.trim().is_empty() {
                continue;
            }
            line.width += width;
            line.height = line.height.max(spec.size * style.line_height);
            line.chunks.push(GlyphChunk {
                text: piece.clone(),
                word: run.word,
                part: None,
                width,
                font_name: spec.name,
                font_size: spec.size,
                font_weight: spec.weight,
                italic: spec.italic,
                shaped,
                color: None,
                metric_scale: 1.0,
            });
        }
    }
    lines.retain(|line| !line.chunks.is_empty());
    if lines.is_empty() {
        lines.push(LayoutLine {
            height: style.font_size * style.line_height,
            ..LayoutLine::default()
        });
    }
    let width = lines.iter().map(|line| line.width).fold(0.0, f64::max);
    (lines, width)
}

#[allow(clippy::too_many_arguments)]
pub fn layout_caption_text(
    text_engine: &mut TextEngine,
    item: &TimedItem,
    style: &LineStyle,
    design: &DesignedCaption,
    descriptor: &CaptionRecipeDescriptor,
    wrap_width: f64,
    time: f64,
    fps: f64,
    frame_width: u32,
    frame_height: u32,
    canvas_scale: f64,
) -> (Vec<LayoutLine>, f64) {
    let token = caption_recipe_layout_token(descriptor, frame_width, frame_height);
    let roles = caption_recipe_roles(design, item, descriptor);
    let bands = caption_recipe_bands(design, descriptor, item, time, fps);
    let base_font = caption_manifest_font(
        text_engine,
        descriptor,
        caption_base_font_role(descriptor),
        style,
        style.font_size,
        style.italic,
    );
    if !caption_recipe_owns_layout(descriptor, item) {
        return layout_inline_caption_text(
            text_engine,
            item,
            style,
            descriptor,
            token,
            &roles,
            &base_font,
            wrap_width,
            frame_height,
            canvas_scale,
        );
    }
    let band_gap = token.map_or(0.0, |token| token.band_gap * canvas_scale);
    let mut lines = Vec::<LayoutLine>::new();
    for (band_index, band) in bands.iter().enumerate() {
        if band.is_empty() {
            continue;
        }
        lines.push(LayoutLine::default());
        for (position, word_index) in band.iter().copied().enumerate() {
            let text = transform_text(&item.words[word_index].text, &style.text_transform);
            let spec = caption_word_font(
                text_engine,
                descriptor,
                token,
                &roles[word_index],
                &text,
                style,
                wrap_width,
                frame_height,
                canvas_scale,
            );
            let shaped = text_engine.shape(&text, &spec.name, spec.size, spec.weight);
            let width = shaped.width
                + style.letter_spacing * text.graphemes(true).count().saturating_sub(1) as f64;
            let space = (position > 0).then(|| {
                let shaped =
                    text_engine.shape(" ", &base_font.name, base_font.size, base_font.weight);
                let width = shaped.width;
                GlyphChunk {
                    text: " ".into(),
                    word: None,
                    part: None,
                    width,
                    font_name: base_font.name.clone(),
                    font_size: base_font.size,
                    font_weight: base_font.weight,
                    italic: base_font.italic,
                    shaped,
                    color: None,
                    metric_scale: 1.0,
                }
            });
            let incoming = width + space.as_ref().map_or(0.0, |chunk| chunk.width);
            let current = lines.last_mut().expect("caption band line");
            if current.width > 0.0 && current.width + incoming > wrap_width {
                lines.push(LayoutLine::default());
            } else if let Some(space) = space {
                let current = lines.last_mut().expect("caption band line");
                current.width += space.width;
                current.height = current.height.max(base_font.size * style.line_height);
                current.chunks.push(space);
            }
            let current = lines.last_mut().expect("caption band line");
            current.width += width;
            current.height = current.height.max(spec.size * style.line_height);
            current.chunks.push(GlyphChunk {
                text: text.clone(),
                word: Some(word_index),
                part: None,
                width,
                font_name: spec.name,
                font_size: spec.size,
                font_weight: spec.weight,
                italic: spec.italic,
                shaped,
                color: None,
                metric_scale: 1.0,
            });
        }
        if band_index + 1 < bands.len()
            && let Some(last) = lines.last_mut()
        {
            last.gap_after = band_gap;
        }
    }
    if lines.is_empty() {
        lines.push(LayoutLine {
            height: style.font_size * style.line_height,
            ..LayoutLine::default()
        });
    }
    let width = lines.iter().map(|line| line.width).fold(0.0, f64::max);
    (lines, width)
}

/// All the geometric inputs needed to place one line.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LineBox {
    /// Actual content height after wrapping (`number of lines × font_size × line_height`).
    pub height: f64,
    /// Reference height of one line (`font_size × line_height`, not counting wrapping). This is the source of the slot height.
    pub reference: f64,
    /// The line's own vertical padding (`pad_h / PLATE_PAD_ASPECT`).
    ///
    /// In per-line backplate mode it stretches this line's slot and actual box. In shared-backplate mode the line box stays as bare glyphs, and [`StackPlate::Shared`] wraps one padding ring around the whole stack.
    pub pad_v: f64,
    /// Per-line position override: `(x%, y%)` is the frame percentage of the centre of this line's text block.
    pub over: Option<(f64, f64)>,
    /// Per-line vertical anchor. When absent, it is filled in by the seam rule (inside a stack) or by center (for a detached line).
    pub align: Option<VerticalAlign>,
}

impl LineBox {
    /// Slot height: when the stack has two or more lines, the reference height is used. Otherwise the actual height is used. When `padded`, `2 × pad_v` is added to each.
    ///
    /// Two or more lines must use the reference height for the seam to hold. A wrapped upper line can only grow upward, and it must not push the lower line away. With only one line there is no seam to hold, so the slot falls back to the actual height. The old meaning, “block centred on the anchor”, then holds. Otherwise a single-language wrapped subtitle would shift as a whole by `font_size × line_height / 2`.
    ///
    /// Equivalent to Mac `PreparedContent.slotHeight(padded:padV:)`. When `padded`, the slot measures the box including the backplate padding, so the gap between per-line backplates is the visual gap.
    pub fn slot(&self, stacked: usize, padded: bool) -> f64 {
        let bare = if stacked >= 2 {
            self.reference
        } else {
            self.height
        };
        bare + if padded { self.pad_v * 2.0 } else { 0.0 }
    }
}

/// The backplate form of the stack. It decides whether the padding is recorded on each line or around the whole stack.
///
/// Mirrors the `mode` of Mac `prepareStack`. It looks only at `backgroundMode` and the number of stack lines, **not** at whether the background is on. A shared stack with the backplate switched off is still laid out with shared slots. Otherwise the same document would be misaligned at the two ends.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StackPlate {
    /// Per-line backplate: each line's slot and actual box include its own `pad_v`, and the seam falls between two backplates.
    Separate,
    /// Shared backplate: slots keep bare glyphs and the seams stay between glyphs. One board padding ring wraps the whole stack from the outside.
    Shared { pad_v: f64 },
}

impl StackPlate {
    /// Whether the line box carries its own padding.
    pub fn padded(self) -> bool {
        matches!(self, Self::Separate)
    }

    /// Vertical board padding around the whole stack (Mac's `platePadV`).
    pub fn plate_pad_v(self) -> f64 {
        match self {
            Self::Separate => 0.0,
            Self::Shared { pad_v } => pad_v,
        }
    }
}

/// The number of lines taking part in the anchored stack, and their total height (including the gap between lines and the backplate padding).
///
/// Lines outside the stack (those with a per-line position override) are not counted. The stack is centred only on the remaining lines. When one line remains, the result is that line centred on the anchor, which matches the arithmetic of a document that only had one line exactly.
///
/// `total_height` is the box that block-level `verticalAlign` pins. It is equivalent to Mac's `slotBoxHeight = platePadV × 2 + Σ slot + gap × (n - 1)`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StackExtent {
    pub count: usize,
    pub total_height: f64,
}

pub fn stacked_extent(lines: &[LineBox], gap: f64, plate: StackPlate) -> StackExtent {
    let count = lines.iter().filter(|line| line.over.is_none()).count();
    let total_height = lines
        .iter()
        .filter(|line| line.over.is_none())
        .map(|line| line.slot(count, plate.padded()))
        .sum::<f64>()
        + gap * count.saturating_sub(1) as f64
        + plate.plate_pad_v() * 2.0;
    StackExtent {
        count,
        total_height,
    }
}

/// Within the slot, places `height`-tall content onto `[slot_top, slot_top + slot]`, and returns its top edge.
pub fn align_within(slot_top: f64, slot: f64, height: f64, align: VerticalAlign) -> f64 {
    match align {
        VerticalAlign::Top => slot_top,
        VerticalAlign::Center => slot_top + (slot - height) / 2.0,
        VerticalAlign::Bottom => slot_top + slot - height,
    }
}

/// Hangs a block of `height` onto an anchor line and returns its top edge.
/// top → top edge sits on the line. center → centre sits on the line (current behaviour). bottom → bottom edge sits on the line.
///
/// This is [`align_within`] with a slot height of 0. The anchor line is a zero-height slot.
pub fn anchor_block(anchor: f64, height: f64, align: VerticalAlign) -> f64 {
    align_within(anchor, 0.0, height, align)
}

/// Default in-slot alignment for line `rank` (out of `count` lines) inside a stack. The seam is pinned.
///
/// The upper line grows upward from the slot bottom, and the lower line grows downward from the slot top. The gap between them therefore never moves. With only one line the slot equals the actual height, so all three alignments are identity transforms, and center is used.
pub fn seam_align(rank: usize, count: usize) -> VerticalAlign {
    if count < 2 {
        VerticalAlign::Center
    } else if rank == 0 {
        VerticalAlign::Bottom
    } else if rank + 1 == count {
        VerticalAlign::Top
    } else {
        VerticalAlign::Center
    }
}

/// For each line, computes `(text block centre x, glyph top edge y)`. The output has the same order as the input, so drawing order is unaffected by position.
///
/// - Lines with coverage: `(x%, y%)` is the anchor of their own text box **including padding**. They are placed according to the line-level `align` (absent = center) and do not take part in the stack cursor. Detached lines always draw their own backplate, so they are always computed as separate.
/// - Lines without coverage: the whole stack is placed on `anchor_y` according to the `block` anchor (absent = center). What is pinned is the whole block including the backplate ([`StackExtent::total_height`]). Within the stack, each line gets a slot, and its line box is placed inside its slot according to the line-level `align` (absent = seam rule).
///
/// The return value is always the **glyph** top edge (the box top plus `pad_v` again), so the caller's drawing arithmetic is unchanged. With `pad_v == 0` it is bit-for-bit identical to the implementation before padding was added, so old documents show zero regressions.
pub fn place_lines(
    lines: &[LineBox],
    anchor: (f64, f64),
    gap: f64,
    frame: (f64, f64),
    block: Option<VerticalAlign>,
    plate: StackPlate,
) -> Vec<(f64, f64)> {
    let (anchor_x, anchor_y) = anchor;
    let (frame_width, frame_height) = frame;
    let stack = stacked_extent(lines, gap, plate);
    let padded = plate.padded();
    // With a shared backplate, the cursor starts at “board top + board padding”. The slot itself still measures bare glyphs.
    let mut cursor = anchor_block(
        anchor_y,
        stack.total_height,
        block.unwrap_or(VerticalAlign::Center),
    ) + plate.plate_pad_v();
    let mut rank = 0;
    lines
        .iter()
        .map(|line| match line.over {
            Some((x, y)) => (
                frame_width * x / 100.0,
                anchor_block(
                    frame_height * y / 100.0,
                    line.height + line.pad_v * 2.0,
                    line.align.unwrap_or(VerticalAlign::Center),
                ) + line.pad_v,
            ),
            None => {
                let pad_v = if padded { line.pad_v } else { 0.0 };
                let slot = line.slot(stack.count, padded);
                let align = line.align.unwrap_or_else(|| seam_align(rank, stack.count));
                let top = align_within(cursor, slot, line.height + pad_v * 2.0, align) + pad_v;
                cursor += slot + gap;
                rank += 1;
                (anchor_x, top)
            }
        })
        .collect()
}

/// The **glyph** vertical extent `(top edge, bottom edge)` after every line in the stack has been placed. The shared backplate expands outward by `pad_v` from this.
///
/// This corresponds to the `extent` in Mac `stackedLayout` before `insetBy(dx: -padH, dy: -padV)`.
///
/// Slots only pin the seams, and wrapped content grows its own slot. So the backplate cannot be derived back from `total_height`. When every line occupies exactly 1 line, the result is `(anchor - total/2, anchor + total/2)`, which restores the current behaviour bit for bit.
pub fn stacked_span(placements: &[(f64, f64)], lines: &[LineBox]) -> Option<(f64, f64)> {
    placements
        .iter()
        .zip(lines)
        .filter(|(_, line)| line.over.is_none())
        .fold(None, |span, ((_, top), line)| {
            let (top, bottom) = (*top, top + line.height);
            Some(span.map_or((top, bottom), |(high, low): (f64, f64)| {
                (high.min(top), low.max(bottom))
            }))
        })
}

pub fn group_transform(
    center_x: f64,
    center_y: f64,
    scale_x: f64,
    scale_y: f64,
    rotation: f64,
) -> Transform {
    Transform::from_translate(-(center_x as f32), -(center_y as f32))
        .post_scale(scale_x as f32, scale_y as f32)
        .post_rotate(rotation as f32)
        .post_translate(center_x as f32, center_y as f32)
}

/// Orthographic projection of the track's X/Z rotation. Unlike a CSS
/// perspective(6em), this has no viewport/font-dependent vanishing point.
pub fn group_transform_for_motion(
    pose: &word_motion::Pose,
    x: f64,
    y: f64,
    height: f64,
) -> Transform {
    let [a, b, c, d] = word_motion::projected_matrix(pose);
    Transform::from_translate(-(x as f32), -(y as f32))
        .post_concat(Transform::from_row(
            a as f32, b as f32, c as f32, d as f32, 0.0, 0.0,
        ))
        .post_translate(x as f32, (y + pose.dy * height) as f32)
}

pub fn layout_motion(
    layout: &LineLayout,
    animation: &WordAnimation,
) -> Option<word_motion::MotionFrame> {
    animation
        .motion_id
        .as_deref()
        .filter(|_| animation.caption.is_none() && layout.kind == LineKind::Original)
        .map(|id| motion_for_item(id, &layout.item, layout.render_time))
}

#[allow(clippy::too_many_arguments)]
fn motion_chunk_transform(
    motion: Option<&word_motion::MotionFrame>,
    chunk: &GlyphChunk,
    cursor: f64,
    center_x: f64,
    top: f64,
    height: f64,
    line_top: f64,
    line_height: f64,
) -> Transform {
    let Some(pose) = motion.and_then(|f| chunk.word.and_then(|i| f.words.get(i))) else {
        return Transform::identity();
    };
    let word_center = cursor + chunk.width / 2.0;
    word_transform_for_motion(
        pose,
        word_center,
        line_top + line_height / 2.0,
        center_x,
        top + height / 2.0,
        line_height,
    )
}

pub fn word_transform_for_motion(
    pose: &word_motion::Pose,
    word_center: f64,
    line_center: f64,
    center_x: f64,
    center_y: f64,
    line_height: f64,
) -> Transform {
    // A centered word first keeps its own pivot, then moves into the block's
    // center. Scaling about the block before that move would leave a residual
    // offset. Non-centered blockScaling uses the block center on both axes.
    let block_pivot = pose.block_scaled && !pose.centered;
    let pivot_x = if block_pivot { center_x } else { word_center };
    let pivot_y = if block_pivot { center_y } else { line_center };
    let mut transform = group_transform_for_motion(pose, pivot_x, pivot_y, line_height);
    if pose.centered {
        transform = transform.post_translate(
            (center_x - word_center) as f32,
            (center_y - line_center) as f32,
        );
    }
    transform
}

/// The baseline convention shared by the CPU raster and the R2 glyph scene.
pub fn glyph_baseline(line_top: f64, line_height: f64, chunk: &GlyphChunk, bounce: f64) -> f64 {
    // An enlarged emphasized word is positioned by its unscaled metrics, sharing the baseline with the other words on its line. Dividing by 1.0 is an identity under IEEE, and the order of operations is the same as the old form, so the baselines of ordinary pieces stay bit-for-bit unchanged.
    let scale = chunk.metric_scale;
    line_top + (line_height + chunk.shaped.ascent / scale - chunk.shaped.descent / scale) / 2.0
        - bounce
}

/// The single-glyph canvas transform shared by the CPU raster and the R2 glyph scene. First the synthetic italic is applied in the glyph's local space, then it is placed on the baseline. After that come the recipe pose and then the whole-group pose.
pub fn glyph_canvas_transform(
    chunk: &GlyphChunk,
    glyph_x: f64,
    glyph_y: f64,
    recipe_transform: Transform,
    group_transform: Transform,
) -> Transform {
    let italic = if chunk.italic {
        Transform::from_skew(-0.18, 0.0)
    } else {
        Transform::identity()
    };
    italic
        .post_translate(glyph_x as f32, glyph_y as f32)
        .post_concat(recipe_transform)
        .post_concat(group_transform)
}

pub fn paint(color: SubtitleColor, opacity: f64) -> Paint<'static> {
    let mut paint = Paint::default();
    let alpha = ((255 - color.a) as f64 * clamp(opacity, 0.0, 1.0)).round() as u8;
    paint.set_color_rgba8(color.r, color.g, color.b, alpha);
    paint.anti_alias = true;
    paint
}

pub fn rounded_rect_path(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
) -> Option<tiny_skia::Path> {
    if width <= 0.0 || height <= 0.0 {
        return None;
    }
    let radius = radius.min(width / 2.0).min(height / 2.0).max(0.0);
    let (x, y, width, height, radius) = (
        x as f32,
        y as f32,
        width as f32,
        height as f32,
        radius as f32,
    );
    let mut path = PathBuilder::new();
    path.move_to(x + radius, y);
    path.line_to(x + width - radius, y);
    path.quad_to(x + width, y, x + width, y + radius);
    path.line_to(x + width, y + height - radius);
    path.quad_to(x + width, y + height, x + width - radius, y + height);
    path.line_to(x + radius, y + height);
    path.quad_to(x, y + height, x, y + height - radius);
    path.line_to(x, y + radius);
    path.quad_to(x, y, x + radius, y);
    path.close();
    path.finish()
}

#[allow(clippy::too_many_arguments)]
pub fn fill_round_rect(
    pixmap: &mut Pixmap,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
    color: SubtitleColor,
    opacity: f64,
    transform: Transform,
) -> DrawBounds {
    let mut bounds = DrawBounds::default();
    if let Some(path) = rounded_rect_path(x, y, width, height, radius) {
        pixmap.fill_path(
            &path,
            &paint(color, opacity),
            FillRule::Winding,
            transform,
            None,
        );
        bounds.add_filled(&path, transform);
    }
    bounds
}

pub fn caption_recipe_transform(
    layout: &LineLayout,
    chunk: &GlyphChunk,
    cursor: f64,
    line_top: f64,
    line_height: f64,
    state: Option<&CaptionRecipeResolvedWord>,
) -> Transform {
    let Some(state) = state else {
        return Transform::identity();
    };
    let center_x = cursor + chunk.width / 2.0;
    let center_y = line_top + line_height / 2.0;
    let dx_base = layout.width.max(layout.style.font_size * 12.0);
    group_transform(
        center_x,
        center_y,
        state.scale_x,
        state.scale_y,
        state.rotation,
    )
    .post_translate(
        (state.dx * dx_base) as f32,
        (state.dy * layout.style.font_size * 2.4) as f32,
    )
}

pub fn caption_recipe_composite_mode(animation: &WordAnimation) -> CaptionCompositeMode {
    let Some(design) = animation.caption.as_ref() else {
        return CaptionCompositeMode::Normal;
    };
    let authored = design.text_option("composite").or_else(|| {
        caption_recipe_design_descriptor(design).map(|descriptor| descriptor.composite.as_str())
    });
    match authored {
        Some("difference") => CaptionCompositeMode::Difference,
        Some("exclusion") => CaptionCompositeMode::Exclusion,
        Some("screen") => CaptionCompositeMode::Screen,
        _ => CaptionCompositeMode::Normal,
    }
}

pub fn caption_recipe_blend_mode(animation: &WordAnimation) -> tiny_skia::BlendMode {
    match caption_recipe_composite_mode(animation) {
        CaptionCompositeMode::Normal => tiny_skia::BlendMode::SourceOver,
        CaptionCompositeMode::Difference => tiny_skia::BlendMode::Difference,
        CaptionCompositeMode::Exclusion => tiny_skia::BlendMode::Exclusion,
        CaptionCompositeMode::Screen => tiny_skia::BlendMode::Screen,
    }
}

pub fn caption_recipe_paint(
    animation: &WordAnimation,
    color: SubtitleColor,
    opacity: f64,
) -> Paint<'static> {
    let mut value = paint(color, opacity);
    value.blend_mode = caption_recipe_blend_mode(animation);
    value
}

pub fn caption_recipe_color(color: SubtitleColor, opacity: f64) -> Color {
    let alpha = ((255 - color.a) as f64 * opacity.clamp(0.0, 1.0)).round() as u8;
    Color::from_rgba8(color.r, color.g, color.b, alpha)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionRepeatLinearGradient {
    pub start: [f64; 2],
    pub end: [f64; 2],
    pub first: SubtitleColor,
    pub middle: SubtitleColor,
}

/// The Designed Caption gradient parameters shared by CPU tiny-skia and the retained glyph scene.
/// The phase is first quantized into 31 steps to keep the historical recipe deterministic. The coordinates belong to the glyph's local outline. Each executor maps them to the canvas together with the glyph transform.
pub fn caption_recipe_repeat_linear_gradient(
    animation: &WordAnimation,
    visual: &WordVisual,
) -> Option<CaptionRepeatLinearGradient> {
    let (Some(design), Some(state)) = (animation.caption.as_ref(), visual.recipe.as_ref()) else {
        return None;
    };
    let descriptor = caption_recipe_design_descriptor(design)?;
    if !descriptor
        .layers
        .iter()
        .any(|layer| layer == "gradientFill")
    {
        return None;
    }
    let phase = (state.fill_progress.clamp(0.0, 1.0) * 31.0).round();
    let shift = phase / 31.0 * 192.0 * 0.45;
    Some(CaptionRepeatLinearGradient {
        start: [-shift, 0.0],
        end: [192.0 - shift, 0.0],
        first: design.primary,
        middle: design.accent,
    })
}

pub fn caption_recipe_textures() -> &'static HashMap<&'static str, Pixmap> {
    static TEXTURES: std::sync::OnceLock<HashMap<&'static str, Pixmap>> =
        std::sync::OnceLock::new();
    TEXTURES.get_or_init(|| {
        CAPTION_TEXTURE_FILES
            .iter()
            .map(|(name, bytes)| {
                let pixmap = Pixmap::decode_png(bytes)
                    .expect("bundled GPUI caption texture must be a valid PNG");
                (*name, pixmap)
            })
            .collect()
    })
}

pub fn caption_recipe_texture(
    descriptor: &CaptionRecipeDescriptor,
    design: &DesignedCaption,
) -> Option<&'static Pixmap> {
    let filename = caption_recipe_texture_filename(descriptor, design)?;
    caption_recipe_textures().get(filename)
}

/// The canonical texture filename selected by Designed Caption. The CPU reference and the retained scene must share this default and override resolution. Neither may guess the first asset on its own.
pub fn caption_recipe_texture_filename<'a>(
    descriptor: &'a CaptionRecipeDescriptor,
    design: &DesignedCaption,
) -> Option<&'a str> {
    let requested = design.text_option("texture");
    requested
        .and_then(|requested| {
            descriptor.assets.iter().find_map(|asset| {
                Path::new(&asset.file)
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .filter(|stem| *stem == requested)
                    .map(|_| asset.file.as_str())
            })
        })
        .or_else(|| descriptor.assets.first().map(|asset| asset.file.as_str()))
}

pub fn caption_recipe_uses_texture_fill(animation: &WordAnimation) -> bool {
    animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
        .is_some_and(|descriptor| descriptor.layers.iter().any(|layer| layer == "textureFill"))
}

pub fn caption_recipe_glyph_texture_available(animation: &WordAnimation) -> bool {
    let Some(design) = animation.caption.as_ref() else {
        return false;
    };
    let Some(descriptor) = caption_recipe_design_descriptor(design) else {
        return false;
    };
    caption_recipe_texture_filename(descriptor, design).is_some_and(|filename| {
        CAPTION_TEXTURE_FILES
            .iter()
            .any(|(bundled, _)| *bundled == filename)
    })
}

/// Turns the canonical texture already decoded on the CPU into a renderer-neutral premultiplied RGBA8 resource. The content key takes the first 128 bits of SHA-256. The six built-in patterns are copied only once, on first hit. Later scenes and the compositor all reuse the same `Arc`.
pub fn caption_recipe_glyph_texture(
    animation: &WordAnimation,
) -> Option<Arc<element_draw::GlyphTexture>> {
    use sha2::Digest as _;

    static TEXTURES: std::sync::OnceLock<HashMap<&'static str, Arc<element_draw::GlyphTexture>>> =
        std::sync::OnceLock::new();
    let textures = TEXTURES.get_or_init(|| {
        caption_recipe_textures()
            .iter()
            .map(|(&name, pixmap)| {
                let mut hasher = sha2::Sha256::new();
                hasher.update(pixmap.width().to_be_bytes());
                hasher.update(pixmap.height().to_be_bytes());
                hasher.update(pixmap.data());
                let digest = hasher.finalize();
                let key = element_draw::GlyphTextureKey([
                    u64::from_be_bytes(digest[0..8].try_into().expect("sha256 prefix")),
                    u64::from_be_bytes(digest[8..16].try_into().expect("sha256 prefix")),
                ]);
                let texture = element_draw::GlyphTexture::new(
                    key,
                    pixmap.width(),
                    pixmap.height(),
                    pixmap.data().to_vec(),
                )
                .expect("bundled caption texture is tightly packed RGBA8");
                (name, Arc::new(texture))
            })
            .collect()
    });
    let design = animation.caption.as_ref()?;
    let descriptor = caption_recipe_design_descriptor(design)?;
    let filename = caption_recipe_texture_filename(descriptor, design)?;
    textures.get(filename).cloned()
}

pub fn caption_recipe_glyph_paint(
    animation: &WordAnimation,
    visual: &WordVisual,
    color: SubtitleColor,
    opacity: f64,
    allow_pattern: bool,
) -> Option<Paint<'static>> {
    let mut value = caption_recipe_paint(animation, color, opacity);
    if !allow_pattern {
        return Some(value);
    }
    let (Some(design), Some(_)) = (animation.caption.as_ref(), visual.recipe.as_ref()) else {
        return Some(value);
    };
    let Some(descriptor) = caption_recipe_design_descriptor(design) else {
        return Some(value);
    };
    if let Some(gradient) = caption_recipe_repeat_linear_gradient(animation, visual) {
        value.shader = LinearGradient::new(
            Point::from_xy(gradient.start[0] as f32, gradient.start[1] as f32),
            Point::from_xy(gradient.end[0] as f32, gradient.end[1] as f32),
            vec![
                GradientStop::new(0.0, caption_recipe_color(gradient.first, opacity)),
                GradientStop::new(0.5, caption_recipe_color(gradient.middle, opacity)),
                GradientStop::new(1.0, caption_recipe_color(gradient.first, opacity)),
            ],
            SpreadMode::Repeat,
            Transform::identity(),
        )?;
    } else if descriptor.layers.iter().any(|layer| layer == "textureFill") {
        // Consistent with Mac: a missing canonical material is an explicit render failure. It must not silently degrade to a flat fill.
        let texture = caption_recipe_texture(descriptor, design)?;
        value.shader = Pattern::new(
            texture.as_ref(),
            SpreadMode::Repeat,
            FilterQuality::Bilinear,
            opacity.clamp(0.0, 1.0) as f32,
            Transform::identity(),
        );
    }
    Some(value)
}

/// The single-layer parameters for Designed Caption `glyphDuplicate`. The offset is still in glyph-local coordinates, so the CPU can apply it before the full glyph transform. The retained scene first passes it through the linear part of synthetic italic, then writes it into the run uniform, which gives the same canvas position.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionRecipeGlyphDuplicate {
    pub dx: f64,
    pub dy: f64,
    pub color: SubtitleColor,
    pub opacity: f64,
}

pub fn caption_recipe_glyph_duplicate_layer_count(animation: &WordAnimation) -> usize {
    let Some(descriptor) = animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
        .filter(|descriptor| {
            descriptor
                .layers
                .iter()
                .any(|layer| layer == "glyphDuplicate")
        })
    else {
        return 0;
    };
    descriptor.glyph_duplicate_layers.unwrap_or(1).max(1)
}

/// A few recipes also use `glyphDuplicate` as visual layering metadata. The CPU/GPU only need an extra glyph pass when the descriptor actually declares an `echo` channel. For example, the trailing `glyphDuplicate` of editorial-emphasis only changes the body colour through `colorMix`, and must not submit a fully transparent glyph layer for it.
pub fn caption_recipe_echo_duplicate_layer_count(animation: &WordAnimation) -> usize {
    let has_echo = animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
        .is_some_and(|descriptor| {
            descriptor
                .events
                .iter()
                .any(|event| event.channels.iter().any(|channel| channel == "echo"))
        });
    has_echo
        .then(|| caption_recipe_glyph_duplicate_layer_count(animation))
        .unwrap_or(0)
}

fn caption_recipe_rgb_split_duplicate_layer_count(animation: &WordAnimation) -> usize {
    animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
        .is_some_and(|descriptor| {
            descriptor
                .events
                .iter()
                .any(|event| event.channels.iter().any(|channel| channel == "rgbSplit"))
                && descriptor
                    .layers
                    .iter()
                    .any(|layer| layer == "glyphDuplicate")
        })
        .then_some(2)
        .unwrap_or(0)
}

/// The retained scene reserves a fixed number of runs for every glyph copy that may appear. The current echo uses the layer count declared by the descriptor. RGB split corresponds exactly to the CPU's red and cyan layers. Transparent stages still keep their nodes.
pub fn caption_recipe_retained_duplicate_layer_count(animation: &WordAnimation) -> usize {
    caption_recipe_echo_duplicate_layer_count(animation)
        + caption_recipe_rgb_split_duplicate_layer_count(animation)
}

/// The echo layer parameters shared by the CPU reference and the retained glyph scene. Even when the current echo is zero, it returns the fixed layer count declared by the descriptor. The scene can therefore keep node and Arc identity, and only write opacity as zero.
pub fn caption_recipe_glyph_duplicate_layers(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    opacity: f64,
) -> Vec<CaptionRecipeGlyphDuplicate> {
    let Some(state) = visual.recipe.as_ref() else {
        return Vec::new();
    };
    let count = caption_recipe_echo_duplicate_layer_count(animation);
    (0..count)
        .map(|layer| {
            let gain = (layer + 1) as f64 / count as f64;
            let echo = state.echo * gain;
            CaptionRecipeGlyphDuplicate {
                dx: -layout.style.font_size * (0.08 + echo * 0.12),
                dy: layout.style.font_size * (0.06 + echo * 0.08),
                color: visual.color.unwrap_or(layout.style.color),
                opacity: opacity * (echo * 0.45).min(0.55),
            }
        })
        .collect()
}

pub fn caption_recipe_rgb_split_duplicate_layers(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    opacity: f64,
) -> Vec<CaptionRecipeGlyphDuplicate> {
    let Some(state) = visual.recipe.as_ref() else {
        return Vec::new();
    };
    if caption_recipe_rgb_split_duplicate_layer_count(animation) == 0 {
        return Vec::new();
    }
    let offset = layout.style.font_size * state.rgb_split;
    [
        SubtitleColor {
            r: 255,
            g: 59,
            b: 48,
            a: 0,
        },
        SubtitleColor {
            r: 50,
            g: 215,
            b: 255,
            a: 0,
        },
    ]
    .into_iter()
    .zip([-offset, offset])
    .map(|(color, dx)| CaptionRecipeGlyphDuplicate {
        dx,
        dy: 0.0,
        color,
        opacity: opacity * 0.72 * f64::from(state.rgb_split > 0.001),
    })
    .collect()
}

pub fn caption_recipe_retained_glyph_duplicate_layers(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    opacity: f64,
) -> Vec<CaptionRecipeGlyphDuplicate> {
    let mut layers = caption_recipe_glyph_duplicate_layers(layout, animation, visual, opacity);
    layers.extend(caption_recipe_rgb_split_duplicate_layers(
        layout, animation, visual, opacity,
    ));
    layers
}

/// The CPU applies the duplicate translation before synthetic italic. The GPU's stable geometry already includes italic, so the local vector must first be multiplied by its linear part, and then used as the run translation.
pub fn glyph_duplicate_canvas_offset(
    chunk: &GlyphChunk,
    duplicate: CaptionRecipeGlyphDuplicate,
) -> (f64, f64) {
    if chunk.italic {
        (duplicate.dx - duplicate.dy * 0.18, duplicate.dy)
    } else {
        (duplicate.dx, duplicate.dy)
    }
}

/// The programmatic glyph stroke that Designed Caption appends before the body outline and fill. The CPU reference strokes the original outline directly. The retained scene uses the same width, colour and opacity to drive a dilation shader on a stable alpha mask, which avoids rebuilding the glyph mask every frame.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionRecipeGlyphStroke {
    pub width: f64,
    pub color: SubtitleColor,
    pub opacity: f64,
}

pub fn caption_recipe_retained_stroke_layer_count(animation: &WordAnimation) -> usize {
    let Some(descriptor) = animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
    else {
        return 0;
    };
    let glow = descriptor
        .events
        .iter()
        .any(|event| event.channels.iter().any(|channel| channel == "glowGain"))
        .then(|| descriptor.glow_layers.unwrap_or(3).max(1))
        .unwrap_or(0);
    let weight = usize::from(
        descriptor
            .events
            .iter()
            .any(|event| event.channels.iter().any(|channel| channel == "weightAxis")),
    );
    glow + weight
}

/// The maximum full stroke width that the descriptor may require at any keyframe. The capability gate checks the fixed outset budget against it before taking GPU ownership, so playback does not have to fall back temporarily at the peak stage.
pub fn caption_recipe_max_stroke_width(animation: &WordAnimation, font_size: f64) -> f64 {
    let Some(descriptor) = animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
    else {
        return 0.0;
    };
    let channel_max = |channel: &str| {
        descriptor
            .events
            .iter()
            .filter_map(|event| event.keyframes.get(channel))
            .flatten()
            .map(|key| key.value.max(0.0))
            .fold(0.0, f64::max)
    };
    let glow = font_size.max(0.0) * (0.035 + 0.11) * channel_max("glowGain");
    let weight = (channel_max("weightAxis") / 380.0 * 3.2).min(4.5);
    glow.max(weight)
}

/// The per-layer stroke parameters for neon and weight, shared by the CPU and the retained scene. When `retain_transparent` is true, it returns the fixed layer count declared by the descriptor. Layers whose effect is inactive only have opacity and width set to zero. That keeps the cross-frame nodes, glyph Arcs and atlas placements unchanged.
pub fn caption_recipe_glyph_stroke_layers(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    opacity: f64,
    retain_transparent: bool,
) -> Vec<CaptionRecipeGlyphStroke> {
    let (Some(design), Some(descriptor)) = (
        animation.caption.as_ref(),
        animation
            .caption
            .as_ref()
            .and_then(caption_recipe_design_descriptor),
    ) else {
        return Vec::new();
    };
    let state = visual.recipe.as_ref();
    let mut strokes = Vec::with_capacity(caption_recipe_retained_stroke_layer_count(animation));
    if descriptor
        .events
        .iter()
        .any(|event| event.channels.iter().any(|channel| channel == "glowGain"))
    {
        let layers = descriptor.glow_layers.unwrap_or(3).max(1);
        let glow_gain = state.map_or(0.0, |state| state.glow_gain);
        if retain_transparent || glow_gain > 0.001 {
            for layer in (1..=layers).rev() {
                let fraction = layer as f64 / layers as f64;
                strokes.push(CaptionRecipeGlyphStroke {
                    width: layout.style.font_size * (0.035 + fraction * 0.11) * glow_gain,
                    color: design.accent,
                    opacity: opacity
                        * (0.24 / layer as f64)
                        * glow_gain.min(1.4)
                        * f64::from(glow_gain > 0.001),
                });
            }
        }
    }
    if descriptor
        .events
        .iter()
        .any(|event| event.channels.iter().any(|channel| channel == "weightAxis"))
    {
        let weight_axis = state.map_or(0.0, |state| state.weight_axis);
        if retain_transparent || weight_axis > 0.001 {
            strokes.push(CaptionRecipeGlyphStroke {
                width: (weight_axis / 380.0 * 3.2).min(4.5),
                color: visual.color.unwrap_or(layout.style.color),
                opacity: opacity * f64::from(weight_axis > 0.001),
            });
        }
    }
    strokes
}

/// The logical geometry shared by particles and scan lines between the CPU reference and the retained scene. A circle is expressed as `radius == min(width,height)/2`. The GPU still submits only a fixed quad.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionRecipeRoundedDecoration {
    pub rect: [f64; 4],
    pub radius: f64,
    pub color: SubtitleColor,
    pub opacity: f64,
}

#[allow(clippy::too_many_arguments)]
pub fn caption_recipe_rounded_decorations(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    word_index: Option<usize>,
    cursor: f64,
    chunk_width: f64,
    line_top: f64,
    line_height: f64,
    opacity: f64,
    retain_transparent: bool,
) -> Vec<CaptionRecipeRoundedDecoration> {
    let (Some(design), Some(state)) = (animation.caption.as_ref(), visual.recipe.as_ref()) else {
        return Vec::new();
    };
    let Some(descriptor) = caption_recipe_design_descriptor(design) else {
        return Vec::new();
    };
    let mut decorations = Vec::new();
    let center_x = cursor + chunk_width / 2.0;
    let center_y = line_top + line_height / 2.0;
    let particle_role_supported = descriptor.events.iter().any(|event| {
        event.channels.iter().any(|channel| channel == "burst")
            && event
                .roles
                .as_ref()
                .is_none_or(|roles| roles.iter().any(|role| role == &state.role))
    });
    let particles = if retain_transparent
        && descriptor.layers.iter().any(|layer| layer == "particles")
        && particle_role_supported
        && let Some(word) = word_index.and_then(|index| layout.item.words.get(index))
    {
        let count = design
            .number_option("particleCount")
            .unwrap_or(16.0)
            .clamp(0.0, 24.0) as usize;
        let seed = caption_recipe_word_seed(design, &layout.item.id, word);
        caption_recipe_particle_templates(seed, count)
            .into_iter()
            .map(|template| {
                let phase = ((state.burst - template.lag) / (1.0 - template.lag).max(0.0001))
                    .clamp(0.0, 1.0);
                CaptionRecipeParticle {
                    dx: template.angle.cos() * template.distance * phase,
                    dy: template.angle.sin() * template.distance * phase + phase * phase * 0.38,
                    radius: template.radius,
                    opacity: if (0.0..1.0).contains(&phase) {
                        (1.0 - phase) * (1.0 - phase)
                    } else {
                        0.0
                    },
                }
            })
            .collect::<Vec<_>>()
    } else {
        state.particles.clone()
    };
    for particle in particles {
        if !retain_transparent && particle.opacity <= 0.001 {
            continue;
        }
        let radius = layout.style.font_size * particle.radius;
        let x = center_x + particle.dx * layout.style.font_size * 1.8;
        let y = center_y + particle.dy * layout.style.font_size * 1.8;
        decorations.push(CaptionRecipeRoundedDecoration {
            rect: [x - radius, y - radius, radius * 2.0, radius * 2.0],
            radius,
            color: design.accent,
            opacity: opacity * particle.opacity,
        });
    }
    if descriptor.layers.iter().any(|layer| layer == "scanlines")
        && (retain_transparent || state.rgb_split > 0.001)
    {
        let stride = (layout.style.font_size * 0.12).max(2.0);
        let mut y = line_top;
        while y < line_top + line_height {
            decorations.push(CaptionRecipeRoundedDecoration {
                rect: [cursor, y, chunk_width, (stride * 0.18).max(1.0)],
                radius: 0.0,
                color: design.accent,
                opacity: opacity * 0.18 * f64::from(state.rgb_split > 0.001),
            });
            y += stride;
        }
    }
    decorations
}

pub fn caption_recipe_clip_box(
    cursor: f64,
    line_top: f64,
    width: f64,
    height: f64,
    state: Option<&CaptionRecipeResolvedWord>,
) -> Option<[f64; 4]> {
    let state = state?;
    if state.clip_l <= 0.0 && state.clip_r <= 0.0 && state.clip_t <= 0.0 && state.clip_b <= 0.0 {
        return None;
    }
    let left = state.clip_l.clamp(0.0, 1.0);
    let right = state.clip_r.clamp(0.0, 1.0);
    let top = state.clip_t.clamp(0.0, 1.0);
    let bottom = state.clip_b.clamp(0.0, 1.0);
    Some([
        cursor + width * left,
        line_top + height * top,
        width * (1.0 - left - right).max(0.0),
        height * (1.0 - top - bottom).max(0.0),
    ])
}

#[allow(clippy::too_many_arguments)]
pub fn caption_recipe_clip_mask(
    pixmap: &Pixmap,
    cursor: f64,
    line_top: f64,
    width: f64,
    height: f64,
    state: Option<&CaptionRecipeResolvedWord>,
    transform: Transform,
) -> Option<PixmapMask> {
    let [left, top, clip_width, clip_height] =
        caption_recipe_clip_box(cursor, line_top, width, height, state)?;
    let mut mask = PixmapMask::new(pixmap.width(), pixmap.height())?;
    if let Some(path) = rounded_rect_path(left, top, clip_width, clip_height, 0.0) {
        mask.fill_path(&path, FillRule::Winding, false, transform);
    }
    Some(mask)
}

#[allow(clippy::too_many_arguments)]
pub fn draw_caption_recipe_decorations(
    pixmap: &mut Pixmap,
    text_engine: &mut TextEngine,
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    word_index: Option<usize>,
    cursor: f64,
    chunk_width: f64,
    line_top: f64,
    line_height: f64,
    opacity: f64,
    group_transform: Transform,
) -> DrawBounds {
    let mut bounds = DrawBounds::default();
    let (Some(design), Some(state)) = (animation.caption.as_ref(), visual.recipe.as_ref()) else {
        return bounds;
    };
    let Some(_) = caption_recipe_design_descriptor(design) else {
        return bounds;
    };
    for decoration in caption_recipe_rounded_decorations(
        layout,
        animation,
        visual,
        word_index,
        cursor,
        chunk_width,
        line_top,
        line_height,
        opacity,
        false,
    ) {
        if decoration.radius > 0.0
            && (decoration.rect[2] - decoration.radius * 2.0).abs() < 1e-9
            && (decoration.rect[3] - decoration.radius * 2.0).abs() < 1e-9
            && let Some(path) = PathBuilder::from_circle(
                (decoration.rect[0] + decoration.radius) as f32,
                (decoration.rect[1] + decoration.radius) as f32,
                decoration.radius as f32,
            )
        {
            pixmap.fill_path(
                &path,
                &caption_recipe_paint(animation, decoration.color, decoration.opacity),
                FillRule::Winding,
                group_transform,
                None,
            );
            bounds.add_filled(&path, group_transform);
        } else {
            bounds.merge(fill_round_rect(
                pixmap,
                decoration.rect[0],
                decoration.rect[1],
                decoration.rect[2],
                decoration.rect[3],
                decoration.radius,
                decoration.color,
                decoration.opacity,
                group_transform,
            ));
        }
    }
    let Some(emoji) = state.emoji.as_deref().filter(|emoji| !emoji.is_empty()) else {
        return bounds;
    };
    let size = layout.style.font_size * 0.62;
    let shaped = text_engine.shape(emoji, &layout.style.font_name, size, 400);
    let x = cursor + chunk_width - layout.style.font_size * 0.08;
    let baseline = line_top - layout.style.font_size * 0.52 + shaped.ascent;
    for glyph in &shaped.glyphs {
        let local = Transform::from_translate((x + glyph.x) as f32, (baseline + glyph.y) as f32)
            .post_concat(group_transform);
        match text_engine.glyph_render(glyph.cache_key) {
            GlyphRender::Outline(path) => {
                pixmap.fill_path(
                    &path,
                    &caption_recipe_paint(animation, SubtitleColor::WHITE, opacity),
                    FillRule::Winding,
                    local,
                    None,
                );
                bounds.add_filled(&path, local);
            }
            GlyphRender::ColorBitmap {
                width,
                height,
                rgba,
                left,
                top,
            } => {
                let bitmap = PixmapRef::from_bytes(&rgba, width, height)
                    .expect("colour glyph RGBA size was already validated by TextEngine");
                let placement =
                    Transform::from_translate(left as f32, -top as f32).post_concat(local);
                pixmap.draw_pixmap(
                    0,
                    0,
                    bitmap,
                    &PixmapPaint {
                        opacity: opacity as f32,
                        quality: FilterQuality::Bilinear,
                        blend_mode: caption_recipe_blend_mode(animation),
                    },
                    placement,
                    None,
                );
                bounds.add_pixmap(width, height, placement);
            }
            GlyphRender::Empty => {}
        }
    }
    bounds
}

#[allow(clippy::too_many_arguments)]
pub fn draw_line_effect(
    pixmap: &mut Pixmap,
    text_engine: &mut TextEngine,
    layout: &LineLayout,
    animation: &WordAnimation,
    center_x: f64,
    top: f64,
    opacity: f64,
    group_transform: Transform,
) -> DrawBounds {
    if layout.style.text_motion.is_some() || layout.style.word_background.is_some() {
        return DrawBounds::default();
    }
    let mut bounds = DrawBounds::default();
    let motion = layout_motion(layout, animation);
    let height = layout.height;
    let (opacity, group_transform) = motion.as_ref().map_or((opacity, group_transform), |frame| {
        (
            opacity * frame.block.opacity,
            group_transform_for_motion(&frame.block, center_x, top + height / 2.0, height)
                .post_concat(group_transform),
        )
    });
    let mut line_top = top;
    for line in layout.lines.iter() {
        let line_height = line
            .height
            .max(layout.style.font_size * layout.style.line_height);
        let mut cursor = line_start_x(layout, line.width, center_x);
        for chunk in &line.chunks {
            let (part_opacity, part_dx, part_dy) = chunk_part_delta(layout, chunk);
            let visual = if layout.kind == LineKind::Original && animation.name != "None" {
                chunk
                    .word
                    .and_then(|index| {
                        layout.item.words.get(index).map(|_| {
                            word_visual(
                                animation,
                                &layout.item,
                                index,
                                layout.current_word,
                                layout.render_time,
                                layout.render_fps,
                            )
                        })
                    })
                    .unwrap_or_default()
            } else {
                WordVisual::default()
            };
            if visual.shadow_off {
                cursor += chunk.width;
                continue;
            }
            let chunk_opacity =
                opacity * part_opacity * clamp(visual.opacity.unwrap_or(1.0), 0.0, 1.0);
            let bounce = visual.bottom_em.unwrap_or(0.0) * layout.style.font_size;
            let baseline = glyph_baseline(line_top, line_height, chunk, bounce);
            let recipe_transform = caption_recipe_transform(
                layout,
                chunk,
                cursor + part_dx,
                line_top + part_dy,
                line_height,
                visual.recipe.as_ref(),
            );
            let recipe_transform = motion_chunk_transform(
                motion.as_ref(),
                chunk,
                cursor,
                center_x,
                top,
                height,
                line_top,
                line_height,
            )
            .post_concat(recipe_transform);
            let clip_mask = caption_recipe_clip_mask(
                pixmap,
                cursor + part_dx,
                line_top + part_dy,
                chunk.width,
                line_height,
                visual.recipe.as_ref(),
                recipe_transform.post_concat(group_transform),
            );
            let replacement = visual
                .recipe
                .as_ref()
                .and_then(|state| state.text_swap.as_deref())
                .map(|text| {
                    text_engine.shape(text, &chunk.font_name, chunk.font_size, chunk.font_weight)
                });
            let shaped = replacement.as_ref().unwrap_or(&chunk.shaped);
            for (glyph_index, glyph) in shaped.glyphs.iter().enumerate() {
                // Colour bitmap glyphs (emoji) have no outline to project, so the effect layer skips them. The bitmap itself is still drawn by draw_line_layout.
                let GlyphRender::Outline(path) = text_engine.glyph_render(glyph.cache_key) else {
                    continue;
                };
                let glyph_x =
                    cursor + glyph.x + glyph_index as f64 * layout.style.letter_spacing + part_dx;
                let local = glyph_canvas_transform(
                    chunk,
                    glyph_x,
                    baseline + glyph.y + part_dy,
                    recipe_transform,
                    group_transform,
                );
                let effect_transform = Transform::from_translate(
                    layout.style.effect_x as f32,
                    layout.style.effect_y as f32,
                )
                .post_concat(local);
                // Mac `SubtitleFrameDrawing` paint order is “the stroked shadow goes below, the clean fill goes on top”. That means the shadow or glow is cast from the **post-stroke** outline.
                // If the effect layer only fills, then with a stroke enabled the shadow would be thinner than the preview, or not visible at all.
                //
                // Not distinguishing glow from shadow here is intentional. The glow pass in `SubtitleFrameDrawing.swift:544-551` runs before :565 flips `.strokeWidth` positive, so the property is still negative at that point. AppKit semantics (stroke and fill drawn together) therefore make the glow likewise blur out of the post-stroke outline. In `resolve_line_style` the two effects also share one effect slot (the gap note there covers this).
                if layout.style.outline_on && layout.style.outline_width > 0.0 {
                    let stroke = Stroke {
                        width: layout.style.outline_width as f32,
                        ..Stroke::default()
                    };
                    pixmap.stroke_path(
                        &path,
                        &paint(layout.style.effect_color, chunk_opacity),
                        &stroke,
                        effect_transform,
                        clip_mask.as_ref(),
                    );
                    bounds.add_stroked(&path, effect_transform, stroke.width);
                }
                pixmap.fill_path(
                    &path,
                    &paint(layout.style.effect_color, chunk_opacity),
                    FillRule::Winding,
                    effect_transform,
                    clip_mask.as_ref(),
                );
                bounds.add_filled(&path, effect_transform);
            }
            cursor += chunk.width;
        }
        line_top += line_height + line.gap_after;
    }
    bounds
}

pub fn caption_recipe_word_rects(
    layout: &LineLayout,
    center_x: f64,
    top: f64,
) -> Vec<Option<(f64, f64, f64, f64)>> {
    let mut rects = vec![None; layout.item.words.len()];
    let mut line_top = top;
    for line in layout.lines.iter() {
        let line_height = line
            .height
            .max(layout.style.font_size * layout.style.line_height);
        let mut cursor = line_start_x(layout, line.width, center_x);
        for chunk in &line.chunks {
            if let Some(index) = chunk.word
                && index < rects.len()
            {
                let text_height = (chunk.shaped.ascent + chunk.shaped.descent)
                    .max(chunk.font_size)
                    .min(line_height);
                let text_top = line_top + (line_height - text_height) / 2.0;
                rects[index] = Some((cursor, text_top, chunk.width, text_height));
            }
            cursor += chunk.width;
        }
        line_top += line_height + line.gap_after;
    }
    rects
}

pub fn caption_recipe_pill_state(
    layout: &LineLayout,
    animation: &WordAnimation,
) -> Option<(usize, CaptionRecipeResolvedWord)> {
    let design = animation.caption.as_ref()?;
    let descriptor = caption_recipe_design_descriptor(design)?;
    if !descriptor.layers.iter().any(|layer| layer == "pill") {
        return None;
    }
    (0..layout.item.words.len())
        .filter_map(|index| {
            resolve_caption_recipe_word(
                design,
                &layout.item,
                index,
                layout.render_time,
                layout.render_fps,
            )
            .filter(|word| word.plate_progress > 0.001)
            .map(|word| (index, word))
        })
        .max_by(|(_, left), (_, right)| left.plate_x.total_cmp(&right.plate_x))
}

/// The programmatic backplate of Designed Caption. What is stored here is canvas coordinates and alpha **without the scene or group**. The CPU reference applies `opacity` when drawing. The retained scene writes the same value into the rounded-rect uniform, and then the node pose applies the group opacity.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CaptionRecipePlate {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
    pub color: SubtitleColor,
    pub opacity: f64,
}

#[allow(clippy::too_many_arguments)]
pub fn caption_recipe_plate(
    layout: &LineLayout,
    animation: &WordAnimation,
    visual: &WordVisual,
    chunk: &GlyphChunk,
    cursor: f64,
    line_top: f64,
    line_height: f64,
    part_opacity: f64,
    part_dx: f64,
    part_dy: f64,
    bounce: f64,
    word_rects: &[Option<(f64, f64, f64, f64)>],
    pill_state: Option<&(usize, CaptionRecipeResolvedWord)>,
    pill_groups: Option<&[usize]>,
) -> Option<CaptionRecipePlate> {
    if let (Some((selected, state)), Some(groups), Some(index)) =
        (pill_state, pill_groups, chunk.word)
        && index == *selected
        && let Some((destination_x, destination_y, destination_w, destination_h)) =
            word_rects.get(index).copied().flatten()
    {
        let previous = (0..index)
            .rev()
            .find(|candidate| groups.get(*candidate) == groups.get(index))
            .and_then(|candidate| word_rects.get(candidate).copied().flatten());
        let travel = state.plate_x.clamp(0.0, 1.0);
        let (x, y, width, height) = previous.map_or(
            (destination_x, destination_y, destination_w, destination_h),
            |(source_x, source_y, source_w, source_h)| {
                (
                    source_x + (destination_x - source_x) * travel,
                    source_y + (destination_y - source_y) * travel,
                    source_w + (destination_w - source_w) * travel,
                    source_h + (destination_h - source_h) * travel,
                )
            },
        );
        let spread = layout.style.font_size * 0.12;
        return Some(CaptionRecipePlate {
            x: x - spread,
            y: y - spread,
            width: width + spread * 2.0,
            height: height + spread * 2.0,
            radius: layout.style.font_size * state.plate_radius,
            color: animation.caption.as_ref()?.accent,
            opacity: part_opacity * 0.92,
        });
    }

    if pill_state.is_none()
        && let (Some(background), Some(state)) = (visual.background, visual.recipe.as_ref())
    {
        let progress = state.plate_progress.clamp(0.0, 1.0);
        let spread = layout.style.font_size * (0.04 + progress * 0.12);
        let (word_x, text_top, word_width, word_height) = chunk
            .word
            .and_then(|index| word_rects.get(index).copied().flatten())
            .unwrap_or((
                cursor,
                line_top + (line_height - chunk.font_size) / 2.0,
                chunk.width,
                chunk.font_size,
            ));
        return Some(CaptionRecipePlate {
            x: word_x - spread + part_dx,
            y: text_top - spread - bounce + part_dy,
            width: (word_width + spread * 2.0) * progress.max(0.001),
            height: word_height + spread * 2.0,
            radius: layout.style.font_size * state.plate_radius,
            color: background,
            opacity: part_opacity * (0.25 + progress * 0.75),
        });
    }

    None
}

#[allow(clippy::too_many_arguments)]
pub fn draw_line_layout(
    pixmap: &mut Pixmap,
    text_engine: &mut TextEngine,
    layout: &LineLayout,
    animation: &WordAnimation,
    center_x: f64,
    top: f64,
    opacity: f64,
    group_transform: Transform,
) -> DrawBounds {
    if layout.style.text_motion.is_some() || layout.style.word_background.is_some() {
        return draw_text_motion_layout(
            pixmap,
            text_engine,
            layout,
            center_x,
            top,
            opacity,
            group_transform,
        );
    }
    let mut bounds = DrawBounds::default();
    let motion = layout_motion(layout, animation);
    let height = layout.height;
    let (opacity, group_transform) = motion.as_ref().map_or((opacity, group_transform), |frame| {
        let pose = &frame.block;
        let transform = group_transform_for_motion(pose, center_x, top + height / 2.0, height);
        (
            opacity * pose.opacity,
            transform.post_concat(group_transform),
        )
    });
    let word_rects = caption_recipe_word_rects(layout, center_x, top);
    let pill_state = caption_recipe_pill_state(layout, animation);
    let pill_groups = animation
        .caption
        .as_ref()
        .and_then(caption_recipe_design_descriptor)
        .filter(|descriptor| descriptor.layers.iter().any(|layer| layer == "pill"))
        .map(|descriptor| {
            caption_recipe_group_indices(&layout.item.words, descriptor.grouping.as_ref())
        });
    let mut line_top = top;
    for line in layout.lines.iter() {
        let line_height = line
            .height
            .max(layout.style.font_size * layout.style.line_height);
        let mut cursor = line_start_x(layout, line.width, center_x);
        for chunk in &line.chunks {
            let (part_opacity, part_dx, part_dy) = chunk_part_delta(layout, chunk);
            let visual = if layout.kind == LineKind::Original && animation.name != "None" {
                chunk
                    .word
                    .and_then(|index| {
                        layout.item.words.get(index).map(|_| {
                            word_visual(
                                animation,
                                &layout.item,
                                index,
                                layout.current_word,
                                layout.render_time,
                                layout.render_fps,
                            )
                        })
                    })
                    .unwrap_or_default()
            } else {
                WordVisual::default()
            };
            let chunk_opacity =
                opacity * part_opacity * clamp(visual.opacity.unwrap_or(1.0), 0.0, 1.0);
            let bounce = visual.bottom_em.unwrap_or(0.0) * layout.style.font_size;
            let baseline = glyph_baseline(line_top, line_height, chunk, bounce);
            let recipe_transform = caption_recipe_transform(
                layout,
                chunk,
                cursor + part_dx,
                line_top + part_dy,
                line_height,
                visual.recipe.as_ref(),
            );
            let recipe_transform = motion_chunk_transform(
                motion.as_ref(),
                chunk,
                cursor,
                center_x,
                top,
                height,
                line_top,
                line_height,
            )
            .post_concat(recipe_transform);
            let clip_mask = caption_recipe_clip_mask(
                pixmap,
                cursor + part_dx,
                line_top + part_dy,
                chunk.width,
                line_height,
                visual.recipe.as_ref(),
                recipe_transform.post_concat(group_transform),
            );
            bounds.merge(draw_caption_recipe_decorations(
                pixmap,
                text_engine,
                layout,
                animation,
                &visual,
                chunk.word,
                cursor + part_dx,
                chunk.width,
                line_top + part_dy,
                line_height,
                chunk_opacity,
                group_transform,
            ));
            if let Some(plate) = caption_recipe_plate(
                layout,
                animation,
                &visual,
                chunk,
                cursor,
                line_top,
                line_height,
                part_opacity,
                part_dx,
                part_dy,
                bounce,
                &word_rects,
                pill_state.as_ref(),
                pill_groups.as_deref(),
            ) {
                bounds.merge(fill_round_rect(
                    pixmap,
                    plate.x,
                    plate.y,
                    plate.width,
                    plate.height,
                    plate.radius,
                    plate.color,
                    opacity * plate.opacity,
                    group_transform,
                ));
            } else if visual.recipe.is_none()
                && let Some(background) = visual.background
            {
                // The classic per-word animation (Highlight / Custom) has no recipe. Its backplate is a constant rectangle and does not go through the plate time channel. Its geometry follows the Studio `canvas-stage.jsx` highlight Rect field by field (0.14em outset on the left and right, 0.04em outset on top, 1.08em height, borderRadiusEm default 0.25), which corresponds to the `WordBox` of Mac `SubtitleFrameAttribution`. Geometry and alpha both go through `classic_word_box` / `classic_word_box_alpha`, sharing one definition with the GPU scene side. When there are `boxScale` / `boxOpacity` tracks, the block scales around the rectangle's centre. Its alpha is separate from the word's own opacity, because borrowing the word's opacity would fade the glyphs along with it.
                //
                // This branch must not be merged into the recipe branch above. When `visual.recipe` is absent, the plate channel has no value to read. Requiring the recipe to exist would stop Highlight's highlight block from being drawn at all.
                let box_rect = classic_word_box(
                    layout.style.font_size,
                    cursor,
                    chunk.width,
                    line_top,
                    line_height,
                    part_dx,
                    part_dy,
                    bounce,
                    &visual,
                );
                bounds.merge(fill_round_rect(
                    pixmap,
                    box_rect.x,
                    box_rect.y,
                    box_rect.width,
                    box_rect.height,
                    box_rect.radius,
                    background,
                    opacity * part_opacity * classic_word_box_alpha(&visual),
                    recipe_transform.post_concat(group_transform),
                ));
            }
            let replacement = visual
                .recipe
                .as_ref()
                .and_then(|state| state.text_swap.as_deref())
                .map(|text| {
                    text_engine.shape(text, &chunk.font_name, chunk.font_size, chunk.font_weight)
                });
            let shaped = replacement.as_ref().unwrap_or(&chunk.shaped);
            for (glyph_index, glyph) in shaped.glyphs.iter().enumerate() {
                let render = text_engine.glyph_render(glyph.cache_key);
                let glyph_x =
                    cursor + glyph.x + glyph_index as f64 * layout.style.letter_spacing + part_dx;
                let local = glyph_canvas_transform(
                    chunk,
                    glyph_x,
                    baseline + glyph.y + part_dy,
                    recipe_transform,
                    group_transform,
                );
                match render {
                    GlyphRender::Outline(path) => {
                        if animation.caption.is_some()
                            && let Some(state) = visual.recipe.as_ref()
                        {
                            if state.echo > 0.001 {
                                for duplicate in caption_recipe_glyph_duplicate_layers(
                                    layout,
                                    animation,
                                    &visual,
                                    chunk_opacity,
                                ) {
                                    let transform = Transform::from_translate(
                                        duplicate.dx as f32,
                                        duplicate.dy as f32,
                                    )
                                    .post_concat(local);
                                    pixmap.fill_path(
                                        &path,
                                        &caption_recipe_paint(
                                            animation,
                                            duplicate.color,
                                            duplicate.opacity,
                                        ),
                                        FillRule::Winding,
                                        transform,
                                        clip_mask.as_ref(),
                                    );
                                    bounds.add_filled(&path, transform);
                                }
                            }
                            if state.rgb_split > 0.001 {
                                for duplicate in caption_recipe_rgb_split_duplicate_layers(
                                    layout,
                                    animation,
                                    &visual,
                                    chunk_opacity,
                                ) {
                                    let split = Transform::from_translate(duplicate.dx as f32, 0.0)
                                        .post_concat(local);
                                    pixmap.fill_path(
                                        &path,
                                        &caption_recipe_paint(
                                            animation,
                                            duplicate.color,
                                            duplicate.opacity,
                                        ),
                                        FillRule::Winding,
                                        split,
                                        clip_mask.as_ref(),
                                    );
                                    bounds.add_filled(&path, split);
                                }
                            }
                            for recipe_stroke in caption_recipe_glyph_stroke_layers(
                                layout,
                                animation,
                                &visual,
                                chunk_opacity,
                                false,
                            ) {
                                let stroke = Stroke {
                                    width: recipe_stroke.width as f32,
                                    ..Stroke::default()
                                };
                                pixmap.stroke_path(
                                    &path,
                                    &caption_recipe_paint(
                                        animation,
                                        recipe_stroke.color,
                                        recipe_stroke.opacity,
                                    ),
                                    &stroke,
                                    local,
                                    clip_mask.as_ref(),
                                );
                                bounds.add_stroked(&path, local, stroke.width);
                            }
                        }
                        if layout.style.outline_on {
                            let stroke = Stroke {
                                // tiny-skia and Konva strokes are both centred across the outline. The persisted `textOutline.width` percentage describes the **visible outset**. `resolve_line_style` has already converted it into the full centred stroke width (w/100·fontSize·0.5), and that value is used directly here.
                                width: layout.style.outline_width as f32,
                                ..Stroke::default()
                            };
                            pixmap.stroke_path(
                                &path,
                                &caption_recipe_paint(
                                    animation,
                                    layout.style.outline_color,
                                    chunk_opacity,
                                ),
                                &stroke,
                                local,
                                clip_mask.as_ref(),
                            );
                            bounds.add_stroked(&path, local, stroke.width);
                        }
                        if let Some(fill) = caption_recipe_glyph_paint(
                            animation,
                            &visual,
                            visual.color.or(chunk.color).unwrap_or(layout.style.color),
                            chunk_opacity,
                            replacement.is_none(),
                        ) {
                            pixmap.fill_path(
                                &path,
                                &fill,
                                FillRule::Winding,
                                local,
                                clip_mask.as_ref(),
                            );
                            bounds.add_filled(&path, local);
                        }
                    }
                    GlyphRender::ColorBitmap {
                        width,
                        height,
                        rgba,
                        left,
                        top,
                    } => {
                        let bitmap = PixmapRef::from_bytes(&rgba, width, height)
                            .expect("colour glyph RGBA size was already validated by TextEngine");
                        // Bitmap glyphs take no part in stroking and do not take the text colour. The placement offset is in glyph-local space and must be applied beneath `local`, so that it follows group_transform (camera zoom, pop scale).
                        let placement =
                            Transform::from_translate(left as f32, -top as f32).post_concat(local);
                        pixmap.draw_pixmap(
                            0,
                            0,
                            bitmap,
                            &PixmapPaint {
                                opacity: chunk_opacity as f32,
                                quality: FilterQuality::Bilinear,
                                blend_mode: caption_recipe_blend_mode(animation),
                            },
                            placement,
                            clip_mask.as_ref(),
                        );
                        bounds.add_pixmap(width, height, placement);
                    }
                    GlyphRender::Empty => {}
                }
            }
            if visual.underline.unwrap_or(layout.style.underline) {
                let underline_offset = visual.underline_offset_em.unwrap_or(0.10);
                bounds.merge(fill_round_rect(
                    pixmap,
                    cursor + part_dx,
                    baseline + layout.style.font_size * underline_offset + part_dy,
                    chunk.width,
                    (layout.style.font_size * 0.06).max(1.0),
                    layout.style.font_size * 0.03,
                    visual.color.or(chunk.color).unwrap_or(layout.style.color),
                    chunk_opacity,
                    group_transform,
                ));
            }
            cursor += chunk.width;
        }
        line_top += line_height + line.gap_after;
    }
    bounds
}

pub fn chunk_part_delta(layout: &LineLayout, chunk: &GlyphChunk) -> (f64, f64, f64) {
    let Some(part) = chunk
        .part
        .and_then(|index| layout.animation_parts.get(index))
    else {
        return (1.0, 0.0, 0.0);
    };
    (
        part.opacity.clamp(0.0, 1.0),
        part.dx * layout.animation_short_edge,
        part.dy * layout.animation_short_edge,
    )
}

/// The canvas area that one subtitle draw lands on. It is a **superset** of the non-zero pixels.
///
/// Each draw takes the **path control-point box** (`Path::bounds()`, which is itself a superset of the curves), expands it by the stroke outset, maps it to canvas coordinates through the **exact same** transform used for drawing, and then takes the union. The tiny-skia blitter only writes the pixels it covers, so this union is necessarily a superset of the non-zero pixels. That satisfies the window contract of `alpha_bbox_within`, so computing the bounding box does not have to scan the whole 8.3 MB frame. (On a 1080p transparent overlay this was the biggest computational hotspot in export.)
///
/// Why not estimate with “line box plus a fixed margin”? `caption_recipe_transform` scales, rotates and translates individual words according to the recipe. Particles, emoji, echo, rgbSplit and glow strokes each have their own outset. Any fixed margin will under-estimate on some recipe, and under-estimating means clipping content. Following the actual strokes avoids that.
#[derive(Debug, Default, Clone, Copy)]
pub struct DrawBounds {
    /// `[left, top, right, bottom]`, in canvas coordinates. `None` = no stroke landed.
    pub rect: Option<[f64; 4]>,
    /// When a transform yields non-finite values or otherwise an unbounded result: fall back to the whole frame. Scanning too much is better than missing pixels.
    pub unbounded: bool,
}

impl DrawBounds {
    pub fn union(&mut self, left: f64, top: f64, right: f64, bottom: f64) {
        if !(left.is_finite() && top.is_finite() && right.is_finite() && bottom.is_finite()) {
            self.unbounded = true;
            return;
        }
        self.rect = Some(match self.rect {
            None => [left, top, right, bottom],
            Some([l, t, r, b]) => [l.min(left), t.min(top), r.max(right), b.max(bottom)],
        });
    }

    /// `expand` is the outset **in path space**. It passes through the transform along with the path.
    pub fn add_path(&mut self, path: &tiny_skia::Path, transform: Transform, expand: f64) {
        let bounds = path.bounds();
        let expand = expand.max(0.0) as f32;
        let Some(rect) = tiny_skia::Rect::from_ltrb(
            bounds.left() - expand,
            bounds.top() - expand,
            bounds.right() + expand,
            bounds.bottom() + expand,
        ) else {
            self.unbounded = true;
            return;
        };
        let Some(mapped) = rect.transform(transform) else {
            self.unbounded = true;
            return;
        };
        self.union(
            f64::from(mapped.left()),
            f64::from(mapped.top()),
            f64::from(mapped.right()),
            f64::from(mapped.bottom()),
        );
    }

    pub fn add_filled(&mut self, path: &tiny_skia::Path, transform: Transform) {
        self.add_path(path, transform, 0.0);
    }

    /// Stroke: a miter join pushes the outline out to at most `miter_limit × width / 2`. tiny-skia's default `miter_limit` is 4, so `2 × width` is a safe upper bound.
    pub fn add_stroked(&mut self, path: &tiny_skia::Path, transform: Transform, stroke_width: f32) {
        self.add_path(path, transform, f64::from(stroke_width.max(0.0)) * 2.0);
    }

    pub fn add_pixmap(&mut self, width: u32, height: u32, transform: Transform) {
        let Some(rect) = tiny_skia::Rect::from_ltrb(0.0, 0.0, width as f32, height as f32) else {
            self.unbounded = true;
            return;
        };
        let Some(mapped) = rect.transform(transform) else {
            self.unbounded = true;
            return;
        };
        self.union(
            f64::from(mapped.left()),
            f64::from(mapped.top()),
            f64::from(mapped.right()),
            f64::from(mapped.bottom()),
        );
    }

    pub fn merge(&mut self, other: Self) {
        self.unbounded |= other.unbounded;
        if let Some([l, t, r, b]) = other.rect {
            self.union(l, t, r, b);
        }
    }

    /// Merges in an already-finalized integer bounding box, such as the one that results when an effect layer is blurred and composited in.
    pub fn merge_content_box(&mut self, bounds: &ContentBox) {
        self.union(
            bounds.cols.start as f64,
            bounds.rows.start as f64,
            bounds.cols.end as f64,
            bounds.rows.end as f64,
        );
    }

    /// Collapses to an integer window inside the canvas, padded by 1px outward on each side, because anti-aliasing bleeds onto neighbouring pixels. `None` = no stroke landed, so the caller can conclude the whole frame is transparent.
    pub fn window(self, width: usize, height: usize) -> Option<ContentBox> {
        if self.unbounded {
            return Some(ContentBox {
                rows: 0..height,
                cols: 0..width,
            });
        }
        let [left, top, right, bottom] = self.rect?;
        let clamp_axis = |value: f64, limit: usize| value.clamp(0.0, limit as f64) as usize;
        let cols = clamp_axis(left.floor() - 1.0, width)..clamp_axis(right.ceil() + 1.0, width);
        let rows = clamp_axis(top.floor() - 1.0, height)..clamp_axis(bottom.ceil() + 1.0, height);
        (!rows.is_empty() && !cols.is_empty()).then_some(ContentBox { rows, cols })
    }
}

/// Integer source-over for premultiplied RGBA (implemented in `render_raster::effects`).
pub fn composite_premultiplied_rgba(
    destination: &mut [u8],
    source: &[u8],
    width: usize,
    bounds: &ContentBox,
) {
    render_raster::effects::composite_premultiplied_rgba(destination, source, width, bounds);
}

/// Clears the pixels covered by `bounds` to zero (for buffer reuse).
pub fn clear_content_box(data: &mut [u8], width: usize, bounds: &ContentBox) {
    render_raster::effects::clear_content_box(data, width, bounds);
}

/// Box blur confined to the neighbourhood of the non-zero content bounding box. The output is byte-for-byte identical to a full-frame blur.
pub fn box_blur_rgba_content(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: usize,
) -> Option<ContentBox> {
    render_raster::effects::box_blur_content(data, width, height, radius)
}

/// The known-bounding-box version of [`box_blur_rgba_content`].
pub fn box_blur_rgba_bounded(
    data: &mut [u8],
    width: u32,
    height: u32,
    radius: usize,
    content: &ContentBox,
) -> ContentBox {
    render_raster::effects::box_blur_bounded(data, width, height, radius, content)
}

/// The structural upper bound on the blur radius (the same-named constant in `render_raster::effects`).
#[allow(dead_code)]
pub const MAX_BLUR_RADIUS: usize = render_raster::effects::MAX_BLUR_RADIUS;

/// A single-pass separable box blur over a whole premultiplied RGBA frame.
pub fn box_blur_rgba(data: &mut [u8], width: u32, height: u32, radius: usize) {
    render_raster::effects::box_blur_premul_u8(data, width, height, radius);
}

/// Proportionally downsamples to `width × height` (shrinks only, never enlarges).
///
/// First halve repeatedly by 2×2 averaging, then do one final bilinear step. A single bilinear step of 2.5× would take only four source pixels for each target pixel, and thin strokes such as line art would fall entirely into the sampling gaps and disappear. Averaging in the halving step on premultiplied RGBA is correct. The premultiplied value is already “colour × coverage”, so the average is area-weighted.
pub fn downscaled_pixmap(source: &Pixmap, width: u32, height: u32) -> Pixmap {
    let width = width.max(1);
    let height = height.max(1);
    let mut current = None::<Pixmap>;
    loop {
        let stage = current.as_ref().unwrap_or(source);
        if stage.width() / 2 < width.max(1) || stage.height() / 2 < height.max(1) {
            break;
        }
        let Some(halved) = halve_pixmap(stage) else {
            break;
        };
        current = Some(halved);
    }
    let stage = current.as_ref().unwrap_or(source);
    if (stage.width(), stage.height()) == (width, height) {
        return stage.clone();
    }
    let mut destination = match Pixmap::new(width, height) {
        Some(destination) => destination,
        None => return stage.clone(),
    };
    draw_fit_pixmap(&mut destination, stage, Fit::Contain, 1.0);
    destination
}

/// 2×2 averaging halving. For odd edges, the last row or column is truncated by integer division. The next bilinear round restores the exact size.
fn halve_pixmap(source: &Pixmap) -> Option<Pixmap> {
    let width = source.width() / 2;
    let height = source.height() / 2;
    if width == 0 || height == 0 {
        return None;
    }
    let mut destination = Pixmap::new(width, height)?;
    let source_width = source.width() as usize;
    let source_data = source.data();
    let destination_data = destination.data_mut();
    for y in 0..height as usize {
        let top = (y * 2) * source_width * 4;
        let bottom = top + source_width * 4;
        for x in 0..width as usize {
            let left = x * 8;
            let out = (y * width as usize + x) * 4;
            for channel in 0..4 {
                let sum = u32::from(source_data[top + left + channel])
                    + u32::from(source_data[top + left + 4 + channel])
                    + u32::from(source_data[bottom + left + channel])
                    + u32::from(source_data[bottom + left + 4 + channel]);
                destination_data[out + channel] = ((sum + 2) / 4) as u8;
            }
        }
    }
    Some(destination)
}

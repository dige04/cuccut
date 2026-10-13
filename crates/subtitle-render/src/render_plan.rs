/// Which categories of overlay content to keep for one burn-in. The semantics are aligned entry by entry with `include_element` in `ccut-editable` (see `core/crates/ccut-editable/src/builder.rs`): the editable project export and the video burn-in must produce the same set of elements for the same `--no-*` combination, otherwise “preview first, then export the project” would show two different pieces of content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OverlayIncludes {
    pub subtitles: bool,
    pub texts: bool,
    pub media_overlays: bool,
    pub watermarks: bool,
}

impl OverlayIncludes {
    /// Keep everything. Used by preview, unit tests, and exports that do not specify any `--no-*`.
    pub const ALL: Self = Self {
        subtitles: true,
        texts: true,
        media_overlays: true,
        watermarks: true,
    };

    /// Same shape as `ccut-editable::builder::include_element`: the watermark role is checked before the kind, but it short-circuits only when the watermark is excluded; otherwise it still goes through the kind check.
    pub fn allows(self, element: &Element) -> bool {
        if element.role == Some(ElementRole::Watermark) && !self.watermarks {
            return false;
        }
        match element.kind {
            ElementKind::Text => self.texts,
            // Overlay layers carry no audio: the audio track is pre-mixed into the source media by timeline_media.
            ElementKind::Audio => false,
            ElementKind::Image | ElementKind::Video | ElementKind::Whiteboard => {
                self.media_overlays
            }
            // The four elements promoted to formal status in 0.2 have **no corresponding `--no-*` switch**: `--no-texts` covers “plain text elements” and `--no-broll` covers “B-roll images/videos”. Putting shapes or waveforms into either category would make that switch name misleading. Whether to give them a switch is a product decision, not something this stage can quietly make for the user (a new switch would also change the CLI contract and trigger the sync hard rule in `docs/design/cli/ccut-cli-server-reference.md`).
            ElementKind::Shape
            | ElementKind::Sticker
            | ElementKind::Visualizer
            | ElementKind::Progress
            | ElementKind::Confetti
            | ElementKind::Draw
            | ElementKind::Placeholder => true,
        }
    }

    /// One segment of the frame-cache key: the same document renders different pixels under different `--no-*` combinations.
    pub fn key(self) -> String {
        [
            self.subtitles,
            self.texts,
            self.media_overlays,
            self.watermarks,
        ]
        .map(|on| if on { '1' } else { '0' })
        .iter()
        .collect()
    }
}

impl Default for OverlayIncludes {
    fn default() -> Self {
        Self::ALL
    }
}

#[cfg(feature = "host")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TimelineMediaFailurePolicy {
    /// CLI/export: missing or corrupt media must fail. It must not silently deliver a video with a missing layer.
    Strict,
    /// App live preview: skip the elements that correspond to bad media, so the text and vectors on the same overlay are preserved.
    SkipFailedElement,
}

pub fn item_text_is_filled(item: &Value, key: &str) -> bool {
    item.get(key)
        .and_then(Value::as_str)
        .is_some_and(|text| !text.trim().is_empty())
}

pub fn same_projected_scope(left: &Value, right: &Value) -> bool {
    left.get("sourceId").and_then(Value::as_str) == right.get("sourceId").and_then(Value::as_str)
        && left.get("clipId").and_then(Value::as_str) == right.get("clipId").and_then(Value::as_str)
}

pub fn source_item_id(item: &Value) -> Option<&str> {
    item.get("sourceItemId")
        .or_else(|| item.get("id"))
        .and_then(Value::as_str)
}

/// The “look” of the original-text line: per-word animation and the recipe constants derived from it. One per track
/// ([`OverlayRenderPlan::track_look`]), and one for each subtitle that has per-item styling.
#[derive(Debug, Clone)]
pub struct CaptionLook {
    pub animation: Arc<WordAnimation>,
    pub descriptor: Option<&'static CaptionRecipeDescriptor>,
    /// Whether the style carries a Designed Caption.
    pub designed: bool,
    /// Whether the classic per-word highlight block carries a non-constant timing track.
    pub word_box_animated: bool,
    pub composite: CaptionCompositeMode,
    /// Whether the recipe requires the whole group to be centered.
    pub centered: bool,
    /// Cross-sentence sequence recipe (Daoyazi, 倒鸭子): original-text lines do not go through cue-level layout; the whole track is taken over by `CaptionSequencePlan`.
    pub sequence: bool,
}

impl CaptionLook {
    /// `merged_original` is `merged_line_style(root, Original)`.
    pub fn of(merged_original: &Value) -> Self {
        let animation = Arc::new(word_animation(merged_original));
        let descriptor = animation
            .caption
            .as_ref()
            .and_then(caption_recipe_design_descriptor);
        let designed = merged_original
            .pointer("/wordAnimation/caption")
            .is_some_and(Value::is_object);
        let word_box_animated = animation.motion_id.is_some()
            || animation
                .box_track
                .as_ref()
                .is_some_and(WordBoxTrack::is_animated);
        let composite = caption_recipe_composite_mode(&animation);
        let centered = descriptor.is_some_and(|descriptor| {
            matches!(descriptor.layout.as_str(), "fullScreenWord" | "centerBand")
        });
        Self {
            animation,
            descriptor,
            designed,
            word_box_animated,
            composite,
            centered,
            sequence: descriptor.is_some_and(CaptionRecipeDescriptor::is_sequence),
        }
    }
}

/// The per-item style of one subtitle, resolved at compile time: the root style with the override table applied, the line style, and the original-text look.
#[derive(Debug, Clone)]
pub struct CueOverride {
    pub root: Value,
    pub style: LineStyle,
    pub look: CaptionLook,
}

pub fn translation_inputs<'a>(
    document: &'a Value,
    target_language: &'a str,
) -> Vec<TimedInput<'a>> {
    let trans_cues = document["transCues"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let sentences = document["sentences"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let mut inputs = trans_cues
        .iter()
        .filter(|item| item_text_is_filled(item, "text"))
        .map(|item| TimedInput {
            item,
            text_key: "text",
            language: target_language,
        })
        .collect::<Vec<_>>();

    // A projection can contain aligned translation cues for some sentences and
    // sentence-level translations for others. Keep both instead of treating a
    // single transCue as proof that every sentence has an aligned row.
    inputs.extend(sentences.iter().filter_map(|sentence| {
        if !item_text_is_filled(sentence, "trans") {
            return None;
        }
        let sentence_id = source_item_id(sentence)?;
        let has_cue = trans_cues.iter().any(|cue| {
            item_text_is_filled(cue, "text")
                && cue.get("sid").and_then(Value::as_str) == Some(sentence_id)
                && same_projected_scope(cue, sentence)
        });
        (!has_cue).then_some(TimedInput {
            item: sentence,
            text_key: "trans",
            language: target_language,
        })
    }));
    inputs
}

/// Whether this sentence already has a usable translation in the current projection: either the aligned `transCue` matches, or the sentence-level `trans` is non-empty.
///
/// Sentences judged “untranslated” are left blank directly in translation mode: no drawing input is laid out for them, and no background box is drawn. The translation coverage in the export envelope uses this same criterion. The blank space on screen and the missing-translation count in the envelope must come from the same judgment; otherwise the user neither sees the translation nor knows how many sentences are missing.
pub fn sentence_is_translated(sentence: &Value, sentence_id: &str, trans_cues: &[Value]) -> bool {
    item_text_is_filled(sentence, "trans")
        || trans_cues.iter().any(|cue| {
            item_text_is_filled(cue, "text")
                && cue.get("sid").and_then(Value::as_str) == Some(sentence_id)
                && same_projected_scope(cue, sentence)
        })
}

/// The sentence-level translation coverage `(translated, sentences counted)` of the current projection.
///
/// The difference is the number of sentences that will be left blank in translation mode. The “this sentence suddenly has no subtitle” that the user sees is exactly this.
/// Sentences without an id are not counted in the denominator, consistent with the sampling on the burn-in side.
///
/// The argument must be a document that has already been projected through the timeline (the output of `overlay_document_with_live_timeline`). An unprojected top-level body mirrors only the main media and includes clipped-out sentences, so the count would not match what actually appears in the finished video.
pub fn sentence_translation_coverage(document: &Value) -> (usize, usize) {
    let sentences = document["sentences"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let trans_cues = document["transCues"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    let mut translated = 0_usize;
    let mut total = 0_usize;
    for sentence in sentences {
        let Some(sentence_id) = source_item_id(sentence) else {
            continue;
        };
        total += 1;
        if sentence_is_translated(sentence, sentence_id, trans_cues) {
            translated += 1;
        }
    }
    (translated, total)
}

/// The display mode that this burn-in actually takes effect with. **The only** mode criterion on the burn-in side.
///
/// - If `--mode` is given, it decides (an invalid string → `Err`).
/// - When it is omitted, the mode is derived from the **effective** subtitle track set ([`effective_mode`]: read with migration first, then skip `hidden`). Exports without `--mode` still burn in the translation according to the tracks placed on the timeline.
/// - If the effective track set is empty (all subtitle tracks are turned off) → `Ok(None)`, meaning no subtitle is burned in at all this time, equivalent to `--no-subs`.
///
/// Note the division of labor with [`StudioMode::of_style`]: that one reads the mode the document **declares** (used by the style panel, track headers, and write-path canonicalization). This one reads **what will actually appear on screen**.
fn burn_in_mode(document: &Value, mode_override: Option<&str>) -> Result<Option<StudioMode>> {
    match mode_override {
        Some(value) => Ok(Some(
            StudioMode::parse(value).ok_or_else(|| anyhow!("未知字幕显示模式：{value}"))?,
        )),
        None => Ok(effective_mode(
            document.get("style").unwrap_or(&Value::Null),
        )),
    }
}

/// Whether this burn-in will lay out a translation track, and in which mode. `None` means original-text mode, an invalid mode string (which [`OverlayRenderPlan::compile`] reports as an error), or all subtitle tracks turned off; in that last case “missing translation” does not apply. See [`burn_in_mode`] for the criterion.
pub fn translation_burn_in_mode(
    document: &Value,
    mode_override: Option<&str>,
) -> Option<&'static str> {
    match burn_in_mode(document, mode_override).ok().flatten()? {
        StudioMode::Original => None,
        StudioMode::Translated => Some("translated"),
        StudioMode::Bilingual => Some("bilingual"),
    }
}

/// MP4 subtitles must cover the full set of built-in fonts that the Mac style panel actually offers, not just the five options of the old Web Studio. The standalone CLI embeds the fonts. The App-only package reads the bytes from the same set of signed resources, so the two paths keep exactly the same order and content.
#[cfg(feature = "host")]
pub fn bundled_studio_fonts() -> Vec<Vec<u8>> {
    // The bytes all live in ccut-render (`include_bytes!` appears only there). BCF document rendering uses the same copy when looking fonts up by name, so Source Han Sans and the display fonts are not stored twice in the binary.
    std::iter::once(render_raster::fonts::cjk_fallback_font())
        .chain(render_raster::fonts::bundled_display_fonts().iter().copied())
        .map(<[u8]>::to_vec)
        .collect()
}

/// CucCut's “imported fonts”: injected by the host through [`crate::host::FontSource`] (proposal §5.2). The render core no longer locates the config root itself. Resolving `<config_root>/fonts` belongs to the host, and the implementation lives in `ccut_workspace::timeline::overlay`. The CLI, `ccut serve`, and App v2 all get the same set through one `register`.
///
/// The record filter criterion (only bare filenames that the registry explicitly claims) still lives in [`font_library_fonts_at`]; host implementations call it directly.
#[cfg(feature = "host")]
pub fn cuccut_library_fonts() -> Vec<Vec<u8>> {
    crate::host::extra_fonts()
}

#[cfg(feature = "host")]
pub fn font_library_fonts_at(directory: &Path) -> Vec<Vec<u8>> {
    let Ok(registry) = fs::read(directory.join("library.json")) else {
        return Vec::new();
    };
    let Ok(records) = serde_json::from_slice::<Vec<Value>>(&registry) else {
        return Vec::new();
    };
    let mut files = records
        .iter()
        .filter_map(|record| record.get("file").and_then(Value::as_str))
        .filter_map(|file| {
            let relative = Path::new(file);
            let is_bare = relative.file_name().and_then(|name| name.to_str()) == Some(file);
            let supported = relative
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    matches!(
                        extension.to_ascii_lowercase().as_str(),
                        "ttf" | "otf" | "ttc" | "otc"
                    )
                });
            (is_bare && supported).then(|| directory.join(relative))
        })
        .collect::<Vec<_>>();
    files.sort();
    files.dedup();
    files
        .into_iter()
        .filter_map(|path| fs::read(path).ok())
        .collect()
}

/// `visualizer.audio` → media source id.
///
/// `"project"` is the way of writing “the whole output audio track”, which maps to the `main` source on media. It uses the same conversion as the render fingerprint in `serve` (`jobs_history::visualizer_spectrum_hashes`). If the two ever diverge, you get “the fingerprint says nothing changed, but the picture has changed”.
///
/// The implementation lives in `ccut-timeline-render` (moved down in P6a). The wasm preview takes the spectrum with this same conversion, so “preview = export” holds.
pub fn visualizer_audio_source(props: &VisualizerProps) -> String {
    element_draw::visualizer_audio_source(props)
}

/// `TimelineVisualElement` → borrowed view for the lower layer.
///
/// The local element table has more fields than drawing needs (media, text, effects, animation, …). Drawing reads only the fields in the contract. The view narrows this boundary to one place.
pub fn element_view(element: &TimelineVisualElement) -> element_draw::ElementDraw<'_> {
    element_draw::ElementDraw {
        id: &element.id,
        kind: element.kind,
        start: element.start,
        end: element.end,
        place: &element.place,
        shape: element.shape.as_ref(),
        sticker: element.sticker.as_ref(),
        visualizer: element.visualizer.as_ref(),
        progress: element.progress.as_ref(),
        draw: element.draw.as_ref(),
        placeholder: element.placeholder.as_ref(),
        confetti: element.confetti.as_ref(),
        whiteboard: element.whiteboard.as_ref(),
        has_source: element.src_id.is_some(),
    }
}

/// The single criterion for the rule “rasterize at the size it actually occupies on screen”: `ratio` = screen size ÷ natural size. Returns the target pixels to use (`None` = use the natural size).
///
/// Only give a target when it **saves** work. Never upscale: vector upscaling looks clearer, but that is a separate matter and would change the pixels of existing outputs. Also skip it if the saving is less than one tenth (not worth an extra rasterization pass).
fn shrink_target_px(natural_width: u32, natural_height: u32, ratio: f64) -> Option<(u32, u32)> {
    /// Minimum pixel size for a target: an image that is too small is not worth rendering into a blur just to save a few microseconds.
    const MIN_EDGE: f64 = 16.0;
    /// If the saving does not reach this ratio, use the natural size.
    const WORTH_IT: f64 = 0.9;

    if !(ratio > 0.0) || ratio >= WORTH_IT {
        return None;
    }
    let width = (f64::from(natural_width) * ratio).round().max(MIN_EDGE);
    let height = (f64::from(natural_height) * ratio).round().max(MIN_EDGE);
    let target = (width as u32, height as u32);
    (target != (natural_width, natural_height)).then_some(target)
}

/// Pure geometry probe → how many pixels this external texture actually occupies on the canvas (proportional; `None` = use the natural size).
///
/// The `transform` on a node includes `place.scale` and the scaling from the animation pose, so motion such as bounce or a scale-up entrance is not rasterized blurry from its static size. For the criterion itself, see [`shrink_target_px`].
#[cfg(feature = "host")]
fn scene_texture_target_px(
    nodes: &[element_draw::SceneNode],
    natural_width: u32,
    natural_height: u32,
) -> Option<(u32, u32)> {
    fn scan(nodes: &[element_draw::SceneNode], width: u32, height: u32, best: &mut f64) {
        for node in nodes {
            match node {
                element_draw::SceneNode::Texture(texture) => {
                    let matrix = texture.transform;
                    let scale_x = f64::from(matrix[0]).hypot(f64::from(matrix[1]));
                    let scale_y = f64::from(matrix[2]).hypot(f64::from(matrix[3]));
                    let ratio = (f64::from(texture.rect[2]) * scale_x / f64::from(width.max(1)))
                        .max(f64::from(texture.rect[3]) * scale_y / f64::from(height.max(1)));
                    if ratio.is_finite() {
                        *best = best.max(ratio);
                    }
                }
                element_draw::SceneNode::BlurredGroup(group) => {
                    scan(&group.nodes, width, height, best);
                }
                _ => {}
            }
        }
    }

    let mut ratio = 0.0f64;
    scan(nodes, natural_width, natural_height, &mut ratio);
    shrink_target_px(natural_width, natural_height, ratio)
}

/// Native-export external media element → R3's frozen renderer-neutral texture view. `texture` is the element-level slot within this plan and is not the project `srcId`. The same video source can be sampled by two elements at different `srcStart/rate` at the same time, and the two must not compete for one texture.
#[cfg(feature = "host")]
fn external_media_view<'a>(
    element: &'a TimelineVisualElement,
    texture: &'a str,
    time: f64,
) -> element_draw::ExternalMediaElement<'a> {
    element_draw::ExternalMediaElement {
        id: &element.id,
        kind: element.kind,
        texture: Some(texture),
        place: &element.place,
        mode: element.mode,
        fit: element.fit,
        background: element.bg,
        tile: element.tile.as_ref(),
        mask: element.mask.as_ref(),
        fx: element.fx.as_ref(),
        sticker: element.sticker.as_ref(),
        transition: element
            .transitions
            .as_ref()
            .map(|v| v.sample(time - element.start, element.end - element.start))
            .unwrap_or_default(),
    }
}

/// Read the BCS1 cache of a source in the project. **If it is missing, report an error. Do not generate it on the caller's behalf, and do not silently produce an empty image.**
///
/// Path resolution is character-for-character identical to `ccut spectrum`, `GET /__ccut/spectrum`, and the render fingerprint (`paths::project_media_path` + `paths::spectrum_cache_path`). A different resolution would compute a different cache filename, and that is how “the command just generated it, but export says it cannot be found” happens.
#[cfg(feature = "host")]
pub fn read_project_spectrum(project: &Path, source_id: &str, element_id: &str) -> Result<Vec<u8>> {
    let hint = format!(
        "先运行 `ccut spectrum {} --src {source_id}` 生成频谱缓存",
        project.display()
    );
    let media = crate::paths::project_media_path(project, source_id)
        .with_context(|| format!("元素 {element_id} 的音频源 {source_id} 找不到媒体；{hint}"))?;
    let path = crate::paths::spectrum_cache_path(project, &media)
        .with_context(|| format!("元素 {element_id} 的频谱缓存路径无法确定；{hint}"))?;
    let bytes = fs::read(&path).map_err(|error| {
        anyhow!(
            "元素 {element_id} 需要音频源 {source_id} 的 BCS1 频谱，但 {} 不可读（{error}）；{hint}",
            path.display()
        )
    })?;
    // Validate once up front: a bad cache should be explained at preflight, naming which element and which source.
    waveform::bcs1::parse(&bytes).with_context(|| {
        format!(
            "元素 {element_id} 的频谱缓存 {} 无效；{hint}",
            path.display()
        )
    })?;
    Ok(bytes)
}

// ── Template layer ──────────────────────────────────────────────────────────────

/// The template layer applied to the project (`template` in `timeline.json`). Each frame, [`crate::template_layer::raster`] draws it directly into a transparent-background Pixmap of the same size as the canvas. It is then merged into the overlay's instruction stream in the **same form as the subtitle layer** (a dynamic resource plus one `DrawMedia`). Whether the scene identity ([`element_draw::SceneFrame::fingerprint`]) needs to be computed depends on the caller.
///
/// Almost all of the cost of computing it lies in FNV-1a over the **whole decoded frame's pixels**. Each timeline media element has to pass its own RGBA through this every frame (measured at 3.3 ms/frame at 720p, 23% of the GPU export's “subtitle compositing”), and the template chrome is the same.
///
/// And this identity has only one production consumer: the macOS GPU preview uses it to de-duplicate overlay presentation (`gpu_presentation_fingerprint` in `apps/cuccut/src/engine/overlay.rs`). The offline export path reads only `next_change`, for its scene-cache window, and never reads `fingerprint`.
///
/// The preview path cannot afford pixel hashing either. A 1080p source frame is 8.3 MB and 4K is 33 MB. The template chrome must additionally be hashed at the **canvas** size (5K full screen ≈ 42 MB). Measured on the overlay thread, this took 79% of CPU during playback. De-duplication only needs to know “is this the same texture”, and within the same `MediaStore`, `(source id, media clock)` alone uniquely determines the decode result. So [`Self::Structural`] uses that as a pixel proxy and hashes only a few dozen bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SceneIdentity {
    /// Computed as usual, with pixels going into the identity byte for byte. The wasm and test paths use this tier, where `fingerprint` is available.
    Full,
    /// Structural identity: node geometry, sampling clock, and effects are still frozen field by field as before. The pixel bits are replaced by `(texture key, the source id that actually fetches the frame, media_ms, source size)`. Template chrome uses `(chrome fingerprint, canvas size, body font)`. Within the same plan it is equivalent to [`Self::Full`] and can be used for de-duplication. It **cannot** be used to compare pixels across plans or across processes. The macOS GPU preview uses this tier.
    Structural,
    /// Skips the whole-frame pixel hash; `fingerprint` is always `0`. **Must not** be used for de-duplication or comparison any more.
    Skip,
}

/// How the resource name of each frame's dynamic raster (text, media elements, subtitle layer) is taken in the DrawOp instruction stream.
///
/// The dynamic table is cleared before each frame is assembled, so a resource name only needs to be unique **within that frame**. Putting the pixel fingerprint into the name makes content changes enter `draw_op_fingerprint`, which preview de-duplication and cross-engine comparison need. Hosts that do not read this fingerprint (frame-render's export and preview) cannot afford a per-frame hash of the whole decoded frame's pixels (8.3 MB per 1080p frame), so they use [`Self::Slot`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DynamicAssetNames {
    /// `kind:owner:pixel-fingerprint`: when the content changes, the instruction stream changes. This is the default; other hosts and tests use this tier.
    #[default]
    PixelFingerprint,
    /// `kind:owner#sequence`: only guarantees uniqueness within the same frame and does not hash pixels. `draw_op_fingerprint` no longer reflects the content of dynamic rasters, so it **must not** be used for de-duplication or comparison.
    Slot,
}

/// The template foreground is always above the main picture, the subtitles, and the elements.
///
/// Both features share this: the scene itself does no I/O. `host` is loaded by [`crate::host::OverlayHost::template_scene`], and the browser and App preview inject it via [`OverlayRenderPlan::set_template_scene`].
pub struct TemplateLayer {
    /// Scene content fingerprint (changes whenever the document, chapters, title, or logo pixels change).
    pub fingerprint: u64,
    pub scene: TemplateScene,
}

impl TemplateLayer {
    pub fn new(scene: TemplateScene) -> Self {
        Self {
            fingerprint: scene.fingerprint,
            scene,
        }
    }

    /// The template layer has no time interval: once applied, it is present for the whole timeline.
    pub fn active(&self, _time: f64) -> bool {
        true
    }

    /// A **conservative upper bound** on the next content change. The chapter bar and the progress line move every frame, and the kernel cannot determine that statically, so it always falls back to “the next frame”. The cost is that the export's `ensure_composited` cache is invalidated in template projects. Wire it correctly first; performance comes later.
    fn next_change(&self, time: f64, fps: f64) -> Option<f64> {
        Some(time + 1.0 / fps.max(1.0))
    }

    /// Gets one frame of template pixels (premultiplied RGBA, transparent background), drawn directly at the overlay canvas size.
    fn frame(
        &self,
        time: f64,
        duration: f64,
        width: u32,
        height: u32,
        fallback_family: &str,
        text: &mut TextEngine,
    ) -> Result<Pixmap> {
        crate::template_layer::raster(
            &self.scene,
            crate::template_layer::FrameParams {
                time,
                duration,
                width,
                height,
                fallback_family,
            },
            text,
            false,
        )
        .context("渲染模板层")
    }
}

/// Paint the plate described by one line layout. `block` is a single rectangle;
/// `wrap` clones the plate for every visual line, matching CSS
/// `box-decoration-break: clone` without moving text layout.
#[derive(Debug, Clone, Copy, PartialEq)]
struct SubtitlePlateRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct SubtitlePlate {
    rect: SubtitlePlateRect,
    color: SubtitleColor,
    motion_line: Option<usize>,
}

fn line_background_rects(layout: &LineLayout, center_x: f64, top: f64) -> Vec<SubtitlePlateRect> {
    let style = &layout.style;
    if style.block_background || layout.lines.len() <= 1 {
        let width = (layout.width + style.background_pad_h * 2.0).max(style.background_min_width);
        return vec![SubtitlePlateRect {
            x: line_start_x(layout, layout.width, center_x) - (width - layout.width) / 2.0,
            y: top - style.background_pad_v,
            width,
            height: layout.height + style.background_pad_v * 2.0,
            radius: style.background_radius,
        }];
    }

    let mut rects = Vec::with_capacity(layout.lines.len());
    let mut line_top = top;
    for line in layout.lines.iter() {
        let line_height = line.height.max(style.font_size * style.line_height);
        rects.push(SubtitlePlateRect {
            x: line_start_x(layout, line.width, center_x) - style.background_pad_h,
            y: line_top - style.background_pad_v,
            width: line.width + style.background_pad_h * 2.0,
            height: line_height + style.background_pad_v * 2.0,
            radius: style.background_radius,
        });
        line_top += line_height + line.gap_after;
    }
    rects
}

fn draw_line_background(
    pixmap: &mut Pixmap,
    layout: &LineLayout,
    center_x: f64,
    top: f64,
    opacity: f64,
    transform: Transform,
) -> DrawBounds {
    let mut bounds = DrawBounds::default();
    for rect in line_background_rects(layout, center_x, top) {
        bounds.merge(fill_round_rect(
            pixmap,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            rect.radius,
            layout.style.background_color,
            opacity,
            transform,
        ));
    }
    bounds
}

/// The resource name of the current frame's dynamic raster. `owner` only distinguishes the asset slots within the same frame. The pixel fingerprint makes content changes enter the DrawOp instruction stream.
///
/// Do not concatenate [`OverlayRenderPlan::definition_key`] into this. The dynamic table is cleared before each frame is assembled, the subtitle has only one fixed slot, and timeline element ids are guaranteed unique by document validation. So the plan cache key does not take part in the uniqueness of resource lookup. Encoding it into the resource name would only let render-irrelevant document schema changes pollute `draw_op_fingerprint`.
fn dynamic_raster_asset_name(kind: &str, owner: &str, rgba: &[u8]) -> String {
    let pixel_fingerprint = render_raster::drawop::fnv1a64(rgba);
    format!("{kind}:{owner}:{pixel_fingerprint:016x}")
}

/// Timeline's historical `SourceKind::Image` accepts both PNG/JPEG and GIF/APNG/animated WebP. It first tries animated decoding by the container bytes, and falls back to static decoding for static PNG/WebP. This way the persisted Timeline 0.3 format does not need rewriting, and old projects and new imports both restore animated pictures directly.
/// The key in the raster cache for a “material sticker + recolor table”.
///
/// The raster cache (`LoadedAssets.images`) was originally keyed by source id. But `sticker.fillOverrides` is **per element**: when the same SVG is referenced by two stickers with two different override tables, the picture must be two different images. So the recolored bitmap is stored under a separate id keyed by `(source, override table)`, and when a frame is fetched it is looked up with the same key. Both places must call this one function. Otherwise “preloaded but not retrievable” would silently fall back to the original color, which is exactly the symptom the user reported on 2026-09-08.
pub fn sticker_fill_variant_id(
    source_id: &str,
    overrides: &std::collections::BTreeMap<String, String>,
) -> String {
    let mut canonical = String::new();
    for (source, target) in overrides {
        canonical.push_str(source);
        canonical.push('>');
        canonical.push_str(target);
        canonical.push(';');
    }
    format!(
        "{source_id}#fill:{:016x}",
        render_raster::drawop::fnv1a64(canonical.as_bytes())
    )
}

/// Which decoder a Timeline source should use. This is decided jointly by the kind of the element that references it and the kind the source declares about itself (see the normalization in `load_timeline_media`).
#[cfg(feature = "host")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TimelineSourceDecoder {
    Image,
    Video,
    /// Timeline 0.7 `sources[].kind: "lottie"` (bodymovin JSON). Referenced only by material stickers.
    Lottie,
    /// The element does not reference a media source (text / shape / visualizer …).
    None,
}

/// Loads a Lottie source (Timeline 0.7): parse → collect and read sub-resources (embedded, or relative to the JSON's directory) → optional recolor → prepare / probe → archive under `source_id` in `assets.lotties`. This is the same order as the Lottie branch in BCF's `assets.rs`, and there is no I/O at render time.
///
/// When `overrides` is non-empty, this is a recolored variant (the caller passes `sticker_fill_variant_id` as the `source_id`). Sub-resources are still archived under the variant id, so the two Lotties do not share pixel tables.
#[cfg(feature = "host")]
fn load_timeline_lottie_source(
    assets: &mut LoadedAssets,
    source_id: &str,
    path: &Path,
    bytes: &[u8],
    overrides: Option<&std::collections::BTreeMap<String, String>>,
) -> Result<()> {
    use render_raster::source::{Lottie, PrepareCtx, VisualSource};
    let label = path.to_string_lossy();
    let mut lottie = Lottie::parse(source_id, &label, bytes)
        .with_context(|| format!("lottie source {source_id} 解析失败"))?;
    let lottie_dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    let mut loaded = Vec::new();
    for requirement in lottie.image_requirements().to_vec() {
        let (bytes, label) = match (&requirement.embedded, &requirement.path) {
            (Some(inline), _) => (inline.clone(), format!("<内嵌 {}>", requirement.id)),
            (None, Some(relative)) => {
                let child = lottie_dir.join(relative);
                let bytes = fs::read(&child).with_context(|| {
                    format!(
                        "lottie source {source_id}：读子资源 {} 失败",
                        child.display()
                    )
                })?;
                (bytes, child.display().to_string())
            }
            (None, None) => bail!(
                "lottie source {source_id}：子资源 \"{}\" 既不是内嵌也没有路径",
                requirement.id
            ),
        };
        let pixmap = requirement
            .decode(&bytes)
            .with_context(|| format!("lottie source {source_id}：子资源 {label} 解码失败"))?;
        let pixmap = Arc::new(pixmap);
        assets
            .images
            .insert(requirement.asset_name.clone(), pixmap.clone());
        loaded.push((requirement.asset_name, bytes, pixmap));
    }
    lottie.attach_images(loaded);
    if let Some(overrides) = overrides {
        lottie.apply_fill_overrides(overrides);
    }
    let budget = PrepareCtx::default();
    lottie
        .prepare(&budget)
        .with_context(|| format!("lottie source {source_id} 预备失败"))?;
    lottie
        .probe()
        .with_context(|| format!("lottie source {source_id} 探测失败"))?;
    assets
        .source_diagnostics
        .extend(lottie.diagnostics().iter().cloned());
    assets
        .lotties
        .insert(source_id.to_owned(), Arc::new(lottie));
    Ok(())
}

#[cfg(feature = "host")]
fn load_timeline_image_source(
    assets: &mut LoadedAssets,
    source_id: &str,
    path: &Path,
    bytes: &[u8],
) -> Result<()> {
    if path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("svg"))
    {
        let text = std::str::from_utf8(bytes).context("SVG must be UTF-8")?;
        if let Some(animation) = timeline::svg_animation::SvgAnimation::parse(text)? {
            let poster = decode_image("poster.svg", animation.sample(0.0).as_bytes())?;
            assets.images.insert(source_id.to_owned(), Arc::new(poster));
            assets
                .animated_svgs
                .insert(source_id.to_owned(), Arc::new(animation));
            return Ok(());
        }
    }
    if render_raster::source::animated_image::AnimatedFormat::sniff(bytes).is_some() {
        let budget = render_raster::source::PrepareCtx::default();
        match render_raster::source::AnimatedImage::decode(&path.to_string_lossy(), bytes, &budget) {
            Ok(source) => {
                render_raster::source::VisualSource::prepare(&source, &budget)?;
                assets
                    .animated
                    .insert(source_id.to_owned(), Arc::new(source));
                return Ok(());
            }
            Err(animated_error) => {
                // Static PNG/WebP also carry these container magic numbers. Only when static decoding fails as well are the two diagnostics handed together to the single-element isolation policy of strict export or preview.
                return match decode_image(&path.to_string_lossy(), bytes) {
                    Ok(pixmap) => {
                        assets.images.insert(source_id.to_owned(), Arc::new(pixmap));
                        Ok(())
                    }
                    Err(image_error) => bail!(
                        "解码 image source {}：动图解码：{animated_error:#}；静态解码：{image_error:#}",
                        path.display()
                    ),
                };
            }
        }
    }
    let pixmap = decode_image(&path.to_string_lossy(), bytes)
        .with_context(|| format!("解码 image source {}", path.display()))?;
    assets.images.insert(source_id.to_owned(), Arc::new(pixmap));
    Ok(())
}

/// The width of the full backing plate of a text element (`backgroundStyle == "block"`). In the prototype, `textCss` under `mode: 'block'` is `display: block`, so the plate fills the element box: the box width is `place.w`. If no width is given, the box wraps the widest line plus inner padding. The “minimum 28% of frame width” for the subtitle track (`resolve_line_style`) is meant for per-item subtitles. Applied to titles, it produces the user report of 2026-09-05 that the “background color is clearly too large”: a one-word title drags out a plate half the screen wide. The subtitle path does not go through here, so the golden output is unchanged.
fn text_element_block_plate(
    style: &mut LineStyle,
    element: &TimelineVisualElement,
    wrap_width: f64,
) {
    if !style.block_background {
        return;
    }
    style.background_min_width = element.place.w.map_or(0.0, |_| wrap_width);
}

impl OverlayRenderPlan {
    /// Compiles keeping all overlay content. The Studio preview takes this path: the preview always draws the full set.
    #[cfg(feature = "host")]
    pub fn compile_project(
        project: &Path,
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
    ) -> Result<Self> {
        Self::compile_project_with(
            project,
            document,
            width,
            height,
            duration,
            fps,
            mode_override,
            OverlayIncludes::ALL,
        )
    }

    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    pub fn compile_project_with(
        project: &Path,
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
    ) -> Result<Self> {
        Self::compile_project_with_media_policy(
            project,
            std::borrow::Cow::Borrowed(document),
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            TimelineMediaFailurePolicy::Strict,
        )
    }

    /// Entry point for App live preview. It uses the same layout and drawing implementation as strict export. The only difference is that a bad media source removes just the element that references it and leaves a warning, so the text, shapes, and visualizers on the shared overlay do not all disappear together.
    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    pub fn compile_project_preview_with(
        project: &Path,
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
    ) -> Result<Self> {
        Self::compile_project_with_media_policy(
            project,
            std::borrow::Cow::Borrowed(document),
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            TimelineMediaFailurePolicy::SkipFailedElement,
        )
    }

    /// The **take-ownership** version of [`Self::compile_project_preview_with`]. When the caller already holds a body that it can discard (the App's deep copy taken out of the kernel's shared cache `Arc`), this path is used. The live timeline projection is then applied in place to that copy, and another 10+ MB Studio body does not need to be deep-copied for the projection. The semantics are character-for-character identical to the borrowing version.
    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    pub fn compile_project_preview_owned(
        project: &Path,
        document: Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
    ) -> Result<Self> {
        Self::compile_project_with_media_policy(
            project,
            std::borrow::Cow::Owned(document),
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            TimelineMediaFailurePolicy::SkipFailedElement,
        )
    }

    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    fn compile_project_with_media_policy(
        project: &Path,
        document: std::borrow::Cow<'_, Value>,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
        media_failure_policy: TimelineMediaFailurePolicy,
    ) -> Result<Self> {
        // `overlay_document_with_live_timeline` deep-copies the whole Studio document for the live timeline projection, copying each cue, sentence, and word. In very long projects, the transient heap peak of this step can reach several times the resident size of the body. When the whole project has no translation at all in translation mode, the result must fail anyway. So run a non-allocating preflight before the projection, to avoid creating several hundred MB of temporary objects only to report an error.
        // A multi-source project must scan sourceDocs. Looking only at the main mirror at the top level of the body is not enough.
        if includes.subtitles
            && let Some(mode) = burn_in_mode(&document, mode_override)?
            && matches!(mode, StudioMode::Translated | StudioMode::Bilingual)
            && !document_has_translation(&document)
        {
            bail!("当前 Studio 投影没有译文，无法导出译文或双语视频");
        }
        let document = overlay_document_with_live_timeline_owned(project, document.into_owned())?;
        let mut plan = Self::compile_with_fonts(
            &document,
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            cuccut_library_fonts(),
        )?;
        plan.load_timeline_elements_with_policy(project, &document, media_failure_policy)?;
        // Template layer load failures are not propagated outward. A corrupt chapter table or a deleted logo image should not make the whole overlay compile fail, because that would also black out the subtitles. The reason is stored in `chrome_error`, and the host decides how to report it (the App shows it on the template property page).
        match crate::host::template_scene(project) {
            Ok(scene) => plan.set_template_scene(scene),
            Err(error) => plan.chrome_error = Some(format!("{error:#}")),
        }
        plan.run_preflight()?;
        Ok(plan)
    }

    /// Compiles keeping all overlay content. For unit tests only. Production paths always pass the includes explicitly.
    #[cfg(feature = "host")]
    pub fn compile(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
    ) -> Result<Self> {
        Self::compile_with(
            document,
            width,
            height,
            duration,
            fps,
            mode_override,
            OverlayIncludes::ALL,
        )
    }

    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    pub fn compile_with(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
    ) -> Result<Self> {
        Self::compile_with_fonts(
            document,
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            Vec::new(),
        )
    }

    #[allow(clippy::too_many_arguments)]
    #[cfg(feature = "host")]
    pub fn compile_with_fonts(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
        extra_fonts: Vec<Vec<u8>>,
    ) -> Result<Self> {
        let mut fonts = bundled_studio_fonts();
        fonts.extend(extra_fonts);
        Self::compile_with_font_engine(
            document,
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            fonts.len(),
            TextEngine::with_system_and_fonts(&fonts),
        )
    }

    /// The deterministic subtitle entry point for the browser and document asset hosts. It uses only the font bytes injected by the caller. It does not scan system fonts, and it does not link the Studio's full set of embedded fonts into the consumer's artifact.
    ///
    /// The font list must not be empty. The first font is also the deterministic sans-serif fallback for unknown families. So the host should put Noto Sans SC first, then append the fonts the current style actually references.
    #[allow(clippy::too_many_arguments)]
    pub fn compile_with_injected_fonts(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
        fonts: Vec<Vec<u8>>,
    ) -> Result<Self> {
        if fonts.is_empty() {
            bail!("compile_with_injected_fonts 至少需要一份 fallback 字体");
        }
        for (index, font) in fonts.iter().enumerate() {
            if font.is_empty() {
                bail!("compile_with_injected_fonts 的第 {index} 份字体是空字节");
            }
        }
        Self::compile_with_font_engine(
            document,
            width,
            height,
            duration,
            fps,
            mode_override,
            includes,
            fonts.len(),
            TextEngine::with_document_fonts(&fonts),
        )
    }

    /// Same as [`Self::compile_with_injected_fonts`], but reuses a typesetting engine that already has its fonts loaded (`fonts_loaded` is the number of fonts it loaded). When recompiling the same batch of fonts at a different size or style, the fonts do not need to be parsed again.
    #[allow(clippy::too_many_arguments)]
    pub fn compile_with_text_engine(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
        fonts_loaded: usize,
        text: TextEngine,
    ) -> Result<Self> {
        Self::compile_with_font_engine(document, width, height, duration, fps, mode_override, includes, fonts_loaded, text)
    }

    /// Takes apart this plan's typesetting engine (together with its glyph cache), for the next plan that uses the same batch of fonts.
    pub fn into_text_engine(self) -> TextEngine {
        self.text
    }

    #[allow(clippy::too_many_arguments)]
    fn compile_with_font_engine(
        document: &Value,
        width: u32,
        height: u32,
        duration: f64,
        fps: f64,
        mode_override: Option<&str>,
        includes: OverlayIncludes,
        fonts_loaded: usize,
        text: TextEngine,
    ) -> Result<Self> {
        let style = document.get("style").cloned().unwrap_or(Value::Null);
        text_design::validate_motion_tree(&style).map_err(|error| anyhow!(error))?;
        // An effective track set that is empty means all subtitle tracks are turned off (D10 / the lanes `subs:` override). In that case no subtitles are burned this time. Narrow `includes` here, so that all the `includes.subtitles` branches below and `--no-subs` take the same path, without each one judging it separately.
        let mut includes = includes;
        let mode = match burn_in_mode(document, mode_override)? {
            Some(mode) => mode,
            None => {
                includes.subtitles = false;
                StudioMode::Original
            }
        };
        let order = style
            .get("order")
            .and_then(Value::as_str)
            .unwrap_or("trans")
            .to_owned();
        let source_language = document
            .pointer("/meta/sourceLang/code")
            .and_then(Value::as_str)
            .unwrap_or("und");
        let target_language = document
            .pointer("/meta/targetLang/code")
            .and_then(Value::as_str)
            .unwrap_or("und");
        let translation_inputs = if includes.subtitles {
            translation_inputs(document, target_language)
        } else {
            // Do not burn subtitles: do not scan translations, and do not materialize any subtitle input. The display-mode precondition check is also skipped, so a clean picture can be exported even without a translation.
            Vec::new()
        };
        let has_translation = !translation_inputs.is_empty();
        if includes.subtitles {
            if matches!(mode, StudioMode::Translated | StudioMode::Bilingual) && !has_translation {
                bail!("当前 Studio 投影没有译文，无法导出译文或双语视频");
            }
        }
        // Only after the translation precondition has been verified is the full original text materialized into TimedItems. The failure path should not allocate every Word/String for an 110k-word long project. This is also the low-peak guarantee of compile_with (which does not go through the project timeline projection).
        let cues = if includes.subtitles {
            timed_items(
                document["cues"]
                    .as_array()
                    .map(Vec::as_slice)
                    .unwrap_or(&[]),
                "text",
                &style,
                source_language,
            )
        } else {
            Vec::new()
        };
        if includes.subtitles && mode == StudioMode::Bilingual && cues.is_empty() {
            bail!("当前 Studio 投影没有原文字幕，无法导出双语视频");
        }
        // In translation mode, sentences missing a translation contribute no input: that stretch of the picture is left blank (not even the subtitle background box is drawn). The original text is never used in place of the translation. The number of missing sentences is recorded by `sentence_translation_coverage` into the export envelope's `missingTranslations`, and a `partial-translation` warning is emitted. Leaving it blank is a “visible missing translation” only when paired with the envelope. Otherwise a few sentences would just quietly disappear.
        let translations = timed_inputs(&translation_inputs, &style);
        let compact_original = mode == StudioMode::Bilingual;
        let original_style =
            resolve_line_style(&style, LineKind::Original, width, height, compact_original);
        let translation_style = resolve_line_style(
            &style,
            LineKind::Translation,
            width,
            height,
            compact_original,
        );
        // Per-word animation is determined only by `style`, and `style` does not change after compilation. So solving it once here gives the answer for the whole film. Previously `render_subtitle_frame` / `active_layouts` / `stack_layout` / `designed_caption_active` each recomputed it every frame. Each pass had to deep-copy the root style Map and re-parse the CSS colors.
        let track_look = CaptionLook::of(&merged_line_style(&style, LineKind::Original));
        let CaptionLook {
            animation: original_animation,
            descriptor: caption_descriptor,
            designed: track_designed,
            word_box_animated: track_word_box_animated,
            composite: caption_composite,
            centered: centered_caption,
            sequence: track_sequence,
        } = track_look.clone();
        // Per-item style: each subtitle that has an override resolves its own line style and look. The same source entry can appear several times in the projection (the same material clipped in twice), so it is shared by source id.
        let has_cue_styles = includes.subtitles
            && style
                .get(CUE_STYLES_KEY)
                .and_then(Value::as_object)
                .is_some_and(|map| !map.is_empty());
        let cue_overrides = |kind: LineKind, inputs: &mut dyn Iterator<Item = (&Value, &str)>| {
            let mut by_source: HashMap<String, Option<Arc<CueOverride>>> = HashMap::new();
            let mut by_item = HashMap::new();
            if !has_cue_styles {
                return by_item;
            }
            for (index, (item, text_key)) in inputs.enumerate() {
                let Some(source_id) = source_item_id(item) else {
                    continue;
                };
                let resolved = by_source
                    .entry(source_id.to_owned())
                    .or_insert_with(|| {
                        let root = cue_root(&style, kind, source_id, mode)?;
                        Some(Arc::new(CueOverride {
                            style: resolve_line_style(&root, kind, width, height, compact_original),
                            look: CaptionLook::of(&merged_line_style(&root, LineKind::Original)),
                            root,
                        }))
                    })
                    .clone();
                if let Some(resolved) = resolved {
                    by_item.insert(timed_input_id(item, text_key, index), resolved);
                }
            }
            by_item
        };
        let cue_original = cue_overrides(
            LineKind::Original,
            &mut document["cues"]
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or(&[])
                .iter()
                .map(|item| (item, "text")),
        );
        let cue_translation = cue_overrides(
            LineKind::Translation,
            &mut translation_inputs
                .iter()
                .map(|input| (input.item, input.text_key)),
        );
        let override_looks = || {
            cue_original
                .values()
                .chain(cue_translation.values())
                .map(|entry| &entry.look)
        };
        let designed_caption = track_designed || override_looks().any(|look| look.designed);
        let word_box_animated =
            track_word_box_animated || override_looks().any(|look| look.word_box_animated);
        let mut families = vec![
            original_style.font_name.as_str(),
            translation_style.font_name.as_str(),
        ];
        // `emphasisLook.fontFamily` applies only to emphasized words. A missing font must also be reported.
        for style in [&original_style, &translation_style] {
            if let Some(family) = style
                .emphasis
                .as_deref()
                .and_then(|look| look.font_name.as_deref())
                && !families.contains(&family)
            {
                families.push(family);
            }
        }
        let mut override_families = cue_original
            .values()
            .chain(cue_translation.values())
            .map(|entry| entry.style.font_name.as_str())
            .collect::<Vec<_>>();
        override_families.sort_unstable();
        override_families.dedup();
        for family in override_families {
            if !families.contains(&family) {
                families.push(family);
            }
        }
        let warnings = families
            .into_iter()
            .filter(|family| !text.has_family(family))
            .map(|family| {
                format!("字体 {family:?} 在当前字体库中不可用，将使用 Noto Sans SC fallback")
            })
            .collect();
        // `--no-*` does not change the document, but it decides which elements are drawn, so it must form its own segment of the cache key. The quality preset does not take part: it changes only the bitrate, not any pixel.
        let definition_key = format!(
            "{:016x}:{width}x{height}:{duration:.6}:{:.6}:{}:{}",
            render_raster::drawop::fnv1a64(serde_json::to_string(document)?.as_bytes()),
            fps.max(1.0),
            mode_token(mode),
            includes.key(),
        );
        let mut change_points: Vec<f64> = cues
            .iter()
            .chain(translations.iter())
            .flat_map(|item| {
                [item.display_start, item.display_end]
                    .into_iter()
                    .chain(item.words.iter().flat_map(|word| [word.start, word.end]))
            })
            .collect();
        change_points.sort_by(f64::total_cmp);
        change_points.dedup();
        let caps = render_raster::CapabilityProfile::cpu_reference();
        // Daoyazi is enabled only when the original-text track participates and the subtitle layer is on. The font basis is the non-compact solve of the original-text line (bilingual also lays out the world at single-language size). The speaker projection reads the cue's `sp`.
        let sequence = (track_sequence && includes.subtitles && mode != StudioMode::Translated)
            .then(|| {
                let full = resolve_line_style(&style, LineKind::Original, width, height, false);
                let speakers = document
                    .get("cues")
                    .and_then(Value::as_array)
                    .map(Vec::as_slice)
                    .unwrap_or(&[])
                    .iter()
                    .enumerate()
                    .filter_map(|(index, item)| {
                        let speaker = item.get("sp")?.as_str()?.trim();
                        (!speaker.is_empty())
                            .then(|| (timed_input_id(item, "text", index), speaker.to_owned()))
                    })
                    .collect();
                SequenceState {
                    font_name: full.font_name.clone(),
                    font_weight: full.font_weight.max(700),
                    font_px: full.font_size,
                    speakers,
                    plan: None,
                    clip: None,
                    cache: VecDeque::new(),
                    edit: None,
                }
            });
        let text_motion_cues = text_motion_items(
            &cues,
            LineKind::Original,
            &original_style,
            &cue_original,
            &[],
            fps,
        );
        let text_motion_translations = text_motion_items(
            &translations,
            LineKind::Translation,
            &translation_style,
            &cue_translation,
            &cues,
            fps,
        );
        Ok(Self {
            text_motion_cues,
            text_motion_translations,
            definition_key,
            style,
            mode,
            order,
            cues,
            translations,
            original_style,
            translation_style,
            original_animation,
            caption_descriptor,
            designed_caption,
            word_box_animated,
            caption_composite,
            centered_caption,
            track_look,
            cue_original,
            cue_translation,
            width,
            height,
            duration,
            fps: fps.max(1.0),
            fonts_loaded,
            text,
            includes,
            main: None,
            elements: Vec::new(),
            viz_tracks: HashMap::new(),
            viz_projection: None,
            media: OverlayFrameMedia::empty(fps.max(1.0)),
            cache: VecDeque::new(),
            change_points,
            layout_cache: VecDeque::new(),
            glyph_geometry_cache: VecDeque::new(),
            glyph_outline_geometry_cache: VecDeque::new(),
            glyph_decoration_geometry_cache: VecDeque::new(),
            glyph_segment_geometry_cache: VecDeque::new(),
            glyph_effect_geometry_cache: VecDeque::new(),
            glyph_effect_outline_geometry_cache: VecDeque::new(),
            composited: None,
            element_sample_time: None,
            confetti_peek: None,
            confetti_peek_undo: None,
            whiteboard_cache: HashMap::new(),
            whiteboard_sources: HashMap::new(),
            blank_frame: None,
            effect_scratch: None,
            suppress_transition: false,
            executor: render_raster::CpuExecutor::new(caps.clone()),
            capability: caps.fingerprint(),
            preflight: render_raster::PreflightReport::default(),
            warnings,
            chrome: None,
            chrome_error: None,
            sequence,
            dynamic_asset_names: DynamicAssetNames::default(),
            consume_injected_sources: false,
        })
    }

    /// The reason the decoration layer failed to load (`None` = not bound, or loaded successfully).
    pub fn template_chrome_error(&self) -> Option<&str> {
        self.chrome_error.as_deref()
    }

    pub fn sample_time_for(&self, id: &str, time: f64) -> f64 {
        self.element_sample_time
            .as_ref()
            .filter(|(target, sample)| target == id && sample.is_finite())
            .map_or(time, |(_, sample)| *sample)
    }

    pub fn set_element_sample_time(&mut self, sample: Option<(String, f64)>) {
        if self.element_sample_time != sample {
            self.element_sample_time = sample;
            self.composited = None;
        }
    }

    /// Stage sticker-confetti trial: installs a temporary recipe **in place** on the plan. `None` withdraws it (round 236).
    ///
    /// The full benefit lies in the difference from the `set_element_anim_preview` channel, which does a “recompile the whole plan” pass. Changing one confetti style touches only the single `element.confetti` field. The picture is regenerated by `composited = None`, **without re-reading from disk, recompiling, or reloading materials**. The confetti recipe feeds the draw ops, so `element_drawop_fingerprint` changes with it, and the host's same-fingerprint de-duplication does not swallow the preview frame. The subtitle style channel cannot do this, because it has to go around `hash_document`.
    ///
    /// If `id` is not found in the plan, a **phantom element is appended** ([`TimelineVisualElement::confetti_preview`]). When the user hovers over a cell in the asset library grid, the element is not yet on the timeline, and this is the only way that chain can show the effect on stage. The phantom is appended at the end, which makes it topmost, matching the layer order of “click this cell to create a new one”.
    ///
    /// The sampling time is not handled in this channel. It goes through the existing [`Self::set_element_sample_time`]. The target element and the phantom share the same id and the same `[start, end)` liveness check.
    pub fn set_confetti_peek(&mut self, peek: Option<ConfettiPeek>) {
        if self.confetti_peek == peek {
            return;
        }
        // Withdraw the previous one first, then install this one. If you do not withdraw before installing the second time, the original recipe from the first install is lost permanently.
        match self.confetti_peek_undo.take() {
            Some(ConfettiPeekUndo::Restore(saved)) => {
                if let Some(current) = self.confetti_peek.as_ref() {
                    let id = current.id.clone();
                    if let Some(element) = self.elements.iter_mut().find(|e| e.id == id) {
                        element.confetti = saved;
                    }
                }
            }
            Some(ConfettiPeekUndo::Remove) => {
                if let Some(current) = self.confetti_peek.as_ref() {
                    let id = current.id.clone();
                    self.elements.retain(|element| element.id != id);
                }
            }
            None => {}
        }
        self.confetti_peek = peek.clone();
        if let Some(peek) = peek {
            match self
                .elements
                .iter_mut()
                .find(|element| element.id == peek.id)
            {
                Some(element) => {
                    self.confetti_peek_undo =
                        Some(ConfettiPeekUndo::Restore(element.confetti.clone()));
                    element.confetti = Some(peek.props);
                }
                None => {
                    self.confetti_peek_undo = Some(ConfettiPeekUndo::Remove);
                    self.elements.push(TimelineVisualElement::confetti_preview(
                        peek.id,
                        peek.props,
                        peek.window.0,
                        peek.window.1,
                    ));
                }
            }
        }
        self.composited = None;
    }

    /// Whether this plan carries a template layer.
    pub fn has_template_chrome(&self) -> bool {
        self.chrome.is_some()
    }

    /// The template scene currently applied (`None` = none applied).
    pub fn template_scene(&self) -> Option<&TemplateScene> {
        self.chrome.as_ref().map(|layer| &layer.scene)
    }

    /// Swaps the template scene in or withdraws it. The App layout editor's draft live render and the browser compositor both go through here (they do not go through `compile_project`). Switching scenes changes the frame identity and the subtitle avoidance together, so the composited cache is invalidated along with them.
    pub fn set_template_scene(&mut self, scene: Option<TemplateScene>) {
        self.chrome = scene.map(TemplateLayer::new);
        self.chrome_error = None;
        self.composited = None;
        self.cache.clear();
    }

    /// Gets one frame of template pixels (`None` = no template applied). `fallback_family` is the font of the original-text line.
    fn template_frame(&mut self, time: f64) -> Result<Option<Pixmap>> {
        let Some(layer) = self.chrome.as_ref() else {
            return Ok(None);
        };
        let pixmap = layer.frame(
            time,
            self.duration,
            self.width,
            self.height,
            &self.original_style.font_name,
            &mut self.text,
        )?;
        Ok(Some(pixmap))
    }

    /// Preflight for element effects (design §6.5). It is settled before frame-by-frame rendering, so it is not allowed to discover mid-render that a backend does not support something. Overlay effects can only come from `lower_element_effects`, so walking each of the two forms (picture-in-picture/tiled and full-screen) once gives the complete set of references.
    pub fn run_preflight(&mut self) -> Result<()> {
        let mut refs: Vec<render_raster::plan::EffectRef> = Vec::new();
        for element in &self.elements {
            for pip_or_tiled in [false, true] {
                for lowered in timeline::lower_element_effects(
                    element.fx.as_ref(),
                    element.mask.as_ref(),
                    Some(&element.place),
                    Some(1.0),
                    pip_or_tiled,
                ) {
                    if !refs.contains(&lowered.effect) {
                        refs.push(lowered.effect);
                    }
                }
            }
        }
        self.preflight = render_raster::plan::preflight_effects(
            &refs,
            &render_raster::CapabilityProfile::cpu_reference(),
        )?;
        Ok(())
    }

    /// The conclusion of this export's preflight. The `ccut serve` video task envelope reads it.
    pub fn preflight(&self) -> &render_raster::PreflightReport {
        &self.preflight
    }

    /// Loads elements from a Studio projection whose word anchors the host has already resolved. Here we only parse the contract, filter by include, and stably promote the watermark. We do not read timeline.json, probe media, or fetch the spectrum. That way the browser font planner and the CLI host can share the same element order.
    pub fn load_projected_timeline_elements(&mut self, document: &Value) -> Result<()> {
        self.parse_projected_timeline_elements(document).map(|_| ())
    }

    fn parse_projected_timeline_elements(
        &mut self,
        document: &Value,
    ) -> Result<Vec<(String, ElementKind)>> {
        self.elements.clear();
        let mut required_sources = Vec::new();
        // The watermark is **fixed to the top layer at render time** (M5-B8, design doc §20 #10). Track order determines the z-order of the other elements, and the watermark does not take part in it. After stable extraction it is appended uniformly, and watermarks keep their document order among themselves.
        let mut watermarks: Vec<TimelineVisualElement> = Vec::new();
        let tracks = document
            .pointer("/timeline/tracks")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        for track in tracks {
            if track.get("hidden").and_then(Value::as_bool) == Some(true) {
                continue;
            }
            for raw in track
                .get("elements")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or(&[])
            {
                let Some(start) = raw.get("start").and_then(Value::as_f64) else {
                    self.warnings.push(format!(
                        "元素 {} 的 start 词锚无法解析，已跳过渲染",
                        raw.get("id").and_then(Value::as_str).unwrap_or("<unknown>")
                    ));
                    continue;
                };
                let end = raw
                    .get("end")
                    .and_then(Value::as_f64)
                    .unwrap_or(self.duration);
                if end <= start || raw.get("hidden").and_then(Value::as_bool) == Some(true) {
                    continue;
                }
                let mut normalized = raw.clone();
                if let Some(object) = normalized.as_object_mut() {
                    for key in [
                        "startAnchor",
                        "startError",
                        "endAnchor",
                        "endError",
                        "whiteboardBeatAnchors",
                    ] {
                        object.remove(key);
                    }
                    object.insert("start".to_owned(), serde_json::json!(start));
                    object.insert("end".to_owned(), serde_json::json!(end));
                }
                let element: Element = serde_json::from_value(normalized).with_context(|| {
                    format!(
                        "解析 timeline element {}",
                        raw.get("id").and_then(Value::as_str).unwrap_or("<unknown>")
                    )
                })?;
                if !self.includes.allows(&element) {
                    continue;
                }
                if let Some(source_id) = &element.src_id {
                    required_sources.push((source_id.clone(), element.kind));
                }
                let is_watermark = element.role == Some(ElementRole::Watermark);
                let visual = TimelineVisualElement {
                    id: element.id,
                    kind: element.kind,
                    start,
                    end,
                    place: element.place.unwrap_or_default(),
                    vertical_align: element
                        .vertical_align
                        .as_deref()
                        .and_then(vertical_align_from_str),
                    src_id: element.src_id,
                    src_start: element.src_start.unwrap_or(0.0),
                    rate: element.rate.unwrap_or(1.0),
                    audio_fade_in: element.audio_fade_in.unwrap_or(0.0),
                    audio_fade_out: element.audio_fade_out.unwrap_or(0.0),
                    mode: element.mode.unwrap_or(VisualMode::Pip),
                    fit: element.fit.unwrap_or(Fit::Cover),
                    bg: Some(element.bg.unwrap_or(Background::Black)),
                    text: element.text,
                    counter: element.counter,
                    style: element.style.unwrap_or_else(|| serde_json::json!({})),
                    tile: element.tile,
                    mask: element.mask,
                    fx: element.fx,
                    animation: element.animate,
                    transitions: element.transitions,
                    keyframes: element.keyframes,
                    shape: element.shape,
                    sticker: element.sticker,
                    visualizer: element.visualizer,
                    progress: element.progress,
                    draw: element.draw,
                    placeholder: element.placeholder,
                    confetti: element.confetti,
                    whiteboard: element.whiteboard,
                };
                if is_watermark {
                    watermarks.push(visual);
                } else {
                    self.elements.push(visual);
                }
            }
        }
        self.elements.extend(watermarks);
        Ok(required_sources)
    }

    #[cfg(feature = "host")]
    pub fn load_timeline_elements(&mut self, project: &Path, document: &Value) -> Result<()> {
        self.load_timeline_elements_with_policy(
            project,
            document,
            TimelineMediaFailurePolicy::Strict,
        )
    }

    #[cfg(feature = "host")]
    fn load_timeline_elements_with_policy(
        &mut self,
        project: &Path,
        document: &Value,
        media_failure_policy: TimelineMediaFailurePolicy,
    ) -> Result<()> {
        let timeline_path = project.join("timeline.json");
        let timeline = if timeline_path.is_file() {
            let contents = fs::read_to_string(&timeline_path)?;
            // Old undo records once restored a “non-existent optional timeline” as an empty file. The editor's ProjectTimeline::load already treats that as the default document, and rendering must handle it the same way. Otherwise a video element in the projection could play its sound while the whole layer goes black, because parsing fails here. This is read-only compatibility and does not repair the project on write. Non-empty corrupt JSON still reports an error explicitly.
            if contents.trim().is_empty() {
                TimelineDocument::default()
            } else {
                serde_json::from_str::<TimelineDocument>(&contents)
                    .with_context(|| format!("解析 {}", timeline_path.display()))?
            }
        } else {
            TimelineDocument::default()
        };
        timeline
            .validate()
            .map_err(|error| anyhow!("timeline.json 无效：{error}"))?;
        self.main = document
            .pointer("/timeline/main")
            .filter(|value| value.is_object())
            .map(|value| serde_json::from_value(value.clone()))
            .transpose()?
            .or_else(|| timeline.main.clone());

        let projected_sources = self.parse_projected_timeline_elements(document)?;
        let mut required_sources: HashMap<String, TimelineSourceDecoder> = HashMap::new();
        for (source_id, kind) in projected_sources {
            // The decoder for a sticker or placeholder **follows the source's self-declared kind** (P7b). Static assets share a decoder with image. Looping WebM with alpha must use the video decoder. A Timeline 0.7 `lottie` source uses the bodymovin rasterizer.
            let source_kind = timeline
                .sources
                .get(&source_id)
                .and_then(|source| source.kind);
            let decoder = match kind {
                // The source of a whiteboard element is always a static image (`whiteboard-source-kind` is already validated in the schema).
                ElementKind::Image | ElementKind::Whiteboard => TimelineSourceDecoder::Image,
                ElementKind::Video => TimelineSourceDecoder::Video,
                ElementKind::Sticker | ElementKind::Placeholder => match source_kind {
                    Some(timeline::SourceKind::Video) => TimelineSourceDecoder::Video,
                    Some(timeline::SourceKind::Lottie) => TimelineSourceDecoder::Lottie,
                    _ => TimelineSourceDecoder::Image,
                },
                // shape / visualizer / progress do not reference a media source. (The visualizer's `audio` refers to the BCS1 spectrum, which is P1 work.)
                ElementKind::Text
                | ElementKind::Audio
                | ElementKind::Shape
                | ElementKind::Visualizer
                | ElementKind::Progress
                | ElementKind::Confetti
                | ElementKind::Draw => TimelineSourceDecoder::None,
            };
            if let Some(previous) = required_sources.insert(source_id.clone(), decoder)
                && previous != decoder
            {
                bail!("source {source_id} 被 image/video 两种元素 kind 同时引用，无法确定解码器");
            }
        }

        let mut assets = LoadedAssets::default();
        let mut external_video = Vec::new();
        let mut failed_sources = std::collections::HashSet::new();
        for (source_id, decoder) in required_sources {
            let load = (|| -> Result<()> {
                if matches!(decoder, TimelineSourceDecoder::Video) {
                    let declared = timeline
                        .sources
                        .get(&source_id)
                        .and_then(|source| source.path.as_deref());
                    if let Some(source) = crate::host::prepare_video_source(
                        project,
                        &source_id,
                        declared,
                        if matches!(
                            media_failure_policy,
                            TimelineMediaFailurePolicy::SkipFailedElement
                        ) {
                            crate::host::VideoSourceUse::Preview { width: self.width }
                        } else {
                            crate::host::VideoSourceUse::Export {
                                canvas_width: self.width,
                                canvas_height: self.height,
                            }
                        },
                    )? {
                        if let Some(warning) = source.warning {
                            self.warn_once(warning);
                        }
                        assets.videos.insert(source_id.clone(), source.info);
                        external_video.push((source_id.clone(), source.frames));
                        return Ok(());
                    }
                }
                let path = source_path(project, &timeline, &source_id)?;
                match decoder {
                    TimelineSourceDecoder::Image => {
                        let bytes = fs::read(&path)
                            .with_context(|| format!("读取 image source {}", path.display()))?;
                        load_timeline_image_source(&mut assets, &source_id, &path, &bytes)?;
                    }
                    TimelineSourceDecoder::Lottie => {
                        let bytes = fs::read(&path)
                            .with_context(|| format!("读取 lottie source {}", path.display()))?;
                        load_timeline_lottie_source(&mut assets, &source_id, &path, &bytes, None)?;
                    }
                    TimelineSourceDecoder::Video => {
                        let (width, height, source_duration, source_fps) =
                            probe_media(&path, true)?;
                        assets.videos.insert(
                            source_id.clone(),
                            VideoInfo {
                                // WebM with alpha (dynamic stickers) must name the decoder explicitly. Otherwise the alpha plane is silently discarded (P7b).
                                decoder: render_raster::assets::probe_alpha_decoder(&path),
                                path,
                                width,
                                height,
                                duration: source_duration,
                                fps: source_fps,
                            },
                        );
                    }
                    TimelineSourceDecoder::None => {}
                }
                Ok(())
            })();
            if let Err(error) = load {
                if media_failure_policy == TimelineMediaFailurePolicy::Strict {
                    return Err(error);
                }
                failed_sources.insert(source_id.clone());
                self.warn_once(format!(
                    "预览已跳过媒体 source {source_id} 及其元素：{error:#}"
                ));
            }
        }
        if !failed_sources.is_empty() {
            self.elements.retain(|element| {
                element
                    .src_id
                    .as_ref()
                    .is_none_or(|source_id| !failed_sources.contains(source_id))
            });
            self.composited = None;
        }
        self.load_sticker_fill_variants(&mut assets, project, &timeline);
        self.media = OverlayFrameMedia {
            base: MediaStore::new(Arc::new(assets), self.fps),
            dynamic: HashMap::new(),
            injected: HashMap::new(),
        };
        for (id, source) in external_video {
            self.media.base.insert_video_source(id, source);
        }
        self.load_visualizer_tracks(project)?;
        Ok(())
    }

    /// Preloads the **recolored** material-sticker bitmap (the rendering leg of §14.4 in round 122).
    ///
    /// The criterion lives in the pure layer [`timeline::svg_fill::apply_overrides`], which shares one grouping with the property page's color swatches. So the color picked in the panel and the color seen on screen can never diverge. Here it only reads from disk, rasterizes, and archives under [`sticker_fill_variant_id`].
    ///
    /// Lottie sources (Timeline 0.7) go through [`render_raster::source::Lottie::apply_fill_overrides`]. Matching solid fills and strokes are replaced at the document level, the variant is archived as another `Lottie`, and per-frame sampling and loop semantics stay exactly the same as the original.
    ///
    /// Three kinds of source **deliberately do not generate variants**. When a frame is fetched, they fall back unchanged to the source-id copy: bitmaps (`fillOverrides` is meaningless for PNG), animated or video stickers (decoded per frame, so recoloring would need a separate plan), and assets whose disk read or rasterization failed. A missing variant is not an error. It just means no recoloring.
    #[cfg(feature = "host")]
    fn load_sticker_fill_variants(
        &mut self,
        assets: &mut LoadedAssets,
        project: &Path,
        timeline: &TimelineDocument,
    ) {
        let wanted: Vec<(String, std::collections::BTreeMap<String, String>)> = self
            .elements
            .iter()
            .filter_map(|element| {
                let source_id = element.src_id.clone()?;
                let sticker = element.sticker.as_ref()?;
                (!sticker.fill_overrides.is_empty())
                    .then(|| (source_id, sticker.fill_overrides.clone()))
            })
            .collect();
        let mut seen = std::collections::HashSet::new();
        for (source_id, overrides) in wanted {
            let variant = sticker_fill_variant_id(&source_id, &overrides);
            if !seen.insert(variant.clone()) || assets.images.contains_key(&variant) {
                continue;
            }
            let Ok(path) = source_path(project, timeline, &source_id) else {
                continue;
            };
            // Lottie recoloring is done at the document level (solid fills and strokes). The variant is another `Lottie`, archived under `sticker_fill_variant_id` just like the SVG variant.
            if assets.lotties.contains_key(&source_id) {
                if assets.lotties.contains_key(&variant) {
                    continue;
                }
                let load = fs::read(&path)
                    .with_context(|| format!("读取 {}", path.display()))
                    .and_then(|bytes| {
                        load_timeline_lottie_source(
                            assets,
                            &variant,
                            &path,
                            &bytes,
                            Some(&overrides),
                        )
                    });
                if let Err(error) = load {
                    self.warn_once(format!(
                        "贴纸 source {source_id} 换色失败，按原色渲染：{error:#}"
                    ));
                }
                continue;
            }
            // Only sources that go through the static-image decoder have recolor variants. The animated/video copy is not in `images`.
            if !assets.images.contains_key(&source_id) {
                continue;
            }
            if !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("svg"))
            {
                continue;
            }
            let svg = match fs::read_to_string(&path) {
                Ok(svg) => svg,
                Err(error) => {
                    self.warn_once(format!(
                        "贴纸 source {source_id} 换色失败，按原色渲染：读取 {}：{error}",
                        path.display()
                    ));
                    continue;
                }
            };
            let recolored = timeline::svg_fill::apply_overrides(&svg, &overrides);
            match load_timeline_image_source(assets, &variant, &path, recolored.as_bytes()) {
                Ok(()) => {}
                Err(error) => self.warn_once(format!(
                    "贴纸 source {source_id} 换色后无法光栅，按原色渲染：{error:#}"
                )),
            }
        }
    }

    /// **The host side of the ADR-E04 data flow**: read BCS1 → derive the whole track from the element parameters → inject.
    ///
    /// Three things must be done here, and none may be done at render time:
    ///
    /// 1. **Read.** `ccut-render` performs no I/O, so the BCS1 cache path, fingerprint, and reading can only happen in the host. The cache file is produced by `ccut spectrum`. This function does **not** generate it on the caller's behalf. Re-decoding a whole audio track takes minutes, and hiding that inside one overlay render is not appropriate.
    /// 2. **Derive.** Exponential smoothing is a natural recurrence (`y[n] = τ·y[n-1] + (1-τ)·x[n]`, `y[-1]=0`) and must advance sequentially from frame 0. `VizTrack::derive` walks the whole track once, so `sample(t)` is then a pure table lookup. Only then can out-of-order sampling match sequential sampling bit for bit.
    /// 3. **Fail fast.** If BCS1 is missing, report an error immediately and point to `ccut spectrum`. Never silently produce an empty image: “the spectrum has not been generated yet” and “this stretch is genuinely silent” look exactly the same on screen.
    #[cfg(feature = "host")]
    pub fn load_visualizer_tracks(&mut self, project: &Path) -> Result<()> {
        let wanted: Vec<(String, String, VisualizerProps)> = self
            .elements
            .iter()
            .filter(|element| element.kind == ElementKind::Visualizer)
            .filter_map(|element| {
                let props = element.visualizer.clone()?;
                Some((element.id.clone(), visualizer_audio_source(&props), props))
            })
            .collect();
        if wanted.is_empty() {
            return Ok(());
        }
        // The lookup table for sample times (see the field docs of `viz_projection`). It is built only when there really is a visualizer element. A project with no such element should not read a single extra byte.
        self.viz_projection = Some(
            crate::host::project_timeline_projection(project)
                .context("visualizer 的采样时刻需要时间轴投影")?,
        );
        // Elements with the same `(source, parameters)` share one track. The VizTrack for a 3-minute audio track is over ten MB, and two waveforms with the same parameters have no reason to each store their own copy.
        let mut derived: HashMap<String, Arc<render_raster::source::VizTrack>> = HashMap::new();
        let mut spectra: HashMap<String, Arc<Vec<u8>>> = HashMap::new();
        for (element_id, source_id, props) in wanted {
            let params = render_raster::source::VizParams {
                min_db: props.min_db(),
                max_db: props.max_db(),
                smoothing: props.smoothing(),
                gain: props.gain(),
            };
            let key = format!(
                "{source_id}\u{1}{}\u{1}{}\u{1}{}\u{1}{}",
                params.min_db, params.max_db, params.smoothing, params.gain
            );
            if let Some(track) = derived.get(&key) {
                self.viz_tracks.insert(element_id, track.clone());
                continue;
            }
            let bytes = match spectra.get(&source_id) {
                Some(bytes) => bytes.clone(),
                None => {
                    let bytes = Arc::new(read_project_spectrum(project, &source_id, &element_id)?);
                    spectra.insert(source_id.clone(), bytes.clone());
                    bytes
                }
            };
            let track = Arc::new(
                render_raster::source::VizTrack::derive(&bytes, params).with_context(|| {
                    format!("元素 {element_id} 的频谱轨派生失败（音频源 {source_id}）")
                })?,
            );
            derived.insert(key, track.clone());
            self.viz_tracks.insert(element_id, track);
        }
        Ok(())
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }

    /// The content signature of subtitles on the output timeline: one entry per original-text or translation line. `key` covers everything that changes the picture: layer, id, text, display window, and per-word highlight timing.
    ///
    /// Partial-window re-rendering uses this to decide whether all differences between the baseline document and this document fall inside the patch window. Every frame outside the window passes straight through from the baseline output, so a single difference outside the window would silently produce a wrong output. Subtitle lines take part in drawing only within `[display_start, display_end)`, so comparing the whole display window is enough.
    pub fn subtitle_spans(&self) -> Vec<SubtitleSpan> {
        let layers = self
            .cues
            .iter()
            .map(|item| ("orig", item))
            .chain(self.translations.iter().map(|item| ("trans", item)));
        layers
            .map(|(layer, item)| {
                let words = item
                    .words
                    .iter()
                    .map(|word| format!("{}@{:.4}", word.text, word.end))
                    .collect::<Vec<_>>()
                    .join("\u{1}");
                SubtitleSpan {
                    start: item.display_start,
                    end: item.display_end,
                    key: format!(
                        "{layer}\u{2}{}\u{2}{}\u{2}{:.4}\u{2}{:.4}\u{2}{words}",
                        item.id, item.text, item.display_start, item.display_end
                    ),
                }
            })
            .collect()
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// While the same subtitle line is displayed, its text, style, and wrap width do not change. So the shaping result is reused by `(layer, line id)`. Per-word highlighting affects only the drawing stage and does not take part in typesetting.
    pub fn cached_layout(
        &mut self,
        kind: LineKind,
        item: &TimedItem,
        style: &LineStyle,
        wrap_width: f64,
    ) -> Arc<CachedLayout> {
        let key = format!(
            "{}:{}",
            match kind {
                LineKind::Original => "orig",
                LineKind::Translation => "trans",
            },
            item.id
        );
        if let Some(index) = self
            .layout_cache
            .iter()
            .position(|(cached, _)| *cached == key)
        {
            let entry = self.layout_cache.remove(index).expect("layout cache entry");
            self.layout_cache.push_front(entry.clone());
            return entry.1;
        }
        let (lines, width) = layout_subtitle_text(&mut self.text, item, style, wrap_width);
        let layout = Arc::new(CachedLayout {
            lines: lines.into(),
            width,
        });
        self.layout_cache.push_front((key, layout.clone()));
        while self.layout_cache.len() > 4 {
            self.layout_cache.pop_back();
        }
        layout
    }

    #[allow(clippy::too_many_arguments)]
    pub fn cached_caption_layout(
        &mut self,
        item: &TimedItem,
        style: &LineStyle,
        design: &DesignedCaption,
        descriptor: &'static CaptionRecipeDescriptor,
        wrap_width: f64,
        time: f64,
        canvas_scale: f64,
    ) -> Arc<CachedLayout> {
        let group = caption_recipe_visible_group(design, item, time, self.fps)
            .map_or_else(|| "none".to_owned(), |group| group.index.to_string());
        let key = format!(
            "orig:{}:caption:{}:{}:{group}",
            item.id, descriptor.id, descriptor.version
        );
        if let Some(index) = self
            .layout_cache
            .iter()
            .position(|(cached, _)| *cached == key)
        {
            let entry = self.layout_cache.remove(index).expect("layout cache entry");
            self.layout_cache.push_front(entry.clone());
            return entry.1;
        }
        let (lines, width) = layout_caption_text(
            &mut self.text,
            item,
            style,
            design,
            descriptor,
            wrap_width,
            time,
            self.fps,
            self.width,
            self.height,
            canvas_scale,
        );
        let layout = Arc::new(CachedLayout {
            lines: lines.into(),
            width,
        });
        self.layout_cache.push_front((key, layout.clone()));
        while self.layout_cache.len() > 12 {
            self.layout_cache.pop_back();
        }
        layout
    }

    pub fn active_layouts(&mut self, time: f64) -> Vec<LineLayout> {
        let original = active_at(&self.cues, time).cloned();
        let translation = active_at(&self.translations, time).cloned();
        let base_wrap_width = f64::from(self.width)
            * clamp(finite(self.style.get("width"), 80.0), 5.0, 100.0)
            / 100.0;
        // A handle to the constants fixed at compile time that does not borrow `self`, so that below we can keep calling the `&mut self` layout cache methods.
        let track_look = self.track_look.clone();
        let canvas_scale = f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE
            * finite(self.style.get("scale"), 1.0).max(0.05);
        let sequence_takes_original = self.sequence.is_some();
        let mut layouts = mode_lines(self.mode, &self.order)
            .into_iter()
            // Daoyazi takes over the original-text track. Cue-level layout is left with only the translation line (bilingual), or nothing at all (monolingual).
            .filter(|kind| !(sequence_takes_original && *kind == LineKind::Original))
            .filter_map(|kind| {
                let mut item = match kind {
                    LineKind::Original => original.clone(),
                    LineKind::Translation => translation.clone(),
                }?;
                let cue = self.cue_override(kind, &item.id).cloned();
                let style = match (&cue, kind) {
                    (Some(cue), _) => cue.style.clone(),
                    (None, LineKind::Original) => self.original_style.clone(),
                    (None, LineKind::Translation) => self.translation_style.clone(),
                };
                if style.text_motion.is_some() {
                    item.display_end = item.display_end.min(self.duration);
                }
                let look = cue.as_ref().map_or(&track_look, |cue| &cue.look);
                let caption = look.animation.caption.as_ref();
                let caption_descriptor = look.descriptor;
                let wrap_width = if kind == LineKind::Original {
                    caption_descriptor.map_or(base_wrap_width, |descriptor| {
                        caption_recipe_layout_token(descriptor, self.width, self.height)
                            .map_or_else(
                                || match descriptor.layout.as_str() {
                                    "fullScreenWord" | "centerBand" => f64::from(self.width) * 0.9,
                                    "dualBand" | "editorialBlock" => (f64::from(self.width) * 0.92)
                                        .min(base_wrap_width.max(f64::from(self.width) * 0.82)),
                                    _ => base_wrap_width,
                                },
                                |token| f64::from(self.width) * token.width,
                            )
                    })
                } else {
                    base_wrap_width
                };
                let layout = match (kind, caption, caption_descriptor) {
                    (LineKind::Original, Some(design), Some(descriptor)) => self
                        .cached_caption_layout(
                            &item,
                            &style,
                            design,
                            descriptor,
                            wrap_width,
                            time,
                            canvas_scale,
                        ),
                    _ => self.cached_layout(kind, &item, &style, wrap_width),
                };
                let (lines, width) = (Arc::clone(&layout.lines), layout.width);
                let current_word = current_word_index(&item, time);
                let karaoke_words = self
                    .active_text_motion(kind, time)
                    .and_then(|(_, motion)| motion.karaoke_words.clone());
                let line_style =
                    merged_line_style(cue.as_ref().map_or(&self.style, |cue| &cue.root), kind);
                Some(LineLayout {
                    kind,
                    height: layout_lines_height(&lines),
                    width,
                    align_width: if crate::aligns_within_wrap(&line_style) {
                        wrap_width
                    } else {
                        width
                    },
                    text_align: LineTextAlign::from_style(&line_style),
                    style,
                    item,
                    lines,
                    current_word,
                    render_time: time,
                    render_fps: self.fps,
                    animation_parts: Vec::new(),
                    animation_short_edge: f64::from(self.width.min(self.height)),
                    preview: false,
                    karaoke_words,
                    guide_below: false,
                })
            })
            .collect::<Vec<_>>();
        // Bilingual two-line stacking: the guide dot of the lower line is drawn beneath it, and does not overlap the text of the line above.
        for line in layouts.iter_mut().skip(1) {
            line.guide_below = true;
        }
        if let Some(preview) = self.karaoke_next_line(&layouts, base_wrap_width) {
            layouts.push(preview);
        }
        layouts
    }

    /// KTV two-line layout. When only one line is shown (original only, or translation only), the line currently being sung carries `textMotion.karaoke.nextLine`, and the next sentence is set beneath it as a preview. Bilingual pictures already show two lines (original plus translation), so adding a preview would make four lines, and so no preview is shown. A next sentence that is too far away (an interlude) is not previewed either.
    fn karaoke_next_line(
        &mut self,
        layouts: &[LineLayout],
        wrap_width: f64,
    ) -> Option<LineLayout> {
        let kind = match self.mode {
            StudioMode::Original => LineKind::Original,
            StudioMode::Translated => LineKind::Translation,
            StudioMode::Bilingual => return None,
        };
        let current = layouts.iter().find(|line| line.kind == kind)?;
        let karaoke = current.style.text_motion.as_ref()?.spec.karaoke.as_ref()?;
        if !karaoke.next_line {
            return None;
        }
        let items = match kind {
            LineKind::Original => &self.cues,
            LineKind::Translation => &self.translations,
        };
        let index = items.iter().position(|item| item.id == current.item.id)?;
        let next = items.get(index + 1)?.clone();
        if next.display_start - current.item.display_end > KARAOKE_NEXT_LINE_MAX_GAP {
            return None;
        }
        let style = current.style.clone();
        let layout = self.cached_layout(kind, &next, &style, wrap_width);
        let (lines, width) = (Arc::clone(&layout.lines), layout.width);
        let within_wrap =
            crate::aligns_within_wrap(&merged_line_style(&self.style, kind));
        Some(LineLayout {
            kind,
            height: layout_lines_height(&lines),
            width,
            align_width: if within_wrap { wrap_width } else { width },
            text_align: current.text_align,
            style,
            item: next,
            lines,
            current_word: 0,
            render_time: current.render_time,
            render_fps: self.fps,
            animation_parts: Vec::new(),
            animation_short_edge: current.animation_short_edge,
            preview: true,
            karaoke_words: None,
            guide_below: false,
        })
    }

    pub fn cache_key(
        &self,
        layouts: &[LineLayout],
        time: f64,
        pose: TransitionPose,
        suppressed: bool,
    ) -> String {
        // The preview line is determined by the current sentence and does not enter the key. It has the same shape as the light-weight key of `render_subtitle_frame`.
        let items = layouts
            .iter()
            .filter(|line| !line.preview)
            .map(|line| (line.item.id.as_str(), line.current_word))
            .collect::<Vec<_>>();
        self.cache_key_of(&items, time, pose, suppressed)
    }

    /// The **light-weight** form of [`Self::cache_key`]. The key recognizes only “which cues, plus each one's current word”. No layout result goes into the key at all. So looking up the cache does not need the layout materialized first. `render_subtitle_frame` relies on this to defer the shaping deep copy until after a cache miss.
    ///
    /// The two paths must go through the same function. If the keys diverge, a hit would return a different picture.
    pub fn cache_key_of(
        &self,
        items: &[(&str, usize)],
        time: f64,
        pose: TransitionPose,
        suppressed: bool,
    ) -> String {
        let items = items
            .iter()
            .map(|(id, current_word)| format!("{id}:{current_word}"))
            .collect::<Vec<_>>()
            .join("|");
        let (motion_changes, motion_key, _) = self.text_motion_state(time);
        let transition = if self.per_frame_subtitle(pose.active) || motion_changes {
            format!("@{}", (time * self.fps).round() as i64)
        } else {
            "@settled".to_owned()
        };
        // Frames that really are suppressed must be keyed differently from unsuppressed ones. While a Designed Caption is active, the per-frame key takes its value only from the frame number. The two states would then collide on the same frame number into the same key while being two different images. Once settled, suppression is an identity transform, so the key stays consistent and the cache is not needlessly fragmented.
        let suppressed = if suppressed { "!nt" } else { "" };
        format!("{items}{transition}{suppressed}{motion_key}")
    }

    /// This frame's subtitle entrance pose, plus “whether suppression actually changed this frame” (this bit only feeds the cache key).
    ///
    /// The client cannot and should not apply the transition a second time. `scale_x/scale_y` are applied around the anchor by `group_transform`, `opacity` goes per stroke into `raster::paint`, and `blur` is applied by `box_blur_rgba_bounded`. All of it is baked into this PNG. So the two suppressions in Mac's `Stage/Frame/StageFrameMotion.swift::subtitlePoseNodes` (any subtitle selected, or a Designed Caption yielding its place) can only be initiated from here.
    pub fn transition_pose_at(
        &self,
        display_start: f64,
        time: f64,
        canvas_scale: f64,
    ) -> (TransitionPose, bool) {
        let pose = transition_pose(&self.style, display_start, time, canvas_scale, self.fps);
        if self.suppress_transition {
            (TransitionPose::IDENTITY, pose.active)
        } else {
            (pose, false)
        }
    }

    /// S14: collapses the subtitle entrance into the unit pose. Default `false`, byte-identical to before 2.0.
    pub fn set_suppress_transition(&mut self, suppress: bool) {
        self.suppress_transition = suppress;
    }

    /// See [`DynamicAssetNames`].
    pub fn set_dynamic_asset_names(&mut self, names: DynamicAssetNames) {
        self.dynamic_asset_names = names;
    }

    /// After a media element is drawn, takes away the source picture it uses from `media.injected` (not taken by default).
    ///
    /// Only for hosts that re-inject every frame and clear the injected table once each frame is drawn (frame-render draws one instance at a time). When no effect needs baking, the source picture owned by the plan is used directly as the local canvas, which saves one full-frame copy. Pixels are unchanged.
    pub fn set_consume_injected_sources(&mut self, consume: bool) {
        self.consume_injected_sources = consume;
    }

    /// The resource name of the `slot`-th dynamic raster in this frame ([`DynamicAssetNames`]).
    fn dynamic_asset_name(&self, kind: &str, owner: &str, rgba: &[u8], slot: usize) -> String {
        match self.dynamic_asset_names {
            DynamicAssetNames::PixelFingerprint => dynamic_raster_asset_name(kind, owner, rgba),
            DynamicAssetNames::Slot => format!("{kind}:{owner}#{slot}"),
        }
    }

    /// Switches the underlying video decoder to **random access**: when jumping forward too far, reopen instead of draining frame by frame (see `render_raster::MediaStore::set_random_access`).
    ///
    /// Only for interactive preview (the App's overlay render thread, and the serve single-frame preview endpoint). There, one seek can cross thousands of frames, and draining would mean re-decoding the whole video. The `studio_export` export path, which does not call it, is unchanged. Both paths fetch the same source frame.
    #[cfg(feature = "host")]
    pub fn set_random_access(&mut self, enabled: bool) {
        self.media.base.set_random_access(enabled);
    }

    /// The underlying video decoder's **keyframe snap** switch (see `render_raster::MediaStore::set_keyframe_snap`). While the playhead is being dragged, the fetch time snaps to the nearest earlier keyframe and decodes only one frame. After release it is turned off and exact fetching resumes. Export does not touch it.
    #[cfg(feature = "host")]
    pub fn set_keyframe_snap(&mut self, enabled: bool) {
        self.media.base.set_keyframe_snap(enabled);
    }

    pub fn designed_caption_active(&self) -> bool {
        self.designed_caption
    }

    /// The per-item style of this subtitle on a given line (`None` when there is no override).
    pub fn cue_override(&self, kind: LineKind, item_id: &str) -> Option<&Arc<CueOverride>> {
        match kind {
            LineKind::Original => self.cue_original.get(item_id),
            LineKind::Translation => self.cue_translation.get(item_id),
        }
    }

    /// The root style used to draw this line: if there is a per-item override, it is the one with the override applied; otherwise it is the whole track's style.
    fn line_root(&self, kind: LineKind, item_id: &str) -> &Value {
        self.cue_override(kind, item_id)
            .map_or(&self.style, |entry| &entry.root)
    }

    /// The line that determines this frame's look: in translation mode it is the translation line, otherwise the original-text line.
    fn look_kind(&self) -> LineKind {
        if self.mode == StudioMode::Translated {
            LineKind::Translation
        } else {
            LineKind::Original
        }
    }

    /// This frame's original-text look, taken from the line that has already been laid out.
    fn look_for_layouts(&self, layouts: &[LineLayout]) -> &CaptionLook {
        let kind = self.look_kind();
        layouts
            .iter()
            .find(|line| line.kind == kind)
            .and_then(|line| self.cue_override(kind, &line.item.id))
            .map_or(&self.track_look, |entry| &entry.look)
    }

    /// The same answer as [`Self::look_for_layouts`], but without laying out first (used by the cache-hit path).
    fn look_at(&self, time: f64) -> &CaptionLook {
        let kind = self.look_kind();
        let items = match kind {
            LineKind::Original => &self.cues,
            LineKind::Translation => &self.translations,
        };
        active_at(items, time)
            .and_then(|item| self.cue_override(kind, &item.id))
            .map_or(&self.track_look, |entry| &entry.look)
    }

    /// Whether this film has any per-word highlight block whose timing changes over time. Like [`Self::designed_caption_active`], it feeds only the cache key and `next_change`. Both mean “for this frame, the subtitle layer cannot be identified by `(cue, current word)`”.
    pub fn word_box_animated(&self) -> bool {
        self.word_box_animated
    }

    /// Whether the subtitle layer must be rendered as an image every frame (transition pose, Designed Caption, or a per-word block timing track).
    fn per_frame_subtitle(&self, pose_active: bool) -> bool {
        pose_active || self.designed_caption_active() || self.word_box_animated()
    }

    /// Whether any subtitle in this film has layered text animation. This is **not** the admission criterion: the GPU scene checks per frame via [`Self::text_motion_active_at`]. This is kept only for hosts that still decide the delivery form of the subtitle layer for the whole film (browser preview). Once any motion is present, the whole layer goes through `render_subtitle_raster`, so that the subtitle does not go blank on the first motion frame, where an error would otherwise be thrown.
    pub fn has_text_motion(&self) -> bool {
        self.text_motion_cues
            .iter()
            .chain(&self.text_motion_translations)
            .any(Option::is_some)
    }

    /// The active subtitle on a given line at `time`, and the motion amount frozen for it at compile time (`None` when there is no new animation).
    fn active_text_motion(
        &self,
        kind: LineKind,
        time: f64,
    ) -> Option<(&TimedItem, &TextMotionItem)> {
        let (items, motion) = match kind {
            LineKind::Original => (&self.cues, &self.text_motion_cues),
            LineKind::Translation => (&self.translations, &self.text_motion_translations),
        };
        let index = active_index(items, time)?;
        Some((items.get(index)?, motion.get(index)?.as_ref()?))
    }

    /// Whether the line actually drawn in this frame carries layered text animation or a per-word background block. The subtitle glyph scene cannot yet express these. In that case this frame returns [`SubtitleSceneFallback::WordAnimation`], and the host rasterizes only the **subtitle layer** on the CPU (in the host compositor, as a texture node). Elements stay on the GPU as usual.
    pub fn text_motion_active_at(&self, time: f64) -> bool {
        (0.0..self.duration).contains(&time)
            && mode_lines(self.mode, &self.order)
                .into_iter()
                .any(|kind| self.active_text_motion(kind, time).is_some())
    }

    fn text_motion_state(&self, time: f64) -> (bool, String, Option<f64>) {
        use std::fmt::Write as _;
        let mut changing = false;
        let mut key = String::new();
        let mut next: Option<f64> = None;
        for kind in mode_lines(self.mode, &self.order) {
            let Some((item, motion)) = self.active_text_motion(kind, time) else {
                continue;
            };
            let base = match kind {
                LineKind::Original => &self.original_style,
                LineKind::Translation => &self.translation_style,
            };
            let style = self.cue_override(kind, &item.id).map_or(base, |v| &v.style);
            let Some(m) = &style.text_motion else {
                continue;
            };
            let local = ((time - item.display_start) * self.fps).round() / self.fps;
            let sweep_starts = motion.karaoke_words.as_ref().map(|words| {
                words
                    .iter()
                    .map(|(start, _)| start - item.display_start)
                    .collect::<Vec<_>>()
            });
            let starts: &[f64] = sweep_starts.as_deref().unwrap_or(&motion.starts);
            let duration = item.display_end.min(self.duration) - item.display_start;
            let units = motion.units;
            changing |= m.changing_at(local, duration, self.fps, units, starts);
            let _ = write!(key, "/tm{}:{:?}", item.id, m.active_word(local, starts));
            let (enter, exit) = m.boundary_windows(duration, self.fps, units);
            for boundary in [enter, exit] {
                let boundary = item.display_start + boundary - 0.5 / self.fps;
                if boundary > time + 1e-8 {
                    next = Some(next.map_or(boundary, |v| v.min(boundary)));
                }
            }
        }
        (changing, key, next)
    }

    pub fn next_change_after(&self, time: f64, transition_active: bool) -> Option<f64> {
        let (motion_changes, _, motion_next) = self.text_motion_state(time);
        let epsilon = 1.0 / (self.fps * 100.0);
        let index = self
            .change_points
            .partition_point(|boundary| *boundary <= time + epsilon);
        let mut next = self
            .change_points
            .get(index)
            .copied()
            .filter(|boundary| *boundary <= self.duration + epsilon);
        if let Some(boundary) = motion_next {
            next = Some(next.map_or(boundary, |v| v.min(boundary)));
        }
        if transition_active || motion_changes {
            let bucket = (time * self.fps).round();
            let mut boundary = (bucket + 0.5) / self.fps;
            if boundary <= time + epsilon {
                boundary = (bucket + 1.5) / self.fps;
            }
            if boundary <= self.duration + epsilon {
                next = Some(next.map_or(boundary, |current| current.min(boundary)));
            }
        }
        next
    }

    /// Blank frames share the same zero buffer, to avoid allocating a whole RGBA image for each frame.
    pub fn blank_rgba(&mut self) -> Arc<Vec<u8>> {
        if let Some(blank) = &self.blank_frame {
            return blank.clone();
        }
        let blank = Arc::new(vec![0; self.width as usize * self.height as usize * 4]);
        self.blank_frame = Some(blank.clone());
        blank
    }

    /// The **placement** geometry of the subtitle stack: the anchor, the per-line slots, the shared-plate decision, and the stack span.
    ///
    /// Rasterization ([`Self::render_subtitle_frame`]) and the geometry sidecar ([`Self::subtitle_layout`], used by the client for line hit-testing and dragging) share one answer. The sole reason for splitting it out: computing placement in two places means two opinions about “where this line is”. A selection box misaligned with the picture is the typical symptom of exactly this kind of divergence.
    pub fn stack_layout(&self, layouts: &[LineLayout], canvas_scale: f64) -> StackLayout {
        let centered_caption = self.look_for_layouts(layouts).centered;
        // In single-line mode there is only one line, and its per-item override can move the whole group's anchor. In bilingual mode the anchor is always the whole track's, and per-item positions go through the line-level override below.
        let anchor_root = match layouts.first() {
            Some(line) if self.mode != StudioMode::Bilingual => {
                self.line_root(line.kind, &line.item.id)
            }
            _ => &self.style,
        };
        let x = if centered_caption {
            f64::from(self.width) / 2.0
        } else {
            f64::from(self.width) * finite(anchor_root.get("x"), 50.0) / 100.0
        };
        // Template avoidance (prototype round 112): when there is a full-width template band at the bottom, the subtitle anchor line is raised at most to the top edge of the band. Only y is moved. Font size, width, and plate are not touched: the template changes where subtitles sit, not what they look like.
        let lift = self.chrome.as_ref().map_or(0.0, |layer| {
            timeline::template::subs_bottom(&layer.scene.doc, 0.0)
        });
        let center_y = if centered_caption {
            f64::from(self.height) / 2.0
        } else {
            let mut y = finite(anchor_root.get("y"), 86.0);
            if lift > 0.0 {
                y = y.min(100.0 - lift);
            }
            f64::from(self.height) * y / 100.0
        };
        let gap = finite(self.style.get("gap"), 6.0).max(0.0) * canvas_scale;
        // A line-level position override changes only “where this line is drawn”. Width, scale, rotation, and transitions remain shared by the whole group. So the pivot of group_tf is always the global anchor, and lines that have left the stack still follow the whole group's scaling and rotation.
        let boxes = layouts
            .iter()
            .map(|line| LineBox {
                height: line.height,
                reference: line.style.font_size * line.style.line_height,
                pad_v: line.style.background_pad_v,
                over: line_position_override(
                    self.line_root(line.kind, &line.item.id),
                    line.kind,
                    self.mode,
                ),
                align: line_vertical_align(
                    self.line_root(line.kind, &line.item.id),
                    line.kind,
                    self.mode,
                ),
            })
            .collect::<Vec<_>>();
        let overrides = boxes.iter().map(|line| line.over).collect::<Vec<_>>();
        // The shared plate's style follows only **one** line (see `shared_plate_line`). The other line's backgroundPadding and backgroundColor are completely ignored in shared mode.
        //
        // The line must be picked by kind here, not conveniently as “the first line in the stack”. `mode_lines` puts the translation line first under transTop, and `origStyle` / `transStyle` can each override backgroundPadding. Picking by position would let the two ends diverge.
        let stacked_line = |want: LineKind| {
            layouts
                .iter()
                .zip(&overrides)
                .enumerate()
                .find_map(|(index, (line, over))| {
                    (over.is_none() && line.kind == want).then_some(index)
                })
        };
        let plate_line = shared_plate_line(
            stacked_line(LineKind::Original),
            stacked_line(LineKind::Translation),
            |index| has_real_background(&layouts[index]),
        );
        // The shared background wraps only the lines still in the stack. A line that has left the stack is not inside this rectangle's continuous span, so it draws its own plate. When only one line remains in the stack, the shared rectangle and the single-line plate are pixel-equivalent, so it falls back directly to the per-line branch here.
        //
        // The criteria are only backgroundMode and the stack's line count. They **do not include** background_on. The placement shape must match Mac's `prepareStack`: a shared-mode stack with the plate turned off must still be arranged in shared slots. “Whether to draw that plate” is handled separately by `has_real_background` later.
        let stacked_count = boxes.iter().filter(|line| line.over.is_none()).count();
        let shared_background = self.style.get("backgroundMode").and_then(Value::as_str)
            == Some("shared")
            && stacked_count > 1;
        let plate = if shared_background {
            StackPlate::Shared {
                pad_v: plate_line.map_or(0.0, |index| layouts[index].style.background_pad_v),
            }
        } else {
            StackPlate::Separate
        };
        let placements = place_lines(
            &boxes,
            (x, center_y),
            gap,
            (f64::from(self.width), f64::from(self.height)),
            parse_vertical_align(anchor_root.get("verticalAlign")),
            plate,
        );
        let span = stacked_span(&placements, &boxes);
        StackLayout {
            anchor: (x, center_y),
            overrides,
            plate_line,
            shared_background,
            placements,
            span,
        }
    }

    /// Geometry sidecar: the canvas rectangle of each subtitle line at the current time, used by the client for line hit-testing, selection boxes, and dragging.
    ///
    /// It comes from the same source as [`Self::render_subtitle_frame`] (the same single `active_layouts` and the same [`Self::stack_layout`]), except that it does not rasterize. `key` is the same content key as the overlay PNG's `X-Ccut-Overlay-Key`. The client uses it to judge “whether this geometry matches the picture in hand”.
    pub fn subtitle_layout(&mut self, time: f64) -> Result<SubtitleLayoutFrame> {
        let mut classic = self.subtitle_layout_classic(time)?;
        if self.sequence.is_none() || !(0.0..self.duration).contains(&time) {
            return Ok(classic);
        }
        let Some(plan) = self.ensure_caption_sequence() else {
            return Ok(classic);
        };
        // The key uses the same concatenation as `render_subtitle_frame` / `subtitle_scene_frame`. The host uses it to match frames
        let (frame, sequence_key, _) = self.caption_sequence_frame(&plan, time);
        classic.key = format!("{sequence_key}|{}", classic.key);
        classic.sequence = Some(self.caption_sequence_layout(&plan, &frame));
        Ok(classic)
    }

    fn subtitle_layout_classic(&mut self, time: f64) -> Result<SubtitleLayoutFrame> {
        let (canvas_w, canvas_h) = (self.width, self.height);
        let empty = move |key: String| SubtitleLayoutFrame {
            key,
            width: canvas_w,
            height: canvas_h,
            rotation: 0.0,
            anchor: (0.0, 0.0),
            lines: Vec::new(),
            sequence: None,
        };
        if !(0.0..self.duration).contains(&time) {
            return Ok(empty("blank:outside".to_owned()));
        }
        let layouts = self.active_layouts(time);
        if layouts.is_empty() {
            let next_change = self.next_change_after(time, false);
            return Ok(empty(format!(
                "blank:{}",
                next_change.map_or_else(|| "end".to_owned(), |value| format!("{value:.6}"))
            )));
        }
        let display_start = layouts
            .iter()
            .map(|line| line.item.display_start)
            .fold(f64::INFINITY, f64::min);
        let canvas_scale = f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE
            * finite(self.style.get("scale"), 1.0).max(0.05);
        let (pose, suppressed) = self.transition_pose_at(display_start, time, canvas_scale);
        let key = self.cache_key(&layouts, time, pose, suppressed);
        let stack = self.stack_layout(&layouts, canvas_scale);
        let lines = layouts
            .iter()
            .zip(&stack.placements)
            .zip(&stack.overrides)
            .map(|((line, (center_x, top)), over)| SubtitleLayoutLine {
                kind: match line.kind {
                    LineKind::Original => "orig",
                    LineKind::Translation => "trans",
                },
                cue_id: line.item.id.clone(),
                x: line_start_x(line, line.width, *center_x),
                y: *top,
                w: line.width,
                h: line.height,
                detached: over.is_some(),
            })
            .collect();
        Ok(SubtitleLayoutFrame {
            key,
            width: self.width,
            height: self.height,
            rotation: finite(self.style.get("rotation"), 0.0),
            anchor: stack.anchor,
            lines,
            sequence: None,
        })
    }

    /// R2's first real-time subtitle path. It reuses the single layout result of `active_layouts + stack_layout`, and turns ordinary single-color glyphs into atlas quads. Per-word state only changes the run-local uniform. The whole-group entrance is sampled at compositing time by `SceneMotion`. Identical Arc glyph geometry and swash masks hit the TextEngine's bounded cache and the compositor atlas, so glyph vertices are no longer rewritten and no whole RGBA image is rasterized.
    ///
    /// Any effect not yet covered returns [`SubtitleSceneFallback`], and the host continues with [`Self::render_subtitle_frame`]. This lets the migration extend pass by pass without giving up pixel semantics.
    pub fn subtitle_scene_static_fallback(&self) -> Option<SubtitleSceneFallback> {
        self.subtitle_scene_static_fallback_with_target_sampling(false)
    }

    /// The static admission criterion for when the host has already placed the real main picture into the same sampleable target. Web/App transparent overlays must not call it. Only a host that explicitly holds a backdrop may use it to allow Difference / Exclusion.
    pub fn subtitle_scene_static_fallback_with_backdrop(&self) -> Option<SubtitleSceneFallback> {
        self.subtitle_scene_static_fallback_with_target_sampling(true)
    }

    fn subtitle_scene_static_fallback_with_target_sampling(
        &self,
        allow_target_sampling: bool,
    ) -> Option<SubtitleSceneFallback> {
        // Static criterion: the whole track and every per-item override must all pass. If any one fails, the whole film falls back. Layered text animation is not decided here. It is decided per frame (`text_motion_active_at`), and frames with no active motion cue continue on the glyph scene.
        let includes_original = matches!(self.mode, StudioMode::Original | StudioMode::Bilingual);
        let overrides = match self.look_kind() {
            LineKind::Original => &self.cue_original,
            LineKind::Translation => &self.cue_translation,
        };
        let looks = std::iter::once((&self.track_look, &self.original_style))
            .chain(overrides.values().map(|entry| (&entry.look, &entry.style)));
        for (look, original_style) in looks {
            if matches!(
                look.composite,
                CaptionCompositeMode::Difference | CaptionCompositeMode::Exclusion
            ) && !allow_target_sampling
            {
                return Some(SubtitleSceneFallback::CompositeMode);
            }
            if look.composite != CaptionCompositeMode::Normal
                && !self.group_composite_scene_supported(look)
            {
                return Some(SubtitleSceneFallback::CompositeMode);
            }
            if includes_original && !glyph_uniform_animation_supported(&look.animation) {
                return Some(SubtitleSceneFallback::WordAnimation);
            }
            if includes_original
                && caption_recipe_max_stroke_width(&look.animation, original_style.font_size)
                    > f64::from(element_draw::SCENE_GLYPH_STROKE_WIDTH_LIMIT)
            {
                return Some(SubtitleSceneFallback::WordAnimation);
            }
        }
        None
    }

    /// Non-Normal modes are executed by the outer retained group. Child nodes are first merged into the transparent layer in the CPU's Normal/source-over z-order. Currently only the layer types whose child passes all have an exact scene expression are admitted. Ordinary vector/effect continues to fall back.
    fn group_composite_scene_supported(&self, look: &CaptionLook) -> bool {
        if !look.descriptor.is_some_and(|descriptor| {
            matches!(descriptor.layers.as_slice(), [glyphs] if glyphs == "glyphs")
                || matches!(descriptor.layers.as_slice(), [duplicate, glyphs]
                    if duplicate == "glyphDuplicate" && glyphs == "glyphs")
                || matches!(descriptor.layers.as_slice(), [duplicate, scanlines, glyphs]
                    if duplicate == "glyphDuplicate"
                        && scanlines == "scanlines"
                        && glyphs == "glyphs")
                || matches!(descriptor.layers.as_slice(), [particles, glyphs]
                    if particles == "particles" && glyphs == "glyphs")
        }) {
            return false;
        }
        let styles_supported = mode_lines(self.mode, &self.order).into_iter().all(|kind| {
            let (track, overrides) = match kind {
                LineKind::Original => (&self.original_style, &self.cue_original),
                LineKind::Translation => (&self.translation_style, &self.cue_translation),
            };
            std::iter::once(track)
                .chain(overrides.values().map(|entry| &entry.style))
                .all(|style| !style.background_on && !style.underline && !style.effect_on)
        });
        if !styles_supported {
            return false;
        }
        let transition = self.style.get("transition").unwrap_or(&Value::Null);
        let transition_id = transition
            .get("transitionId")
            .or_else(|| transition.get("id"))
            .and_then(Value::as_str)
            .or_else(|| self.style.get("transitionId").and_then(Value::as_str))
            .unwrap_or("none");
        !render_raster::caption_transition(transition_id)
            .is_some_and(|recipe| recipe.channels.iter().any(|channel| channel.prop == "blur"))
    }

    pub fn subtitle_scene_frame(
        &mut self,
        time: f64,
    ) -> std::result::Result<SubtitleSceneFrame, SubtitleSceneFallback> {
        self.subtitle_scene_frame_with_target_sampling(time, false)
    }

    /// Generates the subtitle scene for a host that has already put the real main picture into the same GPU target. The returned Difference / Exclusion may only be handed to a compositor entry that carries the underlying texture and has `COPY_SRC`.
    pub fn subtitle_scene_frame_with_backdrop(
        &mut self,
        time: f64,
    ) -> std::result::Result<SubtitleSceneFrame, SubtitleSceneFallback> {
        self.subtitle_scene_frame_with_target_sampling(time, true)
    }

    /// When Daoyazi takes over, the sequence layer is drawn first (history blocks, the fading previous segment, the current segment), and then the cue-level translation line is overlaid. If it does not take over, the cue-level path is used unchanged.
    fn subtitle_scene_frame_with_target_sampling(
        &mut self,
        time: f64,
        allow_target_sampling: bool,
    ) -> std::result::Result<SubtitleSceneFrame, SubtitleSceneFallback> {
        if self.text_motion_active_at(time) {
            return Err(SubtitleSceneFallback::WordAnimation);
        }
        if self.sequence.is_none() {
            return self.subtitle_scene_frame_classic(time, allow_target_sampling);
        }
        let classic = self.subtitle_scene_frame_classic(time, allow_target_sampling)?;
        if !(0.0..self.duration).contains(&time) {
            return Ok(classic);
        }
        let Some((mut nodes, sequence_key, sequence_next)) = self.caption_sequence_scene(time)?
        else {
            return Ok(classic);
        };
        let key = format!("{sequence_key}|{}", classic.key);
        let next_change = match (sequence_next, classic.scene.next_change) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        };
        nodes.extend(classic.scene.nodes);
        let fingerprint = subtitle_scene_fingerprint(&self.definition_key, &key);
        Ok(SubtitleSceneFrame {
            key,
            scene: element_draw::SceneFrame {
                nodes,
                next_change,
                active_until: classic.scene.active_until,
                fingerprint,
            },
        })
    }

    fn subtitle_scene_frame_classic(
        &mut self,
        time: f64,
        allow_target_sampling: bool,
    ) -> std::result::Result<SubtitleSceneFrame, SubtitleSceneFallback> {
        if let Some(fallback) =
            self.subtitle_scene_static_fallback_with_target_sampling(allow_target_sampling)
        {
            return Err(fallback);
        }
        // The CPU first source-overs the whole subtitle onto a transparent pixmap, and only then composites it with the backdrop. Retained children must therefore stay Normal, and non-Normal modes land only on the outer group.
        let glyph_composite = element_draw::GlyphCompositeMode::Normal;
        if !(0.0..self.duration).contains(&time) {
            return Ok(SubtitleSceneFrame {
                key: "blank:outside".to_owned(),
                scene: element_draw::SceneFrame {
                    nodes: Vec::new(),
                    next_change: (time < 0.0).then_some(0.0),
                    active_until: None,
                    fingerprint: subtitle_scene_fingerprint(&self.definition_key, "blank:outside"),
                },
            });
        }
        let layouts = self.active_layouts(time);
        if layouts.is_empty() {
            let next_change = self.next_change_after(time, false);
            let key = format!(
                "blank:{}",
                next_change.map_or_else(|| "end".to_owned(), |value| format!("{value:.6}"))
            );
            return Ok(SubtitleSceneFrame {
                scene: element_draw::SceneFrame {
                    nodes: Vec::new(),
                    next_change,
                    active_until: None,
                    fingerprint: subtitle_scene_fingerprint(&self.definition_key, &key),
                },
                key,
            });
        }
        // This frame's original-text look: subtitles with per-item styling use their own.
        let look = self.look_for_layouts(&layouts).clone();
        let scene_composite = match look.composite {
            CaptionCompositeMode::Normal => element_draw::SceneCompositeMode::Normal,
            CaptionCompositeMode::Screen => element_draw::SceneCompositeMode::Screen,
            CaptionCompositeMode::Difference => element_draw::SceneCompositeMode::Difference,
            CaptionCompositeMode::Exclusion => element_draw::SceneCompositeMode::Exclusion,
        };
        let glyph_texture = caption_recipe_glyph_texture(&look.animation);
        let display_start = layouts
            .iter()
            .map(|line| line.item.display_start)
            .fold(f64::INFINITY, f64::min);
        let canvas_scale = f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE
            * finite(self.style.get("scale"), 1.0).max(0.05);
        let (pose, suppressed) = self.transition_pose_at(display_start, time, canvas_scale);
        let key = self.cache_key(&layouts, time, pose, suppressed);
        let stack = self.stack_layout(&layouts, canvas_scale);
        let (center_x, center_y) = stack.anchor;
        let group_tf = group_transform(
            center_x,
            center_y,
            pose.scale_x,
            pose.scale_y,
            finite(self.style.get("rotation"), 0.0),
        );
        let scene_pose = element_draw::ScenePose {
            transform: transform_array(group_tf),
            opacity: pose.opacity as f32,
            blur: pose.blur as f32,
        };
        let scene_motion = pose
            .active
            .then(|| {
                subtitle_scene_motion(
                    &self.style,
                    display_start,
                    canvas_scale,
                    self.fps,
                    stack.anchor,
                    finite(self.style.get("rotation"), 0.0),
                )
            })
            .flatten();
        let background_ops = subtitle_background_ops(&layouts, &stack, &look.animation);
        // The recipe state is evaluated only once. Besides feeding the per-word uniforms, textSwap also determines this frame's actual glyph geometry. It does not rasterize the whole RGBA, but it must switch the affected glyphs at the discrete phases of the project fps. After the swap signature is folded into the bounded Arc cache, the same phase or seek reuses the same geometry.
        let word_visuals = subtitle_scene_word_visuals(&layouts, &look.animation);
        let geometry_key =
            subtitle_glyph_geometry_key_with_visuals(&self.definition_key, &layouts, &word_visuals);
        let cached_geometry = self
            .glyph_geometry_cache
            .iter()
            .position(|(cached, _)| *cached == geometry_key)
            .and_then(|index| self.glyph_geometry_cache.remove(index));
        let cached_outline_geometry = self
            .glyph_outline_geometry_cache
            .iter()
            .position(|(cached, _)| *cached == geometry_key)
            .and_then(|index| self.glyph_outline_geometry_cache.remove(index));
        let cached_decoration_geometry = self
            .glyph_decoration_geometry_cache
            .iter()
            .position(|(cached, _)| *cached == geometry_key)
            .and_then(|index| self.glyph_decoration_geometry_cache.remove(index));
        let cached_effect_geometry = self
            .glyph_effect_geometry_cache
            .iter()
            .position(|(cached, _)| *cached == geometry_key)
            .and_then(|index| self.glyph_effect_geometry_cache.remove(index));
        let cached_effect_outline_geometry = self
            .glyph_effect_outline_geometry_cache
            .iter()
            .position(|(cached, _)| *cached == geometry_key)
            .and_then(|index| self.glyph_effect_outline_geometry_cache.remove(index));
        let build_geometry = cached_geometry.is_none();
        let build_outline_geometry = cached_outline_geometry.is_none();
        let build_decoration_geometry = cached_decoration_geometry.is_none();
        let build_effect_geometry = cached_effect_geometry.is_none();
        let build_effect_outline_geometry = cached_effect_outline_geometry.is_none();
        let mut glyphs = Vec::new();
        let mut outline_glyphs = Vec::new();
        let mut decoration_glyphs = Vec::new();
        let mut effect_glyphs = (0..layouts.len()).map(|_| Vec::new()).collect::<Vec<_>>();
        let mut effect_outline_glyphs = (0..layouts.len()).map(|_| Vec::new()).collect::<Vec<_>>();
        let mut uniforms = Vec::new();
        let mut outline_uniforms = Vec::new();
        let mut decoration_uniforms = Vec::new();
        let duplicate_layer_count = caption_recipe_retained_duplicate_layer_count(&look.animation);
        let mut duplicate_uniform_layers = (0..duplicate_layer_count)
            .map(|_| Vec::new())
            .collect::<Vec<_>>();
        let recipe_stroke_layer_count = caption_recipe_retained_stroke_layer_count(&look.animation);
        let mut recipe_stroke_uniform_layers = (0..recipe_stroke_layer_count)
            .map(|_| Vec::new())
            .collect::<Vec<_>>();
        let mut effect_uniforms = (0..layouts.len()).map(|_| Vec::new()).collect::<Vec<_>>();
        let mut word_passes = Vec::new();
        let mut interleave_word_decorations = false;
        let mut word_visuals = word_visuals.into_iter();
        for (layout_index, (layout, (line_center_x, top))) in
            layouts.iter().zip(&stack.placements).enumerate()
        {
            // The classic 19-item word-motion catalogue predates retained glyphs. CPU
            // rasterization applies its block pose after every word pose and before the
            // caption-wide transition. Preserve that exact order in uniforms/DrawOps:
            // geometry remains stable while only these small values change per frame.
            let layout_motion = layout_motion(layout, &look.animation);
            let block_transform = layout_motion
                .as_ref()
                .map_or(Transform::identity(), |frame| {
                    group_transform_for_motion(
                        &frame.block,
                        *line_center_x,
                        *top + layout.height / 2.0,
                        layout.height,
                    )
                });
            let block_opacity = layout_motion
                .as_ref()
                .map_or(1.0, |frame| frame.block.opacity);
            let word_rects = caption_recipe_word_rects(layout, *line_center_x, *top);
            let pill_state = caption_recipe_pill_state(layout, &look.animation);
            let pill_groups = look
                .descriptor
                .filter(|descriptor| descriptor.layers.iter().any(|layer| layer == "pill"))
                .map(|descriptor| {
                    caption_recipe_group_indices(&layout.item.words, descriptor.grouping.as_ref())
                });
            let mut line_top = *top;
            for line in layout.lines.iter() {
                let line_height = line
                    .height
                    .max(layout.style.font_size * layout.style.line_height);
                let mut cursor = line_start_x(layout, line.width, *line_center_x);
                for chunk in &line.chunks {
                    let (part_opacity, part_dx, part_dy) = chunk_part_delta(layout, chunk);
                    let visual = word_visuals
                        .next()
                        .expect("scene word visual 必须与 layout chunk 一一对应");
                    let stable_emoji = (layout.kind == LineKind::Original)
                        .then(|| {
                            let design = look.animation.caption.as_ref()?;
                            let word_index = chunk.word?;
                            caption_recipe_word_emoji(design, &layout.item, word_index)
                        })
                        .flatten()
                        .filter(|emoji| !emoji.is_empty());
                    let opacity = block_opacity
                        * part_opacity
                        * clamp(visual.opacity.unwrap_or(1.0), 0.0, 1.0);
                    let color = visual.color.or(chunk.color).unwrap_or(layout.style.color);
                    let paint = glyph_uniform_paint(&look.animation, &visual, opacity);
                    let bounce = visual.bottom_em.unwrap_or(0.0) * layout.style.font_size;
                    // The stable geometry has already placed the glyph at the un-animated canvas coordinates. The run uniform first adds the chunk part/bounce, then applies Designed Caption's per-word pose. The compositor applies scene_pose last. This order is exactly the same as the CPU `glyph_canvas_transform`'s `placement -> recipe -> group`.
                    let recipe_transform = caption_recipe_transform(
                        layout,
                        chunk,
                        cursor + part_dx,
                        line_top + part_dy,
                        line_height,
                        visual.recipe.as_ref(),
                    );
                    let word_motion_transform = motion_chunk_transform(
                        layout_motion.as_ref(),
                        chunk,
                        cursor,
                        *line_center_x,
                        *top,
                        layout.height,
                        line_top,
                        line_height,
                    );
                    let run_transform =
                        Transform::from_translate(part_dx as f32, (part_dy - bounce) as f32)
                            .post_concat(word_motion_transform)
                            .post_concat(recipe_transform)
                            .post_concat(block_transform);
                    // The fragment is clipped in the canvas coordinates of the stable geometry. The CPU mask first carries the part delta and then applies recipe/group. After the run translate is reversed, the x/y part cancels out exactly, while bounce must be added back to the un-animated coordinates.
                    let clip = caption_recipe_clip_box(
                        cursor,
                        line_top + bounce,
                        chunk.width,
                        line_height,
                        visual.recipe.as_ref(),
                    )
                    .map(|[x, y, width, height]| {
                        [x as f32, y as f32, (x + width) as f32, (y + height) as f32]
                    });
                    if uniforms.len() >= element_draw::GLYPH_RUN_UNIFORM_LIMIT {
                        return Err(SubtitleSceneFallback::SceneLimit);
                    }
                    let uniform_index = u32::try_from(uniforms.len())
                        .map_err(|_| SubtitleSceneFallback::SceneLimit)?;
                    uniforms.push(element_draw::GlyphRunUniform {
                        transform: transform_array(run_transform),
                        color: glyph_uniform_color(color, opacity),
                        color_opacity: opacity as f32,
                        clip,
                        paint,
                    });
                    outline_uniforms.push(element_draw::GlyphRunUniform {
                        transform: transform_array(run_transform),
                        color: glyph_uniform_color(layout.style.outline_color, opacity),
                        color_opacity: opacity as f32,
                        clip,
                        paint: element_draw::GlyphPaint::Solid,
                    });
                    let emoji_opacity = visual
                        .recipe
                        .as_ref()
                        .and_then(|state| state.emoji.as_deref())
                        .filter(|emoji| !emoji.is_empty())
                        .map_or(0.0, |_| opacity);
                    decoration_uniforms.push(element_draw::GlyphRunUniform {
                        // The CPU decoration receives a cursor and line_top that already include the part delta, but it does not consume the recipe transform or the bounce.
                        transform: transform_array(Transform::from_translate(
                            part_dx as f32,
                            part_dy as f32,
                        )),
                        color: glyph_uniform_color(SubtitleColor::WHITE, emoji_opacity),
                        color_opacity: emoji_opacity as f32,
                        clip: None,
                        paint: element_draw::GlyphPaint::Solid,
                    });
                    let duplicate_layers = if layout.kind == LineKind::Original {
                        caption_recipe_retained_glyph_duplicate_layers(
                            layout,
                            &look.animation,
                            &visual,
                            opacity,
                        )
                    } else {
                        Vec::new()
                    };
                    let has_duplicate_layers = !duplicate_layers.is_empty();
                    for (layer_index, layer_uniforms) in
                        duplicate_uniform_layers.iter_mut().enumerate()
                    {
                        let (transform, duplicate_color, duplicate_opacity) = duplicate_layers
                            .get(layer_index)
                            .copied()
                            .map_or((run_transform, layout.style.color, 0.0), |duplicate| {
                                let (dx, dy) = glyph_duplicate_canvas_offset(chunk, duplicate);
                                (
                                    Transform::from_translate(dx as f32, dy as f32)
                                        .post_concat(run_transform),
                                    duplicate.color,
                                    duplicate.opacity,
                                )
                            });
                        layer_uniforms.push(element_draw::GlyphRunUniform {
                            transform: transform_array(transform),
                            color: glyph_uniform_color(duplicate_color, duplicate_opacity),
                            color_opacity: duplicate_opacity as f32,
                            clip,
                            paint: element_draw::GlyphPaint::Solid,
                        });
                    }
                    let recipe_strokes = if layout.kind == LineKind::Original {
                        caption_recipe_glyph_stroke_layers(
                            layout,
                            &look.animation,
                            &visual,
                            opacity,
                            true,
                        )
                    } else {
                        Vec::new()
                    };
                    let has_recipe_strokes =
                        layout.kind == LineKind::Original && recipe_stroke_layer_count > 0;
                    for (layer_index, layer_uniforms) in
                        recipe_stroke_uniform_layers.iter_mut().enumerate()
                    {
                        let stroke = recipe_strokes.get(layer_index).copied();
                        let stroke_opacity = stroke.map_or(0.0, |stroke| stroke.opacity);
                        layer_uniforms.push(element_draw::GlyphRunUniform {
                            transform: transform_array(run_transform),
                            color: glyph_uniform_color(
                                stroke.map_or(layout.style.color, |stroke| stroke.color),
                                stroke_opacity,
                            ),
                            color_opacity: stroke_opacity as f32,
                            clip,
                            paint: element_draw::GlyphPaint::DilatedStroke {
                                width: stroke.map_or(0.0, |stroke| stroke.width) as f32,
                            },
                        });
                    }
                    let effect_uniform_index = if layout.style.effect_on {
                        if effect_uniforms[layout_index].len()
                            >= element_draw::GLYPH_RUN_UNIFORM_LIMIT
                        {
                            return Err(SubtitleSceneFallback::SceneLimit);
                        }
                        let index = u32::try_from(effect_uniforms[layout_index].len())
                            .map_err(|_| SubtitleSceneFallback::SceneLimit)?;
                        effect_uniforms[layout_index].push(element_draw::GlyphRunUniform {
                            transform: transform_array(run_transform),
                            color: glyph_uniform_color(
                                layout.style.effect_color,
                                if visual.shadow_off { 0.0 } else { opacity },
                            ),
                            color_opacity: if visual.shadow_off {
                                0.0
                            } else {
                                opacity as f32
                            },
                            clip,
                            paint: element_draw::GlyphPaint::Solid,
                        });
                        Some(index)
                    } else {
                        None
                    };
                    let baseline = glyph_baseline(line_top, line_height, chunk, 0.0);
                    if build_decoration_geometry && let Some(emoji) = stable_emoji.as_deref() {
                        let size = layout.style.font_size * 0.62;
                        let shaped = self.text.shape(emoji, &layout.style.font_name, size, 400);
                        let emoji_x = cursor + chunk.width - layout.style.font_size * 0.08;
                        let emoji_baseline =
                            line_top - layout.style.font_size * 0.52 + shaped.ascent;
                        for glyph in &shaped.glyphs {
                            let transform = Transform::from_translate(
                                (emoji_x + glyph.x) as f32,
                                (emoji_baseline + glyph.y) as f32,
                            );
                            if let Some(mask) =
                                glyph_scene_mask(self.text.glyph_atlas_render(glyph.cache_key))?
                            {
                                decoration_glyphs.push(element_draw::GlyphInstance {
                                    mask,
                                    transform: transform_array(transform),
                                    uniform_index,
                                });
                            }
                        }
                    }
                    let mut before = caption_recipe_rounded_decorations(
                        layout,
                        &look.animation,
                        &visual,
                        chunk.word,
                        cursor + part_dx,
                        chunk.width,
                        line_top + part_dy,
                        line_height,
                        opacity,
                        true,
                    )
                    .into_iter()
                    .map(|decoration| {
                        element_draw::SceneNode::RoundedRect(Arc::new(
                            element_draw::RoundedRectNode {
                                rect: decoration.rect.map(|value| value as f32),
                                radius: decoration.radius as f32,
                                color: subtitle_scene_color(decoration.color, decoration.opacity),
                                pose: scene_pose,
                                motion: scene_motion.clone(),
                            },
                        ))
                    })
                    .collect::<Vec<_>>();
                    interleave_word_decorations |= !before.is_empty();
                    if let Some(plate) = caption_recipe_plate(
                        layout,
                        &look.animation,
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
                        before.push(element_draw::SceneNode::RoundedRect(Arc::new(
                            element_draw::RoundedRectNode {
                                rect: [
                                    plate.x as f32,
                                    plate.y as f32,
                                    plate.width as f32,
                                    plate.height as f32,
                                ],
                                radius: plate.radius as f32,
                                color: subtitle_scene_color(plate.color, plate.opacity),
                                pose: scene_pose,
                                motion: scene_motion.clone(),
                            },
                        )));
                        interleave_word_decorations = true;
                    } else if visual.recipe.is_none()
                        && let Some(background) = visual.background
                    {
                        let mut frame = FrameOps::default();
                        // The geometry and alpha both come from the same pair, `classic_word_box` and `classic_word_box_alpha`, that the CPU `draw_line_layout` uses. The block's expansion and contraction and the block's alpha must match field for field on both rendering chains. Here `opacity` is already `part_opacity × word opacity`, while the block needs `part_opacity × block alpha`, so it cannot be reused directly.
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
                        push_subtitle_word_background(
                            &mut frame,
                            box_rect.x,
                            box_rect.y,
                            box_rect.width,
                            box_rect.height,
                            box_rect.radius,
                            background,
                            block_opacity * part_opacity * classic_word_box_alpha(&visual),
                            word_motion_transform.post_concat(block_transform),
                        );
                        before.push(element_draw::SceneNode::AnimatedVectors {
                            frame: Arc::new(frame),
                            pose: scene_pose,
                            motion: scene_motion.clone(),
                        });
                        interleave_word_decorations = true;
                    }
                    if build_geometry
                        || build_outline_geometry
                        || (effect_uniform_index.is_some()
                            && (build_effect_geometry || build_effect_outline_geometry))
                    {
                        let replacement = visual
                            .recipe
                            .as_ref()
                            .and_then(|state| state.text_swap.as_deref())
                            .map(|text| {
                                self.text.shape(
                                    text,
                                    &chunk.font_name,
                                    chunk.font_size,
                                    chunk.font_weight,
                                )
                            });
                        let shaped = replacement.as_ref().unwrap_or(&chunk.shaped);
                        for (glyph_index, glyph) in shaped.glyphs.iter().enumerate() {
                            let glyph_x =
                                cursor + glyph.x + glyph_index as f64 * layout.style.letter_spacing;
                            let transform = glyph_canvas_transform(
                                chunk,
                                glyph_x,
                                baseline + glyph.y,
                                Transform::identity(),
                                Transform::identity(),
                            );
                            if build_geometry {
                                if let Some(mask) =
                                    glyph_scene_mask(self.text.glyph_atlas_render(glyph.cache_key))?
                                {
                                    glyphs.push(element_draw::GlyphInstance {
                                        mask,
                                        transform: transform_array(transform),
                                        uniform_index,
                                    });
                                }
                            }
                            if build_outline_geometry
                                && layout.style.outline_on
                                && layout.style.outline_width > 0.0
                                && let Some(mask) =
                                    glyph_scene_mask(self.text.glyph_stroke_atlas_render(
                                        glyph.cache_key,
                                        layout.style.outline_width as f32,
                                    ))?
                            {
                                outline_glyphs.push(element_draw::GlyphInstance {
                                    mask,
                                    transform: transform_array(transform),
                                    uniform_index,
                                });
                            }
                            if let Some(effect_uniform_index) = effect_uniform_index {
                                let effect_transform = Transform::from_translate(
                                    layout.style.effect_x as f32,
                                    layout.style.effect_y as f32,
                                )
                                .post_concat(transform);
                                if build_effect_outline_geometry
                                    && layout.style.outline_on
                                    && layout.style.outline_width > 0.0
                                    && let Some(mask) =
                                        glyph_scene_mask(self.text.glyph_stroke_atlas_render(
                                            glyph.cache_key,
                                            layout.style.outline_width as f32,
                                        ))?
                                {
                                    effect_outline_glyphs[layout_index].push(
                                        element_draw::GlyphInstance {
                                            mask,
                                            transform: transform_array(effect_transform),
                                            uniform_index: effect_uniform_index,
                                        },
                                    );
                                }
                                if build_effect_geometry
                                    && let Some(mask) = glyph_scene_effect_mask(
                                        self.text.glyph_atlas_render(glyph.cache_key),
                                    )?
                                {
                                    effect_glyphs[layout_index].push(element_draw::GlyphInstance {
                                        mask,
                                        transform: transform_array(effect_transform),
                                        uniform_index: effect_uniform_index,
                                    });
                                }
                            }
                        }
                    }
                    let effective_underline = visual.underline.unwrap_or(layout.style.underline);
                    let mut after = FrameOps::default();
                    if effective_underline {
                        push_subtitle_underline(
                            &mut after,
                            cursor + part_dx,
                            baseline
                                + layout.style.font_size
                                    * visual.underline_offset_em.unwrap_or(0.10)
                                + part_dy
                                - bounce,
                            chunk.width,
                            layout.style.font_size,
                            color,
                            opacity,
                            block_transform,
                        );
                    }
                    interleave_word_decorations |= effective_underline != layout.style.underline;
                    word_passes.push(SubtitleWordPass {
                        uniform_index,
                        before,
                        after,
                        duplicate: has_duplicate_layers,
                        recipe_stroke: has_recipe_strokes,
                        emoji: stable_emoji.is_some(),
                    });
                    interleave_word_decorations |=
                        has_duplicate_layers || has_recipe_strokes || stable_emoji.is_some();
                    cursor += chunk.width;
                }
                line_top += line_height + line.gap_after;
            }
        }
        debug_assert!(word_visuals.next().is_none());
        let geometry = if let Some((_, geometry)) = cached_geometry {
            self.glyph_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            geometry
        } else {
            let geometry: Arc<[element_draw::GlyphInstance]> = glyphs.into();
            self.glyph_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            while self.glyph_geometry_cache.len() > 12 {
                self.glyph_geometry_cache.pop_back();
            }
            geometry
        };
        let duplicate_geometry = duplicate_glyph_geometry(
            &geometry_key,
            &geometry,
            &mut self.glyph_segment_geometry_cache,
        );
        let decoration_geometry = if let Some((_, geometry)) = cached_decoration_geometry {
            self.glyph_decoration_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            geometry
        } else {
            let geometry: Arc<[element_draw::GlyphInstance]> = decoration_glyphs.into();
            self.glyph_decoration_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            while self.glyph_decoration_geometry_cache.len() > 12 {
                self.glyph_decoration_geometry_cache.pop_back();
            }
            geometry
        };
        let outline_geometry = if let Some((_, geometry)) = cached_outline_geometry {
            self.glyph_outline_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            geometry
        } else {
            let geometry: Arc<[element_draw::GlyphInstance]> = outline_glyphs.into();
            self.glyph_outline_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            while self.glyph_outline_geometry_cache.len() > 12 {
                self.glyph_outline_geometry_cache.pop_back();
            }
            geometry
        };
        let effect_geometry = if let Some((_, geometry)) = cached_effect_geometry {
            self.glyph_effect_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            geometry
        } else {
            let geometry: Arc<[Arc<[element_draw::GlyphInstance]>]> = effect_glyphs
                .into_iter()
                .map(Arc::<[element_draw::GlyphInstance]>::from)
                .collect::<Vec<_>>()
                .into();
            self.glyph_effect_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            while self.glyph_effect_geometry_cache.len() > 12 {
                self.glyph_effect_geometry_cache.pop_back();
            }
            geometry
        };
        let effect_outline_geometry = if let Some((_, geometry)) = cached_effect_outline_geometry {
            self.glyph_effect_outline_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            geometry
        } else {
            let geometry: Arc<[Arc<[element_draw::GlyphInstance]>]> = effect_outline_glyphs
                .into_iter()
                .map(Arc::<[element_draw::GlyphInstance]>::from)
                .collect::<Vec<_>>()
                .into();
            self.glyph_effect_outline_geometry_cache
                .push_front((geometry_key.clone(), Arc::clone(&geometry)));
            while self.glyph_effect_outline_geometry_cache.len() > 12 {
                self.glyph_effect_outline_geometry_cache.pop_back();
            }
            geometry
        };
        let mut nodes = Vec::with_capacity(3 + layouts.len());
        if !background_ops.ops.is_empty() {
            if scene_pose == element_draw::ScenePose::IDENTITY && scene_motion.is_none() {
                nodes.push(element_draw::SceneNode::Vectors(Arc::new(background_ops)));
            } else {
                nodes.push(element_draw::SceneNode::AnimatedVectors {
                    frame: Arc::new(background_ops),
                    pose: scene_pose,
                    motion: scene_motion.clone(),
                });
            }
        }
        for (layout_index, layout) in layouts.iter().enumerate() {
            if !layout.style.effect_on {
                continue;
            }
            let mut layers = Vec::with_capacity(2);
            if !effect_outline_geometry[layout_index].is_empty() {
                layers.push(Arc::new(element_draw::GlyphRun {
                    glyphs: Arc::clone(&effect_outline_geometry[layout_index]),
                    uniforms: effect_uniforms[layout_index].clone(),
                    texture: None,
                    composite: element_draw::GlyphCompositeMode::Normal,
                    pose: scene_pose,
                    motion: scene_motion.clone(),
                }));
            }
            if !effect_geometry[layout_index].is_empty() {
                layers.push(Arc::new(element_draw::GlyphRun {
                    glyphs: Arc::clone(&effect_geometry[layout_index]),
                    uniforms: effect_uniforms[layout_index].clone(),
                    texture: None,
                    composite: element_draw::GlyphCompositeMode::Normal,
                    pose: scene_pose,
                    motion: scene_motion.clone(),
                }));
            }
            if !layers.is_empty() {
                nodes.push(element_draw::SceneNode::BlurredGlyphs(Arc::new(
                    element_draw::GlyphEffect {
                        layers,
                        radius: layout
                            .style
                            .effect_blur
                            .round()
                            .clamp(0.0, f64::from(element_draw::SCENE_BLUR_RADIUS_LIMIT))
                            as u32,
                    },
                )));
            }
        }
        if interleave_word_decorations {
            if word_passes.len() > SUBTITLE_INTERLEAVED_RUN_LIMIT {
                return Err(SubtitleSceneFallback::SceneLimit);
            }
            push_interleaved_word_nodes(
                &mut nodes,
                word_passes,
                &geometry_key,
                &outline_geometry,
                &geometry,
                &duplicate_geometry,
                &decoration_geometry,
                &outline_uniforms,
                &uniforms,
                &duplicate_uniform_layers,
                &recipe_stroke_uniform_layers,
                &decoration_uniforms,
                glyph_texture.as_ref(),
                scene_pose,
                scene_motion.as_ref(),
                glyph_composite,
                &mut self.glyph_segment_geometry_cache,
            );
        } else {
            if !outline_geometry.is_empty() {
                nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                    element_draw::GlyphRun {
                        glyphs: outline_geometry,
                        uniforms: outline_uniforms,
                        texture: None,
                        composite: glyph_composite,
                        pose: scene_pose,
                        motion: scene_motion.clone(),
                    },
                )));
            }
            if !geometry.is_empty() {
                nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                    element_draw::GlyphRun {
                        glyphs: geometry,
                        uniforms,
                        texture: glyph_texture,
                        composite: glyph_composite,
                        pose: scene_pose,
                        motion: scene_motion.clone(),
                    },
                )));
            }
            let mut underline_ops = FrameOps::default();
            for pass in word_passes {
                underline_ops.ops.extend(pass.after.ops);
            }
            if !underline_ops.ops.is_empty() {
                nodes.push(element_draw::SceneNode::AnimatedVectors {
                    frame: Arc::new(underline_ops),
                    pose: scene_pose,
                    motion: scene_motion.clone(),
                });
            }
        }
        let nodes = if scene_composite != element_draw::SceneCompositeMode::Normal
            || pose.blur > 0.001
            || scene_motion
                .as_ref()
                .is_some_and(|motion| motion.from.blur > 0.001 || motion.to.blur > 0.001)
        {
            vec![element_draw::SceneNode::BlurredGroup(Arc::new(
                element_draw::BlurredGroup {
                    nodes,
                    radius: pose.blur as f32,
                    motion: scene_motion.clone(),
                    reveal: None,
                    composite: scene_composite,
                },
            ))]
        } else {
            nodes
        };
        let motion_end = scene_motion.as_ref().map(|motion| motion.end);
        // The Designed Caption recipe resolver produces per-word uniforms on the project's fps grid. It does not re-rasterize the whole subtitle, but the host must still rebuild the uniforms at the next discrete sample. Ordinary subtitles, and the already-lowered whole-group transition motion, continue to report only real boundaries.
        let next_change = min_optional_time(
            self.next_change_after(time, self.per_frame_subtitle(false)),
            motion_end,
        );
        let active_until = motion_end
            .map(|end| next_change.unwrap_or(end).min(end))
            .filter(|end| *end > time + 1e-9);
        Ok(SubtitleSceneFrame {
            scene: element_draw::SceneFrame {
                nodes,
                next_change,
                active_until,
                fingerprint: subtitle_scene_fingerprint(&self.definition_key, &key),
            },
            key,
        })
    }

    /// The retained scene exit for R3's ordinary text elements. Layout, wrapping, glyph masks, plates, outline, and shadow/glow all reuse the same `LineLayout` / `TextEngine` results as [`Self::render_text_element`]. Only the final execution changes: from a whole Pixmap to renderer-neutral vector and glyph nodes.
    ///
    /// Element animation is still sampled by [`timeline::resolve_text_animation`] on the project's fps grid. The container pose changes only [`element_draw::ScenePose`], cascading text changes only the run-local uniform, and glyph masks are not re-rasterized per frame. `next_change` shares [`Self::element_next_change`] with the CPU overlay.
    pub fn text_element_scene_frame_for(
        &mut self,
        element_id: &str,
        time: f64,
    ) -> Result<element_draw::SceneFrame> {
        let element = self
            .elements
            .iter()
            .find(|element| element.id == element_id && element.kind == ElementKind::Text)
            .cloned()
            .with_context(|| format!("text element {element_id} 不存在"))?;
        let time = time.clamp(0.0, self.duration.max(0.0));
        let active = time >= element.start && time < element.end;
        let nodes = if active {
            self.text_element_scene_nodes(&element, time)
                .map_err(|error| anyhow!(error))?
        } else {
            Vec::new()
        };
        let active_elements = active.then_some(element).into_iter().collect::<Vec<_>>();
        let next_change = self.element_next_change(time, &active_elements);
        let key = format!("text:{element_id}:{time:.6}");
        Ok(element_draw::SceneFrame {
            nodes,
            next_change,
            active_until: None,
            fingerprint: subtitle_scene_fingerprint(&self.definition_key, &key),
        })
    }

    pub fn text_element_scene_frame(
        &mut self,
        time: f64,
    ) -> std::result::Result<element_draw::SceneFrame, SubtitleSceneFallback> {
        let time = time.clamp(0.0, self.duration.max(0.0));
        let active = self
            .elements
            .iter()
            .filter(|element| {
                element.kind == ElementKind::Text && time >= element.start && time < element.end
            })
            .cloned()
            .collect::<Vec<_>>();
        let next_change = self.element_next_change(time, &active);
        let mut nodes = Vec::new();
        let mut identity = String::new();
        for element in &active {
            identity.push_str(&element.id);
            identity.push('\u{1f}');
            if element.has_visual_keyframes() {
                let mut element = element.clone();
                element.keyframe_place(time);
                identity.push_str(&format!("{:?}\u{1f}", element.place));
                nodes.extend(self.text_element_scene_nodes(&element, time)?);
            } else {
                nodes.extend(self.text_element_scene_nodes(element, time)?);
            }
        }
        let key = format!("texts:{time:.6}:{identity}");
        Ok(element_draw::SceneFrame {
            nodes,
            next_change,
            active_until: None,
            fingerprint: subtitle_scene_fingerprint(&self.definition_key, &key),
        })
    }

    fn text_element_scene_nodes(
        &mut self,
        element: &TimelineVisualElement,
        time: f64,
    ) -> std::result::Result<Vec<element_draw::SceneNode>, SubtitleSceneFallback> {
        if element.style["textMotion"].is_object() || element.style["wordBackground"].is_object() {
            return Err(SubtitleSceneFallback::WordAnimation);
        }
        let mut style = resolve_line_style(
            &element.style,
            LineKind::Original,
            self.width,
            self.height,
            false,
        );
        let item = TimedItem {
            id: element.id.clone(),
            series_index: 0,
            text: element_display_text(element, time),
            display_start: element.start,
            display_end: element.end,
            words: Vec::new(),
        };
        let wrap_width = element.place.w.map_or_else(
            || f64::from(self.width) * 0.9,
            |width| f64::from(self.width) * width.max(1.0) / 100.0,
        );
        text_element_block_plate(&mut style, element, wrap_width);
        let display_text = transform_text(&item.text, &style.text_transform);
        let animation = timeline::resolve_text_animation(
            element.animation.as_ref(),
            element.start,
            Some(element.end),
            self.duration,
            time,
            self.fps,
            &display_text,
        );
        let interleave_animated_underlines = style.underline && !animation.ranges.is_empty();
        let pose = animation.container;
        let part_ranges = (!animation.ranges.is_empty()).then_some(animation.ranges.as_slice());
        let (lines, width) = layout_text(&mut self.text, &item, &style, wrap_width, part_ranges);
        let lines: Arc<[LayoutLine]> = lines.into();
        let layout = LineLayout {
            kind: LineKind::Original,
            height: layout_lines_height(&lines),
            width,
            align_width: wrap_width,
            text_align: LineTextAlign::from_style(&element.style),
            style,
            item,
            lines,
            current_word: 0,
            render_time: time,
            render_fps: self.fps,
            animation_parts: animation.parts,
            animation_short_edge: f64::from(self.width.min(self.height)),
            preview: false,
            karaoke_words: None,
            guide_below: false,
        };
        let base_x = f64::from(self.width) * element.place.x.unwrap_or(50.0) / 100.0;
        let base_y = f64::from(self.height) * element.place.y.unwrap_or(50.0) / 100.0;
        let short = f64::from(self.width.min(self.height));
        let x = base_x + pose.dx * short;
        let y = base_y + pose.dy * short;
        let scale = element.place.scale.unwrap_or(1.0);
        // Round 122 D2: `scaleY` is a vertical multiplier **applied on top of `scale`** (absent = 1). It is not “a vertical component that replaces `scale`”. When it is absent, both readings give the same value, so old documents are byte-identical.
        let scale_y = scale * element.place.scale_y.unwrap_or(1.0);
        let rotation = element.place.rot.unwrap_or(0.0) + pose.rotation;
        let opacity = element.place.opacity.unwrap_or(1.0) * pose.opacity;
        let tile = element.tile.as_ref().filter(|tile| tile.on);
        let gap_x = tile.and_then(|tile| tile.gap_x).unwrap_or(8.0);
        let gap_y = tile.and_then(|tile| tile.gap_y).unwrap_or(10.0);
        let step_x = (layout.width + f64::from(self.width) * gap_x / 100.0).max(1.0);
        let step_y = (layout.height + f64::from(self.height) * gap_y / 100.0).max(1.0);
        let centers = if let Some(tile) = tile {
            let mut centers = Vec::new();
            let cols = (f64::from(self.width) / step_x).ceil() as i32 + 3;
            let rows = (f64::from(self.height) / step_y).ceil() as i32 + 3;
            for row in -rows..=rows {
                let stagger = if tile.stagger.unwrap_or(true) && row.rem_euclid(2) != 0 {
                    step_x / 2.0
                } else {
                    0.0
                };
                for column in -cols..=cols {
                    centers.push((
                        x + f64::from(column) * step_x + stagger,
                        y + f64::from(row) * step_y,
                        rotation + tile.angle.unwrap_or(-30.0),
                    ));
                }
            }
            centers
        } else {
            vec![(x, y, rotation)]
        };

        struct CrispChunkPass {
            outline_glyphs: Vec<element_draw::GlyphInstance>,
            glyphs: Vec<element_draw::GlyphInstance>,
            outline_uniform: element_draw::GlyphRunUniform,
            fill_uniform: element_draw::GlyphRunUniform,
            underline: FrameOps,
        }

        let mut nodes = Vec::new();
        for (center_x, center_y, rotation) in centers {
            let scene_pose = element_draw::ScenePose {
                transform: transform_array(group_transform(
                    center_x,
                    center_y,
                    scale * pose.scale_x,
                    scale_y * pose.scale_y,
                    rotation,
                )),
                opacity: opacity.clamp(0.0, 1.0) as f32,
                blur: pose.blur.max(0.0) as f32,
            };
            let pad_v = layout.style.background_pad_v;
            let top = anchor_block(
                center_y,
                layout.height + pad_v * 2.0,
                element.vertical_align.unwrap_or(VerticalAlign::Center),
            ) + pad_v;
            let mut stamp_nodes = Vec::new();
            if layout.style.background_on {
                let mut background = FrameOps::default();
                for rect in line_background_rects(&layout, center_x, top) {
                    push_subtitle_plate(
                        &mut background,
                        rect,
                        layout.style.background_color,
                        1.0,
                        Transform::identity(),
                    );
                }
                if !background.ops.is_empty() {
                    stamp_nodes.push(element_draw::SceneNode::AnimatedVectors {
                        frame: Arc::new(background),
                        pose: scene_pose,
                        motion: None,
                    });
                }
            }

            let mut glyphs = Vec::new();
            let mut outline_glyphs = Vec::new();
            let mut effect_glyphs = Vec::new();
            let mut effect_outline_glyphs = Vec::new();
            let mut uniforms = Vec::new();
            let mut outline_uniforms = Vec::new();
            let mut effect_uniforms = Vec::new();
            let mut underline_ops = FrameOps::default();
            let mut crisp_chunk_passes = Vec::new();
            let mut line_top = top;
            for line in layout.lines.iter() {
                let line_height = line
                    .height
                    .max(layout.style.font_size * layout.style.line_height);
                let mut cursor = line_start_x(&layout, line.width, center_x);
                for chunk in &line.chunks {
                    if uniforms.len() >= element_draw::GLYPH_RUN_UNIFORM_LIMIT {
                        return Err(SubtitleSceneFallback::SceneLimit);
                    }
                    let (part_opacity, part_dx, part_dy) = chunk_part_delta(&layout, chunk);
                    let uniform_index = u32::try_from(uniforms.len())
                        .map_err(|_| SubtitleSceneFallback::SceneLimit)?;
                    let run_transform = Transform::from_translate(part_dx as f32, part_dy as f32);
                    let fill_uniform = element_draw::GlyphRunUniform {
                        transform: transform_array(run_transform),
                        color: glyph_uniform_color(
                            chunk.color.unwrap_or(layout.style.color),
                            part_opacity,
                        ),
                        color_opacity: part_opacity as f32,
                        clip: None,
                        paint: element_draw::GlyphPaint::Solid,
                    };
                    let outline_uniform = element_draw::GlyphRunUniform {
                        transform: transform_array(run_transform),
                        color: glyph_uniform_color(layout.style.outline_color, part_opacity),
                        color_opacity: part_opacity as f32,
                        clip: None,
                        paint: element_draw::GlyphPaint::Solid,
                    };
                    uniforms.push(fill_uniform);
                    outline_uniforms.push(outline_uniform);
                    if layout.style.effect_on {
                        effect_uniforms.push(element_draw::GlyphRunUniform {
                            transform: transform_array(run_transform),
                            color: glyph_uniform_color(layout.style.effect_color, part_opacity),
                            color_opacity: part_opacity as f32,
                            clip: None,
                            paint: element_draw::GlyphPaint::Solid,
                        });
                    }
                    let crisp_uniform_index = if interleave_animated_underlines {
                        0
                    } else {
                        uniform_index
                    };
                    let mut chunk_glyphs = Vec::new();
                    let mut chunk_outline_glyphs = Vec::new();
                    let baseline = glyph_baseline(line_top, line_height, chunk, 0.0);
                    for (glyph_index, glyph) in chunk.shaped.glyphs.iter().enumerate() {
                        let glyph_x =
                            cursor + glyph.x + glyph_index as f64 * layout.style.letter_spacing;
                        let transform = glyph_canvas_transform(
                            chunk,
                            glyph_x,
                            baseline + glyph.y,
                            Transform::identity(),
                            Transform::identity(),
                        );
                        if let Some(mask) =
                            glyph_scene_mask(self.text.glyph_atlas_render(glyph.cache_key))?
                        {
                            chunk_glyphs.push(element_draw::GlyphInstance {
                                mask,
                                transform: transform_array(transform),
                                uniform_index: crisp_uniform_index,
                            });
                        }
                        if layout.style.outline_on
                            && layout.style.outline_width > 0.0
                            && let Some(mask) =
                                glyph_scene_mask(self.text.glyph_stroke_atlas_render(
                                    glyph.cache_key,
                                    layout.style.outline_width as f32,
                                ))?
                        {
                            chunk_outline_glyphs.push(element_draw::GlyphInstance {
                                mask,
                                transform: transform_array(transform),
                                uniform_index: crisp_uniform_index,
                            });
                        }
                        if layout.style.effect_on {
                            let effect_transform = Transform::from_translate(
                                layout.style.effect_x as f32,
                                layout.style.effect_y as f32,
                            )
                            .post_concat(transform);
                            if let Some(mask) = glyph_scene_effect_mask(
                                self.text.glyph_atlas_render(glyph.cache_key),
                            )? {
                                effect_glyphs.push(element_draw::GlyphInstance {
                                    mask,
                                    transform: transform_array(effect_transform),
                                    uniform_index,
                                });
                            }
                            if layout.style.outline_on
                                && layout.style.outline_width > 0.0
                                && let Some(mask) =
                                    glyph_scene_mask(self.text.glyph_stroke_atlas_render(
                                        glyph.cache_key,
                                        layout.style.outline_width as f32,
                                    ))?
                            {
                                effect_outline_glyphs.push(element_draw::GlyphInstance {
                                    mask,
                                    transform: transform_array(effect_transform),
                                    uniform_index,
                                });
                            }
                        }
                    }
                    let mut chunk_underline = FrameOps::default();
                    if layout.style.underline {
                        push_subtitle_underline(
                            &mut chunk_underline,
                            cursor + part_dx,
                            baseline + layout.style.font_size * 0.10 + part_dy,
                            chunk.width,
                            layout.style.font_size,
                            chunk.color.unwrap_or(layout.style.color),
                            part_opacity,
                            Transform::identity(),
                        );
                    }
                    if interleave_animated_underlines {
                        crisp_chunk_passes.push(CrispChunkPass {
                            outline_glyphs: chunk_outline_glyphs,
                            glyphs: chunk_glyphs,
                            outline_uniform,
                            fill_uniform,
                            underline: chunk_underline,
                        });
                    } else {
                        outline_glyphs.extend(chunk_outline_glyphs);
                        glyphs.extend(chunk_glyphs);
                        underline_ops.ops.extend(chunk_underline.ops);
                    }
                    cursor += chunk.width;
                }
                line_top += line_height + line.gap_after;
            }

            if layout.style.effect_on {
                let mut layers = Vec::with_capacity(2);
                if !effect_outline_glyphs.is_empty() {
                    layers.push(Arc::new(element_draw::GlyphRun {
                        glyphs: effect_outline_glyphs.into(),
                        uniforms: effect_uniforms.clone(),
                        texture: None,
                        composite: element_draw::GlyphCompositeMode::Normal,
                        pose: scene_pose,
                        motion: None,
                    }));
                }
                if !effect_glyphs.is_empty() {
                    layers.push(Arc::new(element_draw::GlyphRun {
                        glyphs: effect_glyphs.into(),
                        uniforms: effect_uniforms,
                        texture: None,
                        composite: element_draw::GlyphCompositeMode::Normal,
                        pose: scene_pose,
                        motion: None,
                    }));
                }
                if !layers.is_empty() {
                    stamp_nodes.push(element_draw::SceneNode::BlurredGlyphs(Arc::new(
                        element_draw::GlyphEffect {
                            layers,
                            radius: layout
                                .style
                                .effect_blur
                                .round()
                                .clamp(0.0, f64::from(element_draw::SCENE_BLUR_RADIUS_LIMIT))
                                as u32,
                        },
                    )));
                }
            }
            if interleave_animated_underlines {
                for pass in crisp_chunk_passes {
                    if !pass.outline_glyphs.is_empty() {
                        stamp_nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                            element_draw::GlyphRun {
                                glyphs: pass.outline_glyphs.into(),
                                uniforms: vec![pass.outline_uniform],
                                texture: None,
                                composite: element_draw::GlyphCompositeMode::Normal,
                                pose: scene_pose,
                                motion: None,
                            },
                        )));
                    }
                    if !pass.glyphs.is_empty() {
                        stamp_nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                            element_draw::GlyphRun {
                                glyphs: pass.glyphs.into(),
                                uniforms: vec![pass.fill_uniform],
                                texture: None,
                                composite: element_draw::GlyphCompositeMode::Normal,
                                pose: scene_pose,
                                motion: None,
                            },
                        )));
                    }
                    if !pass.underline.ops.is_empty() {
                        stamp_nodes.push(element_draw::SceneNode::AnimatedVectors {
                            frame: Arc::new(pass.underline),
                            pose: scene_pose,
                            motion: None,
                        });
                    }
                }
            } else {
                if !outline_glyphs.is_empty() {
                    stamp_nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                        element_draw::GlyphRun {
                            glyphs: outline_glyphs.into(),
                            uniforms: outline_uniforms,
                            texture: None,
                            composite: element_draw::GlyphCompositeMode::Normal,
                            pose: scene_pose,
                            motion: None,
                        },
                    )));
                }
                if !glyphs.is_empty() {
                    stamp_nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                        element_draw::GlyphRun {
                            glyphs: glyphs.into(),
                            uniforms,
                            texture: None,
                            composite: element_draw::GlyphCompositeMode::Normal,
                            pose: scene_pose,
                            motion: None,
                        },
                    )));
                }
                if !underline_ops.ops.is_empty() {
                    stamp_nodes.push(element_draw::SceneNode::AnimatedVectors {
                        frame: Arc::new(underline_ops),
                        pose: scene_pose,
                        motion: None,
                    });
                }
            }
            nodes.extend(stamp_nodes);
            if nodes.len() > element_draw::SCENE_NODE_LIMIT {
                return Err(SubtitleSceneFallback::SceneLimit);
            }
        }
        if pose.blur > 0.001 || pose.reveal.is_some() {
            nodes = vec![element_draw::SceneNode::BlurredGroup(Arc::new(
                element_draw::BlurredGroup {
                    nodes,
                    radius: pose.blur as f32,
                    motion: None,
                    reveal: pose.reveal.map(|reveal| reveal as f32),
                    composite: element_draw::SceneCompositeMode::Normal,
                },
            ))];
        }
        Ok(nodes)
    }

    /// The CPU subtitle layer for the browser compositor: the straight-alpha, non-zero sub-rectangle form of [`Self::render_subtitle_frame`].
    ///
    /// Styles that the glyph scene cannot cover ([`SubtitleSceneFallback`]) must fall back to the whole-frame CPU overlay. Desktop hosts go through `render_rgba_frame`, and the browser goes through here. Both use the same typesetting.
    pub fn render_subtitle_raster_layer(&mut self, time: f64) -> Result<SubtitleRasterLayer> {
        let frame = self.render_subtitle_frame(time)?;
        let Some(bounds) = frame.bounds.clone() else {
            return Ok(SubtitleRasterLayer {
                key: frame.key,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rgba: Vec::new(),
                next_change: frame.next_change,
                composite: frame.composite,
            });
        };
        let stride = self.width as usize;
        let (rows, cols) = (bounds.rows, bounds.cols);
        let mut rgba = Vec::with_capacity((rows.end - rows.start) * (cols.end - cols.start) * 4);
        for y in rows.clone() {
            rgba.extend_from_slice(
                &frame.rgba[(y * stride + cols.start) * 4..(y * stride + cols.end) * 4],
            );
        }
        demultiply_rgba_in_place(&mut rgba);
        Ok(SubtitleRasterLayer {
            key: frame.key,
            x: cols.start as u32,
            y: rows.start as u32,
            width: (cols.end - cols.start) as u32,
            height: (rows.end - rows.start) as u32,
            rgba,
            next_change: frame.next_change,
            composite: frame.composite,
        })
    }

    /// The template layer for the browser compositor: the straight-alpha non-zero sub-rectangle of [`Self::template_frame`].
    ///
    /// The desktop host puts the same Pixmap into the overlay as the dynamic resource `tplchrome:`. The browser's GPU scene has no such host raster node, so it is delivered separately, like the CPU subtitle layer, and stacked on top (`RESERVED_Z`: the template foreground is always above the main picture, the elements, and the subtitles). `None` = no template applied.
    ///
    /// The key carries **this frame's pixel identity**. The chapter bar and progress line move every frame, so looking only at the scene fingerprint would declare a changed picture unchanged. This is the same reasoning as for the `tplchrome:` resource name.
    pub fn render_template_raster_layer(
        &mut self,
        time: f64,
    ) -> Result<Option<SubtitleRasterLayer>> {
        let Some((fingerprint, next_change)) = self
            .chrome
            .as_ref()
            .map(|chrome| (chrome.fingerprint, chrome.next_change(time, self.fps)))
        else {
            return Ok(None);
        };
        let Some(pixmap) = self.template_frame(time)? else {
            return Ok(None);
        };
        let (width, height) = (self.width as usize, self.height as usize);
        let data = pixmap.data();
        let (mut top, mut bottom, mut left, mut right) = (height, 0, width, 0);
        for y in 0..height {
            let row = &data[y * width * 4..(y + 1) * width * 4];
            let Some(first) = row.chunks_exact(4).position(|pixel| pixel[3] != 0) else {
                continue;
            };
            let last = row
                .chunks_exact(4)
                .rposition(|pixel| pixel[3] != 0)
                .unwrap_or(first);
            top = top.min(y);
            bottom = y + 1;
            left = left.min(first);
            right = right.max(last + 1);
        }
        if top >= bottom {
            return Ok(Some(SubtitleRasterLayer {
                key: format!("tplchrome:{fingerprint:016x}:blank"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rgba: Vec::new(),
                next_change,
                composite: CaptionCompositeMode::Normal,
            }));
        }
        let mut rgba = Vec::with_capacity((bottom - top) * (right - left) * 4);
        for y in top..bottom {
            rgba.extend_from_slice(&data[(y * width + left) * 4..(y * width + right) * 4]);
        }
        let stamp = render_raster::drawop::fnv1a64(&rgba);
        demultiply_rgba_in_place(&mut rgba);
        Ok(Some(SubtitleRasterLayer {
            key: format!("tplchrome:{fingerprint:016x}:{left},{top},{right},{bottom}:{stamp:016x}"),
            x: left as u32,
            y: top as u32,
            width: (right - left) as u32,
            height: (bottom - top) as u32,
            rgba,
            next_change,
            composite: CaptionCompositeMode::Normal,
        }))
    }

    /// One frame of the subtitle transparent layer. When Daoyazi takes over, the sequence layer draws one image on its own, and then the cue-level (translation) frame is overlaid on it. The result is cached under “sequence-state key | cue-level key”. If it does not take over, the cue-level path is used unchanged.
    pub fn render_subtitle_frame(&mut self, time: f64) -> Result<RenderedSubtitleFrame> {
        if self.sequence.is_none() || !(0.0..self.duration).contains(&time) {
            return self.render_subtitle_frame_classic(time);
        }
        let Some(plan) = self.ensure_caption_sequence() else {
            return self.render_subtitle_frame_classic(time);
        };
        let (frame, sequence_key, sequence_next) = self.caption_sequence_frame(&plan, time);
        let classic = self.render_subtitle_frame_classic(time)?;
        let key = format!("{sequence_key}|{}", classic.key);
        let next_change = match (sequence_next, classic.next_change) {
            (Some(a), Some(b)) => Some(a.min(b)),
            (a, b) => a.or(b),
        };
        if let Some(hit) = self
            .sequence
            .as_ref()
            .and_then(|state| state.cache.iter().find(|cached| cached.key == key))
        {
            return Ok(RenderedSubtitleFrame {
                key,
                rgba: hit.rgba.clone(),
                next_change: hit.next_change,
                bounds: hit.bounds.clone(),
                composite: hit.composite,
            });
        }
        if frame.seq.is_none() {
            return Ok(RenderedSubtitleFrame {
                key,
                rgba: classic.rgba,
                next_change,
                bounds: classic.bounds,
                composite: classic.composite,
            });
        }
        let (width, height) = (self.width as usize, self.height as usize);
        let mut pixmap = Pixmap::new(self.width, self.height)
            .ok_or_else(|| anyhow!("无法创建字幕透明层 {}x{}", self.width, self.height))?;
        let mut drawn = self.draw_caption_sequence(&mut pixmap, &plan, &frame)?;
        if let Some(bounds) = &classic.bounds {
            composite_premultiplied_rgba(pixmap.data_mut(), &classic.rgba, width, bounds);
            drawn.merge_content_box(bounds);
        }
        let bounds = drawn
            .window(width, height)
            .and_then(|window| alpha_bbox_within(pixmap.data(), width, height, &window));
        let rgba = Arc::new(pixmap.take());
        let composite = CaptionCompositeMode::Normal;
        if let Some(state) = self.sequence.as_mut() {
            state.cache.push_back(CachedFrame {
                key: key.clone(),
                rgba: rgba.clone(),
                next_change,
                bounds: bounds.clone(),
                composite,
            });
            while state.cache.len() > SEQUENCE_FRAME_CACHE {
                state.cache.pop_front();
            }
        }
        Ok(RenderedSubtitleFrame {
            key,
            rgba,
            next_change,
            bounds,
            composite,
        })
    }

    fn render_subtitle_frame_classic(&mut self, time: f64) -> Result<RenderedSubtitleFrame> {
        if !(0.0..self.duration).contains(&time) {
            return Ok(RenderedSubtitleFrame {
                key: "blank:outside".to_owned(),
                rgba: self.blank_rgba(),
                next_change: (time < 0.0).then_some(0.0),
                bounds: None,
                composite: CaptionCompositeMode::Normal,
            });
        }
        // ── First look up the cache using a key built from “which cues plus each one's current word” ────
        // This part only borrows the cue table. It does no typesetting and no deep copy: `active_at` returns a reference, and the current word is a linear scan over the words. Previously this first ran the whole `active_layouts` (deep-copying each line's TimedItem and the already-shaped LayoutLine), and all of it was thrown away after a hit.
        let display_start = {
            let original = active_at(&self.cues, time);
            let translation = active_at(&self.translations, time);
            let mut earliest = f64::INFINITY;
            let mut any = false;
            for kind in mode_lines(self.mode, &self.order) {
                let item = match kind {
                    LineKind::Original => original,
                    LineKind::Translation => translation,
                };
                if let Some(item) = item {
                    earliest = earliest.min(item.display_start);
                    any = true;
                }
            }
            any.then_some(earliest)
        };
        let Some(display_start) = display_start else {
            let next_change = self.next_change_after(time, false);
            return Ok(RenderedSubtitleFrame {
                key: format!(
                    "blank:{}",
                    next_change.map_or_else(|| "end".to_owned(), |value| format!("{value:.6}"))
                ),
                rgba: self.blank_rgba(),
                next_change,
                bounds: None,
                composite: CaptionCompositeMode::Normal,
            });
        };
        let canvas_scale = f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE
            * finite(self.style.get("scale"), 1.0).max(0.05);
        let composite = self.look_at(time).composite;
        let (pose, suppressed) = self.transition_pose_at(display_start, time, canvas_scale);
        let key = {
            let original = active_at(&self.cues, time);
            let translation = active_at(&self.translations, time);
            let items = mode_lines(self.mode, &self.order)
                .into_iter()
                .filter_map(|kind| match kind {
                    LineKind::Original => original,
                    LineKind::Translation => translation,
                })
                .map(|item| (item.id.as_str(), current_word_index(item, time)))
                .collect::<Vec<_>>();
            self.cache_key_of(&items, time, pose, suppressed)
        };
        let next_change = self.next_change_after(time, self.per_frame_subtitle(pose.active));
        if let Some(frame) = self.cache.iter().find(|frame| frame.key == key) {
            // Arc sharing: a hit no longer copies the whole RGBA.
            return Ok(RenderedSubtitleFrame {
                key,
                rgba: frame.rgba.clone(),
                next_change: frame.next_change,
                bounds: frame.bounds.clone(),
                composite: frame.composite,
            });
        }

        // ── The typesetting cost is paid only on a cache miss ──────────────────────────
        let mut layouts = self.active_layouts(time);
        if layouts.is_empty() {
            // The light-weight empty check above uses the same `mode_lines` and `active_at` as `active_layouts`. Reaching this point means the two have diverged. To be safe, return a blank frame, and **replicate field by field** the blank-frame branch above. Never cache a blank image under a content key.
            let next_change = self.next_change_after(time, false);
            return Ok(RenderedSubtitleFrame {
                key: format!(
                    "blank:{}",
                    next_change.map_or_else(|| "end".to_owned(), |value| format!("{value:.6}"))
                ),
                rgba: self.blank_rgba(),
                next_change,
                bounds: None,
                composite: CaptionCompositeMode::Normal,
            });
        }
        let animation = Arc::clone(&self.look_for_layouts(&layouts).animation);
        let (width, height) = (self.width as usize, self.height as usize);
        let mut pixmap = Pixmap::new(self.width, self.height)
            .ok_or_else(|| anyhow!("无法创建字幕透明层 {}x{}", self.width, self.height))?;
        // The union of everything drawn in this frame. When computing the bounding box, scan only inside it, which saves searching the whole 8.3 MB.
        let mut drawn = DrawBounds::default();
        let stack = self.stack_layout(&layouts, canvas_scale);
        let (x, center_y) = stack.anchor;
        let group_tf = group_transform(
            x,
            center_y,
            pose.scale_x,
            pose.scale_y,
            finite(self.style.get("rotation"), 0.0),
        );
        for plate in subtitle_background_plates(&layouts, &stack) {
            let (plate_opacity, plate_tf) = plate
                .motion_line
                .and_then(|index| {
                    let line = layouts.get(index)?;
                    let frame = layout_motion(line, &animation)?;
                    let (center_x, top) = stack.placements[index];
                    let height = line.height;
                    Some((
                        pose.opacity * frame.block.opacity,
                        group_transform_for_motion(
                            &frame.block,
                            center_x,
                            top + height / 2.0,
                            height,
                        )
                        .post_concat(group_tf),
                    ))
                })
                .unwrap_or((pose.opacity, group_tf));
            drawn.merge(fill_round_rect(
                &mut pixmap,
                plate.rect.x,
                plate.rect.y,
                plate.rect.width,
                plate.rect.height,
                plate.rect.radius,
                plate.color,
                plate_opacity,
                plate_tf,
            ));
        }
        let placements = stack.placements;

        // Drawing order keeps the line order given by `mode_lines`. The positions may change, but the stacking order must not.
        let positioned = layouts
            .drain(..)
            .zip(placements)
            .map(|(line, (center_x, top))| (line, center_x, top))
            .collect::<Vec<_>>();
        for (line, center_x, top) in &positioned {
            if !line.style.effect_on
                || line.style.text_motion.is_some()
                || line.style.word_background.is_some()
            {
                continue;
            }
            // Konva blurs only the text shadow/glow. Keep that effect isolated so the glyph fill, outline, highlight plates, and backgrounds stay crisp.
            // The buffer is taken from scratch (it is already zeroed by bounding box before it is returned, equivalent to a newly created all-zero Pixmap).
            let mut effect = match self.effect_scratch.take() {
                Some(scratch) => scratch,
                None => Pixmap::new(self.width, self.height).ok_or_else(|| {
                    anyhow!("无法创建字幕效果透明层 {}x{}", self.width, self.height)
                })?,
            };
            let effect_drawn = draw_line_effect(
                &mut effect,
                &mut self.text,
                line,
                &animation,
                *center_x,
                *top,
                pose.opacity,
                group_tf,
            );
            // The effect layer is written only by `draw_line_effect`, and its drawn window is a superset of its non-zero pixels. So there is no need to read the whole 8.3 MB again to find the bounding box.
            let effect_bounds = effect_drawn
                .window(width, height)
                .and_then(|window| alpha_bbox_within(effect.data(), width, height, &window))
                .map(|bounds| {
                    if line.style.effect_blur > 0.5 {
                        box_blur_rgba_bounded(
                            effect.data_mut(),
                            self.width,
                            self.height,
                            line.style.effect_blur.round() as usize,
                            &bounds,
                        )
                    } else {
                        bounds
                    }
                });
            if let Some(effect_bounds) = effect_bounds {
                // What gets merged into the whole-frame window is the **blurred** box (`box_blur_rgba_bounded` already includes the spread radius in its return value). So the whole-frame window does not need extra margin for the glow.
                drawn.merge_content_box(&effect_bounds);
                composite_premultiplied_rgba(
                    pixmap.data_mut(),
                    effect.data(),
                    width,
                    &effect_bounds,
                );
                clear_content_box(effect.data_mut(), width, &effect_bounds);
            }
            self.effect_scratch = Some(effect);
        }
        for (line, center_x, top) in &positioned {
            drawn.merge(draw_line_layout(
                &mut pixmap,
                &mut self.text,
                line,
                &animation,
                *center_x,
                *top,
                pose.opacity,
                group_tf,
            ));
        }

        // The bounding box must be computed after the last write, because transition blur spreads content further outward. The search range is narrowed to this frame's drawn window: `drawn` merges the **blurred** boxes of the plate, the body text, and the effect layer, so it is still a superset of all the non-zero pixels of the frame.
        let bounds = drawn
            .window(width, height)
            .and_then(|window| alpha_bbox_within(pixmap.data(), width, height, &window))
            .map(|bounds| {
                if pose.blur > 0.5 {
                    box_blur_rgba_bounded(
                        pixmap.data_mut(),
                        self.width,
                        self.height,
                        pose.blur.round() as usize,
                        &bounds,
                    )
                } else {
                    bounds
                }
            });
        let rgba = Arc::new(pixmap.take());
        self.cache.push_front(CachedFrame {
            key: key.clone(),
            rgba: rgba.clone(),
            next_change,
            bounds: bounds.clone(),
            composite,
        });
        // Bounded by a byte budget (128 MB): 1080p still holds 8 frames, and 4K shrinks to 4 frames, so the cache does not keep hundreds of MB resident at high resolutions.
        let frame_bytes = self.width as usize * self.height as usize * 4;
        let max_entries = ((128 << 20) / frame_bytes.max(1)).clamp(1, 8);
        while self.cache.len() > max_entries {
            self.cache.pop_back();
        }
        Ok(RenderedSubtitleFrame {
            key,
            rgba,
            next_change,
            bounds,
            composite,
        })
    }

    pub fn render_text_element(
        &mut self,
        element: &TimelineVisualElement,
        time: f64,
    ) -> Result<Pixmap> {
        let mut style = resolve_line_style(
            &element.style,
            LineKind::Original,
            self.width,
            self.height,
            false,
        );
        let item = TimedItem {
            id: element.id.clone(),
            series_index: 0,
            text: element_display_text(element, time),
            display_start: element.start,
            display_end: element.end,
            words: Vec::new(),
        };
        let wrap_width = element.place.w.map_or_else(
            || f64::from(self.width) * 0.9,
            |width| f64::from(self.width) * width.max(1.0) / 100.0,
        );
        text_element_block_plate(&mut style, element, wrap_width);
        let display_text = transform_text(&item.text, &style.text_transform);
        let animation = timeline::resolve_text_animation(
            element.animation.as_ref(),
            element.start,
            Some(element.end),
            self.duration,
            time,
            self.fps,
            &display_text,
        );
        let pose = animation.container;
        let part_ranges = (!animation.ranges.is_empty()).then_some(animation.ranges.as_slice());
        let (lines, width) = layout_text(&mut self.text, &item, &style, wrap_width, part_ranges);
        let lines: Arc<[LayoutLine]> = lines.into();
        let layout = LineLayout {
            kind: LineKind::Original,
            height: layout_lines_height(&lines),
            width,
            align_width: wrap_width,
            text_align: LineTextAlign::from_style(&element.style),
            style,
            item,
            lines,
            current_word: 0,
            render_time: time,
            render_fps: self.fps,
            animation_parts: animation.parts,
            animation_short_edge: f64::from(self.width.min(self.height)),
            preview: false,
            karaoke_words: None,
            guide_below: false,
        };
        let mut pixmap = Pixmap::new(self.width, self.height)
            .ok_or_else(|| anyhow!("无法创建 text element 透明层"))?;
        let base_x = f64::from(self.width) * element.place.x.unwrap_or(50.0) / 100.0;
        let base_y = f64::from(self.height) * element.place.y.unwrap_or(50.0) / 100.0;
        let short = f64::from(self.width.min(self.height));
        let x = base_x + pose.dx * short;
        let y = base_y + pose.dy * short;
        let scale = element.place.scale.unwrap_or(1.0);
        // Round 122 D2: `scaleY` is a vertical multiplier **applied on top of `scale`** (absent = 1). It is not “a vertical component that replaces `scale`”. When it is absent, both readings give the same value, so old documents are byte-identical.
        let scale_y = scale * element.place.scale_y.unwrap_or(1.0);
        let rotation = element.place.rot.unwrap_or(0.0) + pose.rotation;
        let opacity = element.place.opacity.unwrap_or(1.0) * pose.opacity;
        let animation = word_animation(&serde_json::json!({
            "wordAnimation": {"animationName": "None"}
        }));
        let tile = element.tile.as_ref().filter(|tile| tile.on);
        let gap_x = tile.and_then(|tile| tile.gap_x).unwrap_or(8.0);
        let gap_y = tile.and_then(|tile| tile.gap_y).unwrap_or(10.0);
        let step_x = (layout.width + f64::from(self.width) * gap_x / 100.0).max(1.0);
        let step_y = (layout.height + f64::from(self.height) * gap_y / 100.0).max(1.0);
        let centers = if let Some(tile) = tile {
            let mut centers = Vec::new();
            let cols = (f64::from(self.width) / step_x).ceil() as i32 + 3;
            let rows = (f64::from(self.height) / step_y).ceil() as i32 + 3;
            for row in -rows..=rows {
                let stagger = if tile.stagger.unwrap_or(true) && row.rem_euclid(2) != 0 {
                    step_x / 2.0
                } else {
                    0.0
                };
                for column in -cols..=cols {
                    centers.push((
                        x + f64::from(column) * step_x + stagger,
                        y + f64::from(row) * step_y,
                        rotation + tile.angle.unwrap_or(-30.0),
                    ));
                }
            }
            centers
        } else {
            vec![(x, y, rotation)]
        };
        for (center_x, center_y, rotation) in centers {
            let transform = group_transform(
                center_x,
                center_y,
                scale * pose.scale_x,
                scale_y * pose.scale_y,
                rotation,
            );
            // Block-level vertical anchor: `place.y` pins which edge of the text block. Absent = center = the current behavior. When wrapping, the direction in which the top grows is decided by this. Within a line, text still goes downward line by line, so the line order never flips.
            //
            // What is pinned is the box including inner padding (Mac `stackPlacement`'s single-line branch uses `prepared.size`). So the block is first hung with `height + 2 × pad_v`, and then `pad_v` is applied to get the glyph top edge.
            let pad_v = layout.style.background_pad_v;
            let top = anchor_block(
                center_y,
                layout.height + pad_v * 2.0,
                element.vertical_align.unwrap_or(VerticalAlign::Center),
            ) + pad_v;
            if layout.style.background_on {
                draw_line_background(&mut pixmap, &layout, center_x, top, opacity, transform);
            }
            if layout.style.effect_on {
                let mut effect = Pixmap::new(self.width, self.height)
                    .ok_or_else(|| anyhow!("无法创建 text element 效果层"))?;
                draw_line_effect(
                    &mut effect,
                    &mut self.text,
                    &layout,
                    &animation,
                    center_x,
                    top,
                    opacity,
                    transform,
                );
                let effect_bounds =
                    alpha_bbox(effect.data(), self.width as usize, self.height as usize).map(
                        |bounds| {
                            if layout.style.effect_blur > 0.5 {
                                box_blur_rgba_bounded(
                                    effect.data_mut(),
                                    self.width,
                                    self.height,
                                    layout.style.effect_blur.round() as usize,
                                    &bounds,
                                )
                            } else {
                                bounds
                            }
                        },
                    );
                if let Some(effect_bounds) = effect_bounds {
                    composite_premultiplied_rgba(
                        pixmap.data_mut(),
                        effect.data(),
                        self.width as usize,
                        &effect_bounds,
                    );
                }
            }
            draw_line_layout(
                &mut pixmap,
                &mut self.text,
                &layout,
                &animation,
                center_x,
                top,
                opacity,
                transform,
            );
        }
        if pose.blur > 0.5 {
            box_blur_rgba_content(
                pixmap.data_mut(),
                self.width,
                self.height,
                pose.blur.round() as usize,
            );
        }
        if let Some(reveal) = pose.reveal {
            apply_horizontal_reveal(&mut pixmap, reveal);
        }
        let _ = time;
        Ok(pixmap)
    }

    /// The same diagnostic is hit on every frame. It is de-duplicated before it enters `warnings()`. Otherwise a 5-minute export would flood the envelope with 9000 identical strings.
    pub fn warn_once(&mut self, message: String) {
        if !self.warnings.contains(&message) {
            self.warnings.push(message);
        }
    }

    /// Element box + affine transform. Implemented in `ccut-timeline-render` (moved down in P6a). The geometry all comes from `timeline` (the single source of truth of ADR-E01), so the stage selection box, the export pixels, and the wasm preview cannot compute three different boxes.
    ///
    /// The production path no longer goes through here (the three `push_*` functions each ask the lower layer for their own box). It is kept for the geometry assertions in `tests.rs`.
    pub fn element_frame(
        &self,
        element: &TimelineVisualElement,
        pose: &timeline::AnimationPose,
    ) -> (element_draw::ElementBox, render_raster::drawop::Mat6) {
        element_draw::element_frame(&element_view(element), pose, self.stage())
    }

    /// Canvas size input for the lower layer.
    pub fn stage(&self) -> element_draw::Stage {
        element_draw::Stage::new(self.width, self.height)
    }

    /// The diagnostic outlet of the lower layer → `warn_once`.
    ///
    /// Diagnostics are collected into a `Vec` and then bubbled up, instead of passing a `&mut self` closure directly. The `push_*` functions need to borrow `builder` and the diagnostic outlet at the same time, and the diagnostic outlet writes to `self.warnings`. The de-duplication semantics are unchanged (`warn_once` is still the one place).
    pub fn drain_element_warnings(&mut self, warnings: Vec<String>) {
        for message in warnings {
            self.warn_once(message);
        }
    }

    /// `kind: "shape"`: the registry's shape recipe + `ShapeProps` → direct vector output.
    pub fn push_shape_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        pose: timeline::AnimationPose,
    ) {
        let mut warnings = Vec::new();
        element_draw::push_shape_element(
            builder,
            &element_view(element),
            &pose,
            self.stage(),
            &mut |message| warnings.push(message),
        );
        self.drain_element_warnings(warnings);
    }

    /// `visualizer`: sampling of the injected `VizTrack` → recipe drawing.
    ///
    /// On the host side only two things remain: take out the track prepared by preflight, and convert the output time into source media time (`source_time_for`). The drawing itself is done in the lower layer.
    pub fn push_visualizer_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        time: f64,
        pose: timeline::AnimationPose,
    ) {
        let track = self.viz_tracks.get(&element.id).cloned();
        let source_time = element
            .visualizer
            .as_ref()
            .and_then(|props| self.source_time_for(props, time));
        let mut warnings = Vec::new();
        element_draw::push_visualizer_element(
            builder,
            &element_view(element),
            time,
            &pose,
            self.stage(),
            track.as_deref(),
            source_time,
            &mut |message| warnings.push(message),
        );
        self.drain_element_warnings(warnings);
    }

    /// Output time → **source media time** on this visualizer's audio source.
    ///
    /// `None` = the audio source is not playing at this moment (a cut gap, or another source occupies this stretch of the output). When there is no projection table (`compile_with` in unit tests), it degrades to “output time = source time”. The wasm preview also currently takes this degraded path (see the `source_time` input documentation of the lower layer).
    pub fn source_time_for(&self, props: &VisualizerProps, time: f64) -> Option<f64> {
        let Some(projection) = self.viz_projection.as_ref() else {
            return Some(time);
        };
        let wanted = visualizer_audio_source(props);
        // `Following`: at a seam, take the **first frame of the following segment**, consistent with “what this frame is about to show next”.
        let (src_id, source_time) =
            projection.timeline_to_source(time, timeline::SeamBias::Following)?;
        (src_id == wanted).then_some(source_time)
    }

    /// `kind: "sticker"` with `source == "template"`: template recipe → direct vector output.
    ///
    /// Returns `false` = this is an `asset` source, which is handled by `render_media_element`. (This is the split point of P7b. The criterion is in the lower layer's `push_sticker_element`, and the host does not copy it again.)
    pub fn push_sticker_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        pose: timeline::AnimationPose,
    ) -> bool {
        let mut warnings = Vec::new();
        let claimed = element_draw::push_sticker_element(
            builder,
            &element_view(element),
            &pose,
            self.stage(),
            &mut |message| warnings.push(message),
        );
        self.drain_element_warnings(warnings);
        claimed
    }

    /// `kind: "progress"`: progress value + catalog-style recipe → direct vector output.
    pub fn push_progress_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        time: f64,
        pose: timeline::AnimationPose,
    ) {
        let mut warnings = Vec::new();
        element_draw::push_progress_element(
            builder,
            &element_view(element),
            time,
            &pose,
            self.stage(),
            &mut |message| warnings.push(message),
        );
        self.drain_element_warnings(warnings);
    }

    /// `kind: "confetti"`: closed-form motion kernel → direct vector output (design draft §5).
    pub fn push_confetti_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        time: f64,
        pose: timeline::AnimationPose,
    ) {
        let mut warnings = Vec::new();
        element_draw::push_confetti_element(
            builder,
            &element_view(element),
            time,
            &pose,
            self.stage(),
            &mut |message| warnings.push(message),
        );
        self.drain_element_warnings(warnings);
    }

    pub fn push_draw_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        pose: timeline::AnimationPose,
    ) {
        element_draw::push_draw_element(builder, &element_view(element), &pose, self.stage());
    }

    pub fn push_placeholder_element(
        &mut self,
        builder: &mut FrameBuilder,
        element: &TimelineVisualElement,
        pose: timeline::AnimationPose,
    ) -> bool {
        element_draw::push_placeholder_element(builder, &element_view(element), &pose, self.stage())
    }

    /// **Frame time for animated stickers** (P7b): the three values of `StickerProps.loop` are consumed for the first time.
    ///
    /// An animated sticker is a GIF → alpha-carrying WebM. In the render pipeline it is just an ordinary video layer. Looping is expressed with `sticker.loop`, which is **already in the contract**, so no field needs to be added to `Element`.
    ///
    /// - `loop` (default): `srcStart + elapsed time`, taken **modulo the source duration**. A sticker's duration is usually much shorter than its slot on the timeline. Without the modulo, it would freeze on the last frame after the first pass.
    /// - `once`: plays once and freezes on the last frame when it ends (no modulo; this is exactly `VideoReader`'s EOF behavior).
    /// - `hold`: freezes on the first frame, so the animated sticker is used as a static sticker.
    ///
    /// If the source duration is unavailable (0 or negative), it falls back to `once`. Dividing by 0 would only produce NaN.
    fn sticker_media_time(&self, element: &TimelineVisualElement, time: f64) -> f64 {
        let loop_mode = element
            .sticker
            .as_ref()
            .map(|sticker| sticker.loop_mode())
            .unwrap_or(timeline::schema::STICKER_LOOP_DEFAULT);
        if loop_mode == timeline::schema::STICKER_LOOP_HOLD {
            return element.src_start.max(0.0);
        }
        let elapsed = (element.src_start + (time - element.start) * element.rate).max(0.0);
        let duration = element
            .src_id
            .as_deref()
            .and_then(|id| self.media.base.media_duration(id))
            .unwrap_or(0.0);
        if !(duration > 0.0) {
            return elapsed;
        }
        if loop_mode == timeline::schema::STICKER_LOOP_LOOP {
            return elapsed.rem_euclid(duration);
        }
        // `once`: freeze on the last frame when it ends. **The value must be clamped.** `VideoReader`'s “freeze the last frame once past the end” holds only when reading sequentially to EOF. A direct `-ss` past the end produces no frames from the pipe at all, which is a hard error rather than a freeze. Clamp to the source's last decodable moment, computed with the **source** frame rate rather than the composition frame rate (an 8 fps sticker that leaves 1/30 s of margin would still run past the last frame).
        let last = element
            .src_id
            .as_deref()
            .and_then(|id| self.media.base.video_last_frame_time(id))
            .unwrap_or(duration);
        elapsed.min(last)
    }

    /// Timeline's media clock. Still images use -1. Video advances linearly. GIF/APNG/WebP images loop within their own duration. Timeline 0.3 has no BCF `animatedImage.loop` field, so the product's import semantics are fixed to looping. That exactly covers the existing experience of 4-second B-roll and animated stickers.
    fn timeline_media_time_ms(&self, element: &TimelineVisualElement, time: f64) -> i64 {
        let Some(source_id) = element.src_id.as_deref() else {
            return -1;
        };
        if !self.media.base.is_time_varying(source_id) {
            return -1;
        }
        if element.kind == ElementKind::Sticker {
            return (self.sticker_media_time(element, time) * 1_000.0).round() as i64;
        }
        let elapsed = (element.src_start + (time - element.start) * element.rate).max(0.0);
        let sampled = if self.media.base.has_animated(source_id) {
            let duration = self.media.base.animated_duration(source_id).unwrap_or(0.0);
            if duration > 0.0 {
                elapsed.rem_euclid(duration)
            } else {
                elapsed
            }
        } else {
            elapsed
        };
        (sampled * 1_000.0).round() as i64
    }

    /// Which id to use when fetching a frame. A material sticker that has been recolored uses a **variant** (see `load_sticker_fill_variants`). Everything else is `None`, meaning the source id is used as-is.
    ///
    /// “The variant does not exist” means “this source does not support recoloring”. Bitmaps, animated or video stickers, and the injected store under wasm all take this branch, and are drawn in their original colors rather than reporting an error.
    fn recolored_source_id(
        &self,
        element: &TimelineVisualElement,
        source_id: &str,
    ) -> Option<String> {
        let sticker = element.sticker.as_ref()?;
        if sticker.fill_overrides.is_empty() {
            return None;
        }
        let variant = sticker_fill_variant_id(source_id, &sticker.fill_overrides);
        self.media.has_image(&variant).then_some(variant)
    }

    /// The whiteboard source image, downsampled to the target pixels given by `target` (`None` = as-is).
    ///
    /// The reveal field runs per frame on this image, so its size directly equals how many pixels must be computed each frame. And it is ultimately only drawn into the element box. A scaled image is remembered by `(source id, target size)`, so the whole timeline is scaled only once. The key of the stroke analysis already carries the size (`source id | size | params`), so it changes along with it, and the analysis of a large image is never reused for a small one.
    fn whiteboard_source_at(
        &mut self,
        source_id: &str,
        source: &Arc<Pixmap>,
        target: Option<(u32, u32)>,
    ) -> Arc<Pixmap> {
        let Some((width, height)) = target else {
            return Arc::clone(source);
        };
        if (width, height) == (source.width(), source.height()) {
            return Arc::clone(source);
        }
        let key = (source_id.to_owned(), width, height);
        if let Some(hit) = self.whiteboard_sources.get(&key) {
            return Arc::clone(hit);
        }
        let scaled = Arc::new(downscaled_pixmap(source, width, height));
        self.whiteboard_sources.insert(key, Arc::clone(&scaled));
        scaled
    }

    /// Whether the whiteboard source image can be scaled down to the element box, and to what size.
    ///
    /// It is not scaled when `fx` is present. The effect's radius is derived from the canvas's short side and falls on the source image's own resolution (`apply_media_effects`' scale looks only at the canvas). If the image were smaller, the proportion covered by the same blur would change. Moreover, `fx` also takes part in the ink/color classification, so changing the size would change the reveal order. Tiling likewise is not scaled: that image must be repeated per cell, and scaling it to the box would blur every cell.
    fn whiteboard_target_px(
        &self,
        element: &TimelineVisualElement,
        natural_width: u32,
        natural_height: u32,
        box_width: f64,
        box_height: f64,
    ) -> Option<(u32, u32)> {
        if element.fx.is_some() || element.tile.as_ref().is_some_and(|tile| tile.on) {
            return None;
        }
        // Take the larger of the two axis ratios. `contain` leaves margins, and `cover` crops one side. Going with the larger means preferring to compute a few more pixels, rather than blurring the part that is to be shown.
        let ratio = (box_width / f64::from(natural_width.max(1)))
            .max(box_height / f64::from(natural_height.max(1)));
        shrink_target_px(natural_width, natural_height, ratio)
    }

    /// Whiteboard hand-drawing: source image → a frame “drawn up to `time`” (design draft §4).
    ///
    /// The analysis is memoized by `source id | size | params`. When `draw` is absent, a first analysis without `beats` is done to get the natural duration (also cached), and then `beats` is normalized against the final `draw`.
    fn whiteboard_reveal(
        &mut self,
        element: &TimelineVisualElement,
        source_id: &str,
        source: &Pixmap,
        time: f64,
    ) -> Pixmap {
        use render_raster::source::{whiteboard_analyze, whiteboard_frame};
        const CACHE_LIMIT: usize = 24;
        let props = element.whiteboard.clone().unwrap_or_default();
        let size = format!("{}x{}", source.width(), source.height());
        let analysis_for = |params: render_raster::source::WhiteboardParams,
                            cache: &mut HashMap<
            String,
            Arc<render_raster::source::WhiteboardAnalysis>,
        >| {
            // 0.9: `pace`, `strict`, `end`, and the effective draw time all enter the key. Anchor beats have already been resolved to seconds by the host.
            let key = format!(
                "{source_id}|{size}|{}|{}|{}|{:.4}|{}",
                params.ink_first,
                params.pace.as_str(),
                params.strict,
                params.draw_seconds,
                params
                    .beats
                    .iter()
                    .map(|b| {
                        format!(
                            "{:.4}-{:?}:{:?}",
                            b.at,
                            b.end.map(|e| (e * 1e4).round() / 1e4),
                            b.rect
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(";")
            );
            if let Some(hit) = cache.get(&key) {
                return Arc::clone(hit);
            }
            if cache.len() >= CACHE_LIMIT {
                cache.clear();
            }
            let analysis = Arc::new(whiteboard_analyze(source, &params));
            cache.insert(key, Arc::clone(&analysis));
            analysis
        };
        let duration = element.end - element.start;
        let base = analysis_for(
            element_draw::whiteboard_params(&props, 1.0).beats_cleared(),
            &mut self.whiteboard_cache,
        );
        let draw =
            element_draw::whiteboard_draw_seconds(&props, duration, base.natural_draw_seconds());
        let params = element_draw::whiteboard_params(&props, draw);
        let analysis = if params.needs_second_pass() {
            analysis_for(params, &mut self.whiteboard_cache)
        } else {
            base
        };
        let progress = ((time - element.start) / draw).clamp(0.0, 1.0);
        let paper = element_draw::whiteboard_paper(&props)
            .and_then(|c| tiny_skia::Color::from_rgba(c[0], c[1], c[2], c[3]));
        whiteboard_frame(
            &analysis,
            source,
            progress,
            element_draw::whiteboard_hand(&props),
            paper,
        )
    }

    /// The only CPU pixel stage of the Whiteboard GPU scene: it runs the static effects and the reveal field at the source image's native size. Fit, contain background, mask, tile, transition, and pose blur are all left to [`element_draw::external_media_scene_nodes_at`]. They must not first be tiled into a full canvas on the CPU and then uploaded.
    fn whiteboard_source_frame(
        &mut self,
        element: &TimelineVisualElement,
        source_id: &str,
        source: &Arc<Pixmap>,
        time: f64,
    ) -> Result<Pixmap> {
        if element.fx.is_none() {
            return Ok(self.whiteboard_reveal(element, source_id, source, time));
        }
        // The order in the CPU reference is source effects → reveal. Effects change the whiteboard's ink/color classification, so they cannot be moved to a GPU texture pass after the reveal just to save one processing step.
        let mut filtered = Pixmap::from_vec(
            source.data().to_vec(),
            IntSize::from_wh(source.width(), source.height()).context("白板源尺寸非法")?,
        )
        .context("白板源 RGBA 尺寸非法")?;
        apply_media_effects(
            &mut filtered,
            element.fx.as_ref(),
            f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE,
        );
        Ok(self.whiteboard_reveal(element, source_id, &filtered, time))
    }

    pub fn render_media_element(
        &mut self,
        element: &TimelineVisualElement,
        time: f64,
        pose: timeline::AnimationPose,
    ) -> Result<Option<Pixmap>> {
        let Some(source_id) = element.src_id.as_deref() else {
            if element.kind == ElementKind::Sticker {
                self.warn_once(format!(
                    "元素 {} 的 sticker source=asset 缺少 srcId：资产贴纸必须注册进 \
                     timeline sources（模板贴纸请改用 source=template + templateId）",
                    element.id
                ));
            }
            return Ok(None);
        };
        // Still images are always -1. Video and animated images share a positive millisecond clock. The only difference is in the upstream time folding.
        let media_ms = self.timeline_media_time_ms(element, time);
        let recolored = self.recolored_source_id(element, source_id);
        let source_id = recolored.as_deref().unwrap_or(source_id);
        let source = self.media.source_frame(source_id, media_ms)?;
        let canvas_width = f64::from(self.width);
        let canvas_height = f64::from(self.height);
        let tiled = element.tile.as_ref().is_some_and(|tile| tile.on);
        // The box uses only the source's **aspect ratio**, and neither the reveal field nor the effects change the size. So it is valid to run the same expression once with the source size first. The whiteboard uses this to decide whether to shrink the source to the box size beforehand.
        let media_box = |natural_width: f64, natural_height: f64| match (tiled, element.mode) {
            (false, VisualMode::Fullscreen) => (
                canvas_width,
                canvas_height,
                canvas_width / 2.0,
                canvas_height / 2.0,
            ),
            (_, VisualMode::Pip) | (true, VisualMode::Fullscreen) => {
                // B-roll's historical default is 34%. Sticker is a new element in 0.2 and uses core's unified default (`DEFAULT_ELEMENT_W`), the same width as the stage box.
                let defaults = timeline::geometry::default_place(element.kind, None);
                let default_w = match element.kind {
                    ElementKind::Sticker => timeline::geometry::DEFAULT_ELEMENT_W,
                    ElementKind::Placeholder => defaults.w,
                    _ => 34.0,
                };
                let width = canvas_width * element.place.w.unwrap_or(default_w).max(1.0) / 100.0;
                let height = if element.kind == ElementKind::Placeholder {
                    canvas_height * defaults.h.unwrap_or(24.0) / 100.0
                } else {
                    width * natural_height / natural_width
                };
                (
                    width,
                    height,
                    canvas_width * element.place.x.unwrap_or(50.0) / 100.0,
                    canvas_height * element.place.y.unwrap_or(50.0) / 100.0,
                )
            }
        };
        let filtered = if element.kind == ElementKind::Whiteboard {
            // Whiteboard hand-drawing (Timeline 0.8): the source image is revealed through a time field into a frame “drawn up to t”. After that, it shares the box, mask, transition, and affine transform with image. The analysis is memoized by source id plus props. The reveal runs per frame and its cost scales with the source image's pixels, so the source is first scaled to the size of the element box.
            let (box_width, box_height, _, _) = media_box(
                f64::from(source.width().max(1)),
                f64::from(source.height().max(1)),
            );
            let target = self.whiteboard_target_px(
                element,
                source.width(),
                source.height(),
                box_width,
                box_height,
            );
            let source = self.whiteboard_source_at(source_id, &source, target);
            self.whiteboard_source_frame(element, source_id, &source, time)?
        } else {
            // An injected source picture, declared by the host, is used only once, and no effect needs baking. Taking it out of the injected table means the plan owns it, so no copy is needed.
            if self.consume_injected_sources
                && element.fx.is_none()
                && self
                    .media
                    .injected
                    .get(source_id)
                    .is_some_and(|injected| Arc::ptr_eq(injected, &source))
            {
                self.media.injected.remove(source_id);
            }
            let mut filtered = match Arc::try_unwrap(source) {
                Ok(owned) => owned,
                Err(shared) => Pixmap::from_vec(
                    shared.data().to_vec(),
                    IntSize::from_wh(shared.width(), shared.height()).context("媒体元素尺寸非法")?,
                )
                .context("媒体元素 RGBA 尺寸非法")?,
            };
            apply_media_effects(
                &mut filtered,
                element.fx.as_ref(),
                f64::from(self.width.min(self.height)) / REFERENCE_SHORT_EDGE,
            );
            filtered
        };
        let natural_width = f64::from(filtered.width().max(1));
        let natural_height = f64::from(filtered.height().max(1));
        let (box_width, box_height, center_x, center_y) = media_box(natural_width, natural_height);
        let local_width = box_width.round().max(1.0) as u32;
        let local_height = box_height.round().max(1.0) as u32;
        let transition = element
            .transitions
            .as_ref()
            .map(|v| v.sample(time - element.start, element.end - element.start))
            .unwrap_or_default();
        let pose = transition.compose_in_place(
            pose,
            f64::from(local_width),
            canvas_width.min(canvas_height),
            &element.place,
        );
        // The background plate is pre-filled only when it is “full screen + contain” and the element has a background (`bg`). In other cases the local canvas is fully transparent before `draw_fit_pixmap`. The compositing stand-in has no background, so margins and transparent pixels would expose what is underneath.
        let backdrop = element.bg.filter(|_| element.mode == VisualMode::Fullscreen && element.fit == Fit::Contain);
        let has_backdrop = backdrop.is_some();
        // Identity pass-through: when the box and the source are the same size, `draw_fit_pixmap`'s scale is exactly 1 and its offset exactly 0. Pasting onto a fully transparent canvas is then a byte-for-byte copy (`tests/identity_media_pass_through.rs` verifies it is bit-exact), so `filtered` is taken over directly. This saves one 8.3 MB zeroing allocation and one full-frame bilinear resample. Identity PIP (the main picture after `detach_main_video` normalization) takes this path every frame.
        // When there is a background plate (full screen + contain + `bg`), as long as the source image is opaque pixel by pixel, the source covers the whole box, the background plate (black, solid color, or blur) is completely hidden, and the source-over result is exactly the source bytes. So it also passes straight through. If any pixel is semi-transparent, it still takes the background-plate path so the background color shows through. The alpha scan runs only when the sizes already match and there is a background plate. Otherwise there is zero overhead.
        let mut local = if local_width == filtered.width()
            && local_height == filtered.height()
            && (!has_backdrop || is_opaque(&filtered))
        {
            filtered
        } else {
            let mut local = Pixmap::new(local_width, local_height)
                .ok_or_else(|| anyhow!("无法创建媒体元素局部画布"))?;
            if let Some(bg) = backdrop {
                match bg {
                    Background::Black => local.fill(tiny_skia::Color::BLACK),
                    Background::Color([r, g, b]) => {
                        local.fill(tiny_skia::Color::from_rgba8(r, g, b, 255));
                    }
                    Background::Blur => {
                        draw_fit_pixmap(&mut local, &filtered, Fit::Cover, 1.0);
                        box_blur_rgba(
                            local.data_mut(),
                            local_width,
                            local_height,
                            ((local_width.min(local_height) as f64) * 0.04)
                                .round()
                                .max(1.0) as usize,
                        );
                        adjust_brightness(local.data_mut(), -0.15);
                    }
                }
            }
            draw_fit_pixmap(&mut local, &filtered, element.fit, 1.0);
            local
        };
        if transition.iris < 1.0 {
            let half_x = f64::from(local_width) / 2.0;
            let half_y = f64::from(local_height) / 2.0;
            let radius = half_x.hypot(half_y) * transition.iris;
            for (i, pixel) in local.data_mut().chunks_exact_mut(4).enumerate() {
                let x = (i % local_width as usize) as f64 + 0.5 - half_x;
                let y = (i / local_width as usize) as f64 + 0.5 - half_y;
                let coverage = (radius - x.hypot(y) + 0.5).clamp(0.0, 1.0);
                for channel in pixel {
                    *channel = (f64::from(*channel) * coverage).round() as u8;
                }
            }
        }

        // The mask stack on the local canvas: `mask.shape@1` → `mask.progress@1`. The order and uniforms both come from `timeline::lower_element_effects` (Timeline 0.1's persisted fields → effect recipe). The length parameter is a ratio of the canvas's short side.
        let canvas_short_edge = f64::from(self.width.min(self.height));
        for lowered in timeline::lower_element_effects(
            None,
            element.mask.as_ref(),
            Some(&element.place),
            pose.reveal,
            element.mode == VisualMode::Pip || tiled,
        ) {
            render_raster::effects::apply_filter_in_place(
                &lowered.effect,
                &lowered.uniforms,
                &mut local,
                canvas_short_edge,
            )?;
        }
        let short = canvas_width.min(canvas_height);
        let dx = pose.dx * short;
        let dy = pose.dy * short;
        let opacity = (element.place.opacity.unwrap_or(1.0) * pose.opacity).clamp(0.0, 1.0);
        if opacity <= 0.001 {
            return Ok(Some(
                Pixmap::new(self.width, self.height)
                    .ok_or_else(|| anyhow!("无法创建媒体元素合成层"))?,
            ));
        }
        // Mirroring is geometry (ADR-E01). It enters only the affine's `post_scale`, and does not take part in the box size or in the tile dot-grid conversion. Absent = (1, 1), so old documents are byte-identical.
        let (flip_x, flip_y) = element.place.flip_signs();
        let uniform_scale = element.place.scale.unwrap_or(1.0) * pose.scale_x;
        // Round 122 D2: `place.scaleY` is a vertical multiplier **applied on top of `scale`** (absent = 1). It is not “a vertical component that replaces `scale`”. The write-back path `stage_drag::place_resize` computes “box left unchanged” as `scaleY = 1`. If this fell back to `scale`, an element with `scale ≠ 1` would be pressed back to its natural height as soon as an edge was dragged. When `scaleY` is absent, both readings give the same value, so old documents are byte-identical.
        let vertical_scale = element.place.scale.unwrap_or(1.0)
            * element.place.scale_y.unwrap_or(1.0)
            * pose.scale_y;
        let mut field;
        if let Some(tile) = element.tile.as_ref().filter(|tile| tile.on) {
            field = Pixmap::new(self.width, self.height)
                .ok_or_else(|| anyhow!("无法创建媒体元素合成层"))?;
            let rotation =
                tile.angle.unwrap_or(-30.0) + element.place.rot.unwrap_or(0.0) + pose.rotation;
            let points =
                tile_stamp_points(self.width, self.height, local_width, local_height, tile);
            for (point_x, point_y) in points {
                let radians = rotation.to_radians();
                let scaled_x = point_x * uniform_scale;
                let scaled_y = point_y * vertical_scale;
                let rotated_x = scaled_x * radians.cos() - scaled_y * radians.sin();
                let rotated_y = scaled_x * radians.sin() + scaled_y * radians.cos();
                let transform = Transform::from_translate(
                    -(local_width as f32) / 2.0,
                    -(local_height as f32) / 2.0,
                )
                .post_scale(
                    (uniform_scale * flip_x) as f32,
                    (vertical_scale * flip_y) as f32,
                )
                .post_rotate(rotation as f32)
                .post_translate(
                    (canvas_width / 2.0 + dx + rotated_x) as f32,
                    (canvas_height / 2.0 + dy + rotated_y) as f32,
                );
                field.draw_pixmap(
                    0,
                    0,
                    local.as_ref(),
                    &PixmapPaint {
                        quality: FilterQuality::Bilinear,
                        ..Default::default()
                    },
                    transform,
                    None,
                );
            }
        } else {
            let transform = Transform::from_translate(
                -(local_width as f32) / 2.0,
                -(local_height as f32) / 2.0,
            )
            .post_scale(
                (uniform_scale * flip_x) as f32,
                (vertical_scale * flip_y) as f32,
            )
            .post_rotate((element.place.rot.unwrap_or(0.0) + pose.rotation) as f32)
            .post_translate((center_x + dx) as f32, (center_y + dy) as f32);
            // Identity takeover: when the local canvas fills the frame and the affine is the identity, doing one SrcOver onto a fully transparent composite layer is a byte-for-byte copy (same as above, verified bit-exact). So the local canvas is used directly as the composite layer, saving another 8.3 MB zeroing allocation and one full-frame bilinear pass. The criterion uses `Transform::is_identity()` rather than checking scale, rotation, x, and y one by one, since missing one case would silently change the picture.
            if transform.is_identity() && local_width == self.width && local_height == self.height {
                field = local;
            } else {
                field = Pixmap::new(self.width, self.height)
                    .ok_or_else(|| anyhow!("无法创建媒体元素合成层"))?;
                field.draw_pixmap(
                    0,
                    0,
                    local.as_ref(),
                    &PixmapPaint {
                        quality: FilterQuality::Bilinear,
                        ..Default::default()
                    },
                    transform,
                    None,
                );
            }
        }
        if pose.blur > 0.5 {
            // Phase 4A's only **true Filter pass** (design §6.1). Pose blur acts on the composite layer at canvas size, where neither the size nor the radius conversion needs to change, so it can be expressed bit-exactly as a FramePlan. The element's local buffer does not take this path: `fx.blur` is baked into the source image at its native size, and changing it to a Filter pass would change the resolution and the pixels (that is phase 4B's work).
            //
            // The input surface is declared as `External`: the already-drawn `field` is used directly as input, without going through a `draw_pixmap` blit, since a blit might change the bytes.
            let radius_px = (pose.blur * f64::from(self.width.min(self.height))
                / REFERENCE_SHORT_EDGE)
                .round()
                .max(1.0);
            let short_edge = f64::from(self.width.min(self.height));
            let mut plan = render_raster::FramePlan::single_draw(
                self.width,
                self.height,
                FrameOps::default(),
                self.capability,
            );
            plan.surfaces = vec![
                render_raster::SurfacePlan::external(
                    render_raster::SurfaceId(0),
                    self.width,
                    self.height,
                ),
                render_raster::SurfacePlan::canvas(
                    render_raster::SurfaceId(1),
                    self.width,
                    self.height,
                ),
            ];
            plan.passes = vec![render_raster::RenderPass::Filter {
                input: render_raster::SurfaceId(0),
                output: render_raster::SurfaceId(1),
                effect: render_raster::effects::EffectRef::new("filter.blur", 1),
                uniforms: render_raster::effects::UniformMap::new().with(
                    "radius",
                    render_raster::effects::UniformValue::Scalar(radius_px / short_edge),
                ),
            }];
            plan.output = render_raster::SurfaceId(1);
            let external = std::collections::BTreeMap::from([(0u32, Arc::new(field))]);
            field = render_raster::execute_plan_with_inputs(
                &plan,
                &mut self.executor,
                &mut self.media,
                None,
                &external,
            )?;
        }
        multiply_premultiplied_alpha(field.data_mut(), opacity);
        Ok(Some(field))
    }

    pub fn render_overlay_frame(&mut self, time: f64) -> Result<RenderedOverlayFrame> {
        let subtitle = self.render_subtitle_frame(time)?;
        self.render_drawop_overlay_frame(time, Some(subtitle))
    }

    pub fn render_elements_overlay_frame(&mut self, time: f64) -> Result<RenderedOverlayFrame> {
        self.render_drawop_overlay_frame(time, None)
    }

    /// R1's element-layer scene exit. Array order is the timeline z-order. Shape and template sticker stay as DrawOp, while visualizer and progress become ShaderQuad. Each element is evaluated only once: the same result feeds both the SceneNode and the CPU reference folded into the whole-frame fingerprint. `next_change` shares [`Self::element_next_change`] with [`Self::build_overlay_ops`], so the GPU execution layer does not invent a second identity or time model.
    ///
    /// Text, image, video, asset sticker, and template chrome still need host raster or media textures. Until R2/R4 integrate them, the whole frame explicitly errors, so the App falls back silently to the existing CPU overlay.
    pub fn element_scene_frame(&mut self, time: f64) -> Result<element_draw::SceneFrame> {
        if self.chrome.is_some() {
            bail!("compositor-scene-unsupported: 模板层尚未进入 R1 GPU 场景");
        }
        let blocked = self.host_rasterized_elements();
        if !blocked.is_empty() {
            bail!(
                "compositor-scene-unsupported: 这些元素仍需要 host 光栅化：{}",
                blocked.join(", ")
            );
        }

        let time = time.clamp(0.0, self.duration.max(0.0));
        self.media.dynamic.clear();
        let active = self
            .elements
            .iter()
            .filter(|element| {
                let t = self.sample_time_for(&element.id, time);
                t >= element.start && t < element.end
            })
            .cloned()
            .collect::<Vec<_>>();
        let next_change = self.element_next_change(time, &active);
        let mut reference = FrameBuilder::default();
        reference.push(DrawOp::Clear {
            color: [0.0, 0.0, 0.0, 0.0],
        });
        let mut nodes = Vec::with_capacity(active.len());
        for mut element in active {
            let time = self.sample_time_for(&element.id, time);
            element.keyframe_place(time);
            let pose = timeline::resolve_animation_pose(
                element.animation.as_ref(),
                element.start,
                Some(element.end),
                self.duration,
                time,
                self.fps,
            );
            let track = self.viz_tracks.get(&element.id).cloned();
            let source_time = element
                .visualizer
                .as_ref()
                .and_then(|props| self.source_time_for(props, time));
            let mut warnings = Vec::new();
            let evaluated = element_draw::evaluate_scene_element(
                &element_view(&element),
                time,
                &pose,
                self.stage(),
                track.as_deref(),
                source_time,
                &mut |message| warnings.push(message),
            )?;
            self.drain_element_warnings(warnings);
            if let Some(evaluated) = evaluated {
                evaluated.append_reference_to(&mut reference)?;
                if let Some(node) = evaluated.node {
                    nodes.push(node);
                }
            }
        }
        let reference = reference.finish();
        Ok(element_draw::SceneFrame {
            nodes,
            next_change,
            active_until: None,
            fingerprint: render_raster::fingerprint(&reference),
        })
    }

    /// The complete renderer-neutral overlay scene for R5 offscreen GPU export.
    ///
    /// Timeline elements are drawn in their projected declaration order, and subtitles are overlaid above ordinary elements such as video. The watermark has been stably promoted to the end by [`Self::parse_projected_timeline_elements`]. Plain text goes through the retained glyph scene. Shape, template sticker, visualizer, and progress go through the R1 evaluation layer. External image, video, and asset sticker use element-level `TextureNode`s, and template chrome uses the full-canvas texture after host rasterization. All of them stay in the global z-order of the same node array.
    pub fn compositor_scene_frame(&mut self, time: f64) -> Result<element_draw::SceneFrame> {
        self.compositor_scene_frame_with(time, SceneIdentity::Full)
    }

    /// Same as above, but the caller decides whether [`SceneIdentity`] is computed.
    pub fn compositor_scene_frame_with(
        &mut self,
        time: f64,
        scene_identity: SceneIdentity,
    ) -> Result<element_draw::SceneFrame> {
        let want_identity = scene_identity != SceneIdentity::Skip;
        self.compositor_scene_support()?;
        let time = time.clamp(0.0, self.duration.max(0.0));
        self.media.dynamic.clear();

        let mut nodes = Vec::new();
        let mut next_change = None;
        let mut active_until = None;
        let mut identity = Vec::new();

        let active = self
            .elements
            .iter()
            .filter(|element| {
                let t = self.sample_time_for(&element.id, time);
                t >= element.start && t < element.end
            })
            .cloned()
            .collect::<Vec<_>>();
        next_change = min_optional_time(next_change, self.element_next_change(time, &active));
        let mut reference = FrameBuilder::default();
        reference.push(DrawOp::Clear {
            color: [0.0, 0.0, 0.0, 0.0],
        });
        for mut element in active {
            // The sampling time must be swapped here. Hover-trial pins one piece to its own local clock, so pose, source time, and element evaluation all have to use this clock. Swapping only the text branch would leave the confetti forever at local 0 seconds (on the GPU composite path, the stage would be empty).
            let time = self.sample_time_for(&element.id, time);
            element.keyframe_place(time);
            if element.kind == ElementKind::Text {
                let scene_nodes = match self.text_element_scene_nodes(&element, time) {
                    Ok(scene_nodes) => scene_nodes,
                    // A text element with layered text animation: CPU rasterization (`render_text_element`, the same picture as the DrawOp reference) is cropped into a texture node, which stays in the element array to keep its z-order.
                    #[cfg(feature = "host")]
                    Err(SubtitleSceneFallback::WordAnimation)
                        if text_element_has_motion(&element) =>
                    {
                        let pixmap = self.render_text_element(&element, time)?;
                        // A still segment (from the end of the entrance to the start of the exit, with no loop) is one image for the whole segment. Its identity and sampling clock both take the segment start rather than being mixed with `time`, so that on-screen de-duplication can recognize it.
                        let clock = match text_element_motion_phase(&element, time, self.fps) {
                            TextElementMotionPhase::Changing => time,
                            TextElementMotionPhase::Still { anchor, .. } => anchor,
                        };
                        let structural = structural_pixel_hash(&[
                            b"text-motion",
                            &text_element_scene_fingerprint(&self.definition_key, &element, clock)
                                .to_le_bytes(),
                            element_display_text(&element, time).as_bytes(),
                        ]);
                        if let Some(fingerprint) = self.compositor_raster_texture_node(
                            format!("text-motion:{}", element.id),
                            pixmap.data(),
                            None,
                            (clock * 1_000.0).round() as i64,
                            scene_identity,
                            structural,
                            &mut nodes,
                        )? {
                            identity.extend_from_slice(&fingerprint.to_le_bytes());
                        }
                        continue;
                    }
                    Err(fallback) => bail!("compositor-scene-unsupported: {fallback}"),
                };
                if want_identity {
                    identity.extend_from_slice(
                        &text_element_scene_fingerprint(&self.definition_key, &element, time)
                            .to_le_bytes(),
                    );
                }
                nodes.extend(scene_nodes);
                continue;
            }
            let pose = timeline::resolve_animation_pose(
                element.animation.as_ref(),
                element.start,
                Some(element.end),
                self.duration,
                time,
                self.fps,
            );
            if element.kind == ElementKind::Whiteboard {
                // The whiteboard hand-drawn reveal field is rasterized per frame on the CPU (`render_media_element` does the box, mask, transition, and reveal). In the GPU scene it is a full-canvas texture: the same node type as template chrome, but kept in the element array to preserve z-order. Without this branch it would fall into the `false` branch of `evaluate_scene_element` and be silently dropped, so export and App preview would not show whiteboard pieces.
                #[cfg(feature = "host")]
                {
                    if let Some(fingerprint) = self.compositor_whiteboard_node(
                        &element,
                        time,
                        pose,
                        scene_identity,
                        &mut nodes,
                    )? {
                        identity.extend_from_slice(&fingerprint.to_le_bytes());
                    }
                    continue;
                }
                #[cfg(not(feature = "host"))]
                bail!(
                    "compositor-scene-unsupported: 元素 {} 需要 host 光栅化白板",
                    element.id
                );
            }
            if is_external_media_element(&element) {
                #[cfg(feature = "host")]
                {
                    let (media_nodes, fingerprint) =
                        self.compositor_media_nodes(&element, time, &pose, scene_identity)?;
                    if let Some(fingerprint) = fingerprint {
                        identity.extend_from_slice(&fingerprint.to_le_bytes());
                    }
                    nodes.extend(media_nodes);
                    continue;
                }
                #[cfg(not(feature = "host"))]
                bail!(
                    "compositor-scene-unsupported: 元素 {} 需要 host 外部纹理",
                    element.id
                );
            }
            let track = self.viz_tracks.get(&element.id).cloned();
            let source_time = element
                .visualizer
                .as_ref()
                .and_then(|props| self.source_time_for(props, time));
            let mut warnings = Vec::new();
            let evaluated = element_draw::evaluate_scene_element(
                &element_view(&element),
                time,
                &pose,
                self.stage(),
                track.as_deref(),
                source_time,
                &mut |message| warnings.push(message),
            )?;
            self.drain_element_warnings(warnings);
            if let Some(evaluated) = evaluated {
                evaluated.append_reference_to(&mut reference)?;
                if let Some(node) = evaluated.node {
                    nodes.push(node);
                }
            }
        }
        if self.includes.subtitles {
            match self.subtitle_scene_frame_with_target_sampling(time, true) {
                Ok(subtitle) => {
                    if want_identity {
                        identity.extend_from_slice(&subtitle.scene.fingerprint.to_le_bytes());
                    }
                    next_change = min_optional_time(next_change, subtitle.scene.next_change);
                    active_until = min_optional_time(active_until, subtitle.scene.active_until);
                    nodes.extend(subtitle.scene.nodes);
                }
                // On frames where the active cue has layered text animation, only the **subtitle layer** goes through the shared CPU rasterization (`render_subtitle_frame`, with its own frame-key cache and `next_change`). It is cropped by the non-zero alpha bounding box into a 1:1 texture and placed at the original subtitle node's position. Elements, media, and template stay GPU nodes as usual. Non-Normal compositing still needs backdrop semantics and is not in this set.
                #[cfg(feature = "host")]
                Err(SubtitleSceneFallback::WordAnimation) if self.text_motion_active_at(time) => {
                    let frame = self.render_subtitle_frame(time)?;
                    if frame.composite != CaptionCompositeMode::Normal {
                        bail!(
                            "compositor-scene-unsupported: {} ({:?} composite)",
                            SubtitleSceneFallback::WordAnimation,
                            frame.composite
                        );
                    }
                    next_change = min_optional_time(next_change, frame.next_change);
                    let structural = structural_pixel_hash(&[
                        b"subtitle-motion",
                        self.definition_key.as_bytes(),
                        frame.key.as_bytes(),
                    ]);
                    let texture = format!(
                        "subtitle-motion:{:016x}",
                        render_raster::drawop::fnv1a64(self.definition_key.as_bytes())
                    );
                    if let Some(fingerprint) = self.compositor_raster_texture_node(
                        texture,
                        &frame.rgba,
                        Some(frame.bounds.as_ref()),
                        // On moving frames the frame key already carries the frame number. When still, it is `@settled`. All content changes are carried by `structural` or pixels, and the sampling clock is fixed, so the identity of a still segment does not change frame by frame.
                        0,
                        scene_identity,
                        structural,
                        &mut nodes,
                    )? {
                        identity.extend_from_slice(&fingerprint.to_le_bytes());
                    }
                }
                Err(fallback) => bail!("compositor-scene-unsupported: {fallback}"),
            }
        }
        // Scene texture nodes are host-specific (`external-media-scene`). The wasm-safe path goes only through the DrawMedia path.
        #[cfg(feature = "host")]
        if let Some((boundary, fingerprint)) = self
            .chrome
            .as_ref()
            .map(|chrome| (chrome.next_change(time, self.fps), chrome.fingerprint))
        {
            next_change = min_optional_time(next_change, boundary);
            if let Some(pixmap) = self.template_frame(time)? {
                let pixmap = Arc::new(pixmap);
                let texture = format!("template-chrome:{fingerprint:016x}");
                let media_ms = (time * 1_000.0).round() as i64;
                let node = element_draw::TextureNode {
                    texture: texture.clone(),
                    media_ms,
                    source_width: self.width,
                    source_height: self.height,
                    rect: [0.0, 0.0, self.width as f32, self.height as f32],
                    transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                    opacity: 1.0,
                    radius: 0.0,
                    mask_shape: element_draw::TextureMaskShape::RoundedRect,
                    mask_feather: 0.0,
                    source_effects: Arc::from([]),
                    reveal: 1.0,
                    iris: 1.0,
                    fit: element_draw::TextureFit::Cover,
                    background: element_draw::TextureBackground::Transparent,
                };
                match scene_identity {
                    SceneIdentity::Full => identity.extend_from_slice(
                        &texture_scene_fingerprint(&node, pixmap.data()).to_le_bytes(),
                    ),
                    // The chrome raster is uniquely determined by (scene fingerprint, canvas, font). The sampling clock is already in the node metadata, so it need not be mixed in again.
                    SceneIdentity::Structural => {
                        let pixel_hash = structural_pixel_hash(&[
                            b"template-chrome",
                            &fingerprint.to_le_bytes(),
                            &self.width.to_le_bytes(),
                            &self.height.to_le_bytes(),
                            self.original_style.font_name.as_bytes(),
                        ]);
                        identity.extend_from_slice(
                            &texture_scene_fingerprint_with_pixel_hash(&node, pixel_hash)
                                .to_le_bytes(),
                        );
                    }
                    SceneIdentity::Skip => {}
                }
                self.media.dynamic.insert(texture, pixmap);
                nodes.push(element_draw::SceneNode::Texture(Arc::new(node)));
            }
        }
        let reference = reference.finish();
        if want_identity {
            identity.extend_from_slice(&render_raster::fingerprint(&reference).to_le_bytes());
        }
        Ok(element_draw::SceneFrame {
            nodes,
            next_change,
            active_until,
            fingerprint: if want_identity {
                render_raster::drawop::fnv1a64(&identity)
            } else {
                0
            },
        })
    }

    /// Turns one full-canvas premultiplied CPU raster (the subtitle layer, or a text element with text animation) into one 1:1 [`element_draw::TextureNode`]. The window [`motion_texture_window`] is cropped by the non-zero alpha bounding box (computed on the spot when `bounds` is `None`; `Some(None)` means a known fully transparent frame). The pixels are injected into `dynamic`, and the node rectangle lands on integer coordinates, equal to the source size, with an identity transform. Under this mapping the linear sampler takes values per texel, matching the CPU reference's DrawMedia source-over pixel for pixel.
    ///
    /// The caller gives the slot name as a **stable** name (the subtitle layer uses the plan's definition key, and a text element uses its element id). In offscreen export, an external texture stays resident under its slot name, and renaming it per frame would make a long export grow VRAM without bound. Content changes are carried by the identity (`structural` = a frame-key proxy, `Full` = real pixels) and by the `media_ms` the caller provides. `media_ms` enters the identity, so it must stay unchanged during still segments (do not fill it directly with `time`).
    /// Returns this node's scene identity (`None` for `Skip` or a fully transparent frame).
    #[cfg(feature = "host")]
    #[allow(clippy::too_many_arguments)]
    fn compositor_raster_texture_node(
        &mut self,
        texture: String,
        rgba: &[u8],
        bounds: Option<Option<&ContentBox>>,
        media_ms: i64,
        scene_identity: SceneIdentity,
        structural: u64,
        nodes: &mut Vec<element_draw::SceneNode>,
    ) -> Result<Option<u64>> {
        let (width, height) = (self.width as usize, self.height as usize);
        let computed;
        let bounds = match bounds {
            Some(bounds) => bounds,
            None => {
                computed = alpha_bbox(rgba, width, height);
                computed.as_ref()
            }
        };
        let Some(bounds) = bounds else {
            return Ok(None);
        };
        let (x, y, w, h) = motion_texture_window(bounds, width, height);
        let mut pixmap =
            Pixmap::new(w as u32, h as u32).ok_or_else(|| anyhow!("无法创建光栅纹理 {w}x{h}"))?;
        let data = pixmap.data_mut();
        for row in 0..h {
            let source = ((y + row) * width + x) * 4;
            data[row * w * 4..(row + 1) * w * 4].copy_from_slice(&rgba[source..source + w * 4]);
        }
        let node = element_draw::TextureNode {
            texture: texture.clone(),
            media_ms,
            source_width: w as u32,
            source_height: h as u32,
            rect: [x as f32, y as f32, w as f32, h as f32],
            transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            opacity: 1.0,
            radius: 0.0,
            mask_shape: element_draw::TextureMaskShape::RoundedRect,
            mask_feather: 0.0,
            source_effects: Arc::from([]),
            reveal: 1.0,
            iris: 1.0,
            fit: element_draw::TextureFit::Cover,
            background: element_draw::TextureBackground::Transparent,
        };
        let fingerprint = match scene_identity {
            SceneIdentity::Full => Some(texture_scene_fingerprint(&node, pixmap.data())),
            SceneIdentity::Structural => {
                Some(texture_scene_fingerprint_with_pixel_hash(&node, structural))
            }
            SceneIdentity::Skip => None,
        };
        self.media.dynamic.insert(texture, Arc::new(pixmap));
        nodes.push(element_draw::SceneNode::Texture(Arc::new(node)));
        Ok(fingerprint)
    }

    /// Decodes the source frame for a visible native media element and freezes a TextureNode. The pixels are injected into `dynamic` under an element-level slot. The offscreen host can then take them via [`Self::compositor_texture_frame`]. This way two independent media clocks on the same `srcId` do not overwrite each other.
    /// A whiteboard piece → a native-size reveal texture + an ordinary external-media scene. The CPU does only the threshold of the whiteboard's time field. Fit, mask, tile, transition, and pose blur are done by the GPU node, and a full-canvas texture is no longer rasterized first. The texture name is fixed by element id, and `media_ms` distinguishes frames by project frame. The structural fingerprint mixes in only (definition key, element id, sampled frame, source size), and does not depend on pixels.
    #[cfg(feature = "host")]
    fn compositor_whiteboard_node(
        &mut self,
        element: &TimelineVisualElement,
        time: f64,
        pose: timeline::AnimationPose,
        scene_identity: SceneIdentity,
        nodes: &mut Vec<element_draw::SceneNode>,
    ) -> Result<Option<u64>> {
        let source_id = element.src_id.as_deref().with_context(|| {
            format!(
                "compositor-scene-unsupported: 白板元素 {} 缺少 srcId",
                element.id
            )
        })?;
        let source = self.media.base.frame(source_id, -1)?;
        let texture = format!("whiteboard:{}", element.id);
        // The reveal field runs at the **actual pixels of the element box**, not at the source image's native size. The image is ultimately drawn into that box, so how big the source is has nothing to do with how many pixels must be computed per frame. Geometry reads only the aspect ratio, so the box is first probed with the natural size, and then the source is scaled to that size. The two passes yield the same box.
        let target = {
            let mut probe_view = external_media_view(element, &texture, time);
            probe_view.kind = ElementKind::Image;
            probe_view.fx = None;
            element_draw::external_media_scene_nodes_at(
                &probe_view,
                (((time * self.fps).floor() / self.fps) * 1_000.0).round() as i64,
                &pose,
                self.stage(),
                element_draw::ExternalMediaMetadata::image(source.width(), source.height()),
                &mut |_| {},
            )
            .and_then(|probe| scene_texture_target_px(&probe, source.width(), source.height()))
            .and_then(|(width, height)| {
                self.whiteboard_target_px(
                    element,
                    source.width(),
                    source.height(),
                    f64::from(width),
                    f64::from(height),
                )
            })
        };
        let source = self.whiteboard_source_at(source_id, &source, target);
        let pixmap = Arc::new(self.whiteboard_source_frame(element, source_id, &source, time)?);
        let media_ms = (((time * self.fps).floor() / self.fps) * 1_000.0).round() as i64;
        let mut view = external_media_view(element, &texture, time);
        // The injected pixels already contain the whiteboard reveal. Geometry is exactly
        // the image path; presenting it as Whiteboard here would let Web claim ownership
        // without running the host reveal stage.
        view.kind = ElementKind::Image;
        // Effects were applied before reveal because they participate in ink/color
        // classification. Re-applying them in the texture pass would be both wrong and slow.
        view.fx = None;
        let mut warnings = Vec::new();
        let scene_nodes = element_draw::external_media_scene_nodes_at(
            &view,
            media_ms,
            &pose,
            self.stage(),
            element_draw::ExternalMediaMetadata::image(pixmap.width(), pixmap.height()),
            &mut |message| warnings.push(message),
        );
        let detail = warnings.join("；");
        self.drain_element_warnings(warnings);
        let scene_nodes = scene_nodes.ok_or_else(|| {
            anyhow!(
                "compositor-scene-unsupported: 白板元素 {} 无法进入外部纹理 scene{}",
                element.id,
                if detail.is_empty() {
                    String::new()
                } else {
                    format!("：{detail}")
                }
            )
        })?;
        debug_assert!(scene_nodes.iter().all(texture_scene_node_is_supported));
        let fingerprint = match scene_identity {
            SceneIdentity::Full => Some(texture_scene_nodes_fingerprint(
                &scene_nodes,
                render_raster::drawop::fnv1a64(pixmap.data()),
            )),
            SceneIdentity::Structural => Some(texture_scene_nodes_fingerprint(
                &scene_nodes,
                structural_pixel_hash(&[
                    b"whiteboard",
                    self.definition_key.as_bytes(),
                    element.id.as_bytes(),
                    &media_ms.to_le_bytes(),
                    &pixmap.width().to_le_bytes(),
                    &pixmap.height().to_le_bytes(),
                ]),
            )),
            SceneIdentity::Skip => None,
        };
        self.media.dynamic.insert(texture, pixmap);
        nodes.extend(scene_nodes);
        Ok(fingerprint)
    }

    #[cfg(feature = "host")]
    fn compositor_media_nodes(
        &mut self,
        element: &TimelineVisualElement,
        time: f64,
        pose: &timeline::AnimationPose,
        scene_identity: SceneIdentity,
    ) -> Result<(Vec<element_draw::SceneNode>, Option<u64>)> {
        let source_id = element.src_id.as_deref().with_context(|| {
            format!(
                "compositor-scene-unsupported: 元素 {} 的外部纹理缺少 srcId",
                element.id
            )
        })?;
        let time_varying = self.media.base.is_time_varying(source_id);
        let media_ms = self.timeline_media_time_ms(element, time);
        // The GPU composite path and the CPU overlay must take the same image. Recoloring is no exception.
        let recolored = self.recolored_source_id(element, source_id);
        let source_id = recolored.as_deref().unwrap_or(source_id);
        let texture = format!("timeline-media:{}", element.id);
        // Vector animated images (Lottie / animated SVG) are rasterized at the **actual pixel size of the element box**, not at the original size. The texture is ultimately drawn into that box, so how big the original is has nothing to do with how many pixels must be computed. A 1024² original drawn into a 461² sticker box would require allocating, compositing, and uploading four times the pixels for each layer, and the GPU would then downscale all of it. In a project where the `bars_bottom` waveform spans the full frame and costs only 3 ms/frame, this one item could take three quarters of the export time.
        //
        // First walk through with the natural size to measure how many pixels the **pure geometry** occupies. Geometry reads only the aspect ratio (`height = width × h / w` in `external_media_scene_nodes_at`), and nodes scaled proportionally are field-for-field identical, so the two passes do not yield two boxes.
        //
        // Elements with `fx` are excepted. The effect chain's radius is derived from the **canvas short side** and falls on the texture's own resolution (`lower_texture_effects(element.fx, short)`). Once the texture shrinks, the same blur radius covers a different proportion. Saving that rasterization is not worth changing the pixels of finished videos that already exist.
        let target = element
            .fx
            .is_none()
            .then(|| self.media.base.vector_natural_size(source_id))
            .flatten()
            .and_then(|(natural_width, natural_height)| {
                let probe = element_draw::external_media_scene_nodes_at(
                    &external_media_view(element, &texture, time),
                    media_ms,
                    pose,
                    self.stage(),
                    element_draw::ExternalMediaMetadata::video(natural_width, natural_height),
                    &mut |_| {},
                )?;
                scene_texture_target_px(&probe, natural_width, natural_height)
            });
        let pixmap = self
            .media
            .base
            .animated_frame_for_target(source_id, media_ms, target)
            .unwrap_or_else(|| self.media.base.frame(source_id, media_ms))?;
        let metadata = if time_varying {
            element_draw::ExternalMediaMetadata::video(pixmap.width(), pixmap.height())
        } else {
            element_draw::ExternalMediaMetadata::image(pixmap.width(), pixmap.height())
        };
        let mut warnings = Vec::new();
        let nodes = element_draw::external_media_scene_nodes_at(
            &external_media_view(element, &texture, time),
            media_ms,
            pose,
            self.stage(),
            metadata,
            &mut |message| warnings.push(message),
        );
        let detail = warnings.join("；");
        self.drain_element_warnings(warnings);
        let nodes = nodes.ok_or_else(|| {
            anyhow!(
                "compositor-scene-unsupported: 元素 {} 无法进入外部纹理 scene{}",
                element.id,
                if detail.is_empty() {
                    String::new()
                } else {
                    format!("：{detail}")
                }
            )
        })?;
        debug_assert!(nodes.iter().all(texture_scene_node_is_supported));
        // Full mode runs the **whole decoded frame's pixels** through FNV-1a: 3.3 ms/frame measured at 720p, and it grows tenfold at 1080p/4K. Structural uses the “fetch parameters” in place of pixels. Within the same `MediaStore`, `(source id, media_ms)` uniquely determines this image, and the recolored source id is included as well. See [`SceneIdentity`].
        let fingerprint = match scene_identity {
            SceneIdentity::Full => Some(texture_scene_nodes_fingerprint(
                &nodes,
                render_raster::drawop::fnv1a64(pixmap.data()),
            )),
            SceneIdentity::Structural => Some(texture_scene_nodes_fingerprint(
                &nodes,
                structural_pixel_hash(&[
                    texture.as_bytes(),
                    source_id.as_bytes(),
                    &media_ms.to_le_bytes(),
                    &pixmap.width().to_le_bytes(),
                    &pixmap.height().to_le_bytes(),
                ]),
            )),
            SceneIdentity::Skip => None,
        };
        self.media.dynamic.insert(texture, pixmap);
        Ok((nodes, fingerprint))
    }

    /// The offscreen compositor takes the currently visible texture before submitting the scene. Only the decoded premultiplied RGBA is exposed here. `MediaStore` or platform decoder state is not leaked.
    #[cfg(feature = "host")]
    pub fn compositor_texture_frame(
        &mut self,
        texture: &str,
        media_ms: i64,
    ) -> Result<Arc<Pixmap>> {
        self.media.frame(texture, media_ms)
    }

    /// Statically checks whether the current plan can fully enter [`Self::compositor_scene_frame`].
    pub fn compositor_scene_support(&self) -> Result<()> {
        if self.includes.subtitles
            && let Some(fallback) = self.subtitle_scene_static_fallback_with_target_sampling(true)
        {
            bail!("compositor-scene-unsupported: {fallback}");
        }
        Ok(())
    }

    /// The single scheduling rule for element boundaries and per-frame windows. The CPU overlay and SceneFrame share it. This avoids recording a full DrawOp pass just to compute `next_change`, and then evaluating the elements a second time.
    fn element_next_change(&self, time: f64, active: &[TimelineVisualElement]) -> Option<f64> {
        let mut next_change = None;
        for element in &self.elements {
            for boundary in [element.start, element.end] {
                if boundary > time + 1e-9 {
                    next_change =
                        Some(next_change.map_or(boundary, |current: f64| current.min(boundary)));
                }
            }
        }
        for element in active {
            let time_varying_media = element
                .src_id
                .as_deref()
                .is_some_and(|id| self.media.base.is_time_varying(id));
            let whiteboard_drawing = element.kind == ElementKind::Whiteboard
                && element
                    .whiteboard
                    .as_ref()
                    .and_then(|props| props.draw)
                    .is_none_or(|draw| {
                        let duration = (element.end - element.start).max(0.0);
                        time + 1e-9 < element.start + draw.min(duration)
                    });
            let text_motion = (element.kind == ElementKind::Text
                && text_element_has_motion(element))
            .then(|| text_element_motion_phase(element, time, self.fps));
            if let Some(TextElementMotionPhase::Still { until, .. }) = text_motion
                && until > time + 1e-9
            {
                next_change = Some(next_change.map_or(until, |current: f64| current.min(until)));
            }
            if element.animation.is_some()
                || element.has_visual_keyframes()
                || matches!(
                    element.kind,
                    ElementKind::Video
                        | ElementKind::Visualizer
                        | ElementKind::Progress
                        | ElementKind::Confetti
                )
                // A text element with layered text animation is rasterized frame by frame only on moving frames (entrance, loop, exit). Still segments go to the `Still` branch below, which jumps straight to the next boundary.
                || text_motion == Some(TextElementMotionPhase::Changing)
                // A whiteboard reveals frame by frame only within its draw window (the hand is also moving). The hold segment after an explicit draw ends reuses the last source texture, and does not spin idly until the element's end.
                || whiteboard_drawing
                || time_varying_media
            {
                let frame_boundary = ((time * self.fps).floor() + 1.0) / self.fps;
                next_change =
                    Some(next_change.map_or(frame_boundary, |current| current.min(frame_boundary)));
            }
            if let Some(counter) = &element.counter {
                let value = counter.value_at(element.start, element.end, time);
                let boundary = match counter.mode {
                    timeline::schema::CounterMode::Countup => {
                        element.start + value as f64 + 1.0
                    }
                    timeline::schema::CounterMode::Countdown => {
                        element.end - value.saturating_sub(1) as f64
                    }
                };
                if boundary > time + 1e-9 && boundary < element.end - 1e-9 {
                    next_change =
                        Some(next_change.map_or(boundary, |current| current.min(boundary)));
                }
            }
        }
        next_change
    }

    pub fn render_drawop_overlay_frame(
        &mut self,
        time: f64,
        subtitle: Option<RenderedSubtitleFrame>,
    ) -> Result<RenderedOverlayFrame> {
        self.render_drawop_layer(time, subtitle, OverlayParts::ALL)
    }

    /// The entity of [`Self::render_drawop_overlay_frame`]. The caller separately chooses whether to draw the timeline elements and the template foreground. Only the CPU export layering ([`Self::render_export_overlay`]) needs to draw these separately. Other entry points are always [`OverlayParts::ALL`], and their instruction stream is byte-identical to before the split.
    fn render_drawop_layer(
        &mut self,
        time: f64,
        subtitle: Option<RenderedSubtitleFrame>,
        parts: OverlayParts,
    ) -> Result<RenderedOverlayFrame> {
        let (frame_ops, next_change) = self.build_overlay_ops(time, subtitle.as_ref(), parts)?;
        // The identity of the whole image still uses the **DrawOp primitive fingerprint**. The overlay is one folded plan, and its instruction stream corresponds one-to-one with the output surface. Switching to the surface fingerprint would invalidate the historical values of `X-Ccut-DrawOp-Fingerprint` once more (clients only do equality comparison, so changing the values brings no benefit).
        let draw_op_fingerprint = render_raster::fingerprint(&frame_ops);
        // The folded FramePlan: the executor calls `rasterize_with_media` directly for this shape, the same function call as the old path, byte-identical.
        let plan = render_raster::FramePlan::single_draw(
            self.width,
            self.height,
            frame_ops,
            self.capability,
        );
        debug_assert!(plan.is_folded());
        let pixmap = render_raster::execute_plan(&plan, &mut self.executor, &mut self.media, None)?;
        Ok(RenderedOverlayFrame {
            // The subtitle layer's content key is passed up as-is, so that serve can pair it with the geometry sidecar. The whole-image identity is separately represented by `draw_op_fingerprint`. The two cannot substitute for each other.
            subtitle_key: subtitle.map(|subtitle| subtitle.key),
            draw_op_fingerprint,
            rgba: pixmap.take(),
            next_change,
        })
    }

    /// Assembles one frame's **DrawOp instruction stream** (no rasterization).
    ///
    /// [`Self::render_drawop_overlay_frame`] and [`Self::element_drawop_fingerprint`] share this one assembler. The fingerprint output and the frame that is actually put on screen or exported must come from the **same source**. If they diverged, the cross-engine gate would no longer be comparing the same instruction stream (the wasm comparison in the element plan §9.1 applies the same way).
    fn build_overlay_ops(
        &mut self,
        time: f64,
        subtitle: Option<&RenderedSubtitleFrame>,
        parts: OverlayParts,
    ) -> Result<(FrameOps, Option<f64>)> {
        self.media.dynamic.clear();
        let mut builder = FrameBuilder::default();
        builder.push(DrawOp::Clear {
            color: [0.0, 0.0, 0.0, 0.0],
        });

        let active = self
            .elements
            .iter()
            .filter(|element| {
                let t = self.sample_time_for(&element.id, time);
                parts.elements && t >= element.start && t < element.end
            })
            .cloned()
            .collect::<Vec<_>>();
        let mut next_change = subtitle.and_then(|subtitle| subtitle.next_change);
        if let Some(boundary) = self.element_next_change(time, &active) {
            next_change = Some(next_change.map_or(boundary, |current| current.min(boundary)));
        }
        // The sequence number of this dynamic raster within this frame (used for the resource name of [`DynamicAssetNames::Slot`]).
        let mut slot = 0usize;
        for mut element in active {
            let time = self.sample_time_for(&element.id, time);
            element.keyframe_place(time);
            let pose = timeline::resolve_animation_pose(
                element.animation.as_ref(),
                element.start,
                Some(element.end),
                self.duration,
                time,
                self.fps,
            );
            match element.kind {
                ElementKind::Text => {
                    let pixmap = self.render_text_element(&element, time)?;
                    let asset_name =
                        self.dynamic_asset_name("text", &element.id, pixmap.data(), slot);
                    slot += 1;
                    self.media
                        .dynamic
                        .insert(asset_name.clone(), Arc::new(pixmap));
                    let asset = builder.string_id(&asset_name);
                    builder.push(DrawOp::DrawMedia {
                        asset,
                        media_ms: -1,
                        src: [0.0; 4],
                        tf: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                    });
                }
                // shape / visualizer / progress are **direct vector output**. They do not pass through an off-screen Pixmap. FillRect, FillPath, and StrokePath are recorded straight into the same instruction stream. So they naturally enter the DrawOp fingerprint, and they can naturally be lowered into wasm (design §9.1).
                ElementKind::Shape => self.push_shape_element(&mut builder, &element, pose),
                ElementKind::Visualizer => {
                    self.push_visualizer_element(&mut builder, &element, time, pose);
                }
                ElementKind::Progress => {
                    self.push_progress_element(&mut builder, &element, time, pose);
                }
                ElementKind::Confetti => {
                    self.push_confetti_element(&mut builder, &element, time, pose);
                }
                ElementKind::Draw => self.push_draw_element(&mut builder, &element, pose),
                ElementKind::Placeholder
                    if self.push_placeholder_element(&mut builder, &element, pose) => {}
                // sticker is the only kind that **splits by props** (P7b). The `template` source takes the same path as shape (direct vector output, which can go to wasm). The `asset` source takes the same path as image and video (off-screen rasterization plus `DrawMedia`). Only `asset` can reach the fallthrough below.
                ElementKind::Sticker if self.push_sticker_element(&mut builder, &element, pose) => {
                }
                ElementKind::Image
                | ElementKind::Video
                | ElementKind::Sticker
                | ElementKind::Placeholder
                | ElementKind::Whiteboard => {
                    if let Some(pixmap) = self.render_media_element(&element, time, pose)? {
                        let asset_name =
                            self.dynamic_asset_name("media", &element.id, pixmap.data(), slot);
                        slot += 1;
                        self.media
                            .dynamic
                            .insert(asset_name.clone(), Arc::new(pixmap));
                        let asset = builder.string_id(&asset_name);
                        builder.push(DrawOp::DrawMedia {
                            asset,
                            media_ms: -1,
                            src: [0.0; 4],
                            tf: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                        });
                    }
                }
                ElementKind::Audio => {}
            }
        }
        if let Some(subtitle) = subtitle {
            let subtitle_asset_name =
                self.dynamic_asset_name("subtitle", "layer", subtitle.rgba.as_slice(), slot);
            let subtitle_pixmap = Pixmap::from_vec(
                (*subtitle.rgba).clone(),
                IntSize::from_wh(self.width, self.height).context("subtitle layer 尺寸非法")?,
            )
            .context("subtitle layer RGBA 尺寸非法")?;
            self.media
                .dynamic
                .insert(subtitle_asset_name.clone(), Arc::new(subtitle_pixmap));
            let subtitle_asset = builder.string_id(&subtitle_asset_name);
            builder.push(DrawOp::DrawMedia {
                asset: subtitle_asset,
                media_ms: -1,
                src: [0.0; 4],
                tf: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            });
        }
        // The template decoration layer is drawn last. The semantics of `RESERVED_Z` are “the foreground is always above the main video and the elements”.
        //
        // Its shape copies the subtitle layer above (off-screen Pixmap → dynamic resource → one DrawMedia), rather than merging the decoration's FrameOps into the builder. The two instruction streams each have their own path, string, and paint interning tables. Merging would require remapping every id, which is not worth it for a single foreground layer.
        if let Some((boundary, fingerprint)) = self
            .chrome
            .as_ref()
            .filter(|_| parts.chrome)
            .map(|chrome| (chrome.next_change(time, self.fps), chrome.fingerprint))
        {
            if let Some(boundary) = boundary {
                next_change = Some(next_change.map_or(boundary, |current| current.min(boundary)));
            }
            if let Some(pixmap) = self.template_frame(time)? {
                // The resource name carries **this frame's pixel identity**. The DrawOp fingerprint looks only at the instruction stream, so if the name stayed unchanged it would claim the picture has not changed. The subtitle layer solves the same problem with `subtitle.key`.
                let stamp = render_raster::drawop::fnv1a64(pixmap.data());
                let name = format!("tplchrome:{fingerprint}:{stamp:016x}");
                self.media.dynamic.insert(name.clone(), Arc::new(pixmap));
                let asset = builder.string_id(&name);
                builder.push(DrawOp::DrawMedia {
                    asset,
                    media_ms: -1,
                    src: [0.0; 4],
                    tf: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                });
            }
        }
        let frame_ops: FrameOps = builder.finish();
        Ok((frame_ops, next_change))
    }

    /// The element ids on the current timeline that **need host rasterization** (in declaration order).
    ///
    /// The criterion matches `Preview::host_rasterized_elements` in `ccut-wasm`, item by item. Text, image, and video always need it. Sticker splits by `source`: `template` is direct vector output, and the rest (`asset`) go through an off-screen Pixmap. Audio, shape, visualizer, and progress do not need it.
    ///
    /// What is filtered here is `self.elements` that have **already passed `includes.allows()`**, consistent with the wasm side. Elements filtered out by include never enter the instruction stream in the first place.
    pub fn host_rasterized_elements(&self) -> Vec<&str> {
        self.elements
            .iter()
            .filter(|element| match element.kind {
                ElementKind::Text
                | ElementKind::Image
                | ElementKind::Video
                | ElementKind::Whiteboard => true,
                ElementKind::Sticker => {
                    element.sticker.as_ref().map(|props| props.source.as_str())
                        != Some(timeline::schema::STICKER_SOURCE_TEMPLATE)
                }
                ElementKind::Placeholder => element.src_id.is_some(),
                ElementKind::Audio
                | ElementKind::Shape
                | ElementKind::Visualizer
                | ElementKind::Progress
                | ElementKind::Confetti
                | ElementKind::Draw => false,
            })
            .map(|element| element.id.as_str())
            .collect()
    }

    /// The **element-layer DrawOp fingerprint** (16 hex digits) at the current `t`.
    ///
    /// It uses the same function as `fingerprintAt` in `ccut-wasm`, and as `X-Ccut-DrawOp-Fingerprint` from the CLI's `studio export` (`render_raster::fingerprint`). It also uses the same instruction stream ([`Self::build_overlay_ops`], the `subtitle = None` branch). So the three ends are bit-for-bit comparable. This is the gate exit for the vector four-class part of M4 exit criterion 5.
    ///
    /// **It does not include the subtitle layer.** The subtitle layer's `DrawMedia` is recorded only on the path [`Self::render_overlay_frame`]. When host-rasterized elements are included, this method **actively errors** rather than giving a fake cross-engine comparable value, because wasm does not have the host raster results for these elements and cannot generate the same instruction stream. It is a different number from [`RenderedOverlayFrame::draw_op_fingerprint`] (the pixel identity of the whole overlay, including the subtitle layer), and the two cannot substitute for each other.
    pub fn element_drawop_fingerprint(&mut self, time: f64) -> Result<String> {
        // The template layer is a Pixmap rasterized by the host. wasm does not have this host result. So when there is decoration, it actively errors rather than giving a number that cannot be compared across engines.
        if self.chrome.is_some() {
            bail!(
                "element_drawop_fingerprint 只在纯矢量元素的 timeline 上与导出指纹可比；\
                 本项目套用了模板层（host 光栅化）"
            );
        }
        let blocked = self.host_rasterized_elements();
        if !blocked.is_empty() {
            let ids = blocked.join(", ");
            bail!(
                "element_drawop_fingerprint 只在纯矢量元素的 timeline 上与导出指纹可比；这些元素需要 host 光栅化：{ids}"
            );
        }
        let (frame_ops, _) = self.build_overlay_ops(time, None, OverlayParts::ALL)?;
        Ok(format!("{:016x}", render_raster::fingerprint(&frame_ops)))
    }

    /// For testing. Export goes through the fast path of `composite_bgra`. This entry point keeps the full DrawOp path.
    pub fn render_rgba(&mut self, time: f64) -> Result<Vec<u8>> {
        Ok(self.render_overlay_frame(time)?.rgba)
    }

    /// The frame-fetch entry point for App v2 preview. It goes through **the same single** `render_overlay_frame` call as [`Self::render_png`], only skipping the PNG encoding step. GPUI uploads premultiplied RGBA directly, so encoding it to PNG once more would be pure waste.
    ///
    /// That both entry points give the same frame and the same pixels is a contract (main plan M1-R3: “the same kernel with the same input should produce the same pixels”), guarded by `render_png_is_the_encoded_form_of_render_rgba_frame`. The three identities each do their own job and cannot substitute for one another. `subtitle_key` is the subtitle layer's content key (`X-Ccut-Overlay-Key`). `draw_op_fingerprint` is the pixel identity of the whole overlay (`X-Ccut-DrawOp-Fingerprint`). `next_change` is the time of the next content change (`X-Ccut-Overlay-Next`).
    pub fn render_rgba_frame(&mut self, time: f64) -> Result<OverlayRgbaFrame> {
        let frame = self.render_overlay_frame(time)?;
        Ok(OverlayRgbaFrame {
            width: self.width,
            height: self.height,
            subtitle_key: frame.subtitle_key.unwrap_or_default(),
            draw_op_fingerprint: frame.draw_op_fingerprint,
            rgba: frame.rgba,
            next_change: frame.next_change,
        })
    }

    pub fn render_png(&mut self, time: f64) -> Result<OverlayFrame> {
        let frame = self.render_overlay_frame(time)?;
        let size = IntSize::from_wh(self.width, self.height).context("overlay 尺寸必须大于零")?;
        let pixmap = Pixmap::from_vec(frame.rgba, size).context("overlay RGBA 缓冲区尺寸无效")?;
        Ok(OverlayFrame {
            // Going through `render_overlay_frame` guarantees there is a subtitle layer. `unwrap_or_default` is only there to close the type, and is not a reachable branch.
            subtitle_key: frame.subtitle_key.unwrap_or_default(),
            draw_op_fingerprint: frame.draw_op_fingerprint,
            png: pixmap.encode_png().context("编码字幕 overlay PNG")?,
            next_change: frame.next_change,
        })
    }

    /// The layered overlay and the whole-change boundaries for the export path (`--render-backend cpu`, and the whole-frame fallback of the GPU scene). The stacking order matches the GPU scene ([`Self::compositor_scene_frame_with`]): timeline elements → subtitles → template foreground.
    ///
    /// The subtitle layer is kept as its own layer with its own blend mode. So the background that a Designed Caption's blend mode reads is “main picture plus elements” (the same semantics as the GPU's target sampling), and it does not apply to the template foreground either. When the subtitle is empty at this moment, or there are no elements or template above it, the order relative to the subtitle does not matter. In that case the shape stays as “one subtitle layer, with the elements and template folded into one layer”. Pure-subtitle or pure-element frames stay bit-identical, and one full-frame raster is saved.
    pub fn render_export_overlay(
        &mut self,
        time: f64,
    ) -> Result<(Vec<ExportOverlayLayer>, Option<f64>)> {
        // The decoration layer and the element layer share `build_overlay_ops`, so the criterion for “whether to emit this layer” must count the decoration. If only elements were checked, a pure template project (with no elements at all) would drop its entire foreground during export.
        let elements_active = self
            .elements
            .iter()
            .any(|element| time >= element.start && time < element.end);
        let chrome_active = self
            .chrome
            .as_ref()
            .is_some_and(|chrome| chrome.active(time));
        let subtitle = self.render_subtitle_frame(time)?;
        let mut next_change = subtitle.next_change;
        for element in &self.elements {
            for boundary in [element.start, element.end] {
                if boundary > time + 1e-9 {
                    next_change =
                        Some(next_change.map_or(boundary, |current| current.min(boundary)));
                }
            }
        }
        if let Some(boundary) = self
            .chrome
            .as_ref()
            .and_then(|chrome| chrome.next_change(time, self.fps))
        {
            next_change = Some(next_change.map_or(boundary, |current| current.min(boundary)));
        }
        let has_subtitle = subtitle.bounds.is_some();
        let content = subtitle
            .bounds
            .map_or(OverlayContent::Empty, OverlayContent::Bounds);
        let subtitle_layer = ExportOverlayLayer {
            rgba: subtitle.rgba,
            content,
            composite: subtitle.composite,
        };
        let mut layers = Vec::with_capacity(3);
        let push_drawop = |plan: &mut Self,
                               layers: &mut Vec<ExportOverlayLayer>,
                               next_change: &mut Option<f64>,
                               parts: OverlayParts|
         -> Result<()> {
            let frame = plan.render_drawop_layer(time, None, parts)?;
            if let Some(boundary) = frame.next_change {
                *next_change = Some(next_change.map_or(boundary, |current| current.min(boundary)));
            }
            layers.push(ExportOverlayLayer {
                rgba: Arc::new(frame.rgba),
                content: OverlayContent::Unknown,
                composite: CaptionCompositeMode::Normal,
            });
            Ok(())
        };
        if !has_subtitle || !(elements_active || chrome_active) {
            layers.push(subtitle_layer);
            if elements_active || chrome_active {
                push_drawop(self, &mut layers, &mut next_change, OverlayParts::ALL)?;
            }
        } else {
            if elements_active {
                push_drawop(self, &mut layers, &mut next_change, OverlayParts::ELEMENTS)?;
            }
            layers.push(subtitle_layer);
            if chrome_active {
                push_drawop(self, &mut layers, &mut next_change, OverlayParts::CHROME)?;
            }
        }
        Ok((layers, next_change))
    }

    /// Guarantees that `self.composited` covers `time`. The overlay is pixel-identical within `[time, next_change)` (the `next_change` contract, which the Studio preview side also relies on), so subsequent frames within that interval have zero rendering cost. When a patch window jumps the time backward, the cache is naturally invalidated and re-rendered.
    pub fn ensure_composited(&mut self, time: f64) -> Result<()> {
        if let Some(cached) = &self.composited
            && time >= cached.start
            && time < cached.end
        {
            return Ok(());
        }
        let (layers, next_change) = self.render_export_overlay(time)?;
        let end = next_change.unwrap_or(f64::INFINITY).max(time);
        let width = self.width as usize;
        let height = self.height as usize;
        let frames = layers
            .into_iter()
            .filter_map(|layer| {
                // The subtitle layer already computed its bounding box at render time. Only the full DrawOp path needs to scan it now.
                let bounds = match layer.content {
                    OverlayContent::Unknown => alpha_bbox(&layer.rgba, width, height),
                    OverlayContent::Empty => None,
                    OverlayContent::Bounds(bounds) => Some(bounds),
                }?;
                Some(CompositedFrame {
                    rgba: layer.rgba,
                    bounds,
                    composite: layer.composite,
                })
            })
            .collect();
        self.composited = Some(CompositedOverlay {
            start: time,
            end,
            frames,
        });
        Ok(())
    }

    /// Whether the overlay at this output time is fully transparent. When it is, `composite_bgra` does not touch the target buffer at all.
    pub fn overlay_is_blank(&mut self, time: f64) -> Result<bool> {
        self.ensure_composited(time)?;
        Ok(self
            .composited
            .as_ref()
            .is_none_or(|composited| composited.frames.is_empty()))
    }

    pub fn composite_bgra(&mut self, pixels: &mut [u8], stride: usize, time: f64) -> Result<()> {
        let width = self.width as usize;
        let height = self.height as usize;
        if pixels.len() < stride.saturating_mul(height) || stride < width * 4 {
            bail!("原生媒体后端提供了无效的 BGRA 帧缓冲区");
        }
        apply_main_transform_bgra(pixels, stride, self.width, self.height, self.main.as_ref())?;
        self.ensure_composited(time)?;
        let Some(frames) = self
            .composited
            .as_ref()
            .map(|composited| &composited.frames)
        else {
            return Ok(());
        };
        for frame in frames {
            // Only the non-zero alpha bounding box is traversed. Outside the box, alpha is always 0, so blending there is an identity operation.
            let (rows, cols) = (frame.bounds.rows.clone(), frame.bounds.cols.clone());
            for y in rows {
                let overlay = &frame.rgba[(y * width + cols.start) * 4..(y * width + cols.end) * 4];
                let out = &mut pixels[y * stride + cols.start * 4..y * stride + cols.end * 4];
                for (source, target) in overlay.chunks_exact(4).zip(out.chunks_exact_mut(4)) {
                    composite_caption_pixel_bgra(target, source, frame.composite);
                }
            }
        }
        Ok(())
    }

    /// Before GPU overlay compositing, only the main picture's scale, position, and opacity are handled. The export host then hands this BGRA base image to the platform texture pass-through, or to the offscreen target sampling path. Live preview does not use this entry point.
    /// Whether the main picture layer equals, for the whole export, an opaque solid black base.
    ///
    /// This is the shape after the media has been “elementized” and moved onto the timeline (`main.detached`). The base is always black, and the whole picture is drawn by timeline elements. In this case no pixel of the source frame ever reaches the output, so export can skip the whole chain “decode the source frame → scale and copy into the canvas → [`Self::prepare_video_bgra`] fills black → BGRA-to-RGBA swizzle → upload to the GPU”. Instead it lets the compositor clear the target and then stack the scene on top.
    ///
    /// `main.place` does not change over time, so the caller only needs to ask once, at the start of the export.
    pub fn base_frame_is_uniform_black(&self) -> bool {
        main_transform_is_uniform_black(self.main.as_ref())
    }

    pub fn base_frame_is_identity(&self) -> bool {
        main_transform_is_identity(self.main.as_ref(), self.width, self.height)
    }

    pub fn prepare_video_bgra(&self, pixels: &mut [u8], stride: usize) -> Result<()> {
        let width = self.width as usize;
        let height = self.height as usize;
        if pixels.len() < stride.saturating_mul(height) || stride < width * 4 {
            bail!("原生媒体后端提供了无效的 BGRA 帧缓冲区");
        }
        apply_main_transform_bgra(pixels, stride, self.width, self.height, self.main.as_ref())
    }
}

/// Which parts of one DrawOp overlay to draw. (Whether to include the subtitle is decided separately by the caller.)
#[derive(Debug, Clone, Copy)]
struct OverlayParts {
    /// Timeline element.
    elements: bool,
    /// Template foreground (chrome).
    chrome: bool,
}

impl OverlayParts {
    const ALL: Self = Self {
        elements: true,
        chrome: true,
    };
    const ELEMENTS: Self = Self {
        elements: true,
        chrome: false,
    };
    const CHROME: Self = Self {
        elements: false,
        chrome: true,
    };
}

/// Source-over one whole premultiplied RGBA normal overlay onto an opaque BGRA video. Kept for normal-only host and reference use. Modes that need to read the backdrop must go through the compositor's explicit texture entry point or [`OverlayRenderPlan::composite_bgra`].
pub fn composite_normal_rgba_bgra(
    pixels: &mut [u8],
    stride: usize,
    width: u32,
    height: u32,
    overlay: &[u8],
) -> Result<()> {
    let width = width as usize;
    let height = height as usize;
    let row_bytes = width.saturating_mul(4);
    if pixels.len() < stride.saturating_mul(height)
        || stride < row_bytes
        || overlay.len() != row_bytes.saturating_mul(height)
    {
        bail!("GPU overlay 或 BGRA 视频帧缓冲区尺寸无效");
    }
    for row in 0..height {
        let source = &overlay[row * row_bytes..(row + 1) * row_bytes];
        let target = &mut pixels[row * stride..row * stride + row_bytes];
        for (source, target) in source.chunks_exact(4).zip(target.chunks_exact_mut(4)) {
            composite_caption_pixel_bgra(target, source, CaptionCompositeMode::Normal);
        }
    }
    Ok(())
}

fn glyph_scene_mask(
    mask: GlyphAtlasRender,
) -> std::result::Result<Option<Arc<element_draw::GlyphMask>>, SubtitleSceneFallback> {
    let mask = match mask {
        GlyphAtlasRender::Mask(mask) => element_draw::GlyphMask::new(
            element_draw::GlyphKey(mask.key),
            mask.width,
            mask.height,
            mask.left,
            mask.top,
            mask.alpha,
        ),
        GlyphAtlasRender::Color(image) => element_draw::GlyphMask::new_color(
            element_draw::GlyphKey(image.key),
            image.width,
            image.height,
            image.left,
            image.top,
            image.rgba,
        ),
        GlyphAtlasRender::Empty => return Ok(None),
        GlyphAtlasRender::Unsupported => return Err(SubtitleSceneFallback::InvalidMask),
    };
    Ok(Some(Arc::new(
        mask.ok_or(SubtitleSceneFallback::InvalidMask)?,
    )))
}

/// The CPU effect layer draws no outline, shadow, or glow for colored bitmap glyphs. Only the body layer keeps RGBA.
fn glyph_scene_effect_mask(
    mask: GlyphAtlasRender,
) -> std::result::Result<Option<Arc<element_draw::GlyphMask>>, SubtitleSceneFallback> {
    match mask {
        GlyphAtlasRender::Color(_) => Ok(None),
        other => glyph_scene_mask(other),
    }
}

/// Merges one premultiplied RGBA subtitle pixel into an opaque BGRA video pixel. For non-normal modes, the blend is computed in the non-premultiplied color space by the Core Graphics/W3C separable blend formula, and then source-over is applied using the source alpha. This step must see the real video pixels, and cannot be “baked in” ahead of time on the transparent overlay.
pub fn composite_caption_pixel_bgra(
    target: &mut [u8],
    source: &[u8],
    composite: CaptionCompositeMode,
) {
    let alpha = u32::from(source[3]);
    if alpha == 0 {
        return;
    }
    let inverse = 255 - alpha;
    for (source_index, target_index) in [(0, 2), (1, 1), (2, 0)] {
        let source_premultiplied = u32::from(source[source_index]);
        let backdrop = u32::from(target[target_index]);
        let value = match composite {
            CaptionCompositeMode::Normal => source_premultiplied + backdrop * inverse / 255,
            CaptionCompositeMode::Difference
            | CaptionCompositeMode::Exclusion
            | CaptionCompositeMode::Screen => {
                let source_color = ((source_premultiplied * 255 + alpha / 2) / alpha).min(255);
                let blended = match composite {
                    CaptionCompositeMode::Difference => backdrop.abs_diff(source_color),
                    CaptionCompositeMode::Exclusion => {
                        backdrop + source_color - 2 * backdrop * source_color / 255
                    }
                    CaptionCompositeMode::Screen => {
                        backdrop + source_color - backdrop * source_color / 255
                    }
                    CaptionCompositeMode::Normal => unreachable!(),
                };
                (blended * alpha + backdrop * inverse + 127) / 255
            }
        };
        target[target_index] = value.min(255) as u8;
    }
    target[3] = 255;
}

/// The index of the “current word” at this moment. A whitespace word cannot be the current word, because it has no glyph to highlight, and landing on whitespace would make the whole line look as if it has no active word. Search forward first for the nearest non-whitespace word, and search backward only if none is found.
///
/// The cache key and the actual rendering both use it, so it must be the same function. Writing it out twice would give two opinions about “which word is being read now”, and the cache would start returning images that do not match the frame.
pub fn current_word_index(item: &TimedItem, time: f64) -> usize {
    let current = item
        .words
        .iter()
        .position(|word| time < word.end)
        .unwrap_or_else(|| item.words.len().saturating_sub(1));
    (0..=current)
        .rev()
        .find(|&index| {
            item.words
                .get(index)
                .is_some_and(|word| !word.text.trim().is_empty())
        })
        .or_else(|| {
            (current + 1..item.words.len()).find(|&index| !item.words[index].text.trim().is_empty())
        })
        .unwrap_or(current)
}

/// A deterministic 64-bit projection of `definition_key + subtitle_key`. The subtitle key describes only the current cue, word, and animation frame. Plan definitions such as font, style, and canvas must enter the SceneFrame identity at the same time. Otherwise two different projects would wrongly reuse a retained scene.
pub fn subtitle_scene_fingerprint(definition_key: &str, key: &str) -> u64 {
    definition_key
        .as_bytes()
        .iter()
        .chain(std::iter::once(&0xff))
        .chain(key.as_bytes())
        .fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100_0000_01b3)
        })
}

/// A text element's contribution to the GPU SceneFrame identity.
///
/// `definition_key` covers only the **on-disk projected document**, plus canvas, fps, mode, and includes. During App stage dragging, the preview changes the `place` on the in-memory `OverlayRenderPlan` directly, and the on-disk truth does not move. If the identity were composed only of `definition_key + id + time`, it would be completely insensitive to text geometry. Every preview frame would then be dropped by the SceneFrame de-duplication guard, so the selection box would move while the glyphs waited until mouse-up to jump. So here every element field that can change the text scene node is folded into the key: the time window, the geometry `Place` (x/y/w/scale/scaleY/rot/opacity/radius/mirror), the vertical anchor, tiling, the text and its counts, the style, and the animation.
///
/// All fields go through `Debug` or fixed-length formatting. There is no HashMap iteration order and no pointer address (`serde_json::Value`'s object is an ordered `Map`). So evaluating the same element repeatedly always gives the same value, and the de-duplication guard still holds for frames where “nothing moved”.
fn text_element_scene_fingerprint(
    definition_key: &str,
    element: &TimelineVisualElement,
    time: f64,
) -> u64 {
    let key = format!(
        "text:{id}:{time:.6}:{start:?}:{end:?}:{place:?}:{valign:?}:{tile:?}:{animation:?}:{text:?}:{counter:?}:{style}",
        id = element.id,
        start = element.start,
        end = element.end,
        place = element.place,
        valign = element.vertical_align,
        tile = element.tile,
        animation = element.animation,
        text = element.text,
        counter = element.counter,
        style = element.style,
    );
    subtitle_scene_fingerprint(definition_key, &key)
}

fn subtitle_scene_motion(
    style: &Value,
    display_start: f64,
    canvas_scale: f64,
    fps: f64,
    anchor: (f64, f64),
    rotation: f64,
) -> Option<element_draw::SceneMotion> {
    let transition = style.get("transition").unwrap_or(&Value::Null);
    let id = transition
        .get("transitionId")
        .or_else(|| transition.get("id"))
        .and_then(Value::as_str)
        .or_else(|| style.get("transitionId").and_then(Value::as_str))
        .unwrap_or("none");
    let recipe = render_raster::caption_transition(id)?;
    let duration = transition_duration(style);
    if !duration.is_finite() || duration <= 0.0 {
        return None;
    }
    let fps = fps.max(1.0);
    let start = (display_start * fps).round() / fps;
    let end = start + duration;
    let from = transition_pose(style, start, start, canvas_scale, fps);
    Some(element_draw::SceneMotion {
        start,
        end,
        from: element_draw::ScenePose {
            transform: transform_array(group_transform(
                anchor.0,
                anchor.1,
                from.scale_x,
                from.scale_y,
                rotation,
            )),
            opacity: from.opacity as f32,
            blur: from.blur as f32,
        },
        to: element_draw::ScenePose {
            transform: transform_array(group_transform(anchor.0, anchor.1, 1.0, 1.0, rotation)),
            opacity: 1.0,
            blur: 0.0,
        },
        curve: recipe.curve.clone(),
        solver: if recipe.solver == "newton6-bisect10-1e-6" {
            element_draw::SceneCurveSolver::Caption
        } else {
            element_draw::SceneCurveSolver::Standard
        },
    })
}

fn is_external_media_element(element: &TimelineVisualElement) -> bool {
    matches!(element.kind, ElementKind::Image | ElementKind::Video)
        || element.kind == ElementKind::Placeholder && element.src_id.is_some()
        || element.kind == ElementKind::Sticker
            && element
                .sticker
                .as_ref()
                .is_some_and(|props| props.source == timeline::schema::STICKER_SOURCE_ASSET)
}

fn element_display_text(element: &TimelineVisualElement, time: f64) -> String {
    element
        .counter
        .as_ref()
        .map(|counter| counter.text_at(element.start, element.end, time))
        .unwrap_or_else(|| element.text.clone().unwrap_or_default())
}

/// The renderer-neutral identity of a TextureNode. The pixels are folded into a single hash, to avoid copying a whole source frame into a temporary scene-identity buffer. Geometry, sampling clock, and fit/background are still frozen field by field.
#[cfg(feature = "host")]
fn texture_scene_fingerprint(node: &element_draw::TextureNode, rgba: &[u8]) -> u64 {
    texture_scene_fingerprint_with_pixel_hash(node, render_raster::drawop::fnv1a64(rgba))
}

#[cfg(feature = "host")]
fn texture_scene_fingerprint_with_pixel_hash(
    node: &element_draw::TextureNode,
    pixel_hash: u64,
) -> u64 {
    let mut bytes = Vec::with_capacity(node.texture.len() + 96 + node.source_effects.len() * 12);
    bytes.extend_from_slice(node.texture.as_bytes());
    bytes.push(0);
    bytes.extend_from_slice(&node.media_ms.to_le_bytes());
    bytes.extend_from_slice(&node.source_width.to_le_bytes());
    bytes.extend_from_slice(&node.source_height.to_le_bytes());
    for value in node.rect.into_iter().chain(node.transform) {
        bytes.extend_from_slice(&value.to_bits().to_le_bytes());
    }
    bytes.extend_from_slice(&node.opacity.to_bits().to_le_bytes());
    bytes.extend_from_slice(&node.radius.to_bits().to_le_bytes());
    bytes.push(match node.mask_shape {
        element_draw::TextureMaskShape::RoundedRect => 0,
        element_draw::TextureMaskShape::Ellipse => 1,
    });
    bytes.extend_from_slice(&node.mask_feather.to_bits().to_le_bytes());
    bytes.extend_from_slice(&(node.source_effects.len() as u32).to_le_bytes());
    for effect in node.source_effects.iter() {
        match *effect {
            element_draw::TextureEffect::ColorAdjust {
                grayscale,
                brightness,
            } => {
                bytes.push(0);
                bytes.extend_from_slice(&grayscale.to_bits().to_le_bytes());
                bytes.extend_from_slice(&brightness.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Grayscale(amount) => {
                bytes.push(1);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Brightness(amount) => {
                bytes.push(2);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Contrast(amount) => {
                bytes.push(3);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Saturation(amount) => {
                bytes.push(4);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Sepia(amount) => {
                bytes.push(5);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::HueRotate(degrees) => {
                bytes.push(6);
                bytes.extend_from_slice(&degrees.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Invert(amount) => {
                bytes.push(7);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Blur(radius) => {
                bytes.push(8);
                bytes.extend_from_slice(&radius.to_le_bytes());
            }
            element_draw::TextureEffect::Sharpen(amount) => {
                bytes.push(9);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Noise(amount) => {
                bytes.push(10);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
            element_draw::TextureEffect::Vignette(amount) => {
                bytes.push(11);
                bytes.extend_from_slice(&amount.to_bits().to_le_bytes());
            }
        }
    }
    bytes.extend_from_slice(&node.reveal.to_bits().to_le_bytes());
    bytes.extend_from_slice(&node.iris.to_bits().to_le_bytes());
    bytes.push(match node.fit {
        element_draw::TextureFit::Cover => 0,
        element_draw::TextureFit::Contain => 1,
    });
    bytes.push(match node.background {
        element_draw::TextureBackground::Transparent => 0,
        element_draw::TextureBackground::Black => 1,
        element_draw::TextureBackground::Blur => 2,
        element_draw::TextureBackground::Color(_) => 3,
    });
    if let element_draw::TextureBackground::Color(rgb) = node.background {
        bytes.extend_from_slice(&rgb);
    }
    bytes.extend_from_slice(&pixel_hash.to_le_bytes());
    render_raster::drawop::fnv1a64(&bytes)
}

/// The pixel proxy for [`SceneIdentity::Structural`]: concatenates several byte segments that determine a texture's content and hashes them (a 0 separator between segments, so that “ab|c” does not collide with “a|bc”).
#[cfg(feature = "host")]
fn structural_pixel_hash(parts: &[&[u8]]) -> u64 {
    let mut bytes = Vec::with_capacity(parts.iter().map(|part| part.len() + 1).sum());
    for part in parts {
        bytes.extend_from_slice(part);
        bytes.push(0);
    }
    render_raster::drawop::fnv1a64(&bytes)
}

/// Combines a group of scene nodes of one media element, and the pixel hash they share (real pixels or the structural proxy), into one identity.
#[cfg(feature = "host")]
fn texture_scene_nodes_fingerprint(nodes: &[element_draw::SceneNode], pixel_hash: u64) -> u64 {
    let mut node_fingerprints = nodes
        .iter()
        .map(|node| texture_scene_node_fingerprint(node, pixel_hash));
    let Some(first) = node_fingerprints.next() else {
        return pixel_hash;
    };
    let Some(second) = node_fingerprints.next() else {
        return first;
    };
    let mut bytes = Vec::with_capacity(nodes.len() * 8);
    bytes.extend_from_slice(&first.to_le_bytes());
    bytes.extend_from_slice(&second.to_le_bytes());
    for fingerprint in node_fingerprints {
        bytes.extend_from_slice(&fingerprint.to_le_bytes());
    }
    render_raster::drawop::fnv1a64(&bytes)
}

#[cfg(feature = "host")]
fn texture_scene_node_is_supported(node: &element_draw::SceneNode) -> bool {
    match node {
        element_draw::SceneNode::Texture(_) => true,
        element_draw::SceneNode::BlurredGroup(group) => {
            group.motion.is_none()
                && group.composite == element_draw::SceneCompositeMode::Normal
                && group.nodes.iter().all(texture_scene_node_is_supported)
        }
        _ => false,
    }
}

#[cfg(feature = "host")]
fn texture_scene_node_fingerprint(node: &element_draw::SceneNode, pixel_hash: u64) -> u64 {
    match node {
        element_draw::SceneNode::Texture(node) => {
            texture_scene_fingerprint_with_pixel_hash(node, pixel_hash)
        }
        element_draw::SceneNode::BlurredGroup(group) => {
            debug_assert!(group.motion.is_none());
            let mut bytes = Vec::with_capacity(5 + group.nodes.len() * 8);
            bytes.push(1);
            bytes.extend_from_slice(&group.radius.to_bits().to_le_bytes());
            bytes.push(match group.composite {
                element_draw::SceneCompositeMode::Normal => 0,
                element_draw::SceneCompositeMode::Screen => 1,
                element_draw::SceneCompositeMode::Difference => 2,
                element_draw::SceneCompositeMode::Exclusion => 3,
            });
            for child in &group.nodes {
                bytes.extend_from_slice(
                    &texture_scene_node_fingerprint(child, pixel_hash).to_le_bytes(),
                );
            }
            render_raster::drawop::fnv1a64(&bytes)
        }
        _ => unreachable!("外部媒体场景只允许 TextureNode / BlurredGroup"),
    }
}

/// Quantities of a subtitle with layered text animation that are frozen at compile time. `text_motion_state` is called once per frame by both the cache key and `next_change`. Word start times and the grapheme count depend only on this subtitle and the plan's frame rate, so they should not be re-allocated and re-counted every frame.
#[derive(Debug, Clone)]
struct TextMotionItem {
    /// Word start time (display-clock offset, snapped to frames). Same convention as `text_motion_starts`.
    starts: Arc<[f64]>,
    /// Grapheme count (at least 1), fed to `boundary_windows` and `changing_at`.
    units: usize,
    /// The translation line's KTV word sweep follows the original-text singing. It uses the real original-text words `(start, end)` (project seconds) that fall within the same time span as this translation. Original-text lines and lines without `karaoke` give `None`.
    karaoke_words: Option<Arc<[(f64, f64)]>>,
}

/// A timing table aligned to items by index. An entry is `Some` only if this item's final style (the whole track with per-item overrides applied) carries `textMotion` or `wordBackground`. `fps` takes `max(1.0)`, consistent with the plan.
fn text_motion_items(
    items: &[TimedItem],
    kind: LineKind,
    base: &LineStyle,
    overrides: &HashMap<String, Arc<CueOverride>>,
    originals: &[TimedItem],
    fps: f64,
) -> Vec<Option<TextMotionItem>> {
    let fps = fps.max(1.0);
    items
        .iter()
        .map(|item| {
            let style = overrides.get(&item.id).map_or(base, |entry| &entry.style);
            (style.text_motion.is_some() || style.word_background.is_some()).then(|| {
                TextMotionItem {
                    starts: text_motion_starts(item, kind, fps).into(),
                    units: item.text.graphemes(true).count().max(1),
                    karaoke_words: (kind == LineKind::Translation
                        && style
                            .text_motion
                            .as_ref()
                            .is_some_and(|m| m.spec.karaoke.is_some()))
                    .then(|| karaoke_words_for(item, originals))
                    .flatten(),
                }
            })
        })
        .collect()
}

/// A translation has no words of its own, so KTV sweeping borrows the real original-text words in the same time span. The span is the sentence-level start and end of this translation (derived words fill `start..end`). Original-text words whose midpoint falls inside it are counted. Words of adjacent sentences that start exactly at the boundary are not counted. Derived placeholder words are not counted. If there are none, nothing is swept.
fn karaoke_words_for(item: &TimedItem, originals: &[TimedItem]) -> Option<Arc<[(f64, f64)]>> {
    let start = item.words.first().map_or(item.display_start, |w| w.start);
    let end = item.words.last().map_or(item.display_end, |w| w.end);
    let slack = 0.05;
    let words = originals
        .iter()
        .filter(|cue| cue.display_end >= start - slack && cue.display_start <= end + slack)
        .flat_map(|cue| cue.words.iter())
        .filter(|w| !w.id.starts_with("derived-"))
        .filter(|w| {
            let middle = (w.start + w.end.max(w.start)) / 2.0;
            middle >= start - slack && middle <= end + slack
        })
        .map(|w| (w.start, w.end.max(w.start)))
        .collect::<Vec<_>>();
    (!words.is_empty()).then(|| words.into())
}

/// The maximum gap (seconds) for KTV to preview the next sentence. Any further away and it is an interlude, so the next sentence waits to appear on its own.
const KARAOKE_NEXT_LINE_MAX_GAP: f64 = 8.0;

/// The index-returning version of [`active_at`]: same `partition_point` criterion.
fn active_index(items: &[TimedItem], time: f64) -> Option<usize> {
    let next = items.partition_point(|item| item.display_start <= time);
    next.checked_sub(1)
        .filter(|&index| time < items[index].display_end)
}

/// Whether a text element's style carries layered text animation or a per-word background block (the same criterion as the fallback check in `text_element_scene_nodes`).
fn text_element_has_motion(element: &TimelineVisualElement) -> bool {
    element.style["textMotion"].is_object() || element.style["wordBackground"].is_object()
}

/// The scheduling phase of a text element with layered text animation at a given moment.
#[derive(Debug, Clone, Copy, PartialEq)]
enum TextElementMotionPhase {
    /// On this frame it is moving (entrance, exit, or loop, or the element also has an `animation`), so it is rebuilt frame by frame.
    Changing,
    /// A still segment: one image for the whole segment. `anchor` is the segment start (project seconds), used as the identity and the sampling clock. `until` is the next moment it changes (the half-frame before the exit starts; if there is no exit, it is the element's end).
    Still { anchor: f64, until: f64 },
}

/// The same sampling convention as `text_motion_raster`: the local clock snaps to frames, duration = `end − start`, text elements have no word times (starts is empty, so word emphasis does not trigger), and units = the grapheme count of the displayed text. Only with `wordBackground` (and no `textMotion`) does the block not change over time, so it stays entirely still.
fn text_element_motion_phase(
    element: &TimelineVisualElement,
    time: f64,
    fps: f64,
) -> TextElementMotionPhase {
    if element.animation.is_some() || element.has_visual_keyframes() {
        return TextElementMotionPhase::Changing;
    }
    let fps = fps.max(1.0);
    let motion = element
        .style
        .get("textMotion")
        .filter(|value| value.is_object())
        .and_then(|value| {
            serde_json::from_value::<motion::text_motion::TextMotion>(value.clone()).ok()
        })
        .and_then(|motion| motion.compile().ok());
    let Some(motion) = motion else {
        return TextElementMotionPhase::Still {
            anchor: element.start,
            until: element.end,
        };
    };
    let duration = element.end - element.start;
    let local = ((time - element.start) * fps).round() / fps;
    let units = element_display_text(element, time)
        .graphemes(true)
        .count()
        .max(1);
    if motion.changing_at(local, duration, fps, units, &[]) {
        return TextElementMotionPhase::Changing;
    }
    let (enter, exit) = motion.boundary_windows(duration, fps, units);
    // With no exit, `exit == duration`, and that half-frame boundary falls before the end but changes nothing.
    let exit_at = element.start + exit - 0.5 / fps;
    TextElementMotionPhase::Still {
        anchor: element.start + enter,
        until: if exit < duration - 1e-9 && exit_at > time + 1e-9 {
            exit_at.min(element.end)
        } else {
            element.end
        },
    }
}

/// The texture window cropped when a CPU raster layer enters the GPU scene. It must cover the non-zero alpha bounding box, and its width and height are rounded up to multiples of 64 pixels (not exceeding the canvas; near an edge the window is shifted back). Outside the window everything is already fully transparent, so any window covering the bounding box is pixel-equivalent to the whole. The rounding only lets a bounding box that shifts slightly from frame to frame reuse a GPU texture slot of the same size, instead of rebuilding the texture and bindings every frame.
#[cfg(feature = "host")]
fn motion_texture_window(
    bounds: &ContentBox,
    width: usize,
    height: usize,
) -> (usize, usize, usize, usize) {
    const BUCKET: usize = 64;
    let span = |len: usize, limit: usize| {
        len.max(1)
            .div_ceil(BUCKET)
            .saturating_mul(BUCKET)
            .min(limit)
    };
    let (w, h) = (
        span(bounds.cols.len(), width),
        span(bounds.rows.len(), height),
    );
    (
        bounds.cols.start.min(width - w),
        bounds.rows.start.min(height - h),
        w,
        h,
    )
}

fn min_optional_time(left: Option<f64>, right: Option<f64>) -> Option<f64> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.min(right)),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

/// The single geometry result for the subtitle plates. The CPU rasterization and the GPU scene both consume this plate list. The DrawOp side does not recompute line wrapping, shared plates, or lines that have left the stack.
fn subtitle_background_plates(layouts: &[LineLayout], stack: &StackLayout) -> Vec<SubtitlePlate> {
    let mut plates = Vec::new();
    if stack.shared_background
        && let Some(plate_line) = stack.plate_line.and_then(|index| layouts.get(index))
        && has_real_background(plate_line)
        && let Some((span_top, span_bottom)) = stack.span
    {
        // `span` is the glyph range, and the plate extends outward by a ring. All three margins are taken from `plate_line`, isomorphic to Mac's `max(bare width) + bg.padH × 2`.
        let pad_h = plate_line.style.background_pad_h;
        let pad_v = plate_line.style.background_pad_v;
        let width = (layouts
            .iter()
            .zip(&stack.overrides)
            .filter(|(_, over)| over.is_none())
            .map(|(line, _)| line.width)
            .fold(0.0, f64::max)
            + pad_h * 2.0)
            .max(plate_line.style.background_min_width);
        plates.push(SubtitlePlate {
            rect: SubtitlePlateRect {
                x: stack.anchor.0 - width / 2.0,
                y: span_top - pad_v,
                width,
                height: span_bottom - span_top + pad_v * 2.0,
                radius: plate_line.style.background_radius,
            },
            color: plate_line.style.background_color,
            motion_line: if layouts.len() == 1 { Some(0) } else { None },
        });
    }

    for (index, layout) in layouts.iter().enumerate() {
        let floating = stack.overrides.get(index).is_some_and(Option::is_some);
        if !layout.style.background_on || (!floating && stack.shared_background) {
            continue;
        }
        let Some((center_x, top)) = stack.placements.get(index).copied() else {
            continue;
        };
        plates.extend(
            line_background_rects(layout, center_x, top)
                .into_iter()
                .map(|rect| SubtitlePlate {
                    rect,
                    color: layout.style.background_color,
                    motion_line: Some(index),
                }),
        );
    }
    plates
}

/// Encodes the unique plate geometry as renderer-neutral DrawOps. No second set of layout rules is introduced.
fn subtitle_background_ops(
    layouts: &[LineLayout],
    stack: &StackLayout,
    animation: &WordAnimation,
) -> FrameOps {
    let mut frame = FrameOps::default();
    for plate in subtitle_background_plates(layouts, stack) {
        let (opacity, transform) = plate
            .motion_line
            .and_then(|index| {
                let layout = layouts.get(index)?;
                let motion = layout_motion(layout, animation)?;
                let (center_x, top) = stack.placements.get(index).copied()?;
                Some((
                    motion.block.opacity,
                    group_transform_for_motion(
                        &motion.block,
                        center_x,
                        top + layout.height / 2.0,
                        layout.height,
                    ),
                ))
            })
            .unwrap_or((1.0, Transform::identity()));
        push_subtitle_plate(&mut frame, plate.rect, plate.color, opacity, transform);
    }
    frame
}

fn push_subtitle_plate(
    frame: &mut FrameOps,
    rect: SubtitlePlateRect,
    color: SubtitleColor,
    opacity: f64,
    transform: Transform,
) {
    frame.ops.push(DrawOp::FillRect {
        x: rect.x as f32,
        y: rect.y as f32,
        w: rect.width as f32,
        h: rect.height as f32,
        radius: rect.radius as f32,
        color: subtitle_scene_color(color, opacity),
        tf: transform_array(transform),
    });
}

const SUBTITLE_INTERLEAVED_RUN_LIMIT: usize = 128;

struct SubtitleWordPass {
    uniform_index: u32,
    /// The classic per-word backing plate, or the procedural backing plate of a Designed Caption, that the CPU `draw_line_layout` lays down before this chunk's glyphs. It already carries scene pose and motion, and can be inserted directly in draw order.
    before: Vec<element_draw::SceneNode>,
    /// The ordinary or per-word underline that the CPU `draw_line_layout` lays down after this chunk's glyphs.
    after: FrameOps,
    /// Whether the current chunk needs the `glyphDuplicate` layer declared by the descriptor. The array itself also contains transparent entries for the translation line, to keep uniform indices aligned. A node is assembled only when this bit is true.
    duplicate: bool,
    /// The fixed outline layer for neon glow and weight shift. While inactive it still submits transparent uniforms, so the node and the alpha-mask geometry keep the same identity across frames.
    recipe_stroke: bool,
    /// Whether the current chunk has stable emoji geometry. Even when this frame's effect is inactive, the node is kept. Opacity is set to zero by the decoration uniform, so later frames do not re-shape or re-rasterize.
    emoji: bool,
}

fn push_subtitle_word_background(
    frame: &mut FrameOps,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius: f64,
    color: SubtitleColor,
    opacity: f64,
    transform: Transform,
) {
    frame.ops.push(DrawOp::FillRect {
        x: x as f32,
        y: y as f32,
        w: width as f32,
        h: height as f32,
        radius: radius as f32,
        color: subtitle_scene_color(color, opacity),
        tf: transform_array(transform),
    });
}

/// In the CPU reference, `GlyphRender::ColorBitmap` does not enter the echo/duplicate branch. Most subtitles are alpha masks, in which case the body Arc is reused directly. Only when colored glyphs are mixed in is a filtered stable geometry built, and it is cached with a bounded size.
fn duplicate_glyph_geometry(
    geometry_key: &str,
    geometry: &Arc<[element_draw::GlyphInstance]>,
    geometry_cache: &mut VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
) -> Arc<[element_draw::GlyphInstance]> {
    if geometry.iter().all(|glyph| !glyph.mask.pixels.is_color()) {
        return Arc::clone(geometry);
    }
    let cache_key = format!("{geometry_key}:duplicate-alpha");
    let duplicate = geometry_cache
        .iter()
        .position(|(key, _)| key == &cache_key)
        .and_then(|index| geometry_cache.remove(index))
        .map(|(_, geometry)| geometry)
        .unwrap_or_else(|| {
            geometry
                .iter()
                .filter(|glyph| !glyph.mask.pixels.is_color())
                .cloned()
                .collect::<Vec<_>>()
                .into()
        });
    geometry_cache.push_front((cache_key, Arc::clone(&duplicate)));
    while geometry_cache.len() > 48 {
        geometry_cache.pop_back();
    }
    duplicate
}

#[allow(clippy::too_many_arguments)]
fn compact_glyph_segment(
    geometry: &Arc<[element_draw::GlyphInstance]>,
    uniforms: &[element_draw::GlyphRunUniform],
    uniform_indices: &[u32],
    texture: Option<&Arc<element_draw::GlyphTexture>>,
    pose: element_draw::ScenePose,
    motion: Option<&element_draw::SceneMotion>,
    composite: element_draw::GlyphCompositeMode,
    cache_key: &str,
    geometry_cache: &mut VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
) -> Option<element_draw::GlyphRun> {
    let is_complete_run = uniform_indices.len() == uniforms.len()
        && uniform_indices
            .iter()
            .enumerate()
            .all(|(index, uniform)| *uniform as usize == index);
    if is_complete_run {
        return (!geometry.is_empty()).then(|| element_draw::GlyphRun {
            glyphs: Arc::clone(geometry),
            uniforms: uniforms.to_vec(),
            texture: texture.cloned(),
            composite,
            pose,
            motion: motion.cloned(),
        });
    }
    let mut remap = vec![u32::MAX; uniforms.len()];
    let mut compact_uniforms = Vec::with_capacity(uniform_indices.len());
    for &global_index in uniform_indices {
        let slot = remap.get_mut(global_index as usize)?;
        if *slot != u32::MAX {
            continue;
        }
        *slot = u32::try_from(compact_uniforms.len()).ok()?;
        compact_uniforms.push(*uniforms.get(global_index as usize)?);
    }
    let compact_geometry = geometry_cache
        .iter()
        .position(|(key, _)| key == cache_key)
        .and_then(|index| geometry_cache.remove(index))
        .map(|(_, geometry)| geometry)
        .unwrap_or_else(|| {
            geometry
                .iter()
                .filter_map(|glyph| {
                    let local_index = *remap.get(glyph.uniform_index as usize)?;
                    (local_index != u32::MAX).then(|| {
                        let mut glyph = glyph.clone();
                        glyph.uniform_index = local_index;
                        glyph
                    })
                })
                .collect::<Vec<_>>()
                .into()
        });
    if compact_geometry.is_empty() {
        return None;
    }
    geometry_cache.push_front((cache_key.to_owned(), Arc::clone(&compact_geometry)));
    while geometry_cache.len() > 48 {
        geometry_cache.pop_back();
    }
    Some(element_draw::GlyphRun {
        glyphs: compact_geometry,
        uniforms: compact_uniforms,
        texture: texture.cloned(),
        composite,
        pose,
        motion: motion.cloned(),
    })
}

#[allow(clippy::too_many_arguments)]
fn push_glyph_fill_segment(
    nodes: &mut Vec<element_draw::SceneNode>,
    uniform_indices: &[u32],
    geometry_key: &str,
    layer_key: &str,
    geometry: &Arc<[element_draw::GlyphInstance]>,
    uniforms: &[element_draw::GlyphRunUniform],
    texture: Option<&Arc<element_draw::GlyphTexture>>,
    pose: element_draw::ScenePose,
    motion: Option<&element_draw::SceneMotion>,
    composite: element_draw::GlyphCompositeMode,
    geometry_cache: &mut VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
) {
    let segment = uniform_indices
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(",");
    if let Some(run) = compact_glyph_segment(
        geometry,
        uniforms,
        uniform_indices,
        texture,
        pose,
        motion,
        composite,
        &format!("{geometry_key}:{layer_key}:{segment}"),
        geometry_cache,
    ) {
        nodes.push(element_draw::SceneNode::Glyphs(Arc::new(run)));
    }
}

#[allow(clippy::too_many_arguments)]
fn push_glyph_segment(
    nodes: &mut Vec<element_draw::SceneNode>,
    uniform_indices: &[u32],
    geometry_key: &str,
    outline_geometry: &Arc<[element_draw::GlyphInstance]>,
    geometry: &Arc<[element_draw::GlyphInstance]>,
    outline_uniforms: &[element_draw::GlyphRunUniform],
    uniforms: &[element_draw::GlyphRunUniform],
    texture: Option<&Arc<element_draw::GlyphTexture>>,
    pose: element_draw::ScenePose,
    motion: Option<&element_draw::SceneMotion>,
    composite: element_draw::GlyphCompositeMode,
    geometry_cache: &mut VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
) {
    if uniform_indices.is_empty() {
        return;
    }
    let segment = uniform_indices
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(",");
    if let Some(run) = compact_glyph_segment(
        outline_geometry,
        outline_uniforms,
        uniform_indices,
        None,
        pose,
        motion,
        composite,
        &format!("{geometry_key}:outline:{segment}"),
        geometry_cache,
    ) {
        nodes.push(element_draw::SceneNode::Glyphs(Arc::new(run)));
    }
    push_glyph_fill_segment(
        nodes,
        uniform_indices,
        geometry_key,
        "fill",
        geometry,
        uniforms,
        texture,
        pose,
        motion,
        composite,
        geometry_cache,
    );
}

fn push_word_vector_node(
    nodes: &mut Vec<element_draw::SceneNode>,
    frame: FrameOps,
    pose: element_draw::ScenePose,
    motion: Option<&element_draw::SceneMotion>,
) {
    if frame.ops.is_empty() {
        return;
    }
    nodes.push(element_draw::SceneNode::AnimatedVectors {
        frame: Arc::new(frame),
        pose,
        motion: motion.cloned(),
    });
}

#[allow(clippy::too_many_arguments)]
fn push_interleaved_word_nodes(
    nodes: &mut Vec<element_draw::SceneNode>,
    passes: Vec<SubtitleWordPass>,
    geometry_key: &str,
    outline_geometry: &Arc<[element_draw::GlyphInstance]>,
    geometry: &Arc<[element_draw::GlyphInstance]>,
    duplicate_geometry: &Arc<[element_draw::GlyphInstance]>,
    decoration_geometry: &Arc<[element_draw::GlyphInstance]>,
    outline_uniforms: &[element_draw::GlyphRunUniform],
    uniforms: &[element_draw::GlyphRunUniform],
    duplicate_uniform_layers: &[Vec<element_draw::GlyphRunUniform>],
    recipe_stroke_uniform_layers: &[Vec<element_draw::GlyphRunUniform>],
    decoration_uniforms: &[element_draw::GlyphRunUniform],
    texture: Option<&Arc<element_draw::GlyphTexture>>,
    pose: element_draw::ScenePose,
    motion: Option<&element_draw::SceneMotion>,
    composite: element_draw::GlyphCompositeMode,
    geometry_cache: &mut VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
) {
    let mut pending = Vec::new();
    for SubtitleWordPass {
        uniform_index,
        before,
        after,
        duplicate,
        recipe_stroke,
        emoji,
    } in passes
    {
        if !before.is_empty() || duplicate || recipe_stroke || emoji {
            push_glyph_segment(
                nodes,
                &pending,
                geometry_key,
                outline_geometry,
                geometry,
                outline_uniforms,
                uniforms,
                texture,
                pose,
                motion,
                composite,
                geometry_cache,
            );
            pending.clear();
            // The CPU `draw_caption_recipe_decorations` runs before the plate, duplicate, outline, and body text. Emoji must stay in the same per-word z slot, rather than being grouped by type before or after all the body text.
            if emoji {
                push_glyph_fill_segment(
                    nodes,
                    &[uniform_index],
                    geometry_key,
                    "decoration-emoji",
                    decoration_geometry,
                    decoration_uniforms,
                    None,
                    pose,
                    motion,
                    composite,
                    geometry_cache,
                );
            }
            nodes.extend(before);
            if duplicate {
                let duplicate_layer_key = if Arc::ptr_eq(duplicate_geometry, geometry) {
                    "fill"
                } else {
                    "duplicate"
                };
                for layer_uniforms in duplicate_uniform_layers {
                    push_glyph_fill_segment(
                        nodes,
                        &[uniform_index],
                        geometry_key,
                        duplicate_layer_key,
                        duplicate_geometry,
                        layer_uniforms,
                        None,
                        pose,
                        motion,
                        composite,
                        geometry_cache,
                    );
                }
            }
            if recipe_stroke {
                for layer_uniforms in recipe_stroke_uniform_layers {
                    push_glyph_fill_segment(
                        nodes,
                        &[uniform_index],
                        geometry_key,
                        "recipe-stroke",
                        duplicate_geometry,
                        layer_uniforms,
                        None,
                        pose,
                        motion,
                        composite,
                        geometry_cache,
                    );
                }
            }
        }
        pending.push(uniform_index);
        if !after.ops.is_empty() {
            push_glyph_segment(
                nodes,
                &pending,
                geometry_key,
                outline_geometry,
                geometry,
                outline_uniforms,
                uniforms,
                texture,
                pose,
                motion,
                composite,
                geometry_cache,
            );
            pending.clear();
            push_word_vector_node(nodes, after, pose, motion);
        }
    }
    push_glyph_segment(
        nodes,
        &pending,
        geometry_key,
        outline_geometry,
        geometry,
        outline_uniforms,
        uniforms,
        texture,
        pose,
        motion,
        composite,
        geometry_cache,
    );
}

/// The underline conventions of the CPU `draw_line_layout`: a default baseline offset of 0.10em, a line height of 0.06em with at least 1px, and a corner radius of 0.03em. Classic per-word Paint can override the offset and interleave with the corresponding chunk glyphs in CPU order. Designed Caption's plate and duplicate already go through their own retained nodes, while the other recipe decorations still fall back by type.
fn push_subtitle_underline(
    frame: &mut FrameOps,
    x: f64,
    y: f64,
    width: f64,
    font_size: f64,
    color: SubtitleColor,
    opacity: f64,
    transform: Transform,
) {
    frame.ops.push(DrawOp::FillRect {
        x: x as f32,
        y: y as f32,
        w: width as f32,
        h: (font_size * 0.06).max(1.0) as f32,
        radius: (font_size * 0.03) as f32,
        color: subtitle_scene_color(color, opacity),
        tf: transform_array(transform),
    });
}

fn subtitle_scene_color(color: SubtitleColor, opacity: f64) -> [f32; 4] {
    [
        f32::from(color.r) / 255.0,
        f32::from(color.g) / 255.0,
        f32::from(color.b) / 255.0,
        (((255 - color.a) as f64 / 255.0) * opacity).clamp(0.0, 1.0) as f32,
    ]
}

/// The stable geometry of the scene depends only on the plan definition and the currently visible lines. Per-word state, entrance pose, and color are all carried by run uniforms. Designed Caption's grouped layout replaces the visible words within the same cue id, so it also encodes the actual line and word signature. For ordinary whole-sentence subtitles, the signature does not change across per-word boundaries. In bilingual mode the kind is encoded too, to prevent the original and the translation with the same id from colliding. The per-frame text-swap signature is appended by [`subtitle_glyph_geometry_key_with_visuals`], and must not be mixed into this static layout key.
pub fn subtitle_glyph_geometry_key(definition_key: &str, layouts: &[LineLayout]) -> String {
    let lines = layouts
        .iter()
        .map(|layout| {
            let kind = match layout.kind {
                LineKind::Original => 'o',
                LineKind::Translation => 't',
            };
            let visible = layout
                .lines
                .iter()
                .map(|line| {
                    line.chunks
                        .iter()
                        .map(|chunk| {
                            chunk
                                .word
                                .map_or_else(|| "-".to_owned(), |word| word.to_string())
                        })
                        .collect::<Vec<_>>()
                        .join(",")
                })
                .collect::<Vec<_>>()
                .join("/");
            format!("{kind}:{}:{visible}", layout.item.id)
        })
        .collect::<Vec<_>>()
        .join("|");
    format!("{definition_key}:{lines}")
}

fn subtitle_scene_word_visuals(
    layouts: &[LineLayout],
    animation: &WordAnimation,
) -> Vec<WordVisual> {
    let mut visuals = Vec::new();
    for layout in layouts {
        for line in layout.lines.iter() {
            for chunk in &line.chunks {
                let visual = if layout.kind == LineKind::Original
                    && !animation.name.eq_ignore_ascii_case("none")
                {
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
                visuals.push(visual);
            }
        }
    }
    visuals
}

fn subtitle_glyph_geometry_key_with_visuals(
    definition_key: &str,
    layouts: &[LineLayout],
    visuals: &[WordVisual],
) -> String {
    let key = subtitle_glyph_geometry_key(definition_key, layouts);
    let mut swaps = Vec::new();
    for (index, text) in visuals.iter().enumerate().filter_map(|(index, visual)| {
        visual
            .recipe
            .as_ref()
            .and_then(|state| state.text_swap.as_deref())
            .map(|text| (index, text))
    }) {
        swaps.extend_from_slice(&(index as u64).to_le_bytes());
        swaps.extend_from_slice(&(text.len() as u64).to_le_bytes());
        swaps.extend_from_slice(text.as_bytes());
    }
    if swaps.is_empty() {
        key
    } else {
        format!("{key}:swap:{:016x}", render_raster::drawop::fnv1a64(&swaps))
    }
}

/// The classic per-word states that the glyph uniform plus ordered vector and procedural passes can fully express: colors, opacity, vertical bounce, Highlight and Custom backing plates, and Paint underlines. Designed Caption admits: a single glyph; a repeat-linear gradient plus glyph; procedural highlight and pill backing plates; echo and RGB glyph duplicate plus glyph; a trailing metadata-only glyphDuplicate with editorial colorMix; retained emoji plus glyph; textSwap, which switches local glyph geometry on the project fps grid; scanline and deterministic particles with a fixed quad; and a single-texture repeat fill with content identity. Apart from that canonical texture it must have no assets, and every operator and channel must have an exact scene expression. Other multi-layer glyphs continue to fall back explicitly. Capabilities must not be guessed from the style id.
pub fn glyph_uniform_animation_supported(animation: &WordAnimation) -> bool {
    let Some(design) = animation.caption.as_ref() else {
        return [&animation.spoken, &animation.active, &animation.unspoken]
            .into_iter()
            .all(|visual| visual.recipe.is_none());
    };
    let Some(descriptor) = caption_recipe_design_descriptor(design) else {
        return false;
    };
    let layers_supported = matches!(descriptor.layers.as_slice(), [glyphs] if glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [gradient, glyphs]
            if gradient == "gradientFill" && glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [texture, glyphs]
            if texture == "textureFill" && glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [plate, glyphs]
            if matches!(plate.as_str(), "highlightPlate" | "pill") && glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [duplicate, glyphs]
            if duplicate == "glyphDuplicate" && glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [glyphs, duplicate]
            if glyphs == "glyphs" && duplicate == "glyphDuplicate")
        || matches!(descriptor.layers.as_slice(), [glyphs, emoji]
            if glyphs == "glyphs" && emoji == "emoji")
        || matches!(descriptor.layers.as_slice(), [duplicate, scanlines, glyphs]
            if duplicate == "glyphDuplicate"
                && scanlines == "scanlines"
                && glyphs == "glyphs")
        || matches!(descriptor.layers.as_slice(), [particles, glyphs]
            if particles == "particles" && glyphs == "glyphs");
    let uses_texture = descriptor.layers.iter().any(|layer| layer == "textureFill");
    let assets_supported = if uses_texture {
        !descriptor.assets.is_empty() && caption_recipe_glyph_texture_available(animation)
    } else {
        descriptor.assets.is_empty()
    };
    layers_supported
        && assets_supported
        && descriptor.events.iter().all(|event| {
            matches!(
                event.op.as_str(),
                "transform"
                    | "glyphMask"
                    | "clip"
                    | "plate"
                    | "duplicate"
                    | "decoration"
                    | "textSwap"
                    | "glow"
                    | "weight"
            ) && event.channels.iter().all(|channel| {
                matches!(
                    channel.as_str(),
                    "opacity"
                        | "dx"
                        | "dy"
                        | "scaleX"
                        | "scaleY"
                        | "rotation"
                        | "colorMix"
                        | "clipL"
                        | "clipR"
                        | "clipT"
                        | "clipB"
                        | "fillProgress"
                        | "plateX"
                        | "plateW"
                        | "plateH"
                        | "plateR"
                        | "echo"
                        | "rgbSplit"
                        | "burst"
                        | "emojiPop"
                        | "scramble"
                        | "glowGain"
                        | "weightAxis"
                )
            })
        })
}

fn glyph_uniform_paint(
    animation: &WordAnimation,
    visual: &WordVisual,
    opacity: f64,
) -> element_draw::GlyphPaint {
    if caption_recipe_uses_texture_fill(animation) {
        return element_draw::GlyphPaint::RepeatTexture;
    }
    let Some(gradient) = caption_recipe_repeat_linear_gradient(animation, visual) else {
        return element_draw::GlyphPaint::Solid;
    };
    element_draw::GlyphPaint::RepeatLinearGradient {
        start: [gradient.start[0] as f32, gradient.start[1] as f32],
        end: [gradient.end[0] as f32, gradient.end[1] as f32],
        first: glyph_uniform_color(gradient.first, opacity),
        middle: glyph_uniform_color(gradient.middle, opacity),
    }
}

fn glyph_uniform_color(color: SubtitleColor, opacity: f64) -> [f32; 4] {
    [
        f32::from(color.r) / 255.0,
        f32::from(color.g) / 255.0,
        f32::from(color.b) / 255.0,
        (((255 - color.a) as f64 / 255.0) * opacity).clamp(0.0, 1.0) as f32,
    ]
}

fn transform_array(transform: Transform) -> [f32; 6] {
    [
        transform.sx,
        transform.ky,
        transform.kx,
        transform.sy,
        transform.tx,
        transform.ty,
    ]
}

/// The row and column bounding box of non-zero alpha (half-open interval; implemented in `render_raster::effects`).
pub fn alpha_bbox(rgba: &[u8], width: usize, height: usize) -> Option<ContentBox> {
    render_raster::effects::alpha_bbox(rgba, width, height)
}

/// The windowed version of [`alpha_bbox`]. `window` must be a superset of the non-zero pixels, in which case the result is field-for-field identical to a full-frame scan. The subtitle path's window comes from [`DrawBounds`], which follows the drawing.
pub fn alpha_bbox_within(
    rgba: &[u8],
    width: usize,
    height: usize,
    window: &ContentBox,
) -> Option<ContentBox> {
    render_raster::effects::alpha_bbox_within(rgba, width, height, window)
}

/// The result of one solve of the subtitle stack placement. See [`OverlayRenderPlan::stack_layout`].
pub struct StackLayout {
    /// The global anchor (canvas pixels). Transition scaling and whole-group rotation both pivot around it.
    pub anchor: (f64, f64),
    /// Per-line position override (same order as `layouts`).
    pub overrides: Vec<Option<(f64, f64)>>,
    /// Which line's style the shared plate takes (an index into `layouts`).
    pub plate_line: Option<usize>,
    pub shared_background: bool,
    /// Each line's `(glyph center x, glyph top y)` (same order as `layouts`).
    pub placements: Vec<(f64, f64)>,
    /// The vertical span of the lines still in the stack.
    pub span: Option<(f64, f64)>,
}

/// One line of the geometry sidecar. See [`OverlayRenderPlan::subtitle_layout`].
#[derive(Debug, Clone, PartialEq)]
pub struct SubtitleLayoutLine {
    pub kind: &'static str,
    pub cue_id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub detached: bool,
}

/// One frame of the geometry sidecar. See [`OverlayRenderPlan::subtitle_layout`].
#[derive(Debug, Clone, PartialEq)]
pub struct SubtitleLayoutFrame {
    pub key: String,
    pub width: u32,
    pub height: u32,
    pub rotation: f64,
    pub anchor: (f64, f64),
    pub lines: Vec<SubtitleLayoutLine>,
    /// The line geometry when Daoyazi takes over the original-text track (§3.2 stage picking, §3.3 edit mode). `None` = there is no sequence layer.
    pub sequence: Option<SequenceLayout>,
}

/// One line of the sequence layer in this frame: the four canvas-pixel corners, plus the segment-local coordinates used when writing to disk.
#[derive(Debug, Clone, PartialEq)]
pub struct SequenceLayoutRow {
    /// The line key is the id of the line's first word.
    pub key: String,
    pub cue_id: String,
    /// The start time of the first word (tapping the line moves the playhead here).
    pub onset: f64,
    pub pinned: bool,
    pub rot_deg: f64,
    /// Segment-local world coordinates, in 540 short-side units (the convention of `captionSequences.pins[key].center`).
    pub local_center: [f64; 2],
    /// Canvas pixels, clockwise: top-left, top-right, bottom-right, bottom-left.
    pub quad: [[f64; 2]; 4],
    /// Whether this frame drew it (a line that is still fading counts as drawn; in edit mode all are true).
    pub visible: bool,
}

/// The geometry and statistics of the sequence layer for this frame.
#[derive(Debug, Clone, PartialEq)]
pub struct SequenceLayout {
    /// The current segment index and segment key (both `None` when the playhead is before any segment).
    pub seq_index: Option<usize>,
    pub seq_key: Option<String>,
    pub seq_count: usize,
    /// The total number of lines on the track.
    pub row_total: usize,
    pub pinned_total: usize,
    pub editing: bool,
    /// How many world pixels one canvas pixel equals. (In edit mode the camera angle is zero, so displacement only needs to be divided by the scale.)
    pub world_per_px: f64,
    /// How many world pixels one 540-short-side unit equals.
    pub unit_px: f64,
    pub diagnostics: Vec<String>,
    /// The lines of the current segment (in edit mode all appear; in playback mode only the ones drawn appear).
    pub rows: Vec<SequenceLayoutRow>,
}

/// Edit mode (§3.3 “adjust layout”): the camera switches to an overview, and every line of the whole segment is shown solid. `drag` is the line being dragged and its **segment-local center** at this moment (540 short-side units, the same convention as `captionSequences.pins[].center`). The value written on release is the same one, so after pinning the overlay coincides with the plan, and removing the overlay does not flicker.
#[derive(Debug, Clone, PartialEq)]
pub struct CaptionSequenceEdit {
    pub seq: usize,
    pub drag: Option<(String, [f64; 2])>,
}

/// A subtitle line's visible window and content key on the output timeline. See [`OverlayRenderPlan::subtitle_spans`].
#[derive(Debug, Clone, PartialEq)]
pub struct SubtitleSpan {
    pub start: f64,
    pub end: f64,
    pub key: String,
}

/// The runtime state of Daoyazi on `OverlayRenderPlan`. The font basis and speaker projection are fixed at compile time. The plan, the region clip mask, and the last few frames are built on the first sample.
#[derive(Debug)]
pub struct SequenceState {
    pub font_name: String,
    pub font_weight: u16,
    pub font_px: f64,
    /// cue id → speaker (read from the cue's `sp`), used for segment breaks when the speaker changes.
    pub speakers: HashMap<String, String>,
    pub plan: Option<Arc<CaptionSequencePlan>>,
    pub clip: Option<PixmapMask>,
    pub cache: VecDeque<CachedFrame>,
    /// The edit-mode override (`None` = normal playback framing).
    pub edit: Option<CaptionSequenceEdit>,
}

/// The number of CPU frame-cache entries for the sequence layer. A seek back and forth of one or two frames is enough, so do not accumulate the animation of the whole sequence.
const SEQUENCE_FRAME_CACHE: usize = 4;

/// The number of pixels that one 540-short-side reference unit occupies on this canvas (the coordinate convention of `captionSequences`).
/// Sequence-layer stroke: its width (em, single side) and color. The GPU stroke mask and the CPU `stroke_path` take the same value.
const SEQ_OUTLINE_EM: f64 = 0.045;
const SEQ_OUTLINE_COLOR: SubtitleColor = SubtitleColor {
    r: 18,
    g: 18,
    b: 20,
    a: 0,
};
/// The GPU glyph raster font-size cap (px). Above this, the sampling scales up slightly instead, so that it fits in the atlas.
const SEQ_RASTER_FONT_CAP: f64 = 144.0;

pub fn caption_sequence_unit_px(width: u32, height: u32) -> f64 {
    (f64::from(width.min(height)) / REFERENCE_SHORT_EDGE).max(1e-6)
}

impl OverlayRenderPlan {
    /// Whether this plan has Daoyazi taking over the original-text track.
    pub fn caption_sequence_active(&self) -> bool {
        self.sequence.is_some()
    }

    /// Lazily builds the sequence plan: the cue word table, the speakers, and the protagonist word overrides → `compile_caption_sequence`. Width measurement uses `TextEngine::shape`, the same convention as the actual drawing.
    pub fn ensure_caption_sequence(&mut self) -> Option<Arc<CaptionSequencePlan>> {
        let state = self.sequence.as_ref()?;
        if let Some(plan) = &state.plan {
            return Some(Arc::clone(plan));
        }
        let caption = self.track_look.animation.caption.as_ref()?;
        let descriptor = self.track_look.descriptor?;
        let roles = caption
            .overrides
            .iter()
            .filter_map(|(id, word)| match word.role.as_str() {
                "hero" => Some((id.clone(), SeqRole::Hero)),
                "emphasis" => Some((id.clone(), SeqRole::Emphasis)),
                _ => None,
            })
            .collect();
        let intent = &caption.sequences;
        let unit_px = caption_sequence_unit_px(self.width, self.height);
        let cues = self
            .cues
            .iter()
            .filter(|item| !item.words.is_empty())
            .map(|item| CaptionSequenceCue {
                id: item.id.clone(),
                start: item
                    .words
                    .first()
                    .map_or(item.display_start, |word| word.start),
                end: item.words.last().map_or(item.display_end, |word| word.end),
                speaker: state.speakers.get(&item.id).cloned(),
                break_before: item
                    .words
                    .first()
                    .is_some_and(|word| intent.break_before.iter().any(|id| *id == word.id)),
                words: item.words.clone(),
            })
            .collect();
        let pins = intent
            .pins
            .iter()
            .map(|(key, pin)| {
                (
                    key.clone(),
                    SeqPin {
                        center: [pin.center[0] * unit_px, pin.center[1] * unit_px],
                        rot_deg: pin.rot_deg,
                    },
                )
            })
            .collect();
        let input = CaptionSequenceInput {
            cues,
            roles,
            duration: self.duration,
            pins,
            seq_seeds: intent.seeds.clone(),
        };
        let env = CaptionSequenceEnv {
            width: self.width,
            height: self.height,
            font_px: state.font_px,
            bilingual: self.mode == StudioMode::Bilingual && !self.translations.is_empty(),
            seed: caption.seed.unwrap_or(CAPTION_SEQUENCE_DEFAULT_SEED),
            intensity: caption.intensity * 100.0,
            speed: caption.speed,
            tokens: descriptor.sequence_layout_tokens(self.width, self.height),
            options: CaptionSequenceOptions::from_value(caption_sequence_option_value(caption)),
        };
        let (font_name, font_weight) = (state.font_name.clone(), state.font_weight);
        let text = &mut self.text;
        let mut measure =
            |sample: &str, px: f64| text.shape(sample, &font_name, px, font_weight).width;
        let plan = Arc::new(compile_caption_sequence(&input, &env, &mut measure));
        let state = self.sequence.as_mut()?;
        state.plan = Some(Arc::clone(&plan));
        Some(plan)
    }

    /// Enters or exits edit mode (§3.3). Frame keys in edit mode differ from playback frames, so the cache separates them naturally.
    pub fn set_caption_sequence_edit(&mut self, edit: Option<CaptionSequenceEdit>) {
        let Some(state) = self.sequence.as_mut() else {
            return;
        };
        if state.edit != edit {
            state.edit = edit;
            self.composited = None;
        }
    }

    pub fn caption_sequence_edit(&self) -> Option<&CaptionSequenceEdit> {
        self.sequence.as_ref().and_then(|state| state.edit.as_ref())
    }

    /// This frame's sequence sampling, key, and next change. In playback mode it samples by time. In edit mode it gives the overview frame, whose key carries the segment number and the drag offset.
    fn caption_sequence_frame(
        &self,
        plan: &CaptionSequencePlan,
        time: f64,
    ) -> (SeqFrame, String, Option<f64>) {
        match self.caption_sequence_edit() {
            Some(edit) => {
                let frame = plan.overview_frame(edit.seq);
                let key = match &edit.drag {
                    Some((key, center)) => {
                        format!(
                            "dz:edit:{}:{key}:{:.2}:{:.2}",
                            edit.seq, center[0], center[1]
                        )
                    }
                    None => format!("dz:edit:{}", edit.seq),
                };
                (frame, key, None)
            }
            None => {
                let frame = plan.sample(time);
                let (key, next) = self.caption_sequence_key(plan, &frame, time);
                (frame, key, next)
            }
        }
    }

    /// Drag preview: the line being dragged is moved to the segment-local center given by the overlay (540 units), and the rest follow the plan. Returns world coordinates.
    fn caption_sequence_drag_center(
        plan: &CaptionSequencePlan,
        edit: Option<&CaptionSequenceEdit>,
        unit_px: f64,
        block: &SeqBlock,
    ) -> Option<[f64; 2]> {
        let edit = edit?;
        let (key, local) = edit.drag.as_ref()?;
        if *key != block.key {
            return None;
        }
        let seq = plan.sequences.get(edit.seq)?;
        Some([
            seq.origin[0] + local[0] * unit_px,
            seq.origin[1] + local[1] * unit_px,
        ])
    }

    /// The sequence layer within the geometry sidecar (§3.2 / §3.3).
    fn caption_sequence_layout(
        &self,
        plan: &CaptionSequencePlan,
        frame: &SeqFrame,
    ) -> SequenceLayout {
        let edit = self.caption_sequence_edit();
        let unit_px = caption_sequence_unit_px(self.width, self.height);
        let mut layout = SequenceLayout {
            seq_index: frame.seq,
            seq_key: frame.seq.map(|i| plan.sequences[i].key.clone()),
            seq_count: plan.sequences.len(),
            row_total: plan.sequences.iter().map(|s| s.blocks.len()).sum(),
            pinned_total: plan
                .sequences
                .iter()
                .flat_map(|s| s.blocks.iter())
                .filter(|b| b.pinned)
                .count(),
            editing: edit.is_some(),
            world_per_px: 1.0,
            unit_px,
            diagnostics: plan.diagnostics.clone(),
            rows: Vec::new(),
        };
        let (Some(si), Some(camera)) = (frame.seq, frame.camera) else {
            return layout;
        };
        layout.world_per_px = 1.0 / camera.zoom.max(1e-9);
        let seq = &plan.sequences[si];
        let drag = edit
            .and_then(|e| e.drag.as_ref())
            .and_then(|(key, _)| seq.blocks.iter().find(|b| b.key == *key))
            .and_then(|block| {
                Self::caption_sequence_drag_center(plan, edit, unit_px, block)
                    .map(|center| (block.key.as_str(), center))
            });
        let quads = plan.row_quads(si, &camera, drag);
        for (idx, (block, quad)) in seq.blocks.iter().zip(quads).enumerate() {
            let visible = frame.blocks.iter().any(|b| b.idx == idx && b.opacity > 0.0);
            if !visible && edit.is_none() {
                continue;
            }
            layout.rows.push(SequenceLayoutRow {
                key: block.key.clone(),
                cue_id: block.cue_id.clone(),
                onset: block.first_t,
                pinned: block.pinned,
                rot_deg: block.rot_deg,
                local_center: [
                    block.local_center[0] / unit_px,
                    block.local_center[1] / unit_px,
                ],
                quad,
                visible,
            });
        }
        layout
    }

    /// The cache key and the next state change of the sequence layer. While the camera is flying or words are entering, the key is built from the frame number, and the next half-frame boundary is put into `next_change`. When still, the discrete state (segment, block, word visibility, speaking) is hashed into the key, so the cache hits across frames.
    fn caption_sequence_key(
        &self,
        plan: &CaptionSequencePlan,
        frame: &SeqFrame,
        time: f64,
    ) -> (String, Option<f64>) {
        let epsilon = 1.0 / (self.fps * 100.0);
        let mut next = plan.next_event_after(time);
        let key = if frame.animating {
            let bucket = (time * self.fps).round();
            let mut boundary = (bucket + 0.5) / self.fps;
            if boundary <= time + epsilon {
                boundary = (bucket + 1.5) / self.fps;
            }
            next = Some(next.map_or(boundary, |current| current.min(boundary)));
            format!("dz@{}", bucket as i64)
        } else {
            let mut state = String::new();
            match frame.seq {
                Some(index) => state.push_str(&index.to_string()),
                None => state.push('-'),
            }
            if let Some((index, alpha)) = frame.fading {
                state.push_str(&format!("|f{index}:{alpha:.3}"));
            }
            for block in &frame.blocks {
                state.push_str(&format!(
                    "|b{}:{}:{:.3}",
                    block.idx, block.rank, block.opacity
                ));
                for word in &block.words {
                    state.push(match (word.opacity > 0.0, word.speaking) {
                        (false, _) => '.',
                        (true, true) => 's',
                        (true, false) => 'v',
                    });
                }
            }
            format!("dz:{:016x}", render_raster::drawop::fnv1a64(state.as_bytes()))
        };
        (
            key,
            next.filter(|boundary| *boundary <= self.duration + epsilon),
        )
    }

    /// The blocks to draw this frame: the previous segment fading out (historical convention, multiplied by the fade alpha) comes first, then the current segment's blocks in descending rank (history blocks are drawn first, and the current block last, on top). Returns `(segment, block, per-word state, alpha)`. When on a transparent background (overlaid on video), a dark outline is added to the sequence layer, because the video imagery is busy and pure-fill text is hard to read. In stage mode, where a background color is laid down, no outline is added.
    pub(crate) fn caption_sequence_outlined(plan: &CaptionSequencePlan) -> bool {
        !(plan.presentation == SeqPresentationMode::Stage
            && plan.background.is_some_and(|color| color.a != 255))
    }

    /// The GPU glyph raster scale. The mask in the atlas is rasterized at **the on-screen font size**, rather than rasterizing at the world font size and letting the camera magnify it (which would blur on zoom). The scale takes the transform's actual scaling, quantized upward to one 2^(1/4) step, so that mid-zoom the mask is not swapped every frame. The raster font size is capped at [`SEQ_RASTER_FONT_CAP`], so that one frame's glyphs fit in a 2048² atlas.
    fn caption_sequence_raster_scale(transform: Transform, font: f64) -> f64 {
        let scale = f64::from(transform.sx.hypot(transform.ky)).max(1e-6);
        let step = (scale.log2() * 4.0).ceil() / 4.0;
        let quantized = 2f64.powf(step).clamp(0.25, 16.0);
        quantized
            .min(SEQ_RASTER_FONT_CAP / font.max(1e-6))
            .max(0.25)
    }

    /// Whether this line falls inside the subtitle region. The four corners of the line box, after the transform, are intersected with the viewport, leaving a margin of one line height on all sides for the entrance scale and the outline. Historical lines outside the region produce no glyphs: the GPU saves atlas space and the CPU saves filling.
    fn caption_sequence_block_visible(
        block: &SeqBlock,
        transform: Transform,
        viewport: [f64; 4],
    ) -> bool {
        let margin = block.h as f32;
        let width = block.w.max(block.text_w) as f32;
        let mut corners = [
            tiny_skia::Point::from_xy(-margin, -margin),
            tiny_skia::Point::from_xy(width + margin, -margin),
            tiny_skia::Point::from_xy(width + margin, block.h as f32 + margin),
            tiny_skia::Point::from_xy(-margin, block.h as f32 + margin),
        ];
        transform.map_points(&mut corners);
        let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for point in corners {
            x0 = x0.min(point.x);
            y0 = y0.min(point.y);
            x1 = x1.max(point.x);
            y1 = y1.max(point.y);
        }
        let [vx, vy, vw, vh] = viewport.map(|value| value as f32);
        x1 >= vx && x0 <= vx + vw && y1 >= vy && y0 <= vy + vh
    }

    pub(crate) fn caption_sequence_draw_list(
        plan: &CaptionSequencePlan,
        frame: &SeqFrame,
    ) -> Vec<(usize, usize, Vec<SeqFrameWord>, f64)> {
        let mut list = Vec::new();
        if let Some((previous, alpha)) = frame.fading {
            let sequence = &plan.sequences[previous];
            let count = sequence.blocks.len();
            for (index, block) in sequence.blocks.iter().enumerate() {
                let rank = count - 1 - index;
                if rank > plan.history_blocks {
                    continue;
                }
                let block_alpha = if rank == 0 { 1.0 } else { plan.history_opacity };
                let words = block
                    .words
                    .iter()
                    .map(|word| SeqFrameWord {
                        opacity: 1.0,
                        scale: 1.0,
                        pivot_x: word.x,
                        speaking: false,
                    })
                    .collect();
                list.push((previous, index, words, alpha * block_alpha));
            }
        }
        if let Some(current) = frame.seq {
            let mut blocks: Vec<&SeqFrameBlock> = frame.blocks.iter().collect();
            blocks.sort_by(|a, b| b.rank.cmp(&a.rank));
            for block in blocks {
                list.push((current, block.idx, block.words.clone(), block.opacity));
            }
        }
        list
    }

    /// The word color. The line's base color tier (which changes color sentence by sentence) is the base. Emphasized, protagonist, and currently spoken words take an emphasis color **different from the line's base color**, which ensures they still stand out on colored lines.
    pub(crate) fn caption_sequence_word_color(
        palette: [SubtitleColor; 3],
        tone: u8,
        word: &SeqWord,
        state: &SeqFrameWord,
    ) -> SubtitleColor {
        let tone = usize::from(tone.min(2));
        let other = |slot: usize| if slot == tone { 3 - slot } else { slot };
        if state.speaking {
            return palette[other(1)];
        }
        match word.role {
            SeqRole::Hero => palette[other(2)],
            SeqRole::Emphasis => palette[other(1)],
            SeqRole::Normal => palette[tone],
        }
    }

    fn caption_sequence_palette(&self) -> [SubtitleColor; 3] {
        self.track_look
            .animation
            .caption
            .as_ref()
            .map_or([SubtitleColor::WHITE; 3], |caption| {
                [caption.primary, caption.accent, caption.secondary]
            })
    }

    /// GPU path: the sequence layer is compressed into one `GlyphRun` (one uniform per word, all clipped to the subtitle region). In stage mode, a background is laid under it first. Returns `(node, key, next change)`. Returns `None` if there is no sequence.
    fn caption_sequence_scene(
        &mut self,
        time: f64,
    ) -> std::result::Result<
        Option<(Vec<element_draw::SceneNode>, String, Option<f64>)>,
        SubtitleSceneFallback,
    > {
        let Some(plan) = self.ensure_caption_sequence() else {
            return Ok(None);
        };
        let (frame, key, next_change) = self.caption_sequence_frame(&plan, time);
        let Some(camera) = frame.camera else {
            return Ok(Some((Vec::new(), key, next_change)));
        };
        let camera_transform = plan.camera_transform(&camera);
        let edit = self.caption_sequence_edit().cloned();
        let unit_px = caption_sequence_unit_px(self.width, self.height);
        let palette = self.caption_sequence_palette();
        let (font_name, font_weight) = match self.sequence.as_ref() {
            Some(state) => (state.font_name.clone(), state.font_weight),
            None => return Ok(None),
        };
        let [vx, vy, vw, vh] = plan.viewport;
        let clip = Some([vx as f32, vy as f32, (vx + vw) as f32, (vy + vh) as f32]);
        let mut nodes = Vec::new();
        if plan.presentation == SeqPresentationMode::Stage {
            if let Some(background) = plan.background.filter(|color| color.a != 255) {
                let [r, g, b, a] = glyph_uniform_color(background, 1.0);
                nodes.push(element_draw::SceneNode::RoundedRect(Arc::new(
                    element_draw::RoundedRectNode {
                        rect: [vx as f32, vy as f32, vw as f32, vh as f32],
                        radius: 0.0,
                        color: [r, g, b, a],
                        pose: element_draw::ScenePose::IDENTITY,
                        motion: None,
                    },
                )));
            }
        }
        let mut glyphs = Vec::new();
        let mut uniforms = Vec::new();
        let outlined = Self::caption_sequence_outlined(&plan);
        let mut outline_glyphs = Vec::new();
        let mut outline_uniforms = Vec::new();
        for (sequence_index, block_index, states, alpha) in
            Self::caption_sequence_draw_list(&plan, &frame)
        {
            let block = &plan.sequences[sequence_index].blocks[block_index];
            let block_transform =
                match Self::caption_sequence_drag_center(&plan, edit.as_ref(), unit_px, block) {
                    Some(center) => block.transform_at(center),
                    None => block.transform(),
                }
                .post_concat(camera_transform);
            if !Self::caption_sequence_block_visible(block, block_transform, plan.viewport) {
                continue;
            }
            for (word, state) in block.words.iter().zip(&states) {
                let opacity = alpha * state.opacity;
                if opacity <= 0.001 {
                    continue;
                }
                if uniforms.len() >= element_draw::GLYPH_RUN_UNIFORM_LIMIT {
                    return Err(SubtitleSceneFallback::SceneLimit);
                }
                let uniform_index =
                    u32::try_from(uniforms.len()).map_err(|_| SubtitleSceneFallback::SceneLimit)?;
                let color = Self::caption_sequence_word_color(palette, block.tone, word, state);
                uniforms.push(element_draw::GlyphRunUniform {
                    transform: transform_array(Transform::identity()),
                    color: glyph_uniform_color(color, opacity),
                    color_opacity: opacity as f32,
                    clip,
                    paint: element_draw::GlyphPaint::Solid,
                });
                if outlined {
                    outline_uniforms.push(element_draw::GlyphRunUniform {
                        transform: transform_array(Transform::identity()),
                        color: glyph_uniform_color(SEQ_OUTLINE_COLOR, opacity * opacity),
                        color_opacity: (opacity * opacity) as f32,
                        clip,
                        paint: element_draw::GlyphPaint::Solid,
                    });
                }
                // Rasterize at the on-screen font size. Shaping and the mask are both taken at `font × raster`, then scaled back by 1 / raster for in-block coordinates. However much the camera magnifies the line, the atlas holds glyphs of that size.
                let raster = Self::caption_sequence_raster_scale(block_transform, word.font);
                let shaped =
                    self.text
                        .shape(&word.text, &font_name, word.font * raster, font_weight);
                let baseline =
                    (word.h * raster - (shaped.ascent + shaped.descent)) / 2.0 + shaped.ascent;
                let word_transform = word
                    .pop_transform(state.scale, state.pivot_x)
                    .post_concat(block_transform);
                let inverse = (1.0 / raster) as f32;
                let outline_width =
                    ((SEQ_OUTLINE_EM * word.font * raster * 2.0).round() / 2.0).max(1.0) as f32;
                for glyph in &shaped.glyphs {
                    let transform =
                        Transform::from_translate(glyph.x as f32, (baseline + glyph.y) as f32)
                            .post_scale(inverse, inverse)
                            .post_translate(word.x as f32, word.y as f32)
                            .post_concat(word_transform);
                    if outlined
                        && let Some(mask) = glyph_scene_mask(
                            self.text
                                .glyph_stroke_atlas_render(glyph.cache_key, outline_width),
                        )?
                    {
                        outline_glyphs.push(element_draw::GlyphInstance {
                            mask,
                            transform: transform_array(transform),
                            uniform_index,
                        });
                    }
                    let Some(mask) =
                        glyph_scene_mask(self.text.glyph_atlas_render(glyph.cache_key))?
                    else {
                        continue;
                    };
                    glyphs.push(element_draw::GlyphInstance {
                        mask,
                        transform: transform_array(transform),
                        uniform_index,
                    });
                }
            }
        }
        if !outline_glyphs.is_empty() {
            nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                element_draw::GlyphRun {
                    glyphs: outline_glyphs.into(),
                    uniforms: outline_uniforms,
                    texture: None,
                    composite: element_draw::GlyphCompositeMode::Normal,
                    pose: element_draw::ScenePose::IDENTITY,
                    motion: None,
                },
            )));
        }
        if !glyphs.is_empty() {
            nodes.push(element_draw::SceneNode::Glyphs(Arc::new(
                element_draw::GlyphRun {
                    glyphs: glyphs.into(),
                    uniforms,
                    texture: None,
                    composite: element_draw::GlyphCompositeMode::Normal,
                    pose: element_draw::ScenePose::IDENTITY,
                    motion: None,
                },
            )));
        }
        Ok(Some((nodes, key, next_change)))
    }

    /// CPU path: draws the sequence layer into `pixmap` (clipped to the subtitle region), and returns the bounding box of the marks laid down.
    fn draw_caption_sequence(
        &mut self,
        pixmap: &mut Pixmap,
        plan: &CaptionSequencePlan,
        frame: &SeqFrame,
    ) -> Result<DrawBounds> {
        let mut drawn = DrawBounds::default();
        let Some(camera) = frame.camera else {
            return Ok(drawn);
        };
        let camera_transform = plan.camera_transform(&camera);
        let palette = self.caption_sequence_palette();
        let [vx, vy, vw, vh] = plan.viewport;
        let viewport = tiny_skia::Rect::from_xywh(vx as f32, vy as f32, vw as f32, vh as f32)
            .ok_or_else(|| anyhow!("倒鸭子字幕区域退化：{:?}", plan.viewport))?;
        let Some(state) = self.sequence.as_mut() else {
            return Ok(drawn);
        };
        let edit = state.edit.clone();
        let unit_px = caption_sequence_unit_px(pixmap.width(), pixmap.height());
        let (font_name, font_weight) = (state.font_name.clone(), state.font_weight);
        let clip = match state.clip.take() {
            Some(mask) => mask,
            None => {
                let mut mask = PixmapMask::new(pixmap.width(), pixmap.height())
                    .ok_or_else(|| anyhow!("无法创建倒鸭子区域 mask"))?;
                mask.fill_path(
                    &PathBuilder::from_rect(viewport),
                    FillRule::Winding,
                    true,
                    Transform::identity(),
                );
                mask
            }
        };
        if plan.presentation == SeqPresentationMode::Stage {
            if let Some(background) = plan.background.filter(|color| color.a != 255) {
                pixmap.fill_rect(
                    viewport,
                    &paint(background, 1.0),
                    Transform::identity(),
                    None,
                );
                drawn.union(vx, vy, vx + vw, vy + vh);
            }
        }
        let text = &mut self.text;
        let outlined = Self::caption_sequence_outlined(plan);
        let draw_list = Self::caption_sequence_draw_list(plan, frame);
        // Two passes: first lay down the outlines for the whole layer, then fill the glyphs. Otherwise the outline of a later glyph would sit on top of the fill of an earlier glyph.
        for outline_pass in [true, false] {
            if outline_pass && !outlined {
                continue;
            }
            for (sequence_index, block_index, states, alpha) in &draw_list {
                let (sequence_index, block_index, alpha) = (*sequence_index, *block_index, *alpha);
                let block = &plan.sequences[sequence_index].blocks[block_index];
                let block_transform =
                    match Self::caption_sequence_drag_center(plan, edit.as_ref(), unit_px, block) {
                        Some(center) => block.transform_at(center),
                        None => block.transform(),
                    }
                    .post_concat(camera_transform);
                if !Self::caption_sequence_block_visible(block, block_transform, plan.viewport) {
                    continue;
                }
                for (word, state) in block.words.iter().zip(states) {
                    let opacity = alpha * state.opacity;
                    if opacity <= 0.001 {
                        continue;
                    }
                    let color = Self::caption_sequence_word_color(palette, block.tone, word, state);
                    let fill = if outline_pass {
                        paint(SEQ_OUTLINE_COLOR, opacity * opacity)
                    } else {
                        paint(color, opacity)
                    };
                    let stroke = tiny_skia::Stroke {
                        width: (SEQ_OUTLINE_EM * word.font * 2.0) as f32,
                        line_join: tiny_skia::LineJoin::Round,
                        ..tiny_skia::Stroke::default()
                    };
                    let shaped = text.shape(&word.text, &font_name, word.font, font_weight);
                    let baseline =
                        word.y + (word.h - (shaped.ascent + shaped.descent)) / 2.0 + shaped.ascent;
                    let word_transform = word
                        .pop_transform(state.scale, state.pivot_x)
                        .post_concat(block_transform);
                    for glyph in &shaped.glyphs {
                        let local = Transform::from_translate(
                            (word.x + glyph.x) as f32,
                            (baseline + glyph.y) as f32,
                        )
                        .post_concat(word_transform);
                        match text.glyph_render(glyph.cache_key) {
                            GlyphRender::Outline(path) if outline_pass => {
                                pixmap.stroke_path(&path, &fill, &stroke, local, Some(&clip));
                                drawn.add_stroked(&path, local, stroke.width);
                            }
                            GlyphRender::Outline(path) => {
                                pixmap.fill_path(
                                    &path,
                                    &fill,
                                    FillRule::Winding,
                                    local,
                                    Some(&clip),
                                );
                                drawn.add_filled(&path, local);
                            }
                            GlyphRender::ColorBitmap { .. } if outline_pass => {}
                            GlyphRender::ColorBitmap {
                                width,
                                height,
                                rgba,
                                left,
                                top,
                            } => {
                                let Some(bitmap) = PixmapRef::from_bytes(&rgba, width, height)
                                else {
                                    continue;
                                };
                                let placement = Transform::from_translate(left as f32, -top as f32)
                                    .post_concat(local);
                                pixmap.draw_pixmap(
                                    0,
                                    0,
                                    bitmap,
                                    &PixmapPaint {
                                        opacity: opacity as f32,
                                        quality: FilterQuality::Bilinear,
                                        blend_mode: tiny_skia::BlendMode::SourceOver,
                                    },
                                    placement,
                                    Some(&clip),
                                );
                                drawn.add_pixmap(width, height, placement);
                            }
                            GlyphRender::Empty => {}
                        }
                    }
                }
            }
        }
        // Marks outside the region are clipped by the mask, and the bounding box is also restricted to the region.
        if let Some([left, top, right, bottom]) = drawn.rect {
            drawn.rect = Some([
                left.max(vx),
                top.max(vy),
                right.min(vx + vw),
                bottom.min(vy + vh),
            ]);
        }
        // Return the mask to the runtime state; do not rebuild the whole image every frame.
        if let Some(state) = self.sequence.as_mut() {
            state.clip = Some(clip);
        }
        Ok(drawn)
    }
}

/// Checks pixel by pixel whether alpha is 255 everywhere. Under premultiplied alpha this means opaque, and with source-over it completely covers what is below.
fn is_opaque(pixmap: &Pixmap) -> bool {
    pixmap.data().chunks_exact(4).all(|pixel| pixel[3] == 255)
}

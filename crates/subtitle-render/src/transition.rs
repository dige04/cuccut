#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TransitionPose {
    pub opacity: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub blur: f64,
    pub active: bool,
}

impl TransitionPose {
    const IDENTITY: Self = Self {
        opacity: 1.0,
        scale_x: 1.0,
        scale_y: 1.0,
        blur: 0.0,
        active: false,
    };
}

/// Caption entry pose (`transition.caption.*@1`).
///
/// Since stage 5 this file only consumes: the Bézier control points, the solver, phase quantization and the derived channels all live in `core/presets/builtin/transition/caption.*.json`, and `motion::preset_registry::caption_transition` looks them up by the persisted legacy ids (`magic-fade` / `magic-pop` / `magic-flip`). There is no second set of numbers outside the recipe.
pub fn transition_pose(
    style: &Value,
    display_start: f64,
    time: f64,
    canvas_scale: f64,
    fps: f64,
) -> TransitionPose {
    let transition = style.get("transition").unwrap_or(&Value::Null);
    let id = transition
        .get("transitionId")
        .or_else(|| transition.get("id"))
        .and_then(Value::as_str)
        .or_else(|| style.get("transitionId").and_then(Value::as_str))
        .unwrap_or("none");
    let Some(recipe) = render_raster::caption_transition(id) else {
        return TransitionPose::IDENTITY;
    };
    let duration = transition_duration(style);
    if duration <= 0.0 {
        return TransitionPose::IDENTITY;
    }
    let phase = recipe.phase(time, display_start, duration, fps);
    if phase >= 1.0 {
        return TransitionPose::IDENTITY;
    }
    let eased = recipe.eased(phase);
    let mut pose = TransitionPose {
        active: true,
        ..TransitionPose::IDENTITY
    };
    for channel in &recipe.channels {
        let value = recipe.channel_value(channel, eased, canvas_scale);
        match channel.prop.as_str() {
            "opacity" => pose.opacity = value,
            "scale" => {
                pose.scale_x = value;
                pose.scale_y = value;
            }
            "scaleX" => pose.scale_x = value,
            "scaleY" => pose.scale_y = value,
            "blur" => pose.blur = value,
            // Channel names are a closed set fixed at recipe parse time, so this code is never reached.
            _ => {}
        }
    }
    pose
}

pub fn mode_lines(mode: StudioMode, order: &str) -> Vec<LineKind> {
    match mode {
        StudioMode::Original => vec![LineKind::Original],
        StudioMode::Translated => vec![LineKind::Translation],
        StudioMode::Bilingual if order == "orig" => {
            vec![LineKind::Original, LineKind::Translation]
        }
        StudioMode::Bilingual => vec![LineKind::Translation, LineKind::Original],
    }
}

#[derive(Debug, Clone)]
pub struct CachedFrame {
    pub key: String,
    pub rgba: Arc<Vec<u8>>,
    pub next_change: Option<f64>,
    /// Non-zero alpha bounding box computed at render time; `None` means the whole frame is transparent. Caching it means `ensure_composited` does not have to scan the entire buffer again for reused frames.
    pub bounds: Option<ContentBox>,
    pub composite: CaptionCompositeMode,
}

pub struct OverlayFrame {
    /// Content key of this frame's **subtitle layer** (`RenderedSubtitleFrame::key`). The geometry sidecar [`OverlayRenderPlan::subtitle_layout`] computes an identical value at the same moment, and `X-Ccut-Overlay-Key` is that value hashed with the plan prefix. The two ends share a source through this field, not through a whole-image fingerprint (the sidecar does not rasterize, so it cannot and should not use the DrawOp fingerprint).
    pub subtitle_key: String,
    /// Pixel identity of the whole overlay (subtitle layer + timeline elements). "Did this image change?" can only be asked of it.
    pub draw_op_fingerprint: u64,
    pub png: Vec<u8>,
    pub next_change: Option<f64>,
}

/// Premultiplied RGBA of one overlay frame, and its two identities.
///
/// This and [`OverlayFrame`] are two delivery forms of the same render: the serve HTTP endpoint needs PNG, while the in-process preview in App v2 needs pixels it can upload directly. **The two identities cannot stand in for each other**: `subtitle_key` only covers the subtitle layer's content (the geometry sidecar, which does not rasterize, can compute the same value), while `draw_op_fingerprint` is what answers "did this image change?". If only the former were checked, frames where "the subtitles did not change but only timeline elements are moving" would be swallowed whole, and the picture would freeze.
pub struct OverlayRgbaFrame {
    pub width: u32,
    pub height: u32,
    /// Content key of this frame's subtitle layer, from the same source as `X-Ccut-Overlay-Key`.
    pub subtitle_key: String,
    /// Pixel identity of the whole overlay (subtitle layer + timeline elements).
    pub draw_op_fingerprint: u64,
    /// premultiplied RGBA, length = `width * height * 4`.
    pub rgba: Vec<u8>,
    pub next_change: Option<f64>,
}

pub struct RenderedSubtitleFrame {
    pub key: String,
    pub rgba: Arc<Vec<u8>>,
    pub next_change: Option<f64>,
    /// Non-zero alpha bounding box, `None` = whole frame transparent. The subtitle layer always knows its own bounding box.
    pub bounds: Option<ContentBox>,
    pub composite: CaptionCompositeMode,
}

/// Delivery form of the subtitle layer for the browser: the non-zero-alpha sub-rectangle of [`RenderedSubtitleFrame`], and **already un-premultiplied**.
///
/// Both points are about correctness, not optimization. Canvas2D's `putImageData` only accepts straight alpha, so feeding it premultiplied bytes would draw a dark fringe along every anti-aliased glyph edge. Also, passing the whole canvas across the JS boundary every frame is 8.3 MB at 1080p, while the subtitles only ever occupy a strip along the bottom of the frame.
///
/// When to use it: when the glyph scene reports [`SubtitleSceneFallback`], the host must explicitly fall back to the whole CPU subtitle overlay. This is the fallback route on the browser side. `width == 0` means the whole frame is transparent.
#[derive(Debug, Clone)]
pub struct SubtitleRasterLayer {
    /// Same content key as [`RenderedSubtitleFrame::key`]; the host uses it to decide whether the previous frame's bitmap can be kept instead of redrawn.
    pub key: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    /// straight-alpha RGBA, length = `width * height * 4`.
    pub rgba: Vec<u8>,
    pub next_change: Option<f64>,
    pub composite: CaptionCompositeMode,
}

/// Delivery form of the GPU subtitle scene for R2. `key` is still produced by the existing OverlayRenderPlan content key; the scene only swaps the execution layer and does not invent a separate layout identity.
#[derive(Debug, Clone)]
pub struct SubtitleSceneFrame {
    pub key: String,
    pub scene: element_draw::SceneFrame,
}

/// Styles the current glyph scene does not yet cover must explicitly fall back to the whole CPU overlay. Each time a GPU effect pass is added, delete the matching branch. Never silently drop content under the excuse of being "close enough".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubtitleSceneFallback {
    CompositeMode,
    WordAnimation,
    InvalidMask,
    SceneLimit,
}

impl std::fmt::Display for SubtitleSceneFallback {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let reason = match self {
            Self::CompositeMode => "blend mode 尚未进入 glyph pass",
            Self::WordAnimation => "逐词配方尚未 uniform 化",
            Self::InvalidMask => "swash 无法提供有效的 glyph atlas 图像",
            Self::SceneLimit => "scene 节点或 glyph run uniform 数量超出上限",
        };
        formatter.write_str(reason)
    }
}

impl std::error::Error for SubtitleSceneFallback {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptionCompositeMode {
    Normal,
    Difference,
    Exclusion,
    Screen,
}

/// Non-zero region of the overlay pixels. The full DrawOp path (timeline elements) does not track a bounding box, so it uses `Unknown` and leaves the scan to the caller.
pub enum OverlayContent {
    Unknown,
    Empty,
    Bounds(ContentBox),
}

/// Frame-level compositing cache for the export path: within the `[start, end)` interval the overlay pixels are identical (guaranteed by the `next_change` contract), so frames inside the interval reuse the composited result directly, skipping layout, rasterization and the full-frame copy.
pub struct CompositedOverlay {
    pub start: f64,
    pub end: f64,
    /// The subtitle layer is below and the timeline element layer is above. An empty array means the whole frame is transparent.
    pub frames: Vec<CompositedFrame>,
}

/// One reusable overlay pixel buffer and its non-zero alpha bounding box; blending only walks the bounding box.
pub struct CompositedFrame {
    pub rgba: Arc<Vec<u8>>,
    pub bounds: ContentBox,
    pub composite: CaptionCompositeMode,
}

pub struct ExportOverlayLayer {
    pub rgba: Arc<Vec<u8>>,
    pub content: OverlayContent,
    pub composite: CaptionCompositeMode,
}

/// Row/column bounding box of non-zero content (half-open interval). The definition has moved to `render_raster::effects` (the reference implementations for blur and compositing both slice sub-regions with it); only this module's name is kept here.
use render_raster::effects::ContentBox;

/// Caches shaping results by `(layer, line id)`. The text and style of a subtitle line do not change while it is displayed, and layout is independent of the per-word state, so each line is shaped only once.
pub struct CachedLayout {
    pub lines: Arc<[LayoutLine]>,
    pub width: f64,
}

pub struct RenderedOverlayFrame {
    /// Content key of this frame's subtitle layer; `None` = this frame has no subtitle layer at all (the exported element-only layer).
    pub subtitle_key: Option<String>,
    pub draw_op_fingerprint: u64,
    pub rgba: Vec<u8>,
    pub next_change: Option<f64>,
}

#[derive(Clone)]
pub struct TimelineVisualElement {
    pub id: String,
    pub kind: ElementKind,
    pub start: f64,
    pub end: f64,
    pub place: Place,
    pub vertical_align: Option<VerticalAlign>,
    pub src_id: Option<String>,
    pub src_start: f64,
    pub rate: f64,
    pub audio_fade_in: f64,
    pub audio_fade_out: f64,
    pub mode: VisualMode,
    pub fit: Fit,
    /// Backdrop for the margins in full-screen + contain mode. `None` does not pre-fill a backdrop: the pre-rendered stand-in for a composite instance (video format spec §3.7) has no `bg`, so transparent areas must reveal the layer below.
    pub bg: Option<Background>,
    pub text: Option<String>,
    pub counter: Option<CounterProps>,
    pub style: Value,
    pub tile: Option<Tile>,
    pub mask: Option<Mask>,
    pub fx: Option<Fx>,
    pub animation: Option<Animation>,
    pub transitions: Option<timeline::video_transitions::VideoTransitions>,
    /// Per-property keyframes from 0.12 (design G6). At the start of each frame, the sampled values of visual properties **replace** the static `place` and become the base pose ([`Self::keyframe_place`]). The entry / exit / loop slots still stack on top as before. `volume` keyframes only feed the mix and are not used here.
    pub keyframes: Option<timeline::keyframes::Keyframes>,
    /// The four element prop groups promoted to stable in 0.2 (design §5.2). Mutual exclusion is guaranteed by `element-props-mismatch` in `Element::validate`, so they are carried over here unchanged.
    pub shape: Option<ShapeProps>,
    pub sticker: Option<StickerProps>,
    pub visualizer: Option<VisualizerProps>,
    pub progress: Option<ProgressProps>,
    pub draw: Option<DrawProps>,
    pub placeholder: Option<PlaceholderProps>,
    /// 0.6 confetti parameters (`kind: "confetti"`).
    pub confetti: Option<ConfettiProps>,
    pub whiteboard: Option<WhiteboardProps>,
}

impl TimelineVisualElement {
    /// Substitutes the keyframe sample at `time` (the clock the element lives on) into `place`. With no visual keyframes it leaves `place` alone, so old documents stay bit-for-bit identical. Called once at the start of each frame's evaluation; after that, every place that reads `place` (box, transform, effects, fingerprint) sees this moment's base pose.
    pub fn keyframe_place(&mut self, time: f64) {
        if let Some(place) = timeline::keyframes::place_at(
            Some(&self.place),
            self.keyframes.as_ref(),
            time - self.start,
            (self.end - self.start).max(0.0),
        ) {
            self.place = place;
        }
    }

    /// Has visual keyframes: the base pose changes frame by frame, so scheduling has to advance per frame.
    pub fn has_visual_keyframes(&self) -> bool {
        self.keyframes
            .as_ref()
            .is_some_and(timeline::keyframes::Keyframes::has_visual)
    }

    /// A composite piece made only for the "stage confetti try-on": when a cell in the asset library grid is hovered, there is no matching element in the timeline, so an in-place patch has nowhere to land (round 236).
    ///
    /// **It is safe to conjure one from nothing because confetti is motion computed in closed form**: there is no `src_id`, no font, no bitmap, so drawing it requires nothing in the media store. Stickers, video, text and waveforms do not qualify: they need asset loading or shaping, and copying this constructor for them would only yield an empty shell that can never be drawn.
    ///
    /// It only enters the App's **preview** plan: it is not written to the document, does not enter history, and is not exported. `start` / `end` are the window of this one try-on, and sample times are driven by the existing `element_sample_time` channel.
    pub fn confetti_preview(
        id: impl Into<String>,
        props: ConfettiProps,
        start: f64,
        end: f64,
    ) -> Self {
        Self {
            id: id.into(),
            kind: ElementKind::Confetti,
            start,
            end,
            place: Place::default(),
            vertical_align: None,
            src_id: None,
            src_start: 0.0,
            rate: 1.0,
            audio_fade_in: 0.0,
            audio_fade_out: 0.0,
            mode: VisualMode::Pip,
            fit: Fit::Cover,
            bg: Some(Background::Black),
            text: None,
            counter: None,
            style: Value::Object(serde_json::Map::new()),
            tile: None,
            mask: None,
            fx: None,
            animation: None,
            transitions: None,
            keyframes: None,
            shape: None,
            sticker: None,
            visualizer: None,
            progress: None,
            draw: None,
            placeholder: None,
            confetti: Some(props),
            whiteboard: None,
        }
    }
}

pub struct OverlayFrameMedia {
    #[cfg(feature = "host")]
    pub base: MediaStore,
    #[cfg(not(feature = "host"))]
    pub base: InjectedMediaStore,
    pub dynamic: HashMap<String, Arc<Pixmap>>,
    /// v3: source frames injected by the host by id (`frame-render` puts decoded video frames, images and Lottie frames here). Source lookup checks it before `base`. Unlike `dynamic`, it is not cleared each time the instruction stream is assembled per frame; the host replaces it itself.
    pub injected: HashMap<String, Arc<Pixmap>>,
}

/// The wasm-safe subtitle scene does not read media; this empty store only lets the shared CPU effect code keep the same [`FrameMedia`] boundary. If a media DrawOp is mistakenly sent into the browser plan, it reports an explicit error.
#[cfg(not(feature = "host"))]
pub struct InjectedMediaStore;

#[cfg(not(feature = "host"))]
impl InjectedMediaStore {
    pub fn video_duration(&self, _id: &str) -> Option<f64> {
        None
    }

    pub fn video_last_frame_time(&self, _id: &str) -> Option<f64> {
        None
    }

    pub fn has_video(&self, _id: &str) -> bool {
        false
    }

    pub fn has_animated(&self, _id: &str) -> bool {
        false
    }

    pub fn animated_duration(&self, _id: &str) -> Option<f64> {
        None
    }

    pub fn is_time_varying(&self, _id: &str) -> bool {
        false
    }

    pub fn media_duration(&self, _id: &str) -> Option<f64> {
        None
    }
}

#[cfg(not(feature = "host"))]
impl FrameMedia for InjectedMediaStore {
    fn frame(&mut self, id: &str, _media_ms: i64) -> Result<Arc<Pixmap>> {
        bail!("wasm-safe 字幕计划没有注入媒体资源：{id}")
    }
}

impl OverlayFrameMedia {
    /// Whether this id currently has an asset whose frames can be fetched: a static image, or Lottie (including recolored variants).
    ///
    /// The existence test for a sticker's recolor variant (see `sticker_fill_variant_id`): variants are generated on demand during preload, so this must be asked before fetching a frame. Otherwise `frame()` would error on an id that was never prepared, turning "no recolor" into "cannot be drawn at all".
    pub fn has_image(&self, id: &str) -> bool {
        if self.dynamic.contains_key(id) || self.injected.contains_key(id) {
            return true;
        }
        #[cfg(feature = "host")]
        {
            self.base.has_image(id) || self.base.has_lottie(id)
        }
        #[cfg(not(feature = "host"))]
        {
            let _ = id;
            false
        }
    }

    pub fn empty(fps: f64) -> Self {
        #[cfg(not(feature = "host"))]
        let _ = fps;
        Self {
            #[cfg(feature = "host")]
            base: MediaStore::new(Arc::new(LoadedAssets::default()), fps),
            #[cfg(not(feature = "host"))]
            base: InjectedMediaStore,
            dynamic: HashMap::new(),
            injected: HashMap::new(),
        }
    }

    /// v3: fetch the source frame for a media element. The host-injected one takes priority, followed by the loaded asset.
    pub fn source_frame(&mut self, id: &str, media_ms: i64) -> Result<Arc<Pixmap>> {
        if let Some(pixmap) = self.injected.get(id) {
            return Ok(pixmap.clone());
        }
        FrameMedia::frame(&mut self.base, id, media_ms)
    }
}

impl FrameMedia for OverlayFrameMedia {
    fn frame(&mut self, id: &str, media_ms: i64) -> Result<Arc<Pixmap>> {
        if let Some(pixmap) = self.dynamic.get(id) {
            return Ok(pixmap.clone());
        }
        self.source_frame(id, media_ms)
    }
}

#[cfg(feature = "host")]
pub fn overlay_document_with_live_timeline(project: &Path, document: &Value) -> Result<Value> {
    overlay_document_with_live_timeline_owned(project, document.clone())
}

/// The owned-value version of [`overlay_document_with_live_timeline`]: the projection is applied directly to the body passed in, with no further deep copy. A body that already carries `_overlayTimelineFingerprint` is returned as is (matching the early-return semantics of the borrowing version).
#[cfg(feature = "host")]
pub fn overlay_document_with_live_timeline_owned(
    project: &Path,
    mut document: Value,
) -> Result<Value> {
    if document
        .get("_overlayTimelineFingerprint")
        .is_some_and(Value::is_string)
    {
        return Ok(document);
    }
    let timeline = crate::host::studio_timeline_projection(project)?;
    document["timeline"] = timeline;
    let projection = crate::host::project_timeline_projection(project)?;
    project_overlay_timed_items(&mut document, &projection);
    let truth = fs::read(project.join("timeline.json")).unwrap_or_default();
    document["_overlayTimelineFingerprint"] =
        serde_json::json!(format!("{:016x}", render_raster::drawop::fnv1a64(&truth)));
    Ok(document)
}

pub fn mapped_item_words(item: &mut Value, mapped: &timeline::MappedEvent) {
    let Some(words) = item.get("words").and_then(Value::as_array) else {
        return;
    };
    let had_words = !words.is_empty();
    let source_duration = mapped.source_end - mapped.source_start;
    let timeline_duration = mapped.timeline_end - mapped.timeline_start;
    let scale = if source_duration > 0.0 {
        timeline_duration / source_duration
    } else {
        1.0
    };
    let mut projected = Vec::new();
    for word in words {
        let Some(start) = word
            .get("t0")
            .or_else(|| word.get("start"))
            .and_then(Value::as_f64)
        else {
            continue;
        };
        let Some(end) = word
            .get("t1")
            .or_else(|| word.get("end"))
            .and_then(Value::as_f64)
        else {
            continue;
        };
        let source_start = start.max(mapped.source_start);
        let source_end = end.min(mapped.source_end);
        if source_end <= source_start {
            continue;
        }
        let mut word = word.clone();
        let timeline_start = mapped.timeline_start + (source_start - mapped.source_start) * scale;
        let timeline_end = mapped.timeline_start + (source_end - mapped.source_start) * scale;
        if let Some(object) = word.as_object_mut() {
            if object.contains_key("t0") {
                object.insert("t0".to_owned(), serde_json::json!(timeline_start));
            }
            if object.contains_key("t1") {
                object.insert("t1".to_owned(), serde_json::json!(timeline_end));
            }
            if object.contains_key("start") {
                object.insert("start".to_owned(), serde_json::json!(timeline_start));
            }
            if object.contains_key("end") {
                object.insert("end".to_owned(), serde_json::json!(timeline_end));
            }
        }
        projected.push(word);
    }
    if let Some(object) = item.as_object_mut() {
        if !projected.is_empty() {
            let text = speech_doc::atomize::join_word_texts(
                // The word-level flag “贴前” (place in front) is carried over with the projection (sparse, default false).
                projected.iter().filter_map(|word| {
                    let glue = word.get("glue").and_then(Value::as_bool).unwrap_or(false);
                    Some((word.get("text").and_then(Value::as_str)?, glue))
                }),
            );
            if !text.trim().is_empty() {
                object.insert("text".to_owned(), Value::String(text));
            }
        } else if had_words {
            object.insert("text".to_owned(), Value::String(String::new()));
        }
        object.insert("words".to_owned(), Value::Array(projected));
    }
}

pub fn project_source_items(
    source_docs: &serde_json::Map<String, Value>,
    projection: &timeline::TimelineProjection,
    key: &str,
) -> Vec<Value> {
    let mut output = Vec::new();
    for (source_id, source) in source_docs {
        for item in source
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(start) = item.get("start").and_then(Value::as_f64) else {
                continue;
            };
            let Some(end) = item.get("end").and_then(Value::as_f64) else {
                continue;
            };
            let item_id = item
                .get("id")
                .or_else(|| item.get("sid"))
                .and_then(Value::as_str)
                .unwrap_or(key);
            for mapped in projection.clamp_source_event(
                source_id,
                start,
                end,
                timeline::MIN_EVENT_DURATION,
            ) {
                let mut projected = item.clone();
                if let Some(object) = projected.as_object_mut() {
                    object.insert(
                        "id".to_owned(),
                        Value::String(format!(
                            "{source_id}:{}:{item_id}:{:.9}",
                            mapped.clip_id, mapped.timeline_start
                        )),
                    );
                    object.insert("sourceId".to_owned(), Value::String(source_id.clone()));
                    object.insert("sourceItemId".to_owned(), Value::String(item_id.to_owned()));
                    object.insert("clipId".to_owned(), Value::String(mapped.clip_id.clone()));
                    object.insert(
                        "sourceStart".to_owned(),
                        serde_json::json!(mapped.source_start),
                    );
                    object.insert("sourceEnd".to_owned(), serde_json::json!(mapped.source_end));
                    object.insert("start".to_owned(), serde_json::json!(mapped.timeline_start));
                    object.insert("end".to_owned(), serde_json::json!(mapped.timeline_end));
                }
                mapped_item_words(&mut projected, &mapped);
                output.push(projected);
            }
        }
    }
    output.sort_by(|left, right| {
        numeric_sort(left.get("start"), right.get("start"))
            .then_with(|| numeric_sort(left.get("end"), right.get("end")))
            .then_with(|| {
                left.get("id")
                    .and_then(Value::as_str)
                    .cmp(&right.get("id").and_then(Value::as_str))
            })
    });
    if key == "transCues" {
        output = merge_collapsed_translation_fragments(output);
    }
    output
}

/// A source-time translation cue may cross a removed source interval. The
/// timeline projection returns one fragment per kept span, but those spans are
/// adjacent after cut collapse and still represent one delivery cue. Merge only
/// fragments from the same clip/item; reused clips remain separate occurrences.
pub fn merge_collapsed_translation_fragments(items: Vec<Value>) -> Vec<Value> {
    const EPSILON: f64 = 1e-6;
    let mut output: Vec<Value> = Vec::new();
    for item in items {
        let merge = output.last().is_some_and(|previous| {
            previous["sourceId"] == item["sourceId"]
                && previous["clipId"] == item["clipId"]
                && previous["sourceItemId"] == item["sourceItemId"]
                && previous["text"] == item["text"]
                && previous["end"]
                    .as_f64()
                    .zip(item["start"].as_f64())
                    .is_some_and(|(end, start)| (end - start).abs() <= EPSILON)
        });
        if merge {
            let previous = output.last_mut().expect("checked above");
            previous["end"] = item["end"].clone();
            previous["sourceEnd"] = item["sourceEnd"].clone();
            continue;
        }
        output.push(item);
    }
    output
}

pub fn numeric_sort(left: Option<&Value>, right: Option<&Value>) -> std::cmp::Ordering {
    left.and_then(Value::as_f64)
        .unwrap_or_default()
        .total_cmp(&right.and_then(Value::as_f64).unwrap_or_default())
}

pub fn project_overlay_timed_items(
    document: &mut Value,
    projection: &timeline::TimelineProjection,
) {
    let Some(mut source_docs) = document
        .get("sourceDocs")
        .and_then(Value::as_object)
        .cloned()
    else {
        return;
    };
    let root = source_docs
        .entry("main".to_owned())
        .or_insert_with(|| serde_json::json!({}));
    for key in ["cues", "sentences", "transCues"] {
        if document.get(key).is_some_and(Value::is_array) {
            root[key] = document[key].clone();
        }
    }
    document["cues"] = Value::Array(project_source_items(&source_docs, projection, "cues"));
    document["sentences"] =
        Value::Array(project_source_items(&source_docs, projection, "sentences"));
    document["transCues"] =
        Value::Array(project_source_items(&source_docs, projection, "transCues"));
    document["meta"]["duration"] = serde_json::json!(projection.duration());
}

#[cfg(feature = "host")]
pub fn source_path(
    project: &Path,
    timeline: &TimelineDocument,
    source_id: &str,
) -> Result<PathBuf> {
    if source_id == "main" {
        return project_media(project);
    }
    let raw = timeline
        .sources
        .get(source_id)
        .and_then(|source| source.path.as_deref())
        .with_context(|| format!("source {source_id} 缺少 path"))?;
    let path = crate::paths::resolve(project, raw);
    if !path.is_file() {
        bail!("source 媒体不存在：{}", path.display());
    }
    Ok(path)
}

/// One stage confetti try-on (round 236).
///
/// `window` is only used when the plan has no element with this `id` and a ghost piece must be conjured from nothing. When the try-on targets an existing element, that element carries its own `[start, end)`, and this window does not apply.
#[derive(Clone, Debug, PartialEq)]
pub struct ConfettiPeek {
    pub id: String,
    pub props: ConfettiProps,
    pub window: (f64, f64),
}

/// What to do when a confetti try-on is reverted (round 236).
///
/// The in-place patch is **destructive**: once written into `element.confetti`, the original recipe no longer has a second copy in the plan. So the revert action must be recorded at the moment of applying. Otherwise, when the mouse leaves, the only way to "recover" the original value is to recompile the whole plan via `plan = None`, which is exactly the cost this channel is meant to avoid.
#[derive(Clone, Debug, PartialEq)]
pub enum ConfettiPeekUndo {
    /// The try-on was of an element already in the plan: write the original recipe back.
    Restore(Option<ConfettiProps>),
    /// The try-on was of a ghost piece conjured from nothing (asset library grid): remove the whole piece.
    Remove,
}

pub struct OverlayRenderPlan {
    /// How the dynamic raster asset name is derived, see [`DynamicAssetNames`].
    pub dynamic_asset_names: DynamicAssetNames,
    /// Once a media element has used its injected source frame, that frame is removed from `media.injected` (see [`OverlayRenderPlan::set_consume_injected_sources`]).
    pub consume_injected_sources: bool,
    /// Per-entry compile-time quantities for layered text animation (`textMotion` / `wordBackground`), index-aligned with [`Self::cues`] / [`Self::translations`]. `None` = this entry's final style (the track-level style overridden per entry) carries no new animation. Whether to take the CPU raster path is decided per frame from here, not from a single static flag for the whole track.
    text_motion_cues: Vec<Option<TextMotionItem>>,
    text_motion_translations: Vec<Option<TextMotionItem>>,
    /// Ephemeral editor audition clock. Never serialized into the project.
    pub element_sample_time: Option<(String, f64)>,
    /// Stage confetti try-on. Lives only in the App's preview plan; never saved to disk, never enters export.
    pub confetti_peek: Option<ConfettiPeek>,
    /// Reverts the last try-on action; lives and dies together with [`Self::confetti_peek`].
    pub confetti_peek_undo: Option<ConfettiPeekUndo>,
    /// Analysis memo for whiteboard hand-drawn elements (ADR-WB02): `source id | source size | parameters` → time field. The analysis depends only on the source image pixels and props, and is not persisted to disk; switching the source or changing props naturally changes the key.
    pub whiteboard_cache: HashMap<String, Arc<render_raster::source::WhiteboardAnalysis>>,
    /// Backup of the whiteboard source image downsampled to the element box: `(source id, target width, target height)` → pixels.
    ///
    /// The reveal field is computed per frame, and its cost scales with **how many pixels the source image has**, while that image is ultimately only drawn into the element box. If the source is larger than the box, shrink it once first and then reveal. The shrink itself also happens only once; otherwise it would just move the per-frame cost from the reveal into resampling.
    pub whiteboard_sources: HashMap<(String, u32, u32), Arc<Pixmap>>,
    pub definition_key: String,
    pub style: Value,
    pub mode: StudioMode,
    pub order: String,
    pub cues: Vec<TimedItem>,
    pub translations: Vec<TimedItem>,
    pub original_style: LineStyle,
    pub translation_style: LineStyle,
    /// Per-word animation for the original-text line, **fixed once at compile time**. `style` does not change after compilation, so `word_animation(merged_line_style(style, Original))` is a constant. Previously it was recomputed three or four times per frame, each time deep-copying the root style Map and parsing the CSS colors again.
    /// Held in an `Arc` so that `&mut self` methods can cheaply obtain a handle that does not borrow `self`.
    pub original_animation: Arc<WordAnimation>,
    /// The recipe descriptor for `original_animation.caption` (also a compile-time constant).
    pub caption_descriptor: Option<&'static CaptionRecipeDescriptor>,
    /// Whether the style carries a Designed Caption (the constant form of `designed_caption_active`).
    pub designed_caption: bool,
    /// Whether the classic per-word highlight block has a non-constant time track (the constant form of `word_box_animated`). When there is a track, the subtitle layer must render every frame: the block swells and shrinks within the word's window, so `(cue, current word)` is no longer enough to identify a frame.
    pub word_box_animated: bool,
    /// Composite mode of the Designed Caption (the constant form of `caption_recipe_composite_mode`).
    pub caption_composite: CaptionCompositeMode,
    /// Whether the recipe requires the whole group to be centered (the anchor branch of `stack_layout`).
    pub centered_caption: bool,
    /// The original-text look for the whole track (the packed form of the five fields above), used by every subtitle without a per-entry override.
    /// The `designed_caption` and `word_box_animated` fields are whole-project scope (they count if any entry has them); the same-named fields here describe only this track.
    pub track_look: CaptionLook,
    /// Per-entry styles (`style.cueStyles`), indexed by [`TimedItem::id`], fixed at compile time.
    pub cue_original: HashMap<String, Arc<CueOverride>>,
    pub cue_translation: HashMap<String, Arc<CueOverride>>,
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub fps: f64,
    pub text: TextEngine,
    /// Number of font faces actually handed to [`TextEngine`] (embedded studio fonts plus the user font library).
    ///
    /// Stored rather than having callers recompute `bundled_studio_fonts().len() + ...`: a recomputed number may not match what this plan actually loaded (the user font library changes at any time), and a log like that is worse than no log. The `overlay: plan compiled … fonts=N` hook in App v2 reads exactly this field.
    pub fonts_loaded: usize,
    /// Which kinds of overlay content this export keeps; [`OverlayRenderPlan::load_timeline_elements`] uses it to filter out whole kinds of elements.
    pub includes: OverlayIncludes,
    pub main: Option<Main>,
    pub elements: Vec<TimelineVisualElement>,
    /// Full-track spectrum for each visualizer element, keyed by **element id**.
    ///
    /// Step 3 of the element-scheme ADR-E04 data flow: during preflight the host reads BCS1 and derives a complete `VizTrack` from that element's `minDb` / `maxDb` / `smoothing` / `gain`; at render time it only calls `sample(t)`. This is isomorphic to how `HostInputs` injects `MediaMeta` / `CoreWord`: the host probes, the core consumes, and there is no I/O at render time.
    ///
    /// Keyed by element id rather than by audio source: the same audio track can be referenced by two visualizers with different parameters, and those are two tracks. Elements with the same `(source, parameters)` share one `Arc`.
    pub viz_tracks: HashMap<String, Arc<render_raster::source::VizTrack>>,
    /// Conversion from output time to source media time (the sample time for `audio: "project"`, settled in P3).
    ///
    /// A visualizer reflects **the sound the audience actually hears at the output time**. In an edited project, output second 7 may correspond to source media second 12, while BCS1 is computed over **the whole source media**, so `TimelineProjection::timeline_to_source` must be applied once before sampling.
    ///
    /// `None` = this plan did not go through `compile_project` (the `compile_with` used in unit tests), or the project has no visualizer element. In that case it falls back to "output time is source time".
    pub viz_projection: Option<timeline::TimelineProjection>,
    pub media: OverlayFrameMedia,
    pub cache: VecDeque<CachedFrame>,
    /// All subtitle boundaries (display_start / display_end / word.end) sorted ascending; `next_change_after` uses binary search instead of scanning the whole word table linearly on every frame.
    pub change_points: Vec<f64>,
    pub layout_cache: VecDeque<(String, Arc<CachedLayout>)>,
    /// Stable geometry of non-Designed-Caption glyph scenes. Per-word state and the entry pose are not part of the key; on a hit, only the small run uniform array is rebuilt. The entry count, like the layout cache, is capped at a fixed size, so that Arc masks do not stay resident without bound while iterating over long videos.
    pub glyph_geometry_cache: VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
    /// Stroke atlas quads kept resident separately from the body geometry. Color and per-word opacity are still small uniforms, and line width already enters `definition_key`, so different styles are never matched to the same set of masks. This key only serves the plan's internal cache and the retained scene identity, and must not be written into a DrawOp dynamic asset name.
    pub glyph_outline_geometry_cache: VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
    /// A stable, separate glyph layer shared by the Designed Caption emoji and the user emoji overrides. Changes to the body word state only update opacity; the emoji mask / RGBA bitmap and the baseline placement are not rasterized again.
    pub glyph_decoration_geometry_cache: VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
    /// Glyph runs split apart to keep CPU z-order for the backplate / underline. The segment key includes the base geometry identity, the fill / outline layers, and the set of uniform indices. Per frame only the uniforms are rebuilt; splitting into segments must not cause the compositor to mistake them for a new batch of atlas quads.
    pub glyph_segment_geometry_cache: VecDeque<(String, Arc<[element_draw::GlyphInstance]>)>,
    /// Each visible subtitle line gets its own set of effect fill quads. The effect is blurred independently per line in the CPU reference and then composited, so different radii must not be merged into one intermediate layer first.
    pub glyph_effect_geometry_cache: VecDeque<(String, Arc<[Arc<[element_draw::GlyphInstance]>]>)>,
    /// The effect's stroke source and body source are composited before blurring. They are kept resident separately, so that a stroke quad with the effect offset does not have to be regenerated at every word boundary.
    pub glyph_effect_outline_geometry_cache:
        VecDeque<(String, Arc<[Arc<[element_draw::GlyphInstance]>]>)>,
    pub composited: Option<CompositedOverlay>,
    pub blank_frame: Option<Arc<Vec<u8>>>,
    /// Reusable full-size buffer for the subtitle effect layer. After use it is zeroed within its bounding box and returned, so the buffer is still all zeros the next time it is taken out. This saves the 33 MB allocation per line of effect at 4K.
    pub effect_scratch: Option<Pixmap>,
    /// S14: collapses the subtitle entry transition to the unit pose. The render plan itself is unrelated to export (same layout, same glyphs), so this is a **per-render** switch rather than a compile-time property: toggling the selection state once should not recompile the whole plan. Defaults to `false`: export and older clients always keep the original behavior.
    pub suppress_transition: bool,
    /// CPU executor for FramePlan and its capability-profile fingerprint. Each overlay frame is a **folded plan** (a single Draw pass), and the executor calls `rasterize_with_media` on it directly.
    pub executor: render_raster::CpuExecutor,
    pub capability: u64,
    /// Preflight report for the element effect stack (design §6.5). All overlay effects are produced by `timeline::lower_element_effects`, so this is the availability verdict for that set of references on the current backend; `fallbacks[]` is exposed through serve's task envelope.
    pub preflight: render_raster::PreflightReport,
    pub warnings: Vec<String>,
    /// The template layer applied to the project (`None` = not applied, or this plan did not go through `compile_project` and nothing was injected).
    pub chrome: Option<TemplateLayer>,
    /// Reason the decoration layer **failed to load**. A composition failure should not black out the whole overlay: subtitles and elements are still drawn, the decoration layer is simply absent, and the failure is reported explicitly (the App shows it on the template attribute page, and `serve` surfaces it as `X-Ccut-Template-Error`).
    pub chrome_error: Option<String>,
    /// 倒鸭子 (the cross-sentence sequence recipe): at compile time only decide whether it is on and the font basis; the plan itself is built lazily on the first frame. `None` = this plan does not take the sequence path, and all subtitles are still laid out per cue.
    pub sequence: Option<SequenceState>,
}

#[derive(Clone)]
pub struct GlyphChunk {
    /// Original shaped span; animation groups clusters without reshaping letters.
    pub text: String,
    pub word: Option<usize>,
    pub part: Option<usize>,
    pub width: f64,
    pub font_name: String,
    pub font_size: f64,
    pub font_weight: u16,
    pub italic: bool,
    pub shaped: render_raster::fonts::ShapedLine,
    /// This segment's own fill color (the `emphasisLook` emphasized word). The per-word animation color still takes priority; `None` falls back to the line style's `color`.
    pub color: Option<SubtitleColor>,
    /// Scale relative to the line font size (`emphasisLook.scale`). The baseline is positioned by the unscaled glyph metrics, so an enlarged word grows taller around the baseline instead of sinking as a whole. At 1.0 it is bit-for-bit identical to the old basis.
    pub metric_scale: f64,
}

#[derive(Clone, Default)]
pub struct LayoutLine {
    pub chunks: Vec<GlyphChunk>,
    pub width: f64,
    pub height: f64,
    pub gap_after: f64,
}

/// Horizontal alignment of subtitles and text elements, consumed by the shared CPU / GPU layout. Subtitles read `align` from the root style and from line-level overrides; text elements also accept `style.textAlign`.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum LineTextAlign {
    Left,
    #[default]
    Center,
    Right,
}

impl LineTextAlign {
    pub fn from_style(style: &Value) -> Self {
        match style
            .get("textAlign")
            .or_else(|| style.get("align"))
            .and_then(Value::as_str)
        {
            Some("left") => Self::Left,
            Some("right") => Self::Right,
            _ => Self::Center,
        }
    }
}

/// Root-style key for subtitles: when `true`, each line is aligned within the wrap width (`width`) rather than within the subtitle block's own width. The block is no longer always centered on the anchor: left alignment hugs the left edge of the wrap area and right alignment the right edge, the same as text elements. Studio styles do not write it (lines align within the block width, consistent with v2). When a positioned-box style is converted to a Studio style, this key is written so that left and right alignment can reach the box edges.
pub const ALIGN_WITHIN_WRAP_KEY: &str = "alignWithinWrap";

/// Whether this (merged) line style aligns within the wrap width; see [`ALIGN_WITHIN_WRAP_KEY`].
pub fn aligns_within_wrap(style: &Value) -> bool {
    style.get(ALIGN_WITHIN_WRAP_KEY).and_then(Value::as_bool) == Some(true)
}

#[derive(Clone)]
pub struct LineLayout {
    pub kind: LineKind,
    pub style: LineStyle,
    pub item: TimedItem,
    pub lines: Arc<[LayoutLine]>,
    pub width: f64,
    pub height: f64,
    /// Each visual line is placed within this width according to [`LineTextAlign`]. For subtitles it equals `width` (or the wrap width when the root style carries [`ALIGN_WITHIN_WRAP_KEY`]); for text elements it equals the actual pixel width converted from `place.w`.
    pub align_width: f64,
    pub text_align: LineTextAlign,
    pub current_word: usize,
    pub render_time: f64,
    pub render_fps: f64,
    pub animation_parts: Vec<timeline::AnimationPartPose>,
    pub animation_short_edge: f64,
    /// The next line previewed in KTV two-line layout (`textMotion.karaoke.nextLine`): only its base color is drawn. It does not sample animation, does not sweep words, and is not part of the cache key.
    pub preview: bool,
    /// For the translated line's KTV word sweep, the real source-word `(start, end)` borrowed from the original text (project seconds). For an original-text line this is `None`, and it reads its own `item.words`.
    pub karaoke_words: Option<Arc<[(f64, f64)]>>,
    /// Lead-in dots are drawn below the line rather than above it: with bilingual stacking there is another line above, and the dots must not cover its text.
    pub guide_below: bool,
}

/// Whether this line can actually draw a background plate. This mirrors Mac `StyleFX.bgOn(style) && !isTransparent(bgColor)`.
///
/// The `VKColor.isTransparent` threshold is alpha ≤ 0.01, which becomes ≤ 2 when mapped to u8. This test decides which line's padding the shared plate uses, so the criterion must match Mac exactly.
pub fn has_real_background(line: &LineLayout) -> bool {
    line.style.background_on && line.style.background_color.a > 2
}

/// Which line's spec the shared plate follows. This mirrors Mac `sharedBackgroundSpec`: `!source line has real background && translation line has real background ? translation line : source line`.
///
/// Choosing the translation line has **two** preconditions: the translation line itself must be able to draw a plate. When neither line has a real background, the source line is still used. This is not a degenerate case that can be chosen freely: the shared plate's pad takes part in glyph placement (`StackPlate::Shared`'s `plate_pad_v`), so even when the plate is not drawn it still sets the slot size. When the two lines have different backgroundPadding, choosing the wrong line creates a real geometric divergence.
pub fn shared_plate_line<T: Copy>(
    source: Option<T>,
    trans: Option<T>,
    has_background: impl Fn(T) -> bool,
) -> Option<T> {
    match (source, trans) {
        (Some(source), Some(trans)) if !has_background(source) && has_background(trans) => {
            Some(trans)
        }
        (Some(source), _) => Some(source),
        (None, trans) => trans,
    }
}

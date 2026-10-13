//! Editor preview WASM entry (architecture design §2 “pure semantic modules compile to WASM”, §9.7, §13.1).
//!
//! The UI sends in the video snapshot; for each frame, a frame plan from render-graph is taken at the playhead, then handed to frame-render to paint one RGBA frame.
//! The plan and the pixels come from the same implementation as native export; the UI only supplies the media element's picture at this moment (video and bitmaps), the bytes of Lottie and SVG image assets, and fonts (SVG is rasterized here at the output's long edge, and sticker recoloring is also done here, the same as export).
//!
//! Wasm-bindgen is not used: there are only a few functions, data goes in and out through linear memory, and the build only needs the rustup `wasm32-unknown-unknown` target, with no dependence on a CLI that must match the crate version exactly. Conventions:
//!
//! - `bc_alloc(len)` / `bc_free(ptr, len)`: buffers the host writes input into;
//! - `bc_set_video(ptr, len)`: `{"video": VideoSnapshot, "sequenceId"?: Id}`;
//! - `bc_plan(seconds)`: the current video's plan at this moment;
//! - `bc_font_files()`: font file names to inject (JSON array; the order is the injection order, and the first one is the fallback font);
//! - `bc_add_font(ptr, len)`: inject font bytes one at a time in the order above; the buffer (from `bc_alloc`) is handed to the kernel, and the host no longer calls `bc_free` on it (so the large local font collection is not copied again);
//! - `bc_set_documents(ptr, len)`: frozen bodies of subtitles and subtitle style documents (`FrozenDocument` array);
//! - `bc_set_speech(ptr, len)`: transcripts in the video (`[{documentId, sourceAssetId?, body}]`). The effective word stream projected onto the sequence gives the trigger ranges for script-triggered ducking; the plan and the export's audio plan use the same one (`render_graph::audio_plan::speech_activity`). Per-speaker ranges (`speaker_activity`) feed the waveform's `speaker`, the same as export. When there is no transcript at all, the waveform is treated as having no speech in the video. Subtitle words are also taken from here (the transcript that the subtitle document's `sourceDocumentId` points to, the same frozen one that export uses), not sent again;
//! - `bc_set_picture(key_ptr, key_len, ptr, len, width, height)`: the instance's picture at this moment (non-premultiplied RGBA; the key is the instance ID); `bc_clear_pictures()` clears the previous frame's;
//! - `bc_set_asset(key_ptr, key_len, ptr, len)`: asset bytes (the key is `assetID@version`; Lottie and SVG images read it);
//! - `bc_set_spectrum(key_ptr, key_len, ptr, len)`: a ready-made whole-track spectrum for a waveform instance (BCS1, the key is the instance ID; used for thumbnails); `bc_clear_spectra()` clears all;
//! - `bc_set_audio_spectrum(key_ptr, key_len, ptr, len)`: asset spectrum (BCS1, the key is `assetID@version`); the waveform stitches it together according to the sequence's audio plan; `bc_clear_audio_spectra()` clears all;
//! - `bc_spectrum_begin()` / `bc_spectrum_push(ptr, len)` / `bc_spectrum_finish()`: compute an asset spectrum. Send 48 kHz mono f32 little-endian samples in blocks; at the end the output area holds BCS1 bytes (the same analysis as native export);
//! - `bc_render(seconds, width, height, flags)`: compute the plan at this moment and paint it; the output area is `{plan, warnings, skipped, spectra, fonts, faces}`, and the picture is at `bc_frame_ptr` / `bc_frame_len`. `spectra` are the asset spectra the waveform needs that have not been sent in (`[{itemId, asset}]`); `fonts` are the font family names used in this frame that are not in the font library; `faces` are the faces named during typesetting so far (`[{family, weight, italic}]`, persistent): the host checks the families reported missing, requests the one face from local fonts, sends it via `bc_add_font`, and then paints again. `flags` bit 0: paint the subtitle layer; bit 1: do not fill the background (thumbnail), in which case the picture is non-premultiplied RGBA; otherwise it is opaque RGBA.
//! - `bc_measure_text(ptr, len)`: `{text, style, wrapWidth?, canvas: {width, height}}`; the output area is the box `{width, height}` that a text element needs (sequence pixels, `frame_render::text_measure`). It uses the same typesetting engine and font set as painting, so fonts must be injected first.
//! - Return 0 on success; the output area (`bc_output_ptr` / `bc_output_len`) is the result JSON; otherwise the output area is `{code, message}`.
//!
//! The renderer keeps two instances per output size (playback at reduced resolution and stopped at original size switch back and forth, without rebuilding layout and caches). Invalidation of injected fonts, documents, transcripts and spectra applies to each of them.

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;

use frame_render::{Documents, FrameRenderer, FrozenDocument, LayerMedia, RenderError, RenderOptions, SpeakerActivity};
use render_graph::audio_plan::{speaker_activity, speech_activity};
use render_graph::{PlanDocument, PlanError, VisualLayer, plan_interactive_with_speech};
use serde::Deserialize;
use serde_json::{Value, json};
use tiny_skia::Pixmap;
use video_model::{DocumentRecord, VersionRef};
use waveform::bcs1::SpectrumBackend;
use waveform::dsp::SpectrumStream;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MeasureText {
    text: String,
    #[serde(default)]
    style: Value,
    #[serde(default)]
    wrap_width: Option<f64>,
    canvas: Size,
}

#[derive(Deserialize)]
struct Size {
    width: f64,
    height: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetVideo {
    video: PlanDocument,
    #[serde(default)]
    sequence_id: Option<String>,
}

/// Frames, asset bytes and spectra sent in by the UI.
#[derive(Default)]
struct Media {
    pictures: HashMap<String, Pixmap>,
    assets: HashMap<String, Vec<u8>>,
    spectra: HashMap<String, Vec<u8>>,
    audio_spectra: HashMap<String, Vec<u8>>,
}

impl LayerMedia for Media {
    fn picture(&mut self, layer: &VisualLayer) -> Result<Option<&Pixmap>, RenderError> {
        Ok(self.pictures.get(&layer.item_id))
    }

    fn asset_bytes(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        self.assets.get(&format!("{}@{}", asset.id, asset.revision)).cloned()
    }

    fn spectrum(&mut self, item_id: &str) -> Option<Vec<u8>> {
        self.spectra.get(item_id).cloned()
    }

    fn audio_spectrum(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        self.audio_spectra.get(&format!("{}@{}", asset.id, asset.revision)).cloned()
    }
}

/// One transcript: its document ID, the asset it describes, and the body of its current version.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpeechInput {
    document_id: String,
    #[serde(default)]
    source_asset_id: Option<String>,
    body: Value,
}

impl SpeechInput {
    /// Stored as a frozen document that the renderer reads (subtitle lookup and the word stream share one body).
    fn frozen(self) -> Arc<FrozenDocument> {
        Arc::new(FrozenDocument {
            document_id: self.document_id,
            kind: Some("speech".into()),
            schema: self.body.get("schema").and_then(Value::as_str).map(str::to_string),
            line_kind: None,
            source_document_id: None,
            source_asset_id: self.source_asset_id,
            body: self.body,
        })
    }
}

/// The word stream only reads the record's ID, kind and asset; other fields are left empty.
fn speech_record(document: &FrozenDocument) -> DocumentRecord {
    DocumentRecord {
        id: document.document_id.clone(),
        kind: "speech".into(),
        name: String::new(),
        language: None,
        source_asset_id: document.source_asset_id.clone(),
        source_document_id: None,
        current_revision: String::new(),
        revisions: Default::default(),
        extensions: Default::default(),
    }
}

/// Documents the renderer reads: subtitle and style documents, plus transcripts (when the IDs are the same, the subtitle side wins).
fn renderer_documents(documents: &[Arc<FrozenDocument>], speech: &[Arc<FrozenDocument>]) -> Documents {
    Documents::shared(speech.iter().chain(documents).cloned())
}

#[derive(Default)]
struct State {
    video: Option<(PlanDocument, String)>,
    speech_documents: Vec<Arc<FrozenDocument>>,
    /// The effective word stream's range on the sequence: invalidated when the video or transcript changes; recomputed at the next plan request.
    speech: Option<Vec<(f64, f64)>>,
    /// Per-speaker ranges (outer `None` means not yet computed; inner `None` means there is no transcript at all); invalidated together with `speech`.
    speakers: Option<Option<Arc<SpeakerActivity>>>,
    /// Injected fonts (the built-in batch, plus the local fonts the host sends by family name); the renderer and this code share the bytes.
    fonts: Vec<Arc<Vec<u8>>>,
    documents: Vec<Arc<FrozenDocument>>,
    /// Renderers kept per output size; the most recently painted one is at the end ([`frame`] takes its picture); at most [`RENDERER_SLOTS`] renderers.
    renderers: Vec<FrameRenderer>,
    media: Media,
    output: Vec<u8>,
    /// The asset spectrum currently being computed.
    analysis: Option<SpectrumStream>,
    /// Restores the transparent-background frame to non-premultiplied bytes; an opaque frame uses the renderer's picture directly, so this is empty.
    straight: Vec<u8>,
}

/// Keep several renderers at once: preview playback and stopped each use one size (`render-planner`'s playback quality), so each one's typesetting, subtitle compilation and asset cache survive switching back and forth; changing the size (`FrameRenderer::resize`) invalidates all of them, and rebuilding takes from a fraction of a second to more than one second.
const RENDERER_SLOTS: usize = 2;

/// Move the renderer for `width`×`height` to the end (most recently used). If there is none at this size: create one if not full; if full, change the least recently used one to this size. Returns whether a different renderer was swapped in (the end was not it before).
fn renderer_for(
    renderers: &mut Vec<FrameRenderer>,
    width: u32,
    height: u32,
    create: impl FnOnce() -> Result<FrameRenderer, RenderError>,
) -> Result<bool, RenderError> {
    let size = |renderer: &FrameRenderer| (renderer.frame().width(), renderer.frame().height());
    let index = renderers.iter().position(|renderer| size(renderer) == (width, height));
    if index.is_some_and(|index| index + 1 == renderers.len()) {
        return Ok(false);
    }
    if let Some(index) = index {
        let renderer = renderers.remove(index);
        renderers.push(renderer);
    } else if renderers.len() < RENDERER_SLOTS {
        renderers.push(create()?);
    } else {
        let mut renderer = renderers.remove(0);
        renderer.resize(width, height)?;
        renderers.push(renderer);
    }
    Ok(true)
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

fn failure(code: &str, message: impl Into<String>) -> PlanError {
    PlanError {
        code: code.into(),
        message: message.into(),
    }
}

/// Send in a video; when no sequence is specified, use the root sequence.
pub fn set_video(input: &[u8]) -> Result<(), PlanError> {
    let request: SetVideo = serde_json::from_slice(input).map_err(|error| failure("INVALID_VIDEO", format!("视频快照读不懂：{error}")))?;
    let sequence_id = request.sequence_id.unwrap_or_else(|| request.video.root_sequence_id.clone());
    if !request.video.sequences.contains_key(&sequence_id) {
        return Err(failure("SEQUENCE_NOT_FOUND", format!("没有序列 {sequence_id}")));
    }
    STATE.with_borrow_mut(|state| {
        state.video = Some((request.video, sequence_id));
        state.speech = None;
        state.speakers = None;
        // The renderer invalidates on a new snapshot according to the subtitle signature recorded per clip.
        for renderer in &mut state.renderers {
            renderer.sequence_changed();
        }
    });
    Ok(())
}

/// Replace the set of transcripts (documents with `kind: speech` in the video).
pub fn set_speech(input: &[u8]) -> Result<(), PlanError> {
    let documents: Vec<SpeechInput> =
        serde_json::from_slice(input).map_err(|error| failure("INVALID_DOCUMENTS", format!("转写读不懂：{error}")))?;
    STATE.with_borrow_mut(|state| {
        state.speech_documents = documents.into_iter().map(SpeechInput::frozen).collect();
        state.speech = None;
        state.speakers = None;
        for renderer in &mut state.renderers {
            renderer.set_documents(renderer_documents(&state.documents, &state.speech_documents));
        }
    });
    Ok(())
}

/// The current video's effective word stream (uses the cached one if already computed).
fn speech_of<'a>(
    video: &PlanDocument,
    sequence_id: &str,
    documents: &[Arc<FrozenDocument>],
    cache: &'a mut Option<Vec<(f64, f64)>>,
) -> Result<&'a [(f64, f64)], PlanError> {
    if cache.is_none() {
        let records: Vec<DocumentRecord> = documents.iter().map(|d| speech_record(d)).collect();
        let pairs: Vec<_> = records.iter().zip(documents).map(|(record, d)| (record, &d.body)).collect();
        *cache = Some(if pairs.is_empty() {
            Vec::new()
        } else {
            speech_activity(video.view(), sequence_id, &pairs)?
        });
    }
    Ok(cache.as_deref().unwrap_or_default())
}

/// Each speaker's ranges for the current video (uses the cache if already computed); `None` when there is no transcript at all.
fn speakers_of(
    video: &PlanDocument,
    sequence_id: &str,
    documents: &[Arc<FrozenDocument>],
    cache: &mut Option<Option<Arc<SpeakerActivity>>>,
) -> Result<Option<Arc<SpeakerActivity>>, PlanError> {
    if cache.is_none() {
        let records: Vec<DocumentRecord> = documents.iter().map(|d| speech_record(d)).collect();
        let pairs: Vec<_> = records.iter().zip(documents).map(|(record, d)| (record, &d.body)).collect();
        *cache = Some(if pairs.is_empty() {
            None
        } else {
            Some(Arc::new(speaker_activity(video.view(), sequence_id, &pairs)?))
        });
    }
    Ok(cache.clone().flatten())
}

/// The current video's plan at `seconds` (JSON).
pub fn plan(seconds: f64) -> Result<String, PlanError> {
    STATE.with_borrow_mut(|state| {
        let State {
            video,
            speech_documents,
            speech,
            ..
        } = state;
        let (video, sequence_id) = video.as_ref().ok_or_else(|| failure("NO_VIDEO", "还没有送进视频"))?;
        let speech = speech_of(video, sequence_id, speech_documents, speech)?;
        let plan = plan_interactive_with_speech(video.view(), sequence_id, seconds, Some(speech))?;
        Ok(serde_json::to_string(&plan).expect("计划总能序列化"))
    })
}

/// Font file names to inject (JSON).
pub fn font_files() -> String {
    serde_json::to_string(frame_render::BUNDLED_FONT_FILES).expect("字符串数组总能序列化")
}

/// Inject a font: first inject the built-in batch in the order of [`font_files`]; afterwards the host sends the one face of a local font that matches the missing font families and faces reported by `render` (with the same resolution and extraction as export). An already-built renderer picks it up, and the next frame re-typesets with the new font library.
pub fn add_font(bytes: Vec<u8>) -> Result<(), PlanError> {
    if bytes.is_empty() {
        return Err(failure("INVALID_FONT", "字体是空的"));
    }
    STATE.with_borrow_mut(|state| {
        let bytes = Arc::new(bytes);
        state.fonts.push(bytes.clone());
        for renderer in &mut state.renderers {
            renderer.add_fonts(vec![bytes.clone()]);
        }
    });
    Ok(())
}

/// Replace the set of subtitle and subtitle style documents.
pub fn set_documents(input: &[u8]) -> Result<(), PlanError> {
    let documents: Vec<FrozenDocument> =
        serde_json::from_slice(input).map_err(|error| failure("INVALID_DOCUMENTS", format!("文档读不懂：{error}")))?;
    STATE.with_borrow_mut(|state| {
        state.documents = documents.into_iter().map(Arc::new).collect();
        for renderer in &mut state.renderers {
            renderer.set_documents(renderer_documents(&state.documents, &state.speech_documents));
        }
    });
    Ok(())
}

/// Send the instance's picture at this moment (non-premultiplied RGBA).
pub fn set_picture(key: &str, rgba: Vec<u8>, width: u32, height: u32) -> Result<(), PlanError> {
    if rgba.len() != width as usize * height as usize * 4 {
        return Err(failure("INVALID_PICTURE", format!("画面 {key} 的字节数与 {width}×{height} 不符")));
    }
    let picture = frame_render::premultiplied(width, height, rgba).ok_or_else(|| failure("INVALID_PICTURE", "画面尺寸不可用"))?;
    STATE.with_borrow_mut(|state| state.media.pictures.insert(key.to_string(), picture));
    Ok(())
}

pub fn clear_pictures() {
    STATE.with_borrow_mut(|state| state.media.pictures.clear());
}

/// Send asset bytes (the key is `assetID@version`).
pub fn set_asset(key: &str, bytes: Vec<u8>) {
    STATE.with_borrow_mut(|state| state.media.assets.insert(key.to_string(), bytes));
}

/// Send the whole-track spectrum for a waveform instance (BCS1, the key is the instance ID): an already-assembled spectrum track is invalidated.
pub fn set_spectrum(item_id: &str, bytes: Vec<u8>) {
    STATE.with_borrow_mut(|state| {
        state.media.spectra.insert(item_id.to_string(), bytes);
        for renderer in &mut state.renderers {
            renderer.clear_spectra();
        }
    });
}

/// Clear all spectra.
pub fn clear_spectra() {
    STATE.with_borrow_mut(|state| {
        state.media.spectra.clear();
        for renderer in &mut state.renderers {
            renderer.clear_spectra();
        }
    });
}

/// Send an asset spectrum (BCS1, the key is `assetID@version`): an already-assembled spectrum track is invalidated.
pub fn set_audio_spectrum(key: &str, bytes: Vec<u8>) {
    STATE.with_borrow_mut(|state| {
        state.media.audio_spectra.insert(key.to_string(), bytes);
        for renderer in &mut state.renderers {
            renderer.clear_spectra();
        }
    });
}

/// Clear all asset spectra.
pub fn clear_audio_spectra() {
    STATE.with_borrow_mut(|state| {
        state.media.audio_spectra.clear();
        for renderer in &mut state.renderers {
            renderer.clear_spectra();
        }
    });
}

/// Begin computing an asset spectrum (discarding any unfinished one).
pub fn spectrum_begin() {
    STATE.with_borrow_mut(|state| state.analysis = Some(SpectrumStream::new()));
}

/// Send the next block of 48 kHz mono samples (f32 little-endian).
pub fn spectrum_push(bytes: &[u8]) -> Result<(), PlanError> {
    if !bytes.len().is_multiple_of(4) {
        return Err(failure("INVALID_AUDIO", "样本字节数不是 4 的倍数"));
    }
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();
    STATE.with_borrow_mut(|state| {
        let stream = state.analysis.as_mut().ok_or_else(|| failure("NO_ANALYSIS", "还没有开始算频谱"))?;
        stream
            .push(&samples)
            .map_err(|error| failure("INVALID_AUDIO", format!("{error:#}")))
    })
}

/// Finished: hand out the BCS1 bytes.
pub fn spectrum_finish() -> Result<Vec<u8>, PlanError> {
    let stream = STATE
        .with_borrow_mut(|state| state.analysis.take())
        .ok_or_else(|| failure("NO_ANALYSIS", "还没有开始算频谱"))?;
    // Decoding is done by the browser: the source recorded in the header is pure-Rust decoding (BCS1 distinguishes only these two; the content is the same).
    stream
        .finish(SpectrumBackend::Symphonia)
        .map_err(|error| failure("INVALID_AUDIO", format!("{error:#}")))
}

/// Compute the plan at `seconds` and paint it (`width`×`height`, same aspect ratio as the sequence canvas). Anything that cannot be painted is skipped and reported in `skipped`; the preview still shows the picture as usual. With `transparent`, the background is not filled and the picture is non-premultiplied RGBA (thumbnail). Returns `{plan, warnings, skipped, spectra, fonts, faces, captionHits}`
/// (`spectra` are asset spectra not yet sent in, `fonts` are font families used in this frame that are not in the font library, `faces` are faces named during typesetting);
/// `captionHits` is the sequence-canvas geometry of this frame's subtitle lines and their owning instances; the picture is taken via [`frame`].
pub fn render(seconds: f64, width: u32, height: u32, captions: bool, transparent: bool) -> Result<String, PlanError> {
    STATE.with_borrow_mut(|state| {
        let State {
            video,
            speech_documents,
            speech,
            speakers,
            fonts,
            documents,
            renderers,
            media,
            straight,
            ..
        } = state;
        let (video, sequence_id) = video.as_ref().ok_or_else(|| failure("NO_VIDEO", "还没有送进视频"))?;
        let speech = speech_of(video, sequence_id, speech_documents, speech)?;
        let speakers = speakers_of(video, sequence_id, speech_documents, speakers)?;
        let plan = plan_interactive_with_speech(video.view(), sequence_id, seconds, Some(speech))?;
        let render_failure = |error: RenderError| failure(&error.code, error.message);
        let switched = renderer_for(renderers, width, height, || {
            FrameRenderer::with_shared_fonts(
                RenderOptions {
                    width,
                    height,
                    skip_unsupported: true,
                    captions,
                },
                renderer_documents(documents, speech_documents),
                fonts.clone(),
            )
        })
        .map_err(render_failure)?;
        let active = renderers.len() - 1;
        let (others, active) = renderers.split_at_mut(active);
        let renderer = &mut active[0];
        renderer.set_captions(captions);
        renderer.set_collect_caption_hits(true);
        renderer.set_transparent(transparent);
        renderer.set_speakers(speakers);
        // Switched to a different renderer: the waveform's spectrum track does not depend on size, so it is taken from the renderer used for the previous paint rather than reassembled.
        if switched && let Some(previous) = others.last() {
            renderer.share_spectra_from(previous);
        }
        renderer.clear_reports();
        renderer.render(video.view(), &plan, seconds, media).map_err(render_failure)?;
        *straight = if transparent {
            frame_render::demultiplied(renderer.frame().data())
        } else {
            Vec::new()
        };
        let spectra: Vec<Value> = renderer
            .missing_spectra()
            .iter()
            .map(|(item_id, asset)| json!({ "itemId": item_id, "asset": asset }))
            .collect();
        let output = json!({
            "plan": plan,
            "warnings": renderer.warnings(),
            "skipped": renderer.skipped(),
            "spectra": spectra,
            "captionHits": renderer.caption_hits(),
            "fonts": renderer.missing_fonts(),
            "faces": renderer
                .used_faces()
                .into_iter()
                .map(|(family, weight, italic)| json!({ "family": family, "weight": weight, "italic": italic }))
                .collect::<Vec<_>>(),
        });
        Ok(output.to_string())
    })
}

/// Measure how large a box a piece of text needs as a text element (`{width, height}`, sequence pixels). If no frame has been painted yet, create the renderer first (its size changes with the next frame paint).
pub fn measure_text(input: &[u8]) -> Result<String, PlanError> {
    let input: MeasureText =
        serde_json::from_slice(input).map_err(|error| failure("INVALID_PARAMS", format!("量字的参数读不懂：{error}")))?;
    let canvas = |side: f64| {
        if side.is_finite() {
            side.round().clamp(1.0, 65_535.0) as u32
        } else {
            1
        }
    };
    let style = if input.style.is_null() { json!({}) } else { input.style };
    STATE.with_borrow_mut(|state| {
        let State {
            fonts,
            documents,
            speech_documents,
            renderers,
            ..
        } = state;
        // Measurement does not depend on size: use the most recently painted renderer, without changing the order ([`frame`] is still the one from the last paint).
        if renderers.is_empty() {
            renderers.push(
                FrameRenderer::with_shared_fonts(
                    RenderOptions {
                        width: 1,
                        height: 1,
                        skip_unsupported: true,
                        captions: true,
                    },
                    renderer_documents(documents, speech_documents),
                    fonts.clone(),
                )
                .map_err(|error| failure(&error.code, error.message))?,
            );
        }
        let renderer = renderers.last_mut().expect("至少有一台");
        let measured = renderer.measure_text(
            &input.text,
            &style,
            input.wrap_width,
            (canvas(input.canvas.width), canvas(input.canvas.height)),
        );
        Ok(json!(measured).to_string())
    })
}

/// The frame painted by the last [`render`].
pub fn frame() -> Vec<u8> {
    STATE.with_borrow(|state| frame_bytes(state).to_vec())
}

fn frame_bytes(state: &State) -> &[u8] {
    if !state.straight.is_empty() {
        return &state.straight;
    }
    state.renderers.last().map_or(&[], |r| r.frame().data())
}

fn finish(result: Result<Vec<u8>, PlanError>) -> u32 {
    let (status, bytes) = match result {
        Ok(bytes) => (0, bytes),
        Err(error) => (1, serde_json::to_vec(&error).expect("错误总能序列化")),
    };
    STATE.with_borrow_mut(|state| state.output = bytes);
    status
}

/// # Safety
/// `ptr` points to `len` bytes already written.
unsafe fn bytes<'a>(ptr: *const u8, len: usize) -> &'a [u8] {
    if len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(ptr, len) }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

/// # Safety
/// `ptr` and `len` must come from the same `bc_alloc` call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(unsafe { Vec::from_raw_parts(ptr, 0, len) });
    }
}

/// # Safety
/// `ptr` points to `len` bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_video(ptr: *const u8, len: usize) -> u32 {
    finish(set_video(unsafe { bytes(ptr, len) }).map(|()| Vec::new()))
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_plan(seconds: f64) -> u32 {
    finish(plan(seconds).map(String::into_bytes))
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_font_files() -> u32 {
    finish(Ok(font_files().into_bytes()))
}

/// The buffer itself becomes the font storage (a local font collection can reach tens of MB; copying it would double the linear memory high-water mark, and linear memory does not shrink back).
///
/// # Safety
/// `ptr` and `len` must come from the same `bc_alloc` call and be fully written; after the call the buffer belongs to the kernel, and the host must not call `bc_free`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_add_font(ptr: *mut u8, len: usize) -> u32 {
    let bytes = if ptr.is_null() {
        Vec::new()
    } else {
        unsafe { Vec::from_raw_parts(ptr, len, len) }
    };
    finish(add_font(bytes).map(|()| Vec::new()))
}

/// # Safety
/// `ptr` points to `len` bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_documents(ptr: *const u8, len: usize) -> u32 {
    finish(set_documents(unsafe { bytes(ptr, len) }).map(|()| Vec::new()))
}

/// # Safety
/// `ptr` points to `len` bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_speech(ptr: *const u8, len: usize) -> u32 {
    finish(set_speech(unsafe { bytes(ptr, len) }).map(|()| Vec::new()))
}

/// # Safety
/// Each of the two inputs points to bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_picture(key_ptr: *const u8, key_len: usize, ptr: *const u8, len: usize, width: u32, height: u32) -> u32 {
    let key = String::from_utf8_lossy(unsafe { bytes(key_ptr, key_len) }).into_owned();
    finish(set_picture(&key, unsafe { bytes(ptr, len) }.to_vec(), width, height).map(|()| Vec::new()))
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_clear_pictures() {
    clear_pictures();
}

/// # Safety
/// Each of the two inputs points to bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_asset(key_ptr: *const u8, key_len: usize, ptr: *const u8, len: usize) {
    let key = String::from_utf8_lossy(unsafe { bytes(key_ptr, key_len) }).into_owned();
    set_asset(&key, unsafe { bytes(ptr, len) }.to_vec());
}

/// # Safety
/// Each of the two inputs points to bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_spectrum(key_ptr: *const u8, key_len: usize, ptr: *const u8, len: usize) {
    let key = String::from_utf8_lossy(unsafe { bytes(key_ptr, key_len) }).into_owned();
    set_spectrum(&key, unsafe { bytes(ptr, len) }.to_vec());
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_clear_spectra() {
    clear_spectra();
}

/// # Safety
/// Each of the two inputs points to bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_set_audio_spectrum(key_ptr: *const u8, key_len: usize, ptr: *const u8, len: usize) {
    let key = String::from_utf8_lossy(unsafe { bytes(key_ptr, key_len) }).into_owned();
    set_audio_spectrum(&key, unsafe { bytes(ptr, len) }.to_vec());
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_clear_audio_spectra() {
    clear_audio_spectra();
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_spectrum_begin() {
    spectrum_begin();
}

/// # Safety
/// `ptr` points to `len` bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_spectrum_push(ptr: *const u8, len: usize) -> u32 {
    finish(spectrum_push(unsafe { bytes(ptr, len) }).map(|()| Vec::new()))
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_spectrum_finish() -> u32 {
    finish(spectrum_finish())
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_render(seconds: f64, width: u32, height: u32, flags: u32) -> u32 {
    finish(render(seconds, width, height, flags & 1 != 0, flags & 2 != 0).map(String::into_bytes))
}

/// # Safety
/// `ptr` points to `len` bytes already written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_measure_text(ptr: *const u8, len: usize) -> u32 {
    finish(measure_text(unsafe { bytes(ptr, len) }).map(String::into_bytes))
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_frame_ptr() -> *const u8 {
    STATE.with_borrow(|state| frame_bytes(state).as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_frame_len() -> usize {
    STATE.with_borrow(|state| frame_bytes(state).len())
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_output_ptr() -> *const u8 {
    STATE.with_borrow(|state| state.output.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_output_len() -> usize {
    STATE.with_borrow(|state| state.output.len())
}

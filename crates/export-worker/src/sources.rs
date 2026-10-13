//! Picture for the media layer: one sequential decode stream per video instance. Images are decoded once (SVG and GIF images are decoded by the frame raster itself from the asset bytes, see `asset_bytes`;
//! the SVG branch here only accepts assets whose media type was not recorded as SVG but whose file is `.svg`). The decoded non-premultiplied RGBA
//! is converted to premultiplied and handed to the frame raster. Video frame pixels are taken over from the decoder (not copied); when the decoder still holds the same frame, it is reused as is. When probing says the asset has no transparency, alpha is all 255 and the data is already premultiplied, so no per-pixel premultiplication is done. Lottie stickers read the asset bytes they need from the frozen location. Waveforms compute the asset spectrum from the frozen sound file, once per asset version ([`frame_render::spectrum::analyze_file`]).
//! Decode streams not used for a while are closed (subprocesses do not pile up), and when needed again they are reopened from the keyframe before the target.
//! Video first goes through the platform-native decoder ([`crate::native`]), with each asset falling back to ffmpeg individually. Images still go through ffmpeg.

use std::collections::HashMap;

use frame_render::support::{UnsupportedItem, kind_name};
use frame_render::{LayerMedia, RenderError, premultiplied};
use media_core::Tools;
use media_core::decode::{NativeDecode, VideoDecoder, decode_still};
use media_core::probe::probe_picture;
use render_graph::{LayerKind, VisualLayer};
use tiny_skia::{IntSize, Pixmap};
use video_model::VersionRef;

use crate::delivery::delivery_size;
use crate::input::Input;
use crate::native::{self, Fallback};
use crate::preflight::AssetPicture;

/// Closes a decode stream after this many output frames of idleness.
const IDLE_FRAMES: u64 = 90;

enum Media {
    Video {
        decoder: Box<VideoDecoder>,
        /// Current frame (premultiplied). The pixels are taken from the decoder, not copied.
        pixmap: Option<Pixmap>,
        /// Which frame of the decoder this is (the token from [`VideoDecoder::advance`]).
        generation: u64,
        /// The asset may have transparency: it must be premultiplied per pixel. When it does not, the decoded alpha is all 255, premultiplication changes no value, so it is skipped.
        /// Assets with transparency do not use native decoding (native flattens alpha to 255), so frames decoded natively never need premultiplication.
        alpha: bool,
        asset_id: String,
    },
    Still(Pixmap),
}

pub struct Sources<'a> {
    input: &'a Input,
    tools: Tools,
    pictures: HashMap<(String, String), AssetPicture>,
    skip: bool,
    media: HashMap<String, Media>,
    last_used: HashMap<String, u64>,
    frame: u64,
    skipped: Vec<UnsupportedItem>,
    /// `asset ID@version` → asset spectrum. `None` when it cannot be computed (no frozen location, or no sound); the waveform is then drawn as a placeholder and a notice is reported.
    spectra: HashMap<String, Option<Vec<u8>>>,
    /// Native frame source attached to the video decoder; `None` when native is unavailable as a whole (the reason is in `native_unavailable`).
    native: Option<NativeDecode>,
    native_unavailable: Option<(&'static str, String)>,
    /// Asset without native attached (may have transparency).
    decode_fallbacks: Vec<Fallback>,
    /// Canvas (picture block) size: full-bleed videos use it to set the decoder's delivery size ([`crate::delivery`]).
    canvas: (u32, u32),
}

/// Which decode backends the video decoding used (`done.video.decoder`): `None` when there is no video; the backend name when all are the same; `mixed` when they differ.
pub struct DecodeReport {
    pub decoder: Option<&'static str>,
    pub fallbacks: Vec<Fallback>,
}

impl<'a> Sources<'a> {
    pub fn new(input: &'a Input, tools: Tools, pictures: HashMap<(String, String), AssetPicture>, skip: bool) -> Sources<'a> {
        Sources {
            input,
            tools,
            pictures,
            skip,
            media: HashMap::new(),
            last_used: HashMap::new(),
            frame: 0,
            skipped: Vec::new(),
            spectra: HashMap::new(),
            native: native::decode(),
            native_unavailable: native::decode_unavailable(),
            decode_fallbacks: Vec::new(),
            canvas: (input.output.picture().width, input.output.picture().height),
        }
    }

    /// Video decoding backends and fallback records (one per asset, per reason).
    pub fn decode_report(&self) -> DecodeReport {
        let mut backends: Vec<&'static str> = Vec::new();
        let mut fallbacks = self.decode_fallbacks.clone();
        let mut ids: Vec<&String> = self.media.keys().collect();
        ids.sort();
        for id in ids {
            let Some(Media::Video { decoder, asset_id, .. }) = self.media.get(id) else {
                continue;
            };
            if !backends.contains(&decoder.backend()) {
                backends.push(decoder.backend());
            }
            if let Some(fallback) = decoder.fallback() {
                fallbacks.push(Fallback::decoder(Some(asset_id), fallback.reason, fallback.message.clone()));
            }
        }
        if !backends.is_empty()
            && let Some((reason, message)) = &self.native_unavailable
        {
            fallbacks.insert(0, Fallback::decoder(None, reason, message.clone()));
        }
        let mut seen = std::collections::HashSet::new();
        fallbacks.retain(|f| seen.insert((f.asset_id.clone(), f.reason)));
        let decoder = match backends.as_slice() {
            [] => None,
            [only] => Some(*only),
            _ => Some("mixed"),
        };
        DecodeReport { decoder, fallbacks }
    }

    /// Starting output frame `k`: closes idle decode streams.
    pub fn begin_frame(&mut self, k: u64) {
        self.frame = k;
        let idle: Vec<String> = self
            .last_used
            .iter()
            .filter(|(_, used)| k.saturating_sub(**used) > IDLE_FRAMES)
            .map(|(id, _)| id.clone())
            .collect();
        for id in idle {
            if let Some(Media::Video { decoder, .. }) = self.media.get_mut(&id) {
                decoder.close();
            }
            self.last_used.remove(&id);
        }
    }

    /// Total number of decode stream reopenings (after going backwards, large jumps, and reuse after an idle close). 0 in a sequential export, where none of these occur.
    pub fn restarts(&self) -> u32 {
        self.media
            .values()
            .map(|m| match m {
                Media::Video { decoder, .. } => decoder.restarts(),
                Media::Still(_) => 0,
            })
            .sum()
    }

    /// In skip mode, assets found undecodable only at execution time.
    pub fn skipped(&self) -> &[UnsupportedItem] {
        &self.skipped
    }

    /// Stops all decode processes.
    pub fn close(&mut self) {
        for media in self.media.values_mut() {
            if let Media::Video { decoder, .. } = media {
                decoder.close();
            }
        }
    }

    /// Instances in the root sequence (the frame raster draws the root sequence's instances; see `SequenceContext` in `frame-render`).
    fn root_item(&self, item_id: &str) -> Option<&video_model::TimelineItem> {
        self.input
            .document
            .sequences
            .get(&self.input.sequence_id)?
            .items
            .iter()
            .find(|item| item.base().id == item_id)
    }

    fn picture_info(&mut self, layer: &VisualLayer) -> Result<Option<AssetPicture>, RenderError> {
        let Some(asset) = &layer.asset else {
            return Err(RenderError::new(
                "EXPORT_RENDER_FAILED",
                format!("媒体层 {} 没有素材", layer.item_id),
            ));
        };
        let key = (asset.id.clone(), asset.revision.clone());
        if let Some(info) = self.pictures.get(&key) {
            return Ok(Some(info.clone()));
        }
        // An asset not seen in preflight (should not happen): probe it now. If it cannot be decoded, skip or error according to the options.
        let problem = match self.input.asset(&asset.id, &asset.revision) {
            None => format!("素材 {} 没有冻结的位置", asset.id),
            Some(entry) => match probe_picture(&self.tools, &entry.path) {
                Ok(Some(info)) => {
                    let picture = AssetPicture {
                        path: entry.path.clone(),
                        width: info.width,
                        height: info.height,
                        svg: false,
                        alpha: info.alpha,
                    };
                    self.pictures.insert(key, picture.clone());
                    return Ok(Some(picture));
                }
                Ok(None) => "素材里没有画面".to_string(),
                Err(e) => e.message,
            },
        };
        let item = UnsupportedItem {
            item_id: layer.item_id.clone(),
            scope: "asset",
            layer_kind: kind_name(layer.kind),
            effect_id: None,
            transition_id: None,
            kind: Some(asset.id.clone()),
            reason: "asset-undecodable".into(),
            message: problem,
        };
        if !self.skip {
            return Err(RenderError {
                code: "EXPORT_UNSUPPORTED_CONTENT".into(),
                message: item.message.clone(),
                items: vec![item],
            });
        }
        if !self.skipped.iter().any(|s| s.item_id == item.item_id) {
            self.skipped.push(item);
        }
        Ok(None)
    }
}

fn decode_error(e: media_core::MediaError) -> RenderError {
    RenderError::new(e.code, e.message)
}

/// Converts non-premultiplied RGBA to premultiplied in place.
fn premultiply(data: &mut [u8]) {
    for px in data.chunks_exact_mut(4) {
        let a = px[3] as u32;
        if a < 255 {
            for c in &mut px[..3] {
                *c = ((*c as u32 * a + 127) / 255) as u8;
            }
        }
    }
}

impl LayerMedia for Sources<'_> {
    fn picture(&mut self, layer: &VisualLayer) -> Result<Option<&Pixmap>, RenderError> {
        let id = layer.item_id.clone();
        if !self.media.contains_key(&id) {
            let Some(info) = self.picture_info(layer)? else {
                return Ok(None);
            };
            let media = if layer.kind == LayerKind::Image && info.svg {
                let bytes =
                    std::fs::read(&info.path).map_err(|e| RenderError::new("EXPORT_DECODE_FAILED", format!("SVG 图片读不到：{e}")))?;
                let long_edge = crate::preflight::svg_long_edge(self.input);
                Media::Still(
                    frame_render::decode_svg(&bytes, long_edge)
                        .map_err(|e| RenderError::new("EXPORT_DECODE_FAILED", format!("SVG 图片解不开：{e:#}")))?,
                )
            } else if layer.kind == LayerKind::Image {
                let picture = decode_still(&self.tools, &info.path, info.width, info.height).map_err(decode_error)?;
                Media::Still(
                    premultiplied(picture.width, picture.height, picture.data)
                        .ok_or_else(|| RenderError::new("EXPORT_DECODE_FAILED", "图片的尺寸不对"))?,
                )
            } else {
                let asset = layer.asset.as_ref().expect("上面查过");
                let origin = self.input.pts_origin(&asset.id, &asset.revision);
                // Full-canvas videos larger than the canvas have the decoder deliver the canvas-size directly, so the frame raster no longer resamples the whole frame ([`crate::delivery`]).
                let (width, height) = self
                    .root_item(&id)
                    .and_then(|item| delivery_size(item, (info.width, info.height), self.canvas))
                    .unwrap_or((info.width, info.height));
                let mut decoder = VideoDecoder::new(&self.tools, &info.path, origin, width, height);
                match &self.native {
                    Some(_) if info.alpha => self.decode_fallbacks.push(Fallback::decoder(
                        Some(&asset.id),
                        "alpha-unsupported",
                        "素材可能带透明，原生解码不保留 alpha",
                    )),
                    Some(native) => decoder = decoder.with_native(native.clone()),
                    None => {}
                }
                Media::Video {
                    decoder: Box::new(decoder),
                    pixmap: None,
                    generation: 0,
                    alpha: info.alpha,
                    asset_id: asset.id.clone(),
                }
            };
            self.media.insert(id.clone(), media);
        }
        self.last_used.insert(id.clone(), self.frame);
        match self.media.get_mut(&id).expect("上面放进去了") {
            Media::Still(pixmap) => Ok(Some(pixmap)),
            Media::Video {
                decoder,
                pixmap,
                generation,
                alpha,
                ..
            } => {
                let seconds = layer.source_seconds.unwrap_or(0.0).max(0.0);
                let current = decoder.advance(seconds).map_err(decode_error)?;
                if pixmap.is_none() || *generation != current {
                    // Swap in the new frame: the previous frame's buffer goes back to the decoder, and the new frame's pixels become the picture directly.
                    let spare = pixmap.take().map(Pixmap::take).unwrap_or_default();
                    let mut picture = decoder.swap_current(spare).expect("advance 成功就有当前帧");
                    if *alpha {
                        premultiply(&mut picture.data);
                    }
                    let size = IntSize::from_wh(picture.width, picture.height)
                        .ok_or_else(|| RenderError::new("EXPORT_DECODE_FAILED", "画面的尺寸不对"))?;
                    *pixmap = Some(
                        Pixmap::from_vec(picture.data, size).ok_or_else(|| RenderError::new("EXPORT_DECODE_FAILED", "画面的尺寸不对"))?,
                    );
                    *generation = current;
                }
                Ok(pixmap.as_ref())
            }
        }
    }

    fn asset_bytes(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        let entry = self.input.asset(&asset.id, &asset.revision)?;
        std::fs::read(&entry.path).ok()
    }

    fn audio_spectrum(&mut self, asset: &VersionRef) -> Option<Vec<u8>> {
        let key = frame_render::spectrum::asset_key(asset);
        if let Some(cached) = self.spectra.get(&key) {
            return cached.clone();
        }
        let spectrum = self
            .input
            .asset(&asset.id, &asset.revision)
            .and_then(|entry| frame_render::spectrum::analyze_file(&entry.path, &self.tools.ffmpeg).ok());
        self.spectra.insert(key, spectrum.clone());
        spectrum
    }
}

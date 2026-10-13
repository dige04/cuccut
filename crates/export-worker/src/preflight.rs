//! Preflight (architecture design §9.13): lists item by item what cannot be drawn in the range, whether assets can decode a picture, and whether encoding goes native or ffmpeg. When ffmpeg is used, it checks whether the local ffmpeg has the encoders needed.
//! Asset probing still goes through ffprobe.
//! Runs once at export start (if it fails, no task is created), and again at execution (to get each asset's picture size and to confirm nothing changed after freezing).

use std::collections::HashMap;
use std::sync::Arc;

use frame_render::support::{UnsupportedItem, check_layer, kind_name, transition_problem};
use frame_render::{Documents, FaceUse};
use media_core::Tools;
use media_core::probe::{encoders, probe_picture};
use render_graph::video_plan::plan_video;
use render_graph::{LayerContent, LayerKind, VisualLayer, plan_frame};
use serde::Serialize;
use video_model::VersionRef;

use crate::Failure;
use crate::input::Input;
use crate::native::{self, EncoderPlan};

#[derive(Clone, Debug, Serialize)]
pub struct Warning {
    pub code: &'static str,
    pub detail: String,
}

/// Assets whose picture can be decoded: position and display size. For `svg` images, the frame raster rasterizes them itself at `width`×`height` (not via ffmpeg).
#[derive(Clone, Debug)]
pub struct AssetPicture {
    pub path: std::path::PathBuf,
    pub width: u32,
    pub height: u32,
    pub svg: bool,
    /// A decoded picture may carry transparency ([`media_core::probe::PictureInfo::alpha`]); when it does not, video frames are not premultiplied per pixel.
    pub alpha: bool,
}

/// SVG image rasterization long side: the long side of the picture (the block drawn to the canvas within the output), so that a picture-in-picture enlarged to full screen is not blurry.
pub fn svg_long_edge(input: &Input) -> u32 {
    let picture = input.output.picture();
    picture.width.max(picture.height)
}

pub struct Preflight {
    pub frames: u64,
    pub items: Vec<UnsupportedItem>,
    pub warnings: Vec<Warning>,
    /// Encoders needed that the local ffmpeg lacks (empty when using the native writer).
    pub missing_encoders: Vec<String>,
    /// Encoders missing when switching to ffmpeg (used to report `EXPORT_TOOL_MISSING` when native fails to open and falls back).
    pub ffmpeg_missing: Vec<String>,
    /// Whether encoding goes native or ffmpeg ([`native::choose_encoder`]).
    pub encoder: EncoderPlan,
    pub pictures: HashMap<(String, String), AssetPicture>,
}

/// Probe result for one asset version: a picture can be decoded, or the reason and description why it cannot be drawn.
type Probed = Result<AssetPicture, (&'static str, String)>;

pub fn documents(input: &Input) -> Documents {
    Documents::new(input.documents.to_vec())
}

pub fn run(input: &Input, tools: &Tools) -> Result<Preflight, Failure> {
    let frames = input.frame_count()?;
    let range = input.range()?;
    let view = input.document.view();
    let plan = plan_video(view, &input.sequence_id, Some(range)).map_err(|e| Failure::new(&e.code, e.message))?;
    let documents = documents(input);
    let mut items = Vec::new();
    let warnings: Vec<Warning> = Vec::new();
    let mut pictures: HashMap<(String, String), AssetPicture> = HashMap::new();
    let mut probed: HashMap<(String, String), Probed> = HashMap::new();

    let sequence = input.document.sequences.get(&input.sequence_id);
    let template = sequence.and_then(|s| s.header.template.as_ref());
    for layer in &plan.layers {
        if layer.kind == LayerKind::Caption && !input.burn_captions {
            continue;
        }
        let layer_items = check_layer(layer, &documents, template);
        let dropped = layer_items.iter().any(UnsupportedItem::drops_layer);
        items.extend(layer_items);
        if dropped {
            continue;
        }
        if let Some(item) = check_lottie(input, layer) {
            items.push(item);
            continue;
        }
        if !matches!(layer.kind, LayerKind::Video | LayerKind::Image) {
            continue;
        }
        let Some(asset) = &layer.asset else { continue };
        let key = (asset.id.clone(), asset.revision.clone());
        let result = probed.entry(key.clone()).or_insert_with(|| {
            let Some(entry) = input.asset(&asset.id, &asset.revision) else {
                return Err(("asset-not-frozen", format!("素材 {} 没有冻结的位置", asset.id)));
            };
            let media_type = entry.media_type.as_deref().unwrap_or_default();
            if media_type == "image/svg+xml" || entry.path.extension().is_some_and(|e| e.eq_ignore_ascii_case("svg")) {
                let picture = std::fs::read(&entry.path)
                    .map_err(|e| e.to_string())
                    .and_then(|bytes| frame_render::decode_svg(&bytes, svg_long_edge(input)).map_err(|e| format!("{e:#}")));
                return match picture {
                    Ok(pixmap) => Ok(AssetPicture {
                        path: entry.path.clone(),
                        width: pixmap.width(),
                        height: pixmap.height(),
                        svg: true,
                        alpha: true,
                    }),
                    Err(e) => Err(("asset-undecodable", format!("SVG 图片解不开：{e}"))),
                };
            }
            // GIF is decoded by the frame raster from the asset bytes (animated images take frames by time). Here the same function is used to judge whether it can be decoded.
            if media_type.eq_ignore_ascii_case(frame_render::GIF_MEDIA_TYPE) {
                let gif = std::fs::read(&entry.path)
                    .map_err(|e| e.to_string())
                    .and_then(|bytes| frame_render::load_gif(&asset.id, &bytes).map_err(|e| format!("{e:#}")));
                return match gif {
                    Ok((gif, _)) => {
                        let (width, height) = gif.size();
                        Ok(AssetPicture {
                            path: entry.path.clone(),
                            width,
                            height,
                            svg: false,
                            alpha: true,
                        })
                    }
                    Err(e) => Err(("asset-undecodable", format!("GIF 图片解不开：{e}"))),
                };
            }
            match probe_picture(tools, &entry.path) {
                Ok(Some(info)) => Ok(AssetPicture {
                    path: entry.path.clone(),
                    width: info.width,
                    height: info.height,
                    svg: false,
                    alpha: info.alpha,
                }),
                Ok(None) => Err(("no-video-stream", "素材里没有画面".to_string())),
                Err(e) if e.code == "EXPORT_TOOL_MISSING" => Err(("tool-missing", e.message)),
                Err(e) => Err(("asset-undecodable", e.message)),
            }
        });
        match result {
            Ok(picture) => {
                pictures.insert(key, picture.clone());
            }
            Err((reason, message)) => {
                if *reason == "tool-missing" {
                    return Err(Failure::new("EXPORT_TOOL_MISSING", message.clone()));
                }
                items.push(UnsupportedItem {
                    item_id: layer.item_id.clone(),
                    scope: "asset",
                    layer_kind: kind_name(layer.kind),
                    effect_id: None,
                    transition_id: None,
                    kind: Some(asset.id.clone()),
                    reason: reason.to_string(),
                    message: message.clone(),
                });
            }
        }
    }

    for transition in &plan.transitions {
        let Some(reason) = transition_problem(&transition.kind, transition.unsupported.as_deref()) else {
            continue;
        };
        let item_id = sequence
            .and_then(|s| s.transitions.iter().find(|t| t.id == transition.id))
            .and_then(|t| t.left_item_id.clone().or_else(|| t.right_item_id.clone()))
            .unwrap_or_default();
        items.push(UnsupportedItem {
            item_id,
            scope: "transition",
            layer_kind: "transition",
            effect_id: None,
            transition_id: Some(transition.id.clone()),
            kind: Some(transition.kind.clone()),
            reason,
            message: format!("转场「{}」画不出来，按硬切画", transition.kind),
        });
    }

    let settings = input.encode_settings()?;
    let available = encoders(tools).map_err(|e| Failure::new(e.code, e.message))?;
    let mut ffmpeg_missing = Vec::new();
    let mut wanted = vec![settings.codec.encoder()];
    if settings.audio.is_some() {
        wanted.push(settings.container.audio_encoder());
    }
    for name in wanted {
        if !available.contains(name) {
            ffmpeg_missing.push(name.to_string());
        }
    }
    // When using the native writer, the ffmpeg encoders are not needed, so missing them does not block. They are needed only when native fails at execution and falls back to ffmpeg.
    let encoder = native::choose_encoder(&settings);
    let missing_encoders = match encoder {
        EncoderPlan::Native(_) => Vec::new(),
        EncoderPlan::Ffmpeg(_) => ffmpeg_missing.clone(),
    };
    let mut seen = std::collections::HashSet::new();
    items.retain(|item| seen.insert(item.key()));
    Ok(Preflight {
        frames,
        items,
        warnings,
        missing_encoders,
        ffmpeg_missing,
        encoder,
        pictures,
    })
}

/// Local font faces the output needs (architecture design §9.11 “fonts”): each picture layer in the range is laid out with the fonts shipped with the kernel ([`frame_render::font_census`]), and for each family named that is not among the kernel's fonts, its “family name, weight, italic”. The Runtime uses this to pick faces from the local fonts, records the files and digests, and freezes them into the snapshot. It is computed only in the preflight command; at execution, the frozen faces are installed.
pub fn font_faces(input: &Input) -> Result<Vec<FaceUse>, Failure> {
    let usage = font_usage(input)?;
    Ok(usage
        .faces
        .into_iter()
        .filter(|(family, ..)| usage.missing.contains(family))
        .collect())
}

/// Fonts the video uses (`fonts.usage`, architecture design §9.1): same text-layout pass as [`font_faces`]. All faces named are given (including families shipped with the kernel), and families not shipped with the kernel are given separately. Does not check assets or encoders; it only lays out text.
pub fn font_usage(input: &Input) -> Result<frame_render::FontUsage, Failure> {
    let range = input.range()?;
    let view = input.document.view();
    let overview = plan_video(view, &input.sequence_id, Some(range)).map_err(|e| Failure::new(&e.code, e.message))?;
    let frame = plan_frame(view, &input.sequence_id, range.0).map_err(|e| Failure::new(&e.code, e.message))?;
    let fonts = frame_render::bundled_fonts().into_iter().map(Arc::new).collect();
    frame_render::font_usage(
        view,
        &frame,
        range.0.to_f64(),
        &overview.layers,
        documents(input),
        fonts,
        input.burn_captions,
    )
    .map_err(|e| Failure::new(&e.code, e.message))
}

/// Whether Lottie sticker assets are frozen and can be decoded (same parsing as during composition).
fn check_lottie(input: &Input, layer: &VisualLayer) -> Option<UnsupportedItem> {
    let Some(LayerContent::Generator { generator, parameters, .. }) = &layer.content else {
        return None;
    };
    if layer.kind != LayerKind::Generator || generator != "cuccut.lottie" {
        return None;
    }
    let asset: Option<VersionRef> = parameters.get("asset").cloned().and_then(|v| serde_json::from_value(v).ok());
    let problem = match asset.and_then(|a| input.asset(&a.id, &a.revision).cloned()) {
        None => Some(("lottie-asset-missing", "Lottie 贴纸没有冻结的素材".to_string())),
        Some(entry) => match std::fs::read(&entry.path) {
            Err(e) => Some(("lottie-asset-missing", format!("Lottie 素材读不到：{e}"))),
            Ok(bytes) => frame_render::lottie_problem(&bytes).map(|(reason, why)| (reason, format!("Lottie 素材读不出来：{why}"))),
        },
    }?;
    Some(UnsupportedItem {
        item_id: layer.item_id.clone(),
        scope: "asset",
        layer_kind: kind_name(layer.kind),
        effect_id: None,
        transition_id: None,
        kind: None,
        reason: problem.0.to_string(),
        message: problem.1,
    })
}

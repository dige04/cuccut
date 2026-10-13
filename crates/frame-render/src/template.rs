//! Template layers (format spec §3.17): each open layer of the sequence's template document is a generator layer (`cuccut.template`) in the frame plan. It is drawn by the render kernel's `template_layer::raster` according to the template document's `timeline`. The drawing method is the same function that v2's stage, export and thumbnails use.
//!
//! Chapter-type layers read the sequence's chapter markers (from a marker's frame to the next chapter, or to the end of the sequence), and `{title}` is the sequence's name. Logos are drawn as text logos only. Image logos (from the brand library, or files in the project) have no matching asset in v3, so they are reported and not drawn.

use std::collections::HashMap;

use anyhow::Result;
use render_raster::TextEngine;
use subtitle_render::{TemplateFrameParams, TemplateScene};
use timeline::template::{ChapterSpan, LayerKind as TemplateLayerKind, LogoSrc, TemplateDoc};
use tiny_skia::Pixmap;
use video_model::Sequence;

/// Why a template layer cannot be drawn (`None` means it can be drawn).
pub fn unsupported_reason(doc: &TemplateDoc, layer_id: &str) -> Option<&'static str> {
    let layer = doc.layers.iter().find(|l| l.id == layer_id)?;
    match &layer.kind {
        TemplateLayerKind::Logo {
            src: LogoSrc::BrandLogo { .. } | LogoSrc::File { .. },
            ..
        } => Some("template-logo-image-not-supported"),
        _ => None,
    }
}

/// Sequence chapters: chapter markers sorted by frame. Each chapter lasts until the next one starts (or the marker's own length, or the end of the sequence).
pub fn chapters(sequence: &Sequence, fps: f64, end_seconds: f64) -> Vec<ChapterSpan> {
    let mut marks: Vec<_> = sequence.markers.iter().filter(|m| m.is_chapter()).collect();
    marks.sort_by_key(|m| m.frame);
    marks
        .iter()
        .enumerate()
        .map(|(index, mark)| {
            let start = mark.frame as f64 / fps;
            let end = match (mark.duration_frames, marks.get(index + 1)) {
                (Some(d), _) if d > 0 => (mark.frame + d) as f64 / fps,
                (_, Some(next)) => next.frame as f64 / fps,
                _ => end_seconds,
            };
            ChapterSpan {
                id: mark.id.clone(),
                title: mark.label.clone(),
                start,
                end: end.max(start),
            }
        })
        .collect()
}

/// Scene cache for template layers, keyed by sequence version and layer ID (scenes compute a fingerprint, so they are not rebuilt every frame).
#[derive(Default)]
pub struct TemplateScenes {
    scenes: HashMap<(String, String), TemplateScene>,
}

impl TemplateScenes {
    /// Draws one template layer on a transparent canvas the same size as the output.
    #[allow(clippy::too_many_arguments)]
    pub fn raster(
        &mut self,
        sequence: &Sequence,
        doc: &TemplateDoc,
        layer_id: &str,
        seconds: f64,
        duration: f64,
        fps: f64,
        size: (u32, u32),
        text: &mut TextEngine,
    ) -> Result<Pixmap> {
        let key = (sequence.revision.clone(), layer_id.to_string());
        if !self.scenes.contains_key(&key) {
            self.scenes.retain(|(revision, _), _| *revision == sequence.revision);
            let mut only = doc.clone();
            only.layers.retain(|l| l.id == layer_id);
            let scene = TemplateScene::new(only, chapters(sequence, fps, duration), sequence.header.name.clone(), Vec::new());
            self.scenes.insert(key.clone(), scene);
        }
        let scene = &self.scenes[&key];
        subtitle_render::template_layer::raster(
            scene,
            TemplateFrameParams {
                time: seconds,
                duration,
                width: size.0,
                height: size.1,
                fallback_family: render_raster::fonts::BUNDLED_CJK_FAMILY,
            },
            text,
            false,
        )
    }
}

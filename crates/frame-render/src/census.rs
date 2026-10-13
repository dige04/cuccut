//! Local fonts needed by the final render (frozen per architecture design §9.11): asked once when the export is submitted; the Runtime picks faces from the local fonts based on the result, and records the files and digests. At execution time the Render Worker installs only these faces.
//!
//! The approach is to put every picture layer in the range (the overview from `render_graph::video_plan`, one per instance, as it first appears) into one frame, and lay out text with the fonts shipped with the kernel: videos, images, Lottie and audio waveforms are not drawn (they do not lay out text), and transitions are drawn per their own layers. Families named during text layout that are not among the kernel's fonts are recorded together with their weight and italic flag; these are the faces to look for locally (the same record the preview asks the host for). Captions lay out all sentences at compile time, so sentences that appear only later are also counted.

use std::collections::BTreeSet;
use std::sync::Arc;

use render_graph::{FramePlan, LayerContent, LayerKind, VideoView, VisualLayer};
use tiny_skia::Pixmap;

use crate::documents::Documents;
use crate::renderer::{FrameRenderer, LayerMedia, RenderError, RenderOptions};
use render_raster::fonts::FaceUse;

/// Long edge of the frame used for text layout: font size scales with the frame, and the choice of face does not depend on size, so a smaller frame saves time.
const CENSUS_LONG_EDGE: u32 = 480;

/// No frame is given: video and image layers are not included in the first place.
struct NoMedia;

impl LayerMedia for NoMedia {
    fn picture(&mut self, _layer: &VisualLayer) -> Result<Option<&Pixmap>, RenderError> {
        Ok(None)
    }
}

/// Layers that lay out text: text, shapes, captions and generators (except audio waveforms and Lottie stickers).
fn shapes_text(layer: &VisualLayer) -> bool {
    match layer.kind {
        LayerKind::Text | LayerKind::Shape | LayerKind::Caption => true,
        LayerKind::Generator => !matches!(
            &layer.content,
            Some(LayerContent::Generator { generator, .. }) if generator == "cuccut.audio-visualizer" || generator == "cuccut.lottie"
        ),
        LayerKind::Video | LayerKind::Image | LayerKind::Unsupported => false,
    }
}

/// A font family that is neither built in, nor installed locally, nor downloaded is drawn with this one (the kernel's default sans-serif family, and also the first in the CJK fallback chain): the missing-font notice names it, and `fonts.usage` reports it to the UI under this name.
pub const FALLBACK_FAMILY: &str = render_raster::fonts::BUNDLED_CJK_FAMILY;

/// The result of one text-layout census: all faces named during layout (including families shipped with the kernel), and among them the families missing from the kernel's fonts.
#[derive(Debug, Clone, Default)]
pub struct FontUsage {
    pub faces: Vec<FaceUse>,
    pub missing: BTreeSet<String>,
}

/// Lays out text for `layers` (the frame layers from the overview) placed in `frame` (the plan for the first frame of the range, from which its sequence and canvas are taken), and returns the faces to look for locally: the family name, weight and italic for each family that was named during layout but is not in `fonts` (the set shipped with the kernel), sorted by name. `seconds` is the time of `frame`.
pub fn font_census(
    video: VideoView,
    frame: &FramePlan,
    seconds: f64,
    layers: &[VisualLayer],
    documents: Documents,
    fonts: Vec<Arc<Vec<u8>>>,
    captions: bool,
) -> Result<Vec<FaceUse>, RenderError> {
    let usage = font_usage(video, frame, seconds, layers, documents, fonts, captions)?;
    Ok(usage
        .faces
        .into_iter()
        .filter(|(family, ..)| usage.missing.contains(family))
        .collect())
}

/// Same text-layout pass as [`font_census`], but gives all named faces (including kernel-shipped families), and additionally gives the families among them that the kernel does not ship: this is the set that `fonts.usage` asks for, the fonts a video uses.
pub fn font_usage(
    video: VideoView,
    frame: &FramePlan,
    seconds: f64,
    layers: &[VisualLayer],
    documents: Documents,
    fonts: Vec<Arc<Vec<u8>>>,
    captions: bool,
) -> Result<FontUsage, RenderError> {
    let (width, height) = (frame.canvas.width.max(1), frame.canvas.height.max(1));
    let scale = f64::from(CENSUS_LONG_EDGE) / f64::from(width.max(height));
    let size = |side: u32| ((f64::from(side) * scale.min(1.0)).round() as u32).max(2);
    let mut renderer = FrameRenderer::with_shared_fonts(
        RenderOptions {
            width: size(width),
            height: size(height),
            skip_unsupported: true,
            captions,
        },
        documents,
        fonts,
    )?;
    let plan = FramePlan {
        layers: layers
            .iter()
            .filter(|layer| shapes_text(layer))
            .map(|layer| VisualLayer {
                transition: None,
                ..layer.clone()
            })
            .collect(),
        voices: Vec::new(),
        ..frame.clone()
    };
    renderer.render(video, &plan, seconds, &mut NoMedia)?;
    let missing: BTreeSet<String> = renderer.missing_fonts().into_iter().collect();
    Ok(FontUsage {
        faces: renderer.used_faces(),
        missing,
    })
}

//! Two project-level projections that the render kernel needs but that **do not belong** to the render kernel.
//!
//! The overlay needs a timeline projection in two places:
//!
//! - [`OverlayHost::studio_timeline_projection`]: `overlay_document_with_live_timeline` merges the current timeline into the Studio body (the word clock after cutting, the element tracks).
//! - [`OverlayHost::project_timeline_projection`]: the conversion table for the sample times of visualizer elements.
//!
//! Implementing these two projections requires reading `.ccut/id-sequences.json` and the history snapshots (the CLI's `ProjectTimeline::load` → `IdAllocator` → `HistoryStore`). That is the territory of the third cut of D2, `ccut-workspace`, so moving it into M1 would overstep. **Inject rather than sink down.** They are not a risk point for a "second implementation": the CLI and the App will both link the same workspace crate, it is just not time yet. By contrast, the path resolution in [`crate::paths`] must sink down, because injecting it would require every host to replicate the naming rules itself.
//!
//! # Why a process-default instance rather than a function parameter
//!
//! Following the second discipline of [`ccut_jobs`](https://docs.rs/): do not freeze a singleton into the public API. The trade-off here has one more layer. Threading the host through as a parameter of `compile_project*` would change the call sites in `serve/endpoints/media.rs`, `studio_export/video.rs` and dozens of tests, and those call sites have nothing to do with this sinking. So the process-default instance from [`register`] is kept, and the public API does not change by a single character.
//!
//! **When nothing is registered, always error. Never silently return an empty projection.** A silent empty projection would make visualizer elements fail to draw with no hint, which is exactly the landmine this kind of sinking most easily buries.

use std::path::Path;
use std::sync::OnceLock;

use anyhow::{Result, anyhow};
use serde_json::Value;
use timeline::arrange::TimelineProjection;

/// Project-level timeline projection provided by the host (CLI / App v2).
pub trait OverlayHost: Send + Sync + 'static {
    /// The `timeline` field in the Studio body: the cut element tracks and the source table.
    fn studio_timeline_projection(&self, project: &Path) -> Result<Value>;

    /// Word/element clock mapping. The visualizer's sample times are converted back to source time through it.
    fn project_timeline_projection(&self, project: &Path) -> Result<TimelineProjection>;

    /// Re-projects the body of `studio/data.json` for the target language. `None` = this language has no translation.
    ///
    /// The projection itself has to read the transcript, compute a content fingerprint and write into `studio/`, so it belongs to the workspace layer. **The host's implementation should be read-only** (main plan §9.1-b). `load_preview_document_for_lang` is the read path for preview and export, and writing to disk here would change project state the user did not request. The `studio::project_language` that the CLI uses today takes the project lock and fills in the `studio/` skeleton. That is historical baggage, not the meaning of this interface.
    fn reproject_language(&self, project: &Path, lang: &str) -> Result<Option<Value>>;

    /// The template layer applied to the project (the `template` in `timeline.json`), together with the project-side facts it references (chapters on the output clock, the project title, the logo image). `Ok(None)` = no template applied.
    ///
    /// Reading timeline.json and the chapter table of transcript.json, and running the timeline projection, is the territory of the workspace. The render kernel only draws the returned scenes frame by frame as one foreground layer.
    ///
    /// **Having no default implementation is deliberate.** Silently returning `Ok(None)` would apply the template with the picture not changing at all and no hint anywhere. That is exactly the landmine that the “never silently return an empty projection” rule at the top of this file is meant to prevent.
    fn template_scene(&self, project: &Path) -> Result<Option<TemplateScene>>;

    /// Font sources to load at render time, in addition to the **built-in fonts** (the user's imported library).
    ///
    /// The default [`BundledFontSource`] has only the built-in fonts compiled into the binary. Hosts that have a configuration root (the CLI, `ccut serve` and App v2 all register the same implementation through `ccut_workspace::timeline::overlay`) override it.
    ///
    /// This one **does** have a default implementation, unlike the interfaces above that all say “never silently”. If the imported font library is absent, subtitles fall back to the built-in font family: the picture still renders, only with a different font. If the projection is absent, the whole layer disappears. The default value itself represents the legitimate state of “no imported library”.
    fn font_source(&self) -> &dyn FontSource {
        &BUNDLED_FONT_SOURCE
    }
}

/// Extra font byte sources to use for rendering (proposal §5.2: the font library dependency of `ccut-subtitle-render` changes to an injected `FontSource`).
///
/// # Why hand over the entire set of bytes at once, rather than `(family, weight, style) → bytes`
///
/// There is only one consumption point. `TextEngine::with_system_and_fonts(&fonts)` takes the **whole** set of font bytes, and the typesetting layer does the family/weight/style matching and fallback itself. An interface that queried by the triple would move font matching out of the typesetting layer into the injection layer and re-implement it there. That would change glyph selection semantics, which is exactly what “the golden fingerprints must not change” is meant to guard against. So the interface is defined by the real consumption shape.
pub trait FontSource: Send + Sync {
    /// Font bytes to load into the text engine in addition to the built-in fonts. Order is priority.
    fn extra_fonts(&self) -> Vec<Vec<u8>>;
}

/// Default font source: only the built-in fonts (`core/assets/fonts/`, see [`crate::bundled_studio_fonts`]). There is no user imported library.
pub struct BundledFontSource;

impl FontSource for BundledFontSource {
    fn extra_fonts(&self) -> Vec<Vec<u8>> {
        Vec::new()
    }
}

static BUNDLED_FONT_SOURCE: BundledFontSource = BundledFontSource;

pub use crate::template_layer::TemplateScene;

static HOST: OnceLock<Box<dyn OverlayHost>> = OnceLock::new();

pub type LiveDocumentProvider = fn(&Path) -> Result<Option<Value>>;
static LIVE_DOCUMENT: OnceLock<LiveDocumentProvider> = OnceLock::new();

pub fn register_live_document(provider: LiveDocumentProvider) -> bool {
    LIVE_DOCUMENT.set(provider).is_ok()
}

pub(crate) fn live_document(project: &Path) -> Result<Option<Value>> {
    LIVE_DOCUMENT
        .get()
        .map_or(Ok(None), |provider| provider(project))
}

/// How the host prepares a composite source. The stage preview renders frames at the width of the render plan, while export hands over the finished-video canvas. The host decides which resolution to render frames at based on the width the source will occupy on the canvas.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VideoSourceUse {
    /// Preview (`SkipFailedElement`): the planned width, i.e. the backing pixel width of the stage.
    Preview { width: u32 },
    /// Export (`Strict`): the finished-video canvas, i.e. the encoding size.
    Export {
        canvas_width: u32,
        canvas_height: u32,
    },
}

/// Preparation entry point for host composite sources such as BCF. `None` means an ordinary video, which continues through the original decoder. Once a source is recognized as composite, a preparation failure must return an error. It must not fall back to the old finished video.
pub type VideoSourceProvider = fn(
    &Path,
    &str,
    Option<&str>,
    VideoSourceUse,
) -> Result<Option<render_raster::media::ExternalVideoSource>>;
static VIDEO_SOURCES: OnceLock<VideoSourceProvider> = OnceLock::new();

pub fn register_video_sources(provider: VideoSourceProvider) -> bool {
    VIDEO_SOURCES.set(provider).is_ok()
}

pub(crate) fn prepare_video_source(
    project: &Path,
    id: &str,
    path: Option<&str>,
    usage: VideoSourceUse,
) -> Result<Option<render_raster::media::ExternalVideoSource>> {
    match VIDEO_SOURCES.get() {
        Some(provider) => provider(project, id, path, usage),
        None => Ok(None),
    }
}

/// Registers the process-default host. Repeated registration is a no-op (returns `false`) and does not panic, because several tests in the same test binary go through this path.
pub fn register(host: Box<dyn OverlayHost>) -> bool {
    HOST.set(host).is_ok()
}

fn host() -> Result<&'static dyn OverlayHost> {
    HOST.get().map(AsRef::as_ref).ok_or_else(|| {
        anyhow!(
            "ccut-subtitle-render 未注册 OverlayHost：\
             宿主进程必须在渲染前调用 `subtitle_render::host::register`"
        )
    })
}

pub(crate) fn studio_timeline_projection(project: &Path) -> Result<Value> {
    host()?.studio_timeline_projection(project)
}

pub(crate) fn project_timeline_projection(project: &Path) -> Result<TimelineProjection> {
    host()?.project_timeline_projection(project)
}

pub(crate) fn reproject_language(project: &Path, lang: &str) -> Result<Option<Value>> {
    host()?.reproject_language(project, lang)
}

pub(crate) fn template_scene(project: &Path) -> Result<Option<TemplateScene>> {
    host()?.template_scene(project)
}

/// Registers extra fonts provided by the host. **When nothing is registered, the set is empty** rather than an error. The built-in fonts alone can still render. For the reasoning, see [`OverlayHost::font_source`].
pub fn extra_fonts() -> Vec<Vec<u8>> {
    HOST.get()
        .map(|host| host.font_source().extra_fonts())
        .unwrap_or_default()
}

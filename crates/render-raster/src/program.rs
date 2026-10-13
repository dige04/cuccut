//! `program` asset (spec §6.5.3): `ccut-compile` evaluates the program into one SVG per frame. Here it is rasterized into bitmap frames, and supplied through the same frame-fetch path as animated images, via [`crate::media::MediaStore`].
//!
//! The evaluator (QuickJS) is `!Send`, but `MediaStore` must be handed across threads. So [`ProgramSource`] itself holds only the shareable, read-only part, and the evaluator is built lazily per thread and cached per source in a thread-local table ([`with_instance`]). A program is a pure function of the frame, so it does not matter which thread renders which frame; the result is the same.
//! Each evaluator runs its module top level only once and is then kept alive, so an author who stores mutable state at the top level would break this. During loading, the first frame is evaluated twice and the results compared, and any mismatch is reported ([`ProgramSource::probe`]).

use crate::plan::PreflightDiagnostic;
use anyhow::{Result, anyhow, bail};
use ccut_compile::program::{
    FontMetrics, MeasureText, ProgramBundle, ProgramFrame, ProgramInstance,
};
use resvg::usvg::{self, ImageHrefResolver, fontdb};
use scene_primitives::assets::ProgramReq;
use scene_primitives::program_path::{PATH_ESCAPE, escape_message, escapes};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, Weak};
use tiny_skia::Pixmap;

/// The `href` prefix that `asset("…")` writes in SVG (the `asset` in the runtime's `program.js`).
const ASSET_SCHEME: &str = "bcasset:";

/// Maximum number of program evaluators kept alive per thread at once. An evaluator is an entire JS heap (tens of MB), and a document usually has only one or two programs.
const INSTANCES_PER_THREAD: usize = 4;

static NEXT_SERIAL: AtomicU64 = AtomicU64::new(1);

/// One degradation hint: the runtime's hint code, the earliest frame where it was hit, and whether it was already reported during the trial render at load time.
#[derive(Debug)]
struct Degraded {
    warning: String,
    frame: u32,
    probed: bool,
}

/// A loaded `program` asset: the module graph, `files` bytes, declared canvas and frame table, and the font library used for typesetting. No I/O during rendering.
pub struct ProgramSource {
    id: String,
    serial: u64,
    bundle: Arc<ProgramBundle>,
    props_json: String,
    width: u32,
    height: u32,
    fps: f64,
    frames: u32,
    frame_starts_ms: Vec<i64>,
    fontdb: Arc<fontdb::Database>,
    /// The "last resort" font in the font library (macOS `.LastResort`). It draws a placeholder box for any character, so when the document registers no fonts and the system font is used, missing glyphs fall to it rather than to glyph 0.
    last_resort: Vec<fontdb::ID>,
    /// Degradation hints hit in rendered frames (aggregated across threads; each entry is recorded only once).
    degraded: Mutex<Vec<Degraded>>,
}

impl std::fmt::Debug for ProgramSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProgramSource")
            .field("id", &self.id)
            .field("width", &self.width)
            .field("height", &self.height)
            .field("fps", &self.fps)
            .field("frames", &self.frames)
            .finish_non_exhaustive()
    }
}

impl ProgramSource {
    pub fn new(
        id: &str,
        bundle: ProgramBundle,
        req: &ProgramReq,
        fontdb: Arc<fontdb::Database>,
    ) -> ProgramSource {
        ProgramSource {
            id: id.to_owned(),
            serial: NEXT_SERIAL.fetch_add(1, Ordering::Relaxed),
            bundle: Arc::new(bundle),
            props_json: req.props.to_string(),
            width: req.width,
            height: req.height,
            fps: req.fps,
            frames: req.frames,
            frame_starts_ms: req.frame_starts_ms(),
            last_resort: fontdb
                .faces()
                .filter(|face| face.families.iter().any(|(name, _)| name == ".LastResort"))
                .map(|face| face.id)
                .collect(),
            fontdb,
            degraded: Mutex::new(Vec::new()),
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// `N + 1` frame start-time table (milliseconds), the same shape as animated images and Lottie.
    pub fn frame_starts_ms(&self) -> &[i64] {
        &self.frame_starts_ms
    }

    /// Duration of one cycle (seconds).
    pub fn duration(&self) -> f64 {
        self.frame_starts_ms.last().copied().unwrap_or(0) as f64 / 1000.0
    }

    pub fn bundle(&self) -> &ProgramBundle {
        &self.bundle
    }

    /// Which frame `ms` falls in (out-of-range values are clamped to the first or last frame).
    pub fn frame_index(&self, ms: i64) -> u32 {
        crate::source::frame_index(&self.frame_starts_ms, ms) as u32
    }

    /// The start of the frame containing `ms`. Moments within the same frame window render byte-for-byte identically, so the cache is keyed by it.
    pub fn frame_start_ms(&self, ms: i64) -> i64 {
        crate::source::frame_start_ms(&self.frame_starts_ms, ms)
    }

    fn frame_args(&self, frame: u32) -> ProgramFrame<'_> {
        ProgramFrame {
            frame: frame.min(self.frames.saturating_sub(1)),
            fps: self.fps,
            width: self.width,
            height: self.height,
            frames: self.frames,
            props_json: &self.props_json,
        }
    }

    /// SVG text of frame `frame`.
    pub fn svg(&self, frame: u32) -> Result<String> {
        with_instance(self, |instance| {
            instance.render_svg(&self.frame_args(frame))
        })
    }

    /// Degradation hints noted on this thread during the most recent frame the runtime evaluated (unsupported CSS, etc.).
    pub fn warnings(&self) -> Vec<String> {
        with_instance(self, |instance| Ok(instance.warnings())).unwrap_or_default()
    }

    /// Trial render during resource loading: evaluates and rasterizes the first frame once, so runtime errors other than those at module top level (exceptions thrown on the first frame, references to undeclared files) are reported at load time, and the degradation hints go into preflight. The first frame is then evaluated again (without rasterizing) and compared. If the two differ, the module top level holds mutable state across frames, and a single-frame render and a multi-threaded full render would produce different pictures.
    pub fn probe(&self) -> Result<Vec<PreflightDiagnostic>> {
        let (_, svg) = self.render_frame(0, None)?;
        if self.svg(0)? != svg {
            self.note(0, vec!["module-state".to_owned()]);
        }
        let mut seen = self.degraded.lock().unwrap_or_else(|e| e.into_inner());
        Ok(seen
            .iter_mut()
            .map(|entry| {
                entry.probed = true;
                self.diagnostic(&entry.warning, None)
            })
            .collect())
    }

    /// Degradation hints hit during rendering, after the trial render of the first frame (constructs used only in later segments, missing glyphs), sorted by the earliest frame where they appear. Ones already reported during loading are not repeated. Read after rendering finishes.
    pub fn late_diagnostics(&self) -> Vec<PreflightDiagnostic> {
        let seen = self.degraded.lock().unwrap_or_else(|e| e.into_inner());
        let mut late: Vec<&Degraded> = seen.iter().filter(|entry| !entry.probed).collect();
        late.sort_by(|a, b| (a.frame, &a.warning).cmp(&(b.frame, &b.warning)));
        late.into_iter()
            .map(|entry| self.diagnostic(&entry.warning, Some(entry.frame)))
            .collect()
    }

    fn diagnostic(&self, warning: &str, frame: Option<u32>) -> PreflightDiagnostic {
        let at = frame
            .map(|frame| format!(" (from program frame {frame})"))
            .unwrap_or_default();
        PreflightDiagnostic {
            rule: "program-degraded",
            message: format!("asset \"{}\": {}{at}", self.id, describe_warning(warning)),
        }
    }

    fn note(&self, frame: u32, warnings: Vec<String>) {
        if warnings.is_empty() {
            return;
        }
        let mut seen = self.degraded.lock().unwrap_or_else(|e| e.into_inner());
        for warning in warnings {
            match seen.iter_mut().find(|entry| entry.warning == warning) {
                Some(entry) => entry.frame = entry.frame.min(frame),
                None => seen.push(Degraded {
                    warning,
                    frame,
                    probed: false,
                }),
            }
        }
    }

    /// Gets the frame at `ms`. `target = None` rasterizes at the declared canvas size; otherwise it re-lays out and rasterizes at the target pixel size (vector content is not scaled from a bitmap). Degradation hints for this frame are recorded into the aggregate.
    pub fn render(&self, ms: i64, target: Option<(u32, u32)>) -> Result<Pixmap> {
        let (pixmap, _) = self.render_frame(self.frame_index(ms), target)?;
        Ok(pixmap)
    }

    /// Evaluates and rasterizes frame `frame`, together with that frame's SVG text.
    fn render_frame(&self, frame: u32, target: Option<(u32, u32)>) -> Result<(Pixmap, String)> {
        let (svg, mut warnings) = with_instance(self, |instance| {
            let svg = instance.render_svg(&self.frame_args(frame))?;
            Ok((svg, instance.warnings()))
        })?;
        let (pixmap, glyphs, families) = self.rasterize(frame, &svg, target)?;
        warnings.extend(
            families
                .into_iter()
                .map(|f| format!("font-family-missing:{f}")),
        );
        warnings.extend(glyphs.into_iter().map(|c| format!("glyph-missing:{c}")));
        self.note(frame, warnings);
        Ok((pixmap, svg))
    }

    /// Rasterizes one frame. Also returns characters in the text that no font can draw (drawn as .notdef empty boxes), and `font-family` values not found in the font library, which were drawn with the default sans-serif font instead.
    fn rasterize(
        &self,
        frame: u32,
        svg: &str,
        target: Option<(u32, u32)>,
    ) -> Result<(Pixmap, Vec<char>, Vec<String>)> {
        let missing = Arc::new(Mutex::new(Vec::<String>::new()));
        let escaped = Arc::new(Mutex::new(Vec::<String>::new()));
        let unmatched = Arc::new(Mutex::new(Vec::<String>::new()));
        let mut options = usvg::Options {
            fontdb: self.fontdb.clone(),
            ..usvg::Options::default()
        };
        options.image_href_resolver =
            asset_resolver(self.bundle.clone(), missing.clone(), escaped.clone());
        options.font_resolver.select_font = font_selector(unmatched.clone());
        let tree = usvg::Tree::from_str(svg, &options).map_err(|e| {
            anyhow!(
                "program-render-failed: asset \"{}\" SVG parse failed at frame {frame}: {e}",
                self.id
            )
        })?;
        // An asset() path that uses `..` to escape the document directory is only known at evaluation time; it is reported here with the same code as lint
        let escaped = std::mem::take(&mut *escaped.lock().unwrap_or_else(|e| e.into_inner()));
        if let Some(first) = escaped.first() {
            let more = match escaped.len() {
                1 => String::new(),
                n => format!(" (and {} more: {})", n - 1, escaped[1..].join(", ")),
            };
            bail!(
                "{PATH_ESCAPE}: asset \"{}\" at frame {frame}: {}{more}",
                self.id,
                escape_message("asset()", first)
            );
        }
        let missing = std::mem::take(&mut *missing.lock().unwrap_or_else(|e| e.into_inner()));
        if !missing.is_empty() {
            bail!(
                "program-file-missing: asset \"{}\" at frame {frame} references a file outside files: {}\
                 (asset() can only read files declared in files; paths are relative to the document directory)",
                self.id,
                missing.join(", ")
            );
        }
        let (width, height) = target.unwrap_or((self.width, self.height));
        let (width, height) = (width.max(1), height.max(1));
        let mut pixmap = Pixmap::new(width, height)
            .ok_or_else(|| anyhow!("program-render-failed: target size {width}×{height} is invalid"))?;
        let size = tree.size();
        let transform = tiny_skia::Transform::from_scale(
            width as f32 / size.width().max(1.0),
            height as f32 / size.height().max(1.0),
        );
        let painted = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            resvg::render(&tree, transform, &mut pixmap.as_mut());
        }));
        if painted.is_err() {
            bail!(
                "program-render-failed: resvg crashed while rasterizing asset \"{}\" at frame {frame}",
                self.id
            );
        }
        let mut glyphs = Vec::new();
        missing_glyphs(tree.root(), &self.last_resort, &mut glyphs);
        glyphs.sort_unstable();
        glyphs.dedup();
        let families = std::mem::take(&mut *unmatched.lock().unwrap_or_else(|e| e.into_inner()));
        Ok((pixmap, glyphs, families))
    }
}

/// Selects a font from the `font-family` list. usvg's default behaviour, when every entry fails, is to look for `serif`. The strict font library usually does not have it (the default is Times New Roman), so the whole text silently disappears; when a system font is present, it is quietly swapped for a serif face. Here, if the list finds nothing, the default sans-serif font (the first font the document registered) is used, and the families that found nothing are recorded.
fn font_selector(unmatched: Arc<Mutex<Vec<String>>>) -> usvg::FontSelectionFn<'static> {
    Box::new(move |font, db| {
        let declared = font
            .families()
            .iter()
            .map(|family| match family {
                usvg::FontFamily::Serif => fontdb::Family::Serif,
                usvg::FontFamily::SansSerif => fontdb::Family::SansSerif,
                usvg::FontFamily::Cursive => fontdb::Family::Cursive,
                usvg::FontFamily::Fantasy => fontdb::Family::Fantasy,
                usvg::FontFamily::Monospace => fontdb::Family::Monospace,
                usvg::FontFamily::Named(name) => fontdb::Family::Name(name),
            })
            .collect::<Vec<_>>();
        let stretch = match font.stretch() {
            usvg::FontStretch::UltraCondensed => fontdb::Stretch::UltraCondensed,
            usvg::FontStretch::ExtraCondensed => fontdb::Stretch::ExtraCondensed,
            usvg::FontStretch::Condensed => fontdb::Stretch::Condensed,
            usvg::FontStretch::SemiCondensed => fontdb::Stretch::SemiCondensed,
            usvg::FontStretch::Normal => fontdb::Stretch::Normal,
            usvg::FontStretch::SemiExpanded => fontdb::Stretch::SemiExpanded,
            usvg::FontStretch::Expanded => fontdb::Stretch::Expanded,
            usvg::FontStretch::ExtraExpanded => fontdb::Stretch::ExtraExpanded,
            usvg::FontStretch::UltraExpanded => fontdb::Stretch::UltraExpanded,
        };
        let style = match font.style() {
            usvg::FontStyle::Normal => fontdb::Style::Normal,
            usvg::FontStyle::Italic => fontdb::Style::Italic,
            usvg::FontStyle::Oblique => fontdb::Style::Oblique,
        };
        let query = |families: &[fontdb::Family<'_>]| {
            db.query(&fontdb::Query {
                families,
                weight: fontdb::Weight(font.weight()),
                stretch,
                style,
            })
        };
        if let Some(id) = query(&declared) {
            return Some(id);
        }
        // The Display of `FontFamily` adds quotes around named families, so the message writes bare names.
        let families = font
            .families()
            .iter()
            .map(|family| match family {
                usvg::FontFamily::Named(name) => name.clone(),
                generic => generic.to_string(),
            })
            .collect::<Vec<_>>()
            .join(", ");
        if let Ok(mut unmatched) = unmatched.lock() {
            if !unmatched.contains(&families) {
                unmatched.push(families);
            }
        }
        query(&[fontdb::Family::SansSerif])
    })
}

/// Characters in the typeset result that have no real glyph: glyph ID 0 (.notdef), or ones that fell to the "last resort" font. Neither the document fonts nor the built-in fonts have them, and usvg's per-character fallback cannot find them either. They are drawn as empty boxes, with no error.
fn missing_glyphs(group: &usvg::Group, last_resort: &[fontdb::ID], out: &mut Vec<char>) {
    for node in group.children() {
        match node {
            usvg::Node::Group(group) => missing_glyphs(group, last_resort, out),
            usvg::Node::Text(text) => {
                for span in text.layouted() {
                    let missing = span
                        .positioned_glyphs
                        .iter()
                        .filter(|g| g.id.0 == 0 || last_resort.contains(&g.font));
                    for glyph in missing {
                        out.extend(
                            glyph
                                .text
                                .chars()
                                .filter(|c| !c.is_whitespace() && !c.is_control()),
                        );
                    }
                }
            }
            _ => {}
        }
        node.subroots(|sub| missing_glyphs(sub, last_resort, out));
    }
}

/// Tags a load-time error with the asset name and keeps the diagnostic code at the front (`program-…: asset "x": …`), so the host can dispatch on the code unaffected.
pub fn tag_asset(id: &str, error: anyhow::Error) -> anyhow::Error {
    let text = format!("{error:#}");
    let tag = format!("asset \"{id}\"");
    if text.contains(&tag) {
        return error;
    }
    match text.split_once(": ") {
        Some((code, rest))
            if code.starts_with("program-") && !code.contains(char::is_whitespace) =>
        {
            anyhow!("{code}: {tag}: {rest}")
        }
        _ => anyhow!("{tag}: {text}"),
    }
}

/// `bcasset:` references take bytes from `files`. Other `href`s accept only data URIs, and disk paths are never read.
/// `asset()` paths that use `..` to escape the document directory are recorded in `escaped` (reported as `program-path-escape`). Other files that cannot be obtained are recorded in `missing` (reported as `program-file-missing`).
fn asset_resolver(
    bundle: Arc<ProgramBundle>,
    missing: Arc<Mutex<Vec<String>>>,
    escaped: Arc<Mutex<Vec<String>>>,
) -> ImageHrefResolver<'static> {
    ImageHrefResolver {
        resolve_data: ImageHrefResolver::default_data_resolver(),
        resolve_string: Box::new(move |href: &str, options: &usvg::Options| {
            if let Some(name) = href.strip_prefix(ASSET_SCHEME)
                && escapes("", name)
            {
                if let Ok(mut escaped) = escaped.lock()
                    && !escaped.iter().any(|seen| seen == name)
                {
                    escaped.push(name.to_owned());
                }
                return None;
            }
            let found = href
                .strip_prefix(ASSET_SCHEME)
                .and_then(|name| bundle.file(name).map(|bytes| (name, bytes.clone())));
            let Some((name, bytes)) = found else {
                if let Ok(mut missing) = missing.lock() {
                    let name = href.strip_prefix(ASSET_SCHEME).unwrap_or(href).to_owned();
                    if !missing.contains(&name) {
                        missing.push(name);
                    }
                }
                return None;
            };
            let kind = match sniff(&bytes) {
                Some(mime) => (ImageHrefResolver::default_data_resolver())(mime, bytes, options),
                None => None,
            };
            if kind.is_none() {
                if let Ok(mut missing) = missing.lock() {
                    missing.push(format!("{name} (not PNG / JPEG / GIF / WebP / SVG)"));
                }
            }
            kind
        }),
    }
}

/// Identifies the image format from the byte header (the file name may be absent or untrustworthy).
fn sniff(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        let head = &bytes[..bytes.len().min(512)];
        let text = String::from_utf8_lossy(head);
        let text = text.trim_start_matches('\u{feff}').trim_start();
        (text.starts_with("<?xml") || text.contains("<svg")).then_some("image/svg+xml")
    }
}

fn describe_warning(warning: &str) -> String {
    let (kind, detail) = warning.split_once(':').unwrap_or((warning, ""));
    match kind {
        "css-unsupported" => format!("CSS property {detail} cannot be drawn; ignored"),
        "css-transform-unsupported" => format!("CSS transform {detail}() cannot be drawn; ignored"),
        "css-filter-unsupported" => format!("CSS filter {detail}() cannot be drawn; ignored"),
        "css-clip-path-unsupported" => format!("clip-path \"{detail}\" cannot be drawn; ignored"),
        "css-mask-unsupported" => "CSS mask cannot be drawn; ignored".to_owned(),
        "css-background-unsupported" => format!("background \"{detail}\" cannot be drawn; ignored"),
        "svg-tag-unknown" => format!("<{detail}> is not a recognized SVG tag; output as-is"),
        "css-blend-unsupported" => format!(
            "mix-blend-mode \"{detail}\" cannot be drawn; this layer is composited as normal (the rasterizer only accepts the ccut spec program \
             cssBlendModes); for additive glow use screen, or split the layer into its own program element and set style.blendMode: \"plus\" on it"
        ),
        "font-missing" => format!("measureText cannot find font \"{detail}\"; text width is estimated"),
        "css-backdrop-unsupported" => {
            format!("backdrop-filter \"{detail}\" cannot be drawn (only filter functions on div are supported); ignored")
        }
        "font-family-missing" => format!(
            "font family \"{detail}\" is not among the registered fonts; this text is drawn with the default sans-serif font instead; use the family name stored in the font file \
             (name table ID 1; Google Fonts static packs often carry suffixes such as \"24pt\"), and register the font as a font asset"
        ),
        "module-state" => "evaluating the same frame twice draws different results: the module top level holds mutable state that carries across frames (for example a top-level let rewritten by a component), \
             so single-frame rendering and full-sequence rendering (drawn in parallel segments) disagree; keep only read-only constants at the top level and compute time-varying values in useFrame()"
            .to_owned(),
        "glyph-missing" => format!(
            "character \"{detail}\" (U+{:04X}) has no glyph in any registered font and is drawn as an empty box; register a font asset that contains this character",
            detail.chars().next().map_or(0, u32::from)
        ),
        _ => warning.to_owned(),
    }
}

type InstanceSlot = (u64, Weak<ProgramBundle>, Rc<ProgramInstance>);

thread_local! {
    /// The evaluators of this thread, keyed by the sequence number of the [`ProgramSource`]. The most recently used one is at the tail.
    static INSTANCES: RefCell<Vec<InstanceSlot>> = const { RefCell::new(Vec::new()) };
}

/// Runs `f` on this thread's evaluator. Creates one if none exists (the first time takes about tens of milliseconds).
fn with_instance<T>(
    source: &ProgramSource,
    f: impl FnOnce(&ProgramInstance) -> Result<T>,
) -> Result<T> {
    let instance = INSTANCES.with(|cell| -> Result<Rc<ProgramInstance>> {
        let mut slots = cell.borrow_mut();
        // Evaluators whose source has been released are discarded right away: their JS heaps should not outlive the thread.
        slots.retain(|(_, bundle, _)| bundle.strong_count() > 0);
        if let Some(index) = slots
            .iter()
            .position(|(serial, ..)| *serial == source.serial)
        {
            let slot = slots.remove(index);
            let instance = slot.2.clone();
            slots.push(slot);
            return Ok(instance);
        }
        let instance = Rc::new(ProgramInstance::new(
            &source.bundle,
            Some(measure_text(source.fontdb.clone())),
        )?);
        instance.set_font_metrics(font_metrics(source.fontdb.clone()))?;
        if slots.len() >= INSTANCES_PER_THREAD {
            slots.remove(0);
        }
        slots.push((
            source.serial,
            Arc::downgrade(&source.bundle),
            instance.clone(),
        ));
        Ok(instance)
    })?;
    f(&instance)
}

/// Host implementation of `measureText`: selects a font from the document's font library by CSS font-family list, weight and italic style, and accumulates advances using the same rustybuzz shaping as usvg's layout. Returns NaN if no font is found, and the runtime falls back to estimating from the font size.
fn measure_text(db: Arc<fontdb::Database>) -> MeasureText {
    let faces: RefCell<HashMap<(String, u16, bool), Option<fontdb::ID>>> =
        RefCell::new(HashMap::new());
    Box::new(move |text, family, size, weight, italic| {
        let key = (family.to_owned(), weight, italic);
        let id = *faces
            .borrow_mut()
            .entry(key)
            .or_insert_with(|| select_face(&db, family, weight, italic));
        let Some(id) = id else {
            return f64::NAN;
        };
        db.with_face_data(id, |data, index| {
            let face = rustybuzz::Face::from_slice(data, index)?;
            let mut buffer = rustybuzz::UnicodeBuffer::new();
            buffer.push_str(text);
            let shaped = rustybuzz::shape(&face, &[], buffer);
            let advance: i64 = shaped
                .glyph_positions()
                .iter()
                .map(|position| i64::from(position.x_advance))
                .sum();
            Some(advance as f64 * size / f64::from(face.units_per_em().max(1)))
        })
        .flatten()
        .unwrap_or(f64::NAN)
    })
}

/// Host implementation of `ascent` and `descent` for `measureText`. Uses the same font selection as [`measure_text`] and takes the font-level metrics (ttf-parser's `ascender` / `descender`: if OS/2 has USE_TYPO_METRICS set, the typo values are used; otherwise hhea, and if hhea is 0, OS/2). These are the two numbers usvg uses to place the baseline. descent is returned as a positive value.
fn font_metrics(db: Arc<fontdb::Database>) -> FontMetrics {
    let faces: RefCell<HashMap<(String, u16, bool), Option<fontdb::ID>>> =
        RefCell::new(HashMap::new());
    Box::new(move |family, size, weight, italic| {
        let key = (family.to_owned(), weight, italic);
        let id = (*faces
            .borrow_mut()
            .entry(key)
            .or_insert_with(|| select_face(&db, family, weight, italic)))?;
        db.with_face_data(id, |data, index| {
            let face = rustybuzz::Face::from_slice(data, index)?;
            let scale = size / f64::from(face.units_per_em().max(1));
            Some((
                f64::from(face.ascender()) * scale,
                -f64::from(face.descender()) * scale,
            ))
        })
        .flatten()
    })
}

fn select_face(
    db: &fontdb::Database,
    family: &str,
    weight: u16,
    italic: bool,
) -> Option<fontdb::ID> {
    let names = parse_family_list(family);
    let mut families: Vec<fontdb::Family<'_>> = names
        .iter()
        .map(|name| match name.to_ascii_lowercase().as_str() {
            "serif" => fontdb::Family::Serif,
            "sans-serif" => fontdb::Family::SansSerif,
            "monospace" => fontdb::Family::Monospace,
            "cursive" => fontdb::Family::Cursive,
            "fantasy" => fontdb::Family::Fantasy,
            _ => fontdb::Family::Name(name),
        })
        .collect();
    if families.is_empty() {
        families.push(fontdb::Family::SansSerif);
    }
    db.query(&fontdb::Query {
        families: &families,
        weight: fontdb::Weight(weight),
        stretch: fontdb::Stretch::Normal,
        style: if italic {
            fontdb::Style::Italic
        } else {
            fontdb::Style::Normal
        },
    })
}

/// CSS `font-family` list: comma-separated, and names may be quoted with single or double quotes.
fn parse_family_list(list: &str) -> Vec<String> {
    list.split(',')
        .map(|name| name.trim().trim_matches(|c| c == '"' || c == '\'').trim())
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn family_lists_drop_quotes_and_blanks() {
        assert_eq!(
            parse_family_list(r#""Fraunces", 'Space Grotesk' , serif,"#),
            vec!["Fraunces", "Space Grotesk", "serif"]
        );
    }

    /// The degradation hint names that value, says it is drawn as normal, and gives two ways to fix it.
    #[test]
    fn unsupported_blend_modes_are_described() {
        let text = describe_warning("css-blend-unsupported:plus-lighter");
        for needle in [
            "plus-lighter",
            "normal",
            "screen",
            "blendMode",
            "cssBlendModes",
        ] {
            assert!(text.contains(needle), "missing {needle}: {text}");
        }
    }

    /// The runtime's `BLEND_MODES` (`cssBlendModes` of `ccut spec program`) is cross-checked item by item against the rasterizer. Every value in the list is parsed by usvg into its corresponding blend mode, while `plus-lighter` and `plus-darker`, which are not in the list, are dropped at parse time and drawn as normal. An incorrect list would cause false reports or misses.
    #[test]
    fn program_blend_list_matches_what_usvg_parses() {
        fn blended(mode: &str) -> bool {
            let svg = format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><g style="mix-blend-mode:{mode}"><rect width="4" height="4" fill="red"/></g></svg>"#
            );
            let tree = usvg::Tree::from_str(&svg, &usvg::Options::default()).unwrap();
            fn any(group: &usvg::Group) -> bool {
                group.blend_mode() != usvg::BlendMode::Normal
                    || group.children().iter().any(|node| match node {
                        usvg::Node::Group(group) => any(group),
                        _ => false,
                    })
            }
            any(tree.root())
        }
        let modes = ccut_compile::program::vocabulary::program_vocabulary().css_blend_modes;
        assert_eq!(modes.len(), 16, "{modes:?}");
        for mode in modes {
            assert_eq!(blended(mode), mode != "normal", "{mode}");
        }
        for mode in ["plus-lighter", "plus-darker", "Screen"] {
            assert!(!blended(mode), "{mode} should be dropped by usvg");
        }
    }

    /// Font-level ascent and descent are taken from the selected face, scaled by font size, with descent as a positive value. If no font family is found, the result is `None` (the runtime falls back to estimation).
    #[test]
    fn program_font_metrics_come_from_the_selected_face() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/fonts/Arimo.ttf");
        let data = std::fs::read(&path).unwrap();
        let face = rustybuzz::Face::from_slice(&data, 0).unwrap();
        let upem = f64::from(face.units_per_em());
        let (asc, desc) = (f64::from(face.ascender()), f64::from(face.descender()));
        let mut db = fontdb::Database::new();
        db.load_font_data(data.clone());
        let family = db.faces().next().unwrap().families[0].0.clone();
        let metrics = font_metrics(Arc::new(db));
        let (ascent, descent) = metrics(&family, 100.0, 400, false).expect("a font was found");
        assert!((ascent - asc * 100.0 / upem).abs() < 1e-9, "{ascent}");
        assert!((descent + desc * 100.0 / upem).abs() < 1e-9, "{descent}");
        assert!(ascent > 50.0 && descent > 5.0, "{ascent} {descent}");
        assert!(metrics("No Such Family", 100.0, 400, false).is_none());
    }

    #[test]
    fn sniffing_recognises_the_supported_formats() {
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\n"), Some("image/png"));
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(sniff(b"GIF89a"), Some("image/gif"));
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff("\u{feff}<svg/>".as_bytes()), Some("image/svg+xml"));
        assert_eq!(sniff(b"hello"), None);
    }
}

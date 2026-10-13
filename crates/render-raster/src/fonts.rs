//! Text engine: cosmic-text shaping, and glyph outlines turned into tiny-skia Paths.
//! Implements ccut-core's TextMeasure (layout measurement) and provides glyph paths for rendering.
//! Glyphs are drawn as vector outlines, so they do not distort under any transform (camera zoom or pop scale).

use cosmic_text::{
    Attrs, Buffer, CacheKey, Family, FontSystem, Metrics, Shaping, Stretch, Style, SubpixelBin,
    SwashCache, SwashContent, Weight, fontdb,
};
use scene_primitives::layout::{TextMeasure, TextMetricsLine};
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::sync::Arc;
use std::sync::OnceLock;
use swash::scale::Source;
use tiny_skia::{
    ColorU8, Paint, Path, PathBuilder, PathSegment, Pixmap, PremultipliedColorU8, Stroke, Transform,
};

static SYSTEM_FONT_DB: OnceLock<fontdb::Database> = OnceLock::new();

/// `style.fontStyle` (spec §6.3) mapped to fontdb / cosmic-text `Style`.
fn font_style(italic: bool) -> Style {
    if italic { Style::Italic } else { Style::Normal }
}

/// The system font database. It is loaded **only once** per process. The first call scans every font on the machine, which measured about 0.5 s.
fn system_font_db() -> &'static fontdb::Database {
    SYSTEM_FONT_DB.get_or_init(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        db
    })
}

/// Warms up the system font database. The one-time load of [`system_font_db`] is paid earlier, in another place.
///
/// Interactive hosts (the App at startup, the serve preview endpoint) would wait synchronously for this half second the first time they render an overlay. That is exactly the "first frame after opening a project" moment. Calling it once early on a background thread means the later [`TextEngine::with_system_and_fonts`] only costs one `Database::clone`.
///
/// Idempotent. Calling it concurrently with the real first use is also safe: `OnceLock` ensures the database is loaded only once, and a later caller waits for the earlier one to finish. The worst case is therefore exactly the same as without warming up, and it is never slower.
pub fn warm_system_fonts() {
    let _ = system_font_db();
}

/// The name of a font face: the family name (in all of its language forms) and the PostScript name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaceNames {
    pub families: Vec<String>,
    pub post_script_name: String,
}

impl FaceNames {
    /// True if the family name or PostScript name equals `name`. Family names are case-insensitive.
    pub fn matches(&self, name: &str) -> bool {
        self.post_script_name == name
            || self
                .families
                .iter()
                .any(|family| family.eq_ignore_ascii_case(name))
    }
}

fn face_names(face: &fontdb::FaceInfo) -> FaceNames {
    FaceNames {
        families: face
            .families
            .iter()
            .map(|(family, _)| family.clone())
            .collect(),
        post_script_name: face.post_script_name.clone(),
    }
}

/// The names of all faces in one font file's bytes. Used by remote export J4 to decide, by family name or PostScript name, whether a node is missing this font. Bytes that cannot be recognized give an empty list.
pub fn font_data_faces(data: Vec<u8>) -> Vec<FaceNames> {
    let mut db = fontdb::Database::new();
    db.load_font_data(data);
    db.faces().map(face_names).collect()
}

/// The files in the system font database that hold faces whose family name or PostScript name equals `name` (deduplicated and sorted). In-memory fonts are not listed. Remote export uploads only system fonts that are used, and it does so by file.
pub fn system_font_files(name: &str) -> Vec<std::path::PathBuf> {
    let mut files = system_font_db()
        .faces()
        .filter(|face| face_names(face).matches(name))
        .filter_map(|face| match &face.source {
            // System fonts are loaded per file (`load_system_fonts` → `Source::File`).
            fontdb::Source::File(path) => Some(path.clone()),
            _ => None,
        })
        .collect::<Vec<_>>();
    files.sort();
    files.dedup();
    files
}

/// Whether the system font database has a face whose family name or PostScript name equals `name`.
pub fn system_has_font(name: &str) -> bool {
    system_font_db()
        .faces()
        .any(|face| face_names(face).matches(name))
}

/// The CJK fallback font that ships with CucCut: Source Han Sans, Google build (variable weight).
///
/// The default build only `include_bytes!` it here. The first item of `ccut_subtitle_render::bundled_studio_fonts()` refers to this one, so the same binary does not carry a second 17 MB copy. The App-only `external-fonts` build reads the signed shared resource directory instead.
///
/// It follows `media`, the host byte layer. The wasm build does not bundle it. CJK in the browser preview comes from document fonts injected from JS by the caller. The render truth is `ccut render`.
#[cfg(feature = "media")]
pub fn cjk_fallback_font() -> &'static [u8] {
    #[cfg(feature = "external-fonts")]
    {
        external_bundled_font("NotoSansSC-Variable.ttf")
    }
    #[cfg(not(feature = "external-fonts"))]
    {
        include_bytes!("../assets/fonts/NotoSansSC-Variable.ttf")
    }
}

/// CucCut's built-in display fonts, apart from the CJK fallback: 30 more (Poppins, Bangers, Permanent Marker, and others).
///
/// `include_bytes!` appears only here. The full set of built-in Studio subtitle fonts (`ccut_subtitle_render::bundled_studio_fonts()`, in this order after CJK) and BCF document rendering ([`TextEngine::for_document`]) share the same bytes. The order is checked by index against the kernel font table, and new fonts are only appended at the end.
#[cfg(feature = "media")]
pub fn bundled_display_fonts() -> &'static [&'static [u8]] {
    macro_rules! bundled_font {
        ($name:literal) => {{
            #[cfg(feature = "external-fonts")]
            {
                external_bundled_font($name)
            }
            #[cfg(not(feature = "external-fonts"))]
            {
                include_bytes!(concat!("../assets/fonts/", $name)).as_slice()
            }
        }};
    }
    static FONTS: OnceLock<Vec<&'static [u8]>> = OnceLock::new();
    FONTS.get_or_init(|| {
        vec![
            bundled_font!("Montserrat.ttf"),
            bundled_font!("Arimo.ttf"),
            bundled_font!("Poppins-Regular.ttf"),
            bundled_font!("Poppins-Medium.ttf"),
            bundled_font!("Poppins-SemiBold.ttf"),
            bundled_font!("Poppins-ExtraBold.ttf"),
            bundled_font!("Anton-Regular.ttf"),
            bundled_font!("SquadaOne-Regular.ttf"),
            bundled_font!("Shrikhand-Regular.ttf"),
            bundled_font!("Rubik.ttf"),
            bundled_font!("BebasNeue-Regular.ttf"),
            bundled_font!("LexendDeca.ttf"),
            bundled_font!("SourceSerif4.ttf"),
            bundled_font!("Alata-Regular.ttf"),
            bundled_font!("ArchivoBlack-Regular.ttf"),
            bundled_font!("Bangers-Regular.ttf"),
            bundled_font!("CarterOne-Regular.ttf"),
            bundled_font!("DancingScript.ttf"),
            bundled_font!("FredokaOne-Regular.ttf"),
            bundled_font!("PaytoneOne-Regular.ttf"),
            bundled_font!("PermanentMarker-Regular.ttf"),
            bundled_font!("PressStart2P-Regular.ttf"),
            bundled_font!("VKSans-400.ttf"),
            bundled_font!("VKSans-500.ttf"),
            bundled_font!("VKSans-600.ttf"),
            bundled_font!("VKSans-700.ttf"),
            bundled_font!("VKSans-800.ttf"),
            bundled_font!("VKCode-400.ttf"),
            bundled_font!("VKCode-500.ttf"),
            bundled_font!("VKCode-600.ttf"),
            bundled_font!("VKCode-700.ttf"),
            bundled_font!("Inter-Medium.ttf"),
            bundled_font!("Poppins-Black.ttf"),
            bundled_font!("RobotoMono-Medium.ttf"),
            bundled_font!("PlayfairDisplay-Italic.ttf"),
            bundled_font!("Oswald-Bold.ttf"),
            bundled_font!("PlayfairDisplay-Regular.ttf"),
        ]
    })
}

/// App-only release mode: Electron's export worker reads the same sealed Web
/// assets as the file:// preview. Older native Apps use `Resources/fonts`.
#[cfg(feature = "external-fonts")]
pub fn external_bundled_font(name: &str) -> &'static [u8] {
    static FONTS: OnceLock<HashMap<String, Vec<u8>>> = OnceLock::new();
    let fonts = FONTS.get_or_init(|| {
        let executable = crate::exec::current_exe()
            .expect("bundled font lookup requires the current executable");
        let directory = app_fonts_dir(&executable)
            .expect("external-fonts requires an executable inside CucCut.app");
        load_external_fonts_at(&directory)
    });
    fonts
        .get(name)
        .unwrap_or_else(|| panic!("bundled font {name} is missing from the signed App"))
        .as_slice()
}

#[cfg(feature = "external-fonts")]
fn app_fonts_dir(executable: &std::path::Path) -> Option<std::path::PathBuf> {
    let parent = executable.parent()?;
    let (contents, fonts) = if parent.file_name()? == "MacOS" {
        (parent.parent()?, "Resources/fonts")
    } else {
        (parent.file_name()? == "bin").then_some(())?;
        let resources = parent.parent()?;
        (resources.file_name()? == "Resources").then_some(())?;
        (resources.parent()?, "Resources/web/assets")
    };
    (contents.file_name()? == "Contents").then_some(())?;
    (contents.parent()?.extension()? == "app").then_some(())?;
    Some(contents.join(fonts))
}

#[cfg(feature = "external-fonts")]
fn load_external_fonts_at(directory: &std::path::Path) -> HashMap<String, Vec<u8>> {
    let manifest = directory.join("bundled-fonts.json");
    if manifest.exists() {
        let names: HashMap<String, String> = serde_json::from_slice(
            &std::fs::read(&manifest).expect("cannot read bundled font manifest"),
        )
        .expect("invalid bundled font manifest");
        assert!(!names.is_empty(), "empty bundled font manifest");
        return names
            .into_iter()
            .map(|(name, file)| {
                assert!(
                    file.ends_with(".ttf") && !file.contains(['/', '\\']) && !file.starts_with('.'),
                    "bundled font manifest must reference a TTF filename"
                );
                let bytes = std::fs::read(directory.join(&file))
                    .unwrap_or_else(|error| panic!("cannot read bundled font {file}: {error}"));
                (name, bytes)
            })
            .collect();
    }
    let entries = std::fs::read_dir(directory).unwrap_or_else(|error| {
        panic!(
            "cannot read bundled fonts at {}: {error}",
            directory.display()
        )
    });
    let fonts: HashMap<String, Vec<u8>> = entries
        .map(|entry| entry.expect("cannot read bundled font entry").path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "ttf"))
        .map(|path| {
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            let bytes = std::fs::read(&path).unwrap_or_else(|error| {
                panic!("cannot read bundled font {}: {error}", path.display())
            });
            (name, bytes)
        })
        .collect();
    assert!(
        !fonts.is_empty(),
        "no TTF fonts in signed App at {}",
        directory.display()
    );
    fonts
}

/// The family name of the built-in CJK font. It is also the first choice when [`TextEngine`] resolves a fallback family.
pub const BUNDLED_CJK_FAMILY: &str = "Noto Sans SC";

/// Attaches the built-in CJK font to fontdb. Zero copy: `Source::Binary` takes `Arc<dyn AsRef<[u8]>>`, and this code wraps a `&'static [u8]`. Each `TextEngine` (frame rendering uses one per worker thread) adds only one Arc, not another 17 MB.
fn load_bundled_cjk_font(db: &mut fontdb::Database) {
    #[cfg(feature = "media")]
    {
        db.load_font_source(fontdb::Source::Binary(Arc::new(cjk_fallback_font())));
    }
    #[cfg(not(feature = "media"))]
    {
        let _ = db;
    }
}

/// Candidate order for the CJK fallback chain. The built-in font comes first, so it is the same on every machine. After it come the regular sans-serif CJK fonts that each platform ships. Last come the fonts with wider coverage, which catch rare characters.
///
/// This is a table in **fixed order**. It does not change with weight or with the character. The invariant this module must keep is exactly that. The same document on the same machine must pick the same chain of faces at any weight.
const CJK_FALLBACKS: &[&str] = &[
    BUNDLED_CJK_FAMILY,
    // macOS
    "PingFang SC",
    "Hiragino Sans GB",
    "Heiti SC",
    "Songti SC",
    // Windows
    "Microsoft YaHei",
    "SimHei",
    "SimSun",
    // Linux / generic
    "Noto Sans CJK SC",
    "Source Han Sans SC",
    "WenQuanYi Micro Hei",
];

fn family_in_db(db: &fontdb::Database, family: &str) -> bool {
    db.query(&fontdb::Query {
        families: &[Family::Name(family)],
        weight: Weight::NORMAL,
        stretch: Stretch::Normal,
        style: Style::Normal,
    })
    .is_some()
}

/// The CJK fallback chain this engine can actually use: the entries of [`CJK_FALLBACKS`] that this library really has installed.
///
/// Why a "chain" and not a single family: one family always has characters it cannot produce. Previously only one family was resolved here. When that family lacked a character, the character was handed back to cosmic-text, which looked it up per glyph. Its result **changed with weight**. Measured: in the same sentence "名字里有个𠮷字", the "𠮷" fell to PingFang SC at weight 400 and to YuKyokasho Yoko (a Japanese textbook-style face) at weight 700. One line could therefore mix in one or two glyphs from clearly different faces, and the mix changed with the weight and with the machine.
///
/// Our own code walks the chain in a fixed order. cosmic-text is left with only one fallback case: the whole chain lacks the character.
fn resolve_cjk_chain(db: &fontdb::Database) -> Vec<String> {
    CJK_FALLBACKS
        .iter()
        .filter(|family| family_in_db(db, family))
        .map(|family| (*family).to_owned())
        .collect()
}

/// The **concrete name** of the default sans-serif family.
///
/// `Family::SansSerif` is a pending intent. cosmic-text resolves it again for each weight, and the result is not stable. Measured on the same macOS machine: weight 400 and 700 resolved to Arial, while 500, 600, 650, 750, 800 and 900 resolved to System Font. So a page's 700 heading and 650 subheading landed on two completely different Latin fonts. Here the name is resolved **once** at assembly time. All weights then use this name, and weight only controls weight.
fn resolve_sans_family(db: &fontdb::Database) -> Option<String> {
    let name = db.family_name(&Family::SansSerif).to_owned();
    if family_in_db(db, &name) {
        return Some(name);
    }
    // fontdb's generic name can refer to an absent Arial on Linux. Resolve a
    // concrete Latin family before the CJK fallback gets a chance to take over.
    [
        "Arial",
        "DejaVu Sans",
        "Liberation Sans",
        "Noto Sans",
        "Arimo",
    ]
    .into_iter()
    .find(|family| family_in_db(db, family))
    .map(str::to_owned)
}

/// Character classes for typesetting.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Script {
    Cjk,
    /// Punctuation that both sides use. It follows its neighbors and does not pick a font itself (see [`resolve_scripts`]).
    Neutral,
    Other,
}

/// Punctuation common in Chinese body text that is not in the CJK Unicode blocks.
///
/// Curly quotes, dashes, ellipses and interpuncts appear everywhere in Chinese text. Latin families **also** have these glyphs. So when a font is picked by coverage, they always stay in the Latin family. In the sentence 「他说“这段时间很关键”——真的吗……」, the Han characters are Source Han Sans, but the quotes, dash and ellipsis are Arial, with widths and stroke shapes that do not line up with their neighbors. They should not pick a font themselves. They should follow the body text beside them.
fn is_neutral_punctuation(character: char) -> bool {
    matches!(
        character,
        '‘' | '’' | '“' | '”' | '—' | '―' | '…' | '·' | '‧'
    )
}

fn script_of(character: char) -> Script {
    if is_cjk_character(character) {
        Script::Cjk
    } else if is_neutral_punctuation(character) {
        Script::Neutral
    } else {
        Script::Other
    }
}

/// Classifies each character, and merges the neutral punctuation into the adjacent CJK run.
///
/// The rule has the same meaning as UAX #24 common-script resolution. A neutral character has no font preference of its own. Whichever side has a Han character takes that side's script. If neither side is Han (for example, the quotes in an English sentence), it stays as it is and still picks a font by coverage. So pure Latin text is typeset without changing a single byte.
fn resolve_scripts(text: &str) -> Vec<Script> {
    let mut scripts = text.chars().map(script_of).collect::<Vec<_>>();
    for index in 0..scripts.len() {
        if scripts[index] != Script::Neutral {
            continue;
        }
        let before = scripts[..index]
            .iter()
            .rev()
            .find(|script| **script != Script::Neutral);
        let after = scripts[index + 1..]
            .iter()
            .find(|script| **script != Script::Neutral);
        if before == Some(&Script::Cjk) || after == Some(&Script::Cjk) {
            scripts[index] = Script::Cjk;
        }
    }
    scripts
}

/// The `COLR` table tag. `swash::Tag` is `u32`, so it can be const-evaluated without an extra import.
const COLR_TAG: swash::Tag = u32::from_be_bytes(*b"COLR");

/// The weight-axis tag of a variable font.
const WGHT_TAG: swash::Tag = u32::from_be_bytes(*b"wght");

#[derive(Debug, Clone)]
pub struct ShapedGlyph {
    pub cache_key: CacheKey,
    /// x relative to the start of the line (px)
    pub x: f64,
    /// y offset relative to the baseline (px, usually 0)
    pub y: f64,
    /// The UTF-8 byte range in the source string (cosmic-text `LayoutGlyph.start..end`).
    ///
    /// Used only for mapping text parts (design §5.6). `ShapedGlyph` is not part of the DrawOp encoding and is not part of the `ShapeKey` cache key. Adding this field therefore has **zero pixel impact** on existing goldens. A ligature can span a part boundary. Its owner is the part that contains `cluster.start`.
    pub cluster: std::ops::Range<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct ShapedLine {
    pub width: f64,
    pub ascent: f64,
    pub descent: f64,
    pub glyphs: Vec<ShapedGlyph>,
}

/// The drawable form of one glyph.
///
/// Most glyphs are vector outlines. Color fonts must go through the color channel, and the tables that carry color differ by platform. macOS `Apple Color Emoji` uses `sbix` bitmaps. Its `glyf` table keeps only degenerate placeholder outlines (an isolated MoveTo plus Close). Windows `Segoe UI Emoji` uses `COLR`/`CPAL` layered outlines, and under the COLR spec its **base glyph has a non-empty monochrome fallback outline**. So "the outline has no fill area" cannot be the test for a color glyph. The only reliable split is by the face's color capability (see [`TextEngine::glyph_render`]).
#[derive(Debug, Clone)]
pub enum GlyphRender {
    /// An ordinary vector outline. It does not distort under any transform (camera zoom or pop scale).
    Outline(Path),
    /// The raster result of a color glyph: an `sbix` or `CBDT` bitmap, or a composite of `COLR` layered outlines. `left` and `top` are swash's placement: the offset of the bitmap's top-left corner from the glyph origin. `top` is positive with y pointing up, so drawing uses `translate(left, -top)`.
    ///
    /// Known limitation: a bitmap has a fixed pixel resolution. When `group_transform` scales it up, it is resampled and looks soft. Unlike outline glyphs, it cannot take part in stroking.
    ColorBitmap {
        width: u32,
        height: u32,
        rgba: Arc<[u8]>,
        left: i32,
        top: i32,
    },
    /// A blank glyph (a space), or a glyph with neither a fillable outline nor a color bitmap.
    Empty,
}

/// An alpha mask that swash produces at a discrete font-size step. `key` only identifies the face, glyph, size and subpixel bin within the current process's font system. It does not enter any persistent format or the DrawOp fingerprint.
#[derive(Debug, Clone)]
pub struct GlyphMaskImage {
    pub key: [u64; 2],
    pub width: u32,
    pub height: u32,
    pub left: i32,
    pub top: i32,
    pub alpha: Arc<[u8]>,
}

/// A premultiplied RGBA color glyph that swash produces at a discrete font-size step. It uses the same in-process key convention as [`GlyphMaskImage`], but its pixels are RGBA8 packed row by row.
#[derive(Debug, Clone)]
pub struct GlyphColorImage {
    pub key: [u64; 2],
    pub width: u32,
    pub height: u32,
    pub left: i32,
    pub top: i32,
    pub rgba: Arc<[u8]>,
}

/// The result of glyph atlas production. Ordinary outlines are alpha masks. Color glyphs keep premultiplied RGBA. The executor must not reduce the latter to a silhouette in the text color.
#[derive(Debug, Clone)]
pub enum GlyphAtlasRender {
    Mask(GlyphMaskImage),
    Color(GlyphColorImage),
    Empty,
    Unsupported,
}

/// A color bitmap glyph held in the cache.
#[derive(Debug, Clone)]
struct ColorGlyph {
    width: u32,
    height: u32,
    rgba: Arc<[u8]>,
    left: i32,
    top: i32,
}

#[derive(Debug, Clone)]
enum CachedGlyphMask {
    Mask(GlyphMaskImage),
    Empty,
    Unsupported,
}

/// Whether an outline can actually fill pixels. A color emoji's placeholder outline has only MoveTo and Close, and `get_outline_commands` still returns `Some`. So checking only for `None` is not enough.
fn path_has_area(path: &Path) -> bool {
    path.segments().any(|segment| {
        matches!(
            segment,
            PathSegment::LineTo(_) | PathSegment::QuadTo(_, _) | PathSegment::CubicTo(_, _, _)
        )
    })
}

#[derive(Clone, Hash, PartialEq, Eq)]
struct ShapeKey {
    text: String,
    family: String,
    size_bits: u64,
    weight: u16,
    italic: bool,
    spacing_bits: u64,
    rich: Vec<RichShapeSpan>,
}

#[derive(Clone, Hash, PartialEq, Eq)]
struct RichShapeSpan {
    start: usize,
    end: usize,
    family: String,
    size_bits: u64,
    weight: u16,
    italic: bool,
    spacing_bits: u64,
}

// ── Cache size limits ────────────────────────────────────────────────────
//
// The four existing caches were originally unbounded `HashMap`s. R2 adds atlas masks as well. In long video or multi-font exports, shaping, outlines, color bitmaps and masks must all have size limits. The budget model copies the frame cache in `core/crates/ccut-kernel/src/cmd/studio_export/render_plan.rs` (a 128MB VecDeque budget). The limit is set by **estimated bytes**, and when the budget is exceeded, least recently used entries are evicted. Eviction affects only performance, not correctness. The values in all five caches are deterministic results that can be recomputed to the same value. All of them are returned by value (large pixel blocks are shared through Arc), and no caller holds a borrow into an entry.
//
// Budget values (the five together come to about 105 MiB, still below the frame cache's 128 MB):

/// The result of single-line shaping. One subtitle line is about 1 KB (20 `ShapedGlyph`s plus the text). 16 MiB is about ten thousand distinct line and size combinations.
const SHAPE_CACHE_BUDGET: usize = 16 << 20;
/// A glyph outline, including the swash shadow (see [`HeapBytes for Path`](HeapBytes)). A CJK glyph is about 2 to 3 KB. 24 MiB is about ten thousand "glyph × size × subpixel phase" combinations.
const PATH_CACHE_BUDGET: usize = 24 << 20;
/// A color bitmap glyph. An emoji at 64 px is about 25 KB. 32 MiB is about 1,300 of them.
const BITMAP_CACHE_BUDGET: usize = 32 << 20;
/// The 8-bit mask source for the GPU atlas. An ordinary 64 px glyph is about 4 KB. 32 MiB is enough for thousands of `glyph × size × subpixel-bin` combinations. The atlas has its own fixed VRAM budget.
const MASK_CACHE_BUDGET: usize = 32 << 20;
/// The 8-bit mask source for stroked glyphs. It is limited separately from the ordinary masks. Turning on a stroke must not push out the hot set of the body-text atlas. It also must not quietly double the host-side residency by borrowing the body-text budget without accounting for it.
const STROKE_MASK_CACHE_BUDGET: usize = 32 << 20;
/// The per-face color capability gate. Each entry is just `ID + bool`, and the budget is in practice capped by the number of faces in fontdb. 1 MiB is about 20,000 faces. It is only a defensive upper bound.
const COLOR_FACE_CACHE_BUDGET: usize = 1 << 20;

/// Estimated container overhead per HashMap entry (hashbrown's control bytes plus load-factor headroom). It is only an order-of-magnitude estimate. Small entries such as `color_face_cache` are not counted as zero cost.
const CACHE_ENTRY_OVERHEAD: usize = 32;

/// The estimated heap bytes of a cache entry. It does not need to be exact, but it must be of the same order of magnitude as the real footprint. Otherwise the budget does nothing.
trait HeapBytes {
    fn heap_bytes(&self) -> usize;
}

impl HeapBytes for ShapeKey {
    fn heap_bytes(&self) -> usize {
        self.text.capacity()
            + self.family.capacity()
            + self.rich.capacity() * std::mem::size_of::<RichShapeSpan>()
            + self
                .rich
                .iter()
                .map(|span| span.family.capacity())
                .sum::<usize>()
    }
}

impl HeapBytes for CacheKey {
    fn heap_bytes(&self) -> usize {
        0 // All scalar fields
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct StrokeMaskKey {
    glyph: CacheKey,
    width_64: u32,
}

impl HeapBytes for StrokeMaskKey {
    fn heap_bytes(&self) -> usize {
        0
    }
}

impl HeapBytes for fontdb::ID {
    fn heap_bytes(&self) -> usize {
        0
    }
}

impl HeapBytes for bool {
    fn heap_bytes(&self) -> usize {
        0
    }
}

impl HeapBytes for ShapedLine {
    fn heap_bytes(&self) -> usize {
        self.glyphs.capacity() * std::mem::size_of::<ShapedGlyph>()
    }
}

impl HeapBytes for Path {
    /// Besides the tiny-skia copy, swash's `outline_command_cache` also keeps a shadow `Box<[zeno::Command]>` of the same glyph. It has one Command per verb, which is several times larger than the tiny-skia side's "1-byte verb plus 8-byte point". The two share a lifetime. [`TextEngine::glyph_path`] deletes the shadow together with the outline when evicting, so the pair is counted as one entry.
    fn heap_bytes(&self) -> usize {
        std::mem::size_of_val(self.verbs())
            + std::mem::size_of_val(self.points())
            + self.verbs().len() * std::mem::size_of::<swash::zeno::Command>()
    }
}

impl HeapBytes for ColorGlyph {
    fn heap_bytes(&self) -> usize {
        self.rgba.len()
    }
}

impl HeapBytes for GlyphMaskImage {
    fn heap_bytes(&self) -> usize {
        self.alpha.len()
    }
}

impl HeapBytes for CachedGlyphMask {
    fn heap_bytes(&self) -> usize {
        match self {
            Self::Mask(mask) => mask.heap_bytes(),
            Self::Empty | Self::Unsupported => 0,
        }
    }
}

impl<T: HeapBytes> HeapBytes for Option<T> {
    fn heap_bytes(&self) -> usize {
        self.as_ref().map_or(0, HeapBytes::heap_bytes)
    }
}

#[cfg(test)]
impl HeapBytes for u32 {
    fn heap_bytes(&self) -> usize {
        0
    }
}

#[cfg(test)]
impl HeapBytes for Vec<u8> {
    fn heap_bytes(&self) -> usize {
        self.capacity()
    }
}

struct CacheEntry<V> {
    value: V,
    bytes: usize,
    /// The logical time of the last hit. It uses a monotonic counter rather than wall-clock time. No value on the rendering path may depend on time.
    used: u64,
}

/// An LRU cache limited by byte budget.
struct BudgetCache<K, V> {
    entries: HashMap<K, CacheEntry<V>>,
    budget: usize,
    bytes: usize,
    clock: u64,
}

impl<K: Clone + std::hash::Hash + Eq + HeapBytes, V: HeapBytes> BudgetCache<K, V> {
    fn new(budget: usize) -> Self {
        BudgetCache {
            entries: HashMap::new(),
            budget,
            bytes: 0,
            clock: 0,
        }
    }

    fn get(&mut self, key: &K) -> Option<&V> {
        self.clock += 1;
        let clock = self.clock;
        let entry = self.entries.get_mut(key)?;
        entry.used = clock;
        Some(&entry.value)
    }

    /// Inserts an entry, evicts to the budget, and returns the evicted keys. The caller uses them to clean up shadow caches attached to the same key (currently only `swash.outline_command_cache`).
    fn insert(&mut self, key: K, value: V) -> Vec<K> {
        self.clock += 1;
        let bytes = CACHE_ENTRY_OVERHEAD
            + std::mem::size_of::<K>()
            + key.heap_bytes()
            + std::mem::size_of::<CacheEntry<V>>()
            + value.heap_bytes();
        let entry = CacheEntry {
            value,
            bytes,
            used: self.clock,
        };
        if let Some(old) = self.entries.insert(key, entry) {
            self.bytes -= old.bytes;
        }
        self.bytes += bytes;
        if self.bytes > self.budget {
            self.evict()
        } else {
            Vec::new()
        }
    }

    /// When over budget, evicts least recently used entries down to 3/4 of the budget. The gap between the two water levels spreads out the sorting cost. Otherwise the whole table would be sorted on every insert. If a single entry alone exceeds the budget, it is kept. Recomputing it would also exceed the budget, so evicting it would only cause a miss every time.
    fn evict(&mut self) -> Vec<K> {
        if self.entries.len() <= 1 {
            return Vec::new();
        }
        let low_water = self.budget / 4 * 3;
        let mut order = self
            .entries
            .iter()
            .map(|(key, entry)| (entry.used, key.clone()))
            .collect::<Vec<_>>();
        // `used` comes from a monotonic counter, so no two values are equal. The sort result is therefore unique, and eviction is deterministic.
        order.sort_unstable_by_key(|(used, _)| *used);
        let mut evicted = Vec::new();
        for (_, key) in order {
            if self.bytes <= low_water || self.entries.len() <= 1 {
                break;
            }
            if let Some(entry) = self.entries.remove(&key) {
                self.bytes -= entry.bytes;
                evicted.push(key);
            }
        }
        evicted
    }
}

/// A face named during typesetting: its family name, weight, and whether it is italic ([`TextEngine::set_face_log`]).
pub type FaceUse = (String, u16, bool);

/// The face record shared by several typesetting engines. The host uses it to find the one face in the machine's fonts that matches, using the same matching as typesetting.
pub type FaceLog = Arc<std::sync::Mutex<Vec<FaceUse>>>;

pub struct TextEngine {
    pub font_system: FontSystem,
    swash: SwashCache,
    shape_cache: BudgetCache<ShapeKey, ShapedLine>,
    path_cache: BudgetCache<CacheKey, Option<Path>>,
    /// The color bitmap glyph cache. The per-frame hot path must not redo premultiply and Pixmap allocation every frame.
    bitmap_cache: BudgetCache<CacheKey, Option<ColorGlyph>>,
    /// The alpha source of the discrete-size glyph atlas. On a hit, the swash rasterizer is not called.
    mask_cache: BudgetCache<CacheKey, CachedGlyphMask>,
    /// A centered stroke mask for one discrete size, bucketed by 1/64 px line width. Once produced, it enters the compositor atlas just like the body mask. It is not recomputed during subtitle entrance or per-word animation.
    stroke_mask_cache: BudgetCache<StrokeMaskKey, CachedGlyphMask>,
    /// The per-face color capability gate. A monochrome font must never be rasterized one extra time per glyph.
    color_face_cache: BudgetCache<fontdb::ID, bool>,
    /// Strict mode for document fonts. fontdb contains only the fonts the document declares, with no system fallback (§8.4 determinism).
    pub strict: bool,
    /// The CJK fallback chain this engine uses for typesetting. It is **looked up** in fontdb at assembly time ([`resolve_cjk_chain`]), not taken from hard-coded names. Empty means this library has no CJK family at all.
    cjk_chain: Vec<String>,
    /// The concrete name resolved from the default sans-serif family ([`resolve_sans_family`]).
    sans_family: Option<String>,
    /// A family named during typesetting that the library does not have, so the text fell back to a fallback font. The host uses it to look for font files and to report missing fonts.
    missing_families: std::collections::BTreeSet<String>,
    /// Memory of whether a family is in the library. Typesetting is a hot path, so fontdb is not queried every time.
    family_present: HashMap<String, bool>,
    /// Faces named during typesetting are recorded here. The host installs this. If it is not installed, nothing is recorded.
    face_log: Option<FaceLog>,
}

impl TextEngine {
    /// System fonts plus the built-in CJK fallback.
    ///
    /// The built-in font must be attached here. BCF rendering (`ccut render`) takes this path. It used to have only a pure system fontdb, so Chinese characters fell glyph by glyph into whatever fonts happened to be installed on the machine (see [`resolve_cjk_family`]).
    pub fn new() -> Self {
        let mut db = system_font_db().clone();
        load_bundled_cjk_font(&mut db);
        Self::with_font_system(
            FontSystem::new_with_locale_and_db("en-US".to_owned(), db),
            false,
        )
    }

    /// The shared tail of the three public constructors. It sets up the five size-limited caches.
    fn with_font_system(font_system: FontSystem, strict: bool) -> Self {
        let cjk_chain = resolve_cjk_chain(font_system.db());
        let sans_family = resolve_sans_family(font_system.db());
        TextEngine {
            font_system,
            swash: SwashCache::new(),
            shape_cache: BudgetCache::new(SHAPE_CACHE_BUDGET),
            path_cache: BudgetCache::new(PATH_CACHE_BUDGET),
            bitmap_cache: BudgetCache::new(BITMAP_CACHE_BUDGET),
            mask_cache: BudgetCache::new(MASK_CACHE_BUDGET),
            stroke_mask_cache: BudgetCache::new(STROKE_MASK_CACHE_BUDGET),
            color_face_cache: BudgetCache::new(COLOR_FACE_CACHE_BUDGET),
            strict,
            cjk_chain,
            sans_family,
            missing_families: Default::default(),
            family_present: HashMap::new(),
            face_log: None,
        }
    }

    /// Injects document font assets (assets type:"font"). A non-empty set means strict mode. fontdb holds only the bundled fonts and the locale is fixed, so metrics are bit-identical on any machine (the opencat engine_font_db_with_document_fonts pattern).
    pub fn with_document_fonts(fonts: &[Vec<u8>]) -> Self {
        let shared: Vec<Arc<Vec<u8>>> = fonts.iter().map(|bytes| Arc::new(bytes.clone())).collect();
        Self::with_shared_document_fonts(&shared)
    }

    /// [`Self::with_document_fonts`], with the font bytes shared. Several engines built from the same batch of fonts each take up only one copy in memory. A large font set can run to tens of MB.
    pub fn with_shared_document_fonts(fonts: &[Arc<Vec<u8>>]) -> Self {
        if fonts.is_empty() {
            return Self::new();
        }
        let mut db = cosmic_text::fontdb::Database::new();
        for bytes in fonts {
            db.load_font_source(fontdb::Source::Binary(bytes.clone()));
        }
        // The default sans-serif family goes to the first **document** font. This is the deterministic fallback when the family is not matched. It must be taken before the built-in CJK is attached, otherwise this slot would be taken by the fallback font.
        let first_family = db
            .faces()
            .next()
            .and_then(|f| f.families.first().map(|(name, _)| name.clone()));
        if let Some(fam) = first_family {
            db.set_sans_serif_family(fam);
        }
        // The built-in CJK fallback also goes into the strict library. It is **fixed bytes** and reproducible bit for bit, so it does not break the determinism of §8.4. What is forbidden is "whatever happens to be installed on the machine". Without this, a BCF document that declares a Latin display font would render Chinese only as tofu boxes.
        load_bundled_cjk_font(&mut db);
        Self::with_font_system(
            FontSystem::new_with_locale_and_db("en-US".to_string(), db),
            true,
        )
    }

    /// BCF document rendering. On top of [`Self::with_document_fonts`], CucCut's built-in display font families ([`bundled_display_fonts`]) are always available by name. A document can therefore write `font: "Permanent Marker"` without declaring a `font` asset. Like the built-in CJK font, they are fixed bytes, so bit-for-bit reproducibility in strict mode is not affected. They are attached after the document fonts and system fonts, and if names clash, the one attached first wins. The default sans-serif family and the CJK fallback chain are unchanged. The subtitle injected-font entry still goes through [`Self::with_document_fonts`] and does not get this set.
    pub fn for_document(fonts: &[Vec<u8>]) -> Self {
        #[allow(unused_mut)]
        let mut engine = Self::with_document_fonts(fonts);
        #[cfg(feature = "media")]
        for bytes in bundled_display_fonts() {
            engine
                .font_system
                .db_mut()
                .load_font_source(fontdb::Source::Binary(Arc::new(*bytes)));
        }
        engine
    }

    /// Host fonts plus App and user fonts. Unlike strict BCF document fonts, product subtitles may explicitly choose a font installed on the current machine. They may also use a font the user imported into the CucCut font library. The bundled fonts still cover the default sans-serif fallback, so unknown fonts do not fall to random platform defaults.
    pub fn with_system_and_fonts(fonts: &[Vec<u8>]) -> Self {
        let db = system_font_db().clone();
        Self::with_font_db_and_fonts(db, fonts)
    }

    fn with_font_db_and_fonts(mut db: fontdb::Database, fonts: &[Vec<u8>]) -> Self {
        // The built-in CJK fallback is attached at the front, as if it were a "system font". Like the real system faces, it must go through the shadow removal below. When the user has imported their own Noto Sans SC, the removed copies must include this one too. Otherwise the copy attached first (the built-in one) would win over the copy the user explicitly chose.
        load_bundled_cjk_font(&mut db);
        // Fonts managed by App and CucCut must override fonts with the same name. FontLibrary lets the user import a family that the system already has, and it makes the imported copy the chosen result. fontdb uses the first-attached face among candidates of the same weight. So the conflicting system face is removed first, and then the managed font is attached.
        let mut managed = fontdb::Database::new();
        for bytes in fonts {
            managed.load_font_data(bytes.clone());
        }
        let managed_families = managed
            .faces()
            .flat_map(|face| face.families.iter().map(|(name, _)| name.clone()))
            .collect::<HashSet<_>>();
        let shadowed_system_faces = db
            .faces()
            .filter(|face| {
                face.families
                    .iter()
                    .any(|(name, _)| managed_families.contains(name))
            })
            .map(|face| face.id)
            .collect::<Vec<_>>();
        for id in shadowed_system_faces {
            db.remove_face(id);
        }
        for bytes in fonts {
            db.load_font_data(bytes.clone());
        }
        if db
            .query(&fontdb::Query {
                families: &[Family::Name(BUNDLED_CJK_FAMILY)],
                weight: Weight::NORMAL,
                stretch: Stretch::Normal,
                style: Style::Normal,
            })
            .is_some()
        {
            db.set_sans_serif_family(BUNDLED_CJK_FAMILY);
        }
        Self::with_font_system(
            FontSystem::new_with_locale_and_db("en-US".to_string(), db),
            false,
        )
    }

    /// Checks whether a named font family actually exists. Product export uses this to report missing fonts before shaping. That way the font engine's deterministic sans fallback does not disguise an error as success.
    pub fn has_family(&self, family: &str) -> bool {
        if family.is_empty() {
            return true;
        }
        self.font_system
            .db()
            .query(&fontdb::Query {
                families: &[Family::Name(family)],
                weight: Weight::NORMAL,
                stretch: Stretch::Normal,
                style: Style::Normal,
            })
            .is_some()
    }

    /// Attaches face records. Afterwards, families named during typesetting are recorded together with weight and italic (deduplicated). Several engines can share one set.
    pub fn set_face_log(&mut self, log: Option<FaceLog>) {
        self.face_log = log;
    }

    /// Records families named during typesetting. If the library does not have a family, it goes into [`Self::take_missing_families`]. When face records are attached, the family is recorded together with weight and italic. It is recorded only during real typesetting. Probes by [`Self::has_family`] while trying candidate chains do not count. An empty family name is the default sans-serif family, and it does not count.
    fn note_family(&mut self, family: &str, weight: u16, italic: bool) {
        if family.is_empty() {
            return;
        }
        if let Some(log) = &self.face_log {
            let mut log = log.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
            if !log
                .iter()
                .any(|(f, w, i)| f == family && *w == weight && *i == italic)
            {
                log.push((family.to_owned(), weight, italic));
            }
        }
        let present = match self.family_present.get(family) {
            Some(present) => *present,
            None => {
                let present = self.has_family(family);
                self.family_present.insert(family.to_owned(), present);
                present
            }
        };
        if !present && !self.missing_families.contains(family) {
            self.missing_families.insert(family.to_owned());
        }
    }

    /// The missing families named during typesetting since the last take, sorted by name.
    pub fn take_missing_families(&mut self) -> Vec<String> {
        std::mem::take(&mut self.missing_families)
            .into_iter()
            .collect()
    }

    /// Single-line shaping, with no line wrapping. It matches the original prototype's CTLine semantics. An empty family means the default sans-serif family.
    pub fn shape(&mut self, text: &str, family: &str, font_size: f64, weight: u16) -> ShapedLine {
        self.shape_styled(text, family, font_size, weight, false)
    }

    /// [`TextEngine::shape`] plus `fontStyle` (spec §6.3). With `italic`, the italic face within the family is chosen by CSS rules. fontdb uses `Style::Italic`. If there is no true italic, fontdb falls back to Oblique, then to upright. There is no artificial slanting. The source of the glyphs must be deterministic.
    pub fn shape_styled(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        italic: bool,
    ) -> ShapedLine {
        self.shape_spaced(text, family, font_size, weight, italic, 0.0)
    }

    pub fn shape_spaced(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        italic: bool,
        spacing: f64,
    ) -> ShapedLine {
        self.note_family(family, weight, italic);
        let key = ShapeKey {
            text: text.to_string(),
            family: family.to_string(),
            size_bits: font_size.to_bits(),
            weight,
            italic,
            spacing_bits: spacing.to_bits(),
            rich: Vec::new(),
        };
        if let Some(s) = self.shape_cache.get(&key) {
            return s.clone();
        }
        let line = self.shape_uncached(text, family, font_size, weight, italic, spacing);
        self.shape_cache.insert(key, line.clone());
        line
    }

    /// Shape one final line with attributed font spans. Colour remains a paint
    /// attribute, so it cannot split a kerning pair or ligature during shaping.
    pub fn shape_rich(
        &mut self,
        text: &str,
        range: std::ops::Range<usize>,
        base: scene_primitives::text_layout::FontStyle<'_>,
        runs: &[scene_primitives::text_layout::Run],
    ) -> ShapedLine {
        if runs.is_empty() {
            let mut out = self.shape_spaced(
                &text[range.clone()],
                base.family,
                base.size,
                base.weight,
                base.italic,
                base.spacing,
            );
            for glyph in &mut out.glyphs {
                glyph.cluster.start += range.start;
                glyph.cluster.end += range.start;
            }
            return out;
        }
        let mut spans = Vec::new();
        for (part, font) in scene_primitives::text_layout::font_runs(base, runs, range.clone()) {
            self.note_family(font.family, font.weight, font.italic);
            for (family, weight, subrange) in
                self.plan_runs(&text[part.clone()], font.family, font.weight, font.italic)
            {
                spans.push(RichShapeSpan {
                    start: part.start + subrange.start - range.start,
                    end: part.start + subrange.end - range.start,
                    family,
                    size_bits: font.size.to_bits(),
                    weight,
                    italic: font.italic,
                    spacing_bits: font.spacing.to_bits(),
                });
            }
        }
        let key = ShapeKey {
            text: text[range.clone()].to_owned(),
            family: String::new(),
            size_bits: 0,
            weight: 0,
            italic: false,
            spacing_bits: 0,
            rich: spans,
        };
        let mut out = if let Some(hit) = self.shape_cache.get(&key) {
            hit.clone()
        } else {
            let mut buffer = Buffer::new(
                &mut self.font_system,
                Metrics::new(base.size as f32, (base.size * 1.25) as f32),
            );
            buffer.set_size(None, None);
            let default_attrs = Attrs::new();
            buffer.set_rich_text(
                key.rich.iter().map(|span| {
                    let size = f64::from_bits(span.size_bits);
                    let spacing = f64::from_bits(span.spacing_bits);
                    let attrs = Attrs::new()
                        .family(Family::Name(&span.family))
                        .weight(Weight(span.weight))
                        .style(font_style(span.italic))
                        .metrics(Metrics::new(size as f32, (size * 1.25) as f32));
                    let attrs = if spacing == 0.0 {
                        attrs
                    } else {
                        attrs.letter_spacing((spacing / size) as f32)
                    };
                    (&key.text[span.start..span.end], attrs)
                }),
                &default_attrs,
                Shaping::Advanced,
                None,
            );
            buffer.shape_until_scroll(&mut self.font_system, false);
            let mut line = ShapedLine::default();
            if let Some(run) = buffer.layout_runs().next() {
                line.width = run.line_w as f64;
                for glyph in run.glyphs {
                    let key = glyph.physical((0.0, 0.0), 1.0).cache_key;
                    line.glyphs.push(ShapedGlyph {
                        cache_key: key,
                        x: glyph.x as f64,
                        y: (glyph.y + glyph.y_offset) as f64,
                        cluster: glyph.start..glyph.end,
                    });
                    if let Some(font) = self.font_system.get_font(glyph.font_id, glyph.font_weight)
                    {
                        let metrics = font.as_swash().metrics(&[]);
                        let scale = f64::from(glyph.font_size) / f64::from(metrics.units_per_em);
                        line.ascent = line.ascent.max(f64::from(metrics.ascent) * scale);
                        line.descent = line.descent.max(f64::from(metrics.descent) * scale);
                    }
                }
            }
            self.shape_cache.insert(key, line.clone());
            line
        };
        for glyph in &mut out.glyphs {
            glyph.cluster.start += range.start;
            glyph.cluster.end += range.start;
        }
        out
    }

    /// The current estimated byte usage of the six size-limited caches: shaping, outlines, color bitmaps, atlas masks, stroke masks, and the color capability gates. It serves only tests and diagnostics.
    #[cfg(test)]
    fn cache_bytes(&self) -> (usize, usize, usize, usize, usize, usize) {
        (
            self.shape_cache.bytes,
            self.path_cache.bytes,
            self.bitmap_cache.bytes,
            self.mask_cache.bytes,
            self.stroke_mask_cache.bytes,
            self.color_face_cache.bytes,
        )
    }

    fn shape_uncached(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        italic: bool,
        spacing: f64,
    ) -> ShapedLine {
        let runs = self.plan_runs(text, family, weight, italic);
        if let [(only, only_weight, _)] = runs.as_slice() {
            // The common case: the whole string is one family. Take the original path, so spacing and ligatures are all kept.
            return self.shape_family_uncached(
                text,
                only,
                font_size,
                *only_weight,
                italic,
                spacing,
            );
        }
        let mut output = ShapedLine::default();
        for (run_family, run_weight, range) in runs {
            let start = range.start;
            append_shaped_segment(
                &mut output,
                self.shape_family_uncached(
                    &text[range],
                    &run_family,
                    font_size,
                    run_weight,
                    italic,
                    spacing,
                ),
                start,
            );
        }
        output
    }

    /// The face that a family **actually uses** at this weight, and the weight to shape with.
    ///
    /// cosmic-text accepts a candidate face only if its `usWeightClass` is **exactly equal** to the requested weight, or if it is a variable font that covers that weight (see its `FontFallbackIter`). Being off by even a little does not count. Arial has only the 400 and 700 weights. At a requested 650, it fails the test for every face. The whole family is then skipped and falls to cosmic-text's own system fallback, which measured as System Font. This is how a page's 700 heading came out as Arial and its 650 subheading as System Font.
    ///
    /// So the face is first chosen within the family by CSS rules (fontdb's `query`). Then the weight is **clamped to a value that this face can pass the test with**. Variable fonts keep the requested weight. Static fonts use their own weight. The family is the name the author picked, so the weight should yield inside the family rather than replace the whole family.
    fn resolve_face(
        &mut self,
        family: &str,
        weight: u16,
        italic: bool,
    ) -> Option<(Arc<cosmic_text::Font>, u16)> {
        if family.is_empty() {
            return None;
        }
        let id = self.font_system.db().query(&fontdb::Query {
            families: &[Family::Name(family)],
            weight: Weight(weight),
            stretch: Stretch::Normal,
            style: font_style(italic),
        })?;
        let face_weight = self.font_system.db().face(id).map(|face| face.weight.0)?;
        let font = self.font_system.get_font(id, fontdb::Weight(weight))?;
        let covers_weight = face_weight == weight
            || font
                .as_swash()
                .variations()
                .find(|axis| axis.tag() == WGHT_TAG)
                .is_some_and(|axis| {
                    let wanted = f32::from(weight);
                    wanted >= axis.min_value() && wanted <= axis.max_value()
                });
        Some((font, if covers_weight { weight } else { face_weight }))
    }

    /// Splits a line of text into segments of "family → byte range". **We decide where to cut.**
    ///
    /// There is one rule for choosing a family. The candidate chain `[author-named family, …CJK fallback chain]` is searched from the head, and the first family that really has the character is taken. This guarantees three things at once:
    ///
    /// * The author-named family has the final say. It sits at the head of the chain. As long as it can produce the character, the fallback never gets a turn. When BCF writes `fontFamily: "Songti SC"`, the Chinese stays in Songti and is not overridden by the built-in sans-serif.
    /// * When the main font lacks a character, the whole segment uses the **same** fallback font, and it stays the same across weights. This step used to be left to cosmic-text, which gave different answers for different weights (see [`resolve_cjk_chain`]).
    /// * Neutral punctuation follows its neighbors (see [`resolve_scripts`]). It does not stay alone in a Latin family inside a Chinese line.
    ///
    /// The returned adjacent segments are guaranteed to have different families. When the whole string is one family, there is only one segment, and the caller takes the fast path with no split.
    fn plan_runs(
        &mut self,
        text: &str,
        family: &str,
        weight: u16,
        italic: bool,
    ) -> Vec<(String, u16, std::ops::Range<usize>)> {
        // Pin the default sans-serif family to a concrete name here, so it is not resolved again for each weight.
        let primary = if family.is_empty() {
            self.sans_family.clone().unwrap_or_default()
        } else {
            family.to_owned()
        };
        let mut chain = vec![primary.clone()];
        chain.extend(
            self.cjk_chain
                .iter()
                .filter(|name| **name != primary)
                .cloned(),
        );
        // Coverage checks read the font tables. First, fetch all faces on the chain together with their adjusted weights. After that, only the cmap is queried.
        let resolved = chain
            .iter()
            .map(|name| self.resolve_face(name, weight, italic))
            .collect::<Vec<_>>();
        let covers = |index: usize, character: char| {
            resolved[index]
                .as_ref()
                .is_some_and(|(font, _)| font.as_swash().charmap().map(character) != 0)
        };
        // Characters that no face in the chain can produce (rare characters missing from the whole chain, and emoji) are left to cosmic-text. It still has the system fallback, and this choice does not depend on weight, so it stays deterministic.
        let pick = |character: char| {
            (0..chain.len())
                .find(|i| covers(*i, character))
                .unwrap_or(0)
        };

        let characters = text.chars().collect::<Vec<_>>();
        let scripts = resolve_scripts(text);
        // First pass: characters whose family this code can choose are assigned first. Neutral punctuation that has been merged into a CJK run is left empty and waits for its neighbors.
        let follows_neighbour = |index: usize| {
            scripts[index] == Script::Cjk && is_neutral_punctuation(characters[index])
        };
        let mut chosen = characters
            .iter()
            .enumerate()
            .map(|(index, character)| (!follows_neighbour(index)).then(|| pick(*character)))
            .collect::<Vec<_>>();
        // Second pass: the empty ones look for the nearest Han character. They search backward first, and if there is none, forward. The character found must be a Han character itself, not just any segment. Otherwise the quotes in “A‘中’” would follow the Latin family of A.
        let nearest_han = |chosen: &[Option<usize>], index: usize| {
            (0..index)
                .rev()
                .chain(index + 1..chosen.len())
                .find(|probe| scripts[*probe] == Script::Cjk && chosen[*probe].is_some())
                .and_then(|probe| chosen[probe])
        };
        for index in 0..chosen.len() {
            if chosen[index].is_none() {
                // If there are no Han characters before or after, `resolve_scripts` does not classify the text as CJK. This fallback is only defensive.
                chosen[index] =
                    Some(nearest_han(&chosen, index).unwrap_or_else(|| pick(characters[index])));
            }
        }

        let mut runs: Vec<(String, u16, std::ops::Range<usize>)> = Vec::new();
        for ((offset, character), index) in text.char_indices().zip(chosen) {
            let end = offset + character.len_utf8();
            let index = index.unwrap_or(0);
            let name = &chain[index];
            // If no face can be found for a family on the chain (possible only for an empty family name at index 0), the original weight is kept. That lets cosmic-text take its old `Family::SansSerif` path.
            let run_weight = resolved[index].as_ref().map_or(weight, |(_, w)| *w);
            match runs.last_mut() {
                Some((last, last_weight, range)) if last == name && *last_weight == run_weight => {
                    range.end = end
                }
                _ => runs.push((name.clone(), run_weight, offset..end)),
            }
        }
        if runs.is_empty() {
            runs.push((primary, weight, 0..text.len()));
        }
        runs
    }

    fn shape_family_uncached(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        italic: bool,
        spacing: f64,
    ) -> ShapedLine {
        if text.is_empty() {
            return ShapedLine::default();
        }
        let fs = font_size as f32;
        let mut buffer = Buffer::new(
            &mut self.font_system,
            Metrics::new(fs, (font_size * 1.25) as f32),
        );
        buffer.set_size(None, None);
        let fam = if family.is_empty() {
            Family::SansSerif
        } else {
            Family::Name(family)
        };
        let attrs = Attrs::new()
            .weight(Weight(weight))
            .style(font_style(italic))
            .family(fam);
        let attrs = if spacing == 0.0 {
            attrs
        } else {
            attrs.letter_spacing((spacing / font_size) as f32)
        };
        buffer.set_text(text, &attrs, Shaping::Advanced, None);
        buffer.shape_until_scroll(&mut self.font_system, false);

        let mut out = ShapedLine::default();
        let mut primary_font = None;
        // Kept as in v2. Newer clippy sets `never_loop` to deny, so this only allows it. The code itself is unchanged.
        #[allow(clippy::never_loop)]
        for run in buffer.layout_runs() {
            out.width = run.line_w as f64;
            for g in run.glyphs {
                if primary_font.is_none() {
                    primary_font = Some(g.font_id);
                }
                let phys = g.physical((0.0, 0.0), 1.0);
                out.glyphs.push(ShapedGlyph {
                    cache_key: phys.cache_key,
                    x: g.x as f64,
                    y: g.y as f64 + g.y_offset as f64,
                    cluster: g.start..g.end,
                });
            }
            break; // Single line
        }
        // Font metrics (ascent and descent), taken from the font of the first glyph
        if let Some(fid) = primary_font {
            if let Some(font) = self
                .font_system
                .get_font(fid, cosmic_text::fontdb::Weight(weight))
            {
                let m = font.as_swash().metrics(&[]);
                let scale = font_size / m.units_per_em as f64;
                out.ascent = m.ascent as f64 * scale;
                out.descent = m.descent as f64 * scale;
            }
        }
        if out.ascent == 0.0 {
            out.ascent = font_size * 0.8;
            out.descent = font_size * 0.2;
        }
        out
    }

    /// Glyph outline to tiny-skia Path. Origin is the left end of the baseline. Y is positive downward.
    pub fn glyph_path(&mut self, key: CacheKey) -> Option<Path> {
        if let Some(p) = self.path_cache.get(&key) {
            return p.clone();
        }
        let path = self
            .swash
            .get_outline_commands(&mut self.font_system, key)
            .and_then(|cmds| {
                let mut pb = PathBuilder::new();
                for cmd in cmds {
                    use swash::zeno::Command;
                    match cmd {
                        Command::MoveTo(p) => pb.move_to(p.x, -p.y),
                        Command::LineTo(p) => pb.line_to(p.x, -p.y),
                        Command::QuadTo(c, p) => pb.quad_to(c.x, -c.y, p.x, -p.y),
                        Command::CurveTo(c1, c2, p) => {
                            pb.cubic_to(c1.x, -c1.y, c2.x, -c2.y, p.x, -p.y)
                        }
                        Command::Close => pb.close(),
                    }
                }
                pb.finish()
            });
        // The outline also has a copy in swash's `outline_command_cache`. It uses the same `CacheKey`, and it is larger than this side. If this side is evicted but that copy is kept, the size limit only controls the small part.
        for evicted in self.path_cache.insert(key, path.clone()) {
            self.swash.outline_command_cache.remove(&evicted);
        }
        path
    }

    /// The drawable form of a glyph. It branches on the **face's color capability**. A color face tries the color channel first. If that gives no color result, it falls back to the vector outline.
    ///
    /// The test cannot be "the outline has no fill area". That holds only for `sbix` and `CBDT` bitmap fonts. Apple Color Emoji's `glyf` is a zero-area placeholder. `COLR`/`CPAL` fonts (such as Windows `Segoe UI Emoji`) have, under the spec, a **non-empty** monochrome fallback outline on the base glyph. An area test would misclassify it as an ordinary outline, and it would be drawn as a single-color silhouette in the subtitle's text color.
    ///
    /// A color candidate must still be able to fall back to outlines. COLRv1-only fonts pass the table-existence gate, but swash's v0 `layers()` cannot get their layers. The ordinary glyphs inside color faces are handled the same way.
    ///
    /// The return semantics of [`glyph_path`](Self::glyph_path) are kept deliberately unchanged. BCF `renderer.rs` records DrawOps that depend on its deterministic output. BCF color glyphs go through [`color_glyph`](Self::color_glyph) and do not pass through here.
    pub fn glyph_render(&mut self, key: CacheKey) -> GlyphRender {
        if self.face_has_color(key) {
            if let Some(glyph) = self.color_bitmap(key) {
                return GlyphRender::ColorBitmap {
                    width: glyph.width,
                    height: glyph.height,
                    rgba: glyph.rgba,
                    left: glyph.left,
                    top: glyph.top,
                };
            }
        }
        match self.glyph_path(key) {
            Some(path) if path_has_area(&path) => GlyphRender::Outline(path),
            _ => GlyphRender::Empty,
        }
    }

    /// The color channel of the BCF recorder. When the face is a color face and a color raster result can be obtained, it returns premultiplied RGBA rasterized at `font size × oversample`. Otherwise it returns `None`, and the caller uses [`glyph_path`](Self::glyph_path) as before. This keeps the instruction stream and fingerprint of monochrome glyphs byte-for-byte unchanged. ([`glyph_render`](Self::glyph_render) reports zero-area outlines as `Empty`. Branching on that would make glyphs such as spaces disappear from the existing instruction stream.)
    ///
    /// * `oversample`: when the view is magnified (camera zoom or pop scale), extra pixels are produced. swash picks the nearest bitmap strike (`sbix` / `CBDT`) for the requested size and then scales it. `COLR` is rasterized directly at the size.
    /// * The subpixel bin is set to zero. The `glyph.x` given by shaping already includes the fractional part, and the recorder translates by it. If swash also offset by `x_bin`, the translation would be applied twice. Zeroing also means each glyph is rasterized only once.
    ///
    /// The returned `left` and `top` are the placement **at the raster size** (same convention as `GlyphRender`, with `top` positive when y points up). The caller divides them by `oversample`.
    pub fn color_glyph(&mut self, key: CacheKey, oversample: f32) -> Option<GlyphColorImage> {
        if !self.face_has_color(key) {
            return None;
        }
        let size = f32::from_bits(key.font_size_bits) * oversample;
        if !size.is_finite() || size <= 0.0 {
            return None;
        }
        let key = CacheKey {
            font_size_bits: size.to_bits(),
            x_bin: SubpixelBin::Zero,
            y_bin: SubpixelBin::Zero,
            ..key
        };
        let glyph = self.color_bitmap(key)?;
        Some(GlyphColorImage {
            key: runtime_glyph_key(&key),
            width: glyph.width,
            height: glyph.height,
            left: glyph.left,
            top: glyph.top,
            rgba: glyph.rgba,
        })
    }

    /// Converts a glyph at a discrete size into an atlas image. Ordinary outlines become alpha masks. Color glyphs become premultiplied RGBA. Both kinds of result are cached under the full `CacheKey`, with size limits. Per-word animation only changes the quad's pose and color, so it does not trigger swash rasterization again.
    pub fn glyph_atlas_render(&mut self, key: CacheKey) -> GlyphAtlasRender {
        if self.face_has_color(key)
            && let Some(glyph) = self.color_bitmap(key)
        {
            return GlyphAtlasRender::Color(GlyphColorImage {
                key: runtime_glyph_key(&key),
                width: glyph.width,
                height: glyph.height,
                left: glyph.left,
                top: glyph.top,
                rgba: glyph.rgba,
            });
        }
        if let Some(cached) = self.mask_cache.get(&key) {
            return cached.clone().into();
        }
        let mask = self.rasterize_glyph_mask(key);
        self.mask_cache.insert(key, mask.clone());
        mask.into()
    }

    /// The glyph outline is turned into an R8 atlas mask at the centered line width used by the CPU reference's tiny-skia. `width` is the full stroke width, not the visible outset radius. It is bucketed at 1/64 px, so floating-point differences cannot expand the same visual width into unbounded cache keys.
    pub fn glyph_stroke_atlas_render(&mut self, key: CacheKey, width: f32) -> GlyphAtlasRender {
        if self.face_has_color(key) && self.color_bitmap(key).is_some() {
            return GlyphAtlasRender::Empty;
        }
        if !width.is_finite() || width <= 0.0 {
            return GlyphAtlasRender::Empty;
        }
        let width_64 = (width * 64.0).round().clamp(1.0, u32::MAX as f32) as u32;
        let cache_key = StrokeMaskKey {
            glyph: key,
            width_64,
        };
        if let Some(cached) = self.stroke_mask_cache.get(&cache_key) {
            return cached.clone().into();
        }
        let mask = self.rasterize_glyph_stroke(cache_key);
        self.stroke_mask_cache.insert(cache_key, mask.clone());
        mask.into()
    }

    fn rasterize_glyph_stroke(&mut self, key: StrokeMaskKey) -> CachedGlyphMask {
        let Some(path) = self.glyph_path(key.glyph) else {
            return CachedGlyphMask::Empty;
        };
        let width = key.width_64 as f32 / 64.0;
        let bounds = path.bounds();
        // tiny-skia's anti-aliased edges reach slightly less than 1 px beyond the geometric bounding box. An extra 1 px is reserved so the atlas mask is not clipped. Coordinates are still based on the glyph's baseline origin.
        let expansion = width * 0.5 + 1.0;
        let left = (bounds.left() - expansion).floor();
        let top = (bounds.top() - expansion).floor();
        let right = (bounds.right() + expansion).ceil();
        let bottom = (bounds.bottom() + expansion).ceil();
        let Some(mask_width) = positive_extent(right - left) else {
            return CachedGlyphMask::Empty;
        };
        let Some(mask_height) = positive_extent(bottom - top) else {
            return CachedGlyphMask::Empty;
        };
        let Some(mut pixmap) = Pixmap::new(mask_width, mask_height) else {
            return CachedGlyphMask::Unsupported;
        };
        let mut paint = Paint::default();
        paint.set_color_rgba8(255, 255, 255, 255);
        paint.anti_alias = true;
        let stroke = Stroke {
            width,
            ..Stroke::default()
        };
        pixmap.stroke_path(
            &path,
            &paint,
            &stroke,
            Transform::from_translate(-left, -top),
            None,
        );
        let alpha = pixmap
            .data()
            .chunks_exact(4)
            .map(|pixel| pixel[3])
            .collect::<Vec<_>>();
        if alpha.iter().all(|value| *value == 0) {
            return CachedGlyphMask::Empty;
        }
        CachedGlyphMask::Mask(GlyphMaskImage {
            key: runtime_glyph_key(&key),
            width: mask_width,
            height: mask_height,
            left: left as i32,
            top: -(top as i32),
            alpha: alpha.into(),
        })
    }

    fn rasterize_glyph_mask(&mut self, key: CacheKey) -> CachedGlyphMask {
        let Some(image) = self.swash.get_image_uncached(&mut self.font_system, key) else {
            return if self
                .glyph_path(key)
                .is_some_and(|path| path_has_area(&path))
            {
                CachedGlyphMask::Unsupported
            } else {
                CachedGlyphMask::Empty
            };
        };
        if image.content != SwashContent::Mask {
            return CachedGlyphMask::Unsupported;
        }
        let (width, height) = (image.placement.width, image.placement.height);
        if width == 0 || height == 0 {
            return CachedGlyphMask::Empty;
        }
        let expected = (width as usize).checked_mul(height as usize);
        if expected != Some(image.data.len()) {
            return CachedGlyphMask::Unsupported;
        }
        CachedGlyphMask::Mask(GlyphMaskImage {
            key: runtime_glyph_key(&key),
            width,
            height,
            left: image.placement.left,
            top: image.placement.top,
            alpha: image.data.into(),
        })
    }

    /// Whether a face can produce color glyphs at all. It has `COLR` layered outlines, or a color bitmap strike (`sbix` / `CBDT`). This is cached per face, so a monochrome font checks the tables only once.
    ///
    /// The `CPAL` table is not required here. A COLR face without a palette still draws its layers with swash's foreground color. That is still colored content, and it is still better than being treated as a monochrome silhouette. If `color_bitmap` fails, the code always falls back to outlines, so loosening this check carries no risk.
    fn face_has_color(&mut self, key: CacheKey) -> bool {
        if let Some(cached) = self.color_face_cache.get(&key.font_id) {
            return *cached;
        }
        let has_color = self
            .font_system
            .get_font(key.font_id, key.font_weight)
            .is_some_and(|font| {
                let face = font.as_swash();
                face.table(COLR_TAG).is_some() || face.color_strikes().next().is_some()
            });
        self.color_face_cache.insert(key.font_id, has_color);
        has_color
    }

    fn color_bitmap(&mut self, key: CacheKey) -> Option<ColorGlyph> {
        if let Some(cached) = self.bitmap_cache.get(&key) {
            return cached.clone();
        }
        let glyph = self.rasterize_color_bitmap(key);
        self.bitmap_cache.insert(key, glyph.clone());
        glyph
    }

    fn rasterize_color_bitmap(&mut self, key: CacheKey) -> Option<ColorGlyph> {
        let image = self.swash.get_image_uncached(&mut self.font_system, key)?;
        if image.content != SwashContent::Color {
            return None;
        }
        let (width, height) = (image.placement.width, image.placement.height);
        if width == 0 || height == 0 {
            return None;
        }
        if image.data.len() < width as usize * height as usize * 4 {
            return None;
        }
        let mut pixmap = Pixmap::new(width, height)?;
        // tiny-skia's buffer is premultiplied, but swash's two color channels have different alpha semantics.
        // - `ColorOutline` (COLR): each layer is composited with src-over into a zero-initialized buffer. The output is **already premultiplied**.
        // - `ColorBitmap` (sbix / CBDT): the result of PNG decoding. The output is **straight** (not premultiplied).
        // Multiplying COLR by alpha again would darken the anti-aliased edges. So the handling must branch on `image.source`.
        let already_premultiplied = matches!(image.source, Source::ColorOutline(_));
        for (dst, src) in pixmap
            .pixels_mut()
            .iter_mut()
            .zip(image.data.chunks_exact(4))
        {
            let straight = ColorU8::from_rgba(src[0], src[1], src[2], src[3]);
            *dst = if already_premultiplied {
                // Pixels out of range (which should not occur in theory) fall back to straight semantics, to avoid a panic or black blocks.
                PremultipliedColorU8::from_rgba(src[0], src[1], src[2], src[3])
                    .unwrap_or_else(|| straight.premultiply())
            } else {
                straight.premultiply()
            };
        }
        Some(ColorGlyph {
            width,
            height,
            rgba: pixmap.take().into(),
            left: image.placement.left,
            top: image.placement.top,
        })
    }
}

impl From<CachedGlyphMask> for GlyphAtlasRender {
    fn from(value: CachedGlyphMask) -> Self {
        match value {
            CachedGlyphMask::Mask(mask) => Self::Mask(mask),
            CachedGlyphMask::Empty => Self::Empty,
            CachedGlyphMask::Unsupported => Self::Unsupported,
        }
    }
}

fn runtime_glyph_key(key: &impl Hash) -> [u64; 2] {
    let mut first = StableGlyphHasher::new(0xcbf2_9ce4_8422_2325);
    key.hash(&mut first);
    let mut second = StableGlyphHasher::new(0x8422_2325_cbf2_9ce4);
    key.hash(&mut second);
    [first.finish(), second.finish()]
}

fn positive_extent(value: f32) -> Option<u32> {
    if !value.is_finite() || value <= 0.0 || value > u32::MAX as f32 {
        return None;
    }
    Some(value as u32)
}

/// `DefaultHasher`'s algorithm is not a public contract. The atlas key only has to be stable within the process. An explicit FNV-1a makes the same CacheKey reproducible in debugging and tests.
struct StableGlyphHasher(u64);

impl StableGlyphHasher {
    fn new(seed: u64) -> Self {
        Self(seed)
    }
}

impl Hasher for StableGlyphHasher {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for byte in bytes {
            self.0 ^= u64::from(*byte);
            self.0 = self.0.wrapping_mul(0x100_0000_01b3);
        }
    }
}

fn append_shaped_segment(output: &mut ShapedLine, mut segment: ShapedLine, byte_offset: usize) {
    let x_offset = output.width;
    for glyph in &mut segment.glyphs {
        glyph.x += x_offset;
        glyph.cluster.start += byte_offset;
        glyph.cluster.end += byte_offset;
    }
    output.width += segment.width;
    output.ascent = output.ascent.max(segment.ascent);
    output.descent = output.descent.max(segment.descent);
    output.glyphs.extend(segment.glyphs);
}

fn is_cjk_character(character: char) -> bool {
    matches!(
        character as u32,
        0x2E80..=0x2FFF
            | 0x3000..=0x303F
            | 0x3040..=0x30FF
            | 0x3100..=0x31BF
            | 0x31F0..=0x31FF
            | 0x3400..=0x4DBF
            | 0x4E00..=0x9FFF
            | 0xF900..=0xFAFF
            // Vertical-writing punctuation, CJK compatibility punctuation, and full-width and half-width forms. The full-width colon (U+FF1A), the full-width comma and the full-width brackets appear everywhere in Chinese body text. They used to fall outside this table. A sentence such as “in daily life: instantaneous rate of change” was split into three segments. The colon in the middle was typeset in a Latin family, so its weight, glyph width and side spacing did not match the Han characters on either side.
            | 0xFE10..=0xFE1F
            | 0xFE30..=0xFE4F
            | 0xFF01..=0xFF60
            | 0xFFE0..=0xFFE6
            | 0x20000..=0x323AF
    )
}

/// Whether a text run should use CucCut's bundled CJK fallback instead of a Latin-only
/// display family. UI specimen surfaces consume the same predicate so their fallback choice
/// cannot drift from video burn-in.
pub fn contains_cjk(text: &str) -> bool {
    text.chars().any(is_cjk_character)
}

impl Default for TextEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl TextMeasure for TextEngine {
    fn measure_rich(
        &mut self,
        text: &str,
        range: std::ops::Range<usize>,
        base: scene_primitives::text_layout::FontStyle<'_>,
        runs: &[scene_primitives::text_layout::Run],
    ) -> TextMetricsLine {
        let shaped = self.shape_rich(text, range, base, runs);
        TextMetricsLine {
            width: shaped.width,
            ascent: shaped.ascent,
            descent: shaped.descent,
        }
    }
    fn measure_spaced(
        &mut self,
        text: &str,
        family: &str,
        size: f64,
        weight: u16,
        italic: bool,
        spacing: f64,
    ) -> TextMetricsLine {
        let shaped = self.shape_spaced(text, family, size, weight, italic, spacing);
        TextMetricsLine {
            width: shaped.width,
            ascent: shaped.ascent,
            descent: shaped.descent,
        }
    }
    fn measure(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
    ) -> TextMetricsLine {
        self.measure_styled(text, family, font_size, weight, false)
    }

    fn measure_styled(
        &mut self,
        text: &str,
        family: &str,
        font_size: f64,
        weight: u16,
        italic: bool,
    ) -> TextMetricsLine {
        let s = self.shape_styled(text, family, font_size, weight, italic);
        TextMetricsLine {
            width: s.width,
            ascent: s.ascent,
            descent: s.descent,
        }
    }
}

/// Number formatting for countUp and `textCount` (spec §7.1 `format`). Fixed decimal places, en_US thousands grouping. It matches the original prototype's NumberFormatter.
///
/// - `grouping` (default true): a `,` is inserted every three digits of the integer part.
/// - `pad` (default 0, range 0..=20): the integer part is padded with zeros on the left to at least this many digits. Padding happens before grouping, the same meaning as `minimumIntegerDigits` in `Intl.NumberFormat`.
/// - `negativePrefix` (optional): when the value is below 0, it **replaces** `prefix`. No minus sign is drawn, and the absolute value is shown (for example, "公元前 2070 … 公元 220", meaning 2070 BC … AD 220). "Below 0" is judged on the reading after rounding to `decimals` places. So `-0.4` reads as `0` with 0 decimal places, and `prefix` is used.
///
/// A key with the wrong type is rejected at resolve time (`schema: textCount format …`). Here it is treated as the default.
pub fn fmt_count(v: f64, meta: Option<&serde_json::Map<String, serde_json::Value>>) -> String {
    let get = |key: &str| meta.and_then(|m| m.get(key));
    let decimals = get("decimals").and_then(|d| d.as_f64()).unwrap_or(0.0) as usize;
    let prefix = get("prefix").and_then(|p| p.as_str()).unwrap_or("");
    let suffix = get("suffix").and_then(|s| s.as_str()).unwrap_or("");
    let grouping = get("grouping").and_then(|g| g.as_bool()).unwrap_or(true);
    let pad = get("pad")
        .and_then(|p| p.as_f64())
        .unwrap_or(0.0)
        .clamp(0.0, 20.0) as usize;
    let negative_prefix = get("negativePrefix").and_then(|p| p.as_str());
    let s = format!("{:.*}", decimals, v.abs());
    let (int_part, frac_part) = match s.split_once('.') {
        Some((i, f)) => (i.to_string(), Some(f.to_string())),
        None => (s, None),
    };
    // Whether the reading is non-zero after rounding. This decides the minus sign and `negativePrefix`.
    let nonzero = int_part.chars().any(|c| c != '0')
        || frac_part
            .as_deref()
            .is_some_and(|f| f.chars().any(|c| c != '0'));
    let negative = v < 0.0 && nonzero;
    let digits: Vec<char> = std::iter::repeat_n('0', pad.saturating_sub(int_part.len()))
        .chain(int_part.chars())
        .collect();
    let mut grouped = String::new();
    for (i, c) in digits.iter().enumerate() {
        if grouping && i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(*c);
    }
    let (lead, sign) = match (negative, negative_prefix) {
        (true, Some(np)) => (np, ""),
        (true, None) => (prefix, "-"),
        (false, _) => (prefix, ""),
    };
    match frac_part {
        Some(f) if decimals > 0 => format!("{lead}{sign}{grouped}.{f}{suffix}"),
        _ => format!("{lead}{sign}{grouped}{suffix}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[cfg(feature = "external-fonts")]
    #[test]
    fn external_fonts_resolve_only_inside_an_app_bundle() {
        let app = std::path::Path::new("/Applications/CucCut.app/Contents/MacOS/ccut-serve");
        assert_eq!(
            app_fonts_dir(app).unwrap(),
            std::path::Path::new("/Applications/CucCut.app/Contents/Resources/fonts")
        );
        assert!(app_fonts_dir(std::path::Path::new("/tmp/ccut-serve")).is_none());
        assert_eq!(
            app_fonts_dir(std::path::Path::new(
                "/Applications/CucCut.app/Contents/Resources/bin/export-worker"
            ))
            .unwrap(),
            std::path::Path::new("/Applications/CucCut.app/Contents/Resources/web/assets")
        );
        assert!(
            app_fonts_dir(std::path::Path::new(
                "/tmp/Contents/Resources/bin/export-worker"
            ))
            .is_none()
        );

        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Example.ttf"), b"font").unwrap();
        std::fs::write(dir.path().join("NOTICE.md"), b"notice").unwrap();
        let fonts = load_external_fonts_at(dir.path());
        assert_eq!(fonts.len(), 1);
        assert_eq!(fonts["Example.ttf"], b"font");
        std::fs::rename(
            dir.path().join("Example.ttf"),
            dir.path().join("Example-12345678.ttf"),
        )
        .unwrap();
        std::fs::write(
            dir.path().join("bundled-fonts.json"),
            br#"{"Example.ttf":"Example-12345678.ttf"}"#,
        )
        .unwrap();
        assert_eq!(load_external_fonts_at(dir.path())["Example.ttf"], b"font");
    }

    #[cfg(feature = "external-fonts")]
    #[test]
    #[should_panic(expected = "bundled font manifest must reference a TTF filename")]
    fn external_font_manifest_cannot_escape_the_resource_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("bundled-fonts.json"),
            br#"{"Example.ttf":"../Example.ttf"}"#,
        )
        .unwrap();
        load_external_fonts_at(dir.path());
    }

    /// On this machine, the family that each character of this text actually falls to, reported by weight.
    fn families_by_char(
        engine: &mut TextEngine,
        text: &str,
        family: &str,
        weight: u16,
    ) -> Vec<String> {
        engine
            .shape(text, family, 48.0, weight)
            .glyphs
            .iter()
            .map(|glyph| {
                engine
                    .font_system
                    .db()
                    .face(glyph.cache_key.font_id)
                    .and_then(|face| face.families.first().map(|(name, _)| name.clone()))
                    .unwrap_or_default()
            })
            .collect()
    }

    /// A line of Chinese must use **one font for the whole line**. It must never be scattered glyph by glyph.
    ///
    /// A symptom from regression testing (a video produced by `ccut render`): in the title “导数的两张脸”, “导数两张脸” was Songti and “的” was Apple SD Gothic Neo. On the same line in the body text, “生活里：瞬时变化率”, sans and serif were mixed. The root cause: the fallback family was hard-coded as `"Noto Sans SC"`. The fontdb on the BCF render path does not contain that font at all, so cosmic-text found each character by itself. Whatever each character found was used.
    ///
    /// The test checks two things. The head of the fallback chain must be found (the built-in font is attached to the library). All CJK glyphs in the line must come from the same face. The full-width colon must also count as part of the CJK run. Otherwise it would be typeset in a Latin family and would show a colon of the wrong width in a Chinese line.
    #[test]
    #[cfg_attr(
        not(feature = "media"),
        ignore = "waiting for media: built-in CJK fonts are only attached to fontdb under media (see the Cargo.toml header); without it, fall back to system fonts"
    )]
    fn a_chinese_line_is_shaped_with_a_single_face() {
        let mut engine = TextEngine::new();
        assert_eq!(
            engine.cjk_chain.first().map(String::as_str),
            Some(BUNDLED_CJK_FAMILY),
            "built-in CJK fonts must enter the fontdb used for BCF rendering and rank first in the fallback chain"
        );

        for weight in [400u16, 600, 700] {
            // An empty family means the default sans-serif family. This is how BCF writes it when no fontFamily is declared.
            let families = families_by_char(&mut engine, "导数的两张脸：瞬时变化率", "", weight)
                .into_iter()
                .collect::<HashSet<_>>();
            assert_eq!(
                families,
                HashSet::from([BUNDLED_CJK_FAMILY.to_owned()]),
                "weight {weight}: the Chinese line does not use one font for the whole line: {families:?}"
            );
        }
    }

    /// When the fallback family **itself** lacks a character, the missing character must still land on one fixed font. Changing the weight must not change the font.
    ///
    /// This was the last piece of the user's original symptom. Previously only one fallback family was resolved. Characters that family could not produce were handed back to cosmic-text, which looked them up per glyph, and its answer followed the weight. Measured: the “𠮷” in “Source Han Sans does not have it” fell to PingFang SC at weight 400 and to YuKyokasho Yoko at weight 700. The same sentence changed font just by changing the weight.
    #[test]
    #[cfg(feature = "media")]
    fn a_glyph_the_fallback_lacks_picks_one_font_at_every_weight() {
        let mut engine = TextEngine::with_document_fonts(&[
            include_bytes!("../assets/fonts/Arimo.ttf").to_vec(),
            include_bytes!("../tests/fixtures/fonts/cjk-fallback-probe.ttf").to_vec(),
        ]);
        let text = "名字里有个𠮷字";
        let picked = [100u16, 400, 550, 700, 900]
            .into_iter()
            .map(|weight| {
                let families = families_by_char(&mut engine, text, "", weight);
                // The “𠮷” is the 5th glyph, after the five characters 名字里有个, each of which is one glyph.
                families.get(5).cloned().unwrap_or_default()
            })
            .collect::<HashSet<_>>();
        assert_eq!(
            picked.len(),
            1,
            "fallback for missing characters drifts with weight: {picked:?} (the same text must use one fallback font throughout)"
        );
        assert_eq!(picked, HashSet::from(["Source Han Sans SC".to_owned()]));
    }

    /// Curly quotes, dashes, ellipses and interpuncts in a Chinese line follow the Han characters and do not stay in the Latin family.
    ///
    /// These are not in the CJK block in Unicode. But Latin families **also** have these glyphs, so when a font is picked by coverage they would stay in Arial. The Han characters of a Chinese sentence are Source Han Sans, but the quotes and dash would be Arial, and their width and stroke shape would not match.
    #[test]
    #[cfg_attr(
        not(feature = "media"),
        ignore = "waiting for media: built-in CJK fonts are only attached to fontdb under media (see the Cargo.toml header); without it, fall back to system fonts"
    )]
    fn chinese_punctuation_follows_the_han_run() {
        let mut engine = TextEngine::new();
        for weight in [400u16, 700] {
            let families =
                families_by_char(&mut engine, "他说“这段时间很关键”——真的吗……", "", weight)
                    .into_iter()
                    .collect::<HashSet<_>>();
            assert_eq!(
                families,
                HashSet::from([BUNDLED_CJK_FAMILY.to_owned()]),
                "weight {weight}: Chinese punctuation does not follow the Chinese characters: {families:?}"
            );
        }
        // In pure English the same punctuation still belongs to the Latin family. The neutral rule applies only when it is next to a Han character.
        let latin = families_by_char(&mut engine, "he said “yes”—really…", "", 400)
            .into_iter()
            .collect::<HashSet<_>>();
        assert!(
            !latin.contains(BUNDLED_CJK_FAMILY),
            "the Latin line should not be pulled into a CJK family: {latin:?}"
        );
    }

    /// The CJK family named by the author has the final say and is not overridden by the built-in fallback.
    ///
    /// The head of the chain is the family the author wrote. As long as that family can produce the character, the fallback never gets a turn. A candidate family that is not installed on this machine is skipped. This assertion tests priority, not what any particular machine has installed.
    #[test]
    fn an_author_named_cjk_family_wins_over_the_bundled_fallback() {
        let mut engine = TextEngine::new();
        let Some(named) = ["Songti SC", "PingFang SC", "Hiragino Sans GB", "SimSun"]
            .into_iter()
            .find(|family| engine.has_family(family) && *family != BUNDLED_CJK_FAMILY)
        else {
            eprintln!("skipped: no named system CJK family is installed on this machine");
            return;
        };
        let families = families_by_char(&mut engine, "导数是什么", named, 400)
            .into_iter()
            .collect::<HashSet<_>>();
        assert_eq!(
            families,
            HashSet::from([named.to_owned()]),
            "asked for {named} by name but laid out with another family: {families:?}"
        );
    }

    /// The default sans-serif family is resolved **once** at assembly time. After that, weight only controls weight.
    ///
    /// `Family::SansSerif` is a pending intent. cosmic-text resolves it again for each weight, and the result is not stable. Measured on the same macOS machine: weight 400 and 700 resolved to Arial, while 500, 600, 650, 750, 800 and 900 resolved to System Font. So a page's 700 heading and 650 subheading landed on two completely different Latin fonts.
    #[test]
    fn the_default_sans_family_does_not_drift_with_weight() {
        let mut engine = TextEngine::new();
        let families = [100u16, 400, 500, 600, 650, 700, 750, 800, 900]
            .into_iter()
            .flat_map(|weight| families_by_char(&mut engine, "Slope = dy / dx", "", weight))
            .collect::<HashSet<_>>();
        assert_eq!(families.len(), 1, "default sans-serif family drifts with weight: {families:?}");
    }

    #[test]
    fn an_uninstalled_generic_sans_name_resolves_to_an_available_latin_family() {
        let mut db = fontdb::Database::new();
        db.load_font_data(include_bytes!("../assets/fonts/Arimo.ttf").to_vec());
        db.set_sans_serif_family("Absent Sans");
        load_bundled_cjk_font(&mut db);
        assert_eq!(resolve_sans_family(&db).as_deref(), Some("Arimo"));
        let mut engine = TextEngine::with_font_system(
            FontSystem::new_with_locale_and_db("en-US".to_owned(), db),
            false,
        );
        for weight in [100, 400, 700, 900] {
            let families = families_by_char(&mut engine, "he said “yes”—really…", "", weight)
                .into_iter()
                .collect::<HashSet<_>>();
            assert_eq!(families, HashSet::from(["Arimo".to_owned()]));
        }
    }

    /// Full-width punctuation belongs to CJK. It is in the same run as the Han characters and uses the same family.
    #[test]
    fn fullwidth_punctuation_counts_as_cjk() {
        for character in ['：', '，', '（', '）', '、', '「', '」', '。'] {
            assert!(is_cjk_character(character), "{character} should be laid out as CJK");
        }
        // Half-width punctuation still belongs to the Latin run. Do not pull the commas of English sentences into the CJK family.
        for character in [':', ',', '(', ')', '.'] {
            assert!(!is_cjk_character(character), "{character} should not count as CJK");
        }
    }

    #[test]
    fn fmt_count_grouping() {
        assert_eq!(fmt_count(72.0, None), "72");
        assert_eq!(fmt_count(42000.0, None), "42,000");
        let meta = json!({"suffix": "%", "decimals": 0});
        assert_eq!(fmt_count(71.6, meta.as_object()), "72%");
        let meta = json!({"decimals": 1});
        assert_eq!(fmt_count(0.14, meta.as_object()), "0.1");
    }

    #[test]
    fn fmt_count_grouping_off_and_zero_padding() {
        let meta = json!({"grouping": false});
        assert_eq!(fmt_count(42000.0, meta.as_object()), "42000");
        let meta = json!({"pad": 5, "grouping": false});
        assert_eq!(fmt_count(42.0, meta.as_object()), "00042");
        assert_eq!(fmt_count(123456.0, meta.as_object()), "123456");
        assert_eq!(fmt_count(-42.0, meta.as_object()), "-00042");
        // Zero-padding comes before grouping. This has the same meaning as Intl `minimumIntegerDigits`.
        let meta = json!({"pad": 5});
        assert_eq!(fmt_count(42.0, meta.as_object()), "00,042");
        let meta = json!({"pad": 3, "decimals": 2, "grouping": false});
        assert_eq!(fmt_count(7.256, meta.as_object()), "007.26");
    }

    #[test]
    fn fmt_count_negative_prefix_replaces_prefix_and_sign() {
        let meta = json!({"prefix": "公元 ", "negativePrefix": "公元前 ", "grouping": false});
        let m = meta.as_object();
        assert_eq!(fmt_count(-2070.0, m), "公元前 2070");
        assert_eq!(fmt_count(-1.0, m), "公元前 1");
        assert_eq!(fmt_count(0.0, m), "公元 0");
        assert_eq!(fmt_count(-0.0, m), "公元 0");
        // -0.4 rounds to 0 at 0 decimal places. Use `prefix`, not `negativePrefix`.
        assert_eq!(fmt_count(-0.4, m), "公元 0");
        assert_eq!(fmt_count(-0.6, m), "公元前 1");
        assert_eq!(fmt_count(220.0, m), "公元 220");
        // With no `negativePrefix`: `prefix` plus the minus sign, as before.
        let meta = json!({"prefix": "$"});
        assert_eq!(fmt_count(-5.0, meta.as_object()), "$-5");
        assert_eq!(fmt_count(-0.4, meta.as_object()), "$0");
        // Used together with `suffix`, `decimals` and `pad`.
        let meta = json!({"negativePrefix": "−", "decimals": 1, "suffix": " °C", "pad": 2});
        assert_eq!(fmt_count(-3.26, meta.as_object()), "−03.3 °C");
        assert_eq!(fmt_count(-0.04, meta.as_object()), "00.0 °C");
    }

    /// The system color emoji fonts (macOS `sbix`, Linux `CBDT`, Windows `COLR`) must go through the color channel. Ordinary Latin glyphs still go through vector outlines. Otherwise emoji in the exported picture would either disappear or turn into a single-color silhouette in the subtitle's text color.
    ///
    /// Machines without a color emoji font (most Linux CI) skip this test automatically. The structural regression check for the test is covered unconditionally by [`colr_face_with_solid_fallback_outline_uses_the_color_channel`], which uses a checked-in probe font.
    #[test]
    fn system_color_emoji_fonts_use_the_bitmap_channel() {
        let mut engine = TextEngine::with_system_and_fonts(&[]);
        let emoji_family = ["Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji"]
            .into_iter()
            .find(|family| engine.has_family(family));
        let Some(emoji_family) = emoji_family else {
            eprintln!("skipped: no color emoji font is installed on this machine");
            return;
        };
        // Other installed fonts may also cover emoji with monochrome outlines.
        // Select the detected color font so this test exercises its color tables.
        let shaped = engine.shape("A😀B", emoji_family, 64.0, 400);
        assert!(!shaped.glyphs.is_empty(), "shaping should not be empty");
        let mut bitmaps = 0_usize;
        let mut outlines = 0_usize;
        for glyph in &shaped.glyphs {
            match engine.glyph_render(glyph.cache_key) {
                GlyphRender::Outline(path) => {
                    assert!(path_has_area(&path), "the Outline branch must be able to fill pixels");
                    outlines += 1;
                }
                GlyphRender::ColorBitmap { rgba, .. } => {
                    assert!(
                        rgba.chunks_exact(4).any(|pixel| pixel[3] > 0),
                        "a color bitmap glyph must not be fully transparent"
                    );
                    bitmaps += 1;
                }
                GlyphRender::Empty => {}
            }
        }
        assert!(
            bitmaps >= 1,
            "😀 should take the color bitmap path (fallback font {emoji_family})"
        );
        assert!(outlines >= 1, "A / B should still take the vector outline path");
    }

    /// COLR/CPAL glyphs (the structure of Windows `Segoe UI Emoji`) must go through the color channel.
    ///
    /// The probe font `core/fixtures/fonts/ColrProbe.ttf` is built from scratch by `core/fixtures/fonts/mk_colr_probe.py`. Its base glyph `A` has a **non-empty** monochrome fallback outline (the COLR spec requires it), and the colored shapes are in the COLR layers. The old rule, "use the color channel only when the outline has no fill area", always short-circuits to `Outline` here.
    ///
    /// It also pins the premultiplication semantics. swash's COLR channel outputs **already premultiplied** values, and multiplying again would darken the anti-aliased edges. Palette entry 0 is opaque pure red, and the two layers do not overlap. So pure-red pixels satisfy `red == alpha`. A second premultiplication would collapse them to `red == red * alpha / 255`.
    #[test]
    fn colr_face_with_solid_fallback_outline_uses_the_color_channel() {
        let probe = include_bytes!("../tests/fixtures/fonts/ColrProbe.ttf").to_vec();
        let mut engine = TextEngine::with_document_fonts(&[probe]);
        let shaped = engine.shape("A", "ColrProbe", 64.0, 400);
        assert_eq!(shaped.glyphs.len(), 1, "the probe font should shape 'A' into a single glyph");
        let key = shaped.glyphs[0].cache_key;

        let path = engine.glyph_path(key).expect("the COLR base glyph should have a fallback outline");
        assert!(
            path_has_area(&path),
            "the probe must keep a non-empty monochrome fallback outline, or the area check's failure goes undetected"
        );

        let GlyphRender::ColorBitmap { rgba, .. } = engine.glyph_render(key) else {
            panic!("COLR glyphs must take the color path, not be drawn as a silhouette of a monochrome outline");
        };

        let mut partial_red = 0_usize;
        for pixel in rgba.chunks_exact(4) {
            let [red, green, blue, alpha] = [pixel[0], pixel[1], pixel[2], pixel[3]];
            if alpha == 0 || red == 0 {
                continue;
            }
            if green != 0 || blue != 0 {
                continue; // The blue triangle (palette entry 1) does not take part in the red invariant.
            }
            assert_eq!(
                red, alpha,
                "COLR output was premultiplied twice: the red of an opaque pure-red pixel is darkened by alpha"
            );
            // swash's `>>8` compositing makes fully covered pixels land at alpha=254. So only values below 200 count as partial coverage.
            if alpha < 200 {
                partial_red += 1;
            }
        }
        assert!(
            partial_red > 0,
            "the diamond's diagonal edge should produce partially covered red AA pixels; otherwise the premultiplication assertion is a no-op"
        );
        let GlyphAtlasRender::Color(atlas) = engine.glyph_atlas_render(key) else {
            panic!("COLR glyphs must keep RGBA atlas data");
        };
        assert!(Arc::ptr_eq(&rgba, &atlas.rgba));
        assert!(matches!(
            engine.glyph_stroke_atlas_render(key, 4.0),
            GlyphAtlasRender::Empty
        ));
    }

    /// BCF documents can use the built-in display fonts by name even without declaring a `font` asset. If the document does declare one (strict), the same applies. The font chosen is that one. Its width differs from the default family. The subtitle injected-font entry does not include this set.
    #[cfg(feature = "media")]
    #[test]
    fn documents_see_bundled_display_families_by_name() {
        let loose = TextEngine::for_document(&[]);
        assert!(!loose.strict);
        assert!(loose.has_family("Permanent Marker") && loose.has_family("Bangers"));

        let doc = include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec();
        let mut strict = TextEngine::for_document(std::slice::from_ref(&doc));
        assert!(strict.strict);
        assert!(strict.has_family("Permanent Marker"));
        let marker = strict.shape("FOOM", "Permanent Marker", 48.0, 400).width;
        let fallback = strict.shape("FOOM", "", 48.0, 400).width;
        assert!((marker - fallback).abs() > 1.0, "{marker} vs {fallback}");

        assert!(!TextEngine::with_document_fonts(&[doc]).has_family("Permanent Marker"));
    }

    /// The color capability gate must be per face. A monochrome font must not run an extra rasterization because of the new test, and it must not be misjudged as a color font.
    #[test]
    fn monochrome_face_stays_on_the_outline_channel() {
        let mut engine =
            TextEngine::with_document_fonts(&[
                include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec()
            ]);
        let shaped = engine.shape("Ag", "VK Sans", 48.0, 400);
        assert!(!shaped.glyphs.is_empty(), "shaping should not be empty");
        for glyph in &shaped.glyphs {
            assert!(
                !engine.face_has_color(glyph.cache_key),
                "a monochrome face must not pass the color gate"
            );
            assert!(
                matches!(
                    engine.glyph_render(glyph.cache_key),
                    GlyphRender::Outline(_)
                ),
                "monochrome glyphs must stay on the vector outline path"
            );
        }
    }

    #[test]
    fn stroked_glyph_masks_expand_once_and_reuse_the_cached_alpha() {
        let mut engine =
            TextEngine::with_document_fonts(&[
                include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec()
            ]);
        let shaped = engine.shape("O", "VK Sans", 48.0, 400);
        let key = shaped.glyphs[0].cache_key;
        let GlyphAtlasRender::Mask(base) = engine.glyph_atlas_render(key) else {
            panic!("ordinary glyphs must have a base mask")
        };
        let GlyphAtlasRender::Mask(first) = engine.glyph_stroke_atlas_render(key, 6.0) else {
            panic!("ordinary glyphs must have a stroke mask")
        };
        let GlyphAtlasRender::Mask(second) = engine.glyph_stroke_atlas_render(key, 6.0) else {
            panic!("a cache hit must still return the stroke mask")
        };
        assert!(first.width >= base.width && first.height >= base.height);
        assert!(first.left <= base.left);
        assert!(-first.top <= -base.top);
        assert_eq!(first.key, second.key);
        assert!(Arc::ptr_eq(&first.alpha, &second.alpha));
    }

    /// A size-limited cache must really be limited. When over budget, it evicts LRU entries down to the 3/4 water level. It keeps the entries that were just hit and just inserted, and it returns the evicted keys to the caller. `glyph_path` depends on this to clean up swash's outline shadow.
    #[test]
    fn budget_cache_evicts_least_recently_used_down_to_the_low_water_mark() {
        let mut cache: BudgetCache<u32, Vec<u8>> = BudgetCache::new(4096);
        for id in 0..6_u32 {
            assert!(
                cache.insert(id, vec![0_u8; 512]).is_empty(),
                "nothing should be evicted before the budget is exceeded"
            );
        }
        assert_eq!(cache.entries.len(), 6);
        // Make entries 0 and 1 the two most recently used.
        assert!(cache.get(&0).is_some());
        assert!(cache.get(&1).is_some());

        let evicted = cache.insert(6, vec![0_u8; 512]);
        assert_eq!(evicted, vec![2, 3], "least recently used entries go first, and keys must be handed back to the caller");
        assert!(
            cache.bytes <= 4096 / 4 * 3,
            "eviction must go all the way down to the low-water mark, not just barely back under the budget line"
        );
        for present in [0_u32, 1, 4, 5, 6] {
            assert!(cache.get(&present).is_some(), "{present} should not be evicted");
        }
        for gone in [2_u32, 3] {
            assert!(cache.get(&gone).is_none(), "{gone} should have been evicted");
        }
        assert_eq!(
            cache.bytes,
            cache
                .entries
                .values()
                .map(|entry| entry.bytes)
                .sum::<usize>(),
            "the byte accounting must match the table contents, or the budget drifts with eviction"
        );
    }

    /// Eviction affects only performance, not pixels. After an outline is evicted, recomputing it must give the same result point by point as the first time. swash's outline shadow is cleared too, so this is a true cold-path recomputation.
    #[test]
    fn evicting_a_glyph_outline_does_not_change_the_recomputed_path() {
        let mut engine =
            TextEngine::with_document_fonts(&[
                include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec()
            ]);
        let shaped = engine.shape("Ag", "VK Sans", 48.0, 400);
        let key = shaped.glyphs[0].cache_key;
        let before = engine.glyph_path(key).expect("glyph should have an outline");

        engine.path_cache.entries.clear();
        engine.path_cache.bytes = 0;
        engine.swash.outline_command_cache.clear();

        let after = engine.glyph_path(key).expect("should still have an outline after recomputation");
        assert_eq!(before.verbs(), after.verbs());
        assert_eq!(before.points(), after.points());
    }

    /// Byte accounting must follow the actual content. Shaping, outlines, atlas masks and the capability gates are all non-zero. All six caches stay within their own budgets.
    #[test]
    fn cache_accounting_tracks_real_content_and_stays_under_budget() {
        let mut engine =
            TextEngine::with_document_fonts(&[
                include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec()
            ]);
        for size in [24.0, 36.0, 48.0] {
            let shaped = engine.shape("CucCut 渲染", "VK Sans", size, 400);
            for glyph in &shaped.glyphs {
                let _ = engine.glyph_render(glyph.cache_key);
                let _ = engine.glyph_atlas_render(glyph.cache_key);
                let _ = engine.glyph_stroke_atlas_render(glyph.cache_key, 4.0);
            }
        }
        let (shape, path, bitmap, mask, stroke, face) = engine.cache_bytes();
        assert!(
            shape > 0 && path > 0 && mask > 0 && stroke > 0,
            "shaping, outline, body atlas mask and stroke mask caches should all have content"
        );
        assert!(shape <= SHAPE_CACHE_BUDGET);
        assert!(path <= PATH_CACHE_BUDGET);
        assert!(bitmap <= BITMAP_CACHE_BUDGET);
        assert!(mask <= MASK_CACHE_BUDGET);
        assert!(stroke <= STROKE_MASK_CACHE_BUDGET);
        assert!(face > 0 && face <= COLOR_FACE_CACHE_BUDGET);
    }

    #[test]
    fn managed_font_shadows_same_family_from_host_database() {
        let mut host = fontdb::Database::new();
        host.load_font_data(include_bytes!("../assets/fonts/VKSans-400.ttf").to_vec());
        let engine = TextEngine::with_font_db_and_fonts(
            host,
            &[include_bytes!("../assets/fonts/VKSans-800.ttf").to_vec()],
        );
        let id = engine
            .font_system
            .db()
            .query(&fontdb::Query {
                families: &[Family::Name("VK Sans")],
                weight: Weight::NORMAL,
                stretch: Stretch::Normal,
                style: Style::Normal,
            })
            .unwrap();
        assert_eq!(
            engine.font_system.db().face(id).unwrap().weight,
            Weight::EXTRA_BOLD,
            "the same-named family managed by CucCut should override the host font"
        );
    }
}

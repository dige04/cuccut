//! Host-side asset loading (the fetch and probe half of opencat's explicit lifecycle):
//!   core host_requirements() → this module loads or probes by kind → HostInputs are filled back into core.
//! All paths are relative to the document directory. When a hash is declared, sha256 is strictly verified (render farm consistency).

use crate::plan::PreflightDiagnostic;
use crate::source::{AnimatedImage, Lottie, PrepareCtx, VisualSource};
use anyhow::{Context, Result, anyhow, bail};
use scene_primitives::assets::{AssetKind, AssetReq, HostInputs};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tiny_skia::Pixmap;

/// The `ffprobe` used as a fallback for probing. Discovery goes through [`crate::exec`] (`CUCCUT_FFPROBE`, then `PATH`) and is not handled by the probing crate itself; see the note at the top of [`media_probe`]. If it is not found, this is `None`: the caller uses the pure Rust probing result directly, without spending an extra spawn that is bound to fail. It is resolved only once per process.
fn ffprobe_path() -> Option<&'static Path> {
    static RESOLVED: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    RESOLVED
        .get_or_init(|| crate::exec::find_executable("ffprobe"))
        .as_deref()
}

/// Video asset: the bytes are not held in memory; frames are decoded on demand, one at a time, via VideoReader.
#[derive(Debug, Clone)]
pub struct VideoInfo {
    pub path: PathBuf,
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    /// The source's own frame rate. `0` = cannot be probed.
    ///
    /// It serves one purpose: computing the **last decodable moment** (`duration - 1/fps`). `ffmpeg -ss` past the **last frame** outputs nothing at all; that is a hard error, not “freeze the last frame”. A caller that wants to stop on the last frame (P7b's `sticker.loop = "once"`) must clamp to the source frame rate; clamping to the composition frame rate is not enough for low-frame-rate sources.
    pub fps: f64,
    /// The decoder name this source **must** specify explicitly (`None` = let ffmpeg choose).
    ///
    /// Only one case needs it: **WebM with alpha**. ffmpeg's native `vp9` / `vp8` decoders **silently drop the alpha plane** (WebM stores it in `BlockAdditional`, marked by the container's `AlphaMode`); only `libvpx-vp9` / `libvpx` restore it. Without specifying it, a transparent sticker decodes to an opaque black background, with no error reported at all. The criterion comes from [`probe_alpha_decoder`], which is asked once during asset loading.
    pub decoder: Option<String>,
}

#[derive(Default)]
pub struct LoadedAssets {
    /// The files actually read by this load, including Lottie's external images. The host uses it to invalidate the hot-reload cache.
    pub dependencies: Vec<PathBuf>,
    pub file_signatures: Vec<(PathBuf, Option<(u64, Option<std::time::SystemTime>)>)>,
    /// Lazy audio/video must still match the files probed during preparation.
    pub media_signatures: HashMap<PathBuf, (u64, Option<std::time::SystemTime>)>,
    pub images: HashMap<String, Arc<Pixmap>>,
    pub bounded_images: HashMap<String, PathBuf>,
    pub animated_svgs: HashMap<String, Arc<scene_primitives::svg_animation::SvgAnimation>>,
    /// Animated image source (GIF / APNG / WebP). `Arc` is used because the frame bytes are shared across render threads. Each worker has a `MediaStore`, but animated images are decoded only once (`VisualSource` is stateless).
    pub animated: HashMap<String, Arc<AnimatedImage>>,
    /// Lottie source (bodymovin subset). It is shared across workers like animated images: `Lottie::record` is a pure function and holds no sampling state.
    pub lotties: HashMap<String, Arc<Lottie>>,
    /// `program` source (§6.5.3): the module graph and `files` bytes are shared read-only; each render thread builds its own evaluator.
    pub programs: HashMap<String, Arc<crate::program::ProgramSource>>,
    pub videos: HashMap<String, VideoInfo>,
    pub audios: HashMap<String, PathBuf>,
    /// Document font bytes (go into the TextEngine fontdb; when non-empty, strict mode disables system fallback)
    pub fonts: Vec<Vec<u8>>,
    /// **Warn-level** diagnostics produced during asset loading (currently only Lottie's `lottie-unsupported-feature`: an ignored expression controller group). Fail-level diagnostics become `Err` here and never reach preflight. `FramePlanner` merges them into the preflight report, and they are surfaced in the `diagnostics` of `ccut render --json` / `ccut ops`.
    pub source_diagnostics: Vec<PreflightDiagnostic>,
    pub inputs: HostInputs,
}

impl LoadedAssets {
    /// Warnings that appear only during rendering: degraded forms and missing glyphs in a `program` asset that are hit after the first frame trial-rendered during loading (`program-degraded`, sorted by asset id). They do not duplicate `source_diagnostics`, and are read after rendering finishes.
    pub fn render_diagnostics(&self) -> Vec<PreflightDiagnostic> {
        let mut ids: Vec<&String> = self.programs.keys().collect();
        ids.sort();
        ids.into_iter()
            .flat_map(|id| self.programs[id].late_diagnostics())
            .collect()
    }

    pub fn validate_media_files(&self) -> Result<()> {
        for path in self.media_signatures.keys() {
            self.validate_media_file(path)?;
        }
        Ok(())
    }

    pub fn validate_media_file(&self, path: &Path) -> Result<()> {
        if let Some(before) = self.media_signatures.get(path) {
            let meta = std::fs::metadata(path)?;
            if (meta.len(), meta.modified().ok()) != *before {
                bail!("BCF 媒体在准备后发生变化，请重新加载：{}", path.display());
            }
        }
        Ok(())
    }
}

/// Document + document directory → the LoadedAssets once all assets are loaded (a missing file or a hash mismatch fails fast).
pub fn load_assets(doc: &Value, base_dir: &Path) -> Result<LoadedAssets> {
    load_assets_with_vars(doc, base_dir, None)
}

/// Same as [`load_assets`], with variable overrides (the requirement resolution delegated by asset variables, §11.1/§11.2).
pub fn load_assets_with_vars(
    doc: &Value,
    base_dir: &Path,
    overrides: Option<&serde_json::Map<String, Value>>,
) -> Result<LoadedAssets> {
    let reqs = scene_primitives::host_requirements_with_vars(doc, overrides)?;
    let mut out = LoadedAssets::default();
    // The program's font library can only be built after all `font` assets are read, since fonts may be listed after the program.
    #[cfg(feature = "program")]
    let mut programs = Vec::new();
    for req in &reqs {
        let path = base_dir.join(&req.src);
        let before = std::fs::metadata(&path)
            .with_context(|| format!("asset \"{}\": 读取 {} 失败", req.id, path.display()))?;
        let before = (before.len(), before.modified().ok());
        let lazy = matches!(req.kind, AssetKind::Video | AssetKind::Audio) || req.bounded_image;
        let bytes = if lazy {
            if req.hash.is_some() {
                use std::io::Read;
                let mut file = std::fs::File::open(&path)?;
                let mut hasher = Sha256::new();
                let mut buf = [0u8; 64 * 1024];
                loop {
                    let n = file.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    hasher.update(&buf[..n]);
                }
                verify_digest(req, &lower_hex(&hasher.finalize()))?;
            }
            Vec::new()
        } else {
            let bytes = std::fs::read(&path)?;
            verify_hash(req, &bytes)?;
            bytes
        };
        out.dependencies.push(path.clone());
        match req.kind {
            AssetKind::Image if req.bounded_image => {
                let reader = image::ImageReader::open(&path)?.with_guessed_format()?;
                if !matches!(
                    reader.format(),
                    Some(
                        image::ImageFormat::Png
                            | image::ImageFormat::Jpeg
                            | image::ImageFormat::WebP
                            | image::ImageFormat::Gif
                    )
                ) {
                    bail!(
                        "asset {}: bounded cache 只接受 PNG/JPEG/WebP/GIF 位图",
                        req.id
                    );
                }
                let (w, h) = reader.into_dimensions()?;
                if u64::from(w).saturating_mul(u64::from(h)).saturating_mul(4) > 64 * 1024 * 1024 {
                    bail!("asset {}: bounded image 单图不得超过 64 MiB", req.id);
                }
                out.inputs.insert_image(&req.id, w as f64, h as f64);
                out.bounded_images.insert(req.id.clone(), path.clone());
            }
            AssetKind::Image => {
                let pm = decode_image(&req.src, &bytes)
                    .with_context(|| format!("asset \"{}\" 解码失败", req.id))?;
                out.inputs
                    .insert_image(&req.id, pm.width() as f64, pm.height() as f64);
                out.images.insert(req.id.clone(), Arc::new(pm));
            }
            AssetKind::AnimatedImage => {
                let budget = PrepareCtx::default();
                let src = AnimatedImage::decode(&req.src, &bytes, &budget)
                    .with_context(|| format!("asset \"{}\" 解码失败", req.id))?;
                src.prepare(&budget)?;
                let meta = src.probe()?;
                out.inputs.insert_animated_image(
                    &req.id,
                    meta.width as f64,
                    meta.height as f64,
                    meta.frame_starts_ms.clone(),
                    meta.loops.plays(),
                );
                out.animated.insert(req.id.clone(), Arc::new(src));
            }
            AssetKind::Lottie => {
                let mut src = Lottie::parse(&req.id, &req.src, &bytes)
                    .with_context(|| format!("asset \"{}\" 解析失败", req.id))?;
                // Sub-resources are collected, read from disk and decoded here, and folded into the content fingerprint chain by asset name. There must be no I/O at render time (the `VisualSource` convention).
                let lottie_dir = path.parent().unwrap_or(base_dir).to_path_buf();
                let mut loaded = Vec::new();
                for requirement in src.image_requirements().to_vec() {
                    let (bytes, label) = match (&requirement.embedded, &requirement.path) {
                        (Some(inline), _) => (inline.clone(), format!("<内嵌 {}>", requirement.id)),
                        (None, Some(relative)) => {
                            let child = lottie_dir.join(relative);
                            let meta = std::fs::metadata(&child)?;
                            out.file_signatures
                                .push((child.clone(), Some((meta.len(), meta.modified().ok()))));
                            let bytes = std::fs::read(&child).with_context(|| {
                                format!(
                                    "asset \"{}\"：读 Lottie 子资源 {} 失败",
                                    req.id,
                                    child.display()
                                )
                            })?;
                            out.dependencies.push(child.clone());
                            (bytes, child.display().to_string())
                        }
                        (None, None) => bail!(
                            "asset \"{}\"：Lottie 子资源 \"{}\" 既不是内嵌也没有路径",
                            req.id,
                            requirement.id
                        ),
                    };
                    let pixmap = requirement.decode(&bytes).with_context(|| {
                        format!("asset \"{}\"：Lottie 子资源 {label} 解码失败", req.id)
                    })?;
                    let pixmap = Arc::new(pixmap);
                    // The same image goes both into Lottie's own sampling table and into MediaStore. The element path emits `DrawMedia`, which is fetched from MediaStore at rasterization.
                    out.images
                        .insert(requirement.asset_name.clone(), pixmap.clone());
                    loaded.push((requirement.asset_name, bytes, pixmap));
                }
                src.attach_images(loaded);
                let budget = PrepareCtx::default();
                src.prepare(&budget)?;
                let meta = src.probe()?;
                out.source_diagnostics
                    .extend(src.diagnostics().iter().cloned());
                out.inputs.insert_lottie(
                    &req.id,
                    meta.width as f64,
                    meta.height as f64,
                    meta.frame_starts_ms.clone(),
                );
                out.lotties.insert(req.id.clone(), Arc::new(src));
            }
            AssetKind::Program => {
                #[cfg(feature = "program")]
                {
                    let program = req
                        .program
                        .as_ref()
                        .ok_or_else(|| anyhow!("asset \"{}\"：缺少 program 声明", req.id))?;
                    let bundle = ccut_compile::program::ProgramBundle::load(
                        &ccut_compile::program::ProgramSpec {
                            base_dir,
                            entry: &req.src,
                            export: &program.export,
                            imports: &program.imports,
                            files: &program.files,
                        },
                    )
                    .map_err(|error| crate::program::tag_asset(&req.id, error))?;
                    for (dependency, signature) in &bundle.dependencies {
                        out.dependencies.push(dependency.clone());
                        out.file_signatures.push((dependency.clone(), *signature));
                    }
                    out.inputs.insert_program(&req.id, program);
                    programs.push((req.id.clone(), bundle, program.clone()));
                }
                // v3: `ccut-compile` is not ported (architecture design §13.6); the `program` feature is only a placeholder.
                #[cfg(not(feature = "program"))]
                bail!(
                    "asset \"{}\"：program 资产要 BCF 编译器（ccut-compile），v3 不移植（架构设计 §13.6）",
                    req.id
                );
            }
            AssetKind::Video => {
                let probed = probe_media_info(&path, true)?;
                let (w, h) = (probed.display_width, probed.display_height);
                let (dur, fps) = (probed.duration, probed.fps);
                out.inputs
                    .insert_video(&req.id, w as f64, h as f64, dur, fps);
                out.videos.insert(
                    req.id.clone(),
                    VideoInfo {
                        decoder: probe_alpha_decoder(&path),
                        path: path.clone(),
                        width: w,
                        height: h,
                        duration: dur,
                        fps,
                    },
                );
            }
            AssetKind::Audio => {
                let probed = probe_media_info(&path, false)?;
                out.inputs.insert_audio(&req.id, probed.duration);
                out.audios.insert(req.id.clone(), path.clone());
            }
            AssetKind::Font => {
                let mut database = cosmic_text::fontdb::Database::new();
                database.load_font_data(bytes.clone());
                let family = database
                    .faces()
                    .next()
                    .and_then(|face| face.families.first())
                    .map(|(name, _)| name.clone())
                    .ok_or_else(|| anyhow!("asset {} 不含可用字体族", req.id))?;
                out.inputs
                    .font_families
                    .insert(req.src.clone(), family.clone());
                out.inputs
                    .font_families
                    .insert(format!("$assets.{}", req.id), family);
                out.fonts.push(bytes);
            }
        }
        let after = std::fs::metadata(&path)?;
        if before != (after.len(), after.modified().ok()) {
            bail!("asset \"{}\" 在加载期间发生变化，请重试", req.id);
        }
        if lazy {
            out.media_signatures.insert(path, before);
        } else {
            out.file_signatures.push((path, Some(before)));
        }
    }
    #[cfg(feature = "program")]
    if !programs.is_empty() {
        let fontdb = Arc::new(
            crate::fonts::TextEngine::for_document(&out.fonts)
                .font_system
                .db()
                .clone(),
        );
        for (id, bundle, program) in programs {
            let source = crate::program::ProgramSource::new(&id, bundle, &program, fontdb.clone());
            let diagnostics = source
                .probe()
                .map_err(|error| crate::program::tag_asset(&id, error))?;
            out.source_diagnostics.extend(diagnostics);
            out.programs.insert(id, Arc::new(source));
        }
    }
    out.file_signatures.extend(
        out.media_signatures
            .iter()
            .map(|(path, stamp)| (path.clone(), Some(*stamp))),
    );
    out.file_signatures.sort_by(|a, b| a.0.cmp(&b.0));
    for (path, before) in &out.file_signatures {
        let meta = std::fs::metadata(path)?;
        if Some((meta.len(), meta.modified().ok())) != *before {
            bail!("asset {} 在加载期间发生变化，请重试", path.display());
        }
    }
    Ok(out)
}

fn verify_hash(req: &AssetReq, bytes: &[u8]) -> Result<()> {
    if req.hash.is_none() {
        return Ok(());
    }
    verify_digest(req, &lower_hex(&Sha256::digest(bytes)))
}

/// sha2 0.11's digest (hybrid-array) has no `LowerHex`, so it is written out byte by byte, with the same value as v2's `{:x}`.
fn lower_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn verify_digest(req: &AssetReq, actual: &str) -> Result<()> {
    let Some(decl) = &req.hash else { return Ok(()) };
    let hex = decl
        .strip_prefix("sha256-")
        .ok_or_else(|| anyhow!("asset \"{}\" hash 缺少 sha256- 前缀", req.id))?;
    if !actual.eq_ignore_ascii_case(hex) {
        bail!(
            "asset \"{}\" 内容与声明 hash 不符：期望 {hex}，实际 {actual}（文件被替换或损坏）",
            req.id
        );
    }
    Ok(())
}

/// png → built-in tiny-skia decoder; jpg → image crate (no alpha); svg → resvg, rasterized at its natural size.
/// **Static images only**: GIF / APNG / animated WebP go through `AssetKind::AnimatedImage` and [`crate::source::AnimatedImage`], not from here.
pub fn decode_image(src: &str, bytes: &[u8]) -> Result<Pixmap> {
    let ext = Path::new(src)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => Pixmap::decode_png(bytes).map_err(|e| anyhow!("PNG: {e}")),
        "jpg" | "jpeg" => {
            let img = image::load_from_memory(bytes)?.to_rgba8();
            let (w, h) = (img.width(), img.height());
            let mut pm = Pixmap::new(w, h).ok_or_else(|| anyhow!("空 JPEG"))?;
            pm.data_mut().copy_from_slice(img.as_raw()); // JPEG has no alpha, so straight == premultiplied
            Ok(pm)
        }
        "svg" => crate::svg::decode_svg_natural(bytes),
        "gif" | "webp" => bail!(
            "静态图片解码器不认 .{ext}：动图请把 asset 声明成 type: \"animatedImage\"、元素写 animatedImage（规范 §6.5.1）"
        ),
        other => bail!("不支持的图像格式 .{other}（png/jpg/svg）"),
    }
}

/// Rasterize SVG to the **target long side** (implemented in [`crate::svg`], shared with the browser preview).
pub use crate::svg::decode_svg_at_long_edge;

/// Decode a static image **from bytes** (only for Lottie sub-resources).
///
/// It does not dispatch on file extension as [`decode_image`] does: an embedded data URI has no file name, and bodymovin's `p` field may not carry a correct suffix across different exporters.
pub fn decode_image_bytes(label: &str, bytes: &[u8]) -> Result<Pixmap> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Pixmap::decode_png(bytes).map_err(|e| anyhow!("{label}: PNG {e}"));
    }
    if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") {
        return crate::svg::decode_svg_natural(bytes).map_err(|e| anyhow!("{label}: {e}"));
    }
    let img = image::load_from_memory(bytes)
        .map_err(|e| anyhow!("{label}: {e}"))?
        .to_rgba8();
    let (w, h) = (img.width(), img.height());
    let mut raw = img.into_raw();
    // straight RGBA → premultiplied (tiny-skia's pixel format)
    for px in raw.chunks_exact_mut(4) {
        let pm = tiny_skia::ColorU8::from_rgba(px[0], px[1], px[2], px[3]).premultiply();
        px[0] = pm.red();
        px[1] = pm.green();
        px[2] = pm.blue();
        px[3] = pm.alpha();
    }
    let size = tiny_skia::IntSize::from_wh(w, h).ok_or_else(|| anyhow!("{label}: 零尺寸"))?;
    Pixmap::from_vec(raw, size).ok_or_else(|| anyhow!("{label}: 构造 pixmap 失败"))
}

struct ProbedMediaInfo {
    natural_width: u32,
    natural_height: u32,
    display_width: u32,
    display_height: u32,
    duration: f64,
    fps: f64,
}

fn probe_media_info(path: &Path, want_video: bool) -> Result<ProbedMediaInfo> {
    let (probe, _backend) = media_probe::probe_with_fallback(path, ffprobe_path())
        .with_context(|| format!("探测 {} 失败", path.display()))?;
    let (natural_width, natural_height) = probe.dimensions().unwrap_or((0, 0));
    let (display_width, display_height) = probe.display_dimensions().unwrap_or((0, 0));
    if want_video && (display_width == 0 || display_height == 0) {
        bail!("{} 没有视频流", path.display());
    }
    Ok(ProbedMediaInfo {
        natural_width,
        natural_height,
        display_width,
        display_height,
        duration: probe.duration_seconds.unwrap_or(0.0),
        fps: probe.fps().unwrap_or(0.0),
    })
}

/// Media probing: the pure Rust path is the main one; containers it cannot handle fall back to `ffprobe` (optional).
///
/// Returns (natural_width, natural_height, duration, fps). The size is the **encoded orientation without rotation**, to keep the CLI `naturalW/naturalH` contract. Render asset loading uses the rotation-corrected display size separately. fps is meaningful only for video streams; `0` = cannot be probed.
pub fn probe_media(path: &Path, want_video: bool) -> Result<(u32, u32, f64, f64)> {
    let probed = probe_media_info(path, want_video)?;
    Ok((
        probed.natural_width,
        probed.natural_height,
        probed.duration,
        probed.fps,
    ))
}

/// A WebM with alpha needs an **explicit** decoder, or its alpha plane is silently discarded.
///
/// WebM stores alpha as `BlockAdditional` per Block, marked by the track's `AlphaMode` (EBML 0x53C0). ffmpeg's **native** `vp9` / `vp8` decoders do not read it; only `libvpx-vp9` / `libvpx` do. Measured with ffmpeg 7.1: for the same `yuva420p` VP9 WebM, the default decoder gives every pixel an α of 255, and only `-c:v libvpx-vp9` restores the real alpha.
///
/// Returns `None` = nothing to do (not an alpha WebM, or the probe itself failed; in that case video decoding will also fail at the next step, and no extra error is reported here).
///
/// The alpha flag is now read directly from Matroska's `AlphaMode` element by [`media_probe`], so ffprobe is no longer needed. **Decoding** is still ffmpeg's job, so the mapping from "codec + alpha → decoder name" stays in this module.
///
/// This is the necessary condition for P7b dynamic stickers (GIF → WebM with alpha) to make it into the picture.
pub fn probe_alpha_decoder(path: &Path) -> Option<String> {
    let (probe, _backend) = media_probe::probe_with_fallback(path, ffprobe_path()).ok()?;
    let video = probe.video.as_ref()?;
    if !video.alpha {
        return None;
    }
    match video.codec.as_deref()? {
        "vp9" => Some("libvpx-vp9".to_owned()),
        "vp8" => Some("libvpx".to_owned()),
        // The alpha of other codecs is restored by their own native decoders, so nothing changes there.
        _ => None,
    }
}

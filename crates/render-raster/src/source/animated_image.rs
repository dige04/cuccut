//! `AnimatedImage`: the [`VisualSource`] implementation for GIF / APNG / animated WebP (design §7).
//!
//! Pure Rust decoding (`image` crate's `gif` / `png` / `webp` features); Windows and macOS use the same code; at render time there is no process, no I/O, no network.
//!
//! **Full frames resident**: `decode` decodes the entire animation once into premultiplied `Pixmap`s; `sample` is just a table lookup + `Arc::clone`. This is not laziness but the shortest path to random access — per-frame disposal / blend makes frame N's pixels depend on all previous frames; if we did not pre-decode we would have to hold "previous frame" state, which is exactly the incremental clock §7 explicitly forbids. The cost is memory, bounded by the frame count / byte double cap of [`PrepareCtx`].
//!
//! Disposal (GIF's `Background`/`Keep`/`Previous`, APNG's `dispose_op` + `blend_op`) and canvas compositing are handled by the `image` crate's `AnimationDecoder`: each frame it emits is already the **full canvas**'s final pixels, which is exactly the semantics this implementation wants.

use super::{
    ContentHash, MediaTime, PrepareCtx, SourceFrame, SourceKind, SourceLoop, SourceMetadata,
    VisualSource,
};
use anyhow::{Result, anyhow, bail};
use image::{AnimationDecoder, Delay, metadata::LoopCount};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::sync::Arc;
use tiny_skia::{IntSize, Pixmap};

/// Decoder identity in the fingerprint: once decoding semantics (disposal folding, premultiply rounding, delay rounding) change, the fingerprint must change too, otherwise old cache would feed new pixels.
const DECODER_TAG: &[u8] = b"ccut.source.animatedImage/v1\0";

/// Animated image resident budget exceeded; the caller decides the fallback by type and does not depend on the error text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimatedImageBudgetExceeded {
    Frames { actual: usize, limit: usize },
    Bytes { actual: usize, limit: usize },
}

impl std::fmt::Display for AnimatedImageBudgetExceeded {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            Self::Frames { actual, limit } => write!(
                f,
                "动图帧数 {actual} 超过上限 {limit}（先用 ffmpeg 抽帧或转成视频资产）"
            ),
            Self::Bytes { actual, limit } => write!(
                f,
                "动图解码后占用 {:.1} MiB 超过上限 {:.1} MiB（先缩小画幅或减帧）",
                actual as f64 / (1 << 20) as f64,
                limit as f64 / (1 << 20) as f64
            ),
        }
    }
}

impl std::error::Error for AnimatedImageBudgetExceeded {}

/// Container format (determined by magic bytes, not by extension — consistent with the serve upload entry).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnimatedFormat {
    Gif,
    Apng,
    WebP,
}

impl AnimatedFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            AnimatedFormat::Gif => "gif",
            AnimatedFormat::Apng => "apng",
            AnimatedFormat::WebP => "webp",
        }
    }

    /// Magic-number sniffing. `None` = not one of these three containers.
    pub fn sniff(bytes: &[u8]) -> Option<AnimatedFormat> {
        if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
            return Some(AnimatedFormat::Gif);
        }
        if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
            return Some(AnimatedFormat::Apng);
        }
        if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
            return Some(AnimatedFormat::WebP);
        }
        None
    }
}

pub struct AnimatedImage {
    format: AnimatedFormat,
    meta: SourceMetadata,
    frames: Vec<Arc<Pixmap>>,
    hash: ContentHash,
}

impl AnimatedImage {
    /// Bytes → decoded animated image source. `src` is used only for error location.
    pub fn decode(src: &str, bytes: &[u8], ctx: &PrepareCtx) -> Result<AnimatedImage> {
        let format = AnimatedFormat::sniff(bytes).ok_or_else(|| {
            anyhow!("{src}：animatedImage 资产必须是 GIF / APNG / WebP 容器（按魔数判定）")
        })?;
        let (loops, frames, starts) = match format {
            AnimatedFormat::Gif => {
                let d = image::codecs::gif::GifDecoder::new(Cursor::new(bytes))
                    .map_err(|e| anyhow!("{src}：GIF 解码失败：{e}"))?;
                collect(src, d, ctx)?
            }
            AnimatedFormat::Apng => {
                let d = image::codecs::png::PngDecoder::new(Cursor::new(bytes))
                    .map_err(|e| anyhow!("{src}：PNG 解码失败：{e}"))?;
                if !d.is_apng().map_err(|e| anyhow!("{src}：{e}"))? {
                    bail!(
                        "{src}：这是静态 PNG（没有 acTL 动画块）；静态图片请声明 type: \"image\""
                    );
                }
                let d = d.apng().map_err(|e| anyhow!("{src}：APNG 解码失败：{e}"))?;
                collect(src, d, ctx)?
            }
            AnimatedFormat::WebP => {
                let d = image::codecs::webp::WebPDecoder::new(Cursor::new(bytes))
                    .map_err(|e| anyhow!("{src}：WebP 解码失败：{e}"))?;
                if !d.has_animation() {
                    bail!("{src}：这是静态 WebP（没有 ANIM 块）；静态图片请声明 type: \"image\"");
                }
                collect(src, d, ctx)?
            }
        };
        let (width, height) = frames
            .first()
            .map(|p| (p.width(), p.height()))
            .ok_or_else(|| anyhow!("{src}：动图没有任何帧"))?;
        let total = starts.last().copied().unwrap_or(0);
        if total <= 0 {
            bail!(
                "{src}：动图总时长为 0（每帧 delay 都是 0）——本实现按字面取值，不做浏览器式的最小延时钳制；\
                 请修正素材，或声明为 type: \"image\" 用其首帧"
            );
        }
        let mut hasher = Sha256::new();
        hasher.update(DECODER_TAG);
        hasher.update(bytes);
        let hash = ContentHash::new(hasher.finalize().into());
        Ok(AnimatedImage {
            format,
            meta: SourceMetadata {
                kind: SourceKind::AnimatedImage,
                width,
                height,
                frame_starts_ms: starts,
                loops,
            },
            frames,
            hash,
        })
    }

    pub fn format(&self) -> AnimatedFormat {
        self.format
    }

    pub fn metadata(&self) -> &SourceMetadata {
        &self.meta
    }

    pub fn frame_count(&self) -> usize {
        self.frames.len()
    }

    /// Per-frame start-ms table (N+1 entries) — `HostInputs` backfills it to core; at recording time the source time is quantized to the frame start by it.
    pub fn frame_starts_ms(&self) -> &[i64] {
        &self.meta.frame_starts_ms
    }

    /// Direct access by index (for golden / tests; the render path always goes through [`VisualSource::sample`]).
    pub fn frame(&self, index: usize) -> Option<Arc<Pixmap>> {
        self.frames.get(index).cloned()
    }
}

impl VisualSource for AnimatedImage {
    fn kind(&self) -> SourceKind {
        SourceKind::AnimatedImage
    }

    fn probe(&self) -> Result<SourceMetadata> {
        Ok(self.meta.clone())
    }

    /// The animated image is fully resident at [`AnimatedImage::decode`] time; here only the budget is rechecked.
    /// (A hook reserved for Lottie: its sub-resources must be collected, hashed, and preloaded at this step.)
    fn prepare(&self, ctx: &PrepareCtx) -> Result<()> {
        check_budget(self.frames.len(), self.bytes_resident(), ctx)
    }

    fn sample(&self, time: MediaTime) -> Result<SourceFrame> {
        let index = self.meta.frame_at(time);
        let pixmap =
            self.frames.get(index).cloned().ok_or_else(|| {
                anyhow!("动图在 {time} 无帧可取（帧表 {} 项）", self.frames.len())
            })?;
        Ok(SourceFrame {
            index,
            start: MediaTime::from_millis(self.meta.frame_starts_ms[index]),
            pixmap,
        })
    }

    fn fingerprint(&self) -> ContentHash {
        self.hash
    }
}

impl AnimatedImage {
    fn bytes_resident(&self) -> usize {
        self.frames
            .iter()
            .map(|p| p.width() as usize * p.height() as usize * 4)
            .sum()
    }
}

impl std::fmt::Debug for AnimatedImage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AnimatedImage")
            .field("format", &self.format)
            .field("size", &(self.meta.width, self.meta.height))
            .field("frames", &self.frames.len())
            .field("duration", &self.meta.duration())
            .field("loops", &self.meta.loops)
            .finish()
    }
}

/// `AnimationDecoder` → (loop declaration, premultiplied frames, start-ms table).
fn collect<'a, D: AnimationDecoder<'a>>(
    src: &str,
    decoder: D,
    ctx: &PrepareCtx,
) -> Result<(SourceLoop, Vec<Arc<Pixmap>>, Vec<i64>)> {
    let loops = match decoder.loop_count() {
        LoopCount::Infinite => SourceLoop::Infinite,
        LoopCount::Finite(n) => SourceLoop::Finite(n.get()),
    };
    let mut frames = Vec::new();
    let mut starts = vec![0i64];
    let mut bytes = 0usize;
    let mut cursor = 0i64;
    for (i, frame) in decoder.into_frames().enumerate() {
        let frame = frame.map_err(|e| anyhow!("{src}：第 {i} 帧解码失败：{e}"))?;
        let delay = delay_ms(frame.delay());
        let buffer = frame.into_buffer();
        let (w, h) = (buffer.width(), buffer.height());
        if let Some(first) = frames
            .first()
            .map(|p: &Arc<Pixmap>| (p.width(), p.height()))
        {
            if first != (w, h) {
                bail!(
                    "{src}：第 {i} 帧尺寸 {w}×{h} 与画布 {}×{} 不一致（解码器应已合成到整幅画布）",
                    first.0,
                    first.1
                );
            }
        }
        bytes += w as usize * h as usize * 4;
        check_budget(frames.len() + 1, bytes, ctx).map_err(|e| e.context(src.to_owned()))?;
        frames.push(Arc::new(to_pixmap(src, buffer)?));
        cursor += delay;
        starts.push(cursor);
    }
    if frames.is_empty() {
        bail!("{src}：动图没有任何帧");
    }
    Ok((loops, frames, starts))
}

fn check_budget(frames: usize, bytes: usize, ctx: &PrepareCtx) -> Result<()> {
    if frames > ctx.max_frames {
        return Err(AnimatedImageBudgetExceeded::Frames {
            actual: frames,
            limit: ctx.max_frames,
        }
        .into());
    }
    if bytes > ctx.max_bytes {
        return Err(AnimatedImageBudgetExceeded::Bytes {
            actual: bytes,
            limit: ctx.max_bytes,
        }
        .into());
    }
    Ok(())
}

/// `Delay` → ms. Integer rounding (`round(n/d) = (2n + d) / 2d`); the whole path uses integer arithmetic — floats offer no benefit here, only cross-platform rounding risk.
fn delay_ms(delay: Delay) -> i64 {
    let (numer, denom) = delay.numer_denom_ms();
    let (n, d) = (i64::from(numer), i64::from(denom));
    if d <= 0 {
        n.max(0)
    } else {
        (2 * n + d) / (2 * d)
    }
}

/// Decode only the first frame (premultiplied): when an animation exceeds the budget or its total duration is 0, fall back to drawing it. Does not depend on the `media` feature, so the preview's wasm can use it too.
pub fn decode_first_frame(src: &str, bytes: &[u8]) -> Result<Pixmap> {
    let image = image::load_from_memory(bytes).map_err(|e| anyhow!("{src}：解不开：{e}"))?;
    to_pixmap(src, image.to_rgba8())
}

/// Straight RGBA (`image`'s output) → premultiplied (tiny-skia's pixel format).
fn to_pixmap(src: &str, buffer: image::RgbaImage) -> Result<Pixmap> {
    let (w, h) = (buffer.width(), buffer.height());
    let size = IntSize::from_wh(w, h).ok_or_else(|| anyhow!("{src}：零尺寸动图帧"))?;
    let mut raw = buffer.into_raw();
    for px in raw.chunks_exact_mut(4) {
        let pm = tiny_skia::ColorU8::from_rgba(px[0], px[1], px[2], px[3]).premultiply();
        px[0] = pm.red();
        px[1] = pm.green();
        px[2] = pm.blue();
        px[3] = pm.alpha();
    }
    Pixmap::from_vec(raw, size).ok_or_else(|| anyhow!("{src}：动图帧构造失败"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn magic_numbers_pick_the_container() {
        assert_eq!(
            AnimatedFormat::sniff(b"GIF89a....."),
            Some(AnimatedFormat::Gif)
        );
        assert_eq!(
            AnimatedFormat::sniff(b"GIF87a....."),
            Some(AnimatedFormat::Gif)
        );
        assert_eq!(
            AnimatedFormat::sniff(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
            Some(AnimatedFormat::Apng)
        );
        assert_eq!(
            AnimatedFormat::sniff(b"RIFF\0\0\0\0WEBPVP8X"),
            Some(AnimatedFormat::WebP)
        );
        assert_eq!(AnimatedFormat::sniff(b"\xff\xd8\xff\xe0"), None);
        assert_eq!(AnimatedFormat::sniff(b""), None);
    }

    #[test]
    fn delays_round_to_whole_milliseconds() {
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(100, 1)), 100);
        // GIF's 10 ms unit
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(30, 1)), 30);
        // APNG's fractional delay: 1/25 s = 40 ms
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(1000, 25)), 40);
        // 1/30 s ≈ 33.33ms → 33
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(1000, 30)), 33);
        // 1/24 s ≈ 41.67ms → 42
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(1000, 24)), 42);
        assert_eq!(delay_ms(Delay::from_numer_denom_ms(0, 1)), 0);
    }

    #[test]
    fn premultiply_keeps_colour_within_alpha() {
        let mut buf = image::RgbaImage::new(2, 1);
        buf.put_pixel(0, 0, image::Rgba([255, 255, 255, 128]));
        buf.put_pixel(1, 0, image::Rgba([255, 0, 0, 0]));
        let pm = to_pixmap("t", buf).unwrap();
        let data = pm.data();
        assert!(data[0] <= data[3], "premultiplied 分量不得超过 alpha");
        assert_eq!(data[3], 128);
        assert_eq!(&data[4..8], &[0, 0, 0, 0], "全透明像素折为零");
    }
}

//! Frame-by-frame composition and encoding. Output frame k's sequence time is `start + k / fps` (an exact value, architecture design §9.10). When the output frame rate differs from the sequence frame rate, the frame plan takes instances from the sequence frame containing this time, and the video takes its frame at the source time this time maps to.
//! Decoding and encoding both prefer the platform-native path, with ffmpeg as fallback ([`crate::native`]). Which path was used, and why fallback happened, is recorded in `video` of `done`.

use std::collections::HashSet;
use std::io::{BufRead, Read};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use font_files::FontFace;
use frame_render::{FrameRenderer, RenderError, RenderOptions, UnsupportedItem};
use media_core::encode::{EncodeSettings, Encoder, QueuedEncoder};
use render_graph::plan_frame;
use render_graph::video_plan::PictureRect;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::input::{Input, InputFont, OnUnsupported};
use crate::native::{self, EncoderPlan, Fallback};
use crate::preflight;
use crate::sources::Sources;
use crate::{Failure, emit};

/// Progress is reported at most this often.
pub(crate) const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
/// Number of frames queued to be written into the encoder (one 1080p RGBA frame is 8.3 MB; the pool has one more being drawn).
const ENCODE_QUEUE: usize = 2;

fn render_failure(error: RenderError) -> Failure {
    Failure {
        code: error.code,
        message: error.message,
        details: if error.items.is_empty() {
            Value::Null
        } else {
            json!({ "items": error.items })
        },
    }
}

/// Set when `cancel` is received on stdin or stdin is closed.
pub(crate) fn watch_cancel() -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    let set = Arc::clone(&flag);
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            match line {
                Ok(line) if line.trim() == "cancel" => break,
                Ok(_) => continue,
                Err(_) => break,
            }
        }
        set.store(true, Ordering::SeqCst);
    });
    flag
}

pub fn run(path: &Path) -> Result<ExitCode, Failure> {
    let cancel = watch_cancel();
    let input = Input::load(path)?;
    let tools = input.tools();
    let report = preflight::run(&input, &tools)?;
    if !report.missing_encoders.is_empty() {
        let mut failure = Failure::new(
            "EXPORT_TOOL_MISSING",
            format!("本机的 ffmpeg 没有编码器 {}", report.missing_encoders.join("、")),
        );
        failure.details = json!({ "missing": report.missing_encoders });
        return Err(failure);
    }
    let skip = input.on_unsupported == OnUnsupported::Skip;
    if !report.items.is_empty() && !skip {
        let mut failure = Failure::new(
            "EXPORT_UNSUPPORTED_CONTENT",
            report.items.iter().map(|i| i.message.clone()).collect::<Vec<_>>().join("；"),
        );
        failure.details = json!({ "items": report.items });
        return Err(failure);
    }
    let settings = input.encode_settings()?;
    // Drawn to the canvas at the size of the picture block. When smaller than the output, it is placed onto a black output frame (letterboxing); the layout is not rescaled to the output's aspect ratio.
    let picture = input.output.picture();
    let boxed = Letterbox::new(input.output.width, input.output.height, picture);
    let mut renderer = FrameRenderer::new(
        RenderOptions {
            width: picture.width,
            height: picture.height,
            skip_unsupported: skip,
            captions: input.burn_captions,
        },
        preflight::documents(&input),
        frame_render::bundled_fonts(),
    )
    .map_err(render_failure)?;
    renderer.set_speakers(input.speakers.clone().map(Arc::new));
    // Frozen local fonts are loaded before the first frame is drawn; after that the machine is not searched again. The export is drawn with the frozen fonts and does not change with fonts installed on the machine later.
    let fonts = frozen_fonts(&input.fonts)?;
    if !fonts.is_empty() {
        renderer.add_fonts(fonts);
    }
    let mut sources = Sources::new(&input, tools.clone(), report.pictures.clone(), skip);
    // Writing to the encoder happens on a separate thread: the composition thread hands a frame to the queue and draws the next frame straight away (the frame count in `progress` is the number handed to the queue).
    let (mut encoder, encoder_backend, encoder_fallback) = start_encoder(&input, &tools, &settings, &report)?;
    let view = input.document.view();
    let total = report.frames;
    let started = Instant::now();
    let mut reported = Instant::now() - PROGRESS_INTERVAL;
    emit(&json!({ "event": "progress", "frame": 0, "total": total }));
    for k in 0..total {
        if cancel.load(Ordering::SeqCst) {
            encoder.abort();
            sources.close();
            emit(&json!({ "event": "cancelled", "frame": k, "total": total }));
            return Ok(ExitCode::from(3));
        }
        sources.begin_frame(k);
        let step = (|| -> Result<(), Failure> {
            let t = input.frame_time(k)?;
            let plan = plan_frame(view, &input.sequence_id, t).map_err(|e| Failure::new(&e.code, e.message))?;
            renderer.render(view, &plan, t.to_f64(), &mut sources).map_err(render_failure)?;
            let encode_failure = |e: media_core::MediaError| Failure::new(e.code, e.message);
            let mut frame = encoder.buffer().map_err(encode_failure)?;
            boxed.place(renderer.frame().data(), &mut frame);
            encoder.submit(frame).map_err(encode_failure)
        })();
        if let Err(failure) = step {
            encoder.abort();
            sources.close();
            return Err(failure);
        }
        if reported.elapsed() >= PROGRESS_INTERVAL || k + 1 == total {
            reported = Instant::now();
            emit(&json!({ "event": "progress", "frame": k + 1, "total": total }));
        }
    }
    if cancel.load(Ordering::SeqCst) {
        encoder.abort();
        sources.close();
        emit(&json!({ "event": "cancelled", "frame": total, "total": total }));
        return Ok(ExitCode::from(3));
    }
    let restarts = sources.restarts();
    sources.close();
    encoder.finish().map_err(|e| Failure::new(e.code, e.message))?;
    let mut seen = HashSet::new();
    let skipped: Vec<UnsupportedItem> = report
        .items
        .iter()
        .chain(renderer.skipped())
        .chain(sources.skipped())
        .filter(|item| seen.insert(item.key()))
        .cloned()
        .collect();
    let mut warnings: Vec<Value> = report.warnings.iter().map(|w| json!(w)).collect();
    warnings.extend(renderer.warnings().iter().map(|w| json!(w)));
    let seconds = started.elapsed().as_secs_f64();
    let decode = sources.decode_report();
    let fallbacks: Vec<Fallback> = decode.fallbacks.into_iter().chain(encoder_fallback).collect();
    emit(&json!({
        "event": "done",
        "frames": total,
        "skipped": skipped,
        "warnings": warnings,
        "decoderRestarts": restarts,
        "renderSeconds": (seconds * 1000.0).round() / 1000.0,
        "video": {
            "decoder": decode.decoder,
            "encoder": encoder_backend,
            "fallbacks": fallbacks,
        },
    }));
    Ok(ExitCode::SUCCESS)
}

/// Starts the encode queue: uses the native writer on the path chosen by preflight, and falls back to ffmpeg if native fails to open (fails with `EXPORT_TOOL_MISSING` when encoders are missing).
/// Returns the queue, the encode backend name, and the fallback records.
fn start_encoder(
    input: &Input,
    tools: &media_core::Tools,
    settings: &EncodeSettings,
    report: &preflight::Preflight,
) -> Result<(QueuedEncoder, &'static str, Option<Fallback>), Failure> {
    let media_failure = |e: media_core::MediaError| Failure::new(e.code, e.message);
    let path = input.output.path.clone();
    let fallback = match &report.encoder {
        EncoderPlan::Native(options) => {
            let options = options.clone();
            let frame_bytes = settings.width as usize * settings.height as usize * 4;
            let target = path.clone();
            match QueuedEncoder::spawn(frame_bytes, ENCODE_QUEUE, Letterbox::BAR, move || {
                native::open_sink(target, &options)
            }) {
                Ok(queued) => return Ok((queued, media_native::encode_backend(), None)),
                Err(e) => {
                    let fallback = Fallback::encoder("open-failed", e.message);
                    if !report.ffmpeg_missing.is_empty() {
                        let mut failure = Failure::new(
                            "EXPORT_TOOL_MISSING",
                            format!(
                                "原生编码器打不开（{}），本机的 ffmpeg 又没有编码器 {}",
                                fallback.message,
                                report.ffmpeg_missing.join("、")
                            ),
                        );
                        failure.details = json!({ "missing": report.ffmpeg_missing });
                        return Err(failure);
                    }
                    fallback
                }
            }
        }
        EncoderPlan::Ffmpeg(fallback) => fallback.clone(),
    };
    let encoder = Encoder::start(tools, settings, &path).map_err(media_failure)?;
    Ok((QueuedEncoder::new(encoder, ENCODE_QUEUE, Letterbox::BAR), "ffmpeg", Some(fallback)))
}

/// Frozen local fonts (architecture design §9.11 “fonts”): by the file and the face index recorded at freeze time, extracts that one face (same extraction as the preview). If the file is gone, or its byte count or digest differs from freeze time, it fails with `FONT_MISSING`, so the export does not silently swap in another font. Families that were not found at freeze time are not here; they are drawn with the fallback font, and the renderer reports a notice. The same file is verified only once, and the same face is loaded only once.
fn frozen_fonts(frozen: &[InputFont]) -> Result<Vec<Arc<Vec<u8>>>, Failure> {
    let mut checked: HashSet<PathBuf> = HashSet::new();
    let mut loaded: HashSet<(PathBuf, u32)> = HashSet::new();
    let mut fonts = Vec::new();
    for font in frozen {
        if !loaded.insert((font.path.clone(), font.face_index)) {
            continue;
        }
        let missing = |reason: &str, why: String| {
            let mut failure = Failure::new(
                "FONT_MISSING",
                format!("字体无法复现：「{}」用的本机字体 {} {why}", font.family, font.path.display()),
            );
            failure.details = json!({
                "family": font.family,
                "weight": font.weight,
                "italic": font.italic,
                "path": font.path,
                "reason": reason,
            });
            failure
        };
        if checked.insert(font.path.clone()) {
            let digest = file_digest(&font.path).map_err(|e| missing("missing", format!("读不到了（{e}）")))?;
            if digest != (font.byte_length, font.content_hash.clone()) {
                return Err(missing("changed", "与导出开始时不一样了".into()));
            }
        }
        let face = FontFace {
            path: font.path.clone(),
            index: font.face_index,
            file_len: font.byte_length,
        };
        let bytes =
            font_files::read_face(&face).map_err(|e| missing("unreadable", format!("抽不出第 {} 个字体（{e}）", font.face_index)))?;
        fonts.push(Arc::new(bytes));
    }
    Ok(fonts)
}

/// File byte count and content digest (`sha256:` followed by hex, in the same format the Runtime uses when freezing assets and fonts).
fn file_digest(path: &Path) -> std::io::Result<(u64, String)> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    let mut total = 0u64;
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
        total += n as u64;
    }
    let hex: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    Ok((total, format!("sha256:{hex}")))
}

/// Output frame: when the picture and the output are the same size, the whole frame is copied into the encode queue's buffer; otherwise the picture is copied row by row into the picture block. The buffer comes from the encode queue's pool and is initially filled with opaque black (RGBA 0, 0, 0, 255). When recycled it is left as is, so the black bars outside the picture are not rewritten.
struct Letterbox {
    picture: PictureRect,
    full: bool,
    stride: usize,
}

impl Letterbox {
    /// The color of the black bars, which is also the color the encode queue's buffer is initially filled with.
    const BAR: [u8; 4] = [0, 0, 0, 255];

    fn new(width: u32, height: u32, picture: PictureRect) -> Letterbox {
        Letterbox {
            picture,
            full: picture.x == 0 && picture.y == 0 && picture.width == width && picture.height == height,
            stride: width as usize * 4,
        }
    }

    /// Writes the picture into output frame `frame` (the black bars are already filled).
    fn place(&self, picture: &[u8], frame: &mut [u8]) {
        if self.full {
            frame.copy_from_slice(picture);
            return;
        }
        let p = self.picture;
        let row = p.width as usize * 4;
        for (y, line) in picture.chunks_exact(row).take(p.height as usize).enumerate() {
            let at = (p.y as usize + y) * self.stride + p.x as usize * 4;
            frame[at..at + row].copy_from_slice(line);
        }
    }

    #[cfg(test)]
    fn frame(&self, height: u32) -> Vec<u8> {
        Self::BAR.repeat(self.stride / 4 * height as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frozen(path: &Path, bytes: &[u8]) -> InputFont {
        let hex: String = Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect();
        InputFont {
            family: "Permanent Marker".into(),
            weight: 400,
            italic: false,
            path: path.to_path_buf(),
            face_index: 0,
            content_hash: format!("sha256:{hex}"),
            byte_length: bytes.len() as u64,
        }
    }

    /// The frozen font is verified by digest and then extracted and loaded (the same face is loaded only once). A changed or missing file is `FONT_MISSING`; the font is not silently swapped.
    #[test]
    fn frozen_fonts_load_only_when_the_file_is_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../render-raster/assets/fonts/PermanentMarker-Regular.ttf");
        let bytes = std::fs::read(&source).unwrap();
        let path = dir.path().join("marker.ttf");
        std::fs::write(&path, &bytes).unwrap();
        let font = frozen(&path, &bytes);
        let fonts = frozen_fonts(&[font.clone(), font.clone()]).unwrap();
        assert_eq!(fonts.len(), 1);
        assert_eq!(*fonts[0], font_files::extract_face(&bytes, 0).unwrap());

        let mut changed = bytes.clone();
        let last = changed.len() - 1;
        changed[last] ^= 1;
        std::fs::write(&path, &changed).unwrap();
        let failure = frozen_fonts(std::slice::from_ref(&font)).unwrap_err();
        assert_eq!(failure.code, "FONT_MISSING");
        assert_eq!(failure.details["reason"], "changed");
        assert!(failure.message.starts_with("字体无法复现"), "{}", failure.message);

        std::fs::remove_file(&path).unwrap();
        let failure = frozen_fonts(&[font]).unwrap_err();
        assert_eq!(
            (failure.code.as_str(), &failure.details["reason"]),
            ("FONT_MISSING", &json!("missing"))
        );
        assert!(frozen_fonts(&[]).unwrap().is_empty());
    }

    /// Black bars and picture: the picture is placed row by row in the centered block, and the rest is opaque black. Passed through as is when it is the same size as the output.
    #[test]
    fn the_picture_lands_centred_between_opaque_black_bars() {
        let picture = PictureRect {
            x: 2,
            y: 0,
            width: 4,
            height: 2,
        };
        // Each pixel is colored by its coordinates, so it is easy to see where it lands.
        let source: Vec<u8> = (0..2u8)
            .flat_map(|y| (0..4u8).flat_map(move |x| [10 + x, 20 + y, 200, 255]))
            .collect();
        let boxed = Letterbox::new(8, 2, picture);
        let mut frame = boxed.frame(2);
        boxed.place(&source, &mut frame);
        assert_eq!(frame.len(), 8 * 2 * 4);
        for y in 0..2usize {
            for x in 0..8usize {
                let px = &frame[(y * 8 + x) * 4..][..4];
                if (2..6).contains(&x) {
                    assert_eq!(px, [10 + (x - 2) as u8, 20 + y as u8, 200, 255], "({x}, {y})");
                } else {
                    assert_eq!(px, [0, 0, 0, 255], "({x}, {y})");
                }
            }
        }
        // Top and bottom black bars.
        let tall = Letterbox::new(
            2,
            6,
            PictureRect {
                x: 0,
                y: 2,
                width: 2,
                height: 2,
            },
        );
        let mut frame = tall.frame(6);
        tall.place(&[255; 16], &mut frame);
        let rows: Vec<&[u8]> = frame.chunks(8).collect();
        assert_eq!(rows[1], [0, 0, 0, 255, 0, 0, 0, 255]);
        assert_eq!(rows[2], [255; 8]);
        assert_eq!(rows[4], [0, 0, 0, 255, 0, 0, 0, 255]);
        // Full-bleed: copy the whole frame as is.
        let full = Letterbox::new(
            4,
            2,
            PictureRect {
                x: 0,
                y: 0,
                width: 4,
                height: 2,
            },
        );
        let mut frame = vec![7; 4 * 2 * 4];
        full.place(&source, &mut frame);
        assert_eq!(frame, source);
    }
}

//! Probing before starting: the media's picture size (width and height already swapped per the rotation metadata), whether it has transparency, and which encoders the local ffmpeg has.

use std::collections::BTreeSet;
use std::path::Path;
use std::process::{Command, Stdio};

use serde_json::Value;

use crate::{MediaError, Tools, tail};

/// Display size and whether it has transparency, for the media's first video stream (an image also counts as a video stream).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PictureInfo {
    pub width: u32,
    pub height: u32,
    /// The picture may have transparency: its pixel format has an alpha component, the format is not recognised, or the container flags alpha (`alpha_mode`; a transparent VP9 WebM
    /// has a pixel format written as `yuv420p`, which has no alpha). When `false`, the decoded RGBA is always opaque.
    pub alpha: bool,
}

/// ffmpeg pixel formats known to have no alpha component (matched by prefix). Anything not listed here (including `yuva*`, `rgba`, `gbrap*`, `ya*`, `pal8`, and
/// unrecognised ones) is treated as possibly transparent.
const OPAQUE_PIX_FMTS: &[&str] = &[
    "yuv", "nv", "p01", "p21", "p41", "gray", "rgb24", "bgr24", "rgb48", "bgr48", "gbrp", "0rgb", "rgb0", "0bgr", "bgr0", "x2rgb10",
    "x2bgr10", "uyvy422", "yuyv422", "yvyu422", "monow", "monob", "xv30", "xv36", "y210", "y212", "vuyx",
];

/// The pixel format is known to have no alpha.
pub fn opaque_pix_fmt(name: &str) -> bool {
    !name.starts_with("yuva") && OPAQUE_PIX_FMTS.iter().any(|prefix| name.starts_with(prefix))
}

/// Probe the media's picture. `None` if there is no video stream; reports `EXPORT_DECODE_FAILED` if ffprobe cannot read the file.
pub fn probe_picture(tools: &Tools, path: &Path) -> Result<Option<PictureInfo>, MediaError> {
    let output = Command::new(&tools.ffprobe)
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries"])
        .arg("stream=width,height,pix_fmt:stream_tags=alpha_mode:stream_side_data=rotation")
        .args(["-of", "json"])
        .arg(path)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| MediaError::spawn(&tools.ffprobe, e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::new(
            "EXPORT_DECODE_FAILED",
            format!("ffprobe 读不了这个文件：{}", tail(&stderr, 3)),
        ));
    }
    let value: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| MediaError::new("EXPORT_DECODE_FAILED", format!("ffprobe 的输出读不懂：{e}")))?;
    let Some(stream) = value.get("streams").and_then(Value::as_array).and_then(|s| s.first()) else {
        return Ok(None);
    };
    let dimension = |key: &str| {
        stream
            .get(key)
            .and_then(Value::as_u64)
            .and_then(|v| u32::try_from(v).ok())
            .filter(|v| *v > 0)
    };
    let (Some(width), Some(height)) = (dimension("width"), dimension("height")) else {
        return Ok(None);
    };
    let rotation = stream
        .get("side_data_list")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find_map(|side| side.get("rotation").and_then(Value::as_f64))
        .unwrap_or(0.0);
    let opaque = stream.get("pix_fmt").and_then(Value::as_str).is_some_and(opaque_pix_fmt);
    let alpha_mode = stream
        .get("tags")
        .and_then(|tags| tags.get("alpha_mode"))
        .and_then(Value::as_str)
        .is_some_and(|mode| mode.trim() == "1");
    let alpha = !opaque || alpha_mode;
    let quarter = (rotation / 90.0).round() as i64;
    Ok(Some(if quarter.rem_euclid(2) == 1 {
        PictureInfo {
            width: height,
            height: width,
            alpha,
        }
    } else {
        PictureInfo { width, height, alpha }
    }))
}

/// Encoder names of the local ffmpeg (the second column of `ffmpeg -encoders`).
pub fn encoders(tools: &Tools) -> Result<BTreeSet<String>, MediaError> {
    let output = Command::new(&tools.ffmpeg)
        .args(["-hide_banner", "-nostdin", "-encoders"])
        .stdin(Stdio::null())
        .output()
        .map_err(|e| MediaError::spawn(&tools.ffmpeg, e))?;
    if !output.status.success() {
        return Err(MediaError::new("EXPORT_TOOL_MISSING", "ffmpeg -encoders 失败"));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut names = BTreeSet::new();
    let mut listing = false;
    for line in text.lines() {
        // The separator line after the header is ` ------`.
        if line.trim_start().starts_with("------") {
            listing = true;
            continue;
        }
        if !listing {
            continue;
        }
        let mut fields = line.split_whitespace();
        if let (Some(_flags), Some(name)) = (fields.next(), fields.next()) {
            names.insert(name.to_string());
        }
    }
    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::opaque_pix_fmt;

    #[test]
    fn only_known_opaque_pixel_formats_skip_alpha() {
        for name in [
            "yuv420p",
            "yuvj420p",
            "yuv422p10le",
            "nv12",
            "p010le",
            "gray",
            "rgb24",
            "gbrp10le",
            "bgr0",
        ] {
            assert!(opaque_pix_fmt(name), "{name}");
        }
        for name in [
            "yuva420p",
            "yuva444p10le",
            "rgba",
            "bgra",
            "argb",
            "gbrap",
            "ya8",
            "pal8",
            "rgba64be",
            "",
            "new_fmt",
        ] {
            assert!(!opaque_pix_fmt(name), "{name}");
        }
    }
}

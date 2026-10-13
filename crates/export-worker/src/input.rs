//! Export input (JSON file written by the Runtime): frozen sequence and assets, document bodies, asset locations, output settings, and tool locations.

use std::path::{Path, PathBuf};

use editor_semantics::{MediaTime, Rate, Ratio, frame_time, frames_at};
use frame_render::{FrozenDocument, SpeakerActivity};
use media_core::Tools;
use media_core::encode::{AudioTrack, Container, EncodeSettings, Quality, VideoCodec};
use render_graph::PlanDocument;
use render_graph::video_plan::PictureRect;
use serde::Deserialize;

use crate::Failure;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    /// Video used for per-frame plan computation (the `document` of the engine's `exports.plan`).
    pub document: PlanDocument,
    pub sequence_id: String,
    /// Exact range of sequence time `[start, end)`.
    pub range: InputRange,
    #[serde(default)]
    pub documents: Vec<FrozenDocument>,
    /// Intervals during which each speaker talks on the sequence (the engine `exports.plan`'s `speakers`, used by waveforms when `speaker` is set); when absent, treated as no transcript in the video.
    #[serde(default)]
    pub speakers: Option<SpeakerActivity>,
    pub assets: Vec<InputAsset>,
    /// Frozen local font face (architecture design §9.11 “fonts”): before the first frame is drawn, it is checked against its digest, extracted, and loaded into the renderer.
    #[serde(default)]
    pub fonts: Vec<InputFont>,
    pub output: OutputSettings,
    #[serde(default = "yes")]
    pub burn_captions: bool,
    #[serde(default)]
    pub on_unsupported: OnUnsupported,
    pub tools: InputTools,
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
pub struct InputRange {
    pub start: MediaTime,
    pub end: MediaTime,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputAsset {
    pub asset_id: String,
    pub revision: String,
    /// Absolute path.
    pub path: PathBuf,
    #[serde(default)]
    pub media_type: Option<String>,
}

/// A local font face found at freeze time: the file it lives in (absolute path), its index within the file, and the digest and byte count of the whole file.
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputFont {
    pub family: String,
    pub weight: u16,
    pub italic: bool,
    pub path: PathBuf,
    pub face_index: u32,
    /// `sha256:` followed by hex.
    pub content_hash: String,
    pub byte_length: u64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OnUnsupported {
    #[default]
    Fail,
    Skip,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
    pub path: PathBuf,
    pub format: String,
    #[serde(default)]
    pub codec: Option<String>,
    pub width: u32,
    pub height: u32,
    pub fps: Rate,
    #[serde(default)]
    pub crf: Option<u32>,
    #[serde(default)]
    pub bitrate_kbps: Option<u32>,
    #[serde(default)]
    pub audio: Option<OutputAudio>,
    /// Position of the picture in the output (the `output.picture` of the engine's `exports.plan`): when absent, it fills the output; when smaller than the output, it is drawn inside that block with black bars around the rest.
    #[serde(default)]
    pub picture: Option<PictureRect>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputAudio {
    pub path: PathBuf,
    pub bitrate_kbps: u32,
}

#[derive(Deserialize)]
pub struct InputTools {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
}

impl OutputSettings {
    /// Position of the picture in the output: when unspecified, it fills the output.
    pub fn picture(&self) -> PictureRect {
        self.picture.unwrap_or(PictureRect {
            x: 0,
            y: 0,
            width: self.width,
            height: self.height,
        })
    }
}

fn invalid(message: impl Into<String>) -> Failure {
    Failure::new("INVALID_PARAMS", message)
}

impl Input {
    pub fn load(path: &Path) -> Result<Input, Failure> {
        let text = std::fs::read_to_string(path).map_err(|e| invalid(format!("读导出输入失败：{e}")))?;
        let input: Input = serde_json::from_str(&text).map_err(|e| invalid(format!("导出输入读不懂：{e}")))?;
        input.output.fps.validate("output.fps").map_err(|e| invalid(format!("{e:?}")))?;
        let (w, h) = (input.output.width, input.output.height);
        if w == 0 || h == 0 || w % 2 == 1 || h % 2 == 1 || w > 8192 || h > 8192 {
            return Err(invalid(format!("输出尺寸 {w}×{h} 不可用：宽高要是 2 到 8192 之间的偶数")));
        }
        let p = input.output.picture();
        let fits = p.x.checked_add(p.width).is_some_and(|r| r <= w) && p.y.checked_add(p.height).is_some_and(|b| b <= h);
        if p.width < 2 || p.height < 2 || p.width % 2 == 1 || p.height % 2 == 1 || !fits {
            return Err(invalid(format!(
                "画面 {}×{}（{}, {}）不可用：宽高要是不小于 2 的偶数，并且在输出 {w}×{h} 里",
                p.width, p.height, p.x, p.y
            )));
        }
        Ok(input)
    }

    pub fn tools(&self) -> Tools {
        Tools {
            ffmpeg: self.tools.ffmpeg.clone(),
            ffprobe: self.tools.ffprobe.clone(),
        }
    }

    pub fn range(&self) -> Result<(Ratio, Ratio), Failure> {
        let start = self.range.start.to_ratio("range.start").map_err(|e| invalid(format!("{e:?}")))?;
        let end = self.range.end.to_ratio("range.end").map_err(|e| invalid(format!("{e:?}")))?;
        if start.is_negative() || end <= start {
            return Err(Failure::new("EXPORT_RANGE_EMPTY", "导出范围是空的"));
        }
        Ok((start, end))
    }

    /// Number of output frames: range length times output frame rate, rounded up (the last frame covers the tail of the range).
    pub fn frame_count(&self) -> Result<u64, Failure> {
        let (start, end) = self.range()?;
        let duration = end.checked_sub(start).ok_or_else(|| invalid("范围超出范围"))?;
        let frames = frames_at(duration, self.output.fps).ok_or_else(|| invalid("范围超出范围"))?.ceil();
        u64::try_from(frames).map_err(|_| invalid("帧数超出范围"))
    }

    /// Sequence time of output frame `k`: `start + k / fps`, an exact value.
    pub fn frame_time(&self, k: u64) -> Result<Ratio, Failure> {
        let (start, _) = self.range()?;
        frame_time(k as i128, self.output.fps)
            .and_then(|t| start.checked_add(t))
            .ok_or_else(|| invalid("帧时刻超出范围"))
    }

    pub fn container(&self) -> Result<Container, Failure> {
        Container::parse(&self.output.format).ok_or_else(|| invalid(format!("不认识的成片格式 {}", self.output.format)))
    }

    pub fn codec(&self) -> Result<VideoCodec, Failure> {
        let container = self.container()?;
        let codec = match &self.output.codec {
            Some(name) => VideoCodec::parse(name).ok_or_else(|| invalid(format!("不认识的视频编码 {name}")))?,
            None => container.default_codec(),
        };
        if !container.accepts(codec) {
            return Err(invalid(format!("{} 不能放进 {}", codec.name(), self.output.format)));
        }
        Ok(codec)
    }

    pub fn encode_settings(&self) -> Result<EncodeSettings, Failure> {
        let codec = self.codec()?;
        let quality = match (self.output.bitrate_kbps, self.output.crf) {
            (Some(kbps), _) => Quality::BitrateKbps(kbps),
            (None, Some(crf)) if crf <= codec.max_crf() => Quality::Crf(crf),
            (None, Some(crf)) => {
                return Err(invalid(format!(
                    "{} 的 CRF 在 0 到 {} 之间，给的是 {crf}",
                    codec.name(),
                    codec.max_crf()
                )));
            }
            (None, None) => Quality::Crf(codec.default_crf()),
        };
        let frames = self.frame_count()?;
        Ok(EncodeSettings {
            width: self.output.width,
            height: self.output.height,
            fps_num: self.output.fps.num,
            fps_den: self.output.fps.den,
            codec,
            container: self.container()?,
            quality,
            audio: self.output.audio.as_ref().map(|a| AudioTrack {
                path: a.path.clone(),
                bitrate_kbps: a.bitrate_kbps,
            }),
            duration_seconds: frames as f64 * self.output.fps.den as f64 / self.output.fps.num as f64,
        })
    }

    pub fn asset(&self, id: &str, revision: &str) -> Option<&InputAsset> {
        self.assets.iter().find(|a| a.asset_id == id && a.revision == revision)
    }

    /// PTS origin of the asset version (seconds): source time 0 corresponds to it.
    pub fn pts_origin(&self, id: &str, revision: &str) -> f64 {
        self.document
            .assets
            .get(id)
            .and_then(|asset| asset.revisions.get(revision))
            .and_then(|r| r.video.as_ref())
            .and_then(|v| v.pts_origin.to_ratio("ptsOrigin").ok())
            .map_or(0.0, Ratio::to_f64)
    }
}

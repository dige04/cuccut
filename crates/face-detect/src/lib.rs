//! 人脸检测：YuNet（OpenCV Zoo 的 `face_detection_yunet_2023mar.onnx`，MIT）经 tract 推理。
//!
//! 模型的输入固定为 `[1, 3, 640, 640]`：帧按比例缩到能放进 640 × 640，贴在左上角，其余补 0（与 OpenCV `FaceDetectorYN`
//! 向右、向下补齐的做法一致）；像素是 BGR、0–255 的浮点，不减均值不除方差（`blobFromImage` 的缺省）。输出按 8、16、32
//! 三档步长各有 cls / obj / bbox / kps 四个张量，解码与 OpenCV `modules/objdetect/src/face_detect.cpp` 的 `postProcess` 相同：
//! 分数 `sqrt(cls · obj)`，框心 `(列 + dx) · 步长`、`(行 + dy) · 步长`，宽高 `exp(dw) · 步长`、`exp(dh) · 步长`，再做 NMS。
//! 结果换回原帧的坐标并按帧的宽高归一化到 0–1，与取帧时缩到多大无关。

use std::path::Path;

use image::{DynamicImage, RgbImage, imageops::FilterType};
use serde::Serialize;
use tract_onnx::prelude::*;

/// 模型的输入边长（像素）。
pub const INPUT_SIZE: usize = 640;
/// 三档步长，与模型输出的顺序一致。
const STRIDES: [usize; 3] = [8, 16, 32];
/// 低于这个分数的候选不要。OpenCV Zoo 的示例用 0.9；访谈里侧脸的分数常在 0.7–0.9，取 0.6 以免漏掉侧脸，误检靠 NMS 与面积筛掉。
pub const SCORE_THRESHOLD: f32 = 0.6;
/// NMS 的 IoU 阈值（OpenCV Zoo 示例的缺省）。
pub const NMS_THRESHOLD: f32 = 0.3;
/// 一帧最多报这么多张脸（按分数从高到低）。
pub const MAX_FACES: usize = 20;

/// 一张脸：框的左上角与宽高，按帧的宽高归一化到 0–1；`score` 是 0–1 的置信度。
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Face {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub score: f64,
}

type Plan = Arc<TypedRunnableModel>;

/// 载入好的检测器：一次载入，逐帧调用。
pub struct FaceDetector {
    plan: Plan,
}

impl FaceDetector {
    /// 从 ONNX 文件载入并优化模型。
    pub fn load(model: &Path) -> TractResult<Self> {
        let size = INPUT_SIZE as i64;
        let plan = tract_onnx::onnx()
            .model_for_path(model)?
            .with_input_fact(0, f32::fact([1, 3, size as usize, size as usize]).into())?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self { plan })
    }

    /// 检测一个图片文件（PNG 或 JPEG）。返回脸与图片的像素尺寸。
    pub fn detect_file(&self, file: &Path) -> TractResult<(Vec<Face>, u32, u32)> {
        let image = image::open(file).map_err(|error| anyhow::anyhow!("cannot decode {}: {error}", file.display()))?;
        let (width, height) = (image.width(), image.height());
        Ok((self.detect(&image)?, width, height))
    }

    /// 检测一帧。
    pub fn detect(&self, image: &DynamicImage) -> TractResult<Vec<Face>> {
        let (width, height) = (image.width(), image.height());
        if width == 0 || height == 0 {
            return Ok(Vec::new());
        }
        let scale = (INPUT_SIZE as f32 / width as f32).min(INPUT_SIZE as f32 / height as f32);
        let fit_w = ((width as f32 * scale).round() as u32).clamp(1, INPUT_SIZE as u32);
        let fit_h = ((height as f32 * scale).round() as u32).clamp(1, INPUT_SIZE as u32);
        let rgb: RgbImage = if (fit_w, fit_h) == (width, height) {
            image.to_rgb8()
        } else {
            image.resize_exact(fit_w, fit_h, FilterType::Triangle).to_rgb8()
        };
        let input = letterbox(&rgb);
        let outputs = self.plan.run(tvec!(input.into()))?;
        if outputs.len() != 12 {
            anyhow::bail!("expected 12 model outputs, got {}", outputs.len());
        }
        let mut candidates = Vec::new();
        for (level, stride) in STRIDES.iter().enumerate() {
            let cls = outputs[level].try_as_plain_ram()?.as_slice::<f32>()?;
            let obj = outputs[level + 3].try_as_plain_ram()?.as_slice::<f32>()?;
            let bbox = outputs[level + 6].try_as_plain_ram()?.as_slice::<f32>()?;
            decode(*stride, cls, obj, bbox, &mut candidates)?;
        }
        let kept = nms(candidates, NMS_THRESHOLD, MAX_FACES);
        // 640 × 640 里的像素 → 原帧的 0–1：除以贴进去的那块（缩小后的整帧）的宽高。
        let (span_w, span_h) = (fit_w as f32, fit_h as f32);
        Ok(kept
            .into_iter()
            .filter_map(|c| {
                let x0 = (c.x / span_w).clamp(0.0, 1.0);
                let y0 = (c.y / span_h).clamp(0.0, 1.0);
                let x1 = ((c.x + c.w) / span_w).clamp(0.0, 1.0);
                let y1 = ((c.y + c.h) / span_h).clamp(0.0, 1.0);
                (x1 > x0 && y1 > y0).then(|| Face {
                    x: round(x0, 4),
                    y: round(y0, 4),
                    w: round(x1 - x0, 4),
                    h: round(y1 - y0, 4),
                    score: round(c.score, 3),
                })
            })
            .collect())
    }
}

/// 640 × 640 里的一个候选框（像素）。
#[derive(Debug, Clone, Copy)]
struct Candidate {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    score: f32,
}

/// 贴到 640 × 640 的左上角，其余补 0；NCHW、BGR、0–255。
fn letterbox(rgb: &RgbImage) -> Tensor {
    let plane = INPUT_SIZE * INPUT_SIZE;
    let mut data = vec![0f32; 3 * plane];
    for (x, y, pixel) in rgb.enumerate_pixels() {
        let at = y as usize * INPUT_SIZE + x as usize;
        let [r, g, b] = pixel.0;
        data[at] = b as f32;
        data[plane + at] = g as f32;
        data[2 * plane + at] = r as f32;
    }
    Tensor::from_shape(&[1, 3, INPUT_SIZE, INPUT_SIZE], &data).expect("letterbox shape")
}

fn decode(stride: usize, cls: &[f32], obj: &[f32], bbox: &[f32], out: &mut Vec<Candidate>) -> TractResult<()> {
    let cols = INPUT_SIZE / stride;
    let cells = cols * cols;
    if cls.len() != cells || obj.len() != cells || bbox.len() != cells * 4 {
        anyhow::bail!("unexpected output size for stride {stride}");
    }
    for idx in 0..cells {
        let score = (cls[idx].clamp(0.0, 1.0) * obj[idx].clamp(0.0, 1.0)).sqrt();
        if score < SCORE_THRESHOLD {
            continue;
        }
        let (row, col) = ((idx / cols) as f32, (idx % cols) as f32);
        let s = stride as f32;
        let cx = (col + bbox[idx * 4]) * s;
        let cy = (row + bbox[idx * 4 + 1]) * s;
        let w = bbox[idx * 4 + 2].exp() * s;
        let h = bbox[idx * 4 + 3].exp() * s;
        out.push(Candidate {
            x: cx - w / 2.0,
            y: cy - h / 2.0,
            w,
            h,
            score,
        });
    }
    Ok(())
}

/// 贪心 NMS：按分数从高到低，与已留下的框 IoU 超过阈值的丢掉。
fn nms(mut candidates: Vec<Candidate>, threshold: f32, limit: usize) -> Vec<Candidate> {
    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut kept: Vec<Candidate> = Vec::new();
    for c in candidates {
        if kept.len() >= limit {
            break;
        }
        if kept.iter().all(|k| iou(k, &c) <= threshold) {
            kept.push(c);
        }
    }
    kept
}

fn iou(a: &Candidate, b: &Candidate) -> f32 {
    let x0 = a.x.max(b.x);
    let y0 = a.y.max(b.y);
    let x1 = (a.x + a.w).min(b.x + b.w);
    let y1 = (a.y + a.h).min(b.y + b.h);
    let inter = (x1 - x0).max(0.0) * (y1 - y0).max(0.0);
    let union = a.w * a.h + b.w * b.h - inter;
    if union <= 0.0 { 0.0 } else { inter / union }
}

/// 留 `digits` 位小数（在 f64 里取整，JSON 里不带 f32 的尾数）。
fn round(value: f32, digits: i32) -> f64 {
    let scale = 10f64.powi(digits);
    (f64::from(value) * scale).round() / scale
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(x: f32, y: f32, w: f32, h: f32, score: f32) -> Candidate {
        Candidate { x, y, w, h, score }
    }

    #[test]
    fn nms_keeps_the_best_of_overlapping_boxes() {
        let kept = nms(
            vec![
                candidate(0.0, 0.0, 10.0, 10.0, 0.7),
                candidate(1.0, 1.0, 10.0, 10.0, 0.9),
                candidate(100.0, 100.0, 10.0, 10.0, 0.8),
            ],
            NMS_THRESHOLD,
            MAX_FACES,
        );
        let scores: Vec<f32> = kept.iter().map(|c| c.score).collect();
        assert_eq!(scores, vec![0.9, 0.8]);
    }

    #[test]
    fn decode_follows_the_yunet_layout() {
        // 步长 32：20 × 20 个格子；在第 2 行第 3 列放一个分数 0.81 的候选，框心偏移 (0.5, 0.5)，宽高 exp(0) · 32。
        let cells = 20 * 20;
        let mut cls = vec![0.0; cells];
        let mut obj = vec![0.0; cells];
        let mut bbox = vec![0.0; cells * 4];
        let idx = 2 * 20 + 3;
        cls[idx] = 0.81;
        obj[idx] = 1.0;
        bbox[idx * 4] = 0.5;
        bbox[idx * 4 + 1] = 0.5;
        let mut out = Vec::new();
        decode(32, &cls, &obj, &bbox, &mut out).unwrap();
        assert_eq!(out.len(), 1);
        let c = out[0];
        assert!((c.score - 0.9).abs() < 1e-6);
        assert_eq!((c.x, c.y, c.w, c.h), (3.5 * 32.0 - 16.0, 2.5 * 32.0 - 16.0, 32.0, 32.0));
    }
}

//! Face detection: YuNet (`face_detection_yunet_2023mar.onnx` from the OpenCV Zoo, MIT) run via tract inference.
//!
//! The model input is fixed at `[1, 3, 640, 640]`: the frame is scaled proportionally to fit in 640 × 640 and pinned to the top-left corner, with the rest padded with 0 (consistent with OpenCV `FaceDetectorYN`, which pads rightward and downward). Pixels are BGR, float 0–255, with no mean subtraction or variance division (the `blobFromImage` default). The output has cls / obj / bbox / kps tensors for each of the three strides 8, 16, 32. Decoding is the same as `postProcess` in OpenCV `modules/objdetect/src/face_detect.cpp`:
//! score `sqrt(cls · obj)`, box center `(col + dx) · stride`, `(row + dy) · stride`, width and height `exp(dw) · stride`, `exp(dh) · stride`, followed by NMS.
//! Results are mapped back to the original frame's coordinates and normalized to 0–1 by the frame's width and height, independent of how large the frame was scaled when it was sampled.

use std::path::Path;

use image::{DynamicImage, RgbImage, imageops::FilterType};
use serde::Serialize;
use tract_onnx::prelude::*;

/// Model input edge length (pixels).
pub const INPUT_SIZE: usize = 640;
/// The three strides, in the same order as the model's output.
const STRIDES: [usize; 3] = [8, 16, 32];
/// Candidates scoring below this are discarded. OpenCV Zoo's examples use 0.9. Profile faces in interviews often score 0.7–0.9, so 0.6 is used to avoid missing them; false positives are filtered out by NMS and by area.
pub const SCORE_THRESHOLD: f32 = 0.6;
/// NMS IoU threshold (the default in OpenCV Zoo's examples).
pub const NMS_THRESHOLD: f32 = 0.3;
/// At most this many faces are reported per frame (by score, highest first).
pub const MAX_FACES: usize = 20;

/// One face: the top-left corner and width/height of the box, normalized to 0–1 by the frame's width and height. `score` is the confidence, 0–1.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Face {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub score: f64,
}

type Plan = Arc<TypedRunnableModel>;

/// Loaded detector: loaded once, called per frame.
pub struct FaceDetector {
    plan: Plan,
}

impl FaceDetector {
    /// Loads and optimizes the model from an ONNX file.
    pub fn load(model: &Path) -> TractResult<Self> {
        let size = INPUT_SIZE as i64;
        let plan = tract_onnx::onnx()
            .model_for_path(model)?
            .with_input_fact(0, f32::fact([1, 3, size as usize, size as usize]).into())?
            .into_optimized()?
            .into_runnable()?;
        Ok(Self { plan })
    }

    /// Detects faces in an image file (PNG or JPEG). Returns the faces and the image's pixel size.
    pub fn detect_file(&self, file: &Path) -> TractResult<(Vec<Face>, u32, u32)> {
        let image = image::open(file).map_err(|error| anyhow::anyhow!("cannot decode {}: {error}", file.display()))?;
        let (width, height) = (image.width(), image.height());
        Ok((self.detect(&image)?, width, height))
    }

    /// Detects faces in one frame.
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
        // Pixels in the 640 × 640 space → 0–1 of the original frame: divide by the width and height of the block that was pasted in (the whole scaled-down frame).
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

/// One candidate box in the 640 × 640 space (pixels).
#[derive(Debug, Clone, Copy)]
struct Candidate {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    score: f32,
}

/// Pasted at the top-left of 640 × 640, rest zero-padded; NCHW, BGR, 0–255.
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

/// Greedy NMS: by score from highest to lowest; drops any box whose IoU with an already kept box exceeds the threshold.
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

/// Keeps `digits` decimal places (rounded in f64, so the JSON does not carry the f32 mantissa).
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
        // Stride 32: a 20 × 20 grid. Place a candidate with score 0.81 at row 2, column 3, with center offset (0.5, 0.5), and width and height exp(0) · 32.
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

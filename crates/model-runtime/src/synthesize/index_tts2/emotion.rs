//! Emotion control: the parameter layer follows the official web page `webui.py`; vector synthesis follows the official `infer_v2.py` / `infer_v2_5.py`.
//!
//! The order of the 8-dimensional emotion vector is happy / angry / sad / afraid / disgusted /
//! melancholic / surprised / calm. A request supplies eight 0–1 sliders and an emotion weight `alpha`:
//!
//! 1. Web-page layer [`normalize_emo_vec`]: multiply each dimension by its bias (the official code says this suppresses emotions that tend to produce odd sounds);
//!    if the total exceeds 0.8, scale the whole vector down to 0.8.
//! 2. `infer()` layer [`scale_emo_vec`]: clamp `alpha` to [0, 1]; if it is not 1, multiply each dimension by it and truncate to four decimal places.
//! 3. The explicit vector is matched against `feat1` (speaker style matrix, 192 dims) by cosine similarity to pick, in each emotion bucket, the row closest to
//!    the current voice; the corresponding rows of `feat2` (emotion matrix, 1280 dims) are then blended by weight, and
//!    `(1 − sum of weights) × the reference audio's emotion vector` is added ([`explicit_emotion_vector`] and the engine's synthesis step).

use anyhow::{Result, bail};

pub const EMOTION_ORDER: [&str; 8] = ["happy", "angry", "sad", "afraid", "disgusted", "melancholic", "surprised", "calm"];

/// Per-dimension bias of the official `normalize_emo_vec` (same order as [`EMOTION_ORDER`]).
pub const EMOTION_BIAS: [f32; 8] = [0.9375, 0.875, 1.0, 1.0, 0.9375, 0.9375, 0.6875, 0.5625];

/// Total cap of the official `normalize_emo_vec`.
pub const EMOTION_SUM_CAP: f32 = 0.8;

/// Official web-page `normalize_emo_vec(vec, apply_bias=True)`: multiply each dimension by [`EMOTION_BIAS`];
/// if the total exceeds [`EMOTION_SUM_CAP`], scale proportionally down to it. Computed in f64, as in Python.
pub fn normalize_emo_vec(sliders: [f64; 8]) -> [f64; 8] {
    let biased: [f64; 8] = std::array::from_fn(|i| sliders[i] * EMOTION_BIAS[i] as f64);
    let sum: f64 = biased.iter().sum();
    let cap = EMOTION_SUM_CAP as f64;
    if sum > cap {
        biased.map(|value| value * (cap / sum))
    } else {
        biased
    }
}

/// Scaling of explicit vectors in the official `infer()`: `alpha` is clamped to [0, 1]; when it is not 1, each dimension becomes
/// `int(x × alpha × 10000) / 10000` (truncated toward zero to four decimal places).
pub fn scale_emo_vec(vector: [f64; 8], alpha: f64) -> [f64; 8] {
    let scale = alpha.clamp(0.0, 1.0);
    if scale == 1.0 {
        return vector;
    }
    vector.map(|value| (value * scale * 10_000.0).trunc() / 10_000.0)
}

/// Converts f32 to f64 via its shortest decimal form (`0.65f32` → `0.65`), so that four-place truncation matches the official result computed with Python floats:
/// a direct `as f64` gives `0.6499999761…`, and truncation would lose a digit.
fn decimal(value: f32) -> f64 {
    value.to_string().parse().unwrap_or(value as f64)
}

/// The final emotion vector passed to `infer()` (already normalized by the web page and scaled by `alpha`).
#[derive(Debug, Clone, PartialEq)]
pub struct EmotionControl {
    pub vector: [f32; 8],
}

impl EmotionControl {
    /// Web sliders + emotion weight → final vector: each dimension must be a finite value in 0–1 (the official slider range),
    /// and `alpha` must be finite (out-of-range values are clamped to [0, 1] as in the official code).
    pub fn from_sliders(sliders: [f32; 8], alpha: f32) -> Result<Self> {
        for value in sliders {
            if !value.is_finite() || !(0.0..=1.0).contains(&value) {
                bail!("each IndexTTS emotion vector value must be a finite number between 0 and 1, got {value}");
            }
        }
        if !alpha.is_finite() {
            bail!("IndexTTS emotion weight must be finite, got {alpha}");
        }
        let vector = scale_emo_vec(normalize_emo_vec(sliders.map(decimal)), decimal(alpha));
        Ok(Self {
            vector: vector.map(|value| value as f32),
        })
    }

    pub fn from_slice(values: &[f32], alpha: f32) -> Result<Self> {
        if values.len() != 8 {
            bail!("IndexTTS emotion vector must have exactly 8 values, got {}", values.len());
        }
        let mut sliders = [0f32; 8];
        sliders.copy_from_slice(values);
        Self::from_sliders(sliders, alpha)
    }

    /// Official `torch.sum(weight_vector)`.
    pub fn weight_sum(&self) -> f32 {
        self.vector.iter().sum()
    }
}

/// Explicit emotion vector: for each emotion bucket with weight > 0, find within that bucket's row range in `speaker_rows` (`[rows, style_dim]`,
/// row-major) the row with the highest cosine similarity to `style`, and accumulate the matching row of `emotion_rows`
/// (`[rows, emotion_dim]`) by weight. Returns `(vector, weight sum)`.
pub fn explicit_emotion_vector(
    control: &EmotionControl,
    style: &[f32],
    speaker_rows: &[f32],
    emotion_rows: &[f32],
    bucket_counts: &[usize],
    style_dim: usize,
    emotion_dim: usize,
) -> Result<(Vec<f32>, f32)> {
    let total: usize = bucket_counts.iter().sum();
    if style.len() != style_dim {
        bail!("style vector dimension {} does not match expected {style_dim}", style.len());
    }
    if speaker_rows.len() < total * style_dim || emotion_rows.len() < total * emotion_dim {
        bail!(
            "emotion matrix has too few rows: need {total}, feat1 {} values / feat2 {} values",
            speaker_rows.len(),
            emotion_rows.len()
        );
    }
    if bucket_counts.len() != 8 {
        bail!("emo_num must have 8 buckets, got {}", bucket_counts.len());
    }
    let weights = control.vector;
    let weight_sum = control.weight_sum();
    let mut output = vec![0f32; emotion_dim];
    let mut offset = 0usize;
    for (bucket, &count) in bucket_counts.iter().enumerate() {
        let weight = weights[bucket];
        if weight > 0.0 {
            let row = most_similar_style_row(style, speaker_rows, offset, count, style_dim);
            let source = (offset + row) * emotion_dim;
            for (i, value) in output.iter_mut().enumerate() {
                *value += weight * emotion_rows[source + i];
            }
        }
        offset += count;
    }
    Ok((output, weight_sum))
}

fn most_similar_style_row(style: &[f32], speaker_rows: &[f32], start: usize, count: usize, dim: usize) -> usize {
    let style_norm = style.iter().map(|v| v * v).sum::<f32>().sqrt().max(f32::EPSILON);
    let mut best_index = 0;
    let mut best_score = f32::MIN;
    for row in 0..count {
        let row_start = (start + row) * dim;
        let mut dot = 0f32;
        let mut row_norm_squared = 0f32;
        for i in 0..dim {
            let value = speaker_rows[row_start + i];
            dot += style[i] * value;
            row_norm_squared += value * value;
        }
        let score = dot / (style_norm * row_norm_squared.sqrt().max(f32::EPSILON));
        if score > best_score {
            best_score = score;
            best_index = row;
        }
    }
    best_index
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: [f32; 8], b: [f32; 8]) -> bool {
        a.iter().zip(b).all(|(x, y)| (x - y).abs() < 1e-6)
    }

    /// The two steps of the official web page: if the total after bias does not exceed 0.8, only the bias is applied; if it does, first scale down to 0.8, then apply the weight.
    #[test]
    fn webui_normalization_then_infer_scaling() {
        assert_eq!(EMOTION_ORDER[7], "calm");
        let calm = EmotionControl::from_sliders([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0], 0.65).unwrap();
        assert!(close(calm.vector, [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3656]));
        let happy = EmotionControl::from_sliders([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 0.65).unwrap();
        // After bias 0.9375 > 0.8: scale down to 0.8, then multiply by 0.65.
        assert!(close(happy.vector, [0.52, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]));
        let all = EmotionControl::from_sliders([1.0; 8], 0.65).unwrap();
        assert!(close(all.vector, [0.0702, 0.0655, 0.0749, 0.0749, 0.0702, 0.0702, 0.0515, 0.0421]));
        // After bias 1.0 + 0.9375 = 1.9375 > 0.8: first scale down to 0.8, then multiply by 0.5 → total 0.4.
        let capped = EmotionControl::from_sliders([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0], 0.5).unwrap();
        assert!((capped.weight_sum() - 0.4).abs() < 1e-3, "{capped:?}");
        assert!(close(capped.vector, [0.0, 0.0, 0.2064, 0.0, 0.0, 0.1935, 0.0, 0.0]));
        // 0.65 truncated in decimal: 1.0 × 0.65 is 0.65, not 0.6499.
        let sad = EmotionControl::from_sliders([0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0], 0.65).unwrap();
        assert!(close(sad.vector, [0.0, 0.0, 0.52, 0.0, 0.0, 0.0, 0.0, 0.0]));
        // alpha = 1 is not truncated; out-of-range values are clamped as in the official code.
        let full = EmotionControl::from_sliders([0.0, 0.0, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0).unwrap();
        assert!(close(full.vector, [0.0, 0.0, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0]));
        let clamped = EmotionControl::from_sliders([0.0, 0.0, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0], 1.5).unwrap();
        assert_eq!(clamped, full);
    }

    #[test]
    fn validation() {
        assert!(EmotionControl::from_sliders([1.0; 8], 0.65).is_ok());
        assert!(EmotionControl::from_sliders([1.2, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0).is_err());
        assert!(EmotionControl::from_sliders([-0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0).is_err());
        assert!(EmotionControl::from_sliders([0.1; 8], f32::NAN).is_err());
        assert!(EmotionControl::from_slice(&[0.1; 7], 1.0).is_err());
    }

    #[test]
    fn explicit_vector_picks_most_similar_row_per_bucket() {
        // 2 buckets (2 rows each), style_dim 2, emotion_dim 3.
        let style = [1.0, 0.0];
        let speaker_rows = [0.0, 1.0, 1.0, 0.1, 1.0, 0.0, 0.0, 1.0];
        let emotion_rows = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 5.0, 5.0, 5.0];
        let control = EmotionControl {
            vector: [0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        };
        let (vector, sum) =
            explicit_emotion_vector(&control, &style, &speaker_rows, &emotion_rows, &[2, 2, 0, 0, 0, 0, 0, 0], 2, 3).unwrap();
        // Bucket 0 selects row 1 ([1,0.1]), bucket 1 selects row 0 ([1,0]).
        assert_eq!(vector, vec![0.0, 0.5, 0.25]);
        assert!((sum - 0.75).abs() < 1e-6);
    }
}

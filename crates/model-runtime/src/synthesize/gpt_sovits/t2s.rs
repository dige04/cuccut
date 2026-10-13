//! T2S: GPT-SoVITS's autoregressive semantic token generator (`s1bert25hz-5kh-longer`), matching
//! `AR/models/t2s_model.py::Text2SemanticDecoder.infer_panel_naive`.
//!
//! 24-layer post-norm Transformer (512 dims, 16 heads, FFN 2048, ReLU). Text side = phoneme embedding +
//! `bert_proj` (1024 → 512) + sinusoidal positional encoding; speech side = semantic token embedding + sinusoidal positional encoding.
//! During prefill, text rows cannot see speech columns, and speech columns are causal among themselves; afterwards decoding proceeds token by token, with the KV cache concatenated along the sequence.

use super::ABORT_MESSAGE;
use super::layers::{LayerNorm, Linear};
use super::sampling::{self, SamplingParams};
use super::weights::WeightMap;
use crate::synthesize::qwen3_tts::sampling::Rng;
use crate::synthesize::tensor::fast::ScaledDotProductAttentionMask;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype, fast, ops};
use anyhow::{Result, bail, ensure};

/// The semantic token vocabulary has 1025 entries; the last one is EOS.
pub const EOS: usize = 1024;
/// Dimension of the per-phoneme BERT features.
pub const BERT_DIM: usize = 1024;
/// Phoneme vocabulary (`text/symbols2.py`).
pub const PHONE_VOCAB: usize = 732;
const D_MODEL: i32 = 512;
const HEADS: i32 = 16;
const HEAD_DIM: i32 = D_MODEL / HEADS;
const LAYERS: usize = 24;
const LAYER_NORM_EPS: f32 = 1e-5;
/// Maximum semantic tokens generated per sentence (25 Hz, one minute); `SamplingOptions::max_tokens` can only lower it.
pub const MAX_STEPS: usize = super::sampling::DEFAULT_MAX_TOKENS;
/// For the first 11 steps the EOS column is removed (speech must be at least 0.4 seconds before it may stop).
const MIN_STEPS_BEFORE_EOS: usize = 11;

struct Block {
    in_proj: Linear,
    out_proj: Linear,
    linear1: Linear,
    linear2: Linear,
    norm1: LayerNorm,
    norm2: LayerNorm,
}

impl Block {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            in_proj: Linear {
                weight: w.take(&format!("{prefix}.self_attn.in_proj_weight"))?,
                bias: w.take_optional_f32(&format!("{prefix}.self_attn.in_proj_bias"))?,
            },
            out_proj: Linear::load(w, &format!("{prefix}.self_attn.out_proj"))?,
            linear1: Linear::load(w, &format!("{prefix}.linear1"))?,
            linear2: Linear::load(w, &format!("{prefix}.linear2"))?,
            norm1: LayerNorm::load(w, &format!("{prefix}.norm1"), LAYER_NORM_EPS)?,
            norm2: LayerNorm::load(w, &format!("{prefix}.norm2"), LAYER_NORM_EPS)?,
        })
    }

    fn forward(&self, x: &Array, mask: Option<&Array>, cache: &mut Option<(Array, Array)>) -> Result<Array> {
        let (b, l) = (x.dim(0), x.dim(1));
        let qkv = ops::split(&self.in_proj.forward(x)?, 3, -1)?;
        let heads = |t: &Array| -> Result<Array> { Ok(t.reshape(&[b, l, HEADS, HEAD_DIM])?.transpose_axes(&[0, 2, 1, 3])?) };
        let q = heads(&qkv[0])?;
        let mut k = heads(&qkv[1])?;
        let mut v = heads(&qkv[2])?;
        if let Some((past_k, past_v)) = cache.take() {
            k = ops::concatenate_axis(&[&past_k, &k], 2)?;
            v = ops::concatenate_axis(&[&past_v, &v], 2)?;
        }
        let scale = 1.0 / (HEAD_DIM as f32).sqrt();
        let attn = match mask {
            Some(mask) => fast::scaled_dot_product_attention(&q, &k, &v, scale, ScaledDotProductAttentionMask::Array(mask), None)?,
            None => fast::scaled_dot_product_attention(&q, &k, &v, scale, None, None)?,
        };
        *cache = Some((k, v));
        let attn = attn.transpose_axes(&[0, 2, 1, 3])?.reshape(&[b, l, D_MODEL])?;
        let x = self.norm1.forward(&(x + self.out_proj.forward(&attn)?))?;
        let hidden = ops::maximum(&self.linear1.forward(&x)?, &Array::from_f32(0.0))?;
        self.norm2.forward(&(&x + self.linear2.forward(&hidden)?))
    }
}

pub struct T2s {
    text_embedding: Array,
    audio_embedding: Array,
    text_alpha: f32,
    audio_alpha: f32,
    bert_proj: Linear,
    predict: Linear,
    blocks: Vec<Block>,
}

impl T2s {
    pub fn load(mut w: WeightMap) -> Result<Self> {
        let text_embedding = w.take_f32("model.ar_text_embedding.word_embeddings.weight")?;
        let audio_embedding = w.take_f32("model.ar_audio_embedding.word_embeddings.weight")?;
        ensure!(
            text_embedding.dim(0) as usize == PHONE_VOCAB && audio_embedding.dim(0) as usize == EOS + 1,
            "T2S weight vocabulary is not v2 (phonemes {}, semantics {})",
            text_embedding.dim(0),
            audio_embedding.dim(0)
        );
        let text_alpha = scalar(&w.take_f32("model.ar_text_position.alpha")?)?;
        let audio_alpha = scalar(&w.take_f32("model.ar_audio_position.alpha")?)?;
        let bert_proj = Linear::load(&mut w, "model.bert_proj")?;
        let predict = Linear::load_no_bias(&mut w, "model.ar_predict_layer")?;
        let blocks = (0..LAYERS)
            .map(|i| Block::load(&mut w, &format!("model.h.layers.{i}")))
            .collect::<Result<Vec<_>>>()?;
        Ok(Self {
            text_embedding,
            audio_embedding,
            text_alpha,
            audio_alpha,
            bert_proj,
            predict,
            blocks,
        })
    }

    /// `phones` / `bert` (`[phones, 1024]`, row-major) are the result of concatenating the prompt text and the target text;
    /// an empty `prompt` means no-reference-text mode (ref_free). Returns the newly generated semantic tokens (excluding the prompt and EOS).
    pub fn generate(
        &self,
        phones: &[i32],
        bert: &[f32],
        prompt: &[u32],
        params: &SamplingParams,
        max_steps: usize,
        rng: &mut Rng,
        progress: &mut dyn FnMut(usize) -> bool,
    ) -> Result<Vec<u32>> {
        let x_len = phones.len();
        ensure!(x_len > 0, "T2S input phonemes are empty");
        ensure!(
            bert.len() == x_len * BERT_DIM,
            "BERT feature length {} does not match the phoneme count {x_len}",
            bert.len()
        );
        let ids = Array::from_slice(phones, &[x_len as i32]);
        let bert = Array::from_slice(bert, &[1, x_len as i32, BERT_DIM as i32]);
        let x = self.text_embedding.take_axis(&ids, 0)?.reshape(&[1, x_len as i32, D_MODEL])?
            + self.bert_proj.forward(&bert)?
            + positional_encoding(0, x_len) * self.text_alpha;

        let y_len = prompt.len();
        let (mut input, mut mask) = if y_len == 0 {
            (x, None)
        } else {
            let total = (x_len + y_len) as i32;
            let mask = Array::from_slice(&prefill_mask(x_len, y_len), &[1, 1, total, total]);
            let y = self.embed_audio(prompt, 0)?;
            (ops::concatenate_axis(&[&x, &y], 1)?, Some(mask))
        };

        let mut caches: Vec<Option<(Array, Array)>> = (0..LAYERS).map(|_| None).collect();
        let mut history: Vec<u32> = prompt.to_vec();
        let mut generated: Vec<u32> = Vec::new();
        for step in 0..max_steps.min(MAX_STEPS) {
            let mut hidden = input;
            for (block, cache) in self.blocks.iter().zip(caches.iter_mut()) {
                hidden = block.forward(&hidden, mask.as_ref(), cache)?;
            }
            mask = None;
            let logits = self.predict.forward(&hidden.index((.., -1, ..)))?.as_dtype(Dtype::Float32)?;
            logits.eval()?;
            let mut logits = logits.as_slice::<f32>().to_vec();
            if step < MIN_STEPS_BEFORE_EOS {
                logits.truncate(EOS);
            }
            let token = sampling::sample(&mut logits, &history, params, rng);
            if token == EOS || sampling::argmax(&logits) == EOS {
                break;
            }
            history.push(token as u32);
            generated.push(token as u32);
            if !progress(generated.len()) {
                bail!(ABORT_MESSAGE);
            }
            input = self.embed_audio(&[token as u32], y_len + step)?;
        }
        Ok(generated)
    }

    fn embed_audio(&self, tokens: &[u32], start: usize) -> Result<Array> {
        let ids: Vec<i32> = tokens.iter().map(|&t| t as i32).collect();
        let len = ids.len() as i32;
        let ids = Array::from_slice(&ids, &[len]);
        Ok(self.audio_embedding.take_axis(&ids, 0)?.reshape(&[1, len, D_MODEL])?
            + positional_encoding(start, tokens.len()) * self.audio_alpha)
    }
}

fn scalar(array: &Array) -> Result<f32> {
    let array = array.as_dtype(Dtype::Float32)?;
    array.eval()?;
    Ok(array.as_slice::<f32>()[0])
}

/// `SinePositionalEmbedding` (`x_scale = 1`): sin on even dimensions, cos on odd dimensions.
fn positional_encoding_values(start: usize, len: usize) -> Vec<f32> {
    let dim = D_MODEL as usize;
    let factor = -(10000.0f32.ln() / D_MODEL as f32);
    let mut data = vec![0.0f32; len * dim];
    for (row, position) in (start..start + len).enumerate() {
        for i in 0..dim / 2 {
            let angle = position as f32 * ((2 * i) as f32 * factor).exp();
            data[row * dim + 2 * i] = angle.sin();
            data[row * dim + 2 * i + 1] = angle.cos();
        }
    }
    data
}

fn positional_encoding(start: usize, len: usize) -> Array {
    Array::from_slice(&positional_encoding_values(start, len), &[1, len as i32, D_MODEL])
}

/// Additive prefill mask `[x_len + y_len]²`: text rows mask out all speech columns; speech rows are fully open to text and causal to speech.
fn prefill_mask(x_len: usize, y_len: usize) -> Vec<f32> {
    let total = x_len + y_len;
    let mut mask = vec![0.0f32; total * total];
    for row in 0..total {
        for col in x_len..total {
            if row < x_len || col > row {
                mask[row * total + col] = f32::NEG_INFINITY;
            }
        }
    }
    mask
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefill_mask_blocks_audio_from_text_and_future_audio() {
        let mask = prefill_mask(2, 3);
        let blocked = |row: usize, col: usize| mask[row * 5 + col].is_infinite();
        for row in 0..2 {
            assert!(!blocked(row, 0) && !blocked(row, 1));
            assert!((2..5).all(|col| blocked(row, col)));
        }
        for row in 2..5 {
            assert!(!blocked(row, 0) && !blocked(row, 1));
            for col in 2..5 {
                assert_eq!(blocked(row, col), col > row, "row {row} col {col}");
            }
        }
    }

    #[test]
    fn positional_encoding_matches_torch_formula() {
        let pe = positional_encoding_values(0, 3);
        let dim = D_MODEL as usize;
        assert_eq!(pe[0], 0.0);
        assert_eq!(pe[1], 1.0);
        assert!((pe[dim] - 1.0f32.sin()).abs() < 1e-6);
        assert!((pe[dim + 1] - 1.0f32.cos()).abs() < 1e-6);
        // Second frequency: div = exp(2 · -ln(10000)/512).
        let div = (2.0 * -(10000.0f32.ln() / 512.0)).exp();
        assert!((pe[2 * dim + 2] - (2.0 * div).sin()).abs() < 1e-6);
        let shifted = positional_encoding_values(2, 1);
        assert_eq!(shifted, pe[2 * dim..].to_vec());
    }
}

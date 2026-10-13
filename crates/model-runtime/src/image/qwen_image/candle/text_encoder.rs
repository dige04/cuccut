//! The part of the Qwen3-VL language model that conditions the image, evaluated layer by layer. Its 36 layers' weights are never held on the device all at once (ported from v2 `ccut-image-local::candle::text_encoder`). Tokenization is replaced by [`super::super::prompt::Prompter`], shared with the MLX path (v2 reads the same `processor/tokenizer.json` with the HF `tokenizers` crate).

use anyhow::{Context, Result, bail};
use candle_core::{DType, Device, Tensor};
use std::path::Path;

use super::super::prompt::Prompter;
use super::weights::ShardedWeights;
use crate::backend::candle::layers::{RopeCache, scaled_dot_product_attention};
use crate::image::Cancelled;

const HIDDEN: usize = 4096;
const INTERMEDIATE: usize = 12288;
const HEADS: usize = 32;
const KV_HEADS: usize = 8;
const HEAD_DIM: usize = 128;
const LAYERS: usize = 36;
const ROPE_THETA: f32 = 5_000_000.0;
const EPS: f32 = 1e-6;
/// Key prefix of the language-model weights: the mlx-community 4-bit package uses `language_model.model`; a package that keeps the original transformers names uses `model.language_model`.
const PREFIXES: [&str; 2] = ["language_model.model", "model.language_model"];
/// Token limit for the prompt (including the template).
const MAX_TOKENS: usize = 1024;

fn rms(x: &Tensor, w: &Tensor) -> Result<Tensor> {
    Ok(candle_nn::ops::rms_norm(&x.contiguous()?, w, EPS)?)
}

fn linear(x: &Tensor, w: &Tensor) -> Result<Tensor> {
    Ok(x.to_dtype(w.dtype())?.broadcast_matmul(&w.t()?.contiguous()?)?)
}

fn projection(weights: &ShardedWeights, prefix: &str, x: &Tensor, input: usize, device: &Device, dtype: DType) -> Result<Tensor> {
    let w = weights.linear(prefix, input, device, dtype)?;
    let mut out = linear(x, &w)?;
    let bias = format!("{prefix}.bias");
    if weights.contains(&bias) {
        out = out.broadcast_add(&weights.load(&bias, device)?.to_dtype(dtype)?)?;
    }
    Ok(out)
}

fn attention(
    weights: &ShardedWeights,
    prefix: &str,
    x: &Tensor,
    rope: &RopeCache,
    mask: &Tensor,
    device: &Device,
    dtype: DType,
) -> Result<Tensor> {
    let (batch, sequence, _) = x.dims3()?;
    let proj = |name: &str, output: usize| -> Result<Tensor> {
        let y = projection(weights, &format!("{prefix}.{name}"), x, HIDDEN, device, dtype)?;
        if y.dim(2)? != output {
            bail!("{prefix}.{name} output dimension does not match");
        }
        Ok(y)
    };
    let q = proj("q_proj", HIDDEN)?.reshape((batch, sequence, HEADS, HEAD_DIM))?;
    let k = proj("k_proj", KV_HEADS * HEAD_DIM)?.reshape((batch, sequence, KV_HEADS, HEAD_DIM))?;
    let v = proj("v_proj", KV_HEADS * HEAD_DIM)?
        .reshape((batch, sequence, KV_HEADS, HEAD_DIM))?
        .transpose(1, 2)?;
    let q_norm = weights.load(&format!("{prefix}.q_norm.weight"), device)?.to_dtype(dtype)?;
    let k_norm = weights.load(&format!("{prefix}.k_norm.weight"), device)?.to_dtype(dtype)?;
    let q = rope.apply(&rms(&q, &q_norm)?.transpose(1, 2)?, 0)?;
    let k = rope.apply(&rms(&k, &k_norm)?.transpose(1, 2)?, 0)?;
    let attended = scaled_dot_product_attention(&q, &k.contiguous()?, &v.contiguous()?, (HEAD_DIM as f64).sqrt().recip(), Some(mask))?;
    let merged = attended.transpose(1, 2)?.reshape((batch, sequence, HIDDEN))?;
    projection(weights, &format!("{prefix}.o_proj"), &merged, HIDDEN, device, dtype)
}

/// Returns the residual of the last decoder layer (without the final RMSNorm, which is what QwenImage21Pipeline needs), and drops the system-prompt prefix segment.
/// `cancel` is checked before each layer. `files` are the safetensors under `text_encoder/`, fetched by manifest.
pub fn encode(
    files: &[&Path],
    prompter: &Prompter,
    prompt: &str,
    device: &Device,
    dtype: DType,
    cancel: &dyn Fn() -> bool,
) -> Result<Tensor> {
    let ids = prompter.t2i_ids(prompt);
    let drop_idx = prompter.drop_idx();
    if ids.len() <= drop_idx || ids.len() > MAX_TOKENS {
        bail!("text encoder token count {} is outside the supported range", ids.len());
    }
    let weights = ShardedWeights::open(files)?;
    let prefix = PREFIXES
        .into_iter()
        .find(|prefix| weights.contains(&format!("{prefix}.embed_tokens.weight")))
        .context("Qwen3-VL word embedding weights not found")?;
    let mut hidden = weights
        .embedding_rows(&format!("{prefix}.embed_tokens"), &ids, HIDDEN, device, dtype)?
        .unsqueeze(0)?;
    let rope = RopeCache::new(ROPE_THETA, HEAD_DIM, dtype, device);
    let mut causal = vec![0.0_f32; ids.len() * ids.len()];
    for row in 0..ids.len() {
        for col in row + 1..ids.len() {
            causal[row * ids.len() + col] = f32::NEG_INFINITY;
        }
    }
    let mask = Tensor::from_vec(causal, (1, 1, ids.len(), ids.len()), device)?.to_dtype(dtype)?;
    for i in 0..LAYERS {
        if cancel() {
            return Err(Cancelled.into());
        }
        let p = format!("{prefix}.layers.{i}");
        let input_norm = weights.load(&format!("{p}.input_layernorm.weight"), device)?.to_dtype(dtype)?;
        let normalized = rms(&hidden, &input_norm)?;
        let a = attention(&weights, &format!("{p}.self_attn"), &normalized, &rope, &mask, device, dtype)?;
        hidden = (&hidden + &a)?;
        let post_norm = weights
            .load(&format!("{p}.post_attention_layernorm.weight"), device)?
            .to_dtype(dtype)?;
        let normalized = rms(&hidden, &post_norm)?;
        let gated = (candle_nn::ops::silu(&projection(
            &weights,
            &format!("{p}.mlp.gate_proj"),
            &normalized,
            HIDDEN,
            device,
            dtype,
        )?)? * projection(&weights, &format!("{p}.mlp.up_proj"), &normalized, HIDDEN, device, dtype)?)?;
        hidden = (&hidden + &projection(&weights, &format!("{p}.mlp.down_proj"), &gated, INTERMEDIATE, device, dtype)?)?;
    }
    Ok(hidden.narrow(1, drop_idx, ids.len() - drop_idx)?)
}

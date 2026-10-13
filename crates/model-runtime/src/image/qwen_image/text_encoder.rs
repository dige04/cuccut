//! Text encoder: the language-model part of Qwen3-VL (text only; the M-RoPE three axes share the same position, which is plain 1D RoPE).
//! The condition is taken from the output of the last decoder layer (before the final RMSNorm), and the system-prompt prefix is dropped.
//! The decoder itself is reused directly from [`crate::backend::mlx::qwen3::TextDecoder`].
//! The prompt template and tokenization are in [`super::prompt`]. The resident encoder that v2 used only for developer self-checks (greedy continuation for `--check-lm`) was not ported.

use super::weights;
use anyhow::{Context, Result, bail};
use mlx_rs::Array;
use mlx_rs::ops::indexing::IndexOp;
use std::collections::HashMap;
use std::path::PathBuf;

use crate::backend::mlx::qwen3::{TextDecoder, TextDecoderConfig, WeightStore};

/// Key prefix of the language-model weights: the mlx-community 4-bit package uses `language_model.model`, while the ddalcu 8-bit package keeps the original transformers name `model.language_model`.
const PREFIXES: [&str; 2] = ["language_model.model", "model.language_model"];

fn is_lm_key(k: &str) -> bool {
    PREFIXES.iter().any(|p| k.starts_with(p) && k[p.len()..].starts_with('.'))
}

/// Recognizes the prefix from the lazy table (file header only), and infers bits and group size from the shape of layer 0's q_proj:
/// packed columns × 32 = 4096 × bits, number of groups × group = 4096. If a layer is not quantized (no `.scales`), bits is recorded as 16,
/// and the shared decoder loads it at its original precision. Note that the shared decoder quantizes an **unquantized `embed_tokens`** to the same bits as the layers during loading
/// (this is what the 8-bit package does: embedding table bf16, layers 8-bit); we do not work around it here.
fn layout(map: &HashMap<String, Array>) -> Result<(&'static str, TextDecoderConfig)> {
    let prefix = PREFIXES
        .into_iter()
        .find(|p| map.contains_key(&format!("{p}.embed_tokens.weight")))
        .context("文本编码器里找不到 embed_tokens")?;
    let mut c = TextDecoderConfig {
        hidden_size: 4096,
        layers: 36,
        heads: 32,
        kv_heads: 8,
        head_dim: 128,
        intermediate_size: 12288,
        group_size: 64,
        bits: 16,
        rope_theta: 5_000_000.0,
        rms_eps: 1e-6,
        qk_norm: true,
    };
    let q = format!("{prefix}.layers.0.self_attn.q_proj");
    let w = map.get(&format!("{q}.weight")).with_context(|| format!("缺少 {q}.weight"))?;
    if let Some(s) = map.get(&format!("{q}.scales")) {
        let input = c.hidden_size as i32;
        let (groups, packed) = (s.dim(1), w.dim(1) * 32);
        if groups == 0 || input % groups != 0 || packed % input != 0 {
            bail!(
                "{q} 的量化形状对不上 hidden {input}（权重 {:?}，scales {:?}）",
                w.shape(),
                s.shape()
            );
        }
        c.group_size = input / groups;
        c.bits = packed / input;
    }
    Ok((prefix, c))
}

/// One-shot encoding for generation: weights are opened lazily and read layer by layer in a streaming fashion (while computing layer i, layer i+1 is read ahead), and dropped after use;
/// only the embedding and two adjacent layers stay resident. Returns a bf16 condition of `[1, L - drop_idx, 4096]`.
pub fn encode_streaming(files: &[PathBuf], ids: &[u32], drop_idx: usize) -> Result<Array> {
    let raw = weights::lazy(files, is_lm_key).context("打开文本编码器权重")?;
    let (prefix, config) = layout(&raw)?;
    let mut store = WeightStore::from_arrays(raw)?;
    let decoder = TextDecoder::load_with_prefix(&mut store, config, prefix)?;
    let left = store.remaining();
    if !left.is_empty() {
        bail!("文本编码器有未使用的权重：{:?}", &left[..left.len().min(3)]);
    }
    let hidden = decoder.into_hidden_prenorm(&id_array(ids))?;
    let out = hidden.index((.., drop_idx as i32.., ..));
    out.eval()?;
    Ok(out)
}

fn id_array(ids: &[u32]) -> Array {
    Array::from_slice(&ids.iter().map(|&v| v as i32).collect::<Vec<_>>(), &[1, ids.len() as i32])
}

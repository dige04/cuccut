//! chinese-roberta-wwm-ext-large (HF `BertModel`): GPT-SoVITS takes `hidden_states[-3]` (the output of layer 22 after the embeddings) as the per-character features for Chinese segments, expands them to phoneme granularity via `word2ph`, matching `TTS_infer_pack/TextPreprocessor.py::get_bert_feature`.

use super::layers::{LayerNorm, Linear, act};
use super::weights::WeightMap;
use crate::synthesize::tensor::ops::indexing::IndexOp;
use crate::synthesize::tensor::{Array, Dtype, fast};
use anyhow::{Context, Result, ensure};
use std::collections::HashMap;
use std::path::Path;

const HIDDEN: i32 = 1024;
const HEADS: i32 = 16;
const HEAD_DIM: i32 = HIDDEN / HEADS;
/// `hidden_states[-3]`: of the 24 layers, only the first 22 need to run.
const USED_LAYERS: usize = 22;
const LAYER_NORM_EPS: f32 = 1e-12;
const MAX_POSITIONS: usize = 512;
pub const FEATURE_DIM: usize = HIDDEN as usize;

/// WordPiece vocabulary from `tokenizer.json`. After GPT-SoVITS Chinese normalization the text contains only Han characters and punctuation, and BERT's `handle_chinese_chars` / punctuation splitting makes each of these exactly one token, so a per-character lookup is enough.
pub struct BertVocab {
    ids: HashMap<String, i32>,
    cls: i32,
    sep: i32,
    unk: i32,
}

impl BertVocab {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path).with_context(|| format!("读取 BERT 分词器 {}", path.display()))?;
        let json: serde_json::Value = serde_json::from_str(&text).with_context(|| format!("解析 BERT 分词器 {}", path.display()))?;
        let vocab = json
            .pointer("/model/vocab")
            .and_then(|v| v.as_object())
            .context("BERT 分词器缺少 model.vocab")?;
        let ids: HashMap<String, i32> = vocab
            .iter()
            .filter_map(|(token, id)| id.as_i64().map(|id| (token.clone(), id as i32)))
            .collect();
        let special = |token: &str| -> Result<i32> { ids.get(token).copied().with_context(|| format!("BERT 词表缺少 {token}")) };
        let (cls, sep, unk) = (special("[CLS]")?, special("[SEP]")?, special("[UNK]")?);
        Ok(Self { ids, cls, sep, unk })
    }

    /// `[CLS] chars… [SEP]`; BertNormalizer lowercases, and characters outside the vocabulary map to `[UNK]`.
    pub fn encode_chars(&self, text: &str) -> Vec<i32> {
        let mut out = Vec::with_capacity(text.chars().count() + 2);
        out.push(self.cls);
        for c in text.chars() {
            let lower: String = c.to_lowercase().collect();
            out.push(self.ids.get(&lower).copied().unwrap_or(self.unk));
        }
        out.push(self.sep);
        out
    }
}

struct Layer {
    query: Linear,
    key: Linear,
    value: Linear,
    attention_output: Linear,
    attention_norm: LayerNorm,
    intermediate: Linear,
    output: Linear,
    output_norm: LayerNorm,
}

impl Layer {
    fn load(w: &mut WeightMap, prefix: &str) -> Result<Self> {
        Ok(Self {
            query: Linear::load(w, &format!("{prefix}.attention.self.query"))?,
            key: Linear::load(w, &format!("{prefix}.attention.self.key"))?,
            value: Linear::load(w, &format!("{prefix}.attention.self.value"))?,
            attention_output: Linear::load(w, &format!("{prefix}.attention.output.dense"))?,
            attention_norm: LayerNorm::load(w, &format!("{prefix}.attention.output.LayerNorm"), LAYER_NORM_EPS)?,
            intermediate: Linear::load(w, &format!("{prefix}.intermediate.dense"))?,
            output: Linear::load(w, &format!("{prefix}.output.dense"))?,
            output_norm: LayerNorm::load(w, &format!("{prefix}.output.LayerNorm"), LAYER_NORM_EPS)?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let (b, t) = (x.dim(0), x.dim(1));
        let heads =
            |proj: &Linear| -> Result<Array> { Ok(proj.forward(x)?.reshape(&[b, t, HEADS, HEAD_DIM])?.transpose_axes(&[0, 2, 1, 3])?) };
        let (q, k, v) = (heads(&self.query)?, heads(&self.key)?, heads(&self.value)?);
        let scale = 1.0 / (HEAD_DIM as f32).sqrt();
        let attn = fast::scaled_dot_product_attention(&q, &k, &v, scale, None, None)?
            .transpose_axes(&[0, 2, 1, 3])?
            .reshape(&[b, t, HIDDEN])?;
        let x = self.attention_norm.forward(&(self.attention_output.forward(&attn)? + x))?;
        let hidden = act::gelu(&self.intermediate.forward(&x)?)?;
        self.output_norm.forward(&(self.output.forward(&hidden)? + &x))
    }
}

pub struct Bert {
    vocab: BertVocab,
    word_embeddings: Array,
    position_embeddings: Array,
    token_type_embedding: Array,
    embedding_norm: LayerNorm,
    layers: Vec<Layer>,
}

impl Bert {
    pub fn load(mut w: WeightMap, tokenizer: &Path) -> Result<Self> {
        let vocab = BertVocab::load(tokenizer)?;
        let word_embeddings = w.take_f32("bert.embeddings.word_embeddings.weight")?;
        let position_embeddings = w.take_f32("bert.embeddings.position_embeddings.weight")?;
        let token_type_embedding = w.take_f32("bert.embeddings.token_type_embeddings.weight")?.index((0, ..));
        let embedding_norm = LayerNorm::load(&mut w, "bert.embeddings.LayerNorm", LAYER_NORM_EPS)?;
        let layers = (0..USED_LAYERS)
            .map(|i| Layer::load(&mut w, &format!("bert.encoder.layer.{i}")))
            .collect::<Result<Vec<_>>>()?;
        Ok(Self {
            vocab,
            word_embeddings,
            position_embeddings,
            token_type_embedding,
            embedding_norm,
            layers,
        })
    }

    /// Normalized Chinese text → row-major per-phoneme features of shape `[Σword2ph, 1024]`.
    pub fn phone_features(&self, text: &str, word2ph: &[usize]) -> Result<Vec<f32>> {
        let ids = self.vocab.encode_chars(text);
        ensure!(
            ids.len() == word2ph.len() + 2,
            "BERT 输入字数 {} 与 word2ph 长度 {} 不一致：{text}",
            ids.len() - 2,
            word2ph.len()
        );
        ensure!(
            ids.len() <= MAX_POSITIONS,
            "单句过长（{} 字），BERT 最多 {} 字",
            ids.len() - 2,
            MAX_POSITIONS - 2
        );
        let n = ids.len() as i32;
        let x = self.word_embeddings.take_axis(&Array::from_slice(&ids, &[n]), 0)?
            + self.position_embeddings.index((..n, ..))
            + &self.token_type_embedding;
        let mut x = self.embedding_norm.forward(&x.reshape(&[1, n, HIDDEN])?)?;
        for layer in &self.layers {
            x = layer.forward(&x)?;
        }
        let x = x.as_dtype(Dtype::Float32)?;
        x.eval()?;
        let hidden = x.as_slice::<f32>();

        let total: usize = word2ph.iter().sum();
        let mut out = Vec::with_capacity(total * FEATURE_DIM);
        for (i, &repeat) in word2ph.iter().enumerate() {
            let row = &hidden[(i + 1) * FEATURE_DIM..(i + 2) * FEATURE_DIM];
            for _ in 0..repeat {
                out.extend_from_slice(row);
            }
        }
        Ok(out)
    }
}

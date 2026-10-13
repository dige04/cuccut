//! Parts are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SourceSeparation/HTDemucs/HTDemucsTransformer.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-bundle interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! HTDemucs's cross-domain transformer, checked line by line against speech-swift `HTDemucsTransformer.swift`
//! (dense attention; htdemucs_ft: dim 512, 8 heads, FFN 2048, 5 layers, norm_first,
//! norm_out=GroupNorm, layer_scale, sin positional encoding, gelu; layers 0, 2, 4 are self-attention, 1 and 3 are cross-attention).
//!
//! Weight keys keep the torch export names: `self_attn` / `cross_attn` with the packed `in_proj_weight` /
//! `in_proj_bias` and `out_proj`, `linear1/2`, `norm1/2[/3]`, `norm_out`, `gamma_1/2`.

use super::layers::{LayerScale, gelu};
use super::tensor::ops::indexing::IndexOp;
use super::tensor::{Array, fast, ops, transforms};
use super::weights::WeightStore;
use anyhow::{Result, bail};
use std::cell::RefCell;

/// `create_sin_embedding`: returns data in `[1, T, C]` layout; first half cos, second half sin.
pub fn sin_embedding_1d(t_len: usize, channels: usize, max_period: f32) -> Vec<f32> {
    let half = channels / 2;
    let mut data = vec![0.0f32; t_len * channels];
    for t in 0..t_len {
        for j in 0..half {
            let phase = t as f32 / max_period.powf(j as f32 / (half as f32 - 1.0));
            data[t * channels + j] = phase.cos();
            data[t * channels + half + j] = phase.sin();
        }
    }
    data
}

/// `create_2d_sin_embedding` directly produces the `[1, T1*Fr, C]` sequence layout used by the transformer
/// (token index = t * Fr + h): channels 0..C/2 encode the time position, C/2..C encode the frequency position,
/// with even channels in each half using sin and odd channels using cos.
pub fn sin_embedding_2d(channels: usize, fr: usize, t1: usize, max_period: f32) -> Vec<f32> {
    let half = channels / 2;
    let n = half / 2;
    let div: Vec<f32> = (0..n).map(|i| ((2 * i) as f32 * -(max_period.ln() / half as f32)).exp()).collect();
    let mut data = vec![0.0f32; t1 * fr * channels];
    for c in 0..channels {
        let is_width = c < half;
        let c2 = if is_width { c } else { c - half };
        let i = c2 / 2;
        let use_sin = c2 % 2 == 0;
        for h in 0..fr {
            for w in 0..t1 {
                let pos = if is_width { w } else { h } as f32;
                let ph = pos * div[i];
                data[(w * fr + h) * channels + c] = if use_sin { ph.sin() } else { ph.cos() };
            }
        }
    }
    data
}

/// Linear layer in torch layout: `weight [out, in]`, `bias [out]`.
struct Linear {
    weight_t: Array,
    bias: Array,
}

impl Linear {
    fn load(store: &mut WeightStore, prefix: &str, input: i32, output: i32) -> Result<Self> {
        let weight = store.take_shape(&format!("{prefix}.weight"), &[output, input])?;
        let bias = store.take_shape(&format!("{prefix}.bias"), &[output])?;
        Ok(Self {
            weight_t: weight.t(),
            bias,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        Ok(ops::matmul(x, &self.weight_t)?.add(&self.bias)?)
    }
}

/// `nn.LayerNorm(dim)`，eps 1e-5。
struct LayerNorm {
    weight: Array,
    bias: Array,
}

impl LayerNorm {
    fn load(store: &mut WeightStore, prefix: &str, dim: i32) -> Result<Self> {
        Ok(Self {
            weight: store.take_shape(&format!("{prefix}.weight"), &[dim])?,
            bias: store.take_shape(&format!("{prefix}.bias"), &[dim])?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        Ok(fast::layer_norm(x, Some(&self.weight), Some(&self.bias), 1e-5)?)
    }
}

/// demucs `MyGroupNorm` (a subclass of GroupNorm(1, C)): on `[B, S, C]`, it computes statistics per sample over all of (S, C)
/// and then applies a per-channel affine transform.
struct MyGroupNorm {
    weight: Array,
    bias: Array,
}

impl MyGroupNorm {
    fn load(store: &mut WeightStore, prefix: &str, dim: i32) -> Result<Self> {
        Ok(Self {
            weight: store.take_shape(&format!("{prefix}.weight"), &[dim])?,
            bias: store.take_shape(&format!("{prefix}.bias"), &[dim])?,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        let mean = x.mean_axes(&[1, 2], true)?;
        let var = x.var_axes(&[1, 2], true, 0)?;
        let nrm = x.subtract(&mean)?.multiply(&ops::rsqrt(&var.add(Array::from_f32(1e-5))?)?)?;
        Ok(nrm.multiply(&self.weight)?.add(&self.bias)?)
    }
}

/// Multi-head attention with torch's packed projection: `in_proj_weight [3d, d]` (q|k|v stacked), `in_proj_bias [3d]`.
struct Attention {
    nhead: i32,
    dim: i32,
    q: Linear,
    k: Linear,
    v: Linear,
    out_proj: Linear,
}

impl Attention {
    fn load(store: &mut WeightStore, prefix: &str, dim: i32, nhead: i32) -> Result<Self> {
        let w = store.take_shape(&format!("{prefix}.in_proj_weight"), &[3 * dim, dim])?;
        let b = store.take_shape(&format!("{prefix}.in_proj_bias"), &[3 * dim])?;
        let slot = |s: i32| -> Result<Linear> {
            Ok(Linear {
                weight_t: w.index((s * dim..(s + 1) * dim, ..)).t(),
                bias: b.index(s * dim..(s + 1) * dim),
            })
        };
        Ok(Self {
            nhead,
            dim,
            q: slot(0)?,
            k: slot(1)?,
            v: slot(2)?,
            out_proj: Linear::load(store, &format!("{prefix}.out_proj"), dim, dim)?,
        })
    }

    fn split_heads(&self, x: &Array) -> Result<Array> {
        let (b, l) = (x.dim(0), x.dim(1));
        Ok(x.reshape(&[b, l, self.nhead, self.dim / self.nhead])?
            .transpose_axes(&[0, 2, 1, 3])?)
    }

    fn forward(&self, q: &Array, k: &Array, v: &Array) -> Result<Array> {
        let (b, lq) = (q.dim(0), q.dim(1));
        let qh = self.split_heads(&self.q.forward(q)?)?;
        let kh = self.split_heads(&self.k.forward(k)?)?;
        let vh = self.split_heads(&self.v.forward(v)?)?;
        let scale = ((self.dim / self.nhead) as f32).sqrt().recip();
        let out = fast::scaled_dot_product_attention(&qh, &kh, &vh, scale, None, None)?;
        let merged = out.transpose_axes(&[0, 2, 1, 3])?.reshape(&[b, lq, self.dim])?;
        self.out_proj.forward(&merged)
    }
}

/// Self-attention layer (idx 0, 2, 4), norm_first path.
struct SelfAttnLayer {
    attn: Attention,
    linear1: Linear,
    linear2: Linear,
    norm1: LayerNorm,
    norm2: LayerNorm,
    norm_out: MyGroupNorm,
    gamma_1: LayerScale,
    gamma_2: LayerScale,
}

impl SelfAttnLayer {
    fn load(store: &mut WeightStore, p: &str, dim: i32, nhead: i32, ffn: i32) -> Result<Self> {
        Ok(Self {
            attn: Attention::load(store, &format!("{p}.self_attn"), dim, nhead)?,
            linear1: Linear::load(store, &format!("{p}.linear1"), dim, ffn)?,
            linear2: Linear::load(store, &format!("{p}.linear2"), ffn, dim)?,
            norm1: LayerNorm::load(store, &format!("{p}.norm1"), dim)?,
            norm2: LayerNorm::load(store, &format!("{p}.norm2"), dim)?,
            norm_out: MyGroupNorm::load(store, &format!("{p}.norm_out"), dim)?,
            gamma_1: LayerScale::load(store, &format!("{p}.gamma_1"), dim, true)?,
            gamma_2: LayerScale::load(store, &format!("{p}.gamma_2"), dim, true)?,
        })
    }

    fn forward(&self, x0: &Array) -> Result<Array> {
        let n = self.norm1.forward(x0)?;
        let mut x = x0.add(&self.gamma_1.forward(&self.attn.forward(&n, &n, &n)?)?)?;
        let ff = self.linear2.forward(&gelu(&self.linear1.forward(&self.norm2.forward(&x)?)?)?)?;
        x = x.add(&self.gamma_2.forward(&ff)?)?;
        self.norm_out.forward(&x)
    }
}

/// Cross-attention layer (idx 1, 3): q comes from this domain, k/v come from the other domain.
struct CrossAttnLayer {
    attn: Attention,
    linear1: Linear,
    linear2: Linear,
    norm1: LayerNorm,
    norm2: LayerNorm,
    norm3: LayerNorm,
    norm_out: MyGroupNorm,
    gamma_1: LayerScale,
    gamma_2: LayerScale,
}

impl CrossAttnLayer {
    fn load(store: &mut WeightStore, p: &str, dim: i32, nhead: i32, ffn: i32) -> Result<Self> {
        Ok(Self {
            attn: Attention::load(store, &format!("{p}.cross_attn"), dim, nhead)?,
            linear1: Linear::load(store, &format!("{p}.linear1"), dim, ffn)?,
            linear2: Linear::load(store, &format!("{p}.linear2"), ffn, dim)?,
            norm1: LayerNorm::load(store, &format!("{p}.norm1"), dim)?,
            norm2: LayerNorm::load(store, &format!("{p}.norm2"), dim)?,
            norm3: LayerNorm::load(store, &format!("{p}.norm3"), dim)?,
            norm_out: MyGroupNorm::load(store, &format!("{p}.norm_out"), dim)?,
            gamma_1: LayerScale::load(store, &format!("{p}.gamma_1"), dim, true)?,
            gamma_2: LayerScale::load(store, &format!("{p}.gamma_2"), dim, true)?,
        })
    }

    fn forward(&self, q: &Array, k: &Array) -> Result<Array> {
        let kn = self.norm2.forward(k)?;
        let qn = self.norm1.forward(q)?;
        let mut x = q.add(&self.gamma_1.forward(&self.attn.forward(&qn, &kn, &kn)?)?)?;
        let ff = self.linear2.forward(&gelu(&self.linear1.forward(&self.norm3.forward(&x)?)?)?)?;
        x = x.add(&self.gamma_2.forward(&ff)?)?;
        self.norm_out.forward(&x)
    }
}

enum Layer {
    SelfAttn(SelfAttnLayer),
    Cross(CrossAttnLayer),
}

/// Positional-encoding cache: windows of the same shape do not need to be recomputed when inferred repeatedly.
struct PosEmbCache {
    key: (usize, usize, usize),
    pe2d: Array,
    pe1d: Array,
}

pub struct CrossTransformerEncoder {
    max_period: f32,
    weight_pos_embed: f32,
    norm_in: LayerNorm,
    norm_in_t: LayerNorm,
    layers: Vec<Layer>,
    layers_t: Vec<Layer>,
    cache: RefCell<Option<PosEmbCache>>,
}

impl CrossTransformerEncoder {
    #[allow(clippy::too_many_arguments)]
    pub fn load(
        store: &mut WeightStore,
        prefix: &str,
        dim: i32,
        nhead: i32,
        ffn: i32,
        num_layers: usize,
        max_period: f32,
        weight_pos_embed: f32,
    ) -> Result<Self> {
        let mut layers = Vec::with_capacity(num_layers);
        let mut layers_t = Vec::with_capacity(num_layers);
        for idx in 0..num_layers {
            let p = format!("{prefix}.layers.{idx}");
            let pt = format!("{prefix}.layers_t.{idx}");
            if idx % 2 == 0 {
                layers.push(Layer::SelfAttn(SelfAttnLayer::load(store, &p, dim, nhead, ffn)?));
                layers_t.push(Layer::SelfAttn(SelfAttnLayer::load(store, &pt, dim, nhead, ffn)?));
            } else {
                layers.push(Layer::Cross(CrossAttnLayer::load(store, &p, dim, nhead, ffn)?));
                layers_t.push(Layer::Cross(CrossAttnLayer::load(store, &pt, dim, nhead, ffn)?));
            }
        }
        Ok(Self {
            max_period,
            weight_pos_embed,
            norm_in: LayerNorm::load(store, &format!("{prefix}.norm_in"), dim)?,
            norm_in_t: LayerNorm::load(store, &format!("{prefix}.norm_in_t"), dim)?,
            layers,
            layers_t,
            cache: RefCell::new(None),
        })
    }

    fn pos_embeddings(&self, c: usize, fr: usize, t1: usize, t2: usize) -> Result<(Array, Array)> {
        let key = (fr, t1, t2);
        if let Some(cache) = self.cache.borrow().as_ref()
            && cache.key == key
            && cache.pe2d.dim(2) as usize == c
        {
            return Ok((cache.pe2d.clone(), cache.pe1d.clone()));
        }
        let pe2d = Array::from_slice(&sin_embedding_2d(c, fr, t1, self.max_period), &[1, (t1 * fr) as i32, c as i32])
            .multiply(Array::from_f32(self.weight_pos_embed))?;
        let pe1d = Array::from_slice(&sin_embedding_1d(t2, c, self.max_period), &[1, t2 as i32, c as i32])
            .multiply(Array::from_f32(self.weight_pos_embed))?;
        transforms::eval([&pe2d, &pe1d])?;
        *self.cache.borrow_mut() = Some(PosEmbCache {
            key,
            pe2d: pe2d.clone(),
            pe1d: pe1d.clone(),
        });
        Ok((pe2d, pe1d))
    }

    /// `x [B, C, Fr, T1]` (frequency domain), `xt [B, C, T2]` (time domain); returns a pair of the same shapes.
    pub fn forward(&self, x_in: &Array, xt_in: &Array) -> Result<(Array, Array)> {
        let (b, c, fr, t1) = (x_in.dim(0), x_in.dim(1), x_in.dim(2), x_in.dim(3));
        let t2 = xt_in.dim(2);
        if xt_in.dim(1) != c {
            bail!("transformer 两路通道数不一致：{} / {}", c, xt_in.dim(1));
        }
        let (pe2d, pe1d) = self.pos_embeddings(c as usize, fr as usize, t1 as usize, t2 as usize)?;

        let mut x = x_in.transpose_axes(&[0, 3, 2, 1])?.reshape(&[b, t1 * fr, c])?;
        x = self.norm_in.forward(&x)?.add(&pe2d)?;

        let mut xt = xt_in.transpose_axes(&[0, 2, 1])?;
        xt = self.norm_in_t.forward(&xt)?.add(&pe1d)?;

        for (layer, layer_t) in self.layers.iter().zip(&self.layers_t) {
            match (layer, layer_t) {
                (Layer::SelfAttn(l), Layer::SelfAttn(lt)) => {
                    x = l.forward(&x)?;
                    xt = lt.forward(&xt)?;
                }
                (Layer::Cross(l), Layer::Cross(lt)) => {
                    let old_x = x;
                    x = l.forward(&old_x, &xt)?;
                    xt = lt.forward(&xt, &old_x)?;
                }
                _ => bail!("transformer 两路层类型不一致"),
            }
        }

        let x_out = x.reshape(&[b, t1, fr, c])?.transpose_axes(&[0, 3, 2, 1])?;
        let xt_out = xt.transpose_axes(&[0, 2, 1])?;
        Ok((x_out, xt_out))
    }
}

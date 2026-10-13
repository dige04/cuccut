//! QwenImage21Transformer2DModel (single-stream DiT, 32 layers; linear layers are MLX 4/8-bit quantized or original-precision bf16).
//!
//! `causal_condition=true`: text tokens are strictly causal and use only the t=0 modulation; target image tokens see the whole prefix and themselves. So the text segment is independent of the sampling step. The first forward pass stores each layer's text K/V (after norm and RoPE), and later steps compute only the image tokens, then do unmasked attention against the cached text K/V. This is what the reference pipeline's `kv_cache` does.
//! The text segment is not run separately: on the first step, text is computed layer by layer first, its K/V stored, and then the image is computed.
//!
//! The 32 layers' weights (~4 GB) are not kept resident. Each step reopens the lazy table; while computing layer i it prefetches layer i+1 and drops layer i after use. What stays resident is the input and output projections and modulation (~0.1 GB) plus two adjacent layers (~0.25 GB). The weight files sit in the OS file cache and can be reclaimed under memory pressure, at the cost of that step reading from disk.
//!
//! For compute precision, see [`Precision`]. By default it picks between f16 and bf16 by measuring this machine ([`Precision::probe`]). GPUs without native bf16 arithmetic (about 1.8× slower on M2) use f16 with the residual stream in f32 to prevent overflow; the rest use bf16.

use super::{rope, weights};
use crate::backend::mlx::qwen3::WeightStore;
use anyhow::{Context, Result, bail};
use mlx_rs::fast::ScaledDotProductAttentionMask;
use mlx_rs::ops::indexing::IndexOp;
use mlx_rs::{Array, Dtype, fast, nn, ops};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

const DIM: i32 = 4096;
const INTER: i32 = 12288;
const HEADS: i32 = 32;
const HEAD_DIM: i32 = 128;
const LAYERS: usize = 32;
const EPS: f32 = 1e-6;

/// DiT compute precision. The M2 GPU has no native bf16 arithmetic: `--bench 4096` measured one layer's 7 4-bit linear layers at 1169 ms in bf16 and 661 ms in f16, and attention at 149 → 110 ms. A real 1024² run went from 44.2 → 27.2 s per step.
///
/// f16 has only a 5-bit exponent (maximum 65504), so in f16 mode the residual stream is stored as f32, and only the inputs and outputs of the linear layers and attention are f16. bf16 mode matches the reference pipeline, and its residual is also bf16.
#[derive(Clone, Copy, Debug)]
pub struct Precision {
    pub compute: Dtype,
    /// A quantized layer that is streamed in is fully dequantized into `compute` and then multiplied as dense. f16 makes the linear layers about 12% faster (about 9% for the whole step). One dense f16 layer is about 0.44 GB (4-bit is about 0.12 GB), so the process peak is about 0.33 GB higher.
    pub dequant: bool,
}

impl Precision {
    fn resid(self) -> Dtype {
        if self.compute == Dtype::Float16 {
            Dtype::Float32
        } else {
            self.compute
        }
    }

    /// Measures once on this machine a 4-bit matmul of the same shape (1024 tokens × 4096 → 4096, the same shape as one `to_q` in blocked mode, random weights). f16 and bf16 are run alternately 5 times each, plus 1 warm-up round, and the shortest of each is kept. About 0.2 s.
    pub fn probe() -> Result<Probe> {
        let key = mlx_rs::random::key(0)?;
        let w = mlx_rs::random::normal::<f32>(&[DIM, DIM], None, None, &key)?
            .multiply(&Array::from_f32(0.02))?
            .as_dtype(Dtype::Float16)?;
        let (q, s16, b16) = ops::quantize(&w, 64, 4)?;
        let x16 = mlx_rs::random::normal::<f32>(&[1, 1024, DIM], None, None, &key)?.as_dtype(Dtype::Float16)?;
        let bf = |a: &Array| a.as_dtype(Dtype::Bfloat16);
        let (sb, bb, xb) = (bf(&s16)?, bf(&b16)?, bf(&x16)?);
        mlx_rs::transforms::eval([&q, &s16, &b16, &x16, &sb, &bb, &xb])?;
        drop(w);
        let run = |x: &Array, s: &Array, b: &Array| -> Result<f64> {
            let t = Instant::now();
            ops::quantized_matmul(x, &q, s, b, true, 64, 4)?.eval()?;
            Ok(t.elapsed().as_secs_f64() * 1e3)
        };
        let mut p = Probe {
            f16_ms: f64::INFINITY,
            bf16_ms: f64::INFINITY,
        };
        for round in 0..6 {
            let (f, b) = (run(&x16, &s16, &b16)?, run(&xb, &sb, &bb)?);
            // Round 0 is a warm-up: the first kernel compilation and the GPU clock ramp-up.
            if round > 0 {
                p.f16_ms = p.f16_ms.min(f);
                p.bf16_ms = p.bf16_ms.min(b);
            }
        }
        Ok(p)
    }
}

/// bf16 is chosen if its 4-bit matmul is no more than this multiple slower than f16. It measures about 1.77× on M2; a GPU with native bf16 should be close to 1×. The threshold is set loosely so that measurement jitter does not make the same machine choose differently between runs (the output would change with it).
const BF16_TOLERANCE: f64 = 1.3;

/// The shortest measured time (milliseconds) of each same-shape 4-bit matmul, for [`Precision::probe`].
#[derive(Clone, Copy, Debug)]
pub struct Probe {
    pub f16_ms: f64,
    pub bf16_ms: f64,
}

impl Probe {
    /// bf16 is used if it is fast enough: it has the same precision as the reference pipeline, its exponent is as wide as f32's so it does not overflow, and the residual stream needs no separate f32 copy. Otherwise f16.
    pub fn pick(self) -> Dtype {
        if self.bf16_ms <= self.f16_ms * BF16_TOLERANCE {
            Dtype::Bfloat16
        } else {
            Dtype::Float16
        }
    }
}

/// f16 computation overflowed (the DiT output contains non-finite values). The caller can rerun with bf16.
#[derive(Debug)]
pub struct Overflow;

impl std::fmt::Display for Overflow {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DiT 在 f16 下溢出（输出含非有限值）")
    }
}

impl std::error::Error for Overflow {}

/// Linear layers without bias. Those with `.scales` are MLX affine-quantized; bits and group size are inferred from the shapes (packed column count × 32 = input dimension × bits, number of groups × group size = input dimension), so the 4-bit and 8-bit packages share the code. Those without `.scales` are multiplied directly at their original precision, not re-quantized at load. Scales, biases and dense weights are converted to the compute precision at load, and the input is converted before multiplying.
enum Lin {
    Quant {
        w: Array,
        scales: Array,
        biases: Array,
        group: i32,
        bits: i32,
    },
    Dense(Array),
}

impl Lin {
    /// When `dequant` is true, the quantized layer is dequantized into dense (used only for the 32 streamed layers; out-of-layer weights stay resident, so it is not worth it there).
    fn load(s: &mut WeightStore, p: &str, input: i32, dtype: Dtype, dequant: bool) -> Result<Self> {
        let w = s.take(&format!("{p}.weight"))?;
        if !s.contains(&format!("{p}.scales")) {
            if w.dim(1) != input {
                bail!("{p}: 权重输入维 {} ≠ {input}", w.dim(1));
            }
            return Ok(Self::Dense(w.as_dtype(dtype)?));
        }
        let scales = s.take(&format!("{p}.scales"))?.as_dtype(dtype)?;
        let biases = s.take(&format!("{p}.biases"))?.as_dtype(dtype)?;
        let groups = scales.dim(1);
        let packed = w.dim(1) * 32;
        if groups == 0 || input % groups != 0 || packed % input != 0 {
            bail!(
                "{p}: 量化形状对不上输入维 {input}（权重 {:?}，scales {:?}）",
                w.shape(),
                scales.shape()
            );
        }
        let (group, bits) = (input / groups, packed / input);
        if dequant {
            return Ok(Self::Dense(ops::dequantize(&w, &scales, &biases, group, bits)?));
        }
        Ok(Self::Quant {
            w,
            scales,
            biases,
            group,
            bits,
        })
    }

    fn forward(&self, x: &Array) -> Result<Array> {
        Ok(match self {
            Self::Quant {
                w,
                scales,
                biases,
                group,
                bits,
            } => ops::quantized_matmul(x.as_dtype(scales.dtype())?, w, scales, biases, true, *group, *bits)?,
            Self::Dense(w) => ops::matmul(x.as_dtype(w.dtype())?, w.t())?,
        })
    }
}

/// The two packages do not use exactly the same key names. The mlx-community 4-bit package flattens diffusers' `nn.Sequential` indices and `timestep_embedder` (`modulation.0`, `time_text_embed.linear_1`), while the ddalcu 8-bit package keeps the original names (`modulation.1`, `time_text_embed.timestep_embedder.linear_1`). The first key that exists is used.
fn pick<'a>(s: &WeightStore, names: &[&'a str]) -> Result<&'a str> {
    names
        .iter()
        .copied()
        .find(|n| s.contains(&format!("{n}.weight")))
        .with_context(|| format!("DiT 缺少权重：{}", names.join(" / ")))
}

fn scalar(v: f32, like: &Array) -> Result<Array> {
    Ok(Array::from_f32(v).as_dtype(like.dtype())?)
}

/// The same round-to-nearest-even as torch's `.to(torch.bfloat16)`.
pub fn bf16_round(v: f32) -> f32 {
    let bits = v.to_bits();
    let lsb = (bits >> 16) & 1;
    let rounded = bits.wrapping_add(0x7fff + lsb) & 0xffff_0000;
    f32::from_bits(rounded)
}

struct Block {
    to_q: Lin,
    to_k: Lin,
    to_v: Lin,
    to_out: Lin,
    norm_q: Array,
    norm_k: Array,
    gate: Lin,
    proj: Lin,
    out: Lin,
}

/// One set of modulation parameters, already reshaped to `[1,1,DIM]` for per-token broadcasting.
struct Mod {
    scale1: Array,
    gate1: Array,
    scale2: Array,
    gate2: Array,
}

pub struct Dit {
    files: Vec<PathBuf>,
    prec: Precision,
    img_in: Lin,
    t_lin1: Lin,
    t_lin2: Lin,
    modulation: Lin,
    txt_norm: Array,
    txt_in1: Lin,
    txt_in2: Lin,
    norm_out: Lin,
    proj_out: Lin,
}

/// Per-layer K/V of the text prefix (`[1,H,L,D]`, already through norm and RoPE). Before the first step, `kv` is empty and `pending` holds the text hidden states after `txt_in`. After the first step fills `kv` layer by layer, `pending` is cleared.
pub struct TextCache {
    kv: Vec<(Array, Array)>,
    text_len: usize,
    pending: Option<TextPending>,
}

struct TextPending {
    x: Array,
    m: Mod,
    cos: Array,
    sin: Array,
}

/// Takes the weights of a layer during a step: the lazy table holds only the file header. `take` removes the tensors of layer i and starts an asynchronous read.
struct BlockStream {
    lazy: HashMap<String, Array>,
    prec: Precision,
}

impl BlockStream {
    fn open(files: &[PathBuf], prec: Precision) -> Result<Self> {
        let lazy = weights::lazy(files, |k| k.starts_with("transformer_blocks.")).context("打开 DiT 层权重")?;
        Ok(Self { lazy, prec })
    }

    /// If `prefetch` is true, the read of this layer starts immediately on the CPU stream (overlapping with the previous layer being computed on the GPU).
    fn take(&mut self, i: usize, prefetch: bool) -> Result<Block> {
        let prefix = format!("transformer_blocks.{i}.");
        let keys: Vec<String> = self.lazy.keys().filter(|k| k.starts_with(&prefix)).cloned().collect();
        let part: HashMap<String, Array> = keys.into_iter().filter_map(|k| self.lazy.remove_entry(&k)).collect();
        if prefetch {
            mlx_rs::transforms::async_eval(part.values())?;
        }
        let mut s = WeightStore::from_arrays(part)?;
        let b = Block::load(&mut s, i, self.prec)?;
        let left = s.remaining();
        if !left.is_empty() {
            bail!("DiT 第 {i} 层有未使用的权重：{:?}", &left[..left.len().min(5)]);
        }
        Ok(b)
    }
}

/// Treats adjacent pairs of the two dimensions of `[1,S,H,D]` as complex numbers and multiplies them by `cos + i·sin` (`[S, D/2]`). Computed in f32, then returned to the original dtype.
fn apply_rope(x: &Array, cos: &Array, sin: &Array) -> Result<Array> {
    let s = x.dim(1);
    let dtype = x.dtype();
    let pairs = x.as_dtype(Dtype::Float32)?.reshape(&[1, s, HEADS, HEAD_DIM / 2, 2])?;
    let x0 = pairs.index((.., .., .., .., 0));
    let x1 = pairs.index((.., .., .., .., 1));
    let cos = cos.reshape(&[1, s, 1, HEAD_DIM / 2])?;
    let sin = sin.reshape(&[1, s, 1, HEAD_DIM / 2])?;
    let y0 = x0.multiply(&cos)?.subtract(&x1.multiply(&sin)?)?;
    let y1 = x0.multiply(&sin)?.add(&x1.multiply(&cos)?)?;
    let y = ops::stack_axis(&[y0, y1], -1)?.reshape(&[1, s, HEADS, HEAD_DIM])?;
    Ok(y.as_dtype(dtype)?)
}

fn gelu_tanh_f32(x: &Array) -> Result<Array> {
    let x = x.as_dtype(Dtype::Float32)?;
    let c = Array::from_f32((2.0f32 / std::f32::consts::PI).sqrt());
    let inner = x.add(&x.multiply(&x)?.multiply(&x)?.multiply(&Array::from_f32(0.044715))?)?;
    let t = ops::tanh(&inner.multiply(&c)?)?;
    Ok(x.multiply(&Array::from_f32(0.5))?.multiply(&t.add(&Array::from_f32(1.0))?)?)
}

impl Block {
    fn load(s: &mut WeightStore, i: usize, prec: Precision) -> Result<Self> {
        let p = format!("transformer_blocks.{i}");
        let (dt, dq) = (prec.compute, prec.dequant);
        // Norm weights are also converted to the compute precision: the output of rms_norm takes the common type of x and the weight, and f16 × bf16 would promote to f32.
        Ok(Self {
            to_q: Lin::load(s, &format!("{p}.attn.to_q"), DIM, dt, dq)?,
            to_k: Lin::load(s, &format!("{p}.attn.to_k"), DIM, dt, dq)?,
            to_v: Lin::load(s, &format!("{p}.attn.to_v"), DIM, dt, dq)?,
            to_out: Lin::load(s, &format!("{p}.attn.to_out.0"), DIM, dt, dq)?,
            norm_q: s.take(&format!("{p}.attn.norm_q.weight"))?.as_dtype(dt)?,
            norm_k: s.take(&format!("{p}.attn.norm_k.weight"))?.as_dtype(dt)?,
            gate: Lin::load(s, &format!("{p}.img_mlp.gate_layer"), DIM, dt, dq)?,
            proj: Lin::load(s, &format!("{p}.img_mlp.proj"), DIM, dt, dq)?,
            out: Lin::load(s, &format!("{p}.img_mlp.out"), INTER, dt, dq)?,
        })
    }

    fn modulate(x: &Array, scale: &Array) -> Result<Array> {
        let n = fast::layer_norm(x, None, None, EPS)?;
        Ok(n.multiply(&scale.add(&scalar(1.0, scale)?)?)?)
    }

    /// Returns (q, k, v), all `[1,H,S,D]`, with q and k already through per-head RMSNorm and RoPE.
    fn qkv(&self, xm: &Array, cos: &Array, sin: &Array) -> Result<(Array, Array, Array)> {
        let s = xm.dim(1);
        let shape = [1, s, HEADS, HEAD_DIM];
        let q = fast::rms_norm(&self.to_q.forward(xm)?.reshape(&shape)?, &self.norm_q, EPS)?;
        let k = fast::rms_norm(&self.to_k.forward(xm)?.reshape(&shape)?, &self.norm_k, EPS)?;
        let v = self.to_v.forward(xm)?.reshape(&shape)?;
        let q = apply_rope(&q, cos, sin)?;
        let k = apply_rope(&k, cos, sin)?;
        let t = [0, 2, 1, 3];
        Ok((q.transpose_axes(&t)?, k.transpose_axes(&t)?, v.transpose_axes(&t)?))
    }

    fn finish(&self, x: &Array, attn: &Array, m: &Mod) -> Result<Array> {
        let s = attn.dim(2);
        let attn = attn.transpose_axes(&[0, 2, 1, 3])?.reshape(&[1, s, DIM])?;
        let attn = self.to_out.forward(&attn)?;
        let x = x.add(&ops::tanh(&m.gate1)?.multiply(&attn)?)?;
        let xm = Self::modulate(&x, &m.scale2)?;
        let h = nn::silu(self.gate.forward(&xm)?)?.multiply(&self.proj.forward(&xm)?)?;
        let h = self.out.forward(&h)?;
        Ok(x.add(&ops::tanh(&m.gate2)?.multiply(&h)?)?)
    }
}

impl Dit {
    /// Only the out-of-layer weights stay resident. The 32 layers are checked here by key (lazily, without reading files); the actual reads happen in each step.
    /// `files` are the safetensors shards under `transformer/`: both the 32 layers and the out-of-layer weights come from here.
    pub fn load(files: &[PathBuf], prec: Precision) -> Result<Self> {
        let mut stream = BlockStream::open(files, prec)?;
        for i in 0..LAYERS {
            stream.take(i, false)?;
        }
        if let Some(k) = stream.lazy.keys().next() {
            bail!("DiT 有多余的层权重：{k}");
        }
        let files = files.to_vec();
        let s = &mut weights::resident(&files, |k| !k.starts_with("transformer_blocks.")).context("加载 DiT 层外权重")?;
        let t1 = pick(s, &["time_text_embed.linear_1", "time_text_embed.timestep_embedder.linear_1"])?;
        let t2 = pick(s, &["time_text_embed.linear_2", "time_text_embed.timestep_embedder.linear_2"])?;
        let modulation = pick(s, &["modulation.0", "modulation.1"])?;
        let dt = prec.compute;
        let me = Self {
            files,
            prec,
            img_in: Lin::load(s, "img_in", 64, dt, false)?,
            t_lin1: Lin::load(s, t1, 256, dt, false)?,
            t_lin2: Lin::load(s, t2, DIM, dt, false)?,
            modulation: Lin::load(s, modulation, DIM, dt, false)?,
            txt_norm: s.take("txt_in.text_norm.weight")?,
            txt_in1: Lin::load(s, "txt_in.in_layer", DIM, dt, false)?,
            txt_in2: Lin::load(s, "txt_in.out_layer", DIM, dt, false)?,
            norm_out: Lin::load(s, "norm_out.linear", DIM, dt, false)?,
            proj_out: Lin::load(s, "proj_out", DIM, dt, false)?,
        };
        let left = s.remaining();
        if !left.is_empty() {
            bail!("DiT 有未使用的权重：{:?}", &left[..left.len().min(5)]);
        }
        Ok(me)
    }

    /// Sinusoidal timestep embedding → MLP, returns `[1, DIM]` (bf16). `sigma` reproduces the pipeline's two bf16 roundings.
    fn temb(&self, sigma: f64) -> Result<Array> {
        let t = bf16_round(bf16_round((sigma * 1000.0) as f32) / 1000.0);
        let half = 128usize;
        let mut emb = vec![0f32; 2 * half];
        for i in 0..half {
            let f = (-(10000f32.ln()) * i as f32 / half as f32).exp();
            let a = 1000.0 * t * f;
            emb[i] = a.cos();
            emb[half + i] = a.sin();
        }
        let x = Array::from_slice(&emb, &[1, 256]).as_dtype(Dtype::Bfloat16)?;
        let h = nn::silu(self.t_lin1.forward(&x)?)?;
        self.t_lin2.forward(&h)
    }

    fn mods(&self, temb: &Array) -> Result<Mod> {
        let m = self.modulation.forward(&nn::silu(temb)?)?;
        let part = |k: i32| -> Result<Array> { Ok(m.index((.., k * DIM..(k + 1) * DIM)).reshape(&[1, 1, DIM])?) };
        Ok(Mod {
            scale1: part(0)?,
            gate1: part(1)?,
            scale2: part(2)?,
            gate2: part(3)?,
        })
    }

    fn tables(cos: &[f32], sin: &[f32], from: usize, to: usize) -> (Array, Array) {
        let half = (HEAD_DIM / 2) as usize;
        let n = (to - from) as i32;
        (
            Array::from_slice(&cos[from * half..to * half], &[n, HEAD_DIM / 2]),
            Array::from_slice(&sin[from * half..to * half], &[n, HEAD_DIM / 2]),
        )
    }

    /// Image tokens pass through one layer. First q/k/v are computed block by block (K/V are concatenated after the text prefix to form the whole). Then attention, to_out and the MLP are computed block by block, and each block is evaluated before moving on to the next. Each token's operations are exactly the same as without blocking.
    #[allow(clippy::too_many_arguments)]
    fn image_layer(
        b: &Block,
        tk: &Array,
        tv: &Array,
        x: &Array,
        m: &Mod,
        cos: &Array,
        sin: &Array,
        ranges: &[(i32, i32)],
    ) -> Result<Array> {
        let mut qs = Vec::with_capacity(ranges.len());
        let mut ks = vec![tk.clone()];
        let mut vs = vec![tv.clone()];
        for &(s, e) in ranges {
            let xm = Block::modulate(&x.index((.., s..e, ..)), &m.scale1)?;
            let (q, k, v) = b.qkv(&xm, &cos.index((s..e, ..)), &sin.index((s..e, ..)))?;
            mlx_rs::transforms::eval([&q, &k, &v])?;
            qs.push(q);
            ks.push(k);
            vs.push(v);
        }
        let k = ops::concatenate_axis(&ks, 2)?;
        let v = ops::concatenate_axis(&vs, 2)?;
        drop((ks, vs));
        let scale = (HEAD_DIM as f32).sqrt().recip();
        let mut outs = Vec::with_capacity(ranges.len());
        for (&(s, e), q) in ranges.iter().zip(qs) {
            let attn = fast::scaled_dot_product_attention(&q, &k, &v, scale, None::<ScaledDotProductAttentionMask<'_>>, None)?;
            let y = b.finish(&x.index((.., s..e, ..)), &attn, m)?;
            y.eval()?;
            outs.push(y);
        }
        if outs.len() == 1 {
            return Ok(outs.pop().unwrap());
        }
        let y = ops::concatenate_axis(&outs, 1)?;
        y.eval()?;
        Ok(y)
    }

    /// Text prefix: `enc` is the text encoder output `[1,L,4096]`. Only `txt_in` is applied here; the per-layer part is merged into the first step.
    pub fn prepare_text(&self, enc: &Array, grid_h: usize, grid_w: usize) -> Result<TextCache> {
        let text_len = enc.dim(1) as usize;
        let (cos_all, sin_all) = rope::dit_rope_tables(text_len, grid_h, grid_w);
        let (cos, sin) = Self::tables(&cos_all, &sin_all, 0, text_len);
        // ZeroCenterRMSNorm: in fp32, `x * rsqrt(mean(x²)+eps) * (w+1)`.
        let dtype = enc.dtype();
        let w1 = self.txt_norm.as_dtype(Dtype::Float32)?.add(&Array::from_f32(1.0))?;
        let normed = fast::rms_norm(&enc.as_dtype(Dtype::Float32)?, &w1, EPS)?.as_dtype(dtype)?;
        let h = gelu_tanh_f32(&self.txt_in1.forward(&normed)?)?.as_dtype(dtype)?;
        let x = self.txt_in2.forward(&h)?.as_dtype(self.prec.resid())?;
        let m = self.mods(&self.temb(0.0)?)?;
        Ok(TextCache {
            kv: Vec::with_capacity(LAYERS),
            text_len,
            pending: Some(TextPending { x, m, cos, sin }),
        })
    }

    /// A text token passes through one layer (causal attention, t=0 modulation) and returns this layer's text K/V.
    fn text_layer(b: &Block, p: &mut TextPending) -> Result<(Array, Array)> {
        let xm = Block::modulate(&p.x, &p.m.scale1)?;
        let (q, k, v) = b.qkv(&xm, &p.cos, &p.sin)?;
        let scale = (HEAD_DIM as f32).sqrt().recip();
        let attn = fast::scaled_dot_product_attention(&q, &k, &v, scale, Some(ScaledDotProductAttentionMask::Causal), None)?;
        p.x = b.finish(&p.x, &attn, &p.m)?;
        mlx_rs::transforms::eval([&p.x, &k, &v])?;
        Ok((k, v))
    }

    /// One denoising step: `latents` is `[1, N, 64]` (any float dtype), and it returns the velocity field `[1, N, 64]` (f32).
    /// Each layer is computed in blocks of `chunk` image tokens (K/V are still for the whole image), which reduces the per-layer temporaries to 1/⌈N/chunk⌉.
    /// Layer weights are streamed in layer by layer. On the first step, the text prefix's K/V are also filled into `cache`.
    pub fn step(&self, cache: &mut TextCache, latents: &Array, sigma: f64, grid_h: usize, grid_w: usize, chunk: usize) -> Result<Array> {
        let n = grid_h * grid_w;
        if latents.dim(1) as usize != n {
            bail!("latent token 数 {} ≠ {grid_h}×{grid_w}", latents.dim(1));
        }
        let (cos_all, sin_all) = rope::dit_rope_tables(cache.text_len, grid_h, grid_w);
        let (cos, sin) = Self::tables(&cos_all, &sin_all, cache.text_len, cache.text_len + n);
        let temb = self.temb(sigma)?;
        let m = self.mods(&temb)?;
        let mut x = self
            .img_in
            .forward(&latents.as_dtype(Dtype::Bfloat16)?)?
            .as_dtype(self.prec.resid())?;
        let n = n as i32;
        let chunk = chunk.max(1) as i32;
        let ranges: Vec<(i32, i32)> = (0..n).step_by(chunk as usize).map(|s| (s, (s + chunk).min(n))).collect();
        let mut stream = BlockStream::open(&self.files, self.prec)?;
        let mut next = Some(stream.take(0, true)?);
        for i in 0..LAYERS {
            let b = next.take().context("DiT 层权重缺失")?;
            if i + 1 < LAYERS {
                next = Some(stream.take(i + 1, true)?);
            }
            if let Some(p) = cache.pending.as_mut() {
                let kv = Self::text_layer(&b, p)?;
                cache.kv.push(kv);
            }
            let (tk, tv) = &cache.kv[i];
            x = Self::image_layer(&b, tk, tv, &x, &m, &cos, &sin, &ranges)?;
        }
        cache.pending = None;
        let s = self.norm_out.forward(&nn::silu(&temb)?)?.reshape(&[1, 1, DIM])?;
        let x = Block::modulate(&x, &s)?;
        let out = self.proj_out.forward(&x)?.as_dtype(Dtype::Float32)?;
        out.eval()?;
        if self.prec.compute == Dtype::Float16 {
            let finite = out.is_finite()?.all(None)?;
            finite.eval()?;
            if !finite.item::<bool>() {
                return Err(Overflow.into());
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::{Probe, bf16_round};
    use mlx_rs::Dtype;

    #[test]
    fn probe_picks_bf16_only_when_it_is_not_much_slower() {
        let pick = |f16_ms, bf16_ms| Probe { f16_ms, bf16_ms }.pick();
        // M2 measurement (qmm with --bench 4096): bf16 is about 1.77× slower
        assert_eq!(pick(661.0, 1169.0), Dtype::Float16);
        assert_eq!(pick(10.0, 10.5), Dtype::Bfloat16);
        assert_eq!(pick(10.0, 9.0), Dtype::Bfloat16);
        assert_eq!(pick(10.0, 13.5), Dtype::Float16);
    }

    #[test]
    fn bf16_rounding_matches_torch() {
        assert_eq!(bf16_round(1.0), 1.0);
        // At 987.6 under bf16, the adjacent representable values are 984 and 988
        assert_eq!(bf16_round(987.6), 988.0);
        assert_eq!(bf16_round(0.1), 0.10009765625);
    }
}

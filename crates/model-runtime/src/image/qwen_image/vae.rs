//! Single-frame (image) specialization of AutoencoderKLQwenImage21, NHWC.
//!
//! The reference implementation is the Wan-family 3D causal VAE, but 2.1 already specialized CausalConv3d into 2D convolution. When decoding a single frame, all `time_conv` take the "Rep"/first-chunk branch and are skipped,
//! so what remains here is 2D convolution, channel RMSNorm, single-head attention, and the DupUp3D / AvgDown3D shortcuts in the residual up/down-sampling blocks (first-frame version).
//!
//! Weights are stored as F32 in both packages (the 4-bit package uses MLX layout, the 8-bit package uses PyTorch layout; both are unified to MLX layout at load time),
//! and converted per tensor to the compute precision (default f16; `--vae-dtype` can switch to bf16 / f32 for comparison).

use crate::backend::mlx::qwen3::WeightStore;
use anyhow::{Context, Result, bail};
use mlx_rs::ops::indexing::IndexOp;
use mlx_rs::{Array, Dtype, fast, nn, ops};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const DECODER_BASE_DIM: i32 = 144;
const DIM_MULT: [i32; 5] = [1, 2, 4, 8, 8];
const TEMPORAL_DOWN: [bool; 4] = [false, true, true, true];
const NUM_RES: usize = 2;
pub const Z_DIM: i32 = 64;

/// Convolution layer. The 3×3 kernel is spatially flipped at load time, and the forward pass is called with `flip=true` (true convolution). The result is still the original cross-correlation,
/// but MLX then does not use Winograd and uses implicit GEMM instead. Winograd allocates a 64×C×O transformed kernel on every call (170 MB for 1152 channels in f16), transformed tensors of about 1.8× the input and 1.8× the output,
/// and a zero-padded copy; the 1024² decoding peak is therefore 0.6 GB higher. Implicit GEMM only allocates the output, at the cost of VAE decoding being about 1.5× slower (under 1% of the whole generation).
struct Conv {
    w: Array,
    b: Array,
    pad: i32,
    stride: i32,
    flip: bool,
}

impl Conv {
    fn load(s: &mut WeightStore, p: &str, pad: i32, stride: i32) -> Result<Self> {
        // Weights are [O, kh, kw, C].
        let mut w = s.take(&format!("{p}.weight"))?;
        let flip = w.dim(1) > 1;
        if flip {
            let k = w.dim(1);
            let rev = Array::from_slice(&(0..k).rev().collect::<Vec<i32>>(), &[k]);
            w = w.take_axis(&rev, 1)?.take_axis(&rev, 2)?;
            w.eval()?;
        }
        Ok(Self {
            w,
            b: s.take(&format!("{p}.bias"))?,
            pad,
            stride,
            flip,
        })
    }
    fn conv(&self, x: &Array, stride: i32, pad: i32) -> Result<Array> {
        Ok(ops::conv_general(
            x,
            &self.w,
            &[stride, stride][..],
            &[pad, pad][..],
            None,
            None,
            None,
            self.flip,
        )?)
    }
    fn forward(&self, x: &Array) -> Result<Array> {
        let (h, w, c) = (x.dim(1) as i64, x.dim(2) as i64, x.dim(3) as i64);
        let elems = h * w * c;
        if self.pad == 1 && self.stride == 1 && elems > BAND_ELEMS {
            return self.forward_bands(x, (elems + BAND_ELEMS - 1) / BAND_ELEMS);
        }
        Ok(self.conv(x, self.stride, self.pad)?.add(&self.b)?)
    }

    /// High-resolution 3×3 convolutions are computed in row strips (each strip carries 1 halo row above and below), and evaluated strip by strip, to keep the output and temporary buffers of a single convolution down
    /// (rarely triggered with the default tail strips; mainly guards `--vae-tail-rows 0`).
    /// Zero padding is also done strip by strip (rows are padded only at the top and bottom edges of the image), without materializing a full padded copy.
    fn forward_bands(&self, x: &Array, bands: i64) -> Result<Array> {
        let h = x.dim(1);
        let rows = ((h as i64 + bands - 1) / bands) as i32;
        let mut outs = Vec::new();
        let mut r0 = 0;
        while r0 < h {
            let r1 = (r0 + rows).min(h);
            let (u0, u1) = ((r0 - 1).max(0), (r1 + 1).min(h));
            outs.push(self.conv_rows(&x.index((.., u0..u1, .., ..)), r0, r1, u0, u1, None)?);
            r0 = r1;
        }
        Ok(ops::concatenate_axis(&outs, 1)?)
    }

    /// `slab` is the input rows `[u0, u1)`, computing the output rows `[r0, r1)`: for `u0`/`u1`, the row cut off by the image edge is zero-padded, and one column is padded on each side. `add` is the residual shortcut to add to these rows. Returns after evaluating.
    fn conv_rows(&self, slab: &Array, r0: i32, r1: i32, u0: i32, u1: i32, add: Option<Array>) -> Result<Array> {
        let widths = [(0, 0), (u0 - (r0 - 1), (r1 + 1) - u1), (1, 1), (0, 0)];
        let slab = ops::pad(slab, &widths[..], None, None)?;
        let mut y = self.conv(&slab, 1, 0)?.add(&self.b)?;
        if let Some(a) = add {
            y = y.add(&a)?;
        }
        y.eval()?;
        Ok(y)
    }

    /// `conv(upsample2x(x)) + shortcut`. Large images are computed by output row strips: each strip upsamples only the low-resolution rows it needs (including halo),
    /// so the full 2× tensor, its zero-padded copy and the full shortcut are never materialized. `shortcut(a, b)` gives the shortcut for output rows `[a, b)` (`a` and `b` are both even).
    fn forward_up2(&self, x: &Array, shortcut: impl Fn(i32, i32) -> Result<Array>) -> Result<Array> {
        let (h, w, c) = (x.dim(1), x.dim(2), x.dim(3));
        let hu = 2 * h;
        let elems = 4 * h as i64 * w as i64 * c as i64;
        if elems <= BAND_ELEMS {
            return Ok(self.forward(&upsample2x(x)?)?.add(&shortcut(0, hu)?)?);
        }
        let bands = (elems + BAND_ELEMS - 1) / BAND_ELEMS;
        let rows = (hu as u64).div_ceil(bands as u64).next_multiple_of(2) as i32;
        let mut outs = Vec::new();
        let mut r0 = 0;
        while r0 < hu {
            let r1 = (r0 + rows).min(hu);
            // Needs the upsampled rows [u0, u1), which come from the low-resolution rows [l0, l1).
            let (u0, u1) = ((r0 - 1).max(0), (r1 + 1).min(hu));
            let (l0, l1) = (u0 / 2, (u1 + 1) / 2);
            let up = upsample2x(&x.index((.., l0..l1, .., ..)))?;
            let up = up.index((.., u0 - 2 * l0..u1 - 2 * l0, .., ..));
            outs.push(self.conv_rows(&up, r0, r1, u0, u1, Some(shortcut(r0, r1)?))?);
            r0 = r1;
        }
        Ok(ops::concatenate_axis(&outs, 1)?)
    }
}

/// 3×3 convolution inputs above this element count (about 256 MB in f32) switch to strips.
const BAND_ELEMS: i64 = 64 << 20;

/// `F.normalize(x, dim=C) * sqrt(C) * gamma` is equivalent to a channel-wise RMSNorm.
struct RmsNorm {
    gamma: Array,
}

impl RmsNorm {
    fn load(s: &mut WeightStore, p: &str) -> Result<Self> {
        Ok(Self {
            gamma: s.take(&format!("{p}.gamma"))?,
        })
    }
    fn forward(&self, x: &Array) -> Result<Array> {
        Ok(fast::rms_norm(x, &self.gamma, 1e-12)?)
    }
}

struct ResBlock {
    norm1: RmsNorm,
    conv1: Conv,
    norm2: RmsNorm,
    conv2: Conv,
    shortcut: Option<Conv>,
}

impl ResBlock {
    fn load(s: &mut WeightStore, p: &str, in_dim: i32, out_dim: i32) -> Result<Self> {
        Ok(Self {
            norm1: RmsNorm::load(s, &format!("{p}.norm1"))?,
            conv1: Conv::load(s, &format!("{p}.conv1"), 1, 1)?,
            norm2: RmsNorm::load(s, &format!("{p}.norm2"))?,
            conv2: Conv::load(s, &format!("{p}.conv2"), 1, 1)?,
            shortcut: if in_dim != out_dim {
                Some(Conv::load(s, &format!("{p}.conv_shortcut"), 0, 1)?)
            } else {
                None
            },
        })
    }
    fn forward(&self, x: &Array) -> Result<Array> {
        let h = match &self.shortcut {
            Some(c) => c.forward(x)?,
            None => x.clone(),
        };
        let y = self.conv1.forward(&nn::silu(self.norm1.forward(x)?)?)?;
        let y = self.conv2.forward(&nn::silu(self.norm2.forward(&y)?)?)?;
        Ok(y.add(&h)?)
    }
}

struct Attention {
    norm: RmsNorm,
    to_qkv: Conv,
    proj: Conv,
}

impl Attention {
    fn load(s: &mut WeightStore, p: &str) -> Result<Self> {
        Ok(Self {
            norm: RmsNorm::load(s, &format!("{p}.norm"))?,
            to_qkv: Conv::load(s, &format!("{p}.to_qkv"), 0, 1)?,
            proj: Conv::load(s, &format!("{p}.proj"), 0, 1)?,
        })
    }
    fn forward(&self, x: &Array) -> Result<Array> {
        let (h, w, c) = (x.dim(1), x.dim(2), x.dim(3));
        let qkv = self.to_qkv.forward(&self.norm.forward(x)?)?.reshape(&[1, 1, h * w, 3 * c])?;
        let parts = qkv.split(3, -1)?;
        let scale = (c as f32).sqrt().recip();
        let o = fast::scaled_dot_product_attention(
            &parts[0],
            &parts[1],
            &parts[2],
            scale,
            None::<fast::ScaledDotProductAttentionMask<'_>>,
            None,
        )?;
        let o = self.proj.forward(&o.reshape(&[1, h, w, c])?)?;
        Ok(o.add(x)?)
    }
}

struct MidBlock {
    res0: ResBlock,
    attn: Attention,
    res1: ResBlock,
}

impl MidBlock {
    fn load(s: &mut WeightStore, p: &str, dim: i32) -> Result<Self> {
        Ok(Self {
            res0: ResBlock::load(s, &format!("{p}.resnets.0"), dim, dim)?,
            attn: Attention::load(s, &format!("{p}.attentions.0"))?,
            res1: ResBlock::load(s, &format!("{p}.resnets.1"), dim, dim)?,
        })
    }
    fn forward(&self, x: &Array) -> Result<Array> {
        let x = self.res0.forward(x)?;
        let x = self.attn.forward(&x)?;
        self.res1.forward(&x)
    }
}

/// nearest 2x (at integer scale factors, nearest-exact is per-pixel copying).
fn upsample2x(x: &Array) -> Result<Array> {
    let (h, w, c) = (x.dim(1), x.dim(2), x.dim(3));
    let y = x.reshape(&[1, h, 1, w, 1, c])?;
    let y = ops::broadcast_to(&y, &[1, h, 2, w, 2, c])?;
    Ok(y.reshape(&[1, 2 * h, 2 * w, c])?)
}

/// First-frame branch of DupUp3D: channels are expanded with `repeat_interleave`, the temporal phase `ft-1` is taken, then pixel-shuffled 2x.
/// Output channel `o`, sub-pixel `(b1,b2)` reads input channel `(o*ft*4 + (ft-1)*4 + b1*2 + b2) / r`.
fn dup_up(x: &Array, in_dim: i32, out_dim: i32, ft: i32) -> Result<Array> {
    let r = out_dim * ft * 4 / in_dim;
    let mut idx = Vec::with_capacity((out_dim * 4) as usize);
    for b1 in 0..2 {
        for b2 in 0..2 {
            for o in 0..out_dim {
                idx.push((o * ft * 4 + (ft - 1) * 4 + b1 * 2 + b2) / r);
            }
        }
    }
    let idx = Array::from_slice(&idx, &[out_dim * 4]);
    let (h, w) = (x.dim(1), x.dim(2));
    let g = x.take_axis(&idx, 3)?.reshape(&[1, h, w, 2, 2, out_dim])?;
    let g = g.transpose_axes(&[0, 1, 3, 2, 4, 5])?;
    Ok(g.reshape(&[1, 2 * h, 2 * w, out_dim])?)
}

struct UpBlock {
    resnets: Vec<ResBlock>,
    upsampler: Option<Conv>,
    in_dim: i32,
    out_dim: i32,
    ft: i32,
}

impl UpBlock {
    fn forward(&self, x: &Array) -> Result<Array> {
        let mut y = x.clone();
        for r in &self.resnets {
            y = r.forward(&y)?;
            y.eval()?;
        }
        if let Some(up) = &self.upsampler {
            // The shortcut DupUp3D only looks at the corresponding input position per pixel: output rows [a, b) come from input rows [a/2, b/2).
            let shortcut = |a: i32, b: i32| {
                let rows = x.index((.., a / 2..b / 2, .., ..));
                dup_up(&rows, self.in_dim, self.out_dim, self.ft)
            };
            y = up.forward_up2(&y, shortcut)?;
        }
        y.eval()?;
        Ok(y)
    }
}

/// From this up_block onward (together with norm_out / conv_out), decoding is done by row strips. The activations after it take up most of the decoding memory
/// (0.6–1.2 GB for one tensor at 1024²), while the layers before it have more channels and lower resolution, so computing them whole is more efficient.
const TAIL_FROM: usize = 2;

/// Number of extra rows above and below each tail strip, at the `TAIL_FROM` input resolution. The tail only has per-pixel channel RMSNorm, 1×1 shortcuts, nearest-neighbor upsampling and 3×3 convolutions.
/// Counting back from the output: the 6 convolutions of conv_out + up_block 4 need 7 rows at 4× resolution, plus 1 row for the up_block 3 upsampling convolution → 4 rows at 2× resolution;
/// adding the 6 convolutions of up_block 3 and the upsampling convolution of up_block 2 → 11 rows → 6 rows at 1× resolution; adding the 6 convolutions of up_block 2 = 12 rows.
/// The zero-padding error at a strip edge leaks 1 row inward per convolution, so a 12-row halo keeps all of it inside the cropped part.
const TAIL_HALO: i32 = 12;

/// Automatically chooses the strip row count. The largest tensor in the tail is at 4× resolution with 288 channels (each input row corresponds to 4 rows × 4× width),
/// so that it, including the halo, does not exceed `TAIL_ELEMS`.
fn auto_tail_rows(width: i32) -> i32 {
    let per_row = 16 * width as i64 * 288;
    ((TAIL_ELEMS / per_row.max(1)) as i32 - 2 * TAIL_HALO).max(TAIL_HALO)
}

/// Upper limit on the elements of the largest tensor within one tail strip. At 1024², it is 8 strips × 32 rows, with a decoding MLX peak of 0.87 GB (86 rows: 1.23 GB; whole image: 2.26 GB).
/// That already exceeds the DiT stage (0.63 GB), so strips are not enlarged to save halo recomputation.
const TAIL_ELEMS: i64 = 64 << 20;

pub struct Decoder {
    post_quant_conv: Conv,
    conv_in: Conv,
    mid: MidBlock,
    ups: Vec<UpBlock>,
    norm_out: RmsNorm,
    conv_out: Conv,
    mean: Array,
    std: Array,
    dtype: Dtype,
}

#[derive(serde::Deserialize)]
struct VaeConfig {
    latents_mean: Vec<f32>,
    latents_std: Vec<f32>,
}

/// After lazy opening, each tensor is converted to `dtype` and evaluated immediately, so the F32 originals keep only one tensor in memory at a time.
/// `time_conv` is only used for multi-frame input; it is not read for single frames.
fn load_store(files: &[PathBuf], prefix: &'static str, dtype: Dtype) -> Result<WeightStore> {
    let lazy = super::weights::lazy(files, move |k| {
        let ours = match prefix {
            "decoder" => k.starts_with("decoder.") || k.starts_with("post_quant_conv."),
            _ => k.starts_with("encoder.") || k.starts_with("quant_conv."),
        };
        ours && !k.contains(".time_conv.")
    })
    .context("加载 VAE 权重")?;
    // The mlx-community package uses MLX layout (conv kernel [O,kh,kw,C], gamma [C]); the ddalcu 8-bit package keeps PyTorch layout ([O,C,kh,kw], gamma [C,1,1(,1)]).
    // When C=3/4, the 3×3 kernel shapes can be identical in both layouts, so the layout is decided as a whole from this half's (post_)quant_conv (a 1×1 convolution C→C, C > 1).
    let probe = if prefix == "decoder" {
        "post_quant_conv.weight"
    } else {
        "quant_conv.weight"
    };
    let torch = match lazy.get(probe).map(|w| w.shape().to_vec()).as_deref() {
        Some(&[o, 1, 1, c]) if o == c && c > 1 => false,
        Some(&[o, c, 1, 1]) if o == c && c > 1 => true,
        other => bail!("{probe} 的形状认不出布局：{other:?}"),
    };
    let mut cast = HashMap::with_capacity(lazy.len());
    for (k, v) in lazy {
        let v = if !torch {
            v
        } else if k.ends_with(".weight") && v.ndim() == 4 {
            v.transpose_axes(&[0, 2, 3, 1])?
        } else if k.ends_with(".gamma") {
            v.flatten(None, None)?
        } else {
            v
        };
        let c = v.as_dtype(dtype)?;
        c.eval()?;
        cast.insert(k, c);
    }
    WeightStore::from_arrays(cast)
}

impl Decoder {
    /// `files` are the safetensors shards under `vae/`, and `config` is `vae/config.json`.
    pub fn load(files: &[PathBuf], config: &Path, dtype: Dtype) -> Result<Self> {
        let cfg: VaeConfig = serde_json::from_str(&std::fs::read_to_string(config).context("读取 vae/config.json")?)?;
        if cfg.latents_mean.len() != Z_DIM as usize || cfg.latents_std.len() != Z_DIM as usize {
            bail!("vae config 的 latents_mean/std 长度不是 {Z_DIM}");
        }
        let s = &mut load_store(files, "decoder", dtype)?;
        // dims = base * [mult[-1]] + mult[::-1] = [1152,1152,1152,576,288,144]
        let mut dims = vec![DECODER_BASE_DIM * DIM_MULT[4]];
        dims.extend(DIM_MULT.iter().rev().map(|m| DECODER_BASE_DIM * m));
        let temporal_up: Vec<bool> = TEMPORAL_DOWN.iter().rev().copied().collect();
        let mut ups = Vec::new();
        for i in 0..5 {
            let (in_dim, out_dim) = (dims[i], dims[i + 1]);
            let p = format!("decoder.up_blocks.{i}");
            let mut resnets = Vec::new();
            let mut cur = in_dim;
            for j in 0..=NUM_RES {
                resnets.push(ResBlock::load(s, &format!("{p}.resnets.{j}"), cur, out_dim)?);
                cur = out_dim;
            }
            let up = i != 4;
            ups.push(UpBlock {
                resnets,
                upsampler: if up {
                    Some(Conv::load(s, &format!("{p}.upsampler.resample.1"), 1, 1)?)
                } else {
                    None
                },
                in_dim,
                out_dim,
                ft: if up && temporal_up[i] { 2 } else { 1 },
            });
        }
        let me = Self {
            post_quant_conv: Conv::load(s, "post_quant_conv", 0, 1)?,
            conv_in: Conv::load(s, "decoder.conv_in", 1, 1)?,
            mid: MidBlock::load(s, "decoder.mid_block", dims[0])?,
            ups,
            norm_out: RmsNorm::load(s, "decoder.norm_out")?,
            conv_out: Conv::load(s, "decoder.conv_out", 1, 1)?,
            mean: Array::from_slice(&cfg.latents_mean, &[1, 1, 1, Z_DIM]),
            std: Array::from_slice(&cfg.latents_std, &[1, 1, 1, Z_DIM]),
            dtype,
        };
        let left = s.remaining();
        if !left.is_empty() {
            bail!("VAE 解码器有未使用的权重：{:?}", &left[..left.len().min(5)]);
        }
        Ok(me)
    }

    /// DiT-space latent (`[1,h,w,64]`, already normalized by mean/std) → `[1,H,W,4]`, range [-1,1].
    /// Denormalization is done in f32, and only then is it converted to the VAE's compute precision.
    pub fn decode_normalized(self, latents: &Array, tail_rows: Option<usize>) -> Result<Array> {
        let z = latents.as_dtype(Dtype::Float32)?.multiply(&self.std)?.add(&self.mean)?;
        self.decode_raw(&z, tail_rows)
    }

    /// Raw encoder mu (not normalized) → image. The front stages (mid and up_block 0–1) drop their weights as soon as they are computed; the tail is processed in strips of `tail_rows` rows (`None` auto-selects, `Some(0)` processes the whole image).
    pub fn decode_raw(self, z: &Array, tail_rows: Option<usize>) -> Result<Array> {
        let Self {
            post_quant_conv,
            conv_in,
            mid,
            mut ups,
            norm_out,
            conv_out,
            dtype,
            ..
        } = self;
        let tail = ups.split_off(TAIL_FROM);
        let x = post_quant_conv.forward(&z.as_dtype(dtype)?)?;
        let x = conv_in.forward(&x)?;
        let mut x = mid.forward(&x)?;
        x.eval()?;
        drop((post_quant_conv, conv_in, mid));
        for (i, b) in ups.into_iter().enumerate() {
            x = b.forward(&x)?;
            trace!("[vae] up_block {i} -> {:?}", x.shape());
        }
        let h = x.dim(1);
        let rows = match tail_rows {
            None => auto_tail_rows(x.dim(2)),
            Some(0) => h,
            Some(n) => n as i32,
        };
        let bands = (h + rows - 1) / rows;
        let rows = (h + bands - 1) / bands;
        let scale = 1 << tail.iter().filter(|b| b.upsampler.is_some()).count();
        let mut outs = Vec::with_capacity(bands as usize);
        let mut r0 = 0;
        while r0 < h {
            let r1 = (r0 + rows).min(h);
            let (a, b) = ((r0 - TAIL_HALO).max(0), (r1 + TAIL_HALO).min(h));
            let mut y = x.index((.., a..b, .., ..));
            for blk in &tail {
                y = blk.forward(&y)?;
            }
            let y = conv_out.forward(&nn::silu(norm_out.forward(&y)?)?)?;
            let y = y.index((.., (r0 - a) * scale..(r1 - a) * scale, .., ..));
            // f16 overflow shows up as inf/NaN; check before clip, since after clipping NaN may be clamped to the boundary value.
            let finite = y.is_finite()?.all(None)?;
            finite.eval()?;
            if !finite.item::<bool>() {
                bail!("VAE 解码在 {dtype:?} 下出现非有限值");
            }
            let y = ops::clip(&y, (-1.0f32, 1.0f32))?;
            y.eval()?;
            outs.push(y);
            r0 = r1;
        }
        trace!("[vae] 尾段 {} 条带 × {rows} 行（halo {TAIL_HALO}）-> {} 行", outs.len(), h * scale);
        let out = ops::concatenate_axis(&outs, 1)?;
        out.eval()?;
        Ok(out)
    }
}

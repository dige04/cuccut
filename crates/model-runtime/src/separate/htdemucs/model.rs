//! Parts are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SourceSeparation/HTDemucs/HTDemucs.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-bundle interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Forward pass of a single HTDemucs sub-model, checked line by line against speech-swift `HTDemucs.swift`
//! (the layer loop in init is given by `config::layer_plan`; STFT / iSTFT are done on the CPU with realfft).

use super::layers::{Conv1dW, HDecLayer, HDecSpec, HEncLayer, HEncSpec};
use super::tensor::ops::indexing::IndexOp;
use super::tensor::{Array, ops, transforms};
use super::transformer::CrossTransformerEncoder;
use super::weights::WeightStore;
use crate::separate::config::HtDemucsConfig;
use crate::separate::stft::{Complex32, Spectrogram, Spectrum};
use anyhow::{Context, Result, bail};

pub struct HtDemucsModel {
    audio_channels: usize,
    num_sources: usize,
    training_length: usize,
    depth: usize,
    bottom_channels: usize,
    encoder: Vec<HEncLayer>,
    tencoder: Vec<HEncLayer>,
    decoder: Vec<HDecLayer>,
    tdecoder: Vec<HDecLayer>,
    /// Frequency embedding with `emb_scale × freq_emb` already multiplied in, `[1, C, freqs, 1]`.
    freq_emb: Array,
    channel_upsampler: Conv1dW,
    channel_downsampler: Conv1dW,
    channel_upsampler_t: Conv1dW,
    channel_downsampler_t: Conv1dW,
    crosstransformer: CrossTransformerEncoder,
    spectrogram: Spectrogram,
}

impl HtDemucsModel {
    pub fn new(config: &HtDemucsConfig, store: &mut WeightStore) -> Result<Self> {
        let a = &config.arch;
        let plan = config.layer_plan()?;
        let depth = a.depth;
        let dconv_enc = if a.dconv_mode & 1 != 0 {
            Some((a.dconv_depth, a.dconv_comp as i32))
        } else {
            None
        };
        let dconv_dec = if a.dconv_mode & 2 != 0 {
            Some((a.dconv_depth, a.dconv_comp as i32))
        } else {
            None
        };

        let mut encoder = Vec::with_capacity(depth);
        let mut tencoder = Vec::with_capacity(depth);
        let mut decoder = Vec::with_capacity(depth);
        let mut tdecoder = Vec::with_capacity(depth);
        for (index, p) in plan.iter().enumerate() {
            encoder.push(HEncLayer::load(
                store,
                &HEncSpec {
                    prefix: &format!("encoder.{index}"),
                    chin: p.chin_z as i32,
                    chout: p.chout_z as i32,
                    kernel: p.freq_kernel as i32,
                    stride: p.freq_stride as i32,
                    pad: p.freq_pad as i32,
                    freq: true,
                    rewrite: a.rewrite,
                    context: a.context_enc as i32,
                    dconv: dconv_enc,
                },
            )?);
            tencoder.push(HEncLayer::load(
                store,
                &HEncSpec {
                    prefix: &format!("tencoder.{index}"),
                    chin: p.chin_t as i32,
                    chout: p.chout_t as i32,
                    kernel: p.time_kernel as i32,
                    stride: p.time_stride as i32,
                    pad: p.time_pad as i32,
                    freq: false,
                    rewrite: a.rewrite,
                    context: a.context_enc as i32,
                    dconv: dconv_enc,
                },
            )?);
            // In Swift the decoder calls insert(at: 0) each time, so `decoder.{i}` corresponds to plan[depth-1-i].
            let dec_index = depth - 1 - index;
            decoder.push(HDecLayer::load(
                store,
                &HDecSpec {
                    prefix: &format!("decoder.{dec_index}"),
                    chin: p.chout_z as i32,
                    chout: p.dec_chout_z as i32,
                    kernel: p.freq_kernel as i32,
                    stride: p.freq_stride as i32,
                    pad: p.freq_pad as i32,
                    last: index == 0,
                    freq: true,
                    rewrite: a.rewrite,
                    context: a.context as i32,
                    dconv: dconv_dec,
                },
            )?);
            tdecoder.push(HDecLayer::load(
                store,
                &HDecSpec {
                    prefix: &format!("tdecoder.{dec_index}"),
                    chin: p.chout_t as i32,
                    chout: p.dec_chout_t as i32,
                    kernel: p.time_kernel as i32,
                    stride: p.time_stride as i32,
                    pad: p.time_pad as i32,
                    last: index == 0,
                    freq: false,
                    rewrite: a.rewrite,
                    context: a.context as i32,
                    dconv: dconv_dec,
                },
            )?);
        }
        // The Swift dec array is built with insert(at: 0): dec[0] is the deepest layer.
        decoder.reverse();
        tdecoder.reverse();

        // freq_emb = ScaledEmbedding(freqs after layer 0, chin_z after layer 0, scale emb_scale)
        let emb_freqs = plan[0].freqs_out as i32;
        let emb_channels = plan[0].chout_z as i32;
        let freq_emb = store
            .take_shape("freq_emb.embedding.weight", &[emb_freqs, emb_channels])?
            .multiply(Array::from_f32(a.emb_scale * a.freq_emb))?
            .t()
            .reshape(&[1, emb_channels, emb_freqs, 1])?;

        let tc = config.transformer_channels() as i32;
        let dim = config.transformer_dim() as i32;
        if a.bottom_channels == 0 || a.t_layers == 0 {
            bail!("this port requires bottom_channels > 0 and t_layers > 0 (htdemucs_ft config)");
        }
        let channel_upsampler = Conv1dW::load(store, "channel_upsampler", tc, dim, 1, 1, 0, 1)?;
        let channel_downsampler = Conv1dW::load(store, "channel_downsampler", dim, tc, 1, 1, 0, 1)?;
        let channel_upsampler_t = Conv1dW::load(store, "channel_upsampler_t", tc, dim, 1, 1, 0, 1)?;
        let channel_downsampler_t = Conv1dW::load(store, "channel_downsampler_t", dim, tc, 1, 1, 0, 1)?;
        let crosstransformer = CrossTransformerEncoder::load(
            store,
            "crosstransformer",
            dim,
            a.t_heads as i32,
            (a.t_hidden_scale * dim as f32) as i32,
            a.t_layers,
            a.t_max_period,
            a.t_weight_pos_embed,
        )?;

        Ok(Self {
            audio_channels: config.audio_channels,
            num_sources: config.num_sources(),
            training_length: config.training_length(),
            depth,
            bottom_channels: a.bottom_channels,
            encoder,
            tencoder,
            decoder,
            tdecoder,
            freq_emb,
            channel_upsampler,
            channel_downsampler,
            channel_upsampler_t,
            channel_downsampler_t,
            crosstransformer,
            spectrogram: Spectrogram::new(a.nfft, config.hop_length())?,
        })
    }

    /// `mix`: `audio_channels` channels of equal-length samples (no longer than `training_length`);
    /// returns the channels of the `source`-th stem, with the same length as the input.
    pub fn forward(&self, mix: &[Vec<f32>], source: usize) -> Result<Vec<Vec<f32>>> {
        let c = self.audio_channels;
        if mix.len() != c {
            bail!("input channel count {} does not match model {}", mix.len(), c);
        }
        if source >= self.num_sources {
            bail!("source index {source} is out of range for {} sources", self.num_sources);
        }
        let length = mix[0].len();
        if length == 0 {
            bail!("input is empty");
        }
        if length > self.training_length {
            bail!("single-window input length {length} exceeds training_length {}", self.training_length);
        }
        if mix.iter().any(|ch| ch.len() != length) {
            bail!("channels have different lengths");
        }
        let tl = self.training_length;
        // Zero-pad on the right up to training_length (Swift: lengthPrePad).
        let padded: Vec<Vec<f32>> = mix
            .iter()
            .map(|ch| {
                let mut v = ch.clone();
                v.resize(tl, 0.0);
                v
            })
            .collect();

        // z = spec(mix) → CaC: [1, 2C, Fq, le], channel 2c = real part, 2c+1 = imaginary part.
        let mut fq = 0usize;
        let mut le = 0usize;
        let mut cac = Vec::new();
        for ch in &padded {
            let z = self.spectrogram.spec(ch)?;
            fq = z.bins;
            le = z.frames;
            cac.reserve(2 * z.data.len());
            cac.extend(z.data.iter().map(|v| v.re));
            cac.extend(z.data.iter().map(|v| v.im));
        }
        let x0 = Array::from_slice(&cac, &[1, (2 * c) as i32, fq as i32, le as i32]);
        drop(cac);
        let mean = x0.mean_axes(&[1, 2, 3], true)?;
        let std = ops::sqrt(&x0.var_axes(&[1, 2, 3], true, 0)?)?;
        let mut x = x0.subtract(&mean)?.divide(&std.add(Array::from_f32(1e-5))?)?;

        let flat: Vec<f32> = padded.iter().flat_map(|ch| ch.iter().copied()).collect();
        let xt0 = Array::from_slice(&flat, &[1, c as i32, tl as i32]);
        drop(flat);
        let meant = xt0.mean_axes(&[1, 2], true)?;
        let stdt = ops::sqrt(&xt0.var_axes(&[1, 2], true, 0)?)?;
        let mut xt = xt0.subtract(&meant)?.divide(&stdt.add(Array::from_f32(1e-5))?)?;

        // Encoder
        let mut saved = Vec::with_capacity(self.depth);
        let mut saved_t = Vec::with_capacity(self.depth);
        let mut lengths = Vec::with_capacity(self.depth);
        let mut lengths_t = Vec::with_capacity(self.depth);
        for idx in 0..self.depth {
            lengths.push(x.dim(-1));
            lengths_t.push(xt.dim(-1));
            xt = self.tencoder[idx].forward(&xt)?;
            saved_t.push(xt.clone());
            x = self.encoder[idx].forward(&x)?;
            if idx == 0 {
                let fr = x.dim(2);
                let emb = if fr == self.freq_emb.dim(2) {
                    self.freq_emb.clone()
                } else {
                    self.freq_emb.index((.., .., 0..fr, ..))
                };
                x = x.add(&emb)?;
            }
            saved.push(x.clone());
            transforms::eval([&x, &xt])?;
        }

        // Cross-domain transformer (up/down-sampled by bottom_channels)
        {
            let (b, ch, f, t) = (x.dim(0), x.dim(1), x.dim(2), x.dim(3));
            let bc = self.bottom_channels as i32;
            let up = self
                .channel_upsampler
                .forward(&x.reshape(&[b, ch, f * t])?)?
                .reshape(&[b, bc, f, t])?;
            let up_t = self.channel_upsampler_t.forward(&xt)?;
            let (nx, nxt) = self.crosstransformer.forward(&up, &up_t)?;
            x = self
                .channel_downsampler
                .forward(&nx.reshape(&[b, bc, f * t])?)?
                .reshape(&[b, ch, f, t])?;
            xt = self.channel_downsampler_t.forward(&nxt)?;
            transforms::eval([&x, &xt])?;
        }

        // Decoder
        for idx in 0..self.depth {
            let skip = saved.pop().context("saved stack is empty")?;
            let len = lengths.pop().context("lengths stack is empty")?;
            let (nx, _pre) = self.decoder[idx].forward(&x, Some(&skip), len)?;
            x = nx;
            let skip_t = saved_t.pop().context("savedT stack is empty")?;
            let len_t = lengths_t.pop().context("lengthsT stack is empty")?;
            let (nxt, _) = self.tdecoder[idx].forward(&xt, Some(&skip_t), len_t)?;
            xt = nxt;
            transforms::eval([&x, &xt])?;
        }

        // Denormalize and take only the target stem (CaC: stem s's channel range is [s*2C, (s+1)*2C)).
        let s = source as i32;
        let c2 = (2 * c) as i32;
        let x_src = x.index((.., s * c2..(s + 1) * c2, .., ..)).multiply(&std)?.add(&mean)?;
        let xt_src = xt
            .index((.., s * (c as i32)..(s + 1) * (c as i32), ..))
            .multiply(&stdt)?
            .add(&meant)?;
        transforms::eval([&x_src, &xt_src])?;
        let x_host = x_src.as_slice::<f32>().to_vec();
        let xt_host = xt_src.as_slice::<f32>().to_vec();
        let out_fq = x_src.dim(2) as usize;
        let out_le = x_src.dim(3) as usize;
        if out_fq != fq || out_le != le {
            bail!("frequency-domain output shape [{out_fq}, {out_le}] does not match input [{fq}, {le}]");
        }
        let actual_len = xt_src.dim(2) as usize;
        if actual_len != tl {
            bail!("time-domain output length {actual_len} does not match training_length {tl}");
        }

        let plane = fq * le;
        let mut stems = Vec::with_capacity(c);
        for ch in 0..c {
            let re = &x_host[(2 * ch) * plane..(2 * ch + 1) * plane];
            let im = &x_host[(2 * ch + 1) * plane..(2 * ch + 2) * plane];
            let spectrum = Spectrum {
                bins: fq,
                frames: le,
                data: re.iter().zip(im).map(|(r, i)| Complex32::new(*r, *i)).collect(),
            };
            let mut wav = self.spectrogram.ispec(&spectrum, tl)?;
            let time = &xt_host[ch * actual_len..(ch + 1) * actual_len];
            for (o, t) in wav.iter_mut().zip(time) {
                *o += t;
            }
            wav.truncate(length);
            stems.push(wav);
        }
        Ok(stems)
    }
}

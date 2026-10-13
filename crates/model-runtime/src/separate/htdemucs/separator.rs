//! Parts are rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/SourceSeparation/HTDemucs/HTDemucsSeparator.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementation in Rust and adapted it to this project's tensor backend and model-bundle interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! The HTDemucs-FT separator: bag loading, window splitting, per-stem inference (cross-referenced with speech-swift `HTDemucsSeparator.swift`).
//! As with the model graph, it is compiled twice against the module's `tensor` (MLX and candle, see [`super`]).

use super::model::HtDemucsModel;
use super::tensor::{MemoryCacheGuard, configure_memory_cache, ensure_device, load_safetensors_deferred};
use super::weights::WeightStore;
use crate::bundle::VerifiedFiles;
use crate::separate::config::HtDemucsConfig;
use crate::separate::resample::resample;
use crate::separate::segment::{OverlapAdd, plan_windows};
use crate::separate::types::{SeparatedStems, SeparationProgress, StereoAudio};
use crate::separate::{ProgressSink, Separator};
use anyhow::{Context, Result, bail};

/// Weight prefix of each sub-model in the bag.
fn model_prefix(index: usize) -> String {
    format!("model_{index}.")
}

/// Window overlap ratio (the default for demucs `apply_model`, 0.25).
const OVERLAP: f32 = 0.25;

pub struct HtDemucs {
    config: HtDemucsConfig,
    models: Vec<HtDemucsModel>,
}

impl HtDemucs {
    /// Loads from the model bundle's `separator` component: `htdemucs_ft_config.json` + `htdemucs_ft.safetensors`.
    /// All four sub-models are loaded once and kept resident (about 670 MB in f32, twice the size of the fp16 file), so per-window inference does not need to read from disk.
    pub fn load(files: &VerifiedFiles) -> Result<Self> {
        ensure_device()?;
        let config = HtDemucsConfig::load(files.require("htdemucs_ft_config.json")?)?;
        if config.audio_channels != 2 {
            bail!("只支持双声道模型，配置 audio_channels = {}", config.audio_channels);
        }
        let weights_path = files.require("htdemucs_ft.safetensors")?;
        configure_memory_cache()?;
        let mut all = load_safetensors_deferred(&[weights_path], |_| true).context("无法加载 HTDemucs 权重")?;
        let mut models = Vec::with_capacity(config.num_models);
        for index in 0..config.num_models {
            let mut store = WeightStore::split(&mut all, &model_prefix(index));
            if store.is_empty() {
                bail!("权重文件里没有 {} 前缀的键", model_prefix(index));
            }
            let model = HtDemucsModel::new(&config, &mut store).with_context(|| format!("构建子模型 {index}"))?;
            store.finish()?;
            models.push(model);
        }
        if !all.is_empty() {
            let mut keys: Vec<&String> = all.keys().collect();
            keys.sort();
            bail!(
                "权重文件含 {} 个不属于任何子模型的键，例如 {:?}",
                all.len(),
                keys.iter().take(4).collect::<Vec<_>>()
            );
        }
        Ok(Self { config, models })
    }

    pub fn config(&self) -> &HtDemucsConfig {
        &self.config
    }
}

impl Separator for HtDemucs {
    fn sample_rate(&self) -> u32 {
        self.config.samplerate
    }

    fn separate(&mut self, mix: &StereoAudio, progress: ProgressSink<'_>) -> Result<SeparatedStems> {
        let _guard = MemoryCacheGuard::new();
        if mix.left.len() != mix.right.len() {
            bail!("左右声道长度不一致");
        }
        let target_rate = self.config.samplerate;
        let (left, right) = if mix.sample_rate == target_rate {
            (mix.left.clone(), mix.right.clone())
        } else {
            if !progress(SeparationProgress::Loading {
                stage: format!("重采样 {} → {} Hz", mix.sample_rate, target_rate),
            }) {
                bail!("已取消");
            }
            (
                resample(&mix.left, mix.sample_rate, target_rate),
                resample(&mix.right, mix.sample_rate, target_rate),
            )
        };
        let length = left.len();
        let empty = || StereoAudio {
            left: Vec::new(),
            right: Vec::new(),
            sample_rate: target_rate,
        };
        if length == 0 {
            return Ok(SeparatedStems {
                drums: empty(),
                bass: empty(),
                other: empty(),
                vocals: empty(),
            });
        }

        let segment_len = self.config.training_length();
        let windows = plan_windows(length, segment_len, OVERLAP);
        let sources = self.config.num_sources();
        if self.models.len() != sources {
            bail!("子模型数 {} 与声部数 {} 不符", self.models.len(), sources);
        }
        let total = windows.len() * sources;
        let mut done = 0;
        if !progress(SeparationProgress::Window { done, total }) {
            bail!("已取消");
        }

        let channels = [left, right];
        let mut outputs: Vec<Option<StereoAudio>> = (0..sources).map(|_| None).collect();
        // Matches the reference implementation: sub-model s keeps only stem s.
        for (s, model) in self.models.iter().enumerate() {
            let mut acc = OverlapAdd::new(2, length, segment_len);
            for window in &windows {
                let chunk: Vec<Vec<f32>> = channels
                    .iter()
                    .map(|ch| ch[window.offset..window.offset + window.len].to_vec())
                    .collect();
                let stem = model.forward(&chunk, s)?;
                acc.add(*window, &stem)?;
                done += 1;
                if !progress(SeparationProgress::Window { done, total }) {
                    bail!("已取消");
                }
            }
            let mut out = acc.finish();
            let right = out.pop().context("输出缺少右声道")?;
            let left = out.pop().context("输出缺少左声道")?;
            outputs[s] = Some(StereoAudio {
                left,
                right,
                sample_rate: target_rate,
            });
        }

        let mut take = |name: &str| -> Result<StereoAudio> {
            let index = self
                .config
                .sources
                .iter()
                .position(|n| n == name)
                .with_context(|| format!("配置 sources 里没有 {name}"))?;
            outputs[index].take().with_context(|| format!("声部 {name} 没有输出"))
        };
        Ok(SeparatedStems {
            drums: take("drums")?,
            bass: take("bass")?,
            other: take("other")?,
            vocals: take("vocals")?,
        })
    }
}

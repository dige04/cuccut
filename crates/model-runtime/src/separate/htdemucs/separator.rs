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
            bail!("only stereo models are supported; config audio_channels = {}", config.audio_channels);
        }
        let weights_path = files.require("htdemucs_ft.safetensors")?;
        configure_memory_cache()?;
        let mut all = load_safetensors_deferred(&[weights_path], |_| true).context("cannot load HTDemucs weights")?;
        let mut models = Vec::with_capacity(config.num_models);
        for index in 0..config.num_models {
            let mut store = WeightStore::split(&mut all, &model_prefix(index));
            if store.is_empty() {
                bail!("no keys with prefix {} in the weight file", model_prefix(index));
            }
            let model = HtDemucsModel::new(&config, &mut store).with_context(|| format!("build sub-model {index}"))?;
            store.finish()?;
            models.push(model);
        }
        if !all.is_empty() {
            let mut keys: Vec<&String> = all.keys().collect();
            keys.sort();
            bail!(
                "weight file has {} keys that belong to no sub-model, for example {:?}",
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
            bail!("left and right channels have different lengths");
        }
        let target_rate = self.config.samplerate;
        let (left, right) = if mix.sample_rate == target_rate {
            (mix.left.clone(), mix.right.clone())
        } else {
            if !progress(SeparationProgress::Loading {
                stage: format!("resample {} → {} Hz", mix.sample_rate, target_rate),
            }) {
                bail!("cancelled");
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
            bail!("sub-model count {} does not match source count {}", self.models.len(), sources);
        }
        let total = windows.len() * sources;
        let mut done = 0;
        if !progress(SeparationProgress::Window { done, total }) {
            bail!("cancelled");
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
                    bail!("cancelled");
                }
            }
            let mut out = acc.finish();
            let right = out.pop().context("output is missing the right channel")?;
            let left = out.pop().context("output is missing the left channel")?;
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
                .with_context(|| format!("config sources has no {name}"))?;
            outputs[index].take().with_context(|| format!("stem {name} has no output"))
        };
        Ok(SeparatedStems {
            drums: take("drums")?,
            bass: take("bass")?,
            other: take("other")?,
            vocals: take("vocals")?,
        })
    }
}

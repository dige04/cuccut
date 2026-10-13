//! Peak ceiling for synthesis results: every engine's output passes through [`PeakLimited`] (the outermost wrapper applied by [`crate::synthesize::load`]); if the peak of the whole clip is above [`PEAK_CEILING`] (−1 dBFS), the whole clip is scaled down proportionally to that ceiling. It only scales down: quiet output is returned unchanged; no compression is applied.
//!
//! Qwen3-TTS Base's codec decoder often outputs peaks above full scale (v2 hard-clipped to [-1, 1] at the end of the decoder, flattening about 3% of the samples), so the decoder no longer clips; instead, the whole clip is scaled down here based on the peak before clipping. The chunks of chunked synthesis use the same gain, so the volume does not jump between chunks.

use anyhow::Result;

use super::readings::{Annotated, Rendered};
use super::types::{TtsAudio, TtsEngineKind, TtsRequest};
use super::{ProgressSink, TtsEngine};

/// −1 dBFS (full scale is 1): `10^(−1/20)`.
pub const PEAK_CEILING: f32 = 0.891_250_9;

/// Sets non-finite samples to zero; if the peak is above [`PEAK_CEILING`], scales the whole clip proportionally down to it. Returns the gain applied (`None` if not scaled).
pub fn limit_peak(samples: &mut [f32]) -> Option<f32> {
    for sample in samples.iter_mut() {
        if !sample.is_finite() {
            *sample = 0.0;
        }
    }
    let peak = samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()));
    if peak <= PEAK_CEILING {
        return None;
    }
    let gain = PEAK_CEILING / peak;
    for sample in samples.iter_mut() {
        *sample = (*sample * gain).clamp(-PEAK_CEILING, PEAK_CEILING);
    }
    Some(gain)
}

/// Outermost wrapper returned by [`crate::synthesize::load`]: passes the synthesis result through [`limit_peak`].
pub struct PeakLimited {
    inner: Box<dyn TtsEngine>,
}

impl PeakLimited {
    pub fn new(inner: Box<dyn TtsEngine>) -> Self {
        Self { inner }
    }
}

impl TtsEngine for PeakLimited {
    fn kind(&self) -> TtsEngineKind {
        self.inner.kind()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn preset_speakers(&self) -> Vec<String> {
        self.inner.preset_speakers()
    }

    fn render_readings(&self, annotated: &Annotated) -> Rendered {
        self.inner.render_readings(annotated)
    }

    fn synthesize(&mut self, request: &TtsRequest, progress: ProgressSink<'_>) -> Result<TtsAudio> {
        let mut audio = self.inner.synthesize(request, progress)?;
        if let Some(gain) = limit_peak(&mut audio.samples) {
            eprintln!(
                "[{}] peak exceeds −1 dBFS, scaling the whole segment by {gain:.3} ({:.2} dB)",
                self.inner.kind().as_str(),
                20.0 * gain.log10()
            );
        }
        Ok(audio)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn peak(samples: &[f32]) -> f32 {
        samples.iter().fold(0.0_f32, |max, s| max.max(s.abs()))
    }

    #[test]
    fn hot_audio_is_scaled_down_to_the_ceiling() {
        let mut samples: Vec<f32> = (0..1000).map(|i| (i as f32 / 10.0).sin() * 1.4).collect();
        let original = samples.clone();
        let gain = limit_peak(&mut samples).expect("should have been reduced");
        assert!((peak(&samples) - PEAK_CEILING).abs() < 1e-6, "peak {}", peak(&samples));
        assert!((gain - PEAK_CEILING / peak(&original)).abs() < 1e-6);
        // Proportional scale-down: the waveform shape is unchanged, and nothing is clipped.
        for (out, before) in samples.iter().zip(&original) {
            assert!((out - before * gain).abs() < 1e-6);
        }
    }

    #[test]
    fn quiet_audio_is_untouched() {
        let mut samples: Vec<f32> = (0..1000).map(|i| (i as f32 / 10.0).sin() * 0.3).collect();
        let original = samples.clone();
        assert_eq!(limit_peak(&mut samples), None);
        assert_eq!(samples, original);
        // Exactly at the ceiling: left unchanged.
        let mut edge = vec![0.1, -PEAK_CEILING, 0.2];
        assert_eq!(limit_peak(&mut edge), None);
        assert_eq!(edge, vec![0.1, -PEAK_CEILING, 0.2]);
        assert_eq!(limit_peak(&mut []), None);
    }

    #[test]
    fn non_finite_samples_are_zeroed_without_silencing_the_rest() {
        let mut samples = vec![0.5, f32::NAN, -0.25, f32::INFINITY, f32::NEG_INFINITY, 0.75];
        assert_eq!(limit_peak(&mut samples), None);
        assert_eq!(samples, vec![0.5, 0.0, -0.25, 0.0, 0.0, 0.75]);

        let mut hot = vec![1.2, f32::INFINITY, -0.6, f32::NAN];
        let gain = limit_peak(&mut hot).expect("should have been reduced");
        assert!((gain - PEAK_CEILING / 1.2).abs() < 1e-6);
        assert!((hot[0] - PEAK_CEILING).abs() < 1e-6);
        assert_eq!(hot[1], 0.0);
        assert!((hot[2] + 0.6 * gain).abs() < 1e-6);
        assert_eq!(hot[3], 0.0);
    }

    struct Hot;

    impl TtsEngine for Hot {
        fn kind(&self) -> TtsEngineKind {
            TtsEngineKind::Qwen3Tts
        }

        fn sample_rate(&self) -> u32 {
            24_000
        }

        fn synthesize(&mut self, _request: &TtsRequest, _progress: ProgressSink<'_>) -> Result<TtsAudio> {
            Ok(TtsAudio {
                samples: vec![0.2, -2.0, 1.0],
                sample_rate: 24_000,
                readings_dropped: Vec::new(),
            })
        }
    }

    #[test]
    fn the_wrapper_limits_what_the_engine_returns() {
        let mut engine = PeakLimited::new(Box::new(Hot));
        let audio = engine
            .synthesize(&TtsRequest::new("hi", super::super::VoiceSpec::Default), &mut |_| true)
            .unwrap();
        assert!((peak(&audio.samples) - PEAK_CEILING).abs() < 1e-6);
        assert!((audio.samples[0] - 0.1 * PEAK_CEILING).abs() < 1e-6);
    }
}

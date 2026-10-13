//! Separation input / output types.

/// Stereo PCM: `left` / `right` of equal length, range [-1, 1].
#[derive(Debug, Clone, PartialEq)]
pub struct StereoAudio {
    pub left: Vec<f32>,
    pub right: Vec<f32>,
    pub sample_rate: u32,
}

impl StereoAudio {
    pub fn from_mono(samples: Vec<f32>, sample_rate: u32) -> Self {
        Self {
            left: samples.clone(),
            right: samples,
            sample_rate,
        }
    }

    pub fn len(&self) -> usize {
        self.left.len()
    }

    pub fn is_empty(&self) -> bool {
        self.left.is_empty()
    }

    pub fn duration_seconds(&self) -> f64 {
        self.len() as f64 / f64::from(self.sample_rate)
    }

    /// Averages the left and right channels into mono.
    pub fn to_mono(&self) -> Vec<f32> {
        self.left.iter().zip(&self.right).map(|(l, r)| (l + r) * 0.5).collect()
    }

    /// Adds sample by sample (length is truncated to the shorter one).
    pub fn add(&self, other: &StereoAudio) -> StereoAudio {
        let n = self.len().min(other.len());
        StereoAudio {
            left: (0..n).map(|i| self.left[i] + other.left[i]).collect(),
            right: (0..n).map(|i| self.right[i] + other.right[i]).collect(),
            sample_rate: self.sample_rate,
        }
    }
}

/// The four stems of HTDemucs.
#[derive(Debug, Clone, PartialEq)]
pub struct SeparatedStems {
    pub drums: StereoAudio,
    pub bass: StereoAudio,
    pub other: StereoAudio,
    pub vocals: StereoAudio,
}

impl SeparatedStems {
    /// Background = drums + bass + other (the part kept during dubbing).
    pub fn background(&self) -> StereoAudio {
        self.drums.add(&self.bass).add(&self.other)
    }
}

/// Separation progress: advances window by window, each window 7.8 seconds long.
#[derive(Debug, Clone, PartialEq)]
pub enum SeparationProgress {
    Loading {
        stage: String,
    },
    /// Completed windows / total windows (each sub-model is counted separately).
    Window {
        done: usize,
        total: usize,
    },
}

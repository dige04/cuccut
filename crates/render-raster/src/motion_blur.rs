//! Motion blur (`ccut render --motion-blur N`, spec §15.2): one frame = the average of N equally spaced sub-frames.
//!
//! **Shutter convention**: 180° shutter, opened **backward**. The sub-frames of frame `t` fall at `t + k / N × SHUTTER / fps` (`k = 0..N-1`), all within this frame's time slice `[t, t + 1/fps)`. The first sub-frame is exactly the instant used when motion blur is off, so a cut point does not smear the next shot in “early”, nor drag the previous shot into this frame.
//!
//! **Averaging**: per-channel u32 accumulation of premultiplied RGBA8, then rounded integer division (`(Σ + N/2) / N`). When all sub-frames are identical (a static segment), the result is byte-identical to a single frame.
//!
//! **Fingerprint**: when `N = 1`, nothing is done, and the frame fingerprint is identical to what it was without this parameter. When `N ≥ 2`, the composite fingerprint = FNV-1a 64 (version tag, N, each sub-frame's fingerprint). Whether the moment is static or not, it differs from N=1, so the render manifest / frame cache never mixes the two conventions.
//!
//! **Cost**: rasterization runs N times per frame (when the sub-frame fingerprints are all identical in a static segment, it is drawn only once), so render time is about N times larger.
use crate::drawop::fnv1a64;
use anyhow::{Result, bail};

/// Upper limit on sub-frame count: 16 already means 16× the render time, and beyond that no visible marginal benefit is gained.
pub const MAX_SAMPLES: u32 = 16;
/// Fraction of a frame's duration that the shutter is open (180° shutter).
pub const SHUTTER: f64 = 0.5;

/// `1..=16`; out-of-range values raise an error (the caller surfaces it as `invalid_arg`).
pub fn validate(samples: u32) -> Result<()> {
    if !(1..=MAX_SAMPLES).contains(&samples) {
        bail!("--motion-blur 须在 1..={MAX_SAMPLES}（1 = 关闭），实得 {samples}");
    }
    Ok(())
}

/// The N sub-frame times of frame `t` (the first is always `t`).
pub fn subframe_times(t: f64, fps: f64, samples: u32) -> Vec<f64> {
    let n = samples.max(1);
    (0..n)
        .map(|k| t + f64::from(k) / f64::from(n) * SHUTTER / fps)
        .collect()
}

/// Composite frame fingerprint for N ≥ 2.
pub fn composite_fingerprint(samples: u32, subframes: &[u64]) -> u64 {
    let mut bytes = Vec::with_capacity(24 + subframes.len() * 8);
    bytes.extend_from_slice(b"ccut-motion-blur/v1");
    bytes.extend_from_slice(&samples.to_le_bytes());
    for fp in subframes {
        bytes.extend_from_slice(&fp.to_le_bytes());
    }
    fnv1a64(&bytes)
}

/// Per-channel accumulator for premultiplied RGBA8 sub-frames.
pub struct Accumulator {
    sum: Vec<u32>,
    count: u32,
}

impl Accumulator {
    pub fn new(len: usize) -> Self {
        Accumulator {
            sum: vec![0; len],
            count: 0,
        }
    }

    /// The same sub-frame can be added with a weight (reuse in static segments: draw once, count `weight` times).
    pub fn add(&mut self, data: &[u8], weight: u32) {
        debug_assert_eq!(data.len(), self.sum.len());
        for (acc, &v) in self.sum.iter_mut().zip(data) {
            *acc += u32::from(v) * weight;
        }
        self.count += weight;
    }

    pub fn finish(self) -> Vec<u8> {
        let n = self.count.max(1);
        self.sum
            .into_iter()
            .map(|s| ((s + n / 2) / n) as u8)
            .collect()
    }
}

/// Single-frame entry point: each of the N sub-frames goes through its own FramePlan (the effect stack applies as usual), and after averaging it returns `(pixels, frame fingerprint)`. When `samples = 1`, it is byte-identical to `planner.render` + `plan.frame_fingerprint()`.
#[cfg(feature = "media")]
pub fn render_frame(
    planner: &crate::plan::FramePlanner,
    renderer: &crate::renderer::FrameRenderer,
    ir: &scene_primitives::resolve::Ir,
    engine: &mut crate::fonts::TextEngine,
    media: &mut crate::media::MediaStore,
    t: f64,
    samples: u32,
) -> Result<(tiny_skia::Pixmap, u64)> {
    use crate::plan::{CpuExecutor, execute_plan};
    validate(samples)?;
    let mut executor = CpuExecutor::new(planner.capabilities().clone());
    if samples == 1 {
        let plan = planner.plan(renderer, ir, engine, t);
        let fp = plan.frame_fingerprint()?;
        return Ok((execute_plan(&plan, &mut executor, media, None)?, fp));
    }
    let mut fps = Vec::with_capacity(samples as usize);
    let mut acc = Accumulator::new((renderer.width * renderer.height * 4) as usize);
    // If adjacent sub-frame fingerprints are the same, draw once and weight by the count (static segments do not pay N times).
    let mut pending: Option<(u64, tiny_skia::Pixmap, u32)> = None;
    for sub in subframe_times(t, ir.fps, samples) {
        let plan = planner.plan(renderer, ir, engine, sub);
        let fp = plan.frame_fingerprint()?;
        fps.push(fp);
        if let Some((last, _, weight)) = pending.as_mut()
            && *last == fp
        {
            *weight += 1;
            continue;
        }
        if let Some((_, pixmap, weight)) = pending.take() {
            acc.add(pixmap.data(), weight);
        }
        pending = Some((fp, execute_plan(&plan, &mut executor, media, None)?, 1));
    }
    if let Some((_, pixmap, weight)) = pending.take() {
        acc.add(pixmap.data(), weight);
    }
    let size = tiny_skia::IntSize::from_wh(renderer.width, renderer.height)
        .ok_or_else(|| anyhow::anyhow!("帧尺寸为 0"))?;
    let pixmap = tiny_skia::Pixmap::from_vec(acc.finish(), size)
        .ok_or_else(|| anyhow::anyhow!("运动模糊累加尺寸不符"))?;
    Ok((pixmap, composite_fingerprint(samples, &fps)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subframes_open_at_the_frame_time_and_stay_inside_the_frame() {
        let times = subframe_times(1.0, 25.0, 4);
        assert_eq!(times[0], 1.0);
        assert_eq!(times.len(), 4);
        assert!(times.iter().all(|t| *t < 1.0 + 0.5 / 25.0));
        assert!(times.windows(2).all(|w| w[1] > w[0]));
        assert_eq!(subframe_times(2.0, 30.0, 1), vec![2.0]);
    }

    #[test]
    fn averaging_rounds_and_identical_subframes_are_exact() {
        let mut acc = Accumulator::new(4);
        acc.add(&[10, 11, 255, 0], 1);
        acc.add(&[11, 11, 255, 1], 1);
        assert_eq!(acc.finish(), vec![11, 11, 255, 1]);
        let mut same = Accumulator::new(3);
        same.add(&[7, 200, 3], 5);
        assert_eq!(same.finish(), vec![7, 200, 3]);
    }

    #[test]
    fn sample_count_is_part_of_the_fingerprint_and_bounded() {
        assert_ne!(
            composite_fingerprint(2, &[1, 1]),
            composite_fingerprint(3, &[1, 1, 1])
        );
        assert_ne!(
            composite_fingerprint(2, &[1, 2]),
            composite_fingerprint(2, &[2, 1])
        );
        assert!(validate(0).is_err() && validate(17).is_err());
        assert!(validate(1).is_ok() && validate(16).is_ok());
    }
}

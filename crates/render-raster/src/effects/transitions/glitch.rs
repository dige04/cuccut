//! `transition.glitch@1`: digital glitch cut. The picture is split into strips, each shifted out of alignment. The RGB channels separate, and occasionally the whole frame flashes white. The outgoing and incoming pictures jump back and forth between the strips, and the transition finally settles on the incoming picture.
//!
//! All random values are drawn at the **step** of progress, `b = ⌊p·steps⌋` (`splitmix64(seed, step×…)`). Within one step the picture does not change, and every value is re-rolled across steps. This is the "stutter" rhythm of the glitch, and it is a pure function of progress, so it can be seeked. The intensity `I = 1 − |2p − 1|` is largest in the middle of the transition and drops to zero at both ends. The share of strips that switch to the incoming picture is `q = clamp((p − 0.25) / 0.5)`, and each strip rolls its own dice.
//!
//! `direction = "vertical"` (the default) cuts the picture into **vertical strips**, each shifted up or down, and RGB separates along the vertical direction. `"horizontal"` cuts into horizontal strips shifted left or right. Offset sampling is clamped at the canvas edges, so the parts that move out leave a streak of edge pixels.
//!
//! All offsets are rounded to integers and then copied to the nearest pixel. There are no transcendental functions. `progress = 0` / `1` copy `from` / `to` directly.

use motion::rng::splitmix64_unit;

#[derive(Debug, Clone, Copy)]
pub struct Glitch {
    /// true = vertical strips shifted up and down; false = horizontal strips shifted left and right.
    pub vertical: bool,
    /// Number of strips (rounded to an integer, 2..=400).
    pub slices: f64,
    /// Maximum strip offset (pixels, already converted from the canvas short side).
    pub amount: f64,
    /// RGB separation distance (pixels, already converted).
    pub rgb: f64,
    /// Number of re-roll steps across progress (rounded to an integer, 2..=120).
    pub steps: f64,
    /// Flash-white probability and brightness, `0..1`.
    pub flicker: f64,
    pub seed: u64,
}

pub fn glitch(
    from: &[u8],
    to: &[u8],
    out: &mut [u8],
    width: u32,
    height: u32,
    params: &Glitch,
    progress: f64,
) {
    if progress <= 0.0 || width == 0 || height == 0 {
        out.copy_from_slice(from);
        return;
    }
    if progress >= 1.0 {
        out.copy_from_slice(to);
        return;
    }
    let steps = params.steps.round().clamp(2.0, 120.0);
    let bucket = ((progress * steps).floor()).min(steps - 1.0) as i64;
    let intensity = 1.0 - (2.0 * progress - 1.0).abs();
    let to_share = ((progress - 0.25) / 0.5).clamp(0.0, 1.0);
    let random = |slot: i64| splitmix64_unit(params.seed, bucket * 1_048_576 + slot);

    // The cutting axis: vertical strips spread along x and shift along y. Horizontal strips are the reverse.
    let (across, along) = if params.vertical {
        (width as usize, height as usize)
    } else {
        (height as usize, width as usize)
    };
    let slice_count = params.slices.round().clamp(2.0, 400.0) as usize;
    // Strip widths for this step: each strip gets a random weight of 0.3..1.3, scaled to fill the whole axis.
    let weights: Vec<f64> = (0..slice_count)
        .map(|k| 0.3 + random(k as i64 * 8))
        .collect();
    let total: f64 = weights.iter().sum();
    struct Band {
        shift: isize,
        to: bool,
    }
    let bands: Vec<Band> = (0..slice_count)
        .map(|k| {
            let slot = k as i64 * 8;
            let active = random(slot + 1) < 0.2 + 0.7 * intensity;
            let tear = if random(slot + 2) > 0.85 { 2.5 } else { 1.0 };
            let shift = if active {
                ((2.0 * random(slot + 3) - 1.0) * params.amount * intensity * tear).round() as isize
            } else {
                0
            };
            Band {
                shift,
                to: random(slot + 4) < to_share,
            }
        })
        .collect();
    // Which strip each coordinate along the cutting axis belongs to.
    let mut band_of = Vec::with_capacity(across);
    let mut band = 0usize;
    let mut next = weights[0] / total * across as f64;
    for position in 0..across {
        let center = position as f64 + 0.5;
        while center >= next && band + 1 < slice_count {
            band += 1;
            next += weights[band] / total * across as f64;
        }
        band_of.push(band);
    }
    let split = (params.rgb * intensity * (0.5 + random(-1))).round() as isize;
    let flash = if random(-2) < params.flicker.clamp(0.0, 1.0) * intensity {
        0.35 * intensity * params.flicker.clamp(0.0, 1.0)
    } else {
        0.0
    };

    let w = width as usize;
    let fetch = |a: usize, b: isize| -> usize {
        let b = b.clamp(0, along as isize - 1) as usize;
        let (x, y) = if params.vertical { (a, b) } else { (b, a) };
        (y * w + x) * 4
    };
    for y in 0..height as usize {
        for x in 0..w {
            let (a, b) = if params.vertical { (x, y) } else { (y, x) };
            let band = &bands[band_of[a]];
            let source = if band.to { to } else { from };
            let base = b as isize - band.shift;
            let red = fetch(a, base + split);
            let green = fetch(a, base);
            let blue = fetch(a, base - split);
            let alpha = source[red + 3].max(source[green + 3]).max(source[blue + 3]);
            let mut pixel = [source[red], source[green + 1], source[blue + 2], alpha];
            if flash > 0.0 {
                for channel in 0..3 {
                    let c = f64::from(pixel[channel]);
                    pixel[channel] = (c + (f64::from(alpha) - c) * flash).round() as u8;
                }
            }
            let offset = (y * w + x) * 4;
            out[offset..offset + 4].copy_from_slice(&pixel);
        }
    }
}

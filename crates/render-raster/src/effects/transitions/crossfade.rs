//! `transition.crossfade@1`: the two pictures are linearly blended by progress.

use super::{coverage_to_alpha, lerp_premul_u8};

pub fn crossfade(from: &[u8], to: &[u8], out: &mut [u8], progress: f64) {
    let a = coverage_to_alpha(progress);
    // The endpoints copy the whole buffer. `lerp_premul_u8` is already an identity at a = 0 / 255. This shortcut only makes "byte-for-byte equal to the input" explicit, and it also saves a per-channel arithmetic pass.
    if a == 0 {
        out.copy_from_slice(from);
        return;
    }
    if a == 255 {
        out.copy_from_slice(to);
        return;
    }
    for index in 0..out.len() {
        out[index] = lerp_premul_u8(from[index], to[index], a);
    }
}

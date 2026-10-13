//! Three-axis RoPE (frame / height / width) for the DiT, replicating the text-to-image case of `QwenImage21Rope`:
//! text tokens use the same increasing position on all three axes; the frame axis of the target image patches is frozen after the text;
//! height / width form a grid centered on 0 (negative indices are real negative positions, not wrap-around).
//!
//! The rotation is complex multiplication over adjacent pairs of dimensions (diffusers `use_real=False`), not rotate-half.

/// Dimensions of each axis (real dims). In the config this is `[16, 56, 56]`, summing to head_dim 128.
pub const AXES_DIM: [usize; 3] = [16, 56, 56];
const THETA: f64 = 10000.0;

/// Returns `(cos, sin)`, both of shape `[seq_len, head_dim/2]`, flattened in row-major order.
/// Sequence layout: `text_len` text tokens, followed by `h * w` image tokens in row-major order.
pub fn dit_rope_tables(text_len: usize, h: usize, w: usize) -> (Vec<f32>, Vec<f32>) {
    let half: usize = AXES_DIM.iter().sum::<usize>() / 2;
    let n = text_len + h * w;
    let mut cos = Vec::with_capacity(n * half);
    let mut sin = Vec::with_capacity(n * half);
    let inv: Vec<Vec<f64>> = AXES_DIM
        .iter()
        .map(|&d| (0..d / 2).map(|i| 1.0 / THETA.powf((2 * i) as f64 / d as f64)).collect())
        .collect();
    let mut push = |pos: [i64; 3]| {
        for (axis, freqs) in inv.iter().enumerate() {
            for f in freqs {
                let a = pos[axis] as f64 * f;
                cos.push(a.cos() as f32);
                sin.push(a.sin() as f32);
            }
        }
    };
    for p in 0..text_len as i64 {
        push([p, p, p]);
    }
    let frame = text_len as i64;
    let h0 = -((h - h / 2) as i64);
    let w0 = -((w - w / 2) as i64);
    for y in 0..h as i64 {
        for x in 0..w as i64 {
            push([frame, h0 + y, w0 + x]);
        }
    }
    (cos, sin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_is_centered() {
        let (c, s) = dit_rope_tables(3, 4, 2);
        assert_eq!(c.len(), (3 + 8) * 64);
        // Text token 0 at position 0: cos=1, sin=0
        assert!(c[..64].iter().all(|v| (*v - 1.0).abs() < 1e-6));
        assert!(s[..64].iter().all(|v| v.abs() < 1e-6));
        // First image token: height = -2, width = -1; the first frequency of the height axis is 1 => sin(-2)
        let row = 3 * 64;
        assert!((s[row + 8] - (-2.0f32).sin()).abs() < 1e-6);
        assert!((s[row + 8 + 28] - (-1.0f32).sin()).abs() < 1e-6);
        // frame axis frozen at text_len
        assert!((s[row] - 3.0f32.sin()).abs() < 1e-6);
    }
}

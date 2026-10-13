//! `transition.shatter@1`: the outgoing picture shatters like glass. Fragments fly out from the point of impact, rotate, fall under gravity and fade out, revealing the incoming picture.
//!
//! **Only one offscreen pass**: the outgoing picture is the `from` input of the Transition pass. The recorder records each side only once. Here the picture is only sliced, and each piece is transformed affinely and composited back. The outgoing shot is not copied N times.
//!
//! The slicing is a jittered grid Voronoi in log-polar space. It is centered on the point of impact, with `U = ln(1 + r/r₀)` and `V = θ`. Each axis is normalized by the grid cell size. Each cell has one seed point, jittered by the seed. A pixel's cell is found by checking the 3×3 neighboring cells, and `V` wraps around from the last cell to the first. The logarithmic radius makes fragments near the point of impact small and fragments on the outer ring large. The cell edges appear as radial cracks plus concentric arcs, so at a glance it reads as glass being shattered.
//!
//! Each piece's motion depends only on `(seed, piece index)` and progress. It is seekable and has no incremental clock. The farther a piece is from the point of impact, the later it takes off, so the cracks spread outward first: `τ = clamp((p − delay) / (1 − delay))`. Displacement = direction × force × speed × τ(2 − τ) + (0, gravity × τ²). Rotation and the zoom toward the camera are both proportional to τ. After `τ ≥ 0.55` the piece fades out linearly, and at `τ = 1` it is fully transparent. Pieces that have not taken off yet stay in place. Along the boundaries between pieces, only a bright crack that fades in is drawn (`crack`).
//!
//! Determinism: the transcendental functions all go through `libm`, so native and wasm use the same implementation. The rest is f64 arithmetic. `progress = 0` and `1` copy `from` and `to` directly, so the endpoints are byte-for-byte exact.

use motion::rng::splitmix64_unit;

/// Zero point of the log radius: the fragments inside the small circle near the point of impact are the smallest.
const CORE_RADIUS: f64 = 0.04;
/// Jitter amplitude of the seed points inside a cell (as a fraction of the cell width).
const JITTER: f64 = 0.85;
/// The cracks fade in during this part of progress.
const CRACK_RAMP: f64 = 0.06;
/// Takeoff delay: the fragment farthest from the point of impact takes off this much later in progress than the nearest one.
const DELAY_SPREAD: f64 = 0.3;
const DELAY_JITTER: f64 = 0.06;
/// Fragments start fading out at τ = FADE_START.
const FADE_START: f64 = 0.55;

#[derive(Debug, Clone, Copy)]
pub struct Shatter {
    /// Target number of pieces (rounded to an integer, 4..=400). The actual count is close to this after the grid is rounded.
    pub pieces: f64,
    pub seed: u64,
    /// Point of impact, as a ratio of the canvas width and height.
    pub cx: f64,
    pub cy: f64,
    /// Flight distance (pixels, already converted from the canvas short side).
    pub force: f64,
    /// Maximum angle each piece turns over the whole transition (degrees).
    pub rotation: f64,
    /// Gravity fall distance (pixels, already converted. Negative values are upward).
    pub gravity: f64,
    /// Crack brightness, `0..1`. 0 = draw no cracks.
    pub crack: f64,
}

struct Grid {
    n_r: usize,
    n_theta: usize,
    su: f64,
    sv: f64,
    r0: f64,
    ox: f64,
    oy: f64,
    /// Seed points for `[ring][spoke]`, in cell units (the unwrapped `V`).
    seeds: Vec<(f64, f64)>,
}

impl Grid {
    fn new(width: u32, height: u32, params: &Shatter) -> Grid {
        let (w, h) = (f64::from(width), f64::from(height));
        let short = w.min(h).max(1.0);
        let (ox, oy) = (params.cx.clamp(0.0, 1.0) * w, params.cy.clamp(0.0, 1.0) * h);
        let r0 = (CORE_RADIUS * short).max(0.5);
        let mut r_max = 0.0f64;
        for (x, y) in [(0.0, 0.0), (w, 0.0), (0.0, h), (w, h)] {
            let (dx, dy) = (x - ox, y - oy);
            r_max = r_max.max((dx * dx + dy * dy).sqrt());
        }
        let u_max = libm::log(1.0 + r_max / r0).max(1e-6);
        let pieces = params.pieces.round().clamp(4.0, 400.0);
        // Grid cells: 2π·u_max / c² = pieces.
        let tau = std::f64::consts::TAU;
        let cell = (tau * u_max / pieces).sqrt();
        let n_theta = ((tau / cell).round() as usize).max(3);
        let n_r = ((u_max / cell).round() as usize).max(1);
        let su = u_max / n_r as f64;
        let sv = tau / n_theta as f64;
        let mut seeds = Vec::with_capacity(n_r * n_theta);
        for ring in 0..n_r {
            for spoke in 0..n_theta {
                let index = (ring * n_theta + spoke) as i64;
                let ju = splitmix64_unit(params.seed, index * 2);
                let jv = splitmix64_unit(params.seed, index * 2 + 1);
                seeds.push((
                    ring as f64 + 0.5 + JITTER * (ju - 0.5),
                    spoke as f64 + 0.5 + JITTER * (jv - 0.5),
                ));
            }
        }
        Grid {
            n_r,
            n_theta,
            su,
            sv,
            r0,
            ox,
            oy,
            seeds,
        }
    }

    fn label(&self, px: f64, py: f64) -> u16 {
        let (dx, dy) = (px - self.ox, py - self.oy);
        let r = (dx * dx + dy * dy).sqrt();
        let u = libm::log(1.0 + r / self.r0) / self.su;
        let v = (libm::atan2(dy, dx) + std::f64::consts::PI) / self.sv;
        let iu = (u.floor().max(0.0) as usize).min(self.n_r - 1) as isize;
        let iv = v.floor() as isize;
        let n_theta = self.n_theta as isize;
        let mut best = (f64::INFINITY, 0usize);
        for du in -1..=1isize {
            let ring = iu + du;
            if ring < 0 || ring >= self.n_r as isize {
                continue;
            }
            for dv in -1..=1isize {
                let spoke = iv + dv;
                let wrapped = spoke.rem_euclid(n_theta);
                let label = ring as usize * self.n_theta + wrapped as usize;
                let (seed_u, seed_v) = self.seeds[label];
                // Seed points expand `V` by unwrapped cell index, so the distances to neighbor cells across ±π are correct.
                let seed_v = seed_v + (spoke - wrapped) as f64;
                let (eu, ev) = (u - seed_u, v - seed_v);
                let distance = eu * eu + ev * ev;
                if distance < best.0 {
                    best = (distance, label);
                }
            }
        }
        best.1 as u16
    }
}

#[derive(Clone, Copy)]
struct Piece {
    label: usize,
    count: u64,
    sum_x: f64,
    sum_y: f64,
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
}

#[inline]
fn over(out: &mut [u8], offset: usize, src: [f64; 4]) {
    let keep = 1.0 - src[3] / 255.0;
    for channel in 0..4 {
        let value = src[channel] + f64::from(out[offset + channel]) * keep;
        out[offset + channel] = value.round().clamp(0.0, 255.0) as u8;
    }
    // Premultiplication invariant: RGB does not exceed alpha.
    let alpha = out[offset + 3];
    for channel in 0..3 {
        out[offset + channel] = out[offset + channel].min(alpha);
    }
}

/// Bilinear sampling (pixel-center coordinates, edge clamping). Premultiplied values are interpolated as they are.
#[inline]
fn bilinear(data: &[u8], width: u32, height: u32, x: f64, y: f64) -> [f64; 4] {
    let max_x = f64::from(width - 1);
    let max_y = f64::from(height - 1);
    let x = x.clamp(0.0, max_x);
    let y = y.clamp(0.0, max_y);
    let (fx, fy) = (x.floor(), y.floor());
    let (tx, ty) = (x - fx, y - fy);
    let (x0, y0) = (fx as u32, fy as u32);
    let (x1, y1) = ((x0 + 1).min(width - 1), (y0 + 1).min(height - 1));
    let at = |px: u32, py: u32| ((py * width + px) * 4) as usize;
    let (a, b, c, d) = (at(x0, y0), at(x1, y0), at(x0, y1), at(x1, y1));
    let mut out = [0.0; 4];
    for (channel, slot) in out.iter_mut().enumerate() {
        let top = f64::from(data[a + channel]) * (1.0 - tx) + f64::from(data[b + channel]) * tx;
        let bottom = f64::from(data[c + channel]) * (1.0 - tx) + f64::from(data[d + channel]) * tx;
        *slot = top * (1.0 - ty) + bottom * ty;
    }
    out
}

pub fn shatter(
    from: &[u8],
    to: &[u8],
    out: &mut [u8],
    width: u32,
    height: u32,
    params: &Shatter,
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
    let grid = Grid::new(width, height, params);
    let pixel_count = (width as usize) * (height as usize);
    let mut labels = vec![0u16; pixel_count];
    let mut pieces: Vec<Piece> = (0..grid.seeds.len())
        .map(|label| Piece {
            label,
            count: 0,
            sum_x: 0.0,
            sum_y: 0.0,
            x0: u32::MAX,
            y0: u32::MAX,
            x1: 0,
            y1: 0,
        })
        .collect();
    for y in 0..height {
        for x in 0..width {
            let label = grid.label(f64::from(x) + 0.5, f64::from(y) + 0.5);
            labels[(y * width + x) as usize] = label;
            let piece = &mut pieces[label as usize];
            piece.count += 1;
            piece.sum_x += f64::from(x) + 0.5;
            piece.sum_y += f64::from(y) + 0.5;
            piece.x0 = piece.x0.min(x);
            piece.y0 = piece.y0.min(y);
            piece.x1 = piece.x1.max(x);
            piece.y1 = piece.y1.max(y);
        }
    }

    // The base layer is the incoming picture. It shows through where the fragments fly away.
    out.copy_from_slice(to);

    let short = f64::from(width.min(height));
    let crack_width = ((short / 540.0).round() as u32).max(1);
    let crack_alpha = params.crack.clamp(0.0, 1.0) * (progress / CRACK_RAMP).min(1.0);
    let (w, h) = (f64::from(width), f64::from(height));
    let r_max = {
        let mut r = 0.0f64;
        for (x, y) in [(0.0, 0.0), (w, 0.0), (0.0, h), (w, h)] {
            let (dx, dy) = (x - grid.ox, y - grid.oy);
            r = r.max((dx * dx + dy * dy).sqrt());
        }
        r.max(1.0)
    };

    struct Flight {
        label: usize,
        depth: f64,
        cx: f64,
        cy: f64,
        dx: f64,
        dy: f64,
        cos: f64,
        sin: f64,
        scale: f64,
        alpha: f64,
        bbox: (u32, u32, u32, u32),
    }
    let mut flights = Vec::new();
    let physics_seed = params.seed ^ 0xa076_1d64_78bd_642f;
    for piece in pieces.iter().filter(|piece| piece.count > 0) {
        let label = piece.label;
        let random = |k: i64| splitmix64_unit(physics_seed, label as i64 * 8 + k);
        let (cx, cy) = (
            piece.sum_x / piece.count as f64,
            piece.sum_y / piece.count as f64,
        );
        let (ex, ey) = (cx - grid.ox, cy - grid.oy);
        let distance = (ex * ex + ey * ey).sqrt();
        let near = (distance / r_max).clamp(0.0, 1.0);
        let delay = DELAY_SPREAD * near + DELAY_JITTER * random(0);
        let tau = ((progress - delay) / (1.0 - delay)).clamp(0.0, 1.0);
        if tau <= 0.0 {
            // Not yet taken off: draw this piece in its original place, plus the cracks.
            for y in piece.y0..=piece.y1 {
                for x in piece.x0..=piece.x1 {
                    let index = (y * width + x) as usize;
                    if labels[index] as usize != label {
                        continue;
                    }
                    let offset = index * 4;
                    let src = [
                        f64::from(from[offset]),
                        f64::from(from[offset + 1]),
                        f64::from(from[offset + 2]),
                        f64::from(from[offset + 3]),
                    ];
                    over(out, offset, src);
                    if crack_alpha > 0.0 {
                        let right = x + crack_width < width
                            && labels[index + crack_width as usize] as usize != label;
                        let below = y + crack_width < height
                            && labels[index + (crack_width * width) as usize] as usize != label;
                        if right || below {
                            let k = crack_alpha * 255.0;
                            over(out, offset, [k, k, k, k]);
                        }
                    }
                }
            }
            continue;
        }
        let (dir_x, dir_y) = if distance > 1e-6 {
            (ex / distance, ey / distance)
        } else {
            let angle = random(1) * std::f64::consts::TAU;
            (libm::cos(angle), libm::sin(angle))
        };
        let speed = (0.55 + 0.9 * random(2)) * (1.25 - 0.75 * near);
        let travel = params.force * speed * tau * (2.0 - tau);
        let fall = params.gravity * tau * tau;
        let angle = params.rotation * (2.0 * random(3) - 1.0) * tau * std::f64::consts::PI / 180.0;
        let depth = random(4);
        let scale = 1.0 + 0.4 * depth * tau;
        let alpha = ((1.0 - tau) / (1.0 - FADE_START)).clamp(0.0, 1.0);
        if alpha <= 0.0 {
            continue;
        }
        let (dx, dy) = (dir_x * travel, dir_y * travel + fall);
        let (cos, sin) = (libm::cos(angle), libm::sin(angle));
        // The axis-aligned bounding box, in pixel edges, of the source after the forward transform.
        let (sx0, sy0) = (f64::from(piece.x0), f64::from(piece.y0));
        let (sx1, sy1) = (f64::from(piece.x1) + 1.0, f64::from(piece.y1) + 1.0);
        let (mut min_x, mut min_y, mut max_x, mut max_y) = (
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        );
        for (px, py) in [(sx0, sy0), (sx1, sy0), (sx0, sy1), (sx1, sy1)] {
            let (lx, ly) = ((px - cx) * scale, (py - cy) * scale);
            let (qx, qy) = (cx + dx + lx * cos - ly * sin, cy + dy + lx * sin + ly * cos);
            min_x = min_x.min(qx);
            min_y = min_y.min(qy);
            max_x = max_x.max(qx);
            max_y = max_y.max(qy);
        }
        if max_x <= 0.0 || max_y <= 0.0 || min_x >= w || min_y >= h {
            continue;
        }
        let bbox = (
            min_x.floor().max(0.0) as u32,
            min_y.floor().max(0.0) as u32,
            (max_x.ceil().min(w) as u32).max(1) - 1,
            (max_y.ceil().min(h) as u32).max(1) - 1,
        );
        flights.push(Flight {
            label,
            depth,
            cx,
            cy,
            dx,
            dy,
            cos,
            sin,
            scale,
            alpha,
            bbox,
        });
    }

    // Pieces closer to the camera (scaled up more) are drawn later. Pieces at the same depth are ordered by piece index, so the order is fully deterministic.
    flights.sort_by(|a, b| a.depth.total_cmp(&b.depth).then(a.label.cmp(&b.label)));
    for flight in &flights {
        let (x0, y0, x1, y1) = flight.bbox;
        for y in y0..=y1 {
            for x in x0..=x1 {
                // Inverse transform: q → source coordinates.
                let (qx, qy) = (
                    f64::from(x) + 0.5 - flight.cx - flight.dx,
                    f64::from(y) + 0.5 - flight.cy - flight.dy,
                );
                let lx = (qx * flight.cos + qy * flight.sin) / flight.scale;
                let ly = (-qx * flight.sin + qy * flight.cos) / flight.scale;
                let (sx, sy) = (flight.cx + lx, flight.cy + ly);
                if sx < 0.0 || sy < 0.0 || sx >= w || sy >= h {
                    continue;
                }
                let source = (sy as u32 * width + sx as u32) as usize;
                if labels[source] as usize != flight.label {
                    continue;
                }
                let mut src = bilinear(from, width, height, sx - 0.5, sy - 0.5);
                for value in &mut src {
                    *value *= flight.alpha;
                }
                over(out, ((y * width + x) * 4) as usize, src);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> Shatter {
        Shatter {
            pieces: 48.0,
            seed: 3,
            cx: 0.5,
            cy: 0.5,
            force: 40.0,
            rotation: 240.0,
            gravity: 30.0,
            crack: 0.6,
        }
    }

    #[test]
    fn the_piece_count_tracks_the_request() {
        for pieces in [8.0, 48.0, 120.0] {
            let grid = Grid::new(320, 180, &Shatter { pieces, ..params() });
            let actual = grid.seeds.len() as f64;
            assert!(
                actual >= pieces * 0.5 && actual <= pieces * 1.8,
                "requested {pieces} pieces, got {actual}"
            );
        }
    }

    #[test]
    fn pieces_near_the_impact_are_smaller() {
        let grid = Grid::new(320, 320, &params());
        let mut area = vec![0usize; grid.seeds.len()];
        for y in 0..320 {
            for x in 0..320 {
                area[grid.label(f64::from(x) + 0.5, f64::from(y) + 0.5) as usize] += 1;
            }
        }
        let inner: usize = area[..grid.n_theta].iter().sum::<usize>() / grid.n_theta;
        let outer_ring = grid.n_r - 1;
        let outer: usize = area[outer_ring * grid.n_theta..].iter().sum::<usize>() / grid.n_theta;
        assert!(inner * 4 < outer, "inner ring {inner} px/piece, outer ring {outer} px/piece");
    }
}

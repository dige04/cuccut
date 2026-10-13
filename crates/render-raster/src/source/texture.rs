//! Render-time texture fill for paths (spec §6.2.1): hatching, dot screens, and grain.
//!
//! This follows the sampling discipline of this directory, and more strictly: the texture has **no time parameter at all**. Its geometry is determined only by `(bounding box, texture parameters, seed, algorithm version)`. It is generated in path-local coordinates, and the caller clips it into the path and applies the node transform. Therefore:
//!
//! * the texture moves rigidly with its part. Only the position changes, and the texture is not regenerated;
//! * changing color or alpha does not change the topology (they do not enter the generation function);
//! * out-of-order sampling, cold or warm caches, and parallel workers all produce byte-identical command streams.
//!
//! The three random streams (hatching, dots, grain) each use a derived seed, so they do not shift each other. Adjusting the hatching density does not move the grain. Each candidate cell consumes a fixed number of random numbers, and "keep or drop" is just a comparison. So changing `density` only adds or removes strokes and does not move the others.

use crate::drawop::{PathData, path_from_skia};
use motion::rng::splitmix64_unit;
use scene_primitives::pathstyle::{PathTexture, TEXTURE_ALGORITHM_VERSION};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tiny_skia::PathBuilder;

const STREAM_HATCH: u64 = 0x6861_7463_6800_0001;
const STREAM_DOTS: u64 = 0x646F_7473_0000_0002;
const STREAM_GRAIN: u64 = 0x6772_6169_6E00_0003;
const STREAM_PAINT: u64 = 0x7061_696E_7400_0004;

/// Dot cap per path: above it, the grid spacing is scaled up proportionally, keeping the apparent coverage without blowing up memory.
const DOTS_MAX: f64 = 60_000.0;
/// Cap on the number of hatch segments, likewise.
const HATCH_MAX: f64 = 80_000.0;

/// One texture's geometry, all in path-local coordinates (already multiplied by `svg_scale`).
#[derive(Debug, Default, PartialEq)]
pub struct TextureGeom {
    /// Hatching: one path with multiple subpaths, stroked in one stroke.
    pub hatch: Option<(PathData, f32)>,
    /// Dot matrix: one path with multiple subpaths, filled in one fill.
    pub dots: Option<PathData>,
    /// Grain: one path with multiple subpaths, filled in one fill.
    pub grain: Option<PathData>,
    pub wash: Vec<(PathData, f64, [f32; 3])>,
    /// `paint`: strokes bucketed by shade or by color (`source::paint`), colored at recording time from the path's `fill`.
    pub paint: crate::source::paint::PaintGeom,
}

impl TextureGeom {
    pub fn is_empty(&self) -> bool {
        self.hatch.is_none()
            && self.dots.is_none()
            && self.grain.is_none()
            && self.wash.is_empty()
            && self.paint.is_empty()
    }
}

struct Stream {
    seed: u64,
    index: i64,
}

impl Stream {
    fn new(seed: u64, stream: u64) -> Self {
        Stream {
            seed: seed ^ stream,
            index: 0,
        }
    }
    fn unit(&mut self) -> f64 {
        let v = splitmix64_unit(self.seed, self.index);
        self.index += 1;
        v
    }
}

/// `bbox` = `(x0, y0, x1, y1)`, in path-local coordinates. `scale` = `svg_scale` (the texture parameters are in viewBox units, so multiply by it to reach local coordinates).
pub fn generate(bbox: (f64, f64, f64, f64), tx: &PathTexture, scale: f64) -> TextureGeom {
    let (x0, y0, x1, y1) = bbox;
    let (bw, bh) = (x1 - x0, y1 - y0);
    let mut geom = TextureGeom::default();
    if !(bw > 0.0 && bh > 0.0 && scale > 0.0) || !bw.is_finite() || !bh.is_finite() {
        return geom;
    }
    let (cx, cy) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    let half = (bw * bw + bh * bh).sqrt() / 2.0;
    let (ca, sa) = (tx.angle.cos(), tx.angle.sin());
    // Rotated lattice coordinates (u, v) → local coordinates
    let to_local = |u: f64, v: f64| (cx + u * ca - v * sa, cy + u * sa + v * ca);
    let inside =
        |x: f64, y: f64, pad: f64| x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad;

    if tx.finish.is_hatch() {
        let mut gap = tx.gap * scale;
        let len = tx.len * scale;
        let jit = tx.jitter * scale;
        let est = (2.0 * half / gap) * (2.0 * half / (len * 1.35)).max(1.0);
        if est > HATCH_MAX {
            gap *= est / HATCH_MAX;
        }
        let mut rng = Stream::new(tx.seed, STREAM_HATCH);
        let mut pb = PathBuilder::new();
        let mut any = false;
        let mut v = -half;
        while v <= half {
            let mut u = -half - rng.unit() * len;
            while u <= half {
                let keep = rng.unit();
                let l = len * (0.6 + rng.unit() * 0.8);
                let j0 = (rng.unit() - 0.5) * jit;
                let j1 = (rng.unit() - 0.5) * jit;
                let (ax, ay) = to_local(u, v + j0);
                let (bx, by) = to_local(u + l, v + j1);
                let (mx, my) = ((ax + bx) / 2.0, (ay + by) / 2.0);
                let cover = tx.density.at((mx - x0) / bw, (my - y0) / bh);
                if keep < cover && (inside(ax, ay, 0.0) || inside(bx, by, 0.0)) {
                    pb.move_to(ax as f32, ay as f32);
                    pb.line_to(bx as f32, by as f32);
                    any = true;
                }
                u += l + len * 0.35;
            }
            v += gap;
        }
        if any && let Some(path) = pb.finish() {
            geom.hatch = Some((path_from_skia(&path), (tx.width * scale).max(0.05) as f32));
        }
    }

    if tx.finish.is_dots() {
        let mut gap = tx.gap * scale;
        let est = (2.0 * half / gap).powi(2);
        if est > DOTS_MAX {
            gap *= (est / DOTS_MAX).sqrt();
        }
        let jit = tx.jitter * scale;
        let mut rng = Stream::new(tx.seed, STREAM_DOTS);
        let mut pb = PathBuilder::new();
        let mut any = false;
        let n = (half / gap).ceil() as i64;
        for row in -n..=n {
            for column in -n..=n {
                // Each cell always consumes two random numbers, even when jitter is 0 (the topology is independent of jitter)
                let jx = (rng.unit() - 0.5) * jit;
                let jy = (rng.unit() - 0.5) * jit;
                let (x, y) = to_local(column as f64 * gap + jx, row as f64 * gap + jy);
                let cover = tx.density.at((x - x0) / bw, (y - y0) / bh);
                // Dot area / cell area = coverage ⇒ r = gap·√(cover/π), capped at half the cell diagonal.
                // v2 kept as is: 0.7071 is a rounded constant, and swapping in FRAC_1_SQRT_2 would change the pixels. This is only an exemption for clippy.
                #[allow(clippy::approx_constant)]
                let r = (gap * (cover / std::f64::consts::PI).sqrt()).min(gap * 0.7071);
                if r < 0.05 || !inside(x, y, r) {
                    continue;
                }
                pb.push_circle(x as f32, y as f32, r as f32);
                any = true;
            }
        }
        if any && let Some(path) = pb.finish() {
            geom.dots = Some(path_from_skia(&path));
        }
    }

    if tx.finish == scene_primitives::pathstyle::Finish::Wash {
        let gap = (tx.gap * scale).max(1.0);
        let count = ((bw * bh / (gap * gap)).ceil() as usize).clamp(8, 128);
        let mut rng = Stream::new(tx.seed, 0x57415348);
        for _ in 0..count {
            let (u, v) = (rng.unit(), rng.unit());
            let cover = tx.density.at(u, v);
            let radius = gap * (0.5 + rng.unit() * 0.8);
            let aspect = 0.5 + rng.unit() * 0.7;
            let mut pb = PathBuilder::new();
            for i in 0..16 {
                let angle = i as f64 * std::f64::consts::TAU / 16.0;
                let r = radius * (0.82 + rng.unit() * 0.28);
                let (x, y) = (
                    x0 + u * bw + angle.cos() * r,
                    y0 + v * bh + angle.sin() * r * aspect,
                );
                if i == 0 {
                    pb.move_to(x as f32, y as f32);
                } else {
                    pb.line_to(x as f32, y as f32);
                }
            }
            pb.close();
            let opacity = cover * (0.3 + rng.unit() * 0.7);
            if let Some(path) = pb.finish() {
                geom.wash.push((
                    path_from_skia(&path),
                    opacity,
                    [
                        (x0 + u * bw) as f32,
                        (y0 + v * bh) as f32,
                        (radius * aspect.max(1.0)) as f32,
                    ],
                ));
            }
        }
    }

    if tx.finish == scene_primitives::pathstyle::Finish::Paint {
        use crate::source::paint;
        let list = paint::fill_layout(bbox, tx, scale);
        let params = paint::PaintParams {
            seed: tx.seed ^ STREAM_PAINT,
            rough: 1.0,
            dry: tx.dry,
            load: tx.load.is_some(),
        };
        geom.paint = paint::strokes(&list, &params);
    }

    // When the `grain` finish does not specify a grain count, it is set by area: one grain per gap² lattice cell, and then density decides how many are kept. For other finishes, `grain` is an overlaid grain layer, and there is none by default.
    let is_grain = tx.finish == scene_primitives::pathstyle::Finish::Grain;
    let count = if tx.grain == 0 && is_grain {
        let cell = (tx.gap * scale).powi(2);
        ((bw * bh / cell).ceil() as u32).min(scene_primitives::pathstyle::GRAIN_MAX)
    } else {
        tx.grain
    };
    if count > 0 {
        let mut rng = Stream::new(tx.seed, STREAM_GRAIN);
        let mut pb = PathBuilder::new();
        let mut any = false;
        for _ in 0..count {
            let (fx, fy) = (rng.unit(), rng.unit());
            let gx = x0 + fx * bw;
            let gy = y0 + fy * bh;
            let gs = tx.grain_size * scale * (0.4 + rng.unit());
            // Each grain always consumes four random numbers. density applies only to the `grain` finish
            let keep = rng.unit();
            if is_grain && keep >= tx.density.at(fx, fy) {
                continue;
            }
            if let Some(rect) =
                tiny_skia::Rect::from_xywh(gx as f32, gy as f32, gs as f32, gs as f32)
            {
                pb.push_rect(rect);
                any = true;
            }
        }
        if any && let Some(path) = pb.finish() {
            geom.grain = Some(path_from_skia(&path));
        }
    }
    geom
}

/// Cache key: geometry digest (bounding box + scale), finish parameters, seed, and algorithm version. Color and alpha are not in the key, because they do not affect the geometry.
pub fn cache_key(bbox: (f64, f64, f64, f64), tx: &PathTexture, scale: f64) -> u64 {
    use scene_primitives::pathstyle::Density;
    let mut bytes: Vec<u8> = Vec::with_capacity(160);
    bytes.extend(TEXTURE_ALGORITHM_VERSION.to_le_bytes());
    bytes.extend(tx.finish.as_str().as_bytes());
    for v in [bbox.0, bbox.1, bbox.2, bbox.3, scale] {
        bytes.extend(v.to_bits().to_le_bytes());
    }
    for v in [tx.angle, tx.gap, tx.len, tx.width, tx.jitter, tx.grain_size] {
        bytes.extend(v.to_bits().to_le_bytes());
    }
    let density: [f64; 6] = match tx.density {
        Density::Flat(v) => [0.0, v, 0.0, 0.0, 0.0, 0.0],
        Density::Radial {
            cx,
            cy,
            r,
            from,
            to,
        } => [1.0, cx, cy, r, from, to],
        Density::Linear { angle, from, to } => [2.0, angle, from, to, 0.0, 0.0],
    };
    for v in density {
        bytes.extend(v.to_bits().to_le_bytes());
    }
    bytes.extend(tx.grain.to_le_bytes());
    bytes.extend(tx.seed.to_le_bytes());
    // Only paint reads these two items: the keys of other finishes are unchanged
    if tx.finish == scene_primitives::pathstyle::Finish::Paint {
        bytes.extend(crate::source::paint::PAINT_ALGORITHM_VERSION.to_le_bytes());
        bytes.extend(tx.dry.to_bits().to_le_bytes());
        bytes.push(tx.load.is_some() as u8);
    }
    crate::drawop::fnv1a64(&bytes)
}

/// The texture cache held by the recorder. `record` takes `&self` and is shared by multiple workers, so it is a `Mutex`. A hit or miss does not affect the output (generation is a pure function); it only affects the time taken.
#[derive(Default)]
pub struct TextureCache {
    map: Mutex<HashMap<u64, Arc<TextureGeom>>>,
}

/// Cap on cache entries: when exceeded, the whole table is cleared. A hand-drawn piece typically has dozens to hundreds of entries.
const CACHE_MAX: usize = 4096;

impl TextureCache {
    pub fn get(
        &self,
        bbox: (f64, f64, f64, f64),
        tx: &PathTexture,
        scale: f64,
    ) -> Arc<TextureGeom> {
        let key = cache_key(bbox, tx, scale);
        if let Ok(map) = self.map.lock()
            && let Some(hit) = map.get(&key)
        {
            return hit.clone();
        }
        let geom = Arc::new(generate(bbox, tx, scale));
        if let Ok(mut map) = self.map.lock() {
            if map.len() >= CACHE_MAX {
                map.clear();
            }
            map.insert(key, geom.clone());
        }
        geom
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tx(value: serde_json::Value) -> PathTexture {
        PathTexture::parse(&value).unwrap().unwrap()
    }

    const BOX: (f64, f64, f64, f64) = (10.0, 20.0, 210.0, 140.0);

    #[test]
    fn generation_is_pure() {
        for finish in ["ink", "pencil", "grain", "screen", "riso"] {
            let t = tx(json!({ "finish": finish, "seed": 42, "grain": 200 }));
            assert_eq!(generate(BOX, &t, 1.0), generate(BOX, &t, 1.0), "{finish}");
            assert!(!generate(BOX, &t, 1.0).is_empty(), "{finish}");
        }
        let flat = tx(json!({ "finish": "flat" }));
        assert!(generate(BOX, &flat, 1.0).is_empty());
    }

    #[test]
    fn seed_changes_topology_color_does_not() {
        let a = tx(json!({ "finish": "ink", "seed": 1 }));
        let b = tx(json!({ "finish": "ink", "seed": 2 }));
        let c = tx(json!({ "finish": "ink", "seed": 1, "color": "#ff0000", "alpha": 0.2 }));
        assert_ne!(generate(BOX, &a, 1.0), generate(BOX, &b, 1.0));
        assert_eq!(generate(BOX, &a, 1.0), generate(BOX, &c, 1.0));
        assert_eq!(cache_key(BOX, &a, 1.0), cache_key(BOX, &c, 1.0));
        assert_ne!(cache_key(BOX, &a, 1.0), cache_key(BOX, &b, 1.0));
    }

    #[test]
    fn hatch_params_do_not_move_grain() {
        let a = tx(json!({ "finish": "ink", "seed": 9, "grain": 300, "density": 0.2 }));
        let b = tx(json!({ "finish": "ink", "seed": 9, "grain": 300, "density": 0.9, "gap": 9 }));
        assert_eq!(generate(BOX, &a, 1.0).grain, generate(BOX, &b, 1.0).grain);
    }

    #[test]
    fn density_only_adds_or_removes_strokes() {
        let lo = generate(
            BOX,
            &tx(json!({ "finish": "ink", "seed": 3, "density": 0.3 })),
            1.0,
        );
        let hi = generate(
            BOX,
            &tx(json!({ "finish": "ink", "seed": 3, "density": 0.8 })),
            1.0,
        );
        let (lo, hi) = (lo.hatch.unwrap().0, hi.hatch.unwrap().0);
        assert!(hi.0.len() > lo.0.len());
        // Every stroke at low density also appears, unchanged, at high density
        let hi_moves: Vec<_> = hi.0.chunks(2).collect();
        for stroke in lo.0.chunks(2) {
            assert!(hi_moves.contains(&stroke));
        }
    }

    #[test]
    fn dot_coverage_matches_density() {
        let t = tx(json!({ "finish": "screen", "gap": 10, "density": 0.5 }));
        let geom = generate((0.0, 0.0, 400.0, 400.0), &t, 1.0);
        let dots = geom.dots.unwrap();
        // push_circle = Move + 4 curves + Close
        let count = dots.0.iter().filter(|seg| seg.verb == 0).count() as f64;
        let r = 10.0 * (0.5 / std::f64::consts::PI).sqrt();
        let covered = count * std::f64::consts::PI * r * r / (400.0 * 400.0);
        assert!((covered - 0.5).abs() < 0.06, "covered={covered}");
    }

    #[test]
    fn paint_fill_covers_box_in_few_buckets() {
        let t = tx(json!({ "finish": "paint", "seed": 4, "load": "#ffffff" }));
        let geom = generate(BOX, &t, 1.0);
        assert!(!geom.paint.is_empty());
        assert!(geom.hatch.is_none() && geom.dots.is_none());
        assert!(geom.paint.buckets.len() <= 15);
        assert_eq!(geom, generate(BOX, &t, 1.0));
        let dry = tx(json!({ "finish": "paint", "seed": 4, "load": "#ffffff", "dry": 0.9 }));
        assert_ne!(cache_key(BOX, &t, 1.0), cache_key(BOX, &dry, 1.0));
    }

    #[test]
    fn cache_returns_same_geometry() {
        let cache = TextureCache::default();
        let t = tx(json!({ "finish": "riso", "seed": 5 }));
        let first = cache.get(BOX, &t, 2.0);
        let second = cache.get(BOX, &t, 2.0);
        assert!(Arc::ptr_eq(&first, &second));
        assert_eq!(*first, generate(BOX, &t, 2.0));
    }
}

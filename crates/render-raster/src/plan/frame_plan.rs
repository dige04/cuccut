//! `FramePlan` and its layered fingerprints (design §6.1 / §6.6).
//!
//! Three layers of fingerprints, each with its own scope:
//! * **DrawOp fingerprint** (`drawop::fingerprint`): the primitive identity of a single instruction stream; `ccut ops` and the
//!   overlay response header continue to use it.
//! * **FramePlan fingerprint** ([`FramePlan::plan_fingerprint`]): the structural identity of the whole plan, including surface sizes,
//!   pass order, effect id/version, uniforms and capabilities.
//! * **Surface fingerprint** ([`FramePlan::surface_fingerprint`]): the **content** identity of a surface: its description, the passes
//!   that write to it, and the fingerprints of its input surfaces. **Frame fingerprint := the fingerprint of the output surface**
//!   ([`FramePlan::frame_fingerprint`]); this is the key for the still-frame cache and the column in the render manifest.
//!
//! The encoding rules share a source with DrawOp: little-endian, `-0.0 → +0.0`, side tables in declaration order, and `UniformMap`
//! is a `BTreeMap` ⇒ key order is naturally deterministic, so no re-sorting is needed at encoding time.

use super::pass::RenderPass;
// `CompositeInput` / `BlendMode` are only needed by `from_layers` (BCF layered recording).
use super::surface::CompositeInput;
use super::surface::{SurfaceId, SurfacePlan};
use crate::drawop::{self, Color4, FrameOps};
use anyhow::{Result, bail};
use motion::effect::BlendMode;
use motion::effect::{EffectRef, UniformMap, UniformValue};
use std::collections::BTreeMap;

pub const FRAME_PLAN_VERSION: u32 = 4;

const PLAN_MAGIC: u32 = 0x42_46_50_4C; // "BFPL"
const SURFACE_MAGIC: u32 = 0x42_53_46_50; // "BSFP"

#[derive(Debug)]
pub struct FramePlan {
    pub version: u32,
    /// Sorted ascending by `id` (enforced by `validate`).
    pub surfaces: Vec<SurfacePlan>,
    /// Topological order: each pass's inputs must be produced by an earlier pass, or be a clear surface that has not been written.
    pub passes: Vec<RenderPass>,
    pub output: SurfaceId,
    /// Fingerprint of the execution backend's capability profile ([`super::CapabilityProfile::fingerprint`]).
    pub capability: u64,
}

/// Recursive recording is flattened into an acyclic, single-writer surface graph.
struct PlanBuilder {
    width: u32,
    height: u32,
    surfaces: Vec<SurfacePlan>,
    passes: Vec<RenderPass>,
}

impl PlanBuilder {
    fn alloc(&mut self, lifetime: super::SurfaceLifetime) -> SurfaceId {
        let id = SurfaceId(self.surfaces.len() as u32);
        self.surfaces.push(SurfacePlan {
            lifetime,
            ..SurfacePlan::canvas(id, self.width, self.height)
        });
        id
    }

    fn filters(
        &mut self,
        mut target: SurfaceId,
        effects: Vec<scene_primitives::resolve::ResolvedEffect>,
        lifetime: super::SurfaceLifetime,
    ) -> SurfaceId {
        for effect in effects {
            let output = self.alloc(lifetime);
            self.passes.push(RenderPass::Filter {
                input: target,
                output,
                effect: effect.effect,
                uniforms: effect.uniforms,
            });
            target = output;
        }
        target
    }

    fn layers(
        &mut self,
        layers: Vec<crate::renderer::FrameLayer>,
        lifetime: super::SurfaceLifetime,
    ) -> SurfaceId {
        use crate::renderer::FrameLayer;
        let mut acc = None;
        for layer in layers {
            let (target, blend, opacity) = match layer {
                FrameLayer::Ops(ops) => {
                    let target = self.alloc(lifetime);
                    self.passes.push(RenderPass::Draw { target, ops });
                    (target, BlendMode::Normal, 1.0)
                }
                FrameLayer::Effect {
                    ops,
                    effects,
                    blend,
                    opacity,
                } => {
                    let target = self.alloc(lifetime);
                    self.passes.push(RenderPass::Draw { target, ops });
                    (self.filters(target, effects, lifetime), blend, opacity)
                }
                FrameLayer::Group {
                    layers,
                    masks,
                    effects,
                    blend,
                    opacity,
                } => {
                    let mut target = self.layers(layers, lifetime);
                    for (layers, mode) in masks {
                        let mask = self.layers(layers, lifetime);
                        let output = self.alloc(lifetime);
                        self.passes.push(RenderPass::Mask {
                            input: target,
                            mask,
                            output,
                            mode,
                        });
                        target = output;
                    }
                    (self.filters(target, effects, lifetime), blend, opacity)
                }
                FrameLayer::Temporal { samples, mode } => {
                    let inputs: Vec<_> = samples
                        .into_iter()
                        .map(|(layers, weight)| (self.layers(layers, lifetime), weight))
                        .collect();
                    let output = self.alloc(lifetime);
                    if mode == scene_primitives::temporal::EchoMode::Average {
                        self.passes.push(RenderPass::Accumulate { inputs, output });
                    } else {
                        self.passes.push(RenderPass::Composite {
                            inputs: inputs
                                .into_iter()
                                .map(|(surface, weight)| CompositeInput {
                                    surface,
                                    blend: BlendMode::Normal,
                                    opacity: weight as f32,
                                    mask: None,
                                })
                                .collect(),
                            output,
                        });
                    }
                    (output, BlendMode::Normal, 1.0)
                }
                FrameLayer::LocalCanvas {
                    layers,
                    width,
                    height,
                    tf,
                } => {
                    let (parent_w, parent_h) = (self.width, self.height);
                    self.width = width;
                    self.height = height;
                    let input = self.layers(layers, lifetime);
                    self.width = parent_w;
                    self.height = parent_h;
                    let output = self.alloc(lifetime);
                    self.passes
                        .push(RenderPass::Transform { input, output, tf });
                    (output, BlendMode::Normal, 1.0)
                }
                FrameLayer::Backdrop {
                    masks,
                    effects,
                    opacity,
                } => {
                    let base = acc.unwrap_or_else(|| self.layers(Vec::new(), lifetime));
                    let filtered = self.filters(base, effects, lifetime);
                    let mut coverage = None;
                    for (layers, mode) in masks {
                        let mask = self.layers(layers, lifetime);
                        coverage = Some(match coverage {
                            None => mask,
                            Some(input) => {
                                let output = self.alloc(lifetime);
                                self.passes.push(RenderPass::Mask {
                                    input,
                                    mask,
                                    output,
                                    mode,
                                });
                                output
                            }
                        });
                    }
                    let mask = coverage.unwrap_or_else(|| self.layers(Vec::new(), lifetime));
                    let output = self.alloc(lifetime);
                    self.passes.push(RenderPass::Backdrop {
                        base,
                        filtered,
                        mask,
                        output,
                        opacity,
                    });
                    acc = Some(output);
                    continue;
                }
                FrameLayer::Transition {
                    from,
                    to,
                    effect,
                    progress,
                    uniforms,
                    from_static,
                    to_static,
                } => {
                    let side_lifetime = |fixed| {
                        if fixed {
                            super::SurfaceLifetime::Static
                        } else {
                            lifetime
                        }
                    };
                    let from = self.layers(from, side_lifetime(from_static));
                    let to = self.layers(to, side_lifetime(to_static));
                    let output = self.alloc(lifetime);
                    self.passes.push(RenderPass::Transition {
                        from,
                        to,
                        output,
                        effect,
                        progress,
                        uniforms,
                    });
                    (output, BlendMode::Normal, 1.0)
                }
            };
            let input = CompositeInput {
                surface: target,
                blend,
                opacity,
                mask: None,
            };
            acc = Some(match acc {
                None if blend == BlendMode::Normal && opacity >= 1.0 => target,
                previous => {
                    let mut inputs: Vec<_> =
                        previous.into_iter().map(CompositeInput::opaque).collect();
                    inputs.push(input);
                    let output = self.alloc(lifetime);
                    self.passes.push(RenderPass::Composite { inputs, output });
                    output
                }
            });
        }
        acc.unwrap_or_else(|| {
            let target = self.alloc(lifetime);
            self.passes.push(RenderPass::Draw {
                target,
                ops: FrameOps::default(),
            });
            target
        })
    }
}

impl FramePlan {
    /// The **folded shape** of a document with no effects: one canvas surface + one Draw pass. The executor calls
    /// `raster::rasterize_with_media` directly for this shape. It is the same code path as rasterizing as-is after `record(t)`,
    /// byte-identical (design §6.1).
    pub fn single_draw(width: u32, height: u32, ops: FrameOps, capability: u64) -> Self {
        FramePlan {
            version: FRAME_PLAN_VERSION,
            surfaces: vec![SurfacePlan::canvas(SurfaceId::OUTPUT, width, height)],
            passes: vec![RenderPass::Draw {
                target: SurfaceId::OUTPUT,
                ops,
            }],
            output: SurfaceId::OUTPUT,
            capability,
        }
    }

    /// Layered recording result → plan (design §6.3).
    ///
    /// Each layer is first drawn into its own surface; effect layers then chain a series of `Filter` passes; and finally each layer is
    /// `Composite`d back into the accumulated picture in declaration order. When there is only one plain instruction-stream layer, it is
    /// **folded** into [`FramePlan::single_draw`], so a document without effects still goes through a single Draw pass.
    ///
    /// The inputs come from the BCF recorder, which does no I/O; native and WASM share the same plan.
    pub fn from_layers(
        width: u32,
        height: u32,
        layers: Vec<crate::renderer::FrameLayer>,
        capability: u64,
    ) -> Self {
        use crate::renderer::FrameLayer;
        if let [FrameLayer::Ops(_)] = layers.as_slice() {
            let Some(FrameLayer::Ops(ops)) = layers.into_iter().next() else {
                unreachable!("上一行已经判定为单层普通指令流");
            };
            return FramePlan::single_draw(width, height, ops, capability);
        }
        let mut builder = PlanBuilder {
            width,
            height,
            surfaces: Vec::new(),
            passes: Vec::new(),
        };
        let output = builder.layers(layers, super::SurfaceLifetime::PerFrame);
        FramePlan {
            version: FRAME_PLAN_VERSION,
            surfaces: builder.surfaces,
            passes: builder.passes,
            output,
            capability,
        }
    }

    /// Exactly one Draw pass that writes directly to the output surface ⇒ the executor takes the fast path.
    pub fn is_folded(&self) -> bool {
        self.surfaces.len() == 1
            && self.passes.len() == 1
            && matches!(&self.passes[0], RenderPass::Draw { target, .. } if *target == self.output)
    }

    pub fn surface(&self, id: SurfaceId) -> Option<&SurfacePlan> {
        self.surfaces.iter().find(|surface| surface.id == id)
    }

    pub fn output_surface(&self) -> Option<&SurfacePlan> {
        self.surface(self.output)
    }

    /// Structural validity: surface ids are sorted ascending with no duplicates, the output exists, every pass's output/input is
    /// declared, and inputs must be written before use or be a clear surface (topological order).
    pub fn validate(&self) -> Result<()> {
        if self.version != FRAME_PLAN_VERSION {
            bail!("frameplan-version-unsupported: {}", self.version);
        }
        for pair in self.surfaces.windows(2) {
            if pair[0].id >= pair[1].id {
                bail!(
                    "frameplan-surface-order: surface id 必须升序且唯一（{:?} 之后是 {:?}）",
                    pair[0].id,
                    pair[1].id
                );
            }
        }
        if self.surface(self.output).is_none() {
            bail!("frameplan-output-unknown: {:?}", self.output);
        }
        // The content of an `External` surface is supplied by the caller and treated as already written from the start.
        let mut written: Vec<SurfaceId> = self
            .surfaces
            .iter()
            .filter(|surface| surface.lifetime == super::surface::SurfaceLifetime::External)
            .map(|surface| surface.id)
            .collect();
        for (index, pass) in self.passes.iter().enumerate() {
            if let RenderPass::Accumulate { inputs, .. } = pass {
                let total: f64 = inputs.iter().map(|(_, w)| *w).sum();
                if inputs.is_empty()
                    || inputs.iter().any(|(_, w)| !w.is_finite() || *w < 0.0)
                    || !total.is_finite()
                    || total <= 0.0
                {
                    bail!("frameplan-weights-invalid: pass {index}");
                }
            }
            let output = pass.output();
            if self.surface(output).is_none() {
                bail!(
                    "frameplan-pass-output-unknown: pass {index} ({}) 写入未声明的 {output:?}",
                    pass.kind()
                );
            }
            for input in pass.inputs() {
                if self.surface(input).is_none() {
                    bail!(
                        "frameplan-pass-input-unknown: pass {index} ({}) 读取未声明的 {input:?}",
                        pass.kind()
                    );
                }
                if input == output {
                    bail!(
                        "frameplan-pass-self-read: pass {index} ({}) 的输入与输出同为 {input:?}",
                        pass.kind()
                    );
                }
                if !written.contains(&input) {
                    bail!(
                        "frameplan-pass-order: pass {index} ({}) 读取尚未写入的 {input:?}",
                        pass.kind()
                    );
                }
            }
            if !written.contains(&output) {
                written.push(output);
            }
        }
        Ok(())
    }

    /// Structural fingerprint of the whole plan.
    pub fn plan_fingerprint(&self) -> u64 {
        drawop::fnv1a64(&encode_plan(self))
    }

    /// Content fingerprint of a surface. Recursively implies all upstream inputs.
    pub fn surface_fingerprint(&self, id: SurfaceId) -> Result<u64> {
        let table = self.surface_fingerprints()?;
        table
            .get(&id.0)
            .copied()
            .ok_or_else(|| anyhow::anyhow!("frameplan-surface-unknown: {id:?}"))
    }

    /// **Frame fingerprint**: the content fingerprint of the output surface.
    pub fn frame_fingerprint(&self) -> Result<u64> {
        self.frame_fingerprints().map(|(frame, _)| frame)
    }

    /// The frame fingerprint **plus** the full surface fingerprint table obtained as a by-product of computing it.
    ///
    /// The cost of the fingerprint table is a full `drawop::encode` for each Draw pass, and the executor internally also needs the same
    /// table as the cache keys for intermediate surfaces. When the caller computes the fingerprint first and then executes on a cache
    /// miss, it can use this entry to get the table and pass it to [`super::execute_plan_with_fingerprints`], saving a second encoding.
    ///
    /// **The table is bound to the plan**: after the table is obtained, no field of `plan` may be modified, or the table becomes stale.
    pub fn frame_fingerprints(&self) -> Result<(u64, BTreeMap<u32, u64>)> {
        let table = self.surface_fingerprints()?;
        let frame = table
            .get(&self.output.0)
            .copied()
            .ok_or_else(|| anyhow::anyhow!("frameplan-surface-unknown: {:?}", self.output))?;
        Ok((frame, table))
    }

    /// Content fingerprints of all surfaces. The plan is already in topological order (`validate`), so a single forward pass suffices;
    /// no recursion is needed and cycles are impossible.
    pub fn surface_fingerprints(&self) -> Result<BTreeMap<u32, u64>> {
        self.validate()?;
        let mut table: BTreeMap<u32, u64> = self
            .surfaces
            .iter()
            .map(|surface| {
                let mut bytes = Vec::with_capacity(48);
                put_u32(&mut bytes, SURFACE_MAGIC);
                put_u32(&mut bytes, self.version);
                put_u64(&mut bytes, self.capability);
                encode_surface(surface, &mut bytes);
                (surface.id.0, drawop::fnv1a64(&bytes))
            })
            .collect();
        for pass in &self.passes {
            let output = pass.output();
            let mut bytes = Vec::with_capacity(256);
            put_u64(
                &mut bytes,
                *table.get(&output.0).expect("validate 已保证 output 存在"),
            );
            encode_pass_body(pass, &mut bytes);
            for input in pass.inputs() {
                put_u64(
                    &mut bytes,
                    *table.get(&input.0).expect("validate 已保证 input 存在"),
                );
            }
            table.insert(output.0, drawop::fnv1a64(&bytes));
        }
        Ok(table)
    }
}

// ── Binary encoding (LE; section order: header → surfaces → passes → output) ─────────

fn put_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn put_u64(out: &mut Vec<u8>, v: u64) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn put_f32(out: &mut Vec<u8>, v: f32) {
    // Same rule as DrawOp: -0.0 is normalized to +0.0
    let v = if v == 0.0 { 0.0f32 } else { v };
    out.extend_from_slice(&v.to_le_bytes());
}

fn put_f64(out: &mut Vec<u8>, v: f64) {
    let v = if v == 0.0 { 0.0f64 } else { v };
    out.extend_from_slice(&v.to_le_bytes());
}

fn put_str(out: &mut Vec<u8>, s: &str) {
    put_u32(out, s.len() as u32);
    out.extend_from_slice(s.as_bytes());
}

fn put_color(out: &mut Vec<u8>, c: &Color4) {
    for v in c {
        put_f32(out, *v);
    }
}

fn encode_surface(surface: &SurfacePlan, out: &mut Vec<u8>) {
    put_u32(out, surface.id.0);
    put_u32(out, surface.width);
    put_u32(out, surface.height);
    out.push(surface.color.space.code());
    out.push(surface.color.precision.code());
    out.push(surface.lifetime.code());
    match &surface.clear {
        Some(color) => {
            out.push(1);
            put_color(out, color);
        }
        None => out.push(0),
    }
}

fn encode_effect(effect: &EffectRef, out: &mut Vec<u8>) {
    put_str(out, &effect.id);
    put_u32(out, effect.version);
    match effect.pkg_hash {
        Some(hash) => {
            out.push(1);
            put_u64(out, hash);
        }
        None => out.push(0),
    }
}

/// `UniformMap` is a `BTreeMap` ⇒ iteration order = lexicographic key order, so the encoding is naturally deterministic.
fn encode_uniforms(uniforms: &UniformMap, out: &mut Vec<u8>) {
    put_u32(out, uniforms.len() as u32);
    for (key, value) in uniforms.iter() {
        put_str(out, key);
        out.push(value.tag());
        match value {
            UniformValue::Scalar(v) => put_f64(out, *v),
            UniformValue::Int(v) => out.extend_from_slice(&v.to_le_bytes()),
            UniformValue::Bool(v) => out.push(u8::from(*v)),
            UniformValue::Vec2(v) => v.iter().for_each(|v| put_f64(out, *v)),
            UniformValue::Vec4(v) | UniformValue::Color(v) => {
                v.iter().for_each(|v| put_f64(out, *v))
            }
            UniformValue::Text(v) => put_str(out, v),
        }
    }
}

/// The **body** of a pass: it does not include the ids of its input surfaces (the surface fingerprint uses the input fingerprint
/// values instead, so that “the same pass applied to different content” yields different surface fingerprints).
fn encode_pass_body(pass: &RenderPass, out: &mut Vec<u8>) {
    out.push(pass.tag());
    match pass {
        RenderPass::Draw { ops, .. } => {
            let bytes = drawop::encode(ops);
            put_u32(out, bytes.len() as u32);
            out.extend_from_slice(&bytes);
        }
        RenderPass::Filter {
            effect, uniforms, ..
        } => {
            encode_effect(effect, out);
            encode_uniforms(uniforms, out);
        }
        RenderPass::Transition {
            effect,
            progress,
            uniforms,
            ..
        } => {
            encode_effect(effect, out);
            put_f32(out, *progress);
            encode_uniforms(uniforms, out);
        }
        RenderPass::Accumulate { inputs, .. } => {
            put_u32(out, inputs.len() as u32);
            for (_, weight) in inputs {
                put_f64(out, *weight);
            }
        }
        RenderPass::Transform { tf, .. } => tf.iter().for_each(|v| put_f32(out, *v)),
        RenderPass::Mask { mode, .. } => out.push(mode.code()),
        RenderPass::Backdrop { opacity, .. } => put_f32(out, *opacity),
        RenderPass::Composite { inputs, .. } => {
            put_u32(out, inputs.len() as u32);
            for input in inputs {
                out.push(input.blend.code());
                put_f32(out, input.opacity);
                out.push(u8::from(input.mask.is_some()));
            }
        }
    }
}

/// The full encoding of the plan (the input to the structural fingerprint). Unlike the surface fingerprint, this **includes** the
/// ids of input surfaces: plan identity cares about wiring, content identity cares about upstream values.
pub fn encode_plan(plan: &FramePlan) -> Vec<u8> {
    let mut out = Vec::with_capacity(4096);
    put_u32(&mut out, PLAN_MAGIC);
    put_u32(&mut out, plan.version);
    put_u64(&mut out, plan.capability);
    put_u32(&mut out, plan.surfaces.len() as u32);
    for surface in &plan.surfaces {
        encode_surface(surface, &mut out);
    }
    put_u32(&mut out, plan.passes.len() as u32);
    for pass in &plan.passes {
        encode_pass_body(pass, &mut out);
        put_u32(&mut out, pass.output().0);
        let inputs = pass.inputs();
        put_u32(&mut out, inputs.len() as u32);
        for input in inputs {
            put_u32(&mut out, input.0);
        }
    }
    put_u32(&mut out, plan.output.0);
    out
}

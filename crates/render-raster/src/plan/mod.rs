//! Render Graph (design §6 / ADR-M04): `FramePlan { surfaces, passes, output }` expresses filters, masks, blending and dual-picture
//! transitions, and DrawOp returns to its core role as a “single-surface primitive”.
//!
//! `FramePlan = f(resolvedDocument, data, registryVersions, capabilityProfile, t)` — it does not depend on the previous frame, playback
//! order, runtime randomness or the network. **A document without effects folds into a single Draw pass**; the executor calls
//! `raster::rasterize_with_media` directly for it, byte-identical to the existing `record(t)` path ([`FramePlan::is_folded`]).

pub mod cache;
pub mod capability;
pub mod executor_cpu;
/// wgpu backend (element plan ADR-E06). Off by default; see the `gpu` feature in `Cargo.toml`.
#[cfg(feature = "gpu-runtime")]
pub mod executor_gpu;
pub mod frame_plan;
pub mod gpu_fallback;
pub mod pass;
pub mod shader_quad;
pub mod shader_source;
pub mod surface;

pub use cache::{DEFAULT_SURFACE_CACHE_BYTES, SurfaceCache};
pub use capability::{
    CPU_BACKEND, CPU_BACKEND_VERSION, CapabilityProfile, FallbackRecord, PreflightDiagnostic,
    PreflightReport, preflight, preflight_effects,
};
pub use executor_cpu::{
    CpuExecutor, PassExecutor, composite_bounded, composite_bounded_rect, execute_plan,
    execute_plan_with_fingerprints, execute_plan_with_inputs,
};
#[cfg(feature = "gpu-runtime")]
pub use executor_gpu::GpuExecutor;
#[cfg(feature = "wgsl-validate")]
pub use executor_gpu::validate_wgsl;
pub use frame_plan::{FRAME_PLAN_VERSION, FramePlan, encode_plan};
pub use gpu_fallback::{GpuBackendReport, GpuFallbackReason, GpuFallbackRecord};
pub use pass::RenderPass;
pub use shader_quad::{
    AudioTexture, ProgressUniforms, QuadTarget, QuadUniforms, RecipeUniform, ShaderQuad,
    TransformUniforms, UniformBinding, VisualizerUniforms,
};
pub use shader_source::{
    FRAGMENT_ENTRY, SHADER_SOURCES, ShaderDomain, ShaderSource, VERTEX_ENTRY, shader_for,
};
pub use surface::{CompositeInput, SurfaceId, SurfaceLifetime, SurfacePlan};

use crate::fonts::TextEngine;
use crate::renderer::FrameRenderer;
use anyhow::Result;
pub use motion::effect::{BlendMode, EffectRef};
use scene_primitives::resolve::Ir;

/// `BlendMode` → tiny-skia. The implementation is in [`crate::effects::composite::blend`]; this only keeps the historical entry
/// point under `plan::`.
pub use crate::effects::blend_to_skia;

/// The effect topology of the document. Computed once at compile time: if empty ⇒ every frame folds into a single Draw pass.
///
/// “Needs an off-screen surface” means the element has a non-empty `effects[]` (spec §6.6), or has a `blur` channel (equivalent to an
/// implicit `filter.blur` at the end of the effect stack). `blendMode` and `clipPath` are **not** on this list: they are single-surface
/// semantics, which DrawOp v3 expresses directly.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct EffectTopology {
    /// Number of nodes that need their own off-screen surface (0 and no Surface Transition ⇒ folded).
    pub surface_nodes: usize,
    /// All referenced effects (deduplicated, ordered). Used by preflight and `fallbacks[]`.
    pub effects: Vec<EffectRef>,
    /// Number of clip points declared as Surface Transition (spec §9). They need two off-screen surfaces plus a `Transition` pass, so
    /// they likewise break folding.
    pub surface_transitions: usize,
}

impl EffectTopology {
    pub fn is_empty(&self) -> bool {
        self.surface_nodes == 0 && self.surface_transitions == 0
    }

    /// Scans the IR to decide which nodes need off-screen surfaces.
    pub fn of(ir: &Ir) -> Self {
        let mut out = EffectTopology::default();
        for clip in &ir.visual_clips {
            out.scan(&clip.tree);
        }
        out.surface_transitions = ir.surface_transitions.len();
        out
    }

    fn scan(&mut self, node: &scene_primitives::resolve::RNode) {
        // Element-level `blur` channels and text part `blur` channels (§6.4 per-word blur) both become off-screen layers with an implicit
        // `filter.blur`.
        let blur = node.channels.iter().any(|channel| channel.prop == "blur")
            || node.part_motion.as_ref().is_some_and(|parts| {
                parts
                    .channels
                    .iter()
                    .flatten()
                    .any(|channel| channel.prop == "blur")
            });
        if node.composition.is_some()
            || node.echo.is_some()
            || !node.effects.is_empty()
            || !node.backdrop_effects.is_empty()
            || blur
        {
            self.surface_nodes += 1;
            for effect in node.effects.iter().chain(&node.backdrop_effects) {
                if !self.effects.contains(&effect.effect) {
                    self.effects.push(effect.effect.clone());
                }
            }
            if blur {
                let implicit = EffectRef::new("filter.blur", 1);
                if !self.effects.contains(&implicit) {
                    self.effects.push(implicit);
                }
            }
        }
        for child in &node.children {
            self.scan(child);
        }
    }

    /// Composition restrictions are handled by core's dependency checks and the execution backend's capability checks.
    pub fn conflicts(_ir: &Ir) -> Vec<String> {
        Vec::new()
    }
}

/// Compiler for the per-frame plan. Runs preflight and the topology scan once at creation time; each frame only emits the plan.
pub struct FramePlanner {
    caps: CapabilityProfile,
    capability_fingerprint: u64,
    topology: EffectTopology,
    report: PreflightReport,
    /// Surface Transitions that cannot run and must fall back to the Motion channel (by the id of `from_clip`). Always empty on the CPU
    /// reference — all four built-in transitions are strict and implemented.
    transition_fallbacks: std::collections::BTreeSet<String>,
}

impl FramePlanner {
    /// Preflight is completed at creation time (design §6.5: it must be finished before formal per-frame work).
    pub fn compile(ir: &Ir, caps: CapabilityProfile) -> Result<Self> {
        let report = preflight(ir, &caps)?;
        // `preflight` has already recorded the downgrades in the report; here we only need the same list (the same pure function with the
        // same input ⇒ the same result).
        let mut probe = PreflightReport::default();
        let transition_fallbacks = capability::preflight_transitions(ir, &caps, &mut probe);
        let capability_fingerprint = caps.fingerprint();
        Ok(FramePlanner {
            caps,
            capability_fingerprint,
            topology: EffectTopology::of(ir),
            report,
            transition_fallbacks,
        })
    }

    /// Convenience entry point for the CPU reference backend.
    pub fn cpu(ir: &Ir) -> Result<Self> {
        FramePlanner::compile(ir, CapabilityProfile::cpu_reference())
    }

    /// CPU reference + **host-side resource diagnostics**.
    ///
    /// Preflight itself only looks at `Ir` (a pure function, with no bytes). But Lottie's `lottie-unsupported-feature` warning is something
    /// known only when parsing the assets: ignored expression-controller groups are recorded in `load_assets`, and merged here into the same
    /// report, so that `ccut render --json` / `ccut ops` `diagnostics` show everything in one place. The fail level does not take this path:
    /// such assets are already an `Err` at `load_assets`.
    #[cfg(feature = "media")]
    pub fn cpu_with_assets(ir: &Ir, assets: &crate::assets::LoadedAssets) -> Result<Self> {
        let mut planner = FramePlanner::cpu(ir)?;
        planner
            .report
            .diagnostics
            .extend(assets.source_diagnostics.iter().cloned());
        Ok(planner)
    }

    pub fn capabilities(&self) -> &CapabilityProfile {
        &self.caps
    }

    pub fn capability_fingerprint(&self) -> u64 {
        self.capability_fingerprint
    }

    pub fn report(&self) -> &PreflightReport {
        &self.report
    }

    pub fn topology(&self) -> &EffectTopology {
        &self.topology
    }

    /// Clip points downgraded to Motion Transition in this compilation (by the id of `from_clip`).
    pub fn transition_fallbacks(&self) -> &std::collections::BTreeSet<String> {
        &self.transition_fallbacks
    }

    /// Plans the frame at time `t`. Recording goes through the same `FrameRenderer::record` — there is no “second recorder” on the folded
    /// path.
    pub fn plan(
        &self,
        renderer: &FrameRenderer,
        ir: &Ir,
        engine: &mut TextEngine,
        t: f64,
    ) -> FramePlan {
        if self.topology.is_empty() {
            let ops = renderer.record(ir, engine, t);
            return self.plan_from_ops(renderer.width, renderer.height, ops);
        }
        let frame = renderer.record_layered_with(ir, engine, t, &self.transition_fallbacks);
        FramePlan::from_layers(
            renderer.width,
            renderer.height,
            frame.layers,
            self.capability_fingerprint,
        )
    }

    /// Single-frame convenience entry point for plan + execution.
    ///
    /// **Single-frame rendering must go through here**, and must not call [`FrameRenderer::draw`] directly: the latter is the flat path,
    /// while the effect stack is `Filter` passes that are not in the instruction stream, so bypassing the plan would silently drop
    /// `effects[]` / `blur`. A document without effects folds into a single Draw pass on this path, and the executor calls
    /// `rasterize_with_media` directly — byte-identical to `draw`.
    #[cfg(feature = "media")]
    pub fn render(
        &self,
        renderer: &FrameRenderer,
        ir: &Ir,
        engine: &mut TextEngine,
        media: &mut crate::media::MediaStore,
        t: f64,
    ) -> Result<tiny_skia::Pixmap> {
        let plan = self.plan(renderer, ir, engine, t);
        let mut executor = CpuExecutor::new(self.caps.clone());
        execute_plan(&plan, &mut executor, media, None)
    }

    /// Entry point when an instruction stream already exists (for the overlay path and tests).
    pub fn plan_from_ops(
        &self,
        width: u32,
        height: u32,
        ops: crate::drawop::FrameOps,
    ) -> FramePlan {
        debug_assert!(
            self.topology.is_empty(),
            "非空效果拓扑必须走 4B 的分支，而不是折叠"
        );
        FramePlan::single_draw(width, height, ops, self.capability_fingerprint)
    }
}

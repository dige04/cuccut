//! Prepared BCF document: the entry point for layout, recording and frame planning shared by native, WASM and export.
//!
//! The caller loads resources and resolves them first, then creates this session. The session reads no files, decodes no media, and does not own the playback clock. When the document or resource content changes, create a new session, and atomically replace the old session only after preparation succeeds.

use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use anyhow::{Result, bail};
use scene_primitives::resolve::Ir;

use crate::source::Lottie;
use crate::{
    CapabilityProfile, CpuExecutor, FrameMedia, FramePlan, FramePlanner, FrameRenderer,
    PreflightReport, SurfaceCache, TextEngine, execute_plan, execute_plan_with_fingerprints,
};

/// Prepared document without host resource handles. Each render worker holds its own session.
pub struct PreparedBcf {
    compiled: Arc<Compiled>,
    text: TextEngine,
    surfaces: SurfaceCache,
}

/// The part that is read-only once prepared: the laid-out IR, animation compilation and the frame planner. Parallel workers share this one, each carrying only a text engine and an executor (the same split as `ccut render`'s per-core division).
struct Compiled {
    ir: Ir,
    renderer: FrameRenderer,
    planner: FramePlanner,
}

impl PreparedBcf {
    /// Completes layout, animation compilation and capability pre-checks for an IR whose media metadata has already been injected.
    /// `text`'s fonts and `lotties` are both provided by the host and cannot be loaded during sampling.
    pub fn new(
        mut ir: Ir,
        mut text: TextEngine,
        lotties: &HashMap<String, Arc<Lottie>>,
        capabilities: CapabilityProfile,
    ) -> Result<Self> {
        let renderer = FrameRenderer::new_with_lotties(&mut ir, &mut text, lotties)?;
        let planner = FramePlanner::compile(&ir, capabilities)?;
        Ok(Self {
            compiled: Arc::new(Compiled {
                ir,
                renderer,
                planner,
            }),
            text,
            surfaces: SurfaceCache::with_frame_cap(16),
        })
    }

    /// Read-only laid-out document; the audio plan, scene timeline and media requirements are consumed by the host.
    pub fn ir(&self) -> &Ir {
        &self.compiled.ir
    }

    pub fn report(&self) -> &PreflightReport {
        self.compiled.planner.report()
    }

    /// Samples any non-negative project time independently, without depending on prior playback or seek order.
    /// Does not implicitly quantize or clamp the final frame; playback control and export each use their own explicitly specified sample times.
    pub fn plan(&mut self, time: f64) -> Result<FramePlan> {
        if !time.is_finite() || time < 0.0 {
            bail!("bcf-time-invalid: sample time must be a non-negative, finite number of seconds");
        }
        Ok(self.compiled.plan(&mut self.text, time))
    }

    /// Shared handle for parallel rendering: the layout and frame planner are shared read-only and can be moved to another thread, where [`SharedBcf::worker`] starts each render unit.
    pub fn shared(&self) -> SharedBcf {
        SharedBcf(self.compiled.clone())
    }

    /// Entry point for CPU reference execution. Media frames are provided through an explicit host boundary. GPU callers consume [`Self::plan`] and must not substitute the flat DrawOp path for the plan that carries effects.
    pub fn render_cpu<M: FrameMedia>(
        &mut self,
        time: f64,
        media: &mut M,
    ) -> Result<tiny_skia::Pixmap> {
        self.render_cpu_width(time, media, self.compiled.renderer.width)
    }

    /// Changes only the raster resolution, keeping the author's canvas, layout and clock. Preview uses the stage width; export uses the width the final output needs (it may exceed the author's width, limited by `max_surface`).
    pub fn render_cpu_width<M: FrameMedia>(
        &mut self,
        time: f64,
        media: &mut M,
        width: u32,
    ) -> Result<tiny_skia::Pixmap> {
        if self.compiled.planner.capabilities() != &CapabilityProfile::cpu_reference() {
            bail!("frameplan-capability-mismatch: CPU execution needs a session prepared with CPU capabilities");
        }
        self.compiled.check_width(width)?;
        let mut plan = self.plan(time)?;
        self.compiled.scale_to(&mut plan, width)?;
        execute_plan(
            &plan,
            &mut CpuExecutor::default(),
            media,
            Some(&self.surfaces),
        )
    }
}

impl Compiled {
    fn plan(&self, text: &mut TextEngine, time: f64) -> FramePlan {
        self.planner.plan(&self.renderer, &self.ir, text, time)
    }

    fn check_width(&self, width: u32) -> Result<()> {
        if width == 0 || width > self.planner.capabilities().max_surface {
            bail!("bcf-preview-size-invalid: {width}");
        }
        Ok(())
    }

    /// Rescale an author-width plan to `width`: every surface and draw transform
    /// scales, a Transform pass only moves (its input and output both scale).
    /// Fingerprints are taken afterwards, so they already cover the size.
    fn scale_to(&self, plan: &mut FramePlan, width: u32) -> Result<()> {
        if width == self.renderer.width {
            return Ok(());
        }
        let scale = width as f32 / self.renderer.width as f32;
        let max_surface = self.planner.capabilities().max_surface;
        for surface in &mut plan.surfaces {
            surface.width = (surface.width as f32 * scale).round().max(1.0) as u32;
            surface.height = (surface.height as f32 * scale).round().max(1.0) as u32;
            if surface.width > max_surface || surface.height > max_surface {
                bail!("bcf-preview-size-invalid: surface edge length exceeds the limit");
            }
        }
        for pass in &mut plan.passes {
            if let crate::RenderPass::Transform { tf, .. } = pass {
                tf[4] *= scale;
                tf[5] *= scale;
            }
            if let crate::RenderPass::Draw { ops, .. } = pass {
                for op in &mut ops.ops {
                    use crate::drawop::DrawOp;
                    let tf = match op {
                        DrawOp::FillRect { tf, .. }
                        | DrawOp::FillPath { tf, .. }
                        | DrawOp::StrokePath { tf, .. }
                        | DrawOp::DrawMedia { tf, .. }
                        | DrawOp::ClipPath { tf, .. }
                        | DrawOp::FillPathPaint { tf, .. }
                        | DrawOp::StrokePathPaint { tf, .. }
                        | DrawOp::DrawBitmap { tf, .. } => Some(tf),
                        DrawOp::Clear { .. }
                        | DrawOp::PushLayer { .. }
                        | DrawOp::PopLayer
                        | DrawOp::PopClip
                        | DrawOp::PushMatte
                        | DrawOp::PopMatte { .. } => None,
                    };
                    if let Some(tf) = tf {
                        for component in tf {
                            *component *= scale;
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

/// Handle from [`PreparedBcf::shared`]. Cloning adds only one reference count.
#[derive(Clone)]
pub struct SharedBcf(Arc<Compiled>);

impl SharedBcf {
    pub fn ir(&self) -> &Ir {
        &self.0.ir
    }

    /// A render unit. The caller builds its text engine separately from the same fonts (`TextEngine::for_document`), the same approach as `ccut render`, which has one per worker.
    pub fn worker(&self, text: TextEngine) -> BcfFrameWorker {
        BcfFrameWorker {
            compiled: self.0.clone(),
            text,
            executor: CpuExecutor::new(self.0.planner.capabilities().clone()),
        }
    }
}

/// A parallel render unit obtained from [`SharedBcf::worker`]: CPU reference, producing the same pixels as [`PreparedBcf::render_cpu_width`]. Call [`Self::plan`] (original width) or [`Self::plan_width`] first to get the plan and frame fingerprint. The caller may reuse an existing whole frame by fingerprint; on a miss, call [`Self::execute`].
pub struct BcfFrameWorker {
    compiled: Arc<Compiled>,
    text: TextEngine,
    executor: CpuExecutor,
}

impl BcfFrameWorker {
    /// The frame plan for `time` and its surface fingerprint table (the whole-frame fingerprint is in the table's `plan.output` slot, and is also given separately as the tuple's second item).
    pub fn plan(&mut self, time: f64) -> Result<(FramePlan, u64, BTreeMap<u32, u64>)> {
        if !time.is_finite() || time < 0.0 {
            bail!("bcf-time-invalid: sample time must be a non-negative, finite number of seconds");
        }
        let plan = self.compiled.plan(&mut self.text, time);
        let (frame, fingerprints) = plan.frame_fingerprints()?;
        Ok((plan, frame, fingerprints))
    }

    /// [`Self::plan`] at `width` pixels, the same rescale as
    /// [`PreparedBcf::render_cpu_width`]; fingerprints cover the scaled plan.
    pub fn plan_width(
        &mut self,
        time: f64,
        width: u32,
    ) -> Result<(FramePlan, u64, BTreeMap<u32, u64>)> {
        if !time.is_finite() || time < 0.0 {
            bail!("bcf-time-invalid: sample time must be a non-negative, finite number of seconds");
        }
        self.compiled.check_width(width)?;
        let mut plan = self.compiled.plan(&mut self.text, time);
        self.compiled.scale_to(&mut plan, width)?;
        let (frame, fingerprints) = plan.frame_fingerprints()?;
        Ok((plan, frame, fingerprints))
    }

    /// Executes the plan given by [`Self::plan`]; `fingerprints` must be the table from the same `plan` call.
    pub fn execute<M: FrameMedia>(
        &mut self,
        plan: &FramePlan,
        fingerprints: &BTreeMap<u32, u64>,
        media: &mut M,
        surfaces: Option<&SurfaceCache>,
    ) -> Result<tiny_skia::Pixmap> {
        execute_plan_with_fingerprints(plan, &mut self.executor, media, surfaces, fingerprints)
    }
}

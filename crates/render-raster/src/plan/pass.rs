//! `RenderPass`: draw, filters, dual-frame transitions, compositing, masks and background filters.
//! DrawOp only appears in `Draw`; the other passes only process surfaces.

use super::surface::{CompositeInput, SurfaceId};
use crate::drawop::FrameOps;
use motion::effect::{EffectRef, UniformMap};

#[derive(Debug)]
pub enum RenderPass {
    /// DrawOp v3 instruction stream → a single surface.
    Draw { target: SurfaceId, ops: FrameOps },
    Filter {
        input: SurfaceId,
        output: SurfaceId,
        effect: EffectRef,
        uniforms: UniformMap,
    },
    Transition {
        from: SurfaceId,
        to: SurfaceId,
        output: SurfaceId,
        effect: EffectRef,
        /// Closed interval `[0, 1]`: at 0, byte-for-byte equal to `from`; at 1, byte-for-byte equal to `to`.
        progress: f32,
        uniforms: UniformMap,
    },
    /// Applies a rendered alpha/luma mask after the input subtree has completed.
    Mask {
        input: SurfaceId,
        mask: SurfaceId,
        output: SurfaceId,
        mode: crate::drawop::MatteMode,
    },
    Backdrop {
        base: SurfaceId,
        filtered: SurfaceId,
        mask: SurfaceId,
        output: SurfaceId,
        opacity: f32,
    },
    Transform {
        input: SurfaceId,
        output: SurfaceId,
        tf: crate::drawop::Mat6,
    },
    Accumulate {
        inputs: Vec<(SurfaceId, f64)>,
        output: SurfaceId,
    },
    Composite {
        inputs: Vec<CompositeInput>,
        output: SurfaceId,
    },
}

impl RenderPass {
    pub fn output(&self) -> SurfaceId {
        match self {
            RenderPass::Draw { target, .. } => *target,
            RenderPass::Filter { output, .. }
            | RenderPass::Transition { output, .. }
            | RenderPass::Accumulate { output, .. }
            | RenderPass::Transform { output, .. }
            | RenderPass::Backdrop { output, .. }
            | RenderPass::Mask { output, .. }
            | RenderPass::Composite { output, .. } => *output,
        }
    }

    /// Input surfaces this pass depends on (excluding its own output). The fingerprint and topology validation both use it.
    pub fn inputs(&self) -> Vec<SurfaceId> {
        match self {
            RenderPass::Draw { .. } => Vec::new(),
            RenderPass::Filter { input, .. } | RenderPass::Transform { input, .. } => vec![*input],
            RenderPass::Transition { from, to, .. } => vec![*from, *to],
            RenderPass::Backdrop {
                base,
                filtered,
                mask,
                ..
            } => vec![*base, *filtered, *mask],
            RenderPass::Mask { input, mask, .. } => vec![*input, *mask],
            RenderPass::Accumulate { inputs, .. } => inputs.iter().map(|(id, _)| *id).collect(),
            RenderPass::Composite { inputs, .. } => inputs
                .iter()
                .flat_map(|input| std::iter::once(input.surface).chain(input.mask.into_iter()))
                .collect(),
        }
    }

    /// Stable label for encoding and diagnostics.
    pub fn tag(&self) -> u8 {
        match self {
            RenderPass::Draw { .. } => 0,
            RenderPass::Filter { .. } => 1,
            RenderPass::Transition { .. } => 2,
            RenderPass::Composite { .. } => 3,
            RenderPass::Mask { .. } => 4,
            RenderPass::Backdrop { .. } => 5,
            RenderPass::Transform { .. } => 6,
            RenderPass::Accumulate { .. } => 7,
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            RenderPass::Draw { .. } => "draw",
            RenderPass::Filter { .. } => "filter",
            RenderPass::Transition { .. } => "transition",
            RenderPass::Composite { .. } => "composite",
            RenderPass::Mask { .. } => "mask",
            RenderPass::Backdrop { .. } => "backdrop",
            RenderPass::Transform { .. } => "transform",
            RenderPass::Accumulate { .. } => "accumulate",
        }
    }

    /// The effect this pass references (`Draw` and `Composite` do not have one).
    pub fn effect(&self) -> Option<&EffectRef> {
        match self {
            RenderPass::Filter { effect, .. } | RenderPass::Transition { effect, .. } => {
                Some(effect)
            }
            _ => None,
        }
    }
}

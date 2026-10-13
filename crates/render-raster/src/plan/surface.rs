//! Surface and Composite inputs (design §6.1).

use crate::drawop::Color4;
use motion::effect::{BlendMode, ColorContract};

/// Surface identifier. `FramePlan::surfaces` is sorted by id ascending (enforced by `validate`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SurfaceId(pub u32);

impl SurfaceId {
    /// The single output surface of the folded plan.
    pub const OUTPUT: SurfaceId = SurfaceId(0);
}

/// Surface lifecycle.
///
/// * `Static`: may be kept across frames (both sides of a transition, a static background plate);
/// * `PerFrame`: rebuilt every frame;
/// * `External`: **content is supplied directly by the caller**, and no pass in the plan produces it. Used when "there is already a finished pixmap, and an effect chain should run on it": it is taken directly as input, rather than blitted into a surface first (a blit may alter bytes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum SurfaceLifetime {
    Static,
    #[default]
    PerFrame,
    External,
}

impl SurfaceLifetime {
    pub fn code(self) -> u8 {
        match self {
            SurfaceLifetime::Static => 0,
            SurfaceLifetime::PerFrame => 1,
            SurfaceLifetime::External => 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SurfacePlan {
    pub id: SurfaceId,
    pub width: u32,
    pub height: u32,
    pub color: ColorContract,
    /// Clear color before execution (non-premultiplied RGBA, 0..1). `None` = fully transparent zero buffer.
    pub clear: Option<Color4>,
    pub lifetime: SurfaceLifetime,
}

impl SurfacePlan {
    /// A per-frame sRGB/u8 surface at canvas size. The only shape in use in v1.
    pub fn canvas(id: SurfaceId, width: u32, height: u32) -> Self {
        SurfacePlan {
            id,
            width,
            height,
            color: ColorContract::SRGB_U8,
            clear: None,
            lifetime: SurfaceLifetime::PerFrame,
        }
    }

    /// A canvas-sized surface supplied directly by the caller.
    pub fn external(id: SurfaceId, width: u32, height: u32) -> Self {
        SurfacePlan {
            lifetime: SurfaceLifetime::External,
            ..SurfacePlan::canvas(id, width, height)
        }
    }

    pub fn bytes(&self) -> usize {
        self.width as usize * self.height as usize * 4
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompositeInput {
    pub surface: SurfaceId,
    pub blend: BlendMode,
    pub opacity: f32,
    /// Optional alpha mask surface (used by `mask.*` in stage 4B).
    pub mask: Option<SurfaceId>,
}

impl CompositeInput {
    pub fn opaque(surface: SurfaceId) -> Self {
        CompositeInput {
            surface,
            blend: BlendMode::Normal,
            opacity: 1.0,
            mask: None,
        }
    }
}

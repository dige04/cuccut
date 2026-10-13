/*!
 * ccut-render —— host side: resource loading (sha256 verification / image decoding / media probing), text engine (cosmic-text, with strict mode for document fonts), DrawOp frame instruction IR (deterministic binary encoding + fingerprint), tiny-skia rasterization replay, media frame supply (sequential video decoding), audio mixing, and ffmpeg pipe MP4 composition. core stays free of I/O; this crate owns all bytes and processes.
 */

// ── Feature gate for the element plan §9.1 / §10 P6a.
//
// The gate is keyed on **`target_arch = "wasm32"`** rather than on “`wasm-safe` and `media` are mutually exclusive”, because of cargo's **feature unification**: `cargo build --workspace` unions the features of the same `ccut-render` crate across `apps/cli` (which needs `media`) and `ccut-wasm` (which needs `wasm-safe`). A pure feature-level mutual-exclusion assertion would fail the whole workspace build, yet that build has no wasm target at all, and having both features enabled together is harmless (`media` is a superset, and `wasm-safe` itself opens nothing).
//
// Only one thing really needs guarding: **keep the ffmpeg subprocess / host SVG decoding out of the browser build**. The BCF document layout, recording and frame planning are shared implementations with no I/O, so they are available to WASM as well.
#[cfg(all(target_arch = "wasm32", feature = "media"))]
compile_error!(
    "wasm32 目标不得打开 ccut-render 的 `media`（ffmpeg 子进程 / host resvg）：\
     用 `--no-default-features --features wasm-safe`"
);
#[cfg(all(target_arch = "wasm32", feature = "gpu"))]
compile_error!(
    "wasm32 目标不得打开 ccut-render 的 native `gpu`；R3 浏览器产物请用 \
     `gpu-webgpu` / `gpu-webgl`（两者合开即 `gpu-web`）"
);

// v3: the dependencies of `program` and GPU are not declared (see the header of Cargo.toml), so the features are only placeholders. When they are enabled, give a readable reason here rather than a string of “crate not found” errors.
#[cfg(feature = "program")]
compile_error!(
    "render-raster 的 `program` 不可用：它要的 ccut-compile（BCF 编译，oxc + rquickjs）\
     不移植（架构设计 §13.6），v3 的代码画面走代码包（§8）"
);
#[cfg(any(feature = "gpu-runtime", feature = "wgsl-validate"))]
compile_error!(
    "render-raster 的 GPU feature 尚不可用：wgpu / naga / pollster 待 GPU 合成那一批引入"
);

#[cfg(feature = "media")]
pub mod assets;
#[cfg(feature = "media")]
pub mod audio;
pub mod bcf;
pub mod drawop;
pub mod effects;
#[cfg(feature = "media")]
pub mod exec;
pub mod fonts;
pub mod imgcmp;
#[cfg(feature = "media")]
pub mod media;
pub mod motion_blur;
pub mod plan;
#[cfg(feature = "program")]
pub mod program;
// When `program` is not enabled, `program` assets fail at load time and `LoadedAssets::programs` is always empty. Here we keep only a value-less `ProgramSource`, so the branch in frame supply (`media.rs`) that looks up `programs` still compiles as written and simply never matches.
#[cfg(all(feature = "media", not(feature = "program")))]
#[path = "program_absent.rs"]
pub mod program;
pub mod raster;
pub mod renderer;
pub mod source;
#[cfg(feature = "svg")]
pub mod svg;
#[cfg(feature = "media")]
pub mod video;

#[cfg(feature = "media")]
pub use assets::{LoadedAssets, load_assets, load_assets_with_vars};
pub use bcf::{BcfFrameWorker, PreparedBcf, SharedBcf};
pub use drawop::{FrameOps, decode, encode, fingerprint};
pub use fonts::{
    GlyphAtlasRender, GlyphColorImage, GlyphMaskImage, GlyphRender, TextEngine, warm_system_fonts,
};
#[cfg(feature = "media")]
pub use media::MediaStore;
#[cfg(feature = "gpu-runtime")]
pub use plan::GpuExecutor;
#[cfg(feature = "wgsl-validate")]
pub use plan::validate_wgsl;
pub use plan::{
    AudioTexture, CapabilityProfile, CpuExecutor, EffectRef, FRAME_PLAN_VERSION, FallbackRecord,
    FramePlan, FramePlanner, GpuBackendReport, GpuFallbackReason, GpuFallbackRecord, PassExecutor,
    PreflightDiagnostic, PreflightReport, QuadUniforms, RenderPass, ShaderDomain, ShaderQuad,
    ShaderSource, SurfaceCache, SurfaceId, SurfaceLifetime, SurfacePlan, execute_plan,
    execute_plan_with_fingerprints, execute_plan_with_inputs, shader_for,
};

/// Re-export of naga (the `wgsl-validate` feature, which `gpu` brings along).
///
/// The static shader validation tests live in `tests/`, and Cargo's dev-dependencies cannot follow this crate's features. Re-exporting from here means the tests use the same naga version as the library, so validation and translation targets cannot drift apart because of version mismatches in two places.
#[cfg(feature = "wgsl-validate")]
pub use naga;
pub use raster::{FrameMedia, rasterize_with_media};
pub use source::{
    AnimatedImage, ContentHash, MediaTime, PrepareCtx, SourceFrame, SourceKind, SourceLoop,
    SourceMetadata, VisualSource,
};

/// Re-export of the caption entrance pose recipe (`transition.caption.*@1`). Same reason as the two value types in `effects`: the host side (`apps/cli`) depends only on `ccut-render`, and does not need an extra `ccut-motion` edge just to obtain one recipe.
pub use motion::preset_registry::{
    CaptionChannel, CaptionTransitionRecipe, caption_transition, caption_transitions,
};
pub use renderer::{FrameLayer, FrameRenderer, RecordedFrame};

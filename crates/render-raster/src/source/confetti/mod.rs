//! Drawing kernel for the confetti particle element, an algorithmic element (design doc `docs/design/elements/ccut-confetti-element-design.md` §4–§5).
//!
//! Three submodules each own one thing:
//!
//! * [`kernel`]: the `confetti-v1` closed-form motion kernel, parameters → particle table, a pure function with no state;
//! * [`shapes`]: paths for the twelve unit shapes;
//! * [`draw`]: [`draw::confetti_frame`], which compresses the particle table into `ClipPath + FillPath × N + PopClip`.
//!
//! Same discipline as visualizer and progress: **carries no style parameters of its own**. The numbers for the ten recipes live in
//! `core/presets/builtin/confetti/*.json`.

pub mod draw;
pub mod kernel;
pub mod shapes;

pub use draw::{
    ConfettiBox, ConfettiEmitOverride, ConfettiParams, confetti_frame, confetti_particles,
};
pub use kernel::{EmitMode as ConfettiEmitMode, splitmix64_unit};
pub use shapes::{ConfettiShape, unit_path as confetti_unit_path};

//! Drawing of the progress element (element plan §7.4).
//!
//! Progress has **no media source**. Its content is entirely derived from the playhead: a pure function of `progress = clamp((t − start) / (end − start), 0, 1)`. The source of truth is `ccut_timeline::geometry::progress_at`. `ccut-render` does not depend on `ccut-timeline`, so the host computes the value and passes it in, consistent with [`crate::source::VisualizerParams`]. For this reason the module differs from the neighboring `visualizer`: it has **no trait**, only one pure drawing function, [`progress_frame`].
//!
//! P3 delivers 6 styles: `bar-v1` (`normal` / `rounded`), `frame-v1` (`border` / `reverse_border`), and `ring-v1` (`circle` / `donut`). P4 delivers `snake-v1` (`snake` / `snake_spin`). The rainbow and strobe styles (four of them) are P5.

pub mod draw;
pub(crate) mod recipes;

pub use draw::{ProgressBox, ProgressParams, progress_frame};

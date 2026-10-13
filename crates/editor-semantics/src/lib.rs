//! CucCut's editing semantics (architecture design §13.1 `crates/editor-semantics`): time types, decimal seconds,
//! frame quantization and mapping. Pure functions with no state that do not touch files; the video engine and the future WASM prediction share it.

pub mod ratio;
pub mod time;

pub use ratio::Ratio;
pub use time::*;

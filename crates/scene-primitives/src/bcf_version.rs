//! Version constants of BCF documents.
//!
//! v2 lives in the `versions` module of `ccut-protocol/src/version.rs`. This crate uses only these two, does not port `ccut-protocol`, and copies the original values here. `migrate` still exports them under their original public names.

/// BCF (the `bcf` field of `main.ccut.tsx`): reads 0.1/0.2, writes 0.2.
pub const BCF_SUPPORTED: &[&str] = &["0.1", "0.2"];
pub const BCF_CURRENT: &str = "0.2";

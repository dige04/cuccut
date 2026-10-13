//! Exception types that the upstream Python frontend raises on malformed input. The Rust side returns errors of the same kind, and parity checks compare them by type name.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PyError {
    /// `ValueError` (e.g. `int("5,0")`).
    Value,
    /// inflect `NumOutOfRangeError` (value above decillion).
    NumOutOfRange,
    /// `IndexError`。
    Index,
    /// `KeyError` (e.g. a phoneme that is not in the symbol table).
    Key,
    /// torch `RuntimeError` (e.g. `torch.cat` on an empty list).
    Runtime,
}

impl PyError {
    /// Python exception class name.
    pub fn name(self) -> &'static str {
        match self {
            Self::Value => "ValueError",
            Self::NumOutOfRange => "NumOutOfRangeError",
            Self::Index => "IndexError",
            Self::Key => "KeyError",
            Self::Runtime => "RuntimeError",
        }
    }
}

impl fmt::Display for PyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.name())
    }
}

impl std::error::Error for PyError {}

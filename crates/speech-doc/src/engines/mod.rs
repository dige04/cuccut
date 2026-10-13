//! LLM stage engine registry: a unified lifecycle of “send call → receive answer → validate → apply”.
//!
//! Each engine has zero I/O, zero network and zero clock: the LLM is injected via [`crate::llm::LlmJson`], and the sleep for retry backoff is injected by the host closure. All engine logic can be tested offline with [`crate::llm::FakeLlm`].

pub mod align;
pub mod brief;
pub mod broll;
pub mod chapters;
pub mod cleanup;
pub mod markers;
pub mod polish;
pub mod segment;
pub mod speaker_names;
pub mod speaker_repair;
pub mod translate;

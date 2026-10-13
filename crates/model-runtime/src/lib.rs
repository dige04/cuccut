//! Public library for CucCut local inference (architecture design §6.5–§6.6, Model Worker protocol specification).
//!
//! Parts not tied to a capability: the protocol and message types ([`protocol`]), model bundles and file verification ([`bundle`]), parent-process watchdog ([`watchdog`]), backend abstraction ([`backend`]), audio decoding ([`audio`]), seconds-to-tick conversion ([`ticks`]), output contract and writing ([`asr_result`]), scheduling priority of the inference thread ([`priority`]), and system memory pressure ([`pressure`]).
//! The pure logic for speech recognition is in [`speech`], orchestration of a single `transcribe` job is in [`transcribe`], and speaker diarization of an existing transcript (`diarize`) is in [`diarize`].
//! Local speech synthesis (the TTS engines and the text, voice and WAV parts they share) is in [`synthesize`]. Local text-to-image (Qwen-Image and the job orchestration for the `image` capability) is in [`image`].
//!
//! The MLX modules are compiled only with `backend-mlx` on macOS Apple Silicon. On other platforms the whole crate still compiles; only the backend reports itself as unavailable. The candle backend (`backend-candle`, optional `cuda`) compiles on all platforms; the GPU switch is in [`gpu_env`].

pub mod asr_result;
pub mod audio;
pub mod backend;
pub mod bundle;
pub mod diarize;
pub mod gpu_env;
pub mod image;
pub mod pressure;
pub mod priority;
pub mod protocol;
pub mod separate;
pub mod speech;
pub mod synthesize;
pub mod ticks;
pub mod transcribe;
pub mod watchdog;

/// Worker version: the crate version.
pub const WORKER_VERSION: &str = env!("CARGO_PKG_VERSION");
/// `workerContractVersion`。
pub const CONTRACT_VERSION: u64 = 1;
/// Input sample rate of the speech model.
pub const SAMPLE_RATE: u32 = 16_000;

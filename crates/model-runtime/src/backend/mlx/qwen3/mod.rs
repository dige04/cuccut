//! MLX implementation of Qwen3-ASR (0.6B / 1.7B). The base layers (`Dense`, `LayerNorm`, `QuantizedDense`, `gelu_same_dtype`)
//! are exported as in v2, for reuse by batches such as Whisper, MOSS and local speech synthesis.

mod audio_encoder;
mod layers;
mod model;
mod text_decoder;
mod weights;

pub use audio_encoder::{AudioEncoderConfig, Qwen3AudioEncoder};
pub use layers::{Dense, LayerNorm, QuantizedDense, gelu_same_dtype};
pub use model::{Qwen3Asr, Qwen3Config, TokenizerFiles};
pub use text_decoder::{KvCache, TextDecoder, TextDecoderConfig};
pub use weights::WeightStore;

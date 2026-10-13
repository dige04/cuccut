//! Model graph shared by IndexTTS2 / IndexTTS 2.5 (the directory name is inherited from the MLX origin; the tensor backend is dispatched by `synthesize::tensor`).

pub mod bigvgan;
pub mod campplus;
pub mod conditioning;
pub mod engine_impl;
pub mod engine_v25;
pub mod gpt;
pub mod layers;
pub mod s2mel;
pub mod semantic_codec;
pub mod v25_weights;
pub mod w2v_bert;
pub mod weights;

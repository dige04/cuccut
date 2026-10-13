//! IndexTTS 2.5 pure logic: tiktoken multilingual tokenizer and text frontend.
//!
//! Text-side changes from 2.0 to 2.5: the vocabulary is swapped for a 60,509-entry tiktoken (including special tokens for language, audio events, timestamps, etc.), each text segment gets a `<|lang|> ` prefix and is split by a GPT position budget, and the language id is also added to every text position via `lang_embedding`. The model graph in the `mlx` module is shared with 2.0.

pub mod frontend;
pub mod tiktoken;

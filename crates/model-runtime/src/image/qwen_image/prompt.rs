//! Inputs to the text encoder: the text-to-image prompt template and tokenization. Pure logic, compiles on all platforms.
//!
//! Tokenization: v2 uses the HF `tokenizers` crate to read `processor/tokenizer.json`. Here the pure-Rust Qwen2 BPE from OmniVoice is reused ([`crate::synthesize::omnivoice::tokenizer::Tokenizer`], same `tokenizer.json` format: added tokens are split out first, NFC, the Qwen2 pre-tokenization regex, byte-level BPE, no BOS or EOS added), so no separate tokenizer library is pulled in for it. Its error messages carry the word “OmniVoice”, but it is actually reading this tokenizer vocabulary.

use anyhow::Result;
use std::path::Path;

use crate::synthesize::omnivoice::tokenizer::Tokenizer;

/// The pipeline's system prompt. The segment of the encoder output for it ([`Prompter::drop_idx`] tokens) is dropped.
pub const SYSTEM: &str = "<|im_start|>system\nComprehend and analyze the provided prompt.<|im_end|>\n";

pub struct Prompter {
    tokenizer: Tokenizer,
    drop_idx: usize,
}

impl Prompter {
    /// `tokenizer` is `processor/tokenizer.json`.
    pub fn load(tokenizer: &Path) -> Result<Self> {
        let tokenizer = Tokenizer::load(tokenizer)?;
        let drop_idx = tokenizer.encode(SYSTEM).len();
        Ok(Self { tokenizer, drop_idx })
    }

    pub fn drop_idx(&self) -> usize {
        self.drop_idx
    }

    /// Text-to-image template (the pipeline's `prompt_template_t2i`). An empty prompt is replaced by a single space, as in the pipeline.
    pub fn t2i_ids(&self, prompt: &str) -> Vec<u32> {
        let prompt = if prompt.is_empty() { " " } else { prompt };
        let text = format!("{SYSTEM}<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n");
        self.tokenizer.encode(&text)
    }

    pub fn added_id(&self, token: &str) -> Option<u32> {
        self.tokenizer.added_id(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Requires real weights: `mlx-community/Qwen-Image-2.1-MLX-4bit` under `CUCCUT_TEST_MODELS_DIR`.
    #[test]
    #[ignore = "needs mlx-community/Qwen-Image-2.1-MLX-4bit under CUCCUT_TEST_MODELS_DIR"]
    fn template_tokens_are_single_ids_and_the_system_prefix_is_dropped() {
        let root = std::env::var("CUCCUT_TEST_MODELS_DIR").expect("CUCCUT_TEST_MODELS_DIR");
        let path = Path::new(&root).join("mlx-community/Qwen-Image-2.1-MLX-4bit/processor/tokenizer.json");
        let prompter = Prompter::load(&path).unwrap();
        let start = prompter.added_id("<|im_start|>").expect("<|im_start|>");
        let end = prompter.added_id("<|im_end|>").expect("<|im_end|>");
        let ids = prompter.t2i_ids("a red apple on a wooden table");
        assert_eq!(ids[0], start);
        assert_eq!(ids.iter().filter(|&&id| id == start).count(), 3);
        assert_eq!(ids.iter().filter(|&&id| id == end).count(), 2);
        // The tokens of the system prefix are exactly the start of the template. After dropping drop_idx of them, it starts from the user turn.
        let system = prompter.t2i_ids("x")[..prompter.drop_idx()].to_vec();
        assert_eq!(&ids[..prompter.drop_idx()], &system[..]);
        assert_eq!(ids[prompter.drop_idx()], start);
        assert_eq!(*system.last().unwrap(), Tokenizer::load(&path).unwrap().encode("\n")[0]);
        // As in the pipeline, an empty prompt is replaced by a single space, so the user turn is not lost.
        assert_eq!(prompter.t2i_ids("").len(), prompter.t2i_ids(" ").len());
    }
}

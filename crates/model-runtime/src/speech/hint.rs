//! The **capability table and carrier** for recognition hints (ASR initial prompt / context).
//!
//! "Whether the model can take a hint" is a property of the speech model itself, not a switch that can be flipped anywhere: the backend's self-reported
//! `hint_kind` and what this table says must be the same thing.
//!
//! Ported from v2 `ccut-speech-core`. In v2, `hint_kind` is a method of the recognition trait; in v3, [`SpeechRecognizer`](super::SpeechRecognizer) does not have it yet, and it will be added with the batch that wires in Whisper / MOSS.
//! In v2 there is a twin table with the same content in the editor's pure layer, kept in check by a cross-checking test; v3 currently has only this one.

/// **Capability gate**: the speech model decides whether it accepts hints.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HintKind {
    /// Whisper-family initial prompt, with limited length. The model reads it as **preceding text**, not as an instruction.
    Prompt,
    /// Qwen3-ASR's context text, much longer; it can say what the recording is about.
    Context,
    /// This model has no hint channel, so the switch has no effect on it; the page must say so plainly rather than pretend it takes effect.
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AsrHint {
    pub kind: HintKind,
    /// Budget (in characters). The `None` tier is 0.
    pub budget: usize,
}

impl AsrHint {
    pub fn supported(self) -> bool {
        self.kind != HintKind::None
    }
}

/// Judged per model. The criterion is written here rather than in the model catalog: the catalog says "what is installed", while this says "whether it can take it"; the two change generations at different paces.
pub fn asr_hint(model_id: &str) -> AsrHint {
    let id = model_id.to_ascii_lowercase();
    // Cloud STT ids carry a family prefix (`cloud:openai/gpt-4o-transcribe`), local ones do not;
    // take the last segment before judging, so the prefix does not take part in matching.
    let leaf = id.rsplit(['/', ':']).next().unwrap_or(id.as_str());
    // **Must not** check only for "contains -transcribe": the local `moss-transcribe-diarize` also contains it,
    // yet MOSS does not accept hints at all. The OpenAI family is the suffix form `gpt-*-transcribe`.
    let openai_transcribe = leaf.starts_with("gpt-") && leaf.ends_with("-transcribe");
    if leaf.starts_with("whisper") || openai_transcribe {
        AsrHint {
            kind: HintKind::Prompt,
            budget: PROMPT_BUDGET,
        }
    } else if leaf.contains("qwen3-asr") {
        AsrHint {
            kind: HintKind::Context,
            budget: CONTEXT_BUDGET,
        }
    } else {
        AsrHint {
            kind: HintKind::None,
            budget: 0,
        }
    }
}

/// Whisper's initial prompt takes up KV cache in the decoder, with a limit of about 224 tokens; the budget reported in characters is set conservatively at 180, leaving room for the three language/task tokens and for CJK characters that take several tokens each.
pub const PROMPT_BUDGET: usize = 180;
/// Qwen3-ASR's context is written into the system segment, which is much longer.
pub const CONTEXT_BUDGET: usize = 1_200;

/// The hint as sent to the speech backend.
///
/// `kind` records **which channel the caller assembled it for** (the budgets differ, so the assembled lengths differ); whether it is actually accepted
/// is decided by the backend's `hint_kind`, which is authoritative. A mismatch is not an error,
/// but means "this one ignores it", and the orchestration layer reports it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranscribeHint {
    pub kind: HintKind,
    pub text: String,
}

impl TranscribeHint {
    /// Assembles one according to the model id's capability; `None` when the text is empty or the model has no channel:
    /// an empty hint and "no hint given" must be indistinguishable, otherwise the backend would change decoding for a string of whitespace.
    pub fn for_model(model_id: &str, text: &str) -> Option<Self> {
        let text = text.trim();
        if text.is_empty() {
            return None;
        }
        let hint = asr_hint(model_id);
        hint.supported().then(|| Self {
            kind: hint.kind,
            text: text.to_owned(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_capability_table_reads_the_last_id_segment() {
        assert_eq!(asr_hint("whisper-large-v3").kind, HintKind::Prompt);
        assert_eq!(asr_hint("gpt-4o-transcribe").kind, HintKind::Prompt);
        assert_eq!(asr_hint("cloud:openai/gpt-4o-mini-transcribe").kind, HintKind::Prompt);
        assert_eq!(asr_hint("cloud:openai/whisper-1").kind, HintKind::Prompt);
        assert_eq!(asr_hint("qwen3-asr-0.6b").kind, HintKind::Context);
        assert_eq!(asr_hint("cloud:dashscope/qwen3-asr-flash").kind, HintKind::Context);
        // The one whose name contains "transcribe" but which does not accept hints at all.
        assert_eq!(asr_hint("moss-transcribe-diarize").kind, HintKind::None);
        assert_eq!(asr_hint("moss-transcribe-diarize").budget, 0);
    }

    #[test]
    fn an_empty_prompt_is_indistinguishable_from_no_prompt() {
        assert!(TranscribeHint::for_model("whisper-large-v3", "   \n ").is_none());
        assert!(TranscribeHint::for_model("moss-transcribe-diarize", "威科夫").is_none());
        let hint = TranscribeHint::for_model("qwen3-asr-0.6b", "  威科夫、量价  ").unwrap();
        assert_eq!(hint.kind, HintKind::Context);
        assert_eq!(hint.as_str(), "威科夫、量价");
    }
}

//! Frozen input: the JSON that the Runtime writes into staging when it starts this step (command protocol spec §4.5).

use std::path::Path;

use editor_semantics::MediaTime;
use serde::Deserialize;
use serde_json::Value;
use video_model::speech::SpeechBody;
use video_model::translation::TranslationBody;
use video_model::{Id, VersionRef};

use crate::Failure;

pub const INPUT_SCHEMA: &str = "cuccut.speech-worker.translate/1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TranslateInput {
    pub schema: String,
    pub media: Media,
    /// The `language` in the transcript document header. Null when unknown.
    pub source_language: Option<String>,
    pub speech_ref: VersionRef,
    pub sequence_id: Id,
    pub speech: SpeechBody,
    pub target_language: String,
    /// Glossary terms frozen at start (those passed in the call and those enabled in the video, deduplicated).
    #[serde(default)]
    pub glossary: Vec<GlossaryTerm>,
    /// The `glossaryRef` written verbatim into the translation body (§5.3). Null when there is no glossary.
    #[serde(default)]
    pub glossary_ref: Option<Value>,
    #[serde(default)]
    pub params: Params,
    /// The base draft for an in-place refresh: this language's existing translation (`cuccut.translation/2`). Given together with `sentences`, or both omitted.
    #[serde(default)]
    pub translation: Option<TranslationBody>,
    /// IDs of the sentences to re-translate during an in-place refresh (sentences of the subtitle and translation core). Other units in the base draft are written back as-is.
    #[serde(default)]
    pub sentences: Option<Vec<Id>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Media {
    pub asset_id: Option<Id>,
    #[serde(default)]
    pub path: Option<String>,
    pub content_hash: String,
    pub duration: MediaTime,
    #[serde(default)]
    pub sample_rate: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GlossaryTerm {
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Params {
    /// Style hint (`translate`'s `style`), passed into the core as an explicit user instruction.
    #[serde(default)]
    pub instructions: Option<String>,
    /// Multiplier for the backoff duration (default 1). Tests pass 0.
    #[serde(default = "one")]
    pub backoff_scale: f64,
}

impl Default for Params {
    fn default() -> Params {
        Params {
            instructions: None,
            backoff_scale: 1.0,
        }
    }
}

fn one() -> f64 {
    1.0
}

impl TranslateInput {
    pub fn load(path: &Path) -> Result<TranslateInput, Failure> {
        let bytes = std::fs::read(path).map_err(|error| Failure::new("INPUT_UNREADABLE", format!("读不了冻结的输入：{error}")))?;
        let input: TranslateInput =
            serde_json::from_slice(&bytes).map_err(|error| Failure::new("INPUT_UNREADABLE", format!("冻结的输入不合格式：{error}")))?;
        if input.schema != INPUT_SCHEMA {
            return Err(Failure::new("INPUT_UNREADABLE", format!("冻结的输入的 schema 应为 {INPUT_SCHEMA}")));
        }
        let lang = &input.target_language;
        if lang.is_empty() || lang.len() > 35 || !lang.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-') {
            return Err(Failure::new("INPUT_UNREADABLE", format!("目标语言不是 BCP 47 标签：{lang}")));
        }
        if !(input.params.backoff_scale >= 0.0 && input.params.backoff_scale.is_finite()) {
            return Err(Failure::new("INPUT_UNREADABLE", "params.backoffScale 应为非负数"));
        }
        match (&input.translation, &input.sentences) {
            (None, None) => {}
            (Some(base), Some(sentences)) => {
                if base.language != input.target_language {
                    return Err(Failure::new(
                        "INPUT_UNREADABLE",
                        format!("底稿译文的语言 {} 与目标语言 {lang} 不同", base.language),
                    ));
                }
                if sentences.is_empty() {
                    return Err(Failure::new("INPUT_UNREADABLE", "就地刷新至少要给一句"));
                }
            }
            _ => return Err(Failure::new("INPUT_UNREADABLE", "translation 与 sentences 要一起给")),
        }
        Ok(input)
    }
}

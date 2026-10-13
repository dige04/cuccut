//! §18 word-atom Transcript document model (ccutTranscript 0.5; read-compatible with 0.3 and 0.4).
//!
//! `words[]` is the only persisted source of text and timing. Cue, Sentence and Para are derived projections (see the `cue` and `sentence` modules). Structural interventions by the user and the AI are kept in sparse override tables keyed by word id. Changes from 0.2 to 0.3 (v0.3 design §4): `trans` changed from being keyed by Cue to **sentence-keyed truth** (`s-<first word id>` → complete natural translated sentence), and a new `transAlign` alignment-override layer was added (the display segmentation of each sentence: mode, a snapshot of the source Cue structure, and pieces).
//!
//! Changes from 0.3 to 0.4 (alignment block design §5):
//! - `autoBreaks[profile]`: automatic break pins keyed by `LayoutProfile`, from the layout optimizer, kept separate from the user's explicit `breaks` intent. On derivation, `breaks` overrides the same key.
//! - `transDisplay[lang][sid]`: subtitle translation that exists only when the “monotonic display rewrite” is triggered. The natural translation `trans` is unchanged.
//! - Entries in `transAlign` gain `blocks[]` (minimal monotonic alignment blocks), `correspondence` (`block` or `sentence`, replacing the old `crossing`), `textBasis` (whether the pieces concatenate to `trans` or `transDisplay`), and an `aligner` source tag.
//!
//! Changes from 0.4 to 0.5 (Korean space-separated word segmentation, `ccut-korean-word-spacing-design.md`):
//! - The concatenation rule changed: between Hangul and Hangul, a space is added per word ([`crate::atomize::sep_len`]). Newly created Korean transcripts have one eojeol per word.
//! - `words[].glue` (sparse): no space between this word and the previous one, however the rule judges. Korean transcripts from before 0.5 have one word per syllable. When read in, the word gaps that the new rule would open are marked ([`mark_legacy_glue`]). Word ids, override tables, fingerprints and display are unchanged. Any [`TranscriptDoc`] deserialized by any route has already gone through this step, and its version is raised to the current one at the same time. For scripts that put no spaces between words (Thai, Lao, Burmese, Khmer and Tibetan), newly created transcripts are split into words, and the gaps inside a phrase also carry this marker ([`crate::atomize::atomize_words`], `ccut-unspaced-script-segmentation-design.md`). The format is still 0.5, and existing transcripts are not migrated.

use std::collections::BTreeMap;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

/// Word atom. Field names are deliberately very short, since tens of thousands of words go into the JSON.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Word {
    /// Unique within the document and never reused once assigned. Imports use `g<row>.<column>`; edits create `w<base36ms>-<n>`.
    pub id: String,
    /// Start and end in seconds of the source media, with `t0 <= t1` and centisecond precision.
    pub t0: f64,
    pub t1: f64,
    pub text: String,
    /// Speaker id. It must exist in the `speakers` table.
    pub sp: String,
    /// “Glue to previous”: when true, this word gets no space before the previous one, however the join rule judges (since 0.5; sparse, omitted by default). Words store no whitespace. Spaces are computed each time by [`crate::atomize::sep_len`]. Where the rule gets it wrong, this flag keeps the original. Concatenation, width measurement and break decisions must all respect it ([`crate::atomize::JoinWord`]).
    #[serde(default, skip_serializing_if = "is_false")]
    pub glue: bool,
}

impl crate::atomize::JoinWord for Word {
    fn join_text(&self) -> &str {
        &self.text
    }
    fn glued(&self) -> bool {
        self.glue
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Speaker {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hue: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub title: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocMedia {
    /// Media id in the project manifest (when there is a project container).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Media path in CLI flat-project mode.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub hash: String,
    pub duration: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocEngine {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// true means the engine gave real word timestamps; false means they were synthesized by character weight.
    pub aligned_words: bool,
}

/// Per-sentence break overrides: `break` forces a break, and `nobreak` suppresses the default break.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BreakOverride {
    Break,
    Nobreak,
}

/// Alignment strategy (v0.3 §5): how the translation within a sentence is split into display lines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlignMode {
    /// Separate alignment: the translation is split into lines by the target language's own habits, with no correspondence to source Cues (zero LLM).
    #[serde(rename = "independent")]
    Independent,
    /// Many-to-one: translation pieces are anchored to contiguous source word ranges. Source Cues only decide independent line breaks. **The default strategy.**
    #[serde(rename = "manyToOne")]
    ManyToOne,
    /// Legacy forced one-to-one source-Cue mode, kept only to read old projects. New alignments no longer generate it.
    #[serde(rename = "oneToOne")]
    OneToOne,
}

/// A translation display piece. For manyToOne, `from..=to` is the range of source word indexes within the sentence. independent has none; it is usually anchored to the edges of the sentence's words by character proportion, and when there are more pieces than source words, they are timed by reading length within the sentence's whole word window. Legacy Cue-anchored pieces are kept only for backward-compatible deserialization and are no longer treated as valid alignments.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TransPiece {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<usize>,
    pub text: String,
}

/// Bilingual correspondence granularity (alignment block design §4.5 and §5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Correspondence {
    /// The semantic correspondence of each translation piece to its `from..=to` source word range. Piece boundaries fall only on alignment block boundaries.
    Block,
    /// Guarantees only whole-sentence correspondence. The source and translation share the whole sentence's time window, and per-piece correspondence is not claimed.
    Sentence,
}

/// Which translation text the concatenation of `pieces` equals.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TextBasis {
    /// Natural translated sentence `trans[lang][sid]` (the default).
    #[default]
    Trans,
    /// Monotonic display rewrite `transDisplay[lang][sid].text`.
    Display,
}

/// Minimal monotonic alignment block (alignment block design §4.3). The source side `src = (from, to)` is a closed interval of word order within the sentence, in the same index space as `TransPiece.from/to` and pointing to `TransAlign.words`. The target side `tgt = (from, to)` is a half-open character interval over `concat(pieces.text)`. Blocks are monotonic in order, do not overlap, and cover continuously. Within a block, many-to-many and local reordering are allowed.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlignBlock {
    pub src: (usize, usize),
    pub tgt: (usize, usize),
    /// The minimum weight of the alignment edges that support the two boundaries of the block. Default means unknown or deterministic construction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
    /// `local-reorder` (a crossing edge exists within the block), `anchor` (contains hard anchors), `weak` (soft edges only), and so on.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub flags: Vec<String>,
}

/// Monotonic display rewrite (alignment block design §4.5 and §6.3): a translated sentence rewritten in source-language order to meet the subtitle hard limit. It exists only when a rewrite is triggered. `trans` remains the truth for the natural translation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransDisplay {
    pub text: String,
    /// Rewrite source tag, such as `monotonic-rewrite`.
    pub basis: String,
    /// Text fingerprint of the `trans` that the rewrite was based on. A mismatch ⇒ `display-stale` (the rewrite is deleted and the sentence is realigned).
    pub trans_fingerprint: String,
}

/// Alignment override layer for one translated sentence (v0.3 §4; the 0.4 additions are described in the module docs). Invariants (a violation ⇒ align-stale, and the display falls back to showing the whole sentence): `normalize(concat(pieces.text)) == normalize(base text)`, where the base text is set by `text_basis`. For manyToOne, `words` is either the complete ordered word sequence of the current sentence, or an ordered subsequence of visible words after a timeline cut. Anchored pieces' from/to must be contiguous, non-overlapping and cover `words`. When `blocks` is non-empty, every piece boundary must fall on a block boundary. independent may use the same `words` subsequence to limit its display window, and an empty array still means the whole sentence. The translation flow does not depend on the source Cue structure.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransAlign {
    pub mode: AlignMode,
    /// Legacy word-order crossing flag, kept only for reading projects that were already generated. On read it is interpreted as `correspondence = sentence` (see [`TransAlign::correspondence`]). New alignments always write false, and this field no longer relaxes the hard limit on target pieces. A missing field is read as false.
    #[serde(default, skip_serializing_if = "is_false")]
    pub crossing: bool,
    /// Legacy source-Cue snapshot, kept only for reading historical projects. New writes always leave it empty, and validation does not read it.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cues: Vec<String>,
    /// Snapshot of the source word ids within the sentence for manyToOne. An empty array or a missing field means there is no word anchor or it is a legacy Cue entry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub words: Vec<String>,
    /// Explicit correspondence granularity. When absent, it is derived from mode and crossing ([`TransAlign::correspondence`]).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correspondence: Option<Correspondence>,
    /// Which text the concatenation of `pieces` equals. Defaults to `trans`.
    #[serde(default, skip_serializing_if = "text_basis_is_trans")]
    pub text_basis: TextBasis,
    /// Alignment edge source tag (such as `llm-chunk+anchor/1` or `deterministic/1`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligner: Option<String>,
    /// Minimal monotonic alignment blocks. Empty means there is no block layer (legacy entries or independent), in which case each piece counts as one block.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub blocks: Vec<AlignBlock>,
    pub pieces: Vec<TransPiece>,
}

impl TransAlign {
    /// Minimal construction of a newly written entry: no legacy fields, no block layer, and `trans` as the default base.
    pub fn new(mode: AlignMode, words: Vec<String>, pieces: Vec<TransPiece>) -> Self {
        Self {
            mode,
            crossing: false,
            cues: Vec::new(),
            words,
            correspondence: None,
            text_basis: TextBasis::Trans,
            aligner: None,
            blocks: Vec::new(),
            pieces,
        }
    }

    /// The effective correspondence granularity. An explicit field takes priority. Otherwise, legacy `crossing`, `independent` and entries without word anchors guarantee only whole-sentence correspondence, and the remaining word-anchored manyToOne entries correspond by block.
    pub fn correspondence(&self) -> Correspondence {
        if let Some(explicit) = self.correspondence {
            return explicit;
        }
        if self.crossing || self.mode != AlignMode::ManyToOne || self.words.is_empty() {
            Correspondence::Sentence
        } else {
            Correspondence::Block
        }
    }
}

fn text_basis_is_trans(value: &TextBasis) -> bool {
    *value == TextBasis::Trans
}

/// Stage stamp (§3.3). See the rules table in the pipeline design for who writes it, who reads it, and when it expires.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stages {
    /// Content fingerprint: the text at the time transcription completed. A mismatch ⇒ a manual text edit exists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asr: Option<String>,
    /// Layout fingerprint: sorted serialization of breaks, paraBreaks and hidden. A mismatch ⇒ a manual layout intervention exists.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asr_layout: Option<String>,
    /// Content fingerprint: at the time the polish was submitted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polish: Option<String>,
    /// Structural fingerprint (ids): at the time the segments were submitted. Pure text polish does not expire it; re-transcription does.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segment: Option<String>,
    /// Content fingerprint: at the time the chapters were submitted.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chapters: Option<String>,
    /// Script alignment stamp (`ccut transcribe --script`): the word timings come from forced alignment rather than ASR. Re-transcription (ASR) does not carry this item.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aligned: Option<AlignedStage>,
}

/// `stages.aligned`: `mode` currently only has `script`. `coverage` is the proportion of script characters aligned to a valid duration (≥ 20 ms). `lowConfidence` lists the ids of words whose duration collapsed to 0, for the Agent to review.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlignedStage {
    pub mode: String,
    pub coverage: f64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub low_confidence: Vec<String>,
}

impl Stages {
    pub fn is_empty(&self) -> bool {
        self == &Stages::default()
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// Whether a transcript of this version predates the “glue to previous” marker (0.5). On read, the markers must be added under the old join rule.
fn predates_glue(version: Option<&str>) -> bool {
    version.is_some_and(|version| {
        version != TRANSCRIPT_VERSION && SUPPORTED_TRANSCRIPT_VERSIONS.contains(&version)
    })
}

/// For each word in a transcript from before 0.5, whether it should carry a “glue to previous” marker, given in word order.
///
/// The criterion is [`crate::atomize::legacy_glue`]: a word gap that the old rule leaves unspaced but the new rule would space. A visible word is compared with **the nearest visible word before it**. Display, export and the text sent to the model are all built from visible words, so the text is identical before and after migration. A hidden word is compared with the word immediately before it. Known trade-off: when a hidden word that does not end in Hangul (a comma-marked interjection, a Latin word) sits between two Hangul words, the marker records “attached while hidden”. Once that word is shown again, the space after it goes missing.
fn legacy_glue_flags<'a>(words: impl Iterator<Item = (&'a str, bool)>) -> Vec<bool> {
    let mut flags = Vec::new();
    let mut previous: Option<&str> = None;
    let mut previous_visible: Option<&str> = None;
    for (text, hidden) in words {
        let against = if hidden { previous } else { previous_visible };
        flags.push(against.is_some_and(|against| crate::atomize::legacy_glue(against, text)));
        previous = Some(text);
        if !hidden {
            previous_visible = Some(text);
        }
    }
    flags
}

/// Adds “glue to previous” markers to words in transcripts created before 0.5. Existing markers are kept. `hidden` is the transcript's hidden table.
pub fn mark_legacy_glue(words: &mut [Word], hidden: &BTreeMap<String, bool>) {
    let flags = legacy_glue_flags(words.iter().map(|word| {
        (
            word.text.as_str(),
            hidden.get(&word.id).copied().unwrap_or(false),
        )
    }));
    for (word, flag) in words.iter_mut().zip(flags) {
        word.glue |= flag;
    }
}

/// The JSON version of [`mark_legacy_glue`], for upgrade paths that bypass [`TranscriptDoc`] and rewrite `transcript.json` directly. It only touches `words[]` when the transcript version is earlier than 0.5, and returns the number of newly marked words. The caller rewrites the version number.
pub fn mark_legacy_glue_in_json(value: &mut serde_json::Value) -> usize {
    if !predates_glue(value["ccutTranscript"].as_str()) {
        return 0;
    }
    let flags = json_legacy_glue_flags(value);
    let Some(words) = value["words"].as_array_mut() else {
        return 0;
    };
    let mut marked = 0;
    for (word, flag) in words.iter_mut().zip(flags) {
        if flag
            && word["glue"].as_bool() != Some(true)
            && let Some(word) = word.as_object_mut()
        {
            word.insert("glue".to_owned(), serde_json::Value::Bool(true));
            marked += 1;
        }
    }
    marked
}

fn json_legacy_glue_flags(value: &serde_json::Value) -> Vec<bool> {
    let hidden = &value["hidden"];
    let words = value["words"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default();
    legacy_glue_flags(words.iter().map(|word| {
        (
            word["text"].as_str().unwrap_or_default(),
            word["id"]
                .as_str()
                .and_then(|id| hidden[id].as_bool())
                .unwrap_or(false),
        )
    }))
}

/// Takes each word's “glue to previous” marker from the transcript JSON's `words[]`, in array order, without filtering any element. For callers that read the JSON directly to build text without deserializing into [`TranscriptDoc`]. Transcripts from before 0.5 do not store markers, so they are computed on the fly under the same rule as [`mark_legacy_glue`].
pub fn word_glue_flags(value: &serde_json::Value) -> Vec<bool> {
    let stored = value["words"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(|item| item["glue"].as_bool().unwrap_or(false))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if !predates_glue(value["ccutTranscript"].as_str()) {
        return stored;
    }
    stored
        .into_iter()
        .zip(json_legacy_glue_flags(value))
        .map(|(stored, legacy)| stored || legacy)
        .collect()
}

// `remote = "Self"`: derive generates an inherent function of the same name, and the trait implementation is written below. After deserialization, it must go through [`TranscriptDoc::adopt_current_version`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", remote = "Self")]
pub struct TranscriptDoc {
    pub ccut_transcript: String,
    pub media: DocMedia,
    /// Primary language (BCP-47).
    pub lang: String,
    pub engine: DocEngine,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    pub words: Vec<Word>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub speakers: BTreeMap<String, Speaker>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub chapters: Vec<Chapter>,

    /// The user's explicit break intent (since 0.4 it no longer carries optimizer results).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub breaks: BTreeMap<String, BreakOverride>,
    /// Layout optimizer output: `LayoutProfile` id → word id → automatic pin. When Cues are derived, it is merged with `breaks`, and `breaks` wins on the same key ([`TranscriptDoc::effective_breaks`]).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub auto_breaks: BTreeMap<String, BTreeMap<String, BreakOverride>>,
    /// The `LayoutProfile` id used by the current edit or derivation. Defaults to [`DEFAULT_LAYOUT_PROFILE`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_profile: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub para_breaks: BTreeMap<String, bool>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub hidden: BTreeMap<String, bool>,
    /// Translation truth: language → sentence id (`s-<first word id>`) → complete natural translated sentence (Phase 1).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub trans: BTreeMap<String, BTreeMap<String, String>>,
    /// Monotonic display rewrite: language → sentence id → translated sentence used for subtitles. Exists only when a rewrite has been triggered.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub trans_display: BTreeMap<String, BTreeMap<String, TransDisplay>>,
    /// Alignment override layer: language → sentence id → display segmentation (Phase 2). No entry means not aligned, which is a legal intermediate state; the display falls back to showing the whole sentence.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub trans_align: BTreeMap<String, BTreeMap<String, TransAlign>>,

    #[serde(default, skip_serializing_if = "Stages::is_empty")]
    pub stages: Stages,
    /// language → { sentence id → the source-text fingerprint of that sentence }. A mismatch ⇒ translation-stale.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub trans_src: BTreeMap<String, BTreeMap<String, String>>,

    /// Writes must go through the CLI. Direct hand edits break the fingerprints and invariants.
    #[serde(default, skip_serializing_if = "is_false")]
    pub read_only_note: bool,
}

impl Serialize for TranscriptDoc {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        Self::serialize(self, serializer)
    }
}

/// No matter where it is deserialized from (`from_json`, review candidates, `project init --transcript`), the transcript in hand already has the semantics of the current version. Glue markers have been filled in for legacy words.
impl<'de> Deserialize<'de> for TranscriptDoc {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut doc = Self::deserialize(deserializer)?;
        doc.adopt_current_version();
        Ok(doc)
    }
}

/// The transcript version currently written.
///
/// Ported from `versions::TRANSCRIPT_CURRENT` in CucCut v2 `ccut-protocol` (value unchanged).
pub const TRANSCRIPT_VERSION: &str = "0.5";
/// Readable versions: older versions are a subset of the current one (0.4 and 0.5 only add fields), and they are handled under current semantics after reading. 0.5 changed the join rule, so for legacy words, the glue markers are added on read and the original output is preserved.
///
/// Ported from `versions::TRANSCRIPT_SUPPORTED` in CucCut v2 `ccut-protocol` (value unchanged).
pub const SUPPORTED_TRANSCRIPT_VERSIONS: &[&str] = &["0.3", "0.4", TRANSCRIPT_VERSION];
/// The default `LayoutProfile` id. Its numeric value covers all the constants of the 0.3 era.
pub const DEFAULT_LAYOUT_PROFILE: &str = "default";

impl TranscriptDoc {
    pub fn new(media: DocMedia, lang: impl Into<String>, engine: DocEngine) -> Self {
        Self {
            ccut_transcript: TRANSCRIPT_VERSION.to_owned(),
            media,
            lang: lang.into(),
            engine,
            created_at: None,
            words: Vec::new(),
            speakers: BTreeMap::new(),
            chapters: Vec::new(),
            breaks: BTreeMap::new(),
            auto_breaks: BTreeMap::new(),
            layout_profile: None,
            para_breaks: BTreeMap::new(),
            hidden: BTreeMap::new(),
            trans: BTreeMap::new(),
            trans_display: BTreeMap::new(),
            trans_align: BTreeMap::new(),
            stages: Stages::default(),
            trans_src: BTreeMap::new(),
            read_only_note: false,
        }
    }

    /// The effective `LayoutProfile` id.
    pub fn layout_profile_id(&self) -> &str {
        self.layout_profile
            .as_deref()
            .unwrap_or(DEFAULT_LAYOUT_PROFILE)
    }

    /// The merged pin table used for derived Cues: `autoBreaks[profile]` is the base, and `breaks` overrides the same key. The three platforms (Rust, Swift, JS) only need to replace their reads of `breaks` in §18.5. The derivation algorithm is unchanged.
    pub fn effective_breaks(&self, profile: &str) -> BTreeMap<String, BreakOverride> {
        let mut merged = self.auto_breaks.get(profile).cloned().unwrap_or_default();
        for (id, value) in &self.breaks {
            merged.insert(id.clone(), *value);
        }
        merged
    }

    /// Layout string: a sorted serialization of breaks, paraBreaks and hidden, used by `stages.asrLayout`. It counts only user intent; `autoBreaks` is not included, so re-running the optimizer does not count as a manual layout intervention.
    pub fn layout_strings(&self) -> Vec<String> {
        let mut items = Vec::new();
        for (id, value) in &self.breaks {
            let tag = match value {
                BreakOverride::Break => "break",
                BreakOverride::Nobreak => "nobreak",
            };
            items.push(format!("b:{id}={tag}"));
        }
        for (id, value) in &self.para_breaks {
            if *value {
                items.push(format!("p:{id}"));
            }
        }
        for (id, value) in &self.hidden {
            if *value {
                items.push(format!("h:{id}"));
            }
        }
        items.sort();
        items
    }

    /// Schema and semantic validation (`transcript-word-order`, etc.).
    pub fn validate(&self) -> Result<()> {
        if !SUPPORTED_TRANSCRIPT_VERSIONS.contains(&self.ccut_transcript.as_str()) {
            // An unrecognized version is not data corruption. Most likely this CLI is older than the project. Say in one go what I support, what the project is, and where to look up who I am, so the caller does not think the transcript is broken.
            bail!(
                "不支持的 transcript 版本 {}（本 CLI 只认 {}）：这不是文件损坏，多半是当前 ccut 比项目旧；用 `ccut --json version` 核对正在运行的二进制与提交，再升级到能写出 {} 的构建",
                self.ccut_transcript,
                SUPPORTED_TRANSCRIPT_VERSIONS.join(" / "),
                self.ccut_transcript,
            );
        }
        if !self.media.duration.is_finite() || self.media.duration < 0.0 {
            bail!("media.duration 必须是非负有限数");
        }
        let mut seen = std::collections::HashSet::with_capacity(self.words.len());
        let mut previous: Option<&Word> = None;
        for (index, word) in self.words.iter().enumerate() {
            let check = |ok: bool, message: &str| -> Result<()> {
                if ok {
                    Ok(())
                } else {
                    bail!("words[{index}] ({}): {message}", word.id)
                }
            };
            check(!word.id.is_empty(), "id 不能为空")?;
            check(seen.insert(word.id.as_str()), "id 重复")?;
            check(!word.text.is_empty(), "text 不能为空")?;
            check(
                word.t0.is_finite() && word.t1.is_finite() && word.t0 >= 0.0 && word.t1 >= word.t0,
                "时间范围无效",
            )?;
            // Tolerate half-tick leaks at floating-point and centisecond rounding boundaries.
            check(
                word.t1 <= self.media.duration + 0.005,
                "词时间越出 media.duration",
            )?;
            check(
                self.speakers.contains_key(&word.sp),
                "sp 不在 speakers 表中",
            )?;
            if let Some(previous) = previous {
                check(
                    word.t0 >= previous.t0,
                    "transcript-word-order：t0 必须非降序",
                )?;
                check(
                    word.t0 >= previous.t1 - 0.005,
                    "transcript-word-order：词区间不得交叠",
                )?;
            }
            previous = Some(word);
        }
        let mut chapter_previous: Option<&Chapter> = None;
        for chapter in &self.chapters {
            if !chapter.start.is_finite() || chapter.end < chapter.start {
                bail!("chapter {} 时间区间无效", chapter.id);
            }
            if let Some(previous) = chapter_previous
                && chapter.start < previous.end
            {
                bail!("chapter {} 与前一章节交叠", chapter.id);
            }
            chapter_previous = Some(chapter);
        }
        Ok(())
    }

    /// Orphan keys in the override and translation tables that reference nonexistent word ids (warn level, `transcript-orphan-override`).
    pub fn orphan_overrides(&self) -> Vec<String> {
        let ids: std::collections::HashSet<&str> =
            self.words.iter().map(|word| word.id.as_str()).collect();
        let mut orphans = Vec::new();
        for id in self
            .breaks
            .keys()
            .chain(self.auto_breaks.values().flat_map(|table| table.keys()))
            .chain(self.para_breaks.keys())
            .chain(self.hidden.keys())
        {
            if !ids.contains(id.as_str()) {
                orphans.push(id.clone());
            }
        }
        orphans.sort();
        orphans.dedup();
        orphans
    }

    /// Deletes keys in the override table that can no longer point at the current word stream, and returns the number deleted.
    ///
    /// Text rebinding can replace word ids. If these old keys stay in the document, they cannot restore user intent, and they keep the delivery check reporting `transcript-orphan-override` forever. Callers should run this cleanup after one atomic text replacement, and before recomputing the layout fingerprint.
    pub fn prune_orphan_overrides(&mut self) -> usize {
        let ids: std::collections::HashSet<String> =
            self.words.iter().map(|word| word.id.clone()).collect();
        let auto_len = |doc: &Self| -> usize { doc.auto_breaks.values().map(BTreeMap::len).sum() };
        let before =
            self.breaks.len() + auto_len(self) + self.para_breaks.len() + self.hidden.len();
        self.breaks.retain(|id, _| ids.contains(id));
        for table in self.auto_breaks.values_mut() {
            table.retain(|id, _| ids.contains(id));
        }
        self.auto_breaks.retain(|_, table| !table.is_empty());
        self.para_breaks.retain(|id, _| ids.contains(id));
        self.hidden.retain(|id, _| ids.contains(id));
        before - (self.breaks.len() + auto_len(self) + self.para_breaks.len() + self.hidden.len())
    }

    /// Semantics for upgrading an older (still supported) transcript to the current version: adds “glue to previous” markers to word gaps that the rule change would open up, and changes the version number to [`TRANSCRIPT_VERSION`]. An unrecognized version is left as it is and rejected by [`TranscriptDoc::validate`]. Idempotent.
    fn adopt_current_version(&mut self) {
        if !predates_glue(Some(&self.ccut_transcript)) {
            return;
        }
        mark_legacy_glue(&mut self.words, &self.hidden);
        self.ccut_transcript = TRANSCRIPT_VERSION.to_owned();
    }

    /// Parses and reads under current-version semantics. Older documents only add fields and change none, so after reading, the version number is raised to [`TRANSCRIPT_VERSION`] (writing it back completes the upgrade). Legacy fields `crossing` and `cues` are kept as they are, and read-side code such as [`TransAlign::correspondence`] interprets them. Words from before 0.5 get glue markers, which are added during deserialization.
    pub fn from_json(bytes: &[u8]) -> Result<Self> {
        let doc: TranscriptDoc = serde_json::from_slice(bytes).context("解析 transcript JSON")?;
        doc.validate()?;
        Ok(doc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc_with(words: Vec<Word>) -> TranscriptDoc {
        let mut doc = TranscriptDoc::new(
            DocMedia {
                id: None,
                path: Some("talk.wav".to_owned()),
                hash: "sha256-00".to_owned(),
                duration: 100.0,
                sample_rate: Some(16_000),
            },
            "zh",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
        );
        doc.speakers.insert(
            "s1".to_owned(),
            Speaker {
                name: "S1".to_owned(),
                hue: None,
            },
        );
        doc.words = words;
        doc
    }

    fn word(id: &str, t0: f64, t1: f64) -> Word {
        Word {
            id: id.to_owned(),
            t0,
            t1,
            text: "字".to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        }
    }

    #[test]
    fn validate_accepts_touching_words_and_rejects_overlap() {
        let doc = doc_with(vec![word("g1.0", 0.0, 0.5), word("g1.1", 0.5, 1.0)]);
        doc.validate().unwrap();
        let bad = doc_with(vec![word("g1.0", 0.0, 0.6), word("g1.1", 0.5, 1.0)]);
        assert!(bad.validate().unwrap_err().to_string().contains("交叠"));
    }

    #[test]
    fn validate_rejects_unknown_speaker_and_duplicate_id() {
        let mut doc = doc_with(vec![word("g1.0", 0.0, 0.5)]);
        doc.words[0].sp = "s9".to_owned();
        assert!(doc.validate().is_err());
        let doc = doc_with(vec![word("g1.0", 0.0, 0.5), word("g1.0", 0.5, 1.0)]);
        assert!(doc.validate().unwrap_err().to_string().contains("重复"));
    }

    #[test]
    fn orphan_overrides_reports_missing_ids_only() {
        let mut doc = doc_with(vec![word("g1.0", 0.0, 0.5)]);
        doc.breaks.insert("g1.0".to_owned(), BreakOverride::Break);
        doc.para_breaks.insert("gone".to_owned(), true);
        assert_eq!(doc.orphan_overrides(), vec!["gone".to_owned()]);
    }

    #[test]
    fn prune_orphan_overrides_keeps_only_current_word_ids() {
        let mut doc = doc_with(vec![word("g1.0", 0.0, 0.5)]);
        doc.breaks.insert("g1.0".to_owned(), BreakOverride::Break);
        doc.breaks
            .insert("gone-break".to_owned(), BreakOverride::Nobreak);
        doc.para_breaks.insert("gone-para".to_owned(), true);
        doc.hidden.insert("gone-hidden".to_owned(), true);

        assert_eq!(doc.prune_orphan_overrides(), 3);
        assert_eq!(doc.breaks.len(), 1);
        assert!(doc.breaks.contains_key("g1.0"));
        assert!(doc.para_breaks.is_empty());
        assert!(doc.hidden.is_empty());
        assert!(doc.orphan_overrides().is_empty());
    }

    #[test]
    fn the_glue_flag_is_sparse_on_disk_and_round_trips() {
        let plain = Word {
            id: "w1".to_owned(),
            t0: 0.0,
            t1: 0.5,
            text: "ab".to_owned(),
            sp: "s1".to_owned(),
            glue: false,
        };
        let glued = Word {
            id: "w2".to_owned(),
            glue: true,
            ..plain.clone()
        };
        let plain_json = serde_json::to_value(&plain).unwrap();
        assert!(plain_json.get("glue").is_none(), "{plain_json}");
        let glued_json = serde_json::to_value(&glued).unwrap();
        assert_eq!(glued_json["glue"], true);
        assert_eq!(serde_json::from_value::<Word>(plain_json).unwrap(), plain);
        assert_eq!(serde_json::from_value::<Word>(glued_json).unwrap(), glued);
        let rows = serde_json::json!({"words": [plain, glued]});
        assert_eq!(word_glue_flags(&rows), [false, true]);
    }

    fn legacy_korean_json(version: &str) -> serde_json::Value {
        // Korean transcripts created before 0.5: one word per syllable, and the `~k` words were split from the same transcript word.
        let texts = [
            "저", "는", "내", "일", "iPhone", "을", "샀", "다.", "어,", "그", "래", "요",
        ];
        let words: Vec<serde_json::Value> = texts
            .iter()
            .enumerate()
            .map(|(index, text)| {
                serde_json::json!({
                    "id": format!("g1.{index}"),
                    "t0": index as f64,
                    "t1": index as f64 + 0.5,
                    "text": text,
                    "sp": "s1",
                })
            })
            .collect();
        serde_json::json!({
            "ccutTranscript": version,
            "media": {"path": "talk.wav", "hash": "sha256-00", "duration": 100.0},
            "lang": "ko",
            "engine": {"name": "test", "alignedWords": true},
            "words": words,
            "speakers": {"s1": {"name": "S1"}},
            "breaks": {"g1.4": "break"},
        })
    }

    /// When an older Korean transcript is read in, the word ids, text, timings, override tables and fingerprints are all unchanged, and only “glue to previous” markers are added. The text assembled under the new rule is identical to what it was before 0.5.
    #[test]
    fn a_pre_0_5_korean_document_reads_with_glue_and_the_same_text() {
        for version in ["0.3", "0.4"] {
            let json = legacy_korean_json(version);
            let doc = TranscriptDoc::from_json(&serde_json::to_vec(&json).unwrap()).unwrap();
            assert_eq!(doc.ccut_transcript, "0.5");
            let ids: Vec<&str> = doc.words.iter().map(|word| word.id.as_str()).collect();
            let expected_ids: Vec<String> = (0..12).map(|index| format!("g1.{index}")).collect();
            assert_eq!(ids, expected_ids);
            assert_eq!(doc.breaks.len(), 1);
            let glue: Vec<bool> = doc.words.iter().map(|word| word.glue).collect();
            assert_eq!(
                glue,
                [
                    false, true, true, true, false, false, true, true, false, false, true, true
                ]
            );
            assert_eq!(
                crate::atomize::join_word_texts(doc.words.iter()),
                "저는내일 iPhone 을샀다. 어, 그래요"
            );
            // Callers that read JSON directly get the same set of markers.
            assert_eq!(word_glue_flags(&json), glue);
            // The JSON upgrade path applies the same set of markers, and it is idempotent.
            let mut upgraded = json.clone();
            assert_eq!(mark_legacy_glue_in_json(&mut upgraded), 7);
            upgraded["ccutTranscript"] = serde_json::json!(TRANSCRIPT_VERSION);
            assert_eq!(mark_legacy_glue_in_json(&mut upgraded), 0);
            assert_eq!(word_glue_flags(&upgraded), glue);
            let reread = TranscriptDoc::from_json(&serde_json::to_vec(&upgraded).unwrap()).unwrap();
            assert_eq!(reread, doc);
            // Once written out and read back, the markers are persisted and are no longer computed from the rule.
            let written = serde_json::to_value(&doc).unwrap();
            assert_eq!(written["ccutTranscript"], "0.5");
            assert_eq!(written["words"][1]["glue"], true);
            assert!(written["words"][4].get("glue").is_none());
            assert_eq!(
                serde_json::from_value::<TranscriptDoc>(written).unwrap(),
                doc
            );
        }
        // Deserialization that bypasses `from_json` (review candidates, `project init --transcript`) also adds the markers.
        let direct: TranscriptDoc = serde_json::from_value(legacy_korean_json("0.4")).unwrap();
        assert!(direct.words[1].glue);
        assert_eq!(direct.ccut_transcript, "0.5");
    }

    /// Hidden word: a visible word is compared with the nearest visible word before it, so the displayed text is the same before and after migration.
    #[test]
    fn legacy_glue_follows_the_visible_neighbour_across_a_hidden_word() {
        let mut json = legacy_korean_json("0.4");
        // 「어,」 ("uh,") is hidden. Before 0.5, 「다.」 followed directly by a displayed 「그」 had a space between them, after the period. If 「다.」 is replaced with 「다」 without the period, the old display would be the attached 「다그」.
        json["words"][7]["text"] = serde_json::json!("다");
        json["hidden"] = serde_json::json!({"g1.8": true});
        let doc = TranscriptDoc::from_json(&serde_json::to_vec(&json).unwrap()).unwrap();
        assert!(doc.words[9].glue, "「그」贴着前一个可见词「다」");
        let visible = doc
            .words
            .iter()
            .filter(|word| !doc.hidden.contains_key(&word.id));
        assert_eq!(
            crate::atomize::join_word_texts(visible),
            "저는내일 iPhone 을샀다그래요"
        );
    }

    /// Transcripts at 0.5 no longer add markers by rule. Newly created Korean transcripts have one eojeol per word, with no markers.
    #[test]
    fn a_0_5_document_is_read_as_written() {
        let mut json = legacy_korean_json("0.5");
        let doc = TranscriptDoc::from_json(&serde_json::to_vec(&json).unwrap()).unwrap();
        assert!(doc.words.iter().all(|word| !word.glue));
        assert_eq!(word_glue_flags(&json), vec![false; 12]);
        assert_eq!(mark_legacy_glue_in_json(&mut json), 0);
        // Legacy Chinese, Japanese and English transcripts have no words carrying markers when they are read in.
        for texts in [
            vec!["你", "好，", "世", "界。"],
            vec!["他", "用", "Agent", "来", "做"],
            vec!["い", "い", "天", "気", "です。"],
            vec!["Hello,", "world."],
        ] {
            let mut json = legacy_korean_json("0.4");
            json["breaks"] = serde_json::json!({});
            json["words"] = texts
                .iter()
                .enumerate()
                .map(|(index, text)| {
                    serde_json::json!({
                        "id": format!("g1.{index}"), "t0": index as f64, "t1": index as f64 + 0.5,
                        "text": text, "sp": "s1",
                    })
                })
                .collect();
            let doc = TranscriptDoc::from_json(&serde_json::to_vec(&json).unwrap()).unwrap();
            assert!(doc.words.iter().all(|word| !word.glue), "{texts:?}");
        }
    }

    #[test]
    fn json_round_trip_preserves_overrides_and_stages() {
        let mut doc = doc_with(vec![word("g1.0", 0.0, 0.5)]);
        doc.breaks.insert("g1.0".to_owned(), BreakOverride::Nobreak);
        doc.stages.asr = Some("1:g1.0:g1.0:abc".to_owned());
        doc.trans
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), "一句译文。".to_owned());
        doc.auto_breaks
            .entry(DEFAULT_LAYOUT_PROFILE.to_owned())
            .or_default()
            .insert("g1.0".to_owned(), BreakOverride::Break);
        doc.trans_display
            .entry("zh".to_owned())
            .or_default()
            .insert(
                "s-g1.0".to_owned(),
                TransDisplay {
                    text: "译文一句。".to_owned(),
                    basis: "monotonic-rewrite".to_owned(),
                    trans_fingerprint: "fp".to_owned(),
                },
            );
        let mut entry = TransAlign::new(
            AlignMode::ManyToOne,
            vec!["g1.0".to_owned()],
            vec![TransPiece {
                from: Some(0),
                to: Some(0),
                text: "译文一句。".to_owned(),
            }],
        );
        entry.correspondence = Some(Correspondence::Block);
        entry.text_basis = TextBasis::Display;
        entry.aligner = Some("deterministic/1".to_owned());
        entry.blocks = vec![AlignBlock {
            src: (0, 0),
            tgt: (0, 5),
            confidence: Some(1.0),
            flags: vec!["anchor".to_owned()],
        }];
        doc.trans_align
            .entry("zh".to_owned())
            .or_default()
            .insert("s-g1.0".to_owned(), entry);
        let bytes = serde_json::to_vec(&doc).unwrap();
        let parsed = TranscriptDoc::from_json(&bytes).unwrap();
        assert_eq!(parsed, doc);
        let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["ccutTranscript"], "0.5");
        assert_eq!(value["breaks"]["g1.0"], "nobreak");
        assert_eq!(value["autoBreaks"]["default"]["g1.0"], "break");
        assert_eq!(
            value["transDisplay"]["zh"]["s-g1.0"]["basis"],
            "monotonic-rewrite"
        );
        assert_eq!(
            value["transDisplay"]["zh"]["s-g1.0"]["transFingerprint"],
            "fp"
        );
        let align = &value["transAlign"]["zh"]["s-g1.0"];
        assert_eq!(align["mode"], "manyToOne");
        assert!(align.get("crossing").is_none());
        assert_eq!(align["correspondence"], "block");
        assert_eq!(align["textBasis"], "display");
        assert_eq!(align["aligner"], "deterministic/1");
        assert_eq!(align["blocks"][0]["src"], serde_json::json!([0, 0]));
        assert_eq!(align["blocks"][0]["tgt"], serde_json::json!([0, 5]));
        assert_eq!(align["blocks"][0]["flags"][0], "anchor");
        assert_eq!(align["pieces"][0]["from"], 0);
        // Independent pieces do not store from/to keys. Default textBasis and correspondence values are not stored as keys.
        doc.trans_align.get_mut("zh").unwrap().insert(
            "s-g1.0".to_owned(),
            TransAlign::new(
                AlignMode::Independent,
                Vec::new(),
                vec![TransPiece {
                    from: None,
                    to: None,
                    text: "一句译文。".to_owned(),
                }],
            ),
        );
        let value: serde_json::Value =
            serde_json::from_slice(&serde_json::to_vec(&doc).unwrap()).unwrap();
        let align = &value["transAlign"]["zh"]["s-g1.0"];
        assert_eq!(align["mode"], "independent");
        for absent in [
            "cues",
            "crossing",
            "correspondence",
            "textBasis",
            "aligner",
            "blocks",
        ] {
            assert!(align.get(absent).is_none(), "{absent} 不应落键");
        }
        assert!(align["pieces"][0].get("from").is_none());
    }

    #[test]
    fn legacy_0_3_document_reads_as_current_and_crossing_means_sentence_correspondence() {
        let json = serde_json::json!({
            "ccutTranscript": "0.3",
            "media": {"path": "talk.wav", "hash": "sha256-00", "duration": 100.0},
            "lang": "en",
            "engine": {"name": "test", "alignedWords": true},
            "words": [{"id": "g1.0", "t0": 0.0, "t1": 0.5, "text": "hi", "sp": "s1"}],
            "speakers": {"s1": {"name": "S1"}},
            "breaks": {"g1.0": "break"},
            "trans": {"zh": {"s-g1.0": "你好。"}},
            "transAlign": {"zh": {"s-g1.0": {
                "mode": "manyToOne", "crossing": true, "words": ["g1.0"],
                "pieces": [{"from": 0, "to": 0, "text": "你好。"}]
            }}}
        });
        let doc = TranscriptDoc::from_json(serde_json::to_vec(&json).unwrap().as_slice()).unwrap();
        assert_eq!(doc.ccut_transcript, "0.5");
        assert_eq!(doc.layout_profile_id(), DEFAULT_LAYOUT_PROFILE);
        assert!(doc.auto_breaks.is_empty());
        assert!(doc.trans_display.is_empty());
        let entry = &doc.trans_align["zh"]["s-g1.0"];
        assert!(entry.crossing);
        assert_eq!(entry.correspondence(), Correspondence::Sentence);
        assert_eq!(entry.text_basis, TextBasis::Trans);
        assert!(entry.blocks.is_empty());
        // Word-anchored manyToOne entries without a crossing flag correspond by block. Independent entries correspond by whole sentence.
        let mut plain = entry.clone();
        plain.crossing = false;
        assert_eq!(plain.correspondence(), Correspondence::Block);
        plain.mode = AlignMode::Independent;
        assert_eq!(plain.correspondence(), Correspondence::Sentence);
        // Versions outside the supported range are still rejected.
        let mut bad = json.clone();
        bad["ccutTranscript"] = serde_json::json!("0.2");
        assert!(TranscriptDoc::from_json(serde_json::to_vec(&bad).unwrap().as_slice()).is_err());
    }

    #[test]
    fn effective_breaks_lets_user_pins_override_auto_pins() {
        let mut doc = doc_with(vec![word("g1.0", 0.0, 0.5), word("g1.1", 0.5, 1.0)]);
        let auto = doc.auto_breaks.entry("default".to_owned()).or_default();
        auto.insert("g1.0".to_owned(), BreakOverride::Break);
        auto.insert("g1.1".to_owned(), BreakOverride::Break);
        doc.breaks.insert("g1.0".to_owned(), BreakOverride::Nobreak);
        let merged = doc.effective_breaks("default");
        assert_eq!(merged["g1.0"], BreakOverride::Nobreak);
        assert_eq!(merged["g1.1"], BreakOverride::Break);
        // An unknown profile keeps only user pins. The layout fingerprint looks only at user pins.
        assert_eq!(doc.effective_breaks("portrait").len(), 1);
        assert_eq!(doc.layout_strings(), vec!["b:g1.0=nobreak".to_owned()]);
        // Orphan cleanup also covers autoBreaks.
        auto_orphan(&mut doc);
        assert_eq!(doc.orphan_overrides(), vec!["gone".to_owned()]);
        assert_eq!(doc.prune_orphan_overrides(), 1);
        assert!(doc.orphan_overrides().is_empty());
    }

    fn auto_orphan(doc: &mut TranscriptDoc) {
        doc.auto_breaks
            .get_mut("default")
            .unwrap()
            .insert("gone".to_owned(), BreakOverride::Break);
    }
}

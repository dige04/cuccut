//! The pure-semantics WASM entry shared by the UI and Node (architecture design §1.4, §13.1, §13.6): the domain rules the UI needs are called here from the one Rust copy,
//! not re-written in TS.
//!
//! - Transcript sentences and their source fingerprints (the sentence and translation core rules, via `speech-doc-bridge`): the translation flow freezes the source, checks translations, dubbing judges staleness, and the content index and the UI's per-sentence alignment all call this one;
//! - Stage boxes ([`stage`]): `place` converting between the stage box and canvas pixel boxes, and the default placement by kind, using the same implementation as the frame plan's layers (`render_graph::item_box`);
//! - Engine value ranges and defaults ([`ranges`]): effects, ducking, volume, keyframes, animation and confetti; the UI's number inputs are capped by these;
//! - The element style catalogue ([`presets`]): styles and default parameters for the waveform, progress bar and confetti, read from the same built-in recipes used for rendering.
//!
//! The same conventions as `preview-wasm`: no wasm-bindgen; JSON goes in and out through linear memory:
//!
//! - `bc_alloc(len)` / `bc_free(ptr, len)`: buffers the host writes its input into;
//! - `bc_<name>(ptr, len)`: the input is JSON; returns 0 on success, and the output area (`bc_output_ptr` / `bc_output_len`) holds the result JSON;
//!   otherwise the output area is `{code, message}`;
//! - `bc_speech_sentences`: the input is a `cuccut.speech/1` transcript body; the result is
//!   `{ derivation, timescale, editViewHash, contentFingerprint, sentences: [{ id, wordIds, text, fingerprint, speaker?, start, end }] }`;
//!   `start` / `end` are integer ticks in the body's `timescale` (no floating-point seconds appear at boundaries);
//! - `bc_stage_box` / `bc_stage_place` / `bc_place_default`: see the functions of the same names in [`stage`];
//! - `bc_engine_ranges`: see [`ranges::engine_ranges`];
//! - `bc_element_presets`: see [`presets::element_presets`];
//! - `bc_speaker_proposal` / `bc_apply_speakers`: speakers recognized in an existing transcript, see [`speakers`];
//! - `bc_source_chapters`: parsing and snapping of the chapters a source provides itself (the platform's `chapters[]`, a timestamped outline in the description, or an explicit outline), see [`source_chapters`].

pub mod presets;
pub mod ranges;
pub mod source_chapters;
pub mod speakers;
pub mod stage;

use std::cell::RefCell;

use serde::Serialize;
use speech_doc_bridge::sentences::source_sentences;
use video_model::speech::SpeechBody;

/// The call failed: `code` is a stable error code.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct EntryError {
    pub code: &'static str,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SentencesOutput<'a> {
    derivation: &'a str,
    timescale: i64,
    edit_view_hash: &'a str,
    content_fingerprint: &'a str,
    sentences: Vec<SentenceOutput<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SentenceOutput<'a> {
    id: &'a str,
    word_ids: &'a [String],
    text: &'a str,
    fingerprint: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    speaker: Option<&'a str>,
    start: i64,
    end: i64,
}

thread_local! {
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// The transcript body's sentences (JSON). `INVALID_SPEECH` when the body cannot be read, is not `cuccut.speech/1`, a word lacks source time, or a speaker is invalid.
pub fn speech_sentences(input: &[u8]) -> Result<String, EntryError> {
    let invalid = |message: String| EntryError {
        code: "INVALID_SPEECH",
        message,
    };
    let body: SpeechBody = serde_json::from_slice(input).map_err(|error| invalid(format!("转写正文读不懂：{error}")))?;
    let derived = source_sentences(&body).map_err(|error| invalid(error.message))?;
    let output = SentencesOutput {
        derivation: derived.derivation,
        timescale: derived.timescale,
        edit_view_hash: &derived.edit_view_hash,
        content_fingerprint: &derived.content_fingerprint,
        sentences: derived
            .sentences
            .iter()
            .map(|sentence| SentenceOutput {
                id: &sentence.id,
                word_ids: &sentence.word_ids,
                text: &sentence.text,
                fingerprint: &sentence.fingerprint,
                speaker: sentence.speaker.as_deref(),
                start: sentence.start,
                end: sentence.end,
            })
            .collect(),
    };
    Ok(serde_json::to_string(&output).expect("sentences always serialize"))
}

/// The input cannot be read (it is not the agreed JSON shape).
pub(crate) fn invalid_input(error: serde_json::Error) -> EntryError {
    EntryError {
        code: "INVALID_INPUT",
        message: format!("输入读不懂：{error}"),
    }
}

fn finish(result: Result<String, EntryError>) -> u32 {
    let (status, bytes) = match result {
        Ok(json) => (0, json.into_bytes()),
        Err(error) => (1, serde_json::to_vec(&error).expect("errors always serialize")),
    };
    OUTPUT.with_borrow_mut(|output| *output = bytes);
    status
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

/// # Safety
/// `ptr` and `len` must come from the same `bc_alloc` call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn bc_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(unsafe { Vec::from_raw_parts(ptr, 0, len) });
    }
}

/// Exports a `bc_<name>(ptr, len) -> u32`: reads the input, calls the function, and writes the result or the error into the output area.
macro_rules! export {
    ($($name:ident => $function:path;)*) => {$(
        /// # Safety
        /// `ptr` points to `len` bytes that have been written.
        #[unsafe(no_mangle)]
        pub unsafe extern "C" fn $name(ptr: *const u8, len: usize) -> u32 {
            let input = unsafe { std::slice::from_raw_parts(ptr, len) };
            finish($function(input))
        }
    )*};
}

export! {
    bc_speech_sentences => speech_sentences;
    bc_stage_box => stage::stage_box;
    bc_stage_place => stage::stage_place;
    bc_place_default => stage::place_default;
    bc_engine_ranges => ranges::engine_ranges;
    bc_element_presets => presets::element_presets;
    bc_speaker_proposal => speakers::speaker_proposal;
    bc_apply_speakers => speakers::apply_speakers;
    bc_source_chapters => source_chapters::source_chapters;
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_output_ptr() -> *const u8 {
    OUTPUT.with_borrow(|output| output.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn bc_output_len() -> usize {
    OUTPUT.with_borrow(|output| output.len())
}

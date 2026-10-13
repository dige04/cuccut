//! Parts of this file reference speech-swift (https://github.com/soniqo/speech-swift).
//! Corresponding upstream file: `Sources/Qwen3ASR/ForcedAligner.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut implements the related algorithms in Rust and adapts them to this project's backends, model bundles and transcription interfaces; the original upstream source notice is kept.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of the sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! The backend-independent orchestration logic of the forced aligner: the segmented loop with platform detection for `align_long`. Ported from v2 `ccut-speech`.
//!
//! Each backend implements `align_once` (one non-autoregressive forward pass + monotonization), and the segment-driving for long audio (>240 s, beyond the 0.08 s × 5000-class range) is shared here.

use anyhow::Result;

use super::AlignedWord;

/// Drives long-audio alignment with `align_once`: detects a trailing “plateau” (several words squeezed into the same time),
/// keeps the trustworthy prefix, and realigns the remaining audio × remaining words with an offset applied, for at most 10 rounds.
pub fn align_long_with<F>(mut align_once: F, audio: &[f32], text: &str, language: &str) -> Result<Vec<AlignedWord>>
where
    F: FnMut(&[f32], &str, &str) -> Result<Vec<AlignedWord>>,
{
    let mut all = Vec::new();
    let mut remaining_audio = audio;
    let mut remaining_text = text.to_owned();
    let mut offset = 0.0_f32;
    for _pass in 0..10 {
        if remaining_audio.is_empty() || remaining_text.is_empty() {
            break;
        }
        let duration = remaining_audio.len() as f32 / 16_000.0;
        let aligned = align_once(remaining_audio, &remaining_text, language)?;
        if aligned.is_empty() {
            break;
        }
        if duration <= 240.0 || aligned.len() < 10 {
            all.extend(offset_words(aligned, offset));
            break;
        }
        let plateau = trailing_plateau_start(&aligned, 0.1, 5);
        if plateau == aligned.len() || plateau == 0 {
            all.extend(offset_words(aligned, offset));
            break;
        }
        let split_time = aligned[plateau - 1].end;
        all.extend(offset_words(aligned[..plateau].to_vec(), offset));
        let split_sample = (split_time * 16_000.0) as usize;
        if split_sample >= remaining_audio.len() || remaining_audio.len() - split_sample < 5 * 16_000 {
            break;
        }
        remaining_audio = &remaining_audio[split_sample..];
        remaining_text = aligned[plateau..]
            .iter()
            .map(|word| word.text.as_str())
            .collect::<Vec<_>>()
            .join(if is_unspaced_language(language) { "" } else { " " });
        offset += split_time;
    }
    Ok(all)
}

pub fn trailing_plateau_start(aligned: &[AlignedWord], tolerance: f32, minimum_size: usize) -> usize {
    if aligned.len() <= minimum_size {
        return aligned.len();
    }
    let mut start = aligned.len();
    for index in (1..aligned.len()).rev() {
        if (aligned[index].start - aligned[index - 1].start).abs() < tolerance {
            start = index - 1;
        } else {
            break;
        }
    }
    if aligned.len() - start >= minimum_size {
        start
    } else {
        aligned.len()
    }
}

pub fn offset_words(words: Vec<AlignedWord>, offset: f32) -> impl Iterator<Item = AlignedWord> {
    words.into_iter().map(move |word| AlignedWord {
        text: word.text,
        start: word.start + offset,
        end: word.end + offset,
    })
}

pub fn is_unspaced_language(language: &str) -> bool {
    let language = language.to_lowercase();
    ["zh", "ja", "th", "lo", "km", "my"]
        .iter()
        .any(|code| language == *code || language.contains(code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_only_large_trailing_plateaus() {
        let words = (0..9)
            .map(|index| AlignedWord {
                text: index.to_string(),
                start: if index < 4 { index as f32 } else { 4.0 },
                end: if index < 4 { index as f32 + 0.5 } else { 4.1 },
            })
            .collect::<Vec<_>>();
        assert_eq!(trailing_plateau_start(&words, 0.1, 5), 4);
        assert_eq!(trailing_plateau_start(&words, 0.1, 6), words.len());
    }
}

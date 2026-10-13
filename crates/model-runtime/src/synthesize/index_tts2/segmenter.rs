//! Partly rewritten from speech-swift (https://github.com/soniqo/speech-swift).
//! Upstream file: `Sources/IndexTTS2TTS/IndexTTS2TextSegmenter.swift`.
//! Copyright 2025 Ivan Digital
//! SPDX-License-Identifier: Apache-2.0
//! Changes: CucCut rewrote the related Swift implementations in Rust and adapted them to this project's tensor backend and model-package interface.
//! Full original license: `crates/model-runtime/licenses/speech-swift.txt`; for the scope of sources, see `THIRD_PARTY_NOTICES.md` in the repository root.
//!
//! Long-text segmentation: ported from speech-swift `IndexTTS2TextSegmenter.swift`.
//!
//! Same approach as upstream `TextTokenizer.split_segments`: split after sentence-final punctuation, commas and hyphens,
//! then merge adjacent pieces back together until they no longer fit within `max_tokens`. Each segment is generated independently, so long text
//! never exceeds the GPT text window or the mel budget.
//!
//! One deliberate difference: upstream hard-cuts a long piece without punctuation at the limit and treats the remainder as a separate segment,
//! which may leave only a single token (or even a lone `▁`) that synthesizes as noise; here, the cut is made as evenly as possible across word boundaries instead.

use super::tokenizer::Token;

pub struct TextSegmenter;

impl TextSegmenter {
    pub const DEFAULT_MAX_TOKENS: usize = 120;

    const SENTENCE_END_PIECES: &[&str] = &[".", "!", "?", "▁.", "▁?", "▁..."];
    const COMMA_PIECES: &[&str] = &[",", "▁,"];
    const HYPHEN_PIECES: &[&str] = &["-"];
    const APOSTROPHE_PIECES: &[&str] = &["'", "▁'"];

    pub fn split(tokens: &[Token], max_tokens: usize) -> Vec<Vec<Token>> {
        if tokens.is_empty() {
            return Vec::new();
        }
        let limit = max_tokens.max(1);

        let mut runs: Vec<Vec<Token>> = Vec::new();
        let mut current: Vec<Token> = Vec::new();
        let mut index = 0;
        while index < tokens.len() {
            let token = &tokens[index];
            current.push(token.clone());
            index += 1;

            let piece = token.piece.as_str();
            if Self::COMMA_PIECES.contains(&piece) || Self::HYPHEN_PIECES.contains(&piece) {
                runs.push(std::mem::take(&mut current));
            } else if Self::SENTENCE_END_PIECES.contains(&piece) && current.len() > 2 {
                // An apostrophe at the end of a sentence stays with the sentence it ends.
                if index < tokens.len() && Self::APOSTROPHE_PIECES.contains(&tokens[index].piece.as_str()) {
                    current.push(tokens[index].clone());
                    index += 1;
                }
                runs.push(std::mem::take(&mut current));
            }
        }
        if !current.is_empty() {
            runs.push(current);
        }

        let bounded: Vec<Vec<Token>> = runs.into_iter().flat_map(|run| Self::chunk_evenly(run, limit)).collect();

        let mut merged: Vec<Vec<Token>> = Vec::new();
        for run in bounded {
            match merged.last_mut() {
                Some(last) if last.len() + run.len() <= limit => last.extend(run),
                _ => merged.push(run),
            }
        }
        merged
    }

    /// Splits pieces longer than `limit` into chunks of roughly equal length; each cut point backs off to the nearest
    /// word start (a piece with the `▁` prefix), as long as the chunk is still at least half the target length.
    fn chunk_evenly(run: Vec<Token>, limit: usize) -> Vec<Vec<Token>> {
        if run.len() <= limit {
            return vec![run];
        }
        let chunk_count = run.len().div_ceil(limit);
        let target = run.len().div_ceil(chunk_count);

        let mut chunks = Vec::new();
        let mut start = 0;
        while start < run.len() {
            let mut end = (start + target).min(run.len());
            if end < run.len() {
                let mut boundary = end;
                while boundary > start + target / 2 && !run[boundary].piece.starts_with('▁') {
                    boundary -= 1;
                }
                if boundary > start {
                    end = boundary;
                }
            }
            chunks.push(run[start..end].to_vec());
            start = end;
        }
        chunks
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn toks(pieces: &[&str]) -> Vec<Token> {
        pieces
            .iter()
            .enumerate()
            .map(|(id, piece)| Token {
                id,
                piece: piece.to_string(),
            })
            .collect()
    }

    fn pieces(segment: &[Token]) -> Vec<&str> {
        segment.iter().map(|t| t.piece.as_str()).collect()
    }

    #[test]
    fn splits_on_sentence_end_and_merges_within_limit() {
        let tokens = toks(&["▁HELLO", "▁WORLD", ".", "▁THIS", "▁IS", "▁A", "▁TEST", "."]);
        let segments = TextSegmenter::split(&tokens, 120);
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].len(), 8);

        let segments = TextSegmenter::split(&tokens, 5);
        assert_eq!(segments.len(), 2);
        assert_eq!(pieces(&segments[0]), vec!["▁HELLO", "▁WORLD", "."]);
        assert_eq!(pieces(&segments[1]), vec!["▁THIS", "▁IS", "▁A", "▁TEST", "."]);
    }

    #[test]
    fn keeps_trailing_apostrophe_with_sentence() {
        let tokens = toks(&["▁HE", "▁SAID", "▁.", "'", "▁OK", "▁THEN", ","]);
        let segments = TextSegmenter::split(&tokens, 4);
        assert_eq!(pieces(&segments[0]), vec!["▁HE", "▁SAID", "▁.", "'"]);
        assert_eq!(pieces(&segments[1]), vec!["▁OK", "▁THEN", ","]);
    }

    #[test]
    fn short_sentence_end_does_not_split() {
        let tokens = toks(&["▁A", ".", "▁B", "▁C", "▁D", "."]);
        let segments = TextSegmenter::split(&tokens, 3);
        // “▁A .” has only 2 tokens, so it is not cut at the period; a whole segment of 6 tokens is split evenly into two blocks.
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].len() + segments[1].len(), 6);
    }

    #[test]
    fn chunks_long_runs_at_word_boundaries() {
        let tokens = toks(&["▁AB", "C", "▁DE", "F", "▁GH", "I", "▁JK"]);
        let segments = TextSegmenter::split(&tokens, 4);
        assert_eq!(segments.len(), 2);
        assert_eq!(pieces(&segments[0]), vec!["▁AB", "C", "▁DE", "F"]);
        assert_eq!(pieces(&segments[1]), vec!["▁GH", "I", "▁JK"]);
    }

    #[test]
    fn empty_input() {
        assert!(TextSegmenter::split(&[], 120).is_empty());
    }
}

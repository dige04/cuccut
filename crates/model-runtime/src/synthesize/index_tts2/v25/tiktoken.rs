//! IndexTTS 2.5 multilingual tiktoken tokenizer.
//!
//! Checked against the official `indextts/utils/tokenizer.py` (index-tts 9c87c46) and mlx-indextts `tokenizer_v25.py`: after the 58,836 base64 byte ranks, 1,673 special tokens follow in order; the pre-tokenization regex stays consistent with tiktoken's `_byte_pair_merge`; when encoding, all special tokens may appear in the text (`allowed_special="all"`).

use anyhow::{Context, Result, anyhow, bail};
use fancy_regex::Regex;
use std::collections::HashMap;
use std::path::Path;

/// Official language code table; the index is the row number in `lang_embedding` (106 entries; the embedding table has one extra row).
pub const LANGUAGE_CODES: [&str; 106] = [
    "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr", "pl", "ca", "nl", "ar", "sv", "it", "id", "hi", "fi", "vi", "he", "uk",
    "el", "ms", "cs", "ro", "da", "hu", "ta", "no", "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy", "sk", "te", "fa", "lv", "bn",
    "sr", "az", "sl", "kn", "et", "mk", "br", "eu", "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw", "gl", "mr", "pa", "si", "km", "sn",
    "yo", "so", "af", "oc", "ka", "be", "tg", "sd", "gu", "am", "yi", "lo", "uz", "fo", "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my",
    "bo", "tl", "mg", "as", "tt", "haw", "ln", "ha", "ba", "jw", "su", "yue", "minnan", "wuyu", "dialect", "zh/en", "en/zh", "common",
];

/// Languages supported by the public 2.5 weights (`supported_languages` in `config.yaml`).
pub const RELEASED_LANGUAGES: [&str; 5] = ["zh", "en", "ja", "es", "ar"];

/// Special tokens only register the first 99 language codes (official `num_languages=99`).
const SPECIAL_LANGUAGE_COUNT: usize = 99;
const AUDIO_EVENTS: [&str; 11] = [
    "ASR",
    "AED",
    "SER",
    "Speech",
    "/Speech",
    "BGM",
    "/BGM",
    "Laughter",
    "/Laughter",
    "Applause",
    "/Applause",
];
const EMOTIONS: [&str; 4] = ["HAPPY", "SAD", "ANGRY", "NEUTRAL"];
const TASK_TOKENS: [&str; 6] = ["translate", "transcribe", "startoflm", "startofprev", "nospeech", "notimestamps"];
const TTS_VOCAL_TOKENS: [&str; 7] = ["TTS/B", "TTS/O", "TTS/Q", "TTS/A", "TTS/CO", "TTS/CL", "TTS/H"];
const PATTERN: &str = r"'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+";

/// Row number of the language code in `lang_embedding`.
pub fn language_id(code: &str) -> Option<usize> {
    LANGUAGE_CODES.iter().position(|candidate| *candidate == code)
}

/// Official special token order; the id of the i-th one is `rank count + i`.
pub fn special_token_strings() -> Vec<String> {
    let mut tokens = vec!["<|endoftext|>".to_string(), "<|startoftranscript|>".to_string()];
    tokens.extend(LANGUAGE_CODES[..SPECIAL_LANGUAGE_COUNT].iter().map(|code| format!("<|{code}|>")));
    tokens.extend(AUDIO_EVENTS.iter().map(|event| format!("<|{event}|>")));
    tokens.extend(EMOTIONS.iter().map(|emotion| format!("<|{emotion}|>")));
    tokens.extend(TASK_TOKENS.iter().map(|task| format!("<|{task}|>")));
    tokens.extend((1..=30).map(|index| format!("<|SPECIAL_TOKEN_{index}|>")));
    tokens.extend(TTS_VOCAL_TOKENS.iter().map(|token| format!("<|{token}|>")));
    tokens.extend((1..=13).map(|index| format!("<|TTS/SP{index:02}|>")));
    tokens.extend((0..1501).map(|index| format!("<|{:.2}|>", f64::from(index) * 0.02)));
    tokens
}

pub struct TiktokenTokenizer {
    ranks: HashMap<Vec<u8>, u32>,
    decoder: Vec<Vec<u8>>,
    special_ids: HashMap<String, u32>,
    special_tokens: Vec<String>,
    pattern: Regex,
}

impl TiktokenTokenizer {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path).with_context(|| format!("failed to read IndexTTS 2.5 vocabulary {}", path.display()))?;
        Self::parse(&text).with_context(|| format!("failed to parse IndexTTS 2.5 vocabulary {}", path.display()))
    }

    /// Parses `.tiktoken` text: each line is `base64(bytes) rank`; ranks must cover 0..n contiguously.
    pub fn parse(text: &str) -> Result<Self> {
        let mut entries: Vec<Option<Vec<u8>>> = Vec::new();
        for (line_no, line) in text.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let mut parts = line.split_whitespace();
            let (Some(token), Some(rank), None) = (parts.next(), parts.next(), parts.next()) else {
                bail!("line {} is not in `base64 rank` form", line_no + 1);
            };
            let rank: usize = rank.parse().with_context(|| format!("rank on line {} is not an integer", line_no + 1))?;
            let bytes = decode_base64(token).with_context(|| format!("base64 on line {} is invalid", line_no + 1))?;
            if rank >= entries.len() {
                entries.resize(rank + 1, None);
            }
            if entries[rank].replace(bytes).is_some() {
                bail!("rank {rank} appears more than once");
            }
        }
        let pieces = entries
            .into_iter()
            .enumerate()
            .map(|(rank, entry)| entry.ok_or_else(|| anyhow!("vocabulary is missing rank {rank}")))
            .collect::<Result<Vec<_>>>()?;
        Self::from_pieces(pieces)
    }

    /// Builds from byte pieces sorted by rank; requires all 256 single bytes to be in the table, so any text can be encoded.
    pub fn from_pieces(pieces: Vec<Vec<u8>>) -> Result<Self> {
        let mut ranks = HashMap::with_capacity(pieces.len());
        for (rank, piece) in pieces.iter().enumerate() {
            // The official `*_char_del.tiktoken` writes a deleted character as `=` (empty bytes) as a placeholder to keep ranks contiguous; tiktoken merging never produces an empty piece, so this line only corresponds to an empty string when decoding.
            if piece.is_empty() {
                continue;
            }
            if ranks.insert(piece.clone(), rank as u32).is_some() {
                bail!("vocabulary contains a duplicate piece (rank {rank})");
            }
        }
        for byte in 0..=u8::MAX {
            if !ranks.contains_key(&[byte][..]) {
                bail!("vocabulary is missing single-byte 0x{byte:02X}");
            }
        }
        let special_tokens = special_token_strings();
        let base = pieces.len() as u32;
        let special_ids = special_tokens
            .iter()
            .enumerate()
            .map(|(index, token)| (token.clone(), base + index as u32))
            .collect();
        Ok(Self {
            ranks,
            decoder: pieces,
            special_ids,
            special_tokens,
            pattern: Regex::new(PATTERN).expect("static pre-tokenization regex should compile"),
        })
    }

    /// Rank count + special token count (60,509 for the public 2.5 weights).
    pub fn vocab_size(&self) -> usize {
        self.decoder.len() + self.special_tokens.len()
    }

    pub fn special_id(&self, token: &str) -> Option<u32> {
        self.special_ids.get(token).copied()
    }

    /// `encode(text, allowed_special="all")`。
    pub fn encode(&self, text: &str) -> Vec<u32> {
        let mut out = Vec::new();
        let mut start = 0;
        let mut search = 0;
        // Special tokens are all `<|X|>` with X not containing `|`, so each `<|` can only match the next `|>`.
        while let Some(relative) = text[search..].find("<|") {
            let open = search + relative;
            if let Some(close) = text[open + 2..].find("|>") {
                let end = open + 2 + close + 2;
                if let Some(id) = self.special_ids.get(&text[open..end]) {
                    self.encode_ordinary(&text[start..open], &mut out);
                    out.push(*id);
                    start = end;
                    search = end;
                    continue;
                }
            }
            search = open + 1;
        }
        self.encode_ordinary(&text[start..], &mut out);
        out
    }

    pub fn token_count(&self, text: &str) -> usize {
        self.encode(text).len()
    }

    pub fn decode(&self, ids: &[u32]) -> String {
        let base = self.decoder.len();
        let mut bytes = Vec::new();
        for &id in ids {
            let id = id as usize;
            if let Some(piece) = self.decoder.get(id) {
                bytes.extend_from_slice(piece);
            } else if let Some(special) = self.special_tokens.get(id - base) {
                bytes.extend_from_slice(special.as_bytes());
            }
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }

    fn encode_ordinary(&self, text: &str, out: &mut Vec<u32>) {
        let mut cursor = 0;
        for found in self.pattern.find_iter(text) {
            let Ok(found) = found else { break };
            if found.start() > cursor {
                self.encode_piece(text[cursor..found.start()].as_bytes(), out);
            }
            self.encode_piece(found.as_str().as_bytes(), out);
            cursor = found.end();
        }
        if cursor < text.len() {
            self.encode_piece(text[cursor..].as_bytes(), out);
        }
    }

    fn encode_piece(&self, piece: &[u8], out: &mut Vec<u32>) {
        if piece.is_empty() {
            return;
        }
        if let Some(rank) = self.ranks.get(piece) {
            out.push(*rank);
            return;
        }
        let boundaries = byte_pair_merge(&self.ranks, piece);
        for window in boundaries.windows(2) {
            // The single bytes are guaranteed to be in the table at construction, so any merged fragment always has a rank.
            out.push(self.ranks[&piece[window[0].0..window[1].0]]);
        }
    }
}

/// tiktoken `_byte_pair_merge`: repeatedly merges the adjacent pieces with the lowest rank, returns the start positions of the pieces.
fn byte_pair_merge(ranks: &HashMap<Vec<u8>, u32>, piece: &[u8]) -> Vec<(usize, u32)> {
    let rank_of = |range: &[u8]| ranks.get(range).copied().unwrap_or(u32::MAX);
    let mut parts = Vec::with_capacity(piece.len() + 1);
    let mut min_rank = (u32::MAX, usize::MAX);
    for index in 0..piece.len() - 1 {
        let rank = rank_of(&piece[index..index + 2]);
        if rank < min_rank.0 {
            min_rank = (rank, index);
        }
        parts.push((index, rank));
    }
    parts.push((piece.len() - 1, u32::MAX));
    parts.push((piece.len(), u32::MAX));

    let pair_rank = |parts: &[(usize, u32)], index: usize| {
        if index + 3 < parts.len() {
            rank_of(&piece[parts[index].0..parts[index + 3].0])
        } else {
            u32::MAX
        }
    };
    while min_rank.0 != u32::MAX {
        let index = min_rank.1;
        if index > 0 {
            parts[index - 1].1 = pair_rank(&parts, index - 1);
        }
        parts[index].1 = pair_rank(&parts, index);
        parts.remove(index + 1);
        min_rank = (u32::MAX, usize::MAX);
        for (position, &(_, rank)) in parts[..parts.len() - 1].iter().enumerate() {
            if rank < min_rank.0 {
                min_rank = (rank, position);
            }
        }
    }
    parts
}

fn decode_base64(input: &str) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for &byte in input.as_bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            other => bail!("invalid base64 character {:?}", other as char),
        };
        buffer = (buffer << 6) | u32::from(value);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    fn encode_base64(bytes: &[u8]) -> String {
        const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::new();
        for chunk in bytes.chunks(3) {
            let value = chunk
                .iter()
                .enumerate()
                .fold(0u32, |acc, (index, byte)| acc | (u32::from(*byte) << (16 - 8 * index)));
            for index in 0..4 {
                if index <= chunk.len() {
                    out.push(ALPHABET[((value >> (18 - 6 * index)) & 63) as usize] as char);
                } else {
                    out.push('=');
                }
            }
        }
        out
    }

    /// Synthetic vocabulary: the 256 single bytes plus the two merges `ab` and `abc`.
    pub(crate) fn synthetic_tokenizer() -> TiktokenTokenizer {
        let mut pieces: Vec<Vec<u8>> = (0..=u8::MAX).map(|byte| vec![byte]).collect();
        pieces.push(b"ab".to_vec());
        pieces.push(b"abc".to_vec());
        let text = pieces
            .iter()
            .enumerate()
            .map(|(rank, piece)| format!("{} {rank}", encode_base64(piece)))
            .collect::<Vec<_>>()
            .join("\n");
        TiktokenTokenizer::parse(&text).unwrap()
    }

    #[test]
    fn decodes_base64() {
        assert_eq!(decode_base64("SGVsbG8=").unwrap(), b"Hello");
        assert_eq!(decode_base64("YQ==").unwrap(), b"a");
        assert_eq!(decode_base64(&encode_base64("你好".as_bytes())).unwrap(), "你好".as_bytes());
        assert!(decode_base64("a*b").is_err());
    }

    #[test]
    fn special_tokens_follow_official_order() {
        let tokens = special_token_strings();
        assert_eq!(tokens.len(), 1673);
        assert_eq!(tokens[3], "<|zh|>");
        assert_eq!(tokens[2 + 98], "<|su|>");
        assert_eq!(tokens[2 + 99], "<|ASR|>");
        assert_eq!(tokens[122], "<|SPECIAL_TOKEN_1|>");
        assert_eq!(tokens[171], "<|TTS/SP13|>");
        assert_eq!(tokens[172], "<|0.00|>");
        assert_eq!(tokens[173], "<|0.02|>");
        assert_eq!(tokens[1672], "<|30.00|>");
        assert_eq!(language_id("zh"), Some(1));
        assert_eq!(language_id("es"), Some(3));
        assert_eq!(language_id("ja"), Some(7));
        assert_eq!(language_id("ar"), Some(13));
    }

    #[test]
    fn byte_pair_merges_and_specials() {
        let tokenizer = synthetic_tokenizer();
        assert_eq!(tokenizer.vocab_size(), 258 + 1673);
        assert_eq!(tokenizer.encode("abc"), vec![257]);
        assert_eq!(tokenizer.encode(" abc"), vec![32, 257]);
        assert_eq!(tokenizer.encode("abd"), vec![256, u32::from(b'd')]);
        let zh = tokenizer.special_id("<|zh|>").unwrap();
        assert_eq!(zh, 258 + 3);
        assert_eq!(tokenizer.encode("<|zh|> abc"), vec![zh, 32, 257]);
        // A `<|…|>` that is not a special token is encoded as ordinary bytes.
        assert_eq!(tokenizer.token_count("<|xx|>"), 6);
        let ids = tokenizer.encode("<|<|SPECIAL_TOKEN_2|>行<|SPECIAL_TOKEN_2|>");
        assert_eq!(tokenizer.decode(&ids), "<|<|SPECIAL_TOKEN_2|>行<|SPECIAL_TOKEN_2|>");
        assert_eq!(ids.iter().filter(|id| **id == 258 + 123).count(), 2);
    }

    #[test]
    fn empty_placeholder_rank_keeps_ids_but_never_encodes() {
        let mut lines: Vec<String> = (0..=u8::MAX).map(|byte| format!("{} {byte}", encode_base64(&[byte]))).collect();
        lines.push("= 256".to_string());
        lines.push(format!("{} 257", encode_base64(b"ab")));
        let tokenizer = TiktokenTokenizer::parse(&lines.join("\n")).unwrap();
        assert_eq!(tokenizer.vocab_size(), 258 + 1673);
        assert_eq!(tokenizer.encode("ab"), vec![257]);
        assert_eq!(tokenizer.decode(&[256, 257]), "ab");
    }

    #[test]
    fn rejects_incomplete_vocab() {
        assert!(TiktokenTokenizer::parse("YQ== 1\n").is_err());
        assert!(TiktokenTokenizer::from_pieces(vec![b"a".to_vec()]).is_err());
    }
}

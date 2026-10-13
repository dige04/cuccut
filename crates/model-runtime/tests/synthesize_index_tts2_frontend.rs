//! IndexTTS2 pure-logic smoke tests (ported from the first half of v2 `ccut-tts/tests/index_tts2_smoke.rs`): segmentation, sampling defaults, emotion-vector validation, default config, number normalization, and frontend features. Runs on all platforms.
//!
//! `real_vocabulary_pinyin_pieces_tokenize` reads only the real `bpe.model` and does not load weights. It runs only when `CUCCUT_TEST_MODELS_DIR` is set and IndexTTS2 is installed under it; otherwise it is skipped.

use model_runtime::synthesize::index_tts2::config::RuntimeConfig;
use model_runtime::synthesize::index_tts2::dsp;
use model_runtime::synthesize::index_tts2::emotion::EmotionControl;
use model_runtime::synthesize::index_tts2::normalizer::TextNormalizer;
use model_runtime::synthesize::index_tts2::sampling::GenerationOptions;
use model_runtime::synthesize::index_tts2::segmenter::TextSegmenter;
use model_runtime::synthesize::index_tts2::tokenizer::{Token, Tokenizer};
use model_runtime::synthesize::readings::{PIECE_CLOSE, PIECE_OPEN, parse, render_inline_pinyin};

fn token(id: usize, piece: &str) -> Token {
    Token {
        id,
        piece: piece.to_string(),
    }
}

/// Pinyin pieces from the real `bpe.model`: a whole piece wrapped in the sentinels produced by pinyin annotation rendering goes into tokenization as one unit, and numbers are normalized as usual. `render_inline_pinyin` swaps pieces against the real vocabulary or reports them as dropped.
#[test]
fn real_vocabulary_pinyin_pieces_tokenize() {
    let Some(model) = std::env::var_os("CUCCUT_TEST_MODELS_DIR")
        .map(|dir| std::path::PathBuf::from(dir).join("aufklarer/IndexTTS2-MLX-fp16/bpe.model"))
        .filter(|path| path.exists())
    else {
        eprintln!("跳过：未设置 CUCCUT_TEST_MODELS_DIR 或其下没有 IndexTTS2 的 bpe.model");
        return;
    };
    let tokenizer = Tokenizer::load(&model).unwrap();
    let pieces = tokenizer.pinyin_pieces();
    let has = |p: &str| pieces.contains(p);
    assert!(pieces.len() > 1000, "{}", pieces.len());
    assert!(has("XING2") && has("HANG2") && has("ZHONG4") && has("LVE4"));
    // ü: after j / q / x the vocabulary entry is written V (`JV4`); after y it is written U (`YU2`).
    assert!(has("JV4") && !has("JU4") && has("YU2"));

    let text = format!("他在这一{PIECE_OPEN}HANG2{PIECE_CLOSE}做了3年，才{PIECE_OPEN}XING2{PIECE_CLOSE}");
    let tokens = tokenizer.tokenize(&text).unwrap();
    let texts: Vec<&str> = tokens.iter().map(|t| t.piece.as_str()).collect();
    let unk = tokenizer.unknown_token_id;
    assert!(tokens.iter().all(|t| Some(t.id) != unk), "{texts:?}");
    assert_eq!(texts.iter().filter(|p| p.ends_with("HANG2")).count(), 1, "{texts:?}");
    assert_eq!(texts.iter().filter(|p| p.ends_with("XING2")).count(), 1, "{texts:?}");
    assert!(texts.contains(&"三"), "数字照常规范化：{texts:?}");

    // Annotation rendering uses the real vocabulary: `ju4` is swapped for `JV4`; when the vocabulary has no `LU4`, `lu4` goes to dropped.
    let annotated = parse("他在这一<行|hang2>做了3年，才<行|xing2>，<绿|lu4>灯，<句|ju4>");
    let rendered = render_inline_pinyin(&annotated, Some(pieces));
    let tokens = tokenizer.tokenize(&rendered.text).unwrap();
    let texts: Vec<&str> = tokens.iter().map(|t| t.piece.as_str()).collect();
    assert!(tokens.iter().all(|t| Some(t.id) != unk), "{texts:?}");
    assert_eq!(texts.iter().filter(|p| p.ends_with("HANG2")).count(), 1, "{texts:?}");
    assert_eq!(texts.iter().filter(|p| p.ends_with("XING2")).count(), 1, "{texts:?}");
    assert!(texts.contains(&"三"), "数字照常规范化：{texts:?}");
    assert!(texts.iter().any(|p| p.ends_with("JV4")), "{texts:?}");
    assert_eq!(
        rendered.dropped.iter().map(|r| r.reading.as_str()).collect::<Vec<_>>(),
        if has("LU4") { vec![] } else { vec!["lu4"] }
    );
}

#[test]
fn segmenter_splits_long_text_under_budget() {
    // Three sentences of 5 tokens each, budget 8: they should be split into three segments rather than packed into one.
    let mut tokens = Vec::new();
    for sentence in 0..3 {
        for word in 0..4 {
            tokens.push(token(sentence * 10 + word, &format!("▁w{word}")));
        }
        tokens.push(token(sentence * 10 + 9, "."));
    }
    let segments = TextSegmenter::split(&tokens, 8);
    assert_eq!(segments.len(), 3);
    assert!(segments.iter().all(|s| s.len() <= 8));
    let flattened: Vec<usize> = segments.iter().flatten().map(|t| t.id).collect();
    assert_eq!(flattened, tokens.iter().map(|t| t.id).collect::<Vec<_>>());
}

#[test]
fn segmenter_keeps_short_text_whole() {
    let tokens = vec![token(1, "▁hello"), token(2, "▁world"), token(3, ".")];
    let segments = TextSegmenter::split(&tokens, TextSegmenter::DEFAULT_MAX_TOKENS);
    assert_eq!(segments.len(), 1);
    assert_eq!(segments[0].len(), 3);
    assert!(TextSegmenter::split(&[], 120).is_empty());
}

#[test]
fn generation_defaults_match_speech_swift() {
    let options = GenerationOptions::default();
    assert_eq!(options.max_semantic_tokens, 1500);
    assert!(!options.greedy);
    assert_eq!(options.temperature, 0.8);
    assert_eq!(options.top_k, 30);
    assert_eq!(options.top_p, 0.8);
    assert_eq!(options.repetition_penalty, 10.0);
    assert_eq!(options.seed, 11);
    assert_eq!(options.beam_width, 3);
}

#[test]
fn emotion_control_validation() {
    // Official web UI: calm bias 0.5625, not scaled because it does not exceed 0.8; alpha = 1, no truncation.
    let ok = EmotionControl::from_sliders([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8], 1.0).unwrap();
    assert!((ok.weight_sum() - 0.45).abs() < 1e-6);
    // A total above 0.8 is scaled per the official rule without error; only sliders outside 0–1 produce an error.
    let capped = EmotionControl::from_sliders([0.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0).unwrap();
    assert!((capped.weight_sum() - 0.8).abs() < 1e-6);
    assert!(EmotionControl::from_sliders([1.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0).is_err());
    assert!(EmotionControl::from_slice(&[0.1; 7], 1.0).is_err());
}

#[test]
fn runtime_config_fallback_is_index_tts2_v2() {
    let config = RuntimeConfig::fallback();
    assert_eq!(config.output_sample_rate(), 22_050);
    assert_eq!(config.emo_num.iter().sum::<usize>(), 73);
    assert_eq!(config.gpt.condition_type, "conformer_perceiver");
    assert_eq!(config.semantic_codec.codebook_size, 8192);
    assert!(!config.is_v25());
    // This is what is used when the manifest does not list config.yaml.
    assert!(!RuntimeConfig::load(None).unwrap().is_v25());
}

#[test]
fn normalizer_and_front_end_features_are_pure() {
    assert!(!TextNormalizer::normalize("宝剪是一个本地视频工作流工具").is_empty());
    let (features, frames) = dsp::seamless_input_features(&[0.0f32; 100]);
    assert_eq!(frames, 0);
    assert!(features.is_empty());
    let audio: Vec<f32> = (0..16_000).map(|i| ((i as f32) * 0.01).sin() * 0.1).collect();
    let (features, frames) = dsp::seamless_input_features(&audio);
    assert!(frames > 0);
    assert_eq!(features.len(), frames * dsp::SEAMLESS_FEATURE_DIM);
}

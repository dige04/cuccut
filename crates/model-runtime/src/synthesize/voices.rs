//! Built-in voices: eight reference recordings shipped with the package, so engines that do not come with a speaker table also have a “default voice”.
//!
//! The base for “default voice” differs from engine to engine; here they are collected into one table with one set of ids:
//!
//! | Engine | What the model comes with | How the built-in voice is realized |
//! | --- | --- | --- |
//! | IndexTTS2 / IndexTTS 2.5 / GPT-SoVITS / VoxCPM2 / OmniVoice | Zero-shot cloning only, no speaker table | The bundled recording is used as reference audio ([`reference_for`]) |
//! | Qwen3-TTS Base | Can clone; without a reference it is an unconditioned “bare voice” that may differ each time | Same as above: default voice = x-vector computed from the built-in recording |
//! | Qwen3-TTS CustomVoice | The model comes with 9 speakers | Uses the model's own; the default one is picked by language |
//! | Qwen3-TTS VoiceDesign | Can only generate a voice from a one-sentence description; cannot clone | A bundled one-sentence voice description is used as the instruction ([`style_for`]) |
//!
//! Eight named voices (zh / en / ja / es × male/female) each come with a reference recording, an original text, and a one-sentence
//! description: [`VoiceSpec::Preset`] fetches by id, [`VoiceSpec::Default`] fetches by language; once fetched, they follow each engine's own path (cloning / description).
//!
//! Recordings ship with the crate in `assets/voices/`; their provenance, license and modification notes are in `COPYING.txt` in the same directory. Recordings are not written to disk:
//! when an engine needs samples, they are decoded in memory via [`ReferenceAudio::samples`] (the Worker writes files only in staging). Cross-language cloning is supported by all of these engines: an English reference reading Chinese works fine, since what is heard is the timbre rather than the accent, so all eight voices
//! can be selected for any language.

use super::resample::resample;
use super::types::{TtsRequest, VoiceSpec};
use super::wav::decode_wav_pcm16;
use anyhow::{Context, Result, bail, ensure};
use std::path::PathBuf;

/// Metadata for one built-in voice. The bundled recording (16 kHz 16-bit mono PCM) is obtained via [`wav`].
#[derive(Debug)]
pub struct BuiltinVoice {
    /// Stable ids such as `zh-female`: `<language>-<female|male>`; they go into the CLI `--speaker`,
    /// the App form and persistence, and must not be changed.
    pub id: &'static str,
    /// The language of the recording itself (BCP-47 primary language). This does not limit what this voice can read.
    pub lang: &'static str,
    pub female: bool,
    pub seconds: f32,
    /// The original text read in the recording. GPT-SoVITS sounds closer when given reference text, so built-in voices always include it.
    pub text: &'static str,
    /// Source (corpus · excerpt), shown with the result and on the “About” page.
    pub credit: &'static str,
    /// What this same voice “sounds like” when described: engines that generate voices only from descriptions (Qwen3-TTS VoiceDesign) use it as
    /// the voice description. It is written in English, since English prompts are the most reliable.
    pub describe: &'static str,
}

/// The 9 speakers of Qwen3-TTS CustomVoice (the `spk_id` keys in the official `config.json`, with casing as in the official source).
/// Used only to **tell** callers which ones are available; during synthesis, the speaker table that comes with the installed model takes precedence.
pub const CUSTOM_VOICE_SPEAKERS: [&str; 9] = [
    "Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee",
];

/// The eight built-in voices; their order is the UI order: Chinese, English, Japanese, Spanish, each with female before male.
pub const BUILTIN_VOICES: &[BuiltinVoice] = &[
    BuiltinVoice {
        id: "zh-female",
        lang: "zh",
        female: true,
        seconds: 6.72,
        text: "一般来说，卫星电话不能取代移动电话，因为只有在卫星信号畅通的室外，才能进行通话。",
        credit: "FLEURS · cmn_hans_cn · dev · 11138309825590803862",
        describe: "A warm, natural young female voice speaking Mandarin Chinese at an even, unhurried pace",
    },
    BuiltinVoice {
        id: "zh-male",
        lang: "zh",
        female: false,
        seconds: 6.16,
        text: "游猎活动也许是非洲最吸引人的旅游活动，也是许多游客行程中的亮点。",
        credit: "FLEURS · cmn_hans_cn · dev · 7878925372167965477",
        describe: "A calm, steady adult male voice speaking Mandarin Chinese, clear and even",
    },
    BuiltinVoice {
        id: "en-female",
        lang: "en",
        female: true,
        seconds: 7.32,
        text: EN_TEXT,
        credit: "CMU ARCTIC · cmu_us_slt_arctic · a0001 + a0002",
        describe: "A warm, clear adult female voice speaking American English at an even pace",
    },
    BuiltinVoice {
        id: "en-male",
        lang: "en",
        female: false,
        seconds: 6.90,
        text: EN_TEXT,
        credit: "CMU ARCTIC · cmu_us_bdl_arctic · a0001 + a0002",
        describe: "A deep, steady adult male voice speaking American English, clear and even",
    },
    BuiltinVoice {
        id: "ja-female",
        lang: "ja",
        female: true,
        seconds: 8.44,
        text: "州間の税法や関税を無効にする権限もありませんでした。",
        credit: "FLEURS · ja_jp · dev · 9633305044980004895",
        describe: "A bright, gentle young female voice speaking Japanese at an even pace",
    },
    BuiltinVoice {
        id: "ja-male",
        lang: "ja",
        female: false,
        seconds: 6.40,
        text: "宇宙にある人工衛星は通話を受信して、ほぼ瞬時にそれを反映します。",
        credit: "FLEURS · ja_jp · dev · 18146068393309246703",
        describe: "A calm, low adult male voice speaking Japanese, clear and even",
    },
    BuiltinVoice {
        id: "es-female",
        lang: "es",
        female: true,
        seconds: 6.92,
        text: "Los canales navegables internos pueden ser una buena temática para las vacaciones.",
        credit: "FLEURS · es_419 · dev · 16573424493246998243",
        describe: "A warm, clear adult female voice speaking Latin American Spanish at an even pace",
    },
    BuiltinVoice {
        id: "es-male",
        lang: "es",
        female: false,
        seconds: 7.86,
        text: "Cuando uno se comunica con alguien que está a miles de millas de distancia, se está haciendo uso de un satélite.",
        credit: "FLEURS · es_419 · dev · 14695292064114231662",
        describe: "A deep, steady adult male voice speaking Latin American Spanish, clear and even",
    },
];

/// Two English sentences read in the recording (CMU ARCTIC a0001 + a0002).
const EN_TEXT: &str = "Author of the danger trail, Philip Steels, etc. Not at this particular case, Tom, apologized Whittemore.";

/// Two old ids the App used between 2026-09-13 and 2026-09-21, which may still remain in persisted data.
const ALIASES: &[(&str, &str)] = &[("ref-male", "en-male"), ("ref-female", "en-female")];

/// Falls back to this voice when no language is given and the text does not reveal one.
const FALLBACK: &str = "zh-female";

/// Finds a built-in voice by id; case-insensitive, and recognizes the two old ids.
pub fn find(id: &str) -> Option<&'static BuiltinVoice> {
    let id = id.trim();
    let id = ALIASES
        .iter()
        .find(|(old, _)| old.eq_ignore_ascii_case(id))
        .map_or(id, |(_, new)| *new);
    BUILTIN_VOICES.iter().find(|voice| voice.id.eq_ignore_ascii_case(id))
}

/// All ids, in the order of [`BUILTIN_VOICES`]. Both error messages and `preset_speakers()` use it.
pub fn ids() -> Vec<String> {
    BUILTIN_VOICES.iter().map(|voice| voice.id.to_owned()).collect()
}

/// Whether this `--speaker` should be rejected before the weights are loaded.
///
/// Built-in voice ids are always allowed through: engines whose model comes with a speaker table (Qwen3-TTS CustomVoice) will themselves switch to the closest match
/// and say so once on stderr; when the user switches between two variants, the voice name should not become a roadblock.
/// Also not rejected when the engine has no speaker table (`presets` is empty): for such engines, `Preset` takes the built-in-voice path.
pub fn unknown_preset(speaker: &str, presets: &[String]) -> bool {
    find(speaker).is_none() && !presets.is_empty() && !presets.iter().any(|name| name.eq_ignore_ascii_case(speaker))
}

/// Built-in voices for this language (female first). Language codes are compared by primary language; `zh-Hans` / `zh-CN` both count as `zh`.
pub fn for_language(lang: &str) -> Vec<&'static BuiltinVoice> {
    let main = main_language(lang);
    BUILTIN_VOICES.iter().filter(|voice| voice.lang == main).collect()
}

/// Which voice the “default voice” picks: first look at the language in the request, then at the script used by the text; if neither is recognized, fall back to the Chinese female voice.
///
/// Text is judged roughly by script only (kana → Japanese, Han characters → Chinese). Spanish and English both use the Latin alphabet,
/// so no guess is made; only an explicit language code is recognized.
pub fn default_for(language: Option<&str>, text: &str) -> &'static BuiltinVoice {
    let code = language
        .map(main_language)
        .filter(|code| BUILTIN_VOICES.iter().any(|voice| voice.lang == *code))
        .unwrap_or_else(|| script_language(text));
    BUILTIN_VOICES
        .iter()
        .find(|voice| voice.lang == code && voice.female)
        .or_else(|| BUILTIN_VOICES.iter().find(|voice| voice.lang == code))
        .unwrap_or_else(|| find(FALLBACK).expect("built-in voice table has zh-female"))
}

/// `zh-Hans` / `zh_CN` / `ZH` → `zh`; unrecognized input is returned lowercased as-is.
fn main_language(lang: &str) -> &'static str {
    let head = lang.trim().split(['-', '_']).next().unwrap_or("").to_ascii_lowercase();
    match head.as_str() {
        "zh" | "cmn" | "zho" | "yue" => "zh",
        "en" | "eng" => "en",
        "ja" | "jpn" => "ja",
        "es" | "spa" => "es",
        _ => "",
    }
}

/// Text script → language: kana → Japanese, Han characters → Chinese, otherwise English.
fn script_language(text: &str) -> &'static str {
    let mut han = false;
    for ch in text.chars() {
        match ch {
            '\u{3040}'..='\u{309f}' | '\u{30a0}'..='\u{30ff}' => return "ja",
            '\u{4e00}'..='\u{9fff}' | '\u{3400}'..='\u{4dbf}' => han = true,
            _ => {}
        }
    }
    if han { "zh" } else { "en" }
}

/// Voice in the request → which built-in voice. `Clone` does not use a built-in voice, so it returns `None`.
pub fn builtin_for(request: &TtsRequest, engine: &str) -> Result<Option<&'static BuiltinVoice>> {
    match &request.voice {
        VoiceSpec::Clone { .. } => Ok(None),
        VoiceSpec::Preset { speaker } => {
            let Some(voice) = find(speaker) else {
                bail!("{engine} has no built-in voice '{speaker}'; available: {}", ids().join(", "));
            };
            Ok(Some(voice))
        }
        VoiceSpec::Default => Ok(Some(default_for(request.language.as_deref(), &request.text))),
    }
}

/// Resolves the voice for engines that generate voices only from descriptions (Qwen3-TTS VoiceDesign): a built-in voice provides its one-sentence description, and the instruction the caller provides
/// is appended after the description (if both exist, both are spoken).
///
/// `Clone` has no solution on this path: description-based generation cannot take reference audio, so it is left to the caller to report an error.
pub fn style_for(request: &TtsRequest, engine: &str) -> Result<Style> {
    let voice = builtin_for(request, engine)?;
    let described = voice.map(|voice| voice.describe);
    let asked = request.instruct.as_deref().map(str::trim).filter(|text| !text.is_empty());
    let instruct = match (described, asked) {
        (Some(described), Some(asked)) => Some(format!("{described}. {asked}")),
        (Some(described), None) => Some(described.to_owned()),
        (None, asked) => asked.map(str::to_owned),
    };
    Ok(Style {
        instruct,
        builtin: voice.map(|voice| voice.id),
    })
}

/// The style instruction used for one “generate by description” call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Style {
    /// The full instruction sentence passed to the engine; `None` when both sides are empty (the engine uses its own bare default).
    pub instruct: Option<String>,
    /// `Some(id)` = the description comes from this built-in voice.
    pub builtin: Option<&'static str>,
}

/// Bundled recordings. The order matches [`BUILTIN_VOICES`]; the two tables are cross-checked id by id (see tests).
const WAVS: &[(&str, &[u8])] = &[
    ("zh-female", include_bytes!("../../assets/voices/zh-female.wav")),
    ("zh-male", include_bytes!("../../assets/voices/zh-male.wav")),
    ("en-female", include_bytes!("../../assets/voices/en-female.wav")),
    ("en-male", include_bytes!("../../assets/voices/en-male.wav")),
    ("ja-female", include_bytes!("../../assets/voices/ja-female.wav")),
    ("ja-male", include_bytes!("../../assets/voices/ja-male.wav")),
    ("es-female", include_bytes!("../../assets/voices/es-female.wav")),
    ("es-male", include_bytes!("../../assets/voices/es-male.wav")),
];

/// The recording bytes for this built-in voice (16 kHz 16-bit mono PCM WAV).
pub fn wav(voice: &BuiltinVoice) -> &'static [u8] {
    WAVS.iter()
        .find(|(id, _)| *id == voice.id)
        .map(|(_, bytes)| *bytes)
        .expect("every built-in voice has a bundled recording")
}

/// Where the reference audio comes from: a file provided by the caller, or the bundled recording of a built-in voice.
#[derive(Debug, Clone, PartialEq)]
pub enum ReferenceAudio {
    File(PathBuf),
    Builtin(&'static str),
}

impl ReferenceAudio {
    /// Decodes to mono f32 at `sample_rate`. Files go through [`crate::audio::decode_mono`]; built-in recordings are decoded in memory,
    /// then resampled to the target sample rate using band-limited interpolation.
    pub fn samples(&self, sample_rate: u32) -> Result<Vec<f32>> {
        match self {
            Self::File(path) => crate::audio::decode_mono(path, sample_rate).with_context(|| format!("failed to decode reference audio {}", path.display())),
            Self::Builtin(id) => {
                let voice = find(id).with_context(|| format!("no built-in voice {id}"))?;
                let (samples, rate) = decode_wav_pcm16(wav(voice))?;
                Ok(resample(&samples, rate, sample_rate))
            }
        }
    }
}

/// The reference audio used for one synthesis, and its original text.
#[derive(Debug, Clone, PartialEq)]
pub struct Reference {
    pub audio: ReferenceAudio,
    /// The original text read in the reference audio; cloning with the original text sounds closer; engines that do not use it ignore it.
    pub text: Option<String>,
    /// `Some(id)` = a built-in voice is used; progress and results must record which one.
    pub builtin: Option<&'static str>,
}

/// Resolves the voice for engines that can only clone: `Clone` uses the file provided by the caller, `Preset` fetches a built-in voice by id,
/// and `Default` fetches a built-in voice by language. All engines use the same judgment; none may re-check “is there a default voice” on its own.
pub fn reference_for(request: &TtsRequest, engine: &str) -> Result<Reference> {
    if let VoiceSpec::Clone {
        reference_audio,
        reference_text,
    } = &request.voice
    {
        ensure!(reference_audio.is_file(), "{engine} reference audio does not exist: {}", reference_audio.display());
        return Ok(Reference {
            audio: ReferenceAudio::File(reference_audio.clone()),
            text: reference_text.clone().filter(|text| !text.trim().is_empty()),
            builtin: None,
        });
    }
    let Some(voice) = builtin_for(request, engine)? else {
        bail!("{engine} has no usable built-in voice");
    };
    Ok(builtin(voice))
}

/// A built-in voice used as the reference.
pub fn builtin(voice: &'static BuiltinVoice) -> Reference {
    Reference {
        audio: ReferenceAudio::Builtin(voice.id),
        text: Some(voice.text.to_owned()),
        builtin: Some(voice.id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_unique_and_cover_four_languages_both_genders() {
        let mut seen = std::collections::BTreeSet::new();
        for voice in BUILTIN_VOICES {
            assert!(seen.insert(voice.id), "duplicate id {}", voice.id);
        }
        for lang in ["zh", "en", "ja", "es"] {
            let pair = for_language(lang);
            assert_eq!(pair.len(), 2, "{lang} is not one male and one female");
            assert!(pair.iter().any(|voice| voice.female), "{lang} lacks a female voice");
            assert!(pair.iter().any(|voice| !voice.female), "{lang} lacks a male voice");
        }
    }

    #[test]
    fn old_app_ids_still_resolve() {
        assert_eq!(find("ref-male").unwrap().id, "en-male");
        assert_eq!(find("ref-female").unwrap().id, "en-female");
        assert_eq!(find("ZH-Female").unwrap().id, "zh-female");
        assert!(find("女性-温柔").is_none());
    }

    #[test]
    fn default_follows_the_declared_language_then_the_script() {
        assert_eq!(default_for(Some("zh-Hans"), "hello").id, "zh-female");
        assert_eq!(default_for(Some("es-419"), "hello").id, "es-female");
        // No language given: check the script
        assert_eq!(default_for(None, "今天天气不错").id, "zh-female");
        assert_eq!(default_for(None, "こんにちは、今日はいい天気").id, "ja-female");
        assert_eq!(default_for(None, "good morning").id, "en-female");
        // An unrecognized language code falls back to judging by script, rather than forcing the first voice
        assert_eq!(default_for(Some("kk"), "こんにちは").id, "ja-female");
    }

    #[test]
    fn builtin_ids_walk_through_the_preset_gate() {
        let presets: Vec<String> = ["Vivian", "Serena", "Ono_anna"].iter().map(|name| (*name).to_owned()).collect();
        // The model's own speaker: allowed through, case-insensitive
        assert!(!unknown_preset("vivian", &presets));
        // Built-in voice ids (including old aliases): also allowed through; the engine switches to the closest match
        assert!(!unknown_preset("zh-female", &presets));
        assert!(!unknown_preset("ref-female", &presets));
        // Names that neither table recognizes: these are the ones that should be rejected before the weights are loaded
        assert!(unknown_preset("nobody", &presets));
        // Engines without a speaker table are not blocked: that path uses the built-in voices
        assert!(!unknown_preset("nobody", &[]));
    }

    #[test]
    fn describe_only_engines_get_the_voice_as_a_style_line() {
        let mut request = TtsRequest::new("今天天气不错", VoiceSpec::Default);
        let style = style_for(&request, "Qwen3-TTS VoiceDesign").unwrap();
        assert_eq!(style.builtin, Some("zh-female"));
        assert_eq!(style.instruct.as_deref(), Some(find("zh-female").unwrap().describe));

        // The caller's own instruction is appended after the voice description; both are spoken
        request.instruct = Some("  用兴奋的语气  ".to_owned());
        let style = style_for(&request, "Qwen3-TTS VoiceDesign").unwrap();
        let instruct = style.instruct.unwrap();
        assert!(instruct.starts_with(find("zh-female").unwrap().describe), "{instruct}");
        assert!(instruct.ends_with("用兴奋的语气"), "{instruct}");

        // A specific built-in voice is named
        request.voice = VoiceSpec::Preset {
            speaker: "ja-male".to_owned(),
        };
        assert_eq!(style_for(&request, "Qwen3-TTS VoiceDesign").unwrap().builtin, Some("ja-male"));

        // Cloning cannot reach this path: the description is kept, and the built-in voice is empty (the caller reports the error itself)
        request.voice = VoiceSpec::Clone {
            reference_audio: PathBuf::from("/nope.wav"),
            reference_text: None,
        };
        let style = style_for(&request, "Qwen3-TTS VoiceDesign").unwrap();
        assert_eq!(style.builtin, None);
        assert_eq!(style.instruct.as_deref(), Some("用兴奋的语气"));
    }

    #[test]
    fn every_voice_has_its_own_description() {
        let mut seen = std::collections::BTreeSet::new();
        for voice in BUILTIN_VOICES {
            assert!(seen.insert(voice.describe), "{} has the same description as another voice", voice.id);
            assert!(voice.describe.is_ascii(), "{} description must be in English", voice.id);
            let gender = if voice.female { "female" } else { "male" };
            assert!(voice.describe.contains(gender), "{} description does not state the gender", voice.id);
        }
    }

    #[test]
    fn every_voice_has_its_recording_and_no_recording_is_orphaned() {
        assert_eq!(WAVS.len(), BUILTIN_VOICES.len());
        for (voice, (id, _)) in BUILTIN_VOICES.iter().zip(WAVS) {
            assert_eq!(voice.id, *id, "recording table order does not match the voice table");
        }
    }

    #[test]
    fn every_voice_is_a_playable_16k_mono_wav() {
        for voice in BUILTIN_VOICES {
            let (samples, rate) = decode_wav_pcm16(wav(voice)).unwrap();
            assert_eq!(rate, 16_000, "{}", voice.id);
            let seconds = samples.len() as f32 / rate as f32;
            assert!(
                (seconds - voice.seconds).abs() < 0.05,
                "{} table says {} seconds, actual {seconds:.2} seconds",
                voice.id,
                voice.seconds
            );
            assert!(samples.iter().any(|s| s.abs() > 0.1), "{} is silent", voice.id);
            assert!(!voice.text.trim().is_empty(), "{} has no reference text", voice.id);
        }
    }

    #[test]
    fn preset_and_default_resolve_to_a_builtin_recording() {
        let mut request = TtsRequest::new("你好", VoiceSpec::Default);
        let reference = reference_for(&request, "IndexTTS2").unwrap();
        assert_eq!(reference.audio, ReferenceAudio::Builtin("zh-female"));
        assert_eq!(reference.builtin, Some("zh-female"));
        assert!(reference.text.is_some());
        // Decoded in memory and resampled to 24 kHz: duration unchanged.
        let samples = reference.audio.samples(24_000).unwrap();
        let seconds = samples.len() as f32 / 24_000.0;
        assert!((seconds - find("zh-female").unwrap().seconds).abs() < 0.05, "{seconds}");

        request.voice = VoiceSpec::Preset {
            speaker: "ja-male".to_owned(),
        };
        assert_eq!(reference_for(&request, "IndexTTS2").unwrap().builtin, Some("ja-male"));

        request.voice = VoiceSpec::Preset {
            speaker: "nobody".to_owned(),
        };
        let error = reference_for(&request, "IndexTTS2").unwrap_err().to_string();
        assert!(error.contains("no built-in voice"), "{error}");
        assert!(error.contains("zh-female"), "{error}");
    }

    #[test]
    fn a_missing_clone_reference_still_fails() {
        let request = TtsRequest::new(
            "你好",
            VoiceSpec::Clone {
                reference_audio: PathBuf::from("/nope/does-not-exist.wav"),
                reference_text: None,
            },
        );
        assert!(reference_for(&request, "GPT-SoVITS").is_err());
    }
}

//! Translation body ↔ `TranscriptDoc`'s `trans` / `transDisplay` / `transAlign` / `transSrc` (video format spec §5.3).

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use serde_json::Map;
use sha2::{Digest, Sha256};
use speech_doc::doc::{
    AlignBlock, AlignMode, Correspondence as DocCorrespondence, TextBasis, TransAlign, TransDisplay, TransPiece, TranscriptDoc,
};
use speech_doc::sentence::derive_sentences;
use video_model::Id;
use video_model::translation::{
    AlignmentBasis, AlignmentBlock, AlignmentSplit, Correspondence, DisplayRewrite, SourceWordRange, SplitLegacy, SplitMode, SplitPiece,
    TRANSLATION_SCHEMA, TargetTextRange, TranslationBody, TranslationUnit, UnitAlignment, UnitStatus,
};

use crate::{BridgeError, WriteBase};

/// The prefix in `transSrc` that means "v3 marked it stale": `stale:<sourceFingerprint>`. It never equals any real fingerprint, so the subtitle and translation core treats the sentence as one whose source text has been changed.
const STALE_PREFIX: &str = "stale:";

pub(crate) fn to_doc(doc: &mut TranscriptDoc, bodies: &[TranslationBody]) -> Result<(), BridgeError> {
    for body in bodies {
        if body.schema != TRANSLATION_SCHEMA {
            return Err(BridgeError::new(format!(
                "translation body schema is {}, only {TRANSLATION_SCHEMA} is accepted",
                body.schema
            )));
        }
        let lang = body.language.clone();
        if doc.trans.contains_key(&lang) {
            return Err(BridgeError::new(format!("language {lang} has more than one translation")));
        }
        let mut trans = BTreeMap::new();
        let mut display = BTreeMap::new();
        let mut align = BTreeMap::new();
        let mut src = BTreeMap::new();
        for unit in &body.units {
            let sid = unit.source_sentence_id.clone();
            if trans.insert(sid.clone(), unit.natural_text.clone()).is_some() {
                return Err(BridgeError::new(format!("the {lang} translation has more than one unit for sentence {sid}")));
            }
            if unit.source_fingerprint.starts_with(STALE_PREFIX) {
                return Err(BridgeError::new(format!(
                    "unit {} sourceFingerprint must not start with {STALE_PREFIX}",
                    unit.id
                )));
            }
            if unit.status == UnitStatus::Stale {
                src.insert(sid.clone(), format!("{STALE_PREFIX}{}", unit.source_fingerprint));
            } else if !unit.source_fingerprint.is_empty() {
                src.insert(sid.clone(), unit.source_fingerprint.clone());
            }
            if let Some(rewrite) = &unit.display_rewrite {
                display.insert(
                    sid.clone(),
                    TransDisplay {
                        text: rewrite.text.clone(),
                        basis: rewrite.reason.clone(),
                        trans_fingerprint: rewrite.natural_fingerprint.clone().unwrap_or_default(),
                    },
                );
            }
            if let Some(alignment) = &unit.alignment
                && let Some(split) = &alignment.split
            {
                align.insert(sid.clone(), trans_align(&unit.id, alignment, split)?);
            }
        }
        doc.trans.insert(lang.clone(), trans);
        if !display.is_empty() {
            doc.trans_display.insert(lang.clone(), display);
        }
        if !align.is_empty() {
            doc.trans_align.insert(lang.clone(), align);
        }
        if !src.is_empty() {
            doc.trans_src.insert(lang, src);
        }
    }
    Ok(())
}

fn trans_align(unit_id: &str, alignment: &UnitAlignment, split: &AlignmentSplit) -> Result<TransAlign, BridgeError> {
    let position: HashMap<&str, usize> = alignment
        .source_word_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (id.as_str(), i))
        .collect();
    let index = |id: &str| {
        position
            .get(id)
            .copied()
            .ok_or_else(|| BridgeError::new(format!("alignment block of unit {unit_id} references word {id}, which is not in sourceWordIds")))
    };
    let mut blocks = Vec::with_capacity(alignment.blocks.len());
    for block in &alignment.blocks {
        blocks.push(AlignBlock {
            src: (
                index(&block.source_word_range.first_word_id)?,
                index(&block.source_word_range.last_word_id)?,
            ),
            tgt: (block.target_text_range.start as usize, block.target_text_range.end as usize),
            confidence: block.confidence.map(confidence_to_doc),
            flags: block.flags.clone().unwrap_or_default(),
        });
    }
    let legacy = split.legacy.clone().unwrap_or_default();
    let mut entry = TransAlign {
        mode: match split.mode {
            SplitMode::Independent => AlignMode::Independent,
            SplitMode::ManyToOne => AlignMode::ManyToOne,
            SplitMode::OneToOne => AlignMode::OneToOne,
        },
        crossing: legacy.crossing == Some(true),
        cues: legacy.cue_ids.unwrap_or_default(),
        words: if split.word_anchored {
            alignment.source_word_ids.clone()
        } else {
            Vec::new()
        },
        correspondence: split.correspondence.map(correspondence_to_doc),
        text_basis: match alignment.basis {
            AlignmentBasis::Natural => TextBasis::Trans,
            AlignmentBasis::DisplayRewrite => TextBasis::Display,
        },
        aligner: split.aligner.clone(),
        blocks,
        pieces: split
            .pieces
            .iter()
            .map(|piece| TransPiece {
                from: piece.from.map(|i| i as usize),
                to: piece.to.map(|i| i as usize),
                text: piece.text.clone(),
            })
            .collect(),
    };
    // When granularity is not written explicitly, it is derived from `mode`; if the derived value differs from `alignment.correspondence`, the latter wins and is written out explicitly.
    let declared = correspondence_to_doc(alignment.correspondence);
    if entry.correspondence() != declared {
        entry.correspondence = Some(declared);
    }
    Ok(entry)
}

fn correspondence_to_doc(value: Correspondence) -> DocCorrespondence {
    match value {
        Correspondence::Block => DocCorrespondence::Block,
        Correspondence::Sentence => DocCorrespondence::Sentence,
    }
}

fn correspondence_from_doc(value: DocCorrespondence) -> Correspondence {
    match value {
        DocCorrespondence::Block => Correspondence::Block,
        DocCorrespondence::Sentence => Correspondence::Sentence,
    }
}

/// The confidence in `TranscriptDoc` is an f32, while in the body it is a JSON number. Both sides use the shortest decimal form, so round-tripping does not change it.
fn confidence_to_doc(value: f64) -> f32 {
    format!("{value}").parse().unwrap_or(value as f32)
}

fn confidence_from_doc(value: f32) -> f64 {
    format!("{value}").parse().unwrap_or(value as f64)
}

/// `textHash` of a translation: sha256 of the UTF-8 bytes of the natural translated sentence (§5.3).
pub(crate) fn text_hash(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!("sha256:{hex}")
}

pub(crate) fn from_doc(doc: &TranscriptDoc, base: &WriteBase<'_>) -> Result<(Vec<TranslationBody>, Vec<String>), BridgeError> {
    for (table, langs) in [
        ("transSrc", doc.trans_src.keys().collect::<Vec<_>>()),
        ("transDisplay", doc.trans_display.keys().collect()),
        ("transAlign", doc.trans_align.keys().collect()),
    ] {
        if let Some(lang) = langs.into_iter().find(|lang| !doc.trans.contains_key(*lang)) {
            return Err(BridgeError::new(format!("{table} has language {lang}, but trans has none")));
        }
    }
    // The source sentence's visible words: alignment records with no base take `sourceWordIds` from here.
    let members: HashMap<String, Vec<Id>> = derive_sentences(doc, &[])
        .into_iter()
        .map(|sentence| {
            let ids = sentence.word_indices.iter().map(|&i| doc.words[i].id.clone()).collect();
            (sentence.id, ids)
        })
        .collect();
    let word_position: HashMap<&str, usize> = doc.words.iter().enumerate().map(|(i, w)| (w.id.as_str(), i)).collect();
    let first_word = |sid: &str| sid.strip_prefix("s-").and_then(|id| word_position.get(id).copied());

    let mut seen = HashSet::new();
    for body in base.translations {
        if !seen.insert(body.language.as_str()) {
            return Err(BridgeError::new(format!("the base draft has more than one translation for language {}", body.language)));
        }
    }
    let base_by_lang: HashMap<&str, &TranslationBody> = base.translations.iter().map(|b| (b.language.as_str(), b)).collect();
    let mut languages: Vec<&str> = base
        .translations
        .iter()
        .map(|b| b.language.as_str())
        .filter(|lang| doc.trans.contains_key(*lang))
        .collect();
    languages.extend(doc.trans.keys().map(String::as_str).filter(|lang| !base_by_lang.contains_key(lang)));
    let removed = base
        .translations
        .iter()
        .filter(|b| !doc.trans.contains_key(&b.language))
        .map(|b| b.language.clone())
        .collect();

    let mut bodies = Vec::with_capacity(languages.len());
    for lang in languages {
        let prior_body = base_by_lang.get(lang).copied();
        let trans = &doc.trans[lang];
        let empty = BTreeMap::new();
        let src = doc.trans_src.get(lang).unwrap_or(&empty);
        let display = doc.trans_display.get(lang);
        let align = doc.trans_align.get(lang);
        for (table, keys) in [
            ("transSrc", src.keys().collect::<Vec<_>>()),
            ("transDisplay", display.map(|d| d.keys().collect()).unwrap_or_default()),
            ("transAlign", align.map(|a| a.keys().collect()).unwrap_or_default()),
        ] {
            if let Some(sid) = keys.into_iter().find(|sid| !trans.contains_key(*sid)) {
                return Err(BridgeError::new(format!("{table}[{lang}] has sentence {sid}, but trans has none")));
            }
        }
        let prior_units: HashMap<&str, &TranslationUnit> = prior_body
            .map(|b| b.units.iter().map(|u| (u.source_sentence_id.as_str(), u)).collect())
            .unwrap_or_default();

        // Order: units in the base keep their original order; a new sentence is inserted before the first unit whose first word comes later, based on the position of its first word; if no first word can be found, it goes last.
        let mut order: Vec<&str> = prior_body
            .into_iter()
            .flat_map(|b| b.units.iter().map(|u| u.source_sentence_id.as_str()))
            .filter(|sid| trans.contains_key(*sid))
            .collect();
        let mut fresh: Vec<&str> = trans
            .keys()
            .map(String::as_str)
            .filter(|sid| !prior_units.contains_key(sid))
            .collect();
        fresh.sort_by_key(|sid| (first_word(sid).unwrap_or(usize::MAX), *sid));
        for sid in fresh {
            let at = first_word(sid).and_then(|mine| order.iter().position(|other| first_word(other).is_some_and(|theirs| theirs > mine)));
            order.insert(at.unwrap_or(order.len()), sid);
        }

        let mut used_ids: BTreeSet<String> = prior_units.values().map(|u| u.id.clone()).collect();
        let mut units = Vec::with_capacity(order.len());
        for sid in order {
            let prior = prior_units.get(sid).copied();
            let natural = &trans[sid];
            let (stale, fingerprint) = match src.get(sid) {
                Some(value) => match value.strip_prefix(STALE_PREFIX) {
                    Some(rest) => (true, rest.to_owned()),
                    None => (false, value.clone()),
                },
                None => (false, String::new()),
            };
            let display_rewrite = display.and_then(|d| d.get(sid)).map(|rewrite| {
                let prior_rewrite = prior.and_then(|p| p.display_rewrite.as_ref());
                DisplayRewrite {
                    text: rewrite.text.clone(),
                    reason: rewrite.basis.clone(),
                    reviewed: prior_rewrite.is_some_and(|p| p.reviewed && p.text == rewrite.text),
                    natural_fingerprint: (!rewrite.trans_fingerprint.is_empty()).then(|| rewrite.trans_fingerprint.clone()),
                    extra: prior_rewrite.map(|p| p.extra.clone()).unwrap_or_default(),
                }
            });
            let sentence_words = || members.get(sid).cloned().unwrap_or_default();
            let alignment = match align.and_then(|a| a.get(sid)) {
                Some(entry) => Some(alignment_from(
                    entry,
                    prior.and_then(|p| p.alignment.as_ref()),
                    natural,
                    sentence_words,
                )?),
                None => match prior {
                    // The base alignment has no explicit segmentation: keep it as is; if the translated sentence changed, only update the textHash.
                    Some(p) => match &p.alignment {
                        None => None,
                        Some(a) if a.split.is_none() => {
                            let mut kept = a.clone();
                            if p.natural_text != *natural {
                                kept.text_hash = text_hash(natural);
                            }
                            Some(kept)
                        }
                        Some(a) => Some(sentence_alignment(a.source_word_ids.clone(), natural)),
                    },
                    None => Some(sentence_alignment(sentence_words(), natural)),
                },
            };
            let unchanged = prior.is_some_and(|p| {
                p.natural_text == *natural && p.display_rewrite.as_ref().map(|d| &d.text) == display_rewrite.as_ref().map(|d| &d.text)
            });
            let status = match prior {
                _ if stale => UnitStatus::Stale,
                Some(p) if unchanged && p.status != UnitStatus::Stale => p.status,
                _ => UnitStatus::Draft,
            };
            let id = match prior {
                Some(p) => p.id.clone(),
                None => {
                    let mut id = format!("t-{sid}");
                    let mut n = 2;
                    while used_ids.contains(&id) {
                        id = format!("t-{sid}-{n}");
                        n += 1;
                    }
                    used_ids.insert(id.clone());
                    id
                }
            };
            units.push(TranslationUnit {
                id,
                source_sentence_id: sid.to_owned(),
                source_fingerprint: fingerprint,
                natural_text: natural.clone(),
                display_rewrite,
                alignment,
                status,
                extra: prior.map(|p| p.extra.clone()).unwrap_or_default(),
            });
        }

        let source_basis = match prior_body {
            Some(b) => b.source_basis.clone(),
            None => base
                .source_basis
                .cloned()
                .ok_or_else(|| BridgeError::new(format!("the translation for new language {lang} needs sourceBasis")))?,
        };
        bodies.push(TranslationBody {
            schema: TRANSLATION_SCHEMA.to_owned(),
            language: lang.to_owned(),
            source_basis,
            glossary_ref: prior_body.and_then(|b| b.glossary_ref.clone()),
            units,
            extra: prior_body.map(|b| b.extra.clone()).unwrap_or_default(),
        });
    }
    Ok((bodies, removed))
}

/// Sentence-level correspondence record used when there is no explicit segmentation (same as the translation flow writes).
fn sentence_alignment(source_word_ids: Vec<Id>, natural: &str) -> UnitAlignment {
    UnitAlignment {
        basis: AlignmentBasis::Natural,
        correspondence: Correspondence::Sentence,
        blocks: Vec::new(),
        source_word_ids,
        text_hash: text_hash(natural),
        split: None,
        extra: Map::new(),
    }
}

fn alignment_from(
    entry: &TransAlign,
    prior: Option<&UnitAlignment>,
    natural: &str,
    sentence_words: impl Fn() -> Vec<Id>,
) -> Result<UnitAlignment, BridgeError> {
    // The words pointed to by the source-side indices of pieces and blocks: if there are word anchors, those are the words; otherwise use the base's sourceWordIds; failing that, the source sentence's currently visible words.
    let source_word_ids = if !entry.words.is_empty() {
        entry.words.clone()
    } else if let Some(prior) = prior {
        prior.source_word_ids.clone()
    } else {
        sentence_words()
    };
    let prior_split = prior.and_then(|p| p.split.as_ref());
    let mut blocks = Vec::with_capacity(entry.blocks.len());
    for (i, block) in entry.blocks.iter().enumerate() {
        let word = |index: usize| {
            source_word_ids
                .get(index)
                .cloned()
                .ok_or_else(|| BridgeError::new(format!("alignment block source index {index} is out of range for {} words", source_word_ids.len())))
        };
        let range = SourceWordRange {
            first_word_id: word(block.src.0)?,
            last_word_id: word(block.src.1)?,
        };
        let target = TargetTextRange {
            start: block.tgt.0 as u64,
            end: block.tgt.1 as u64,
        };
        // If the block range at the same position in the base is unchanged, keep its ID and extension fields.
        let same = prior
            .and_then(|p| p.blocks.get(i))
            .filter(|p| p.source_word_range == range && p.target_text_range == target);
        blocks.push(AlignmentBlock {
            id: same.map(|p| p.id.clone()).unwrap_or_else(|| format!("b{}", i + 1)),
            source_word_range: range,
            target_text_range: target,
            confidence: block.confidence.map(confidence_from_doc),
            flags: (!block.flags.is_empty()).then(|| block.flags.clone()),
            extra: same.map(|p| p.extra.clone()).unwrap_or_default(),
        });
    }
    let legacy = (entry.crossing || !entry.cues.is_empty()).then(|| SplitLegacy {
        crossing: entry.crossing.then_some(true),
        cue_ids: (!entry.cues.is_empty()).then(|| entry.cues.clone()),
    });
    Ok(UnitAlignment {
        basis: match entry.text_basis {
            TextBasis::Trans => AlignmentBasis::Natural,
            TextBasis::Display => AlignmentBasis::DisplayRewrite,
        },
        correspondence: correspondence_from_doc(entry.correspondence()),
        blocks,
        source_word_ids,
        text_hash: text_hash(natural),
        split: Some(AlignmentSplit {
            mode: match entry.mode {
                AlignMode::Independent => SplitMode::Independent,
                AlignMode::ManyToOne => SplitMode::ManyToOne,
                AlignMode::OneToOne => SplitMode::OneToOne,
            },
            word_anchored: !entry.words.is_empty(),
            correspondence: entry.correspondence.map(correspondence_from_doc),
            aligner: entry.aligner.clone(),
            pieces: entry
                .pieces
                .iter()
                .map(|piece| SplitPiece {
                    text: piece.text.clone(),
                    from: piece.from.map(|i| i as u64),
                    to: piece.to.map(|i| i as u64),
                })
                .collect(),
            legacy,
            extra: prior_split.map(|p| p.extra.clone()).unwrap_or_default(),
        }),
        extra: prior.map(|p| p.extra.clone()).unwrap_or_default(),
    })
}

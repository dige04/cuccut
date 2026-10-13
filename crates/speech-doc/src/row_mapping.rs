//! Shared mapping between ASR row order and `g<row>.<column>[~atom]` word ids.
//!
//! `build_doc`, speaker row-attribution recovery, and the initial soft segmentation must replay the same rule: "drop empty rows, then stable-sort by start". Keeping it centralized here prevents the three readers from each guessing row numbers.

use std::collections::BTreeMap;

use crate::asr_rows::RowIn;

use crate::doc::TranscriptDoc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RowWordMap {
    /// Zero-based row number after replaying the row order through `build_doc`.
    pub row_index: usize,
    pub first_word_index: usize,
    pub last_word_index: usize,
}

pub fn sorted_nonempty_rows(rows: &[RowIn]) -> Vec<&RowIn> {
    let mut sorted = rows
        .iter()
        .filter(|row| !row.text.trim().is_empty())
        .collect::<Vec<_>>();
    // slice::sort_by is a stable sort; input rows with the same start keep their file order.
    sorted.sort_by(|left, right| left.start.total_cmp(&right.start));
    sorted
}

pub fn row_has_atoms(row: &RowIn) -> bool {
    match row.words.as_ref().filter(|words| !words.is_empty()) {
        Some(words) => words
            .iter()
            .any(|word| !crate::atomize::atomize(word.text.trim()).is_empty()),
        None => !crate::atomize::atomize(row.text.trim()).is_empty(),
    }
}

/// Parse `g<row>.<column>[~atom]`, returning zero-based `(row, column, atom)`.
pub fn row_column_of(id: &str) -> Option<(usize, usize, usize)> {
    let (row, column) = id.strip_prefix('g')?.split_once('.')?;
    if row.is_empty() || column.is_empty() {
        return None;
    }
    let row = row.parse::<usize>().ok()?;
    if row == 0 {
        return None;
    }
    let (column, atom) = match column.split_once('~') {
        Some((column, atom)) if !column.is_empty() && !atom.is_empty() => {
            (column.parse::<usize>().ok()?, atom.parse::<usize>().ok()?)
        }
        Some(_) => return None,
        None => (column.parse::<usize>().ok()?, 0),
    };
    Some((row - 1, column, atom))
}

pub fn row_index_of(id: &str) -> Option<usize> {
    row_column_of(id).map(|(row, _, _)| row)
}

pub fn has_initial_row_ids(doc: &TranscriptDoc) -> bool {
    !doc.words.is_empty()
        && doc
            .words
            .iter()
            .all(|word| row_column_of(&word.id).is_some())
}

/// Returns only the rows that actually produce words. The first word is chosen by the smallest `(column, atom)`, without assuming column numbers start at 0. Empty-atom rows occupy a row number but produce no mapping.
pub fn row_word_maps(doc: &TranscriptDoc, rows: &[RowIn]) -> Vec<RowWordMap> {
    let sorted = sorted_nonempty_rows(rows);
    let mut by_row: BTreeMap<usize, Vec<(usize, usize, usize)>> = BTreeMap::new();
    for (word_index, word) in doc.words.iter().enumerate() {
        let Some((row, column, atom)) = row_column_of(&word.id) else {
            continue;
        };
        if row < sorted.len() {
            by_row
                .entry(row)
                .or_default()
                .push((column, atom, word_index));
        }
    }

    by_row
        .into_iter()
        .filter_map(|(row_index, mut words)| {
            if !row_has_atoms(sorted[row_index]) || words.is_empty() {
                return None;
            }
            words.sort_by_key(|&(column, atom, _)| (column, atom));
            let first_word_index = words.first()?.2;
            let last_word_index = words.iter().map(|&(_, _, index)| index).max()?;
            Some(RowWordMap {
                row_index,
                first_word_index,
                last_word_index,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::asr_rows::WordIn;
    use crate::build::build_doc;
    use crate::doc::{DocEngine, DocMedia};

    fn doc(rows: &[RowIn]) -> TranscriptDoc {
        build_doc(
            rows,
            DocMedia {
                id: None,
                path: None,
                hash: "sha256-test".to_owned(),
                duration: 20.0,
                sample_rate: Some(16_000),
            },
            "en",
            DocEngine {
                name: "test".to_owned(),
                version: None,
                aligned_words: true,
            },
            None,
        )
    }

    #[test]
    fn parser_accepts_atoms_and_rejects_rebound_ids() {
        assert_eq!(row_column_of("g12.3~2"), Some((11, 3, 2)));
        assert_eq!(row_column_of("g1.0"), Some((0, 0, 0)));
        assert_eq!(row_column_of("g0.1"), None);
        assert_eq!(row_column_of("wabc-0"), None);
    }

    #[test]
    fn mapping_replays_stable_sort_and_uses_the_smallest_real_column() {
        let mut later = RowIn::new(5.0, 6.0, "later");
        later.words = Some(vec![
            WordIn {
                start: 5.0,
                end: 5.2,
                text: "".to_owned(),
            },
            WordIn {
                start: 5.2,
                end: 6.0,
                text: "later".to_owned(),
            },
        ]);
        let earlier = RowIn::new(1.0, 2.0, "first");
        let document = doc(&[later.clone(), earlier.clone()]);
        let maps = row_word_maps(&document, &[later, earlier]);
        assert_eq!(document.words[maps[0].first_word_index].id, "g1.0");
        assert_eq!(document.words[maps[1].first_word_index].id, "g2.1");
    }
}

//! Sequence LCS matching (cross-checked against voice-ink `SegmentLCS.lcsMatches`).
//!
//! The common prefix and suffix are stripped first; the middle-section DP is bounded by a cell budget (it returns `None` when exceeded, and the caller falls back to the next degradation level). The integer-division form `rows <= cap / columns` is locked by tests.
//!
//! When the middle section is ≤ [`FULL_TABLE_CELLS`], the full length table is filled and backtracked (the historical path; the results match voice-ink bit for bit). Larger tables switch to linear-space Hirschberg divide-and-conquer: memory O(n+m), time about 2×n×m. Both paths return a match count equal to the LCS length; only the specific pairing may differ when lengths are equal. This is why the algorithm is deliberately not switched below the threshold: it avoids drift in the re-anchoring of existing pages' boundaries.
//!
//! Why the second path exists: in Chinese each character is one atom, so a page of 8000–10000 atoms gives a table of 64–100 million cells. A full table (u32) needs 256–400 MB, and the old cap of 25 million returned `None` directly. For polish this means **no answer can be re-anchored**: even a zero-change answer, identical character by character, fails as soon as there is one difference in the middle section (prefix/suffix stripping cannot save it). The engine then treats it as a model error, retries 3 times, and finally falls back to the whole page. Capacity should be guaranteed by the algorithm, not left for the paginator to guess.

/// Cell cap for the full length table of the middle section (u32 per cell, about 100 MB). Within it, full-table backtracking is used; beyond it, Hirschberg.
pub const FULL_TABLE_CELLS: usize = 25_000_000;

/// The total cell budget of the middle-section DP (a time cap): above it, returns `None`. Hirschberg memory is independent of size; this limit only guards against pathological input (for example, the model repeating the whole page ten times) dragging a single check into minutes. 250 million cells ≈ 15.8k × 15.8k atoms, about 1–2 s in a release build.
pub const LCS_CELL_CAP: usize = 250_000_000;

/// Returns the ordered matched pairs `(indexA, indexB)`; returns `None` when the table size exceeds `cell_cap`.
pub fn lcs_matches(a: &[u32], b: &[u32], cell_cap: usize) -> Option<Vec<(usize, usize)>> {
    let mut prefix = 0;
    while prefix < a.len() && prefix < b.len() && a[prefix] == b[prefix] {
        prefix += 1;
    }
    let mut suffix = 0;
    while suffix < a.len() - prefix
        && suffix < b.len() - prefix
        && a[a.len() - 1 - suffix] == b[b.len() - 1 - suffix]
    {
        suffix += 1;
    }
    let mid_a = &a[prefix..a.len() - suffix];
    let mid_b = &b[prefix..b.len() - suffix];
    let rows = mid_a.len() + 1;
    let columns = mid_b.len() + 1;
    // Integer division is deliberate (the 15→nil / 16→[] boundary is locked by voice-ink tests).
    if rows > cell_cap / columns {
        return None;
    }

    let mut matches: Vec<(usize, usize)> = (0..prefix).map(|i| (i, i)).collect();

    if !mid_a.is_empty() && !mid_b.is_empty() {
        if rows <= FULL_TABLE_CELLS / columns {
            full_table_matches(mid_a, mid_b, prefix, prefix, &mut matches);
        } else {
            hirschberg_matches(mid_a, mid_b, prefix, prefix, &mut matches);
        }
    }

    for k in (0..suffix).rev() {
        matches.push((a.len() - 1 - k, b.len() - 1 - k));
    }
    Some(matches)
}

/// Full-table path: fill the table in reverse (a length matrix; u32 is enough), then backtrack forward.
fn full_table_matches(
    a: &[u32],
    b: &[u32],
    offset_a: usize,
    offset_b: usize,
    matches: &mut Vec<(usize, usize)>,
) {
    let stride = b.len() + 1;
    let mut table = vec![0_u32; (a.len() + 1) * stride];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            table[i * stride + j] = if a[i] == b[j] {
                table[(i + 1) * stride + j + 1] + 1
            } else {
                table[(i + 1) * stride + j].max(table[i * stride + j + 1])
            };
        }
    }
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            matches.push((offset_a + i, offset_b + j));
            i += 1;
            j += 1;
        } else if table[(i + 1) * stride + j] >= table[i * stride + j + 1] {
            i += 1;
        } else {
            j += 1;
        }
    }
}

/// `row[j] = LCS(a, b[..j])` (the forward length row).
fn lcs_row_forward(a: &[u32], b: &[u32]) -> Vec<u32> {
    let mut previous = vec![0_u32; b.len() + 1];
    let mut current = vec![0_u32; b.len() + 1];
    for &ca in a {
        current[0] = 0;
        for (j, &cb) in b.iter().enumerate() {
            current[j + 1] = if ca == cb {
                previous[j] + 1
            } else {
                previous[j + 1].max(current[j])
            };
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous
}

/// `row[j] = LCS(a, b[j..])` (the reverse length row).
fn lcs_row_backward(a: &[u32], b: &[u32]) -> Vec<u32> {
    let mut previous = vec![0_u32; b.len() + 1];
    let mut current = vec![0_u32; b.len() + 1];
    for &ca in a.iter().rev() {
        current[b.len()] = 0;
        for j in (0..b.len()).rev() {
            current[j] = if ca == b[j] {
                previous[j + 1] + 1
            } else {
                previous[j].max(current[j + 1])
            };
        }
        std::mem::swap(&mut previous, &mut current);
    }
    previous
}

/// Hirschberg divide-and-conquer: split `a` at its midline, use the forward and reverse length rows to find the optimal split point in `b`, and recurse down to single elements, taking the first equal position directly. Output is appended in order to `matches`.
fn hirschberg_matches(
    a: &[u32],
    b: &[u32],
    offset_a: usize,
    offset_b: usize,
    matches: &mut Vec<(usize, usize)>,
) {
    if a.is_empty() || b.is_empty() {
        return;
    }
    if a.len() == 1 {
        if let Some(j) = b.iter().position(|&x| x == a[0]) {
            matches.push((offset_a, offset_b + j));
        }
        return;
    }
    if b.len() == 1 {
        if let Some(i) = a.iter().position(|&x| x == b[0]) {
            matches.push((offset_a + i, offset_b));
        }
        return;
    }
    let mid = a.len() / 2;
    let forward = lcs_row_forward(&a[..mid], b);
    let backward = lcs_row_backward(&a[mid..], b);
    let mut best = 0usize;
    let mut best_len = 0u32;
    for j in 0..=b.len() {
        let total = forward[j] + backward[j];
        if total > best_len {
            best_len = total;
            best = j;
        }
    }
    hirschberg_matches(&a[..mid], &b[..best], offset_a, offset_b, matches);
    hirschberg_matches(
        &a[mid..],
        &b[best..],
        offset_a + mid,
        offset_b + best,
        matches,
    );
}

/// Atom interner: maps string keys to compact integers, for use by [`lcs_matches`].
#[derive(Default)]
pub struct AtomInterner {
    keys: std::collections::HashMap<String, u32>,
}

impl AtomInterner {
    pub fn intern(&mut self, key: &str) -> u32 {
        if let Some(&id) = self.keys.get(key) {
            return id;
        }
        let id = self.keys.len() as u32;
        self.keys.insert(key.to_owned(), id);
        id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cell_cap_boundary_is_integer_division() {
        // 3+1=4 rows × 4 columns = 16 cells: cap 15 → None, cap 16 → empty matches
        assert_eq!(lcs_matches(&[1, 2, 3], &[4, 5, 6], 15), None);
        assert_eq!(lcs_matches(&[1, 2, 3], &[4, 5, 6], 16), Some(vec![]));
    }

    #[test]
    fn prefix_suffix_and_middle_are_all_matched() {
        let a = [1, 2, 9, 3, 4];
        let b = [1, 2, 8, 3, 4];
        let matches = lcs_matches(&a, &b, LCS_CELL_CAP).unwrap();
        assert_eq!(matches, vec![(0, 0), (1, 1), (3, 3), (4, 4)]);
    }

    #[test]
    fn near_identical_long_sequences_match_almost_fully() {
        let a: Vec<u32> = (0..4500).collect();
        let mut b = a.clone();
        b[1000] = 999_999;
        b[2000] = 999_998;
        b[3000] = 999_997;
        let matches = lcs_matches(&a, &b, LCS_CELL_CAP).unwrap();
        assert_eq!(matches.len(), 4497);
    }

    /// On the same input, the full-table and Hirschberg paths give the same match count; the matched pairs are both valid and strictly increasing.
    fn assert_valid_lcs(a: &[u32], b: &[u32], matches: &[(usize, usize)], expected_len: usize) {
        assert_eq!(matches.len(), expected_len);
        let mut last: Option<(usize, usize)> = None;
        for &(i, j) in matches {
            assert_eq!(a[i], b[j], "pair ({i},{j}) is not a match");
            if let Some((pi, pj)) = last {
                assert!(i > pi && j > pj, "pairs must be strictly increasing");
            }
            last = Some((i, j));
        }
    }

    #[test]
    fn hirschberg_agrees_with_full_table_on_random_like_inputs() {
        // Deterministic pseudo-random numbers (LCG), with a small alphabet to produce many repeated keys.
        let mut seed = 0x2545_F491_u64;
        let mut next = || {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            (seed >> 33) as u32 % 7
        };
        for round in 0..40 {
            let n = 1 + (round * 7) % 53;
            let m = 1 + (round * 11) % 47;
            let a: Vec<u32> = (0..n).map(|_| next()).collect();
            let b: Vec<u32> = (0..m).map(|_| next()).collect();
            let mut full = Vec::new();
            full_table_matches(&a, &b, 0, 0, &mut full);
            let mut hb = Vec::new();
            hirschberg_matches(&a, &b, 0, 0, &mut hb);
            assert_valid_lcs(&a, &b, &full, full.len());
            assert_valid_lcs(&a, &b, &hb, full.len());
        }
    }

    /// Report scenario: a Chinese page of about 10k atoms, with one difference at the head and one at the tail of the answer. Prefix/suffix stripping cannot save it, and the middle section is still nearly the whole page. Under the old cap it returned `None` (no answer can be re-anchored); now it must re-anchor successfully, with match count = length − number of differences.
    #[test]
    fn ten_thousand_atom_page_with_two_edits_is_matched_via_hirschberg() {
        let n = 10_111usize;
        let a: Vec<u32> = (0..n as u32).map(|x| x % 3000).collect();
        let mut b = a.clone();
        b[5] = 999_999;
        b[n - 6] = 999_998;
        assert!(
            (n - 10) * (n - 10) > FULL_TABLE_CELLS,
            "must exercise Hirschberg"
        );
        let matches = lcs_matches(&a, &b, LCS_CELL_CAP).unwrap();
        assert_valid_lcs(&a, &b, &matches, n - 2);
    }

    #[test]
    fn oversized_table_still_returns_none_at_the_time_cap() {
        let a: Vec<u32> = (0..20_000).collect();
        let mut b = a.clone();
        b[10] = 1;
        b[19_990] = 2;
        assert_eq!(lcs_matches(&a, &b, LCS_CELL_CAP), None);
    }

    #[test]
    fn interner_assigns_stable_dense_ids() {
        let mut interner = AtomInterner::default();
        let a = interner.intern("hello");
        let b = interner.intern("world");
        assert_eq!(interner.intern("hello"), a);
        assert_ne!(a, b);
    }
}

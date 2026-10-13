//! Shared source-word boundary logic. Translation alignment keeps its original criteria. For English source Cues, an unbreakable-phrase protection is layered on top.

use crate::atomize::join_word_texts;
use crate::seam::{ends_dangling, source_boundary_strength};

/// Cut points for source Cues are stricter than cross-language alignment. Function words must not hang at the end of a line, and known fixed phrases must not be split.
/// This is not a syntactic parser. It only constrains high-confidence structures, and it does not guess that unknown ordinary word pairs are noun phrases.
/// Callers enable this only for en / en-* scripts. Explicit user breakpoints still take higher priority.
pub(crate) fn english_cue_boundary_issue(words: &[&str], boundary: usize) -> Option<String> {
    if boundary == 0 || boundary >= words.len() || source_boundary_strength(words, boundary) >= 3 {
        return None;
    }
    if let Some(issue) = source_boundary_issue(words, boundary) {
        return Some(issue);
    }
    let tokens: Vec<_> = words
        .iter()
        .map(|word| {
            normalized_source_lexemes(word)
                .into_iter()
                .next_back()
                .unwrap_or_default()
        })
        .collect();
    let tail = tokens[boundary - 1].as_str();
    // When these words are left at the end of a line without punctuation, they still depend on what follows. The natural pause after punctuation is kept, so “Yes, you can. | Next ...” is not blocked by this table.
    const BOUND_TAILS: &[&str] = &[
        "in",
        "on",
        "at",
        "with",
        "from",
        "for",
        "into",
        "onto",
        "within",
        "without",
        "under",
        "over",
        "between",
        "through",
        "by",
        "during",
        "about",
        "as",
        "if",
        "when",
        "while",
        "because",
        "although",
        "unless",
        "until",
        "whether",
        "where",
        "which",
        "who",
        "whose",
        "whom",
        "what",
        "how",
        "why",
        "very",
        "quite",
        "rather",
        "too",
        "most",
        "not",
        "cannot",
        "can't",
        "don't",
        "doesn't",
        "didn't",
        "isn't",
        "aren't",
        "wasn't",
        "weren't",
        "won't",
        "wouldn't",
        "couldn't",
        "shouldn't",
        "mustn't",
        "hasn't",
        "haven't",
        "hadn't",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "will",
        "would",
        "can",
        "could",
        "should",
        "must",
        "might",
        "may",
        "shall",
        "i",
        "we",
        "you",
        "he",
        "she",
        "it",
        "they",
        "i'm",
        "you're",
        "we're",
        "they're",
        "it's",
        "that's",
        "there's",
        "i've",
        "you've",
        "we've",
        "they've",
    ];
    if BOUND_TAILS.contains(&tail) {
        return Some(format!(
            "bound English cue tail \"{}\"",
            words[boundary - 1]
        ));
    }
    const PHRASES: &[&[&str]] = &[
        &["sort", "of"],
        &["kind", "of"],
        &["in", "terms", "of"],
        &["as", "well", "as"],
        &["such", "as"],
        &["at", "least"],
        &["rather", "than"],
        &["even", "though"],
        &["even", "if"],
        &["national", "security"],
        &["artificial", "intelligence"],
        &["machine", "learning"],
        &["data", "center"],
        &["data", "centers"],
    ];
    for phrase in PHRASES {
        for split in 1..phrase.len() {
            if boundary >= split {
                let start = boundary - split;
                if tokens
                    .get(start..start + phrase.len())
                    .is_some_and(|part| part.iter().map(String::as_str).eq(phrase.iter().copied()))
                {
                    return Some(format!("fixed English phrase \"{}\"", phrase.join(" ")));
                }
            }
        }
    }
    None
}

/// High-confidence clause starts after a comma. Noun enumerations and filler such as like / basically are not in this table.
pub(crate) fn english_clause_start(word: &str) -> bool {
    let token = normalized_source_lexemes(word)
        .into_iter()
        .next()
        .unwrap_or_default();
    matches!(
        token.as_str(),
        "i" | "we"
            | "you"
            | "he"
            | "she"
            | "it"
            | "they"
            | "i'm"
            | "we're"
            | "you're"
            | "they're"
            | "it's"
            | "that's"
            | "there's"
            | "but"
            | "because"
            | "although"
            | "if"
            | "when"
            | "while"
            | "unless"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cue_guards_use_both_sides_without_changing_alignment_rules() {
        for (words, boundary) in [
            (vec!["a", "national", "security", "issue"], 2),
            (vec!["the", "sort", "of", "scenario"], 2),
            (vec!["very", "dangerous"], 1),
            (vec!["if", "you", "control", "AI"], 2),
            (vec!["a", "place", "where", "we", "work"], 3),
            (vec!["we", "are", "not", "ready"], 3),
            (vec!["need", "to", "write"], 1),
        ] {
            assert!(
                english_cue_boundary_issue(&words, boundary).is_some(),
                "{words:?}"
            );
        }
        // The constraints added to Cue do not change the calling contract of translation alignment.
        assert!(source_boundary_issue(&["national", "security"], 1).is_none());
        assert!(source_boundary_issue(&["very", "dangerous"], 1).is_none());
        for (words, boundary) in [
            (vec!["AI,", "you", "know"], 1),
            (vec!["we", "can.", "Next"], 2),
            (vec!["use", "this", "when", "needed"], 2),
            (vec!["each", "other", "across", "town"], 2),
            (vec!["security", "policy"], 1),
        ] {
            assert!(
                english_cue_boundary_issue(&words, boundary).is_none(),
                "{words:?}"
            );
        }
    }
}

pub(crate) fn normalized_source_lexemes(text: &str) -> Vec<String> {
    text.to_ascii_lowercase()
        .split(|ch: char| !ch.is_alphanumeric() && ch != '\'' && ch != '-')
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Without a parser, only high-confidence source-language fragments are blocked. General unpunctuated phrases are still left to the LLM to judge. An article, possessive, or common pre-modifier hanging at the end of a fragment is definitely not a complete semantic unit.
pub fn source_boundary_issue(words: &[&str], boundary: usize) -> Option<String> {
    if boundary == 0 || boundary >= words.len() || source_boundary_strength(words, boundary) >= 3 {
        return None;
    }
    let left = join_word_texts(words[..boundary].iter().copied());
    if ends_dangling(&left) {
        return Some(format!("dangling source tail \"{}\"", words[boundary - 1]));
    }
    let tail = normalized_source_lexemes(words[boundary - 1])
        .into_iter()
        .next_back()
        .unwrap_or_default();
    let head = normalized_source_lexemes(words[boundary])
        .into_iter()
        .next()
        .unwrap_or_default();
    let next = words
        .get(boundary + 1)
        .and_then(|word| normalized_source_lexemes(word).into_iter().next())
        .unwrap_or_default();
    // High-confidence English infinitive complements: `need | to write prompts` would split the predicate's required complement onto the next line. It must not be allowed just because there happens to be a light pause or seam1 here. Only governing words that can be identified with high confidence are listed, to avoid banning directional phrases like `walk | to the store` that can stand alone.
    const INFINITIVE_COMPLEMENT_HEADS: &[&str] = &[
        "afford",
        "afforded",
        "agree",
        "agreed",
        "aim",
        "aimed",
        "attempt",
        "attempted",
        "choose",
        "chose",
        "decide",
        "decided",
        "expect",
        "expected",
        "fail",
        "failed",
        "hope",
        "hoped",
        "intend",
        "intended",
        "learn",
        "learned",
        "manage",
        "managed",
        "need",
        "needed",
        "needs",
        "plan",
        "planned",
        "prefer",
        "preferred",
        "promise",
        "promised",
        "refuse",
        "refused",
        "try",
        "tried",
        "tries",
        "want",
        "wanted",
        "wants",
        "wish",
        "wished",
    ];
    if head == "to" && !next.is_empty() && INFINITIVE_COMPLEMENT_HEADS.contains(&tail.as_str()) {
        return Some(format!(
            "source infinitive complement \"{} to {}\" is split before its required complement",
            words[boundary - 1],
            words[boundary + 1]
        ));
    }
    if tail == "it" && head == "this" && next == "way" {
        return Some("fixed expression \"do it this way\" is split inside the phrase".to_owned());
    }
    const JAPANESE_BOUND_PARTICLES: &[&str] = &[
        "は",
        "が",
        "を",
        "に",
        "で",
        "と",
        "の",
        "へ",
        "も",
        "や",
        "から",
        "まで",
        "より",
        "ので",
        "のに",
        "けど",
        "けれど",
    ];
    if JAPANESE_BOUND_PARTICLES.contains(&head.as_str()) {
        return Some(format!(
            "Japanese bound particle \"{}\" would start the next segment",
            words[boundary]
        ));
    }
    const BOUND_MODIFIERS: &[&str] = &[
        "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
        "each", "every", "some", "any", "no", "new", "other", "same", "first", "last", "next",
        "own", "more", "less", "many", "much", "few", "several",
    ];
    // `thought that | proposition` style reporting bridges are often compressed in the target language into “参与者认为，| 命题” (the participant thinks, | proposition). This is a high-quality bilingual boundary. Do not tag the complementizer that as a determiner. Other `that | noun/clause` cases keep the risk warning.
    const REPORTING_VERBS: &[&str] = &[
        "argue", "argued", "believe", "believed", "claim", "claimed", "find", "found", "know",
        "knew", "say", "said", "show", "showed", "think", "thought",
    ];
    let previous = boundary
        .checked_sub(2)
        .and_then(|index| {
            normalized_source_lexemes(words[index])
                .into_iter()
                .next_back()
        })
        .unwrap_or_default();
    let reporting_bridge =
        tail == "that" && boundary >= 2 && REPORTING_VERBS.contains(&previous.as_str());
    // `each other | across ...` is already closed after the complete reciprocal phrase. Do not misjudge this natural boundary as a dangling modifier just because the final word `other` is also a common pre-modifier.
    let reciprocal_complete = tail == "other"
        && boundary >= 2
        && normalized_source_lexemes(words[boundary - 2])
            .into_iter()
            .next_back()
            .is_some_and(|token| token == "each");
    // `doing this | ...`, `reach for this | ...`: when this/that/these/those follows a transitive verb or preposition, and the next fragment starts with a function word (a conjunction, pronoun, copula, adverbial, or any word that cannot serve as a noun head), it is an object pronoun rather than a determiner, and this boundary is complete. Genuine determiner uses such as `use this | model` keep the warning.
    const PRONOUN_OBJECT_HEADS: &[&str] = &[
        "do", "does", "did", "doing", "done", "for", "to", "with", "into", "at", "on", "about",
        "from", "of", "in", "by", "like", "reach", "reaches", "reached", "try", "tries", "tried",
        "use", "uses", "used", "using", "see", "sees", "saw", "seen", "watch", "watches",
        "watched", "know", "knew", "known", "get", "gets", "got", "make", "makes", "made", "take",
        "takes", "took", "say", "says", "said", "build", "builds", "built", "fix", "fixes",
        "fixed", "solve", "solves", "solved",
    ];
    const CLAUSE_STARTERS: &[&str] = &[
        "and", "but", "so", "or", "because", "if", "when", "while", "then", "instead", "again",
        "now", "also", "today", "first", "next", "later", "though", "although", "since", "as",
        "we", "you", "they", "he", "she", "it", "i", "there", "that", "who", "which", "is", "are",
        "was", "were", "will", "would", "can", "could", "should", "let", "to", "in", "at", "for",
        "with", "on", "by", "from", "of", "without",
    ];
    let pronoun_object = matches!(tail.as_str(), "this" | "that" | "these" | "those")
        && PRONOUN_OBJECT_HEADS.contains(&previous.as_str())
        && CLAUSE_STARTERS.contains(&head.as_str());
    if BOUND_MODIFIERS.contains(&tail.as_str())
        && !reporting_bridge
        && !reciprocal_complete
        && !pronoun_object
    {
        return Some(format!(
            "source modifier \"{}\" is detached from its noun phrase",
            words[boundary - 1]
        ));
    }
    const RELATION_TAILS: &[&str] = &["thanks", "because", "due", "owing"];
    RELATION_TAILS.contains(&tail.as_str()).then(|| {
        format!(
            "source relation \"{} {}\" is split before its complement",
            words[boundary - 1],
            words[boundary]
        )
    })
}

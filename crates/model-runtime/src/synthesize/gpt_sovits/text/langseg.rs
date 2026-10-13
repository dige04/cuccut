//! Mixed Chinese/English segmentation: a port of GPT-SoVITS `LangSegmenter.getTexts` (split-lang 2.1's `LangSplitter.split_by_lang`, `merge_across_digit=False`), plus the merge of the Chinese and English segments in the inference side's zh mode.
//!
//! Upstream detects the language with fast_langdetect (a fastText model). Here it is replaced by a deterministic "rule C": a Han-character block is always zh; other blocks are en if they contain Latin letters, otherwise zh. Under this rule, the small CJK blocks cut out by budoux are all in the same language and are joined back unchanged, so the budoux model is not needed. `x` (unknown language) never occurs, so the branch that handles `x` is omitted too.

use super::error::PyError;
use super::pychar;

/// Language labels used by split-lang and LangSegmenter.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    Zh,
    Ja,
    Ko,
    En,
    Digit,
    Punctuation,
    Newline,
}

/// In zh mode, the final segments are only Chinese or English.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SegLang {
    Zh,
    En,
}

impl SegLang {
    #[cfg(test)]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Zh => "zh",
            Self::En => "en",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    ZhJa,
    Ko,
    Punctuation,
    Newline,
    Digit,
    Others,
}

/// `SubString`; `len` is the number of code points (upstream `length` is always equal to `len(text)`).
#[derive(Clone)]
struct Sub {
    lang: Lang,
    text: String,
    len: usize,
}

impl Sub {
    fn new(lang: Lang, text: String) -> Self {
        let len = text.chars().count();
        Self { lang, text, len }
    }

    fn absorb(&mut self, other: &Sub) {
        self.text.push_str(&other.text);
        self.len += other.len;
    }
}

struct Section {
    kind: Kind,
    subs: Vec<Sub>,
}

/// `split_lang.split.utils.PUNCTUATION`
const PUNCTUATION: &str = r#"〜~,.;:!?，。！？；：、·([{<（【《〈「『“‘)]}>）】》〉」』”’"-_——#$%&……￥'*+<=>?@[\]^_`{|}~"#;

/// `contains_zh_ja`
fn is_zh_ja(c: char) -> bool {
    matches!(c, '\u{4E00}'..='\u{9FFF}' | '\u{3040}'..='\u{30FF}' | '々')
}

/// `contains_hangul`
fn is_hangul(c: char) -> bool {
    matches!(c, '\u{AC00}'..='\u{D7AF}')
}

/// `contains_ja_kana`; also the KANA class of rule C.
fn is_kana(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{30FF}' | '々')
}

fn is_cjk(c: char) -> bool {
    matches!(c, '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}')
}

fn is_latin(c: char) -> bool {
    matches!(c, 'A'..='Z' | 'a'..='z' | '\u{C0}'..='\u{D6}' | '\u{D8}'..='\u{F6}' | '\u{F8}'..='\u{24F}')
}

fn has_kana(text: &str) -> bool {
    text.chars().any(is_kana)
}

/// Rule C's `detect_lang_combined` (for blocks that are not Han characters).
fn detect(text: &str) -> Lang {
    if text.chars().any(is_latin) { Lang::En } else { Lang::Zh }
}

/// Rule C's `possible_detection_list` is always a single-element list; returns that language.
fn possible(text: &str) -> Lang {
    if text.chars().any(|c| is_kana(c) || is_cjk(c)) {
        Lang::Zh
    } else {
        detect(text)
    }
}

fn push_merged(list: &mut Vec<Sub>, item: Sub) {
    match list.last_mut() {
        Some(last) if last.lang == item.lang => last.absorb(&item),
        _ => list.push(item),
    }
}

/// `_merge_substrings`; also what LangSegmenter's `merge_lang` accumulates item by item.
fn merge_same(subs: Vec<Sub>) -> Vec<Sub> {
    let mut out = Vec::with_capacity(subs.len());
    for sub in subs {
        push_merged(&mut out, sub);
    }
    out
}

fn flush(sections: &mut Vec<(Kind, String)>, kind: Kind, buf: &mut String) {
    if !buf.is_empty() {
        sections.push((kind, std::mem::take(buf)));
    }
}

/// `pre_split`
fn pre_split(text: &str) -> Vec<(Kind, String)> {
    let chars: Vec<char> = text.trim_matches(pychar::is_space).chars().collect();
    let mut sections = Vec::new();
    let mut current = Kind::Others;
    let mut buf = String::new();
    for (index, &c) in chars.iter().enumerate() {
        // (new segment type, whether it always starts a new segment)
        let switch = if is_zh_ja(c) {
            Some((Kind::ZhJa, false))
        } else if is_hangul(c) {
            Some((Kind::Ko, false))
        } else if pychar::is_digit(c) {
            Some((Kind::Digit, false))
        } else if PUNCTUATION.contains(c) {
            // A `'` directly followed by non-whitespace counts as part of an English word and stays in the current segment.
            let in_word = c == '\'' && index > 0 && !pychar::is_space(chars[index - 1]);
            (!in_word).then_some((Kind::Punctuation, true))
        } else if pychar::is_space(c) {
            matches!(c, '\n' | '\r').then_some((Kind::Newline, true))
        } else {
            Some((Kind::Others, false))
        };
        if let Some((kind, always)) = switch {
            if always || kind != current {
                flush(&mut sections, current, &mut buf);
                current = kind;
            }
        }
        buf.push(c);
    }
    flush(&mut sections, current, &mut buf);
    sections
}

/// `_parse_without_zh_ja`: splits words on whitespace; the whitespace stays attached to the preceding word.
fn split_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut word = String::new();
    let mut after_space = false;
    for c in text.chars() {
        if pychar::is_space(c) {
            after_space = true;
        } else if after_space {
            words.push(std::mem::take(&mut word));
            after_space = false;
        }
        word.push(c);
    }
    if !word.is_empty() {
        words.push(word);
    }
    words
}

/// `_merge_middle_substr_to_two_side` (rewrites in place, one item at a time, so later checks see the earlier rewrites).
fn merge_middle(subs: &mut [Sub]) {
    if subs.len() <= 2 {
        return;
    }
    for index in 0..subs.len() - 2 {
        let (left, middle, right) = (&subs[index], &subs[index + 1], &subs[index + 2]);
        if left.lang != right.lang || left.lang == Lang::Newline {
            continue;
        }
        let no_kana = !has_kana(&middle.text);
        let same_as_left = possible(&middle.text) == left.lang && no_kana;
        let short_between_long = middle.len <= 4 && left.len + right.len >= 6 && no_kana;
        if same_as_left || short_between_long {
            subs[index + 1].lang = subs[index].lang;
        }
    }
}

/// `_is_cur_short_and_near_long`
fn short_beside_long(cur: &Sub, near: &Sub) -> bool {
    let no_kana = !has_kana(&cur.text) && !has_kana(&near.text);
    let near_long_zh = near.len > cur.len && near.len >= 6 && near.lang == Lang::Zh;
    no_kana && (near_long_zh || possible(&cur.text) == near.lang)
}

/// `_get_nearest_lang_with_direction`
fn nearest(subs: &[Sub], index: usize, search_left: bool) -> Lang {
    let found = if search_left {
        subs[..index].iter().rev().find(|sub| sub.lang != Lang::Digit)
    } else {
        subs[index + 1..].iter().find(|sub| sub.lang != Lang::Digit)
    };
    found.map_or(subs[index].lang, |sub| sub.lang)
}

/// `_merge_side_substr_to_near`: with a single block, neither side condition holds.
fn merge_sides(subs: &mut [Sub]) {
    let n = subs.len();
    if n < 2 {
        return;
    }
    if short_beside_long(&subs[0], &subs[1]) || (possible(&subs[0].text) == subs[1].lang && subs[1].len <= 5) {
        subs[0].lang = nearest(subs, 0, false);
    }
    let (last, near) = (&subs[n - 1], &subs[n - 2]);
    if short_beside_long(last, near) || (possible(&last.text) == near.lang && near.len <= 5) {
        subs[n - 1].lang = nearest(subs, n - 1, true);
    }
}

/// `_smart_merge` (`_get_languages` only computes and does not write, and `_fill_unknown_language` only handles x; both are no-ops).
fn smart_merge(subs: Vec<Sub>) -> Vec<Sub> {
    let mut subs = merge_same(subs);
    merge_middle(&mut subs);
    let mut subs = merge_same(subs);
    merge_middle(&mut subs);
    let mut subs = merge_same(subs);
    merge_sides(&mut subs);
    let mut subs = merge_same(subs);
    merge_middle(&mut subs);
    merge_same(subs)
}

/// `_split` + `_smart_merge_all`
fn split(text: &str) -> Vec<Section> {
    pre_split(text)
        .into_iter()
        .map(|(kind, text)| {
            let subs = match kind {
                Kind::Punctuation => vec![Sub::new(Lang::Punctuation, text)],
                Kind::Digit => vec![Sub::new(Lang::Digit, text)],
                Kind::Newline => vec![Sub::new(Lang::Newline, text)],
                Kind::Ko => vec![Sub::new(Lang::Ko, text)],
                // Under rule C, the budoux small blocks are all judged zh and are joined back unchanged after smart merge
                Kind::ZhJa => vec![Sub::new(Lang::Zh, text)],
                Kind::Others => smart_merge(split_words(&text).into_iter().map(|word| Sub::new(detect(&word), word)).collect()),
            };
            Section { kind, subs }
        })
        .collect()
}

/// Merges adjacent sections of the same type into a substring list.
fn merge_same_kind(sections: Vec<Section>) -> Vec<Section> {
    let mut out: Vec<Section> = Vec::with_capacity(sections.len());
    for section in sections {
        match out.last_mut() {
            Some(last) if last.kind == section.kind => last.subs.extend(section.subs),
            _ => out.push(section),
        }
    }
    out
}

/// `_merge_substrings_across_punctuation` / `_merge_substrings_across_newline`: `last_lang` is the language of the previous
/// input block, not of the previously merged block.
fn merge_across(subs: Vec<Sub>, marker: Lang) -> Vec<Sub> {
    let mut out: Vec<Sub> = Vec::with_capacity(subs.len());
    let mut last_lang: Option<Lang> = None;
    for sub in subs {
        let lang = sub.lang;
        let absorb = !out.is_empty() && (lang == marker || last_lang.is_none_or(|last| last == lang));
        if absorb {
            let prev = out.last_mut().expect("non-empty");
            prev.absorb(&sub);
            if prev.lang == marker {
                prev.lang = lang;
            }
        } else {
            out.push(sub);
        }
        last_lang = Some(lang);
    }
    out
}

/// `_merge_substrings_across_punctuation_based_on_sections`（`not_merge_punctuation=""`）。
fn merge_punctuation_sections(sections: Vec<Section>) -> Vec<Section> {
    let mut out: Vec<Section> = Vec::with_capacity(sections.len());
    for section in sections {
        let Some(last) = out.last_mut() else {
            out.push(section);
            continue;
        };
        if last.kind != Kind::Punctuation && section.kind != Kind::Punctuation {
            out.push(section);
            continue;
        }
        let adopt = last.kind == Kind::Punctuation;
        if adopt {
            last.kind = section.kind;
        }
        let mut subs = section.subs.into_iter();
        let head = subs.next().expect("section has substrings");
        let tail = last.subs.last_mut().expect("section has substrings");
        tail.absorb(&head);
        if adopt {
            tail.lang = head.lang;
        }
        last.subs.extend(subs);
    }
    let mut merged = merge_same_kind(out);
    for section in &mut merged {
        section.subs = merge_across(std::mem::take(&mut section.subs), Lang::Punctuation);
    }
    merged
}

/// `_merge_substrings_across_newline_based_on_sections`
fn merge_newline_sections(sections: Vec<Section>) -> Vec<Section> {
    let mut out: Vec<Section> = Vec::with_capacity(sections.len());
    for section in sections {
        match out.last_mut() {
            Some(last) if last.kind == Kind::Newline => {
                last.kind = section.kind;
                last.subs.extend(section.subs);
            }
            Some(last) if section.kind == Kind::Newline => last.subs.extend(section.subs),
            _ => out.push(section),
        }
    }
    let mut merged = merge_same_kind(out);
    for section in &mut merged {
        section.subs = merge_across(std::mem::take(&mut section.subs), Lang::Newline);
    }
    merged
}

/// `_special_merge_for_zh_ja`
fn special_merge_zh_ja(subs: Vec<Sub>) -> Result<Vec<Sub>, PyError> {
    if subs.len() == 1 {
        return Ok(subs);
    }
    let zh_ja = |lang: Lang| matches!(lang, Lang::Zh | Lang::Ja);
    let (mut zh, mut ja) = (0usize, 0usize);
    let last = subs.len() - 1;
    let mut out: Vec<Sub> = Vec::with_capacity(subs.len());
    let mut index = 0;
    while index <= last {
        let current = &subs[index];
        match current.lang {
            Lang::Zh => zh += current.len,
            Lang::Ja => ja += current.len,
            Lang::Digit | Lang::Punctuation | Lang::Newline => {}
            // Upstream's count table has no en / ko keys
            Lang::En | Lang::Ko => return Err(PyError::Key),
        }
        if index == 0 {
            let right = &subs[1];
            if zh_ja(right.lang) && zh_ja(current.lang) && current.len * 10 < right.len {
                let mut merged = Sub {
                    lang: right.lang,
                    ..current.clone()
                };
                merged.absorb(right);
                out.push(merged);
                index += 1;
            } else {
                out.push(current.clone());
            }
        } else if index == last {
            let left = out.last_mut().expect("first substring pushed");
            if zh_ja(left.lang) && zh_ja(current.lang) && current.len * 10 < left.len {
                left.absorb(current);
                index += 1;
            } else {
                out.push(current.clone());
            }
        } else {
            let right = &subs[index + 1];
            let left = out.last_mut().expect("first substring pushed");
            if left.lang == right.lang && zh_ja(left.lang) && current.lang != Lang::En && current.len * 10 < left.len + right.len {
                left.absorb(current);
                left.absorb(right);
                index += 1;
            } else {
                out.push(current.clone());
            }
        }
        index += 1;
    }
    if ja >= zh * 10 {
        for sub in &mut out {
            if sub.lang == Lang::Zh {
                sub.lang = Lang::Ja;
            }
        }
    }
    Ok(merge_same(out))
}

/// `LangSplitter.split_by_lang`
fn split_by_lang(text: &str) -> Result<Vec<Sub>, PyError> {
    let sections = split(text);
    if sections.is_empty() {
        // `new_sections = [sections[0]]`
        return Err(PyError::Index);
    }
    let mut subs = Vec::new();
    for section in merge_newline_sections(merge_punctuation_sections(sections)) {
        if section.kind == Kind::ZhJa {
            subs.extend(special_merge_zh_ja(section.subs)?);
        } else {
            subs.extend(section.subs);
        }
    }
    Ok(subs)
}

/// `full_en`: `^(?=.*[A-Za-z])[A-Za-z0-9\s -~ -⁯　-〿＀-￯]+$`,
/// the `.` in the lookahead does not match across newlines.
fn full_en(text: &str) -> bool {
    let allowed = |c: char| {
        pychar::is_space(c)
            || matches!(c, '\u{20}'..='\u{7E}' | '\u{2000}'..='\u{206F}' | '\u{3000}'..='\u{303F}' | '\u{FF00}'..='\u{FFEF}')
    };
    let first_line = text.split('\n').next().unwrap_or_default();
    !text.is_empty() && text.chars().all(allowed) && first_line.chars().any(|c| c.is_ascii_alphabetic())
}

/// `split_jako`: splits Kana (or Hangul) together with the digits, punctuation and spaces between them into `tag` segments.
fn split_jako(tag: Lang, item: &Sub) -> Vec<Sub> {
    let in_script = |c: char| match tag {
        Lang::Ja => {
            matches!(c, '\u{3041}'..='\u{3096}' | '\u{3099}' | '\u{309A}' | '\u{30A1}'..='\u{30FA}' | '\u{30FC}')
        }
        _ => {
            matches!(c, '\u{1100}'..='\u{11FF}' | '\u{3130}'..='\u{318F}' | '\u{AC00}'..='\u{D7AF}')
        }
    };
    let joiner = |c: char| c.is_ascii_digit() || matches!(c, '\u{3001}'..='\u{301C}' | '！' | '？' | '.' | '!' | '?' | '…' | ' ');
    let text = item.text.as_str();
    let mut out = Vec::new();
    let mut tag_end = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((start, c)) = chars.next() {
        if !in_script(c) {
            continue;
        }
        let mut end = start + c.len_utf8();
        while let Some(&(at, next)) = chars.peek() {
            if !(in_script(next) || joiner(next)) {
                break;
            }
            end = at + next.len_utf8();
            chars.next();
        }
        if start > tag_end {
            out.push(Sub::new(item.lang, text[tag_end..start].to_owned()));
        }
        out.push(Sub::new(tag, text[start..end].to_owned()));
        tag_end = end;
    }
    if tag_end < text.len() {
        out.push(Sub::new(item.lang, text[tag_end..].to_owned()));
    }
    out
}

/// The "has digits" stage of `getTexts`: a digit block takes its language from the blocks around it.
fn resolve_digits(items: Vec<Sub>) -> Vec<Sub> {
    const STOPS: [char; 8] = [',', '.', '!', '?', '，', '。', '！', '？'];
    let n = items.len();
    let mut out: Vec<Sub> = Vec::with_capacity(n);
    for index in 0..n {
        let mut item = items[index].clone();
        if item.lang == Lang::Digit {
            item.lang = match out.last() {
                Some(prev) if index == n - 1 => prev.lang,
                None if index < n - 1 => items[1].lang,
                Some(prev) if index < n - 1 => {
                    let next = &items[index + 1];
                    if prev.lang == next.lang {
                        prev.lang
                    } else if prev.text.ends_with(STOPS) {
                        next.lang
                    } else if next.text.starts_with(STOPS) {
                        prev.lang
                    } else if item.text.ends_with(['。', '.']) {
                        prev.lang
                    } else if prev.len >= next.len {
                        prev.lang
                    } else {
                        next.lang
                    }
                }
                _ => Lang::Zh,
            };
        }
        push_merged(&mut out, item);
    }
    out
}

/// `LangSegmenter.getTexts(text)`（`default_lang=""`）。
pub fn get_texts(text: &str) -> Result<Vec<(Lang, String)>, PyError> {
    let mut list: Vec<Sub> = Vec::new();
    let mut have_num = false;
    for item in split_by_lang(text)? {
        if item.lang == Lang::Digit {
            have_num = true;
            push_merged(&mut list, item);
            continue;
        }
        if full_en(&item.text) {
            push_merged(&mut list, Sub { lang: Lang::En, ..item });
            continue;
        }
        let mut ja_list = if item.lang != Lang::Ja {
            split_jako(Lang::Ja, &item)
        } else {
            Vec::new()
        };
        if ja_list.is_empty() {
            ja_list.push(item.clone());
        }
        // Upstream's ko_list is not reset per loop iteration: a ko block reuses the split result of the previous block
        let mut ko_list: Vec<Sub> = Vec::new();
        let mut temp: Vec<Sub> = Vec::new();
        for ko_item in &ja_list {
            if ko_item.lang != Lang::Ko {
                ko_list = split_jako(Lang::Ko, ko_item);
            }
            if ko_list.is_empty() {
                temp.push(ko_item.clone());
            } else {
                temp.extend(ko_list.iter().cloned());
            }
        }
        if temp.len() == 1 {
            // When only one block is cut out, the block merged in is the original block (a block that is all Kana also keeps its original language)
            push_merged(&mut list, item);
            continue;
        }
        for piece in temp {
            push_merged(&mut list, piece);
        }
    }
    if have_num {
        list = resolve_digits(list);
    }
    Ok(list.into_iter().map(|sub| (sub.lang, sub.text)).collect())
}

/// `re.sub(" {2,}", " ", text)`
pub fn collapse_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut prev_space = false;
    for c in text.chars() {
        if c == ' ' && prev_space {
            continue;
        }
        prev_space = c == ' ';
        out.push(c);
    }
    out
}

/// Inference-side zh mode: collapses consecutive spaces, runs `getTexts`, then merges adjacent segments by "English / non-English".
pub fn zh_segments(text: &str) -> Result<Vec<(SegLang, String)>, PyError> {
    let mut out: Vec<(SegLang, String)> = Vec::new();
    for (lang, text) in get_texts(&collapse_spaces(text))? {
        let lang = if lang == Lang::En { SegLang::En } else { SegLang::Zh };
        match out.last_mut() {
            Some((last, acc)) if *last == lang => acc.push_str(&text),
            _ => out.push((lang, text)),
        }
    }
    Ok(out)
}

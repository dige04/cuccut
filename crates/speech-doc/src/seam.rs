//! Quality of translation seams: lint for dangling connectives, clinging particles and flash fragments, the preferred seam, and zero-LLM pre-splitting for Latin text. Cross-checked against voice-ink `PipelineLint.checkAlign` and `DisplaySplitEngine.preferredTargetSplit` / `semanticPreSplitPieces`.

use crate::atomize::{
    atomize, clause_end_char, count_cps_chars, join_word_texts, seam_backed_by_whitespace,
    sentence_end,
};
use crate::doc::{TransPiece, Word};
use crate::split::{
    TransParams, exceeds_one_line_fit, piece_display_units, primary_subtag, target_cps_chars,
};

/// The minimum length of a piece that can be displayed on its own. Pieces of 3 characters or fewer are merged into an adjacent piece first.
pub const MIN_PIECE_CHARS: usize = 3;
/// Latin pre-split: upper limit on the deviation of the source/target proportion.
pub const SNAP_RATIO_DIVERGENCE: f64 = 0.18;
/// Latin pre-split: minimum speech duration on each side (seconds).
pub const MIN_CUE_DISPLAY_SEC: f64 = 1.0;

const CLOSERS: &[char] = &[
    ']', ')', '}', '）', '］', '｝', '】', '〕', '」', '』', '〉', '》', '”', '’', '"', '\'',
];
const STRONG_CLAUSE_PUNCT: &[char] = &[
    ',', '.', '!', '?', ';', ':', '，', '。', '！', '？', '；', '：', '…', '—',
];
const SEMANTIC_SEAM_PUNCT: &[char] = &['；', ';', '：', ':', '—'];
/// Paired delimiters whose opening and closing forms are distinguishable by glyph. A seam inside a pair that is **already closed** is a grammatical flaw (e.g. 「…名为“ | PluginDataJSON”的…」, where the quote marks are split away from the quoted content).
///
/// Straight quotes `"` and `'` are not included. A single character's glyph cannot tell open from close, so they could only be counted by parity, and in English they double as apostrophes (`it's`) and inch marks (`6" pipe`), so parity counting would inevitably misjudge. Chinese translations use full-width quotes, which this table already covers. Missing straight quotes is a deliberate trade-off.
const DELIM_PAIRS: &[(char, char)] = &[
    ('“', '”'),
    ('‘', '’'),
    ('「', '」'),
    ('『', '』'),
    ('《', '》'),
    ('〈', '〉'),
    ('（', '）'),
    ('【', '】'),
    ('〔', '〕'),
    ('(', ')'),
    ('[', ']'),
    ('{', '}'),
];
const SENTENCE_FINAL_PUNCT: &[char] = &['。', '！', '？', '.', '!', '?', '…'];
const CLAUSE_PUNCT: &[char] = &[
    ',', '.', '!', '?', ';', ':', '，', '。', '！', '？', '；', '：', '、', '…', '—',
];

const DANGLING_CJK: &[char] = &[
    '和', '与', '或', '及', '跟', '而', '并', '且', '把', '被', '让', '使', '将', '比', '向', '往',
    '从', '当', '由', '给', '于',
];
/// Two-character dangling predicates: the complement is a required part, so the piece breaks when it ends there (G3 baseline measured two cases of “similar to | …” being committed to the database). Single-character tables do not cover them, since 似 and 当 are not function words.
const DANGLING_CJK_BIGRAMS: &[&str] = &["类似", "相当"];
/// At a display seam the last character is still a dangerous function word, but as a **complete sentence end** it already forms a common noun or predicate.
const COMPLETE_CJK_SENTENCE_TAILS: &[&str] = &["方向", "对比", "总和", "跟不跟"];
/// A 「的」 at the end of a piece is treated as dangling (the 「…的 | 名词」 attributive and its head are split apart; two cases were committed in the p850 benchmark draft). Two-character nouns and pronouns that end in 「的」 are complete words and are not counted as dangling.
const DE_TAIL_COMPLETE_BIGRAMS: &[&str] = &["目的", "标的", "有的", "别的", "似的"];
/// A unit or measure word after a number: if it starts a piece and the preceding piece ends in a number, the quantity phrase has been cut (“1000 | US dollars” was measured in the p850 benchmark draft). The single-character table includes only those that are almost unambiguous after a number.
const NUMBER_UNIT_PREFIXES: &[&str] = &[
    "美元", "欧元", "英镑", "日元", "港元", "万亿", "分钟", "小时", "公里", "公斤", "元", "块",
    "万", "亿", "年", "月", "日", "号", "岁", "人", "名", "位", "个", "次", "倍", "点", "天", "周",
    "米", "克", "吨",
];
const DANGLING_LATIN: &[&str] = &["and", "or", "of", "the", "a", "an", "to", "but"];
const LEADING_DANGLING_CJK: &[char] = &[
    '的', '地', '得', '了', '着', '过', '时', '者', '们', '之', '吗', '呢', '吧', '啊', '呀', '嘛',
    '哦',
];
/// Chinese quantity and category phrases at the end of a piece that still await their head noun. Only high-confidence predicate endings are collected here, to avoid flagging elliptical structures such as “I only want one | the other I don't want” in general. This is blocked only by [`incomplete_nominal_split`], and only when the right piece has body text and the left piece has no punctuation.
const INCOMPLETE_CJK_NOMINAL_TAILS: &[&str] = &[
    "有一个",
    "有一种",
    "有这个",
    "有那个",
    "是一个",
    "是一种",
    "作为一个",
    "作为一种",
    "成为一个",
    "成为一种",
];
/// A coordinating conjunction at the start of a piece. A Chinese coordinate structure is cut before `和`/`及`/`与`/`或`. This is the mirror image of "a dangling conjunction at the end of a piece", the same flaw seen from the other side. R2 benchmark measured two cases: 「它们是 KV 缓存 | 和 PagedAttention。」 and 「…就来聊聊 KV 缓存 | 和 PagedAttention。」. `或` used to appear only in the dangling-tail table, not the piece-start table, so the pre-split suggestion could bare-cut 「…A | 或者 B」, which conflicted with the contract's rule against cutting inside a coordination. It does not apply when the preceding piece ends with punctuation (gated by `ends_clause_punct` in [`lint_pieces`]).
const LEADING_COORDINATOR_CJK: &[char] = &['和', '及', '与', '或'];
/// Coordinating words at the start of a piece that form a word or phrase on their own. These are legal piece starts and must not be blocked. Note that `或者` and `或是` are not in this list: they are still coordinating conjunctions, and a bare cut before them likewise breaks the coordination.
const LEADING_COORDINATOR_WORDS: &[&str] = &[
    "和平",
    "和谐",
    "和解",
    "和睦",
    "和好",
    "和气",
    "和尚",
    "和约",
    "和风",
    "与其",
    "与此",
    "与日",
    "与会",
    "与众",
    "及时",
    "及其",
    "及至",
    "或许",
    "或多或少",
];
/// Weak endings: a bare trailing piece (not closed by punctuation) that lands on a form that cannot grammatically pause there. All 14 hard dangling cases in the R2 benchmark fell into these types: structural particles and locative suffixes, adverbs, auxiliary verbs, measure words, and transitive light verbs missing their object (see audit §4.2.1).
///
/// Blocking covers only the forms that almost never legally end a clause without punctuation. Context-dependent light verbs (知道 "know", 占用 "occupy", 生成 "generate“I don't know” and “come take a look” are not misjudged as flaws, which would force an extra rework round.
const WEAK_TAIL_BLOCKING_WORDS: &[&str] = &[
    // Adverbs
    "如何",
    "只是",
    "同时",
    "预先",
    "仅仅",
    // Auxiliary verbs
    "可以",
    // Measure-word phrases (excludes bare 「一个/一种」 ("one" / "one kind"): the elliptical structure is legal, see INCOMPLETE_CJK_NOMINAL_TAILS)
    "一系列",
    "一块",
    // Light verb + perfective 「了」: the object must be in the next piece
    "采用了",
    "内置了",
    "了解了",
    "使用了",
    "提供了",
    "包含了",
    "实现了",
    "支持了",
    "引入了",
    "带来了",
    "占用了",
    "生成了",
];
/// Weak ending (advisory level): a transitive light verb missing its object. Whether the object is missing depends on context, so this only gives a hint and adds to the target pre-split penalty. It does not block.
const WEAK_TAIL_ADVISORY_WORDS: &[&str] = &[
    "生成",
    "占用",
    "浪费掉",
    "看看",
    "知道",
    "了解",
    "获取",
    "释放",
];
/// Two-character endings that end in 「得」 but are words on their own (such piece endings are legal).
const WEAK_TAIL_DE_COMPLETE_BIGRAMS: &[&str] = &["心得", "所得", "值得", "难得", "舍得"];

// ---------------------------------------------------------------------------
// Morphology-class weak endings (open class). `WEAK_TAIL_BLOCKING_WORDS` is a closed word list, but Chinese dangling endings form an open class: in R3 benchmark measurements, after entries such as `采用了` ("adopted") and `同时` ("at the same time") were hit, the defect merely **shifted** to adjacent forms that were not listed (see audit §2, "defect displacement"). The groups below judge by **form**. The word list keeps only the exemption side for "word traps“above” and “takeaways”.
// ---------------------------------------------------------------------------

/// Disposal and pivotal frame words: `把/将/让/使/叫 + NP` must be followed by a predicate.
const FRAME_DISPOSAL_CJK: &[char] = &['把', '将', '让', '使', '叫'];
/// Lookback window for frame words (in characters). Beyond the window, the frame is considered already closed earlier.
const FRAME_LOOKBACK: usize = 10;
/// Exemptions for disposal and pivotal constructions: two-character words that contain a frame character but do not use it as a frame word, such as the adverb “about to”, the time noun “future”, and the conjunction “even if”. The matching position may be before or after the frame character.
const FRAME_COMPLETE_BIGRAMS: &[&str] = &[
    "即将", "行将", "将来", "将要", "将会", "将近", "假使", "即使", "纵使", "致使", "促使", "迫使",
    "大把", "把握", "把手", "叫做", "名叫", "号叫",
];
/// Closed by a complement or aspect marker: a predicate core has already appeared after the frame, so this is not a disposal construction missing its predicate. (A missing object is judged separately by [`VERB_COMPLEMENT_TAILS`].)
const PREDICATE_TAIL_CJK: &[char] = &[
    '了', '着', '过', '到', '成', '出', '掉', '回', '走', '开', '住', '给', '完', '好', '起', '下',
    '来', '去', '上',
];

/// Transitive verb + directional or resultative complement: ending on the complement means the object is missing (“waste away | 60%”, “observed to | 50%”).
const VERB_COMPLEMENT_TAILS: &[char] = &['到', '掉', '出', '成'];
/// Exemptions for a complement missing its object: two-character words that end in a complement character but are self-sufficient verbs or nouns on their own.
const VERB_COMPLEMENT_COMPLETE_BIGRAMS: &[&str] = &[
    // 到 (to, arrive)
    "迟到", "报到", "周到", "独到", "不到", "直到", "来到",
    // 掉 (away; a self-sufficient intransitive is rare, so only clearly word-forming cases are exempted)
    "丢掉", // 出 (out): 输出 ("output"), 产出 ("yield"), 支出 ("expenditure") and similar are nouns
    "输出", "产出", "支出", "付出", "演出", "突出", "杰出", "外出", "日出", "售出", "退出", "指出",
    // 成 (become): 完成 ("complete"), 形成 ("form") and similar can close a clause on their own
    "完成", "形成", "达成", "组成", "构成", "集成", "合成", "赞成", "现成", "既成",
];

/// Locative suffix: a locative frame `在/从/对/往/向 … X`, or a locative frame formed by a "quantity/Latin + locative“on” is judged separately below, following the existing 「在…上」 lookback rule.
const LOCATIVE_SUFFIX_CJK: &[char] = &['里', '中', '下', '内', '间'];
/// Explicit introducing words of a locative frame.
const LOCATIVE_FRAME_CJK: &[char] = &['在', '从', '对', '往', '向'];
/// Exemptions for locative suffixes: these two-character endings are self-sufficient pronouns, nouns or verbs, not locative phrases still waiting to be closed.
const LOCATIVE_COMPLETE_BIGRAMS: &[&str] = &[
    // 里 (inside)
    "这里", "那里", "哪里", "家里", "心里", "手里", "公里", "英里", "海里", "表里",
    // 中 (among)
    "其中", "当中", "之中", "集中", "空中", "眼中", "心中", "适中", "居中", "命中", "选中", "看中",
    "击中", "猜中", // 下 (under)
    "以下", "如下", "低下", "属下", "手下", "天下", "地下", "陛下", "阁下", "留下", "放下", "剩下",
    // 内 (within)
    "以内", "之内", "国内", "室内", "体内", "对内", // 间 (between)
    "之间", "期间", "中间", "时间", "空间", "房间", "瞬间", "民间", "夜间", "车间",
];

/// A locative suffix at the **start** of a piece. This is the mirror image of [`LOCATIVE_SUFFIX_CJK`], the same flaw seen from the other side (「从你现有的 GPU ‖ 中获得…」 splits the locative frame in the middle). When these characters start a piece, they almost always cling to the noun phrase of the previous piece, unless they form a word on their own.
const LEADING_LOCATIVE_WORDS: &[&str] = &[
    "中国", "中间", "中心", "中央", "中断", "中止", "中文", "中英", "下面", "下一", "下来", "下去",
    "下列", "下载", "上面", "上一", "上来", "上去", "上述", "上下", "里面", "内容", "内存", "内部",
    "内核", "内置", "间接", "间隔",
];

/// Light-verb frame: `来/去 + monosyllabic reduplicated verb` (聊聊 "chat", 看看 "take a look", 说说 "talk") missing its object.
const LIGHT_VERB_FRAME_CJK: &[char] = &['来', '去'];
/// The copula “is” at the end of a piece: the predicate nominal must be in the next piece. The criterion was reverse-derived from a bad seam measured in the speed-limiting mechanism (`所以，如果你的最大序列长度是 ‖ 2048 个 token，`).
const COPULA_COMPLETE_BIGRAMS: &[&str] = &["求是", "自是"];
pub(crate) const CUT_BEFORE_CJK: &[&str] = &[
    "但是", "所以", "因为", "然后", "而且", "不过", "如果", "虽然", "那么", "或者", "并且", "同时",
    "接着", "另外",
];
const CUT_BEFORE_LATIN: &[&str] = &[
    "but", "so", "because", "then", "which", "when", "while", "and", "or", "if",
];
/// Weak seam: the start of a phrase introduced by a preposition or infinitive. Used only for snapping the source-word span anchor, not for target splitting.
const CUT_BEFORE_LATIN_WEAK: &[&str] = &[
    "to", "with", "for", "from", "into", "onto", "about", "without", "through", "over", "under",
    "between", "across", "by", "at", "on", "in", "of", "as", "after", "before", "during", "since",
    "until", "toward", "towards", "via",
];
/// Source-word span anchoring: the search window (in words) within which a proportional boundary snaps toward a semantic seam.
const ANCHOR_SNAP_WINDOW: usize = 2;

fn is_cjk_lang(lang: &str) -> bool {
    matches!(primary_subtag(lang).as_str(), "zh" | "ja" | "ko")
}

fn strip_closers(text: &str) -> &str {
    let mut end = text.len();
    while end > 0 {
        let Some(ch) = text[..end].chars().next_back() else {
            break;
        };
        if !CLOSERS.contains(&ch) {
            break;
        }
        end -= ch.len_utf8();
    }
    &text[..end]
}

/// Whether the piece ends with a sentence-final punctuation mark (after stripping closers).
pub fn ends_sentence_final(text: &str) -> bool {
    let trimmed = text.trim();
    let stripped = strip_closers(trimmed);
    stripped
        .chars()
        .last()
        .is_some_and(|ch| SENTENCE_FINAL_PUNCT.contains(&ch))
}

/// Whether the piece ends with a clause-level punctuation mark (after stripping whitespace).
pub fn ends_clause_punct(text: &str) -> bool {
    text.trim()
        .chars()
        .last()
        .is_some_and(|ch| CLAUSE_PUNCT.contains(&ch))
}

/// Whether the piece ends with a dangling connective or preposition.
pub fn ends_dangling(text: &str) -> bool {
    let trimmed = text.trim();
    let Some(last) = trimmed.chars().last() else {
        return false;
    };
    if CLAUSE_PUNCT.contains(&last) {
        return false;
    }
    if DANGLING_CJK.contains(&last) {
        return true;
    }
    let tail: String = trimmed
        .chars()
        .rev()
        .take(2)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if DANGLING_CJK_BIGRAMS.contains(&tail.as_str()) {
        return true;
    }
    if last == '的' && !de_tail_complete(trimmed, &tail) {
        return true;
    }
    // Strong punctuation may be attached to Latin words on either side during polish write-back. Judge by the last lexical run, so that `matters—the` is not treated as one safe word, which would miss the dangling article `the`.
    let Some(tok) = trimmed
        .split(|ch: char| !ch.is_alphanumeric() && ch != '\'' && ch != '-')
        .filter(|token| !token.is_empty())
        .next_back()
    else {
        return false;
    };
    DANGLING_LATIN.contains(&tok.to_ascii_lowercase().as_str())
}

/// Whether the sentence-final punctuation falls on a dangling word: the "false sentence end" criterion (`… because.` / `… of how.`).
///
/// The difference from [`ends_dangling`] is that this must first **confirm** that the text really ends a sentence: it ends with sentence-final punctuation, and after stripping closers and that punctuation, the last content word is checked. `ends_dangling` itself returns false on any `CLAUSE_PUNCT` (which includes `.`), so calling it directly could never detect this.
///
/// Meaningful only for languages that can be judged this way (Latin and Chinese). The caller is responsible for the language gate.
pub fn dangling_sentence_end(text: &str) -> bool {
    let trimmed = text.trim();
    if !ends_sentence_final(trimmed) {
        return false;
    }
    let stripped = trimmed.trim_end_matches(|ch: char| {
        SENTENCE_FINAL_PUNCT.contains(&ch) || CLOSERS.contains(&ch) || ch.is_whitespace()
    });
    if has_fronted_latin_preposition_object(stripped) {
        return false;
    }
    if is_elliptical_infinitive_end(stripped) {
        return false;
    }
    // A single-letter enumerator or variable (`a.`, `B.`) can stand as a sentence on its own in test fixtures, enumerated dictation and math transcripts. Do not classify a pure protocol round-trip as a false sentence end just because `a` is also the English article.
    if stripped.len() == 1 && stripped.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return false;
    }
    // `的` is still a high-risk dangling word at a display seam, but at the end of a complete Chinese sentence it often serves as a judgment, emphasis or nominalizing ending (“是的。” “这是很重要的。”). Keep the whole-sentence criterion separate from the seam criterion: keep the warning only for an isolated fragment 「的。」, so that long interviews do not generate hundreds of false alarms with no actionable value.
    if stripped.ends_with('的') && stripped != "的" {
        return false;
    }
    if COMPLETE_CJK_SENTENCE_TAILS
        .iter()
        .any(|tail| stripped.ends_with(tail))
    {
        return false;
    }
    ends_dangling(stripped)
}

/// Whether any sentence in the text ends on a dangling connective or preposition.
///
/// [`dangling_sentence_end`] checks only one known sentence fragment. Both the file-based carrier and the json-v0 single-sentence retry receive whole text that may contain several sentences. The scan is unified here by slicing with `atomize` + `sentence_end`, so the two acceptance paths do not each implement a slightly drifting scanner.
pub fn contains_dangling_sentence_end(text: &str) -> bool {
    let atoms = atomize(text);
    let mut sentence_start = 0usize;
    for (index, atom) in atoms.iter().enumerate() {
        if !sentence_end(atom) {
            continue;
        }
        let sentence = join_word_texts(atoms[sentence_start..=index].iter().map(String::as_str));
        if dangling_sentence_end(&sentence) {
            return true;
        }
        sentence_start = index + 1;
    }
    // The remainder after the last sentence-end atom. Dropping it opens a blind spot: an ASCII-ellipsis-ended `but...` fails the `2.14` / `a.com` guard of [`crate::atomize::sentence_end`] (a `.` left in the stem means it is not a sentence end). The whole tail is then silently discarded and this function always returns false, while [`dangling_sentence_end`], which `ccut check` uses, still warns. The same phenomenon gave opposite answers on the two paths, and the model could get past acceptance by changing `.` to `...`.
    //
    // A remainder that does not end with sentence-final punctuation is not judged a dangling sentence end by `dangling_sentence_end` itself, so an unfinished tail is not mistaken for a dangling sentence end here.
    if sentence_start < atoms.len() {
        let tail = join_word_texts(atoms[sentence_start..].iter().map(String::as_str));
        if dangling_sentence_end(&tail) {
            return true;
        }
    }
    false
}

/// Whether it is a sentence-final punctuation mark (`。！？.!?…`).
pub fn is_sentence_final_punct(ch: char) -> bool {
    SENTENCE_FINAL_PUNCT.contains(&ch)
}

/// Whether it contains conflicting adjacent sentence-final or clause punctuation (for example `。，`, `，。`, `，，`).
///
/// Combined tone marks such as `？！` and `!?`, as well as ellipses, are all legal. This only blocks combinations where one side has closed the sentence and the other side requires the sentence to continue, plus two consecutive clause punctuation marks. When a model re-attaches punctuation at sentence boundaries it sometimes appends new punctuation after the original ASR punctuation. If that is not rejected at submission, the derived Sentence and Cue would keep the noise.
pub fn contains_conflicting_punctuation(text: &str) -> bool {
    let sentence_final = |ch: char| matches!(ch, '。' | '！' | '？' | '.' | '!' | '?');
    let clause = |ch: char| matches!(ch, '，' | '、' | '；' | '：' | ',' | ';' | ':');
    text.chars().zip(text.chars().skip(1)).any(|(left, right)| {
        (sentence_final(left) && clause(right))
            || (clause(left) && sentence_final(right))
            || (clause(left) && clause(right))
    })
}

/// Deterministic normalization of conflicting adjacent punctuation (retry strategy redesign R2, "fix in code first").
///
/// The judgment is strictly complementary to [`contains_conflicting_punctuation`]: every adjacent pair that is flagged as conflicting there has one of its marks resolved here, and the result is guaranteed to satisfy `!contains_conflicting_punctuation(out)`. There is one rule: **the sentence-final mark wins**.
///
/// - `。，` / `，。`: keep the sentence-final one (`。`).
/// - Two consecutive clause punctuation marks such as `，，` / `,;`: keep the earlier one.
/// - `..` → `.`: a repeated sentence end keeps one mark.
///
/// Combined tone marks such as `？！`, `!?` and `……` are not in the conflict set, so they are kept as they are. Whitespace does not affect the judgment: conflict detection looks at adjacent characters, so two punctuation marks separated by a space are not a conflict to begin with.
pub fn normalize_conflicting_punctuation(text: &str) -> String {
    let sentence_final = |ch: char| matches!(ch, '。' | '！' | '？' | '.' | '!' | '?');
    let clause = |ch: char| matches!(ch, '，' | '、' | '；' | '：' | ',' | ';' | ':');
    // Step 1: fold exactly two consecutive ASCII periods into one. Three or more is an ellipsis and is kept as it is (`...` is not `..`).
    let mut folded = String::with_capacity(text.len());
    let chars: Vec<char> = text.chars().collect();
    let mut index = 0usize;
    while index < chars.len() {
        if chars[index] == '.' {
            let run = chars[index..].iter().take_while(|ch| **ch == '.').count();
            let keep = if run == 2 { 1 } else { run };
            for _ in 0..keep {
                folded.push('.');
            }
            index += run;
            continue;
        }
        if chars[index] == '。' {
            let run = chars[index..].iter().take_while(|ch| **ch == '。').count();
            folded.push('。');
            index += run;
            continue;
        }
        folded.push(chars[index]);
        index += 1;
    }
    // Step 2: resolve conflicting pairs one character at a time, based on the last character already written. This guarantees that the resolution itself does not create a new conflicting pair (`，，。` → `。`, not `，。`).
    let mut out = String::with_capacity(folded.len());
    for ch in folded.chars() {
        match out.chars().next_back() {
            Some(last) if sentence_final(last) && clause(ch) => continue,
            Some(last) if clause(last) && sentence_final(ch) => {
                out.pop();
                out.push(ch);
            }
            Some(last) if clause(last) && clause(ch) => continue,
            // After resolution, two identical CJK sentence ends may be exposed (`。，。`): keep only one.
            Some('。') if ch == '。' => continue,
            _ => out.push(ch),
        }
    }
    out
}

/// Whether it contains an overlong run of pure Latin letters that ASR glued into a single word.
///
/// This criterion deliberately looks only at consecutive ASCII letters. It does not count URLs, hyphenated terms or digit strings. The caller should also gate by language. It is currently used mainly for English code-switching in Chinese transcripts, so that phrases such as `purereinforcementlearning`, which should have spaces, do not pass the polish quality gate.
pub fn contains_likely_collapsed_latin_atom(text: &str, min_chars: usize) -> bool {
    let mut run = 0usize;
    for ch in text.chars() {
        if ch.is_ascii_alphabetic() {
            run += 1;
            if run >= min_chars {
                return true;
            }
        } else {
            run = 0;
        }
    }
    false
}

/// English wh- and relative constructions allow a stranded preposition. In `what it reaches out to` and `what this is an example of`, the final word is a preposition, but its object has been fronted, so the sentence is complete.
///
/// Only `to` and `of`, which currently trigger false sentence ends in the dangling-word table, are exempted. The exemption also requires an explicit clause subject between the wh-word and the final preposition. This way `what to do because of.` is still reported, and it is not exempted just because a `what` happens to appear somewhere far away.
fn has_fronted_latin_preposition_object(text: &str) -> bool {
    let tokens = text
        .split(|ch: char| !ch.is_alphanumeric() && ch != '\'')
        .filter(|token| !token.is_empty())
        .map(|token| token.to_ascii_lowercase())
        .collect::<Vec<_>>();
    let Some(last) = tokens.last() else {
        return false;
    };
    if !matches!(last.as_str(), "to" | "of") {
        return false;
    }
    let wh = ["what", "who", "whom", "which", "where"];
    let subjects = [
        "i", "you", "he", "she", "it", "we", "they", "this", "that", "these", "those",
    ];
    let search_start = tokens.len().saturating_sub(12);
    (search_start..tokens.len().saturating_sub(1))
        .rev()
        .find(|index| wh.contains(&tokens[*index].as_str()))
        .is_some_and(|index| {
            tokens[index + 1..tokens.len() - 1]
                .iter()
                .any(|token| subjects.contains(&token.as_str()) || token.ends_with("'s"))
        })
}

/// English infinitive ellipsis: in `They can slow down any time they want to.`, `You don't have to.` and `I was going to.`, the final word is `to`. But it marks an elided verb phrase, not a preposition waiting for an object, so the sentence is complete. Only a `to` immediately after these permitted verbs is exempted. (In spoken interviews, `want to.`-type endings were rejected by polish acceptance, and the agent could only hand the text back unchanged.) `example of.` and `what to do because of.` remain false sentence ends, as before.
fn is_elliptical_infinitive_end(text: &str) -> bool {
    const LICENSORS: &[&str] = &[
        "want", "wants", "wanted", "need", "needs", "needed", "have", "has", "had", "going",
        "able", "ought", "used", "like", "likes", "liked", "love", "loves", "loved", "try",
        "tries", "tried", "supposed", "meant", "mean", "means", "plan", "plans", "planned",
        "intend", "intends", "intended", "hope", "hopes", "hoped", "got", "get", "gets", "forgot",
        "forget", "refuse", "refused", "refuses", "chose", "choose", "decided", "decide", "expect",
        "expected", "wish", "wished", "afford", "deserve", "deserves", "deserved", "allowed",
        "expects", "wishes",
    ];
    let mut tokens = text
        .split(|ch: char| !ch.is_alphanumeric() && ch != '\'')
        .filter(|token| !token.is_empty())
        .map(|token| token.to_ascii_lowercase())
        .rev();
    tokens.next().is_some_and(|last| last == "to")
        && tokens
            .next()
            .is_some_and(|before| LICENSORS.contains(&before.as_str()))
}

/// Whether a two-character ending that ends in 「的」 is self-sufficient. “some” is a pronoun only when it stands **alone** (有的人 "some people", 有的是 "some are"). When other meaningful characters come before it, it is an attributive plus 的, as in 「现有的」 / 「所有的」 / 「已有的」 ("existing" / "all" / "already existing"), which still awaits its head noun. (Measured bad seam in the speed-limit case: `从你现有的 ‖ GPU 中获得…`.)
fn de_tail_complete(trimmed: &str, tail: &str) -> bool {
    if !DE_TAIL_COMPLETE_BIGRAMS.contains(&tail) {
        return false;
    }
    if tail != "有的" {
        return true;
    }
    !trimmed
        .chars()
        .rev()
        .nth(2)
        .is_some_and(|ch| is_ideograph(ch))
}

/// Whether the piece starts with a clinging particle or a coordinating conjunction. The preposition 「于」 almost always belongs to the predicate of the preceding piece (类似于 "similar to", 取决于 "depends on", 属于 "belongs to“so”.
pub fn starts_dangling(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.starts_with('于') && !trimmed.starts_with("于是") {
        return true;
    }
    let Some(first) = trimmed.chars().next() else {
        return false;
    };
    if LEADING_DANGLING_CJK.contains(&first) {
        return true;
    }
    LEADING_COORDINATOR_CJK.contains(&first)
        && !LEADING_COORDINATOR_WORDS
            .iter()
            .any(|word| trimmed.starts_with(word))
}

/// Whether a bare trailing piece lands on a weak ending that cannot be paused at grammatically. Returns `(severity, matched ending form)`. A piece ending with punctuation (including after a closer) is never counted.
///
/// It is kept separate from [`ends_dangling`] on purpose. `ends_dangling` also applies to **source** pieces (`validate_source_shape`), and mixing the Chinese weak-ending table into it would turn it into a source-side blocker in zh→X tasks.
pub fn ends_weak_tail(text: &str) -> Option<(SeamLintKind, &'static str)> {
    let trimmed = text.trim();
    let stripped = strip_closers(trimmed);
    let last = stripped.chars().last()?;
    if CLAUSE_PUNCT.contains(&last) {
        return None;
    }
    let tail2: String = stripped
        .chars()
        .rev()
        .take(2)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    // The locative frame “at … on”: the whole prepositional phrase is still waiting for its predicate (R2 「这里的输出质量在数学上 | 与单独运行大模型完全相同。」). It triggers only when 在 appears in the same piece. This avoids self-sufficient words such as 以上 ("above"), 晚上 ("evening"), 网上 ("online") and 线上 ("online") without needing a whitelist.
    if last == '上' && tail2 != "以上" && stripped.chars().rev().take(12).any(|ch| ch == '在') {
        return Some((SeamLintKind::Blocking, "在…上"));
    }
    if last == '得' && !WEAK_TAIL_DE_COMPLETE_BIGRAMS.contains(&tail2.as_str()) {
        return Some((SeamLintKind::Blocking, "得"));
    }
    if let Some(form) = morphological_weak_tail(stripped) {
        return Some((SeamLintKind::Blocking, form));
    }
    if let Some(word) = WEAK_TAIL_BLOCKING_WORDS
        .iter()
        .find(|word| stripped.ends_with(**word))
    {
        return Some((SeamLintKind::Blocking, word));
    }
    WEAK_TAIL_ADVISORY_WORDS
        .iter()
        .find(|word| stripped.ends_with(**word))
        .map(|word| (SeamLintKind::Advisory, *word))
}

/// Morphology-class weak-ending judgment (open class). On a hit it returns the form name. All are Blocking.
///
/// The input is a bare trailing piece that has already been through `strip_closers` and is confirmed not to end with punctuation. All whitespace is stripped first: the delivery projection inserts spaces between CJK and Latin text, so the morphological adjacency of pieces such as `35% 里` or `将 max_...` must not be broken by those spaces.
fn morphological_weak_tail(stripped: &str) -> Option<&'static str> {
    let chars: Vec<char> = stripped.chars().filter(|ch| !ch.is_whitespace()).collect();
    let last = *chars.last()?;
    // The lookback window is counted in units. A run of consecutive ASCII tokens counts as one unit. Otherwise a piece such as `将 max_num_batched_tokens` would have its whole window consumed by one long Latin word.
    let units = unit_offsets_from_end(&chars);
    let bigram: String = chars[chars.len().saturating_sub(2)..].iter().collect();

    // 2 · Transitive verb + directional or resultative complement (到/掉/出/成) at the end ⇒ the object is in the next piece. Checked before the disposal construction, because `把 X 映射到` matches both, and the missing object is the actual flaw.
    if VERB_COMPLEMENT_TAILS.contains(&last) && chars.len() >= 2 {
        let head = chars[chars.len() - 2];
        // The character before must be a meaningful character (`8 到` and `v2 出` are not complements).
        if is_ideograph(head) && !VERB_COMPLEMENT_COMPLETE_BIGRAMS.contains(&bigram.as_str()) {
            return Some("动补缺宾");
        }
    }

    // 3 · Locative frame not closed. 「上」 reuses the existing lookback for 「在…上」. 里/中/下/内/间 are additionally triggered by a "quantity/Latin + locative“that is, within these 35% | used for KV…”).
    if LOCATIVE_SUFFIX_CJK.contains(&last)
        && chars.len() >= 2
        && !LOCATIVE_COMPLETE_BIGRAMS.contains(&bigram.as_str())
    {
        let head = chars[chars.len() - 2];
        let quantified = head.is_ascii_alphanumeric() || head == '%' || head == '％';
        let framed = chars.iter().enumerate().any(|(index, ch)| {
            units[index] <= FRAME_LOOKBACK + 2 && LOCATIVE_FRAME_CJK.contains(ch)
        });
        if quantified || framed {
            return Some("方位框架");
        }
    }

    // 6 · A bare copula 「是」 at the end: the predicate nominal must be in the next piece.
    if last == '是' && !COPULA_COMPLETE_BIGRAMS.contains(&bigram.as_str()) {
        return Some("系词缺表语");
    }

    // 5 · Light verb: `来/去 + monosyllabic reduplicated verb` (来聊聊 "come chat", 去看看 "go take a look") missing its object.
    if chars.len() >= 3 && chars[chars.len() - 2] == last && is_ideograph(last) {
        let light = chars
            .iter()
            .rev()
            .skip(2)
            .take(3)
            .any(|ch| LIGHT_VERB_FRAME_CJK.contains(ch));
        if light {
            return Some("光动词重叠");
        }
    }

    // 1/4 · A disposal construction (把/将 + NP) and a pivotal construction (让/使/叫 + NP) with no predicate after them. If the piece ends on a complement or aspect marker, a predicate is considered present, and it is handled by the complement criterion above.
    if !PREDICATE_TAIL_CJK.contains(&last) {
        for index in (0..chars.len().saturating_sub(1)).rev() {
            if units[index] > FRAME_LOOKBACK {
                break;
            }
            let ch = chars[index];
            if !FRAME_DISPOSAL_CJK.contains(&ch) {
                continue;
            }
            let before: String = chars[index.saturating_sub(1)..=index].iter().collect();
            let after: String = chars[index..].iter().take(2).collect();
            if FRAME_COMPLETE_BIGRAMS.contains(&before.as_str())
                || FRAME_COMPLETE_BIGRAMS.contains(&after.as_str())
            {
                break;
            }
            return Some(if ch == '把' || ch == '将' {
                "处置式缺谓语"
            } else {
                "兼语式缺谓语"
            });
        }
    }

    None
}

/// The "unit distance" from each character to the end of the piece: a run of consecutive ASCII tokens (including `_-.`) counts as one unit as a whole, and every other character counts as one unit. The distance at the last character of the piece is 0.
fn unit_offsets_from_end(chars: &[char]) -> Vec<usize> {
    let mut offsets = vec![0usize; chars.len()];
    let mut unit = 0usize;
    let mut previous_ascii_word = false;
    for index in (0..chars.len()).rev() {
        let ch = chars[index];
        let ascii_word = ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.');
        if index + 1 < chars.len() && !(ascii_word && previous_ascii_word) {
            unit += 1;
        }
        offsets[index] = unit;
        previous_ascii_word = ascii_word;
    }
    offsets
}

pub(crate) fn is_ideograph(ch: char) -> bool {
    matches!(ch, '\u{4E00}'..='\u{9FFF}' | '\u{3040}'..='\u{30FF}' | '\u{AC00}'..='\u{D7AF}')
}

/// The target piece boundary may be cutting inside a CJK word: both sides are CJK ideographs, and there is no punctuation or whitespace at the seam. The deterministic splitter works atom by atom on characters and has no dictionary, so cuts inside words such as "简|化" or "思考如|何" can only be blocked conservatively.
///
/// A seam between two Hangul syllables does not count. Korean is split by spaces, its atoms are eojeol, and the seams between atoms are already word boundaries. (Before 0.5, per-syllable scripts relied on a "sticks to previous" mark on words to block this; see `layout::seam_grade`.) Seams where Hangul is next to Han or kana still count as inside a word.
pub(crate) fn cjk_midword_boundary(left: &str, right: &str) -> bool {
    let (Some(last), Some(first)) = (left.chars().next_back(), right.chars().next()) else {
        return false;
    };
    is_ideograph(last)
        && is_ideograph(first)
        && !(crate::atomize::is_hangul_syllable(last) && crate::atomize::is_hangul_syllable(first))
}

/// Whether there is a fully legal free seam within the piece that **truly resolves** the over-line problem. All four conditions are required:
///
/// 1. Neither side exceeds fit. Otherwise the cut still leaves an over-line piece, just at the cost of one more piece.
/// 2. Both sides are longer than [`MIN_PIECE_CHARS`]. A flash fragment is not a subtitle line.
/// 3. Neither side triggers an objective seam problem ([`is_objective_blocking`]).
/// 4. It does not fall inside a CJK word boundary, since the draft gate would reject it after the cut.
///
/// This is the precondition for "a piece that exceeds fit must be cut again". It is also the criterion body for "a seam is enforced only if it is a **fully legal** seam". An over-fit piece that returns `None` goes to the translation-unsplittable channel and is delivered whole (audit §7 P0-a).
pub fn free_seam(text: &str, lang: &str, params: &TransParams) -> Option<(String, String)> {
    let atoms = atomize(text);
    if atoms.len() < 2 {
        return None;
    }
    for cut in 1..atoms.len() {
        let left = join_word_texts(atoms[..cut].iter().map(String::as_str));
        let right = join_word_texts(atoms[cut..].iter().map(String::as_str));
        if left.trim().is_empty() || right.trim().is_empty() {
            continue;
        }
        // The seam must be backed by punctuation or whitespace in the source, with the same basis as the DP seam grading. A rendered space at a CJK/Latin junction is not a seam: a cut such as “worried | AI will take away…”, made between a verb and its object clause, is not one. Otherwise a "free seam exists" check would treat a clearly worse cut as a requirement to enforce.
        if !sentence_end(&left)
            && clause_end_char(&left).is_none()
            && !seam_backed_by_whitespace(text, &atoms, cut)
        {
            continue;
        }
        if [&left, &right].iter().any(|side| {
            exceeds_one_line_fit(side, lang, params.fit)
                || piece_display_units(side, lang) <= MIN_PIECE_CHARS
        }) {
            continue;
        }
        if cjk_midword_boundary(left.trim_end(), right.trim_start()) {
            continue;
        }
        let refs = [left.as_str(), right.as_str()];
        if lint_pieces(&refs, lang, params)
            .iter()
            .any(is_objective_blocking)
        {
            continue;
        }
        return Some((left, right));
    }
    None
}

/// Whether the piece ends with a 顿号 (、, the enumeration comma). It is a parallel separator, not a display seam.
pub fn ends_list_separator(text: &str) -> bool {
    text.trim().chars().last() == Some('、')
}

/// A "number | unit" split across a seam: after stripping closers, the left piece ends in an ASCII digit, and the right piece starts with a unit or measure word that almost unambiguously follows a number.
fn number_unit_split(left: &str, right: &str) -> bool {
    let ends_digit = strip_closers(left.trim())
        .chars()
        .last()
        .is_some_and(|ch| ch.is_ascii_digit());
    if !ends_digit {
        return false;
    }
    let right = right.trim_start();
    NUMBER_UNIT_PREFIXES
        .iter()
        .any(|unit| right.starts_with(unit))
}

/// An incomplete noun phrase spanning pieces, such as “we have one | a system we want to change”. A quantity word may be legitimately omitted, so only the high-confidence predicate endings in the table above are blocked, and the next piece must have actual lexical content.
fn incomplete_nominal_split(left: &str, right: &str) -> bool {
    let left = left.trim_end();
    if left.is_empty() || ends_clause_punct(left) {
        return false;
    }
    let right = right.trim_start();
    !right.is_empty()
        && INCOMPLETE_CJK_NOMINAL_TAILS
            .iter()
            .any(|tail| left.ends_with(tail))
}

/// "… X ‖ 中/里/上…": a locative suffix is pushed into the right piece, breaking the locative frame in the middle.
///
/// The criterion mirrors the locative-frame check at the end of a piece, and it is equally narrow. The left piece must have an explicit introducing word (在/从/对/往/向), or end in a quantity or Latin token. The first character of the right piece must not itself form a word (中国 "China", 下面 "below", 内容 "content" …).
fn leading_locative_split(left: &str, right: &str) -> bool {
    let left = left.trim_end();
    if left.is_empty() || ends_clause_punct(left) {
        return false;
    }
    let right = right.trim_start();
    let Some(head) = right.chars().next() else {
        return false;
    };
    if !LOCATIVE_SUFFIX_CJK.contains(&head) && head != '上' {
        return false;
    }
    let quantified = left
        .chars()
        .next_back()
        .is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == '%' || ch == '％');
    let framed = left
        .chars()
        .rev()
        .take(FRAME_LOOKBACK + 2)
        .any(|ch| LOCATIVE_FRAME_CJK.contains(&ch));
    if !quantified && !framed {
        return false;
    }
    !LEADING_LOCATIVE_WORDS
        .iter()
        .any(|word| right.starts_with(word))
}

/// "A 和 B ‖ head": the seam falls after the second coordinated item, splitting the coordinated noun phrase from its head.
///
/// Precision gates, all required. 和 also serves as a preposition (“glad to chat with everyone | how…”). Misjudging it would block legal seams and turn a dangling tail into an over-line piece, so the criterion is kept narrow. The left piece must not end with punctuation. The second coordinated item must be **short and nominal**: a single Latin or digit token, or no more than 3 Han characters that do not contain a reduplicated verb. A preposition 和 followed by "NP + predicate" does not fit this window because of its length. The right piece must start with a Han character and must not be a clause introduced by a personal-pronoun subject, an adversative or continuative conjunction, or an interrogative word.
fn coordinated_head_split(left: &str, right: &str) -> bool {
    /// The maximum number of Han characters in the second coordinated item.
    const MAX_SECOND_ITEM_CHARS: usize = 3;
    const SUBJECT_PRONOUN_CJK: &[char] = &['我', '你', '他', '她', '它', '咱', '您'];
    /// Right pieces starting with these words are new clauses, not the head of a coordinated noun phrase.
    const CLAUSE_OPENER_CJK: &[&str] = &[
        "如何",
        "怎么",
        "怎样",
        "什么",
        "为什么",
        "是否",
        "能否",
        "以及",
        "还是",
        "就是",
        "都是",
    ];
    let left = left.trim_end();
    if left.is_empty() || ends_clause_punct(left) {
        return false;
    }
    let right = right.trim_start();
    let Some(head) = right.chars().next() else {
        return false;
    };
    if !is_ideograph(head) || SUBJECT_PRONOUN_CJK.contains(&head) {
        return false;
    }
    if CUT_BEFORE_CJK
        .iter()
        .chain(CLAUSE_OPENER_CJK.iter())
        .any(|word| right.starts_with(word))
    {
        return false;
    }
    let chars: Vec<char> = left.chars().collect();
    let Some(index) = chars
        .iter()
        .rposition(|ch| LEADING_COORDINATOR_CJK.contains(ch))
    else {
        return false;
    };
    // When the conjunction is itself a word (和平 "peace", 与其 "rather than", 及时 "timely"), it is not coordination.
    let from_coordinator: String = chars[index..].iter().collect();
    if LEADING_COORDINATOR_WORDS
        .iter()
        .any(|word| from_coordinator.starts_with(word))
    {
        return false;
    }
    let second: Vec<char> = chars[index + 1..]
        .iter()
        .copied()
        .filter(|ch| !ch.is_whitespace())
        .collect();
    if second.is_empty() || second.iter().any(|ch| CLAUSE_PUNCT.contains(ch)) {
        return false;
    }
    if second
        .iter()
        .all(|ch| ch.is_ascii_alphanumeric() || *ch == '_' || *ch == '-')
    {
        return true;
    }
    if second.len() > MAX_SECOND_ITEM_CHARS || !second.iter().all(|ch| is_ideograph(*ch)) {
        return false;
    }
    // A reduplicated verb (聊聊, 看看) shows that 和 is a preposition, and what follows is a predicate, not a coordinated item.
    !second.windows(2).any(|pair| pair[0] == pair[1])
}

/// Whether the source word ends with a semantic seam punctuation mark (semicolon, colon, dash). An ordinary comma does not count.
pub fn ends_semantic_seam_punct(text: &str) -> bool {
    let stripped = strip_closers(text.trim());
    stripped
        .chars()
        .last()
        .is_some_and(|ch| SEMANTIC_SEAM_PUNCT.contains(&ch))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SeamLintKind {
    /// Blocking: triggers an LLM retry or fallback repair.
    Blocking,
    /// Advisory: a better seam exists between soft+1 and hard. Does not block.
    Advisory,
}

/// Issue categories. Dangling and clinging are objective flaws, so worker answers can be reworked accordingly. Flash fragments and aim-band are length trade-offs and only give a hint.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeamLintClass {
    DanglingTail,
    /// A bare trailing piece lands on a weak form that cannot grammatically pause there (structural particle, adverb, auxiliary, measure word, light verb).
    WeakTail,
    BoundHead,
    IncompleteNominal,
    ListSeparator,
    /// The seam falls inside a closed pair of paired delimiters (quotes or brackets are split).
    UnpairedDelimiter,
    FlashFragment,
    AimBand,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeamLintIssue {
    pub piece_index: usize,
    pub kind: SeamLintKind,
    pub class: SeamLintClass,
    pub message: String,
}

/// Objective flaw-level issues (Blocking for a dangling tail or a clinging head). The engine's acceptance-and-rework and the lint at `task submit` submission time share this judgment. If the two sides' rules disagreed, the worker would pass at submission and only be rejected in the engine's aggregated repair batch, adding an unnecessary call (measured in the p850 benchmark).
pub fn is_objective_blocking(issue: &SeamLintIssue) -> bool {
    issue.kind == SeamLintKind::Blocking
        && matches!(
            issue.class,
            SeamLintClass::DanglingTail
                | SeamLintClass::WeakTail
                | SeamLintClass::BoundHead
                | SeamLintClass::IncompleteNominal
                | SeamLintClass::ListSeparator
                | SeamLintClass::UnpairedDelimiter
        )
}

/// Whether the seam falls inside a closed pair of delimiters. Returns `(seam index, number of target-language reading units spanned by that delimiter pair)`. The seam index is the index of the right piece.
///
/// Only **closed** delimiter pairs are recognized. When the whole sentence has only half a quote (ASR or the translation does not pair them), no split can avoid it, and the worker should not be sent back again and again. The span is computed by plain concatenation (without adding `sep_len` spaces) and is used only for comparison with hard. The error is at most one space.
fn delimiter_pair_seams(pieces: &[&str], lang: &str) -> Vec<(usize, usize)> {
    let mut chars: Vec<char> = Vec::new();
    let mut bounds: Vec<usize> = Vec::with_capacity(pieces.len());
    for text in pieces {
        bounds.push(chars.len());
        chars.extend(text.chars());
    }
    let mut stack: Vec<(char, usize)> = Vec::new();
    let mut spans: Vec<(usize, usize)> = Vec::new();
    for (pos, ch) in chars.iter().copied().enumerate() {
        if DELIM_PAIRS.iter().any(|(open, _)| *open == ch) {
            stack.push((ch, pos));
            continue;
        }
        if let Some(open) = DELIM_PAIRS
            .iter()
            .find(|(_, close)| *close == ch)
            .map(|(open, _)| *open)
            && let Some(at) = stack.iter().rposition(|(pending, _)| *pending == open)
        {
            spans.push((stack[at].1, pos));
            stack.truncate(at);
        }
    }
    (1..pieces.len())
        .filter_map(|index| {
            let seam = bounds[index];
            let (open, close) = spans
                .iter()
                .copied()
                .find(|(open, close)| *open < seam && seam <= *close)?;
            let span: String = chars[open..=close].iter().collect();
            Some((index, target_cps_chars(&span, lang)))
        })
        .collect()
}

/// Runs the seam-quality lint on a set of pieces. `lang` and `params` are used for the aim-band advisory.
pub fn lint_pieces(pieces: &[&str], lang: &str, params: &TransParams) -> Vec<SeamLintIssue> {
    let mut issues = Vec::new();
    if pieces.is_empty() {
        return issues;
    }
    let pair_seams = delimiter_pair_seams(pieces, lang);
    for (index, text) in pieces.iter().enumerate() {
        // A piece's own display width is counted by the contract's basis, where end-of-piece punctuation is free. When summing feasibility for a merge, a piece that becomes the **head** of the merged result has its end punctuation turn into inline load, so it must be counted in full with `target_cps_chars`. A piece that remains the **tail** is still counted by this basis.
        let chars = piece_display_units(text, lang);
        // The last piece may dangle, since the next sentence continues it. Middle pieces may not.
        // Piece numbers in messages are always 1-based ("piece 2/4"), the same base as the segment numbers in validate_source_shape. In the p850 benchmark the worker read the 0-based "piece 1" as the first piece and rewrote the answer for the wrong piece.
        let ordinal = index + 1;
        let total = pieces.len();
        if index + 1 < pieces.len() && ends_dangling(text) {
            issues.push(SeamLintIssue {
                piece_index: index,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::DanglingTail,
                message: format!(
                    "piece {ordinal}/{total} ends on a dangling connective — keep it with the words it attaches to"
                ),
            });
        }
        // Weak endings (得 / 在…上 / adverb / auxiliary / measure word / light verb) and dangling connectives are different forms of the same flaw. A piece already judged DanglingTail is not reported again.
        if index + 1 < pieces.len()
            && !ends_dangling(text)
            && let Some((kind, form)) = ends_weak_tail(text)
        {
            issues.push(SeamLintIssue {
                piece_index: index,
                kind,
                class: SeamLintClass::WeakTail,
                message: format!(
                    "piece {ordinal}/{total} ends on 「{form}」, which still needs the words that follow — move the cut later or merge with the next piece"
                ),
            });
        }
        if index > 0 && starts_dangling(text) && !ends_clause_punct(pieces[index - 1]) {
            let coordinator = text
                .trim()
                .chars()
                .next()
                .is_some_and(|ch| LEADING_COORDINATOR_CJK.contains(&ch));
            issues.push(SeamLintIssue {
                piece_index: index,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::BoundHead,
                message: if coordinator {
                    format!(
                        "piece {ordinal}/{total} starts with the coordinator 和/及/与/或 — never cut before it; keep the coordinated items in one piece"
                    )
                } else {
                    format!(
                        "piece {ordinal}/{total} starts with a bound particle — keep it with the preceding words"
                    )
                },
            });
        }
        // A locative suffix at the start of a piece breaks the locative frame in the middle (「从你现有的 GPU ‖ 中获得…」). It is the mirror image of the locative-frame check at the end of a piece, the same flaw from the other side.
        if index > 0 && leading_locative_split(pieces[index - 1], text) {
            issues.push(SeamLintIssue {
                piece_index: index,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::BoundHead,
                message: format!(
                    "piece {ordinal}/{total} starts with a locative suffix bound to the preceding noun phrase — keep the whole 在/从…里/中/上 frame in one piece"
                ),
            });
        }
        if index > 0 && number_unit_split(pieces[index - 1], text) {
            issues.push(SeamLintIssue {
                piece_index: index,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::BoundHead,
                message: format!(
                    "piece {ordinal}/{total} starts with a unit or measure word bound to the number ending the previous piece — move the cut after the full quantity"
                ),
            });
        }
        // The mirror image of coordination: `LEADING_COORDINATOR_CJK` only forbids cutting **before** 和/及/与. Cutting **after the second coordinated item** equally splits the coordinated noun phrase from its head (R3 “…stored those Key and Value | matrix, …”).
        if index > 0 && coordinated_head_split(pieces[index - 1], text) {
            issues.push(SeamLintIssue {
                piece_index: index - 1,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::IncompleteNominal,
                message: format!(
                    "piece {index}/{total} ends right after the second coordinated item — never cut after it either; keep the coordinated phrase with its head noun"
                ),
            });
        }
        if index > 0 && incomplete_nominal_split(pieces[index - 1], text) {
            issues.push(SeamLintIssue {
                piece_index: index - 1,
                kind: SeamLintKind::Blocking,
                class: SeamLintClass::IncompleteNominal,
                message: format!(
                    "piece {index}/{total} ends with an incomplete Chinese nominal phrase — keep its classifier/determiner with the following head noun"
                ),
            });
        }
        // The enumeration comma is a parallel separator, not a seam. Short coordinated items that get split should be merged. For long enumerations where merging would exceed hard, the seam is kept but a hint is emitted.
        if index > 0 && ends_list_separator(pieces[index - 1]) {
            let merged = target_cps_chars(pieces[index - 1], lang) + chars;
            issues.push(SeamLintIssue {
                piece_index: index - 1,
                kind: if merged <= params.hard {
                    SeamLintKind::Blocking
                } else {
                    SeamLintKind::Advisory
                },
                class: SeamLintClass::ListSeparator,
                message: format!(
                    "piece {index}/{total} ends on the list separator 、 — merge the list items or cut at a stronger seam"
                ),
            });
        }
        // Content inside quotes or brackets is not a seam: quoted content should be kept whole in one piece. When the delimiter span **reaches** hard, the cut is unavoidable, so it is downgraded to a hint to avoid sending the worker back again and again. The condition must be `span < hard`. A whole quoted piece with span == hard does not exceed the limit, but it has no room left for any text outside the quotes, so it forces the worker to split the content inside the quotes alone. The s-g25.25 benchmark measured that the cut recommended by the advisory is exactly the one the submit lint rejects as Blocking, which forms an unsatisfiable loop.
        if let Some((_, span)) = pair_seams.iter().copied().find(|(seam, _)| *seam == index) {
            issues.push(SeamLintIssue {
                piece_index: index - 1,
                kind: if span < params.hard {
                    SeamLintKind::Blocking
                } else {
                    SeamLintKind::Advisory
                },
                class: SeamLintClass::UnpairedDelimiter,
                message: format!(
                    "piece {index}/{total} ends inside a paired delimiter — keep the quoted or bracketed span in one piece"
                ),
            });
        }
        if pieces.len() > 1 && chars <= MIN_PIECE_CHARS {
            let mut can_merge = false;
            if index > 0
                && !ends_sentence_final(pieces[index - 1])
                && target_cps_chars(pieces[index - 1], lang) + chars <= params.hard
            {
                can_merge = true;
            }
            if index + 1 < pieces.len()
                && target_cps_chars(text, lang) + piece_display_units(pieces[index + 1], lang)
                    <= params.hard
            {
                can_merge = true;
            }
            issues.push(SeamLintIssue {
                piece_index: index,
                kind: if can_merge {
                    SeamLintKind::Blocking
                } else {
                    SeamLintKind::Advisory
                },
                class: SeamLintClass::FlashFragment,
                message: format!(
                    "piece {ordinal}/{total} is a {chars}-char flash fragment — merge it with a compatible neighbor when the hard limit allows"
                ),
            });
        }
        if chars > params.soft && chars <= params.hard {
            if let Some(split) = preferred_target_split(text, lang, params.soft, Some(params.hard))
            {
                issues.push(SeamLintIssue {
                    piece_index: index,
                    kind: SeamLintKind::Advisory,
                    class: SeamLintClass::AimBand,
                    message: format!(
                        "piece {ordinal}/{total} is {chars} chars — above the {}-char aim; preferred {} cut (\"{}\" | \"{}\") is optional",
                        params.soft, split.reason, split.left, split.right
                    ),
                });
            }
        }
    }
    issues
}

/// Merges adjacent pieces to eliminate blocking-level seam problems. The concatenation invariant is preserved.
pub fn repair_lint_pieces(pieces: Vec<String>, lang: &str, params: &TransParams) -> Vec<String> {
    let mut current = pieces;
    for _ in 0..current.len().saturating_mul(2).max(1) {
        let refs: Vec<&str> = current.iter().map(String::as_str).collect();
        let blocking: Vec<_> = lint_pieces(&refs, lang, params)
            .into_iter()
            .filter(|issue| issue.kind == SeamLintKind::Blocking)
            .collect();
        if blocking.is_empty() || current.len() <= 1 {
            break;
        }
        // Prefer merging a flash fragment with a neighbor. Next, merge a piece with a dangling ending into the following piece, and a piece with a clinging start into the preceding piece.
        let index = blocking[0].piece_index;
        let chars = piece_display_units(&current[index], lang);
        let short_tag_fits_previous = chars <= MIN_PIECE_CHARS
            && index > 0
            && !ends_sentence_final(&current[index - 1])
            && target_cps_chars(&current[index - 1], lang) + chars <= params.hard;
        let next_fits = index + 1 < current.len()
            && target_cps_chars(&current[index], lang)
                + piece_display_units(&current[index + 1], lang)
                <= params.hard;
        let previous_fits =
            index > 0 && target_cps_chars(&current[index - 1], lang) + chars <= params.hard;
        let merge_with_next = if short_tag_fits_previous {
            false
        } else if next_fits {
            true
        } else if previous_fits {
            false
        } else {
            // Delivery hard is a delivery invariant. When no adjacent piece can be absorbed safely, keep the current seam and hand it to a targeted LLM refinement. Never produce an over-hard piece just to eliminate a lint.
            break;
        };
        let (left, right) = if merge_with_next {
            (index, index + 1)
        } else {
            (index - 1, index)
        };
        let merged = join_word_texts([current[left].as_str(), current[right].as_str()]);
        current.splice(left..=right, [merged]);
    }
    current
}

/// Post-acceptance repair of worker answers. Only flash fragments that can safely be absorbed into a neighbor are merged (Blocking-level FlashFragment), and the text and in-sentence source word spans are merged in sync. Dangling and clinging seams are already rejected on the acceptance side, so this does not change other seams. It keeps at least 2 pieces and never produces an over-hard piece. The side-selection logic is the same as in [`repair_lint_pieces`].
pub fn repair_flash_pieces_with_ranges(
    pieces: Vec<(String, (usize, usize))>,
    lang: &str,
    params: &TransParams,
) -> Vec<(String, (usize, usize))> {
    let mut current = pieces;
    for _ in 0..current.len().saturating_mul(2).max(1) {
        if current.len() <= 2 {
            break;
        }
        let refs: Vec<&str> = current.iter().map(|(text, _)| text.as_str()).collect();
        let Some(issue) = lint_pieces(&refs, lang, params).into_iter().find(|issue| {
            issue.kind == SeamLintKind::Blocking && issue.class == SeamLintClass::FlashFragment
        }) else {
            break;
        };
        let index = issue.piece_index;
        let chars = piece_display_units(&current[index].0, lang);
        let short_tag_fits_previous = chars <= MIN_PIECE_CHARS
            && index > 0
            && !ends_sentence_final(&current[index - 1].0)
            && target_cps_chars(&current[index - 1].0, lang) + chars <= params.hard;
        let next_fits = index + 1 < current.len()
            && target_cps_chars(&current[index].0, lang)
                + piece_display_units(&current[index + 1].0, lang)
                <= params.hard;
        let previous_fits =
            index > 0 && target_cps_chars(&current[index - 1].0, lang) + chars <= params.hard;
        let merge_with_next = if short_tag_fits_previous {
            false
        } else if next_fits {
            true
        } else if previous_fits {
            false
        } else {
            break;
        };
        let (left, right) = if merge_with_next {
            (index, index + 1)
        } else {
            (index - 1, index)
        };
        let merged_text = join_word_texts([current[left].0.as_str(), current[right].0.as_str()]);
        let merged_range = (current[left].1.0, current[right].1.1);
        current.splice(left..=right, [(merged_text, merged_range)]);
    }
    current
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreferredTargetSplit {
    pub left: String,
    pub right: String,
    pub cut_offset: usize,
    pub left_chars: usize,
    pub right_chars: usize,
    pub reason: String,
}

fn ascii_word_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_'
}

/// Finds a balanced natural seam in the target-language text. Returns `None` if there is no safe candidate.
pub fn preferred_target_split(
    text: &str,
    lang: &str,
    aim: usize,
    hard: Option<usize>,
) -> Option<PreferredTargetSplit> {
    if aim == 0 {
        return None;
    }
    let trimmed = text.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    let total = count_cps_chars(trimmed);
    if total <= aim || chars.len() < 2 {
        return None;
    }
    let is_cjk = is_cjk_lang(lang);
    let mut candidates: Vec<(usize, i32, String)> = Vec::new();

    let mut i = 0;
    while i + 1 < chars.len() {
        if !STRONG_CLAUSE_PUNCT.contains(&chars[i]) {
            i += 1;
            continue;
        }
        let punct = chars[i];
        if i > 0 && i + 1 < chars.len() {
            let left = chars[i - 1];
            let right = chars[i + 1];
            let glued = ascii_word_char(left) && ascii_word_char(right);
            if matches!(punct, '.' | ':') && glued {
                i += 1;
                continue;
            }
            if punct == ',' && left.is_ascii_digit() && right.is_ascii_digit() {
                i += 1;
                continue;
            }
        }
        if !is_cjk && punct == '.' {
            let mut start = i;
            while start > 0 && !chars[start - 1].is_whitespace() {
                start -= 1;
            }
            let token: String = chars[start..=i].iter().collect::<String>().to_lowercase();
            // Abbreviations and single-letter dotted strings (Dr. / U.S.) are not clause seams.
            if !sentence_end(&token) {
                i += 1;
                continue;
            }
        }
        let mut j = i;
        while j + 1 < chars.len() && STRONG_CLAUSE_PUNCT.contains(&chars[j + 1]) {
            j += 1;
        }
        while j + 1 < chars.len() && CLOSERS.contains(&chars[j + 1]) {
            j += 1;
        }
        let offset = j + 1;
        if offset < chars.len() {
            candidates.push((offset, 0, format!("clause punctuation {punct}")));
        }
        i = i.max(j) + 1;
    }

    if is_cjk && chars.len() >= 3 {
        for at in 1..(chars.len() - 1) {
            if at + 1 >= chars.len() {
                break;
            }
            let word: String = chars[at..=at + 1].iter().collect();
            if CUT_BEFORE_CJK.contains(&word.as_str()) {
                candidates.push((at, 1, format!("discourse connective {word}")));
            }
        }
    }

    if !is_cjk {
        let mut w = 1;
        while w + 1 < chars.len() {
            if !chars[w].is_whitespace() || chars[w - 1].is_whitespace() {
                w += 1;
                continue;
            }
            let mut s = w;
            while s < chars.len() && chars[s].is_whitespace() {
                s += 1;
            }
            if s >= chars.len() {
                break;
            }
            let mut e = s;
            let mut word = String::new();
            while e < chars.len() && chars[e].is_alphabetic() {
                word.push(chars[e]);
                e += 1;
            }
            if CUT_BEFORE_LATIN.contains(&word.to_ascii_lowercase().as_str()) {
                candidates.push((w, 1, format!("discourse connective {word}")));
            }
            w = s.max(w + 1);
        }
    }

    let min_side = (if is_cjk { 7 } else { 10 }).max(((aim as f64) * 0.30).ceil() as usize);
    let min_ratio = if is_cjk { 0.40 } else { 0.35 };
    let mut best: Option<(PreferredTargetSplit, i32, usize, usize)> = None;
    let mut seen = std::collections::BTreeSet::new();
    for (offset, tier, reason) in candidates {
        if !seen.insert(offset) {
            continue;
        }
        // Basic safety: do not split inside an ASCII word, and do not land after an opener or before a closer.
        if offset == 0 || offset >= chars.len() {
            continue;
        }
        let left_ch = chars[offset - 1];
        let right_ch = chars[offset];
        if ascii_word_char(left_ch) && ascii_word_char(right_ch) {
            continue;
        }
        let left: String = chars[..offset].iter().collect::<String>().trim().to_owned();
        let right: String = chars[offset..].iter().collect::<String>().trim().to_owned();
        let ln = count_cps_chars(&left);
        let rn = count_cps_chars(&right);
        let short = ln.min(rn);
        let long = ln.max(rn);
        if ln < min_side || rn < min_side || long == 0 {
            continue;
        }
        if (short as f64) / (long as f64) < min_ratio {
            continue;
        }
        if ends_dangling(&left) {
            continue;
        }
        if starts_dangling(&right) && !ends_clause_punct(&left) {
            continue;
        }
        // Weak-ending penalty: a Blocking-level ending is eliminated outright, because such a seam would be rejected by lint as soon as it is created. An Advisory-level ending is demoted by one tier, so the cut point moves later at the same width.
        let tier = match ends_weak_tail(&left) {
            Some((SeamLintKind::Blocking, _)) => continue,
            Some((SeamLintKind::Advisory, _)) => tier + 1,
            None => tier,
        };
        let overflow = hard.map_or(0, |h| ln.saturating_sub(h) + rn.saturating_sub(h));
        let imbalance = ln.abs_diff(rn);
        let split = PreferredTargetSplit {
            left,
            right,
            cut_offset: offset,
            left_chars: ln,
            right_chars: rn,
            reason,
        };
        let ranked = (split, tier, overflow, imbalance);
        let better = match &best {
            None => true,
            Some((_, bt, bo, bi)) => {
                tier < *bt
                    || (tier == *bt && overflow < *bo)
                    || (tier == *bt && overflow == *bo && imbalance < *bi)
                    || (tier == *bt
                        && overflow == *bo
                        && imbalance == *bi
                        && ranked.0.cut_offset < best.as_ref().unwrap().0.cut_offset)
            }
        };
        if better {
            best = Some(ranked);
        }
    }
    best.map(|(split, _, _, _)| split)
}

/// Latin zero-LLM pre-split: the piece is not over fit, is over aim, has a balanced target seam, a source semantic seam, and at least 1 s on each side. Returns the two pieces `(text, from_word, to_word)`. Returns `None` if the conditions are not met.
pub fn latin_semantic_presplit(
    translation: &str,
    words: &[&Word],
    lang: &str,
    params: &TransParams,
) -> Option<Vec<(String, usize, usize)>> {
    if is_cjk_lang(lang) || words.len() < 2 {
        return None;
    }
    if crate::split::exceeds_one_line_fit(translation, lang, params.fit) {
        return None;
    }
    let split = preferred_target_split(translation, lang, params.soft, Some(params.hard))?;
    let mut source_seams = Vec::new();
    for (index, word) in words.iter().enumerate() {
        if index + 1 >= words.len() {
            break;
        }
        if sentence_end(&word.text) || ends_semantic_seam_punct(&word.text) {
            source_seams.push(index);
        }
    }
    if source_seams.is_empty() {
        return None;
    }
    let start = words[0].t0;
    let end = words[words.len() - 1].t1;
    let span = (end - start).max(0.01);
    let target_total = (split.left_chars + split.right_chars).max(1);
    let target_fraction = split.left_chars as f64 / target_total as f64;
    let mut ranked: Vec<(usize, f64)> = source_seams
        .into_iter()
        .map(|seam| {
            let fraction = (words[seam].t1 - start) / span;
            (seam, (fraction - target_fraction).abs())
        })
        .collect();
    ranked.sort_by(|a, b| {
        a.1.partial_cmp(&b.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.0.cmp(&b.0))
    });
    let &(seam, divergence) = ranked.first()?;
    if divergence > SNAP_RATIO_DIVERGENCE {
        return None;
    }
    let left_duration = words[seam].t1 - start;
    let right_duration = end - words[seam + 1].t0;
    if left_duration + 1e-9 < MIN_CUE_DISPLAY_SEC || right_duration + 1e-9 < MIN_CUE_DISPLAY_SEC {
        return None;
    }
    Some(vec![
        (split.left, 0, seam),
        (split.right, seam + 1, words.len() - 1),
    ])
}

/// An entry in the over-fit and seam-preview list (consumed by `ccut check` and the align list).
#[derive(Debug, Clone, PartialEq)]
pub struct AlignListEntry {
    pub key: String,
    pub fit_chars: usize,
    pub over_hard: bool,
    pub over_fit: bool,
    pub seam_left: Option<String>,
    pub seam_right: Option<String>,
    pub seam_reason: Option<String>,
}

/// Scans translated sentences and lists over-fit and over-hard pieces, with optional preferred seams.
pub fn align_list_entries(
    translations: &[(String, String)],
    lang: &str,
    params: &TransParams,
) -> Vec<AlignListEntry> {
    let mut out = Vec::new();
    for (key, text) in translations {
        let fit_chars = piece_display_units(text, lang);
        let over_hard = fit_chars > params.hard;
        let over_fit = over_hard || crate::split::exceeds_one_line_fit(text, lang, params.fit);
        if !over_fit {
            continue;
        }
        let seam = preferred_target_split(text, lang, params.soft, Some(params.hard));
        out.push(AlignListEntry {
            key: key.clone(),
            fit_chars,
            over_hard,
            over_fit,
            seam_left: seam.as_ref().map(|s| s.left.clone()),
            seam_right: seam.as_ref().map(|s| s.right.clone()),
            seam_reason: seam.map(|s| s.reason),
        });
    }
    out
}

/// Seam strength at a source word boundary. `boundary` is the index of the first word of the right piece (1..words.len()). 0 means not a seam. 3 = the left word carries a clause or sentence-final punctuation. 2 = the right word is a conjunction or relative word. 1 = the right word is a preposition or the infinitive marker `to`.
pub(crate) fn source_boundary_strength(words: &[&str], boundary: usize) -> u8 {
    if boundary == 0 || boundary >= words.len() {
        return 0;
    }
    let left = words[boundary - 1].trim();
    if ends_clause_punct(left) || sentence_end(left) {
        return 3;
    }
    let right = words[boundary].trim();
    let right_tok: String = right
        .to_ascii_lowercase()
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_owned();
    if CUT_BEFORE_LATIN.contains(&right_tok.as_str())
        || CUT_BEFORE_CJK.iter().any(|w| right.starts_with(w))
    {
        return 2;
    }
    if CUT_BEFORE_LATIN_WEAK.contains(&right_tok.as_str()) {
        return 1;
    }
    0
}

/// Re-anchors repaired text pieces to source word spans. First the pieces are split by character proportion. Then each internal boundary is snapped to the nearest source semantic seam within a window of ±ANCHOR_SNAP_WINDOW words (nearest first; at equal distance, the one with higher strength wins). A naive proportional cut would land inside phrases such as `make|changes`. The proportional position is kept only when no seam can be snapped to.
pub fn reanchor_texts(texts: Vec<String>, source_words: &[&str], lang: &str) -> Vec<TransPiece> {
    use crate::split::anchor_pieces_to_words;
    let word_count = source_words.len();
    let piece_cps: Vec<usize> = texts
        .iter()
        .map(|text| target_cps_chars(text, lang))
        .collect();
    let ranges = if texts.len() <= word_count && !texts.is_empty() {
        anchor_pieces_to_words(&piece_cps, word_count)
    } else {
        vec![(0, word_count.saturating_sub(1))]
    };
    if texts.len() == 1 || ranges.len() != texts.len() {
        return vec![TransPiece {
            from: Some(0),
            to: Some(word_count.saturating_sub(1)),
            text: texts.into_iter().next().unwrap_or_default(),
        }];
    }
    let k = texts.len();
    // Internal boundary = the starting word index of each piece's right neighbor. Snap them one by one from left to right, keeping them strictly increasing and leaving at least 1 word for the later pieces.
    let mut bounds: Vec<usize> = ranges.iter().take(k - 1).map(|&(_, to)| to + 1).collect();
    let mut prev = 0usize;
    for i in 0..bounds.len() {
        let ideal = bounds[i];
        let hi_cap = word_count - (k - 1 - i);
        let lo = (prev + 1).max(ideal.saturating_sub(ANCHOR_SNAP_WINDOW));
        let hi = hi_cap.min(ideal + ANCHOR_SNAP_WINDOW);
        let mut best: Option<(usize, u8, usize)> = None; // (distance, strength, pos)
        for pos in lo..=hi {
            let strength = source_boundary_strength(source_words, pos);
            if strength == 0 {
                continue;
            }
            let distance = pos.abs_diff(ideal);
            let better = match best {
                None => true,
                Some((bd, bs, bp)) => {
                    distance < bd
                        || (distance == bd && strength > bs)
                        || (distance == bd && strength == bs && pos < bp)
                }
            };
            if better {
                best = Some((distance, strength, pos));
            }
        }
        bounds[i] = best.map_or(ideal.clamp(prev + 1, hi_cap), |(_, _, pos)| pos);
        prev = bounds[i];
    }
    let mut out = Vec::with_capacity(k);
    let mut start = 0usize;
    for (index, text) in texts.into_iter().enumerate() {
        let end = if index + 1 < k {
            bounds[index] - 1
        } else {
            word_count - 1
        };
        out.push(TransPiece {
            from: Some(start),
            to: Some(end),
            text,
        });
        start = end + 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A seam between two Hangul syllables is a word boundary between eojeol, not a cut inside a word. Seams between Han and kana, and between Hangul and Han, still count as before.
    #[test]
    fn a_seam_between_two_hangul_units_is_a_word_boundary() {
        assert!(cjk_midword_boundary("简", "化"));
        assert!(cjk_midword_boundary("いい天", "気"));
        assert!(!cjk_midword_boundary("저는 내일", "아이폰을 샀다"));
        assert!(cjk_midword_boundary("한", "字"));
        assert!(cjk_midword_boundary("字", "한"));
        assert!(!cjk_midword_boundary("저는", "iPhone"));
        assert!(!cjk_midword_boundary("", "한"));
    }

    #[test]
    fn dangling_and_particle_detection() {
        assert!(ends_dangling("工具和"));
        assert!(!ends_dangling("工具和。"));
        assert!(ends_dangling("alpha and"));
        assert!(!ends_dangling("alpha and."));
        assert!(ends_dangling("matters—the"));
        assert!(starts_dangling("了吗"));
        assert!(starts_dangling("的时候"));
        // “indeed” superficially starts with “的”. Whether it is a violation also depends on whether the preceding piece ends with punctuation. The single-side function still returns true.
        assert!(starts_dangling("的确"));
        assert!(ends_clause_punct("开心。"));
        assert!(ends_sentence_final("完成。"));
        assert!(ends_sentence_final("Done.\""));
        assert!(!ends_sentence_final("完成，"));
    }

    /// Real sample from p1215: ASR-native false sentence ends remain after polish.
    #[test]
    fn dangling_sentence_end_flags_false_periods() {
        assert!(dangling_sentence_end(
            "I don't normally sound like this, but."
        ));
        assert!(dangling_sentence_end("It's a good example of."));
        assert!(dangling_sentence_end("And."));
        assert!(dangling_sentence_end("我们把它拆成两块，然后把结果和。"));
        // A normal sentence end is not reported.
        assert!(!dangling_sentence_end("We are done now."));
        assert!(!dangling_sentence_end("这就是我们的目的。"));
        assert!(!dangling_sentence_end("a."));
        // A sentence that does not end with sentence-final punctuation (cut by gap or word count) is outside this criterion.
        assert!(!dangling_sentence_end("alpha and"));
        assert!(!dangling_sentence_end("alpha and,"));
        // Still detected after the quotes are stripped.
        assert!(dangling_sentence_end("he called it the.\""));
        // A legitimate stranded preposition after a fronted wh-object must not be a false positive. When only a wh-word appears far away and there is no clause subject, it is still an incomplete ending.
        assert!(!dangling_sentence_end("This is what it connects to."));
        assert!(!dangling_sentence_end(
            "Which means we check what it reaches out to."
        ));
        assert!(!dangling_sentence_end(
            "This is what it's a good example of."
        ));
        assert!(dangling_sentence_end(
            "We need to decide what to do because of."
        ));
        // Infinitive ellipsis: `to` marks an elided verb phrase, and the sentence is complete. (In a skill trial, `want to.` was rejected by polish acceptance.)
        assert!(!dangling_sentence_end(
            "They can slow down any time they want to."
        ));
        assert!(!dangling_sentence_end("You don't have to."));
        assert!(!dangling_sentence_end("I was going to!"));
        assert!(!dangling_sentence_end("We're supposed to."));
        // A `to` that does not follow a permitted verb is still a false sentence end.
        assert!(dangling_sentence_end("Then we went to."));
        assert!(dangling_sentence_end("To."));
        assert!(!dangling_sentence_end("是的。"));
        assert!(!dangling_sentence_end("这件事情是很重要的。"));
        assert!(dangling_sentence_end("的。"));
        assert!(!dangling_sentence_end("这是一个完全不同的方向。"));
        assert!(!dangling_sentence_end("最后需要做一个对比。"));
        assert!(!dangling_sentence_end("它是一系列问题的总和。"));
        assert!(!dangling_sentence_end("这条路你跟不跟？"));
        assert!(contains_dangling_sentence_end(
            "上一句完整。就是说当。你的 group 越多，效果越明显。"
        ));
        assert!(contains_dangling_sentence_end(
            "对。所以我们在 IMAGE 上看到了 SKILLING BEHAVIOR. 就是说当。 ，你的 GROUP 的数目越多。"
        ));
        assert!(!contains_dangling_sentence_end(
            "上一句完整。就是说当你的 group 越多，效果越明显。"
        ));
    }

    /// Measured in p-fb353b44: a dangling sentence end closed by an ASCII ellipsis was a blind spot for the whole chain.
    ///
    /// The `2.14` / `a.com` guard of `atomize::sentence_end` rejects `but...` as a sentence end, because the stem still contains `.`. The whole tail after the last sentence-end atom is then silently discarded, and the scan always returns false, while [`dangling_sentence_end`], which `ccut check` calls directly, still warns. The two paths must give the same answer. Otherwise `polish-retry` could get past acceptance just by changing a sentence-final `.` into `...`.
    #[test]
    fn trailing_residue_after_the_last_sentence_end_is_still_scanned() {
        // Fed alone to the whole-sentence criterion it is true, and the full-text scan must also be true.
        assert!(dangling_sentence_end(
            "I don't normally sound like this, but..."
        ));
        assert!(contains_dangling_sentence_end(
            "I don't normally sound like this, but..."
        ));
        assert!(contains_dangling_sentence_end("上一句完整。就是说当..."));
        // The Unicode ellipsis was never in the blind spot. Regression guard.
        assert!(contains_dangling_sentence_end("上一句完整。就是说当…"));
        // A remainder that does not end with sentence-final punctuation (an unfinished tail) is not a dangling sentence end.
        assert!(!contains_dangling_sentence_end("上一句完整。就是说当"));
        assert!(!contains_dangling_sentence_end("alpha and"));
        // Normally terminated whole text is unaffected.
        assert!(!contains_dangling_sentence_end(
            "We are done now. It works..."
        ));
        assert!(!contains_dangling_sentence_end("版本是 2.14"));
        assert!(!contains_dangling_sentence_end("他们搬去了 the U.S."));
    }

    #[test]
    fn conflicting_punctuation_and_collapsed_latin_atoms_are_detected() {
        assert!(contains_conflicting_punctuation("事情。，然后继续。"));
        assert!(contains_conflicting_punctuation("事情，。然后继续。"));
        assert!(contains_conflicting_punctuation("讲完了，，大家面面相觑。"));
        assert!(contains_conflicting_punctuation("somewhere,; then"));
        assert!(contains_conflicting_punctuation("done., then"));
        assert!(!contains_conflicting_punctuation("真的吗？！当然！"));
        assert!(!contains_conflicting_punctuation("版本 1.0，继续。"));

        assert!(contains_likely_collapsed_latin_atom(
            "反 purereinforcementlearning，至少",
            20
        ));
        assert!(!contains_likely_collapsed_latin_atom(
            "pure reinforcement learning",
            20
        ));
        assert!(!contains_likely_collapsed_latin_atom(
            "state-of-the-art model-v2",
            20
        ));
    }

    /// R2 code-first fix: conflicting adjacent punctuation is normalized by code and is no longer fed back to the model to re-roll the whole page.
    /// The normalization must be strictly complementary to the detection criterion: the output never triggers detection again.
    #[test]
    fn conflicting_punctuation_is_normalized_deterministically() {
        // The sentence-final mark wins: drop the adjacent weak punctuation, whichever side it is on.
        assert_eq!(
            normalize_conflicting_punctuation("事情。，然后继续。"),
            "事情。然后继续。"
        );
        assert_eq!(
            normalize_conflicting_punctuation("事情，。然后继续。"),
            "事情。然后继续。"
        );
        // Of two clause punctuation marks, keep the earlier one. Even after resolution, no new conflicting pair is left behind.
        assert_eq!(
            normalize_conflicting_punctuation("讲完了，，大家"),
            "讲完了，大家"
        );
        assert_eq!(
            normalize_conflicting_punctuation("讲完了，，。大家"),
            "讲完了。大家"
        );
        assert_eq!(
            normalize_conflicting_punctuation("somewhere,; then"),
            "somewhere, then"
        );
        assert_eq!(
            normalize_conflicting_punctuation("done., then"),
            "done. then"
        );
        // `..` → `.`. `...` is an ellipsis and is kept as it is.
        assert_eq!(
            normalize_conflicting_punctuation("done.. next"),
            "done. next"
        );
        assert_eq!(
            normalize_conflicting_punctuation("wait... ok"),
            "wait... ok"
        );
        // Legitimate combined tone marks and decimal points are unaffected.
        assert_eq!(
            normalize_conflicting_punctuation("真的吗？！当然！"),
            "真的吗？！当然！"
        );
        assert_eq!(
            normalize_conflicting_punctuation("版本 1.0，继续。"),
            "版本 1.0，继续。"
        );
        // Complementarity: after normalization, detection never fires again.
        for sample in [
            "事情。，然后。",
            "事情，。然后。",
            "讲完了，，，大家。",
            "a,;.b",
            "done., then",
        ] {
            let normalized = normalize_conflicting_punctuation(sample);
            assert!(
                !contains_conflicting_punctuation(&normalized),
                "{sample:?} → {normalized:?}"
            );
        }
    }

    #[test]
    fn de_tail_is_dangling_except_complete_nouns() {
        // A dangling attributive 「的」 (p850 benchmark draft: two cases of “…of | noun” were committed).
        assert!(ends_dangling("这是我们生成的"));
        assert!(!ends_dangling("这是我们生成的。"));
        // A complete word ending in 「的」 is not dangling.
        assert!(!ends_dangling("这就是我们的目的"));
        assert!(!ends_dangling("有的"));
        assert!(!ends_dangling("像做梦似的"));
    }

    #[test]
    fn lint_blocks_number_unit_split() {
        let params = TransParams::for_lang("zh");
        let pieces = ["他们每月要花 1000", "美元购买这些服务。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues.iter().any(|i| i.piece_index == 1
                && i.kind == SeamLintKind::Blocking
                && i.class == SeamLintClass::BoundHead
                && i.message.contains("unit")),
            "{issues:?}"
        );
        // A start that is not a unit does not trigger a false positive.
        let ok = ["团队规模到了 2023", "情况才有了改变。"];
        assert!(
            lint_pieces(&ok, "zh", &params)
                .iter()
                .all(|i| !i.message.contains("unit")),
        );
    }

    #[test]
    fn lint_blocks_incomplete_chinese_nominal_split() {
        let params = TransParams::for_lang("zh");
        let broken = [
            "控制循环适用于我们有一个",
            "想改变的系统、一个可测量的问题。",
        ];
        let issues = lint_pieces(&broken, "zh", &params);
        assert!(
            issues.iter().any(|issue| {
                issue.kind == SeamLintKind::Blocking
                    && issue.class == SeamLintClass::IncompleteNominal
                    && issue.message.contains("incomplete Chinese nominal")
            }),
            "{issues:?}"
        );

        let complete = ["我们只有一个。", "接下来讨论另一个方案。"];
        assert!(
            lint_pieces(&complete, "zh", &params)
                .iter()
                .all(|issue| issue.class != SeamLintClass::IncompleteNominal)
        );
    }

    /// Two hard-dangling fixed points from the R2 benchmark that survived two rounds of repair: `s-g41.0#0` (the particle 「得」) and `s-g89.0#0` (“in mathematics” cut in half).
    #[test]
    fn lint_blocks_weak_tail_regressions_from_run2() {
        let params = TransParams::for_lang("zh");
        for pieces in [
            ["现在，剩余的 35% 得", "支撑每个活跃请求的 KV 缓存，"],
            ["这里的输出质量在数学上", "与单独运行大模型完全相同。"],
            ["KV 缓存只是", "把之前步骤里的那些键和值矩阵存起来，"],
            [
                "你还可以同时",
                "将 max_num_batched_tokens 设置为大于 2048。",
            ],
            ["一个小型草稿模型提出一系列", "输出 token，"],
            ["——具体来说，是模型如何", "逐 token 存储和检索它"],
            ["另外你还可以", "用投机解码进一步提速。"],
            ["它在最新版本里已经内置了", "分页注意力的实现。"],
            ["光是权重就要占用一块", "连续的显存区域。"],
        ] {
            let issues = lint_pieces(&pieces, "zh", &params);
            assert!(
                issues.iter().any(|issue| {
                    issue.piece_index == 0
                        && issue.class == SeamLintClass::WeakTail
                        && is_objective_blocking(issue)
                }),
                "{pieces:?} -> {issues:?}"
            );
        }
    }

    /// Wide pieces already judged good in R2, and common complete endings, must not be rejected by the new rules.
    #[test]
    fn weak_tail_spares_complete_tails() {
        let params = TransParams::for_lang("zh");
        for pieces in [
            [
                "把之前步骤里的那些键和值矩阵存起来，",
                "这样系统就不用重新计算已经知道的内容了。",
            ],
            [
                "就像为单个客人预留了一整层酒店楼层。",
                "而其他客人只能在门外排队。",
            ],
            [
                "所以，如果你的最大上下文是 2048 个 token，",
                "系统就会按这个上限预留显存。",
            ],
            [
                "但却没有一块足够大的连续区域来处理它。",
                "于是请求只能继续排队。",
            ],
            ["这份材料我很有心得", "所以先讲这一段。"],
            ["这个数字在 80% 以上", "属于完全可以接受的区间。"],
            ["我们在网上找到了它", "并做了完整复现。"],
        ] {
            let issues = lint_pieces(&pieces, "zh", &params);
            assert!(
                issues
                    .iter()
                    .all(|issue| issue.class != SeamLintClass::WeakTail),
                "{pieces:?} -> {issues:?}"
            );
        }
    }

    /// A coordinated structure must not be cut before `和`/`及`/`与` (`s-wmsk9mmhy-8#2`, `s-g20.19#3`).
    #[test]
    fn lint_blocks_cut_before_chinese_coordinator() {
        let params = TransParams::for_lang("zh");
        for pieces in [
            ["它们是 KV 缓存", "和 PagedAttention。"],
            ["那我们就来聊聊 KV 缓存", "与 PagedAttention。"],
            ["这里要装的是显卡", "及其配套的散热模块。"],
        ] {
            let issues: Vec<_> = lint_pieces(&pieces, "zh", &params);
            let blocked = issues.iter().any(|issue| {
                issue.piece_index == 1
                    && issue.class == SeamLintClass::BoundHead
                    && issue.message.contains("coordinator")
                    && is_objective_blocking(issue)
            });
            // “and its” is a piece start that forms a word, so it must not be blocked.
            let expected = !pieces[1].starts_with("及其");
            assert_eq!(blocked, expected, "{pieces:?} -> {issues:?}");
        }
        // When the preceding piece ends with punctuation, a coordinating conjunction at the start is a legal piece start.
        let ok = ["它们是 KV 缓存，", "和 PagedAttention 一起工作。"];
        assert!(
            lint_pieces(&ok, "zh", &params)
                .iter()
                .all(|issue| !issue.message.contains("coordinator"))
        );
    }

    /// R3 audit §2: once a closed word list is hit, the defect only **shifts** to adjacent forms that are not listed. Here the positive examples of each of the five morphology classes are locked in (all taken from the 10 hard dangling cases of R3).
    #[test]
    fn weak_tail_blocks_open_class_morphology() {
        for (text, form) in [
            // 1 · Disposal construction: 把/将 + NP with no predicate after it
            ("而块表会把逻辑页地址", "处置式缺谓语"),
            ("同时你还可以将 max_num_batched_tokens", "处置式缺谓语"),
            // 4 · Pivotal construction: 让/使/叫 + NP with no predicate after it
            ("模型必须让你的输入", "兼语式缺谓语"),
            // 2 · Transitive verb + directional or resultative complement, with the object missing
            ("这些传统系统会浪费掉", "动补缺宾"),
            ("生产环境的部署已经观察到", "动补缺宾"),
            // 3 · Locative frame (the existing rules cover only 「上」)
            ("也就是这 35% 里", "方位框架"),
            ("在这种情况下", "方位框架"),
            ("在一个完整的推理周期内", "方位框架"),
            ("你在生产环境的 AI 开发中", "方位框架"),
            // 5 · Light verb: 来/去 + monosyllabic reduplicated verb, with the object missing
            ("那我们就来聊聊", "光动词重叠"),
        ] {
            assert_eq!(
                ends_weak_tail(text),
                Some((SeamLintKind::Blocking, form)),
                "{text}"
            );
        }
    }

    /// The morphology-class checks must keep the "word trap" whitelist exemptions. Otherwise they would turn a dangling ending into an over-line piece.
    #[test]
    fn weak_tail_morphology_keeps_word_trap_exemptions() {
        for text in [
            // Existing exemptions
            "刚才提到的以上",
            "这是我的一点心得",
            // Frame character not used as a frame word
            "这项能力在不久的将来",
            "整个流程即将",
            "假使",
            // Complement character forms a word
            "把结果写到文件并输出",
            "第一阶段已经完成",
            "这项工作我们迟到",
            // Locative character forms a word
            "答案就在其中",
            "请看下面的说明如下",
            "两次请求之间",
            "这台机器有八张卡在手里",
            // The disposal construction already has a predicate or complement after it
            "块表会把逻辑页地址映射过来",
            "我们把这些页面整理好",
            // Reduplicated verb, but no light-verb frame
            "情况正在渐渐",
        ] {
            assert!(
                ends_weak_tail(text).is_none_or(|(kind, _)| kind != SeamLintKind::Blocking),
                "{text} -> {:?}",
                ends_weak_tail(text)
            );
        }
    }

    /// New defect found in R3: the existing rule only forbids cutting **before** 和, but cutting **after** the second coordinated item equally splits the coordinated noun phrase from its head.
    #[test]
    fn lint_blocks_cut_after_second_coordinated_item() {
        let params = TransParams::for_lang("zh");
        for pieces in [
            ["它就存了那些 Key 和 Value", "矩阵，供后续复用。"],
            ["我们同时讨论缓存和调度", "问题的边界。"],
        ] {
            let issues = lint_pieces(&pieces, "zh", &params);
            assert!(
                issues.iter().any(|issue| issue.piece_index == 0
                    && issue.class == SeamLintClass::IncompleteNominal
                    && is_objective_blocking(issue)),
                "{pieces:?} -> {issues:?}"
            );
        }
        // The preposition 和 (followed by NP + predicate) and a new clause start are both legal seams and must not be blocked.
        for pieces in [
            ["今天很高兴和大家聊聊", "如何不再时刻盯着你的智能体。"],
            ["他喜欢音乐和电影", "然后就去休息了。"],
            ["它们是 KV 缓存和 PagedAttention，", "两者配合工作。"],
        ] {
            let issues = lint_pieces(&pieces, "zh", &params);
            assert!(
                !issues
                    .iter()
                    .any(|issue| issue.message.contains("second coordinated item")),
                "{pieces:?} -> {issues:?}"
            );
        }
    }

    /// The weak-ending penalty must not produce a pre-split seam that gets rejected by lint immediately after it is cut.
    #[test]
    fn preferred_split_rejects_weak_tail_left_side() {
        let params = TransParams::for_lang("zh");
        let text = "现在剩余的百分之三十五得支撑每个活跃请求的键值缓存空间";
        if let Some(split) = preferred_target_split(text, "zh", params.soft, Some(params.hard)) {
            assert!(
                ends_weak_tail(&split.left).is_none_or(|(kind, _)| kind != SeamLintKind::Blocking),
                "{split:?}"
            );
        }
    }

    #[test]
    fn lint_blocks_cut_inside_paired_delimiter() {
        let params = TransParams::for_lang("zh");
        // s-g4.16: the seam falls inside “…”.
        let pieces = ["一个根目录下包含名为“", "PluginDataJSON”的清单。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues.iter().any(|i| i.piece_index == 0
                && i.kind == SeamLintKind::Blocking
                && i.class == SeamLintClass::UnpairedDelimiter),
            "{issues:?}"
        );
        assert!(issues.iter().filter(|i| is_objective_blocking(i)).count() >= 1);
        // If the delimiter pair falls entirely within the same piece, there is no problem.
        let clean = ["一个根目录下包含", "名为“PluginDataJSON”的清单。"];
        assert!(
            !lint_pieces(&clean, "zh", &params)
                .iter()
                .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
        );
        // Brackets work the same way, and can be merged away by repair.
        let paren = ["我们用代理插件（", "Agent Plugin）来做这件事。"];
        assert!(lint_pieces(&paren, "zh", &params).iter().any(|i| i.class
            == SeamLintClass::UnpairedDelimiter
            && i.kind == SeamLintKind::Blocking),);
        let repaired = repair_lint_pieces(
            ["他说（", "好的）", "然后就走了。"]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            "zh",
            &params,
        );
        assert_eq!(repaired.concat(), "他说（好的）然后就走了。");
        assert!(
            !lint_pieces(
                &repaired.iter().map(String::as_str).collect::<Vec<_>>(),
                "zh",
                &params
            )
            .iter()
            .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
            "{repaired:?}"
        );
    }

    #[test]
    fn lint_ignores_unclosed_and_oversized_delimiter_spans() {
        let params = TransParams::for_lang("zh");
        // A whole sentence with only half a quote: any split is unavoidable, so it must not be sent back to the worker again and again.
        let unclosed = ["他当时就说“我们", "明天再来讨论这件事。"];
        assert!(
            !lint_pieces(&unclosed, "zh", &params)
                .iter()
                .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
        );
        // If the quote span itself exceeds hard, the split is unavoidable, so it is downgraded to Advisory.
        let oversized = [
            "他说“这是一段很长的引文内容",
            "长到根本不可能塞进单独一片里”。",
        ];
        let issues = lint_pieces(&oversized, "zh", &params);
        assert!(
            issues
                .iter()
                .filter(|i| i.class == SeamLintClass::UnpairedDelimiter)
                .all(|i| i.kind == SeamLintKind::Advisory),
            "{issues:?}"
        );
        assert!(
            issues
                .iter()
                .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
            "{issues:?}"
        );
        // An English apostrophe is not a closing delimiter, so it must not create a span out of nothing.
        let latin = TransParams::for_lang("en");
        assert!(
            !lint_pieces(&["the students’ books", "were left behind"], "en", &latin)
                .iter()
                .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
        );
    }

    /// A whole quoted piece with span == hard is legal, but it has no room left for any text outside the quotes. A split inside the quotes is then unavoidable, so it must be downgraded to Advisory. The s-g25.25 benchmark measured that a `span <= hard` boundary let the cut recommended by the aim-band advisory get rejected by the submit lint as Blocking, forming an unsatisfiable loop.
    #[test]
    fn lint_delimiter_span_at_hard_is_advisory() {
        let params = TransParams::for_lang("zh");
        // Quote span = “ + 18 full-width characters + ” = 20 units, exactly equal to hard.
        let pieces = ["他说“字字字字字字字字字", "字字字字字字字字字”。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues
                .iter()
                .any(|i| i.class == SeamLintClass::UnpairedDelimiter),
            "{issues:?}"
        );
        assert!(
            issues
                .iter()
                .filter(|i| i.class == SeamLintClass::UnpairedDelimiter)
                .all(|i| i.kind == SeamLintKind::Advisory),
            "{issues:?}"
        );
        // span == hard − 1: after merging, it can still hold text outside the quotes, so it stays Blocking.
        let below = ["他说“字字字字字字字字字", "字字字字字字字字”。"];
        assert!(lint_pieces(&below, "zh", &params).iter().any(|i| i.class
            == SeamLintClass::UnpairedDelimiter
            && i.kind == SeamLintKind::Blocking),);
    }

    /// “or” is a coordinating conjunction like 和/及/与. A bare cut before it breaks the coordinated structure. When the preceding piece ends with punctuation, it is a legal clause start. “perhaps” as a word is exempt.
    #[test]
    fn lint_blocks_bare_cut_before_huo_coordinator() {
        let params = TransParams::for_lang("zh");
        let bare = ["你可以选苹果", "或者选香蕉带走。"];
        let issues = lint_pieces(&bare, "zh", &params);
        assert!(
            issues.iter().any(|i| i.piece_index == 1
                && i.kind == SeamLintKind::Blocking
                && i.class == SeamLintClass::BoundHead
                && i.message.contains("和/及/与/或")),
            "{issues:?}"
        );
        // If the preceding piece ends with punctuation, it is legal.
        let punct = ["你可以选苹果，", "或者选香蕉带走。"];
        assert!(
            !lint_pieces(&punct, "zh", &params)
                .iter()
                .any(|i| i.class == SeamLintClass::BoundHead),
        );
        // 「或许」 is a complete adverb, not a coordinating-conjunction start.
        let adverb = ["他今天没有过来", "或许明天才会来。"];
        assert!(
            !lint_pieces(&adverb, "zh", &params)
                .iter()
                .any(|i| i.class == SeamLintClass::BoundHead),
        );
    }

    /// Pre-split suggestions follow the same criterion as the lint: they must not recommend a bare cut before “or”. Previously CUT_BEFORE candidates were not gated by coordination, so the advisory recommended exactly the cut that the lint rejects.
    #[test]
    fn preferred_split_never_bare_cuts_before_huo() {
        let params = TransParams::for_lang("zh");
        let bare = "我们可以直接采用现有的方案或者重新设计一套完全不同的架构";
        if let Some(split) = preferred_target_split(bare, "zh", params.soft, Some(params.hard)) {
            assert!(
                !split.right.trim_start().starts_with('或'),
                "advisory 推荐了 lint 会拒绝的裸切: {split:?}"
            );
        }
        // When punctuation comes before it, a cut after the punctuation with the right piece starting with 「或者」 is legal.
        let punct = "我们可以直接采用现有的方案，或者重新设计一套完全不同的架构";
        let split = preferred_target_split(punct, "zh", params.soft, Some(params.hard))
            .expect("句读缝应给出建议");
        assert!(split.right.starts_with("或者"), "{split:?}");
    }

    /// The flash-frame threshold is measured on the per-piece display basis, where end punctuation is free. “he said:” displays as 3 units. It was previously counted as 4 and missed.
    #[test]
    fn flash_threshold_uses_display_units() {
        let params = TransParams::for_lang("zh");
        let pieces = ["他说了:", "我们明天一早就出发去北京。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues.iter().any(|i| i.piece_index == 0
                && i.kind == SeamLintKind::Blocking
                && i.class == SeamLintClass::FlashFragment),
            "{issues:?}"
        );
    }

    #[test]
    fn lint_blocks_list_separator_cut_when_mergeable() {
        let params = TransParams::for_lang("zh");
        let pieces = ["这些想法复杂、", "有趣而深刻。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues.iter().any(|i| i.piece_index == 0
                && i.kind == SeamLintKind::Blocking
                && i.message.contains("、")),
            "{issues:?}"
        );
        let repaired = repair_lint_pieces(
            pieces.into_iter().map(str::to_owned).collect(),
            "zh",
            &params,
        );
        assert_eq!(repaired, vec!["这些想法复杂、有趣而深刻。".to_owned()]);
        // A long enumeration that would exceed hard on merge only gets a hint, not a block.
        let long = [
            "第一项内容、第二项内容、第三项内容、",
            "第四项内容、第五项内容与第六项内容。",
        ];
        assert!(
            lint_pieces(&long, "zh", &params)
                .iter()
                .filter(|i| i.message.contains("、"))
                .all(|i| i.kind == SeamLintKind::Advisory),
        );
    }

    #[test]
    fn lint_blocks_dangling_middle_piece() {
        let params = TransParams::for_lang("zh");
        let pieces = ["前半工具和", "后半内容。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues
                .iter()
                .any(|i| i.kind == SeamLintKind::Blocking && i.message.contains("dangling")),
            "{issues:?}"
        );
    }

    #[test]
    fn lint_blocks_flash_when_mergeable() {
        let params = TransParams::for_lang("zh");
        // A “tail piece” is not a complete short sentence, and it can be merged into a neighbor.
        let pieces = ["前面很长的一片字幕内容", "尾片", "再接一段够长的内容文字"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues
                .iter()
                .any(|i| i.piece_index == 1 && i.kind == SeamLintKind::Blocking),
            "{issues:?}"
        );
    }

    #[test]
    fn lint_blocks_complete_short_tag_when_mergeable() {
        let params = TransParams::for_lang("zh");
        let pieces = ["这些函数可以做各种事情，", "对吧？", "但通常还会继续说明。"];
        let issues = lint_pieces(&pieces, "zh", &params);
        assert!(
            issues
                .iter()
                .any(|i| i.piece_index == 1 && i.kind == SeamLintKind::Blocking),
            "{issues:?}"
        );
        let repaired = repair_lint_pieces(
            pieces.into_iter().map(str::to_owned).collect(),
            "zh",
            &params,
        );
        assert_eq!(repaired[0], "这些函数可以做各种事情，对吧？");
    }

    #[test]
    fn repair_merges_flash_fragment() {
        let params = TransParams::for_lang("zh");
        let repaired = repair_lint_pieces(
            vec![
                "前面很长的一片字幕内容".into(),
                "尾片".into(),
                "再接一段够长的内容文字".into(),
            ],
            "zh",
            &params,
        );
        assert!(repaired.len() < 3, "{repaired:?}");
        let refs: Vec<&str> = repaired.iter().map(String::as_str).collect();
        assert!(
            lint_pieces(&refs, "zh", &params)
                .iter()
                .all(|i| i.kind != SeamLintKind::Blocking),
            "{repaired:?}"
        );
    }

    #[test]
    fn repair_never_merges_past_hard_ceiling() {
        let params = TransParams::for_lang("zh");
        let pieces = vec!["长".repeat(params.hard), "和".into()];
        assert!(
            target_cps_chars(&pieces[0], "zh") + target_cps_chars(&pieces[1], "zh") > params.hard
        );
        let repaired = repair_lint_pieces(pieces.clone(), "zh", &params);
        assert_eq!(repaired, pieces);
        assert!(
            repaired
                .iter()
                .all(|piece| target_cps_chars(piece, "zh") <= params.hard)
        );
    }

    #[test]
    fn preferred_split_finds_comma_seam() {
        let text =
            "You have to sweat the tokens carefully, and you also sweat the pixels every day.";
        let params = TransParams::for_lang("en");
        let split = preferred_target_split(text, "en", params.soft, Some(params.hard));
        assert!(split.is_some(), "expected balanced seam");
        let split = split.unwrap();
        assert!(split.left_chars >= 10 && split.right_chars >= 10);
        assert!(!ends_dangling(&split.left));
    }

    #[test]
    fn latin_presplit_requires_source_semantic_seam_and_duration() {
        // The source seam falls after the first word, and its duration proportion is close to the target comma seam (about 55%).
        let left = Word {
            id: "a".into(),
            t0: 0.0,
            t1: 2.0,
            text: "Hello;".into(),
            sp: "s1".into(),
            glue: false,
        };
        let mid = Word {
            id: "b".into(),
            t0: 2.0,
            t1: 2.6,
            text: "world".into(),
            sp: "s1".into(),
            glue: false,
        };
        let right = Word {
            id: "c".into(),
            t0: 2.6,
            t1: 3.6,
            text: "again.".into(),
            sp: "s1".into(),
            glue: false,
        };
        let words = [&left, &mid, &right];
        // 31–42 CPS: over aim, but still fits a single line (spaces not counted).
        let translation = "Review notes carefully, and share feedback.";
        let params = TransParams::for_lang("en");
        let cps = count_cps_chars(translation);
        assert!(cps > params.soft && cps <= params.fit, "cps={cps}");
        assert!(!crate::split::exceeds_one_line_fit(
            translation,
            "en",
            params.fit
        ));
        let pieces = latin_semantic_presplit(translation, &words, "en", &params)
            .expect("balanced latin pre-split");
        assert_eq!(pieces.len(), 2);
        assert_eq!(pieces[0].1, 0);
        assert_eq!(pieces[1].2, 2);
    }

    #[test]
    fn align_list_marks_over_fit() {
        let params = TransParams::for_lang("zh");
        let long = "超".repeat(22);
        let entries = align_list_entries(&[("s-a".into(), long)], "zh", &params);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].over_hard);
        assert!(entries[0].over_fit);
    }

    #[test]
    fn reanchor_snaps_boundaries_to_source_seams() {
        // A real regression sample ("Loop Engineering" benchmark s-g5.33): naive proportional anchoring would cut the boundary inside make|changes and external|applications. After snapping, it should land after changes and before to.
        let words: Vec<&str> = "This was the beginning of Context Engineering, where the \
             agent could now access files to load and make changes, or even use MCP to start \
             interacting with databases and external applications to load its own context."
            .split_whitespace()
            .collect();
        let texts = vec![
            "这就是上下文工程的开端:".to_owned(),
            "智能体现在可以访问文件进行加载和修改,".to_owned(),
            "甚至可以使用MCP与数据库和外部应用交互,".to_owned(),
            "从而加载自己的上下文。".to_owned(),
        ];
        let pieces = reanchor_texts(texts, &words, "zh");
        let bounds: Vec<(usize, usize)> = pieces
            .iter()
            .map(|piece| (piece.from.unwrap(), piece.to.unwrap()))
            .collect();
        assert_eq!(bounds, vec![(0, 6), (7, 18), (19, 30), (31, 35)]);
    }

    #[test]
    fn reanchor_keeps_proportional_when_no_seam_in_window() {
        let words: Vec<&str> = vec!["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
        let texts = vec!["前半句一共六个字".to_owned(), "后半句也是六个字".to_owned()];
        let pieces = reanchor_texts(texts, &words, "zh");
        assert_eq!(pieces.len(), 2);
        assert_eq!(pieces[0].from, Some(0));
        assert_eq!(pieces[1].to, Some(5));
        let boundary = pieces[1].from.unwrap();
        assert_eq!(pieces[0].to.unwrap() + 1, boundary);
        assert_eq!(boundary, 3); // No seam to snap to: keep the proportional split.
    }
}

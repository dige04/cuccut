//! English text normalization: inflect `number_to_words` / `ordinal`, the `normalize` from upstream `text/en_normalization/expend.py`,
//! and `text_normalize` from `text/english.py`.
//!
//! The number functions accept only ASCII digit strings (optionally with `st/nd/rd/th`); all upstream call sites come from `[0-9]+` matches or `str(int)`.
//! Only groups 0 / 1 / 2 are ported; the decimal-point chunking path is unreachable.
//!
//! In the upstream regexes, `\b`, `\d` and `\s` have Python semantics (`pychar`), which differ from the `regex` crate's: rules containing `\b` are scanned by hand, and the rest expand `\d` / `\s` into explicit character classes. `regex`'s leftmost-first matching and Python's backtracking engine give the same matches and groups on these patterns, which have no backreferences and no lookaround.

use std::sync::LazyLock;

use regex::{Captures, Regex};
use unicode_normalization::UnicodeNormalization;

use super::error::PyError;
use super::pychar;

const UNIT: [&str; 10] = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEEN: [&str; 10] = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];
const TEN: [&str; 10] = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const MILL: [&str; 12] = [
    " ",
    " thousand",
    " million",
    " billion",
    " trillion",
    " quadrillion",
    " quintillion",
    " sextillion",
    " septillion",
    " octillion",
    " nonillion",
    " decillion",
];
const NTH_SUFF: [&str; 4] = ["st", "nd", "rd", "th"];
/// inflect `ordinal_suff`: cardinal word ending → ordinal ending.
const ORDINAL_SUFF: [(&str, &str); 8] = [
    ("ty", "tieth"),
    ("one", "first"),
    ("two", "second"),
    ("three", "third"),
    ("five", "fifth"),
    ("eight", "eighth"),
    ("nine", "ninth"),
    ("twelve", "twelfth"),
];

/// The digit limit of CPython `int(str)` (the default value of `sys.get_int_max_str_digits()`).
const INT_MAX_STR_DIGITS: usize = 4300;

/// `str(int(s))`: strips leading zeros from an ASCII digit string; raises `ValueError` if it contains other characters or is too long.
fn py_int(s: &str) -> Result<&str, PyError> {
    if s.is_empty() || s.len() > INT_MAX_STR_DIGITS || !s.bytes().all(|b| b.is_ascii_digit()) {
        return Err(PyError::Value);
    }
    let trimmed = s.trim_start_matches('0');
    Ok(if trimmed.is_empty() { "0" } else { trimmed })
}

fn digit(b: u8) -> usize {
    usize::from(b - b'0')
}

/// Keyword arguments for inflect `number_to_words`.
#[derive(Debug, Clone, Copy)]
pub struct NumberArgs<'a> {
    pub group: u8,
    pub andword: &'a str,
    pub zero: &'a str,
    pub one: &'a str,
}

impl Default for NumberArgs<'_> {
    fn default() -> Self {
        Self {
            group: 0,
            andword: "and",
            zero: "zero",
            one: "one",
        }
    }
}

fn millfn(index: usize) -> Result<&'static str, PyError> {
    MILL.get(index).copied().ok_or(PyError::NumOutOfRange)
}

fn tenfn(tens: usize, units: usize, mindex: usize) -> Result<String, PyError> {
    if tens != 1 {
        let hyphen = if tens != 0 && units != 0 { "-" } else { "" };
        return Ok(format!("{}{hyphen}{}{}", TEN[tens], UNIT[units], millfn(mindex)?));
    }
    // This upstream branch indexes `mill[mindex]` directly, so out of range is an IndexError rather than NumOutOfRangeError
    let mill = MILL.get(mindex).ok_or(PyError::Index)?;
    Ok(format!("{}{mill}", TEEN[units]))
}

fn hundfn(hundreds: usize, tens: usize, units: usize, mindex: usize, andword: &str) -> Result<String, PyError> {
    if hundreds != 0 {
        let and = if tens != 0 || units != 0 {
            format!(" {andword} ")
        } else {
            String::new()
        };
        let ten = tenfn(tens, units, 0)?;
        return Ok(format!("{} hundred{and}{ten}{}, ", UNIT[hundreds], millfn(mindex)?));
    }
    if tens != 0 || units != 0 {
        let ten = tenfn(tens, units, 0)?;
        return Ok(format!("{ten}{}, ", millfn(mindex)?));
    }
    Ok(String::new())
}

fn enword(num: &str, args: &NumberArgs) -> Result<String, PyError> {
    let bytes = num.as_bytes();
    match args.group {
        1 => Ok(bytes
            .iter()
            .map(|&b| match digit(b) {
                1 => format!(" {}, ", args.one),
                0 => format!(" {}, ", args.zero),
                units => format!("{}, ", UNIT[units]),
            })
            .collect()),
        2 => {
            let mut out = String::new();
            let pairs = bytes.chunks_exact(2);
            let rest = pairs.remainder();
            for pair in pairs {
                let (tens, units) = (digit(pair[0]), digit(pair[1]));
                out += &if tens != 0 {
                    format!("{}, ", tenfn(tens, units, 0)?)
                } else if units != 0 {
                    format!(" {} {}, ", args.zero, UNIT[units])
                } else {
                    format!(" {} {}, ", args.zero, args.zero)
                };
            }
            if let [last] = rest {
                out += &match digit(*last) {
                    0 => format!(" {}, ", args.zero),
                    units => format!("{}, ", UNIT[units]),
                };
            }
            Ok(out)
        }
        0 => {
            let value = py_int(num)?;
            match value {
                "0" => return Ok(args.zero.to_owned()),
                "1" => return Ok(args.one.to_owned()),
                _ => {}
            }
            let d: Vec<usize> = value.bytes().map(digit).collect();
            // Digits are grouped in threes from the low end (THREE_DIGITS_WORD repeatedly replaces the rightmost three digits); an all-zero group produces no words but still carries
            let (mut end, mut mill_count, mut tail) = (d.len(), 0, String::new());
            while end >= 3 {
                tail = hundfn(d[end - 3], d[end - 2], d[end - 1], mill_count, args.andword)? + &tail;
                mill_count += 1;
                end -= 3;
            }
            let head = match end {
                2 => format!("{}, ", tenfn(d[0], d[1], mill_count)?),
                1 => format!("{}{}, ", UNIT[d[0]], millfn(mill_count)?),
                _ => String::new(),
            };
            Ok(head + &tail)
        }
        group => unimplemented!("inflect group={group} is not ported"),
    }
}

/// `re.sub(r"\s+,", ",", text)`
fn sub_space_comma(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        if pychar::is_space(chars[i]) {
            let mut j = i;
            while j < chars.len() && pychar::is_space(chars[j]) {
                j += 1;
            }
            if chars.get(j) != Some(&',') {
                out.extend(&chars[i..j]);
            }
            i = j;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// `re.sub(r", (\S+)\s+\Z", f" {andword} \1", text)`
fn comma_word(text: &str, andword: &str) -> String {
    for (p, _) in text.match_indices(", ") {
        let rest = &text[p + 2..];
        let Some(space) = rest.find(pychar::is_space) else {
            continue;
        };
        if space > 0 && rest[space..].chars().all(pychar::is_space) {
            return format!("{} {andword} {}", &text[..p], &rest[..space]);
        }
    }
    text.to_owned()
}

/// `re.sub(r"\s+", " ", text)`
fn collapse_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_space = false;
    for c in text.chars() {
        if pychar::is_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    out
}

/// inflect `_sub_ord`
fn sub_ord(value: &str) -> String {
    for (suffix, replacement) in ORDINAL_SUFF {
        if let Some(stem) = value.strip_suffix(suffix) {
            return format!("{stem}{replacement}");
        }
    }
    format!("{value}th")
}

/// inflect `engine.number_to_words(num, **args)`, where `num` is an ASCII digit string (optionally with an ordinal suffix).
pub fn number_to_words(num: &str, args: NumberArgs) -> Result<String, PyError> {
    // _get_sign：num.lstrip()[0]
    let sign = match num.trim_start_matches(pychar::is_space).chars().next() {
        None => return Err(PyError::Index),
        Some('+') => "plus ",
        Some('-') => "minus ",
        Some(_) => "",
    };
    let mut num = if NTH_SUFF.contains(&num) { args.zero } else { num };
    let myord = NTH_SUFF.iter().any(|suffix| num.ends_with(suffix));
    if myord {
        num = &num[..num.len() - 2];
    }
    debug_assert!(!num.contains('.'), "decimal chunking is not ported: {num}");
    let mut chunk: String = num.chars().filter(char::is_ascii_digit).collect();
    if chunk.is_empty() {
        chunk.push('0');
    }
    let mut words = enword(&chunk, &args)?;
    if words.ends_with(", ") {
        words.truncate(words.len() - 2);
    }
    words = sub_space_comma(&words);
    if args.group == 0 {
        words = comma_word(&words, args.andword);
    }
    let mut words = collapse_spaces(&words).trim_matches(pychar::is_space).to_owned();
    // Only one chunk: split on ", ", apply _sub_ord to the last item, then join back with ", " (group 0's _render does the same)
    if myord {
        words = sub_ord(&words);
    }
    Ok(format!("{sign}{words}"))
}

/// inflect `engine.ordinal(num)`: appends `st/nd/rd/th` to a digit string, otherwise turns the English cardinal word into an ordinal word.
pub fn ordinal(num: &str) -> Result<String, PyError> {
    if !num.chars().next().is_some_and(pychar::is_decimal) {
        return Ok(sub_ord(num));
    }
    let value = py_int(num)?.as_bytes();
    let n100 = match value {
        [.., tens, units] => digit(*tens) * 10 + digit(*units),
        [units] => digit(*units),
        [] => unreachable!(),
    };
    let nth = |n: usize| match n {
        1 => "st",
        2 => "nd",
        3 => "rd",
        _ => "th",
    };
    let post = match n100 {
        0..=9 => nth(n100),
        11..=13 => "th",
        _ => nth(n100 % 10),
    };
    Ok(format!("{num}{post}"))
}

// ---------------------------------------------------------------- expend.normalize

fn digits_end(chars: &[char], mut i: usize) -> usize {
    while i < chars.len() && chars[i].is_ascii_digit() {
        i += 1;
    }
    i
}

/// Python `\b` holds before a digit (`\w`): the previous character is not `\w`.
fn word_before(chars: &[char], i: usize) -> bool {
    i > 0 && pychar::is_word(chars[i - 1])
}

/// Python `\b` holds after a `\w` character: at the end or when the next character is not `\w`.
fn boundary_after(chars: &[char], j: usize) -> bool {
    j == chars.len() || !pychar::is_word(chars[j])
}

/// Imitates `re.sub`: tries `try_at` at each position from left to right; after a match of `(end, replacement)`, continues from the end (all matches are non-empty).
fn sub_scan(text: &str, mut try_at: impl FnMut(&[char], usize) -> Option<(usize, Result<String, PyError>)>) -> Result<String, PyError> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        match try_at(&chars, i) {
            Some((end, replacement)) => {
                out.push_str(&replacement?);
                i = end;
            }
            None => {
                out.push(chars[i]);
                i += 1;
            }
        }
    }
    Ok(out)
}

/// Imitates `re.sub`, where the replacement function may raise an exception (aborts at the first exception, consistent with Python).
fn sub_regex(re: &Regex, text: &str, mut repl: impl FnMut(&Captures) -> Result<String, PyError>) -> Result<String, PyError> {
    let mut out = String::with_capacity(text.len());
    let mut last = 0;
    for caps in re.captures_iter(text) {
        let whole = caps.get(0).expect("group 0");
        out.push_str(&text[last..whole.start()]);
        out.push_str(&repl(&caps)?);
        last = whole.end();
    }
    out.push_str(&text[last..]);
    Ok(out)
}

fn regex(pattern: &str) -> Regex {
    Regex::new(pattern).expect("en_norm regex")
}

/// `RE_ASMD`
static ASMD: LazyLock<Regex> = LazyLock::new(|| {
    let (d, s) = (pychar::decimal_class(), pychar::space_class());
    let operand = format!("((-?)(({d}+)(\\.{d}+)?[⁰¹²³⁴⁵⁶⁷⁸⁹ˣʸⁿ]*)|(\\.{d}+[⁰¹²³⁴⁵⁶⁷⁸⁹ˣʸⁿ]*)|([A-Za-z][⁰¹²³⁴⁵⁶⁷⁸⁹ˣʸⁿ]*))");
    regex(&format!("{operand}{s}+([+\\-×÷=]){s}+{operand}"))
});
/// `RE_INTEGER`
static NEGATIVE: LazyLock<Regex> = LazyLock::new(|| {
    let (d, s) = (pychar::decimal_class(), pychar::space_class());
    regex(&format!("(?:^|{s}+)(-)({d}+)"))
});
static COMMA_NUMBER: LazyLock<Regex> = LazyLock::new(|| regex("[0-9][0-9,]+[0-9]"));
static POUNDS_START: LazyLock<Regex> = LazyLock::new(|| regex("£([0-9.,]*[0-9]+)"));
static POUNDS_END: LazyLock<Regex> = LazyLock::new(|| regex("([0-9.,]*[0-9]+)£"));
static DOLLARS_START: LazyLock<Regex> = LazyLock::new(|| regex("\\$([0-9.,]*[0-9]+)"));
static DOLLARS_END: LazyLock<Regex> = LazyLock::new(|| regex("([(0-9.,]*[0-9]+)\\$"));
static DECIMAL: LazyLock<Regex> = LazyLock::new(|| regex(&format!("[0-9]+\\.{}*[0-9]+", pychar::space_class())));
static FRACTION: LazyLock<Regex> = LazyLock::new(|| regex("[0-9]+/[0-9]+"));
static ORDINAL: LazyLock<Regex> = LazyLock::new(|| regex("[0-9]+(?:st|nd|rd|th)"));
static NUMBER: LazyLock<Regex> = LazyLock::new(|| regex("[0-9]+"));

const MEASUREMENTS: [(&str, &str, &str); 12] = [
    ("m", "meter", "meters"),
    ("km", "kilometer", "kilometers"),
    ("km/h", "kilometer per hour", "kilometers per hour"),
    ("ft", "feet", "feet"),
    ("L", "liter", "liters"),
    ("tbsp", "tablespoon", "tablespoons"),
    ("tsp", "teaspoon", "teaspoons"),
    ("h", "hour", "hours"),
    ("min", "minute", "minutes"),
    ("s", "second", "seconds"),
    ("°C", "degree celsius", "degrees celsius"),
    ("°F", "degree fahrenheit", "degrees fahrenheit"),
];

/// `\b([0-9]+)\. ` → `ordinal(g1) + ", "`
fn convert_ordinal(text: &str) -> Result<String, PyError> {
    sub_scan(text, |chars, i| {
        if word_before(chars, i) || !chars[i].is_ascii_digit() {
            return None;
        }
        let j = digits_end(chars, i);
        if chars.get(j) != Some(&'.') || chars.get(j + 1) != Some(&' ') {
            return None;
        }
        let digits: String = chars[i..j].iter().collect();
        Some((j + 2, ordinal(&digits).map(|words| words + ", ")))
    })
}

/// `\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b` → 12-hour clock reading
fn expand_time(text: &str) -> Result<String, PyError> {
    sub_scan(text, |chars, i| {
        if word_before(chars, i) || !chars[i].is_ascii_digit() {
            return None;
        }
        let at = |p: usize| chars.get(p).copied().unwrap_or('\0');
        // The three branches are mutually exclusive at the colon position or the first position, so backtracking never switches to another branch
        let hour_len = if matches!(at(i), '0' | '1') && at(i + 1).is_ascii_digit() && at(i + 2) == ':' {
            2
        } else if at(i + 1) == ':' {
            1
        } else if at(i) == '2' && matches!(at(i + 1), '0'..='3') && at(i + 2) == ':' {
            2
        } else {
            return None;
        };
        let c = i + hour_len + 1;
        if !matches!(at(c), '0'..='5') || !at(c + 1).is_ascii_digit() || !boundary_after(chars, c + 2) {
            return None;
        }
        let hours: usize = chars[i..i + hour_len].iter().collect::<String>().parse().expect("hour");
        let minutes = digit(at(c) as u8) * 10 + digit(at(c + 1) as u8);
        let period = if hours < 12 { "a.m." } else { "p.m." };
        let hours = if hours > 12 { hours - 12 } else { hours };
        let words = (|| -> Result<String, PyError> {
            let hour_word = number_to_words(&hours.to_string(), NumberArgs::default())?;
            if minutes == 0 {
                return Ok(format!("{hour_word} o'clock {period}"));
            }
            let minute_word = number_to_words(&minutes.to_string(), NumberArgs::default())?;
            Ok(format!("{hour_word} {minute_word} {period}"))
        })();
        Some((c + 2, words))
    })
}

/// `\b([0-9]+(\.[0-9]+)?(m|km|km/h|…|°F))\b` → number + full unit name
fn expand_measurement(text: &str) -> Result<String, PyError> {
    sub_scan(text, |chars, i| {
        if word_before(chars, i) || !chars[i].is_ascii_digit() {
            return None;
        }
        let j = digits_end(chars, i);
        let mut starts = Vec::with_capacity(2);
        if chars.get(j) == Some(&'.') && chars.get(j + 1).is_some_and(char::is_ascii_digit) {
            starts.push(digits_end(chars, j + 1));
        }
        starts.push(j);
        for start in starts {
            for (sign, one, many) in MEASUREMENTS {
                let end = start + sign.chars().count();
                if end > chars.len() || !chars[start..end].iter().copied().eq(sign.chars()) || !boundary_after(chars, end) {
                    continue;
                }
                let number: String = chars[i..start].iter().collect();
                let singular = start == j;
                let words = py_int(&number.replace('.', "")).map(|value| {
                    let word = if singular && value == "1" { one } else { many };
                    format!("{number} {word}")
                });
                return Some((end, words));
            }
        }
        None
    })
}

/// `_expand_pounds` / `_expand_dollars`
fn expand_money(amount: &str, unit: [&str; 2], cent: [&str; 2]) -> Result<String, PyError> {
    let parts: Vec<&str> = amount.split('.').collect();
    if parts.len() > 2 {
        return Ok(format!("{amount} {}", unit[1]));
    }
    let main = if parts[0].is_empty() { "0" } else { py_int(parts[0])? };
    let padded;
    let sub = match parts.get(1) {
        Some(part) if !part.is_empty() => {
            padded = format!("{part:0<2}");
            py_int(&padded)?
        }
        _ => "0",
    };
    fn pick<'a>(value: &str, words: [&'a str; 2]) -> &'a str {
        if value == "1" { words[0] } else { words[1] }
    }
    Ok(match (main != "0", sub != "0") {
        (true, true) => format!("{main} {} and {sub} {}", pick(main, unit), pick(sub, cent)),
        (true, false) => format!("{main} {}", pick(main, unit)),
        (false, true) => format!("{sub} {}", pick(sub, cent)),
        (false, false) => format!("zero {}", unit[1]),
    })
}

/// `_expend_fraction`
fn expand_fraction(fraction: &str) -> Result<String, PyError> {
    let (numerator, denominator) = fraction.split_once('/').expect("fraction");
    let (numerator, denominator) = (py_int(numerator)?, py_int(denominator)?);
    let numerator_part = number_to_words(numerator, NumberArgs::default())?;
    let denominator_part = match denominator {
        "2" if numerator == "1" => "half".to_owned(),
        "2" => "halves".to_owned(),
        "1" => return Ok(numerator_part),
        _ => {
            let mut words = ordinal(&number_to_words(denominator, NumberArgs::default())?)?;
            if numerator != "0" && numerator != "1" {
                words.push('s');
            }
            words
        }
    };
    Ok(format!("{numerator_part} {denominator_part}"))
}

/// `_expand_number`
fn expand_number(digits: &str) -> Result<String, PyError> {
    let num = py_int(digits)?;
    let value: u32 = if num.len() <= 4 { num.parse().expect("number") } else { u32::MAX };
    if value > 1000 && value < 3000 {
        let plain = NumberArgs::default();
        return Ok(if value == 2000 {
            "two thousand".to_owned()
        } else if value > 2000 && value < 2010 {
            format!("two thousand {}", number_to_words(&(value % 100).to_string(), plain)?)
        } else if value % 100 == 0 {
            format!("{} hundred", number_to_words(&(value / 100).to_string(), plain)?)
        } else {
            let args = NumberArgs {
                group: 2,
                andword: "",
                zero: "oh",
                ..plain
            };
            number_to_words(num, args)?.replace(", ", " ")
        });
    }
    number_to_words(
        num,
        NumberArgs {
            andword: "",
            ..NumberArgs::default()
        },
    )
}

/// ASCII-only, case-insensitive literal replacement (the text is already ASCII-only at this point).
fn replace_ascii_ci(text: &str, pattern: &str, with: &str) -> String {
    let (bytes, pat) = (text.as_bytes(), pattern.as_bytes());
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes.len() - i >= pat.len() && bytes[i..i + pat.len()].eq_ignore_ascii_case(pat) {
            out.push_str(with);
            i += pat.len();
        } else {
            out.push(char::from(bytes[i]));
            i += 1;
        }
    }
    out
}

/// Upstream `expend.normalize`.
pub fn normalize(text: &str) -> Result<String, PyError> {
    let mut text = convert_ordinal(text)?;
    while ASMD.is_match(&text) {
        text = ASMD
            .replace_all(&text, |caps: &Captures| {
                let op = match &caps[8] {
                    "+" => " plus ",
                    "-" => " minus ",
                    "×" => " times ",
                    "÷" => " divided by ",
                    _ => " Equals ",
                };
                format!("{}{op}{}", &caps[1], &caps[9])
            })
            .into_owned();
    }
    let text = NEGATIVE.replace_all(&text, "negative $2");
    let text = COMMA_NUMBER.replace_all(&text, |caps: &Captures| caps[0].replace(',', ""));
    let text = expand_time(&text)?;
    let text = expand_measurement(&text)?;
    let pounds = |caps: &Captures| expand_money(&caps[1], ["pound", "pounds"], ["penny", "pence"]);
    let dollars = |caps: &Captures| expand_money(&caps[1], ["dollar", "dollars"], ["cent", "cents"]);
    let text = sub_regex(&POUNDS_START, &text, pounds)?;
    let text = sub_regex(&POUNDS_END, &text, pounds)?;
    let text = sub_regex(&DOLLARS_START, &text, dollars)?;
    let text = sub_regex(&DOLLARS_END, &text, dollars)?;
    let text = DECIMAL.replace_all(&text, |caps: &Captures| {
        let (int_part, frac) = caps[0].split_once('.').expect("decimal point");
        let spelled: Vec<String> = frac.chars().map(String::from).collect();
        format!("{int_part} point {}", spelled.join(" "))
    });
    let text = sub_regex(&FRACTION, &text, |caps| expand_fraction(&caps[0]))?;
    let text = sub_regex(&ORDINAL, &text, |caps| number_to_words(&caps[0], NumberArgs::default()))?;
    let text = sub_regex(&NUMBER, &text, |caps| expand_number(&caps[0]))?;

    // NFD, drop Mn, `%` → " percent", delete [^ A-Za-z'.,?!\-]: Mn is not in the kept set anyway, so these are combined into one pass
    let mut kept = String::with_capacity(text.len());
    for c in text.nfd() {
        if c == '%' {
            kept.push_str(" percent");
        } else if c == ' ' || c.is_ascii_alphabetic() || "'.,?!-".contains(c) {
            kept.push(c);
        }
    }
    let text = replace_ascii_ci(&kept, "i.e.", "that is");
    let text = replace_ascii_ci(&text, "e.g.", "for example");
    // (?<!^)(?<![\s])([A-Z]) → " \1"
    let bytes = text.as_bytes();
    let mut out = String::with_capacity(text.len() + 8);
    for (i, &b) in bytes.iter().enumerate() {
        if i > 0 && b.is_ascii_uppercase() && bytes[i - 1] != b' ' {
            out.push(' ');
        }
        out.push(char::from(b));
    }
    Ok(out)
}

// ---------------------------------------------------------------- english.text_normalize

/// Upstream `rep_map`: keys are escaped with `re.escape` and matched literally (`"[;:：，；]"` is a literal seven-character string).
const REP_MAP: [(&str, &str); 5] = [("[;:：，；]", ","), ("[\"’]", "'"), ("。", "."), ("！", "!"), ("？", "?")];

/// `text.symbols.punctuation`
const PUNCTUATION: [char; 6] = ['!', '?', '…', ',', '.', '-'];

/// `english.replace_consecutive_punctuation`：`([P\s])([P])+` → `\1`。
fn replace_consecutive_punctuation(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let is_punct = |c: &char| PUNCTUATION.contains(c);
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        out.push(c);
        i += 1;
        if (is_punct(&c) || pychar::is_space(c)) && chars.get(i).is_some_and(is_punct) {
            while chars.get(i).is_some_and(is_punct) {
                i += 1;
            }
        }
    }
    out
}

/// Upstream `english.text_normalize`.
pub fn text_normalize(text: &str) -> Result<String, PyError> {
    let mut replaced = String::with_capacity(text.len());
    let mut rest = text;
    'scan: while let Some(c) = rest.chars().next() {
        for (from, to) in REP_MAP {
            if let Some(tail) = rest.strip_prefix(from) {
                replaced.push_str(to);
                rest = tail;
                continue 'scan;
            }
        }
        replaced.push(c);
        rest = &rest[c.len_utf8()..];
    }
    Ok(replace_consecutive_punctuation(&normalize(&replaced)?))
}

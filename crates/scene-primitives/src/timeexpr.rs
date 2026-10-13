//! TimeExpr parsing (spec §5.2 / Appendix A EBNF).
//! Evaluation happens in the Resolver (it needs the cue table and clip windows); this file only does the syntax parsing.

use anyhow::{Result, bail};

#[derive(Debug, Clone, PartialEq)]
pub enum TimeExpr {
    /// Absolute seconds on the whole timeline
    Abs(f64),
    /// @scene / #clip anchor + offset
    Anchor {
        /// '@' scene or '#' clip
        sigil: char,
        id: String,
        mark: Mark,
        /// Absolute seconds offset (does not scale)
        offset: f64,
    },
    /// ~word anchor (spec §5.2): anchors to a word in a media transcript, evaluated through the §18.6 mapping.
    Word {
        /// Media id, or the id of a clip that references that media
        ref_id: String,
        word_id: String,
        /// true = word end t1; false = word start t0 (default)
        mark_end: bool,
        offset: f64,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Mark {
    Start,
    End,
    /// Percentage of the scene duration (0..100), valid only for @scene
    Pct(f64),
}

pub fn parse(s: &str) -> Result<TimeExpr> {
    let s = s.trim();
    if let Ok(n) = s.parse::<f64>() {
        return Ok(TimeExpr::Abs(n));
    }
    if let Some(rest) = s.strip_prefix('~') {
        return parse_word_anchor(rest, s);
    }
    let mut chars = s.char_indices().peekable();
    let (_, sigil) = chars
        .next()
        .filter(|(_, c)| *c == '@' || *c == '#')
        .map_or_else(|| (0, '\0'), |(i, c)| (i, c));
    if sigil == '\0' {
        bail!("非法 TimeExpr: \"{s}\"");
    }

    // ident: [A-Za-z_][A-Za-z0-9_-]*
    // '-' is both a legal ident character and an offset sign ("@growth-0.4"),
    // consistent with the regex backtracking of the reference implementation: try from the longest ident backwards until the tail parses completely.
    let rest = &s[1..];
    let mut max_id = 0;
    for (i, c) in rest.char_indices() {
        let ok = if i == 0 {
            c.is_ascii_alphabetic() || c == '_'
        } else {
            c.is_ascii_alphanumeric() || c == '_' || c == '-'
        };
        if !ok {
            break;
        }
        max_id = i + c.len_utf8();
    }
    if max_id == 0 {
        bail!("非法 TimeExpr: \"{s}\"（缺少标识符）");
    }
    let mut candidates: Vec<usize> = (1..=max_id)
        .filter(|&i| rest.is_char_boundary(i) && !rest[..i].ends_with('-'))
        .collect();
    candidates.reverse();
    for id_end in candidates {
        let id = &rest[..id_end];
        if let Some((mark, offset)) = parse_tail(&rest[id_end..], sigil) {
            return Ok(TimeExpr::Anchor {
                sigil,
                id: id.to_string(),
                mark,
                offset,
            });
        }
    }
    bail!("非法 TimeExpr: \"{s}\"")
}

/// `~refId:wordId[:start|:end][±offset]` (Appendix A word-anchor).
/// Legal word id characters include `.` and `-`, so a negative offset is only allowed after an explicit `:start`/`:end`;
/// a positive offset (`+`) does not conflict with word id characters and can follow directly.
fn parse_word_anchor(rest: &str, whole: &str) -> Result<TimeExpr> {
    // refId: [A-Za-z_][A-Za-z0-9_-]*
    let mut id_end = 0;
    for (i, c) in rest.char_indices() {
        let ok = if i == 0 {
            c.is_ascii_alphabetic() || c == '_'
        } else {
            c.is_ascii_alphanumeric() || c == '_' || c == '-'
        };
        if !ok {
            break;
        }
        id_end = i + c.len_utf8();
    }
    if id_end == 0 {
        bail!("非法 TimeExpr: \"{whole}\"（词锚点缺少媒体/clip 标识符）");
    }
    let ref_id = &rest[..id_end];
    let Some(after_ref) = rest[id_end..].strip_prefix(':') else {
        bail!("非法 TimeExpr: \"{whole}\"（词锚点须为 ~refId:wordId 形态）");
    };
    // wordId: [A-Za-z0-9][A-Za-z0-9._-]* (greedy; '-' belongs to the word id and is not split off as a negative offset)
    let mut w_end = 0;
    for (i, c) in after_ref.char_indices() {
        let ok = if i == 0 {
            c.is_ascii_alphanumeric()
        } else {
            c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-'
        };
        if !ok {
            break;
        }
        w_end = i + c.len_utf8();
    }
    if w_end == 0 {
        bail!("非法 TimeExpr: \"{whole}\"（词锚点缺少词 id）");
    }
    let word_id = &after_ref[..w_end];
    let mut tail = &after_ref[w_end..];

    let mut mark_end = false;
    let mut explicit_mark = false;
    if let Some(t) = tail.strip_prefix(":start") {
        explicit_mark = true;
        tail = t;
    } else if let Some(t) = tail.strip_prefix(":end") {
        mark_end = true;
        explicit_mark = true;
        tail = t;
    }

    let mut offset = 0.0;
    let t = tail.trim_start();
    if !t.is_empty() {
        let (sign, num) = if let Some(n) = t.strip_prefix('+') {
            (1.0, n)
        } else if let Some(n) = t.strip_prefix('-') {
            if !explicit_mark {
                bail!("非法 TimeExpr: \"{whole}\"（负偏移须跟在显式 :start/:end 之后）");
            }
            (-1.0, n)
        } else {
            bail!("非法 TimeExpr: \"{whole}\"");
        };
        offset = sign
            * num
                .trim_start()
                .parse::<f64>()
                .map_err(|_| anyhow::anyhow!("非法 TimeExpr: \"{whole}\"（偏移不是数字）"))?;
    }
    Ok(TimeExpr::Word {
        ref_id: ref_id.to_string(),
        word_id: word_id.to_string(),
        mark_end,
        offset,
    })
}

/// Parses the part after the ident: [.mark][±offset]; it must consume the whole remainder.
fn parse_tail(tail: &str, sigil: char) -> Option<(Mark, f64)> {
    let mut mark = Mark::Start;
    let mut tail = tail;
    if let Some(after) = tail.strip_prefix('.') {
        if let Some(t) = after.strip_prefix("start") {
            mark = Mark::Start;
            tail = t;
        } else if let Some(t) = after.strip_prefix("end") {
            mark = Mark::End;
            tail = t;
        } else {
            // Percentage: number + '%'
            let num_end = after
                .char_indices()
                .take_while(|(_, c)| c.is_ascii_digit() || *c == '.')
                .last()
                .map(|(i, c)| i + c.len_utf8())
                .unwrap_or(0);
            if num_end == 0 || !after[num_end..].starts_with('%') || sigil == '#' {
                return None;
            }
            mark = Mark::Pct(after[..num_end].parse().ok()?);
            tail = &after[num_end + 1..];
        }
    }
    let mut offset = 0.0;
    let t = tail.trim_start();
    if !t.is_empty() {
        let (sign, num) = if let Some(n) = t.strip_prefix('+') {
            (1.0, n)
        } else if let Some(n) = t.strip_prefix('-') {
            (-1.0, n)
        } else {
            return None;
        };
        offset = sign * num.trim_start().parse::<f64>().ok()?;
    }
    Some((mark, offset))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_forms() {
        assert_eq!(parse("2.5").unwrap(), TimeExpr::Abs(2.5));
        assert_eq!(
            parse("@growth").unwrap(),
            TimeExpr::Anchor {
                sigil: '@',
                id: "growth".into(),
                mark: Mark::Start,
                offset: 0.0
            }
        );
        assert_eq!(
            parse("@growth.end-0.3").unwrap(),
            TimeExpr::Anchor {
                sigil: '@',
                id: "growth".into(),
                mark: Mark::End,
                offset: -0.3
            }
        );
        assert_eq!(
            parse("@growth.40%").unwrap(),
            TimeExpr::Anchor {
                sigil: '@',
                id: "growth".into(),
                mark: Mark::Pct(40.0),
                offset: 0.0
            }
        );
        assert_eq!(
            parse("#opening-shot.end").unwrap(),
            TimeExpr::Anchor {
                sigil: '#',
                id: "opening-shot".into(),
                mark: Mark::End,
                offset: 0.0
            }
        );
        assert_eq!(
            parse("@growth + 0.5").unwrap(),
            TimeExpr::Anchor {
                sigil: '@',
                id: "growth".into(),
                mark: Mark::Start,
                offset: 0.5
            }
        );
    }

    #[test]
    fn parse_errors() {
        assert!(parse("@").is_err());
        assert!(parse("growth").is_err());
        assert!(parse("#clip.40%").is_err());
        assert!(parse("@scene.middle").is_err());
        assert!(parse("@scene..").is_err());
    }

    fn word(ref_id: &str, word_id: &str, mark_end: bool, offset: f64) -> TimeExpr {
        TimeExpr::Word {
            ref_id: ref_id.into(),
            word_id: word_id.into(),
            mark_end,
            offset,
        }
    }

    #[test]
    fn parse_word_anchors() {
        assert_eq!(
            parse("~interview:g3.7").unwrap(),
            word("interview", "g3.7", false, 0.0)
        );
        assert_eq!(
            parse("~interview:g3.7:end").unwrap(),
            word("interview", "g3.7", true, 0.0)
        );
        assert_eq!(
            parse("~interview:g3.7:end-0.15").unwrap(),
            word("interview", "g3.7", true, -0.15)
        );
        assert_eq!(
            parse("~interview:g3.7:start-0.2").unwrap(),
            word("interview", "g3.7", false, -0.2)
        );
        // A positive offset can follow directly ('+' is not a word id character)
        assert_eq!(parse("~m:g3.7+0.2").unwrap(), word("m", "g3.7", false, 0.2));
        assert_eq!(
            parse("~m:g3.7 + 0.2").unwrap(),
            word("m", "g3.7", false, 0.2)
        );
        // Word ids newly created in the editor contain '-': the whole segment is absorbed into the word id
        assert_eq!(
            parse("~m:w1a2b-3").unwrap(),
            word("m", "w1a2b-3", false, 0.0)
        );
        assert_eq!(
            parse("~m:w1a2b-3:end-0.1").unwrap(),
            word("m", "w1a2b-3", true, -0.1)
        );
        // clip-qualified form
        assert_eq!(
            parse("~clip-a:g0.1").unwrap(),
            word("clip-a", "g0.1", false, 0.0)
        );
    }

    #[test]
    fn parse_word_anchor_errors() {
        // Without an explicit mark, " - 0.15" cannot be told apart from a word id → rejected
        assert!(parse("~m:g3.7 - 0.15").is_err());
        assert!(parse("~m").is_err()); // Missing :wordId
        assert!(parse("~m:").is_err());
        assert!(parse("~:g3.7").is_err()); // Missing refId
        assert!(parse("~m:g3.7:middle").is_err()); // Unknown mark (:m is not a continuation of word id characters)
        assert!(parse("~m:g3.7:end+x").is_err());
    }
}

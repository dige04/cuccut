//! Text part splitting and cascade order (design §5.6).
//!
//! Function bodies are taken verbatim from `ccut-timeline/src/motion.rs:688-700` and `:712-781`, with the same semantics as VoiceInk's `AnimParts.split`.

use std::ops::Range;

use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartUnit {
    Char,
    Word,
    Line,
}

/// Cascade parameters. `unit`/`part_dur`/`stagger` are recipe data.
/// `0.5` (total span cap) and `0.01` (part duration floor) are kernel policy constants and do not go into the manifest.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StaggerPlan {
    pub unit: PartUnit,
    pub part_dur: f64,
    pub stagger: f64,
}

/// Cascade span cap (`motion.rs:652`).
pub const CASCADE_SPREAD_CAP: f64 = 0.5;
/// Per-part duration floor (`motion.rs:646`).
pub const PART_DURATION_FLOOR: f64 = 0.01;

/// Splits `text` by the rules of VoiceInk's `AnimParts.split`.
/// The returned ranges are UTF-8 byte offsets and cover the whole string exactly.
pub fn split_animation_parts(text: &str, unit: PartUnit) -> Vec<Range<usize>> {
    if text.is_empty() {
        return Vec::new();
    }
    if unit == PartUnit::Line {
        let mut start = 0;
        return text
            .split_inclusive('\n')
            .map(|line| {
                let range = start..start + line.len();
                start = range.end;
                range
            })
            .collect();
    }
    #[derive(Clone, Copy)]
    struct Cell {
        offset: usize,
        is_space: bool,
        is_ideograph: bool,
    }
    let cells = text
        .grapheme_indices(true)
        .map(|(offset, grapheme)| Cell {
            offset,
            is_space: grapheme.chars().all(char::is_whitespace),
            is_ideograph: is_ideograph(grapheme),
        })
        .collect::<Vec<_>>();
    let mut starts = Vec::new();
    for (index, cell) in cells.iter().enumerate() {
        if cell.is_space {
            continue;
        }
        let opens = match unit {
            PartUnit::Char => true,
            PartUnit::Word => {
                cell.is_ideograph
                    || index == 0
                    || cells[index - 1].is_space
                    || cells[index - 1].is_ideograph
            }
            PartUnit::Line => unreachable!("line splitting returned above"),
        };
        if starts.is_empty() || opens {
            starts.push(cell.offset);
        }
    }
    if starts.is_empty() {
        let whole = 0..text.len();
        return vec![whole];
    }
    starts
        .iter()
        .enumerate()
        .map(|(index, start)| {
            let from = if index == 0 { 0 } else { *start };
            let to = starts.get(index + 1).copied().unwrap_or(text.len());
            from..to
        })
        .collect()
}

/// Stable part map (design §5.6 / §13 "text part id drift" risk row).
///
/// part id = **stable index + content fingerprint**: `ranges` exactly cover the whole string, and `fingerprint` covers `unit`, the original string, and each part's byte range. When a font or line-wrap change rebuilds the map, the fingerprint changes with it, and the caller uses this to judge whether "per-word animation has drifted" (`split-part-unstable`).
/// Word parts in **subtitle** scenes have an even stronger id (transcript word id, spec §18). A BCF `text` node has no transcript, so only this layer is available.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PartMap {
    pub unit: PartUnit,
    pub ranges: Vec<Range<usize>>,
    pub fingerprint: u64,
}

impl PartMap {
    pub fn build(text: &str, unit: PartUnit) -> Self {
        let ranges = split_animation_parts(text, unit);
        Self::from_ranges(text, unit, ranges)
    }

    /// Use the final shaped line ranges for `Line`; the fingerprint includes
    /// their byte boundaries so changing a wrap width produces a new map.
    pub fn from_ranges(text: &str, unit: PartUnit, ranges: Vec<Range<usize>>) -> Self {
        let mut buf = Vec::with_capacity(text.len() + ranges.len() * 8 + 8);
        buf.push(match unit {
            PartUnit::Char => b'c',
            PartUnit::Word => b'w',
            PartUnit::Line => b'l',
        });
        buf.extend_from_slice(text.as_bytes());
        for range in &ranges {
            buf.push(0xff);
            buf.extend_from_slice(&(range.start as u64).to_le_bytes());
            buf.extend_from_slice(&(range.end as u64).to_le_bytes());
        }
        let fingerprint = crate::fingerprint::fnv1a64(&buf);
        Self {
            unit,
            ranges,
            fingerprint,
        }
    }

    pub fn len(&self) -> usize {
        self.ranges.len()
    }

    pub fn is_empty(&self) -> bool {
        self.ranges.is_empty()
    }

    /// Source-string byte offset → part index.
    ///
    /// A ligature can make one glyph cluster span a part boundary. The rule is to **take the part that `cluster.start` belongs to** (plan §3.3.3), so only the start is used for the decision here.
    pub fn part_of(&self, byte_offset: usize) -> Option<usize> {
        self.ranges
            .iter()
            .position(|range| range.contains(&byte_offset))
            .or_else(|| {
                // An out-of-range value can only come from the right endpoint of the last part (including trailing whitespace).
                self.ranges
                    .last()
                    .filter(|last| byte_offset >= last.end)
                    .map(|_| self.ranges.len() - 1)
            })
    }
}

pub fn is_ideograph(grapheme: &str) -> bool {
    let mut scalars = grapheme.chars();
    let Some(value) = scalars.next().map(u32::from) else {
        return false;
    };
    if scalars.next().is_some() {
        return false;
    }
    matches!(
        value,
        0x3000..=0x303F
            | 0x3040..=0x30FF
            | 0x3400..=0x4DBF
            | 0x4E00..=0x9FFF
            | 0xAC00..=0xD7AF
            | 0xF900..=0xFAFF
            | 0xFF00..=0xFF60
            | 0x20000..=0x2FA1F
    )
}

/// Cascade start point (Timeline 0.1's `staggerFrom`, spec §7.5 `stagger.order`).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum StaggerFrom {
    #[default]
    Start,
    End,
    Center,
}

impl StaggerFrom {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "start" => Some(Self::Start),
            "end" => Some(Self::End),
            "center" => Some(Self::Center),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::End => "end",
            Self::Center => "center",
        }
    }
}

/// String version (`AnimationSlot::stagger_from` on the Timeline side is still `Option<String>`).
/// Unknown names fall back to `Start`, consistent with the old implementation.
pub fn stagger_order(index: usize, count: usize, from: Option<&str>) -> usize {
    let from = from.and_then(StaggerFrom::parse).unwrap_or_default();
    stagger_order_from(index, count, from)
}

/// Strongly typed version. `order` is a **permutation** of `0..count`. The three start points only change the order and do not change the duration rule that "max order = count-1" (design §5.2).
pub fn stagger_order_from(index: usize, count: usize, from: StaggerFrom) -> usize {
    if count <= 1 {
        return 0;
    }
    match from {
        StaggerFrom::Start => index,
        StaggerFrom::End => count - 1 - index,
        StaggerFrom::Center => {
            let midpoint = (count - 1) as f64 / 2.0;
            (index as f64 - midpoint).abs().floor() as usize
        }
    }
}

/// The cascade section of the recipe (`parts` in `timeline.enter.<id>.json`).
pub fn stagger_plan(preset: &str) -> Option<StaggerPlan> {
    crate::preset_registry::timeline_enter(preset).and_then(|recipe| recipe.parts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_part_split_matches_voiceink_grapheme_cjk_and_whitespace_contract() {
        let cases = [
            (
                "Hello world",
                PartUnit::Char,
                vec!["H", "e", "l", "l", "o ", "w", "o", "r", "l", "d"],
            ),
            ("Hello world", PartUnit::Word, vec!["Hello ", "world"]),
            (
                "CucCut 剪辑 v2",
                PartUnit::Word,
                vec!["CucCut ", "剪", "辑 ", "v2"],
            ),
            (
                "Hi 👨‍👩‍👧 🇯🇵 ok",
                PartUnit::Char,
                vec!["H", "i ", "👨‍👩‍👧 ", "🇯🇵 ", "o", "k"],
            ),
            ("  padded  ", PartUnit::Word, vec!["  padded  "]),
        ];
        for (text, unit, expected) in cases {
            let actual = split_animation_parts(text, unit)
                .into_iter()
                .map(|range| &text[range])
                .collect::<Vec<_>>();
            assert_eq!(actual, expected, "text={text:?} unit={unit:?}");
        }
    }

    #[test]
    fn empty_text_has_no_parts() {
        assert!(split_animation_parts("", PartUnit::Char).is_empty());
    }

    #[test]
    fn only_typewriter_and_rise_words_cascade() {
        assert_eq!(
            stagger_plan("typewriter"),
            Some(StaggerPlan {
                unit: PartUnit::Char,
                part_dur: 0.04,
                stagger: 1.0 / 24.0,
            })
        );
        assert_eq!(
            stagger_plan("riseWords"),
            Some(StaggerPlan {
                unit: PartUnit::Word,
                part_dur: 0.35,
                stagger: 0.06,
            })
        );
        assert_eq!(stagger_plan("fade"), None);
        assert_eq!(stagger_plan("pop"), None);
    }

    #[test]
    fn part_maps_cover_the_string_and_fingerprint_their_content() {
        let map = PartMap::build("CucCut 剪辑 v2", PartUnit::Word);
        assert_eq!(map.len(), 4);
        assert_eq!(map.ranges.first().unwrap().start, 0);
        assert_eq!(map.ranges.last().unwrap().end, "CucCut 剪辑 v2".len());
        // Every byte falls in exactly one part
        for offset in 0.."CucCut 剪辑 v2".len() {
            assert!(map.part_of(offset).is_some(), "offset={offset}");
        }
        assert_eq!(map.part_of(0), Some(0));
        assert_eq!(map.part_of(7), Some(1));
        // Any change in text or unit ⇒ fingerprint changes
        assert_ne!(
            map.fingerprint,
            PartMap::build("CucCut 剪辑 v3", PartUnit::Word).fingerprint
        );
        assert_ne!(
            map.fingerprint,
            PartMap::build("CucCut 剪辑 v2", PartUnit::Char).fingerprint
        );
        assert_eq!(
            map.fingerprint,
            PartMap::build("CucCut 剪辑 v2", PartUnit::Word).fingerprint
        );
    }

    #[test]
    fn stagger_orders_cover_start_end_and_center() {
        assert_eq!(stagger_order(1, 5, None), 1);
        assert_eq!(stagger_order(1, 5, Some("start")), 1);
        assert_eq!(stagger_order(1, 5, Some("end")), 3);
        let center: Vec<usize> = (0..5)
            .map(|i| stagger_order(i, 5, Some("center")))
            .collect();
        assert_eq!(center, vec![2, 1, 0, 1, 2]);
        assert_eq!(stagger_order(0, 1, Some("end")), 0);
    }
}

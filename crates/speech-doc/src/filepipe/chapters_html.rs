//! Chapter carrier (file-v1): `chapters-source/1` (page input), `chapters-outline/1`
//! (Reduce input), and the output parsing shared by both.
//!
//! The input is paragraph-level HTML (`<p id data-at>full text</p>`). The output carries only what the code cannot infer:
//!
//! ```html
//! <h2>Chapter title</h2>
//! <p class="summary">One-sentence summary</p>
//! <p id="p-g1203.0">The first dozen or so characters of the paragraph…</p>
//! ```
//!
//! Parsing is a state machine that runs in the order title → summary → opening anchor. Tag names are not part of the protocol: h1–h6 or `class="title"` count as a title; an element with an `id` counts as an anchor; a text block without an id between the title and the anchor counts as the summary. The model copies the anchor id, and writing `p-g1203.0` as `p-g1230.0` is the most common silent chapter drop. So the opening snippet on the anchor is the fallback for the id: if the id is unknown but the snippet uniquely matches the start of one paragraph, repair by snippet (`anchor-repaired` diagnostic); if nothing matches, drop the line (`unknown-id`). A chapter's `end` is backfilled deterministically from the next chapter's `start`; the trailing anchor is not part of the protocol, and extra anchors are always ignored.

use std::collections::BTreeMap;

use super::common::{
    Diagnostics, Problem, ProblemCode, Warning, WarningCode, normalize_llm_output,
    sanitize_inline_text,
};
use super::html::{Element, Node, escape_attr, escape_text, normalize_html_text, parse_html};

/// Value of `data-ccut-format` for the page input carrier.
pub const CHAPTERS_SOURCE_FORMAT: &str = "chapters-source/1";
/// Value of `data-ccut-format` for the Reduce (global outline) input carrier.
pub const CHAPTERS_OUTLINE_FORMAT: &str = "chapters-outline/1";

/// Snippet length of the first paragraph (in characters): long enough to locate a paragraph's opening uniquely, but not so long that it tempts the model to copy the whole paragraph.
pub const SNIPPET_CHARS: usize = 40;
/// Minimum number of characters compared during snippet repair / validation; snippets shorter than this are not repaired.
const SNIPPET_MATCH_MIN_CHARS: usize = 4;
/// Maximum number of normalized characters compared from a snippet (the model often truncates the snippet itself or adds an ellipsis at the end).
const SNIPPET_MATCH_MAX_CHARS: usize = 16;

/// An anchor that can serve as a chapter start: a paragraph (Map page) or a topic unit (Reduce outline).
#[derive(Debug, Clone, PartialEq)]
pub struct ChapterAnchor {
    /// Segment id (`p-<first word id>`).
    pub id: String,
    /// Start time in seconds (relative to the media start).
    pub start: f64,
    /// Full paragraph text (page input) or opening snippet (outline input).
    pub text: String,
}

/// One Map page of input.
#[derive(Debug, Clone)]
pub struct ChaptersPageInput<'a> {
    /// Zero-based page index.
    pub part_index: usize,
    /// Total page count.
    pub part_count: usize,
    /// Paragraphs on this page (full text).
    pub segments: &'a [ChapterAnchor],
    /// Time range of this page (start seconds, end seconds).
    pub range: (f64, f64),
    /// Total media duration (seconds).
    pub total_duration: f64,
    /// Expected number of topic units for this page (goes into `data-aim`; the contract file is unique per kind, so per-page differences can only go into the carrier).
    pub aim: usize,
    /// Transcription language (goes into the root `lang`; titles and summaries use it by default).
    pub lang: &'a str,
    /// Project vocabulary fingerprint (audit anchor, not part of the protocol).
    pub project_fingerprint: &'a str,
}

/// A topic unit in the Reduce outline (the output of the Map stage).
#[derive(Debug, Clone, PartialEq)]
pub struct OutlineUnit {
    /// Anchor: id + start seconds + opening snippet.
    pub anchor: ChapterAnchor,
    /// Unit title; `None` means a placeholder unit for a page whose Map failed (no title, no summary).
    pub title: Option<String>,
    /// Unit summary.
    pub summary: Option<String>,
    /// Zero-based index of the page the unit came from; a page-seam marker is rendered where adjacent units come from different pages.
    pub part_index: usize,
}

/// One parsed chapter line.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedChapterRow {
    /// Title (whitespace normalized, non-empty).
    pub title: String,
    /// Anchor id after parsing or repair; guaranteed to exist in the input anchor set.
    pub anchor_id: String,
    /// Summary (may be missing).
    pub summary: Option<String>,
    /// Whether the anchor id was obtained by snippet repair.
    pub repaired: bool,
}

/// Result of parsing one output.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ChaptersParsed {
    /// Chapter lines kept in document order (not sorted by time, not deduplicated; the engine's deterministic cleanup handles that).
    pub rows: Vec<ParsedChapterRow>,
    /// Diagnostics.
    pub diagnostics: Diagnostics,
}

/// mm:ss, or HH:mm:ss once past an hour (aligned with voice-ink `fmtTime`; seconds are rounded down).
pub fn fmt_clock(time: f64) -> String {
    let seconds = time.max(0.0) as u64;
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let remainder = seconds % 60;
    if hours > 0 {
        format!("{hours:02}:{minutes:02}:{remainder:02}")
    } else {
        format!("{minutes:02}:{remainder:02}")
    }
}

/// Opening snippet of a paragraph: the first [`SNIPPET_CHARS`] characters (after single-line normalization), with an ellipsis added where truncated.
pub fn snippet(text: &str) -> String {
    let cleaned = sanitize_inline_text(text);
    let mut chars = cleaned.chars();
    let head: String = chars.by_ref().take(SNIPPET_CHARS).collect();
    if chars.next().is_some() {
        format!("{}…", head.trim_end())
    } else {
        head
    }
}

/// Render one Map page of input.
pub fn render_chapters_source(input: &ChaptersPageInput<'_>) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "<article lang=\"{}\" data-ccut-format=\"{}\" data-part=\"{}/{}\" data-range=\"{}–{}\" data-total=\"{}\" data-aim=\"{}\" data-project-fp=\"{}\">\n",
        escape_attr(input.lang),
        escape_attr(CHAPTERS_SOURCE_FORMAT),
        input.part_index + 1,
        input.part_count.max(1),
        fmt_clock(input.range.0),
        fmt_clock(input.range.1),
        fmt_clock(input.total_duration),
        input.aim.max(1),
        escape_attr(input.project_fingerprint),
    ));
    for segment in input.segments {
        out.push_str(&format!(
            "  <p id=\"{}\" data-at=\"{}\">{}</p>\n",
            escape_attr(&segment.id),
            fmt_clock(segment.start),
            escape_text(&sanitize_inline_text(&segment.text)),
        ));
    }
    out.push_str("</article>\n");
    out
}

/// Render the Reduce outline input: the topic units of each Map page are concatenated in order, with `<hr data-seam>` inserted at page seams.
pub fn render_chapters_outline(
    units: &[OutlineUnit],
    part_count: usize,
    total_duration: f64,
    aim: usize,
    lang: &str,
    project_fingerprint: &str,
) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "<article lang=\"{}\" data-ccut-format=\"{}\" data-parts=\"{}\" data-units=\"{}\" data-total=\"{}\" data-aim=\"{}\" data-project-fp=\"{}\">\n",
        escape_attr(lang),
        escape_attr(CHAPTERS_OUTLINE_FORMAT),
        part_count.max(1),
        units.len(),
        fmt_clock(total_duration),
        aim.max(1),
        escape_attr(project_fingerprint),
    ));
    let mut previous_part: Option<usize> = None;
    for unit in units {
        if let Some(previous) = previous_part
            && previous != unit.part_index
        {
            out.push_str(&format!(
                "  <hr data-seam=\"{}|{}\">\n",
                previous + 1,
                unit.part_index + 1
            ));
        }
        previous_part = Some(unit.part_index);
        match &unit.title {
            Some(title) => out.push_str(&format!(
                "  <h2 data-at=\"{}\">{}</h2>\n",
                fmt_clock(unit.anchor.start),
                escape_text(&sanitize_inline_text(title)),
            )),
            None => out.push_str(&format!(
                "  <h2 data-at=\"{}\" data-untitled=\"true\"></h2>\n",
                fmt_clock(unit.anchor.start),
            )),
        }
        let summary = match (&unit.title, &unit.summary) {
            (_, Some(summary)) if !summary.trim().is_empty() => Some(summary.clone()),
            (None, _) => Some(format!(
                "No summary available for this part (from {}) — title it from context or merge it into a neighbour.",
                fmt_clock(unit.anchor.start)
            )),
            _ => None,
        };
        if let Some(summary) = summary {
            out.push_str(&format!(
                "  <p class=\"summary\">{}</p>\n",
                escape_text(&sanitize_inline_text(&summary))
            ));
        }
        out.push_str(&format!(
            "  <p id=\"{}\">{}</p>\n",
            escape_attr(&unit.anchor.id),
            escape_text(&sanitize_inline_text(&unit.anchor.text)),
        ));
    }
    out.push_str("</article>\n");
    out
}

/// Recover the anchor set from an input carrier (page or outline): all `<p>` with an `id`; take the start seconds from `data-at` if present.
///
/// The agent's submit-time lint only has the payload and no document, so it uses this function to get the same anchor set as the engine.
pub fn parse_chapters_source(input: &str) -> Option<Vec<ChapterAnchor>> {
    let tree = parse_html(input);
    let format = tree
        .elements_with_attr("data-ccut-format")
        .into_iter()
        .find_map(|element| element.attr("data-ccut-format"))?;
    if format != CHAPTERS_SOURCE_FORMAT && format != CHAPTERS_OUTLINE_FORMAT {
        return None;
    }
    let anchors = tree
        .elements()
        .into_iter()
        .filter_map(|element| {
            let id = element.id()?;
            (!id.is_empty()).then(|| ChapterAnchor {
                id: id.to_owned(),
                start: element.attr("data-at").and_then(parse_clock).unwrap_or(0.0),
                text: element.text(),
            })
        })
        .collect::<Vec<_>>();
    (!anchors.is_empty()).then_some(anchors)
}

/// Row count limit for an outline payload (`chapters-outline/1`): derived from the root `data-aim`; page payloads have no limit.
pub fn outline_row_limit(payload: &str) -> Option<usize> {
    let tree = parse_html(payload);
    let root = tree
        .elements_with_attr("data-ccut-format")
        .into_iter()
        .find(|element| element.attr("data-ccut-format") == Some(CHAPTERS_OUTLINE_FORMAT))?;
    root.attr("data-aim")?
        .trim()
        .parse::<usize>()
        .ok()
        .map(max_rows_for_aim)
}

fn parse_clock(text: &str) -> Option<f64> {
    let parts = text
        .trim()
        .split(':')
        .map(|part| part.parse::<u64>().ok())
        .collect::<Option<Vec<_>>>()?;
    match parts.as_slice() {
        [minutes, seconds] => Some((minutes * 60 + seconds) as f64),
        [hours, minutes, seconds] => Some((hours * 3600 + minutes * 60 + seconds) as f64),
        _ => None,
    }
}

/// Intermediate representation: flattens the DOM into three kinds of blocks: heading, anchor, and text.
#[derive(Debug)]
enum Block {
    Heading { title: String, id: Option<String> },
    Anchor { id: String, text: String },
    Text(String),
}

fn is_heading(element: &Element) -> bool {
    matches!(
        element.tag.as_str(),
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    ) || element.has_class("title")
}

fn contains_heading(element: &Element) -> bool {
    element.descendants().into_iter().any(is_heading)
}

fn flatten(nodes: &[Node], out: &mut Vec<Block>) {
    for node in nodes {
        match node {
            Node::Text(text) => {
                let text = normalize_html_text(text);
                if !text.is_empty() {
                    out.push(Block::Text(text));
                }
            }
            Node::Element(element) => {
                if is_heading(element) {
                    out.push(Block::Heading {
                        title: element.text(),
                        id: element.id().filter(|id| !id.is_empty()).map(str::to_owned),
                    });
                } else if let Some(id) = element.id().filter(|id| !id.is_empty()) {
                    if contains_heading(element) {
                        // `<section id="p-…"><h2>…</h2>…</section>`: container form. Expand the content first, then append the container id as an anchor (ignored if the line already has an anchor).
                        flatten(&element.children, out);
                        out.push(Block::Anchor {
                            id: id.to_owned(),
                            text: String::new(),
                        });
                    } else {
                        out.push(Block::Anchor {
                            id: id.to_owned(),
                            text: element.text(),
                        });
                    }
                } else if element.has_class("summary") || element.child_elements().is_empty() {
                    let text = element.text();
                    if !text.is_empty() {
                        out.push(Block::Text(text));
                    }
                } else {
                    flatten(&element.children, out);
                }
            }
        }
    }
}

/// Normalize a snippet for comparison: single-line normalization → strip trailing ellipsis → remove all whitespace → lowercase.
fn normalize_snippet(text: &str) -> String {
    let normalized = normalize_html_text(text);
    let trimmed = normalized.trim_end_matches(['…', '.', ' ']);
    trimmed
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect()
}

fn snippet_head(text: &str) -> String {
    normalize_snippet(text)
        .chars()
        .take(SNIPPET_MATCH_MAX_CHARS)
        .collect()
}

/// Whether a snippet matches the start of a paragraph.
fn snippet_matches(anchor_text: &str, snippet: &str) -> bool {
    let head = snippet_head(snippet);
    if head.chars().count() < SNIPPET_MATCH_MIN_CHARS {
        return false;
    }
    normalize_snippet(anchor_text).starts_with(&head)
}

struct Draft {
    title: String,
    anchor: Option<(String, String)>,
    summary: Option<String>,
}

/// Chapter count ceiling guard (Reduce): allows exceeding `aim` by 20% or 2 chapters, whichever is larger.
pub fn max_rows_for_aim(aim: usize) -> usize {
    aim + (aim / 5).max(2)
}

/// Parse model output (shared by Map pages and the Reduce outline); `anchors` is the set of anchors allowed for this call.
pub fn parse_chapters_output(anchors: &[ChapterAnchor], raw: &str) -> ChaptersParsed {
    parse_chapters_output_with_limit(anchors, raw, None)
}

/// Same as [`parse_chapters_output`], but can also take a row-count limit: exceeding it raises a `chapter-overflow` issue (Reduce only copies the outline without merging, which triggers a retry; all rows are still kept for fallback use).
pub fn parse_chapters_output_with_limit(
    anchors: &[ChapterAnchor],
    raw: &str,
    max_rows: Option<usize>,
) -> ChaptersParsed {
    let mut parsed = ChaptersParsed::default();
    let normalized = normalize_llm_output(raw);
    for warning in normalized.warnings() {
        parsed.diagnostics.push_warning(warning);
    }
    let tree = parse_html(&normalized.text);
    for warning in tree.warnings() {
        parsed.diagnostics.push_warning(warning);
    }
    let mut blocks = Vec::new();
    flatten(&tree.roots, &mut blocks);

    let by_id: BTreeMap<&str, &ChapterAnchor> = anchors
        .iter()
        .map(|anchor| (anchor.id.as_str(), anchor))
        .collect();

    let mut drafts: Vec<Draft> = Vec::new();
    let mut current: Option<Draft> = None;
    let mut ignored_anchors = 0usize;
    let mut stray_anchors = 0usize;
    for block in blocks {
        match block {
            Block::Heading { title, id } => {
                if let Some(draft) = current.take() {
                    drafts.push(draft);
                }
                current = Some(Draft {
                    title,
                    anchor: id.map(|id| (id, String::new())),
                    summary: None,
                });
            }
            Block::Anchor { id, text } => match current.as_mut() {
                Some(draft) if draft.anchor.is_none() => draft.anchor = Some((id, text)),
                Some(_) => ignored_anchors += 1,
                None => stray_anchors += 1,
            },
            Block::Text(text) => {
                if let Some(draft) = current.as_mut()
                    && draft.anchor.is_none()
                    && draft.summary.is_none()
                {
                    draft.summary = Some(text);
                }
            }
        }
    }
    if let Some(draft) = current.take() {
        drafts.push(draft);
    }
    if ignored_anchors > 0 {
        parsed.diagnostics.push_warning(Warning::document(
            WarningCode::ContentIgnored,
            format!("ignored {ignored_anchors} extra anchors (each chapter keeps only the first anchor after its heading)"),
        ));
    }
    if stray_anchors > 0 {
        parsed.diagnostics.push_warning(Warning::document(
            WarningCode::ContentIgnored,
            format!("ignored {stray_anchors} anchors without a heading"),
        ));
    }

    let mut seen: BTreeMap<String, usize> = BTreeMap::new();
    for draft in drafts {
        let title = normalize_html_text(&draft.title);
        let Some((raw_id, snippet_text)) = draft.anchor else {
            parsed.diagnostics.push_problem(Problem::document(
                ProblemCode::MissingId,
                format!("heading `{title}` has no anchored paragraph — add `<p id=\"…\">` copied from the input right after it"),
            ));
            continue;
        };
        let raw_id = raw_id.trim().to_owned();
        let (anchor_id, repaired) = if let Some(anchor) = by_id.get(raw_id.as_str()) {
            if !snippet_text.is_empty() && !snippet_matches(&anchor.text, &snippet_text) {
                parsed.diagnostics.push_warning(Warning::sentence(
                    WarningCode::AnchorTextMismatch,
                    raw_id.clone(),
                    "the opening snippet on the anchor does not match the actual start of the passage; the id takes precedence",
                ));
            }
            (raw_id.clone(), false)
        } else {
            let candidates = anchors
                .iter()
                .filter(|anchor| snippet_matches(&anchor.text, &snippet_text))
                .collect::<Vec<_>>();
            match candidates.as_slice() {
                [anchor] => {
                    parsed.diagnostics.push_warning(Warning::sentence(
                        WarningCode::AnchorRepaired,
                        anchor.id.clone(),
                        format!("anchor id `{raw_id}` written by the model does not exist; repaired from the opening snippet"),
                    ));
                    (anchor.id.clone(), true)
                }
                // Unrepairable anchor: **drop that line** and record a Warning (retry strategy redesign §2.4). The other chapter lines are fully usable; re-rolling the whole page for one hallucinated anchor only burns tokens. Only when 0 lines remain is it judged page-fatal below.
                _ => {
                    parsed.diagnostics.push_warning(Warning::sentence(
                        WarningCode::ContentIgnored,
                        raw_id.clone(),
                        format!(
                            "anchor id `{raw_id}` does not exist in the input (heading `{title}`), row dropped"
                        ),
                    ));
                    continue;
                }
            }
        };
        // An empty title is likewise a line-level drop (§2.4): a chapter without a title should not drag down the whole page.
        if title.is_empty() {
            parsed.diagnostics.push_warning(Warning::sentence(
                WarningCode::ContentIgnored,
                anchor_id.clone(),
                "chapter heading is empty, row dropped",
            ));
            continue;
        }
        if let Some(previous) = seen.get(&anchor_id) {
            parsed.diagnostics.push_warning(Warning::sentence(
                WarningCode::ContentIgnored,
                anchor_id.clone(),
                format!("the same anchor appears more than once; kept the heading on line {}", previous + 1),
            ));
            continue;
        }
        seen.insert(anchor_id.clone(), parsed.rows.len());
        parsed.rows.push(ParsedChapterRow {
            title,
            anchor_id,
            summary: draft
                .summary
                .map(|summary| normalize_html_text(&summary))
                .filter(|summary| !summary.is_empty()),
            repaired,
        });
    }
    if parsed.rows.is_empty() {
        parsed.diagnostics.push_problem(Problem::document(
            ProblemCode::MissingId,
            "no chapter rows — write one `<h2>title</h2>` followed by `<p id=\"…\">opening words</p>` per chapter, ids copied from the input",
        ));
    } else if let Some(limit) = max_rows
        && parsed.rows.len() > limit
    {
        parsed.diagnostics.push_problem(Problem::document(
            ProblemCode::ChapterOverflow,
            format!(
                "{} chapters is far more than data-aim allows (at most {limit}) — merge consecutive units that belong to one topic into broader chapters instead of copying the outline",
                parsed.rows.len()
            ),
        ));
    }
    parsed
}

/// Agent submit-time lint: shares the same parser as the engine (payload = page or outline input, answer = model output).
pub fn lint_chapters_answer(payload: &str, answer: &str) -> Vec<String> {
    let Some(anchors) = parse_chapters_source(payload) else {
        return Vec::new();
    };
    parse_chapters_output_with_limit(&anchors, answer, outline_row_limit(payload))
        .diagnostics
        .problems
        .iter()
        .map(Problem::message)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn anchors() -> Vec<ChapterAnchor> {
        vec![
            ChapterAnchor {
                id: "p-g1.0".to_owned(),
                start: 0.0,
                text: "大家好，欢迎收听今天的节目，我们先聊聊开场。".to_owned(),
            },
            ChapterAnchor {
                id: "p-g20.0".to_owned(),
                start: 130.0,
                text: "接下来说说拒绝 OpenAI 的那段往事。".to_owned(),
            },
            ChapterAnchor {
                id: "p-g40.0".to_owned(),
                start: 400.0,
                text: "Now let's talk about New York and the city impression.".to_owned(),
            },
        ]
    }

    #[test]
    fn source_render_roundtrips_anchors() {
        let anchors = anchors();
        let input = ChaptersPageInput {
            part_index: 2,
            part_count: 9,
            segments: &anchors,
            range: (4324.0, 6510.0),
            total_duration: 24277.0,
            aim: 10,
            lang: "zh",
            project_fingerprint: "fp",
        };
        let html = render_chapters_source(&input);
        assert!(html.contains("<article lang=\"zh\""));
        assert!(html.contains("data-part=\"3/9\""));
        assert!(html.contains("data-aim=\"10\""));
        assert!(html.contains("data-range=\"01:12:04–01:48:30\""));
        assert!(html.contains("data-total=\"06:44:37\""));
        assert!(html.contains(
            "<p id=\"p-g20.0\" data-at=\"02:10\">接下来说说拒绝 OpenAI 的那段往事。</p>"
        ));
        let parsed = parse_chapters_source(&html).unwrap();
        assert_eq!(parsed.len(), 3);
        assert_eq!(parsed[1].id, "p-g20.0");
        assert_eq!(parsed[1].start, 130.0);
        assert_eq!(parsed[2].text, anchors[2].text);
        assert!(parse_chapters_source("<article><p id=\"x\">y</p></article>").is_none());
    }

    #[test]
    fn outline_render_marks_seams_and_untitled_units() {
        let units = vec![
            OutlineUnit {
                anchor: ChapterAnchor {
                    id: "p-g1.0".to_owned(),
                    start: 0.0,
                    text: "大家好…".to_owned(),
                },
                title: Some("开场".to_owned()),
                summary: Some("主持人开场".to_owned()),
                part_index: 0,
            },
            OutlineUnit {
                anchor: ChapterAnchor {
                    id: "p-g40.0".to_owned(),
                    start: 400.0,
                    text: "Now let's…".to_owned(),
                },
                title: None,
                summary: None,
                part_index: 1,
            },
        ];
        let html = render_chapters_outline(&units, 2, 900.0, 3, "en", "fp");
        assert!(html.contains("data-aim=\"3\""));
        assert!(html.contains("data-units=\"2\""));
        assert_eq!(outline_row_limit(&html), Some(5));
        assert!(html.contains("data-ccut-format=\"chapters-outline/1\""));
        assert!(html.contains("<hr data-seam=\"1|2\">"));
        assert!(html.contains("<h2 data-at=\"00:00\">开场</h2>"));
        assert!(html.contains("<p class=\"summary\">主持人开场</p>"));
        assert!(html.contains("<h2 data-at=\"06:40\" data-untitled=\"true\"></h2>"));
        assert!(html.contains("No summary available"));
        let parsed = parse_chapters_source(&html).unwrap();
        assert_eq!(
            parsed.iter().map(|a| a.id.as_str()).collect::<Vec<_>>(),
            ["p-g1.0", "p-g40.0"]
        );
    }

    #[test]
    fn output_parse_extracts_title_summary_and_anchor() {
        let raw = "<h2>开场</h2>\n<p class=\"summary\">主持人开场白</p>\n<p id=\"p-g1.0\">大家好，欢迎收听</p>\n<h2>纽约印象</h2>\n<p id=\"p-g40.0\">Now let's talk about New York</p>";
        let parsed = parse_chapters_output(&anchors(), raw);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.rows.len(), 2);
        assert_eq!(parsed.rows[0].title, "开场");
        assert_eq!(parsed.rows[0].summary.as_deref(), Some("主持人开场白"));
        assert_eq!(parsed.rows[0].anchor_id, "p-g1.0");
        assert_eq!(parsed.rows[1].anchor_id, "p-g40.0");
        assert!(parsed.rows[1].summary.is_none());
    }

    #[test]
    fn output_parse_tolerates_fences_sections_and_tag_variants() {
        let raw = concat!(
            "```html\n",
            "<article>\n",
            "<section id=\"p-g1.0\"><h3>开场</h3><div>主持人开场</div></section>\n",
            "<section><h2 id=\"p-g20.0\">往事</h2></section>\n",
            "<div class=\"title\">纽约</div><summary>城市</summary><span id=\"p-g40.0\">Now let's talk</span>\n",
            "</article>\n",
            "```"
        );
        let parsed = parse_chapters_output(&anchors(), raw);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        let ids: Vec<&str> = parsed
            .rows
            .iter()
            .map(|row| row.anchor_id.as_str())
            .collect();
        assert_eq!(ids, ["p-g1.0", "p-g20.0", "p-g40.0"]);
        assert_eq!(parsed.rows[0].summary.as_deref(), Some("主持人开场"));
        assert_eq!(parsed.rows[2].summary.as_deref(), Some("城市"));
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::WrapperStripped)
        );
    }

    #[test]
    fn output_parse_repairs_mangled_ids_by_snippet() {
        let raw = "<h2>往事</h2><p id=\"p-g2.0\">接下来说说拒绝 OpenAI…</p><h2>纽约</h2><p id=\"p-nope\">Now let's talk about New York</p>";
        let parsed = parse_chapters_output(&anchors(), raw);
        assert!(
            !parsed.diagnostics.has_problems(),
            "{:?}",
            parsed.diagnostics
        );
        assert_eq!(parsed.rows[0].anchor_id, "p-g20.0");
        assert!(parsed.rows[0].repaired);
        assert_eq!(parsed.rows[1].anchor_id, "p-g40.0");
        assert_eq!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .filter(|w| w.code == WarningCode::AnchorRepaired)
                .count(),
            2
        );
    }

    #[test]
    /// §2.4: unrepairable anchors and empty titles are both **line-level drops plus a Warning**; only the shape where no anchors exist at all, so no lines can be formed, remains a problem (`missing-id`).
    fn output_parse_drops_unknown_and_empty_rows_but_reports_missing_anchor() {
        let raw = "<h2>幽灵</h2><p id=\"p-ghost\">完全不存在的开头</p><h2></h2><p id=\"p-g1.0\">大家好</p><h2>没锚</h2><h2>正常</h2><p id=\"p-g40.0\">Now let's</p><p id=\"p-g20.0\">多余</p>";
        let parsed = parse_chapters_output(&anchors(), raw);
        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].title, "正常");
        assert_eq!(parsed.diagnostics.codes(), vec![ProblemCode::MissingId]);
        assert_eq!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .filter(|w| w.code == WarningCode::ContentIgnored)
                .count(),
            3,
            "ghost anchors, empty headings and extra p elements are each recorded once: {:?}",
            parsed.diagnostics.warnings
        );
        assert!(
            parsed
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::ContentIgnored)
        );
        // Snippet does not match the id: the id takes precedence, and a diagnostic is kept.
        let mismatch = parse_chapters_output(
            &anchors(),
            "<h2>A</h2><p id=\"p-g1.0\">Now let's talk about</p>",
        );
        assert_eq!(mismatch.rows[0].anchor_id, "p-g1.0");
        assert!(
            mismatch
                .diagnostics
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::AnchorTextMismatch)
        );
        // Empty output: document-level missing-id.
        let empty = parse_chapters_output(&anchors(), "Sure, here are the chapters.");
        assert!(empty.rows.is_empty());
        assert!(empty.diagnostics.has_code(ProblemCode::MissingId));
    }

    #[test]
    fn row_limit_flags_outline_copies() {
        let anchors = anchors();
        let raw = "<h2>一</h2><p id=\"p-g1.0\">大家好</p><h2>二</h2><p id=\"p-g20.0\">接下来</p><h2>三</h2><p id=\"p-g40.0\">Now let's</p>";
        assert!(
            !parse_chapters_output_with_limit(&anchors, raw, Some(3))
                .diagnostics
                .has_problems()
        );
        let over = parse_chapters_output_with_limit(&anchors, raw, Some(2));
        assert_eq!(over.rows.len(), 3, "all rows are kept for downgrade adoption");
        assert!(over.diagnostics.has_code(ProblemCode::ChapterOverflow));
        assert_eq!(max_rows_for_aim(81), 97);
        assert_eq!(max_rows_for_aim(3), 5);
        assert_eq!(
            outline_row_limit(
                "<article data-ccut-format=\"chapters-source/1\" data-aim=\"2\"></article>"
            ),
            None
        );
    }

    #[test]
    fn duplicate_anchor_keeps_first_row() {
        let raw = "<h2>一</h2><p id=\"p-g1.0\">大家好</p><h2>二</h2><p id=\"p-g1.0\">大家好</p>";
        let parsed = parse_chapters_output(&anchors(), raw);
        assert_eq!(parsed.rows.len(), 1);
        assert_eq!(parsed.rows[0].title, "一");
        assert!(!parsed.diagnostics.has_problems());
    }

    #[test]
    fn lint_uses_source_payload_as_anchor_set() {
        let anchors = anchors();
        let input = ChaptersPageInput {
            part_index: 0,
            part_count: 1,
            segments: &anchors,
            range: (0.0, 600.0),
            total_duration: 600.0,
            aim: 2,
            lang: "en",
            project_fingerprint: "fp",
        };
        let payload = render_chapters_source(&input);
        assert!(
            lint_chapters_answer(&payload, "<h2>开场</h2><p id=\"p-g1.0\">大家好</p>").is_empty()
        );
        // An unrepairable anchor drops only that line; only when 0 lines remain is `missing-id` reported.
        let problems = lint_chapters_answer(&payload, "<h2>开场</h2><p id=\"p-zzz\">谁知道</p>");
        assert_eq!(problems.len(), 1, "{problems:?}");
        assert!(problems[0].starts_with("[missing-id]"));
        assert!(lint_chapters_answer("not a chapters payload", "x").is_empty());
    }

    #[test]
    fn snippet_and_clock_helpers() {
        assert_eq!(snippet("short"), "short");
        let long = "一".repeat(60);
        let cut = snippet(&long);
        assert_eq!(cut.chars().count(), SNIPPET_CHARS + 1);
        assert!(cut.ends_with('…'));
        assert_eq!(fmt_clock(65.9), "01:05");
        assert_eq!(fmt_clock(3600.0), "01:00:00");
        assert_eq!(parse_clock("01:12:04"), Some(4324.0));
        assert_eq!(parse_clock("02:10"), Some(130.0));
        assert!(snippet_matches("Hello world, this is", "hello world…"));
        assert!(!snippet_matches("Hello world", "hey"));
    }
}

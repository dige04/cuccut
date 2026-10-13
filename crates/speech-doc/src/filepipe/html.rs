//! filepipe's HTML utility layer: escaping, tolerant parsing, allowlist sanitizing, locating by id.
//!
//! Red line: **tag names are not part of the protocol**. All locating goes through `id` / `data-*` attributes;
//! parse results only extract structure and never execute any HTML.

use std::collections::{BTreeMap, BTreeSet};

use html5ever::tendril::TendrilSink;
use html5ever::{ParseOpts, QualName, local_name, ns, parse_document, parse_fragment};
use markup5ever_rcdom::{Handle, NodeData, RcDom};

use crate::engines::markers::collapse_cjk_spaces;

use super::common::{Warning, WarningCode};

/// Unsafe elements that are dropped (§16).
const DROPPED_TAGS: &[&str] = &[
    "script", "style", "iframe", "object", "embed", "applet", "link", "meta", "base", "frame",
    "frameset", "noscript",
];

/// Allowlisted attributes to keep; in addition, `data-*` is always kept, and all others are dropped.
const ALLOWED_ATTRS: &[&str] = &["id", "class", "lang", "scope", "rowspan", "colspan"];

/// Escapes text node content (`&`, `<`, `>`).
pub fn escape_text(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            c => output.push(c),
        }
    }
    output
}

/// Escapes attribute values (on top of [`escape_text`], also adds quotes).
pub fn escape_attr(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            c => output.push(c),
        }
    }
    output
}

/// A sanitized DOM node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Node {
    /// An element node.
    Element(Element),
    /// A text node.
    Text(String),
}

/// A sanitized element node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Element {
    /// Lowercased tag name (for diagnostics only, not used in protocol decisions).
    pub tag: String,
    /// Allowlisted attributes (attribute names lowercased).
    pub attrs: BTreeMap<String, String>,
    /// Child nodes.
    pub children: Vec<Node>,
}

impl Element {
    /// Reads an attribute.
    pub fn attr(&self, name: &str) -> Option<&str> {
        self.attrs.get(name).map(String::as_str)
    }

    /// Reads `id`.
    pub fn id(&self) -> Option<&str> {
        self.attr("id")
    }

    /// Whether it has a given class (whitespace-separated, byte-for-byte match).
    pub fn has_class(&self, class: &str) -> bool {
        self.attr("class")
            .is_some_and(|value| value.split_whitespace().any(|item| item == class))
    }

    /// Descendant text concatenated as-is.
    pub fn raw_text(&self) -> String {
        let mut output = String::new();
        collect_text(&self.children, &mut output);
        output
    }

    /// Normalized descendant text: collapses whitespace and removes spaces between CJK characters.
    pub fn text(&self) -> String {
        normalize_html_text(&self.raw_text())
    }

    /// Direct child elements.
    pub fn child_elements(&self) -> Vec<&Element> {
        self.children
            .iter()
            .filter_map(|node| match node {
                Node::Element(element) => Some(element),
                Node::Text(_) => None,
            })
            .collect()
    }

    /// All descendant elements in pre-order (excluding self).
    pub fn descendants(&self) -> Vec<&Element> {
        let mut output = Vec::new();
        collect_elements(&self.children, &mut output);
        output
    }
}

/// HTML text normalization: collapses whitespace, then removes spaces between CJK characters.
pub fn normalize_html_text(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    collapse_cjk_spaces(&collapsed)
}

fn collect_text(nodes: &[Node], output: &mut String) {
    for node in nodes {
        match node {
            Node::Text(text) => output.push_str(text),
            Node::Element(element) => {
                collect_text(&element.children, output);
            }
        }
    }
}

fn collect_elements<'a>(nodes: &'a [Node], output: &mut Vec<&'a Element>) {
    for node in nodes {
        if let Node::Element(element) = node {
            output.push(element);
            collect_elements(&element.children, output);
        }
    }
}

/// The sanitized document tree.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct HtmlTree {
    /// Top-level nodes.
    pub roots: Vec<Node>,
    /// Dropped unsafe tag names.
    pub dropped_tags: BTreeSet<String>,
    /// Dropped non-allowlisted attribute names.
    pub dropped_attrs: BTreeSet<String>,
}

impl HtmlTree {
    /// All elements in pre-order.
    pub fn elements(&self) -> Vec<&Element> {
        let mut output = Vec::new();
        collect_elements(&self.roots, &mut output);
        output
    }

    /// Selects elements by attribute name (pre-order).
    pub fn elements_with_attr(&self, name: &str) -> Vec<&Element> {
        self.elements()
            .into_iter()
            .filter(|element| element.attrs.contains_key(name))
            .collect()
    }

    /// Normalized text of the whole document.
    pub fn text(&self) -> String {
        let mut output = String::new();
        collect_text(&self.roots, &mut output);
        normalize_html_text(&output)
    }

    /// Converts sanitize actions into diagnostic items.
    pub fn warnings(&self) -> Vec<Warning> {
        let mut warnings = Vec::new();
        if !self.dropped_tags.is_empty() {
            warnings.push(Warning::document(
                WarningCode::NodeDropped,
                format!(
                    "Dropped unsafe nodes: {}",
                    self.dropped_tags
                        .iter()
                        .cloned()
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            ));
        }
        if !self.dropped_attrs.is_empty() {
            warnings.push(Warning::document(
                WarningCode::AttributeDropped,
                format!(
                    "Dropped attributes not on the allowlist: {}",
                    self.dropped_attrs
                        .iter()
                        .cloned()
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            ));
        }
        warnings
    }
}

/// Parses in document mode with tolerance, then sanitizes.
pub fn parse_html(input: &str) -> HtmlTree {
    let dom = parse_document(RcDom::default(), ParseOpts::default()).one(input);
    build_tree(&dom.document)
}

/// Parses in `<table>` fragment context: in document mode the whole fragment is dropped when the model returns only `<tbody>`/`<tr>`.
pub fn parse_html_in_table(input: &str) -> HtmlTree {
    let context = QualName::new(None, ns!(html), local_name!("table"));
    let dom = parse_fragment(
        RcDom::default(),
        ParseOpts::default(),
        context,
        Vec::new(),
        false,
    )
    .one(input);
    build_tree(&dom.document)
}

fn build_tree(handle: &Handle) -> HtmlTree {
    let mut tree = HtmlTree::default();
    let mut nodes = Vec::new();
    convert_children(handle, &mut nodes, &mut tree);
    tree.roots = nodes;
    tree
}

fn convert_children(handle: &Handle, output: &mut Vec<Node>, tree: &mut HtmlTree) {
    for child in handle.children.borrow().iter() {
        match &child.data {
            NodeData::Text { contents } => {
                let text = contents.borrow().to_string();
                if !text.is_empty() {
                    output.push(Node::Text(text));
                }
            }
            NodeData::Element { name, attrs, .. } => {
                let tag = name.local.to_string().to_ascii_lowercase();
                if DROPPED_TAGS.contains(&tag.as_str()) {
                    tree.dropped_tags.insert(tag);
                    continue;
                }
                let mut kept = BTreeMap::new();
                for attr in attrs.borrow().iter() {
                    let key = attr.name.local.to_string().to_ascii_lowercase();
                    if ALLOWED_ATTRS.contains(&key.as_str()) || key.starts_with("data-") {
                        kept.insert(key, attr.value.to_string());
                    } else {
                        tree.dropped_attrs.insert(key);
                    }
                }
                let mut children = Vec::new();
                convert_children(child, &mut children, tree);
                // `html`/`head`/`body` are skeleton elements the parser adds; their children are promoted directly,
                // so the protocol layer only deals with content elements.
                if matches!(tag.as_str(), "html" | "head" | "body") && kept.is_empty() {
                    output.extend(children);
                } else {
                    output.push(Node::Element(Element {
                        tag,
                        attrs: kept,
                        children,
                    }));
                }
            }
            NodeData::Document | NodeData::Doctype { .. } => {
                convert_children(child, output, tree);
            }
            NodeData::Comment { .. } | NodeData::ProcessingInstruction { .. } => {}
        }
    }
}

/// Builds an index by `id` (exact byte match, no case folding).
///
/// Returns `(index, duplicated ids)`; for duplicate ids only the first occurrence is kept.
pub fn index_by_id(tree: &HtmlTree) -> (BTreeMap<String, &Element>, Vec<String>) {
    let mut index: BTreeMap<String, &Element> = BTreeMap::new();
    let mut duplicates = Vec::new();
    for element in tree.elements() {
        let Some(id) = element.id() else { continue };
        if id.is_empty() {
            continue;
        }
        if index.contains_key(id) {
            if !duplicates.iter().any(|item| item == id) {
                duplicates.push(id.to_owned());
            }
            continue;
        }
        index.insert(id.to_owned(), element);
    }
    (index, duplicates)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escaping_covers_html_specials() {
        assert_eq!(escape_text("a<b>&\"c\""), "a&lt;b&gt;&amp;\"c\"");
        assert_eq!(escape_attr("a<b>&\"c'"), "a&lt;b&gt;&amp;&quot;c&#39;");
    }

    #[test]
    fn parse_drops_unsafe_nodes_and_attributes() {
        let tree = parse_html(
            r#"<article><script>alert(1)</script><p id="s-1" onclick="x()" href="http://evil">hi</p></article>"#,
        );
        let (index, duplicates) = index_by_id(&tree);
        assert!(duplicates.is_empty());
        let paragraph = index.get("s-1").unwrap();
        assert_eq!(paragraph.text(), "hi");
        assert_eq!(paragraph.attr("onclick"), None);
        assert_eq!(paragraph.attr("href"), None);
        assert!(tree.dropped_tags.contains("script"));
        assert!(tree.dropped_attrs.contains("onclick"));
        assert!(!tree.text().contains("alert"));
    }

    #[test]
    fn parse_keeps_data_attributes_and_entities() {
        let tree = parse_html(r#"<p id="s-1" data-editable="false">a &lt;b&gt; &amp; c</p>"#);
        let (index, _) = index_by_id(&tree);
        let paragraph = index.get("s-1").unwrap();
        assert_eq!(paragraph.attr("data-editable"), Some("false"));
        assert_eq!(paragraph.text(), "a <b> & c");
    }

    #[test]
    fn table_fragment_context_keeps_rows() {
        let bare = r#"<tbody data-sid="s-1"><tr><td class="tgt">译文</td></tr></tbody>"#;
        let document_mode = parse_html(bare);
        assert!(document_mode.elements_with_attr("data-sid").is_empty());
        let fragment_mode = parse_html_in_table(bare);
        assert_eq!(fragment_mode.elements_with_attr("data-sid").len(), 1);
    }

    #[test]
    fn duplicate_ids_are_reported_once() {
        let tree = parse_html(r#"<p id="s-1">a</p><p id="s-1">b</p><p id="s-1">c</p>"#);
        let (index, duplicates) = index_by_id(&tree);
        assert_eq!(duplicates, vec!["s-1".to_owned()]);
        assert_eq!(index.get("s-1").unwrap().text(), "a");
    }

    #[test]
    fn text_collapses_pretty_printing_and_cjk_gaps() {
        let tree = parse_html("<p id=\"s-1\">\n  你好\n  世界\n</p>");
        let (index, _) = index_by_id(&tree);
        assert_eq!(index.get("s-1").unwrap().text(), "你好世界");
        let latin = parse_html("<p id=\"s-2\">\n  hello\n  world\n</p>");
        let (latin_index, _) = index_by_id(&latin);
        assert_eq!(latin_index.get("s-2").unwrap().text(), "hello world");
    }

    #[test]
    fn ids_are_matched_byte_exactly() {
        let tree = parse_html(r#"<p id="S-G1.0">a</p><p id="s-g1.0">b</p>"#);
        let (index, duplicates) = index_by_id(&tree);
        assert!(duplicates.is_empty());
        assert_eq!(index.get("s-g1.0").unwrap().text(), "b");
        assert_eq!(index.get("S-G1.0").unwrap().text(), "a");
    }
}

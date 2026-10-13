/*!
 * Addressing layer for element paths and edit provenance (BCF direct-edit write-back plan §4.3).
 *
 * What the stage hit-tests on the canvas is the node after resolve, but write-back has to land on the node the author wrote in the TSX, with the component expansion of `Resolver::expand_node` and the minting of derived ids in between. This module defines the address scheme shared by the two-hop mapping:
 *
 * 1. **Element path** (`path`): a `/`-separated segment string starting from the clip root element. Each segment is the child's `id` (non-empty, no `/`, and unique among its siblings), otherwise it falls back to `#<index>`. The root element itself is the empty string. Preferring the id is deliberate: the author reordering the array should not cause a pending edit request to mismatch.
 * 2. **JSON pointer** (`pointer`): the absolute position in the compiled output, of the form `tracks/0/clips/2/element/children/1/style/x` (no leading `/`, arrays by index). Edit-map entries and the target of W2 surgery both go by it.
 *
 * The client says `(clip, path, prop)`, and the server folds it into a pointer with [`locate_element`], then looks up the edit-map to decide which channel to take. The reverse direction (pointer → path) is not provided: the pointer is the precise internal coordinate of the implementation, and exposing it to consumers would let them reverse-parse array indices.
 */

use serde_json::Value;

use crate::json::JsonExt;

/// Prefix for index segments in an element path. `#` is not a legal first character for an id, so the two segment forms cannot collide.
pub const INDEX_PREFIX: char = '#';

/// The path segment of a single child among its siblings: uses the id if it has a stable one, otherwise `#<index>`.
///
/// "Stable" means non-empty, contains no `/`, does not start with `#`, and is unique within `siblings`. When siblings share a name, both nodes fall back to index segments (otherwise one path would point at two nodes).
pub fn path_segment(siblings: &[Value], index: usize) -> String {
    let fallback = format!("{INDEX_PREFIX}{index}");
    let Some(node) = siblings.get(index) else {
        return fallback;
    };
    let Some(id) = stable_id(node) else {
        return fallback;
    };
    let unique = siblings
        .iter()
        .enumerate()
        .all(|(i, other)| i == index || stable_id(other) != Some(id));
    if unique { id.to_string() } else { fallback }
}

/// An id usable as a path segment: non-empty, contains no `/`, does not start with `#`.
pub fn stable_id(node: &Value) -> Option<&str> {
    let id = node.gstr("id")?;
    if id.is_empty() || id.contains('/') || id.starts_with(INDEX_PREFIX) {
        return None;
    }
    Some(id)
}

/// Joining element paths: `join_path("", "title") == "title"`.
pub fn join_path(base: &str, segment: &str) -> String {
    if base.is_empty() {
        segment.to_string()
    } else {
        format!("{base}/{segment}")
    }
}

/// Joins JSON pointer segments (same as `join_path`; a separate name is used so the call site makes clear which kind of address is being built).
pub fn join_pointer(base: &str, segment: &str) -> String {
    join_path(base, segment)
}

/// Dot path of `prop` → pointer segments (`style.x` → `style/x`).
pub fn prop_pointer(prop: &str) -> String {
    prop.replace('.', "/")
}

/// Fetch a value by JSON pointer (no leading `/`, arrays by index).
pub fn value_at<'a>(doc: &'a Value, pointer: &str) -> Option<&'a Value> {
    let mut cur = doc;
    if pointer.is_empty() {
        return Some(cur);
    }
    for seg in pointer.split('/') {
        cur = match cur {
            Value::Object(map) => map.get(seg)?,
            Value::Array(items) => items.get(seg.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    Some(cur)
}

/// clip id → its `element` pointer in the compiled output (`tracks/<i>/clips/<j>/element`).
pub fn locate_clip_element(doc: &Value, clip: &str) -> Option<String> {
    let tracks = doc.get_("tracks")?.as_array()?;
    for (ti, track) in tracks.iter().enumerate() {
        let clips = track.get_("clips").and_then(Value::as_array)?;
        for (ci, c) in clips.iter().enumerate() {
            if c.gstr("id") == Some(clip) && c.get_("element").is_some() {
                return Some(format!("tracks/{ti}/clips/{ci}/element"));
            }
        }
    }
    None
}

/// `(clip, element path)` → JSON pointer in the compiled output.
///
/// Path segments accept both ids and `#<index>`. To stay compatible with hand-written targets, a purely numeric segment is tried again as an index after id matching fails (the example in plan §3 is written as `cards/1/value`).
pub fn locate_element(doc: &Value, clip: &str, path: &str) -> Option<String> {
    let mut pointer = locate_clip_element(doc, clip)?;
    if path.is_empty() {
        return Some(pointer);
    }
    let mut node = value_at(doc, &pointer)?.clone();
    for seg in path.split('/') {
        let empty = Vec::new();
        let children = node
            .get_("children")
            .and_then(Value::as_array)
            .unwrap_or(&empty);
        let index = child_index(children, seg)?;
        pointer = format!("{pointer}/children/{index}");
        node = children[index].clone();
    }
    Some(pointer)
}

/// The index of a path segment within its sibling array.
fn child_index(children: &[Value], segment: &str) -> Option<usize> {
    if let Some(rest) = segment.strip_prefix(INDEX_PREFIX) {
        return rest.parse::<usize>().ok().filter(|i| *i < children.len());
    }
    let by_id = children
        .iter()
        .enumerate()
        .filter(|(i, _)| path_segment(children, *i) == segment)
        .map(|(i, _)| i)
        .collect::<Vec<_>>();
    if by_id.len() == 1 {
        return Some(by_id[0]);
    }
    // Fallback: bare numeric segments are treated as indices (the `cards/1/value` form in the plan's example)
    segment
        .parse::<usize>()
        .ok()
        .filter(|i| *i < children.len())
}

/// All paths of an element tree in the compiled output (depth-first, root first).
pub fn element_paths(root: &Value) -> Vec<String> {
    let mut out = Vec::new();
    walk_paths(root, String::new(), &mut out);
    out
}

fn walk_paths(node: &Value, path: String, out: &mut Vec<String>) {
    out.push(path.clone());
    let empty = Vec::new();
    let children = node
        .get_("children")
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    for i in 0..children.len() {
        let seg = path_segment(children, i);
        walk_paths(&children[i], join_path(&path, &seg), out);
    }
}

/// Author provenance of a stage node (recorded as a side effect when `resolve` mints derived ids, plan §4.3-2).
///
/// Consumers use it to map a resolved hit back to the **node the author wrote**. A non-empty `component` means this node is a product of component expansion: W2 surgery never applies, and it can only go to W3.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NodeOrigin {
    /// Element path of the author node. Nodes **inside** a component count from the component root; per-instance wrappers (synthetic boxes minted by the compiler) stay in clip space, and the value is the path of the `use` node itself.
    pub authored: String,
    /// Component name (present only for component-expansion products).
    pub component: Option<String>,
    /// Instantiation point: the element path of the `use` node itself (from the clip root).
    pub site: Option<String>,
    /// `use.each` expansion index.
    pub index: Option<usize>,
}

impl NodeOrigin {
    /// Author node written directly in the clip element tree.
    pub fn authored(path: impl Into<String>) -> Self {
        Self {
            authored: path.into(),
            ..Default::default()
        }
    }

    /// Component expansion product: `site` is the use-node path, `authored` is the path inside the component root.
    pub fn derived(
        component: impl Into<String>,
        site: impl Into<String>,
        index: usize,
        authored: impl Into<String>,
    ) -> Self {
        Self {
            authored: authored.into(),
            component: Some(component.into()),
            site: Some(site.into()),
            index: Some(index),
        }
    }

    /// Derived nodes cannot undergo literal surgery (plan §4.3-2: if they cannot be folded back to the author node, they are classed as derived).
    pub fn is_derived(&self) -> bool {
        self.component.is_some()
    }

    /// JSON identical in shape to the `_origin` of the preview shell's `resolve.js` (for mirror cross-checking).
    pub fn to_json(&self) -> Value {
        let mut map = serde_json::Map::new();
        map.insert("authored".into(), Value::String(self.authored.clone()));
        if let Some(c) = &self.component {
            map.insert("component".into(), Value::String(c.clone()));
        }
        if let Some(s) = &self.site {
            map.insert("site".into(), Value::String(s.clone()));
        }
        if let Some(i) = self.index {
            map.insert("index".into(), Value::Number((i as u64).into()));
        }
        Value::Object(map)
    }
}

/// A row of the reverse-lookup table: stage resolved position → author node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OriginEntry {
    /// Element path within the resolved tree (same segment rules, but over the expanded tree).
    pub resolved: String,
    /// Resolved node id (may be duplicated: multiple component instances share the component root id, so it is not used as a key).
    pub id: String,
    pub origin: NodeOrigin,
}

impl OriginEntry {
    pub fn to_json(&self) -> Value {
        serde_json::json!({
            "resolved": self.resolved,
            "id": self.id,
            "origin": self.origin.to_json(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn doc() -> Value {
        json!({
            "tracks": [
                {"id": "bg", "kind": "visual", "clips": [
                    {"id": "back", "element": {"type": "box", "id": "root"}}
                ]},
                {"id": "main", "kind": "visual", "clips": [
                    {"id": "problem-shot", "element": {"type": "box", "id": "root", "children": [
                        {"type": "text", "id": "title", "text": "hi", "style": {"x": 180}},
                        {"type": "box", "id": "cards", "children": [
                            {"type": "text", "text": "a"},
                            {"type": "text", "text": "b"}
                        ]},
                        {"type": "box", "id": "dup"},
                        {"type": "box", "id": "dup"}
                    ]}}
                ]}
            ]
        })
    }

    #[test]
    fn segments_prefer_ids_and_fall_back_to_indices() {
        let children = doc()["tracks"][1]["clips"][0]["element"]["children"]
            .as_array()
            .unwrap()
            .clone();
        assert_eq!(path_segment(&children, 0), "title");
        assert_eq!(path_segment(&children, 1), "cards");
        // Same-level name collision: both fall back to index segments
        assert_eq!(path_segment(&children, 2), "#2");
        assert_eq!(path_segment(&children, 3), "#3");
    }

    #[test]
    fn locate_element_walks_ids_indices_and_bare_numbers() {
        let d = doc();
        assert_eq!(
            locate_element(&d, "problem-shot", "").unwrap(),
            "tracks/1/clips/0/element"
        );
        assert_eq!(
            locate_element(&d, "problem-shot", "title").unwrap(),
            "tracks/1/clips/0/element/children/0"
        );
        assert_eq!(
            locate_element(&d, "problem-shot", "cards/#1").unwrap(),
            "tracks/1/clips/0/element/children/1/children/1"
        );
        // Bare numeric segment from the plan example
        assert_eq!(
            locate_element(&d, "problem-shot", "cards/1").unwrap(),
            "tracks/1/clips/0/element/children/1/children/1"
        );
        assert_eq!(locate_element(&d, "problem-shot", "nope"), None);
        assert_eq!(locate_element(&d, "missing-clip", ""), None);
    }

    #[test]
    fn value_at_reads_object_and_array_segments() {
        let d = doc();
        let pointer = locate_element(&d, "problem-shot", "title").unwrap();
        let x = value_at(&d, &format!("{pointer}/{}", prop_pointer("style.x"))).unwrap();
        assert_eq!(x, &json!(180));
        assert!(value_at(&d, "tracks/9/clips").is_none());
        assert_eq!(value_at(&d, "").unwrap(), &d);
    }

    #[test]
    fn element_paths_enumerates_the_tree_depth_first() {
        let root = &doc()["tracks"][1]["clips"][0]["element"];
        assert_eq!(
            element_paths(root),
            vec![
                "".to_string(),
                "title".into(),
                "cards".into(),
                "cards/#0".into(),
                "cards/#1".into(),
                "#2".into(),
                "#3".into(),
            ]
        );
    }
}

use serde_json::Value;

use crate::schema::{Element, Track, TrackKind};
use crate::{TimelineDocument, TimelineError};

fn element_locations(
    document: &TimelineDocument,
) -> impl Iterator<Item = (usize, usize, &Element)> {
    document
        .tracks
        .iter()
        .enumerate()
        .flat_map(|(track_index, track)| {
            track
                .elements
                .iter()
                .enumerate()
                .map(move |(element_index, element)| (track_index, element_index, element))
        })
}

pub fn resolve_element_id(
    document: &TimelineDocument,
    selector: &str,
) -> Result<String, TimelineError> {
    if selector.is_empty() {
        return Err(TimelineError::Invalid(
            "element selector 不能为空".to_owned(),
        ));
    }
    if let Some((_, _, element)) =
        element_locations(document).find(|(_, _, element)| element.id == selector)
    {
        return Ok(element.id.clone());
    }
    let prefix = element_locations(document)
        .filter(|(_, _, element)| element.id.starts_with(selector))
        .map(|(_, _, element)| element.id.clone())
        .collect::<Vec<_>>();
    if prefix.len() == 1 {
        return Ok(prefix[0].clone());
    }
    if prefix.len() > 1 {
        return Err(TimelineError::Ambiguous(format!(
            "element 前缀 {selector} 匹配 {prefix:?}"
        )));
    }
    let names = element_locations(document)
        .filter(|(_, _, element)| element.name.as_deref() == Some(selector))
        .map(|(_, _, element)| element.id.clone())
        .collect::<Vec<_>>();
    match names.as_slice() {
        [id] => Ok(id.clone()),
        [] => Err(TimelineError::Unmapped(selector.to_owned())),
        _ => Err(TimelineError::Ambiguous(format!(
            "element name {selector} 匹配 {names:?}"
        ))),
    }
}

pub fn add_element(
    document: &mut TimelineDocument,
    track_id: &str,
    track_name: Option<String>,
    element: Element,
) -> Result<usize, TimelineError> {
    if document
        .tracks
        .iter()
        .flat_map(|track| &track.elements)
        .any(|candidate| candidate.id == element.id)
    {
        return Err(TimelineError::Invalid(format!("重复 id：{}", element.id)));
    }
    let required_kind = if element.kind == crate::schema::ElementKind::Audio {
        TrackKind::Audio
    } else {
        TrackKind::Overlay
    };
    let track_index = if let Some(index) = document
        .tracks
        .iter()
        .position(|track| track.id == track_id)
    {
        let track = &document.tracks[index];
        if track.locked {
            return Err(TimelineError::Invalid(format!("track {} 已锁定", track.id)));
        }
        if track.kind != required_kind {
            return Err(TimelineError::Invalid(format!(
                "track {} kind 与 element {} 不匹配",
                track.id, element.id
            )));
        }
        index
    } else {
        document.tracks.push(Track {
            id: track_id.to_owned(),
            kind: required_kind,
            name: track_name,
            hidden: false,
            locked: false,
            muted: false,
            elements: Vec::new(),
        });
        document.tracks.len() - 1
    };
    document.tracks[track_index].elements.push(element);
    document.validate()?;
    Ok(document.tracks[track_index].elements.len() - 1)
}

/// RFC 7396 JSON Merge Patch: objects merge key by key, `null` deletes a key, scalars are replaced wholesale.
///
/// When the target position does not yet exist (or is not an object) and the patch is an object, you must **first create an empty object, then merge key by key**.
/// Do not copy the patch over as-is — copying would carry the `null` that means "delete this key" into the target along with the key,
/// and deserializing into a strongly typed field such as `BTreeMap<String, String>` would then blow up with
/// `invalid type: null, expected a string` (this is exactly what happens when a sticker's colour is first changed,
/// because `sticker.fillOverrides` does not exist yet).
pub fn merge_patch(target: &mut Value, patch: &Value) {
    let Value::Object(patch) = patch else {
        *target = patch.clone();
        return;
    };
    if !target.is_object() {
        *target = Value::Object(serde_json::Map::new());
    }
    let Value::Object(target) = target else {
        unreachable!("刚刚已保证 target 是对象");
    };
    for (key, value) in patch {
        if value.is_null() {
            target.remove(key);
        } else {
            merge_patch(target.entry(key.clone()).or_insert(Value::Null), value);
        }
    }
}

pub fn patch_element(
    document: &mut TimelineDocument,
    selector: &str,
    patch: &Value,
) -> Result<Element, TimelineError> {
    let id = resolve_element_id(document, selector)?;
    let (track_index, element_index, _) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .expect("resolved element exists");
    if document.tracks[track_index].locked {
        return Err(TimelineError::Invalid(format!(
            "track {} 已锁定",
            document.tracks[track_index].id
        )));
    }
    if patch.get("id").is_some() || patch.get("kind").is_some() {
        return Err(TimelineError::Invalid(
            "element patch 不允许修改 id/kind".to_owned(),
        ));
    }
    let mut value = serde_json::to_value(&document.tracks[track_index].elements[element_index])
        .map_err(|error| TimelineError::Invalid(error.to_string()))?;
    merge_patch(&mut value, patch);
    let updated: Element = serde_json::from_value(value)
        .map_err(|error| TimelineError::Invalid(format!("element patch 非法：{error}")))?;
    document.tracks[track_index].elements[element_index] = updated.clone();
    document.validate()?;
    Ok(updated)
}

pub fn replace_element(
    document: &mut TimelineDocument,
    selector: &str,
    replacement: Element,
) -> Result<Element, TimelineError> {
    let id = resolve_element_id(document, selector)?;
    if replacement.id != id {
        return Err(TimelineError::Invalid(
            "replacement 必须保留 element id".to_owned(),
        ));
    }
    let (track_index, element_index, _) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .expect("resolved element exists");
    if document.tracks[track_index].locked {
        return Err(TimelineError::Invalid(format!(
            "track {} 已锁定",
            document.tracks[track_index].id
        )));
    }
    document.tracks[track_index].elements[element_index] = replacement.clone();
    document.validate()?;
    Ok(replacement)
}

pub fn remove_element(
    document: &mut TimelineDocument,
    selector: &str,
) -> Result<Element, TimelineError> {
    let id = resolve_element_id(document, selector)?;
    let (track_index, element_index, _) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .expect("resolved element exists");
    if document.tracks[track_index].locked {
        return Err(TimelineError::Invalid(format!(
            "track {} 已锁定",
            document.tracks[track_index].id
        )));
    }
    Ok(document.tracks[track_index].elements.remove(element_index))
}

/// Reordering an element **within its track** (z order = `tracks[]` order × in-track `elements[]` order; this function
/// only moves the latter; cross-track layering belongs to `moveTrack`). `to` is the 0-based target index in the same track's `elements[]` —
/// the same convention as `moveTrack`: "move up one layer" means moving **later** in the array, the direction is converted into an index by the client,
/// and this function only accepts the index. Returns `(element id, track id, original index)`.
pub fn reorder_element(
    document: &mut TimelineDocument,
    selector: &str,
    to: usize,
) -> Result<(String, String, usize), TimelineError> {
    let id = resolve_element_id(document, selector)?;
    let (track_index, element_index, _) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .expect("resolved element exists");
    let track = &document.tracks[track_index];
    if track.locked {
        return Err(TimelineError::Invalid(format!("track {} 已锁定", track.id)));
    }
    if to >= track.elements.len() {
        return Err(TimelineError::Invalid(format!(
            "reorder 目标下标越界：{to}（track {} 共 {} 个元素）",
            track.id,
            track.elements.len()
        )));
    }
    let track_id = track.id.clone();
    if to != element_index {
        let element = document.tracks[track_index].elements.remove(element_index);
        document.tracks[track_index].elements.insert(to, element);
    }
    Ok((id, track_id, element_index))
}

/// Moves an element to **another** existing track, landing at index `to` on the target track (the later in the array, the higher the layer;
/// `to == number of elements on the target track` = topmost). When the target track is the original track, it is equivalent to [`reorder_element`].
///
/// Neither track may be locked; the target track must already exist (moving into a non-existent track is almost always a typo, unlike
/// [`add_element`], which creates tracks along the way), and the kind must be compatible with the element (audio elements go only into audio tracks).
/// Returns `(element id, original track id, original index within that track)`.
pub fn move_element_to_track(
    document: &mut TimelineDocument,
    selector: &str,
    track_id: &str,
    to: usize,
) -> Result<(String, String, usize), TimelineError> {
    let id = resolve_element_id(document, selector)?;
    let (from_track, from_index, element) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .map(|(track, index, element)| (track, index, element.kind))
        .expect("resolved element exists");
    let Some(target) = document
        .tracks
        .iter()
        .position(|track| track.id == track_id)
    else {
        return Err(TimelineError::Unmapped(format!("track {track_id}")));
    };
    if target == from_track {
        return reorder_element(document, &id, to);
    }
    for index in [from_track, target] {
        let track = &document.tracks[index];
        if track.locked {
            return Err(TimelineError::Invalid(format!("track {} 已锁定", track.id)));
        }
    }
    let required_kind = if element == crate::schema::ElementKind::Audio {
        TrackKind::Audio
    } else {
        TrackKind::Overlay
    };
    if document.tracks[target].kind != required_kind {
        return Err(TimelineError::Invalid(format!(
            "track {} kind 与 element {id} 不匹配",
            document.tracks[target].id
        )));
    }
    let length = document.tracks[target].elements.len();
    if to > length {
        return Err(TimelineError::Invalid(format!(
            "move 目标下标越界：{to}（track {} 共 {length} 个元素）",
            document.tracks[target].id
        )));
    }
    let from_track_id = document.tracks[from_track].id.clone();
    let moved = document.tracks[from_track].elements.remove(from_index);
    document.tracks[target].elements.insert(to, moved);
    document.validate()?;
    Ok((id, from_track_id, from_index))
}

pub fn patch_main(
    document: &mut TimelineDocument,
    patch: &Value,
) -> Result<crate::schema::Main, TimelineError> {
    if !patch.is_object() {
        return Err(TimelineError::Invalid("main patch 须为 object".to_owned()));
    }
    let mut value = document
        .main
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|error| TimelineError::Invalid(error.to_string()))?
        .unwrap_or_else(|| serde_json::json!({}));
    merge_patch(&mut value, patch);
    let updated: crate::schema::Main = serde_json::from_value(value)
        .map_err(|error| TimelineError::Invalid(format!("main patch 非法：{error}")))?;
    document.main = Some(updated.clone());
    document.validate()?;
    Ok(updated)
}

// ---------------------------------------------------------------------------
// Splitting / trimming / joining elements: clock arithmetic and join criteria
// ---------------------------------------------------------------------------
//
// The App / Web timeline gestures (`ccut-editor-core::timeline_edit`) and `ccut element
// split|trim|join` share the arithmetic here: playback rate, the source in-point after a left trim, and whether a cut point leaves
// room for both halves. There is only one copy of this.

/// Playback rate of a media element (source seconds consumed per timeline second): if absent, non-finite or not positive, it is 1×.
pub fn media_play_rate(rate: Option<f64>) -> f64 {
    match rate {
        Some(rate) if rate.is_finite() && rate > 0.0 => rate,
        _ => 1.0,
    }
}

/// Kinds with a source clock: when cutting or trimming the left edge, `srcStart` advances along with it (`video` / `audio`).
pub fn carries_source_clock(kind: crate::schema::ElementKind) -> bool {
    matches!(
        kind,
        crate::schema::ElementKind::Video | crate::schema::ElementKind::Audio
    )
}

/// The new `srcStart` of an element after its start on the timeline moves from `old_start` to `new_start`:
/// every timeline second burns `rate` source seconds. Not clamped; callers that need clamping to ≥ 0 must clamp themselves.
pub fn shifted_src_start(src_start: f64, old_start: f64, new_start: f64, rate: f64) -> f64 {
    src_start + (new_start - old_start) * rate
}

/// Whether cutting `[start, end)` at `at` leaves both halves no shorter than `minimum` (a negative number counts as 0):
/// `start + minimum ≤ at ≤ end − minimum`; when `end` is absent (follows the tail), only the left boundary is checked.
pub fn split_point_inside(start: f64, end: Option<f64>, at: f64, minimum: f64) -> bool {
    let minimum = minimum.max(0.0);
    at.is_finite() && at >= start + minimum && end.is_none_or(|end| at <= end - minimum)
}

/// Cuts an element into two halves at timeline moment `at`: the original (id unchanged) has its `end` changed to `at`; the right half is a
/// complete copy of the original, given `new_id`, `start = at`, and `end` copied as-is (if the original follows the tail, the right half also follows the tail),
/// placed right next to the original on top of it (same track, index +1, so the z order matches the App split). For kinds with a source clock,
/// the right half's `srcStart` advances by `(at − start) × rate`.
///
/// Keyframes (0.12) are rewritten for each half's new window ([`crate::keyframes::split_keyframes`]); ducking, static volume and other
/// properties are copied as-is to both halves.
///
/// `start` / `end` are the resolved start and end of the original (word anchors already resolved; tail-following resolved to the tail). Whether the cut point leaves
/// room for both halves is checked by the caller with [`split_point_inside`]. Returns the right half.
pub fn split_element(
    document: &mut TimelineDocument,
    selector: &str,
    (start, end): (f64, f64),
    at: f64,
    new_id: &str,
) -> Result<Element, TimelineError> {
    use crate::schema::TimeValue;

    let id = resolve_element_id(document, selector)?;
    if new_id.is_empty() || element_locations(document).any(|(_, _, el)| el.id == new_id) {
        return Err(TimelineError::Invalid(format!(
            "element id 已被占用：{new_id}"
        )));
    }
    let (track_index, element_index, _) = element_locations(document)
        .find(|(_, _, element)| element.id == id)
        .expect("resolved element exists");
    if document.tracks[track_index].locked {
        return Err(TimelineError::Invalid(format!(
            "track {} 已锁定",
            document.tracks[track_index].id
        )));
    }
    let original = document.tracks[track_index].elements[element_index].clone();
    let mut right = original.clone();
    right.id = new_id.to_owned();
    right.start = Some(TimeValue::Seconds(at));
    if carries_source_clock(original.kind) {
        right.src_start = Some(shifted_src_start(
            original.src_start.unwrap_or(0.0),
            start,
            at,
            media_play_rate(original.rate),
        ));
    }
    let mut left = original;
    left.end = Some(TimeValue::Seconds(at));
    if let Some(keyframes) = &left.keyframes {
        let (left_frames, right_frames) =
            crate::keyframes::split_keyframes(keyframes, (end - start).max(0.0), at - start);
        left.keyframes = Some(left_frames);
        right.keyframes = Some(right_frames);
    }
    let elements = &mut document.tracks[track_index].elements;
    elements[element_index] = left;
    elements.insert(element_index + 1, right.clone());
    document.validate()?;
    Ok(right)
}

/// Which side `join` keeps when the two elements' attributes disagree (according to the order given in the command).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinKeep {
    First,
    Second,
}

/// Reasons `join` rejects. `Attributes` can be explicitly allowed through by choosing a side with [`JoinKeep`]; the others cannot.
#[derive(Debug, Clone, PartialEq)]
pub enum JoinRefusal {
    /// Different kinds.
    Kind,
    /// Not touching end to start on the timeline: `gap` = start of the later one − end of the earlier one (a negative value means overlap).
    NotAdjacent { gap: f64 },
    /// Different sources, or different playback rates (`key` is `srcId` / `rate`).
    Source { key: &'static str },
    /// Source time is discontinuous: the later one's `srcStart` should be `expected`.
    SourceGap { expected: f64, actual: f64 },
    /// Keys of the remaining attributes that disagree (in alphabetical order).
    Attributes { keys: Vec<String> },
}

/// Tolerance in seconds for judging that the ends touch and the source time is continuous.
pub const JOIN_EPSILON: f64 = 1e-3;

/// Keys not compared for `join` attributes: the times and identities that are supposed to differ between the two halves, plus the name (the name is only a
/// label and does not affect the picture; after merging, the one that is kept is used).
const JOIN_OWN_KEYS: [&str; 5] = ["id", "name", "start", "end", "srcStart"];

/// Merges two elements into one (the inverse of [`split_element`]): orders them by their resolved times, and requires the same kind,
/// touching ends (tolerance [`JOIN_EPSILON`]), and for source-clocked kinds the same source and same rate with continuous source time, and
/// all other attributes matching. When attributes disagree, `keep` selects one side's attributes.
///
/// The result keeps the id and `start` of the element that is **earlier on the timeline** (as-is, word anchor not unresolved), and `srcStart`;
/// `end` is taken from the later element (as-is; tail-following stays tail-following); other attributes are taken from the side `keep` selects, or from the earlier one if they agree.
/// `first` / `second` are in the same order as `keep` (the order given in the command), and `*_span` is the resolved `(start, end)` of the two elements.
/// Which track they are on is decided by the caller.
pub fn join_elements(
    first: &Element,
    first_span: (f64, f64),
    second: &Element,
    second_span: (f64, f64),
    keep: Option<JoinKeep>,
) -> Result<Element, JoinRefusal> {
    if first.kind != second.kind {
        return Err(JoinRefusal::Kind);
    }
    let first_is_earlier = first_span.0 <= second_span.0;
    let ((early, early_span), (late, late_span)) = if first_is_earlier {
        ((first, first_span), (second, second_span))
    } else {
        ((second, second_span), (first, first_span))
    };
    let gap = late_span.0 - early_span.1;
    if gap.abs() > JOIN_EPSILON {
        return Err(JoinRefusal::NotAdjacent { gap });
    }
    if carries_source_clock(early.kind) || early.src_id.is_some() || late.src_id.is_some() {
        if early.src_id != late.src_id {
            return Err(JoinRefusal::Source { key: "srcId" });
        }
    }
    if carries_source_clock(early.kind) {
        let rate = media_play_rate(early.rate);
        if (rate - media_play_rate(late.rate)).abs() > 1e-9 {
            return Err(JoinRefusal::Source { key: "rate" });
        }
        let expected = shifted_src_start(
            early.src_start.unwrap_or(0.0),
            early_span.0,
            early_span.1,
            rate,
        );
        let actual = late.src_start.unwrap_or(0.0);
        if (actual - expected).abs() > JOIN_EPSILON * rate.max(1.0) {
            return Err(JoinRefusal::SourceGap { expected, actual });
        }
    }
    // Keyframes (0.12) are concatenated back to the original as-is when split into two halves, and do not take part in attribute comparison;
    // if they cannot be concatenated back, they are compared as ordinary attributes (if either side has keyframes, they count as disagreeing, and `keep` takes that side's as-is value).
    let joined_keyframes = crate::keyframes::join_keyframes(
        early.keyframes.as_ref(),
        (early_span.1 - early_span.0).max(0.0),
        late.keyframes.as_ref(),
        (late_span.1 - late_span.0).max(0.0),
    );
    let attributes = |element: &Element| {
        let mut value = serde_json::to_value(element).expect("element serialization");
        let object = value.as_object_mut().expect("element is an object");
        for key in JOIN_OWN_KEYS {
            object.remove(key);
        }
        if joined_keyframes.is_some() {
            object.remove("keyframes");
        }
        std::mem::take(object)
    };
    let (early_attrs, late_attrs) = (attributes(early), attributes(late));
    let mut keys = early_attrs
        .keys()
        .chain(late_attrs.keys())
        .filter(|key| early_attrs.get(*key) != late_attrs.get(*key))
        .cloned()
        .collect::<Vec<_>>();
    if joined_keyframes.is_none() {
        keys.push("keyframes".to_owned());
    }
    keys.sort();
    keys.dedup();
    let base = match keep {
        _ if keys.is_empty() => early,
        Some(JoinKeep::First) => first,
        Some(JoinKeep::Second) => second,
        None => return Err(JoinRefusal::Attributes { keys }),
    };
    let mut merged = base.clone();
    merged.id = early.id.clone();
    merged.start = early.start.clone();
    merged.end = late.end.clone();
    merged.src_start = early.src_start;
    if let Some(keyframes) = joined_keyframes {
        merged.keyframes = keyframes;
    }
    if keys.is_empty() {
        merged.name = early.name.clone();
    }
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::schema::{ElementKind, ElementRole};

    use super::*;

    fn text(id: &str, name: Option<&str>) -> Element {
        Element {
            id: id.to_owned(),
            kind: ElementKind::Text,
            name: name.map(str::to_owned),
            role: Some(ElementRole::Screentext),
            start: None,
            end: None,
            place: None,
            vertical_align: None,
            src_id: None,
            src_start: None,
            rate: None,
            muted: None,
            volume: None,
            audio_fade_in: None,
            audio_fade_out: None,
            bcf_clip: None,
            mode: None,
            fit: None,
            bg: None,
            text: Some("Hello".to_owned()),
            style: None,
            style_preset_id: None,
            tile: None,
            mask: None,
            fx: None,
            animate: None,
            transitions: None,
            keyframes: None,
            duck: None,
            source: None,
            html: None,
            ai: None,
            counter: None,
            shape: None,
            sticker: None,
            visualizer: None,
            progress: None,
            draw: None,
            placeholder: None,
            confetti: None,
            whiteboard: None,
            hidden: false,
        }
    }

    #[test]
    fn add_patch_resolve_and_remove_share_one_strict_path() {
        let mut document = TimelineDocument::default();
        add_element(&mut document, "text", None, text("el-10", Some("Title"))).unwrap();
        add_element(&mut document, "text", None, text("el-20", Some("Other"))).unwrap();
        assert_eq!(resolve_element_id(&document, "el-1").unwrap(), "el-10");
        assert_eq!(resolve_element_id(&document, "Title").unwrap(), "el-10");
        assert!(matches!(
            resolve_element_id(&document, "el-"),
            Err(TimelineError::Ambiguous(_))
        ));
        let updated = patch_element(
            &mut document,
            "Title",
            &json!({"text":"Updated", "place":{"x":50,"opacity":0.6}, "hidden":true}),
        )
        .unwrap();
        assert_eq!(updated.text.as_deref(), Some("Updated"));
        assert_eq!(updated.place.unwrap().x, Some(50.0));
        assert!(updated.hidden);
        assert_eq!(remove_element(&mut document, "el-10").unwrap().id, "el-10");
        assert_eq!(document.tracks[0].elements.len(), 1);
        let main = patch_main(&mut document, &json!({"muted":true,"background":"black"})).unwrap();
        assert!(main.muted);
    }

    /// 0.12: changing other properties (dragging position in the panel, editing text) does not touch `keyframes` / `duck`; per-property
    /// merging and clearing go through the same merge-patch.
    #[test]
    fn keyframes_and_duck_survive_unrelated_patches_and_merge_per_property() {
        let mut document = TimelineDocument::default();
        let mut element = text("el-1", Some("Title"));
        element.keyframes = Some(
            serde_json::from_value(
                json!({"x": [{"t": "0%", "v": 40.0}, {"t": "100%", "v": 60.0}]}),
            )
            .unwrap(),
        );
        add_element(&mut document, "text", None, element).unwrap();
        let updated = patch_element(
            &mut document,
            "el-1",
            &json!({"text": "New", "place": {"y": 30.0}}),
        )
        .unwrap();
        assert!(updated.keyframes.as_ref().unwrap().get("x").is_some());
        let updated = patch_element(
            &mut document,
            "el-1",
            &json!({"keyframes": {"scale": [{"t": "0%", "v": 1.0}, {"t": "100%", "v": 1.2}]}}),
        )
        .unwrap();
        let keyframes = updated.keyframes.as_ref().unwrap();
        assert!(keyframes.get("x").is_some() && keyframes.get("scale").is_some());
        let updated =
            patch_element(&mut document, "el-1", &json!({"keyframes": {"x": null}})).unwrap();
        assert!(updated.keyframes.as_ref().unwrap().get("x").is_none());
        // Text elements cannot carry volume keyframes, and cannot be ducked.
        assert!(
            patch_element(
                &mut document,
                "el-1",
                &json!({"keyframes": {"volume": [{"t": 0.0, "v": 0.5}]}})
            )
            .is_err()
        );
        assert!(
            patch_element(&mut document, "el-1", &json!({"duck": {"under": "speech"}})).is_err()
        );
    }

    /// **First** colour change on a sticker: after serialization the element has no `sticker.fillOverrides` key at all
    /// (`skip_serializing_if = BTreeMap::is_empty`), so the `null` written in the patch for the same-colour group (RFC 7396's "delete key") must be consumed,
    /// not copied as-is into the target, where it would blow up deserialization.
    #[test]
    fn merge_patch_drops_nulls_when_creating_a_missing_object() {
        use crate::schema::StickerProps;

        let mut document = TimelineDocument::default();
        let mut sticker = text("st-1", Some("Emoji"));
        sticker.kind = ElementKind::Sticker;
        sticker.text = None;
        sticker.role = None;
        let mut props = StickerProps::new("asset");
        props.path = Some("media/elements/emoji.svg".to_owned());
        sticker.sticker = Some(props);
        add_element(&mut document, "sticker", None, sticker).unwrap();
        assert!(
            serde_json::to_value(&document.tracks[0].elements[0]).unwrap()["sticker"]
                .get("fillOverrides")
                .is_none(),
            "前提：空表不序列化"
        );

        let updated = patch_element(
            &mut document,
            "st-1",
            &json!({"sticker": {"fillOverrides": {"#ffffff": null, "#112233": "#ff0000"}}}),
        )
        .expect("首次改色不能因 null 分组失败");
        let overrides = &updated.sticker.as_ref().unwrap().fill_overrides;
        assert_eq!(overrides.len(), 1);
        assert_eq!(
            overrides.get("#112233").map(String::as_str),
            Some("#ff0000")
        );

        // Second time: restore one existing group to its original colour (null deletes the key), and change the other group's colour.
        let updated = patch_element(
            &mut document,
            "st-1",
            &json!({"sticker": {"fillOverrides": {"#112233": null, "#445566": "#00ff00"}}}),
        )
        .unwrap();
        let overrides = &updated.sticker.as_ref().unwrap().fill_overrides;
        assert_eq!(overrides.len(), 1);
        assert_eq!(
            overrides.get("#445566").map(String::as_str),
            Some("#00ff00")
        );
    }

    /// A scalar position meets an object patch: first create an empty object and merge; `null` likewise does not land.
    #[test]
    fn merge_patch_replaces_a_scalar_with_a_fresh_object() {
        let mut target = json!({"a": 1});
        merge_patch(&mut target, &json!({"a": {"x": null, "y": 2}}));
        assert_eq!(target, json!({"a": {"y": 2}}));
        let mut target = json!({"a": {"x": 1}});
        merge_patch(&mut target, &json!({"a": 3}));
        assert_eq!(target, json!({"a": 3}));
    }

    #[test]
    fn reorder_moves_within_the_track_and_rejects_out_of_range() {
        let mut document = TimelineDocument::default();
        add_element(&mut document, "text", None, text("el-1", None)).unwrap();
        add_element(&mut document, "text", None, text("el-2", None)).unwrap();
        add_element(&mut document, "text", None, text("el-3", None)).unwrap();

        // "Move to front" = move to the end of the array (array order is the z order; the later, the higher).
        let (id, track_id, from) = reorder_element(&mut document, "el-1", 2).unwrap();
        assert_eq!((id.as_str(), track_id.as_str(), from), ("el-1", "text", 0));
        let order: Vec<&str> = document.tracks[0]
            .elements
            .iter()
            .map(|element| element.id.as_str())
            .collect();
        assert_eq!(order, ["el-2", "el-3", "el-1"]);

        // Not moving it in place is a valid no-op.
        reorder_element(&mut document, "el-3", 1).unwrap();
        assert_eq!(document.tracks[0].elements[1].id, "el-3");

        // Both out-of-range and locked tracks are rejected.
        assert!(reorder_element(&mut document, "el-1", 3).is_err());
        document.tracks[0].locked = true;
        assert!(reorder_element(&mut document, "el-1", 0).is_err());
    }

    #[test]
    fn move_to_another_track_lands_at_the_requested_layer() {
        let mut document = TimelineDocument::default();
        add_element(&mut document, "a", None, text("el-1", None)).unwrap();
        add_element(&mut document, "b", None, text("el-2", None)).unwrap();
        add_element(&mut document, "b", None, text("el-3", None)).unwrap();

        // Move into the bottom layer of b.
        let (id, from, index) = move_element_to_track(&mut document, "el-1", "b", 0).unwrap();
        assert_eq!((id.as_str(), from.as_str(), index), ("el-1", "a", 0));
        assert!(document.tracks[0].elements.is_empty());
        let order: Vec<&str> = document.tracks[1]
            .elements
            .iter()
            .map(|element| element.id.as_str())
            .collect();
        assert_eq!(order, ["el-1", "el-2", "el-3"]);

        // Same track = reorder within the track.
        move_element_to_track(&mut document, "el-1", "b", 2).unwrap();
        assert_eq!(document.tracks[1].elements[2].id, "el-1");

        // Non-existent track, out-of-range, locked track, and kind mismatch are all rejected.
        assert!(matches!(
            move_element_to_track(&mut document, "el-1", "missing", 0),
            Err(TimelineError::Unmapped(_))
        ));
        assert!(move_element_to_track(&mut document, "el-1", "a", 1).is_err());
        document.tracks.push(Track {
            id: "audio".to_owned(),
            kind: TrackKind::Audio,
            name: None,
            hidden: false,
            locked: false,
            muted: false,
            elements: Vec::new(),
        });
        assert!(move_element_to_track(&mut document, "el-1", "audio", 0).is_err());
        document.tracks[0].locked = true;
        assert!(move_element_to_track(&mut document, "el-1", "a", 0).is_err());
    }

    #[test]
    fn locked_and_kind_mismatched_tracks_reject_mutation() {
        let mut document = TimelineDocument::default();
        add_element(&mut document, "text", None, text("el-1", None)).unwrap();
        document.tracks[0].locked = true;
        assert!(patch_element(&mut document, "el-1", &json!({"text":"No"})).is_err());
        assert!(remove_element(&mut document, "el-1").is_err());
    }
    fn audio(id: &str, start: f64, end: f64, src_start: f64) -> Element {
        use crate::schema::TimeValue;
        let mut element = text(id, Some("Music"));
        element.kind = ElementKind::Audio;
        element.role = None;
        element.text = None;
        element.src_id = Some("src-a".to_owned());
        element.start = Some(TimeValue::Seconds(start));
        element.end = Some(TimeValue::Seconds(end));
        element.src_start = Some(src_start);
        element.rate = Some(2.0);
        element.volume = Some(0.5);
        element
    }

    #[test]
    fn split_then_join_restores_the_original_element() {
        let mut document = TimelineDocument::default();
        document.sources.insert(
            "src-a".to_owned(),
            crate::schema::Source {
                path: Some("/music.m4a".to_owned()),
                kind: Some(crate::schema::SourceKind::Audio),
                duration: Some(60.0),
                ..crate::schema::Source::default()
            },
        );
        add_element(&mut document, "audio", None, audio("el-1", 10.0, 20.0, 3.0)).unwrap();
        let original = document.tracks[0].elements[0].clone();
        assert!(split_point_inside(10.0, Some(20.0), 12.0, 0.5));
        assert!(!split_point_inside(10.0, Some(20.0), 10.2, 0.5));
        assert!(!split_point_inside(10.0, Some(20.0), 19.9, 0.5));
        assert!(
            split_point_inside(10.0, None, 19.9, 0.5),
            "跟片尾只查左边界"
        );

        let right = split_element(&mut document, "el-1", (10.0, 20.0), 12.0, "el-1-2").unwrap();
        assert_eq!(right.src_start, Some(7.0), "srcStart 前进 (12 − 10) × 2");
        assert!(split_element(&mut document, "el-1", (10.0, 20.0), 11.0, "el-1-2").is_err());
        let elements = &document.tracks[0].elements;
        assert_eq!(elements.len(), 2);
        assert_eq!(elements[1].id, "el-1-2", "右半紧挨在原件之上");

        let (left, right) = (elements[0].clone(), elements[1].clone());
        // Both orders merge back into the original: keeps the id of the element that is earlier on the timeline.
        for (a, a_span, b, b_span) in [
            (&left, (10.0, 12.0), &right, (12.0, 20.0)),
            (&right, (12.0, 20.0), &left, (10.0, 12.0)),
        ] {
            assert_eq!(join_elements(a, a_span, b, b_span, None).unwrap(), original);
        }
    }

    /// 0.12: keyframes are cut into each half's own window (percentages fold back into their own share, second-based notation follows the content, and the seam gets a sampled value for one frame);
    /// ducking and static volume are copied as-is. Joining them back restores the original exactly — including segments with easing, original keyframes that fall exactly on the cut point, and elements that follow the tail.
    /// Keyframes that were not produced by the same split cannot be silently stitched together; use `keep`.
    #[test]
    fn split_then_join_restores_keyframes_and_duck() {
        use crate::schema::TimeValue;
        let mut document = TimelineDocument::default();
        document.sources.insert(
            "src-a".to_owned(),
            crate::schema::Source {
                path: Some("/music.m4a".to_owned()),
                kind: Some(crate::schema::SourceKind::Audio),
                duration: Some(60.0),
                ..crate::schema::Source::default()
            },
        );
        let mut music = audio("bgm", 10.0, 20.0, 3.0);
        music.duck =
            Some(serde_json::from_value(json!({"under": "speech", "depth": 12.0})).unwrap());
        music.keyframes = Some(
            serde_json::from_value(json!({"volume": [
                {"t": "0%", "v": 0.2},
                {"t": "50%", "v": 1.0, "ease": "easeInOutCubic"},
                {"t": "100%", "v": 0.4}
            ]}))
            .unwrap(),
        );
        let mut title = text("title", Some("Title"));
        title.start = Some(TimeValue::Seconds(10.0));
        title.keyframes = Some(
            serde_json::from_value(json!({
                "x": [{"t": 0.0, "v": 10.0}, {"t": 2.0, "v": 50.0}, {"t": 6.0, "v": 90.0, "ease": "easeOutQuad"}],
                "opacity": [{"t": "0%", "v": 0.0}, {"t": "25%", "v": 1.0}]
            }))
            .unwrap(),
        );
        add_element(&mut document, "audio", None, music).unwrap();
        add_element(&mut document, "text", None, title).unwrap();

        // Music is cut at 14 seconds (4 seconds local, 40%); the text, following the tail (resolved at 30 seconds), is cut at 12 seconds — exactly one frame of x.
        for (id, span, at) in [("bgm", (10.0, 20.0), 14.0), ("title", (10.0, 30.0), 12.0)] {
            let original = document
                .tracks
                .iter()
                .flat_map(|track| &track.elements)
                .find(|element| element.id == id)
                .unwrap()
                .clone();
            let new_id = format!("{id}-2");
            let right = split_element(&mut document, id, span, at, &new_id).unwrap();
            let left = document
                .tracks
                .iter()
                .flat_map(|track| &track.elements)
                .find(|element| element.id == id)
                .unwrap()
                .clone();
            assert_eq!(left.duck, original.duck, "闪避两半照抄");
            assert_eq!(right.duck, original.duck);
            assert_ne!(left.keyframes, original.keyframes, "关键帧按新窗口改写");
            if id == "bgm" {
                let volume = |element: &Element| {
                    serde_json::to_value(element.keyframes.as_ref().unwrap().get("volume").unwrap())
                        .unwrap()
                };
                // The left half is the original 0–40%: the frame at 50% falls in the right half, and the seam gets a sampled value.
                assert_eq!(volume(&left)[0], json!({"t": "0%", "v": 0.2}));
                assert_eq!(volume(&left)[1]["t"], json!("100%"));
                assert_eq!(volume(&right)[0]["t"], json!("0%"));
                assert_eq!(
                    volume(&right)[1]["t"],
                    json!("16.6667%"),
                    "原 50% = 右半 1/6"
                );
            }
            let left_span = (span.0, at);
            let right_span = (at, span.1);
            let joined = join_elements(&left, left_span, &right, right_span, None).unwrap();
            assert_eq!(joined, original, "{id}：split→join 回原状");
            let swapped = join_elements(&right, right_span, &left, left_span, None).unwrap();
            assert_eq!(swapped, original);
            // Revert the two halves to the original, then the next one is cut.
            remove_element(&mut document, &new_id).unwrap();
            replace_element(&mut document, id, original).unwrap();
        }

        // Two elements with identical keyframes that were not produced by the same split: they cannot be concatenated back, so attributes count as disagreeing, and `keep` takes one side as-is.
        let mut a = audio("a", 10.0, 12.0, 3.0);
        let ramp = serde_json::from_value::<crate::keyframes::Keyframes>(
            json!({"volume": [{"t": "0%", "v": 0.2}, {"t": "100%", "v": 1.0}]}),
        )
        .unwrap();
        a.keyframes = Some(ramp.clone());
        let mut b = audio("b", 12.0, 20.0, 7.0);
        b.keyframes = Some(ramp.clone());
        assert_eq!(
            join_elements(&a, (10.0, 12.0), &b, (12.0, 20.0), None),
            Err(JoinRefusal::Attributes {
                keys: vec!["keyframes".to_owned()]
            })
        );
        let kept =
            join_elements(&a, (10.0, 12.0), &b, (12.0, 20.0), Some(JoinKeep::Second)).unwrap();
        assert_eq!(kept.keyframes, Some(ramp));
    }

    #[test]
    fn join_refuses_gaps_other_sources_and_differing_attributes() {
        let left = audio("a", 10.0, 12.0, 3.0);
        let right = audio("b", 12.0, 20.0, 7.0);
        let spans = ((10.0, 12.0), (12.0, 20.0));

        let gapped = join_elements(&left, spans.0, &right, (12.5, 20.0), None);
        assert!(
            matches!(gapped, Err(JoinRefusal::NotAdjacent { gap }) if (gap - 0.5).abs() < 1e-9)
        );

        let mut other = right.clone();
        other.src_id = Some("src-b".to_owned());
        assert_eq!(
            join_elements(&left, spans.0, &other, spans.1, Some(JoinKeep::Second)),
            Err(JoinRefusal::Source { key: "srcId" })
        );

        let mut jumped = right.clone();
        jumped.src_start = Some(9.0);
        assert!(matches!(
            join_elements(&left, spans.0, &jumped, spans.1, None),
            Err(JoinRefusal::SourceGap { expected, .. }) if (expected - 7.0).abs() < 1e-9
        ));

        let mut louder = right.clone();
        louder.volume = Some(0.8);
        assert_eq!(
            join_elements(&left, spans.0, &louder, spans.1, None),
            Err(JoinRefusal::Attributes {
                keys: vec!["volume".to_owned()]
            })
        );
        let kept = join_elements(&left, spans.0, &louder, spans.1, Some(JoinKeep::Second)).unwrap();
        assert_eq!((kept.id.as_str(), kept.volume), ("a", Some(0.8)));
        assert_eq!(kept.src_start, Some(3.0));
        assert_eq!(kept.end, right.end);
    }
}

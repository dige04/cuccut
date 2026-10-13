//! Element keyframes (`ccutTimeline` 0.12, BCF spec §19.x “Keyframes”).
//!
//! An element's `keyframes` maps each property to a series of `{t, v, ease?}`; the closed set of properties is in
//! [`KEYFRAME_PROPS`]. Layering order (normative): for a property that has keyframes, the sampled value **replaces** that property's static value (`place.*` or `volume`) and becomes the base pose; the entrance / exit / loop slots are still layered on top of the base pose as before. For an element without keyframes, every sampling entry point returns the static value unchanged, so the rendered result stays bit-for-bit identical.
//!
//! There are two time notations, and a single property may use only one: a number means seconds from the element's start; `"N%"` means a proportion of the element's duration (it follows automatically when trimming or following changes the duration). Frames in seconds notation that fall beyond the element's end have no effect. Easing is written on the **target frame**: the segment from frame i−1 to frame i uses frame i's `ease`, linear by default; before the first frame the first frame's value is used, and after the last frame the last frame's value is used.
//!
//! This module contains only pure functions: sampling, conversion, validation and exposed-edge detection. Every host (CPU / GPU / wasm / App preview, export mixdown) reads values through here instead of each writing its own copy.

use serde::{Deserialize, Serialize};

use crate::schema::{ElementKind, Place, TimelineError};

/// The closed set of properties (the key names used in the document; the order is the order they are listed in the schema and `spec`).
pub const KEYFRAME_PROPS: &[&str] = &[
    "x", "y", "scale", "scaleY", "rot", "opacity", "radius", "volume",
];
/// Maximum number of frames for a single property.
pub const KEYFRAMES_MAX_PER_PROP: usize = 256;
/// `opacity` (the static value and the keyframes share the same range).
pub const OPACITY_RANGE: (f64, f64) = (0.0, 1.0);
/// Element volume (linear multiplier; the static value and the keyframes share the same range, and export mixdown is clamped to it too).
pub const VOLUME_RANGE: (f64, f64) = (0.0, 4.0);
/// Range for the percentage notation.
pub const PERCENT_RANGE: (f64, f64) = (0.0, 100.0);

/// Keyframe time: seconds (from the element's start) or a percentage of the element's duration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum KeyTime {
    Seconds(f64),
    Percent(String),
}

impl KeyTime {
    /// The numeric value of the percentage notation (`"25%"` → 25); returns `None` for seconds notation or malformed input.
    pub fn percent(&self) -> Option<f64> {
        match self {
            Self::Percent(text) => parse_percent(text),
            Self::Seconds(_) => None,
        }
    }

    /// Converts to element-local seconds. `duration` is the element's duration (an open-ended element is measured to the end of the project).
    pub fn local_seconds(&self, duration: f64) -> f64 {
        match self {
            Self::Seconds(value) => *value,
            Self::Percent(text) => parse_percent(text).unwrap_or(0.0) / 100.0 * duration.max(0.0),
        }
    }
}

fn parse_percent(text: &str) -> Option<f64> {
    let body = text.strip_suffix('%')?;
    if body.is_empty()
        || body.starts_with('+')
        || body.starts_with('-')
        || !body.chars().all(|c| c.is_ascii_digit() || c == '.')
    {
        return None;
    }
    body.parse::<f64>().ok().filter(|value| value.is_finite())
}

/// A keyframe. `ease` is the easing of the segment that enters this frame (linear by default).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Keyframe {
    pub t: KeyTime,
    pub v: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ease: Option<String>,
}

/// The `keyframes` on an element. Properties that are absent use their static values.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Keyframes {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale_y: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rot: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radius: Option<Vec<Keyframe>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<Vec<Keyframe>>,
}

impl Keyframes {
    /// `(property name, frames)`, in the same order as [`KEYFRAME_PROPS`].
    pub fn tracks(&self) -> [(&'static str, Option<&Vec<Keyframe>>); 8] {
        [
            ("x", self.x.as_ref()),
            ("y", self.y.as_ref()),
            ("scale", self.scale.as_ref()),
            ("scaleY", self.scale_y.as_ref()),
            ("rot", self.rot.as_ref()),
            ("opacity", self.opacity.as_ref()),
            ("radius", self.radius.as_ref()),
            ("volume", self.volume.as_ref()),
        ]
    }

    pub fn get(&self, prop: &str) -> Option<&Vec<Keyframe>> {
        self.tracks()
            .into_iter()
            .find(|(name, _)| *name == prop)
            .and_then(|(_, frames)| frames)
    }

    /// Replaces (`Some`) or clears (`None`) the whole frame series of a property. Returns `false` for an unknown property name.
    pub fn set(&mut self, prop: &str, frames: Option<Vec<Keyframe>>) -> bool {
        let slot = match prop {
            "x" => &mut self.x,
            "y" => &mut self.y,
            "scale" => &mut self.scale,
            "scaleY" => &mut self.scale_y,
            "rot" => &mut self.rot,
            "opacity" => &mut self.opacity,
            "radius" => &mut self.radius,
            "volume" => &mut self.volume,
            _ => return false,
        };
        *slot = frames;
        true
    }

    pub fn is_empty(&self) -> bool {
        self.tracks().iter().all(|(_, frames)| frames.is_none())
    }

    /// Whether any property affects the picture (any property other than `volume`).
    pub fn has_visual(&self) -> bool {
        self.tracks()
            .iter()
            .any(|(name, frames)| *name != "volume" && frames.is_some())
    }

    /// Element-local seconds of all effective frames across all properties, sorted ascending and de-duplicated. Used for the repaint cadence and exposed-edge sampling.
    pub fn times(&self, duration: f64, visual_only: bool) -> Vec<f64> {
        let mut out = Vec::new();
        for (name, frames) in self.tracks() {
            if visual_only && name == "volume" {
                continue;
            }
            for frame in frames.into_iter().flatten() {
                let time = frame.t.local_seconds(duration);
                if time <= duration + TIME_EPSILON {
                    out.push(time);
                }
            }
        }
        out.sort_by(f64::total_cmp);
        out.dedup_by(|a, b| (*a - *b).abs() <= TIME_EPSILON);
        out
    }

    /// The sampled value of a property at element-local time `local`; `None` if the property has no keyframes (or all of them lie beyond the end).
    pub fn sample(&self, prop: &str, local: f64, duration: f64) -> Option<f64> {
        sample(self.get(prop)?, local, duration)
    }

    /// Validation. `caps` describes which properties the element may carry.
    pub fn validate(&self, element_id: &str, caps: KeyframeCaps) -> Result<(), TimelineError> {
        let invalid = |message: String| Err(TimelineError::Invalid(message));
        if self.is_empty() {
            return invalid(format!(
                "element {element_id} keyframes is empty; remove the whole field"
            ));
        }
        for (name, frames) in self.tracks() {
            let Some(frames) = frames else {
                continue;
            };
            if !caps.allows(name) {
                return invalid(format!(
                    "element {element_id} keyframes.{name} does not apply to this kind of element"
                ));
            }
            if frames.is_empty() {
                return invalid(format!(
                    "element {element_id} keyframes.{name} is empty; remove the property"
                ));
            }
            if frames.len() > KEYFRAMES_MAX_PER_PROP {
                return invalid(format!(
                    "element {element_id} keyframes.{name} exceeds {KEYFRAMES_MAX_PER_PROP} frames"
                ));
            }
            let percent = matches!(frames[0].t, KeyTime::Percent(_));
            let mut previous: Option<f64> = None;
            for (index, frame) in frames.iter().enumerate() {
                let at = match &frame.t {
                    KeyTime::Seconds(value) if !percent => {
                        if !value.is_finite() || *value < 0.0 {
                            return invalid(format!(
                                "element {element_id} keyframes.{name}[{index}].t must be non-negative seconds"
                            ));
                        }
                        *value
                    }
                    KeyTime::Percent(text) if percent => match parse_percent(text) {
                        Some(value) if (PERCENT_RANGE.0..=PERCENT_RANGE.1).contains(&value) => {
                            value
                        }
                        _ => {
                            return invalid(format!(
                                "element {element_id} keyframes.{name}[{index}].t must be \"0%\"…\"100%\""
                            ));
                        }
                    },
                    _ => {
                        return invalid(format!(
                            "element {element_id} keyframes.{name} mixes seconds and percentage time notations"
                        ));
                    }
                };
                if previous.is_some_and(|last| at <= last) {
                    return invalid(format!(
                        "element {element_id} keyframes.{name} times must be strictly increasing"
                    ));
                }
                previous = Some(at);
                if !value_in_range(name, frame.v) {
                    return invalid(format!(
                        "element {element_id} keyframes.{name}[{index}].v is out of range"
                    ));
                }
                if let Some(ease) = &frame.ease
                    && !::motion::curve::EASE_NAMES.contains(&ease.as_str())
                {
                    return invalid(format!(
                        "element {element_id} keyframes.{name}[{index}].ease is unknown: {ease}"
                    ));
                }
            }
        }
        Ok(())
    }
}

const TIME_EPSILON: f64 = 1e-9;

/// Whether a property's value is valid (uses the same constants as the static value).
pub fn value_in_range(prop: &str, value: f64) -> bool {
    if !value.is_finite() {
        return false;
    }
    match prop {
        "opacity" => (OPACITY_RANGE.0..=OPACITY_RANGE.1).contains(&value),
        "volume" => (VOLUME_RANGE.0..=VOLUME_RANGE.1).contains(&value),
        "radius" => value >= 0.0,
        _ => true,
    }
}

/// Which keyframe properties an element can carry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeyframeCaps {
    /// `x y scale scaleY rot opacity`: every element that has a picture.
    pub transform: bool,
    /// `radius`: images / videos / placeholders / whiteboards / asset stickers (consistent with the consumers of `place.radius`).
    pub radius: bool,
    /// `volume`: audio / video.
    pub volume: bool,
}

impl KeyframeCaps {
    pub fn for_kind(kind: &ElementKind, visual_media: bool) -> Self {
        let audio = *kind == ElementKind::Audio;
        Self {
            transform: !audio,
            radius: visual_media,
            volume: matches!(kind, ElementKind::Audio | ElementKind::Video),
        }
    }

    pub fn allows(self, prop: &str) -> bool {
        match prop {
            "radius" => self.radius,
            "volume" => self.volume,
            "x" | "y" | "scale" | "scaleY" | "rot" | "opacity" => self.transform,
            _ => false,
        }
    }
}

/// The sampled value of a series of frames at element-local time `local`. Frames in seconds notation that fall beyond the element's end have no effect; when all of them have no effect, or the series is empty, returns `None` (the property falls back to its static value).
pub fn sample(frames: &[Keyframe], local: f64, duration: f64) -> Option<f64> {
    let mut previous: Option<(f64, f64)> = None;
    for frame in frames {
        let at = frame.t.local_seconds(duration);
        if matches!(frame.t, KeyTime::Seconds(_)) && at > duration + TIME_EPSILON {
            break;
        }
        match previous {
            None if local <= at => return Some(frame.v),
            Some((from_t, from_v)) if local < at => {
                let span = at - from_t;
                if span <= 0.0 {
                    return Some(frame.v);
                }
                let progress = ((local - from_t) / span).clamp(0.0, 1.0);
                let eased = ::motion::curve::apply_ease(frame.ease.as_deref(), progress);
                return Some(from_v + (frame.v - from_v) * eased);
            }
            _ => {}
        }
        previous = Some((at, frame.v));
    }
    previous.map(|(_, value)| value)
}

/// Substitutes the keyframe sampled values into the static position to get the base pose at this moment. Returns `None` when `keyframes` is `None` or there is no picture property; the caller then uses the static `place` as is, which keeps the result bit-for-bit identical.
///
/// Keyframes for `radius` replace all four corner radii (writes `radius` and clears `cornerRadii`).
pub fn place_at(
    place: Option<&Place>,
    keyframes: Option<&Keyframes>,
    local: f64,
    duration: f64,
) -> Option<Place> {
    let keyframes = keyframes.filter(|keyframes| keyframes.has_visual())?;
    let mut out = place.cloned().unwrap_or_default();
    let mut touched = false;
    for (name, slot) in [
        ("x", &mut out.x),
        ("y", &mut out.y),
        ("scale", &mut out.scale),
        ("scaleY", &mut out.scale_y),
        ("rot", &mut out.rot),
        ("opacity", &mut out.opacity),
    ] {
        if let Some(value) = keyframes.sample(name, local, duration) {
            *slot = Some(value);
            touched = true;
        }
    }
    if let Some(value) = keyframes.sample("radius", local, duration) {
        out.radius = Some(value.max(0.0));
        out.corner_radii = None;
        touched = true;
    }
    touched.then_some(out)
}

/// The element's volume at element-local time `local` (linear multiplier, clamped to [`VOLUME_RANGE`]): uses the sampled value of the `volume` keyframes if present, otherwise the static value.
pub fn volume_at(
    static_volume: f64,
    keyframes: Option<&Keyframes>,
    local: f64,
    duration: f64,
) -> f64 {
    keyframes
        .and_then(|keyframes| keyframes.sample("volume", local, duration))
        .unwrap_or(static_volume)
        .clamp(VOLUME_RANGE.0, VOLUME_RANGE.1)
}

/// Tolerance in pixels for the exposed-edge check: rounding and floating-point error in the box do not count as exposure.
pub const UNCOVERED_TOLERANCE_PX: f64 = 0.5;
/// The exposed-edge check samples at most this many moments (the step size is increased when there would be more).
pub const UNCOVERED_MAX_SAMPLES: usize = 20_000;

/// The first place where keyframe motion exposes the bottom of the canvas.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Uncovered {
    /// Element-local seconds.
    pub at: f64,
    /// How many pixels are needed to fully cover (the farthest distance from the canvas corners to the box edge).
    pub gap_px: f64,
}

/// Exposed-edge check: when an image / video element's **static** position fully covers the canvas, the whole course of the keyframe motion must also fully cover it. Sampling is done on the frame grid (`fps`) and at every keyframe moment (easing extrema fall on the grid, and out-of-range easing is sampled too). Returns `None` if the static position does not cover the canvas to begin with, if there are no picture keyframes, if the element is tiled, or if it is not an image / video.
///
/// `natural` is the media's pixel size, `canvas` is the canvas pixel size, and `duration` is the element's duration.
pub fn keyframes_uncover(
    element: &crate::schema::Element,
    natural: (f64, f64),
    canvas: (f64, f64),
    duration: f64,
    fps: f64,
) -> Option<Uncovered> {
    use crate::geometry::{media_box, media_box_uncovered_gap};
    use crate::schema::VisualMode;
    if !matches!(element.kind, ElementKind::Image | ElementKind::Video)
        || element.tile.as_ref().is_some_and(|tile| tile.on)
        || !(natural.0 > 0.0 && natural.1 > 0.0)
    {
        return None;
    }
    let keyframes = element
        .keyframes
        .as_ref()
        .filter(|keyframes| keyframes.has_visual())?;
    let fullscreen = element.mode == Some(VisualMode::Fullscreen);
    let gap_at = |place: &Place| {
        let media = media_box(element.kind, fullscreen, place, natural, canvas);
        media_box_uncovered_gap(place, media, canvas)
    };
    let static_place = element.place.clone().unwrap_or_default();
    if gap_at(&static_place) > UNCOVERED_TOLERANCE_PX {
        return None;
    }
    let duration = duration.max(0.0);
    let step = (1.0 / fps.max(1.0)).max(duration / UNCOVERED_MAX_SAMPLES as f64);
    let mut times = keyframes.times(duration, true);
    let mut index = 0usize;
    loop {
        let time = index as f64 * step;
        if time > duration {
            break;
        }
        times.push(time);
        index += 1;
    }
    times.push(duration);
    times.sort_by(f64::total_cmp);
    times.dedup_by(|a, b| (*a - *b).abs() <= TIME_EPSILON);
    times.into_iter().find_map(|time| {
        let place = place_at(Some(&static_place), Some(keyframes), time, duration)?;
        let gap = gap_at(&place);
        (gap > UNCOVERED_TOLERANCE_PX).then_some(Uncovered {
            at: time,
            gap_px: gap,
        })
    })
}

/// After an element's window is changed by following or splitting, the framing of the new element relative to the old one (BCF §19.3 “Keyframes and following” within “Keyframes, solid canvas and dodging”).
///
/// New local time = (old local time − `head`) × `scale`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rewindow {
    /// Old element duration (seconds).
    pub old_duration: f64,
    /// The old local time that corresponds to new-element local 0 (a negative value means the new window extends further back).
    pub head: f64,
    /// New element duration (seconds).
    pub new_duration: f64,
    /// How many seconds of new local time elapse while the old local time advances 1 second (this is not 1 only when the clip speed has changed).
    pub scale: f64,
    /// The number of pieces an element has been split into (a split or cut point divides the clip's picture into several segments): percentage notation is rewritten to this piece's share; otherwise the percentages stay as they are and scale with the new duration.
    pub divided: bool,
}

impl Rewindow {
    /// Only the start point (`head` seconds removed) and the duration changed, speed unchanged, no pieces: an ordinary trim within following.
    pub fn trim(old_duration: f64, head: f64, new_duration: f64) -> Self {
        Self {
            old_duration,
            head,
            new_duration,
            scale: 1.0,
            divided: false,
        }
    }

    fn is_identity(&self) -> bool {
        self.head.abs() <= REWINDOW_EPSILON
            && (self.scale - 1.0).abs() <= REWINDOW_EPSILON
            && (self.new_duration - self.old_duration).abs() <= REWINDOW_EPSILON
    }
}

/// Rewritten seconds are rounded to microseconds, so floating-point noise does not make “unchanged” look changed.
const REWINDOW_EPSILON: f64 = 1e-6;

/// Maps the keyframes onto the new window (shared by following and splitting). Rules:
///
/// - **Seconds notation** follows the content: times are converted per [`Rewindow`]; frames that fall before the new window are dropped, and a sampled-value frame is added at 0; frames that fall after the new window (or that already had no effect beyond the old element's end) are dropped, and a sampled-value frame is added at the new end (using the next frame's easing), so the visible part of the animation stays as it was.
/// - **Percentage notation** stays as is while the element is still one piece (it scales with the new duration, “follows the crop / cut”); when the element has been split into several pieces, times are converted the same way as seconds notation and then folded back into this piece's percentage, so the two halves stay continuous at the seam.
/// - Sampled values are clamped back into the property's value range; where frames coincide after conversion, only the later frame's value is kept, which keeps the times strictly increasing.
pub fn rewindow(keyframes: &Keyframes, window: Rewindow) -> Keyframes {
    if window.is_identity() {
        return keyframes.clone();
    }
    let mut out = keyframes.clone();
    for (name, frames) in keyframes.tracks() {
        if let Some(frames) = frames {
            out.set(name, Some(rewindow_track(name, frames, window)));
        }
    }
    out
}

fn rewindow_track(prop: &str, frames: &[Keyframe], window: Rewindow) -> Vec<Keyframe> {
    let percent = matches!(
        frames.first().map(|frame| &frame.t),
        Some(KeyTime::Percent(_))
    );
    if frames.is_empty() || (percent && !window.divided) {
        return frames.to_vec();
    }
    let old_duration = window.old_duration.max(0.0);
    let new_duration = window.new_duration.max(0.0);
    let scale = if window.scale > 0.0 {
        window.scale
    } else {
        1.0
    };
    let at = |frame: &Keyframe| frame.t.local_seconds(old_duration);
    let effective: Vec<&Keyframe> = frames
        .iter()
        .take_while(|frame| percent || at(frame) <= old_duration + TIME_EPSILON)
        .collect();
    if effective.is_empty() {
        return frames.to_vec();
    }
    let head = window.head;
    let tail = head + new_duration / scale;
    let clamp = |value: f64| match prop {
        "opacity" => value.clamp(OPACITY_RANGE.0, OPACITY_RANGE.1),
        "volume" => value.clamp(VOLUME_RANGE.0, VOLUME_RANGE.1),
        "radius" => value.max(0.0),
        _ => value,
    };
    let sampled = |local: f64| clamp(sample(frames, local, old_duration).unwrap_or(frames[0].v));
    let map = |local: f64| {
        let value = ((local - head) * scale).clamp(0.0, new_duration);
        (value * 1e6).round() / 1e6
    };
    let mut out: Vec<(f64, f64, Option<String>)> = Vec::new();
    let mut push = |time: f64, value: f64, ease: Option<String>| match out.last_mut() {
        Some(last) if time <= last.0 + REWINDOW_EPSILON => last.1 = value,
        _ => out.push((time, value, ease)),
    };
    if at(effective[0]) < head - REWINDOW_EPSILON {
        push(0.0, sampled(head), None);
    }
    for frame in &effective {
        let local = at(frame);
        if local < head - REWINDOW_EPSILON || local > tail + REWINDOW_EPSILON {
            continue;
        }
        push(map(local), frame.v, frame.ease.clone());
    }
    if let Some(next) = frames
        .iter()
        .find(|frame| at(frame) > tail + REWINDOW_EPSILON)
    {
        push(new_duration, sampled(tail), next.ease.clone());
    }
    let mut result: Vec<Keyframe> = Vec::with_capacity(out.len());
    for (time, value, ease) in out {
        let t = if percent {
            let share = if new_duration > 0.0 {
                time / new_duration * 100.0
            } else {
                0.0
            };
            KeyTime::Percent(format_percent(share))
        } else {
            KeyTime::Seconds(time + 0.0)
        };
        match result.last_mut() {
            Some(last) if last.t == t => last.v = value,
            _ => result.push(Keyframe { t, v: value, ease }),
        }
    }
    result
}

/// `"N%"`, with at most four decimal places and trailing zeros removed (readable back by [`parse_percent`]).
fn format_percent(value: f64) -> String {
    let text = format!("{:.4}", value.clamp(PERCENT_RANGE.0, PERCENT_RANGE.1) + 0.0);
    let text = text.trim_end_matches('0').trim_end_matches('.');
    format!("{text}%")
}

/// Split (BCF §19.3 “Splitting, merging and trimming”): an element of duration `duration` is cut into two halves at local `cut`, and the keyframes are rewritten to each half's new window (the piece rules of [`rewindow`]: seconds notation follows the content; percentage notation folds back into the share belonging to this half; a sampled-value frame is added at each side of the seam). Returns `(left half, right half)`.
pub fn split_keyframes(keyframes: &Keyframes, duration: f64, cut: f64) -> (Keyframes, Keyframes) {
    let half = |head: f64, new_duration: f64| Rewindow {
        old_duration: duration,
        head,
        new_duration,
        scale: 1.0,
        divided: true,
    };
    (
        rewindow(keyframes, half(0.0, cut)),
        rewindow(keyframes, half(cut, duration - cut)),
    )
}

/// Merge (the inverse of [`split_keyframes`]): the earlier-in-time half (duration `early_duration`) and the later half are joined back into one element. For each property, try removing the seam frames that splitting added; the joined series, when split again, must match the two halves frame by frame (time tolerance about 0.1 ms, value tolerance one part in a million). If it matches, that is the restoration; if any property does not match (the halves are not from the same split, seconds and percentage notation are mixed, or only one half has a given property), returns `None`. If neither half has keyframes, returns `Some(None)`. After joining, percentage notation is recalculated against the merged duration (four decimal places).
pub fn join_keyframes(
    early: Option<&Keyframes>,
    early_duration: f64,
    late: Option<&Keyframes>,
    late_duration: f64,
) -> Option<Option<Keyframes>> {
    let (early, late) = match (early, late) {
        (None, None) => return Some(None),
        (Some(early), Some(late)) => (early, late),
        _ => return None,
    };
    let early_duration = early_duration.max(0.0);
    let late_duration = late_duration.max(0.0);
    let mut out = Keyframes::default();
    for prop in KEYFRAME_PROPS {
        match (early.get(prop), late.get(prop)) {
            (None, None) => {}
            (Some(a), Some(b)) => {
                let joined = join_track(prop, a, early_duration, b, late_duration)?;
                out.set(prop, Some(joined));
            }
            _ => return None,
        }
    }
    Some((!out.is_empty()).then_some(out))
}

fn join_track(
    prop: &str,
    early: &[Keyframe],
    early_duration: f64,
    late: &[Keyframe],
    late_duration: f64,
) -> Option<Vec<Keyframe>> {
    let is_percent = |frames: &[Keyframe]| {
        frames
            .first()
            .is_some_and(|frame| matches!(frame.t, KeyTime::Percent(_)))
    };
    let percent = is_percent(early);
    if early.is_empty() || late.is_empty() || percent != is_percent(late) {
        return None;
    }
    let total = early_duration + late_duration;
    let tolerance = JOIN_TIME_TOLERANCE + total * 1e-6;
    let early_at = |frame: &Keyframe| frame.t.local_seconds(early_duration);
    let late_at = |frame: &Keyframe| frame.t.local_seconds(late_duration);
    let early_seam = (early_at(early.last()?) - early_duration).abs() <= tolerance;
    let late_seam = late_at(&late[0]).abs() <= tolerance;
    // First try “both seam frames were added”, then try “only one side was added” (the other side has an original frame that happens to fall on the cut point).
    let candidates = [
        (early_seam, late_seam),
        (false, late_seam),
        (early_seam, false),
        (false, false),
    ];
    let mut tried = Vec::new();
    for (drop_early, drop_late) in candidates {
        if tried.contains(&(drop_early, drop_late)) {
            continue;
        }
        tried.push((drop_early, drop_late));
        let mut frames: Vec<(f64, f64, Option<String>)> = Vec::new();
        let early_kept = if drop_early {
            &early[..early.len() - 1]
        } else {
            early
        };
        let late_kept = if drop_late { &late[1..] } else { late };
        frames.extend(
            early_kept
                .iter()
                .map(|frame| (early_at(frame), frame.v, frame.ease.clone())),
        );
        frames.extend(
            late_kept
                .iter()
                .map(|frame| (early_duration + late_at(frame), frame.v, frame.ease.clone())),
        );
        if frames.is_empty()
            || frames
                .windows(2)
                .any(|pair| pair[1].0 <= pair[0].0 + REWINDOW_EPSILON)
        {
            continue;
        }
        let candidate = frames
            .into_iter()
            .map(|(time, v, ease)| Keyframe {
                t: if percent {
                    let share = if total > 0.0 {
                        time / total * 100.0
                    } else {
                        0.0
                    };
                    KeyTime::Percent(format_percent(share))
                } else {
                    KeyTime::Seconds((time * 1e6).round() / 1e6 + 0.0)
                },
                v,
                ease,
            })
            .collect::<Vec<_>>();
        let resplit = |head: f64, new_duration: f64| {
            rewindow_track(
                prop,
                &candidate,
                Rewindow {
                    old_duration: total,
                    head,
                    new_duration,
                    scale: 1.0,
                    divided: true,
                },
            )
        };
        if tracks_match(
            &resplit(0.0, early_duration),
            early,
            early_duration,
            tolerance,
        ) && tracks_match(
            &resplit(early_duration, late_duration),
            late,
            late_duration,
            tolerance,
        ) {
            return Some(candidate);
        }
    }
    None
}

/// Time tolerance in seconds for deciding during a merge that “the two frame series are the same series”: the error from storing percentages to four decimal places is far smaller than this.
const JOIN_TIME_TOLERANCE: f64 = 1e-4;

fn tracks_match(left: &[Keyframe], right: &[Keyframe], duration: f64, tolerance: f64) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(a, b)| {
            matches!(a.t, KeyTime::Percent(_)) == matches!(b.t, KeyTime::Percent(_))
                && (a.t.local_seconds(duration) - b.t.local_seconds(duration)).abs() <= tolerance
                && (a.v - b.v).abs() <= 1e-6 * a.v.abs().max(1.0)
                && a.ease == b.ease
        })
}

/// Parses `keyframes` from JSON (for hosts that only have the raw document). Returns `None` if the shape is wrong.
pub fn from_json(value: Option<&serde_json::Value>) -> Option<Keyframes> {
    let value = value.filter(|value| value.is_object())?;
    serde_json::from_value::<Keyframes>(value.clone())
        .ok()
        .filter(|keyframes| !keyframes.is_empty())
}

/// Linear multiplier → dB (`0` → `-inf`).
pub fn volume_to_db(volume: f64) -> f64 {
    if volume <= 0.0 {
        f64::NEG_INFINITY
    } else {
        20.0 * volume.log10()
    }
}

/// dB → linear multiplier.
pub fn db_to_volume(db: f64) -> f64 {
    if db == f64::NEG_INFINITY {
        0.0
    } else {
        10f64.powf(db / 20.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn frames(value: serde_json::Value) -> Vec<Keyframe> {
        serde_json::from_value(value).unwrap()
    }

    #[test]
    fn rewindow_is_identity_on_an_unchanged_window_and_formats_percent_readably() {
        let keyframes: Keyframes = serde_json::from_value(json!({
            "x": [{"t": 0.5, "v": 1.0}, {"t": 9.0, "v": 3.0}],
            "opacity": [{"t": "0%", "v": 0.0}, {"t": "100%", "v": 1.0, "ease": "easeOutBack"}]
        }))
        .unwrap();
        assert_eq!(
            rewindow(&keyframes, Rewindow::trim(4.0, 0.0, 4.0)),
            keyframes
        );
        // The middle piece of an element split into three: the percentage has at most four decimal places, so it reads back and passes validation.
        let middle = rewindow(
            &keyframes,
            Rewindow {
                old_duration: 3.0,
                head: 1.0,
                new_duration: 1.0,
                scale: 1.0,
                divided: true,
            },
        );
        let opacity = middle.get("opacity").unwrap();
        assert_eq!(opacity[0].t, KeyTime::Percent("0%".to_owned()));
        assert_eq!(opacity[1].t, KeyTime::Percent("100%".to_owned()));
        assert!(
            (0.0..=1.0).contains(&opacity[1].v),
            "out-of-range easing samples are clamped to the interval"
        );
        middle
            .validate("el", KeyframeCaps::for_kind(&ElementKind::Image, true))
            .unwrap();
        assert_eq!(format_percent(100.0 / 3.0), "33.3333%");
        assert_eq!(format_percent(-0.0), "0%");
    }

    #[test]
    fn percent_frames_follow_duration_and_hold_outside() {
        let track = frames(json!([{"t": "0%", "v": 1.0}, {"t": "100%", "v": 2.0}]));
        assert_eq!(sample(&track, -1.0, 4.0), Some(1.0));
        assert_eq!(sample(&track, 2.0, 4.0), Some(1.5));
        assert_eq!(sample(&track, 4.0, 4.0), Some(2.0));
        assert_eq!(sample(&track, 9.0, 4.0), Some(2.0));
        // The duration changed (trim / follow), so the percentages are stretched to fill it again.
        assert_eq!(sample(&track, 5.0, 10.0), Some(1.5));
    }

    #[test]
    fn ease_lives_on_the_target_frame() {
        let track = frames(json!([
            {"t": 0, "v": 0.0},
            {"t": 1, "v": 1.0, "ease": "easeInQuad"},
            {"t": 2, "v": 0.0}
        ]));
        assert!((sample(&track, 0.5, 10.0).unwrap() - 0.25).abs() < 1e-12);
        assert!((sample(&track, 1.5, 10.0).unwrap() - 0.5).abs() < 1e-12);
    }

    #[test]
    fn seconds_frames_past_the_end_do_not_apply() {
        let track = frames(json!([{"t": 0, "v": 1.0}, {"t": 5, "v": 3.0}]));
        // The element is only 2 seconds long: the 5-second frame has no effect, so it stays at the first frame.
        assert_eq!(sample(&track, 1.0, 2.0), Some(1.0));
        let late = frames(json!([{"t": 5, "v": 3.0}]));
        assert_eq!(sample(&late, 1.0, 2.0), None);
    }

    #[test]
    fn place_at_is_none_without_visual_frames() {
        let place = Place {
            x: Some(10.0),
            ..Place::default()
        };
        assert_eq!(place_at(Some(&place), None, 0.0, 1.0), None);
        let volume_only: Keyframes =
            serde_json::from_value(json!({"volume": [{"t": 0, "v": 0.5}]})).unwrap();
        assert_eq!(place_at(Some(&place), Some(&volume_only), 0.0, 1.0), None);
        let moving: Keyframes = serde_json::from_value(
            json!({"x": [{"t": "0%", "v": 50.0}, {"t": "100%", "v": 70.0}], "radius": [{"t": 0, "v": 8.0}]}),
        )
        .unwrap();
        let mut rounded = place.clone();
        rounded.corner_radii = Some(crate::schema::CornerRadii {
            top_left: 1.0,
            top_right: 1.0,
            bottom_right: 1.0,
            bottom_left: 1.0,
        });
        let at = place_at(Some(&rounded), Some(&moving), 1.0, 2.0).unwrap();
        assert_eq!(at.x, Some(60.0));
        assert_eq!(at.radius, Some(8.0));
        assert_eq!(at.corner_radii, None);
    }

    #[test]
    fn validation_rejects_mixed_notation_order_range_and_kind() {
        let caps = KeyframeCaps::for_kind(&ElementKind::Image, true);
        let parse = |value: serde_json::Value| serde_json::from_value::<Keyframes>(value).unwrap();
        assert!(
            parse(
                json!({"x": [{"t": "0%", "v": 1}, {"t": "100%", "v": 2, "ease": "easeOutCubic"}]})
            )
            .validate("e", caps)
            .is_ok()
        );
        for bad in [
            json!({"x": [{"t": 0, "v": 1}, {"t": "100%", "v": 2}]}),
            json!({"x": [{"t": 1, "v": 1}, {"t": 1, "v": 2}]}),
            json!({"x": [{"t": "120%", "v": 1}]}),
            json!({"x": [{"t": "-5%", "v": 1}]}),
            json!({"opacity": [{"t": 0, "v": 1.5}]}),
            json!({"x": [{"t": 0, "v": 1, "ease": "bogus"}]}),
            json!({"volume": [{"t": 0, "v": 1}]}),
            json!({"x": []}),
            json!({}),
        ] {
            assert!(parse(bad.clone()).validate("e", caps).is_err(), "{bad}");
        }
        let audio = KeyframeCaps::for_kind(&ElementKind::Audio, false);
        assert!(
            parse(json!({"volume": [{"t": 0, "v": 0}, {"t": 1, "v": 4}]}))
                .validate("a", audio)
                .is_ok()
        );
        assert!(
            parse(json!({"x": [{"t": 0, "v": 1}]}))
                .validate("a", audio)
                .is_err()
        );
        let text = KeyframeCaps::for_kind(&ElementKind::Text, false);
        assert!(
            parse(json!({"radius": [{"t": 0, "v": 1}]}))
                .validate("t", text)
                .is_err()
        );
    }

    #[test]
    fn uncovered_check_reports_first_gap_and_skips_uncovered_statics() {
        let element = |value: serde_json::Value| -> crate::schema::Element {
            serde_json::from_value(value).unwrap()
        };
        let canvas = (1920.0, 1080.0);
        // PiP, width 100%, 16:9 source: fully covers statically; moving x from 50 to 70 will necessarily expose the edge.
        let moving = element(json!({
            "id": "img", "kind": "image", "srcId": "s", "place": {"x": 50, "y": 50, "w": 100},
            "keyframes": {"x": [{"t": "0%", "v": 50}, {"t": "100%", "v": 70}]}
        }));
        let hit = keyframes_uncover(&moving, (1920.0, 1080.0), canvas, 4.0, 30.0).unwrap();
        assert!(hit.at > 0.0 && hit.at < 0.1, "{hit:?}");
        assert!(hit.gap_px > UNCOVERED_TOLERANCE_PX);
        // Scale up 1.2 then shift 5%: the box is 384 px wider than the canvas, so moving it 96 px still covers the canvas.
        let zoomed = element(json!({
            "id": "img", "kind": "image", "srcId": "s", "place": {"x": 50, "y": 50, "w": 100, "scale": 1.2},
            "keyframes": {"x": [{"t": "0%", "v": 50}, {"t": "100%", "v": 55}]}
        }));
        assert_eq!(
            keyframes_uncover(&zoomed, (1920.0, 1080.0), canvas, 4.0, 30.0),
            None
        );
        // In fill mode x does not take part in the box position; it only exposes when scaled down to 0.9.
        let full = element(json!({
            "id": "img", "kind": "image", "srcId": "s", "mode": "fullscreen",
            "keyframes": {"scale": [{"t": 0, "v": 1.0}, {"t": 2, "v": 0.9}]}
        }));
        let hit = keyframes_uncover(&full, (800.0, 800.0), canvas, 4.0, 30.0).unwrap();
        assert!(hit.at > 0.0 && hit.at < 0.1);
        // Does not fully cover statically: not checked.
        let small = element(json!({
            "id": "img", "kind": "image", "srcId": "s", "place": {"w": 40},
            "keyframes": {"x": [{"t": 0, "v": 0}, {"t": 1, "v": 100}]}
        }));
        assert_eq!(
            keyframes_uncover(&small, (1920.0, 1080.0), canvas, 4.0, 30.0),
            None
        );
    }

    #[test]
    fn db_round_trip() {
        assert!((db_to_volume(-6.0) - 0.501_187_233_627_272_2).abs() < 1e-12);
        assert!((volume_to_db(db_to_volume(-6.0)) + 6.0).abs() < 1e-9);
        assert_eq!(volume_to_db(0.0), f64::NEG_INFINITY);
    }
}

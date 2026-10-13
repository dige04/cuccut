//! Subtitle motion tracks shared by panel previews, playback and export.
/// Whether a track lands on the whole line or per word (prototype `track.group`).
///
/// This is a different matter from [`Track::block_scaling`]: this one says **who owns its own time window**, and that one says **relative to whom the deformation is measured**. `stomp` is already `Block` yet is still marked `block_scaling`, which is evidence that the two mean different things.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Scope {
    /// One time window per word.
    Word,
    /// One time window for the whole line.
    Block,
}

/// `YG`: whether this track takes the style's `animationColor`, and whether it is used as the text color or the block color.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ColourParam {
    /// Used as the text color (only `colourHighlight`).
    TextColour,
    /// Used as the block color (`boxHighlight` / `stack`).
    BoxColour,
}

/// Color channels of one frame. `alpha` is opacity; the other three are “switch to this style's accent color”.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Colour {
    /// `colour.a`. When absent, normalization fills in 1.
    pub alpha: Option<f64>,
    /// `colour.useCustom`。
    pub use_custom: bool,
    /// `colour.useSecondary`。
    pub use_secondary: bool,
    /// `colour.mixSecondary`. Only two values are used, `1` and `1e-9` (the latter ≈ almost no mixing = no swap).
    pub mix_secondary: Option<f64>,
}

impl Colour {
    /// Whether this frame specifies a color swap at all (prototype `hasSwap`).
    fn has_swap(self) -> bool {
        self.use_custom || self.use_secondary || self.mix_secondary.is_some()
    }

    /// Whether a color swap happens. `mixSecondary` takes precedence over the two boolean switches; only > 0.5 counts as a swap.
    fn swaps(self) -> bool {
        let flag = self.use_custom || self.use_secondary;
        if !flag && self.mix_secondary.is_none() {
            return false;
        }
        self.mix_secondary.unwrap_or(if flag { 1.0 } else { 0.0 }) > 0.5
    }
}

/// The background block of one frame (prototype `keyframe.box`).
///
/// The only fields the 19 entries use are these three: the block's own scale, the block's own alpha, and corner rounding. The others (`underText` / `trackActiveElement` / `useCustomColour` / `translate` / `rotation`) are constant across these 19 entries, and carrying them into the core would only create dead fields that are always true.
#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)]
pub struct Chip {
    /// `box.scale.x` (across these 19 entries x is always equal to y).
    pub scale: f64,
    /// `box.colour.a`. **Independent of the word's opacity**: applying it to the word would fade the text along with it.
    pub alpha: f64,
    /// `box.cornerRounding`: **a multiple of the font size** (`.5` → `.5em`), not a fraction of the box's short side. Basis: the comment on the prototype `boxOf()` and `model-subanim.test.js:98`.
    pub corner_rounding: f64,
}

/// One frame on a track. Absent channels are filled in from `DEFAULTS` by [`Track::normalized`]. This is how keyframes are read in this module ("unwritten = reset to default"), the opposite of CSS `@keyframes` ("unwritten = not part of the interpolation").
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Keyframe {
    /// Time from 0 to 1.
    pub time: f64,
    /// Easing name from the previous frame to this frame (empty string = linear).
    pub easing: &'static str,
    /// `translate {x, y}`: **multiples of the element's own size** (`-0.2` = moves up by 20% of its own size).
    pub translate: Option<[f64; 2]>,
    /// `scale`. Across these 19 entries x is always equal to y, so only one number is stored.
    pub scale: Option<f64>,
    /// `rotation {x, y, z}`, in degrees. Projection is handled by the drawing side.
    pub rotation: Option<[f64; 3]>,
    /// `colour`。
    pub colour: Option<Colour>,
    /// `box`. When absent, this frame has no block (normalization **does not supply a default for it**).
    pub chip: Option<Chip>,
}

impl Keyframe {
    /// An empty frame that only specifies the time (`{time: t}`).
    const fn at(time: f64) -> Self {
        Self {
            time,
            easing: "",
            translate: None,
            scale: None,
            rotation: None,
            colour: None,
            chip: None,
        }
    }

    const fn ease(mut self, easing: &'static str) -> Self {
        self.easing = easing;
        self
    }

    const fn alpha(mut self, alpha: f64) -> Self {
        self.colour = Some(Colour {
            alpha: Some(alpha),
            use_custom: false,
            use_secondary: false,
            mix_secondary: None,
        });
        self
    }

    const fn colour(mut self, colour: Colour) -> Self {
        self.colour = Some(colour);
        self
    }

    const fn dy(mut self, y: f64) -> Self {
        self.translate = Some([0.0, y]);
        self
    }

    const fn scale(mut self, scale: f64) -> Self {
        self.scale = Some(scale);
        self
    }

    const fn rotation(mut self, x: f64, y: f64, z: f64) -> Self {
        self.rotation = Some([x, y, z]);
        self
    }

    const fn chip(mut self, scale: f64, alpha: f64, corner_rounding: f64) -> Self {
        self.chip = Some(Chip {
            scale,
            alpha,
            corner_rounding,
        });
        self
    }
}

/// The two ways of writing the recolor step.
const CUSTOM: Colour = Colour {
    alpha: None,
    use_custom: true,
    use_secondary: false,
    mix_secondary: None,
};
const SECONDARY: Colour = Colour {
    alpha: None,
    use_custom: false,
    use_secondary: true,
    mix_secondary: None,
};
const fn mix(value: f64) -> Colour {
    Colour {
        alpha: None,
        use_custom: true,
        use_secondary: false,
        mix_secondary: Some(value),
    }
}

/// One track. `kf` is the track's key in the animation registry.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Track {
    pub kf: &'static str,
    pub scope: Scope,
    /// Per-word deformation is computed **relative to the whole line**, so `dropIn`'s `scale 1.5` means "falls in from outside the frame", not "swells in place".
    pub block_scaling: bool,
    /// This word is **centered and enlarged on its own**, not the n-th word in the line.
    pub centre_elements: bool,
    pub keyframes: &'static [Keyframe],
}

/// All tracks of one animation (prototype `ANIMS[i]`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AnimTracks {
    /// Catalog id, with the same names and order as the editor animation catalogue.
    pub catalog_id: &'static str,
    pub colour_param: Option<ColourParam>,
    /// `qG`: the duration is computed from the **whole cue** (words not in the table are split evenly across the word windows). This is separate from `scope`.
    pub block_timing: bool,
    pub tracks: &'static [Track],
}

const fn word_track(kf: &'static str, keyframes: &'static [Keyframe]) -> Track {
    Track {
        kf,
        scope: Scope::Word,
        block_scaling: false,
        centre_elements: false,
        keyframes,
    }
}

const fn block_track(kf: &'static str, keyframes: &'static [Keyframe]) -> Track {
    Track {
        kf,
        scope: Scope::Block,
        block_scaling: false,
        centre_elements: false,
        keyframes,
    }
}

const fn anim(catalog_id: &'static str, tracks: &'static [Track]) -> AnimTracks {
    AnimTracks {
        catalog_id,
        colour_param: None,
        block_timing: false,
        tracks,
    }
}

const fn tinted(mut anim: AnimTracks, param: ColourParam) -> AnimTracks {
    anim.colour_param = Some(param);
    anim
}

const fn cue_timed(mut anim: AnimTracks) -> AnimTracks {
    anim.block_timing = true;
    anim
}

// ---------------------------------------------------------------------------
// 19 tracks, verbatim
// ---------------------------------------------------------------------------

const BOX_HIGHLIGHT_V2: [Keyframe; 3] = [
    Keyframe::at(0.0).chip(0.9, 0.75, 0.5).ease("sinInOut"),
    Keyframe::at(0.7).chip(1.1, 1.0, 0.5).ease("sinInOut"),
    Keyframe::at(1.0).chip(1.0, 1.0, 0.5).ease("sinInOut"),
];
const FLIP_CLOCK: [Keyframe; 2] = [
    Keyframe::at(0.0)
        .rotation(-90.0, 0.0, 0.0)
        .alpha(0.0)
        .ease("expoOut"),
    Keyframe::at(1.0)
        .rotation(0.0, 0.0, 0.0)
        .alpha(1.0)
        .ease("expoOut"),
];
const HIGHLIGHT: [Keyframe; 4] = [
    Keyframe::at(0.0).alpha(0.5),
    Keyframe::at(0.01).alpha(1.0).ease("squareIn"),
    Keyframe::at(0.99).alpha(1.0).ease("squareIn"),
    Keyframe::at(1.0).alpha(0.5).ease("squareOut"),
];
const KARAOKE_V2: [Keyframe; 3] = [
    Keyframe::at(0.0).alpha(0.5),
    Keyframe::at(0.1).alpha(1.0).ease("sinIn"),
    Keyframe::at(1.0).alpha(1.0).ease("squareIn"),
];
const IMPACT: [Keyframe; 4] = [
    Keyframe::at(0.0).alpha(0.0),
    Keyframe::at(0.01).alpha(1.0).ease("squareIn"),
    Keyframe::at(0.99).alpha(0.0).ease("squareIn"),
    Keyframe::at(1.0).alpha(0.0).ease("squareOut"),
];
const REVEAL: [Keyframe; 3] = [
    Keyframe::at(0.0).alpha(0.0),
    Keyframe::at(0.01).alpha(1.0).ease("squareInOut"),
    Keyframe::at(1.0).alpha(1.0).ease("squareInOut"),
];
const FLOAT_IN_COL: [Keyframe; 3] = [
    Keyframe::at(0.0).alpha(0.0),
    Keyframe::at(0.46),
    Keyframe::at(1.0),
];
const FLOAT_IN_TOP: [Keyframe; 2] = [
    Keyframe::at(0.0).dy(-0.2),
    Keyframe::at(1.0).ease("cubicOut"),
];
const FLOAT_IN_BOTTOM: [Keyframe; 2] = [
    Keyframe::at(0.0).dy(0.2),
    Keyframe::at(1.0).ease("cubicOut"),
];
const SCALE_IN: [Keyframe; 2] = [
    Keyframe::at(0.0).scale(0.0).alpha(0.0).ease("expoOut"),
    Keyframe::at(0.65).scale(1.0).alpha(1.0).ease("expoOut"),
];
const DROP_IN: [Keyframe; 2] = [
    Keyframe::at(0.0)
        .dy(-0.1)
        .scale(1.5)
        .alpha(0.0)
        .ease("expoOut"),
    Keyframe::at(0.8)
        .dy(0.0)
        .scale(1.0)
        .alpha(1.0)
        .ease("expoOut"),
];
const IMPACT_POP: [Keyframe; 5] = [
    Keyframe::at(0.0).alpha(0.0),
    Keyframe::at(0.01).alpha(0.5).scale(0.88).ease("squareIn"),
    Keyframe::at(0.98).alpha(1.0).scale(1.0).ease("quadOut"),
    Keyframe::at(0.99).alpha(1.0).ease("quadOut"),
    Keyframe::at(1.0).alpha(0.0).ease("squareOut"),
];
const COLOUR_HIGHLIGHT_V3: [Keyframe; 4] = [
    Keyframe::at(0.0).colour(mix(1e-9)),
    Keyframe::at(0.1).colour(mix(1.0)),
    Keyframe::at(0.9).colour(mix(1.0)),
    Keyframe::at(1.0).colour(mix(1e-9)),
];
const ROTATE_FLIP_CLOCK: [Keyframe; 2] = [
    Keyframe::at(0.0)
        .rotation(-90.0, 0.0, 10.0)
        .alpha(0.0)
        .ease("expoOut"),
    Keyframe::at(1.0)
        .rotation(0.0, 0.0, 10.0)
        .alpha(1.0)
        .ease("expoOut"),
];
const RANDOM_ROTATE: [Keyframe; 3] = [
    Keyframe::at(0.0).rotation(0.0, 0.0, 6.0),
    Keyframe::at(0.22).rotation(0.0, 0.0, 9.0).ease("sinout"),
    Keyframe::at(1.0).rotation(0.0, 0.0, 9.0),
];
const COLOUR_HIGHLIGHT: [Keyframe; 4] = [
    Keyframe::at(0.0),
    Keyframe::at(0.01).colour(SECONDARY).ease("squareIn"),
    Keyframe::at(0.99).colour(SECONDARY).ease("squareIn"),
    Keyframe::at(1.0).ease("squareOut"),
];
const BG_HIGHLIGHT: [Keyframe; 2] = [
    Keyframe::at(0.0).chip(0.92, 1.0, 0.2).ease("sinInOut"),
    Keyframe::at(1.0).chip(0.92, 1.0, 0.2).ease("sinInOut"),
];
const STOMP: [Keyframe; 2] = [
    Keyframe::at(0.0).scale(2.5).alpha(0.0).ease("sinOut"),
    Keyframe::at(1.0).scale(1.0).alpha(1.0).ease("expoOut"),
];
const BOUNCE: [Keyframe; 3] = [
    Keyframe::at(0.0).dy(0.0).alpha(0.0),
    Keyframe::at(0.5).dy(-0.2).alpha(1.0),
    Keyframe::at(1.0).dy(0.0).alpha(1.0),
];
const PAINT: [Keyframe; 3] = [
    Keyframe::at(0.0),
    Keyframe::at(0.01).colour(CUSTOM).ease("squareIn"),
    Keyframe::at(1.0).colour(CUSTOM),
];

const T_BOX_HIGHLIGHT: [Track; 1] = [word_track("boxHighlightV2", &BOX_HIGHLIGHT_V2)];
const T_FLIP_CLOCK: [Track; 1] = [block_track("flipClock", &FLIP_CLOCK)];
const T_HIGHLIGHT: [Track; 1] = [word_track("highlight", &HIGHLIGHT)];
const T_KARAOKE: [Track; 1] = [word_track("karaokeV2", &KARAOKE_V2)];
const T_IMPACT: [Track; 1] = [Track {
    centre_elements: true,
    ..word_track("impact", &IMPACT)
}];
const T_REVEAL: [Track; 1] = [word_track("reveal", &REVEAL)];
const T_FLOAT_IN_TOP: [Track; 2] = [
    word_track("composedFloatIn_col", &FLOAT_IN_COL),
    word_track("composedFloatIn_top", &FLOAT_IN_TOP),
];
const T_FLOAT_IN_BOTTOM: [Track; 2] = [
    word_track("composedFloatIn_col", &FLOAT_IN_COL),
    word_track("composedFloatIn_bottom", &FLOAT_IN_BOTTOM),
];
const T_SCALE_IN: [Track; 1] = [block_track("scaleIn", &SCALE_IN)];
const T_DROP_IN: [Track; 1] = [Track {
    block_scaling: true,
    ..word_track("dropIn", &DROP_IN)
}];
const T_IMPACT_POP: [Track; 1] = [Track {
    block_scaling: true,
    centre_elements: true,
    ..word_track("impactPop", &IMPACT_POP)
}];
const T_COLOUR_HIGHLIGHT: [Track; 1] = [word_track("colourHighlightV3", &COLOUR_HIGHLIGHT_V3)];
const T_ROTATE_FLIP_CLOCK: [Track; 1] = [block_track("rotateFlipClock", &ROTATE_FLIP_CLOCK)];
const T_ROTATE_HIGHLIGHT: [Track; 2] = [
    block_track("randomRotate", &RANDOM_ROTATE),
    word_track("colourHighlight", &COLOUR_HIGHLIGHT),
];
const T_STACK: [Track; 1] = [word_track("bgHighlight", &BG_HIGHLIGHT)];
const T_STOMP: [Track; 1] = [Track {
    block_scaling: true,
    ..block_track("stomp", &STOMP)
}];
const T_BOUNCE: [Track; 1] = [word_track("bounce", &BOUNCE)];
const T_PAINT: [Track; 1] = [word_track("paint", &PAINT)];

/// Track table of the 19 animations. **Order is identical, cell by cell, to the editor animation catalogue** (pinned by the test gate `the_track_table_lines_up_with_the_catalogue`), so `WORD_ANIM_TRACKS[demo as usize]` is the track of that cell.
pub static WORD_ANIM_TRACKS: [AnimTracks; 19] = [
    anim("none", &[]),
    tinted(
        anim("boxHighlight", &T_BOX_HIGHLIGHT),
        ColourParam::BoxColour,
    ),
    cue_timed(anim("flipClock", &T_FLIP_CLOCK)),
    anim("highlight", &T_HIGHLIGHT),
    anim("karaoke", &T_KARAOKE),
    anim("impact", &T_IMPACT),
    anim("reveal", &T_REVEAL),
    anim("floatInTop", &T_FLOAT_IN_TOP),
    anim("floatInBottom", &T_FLOAT_IN_BOTTOM),
    anim("scaleIn", &T_SCALE_IN),
    anim("dropIn", &T_DROP_IN),
    anim("impactPop", &T_IMPACT_POP),
    tinted(
        anim("colourHighlight", &T_COLOUR_HIGHLIGHT),
        ColourParam::TextColour,
    ),
    cue_timed(anim("rotateFlipClock", &T_ROTATE_FLIP_CLOCK)),
    anim("rotateHighlight", &T_ROTATE_HIGHLIGHT),
    tinted(anim("stack", &T_STACK), ColourParam::BoxColour),
    cue_timed(anim("stomp", &T_STOMP)),
    anim("bounce", &T_BOUNCE),
    anim("paint", &T_PAINT),
];

// ---------------------------------------------------------------------------
// Normalization and sampling (prototype `normalize` / `ease01` / `tween` / `sampleAt`)
// ---------------------------------------------------------------------------

/// Union of the channels used by one track. Normalization fills in defaults per frame using it.
#[derive(Clone, Copy, Debug, Default)]
struct Used {
    translate: bool,
    scale: bool,
    rotation: bool,
    colour: bool,
}

impl Track {
    fn used(self) -> Used {
        let mut used = Used::default();
        for kf in self.keyframes {
            used.translate |= kf.translate.is_some();
            used.scale |= kf.scale.is_some();
            used.rotation |= kf.rotation.is_some();
            used.colour |= kf.colour.is_some();
        }
        used
    }

    /// Whether this track touches transform at all (prototype `moving`).
    pub fn moving(self) -> bool {
        let used = self.used();
        used.translate || used.scale || used.rotation
    }

    /// The state of frame `i` after the absent channels are filled in.
    ///
    /// **"Unwritten = reset to default"**, not CSS `@keyframes`' "unwritten = not part of the interpolation". The final frame of `composedFloatIn_top` writes nothing, so the word naturally falls back to `y = 0`. The only exception is `box`: not writing a block means **there is no block**, so an empty block is not filled in for it.
    fn normalized(self, index: usize) -> Keyframe {
        let used = self.used();
        let swaps = self
            .keyframes
            .iter()
            .any(|kf| kf.colour.is_some_and(Colour::has_swap));
        let mut kf = self.keyframes[index];
        if used.translate && kf.translate.is_none() {
            kf.translate = Some([0.0, 0.0]);
        }
        if used.scale && kf.scale.is_none() {
            kf.scale = Some(1.0);
        }
        if used.rotation && kf.rotation.is_none() {
            kf.rotation = Some([0.0, 0.0, 0.0]);
        }
        if used.colour && kf.colour.is_none() {
            kf.colour = Some(Colour::default());
        }
        if let Some(colour) = &mut kf.colour {
            if colour.alpha.is_none() {
                colour.alpha = Some(1.0);
            }
            // Recolor also "resets to default": if any frame on the track swaps color, the frames that do not swap must explicitly write back the base color.
            if swaps && !colour.has_swap() {
                colour.mix_secondary = Some(0.0);
            }
        }
        kf
    }
}

/// Progress within a segment (prototype `ease01`). `square*` are steps; the others are sampled linearly. A static frame does not need to solve a Bézier, and the difference only shows after the decimal point.
fn ease01(name: &str, p: f64) -> f64 {
    match name {
        "squareIn" | "squareInOut" => 0.0,
        "squareOut" => 1.0,
        _ => p,
    }
}

fn lerp(a: f64, b: f64, p: f64) -> f64 {
    a + (b - a) * p
}

/// Interpolates between two frames (prototype `tween`). Only numeric values are interpolated; discrete values such as the color switch and corner rounding take the **starting frame's** value.
fn tween(a: Keyframe, b: Keyframe, p: f64) -> Keyframe {
    let mut out = Keyframe::at(lerp(a.time, b.time, p));
    if a.translate.is_some() || b.translate.is_some() {
        let x = a.translate.unwrap_or([0.0, 0.0]);
        let y = b.translate.unwrap_or([0.0, 0.0]);
        out.translate = Some([lerp(x[0], y[0], p), lerp(x[1], y[1], p)]);
    }
    if a.scale.is_some() || b.scale.is_some() {
        out.scale = Some(lerp(a.scale.unwrap_or(1.0), b.scale.unwrap_or(1.0), p));
    }
    if a.rotation.is_some() || b.rotation.is_some() {
        let x = a.rotation.unwrap_or([0.0; 3]);
        let y = b.rotation.unwrap_or([0.0; 3]);
        out.rotation = Some([
            lerp(x[0], y[0], p),
            lerp(x[1], y[1], p),
            lerp(x[2], y[2], p),
        ]);
    }
    if a.colour.is_some() || b.colour.is_some() {
        // The color switch takes the starting frame's value; only alpha is continuous.
        let mut colour = a.colour.unwrap_or_default();
        let start = a.colour.and_then(|c| c.alpha);
        let end = b.colour.and_then(|c| c.alpha);
        if start.is_some() || end.is_some() {
            colour.alpha = Some(lerp(start.unwrap_or(1.0), end.unwrap_or(1.0), p));
        }
        out.colour = Some(colour);
    }
    // Blocks are interpolated numerically: `scale` and `colour.a` are continuous (the swell-and-shrink of `boxHighlightV2` relies on them), while corner rounding is discrete and takes the starting frame's value.
    if let Some(base) = a.chip.or(b.chip) {
        let start = a.chip.unwrap_or(base);
        let end = b.chip.unwrap_or(base);
        out.chip = Some(Chip {
            scale: lerp(start.scale, end.scale, p),
            alpha: lerp(start.alpha, end.alpha, p),
            corner_rounding: base.corner_rounding,
        });
    }
    out
}

/// The frame of this track at time `t` (0–1). Beyond the first and last frames it takes the first or last frame (CSS `both`).
pub fn sample_at(track: Track, t: f64) -> Keyframe {
    let last = track.keyframes.len() - 1;
    if t <= track.keyframes[0].time {
        return track.normalized(0);
    }
    if t >= track.keyframes[last].time {
        return track.normalized(last);
    }
    for index in 0..last {
        let a = track.normalized(index);
        let b = track.normalized(index + 1);
        if t > b.time {
            continue;
        }
        let span = b.time - a.time;
        let p = if span > 0.0 { (t - a.time) / span } else { 1.0 };
        return tween(a, b, ease01(a.easing, p));
    }
    track.normalized(last)
}

/// The channels of one frame that the panel can consume.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sample {
    /// The accent color swapped in for this style.
    pub tinted: bool,
    /// Opacity.
    pub opacity: f64,
    /// Vertical displacement, **multiples of the element's own size** (`-0.2` = moves up by 20% of its own size).
    pub dy: f64,
    /// Scale multiplier.
    pub scale: f64,
    /// Rotation around the x axis (degrees). When non-zero, it is paired with `perspective(6em)`.
    pub rotate_x_deg: f64,
    /// Rotation around the z axis (degrees). An in-plane tilt, with no perspective.
    pub rotate_z_deg: f64,
    /// Background block.
    pub chip: Option<Chip>,
}

impl Default for Sample {
    fn default() -> Self {
        Self {
            tinted: false,
            opacity: 1.0,
            dy: 0.0,
            scale: 1.0,
            rotate_x_deg: 0.0,
            rotate_z_deg: 0.0,
            chip: None,
        }
    }
}

impl Sample {
    /// Overlays one frame onto this sample. Several tracks of the same animation are stacked in order (prototype `Object.assign`); a later track only overrides the channels **it itself wrote**.
    fn apply(&mut self, kf: Keyframe) {
        if let Some(translate) = kf.translate {
            self.dy = translate[1];
        }
        if let Some(scale) = kf.scale {
            self.scale = scale;
        }
        if let Some(rotation) = kf.rotation {
            self.rotate_x_deg = rotation[0];
            self.rotate_z_deg = rotation[2];
        }
        if let Some(colour) = kf.colour {
            if let Some(alpha) = colour.alpha {
                self.opacity = alpha;
            }
            if colour.has_swap() {
                self.tinted = colour.swaps();
            }
        }
        if let Some(chip) = kf.chip {
            self.chip = Some(chip);
        }
    }
}

/// The state of the `index`-th word when the current word is `current` (prototype `frame()`).
///
/// `phase` is the 0–1 progress within the current word's own window. Words not yet reached take the track's **first frame**, words already spoken take the **last frame**, and the word being spoken takes `phase`. The background block is drawn only on the current word.
pub fn sample_word(anim: &AnimTracks, index: usize, current: usize, phase: f64) -> Sample {
    let mut out = Sample::default();
    for track in anim.tracks.iter().filter(|t| t.scope == Scope::Word) {
        let t = if index > current {
            0.0
        } else if index == current {
            phase
        } else {
            1.0
        };
        let kf = sample_at(*track, t);
        if kf.chip.is_some() && index != current {
            continue;
        }
        out.apply(kf);
    }
    out
}

/// The state of the whole-line tier at this frame (prototype `lineFrame()`).
///
/// `current <= 1` is treated as **still entering**, so the signature frame draws the moment of "coming in". If it stopped on the frame where it has landed, it would look exactly the same as “none”.
pub fn sample_block(anim: &AnimTracks, current: usize, phase: f64) -> Sample {
    let mut out = Sample::default();
    for track in anim.tracks.iter().filter(|t| t.scope == Scope::Block) {
        let t = if current <= 1 { phase } else { 1.0 };
        out.apply(sample_at(*track, t));
    }
    out
}

impl AnimTracks {
    /// Whether this entry has a whole-line tier and / or a per-word tier.
    pub fn has_scope(&self, scope: Scope) -> bool {
        self.tracks.iter().any(|track| track.scope == scope)
    }

    /// Whether there are any tracks at all (prototype `moves`).
    pub fn moves(&self) -> bool {
        !self.tracks.is_empty()
    }

    /// Whether per-word deformation is computed relative to the whole line (prototype `blockScaled`).
    pub fn block_scaled(&self) -> bool {
        self.tracks
            .iter()
            .any(|track| track.scope == Scope::Word && track.block_scaling)
    }

    /// Entry direction arrow (prototype `dir`): **read from the track**, not written separately. A negative displacement means it comes from above.
    pub fn direction(&self) -> Option<&'static str> {
        let y = self
            .tracks
            .iter()
            .filter(|track| track.scope == Scope::Word)
            .fold(0.0, |acc, track| match track.keyframes[0].translate {
                Some([_, y]) if y != 0.0 => y,
                _ => acc,
            });
        if y < 0.0 {
            Some("↓")
        } else if y > 0.0 {
            Some("↑")
        } else {
            None
        }
    }
}

/// Easing name → CSS curve (prototype `EASING`). Sampling does not use it (`ease01` has already taken over); it is kept for surfaces that really run animations.
pub fn easing_curve(name: &str) -> Option<&'static str> {
    Some(match name {
        "sinIn" => "cubic-bezier(0.12, 0, 0.39, 0)",
        "sinOut" | "sinout" => "cubic-bezier(0.61, 1, 0.88, 1)",
        "sinInOut" => "cubic-bezier(0.37, 0, 0.63, 1)",
        "expoOut" => "cubic-bezier(0.16, 1, 0.3, 1)",
        "cubicOut" => "cubic-bezier(0.33, 1, 0.68, 1)",
        "quadOut" => "cubic-bezier(0.5, 1, 0.89, 1)",
        "squareIn" | "squareInOut" => "steps(1, end)",
        "squareOut" => "steps(1, start)",
        _ => return None,
    })
}

/// Continuous sampling uses analytic easing, not CSS bezier approximations or
/// the legacy 35% signature samples above.
pub fn continuous_ease(name: &str, p: f64) -> f64 {
    let p = p.clamp(0.0, 1.0);
    match name {
        "sinIn" => 1.0 - (p * std::f64::consts::FRAC_PI_2).cos(),
        "sinOut" | "sinout" => (p * std::f64::consts::FRAC_PI_2).sin(),
        "sinInOut" => (1.0 - (p * std::f64::consts::PI).cos()) / 2.0,
        "expoOut" => {
            if p >= 1.0 {
                1.0
            } else {
                1.0 - 2.0_f64.powf(-10.0 * p)
            }
        }
        "cubicOut" => 1.0 - (1.0 - p).powi(3),
        "quadOut" => 1.0 - (1.0 - p).powi(2),
        // Step easings: hold the start, jump to the end, or round at the midpoint.
        "squareIn" => 0.0,
        "squareOut" => 1.0,
        "squareInOut" => p.round(),
        _ => p,
    }
}

pub fn continuous_at(track: Track, t: f64) -> Keyframe {
    let last = track.keyframes.len() - 1;
    if t <= track.keyframes[0].time {
        return track.normalized(0);
    }
    if t >= track.keyframes[last].time {
        return track.normalized(last);
    }
    for index in 0..last {
        let a = track.normalized(index);
        let b = track.normalized(index + 1);
        if t < b.time {
            // A segment uses the easing of its end keyframe `b`.
            // squareInOut rounds track time, not segment progress.
            return tween(
                a,
                b,
                continuous_ease(
                    b.easing,
                    if b.easing == "squareInOut" {
                        t
                    } else {
                        (t - a.time) / (b.time - a.time)
                    },
                ),
            );
        }
    }
    track.normalized(last)
}

/// Renderer-neutral pose; the Canvas and native painters consume these numbers.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pose {
    pub opacity: f64,
    pub scale: f64,
    pub dy: f64,
    pub rx: f64,
    pub ry: f64,
    pub rz: f64,
    pub tint: bool,
    pub chip: Option<Chip>,
    pub centered: bool,
    pub block_scaled: bool,
}

impl Default for Pose {
    fn default() -> Self {
        Self {
            opacity: 1.0,
            scale: 1.0,
            dy: 0.0,
            rx: 0.0,
            ry: 0.0,
            rz: 0.0,
            tint: false,
            chip: None,
            centered: false,
            block_scaled: false,
        }
    }
}

impl Pose {
    fn apply(&mut self, frame: Keyframe, track: Track, series: u32, random: f64) {
        if let Some([_, y]) = frame.translate {
            self.dy = y;
        }
        if let Some(scale) = frame.scale {
            self.scale = scale;
        }
        if let Some([x, y, z]) = frame.rotation {
            self.rx = x;
            self.ry = y;
            self.rz = z;
            // Flip all axes first, then add offsetWindow.
            let window = match track.kf {
                "rotateFlipClock" => 5.0,
                "randomRotate" => 3.0,
                _ => 0.0,
            };
            if window > 0.0 {
                let direction = if series % 2 == 0 { 1.0 } else { -1.0 };
                self.rx = x * direction;
                self.ry = y * direction
                    + if track.kf == "randomRotate" {
                        random * 0.5
                    } else {
                        0.0
                    };
                self.rz = z * direction + (random * 2.0 - 1.0) * window;
            }
        }
        if let Some(colour) = frame.colour {
            if let Some(alpha) = colour.alpha {
                self.opacity = alpha;
            }
            if colour.has_swap() {
                self.tint = colour.swaps();
            }
        }
        if frame.chip.is_some() {
            self.chip = frame.chip;
        }
        self.centered |= track.centre_elements;
        self.block_scaled |= track.block_scaling;
    }
}

/// Top-left 2×2 of the Rx · Ry · Rz rotation matrix, scaled by `pose.scale`.
pub fn projected_matrix(pose: &Pose) -> [f64; 4] {
    let (sx, cx) = pose.rx.to_radians().sin_cos();
    let (sy, cy) = pose.ry.to_radians().sin_cos();
    let (sz, cz) = pose.rz.to_radians().sin_cos();
    [
        cy * cz,
        cx * sz + sx * sy * cz,
        -cy * sz,
        cx * cz - sx * sy * sz,
    ]
    .map(|v| v * pose.scale)
}

#[derive(Clone, Debug, serde::Serialize)]
pub struct MotionFrame {
    pub block: Pose,
    pub words: Vec<Pose>,
}

pub fn by_id(id: &str) -> Option<&'static AnimTracks> {
    WORD_ANIM_TRACKS.iter().find(|a| a.catalog_id == id)
}

/// Timing is separate from `group`: only flipClock/stomp use
/// min(cue duration * .7, 1s); scaleIn/rotateFlipClock still use duration/words.
/// Word start/end comes from alignment; callers supply actual, nonuniform times.
pub fn motion_frame(
    id: &str,
    elapsed: f64,
    duration: f64,
    words: &[(f64, f64)],
    series: u32,
) -> MotionFrame {
    motion_frame_seeded(id, elapsed, duration, words, series, series)
}

/// Seed for std::seed_seq → MT19937, taken from the first four item-id bytes.
pub fn item_seed(id: &str) -> u32 {
    let mut bytes = *b"1234";
    for (out, byte) in bytes.iter_mut().zip(id.bytes()) {
        *out = byte;
    }
    // The first three char values are sign-extended (signed `char`).
    (bytes[0] as i8 as u32)
        | ((bytes[1] as i8 as u32) << 8)
        | ((bytes[2] as i8 as u32) << 16)
        | (u32::from(bytes[3]) << 24)
}

/// First uniform float from a one-value seed_seq / MT19937 path.
pub fn seeded_unit(seed: u32) -> f64 {
    let mut state = [0x8b8b8b8b_u32; 624];
    let mix = |x: u32| x ^ (x >> 27);
    let r1 = 1664525_u32.wrapping_mul(mix(state[0] ^ state[306] ^ state[623]));
    let r2 = r1.wrapping_add(1);
    state[306] = state[306].wrapping_add(r1);
    state[317] = state[317].wrapping_add(r2);
    state[0] = r2;
    for k in 1..624 {
        let r1 = 1664525_u32.wrapping_mul(mix(state[k] ^ state[(k + 306) % 624] ^ state[k - 1]));
        let r2 = r1
            .wrapping_add(k as u32)
            .wrapping_add(if k == 1 { seed } else { 0 });
        state[(k + 306) % 624] = state[(k + 306) % 624].wrapping_add(r1);
        state[(k + 317) % 624] = state[(k + 317) % 624].wrapping_add(r2);
        state[k] = r2;
    }
    for k in 624..1248 {
        let j = k % 624;
        let r3 = 1566083941_u32.wrapping_mul(mix(state[j]
            .wrapping_add(state[(k + 306) % 624])
            .wrapping_add(state[(k - 1) % 624])));
        let r4 = r3.wrapping_sub(j as u32);
        state[(k + 306) % 624] ^= r3;
        state[(k + 317) % 624] ^= r4;
        state[j] = r4;
    }
    let mut y = state[397]
        ^ (((state[0] & 0x80000000) | (state[1] & 0x7fffffff)) >> 1)
        ^ if state[1] & 1 != 0 { 0x9908b0df } else { 0 };
    y ^= y >> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >> 18;
    f64::from(y as f32 * 2.3283064e-10_f32)
}

pub fn motion_frame_seeded(
    id: &str,
    elapsed: f64,
    duration: f64,
    words: &[(f64, f64)],
    series: u32,
    seed: u32,
) -> MotionFrame {
    let mut result = MotionFrame {
        block: Pose::default(),
        words: vec![Pose::default(); words.len()],
    };
    let Some(anim) = by_id(id) else {
        return result;
    };
    let duration = duration.max(0.001);
    let length = if matches!(id, "flipClock" | "stomp") {
        (duration * 0.7).min(1.0)
    } else {
        duration / words.len().max(1) as f64
    };
    let current = words.iter().rposition(|(start, _)| elapsed >= *start);
    let random = if matches!(id, "rotateFlipClock" | "rotateHighlight") {
        seeded_unit(seed)
    } else {
        0.5
    };
    for track in anim.tracks {
        if track.scope == Scope::Block {
            result.block.apply(
                continuous_at(*track, elapsed / length),
                *track,
                series,
                random,
            );
        } else {
            for (index, (start, end)) in words.iter().enumerate() {
                let t = ((elapsed - start) / (end - start).max(0.001)).clamp(0.0, 1.0);
                let mut sample = continuous_at(*track, t);
                if sample.chip.is_some() && (current != Some(index) || elapsed >= *end) {
                    sample.chip = None;
                }
                result.words[index].apply(sample, *track, series, random);
            }
        }
    }
    result
}

/// Panel sample sentence: four words, 0.5 seconds each, then a 0.5s rest.
pub fn demo_frame(id: &str, seconds: f64) -> MotionFrame {
    let seconds = if seconds.is_finite() {
        seconds.max(0.0)
    } else {
        0.675
    };
    motion_frame(
        id,
        seconds % 2.5,
        2.0,
        &[(0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0)],
        (seconds / 2.5).floor() as u32,
    )
}

#[cfg(test)]
mod continuous_tests {
    use super::*;
    /// Fixed points for demo frames, seeds and projection matrices.
    #[test]
    fn demo_frame_seed_and_projection_match_fixed_points() {
        assert!(demo_frame("rotateFlipClock", 2.6).block.rx > 0.0);
        assert_eq!(item_seed(""), 0x34333231);
        assert_eq!(item_seed("abcdef"), 0x64636261);
        let projected = projected_matrix(&Pose {
            rx: -45.0,
            rz: 30.0,
            ..Pose::default()
        });
        // X is applied before Z; column-major XY coefficients.
        for (actual, expected) in projected.into_iter().zip([
            0.8660253882408142,
            0.3535533845424652,
            -0.5,
            0.6123723983764648,
        ]) {
            assert!((actual - expected).abs() < 2e-6);
        }
    }
    #[test]
    fn continuous_prototype_and_native_frames_match_at_boundaries_and_between_them() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let script = "global.window={};require('./designs/cuccut/app/model-subanim.js');require('./designs/cuccut/app/model-subcanvas.js');console.log(JSON.stringify(window.BC_SA.ANIMS.flatMap(a=>Array.from({length:101},(_,i)=>window.BC_SC.frame(a.k,i/20)))));";
        let output = std::process::Command::new("node")
            .args(["-e", script])
            .current_dir(root)
            .output()
            .expect("node is required for cross-surface motion parity");
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let javascript: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout).unwrap();
        fn compare(a: &serde_json::Value, b: &serde_json::Value, path: &str) {
            match (a, b) {
                (serde_json::Value::Number(a), serde_json::Value::Number(b)) => assert!(
                    (a.as_f64().unwrap() - b.as_f64().unwrap()).abs() < 1e-8,
                    "{path}: {a} != {b}"
                ),
                (serde_json::Value::Object(a), serde_json::Value::Object(b)) => {
                    for (key, value) in a {
                        compare(value, &b[key], &format!("{path}.{key}"));
                    }
                }
                (serde_json::Value::Array(a), serde_json::Value::Array(b)) => {
                    assert_eq!(a.len(), b.len());
                    for (i, (a, b)) in a.iter().zip(b).enumerate() {
                        compare(a, b, &format!("{path}[{i}]"));
                    }
                }
                _ => assert_eq!(a, b, "{path}"),
            }
        }
        for (anim_index, anim) in WORD_ANIM_TRACKS.iter().enumerate() {
            for index in 0..101 {
                let rust =
                    serde_json::to_value(demo_frame(anim.catalog_id, index as f64 / 20.0)).unwrap();
                compare(
                    &rust,
                    &javascript[anim_index * 101 + index],
                    &format!("{} at {}", anim.catalog_id, index as f64 / 20.0),
                );
            }
        }
    }
    #[test]
    fn flip_uses_continuous_easing_and_never_restarts_on_each_word() {
        let early = demo_frame("flipClock", 0.1).block;
        assert!((early.opacity - 0.5).abs() < 1e-8);
        assert!((early.rx + 45.0).abs() < 1e-8);
        assert_eq!(demo_frame("flipClock", 1.1).block.rx, 0.0);
    }
    #[test]
    fn centered_words_and_alternating_angles_survive_sampling() {
        assert!(
            demo_frame("impactPop", 0.7)
                .words
                .iter()
                .all(|p| p.centered)
        );
        let a = demo_frame("rotateFlipClock", 0.7).block.rz;
        let b = demo_frame("rotateFlipClock", 3.2).block.rz;
        assert!((5.0..=15.0).contains(&a));
        assert!((-15.0..=-5.0).contains(&b));
    }
    #[test]
    fn nonuniform_alignment_uses_word_windows_and_stops_chips_in_gaps() {
        let times = [(0.0, 0.1), (0.3, 1.0)];
        assert!(
            motion_frame("boxHighlight", 0.2, 1.0, &times, 0)
                .words
                .iter()
                .all(|p| p.chip.is_none())
        );
        assert!(
            motion_frame("boxHighlight", 0.4, 1.0, &times, 0).words[1]
                .chip
                .is_some()
        );
    }
}

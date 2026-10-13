//! The value ranges and defaults used by engine validation: the UI's number inputs are capped by them and take their initial values from them, so the numbers are not copied again in TS.
//!
//! Only the engine's rules live here; the slider's common ranges, step sizes and readout multipliers are UI design and stay in the UI. Ranges include both ends and are written as `[min, max]`.

use serde::Serialize;
use timeline::animations::{DURATION_MAX, DURATION_MIN, INTENSITY_MAX, INTENSITY_MIN, PERIOD_MAX, PERIOD_MIN};
use timeline::duck::{DUCK_ATTACK_DEFAULT, DUCK_DEPTH_DEFAULT, DUCK_DEPTH_RANGE, DUCK_RELEASE_DEFAULT, DUCK_TIME_RANGE};
use timeline::keyframes::{KEYFRAMES_MAX_PER_PROP, OPACITY_RANGE, PERCENT_RANGE, VOLUME_RANGE};
use timeline::schema::{
    CONFETTI_ANGLE_RANGE, CONFETTI_COUNT_RANGE, CONFETTI_GRAVITY_RANGE, CONFETTI_INTERVAL_RANGE, CONFETTI_MAX_COLORS,
    CONFETTI_OPACITY_RANGE, CONFETTI_ORIGIN_RANGE, CONFETTI_RATE_RANGE, CONFETTI_RATE_SCALE_RANGE, CONFETTI_SCALE_RANGE, CONFETTI_SHAPES,
    CONFETTI_SPREAD_RANGE, CONFETTI_WIND_RANGE, FX_ADJUST_RANGE, FX_AMOUNT_RANGE, FX_BLUR_RANGE,
};
use video_model::{FX_SHADOW_BLUR_RANGE, FX_SHADOW_OPACITY_RANGE, FX_STROKE_WIDTH_MAX, FX_TEMPERATURE_RANGE};

use crate::EntryError;

type Range = [f64; 2];

const fn range((lo, hi): (f64, f64)) -> Range {
    [lo, hi]
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Ranges {
    fx: FxRanges,
    ducking: DuckingRanges,
    /// Instance volume and volume envelopes (linear multipliers).
    volume: Range,
    keyframes: KeyframeRanges,
    animation: AnimationRanges,
    confetti: ConfettiRanges,
}

/// `fx` (video format spec §3.9).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FxRanges {
    /// `grayscale`、`sharpen`、`noise`、`vignette`、`effectIntensity`。
    amount: Range,
    /// `brightness`、`contrast`、`exposure`、`hue`、`saturation`。
    adjust: Range,
    temperature: Range,
    /// `blur` (pixels at a 540 short side).
    blur: Range,
    /// `shadow.blur` (pixels at a 540 short side).
    shadow_blur: Range,
    /// `shadow.opacity`。
    shadow_opacity: Range,
    /// The upper limit of `stroke.width` (pixels at a 540 short side); the lower bound excludes 0.
    stroke_width_max: f64,
}

/// Ducking (§3.9): how many dB to lower, how many seconds the attack and release take, and the default when `setDucking` gives none.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DuckingRanges {
    depth: Range,
    /// `attack` and `release`.
    time: Range,
    defaults: DuckingDefaults,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DuckingDefaults {
    depth: f64,
    attack: f64,
    release: f64,
}

/// Keyframes: the maximum number per property, and the values for each property.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KeyframeRanges {
    max_per_prop: usize,
    opacity: Range,
    volume: Range,
    percent: Range,
}

/// The durations (seconds), periods (seconds) and intensities of the enter, exit and loop animations.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnimationRanges {
    duration: Range,
    period: Range,
    intensity: Range,
}

/// The parameters of confetti (`confetti`): multipliers, wind, opacity, the ranges for emission and origin, the palette limit, and the closed set of shape values.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfettiRanges {
    /// The maximum number of colors in a palette.
    max_colors: usize,
    /// The 12 unit shapes (in the property page's order).
    shapes: &'static [&'static str],
    size: Range,
    speed: Range,
    gravity: Range,
    drift: Range,
    spin: Range,
    /// px/s² at the 540 short-side reference.
    wind: Range,
    opacity: Range,
    /// `emit.rate` (particles per second).
    rate: Range,
    /// `emit.count` (the number per burst).
    count: Range,
    /// `emit.interval` (seconds; 0 = emit once only).
    interval: Range,
    /// Emission direction (degrees).
    angle: Range,
    /// Emission fan angle (degrees).
    spread: Range,
    /// `origin.x` and `origin.y` (% within the box).
    origin: Range,
}

/// The input is not read (by convention pass `{}`); the result is the whole table above.
pub fn engine_ranges(_input: &[u8]) -> Result<String, EntryError> {
    let ranges = Ranges {
        fx: FxRanges {
            amount: range(FX_AMOUNT_RANGE),
            adjust: range(FX_ADJUST_RANGE),
            temperature: range(FX_TEMPERATURE_RANGE),
            blur: range(FX_BLUR_RANGE),
            shadow_blur: range(FX_SHADOW_BLUR_RANGE),
            shadow_opacity: range(FX_SHADOW_OPACITY_RANGE),
            stroke_width_max: FX_STROKE_WIDTH_MAX,
        },
        ducking: DuckingRanges {
            depth: range(DUCK_DEPTH_RANGE),
            time: range(DUCK_TIME_RANGE),
            defaults: DuckingDefaults {
                depth: DUCK_DEPTH_DEFAULT,
                attack: DUCK_ATTACK_DEFAULT,
                release: DUCK_RELEASE_DEFAULT,
            },
        },
        volume: range(VOLUME_RANGE),
        keyframes: KeyframeRanges {
            max_per_prop: KEYFRAMES_MAX_PER_PROP,
            opacity: range(OPACITY_RANGE),
            volume: range(VOLUME_RANGE),
            percent: range(PERCENT_RANGE),
        },
        animation: AnimationRanges {
            duration: [DURATION_MIN, DURATION_MAX],
            period: [PERIOD_MIN, PERIOD_MAX],
            intensity: [INTENSITY_MIN, INTENSITY_MAX],
        },
        confetti: ConfettiRanges {
            max_colors: CONFETTI_MAX_COLORS,
            shapes: CONFETTI_SHAPES,
            size: range(CONFETTI_SCALE_RANGE),
            speed: range(CONFETTI_SCALE_RANGE),
            gravity: range(CONFETTI_GRAVITY_RANGE),
            drift: range(CONFETTI_RATE_SCALE_RANGE),
            spin: range(CONFETTI_RATE_SCALE_RANGE),
            wind: range(CONFETTI_WIND_RANGE),
            opacity: range(CONFETTI_OPACITY_RANGE),
            rate: range(CONFETTI_RATE_RANGE),
            count: range(CONFETTI_COUNT_RANGE),
            interval: range(CONFETTI_INTERVAL_RANGE),
            angle: range(CONFETTI_ANGLE_RANGE),
            spread: range(CONFETTI_SPREAD_RANGE),
            origin: range(CONFETTI_ORIGIN_RANGE),
        },
    };
    Ok(serde_json::to_string(&ranges).expect("ranges always serialize"))
}

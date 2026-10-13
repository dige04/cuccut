//! Evaluation of the volume envelope (`mix.envelope`, `embeddedAudio.envelope`, and the synthesized `audio.envelope` in format spec §3.9): shared by the per-frame plan (preview) and the interval plan (export).
//!
//! The envelope replaces the instance's `volume`: when there are effective points, the volume at a given moment is the envelope's sampled value at that moment. After the points are converted to v2 `volume` keyframes, they are handed to `timeline::duck::volume_curve` (the same function shared by v2 preview and export): linear segments take only the points themselves, while eased segments are baked into a polyline at `ENVELOPE_BAKE_STEP` (0.02 s); points whose `at` lies past the instance's end have no effect; values are clamped to [0, 4]. The polyline takes its first point's value before the first point, and the last point's value after the last point (`GainEnvelope::at`). Times are in seconds local to the instance (sequence time minus the instance start), and percentages are relative to the instance's length.

use editor_semantics::{MediaTime, Ratio};
use timeline::duck::{GainEnvelope, volume_curve};
use timeline::keyframes::{KeyTime, Keyframe, Keyframes};
use video_model::{CompositionItem, EnvelopePoint, TimelineItem};

/// The maximum number of points (same as keyframes).
pub const MAX_ENVELOPE_POINTS: usize = timeline::keyframes::KEYFRAMES_MAX_PER_PROP;

/// The instance's volume envelope: `None` when there is no envelope (the static `volume` is used).
pub fn envelope_points(item: &TimelineItem) -> Option<&[EnvelopePoint]> {
    let envelope = match item {
        TimelineItem::Audio(a) => &a.mix.envelope,
        TimelineItem::Video(v) => &v.embedded_audio.envelope,
        TimelineItem::Composition(CompositionItem { audio: Some(audio), .. }) => &audio.envelope,
        _ => return None,
    };
    (!envelope.is_empty()).then_some(envelope.as_slice())
}

/// Converts the volume envelope into v2 `volume` keyframes: `at` is seconds local to the instance, and `percent` is written as `"N%"`. Rejects a point count over the limit, negative times, and any point where `at` and `percent` are not exactly one of them (the engine uses this to validate on write).
pub fn envelope_keyframes(points: &[EnvelopePoint]) -> Result<Vec<Keyframe>, String> {
    if points.len() > MAX_ENVELOPE_POINTS {
        return Err(format!("a volume envelope allows at most {MAX_ENVELOPE_POINTS} points"));
    }
    let mut frames = Vec::with_capacity(points.len());
    for point in points {
        let t = match (&point.at, point.percent) {
            (Some(at), None) => {
                let s = seconds(at);
                if s < 0.0 {
                    return Err("volume envelope times must not be negative".into());
                }
                KeyTime::Seconds(s)
            }
            (None, Some(percent)) => KeyTime::Percent(format!("{percent}%")),
            _ => return Err("each volume envelope point must specify exactly one of at and percent".into()),
        };
        frames.push(Keyframe {
            t,
            v: point.volume,
            ease: point.ease.clone(),
        });
    }
    Ok(frames)
}

fn seconds(t: &MediaTime) -> f64 {
    t.to_ratio("time").map(Ratio::to_f64).unwrap_or(f64::NAN)
}

/// The instance's volume curve: when `points` is empty it is the constant `volume`; otherwise it is the polyline baked from the envelope (seconds local to the instance, linear multipliers).
/// `duration` is the instance's length on the sequence (seconds), used to convert percentage points. A malformed envelope (which the engine would not write into a video) is treated as having no envelope.
#[derive(Clone, Debug, PartialEq)]
pub enum VolumeCurve {
    Constant(f64),
    Envelope(GainEnvelope),
}

impl VolumeCurve {
    pub fn new(volume: f64, points: &[EnvelopePoint], duration: f64) -> VolumeCurve {
        if points.is_empty() {
            return VolumeCurve::Constant(volume);
        }
        let Ok(frames) = envelope_keyframes(points) else {
            return VolumeCurve::Constant(volume);
        };
        let keyframes = Keyframes {
            volume: Some(frames),
            ..Keyframes::default()
        };
        VolumeCurve::Envelope(GainEnvelope(volume_curve(volume, Some(&keyframes), duration)))
    }

    /// The volume (linear multiplier) at `local` seconds into the instance.
    pub fn at(&self, local: f64) -> f64 {
        match self {
            VolumeCurve::Constant(volume) => *volume,
            VolumeCurve::Envelope(envelope) => envelope.at(local),
        }
    }
}

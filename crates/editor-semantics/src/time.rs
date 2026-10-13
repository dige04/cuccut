//! Time types and rules (video format spec §2). This is the single source of semantics for `parseDecimalSeconds`, `compareTime`,
//! `mapTime`, `quantizeFrame`, and `timestampAt` (§2.13); hosts only receive results.

use message_ref::{Text, msg};
use serde::{Deserialize, Serialize};

use crate::ratio::Ratio;

/// Version of the time contract (§2.13, TIME-08). Any change to rounding or sampling rules must bump it.
pub const TIME_CONTRACT_VERSION: u32 = 1;

/// Safe-integer upper bound in JSON (2^53 − 1). Frame numbers, timescale, and the numerator and denominator of Rate all stay within it.
pub const MAX_SAFE_INTEGER: i128 = (1 << 53) - 1;

/// Maximum integer and fractional digits accepted for decimal seconds. Exceeding them reports overflow rather than truncating.
const MAX_INT_DIGITS: usize = 18;
const MAX_FRAC_DIGITS: usize = 18;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TimeError {
    /// Invalid decimal, negative absolute position, or zero timebase (`INVALID_TIME_VALUE`).
    Invalid { field: String, reason: Text },
    /// Input or intermediate value exceeds the contract limit (`TIME_ARITHMETIC_OVERFLOW`).
    Overflow { field: String },
    /// An `exact-frame` request is not on a frame boundary (`TIME_NOT_ON_FRAME_GRID`).
    NotOnFrameGrid {
        requested: MediaTime,
        floor: i64,
        ceil: i64,
        nearest: i64,
    },
}

impl TimeError {
    pub fn code(&self) -> &'static str {
        match self {
            TimeError::Invalid { .. } => "INVALID_TIME_VALUE",
            TimeError::Overflow { .. } => "TIME_ARITHMETIC_OVERFLOW",
            TimeError::NotOnFrameGrid { .. } => "TIME_NOT_ON_FRAME_GRID",
        }
    }

    fn invalid(field: &str, reason: Text) -> TimeError {
        TimeError::Invalid {
            field: field.to_string(),
            reason,
        }
    }

    fn overflow(field: &str) -> TimeError {
        TimeError::Overflow { field: field.to_string() }
    }
}

/// Frame rate: a positive rational number, reduced (§2.3).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rate {
    pub num: i64,
    pub den: i64,
}

impl Rate {
    pub fn new(num: i64, den: i64) -> Result<Rate, TimeError> {
        let rate = Rate { num, den };
        rate.validate("rate")?;
        Ok(rate)
    }

    /// Safe integers with a positive numerator and denominator, already reduced. A Rate that is not reduced is rejected, so that one frame rate cannot be written in two ways.
    pub fn validate(&self, field: &str) -> Result<(), TimeError> {
        let (num, den) = (self.num as i128, self.den as i128);
        if num <= 0 || den <= 0 {
            return Err(TimeError::invalid(field, msg!("time.rateNotPositive", "Frame rate numerator and denominator must be positive")));
        }
        if num > MAX_SAFE_INTEGER || den > MAX_SAFE_INTEGER {
            return Err(TimeError::overflow(field));
        }
        let reduced = self.ratio();
        if reduced.num() != num || reduced.den() != den {
            return Err(TimeError::invalid(field, msg!("time.rateNotReduced", "Frame rate must be in lowest terms")));
        }
        Ok(())
    }

    pub fn ratio(self) -> Ratio {
        Ratio::new(self.num as i128, self.den as i128).expect("Rate was already validated")
    }

    /// Duration of one frame (seconds).
    pub fn frame_duration(self) -> Ratio {
        Ratio::new(self.den as i128, self.num as i128).expect("Rate was already validated")
    }
}

/// `ticks / timescale` seconds. `ticks` is a signed decimal integer string (§2.3).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaTime {
    pub ticks: String,
    pub timescale: i64,
}

impl MediaTime {
    /// Canonical form: the value after reduction. timescale must be a safe integer.
    pub fn from_ratio(value: Ratio, field: &str) -> Result<MediaTime, TimeError> {
        if value.den() > MAX_SAFE_INTEGER {
            return Err(TimeError::overflow(field));
        }
        Ok(MediaTime {
            ticks: value.num().to_string(),
            timescale: value.den() as i64,
        })
    }

    pub fn zero() -> MediaTime {
        MediaTime {
            ticks: "0".into(),
            timescale: 1,
        }
    }

    /// Parses by value; 1500/1000 and 3/2 yield the same `Ratio` (§2.3, TM05).
    pub fn to_ratio(&self, field: &str) -> Result<Ratio, TimeError> {
        if self.timescale <= 0 {
            return Err(TimeError::invalid(field, msg!("time.timescaleNotPositive", "timescale must be greater than 0")));
        }
        if self.timescale as i128 > MAX_SAFE_INTEGER {
            return Err(TimeError::overflow(field));
        }
        let ticks = parse_integer(&self.ticks, field)?;
        Ratio::new(ticks, self.timescale as i128).ok_or_else(|| TimeError::overflow(field))
    }

    /// Canonical value used for cache keys (§2.13).
    pub fn canonical_key(&self, field: &str) -> Result<String, TimeError> {
        Ok(self.to_ratio(field)?.canonical())
    }
}

fn parse_integer(text: &str, field: &str) -> Result<i128, TimeError> {
    let digits = text.strip_prefix('-').unwrap_or(text);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return Err(TimeError::invalid(field, msg!("time.notInteger", "Not a decimal integer: \"{text}\"", text)));
    }
    if digits.len() > 1 && digits.starts_with('0') {
        return Err(TimeError::invalid(field, msg!("time.leadingZero", "Integers cannot have leading zeros")));
    }
    if digits.len() > MAX_INT_DIGITS {
        return Err(TimeError::overflow(field));
    }
    text.parse::<i128>().map_err(|_| TimeError::overflow(field))
}

/// Exact parsing of decimal seconds (§2.8, TM05, TM06).
///
/// Syntax: an optional minus sign, at least one integer digit, and an optional fractional part (at least one digit after the point).
/// Does not accept a plus sign, exponent, NaN, Infinity, whitespace, or thousands separators. Exceeding the digit count or contract limit reports overflow rather than truncating.
pub fn parse_decimal_seconds(text: &str, field: &str) -> Result<Ratio, TimeError> {
    let (negative, body) = match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text),
    };
    let (int_part, frac_part) = match body.split_once('.') {
        Some((i, f)) => (i, Some(f)),
        None => (body, None),
    };
    let is_digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    if !is_digits(int_part) || frac_part.is_some_and(|f| !is_digits(f)) {
        return Err(TimeError::invalid(field, msg!("time.notDecimalSeconds", "Not decimal seconds: \"{text}\"", text)));
    }
    let frac = frac_part.unwrap_or("");
    if int_part.len() > MAX_INT_DIGITS || frac.len() > MAX_FRAC_DIGITS {
        return Err(TimeError::overflow(field));
    }
    let digits = format!("{int_part}{frac}");
    let mut num: i128 = digits.parse().map_err(|_| TimeError::overflow(field))?;
    if negative {
        num = -num;
    }
    let den = 10i128.pow(frac.len() as u32);
    let value = Ratio::new(num, den).ok_or_else(|| TimeError::overflow(field))?;
    if value.den() > MAX_SAFE_INTEGER {
        return Err(TimeError::overflow(field));
    }
    Ok(value)
}

/// Writes an exact seconds value back as a decimal string. It is a finite decimal only when the denominator is a power of 2 and 5; otherwise `None`.
pub fn format_decimal_seconds(value: Ratio) -> Option<String> {
    let mut den = value.den();
    let mut scale = 0u32;
    while den % 10 == 0 {
        den /= 10;
        scale += 1;
    }
    while den % 2 == 0 || den % 5 == 0 {
        if den % 2 == 0 {
            den /= 2;
        } else {
            den /= 5;
        }
        scale += 1;
    }
    if den != 1 || scale > MAX_FRAC_DIGITS as u32 {
        return None;
    }
    let scaled = value.num().checked_mul(10i128.pow(scale))? / value.den();
    let negative = scaled < 0;
    let digits = scaled.unsigned_abs().to_string();
    let text = if scale == 0 {
        digits
    } else {
        let padded = format!("{digits:0>width$}", width = scale as usize + 1);
        let (i, f) = padded.split_at(padded.len() - scale as usize);
        format!("{i}.{f}")
    };
    Some(if negative { format!("-{text}") } else { text })
}

/// Compares two times exactly (by value, not by string).
pub fn compare_time(a: &MediaTime, b: &MediaTime) -> Result<std::cmp::Ordering, TimeError> {
    Ok(a.to_ratio("a")?.cmp(&b.to_ratio("b")?))
}

/// Visual time input: seconds and frames are mutually exclusive (§2.8).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "unit", rename_all = "lowercase", deny_unknown_fields)]
pub enum TimelineTimeInput {
    Seconds { value: String },
    Frames { value: i64 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FrameAlignment {
    ExactFrame,
    NearestFrame,
    FloorFrame,
    CeilFrame,
}

impl TimelineTimeInput {
    /// Exact time that the input parses to. Frame input is converted using the frame rate of the sequence the command belongs to (no other time domain is accepted).
    /// `allow_negative` is only for relative offsets; absolute positions cannot be negative (§2.4).
    pub fn resolve(&self, fps: Rate, field: &str, allow_negative: bool) -> Result<Ratio, TimeError> {
        let value = match self {
            TimelineTimeInput::Seconds { value } => parse_decimal_seconds(value, field)?,
            TimelineTimeInput::Frames { value } => {
                let frame = *value as i128;
                if frame.abs() > MAX_SAFE_INTEGER {
                    return Err(TimeError::overflow(field));
                }
                frame_time(frame, fps).ok_or_else(|| TimeError::overflow(field))?
            }
        };
        if !allow_negative && value.is_negative() {
            return Err(TimeError::invalid(field, msg!("time.negativePosition", "An absolute position cannot be negative")));
        }
        Ok(value)
    }
}

/// Exact time of a frame boundary: `frame × den / num`.
pub fn frame_time(frame: i128, fps: Rate) -> Option<Ratio> {
    Ratio::from_int(frame)?.checked_mul(fps.frame_duration())
}

/// Position of an exact time on the frame grid (it need not be an integer).
pub fn frames_at(time: Ratio, fps: Rate) -> Option<Ratio> {
    time.checked_mul(fps.ratio())
}

/// Quantizes an exact time to a frame boundary according to the alignment policy (§2.6). With `nearest-frame`, a time exactly at the midpoint takes the earlier boundary.
pub fn quantize_frame(time: Ratio, fps: Rate, policy: FrameAlignment, field: &str) -> Result<i64, TimeError> {
    let x = frames_at(time, fps).ok_or_else(|| TimeError::overflow(field))?;
    let floor = x.floor();
    let fract = x.fract();
    let half = Ratio::new(1, 2).expect("constant");
    let nearest = if fract > half { floor + 1 } else { floor };
    let frame = match policy {
        FrameAlignment::FloorFrame => floor,
        FrameAlignment::CeilFrame => x.ceil(),
        FrameAlignment::NearestFrame => nearest,
        FrameAlignment::ExactFrame => {
            if !x.is_integer() {
                return Err(TimeError::NotOnFrameGrid {
                    requested: MediaTime::from_ratio(time, field)?,
                    floor: to_frame(floor, field)?,
                    ceil: to_frame(x.ceil(), field)?,
                    nearest: to_frame(nearest, field)?,
                });
            }
            floor
        }
    };
    to_frame(frame, field)
}

fn to_frame(frame: i128, field: &str) -> Result<i64, TimeError> {
    if frame.abs() > MAX_SAFE_INTEGER {
        return Err(TimeError::overflow(field));
    }
    Ok(frame as i64)
}

/// Quantization receipt (§2.9): the requested formatted value, exact value, actual landing point, and deviation.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeQuantizationReceipt {
    pub domain: SequenceDomain,
    pub sequence_revision: String,
    pub edit_fps: Rate,
    pub requested: TimelineTimeInput,
    pub requested_time: MediaTime,
    pub actual_frame: i64,
    pub actual_time: MediaTime,
    pub delta: MediaTime,
    pub policy: FrameAlignment,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceDomain {
    pub kind: SequenceDomainKind,
    pub sequence_id: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SequenceDomainKind {
    Sequence,
}

/// One quantization: parses the input, snaps it to a frame according to the policy, and returns a receipt.
pub struct Quantized {
    pub frame: i64,
    pub receipt: TimeQuantizationReceipt,
}

pub struct GridContext<'a> {
    pub sequence_id: &'a str,
    pub sequence_revision: &'a str,
    pub fps: Rate,
}

/// Absolute position: parse → quantize once → receipt.
pub fn quantize_input(
    input: &TimelineTimeInput,
    grid: &GridContext<'_>,
    policy: FrameAlignment,
    field: &str,
) -> Result<Quantized, TimeError> {
    let requested = input.resolve(grid.fps, field, false)?;
    quantize_exact(requested, input.clone(), grid, policy, field)
}

/// Quantizes an already computed exact target (for example, “current position + relative offset”) once (TM07: compute the absolute target first, then quantize).
pub fn quantize_exact(
    requested: Ratio,
    input: TimelineTimeInput,
    grid: &GridContext<'_>,
    policy: FrameAlignment,
    field: &str,
) -> Result<Quantized, TimeError> {
    if requested.is_negative() {
        return Err(TimeError::invalid(field, msg!("time.negativePosition", "An absolute position cannot be negative")));
    }
    let frame = quantize_frame(requested, grid.fps, policy, field)?;
    let actual = frame_time(frame as i128, grid.fps).ok_or_else(|| TimeError::overflow(field))?;
    let delta = actual.checked_sub(requested).ok_or_else(|| TimeError::overflow(field))?;
    Ok(Quantized {
        frame,
        receipt: TimeQuantizationReceipt {
            domain: SequenceDomain {
                kind: SequenceDomainKind::Sequence,
                sequence_id: grid.sequence_id.to_string(),
            },
            sequence_revision: grid.sequence_revision.to_string(),
            edit_fps: grid.fps,
            requested: input,
            requested_time: MediaTime::from_ratio(requested, field)?,
            actual_frame: frame,
            actual_time: MediaTime::from_ratio(actual, field)?,
            delta: MediaTime::from_ratio(delta, field)?,
            policy,
        },
    })
}

/// Mapping for a visual instance (§2.5).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", rename_all_fields = "camelCase")]
pub enum TimeMap {
    Linear { source_in: MediaTime, rate: Rate },
    Hold { source_at: MediaTime },
}

/// Source time corresponding to video time `t`: `sourceIn + (t − itemStart) × rate` (§2.5). `t` does not need to fall on an integer frame.
pub fn map_time(time_map: &TimeMap, item_start: Ratio, t: Ratio) -> Result<Ratio, TimeError> {
    match time_map {
        TimeMap::Hold { source_at } => source_at.to_ratio("sourceAt"),
        TimeMap::Linear { source_in, rate } => {
            let local = t.checked_sub(item_start).ok_or_else(|| TimeError::overflow("t"))?;
            let scaled = local.checked_mul(rate.ratio()).ok_or_else(|| TimeError::overflow("t"))?;
            source_in
                .to_ratio("sourceIn")?
                .checked_add(scaled)
                .ok_or_else(|| TimeError::overflow("t"))
        }
    }
}

/// Encoded timestamp (microseconds) of output frame `n`: `round(n × den / num × 1e6)`, with ties rounding to even (§2.13).
/// This is a separate rule from `nearest-frame` used for edit snapping, which takes the earlier boundary.
pub fn timestamp_at(n: i64, output_fps: Rate) -> Option<i64> {
    let t = frame_time(n as i128, output_fps)?.checked_mul(Ratio::from_int(1_000_000)?)?;
    let floor = t.floor();
    let fract = t.fract();
    let half = Ratio::new(1, 2)?;
    let rounded = match fract.cmp(&half) {
        std::cmp::Ordering::Less => floor,
        std::cmp::Ordering::Greater => floor + 1,
        std::cmp::Ordering::Equal => {
            if floor % 2 == 0 {
                floor
            } else {
                floor + 1
            }
        }
    };
    i64::try_from(rounded).ok()
}

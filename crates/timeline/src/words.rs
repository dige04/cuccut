use crate::schema::TimelineError;

pub const DEFAULT_WORD_PAD: f64 = 0.05;

#[derive(Debug, Clone, PartialEq)]
pub struct WordTiming {
    pub id: String,
    pub t0: f64,
    pub t1: f64,
    pub hidden: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WordSpan {
    pub source_start: f64,
    pub source_end: f64,
}

pub fn resolve_word_span(
    words: &[WordTiming],
    first_id: &str,
    last_id: &str,
    media_duration: f64,
    fps: f64,
    pad_pre: f64,
    pad_post: f64,
) -> Result<WordSpan, TimelineError> {
    if !media_duration.is_finite()
        || media_duration < 0.0
        || !fps.is_finite()
        || fps <= 0.0
        || !pad_pre.is_finite()
        || !pad_post.is_finite()
        || pad_pre < 0.0
        || pad_post < 0.0
    {
        return Err(TimelineError::Invalid("WordSpan parameters are invalid".to_owned()));
    }
    let first_index = words
        .iter()
        .position(|word| word.id == first_id)
        .ok_or_else(|| TimelineError::Invalid(format!("word does not exist: {first_id}")))?;
    let last_index = words
        .iter()
        .position(|word| word.id == last_id)
        .ok_or_else(|| TimelineError::Invalid(format!("word does not exist: {last_id}")))?;
    if first_index > last_index {
        return Err(TimelineError::Invalid(
            "WordSpan first word is after the last word".to_owned(),
        ));
    }
    let first = &words[first_index];
    let last = &words[last_index];
    if !first.t0.is_finite() || !last.t1.is_finite() || first.t0 < 0.0 || last.t1 > media_duration {
        return Err(TimelineError::Invalid("word time is outside the media range".to_owned()));
    }
    let source_start = word_span_start(words, first_index, fps, pad_pre);
    let source_end = word_span_end(words, last_index, media_duration, fps, pad_post);
    if source_end <= source_start {
        return Err(TimelineError::Invalid("WordSpan is empty after alignment".to_owned()));
    }
    Ok(WordSpan {
        source_start,
        source_end,
    })
}

/// The start point of "word-based cut beginning at `words[first_index]`": it does not cross the end of the previous visible word (hidden words do not count),
/// leaves a `pad_pre` margin, and frame alignment rounds outward (earlier) by default; if the outward extension would reach back into the previous visible word, rounding switches to inward.
///
/// [`resolve_word_span`] starts from this point; the snap candidates when dragging the left edge of a cut in edit mode also go only through it, so the two use identical rules. The caller guarantees the index is valid and `fps > 0`.
pub fn word_span_start(words: &[WordTiming], first_index: usize, fps: f64, pad_pre: f64) -> f64 {
    let first = &words[first_index];
    let previous_end = words[..first_index]
        .iter()
        .rev()
        .find(|word| !word.hidden)
        .map_or(0.0, |word| word.t1);
    let raw_start = previous_end.max(first.t0 - pad_pre).max(0.0);
    // Frame alignment rounds outward by default; if the outward extension would reach back into the adjacent visible word ("do not cross the adjacent word" is a hard constraint), round inward instead.
    let mut source_start = ((raw_start * fps).floor() / fps).max(0.0);
    if source_start < previous_end - 1e-9 {
        source_start = (raw_start * fps).ceil() / fps;
    }
    source_start
}

/// The end point of "word-based cut ending at `words[last_index]`" (the mirror of [`word_span_start`]): it does not cross the start of the next
/// visible word, leaves a `pad_post` margin, is clamped to `media_duration`, and frame alignment rounds outward (later) by default; if the outward extension would pass into the next visible word, rounding switches to inward. The caller guarantees the index is valid and `fps > 0`.
pub fn word_span_end(
    words: &[WordTiming],
    last_index: usize,
    media_duration: f64,
    fps: f64,
    pad_post: f64,
) -> f64 {
    let last = &words[last_index];
    let next_start = words[last_index + 1..]
        .iter()
        .find(|word| !word.hidden)
        .map_or(media_duration, |word| word.t0);
    let raw_end = next_start.min(last.t1 + pad_post).min(media_duration);
    let mut source_end = ((raw_end * fps).ceil() / fps).min(media_duration);
    if source_end > next_start + 1e-9 {
        source_end = (raw_end * fps).floor() / fps;
    }
    source_end
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(id: &str, t0: f64, t1: f64, hidden: bool) -> WordTiming {
        WordTiming {
            id: id.to_owned(),
            t0,
            t1,
            hidden,
        }
    }

    #[test]
    fn span_adds_breathing_room_without_crossing_visible_neighbors() {
        let words = vec![
            word("w1", 0.10, 0.30, false),
            word("hidden", 0.31, 0.34, true),
            word("w2", 0.36, 0.55, false),
            word("w3", 0.57, 0.75, false),
        ];
        let span = resolve_word_span(&words, "w2", "w2", 1.0, 30.0, 0.05, 0.05).unwrap();
        // Rounding outward on the tail side would land on 0.60 and cross into w3 (starting at 0.57): the hard constraint takes priority, so align inward to 17/30.
        assert_eq!(
            span,
            WordSpan {
                source_start: 0.30,
                source_end: 17.0 / 30.0
            }
        );
    }

    #[test]
    fn span_rounds_outward_to_frame_grid_and_clamps_media_edges() {
        let words = vec![word("w1", 0.01, 0.99, false)];
        let span = resolve_word_span(
            &words,
            "w1",
            "w1",
            1.0,
            24.0,
            DEFAULT_WORD_PAD,
            DEFAULT_WORD_PAD,
        )
        .unwrap();
        assert_eq!(
            span,
            WordSpan {
                source_start: 0.0,
                source_end: 1.0
            }
        );
    }
}

//! Streaming VAD: the model gives a speech probability for each fixed block (Silero: 512 samples). [`StreamingVadProcessor`] uses a hysteresis state machine to turn the probabilities into speech spans; [`speech_spans`] drives a whole audio clip in 60-second blocks, and processing can be cancelled between blocks.

use anyhow::{Result, bail};

use super::segmenter::{self, SpeechSpan, VAD_CONFIG};

/// How many seconds of audio one block covers: the granularity of progress and cancellation.
pub const BLOCK_SECONDS: usize = 60;

/// Hysteresis parameters (seconds / probability).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VadConfig {
    pub onset: f32,
    pub offset: f32,
    pub min_speech_duration: f32,
    pub min_silence_duration: f32,
    pub window_duration: f32,
    pub step_ratio: f32,
}

/// Streaming VAD with a fixed block size and internal loop state.
pub trait StreamingVad {
    fn input_sample_rate(&self) -> u32 {
        16_000
    }

    fn chunk_size(&self) -> usize {
        512
    }

    fn process_chunk(&mut self, samples: &[f32]) -> Result<f32>;

    /// Processes several complete blocks in one batch (`samples.len()` must be an integer multiple of `chunk_size()`) and returns the probabilities per block. By default it calls
    /// [`Self::process_chunk`] block by block; implementations may override this to amortize the per-block accelerator synchronization overhead.
    fn process_chunks(&mut self, samples: &[f32]) -> Result<Vec<f32>> {
        let chunk_size = self.chunk_size();
        samples.chunks(chunk_size).map(|chunk| self.process_chunk(chunk)).collect()
    }

    /// Clears the LSTM state and context. Every new audio stream starts from here.
    fn reset_state(&mut self);
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum State {
    Silence,
    PendingSpeech { start: f32 },
    Speech { start: f32 },
    PendingSilence { speech_start: f32, silence_start: f32 },
}

/// Hysteresis state machine that turns probabilities into speech spans.
pub struct StreamingVadProcessor<'a> {
    model: &'a mut dyn StreamingVad,
    config: VadConfig,
    chunk_size: usize,
    chunk_duration: f32,
    buffer: Vec<f32>,
    chunk_count: usize,
    state: State,
}

impl<'a> StreamingVadProcessor<'a> {
    pub fn new(model: &'a mut dyn StreamingVad, config: VadConfig) -> Result<Self> {
        let sample_rate = model.input_sample_rate();
        let chunk_size = model.chunk_size();
        if sample_rate == 0 || chunk_size == 0 {
            bail!("streaming VAD sample rate and chunk size must be non-zero");
        }
        // A loaded model is reused by several tasks, and every new stream must start from an empty LSTM/context.
        model.reset_state();
        Ok(Self {
            model,
            config,
            chunk_size,
            chunk_duration: chunk_size as f32 / sample_rate as f32,
            buffer: Vec::with_capacity(chunk_size * 2),
            chunk_count: 0,
            state: State::Silence,
        })
    }

    /// Feeds in a run of samples and returns the speech spans that end within it.
    pub fn process(&mut self, samples: &[f32]) -> Result<Vec<SpeechSpan>> {
        self.buffer.extend_from_slice(samples);
        let mut spans = Vec::new();
        let complete = self.buffer.len() / self.chunk_size * self.chunk_size;
        if complete > 0 {
            let chunks: Vec<f32> = self.buffer.drain(..complete).collect();
            for probability in self.model.process_chunks(&chunks)? {
                let time = self.chunk_count as f32 * self.chunk_duration;
                self.chunk_count += 1;
                spans.extend(self.process_probability(probability, time));
            }
        }
        Ok(spans)
    }

    /// End of stream: pads the final partial block with zeros and runs it, which closes any speech still in progress. `audio_end` is the real audio length (seconds); the zero-padded block must not push a span beyond the audio.
    pub fn flush(&mut self, audio_end: f32) -> Result<Vec<SpeechSpan>> {
        let mut spans = Vec::new();
        if !self.buffer.is_empty() {
            self.buffer.resize(self.chunk_size, 0.0);
            let chunk = std::mem::take(&mut self.buffer);
            let probability = self.model.process_chunk(&chunk)?;
            let time = self.chunk_count as f32 * self.chunk_duration;
            self.chunk_count += 1;
            spans.extend(self.process_probability(probability, time));
        }

        let end_time = (self.chunk_count as f32 * self.chunk_duration).min(audio_end);
        let tail = match self.state {
            State::Silence => None,
            State::PendingSpeech { start } => (end_time - start >= self.config.min_speech_duration).then_some((start, end_time)),
            State::Speech { start } => Some((start, end_time)),
            State::PendingSilence {
                speech_start,
                silence_start,
            } => Some((speech_start, silence_start.min(end_time))),
        };
        spans.extend(tail.map(|(start, end)| span(start, end)));
        self.state = State::Silence;
        Ok(spans)
    }

    fn process_probability(&mut self, probability: f32, time: f32) -> Option<SpeechSpan> {
        let next_time = time + self.chunk_duration;
        match self.state {
            State::Silence => {
                if probability >= self.config.onset {
                    self.state = State::PendingSpeech { start: time };
                }
            }
            State::PendingSpeech { start } => {
                if probability < self.config.offset {
                    self.state = State::Silence;
                } else if next_time - start >= self.config.min_speech_duration {
                    self.state = State::Speech { start };
                }
            }
            State::Speech { start } => {
                if probability < self.config.offset {
                    self.state = State::PendingSilence {
                        speech_start: start,
                        silence_start: time,
                    };
                }
            }
            State::PendingSilence {
                speech_start,
                silence_start,
            } => {
                if probability >= self.config.onset {
                    self.state = State::Speech { start: speech_start };
                } else if next_time - silence_start >= self.config.min_silence_duration {
                    self.state = State::Silence;
                    return Some(span(speech_start, silence_start));
                }
            }
        }
        None
    }
}

fn span(start: f32, end: f32) -> SpeechSpan {
    SpeechSpan {
        start: f64::from(start),
        end: f64::from(end),
    }
}

/// The result of [`speech_spans`].
#[derive(Debug, Clone, PartialEq)]
pub enum SpanScan {
    /// Speech spans already cut by [`segmenter::split`] to no more than `MAX_SPAN` (not padded).
    Spans(Vec<SpeechSpan>),
    Cancelled,
}

/// Runs VAD over the whole audio in 60-second blocks. Before each block it asks `should_cancel` once; at the end of each block it reports progress once (0–1).
pub fn speech_spans(
    samples: &[f32],
    sample_rate: u32,
    vad: &mut dyn StreamingVad,
    should_cancel: &dyn Fn() -> bool,
    progress: &mut dyn FnMut(f64),
) -> Result<SpanScan> {
    if samples.is_empty() {
        return Ok(SpanScan::Spans(Vec::new()));
    }
    if vad.input_sample_rate() != sample_rate {
        bail!("VAD expects {} Hz audio, got {sample_rate} Hz", vad.input_sample_rate());
    }
    let block = BLOCK_SECONDS * sample_rate as usize;
    let mut processor = StreamingVadProcessor::new(vad, VAD_CONFIG)?;
    let mut raw = Vec::new();
    for (index, chunk) in samples.chunks(block).enumerate() {
        if should_cancel() {
            return Ok(SpanScan::Cancelled);
        }
        raw.extend(processor.process(chunk)?);
        progress(((index + 1) * block).min(samples.len()) as f64 / samples.len() as f64);
    }
    let duration = samples.len() as f64 / f64::from(sample_rate);
    raw.extend(processor.flush(duration as f32)?);
    for span in &mut raw {
        span.end = span.end.min(duration);
    }
    raw.retain(|span| span.end > span.start);
    Ok(SpanScan::Spans(segmenter::split(&raw, samples, f64::from(sample_rate))))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The absolute value of a sample is the “probability”: it is used to set speech and silence precisely.
    struct Amplitude {
        resets: usize,
    }

    impl StreamingVad for Amplitude {
        fn process_chunk(&mut self, samples: &[f32]) -> Result<f32> {
            Ok(samples.iter().fold(0.0_f32, |max, value| max.max(value.abs())))
        }

        fn reset_state(&mut self) {
            self.resets += 1;
        }
    }

    fn signal(parts: &[(f64, f32)]) -> Vec<f32> {
        parts
            .iter()
            .flat_map(|&(seconds, level)| std::iter::repeat_n(level, (seconds * 16_000.0) as usize))
            .collect()
    }

    fn spans_of(samples: &[f32], vad: &mut Amplitude) -> Vec<SpeechSpan> {
        match speech_spans(samples, 16_000, vad, &|| false, &mut |_| {}).unwrap() {
            SpanScan::Spans(spans) => spans,
            SpanScan::Cancelled => panic!("not cancelled"),
        }
    }

    #[test]
    fn finds_speech_with_hysteresis_and_minimum_durations() {
        // A 0.1 s burst is not enough for min_speech, and a 0.2 s pause is not enough for min_silence, so speech is not cut.
        let samples = signal(&[(1.0, 0.0), (0.1, 0.9), (1.0, 0.0), (2.0, 0.9), (0.2, 0.0), (1.0, 0.9), (2.0, 0.0)]);
        let mut vad = Amplitude { resets: 0 };
        let spans = spans_of(&samples, &mut vad);
        assert_eq!(vad.resets, 1);
        assert_eq!(spans.len(), 1, "{spans:?}");
        assert!((spans[0].start - 2.1).abs() < 0.04, "{spans:?}");
        assert!((spans[0].end - 5.3).abs() < 0.04, "{spans:?}");
    }

    #[test]
    fn speech_running_to_the_end_is_clamped_to_the_audio() {
        let samples = signal(&[(0.5, 0.0), (1.01, 0.9)]);
        let duration = samples.len() as f64 / 16_000.0;
        let spans = spans_of(&samples, &mut Amplitude { resets: 0 });
        assert_eq!(spans.len(), 1);
        assert!(spans[0].end <= duration && duration - spans[0].end < 1e-6, "{spans:?}");
    }

    #[test]
    fn reports_progress_per_block_and_honours_cancel() {
        let samples = vec![0.0_f32; 16_000 * 130];
        let mut vad = Amplitude { resets: 0 };
        let mut seen = Vec::new();
        let scan = speech_spans(&samples, 16_000, &mut vad, &|| false, &mut |fraction| seen.push(fraction)).unwrap();
        assert_eq!(scan, SpanScan::Spans(Vec::new()));
        assert_eq!(seen.len(), 3);
        assert_eq!(*seen.last().unwrap(), 1.0);

        let calls = std::cell::Cell::new(0);
        let cancel = || {
            calls.set(calls.get() + 1);
            calls.get() > 1
        };
        assert_eq!(
            speech_spans(&samples, 16_000, &mut vad, &cancel, &mut |_| {}).unwrap(),
            SpanScan::Cancelled
        );
    }

    /// Emits probabilities block by block from a script: 1 kHz, 100 samples per block (0.1 seconds).
    struct Scripted {
        probabilities: Vec<f32>,
        index: usize,
    }

    impl StreamingVad for Scripted {
        fn input_sample_rate(&self) -> u32 {
            1_000
        }

        fn chunk_size(&self) -> usize {
            100
        }

        fn process_chunk(&mut self, samples: &[f32]) -> Result<f32> {
            assert_eq!(samples.len(), 100);
            let value = self.probabilities[self.index];
            self.index += 1;
            Ok(value)
        }

        fn reset_state(&mut self) {
            self.index = 0;
        }
    }

    // Ported from the `streaming_vad_covers_state_machine_flush_and_buffer_boundaries` test in v2 `ccut-speech-core/tests/core.rs`.
    // v3's processor emits spans only when speech ends (there is no SpeechStarted event), and it has no reset / current_time. Instead, this counts the blocks the model actually ran, to guard the boundary where samples short of a full block stay in the buffer.
    #[test]
    fn partial_chunks_wait_in_the_buffer_and_speech_ends_after_min_silence() {
        let mut vad = Scripted {
            probabilities: vec![0.7, 0.8, 0.8, 0.2, 0.2, 0.1],
            index: 0,
        };
        let config = VadConfig {
            onset: 0.5,
            offset: 0.35,
            min_speech_duration: 0.2,
            min_silence_duration: 0.15,
            window_duration: 0.1,
            step_ratio: 1.0,
        };
        let mut processor = StreamingVadProcessor::new(&mut vad, config).unwrap();
        // 99 samples do not fill a block, so they stay in the buffer.
        assert!(processor.process(&[0.0; 99]).unwrap().is_empty());
        // Another 201 make three full blocks: speech has started, but the span is emitted only when it ends.
        assert!(processor.process(&[0.0; 201]).unwrap().is_empty());
        let ended = processor.process(&[0.0; 200]).unwrap();
        assert_eq!(ended.len(), 1, "{ended:?}");
        assert_eq!(ended[0].start, 0.0);
        // Time is accumulated as f32 and then converted to f64; it differs from 0.3 only by rounding.
        assert!((ended[0].end - 0.3).abs() < 1e-6, "{ended:?}");
        // The buffer is exactly empty and the state is back to silence: no block is padded at the end, and there are no spans.
        assert!(processor.flush(0.5).unwrap().is_empty());
        drop(processor);
        assert_eq!(vad.index, 5);
    }

    #[test]
    fn rejects_a_sample_rate_mismatch() {
        let mut vad = Amplitude { resets: 0 };
        assert!(speech_spans(&[0.0; 10], 8_000, &mut vad, &|| false, &mut |_| {}).is_err());
    }
}

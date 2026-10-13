//! The engine-side stop barrier (architecture design §7.4).
//!
//! Task and pipeline writes are submitted with `run: { runId, runGeneration }`. When the Runtime stops a run, it first sends `runs.invalidate`;
//! afterwards, submissions for the same run whose generation is not above the invalidated generation are rejected at the video's serial commit entry (`TASK_STOPPED`), without opening a transaction or producing a receipt.
//! Ordinary user and Agent edits do not carry `run` and are not affected.
//!
//! Records are kept in memory, separately per video: they are cleared when the video closes; each video keeps at most `MAX_RUNS_PER_VIDEO` runs, and when full, the oldest is evicted first in, first out.
//! After an engine restart or once records are evicted, it falls back to the Node-side barrier (ApplicationRunner checks the stop marker before each submission).

use std::collections::{HashMap, VecDeque};

use serde::Deserialize;
use message_ref::msg;
use video_engine::model::Id;
use video_engine::{ErrorBody, Retryability};

/// Maximum number of invalidated runs remembered per video.
pub const MAX_RUNS_PER_VIDEO: usize = 1024;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunRef {
    pub run_id: Id,
    /// Decimal integer string; incremented when a retry starts a new generation.
    pub run_generation: String,
}

impl RunRef {
    pub fn generation(&self) -> Result<u64, ErrorBody> {
        self.run_generation
            .parse()
            .map_err(|_| ErrorBody::new(
                "INVALID_PARAMS",
                msg!("engineHost.runGenerationNotInteger", "runGeneration must be a decimal integer"),
                Retryability::Never,
            ))
    }
}

#[derive(Default)]
struct VideoRuns {
    /// runId → highest invalidated generation.
    invalid: HashMap<Id, u64>,
    /// Order of records; when full, evicted from the front.
    order: VecDeque<Id>,
}

#[derive(Default)]
pub struct RunBarrier {
    videos: HashMap<Id, VideoRuns>,
}

impl RunBarrier {
    /// Invalidates this run's generation and all earlier generations.
    pub fn invalidate(&mut self, video_id: &str, run: &RunRef) -> Result<(), ErrorBody> {
        let generation = run.generation()?;
        let runs = self.videos.entry(video_id.to_string()).or_default();
        match runs.invalid.get_mut(&run.run_id) {
            Some(existing) => *existing = (*existing).max(generation),
            None => {
                if runs.order.len() >= MAX_RUNS_PER_VIDEO
                    && let Some(oldest) = runs.order.pop_front()
                {
                    runs.invalid.remove(&oldest);
                }
                runs.invalid.insert(run.run_id.clone(), generation);
                runs.order.push_back(run.run_id.clone());
            }
        }
        Ok(())
    }

    /// Whether the run this submission belongs to has been stopped; returns the generation it was invalidated up to.
    pub fn stopped(&self, video_id: &str, run: &RunRef) -> Result<Option<u64>, ErrorBody> {
        let generation = run.generation()?;
        Ok(self
            .videos
            .get(video_id)
            .and_then(|runs| runs.invalid.get(&run.run_id))
            .copied()
            .filter(|stopped| generation <= *stopped))
    }

    /// Video closed: its records are cleared together with it.
    pub fn forget(&mut self, video_id: &str) {
        self.videos.remove(video_id);
    }

    #[cfg(test)]
    pub fn len(&self, video_id: &str) -> usize {
        self.videos.get(video_id).map_or(0, |runs| runs.invalid.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(id: &str, generation: u64) -> RunRef {
        RunRef {
            run_id: id.into(),
            run_generation: generation.to_string(),
        }
    }

    #[test]
    fn later_generations_pass_and_earlier_ones_stay_stopped() {
        let mut barrier = RunBarrier::default();
        barrier.invalidate("v", &run("job_a", 2)).unwrap();
        assert_eq!(barrier.stopped("v", &run("job_a", 1)).unwrap(), Some(2));
        assert_eq!(barrier.stopped("v", &run("job_a", 2)).unwrap(), Some(2));
        assert_eq!(barrier.stopped("v", &run("job_a", 3)).unwrap(), None);
        assert_eq!(barrier.stopped("v", &run("job_b", 1)).unwrap(), None);
        assert_eq!(barrier.stopped("other", &run("job_a", 1)).unwrap(), None);
        // Invalidating up to an earlier generation does not loosen existing records.
        barrier.invalidate("v", &run("job_a", 1)).unwrap();
        assert_eq!(barrier.stopped("v", &run("job_a", 2)).unwrap(), Some(2));
        assert!(barrier.stopped("v", &run("job_a", 0)).is_ok());
        assert_eq!(
            barrier
                .stopped(
                    "v",
                    &RunRef {
                        run_id: "job_a".into(),
                        run_generation: "x".into()
                    }
                )
                .unwrap_err()
                .code,
            "INVALID_PARAMS"
        );
    }

    #[test]
    fn records_are_bounded_per_video_and_cleared_on_forget() {
        let mut barrier = RunBarrier::default();
        for i in 0..MAX_RUNS_PER_VIDEO + 5 {
            barrier.invalidate("v", &run(&format!("job_{i}"), 1)).unwrap();
        }
        assert_eq!(barrier.len("v"), MAX_RUNS_PER_VIDEO);
        // The oldest is evicted; the most recent stays.
        assert_eq!(barrier.stopped("v", &run("job_0", 1)).unwrap(), None);
        let last = format!("job_{}", MAX_RUNS_PER_VIDEO + 4);
        assert_eq!(barrier.stopped("v", &run(&last, 1)).unwrap(), Some(1));
        barrier.forget("v");
        assert_eq!(barrier.len("v"), 0);
    }
}

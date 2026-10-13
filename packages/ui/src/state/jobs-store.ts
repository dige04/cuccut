import { create } from 'zustand';
import { applyJobsEvent } from '@cuccut/client';
import type { Id, JobLiveSegment, JobRecord, JobsEvent, JobsSnapshot } from '@cuccut/protocol';
import { exportSpeed, trackSpeed, type ExportSpeed, type SpeedTrack } from '../model/export-speed.ts';
import { holdSegments } from '../model/live-transcript.ts';
import { jobLive } from '../model/task-list.ts';

type Segments = Readonly<Record<Id, readonly JobLiveSegment[]>>;
type Speeds = Readonly<Record<Id, SpeedTrack>>;

/** Compute job (Job) mirror: long-running work such as transcription, dubbing and generation (architecture design §7). Shared by the background tasks page, the rail badge and the task capsule. */
export interface JobsStore {
  ready: boolean;
  jobs: JobRecord[];
  /** Segments recognized so far by a transcription task still running, by `jobId` (architecture design §6.6, "live transcript"). */
  liveSegments: Segments;
  /** A transcription Job has completed and the client has dropped its live segments, but the flow is still building the subtitle layer. Keep them for now: until the subtitle track appears, the temporary line and the transcript keep drawing from them (`holdSegments`). */
  heldSegments: Segments;
  /** Progress samples from the last few seconds of a running export, by `jobId`. The export window and background tasks use them to compute speed and remaining time (`exportSpeed`). */
  speeds: Speeds;
  replace(snapshot: JobsSnapshot): void;
  apply(event: JobsEvent): void;
}

const NONE: Segments = Object.freeze({});
const NO_SPEEDS: Speeds = Object.freeze({});
const EMPTY: readonly JobLiveSegment[] = Object.freeze([]);

/** Update progress samples with newly arrived task records. Exports that are not running are dropped. The reference is unchanged when nothing changes. */
function trackSpeeds(speeds: Speeds, jobs: readonly JobRecord[]): Speeds {
  let next: Record<Id, SpeedTrack> | null = null;
  for (const job of jobs) {
    const prev = speeds[job.jobId];
    const track = trackSpeed(prev, job);
    if (track === prev) continue;
    next ??= { ...speeds };
    if (track) next[job.jobId] = track;
    else delete next[job.jobId];
  }
  return next ?? speeds;
}

export const useJobs = create<JobsStore>()((set) => ({
  ready: false,
  jobs: [],
  liveSegments: NONE,
  heldSegments: NONE,
  speeds: NO_SPEEDS,
  replace: (snapshot) =>
    set((s) => {
      const liveSegments = snapshot.liveSegments ?? NONE;
      // Full replacement: samples for tasks not in the snapshot are dropped too.
      const ids = new Set(snapshot.jobs.map((j) => j.jobId));
      const kept = Object.fromEntries(Object.entries(s.speeds).filter(([id]) => ids.has(id)));
      return {
        ready: true,
        jobs: snapshot.jobs,
        liveSegments,
        heldSegments: holdSegments(s.liveSegments, liveSegments, s.heldSegments, snapshot.jobs),
        speeds: trackSpeeds(kept, snapshot.jobs),
      };
    }),
  // Pass only the snapshot's two fields to the reducer, and write both back. When the reducer removes a task's segments, a shallow merge must not leave the old ones behind.
  apply: (event) =>
    set((s) => {
      const next = applyJobsEvent({ jobs: s.jobs, liveSegments: s.liveSegments as Record<Id, JobLiveSegment[]> }, event);
      const liveSegments = next.liveSegments ?? NONE;
      const speeds = event.type === 'job.updated' ? trackSpeeds(s.speeds, [event.job]) : s.speeds;
      return { jobs: next.jobs, liveSegments, heldSegments: holdSegments(s.liveSegments, liveSegments, s.heldSegments, next.jobs), speeds };
    }),
}));

/** Tasks not yet finished (including ones being automatically re-run after a crash; see `jobLive`). */
export function isJobLive(job: JobRecord): boolean {
  return jobLive(job);
}

/** Segments recognized so far by one transcription task (including ones that just finished and are still kept). When there are none, the same empty array is returned. The reference is unchanged when nothing changes. */
export function useLiveSegments(jobId: Id | null | undefined): readonly JobLiveSegment[] {
  return useJobs((s) => (jobId ? (s.liveSegments[jobId] ?? s.heldSegments[jobId] ?? EMPTY) : EMPTY));
}

/** Speed and estimated remaining time of one export. null if it is not a running export or cannot be computed yet. */
export function useExportSpeed(jobId: Id | null | undefined): ExportSpeed | null {
  const track = useJobs((s) => (jobId ? s.speeds[jobId] : undefined));
  const job = useJobs((s) => (jobId && s.speeds[jobId] ? s.jobs.find((j) => j.jobId === jobId) : undefined));
  return track && job ? exportSpeed(track, job) : null;
}

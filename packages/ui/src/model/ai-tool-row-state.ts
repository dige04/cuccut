import { AI_TOOL_PIPELINE, type CutSuggestion, type DocumentRecord, type Id, type JobRecord } from '@cuccut/protocol';
import type { AiToolId } from './ai-tools.ts';
import { jobLive, jobPercent } from './task-list.ts';

/**
 * The status at the right of each row in the AI tools list (product design §5.10 “AI tools tab”, prototype panel-aitools-list.jsx `rowState`). It reports only facts the editor holds, and takes the first match in the order running > pending > stale > chapters > last run. This only makes the decision; the list picks the copy and tone from `kind`.
 */
export type AiToolRowState =
  | { kind: 'running'; percent: number | null }
  /** Results or receipts from a direct model call that have not been reviewed yet (before “Done”). */
  | { kind: 'result' }
  /** Speaker-identification proposals waiting for confirmation. */
  | { kind: 'review' }
  | { kind: 'pending'; count: number }
  | { kind: 'stale'; count: number }
  | { kind: 'chapters'; count: number }
  | { kind: 'last'; at: string }
  | { kind: 'undone' };

export interface AiToolRowFacts {
  /** The task for this tool running on this video; null when the percentage is unknown. */
  running?: { percent: number | null } | null;
  result?: boolean;
  review?: boolean;
  /** Cuts suggested on the timeline but not yet decided (only for finding cut points). */
  pendingCuts?: number;
  /** Stale translated sentences (only for refreshing stale translations). */
  staleSentences?: number;
  /** The number of chapters on the timeline (only for generating chapters). */
  chapters?: number;
  /** The most recent completed run of this tool on this video; `undone` means the change it wrote into the video has been undone. */
  last?: { at: string; undone: boolean } | null;
}

export function aiToolRowState(tool: AiToolId, facts: AiToolRowFacts): AiToolRowState | null {
  if (facts.running) return { kind: 'running', percent: facts.running.percent };
  if (facts.result) return { kind: 'result' };
  if (facts.review) return { kind: 'review' };
  if (tool === 'cleanup' && facts.pendingCuts) return { kind: 'pending', count: facts.pendingCuts };
  if (tool === 'stale' && facts.staleSentences) return { kind: 'stale', count: facts.staleSentences };
  if (tool === 'chapters' && facts.chapters) return { kind: 'chapters', count: facts.chapters };
  if (facts.last) return facts.last.undone ? { kind: 'undone' } : { kind: 'last', at: facts.last.at };
  return null;
}

// ---- Facts ----

export interface AiToolJobFacts {
  running: { percent: number | null } | null;
  last: { jobId: Id; at: string } | null;
}

const toolOf = (job: JobRecord): unknown => job.pipeline?.params.tool;
const videoOf = (job: JobRecord): unknown => job.videoId ?? job.pipeline?.params.videoId;

/** The direct model call tasks (`ai-tool` flow) that belong to this video, grouped by tool: the one running, and the most recently completed one. */
export function aiToolJobFacts(jobs: readonly JobRecord[], videoId: Id): Partial<Record<string, AiToolJobFacts>> {
  const out: Partial<Record<string, AiToolJobFacts>> = {};
  for (const job of jobs) {
    if (job.kind !== 'pipeline' || job.pipeline?.name !== AI_TOOL_PIPELINE || videoOf(job) !== videoId) continue;
    const tool = toolOf(job);
    if (typeof tool !== 'string') continue;
    const facts = (out[tool] ??= { running: null, last: null });
    if (jobLive(job)) {
      const percent = jobPercent(job);
      if (!facts.running || (facts.running.percent === null && percent !== null)) facts.running = { percent };
    } else if (job.state === 'completed') {
      const at = job.endedAt ?? job.updatedAt;
      if (!facts.last || Date.parse(at) > Date.parse(facts.last.at)) facts.last = { jobId: job.jobId, at };
    }
  }
  return out;
}

/** This video's “generate music” task (`generateMusic` with `videoId`, submitted from the tools page): the one running, and the most recently completed one. */
export function soundtrackJobFacts(jobs: readonly JobRecord[], videoId: Id): AiToolJobFacts | null {
  let facts: AiToolJobFacts | null = null;
  for (const job of jobs) {
    if (job.kind !== 'generateMusic' || job.videoId !== videoId) continue;
    facts ??= { running: null, last: null };
    if (jobLive(job)) {
      const percent = jobPercent(job);
      if (!facts.running || (facts.running.percent === null && percent !== null)) facts.running = { percent };
    } else if (job.state === 'completed') {
      const at = job.endedAt ?? job.updatedAt;
      if (!facts.last || Date.parse(at) > Date.parse(facts.last.at)) facts.last = { jobId: job.jobId, at };
    }
  }
  return facts;
}

export const EDITORIAL_PROPOSAL_KIND = 'editorial-proposal';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The number of undecided suggestions in a cut proposal (video format spec §6.2). A proposal that was changed after the transcription's detection is already stale (its `speechRef` is not the current version of that transcript), so it is not counted; nor is one when the body text has not been fetched or cannot be recognized.
 */
export function pendingCutCount(proposals: readonly { record: DocumentRecord; body: unknown }[], documents: Record<Id, DocumentRecord>): number {
  let n = 0;
  for (const { body } of proposals) {
    if (!isObject(body) || body.schema !== 'cuccut.editorial-proposal/1' || !Array.isArray(body.suggestions)) continue;
    const ref = body.speechRef;
    if (!isObject(ref) || typeof ref.id !== 'string' || documents[ref.id]?.currentRevision !== ref.revision) continue;
    n += (body.suggestions as CutSuggestion[]).filter((s) => isObject(s) && s.status === 'pending').length;
  }
  return n;
}

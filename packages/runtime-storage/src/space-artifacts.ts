import type {
  ApplicationState,
  ExportSettings,
  GeneratedOutput,
  Id,
  JobKind,
  JobRecord,
  JobState,
  JobSubmitter,
  PipelineRun,
  TextJobResult,
} from '@cuccut/protocol';
import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonStoreFile, type StoreOptions } from './store-file.ts';

/**
 * The facts Space reads from a task when it derives artifact entries (architecture design §5.7). These are exactly the fields `space-derive` uses, so `JobRecord` can be used directly as this type.
 * Generation parameters (source text, prompts), the user library, consent, details of the flow and cancellation, and warnings are not included. For text results, only the media type and length are kept.
 */
export interface SpaceJobFacts {
  jobId: Id;
  kind: JobKind;
  state: JobState;
  videoId: Id | null;
  providerId: string;
  modelId: string;
  inputHash: string;
  submitter: JobSubmitter;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  error: { code: string; message: string } | null;
  progress: { done: number; total: number | null } | null;
  result: {
    artifactId: string;
    outputs?: GeneratedOutput[];
    text?: { mediaType: TextJobResult['mediaType']; byteLength: number };
  } | null;
  export?: { settings: ExportSettings; videoRevision: string; destination: { files: string[] } };
  /** Keeps only the last applied state and its reason. */
  applications?: { state: ApplicationState; error: { code: string; message: string } | null }[];
  /**
   * The flow's name and steps (only for flows in the Job Ledger). For flows that create a video, the steps give the source of the video entry (§7.9). The artifact record holds two kinds of flows. File-to-file flows keep their name and explicit project assignment (download transcription). Flows that created a video keep only the completed `create` step, and the output keeps only `videoId`. After the Job Ledger prunes this run, the source of the video entry still remains.
 */
  pipeline?: { name: string; steps?: PipelineRun['steps']; params?: { projectId?: unknown } };
}

/** Task kinds that leave artifact entries. */
const ARTIFACT_KINDS = new Set<JobKind>(['synthesizeSpeech', 'generateImage', 'generateMusic', 'generateText', 'export']);
const TERMINAL = new Set<JobState>(['completed', 'failed', 'cancelled', 'interrupted', 'needs-reconciliation']);

/**
 * File-to-file flows (architecture design §7.9): the output is published as files (`outputs[].path`) and recorded as a generation record without a video. Like generated artifacts,
 * they derive Space entries and are kept in the artifact record. `downloads-save` is a file the agent handed over with `downloads_save` (§3.5). It does not go through the Job Ledger and is written directly into the artifact record. It is derived the same way.
 */
export const FILE_PIPELINES: ReadonlySet<string> = new Set(['transcode', 'translate-subtitles', 'link-import', 'downloads-save']);

/**
 * Tasks for file-to-file flows. A transcription counts only when only a file was given (the result has published files). A transcription given a video is written into the video and leaves no artifact entry.
 */
export function isFilePipelineJob(job: {
  kind: JobKind;
  pipeline?: { name: string } | null | undefined;
  result?: { outputs?: readonly unknown[] | undefined } | null | undefined;
}): boolean {
  if (job.kind !== 'pipeline') return false;
  const name = job.pipeline?.name ?? '';
  return FILE_PIPELINES.has(name) || (name === 'transcribe' && (job.result?.outputs?.length ?? 0) > 0);
}

/**
 * Whether a task should be kept in the artifact record: it has finished, has a result, and is a kind that leaves artifacts. Tasks that should be kept return the facts used for derivation. Otherwise null.
 * Failed tasks with no result are not kept. They are only placeholders, and they disappear with Job Ledger pruning without losing anything.
 * Flows that created a video are also kept (finished, with the `create` step completed). They are kept only for the video entry's source. They have no artifacts and are not removed when artifacts are cleared.
 */
export function spaceJobFacts(job: JobRecord): SpaceJobFacts | null {
  if (job.kind === 'pipeline' && !isFilePipelineJob(job)) return createdVideoFacts(job);
  if (!(ARTIFACT_KINDS.has(job.kind) || isFilePipelineJob(job)) || !TERMINAL.has(job.state) || !job.result) return createdVideoFacts(job);
  const last = job.applications?.at(-1);
  const createdSteps = createdVideoFacts(job)?.pipeline?.steps;
  const projectId = job.pipeline?.name === 'link-import' ? job.pipeline.params?.projectId : undefined;
  return {
    jobId: job.jobId,
    kind: job.kind,
    state: job.state,
    videoId: job.videoId,
    providerId: job.providerId,
    modelId: job.modelId,
    inputHash: job.inputHash,
    submitter: job.submitter,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    endedAt: job.endedAt,
    error: job.error ? { code: job.error.code, message: job.error.message } : null,
    progress: null,
    result: {
      artifactId: job.result.artifactId,
      ...(job.result.outputs ? { outputs: job.result.outputs } : {}),
      ...(job.result.text ? { text: { mediaType: job.result.text.mediaType, byteLength: job.result.text.byteLength } } : {}),
    },
    ...(job.export
      ? {
          export: {
            settings: job.export.settings,
            videoRevision: job.export.videoRevision,
            destination: { files: job.export.destination.files },
          },
        }
      : {}),
    ...(job.kind === 'pipeline' && job.pipeline ? {
      pipeline: {
        name: job.pipeline.name,
        ...(createdSteps ? { steps: createdSteps } : {}),
        ...(typeof projectId === 'string' ? { params: { projectId } } : {}),
      },
    } : {}),
    ...(last
      ? { applications: [{ state: last.state, error: last.error ? { code: last.error.code, message: last.error.message } : null }] }
      : {}),
  };
}

/** Facts for a flow that created a video: neither the result nor the artifacts are kept. The steps keep only the completed `create` step and the video it created. */
function createdVideoFacts(job: JobRecord): SpaceJobFacts | null {
  if (!TERMINAL.has(job.state) || !job.pipeline) return null;
  const create = job.pipeline.steps.find((step) => step.name === 'create' && step.status === 'completed');
  const videoId = create?.output?.videoId;
  if (!create || typeof videoId !== 'string') return null;
  return {
    jobId: job.jobId,
    kind: job.kind,
    state: job.state,
    videoId: job.videoId,
    providerId: job.providerId,
    modelId: job.modelId,
    inputHash: job.inputHash,
    submitter: job.submitter,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    endedAt: job.endedAt,
    error: job.error ? { code: job.error.code, message: job.error.message } : null,
    progress: null,
    result: null,
    pipeline: { name: job.pipeline.name, steps: [{ ...create, output: { videoId } }] },
  };
}

/** All artifact ids in a record (generated outputs, full text, exported files). */
export function artifactIdsOf(facts: SpaceJobFacts): string[] {
  if (!facts.result) return [];
  const ids = new Set<string>();
  if (facts.kind === 'generateText') ids.add(facts.result.artifactId);
  for (const output of facts.result.outputs ?? []) ids.add(output.artifactId);
  return [...ids];
}

/**
 * References kept only for artifact library sweeping (architecture design §7.3): a finished task's results, the outputs of flow steps, and all artifact ids that appeared in the app.
 * They are not a source of Space entries. They do not take part in derivation or appear in the catalog. Internal artifacts such as dubbed sentence audio, raw transcription results, and intermediate flow artifacts stay referenced after Job Ledger pruning only because of these. Dub versions in video documents and `rawResultArtifactId` still point to them, and the sweep cannot see video documents.
 */
export interface RetainedArtifactRefs {
  jobId: Id;
  kind: JobKind;
  videoId: Id | null;
  endedAt: string | null;
  artifactIds: string[];
}

const ARTIFACT_ID = /sha256:[0-9a-f]{64}/g;

/** All `sha256:<64-digit hex>` strings in the text. */
function artifactIdsInText(text: string, into: Set<string>): Set<string> {
  for (const match of text.matchAll(ARTIFACT_ID)) into.add(match[0]);
  return into;
}

/**
 * The artifact references a task must keep: it has finished, and it has a result (including outputs), flow steps, or artifact ids that appeared in the app. Only these places are checked, not `inputHash`,
 * `contentHash`, or other digests that are also written as `sha256:`. null if there are none.
 */
export function artifactRefsOf(job: JobRecord): RetainedArtifactRefs | null {
  if (!TERMINAL.has(job.state)) return null;
  const text = JSON.stringify({ result: job.result ?? null, steps: job.pipeline?.steps ?? null, applications: job.applications ?? null });
  const ids = [...artifactIdsInText(text, new Set())].sort();
  if (ids.length === 0) return null;
  return { jobId: job.jobId, kind: job.kind, videoId: job.videoId, endedAt: job.endedAt, artifactIds: ids };
}

interface SpaceArtifactsFile {
  schemaVersion: 1;
  jobs: unknown[];
  /** References kept only for sweeping (`RetainedArtifactRefs`). Old files do not have them. */
  references?: unknown[];
  /**
   * The starting point (ISO time) for artifact library sweeping. Artifacts modified earlier than it are not deleted. Old files do not have it. When read, it is filled in with the current time. Artifacts of tasks that were pruned before reference retention began cannot be known to be unused, so they are all kept.
   */
  sweepSince?: string;
}

/**
 * The Space artifact record (architecture design §5.7 and §14 "Space and Job Ledger retention"): the derivation facts of tasks that produced artifacts, keyed by `jobId`.
 * The Job Ledger keeps only the most recent few tasks. Pruned tasks' artifact bytes still exist, but their entries would disappear. This keeps a separate copy that pruning does not lose.
 * Flows that created a video also get a record (with no artifacts), so the source of the video entry (§7.9) is not lost when pruning happens.
 *
 * - Written when a task finishes with a result. `SpaceCatalog` subscribes to task changes, and it also backfills from the Job Ledger at startup.
 * - Removed once all artifacts of a record have been physically deleted or cleared.
 * - It also has `references`: the artifact ids of every finished task that left artifacts (`RetainedArtifactRefs`). These are only for artifact library sweeping and do not take part in derivation. They are written when the task finishes and are not removed for now.
 * - It is not a cache: `space.rebuildIndex` does not delete it. Broken rows are skipped. If the whole file cannot be recognized, it is renamed and kept, and the store starts empty. Files written by a newer version are not rewritten (`store-file.ts`).
 */
export class SpaceArtifactStore {
  readonly #file: JsonStoreFile;
  readonly #path: string;
  #jobs = new Map<Id, SpaceJobFacts>();
  #refs = new Map<Id, RetainedArtifactRefs>();
  #sweepSince: string = new Date().toISOString();
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
    this.#path = file;
  }

  /** Reads the record in. Returns the number of skipped rows and, if the whole file cannot be recognized, the name of the retained file, for logs. */
  async load(): Promise<{ skipped: number; quarantined: string | null }> {
    const read = await this.#file.read({
      recognize: (raw) =>
        Array.isArray(raw.jobs)
          ? {
              jobs: raw.jobs as unknown[],
              references: Array.isArray(raw.references) ? (raw.references as unknown[]) : [],
              sweepSince: typeof raw.sweepSince === 'string' && Number.isFinite(Date.parse(raw.sweepSince)) ? raw.sweepSince : null,
            }
          : null,
    });
    this.#jobs = new Map();
    this.#refs = new Map();
    const since = read.value?.sweepSince ?? null;
    this.#sweepSince = since ?? new Date().toISOString();
    let skipped = 0;
    for (const row of read.value?.jobs ?? []) {
      if (isFacts(row)) this.#jobs.set(row.jobId, row);
      else skipped++;
    }
    for (const row of read.value?.references ?? []) {
      if (isRefs(row)) this.#refs.set(row.jobId, row);
      else skipped++;
    }
    // The starting point must be written to disk first. Later sweeps depend on it, so it must not move forward on every startup.
    if (since === null && read.status !== 'newer-version') await this.#save().catch(() => {});
    return { skipped, quarantined: read.status === 'quarantined' ? read.renamedTo : null };
  }

  list(): SpaceJobFacts[] {
    return [...this.#jobs.values()];
  }

  get(jobId: Id): SpaceJobFacts | null {
    return this.#jobs.get(jobId) ?? null;
  }

  /** Writes or updates a batch of records. No disk write if nothing changed. */
  put(records: readonly SpaceJobFacts[]): Promise<void> {
    let changed = false;
    for (const record of records) {
      const before = this.#jobs.get(record.jobId);
      if (before && JSON.stringify(before) === JSON.stringify(record)) continue;
      this.#jobs.set(record.jobId, record);
      changed = true;
    }
    return changed ? this.#save() : this.#saving;
  }

  /** Starting point for artifact library sweeping (milliseconds). Artifacts modified earlier than it are not deleted. */
  sweepSince(): number {
    return Date.parse(this.#sweepSince);
  }

  /** References kept only for sweeping. */
  references(): RetainedArtifactRefs[] {
    return [...this.#refs.values()];
  }

  /** Writes or updates a batch of references kept only for sweeping. No disk write if nothing changed. */
  putReferences(records: readonly RetainedArtifactRefs[]): Promise<void> {
    let changed = false;
    for (const record of records) {
      const before = this.#refs.get(record.jobId);
      if (before && JSON.stringify(before) === JSON.stringify(record)) continue;
      this.#refs.set(record.jobId, record);
      changed = true;
    }
    return changed ? this.#save() : this.#saving;
  }

  /**
   * All artifact ids that artifact library sweeping must keep (architecture design §7.3). These are the records and references in memory, plus every `sha256:<hex>` that appears in the text of this file on disk and of the renamed-and-kept `<file>.corrupt-*` files.
 * References in a file that was corrupt and renamed, in a newer-version file that was written but not read in, and in rows skipped on read all still count. When in doubt, keep more. A single read failure must not let the next sweep delete them.
   */
  async referencedArtifactIds(): Promise<Set<string>> {
    const ids = artifactIdsInText(JSON.stringify({ jobs: this.list(), references: this.references() }), new Set());
    await this.#saving.catch(() => {});
    const dir = path.dirname(this.#path);
    const base = path.basename(this.#path);
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    for (const name of names) {
      if (name !== base && !name.startsWith(`${base}.corrupt-`)) continue;
      const text = await fs.readFile(path.join(dir, name), 'utf8').catch(() => '');
      artifactIdsInText(text, ids);
    }
    return ids;
  }

  remove(jobIds: readonly Id[]): Promise<void> {
    let changed = false;
    for (const jobId of jobIds) changed = this.#jobs.delete(jobId) || changed;
    return changed ? this.#save() : this.#saving;
  }

  flush(): Promise<void> {
    return this.#saving;
  }

  #save(): Promise<void> {
    const snapshot: SpaceArtifactsFile = {
      schemaVersion: 1,
      jobs: [...this.#jobs.values()],
      references: [...this.#refs.values()],
      sweepSince: this.#sweepSince,
    };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    return this.#saving;
  }
}

function isRefs(row: unknown): row is RetainedArtifactRefs {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.jobId === 'string' &&
    typeof r.kind === 'string' &&
    Array.isArray(r.artifactIds) &&
    r.artifactIds.every((id) => typeof id === 'string' && /^sha256:[0-9a-f]{64}$/.test(id))
  );
}

function isFacts(row: unknown): row is SpaceJobFacts {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const common =
    typeof r.jobId === 'string' &&
    typeof r.kind === 'string' &&
    typeof r.state === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.updatedAt === 'string' &&
    typeof r.inputHash === 'string' &&
    typeof r.submitter === 'object' &&
    r.submitter !== null;
  if (!common) return false;
  const filePipeline = isFilePipelineJob(r as { kind: JobKind; pipeline?: { name: string }; result?: { outputs?: unknown[] } | null });
  if (r.kind === 'pipeline' && (!filePipeline || !r.result)) {
    // Flows that created a video: the steps contain the completed `create` step and its `videoId`.
    const pipeline = r.pipeline as { name?: unknown; steps?: unknown } | undefined;
    if (!pipeline || typeof pipeline.name !== 'string' || !Array.isArray(pipeline.steps)) return false;
    return pipeline.steps.some((step) => {
      const s = step as { name?: unknown; status?: unknown; output?: { videoId?: unknown } | null } | null;
      return s?.name === 'create' && s.status === 'completed' && typeof s.output?.videoId === 'string';
    });
  }
  return (
    (ARTIFACT_KINDS.has(r.kind as JobKind) || filePipeline) &&
    typeof r.result === 'object' &&
    r.result !== null &&
    typeof (r.result as Record<string, unknown>).artifactId === 'string'
  );
}

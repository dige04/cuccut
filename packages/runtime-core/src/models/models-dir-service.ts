import fs from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '@cuccut/harness';
import {
  canonicalJson,
  isTerminal,
  sha256Hex,
  type JobManager,
  type LocalTranscribeProvider,
  type TaskRun,
} from '@cuccut/jobs';
import {
  clearMoveJournal,
  diskFreeBytes,
  dirAccess,
  moveModels,
  nestedDirs,
  planMove,
  recoverMove,
  removeSources,
  sameVolume,
  scanModelsDir,
  undoMove,
  type ModelCatalog,
  type MoveRepo,
} from '@cuccut/models';
import {
  RpcError,
  refOf,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type ModelsDirChangeResult,
  type ModelsDirInfo,
  type ModelsDirInspection,
  type ModelsDirMode,
  type ModelsDirSource,
} from '@cuccut/protocol';
import { RcModels } from '@cuccut/protocol/messages/runtime-core';
import { taskFailure } from '../localized.ts';

/**
 * Model directory (architecture design §6.3): `models.getDir` / `inspectDir` / `setDir`.
 *
 * Effective directory: if the environment variable `CUCCUT_MODELS_DIR` gives a directory when the Runtime starts, it is used (read-only; `setDir` rejects with `MODELS_DIR_ENV_LOCKED`). Otherwise the setting `models.dir`; if neither, `<runtime-home>/models`.
 *
 * Order of changes: check what is in use (queued or running local-model jobs, moves) → unload all idle Workers (reject if any is busy) → check again →
 * for `switch`, write the setting and change the model directory root; for `move`, submit a `modelsMove` job. During it, all model packs report `relocating` and no jobs can be submitted.
 * After moving and verifying, write the setting, change the root, and delete the files in the original directory. If it fails or is cancelled midway, roll back: the setting and the model directory are unchanged.
 */

const MOVE_QUEUE = { key: 'models:dir', concurrency: 1 };
/** Move progress is reported at most this often. */
const PROGRESS_INTERVAL_MS = 250;
/** Job kinds that count as using the model directory even without a model pack. */
const DIR_KINDS = new Set<JobRecord['kind']>(['modelInstall', 'modelTest', 'modelsMove']);

export interface ModelsDirServiceOptions {
  /** Default directory: `<runtime-home>/models`. */
  defaultDir: string;
  /** Directory given by the environment variable when the Runtime starts; null otherwise (then the setting applies). */
  envDir: string | null;
  /** Reads and writes the `models.dir` setting (a change counts only once written to disk). */
  setting: { get(): string | null; set(value: string | null): Promise<void> };
  catalog: ModelCatalog;
  provider: LocalTranscribeProvider;
  jobs: JobManager;
  log: Logger;
  /** Free space on the disk holding the directory (injected in tests); defaults to statfs. */
  freeBytes?: (dir: string) => Promise<number | null>;
  /** Recomputes the capability view after the directory changes. */
  refresh: () => void;
  /** Test hook. */
  testing?: ModelsDirTestHooks;
}

export interface ModelsDirTestHooks {
  /** Called once before each repository is put in place (to stall a move, or to inject a failure midway). */
  beforePlace?: (repo: string) => Promise<void> | void;
  /** Replaces the check of whether two directories are on the same disk via `stat.dev` (to pretend they are on different disks). */
  sameVolume?: (a: string, b: string) => Promise<boolean>;
}

export class ModelsDirService {
  readonly #options: ModelsDirServiceOptions;
  readonly #log: Logger;
  readonly #freeBytes: (dir: string) => Promise<number | null>;
  readonly #sameVolume: (a: string, b: string) => Promise<boolean>;
  /** Move job → target directory (the `moveTo` for `getDir`). */
  readonly #moveTargets = new Map<Id, string>();

  constructor(options: ModelsDirServiceOptions) {
    this.#options = options;
    this.#log = options.log.child('models-dir');
    this.#freeBytes = options.freeBytes ?? diskFreeBytes;
    this.#sameVolume = options.testing?.sameVolume ?? sameVolume;
    // A move cancelled while queued, or interrupted when the Runtime stops, does not reach `finally`: back to available.
    options.jobs.onChange((job) => {
      if (job.kind === 'modelsMove' && isTerminal(job.state)) this.#moveTargets.delete(job.jobId);
      if (job.kind === 'modelsMove' && isTerminal(job.state) && !this.#activeMove()) {
        options.catalog.setRelocating(false);
        options.refresh();
      }
    });
  }

  /** Effective directory and its source (looks at configuration only, does not touch the disk). */
  resolve(): { path: string; source: ModelsDirSource } {
    if (this.#options.envDir) return { path: this.#options.envDir, source: 'env' };
    const setting = this.#options.setting.get();
    if (setting && path.resolve(setting) !== this.#options.defaultDir) return { path: path.resolve(setting), source: 'setting' };
    return { path: this.#options.defaultDir, source: 'default' };
  }

  /** When the Runtime starts: roll back a move that did not finish (the log is left in the original directory). */
  async recover(): Promise<void> {
    const root = this.#options.catalog.root;
    const recovered = await recoverMove(root).catch((error: unknown) => {
      this.#log.error('Rolling back the unfinished models folder move failed', { error: String(error) });
      return null;
    });
    if (recovered) {
      this.#log.warn('The last models folder move was unfinished and was rolled back', { restored: recovered.restored });
      for (const def of this.#options.catalog.definitions()) this.#options.catalog.changed(def.bundleId);
    }
  }

  async getDir(): Promise<ModelsDirInfo> {
    const { catalog } = this.#options;
    const { source } = this.resolve();
    const root = catalog.root;
    const move = this.#activeMove();
    const access = await dirAccess(root);
    const scan = await scanModelsDir(root, catalog.definitions());
    const bundles = await catalog.list();
    // Same rule as `scanModelsDir`: the publishing-page component (the music engine) lives in the Runtime Home's `tools/` and is not counted as a model in this folder.
    const modelCount = bundles.filter((b) => {
      const required = (b.components ?? []).filter((c) => !c.optional && c.origin !== 'github-release');
      return required.length > 0 && required.every((c) => c.state === 'installed');
    }).length;
    return {
      path: root,
      source,
      defaultPath: this.#options.defaultDir,
      exists: access.exists,
      writable: access.writable,
      usedBytes: scan.bytes,
      freeBytes: access.exists ? await this.#freeBytes(root) : null,
      modelCount,
      moveJobId: move?.jobId ?? null,
      moveTo: move ? (this.#moveTargets.get(move.jobId) ?? null) : null,
    };
  }

  async inspect(target: string | null): Promise<ModelsDirInspection> {
    const { catalog } = this.#options;
    const dir = target === null ? this.#options.defaultDir : path.resolve(target);
    const current = catalog.root;
    const access = await dirAccess(dir);
    const relation = nestedDirs(current, dir);
    const found = access.exists ? await scanModelsDir(dir, catalog.definitions()) : { repos: [], bundleIds: [], bytes: 0 };
    const mine = await scanModelsDir(current, catalog.definitions());
    const plan = access.exists && relation === null ? await planMove(current, dir, catalog.definitions()) : null;
    const same = access.exists && relation === null && (await this.#sameVolume(current, dir));
    const freeBytes = access.exists ? await this.#freeBytes(dir) : await this.#freeBytes(path.dirname(dir));
    const requiredBytes = plan?.bytes ?? 0;
    const problem: ModelsDirInspection['problem'] =
      relation === 'same'
        ? 'same'
        : !access.exists
          ? 'missing'
          : !access.writable
            ? 'not-writable'
            : relation === 'nested'
              ? 'nested'
              : null;
    return {
      path: dir,
      exists: access.exists,
      writable: access.writable,
      freeBytes,
      problem,
      found: { repos: found.repos, bundleIds: found.bundleIds, bytes: found.bytes },
      current: { repos: mine.repos.filter((r) => r.known), bundleIds: mine.bundleIds, bytes: mine.bytes },
      move: { requiredBytes, sameVolume: same, fits: same || requiredBytes === 0 || freeBytes === null || requiredBytes <= freeBytes },
    };
  }

  /** Changes the model directory. */
  async setDir(
    params: { path: string | null; mode: ModelsDirMode; commandId?: Id },
    submitter: JobSubmitter,
  ): Promise<ModelsDirChangeResult> {
    if (params.commandId) {
      const existing = this.#options.jobs.jobForCommand(params.commandId);
      if (existing) return { dir: await this.getDir(), jobId: existing };
    }
    if (this.#options.envDir) {
      throw new RpcError('conflict', RcModels.envLocked(), {
        code: 'MODELS_DIR_ENV_LOCKED',
        path: this.#options.envDir,
      });
    }
    // While a move is in progress, nothing changes (not even switching back to the current location, since the current location changes once the move completes).
    const move = this.#activeMove();
    if (move) {
      throw new RpcError('conflict', RcModels.movingDirWaitOrCancel(), { code: 'MODEL_IN_USE', jobIds: [move.jobId] });
    }
    const target = params.path === null ? this.#options.defaultDir : path.resolve(params.path);
    if (target === this.#options.catalog.root) return { dir: await this.getDir(), jobId: null };
    if (target === this.#options.defaultDir) await fs.mkdir(target, { recursive: true }).catch(() => {});
    const inspection = await this.inspect(target);
    if (inspection.problem === 'missing') {
      throw new RpcError('conflict', RcModels.folderMissing(), { code: 'MODELS_DIR_MISSING', path: target });
    }
    if (inspection.problem === 'not-writable') {
      throw new RpcError('conflict', RcModels.folderNotWritable(), { code: 'MODELS_DIR_NOT_WRITABLE', path: target });
    }
    if (inspection.problem === 'nested') {
      throw new RpcError('conflict', RcModels.dirNested(), {
        code: 'MODELS_DIR_NESTED',
        path: target,
      });
    }
    const moving = params.mode === 'move' && inspection.move.requiredBytes + inspection.current.bytes > 0;
    if (moving && !inspection.move.fits) {
      throw new RpcError('conflict', RcModels.noSpaceForMove(), {
        code: 'MODELS_DIR_NO_SPACE',
        requiredBytes: inspection.move.requiredBytes,
        availableBytes: inspection.freeBytes,
        remedy: RcModels.noSpaceRemedy().text,
        remedyRef: refOf(RcModels.noSpaceRemedy()),
      });
    }
    await this.#quiesce();
    if (!moving) {
      await this.#switchTo(target);
      this.#log.info('Models folder switched', { to: target, mode: params.mode });
      return { dir: await this.getDir(), jobId: null };
    }
    return { dir: await this.getDir(), jobId: await this.#submitMove(target, submitter, params.commandId) };
  }

  /** Tasks that use a local model (queued or running): transcription, synthesis, install, self-test, move. */
  inUse(): Id[] {
    return this.#options.jobs
      .list()
      .filter((j) => !isTerminal(j.state) && (j.bundleId || DIR_KINDS.has(j.kind)))
      .map((j) => j.jobId);
  }

  /** The move in progress; null when there is none. */
  activeMove(): JobRecord | null {
    return this.#activeMove();
  }

  /** No task in use and all Workers unloaded; otherwise `MODEL_IN_USE`. */
  async #quiesce(): Promise<void> {
    const refuse = (jobIds: Id[]): never => {
      throw new RpcError('conflict', RcModels.dirInUse(), { code: 'MODEL_IN_USE', jobIds });
    };
    if (this.inUse().length > 0) refuse(this.inUse());
    for (const def of this.#options.catalog.definitions()) {
      if (!(await this.#options.provider.unload(def.bundleId))) refuse(this.inUse());
    }
    if (this.inUse().length > 0) refuse(this.inUse());
  }

  async #switchTo(target: string): Promise<void> {
    await this.#options.setting.set(target === this.#options.defaultDir ? null : target);
    this.#options.catalog.setRoot(target);
    this.#options.refresh();
  }

  async #submitMove(target: string, submitter: JobSubmitter, commandId: Id | undefined): Promise<Id> {
    const from = this.#options.catalog.root;
    const plan = await planMove(from, target, this.#options.catalog.definitions());
    const same = await this.#sameVolume(from, target);
    const spec = { task: 'modelsMove' as const, from, to: target, repos: plan.move.map((r) => r.repo), bytes: plan.bytes };
    const hash = `sha256:${sha256Hex(canonicalJson({ ...spec, at: Date.now() }))}`;
    const { jobId } = this.#options.jobs.submitTask(
      {
        kind: 'modelsMove',
        spec,
        videoId: null,
        contentHash: hash,
        inputHash: hash,
        providerId: 'local',
        modelId: 'models-dir',
        ...(commandId ? { commandId } : {}),
        queue: MOVE_QUEUE,
        run: (run) => this.#runMove(run, from, target, plan.move, plan.present, same),
      },
      submitter,
    );
    this.#moveTargets.set(jobId, target);
    // Unavailable as soon as it is submitted: during the queued period, no new local tasks may come in either.
    this.#options.catalog.setRelocating(true);
    this.#options.refresh();
    this.#log.info('Models folder move submitted', { jobId, from, to: target, bytes: plan.bytes, sameVolume: same });
    return jobId;
  }

  async #runMove(
    run: TaskRun,
    from: string,
    to: string,
    repos: MoveRepo[],
    present: MoveRepo[],
    same: boolean,
  ): Promise<NonNullable<JobRecord['result']>> {
    const { catalog } = this.#options;
    catalog.setRelocating(true);
    let last = 0;
    let lastPhase = '';
    try {
      await moveModels({
        from,
        to,
        repos,
        sameVolume: same,
        signal: run.signal,
        ...(this.#options.testing?.beforePlace ? { beforePlace: this.#options.testing.beforePlace } : {}),
        onProgress: (p) => {
          const now = Date.now();
          if (p.phase === lastPhase && now - last < PROGRESS_INTERVAL_MS && p.done < p.total) return;
          last = now;
          lastPhase = p.phase;
          run.phase(p.phase, { done: p.done, total: p.total, unit: 'bytes' });
        },
      });
      run.phase('publishing', null);
      try {
        await this.#options.setting.set(to === this.#options.defaultDir ? null : to);
      } catch (error) {
        // Cannot switch: withdraw what was moved over, and the model directory stays as it was.
        await undoMove(
          from,
          to,
          repos.map((r) => r.repo),
          same,
        );
        await clearMoveJournal(from);
        throw error;
      }
      catalog.setRoot(to);
      await clearMoveJournal(from);
      const leftovers = await removeSources(
        from,
        [...repos, ...present].map((r) => r.repo),
      );
      if (leftovers.length > 0) {
        const kept = RcModels.sourceKept({ count: leftovers.length });
        run.warn({ code: 'MODELS_DIR_SOURCE_KEPT', detail: kept.text, detailRef: refOf(kept) });
      }
      const { artifactId } = await this.#options.jobs.artifacts.put(
        Buffer.from(
          canonicalJson({
            schema: 'cuccut.models-move/1',
            from,
            to,
            sameVolume: same,
            moved: repos.map((r) => r.repo),
            alreadyThere: present.map((r) => r.repo),
            bytes: repos.reduce((n, r) => n + r.bytes, 0),
            leftovers,
          }),
        ),
      );
      this.#log.info('Models folder move finished', { jobId: run.jobId, to, moved: repos.length });
      return { documentId: null, artifactId };
    } catch (error) {
      if (run.signal.aborted) throw error;
      this.#log.error('Models folder move failed and was rolled back', { jobId: run.jobId, error: String(error) });
      const nospace = (error as NodeJS.ErrnoException).code === 'ENOSPC';
      const remedy = RcModels.moveFailedRemedy();
      throw taskFailure(
        nospace ? 'MODELS_DIR_NO_SPACE' : 'MODELS_DIR_MOVE_FAILED',
        nospace ? RcModels.moveNoSpace() : RcModels.moveFailed(),
        {
          reason: String(error),
          remedy: remedy.text,
          remedyRef: refOf(remedy),
        },
      );
    } finally {
      catalog.setRelocating(false);
      this.#options.refresh();
    }
  }

  #activeMove(): JobRecord | null {
    return this.#options.jobs.list().find((j) => j.kind === 'modelsMove' && !isTerminal(j.state)) ?? null;
  }
}

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '@cuccut/harness';
import {
  TaskFailure,
  canonicalJson,
  isTerminal,
  localImageResources,
  localMusicResources,
  localTranscribeResources,
  modelDownloadDemand,
  sha256Hex,
  type JobManager,
  type LocalMusicProvider,
  type LocalTranscribeProvider,
  type TaskRun,
} from '@cuccut/jobs';
import {
  APP_FILE_MISSING,
  DEFAULT_TIMESCALE,
  DownloadError,
  IMAGE_SELF_TEST,
  MUSIC_SELF_TEST,
  ModelInstaller,
  ProviderFailure,
  TRANSCRIBE_SELF_TEST,
  appFileMissing,
  builtinReferenceFile,
  bundleUsable,
  freezeReferenceFile,
  imageSelfTestParameters,
  imageSelfTestVerdict,
  inspectWav,
  localSpeechModelInfo,
  musicSelfTestParameters,
  musicSelfTestVerdict,
  normalizeTranscript,
  planLocalVoice,
  resolveModelsEndpoint,
  selfTestMatches,
  selfTestSampleFile,
  separationSelfTestVerdict,
  sha256File,
  speechParameters,
  speechSelfTestRequest,
  speechSelfTestVerdict,
  validateAsrResult,
  type BundleDefinition,
  type InstallPlanDetail,
  type LocalVoicePlan,
  type ModelCatalog,
  type ModelInstallerOptions,
  type ModelChoice,
  type SelfTestSample,
  type TranscribeSink,
} from '@cuccut/models';
import {
  RpcError,
  refOf,
  type FrozenSpeechReference,
  type Localized,
  type MessageRef,
  type Id,
  type JobPhase,
  type JobRecord,
  type JobSubmitter,
  type ModelBundleStatus,
  type ModelCheckCode,
  type ModelInstallResult,
  type ModelRemoveResult,
  type ModelSelfTestResult,
} from '@cuccut/protocol';
import { RcModels } from '@cuccut/protocol/messages/runtime-core';
import { localizedOf, taskFailure } from '../localized.ts';

/**
 * Installation management for local model bundles (architecture design §6.3, §7.9): `models.install` / `repair` / `cancelInstall` / `remove` / `test`.
 *
 * - Installs and checks are ordinary tasks (`kind: 'modelInstall'` / `'modelTest'`) and do not belong to any agent task: progress goes on the `jobs` topic, and bundle state (`downloading`, progress, `selfTest`) is sent by the model catalog as `bundle.updated` on the `models` topic.
 * - Installing takes two steps: first it returns the plan and `confirmBytes`, and the caller returns them unchanged before the task is submitted. Install tasks are queued in a serial queue (one install at a time); checks share a queue with transcription for this bundle (same Worker).
 * - Cancelling an install cancels its task: staging is kept (paused), and installing again resumes it; `discard` deletes staging.
 * - Before deletion, confirm that no task is using this bundle (queued or running transcription, checks, installs). When the Worker is idle it is unloaded first. After deletion, defaults pointing to it from capabilities without a factory default are cleared too.
 */

const INSTALL_QUEUE = { key: 'models:install', concurrency: 1 };
/** Download progress is reported at most this often (on the `jobs` and `models` topics). */
const PROGRESS_INTERVAL_MS = 250;

export interface ModelInstallServiceOptions {
  catalog: ModelCatalog;
  provider: LocalTranscribeProvider;
  /** Local music generation Provider (audio.cpp engine); checks for music model bundles go through it. */
  music: LocalMusicProvider;
  jobs: JobManager;
  log: Logger;
  /** Download source and strict offline mode from settings. */
  settings: () => { downloadEndpoint: string | null; offlineStrict: boolean };
  /** Environment to read `CUCCUT_MODELS_ENDPOINT` from; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Download mirror for release-page components (the music engine) (`CUCCUT_TOOLS_ENDPOINT` / setting `tools.downloadEndpoint`); when null, the official address is used. */
  toolsEndpoint?: () => string | null;
  /** After a release-page component is published, confirms the executable runs (`--version` probe); installation fails if it throws. */
  probeExecutable?: (executable: string) => Promise<void>;
  /** Downloader tuning options (tests inject a local fake service, available space and a built-in manifest); options given here take precedence over the two above. */
  installer?: Omit<ModelInstallerOptions, 'catalog' | 'endpoint'>;
  /** Check samples (tests can replace them). */
  selfTestSample?: SelfTestSample;
  /** Recomputes the capability view after a model bundle changes. */
  refresh: () => void;
  /** After a model bundle is deleted, clears defaults that point to it in capabilities without a factory default (§6.8). */
  clearDefaults?: (bundleId: string) => Promise<unknown>;
}

export class ModelInstallService {
  readonly installer: ModelInstaller;
  readonly #options: ModelInstallServiceOptions;
  readonly #catalog: ModelCatalog;
  readonly #jobs: JobManager;
  readonly #log: Logger;
  readonly #sample: SelfTestSample;

  constructor(options: ModelInstallServiceOptions) {
    this.#options = options;
    this.#catalog = options.catalog;
    this.#jobs = options.jobs;
    this.#log = options.log.child('model-install');
    this.#sample = options.selfTestSample ?? TRANSCRIBE_SELF_TEST;
    this.installer = new ModelInstaller({
      ...(options.toolsEndpoint ? { toolsEndpoint: options.toolsEndpoint } : {}),
      ...(options.probeExecutable ? { probeExecutable: options.probeExecutable } : {}),
      ...options.installer,
      catalog: options.catalog,
      endpoint: () => this.#endpoint(),
    });
    // Install task ends (including cancelled while queued, or interrupted when Runtime stops): falls back to the state judged from the files.
    options.jobs.onChange((job) => {
      if (job.kind !== 'modelInstall' || !job.bundleId || !isTerminal(job.state)) return;
      if (this.#catalog.installState(job.bundleId)?.jobId === job.jobId) this.#catalog.setInstallState(job.bundleId, null);
      if (job.state === 'completed') this.#reloadAfterInstall(job.bundleId);
    });
  }

  /** Install or repair: without `confirmBytes`, only the plan is returned; the task is submitted only if the byte count returned matches the plan. */
  async install(
    params: { bundleId: string; confirmBytes?: number; commandId?: Id },
    submitter: JobSubmitter,
    options: { repair?: boolean } = {},
  ): Promise<ModelInstallResult> {
    const repair = options.repair ?? false;
    this.#definition(params.bundleId);
    if (params.commandId) {
      const existing = this.#jobs.jobForCommand(params.commandId);
      if (existing) return { plan: (await this.#plan(params.bundleId, repair)).plan, jobId: existing };
    }
    if (this.#options.settings().offlineStrict) {
      throw new RpcError('conflict', RcModels.offlineStrict(), { code: 'OFFLINE_STRICT' });
    }
    await this.#guardDir(true);
    const active = this.#activeInstall(params.bundleId);
    const detail = await this.#plan(params.bundleId, repair);
    if (active) return { plan: detail.plan, jobId: active.jobId };
    if (detail.plan.upToDate || params.confirmBytes === undefined) return { plan: detail.plan, jobId: null };
    if (params.confirmBytes !== detail.plan.confirmBytes) {
      throw new RpcError('conflict', RcModels.sizeChanged(), { code: 'MODEL_INSTALL_SIZE_CHANGED', plan: detail.plan });
    }
    const spec = { task: 'modelInstall' as const, bundleId: params.bundleId, repair, confirmBytes: detail.plan.confirmBytes };
    const hash = `sha256:${sha256Hex(canonicalJson({ ...spec, components: detail.plan.components }))}`;
    let jobId = '';
    ({ jobId } = this.#jobs.submitTask(
      {
        kind: 'modelInstall',
        spec,
        videoId: null,
        contentHash: hash,
        inputHash: hash,
        providerId: 'local',
        modelId: params.bundleId,
        bundleId: params.bundleId,
        ...(params.commandId ? { commandId: params.commandId } : {}),
        queue: INSTALL_QUEUE,
        // Peak demand (§7.7): the bytes still to be downloaded go into staging.
        resources: { demand: modelDownloadDemand(detail.plan.confirmBytes) },
        run: (run) => this.#runInstall(run, detail),
      },
      submitter,
    ));
    if (this.#activeInstall(params.bundleId)?.jobId === jobId) {
      this.#catalog.setInstallState(params.bundleId, {
        jobId,
        state: 'queued',
        receivedBytes: detail.plan.resumedBytes,
        totalBytes: detail.totalBytes,
      });
    }
    this.#log.info('Model install submitted', { bundleId: params.bundleId, jobId, repair, confirmBytes: detail.plan.confirmBytes });
    return { plan: detail.plan, jobId };
  }

  /** Stops an install (cancels its task); `discard` deletes staging. */
  async cancelInstall(params: { bundleId: string; discard?: boolean }): Promise<{ bundle: ModelBundleStatus }> {
    this.#definition(params.bundleId);
    const active = this.#activeInstall(params.bundleId);
    if (active) {
      await this.#jobs.cancel(active.jobId);
      await this.#jobs.settled(active.jobId).catch(() => {});
    }
    if (params.discard) {
      // Components shared with other model bundles that are being installed are not deleted.
      const busy = new Set(
        this.#jobs
          .list()
          .filter((j) => j.kind === 'modelInstall' && !isTerminal(j.state) && j.bundleId && j.bundleId !== params.bundleId)
          .flatMap((j) => Object.values(this.#catalog.definition(j.bundleId!)?.components ?? {}).map((s) => `${s.repo}@${s.revision}`)),
      );
      await this.installer.discard(params.bundleId, (source) => busy.has(`${source.repo}@${source.revision}`));
    }
    this.#options.refresh();
    return { bundle: (await this.#catalog.status(params.bundleId))! };
  }

  /** Deletes a model bundle: `MODEL_IN_USE` while in use; idle Workers are unloaded first; after deletion, clears defaults pointing to it from capabilities without a factory default. */
  async remove(bundleId: string): Promise<ModelRemoveResult> {
    this.#definition(bundleId);
    await this.#guardDir(false);
    const refuse = (jobIds: Id[]) => {
      throw new RpcError('conflict', RcModels.bundleInUse(), { code: 'MODEL_IN_USE', bundleId, jobIds });
    };
    // Components of the “说话人区分” (speaker diarization) bundle are loaded by the Workers of the recognition bundles that use it: those Workers must also be idle and unloaded first.
    const holders = [bundleId, ...this.#catalog.diarizationUsers(bundleId)];
    const inUse = () => this.#jobs.list().filter((j) => holders.includes(j.bundleId ?? '') && !isTerminal(j.state));
    if (inUse().length > 0) refuse(inUse().map((j) => j.jobId));
    for (const holder of holders) if (!(await this.#options.provider.unload(holder))) refuse([]);
    if (inUse().length > 0) refuse(inUse().map((j) => j.jobId));
    const { removed, kept } = await this.installer.remove(bundleId);
    this.#log.info('Model package deleted', { bundleId, removed, kept: kept.map((k) => k.repo) });
    await this.#options.clearDefaults?.(bundleId);
    this.#options.refresh();
    return { removed, kept, bundle: (await this.#catalog.status(bundleId))! };
  }

  /**
   * Check: runs a fixed sample through the full Worker flow. A recognition bundle recognizes a fixed recording and verifies the text; a synthesis bundle synthesizes a fixed short sentence with the default voice and verifies the output decodes, the duration is reasonable, and it is not silent; a text-to-image bundle generates one small image with a fixed prompt and seed in a few steps and verifies the PNG decodes, the dimensions match, and it is not a single solid colour; a separation bundle splits the same recording used for recognition (vocals only) into two tracks and verifies they are the same length and the vocals are clearly louder than the background (Model Worker protocol spec §4.3).
   */
  async test(params: { bundleId: string; commandId?: Id }, submitter: JobSubmitter): Promise<{ jobId: Id }> {
    const def = this.#definition(params.bundleId);
    if (def.capability === 'diarize') {
      throw new RpcError('unsupported', RcModels.diarizationNoCheck(), { bundleId: params.bundleId });
    }
    if (params.commandId) {
      const existing = this.#jobs.jobForCommand(params.commandId);
      if (existing) return { jobId: existing };
    }
    await this.#guardDir(false);
    const status = (await this.#catalog.status(params.bundleId))!;
    if (!bundleUsable(status)) throw new RpcError('conflict', RcModels.bundleUnavailable(), { code: 'MODEL_UNAVAILABLE', bundle: status });
    // Inputs shipped with the app (the recognition and separation samples, and the built-in voice recording used for the default synthesis voice) are read here first: if one is missing the install is incomplete, so it is rejected with `APP_FILE_MISSING` and no task is created.
    let sampleFile: string | null = null;
    let contentHash: string;
    if (def.capability === 'synthesize') {
      await this.#speechTestInput(def);
      contentHash = `sha256:${sha256Hex(canonicalJson(speechSelfTestRequest(def)))}`;
    } else if (def.capability === 'image') {
      contentHash = `sha256:${sha256Hex(canonicalJson(IMAGE_SELF_TEST))}`;
    } else if (def.capability === 'music') {
      contentHash = `sha256:${sha256Hex(canonicalJson(MUSIC_SELF_TEST))}`;
    } else {
      sampleFile = selfTestSampleFile(this.#sample);
      const hex = sampleFile ? await sha256File(sampleFile).catch(() => null) : null;
      if (hex === null) throw appFileMissing(selfTestSampleLabel(), this.#sample.asset, sampleFile);
      contentHash = `sha256:${hex}`;
    }
    // For recognition, separation and candle synthesis, the resident size after the Model Worker loads is estimated from the installed components; MLX synthesis is null (a fixed requirement); text-to-image uses the measured peak registered for the model bundle.
    const resources =
      def.capability === 'image'
        ? localImageResources(params.bundleId, this.#catalog.imagePeak(params.bundleId))
        : def.capability === 'music'
          ? localMusicResources(params.bundleId, this.#catalog.musicPeak(params.bundleId))
          : localTranscribeResources(params.bundleId, await this.#catalog.workerFootprint(params.bundleId));
    const spec = { task: 'modelTest' as const, bundleId: params.bundleId };
    return this.#jobs.submitTask(
      {
        kind: 'modelTest',
        spec,
        videoId: null,
        contentHash,
        inputHash: `sha256:${sha256Hex(canonicalJson({ ...spec, contentHash }))}`,
        providerId: 'local',
        modelId: params.bundleId,
        bundleId: params.bundleId,
        ...(params.commandId ? { commandId: params.commandId } : {}),
        // Shares a queue with transcription for this model bundle: same Worker, one task at a time.
        queue: { key: params.bundleId, concurrency: 1 },
        // Uses this model bundle's Model Worker (shared holder with transcription); the user is waiting for the result in the UI, so it is prioritized as interactive.
        resources: { ...resources, priority: 'interactive' },
        run: (run) =>
          def.capability === 'image'
            ? this.#runImageTest(run, def)
            : def.capability === 'music'
              ? this.#runMusicTest(run, def)
              : sampleFile === null
              ? this.#runSpeechTest(run, def)
              : def.capability === 'separate'
                ? this.#runSeparateTest(run, params.bundleId, sampleFile, contentHash)
                : this.#runTest(run, params.bundleId, sampleFile, contentHash),
      },
      submitter,
    );
  }

  /** On Runtime startup: install tasks left unfinished last time are already marked `interrupted`, and staging is kept (reported as paused). */
  activeInstall(bundleId: string): JobRecord | null {
    return this.#activeInstall(bundleId);
  }

  async #runInstall(run: TaskRun, detail: InstallPlanDetail): Promise<NonNullable<JobRecord['result']>> {
    const bundleId = detail.plan.bundleId;
    let last = 0;
    let lastPhase: JobPhase | null = null;
    const report = (phase: JobPhase, received: number, total: number | null, force = false) => {
      const now = Date.now();
      if (!force && phase === lastPhase && now - last < PROGRESS_INTERVAL_MS) return;
      last = now;
      lastPhase = phase;
      run.phase(phase, { done: received, total, unit: 'bytes' });
      this.#catalog.setInstallState(bundleId, {
        jobId: run.jobId,
        state: phase === 'downloading' ? 'downloading' : 'verifying',
        receivedBytes: received,
        totalBytes: total,
      });
    };
    try {
      report('downloading', detail.plan.resumedBytes, detail.totalBytes, true);
      const outcome = await this.installer.install(detail, {
        signal: run.signal,
        onProgress: (p) =>
          report(p.phase === 'publishing' ? 'publishing' : 'downloading', p.receivedBytes, p.totalBytes, p.phase === 'publishing'),
      });
      run.phase('publishing', null);
      const { artifactId } = await this.#jobs.artifacts.put(
        Buffer.from(
          canonicalJson({
            schema: 'cuccut.model-install/1',
            bundleId,
            repair: detail.repair,
            source: detail.endpoint,
            downloadedBytes: outcome.downloadedBytes,
            repos: outcome.published,
          }),
        ),
      );
      this.#log.info('Model install finished', { bundleId, jobId: run.jobId, downloadedBytes: outcome.downloadedBytes });
      return { documentId: null, artifactId };
    } catch (error) {
      if (run.signal.aborted) throw error;
      if (error instanceof DownloadError) {
        this.#log.warn('Model install failed', { bundleId, jobId: run.jobId, code: error.code });
        throw new TaskFailure(error.code, error.message, { ...error.details, remedy: error.remedy });
      }
      this.#log.error('Model install errored', { bundleId, jobId: run.jobId, error: String(error) });
      throw taskFailure('MODEL_INSTALL_FAILED', RcModels.installFailed(), { reason: String(error) });
    } finally {
      this.#catalog.setInstallState(bundleId, null);
      // New files: clears the old verification results and disable records, and recomputes the capability view.
      this.#catalog.enable(bundleId);
      this.#jobs.enable(bundleId);
      this.#options.refresh();
    }
  }

  async #runTest(run: TaskRun, bundleId: string, sampleFile: string, contentHash: string): Promise<NonNullable<JobRecord['result']>> {
    const { record, fail } = this.#verdicts(run, bundleId);
    const sink: TranscribeSink = {
      loading: () => run.phase('loading'),
      phase: (phase) => run.phase(phase),
      progress: (p) => run.phase(p.phase, { done: p.done, total: p.total, unit: p.unit }),
      segment: () => {},
      warning: () => {},
      language: () => {},
    };
    const staging = path.join(run.staging, 'attempt-1');
    await fs.mkdir(staging, { recursive: true });
    let attempt;
    try {
      attempt = await this.#options.provider.transcribe(
        {
          jobId: run.jobId,
          runGeneration: 1,
          providerId: 'local',
          modelId: bundleId,
          bundleId,
          input: { file: sampleFile, contentHash, track: 0 },
          options: { language: { mode: 'prefer', tag: this.#sample.language }, diarize: false, timescale: DEFAULT_TIMESCALE },
          staging,
        },
        sink,
        run.signal,
      );
    } catch (error) {
      // The Worker cannot read the samples shipped with the app: an install problem, not recorded as a failed model check.
      if (error instanceof ProviderFailure && error.kind === 'input-unreadable') {
        throw appFileTaskFailure(appFileMissing(selfTestSampleLabel(), this.#sample.asset, sampleFile));
      }
      if (error instanceof ProviderFailure) return fail(providerCheckCode(error), RcModels.workerFailed({ reason: localizedOf(error) }), providerDetails(error));
      throw error;
    }
    if (attempt.outcome === 'cancelled') {
      run.signal.throwIfAborted();
      return fail('MODEL_WORKER_FAILED', RcModels.workerCancelledCheck());
    }
    run.phase('validating');
    const file = path.resolve(staging, attempt.output.path);
    const bytes = await fs.readFile(file).catch(() => null);
    if (!bytes) return fail('MODEL_OUTPUT_WRONG', RcModels.outputMissing());
    if (bytes.length !== attempt.output.byteLength || sha256Hex(bytes) !== attempt.output.sha256.replace(/^sha256:/, '')) {
      return fail('MODEL_OUTPUT_WRONG', RcModels.outputMismatch());
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      return fail('MODEL_OUTPUT_WRONG', RcModels.outputNotJson());
    }
    const validation = validateAsrResult(parsed, { runGeneration: 1 });
    if (!validation.ok) return fail('MODEL_OUTPUT_WRONG', RcModels.outputNotAsrResult(), { problems: validation.problems });
    const text = normalizeTranscript(validation.result.segments.map((s) => s.text).join(' '));
    if (!selfTestMatches(text, this.#sample)) {
      return fail('MODEL_OUTPUT_WRONG', RcModels.transcriptMissingExpected({ expected: this.#sample.expected }), {
        expected: this.#sample.expected,
        text: text.slice(0, 200),
      });
    }
    run.phase('publishing');
    const { artifactId } = await this.#jobs.artifacts.put(bytes);
    await record('passed', text.slice(0, 200));
    this.#log.info('Model check passed', { bundleId, jobId: run.jobId });
    return { documentId: null, artifactId };
  }

  async #runSeparateTest(
    run: TaskRun,
    bundleId: string,
    sampleFile: string,
    contentHash: string,
  ): Promise<NonNullable<JobRecord['result']>> {
    const { record, fail } = this.#verdicts(run, bundleId);
    const sample = inspectWav(await fs.readFile(sampleFile).catch(() => Buffer.alloc(0)));
    if (!sample.ok) throw appFileTaskFailure(appFileMissing(selfTestSampleLabel(), this.#sample.asset, sampleFile));
    const staging = path.join(run.staging, 'attempt-1');
    await fs.mkdir(staging, { recursive: true });
    run.phase('loading');
    let attempt;
    try {
      attempt = await this.#options.provider.separate(
        { bundleId, jobId: run.jobId, input: { file: sampleFile, contentHash, track: 0 }, sampleRate: null, staging },
        run.signal,
        (done, total) => run.phase('generating', { done, total, unit: 'steps' }),
      );
    } catch (error) {
      // The Worker cannot read the samples shipped with the app: an install problem, not recorded as a failed model check.
      if (error instanceof ProviderFailure && error.kind === 'input-unreadable') {
        throw appFileTaskFailure(appFileMissing(selfTestSampleLabel(), this.#sample.asset, sampleFile));
      }
      if (error instanceof ProviderFailure) return fail(providerCheckCode(error), RcModels.workerFailed({ reason: localizedOf(error) }), providerDetails(error));
      throw error;
    }
    if (attempt.outcome === 'cancelled') {
      run.signal.throwIfAborted();
      return fail('MODEL_WORKER_FAILED', RcModels.workerCancelledCheck());
    }
    run.phase('validating');
    const stems = attempt.result.stems!;
    const bytes = { vocals: Buffer.alloc(0), background: Buffer.alloc(0) };
    for (const name of ['vocals', 'background'] as const) {
      const read = await fs.readFile(attempt[name]).catch(() => null);
      if (!read) return fail('MODEL_OUTPUT_WRONG', RcModels.namedOutputMissing({ file: path.basename(attempt[name]) }));
      if (read.length !== stems[name].byteLength || sha256Hex(read) !== stems[name].sha256.replace(/^sha256:/, '')) {
        return fail('MODEL_OUTPUT_WRONG', RcModels.namedOutputMismatch({ file: path.basename(attempt[name]) }));
      }
      bytes[name] = read;
    }
    const verdict = separationSelfTestVerdict(bytes, sample.wav.durationSec);
    if (!verdict.passed) return fail('MODEL_OUTPUT_WRONG', verdict.problem);
    run.phase('publishing');
    const { artifactId } = await this.#jobs.artifacts.put(bytes.vocals, 'wav');
    const ratio = verdict.background.rms > 0 ? 20 * Math.log10(verdict.vocals.rms / verdict.background.rms) : Infinity;
    const detail = RcModels.separationPassed({
      duration: verdict.vocals.durationSec.toFixed(2),
      sampleRate: verdict.vocals.sampleRate,
      ratio: Number.isFinite(ratio) ? ratio.toFixed(0) : '',
      finite: Number.isFinite(ratio),
    });
    await record('passed', detail);
    this.#log.info('Model check passed', { bundleId, jobId: run.jobId, detail: detail.text });
    return { documentId: null, artifactId };
  }

  async #runSpeechTest(run: TaskRun, def: BundleDefinition): Promise<NonNullable<JobRecord['result']>> {
    const bundleId = def.bundleId;
    const { record, fail } = this.#verdicts(run, bundleId);
    let input: SpeechTestInput;
    try {
      input = await this.#speechTestInput(def);
    } catch (error) {
      // The built-in voice recording disappeared after submission: it is `APP_FILE_MISSING`, just as at submission, not recorded as a failed model check, and not counted as an internal error.
      if (error instanceof RpcError && (error.details as { code?: unknown } | undefined)?.code === APP_FILE_MISSING) {
        throw appFileTaskFailure(error);
      }
      throw error;
    }
    const { choice, request, plan, reference } = input;
    const parameters = speechParameters(choice, request, { plan, reference });

    const staging = path.join(run.staging, 'attempt-1');
    await fs.mkdir(staging, { recursive: true });
    run.phase('loading');
    let attempt;
    try {
      attempt = await this.#options.provider.synthesize(
        { jobId: run.jobId, attempt: 1, providerId: 'local', modelId: bundleId, parameters, staging },
        {
          generating: () => run.phase('generating'),
          progress: (done, total, unit = 'outputs') => run.phase('generating', { done, total, unit }),
        },
        run.signal,
      );
    } catch (error) {
      // Cannot read the built-in voice recording (the local Provider has already explained it as `APP_FILE_MISSING`): an install problem, not recorded as a failed model check.
      if (error instanceof ProviderFailure && error.details.code === APP_FILE_MISSING) {
        throw new TaskFailure(APP_FILE_MISSING, error.message, { kind: error.kind, ...error.details, check: APP_FILE_MISSING });
      }
      if (error instanceof ProviderFailure) return fail(providerCheckCode(error), RcModels.workerFailed({ reason: localizedOf(error) }), providerDetails(error));
      throw error;
    }
    if (attempt.outcome === 'cancelled') {
      run.signal.throwIfAborted();
      return fail('MODEL_WORKER_FAILED', RcModels.workerCancelledCheck());
    }
    run.phase('validating');
    const output = attempt.outputs[0];
    if (!output) return fail('MODEL_OUTPUT_WRONG', RcModels.noWorkerOutput());
    const bytes = await fs.readFile(path.resolve(staging, output.path)).catch(() => null);
    if (!bytes) return fail('MODEL_OUTPUT_WRONG', RcModels.outputMissing());
    if (bytes.length !== output.byteLength || sha256Hex(bytes) !== output.sha256) {
      return fail('MODEL_OUTPUT_WRONG', RcModels.outputMismatch());
    }
    const verdict = speechSelfTestVerdict(bytes);
    if (!verdict.passed) return fail('MODEL_OUTPUT_WRONG', verdict.problem, verdict.wav ? { wav: verdict.wav } : {});
    run.phase('publishing');
    const { artifactId } = await this.#jobs.artifacts.put(bytes, 'wav');
    const { durationSec, sampleRate } = verdict.wav;
    await record('passed', RcModels.speechPassed({ duration: durationSec.toFixed(2), sampleRate }));
    this.#log.info('Model check passed', { bundleId, jobId: run.jobId, durationSec, sampleRate });
    return { documentId: null, artifactId };
  }

  async #runImageTest(run: TaskRun, def: BundleDefinition): Promise<NonNullable<JobRecord['result']>> {
    const bundleId = def.bundleId;
    const { record, fail } = this.#verdicts(run, bundleId);
    const staging = path.join(run.staging, 'attempt-1');
    await fs.mkdir(staging, { recursive: true });
    run.phase('loading');
    let attempt;
    try {
      attempt = await this.#options.provider.generateImage(
        { jobId: run.jobId, attempt: 1, providerId: 'local', modelId: bundleId, parameters: imageSelfTestParameters(), staging },
        {
          generating: () => run.phase('generating'),
          progress: (done, total, unit = 'outputs') => run.phase('generating', { done, total, unit }),
        },
        run.signal,
        { steps: IMAGE_SELF_TEST.steps },
      );
    } catch (error) {
      if (error instanceof ProviderFailure) return fail(providerCheckCode(error), RcModels.workerFailed({ reason: localizedOf(error) }), providerDetails(error));
      throw error;
    }
    if (attempt.outcome === 'cancelled') {
      run.signal.throwIfAborted();
      return fail('MODEL_WORKER_FAILED', RcModels.workerCancelledCheck());
    }
    run.phase('validating');
    const output = attempt.outputs[0];
    if (!output) return fail('MODEL_OUTPUT_WRONG', RcModels.noWorkerOutput());
    const bytes = await fs.readFile(path.resolve(staging, output.path)).catch(() => null);
    if (!bytes) return fail('MODEL_OUTPUT_WRONG', RcModels.outputMissing());
    if (bytes.length !== output.byteLength || sha256Hex(bytes) !== output.sha256) {
      return fail('MODEL_OUTPUT_WRONG', RcModels.outputMismatch());
    }
    const verdict = imageSelfTestVerdict(bytes);
    if (!verdict.passed) return fail('MODEL_OUTPUT_WRONG', verdict.problem, verdict.png ? { png: verdict.png } : {});
    run.phase('publishing');
    const { artifactId } = await this.#jobs.artifacts.put(bytes, 'png');
    const { width, height } = verdict.png;
    await record('passed', RcModels.imagePassed({ width, height, steps: IMAGE_SELF_TEST.steps }));
    this.#log.info('Model check passed', { bundleId, jobId: run.jobId, width, height });
    return { documentId: null, artifactId };
  }

  /** Check for music model bundles (Model Worker protocol spec §4.4): generates a few seconds of instrumental music with a fixed style, seed and few steps; the verdict is the same as for synthesis. */
  async #runMusicTest(run: TaskRun, def: BundleDefinition): Promise<NonNullable<JobRecord['result']>> {
    const bundleId = def.bundleId;
    const { record, fail } = this.#verdicts(run, bundleId);
    const staging = path.join(run.staging, 'attempt-1');
    await fs.mkdir(staging, { recursive: true });
    run.phase('loading');
    let attempt;
    try {
      attempt = await this.#options.music.generateMusic(
        { jobId: run.jobId, attempt: 1, providerId: 'local', modelId: bundleId, parameters: musicSelfTestParameters(), staging },
        {
          generating: () => run.phase('generating'),
          progress: (done, total, unit = 'outputs') => run.phase('generating', { done, total, unit }),
        },
        run.signal,
        { steps: MUSIC_SELF_TEST.steps },
      );
    } catch (error) {
      if (error instanceof ProviderFailure) return fail(providerCheckCode(error), RcModels.workerFailed({ reason: localizedOf(error) }), providerDetails(error));
      throw error;
    }
    if (attempt.outcome === 'cancelled') {
      run.signal.throwIfAborted();
      return fail('MODEL_WORKER_FAILED', RcModels.workerCancelledCheck());
    }
    run.phase('validating');
    const output = attempt.outputs[0];
    if (!output) return fail('MODEL_OUTPUT_WRONG', RcModels.noWorkerOutput());
    const bytes = await fs.readFile(path.resolve(staging, output.path)).catch(() => null);
    if (!bytes) return fail('MODEL_OUTPUT_WRONG', RcModels.outputMissing());
    if (bytes.length !== output.byteLength || sha256Hex(bytes) !== output.sha256) {
      return fail('MODEL_OUTPUT_WRONG', RcModels.outputMismatch());
    }
    const verdict = musicSelfTestVerdict(bytes);
    if (!verdict.passed) return fail('MODEL_OUTPUT_WRONG', verdict.problem, verdict.wav ? { wav: verdict.wav } : {});
    run.phase('publishing');
    const { artifactId } = await this.#jobs.artifacts.put(bytes, 'wav');
    const { durationSec, sampleRate } = verdict.wav;
    await record('passed', RcModels.musicPassed({ duration: durationSec.toFixed(2), sampleRate, steps: MUSIC_SELF_TEST.steps }));
    this.#log.info('Model check passed', { bundleId, jobId: run.jobId, durationSec, sampleRate });
    return { documentId: null, artifactId };
  }

  /**
   * The two verdicts of a check: `record` notes a pass; `fail` notes a failure (`code` and `facts` are recorded together in the model bundle's `selfTest`), and the task fails with `MODEL_SELF_TEST_FAILED`; `details.check` is the same code (command and protocol spec §11.3).
   */
  #verdicts(run: TaskRun, bundleId: string) {
    const save = async (result: ModelSelfTestResult) => {
      await this.installer.recordSelfTest(bundleId, result).catch((error: unknown) => {
        this.#log.error('Writing the check result failed', { bundleId, error: String(error) });
      });
    };
    const record = (state: 'passed', detail: string | Localized) =>
      save({ state, jobId: run.jobId, at: new Date().toISOString(), ...detailFields(detail) });
    const fail = async (code: ModelCheckCode, message: string | Localized, details: Record<string, unknown> = {}): Promise<never> => {
      const facts = checkFacts(details);
      await save({
        state: 'failed',
        jobId: run.jobId,
        at: new Date().toISOString(),
        ...detailFields(message),
        code,
        ...(facts.length ? { facts } : {}),
      });
      const failure = new TaskFailure('MODEL_SELF_TEST_FAILED', String(message), { ...details, check: code, facts });
      throw typeof message === 'string' ? failure : Object.assign(failure, { messageRef: refOf(message) });
    };
    return { record, fail };
  }

  /** Inputs for the synthesis check, using the same freezing path as a formal submission: the model's default voice, and the built-in voice recording frozen by digest (`APP_FILE_MISSING` if it cannot be read). */
  async #speechTestInput(def: BundleDefinition): Promise<SpeechTestInput> {
    const request = speechSelfTestRequest(def);
    const status = (await this.#catalog.status(def.bundleId))!;
    const model = localSpeechModelInfo(def, status, true);
    const choice: ModelChoice<'synthesizeSpeech'> = {
      capability: 'synthesizeSpeech',
      providerId: 'local',
      modelId: def.bundleId,
      kind: 'local',
      label: model.label,
      source: 'explicit',
      model,
    };
    const plan = planLocalVoice(choice, request);
    const builtin = builtinReferenceFile(model, plan);
    const withTranscript = model.local?.reference?.acceptsTranscript ?? false;
    const reference = builtin ? await freezeReferenceFile({ ...builtin, transcript: withTranscript ? builtin.transcript : null }) : null;
    return { choice, request, plan, reference };
  }

  async #plan(bundleId: string, repair: boolean): Promise<InstallPlanDetail> {
    try {
      return await this.installer.plan(bundleId, { repair });
    } catch (error) {
      if (error instanceof DownloadError) {
        throw new RpcError('conflict', error.message, { code: error.code, remedy: error.remedy, ...error.details });
      }
      throw error;
    }
  }

  /**
   * While the model directory is being moved (`move` in `models.setDir`), nothing is installed, deleted or checked: `MODEL_IN_USE`. When writing (install, repair), the directory must still exist: if an external drive is not connected, a directory of the same name is not created out of thin air somewhere else (`MODELS_DIR_MISSING`).
   */
  async #guardDir(write: boolean): Promise<void> {
    const move = this.#jobs.list().find((j) => j.kind === 'modelsMove' && !isTerminal(j.state));
    if (move) {
      throw new RpcError('conflict', RcModels.movingDirWait(), { code: 'MODEL_IN_USE', jobIds: [move.jobId] });
    }
    if (write && !(await fs.stat(this.#catalog.root).catch(() => null))?.isDirectory()) {
      throw new RpcError('conflict', RcModels.dirMissing(), {
        code: 'MODELS_DIR_MISSING',
      });
    }
  }

  #activeInstall(bundleId: string): JobRecord | null {
    return this.#jobs.list().find((j) => j.kind === 'modelInstall' && j.bundleId === bundleId && !isTerminal(j.state)) ?? null;
  }

  #endpoint(): string {
    try {
      return resolveModelsEndpoint(this.#options.env ?? process.env, this.#options.settings().downloadEndpoint).endpoint;
    } catch (error) {
      throw new RpcError('invalid-request', (error as Error).message, { code: 'MODEL_DOWNLOAD_SOURCE' });
    }
  }

  /**
   * After installing, completing or repairing, Workers that are already loaded still have the old components: this model bundle's own (the optional components just added and the bad files replaced were not read), and the recognition bundles that use this “说话人区分” (speaker diarization) bundle (which lack its components). Idle ones are unloaded first, and the next task loads them with the new components. Running tasks are not interrupted (they finish with the components they started with; those missing “说话人区分” report `diarization-unavailable`), and once idle they unload on timeout as usual.
   */
  #reloadAfterInstall(bundleId: string): void {
    for (const id of [bundleId, ...this.#catalog.diarizationUsers(bundleId)]) {
      void this.#options.provider
        .unload(id)
        .catch((error: unknown) => this.#log.warn('Unloading the model package failed', { bundleId: id, error: String(error) }));
    }
  }

  #definition(bundleId: string): BundleDefinition {
    const def = this.#catalog.definition(bundleId);
    if (!def) throw new RpcError('not-found', RcModels.noSuchBundle({ bundleId }));
    return def;
  }
}

/** What the check sample is called in errors (shown to people, in the current language). */
function selfTestSampleLabel(): string {
  return RcModels.selfTestSampleLabel().text;
}

/** Explanation of the check verdict: Runtime's copy is recorded together with its reference; anything else (recognized text, reasons given by the model bundle) is recorded as text only. */
function detailFields(detail: string | Localized): { detail: string; detailRef?: MessageRef } {
  return typeof detail === 'string' ? { detail } : { detail: detail.text, detailRef: refOf(detail) };
}

interface SpeechTestInput {
  choice: ModelChoice<'synthesizeSpeech'>;
  request: ReturnType<typeof speechSelfTestRequest>;
  plan: LocalVoicePlan;
  reference: FrozenSpeechReference | null;
}

/** If a file shipped with the app cannot be read during execution: the task fails with `APP_FILE_MISSING`, and the message and `details` repeat the sentence used at submission. */
function appFileTaskFailure(error: RpcError): TaskFailure {
  const failure = new TaskFailure(APP_FILE_MISSING, error.message, {
    ...(error.details as Record<string, unknown> | undefined),
    check: APP_FILE_MISSING,
  });
  return error.messageRef ? Object.assign(failure, { messageRef: error.messageRef }) : failure;
}

/**
 * Failure on the Worker side → reason the check did not pass: a file missing or corrupt at load time (`MODEL_NOT_INSTALLED`) is a model file problem; insufficient resources (`MODEL_RESOURCE`) means not enough memory; a response that violates the protocol is treated as wrong output; the rest (fails to start, exits midway, unsupported, disabled) are Worker problems.
 */
export function providerCheckCode(error: ProviderFailure): ModelCheckCode {
  const reason = error.details.reason;
  if (error.kind === 'load-failed' && reason === 'not-installed') return 'MODEL_FILES_DAMAGED';
  if (error.kind === 'load-failed' && reason === 'resource') return 'MODEL_OUT_OF_MEMORY';
  if (error.kind === 'protocol') return 'MODEL_OUTPUT_WRONG';
  return 'MODEL_WORKER_FAILED';
}

function providerDetails(error: ProviderFailure): Record<string, unknown> {
  return { kind: error.kind, ...error.details };
}

/** Not included in technical details: the process's stderr (it may contain local paths) and absolute local paths. */
const FACT_SKIP = new Set(['stderrTail', 'staging']);
/** Local paths embedded in values: common macOS / Linux roots, or Windows drive-letter paths. */
const LOCAL_PATH = /(^|[\s"'(])(\/(Users|home|private|var|tmp|Volumes)\/|[A-Za-z]:\\)/;
const FACT_ORDER = ['kind', 'reason', 'workerCode', 'workerMessage', 'workerDetails', 'expected', 'text', 'problems', 'wav', 'png'];

/**
 * Failed `details` → a few lines of technical detail (`key: value`): for use in feedback reports, recorded in the install record, so stderr and absolute local paths are left out; objects are written as compact JSON, and overly long ones are truncated.
 */
export function checkFacts(details: Record<string, unknown>): string[] {
  const keys = Object.keys(details)
    .filter((k) => !FACT_SKIP.has(k) && details[k] !== undefined && details[k] !== null)
    .sort((a, b) => rank(a) - rank(b));
  const lines: string[] = [];
  for (const key of keys) {
    const raw = details[key];
    const value = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (!value || path.isAbsolute(value) || LOCAL_PATH.test(value)) continue;
    lines.push(`${key}: ${value.length > 300 ? `${value.slice(0, 300)}…` : value}`);
  }
  return lines;
}

function rank(key: string): number {
  const i = FACT_ORDER.indexOf(key);
  return i < 0 ? FACT_ORDER.length : i;
}

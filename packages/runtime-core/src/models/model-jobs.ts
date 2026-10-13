import { statSync } from 'node:fs';
import path from 'node:path';
import { TopicLog, type Logger } from '@cuccut/harness';
import {
  JobManager,
  LocalMusicProvider,
  LocalTranscribeProvider,
  MachineCapacity,
  ResourceScheduler,
  PIPELINE_ACTOR_ID,
  PipelineRunner,
  dubPipeline,
  speakersPipeline,
  localDubSeparator,
  resolveSpeechWorkerCommand,
  ffprobeMediaProbe,
  transcodePipeline,
  transcribePipeline,
  translatePipeline,
  translateSubtitlesPipeline,
  type CaptionVideos,
  type MediaVideos,
  type PipelineTranscriber,
  type TranscribeDeps,
  type JobFaults,
  type JobLibrary,
  type DubVideos,
  type FrozenDubParams,
  type JobVideos,
  type PipelineDefinition,
  type PipelineTargets,
  type PipelineVideos,
  type ProbeToolResolver,
  type CapacitySource,
} from '@cuccut/jobs';
import {
  AUDIO_CPP_BACKEND_ENV,
  AUDIO_CPP_CLI_ENV,
  AUDIO_CPP_ENGINE,
  LocalProviderSource,
  ModelCatalog,
  ModelServiceStore,
  ModelServices,
  UsageLedger,
  parseAudioCppVersion,
  type BundleDefinition,
  type ProviderSource,
} from '@cuccut/models';
import {
  RpcError,
  type Actor,
  type GrantDataKind,
  type Id,
  type JobsEvent,
  type JobsSnapshot,
  type ModelsEvent,
  type ResourceCapacitySetting,
  type ModelsSnapshot,
} from '@cuccut/protocol';
import {
  AgentProviderSource,
  OnlineProviderSource,
  type AgentDrivers,
  type AgentSourceOptions,
  type FfmpegResolver,
  type OnlineSourceOptions,
  type VoiceCloner,
} from '@cuccut/providers';
import type { CredentialStore, RuntimeHome } from '@cuccut/runtime-storage';
import type { TrustedPrincipal } from '../gateway.ts';
import type { EngineProtection, EngineRun, VideoService } from '../videos/video-service.ts';
import type { ModelWorkerCommand } from './model-worker.ts';
import { ModelInstallService, type ModelInstallServiceOptions } from './model-install-service.ts';
import { ModelsDirService, type ModelsDirServiceOptions, type ModelsDirTestHooks } from './models-dir-service.ts';
import { GrantService } from '../grants/grant-service.ts';
import { grantedTextGenerator, withPipelineGrants } from '../grants/pipeline-grants.ts';
import type { TextPlanResult } from '../exports/export-plan.ts';
import { DUB_DATA_KINDS, dubSpeech, withDubGrantGuidance } from './dub-speech.ts';
import { pipelineTargets, placeLocation, videoPlace, type PipelineTargetsOptions } from '../videos/pipeline-targets.ts';
import { RcExternalTools, RcModels } from '@cuccut/protocol/messages/runtime-core';
import { toolsDownloadEndpoint } from '../external-tools/external-tool-service.ts';
import { runVersionProbe } from '../external-tools/tool-probe.ts';

/** The actor when Runtime itself writes transcription results and imports generated assets (architecture design §7.3). */
export const JOBS_ACTOR: Actor = { kind: 'system', id: 'system:jobs' };

/** Data sent out by the translation flow: the video's transcript. */
const TRANSLATE_DATA_KINDS: GrantDataKind[] = ['transcript'];

/** Data sent out by the transcription flow: the asset's audio (same as a directly submitted `models.transcribe`). */
const TRANSCRIBE_DATA_KINDS: GrantDataKind[] = ['audio'];

/** The actor when a fixed flow writes to a video (architecture design §7.9). */
export const PIPELINE_ACTOR: Actor = { kind: 'system', id: PIPELINE_ACTOR_ID };

export interface ModelJobs {
  catalog: ModelCatalog;
  provider: LocalTranscribeProvider;
  /** Model service: Provider registry, configuration and selection (§6.1, §6.2). */
  services: ModelServices;
  jobs: JobManager;
  /** Fixed flows (§7.9): the parent task and its steps are recorded in `jobs`. */
  pipelines: PipelineRunner;
  /** `jobs` topic: the snapshot is the retained task records plus the live segments of running transcriptions; events are a record's new state or newly recognized segments of a transcription. */
  topic: TopicLog<JobsSnapshot, JobsEvent>;
  /** `models` topic: the snapshot is the full capability view and model bundle states; events are a new capability view, or a new state for one model bundle. */
  modelsTopic: TopicLog<ModelsSnapshot, ModelsEvent>;
  /** Installation, repair, deletion and self-test of local model bundles (§6.3). */
  installs: ModelInstallService;
  /** Model directory: where it is and where it is moved to (§6.3). */
  dir: ModelsDirService;
  /** Authorization and budget for outgoing data (§12.5, §7.8): JobManager admits outgoing tasks through it when they are submitted; the `grants` topic. */
  grants: GrantService;
  /** Voice cloning interface of an online Provider (§5.9); null when there is no cloning interface. */
  voiceCloner(providerId: string): VoiceCloner | null;
  /** Waits for queued usage records (§6.10) and the accounts' last-used times (§6.8) to finish writing; called at shutdown. */
  flushUsage(): Promise<void>;
}

export interface ModelJobsOptions {
  home: RuntimeHome;
  /** Keys for each online Provider account (`provider:<providerId>/<accountId>`), sharing one instance with the node token (§6.8). */
  credentials: CredentialStore;
  videos: VideoService;
  log: Logger;
  /** Command for the Model Worker; null means local inference is unavailable. */
  worker: () => ModelWorkerCommand | null;
  /** Command for the Speech Worker (the translation step of translation and translated dubbing, architecture design §7.9); when not given, it is found via `resolveSpeechWorkerCommand`. null means it was not built. */
  speechWorker?: () => string | null;
  env: () => Promise<NodeJS.ProcessEnv>;
  /**
   * Environment for reading external tool overrides (`CUCCUT_AUDIOCPP_CLI`: the developer override for the music engine); defaults to `process.env`. Tests pass an object without real environment variables.
   */
  toolOverrides?: NodeJS.ProcessEnv;
  /**
   * Download mirror for the release-page component (the audio.cpp engine of the music model bundle): `CUCCUT_TOOLS_ENDPOINT` or the setting `tools.downloadEndpoint`, read once when the plan is made;
   * throws if invalid (`TOOL_DOWNLOAD_SOURCE`). When not given, the official address is used.
   */
  toolsEndpoint?: () => string | null;
  idleMs?: number;
  /** Preference `resources.capacity` (read at each admission; changes take effect immediately). */
  resourceCapacity?: () => ResourceCapacitySetting | null;
  /** Machine capacity injected by tests; when not given, it is probed on this machine (disk by the volume where staging lives). */
  capacity?: CapacitySource;
  /** Provider source for remote nodes (§6.7). When absent, every `node:*` returns `not-found`. */
  remote?: ProviderSource;
  /** ffmpeg used by online Providers to prepare audio and transcode files (§7.9). */
  ffmpeg: FfmpegResolver;
  /** ffprobe used to decode-check generated output (audio, images) before publishing. */
  ffprobe: ProbeToolResolver;
  /** User library (architecture design §5.9): transcription glossaries and synthesis `library:<id>` voices. */
  library?: JobLibrary;
  /** Glossaries enabled for a step of a video and still in the library at this moment (`LibraryService.enabledGlossaries`): the transcription flow applies the transcription glossary from these. */
  enabledGlossaries?: (videoId: Id, step: 'transcribe') => Promise<{ ids: Id[] }>;
  /** Tuning options for online Providers (tests point the built-in Providers' base URLs at a local fake service and shorten backoff). */
  online?: Omit<OnlineSourceOptions, 'store' | 'ffmpeg'>;
  /** Driver registry used by agent Providers (§6.9). When absent, `agent:*` is not listed. */
  agents?: AgentDrivers;
  /** Tuning options for agent Providers (tests shorten the probe cache and deadlines). */
  agentProviders?: Omit<AgentSourceOptions, 'store' | 'drivers'>;
  /** Settings used for model installation (download source, strict offline). Defaults apply when not given. */
  installSettings?: ModelInstallServiceOptions['settings'];
  /**
   * Reads and writes the setting `models.dir` (§6.3). The environment variable `CUCCUT_MODELS_DIR` (used when `home.modelsDir` is not `<home>/models`) takes precedence over it.
   * When not given, only `home.modelsDir` is used, and it cannot be changed.
   */
  modelsDirSetting?: ModelsDirServiceOptions['setting'];
  /** For tests: stalls or interrupts moving the model directory, and pretends it crosses disks. */
  modelsDirTesting?: ModelsDirTestHooks;
  /** Tuning options for model installation: tests point the download source at a local fake service, and inject available space, a built-in manifest and self-test samples. */
  modelInstall?: Pick<ModelInstallServiceOptions, 'installer' | 'selfTestSample' | 'env'> & {
    /** For tests: replaces a registered model bundle (for example, swaps the music engine's release for a fake archive built locally). */
    bundles?: readonly BundleDefinition[];
  };
  /**
   * Save location (§7.9 “保存位置” (save location)): results of flows without a video (file transcoding, subtitle file translation, transcription of a file only) are written here when no `outDir` is given;
   * it is read once at submission and frozen. When not given (in unit tests only), it is written next to the source file.
   */
  saveDirectory?: () => string;
  /** The flow's video target (§7.9): the location of the Space entry and the project directory. When not given, the flow accepts only an already open `videoId`. */
  pipelineTargets?: PipelineTargetsOptions;
  /** Fixed flows registered separately (imported from a link): created after the task store, the video-writing capability and the model service are obtained. */
  extraPipelines?: (context: ExtraPipelineContext) => Array<PipelineDefinition<any, any>>;
  /** Fault injection (for tests). */
  faults?: JobFaults;
  /**
   * The protection scope that an agent task's contract currently has over a video (§3.2): Jobs under the task and flow steps carry it when they apply results to the video, and the engine checks as usual.
   * The Harness opens later than the task ledger: it waits for it to be ready before answering; when the task no longer exists, the list is empty. When not given, writes within the task are not protected either.
   */
  taskProtections?: (taskId: Id, videoId: Id) => Promise<EngineProtection[]>;
}

export interface ExtraPipelineContext {
  grants: GrantService;
  jobs: JobManager;
  videos: CaptionVideos & MediaVideos;
  /** Transcription within a flow (reuses the `models.transcribe` submission). */
  transcriber: PipelineTranscriber;
  services: ModelServices;
  /** Opening and creating video targets; null when not configured. */
  targets: PipelineTargets | null;
  /** Transcription glossaries enabled in the video and still in the library at this moment (same as the transcription flow); none when not wired up. */
  enabledGlossaries?: (videoId: Id) => Promise<Id[]>;
}

/** Assembles the model catalog, Provider registry and JobManager, and wires task changes to the `jobs` topic and capability view changes to the `models` topic. */
export async function openModelJobs(options: ModelJobsOptions): Promise<ModelJobs> {
  const { home, videos } = options;
  const log = options.log.child('jobs');
  const manifests = options.modelInstall?.installer?.manifests;
  // Model directory (§6.3): when `home.modelsDir` is not `<home>/models`, it comes from the environment variable and is read-only; otherwise the setting `models.dir` takes precedence over the default location.
  const defaultModelsDir = path.join(home.root, 'models');
  const envModelsDir = path.resolve(home.modelsDir) !== defaultModelsDir ? path.resolve(home.modelsDir) : null;
  const dirSetting = options.modelsDirSetting ?? { get: () => null, set: async () => {} };
  const configuredDir = dirSetting.get();
  const toolOverrides = options.toolOverrides ?? process.env;
  const { bundles: testBundles, ...modelInstall } = options.modelInstall ?? {};
  // The music model bundle's engine is its release-page component (§6.3), installed under `tools/` in the Runtime Home, and does not move with the model directory.
  const catalog = new ModelCatalog({
    root: envModelsDir ?? (configuredDir ? path.resolve(configuredDir) : defaultModelsDir),
    toolsDir: path.join(home.root, 'tools'),
    engineOverride: toolOverrides[AUDIO_CPP_CLI_ENV] || null,
    workerAvailable: () => options.worker() !== null,
    ...(manifests ? { manifests } : {}),
    ...(testBundles ? { bundles: testBundles } : {}),
  });
  // Looked up again for each task (no restart needed after the model bundle is installed): developer override → installed engine component → PATH.
  const musicEngine = (bundleId: string) => resolveAudioCppCli(toolOverrides, () => catalog.engineExecutable(bundleId));
  // Resource scheduling (§7.6, §7.7): the Model Worker process is shared by all tasks.
  const resources = new ResourceScheduler({
    capacity:
      options.capacity ??
      new MachineCapacity({ scratchDir: home.stagingDir, ...(options.resourceCapacity ? { override: options.resourceCapacity } : {}) }),
    log,
  });
  const provider = new LocalTranscribeProvider({
    catalog,
    command: options.worker,
    env: options.env,
    log,
    idleMs: options.idleMs,
    resources,
  });
  // Local music generation (§6.1): the audio.cpp engine uses one process per task, not going through the Model Worker.
  const music = new LocalMusicProvider({
    catalog,
    engine: musicEngine,
    env: options.env,
    backend: process.env[AUDIO_CPP_BACKEND_ENV] || null,
    log,
  });
  const store = await ModelServiceStore.open(home, options.credentials, undefined, { log: options.log.child('model-services') });
  // Usage ledger (§6.10): one entry for each real call to an online or agent Provider.
  const usageLog = options.log.child('usage');
  const usage = new UsageLedger(home.usageFile, { warn: (message, data) => usageLog.warn(message, data) });
  const online = new OnlineProviderSource({ ...options.online, store, ffmpeg: options.ffmpeg, usage });
  const services = new ModelServices({
    store,
    usage,
    sources: [
      new LocalProviderSource({
        catalog,
        transcriber: provider,
        speech: provider.speechGenerator(),
        image: provider.imageGenerator(),
        music,
      }),
      ...(options.remote ? [options.remote] : []),
      online,
      ...(options.agents ? [new AgentProviderSource({ ...options.agentProviders, store, drivers: options.agents, usage })] : []),
    ],
  });
  // The authorization ledger opens before the task ledger: when the task ledger reconciles, it must settle reservations left unfinished last time.
  const grants = await GrantService.open({ file: home.grantsFile, services, log: options.log });
  const guard = taskGuard(grants, options.taskProtections);
  const jobs = new JobManager({
    paths: {
      jobsFile: home.jobsFile,
      stagingDir: home.stagingDir,
      artifactsDir: home.artifactsDir,
      diagnosticsDir: path.join(home.logsDir, 'diagnostics'),
    },
    catalog,
    router: services,
    videos: videoAdapter(videos, guard),
    log,
    probe: ffprobeMediaProbe(options.ffprobe),
    ...(options.library ? { library: options.library } : {}),
    ...(options.faults ? { faults: options.faults } : {}),
    admission: grants,
    resources,
  });
  grants.attachJobs(
    () => jobs.snapshot().jobs,
    (jobId) => {
      try {
        return jobs.inspect(jobId);
      } catch {
        return null;
      }
    },
  );
  await jobs.open();
  const targets = options.pipelineTargets ? pipelineTargets(videos, options.pipelineTargets) : null;
  const transcriber = pipelineTranscriber(jobs, services);
  const speechWorker = options.speechWorker ?? (() => resolveSpeechWorkerCommand(null));
  const pipelines = new PipelineRunner({
    jobs,
    stagingDir: home.stagingDir,
    log,
    ...(targets ? { targets } : {}),
    // Library entries used by the flow (the translation glossary) are pinned by the parent task until the flow ends (§5.9).
    ...(options.library ? { library: options.library } : {}),
    definitions: [
      transcodePipeline({
        ffmpeg: options.ffmpeg,
        ffprobe: options.ffprobe,
        ...(options.saveDirectory ? { saveDirectory: options.saveDirectory } : {}),
      }),
      // Sentence-by-sentence translation hands the transcript to a text model: each call goes through authorization and budget (§12.5).
      withPipelineGrants(
        translatePipeline({
          videos: pipelineVideos(videos, guard),
          text: grantedTextGenerator(services.textGenerator(), grants, services, TRANSLATE_DATA_KINDS),
          selectText: (target) => services.selectText(target),
          speechWorker,
          ...(options.library ? { library: options.library } : {}),
          artifacts: jobs.artifacts,
        }),
        grants,
        TRANSLATE_DATA_KINDS,
      ),
      // Subtitle file translation: there is no video, so the subtitle text is sent out as `transcript`; authorization and budget apply as above.
      withPipelineGrants(
        translateSubtitlesPipeline({
          text: grantedTextGenerator(services.textGenerator(), grants, services, TRANSLATE_DATA_KINDS),
          selectText: (target) => services.selectText(target),
          ...(options.library ? { library: options.library } : {}),
          artifacts: jobs.artifacts,
          ...(options.saveDirectory ? { saveDirectory: options.saveDirectory } : {}),
        }),
        grants,
        TRANSLATE_DATA_KINDS,
      ),
      // Translated dubbing: the translation (when the translation is missing) and the per-sentence synthesis each go through authorization and budget; both kinds of outgoing data are checked before start. When rejected, the next-step guidance for dubbing is included.
      withDubGrantGuidance(
        withPipelineGrants(
          dubPipeline({
            videos: dubVideos(videos, guard),
            translation: {
              text: grantedTextGenerator(services.textGenerator(), grants, services, TRANSLATE_DATA_KINDS),
              selectText: (target) => services.selectText(target),
              speechWorker,
              ...(options.library ? { library: options.library } : {}),
              artifacts: jobs.artifacts,
            },
            speech: dubSpeech({ services, grants, library: options.library }),
            // Vocal and background separation (`separateAudio`): at start, the local separation model bundle is chosen by default (the factory default when none is set, §6.2), and the frozen one is used at execution;
            // if none is available, the separation step is skipped when requested.
            separator: async (model) => {
              let choice;
              try {
                choice = await services.selectSeparate(model ? { provider: model.providerId, model: model.modelId } : {});
              } catch (error) {
                if (error instanceof RpcError) return null;
                throw error;
              }
              if (choice.providerId !== 'local') return null;
              const bundleId = choice.modelId;
              const workerWeightBytes = await catalog.workerWeightBytes(bundleId);
              return localDubSeparator({ provider, bundleId, workerWeightBytes, ffmpeg: options.ffmpeg, ffprobe: options.ffprobe });
            },
            ffmpeg: options.ffmpeg,
            ffprobe: options.ffprobe,
          }),
          grants,
          DUB_DATA_KINDS,
          (plan) => dubOutbound(plan.params),
        ),
      ),
      // Transcription: the transcription Job itself writes the transcript into the video, and the flow then creates the subtitle layer. When the transcription subtask is submitted, authorization is checked and reserved as usual; here it is checked before start,
      // and when authorization is missing, no video is created and nothing is imported; the rejection shown to a present user includes a pending approval item (§7.9).
      withPipelineGrants(
        transcribePipeline({
          videos: pipelineVideos(videos, guard),
          transcriber,
          ...(options.saveDirectory ? { saveDirectory: options.saveDirectory } : {}),
          ...(targets ? { targets } : {}),
          ...(options.enabledGlossaries ? { enabledGlossaries: async (videoId: Id) => (await options.enabledGlossaries!(videoId, 'transcribe')).ids } : {}),
          sources: transcribeSources(videos),
        }),
        grants,
        TRANSCRIBE_DATA_KINDS,
        (plan) => [{ capability: 'transcribe', providerId: plan.providerId, modelId: plan.modelId, dataKinds: TRANSCRIBE_DATA_KINDS }],
      ),
      // Speaker identification: the local “说话人区分” (speaker diarization) model bundle re-diarizes speakers for an existing transcript; the result is a proposal (applied via `edits.applySpeakers`). No data is sent out,
      // and no authorization is needed.
      speakersPipeline({
        videos: dubVideos(videos, guard),
        pack: async () => (await catalog.list()).find((bundle) => bundle.capability === 'diarize') ?? null,
        footprint: (bundleId) => catalog.workerFootprint(bundleId),
        diarizer: provider,
      }),
      ...(options.extraPipelines?.({
        grants,
        jobs,
        videos: pipelineVideos(videos, guard),
        transcriber,
        services,
        targets,
        ...(options.enabledGlossaries
          ? { enabledGlossaries: async (videoId: Id) => (await options.enabledGlossaries!(videoId, 'transcribe')).ids }
          : {}),
      }) ?? []),
    ],
  });
  await pipelines.open();
  grants.settleOrphans();
  const topic = new TopicLog<JobsSnapshot, JobsEvent>(() => jobs.snapshot(), '0');
  jobs.onChange((job) => topic.publish({ type: 'job.updated', job }));
  jobs.onSegments(({ jobId, from, segments }) => topic.publish({ type: 'job.segments', jobId, from, segments }));
  await services.refresh();
  // Default authorizations for enabled Providers (the migration rule in §6.8); reconciled again when configuration later changes.
  grants.reconcile();
  services.onChange(() => grants.reconcile());
  // Model bundle state snapshot: after the model catalog reports a change, the new state is read once (serialized in the order of changes), swapped into the snapshot, and `bundle.updated` is emitted.
  const bundles = new Map((await catalog.list()).map((b) => [b.bundleId, b]));
  const modelsTopic = new TopicLog<ModelsSnapshot, ModelsEvent>(
    () => ({ capabilities: services.view(), bundles: [...bundles.values()] }),
    '0',
  );
  services.onChange((capabilities) => modelsTopic.publish({ type: 'capabilities.updated', capabilities }));
  const pendingBundles = new Set<string>();
  let bundleChain = Promise.resolve();
  catalog.onChange((bundleId) => {
    if (pendingBundles.has(bundleId)) return;
    pendingBundles.add(bundleId);
    bundleChain = bundleChain.then(async () => {
      pendingBundles.delete(bundleId);
      const status = await catalog.status(bundleId).catch(() => null);
      if (!status) return;
      bundles.set(bundleId, status);
      modelsTopic.publish({ type: 'bundle.updated', bundle: status });
    });
  });
  const installs = new ModelInstallService({
    catalog,
    provider,
    music,
    jobs,
    log,
    settings: options.installSettings ?? (() => ({ downloadEndpoint: null, offlineStrict: false })),
    toolsEndpoint: options.toolsEndpoint ?? (() => toolsDownloadEndpoint(toolOverrides, null)),
    // After the engine component is published, runs `--version` once to confirm it runs and is recognized as audio.cpp.
    probeExecutable: async (executable) => {
      const outcome = await runVersionProbe(executable, ['--version'], await options.env());
      if (!outcome.ok) throw new Error(outcome.reason.text);
      if (parseAudioCppVersion(outcome.output) === null) throw new Error(RcExternalTools.noVersion().text);
    },
    ...modelInstall,
    refresh: () => void services.refresh().catch(() => {}),
    clearDefaults: (bundleId) => services.clearLocalDefaults(bundleId),
  });
  const dir = new ModelsDirService({
    defaultDir: defaultModelsDir,
    envDir: envModelsDir,
    setting: dirSetting,
    catalog,
    provider,
    jobs,
    log,
    ...(modelInstall.installer?.freeBytes ? { freeBytes: modelInstall.installer.freeBytes } : {}),
    ...(options.modelsDirTesting ? { testing: options.modelsDirTesting } : {}),
    refresh: () => void services.refresh().catch(() => {}),
  });
  await dir.recover();
  // A task failure may disable the model bundle (repeated crashes): recompute the view.
  jobs.onChange((job) => {
    if (job.state === 'failed') void services.refresh().catch(() => {});
  });
  // The parts of the recovery matrix that wait for Providers and authorization to be ready (§7.5): re-queueing and redoing apply. Done in the background so startup is not held up;
  // reservations must be created after `settleOrphans` (otherwise they would be settled as orphans).
  void jobs.recover().catch((error: unknown) => log.error('Recovering tasks failed', { error: String(error) }));
  const voiceCloner = (providerId: string) => online.voiceCloner(providerId);
  const flushUsage = async () => {
    await usage.flush();
    await store.flush();
  };
  return { catalog, provider, services, jobs, pipelines, topic, modelsTopic, installs, dir, grants, voiceCloner, flushUsage };
}

/**
 * Writes made within a task (§3.2): when this execution (`run`, the Job itself or the flow's parent task) finds its agent task through the submitter, it carries the task and the contract's protection scope over this video;
 * the engine checks protection for non-user writes that carry a taskId. Writes without `run` (the user's `jobs.reconcile apply`) are the user's decision and carry none.
 */
type TaskGuard = (videoId: Id, run: EngineRun | undefined) => Promise<{ taskId?: Id; protections?: EngineProtection[] }>;

function taskGuard(grants: GrantService, protections: ModelJobsOptions['taskProtections']): TaskGuard {
  return async (videoId, run) => {
    const taskId = run ? grants.taskOfJob(run.runId) : null;
    if (!taskId) return {};
    return { taskId, protections: (await protections?.(taskId, videoId)) ?? [] };
  };
}

function videoAdapter(videos: VideoService, guard: TaskGuard): JobVideos {
  return {
    retain: (videoId) => videos.retain(videoId),
    release: (videoId) => videos.release(videoId),
    async source(videoId, assetId, revision) {
      const { root, file, record } = await videos.mediaSource(videoId, assetId, revision);
      return { file: path.resolve(root, file), revision: record.revision, contentHash: record.contentHash, mediaType: record.mediaType };
    },
    current(videoId, assetId) {
      const mirror = videos.mirror(videoId);
      if (!mirror) return null;
      const asset = mirror.video.assets[assetId];
      const record = asset?.revisions[asset.currentRevision];
      return {
        videoRevision: mirror.video.revision,
        asset: record ? { revision: record.revision, contentHash: record.contentHash } : null,
      };
    },
    videoRevision(videoId) {
      return videos.mirror(videoId)?.video.revision ?? null;
    },
    async apply(videoId, { run, ...request }) {
      const { receipt } = await videos.applyAs({ videoId, ...request }, JOBS_ACTOR, {
        ...(run ? { run } : {}),
        ...(await guard(videoId, run)),
      });
      return { refs: receipt.refs ?? {}, transactionId: receipt.transactionId, videoRevision: receipt.videoRevision };
    },
    invalidateRun: (videoId, run) => videos.invalidateRun(videoId, run),
    place: (videoId) => videoPlace(videos, videoId),
    async reopen(videoId, place) {
      const location = placeLocation(place);
      if (!location) return 'missing';
      const principal = recoveryPrincipal();
      const opened = await videos.open(location, principal).catch((error: unknown) => {
        // The directory is gone, is no longer a video, or has left the source directory: the target no longer exists. Other errors (locked, engine unavailable) are thrown as usual.
        if (error instanceof RpcError && (error.code === 'not-found' || error.code === 'forbidden')) return null;
        throw error;
      });
      if (!opened) return 'missing';
      if (opened.ref.videoId !== videoId) {
        await videos.close(opened.ref.videoId, principal);
        return 'mismatch';
      }
      // Replaced with a Runtime lease: the opener used for recovery leaves right away, and the lease keeps the video open.
      videos.retain(videoId);
      await videos.close(videoId, principal);
      return 'opened';
    },
    async receipt(videoId, commandId) {
      const receipt = await videos.receiptFor(videoId, commandId);
      return receipt ? { transactionId: receipt.transactionId, videoRevision: receipt.videoRevision, refs: receipt.refs ?? {} } : null;
    },
    state(videoId) {
      const video = videos.mirror(videoId)?.video;
      return video ? { revision: video.revision, documents: video.documents } : null;
    },
    async document(videoId, documentId, revision) {
      const content = await videos.document(videoId, documentId, revision);
      return { revision: content.revision, body: content.body };
    },
  };
}

/** Source video facts needed by the transcription destination `new-video`: its name, the project or session it is in, and the asset's current version file. */
function transcribeSources(videos: VideoService): NonNullable<TranscribeDeps['sources']> {
  return {
    video(videoId) {
      const video = videos.mirror(videoId)?.video;
      const place = videoPlace(videos, videoId);
      if (!video || !place) return null;
      const scope = place.scope as { projectId?: Id; conversationId?: Id };
      if (scope.projectId) return { name: video.name, scope: { projectId: scope.projectId } };
      if (scope.conversationId) return { name: video.name, scope: { conversationId: scope.conversationId } };
      return null;
    },
    async assetFile(videoId, assetId) {
      try {
        const { root, file } = await videos.mediaSource(videoId, assetId);
        return path.resolve(root, file);
      } catch {
        return null;
      }
    },
  };
}

/** The subject used to open the video when redoing apply after restart (used only at the moment of opening, then replaced with a lease). The name is in the current language. */
function recoveryPrincipal(): TrustedPrincipal {
  return { connectionId: 'system:jobs-recovery', kind: 'cli', name: RcModels.recoveryPrincipalName().text };
}

/** Capability for a fixed flow to read and write a video: the writing actor is `system:pipeline`; like transcription, it goes through Application and is version-checked; flows started by an agent carry the task's protection. */
function pipelineVideos(videos: VideoService, guard: TaskGuard): PipelineVideos & CaptionVideos & MediaVideos {
  return {
    state(videoId) {
      const video = videos.mirror(videoId)?.video;
      return video ? { revision: video.revision, rootSequenceId: video.rootSequenceId, documents: video.documents } : null;
    },
    rootSequence(videoId) {
      const video = videos.mirror(videoId)?.video;
      return video?.sequences[video.rootSequenceId] ?? null;
    },
    async receipt(videoId, commandId) {
      const receipt = await videos.receiptFor(videoId, commandId);
      return receipt ? { refs: receipt.refs ?? {} } : null;
    },
    async document(videoId, documentId, revision) {
      const content = await videos.document(videoId, documentId, revision);
      return { revision: content.revision, body: content.body };
    },
    asset(videoId, assetId) {
      const asset = videos.mirror(videoId)?.video.assets[assetId];
      const record = asset?.revisions[asset.currentRevision];
      if (!record) return null;
      return {
        contentHash: record.contentHash,
        ...(record.duration ? { duration: record.duration } : {}),
        ...(record.audio ? { sampleRate: record.audio.sampleRate } : {}),
      };
    },
    async apply(videoId, { run, ...request }) {
      const { receipt } = await videos.applyAs({ videoId, ...request }, PIPELINE_ACTOR, {
        ...(run ? { run } : {}),
        ...(await guard(videoId, run)),
      });
      return { refs: receipt.refs, transactionId: receipt.transactionId };
    },
  };
}

/** Transcription within a flow: selects the Provider and model, submits a `transcribe` Job (the submitter is the parent task), and handles waiting and cancellation. */
function pipelineTranscriber(jobs: JobManager, services: ModelServices): PipelineTranscriber {
  return {
    check: async (target) => {
      const selection = await services.selectTranscribe(target ?? {});
      return { providerId: selection.providerId, modelId: selection.modelId };
    },
    submit: (request, submitter) => jobs.submitTranscribe(request, submitter),
    submitFile: ({ language, ...request }, submitter) =>
      jobs.submitTranscribeWithoutVideo(
        { ...request, ...(language !== undefined ? { language: { mode: 'assert', tag: language } } : {}) },
        submitter,
      ),
    settled: (jobId) => jobs.settled(jobId),
    cancel: (jobId) => jobs.cancel(jobId),
    inspect: (jobId) => jobs.inspect(jobId),
    list: () => jobs.list(),
  };
}

/** Outgoing data to check before translated dubbing starts: per-sentence synthesis, plus translation when the translation is missing. */
function dubOutbound(params: FrozenDubParams) {
  return [
    {
      capability: 'synthesizeSpeech' as const,
      providerId: params.voice.providerId,
      modelId: params.voice.modelId,
      dataKinds: DUB_DATA_KINDS,
    },
    ...(params.translationId === null
      ? [
          {
            capability: 'generateText' as const,
            providerId: params.translate.provider,
            modelId: params.translate.model,
            dataKinds: TRANSLATE_DATA_KINDS,
          },
        ]
      : []),
  ];
}

/** Dubbing reads and writes the video: on top of translation, it reads the sequence's instances, the transcript's position on the timeline (the engine's text plan), and the asset's source file. */
function dubVideos(videos: VideoService, guard: TaskGuard): DubVideos {
  return {
    ...pipelineVideos(videos, guard),
    sequence(videoId, sequenceId) {
      const sequence = videos.mirror(videoId)?.video.sequences[sequenceId];
      return sequence ? { fps: sequence.fps, items: sequence.items } : null;
    },
    async speechOnTimeline(videoId, sequenceId, documentId) {
      const plan = await videos.exportPlan<TextPlanResult>(videoId, {
        kind: 'text',
        sequenceId,
        ranges: [],
        documentIds: [documentId],
        scopeItemIds: [],
      });
      const part = plan.parts[0]?.plans[0];
      if (!part) return { videoRevision: plan.videoRevision, end: 0, words: [] };
      const offset = part.range.startSeconds;
      return {
        videoRevision: plan.videoRevision,
        end: part.range.endSeconds,
        words: part.entries.map((e) => ({ wordId: e.id, itemId: e.scopeItemId ?? null, start: offset + e.start, end: offset + e.end })),
      };
    },
    async assetFile(videoId, assetId) {
      try {
        const { root, file, record } = await videos.mediaSource(videoId, assetId);
        return { file: path.resolve(root, file), revision: record.revision };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Finds the audio.cpp engine (`audiocpp_cli`, Model Worker protocol spec §4.4): if `CUCCUT_AUDIOCPP_CLI` is set, only it is used (not found if the file is missing); otherwise it is the engine component installed with the model bundle (`installed`, i.e. `ModelCatalog.engineExecutable`: `<Runtime Home>/tools/audiocpp/<version>/`); finally it looks on PATH.
 * It only checks whether the file exists; it does not run it.
 */
export function resolveAudioCppCli(env: NodeJS.ProcessEnv, installed: () => string | null = () => null): string | null {
  const explicit = env[AUDIO_CPP_CLI_ENV];
  if (explicit) return isExecutableFile(explicit) ? explicit : null;
  const component = installed();
  if (component) return component;
  const exe = process.platform === 'win32' ? `${AUDIO_CPP_ENGINE}.exe` : AUDIO_CPP_ENGINE;
  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, exe);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function isExecutableFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ClaudeDriver,
  CodexDriver,
  OpenCodeDriver,
  PiDriver,
  acpDrivers,
  createCustomAcpDriver,
  resolveLoginShellPath,
} from '@cuccut/agent-drivers';
import { DriverRegistry, Harness, engineProtections, type AgentDriver, type Logger } from '@cuccut/harness';
import {
  BUILTIN_DRIVER_IDS,
  PROTOCOL_VERSION,
  RUNTIME_VERSION,
  RpcError,
  customAgentProviderView,
  newId,
  nowIso,
  type CustomAgentProvider,
  type Id,
  type RuntimeDiscovery,
  type RuntimeInfo,
  type RuntimeLauncher,
} from '@cuccut/protocol';
import type { CapacitySource, JobManager } from '@cuccut/jobs';
import {
  AgentPrefsStore,
  AgentProbeStore,
  AgentProviderStore,
  SkillPrefsStore,
  PackChoicesStore,
  ConversationStore,
  ProjectStore,
  SpaceArtifactStore,
  SpaceMarkStore,
  ReviewCriteriaStore,
  acquireInstanceLock,
  readDiscovery,
  releaseInstanceLock,
  removeDiscovery,
  resolveRuntimeHome,
  writeDiscovery,
  type RuntimeHome,
} from '@cuccut/runtime-storage';
import { AgentSetup, type AgentSetupOptions } from './agent-setup.ts';
import { AgentGrants } from './agent-tools/grants.ts';
import { loadAgentGuidance } from './agent-tools/guidance.ts';
import { TaskTools } from './agent-tools/task-tools.ts';
import { openCredentialStore, type CredentialStoreOptions } from './credentials.ts';
import { McpEndpoint } from './agent-tools/mcp-endpoint.ts';
import { AgentScope } from './agent-tools/agent-scope.ts';
import { LocalScope } from './agent-tools/local-scope.ts';
import { ScopeRouter } from './agent-tools/tool-scope.ts';
import { ModelTools } from './agent-tools/model-tools.ts';
import { GrantTools } from './agent-tools/grant-tools.ts';
import { ToolCatalog, type ToolSet } from './agent-tools/tool-catalog.ts';
import type { ToolScope } from './agent-tools/tool-scope.ts';
import { VideoTools } from './agent-tools/video-tools.ts';
import { Gateway, originAllowed } from './gateway.ts';
import { createHandlers } from './handlers.ts';
import { createFileLogger } from './logger.ts';
import { StorageGc } from './storage-gc.ts';
import { AttachmentStore } from './attachments.ts';
import { MediaRegistry } from './media.ts';
import { SlidesService } from './slides.ts';
import { SlidesTools } from './agent-tools/slides-tools.ts';
import { DesignTools } from './agent-tools/design-tools.ts';
import { DesignSystemTools } from './agent-tools/design-system-tools.ts';
import { MediaAnalysis } from './media-analysis.ts';
import { createFaceDetector } from './face-detection.ts';
import { LibraryService } from './library/library-service.ts';
import { VoiceCloneService } from './library/voice-clone-service.ts';
import { openModelJobs, type ModelJobs, type ModelJobsOptions } from './models/model-jobs.ts';
import { ModelInstallTools } from './agent-tools/model-install-tools.ts';
import { ExportService } from './exports/export-service.ts';
import { FontService } from './fonts/font-service.ts';
import type { FontCatalogue } from './fonts/font-catalogue.ts';
import type { FontDownloadOptions } from './fonts/font-download.ts';
import { sweepLeftovers } from './exports/leftover-files.ts';
import { resolveExportWorkerCommand } from './exports/video-export.ts';
import { ExportTools } from './agent-tools/export-tools.ts';
import { ReviewTools } from './agent-tools/review-tools.ts';
import { ReviewService } from './review/review-service.ts';
import { SpaceTools } from './agent-tools/space-tools.ts';
import { VideoDeleteTools } from './agent-tools/video-delete-tools.ts';
import { VideoTrash } from './videos/video-trash.ts';
import { locateFileTarget } from './handlers.ts';
import { resolveModelWorkerCommand, type ModelWorkerCommand } from './models/model-worker.ts';
import { resolveEngineHostCommand } from './videos/engine-host.ts';
import { VideoService } from './videos/video-service.ts';
import { PackageImporter } from './videos/package-import.ts';
import { spaceDerivedFinder } from './videos/video-derive.ts';
import { openNodeInitiator, type NodeInitiatorRuntimeOptions } from './nodes/node-initiator.ts';
import { openNodeShare, type NodeShareOptions } from './nodes/node-share.ts';
import { NodeProviderSource, type NodeInitiator, type NodeService } from '@cuccut/nodes';
import type { AgentSourceOptions, OnlineSourceOptions } from '@cuccut/providers';
import { SpaceCatalog } from './space-catalog.ts';
import { ContentIndex } from './space/content-index.ts';
import { SpaceThumbnails } from './space/space-thumbnails.ts';
import { openSettings, type RuntimeSettings } from './settings-topic.ts';
import { openServices, type RuntimeServices, type ServicesOptions } from './services/open-services.ts';
import { FileLinkSources, isTerminal, resolveSpeechWorkerCommand, type HostLookup } from '@cuccut/jobs';
import { LegacyUpgrade } from './legacy-upgrade.ts';
import { RuntimeActivity, type IdleExitOptions } from './runtime-activity.ts';
import { ExternalToolService, toolsDownloadEndpoint, type ExternalToolServiceOptions } from './external-tools/external-tool-service.ts';
import { linkImportDefinition, pruneLinkSources } from './external-tools/link-import-wiring.ts';
import { resolveDownloadsDirectory, resolveSaveDirectory } from './external-tools/downloads-directory.ts';
import { entryPlace } from './videos/pipeline-targets.ts';
import { FlowTools } from './agent-tools/flow-tools.ts';
import { LinkImportTools } from './agent-tools/link-import-tools.ts';
import { DownloadTools } from './agent-tools/download-tools.ts';
import { TemplateCatalog, resolveBuiltinTemplatesDir } from './templates/template-catalog.ts';
import { SkillCatalog, resolveBuiltinSkillsDir } from './skills/skill-catalog.ts';
import { SkillInstaller } from './skills/skill-installer.ts';
import { PackRegistry } from './packs/pack-registry.ts';
import { PackPreviews } from './packs/pack-previews.ts';
import { PackInstaller, type PackLibrary } from './packs/pack-installer.ts';
import { PackStyle } from './packs/pack-style.ts';
import { ffmpegStillMaker, PackExamples } from './packs/pack-examples.ts';
import { PackExporter } from './packs/pack-export.ts';
import { skillIndexBlock } from './skills/skill-brief.ts';
import { ProfileService } from './profile/profile-service.ts';
import { joinBlocks } from './profile/profile-brief.ts';
import { pickWriterAgent } from './profile/profile-writer.ts';
import { ProfileTools, profileProjectOf } from './agent-tools/profile-tools.ts';
import { aiToolDefinition } from './ai-tools/ai-tool-wiring.ts';
import { resolveBuiltinAgentSkillsDir } from './skills/agent-skill-renderer.ts';
import { SkillTools } from './agent-tools/skill-tools.ts';
import { PackTools } from './agent-tools/pack-tools.ts';
import { JobTools } from './agent-tools/job-tools.ts';
import { ProjectTools } from './agent-tools/project-tools.ts';
import { LibraryTools } from './agent-tools/library-tools.ts';
import { CompositionTools } from './agent-tools/composition-tools.ts';
import { CompositionService, SharedCompositionHost } from './compositions/composition-service.ts';
import { findOnPath } from './external-tools/tool-probe.ts';
import { resolveElectronBinary } from '@cuccut/code-runtime';
import type { GithubFetchOptions } from './skills/skill-github.ts';
import { RcAiTools, RcRuntime } from '@cuccut/protocol/messages/runtime-core';

export interface StartRuntimeOptions {
  home?: RuntimeHome;
  host?: string;
  port?: number;
  allowedOrigins?: readonly string[];
  /** Also logs to stderr. */
  echoLogs?: boolean;
  /** For tests: replaces the built-in Driver. */
  drivers?: (log: Logger) => AgentDriver[];
  /** For tests: replaces the Driver factory for user-added ACP agents (`agents.addProvider`). Default `createCustomAcpDriver`. */
  customDriver?: (provider: CustomAgentProvider, log: Logger) => AgentDriver;
  /** Watches the source directory for changes (on by default). Tests turn it off and use `space.rescan()` instead. */
  watchSpace?: boolean;
  /** The video engine executable. Defaults to `CUCCUT_ENGINE_HOST`, or the `engine-host` built in the repo. */
  engineHost?: string | null;
  /** How long after a connection drops before the videos it opened are closed (default 15 seconds). */
  videoGraceMs?: number;
  /** The Model Worker command. Defaults to `CUCCUT_MODEL_WORKER`, or the `model-worker` built in the repo; null means local inference is unavailable. */
  modelWorker?: ModelWorkerCommand | null;
  /** How long a model stays idle before it is unloaded (default 10 minutes). */
  jobIdleMs?: number;
  /** Machine capacity used for resource scheduling (a fake capacity is injected in tests). When not given, it is probed on this machine; the preference `resources.capacity` can override it. */
  capacity?: CapacitySource;
  /** The node side of LAN capability sharing (architecture design §6.7). Tests use loopback, a fake mDNS, and short deadlines. */
  nodes?: NodeShareOptions;
  /** The initiator side of LAN capability sharing: discovery and the deadline for remote jobs. Tests use a fake discovery and short deadlines. */
  initiator?: NodeInitiatorRuntimeOptions;
  /** Tuning for online providers. Tests point the built-in providers' base URLs at local fake services and shorten the backoff. It never reads any key from the environment. */
  online?: Omit<OnlineSourceOptions, 'store' | 'ffmpeg'>;
  /** Tuning for agent providers (§6.9). Tests shorten the probe cache and the deadline for one generation. */
  agentProviders?: Omit<AgentSourceOptions, 'store' | 'drivers'>;
  /** Deadline of the profile writer's agent turn (default 3 minutes; docs/cuccut/m2-profile-rules.md §4). Tests shorten it. */
  profileWriterTimeoutMs?: number;
  /**
   * Credential store (§6.8): decided by the build type, not by a user setting. Development builds use `file` (the default), release builds use `keychain`. Tests can pass an instance directly, or give the keychain backend a fake helper (`credentialHelper`).
   */
  credentials?: CredentialStoreOptions['kind'];
  /** Helper command for the keychain backend. Defaults to `CUCCUT_CREDENTIAL_HELPER`, the packaged resources directory, or the `credential-helper` built in the repo. */
  credentialHelper?: CredentialStoreOptions['helper'];
  /** Tuning for external services (§4.8). Tests shorten the approval deadline for services. */
  services?: ServicesOptions;
  /** Tuning for model installs (§6.3). Tests point the download source at a local fake service, inject free space, a built-in manifest, and a self-test sample. No real network access. */
  modelInstall?: ModelJobsOptions['modelInstall'];
  /** For tests: stalls or interrupts a model directory move, or pretends the move crosses disks. */
  modelsDirTesting?: ModelJobsOptions['modelsDirTesting'];
  /**
   * Tuning for managed external tools (§12.9) and for importing from links (§7.9). Tests give a search path that holds only fake tools (so the system's real yt-dlp is never touched), overrides not drawn from real environment variables, a fake manifest with known digests and a local download source, and hostname resolution that does not hit real DNS.
   */
  externalTools?: Pick<ExternalToolServiceOptions, 'env' | 'overrides' | 'manifests' | 'platform' | 'download'> & { lookup?: HostLookup };
  /** Fault injection for tasks (for tests, architecture design §7.3): simulates crashes at several points in the task's closed loop. */
  jobFaults?: ModelJobsOptions['faults'];
  /** The agent's install action (§12.9). Tests replace how the system terminal is opened and the environment in which commands run. */
  agentSetup?: Pick<AgentSetupOptions, 'env' | 'openTerminal' | 'flushMs'>;
  /**
   * Directory of built-in creation templates (template package spec §6). Defaults to `CUCCUT_TEMPLATES_DIR`, the packaged resources directory, or `templates/` at the repo root. null means there are no built-in templates.
   * User templates always live in `<home>/templates`.
   */
  templatesDir?: string | null;
  /**
   * Directory of built-in agent skills (architecture design §3.8). Defaults to `CUCCUT_SKILLS_DIR`, the packaged resources directory, or `skills/cuccut/built-in-skills/` at the repo root.
   * null means there are none.
   * User-added and imported skills always live in `<home>/skills`.
   */
  skillsDir?: string | null;
  /**
   * Root directory of the manuals (it contains `cuccut/`; Agent surface design §8.6). The in-session agent's guidance and manual pages are rendered from it for the tool-bridge surface, and `cuccut skill install` renders them for the CLI surface. Defaults to `CUCCUT_AGENT_SKILLS_DIR`, the packaged resources directory, or `skills/` at the repo root. If it is not found or cannot be rendered, Runtime startup fails.
   */
  agentSkillsDir?: string | null;
  /**
   * Build directory of the slide editor (docs/design/slides §3). Defaults to `CUCCUT_SLIDES_EDITOR_DIST`, the packaged resources directory, or the repo's `apps/slides-editor/dist`.
   * null means it has not been built: `slides.open` still returns the address, the page answers 503, and `editorAvailable` is false in the result.
   */
  slidesEditorDist?: string | null;
  /**
   * Build directory of the design canvas editor (docs/design/canvas §3). Defaults to `CUCCUT_DESIGN_EDITOR_DIST`, the packaged resources directory, or the repo's `apps/design-editor/dist`.
   * null means it has not been built: `design.open` still returns the address, the page answers 503, and `editorAvailable` is false in the result.
   */
  designEditorDist?: string | null;
  /**
   * Build directory of the design system editor (docs/design/canvas §10.2). Defaults to `CUCCUT_DESIGN_SYSTEM_EDITOR_DIST`, the packaged resources directory, or the repo's `apps/design-system-editor/dist`.
   * null means it has not been built: `designSystem.open` still returns the address, the page answers 503, and `editorAvailable` is false in the result.
   */
  designSystemEditorDist?: string | null;
  /** Importing skills from GitHub (§12.9). Tests inject a fake fetch and make no real network access. */
  skillsGithub?: GithubFetchOptions;
  /** Reading packs from GitHub and `https://` addresses (pack spec §4). Tests inject fakes and make no real network access. */
  packsSource?: { github?: GithubFetchOptions; fetch?: typeof fetch };
  /** Fonts downloaded on demand (§9.1). Tests inject a font directory holding only a few families, and point downloads at a local fake service. No real network access. */
  fonts?: { catalogue?: FontCatalogue; download?: FontDownloadOptions };
  /** Who launched this Runtime (§2.2). It is written into `RuntimeInfo` and the discovery file, and `cuccut runtime stop` uses it to stop only the ones the CLI launched. */
  launchedBy?: RuntimeLauncher | null;
  /**
   * Idle exit (§2.2, for a Runtime launched by the CLI): when there are no connections, no tasks, and no open external services for the full `runtime.idleExitMinutes` setting, calls `onIdle` (the entry point stops the Runtime there). When not given, no checks are made.
   */
  idleExit?: Omit<IdleExitOptions, 'minutes'> | null;
  /** Where `runtime.stop` goes (§2.2): the entry point stops the Runtime there. When not given, `runtime.stop` is rejected with `unsupported`. */
  requestStop?: (() => void) | null;
}

export interface RunningRuntime {
  info: RuntimeInfo;
  discovery: RuntimeDiscovery;
  harness: Harness;
  space: SpaceCatalog;
  videos: VideoService;
  models: ModelJobs;
  exports: ExportService;
  /** The user library (architecture design §5.9). */
  library: LibraryService;
  nodes: NodeService;
  /** The initiator: paired nodes and the remote node provider. */
  initiator: NodeInitiator;
  /** Preferences (architecture design §5.10). */
  settings: RuntimeSettings;
  /** External services (architecture design §4.8). */
  services: RuntimeServices;
  /** Managed external tools (architecture design §12.9). */
  externalTools: ExternalToolService;
  /** Fonts downloaded on demand (architecture design §9.1). */
  fonts: FontService;
  /** The user's profile: interview, preferences and rules (docs/cuccut/m2-profile-rules.md). */
  profile: ProfileService;
  /** The review gate before delivery (docs/cuccut/m2-review-gate.md): the standard, reviews, per-video decisions and the export gate. */
  review: ReviewService;
  log: Logger;
  close(): Promise<void>;
}

/** A live instance already exists for the same Runtime Home. The caller should connect to it instead of starting another. */
export class RuntimeAlreadyRunningError extends Error {
  readonly discovery: RuntimeDiscovery | null;
  readonly pid: number;

  constructor(pid: number, discovery: RuntimeDiscovery | null) {
    super(RcRuntime.alreadyRunning({ pid }).text);
    this.name = 'RuntimeAlreadyRunningError';
    this.pid = pid;
    this.discovery = discovery;
  }
}

/**
 * The stop order. It is not a plain reverse of the start order: external services, the node service and tasks stop first (external requests disconnect, remote jobs stop entering the queue, and in-flight jobs hand back their video leases). The gateway stops last.
 * At startup, each service registers its stop step at the matching position as soon as it is up. A normal stop (`close()`) and a failure midway through startup share this one order and run only the steps that were registered.
 * The instance lock and the log come after all the steps.
 */
/** Interval for the trash retention cleanup. */
const TRASH_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const STOP_ORDER = [
  'activity',
  'legacy-upgrade',
  'storage-gc',
  'services',
  'nodes',
  'jobs',
  'grants',
  'usage',
  'initiator',
  'discovery',
  'space',
  'slides',
  'compositions',
  'analysis',
  // Pending review results are written before the videos close (the result file lives beside the video's source).
  'review',
  'videos',
  'setup',
  'harness',
  'profile',
  'attachments',
  'gateway',
] as const;
type StopStep = (typeof STOP_ORDER)[number];

class StopSequence {
  readonly #log: Logger;
  readonly #steps = new Map<StopStep, { stop: () => unknown; failure: string | null }>();

  constructor(log: Logger) {
    this.#log = log;
  }

  /** Registers one step. `failure` is the log written if this step fails; null means silent. */
  add(step: StopStep, stop: () => unknown, failure: string | null): void {
    this.#steps.set(step, { stop, failure });
  }

  /** Runs the registered steps in stop order, each step only once. A failing step does not affect the later steps, and nothing is thrown. */
  async run(): Promise<void> {
    for (const step of STOP_ORDER) {
      const entry = this.#steps.get(step);
      if (!entry) continue;
      this.#steps.delete(step);
      try {
        await entry.stop();
      } catch (error) {
        if (entry.failure) this.#log.error(entry.failure, { error: String(error) });
      }
    }
  }
}

/**
 * Assembles and starts the Runtime (architecture design §2): instance lock → storage → Harness → Space directory → gateway → discovery file.
 * For the stop order, see `STOP_ORDER`. If startup fails midway, the services already up are stopped in the same order, then the instance lock is released and the log is closed, and the original error is thrown.
 */
export async function startRuntime(options: StartRuntimeOptions = {}): Promise<RunningRuntime> {
  const home = options.home ?? resolveRuntimeHome();
  for (const dir of [
    home.root,
    home.conversationsDir,
    home.scratchDir,
    home.logsDir,
    home.stagingDir,
    home.artifactsDir,
    home.modelsDir,
    home.libraryDir,
    home.attachmentsDir,
  ]) {
    await fs.mkdir(dir, { recursive: true });
  }

  const instanceId = newId('rt');
  const lock = await acquireInstanceLock(home, instanceId);
  if (!lock.ok) throw new RuntimeAlreadyRunningError(lock.holder.pid, await readDiscovery(home).catch(() => null));

  const log = createFileLogger({ file: path.join(home.logsDir, 'runtime.log'), echo: options.echoLogs });
  const stops = new StopSequence(log);
  // The Harness opens after the task ledger. Apps resumed after a restart need it to know the task's protection scope, so they wait for it to be ready; if startup fails, they are not left waiting forever.
  let harnessOpened!: (harness: Harness) => void;
  let harnessFailed!: (error: unknown) => void;
  const harnessReady = new Promise<Harness>((resolve, reject) => {
    harnessOpened = resolve;
    harnessFailed = reject;
  });
  harnessReady.catch(() => {});
  try {
    const legacyUpgrade = new LegacyUpgrade({ home, log });
    stops.add('legacy-upgrade', () => legacyUpgrade.stop(), 'Stopping legacy upgrade failed');
    await legacyUpgrade.prepare().catch(() => log.warn('Legacy upgrade preparation deferred'));
    const drivers = new DriverRegistry();
    // Built-in drivers are registered in the order of `BUILTIN_DRIVER_IDS` (the registration order is the order of `agents.list`).
    const builtin = () =>
      [new ClaudeDriver(log), new CodexDriver(log), new PiDriver(log), new OpenCodeDriver(log), ...acpDrivers(log)].sort(
        (a, b) => (BUILTIN_DRIVER_IDS as readonly string[]).indexOf(a.id) - (BUILTIN_DRIVER_IDS as readonly string[]).indexOf(b.id),
      );
    for (const driver of options.drivers?.(log) ?? builtin()) drivers.register(driver);
    // User-added ACP agents (§3.11) come after the built-ins, in the order they were added. They are registered before the Harness reads the probe cache, so the cache entries recognize them.
    // Additions and removals while running are handled by the Harness through the same store and factory.
    const customProviders = new AgentProviderStore(home.agentProvidersFile, { log: log.child('agent-providers') });
    const createCustomDriver = (provider: CustomAgentProvider) => (options.customDriver ?? createCustomAcpDriver)(provider, log);
    for (const provider of await customProviders.load()) {
      if (drivers.has(provider.id)) continue;
      drivers.register(createCustomDriver(provider), { custom: customAgentProviderView(provider) });
    }

    // The engine needs ffprobe, and media analysis needs ffmpeg. When the desktop app is launched from Finder, PATH does not include them, so the login shell's PATH is used.
    const toolEnv = async () => ({ ...process.env, PATH: await resolveLoginShellPath() });
    const videos = new VideoService({
      log,
      resolveCommand: () => (options.engineHost !== undefined ? options.engineHost : resolveEngineHostCommand()),
      env: toolEnv,
      graceMs: options.videoGraceMs,
      fontCacheDir: path.join(home.root, 'fonts', 'files'),
    });
    stops.add('videos', () => videos.shutdown(), 'Stopping the video engine failed');
    const media = new MediaRegistry({ log, originAllowed: (origin) => originAllowed(origin, options.allowedOrigins) });
    // Slide, design canvas and design system editors (docs/design/slides §6, docs/design/canvas §6, §10.4): shared by the gateway and the web service. One directory has one store and one directory watch.
    const slides = new SlidesService({
      log,
      editorDist: options.slidesEditorDist === undefined ? undefined : () => options.slidesEditorDist ?? null,
      designEditorDist: options.designEditorDist === undefined ? undefined : () => options.designEditorDist ?? null,
      designSystemEditorDist: options.designSystemEditorDist === undefined ? undefined : () => options.designSystemEditorDist ?? null,
    });
    stops.add('slides', () => slides.close(), null);
    // Generated audio and images, and reference recordings, are decoded and checked with ffprobe (the same ffprobe as the engine). WebM playback also uses it to probe the codec.
    const ffprobe = async () => ({ command: process.env.CUCCUT_FFPROBE || 'ffprobe', env: await toolEnv() });
    const analysis = new MediaAnalysis({
      cacheDir: path.join(home.cacheDir, 'media'),
      log,
      ffmpeg: async () => ({ command: process.env.CUCCUT_FFMPEG || 'ffmpeg', env: await toolEnv() }),
      ffprobe,
    });
    stops.add('analysis', () => analysis.close(), 'Stopping media analysis failed');
    // Faces are marked when frames are taken (`faces` in `videos_frames`). Each call spawns a `face-detect` process; if it is missing, no marks are added.
    const faces = createFaceDetector({ log });
    const modelWorker = options.modelWorker !== undefined ? options.modelWorker : resolveModelWorkerCommand();
    // Online provider keys and node tokens share one credential store. The keychain backend migrates keys left over in the plaintext file here.
    const credentials = await openCredentialStore(home, log, {
      ...(options.credentials !== undefined ? { kind: options.credentials } : {}),
      ...(options.credentialHelper !== undefined ? { helper: options.credentialHelper } : {}),
    });
    // The initiator comes before the JobManager, because the remote node provider is one of the JobManager's providers.
    const initiator = await openNodeInitiator(home, credentials, log, options.initiator);
    stops.add('initiator', () => initiator.close(), 'Stopping the node initiator failed');
    // The user library comes before the JobManager: the transcription glossary and the synthesized library voices are frozen and fixed by the task. Artifact sources only exist after the job library is built.
    let artifacts: { locate(artifactId: string): Promise<string | null> } | null = null;
    const library = await LibraryService.open({
      dir: home.libraryDir,
      videos,
      media,
      artifacts: { locate: (artifactId) => artifacts?.locate(artifactId) ?? Promise.resolve(null) },
      ffprobe,
    });
    // New videos adopt the entries enabled by default in the user library (§5.9).
    videos.onCreated((videoId, principal) => library.adoptDefaults(videoId, principal));
    // Preferences are read in before the model tasks: the model directory (`models.dir`, §6.3) determines the root of the model directory.
    const settings = await openSettings(home, log);
    let settingsStore: RuntimeSettings['store'] | null = settings.store;
    // Import from links (§7.9) is registered when the JobManager is built. The external tool service and the Harness come later, so flows fetch them when they need them.
    let externalToolsRef: ExternalToolService | null = null;
    // The skill directory, attachments and export service used by the AI tool's “call the model directly” flow are built in later steps, so they are fetched at call time.
    let aiToolRefs: { skills: SkillCatalog; attachments: AttachmentStore; exports: ExportService } | null = null;
    const aiToolRef = () => {
      if (!aiToolRefs) throw new RpcError('busy', RcAiTools.notReady());
      return aiToolRefs;
    };
    let harnessRef: Harness | null = null;
    // A flow's `{ entryId }` target is resolved against the Space directory (§7.9). Space is built later, so it is fetched at resolution time.
    let spaceRef: SpaceCatalog | null = null;
    const linkSources = new FileLinkSources(path.join(home.root, 'store', 'link-sources.json'));
    const toolOverrides = options.externalTools?.overrides ?? process.env;
    const requireHarness = () => {
      if (!harnessRef) throw new Error(RcRuntime.harnessNotReady().text);
      return harnessRef;
    };
    const projectRoot = (projectId: Id) => {
      const project = requireHarness()
        .listProjects()
        .find((p) => p.id === projectId);
      if (!project) throw new RpcError('not-found', RcRuntime.projectNotFound());
      return project.path;
    };
    // The session's source (placed the same way as the agent's `videos_create`, AgentScope.source): when the session is in a project, the project directory and project scope; otherwise the working directory.
    const conversationSource = (conversationId: Id): { root: string; scope: { projectId: Id } | { conversationId: Id } } => {
      const { conversation } = requireHarness().getConversation(conversationId);
      if (conversation.projectId) {
        const project = requireHarness()
          .listProjects()
          .find((p) => p.id === conversation.projectId);
        if (project) return { root: project.path, scope: { projectId: project.id } };
      }
      return { root: conversation.cwd, scope: { conversationId: conversation.folderOf ?? conversation.id } };
    };
    const conversationRoot = (conversationId: Id) => conversationSource(conversationId).root;
    const models = await openModelJobs({
      home,
      credentials,
      videos,
      log,
      worker: () => modelWorker,
      // The subtitle and translation core's Speech Worker comes from the same cargo build as the engine host, and sits next to it.
      speechWorker: () => resolveSpeechWorkerCommand(options.engineHost !== undefined ? options.engineHost : resolveEngineHostCommand()),
      env: toolEnv,
      // The music engine (§6.5) is a component of the music model pack. `CUCCUT_AUDIOCPP_CLI` and the tool download mirror are read as external-tool overrides (tests do not read the real environment).
      toolOverrides,
      // Preferences are read in later: fetched when the install plan is built.
      toolsEndpoint: () => toolsDownloadEndpoint(toolOverrides, settingsStore?.get('tools.downloadEndpoint') ?? null),
      idleMs: options.jobIdleMs,
      ...(options.capacity ? { capacity: options.capacity } : {}),
      // Preferences are read in later: fetched at admission.
      resourceCapacity: () => settingsStore?.get('resources.capacity') ?? null,
      remote: new NodeProviderSource(initiator),
      // Online providers prepare audio with ffmpeg (the same ffmpeg as media analysis).
      ffmpeg: async () => ({ command: process.env.CUCCUT_FFMPEG || 'ffmpeg', env: await toolEnv() }),
      ffprobe,
      library: library.store,
      enabledGlossaries: (videoId, step) => library.enabledGlossaries(videoId, step),
      ...(options.online ? { online: options.online } : {}),
      // Agents as providers (§6.9) share the Driver registry with sessions, but each generation opens its own dedicated native session.
      agents: drivers,
      ...(options.agentProviders ? { agentProviders: options.agentProviders } : {}),
      // Preferences are read in later: fetched at install time for the download source and strict offline mode.
      installSettings: () => ({
        downloadEndpoint: settingsStore?.get('models.downloadEndpoint') ?? null,
        offlineStrict: settingsStore?.get('offline.strict') ?? false,
      }),
      ...(options.modelInstall ? { modelInstall: options.modelInstall } : {}),
      modelsDirSetting: {
        get: () => settings.store.get('models.dir'),
        set: async (value) => {
          await settings.store.set({ 'models.dir': value });
        },
      },
      ...(options.modelsDirTesting ? { modelsDirTesting: options.modelsDirTesting } : {}),
      // Save location (§7.9): preferences are read in later, fetched at submit time.
      saveDirectory: () => resolveSaveDirectory({ settings: settingsStore?.get('downloads.directory') ?? null }),
      pipelineTargets: {
        entry: (entryId) => {
          if (!spaceRef) throw new RpcError('busy', RcRuntime.spaceNotReady());
          return entryPlace(spaceRef, entryId);
        },
        projectRoot,
        // A flow creates a video in a session (`create: { conversationId }`). It is created in the session's source: when the session is not in a project, that is its working directory (§3.10).
        conversationSource,
      },
      // Jobs under a task, and flow results, carry the task contract's protection scope (§3.2). If the task is already gone (the session was deleted), there is no protection.
      taskProtections: async (taskId, videoId) => {
        const harness = await harnessReady;
        try {
          return engineProtections(harness.getContract(taskId).contract, videoId);
        } catch (error) {
          if (error instanceof RpcError && error.code === 'not-found') return [];
          throw error;
        }
      },
      extraPipelines: (context) => [
        linkImportDefinition(
          {
            tools: () => {
              if (!externalToolsRef) throw new Error(RcRuntime.externalToolsNotReady().text);
              return externalToolsRef;
            },
            settings: () => ({
              downloadsDirectory: settingsStore?.get('downloads.directory') ?? null,
              offlineStrict: settingsStore?.get('offline.strict') ?? false,
            }),
            projectRoot,
            conversationRoot,
            videoSource: (videoId) => videos.ref(videoId)?.source ?? null,
            outputsDir: path.join(home.root, 'outputs'),
            sources: linkSources,
            ffprobe,
            // When `CUCCUT_FFMPEG` is an absolute path, yt-dlp is told to use it to merge audio and video. Otherwise yt-dlp looks for it on PATH itself.
            ffmpegLocation: async () => {
              const configured = toolOverrides.CUCCUT_FFMPEG;
              return configured && path.isAbsolute(configured) ? configured : null;
            },
            ...(options.externalTools?.lookup ? { lookup: options.externalTools.lookup } : {}),
          },
          context,
        ),
        aiToolDefinition(
          {
            videos,
            skills: () => aiToolRef().skills,
            attachments: () => aiToolRef().attachments,
            exports: () => aiToolRef().exports,
          },
          context,
        ),
      ],
      ...(options.jobFaults ? { faults: options.jobFaults } : {}),
    });
    artifacts = models.jobs.artifacts;
    library.attachVoiceClones(
      new VoiceCloneService({
        store: library.store,
        jobs: models.jobs,
        grants: models.grants,
        cloner: (providerId) => models.voiceCloner(providerId),
        log: log.child('voice-clone'),
      }),
    );
    // The authorization ledger is written to disk after the task stops (once it is settled).
    stops.add('grants', () => models.grants.flush(), 'Writing the grant ledger failed');
    // The usage ledger and the account's last-used time are also fully written after the task stops (§6.10).
    stops.add('usage', () => models.flushUsage(), 'Writing the usage ledger failed');
    // Managed external tools (§12.9): probing, consent and install. The install is a `toolInstall` job in the JobManager.
    const externalTools = new ExternalToolService({
      toolsDir: path.join(home.root, 'tools'),
      storeFile: path.join(home.root, 'store', 'external-tools.json'),
      jobs: models.jobs,
      log: log.child('tools'),
      env: toolEnv,
      settings: () => ({
        downloadEndpoint: settingsStore?.get('tools.downloadEndpoint') ?? null,
        offlineStrict: settingsStore?.get('offline.strict') ?? false,
      }),
      ...options.externalTools,
    });
    externalToolsRef = externalTools;
    // The raw link is kept only for the import-from-link flow, which can still be retried.
    await pruneLinkSources(models.jobs, linkSources).catch((error) => log.warn('Pruning link sources failed', { error: String(error) }));
    // Stopping a task cancels in-flight jobs and shuts down the Worker process.
    stops.add('jobs', () => models.jobs.shutdown(), 'Stopping background tasks failed');
    // Fonts downloaded on demand (§9.1) are cached under `fonts/` in the Runtime Home. The download is a `fontDownload` job in the JobManager.
    const fonts = new FontService({
      dir: path.join(home.root, 'fonts'),
      jobs: models.jobs,
      videos,
      log: log.child('fonts'),
      settings: () => ({
        autoDownload: settingsStore?.get('fonts.autoDownload') ?? true,
        cssEndpoint: settingsStore?.get('fonts.cssEndpoint') ?? null,
        fileEndpoint: settingsStore?.get('fonts.fileEndpoint') ?? null,
        offlineStrict: settingsStore?.get('offline.strict') ?? false,
      }),
      ...options.fonts,
    });
    // The review gate before delivery (docs/cuccut/m2-review-gate.md §4.2): the user's standard (built-ins only while the file is missing), reviews and the
    // per-video decisions. Built before exports, whose `create` asks its gate; the `review.*` handlers and the review tools share it.
    const reviewCriteria = new ReviewCriteriaStore(home.reviewCriteriaFile, { log: log.child('review-criteria') });
    await reviewCriteria.load();
    const review = new ReviewService({
      videos,
      jobs: models.jobs,
      store: reviewCriteria,
      settings: () => ({ gate: settings.store.get('review.gate') }),
      log: log.child('review'),
    });
    stops.add('review', () => review.flush(), 'Writing pending review results failed');
    // Export is the `export` job in the JobManager (architecture design §9.11). ffmpeg and ffprobe are the same as for media analysis.
    const exports = new ExportService({
      jobs: models.jobs,
      videos,
      fonts,
      ffmpeg: async () => ({ command: process.env.CUCCUT_FFMPEG || 'ffmpeg', env: await toolEnv() }),
      ffprobe: async () => ({ command: process.env.CUCCUT_FFPROBE || 'ffprobe', env: await toolEnv() }),
      // The render Worker for the finished output comes from the same cargo build as the engine host, and sits next to it.
      exportWorker: () => resolveExportWorkerCommand(options.engineHost !== undefined ? options.engineHost : resolveEngineHostCommand()),
      // A deliverable finished-video export stops on an open critical finding (docs/cuccut/m2-review-gate.md §4.3).
      review,
      log: log.child('exports'),
    });
    // If sharing is on, the node service starts listening here (the pairing code is not reissued). A port that is already taken does not stop the Runtime from starting.
    const nodes = await openNodeShare(home, models, log, options.nodes);
    // Stopping the node service cancels remote jobs, closes the listener, and withdraws the mDNS registration. It may listen on all interfaces, so even when startup fails this externally reachable port must not be left open.
    stops.add('nodes', () => nodes.close(), 'Stopping the node service failed');
    // The agent's tool channel: the session token is issued when the native session is created and revoked when it is released (architecture design §3.5).
    // Agent skills (§3.8): toggles store only the difference, and the directory is re-read every time. The index of enabled skills is appended to the guidance at the start of each native session.
    const skillPrefs = new SkillPrefsStore(home.skillPrefsFile, { log: log.child('skill-prefs') });
    await skillPrefs.load();
    const skills = new SkillCatalog({
      builtinDir: options.skillsDir === undefined ? resolveBuiltinSkillsDir() : options.skillsDir,
      userDir: home.skillsDir,
      prefs: skillPrefs,
    });
    const skillInstaller = new SkillInstaller({
      catalog: skills,
      offlineStrict: () => settings.store.get('offline.strict'),
      ...(options.skillsGithub ? { github: options.skillsGithub } : {}),
    });
    // Packs (pack spec §6): installed packs live in `<home>/packs`, what they brought in the template and skill folders and the library. Previews do not survive a
    // restart and trash older than 24 hours is purged, here at startup.
    const packLibrary: PackLibrary = {
      import: async (file) => {
        const { entry } = await library.import({ path: file });
        return { library: entry.library, id: entry.id };
      },
      remove: (name, id) => library.store.remove(name, id),
      entry: (name, id) => {
        try {
          return { name: library.store.get({ library: name, id }).content.name };
        } catch {
          return null;
        }
      },
    };
    const packRegistry = new PackRegistry({ dir: home.packsDir, templatesDir: home.templatesDir, skillsDir: home.skillsDir, library: packLibrary });
    const templates = new TemplateCatalog({
      builtinDir: options.templatesDir === undefined ? resolveBuiltinTemplatesDir() : options.templatesDir,
      userDir: home.templatesDir,
      packOwner: () => packRegistry.owners(),
    });
    const packInstaller = new PackInstaller({
      registry: packRegistry,
      previews: new PackPreviews({ dir: path.join(home.packsDir, '.staging') }),
      templates,
      skills,
      library: packLibrary,
      source: {
        offlineStrict: () => settings.store.get('offline.strict'),
        ...(options.packsSource?.github ? { github: options.packsSource.github } : {}),
        ...(options.packsSource?.fetch ? { fetch: options.packsSource.fetch } : {}),
      },
    });
    await packInstaller.startup();
    // Each project's style choice (pack spec §7); a choice naming a removed pack stays and resolves to none.
    const packChoices = new PackChoicesStore(home.packChoicesFile, { log: log.child('pack-choices') });
    await packChoices.load();
    // The active style guide (pack spec §7) reads conversations and projects from the Harness, which opens later; it is only asked once sessions run.
    const packStyle = new PackStyle({
      registry: packRegistry,
      choices: packChoices,
      sessions: {
        conversation: (conversationId) => requireHarness().getConversation(conversationId),
        projects: () => requireHarness().listProjects(),
      },
      exclusive: (run) => packInstaller.exclusive(run),
    });
    // Export (pack spec §6.4): the user's own templates and skills, library entries as exchange files, and an installed pack's guide, into a folder anyone can read.
    const packExporter = new PackExporter({
      registry: packRegistry,
      templates,
      skills,
      library: {
        exportInfo: (name, id) => {
          const { content } = library.store.get({ library: name, id });
          const extension =
            name === 'glossaries' ? 'md' : 'file' in content ? path.extname(content.file.fileName).slice(1).toLowerCase() || 'bin' : 'json';
          return { name: content.name, extension };
        },
        exportTo: async (name, id, target) => {
          await library.export({ entry: { library: name, id }, path: target });
        },
      },
      exclusive: (run) => packInstaller.exclusive(run),
    });
    // Reference files on the pack page (pack spec §7.3): a video's still is taken with the ffmpeg found through the login shell's PATH (or CUCCUT_FFMPEG); without one
    // the reference is added without a still.
    const packExamples = new PackExamples({
      registry: packRegistry,
      still: ffmpegStillMaker(async () => process.env.CUCCUT_FFMPEG || (await findOnPath('ffmpeg', (await toolEnv()).PATH ?? ''))),
      exclusive: (run) => packInstaller.exclusive(run),
    });
    // The user's profile (docs/cuccut/m2-profile-rules.md): built before the grants, whose session callback reads it at each session start. Projects are
    // looked up through the Harness, which opens later, so only when needed.
    const profile = await ProfileService.open({
      home,
      library: library.store,
      projects: () => requireHarness().listProjects(),
      installedTemplates: async () => new Set((await templates.scan()).templates.map((t) => t.manifest.id)),
      // Writing preferences from the answers: one confined turn of the default agent, or else the first one installed and signed in.
      writer: {
        agent: async () => {
          const chosen = pickWriterAgent((await requireHarness().agents()).drivers);
          return chosen ? { id: chosen.id, driver: drivers.get(chosen.id), executable: drivers.executable(chosen.id) } : null;
        },
        stagingDir: path.join(home.stagingDir, 'profile-runs'),
        ...(options.profileWriterTimeoutMs !== undefined ? { timeoutMs: options.profileWriterTimeoutMs } : {}),
      },
      log,
    });
    stops.add('profile', () => profile.close(), 'Saving the profile failed');
    /** The project directory of a session's project; null for a session outside a project (or before the Harness is up). */
    const projectPathOf = (conversationId: Id): string | null => {
      const projectId = harnessRef?.conversationOf(conversationId)?.projectId;
      return (projectId && harnessRef?.listProjects().find((p) => p.id === projectId)?.path) || null;
    };
    // At the start of each native session, the guidance gets the index of enabled skills, the user's profile, then the active pack's style guide (pack spec §7).
    // A profile or guide that can't be read is left out rather than holding up the session.
    const grants = new AgentGrants(
      (principal) => videos.connectionClosed(principal.connectionId),
      async (conversationId) => {
        const profileBlock = await profile.sessionBlock(projectPathOf(conversationId)).catch((error: unknown) => {
          log.warn('Failed to read the profile for a session', { conversationId, error: String(error) });
          return '';
        });
        const style = await packStyle.sessionBlock(conversationId).catch((error: unknown) => {
          log.warn('Building the style guide block failed', { conversationId, error: String(error) });
          return '';
        });
        return joinBlocks([skillIndexBlock(await skills.enabled()), profileBlock, style]);
      },
    );
    // Images in messages: uploaded through the same gateway port, and handed to the Driver on send (product design §3.2.4).
    const attachments = new AttachmentStore({
      dir: home.attachmentsDir,
      log,
      originAllowed: (origin) => originAllowed(origin, options.allowedOrigins),
    });
    stops.add('attachments', () => attachments.close(), null);
    aiToolRefs = { skills, attachments, exports };

    // Preferences (already read in above): the default Driver and access mode for new sessions are frozen from here (§3.11, §3.12).
    // When machine capacity changes, queued jobs are re-checked against the new capacity.
    settings.store.onChange((changed) => {
      if ('resources.capacity' in changed) models.jobs.resources.recheck();
    });
    const harness = await Harness.open({
      home,
      conversations: new ConversationStore(home.conversationsDir, { log: log.child('conversations') }),
      prefs: new AgentPrefsStore(home.agentPrefsFile, { log: log.child('agent-prefs') }),
      probes: new AgentProbeStore(home.agentProbesFile, { log: log.child('agent-probes') }),
      projects: new ProjectStore(home.projectsFile, { log: log.child('projects') }),
      drivers,
      providers: { store: customProviders, create: createCustomDriver },
      settings: settings.store,
      tools: grants,
      // The main stop (§7.4) also cancels this session's agent submissions and its unfinished Jobs.
      jobs: { cancelSubmittedBy: (conversationId) => cancelAgentJobs(models.jobs, conversationId) },
      attachments,
      // Task budget (§3.2, §7.8): the contract's budget policy is registered in the authorization ledger. Each outbound call in a task must pass it in addition to authorization.
      budgets: models.grants,
      // When items from a session's working directory (with no project) are moved into a project (§3.10), an open video directory is skipped.
      openVideoDirs: () => videos.openRefs().map((ref) => ref.path),
      closeIdleVideos: (dir) => videos.closeIdleIn(dir),
      log,
    });
    stops.add('harness', () => harness.shutdown(), 'Stopping the Harness failed');
    // Videos left in session working directories before the upgrade are moved into their projects, and working directories with no session are cleaned up (§3.10). This runs before Space's first scan and before any client connects.
    await harness.migrateScratch().catch((error: unknown) => log.warn('Failed to tidy session folders', { error: String(error) }));
    // The default Agent is stored in preferences (`agent.defaultDriver`, §3.11). When the settings page, the CLI, or `agents.setDefault` changes it, the new Agent view is pushed.
    // When the default Agent has no default model set, `DriverInfo.defaultModel` takes `agent.defaultModel`, and changing it also pushes.
    settings.store.onChange((changed) => {
      if ('agent.defaultDriver' in changed || 'agent.defaultModel' in changed) harness.agentsChanged();
    });
    harnessRef = harness;
    harnessOpened(harness);
    // Install and upgrade commands run inside the app: end them before stopping the Harness (the re-probe after they end needs the Harness).
    const setup = new AgentSetup({ agents: (o) => harness.agents(o), log, ...options.agentSetup });
    stops.add('setup', () => setup.shutdown(), 'Stopping agent setup commands failed');
    // Registration is kept in memory only. Attachment directories left over from an unsent message, or not fully cleaned up when a session was deleted, are cleared here.
    await attachments.removeOrphans(harness.referencedAttachments());
    // The whole tool catalog (§3.5): one factory builds all tool groups for a scope. A session's tool bridge uses the session's scope (tasks, plan mode, the source directory), and MCP services use the service's scope (the access policy). Which surfaces each tool appears on is decided by its catalog entry's `surfaces`; nothing is chosen here.
    // The code view (§8): the Electron off-screen host is started on demand and shared by all tool groups. The ffmpeg used for baking is the same one used for media analysis (found via the login shell's PATH).
    const packages = new PackageImporter(videos);
    // The code view (§8): the Electron off-screen host is started on demand and shared by all tool groups. The ffmpeg used for baking is the same one used for media analysis (found via the login shell's PATH).
    const compositionHost = new SharedCompositionHost({
      electron: resolveElectronBinary(),
      cacheDir: home.cacheDir,
      log: (line) => log.debug('Composition host', { line }),
    });
    stops.add('compositions', () => compositionHost.close(), 'Stopping the composition host failed');
    const compositionFfmpeg = async () =>
      process.env.CUCCUT_FFMPEG || (await findOnPath('ffmpeg', (await toolEnv()).PATH ?? '')) || 'ffmpeg';
    // Import and preview: the tools (sessions, terminals, external services) and the UI's `compositions.*` share this one, and the host is the same too.
    const compositions = new CompositionService({ videos, ffmpeg: compositionFfmpeg, host: compositionHost, log });
    const toolSets = (toolScope: ToolScope): ToolSet[] => {
      // Download from a link: `download` and `transcribe` share this when given a `url`.
      const linkImport = {
        tools: externalTools,
        pipelines: models.pipelines,
        jobs: models.jobs,
        offlineStrict: () => settings.store.get('offline.strict'),
        scope: toolScope,
      };
      return [
        new VideoTools({
          videos,
          scope: toolScope,
          analysis,
          faces,
          packages,
          // The Space directory is built later, so it is fetched at derivation time.
          findDerived: (parentVideoId, key) => spaceDerivedFinder(space)(parentVideoId, key),
        }),
        new ModelTools({ models, scope: toolScope }),
        new JobTools({ jobs: models.jobs, pipelines: models.pipelines, scope: toolScope }),
        new ExportTools({ exports, scope: toolScope }),
        // The review gate (docs/cuccut/m2-review-gate.md §5): the same service as `review.*` and the export gate.
        new ReviewTools({ review, scope: toolScope }),
        new ModelInstallTools({ installs: models.installs, catalog: models.catalog, scope: toolScope }),
        new ProjectTools({ harness, videos, scope: toolScope }),
        new LibraryTools({ library, scope: toolScope }),
        // The Space directory is built later, so it is fetched at tool call time.
        new SpaceTools({ space: () => space, scope: toolScope, jobs: models.jobs }),
        new SkillTools({ skills, scope: toolScope }),
        // The user's profile (docs/cuccut/m2-profile-rules.md §6): the project level is the session's project, or the terminal's.
        new ProfileTools({ profile, scope: toolScope, projectOf: (principal) => profileProjectOf(harness, principal) }),
        // Packs (pack spec §7): reading installed packs and a project's style choice; installing stays with the person.
        new PackTools({ registry: packRegistry, style: packStyle, harness, scope: toolScope }),
        new GrantTools({ models, scope: toolScope }),
        new TaskTools({ harness, scope: toolScope }),
        new LinkImportTools(linkImport),
        // First-level verbs (transcribe, translate, dub, transcode) start fixed pipelines. The glossary enabled for the video is read by the pipeline itself.
        new FlowTools({ pipelines: models.pipelines, scope: toolScope, linkImport }),
        new DownloadTools({
          scope: toolScope,
          downloadsDirectory: () => resolveDownloadsDirectory(settings.store.get('downloads.directory')),
          // Files handed out are registered as Space deliverables (§3.5). The Space directory is built later, so it is fetched at call time.
          register: (handover) =>
            space.recordHandover(handover).catch((error: unknown) => log.warn('Registering a handed-over download failed', { error: String(error) })),
        }),
        new VideoDeleteTools({
          space: () => space,
          trash: () => videoTrash,
          videos,
          retentionDays: () => settings.store.get('space.trashRetentionDays'),
          scope: toolScope,
        }),
        new CompositionTools({ videos, scope: toolScope, compositions }),
        // Slides in a session (docs/design/slides §7.2): validation and material import. The compiler and the deck storage come from the slides service.
        new SlidesTools({ scope: toolScope, slides }),
        // Design canvases in a session (docs/design/canvas §7.2): structure validation and material import. Canvas storage comes from the same editor service.
        new DesignTools({ scope: toolScope, design: slides }),
        // Design systems in a session (docs/design/canvas §10.5): structure validation and material import. Storage comes from the same editor service.
        new DesignSystemTools({ scope: toolScope, designSystem: slides }),
      ];
    };
    // The session's tool bridge and the gateway's `catalog.call` (terminal) share the same tool instances. `ScopeRouter` routes by the subject's kind to the session's scope or the terminal's scope (the user themselves, with relative paths resolved against cwd). Each of the two surfaces is a view of this tool set (`surface`).
    const scope = new ScopeRouter({
      agent: new AgentScope({ harness, videos, jobs: models.jobs }),
      local: new LocalScope({ harness, videos, jobs: models.jobs, space: () => space, projectsDir: home.projectsDir }),
    });
    const tools = new ToolCatalog(toolSets(scope), log, { surface: 'agent' });
    // In-session agent guidance (§3.8; Agent surface design §8.6): the manuals are rendered for the tool-bridge surface, and `{{tool:…}}` is checked against this catalog. The SKILL.md body is the developer guidance for each native session. The catalog page, the overview of approaches, and conventions are registered as built-in skills. If rendering fails, startup fails rather than opening sessions with empty or stale guidance.
    const agentSkillsDir = options.agentSkillsDir === undefined ? resolveBuiltinAgentSkillsDir() : options.agentSkillsDir;
    const guidance = loadAgentGuidance(agentSkillsDir, { tools: tools.list() });
    grants.setInstructions(guidance.instructions);
    skills.setGuidePages(guidance.pages, guidance.sourceDir);
    const mcp = new McpEndpoint({ grants, tools, log });
    // External services (§4.8): registered first, and the ones that start with the Runtime are opened once the gateway is ready. On stop they go first: external connections are disconnected and pending service approvals are cancelled.
    const services = await openServices({
      home,
      harness,
      videos,
      models,
      nodes,
      log,
      toolSets,
      ...(options.services ? { options: options.services } : {}),
    });
    stops.add('services', () => services.manager.close(), 'Stopping external services failed');

    const marks = new SpaceMarkStore(home.spaceFile, { log: log.child('space-marks') });
    await marks.load();
    // Space's artifact records (§5.7): the derived facts for the jobs that produced artifacts. The entries remain after the Job Ledger prunes.
    const spaceArtifacts = new SpaceArtifactStore(home.spaceArtifactsFile, { log: log.child('space-artifacts') });
    const retained = await spaceArtifacts.load();
    if (retained.skipped > 0 || retained.quarantined) log.warn('Skipped unreadable parts of the Space output records', retained);
    // The cross-video content index (§5.11): a derived cache that reads videos only through VideoService's read-only queries. When a video index finishes, the Space directory's derived state is recomputed.
    const contentIndex = new ContentIndex({
      dir: path.join(home.cacheDir, 'content-index'),
      reader: { readContent: (dir) => videos.readContent(dir), peek: (dir) => videos.peek(dir) },
      log,
    });
    await contentIndex.load();
    const space = new SpaceCatalog({
      harness,
      marks,
      log,
      watch: options.watchSpace,
      jobs: models.jobs,
      artifacts: spaceArtifacts,
      videos,
      index: contentIndex,
      scratchDirs: [home.scratchDir, ...(home.legacyScratchDir ? [home.legacyScratchDir] : [])],
    });
    spaceRef = space;
    // Trash retention (§5.7): cleaned once after the first scan, then every 6 hours. The number of days is read from the setting each time.
    const sweepTrash = () =>
      void space.ready
        .then(() => space.sweepTrash(settings.store.get('space.trashRetentionDays')))
        .catch((error) => log.warn('Trash retention cleanup failed', { error: String(error) }));
    const trashSweeper = setInterval(sweepTrash, TRASH_SWEEP_INTERVAL_MS);
    trashSweeper.unref();
    stops.add(
      'space',
      () => {
        clearInterval(trashSweeper);
        return space.close();
      },
      null,
    );
    space.start();
    sweepTrash();
    // Export temp files left behind by a forced kill, and the staging directories used to open portable packages (§5.8): cleaned once in the background after the first scan.
    void space.ready
      .then(() => sweepLeftovers({ jobs: () => models.jobs.list(), sourceRoots: () => space.sourceRoots(), log }))
      .catch((error) => log.warn('Leftover file cleanup failed', { error: String(error) }));
    // Background cleanup of the artifact library and the cache (§5.1, §7.3): after Space fills in artifact records from the ledger, the artifact library is cleaned once, and again after each ledger eviction job. The cache size is checked every hour.
    const storageGc = new StorageGc({
      jobs: models.jobs,
      spaceArtifacts,
      ready: space.ready,
      artifactSweepBlocked: retained.quarantined ? 'space-artifacts-quarantined' : null,
      cacheDir: home.cacheDir,
      cacheMaxBytes: () => settings.store.get('cache.maxSizeMiB') * 1024 * 1024,
      log: log.child('storage-gc'),
    });
    stops.add('storage-gc', () => storageGc.close(), null);
    storageGc.start();
    const videoTrash = new VideoTrash({
      space,
      videos,
      jobs: models.jobs,
      resolve: (target) => locateFileTarget(harness, space, target),
      log,
    });

    const info: RuntimeInfo = {
      instanceId,
      epoch: instanceId,
      runtimeVersion: RUNTIME_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      home: home.root,
      projectsDir: home.projectsDir,
      logsDir: home.logsDir,
      pid: process.pid,
      startedAt: nowIso(),
      launchedBy: options.launchedBy ?? null,
    };
    // Whether anyone is using the Runtime (§2.2): `runtime.status` reports it, and CLI-launched Runtimes exit when idle based on it.
    const activity = new RuntimeActivity(
      {
        info,
        activeJobs: () => models.jobs.list().filter((job) => !isTerminal(job.state)).length + Number(legacyUpgrade.active),
        runningServices: () =>
          services.manager.list().flatMap((service) => (service.state === 'off' || service.state === 'error' ? [] : [service.serviceId])),
      },
      options.idleExit
        ? {
            ...options.idleExit,
            minutes: () => settings.store.get('runtime.idleExitMinutes'),
            // Delete the discovery file before stopping (§2.2). Stopping tasks and services takes a while, and during that time a CLI looking for the Runtime cannot see it. Once the instance lock is released, the CLI starts another one, rather than connecting to one that is exiting.
            onIdle: () =>
              void removeDiscovery(home, instanceId)
                .catch(() => {})
                .finally(() => options.idleExit!.onIdle()),
          }
        : null,
    );
    const token = crypto.randomBytes(32).toString('base64url');
    const handlerDeps = {
      harness,
      setup,
      space,
      media,
      slides: slides.opener(),
      design: slides.designOpener(),
      designSystem: slides.designSystemOpener(),
      attachments,
      analysis,
      spaceThumbnails: new SpaceThumbnails({
        catalog: space,
        analysis,
        assetFileAt: (dir, assetId, revision) => videos.assetFileAt(dir, assetId, revision),
        log,
      }),
      videos,
      videoTrash,
      models,
      exports,
      library,
      nodes,
      initiator,
      settings,
      services,
      runtime: info,
      externalTools,
      templates,
      skills,
      skillInstaller,
      profile,
      packs: { registry: packRegistry, installer: packInstaller, style: packStyle, exporter: packExporter, examples: packExamples },
      fonts,
      // The code view (§8): the UI's `compositions.*` and the tools share the same service and host.
      compositions,
      // The terminal's directory view (§3.5): among the same tool set, those whose `surfaces` include `cli`.
      catalog: tools.withView({ surface: 'cli' }),
      agentSkillsDir,
      activity,
      requestStop: options.requestStop ?? null,
      legacyUpgrade,
      review,
    };
    // The web service (§4.8) uses the same handler functions, swapping in only its own media handle (a same-origin address, requiring a session). The allowlist is at its gateway entry.
    services.web.bind({
      runtime: info,
      handlers: createHandlers({
        ...handlerDeps,
        media: services.web.media,
        slides: slides.opener(() => ''),
        design: slides.designOpener(() => ''),
        designSystem: slides.designSystemOpener(() => ''),
      }),
      slides: slides.server,
    });
    // Present user (the in-place authorization on tool pages, §7.9): a desktop UI connection on this gateway. CLI, agents, browsers and external services do not count.
    const present = new Set<string>();
    models.grants.setPresence((submitter) => submitter.kind === 'connection' && present.has(submitter.id));
    const gateway = new Gateway({
      token,
      runtime: info,
      handlers: createHandlers(handlerDeps),
      log,
      allowedOrigins: options.allowedOrigins,
      http: (request, response) => {
        activity.touch();
        return (
          mcp.handle(request, response) ||
          attachments.handle(request, response) ||
          media.handle(request, response) ||
          slides.handle(request, response)
        );
      },
      onConnect: (principal) => {
        if (principal.kind === 'desktop') present.add(principal.connectionId);
        activity.connected(principal);
      },
      onRequest: (principal, method) => activity.requested(principal, method),
      onDisconnect: (principal) => {
        activity.disconnected(principal);
        present.delete(principal.connectionId);
        videos.connectionClosed(principal.connectionId);
      },
    });
    // If listening fails, the gateway cleans itself up. Registration happens before listening so the gateway is also closed if writing the discovery file fails later.
    stops.add('gateway', () => gateway.close(), 'Stopping the gateway failed');
    const endpoint = await gateway.listen(options.host, options.port);
    media.setBaseUrl(endpoint.replace(/^ws:/, 'http:'));
    slides.setBaseUrl(endpoint.replace(/^ws:/, 'http:'));
    attachments.setBaseUrl(endpoint.replace(/^ws:/, 'http:'));
    grants.setEndpoint(`${endpoint.replace(/^ws:/, 'http:')}/mcp`);
    const discovery: RuntimeDiscovery = { ...info, endpoint, token };
    await writeDiscovery(home, discovery);
    stops.add('discovery', () => removeDiscovery(home, instanceId), null);
    // External services that start with the Runtime: a failure (port in use) puts only that service into error, and the Runtime is not affected.
    await services.manager.restore();
    activity.start();
    stops.add('activity', () => activity.stop(), null);
    legacyUpgrade.start({
      models: models.services.store,
      nodes: initiator.store,
      isBusy: () => models.jobs.list().some((job) => !isTerminal(job.state)),
      refreshModels: () => models.services.refresh(),
      engine: options.engineHost !== undefined ? options.engineHost : resolveEngineHostCommand(),
      openProject: async (dir, name) => {
        const existed = harness.listProjects().some((project) => project.path === dir);
        const project = await harness.openProject(dir);
        if (!existed && typeof name === 'string' && name.trim()) {
          await harness.updateProject({ projectId: project.id, name: [...name.trim()].slice(0, 200).join('') });
        }
      },
      env: toolEnv,
    });
    log.info('Runtime ready', { instanceId, endpoint, home: home.root, launchedBy: info.launchedBy });

    let closing: Promise<void> | null = null;
    const close = () =>
      (closing ??= (async () => {
        log.info('Runtime stopping');
        await stops.run();
        await releaseInstanceLock(home, instanceId).catch(() => {});
        log.info('Runtime stopped');
        await log.close();
      })());

    return {
      info,
      discovery,
      harness,
      space,
      videos,
      models,
      exports,
      library,
      nodes,
      initiator,
      settings,
      services,
      externalTools,
      fonts,
      profile,
      review,
      log,
      close,
    };
  } catch (error) {
    log.error('Runtime failed to start', { error: String(error) });
    harnessFailed(error);
    await stops.run();
    await releaseInstanceLock(home, instanceId).catch(() => {});
    await log.close().catch(() => {});
    throw error;
  }
}

/**
 * Cancels a session's agent-submitted jobs that are still queued or running (step 2 of the main stop, §7.4), using the same path as `jobs.cancel`.
 * It does not wait for running providers to stop. It only waits for the engine to acknowledge the stop barrier (at most `BARRIER_ACK_MS`). Once that is done, these jobs will no longer write into the video.
 * Resolves to the number of cancellations issued. Jobs that have already finished, and their results, are unaffected.
 */
async function cancelAgentJobs(jobs: JobManager, conversationId: Id): Promise<number> {
  const pending = jobs
    .list()
    .filter(
      (job) => job.submitter.kind === 'agent' && job.submitter.id === conversationId && (job.state === 'queued' || job.state === 'running'),
    );
  const barriers = pending.map((job) => jobs.cancelWrites(job.jobId).catch(() => false));
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, BARRIER_ACK_MS);
    timer.unref?.();
  });
  await Promise.race([Promise.all(barriers), timeout]);
  clearTimeout(timer);
  return pending.length;
}

/** The upper limit on how long the main stop waits for the engine to acknowledge the stop barrier. A stuck engine does not hold up the stop; later submissions still get the Node-side barrier. */
const BARRIER_ACK_MS = 5_000;

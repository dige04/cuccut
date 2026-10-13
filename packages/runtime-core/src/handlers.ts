import { RcWeb } from '@cuccut/protocol/messages/runtime-core';
import path from 'node:path';
import {
  RpcError,
  SETTING_MANAGED_BY,
  parseVideoTopic,
  type FileTarget,
  type Id,
  type SlideAnnotation,
  type DesignAnnotation,
  type DesignSystemAnnotation,
  type RpcMethod,
  type RpcParams,
  type RpcResult,
  type RuntimeInfo,
  type Seq,
  type SequencedEvent,
  type Topic,
  webVideoHref,
} from '@cuccut/protocol';
import type { Harness, TopicSubscription } from '@cuccut/harness';
import type { AgentSetup } from './agent-setup.ts';
import type { AttachmentStore } from './attachments.ts';
import type { TrustedPrincipal } from './gateway.ts';
import { findSubtitles, type MediaRegistry } from './media.ts';
import { listProjectFiles } from './project-files.ts';
import { createProjectFile, type ProjectFileScope } from './project-file-create.ts';
import type { MediaAnalysis } from './media-analysis.ts';
import {
  resolveDesignAnnotations,
  resolveDesignSystemAnnotations,
  resolveSlideAnnotations,
  type DesignOpener,
  type DesignSystemOpener,
  type SlidesOpener,
} from './slides.ts';
import type { SpaceCatalog } from './space-catalog.ts';
import { resolvePipelineEntryInputs, withSpeechMaterial, withTextMaterial } from './space/space-inputs.ts';
import { spaceMethods, updateEntry } from './space/space-methods.ts';
import type { SpaceThumbnails } from './space/space-thumbnails.ts';
import type { VideoService } from './videos/video-service.ts';
import { deriveVideo, spaceDerivedFinder } from './videos/video-derive.ts';
import { videoShots } from './agent-tools/video-shots.ts';
import type { VideoTrash } from './videos/video-trash.ts';
import type { ModelJobs } from './models/model-jobs.ts';
import { applySpeakerProposal } from './models/speakers-apply.ts';
import type { ExportService } from './exports/export-service.ts';
import type { RuntimeSettings } from './settings-topic.ts';
import type { RuntimeServices } from './services/open-services.ts';
import type { LibraryService } from './library/library-service.ts';
import type { NodeInitiator, NodeService } from '@cuccut/nodes';
import type { ExternalToolService } from './external-tools/external-tool-service.ts';
import { externalToolMethods } from './external-tools/external-tool-methods.ts';
import { toolCatalogueMethods } from './tool-catalogue/tool-methods.ts';
import { resolveSaveDirectory } from './external-tools/downloads-directory.ts';
import type { TemplateCatalog } from './templates/template-catalog.ts';
import { templateMethods } from './templates/template-methods.ts';
import { skillMethods } from './skills/skill-methods.ts';
import type { SkillCatalog } from './skills/skill-catalog.ts';
import type { SkillInstaller } from './skills/skill-installer.ts';
import type { FontService } from './fonts/font-service.ts';
import { fontMethods } from './fonts/font-methods.ts';
import type { CompositionService } from './compositions/composition-service.ts';
import { compositionMethods } from './compositions/composition-methods.ts';
import { PackageImporter } from './videos/package-import.ts';
import { RcRuntime } from '@cuccut/protocol/messages/runtime-core';
import type { ToolCatalog } from './agent-tools/tool-catalog.ts';
import type { RuntimeActivity } from './runtime-activity.ts';
import type { LegacyUpgrade } from './legacy-upgrade.ts';
import { catalogMethods } from './agent-tools/catalog-methods.ts';

type MethodHandler<M extends RpcMethod> = (params: RpcParams<M>, principal: TrustedPrincipal) => RpcResult<M> | Promise<RpcResult<M>>;

export interface RpcHandlers {
  methods: { [M in Exclude<RpcMethod, 'subscribe' | 'unsubscribe'>]: MethodHandler<M> };
  subscribe(
    topic: Topic,
    afterSeq: Seq | undefined,
    listener: (event: SequencedEvent<unknown>) => void,
  ): TopicSubscription<unknown, unknown>;
}

/**
 * Mapping from the method table to the Harness. The UI, the CLI and external agents use the same set of handler functions (architecture design §4.1).
 * `principal` 0.1 is only used for logs. Permission checks arrive with external agent access.
 */
export interface HandlerDeps {
  harness: Harness;
  /** Install, upgrade and login actions for agents (architecture design §12.9). */
  setup: AgentSetup;
  space: SpaceCatalog;
  media: MediaRegistry;
  /** Address of the slide editor (`slides.open`, docs/design/slides §6.1). The gateway and the web service have different base addresses. */
  slides: SlidesOpener;
  /** Address of the design editor (`design.open`, docs/design/canvas §6.1). Same base address as `slides`. */
  design: DesignOpener;
  /** Address of the design system editor (`designSystem.open`, docs/design/canvas §10.4). Same base address as `slides`. */
  designSystem: DesignSystemOpener;
  attachments: AttachmentStore;
  analysis: MediaAnalysis;
  /** Thumbnail of a Space entry (`space.thumbnail`). */
  spaceThumbnails: SpaceThumbnails;
  videos: VideoService;
  /** Delete and restore videos (§5.5, §5.7). */
  videoTrash: VideoTrash;
  models: ModelJobs;
  exports: ExportService;
  library: LibraryService;
  nodes: NodeService;
  initiator: NodeInitiator;
  settings: RuntimeSettings;
  services: RuntimeServices;
  runtime: RuntimeInfo;
  /** Managed external tools (§12.9). */
  externalTools: ExternalToolService;
  /** Catalog of creation templates (template package spec §6). */
  templates: TemplateCatalog;
  /** Agent skill directory and install action (§3.8, §12.9). */
  skills: SkillCatalog;
  skillInstaller: SkillInstaller;
  /** Fonts downloaded on demand (§9.1). */
  fonts: FontService;
  /** Import and preview of code compositions (§8, `compositions.*`). A service shared with the tools. */
  compositions: CompositionService;
  /** Terminal view of the agent-side tool catalog (`catalog.*`, §3.5). Same set of tools as the tool bridge. */
  catalog: ToolCatalog;
  /** Root directory of the manual (`catalog.agentSkill` renders it for the CLI surface; same source as session guidance). When not given, it is looked up on each call. */
  agentSkillsDir?: string | null;
  /** Connection, tasks and idle exit (`runtime.status`, §2.2). */
  activity: RuntimeActivity;
  /** Where `runtime.stop` goes (the entry point stops the Runtime). Embedded Runtimes (tests) do not have it. */
  requestStop: (() => void) | null;
  /** Startup migration from old versions (§2.7): the import prompt for old-version projects (`legacyImport.*` and the `legacy-import` topic). */
  legacyUpgrade: LegacyUpgrade;
}

/** Resolves a file target to its source directory and file (a path in a Space entry, a session working directory or a project directory). Checks inside the directory are done in the media channel (or the video service). */
export function locateFileTarget(
  harness: Harness,
  space: SpaceCatalog,
  target: FileTarget,
): { root: string; file: string; scope: { projectId: Id } | { conversationId: Id } } {
  if ('entryId' in target) return space.locate(target.entryId);
  if ('conversationId' in target) {
    const { conversation } = harness.getConversation(target.conversationId);
    // A session sharing another session's working directory: its location records that session (same as AgentScope.source).
    return { root: conversation.cwd, file: target.path, scope: { conversationId: conversation.folderOf ?? conversation.id } };
  }
  const project = harness.listProjects().find((p) => p.id === target.projectId);
  if (!project) throw new RpcError('not-found', RcRuntime.projectNotFound());
  return { root: project.path, file: target.path, scope: { projectId: project.id } };
}

/**
 * videoId → the FileTarget the UI uses to open this video (same as the UI opening it from a Space entry: the project or session working directory plus relative path).
 * Opened videos are checked first, then those registered in Space. If neither has it, `not-found` (`VIDEO_NOT_FOUND`). Used when a web access link opens the editor directly.
 */
export function videoTargetOf(videos: VideoService, space: SpaceCatalog, videoId: Id): FileTarget {
  const fromSource = (source: { projectId: Id | null; conversationId: Id | null }, relPath: string): FileTarget | null =>
    source.projectId
      ? { projectId: source.projectId, path: relPath }
      : source.conversationId
        ? { conversationId: source.conversationId, path: relPath }
        : null;
  const ref = videos.ref(videoId);
  const open = ref && fromSource(ref.source, ref.relPath);
  if (open) return open;
  const known = space.videos().find((video) => video.videoId === videoId);
  if (known) {
    const entry = space.get(known.entryId);
    const target = fromSource(entry.source, entry.relPath);
    if (target) return target;
  }
  throw new RpcError('not-found', RcWeb.videoTargetNotFound({ videoId }), { code: 'VIDEO_NOT_FOUND', videoId });
}

export function createHandlers({
  harness,
  setup,
  space,
  media,
  slides,
  design,
  designSystem,
  attachments,
  analysis,
  spaceThumbnails,
  videos,
  videoTrash,
  models,
  exports,
  library,
  nodes,
  initiator,
  settings,
  services: external,
  runtime,
  externalTools,
  templates,
  skills,
  skillInstaller,
  fonts,
  compositions,
  catalog: toolCatalog,
  agentSkillsDir,
  activity,
  requestStop,
  legacyUpgrade,
}: HandlerDeps): RpcHandlers {
  const { catalog, jobs, services, pipelines } = models;
  const packages = new PackageImporter(videos);
  /** After a node or model package changes, recompute the capability view (`models` topic). A failure only affects the view, not the call. */
  const refreshModels = () => void services.refresh().catch(() => {});
  /** The authority for node services is `NodeService`. After `nodes.share.*` changes, send the projection to the `services` topic. */
  const nodeChanged = <T>(result: Promise<T>): Promise<T> => result.finally(() => external.manager.refresh('node'));
  /** Resolves a file to its source directory and file. Checks inside the directory are done in the media channel (or the video service). */
  const locateMedia = (target: FileTarget) => locateFileTarget(harness, space, target);
  /** Slide annotations sent with a message or an interjection: the deck is converted to a path relative to the session working directory (docs/design/slides §9). */
  const slideAnnotationsOf = (conversationId: Id, annotations: readonly SlideAnnotation[] | undefined) =>
    resolveSlideAnnotations(annotations, harness.getConversation(conversationId).conversation.cwd, locateMedia);
  /** Design annotations, same as above (docs/design/canvas §9). */
  const designAnnotationsOf = (conversationId: Id, annotations: readonly DesignAnnotation[] | undefined) =>
    resolveDesignAnnotations(annotations, harness.getConversation(conversationId).conversation.cwd, locateMedia);
  /** Design system annotations, same as above (docs/design/canvas §10.6). */
  const designSystemAnnotationsOf = (conversationId: Id, annotations: readonly DesignSystemAnnotation[] | undefined) =>
    resolveDesignSystemAnnotations(annotations, harness.getConversation(conversationId).conversation.cwd, locateMedia);

  /**
   * Location for a new video: the project directory. When given a session, use its source: the project it belongs to, or, if it belongs to no project, the session's working directory (architecture design §3.10; no project is created for a video).
   */
  const videoRoot = async (p: {
    projectId?: Id;
    conversationId?: Id;
  }): Promise<{ root: string; scope: { projectId: Id } | { conversationId: Id } }> => {
    if (p.projectId) {
      const project = harness.listProjects().find((x) => x.id === p.projectId);
      if (!project) throw new RpcError('not-found', RcRuntime.projectNotFound());
      return { root: project.path, scope: { projectId: project.id } };
    }
    if (p.conversationId) {
      const { conversation } = harness.getConversation(p.conversationId);
      const project = conversation.projectId ? harness.listProjects().find((x) => x.id === conversation.projectId) : undefined;
      return project
        ? { root: project.path, scope: { projectId: project.id } }
        : { root: conversation.cwd, scope: { conversationId: conversation.id } };
    }
    throw new RpcError('invalid-request', RcRuntime.newVideoNeedsTarget());
  };

  /** Root directory for project file browsing: the directory of the session's project. For a session that belongs to no project, its working directory. */
  const filesRoot = (conversationId: Id): string => {
    const { conversation } = harness.getConversation(conversationId);
    const project = conversation.projectId ? harness.listProjects().find((p) => p.id === conversation.projectId) : undefined;
    return project?.path ?? conversation.cwd;
  };
  /** Root directory and location for `projects.files.create`. A session in a project is located by its project, which is the same tab the project files tab opens. */
  const fileScope = (p: { conversationId: Id } | { projectId: Id }): { root: string; scope: ProjectFileScope } => {
    if ('projectId' in p) {
      const project = harness.listProjects().find((item) => item.id === p.projectId);
      if (!project) throw new RpcError('not-found', RcRuntime.projectFolderNotFound());
      return { root: project.path, scope: { projectId: project.id } };
    }
    const { conversation } = harness.getConversation(p.conversationId);
    const project = conversation.projectId ? harness.listProjects().find((item) => item.id === conversation.projectId) : undefined;
    return project
      ? { root: project.path, scope: { projectId: project.id } }
      : { root: conversation.cwd, scope: { conversationId: conversation.id } };
  };

  return {
    methods: {
      'runtime.info': () => runtime,
      'runtime.status': (_p, principal) => {
        if (principal.kind !== 'cli' && principal.kind !== 'desktop') throw new RpcError('forbidden', RcRuntime.statusLocalOnly());
        return activity.status();
      },
      // Stops only a Runtime launched by the CLI that no one else is using (§2.2). The desktop app, CLI connections other than the caller, and queued or running tasks all count as in use.
      // The response is sent before stopping, because the stop sequence closes the gateway.
      'runtime.stop': (_p, principal) => {
        if (principal.kind !== 'cli') throw new RpcError('forbidden', RcRuntime.stopCliOnly());
        if (runtime.launchedBy !== 'cli') {
          throw new RpcError('forbidden', RcRuntime.stopNotCliLaunched(), { code: 'RUNTIME_NOT_OWNED' });
        }
        const { connections, activeJobs } = activity.status();
        // The caller's own CLI connection does not count.
        const others = { desktop: connections.desktop, cli: Math.max(0, connections.cli - 1), activeJobs };
        if (others.desktop > 0 || others.cli > 0 || others.activeJobs > 0) {
          throw new RpcError('conflict', RcRuntime.runtimeInUse(others), { code: 'RUNTIME_IN_USE', ...others });
        }
        if (!requestStop) throw new RpcError('unsupported', RcRuntime.stopNotSupported());
        setTimeout(requestStop, 50);
        return { stopping: true as const };
      },
      'legacyImport.get': () => ({ prompt: legacyUpgrade.prompt(), run: legacyUpgrade.run() }),
      // Where to import, whether to import, and whether to retry or skip are decisions for the local user. Connections from agents and external services cannot make them on the user's behalf.
      'legacyImport.answer': async (p, principal) => {
        if (principal.kind !== 'cli' && principal.kind !== 'desktop') throw new RpcError('forbidden', RcRuntime.legacyImportLocalOnly());
        await legacyUpgrade.answer(p);
        return {};
      },
      'legacyImport.retry': async (p, principal) => {
        if (principal.kind !== 'cli' && principal.kind !== 'desktop') throw new RpcError('forbidden', RcRuntime.legacyImportLocalOnly());
        return { queued: await legacyUpgrade.retry(p.paths) };
      },
      'legacyImport.setSkipped': async (p, principal) => {
        if (principal.kind !== 'cli' && principal.kind !== 'desktop') throw new RpcError('forbidden', RcRuntime.legacyImportLocalOnly());
        return { changed: await legacyUpgrade.setSkipped(p.paths, p.skipped) };
      },
      'agents.list': () => harness.agents(),
      // “Re-detect”: force a probe (if a driverId is given, probe only that one), and return after the probe finishes (§3.11).
      'agents.detect': (p) => harness.agents({ fresh: true, ...(p.driverId ? { driverId: p.driverId } : {}) }),
      'agents.configure': (p) => harness.configureAgent(p),
      // The default agent is stored in preferences (`agent.defaultDriver`, §3.11). It is the same value as the settings page and the CLI's settings set.
      // When the setting changes, the Runtime has the Harness push `agents.updated` (see runtime.ts).
      'agents.setDefault': async (p) => {
        // Only registered Drivers are accepted. Once written to settings, an unregistered default would make every session creation fail.
        harness.assertDriverRegistered(p.driverId);
        await settings.store.set({ 'agent.defaultDriver': p.driverId });
        return harness.agents();
      },
      // ACP agents added by the user (§3.11). They are not on the Web service's allowlist, which decides which commands this machine runs.
      'agents.addProvider': (p) => harness.addProvider(p),
      'agents.removeProvider': (p) => harness.removeProvider(p.id),
      'agents.updatePreferences': (p) => harness.updateAgentPreferences(p),
      'agents.removeRule': (p) => harness.removeRule(p.rule),
      'agents.respondToApproval': (p) => harness.respondToApproval(p),
      'agents.interrupt': (p) => harness.interrupt(p.conversationId),
      'agents.runSetup': (p) => setup.run(p),
      'agents.cancelSetup': (p) => setup.cancel(p.runId),
      'agents.openTerminal': (p) => setup.openTerminal(p),
      'projects.list': () => ({ projects: harness.listProjects() }),
      'projects.open': async (p) => {
        const project = await harness.openProject(p.path);
        // Videos in the copy get new identifiers in the background (architecture design §5.1). The engine claims them again when the video is opened, and a failure here does not affect opening the project.
        void videos.claimProjectVideos(project).catch(() => {});
        return { project };
      },
      'projects.create': async (p) => ({ project: await harness.createProject(p) }),
      'projects.update': async (p) => ({ project: await harness.updateProject(p) }),
      'projects.files.list': (p) => listProjectFiles(filesRoot(p.conversationId), p),
      'projects.files.create': (p) => {
        const { root, scope } = fileScope(p);
        return createProjectFile(root, scope, p);
      },
      'conversations.list': () => harness.directorySnapshot(),
      'conversations.create': async (p) => ({ conversation: await harness.createConversation(p) }),
      'conversations.get': (p) => harness.getConversation(p.conversationId),
      'conversations.update': async (p) => ({ conversation: await harness.updateConversation(p) }),
      'conversations.markRead': (p) => ({ conversation: harness.markRead(p.conversationId) }),
      'conversations.delete': async (p) => {
        await harness.deleteConversation(p.conversationId);
        return { deleted: true as const };
      },
      // A send with a template or skill goes through `templateMethods`: resolve the template and skill first, then hand over to the Harness.
      'conversations.steer': ({ slideAnnotations, designAnnotations, designSystemAnnotations, ...p }) => {
        const resolved = slideAnnotationsOf(p.conversationId, slideAnnotations);
        const resolvedDesign = designAnnotationsOf(p.conversationId, designAnnotations);
        const resolvedSystem = designSystemAnnotationsOf(p.conversationId, designSystemAnnotations);
        return harness.steer({
          ...p,
          ...(resolved ? { slideAnnotations: resolved } : {}),
          ...(resolvedDesign ? { designAnnotations: resolvedDesign } : {}),
          ...(resolvedSystem ? { designSystemAnnotations: resolvedSystem } : {}),
        });
      },
      'attachments.prepare': (p) => attachments.prepare(p),
      'tasks.stop': (p) => harness.stopTask(p.taskId),
      // Task contract (architecture design §3.2). The parties calling via RPC are all users (UI, CLI, Web). Agents read and write their own contracts through tools.
      'tasks.create': async (p) => {
        const { taskId } = await harness.send({ ...p, text: p.goal });
        return { taskId, contract: harness.getContract(taskId).contract };
      },
      'tasks.getContract': (p) => harness.getContract(p.taskId, p.revision),
      'tasks.listContracts': (p) => harness.listContracts(p),
      'tasks.updateContract': (p) => harness.updateContract(p, 'user'),
      'tasks.changeGoal': (p) => harness.changeGoal(p),
      'tasks.recordCheck': (p) => harness.recordCheck(p, 'user'),
      'tasks.listChecks': (p) => harness.listChecks(p.taskId),
      // Unified pending approvals (architecture design §3.12). Approvals from sessions and from external services are listed and handled in one place.
      'approvals.list': () => ({ approvals: harness.approvals.pending() }),
      // An approval that carries an outbound-data grant can choose either “only this time” or issue a standing grant (§12.5).
      'approvals.respond': (p) => harness.approvals.respond(p.approvalId, p.decision, p.grant ? { grant: p.grant } : {}),
      // Outbound-data grants and budgets (§12.5, §7.8). Open only to local connections; not exposed to the browser.
      'grants.list': (p) => models.grants.list(p),
      'grants.create': (p) => models.grants.create(p),
      'grants.update': (p) => models.grants.update(p),
      'grants.revoke': (p) => models.grants.revoke(p.grantId),
      'grants.usage': (p) => models.grants.usage(p.grantId),
      'space.update': async (p, principal) => ({ entry: await updateEntry(space, videoTrash, p, principal) }),
      'space.rescan': async () => {
        await space.rescan();
        return { ok: true as const };
      },
      ...spaceMethods(space, { harness, trash: videoTrash, thumbnails: spaceThumbnails }),
      'media.resolve': async (p, principal) => {
        if ('localPath' in p) {
          // Local files on the desktop (§4.5). Only for the desktop client, rooted at the file's own directory, and only regular files. The browser and external services are refused under their existing access scope.
          if (principal.kind !== 'desktop') throw new RpcError('forbidden', RcRuntime.onlyWorkingFolderFiles());
          if (!path.isAbsolute(p.localPath)) throw new RpcError('not-found', RcRuntime.fileNotFound());
          return media.issue(path.dirname(p.localPath), p.localPath);
        }
        if ('videoId' in p) {
          const asset = await videos.assetFile(p.videoId, p.assetId, p.revision);
          return { ...(await media.issue(asset.root, asset.file)), fileName: asset.name };
        }
        if ('attachmentId' in p) {
          // Only attachments that appeared in this session's own messages are accepted. Attachments from other sessions, or ones not yet sent, are treated as nonexistent.
          const { items } = harness.getConversation(p.conversationId);
          const ref = items
            .flatMap((item) => (item.kind === 'user-message' ? (item.attachments ?? []) : []))
            .find((a) => a.id === p.attachmentId);
          if (!ref) throw new RpcError('not-found', RcRuntime.attachmentNotFound());
          const { root, file } = attachments.fileOf(ref);
          return { ...(await media.issue(root, file)), fileName: ref.fileName };
        }
        if ('entryId' in p && space.get(p.entryId).kind === 'video') {
          // A video entry is a directory. Its primary material (the material version holding the cover frame) is provided so the video card in the session can play in place (product design §3.2.2).
          const { root, file } = await spaceThumbnails.videoSource(p.entryId);
          return { ...(await media.issue(root, file)), fileName: space.get(p.entryId).name };
        }
        const { root, file } = 'entryId' in p ? space.locateBytes(p.entryId) : locateMedia(p);
        return media.issue(root, file);
      },
      'media.playback': (p) => media.playback(p.url, (file) => analysis.playback(file, p.playable)),
      // Fonts (§9.1): local, the download cache, and on-demand downloads.
      ...fontMethods(
        () => fonts,
        media,
        () => exports,
      ),
      'media.subtitles': async (p) => {
        const { root, file, scope } = locateMedia(p);
        const found = await findSubtitles(root, file);
        return { tracks: found.map(({ relPath, ...track }) => ({ ...track, target: { ...scope, path: relPath } })) };
      },
      'media.peaks': async (p) => analysis.peaks(await videos.mediaSource(p.videoId, p.assetId, p.revision)),
      'media.thumbnail': async (p) => analysis.thumbnail(await videos.mediaSource(p.videoId, p.assetId, p.revision), p.at),
      'videos.create': async (p, principal) => {
        const { root, scope } = await videoRoot(p);
        return videos.create(p, root, scope, principal);
      },
      // Derive child videos (§3.5). Same service as the videos_derive tool.
      'videos.derive': async (p, principal) =>
        (await deriveVideo({ videos, findDerived: spaceDerivedFinder(space) }, p, principal)).result,
      // Shot cuts (§3.5). Same implementation as the videos_shots tool.
      'videos.shots': (p) => videoShots({ analysis, videos }, p),
      // Portable package (video format spec §8). Built as a new video in the source directory. Not offered to agents or external services, since they have no entry point for this method.
      'videos.importPackage': async (p, principal) => {
        const { root, scope } = await videoRoot(p);
        return packages.import(p, root, scope, principal);
      },
      'slides.open': async (p) => {
        // Space entries give absolute paths. The rest are paths relative to the source directory.
        const { root, file } = locateMedia(p);
        return slides.open(root, path.isAbsolute(file) ? path.relative(root, file) : file);
      },
      'design.open': async (p) => {
        // Same as slides.open (docs/design/canvas §6.1).
        const { root, file } = locateMedia(p);
        return design.open(root, path.isAbsolute(file) ? path.relative(root, file) : file);
      },
      'designSystem.open': async (p) => {
        // Same as design.open (docs/design/canvas §10.4).
        const { root, file } = locateMedia(p);
        return designSystem.open(root, path.isAbsolute(file) ? path.relative(root, file) : file);
      },
      'videos.open': (p, principal) => videos.open(locateMedia(p), principal),
      'videos.close': (p, principal) => videos.close(p.videoId, principal),
      'videos.delete': (p, principal) => videoTrash.delete(p, principal),
      'videos.restore': (p) => videoTrash.restore(p.entryId),
      'videos.history': (p) => videos.history(p.videoId, p.limit),
      'videos.assetStatus': (p) => videos.assetStatus(p.videoId),
      'documents.read': (p) => videos.document(p.videoId, p.documentId, p.revision),
      'edits.apply': (p, principal) => videos.apply(p, principal),
      'edits.undo': (p, principal) => videos.undo(p, principal),
      'edits.undoState': (p, principal) => videos.undoState(p.videoId, principal),
      'edits.applySpeakers': (p, principal) => applySpeakerProposal({ videos, jobs }, p, principal),
      // Code compositions (§8). The UI does not go through agent preview and import. Same service as the compositions_preview and compositions_import tools.
      ...compositionMethods({ compositions, videos, harness, media }),
      'models.list': async () => ({ bundles: await catalog.list() }),
      // When no glossary is given explicitly, use the transcription glossary enabled in the video (§5.9). External service clients do not touch the user's library.
      'models.transcribe': async (p, principal) => {
        const enabled =
          p.glossaries || principal.kind === 'service' ? null : (await library.enabledGlossaries(p.videoId, 'transcribe')).ids;
        const params = enabled?.length ? { ...p, glossaries: enabled.map((id) => ({ id })) } : p;
        return jobs.submitTranscribe(params, { kind: 'connection', id: principal.connectionId });
      },
      // Space entries as material (§7.9): converted to text here, so the task sees only text.
      'models.synthesizeSpeech': async (p, principal) =>
        jobs.submitSynthesizeSpeech(await withSpeechMaterial(space, p), { kind: 'connection', id: principal.connectionId }),
      'models.generateImage': (p, principal) => jobs.submitGenerateImage(p, { kind: 'connection', id: principal.connectionId }),
      'models.generateMusic': (p, principal) => jobs.submitGenerateMusic(p, { kind: 'connection', id: principal.connectionId }),
      'models.generateText': async (p, principal) =>
        jobs.submitGenerateText(await withTextMaterial(space, p), { kind: 'connection', id: principal.connectionId }),
      'models.refreshProvider': (p) => services.refreshProvider(p.providerId),
      'models.setCapabilityParameters': async (p) => ({ parameters: await services.setCapabilityParameters(p) }),
      'models.enable': async (p) => {
        jobs.enable(p.bundleId);
        refreshModels();
        return { bundle: (await catalog.status(p.bundleId))! };
      },
      // Install management for local model packs (§6.3). Installation and self-check are ordinary Jobs that belong to no agent task.
      'models.install': (p, principal) => models.installs.install(p, { kind: 'connection', id: principal.connectionId }),
      'models.repair': (p, principal) => models.installs.install(p, { kind: 'connection', id: principal.connectionId }, { repair: true }),
      'models.cancelInstall': (p) => models.installs.cancelInstall(p),
      'models.remove': (p) => models.installs.remove(p.bundleId),
      'models.test': (p, principal) => models.installs.test(p, { kind: 'connection', id: principal.connectionId }),
      // Model catalog (§6.3). Contains local paths, so it is given only to the desktop UI and the CLI (not on the Web allowlist, and MCP does not offer it).
      'models.getDir': () => models.dir.getDir(),
      'models.inspectDir': (p) => models.dir.inspect(p.path),
      'models.setDir': (p, principal) => models.dir.setDir(p, { kind: 'connection', id: principal.connectionId }),
      'models.capabilities': async () => ({ capabilities: await services.capabilities() }),
      'models.configure': async (p) => ({ provider: await services.configure(p) }),
      'models.removeProvider': async (p) => {
        await services.removeProvider(p.providerId);
        return { removed: true };
      },
      // Provider accounts (§6.8). All of them return this Provider's view. Changes are delivered through `capabilities.updated`.
      'models.addAccount': async (p) => ({ provider: await services.addAccount(p) }),
      'models.updateAccount': async (p) => ({ provider: await services.updateAccount(p) }),
      'models.removeAccount': async (p) => ({ provider: await services.removeAccount(p.providerId, p.accountId) }),
      'models.arrangeAccounts': async (p) => ({ provider: await services.arrangeAccounts(p) }),
      // Usage (§6.10). Read-only.
      'models.usage': (p) => services.usage(p),
      'models.setDefault': async (p) => ({ default: await services.setDefault(p.capability, p.providerId, p.modelId) }),
      // Steps of a fixed pipeline are folded under the parent task by default (architecture design §7.9).
      'jobs.list': (p) => ({ jobs: jobs.list(p.videoId).filter((r) => p.children === true || !r.parentJobId) }),
      'jobs.inspect': (p) => jobs.inspect(p.jobId),
      // Current state of resource scheduling (architecture design §7.6, §7.7). Read-only.
      'jobs.resources': () => jobs.resources.snapshot(),
      'jobs.cancel': (p) => jobs.cancel(p.jobId),
      // Reconciliation (architecture design §7.5). A retry is a new call and is admitted again through grants and budget. Agents and MCP services have no entry point for it.
      'jobs.reconcile': (p) => jobs.reconcile(p.jobId, p.decision),
      // Export: freezing and preflight complete synchronously. On failure, no task is created. Progress, cancellation and results go through jobs.* (architecture design §9.11).
      'exports.create': (p, principal) => exports.create(p, { kind: 'connection', id: principal.connectionId }),
      'exports.get': (p) => exports.get(p.jobId),
      'exports.list': (p) => ({ jobs: exports.list(p.videoId) }),
      // Read-only. Uses the same freezing and serialization as exports.create to produce the body, without writing a file or creating a task.
      'exports.renderText': (p) => exports.renderText(p),
      'pipelines.list': () => ({ pipelines: pipelines.list() }),
      // Space entries as input (§7.9). File entries are converted to paths at submission, so the frozen parameters contain only paths.
      'pipelines.start': (p, principal) =>
        pipelines.start(
          { ...p, params: resolvePipelineEntryInputs(space, p.pipeline, p.params) },
          { kind: 'connection', id: principal.connectionId },
        ),
      'pipelines.retry': (p) => pipelines.retry(p.jobId),
      ...externalToolMethods(() => externalTools),
      ...templateMethods({ templates, media, harness, skills, slideAnnotationsOf, designAnnotationsOf, designSystemAnnotationsOf }),
      ...skillMethods({ skills, installer: skillInstaller }),
      ...catalogMethods(toolCatalog, agentSkillsDir === undefined ? {} : { agentSkillsDir: () => agentSkillsDir }),
      ...toolCatalogueMethods({
        space,
        services,
        externalTools: () => externalTools,
        offlineStrict: () => settings.store.get('offline.strict'),
        saveDirectory: () => resolveSaveDirectory({ settings: settings.store.get('downloads.directory') }),
      }),
      // Short-lived read handles for outputs (raw transcription results, generated audio and images). Read-only over files in the output library.
      'artifacts.openHandle': async (p) => {
        const file = await jobs.artifacts.locate(p.artifactId);
        if (!file) throw new RpcError('not-found', RcRuntime.outputNotFound());
        return media.issue(jobs.artifacts.dir, path.basename(file));
      },
      // User library (architecture design §5.9). Read and written only through the Runtime.
      'library.list': (p) => library.list(p),
      'library.get': (p) => library.get(p),
      'library.put': (p) => library.put(p),
      'library.remove': (p) => library.remove(p),
      'library.import': (p) => library.import(p),
      'library.export': (p) => library.export(p),
      'library.applyToVideo': (p, principal) => library.applyToVideo(p, principal),
      'library.getVideoSelection': (p) => library.getVideoSelection(p),
      'library.setVideoSelection': (p, principal) => library.setVideoSelection(p, principal),
      'library.openHandle': (p) => library.openHandle(p),
      // Voice cloning (§5.9). Creation is an ordinary task. Deletion requests the remote side first.
      'library.createVoiceClone': (p, principal) => library.voiceClones.create(p, { kind: 'connection', id: principal.connectionId }),
      'library.removeVoiceClone': (p) => library.voiceClones.remove(p),
      'nodes.share.start': (p) => nodeChanged(nodes.start(p)),
      'nodes.share.stop': () => nodeChanged(nodes.stop()),
      'nodes.share.status': () => nodes.status(),
      'nodes.share.pairingCode': () => nodes.pairingCode(),
      'nodes.share.revoke': (p) => nodes.revoke(p.clientId),
      'nodes.share.setCapability': (p) => nodes.setCapability(p.capability, p.enabled),
      // Discovery results exclude this machine's own node.
      'nodes.discover': async (p) => ({ nodes: await initiator.discover(p.timeoutMs, nodes.status().nodeId) }),
      'nodes.pair': async (p) => {
        const node = await initiator.pair(p);
        refreshModels();
        return { node };
      },
      'nodes.list': async () => ({ nodes: await initiator.list() }),
      'settings.get': (p) => settings.store.view(p.keys),
      'settings.set': async (p) => {
        // Keys that have dedicated methods (the model catalog) are not changed through here. First check whether they are in use, unload the Worker, and choose between moving or only swapping the location (§6.3).
        for (const [key, method] of Object.entries(SETTING_MANAGED_BY)) {
          if (p.values && key in p.values) {
            throw new RpcError('invalid-request', RcRuntime.settingManaged({ key, method }), { code: 'SETTING_MANAGED', key, method });
          }
        }
        return (await settings.store.set(p.values)).snapshot;
      },
      'services.list': () => ({ services: external.manager.list() }),
      'services.start': async (p) => ({ service: await external.manager.start(p.serviceId) }),
      'services.stop': async (p) => ({ service: await external.manager.stop(p.serviceId) }),
      'services.configure': async (p) => ({ service: await external.manager.configure(p) }),
      'services.respondToApproval': (p) => external.manager.approvals.respond(p.approvalId, p.decision),
      'services.mcp.createClient': (p) => external.mcp.createClient(p.name),
      'services.mcp.listClients': () => ({ clients: external.mcp.listClients() }),
      'services.mcp.revokeClient': async (p) => ({ clients: await external.mcp.revokeClient(p.clientId) }),
      'services.mcp.connectionInfo': (p) => external.mcp.connectionInfo(p.clientId),
      'services.modelApi.createClient': (p) => external.modelApi.createClient(p.name),
      'services.modelApi.listClients': () => ({ clients: external.modelApi.listClients() }),
      'services.modelApi.revokeClient': async (p) => ({ clients: await external.modelApi.revokeClient(p.clientId) }),
      'services.modelApi.connectionInfo': (p) => external.modelApi.connectionInfo(p.clientId),
      'services.modelApi.setAlias': async (p) => ({
        aliases: await external.modelApi.setAlias({
          alias: p.alias,
          capability: p.capability,
          providerId: p.providerId,
          modelId: p.modelId ?? null,
        }),
      }),
      'services.modelApi.removeAlias': async (p) => ({ aliases: await external.modelApi.removeAlias(p.alias) }),
      'services.web.createAccessLink': (p) =>
        external.web.createAccessLink(p.video === undefined ? undefined : webVideoHref(videoTargetOf(videos, space, p.video))),
      'services.web.listSessions': () => ({ sessions: external.web.listSessions() }),
      'services.web.revokeSession': (p) => ({ sessions: external.web.revokeSession(p.sessionId) }),
      'nodes.remove': async (p) => {
        await initiator.remove(p.nodeId);
        refreshModels();
        return {};
      },
    },
    subscribe: (topic, afterSeq, listener) => {
      if (topic === 'space') return space.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'jobs') return models.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'models') return models.modelsTopic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'settings') return settings.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'services') return external.manager.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'library') return library.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'grants') return models.grants.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'agent-setup') return setup.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      if (topic === 'legacy-import') return legacyUpgrade.topic.subscribe(afterSeq, listener) as TopicSubscription<unknown, unknown>;
      const videoId = parseVideoTopic(topic);
      if (videoId) return videos.subscribe(videoId, afterSeq, listener);
      return harness.subscribe(topic, afterSeq, listener);
    },
  };
}

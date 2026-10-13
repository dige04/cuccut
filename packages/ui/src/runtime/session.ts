import {attachmentUploadMime} from '@cuccut/protocol';
import { CucCutClient } from '@cuccut/client';
import { preparePlaybackMedia } from './media-playback.ts';
import {
  RUNTIME_VERSION,
  newId,
  type AgentMode,
  type ApprovalDecision,
  type AttachmentRef,
  type Conversation,
  type DriverId,
  type EditorContext,
  type ExportCreateRequest,
  type FileTarget,
  type Id,
  type JobReconcileDecision,
  type JobRecord,
  type MediaHandle,
  type MediaTarget,
  type Project,
  type SpaceEntry,
  type SubtitleTrack,
  type SkillSendRef,
  type SlideAnnotation,
  type DesignAnnotation,
  type DesignSystemAnnotation,
  type TemplateSendRef,
} from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import type { HostBridge } from '../host.ts';
import { importAndPlace } from '../model/editor-ops.ts';
import { insertVisual, type VisualLayer } from '../model/new-items.ts';
import { useConnection } from '../state/connection-store.ts';
import { useDirectory } from '../state/directory-store.ts';
import { useGrants } from '../state/grants-store.ts';
import { useJobs } from '../state/jobs-store.ts';
import { libraryFeed } from '../state/library-feed.ts';
import { useModels } from '../state/models-store.ts';
import { useSettings } from '../state/settings-store.ts';
import { useSpace } from '../state/space-store.ts';
import { useTasks } from '../state/tasks-store.ts';
import { useTimeline } from '../state/timeline-store.ts';
import { putAttachment } from './attachment-upload.ts';
import { RT } from './runtime-copy.ts';
import { SpaceThumbnailCache } from './space-thumbnails.ts';
import { VideoController, targetOf, transactionLabel } from './video-controller.ts';

/**
 * The only channel between the UI and the Runtime: feeds subscriptions into the Zustand mirror, and turns user actions into public commands.
 * Components do not touch the WebSocket directly, and do not change business state locally (architecture design §11.1).
 */
export class RuntimeSession {
  readonly client: CucCutClient;
  readonly host: HostBridge;
  /** The video open in the editor. */
  readonly videos: VideoController;
  /** Thumbnails for the Space grid and list (`space.thumbnail`). */
  readonly spaceThumbnails: SpaceThumbnailCache;
  readonly #watchers = new Map<Id, { count: number; unsubscribe: () => void }>();
  #disposers: (() => void)[] = [];

  constructor(host: HostBridge) {
    this.host = host;
    this.client = new CucCutClient({
      resolve: () => host.getConnection(),
      client: { kind: 'desktop', name: 'cuccut-desktop', version: RUNTIME_VERSION },
    });
    this.videos = new VideoController(this.client);
    this.spaceThumbnails = new SpaceThumbnailCache((entryId) => this.spaceThumbnail(entryId));
  }

  start(): void {
    this.#disposers.push(
      this.client.onState((state) => {
        useConnection.getState().setState(state);
        this.videos.onConnection(state);
        if (state.status === 'connected') this.spaceThumbnails.revive();
      }),
      // Agent list and preferences: the snapshot first gives the last probe result (the Runtime stores it on disk); background refreshes, corrections and preference changes all push a whole new view.
      // After a dropped connection reconnects, the client subscribes again and fetches the snapshot again.
      this.client.subscribeAgents({
        snapshot: (view) => useConnection.getState().setAgents(view),
        event: (event) => useConnection.getState().setAgents(event.view),
      }),
      // When the user goes to the terminal to log in or install an Agent and comes back: when the window regains focus, `agents.list` is fetched once, and the Runtime uses it to make a cheap correction to the cached “unavailable” Driver state (architecture design §3.11). The result is pushed through the topic, so no return value is used here.
      this.#onWindowFocus(() => {
        if (useConnection.getState().state.status !== 'connected') return;
        void this.client.request('agents.list', {}).catch(() => {});
      }),
      this.client.subscribeDirectory({
        snapshot: (snapshot) => useDirectory.getState().replace(snapshot),
        event: (event) => useDirectory.getState().apply(event),
      }),
      this.client.subscribeTasks({
        snapshot: (snapshot) => useTasks.getState().replace(snapshot),
        event: (event) => useTasks.getState().apply(event),
      }),
      this.client.subscribeSpace({
        snapshot: (snapshot) => useSpace.getState().replace(snapshot),
        event: (event) => useSpace.getState().apply(event),
      }),
      this.client.subscribeJobs({
        snapshot: (snapshot) => useJobs.getState().replace(snapshot),
        event: (event) => useJobs.getState().apply(event),
      }),
      this.client.subscribeModels({
        snapshot: (snapshot) => useModels.getState().replace(snapshot),
        event: (event) => useModels.getState().apply(event),
      }),
      this.client.subscribeSettings({
        snapshot: (snapshot) => useSettings.getState().replace(snapshot),
        event: (event) => useSettings.getState().apply(event),
      }),
      // The user library subscribes just once: each library's mirror is registered in library-feed (subscribing to the same topic again would replace this one subscription).
      this.client.subscribe<import('@cuccut/protocol').LibrarySnapshot, import('@cuccut/protocol').LibraryEvent>('library', libraryFeed),
      this.client.subscribe<import('@cuccut/protocol').GrantsSnapshot, import('@cuccut/protocol').GrantsEvent>('grants', {
        snapshot: (snapshot) => useGrants.getState().replace(snapshot),
        event: (event) => useGrants.getState().apply(event),
      }),
    );
    void this.client.connect().catch(() => {});
  }

  #onWindowFocus(handler: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }

  dispose(): void {
    this.videos.close();
    this.spaceThumbnails.clear();
    for (const dispose of this.#disposers) dispose();
    for (const watcher of this.#watchers.values()) watcher.unsubscribe();
    this.#watchers.clear();
    this.client.close();
  }

  /** Open a content subscription for a session; reference-counted, unsubscribed when the last user leaves. */
  watchConversation(id: Id): () => void {
    let watcher = this.#watchers.get(id);
    if (!watcher) {
      const unsubscribe = this.client.subscribeConversation(id, {
        snapshot: (snapshot) => useTimeline.getState().replace(id, snapshot),
        event: (event) => useTimeline.getState().apply(id, event),
      });
      watcher = { count: 0, unsubscribe };
      this.#watchers.set(id, watcher);
    }
    watcher.count++;
    return () => {
      const current = this.#watchers.get(id);
      if (!current || --current.count > 0) return;
      current.unsubscribe();
      this.#watchers.delete(id);
    };
  }

  // ---- Commands ----

  /**
   * Fields not given use the preferences the Runtime remembers: the last access mode, the default Agent and its default model and reasoning effort. `folderOf`: shares the working directory with that project-less session (a new session opened for a video that does not belong to a project, architecture design §3.10).
   */
  async createConversation(
    projectId: Id | null,
    options: { accessMode?: AgentMode; driverId?: DriverId; model?: string | null; effort?: string | null; folderOf?: Id } = {},
  ): Promise<Conversation> {
    const { conversation } = await this.client.request('conversations.create', { projectId, commandId: newId('cmd'), ...options });
    return conversation;
  }

  /**
   * `context`: the editor's state at the time (open video, version, selection, playhead), handed to the agent with the message.
   * `attachments`: images already uploaded (the ids returned by `uploadAttachment`).
   * `template`: the attached scene template (template pack spec §5.2); the Runtime uses it to build the agent's briefing guidance and template body; `text` remains the user's own words.
   * `skills`: skills picked from the input box's “+ › Use Skill” menu (product design §6.9), in the order attached; the Runtime attaches each one's `SKILL.md` body for the agent,
   * with a marker added to the message. Omitted when empty.
   * `slideAnnotations`: annotations added to the conversation from the slide tags (docs/design/slides §8.2, §9); the Runtime builds them into paragraphs for the agent, per deck. Omitted when empty.
   * `designAnnotations`: annotations added to the conversation from the design-canvas tags (docs/design/canvas §8.2, §9); same as above, built into paragraphs per design. Omitted when empty.
   * `designSystemAnnotations`: annotations added to the conversation from the design-system tags (docs/design/canvas §10.6); same as above, built into paragraphs per design system. Omitted when empty.
   */
  async send(
    conversationId: Id,
    text: string,
    context?: EditorContext,
    attachments?: Id[],
    template?: TemplateSendRef,
    skills?: readonly SkillSendRef[],
    slideAnnotations?: readonly SlideAnnotation[],
    designAnnotations?: readonly DesignAnnotation[],
    designSystemAnnotations?: readonly DesignSystemAnnotation[],
  ): Promise<Id> {
    const { taskId } = await this.client.request('conversations.send', {
      conversationId,
      text,
      commandId: newId('cmd'),
      ...(context ? { context } : {}),
      ...(attachments?.length ? { attachments } : {}),
      ...(template ? { template } : {}),
      ...(skills?.length ? { skills: skills.map((s) => ({ id: s.id })) } : {}),
      ...(slideAnnotations?.length ? { slideAnnotations: [...slideAnnotations] } : {}),
      ...(designAnnotations?.length ? { designAnnotations: [...designAnnotations] } : {}),
      ...(designSystemAnnotations?.length ? { designSystemAnnotations: [...designSystemAnnotations] } : {}),
    });
    return taskId;
  }

  /** Interject into the running turn; if the Agent does not support it, or no turn is running any more, report that honestly and let the caller decide whether to queue or send directly. */
  async steer(
    conversationId: Id,
    text: string,
    attachments?: Id[],
    slideAnnotations?: readonly SlideAnnotation[],
    designAnnotations?: readonly DesignAnnotation[],
    designSystemAnnotations?: readonly DesignSystemAnnotation[],
  ): Promise<'steered' | 'unsupported' | 'no-active-turn'> {
    const { status } = await this.client.request('conversations.steer', {
      conversationId,
      text,
      commandId: newId('cmd'),
      ...(attachments?.length ? { attachments } : {}),
      ...(slideAnnotations?.length ? { slideAnnotations: [...slideAnnotations] } : {}),
      ...(designAnnotations?.length ? { designAnnotations: [...designAnnotations] } : {}),
      ...(designSystemAnnotations?.length ? { designSystemAnnotations: [...designSystemAnnotations] } : {}),
    });
    return status;
  }

  /** Upload one image to be sent with a message: first register to get a one-time address, then PUT the raw bytes (Content-Type matches the registration). */
  async uploadAttachment(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<AttachmentRef> {
    const { attachment, uploadUrl } = await this.client.request('attachments.prepare', {
      fileName: file.name || 'image',
      mimeType: attachmentUploadMime(file.type),
      size: file.size,
    });
    await putAttachment(uploadUrl, file, attachment.mimeType, onProgress, signal);
    return attachment;
  }

  async stop(taskId: Id): Promise<void> {
    await this.client.request('tasks.stop', { taskId });
  }

  async interrupt(conversationId: Id): Promise<void> {
    await this.client.request('agents.interrupt', { conversationId });
  }

  async respondToApproval(conversationId: Id, approvalId: Id, decision: ApprovalDecision): Promise<void> {
    await this.client.request('agents.respondToApproval', { conversationId, approvalId, decision });
  }

  /** Let the user pick a folder and register it as a project; returns null if cancelled. */
  async openProjectFromDialog(): Promise<Project | null> {
    const dir = await this.host.pickDirectory();
    if (!dir) return null;
    const { project } = await this.client.request('projects.open', { path: dir });
    return project;
  }

  /** Create a new project: makes a new folder inside the project directory (product design §3.1). */
  async createProject(name: string): Promise<Project> {
    const { project } = await this.client.request('projects.create', { name: name.trim() || undefined, commandId: newId('cmd') });
    return project;
  }

  async updateProject(projectId: Id, patch: { name?: string; pinned?: boolean; archived?: boolean }): Promise<Project> {
    const { project } = await this.client.request('projects.update', { projectId, ...patch });
    return project;
  }

  async updateConversation(
    conversationId: Id,
    patch: {
      title?: string;
      pinned?: boolean;
      archived?: boolean;
      accessMode?: AgentMode;
      driverId?: DriverId;
      model?: string | null;
      effort?: string | null;
    },
  ): Promise<void> {
    await this.client.request('conversations.update', { conversationId, ...patch });
  }

  async markRead(conversationId: Id): Promise<void> {
    await this.client.request('conversations.markRead', { conversationId });
  }

  async updateSpaceEntry(entryId: Id, patch: { favorite?: boolean; displayName?: string | null; trashed?: boolean }): Promise<SpaceEntry> {
    const { entry } = await this.client.request('space.update', { entryId, ...patch });
    return entry;
  }

  async rescanSpace(): Promise<void> {
    await this.client.request('space.rescan', {});
  }

  /** Media address (architecture design §4.5): a restricted handle with an expiry, pointing only at this one file. */
  async resolveMedia(target: MediaTarget): Promise<MediaHandle> {
    return this.client.request('media.resolve', target);
  }

  playbackMedia(handle: MediaHandle, signal?: AbortSignal): Promise<MediaHandle> {
    return preparePlaybackMedia(this.client, handle, signal);
  }

  /** Subtitle file in the same directory as the video. */
  async listSubtitles(target: FileTarget): Promise<SubtitleTrack[]> {
    const { tracks } = await this.client.request('media.subtitles', target);
    return tracks;
  }

  async deleteConversation(conversationId: Id): Promise<void> {
    await this.client.request('conversations.delete', { conversationId });
  }

  /** Cancel a Job (transcription, dubbing, generation). For a job that has already ended, report its final state honestly; no error. */
  async cancelJob(jobId: Id): Promise<void> {
    await this.client.request('jobs.cancel', { jobId });
  }

  /** Handle tasks after a restart whose result is unknown, that were interrupted, or whose output was never written into the video (architecture design §7.5). Only the user decides; the agent cannot call it. */
  async reconcileJob(jobId: Id, decision: JobReconcileDecision): Promise<void> {
    await this.client.request('jobs.reconcile', { jobId, decision });
  }

  /** Restricted address of an output (architecture design §4.5): has an expiry, and points only at this one output. */
  async openArtifact(artifactId: string): Promise<MediaHandle> {
    return this.client.request('artifacts.openHandle', { artifactId });
  }

  /**
   * Project file browsing (architecture design §11.2): one level inside the session's project directory (the session working directory when there is no project), or, when `query` is given, a lookup by name.
   * File contents go through `resolveMedia({ conversationId, path })`.
   */
  async listProjectFiles(params: {
    conversationId: Id;
    dir?: string;
    query?: string;
    limit?: number;
  }): Promise<import('@cuccut/protocol').ProjectFilesList> {
    return this.client.request('projects.files.list', params);
  }

  /**
   * Exclusively create a new text file in the project directory (the session working directory when there is no project); a duplicate name automatically gets a number suffix (the “New web page” on the new-tab start page).
   * Returns the new file's location (handed to the file tab) and its entry.
   */
  async createProjectFile(
    params: ({ conversationId: Id } | { projectId: Id }) & { name: string; content: string; dir?: string },
  ): Promise<import('@cuccut/protocol').RpcResult<'projects.files.create'>> {
    return this.client.request('projects.files.create', params);
  }

  // ---- Models page (architecture design §6): new views all reach `useModels` through the `models` topic; nothing is written separately here ----

  /** Set or clear (`providerId: null`) the default model for one capability. */
  async setModelDefault(
    capability: import('@cuccut/protocol').ModelServiceCapability,
    providerId: string | null,
    modelId?: string,
  ): Promise<import('@cuccut/protocol').ModelRef | null> {
    const { default: ref } = await this.client.request('models.setDefault', { capability, providerId, ...(modelId ? { modelId } : {}) });
    return ref;
  }

  /** Set the default parameters for text generation (reasoning effort, concurrency limit): given fields replace the current values, null restores factory values, and omitted fields stay unchanged. Returns the completed values. */
  async setCapabilityParameters(
    request: import('@cuccut/protocol').SetCapabilityParametersRequest,
  ): Promise<import('@cuccut/protocol').TextCapabilityParameters> {
    const { parameters } = await this.client.request('models.setCapabilityParameters', request);
    return parameters;
  }

  /** Configure an online provider (connection, key change, declared models). If `verify` fails, the Runtime rejects with `conflict` and does not save. */
  async configureModelProvider(
    request: import('@cuccut/protocol').ConfigureProviderRequest,
  ): Promise<import('@cuccut/protocol').ProviderView> {
    const { provider } = await this.client.request('models.configure', request);
    return provider;
  }

  /** Delete a self-built provider and its key. */
  async removeModelProvider(providerId: string): Promise<void> {
    await this.client.request('models.removeProvider', { providerId });
  }

  /** Fetch the model and voice lists from an online provider (`models.refreshProvider`). If they cannot be fetched, `ok: false`, and the result is also recorded in its configuration. */
  async refreshModelProvider(providerId: string): Promise<import('@cuccut/protocol').ProviderRefreshStatus> {
    const { refreshed } = await this.client.request('models.refreshProvider', { providerId });
    return refreshed;
  }

  /** The model bundles on this machine and their status. */
  async listModelBundles(): Promise<import('@cuccut/protocol').ModelBundleStatus[]> {
    const { bundles } = await this.client.request('models.list', {});
    return bundles;
  }

  /** Re-enable a model bundle that was disabled or failed to load. */
  async enableModelBundle(bundleId: string): Promise<import('@cuccut/protocol').ModelBundleStatus> {
    const { bundle } = await this.client.request('models.enable', { bundleId });
    return bundle;
  }

  /** Synthesize a speech clip; returns a task ID; progress and results arrive through the `jobs` topic. */
  async synthesizeSpeech(request: Omit<import('@cuccut/protocol').SynthesizeSpeechRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('models.synthesizeSpeech', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /** Generate an image; returns a task ID; progress and results arrive through the `jobs` topic. */
  async generateImage(request: Omit<import('@cuccut/protocol').GenerateImageRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('models.generateImage', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /** Generate a piece of music; returns a task ID; progress and results arrive through the `jobs` topic. */
  async generateMusic(request: Omit<import('@cuccut/protocol').GenerateMusicRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('models.generateMusic', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /** Call a text model once; returns a task ID; the full text is an output in the result; progress and results arrive through the `jobs` topic. */
  async generateText(request: Omit<import('@cuccut/protocol').GenerateTextRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('models.generateText', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /**
   * Start a fixed pipeline (`pipelines.start`); returns the parent task ID; progress and results of each step arrive through the `jobs` topic. The Runtime validates and freezes the parameters;
   * if they are invalid, the input does not exist, or the execution tool is unavailable, the call is rejected directly (no task is created).
   */
  async startPipeline(pipeline: string, params: Record<string, unknown>): Promise<Id> {
    const { jobId } = await this.client.request('pipelines.start', { pipeline, params, commandId: newId('cmd') });
    return jobId;
  }

  /** Detect an external tool (`externalTools.detect`; only runs `--version` locally, no network access); null if it is not in the registry. */
  async detectExternalTool(name: string): Promise<import('@cuccut/protocol').ExternalToolStatus | null> {
    const { tools } = await this.client.request('externalTools.detect', { name });
    return tools.find((t) => t.name === name) ?? null;
  }

  /**
   * Which browsers on this machine have a cookie store (`externalTools.cookieBrowsers`; it only checks whether the files exist and when they were last modified, and does not read cookies), most recently used first;
   * `platform` is the platform of the host the Runtime runs on; the system authorization prompt depends on it.
   */
  async cookieBrowsers(): Promise<{ platform: string; browsers: import('@cuccut/protocol').CookieBrowserInfo[] }> {
    return this.client.request('externalTools.cookieBrowsers', {});
  }

  // ---- Remote compute (node protocol spec §10): share this Mac and use other computers. There is no subscription topic; the services page polls status on demand. ----

  async shareStatus(): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.status', {});
  }

  /** Turn on sharing and listen; if the port is in use, it still returns normally, with `listening` false and `error` giving the reason. Each time sharing is turned on, a new pairing code is generated. */
  async startShare(params: import('@cuccut/protocol').ShareStartParams = {}): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.start', params);
  }

  async stopShare(): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.stop', {});
  }

  /** Invalidate the old pairing code, generate a new one, and lift the pairing lock; `conflict` when sharing is off. */
  async renewPairingCode(): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.pairingCode', {});
  }

  async revokeShareClient(clientId: string): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.revoke', { clientId });
  }

  async setShareCapability(capability: string, enabled: boolean): Promise<import('@cuccut/protocol').ShareStatus> {
    return this.client.request('nodes.share.setCapability', { capability, enabled });
  }

  /**
   * Import prompts for legacy projects and the imports during this launch (architecture design §2.7): only the desktop UI subscribes; the Web service does not expose this topic. Each change gives the full state.
   * After a dropped connection reconnects, the client subscribes again and fetches the snapshot again; when the Runtime is replaced (restarted), the identifiers of the prompts and imports change with it. A topic has only one subscriber (a later subscriber replaces the earlier one).
   */
  watchLegacyImport(onChange: (state: import('@cuccut/protocol').LegacyImportSnapshot) => void): () => void {
    let state: import('@cuccut/protocol').LegacyImportSnapshot = { prompt: null, run: null };
    return this.client.subscribeLegacyImport({
      snapshot: (snapshot) => onChange((state = { prompt: snapshot.prompt, run: snapshot.run ?? null })),
      event: (event) => onChange((state = event.type === 'prompt.updated' ? { ...state, prompt: event.prompt } : { ...state, run: event.run })),
    });
  }

  async answerLegacyImport(answer: import('@cuccut/protocol').LegacyImportAnswer): Promise<void> {
    await this.client.request('legacyImport.answer', answer);
  }

  /** Retry legacy projects not yet imported (when `paths` is omitted, all not-yet-imported ones); named skipped items are changed to imports. Returns the number re-queued. */
  async retryLegacyImport(paths?: string[]): Promise<number> {
    return (await this.client.request('legacyImport.retry', paths ? { paths } : {})).queued;
  }

  /** Skip legacy projects not yet imported (they will not be imported automatically later), or undo the skip. Returns the number changed. */
  async skipLegacyImport(paths: string[], skipped: boolean): Promise<number> {
    return (await this.client.request('legacyImport.setSkipped', { paths, skipped })).changed;
  }

  /** Find nodes on the local network that have sharing turned on (excluding this computer). */
  async discoverNodes(timeoutMs?: number): Promise<import('@cuccut/protocol').DiscoveredNode[]> {
    const { nodes } = await this.client.request('nodes.discover', timeoutMs === undefined ? {} : { timeoutMs });
    return nodes;
  }

  async pairNode(params: { host: string; port: number; code: string; alias?: string }): Promise<import('@cuccut/protocol').PairedNode> {
    const { node } = await this.client.request('nodes.pair', params);
    return node;
  }

  /** Paired nodes, each with one live probe (2-second timeout). */
  async listNodes(): Promise<import('@cuccut/protocol').PairedNode[]> {
    const { nodes } = await this.client.request('nodes.list', {});
    return nodes;
  }

  async removeNode(nodeId: string): Promise<void> {
    await this.client.request('nodes.remove', { nodeId });
  }

  // ---- Transcription (subtitle panel “Generate subtitles”) ----

  /**
   * Transcribe an asset; returns a task ID; progress and results arrive through the `jobs` topic, and when it completes the Runtime writes the `speech` document into the video.
   * If transcription is not configured, it is rejected with `CAPABILITY_NOT_CONFIGURED` (`conflict`), with `remedy` in details.
   */
  async transcribe(request: Omit<import('@cuccut/protocol').TranscribeRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('models.transcribe', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /** Read the body of one version of a document (when no version is given, read the current version). Does not go into the document cache used for previews. */
  async readDocument(videoId: Id, documentId: Id, revision?: string): Promise<import('@cuccut/protocol').DocumentContent> {
    return this.client.request('documents.read', revision === undefined ? { videoId, documentId } : { videoId, documentId, revision });
  }

  // ---- Translation (subtitle panel “Translate to…”) ----

  /**
   * Start the translation pipeline; returns the parent task ID; progress and results arrive through the `jobs` topic, and when it completes the Runtime writes the `translation` document into the video.
   * If no text model is configured, it is rejected with `CAPABILITY_NOT_CONFIGURED`, with `remedy` in details.
   */
  async startTranslate(params: import('@cuccut/protocol').TranslateParams): Promise<Id> {
    const { jobId } = await this.client.request('pipelines.start', {
      pipeline: 'translate',
      params: params as unknown as Record<string, unknown>,
      commandId: newId('cmd'),
    });
    return jobId;
  }

  /** Re-run a pipeline from the step where it failed, was cancelled, or was interrupted; the task ID stays the same, and steps already completed are not redone. */
  async retryPipeline(jobId: Id): Promise<void> {
    await this.client.request('pipelines.retry', { jobId });
  }

  /** Library entries enabled in the video (`library-selection` document): which glossaries each step uses, and which voice each speaker uses. */
  async getVideoSelection(videoId: Id): Promise<import('@cuccut/protocol').VideoLibrarySelection> {
    return this.client.request('library.getVideoSelection', { videoId });
  }

  /** Change the entries enabled in the video: one ordinary editing transaction (can be undone); given fields are replaced as a whole, omitted ones stay as they are. */
  async setVideoSelection(
    params: Omit<import('@cuccut/protocol').LibrarySetSelectionParams, 'commandId'>,
  ): Promise<import('@cuccut/protocol').LibrarySetSelectionResult> {
    return this.client.request('library.setVideoSelection', { ...params, commandId: newId('cmd') });
  }

  // ---- Space (product design §4, architecture design §5.5, §5.7, §5.11) ----

  /** Cross-video content search: queries the derived content index without opening videos. Videos whose index has not caught up are listed in `pendingVideos`. */
  async searchSpace(params: import('@cuccut/protocol').SpaceSearchParams): Promise<import('@cuccut/protocol').SpaceSearchResult> {
    return this.client.request('space.search', params);
  }

  /** Register a file as an asset of the project without putting it in any video; files from outside the project are first copied into the project's `imports/` (`copied`). */
  async importToSpace(projectId: Id, path: string, name?: string): Promise<{ entry: SpaceEntry; copied: boolean }> {
    return this.client.request('space.import', { projectId, path, ...(name ? { name } : {}) });
  }

  /** Display name; `null` restores the file name. */
  async renameSpaceEntry(entryId: Id, name: string | null): Promise<SpaceEntry> {
    const { entry } = await this.client.request('space.rename', { entryId, name });
    return entry;
  }

  /** Permanently delete entries in the trash (failed placeholders are cleared directly); not deleted while still referenced, and the references that block deletion are returned. */
  async purgeSpaceEntry(entryId: Id): Promise<import('@cuccut/protocol').SpacePurgeResult> {
    return this.client.request('space.purge', { entryId });
  }

  /**
   * Thumbnail of an entry (grid card and the name column of the list): an image (base64), a text summary, or `none`. Anything that cannot be read or decoded is `none`, without an error;
   * if the entry no longer exists, it is `not-found`. Fetch on demand (when the card is visible); do not fetch them all at once.
   */
  async spaceThumbnail(entryId: Id): Promise<import('@cuccut/protocol').SpaceThumbnail> {
    return this.client.request('space.thumbnail', { entryId });
  }

  /** From an entry, go back to the video that can be edited: only answers where to go, and does not open the video. */
  async openSpaceEntryForEdit(entryId: Id): Promise<import('@cuccut/protocol').SpaceOpenForEditResult> {
    return this.client.request('space.openForEdit', { entryId });
  }

  /** Continue a conversation from an entry: only creates the session and attaches a reference to the entry; does not start a task (the next message carries the reference). */
  async continueSpaceEntry(entryId: Id, conversationId?: Id): Promise<import('@cuccut/protocol').SpaceContinueResult> {
    return this.client.request('space.continueInConversation', {
      entryId,
      ...(conversationId ? { conversationId } : {}),
      commandId: newId('cmd'),
    });
  }

  /** Drop the derived catalog and content index and rebuild them from the authoritative source; favorites, display names and the trash are not affected. */
  async rebuildSpaceIndex(): Promise<import('@cuccut/protocol').SpaceRebuildResult> {
    return this.client.request('space.rebuildIndex', {});
  }

  /** Remove Space references in the session that have not yet been sent with a message (the Runtime only supports removing them all together). */
  async clearPendingReferences(conversationId: Id): Promise<Conversation> {
    const { conversation } = await this.client.request('conversations.update', { conversationId, pendingReferences: null });
    return conversation;
  }

  /**
   * Create a new video using a file as the asset (prototype page-space.jsx “New video from file”; architecture design §5.7 “Create a video using it as the asset”):
   * create an empty video, then import this file in one transaction and place it on the main sequence (the same operation as dragging a file into the editor from the computer). Returns the location used to open it.
   * A failure to create is thrown as usual; if the video was created but the import is rejected, nothing is thrown, and `importError` carries the reason (the video is empty; the caller tells the user honestly).
   */
  async createVideoFromFile(
    scope: { projectId?: Id; conversationId?: Id },
    path: string,
    kind: 'video' | 'image' | 'audio' | null,
    name?: string,
  ): Promise<{ target: FileTarget; importError: string | null }> {
    const { ref, snapshot } = await this.client.request('videos.create', { ...scope, ...(name ? { name } : {}), commandId: newId('cmd') });
    const video = snapshot.video;
    const sequence = video.sequences[video.rootSequenceId];
    if (!sequence) return { target: targetOf(ref), importError: RT.noRootSequence };
    try {
      await this.client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: video.revision,
        operations: importAndPlace(sequence, [{ path, kind }], 0),
        ...transactionLabel(EditLabel.importAssets()),
      });
      return { target: targetOf(ref), importError: null };
    } catch (error) {
      return { target: targetOf(ref), importError: (error as Error).message };
    }
  }

  /**
   * Open a portable package as a new video (`videos.importPackage`, architecture design §5.8): it is created in the given project or the session working directory and opened; returns the target used to open it.
   * If the version is newer, the digest does not match, or the path is out of bounds, the Runtime rejects it and leaves no video directory behind.
   */
  async importPackage(scope: { projectId: Id } | { conversationId: Id }, path: string): Promise<FileTarget> {
    const { ref } = await this.client.request('videos.importPackage', { ...scope, path, commandId: newId('cmd') });
    return targetOf(ref);
  }

  // ---- External services (architecture design §4.8, §3.12; services page) ----

  /**
   * Subscribe to the `services` topic (snapshots and events are handed to the caller, and the UI feeds them into services-store). The client keeps only one subscription per topic,
   * so it is called only once, by the always-present rail; after reconnecting, the client renews the subscription itself. Returns an unsubscribe function.
   */
  watchServices(handlers: {
    snapshot: (snapshot: import('@cuccut/protocol').ServicesSnapshot) => void;
    event: (event: import('@cuccut/protocol').ServicesEvent) => void;
  }): () => void {
    return this.client.subscribeServices(handlers);
  }

  async listServices(): Promise<import('@cuccut/protocol').ServiceStatus[]> {
    const { services } = await this.client.request('services.list', {});
    return services;
  }

  /** Turn on a service. If the port is in use, it still returns normally, with status `error` and the `error` field explaining why; a service this version does not have is rejected with `SERVICE_NOT_AVAILABLE`. */
  async startService(serviceId: import('@cuccut/protocol').ServiceId): Promise<import('@cuccut/protocol').ServiceStatus> {
    const { service } = await this.client.request('services.start', { serviceId });
    return service;
  }

  async stopService(serviceId: import('@cuccut/protocol').ServiceId): Promise<import('@cuccut/protocol').ServiceStatus> {
    const { service } = await this.client.request('services.stop', { serviceId });
    return service;
  }

  /** Change the configuration and save it to disk; it takes effect immediately. If the port is changed while the service is on, the Runtime reopens it on the new port. The node service is rejected with `invalid-request` (it uses `nodes.share.*`). */
  async configureService(params: import('@cuccut/protocol').ServiceConfigureParams): Promise<import('@cuccut/protocol').ServiceStatus> {
    const { service } = await this.client.request('services.configure', params);
    return service;
  }

  /**
   * Handle one pending approval (a single entry point for both service approvals and session approvals). An approval that carries an outbound-data grant (`grants`) may be given a `grant` when it is allowed.
   * If it has already been handled, timed out, or was cancelled, it returns `already-resolved`.
   */
  async respondToPendingApproval(
    approvalId: Id,
    decision: import('@cuccut/protocol').PendingApprovalDecision,
    grant?: import('@cuccut/protocol').ApprovalGrantChoice,
  ): Promise<'allowed' | 'denied' | 'already-resolved'> {
    const { status } = await this.client.request('approvals.respond', grant ? { approvalId, decision, grant } : { approvalId, decision });
    return status;
  }

  /** Issue an MCP client token: the plaintext is returned here only once, and the caller may only keep it in local component state to show the user once. */
  async createMcpClient(name: string): Promise<{ client: import('@cuccut/protocol').ServiceClient; token: string }> {
    return this.client.request('services.mcp.createClient', { name });
  }

  async listMcpClients(): Promise<import('@cuccut/protocol').ServiceClient[]> {
    const { clients } = await this.client.request('services.mcp.listClients', {});
    return clients;
  }

  async revokeMcpClient(clientId: string): Promise<import('@cuccut/protocol').ServiceClient[]> {
    const { clients } = await this.client.request('services.mcp.revokeClient', { clientId });
    return clients;
  }

  /** Connection info (the token is a placeholder). When `clientId` is given, the client name is written into the snippet. */
  async mcpConnectionInfo(clientId?: string): Promise<import('@cuccut/protocol').McpConnectionInfo> {
    return this.client.request('services.mcp.connectionInfo', clientId === undefined ? {} : { clientId });
  }

  /** Issue a model-API client token: same rules as MCP; the tokens of the two services are not interchangeable. */
  async createModelApiClient(name: string): Promise<{ client: import('@cuccut/protocol').ServiceClient; token: string }> {
    return this.client.request('services.modelApi.createClient', { name });
  }

  async listModelApiClients(): Promise<import('@cuccut/protocol').ServiceClient[]> {
    const { clients } = await this.client.request('services.modelApi.listClients', {});
    return clients;
  }

  async revokeModelApiClient(clientId: string): Promise<import('@cuccut/protocol').ServiceClient[]> {
    const { clients } = await this.client.request('services.modelApi.revokeClient', { clientId });
    return clients;
  }

  async modelApiConnectionInfo(clientId?: string): Promise<import('@cuccut/protocol').ModelApiConnectionInfo> {
    return this.client.request('services.modelApi.connectionInfo', clientId === undefined ? {} : { clientId });
  }

  /** Set an alias (a same-name alias is replaced); when `modelId` is not given, the provider's default model is used. Returns the whole alias table. */
  async setModelApiAlias(params: {
    alias: string;
    capability: import('@cuccut/protocol').OnlineCapability;
    providerId: string;
    modelId?: string;
  }): Promise<import('@cuccut/protocol').ModelApiAlias[]> {
    const { aliases } = await this.client.request('services.modelApi.setAlias', params);
    return aliases;
  }

  async removeModelApiAlias(alias: string): Promise<import('@cuccut/protocol').ModelApiAlias[]> {
    const { aliases } = await this.client.request('services.modelApi.removeAlias', { alias });
    return aliases;
  }

  /** Browser access link (the one-time code is in the fragment and valid for 2 minutes). When the Web service is off, it is rejected with `conflict` (`SERVICE_NOT_RUNNING`). */
  async createWebAccessLink(): Promise<import('@cuccut/protocol').WebAccessLink> {
    return this.client.request('services.web.createAccessLink', {});
  }

  async listWebSessions(): Promise<import('@cuccut/protocol').WebSession[]> {
    const { sessions } = await this.client.request('services.web.listSessions', {});
    return sessions;
  }

  async revokeWebSession(sessionId: string): Promise<import('@cuccut/protocol').WebSession[]> {
    const { sessions } = await this.client.request('services.web.revokeSession', { sessionId });
    return sessions;
  }

  // ---- Export (architecture design §9.11, §9.13): one export is one Job; progress goes through the jobs topic into jobs-store, and cancellation uses cancelJob. ----

  /**
   * Submit one export; if the pre-check fails, it throws an RPC error (`details.code` is the rejection code) and no task is created. Each submission uses a new commandId:
   * after a rejection, resubmitting with settings changed per the remedy (skipping content that cannot be rendered, skipping missing assets, changing the location) is a separate submission.
   */
  async createExport(request: Omit<ExportCreateRequest, 'commandId'>): Promise<Id> {
    const { jobId } = await this.client.request('exports.create', { ...request, commandId: newId('cmd') });
    return jobId;
  }

  /** The body of subtitles or a script, without writing a file (the preview and “Copy text” on the script page of the export panel): byte-for-byte identical to the file exported with the same settings; if the pre-check fails, it throws the same rejection. */
  async renderTextExport(
    request: import('@cuccut/protocol').ExportRenderTextRequest,
  ): Promise<import('@cuccut/protocol').ExportRenderTextResult> {
    return this.client.request('exports.renderText', request);
  }

  async getExport(jobId: Id): Promise<JobRecord> {
    return this.client.request('exports.get', { jobId });
  }

  async listExports(videoId?: Id): Promise<JobRecord[]> {
    const { jobs } = await this.client.request('exports.list', videoId === undefined ? {} : { videoId });
    return jobs;
  }

  // ---- Installation management of local model bundles (architecture design §6.3): status and progress arrive through the `bundle.updated` event on the `models` topic ----

  /** Install: without `confirmBytes`, it only returns the plan; the install task is submitted only when the `confirmBytes` from the plan is passed back. */
  async installModelBundle(bundleId: string, confirmBytes?: number): Promise<import('@cuccut/protocol').ModelInstallResult> {
    return this.client.request(
      'models.install',
      confirmBytes === undefined ? { bundleId } : { bundleId, confirmBytes, commandId: newId('cmd') },
    );
  }

  /** Repair: verify file by file, and re-download only the missing and corrupt ones. Two-step confirmation, same as install. */
  async repairModelBundle(bundleId: string, confirmBytes?: number): Promise<import('@cuccut/protocol').ModelInstallResult> {
    return this.client.request(
      'models.repair',
      confirmBytes === undefined ? { bundleId } : { bundleId, confirmBytes, commandId: newId('cmd') },
    );
  }

  /** Stop an install: by default keeps the parts already received (resumed next time); with `discard`, deletes them too. */
  async cancelModelInstall(bundleId: string, discard = false): Promise<import('@cuccut/protocol').ModelBundleStatus> {
    const { bundle } = await this.client.request('models.cancelInstall', discard ? { bundleId, discard: true } : { bundleId });
    return bundle;
  }

  /** Delete a model bundle: shared components still used by other model bundles are kept; `MODEL_IN_USE` when a task is using it. */
  async removeModelBundle(bundleId: string): Promise<import('@cuccut/protocol').ModelRemoveResult> {
    return this.client.request('models.remove', { bundleId });
  }

  /** Check: run a fixed sample through the full pipeline; returns a task ID; the conclusion is recorded in the bundle's `selfTest`. */
  async testModelBundle(bundleId: string): Promise<Id> {
    const { jobId } = await this.client.request('models.test', { bundleId, commandId: newId('cmd') });
    return jobId;
  }

  // ---- Model catalog (architecture design §6.3): when the catalog changes, the `models` topic sends `bundle.updated` for each model bundle ----

  async getModelsDir(): Promise<import('@cuccut/protocol').ModelsDirInfo> {
    return this.client.request('models.getDir', {});
  }

  /** View a folder read-only; `null` is the default location. */
  async inspectModelsDir(path: string | null): Promise<import('@cuccut/protocol').ModelsDirInspection> {
    return this.client.request('models.inspectDir', { path });
  }

  /** Change the model catalog: when `move` has something to move, returns the `jobId` of the move task. */
  async setModelsDir(
    path: string | null,
    mode: import('@cuccut/protocol').ModelsDirMode,
  ): Promise<import('@cuccut/protocol').ModelsDirChangeResult> {
    return this.client.request('models.setDir', { path, mode, commandId: newId('cmd') });
  }

  // ---- User library (architecture design §5.9): entry summaries arrive through the `library` topic; this part is reads and writes ----

  async getLibraryEntry(ref: import('@cuccut/protocol').LibraryEntryRef): Promise<import('@cuccut/protocol').LibraryEntry> {
    const { entry } = await this.client.request('library.get', ref);
    return entry;
  }

  /** Create or update an entry; when changing an existing entry, pass `expectedVersion`; if it was changed elsewhere first, `LIBRARY_VERSION_CONFLICT`. */
  async putLibraryEntry(
    params: Omit<import('@cuccut/protocol').LibraryPutParams, 'commandId'>,
  ): Promise<{ entry: import('@cuccut/protocol').LibraryEntry; created: boolean; changed: boolean }> {
    return this.client.request('library.put', { ...params, commandId: newId('cmd') } as import('@cuccut/protocol').LibraryPutParams);
  }

  async removeLibraryEntry(library: import('@cuccut/protocol').LibraryName, id: Id): Promise<void> {
    await this.client.request('library.remove', { library, id });
  }

  /** Import an exchange file (voice pack `.bcvoice`, glossary, …), recognized by content. */
  async importLibraryFile(path: string): Promise<import('@cuccut/protocol').LibraryEntry> {
    const { entry } = await this.client.request('library.import', { path, commandId: newId('cmd') });
    return entry;
  }

  /** Write an entry out as an exchange file; `conflict` if the target already exists, and it is not overwritten. */
  async exportLibraryEntry(
    entry: import('@cuccut/protocol').LibraryEntryRef,
    path: string,
  ): Promise<import('@cuccut/protocol').LibraryExportResult> {
    return this.client.request('library.export', { entry, path });
  }

  /** Restricted address of an entry's file (a voice's reference recording). */
  async openLibraryHandle(ref: import('@cuccut/protocol').LibraryEntryRef): Promise<MediaHandle> {
    return this.client.request('library.openHandle', ref);
  }

  /** Clone a library voice on a provider: uploads the reference recording; returns a task ID. */
  async createVoiceClone(id: Id, providerId: string): Promise<Id> {
    const { jobId } = await this.client.request('library.createVoiceClone', { id, providerId, commandId: newId('cmd') });
    return jobId;
  }

  /** Delete a clone: delete the remote one first; if the remote cannot be deleted, the record is kept and reported with the provider's error code. `localOnly` only clears the local record. */
  async removeVoiceClone(id: Id, providerId: string, localOnly = false): Promise<import('@cuccut/protocol').VoiceCloneRemoveResult> {
    return this.client.request('library.removeVoiceClone', localOnly ? { id, providerId, localOnly: true } : { id, providerId });
  }

  // ---- Outbound data grants (architecture design §12.5): the list comes through the grants topic; only revocation is here ----

  /** Revoke a grant: later new calls and queued calls are rejected; the parts already handed over and billed are reported honestly. */
  async revokeGrant(grantId: Id): Promise<import('@cuccut/protocol').GrantRevokeResult> {
    return this.client.request('grants.revoke', { grantId });
  }

  // ---- Home page fixed pipelines and import from a link (design files page-new.jsx, import-flow.jsx; the start and retry flows use startPipeline / retryPipeline / detectExternalTool above) ----

  /**
   * The user clicked “Agree and install / update”: records the consent (`via: 'app'`) and submits the install task (`kind: 'toolInstall'`; progress through the `jobs` topic).
   * This can only be triggered by that one user action; if the manifest is incomplete or the app is strictly offline, the Runtime rejects it with `conflict`.
   */
  async installExternalTool(name: string): Promise<import('@cuccut/protocol').ExternalToolInstallResult> {
    return this.client.request('externalTools.install', { name, consent: true, via: 'app', commandId: newId('cmd') });
  }

  /**
   * The user clicked the run button next to the update command: updates the copy installed on the system using the original install method (`externalTools.update`; submits a `kind: 'toolUpdate'` task;
   * output through the `jobs` topic). What is handed back is the command shown on the UI, which is the user's confirmation; if the method has changed, the Runtime rejects with `conflict`
   * (`TOOL_UPDATE_CONFIRM_REQUIRED`; `details.update` is the method as of now) and does not run it.
   */
  async updateExternalTool(name: string, command: string): Promise<import('@cuccut/protocol').ExternalToolUpdateResult> {
    return this.client.request('externalTools.update', { name, command, commandId: newId('cmd') });
  }

  /** Record (or withdraw) the user's consent for an external tool: called only when the user clicks in the UI. */
  async consentExternalTool(name: string, grant: boolean): Promise<import('@cuccut/protocol').ExternalToolStatus> {
    const { tool } = await this.client.request('externalTools.consent', { name, grant, via: 'app' });
    return tool;
  }

  /** Specify (`null` clears) the copy the user installed themselves; the Runtime first runs `--version` to verify it, and if it cannot run, `invalid-request`. */
  async setExternalToolPath(name: string, path: string | null): Promise<import('@cuccut/protocol').ExternalToolStatus> {
    const { tool } = await this.client.request('externalTools.setPath', { name, path });
    return tool;
  }

  /**
   * Fixed pipeline to create a video: create a new video (by aspect ratio), then in one transaction (optionally) set the background and import assets onto the main sequence; if a waveform is wanted, add a waveform layer over the whole piece in another transaction
   * (the duration is taken from the new duration in the previous transaction's receipt). A failure to create is thrown as usual; failures after the video has been created are not thrown, and are reported honestly (the video is still usable).
   * Returns the location used to open it and the IDs of the imported assets (needed for transcription).
   */
  async createFlowVideo(
    scope: { projectId?: Id; conversationId?: Id },
    options: {
      name?: string;
      /** Aspect ratio; when not given, the Runtime's default canvas is used. */
      width?: number;
      height?: number;
      /** Assets to import; `name` and `provenance` are the asset name and source known to the importer (files downloaded by link import). */
      file?: { path: string; kind: 'video' | 'audio'; name?: string; provenance?: { origin: string; source?: unknown } };
      /** Canvas background color `#RRGGBB`. */
      background?: string;
      /** Waveform for the whole piece (the layer in the elements panel). */
      wave?: VisualLayer;
    },
  ): Promise<{ target: FileTarget; videoId: Id; assetId: Id | null; importError: string | null; waveError: string | null }> {
    const { ref, snapshot } = await this.client.request('videos.create', {
      ...scope,
      ...(options.name ? { name: options.name } : {}),
      ...(options.width && options.height ? { width: options.width, height: options.height } : {}),
      commandId: newId('cmd'),
    });
    const target = targetOf(ref);
    const videoId = ref.videoId;
    const video = snapshot.video;
    const sequence = video.sequences[video.rootSequenceId];
    if (!sequence) return { target, videoId, assetId: null, importError: RT.noRootSequence, waveError: null };
    const operations: import('@cuccut/protocol').EditOperation[] = [
      ...(options.background
        ? [{ type: 'updateSequence' as const, sequenceId: sequence.id, background: options.background.toUpperCase() }]
        : []),
      ...(options.file ? importAndPlace(sequence, [options.file], 0) : []),
    ];
    if (!operations.length) return { target, videoId, assetId: null, importError: null, waveError: null };
    let receipt: import('@cuccut/protocol').TransactionReceipt;
    try {
      ({ receipt } = await this.client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: video.revision,
        operations,
        ...transactionLabel(options.file ? EditLabel.importAssets() : EditLabel.setBackground()),
      }));
    } catch (error) {
      return { target, videoId, assetId: null, importError: (error as Error).message, waveError: null };
    }
    const assetId = receipt.refs?.drop0 ?? null;
    if (!options.wave) return { target, videoId, assetId, importError: null, waveError: null };
    const span = { fromFrame: 0, durationFrames: receipt.impact.newDurationFrames };
    if (span.durationFrames <= 0) return { target, videoId, assetId, importError: null, waveError: RT.noDuration };
    try {
      await this.client.request('edits.apply', {
        videoId: ref.videoId,
        commandId: newId('cmd'),
        expectedRevision: receipt.videoRevision,
        operations: insertVisual(sequence, span, [options.wave], RT.waveformName),
        ...transactionLabel(EditLabel.addWaveform()),
      });
      return { target, videoId, assetId, importError: null, waveError: null };
    } catch (error) {
      return { target, videoId, assetId, importError: null, waveError: (error as Error).message };
    }
  }

  /**
   * Issue an outbound data grant (`grants.create`; called only after the user explicitly confirms in the UI): data kind, recipient, scope, purpose and budget method are passed through as given.
   * When translation dubbing is first rejected with `GRANT_REQUIRED`, the user confirms the grant is issued, and the request is then submitted again.
   */
  async createGrant(params: import('@cuccut/protocol').GrantCreateParams): Promise<import('@cuccut/protocol').Grant> {
    const { grant } = await this.client.request('grants.create', params);
    return grant;
  }

  // ---- Translation dubbing (Tools page › Translation dubbing) ----

  /**
   * Start the translation dubbing pipeline (`dub` of `pipelines.start`); returns the parent task ID; progress and results arrive through the `jobs` topic, and on completion the Runtime adds a set of dubbing in one transaction.
   * If no grant covers the outbound data, it is rejected with `GRANT_REQUIRED` (`forbidden`), with `remedy` in details.
   */
  async startDub(params: import('@cuccut/protocol').DubParams): Promise<Id> {
    const { jobId } = await this.client.request('pipelines.start', {
      pipeline: 'dub',
      params: params as unknown as Record<string, unknown>,
      commandId: newId('cmd'),
    });
    return jobId;
  }

  // ---- Tool catalog (video tools on the Tools page, architecture design §7.9) ----

  /** `tools.list`: the tool registry plus whether each tool can be used right now (the reason it cannot, and restricted inputs), and the save location (the Web service does not provide it). */
  async listTools(): Promise<import('@cuccut/protocol').ToolsListResult> {
    return this.client.request('tools.list', {});
  }

  /** `pipelines.list`: which fixed pipelines the Runtime has registered (a tool the catalog lists but whose executing pipeline does not exist yet cannot be used). */
  async listPipelines(): Promise<import('@cuccut/protocol').PipelineInfo[]> {
    const { pipelines } = await this.client.request('pipelines.list', {});
    return pipelines;
  }

  /** `tools.candidates`: the videos and scripts a video tool can choose from (reads the Space catalog and content index, without opening videos). */
  async toolCandidates(params: import('@cuccut/protocol').ToolCandidatesParams): Promise<import('@cuccut/protocol').ToolCandidatesResult> {
    return this.client.request('tools.candidates', params);
  }

  /**
   * Start a fixed pipeline with the `commandId` given by the caller: after the Tools page is rejected on the spot for lack of a grant (`pendingGrants`) and the user confirms and issues the grant,
   * resubmit with the same `commandId` (the Runtime de-duplicates by it, and the rejected attempt does not use it).
   */
  async startPipelineWithCommand(pipeline: string, params: Record<string, unknown>, commandId: string): Promise<Id> {
    const { jobId } = await this.client.request('pipelines.start', { pipeline, params, commandId });
    return jobId;
  }

  /** `jobs.inspect`: the full record of one task (including the fixed pipeline's steps and summary). */
  async inspectJob(jobId: Id): Promise<JobRecord> {
    return this.client.request('jobs.inspect', { jobId });
  }
}

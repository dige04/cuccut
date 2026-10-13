import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  newId,
  type Conversation,
  type GeneratedOutput,
  type Id,
  type JobRecord,
  type JobSubmitter,
  type TasksEvent,
  type VideoChange,
  type VideoCreated,
  type SlidesCreated,
  type DesignCreated,
  type DesignSystemCreated,
  type VideoOpenResult,
} from '@cuccut/protocol';
import { engineProtections, type Harness } from '@cuccut/harness';
import { canonicalJson, isTerminal, locateArtifact, sha256Hex, type HostedJob, type JobManager } from '@cuccut/jobs';
import type { EngineProtection, VideoService } from '../videos/video-service.ts';
import { scanDirectory } from '../space-catalog.ts';
import type { AgentPrincipal } from './grants.ts';
import { ToolError } from './tool-catalog.ts';
import {
  toolRisk,
  type ToolAccess,
  type ToolApprovalNote,
  type ToolConfirmation,
  scopedProject,
  type ScopedProject,
  type ToolPrincipal,
  type ToolScope,
  type TranslationScope,
  type VideoRoot,
} from './tool-scope.ts';

/** Authorization for one call in a session: the session and the task in progress. */
export interface AgentAccess extends ToolAccess {
  readonly principal: AgentPrincipal;
  readonly conversation: Conversation;
  readonly taskId: Id;
}

/**
 * Permissions and scope of agent tools (architecture design §3.5, §4.2), shared by video tools and model tools:
 *
 * - tools are available only while the session has a task in progress; refused after a stop; plan mode is read-only;
 * - calls with side effects are looked up by the session's current access mode and the action's risk (§3.12): automatic ones
 *   run directly, those that must ask post an approval card in the session and wait (no time limit), and a user denial, stop
 *   or interruption returns a clear error;
 * - the agent can only use videos in the session's source directory (its project's directory, or the session's own working
 *   directory);
 * - the agent only sees jobs submitted by this session and jobs on open videos in the source directory, and can only use
 *   artifacts of those jobs.
 */
export class AgentScope implements ToolScope<AgentAccess> {
  readonly #harness: Harness;
  readonly #videos: VideoService;
  readonly #jobs: JobManager;
  /** Directories of unopened videos already located by videoId: checked first next time, rescanned if stale. */
  readonly #located = new Map<Id, string>();
  /** Progress records of the agent's own translations (`translationStarted`), keyed by session, video, transcript and language; removed once terminal. */
  readonly #translations = new Map<string, { job: HostedJob; taskId: Id }>();
  /** Whether the task center is subscribed (to close progress records when a turn ends). Subscribed on the first registered record. */
  #watchingTasks = false;

  constructor(deps: { harness: Harness; videos: VideoService; jobs: JobManager }) {
    this.#harness = deps.harness;
    this.#videos = deps.videos;
    this.#jobs = deps.jobs;
  }

  /** Tools are available only during a task; always refused after the stop barrier (D04); plan mode is read-only. */
  authorize(principal: ToolPrincipal, write: boolean): AgentAccess {
    if (principal.kind !== 'agent') throw new ToolError('FORBIDDEN', 'This tool channel serves only the agent in a session');
    const run = this.#harness.agentRun(principal.conversationId);
    if (!run.taskId) throw new ToolError('NO_ACTIVE_TASK', 'This session has no task in progress; tools are available only during a turn');
    if (run.stopRequested) throw new ToolError('TASK_STOPPED', 'The user has stopped this task: do not read or change videos any further; end this turn');
    if (write && run.mode === 'plan') {
      throw new ToolError('PLAN_ONLY', 'Plan mode is on (read-only): explain what you intend to change, and wait for the user to switch to a mode that allows edits before changing anything');
    }
    const submitter: JobSubmitter = { kind: 'agent', id: run.conversation.id, taskId: run.taskId };
    // Always read the session's current record: once a project is bound mid-call (when creating a video, §3.10), the working and source directories follow.
    const harness = this.#harness;
    const captured = run.conversation;
    return {
      principal,
      get conversation(): Conversation {
        return harness.conversationOf(captured.id) ?? captured;
      },
      taskId: run.taskId,
      submitter,
    };
  }

  /** Decides by the session's current access mode and risk (§3.12): automatic, wait for the user, or refuse. The mode in the result goes into the tool result. */
  async confirm(access: AgentAccess, request: ToolConfirmation): Promise<ToolApprovalNote> {
    const targets = [...(request.video !== undefined ? [request.video] : []), ...(request.targets ?? [])];
    const risk = toolRisk(request);
    const result = await this.#harness.approveToolCall(access.conversation.id, {
      tool: request.tool,
      targets,
      summary: request.summary,
      risk,
      // "Always allow" is stored by tool name; it is not offered for high-risk calls (irreversible overwrites, outbound transfers, paid calls), which are asked every time.
      rule: risk === 'high' ? null : request.tool,
      ...(request.grants?.length ? { grants: request.grants } : {}),
    });
    switch (result.status) {
      case 'allowed':
        return {
          mode: result.mode,
          risk: result.risk,
          decidedBy: result.decidedBy,
          // Calls with an outbound grant: the user's choice; an automatic pass (full access) counts as this time only.
          ...(request.grants?.length ? { grant: result.grant ?? { persist: false } } : {}),
        };
      case 'no-task':
        throw new ToolError('NO_ACTIVE_TASK', 'This session has no task in progress; tools are available only during a turn');
      case 'cancelled':
        throw new ToolError('APPROVAL_CANCELLED', 'This call was cancelled before the user confirmed it (the task was stopped or the reply was interrupted): do not retry; end this turn', {
          mode: result.mode,
          risk: result.risk,
        });
      case 'denied':
        if (result.mode === 'plan') {
          throw new ToolError('PLAN_ONLY', 'Plan mode is on (read-only): explain what you intend to change, and wait for the user to switch to a mode that allows edits before changing anything');
        }
        throw new ToolError(
          'APPROVAL_DENIED',
          result.decidedBy === 'user'
            ? 'The user denied this call in CucCut: do not retry the same call; ask the user first'
            : 'The current access mode does not allow this call: explain what you intend to do and ask the user to switch modes',
          { mode: result.mode, risk: result.risk },
        );
    }
  }

  /** Videos in the source directory, with the videoId and name of those already open. */
  async listVideos(access: AgentAccess): Promise<Record<string, unknown>> {
    const { root } = this.source(access.conversation);
    const rootReal = await fs.realpath(root).catch(() => root);
    const scan = await scanDirectory(rootReal);
    const open = new Map(this.#videos.openRefs().map((ref) => [ref.path, ref]));
    return {
      workspace: rootReal,
      videos: scan.files
        .filter((file) => file.kind === 'video')
        .map((file) => {
          const ref = open.get(path.join(rootReal, file.relPath));
          return { path: file.relPath, ...(ref ? { videoId: ref.videoId, name: ref.name, open: true } : { open: false }) };
        }),
      ...(scan.issue ? { issue: scan.issue.detail } : {}),
    };
  }

  /**
   * Where a new video goes: the session's source, i.e. its project's directory, or the session's working directory when it has
   * no project (§3.10: the video stays there; no project is created for it). A given `project` can only be the session's own
   * project (by id or directory); any other is answered like a missing one.
   */
  async createRoot(access: AgentAccess, project?: string): Promise<VideoRoot> {
    const source = this.source(access.conversation);
    if (
      project !== undefined &&
      !('projectId' in source.scope && (project === source.scope.projectId || path.resolve(project) === path.resolve(source.root)))
    ) {
      throw new ToolError(
        'PROJECT_NOT_FOUND',
        `Project "${project}" not found: you can only create in the session's own project; without project, videos are created in the session's project, or in the working directory for a session without a project`,
      );
    }
    return source;
  }

  /** `importAsset.path` is relative to the session's working directory; absolute paths and `~/` are accepted as usual (user-provided assets often live elsewhere). */
  importBase(access: AgentAccess): { cwd: string; confine: string | null } {
    return { cwd: access.conversation.cwd, confine: null };
  }

  /** Local files are relative to the session's working directory; absolute paths and `~/` are accepted as usual. */
  fileBase(access: AgentAccess): string {
    return access.conversation.cwd;
  }

  commandId(_access: AgentAccess, given: string | undefined): string {
    return given ?? newId('cmd');
  }

  owns(record: JobRecord, access: AgentAccess): boolean {
    return ownedBy(record, access.conversation);
  }

  /** The receipt posts a change card in the session (product design §6.5). */
  recordChange(access: AgentAccess, change: VideoChange): void {
    const target =
      'conversationId' in change.target && !change.target.conversationId
        ? { ...change.target, conversationId: access.conversation.folderOf ?? access.conversation.id }
        : change.target;
    this.#harness.recordVideoChange(access.conversation.id, access.taskId, { ...change, target });
  }

  /** A video created by `videos_create` is recorded in the session; the UI's video card comes from it (architecture design §11.3). */
  recordCreated(access: AgentAccess, created: VideoCreated): void {
    const target =
      'conversationId' in created.target && !created.target.conversationId
        ? { ...created.target, conversationId: access.conversation.folderOf ?? access.conversation.id }
        : created.target;
    this.#harness.recordVideoCreated(access.conversation.id, access.taskId, { ...created, target });
  }

  /** A deck that passes `slides_check` is recorded in the session; the UI's slides card comes from it (docs/design/slides §7.3). */
  recordSlides(access: AgentAccess, created: SlidesCreated): void {
    this.#harness.recordSlidesCreated(access.conversation.id, access.taskId, created);
  }

  /** A design with no `design_check` problems is recorded in the session; the UI's design card comes from it (docs/design/canvas §7.3). */
  recordDesign(access: AgentAccess, created: DesignCreated): void {
    this.#harness.recordDesignCreated(access.conversation.id, access.taskId, created);
  }

  /** A design system with no `design_system_check` problems is recorded in the session; the UI's design system card comes from it (docs/design/canvas §10.5). */
  recordDesignSystem(access: AgentAccess, created: DesignSystemCreated): void {
    this.#harness.recordDesignSystemCreated(access.conversation.id, access.taskId, created);
  }

  /**
   * The agent is about to translate a transcript itself: registers an `agentTranslate` progress record (a hosted job: not
   * queued, not executed, holding no video lease), from which the video card and captions panel show "Translating". It
   * completes when a translation in that language is written (`translationWritten`); if the turn ends before that, it is
   * recorded as cancelled when the user stopped, otherwise as interrupted. A record for the same session, video, transcript and
   * language is reused while still running.
   */
  translationStarted(access: AgentAccess, start: TranslationScope & { sentences: number; sourceRevision?: string }): Id | null {
    const key = translationKey(access.conversation.id, start);
    const open = this.#translations.get(key);
    if (open && !isTerminal(open.job.record().state)) {
      if (open.taskId === access.taskId) return open.job.jobId;
      // Left over from a previous turn (which should have closed it when it ended): interrupt it and register anew for this turn.
      void open.job.finish('interrupted');
    }
    this.#watchTasks();
    const now = new Date().toISOString();
    const scope = { videoId: start.videoId, sourceDocumentId: start.sourceDocumentId, language: start.language };
    const record: JobRecord = {
      jobId: newId('job'),
      kind: 'agentTranslate',
      state: 'running',
      phase: 'generating',
      progress: null,
      videoId: start.videoId,
      assetId: null,
      assetRevision: null,
      contentHash: `sha256:${sha256Hex(canonicalJson({ documentId: start.sourceDocumentId, revision: start.sourceRevision ?? null }))}`,
      providerId: `agent:${access.conversation.driverId}`,
      modelId: access.conversation.driverId,
      bundleId: null,
      inputHash: `sha256:${sha256Hex(canonicalJson({ kind: 'agentTranslate', ...scope }))}`,
      submitter: access.submitter,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      endedAt: null,
      error: null,
      result: null,
      warnings: [],
      translation: { sourceDocumentId: start.sourceDocumentId, targetLanguage: start.language, sentences: start.sentences },
    };
    // Cancelling only ends this record, not the agent's turn (the UI shows no cancel button for it); interrupted when the Runtime stops.
    let job: HostedJob | null = null;
    const end = (state: 'cancelled' | 'interrupted') => {
      this.#translations.delete(key);
      void job?.finish(state);
    };
    job = this.#jobs.host(record, { hosted: 'agent-translate', control: { cancel: () => end('cancelled'), interrupt: () => end('interrupted') } });
    this.#translations.set(key, { job, taskId: access.taskId });
    return job.jobId;
  }

  /** A translation was written: the progress record for the same session, video, transcript and language completes, with its result pointing to the written translation. */
  translationWritten(access: AgentAccess, written: TranslationScope & { documentId: Id | null }): void {
    const key = translationKey(access.conversation.id, written);
    const open = this.#translations.get(key);
    if (!open) return;
    this.#translations.delete(key);
    void open.job.finish('completed', { result: { documentId: written.documentId, artifactId: '' } });
  }

  /** When a turn ends (the task is no longer running in the task center), closes its still-open progress records: cancelled when the user stopped, otherwise interrupted. */
  #watchTasks(): void {
    if (this.#watchingTasks) return;
    this.#watchingTasks = true;
    this.#harness.subscribe('tasks', undefined, (event) => {
      const payload = event.event as TasksEvent;
      let ended: { taskId: Id; stopped: boolean } | null = null;
      if (payload.type === 'task.removed') ended = { taskId: payload.taskId, stopped: false };
      else if (payload.type === 'task.upsert' && payload.task.status !== 'running' && payload.task.status !== 'stopping') {
        ended = { taskId: payload.task.taskId, stopped: payload.task.status === 'stopped' };
      }
      if (!ended) return;
      for (const [key, open] of this.#translations) {
        if (open.taskId !== ended.taskId) continue;
        this.#translations.delete(key);
        void open.job.finish(ended.stopped ? 'cancelled' : 'interrupted');
      }
    });
  }

  /** The task contract's current protections: after the contract changes, later submissions are checked against the new ones. */
  protections(access: AgentAccess, videoId: Id): EngineProtection[] {
    return engineProtections(this.#harness.currentContract(access.conversation.id, access.taskId), videoId);
  }

  saveRoot(access: AgentAccess): string {
    return access.conversation.cwd;
  }

  /** Export directories are relative to the session's source directory; when omitted the export service uses the `exports/` of the video's source directory. */
  exportBase(access: AgentAccess): { base: string; within: string; ownDefault: boolean } {
    const { root } = this.source(access.conversation);
    return { base: root, within: root, ownDefault: false };
  }

  /**
   * The session's source directory: its project's directory, or the session's own working directory. A session sharing another
   * session's working directory (`folderOf`) is scoped to that session: video and file locations and the Space source are its.
   */
  source(conversation: Conversation): { root: string; scope: { projectId: Id } | { conversationId: Id } } {
    if (conversation.projectId) {
      const project = this.#harness.listProjects().find((p) => p.id === conversation.projectId);
      if (project) return { root: project.path, scope: { projectId: project.id } };
    }
    return { root: conversation.cwd, scope: { conversationId: conversation.folderOf ?? conversation.id } };
  }

  /**
   * Opens (or attaches to an already open) video and records this session as an opener. `video` is a path relative to the
   * source directory or a videoId; the video must be in the source directory. A videoId is not limited to open videos: closed
   * ones (created by a pipeline that has released its lease) are found among the video directories in the source directory
   * (identity read-only, without taking the write lock); videos outside the source directory are answered like missing ones with
   * `VIDEO_NOT_FOUND`.
   */
  async open(video: string, access: AgentAccess): Promise<VideoOpenResult> {
    const { conversation, principal } = access;
    const { root, scope } = this.source(conversation);
    const known = this.#videos.ref(video) ?? (VIDEO_ID.test(video) ? await this.#locate(video, root) : null);
    try {
      return await this.#videos.open({ root, file: known ? known.path : video, scope }, principal);
    } catch (error) {
      if (error instanceof RpcError && error.code === 'not-found') {
        throw new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found: use a path from videos_list, or the videoId of a video in this session's working directory`);
      }
      if (error instanceof RpcError && error.code === 'forbidden') {
        throw new ToolError('VIDEO_OUTSIDE_WORKSPACE', 'Only videos in this session\'s working directory can be used');
      }
      throw error;
    }
  }

  /**
   * The videoId of a video in the source directory, named by a path relative to it or by a videoId, without opening it (publishing tools).
   * Videos outside the source directory are answered like missing ones.
   */
  async videoIdOf(video: string, access: AgentAccess): Promise<Id> {
    const { root } = this.source(access.conversation);
    const rootReal = await fs.realpath(root).catch(() => null);
    const notFound = () =>
      new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found: use a path from videos_list, or the videoId of a video in this session's working directory`);
    if (!rootReal) throw notFound();
    const ref = this.#videos.ref(video);
    if (ref) {
      if (insideDir(ref.path, rootReal)) return ref.videoId;
      throw notFound();
    }
    if (VIDEO_ID.test(video)) {
      if (await this.#locate(video, root)) return video;
      throw notFound();
    }
    const dir = await fs.realpath(path.resolve(rootReal, video)).catch(() => null);
    if (!dir || dir === rootReal || !insideDir(dir, rootReal)) throw notFound();
    const seen = this.#videos.openRefs().find((item) => item.path === dir) ?? (await this.#videos.peek(dir).catch(() => null));
    if (!seen) throw notFound();
    this.#located.set(seen.videoId, dir);
    return seen.videoId;
  }

  /** The videoIds among `videoIds` that are in the source directory: open ones by their path, the others by one read-only scan of the directory. */
  async visibleVideoIds(access: AgentAccess, videoIds: readonly Id[]): Promise<Set<Id>> {
    const visible = new Set<Id>();
    const { root } = this.source(access.conversation);
    const rootReal = await fs.realpath(root).catch(() => null);
    if (!rootReal) return visible;
    const wanted = new Set(videoIds);
    for (const ref of this.#videos.openRefs()) {
      if (wanted.has(ref.videoId) && insideDir(ref.path, rootReal)) visible.add(ref.videoId);
    }
    if ([...wanted].every((id) => visible.has(id))) return visible;
    const open = new Set(this.#videos.openRefs().map((ref) => ref.path));
    const scan = await scanDirectory(rootReal);
    for (const file of scan.files) {
      if (file.kind !== 'video') continue;
      const dir = path.join(rootReal, ...file.relPath.split('/'));
      if (open.has(dir)) continue;
      const seen = await this.#videos.peek(dir).catch(() => null);
      if (!seen) continue;
      this.#located.set(seen.videoId, dir);
      if (wanted.has(seen.videoId)) visible.add(seen.videoId);
    }
    return visible;
  }

  /**
   * The video directory (not open) for a videoId in the source directory: checks the last known location first, otherwise
   * rescans the source directory and reads each identity read-only (`peek`). Directories locked by another process or unreadable
   * are skipped. null when not found.
   */
  async #locate(videoId: Id, root: string): Promise<{ path: string } | null> {
    const rootReal = await fs.realpath(root).catch(() => null);
    if (!rootReal) return null;
    const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
    const peek = async (dir: string): Promise<{ path: string } | null> => {
      if (!dir.startsWith(prefix)) return null;
      const open = this.#videos.openRefs().find((ref) => ref.path === dir);
      const seen = open ?? (await this.#videos.peek(dir).catch(() => null));
      if (!seen) return null;
      this.#located.set(seen.videoId, dir);
      return seen.videoId === videoId ? { path: dir } : null;
    };
    const remembered = this.#located.get(videoId);
    if (remembered) {
      const hit = await peek(remembered);
      if (hit) return hit;
      this.#located.delete(videoId);
    }
    const scan = await scanDirectory(rootReal);
    for (const file of scan.files) {
      if (file.kind !== 'video') continue;
      const hit = await peek(path.join(rootReal, ...file.relPath.split('/')));
      if (hit) return hit;
    }
    return null;
  }

  /** Whether an open video is in the session's source directory. false when it is not open (cannot tell). */
  async contains(videoId: Id, conversation: Conversation): Promise<boolean> {
    const ref = this.#videos.ref(videoId);
    if (!ref) return false;
    const { root } = this.source(conversation);
    const rootReal = await fs.realpath(root).catch(() => null);
    if (!rootReal) return false;
    const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
    return ref.path === rootReal || ref.path.startsWith(prefix);
  }

  /** Jobs this session can see: its own submissions, or jobs on open videos in the source directory. Invisible ones are answered like missing ones. */
  async visibleJob(jobId: Id, access: AgentAccess): Promise<JobRecord> {
    const { conversation } = access;
    let record: JobRecord;
    try {
      record = this.#jobs.inspect(jobId);
    } catch {
      throw jobNotFound(jobId);
    }
    if (await this.#sees(record, conversation)) return record;
    throw jobNotFound(jobId);
  }

  /** `jobs_list`: jobs submitted by this session and jobs on open videos in the source directory (same as `visibleJob`), newest first. */
  async visibleJobs(access: AgentAccess): Promise<JobRecord[]> {
    const { root } = this.source(access.conversation);
    const rootReal = await fs.realpath(root).catch(() => null);
    const prefix = rootReal && (rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep);
    const inSource = (videoId: Id): boolean => {
      const ref = prefix ? this.#videos.ref(videoId) : undefined;
      return !!ref && (ref.path === rootReal || ref.path.startsWith(prefix!));
    };
    return this.#jobs
      .list()
      .filter((record) => ownedBy(record, access.conversation) || (record.videoId !== null && inSource(record.videoId)));
  }

  /** `projects_list`: only the session's own project; a session without a project (its working directory is not a project) has none. */
  async listProjects(access: AgentAccess): Promise<ScopedProject[]> {
    const { root, scope } = this.source(access.conversation);
    if (!('projectId' in scope)) return [];
    const project = this.#harness.listProjects().find((p) => p.id === scope.projectId);
    if (!project) return [];
    const scan = await scanDirectory(await fs.realpath(root).catch(() => root)).catch(() => null);
    return [scopedProject(project, { videoCount: scan && !scan.issue ? scan.files.filter((f) => f.kind === 'video').length : undefined })];
  }

  /**
   * Artifacts this session can use: results of jobs it can see (generated outputs, or transcription results) and files in the
   * artifact store. The same bytes may come from several jobs; this session's own submissions are preferred. Failed jobs that
   * kept a result (video import failed) count too. Invisible ones are answered like missing ones.
   */
  async visibleArtifact(
    artifactId: string,
    access: AgentAccess,
  ): Promise<{ record: JobRecord; output: GeneratedOutput | null; file: string }> {
    const { conversation } = access;
    const candidates = this.#jobs
      .list()
      .filter((record) => record.result?.artifactId === artifactId || record.result?.outputs?.some((o) => o.artifactId === artifactId))
      .sort((a, b) => Number(ownedBy(b, conversation)) - Number(ownedBy(a, conversation)));
    for (const record of candidates) {
      if (!(await this.#sees(record, conversation))) continue;
      const output = record.result?.outputs?.find((o) => o.artifactId === artifactId) ?? null;
      // Outputs published to user directories (media downloaded by link import) are not in the artifact store: found by the recorded path, and the content must match.
      const file = await locateArtifact(this.#jobs.artifacts, artifactId, output);
      if (!file) throw new ToolError('ARTIFACT_NOT_FOUND', `The file of artifact ${artifactId} no longer exists`);
      return { record, output, file };
    }
    throw new ToolError(
      'ARTIFACT_NOT_FOUND',
      `Artifact ${artifactId} not found, or it does not belong to a job this session can see (use an artifactId from jobs_inspect outputs)`,
    );
  }

  async #sees(record: JobRecord, conversation: Conversation): Promise<boolean> {
    if (ownedBy(record, conversation)) return true;
    return record.videoId !== null && (await this.contains(record.videoId, conversation));
  }
}

/** The shape of a videoId: `video_` plus hex (16 digits from the engine; 32 from `newId`). Paths contain `/` or `.`, so they never match. */
const VIDEO_ID = /^video_[0-9a-f]{8,32}$/;

/** Jobs submitted by this session. */
export function ownedBy(record: JobRecord, conversation: Conversation): boolean {
  return record.submitter.kind === 'agent' && record.submitter.id === conversation.id;
}

function translationKey(conversationId: Id, scope: TranslationScope): string {
  return [conversationId, scope.videoId, scope.sourceDocumentId, scope.language.toLowerCase()].join('\u0000');
}

function jobNotFound(jobId: Id): ToolError {
  return new ToolError('JOB_NOT_FOUND', `Job ${jobId} not found, or it does not belong to this session's working directory`);
}

/** Whether `candidate` is `root` or inside it (both real paths). */
function insideDir(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

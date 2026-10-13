import { refOf } from '@cuccut/protocol';
import type {
  AgentMode,
  ApprovalGrantChoice,
  GeneratedOutput,
  GrantRequestItem,
  Id,
  JobRecord,
  JobSubmitter,
  Localized,
  MessageRef,
  Project,
  RiskLevel,
  ServiceId,
  VideoChange,
  VideoCreated,
  SlidesCreated,
  DesignCreated,
  DesignSystemCreated,
  VideoOpenResult,
} from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import type { EngineProtection } from '../videos/video-service.ts';
import type { AgentPrincipal } from './grants.ts';
import { ToolError } from './tool-catalog.ts';

/**
 * Tool permissions and scope (architecture design §3.5, §4.8). One set of tool implementations (video, model) serves several
 * kinds of principal; the differences live only here:
 *
 * - the agent in a session (`AgentScope`): tools are available only during a task, plan mode is read-only, and the scope is the
 *   session's source directory; calls with side effects are looked up by the session's current access mode and the action's
 *   risk (§3.12), and those that must ask wait for the user in the session;
 * - an external service client (`ServiceScope`): the access policy gives the scope (all videos or a list) and the operation
 *   level; under `ask` the user confirms each call;
 * - the user themselves in a terminal (`LocalScope`, `catalog.call`): everything the user can access, relative paths resolve
 *   against cwd, no CucCut approval.
 *
 * When one catalog serves both the session agent and the terminal, tool sets get a `ScopeRouter`, which forwards to each
 * principal kind's own scope.
 *
 * A tool first calls `authorize`, then `confirm` if it has side effects, then opens videos and submits jobs through the scope;
 * which jobs and artifacts are visible is also decided by the scope.
 */

/** An external service principal (§4.8): one per authenticated external request; `name` is the service ID (the actor is recorded as `external:<serviceId>`). */
export interface ServicePrincipal extends TrustedPrincipal {
  kind: 'service';
  serviceId: ServiceId;
  clientId: string;
  clientName: string;
  /** Aborted when the external request disconnects: pending approvals are cancelled with it. */
  signal: AbortSignal;
  /** Audit: the target video this request resolved to (within scope). */
  audit: { videoId: Id | null };
}

/**
 * The user themselves in a terminal (`catalog.call`, §3.5): a CLI or desktop connection calls catalog tools by name through the
 * gateway. The scope is everything the user can access, relative paths resolve against `cwd`; the actor for writes is
 * `user_local` (sharing the undo stack with the desktop UI), the job submitter is the calling connection; no CucCut approval.
 */
export interface LocalPrincipal extends TrustedPrincipal {
  kind: 'local';
  /** The calling gateway connection: videos opened through it are released when it disconnects (same as those opened by the UI). */
  connectionId: string;
  /** The kind of the calling connection (audit). */
  client: 'cli' | 'desktop';
  /** The CLI's working directory (absolute real path); relative paths resolve against it. */
  cwd: string;
  /** The project directory given explicitly or found by walking up from cwd (real path); null if none. */
  projectDir: string | null;
}

export type ToolPrincipal = AgentPrincipal | ServicePrincipal | LocalPrincipal;

/** The authorization result of one call: the submitter for jobs, plus the scope's own context. */
export interface ToolAccess {
  readonly principal: ToolPrincipal;
  readonly submitter: JobSubmitter;
}

/**
 * Confirmation before a call with side effects runs (§3.12): what is shown to the user and the action's risk level. `video` is
 * the caller's video argument, resolved against the scope before confirming; `targets` are other targets (files). Without
 * `risk`, the tool's default level in `TOOL_RISK` applies.
 */
export interface ToolConfirmation {
  tool: string;
  video?: string;
  targets?: string[];
  summary: string;
  /** Message reference for `summary` (copy catalog rcAgentTools); approval actions without a reference field use `summary` only. */
  summaryRef?: MessageRef;
  risk?: RiskLevel;
  /**
   * Data this call sends out that no grant covers yet (§12.5). When given, passing confirmation grants this transfer: the note
   * carries back the user's choice (`grant`); an external service's `auto` level is not an outbound grant and is refused
   * outright with `GRANT_REQUIRED`.
   */
  grants?: GrantRequestItem[];
}

/** The one-line, human-facing approval summary: text in the current language and its reference. */
export function confirmSummary(summary: Localized): { summary: string; summaryRef: MessageRef } {
  return { summary: summary.text, summaryRef: refOf(summary) };
}

/** The confirmation result, recorded in the tool result (§3.12): the mode in effect (external services have none), the risk level and who decided. */
export interface ToolApprovalNote {
  mode: AgentMode | null;
  risk: RiskLevel;
  /** `rule`: the user earlier chose "Always allow", so the stored rule approved it automatically. */
  decidedBy: 'auto' | 'user' | 'rule';
  /** When a confirmation with an outbound grant passes: the user's grant choice (an automatic pass means this time only). Not included in the tool result. */
  grant?: ApprovalGrantChoice;
}

/**
 * Default tool risk levels (§3.12). Tools whose risk depends on arguments (model tools, `artifacts_save`, `export`) pass `risk`
 * when confirming; tools not listed here and given no risk are treated as `command`.
 */
export const TOOL_RISK: Readonly<Record<string, RiskLevel>> = {
  videos_create: 'edit',
  edits_apply: 'edit',
  edits_undo: 'edit',
  // Creating a caption layer (§7.9): one undoable edit, same level as edits_apply.
  captions_create: 'edit',
  // Writing documents and importing assets (§3.5): compiled into edits_apply operations, one undoable edit, same level.
  documents_put: 'edit',
  assets_import: 'edit',
  // Pruning unreferenced assets: read-only when only listing; with apply it compiles into removeAssets, one undoable edit, same level.
  assets_prune: 'edit',
  // Adopting source chapters: read-only with dryRun; otherwise compiled into one setChapters, one undoable edit, same level.
  chapters_adopt: 'edit',
  // Importing code graphics (architecture design §8): validated and baked, then compiled into two undoable edits (import asset, place clip); same level as assets_import.
  compositions_import: 'edit',
  // Opening a portable package: creates a new video directory, same level as videos_create.
  videos_import_package: 'edit',
  // Deriving a child video (§3.5): creates a new video directory next to the parent, copies it and cuts outside the range; the parent is unchanged; same level as videos_create.
  videos_derive: 'edit',
  // Grabbing frames (agent surface design §4.3): does not change the video, only writes frames to .cuccut-out/frames/ under the output directory; usable in plan mode.
  videos_frames: 'read',
  // Shot changes: read-only, no video changes, no files written; usable in plan mode.
  videos_shots: 'read',
  // Previewing code graphics: does not change the video, only grabs frames in an offscreen host into .cuccut-out/frames/; same level as videos_frames.
  compositions_preview: 'read',
  videos_history: 'read',
  edits_ops: 'read',
  export: 'edit',
  artifacts_save: 'edit',
  jobs_cancel: 'command',
  // Top-level verbs (agent surface design §4.2): start fixed pipelines; outbound grants are checked by the pipeline, not issued in the confirmation.
  transcribe: 'command',
  translate: 'command',
  dub: 'command',
  transcode: 'command',
  speak: 'command',
  image: 'command',
  // Downloading models (§6.3): the size is shown first; the access mode decides whether to ask.
  models_install: 'command',
  space_list: 'read',
  space_search: 'read',
  // Skill bodies (§3.8): reads only files registered in the skill directory.
  skills_read: 'read',
  grants_request: 'high',
  // Downloading from a link (§7.9, §12.9): the download is `command`; downloading yt-dlp first or consenting to it the first time is `high`, under separate approval names, so "Allow for this session" does not carry over between them.
  download: 'command',
  external_tools_install: 'high',
  external_tools_consent: 'high',
  // Copying a working-directory file to the downloads directory (§3.5, §7.9): a new file outside the working directory, only into the downloads directory, never overwriting; same level as download.
  downloads_save: 'command',
  // Deleting a video (§5.5, §5.7): moved to the trash and recoverable, but the video disappears from the editor; not on the MCP surface (`surfaces` has no `mcp`).
  videos_delete: 'high',
  // Jobs (agent surface design §4.3): wait and list are read-only; rerunning a failed fixed pipeline is the same level as cancel.
  jobs_wait: 'read',
  jobs_list: 'read',
  jobs_retry: 'command',
  // Local model bundle status is read-only; the sample check uses local compute, same level as submitting a job.
  models_list: 'read',
  models_test: 'command',
  // Creating a project: `edit` in the session's source directory, elsewhere it writes outside the project directory (`high`); given per path at call time; this is the default.
  projects_list: 'read',
  projects_create: 'high',
  // Moving a project-less session into a new project (§3.10): only creates a new directory under CucCut's projects directory and moves the session's own working directory, without overwriting files.
  projects_adopt_session: 'edit',
  skills_list: 'read',
  // User library (§5.9): read-only.
  library_list: 'read',
  library_show: 'read',
  // Slides (docs/design/slides §7.2): checking only reads files (records a card in the session when it passes); importing an asset writes to the deck directory's assets/, content-addressed, never overwriting.
  slides_check: 'read',
  slides_import_asset: 'edit',
  // Designs (docs/design/canvas §7.2): as for slides. Checking only reads files; importing an asset writes to the design directory's assets/.
  design_check: 'read',
  design_import_asset: 'edit',
  // Design systems (docs/design/canvas §10.5): as for designs. Checking only reads files; importing an asset writes to the design system directory's _blobs/.
  design_system_check: 'read',
  design_system_import_asset: 'edit',
  // Publishing (design m2-publishing §5): reads and plans are read-only; preparing, editing, reserving, pinning, proposing text, withdrawing and
  // archiving change only the publishing calendar (each undoable or restorable); approving an export and sending are the owner's trust decisions,
  // asked every time. Exporting the calendar writes a new file and changes nothing in CucCut; importing appends records from a file.
  publications_list: 'read',
  publications_inspect: 'read',
  publications_slots: 'read',
  publications_prepare: 'edit',
  publications_update: 'edit',
  publications_reschedule: 'edit',
  publications_reserve: 'edit',
  publications_pin: 'edit',
  publications_propose_copy: 'edit',
  publications_withdraw: 'edit',
  publications_archive: 'edit',
  publications_approve: 'high',
  publications_send: 'high',
  publications_export_calendar: 'read',
  publications_import_calendar: 'high',
};

export function toolRisk(request: ToolConfirmation): RiskLevel {
  return request.risk ?? TOOL_RISK[request.tool] ?? 'command';
}

/** A tool's default risk level (for catalog listings): unlisted tools are `command`. */
export function defaultToolRisk(tool: string): RiskLevel {
  return TOOL_RISK[tool] ?? 'command';
}

/** The `approval` field of a tool result: included when the confirmation returned a note (session calls), omitted otherwise. */
export function approvalField(note: ToolApprovalNote | void): { approval?: ToolApprovalNote } {
  if (!note) return {};
  const { grant: _, ...approval } = note;
  return { approval };
}

export interface VisibleArtifact {
  record: JobRecord;
  output: GeneratedOutput | null;
  file: string;
}

/** Where a new video goes: the source directory and the source. */
export interface VideoRoot {
  root: string;
  scope: { projectId: Id } | { conversationId: Id };
  note?: string;
}

/** Constraints on the export destination directory (see `ToolScope.exportBase`). */
export interface ExportBase {
  base: string;
  within: string | null;
  ownDefault: boolean;
}

/**
 * One `projects_list` entry: a registered project within scope, with its (in-scope) video count, omitted when it cannot be
 * counted. `path` is the absolute project directory, omitted for external services (their clients use project ids only).
 */
export interface ScopedProject {
  projectId: Id;
  name: string;
  path?: string;
  videoCount?: number;
}

/** Registered project -> one `projects_list` entry. */
export function scopedProject(project: Project, extra: { path?: boolean; videoCount?: number | undefined } = {}): ScopedProject {
  return {
    projectId: project.id,
    name: project.name,
    ...(extra.path === false ? {} : { path: project.path }),
    ...(extra.videoCount !== undefined ? { videoCount: extra.videoCount } : {}),
  };
}

export interface ToolScope<A extends ToolAccess = ToolAccess> {
  /** Whether the call is allowed (`write`: changes videos, submits or cancels jobs, writes files). Throws `ToolError` if not. */
  authorize(principal: ToolPrincipal, write: boolean): A;
  /**
   * Confirms a call with side effects before it runs: looked up by the scope's mode (or level) and the risk; automatic ones pass
   * immediately, those that must ask wait for the user, and a refusal throws `ToolError`. The returned note may go into the tool
   * result; undefined when there is none.
   */
  confirm(access: A, request: ToolConfirmation): Promise<ToolApprovalNote | void>;
  /** The result of `videos_list`: the videos in scope. */
  listVideos(access: A): Promise<Record<string, unknown>>;
  /**
   * Where a new video goes. `project` is the caller's project (a project id or the path of a registered project directory): in
   * a session it defaults to the session's source directory and, when given, can only be the session's own project; an external
   * service must give it (`INVALID_ARGUMENTS` if missing), and projects it cannot see are answered like missing ones with
   * `PROJECT_NOT_FOUND`; in a terminal it resolves to a project directory from cwd. `note` is a note for the caller (e.g. it
   * landed in the default project), which `videos_create` includes in its result.
   * A session that belongs to no project creates videos in its working directory (§3.10) without creating a project; `locate`
   * only finds the location without preparing for creation (before confirming, when deleting a video; the terminal scope does
   * not register a project).
   */
  createRoot(access: A, project?: string, options?: { locate?: boolean }): VideoRoot | Promise<VideoRoot>;
  /** Opens (or attaches to an already open) video in scope. Out-of-scope videos are answered like missing ones with `VIDEO_NOT_FOUND`. */
  open(video: string, access: A): Promise<VideoOpenResult>;
  /**
   * The videoId of a video in scope, named as `open` takes it (a path or a videoId), without opening it (publishing tools, design
   * m2-publishing §4.2). Out-of-scope and missing videos are answered with `VIDEO_NOT_FOUND`.
   */
  videoIdOf?(video: string, access: A): Promise<Id>;
  /**
   * Which of `videoIds` are in scope, without opening any video (publishing tools, design m2-publishing §4.2: a publication is visible only
   * when its video is). A scope that does not implement it sees none.
   */
  visibleVideoIds?(access: A, videoIds: readonly Id[]): Promise<Set<Id>>;
  /** The directory `importAsset.path` is relative to; when `confine` is non-null the path (by real path) must be inside it. */
  importBase(access: A, opened: VideoOpenResult): { cwd: string; confine: string | null };
  /**
   * The directory that caller-given local files (`transcribe`'s `file`, `translate`'s `file`, `transcode`'s `files` and
   * `outDir`) are relative to: the session's working directory, or the terminal's cwd. External services have no entry point for
   * local paths and are refused with `INVALID_ARGUMENTS` (`next` points to `video` / `url`).
   */
  fileBase(access: A): string;
  /** Turns the caller's idempotency key into the one used for submission; generates a new one when none is given. */
  commandId(access: A, given: string | undefined): string;
  /** A visible job; invisible ones are answered like missing ones. */
  visibleJob(jobId: Id, access: A): Promise<JobRecord>;
  /** All visible jobs (`jobs_list`), newest first; same scope as `visibleJob`. */
  visibleJobs(access: A): Promise<JobRecord[]>;
  /** Registered projects within scope (`projects_list`). */
  listProjects(access: A): Promise<ScopedProject[]>;
  /** An artifact of a visible job. */
  visibleArtifact(artifactId: string, access: A): Promise<VisibleArtifact>;
  /** Jobs submitted by this call's own principal (the ones it may cancel). */
  owns(record: JobRecord, access: A): boolean;
  /** After an edit is committed: a session posts a change card; external services do nothing (auditing is recorded in the service). */
  recordChange(access: A, change: VideoChange): void;
  /** After `videos_create` creates a video: a session records a `video-created` entry; an external service adds it to its own video scope (visible afterwards). */
  recordCreated?(access: A, created: VideoCreated): void | Promise<void>;
  /** After `slides_check` passes: a session records a `slides-created` entry (one per deck); external services have no session and do nothing. */
  recordSlides?(access: A, created: SlidesCreated): void;
  /** After `design_check` finds no problems: a session records a `design-created` entry (one per design); external services have no session and do nothing. */
  recordDesign?(access: A, created: DesignCreated): void;
  /** After `design_system_check` finds no problems: a session records a `design-system-created` entry (one per design system); external services have no session and do nothing. */
  recordDesignSystem?(access: A, created: DesignSystemCreated): void;
  /**
   * A video a fixed pipeline created for the caller (`newVideo` when `download` / `transcribe` get a link): an external service
   * adds it to its own video scope; a session does nothing (the video card comes from the pipeline's job card).
   */
  adoptCreatedVideo?(access: A, videoId: Id): void | Promise<void>;
  /**
   * The directory for writing files: the target of `artifacts_save`; `videos_frames` writes frames into `.cuccut-out/frames/`
   * under it; `videos_import_package` relative paths resolve against it too. With `opened`, it is for writing on behalf of that
   * video (external services provide it only then: the `exports/` of the video's project).
   */
  saveRoot(access: A, opened?: VideoOpenResult): string;
  /**
   * The destination directory for `export`: `dir` is relative to `base` and, by real path, cannot leave `base`. With
   * `ownDefault`, omitting `dir` still exports to `base` (created inside `within` when missing); otherwise omitting `dir` uses
   * the export service's default location (the `exports/` of the video's source directory).
   * When `within` is null there is no directory constraint: `dir` may be absolute, and relative ones resolve against `base`
   * (the user themselves in a terminal).
   */
  exportBase(access: A, opened: VideoOpenResult): ExportBase;
  /** The protections the current task's contract places on this video (§3.2), passed to the engine with edits. Scopes without task contracts (external services) do not implement it. */
  protections?(access: A, videoId: Id): EngineProtection[];
  /**
   * The agent is about to translate a transcript itself (`documents_read` given `translateTo`): registers a progress record
   * (`kind: 'agentTranslate'`) and returns its jobId; reuses the record for the same video, transcript and language while it is
   * still running. Only the session agent implements it: other scopes register nothing and return null.
   */
  translationStarted?(access: A, start: TranslationScope & { sentences: number; sourceRevision?: string }): Id | null;
  /** A translation was written (`putDocument` kind `translation`): the matching progress record completes. */
  translationWritten?(access: A, written: TranslationScope & { documentId: Id | null }): void;
}

/** What the agent is translating itself: which transcript of which video, into which language. */
export interface TranslationScope {
  videoId: Id;
  sourceDocumentId: Id;
  language: string;
}

/**
 * Forwards calls to each principal kind's own scope (§3.5): one catalog serves both the session agent (tool bridge) and the
 * user themselves in a terminal (`catalog.call`). After authorization, calls are forwarded by `access.principal`, and the
 * access object is always the one that scope produced. Unregistered kinds are always `FORBIDDEN`.
 */
export class ScopeRouter implements ToolScope<ToolAccess> {
  readonly #scopes: Partial<Record<ToolPrincipal['kind'], ToolScope>>;

  constructor(scopes: Partial<Record<ToolPrincipal['kind'], ToolScope>>) {
    this.#scopes = scopes;
  }

  #of(principal: ToolPrincipal): ToolScope {
    const scope = this.#scopes[principal.kind];
    if (!scope) throw new ToolError('FORBIDDEN', 'This tool channel does not serve this kind of caller');
    return scope;
  }

  authorize(principal: ToolPrincipal, write: boolean): ToolAccess {
    return this.#of(principal).authorize(principal, write);
  }
  confirm(access: ToolAccess, request: ToolConfirmation): Promise<ToolApprovalNote | void> {
    return this.#of(access.principal).confirm(access, request);
  }
  listVideos(access: ToolAccess): Promise<Record<string, unknown>> {
    return this.#of(access.principal).listVideos(access);
  }
  createRoot(access: ToolAccess, project?: string, options?: { locate?: boolean }): VideoRoot | Promise<VideoRoot> {
    return this.#of(access.principal).createRoot(access, project, options);
  }
  open(video: string, access: ToolAccess): Promise<VideoOpenResult> {
    return this.#of(access.principal).open(video, access);
  }
  async videoIdOf(video: string, access: ToolAccess): Promise<Id> {
    const scope = this.#of(access.principal);
    if (!scope.videoIdOf) throw new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found`);
    return scope.videoIdOf(video, access);
  }
  async visibleVideoIds(access: ToolAccess, videoIds: readonly Id[]): Promise<Set<Id>> {
    return (await this.#of(access.principal).visibleVideoIds?.(access, videoIds)) ?? new Set();
  }
  importBase(access: ToolAccess, opened: VideoOpenResult): { cwd: string; confine: string | null } {
    return this.#of(access.principal).importBase(access, opened);
  }
  fileBase(access: ToolAccess): string {
    return this.#of(access.principal).fileBase(access);
  }
  commandId(access: ToolAccess, given: string | undefined): string {
    return this.#of(access.principal).commandId(access, given);
  }
  visibleJob(jobId: Id, access: ToolAccess): Promise<JobRecord> {
    return this.#of(access.principal).visibleJob(jobId, access);
  }
  visibleJobs(access: ToolAccess): Promise<JobRecord[]> {
    return this.#of(access.principal).visibleJobs(access);
  }
  listProjects(access: ToolAccess): Promise<ScopedProject[]> {
    return this.#of(access.principal).listProjects(access);
  }
  visibleArtifact(artifactId: string, access: ToolAccess): Promise<VisibleArtifact> {
    return this.#of(access.principal).visibleArtifact(artifactId, access);
  }
  owns(record: JobRecord, access: ToolAccess): boolean {
    return this.#of(access.principal).owns(record, access);
  }
  recordChange(access: ToolAccess, change: VideoChange): void {
    this.#of(access.principal).recordChange(access, change);
  }
  recordCreated(access: ToolAccess, created: VideoCreated): void | Promise<void> {
    return this.#of(access.principal).recordCreated?.(access, created);
  }
  recordSlides(access: ToolAccess, created: SlidesCreated): void {
    this.#of(access.principal).recordSlides?.(access, created);
  }
  recordDesign(access: ToolAccess, created: DesignCreated): void {
    this.#of(access.principal).recordDesign?.(access, created);
  }
  recordDesignSystem(access: ToolAccess, created: DesignSystemCreated): void {
    this.#of(access.principal).recordDesignSystem?.(access, created);
  }
  adoptCreatedVideo(access: ToolAccess, videoId: Id): void | Promise<void> {
    return this.#of(access.principal).adoptCreatedVideo?.(access, videoId);
  }
  saveRoot(access: ToolAccess, opened?: VideoOpenResult): string {
    return this.#of(access.principal).saveRoot(access, opened);
  }
  exportBase(access: ToolAccess, opened: VideoOpenResult): ExportBase {
    return this.#of(access.principal).exportBase(access, opened);
  }
  protections(access: ToolAccess, videoId: Id): EngineProtection[] {
    return this.#of(access.principal).protections?.(access, videoId) ?? [];
  }
  translationStarted(access: ToolAccess, start: TranslationScope & { sentences: number; sourceRevision?: string }): Id | null {
    return this.#of(access.principal).translationStarted?.(access, start) ?? null;
  }
  translationWritten(access: ToolAccess, written: TranslationScope & { documentId: Id | null }): void {
    this.#of(access.principal).translationWritten?.(access, written);
  }
}

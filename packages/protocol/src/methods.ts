import type { AgentMode, PendingApproval, PendingApprovalDecision } from './access.ts';
import type { MessageRef } from './message-ref.ts';
import type {
  AgentPolicy,
  AgentPreferences,
  AgentSetupAction,
  AgentSetupRun,
  ApprovalDecision,
  AttachmentRef,
  Autonomy,
  Conversation,
  DriverId,
  DriverInfo,
  DriverInstallOption,
  EditorContext,
  Id,
  Project,
  RuntimeInfo,
  RuntimeStatus,
  SpaceEntry,
  SpaceEntryKind,
  TaskStatus,
  VideoDeriveParams,
  VideoDeriveResult,
  VideoShotsParams,
  VideoShotsResult,
} from './domain.ts';
import type { ConversationSnapshot, DirectorySnapshot, SequencedEvent, Topic } from './events.ts';
import type { ExportCreateRequest, ExportRenderTextRequest, ExportRenderTextResult } from './exports.ts';
import type {
  GenerateImageRequest,
  GenerateMusicRequest,
  GenerateTextRequest,
  JobReconcileDecision,
  JobRecord,
  JobState,
  SynthesizeSpeechRequest,
  TranscribeRequest,
} from './jobs.ts';
import type { ApprovalGrantChoice, Grant, GrantCreateParams, GrantRevokeResult, GrantUpdateParams, GrantUsageReport } from './grants.ts';
import type { ApplySpeakersParams, PipelineInfo } from './pipelines.ts';
import type {
  CheckDefinition,
  CheckOutcome,
  CheckResult,
  TaskContract,
  TaskContractInput,
  TaskContractPatch,
  TaskContractView,
} from './tasks.ts';
import type { ResourcesSnapshot } from './resources.ts';
import type { CookieBrowserInfo, ExternalToolInstallResult, ExternalToolStatus, ExternalToolUpdateResult } from './external-tools.ts';
import type {
  DownloadedFontFace,
  FontDownloadErrorCode,
  FontDownloadResult,
  FontFaceStyle,
  FontRemoveResult,
  FontSampleResult,
  FontsCatalogueParams,
  FontsCatalogueResult,
  FontsUsageResult,
} from './fonts.ts';
import type { ToolCandidatesParams, ToolCandidatesResult, ToolsListResult } from './tool-catalogue.ts';
import type { CatalogAgentSkill, CatalogCallParams, CatalogCallResult, CatalogListResult } from './catalog.ts';
import type { UsageReport, UsageRequest } from './usage.ts';
import type {
  AddProviderAccountRequest,
  ArrangeProviderAccountsRequest,
  ConfigureProviderRequest,
  UpdateProviderAccountRequest,
  ModelBundleStatus,
  ModelCapabilitiesView,
  ModelInstallResult,
  ModelRemoveResult,
  ModelRef,
  ModelsDirChangeResult,
  ModelsDirInfo,
  ModelsDirInspection,
  ModelsDirMode,
  ModelServiceCapability,
  ProviderRefreshStatus,
  ProviderView,
  SetCapabilityParametersRequest,
  TextCapabilityParameters,
} from './models.ts';
import type {
  LibraryApplyParams,
  LibraryApplyResult,
  LibraryEntry,
  LibraryEntryRef,
  LibraryEntrySummary,
  LibraryExportResult,
  LibraryName,
  LibraryPutParams,
  LibrarySetSelectionParams,
  LibrarySetSelectionResult,
  VideoLibrarySelection,
  VoiceCloneCreateParams,
  VoiceCloneRemoveParams,
  VoiceCloneRemoveResult,
} from './library.ts';
import type { DiscoveredNode, PairedNode, ShareStartParams, ShareStatus } from './nodes.ts';
import type {
  CompositionImportParams,
  CompositionImportResult,
  CompositionPreviewParams,
  CompositionPreviewResult,
} from './code-bundle.ts';
import type { TemplateDetail, TemplateListResult, TemplateSendRef } from './template.ts';
import type { SkillChangeResult, SkillDetail, SkillFileContent, SkillListResult, SkillRemoveResult, SkillSendRef } from './skill.ts';
import type {
  InterviewAnswers,
  InterviewState,
  ProfileRule,
  ProfileRuleInput,
  ProfileRulePutResult,
  ProfileSnapshot,
  ProfileWriteResult,
  ProjectProfile,
} from './profile.ts';
import type {
  SpaceContinueResult,
  SpaceListParams,
  SpaceListResult,
  SpaceOpenForEditResult,
  SpacePurgeResult,
  SpaceRebuildResult,
  SpaceSearchParams,
  SpaceSearchResult,
  SpaceThumbnail,
  VideoDeleteResult,
  VideoRestoreResult,
} from './space.ts';
import type { SettingInputValues, SettingKey, SettingsSnapshot, SettingsView } from './settings.ts';
import type {
  McpConnectionInfo,
  ModelApiAlias,
  ModelApiConnectionInfo,
  ServiceApprovalDecision,
  ServiceClient,
  ServiceConfigureParams,
  ServiceId,
  ServiceStatus,
} from './services.ts';
import type { WebAccessLink, WebSession } from './web.ts';
import type { SlideAnnotation, SlidesOpenResult } from './slides.ts';
import type { DesignAnnotation, DesignOpenResult } from './design.ts';
import type { DesignSystemAnnotation, DesignSystemOpenResult } from './design-system.ts';
import type { LegacyImportAnswer, LegacyImportRetry, LegacyImportSetSkipped, LegacyImportSnapshot } from './legacy-import.ts';
import type { Seq } from './domain.ts';
import type { PlaybackCodec } from './limits.ts';
import type {
  DocumentContent,
  EditOperation,
  HistoryEntry,
  MissingAsset,
  VideoRef,
  VideoTopicSnapshot,
  Rate,
  Revision,
  TransactionReceipt,
  UndoState,
  UndoTarget,
} from './video.ts';

/**
 * Public method table (architecture design §4.1). The UI, CLI and external agents send the same set of requests.
 *
 * Rules:
 * - Public requests do not carry `actor` or any trust marker; identity is built by the Runtime from the authenticated connection (§4.2).
 * - Commands that have side effects carry `commandId`; retrying with the same key returns the same result.
 */
export interface RpcMethods {
  'runtime.info': { params: Record<string, never>; result: RuntimeInfo };
  /** Connection, tasks and idle exit (architecture design §2.2): given only to `cli` and `desktop` connections; all others get `forbidden`. */
  'runtime.status': { params: Record<string, never>; result: RuntimeStatus };
  /**
   * Ask the Runtime launched by the CLI to stop (`cuccut runtime stop`, architecture design §2.2): only for `cli` connections; if the CLI did not launch it, `forbidden`
   * (`details.code: 'RUNTIME_NOT_OWNED'`); with a desktop connected, `conflict` (`RUNTIME_IN_USE`). The response is sent first, then shutdown proceeds in stop order.
   */
  'runtime.stop': { params: Record<string, never>; result: { stopping: true } };
  /** Legacy project import prompts and the imports in this startup (architecture design §2.7): same as the snapshot of the `legacy-import` topic. Not on the Web service allowlist. */
  'legacyImport.get': { params: Record<string, never>; result: LegacyImportSnapshot };
  /**
   * Answer an import prompt: `import` records the directory and starts importing in the background; `never` records that nothing should be imported later. When `promptId` is not the prompt being waited on, `not-found`;
   * when `directory` is not an absolute path, falls inside the legacy or Runtime's own data directory, or cannot be created or written, `invalid-request`.
   */
  'legacyImport.answer': { params: LegacyImportAnswer; result: Record<string, never> };
  /**
   * Re-import legacy projects that were not imported (`paths` defaults to all not-yet-imported ones; named skipped items are also re-imported, clearing the skip record). Other running tasks are queued first.
   * With no import in this run, or nothing to retry, `queued: 0`. Given only to the desktop UI and CLI (`forbidden`).
   */
  'legacyImport.retry': { params: LegacyImportRetry; result: { queued: number } };
  /**
   * Skip not-yet-imported projects: record them and do not import them automatically later; `skipped: false` cancels the skip. `changed` is the number changed (paths that are not in this import,
   * or are in the wrong state, are ignored). Given only to the desktop UI and CLI (`forbidden`).
   */
  'legacyImport.setSkipped': { params: LegacyImportSetSkipped; result: { changed: number } };

  /** Agent list and preferences (Settings › Agent providers). Probe results are cached briefly. */
  'agents.list': { params: Record<string, never>; result: AgentsView };
  /** “Re-detect”: skips the cache, re-probes installation, version and login, and refreshes the model table. */
  'agents.detect': { params: { driverId?: DriverId }; result: AgentsView };
  /** Enable or disable an Agent, set its default model and intensity, or specify its executable manually (null clears the specification). */
  'agents.configure': {
    params: {
      driverId: DriverId;
      enabled?: boolean;
      defaultModel?: string | null;
      defaultEffort?: string | null;
      executable?: string | null;
    };
    result: AgentsView;
  };
  /** Which Agent new sessions use by default: writes the preference `agent.defaultDriver` (architecture design §3.11, §5.10). */
  'agents.setDefault': { params: { driverId: DriverId }; result: AgentsView };
  /**
   * Add an ACP-speaking agent (architecture design §3.11): stored in `store/agent-providers.json`, immediately registered as a Driver, and probed in the background.
   * `id` must not duplicate a built-in or already-added one (a duplicate gives `conflict`, `details.code: 'AGENT_PROVIDER_EXISTS'`); retrying with the same `commandId` returns the same result.
   * Browsers and external services cannot call it: it decides which command runs on this machine.
   */
  'agents.addProvider': {
    params: { id: DriverId; name: string; command: string[]; env?: Record<string, string>; commandId?: Id };
    result: AgentsView;
  };
  /**
   * Remove a user-added agent: unregister the Driver, and delete its probe cache and its entry in the Agent preferences; clear `agent.defaultDriver` if it points to this agent.
   * Tasks using it end as failed, and later sends on those sessions are rejected with `driver-unavailable`. Built-in agents cannot be removed (`invalid-request`,
   * `details.code: 'AGENT_PROVIDER_BUILTIN'`; use `agents.configure` to disable them); an id that does not exist gives `not-found`.
   */
  'agents.removeProvider': { params: { id: DriverId }; result: AgentsView };
  /** Preferences such as the access policy and automatic updates of the model table. */
  'agents.updatePreferences': {
    params: { policy?: Partial<AgentPolicy>; modelAutoUpdate?: boolean };
    result: AgentsView;
  };
  /** Remove an “always allow” rule. If it does not exist, it is returned as is. */
  'agents.removeRule': { params: { rule: string }; result: AgentsView };
  /** Handle one approval in a session (same implementation as `approvals.respond`). `accept-for-session` stops asking about the same kind of action in this task; `accept-always` saves a separate rule. */
  'agents.respondToApproval': {
    params: { conversationId: Id; approvalId: Id; decision: ApprovalDecision };
    result: { status: 'accepted' | 'declined' | 'already-resolved' };
  };
  /** Secondary action: stops only the current model turn (D04); pending approvals are treated as cancelled. The main stop button uses `tasks.stop`. */
  'agents.interrupt': {
    params: { conversationId: Id };
    result: { status: 'requested' | 'no-active-turn' };
  };
  /**
   * Run an Agent's install or upgrade command inside the app (architecture design §12.9). The caller first has the user confirm the full command that will run.
   *
   * - No command in the parameters: the Runtime takes `install[].command` (install) or `upgrade` (upgrade) from the current probe results by `kind`; if there is no such method, `invalid-request`. The `script` kind (download and run a script from the network) is always `invalid-request`; it can only be copied or opened with `agents.openTerminal`.
   * - No privilege escalation and no input reading: stdin is closed; a command that asks for a password fails immediately, and the UI asks the user to run it in a terminal instead.
   * - If the same Agent already has a run in progress: `busy`; retrying with the same `commandId` returns that same run.
   * - Output and status are delivered through the `agent-setup` topic; when done, the Runtime re-probes the Agent and then sends the final state.
   */
  'agents.runSetup': {
    params: { driverId: DriverId; action: AgentSetupAction; kind: DriverInstallOption['kind']; commandId: Id };
    result: { run: AgentSetupRun };
  };
  /** Stop a `agents.runSetup` that is still running. Parts already done are not rolled back. An unknown `runId` gives `not-found`. */
  'agents.cancelSetup': {
    params: { runId: Id };
    result: { status: 'requested' | 'not-running' };
  };
  /**
   * Open the system terminal and run the login, install or upgrade command in it (architecture design §12.9: commands that need a password or administrator rights are handed to the system terminal).
   * The command is also taken from the probe results: `login` uses `loginCommand`; `install` / `upgrade` must give `kind` (the `script` kind is allowed too).
   * If no matching command is found, `invalid-request`. If no terminal can be opened on this platform, `unsupported`, and the caller falls back to copying `command`.
   * The Runtime only opens the terminal and does not know the result of the command there; the UI then uses “re-detect”.
   */
  'agents.openTerminal': {
    params: { driverId: DriverId; action: 'login' | AgentSetupAction; kind?: DriverInstallOption['kind'] };
    result: { status: 'opened' | 'unsupported'; command: string };
  };

  'projects.list': { params: Record<string, never>; result: { projects: Project[] } };
  /**
   * Register an existing directory as a project (architecture design §5.1). The project's identity is in `.ccut/project.json` in the directory; it is written if absent.
   * Opening the same directory again, or opening it after it has been moved or renamed, returns the same project; a copied directory gets a new project.
   * If the directory is not writable and the marker must be written, `forbidden` (`details.code: 'PROJECT_DIR_READ_ONLY'`);
   * if the marker's version is newer than this Runtime, `conflict` (`details.code: 'PROJECT_MARKER_UNSUPPORTED'`), and the marker is not rewritten.
   */
  'projects.open': { params: { path: string }; result: { project: Project } };
  /** Create a new directory under `RuntimeInfo.projectsDir`, write the project marker and register it as a project; a duplicate name gets an automatic sequence number. */
  'projects.create': { params: { name?: string; commandId?: Id }; result: { project: Project } };
  /** Change the display name, pin or archive. Only changes the registration; does not touch the directory. */
  'projects.update': {
    params: { projectId: Id; name?: string; pinned?: boolean; archived?: boolean };
    result: { project: Project };
  };
  /**
   * List the files in the directory where the session lives (the project directory when it belongs to a project, otherwise the session's working directory) (architecture design §11.2).
   * Without `query`, lists one level at `dir` (relative to the root; default is the root); with `query`, searches recursively by name under `dir`.
   * Skips hidden files and dependency directories; symbolic links at the root are not listed. To read file contents, use `media.resolve` with `{ conversationId, path }`.
   */
  'projects.files.list': {
    params: { conversationId: Id; dir?: string; query?: string; limit?: number };
    result: ProjectFilesList;
  };
  /**
   * Create a new file with UTF-8 text in the same root directory (the project directory, or the working directory of a session not in a project; with `projectId`, the project directory) (the “New web page” on the new tab start page, product design §3.3).
   * `dir` is relative to the root, default root; after resolving symlinks it must still be inside the root, and it cannot be a hidden directory, dependency directory or video directory (or anything inside them).
   * `name` keeps only its last segment; empty names, `.`, `..` and names starting with `.` are rejected.
   * Created exclusively, never overwriting: on a name clash, tries `name 2.ext`, `name 3.ext`, and so on. Returns the location and entry of the new file: `{ projectId, path }` when it belongs to a project, otherwise `{ conversationId, path }`.
   */
  'projects.files.create': {
    params: ({ conversationId: Id } | { projectId: Id }) & { name: string; content: string; dir?: string };
    result: { target: FileTarget; entry: ProjectFileEntry };
  };

  'conversations.list': { params: Record<string, never>; result: DirectorySnapshot };
  /**
   * Create a new session. Any Agent, model or intensity not given is taken from the preference defaults (`agent.defaultDriver`, that Agent's default model and intensity);
   * once created it is fixed on the session, and changing preferences does not affect existing sessions (architecture design §3.11). If `accessMode` is not given (or null), the session follows `agent.defaultAccessMode` (§3.12); if given, it is equivalent to switching once after creation (old values accepted).
   * `folderOf`: the new session uses this session's working directory (when starting a new session from a video that is not in a project, the new session must be able to open that video and the files beside it, §3.10);
   * if that session belongs to a project, the new session is created in that project and `projectId` is ignored.
   */
  'conversations.create': {
    params: {
      projectId?: Id | null;
      folderOf?: Id;
      title?: string;
      commandId?: Id;
      driverId?: DriverId;
      model?: string | null;
      effort?: string | null;
      accessMode?: AgentMode | Autonomy | null;
    };
    result: { conversation: Conversation };
  };
  'conversations.get': {
    params: { conversationId: Id };
    result: ConversationSnapshot & { seq: Seq };
  };
  /**
   * Change the title, pin, archive state, Agent, model, intensity or access mode. Archiving only affects list display and does not cancel tasks (product design §2.3).
   * The model and intensity can be changed at any time and take effect on the next turn. The Agent can only be changed while the session has no tasks; otherwise the change gives `conflict`.
   * `accessMode` switches the session's mode (architecture design §3.12): it applies immediately to later actions (even while a task is running), and a notice is recorded in the session;
   * old values are accepted (`controlled`, `authorized`); `null` returns to following `agent.defaultAccessMode`. `pendingReferences: null` removes Space entry references that have not been sent yet (`space.continueInConversation`).
   */
  'conversations.update': {
    params: {
      conversationId: Id;
      title?: string;
      pinned?: boolean;
      archived?: boolean;
      driverId?: DriverId;
      model?: string | null;
      effort?: string | null;
      accessMode?: AgentMode | Autonomy | null;
      pendingReferences?: null;
    };
    result: { conversation: Conversation };
  };
  /** The user has seen it: clears “completed, unread”. */
  'conversations.markRead': { params: { conversationId: Id }; result: { conversation: Conversation } };
  /** Deletes only the session record in the Runtime Store; deletes no files in the project directory (architecture design §3.10). */
  'conversations.delete': { params: { conversationId: Id }; result: { deleted: true } };
  /**
   * Send a user message, create a task and start a turn. `context`: the video and selection open in the editor, given to the agent as context.
   * `accessMode` (old name `autonomy`; if both are given, `accessMode` wins). If it differs from the session's current mode, it is the same as switching the session's mode first (§3.12);
   * if neither is given, the session's mode is used, and if the session has never been switched, `agent.defaultAccessMode`.
   * `attachments`: images that were obtained with `attachments.prepare` and are fully uploaded. If the session still has a task running, `busy` (the UI queues the message to send after the task ends, or uses `conversations.steer` to insert it into the current turn).
   * The task contract (architecture design §3.2) is set up with the task: the parts given in `contract` are used, the rest take defaults (scope from `context`; `autonomy` is the current mode).
   * `template`: the scene template attached (template package spec §5.2). The Runtime reads the template as it currently is in the directory and appends the brief's guidance preamble, the body of `prompt.md` and the asset list to the text handed to the agent; the message in the session stays `text`, with a template marker. Without that template: `not-found` (`TEMPLATE_NOT_FOUND`);
   * the body of a showcase example (`kind: 'example'`) is already user input, so `invalid-request` (`TEMPLATE_NOT_SCENE`); if `assets` contains a path not registered in the manifest: `invalid-request` (`TEMPLATE_FILE_NOT_FOUND`).
   * `skills`: the skills picked (architecture design §3.8), in the order attached; enabled and disabled ones are both allowed. `skill` is the old form for picking just one; if both are given, `skill` comes first and duplicate ids count only once (`sendSkillRefs`).
   * The Runtime reads the current `SKILL.md` in the directory and wraps each skill's body together with “which other files are in the same directory; get them with `skills_read`” into one segment; the segments are appended in order to the text handed to the agent (after the template segment), and the message carries skill markers in the same order.
   * If any one does not exist, the whole request is `not-found` (`SKILL_NOT_FOUND`).
   * `slideAnnotations`: annotations added to the draft from slide labels (docs/design/slides §9), at most `SLIDE_ANNOTATION_LIMITS.perMessage`.
   * The Runtime turns each deck into a path relative to the session working directory, and appends one `<cuccut-slide-annotations>` segment per deck at the end of the text handed to the agent; the message carries a copy unchanged. If a deck's location cannot be found (its Space entry or project is gone), the whole request is `not-found`.
   * `designAnnotations`: annotations added to the draft from design labels (docs/design/canvas §9); the limits are the same as for slide annotations (`DESIGN_ANNOTATION_LIMITS`).
   * One `<cuccut-design-annotations>` segment per design, appended after the slide annotation segment; numbering starts at 1 in each. If a design is not found, the whole request is likewise `not-found`.
   * `designSystemAnnotations`: annotations added to the draft from design-system labels (docs/design/canvas §10.6); the limits are the same (`DESIGN_SYSTEM_ANNOTATION_LIMITS`).
   * One `<cuccut-design-system-annotations>` segment per design system, appended after the design annotation segment; numbering starts at 1 in each. If a design system is not found, likewise the whole request is `not-found`.
   */
  'conversations.send': {
    params: {
      conversationId: Id;
      text: string;
      commandId: Id;
      accessMode?: AgentMode | Autonomy;
      autonomy?: AgentMode | Autonomy;
      context?: EditorContext;
      attachments?: Id[];
      contract?: TaskContractInput;
      template?: TemplateSendRef;
      skill?: SkillSendRef;
      skills?: SkillSendRef[];
      slideAnnotations?: SlideAnnotation[];
      designAnnotations?: DesignAnnotation[];
      designSystemAnnotations?: DesignSystemAnnotation[];
    };
    result: { taskId: Id };
  };
  /**
   * Insert a message into the turn that is running (when the Agent supports it). If unsupported or no turn is running, report that honestly and let the UI decide whether to queue it or stop first and then send.
   * `slideAnnotations`, `designAnnotations` and `designSystemAnnotations` are the same as in `conversations.send`.
   */
  'conversations.steer': {
    params: {
      conversationId: Id;
      text: string;
      commandId: Id;
      attachments?: Id[];
      slideAnnotations?: SlideAnnotation[];
      designAnnotations?: DesignAnnotation[];
      designSystemAnnotations?: DesignSystemAnnotation[];
    };
    result: { status: 'steered' | 'unsupported' | 'no-active-turn' };
  };

  /**
   * Register an image or ordinary file to be sent with a message, and get a one-time upload address (same port as the media channel; `PUT` the raw bytes, with a Content-Type matching the declaration).
   * Size and format are checked against `MAX_ATTACHMENT_BYTES` and `ATTACHMENT_UPLOAD_MIME_TYPES`; sending before the upload completes gives `invalid-params`.
   * The address expires if unused for a while.
   */
  'attachments.prepare': {
    params: { fileName: string; mimeType: string; size: number };
    result: { attachment: AttachmentRef; uploadUrl: string };
  };

  /** Main stop (D04): first forbid new calls and automatic approvals, treat pending approvals as cancelled, then request interruption of the turn. */
  'tasks.stop': { params: { taskId: Id }; result: { status: TaskStatus } };
  /**
   * Create and start a task with an explicit contract (same implementation as `conversations.send` with `contract`; `goal` is the message sent to the agent).
   * `busy` while the session still has a task running.
   */
  'tasks.create': {
    params: {
      conversationId: Id;
      goal: string;
      commandId: Id;
      accessMode?: AgentMode;
      context?: EditorContext;
      contract?: TaskContractInput;
    };
    result: { taskId: Id; contract: TaskContract };
  };
  /** A task's contract: the latest revision by default, or that revision if `revision` is given; together with the task's budget usage. */
  'tasks.getContract': { params: { taskId: Id; revision?: number }; result: TaskContractView };
  /** Given `conversationId`: the latest contract of each task in this session, newest first. Given `taskId`: all revisions of this task, oldest first. */
  'tasks.listContracts': { params: { conversationId: Id } | { taskId: Id }; result: { contracts: TaskContract[] } };
  /**
   * Change the contract of a task in progress, producing a new revision. If `expectedRevision` is not the latest revision, `conflict` (`CONTRACT_REVISION_CONFLICT`); if the task has already ended, `conflict` (`TASK_NOT_RUNNING`).
   * Steps not yet started adopt the new constraints; Jobs whose inputs are already frozen are unchanged.
   * `autonomy` is the same as switching the session's access mode (§3.12). The same `commandId` takes effect only once.
   */
  'tasks.updateContract': {
    params: { taskId: Id; expectedRevision: number; commandId: Id; patch: TaskContractPatch };
    result: { contract: TaskContract };
  };
  /**
   * Change the goal (§3.2): `previousWork: 'stop'` stops the old task and cancels the Jobs it has submitted that have not finished; `keep` only stops the old task's turn, and submitted Jobs finish as usual with their outputs kept as candidates.
   * A new task is then created with the new goal (a new Run); its contract is derived from the old one (`supersedes`), the budget cap is carried over, and usage starts from zero.
   */
  'tasks.changeGoal': {
    params: { taskId: Id; goal: string; previousWork: 'stop' | 'keep'; commandId: Id };
    result: { taskId: Id; previousTaskId: Id; contract: TaskContract };
  };
  /** Record the result of one acceptance check (in the first version recorded by the user or the agent; automatic execution by QualityService is still to be decided, architecture design §14). Results can also be recorded after the task ends. */
  'tasks.recordCheck': {
    params: { taskId: Id; checkId: Id; outcome: CheckOutcome; note?: string; commandId?: Id };
    result: { result: CheckResult };
  };
  /** A task's acceptance checks (from the latest contract) and the recorded results, oldest first. */
  'tasks.listChecks': { params: { taskId: Id }; result: { checks: CheckDefinition[]; results: CheckResult[] } };

  /** Pending approvals (architecture design §3.12): both the session's and the external services', oldest first. Same as `approvals` in the `tasks` topic snapshot. */
  'approvals.list': { params: Record<string, never>; result: { approvals: PendingApproval[] } };
  /**
   * Handle one pending approval, whether it belongs to a session or an external service (same implementation as `agents.respondToApproval` and `services.respondToApproval`).
   * An approval that has already been handled, timed out or been cancelled returns `already-resolved`; so does one that does not exist (approvals do not stay in the list once finished).
   * For an approval with outbound grants (`grants`), `grant` may be given when allowing: omitted, or `persist: false`, allows only this once (amount unknown); `persist: true` also issues a standing grant (architecture design §12.5), delivered through the `grants` topic. If the approval has no `grants`, giving `grant` is `invalid-request`.
   */
  'approvals.respond': {
    params: { approvalId: Id; decision: PendingApprovalDecision; grant?: ApprovalGrantChoice };
    result: { status: 'allowed' | 'denied' | 'already-resolved' };
  };

  /**
   * Authorization for outbound data (architecture design §12.5). Changes are delivered through the `grants` topic. The browser (Web service) cannot call `grants.*`: granting and revoking authorizations is done only in the desktop UI and CLI.
   * `grants.list` lists only valid ones by default; with `includeEnded: true`, revoked, expired and used-up ones are listed too.
   */
  'grants.list': { params: { recipient?: string; videoId?: Id; includeEnded?: boolean }; result: { grants: Grant[] } };
  /** Issue a standing grant. `free-local` cannot be issued (local computation needs no authorization); `estimate-cap` requires `budgetCap`. */
  'grants.create': { params: GrantCreateParams; result: { grant: Grant } };
  /** Change a grant (tighten it or adjust its budget). Tightening increments `generation`; a revoked grant gives `conflict`. */
  'grants.update': { params: GrantUpdateParams; result: { grant: Grant } };
  /** Revoke: forbid new calls; calls in the queue are rejected when they start (`GRANT_REVOKED`); what has already been sent and billed is reported as it is. Revoking again returns the same result. */
  'grants.revoke': { params: { grantId: Id }; result: GrantRevokeResult };
  /** A grant's usage: the times and amount used, what is reserved, and the tasks that used it. */
  'grants.usage': { params: { grantId: Id }; result: GrantUsageReport };

  /** User marks on Spaces (architecture design §5.7): favorite, display name, trash. Only writes marks; does not touch files. */
  'space.update': {
    params: { entryId: Id; favorite?: boolean; displayName?: string | null; trashed?: boolean };
    result: { entry: SpaceEntry };
  };
  /** Rescan all source directories immediately. */
  'space.rescan': { params: Record<string, never>; result: { ok: true } };
  /** Query Space directories (architecture design §5.7): filter by project, kind, status and source video; paginated. Filtered by the caller's scope. */
  'space.list': { params: SpaceListParams; result: SpaceListResult };
  'space.get': { params: { entryId: Id }; result: { entry: SpaceEntry } };
  /** Cross-video content search (architecture design §5.11): queries the derived content index without opening videos. */
  'space.search': { params: SpaceSearchParams; result: SpaceSearchResult };
  /** Register a file as a project asset without putting it into any video. Files outside the project are first copied into the project's `imports/`. */
  'space.import': { params: { projectId: Id; path: string; name?: string }; result: { entry: SpaceEntry; copied: boolean } };
  /** Display name; `null` restores the file name. Same as `displayName` of `space.update`. */
  'space.rename': { params: { entryId: Id; name: string | null }; result: { entry: SpaceEntry } };
  'space.setFavorite': { params: { entryId: Id; favorite: boolean }; result: { entry: SpaceEntry } };
  /** Move to trash: writes only `user.trashedAt`. */
  'space.trash': { params: { entryId: Id }; result: { entry: SpaceEntry } };
  'space.restore': { params: { entryId: Id }; result: { entry: SpaceEntry } };
  /**
   * Physical deletion (reference graph of §5.5): only deletes entries in the trash (failed placeholders are the exception; clearing them is enough). If still referenced, nothing is deleted and the blocking references are returned.
   * Deleted videos (`videos.delete`) are physically deleted here; video entries still in a source directory are rejected.
   */
  'space.purge': { params: { entryId: Id }; result: SpacePurgeResult };
  'space.openForEdit': { params: { entryId: Id }; result: SpaceOpenForEditResult };
  /**
   * Thumbnail of the entry (product design §4.2–§4.3; the card in grid view and the name column in list view): an image, a text summary, or none (`SpaceThumbnail`). A video's cover is taken from the current working draft, and the video does not need to be open.
   * Files that cannot be decoded or read answer `none` without an error; an entry that does not exist or cannot be seen is `not-found`.
   */
  'space.thumbnail': { params: { entryId: Id }; result: SpaceThumbnail };
  /**
   * Continue a session from an entry (§5.7): an entry in a project creates a new session in that project; an entry not in a project goes back to the entry's original session (creating one if none exists).
   * If `conversationId` is given, it is used, and the entry must be visible to it. Only creates the session and attaches the entry's reference; does not start a task.
   */
  'space.continueInConversation': {
    params: { entryId: Id; conversationId?: Id; commandId?: Id };
    result: SpaceContinueResult;
  };
  /** Drop the derived directories and content index, and rebuild from the authoritative sources; user marks are unaffected. */
  'space.rebuildIndex': { params: Record<string, never>; result: SpaceRebuildResult };

  /**
   * Get a media address for a file (architecture design §4.5, §5.6): a restricted handle, limited to this file, with an expiry.
   * The file comes from a Space entry, or from a path in the session working directory or project directory (for example a file the agent has changed).
   */
  'media.resolve': { params: MediaTarget; result: MediaHandle };
  /**
   * Playback address for an issued file handle (architecture design §4.5): if all the WebM codecs are in `playable`, the original handle is given directly; otherwise a compatible copy is prepared and polled.
   * The original bytes always go through media.resolve.
   */
  'media.playback': { params: { url: string; playable?: PlaybackCodec[] }; result: MediaPlayback };
  /** Subtitle files in the same directory as a video (used for overlay in the player). Only lists them; does not read content. */
  'media.subtitles': { params: FileTarget; result: { tracks: SubtitleTrack[] } };
  /**
   * Peak levels of an asset's sound (used to draw the waveform on the timeline), cached in the Runtime Home keyed by the content digest of the asset version. Only audio and video assets are analyzed.
   * The first request must decode the whole sound: while it is not finished, `pending` is returned, and the same request is asked again after `retryAfterMs`.
   */
  'media.peaks': { params: AssetTarget; result: MediaPeaks };
  /** One frame of a video asset at source time `at` (seconds), scaled down to a small JPEG (the filmstrip on the timeline). Time is rounded to 0.1 s and cached. */
  'media.thumbnail': { params: AssetTarget & { at: number }; result: MediaThumbnail };
  /**
   * Local fonts (architecture design §9.1): pick one face from the local fonts by family name, weight and italic (using the same matching as the typesetting engine), and give the restricted read handle of the file it lives in (same as `media.resolve`) and how to extract it as a standalone font.
   * The editor preview fetches only the table for this face, by range, and injects the assembled font into the renderer (the whole font set is not downloaded). The parsing and extraction are the same as those frozen by final-cut export. It only looks for the given faces and does not list the font directory; an extracted face is capped at 96 MB.
   * A family that is not local is looked up in the download cache (`source: 'downloaded'`). With `download: true`, a face that is in the font directory but whose weight has not been downloaded starts downloading per the `fonts.autoDownload` setting (not strictly offline, and no recent failure); it is reported as `downloading` (with `jobId`) for `missing`. Asking again after the download finishes returns it; in the meantime the fallback font is used. At most 32 at a time. Only offered to the desktop and CLI; not exposed in the browser.
   */
  'fonts.resolve': { params: { faces: FontFaceQuery[]; download?: boolean }; result: FontsResolveResult };
  /**
   * Font picker list (architecture design §9.1): families from the font directory, families shipped with the kernel and families installed locally, merged together. Each family carries its current status (bundled, local, downloaded, downloadable, downloading with progress, failed with reason), category, sample text, weights and license.
   * Filtered by family name, category, text and status, and paginated. Bundled ones come first, then downloaded ones, then the rest in the directory's popularity order (locally installed fonts that are in the directory are here too); local fonts not in the directory come last, sorted by family name.
   * When `families` is given, only those families are queried (not paginated). No network access.
   */
  'fonts.catalogue': { params: FontsCatalogueParams; result: FontsCatalogueResult };
  /**
   * Download a family (from the font directory): if `faces` is not given, downloads the regular and bold of the upright style (matched to the weights the directory actually has for that family); if given, matches and downloads the given weights and italics.
   * Submits a download task (`kind: 'fontDownload'`) and returns immediately. Faces already downloaded are not downloaded again; a family already downloading returns that task.
   * Calling again after a failure retries; cancel with `jobs.cancel`. Not in the directory: `not-found` (`FONT_NOT_IN_CATALOGUE`); a family already bundled with the kernel or present locally: `conflict` (`FONT_NOT_DOWNLOADABLE`); strict offline: `conflict` (`OFFLINE_STRICT`).
   */
  'fonts.download': { params: { family: string; faces?: FontFaceStyle[]; commandId?: Id }; result: FontDownloadResult };
  /** Faces in the download cache and their total size; `inUse` is the families used by unfinished exports (they cannot be deleted, `FONT_IN_USE`). */
  'fonts.downloaded': { params: Record<string, never>; result: { faces: DownloadedFontFace[]; totalBytes: number; inUse: string[] } };
  /**
   * Delete a family's downloaded faces (all of them if `faces` is not given). If an unfinished export has frozen them, or is waiting for them to download, the call is rejected with `conflict` (`FONT_IN_USE`, `details.jobIds`) and none are deleted; faces still downloading are cancelled first.
   * Completed exports are not affected (their final cut has already been drawn).
   */
  'fonts.remove': { params: { family: string; faces?: FontFaceStyle[] }; result: FontRemoveResult };
  /** Empty the download cache: faces used by unfinished exports are kept (`kept`); the rest are deleted. Downloads in progress are cancelled first. */
  'fonts.clear': { params: Record<string, never>; result: FontRemoveResult };
  /**
   * Specimen for the font picker list (architecture design §9.1): a family from the font directory, as a subset containing only the characters in the family name (the `text` parameter of the CSS interface). The UI uses it to draw the family name in that family's look.
   * The request carries only the family name, the regular weight and those characters, with the same interface settings, host restrictions, size limit and no redirect following as downloads. It is stored in `samples/` in the font cache and is not fetched again next time.
   * Not fetched under strict offline (`data: null`); a family not in the directory gives `data: null`.
   * If it cannot be fetched (no connection, bad response), reports `conflict`, with `details.code` as `FONT_DOWNLOAD_*`. Only for the desktop and CLI.
   */
  'fonts.sample': { params: { family: string }; result: FontSampleResult };
  /**
   * Fonts used by an open video (architecture design §9.1): the same frozen input as the final-cut export, handed to the Render Worker to lay out the text once (text, captions and template-generated content are all included).
   * For each family, gives the face named, its current status, and what the kernel draws it with right now (the fallback family). With `download: true`, faces not yet downloaded start downloading by the same rule as `fonts.resolve` (auto-download on, not strictly offline, and no failure in the last ten minutes); `started` lists the families whose downloads started this time.
   * By default the whole root sequence is handled and captions are burned in. Only offered to the desktop and CLI.
   */
  'fonts.usage': {
    params: { videoId: Id; sequenceId?: Id; burnCaptions?: boolean; download?: boolean };
    result: FontsUsageResult;
  };

  /**
   * Create a new video (video format spec §1): creates a video directory under the project directory (or the working directory of a session not in a project) and opens it.
   * The opened video belongs to this connection. If the connection has been disconnected for a while, the Runtime closes the video and releases its write lock.
   */
  'videos.create': {
    params: { projectId?: Id; conversationId?: Id; name?: string; fps?: Rate; width?: number; height?: number; commandId?: Id };
    result: VideoOpenResult;
  };
  /**
   * Derive a child video (architecture design §3.5 “derive child video”, tool `videos_derive`): copies an open video (timeline, transcript, chapters) and cuts away the parts outside the edited timeline range `[start, end)` at the cut points. The child is created next to the parent video and opened.
   * Calling again with the same parent video version, the same range and the same settings recognizes the same child video (`reused`).
   * If the range is empty after snapping to frames, `DERIVE_RANGE_EMPTY`; if the parent contains clips that cannot be copied, `DERIVE_UNSUPPORTED_ITEM`; if the parent video is not in the project or session directory, `DERIVE_PARENT_UNPLACED`.
   */
  'videos.derive': {
    params: VideoDeriveParams;
    result: VideoDeriveResult;
  };
  /**
   * Shot changes (architecture design §3.5 “shot changes”, tool `videos_shots`): the cut points and shots of the picture within a range of the edited timeline. Read-only; writes no files.
   * A range longer than 20 minutes, or an end not after its start, gives `invalid-request` (`details.code` `SHOTS_RANGE_TOO_LONG`, `SHOTS_RANGE_EMPTY`); without ffmpeg installed, `internal`.
   */
  'videos.shots': {
    params: VideoShotsParams;
    result: VideoShotsResult;
  };
  /**
   * Open a portable package (video format spec §8): verify the manifest (format version, length and digest of each file, paths that do not escape the package), create a new video in the project directory or the session working directory (a new `videoId`, with all assets collected into the video), and open it.
   * `path` is a `.cuccut` file, absolute or relative to a source directory. The new video's directory name takes the video name from the package (duplicates get a sequence number). The Web service accepts only files in source directories. Not offered to agents or external services.
   */
  'videos.importPackage': {
    params: { projectId?: Id; conversationId?: Id; path: string; commandId?: Id };
    result: VideoOpenResult;
  };
  /**
   * Open a deck in a slide label (docs/design/slides §6.1): a slide entry in Space, or a deck directory in a source directory.
   * The directory's real path must lie inside a source directory, and it must be recognizable as a deck (it has a valid `deck.json`). The same directory returns the same address.
   */
  'slides.open': { params: FileTarget; result: SlidesOpenResult };
  /**
   * Open a design in a design label (docs/design/canvas §6.1): a design entry in Space, or a design directory in a source directory.
   * Validation of the directory is the same as `slides.open`, and it must be recognizable as a design (`canvas.json` with `v` 3 and `boards` an object). It shares the grant table with `slides.open`;
   * the same directory returns the same address.
   */
  'design.open': { params: FileTarget; result: DesignOpenResult };
  /**
   * Open a design system in a design-system label (docs/design/canvas §10.4): a design-system entry in Space, or a design-system directory in a source directory.
   * Validation of the directory is the same as `design.open`, and it must be recognizable as a design system (for how `design-system.json` is recognized, see docs/design/canvas §10.1); otherwise `invalid-request` with `details.code` `DESIGN_SYSTEM_NOT_A_SYSTEM`.
   * It shares the grant table with `slides.open` and `design.open` (kept separate by kind); the same directory returns the same address.
   */
  'designSystem.open': { params: FileTarget; result: DesignSystemOpenResult };
  /** Open a video: a video entry in Space, or a video directory in a source directory. A video that is already open returns the same `videoId`. */
  'videos.open': { params: FileTarget; result: VideoOpenResult };
  /** This connection no longer needs this video. If no other connection has it open, the Runtime closes it. */
  'videos.close': { params: { videoId: Id }; result: { closed: boolean } };
  /**
   * Delete a video (architecture design §5.5, §5.7): the whole video directory is moved into the trash in the source directory and can be restored. Physical deletion goes through `space.purge` or the trash retention period.
   * The original files of linked assets are not touched. Rejected when another connection has it open, a task is in progress, or another process holds a lock (`VIDEO_IN_USE`, `VIDEO_BUSY`, `VIDEO_LOCKED`).
   */
  'videos.delete': { params: FileTarget | { videoId: Id }; result: VideoDeleteResult };
  /** Move a deleted video back from the trash to where it was. */
  'videos.restore': { params: { entryId: Id }; result: VideoRestoreResult };
  'videos.history': { params: { videoId: Id; limit?: number }; result: { entries: HistoryEntry[] } };
  /**
   * Asset versions in an open video that cannot be read right now (video format spec §4.2). For each asset's current version and the versions its instances reference, this lists those whose file is missing, is no longer the file recorded at registration, or whose relative path escapes the project directory.
   * The video still opens normally. The UI uses this to mark missing assets without waiting for `media.resolve` to fail.
   * It only checks whether the file exists and its length matches; it does not recompute the digest. It is checked once after opening a video, after receiving `video.replaced`, and after submitting asset operations.
   */
  'videos.assetStatus': { params: { videoId: Id }; result: { missing: MissingAsset[] } };
  /** Read the body of a document. Without a version, reads the current version. The body is not sent in the snapshot; the UI fetches it on demand when drawing captions. */
  'documents.read': { params: { videoId: Id; documentId: Id; revision?: Revision }; result: DocumentContent };

  /**
   * Submit an edit transaction (command and protocol spec §4, §5): all operations take effect together or none take effect.
   * If `expectedRevision` does not match the current version, `conflict` (`PROJECT_REVISION_CONFLICT`).
   * `label` is the change name shown to people; `labelRef` is its reference in the catalog (§3.1). The engine stores it as is, and readers regenerate it in their own language.
   */
  'edits.apply': {
    params: { videoId: Id; commandId: Id; expectedRevision: Revision; operations: EditOperation[]; label?: string; labelRef?: MessageRef };
    result: EditResult;
  };
  /** Undo (command and protocol spec §8): `undo` and `redo` refer to the connection's own most recent step. */
  'edits.undo': {
    params: { videoId: Id; commandId: Id; target: UndoTarget; expectedRevision?: Revision };
    result: EditResult;
  };
  'edits.undoState': { params: { videoId: Id }; result: UndoState };
  /**
   * Apply a speaker identification proposal (the `speakers` flow): one edit transaction; the transcript and each translation that changed are written as new versions. `edits.undo` reverts it.
   * If the transcript or a translation was edited after identification, `conflict` (`STALE_JOB_INPUT`).
   */
  'edits.applySpeakers': { params: ApplySpeakersParams; result: EditResult };
  /**
   * Preview of a code composition (motion graphics, architecture design §8): the UI does not go through the agent; it fetches frames at times inside the composition (same service as the `compositions_preview` tool).
   * Frames are written as PNG, and a restricted read handle is returned for each. The video must already be open; the video is not changed.
   */
  'compositions.preview': { params: CompositionPreviewParams; result: CompositionPreviewResult };
  /**
   * Import a code composition: validate it, bake a pre-render, import two assets, and place a composition clip (two undoable changes; same service as the `compositions_import` tool).
   * The operator is the user (`user_local`, same as `edits.apply`). When `conversationId` is given, a change card is placed in the session. Baking can take several minutes.
   */
  'compositions.import': { params: CompositionImportParams; result: CompositionImportResult };

  /** Local model bundles and their status (architecture design §6.3). */
  'models.list': { params: Record<string, never>; result: { bundles: ModelBundleStatus[] } };
  /**
   * Transcribe an audio or video asset (architecture design §6.6): returns a `jobId` immediately; progress and results are delivered through the `jobs` topic. On completion the Runtime writes the result as a `speech` document.
   * A task with the same input that is still queued or running returns the same `jobId`. The video must be opened first; the Runtime keeps it open while the task runs.
   * The provider and model are chosen per §6.2. If the chosen provider is unavailable, or nothing is configured, `conflict` is returned with `details` of `CapabilityNotConfiguredDetails`, and no task is created. An unknown model or node gives `not-found`. Rejection or loss of a node, and authentication or quota failures of online providers, are task errors (`REMOTE_NODE_*`, `PROVIDER_*`).
   */
  'models.transcribe': { params: TranscribeRequest; result: { jobId: Id } };
  /**
   * Speech synthesis (architecture design §6.6): returns a `jobId` immediately; progress and results are delivered through the `jobs` topic. The provider and model are chosen per §6.2. This capability has no factory default: if nothing is explicitly specified and there is no default value, `conflict` (`CAPABILITY_NOT_CONFIGURED`) is returned and no task is created.
   * Text over the model's limit, or a voice or format the model does not accept, gives `invalid-request`. With `videoId`, the video must already be open, and the result is imported as an asset through `system:jobs` (it is not placed on the timeline).
   * The same `commandId` returns the same task. Two submissions with the same parameters are two tasks, since each generation may differ.
   */
  'models.synthesizeSpeech': { params: SynthesizeSpeechRequest; result: { jobId: Id } };
  /** Generate images: the rules are the same as `models.synthesizeSpeech`; size, count and format must be within the range the model declares. */
  'models.generateImage': { params: GenerateImageRequest; result: { jobId: Id } };
  /**
   * Generate music (a song or background score): the rules are the same as `models.synthesizeSpeech`, and only local providers are used (installed music generation model bundles and their engine).
   * A song requires lyrics; a background score takes no lyrics. The `maxDurationSec` budget must be within the range the model declares.
   */
  'models.generateMusic': { params: GenerateMusicRequest; result: { jobId: Id } };
  /**
   * Call a text model once (architecture design §6.1, §6.4): returns a `jobId` immediately. On completion the full text is published as an artifact (`.txt`; structured output is a validated `.json`), and the result carries the artifact ID and a preview of the opening paragraph.
   * The selection rules are the same as `models.synthesizeSpeech` (no factory default). If structured output does not match the schema, or is cut short by the output limit, the task fails with `MODEL_OUTPUT_INVALID`; if the text is truncated, the task completes with an `output-truncated` warning.
   */
  'models.generateText': { params: GenerateTextRequest; result: { jobId: Id } };
  /**
   * Fetch the list of available models (and voices) from an online provider, cached in the configuration with the time recorded (architecture design §6.8). If it cannot be fetched, the built-in list is used as before, with `refreshed.ok` false and a reason; this is not a request error.
   * Not an online provider: `invalid-request`.
   */
  'models.refreshProvider': { params: { providerId: string }; result: { provider: ProviderView; refreshed: ProviderRefreshStatus } };
  /** Set the parameter defaults for one capability (in the first version, only `generateText`'s reasoning intensity and concurrency limit); null restores the factory values. Returns the completed values. */
  'models.setCapabilityParameters': { params: SetCapabilityParametersRequest; result: { parameters: TextCapabilityParameters } };
  /** Re-enable a model bundle that was disabled after repeated crashes, and clear its load-failure record. */
  'models.enable': { params: { bundleId: string }; result: { bundle: ModelBundleStatus } };
  /**
   * Install a local model bundle (architecture design §6.3) in two steps. Without `confirmBytes`, only the plan is returned (the components, files and byte counts to download); nothing is downloaded.
   * The `confirmBytes` from the plan must be sent back unchanged to submit the install task (`kind: 'modelInstall'`; progress in the `jobs` topic, bundle status in the `models` topic). If the byte count differs from the current plan, `conflict` (`MODEL_INSTALL_SIZE_CHANGED`, with `details.plan` as the new plan).
   * Only the missing components are downloaded. Files already received and verified in staging are not downloaded again; partly downloaded files resume with HTTP Range. If everything is already installed, `jobId` is null. If the same bundle is already being installed, that task is returned.
   * Under strict offline (`offline.strict`), `conflict` (`OFFLINE_STRICT`).
   */
  'models.install': { params: { bundleId: string; confirmBytes?: number; commandId?: Id }; result: ModelInstallResult };
  /**
   * Stop a model bundle's install (cancels its task). By default, what has been received in staging is kept, so `models.install` can resume it; with `discard: true`, it is deleted too. If nothing is installing, `discard` only applies to staging.
   */
  'models.cancelInstall': { params: { bundleId: string; discard?: boolean }; result: { bundle: ModelBundleStatus } };
  /**
   * Delete a model bundle: its own components are deleted; shared components that other bundles still use are kept. If a task is using it (a queued or running transcription, check or install, or the Worker is loading or executing), `conflict` (`MODEL_IN_USE`, `details.jobIds`); when idle, the Worker is unloaded first.
   */
  'models.remove': { params: { bundleId: string }; result: ModelRemoveResult };
  /**
   * Repair a model bundle: verify the sha256 of each file, and re-download only the missing or corrupted ones. The two-step confirmation is the same as for `models.install` (the byte count in the plan is only known after verification, and the first step reads the files through).
   */
  'models.repair': { params: { bundleId: string; confirmBytes?: number; commandId?: Id }; result: ModelInstallResult };
  /**
   * Check: run the complete Worker flow with the bundled fixed sample (load, recognize or synthesize, then verify the output). The result is recorded in the bundle status `selfTest` (with `code` and `facts` when it fails). It is a task (`kind: 'modelTest'`); on failure `error.details.check` holds the same `code`.
   * If the bundle is unavailable, `conflict` (`MODEL_UNAVAILABLE`); if the sample shipped with the app cannot be read, `conflict` (`APP_FILE_MISSING`).
   */
  'models.test': { params: { bundleId: string; commandId?: Id }; result: { jobId: Id } };
  /**
   * Model catalog (architecture design §6.3): the effective directory, its source (environment variable, setting or default), usage, and the free space on its disk. It contains local paths, so it is not on the Web service allowlist and is not offered by the MCP external service.
   */
  'models.getDir': { params: Record<string, never>; result: ModelsDirInfo };
  /**
   * Check whether a folder can be used as a model directory (read-only): whether it exists, whether it is writable, free space, the models already in it (recognized by the repository's `.ccut-manifest.json`),
   * and how much would need to be transferred to “move it there” and whether it fits. `path: null` checks the default location.
   */
  'models.inspectDir': { params: { path: string | null }; result: ModelsDirInspection };
  /**
   * Change the model directory: `path: null` restores the default location. `switch` changes to it immediately (files in the original directory are kept). `move` submits a task of `kind: 'modelsMove'`, and switches only after the copy has been verified; if it fails midway or is cancelled, it rolls back and the original directory is left untouched.
   * If the environment variable sets the directory: `conflict` (`MODELS_DIR_ENV_LOCKED`). If local model tasks are queued or running (transcription, synthesis, install, check, move), or the Worker is busy: `conflict` (`MODEL_IN_USE`).
   * Folder does not exist: `MODELS_DIR_MISSING`; not writable: `MODELS_DIR_NOT_WRITABLE`; one contains the other: `MODELS_DIR_NESTED`; not enough space: `MODELS_DIR_NO_SPACE` (all `conflict`). If it is already the current directory, nothing is done.
   */
  'models.setDir': { params: { path: string | null; mode: ModelsDirMode; commandId?: Id }; result: ModelsDirChangeResult };
  /**
   * Read-only view of the model services (architecture design §6.8): for each capability, each provider's models, limits, defaults, whether it is available right now, and the reason if not.
   * Each paired node is health-probed once (at most 2 seconds each, in parallel).
   */
  'models.capabilities': { params: Record<string, never>; result: { capabilities: ModelCapabilitiesView } };
  /** Configure an online provider (`openai`, `google`, `custom:<slug>`). Enabling it is a standing authorization. Keys are write-only and never echoed back. */
  'models.configure': { params: ConfigureProviderRequest; result: { provider: ProviderView } };
  /**
   * Delete an online provider's configuration and all of its account keys (built-in vendors return to unconfigured; custom endpoints are removed entirely). Defaults that point to it are kept and reported as unavailable.
   */
  'models.removeProvider': { params: { providerId: string }; result: { removed: true } };
  /**
   * Add an account (one key, architecture design §6.8) to an online provider, appended at the end. With `verify`, a read-only request is first sent to the vendor using this key; if it fails, nothing is saved. If the credential store is unavailable: `conflict` (`CREDENTIAL_UNAVAILABLE`).
   */
  'models.addAccount': { params: AddProviderAccountRequest; result: { provider: ProviderView } };
  /** Change an account: its name, key, switch, region, or account-level base URL. No such account: `not-found`. */
  'models.updateAccount': { params: UpdateProviderAccountRequest; result: { provider: ProviderView } };
  /** Delete an account and its key. Deleting the last account does not remove the provider: the provider stays enabled but has `credential: 'missing'`. */
  'models.removeAccount': { params: { providerId: string; accountId: string }; result: { provider: ProviderView } };
  /** The new order of accounts (“set as preferred”): the first enabled account that has a key takes effect. `order` must be exactly a permutation of the existing accounts. */
  'models.arrangeAccounts': { params: ArrangeProviderAccountsRequest; result: { provider: ProviderView } };
  /** Usage (read-only, architecture design §6.8): aggregates the usage ledger by time period. Amounts are reported separately as actual, estimated or unknown. */
  'models.usage': { params: UsageRequest; result: UsageReport };
  /** Set (or clear, with `providerId: null`) the default provider and model for one capability. Without `modelId`, that provider's default model is used. */
  'models.setDefault': {
    params: { capability: ModelServiceCapability; providerId: string | null; modelId?: string };
    result: { default: ModelRef | null };
  };
  'jobs.inspect': { params: { jobId: Id }; result: JobRecord };
  /** Cancel a computation (architecture design §7.4): returns the state after cancellation (a task that has already ended returns its final state). */
  'jobs.cancel': { params: { jobId: Id }; result: { state: JobState } };
  /**
   * Newest first. With `videoId`, only that video's. Steps of a fixed flow (subtasks with `parentJobId`) are collapsed under their parent task and not listed by default;
   * with `children: true`, they are listed too.
   */
  'jobs.list': { params: { videoId?: Id; children?: boolean }; result: { jobs: JobRecord[] } };
  /**
   * The current state of resource scheduling (read-only, architecture design §7.6, §7.7): machine capacity and its sources, reservations, what has been leased out and how much is still available, each lease, shared resident processes, and queued tasks (and what each one is waiting for).
   */
  'jobs.resources': { params: Record<string, never>; result: ResourcesSnapshot };
  /**
   * Handle tasks whose outcome is unknown, or that were not fully applied, after a restart (architecture design §7.5). There are three decisions: `retry`, `discard` and `apply`, each with the states in which it is allowed (see `JobReconcileDecision`). If it is not allowed: `conflict` (`RECONCILE_NOT_ALLOWED`, with `details` giving the current state and the allowed decisions).
   * Returns the record after handling. Agents cannot call it.
   */
  'jobs.reconcile': { params: { jobId: Id; decision: JobReconcileDecision }; result: JobRecord };
  /** The fixed flows available, their steps, and the JSON Schema of their parameters (architecture design §7.9). */
  'pipelines.list': { params: Record<string, never>; result: { pipelines: PipelineInfo[] } };
  /**
   * Start a fixed flow: returns the parent task's `jobId` immediately; progress and results are delivered through the `jobs` topic. No such flow: `not-found`. Parameters that do not match the flow's schema: `invalid-request`. A capability the flow needs is not configured: `conflict` (`CAPABILITY_NOT_CONFIGURED`).
   */
  'pipelines.start': { params: { pipeline: string; params: Record<string, unknown>; commandId?: string }; result: { jobId: Id } };
  /**
   * Run a flow again from the step that failed (or was cancelled or interrupted), reusing the outputs of steps already completed; returns the same parent task's `jobId`. If it is still running or has already completed: `conflict` (`JOB_NOT_RETRYABLE`).
   */
  'pipelines.retry': { params: { jobId: Id }; result: { jobId: Id } };
  /**
   * Tool catalog (architecture design §7.9): each tool's inputs, results, execution mode and dependencies, plus whether it can be used now and, if not, why (read-only; does not probe the network; external tools use their last probe result).
   * In a browser session, a tool whose methods are not on the allowlist is marked unavailable (`WEB_METHOD_NOT_ALLOWED`).
   */
  'tools.list': { params: Record<string, never>; result: ToolsListResult };
  /**
   * The optional video entries for a tool, and the optional documents in each entry (read-only). The facts come from the content index and the Space directory, without opening the video; the scope rules are the same as for `space.list`.
   * Videos that have no index yet are still listed (`indexed: false`), and `complete` is false when there are any. No such tool: `not-found`. Tools that accept no video input return an empty list.
   */
  'tools.candidates': { params: ToolCandidatesParams; result: ToolCandidatesResult };
  /**
   * Tool catalog for the Agent surface (architecture design §3.5, §4.1): the same catalog as used by agents in sessions and by MCP services, with the JSON Schema of parameters, descriptions, annotations and risk.
   * Only for `cli` and `desktop` connections; others get `forbidden`.
   */
  'catalog.list': { params: Record<string, never>; result: CatalogListResult };
  /**
   * Call a tool in the catalog by name. The principal is `LocalPrincipal` (writes count as `user_local` and do not go through CucCut's approval). Results and rejections at the tool level are in the return value (`ok`); the shape of a rejection is the same as the `error` of an MCP tool result.
   * Only for `cli` and `desktop` connections; others get `forbidden`.
   */
  'catalog.call': { params: CatalogCallParams; result: CatalogCallResult };
  /**
   * The instruction file for external agents, rendered as files for the CLI surface (Agent surface design §8.6), used by `cuccut skill install`. The source directory is searched in this order: `CUCCUT_AGENT_SKILLS_DIR`, then packaged resources, then the repo root. If none is found: `not-found` (`AGENT_SKILL_NOT_FOUND`). If markers or placeholders are wrong: `conflict` (`AGENT_SKILL_INVALID`, with file and line).
   * Only for `cli` and `desktop` connections; others get `forbidden`.
   */
  'catalog.agentSkill': { params: Record<string, never>; result: CatalogAgentSkill };
  /** The status of managed external tools (architecture design §12.9): the last probe results (probed on the first call). Runs `--version` locally only; no network. */
  'externalTools.list': { params: Record<string, never>; result: { tools: ExternalToolStatus[] } };
  /** Re-probe (all of them, or only `name`), and return the status of all tools. */
  'externalTools.detect': { params: { name?: string }; result: { tools: ExternalToolStatus[] } };
  /**
   * Download a managed tool into `tools/` under the Runtime Home: submits an install task (`kind: 'toolInstall'`) and returns a `jobId` immediately. Explicit user consent is required:
   * without `consent: true`, it is rejected with `conflict` (`TOOL_CONSENT_REQUIRED`; `details.offer` gives the source, version, size and license) and nothing is downloaded;
   * with it, the consent is recorded (`via`, default `app`) and then the task is submitted. If the digest in the manifest is unknown: `conflict` (`TOOL_MANIFEST_INCOMPLETE`). Under strict offline: `conflict` (`OFFLINE_STRICT`). A tool that CucCut cannot download (ffmpeg): `invalid-request` (`TOOL_NOT_MANAGED`).
   * If the same tool is already being installed, that task is returned.
   */
  'externalTools.install': {
    params: { name: string; consent?: boolean; via?: 'app' | 'cli'; commandId?: Id };
    result: ExternalToolInstallResult;
  };
  /**
   * Update the copy on the system by its original install method (`status.update`): submits an update task (`kind: 'toolUpdate'`) and returns a `jobId` immediately. Output is written segment by segment into the task record's `command`, and the tool is probed again when it ends.
   * The user must have seen the full command: if `command` is not given, or differs from the current `update.command`, `conflict` (`TOOL_UPDATE_CONFIRM_REQUIRED`, with `details.update` giving the current method) is returned and nothing runs.
   * If the install method cannot be determined, or it is the managed copy: `conflict` (`TOOL_UPDATE_UNSUPPORTED`). If it needs administrator rights and cannot be run on the user's behalf: `conflict` (`TOOL_UPDATE_MANUAL`, `details.update`).
   * Under strict offline: `conflict` (`OFFLINE_STRICT`). If it is being installed, or a flow is using it: `conflict` (`TOOL_IN_USE`). If the same tool is already updating, that task is returned.
   */
  'externalTools.update': { params: { name: string; command?: string; commandId?: Id }; result: ExternalToolUpdateResult };
  /**
   * Set (or clear with null) a tool's path. A copy the user installed themselves takes precedence over the managed copy and PATH. It runs `--version` first to check; if it cannot run: `invalid-request` (`TOOL_UNAVAILABLE`).
   * This only records the path; it does not mean consent to use download tools.
   */
  'externalTools.setPath': { params: { name: string; path: string | null }; result: { tool: ExternalToolStatus } };
  /** Delete the managed copy (the system copy and the user-specified one are not touched). If it is being installed or updated, or a flow is using it: `conflict` (`TOOL_IN_USE`). */
  'externalTools.remove': { params: { name: string }; result: { tool: ExternalToolStatus } };
  /** Record (`grant: true`) or withdraw (`grant: false`) the user's consent for a tool. After withdrawal, flows that use it refuse to run. */
  'externalTools.consent': { params: { name: string; grant: boolean; via?: 'app' | 'cli' }; result: { tool: ExternalToolStatus } };
  /**
   * Browsers on this machine whose cookies the download tools can read (for “website login” when downloading videos). Following yt-dlp's lookup rules, it checks whether each browser's cookie store exists, most recently modified first.
   * It is checked again on every call. It only checks existence and modification time; it does not read cookie contents and does not run the download tool. `platform` is the platform of the host the Runtime runs on (`process.platform` values: darwin, win32, linux, …): downloads run on that host, and the UI prompts for system authorization accordingly.
   */
  'externalTools.cookieBrowsers': { params: Record<string, never>; result: { platform: string; browsers: CookieBrowserInfo[] } };
  /**
   * Export (architecture design §9.11, §9.13): freezes the video's current version and runs preflight; returns a `jobId` immediately. Later edits do not affect this export.
   * If preflight fails, no task is created, and the reason is given in `RpcError.details.code` (`EXPORT_*`, `ASSET_MISSING`, `ASSET_CHANGED`; command and protocol spec §11.4).
   */
  'exports.create': { params: ExportCreateRequest; result: { jobId: Id } };
  /** The record of an export task. A task that is not an export: `not-found`. */
  'exports.get': { params: { jobId: Id }; result: JobRecord };
  /** Export tasks, newest first. With `videoId`, only that video's. */
  'exports.list': { params: { videoId?: Id }; result: { jobs: JobRecord[] } };
  /**
   * The body of captions or a transcript, without writing files or creating tasks (the preview on the transcript page of the export panel and “copy text”). It uses the same freeze, preflight and writing as `exports.create`, so the body is byte-identical to a file exported with the same settings.
   * The preflight rejection codes are also the same, except for the items about the target directory, which is not touched here. Read-only.
   */
  'exports.renderText': { params: ExportRenderTextRequest; result: ExportRenderTextResult };
  /** A restricted read handle for an artifact (`sha256:<hex>`), same as `media.resolve` (architecture design §4.5). No such artifact: `not-found`. */
  'artifacts.openHandle': { params: { artifactId: string }; result: MediaHandle };

  /**
   * User library (architecture design §5.9): glossaries, voices and brand libraries. Changes to entries are delivered through the `library` topic.
   * Without `library`, all libraries are listed. `kind` keeps only that kind (for example `translation` or `image`).
   */
  'library.list': { params: { library?: LibraryName; kind?: string }; result: { entries: LibraryEntrySummary[] } };
  /** The current version of an entry, or an old version that is still kept (pinned by a task). No such entry: `not-found`. */
  'library.get': { params: LibraryEntryRef; result: { entry: LibraryEntry } };
  /**
   * Create or modify an entry. If the content is unchanged, no new version is made (`changed: false`). For kinds that carry files, `source` supplies the file; the Runtime identifies the type from the content, not the extension.
   * Content that does not conform: `invalid-request` (`LIBRARY_FORMAT_INVALID`). `overlayTemplate` is rejected with `LIBRARY_KIND_RESERVED`.
   */
  'library.put': { params: LibraryPutParams; result: { entry: LibraryEntry; created: boolean; changed: boolean } };
  /** Delete an entry. Copies that have already been placed in videos are unaffected. Voice clones on each provider become `stale`. */
  'library.remove': { params: { library: LibraryName; id: Id }; result: { removed: true } };
  /**
   * Import an exchange file to create a new entry: a glossary in Markdown, a voice package `.bcvoice`, brand library media files, or `cuccut.library-item` JSON.
   * The type is identified from the content, not the extension. If it cannot be recognized or validation fails: `invalid-request` (`LIBRARY_FORMAT_INVALID`).
   */
  'library.import': { params: { path: string; commandId?: Id }; result: { entry: LibraryEntry } };
  /** Write an entry out as an exchange file (the format is in architecture design §5.9). If the target already exists: `conflict`, and nothing is overwritten. */
  'library.export': { params: { entry: LibraryEntryRef; path: string }; result: LibraryExportResult };
  /**
   * Copy an entry into a video: an ordinary edit transaction. Images, videos, stickers and fonts are imported as `managed` assets, and the source records the library entry and its version.
   * Caption styles are written as a `caption-style` document; if `captionItemIds` is given, they are set as the style of those captions in the same transaction.
   * Glossaries, voices and colors cannot enter a video this way (`LIBRARY_ENTRY_NOT_APPLICABLE`).
   */
  'library.applyToVideo': { params: LibraryApplyParams; result: LibraryApplyResult };
  /**
   * The library entries enabled in a video (architecture design §5.9): which glossaries each step uses, and which voice each speaker uses, are recorded in the video's `library-selection` document.
   * When a new video is created, one is written according to each entry's `defaultEnabled` (only when there are default-enabled glossaries). Afterwards it is changed only through `setVideoSelection`.
   */
  'library.getVideoSelection': { params: { videoId: Id }; result: VideoLibrarySelection };
  /**
   * Change the library entries enabled in a video: an ordinary edit transaction. A glossary must be in the library, and its kind and step must match (`transcribe` only for transcription, `translate` only for translation); otherwise `LIBRARY_ENTRY_NOT_APPLICABLE`.
   * An entry not in the library: `not-found`. A `library:` voice must be in the library; a speaker must be in that transcript.
   */
  'library.setVideoSelection': { params: LibrarySetSelectionParams; result: LibrarySetSelectionResult };
  /** A short-lived read handle for an entry's file (brand library media, reference recordings of voices), same as `artifacts.openHandle`. An entry without a file: `not-found`. */
  'library.openHandle': { params: LibraryEntryRef; result: MediaHandle };
  /**
   * Clone a library voice on a provider (architecture design §5.9): returns the task's `jobId` immediately (`kind: 'voiceClone'`); progress and results are delivered through the `jobs` topic.
   * Without an authorization statement: `conflict` (`VOICE_CONSENT_REQUIRED`). If the provider has no cloning interface: `invalid-request` (`VOICE_CLONE_UNSUPPORTED`).
   * Uploading the reference recording is outbound data (data kind `audio`). Without an authorization covering it: `forbidden` (`GRANT_REQUIRED`, `BUDGET_EXCEEDED`, …).
   */
  'library.createVoiceClone': { params: VoiceCloneCreateParams; result: { jobId: Id } };
  /**
   * Delete a clone: first request deletion on the remote side; once that succeeds (or the remote has none), clear the record. If remote deletion fails, the record is kept and reported with the provider's error code (`PROVIDER_*`).
   * A clone left behind by a deleted voice can also be deleted this way.
   */
  'library.removeVoiceClone': { params: VoiceCloneRemoveParams; result: VoiceCloneRemoveResult };

  /**
   * Catalog of creative templates (template package spec §6): all the available templates in the built-in catalog and under `templates/` in the Runtime Home, plus the skipped template directories and the reasons.
   * The directory is read again on every call, so a template the user has added appears on the next list. Order is not a contract. For each template, a language version is picked by `language` (usually the UI language; defaults to the Runtime's UI language) (template package spec §3.6), and the manifest copy is replaced with that version.
   */
  'templates.list': { params: { language?: string }; result: TemplateListResult };
  /**
   * The full manifest and prompt of one template, with the language version picked by `language` (same as `templates.list`). If there is no such template, or it could not be loaded: `not-found` (`TEMPLATE_NOT_FOUND`).
   */
  'templates.get': { params: { id: string; language?: string }; result: TemplateDetail };
  /**
   * A short-lived read handle for a file bundled with a template, same as `artifacts.openHandle`. `path` is `cover.file`, `preview.file` or `assets[].path` registered in the manifest.
   * A path not registered: `not-found` (`TEMPLATE_FILE_NOT_FOUND`); other files in the template directory (including `prompt.md`) behave the same way.
   */
  'templates.openHandle': { params: { id: string; path: string }; result: MediaHandle };

  /**
   * Agent skill catalog (architecture design §3.8): all the available skills in the built-in catalog and in `<Runtime Home>/skills/`, each one's on/off switch, plus the skipped directories and the reasons.
   * The directory is read again on every call. Order is not a contract.
   */
  'skills.list': { params: Record<string, never>; result: SkillListResult };
  /** One skill's summary, full `SKILL.md`, and file list. No such skill (or it could not be loaded): `not-found` (`SKILL_NOT_FOUND`). */
  'skills.get': { params: { id: string }; result: SkillDetail };
  /**
   * Read one text file in a skill directory. `path` must be a path in the file list from `skills.get`; otherwise `not-found` (`SKILL_FILE_NOT_FOUND`).
   * Over `SKILL_LIMITS.readFileBytes`: `invalid-request` (`SKILL_FILE_TOO_LARGE`). Not UTF-8 text: `invalid-request` (`SKILL_FILE_NOT_TEXT`).
   */
  'skills.readFile': { params: { id: string; path: string }; result: SkillFileContent };
  /**
   * Switch a skill on or off (built-in ones too). Only the differences from the source default are stored.
   * It does not affect native sessions that are already running: the skill index at session start reflects the switch at that time, and native sessions started later use the new switch (architecture design §3.8).
   */
  'skills.setEnabled': { params: { id: string; enabled: boolean }; result: SkillChangeResult };
  /**
   * Add from a local folder (architecture design §12.9): copies the folder to `<Runtime Home>/skills/<id>/`. If `id` is not given, it is normalized from the folder name. It is filed under “Mine” and enabled by default.
   * Folder missing: `not-found` (`SKILL_SOURCE_NOT_FOUND`). No `SKILL.md`, invalid front matter, or symbolic links inside: `invalid-request` (`SKILL_INVALID`). Over the file count or total size limit: `invalid-request` (`SKILL_TOO_LARGE`).
   * Target already exists, or the same id as an existing skill: `conflict` (`SKILL_EXISTS`), nothing is overwritten. The error `details` carry `skillId` and the `path` that would be written. Not available in Web sessions.
   */
  'skills.add': { params: { path: string; id?: string; commandId?: Id }; result: SkillChangeResult };
  /**
   * Import from GitHub (architecture design §12.9). `url` is `owner/repo`, `https://github.com/<owner>/<repo>`, or `https://github.com/<owner>/<repo>/tree/<ref>/<subdirectory>` (`ref` is the segment after `tree/`). Only the files in that directory are fetched; nothing is executed. They are copied into `<Runtime Home>/skills/<id>/`, recording the address, the `ref` and the commit. It is filed under “Third party” and disabled by default. If `id` is not given, it is normalized from the subdirectory name (or the repo name when at the repo root).
   * An unrecognized address: `invalid-request` (`SKILL_GITHUB_URL_INVALID`). A repo, `ref` or subdirectory that does not exist: `not-found` (`SKILL_SOURCE_NOT_FOUND`). A network failure or rate limit: `conflict` (`SKILL_GITHUB_NETWORK`, `SKILL_GITHUB_RATE_LIMITED`). Under strict offline: `conflict` (`OFFLINE_STRICT`).
   * Otherwise the same as `skills.add` (`SKILL_INVALID`, `SKILL_TOO_LARGE`, `SKILL_EXISTS`; conflicts are checked before going online). Not available in Web sessions.
   */
  'skills.importGithub': { params: { url: string; id?: string; commandId?: Id }; result: SkillChangeResult };
  /**
   * Remove a “Mine” or “Third party” skill: delete `<Runtime Home>/skills/<id>/` and its switch record. A built-in skill: `invalid-request` (`SKILL_BUILTIN_NOT_REMOVABLE`); built-in skills can only be turned off. Not available in Web sessions.
   */
  'skills.remove': { params: { id: string }; result: SkillRemoveResult };

  /**
   * The user's profile (docs/cuccut/m2-profile-rules.md §4): the workspace level, the same as the `profile` topic's snapshot. Every new native session reads it.
   */
  'profile.get': { params: Record<string, never>; result: ProfileSnapshot };
  /** A project's own preferences and rules (`<project>/.ccut/profile.json`), read from disk on each call. No such project: `not-found` (`PROFILE_PROJECT_NOT_FOUND`). */
  'profile.getProject': { params: { projectId: Id }; result: ProjectProfile };
  /**
   * Saves interview answers a step at a time, merged over the ones saved before: a given question replaces its answer, and a blank one clears it. Unknown question ids are rejected.
   * Saving never changes the interview's status. A profile file from a newer version: `conflict` (`PROFILE_READ_ONLY`), as for every write below.
   */
  'profile.saveAnswers': { params: { answers: InterviewAnswers; commandId?: Id }; result: InterviewState };
  /** Skips the interview (`skipped`). The answers stay, and the interview can be reopened. */
  'profile.skipInterview': { params: Record<string, never>; result: InterviewState };
  /** Opens the interview again (`pending`, and the home reminder back on), with the previous answers to edit. */
  'profile.reopenInterview': { params: Record<string, never>; result: InterviewState };
  /** "Not now" on the home reminder: hides it. The settings page and the agent still offer the interview. */
  'profile.dismissReminder': { params: Record<string, never>; result: InterviewState };
  /**
   * Writes preferences from the interview answers (the saved ones, with `answers` merged over them): a one-shot, confined run of the default agent (or else the first
   * one installed and signed in) turns them into the interview's section and a list of names, which go into one transcription glossary in the user library. With
   * no agent, a failed run or unusable output, the answers are kept as typed (`fallbackReason`). The interview becomes `done`. Progress is sent as `profile.writing`.
   * No answers: `invalid-request` (`PROFILE_NO_ANSWERS`). A write already running: `conflict` (`PROFILE_WRITE_BUSY`). Clients call it with a long timeout (240 s).
   */
  'profile.writeFromAnswers': { params: { answers?: InterviewAnswers }; result: ProfileWriteResult };
  /**
   * Sets preference text. Without `projectId`: the workspace level, `own` (the user's words) and/or `interview` (the section the interview wrote); returns the snapshot.
   * With `projectId`: only `own`, which is the project's text (`interview` gives `invalid-request`, `PROFILE_PROJECT_TEXT_ONLY`); returns the project's level.
   * A project folder that is missing or not writable: `conflict` (`PROFILE_PROJECT_UNAVAILABLE`).
   */
  'profile.setPreferences': { params: { projectId?: Id; own?: string; interview?: string }; result: ProfileSnapshot | ProjectProfile };
  /**
   * Creates a rule (no `id`, or an id not used yet at that level) or replaces the one with that id. Incomplete: `invalid-request` (`PROFILE_RULE_INVALID`, with readable `problems`).
   * A template that is not installed does not stop the save; it comes back in `warnings`.
   */
  'profile.putRule': { params: { rule: ProfileRuleInput; projectId?: Id }; result: ProfileRulePutResult };
  /** Removes a rule and returns it, so that Undo can put it back as it was. No such rule: `not-found` (`PROFILE_RULE_NOT_FOUND`). */
  'profile.removeRule': { params: { id: string; projectId?: Id }; result: { removed: ProfileRule } };
  /** Puts a level's rules in the given order, renumbered 10, 20, 30…, in one write. `ids` must list each rule of the level once: otherwise `invalid-request` (`PROFILE_RULE_ORDER`). */
  'profile.reorderRules': { params: { ids: string[]; projectId?: Id }; result: { rules: ProfileRule[] } };

  /**
   * Share this computer's model capabilities (node protocol spec §10): turns on the node service and generates a pairing code. If it is already on, listening is restarted with the new parameters.
   * If the port is occupied, no error is raised: `listening` is false and `error` gives the reason.
   */
  'nodes.share.start': { params: ShareStartParams; result: ShareStatus };
  /** Stop sharing: cancel and delete all remote tasks, and stop listening. Paired clients are kept. */
  'nodes.share.stop': { params: Record<string, never>; result: ShareStatus };
  'nodes.share.status': { params: Record<string, never>; result: ShareStatus };
  /** Invalidate the old pairing code and generate a new one, and also lift the pairing lock. If sharing is not on: `conflict`. */
  'nodes.share.pairingCode': { params: Record<string, never>; result: ShareStatus };
  /** Revoke a client: its token becomes invalid immediately, and its remote tasks are cancelled and deleted. */
  'nodes.share.revoke': { params: { clientId: string }; result: ShareStatus };
  /**
   * Turn sharing of a model capability on or off, effective immediately. The health endpoint reports the change at once. After it is turned off, new tasks are rejected with `403 CAPABILITY_DISABLED`; tasks already accepted run to completion.
   * The state is persisted. A `capability` that is not one nodes can share (`NODE_SHAREABLE_CAPABILITIES`): `invalid-request`.
   */
  'nodes.share.setCapability': { params: { capability: string; enabled: boolean }; result: ShareStatus };
  /** Find nodes on the LAN that have sharing turned on (uses mDNS on macOS; returns an empty list on other platforms). Does not include this computer itself. */
  'nodes.discover': { params: { timeoutMs?: number }; result: { nodes: DiscoveredNode[] } };
  /**
   * Pair with a node using the pairing code shown on it; the token exists only on this machine. On failure, returns `conflict`, with `details.code` as `REMOTE_NODE_REJECTED` (`details.reason`: `pairing-code-invalid`, `pairing-locked`, `version`, `source-not-allowed`) or `REMOTE_NODE_LOST` (cannot connect).
   */
  'nodes.pair': { params: { host: string; port: number; code: string; alias?: string }; result: { node: PairedNode } };
  /** Paired nodes, each with a live health probe (2-second timeout). */
  'nodes.list': { params: Record<string, never>; result: { nodes: PairedNode[] } };
  /** Deletes only the local record and token. The pairing on the node side is revoked by the node's user. */
  'nodes.remove': { params: { nodeId: string }; result: Record<string, never> };

  /** External services (architecture design §4.8): the status of all services. The node service's status is a projection of `nodes.share.status`. */
  'services.list': { params: Record<string, never>; result: { services: ServiceStatus[] } };
  /**
   * Start a service. If it is already running, it is returned as is. If the port is occupied, no error is raised: the status is `error`, with `error` giving the reason.
   * A service not provided in this version: `conflict` (`details.code` `SERVICE_NOT_AVAILABLE`). The node service is the same as `nodes.share.start` (with no parameters).
   */
  'services.start': { params: { serviceId: ServiceId }; result: { service: ServiceStatus } };
  /** Stop a service: existing connections are disconnected, pending approvals are treated as cancelled, and the Jobs it submitted are kept. */
  'services.stop': { params: { serviceId: ServiceId }; result: { service: ServiceStatus } };
  /**
   * Change a service's configuration (whether it starts with the Runtime, its port, access policy). It takes effect after an atomic write to disk. If it is running, changing the port restarts listening on the new port.
   * The node service rejects this with `invalid-request`: its configuration is set with `nodes.share.*`.
   */
  'services.configure': { params: ServiceConfigureParams; result: { service: ServiceStatus } };
  /** Handle one service approval. An approval that has already been handled, timed out or been cancelled returns `already-resolved`. */
  'services.respondToApproval': {
    params: { approvalId: Id; decision: ServiceApprovalDecision };
    result: { status: 'allowed' | 'denied' | 'already-resolved' };
  };
  /** Issue a client token for the MCP service. The plaintext token is returned here only once; the Runtime stores only a hash. */
  'services.mcp.createClient': { params: { name: string }; result: { client: ServiceClient; token: string } };
  'services.mcp.listClients': { params: Record<string, never>; result: { clients: ServiceClient[] } };
  /** Revoke a client: its token becomes invalid immediately. No such client: `not-found`. */
  'services.mcp.revokeClient': { params: { clientId: string }; result: { clients: ServiceClient[] } };
  /** Connection info: the address, the request header shape, and a config snippet that can be pasted, without the plaintext token. With `clientId`, the client's name is written into the snippet. */
  'services.mcp.connectionInfo': { params: { clientId?: string }; result: McpConnectionInfo };
  /** Issue a client token for the model API service. The rules are the same as `services.mcp.createClient`; the tokens of the two services are not interchangeable. */
  'services.modelApi.createClient': { params: { name: string }; result: { client: ServiceClient; token: string } };
  'services.modelApi.listClients': { params: Record<string, never>; result: { clients: ServiceClient[] } };
  /** Revoke a client: its token becomes invalid immediately. No such client: `not-found`. */
  'services.modelApi.revokeClient': { params: { clientId: string }; result: { clients: ServiceClient[] } };
  /** Connection info: the base URL (the OpenAI SDK's `baseURL`), the request header shape and a snippet, without the plaintext token. */
  'services.modelApi.connectionInfo': { params: { clientId?: string }; result: ModelApiConnectionInfo };
  /**
   * Set an alias (an existing one with the same name is replaced): model name → provider and model for one capability (without `modelId`, that provider's default model is used).
   * It does not check whether the target is available right now: when unavailable, requests are answered with 404 or 503 per §4.8. Returns the whole alias table.
   */
  'services.modelApi.setAlias': {
    params: { alias: string; capability: ModelApiAlias['capability']; providerId: string; modelId?: string };
    result: { aliases: ModelApiAlias[] };
  };
  /** Delete an alias. If there is no such alias: `not-found`. Returns the whole alias table. */
  'services.modelApi.removeAlias': { params: { alias: string }; result: { aliases: ModelApiAlias[] } };
  /**
   * Generate an access link for the browser (architecture design §4.8): `http://127.0.0.1:<port>/#code=<one-time code>`. The code is in the fragment, so it does not enter server logs or the Referer. It can be exchanged for a session only once, and it expires after `WEB_ACCESS_CODE_TTL_MS`.
   * With `video` (a videoId), the link goes directly to that video's editor: the path and query are the result of `webVideoHref` (`/home?video=<JSON of FileTarget>`), and the fragment still holds only the code. If the video is not found: `not-found` (`details.code: 'VIDEO_NOT_FOUND'`).
   * If the Web service is not running, it is rejected with `conflict` (`details.code: 'SERVICE_NOT_RUNNING'`).
   * A browser session cannot call this method itself.
   */
  'services.web.createAccessLink': { params: { video?: Id }; result: WebAccessLink };
  /** The current browser session (without the session token). */
  'services.web.listSessions': { params: Record<string, never>; result: { sessions: WebSession[] } };
  /** Revoke a browser session: its connection is disconnected immediately and its cookie becomes invalid. No such session: `not-found`. */
  'services.web.revokeSession': { params: { sessionId: string }; result: { sessions: WebSession[] } };

  /** Preferences held by the Runtime (architecture design §5.10). Without `keys`, all are returned. An unknown key: `invalid-request`. */
  'settings.get': { params: { keys?: SettingKey[] }; result: SettingsView };
  /**
   * Change a set of settings. The whole batch is validated first: unknown keys or values that do not match the schema fail the whole batch with `invalid-request`, and none are saved. After validation passes, the settings are written to disk atomically and then take effect.
   * `null` restores the default. Returns the new full view; keys whose effective value changed are sent as `settings.updated` on the `settings` topic.
   */
  'settings.set': { params: { values: { [K in SettingKey]?: SettingInputValues[K] | null } }; result: SettingsSnapshot };

  subscribe: {
    params: { topic: Topic; afterSeq?: Seq };
    result: { mode: 'snapshot'; seq: Seq; snapshot: unknown } | { mode: 'replay'; seq: Seq; events: SequencedEvent<unknown>[] };
  };
  unsubscribe: { params: { topic: Topic }; result: { ok: true } };
}

/** The location of a file (or video directory): a Space entry, or a relative path in a session working directory or project directory. */
export type FileTarget = { entryId: Id } | { conversationId: Id; path: string } | { projectId: Id; path: string };

/** One item from `projects.files.list`. `path` is relative to the root, uses `/` as separator, and can be passed as is to `{ conversationId, path }`. */
export interface ProjectFileEntry {
  path: string;
  name: string;
  isDir: boolean;
  /** The size of the file in bytes; null for a directory. */
  size: number | null;
  /** The last modification time. For a video directory, the time of `video.db`; for a slide directory, `deck.json`; for a design directory, `canvas.json`; for a design-system directory, `design-system.json`. */
  modifiedAt: string | null;
  /**
   * The media and document types recognized (the same classification as Space). A directory containing `video.db` is `video`; a directory containing a valid `deck.json` is `slides`; a directory containing a valid `canvas.json` (v 3) is `design`; a directory containing a valid `design-system.json` (recognized as described in docs/design/canvas §10.1) is `design-system`. Otherwise null.
   */
  kind: SpaceEntryKind | null;
}

export interface ProjectFilesList {
  /** The absolute path of the root directory (the registered path; symbolic links are not resolved). */
  root: string;
  entries: ProjectFileEntry[];
  /** Exceeded `limit` or the search cap, so only part of the results were returned. */
  truncated: boolean;
}

/** An asset version in an open video. Without a version, the current version is used. */
export interface AssetTarget {
  videoId: Id;
  assetId: Id;
  revision?: Revision;
}

/** An attachment carried by a user message in a session (`AttachmentRef.id`). Read-only: the media channel checks that it does appear in a message of this session. */
export interface AttachmentTarget {
  conversationId: Id;
  attachmentId: Id;
}

/**
 * A local file on the desktop (architecture design §4.5): a document or media copy outside the working directory that has no artifact record, previewed read-only in the file tab. An absolute path. The Runtime issues it only to desktop clients; it checks against the file's own directory as the root, and gives only regular files. It is not a `FileTarget`: it cannot be used to open or delete a video.
 */
export interface LocalFileTarget {
  localPath: string;
}

/**
 * The locator for the media channel: a file; or an asset in an open video (managed assets live in the `blobs/` of the video directory); or an image attached to a message in a session; or a local file on the desktop.
 */
export type MediaTarget = FileTarget | AssetTarget | AttachmentTarget | LocalFileTarget;

export interface VideoOpenResult {
  ref: VideoRef;
  /** The first snapshot before subscribing to the `video:<id>` topic. The UI then subscribes to the topic and continues from its sequence number. */
  snapshot: VideoTopicSnapshot;
}

export interface EditResult {
  receipt: TransactionReceipt;
  /** true when the same `commandId` is retried: the receipt from the first submission is returned, and nothing is submitted again. */
  replayed: boolean;
}

export interface SubtitleTrack {
  /** The locator used to fetch this caption file, in the same source directory as the video. */
  target: FileTarget;
  fileName: string;
  /** Same name as the video (equal after removing the extension, or differing only by a suffix such as a language). Same-name files come first. */
  matched: boolean;
  /** For same-name files, the part after the video name, for example `zh` or `en.forced`; null if there is none. */
  tag: string | null;
}

export type FileContentKind = 'text' | 'image' | 'pdf' | 'audio' | 'video' | 'archive' | 'binary';
export type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be';

/** `progress`: how far, as a fraction (0–1), the compatible copy has been encoded through the source duration; omitted when not yet known. */
export type MediaPlayback = { status: 'pending'; retryAfterMs: number; progress?: number } | { status: 'ready'; media: MediaHandle };

export interface MediaHandle {
  /** The Runtime identifies it from up to the first 64 KiB of the file. Old Runtimes may not provide it. */
  contentKind?: FileContentKind;
  textEncoding?: TextEncoding;
  url: string;
  mimeType: string;
  size: number;
  fileName: string;
  expiresAt: string;
}

/** One font face to look for: the family name, the weight (1–1000), and whether it is italic (the name used when typesetting). */
export interface FontFaceQuery {
  family: string;
  weight: number;
  italic: boolean;
}

/**
 * Extract one face from a font file into a standalone font. The new font is `size` bytes in total and begins with `header` (hex). Each remaining table is taken from the original file starting at `from`, `length` bytes, and placed at `to` in the new font. The gaps between tables are zero bytes.
 */
export interface FontFaceLayout {
  faceIndex: number;
  /** The byte count of the original file. */
  fileSize: number;
  size: number;
  header: string;
  tables: { from: number; length: number; to: number }[];
}

/**
 * Reasons a face cannot be found. `not-found`: neither the local fonts nor the download cache have this family, and it is not in the font directory. `too-large`: it is present, but the extracted result exceeds the limit. `downloadable`: it is in the font directory but not downloaded (auto-download is off, strict offline, or no download was requested this time). `downloading`: a download is in progress (`jobId`); ask again after it finishes. `download-failed`: the most recent download failed (`code`); try again later, or retry with `fonts.download`.
 */
export type FontMissingReason = 'not-found' | 'too-large' | 'downloadable' | 'downloading' | 'download-failed';

/** The result of `fonts.resolve`: the faces found (in request order, duplicates given once), with the read handle of the file they are in; and those not found, with the reason. */
export interface FontsResolveResult {
  /** `source`: `local` for local fonts, `downloaded` for the download cache. */
  faces: (FontFaceQuery & FontFaceLayout & { source: 'local' | 'downloaded'; file: MediaHandle })[];
  missing: (FontFaceQuery & { reason: FontMissingReason; jobId?: Id; code?: FontDownloadErrorCode | 'CANCELLED' })[];
}

/**
 * Peak levels of an asset's sound. `peaks` is base64-encoded bytes, one byte per bin: the maximum absolute amplitude in that span of source time (after channels are mixed), where 0–255 maps from silence to full scale. Not normalized. Bin `i` starts at source time `i / binsPerSecond` seconds. If the asset has no sound: `no-audio`.
 */
export type MediaPeaks =
  { status: 'ready'; binsPerSecond: number; peaks: string } | { status: 'pending'; retryAfterMs: number } | { status: 'no-audio' };

export interface MediaThumbnail {
  mimeType: 'image/jpeg';
  /** A base64-encoded image. */
  data: string;
  /** The source time (seconds) at which the frame was actually taken: the requested time rounded to 0.1 s and clamped to the asset's duration. */
  at: number;
}

export type RpcMethod = keyof RpcMethods;
export type RpcParams<M extends RpcMethod> = RpcMethods[M]['params'];
export type RpcResult<M extends RpcMethod> = RpcMethods[M]['result'];

/**
 * The Agent list and preferences: shared by the settings page and the session picker. `drivers` is each Driver's most recent probe result (at startup, from the disk cache; `checkedAt` is the time of that probe). Drivers with no result yet, or currently in their first probe, are not in it and are listed in `checking`. The `agents` topic pushes new views.
 */
export interface AgentsView {
  drivers: DriverInfo[];
  checking: DriverId[];
  preferences: AgentPreferences;
}

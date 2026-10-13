import type { AgentMode, RiskLevel } from './access.ts';
import type { TaskContract } from './tasks.ts';
import type { TemplateMessageRef } from './template.ts';
import type { SkillMessageRef } from './skill.ts';
import type { MessageRef } from './message-ref.ts';
import type { SlideAnnotation } from './slides.ts';
import type { DesignAnnotation } from './design.ts';
import type { DesignSystemAnnotation } from './design-system.ts';

/**
 * Session-side domain objects (architecture design §1.5, §3.10).
 *
 * These are the DTOs on the wire of the authoritative objects in the Runtime Store. Video domain types such as video, sequence and assets are generated from the single Rust source (architecture design §13.2); 0.1 has no video engine yet, so they are not here.
 */

export type Id = string;

/** Sequence number as a decimal string (D06: avoids losing precision for 64-bit integers in JSON). */
export type Seq = string;

/** Project: a directory, and also the agent's working directory (product design §2.3). */
export interface Project {
  id: Id;
  /** Display name. Renaming only changes the registry, not the directory. */
  name: string;
  path: string;
  createdAt: string;
  lastActiveAt: string;
  pinned: boolean;
  /** Archiving only affects how the list is displayed (product design §3.1). */
  archived: boolean;
}

/** Active state of the session; the sidebar badge is summarized from it (architecture design §11.3). */
export type ConversationActivity = 'idle' | 'running' | 'stopping' | 'awaiting-approval' | 'failed';

export interface Conversation {
  id: Id;
  title: string;
  /**
   * Nullable: a session that belongs to no project (architecture design §3.10). It can be bound once from null (the first time a new video is created, the Runtime creates a project and binds to it, pushed via `conversation.upsert` / `conversation.updated`); after that it is not rebound to another project.
   */
  projectId: Id | null;
  /** The agent's working directory: the project directory, or a temporary directory for a session with no project (replaced by the project directory once bound). */
  cwd: string;
  /**
   * A session that does not belong to a project and shares its working directory with another session (`folderOf` in `conversations.create`, architecture design §3.10): the id of that session.
   * Its videos and files are in that session's working directory; Space lists it under that session, and video locations are written under that session. When that session is put into a project, this one goes along with it; after that it is omitted. A session that has its own working directory omits it.
   */
  folderOf?: Id;
  /** The session's agent. It can be changed before any task starts; after that it is fixed (native sessions cannot continue across agents). */
  driverId: DriverId;
  /** Model id, from `DriverInfo.models`; null = no model is passed, so the agent's own default (`configModel`) is used. Takes effect from the next turn. */
  model: string | null;
  /** Reasoning effort id, from the `efforts` of the selected model; null = the model's default. Takes effect from the next turn. */
  effort: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  pinned: boolean;
  /** The task has finished but has not been seen yet: “completed, unread” in the sidebar (product design §3.1). */
  unread: boolean;
  activity: ConversationActivity;
  activeTaskId: Id | null;
  /**
   * Access mode of the session (architecture design §3.12): switched with `conversations.update` or send parameters; it applies to later actions.
   * null (or absent in old records) means it has never been switched: `agent.defaultAccessMode` is taken on each send.
   */
  accessMode?: AgentMode | null;
  /**
   * A reference attached when a session is continued from a Space entry (`space.continueInConversation`, architecture design §5.7) that has not been sent yet. It is attached after the message on the next send and cleared once sent.
   * Omitted when there is none.
   */
  pendingReferences?: SpaceEntryReference[];
}

/**
 * A reference in a session to a Space entry (architecture design §5.7 “continue the session from an entry”): only the entry's identifier and metadata, not the file contents. When the agent needs the content, it fetches it through a tool by `entryId`, `videoId` or `artifactId`, subject to scope and approval as usual.
 */
export interface SpaceEntryReference {
  entryId: Id;
  kind: SpaceEntryKind;
  name: string;
  projectId: Id | null;
  /** Relative path inside the source directory; null for artifacts and placeholders. */
  relPath: string | null;
  videoId: Id | null;
  artifactId: string | null;
  status: SpaceEntryStatus | null;
  /** Source summary: the capability, task and session that generated or exported it, and the frozen video version at export. It does not include generation parameters. */
  origin: Pick<SpaceEntryOrigin, 'source' | 'capability' | 'jobId' | 'conversationId' | 'videoRevision'> | null;
  attachedAt: string;
}

/**
 * Built-in agent engines (architecture design §3.1). The order is the order in settings and in the selector: the first five (Claude, Codex, Copilot, Pi, OpenCode) are always in the main list; the last four (Gemini CLI, Cursor Agent, Grok, Kimi Code) are in the collapsed “More” section when not detected (the UI holds the split between the main list and the collapsed section statically).
 * Copilot and the last four connect through the same implementation of the Agent Client Protocol (ACP).
 * Being in the table does not mean this version has registered it: `agents.list` only lists the drivers the Runtime has registered.
 */
export const BUILTIN_DRIVER_IDS = ['claude', 'codex', 'copilot', 'pi', 'opencode', 'gemini', 'cursor', 'grok', 'kimi'] as const;
export type BuiltinDriverId = (typeof BUILTIN_DRIVER_IDS)[number];

/**
 * The id of an agent engine: a built-in one (`BUILTIN_DRIVER_IDS`) or a user-added ACP agent (`agents.addProvider`).
 * Both are lowercase letters, digits and hyphens, starting with a lowercase letter, at most 63 characters (`DRIVER_ID_PATTERN`); a custom one must not share a name with a built-in one.
 */
export type DriverId = string;

/** Format of a driver id: matches the validation of the `agent.defaultDriver` preference. */
export const DRIVER_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;

export function isDriverId(value: unknown): value is DriverId {
  return typeof value === 'string' && DRIVER_ID_PATTERN.test(value);
}

export function isBuiltinDriverId(value: unknown): value is BuiltinDriverId {
  return (BUILTIN_DRIVER_IDS as readonly unknown[]).includes(value);
}

/**
 * User-added ACP agents (`agents.addProvider`, architecture design §3.11), stored at `store/agent-providers.json` in the Runtime Home.
 * The first element of `command` is the executable (a name on PATH or an absolute path); the rest are the arguments that start it over ACP (stdio), e.g. `["npx", "-y", "@google/gemini-cli@0.52.0", "--acp"]`. `env` holds extra environment variables added when it is started; they may contain secrets, so they stay only in the Runtime: they do not go into `AgentsView` and are not logged.
 */
export interface CustomAgentProvider {
  id: DriverId;
  name: string;
  command: string[];
  env?: Record<string, string>;
  addedAt: string;
}

/** Configuration of a user-added agent in `AgentsView`: environment variables are given by name only, never by value. */
export interface CustomAgentProviderView {
  command: string[];
  envKeys: string[];
  addedAt: string;
}

export function customAgentProviderView(provider: CustomAgentProvider): CustomAgentProviderView {
  return { command: [...provider.command], envKeys: Object.keys(provider.env ?? {}), addedAt: provider.addedAt };
}

/**
 * The autonomy mode of 0.1, old values (product design §7.1). The protocol and settings still accept them, and `normalizeAgentMode` maps them to the new access modes:
 * `controlled` → `ask`, `authorized` → `fullAccess`, `plan` unchanged. New code uses `AgentMode` (`access.ts`).
 */
export type Autonomy = 'plan' | 'controlled' | 'authorized';

/**
 * Where the access mode of a task comes from: given explicitly when sending, the mode switched in the session, the user's default (`agent.defaultAccessMode`), or the built-in default.
 */
export type AutonomySource = 'request' | 'conversation' | 'setting' | 'default';

export type TaskStatus = 'running' | 'stopping' | 'completed' | 'stopped' | 'failed';

export type ToolCallKind = 'command' | 'file-change' | 'mcp' | 'web-search' | 'other';
/** `interrupted`: the turn ended while the step had still not received a terminal state, so it must not be treated as completed. */
export type ToolCallStatus = 'running' | 'completed' | 'failed' | 'declined' | 'interrupted';

/**
 * The content of an approval. `tool` is a tool call (architecture design §3.12): either CucCut's own tools or the agent's built-in tools (such as Claude's WebFetch); `files` holds the targets (videos, files) and `reason` holds a summary of the arguments. Old UIs that only know `command` and `file-change` show it as a file change without error.
 * `server`: the MCP server name; CucCut's own is `cuccut`, and it is null for the agent's built-in tools.
 * `rule`: the rule saved when “always allow” is chosen (commands use `ccut <subcommand>` or the first word; tools use the tool name), computed by the Driver or the tool catalog;
 * null or absent means this kind offers no “always allow”.
 */
export type ApprovalRequest =
  | { kind: 'command'; command: string; cwd: string | null; reason: string | null; rule?: string | null }
  | { kind: 'file-change'; reason: string | null; files: string[]; rule?: string | null }
  | { kind: 'tool'; tool: string; reason: string | null; files: string[]; server?: string | null; rule?: string | null };

/**
 * - `accept-for-session`: passed through to the Driver unchanged (the native session-level allow); for CucCut tools it means “this same tool is no longer asked about in this task”, held in memory only and invalid once the task ends (architecture design §3.12).
 * - `accept-always`: saves a rule to `AgentPreferences.rules`, which auto-approves it in all sessions from then on. Rules belong to CucCut alone: a Driver must not write them into the agent's native persistent settings (Claude's userSettings / projectSettings), or “remove rule” on the settings page would be fake; on the native side it is handled at most as allow-once or session-level allow.
 */
export type ApprovalDecision = 'accept' | 'accept-for-session' | 'accept-always' | 'decline';
export type ApprovalStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
/**
 * Who made the decision: the user clicked it, it was automatic by access mode (allow or deny; `auto` in architecture design §3.12), or it was automatically allowed by an “always allow” rule.
 * `rule` is a layer added on top of §3.12: rules are consulted only when the table yields “ask”, and a match is allowed automatically. When the table says “deny”, it is not allowed through, and approvals for sending data externally do not consult rules.
 */
export type ApprovalDecider = 'user' | 'auto' | 'rule';

interface TimelineBase {
  id: Id;
  createdAt: string;
  /** The task it belongs to; user messages and task cards carry it too, so they can be grouped by task. */
  taskId: Id | null;
}

/**
 * An item in a session (product design §3.2.2): a user message, an agent reply, an execution step, an approval, or a task card.
 * Card state comes from events and receipts, not from the model's natural language (architecture design §11.3).
 */
export type TimelineItem =
  | (TimelineBase & {
      kind: 'user-message';
      text: string;
      context?: EditorContext;
      references?: SpaceEntryReference[];
      attachments?: AttachmentRef[];
      /** Scene template attached when sending (template package spec §5.2): only a marker. The prompt body and brief guidance go to the agent and are not in `text`. */
      template?: TemplateMessageRef;
      /** Skills picked at send time (architecture design §3.8), in the order attached: only markers. The body of `SKILL.md` goes to the agent and is not in `text`. */
      skills?: SkillMessageRef[];
      /** Legacy record: the marker written when only one skill could be picked. Treated like `skills` when read (`messageSkills`); new messages no longer write it. */
      skill?: SkillMessageRef;
      /** Slide annotations sent with the message (docs/design/slides §9), in the order added. The annotation text was handed to the agent and is not in `text`. Absent in old records. */
      slideAnnotations?: SlideAnnotation[];
      /** Design annotations sent with the message (docs/design/canvas §9), in the order added; same form as `slideAnnotations`. Absent in old records. */
      designAnnotations?: DesignAnnotation[];
      /** Design system annotations sent with the message (docs/design/canvas §10.6), in the order added; same form as `designAnnotations`. Absent in old records. */
      designSystemAnnotations?: DesignSystemAnnotation[];
    })
  | (TimelineBase & { kind: 'agent-message'; text: string; streaming: boolean })
  | (TimelineBase & { kind: 'reasoning'; text: string; streaming: boolean })
  | (TimelineBase & {
      kind: 'tool-call';
      tool: ToolCallKind;
      title: string;
      detail: string | null;
      output: string;
      status: ToolCallStatus;
      exitCode: number | null;
      durationMs: number | null;
    })
  | (TimelineBase & {
      kind: 'approval';
      approvalId: Id;
      request: ApprovalRequest;
      status: ApprovalStatus;
      decidedAt: string | null;
      /** Risk level of the action and the access mode in effect at the time (§3.12). Absent in old records. */
      risk?: RiskLevel;
      mode?: AgentMode;
      /** Who made the decision: automatic by mode, by an “always allow” rule, or the user. Absent for cancelled ones and old records. */
      decidedBy?: ApprovalDecider;
      /**
       * Which answer the user clicked (only present when `decidedBy: 'user'`): the UI uses it to write “always allow” as “no longer asked for <rule>”.
       * Earlier records do not have this field.
       */
      decision?: ApprovalDecision;
    })
  | (TimelineBase & {
      kind: 'task';
      goal: string;
      status: TaskStatus;
      startedAt: string;
      endedAt: string | null;
      error: string | null;
      /** Message reference for `error` (message-ref.ts): included when the reason was written by CucCut; the UI regenerates it in the current language. The agent's original wording has none. */
      errorRef?: MessageRef;
      /**
       * The access mode when the task started, and where it came from (architecture design §3.12, §5.10). Absent in old records; old values are converted to new ones on read.
       * Switching the mode while the task runs does not change this; the switch is recorded in the session's prompts (`modeChange`).
       */
      autonomy?: { mode: AgentMode; source: AutonomySource };
      /** Recoverable failure reason; the UI uses it to offer ways out such as “log in” or “resend with another model”. */
      errorCode?: AgentErrorCode | null;
      /** Current revision of the task contract (architecture design §3.2). Absent in old records; the default contract is filled in on read. Historical revisions are looked up with `tasks.getContract`. */
      contract?: TaskContract;
    })
  | (TimelineBase & {
      kind: 'notice';
      level: 'info' | 'warning' | 'error';
      text: string;
      /** Message reference for `text` (message-ref.ts): included when the hint was written by CucCut; the UI regenerates it in the current language. The agent's original wording has none. */
      textRef?: MessageRef;
      /** A record of switching the access mode (§3.12). */
      modeChange?: { from: AgentMode; to: AgentMode };
    })
  | (TimelineBase & VideoChange & { kind: 'video-change' })
  | (TimelineBase & VideoCreated & { kind: 'video-created' })
  | (TimelineBase & SlidesCreated & { kind: 'slides-created' })
  | (TimelineBase & DesignCreated & { kind: 'design-created' })
  | (TimelineBase & DesignSystemCreated & { kind: 'design-system-created' });

export type TimelineItemKind = TimelineItem['kind'];

/**
 * The agent created a video in this session (`videos_create`, architecture design §3.5). Once the video exists, a video card appears in the thread and the editor can be opened at any time (product design §3.2.2). Videos created by fixed flows (import from a link, `target.create` for transcription) are not recorded separately: when the parent task record gets a `videoId`, the UI can see it.
 * This is not a change card: creation has no undo; deleting a video is a separate operation (§4.9).
 */
export interface VideoCreated {
  videoId: Id;
  videoName: string;
  /** Opens this video in the editor; same form as `VideoChange.target`. */
  target: VideoChange['target'];
  videoRevision: string;
}

/**
 * `videos.derive` (tool `videos_derive`, architecture design §3.5 “derive a child video”): copies the parent video (timeline and script) and cuts away everything outside the edited timeline range `[start, end)` (seconds) with cut points, creating the result next to the parent video; restoring the cut points in the child video lets the clip be extended outward. The range is first aligned to frames (start rounds down, end rounds up; when rounding would cross a pause between sentences and take words from an adjacent sentence, it is rounded the other way; the `range` in the result is the range actually used). `width` and `height` default to the parent's canvas;
 * `fit` and `crop`, when given, are written onto every video clip; `crops` frames the video by shot (see the fields); `captions`, `translations` and `chapters` are all on by default.
 */
export interface VideoDeriveParams {
  videoId: Id;
  start: number;
  end: number;
  /** Child video name; defaults to “parent name · mm:ss–mm:ss”. Not part of the idempotency key. */
  name?: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain';
  crop?: { left: number; top: number; right: number; bottom: number };
  /**
   * Framing by shot: each `[from, to)` range in seconds on the parent's edited timeline (same clock as `start` and `end`) gets its own crop; up to 64 segments, not overlapping.
   * The start and end of each segment are snapped to the nearest frame and clipped to the range (what is clipped or dropped is explained by `crops-adjusted`). The video clips of the main material are split where the framing changes, and each piece carries its own crop. Places not covered use `crop`. Only counted in the idempotency key when given.
   */
  crops?: VideoDeriveCrop[];
  captions?: boolean;
  translations?: boolean;
  chapters?: boolean;
  /** Opening sentence (the “opening” on the result card of a short cut video); when not given, the UI takes the first sentence of the child video's kept section. Written into the derivation source document; not part of the idempotency key. */
  hook?: string;
  /** Why this section was picked (“why it was picked” on the result card). Written into the derivation source document; not part of the idempotency key. */
  reason?: string;
  /** Caption cards: a few short reminders (e.g. “the opening is the other party's reaction shot”). Written into the derivation source document; not part of the idempotency key. */
  notes?: string[];
}

/** One framing: `[from, to)` seconds on the timeline, and the proportion trimmed from each of the four edges (same as `crop`). */
export interface VideoDeriveCrop {
  from: number;
  to: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * What was dropped, changed or not done during derivation (architecture design §3.5 “derive a child video”). `translations-skipped`: a translation of the parent video could not be copied (`documentId` is the translation in the parent video; its body is neither `cuccut.translation/2` nor convertible from the old project's `/1`). `crops-adjusted`: `count` segments of the framing by shot were clipped to the range, or became empty after clipping and were dropped. `animation-split`: the split clips (`itemId`, in the parent video) have a looping animation or a volume envelope; after splitting, each piece is computed from its start.
 */
export type VideoDeriveWarningCode =
  | 'anchor-dropped'
  | 'locks-dropped'
  | 'animation-bindings-dropped'
  | 'multiple-assets'
  | 'range-not-exact'
  | 'items-not-restorable'
  | 'captions-skipped'
  | 'translations-skipped'
  | 'crops-adjusted'
  | 'animation-split';

export interface VideoDeriveResult {
  /** Child video: same form as `video-created` from `videos_create`. */
  video: VideoCreated;
  /** A child video with the same parent video version, range and settings already exists: it is recognized and returned; nothing new is created. */
  reused: boolean;
  /** Idempotency key: a digest of the parent video, its version, the aligned range and the settings. */
  key: string;
  /** The range actually used after aligning to frames (seconds; the boundaries stay within the pauses between sentences). */
  range: { start: number; end: number };
  /** The main material whose cut points are recorded (its ID in the parent video); null when there is no media to cut. */
  primaryAssetId: Id | null;
  /** Cut points recorded outside the range: seconds on the main material's source clock (the material IDs of the parent video). Restoring them in the child video returns to the full view of the parent. */
  cuts: { assetId: Id; from: number; to: number }[];
  /** Number of clips copied; pieces split by framing by shot are counted by segment. */
  itemCount: number;
  /** The framing by shot actually used: the segments after aligning to frames and clipping to the range (seconds on the parent's edited timeline). Present only when `crops` was given. */
  framing?: VideoDeriveCrop[];
  /** The derivation source document inside the child video (`kind: 'derivation'`). */
  derivationDocumentId: Id | null;
  /**
   * The selection note recorded in the derivation source document, echoed back as given (trimmed; omitted when empty), so the caller can check what was written. When an existing child video is recognized, the original document is returned: what is passed this time does not rewrite it.
   */
  hook?: string;
  reason?: string;
  notes?: string[];
  speech: { documentId: Id; sourceDocumentId: Id; words: number }[];
  translations: { documentId: Id; sourceDocumentId: Id }[];
  /** The caption track created. Captions are split by the whole script; `cueCount` counts only the caption cues that fall inside the kept range (visible in the child video); null when an existing track was recognized. */
  captions: { documentId: Id; sourceDocumentId: Id; cueCount: number | null }[];
  warnings: { code: VideoDeriveWarningCode; itemId?: Id; assetId?: Id; documentId?: Id; count?: number }[];
}

/**
 * `videos.shots` (tool `videos_shots`, architecture design §3.5 “shot cuts”): finds the points where the picture cuts within the edited timeline range `[start, end)` (seconds; the whole timeline by default; at most 20 minutes). It splits the range by the same rules as frame fetching (the topmost, enabled, track-visible video clip): where the clip changes or the source picture does not continue, it is an `edit`; within each piece, the source picture is passed to ffmpeg's scene score (`select='gt(scene,T)'`), and those above `threshold` (0–1, default 0.3) are `scene`.
 * Shots shorter than `minShot` seconds (default 0.8) are merged into the previous one. Only sudden changes in the picture are detected; it does not recognize people. Dissolves and pans will be missed, and flashes may be over-reported.
 */
export interface VideoShotsParams {
  videoId: Id;
  start?: number;
  end?: number;
  threshold?: number;
  minShot?: number;
}

/** One cut: the timeline seconds (snapped to a frame); `score` is the scene score (null for `edit`). */
export interface VideoShotCut {
  at: number;
  score: number | null;
  kind: 'scene' | 'edit';
}

export interface VideoShotsResult {
  videoId: Id;
  revision: string;
  /** The range actually detected (snapped to frames). */
  range: { start: number; end: number };
  cuts: VideoShotCut[];
  /** The shots between adjacent cuts; `sampleAt` is the times at 20%, 50% and 80% of the shot (decimal second strings, usable directly as the `at` of frame fetching). */
  shots: { start: number; end: number; sampleAt: string[] }[];
  threshold: number;
  minShot: number;
  detector: 'ffmpeg-scene';
}

/**
 * The agent made a slide deck in this session (`slides_check` passed validation, docs/design/slides §7.3): a slide card appears in the thread, and clicking it opens the deck for editing in the slides tab of the feature area.
 * A deck has only one entry; when validation passes again later, its title, page count and `taskId` are updated (to that validation's task; item ids and positions do not change).
 */
export interface SlidesCreated {
  /** Deck directory; same form as `VideoCreated.target`, passed to `slides.open` unchanged when opened. */
  target: VideoChange['target'];
  /** The `title` of `deck.json` (trimmed; may be empty). */
  title: string;
  slideCount: number;
}

/**
 * The agent made a design in this session (`design_check` with no problems, docs/design/canvas §7.3): a design card appears in the thread, and clicking it opens the design for editing in the design tab of the feature area.
 * Same rules as `SlidesCreated`: a design has only one entry; when validation passes again later, its title, board count and `taskId` are updated.
 */
export interface DesignCreated {
  /** Design directory; same form as `VideoCreated.target`, passed to `design.open` unchanged when opened. */
  target: VideoChange['target'];
  /** The `title` of `canvas.json` (trimmed; the directory name when there is none). */
  title: string;
  boardCount: number;
}

/**
 * The agent made a design system in this session (`design_system_check` with no problems, docs/design/canvas §10.5): a design system card appears in the thread, and clicking it opens the design system for editing in the design system tab of the feature area.
 * Same rules as `DesignCreated`: a design system has only one entry; when validation passes again later, its title and `taskId` are updated.
 */
export interface DesignSystemCreated {
  /** Design system directory; same form as `VideoCreated.target`, passed to `designSystem.open` unchanged when opened. */
  target: VideoChange['target'];
  /** The `title` of `design-system.json` (trimmed; the directory name when there is none). */
  title: string;
}

/**
 * The structured cause of a turn failure (architecture design §3.11). The Driver recognizes it from native errors (Claude's `authentication_failed`, `model_not_found`, `billing_error`; Codex's login and model errors). Unrecognized ones are null, and the UI shows only the raw text.
 * `AGENT_BILLING_REQUIRED`: a problem with the account's balance or payment (Claude's `billing_error`); the user has to handle it with the provider, and waiting will not recover it. Plan usage at its limit and rate limiting remain `AGENT_RATE_LIMITED`.
 * `AGENT_ACCESS_MODE_UNSUPPORTED`: this agent has no per-action approval channel (`capabilities.approvals` is false), so it can only run in `fullAccess`. The Harness rejects this when sending and when switching modes (`RpcError.code` is `conflict`, placed in `details.code`, §3.12), and does not change the mode on the user's behalf.
 */
export const AGENT_ERROR_CODES = [
  'AGENT_AUTH_REQUIRED',
  'AGENT_MODEL_UNAVAILABLE',
  'AGENT_NOT_INSTALLED',
  'AGENT_OUTDATED',
  'AGENT_RATE_LIMITED',
  'AGENT_BILLING_REQUIRED',
  'AGENT_EXITED',
  'AGENT_ACCESS_MODE_UNSUPPORTED',
] as const;
export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

/**
 * An image in a message (product design §3.2.4). The bytes are PUT to the Runtime at the upload address from `attachments.prepare` and stored under the Runtime Home; when sending to the agent, the Harness replaces it with a local path.
 */
export interface AttachmentRef {
  id: Id;
  kind: 'image' | 'file';
  fileName: string;
  mimeType: string;
  size: number;
}

/**
 * The editor context at send time (product design §5.3, architecture design §3.4): the open video, the version being viewed, the selected clip and the playhead.
 * It is bound to stable IDs and the version at the time, not to screen positions.
 */
export interface EditorContext {
  videoId: Id;
  videoName: string;
  /** Video directory, relative to the source directory (the project directory or the session's working directory). */
  videoPath: string;
  revision: string;
  /** The selected timeline clip. */
  selection: Id[];
  playheadSeconds: number;
  /** The user's UI language (BCP 47, e.g. `zh-Hans`, `en`); skills use it to choose the output language (the language the user asked in takes priority). Old clients do not send it. */
  uiLanguage?: string;
}

/**
 * A change card (product design §6.5): one edit the agent submitted through the video engine. All of its content comes from the transaction receipt, not from the model's claims.
 */
export interface VideoChange {
  videoId: Id;
  videoName: string;
  /** Opens this video in the editor. */
  target: { projectId: Id; path: string } | { conversationId: Id; path: string };
  transactionId: Id;
  /** The change name and reference from the receipt: the UI displays it with `localizeText(label, labelRef)`. */
  label: string;
  labelRef?: MessageRef;
  previousRevision: string;
  videoRevision: string;
  createdIds: Id[];
  updatedIds: Id[];
  deletedIds: Id[];
  durationSeconds: { before: number; after: number };
  /** Which change this one undoes. */
  undoOf: Id | null;
}

/** The three layers of capability (architecture design §3.6). */
export type CapabilityLevel = 'declared' | 'verified' | 'effective';

export type DriverUnavailableReason = 'not-installed' | 'not-connected' | 'no-permission' | 'unsupported' | 'resource';

/**
 * The state of an agent on this computer (architecture design §3.11). When several problems exist at once, one is chosen by the priority in the design:
 * not installed > error > version too old > not logged in > disabled > available.
 */
export type DriverState = 'ready' | 'not-installed' | 'outdated' | 'signed-out' | 'error' | 'disabled';

/** The model's positioning: recommended, strongest, fastest. The UI sorts and labels by it. */
export type ModelTier = 'balanced' | 'max' | 'fast';

export interface DriverEffort {
  /** The native effort id (for both Claude and Codex, values like `low` / `medium` / `high`). The UI maps them to Chinese labels. */
  id: string;
  label: string;
}

export interface DriverModel {
  id: string;
  label: string;
  description: string | null;
  tier: ModelTier | null;
  /** The default model the agent itself marks. */
  isDefault: boolean;
  /** An empty array = this model does not distinguish reasoning effort. */
  efforts: DriverEffort[];
  defaultEffort: string | null;
}

/**
 * One way to install or upgrade this agent. The command is shown to the user as it is, and can also be put into their terminal for them; it is not run in the background.
 * “Not run in the background” means not run secretly where the user cannot see. `brew` and `npm` style commands can be run inside the app by the Runtime after the user confirms each one (`agents.runSetup`; the output is shown on the settings page and recorded in the log, architecture design §12.9). `script` kind (downloading a script from the network and running it) is only offered for copying or `agents.openTerminal`.
 */
export interface DriverInstallOption {
  kind: 'script' | 'brew' | 'npm';
  label: string;
  /** Message reference for `label` (message-ref.ts). */
  labelRef?: MessageRef;
  /** A prerequisite, e.g. Homebrew, Node.js. */
  needs: string | null;
  /** Message reference for `needs` (message-ref.ts). */
  needsRef?: MessageRef;
  command: string;
  upgrade: string;
}

/** An install action run inside the app: install or upgrade (login is only done in the system terminal; see `agents.openTerminal`). */
export type AgentSetupAction = 'install' | 'upgrade';

export type AgentSetupState = 'running' | 'completed' | 'failed' | 'cancelled';

/** The maximum number of output lines kept for one in-app run (matches the design's log limit); earlier lines are dropped, and `droppedLines` records how many were dropped. */
export const AGENT_SETUP_OUTPUT_LINES = 400;

/**
 * One in-app run of an install or upgrade command (`agents.runSetup`, architecture design §12.9). It is held only in the Runtime's memory and is not persisted.
 * When it ends, the Runtime re-probes the agent first and only then sends the terminal state: by the time the terminal state is received, `agents.list` already has the new result.
 */
export interface AgentSetupRun {
  runId: Id;
  driverId: DriverId;
  action: AgentSetupAction;
  kind: DriverInstallOption['kind'];
  /** The full command actually run: taken by the Runtime from the probe result, not given by the client. */
  command: string;
  state: AgentSetupState;
  /** The process exit code; null when it was ended by a signal or failed to start. */
  exitCode: number | null;
  /** Merged stdout and stderr, line by line, with terminal control sequences removed; only the last `AGENT_SETUP_OUTPUT_LINES` lines are kept. */
  output: string[];
  droppedLines: number;
  startedAt: string;
  endedAt: string | null;
  /** The reason, such as failure to start (a non-zero exit does not count; see `exitCode`). */
  error: string | null;
}

/**
 * Facts detected by the Driver (user preferences not included). `status` / `unavailableReason` are coarse legacy fields derived from `state` (see `driverAvailability`); callers that only care whether it can be used, such as the model service, keep using them.
 */
export interface DriverProbe {
  id: DriverId;
  name: string;
  /** The name typed in the terminal. */
  command: string;
  state: Exclude<DriverState, 'disabled'>;
  status: 'available' | 'unavailable';
  version: string | null;
  /** The minimum version CucCut can drive; an empty string means no requirement (user-added agents). */
  minVersion: string;
  /** The latest known upstream version; null if unknown. */
  latestVersion: string | null;
  unavailableReason: DriverUnavailableReason | null;
  /** A human-readable description of the problem (the raw error text, why it is unavailable). */
  detail: string | null;
  /** Message reference for `detail` (message-ref.ts): probe results are cached to disk, and the UI regenerates them in the current language. */
  detailRef?: MessageRef;
  executable: string | null;
  /** The real location the link finally resolves to, used to recognize who manages it (Homebrew, npm…) and to derive the matching upgrade command. */
  realExecutable: string | null;
  /** A description of the logged-in account (e.g. “Claude Pro subscription”); null if not logged in or unknown. */
  account: string | null;
  /** Message reference for `account` (message-ref.ts). */
  accountRef?: MessageRef;
  /** The subscription needed, e.g. “Claude Pro or Max subscription”. */
  plan: string;
  /** Message reference for `plan` (message-ref.ts). */
  planRef?: MessageRef;
  /** The command to log in from the terminal. */
  loginCommand: string | null;
  install: DriverInstallOption[];
  models: DriverModel[];
  /** Which model the CLI's own configuration picks when no model is passed (Codex reads `~/.codex/config.toml`), and whether this version of the CLI's model table has it. */
  configModel: string | null;
  configModelKnown: boolean | null;
  checkedAt: string;
  /**
   * This driver has passed integration tests (D08 in architecture design §3.11). When false, only the probe result is shown and it cannot be used to start a session: the Harness rejects sending (`driver-unavailable`). It is a fact about this version of the driver and does not change with installation or login on this machine.
   */
  verified: boolean;
  /**
   * This provider has run a complete session on a real machine in CucCut. A shared implementation of the same protocol (ACP) counts as `verified` once one provider passes on a real machine. The other presets and user-added agents can open sessions, but `tested` is false and the UI shows “未在 CucCut 实测” (not yet tested in CucCut). Like `verified`, it is a fact about this version of the driver.
   */
  tested: boolean;
  capabilities: {
    steer: boolean;
    approvals: boolean;
    resume: boolean;
    images: boolean;
  };
}

/** A capability snapshot entry for an agent engine (architecture design §3.6, §3.11): the probe result plus user preferences. */
export interface DriverInfo extends Omit<DriverProbe, 'state'> {
  state: DriverState;
  /** `builtin`: a driver bundled with CucCut; `custom`: a user-added ACP agent, which can be removed with `agents.removeProvider`. */
  source: 'builtin' | 'custom';
  /** The configuration of a user-added agent; null for built-in ones. */
  custom: CustomAgentProviderView | null;
  enabled: boolean;
  /** New sessions use it by default. */
  isDefault: boolean;
  /**
   * The model a new session starts with: the model id the user set (still given as is if it has dropped out of the model table; the new session then uses the recommended model instead). If never set, it is the recommended model (`recommendedDriverModel`; null when there is no model table yet). null = the user explicitly chose “Agent default model”, so no model is passed and the CLI configuration applies.
   * If the default agent has not been set, the `agent.defaultModel` preference is checked first.
   */
  defaultModel: string | null;
  /** The default reasoning effort for new sessions; null = the model's own default. */
  defaultEffort: string | null;
  /** The executable the user specified manually. */
  executableOverride: string | null;
}

/**
 * How “Agent default model” is stored: the agent's `defaultModel` preference and the `agent.defaultModel` preference store this value, meaning the user explicitly chose to pass no model and follow the agent's own CLI configuration. null means it was never set, so the recommended model (`recommendedDriverModel`) is used. It does not collide with a native model id (Cursor has a model called `auto`). It only appears in storage: `DriverInfo.defaultModel` and the session's `model` use null to represent it, and `agents.configure { defaultModel: null }` stores it as this value.
 */
export const AGENT_DEFAULT_MODEL = '__agent-default__';

/** Each vendor's recommended model family (user decision of 2026-09-29): Claude Code takes Sonnet, and Codex takes the tier ending in `-sol`, so the default does not land on the most expensive model. */
const RECOMMENDED_FAMILY: Partial<Record<DriverId, (model: DriverModel) => boolean>> = {
  claude: (m) => /sonnet/i.test(m.id),
  codex: (m) => /-sol$/i.test(m.id),
};

/**
 * The recommended model: new sessions without a set default model use it (design draft model-agent-setup.js `recommended`). It is taken in the order of this version's CLI model table: Claude Code's first Sonnet and Codex's first `-sol`. For the others (and when those two tables have no such family), it is the first one marked `balanced`; failing that, the agent's marked default; failing that, the first one.
 * null when the model table is empty (no model is passed).
 */
export function recommendedDriverModel(driverId: DriverId, models: readonly DriverModel[]): DriverModel | null {
  const family = RECOMMENDED_FAMILY[driverId];
  return (
    (family && models.find(family)) || models.find((m) => m.tier === 'balanced') || models.find((m) => m.isDefault) || models[0] || null
  );
}

/** Legacy coarse-grained fields derived from `state`. */
export function driverAvailability(state: DriverState): Pick<DriverProbe, 'status' | 'unavailableReason'> {
  switch (state) {
    case 'ready':
      return { status: 'available', unavailableReason: null };
    case 'not-installed':
      return { status: 'unavailable', unavailableReason: 'not-installed' };
    case 'outdated':
      return { status: 'unavailable', unavailableReason: 'unsupported' };
    case 'signed-out':
      return { status: 'unavailable', unavailableReason: 'not-connected' };
    case 'disabled':
      return { status: 'unavailable', unavailableReason: 'no-permission' };
    case 'error':
      return { status: 'unavailable', unavailableReason: 'resource' };
  }
}

/**
 * The three switches of the allow policy (settings › Permissions and Security, “reduce repeated prompts”; design draft). Architecture design §3.12 specifies that read-only actions (`read`) run directly under every mode without approval, so the read-only tools covered by `read` and `ccutro` are never asked about anyway; `loop` (the response loop) has no corresponding tool in this architecture.
 * The three switches only store the user's choice for the settings page to show; they do not take part in approval decisions.
 */
export interface AgentPolicy {
  /** Reading video files (read-only tools such as transcript and project) is allowed automatically. */
  read: boolean;
  /** CucCut's read-only commands (info / status / spec) are allowed automatically. */
  ccutro: boolean;
  /** The agent response loop (task claim / task submit) is allowed automatically. */
  loop: boolean;
}

/**
 * The user preferences for agents (settings › Agent providers), stored in the Runtime Home. The default agent for new sessions and the default access mode are the `agent.defaultDriver` and `agent.defaultAccessMode` preferences (`settings.*`, architecture design §5.10), not here.
 */
export interface AgentPreferences {
  drivers: Partial<Record<DriverId, AgentDriverPreferences>>;
  policy: AgentPolicy;
  /** Refreshes each agent's model table at startup and periodically while running. */
  modelAutoUpdate: boolean;
  /** The rules saved by “always allow”, in the order added. */
  rules: string[];
}

export interface AgentDriverPreferences {
  enabled: boolean;
  /** Model id; `AGENT_DEFAULT_MODEL` = the user explicitly chose “Agent default model”; null = never set, so the recommended model is used. */
  defaultModel: string | null;
  defaultEffort: string | null;
  executable: string | null;
}

export interface RuntimeInfo {
  instanceId: Id;
  /** The Runtime's run generation: different on each start. When the client sees it change, it drops its incremental cursor and fetches the snapshot again. */
  epoch: string;
  runtimeVersion: string;
  protocolVersion: string;
  home: string;
  /** “New project” goes here. */
  projectsDir: string;
  logsDir: string;
  pid: number;
  startedAt: string;
  /**
   * Who started this Runtime (architecture design §2.2): `cli` if it was auto-started by the CLI or started by `cuccut runtime ensure` (it exits by itself after being idle for the minutes set in `runtime.idleExitMinutes`; `cuccut runtime stop` only stops this kind). Others (the desktop app, `npm run runtime`) are null.
   */
  launchedBy: RuntimeLauncher | null;
}

export type RuntimeLauncher = 'cli';

/**
 * The result of `runtime.status` (architecture design §2.2): used by `cuccut runtime status` and `runtime stop` to decide whether anyone else is using it.
 * Connections only count the authenticated connections on the local gateway (the web service and external services use their own ports and are not counted here).
 */
export interface RuntimeStatus {
  info: RuntimeInfo;
  connections: { desktop: number; cli: number; agent: number };
  /** The number of tasks not yet finished (queued or running). */
  activeJobs: number;
  /** The open external services (MCP, model API, web, LAN sharing). */
  runningServices: string[];
  /** Idle exit (only Runtimes started by the CLI have it): the minutes set, and since when it has been idle (null when not idle). */
  idleExit: { minutes: number; idleSince: string | null } | null;
}

/** One row in the task center (product design §2.1): derived from the task cards in sessions, not stored separately. */
export interface TaskSummary {
  taskId: Id;
  conversationId: Id;
  conversationTitle: string;
  projectId: Id | null;
  goal: string;
  status: TaskStatus;
  startedAt: string;
  endedAt: string | null;
  error: string | null;
  /** Message reference for `error` (message-ref.ts), taken from the task card's `errorRef`: the UI regenerates it in the current language. */
  errorRef?: MessageRef;
  /** The current revision number of the task contract; absent for old tasks that have no contract. */
  contractRevision?: number;
}

/**
 * A Space entry (architecture design §5.7). Directories are a derived index. Entries come from four sources:
 *
 * - Files, video directories and slide directories recognized in source directories (registered project directories, and the working directories of sessions that belong to no project). A directory with a valid `deck.json` is one entry per deck and is not split into the files inside it. Video entries carry `ref.videoId`.
 * - Deliverable artifacts in the Artifact Store (generated images, audio and text; exports that are not in a source directory). `id` is the artifactId.
 * - In-progress and failed generations and exports in the Job Ledger: `generating` / `failed` placeholders. `id` is the jobId and there are no bytes.
 * - Project files registered through `space.import`. The same file in a source directory is the same entry, with `origin.source` set to `imported`.
 *
 * An export published into a source directory and the file found by scanning it are the same entry (`id` is decided by the source and the relative path), and carry the export's source and status.
 * `status` is null when there is nothing to say about it (plain files and videos).
 */
export type SpaceEntryKind =
  | 'video'
  | 'export'
  | 'video-file'
  | 'image'
  | 'audio'
  | 'subtitle'
  | 'document'
  | 'package'
  | 'template'
  | 'slides'
  | 'design'
  | 'design-system';

export type SpaceEntryStatus = 'generating' | 'candidate' | 'applied' | 'published' | 'source-changed' | 'missing' | 'failed';

/** Where the entry came from (`origin` in architecture design §5.7). Generation parameters (the original text, prompts) are not here; they are only in the Job record. */
export interface SpaceEntryOrigin {
  /** `derived`: a child video derived from a section of another video (`videos.derive`); `videoId` is the parent video. */
  source: 'generated' | 'imported' | 'exported' | 'derived';
  /**
   * The owning project: an artifact takes the project of the video or session that produced it; null when it belongs to no project. For entries whose bytes are not in a source directory (both `source` fields null), this is what assigns them to a project; the `projectId` filter of `space.list` checks both places.
   */
  projectId?: Id | null;
  /** The video that produced it; an export also has a frozen video version. */
  videoId?: Id;
  videoRevision?: string;
  /** For a derived child video: the parent video's range it was derived from (seconds on the parent's edited timeline); only present for `derived`. */
  range?: { start: number; end: number };
  conversationId?: Id;
  taskId?: Id;
  jobId?: Id;
  /** The capability that generated, exported or derived it (`synthesizeSpeech`, `generateImage`, `generateMusic`, `generateText`, `export`, `videos-derive`). */
  capability?: string;
  provider?: { providerId: string; modelId: string };
}

export interface SpaceEntry {
  id: Id;
  kind: SpaceEntryKind;
  /** Display name: the edited name if the user has changed it, otherwise the file name. */
  name: string;
  fileName: string;
  /**
   * The source directory holding the bytes: a project, or the working directory of a session that belongs to no project. For entries not inside any source directory (artifacts in the Artifact Store, exports outside a source directory, placeholders), both are null; then `relPath` is only a file name for display and must not be joined to a source directory path. The owning project is in `origin.projectId`.
   */
  source: { projectId: Id | null; conversationId: Id | null };
  /** The path relative to the source directory, separated by `/`. */
  relPath: string;
  size: number;
  lastActivityAt: string;
  /** ISO time; an old Runtime may not provide it, and it is null when it cannot be determined. The creation time does not use the file's status change time (ctime). */
  createdAt?: string | null;
  /** The most recent update time of the content; independent of the creation time, and an old Runtime may not provide it. */
  updatedAt?: string | null;
  status: SpaceEntryStatus | null;
  user: { favorite: boolean; displayName: string | null; trashedAt: string | null };
  /** The object it points to: a video (for video entries), an artifact (the result of a generation or export), or a task (for placeholders). Plain files have none. */
  ref?: { videoId: Id } | { artifactId: string } | { jobId: Id };
  origin?: SpaceEntryOrigin;
  /** A description of the status: the reasons for failure and missing files, progress, the version the finished video was frozen at, and the video's current version. */
  statusDetail?: {
    reason?: string;
    code?: string;
    progress?: { done: number; total: number | null };
    currentRevision?: string;
  };
  media?: { mediaType?: string; durationSec?: number; width?: number; height?: number };
  /** The page count of a slide entry (a deck directory, docs/design/slides §7.3); `name` is the deck's title. */
  deck?: { slideCount: number };
  /** The board count of a design entry (a design directory, docs/design/canvas §7.3); `name` is the design's title. */
  canvas?: { boardCount: number };
  /**
   * The file the result is written to on disk (architecture design §7.9 “save location”): taken from the task result's `outputs[].path`, i.e. the file that the file-to-file flow and export publish, and the copies saved by direct tasks. Absent when the file no longer exists; also absent for plain files found by scanning a source directory (they are built from the source directory and `relPath`).
   */
  file?: { path: string };
}

/** A scan of some source directory did not list everything (too many files, or unreadable); this is reported honestly to the UI. */
export interface SpaceScanIssue {
  sourceKey: string;
  kind: 'truncated' | 'unreadable';
  detail: string;
}

/** Runtime discovery info (architecture design §2.2), written under the Runtime Home with permission 0600. */
export interface RuntimeDiscovery extends RuntimeInfo {
  endpoint: string;
  token: string;
}

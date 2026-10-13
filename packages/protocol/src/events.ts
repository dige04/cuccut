import type { ApprovalOutcome, PendingApproval } from './access.ts';
import type { AgentSetupRun, Conversation, Id, Project, Seq, SpaceEntry, SpaceScanIssue, TaskSummary, TimelineItem } from './domain.ts';
import type { GrantsEvent, GrantsSnapshot } from './grants.ts';
import type { JobsEvent, JobsSnapshot } from './jobs.ts';
import type { LegacyImportEvent, LegacyImportSnapshot } from './legacy-import.ts';
import type { LibraryEvent, LibrarySnapshot } from './library.ts';
import type { ReviewTopicEvent, ReviewTopicSnapshot } from './review.ts';
import type { AgentsView } from './methods.ts';
import type { ModelsEvent, ModelsSnapshot } from './models.ts';
import type { SettingsEvent, SettingsSnapshot } from './settings.ts';
import type { ServicesEvent, ServicesSnapshot } from './services.ts';
import type { VideoTopicEvent, VideoTopicSnapshot } from './video.ts';

/**
 * Topics to subscribe to (architecture design §4.4, §4.5): subscribe per resource; one connection multiplexes them.
 *
 * - `directory`: project and session lists (the projection behind the sidebar).
 * - `tasks`: tasks of all sessions (the task center and the progress in the title bar), plus pending approvals for sessions and external services.
 * - `space`: Space directory (architecture design §5.7).
 * - `jobs`: state, stage and progress of long computations (speech recognition, etc.) (architecture design §7).
 * - `models`: capability view of model services (`models.capabilities`, architecture design §6.8); a new view is delivered when configuration, defaults, model packs or nodes change.
 * - `settings`: preferences held by the Runtime (architecture design §5.10); the snapshot holds the effective values and defaults of all keys, and each later change sends `settings.updated`.
 * - `services`: state of external services and pending service approvals (architecture design §4.8).
 * - `library`: entries of the user library (architecture design §5.9).
 * - `grants`: authorizations and usage for sending data out (architecture design §12.5); the snapshot is all grants, and each later change to a grant (issued, used, revoked) sends `grant.upsert`.
 * - `agent-setup`: state and output of the install and upgrade commands for in-app Agents (`agents.runSetup`, architecture design §12.9).
 * - `agents`: probe results and preferences of Agents (Drivers) (the view of `agents.list`, architecture design §3.11); the snapshot is the last result (loaded from the disk cache at startup), and each Driver's background probe completion or preference change sends `agents.updated`.
 * - `legacy-import`: import prompts for legacy projects and the imports running in this launch (architecture design §2.7, `legacy-import.ts`); the snapshot is the prompt awaiting an answer and the import progress; `prompt.updated` is sent when a prompt appears or disappears, and `run.updated` is sent on each import progress.
 * - `review`: the review gate (docs/cuccut/m2-review-gate.md §4.5): the user's standard and one summary per reviewed video (those written since start, plus those read through `review.get`); `criteria` is sent when the standard changes, `result` when a result is written. Waivers are document edits, so they also arrive through `video:<id>`.
 * - `conversation:<id>`: content of one session (card projection).
 * - `video:<id>`: projection of one opened video (command and protocol spec §10).
 *
 * Each topic has its own sequence number; topics do not share a cursor.
 */
export type Topic =
  | 'directory'
  | 'tasks'
  | 'space'
  | 'jobs'
  | 'models'
  | 'settings'
  | 'services'
  | 'library'
  | 'grants'
  | 'agent-setup'
  | 'agents'
  | 'legacy-import'
  | 'review'
  | `conversation:${Id}`
  | `video:${Id}`;

export function conversationTopic(conversationId: Id): Topic {
  return `conversation:${conversationId}`;
}

export function parseConversationTopic(topic: string): Id | null {
  return topic.startsWith('conversation:') ? topic.slice('conversation:'.length) : null;
}

export function videoTopic(videoId: Id): Topic {
  return `video:${videoId}`;
}

export function parseVideoTopic(topic: string): Id | null {
  return topic.startsWith('video:') ? topic.slice('video:'.length) : null;
}

export interface DirectorySnapshot {
  projects: Project[];
  conversations: Conversation[];
}

export type DirectoryEvent =
  | { type: 'project.upsert'; project: Project }
  | { type: 'conversation.upsert'; conversation: Conversation }
  | { type: 'conversation.removed'; conversationId: Id };

export interface TasksSnapshot {
  tasks: TaskSummary[];
  /**
   * Pending approvals, both the session's and the external services' (architecture design §3.12), oldest first. The Runtime always supplies this;
   * it is optional only so that older task-only mirrors (without this field) can still apply the events of the `tasks` topic.
   */
  approvals?: PendingApproval[];
}

export type TasksEvent =
  | { type: 'task.upsert'; task: TaskSummary }
  | { type: 'task.removed'; taskId: Id }
  | { type: 'approval.upsert'; approval: PendingApproval }
  | { type: 'approval.removed'; approvalId: Id; outcome: ApprovalOutcome };

export interface SpaceSnapshot {
  entries: SpaceEntry[];
  issues: SpaceScanIssue[];
  /** The first scan has not finished yet. */
  scanning: boolean;
}

/** Incremental; a full rescan sends one `catalog.replaced`, so clients need not compare entries one by one. */
export type SpaceEvent =
  | { type: 'entry.upsert'; entry: SpaceEntry }
  | { type: 'entry.removed'; entryId: Id }
  | { type: 'catalog.replaced'; snapshot: SpaceSnapshot };

export interface ConversationSnapshot {
  conversation: Conversation;
  /** In order of appearance. */
  items: TimelineItem[];
}

/**
 * Events for the conversation topic. Streamed text arrives as incremental `item.append` events, but entry identity and completion boundaries are kept:
 * a final state is always closed by one `item.upsert` (architecture design §4.5).
 */
export type ConversationEvent =
  | { type: 'item.upsert'; item: TimelineItem }
  | { type: 'item.append'; itemId: Id; field: 'text' | 'output'; delta: string }
  | { type: 'conversation.updated'; conversation: Conversation }
  | { type: 'conversation.removed' };

/**
 * The `agent-setup` topic. It is not made a Job (the `jobs` topic): JobRecord has no output lines, and what is required are the fields the model computes
 * (content hash, Provider, model pack, input hash). A Job would also be persisted to the ledger and appear in `jobs.list` and in the agent's task tools.
 * Run records live in memory only, keeping the most recent few (newest first).
 */
export interface AgentSetupSnapshot {
  runs: AgentSetupRun[];
}

export type AgentSetupEvent =
  /** A new run, or a change of state (running → terminal); carries the full record. */
  | { type: 'setup.updated'; run: AgentSetupRun }
  /** Appended output lines. After appending, the client keeps only the last `AGENT_SETUP_OUTPUT_LINES` lines. */
  | { type: 'setup.output'; runId: Id; lines: string[] };

/** `agents` topic: the snapshot is the view of `agents.list`; `checking` lists the Drivers that have no probe result yet and are being probed for the first time (they are not in `drivers`). */
export type AgentsSnapshot = AgentsView;
export type AgentsEvent =
  /** A Driver's probe has finished (including background refresh and correction) or a preference has changed; carries the full new view, which the client replaces wholesale. */
  { type: 'agents.updated'; view: AgentsView };

export interface TopicMap {
  directory: { snapshot: DirectorySnapshot; event: DirectoryEvent };
  tasks: { snapshot: TasksSnapshot; event: TasksEvent };
  space: { snapshot: SpaceSnapshot; event: SpaceEvent };
  jobs: { snapshot: JobsSnapshot; event: JobsEvent };
  models: { snapshot: ModelsSnapshot; event: ModelsEvent };
  settings: { snapshot: SettingsSnapshot; event: SettingsEvent };
  services: { snapshot: ServicesSnapshot; event: ServicesEvent };
  library: { snapshot: LibrarySnapshot; event: LibraryEvent };
  grants: { snapshot: GrantsSnapshot; event: GrantsEvent };
  'agent-setup': { snapshot: AgentSetupSnapshot; event: AgentSetupEvent };
  agents: { snapshot: AgentsSnapshot; event: AgentsEvent };
  'legacy-import': { snapshot: LegacyImportSnapshot; event: LegacyImportEvent };
  review: { snapshot: ReviewTopicSnapshot; event: ReviewTopicEvent };
  conversation: { snapshot: ConversationSnapshot; event: ConversationEvent };
  video: { snapshot: VideoTopicSnapshot; event: VideoTopicEvent };
}

export type SnapshotOf<T extends Topic> = T extends 'directory'
  ? DirectorySnapshot
  : T extends 'tasks'
    ? TasksSnapshot
    : T extends 'space'
      ? SpaceSnapshot
      : T extends 'jobs'
        ? JobsSnapshot
        : T extends 'models'
          ? ModelsSnapshot
          : T extends 'settings'
            ? SettingsSnapshot
            : T extends 'services'
              ? ServicesSnapshot
              : T extends 'library'
                ? LibrarySnapshot
                : T extends 'grants'
                  ? GrantsSnapshot
                  : T extends 'agent-setup'
                    ? AgentSetupSnapshot
                    : T extends 'agents'
                      ? AgentsSnapshot
                      : T extends 'legacy-import'
                        ? LegacyImportSnapshot
                        : T extends 'review'
                        ? ReviewTopicSnapshot
                        : T extends `video:${string}`
                        ? VideoTopicSnapshot
                        : ConversationSnapshot;
export type EventOf<T extends Topic> = T extends 'directory'
  ? DirectoryEvent
  : T extends 'tasks'
    ? TasksEvent
    : T extends 'space'
      ? SpaceEvent
      : T extends 'jobs'
        ? JobsEvent
        : T extends 'models'
          ? ModelsEvent
          : T extends 'settings'
            ? SettingsEvent
            : T extends 'services'
              ? ServicesEvent
              : T extends 'library'
                ? LibraryEvent
                : T extends 'grants'
                  ? GrantsEvent
                  : T extends 'agent-setup'
                    ? AgentSetupEvent
                    : T extends 'agents'
                      ? AgentsEvent
                      : T extends 'legacy-import'
                        ? LegacyImportEvent
                        : T extends 'review'
                        ? ReviewTopicEvent
                        : T extends `video:${string}`
                        ? VideoTopicEvent
                        : ConversationEvent;

export interface SequencedEvent<E> {
  seq: Seq;
  event: E;
}

/**
 * The first result of a subscription: either a snapshot at the same watermark, or a replay of what follows the client's cursor (architecture design §4.4).
 * When the server cannot prove the replay is complete, it always sends a snapshot; a client does not keep going on a mirror that is missing events.
 */
export type SubscribeResult<S, E> = { mode: 'snapshot'; seq: Seq; snapshot: S } | { mode: 'replay'; seq: Seq; events: SequencedEvent<E>[] };

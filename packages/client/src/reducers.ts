import {
  AGENT_SETUP_OUTPUT_LINES,
  applyVideoEvent,
  clampOutput,
  type AgentSetupEvent,
  type AgentSetupSnapshot,
  type ConversationEvent,
  type ConversationSnapshot,
  type DirectoryEvent,
  type DirectorySnapshot,
  type JobsEvent,
  type JobsSnapshot,
  type ModelsEvent,
  type ModelsSnapshot,
  type SettingsEvent,
  type SettingsSnapshot,
  type ServicesEvent,
  type ServicesSnapshot,
  type VideoTopicEvent,
  type VideoTopicSnapshot,
  type SpaceEvent,
  type SpaceSnapshot,
  type TasksEvent,
  type TasksSnapshot,
  type TimelineItem,
} from '@cuccut/protocol';

/**
 * Pure reducers for the local mirror (architecture design §11.4). They depend only on the event itself and make no business decisions.
 * They return new objects, for state libraries that compare by reference, such as Zustand.
 */
export function applyDirectoryEvent(state: DirectorySnapshot, event: DirectoryEvent): DirectorySnapshot {
  switch (event.type) {
    case 'project.upsert':
      return { ...state, projects: upsertBy(state.projects, event.project, (p) => p.id) };
    case 'conversation.upsert':
      return { ...state, conversations: upsertBy(state.conversations, event.conversation, (c) => c.id) };
    case 'conversation.removed':
      return { ...state, conversations: state.conversations.filter((c) => c.id !== event.conversationId) };
  }
}

/** New tasks go at the front, consistent with the snapshot's ordering. */
export function applyTasksEvent(state: TasksSnapshot, event: TasksEvent): TasksSnapshot {
  switch (event.type) {
    case 'task.upsert': {
      const index = state.tasks.findIndex((t) => t.taskId === event.task.taskId);
      if (index < 0) return withApprovals({ tasks: [event.task, ...state.tasks] }, state);
      const tasks = state.tasks.slice();
      tasks[index] = event.task;
      return withApprovals({ tasks }, state);
    }
    case 'task.removed':
      return withApprovals({ tasks: state.tasks.filter((t) => t.taskId !== event.taskId) }, state);
    // Pending approvals (both session approvals and external service approvals): appended at the end when they appear (older first, consistent with the snapshot), and removed when they end.
    // A mirror without `approvals` is treated as an empty list.
    case 'approval.upsert': {
      const approvals = (state.approvals ?? []).slice();
      const index = approvals.findIndex((a) => a.approvalId === event.approval.approvalId);
      if (index < 0) approvals.push(event.approval);
      else approvals[index] = event.approval;
      return { tasks: state.tasks, approvals };
    }
    case 'approval.removed':
      return { tasks: state.tasks, approvals: (state.approvals ?? []).filter((a) => a.approvalId !== event.approvalId) };
  }
}

function withApprovals(next: TasksSnapshot, state: TasksSnapshot): TasksSnapshot {
  return state.approvals ? { ...next, approvals: state.approvals } : next;
}

/**
 * Background jobs (transcription etc.): a record's new state replaces the old one. New tasks go at the front, consistent with the snapshot's ordering.
 * Live transcript segments (`liveSegments`): `job.segments` is written segment by segment starting at `from`. Existing indices are replaced and later ones are kept. When `from` goes past the existing segment count, the whole update is ignored (nothing is guessed; the next snapshot fills it in). When the record is no longer `running`, the job's segments are dropped. When there are no segments, `liveSegments` is not included.
 */
export function applyJobsEvent(state: JobsSnapshot, event: JobsEvent): JobsSnapshot {
  switch (event.type) {
    case 'job.updated': {
      const index = state.jobs.findIndex((j) => j.jobId === event.job.jobId);
      let jobs: JobsSnapshot['jobs'];
      if (index < 0) jobs = [event.job, ...state.jobs];
      else {
        jobs = state.jobs.slice();
        jobs[index] = event.job;
      }
      let live = state.liveSegments;
      if (live && event.job.state !== 'running' && event.job.jobId in live) {
        const rest = { ...live };
        delete rest[event.job.jobId];
        live = Object.keys(rest).length > 0 ? rest : undefined;
      }
      return live ? { jobs, liveSegments: live } : { jobs };
    }
    case 'job.segments': {
      const existing = state.liveSegments?.[event.jobId] ?? [];
      if (event.from > existing.length || event.segments.length === 0) return state;
      const segments = existing.slice();
      event.segments.forEach((segment, i) => (segments[event.from + i] = segment));
      return { ...state, liveSegments: { ...state.liveSegments, [event.jobId]: segments } };
    }
  }
}

/** Models: the capability view is replaced as a whole. A model bundle's new state replaces the old one by `bundleId` (appended if there is none). */
export function applyModelsEvent(state: ModelsSnapshot, event: ModelsEvent): ModelsSnapshot {
  switch (event.type) {
    case 'capabilities.updated':
      return { ...state, capabilities: event.capabilities };
    case 'bundle.updated': {
      const index = state.bundles.findIndex((b) => b.bundleId === event.bundle.bundleId);
      if (index < 0) return { ...state, bundles: [...state.bundles, event.bundle] };
      const bundles = state.bundles.slice();
      bundles[index] = event.bundle;
      return { ...state, bundles };
    }
  }
}

/** Preferences: changed keys are replaced with their new effective values. Defaults stay the same. */
export function applySettingsEvent(state: SettingsSnapshot, event: SettingsEvent): SettingsSnapshot {
  switch (event.type) {
    case 'settings.updated':
      return { ...state, settings: { ...state.settings, ...event.changed } };
  }
}

/** External services: a service's state is replaced by `serviceId`. Approvals are appended when they appear and removed when they end. */
export function applyServicesEvent(state: ServicesSnapshot, event: ServicesEvent): ServicesSnapshot {
  switch (event.type) {
    case 'service.updated':
      return { ...state, services: upsertBy(state.services, event.service, (s) => s.serviceId) };
    case 'approval.requested':
      return { ...state, approvals: upsertBy(state.approvals, event.approval, (a) => a.approvalId) };
    case 'approval.resolved':
      return { ...state, approvals: state.approvals.filter((a) => a.approvalId !== event.approvalId) };
  }
}

/**
 * Install commands for in-app agents: a new run goes at the front (consistent with the snapshot). Output lines are appended, keeping only the last `AGENT_SETUP_OUTPUT_LINES` lines.
 * Output for an unrecognized `runId` is dropped (its record will arrive with the next snapshot).
 */
export function applyAgentSetupEvent(state: AgentSetupSnapshot, event: AgentSetupEvent): AgentSetupSnapshot {
  switch (event.type) {
    case 'setup.updated': {
      const index = state.runs.findIndex((r) => r.runId === event.run.runId);
      if (index < 0) return { runs: [event.run, ...state.runs] };
      const runs = state.runs.slice();
      runs[index] = event.run;
      return { runs };
    }
    case 'setup.output': {
      const index = state.runs.findIndex((r) => r.runId === event.runId);
      if (index < 0) return state;
      const run = state.runs[index]!;
      const output = [...run.output, ...event.lines];
      const dropped = Math.max(0, output.length - AGENT_SETUP_OUTPUT_LINES);
      const runs = state.runs.slice();
      runs[index] = { ...run, output: dropped ? output.slice(dropped) : output, droppedLines: run.droppedLines + dropped };
      return { runs };
    }
  }
}

export function applySpaceEvent(state: SpaceSnapshot, event: SpaceEvent): SpaceSnapshot {
  switch (event.type) {
    case 'entry.upsert':
      return { ...state, entries: upsertBy(state.entries, event.entry, (e) => e.id) };
    case 'entry.removed':
      return { ...state, entries: state.entries.filter((e) => e.id !== event.entryId) };
    case 'catalog.replaced':
      return event.snapshot;
  }
}

/** Returns null when the session is deleted. */
export function applyConversationEvent(state: ConversationSnapshot, event: ConversationEvent): ConversationSnapshot | null {
  switch (event.type) {
    case 'item.upsert':
      return { ...state, items: upsertBy(state.items, event.item, (i) => i.id) };
    case 'item.append': {
      const index = state.items.findIndex((i) => i.id === event.itemId);
      if (index < 0) return state;
      const item = appendToItem(state.items[index]!, event.field, event.delta);
      if (!item) return state;
      const items = state.items.slice();
      items[index] = item;
      return { ...state, items };
    }
    case 'conversation.updated':
      return { ...state, conversation: event.conversation };
    case 'conversation.removed':
      return null;
  }
}

function appendToItem(item: TimelineItem, field: 'text' | 'output', delta: string): TimelineItem | null {
  if (field === 'text' && (item.kind === 'agent-message' || item.kind === 'reasoning')) {
    return { ...item, text: item.text + delta };
  }
  if (field === 'output' && item.kind === 'tool-call') {
    return { ...item, output: clampOutput(item.output + delta) };
  }
  return null;
}

function upsertBy<T>(list: readonly T[], value: T, key: (v: T) => string): T[] {
  const id = key(value);
  const index = list.findIndex((v) => key(v) === id);
  if (index < 0) return [...list, value];
  const next = list.slice();
  next[index] = value;
  return next;
}

/** Video topic: incremental updates use the shared projection reducer (the same one the Runtime mirror uses). Returns null when the video is closed. */
export function applyVideoTopicEvent(state: VideoTopicSnapshot, event: VideoTopicEvent): VideoTopicSnapshot | null {
  switch (event.type) {
    case 'video.event':
      return applyVideoEvent(state, event.event);
    case 'video.replaced':
      return event.snapshot;
    case 'video.closed':
      return null;
  }
}

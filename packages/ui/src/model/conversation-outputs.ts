import {
  type Conversation,
  type FileTarget,
  type Id,
  type JobRecord,
  type SpaceEntry,
  type SpaceEntryKind,
  type SpaceScanIssue,
  type TimelineItem,
} from '@cuccut/protocol';
import { videoTargetOf } from './space.ts';
import { changedFiles } from './thread.ts';
import { conversationJobVideos, isVideoAt, openingVideo, videoOutput } from './video-cards.ts';
import { isPreviewExport } from './export-job.ts';

/**
 * One item in the session header's “outputs” (product design §3.2, revised by the user): a video this session created, changed, or worked on, a finished slide deck, a design draft and a design system,
 * or a file in its working directory.
 */
export interface ConversationOutput {
  /** Videos use the video ID (editing one several times still counts as one item); other files use the Space entry ID. */
  id: string;
  kind: SpaceEntryKind;
  name: string;
  /** Location for opening the video in the editor; null when it is not a video. */
  video: FileTarget | null;
  /** The matching Space entry; null when the video has not been scanned yet. */
  entry: SpaceEntry | null;
  /** The video's duration after its most recent edit. */
  durationSeconds: number | null;
  /** Slide deck (docs/design/slides §7.3): the location to open it in the Slides tab of the ribbon, and its page count (null when unknown); absent when it is not a slide deck. */
  slides?: { target: FileTarget; slideCount: number | null };
  /** Design draft (docs/design/canvas §7.3): the location to open it in the Designs tab of the ribbon, and its artboard count (null when unknown); absent when it is not a design draft. */
  design?: { target: FileTarget; boardCount: number | null };
  /** Design system (docs/design/canvas §10.6): the location to open it in the Design Systems tab of the ribbon; absent when it is not a design system. */
  designSystem?: { target: FileTarget };
  at: string;
  /**
   * The task that produced it: for a video, the task of its most recent edit; for a file, the task of the file-change step that most recently changed it.
   * null when it cannot be determined (it is then listed only in the session header's “产物”, not attached under any reply).
   */
  taskId: Id | null;
}

const LIMIT = 30;

/** Whether this slide deck, design draft or design system entry in Space is at this location (source directory + relative path). */
function isDirAt(kind: 'slides' | 'design' | 'design-system', entry: SpaceEntry, target: FileTarget): boolean {
  if (entry.kind !== kind || !('path' in target) || entry.relPath !== target.path) return false;
  return 'projectId' in target ? entry.source.projectId === target.projectId : entry.source.conversationId === target.conversationId;
}

const baseName = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path;

/**
 * Files changed by file-change steps → the task that most recently changed each one. The path the Driver writes may be absolute or relative to the working directory;
 * both are recorded (an absolute path inside the working directory is also recorded as a relative path).
 */
function fileTasks(items: readonly TimelineItem[], cwd: string | undefined): Map<string, Id> {
  const byPath = new Map<string, Id>();
  const root = cwd ? cwd.replace(/\/+$/, '') + '/' : null;
  for (const item of items) {
    if (item.kind !== 'tool-call' || !item.taskId) continue;
    for (const { path } of changedFiles(item)) {
      const clean = path.replace(/^\.\//, '');
      byPath.set(clean, item.taskId);
      if (root && clean.startsWith(root)) byPath.set(clean.slice(root.length), item.taskId);
    }
  }
  return byPath;
}

/**
 * This session's outputs, most recent first: videos the agent created (`video-created`) or changed through the video engine (change card), videos the agent worked on
 * (transcription, export, a video newly imported from a link, and so on: the jobs this session submitted in `jobs`), the video brought in with the first message (`openingVideo`), slide decks, design drafts
 * and design systems the agent produced (`slides-created`, `design-created`, `design-system-created`),
 * plus files in the session's own working directory when it is not in a project.
 * Other files in a project session are not recorded as belonging to any session, so they are not listed; items in the trash are not listed. `cwd` is used to match files back to the task that changed them.
 * The session header lists only the latest 30 items; grouping by reply does not truncate (`limit: Infinity`).
 */
export function conversationOutputs(
  conversation: Pick<Conversation, 'id' | 'projectId'> & { cwd?: string },
  items: readonly TimelineItem[],
  entries: readonly SpaceEntry[],
  limit = LIMIT,
  jobs: readonly JobRecord[] = [],
): ConversationOutput[] {
  const videos = new Map<string, ConversationOutput>();
  for (const item of items) {
    if (item.kind !== 'video-change' && item.kind !== 'video-created') continue;
    const entry = entries.find((e) => isVideoAt(e, item.target)) ?? null;
    const before = videos.get(item.videoId);
    videos.set(item.videoId, {
      id: item.videoId,
      kind: 'video',
      name: entry?.name ?? item.videoName,
      video: item.target,
      entry,
      durationSeconds:
        item.kind === 'video-change' ? item.durationSeconds.after : (before?.durationSeconds ?? entry?.media?.durationSec ?? null),
      at: item.createdAt,
      taskId: item.taskId,
    });
  }
  for (const videoId of conversationJobVideos(jobs, conversation.id)) {
    if (!videos.has(videoId)) videos.set(videoId, videoOutput(videoId, items, entries, jobs));
  }
  // The video brought in with the first message: it has a card in the thread and is also listed in the session summary (the same card, product design §3.2.2).
  const opening = openingVideo(items);
  if (opening && !videos.has(opening.videoId)) videos.set(opening.videoId, videoOutput(opening.videoId, items, entries, jobs));
  // Slide decks the agent produced (`slides-created` receipt): one item per deck; the title, page count and task come from the latest version that passed validation, and the card under the reply moves with it.
  // When the deck has an entry in Space, that entry's id is used; it is not repeated when the working-directory files are listed below.
  const decks: ConversationOutput[] = [];
  for (const item of items) {
    if (item.kind !== 'slides-created') continue;
    const entry = entries.find((e) => isDirAt('slides', e, item.target)) ?? null;
    decks.push({
      id: entry?.id ?? item.id,
      kind: 'slides',
      name: item.title || entry?.name || baseName(item.target.path),
      video: null,
      entry,
      durationSeconds: null,
      slides: { target: item.target, slideCount: item.slideCount },
      at: item.createdAt,
      taskId: item.taskId,
    });
  }
  // Design drafts the agent produced (`design-created` receipt): same as slide decks.
  for (const item of items) {
    if (item.kind !== 'design-created') continue;
    const entry = entries.find((e) => isDirAt('design', e, item.target)) ?? null;
    decks.push({
      id: entry?.id ?? item.id,
      kind: 'design',
      name: item.title || entry?.name || baseName(item.target.path),
      video: null,
      entry,
      durationSeconds: null,
      design: { target: item.target, boardCount: item.boardCount },
      at: item.createdAt,
      taskId: item.taskId,
    });
  }
  // Design systems the agent produced (`design-system-created` receipt): same as slide decks, but without a count.
  for (const item of items) {
    if (item.kind !== 'design-system-created') continue;
    const entry = entries.find((e) => isDirAt('design-system', e, item.target)) ?? null;
    decks.push({
      id: entry?.id ?? item.id,
      kind: 'design-system',
      name: item.title || entry?.name || baseName(item.target.path),
      video: null,
      entry,
      durationSeconds: null,
      designSystem: { target: item.target },
      at: item.createdAt,
      taskId: item.taskId,
    });
  }
  const outputs = [...videos.values(), ...decks].filter((output) => !output.entry?.user.trashedAt);
  if (!conversation.projectId) {
    const normalize = (path: string) => path.replace(/\\/g, '/');
    const exports = jobs.filter((j) => j.kind === 'export');
    const previewByJob = new Map(exports.map((j) => [j.jobId, isPreviewExport(j)]));
    const previewPaths = new Set<string>();
    // When the same path is later replaced by a formal export, the purpose of the most recent publish wins, so an old preview does not hide the new deliverable.
    const published = [...exports].sort(
      (a, b) => (a.endedAt ?? a.createdAt).localeCompare(b.endedAt ?? b.createdAt) || a.jobId.localeCompare(b.jobId),
    );
    for (const job of published) {
      for (const output of job.result?.outputs ?? []) {
        if (!output.path) continue;
        const path = normalize(output.path);
        if (isPreviewExport(job)) previewPaths.add(path);
        else previewPaths.delete(path);
      }
    }
    const root = conversation.cwd ? normalize(conversation.cwd).replace(/\/+$/, '') + '/' : null;
    const listed = new Set(outputs.map((output) => output.entry?.id));
    const tasks = fileTasks(items, conversation.cwd);
    for (const entry of entries) {
      if (entry.source.conversationId !== conversation.id || entry.user.trashedAt || listed.has(entry.id)) continue;
      const originPreview = entry.origin?.jobId ? previewByJob.get(entry.origin.jobId) : undefined;
      const pathPreview = !!(
        (entry.file && previewPaths.has(normalize(entry.file.path))) || (root && previewPaths.has(root + entry.relPath))
      );
      if (originPreview ?? pathPreview) continue;
      outputs.push({
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        video: entry.kind === 'video' ? videoTargetOf(entry) : null,
        entry,
        durationSeconds: null,
        ...(entry.kind === 'slides' ? { slides: { target: videoTargetOf(entry), slideCount: entry.deck?.slideCount ?? null } } : {}),
        ...(entry.kind === 'design' ? { design: { target: videoTargetOf(entry), boardCount: entry.canvas?.boardCount ?? null } } : {}),
        ...(entry.kind === 'design-system' ? { designSystem: { target: videoTargetOf(entry) } } : {}),
        at: entry.lastActivityAt,
        taskId: tasks.get(entry.relPath) ?? null,
      });
    }
  }
  return outputs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/**
 * Outputs under each reply (prototype `SessionMessageArtifacts` in home-session.jsx): each is attached to the last visible reply of its task,
 * and within one reply they are ordered by when they first appeared. Outputs of a task with no reply (for example one that failed before it said anything) are listed only in the session header's “产物”.
 */
export function outputsByMessage(items: readonly TimelineItem[], outputs: readonly ConversationOutput[]): Map<Id, ConversationOutput[]> {
  const lastReply = new Map<Id, Id>();
  for (const item of items) {
    if (item.kind === 'agent-message' && item.taskId && (item.text.trim() || item.streaming)) lastReply.set(item.taskId, item.id);
  }
  const byMessage = new Map<Id, ConversationOutput[]>();
  for (const output of [...outputs].sort((a, b) => a.at.localeCompare(b.at))) {
    const messageId = output.taskId ? lastReply.get(output.taskId) : undefined;
    if (!messageId) continue;
    const list = byMessage.get(messageId);
    if (list) list.push(output);
    else byMessage.set(messageId, [output]);
  }
  return byMessage;
}

/**
 * Whether the video's source directory still exists (prototype `SessionMoviePreview`'s “source file not found”). A video counts as not found only when Space has finished scanning, the scan of this source was not truncated or unreadable,
 * and there is no entry for this video; no conclusion is drawn while scanning is still running or incomplete. A false report happens when the directory is nested deeper than the scan depth (6 levels).
 */
export function outputSourceMissing(
  output: ConversationOutput,
  space: { ready: boolean; scanning: boolean; issues: readonly SpaceScanIssue[] },
): boolean {
  const target = output.video;
  if (!target || output.entry || !space.ready || space.scanning) return false;
  const sourceKey =
    'projectId' in target ? `project:${target.projectId}` : 'conversationId' in target ? `conv:${target.conversationId}` : null;
  if (!sourceKey) return false;
  return !space.issues.some((issue) => issue.sourceKey === sourceKey);
}

/**
 * The frame used for a video card's 16:9 preview (the rule lives in `@cuccut/protocol`, and it is the same frame as the Space thumbnail `space.thumbnail`).
 * While the editor has the video open, the cover of the current snapshot is taken with `media.thumbnail`; other videos take their cover from the Space thumbnail, without opening the video.
 */
export { posterFrame } from '@cuccut/protocol';

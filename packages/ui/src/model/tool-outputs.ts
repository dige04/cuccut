import { defineMessages, intlLocale, type Id, type SpaceEntry, type SpaceEntryKind } from '@cuccut/protocol';
import { formatBytes, KIND_LABEL, measureText } from './space.ts';
import { entryJobId } from './space-actions.ts';
import { spaceKindsOf, toolById, type ToolId } from './tool-catalog.ts';
import { saveDirLabel } from './tool-frame.ts';
import { zhHans } from './tool-outputs.zh-Hans.ts';
import { zhHant } from './tool-outputs.zh-Hant.ts';
import { ja } from './tool-outputs.ja.ts';
import { ko } from './tool-outputs.ko.ts';
import { es } from './tool-outputs.es.ts';
import { fr } from './tool-outputs.fr.ts';
import { de } from './tool-outputs.de.ts';
import { nl } from './tool-outputs.nl.ts';
import { ptBR } from './tool-outputs.pt-BR.ts';
import { it } from './tool-outputs.it.ts';
import { ru } from './tool-outputs.ru.ts';
import { pl } from './tool-outputs.pl.ts';
import { tr } from './tool-outputs.tr.ts';
import { vi } from './tool-outputs.vi.ts';

/** Copy for output rows (translations are in `tool-outputs.<lang>.ts`). */
const en = {
  actionLabel: { 'open-movie': 'Open in editor', 'new-movie': 'New video from this' },
  blockTextOnly: 'Transcripts and subtitles need a video or audio file to make a new video; that isn’t possible from here yet',
  blockTrashed: 'Restore this item from the Trash first',
  blockGenerating: 'Still generating; available when it’s done',
  blockMissing: 'Can’t find this result’s file on this computer',
  /** The sentence pre-filled by “Hand to Agent”: the user edits it, then sends it. */
  handover: {
    subtitle: 'Translate these subtitles into another language, keeping the timecodes unchanged.',
    document: 'Write a summary of this transcript.',
    audio: 'Make a video with this audio.',
    image: 'Make a video with this image as the cover.',
    'video-file': 'Add subtitles to this video.',
    export: 'Add subtitles to this video.',
    video: 'Keep editing this video.',
  } as Partial<Record<SpaceEntryKind, string>>,
  handoverDefault: 'Keep working on this result.',
};
export type ToolOutputsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * Output rows for tool results (product design §2.7 “results and next steps”; design file tool-frame.jsx `ToolOutputRow`, model-tool-runs.js `followUps`, model-tool-handover.js): the items one run published into Space, what each item can do next, and the sentence pre-filled by “Hand to Agent”.
 * Shared by the result page, the task details, and the generation records.
 */

/**
 * The outputs of one run. `origin.jobId` is one of these tasks’ Space items (the result of a direct task, or the file published by a file-to-file flow).
 * Placeholders in the trash, placeholders that are still generating or failed (`ref.jobId`), and new videos (handled by “Open editor”) are not listed. Sorted by name.
 */
export function entriesOfJob(entries: readonly SpaceEntry[], jobIds: readonly Id[]): SpaceEntry[] {
  const ids = new Set(jobIds);
  return entries
    .filter((e) => {
      const jobId = entryJobId(e);
      if (!jobId || !ids.has(jobId) || e.user.trashedAt || e.kind === 'video') return false;
      return !(e.ref && 'jobId' in e.ref);
    })
    .sort((a, b) => a.name.localeCompare(b.name, intlLocale(), { numeric: true }));
}

/** The directory the outputs are in: given when they are all in the same directory (the result page header says “Saved in …”); otherwise null. */
export function outputsDir(entries: readonly Pick<SpaceEntry, 'file'>[]): string | null {
  const dirs = new Set(entries.map((e) => (e.file?.path ? dirOf(e.file.path) : null)));
  if (dirs.size !== 1) return null;
  return [...dirs][0] ?? null;
}

function dirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '');
}

/** The second line of an output row: kind · size · duration or frame size · directory. */
export function outputDetail(entry: SpaceEntry): string {
  const path = entry.file?.path ?? null;
  const dir = path ? dirOf(path) : null;
  return [KIND_LABEL[entry.kind], entry.size > 0 ? formatBytes(entry.size) : null, measureText(entry), dir ? saveDirLabel(dir) : null]
    .filter(Boolean)
    .join(' · ');
}

export type FollowId = 'open-movie' | 'new-movie' | ToolId;

export interface FollowUp {
  id: FollowId;
  label: string;
  kind: 'tool' | 'action';
}

const FOLLOW: Partial<Record<SpaceEntryKind, readonly FollowId[]>> = {
  document: ['translate-subtitles', 'synthesize-speech', 'new-movie'],
  subtitle: ['translate-subtitles', 'synthesize-speech', 'new-movie'],
  audio: ['new-movie'],
  image: ['new-movie'],
  'video-file': ['new-movie'],
  export: ['new-movie'],
};

/**
 * What follows writing into a video: transcription is followed by translate captions and translate dubbing; translate captions is followed by translate dubbing; a video that was only downloaded (not transcribed) is followed by transcription. A video transcribed during download counts as transcribed.
 */
const FOLLOW_MOVIE: Partial<Record<ToolId, readonly FollowId[]>> = {
  transcribe: ['translate-subtitles', 'dub'],
  'translate-subtitles': ['dub'],
  'link-import': ['transcribe'],
};

/**
 * What an output can do next. Tool items are listed only when that tool accepts this kind of item (consistent with the tool catalog’s Space input). “View in Space”, “Show in folder”, and “Hand to Agent” are on every row and are not defined here. A result written into a video (video item) offers “Open editor” first, then continues with the tool that produced it.
 */
export function followUps(entry: Pick<SpaceEntry, 'kind'>, fromTool?: ToolId | null): FollowUp[] {
  const ids = entry.kind === 'video' ? ['open-movie' as const, ...((fromTool && FOLLOW_MOVIE[fromTool]) || [])] : (FOLLOW[entry.kind] ?? []);
  return ids.flatMap((id): FollowUp[] => {
    if (id === 'open-movie' || id === 'new-movie') return [{ id, label: M.actionLabel[id], kind: 'action' }];
    const tool = toolById(id);
    return tool && spaceKindsOf(id).includes(entry.kind) ? [{ id, label: tool.name, kind: 'tool' }] : [];
  });
}

/**
 * Why “Create new video from this” cannot be done; null when it can. Audio, images, and video files become material of the new video directly (the material stays where it is; only a link is made). Scripts and captions need a video or audio to pair with first, and the Runtime has no method yet to create them this way.
 */
export function newMovieBlock(entry: Pick<SpaceEntry, 'kind' | 'status' | 'user'>, path: string | null): string | null {
  if (entry.kind === 'document' || entry.kind === 'subtitle') return M.blockTextOnly;
  if (entry.user.trashedAt) return M.blockTrashed;
  if (entry.status === 'generating') return M.blockGenerating;
  if (entry.status === 'missing' || entry.status === 'failed' || !path) return M.blockMissing;
  return null;
}

/** The sentence pre-filled by “Hand to Agent”: a default intent based on the result kind. The user rewrites it and sends it; it is not sent automatically. The sentence does not include a path, since the reference carries the location. */
export function handoverText(entry: Pick<SpaceEntry, 'kind'>): string {
  return M.handover[entry.kind] ?? M.handoverDefault;
}

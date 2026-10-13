import { defineMessages, type JobKind, type JobRecord, type SpaceEntry } from '@cuccut/protocol';
import { isVideoTool, spaceKindsOf, TOOLS, toolById, type ToolId, type ToolInfo } from './tool-catalog.ts';
import { saveDirLabel } from './tool-frame.ts';
import { zhHans } from './tool-rerun.zh-Hans.ts';
import { zhHant } from './tool-rerun.zh-Hant.ts';
import { ja } from './tool-rerun.ja.ts';
import { ko } from './tool-rerun.ko.ts';
import { es } from './tool-rerun.es.ts';
import { fr } from './tool-rerun.fr.ts';
import { de } from './tool-rerun.de.ts';
import { nl } from './tool-rerun.nl.ts';
import { ptBR } from './tool-rerun.pt-BR.ts';
import { it } from './tool-rerun.it.ts';
import { ru } from './tool-rerun.ru.ts';
import { pl } from './tool-rerun.pl.ts';
import { tr } from './tool-rerun.tr.ts';
import { vi } from './tool-rerun.vi.ts';
import { toolOfJob } from './tool-runs.ts';

const en = { runAgain: 'Run again', retry: 'Try again' };
export type ToolRerunMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/*
 * Back-and-forth between tools, Space items, and background tasks (product design §2.7 “pages” and “progress and failures”, §4.5; design file model-space-tools.js, model-task-outputs.js): which tools can process an item, which tool a task that a tool created belongs to, how “Run again / Retry” goes back, and where an item is located.
 */

/** Direct tasks from the tool page: task kind → tool. */
const DIRECT: Partial<Record<JobKind, ToolId>> = {
  synthesizeSpeech: 'synthesize-speech',
  generateImage: 'generate-image',
  generateMusic: 'generate-music',
  generateText: 'generate-text',
};

/**
 * Which tool a task started from the tool page belongs to; null for tasks not started from the tool page. Tasks started by the Agent (“Run again” belongs to the session), direct tasks started from an editor panel (with a video, e.g. generating speech in the dubbing panel), and steps inside a fixed flow do not go back to the tool page.
 */
export function toolOfTask(job: Pick<JobRecord, 'kind' | 'pipeline' | 'submitter' | 'videoId'>): ToolId | null {
  if (job.submitter.kind !== 'connection') return null;
  if (job.kind === 'pipeline') return toolOfJob(job);
  if (job.videoId !== null) return null;
  return DIRECT[job.kind] ?? null;
}

const PIPELINE_TOOLS: readonly string[] = ['transcribe', 'translate-subtitles', 'dub', 'link-import'];

/**
 * When only the item’s source is known (`origin.capability`; the task has already been pruned), infer the tool: direct tasks by task kind, fixed flows by flow name. File transcoding cannot tell which tool it came from (that depends on the parameters), so exports and things made by the Agent are excluded.
 */
export function toolOfOrigin(origin: Pick<NonNullable<SpaceEntry['origin']>, 'capability' | 'conversationId'> | undefined): ToolId | null {
  const capability = origin?.capability;
  if (!capability || origin.conversationId) return null;
  return DIRECT[capability as JobKind] ?? (PIPELINE_TOOLS.includes(capability) ? (capability as ToolId) : null);
}

export interface Rerun {
  tool: ToolId;
  label: string;
  /**
   * `refill`: go back to the tool page with its parameters already filled in (direct tasks and file transcoding; the form is filled with this run’s parameters; whether to change them is up to the user).
   * `view`: a video tool opens this run (steps, retry from that step, and “Run again” back to the form are all on the run page).
   */
  mode: 'refill' | 'view';
}

/** “Retry / Run again” for a task. Not given for tasks still running, queued, or awaiting reconciliation, or for tasks not started from the tool page. */
export function rerunOf(job: Pick<JobRecord, 'kind' | 'pipeline' | 'submitter' | 'videoId' | 'state'>): Rerun | null {
  const tool = toolOfTask(job);
  if (!tool || !toolById(tool)) return null;
  if (job.state === 'queued' || job.state === 'running' || job.state === 'needs-reconciliation') return null;
  if (isVideoTool(tool)) return { tool, label: M.runAgain, mode: 'view' };
  const failed = job.state === 'failed' || job.state === 'interrupted';
  return { tool, label: failed ? M.retry : M.runAgain, mode: 'refill' };
}

/**
 * Which tools are listed under “Process with tool…”: the tools that accept this kind of item (consistent with the Space input on the tool page). Trashed items, placeholders that are generating or failed, and items whose file cannot be found are not listed.
 */
export function toolsForEntry(entry: Pick<SpaceEntry, 'kind' | 'status' | 'user'>): ToolInfo[] {
  if (entry.user.trashedAt || entry.status === 'generating' || entry.status === 'failed' || entry.status === 'missing') return [];
  return TOOLS.filter((t) => !t.planned && spaceKindsOf(t.id).includes(entry.kind));
}

function fold(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

/** The directory the item is in, and whether it is the default save location. null when the file’s location is unknown or it is a video item. */
export function entryLocation(
  entry: Pick<SpaceEntry, 'kind' | 'file'>,
  saveDirectory: string | null,
): { label: string; isSaveDir: boolean } | null {
  const path = entry.file?.path;
  if (!path || entry.kind === 'video') return null;
  const dir = path.replace(/[\\/][^\\/]*$/, '');
  if (!dir) return null;
  return { label: saveDirLabel(dir), isSaveDir: !!saveDirectory && fold(saveDirectory) === fold(dir) };
}

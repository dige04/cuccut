import { live, type Id, type JobRecord, type ModelBundleStatus, type ModelsDirInfo, type ModelsDirInspection, type ModelsDirMode } from '@cuccut/protocol';
import { shortenPath } from './format.ts';
import { fmtSize } from './task-facts.ts';
import { M, type ModelsDirMessages } from './models-dir-copy.ts';

/**
 * Settings › Local models › Model directory (architecture design §6.3; design model-models-dir.js, settings-models-dir.jsx).
 * Holds only the decisions and text: middle-ellipsis for long paths, card subtitle, which tasks temporarily make a change unavailable, the branches of the change confirmation dialog, and move progress.
 * All numbers come from the Runtime (`models.getDir`, `models.inspectDir`); this file does not touch the file system.
 */

export const MODELS_DIR_COPY: ModelsDirMessages['dir'] = live(() => M.dir);

/**
 * Middle-ellipsis for long paths: the home directory is shortened to ~, keeping at most two segments at the start and at most two at the end, and reducing further if it still does not fit; the last segment is never dropped.
 * The separator follows the path: paths that use only `\` (Windows) are rejoined with `\`, and the drive letter (`D:`) and `~` count as one leading segment.
 */
export function shortenDir(full: string, max = 44): string {
  const path = shortenPath(full);
  if (path.length <= max) return path;
  const sep = path.includes('\\') && !path.includes('/') ? '\\' : '/';
  // A leading separator is kept as is: `/` is the root, `\\` is a network path.
  const lead = /^[\\/]*/.exec(path)![0];
  const segs = path.split(/[\\/]/).filter((s) => s !== '');
  for (let head = Math.min(2, segs.length - 1); head >= 0; head -= 1) {
    for (let tail = Math.min(2, segs.length - head); tail >= 1; tail -= 1) {
      if (head + tail >= segs.length) continue;
      const s = `${lead}${segs.slice(0, head).join(sep)}${head ? sep : ''}…${sep}${segs.slice(segs.length - tail).join(sep)}`;
      if (s.length <= max) return s;
    }
  }
  const last = segs[segs.length - 1] ?? '';
  return `…${sep}${last.length > max - 2 ? `${last.slice(0, max - 3)}…` : last}`;
}

/** Card subtitle: used · free space on the disk · N models recognized (free space is omitted when it cannot be determined). */
export function dirStats(info: ModelsDirInfo): string {
  return M.stats(fmtSize(info.usedBytes), info.freeBytes !== null ? fmtSize(info.freeBytes) : null, info.modelCount);
}

/** Problems with the directory itself (external drive not connected, not writable); null when there are none. */
export function dirHealth(info: ModelsDirInfo): string | null {
  if (!info.exists) return MODELS_DIR_COPY.missingDir;
  if (!info.writable) return MODELS_DIR_COPY.notWritableDir;
  return null;
}

const LIVE: readonly JobRecord['state'][] = ['queued', 'running'];
const DIR_KINDS: readonly JobRecord['kind'][] = ['modelInstall', 'modelTest'];

export interface DirBlocker {
  text: string;
  /** Ordinary tasks using local models (excluding downloads and checks). */
  jobIds: Id[];
  /** When there are ordinary tasks, shows “查看任务” (view tasks). */
  hasTasks: boolean;
}

/**
 * Whether a change is possible right now: queued or running downloads and checks, as well as tasks that carry a model package (transcription, synthesis…), will all cause the Runtime to reject it.
 * The move itself is shown by the progress bar and is not counted here. null when there is none.
 */
export function dirBlocker(jobs: readonly JobRecord[], bundles: readonly ModelBundleStatus[]): DirBlocker | null {
  const name = (bundleId: string | null | undefined) => bundles.find((b) => b.bundleId === bundleId)?.label ?? bundleId ?? '';
  const live = jobs.filter((j) => LIVE.includes(j.state) && j.kind !== 'modelsMove');
  const downloading = live.filter((j) => j.kind === 'modelInstall').map((j) => name(j.bundleId));
  const testing = live.filter((j) => j.kind === 'modelTest').map((j) => name(j.bundleId));
  const tasks = live.filter((j) => !DIR_KINDS.includes(j.kind) && j.bundleId);
  if (!downloading.length && !testing.length && !tasks.length) return null;
  return {
    text: M.blocker(unique(downloading), unique(testing), tasks.length),
    jobIds: tasks.map((j) => j.jobId),
    hasTasks: tasks.length > 0,
  };
}

const unique = (list: string[]) => [...new Set(list)];

export type ChangePlan =
  /** The selected folder cannot be used. */
  | { kind: 'error'; title: string; text: string }
  /** Already the current directory. */
  | { kind: 'same' }
  /** No models in the current directory: only states what is in the new location, then switches directly. */
  | { kind: 'direct'; found: string }
  /** Models exist in the current directory: move them over, or only switch the location. */
  | { kind: 'choose'; found: string; move: { disabled: boolean; description: string }; switchDescription: string };

/** Branches of the change confirmation dialog (`models.inspectDir` result → a few sentences). */
export function changePlan(inspection: ModelsDirInspection): ChangePlan {
  switch (inspection.problem) {
    case 'same':
      return { kind: 'same' };
    case 'missing':
      return { kind: 'error', title: M.missingTitle, text: M.missingText };
    case 'not-writable':
      return { kind: 'error', title: M.notWritableTitle, text: M.notWritableText };
    case 'nested':
      return { kind: 'error', title: M.nestedTitle, text: M.nestedText };
    default:
      break;
  }
  const count = inspection.found.bundleIds.length;
  const found = M.found(count, fmtSize(inspection.found.bytes), inspection.freeBytes !== null ? fmtSize(inspection.freeBytes) : null);
  if (inspection.current.bytes <= 0) return { kind: 'direct', found };
  const { requiredBytes, sameVolume, fits } = inspection.move;
  const short = inspection.freeBytes !== null ? Math.max(0, requiredBytes - inspection.freeBytes) : 0;
  const description = !fits
    ? M.moveNoFit(fmtSize(requiredBytes), fmtSize(inspection.freeBytes ?? 0), fmtSize(short))
    : sameVolume
      ? M.moveSameVolume(fmtSize(inspection.current.bytes))
      : M.moveOther(fmtSize(requiredBytes || inspection.current.bytes));
  return {
    kind: 'choose',
    found,
    move: { disabled: !fits, description },
    switchDescription: M.switchDescription(count),
  };
}

/** The option selected in the confirmation dialog: when it does not fit, “移过去” (move over) cannot be chosen and falls back to “只切换位置” (switch location only); when no choice is needed it is switch. */
export function pickedMode(plan: ChangePlan, chosen: ModelsDirMode): ModelsDirMode {
  if (plan.kind !== 'choose') return 'switch';
  return plan.move.disabled ? 'switch' : chosen;
}

/** Hint shown after a change. */
export function appliedText(mode: ModelsDirMode, path: string, hadModels: boolean, moving: boolean): string {
  const where = shortenDir(path, 40);
  if (moving) return M.appliedMoving(where);
  if (mode === 'switch' && hadModels) return M.appliedKept(where);
  return M.applied(where);
}

export interface MoveProgressView {
  /** 0–100; null when the total is not yet known (the progress bar is indeterminate). */
  percent: number | null;
  label: string;
}

/** Progress of the move task (`modelsMove`, `progress.unit: 'bytes'`). */
export function moveProgressView(job: JobRecord | undefined, to: string | null): MoveProgressView {
  const where = to ? shortenDir(to, 36) : null;
  const progress = job?.progress;
  const total = progress?.total ?? null;
  const done = progress?.done ?? 0;
  const percent = total !== null && total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : null;
  const amount = total ? `${fmtSize(done)} / ${fmtSize(total)}` : null;
  if (!job || job.state === 'queued') return { percent: null, label: M.moveWaiting(where) };
  if (job.phase === 'validating') return { percent, label: M.moveValidating(amount) };
  if (job.phase === 'publishing') return { percent: null, label: M.movePublishing };
  return { percent, label: M.moving(amount, where) };
}

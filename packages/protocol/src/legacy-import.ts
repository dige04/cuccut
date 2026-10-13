/**
 * Import prompt for legacy projects (architecture design §2.7). Settings, service configuration, cloud credentials and remote nodes are still migrated automatically at startup, as before. Projects wait for the user's answer: when the Runtime finds legacy (v1 / v2) projects that are not yet imported and no decision has been recorded, it raises a prompt on the `legacy-import` topic, and the desktop UI asks once.
 *
 * - Answering `import` with a directory: this directory becomes the imported project, and each legacy project is one video inside it. Once recorded, it is not asked again.
 * - Answering `never` (“跳过” (Skip) with “不再提醒” (Don't remind me again) ticked): recorded. Nothing is imported later and no more prompts appear.
 * - “跳过” (Skip) sends no request: the prompt stays in the Runtime, the UI does not show it again this time, and it is asked again at the next startup.
 *
 * Importing after an `import` answer is one run (`LegacyImportRun`). For the same topic, it reports the step each project has reached and the reason an import failed. A project that was not imported can be retried (`legacyImport.retry`) or skipped (`legacyImport.setSkipped`, which records the skip so it is not imported automatically again, and which can be undone). Projects that were neither imported nor skipped are retried automatically at the next startup.
 *
 * For the desktop UI (and the CLI) only: `legacyImport.*` and this topic are not on the web service's allowlist.
 */

/** A discovered legacy project that has not been imported yet. */
export interface LegacyProjectSummary {
  /** Legacy project directory (real path). */
  path: string;
  /** Legacy title; the directory name when there is none. */
  title: string;
  /** Last edited: modification time of the legacy project file (ISO 8601); null if it cannot be read. */
  editedAt: string | null;
}

export interface LegacyImportPrompt {
  /** Identifier of this prompt, sent back when answering. Answers to prompts that were already answered or have expired are rejected with `not-found`. */
  promptId: string;
  /** Most recently edited first. */
  projects: LegacyProjectSummary[];
  /** Default import directory (absolute path): the `CucCut` folder inside the system's “文稿 / 文档” (Documents) folder. */
  defaultDirectory: string;
}

/** Why a project was not imported. `missing` lists only the first few missing files; `missingCount` is the total. */
export type LegacyImportProblem =
  /** The missing files are on an external disk or network volume that is not connected now (`volume.root` does not exist). Reconnect it and retry. */
  | { kind: 'offline'; volume: { root: string; name: string }; missing: string[]; missingCount: number }
  /** The missing files were moved, renamed or deleted. Put them back and retry. */
  | { kind: 'missing'; missing: string[]; missingCount: number }
  /** The legacy project file cannot be read (corrupted, incomplete, or a version this platform does not support). Retrying will most likely still fail. */
  | { kind: 'unreadable' }
  /** An error during import (import engine not found, writing the new project failed, etc.). `report` is the path of the import report (`import-report.json`); null when there is none. */
  | { kind: 'failed'; report: string | null };

/**
 * A project's state in this import run: `queued` waiting, `importing` being imported, `imported` done, `not-imported` not imported (see `problem`), and `skipped` skipped by the user (not imported automatically again).
 */
export type LegacyImportItemState = 'queued' | 'importing' | 'imported' | 'not-imported' | 'skipped';

export interface LegacyImportItem extends LegacyProjectSummary {
  state: LegacyImportItemState;
  /** The reason for `not-imported`. A skipped project keeps the reason it had before it was skipped (none for projects skipped in earlier startups). Otherwise null. */
  problem: LegacyImportProblem | null;
}

/**
 * Project imports in this startup. It appears after an `import` answer (or, when there were unimported projects last time, when they are retried automatically at this startup), and stays until the Runtime stops.
 * It lists only projects that were not yet imported when this startup began. Projects whose import finished earlier are not listed.
 */
export interface LegacyImportRun {
  /** Identifier of this run. It changes after the Runtime restarts. */
  runId: string;
  /** Import directory (where imported projects go; absolute path). */
  directory: string;
  /** `importing`: importing now. `waiting`: other tasks are running, so the import pauses and resumes automatically when they finish. `finished`: every item has a result. */
  state: 'importing' | 'waiting' | 'finished';
  /** Time of the most recent start (first run or retry), ISO 8601. */
  startedAt: string;
  /** Time the most recent run finished; null while it is running. */
  finishedAt: string | null;
  /** Most recently edited first. */
  items: LegacyImportItem[];
}

/**
 * Snapshot of the `legacy-import` topic: the prompt waiting for the user's answer. It is null when there is none (nothing was found, a decision was already made, or discovery is still running).
 * `run` is this startup's import. It is null when there is nothing to import.
 */
export interface LegacyImportSnapshot {
  prompt: LegacyImportPrompt | null;
  run: LegacyImportRun | null;
}

/** When a prompt appears or disappears (answered, or the Runtime stops waiting), or an import makes progress: each carries the full new state, and the client replaces that item as a whole. */
export type LegacyImportEvent =
  | { type: 'prompt.updated'; prompt: LegacyImportPrompt | null }
  | { type: 'run.updated'; run: LegacyImportRun | null };

/** `import`: import into `directory` (absolute path, created if it does not exist). `never`: no more reminders and no more imports. */
export type LegacyImportAnswer =
  | { promptId: string; decision: 'import'; directory: string }
  | { promptId: string; decision: 'never' };

/** Retry the projects that were not imported (`paths` defaults to all of them). Named skipped items are also imported again, and their skip record is cleared. `queued` is the number re-queued. */
export interface LegacyImportRetry {
  paths?: string[];
}

/** Skip the projects that were not imported (they are not imported automatically again), or undo a skip (`skipped: false` restores the reason from before the skip; projects with no recorded reason are imported again). */
export interface LegacyImportSetSkipped {
  paths: string[];
  skipped: boolean;
}

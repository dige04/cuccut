import { localizeText, modelCheckCode, modelCheckRepair, type JobRecord, type ModelBundleStatus, type ModelCheckCode } from '@cuccut/protocol';
import { agoLabel } from './format.ts';
import {
  CHECK_DETAIL,
  CHECK_HEAD,
  CHECK_LABEL,
  CHECK_NOT_STARTED,
  CHECK_NOT_STARTED_UNKNOWN,
  CHECK_PHASE,
  CHECK_SENTENCES,
  CHECK_UNKNOWN,
  TRY_FAILURE,
  TRY_NOTICE,
  TRY_SUBJECT,
  sentence,
  type CheckSubject,
  type TrySubject,
} from './model-check-copy.ts';
import { installProgressView } from './models-install.ts';
import { isBundleInstalled } from './models-local.ts';

/**
 * Local model “检查” (check) (design model-local-check.js; architecture design §6.3): whether a model can be used normally is stated only in one status on its row.
 * All status comes from the Runtime: `modelTest` / `modelInstall` tasks (`jobs` topic) and the `selfTest` recorded on the model package (`models` topic);
 * locally, only two things the Runtime does not know are recorded: a rejected submission (the check could not start) and the repair task this row started (which must trigger an automatic re-check when it finishes).
 */

export type CheckProblemKind = 'failed' | 'not-started';

export interface CheckProblem {
  kind: CheckProblemKind;
  /** Recognized check code; null when unrecognized (the wording falls back to the generic sentence). */
  code: ModelCheckCode | null;
  /** Code shown in the technical details: the check code, or when there is none, the raw error code of the task or rejection. */
  rawCode: string | null;
  text: string;
  todo: string;
  repair: 'yes' | 'maybe' | 'no';
  /** The Runtime's own message (technical details). */
  message: string | null;
  /** `key: value` lines given by the Runtime (technical details). */
  facts: string[];
}

export type CheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; jobId: string; label: string; percent: number | null }
  | { phase: 'repairing'; jobId: string; percent: number | null }
  | { phase: 'passed'; at: string }
  | { phase: 'failed'; at: string; problem: CheckProblem };

/** Submission rejected: the check could not start (except `APP_FILE_MISSING`, which means the check failed). */
export interface CheckRejection {
  at: string;
  code: string | null;
  message: string;
  details?: unknown;
}

export interface CheckInputs {
  bundle: ModelBundleStatus;
  jobs: readonly JobRecord[];
  subject: CheckSubject;
  rejection?: CheckRejection | null;
  /** The repair task started from this row (`modelInstall` of `models.repair`). */
  repairJobId?: string | null;
}

const LIVE: readonly JobRecord['state'][] = ['queued', 'running'];
/** Cancelled or interrupted checks leave no conclusion: the status returns to what it was before this check. */
const DROPPED: readonly JobRecord['state'][] = ['cancelled', 'interrupted'];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Check failed: code → wording and repair rules. */
export function failedProblem(
  input: { code: unknown; rawCode?: string | null; message?: string | null; facts?: readonly string[] },
  subject: CheckSubject,
): CheckProblem {
  const code = modelCheckCode(input.code);
  const sentence = code ? CHECK_SENTENCES[code](subject) : CHECK_UNKNOWN;
  return {
    kind: 'failed',
    code,
    rawCode: code ?? input.rawCode ?? null,
    ...sentence,
    repair: modelCheckRepair(code),
    message: input.message ?? null,
    facts: [...(input.facts ?? [])],
  };
}

/**
 * Submission rejected → status line. A missing file shipped with the app means the check failed (reinstall CucCut); anything else means the check could not start.
 * Cannot reach the Runtime (the client's `internal`, with no `details.code`) reports that the background service did not respond.
 */
export function rejectionProblem(rejection: CheckRejection, subject: CheckSubject): CheckProblem {
  if (rejection.code === 'APP_FILE_MISSING') {
    return failedProblem({ code: 'APP_FILE_MISSING', message: rejection.message, facts: rejectionFacts(rejection.details) }, subject);
  }
  const sentence = (rejection.code && CHECK_NOT_STARTED[rejection.code]) || CHECK_NOT_STARTED_UNKNOWN;
  return {
    kind: 'not-started',
    code: null,
    rawCode: rejection.code,
    ...sentence,
    repair: 'no',
    message: rejection.message,
    facts: rejectionFacts(rejection.details),
  };
}

/** The part of a rejection's `details` shown to people: only short strings and numbers, no local paths. */
function rejectionFacts(details: unknown): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(asRecord(details))) {
    if (key === 'code' || key === 'file') continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value);
    if (/^([A-Za-z]:\\|\/)/.test(text) || text.length > 200) continue;
    lines.push(`${key}: ${text}`);
  }
  return lines;
}

/** One failed RPC → rejection record: the error code is in `details.code`; when the Runtime cannot be reached it is recorded as `RUNTIME_UNREACHABLE`. */
export function rejectionOf(error: unknown, at = new Date().toISOString()): CheckRejection {
  const message = error instanceof Error ? error.message : String(error);
  const rpc = error as { code?: unknown; details?: unknown } | null;
  const details = rpc?.details;
  const code = asRecord(details).code;
  if (typeof code === 'string') return { at, code, message, details };
  const unreachable = !rpc || typeof rpc.code !== 'string' || (rpc.code === 'internal' && details === undefined);
  return { at, code: unreachable ? 'RUNTIME_UNREACHABLE' : null, message, details };
}

/** Stage of the check task: uses the task's actual `phase`; a percentage is shown only when the total is known. */
export function checkPhase(job: Pick<JobRecord, 'phase' | 'progress'>): { label: string; percent: number | null } {
  const p = job.progress;
  const percent = p && p.total ? Math.max(0, Math.min(100, Math.round((p.done / p.total) * 100))) : null;
  switch (job.phase) {
    case 'queued':
      return { label: CHECK_PHASE.queued, percent: null };
    case 'starting':
    case 'loading':
      return { label: CHECK_PHASE.loading, percent: null };
    case 'validating':
    case 'publishing':
    case 'finalizing':
    case 'applying':
    case 'done':
      return { label: CHECK_PHASE.verifying, percent: null };
    default:
      return { label: CHECK_PHASE.running, percent };
  }
}

function latestTest(jobs: readonly JobRecord[], bundleId: string): JobRecord | null {
  let latest: JobRecord | null = null;
  for (const job of jobs) {
    if (job.kind !== 'modelTest' || job.bundleId !== bundleId || DROPPED.includes(job.state)) continue;
    if (!latest || job.createdAt > latest.createdAt) latest = job;
  }
  return latest;
}

/**
 * Check status on the row. First see whether the repair started from this row is running, then whether the latest (not cancelled) check task is running; the conclusion is the most recent one by time:
 * the `selfTest` recorded on the model package, a failed task that was not recorded there (for example `APP_FILE_MISSING`), or a rejected submission.
 */
export function checkState({ bundle, jobs, subject, rejection = null, repairJobId = null }: CheckInputs): CheckState {
  if (repairJobId) {
    const job = jobs.find((j) => j.jobId === repairJobId);
    const installing = bundle.install && bundle.install.jobId === repairJobId && bundle.install.state !== 'paused';
    if (installing || (job && LIVE.includes(job.state))) {
      const percent = installing ? installProgressView(bundle.install!).percent : null;
      return { phase: 'repairing', jobId: repairJobId, percent };
    }
  }
  const job = latestTest(jobs, bundle.bundleId);
  if (job && LIVE.includes(job.state)) return { phase: 'checking', jobId: job.jobId, ...checkPhase(job) };

  type Verdict = { at: string; state: CheckState };
  const verdicts: Verdict[] = [];
  const result = bundle.selfTest;
  if (result) {
    verdicts.push({
      at: result.at,
      state:
        result.state === 'passed'
          ? { phase: 'passed', at: result.at }
          : {
              phase: 'failed',
              at: result.at,
              problem: failedProblem(
                { code: result.code, rawCode: 'MODEL_SELF_TEST_FAILED', message: localizeText(result.detail, result.detailRef) ?? null, facts: result.facts },
                subject,
              ),
            },
    });
  }
  if (job?.state === 'failed' && job.error && job.jobId !== result?.jobId) {
    const details = asRecord(job.error.details);
    const code = details.check ?? (job.error.code === 'APP_FILE_MISSING' ? 'APP_FILE_MISSING' : null);
    verdicts.push({
      at: job.updatedAt,
      state: {
        phase: 'failed',
        at: job.updatedAt,
        problem: failedProblem({ code, rawCode: job.error.code, message: localizeText(job.error.message, job.error.messageRef), facts: strings(details.facts) }, subject),
      },
    });
  }
  if (rejection)
    verdicts.push({ at: rejection.at, state: { phase: 'failed', at: rejection.at, problem: rejectionProblem(rejection, subject) } });
  if (!verdicts.length) return { phase: 'idle' };
  verdicts.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return verdicts[0]!.state;
}

/**
 * Status of the repair task started from this row: still running (or not yet in the task list) → null; completed → `check` (automatically re-check once);
 * failed, cancelled, or interrupted → `drop` (no check; the reason is still written on the row as usual).
 */
export function repairOutcome(jobs: readonly JobRecord[], repairJobId: string | null): 'check' | 'drop' | null {
  if (!repairJobId) return null;
  const job = jobs.find((j) => j.jobId === repairJobId);
  if (!job || LIVE.includes(job.state)) return null;
  return job.state === 'completed' ? 'check' : 'drop';
}

/** How this row can be checked now: submit directly; re-enable first (it was disabled after a failed load) and then submit; or cannot be checked. */
export type CheckRoute = 'test' | 'enable-then-test' | null;

const USABLE: readonly ModelBundleStatus['state'][] = ['installed', 'loading', 'ready', 'busy', 'unloading'];

/**
 * Whether this kind of model package has a check: “说话人区分” (speaker diarization) (`capability: 'diarize'`) runs no tasks itself and loads no Worker, so `models.test` rejects it with `unsupported`,
 * and neither the row nor the ⋯ menu offers “检查” (check) (design settings-local.jsx, the model package row).
 */
export function hasCheck(bundle: Pick<ModelBundleStatus, 'capability'>): boolean {
  return bundle.capability !== 'diarize';
}

export function checkRoute(bundle: ModelBundleStatus): CheckRoute {
  if (!hasCheck(bundle) || !isBundleInstalled(bundle)) return null;
  if (bundle.install && bundle.install.state !== 'paused') return null;
  if (bundle.reason === 'unsupported' || bundle.reason === 'worker-missing' || bundle.reason === 'relocating') return null;
  if (USABLE.includes(bundle.state)) return 'test';
  // Models disabled after a failed load (corrupt file, not enough memory): re-check first lifts the disable, otherwise the Runtime rejects it with `MODEL_UNAVAILABLE`.
  if (bundle.reason === 'load-failed' || bundle.reason === 'resource') return 'enable-then-test';
  return null;
}

// ---- View ----

export type CheckActionKey = 'cancel' | 'repair' | 'recheck' | 'details';

export interface CheckAction {
  k: CheckActionKey;
  label: string;
  primary?: boolean;
}

export interface CheckLineView {
  tone: 'running' | 'passed' | 'failed';
  /** "Checking…", "Check failed", "Check could not start"; nothing when it passes. */
  head: string | null;
  text: string;
  todo: string | null;
  /** Progress while running; null when the total is unknown (the progress bar is indeterminate). */
  percent: number | null;
  actions: CheckAction[];
}

/** Actions available on the row: repair (when installed and not being installed) and re-check (when `checkRoute` is not null). */
export interface CheckAbilities {
  repair: boolean;
  recheck: boolean;
}

/** The status shown on the row: null if never checked; while checking, a stage, progress, and cancel; a quiet one-line message when it passes; when it fails, a plain sentence + what to do + an action. */
export function checkLineView(state: CheckState, can: CheckAbilities, now = Date.now()): CheckLineView | null {
  switch (state.phase) {
    case 'idle':
      return null;
    case 'checking':
      return { tone: 'running', head: CHECK_HEAD.running, text: state.label, todo: null, percent: state.percent, actions: [cancel()] };
    case 'repairing':
      return {
        tone: 'running',
        head: CHECK_HEAD.repairing,
        text: CHECK_PHASE.repairing,
        todo: null,
        percent: state.percent,
        actions: [cancel()],
      };
    case 'passed':
      return { tone: 'passed', head: null, text: CHECK_DETAIL.passed(agoLabel(state.at, now)), todo: null, percent: null, actions: [] };
    case 'failed': {
      const p = state.problem;
      return {
        tone: 'failed',
        head: p.kind === 'not-started' ? CHECK_HEAD.notStarted : CHECK_HEAD.failed,
        text: sentence(p.text),
        todo: p.todo,
        percent: null,
        actions: [...problemActions(p, can), { k: 'details', label: CHECK_LABEL.details }],
      };
    }
  }
}

function cancel(): CheckAction {
  return { k: 'cancel', label: CHECK_LABEL.cancel };
}

function problemActions(p: CheckProblem, can: CheckAbilities): CheckAction[] {
  const actions: CheckAction[] = [];
  if (p.repair !== 'no' && can.repair) actions.push({ k: 'repair', label: CHECK_LABEL.repair, primary: true });
  if (can.recheck) actions.push({ k: 'recheck', label: CHECK_LABEL.recheck });
  return actions;
}

/** “技术详情” (technical details): code, model and time, the Runtime's own message and technical specifics. Copying also uses it. */
export function checkDetailLines(state: CheckState, bundleId: string, now = Date.now()): string[] {
  if (state.phase !== 'failed') return [];
  const p = state.problem;
  return [
    CHECK_DETAIL.code(p.rawCode ?? '—'),
    CHECK_DETAIL.model(bundleId, agoLabel(state.at, now)),
    ...(p.message ? [CHECK_DETAIL.message(p.message)] : []),
    ...p.facts,
  ];
}

export interface TryNoteView {
  text: string;
  todo: string | null;
  actions: TryAction[];
  /** When the check the reminder refers to took place (only present with `tryNotice`); the reminder is withdrawn if a later trial succeeds (`noticeAfterTry`). */
  at?: string;
}

export type TryActionKey = 'repair' | 'recheck' | 'check' | 'retry' | 'pickRef' | 'useSample';

export interface TryAction {
  k: TryActionKey;
  label: string;
  primary?: boolean;
}

/** Reminder at the top of the trial panel: says so first if the last check did not pass (a check that could not start does not count, since it did not check). */
export function tryNotice(state: CheckState, can: CheckAbilities, subject: TrySubject = TRY_SUBJECT): TryNoteView | null {
  if (state.phase !== 'failed' || state.problem.kind !== 'failed') return null;
  const p = state.problem;
  const actions: TryAction[] = [];
  if (p.repair !== 'no' && can.repair) actions.push({ k: 'repair', label: CHECK_LABEL.repair, primary: true });
  if (can.recheck) actions.push({ k: 'recheck', label: CHECK_LABEL.recheck });
  return { text: sentence(TRY_NOTICE.text(p.text)), todo: subject.noticeTodo(p.todo), actions, at: state.at };
}

/**
 * A trial succeeded after that check (`okAt` is the time that successful run ended), so the reminder is withdrawn: saying “现在试听多半也会失败” (listening now will most likely fail too) would contradict the result in front of the user.
 * The check result on the row stays as it is; only a re-check replaces it. If a later check fails again, the reminder appears as usual.
 */
export function noticeAfterTry(notice: TryNoteView | null, okAt: string | null | undefined): TryNoteView | null {
  if (!notice?.at || !okAt) return notice;
  return Date.parse(okAt) > Date.parse(notice.at) ? null : notice;
}

export type TryFailureKind = 'invalid' | 'refUnreadable' | 'appFileMissing' | 'noMemory' | 'modelError' | 'other';

const MODEL_ERRORS = new Set(['MODEL_LOAD_FAILED', 'MODEL_WORKER_CRASHED', 'MODEL_OUTPUT_INVALID', 'MODEL_UNAVAILABLE']);

/** Error code of a failed trial (`details.code` when the submission was rejected, `error.code` when the task failed) → which kind. */
export function tryFailureKind(code: string | null, details: unknown): TryFailureKind {
  if (code === 'INPUT_UNREADABLE' || code === 'ASSET_MISSING') return 'refUnreadable';
  if (code === 'APP_FILE_MISSING') return 'appFileMissing';
  if (code === 'RESOURCE_ADMISSION_UNSATISFIABLE') return 'noMemory';
  if (code === 'MODEL_LOAD_FAILED' && asRecord(details).reason === 'resource') return 'noMemory';
  if (code && MODEL_ERRORS.has(code)) return 'modelError';
  return 'other';
}

/** File name: the last segment of the path (both separators are recognized). */
export function fileLabel(file: unknown): string | null {
  if (typeof file !== 'string' || !file) return null;
  return file.split(/[\\/]/).filter(Boolean).pop() ?? null;
}

export interface TryFailureInput {
  kind: TryFailureKind;
  /** The message for an incomplete form; the Runtime's own message (`other`). */
  message?: string | null;
  /** Recording that could not be read: the file name the user picked, or `details.file`. */
  file?: string | null;
  /** This submission was rejected (did not start), rather than the task failing. */
  notStarted?: boolean;
  /** The row can be checked. */
  canCheck: boolean;
  /** Listen (default) or try drawing. */
  subject?: TrySubject;
}

/** The trial's own failure: what is wrong + what to do, with a button if there is an action; no toast. */
export function tryFailureView(input: TryFailureInput): TryNoteView {
  const subject = input.subject ?? TRY_SUBJECT;
  switch (input.kind) {
    case 'invalid':
      return { text: input.message ?? '', todo: null, actions: [] };
    case 'refUnreadable': {
      const s = TRY_FAILURE.refUnreadable(fileLabel(input.file) ?? TRY_FAILURE.refUnknown);
      return {
        text: sentence(s.text),
        todo: s.todo,
        actions: [
          { k: 'pickRef', label: CHECK_LABEL.pickRef, primary: true },
          { k: 'useSample', label: CHECK_LABEL.useSample },
        ],
      };
    }
    case 'appFileMissing': {
      const s = TRY_FAILURE.appFileMissing;
      return { text: sentence(s.text), todo: s.todo, actions: [] };
    }
    case 'noMemory': {
      const s = subject.noMemory;
      return { text: sentence(s.text), todo: s.todo, actions: [{ k: 'retry', label: CHECK_LABEL.retry, primary: true }] };
    }
    case 'modelError': {
      const actions: TryAction[] = input.canCheck ? [{ k: 'check', label: CHECK_LABEL.checkFull, primary: true }] : [];
      actions.push({ k: 'retry', label: CHECK_LABEL.retry, primary: !input.canCheck });
      const s = subject.modelError;
      return { text: sentence(s.text), todo: s.todo, actions };
    }
    case 'other': {
      const message = input.message ?? '';
      const s = input.notStarted ? subject.notStarted(message) : subject.other(message);
      return { text: s.todo ? sentence(s.text) : s.text, todo: s.todo || null, actions: [{ k: 'retry', label: CHECK_LABEL.retry }] };
    }
  }
}

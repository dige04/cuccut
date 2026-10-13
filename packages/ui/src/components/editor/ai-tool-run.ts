import { create } from 'zustand';
import { AI_TOOL_PIPELINE, type AiToolKind, type AiToolParams, type AiToolSummary, type Id, type JobRecord, type TransactionReceipt, type UndoTarget } from '@cuccut/protocol';
import { appendSkillId } from '../../model/agent-skills.ts';
import { jobErrorText } from '../../model/localized-text.ts';
import { jobRemedy, rejectionRemedy, type Remedy } from '../../model/task-facts.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';

/**
 * The run of 「用 › 直接调模型」 (Use › Call model directly) on the tool page (product design §5.10): submits `pipelines.start('ai-tool')`, follows the parent task through the `jobs` topic; when complete, the parent task's `pipeline.summary` (`AiToolSummary`) is either the transaction written into the video (polishing, chapters; undoable with one click on the receipt), or the body the model wrote
 * (summaries, blog posts, titles, descriptions; only for people to read and copy).
 *
 * State is kept in a module-level store (like speakers-run.ts): the tool page may be closed or moved to another panel, and the task must not disconnect because of it; the result is still there.
 * The key is 「视频 · 工具」 (video · tool): different tools on the same video can run at once, but the same tool runs only once at a time.
 */

export const runKey = (videoId: Id, tool: AiToolKind): string => `${videoId}:${tool}`;

export interface AiToolRun {
  videoId: Id;
  tool: AiToolKind;
  /** null until submission succeeds. */
  jobId: Id | null;
  status: 'submitting' | 'running';
  /** Which model the run state shows (the name from the menu). */
  model: string;
  /** The task's `updatedAt` on retry: when the mirror still holds that already-finished record, it is not finished again. */
  retriedAt: string | null;
}

/** For result-only tools: the body the model wrote. */
export interface AiToolResult {
  videoId: Id;
  tool: AiToolKind;
  jobId: Id;
  summary: AiToolSummary & { text: string };
}

/** For tools that write into the video: the receipt of that transaction (undo with one click, no redo). */
export interface AiToolReceipt {
  videoId: Id;
  tool: AiToolKind;
  jobId: Id;
  summary: AiToolSummary;
  /** null when there is no change (or the Runtime did not provide a transaction); no undo is offered. */
  transactionId: Id | null;
  undone: boolean;
  busy: boolean;
}

export interface AiToolProblem {
  videoId: Id;
  tool: AiToolKind;
  title: string;
  message: string;
  /** The remedy that goes to the model page and settings (when no text model is configured). */
  remedy: Remedy | null;
  /** A task that can be re-run from the step where it stopped (`pipelines.retry`). */
  retryJobId: Id | null;
  /** The one among the background tasks that needs a person's decision. */
  taskId: Id | null;
  model: string;
}

interface AiToolRunState {
  runs: Record<string, AiToolRun>;
  results: Record<string, AiToolResult>;
  receipts: Record<string, AiToolReceipt>;
  problems: Record<string, AiToolProblem>;
  /** A task whose receipt was undone (`jobId`): after the receipt is closed, the list still shows 「已撤销」 (Undone) rather than 「上次」 (Last time). */
  undoneJobs: Record<Id, true>;
}

const EMPTY: AiToolRunState = { runs: {}, results: {}, receipts: {}, problems: {}, undoneJobs: {} };

export const useAiToolRun = create<AiToolRunState>()(() => ({ ...EMPTY }));

/**
 * Text typed into the tool page's prompt box, keyed by `toolDraftKey` (video · tool). While running, or showing a result or a receipt, this page is replaced by that state and the prompt box is unmounted;
 * going back to the list does the same. The text lives here, so it survives 「完成」 (Done), switching 「用」 (Use), or re-entering from the list. No entry means it is unedited (the box follows the template);
 * clearing it to empty still counts as an edit and does not snap back to the template.
 */
export const useAiToolPrompts = create<{ prompts: Record<string, string> }>()(() => ({ prompts: {} }));

/** The text in the box changed: if it is identical to the template, it is not an edit (delete the entry). */
export function setAiToolPrompt(key: string, text: string, template: string): void {
  useAiToolPrompts.setState((s) => ({ prompts: text === template ? without(s.prompts, key) : { ...s.prompts, [key]: text } }));
}

/** 「恢复默认」 (Restore default): back to the template. */
export function restoreAiToolPrompt(key: string): void {
  useAiToolPrompts.setState((s) => ({ prompts: without(s.prompts, key) }));
}

/**
 * Skills attached to the tool page's prompt box, keyed like `useAiToolPrompts`, in attachment order with no duplicates. Same reason as above: when the box is unmounted and remounted, skills that were removed (built-ins) cannot return by themselves,
 * and skills attached with 「+ › 使用 Skill」 (+ › Use Skill) must not be lost. No entry means the default set (`defaults`: this tool's built-in skill).
 */
export const useAiToolSkills = create<{ skills: Record<string, string[]> }>()(() => ({ skills: {} }));

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Attached skills changed: if it is identical to the default set, delete the entry. */
export function setAiToolSkills(key: string, ids: readonly string[], defaults: readonly string[]): void {
  useAiToolSkills.setState((s) => ({ skills: sameIds(ids, defaults) ? without(s.skills, key) : { ...s.skills, [key]: [...ids] } }));
}

/** The skills currently attached to this box: the saved ones, or the default set. */
export function aiToolSkills(key: string, defaults: readonly string[]): readonly string[] {
  return useAiToolSkills.getState().skills[key] ?? defaults;
}

/** Attach a skill: appended, not duplicated if already attached. */
export function attachAiToolSkill(key: string, id: string, defaults: readonly string[]): void {
  setAiToolSkills(key, appendSkillId(aiToolSkills(key, defaults), id), defaults);
}

/** Remove a skill. */
export function detachAiToolSkill(key: string, id: string, defaults: readonly string[]): void {
  setAiToolSkills(key, aiToolSkills(key, defaults).filter((x) => x !== id), defaults);
}

/** The conversation capabilities used; tests supply fakes. */
export interface AiToolRunDeps {
  runtime: {
    startPipeline(pipeline: string, params: Record<string, unknown>): Promise<Id>;
    retryPipeline(jobId: Id): Promise<void>;
    cancelJob(jobId: Id): Promise<void>;
    videos: { undo(target: UndoTarget): Promise<TransactionReceipt | null> };
  };
  toast(kind: 'positive' | 'neutral' | 'negative', message: string): void;
}

let deps: AiToolRunDeps | null = null;
let unwatch: (() => void) | null = null;

/** On mount, bind the tool page to a conversation and the prompt; the first binding starts watching the `jobs` topic. */
export function bindAiToolRun(next: AiToolRunDeps): void {
  deps = next;
  unwatch ??= useJobs.subscribe((state) => settle(state.jobs));
}

/** For tests: unbind and clear the state. */
export function resetAiToolRun(): void {
  unwatch?.();
  unwatch = null;
  deps = null;
  useAiToolRun.setState({ ...EMPTY });
  useAiToolPrompts.setState({ prompts: {} });
  useAiToolSkills.setState({ skills: {} });
}

const without = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _, ...rest } = record;
  return rest;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function endRun(key: string, problem?: AiToolProblem): void {
  useAiToolRun.setState((s) => ({
    runs: without(s.runs, key),
    problems: problem ? { ...s.problems, [key]: problem } : s.problems,
  }));
}

/** The 「知道了」 (Got it) on the question card. */
export function dismissAiToolProblem(key: string): void {
  useAiToolRun.setState((s) => ({ problems: without(s.problems, key) }));
}

/** 「完成」 (Done) on the result and receipt: back to the settings state. */
export function closeAiToolResult(key: string): void {
  useAiToolRun.setState((s) => ({ results: without(s.results, key), receipts: without(s.receipts, key) }));
}

/** Start. The same tool on the same video runs only once at a time. `model` is the model name shown in the run state and on the question card. */
export async function startAiTool(params: AiToolParams, model: string): Promise<boolean> {
  const bound = deps;
  const key = runKey(params.videoId, params.tool);
  if (!bound || useAiToolRun.getState().runs[key]) return false;
  useAiToolRun.setState((s) => ({
    runs: { ...s.runs, [key]: { videoId: params.videoId, tool: params.tool, jobId: null, status: 'submitting', model, retriedAt: null } },
    results: without(s.results, key),
    receipts: without(s.receipts, key),
    problems: without(s.problems, key),
  }));
  try {
    const jobId = await bound.runtime.startPipeline(AI_TOOL_PIPELINE, { ...params });
    useAiToolRun.setState((s) => (s.runs[key] ? { runs: { ...s.runs, [key]: { ...s.runs[key]!, jobId, status: 'running' } } } : {}));
    // Task events can arrive before the receipt.
    settle(useJobs.getState().jobs);
    return true;
  } catch (error) {
    endRun(key, { videoId: params.videoId, tool: params.tool, title: C.submitFailed, message: messageOf(error), remedy: rejectionRemedy('generateText', error), retryJobId: null, taskId: null, model });
    return false;
  }
}

/** Re-run the same task from the step where it stopped (`pipelines.retry`). */
export async function retryAiTool(key: string): Promise<void> {
  const bound = deps;
  const problem = useAiToolRun.getState().problems[key];
  const jobId = problem?.retryJobId;
  if (!bound || !problem || !jobId || useAiToolRun.getState().runs[key]) return;
  const { videoId, tool } = problem;
  const before = useJobs.getState().jobs.find((job) => job.jobId === jobId);
  useAiToolRun.setState((s) => ({
    runs: { ...s.runs, [key]: { videoId, tool, jobId, status: 'submitting', model: problem.model, retriedAt: null } },
    problems: without(s.problems, key),
  }));
  try {
    await bound.runtime.retryPipeline(jobId);
    useAiToolRun.setState((s) =>
      s.runs[key] ? { runs: { ...s.runs, [key]: { ...s.runs[key]!, status: 'running', retriedAt: before?.updatedAt ?? null } } } : {},
    );
  } catch (error) {
    endRun(key, { videoId, tool, title: C.failed, message: messageOf(error), remedy: null, retryJobId: jobId, taskId: null, model: problem.model });
  }
}

export async function cancelAiTool(jobId: Id): Promise<void> {
  try {
    await deps?.runtime.cancelJob(jobId);
  } catch (error) {
    deps?.toast('negative', C.cancelFailed(messageOf(error)));
  }
}

/** Watch the task submitted from here: when it finishes, wrap up. Once per round — change the state synchronously first. */
function settle(jobs: readonly JobRecord[]): void {
  for (const [key, run] of Object.entries(useAiToolRun.getState().runs)) {
    if (run.status !== 'running' || !run.jobId) continue;
    const job = jobs.find((candidate) => candidate.jobId === run.jobId);
    if (!job || isJobLive(job)) continue;
    if (run.retriedAt !== null && job.updatedAt === run.retriedAt) continue;
    finish(key, run, job);
  }
}

export function isAiToolSummary(value: unknown): value is AiToolSummary {
  const s = value as Partial<AiToolSummary> | null | undefined;
  return !!s && typeof s.tool === 'string' && typeof s.artifactId === 'string' && typeof s.context === 'object' && s.context !== null;
}

function finish(key: string, run: AiToolRun, job: JobRecord): void {
  const base = { videoId: run.videoId, tool: run.tool, remedy: null, retryJobId: null, taskId: null, model: run.model };
  if (job.state === 'cancelled') {
    endRun(key);
    deps?.toast('neutral', C.cancelled);
    return;
  }
  if (job.state === 'needs-reconciliation') {
    endRun(key, { ...base, title: C.needsDecision, message: jobErrorText(job.error) ?? '', taskId: job.jobId });
    return;
  }
  if (job.state !== 'completed') {
    endRun(key, {
      ...base,
      title: job.state === 'interrupted' ? C.interrupted : C.failed,
      message: jobErrorText(job.error) ?? '',
      remedy: jobRemedy(job),
      retryJobId: job.jobId,
    });
    return;
  }
  const summary = job.pipeline?.summary;
  if (!isAiToolSummary(summary)) {
    endRun(key, { ...base, title: C.failed, message: C.badResult });
    return;
  }
  if (summary.applied) {
    const receipt: AiToolReceipt = {
      videoId: run.videoId,
      tool: run.tool,
      jobId: job.jobId,
      summary,
      transactionId: summary.applied.transactionId,
      undone: false,
      busy: false,
    };
    useAiToolRun.setState((s) => ({ runs: without(s.runs, key), receipts: { ...s.receipts, [key]: receipt } }));
    return;
  }
  if (typeof summary.text !== 'string') {
    endRun(key, { ...base, title: C.failed, message: C.badResult });
    return;
  }
  const result: AiToolResult = { videoId: run.videoId, tool: run.tool, jobId: job.jobId, summary: { ...summary, text: summary.text } };
  useAiToolRun.setState((s) => ({ runs: without(s.runs, key), results: { ...s.results, [key]: result } }));
}

/** 「撤销」 (Undo) on the receipt: undo the transaction written into the video. */
export async function undoAiTool(key: string): Promise<void> {
  const bound = deps;
  const receipt = useAiToolRun.getState().receipts[key];
  if (!bound || !receipt?.transactionId || receipt.undone || receipt.busy) return;
  const patch = (change: Partial<AiToolReceipt>) =>
    useAiToolRun.setState((s) => (s.receipts[key] ? { receipts: { ...s.receipts, [key]: { ...s.receipts[key]!, ...change } } } : {}));
  patch({ busy: true });
  const result = await bound.runtime.videos.undo({ transaction: receipt.transactionId });
  if (!result) {
    patch({ busy: false });
    bound.toast('negative', C.undoFailed);
    return;
  }
  patch({ busy: false, undone: true });
  useAiToolRun.setState((s) => ({ undoneJobs: { ...s.undoneJobs, [receipt.jobId]: true } }));
}

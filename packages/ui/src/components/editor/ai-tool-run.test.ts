import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RpcError, type AiToolSummary, type JobRecord, type TransactionReceipt, type UndoTarget } from '@cuccut/protocol';
import { toolDraftKey } from '../../model/ai-tools.ts';
import { useJobs } from '../../state/jobs-store.ts';
import {
  attachAiToolSkill,
  bindAiToolRun,
  closeAiToolResult,
  detachAiToolSkill,
  resetAiToolRun,
  restoreAiToolPrompt,
  retryAiTool,
  setAiToolPrompt,
  setAiToolSkills,
  runKey,
  startAiTool,
  undoAiTool,
  useAiToolPrompts,
  useAiToolRun,
  useAiToolSkills,
  type AiToolRunDeps,
} from './ai-tool-run.ts';

const context = { paragraphs: 3, characters: 120, chapters: 0, attachments: 0, skippedAttachments: 0, skills: [], references: 0 };
const textSummary: AiToolSummary = {
  videoId: 'vid',
  tool: 'summary',
  providerId: 'openai',
  modelId: 'gpt-5-mini',
  context,
  applied: null,
  text: '# Summary\n\n- point',
  artifactId: 'art_1',
  finishReason: 'stop',
};
const polishSummary: AiToolSummary = { ...textSummary, tool: 'polish', applied: { transactionId: 'tx_apply', changes: 4 }, text: null };

function job(jobId: string, state: JobRecord['state'], summary: AiToolSummary | null = null, extra: Partial<JobRecord> = {}): JobRecord {
  return {
    jobId,
    kind: 'pipeline',
    state,
    phase: state === 'completed' ? 'done' : 'starting',
    progress: null,
    videoId: 'vid',
    updatedAt: 'u1',
    endedAt: state === 'running' || state === 'queued' ? null : 'e1',
    error: null,
    pipeline: {
      name: 'ai-tool',
      params: { videoId: 'vid' },
      steps: [],
      current: null,
      stoppedAt: null,
      summary: state === 'completed' ? (summary as unknown as Record<string, unknown>) : null,
    },
    ...extra,
  } as JobRecord;
}

function fake(start?: () => Promise<string>) {
  const toasts: string[] = [];
  const undone: UndoTarget[] = [];
  let next = 0;
  const deps = {
    runtime: {
      startPipeline: vi.fn(start ?? (async () => `p${++next}`)),
      retryPipeline: vi.fn(async () => {}),
      cancelJob: vi.fn(async () => {}),
      videos: {
        undo: vi.fn(async (target: UndoTarget) => {
          undone.push(target);
          return { transactionId: 'tx_undo', undo: { available: true } } as unknown as TransactionReceipt;
        }),
      },
    },
    toast: (_kind: string, message: string) => {
      toasts.push(message);
    },
  } satisfies AiToolRunDeps;
  bindAiToolRun(deps);
  return { deps, toasts, undone };
}

beforeEach(() => {
  resetAiToolRun();
  useJobs.setState({ ready: true, jobs: [] });
});

afterEach(() => resetAiToolRun());

describe('direct model call run', () => {
  it('submits ai-tool workflow; result-only tool keeps the body on completion, doesn\'t write to the video', async () => {
    const { deps } = fake();
    const key = runKey('vid', 'summary');
    expect(await startAiTool({ videoId: 'vid', tool: 'summary', prompt: 'Summarize' }, 'gpt-5-mini')).toBe(true);
    expect(deps.runtime.startPipeline).toHaveBeenCalledWith('ai-tool', { videoId: 'vid', tool: 'summary', prompt: 'Summarize' });
    expect(useAiToolRun.getState().runs[key]).toMatchObject({ jobId: 'p1', status: 'running', model: 'gpt-5-mini' });
    // The same tool runs only once at a time; other tools run as usual.
    expect(await startAiTool({ videoId: 'vid', tool: 'summary', prompt: 'again' }, 'gpt-5-mini')).toBe(false);
    expect(await startAiTool({ videoId: 'vid', tool: 'blog', prompt: 'Blog' }, 'gpt-5-mini')).toBe(true);
    useJobs.setState({ jobs: [job('p1', 'running')] });
    expect(useAiToolRun.getState().runs[key]).toBeDefined();
    useJobs.setState({ jobs: [job('p1', 'completed', textSummary)] });
    expect(useAiToolRun.getState().runs[key]).toBeUndefined();
    expect(useAiToolRun.getState().results[key]?.summary.text).toBe('# Summary\n\n- point');
    expect(useAiToolRun.getState().receipts[key]).toBeUndefined();
    closeAiToolResult(key);
    expect(useAiToolRun.getState().results[key]).toBeUndefined();
  });

  it('tool that writes into the video: receipt carries the transaction, one undo', async () => {
    const { undone, toasts } = fake();
    const key = runKey('vid', 'polish');
    await startAiTool({ videoId: 'vid', tool: 'polish', prompt: 'Polish' }, 'gpt-5-mini');
    useJobs.setState({ jobs: [job('p1', 'completed', polishSummary)] });
    expect(useAiToolRun.getState().receipts[key]).toMatchObject({ transactionId: 'tx_apply', undone: false });
    await undoAiTool(key);
    expect(undone).toEqual([{ transaction: 'tx_apply' }]);
    expect(useAiToolRun.getState().receipts[key]).toMatchObject({ undone: true, busy: false });
    await undoAiTool(key);
    expect(undone).toHaveLength(1);
    expect(toasts).toEqual([]);
    // After the receipt is closed, the list still knows that undo happened.
    closeAiToolResult(key);
    expect(useAiToolRun.getState().undoneJobs).toEqual({ p1: true });
  });

  it('submission rejected (no text model configured): issue card carries the reason, no run kept', async () => {
    fake(async () => {
      throw new RpcError('invalid-request', 'No text model', { code: 'CAPABILITY_NOT_CONFIGURED' });
    });
    const key = runKey('vid', 'title');
    expect(await startAiTool({ videoId: 'vid', tool: 'title', prompt: 'Titles' }, 'm')).toBe(false);
    expect(useAiToolRun.getState().runs[key]).toBeUndefined();
    expect(useAiToolRun.getState().problems[key]).toMatchObject({ message: 'No text model', retryJobId: null });
  });

  it('failure gives reason and retry (same task); cancel only shows a hint', async () => {
    const { deps, toasts } = fake();
    const key = runKey('vid', 'chapters');
    await startAiTool({ videoId: 'vid', tool: 'chapters', prompt: 'Chapters' }, 'gpt-5-mini');
    useJobs.setState({ jobs: [job('p1', 'failed', null, { error: { code: 'MODEL_OUTPUT_INVALID', message: 'bad output' } as JobRecord['error'] })] });
    expect(useAiToolRun.getState().problems[key]).toMatchObject({ message: 'bad output', retryJobId: 'p1', tool: 'chapters' });
    await retryAiTool(key);
    expect(deps.runtime.retryPipeline).toHaveBeenCalledWith('p1');
    // The mirror still holds that failed record: do not finish it.
    useJobs.setState({ jobs: [job('p1', 'failed', null, { error: { code: 'X', message: 'x' } as JobRecord['error'] })] });
    expect(useAiToolRun.getState().runs[key]).toBeDefined();
    useJobs.setState({ jobs: [job('p1', 'cancelled', null, { updatedAt: 'u2' })] });
    expect(useAiToolRun.getState().runs[key]).toBeUndefined();
    expect(useAiToolRun.getState().problems[key]).toBeUndefined();
    expect(toasts).toHaveLength(1);
  });
});

describe('words edited in the prompt box', () => {
  const draftKey = toolDraftKey('vid', 'summary');
  const template = 'Summarize this video.';
  const edited = () => useAiToolPrompts.getState().prompts[draftKey];

  it('still there after the run and after "done" on the result page; returns to the template only when edited back to the template or "restore default" is used', async () => {
    fake();
    setAiToolPrompt(draftKey, 'Summarize in three bullets.', template);
    const key = runKey('vid', 'summary');
    await startAiTool({ videoId: 'vid', tool: 'summary', prompt: 'Summarize in three bullets.' }, 'gpt-5-mini');
    useJobs.setState({ jobs: [job('p1', 'completed', textSummary)] });
    expect(useAiToolRun.getState().results[key]).toBeDefined();
    closeAiToolResult(key);
    expect(edited()).toBe('Summarize in three bullets.');

    setAiToolPrompt(draftKey, template, template);
    expect(edited()).toBeUndefined();
    setAiToolPrompt(draftKey, '', template);
    expect(edited()).toBe('');
    restoreAiToolPrompt(draftKey);
    expect(edited()).toBeUndefined();
  });

  it('stored separately per "video · tool"', () => {
    setAiToolPrompt(draftKey, 'A', template);
    setAiToolPrompt(toolDraftKey('vid', 'blog'), 'B', template);
    setAiToolPrompt(toolDraftKey('other', 'summary'), 'C', template);
    expect(useAiToolPrompts.getState().prompts).toEqual({ [draftKey]: 'A', 'aitool:vid:blog': 'B', 'aitool:other:summary': 'C' });
  });
});

describe('skill attached to the prompt box', () => {
  const draftKey = toolDraftKey('vid', 'summary');
  const defaults = ['video-summary'];
  const stored = () => useAiToolSkills.getState().skills[draftKey];

  it('removed built-in; after the run and "done" on the result page still removed; re-adding the default version stops storing it', async () => {
    fake();
    detachAiToolSkill(draftKey, 'video-summary', defaults);
    expect(stored()).toEqual([]);
    const key = runKey('vid', 'summary');
    await startAiTool({ videoId: 'vid', tool: 'summary', prompt: 'Summarize.' }, 'gpt-5-mini');
    useJobs.setState({ jobs: [job('p1', 'completed', textSummary)] });
    expect(useAiToolRun.getState().results[key]).toBeDefined();
    closeAiToolResult(key);
    expect(stored()).toEqual([]);

    attachAiToolSkill(draftKey, 'video-summary', defaults);
    expect(stored()).toBeUndefined();
    expect(useAiToolSkills.getState().skills).toEqual({});
  });

  it('appended after, not duplicated; re-adding a built-in also appends after', () => {
    attachAiToolSkill(draftKey, 'house-style', defaults);
    attachAiToolSkill(draftKey, 'house-style', defaults);
    expect(stored()).toEqual(['video-summary', 'house-style']);
    detachAiToolSkill(draftKey, 'video-summary', defaults);
    attachAiToolSkill(draftKey, 'video-summary', defaults);
    expect(stored()).toEqual(['house-style', 'video-summary']);
    setAiToolSkills(draftKey, defaults, defaults);
    expect(stored()).toBeUndefined();
  });

  it('stored separately per "video · tool"', () => {
    attachAiToolSkill(draftKey, 'a', defaults);
    detachAiToolSkill(toolDraftKey('vid', 'blog'), 'video-blog', ['video-blog']);
    attachAiToolSkill(toolDraftKey('other', 'summary'), 'c', defaults);
    expect(useAiToolSkills.getState().skills).toEqual({
      [draftKey]: ['video-summary', 'a'],
      'aitool:vid:blog': [],
      'aitool:other:summary': ['video-summary', 'c'],
    });
  });
});

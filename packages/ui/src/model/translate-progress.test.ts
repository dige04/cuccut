import { describe, expect, it } from 'vitest';
import type { JobRecord, PipelineStepState } from '@cuccut/protocol';
import { isAgentTranslate, isTranslateJob, liveTranslations, retryNote, sourceOf, targetOf, translateProgress, translationOf } from './translate-progress.ts';

const step = (name: string, label: string, status: PipelineStepState['status'], jobId: string | null = null): PipelineStepState => ({
  name,
  label,
  status,
  jobId,
  attempts: status === 'pending' ? 0 : 1,
  output: null,
});

function job(state: JobRecord['state'], extra: Partial<JobRecord> = {}): JobRecord {
  return {
    jobId: 'p1',
    kind: 'pipeline',
    state,
    phase: 'starting',
    progress: null,
    videoId: 'vid',
    assetId: null,
    assetRevision: null,
    contentHash: 'sha256:0',
    providerId: 'openai',
    modelId: 'gpt-5',
    bundleId: null,
    inputHash: 'sha256:0',
    submitter: { kind: 'connection' } as JobRecord['submitter'],
    attempt: 1,
    createdAt: '',
    updatedAt: '',
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    pipeline: {
      name: 'translate',
      params: { videoId: 'vid', documentId: 'speech', targetLanguage: 'ja' },
      steps: [
        step('freeze-source', '读取原文', 'completed'),
        step('translate', '翻译', 'running', 'c2'),
        step('assemble', '组装译文', 'pending'),
        step('write', '写入视频', 'pending'),
      ],
      current: 1,
      stoppedAt: null,
      summary: null,
    },
    ...extra,
  };
}

const child = (done: number, total: number | null): JobRecord =>
  job('running', { jobId: 'c2', kind: 'pipeline-step', parentJobId: 'p1', pipeline: undefined, progress: { done, total, unit: 'units' } as JobRecord['progress'] });

describe('progress of the translation pipeline', () => {
  it('recognizes this video\'s translation pipeline, reads the target language, the source text and the translation written into the video', () => {
    const running = job('running');
    expect(isTranslateJob(running, 'vid')).toBe(true);
    expect(isTranslateJob(running, 'other')).toBe(false);
    expect(isTranslateJob({ ...running, pipeline: { ...running.pipeline!, name: 'dub' } }, 'vid')).toBe(false);
    expect(liveTranslations([running, job('failed', { jobId: 'p2' })], 'vid').map((j) => j.jobId)).toEqual(['p1']);
    expect(targetOf(running)).toBe('ja');
    expect(sourceOf(running)).toBe('speech');
    expect(translationOf(job('completed', { result: { documentId: 'tr', artifactId: 'a' } }))).toBe('tr');
    const summarized = job('completed');
    summarized.pipeline = { ...summarized.pipeline!, summary: { documentId: 'tr2' } };
    expect(translationOf(summarized)).toBe('tr2');
  });

  it('completed steps count as full; the translation step counts partially by subtask sentence count; at most 99 when not complete', () => {
    expect(translateProgress(job('running'), [child(10, 40)])).toEqual({
      percent: Math.floor(((5 + 85 * 0.25) / 100) * 100),
      step: '翻译',
      units: { done: 10, total: 40 },
      queued: false,
      agent: null,
    });
    // Subtask is not in the mirror: that step counts as 0, no guessing.
    expect(translateProgress(job('running'), []).percent).toBe(5);
    expect(translateProgress(job('running'), [child(3, null)]).units).toEqual({ done: 3, total: null });
    const nearly = job('running');
    nearly.pipeline = { ...nearly.pipeline!, steps: nearly.pipeline!.steps.map((s) => ({ ...s, status: 'completed' as const })) };
    expect(translateProgress(nearly, []).percent).toBe(99);
    expect(translateProgress({ ...nearly, state: 'completed' }, []).percent).toBe(100);
    expect(translateProgress(job('queued', { pipeline: { ...job('queued').pipeline!, steps: [] } }), [])).toMatchObject({
      percent: 0,
      step: null,
      queued: true,
    });
  });

  it('agent translating itself: counts this video\'s translation, scope reads translation; no steps or percentage; 100 when complete', () => {
    const agent = job('running', {
      jobId: 'a1',
      kind: 'agentTranslate',
      phase: 'generating',
      providerId: 'agent:codex',
      modelId: 'codex',
      pipeline: undefined,
      submitter: { kind: 'agent', id: 'conv_1', taskId: 't1' } as JobRecord['submitter'],
      translation: { sourceDocumentId: 'speech_a', targetLanguage: 'en', sentences: 62 },
    });
    expect(isAgentTranslate(agent)).toBe(true);
    expect(isAgentTranslate(job('running'))).toBe(false);
    expect(isTranslateJob(agent, 'vid')).toBe(true);
    expect(isTranslateJob(agent, 'other')).toBe(false);
    expect(liveTranslations([agent, { ...agent, jobId: 'a2', state: 'interrupted', endedAt: 'x' }], 'vid').map((j) => j.jobId)).toEqual(['a1']);
    expect(targetOf(agent)).toBe('en');
    expect(sourceOf(agent)).toBe('speech_a');
    expect(translateProgress(agent, [])).toEqual({ percent: null, step: null, units: null, queued: false, agent: { sentences: 62 } });
    expect(translateProgress({ ...agent, state: 'completed' }, []).percent).toBe(100);
    // Not a pipeline: there are no retryable steps.
    expect(retryNote({ ...agent, state: 'interrupted' })).toBeNull();
  });

  it('retry billing note: stopped at the translation step, only online models are billed again; later steps do not call the model again; earlier ones say nothing', () => {
    const stopped = (name: string, providerId = 'openai') => {
      const failed = job('failed', { providerId });
      failed.pipeline = { ...failed.pipeline!, stoppedAt: name };
      return failed;
    };
    expect(retryNote(stopped('translate'))).toBe('charges');
    expect(retryNote(stopped('translate', 'local'))).toBeNull();
    expect(retryNote(stopped('translate', 'node:n1'))).toBeNull();
    expect(retryNote(stopped('write'))).toBe('free');
    expect(retryNote(stopped('assemble'))).toBe('free');
    expect(retryNote(stopped('freeze-source'))).toBeNull();
    // When stoppedAt is not recorded, look it up from the step states.
    const interrupted = job('interrupted', { endedAt: 'x' });
    interrupted.pipeline = {
      ...interrupted.pipeline!,
      steps: interrupted.pipeline!.steps.map((s) => (s.name === 'translate' ? { ...s, status: 'interrupted' as const } : s)),
    };
    expect(retryNote(interrupted)).toBe('charges');
  });
});

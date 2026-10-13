import { describe, expect, it } from 'vitest';
import type { ApplicationRecord, GenerationParameters } from '@cuccut/protocol';
import { job } from '../testing/task-records.ts';
import { chargesOnRetry, reconcileOptions } from './task-reconcile.ts';

const speech: GenerationParameters = {
  capability: 'synthesizeSpeech',
  text: '你好',
  voice: 'alloy',
  language: null,
  format: 'mp3',
  instructions: null,
  speed: null,
  seed: null,
};

function application(state: ApplicationRecord['state']): ApplicationRecord {
  return {
    applicationId: 'ap1',
    jobId: 'j1',
    artifactIds: ['art1'],
    videoId: 'v1',
    targetRefs: ['a1'],
    baseVideoRevision: null,
    commandId: null,
    state,
    receipt: null,
    error: null,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-01T09:00:00Z',
  };
}

const ENDED = '2026-10-01T09:10:00Z';

describe('reconcile choices (following the Runtime\'s reconcileChoices)', () => {
  it('auto-rerunning after a crash (interrupted, no endedAt) is not finished yet, so no choice is offered', () => {
    expect(reconcileOptions(job({ jobId: 'j1', state: 'interrupted', endedAt: null }))).toEqual([]);
  });

  it('outcome unknown: generation tasks can be retried or abandoned; interrupted ones can only be retried', () => {
    const base = { jobId: 'j1', kind: 'synthesizeSpeech' as const, providerId: 'openai', videoId: null, generation: speech };
    expect(reconcileOptions(job({ ...base, state: 'needs-reconciliation' }))).toEqual(['retry', 'discard']);
    expect(reconcileOptions(job({ ...base, state: 'interrupted', endedAt: ENDED }))).toEqual(['retry']);
  });

  it('transcription can be retried only with a video; a fixed-workflow step and a remote-node submission cannot', () => {
    expect(reconcileOptions(job({ jobId: 'j1', state: 'interrupted', endedAt: ENDED }))).toEqual(['retry']);
    expect(reconcileOptions(job({ jobId: 'j1', state: 'interrupted', endedAt: ENDED, videoId: null }))).toEqual([]);
    expect(reconcileOptions(job({ jobId: 'j1', state: 'interrupted', endedAt: ENDED, parentJobId: 'p1' }))).toEqual([]);
    expect(reconcileOptions(job({ jobId: 'j1', state: 'needs-reconciliation', submitter: { kind: 'node', id: 'n1' } }))).toEqual(['discard']);
  });

  it('rewrite: failed or cancelled, output exists, the most recent apply was not committed', () => {
    const done = { jobId: 'j1', result: { documentId: null, artifactId: 'art1' } };
    expect(reconcileOptions(job({ ...done, state: 'failed', applications: [application('stale-input')] }))).toEqual(['apply']);
    expect(reconcileOptions(job({ ...done, state: 'cancelled', applications: [application('committed'), application('cancelled')] }))).toEqual([
      'apply',
    ]);
    expect(reconcileOptions(job({ ...done, state: 'failed', applications: [application('committed')] }))).toEqual([]);
    expect(reconcileOptions(job({ ...done, state: 'failed' }))).toEqual([]);
    expect(reconcileOptions(job({ jobId: 'j1', state: 'failed', applications: [application('rejected')] }))).toEqual([]);
  });

  it('completed or running tasks have no choices to make', () => {
    expect(reconcileOptions(job({ jobId: 'j1', state: 'completed' }))).toEqual([]);
    expect(reconcileOptions(job({ jobId: 'j1', state: 'running' }))).toEqual([]);
  });

  it('only online and agent provider retries are billed again', () => {
    expect(chargesOnRetry({ providerId: 'openai' })).toBe(true);
    expect(chargesOnRetry({ providerId: 'agent:codex' })).toBe(true);
    expect(chargesOnRetry({ providerId: 'local' })).toBe(false);
    expect(chargesOnRetry({ providerId: 'node:mac-mini' })).toBe(false);
  });
});

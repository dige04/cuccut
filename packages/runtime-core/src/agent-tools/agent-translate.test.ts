import { describe, expect, it } from 'vitest';
import type { Conversation, JobRecord, JobState, SequencedEvent, TasksEvent } from '@cuccut/protocol';
import type { Harness } from '@cuccut/harness';
import type { HostedJob, HostedJobControl, JobManager } from '@cuccut/jobs';
import type { VideoService } from '../videos/video-service.ts';
import { AgentScope } from './agent-scope.ts';

/**
 * Progress records for the agent's own translation (`documents_read`'s translateTo): register, reuse, complete when the translation is written, and wrap up when the turn ends. Harness and JobManager are fakes; only `agentRun`, `conversationOf`, `subscribe` and `host` are needed.
 */

const conversation = { id: 'conv_1', cwd: '/tmp/x', projectId: null, driverId: 'codex' } as unknown as Conversation;

function setup() {
  let taskId = 'task_1';
  let listener: ((event: SequencedEvent<unknown>) => void) | null = null;
  const harness = {
    agentRun: () => ({ taskId, stopRequested: false, mode: 'auto', conversation }),
    conversationOf: () => conversation,
    subscribe: (_topic: string, _after: unknown, l: (event: SequencedEvent<unknown>) => void) => {
      listener = l;
      return { result: { mode: 'snapshot' }, unsubscribe: () => {} };
    },
  } as unknown as Harness;
  const hosted: { record: JobRecord; control: HostedJobControl; options: { hosted: string } }[] = [];
  const jobs = {
    host(record: JobRecord, options: { hosted: string; control: HostedJobControl }): HostedJob {
      const entry = { record: structuredClone(record), control: options.control, options };
      hosted.push(entry);
      return {
        jobId: record.jobId,
        record: () => structuredClone(entry.record),
        update: (patch) => Object.assign(entry.record, patch),
        finish: async (state: JobState, patch = {}) => {
          if (!['running', 'queued'].includes(entry.record.state)) return;
          Object.assign(entry.record, { state, endedAt: 'now' }, patch);
        },
      };
    },
  } as unknown as JobManager;
  const scope = new AgentScope({ harness, videos: {} as VideoService, jobs });
  const access = () => scope.authorize({ kind: 'agent', conversationId: conversation.id } as never, true);
  const emit = (event: TasksEvent) => listener?.({ seq: '1' as never, event });
  return {
    scope,
    access,
    hosted,
    emit,
    nextTask: (id: string) => {
      taskId = id;
    },
  };
}

const zh = { videoId: 'video_1', sourceDocumentId: 'doc_speech', language: 'zh-Hans' };

describe('progress records for the agent\'s own translation', () => {
  it('registers one agentTranslate managed record; the same scope in the same turn reuses it', () => {
    const { scope, access, hosted } = setup();
    const jobId = scope.translationStarted(access(), { ...zh, sentences: 42, sourceRevision: '3' });
    expect(jobId).toBeTruthy();
    expect(hosted).toHaveLength(1);
    expect(hosted[0]!.options.hosted).toBe('agent-translate');
    expect(hosted[0]!.record).toMatchObject({
      jobId,
      kind: 'agentTranslate',
      state: 'running',
      phase: 'generating',
      progress: null,
      videoId: 'video_1',
      submitter: { kind: 'agent', id: 'conv_1', taskId: 'task_1' },
      translation: { sourceDocumentId: 'doc_speech', targetLanguage: 'zh-Hans', sentences: 42 },
    });
    expect(scope.translationStarted(access(), { ...zh, sentences: 42 })).toBe(jobId);
    expect(hosted).toHaveLength(1);
    // Another language is another record.
    expect(scope.translationStarted(access(), { ...zh, language: 'ja', sentences: 42 })).not.toBe(jobId);
    expect(hosted).toHaveLength(2);
  });

  it('completes when a translation in this language is written, with the result pointing to the translation; other languages are unaffected', async () => {
    const { scope, access, hosted } = setup();
    scope.translationStarted(access(), { ...zh, sentences: 3 });
    scope.translationStarted(access(), { ...zh, language: 'ja', sentences: 3 });
    scope.translationWritten(access(), { ...zh, language: 'ZH-hans', documentId: 'doc_tr' });
    await Promise.resolve();
    expect(hosted[0]!.record.state).toBe('completed');
    expect(hosted[0]!.record.result).toEqual({ documentId: 'doc_tr', artifactId: '' });
    expect(hosted[1]!.record.state).toBe('running');
  });

  it('turn ends with nothing written: user-stopped is recorded as cancelled, others as interrupted; another task ending does not touch it', async () => {
    const { scope, access, hosted, emit, nextTask } = setup();
    scope.translationStarted(access(), { ...zh, sentences: 3 });
    const task = (taskId: string, status: 'running' | 'completed' | 'stopped') =>
      ({ taskId, status }) as unknown as Extract<TasksEvent, { type: 'task.upsert' }>['task'];
    emit({ type: 'task.upsert', task: task('task_other', 'completed') });
    emit({ type: 'task.upsert', task: task('task_1', 'running') });
    expect(hosted[0]!.record.state).toBe('running');
    emit({ type: 'task.upsert', task: task('task_1', 'stopped') });
    await Promise.resolve();
    expect(hosted[0]!.record.state).toBe('cancelled');

    nextTask('task_2');
    scope.translationStarted(access(), { ...zh, sentences: 3 });
    emit({ type: 'task.upsert', task: task('task_2', 'completed') });
    await Promise.resolve();
    expect(hosted[1]!.record.state).toBe('interrupted');
    // Writing after wrap-up does not change an already finished record.
    scope.translationWritten(access(), { ...zh, documentId: 'doc_tr' });
    expect(hosted[1]!.record.state).toBe('interrupted');
  });

  it('the next turn continues translating the same scope: the record left by the previous turn is interrupted and registered again', async () => {
    const { scope, access, hosted, nextTask } = setup();
    const first = scope.translationStarted(access(), { ...zh, sentences: 3 });
    nextTask('task_2');
    const second = scope.translationStarted(access(), { ...zh, sentences: 3 });
    await Promise.resolve();
    expect(second).not.toBe(first);
    expect(hosted[0]!.record.state).toBe('interrupted');
    expect(hosted[1]!.record.submitter).toMatchObject({ taskId: 'task_2' });
  });

  it('JobManager cancel or Runtime stop: ends only this record', async () => {
    const { scope, access, hosted } = setup();
    scope.translationStarted(access(), { ...zh, sentences: 3 });
    hosted[0]!.control.cancel();
    await Promise.resolve();
    expect(hosted[0]!.record.state).toBe('cancelled');
    scope.translationStarted(access(), { ...zh, sentences: 3 });
    hosted[1]!.control.interrupt();
    await Promise.resolve();
    expect(hosted[1]!.record.state).toBe('interrupted');
  });
});

import { describe, expect, it } from 'vitest';
import type { TimelineItem } from '@cuccut/protocol';
import { adoptRestoredRuns, agentRunState, currentConversation, mergeDraft, messageCount, planHandoff } from './ai-tools-handoff.ts';

const at = (id: string, projectId: string | null, updatedAt: string, archived = false) => ({ id, projectId, title: id, archived, updatedAt });
const conversations = [
  at('c1', 'p1', '2026-10-01T00:00:00Z'),
  at('c4', 'p1', '2026-10-05T00:00:00Z'),
  at('c5', 'p1', '2026-10-08T00:00:00Z', true),
  at('c2', 'p2', '2026-10-09T00:00:00Z'),
  at('c3', null, '2026-10-02T00:00:00Z'),
];
const inProject = { projectId: 'p1', conversationId: null };
const outside = { projectId: null, conversationId: 'c3' };

describe('which session \'continue\' refers to', () => {
  it('currently in a session of the same project: that one, even if not the most recent or if archived', () => {
    expect(currentConversation({ source: inProject, current: 'c1', conversations })?.id).toBe('c1');
    expect(currentConversation({ source: inProject, current: 'c5', conversations })?.id).toBe('c5');
  });

  it('current session is in another project, not in a session, or just deleted: the most recently updated, non-archived one in this project', () => {
    expect(currentConversation({ source: inProject, current: 'c2', conversations })?.id).toBe('c4');
    expect(currentConversation({ source: inProject, current: null, conversations })?.id).toBe('c4');
    expect(currentConversation({ source: inProject, current: 'gone', conversations })?.id).toBe('c4');
    expect(currentConversation({ source: { projectId: 'p9', conversationId: null }, current: null, conversations })).toBeNull();
  });

  it('video is in the directory of a session with no project: that one; none if it is gone', () => {
    expect(currentConversation({ source: outside, current: 'c1', conversations })?.id).toBe('c3');
    expect(currentConversation({ source: { projectId: null, conversationId: 'gone' }, current: null, conversations })).toBeNull();
    expect(currentConversation({ source: null, current: 'c1', conversations })).toBeNull();
  });

  it('sessions sharing the working directory with that session also count: when currently in one of them, it is that one; otherwise the most recently updated non-archived one; if all are archived, it is the one where the video is', () => {
    const family = [
      ...conversations,
      { ...at('c6', null, '2026-10-04T00:00:00Z'), folderOf: 'c3' },
      { ...at('c7', null, '2026-10-09T00:00:00Z', true), folderOf: 'c3' },
    ];
    expect(currentConversation({ source: outside, current: 'c1', conversations: family })?.id).toBe('c6');
    expect(currentConversation({ source: outside, current: 'c7', conversations: family })?.id).toBe('c7');
    expect(currentConversation({ source: outside, current: 'c3', conversations: family })?.id).toBe('c3');
    const archived = [at('c3', null, '2026-10-02T00:00:00Z', true), { ...at('c6', null, '2026-10-04T00:00:00Z', true), folderOf: 'c3' }];
    expect(currentConversation({ source: outside, current: null, conversations: archived })?.id).toBe('c3');
  });
});

describe('where the handoff to the Agent is sent', () => {
  it('a new session is created in the video\'s project; when the video is not in a project, it shares the working directory of the session it is in, and if that session is gone the handoff fails', () => {
    expect(planHandoff({ session: 'new', source: inProject, conversations })).toEqual({ kind: 'create', projectId: 'p1' });
    expect(planHandoff({ session: 'new', source: outside, conversations })).toEqual({ kind: 'create', projectId: null, folderOf: 'c3' });
    expect(planHandoff({ session: 'new', source: { projectId: null, conversationId: 'gone' }, conversations })).toEqual({ kind: 'none' });
    expect(planHandoff({ session: 'new', source: null, conversations })).toEqual({ kind: 'none' });
  });

  it('the session being continued must still exist', () => {
    expect(planHandoff({ session: { id: 'c4' }, source: inProject, conversations })).toEqual({ kind: 'existing', conversationId: 'c4' });
    expect(planHandoff({ session: { id: 'gone' }, source: inProject, conversations })).toEqual({ kind: 'none' });
  });

  it('message count counts only spoken messages', () => {
    expect(messageCount([{ kind: 'user-message' }, { kind: 'reasoning' }, { kind: 'tool-call' }, { kind: 'agent-message' }, { kind: 'task' }])).toBe(2);
    expect(messageCount([])).toBe(0);
  });
});

describe('draft filled into the input box', () => {
  it('when the input is empty: just this sentence', () => {
    expect(mergeDraft(undefined, '润色。')).toBe('润色。');
    expect(mergeDraft('  ', ' 润色。 ')).toBe('润色。');
  });

  it('when the input has text: appended, not overwritten; the same sentence is not filled twice', () => {
    expect(mergeDraft('先看看第 2 章 ', '润色。')).toBe('先看看第 2 章\n\n润色。');
    expect(mergeDraft('先看看\n\n润色。', '润色。')).toBe('先看看\n\n润色。');
  });

  it('nothing to fill: left as-is', () => {
    expect(mergeDraft('写了一半', '')).toBe('写了一半');
  });
});

describe('tool page that stays put: how far the handed-off run has got', () => {
  const base = { createdAt: '2026-10-10T08:00:00Z' };
  const task = (id: string, status: 'running' | 'completed' | 'failed' | 'stopped', startedAt = '2026-10-10T08:00:00Z') =>
    ({ ...base, kind: 'task', id, taskId: id, goal: 'x', status, startedAt, endedAt: null, error: status === 'failed' ? '没连上' : null }) as TimelineItem;
  const call = (taskId: string, title: string) =>
    ({ ...base, kind: 'tool-call', id: `call-${title}`, taskId, tool: 'command', title, detail: null, output: '', status: 'completed', exitCode: 0, durationMs: 1 }) as TimelineItem;
  const approval = (taskId: string, status: 'pending' | 'accepted') =>
    ({ ...base, kind: 'approval', id: `ap-${status}`, taskId, approvalId: 'a1', request: { kind: 'command', command: 'ccut cleanup', cwd: null, reason: null }, status, decidedAt: null }) as TimelineItem;
  const handedAt = '2026-10-10T08:00:00Z';

  it('timeline not read yet or task not yet appeared: starting', () => {
    expect(agentRunState({ taskId: 't1', handedAt, items: undefined })).toEqual({ kind: 'starting' });
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t0', 'completed')] })).toEqual({ kind: 'starting' });
  });

  it('running: the latest step title; a pending approval means waiting for release, and it resumes once approved', () => {
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'running'), call('t1', '读文稿'), call('t1', '找停顿')] })).toEqual({
      kind: 'running',
      step: '找停顿',
    });
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'running'), call('t1', '读文稿'), approval('t1', 'pending')] })).toEqual({
      kind: 'waiting',
      step: '读文稿',
    });
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'running'), approval('t1', 'accepted')] })).toEqual({ kind: 'running', step: null });
  });

  it('steps and approvals of other tasks do not count', () => {
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t0', 'running'), approval('t0', 'pending'), task('t1', 'running')] })).toEqual({
      kind: 'running',
      step: null,
    });
  });

  it('when the task ends, follows its status', () => {
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'completed')] })).toEqual({ kind: 'done' });
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'stopped')] })).toEqual({ kind: 'stopped' });
    expect(agentRunState({ taskId: 't1', handedAt, items: [task('t1', 'failed')] })).toEqual({ kind: 'failed', error: '没连上', errorRef: null });
  });

  it('queued with no task number: recognizes the first task started after the handoff, not an earlier run of the same sentence', () => {
    const items = [task('t0', 'completed', '2026-10-10T07:00:00Z'), task('t1', 'running', '2026-10-10T08:00:05Z'), task('t2', 'completed', '2026-10-10T08:10:00Z')];
    expect(agentRunState({ taskId: null, handedAt, items })).toEqual({ kind: 'running', step: null });
    expect(agentRunState({ taskId: null, handedAt, items: items.slice(0, 1) })).toEqual({ kind: 'starting' });
  });
});

describe('after restart, reattaches to the run still in progress', () => {
  const conversations = [
    { id: 'c1', activeTaskId: 't1' },
    { id: 'c2', activeTaskId: null },
    { id: 'c3', activeTaskId: 't9' },
  ];
  const none = () => false;

  it('task still running: reattach and drop \'restored\'; finished, task changed, or session gone: dropped', () => {
    const runs = {
      live: { conversationId: 'c1', taskId: 't1', restored: true },
      done: { conversationId: 'c2', taskId: 't2', restored: true },
      other: { conversationId: 'c3', taskId: 't3', restored: true },
      gone: { conversationId: 'c4', taskId: 't4', restored: true },
    };
    expect(adoptRestoredRuns(runs, { ready: true, conversations, queued: none })).toEqual({ live: { conversationId: 'c1', taskId: 't1' } });
  });

  it('queued with no task number: reattaches if the session is busy or the message is still in the queue', () => {
    const runs = {
      busy: { conversationId: 'c3', taskId: null, restored: true },
      waiting: { conversationId: 'c2', taskId: null, restored: true },
      idle: { conversationId: 'c2', taskId: null, restored: true },
    };
    const adopted = adoptRestoredRuns({ busy: runs.busy, idle: runs.idle }, { ready: true, conversations, queued: none });
    expect(adopted).toEqual({ busy: { conversationId: 'c3', taskId: null } });
    expect(adoptRestoredRuns({ waiting: runs.waiting }, { ready: true, conversations, queued: (id) => id === 'c2' })).toEqual({
      waiting: { conversationId: 'c2', taskId: null },
    });
  });

  it('directory not read yet, or nothing left from last time: returned as-is', () => {
    const restored = { a: { conversationId: 'c2', taskId: 't2', restored: true } };
    expect(adoptRestoredRuns(restored, { ready: false, conversations, queued: none })).toBe(restored);
    const fresh = { a: { conversationId: 'c2', taskId: 't2' } };
    expect(adoptRestoredRuns(fresh, { ready: true, conversations, queued: none })).toBe(fresh);
  });
});

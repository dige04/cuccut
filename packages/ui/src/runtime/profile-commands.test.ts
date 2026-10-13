import { afterEach, describe, expect, it } from 'vitest';
import type { InterviewState, ProfileRule, ProfileSnapshot, ProjectProfile } from '@cuccut/protocol';
import { emptyProfile, useProfile } from '../state/profile-store.ts';
import {
  PROFILE_WRITE_TIMEOUT_MS,
  loadProjectProfile,
  putRule,
  refreshProjectProfile,
  removeInterviewSection,
  removeRule,
  reorderRules,
  resetProfileCommands,
  saveAnswers,
  setPreferences,
  setProjectPreferences,
  writeFromAnswers,
} from './profile-commands.ts';
import type { RuntimeSession } from './session.ts';

function rule(id: string, order: number, patch: Partial<ProfileRule> = {}): ProfileRule {
  return { id, name: id, when: 'w', instruction: 'i', templateId: null, stage: 'any', order, enabled: true, note: '', source: null, ...patch };
}

const interview = (patch: Partial<InterviewState> = {}): InterviewState => ({
  status: 'pending',
  reminder: true,
  answers: {},
  remaining: ['who', 'record', 'platforms', 'annoys', 'names'],
  writtenAt: null,
  usedAgent: null,
  namesGlossaryId: null,
  ...patch,
});

function snapshot(patch: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return { interview: interview(), preferences: { own: '', interview: '' }, hasPreferences: false, rules: [], writing: null, readOnly: false, ...patch };
}

/** Fake session: only `client.request`, answering by method name and recording each call with its options. */
function fakeSession(answer: (method: string, params: Record<string, unknown>) => unknown) {
  const calls: { method: string; params: Record<string, unknown>; options?: { timeoutMs?: number } }[] = [];
  const session = {
    client: {
      request: async (method: string, params: Record<string, unknown>, options?: { timeoutMs?: number }) => {
        calls.push({ method, params, ...(options ? { options } : {}) });
        return answer(method, params);
      },
    },
  } as unknown as Pick<RuntimeSession, 'client'>;
  return { session, calls };
}

afterEach(() => {
  resetProfileCommands();
  useProfile.setState(emptyProfile());
});

describe('profile mirror', () => {
  it('takes the snapshot, then events: a whole new snapshot, or only the writing progress', () => {
    const store = useProfile.getState();
    store.apply({ type: 'profile.writing', writing: { startedAt: 't', lines: [] } });
    expect(useProfile.getState().ready).toBe(false);
    store.replace(snapshot());
    expect(useProfile.getState()).toMatchObject({ ready: true, writing: null });
    store.apply({ type: 'profile.writing', writing: { startedAt: 't', lines: ['reading answers'] } });
    expect(useProfile.getState().writing?.lines).toEqual(['reading answers']);
    expect(useProfile.getState().snapshot?.writing?.lines).toEqual(['reading answers']);
    store.apply({ type: 'profile.updated', snapshot: snapshot({ hasPreferences: true, preferences: { own: 'Short hooks.', interview: '' } }) });
    expect(useProfile.getState()).toMatchObject({ writing: null, snapshot: { hasPreferences: true } });
    const before = useProfile.getState().snapshot;
    store.apply({ type: 'profile.projectUpdated', projectId: 'p1' });
    expect(useProfile.getState().snapshot).toBe(before);
  });
});

describe('interview commands', () => {
  it('saves answers with a command id and writes the returned state into the mirror', async () => {
    useProfile.getState().replace(snapshot());
    const saved = interview({ answers: { who: 'streams' }, remaining: ['record', 'platforms', 'annoys', 'names'] });
    const { session, calls } = fakeSession(() => saved);
    await saveAnswers(session, { who: 'streams' });
    expect(calls[0]).toMatchObject({ method: 'profile.saveAnswers', params: { answers: { who: 'streams' } } });
    expect(typeof calls[0]!.params.commandId).toBe('string');
    expect(useProfile.getState().snapshot?.interview.answers).toEqual({ who: 'streams' });
  });

  it('writes from the answers with the long timeout', async () => {
    const { session, calls } = fakeSession(() => ({ preferences: '- a', names: [], usedAgent: false, fallbackReason: 'no-agent' }));
    const result = await writeFromAnswers(session);
    expect(result.fallbackReason).toBe('no-agent');
    expect(calls[0]).toEqual({ method: 'profile.writeFromAnswers', params: {}, options: { timeoutMs: PROFILE_WRITE_TIMEOUT_MS } });
    expect(PROFILE_WRITE_TIMEOUT_MS).toBe(240_000);
  });
});

describe('preferences', () => {
  it('replaces the mirror with the returned snapshot; removing the interview section can be undone with the same text', async () => {
    useProfile.getState().replace(snapshot({ hasPreferences: true, preferences: { own: '', interview: '- Short hooks' } }));
    let current = useProfile.getState().snapshot!;
    const { session, calls } = fakeSession((method, params) => {
      if (method !== 'profile.setPreferences') throw new Error(method);
      const preferences = { ...current.preferences, ...(params as { own?: string; interview?: string }) };
      current = { ...current, preferences, hasPreferences: !!(preferences.own || preferences.interview) };
      return current;
    });
    const { removed, undo } = await removeInterviewSection(session);
    expect(removed).toBe('- Short hooks');
    expect(useProfile.getState().snapshot?.preferences.interview).toBe('');
    await undo();
    expect(useProfile.getState().snapshot?.preferences.interview).toBe('- Short hooks');
    await setPreferences(session, { own: 'Mine' });
    expect(calls.map((c) => c.params)).toEqual([{ interview: '' }, { interview: '- Short hooks' }, { own: 'Mine' }]);
    expect(useProfile.getState().snapshot?.preferences).toEqual({ own: 'Mine', interview: '- Short hooks' });
  });

  it('a project’s text goes to that project only', async () => {
    const project: ProjectProfile = { projectId: 'p1', preferences: 'Vertical only.', rules: [], readOnly: false };
    const { session, calls } = fakeSession(() => project);
    await setProjectPreferences(session, 'p1', 'Vertical only.');
    expect(calls[0]!.params).toEqual({ projectId: 'p1', own: 'Vertical only.' });
    expect(useProfile.getState().projects.p1).toEqual({ status: 'ready', profile: project, error: null });
  });
});

describe('rules', () => {
  it('a put rule lands in order; a deleted one comes back with Undo at the same place, without the reserved field', async () => {
    useProfile.getState().replace(snapshot({ rules: [rule('a', 10), rule('c', 30)] }));
    const { session, calls } = fakeSession((method, params) => {
      if (method === 'profile.putRule') {
        const input = params.rule as Omit<ProfileRule, 'source'>;
        return { rule: { ...rule(input.id, input.order ?? 40), ...input, source: null }, warnings: [] };
      }
      if (method === 'profile.removeRule') return { removed: rule('a', 10, { note: 'mine', enabled: false }) };
      throw new Error(method);
    });

    await putRule(session, { id: 'b', name: 'b', when: 'w', instruction: 'i', order: 20 });
    expect(useProfile.getState().snapshot?.rules.map((r) => r.id)).toEqual(['a', 'b', 'c']);

    const { removed, undo } = await removeRule(session, 'a');
    expect(removed.id).toBe('a');
    expect(useProfile.getState().snapshot?.rules.map((r) => r.id)).toEqual(['b', 'c']);

    await undo();
    const putBack = calls.at(-1)!;
    expect(putBack.method).toBe('profile.putRule');
    expect(putBack.params).toEqual({
      rule: { id: 'a', name: 'a', when: 'w', instruction: 'i', templateId: null, stage: 'any', order: 10, enabled: false, note: 'mine' },
    });
    expect(useProfile.getState().snapshot?.rules.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('reorders in one call and takes the renumbered list', async () => {
    useProfile.getState().replace(snapshot({ rules: [rule('a', 10), rule('b', 20)] }));
    const { session, calls } = fakeSession(() => ({ rules: [rule('b', 10), rule('a', 20)] }));
    await reorderRules(session, ['b', 'a']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params).toEqual({ ids: ['b', 'a'] });
    expect(useProfile.getState().snapshot?.rules.map((r) => [r.id, r.order])).toEqual([
      ['b', 10],
      ['a', 20],
    ]);
  });

  it('project rules go with the project id and change only that project', async () => {
    useProfile.getState().replace(snapshot({ rules: [rule('w', 10)] }));
    useProfile.getState().projectLoaded({ projectId: 'p1', preferences: '', rules: [rule('x', 10)], readOnly: false });
    const { session, calls } = fakeSession((method) => (method === 'profile.removeRule' ? { removed: rule('x', 10) } : null));
    await removeRule(session, 'x', 'p1');
    expect(calls[0]!.params).toEqual({ id: 'x', projectId: 'p1' });
    expect(useProfile.getState().projects.p1?.profile?.rules).toEqual([]);
    expect(useProfile.getState().snapshot?.rules.map((r) => r.id)).toEqual(['w']);
  });

  it('a failed command leaves the mirror alone and hands the error to the caller', async () => {
    useProfile.getState().replace(snapshot({ rules: [rule('a', 10)] }));
    const { session } = fakeSession(() => {
      throw new Error('Name: is required');
    });
    await expect(putRule(session, { name: '', when: '' })).rejects.toThrow('Name: is required');
    expect(useProfile.getState().snapshot?.rules.map((r) => r.id)).toEqual(['a']);
  });
});

describe('project level', () => {
  it('fetches once while in flight, keeps the last profile on failure, and refreshes only projects asked for', async () => {
    const project: ProjectProfile = { projectId: 'p1', preferences: 'x', rules: [], readOnly: false };
    let fail = false;
    const { session, calls } = fakeSession(() => {
      if (fail) throw new Error('gone');
      return project;
    });
    await Promise.all([loadProjectProfile(session, 'p1'), loadProjectProfile(session, 'p1')]);
    expect(calls).toHaveLength(1);
    expect(useProfile.getState().projects.p1).toMatchObject({ status: 'ready', profile: project });

    fail = true;
    await loadProjectProfile(session, 'p1');
    expect(useProfile.getState().projects.p1).toEqual({ status: 'failed', profile: project, error: 'gone' });

    refreshProjectProfile(session, 'p2');
    expect(calls).toHaveLength(2);
    fail = false;
    refreshProjectProfile(session, 'p1');
    expect(calls).toHaveLength(3);
  });
});

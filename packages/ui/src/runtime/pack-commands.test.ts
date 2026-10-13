import { afterEach, describe, expect, it } from 'vitest';
import type { PackChangeResult, PackDetail, PackListResult, PackPreview, PackRemoveResult, PackSummary } from '@cuccut/protocol';
import { emptyPacks, usePacks } from '../state/packs-store.ts';
import { emptySkills, useSkills } from '../state/skills-store.ts';
import { emptyTemplateCatalog, useTemplateCatalog } from '../state/template-catalog-store.ts';
import {
  activePackStyle,
  choosePackStyle,
  clearPackPreview,
  getPack,
  inspectPack,
  installPack,
  loadPacks,
  removePack,
  resetPackCommands,
  restorePack,
  setPackStyle,
} from './pack-commands.ts';
import type { RuntimeSession } from './session.ts';
import { resetSkillCommands } from './skill-commands.ts';
import { resetTemplateCommands } from './template-commands.ts';

function summary(id: string, patch: Partial<PackSummary> = {}): PackSummary {
  return {
    id,
    name: id,
    version: '1.0.0',
    description: '',
    author: '',
    license: '',
    source: { kind: 'local', path: `/packs/${id}` },
    installedAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    counts: { templates: 1, skills: 1, library: 0, examples: 0, quickActions: 0 },
    hasStyle: false,
    quickActions: [],
    provides: { templates: [], skills: [] },
    path: `/home/packs/${id}`,
    ...patch,
  };
}

const list = (...packs: PackSummary[]): PackListResult => ({ packs, diagnostics: [] });

/** Fake session: answers by method name and records each call. The template and skill lists answer empty. */
function fakeSession(answer: (method: string, params: Record<string, unknown>) => unknown) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const session = {
    client: {
      request: async (method: string, params: Record<string, unknown>) => {
        calls.push({ method, params });
        if (method === 'templates.list') return { templates: [], diagnostics: [] };
        if (method === 'skills.list') return { skills: [], diagnostics: [] };
        return answer(method, params);
      },
    },
  } as unknown as Pick<RuntimeSession, 'client'>;
  return { session, calls, methods: () => calls.map((c) => c.method) };
}

const preview = { token: 'tok_1', manifest: { id: 'news-desk', name: 'News desk' } } as unknown as PackPreview;

afterEach(() => {
  resetPackCommands();
  resetSkillCommands();
  resetTemplateCommands();
  usePacks.setState(emptyPacks());
  useSkills.setState(emptySkills());
  useTemplateCatalog.setState(emptyTemplateCatalog());
});

describe('the pack list', () => {
  it('sends one request however often it is asked for at once, and keeps it sorted by name', async () => {
    const result: PackListResult = {
      packs: [summary('zeta', { name: 'Zeta' }), summary('alpha', { name: 'Alpha' })],
      diagnostics: [{ dir: 'broken', path: '/home/packs/broken', message: 'unreadable', issues: [] }],
    };
    const { session, calls } = fakeSession(() => result);
    await Promise.all([loadPacks(session), loadPacks(session)]);
    expect(calls).toHaveLength(1);
    const state = usePacks.getState();
    expect(state).toMatchObject({ status: 'ready', loaded: true, error: null });
    expect(state.packs.map((p) => p.id)).toEqual(['alpha', 'zeta']);
    expect(state.diagnostics).toEqual(result.diagnostics);
  });

  it('a failed fetch keeps the list it had and records the error; the next one asks again', async () => {
    usePacks.getState().succeed(list(summary('a')));
    const { session, calls } = fakeSession(() => {
      throw new Error('offline');
    });
    await loadPacks(session);
    expect(usePacks.getState()).toMatchObject({ status: 'failed', loaded: true, error: 'offline' });
    expect(usePacks.getState().packs.map((p) => p.id)).toEqual(['a']);
    await loadPacks(session);
    expect(calls).toHaveLength(2);
  });
});

describe('inspect and install', () => {
  it('inspect keeps the preview and ends the last notice; install takes its token, writes the list back, says so once and reloads templates and skills', async () => {
    usePacks.getState().setNotice({ kind: 'exported', dir: '/x' });
    const installed: PackChangeResult = { pack: summary('news-desk', { name: 'News desk' }), skipped: [], ...list(summary('news-desk', { name: 'News desk' })) };
    const { session, calls, methods } = fakeSession((method) => {
      if (method === 'packs.inspect') return preview;
      if (method === 'packs.install') return installed;
      throw new Error(method);
    });

    const read = await inspectPack(session, '  ~/Packs/news-desk  ');
    expect(read).toBe(preview);
    expect(usePacks.getState().preview).toBe(preview);
    expect(usePacks.getState().notice).toBeNull();
    expect(calls[0]!.params).toMatchObject({ source: '~/Packs/news-desk' });
    expect(typeof calls[0]!.params.commandId).toBe('string');

    await installPack(session, preview, true);
    const install = calls.find((c) => c.method === 'packs.install')!;
    expect(install.params).toMatchObject({ token: 'tok_1', replace: true });
    expect(typeof install.params.commandId).toBe('string');
    const state = usePacks.getState();
    expect(state.packs.map((p) => p.id)).toEqual(['news-desk']);
    expect(state.preview).toBeNull();
    expect(state.notice).toEqual({ kind: 'installed', name: 'News desk' });
    await Promise.resolve();
    expect(methods()).toEqual(expect.arrayContaining(['templates.list', 'skills.list']));
  });

  it('a refused install leaves the list and the preview as they were; the error goes to the caller', async () => {
    usePacks.getState().succeed(list(summary('a')));
    usePacks.getState().setPreview(preview);
    const { session, methods } = fakeSession(() => {
      throw new Error('blocked');
    });
    await expect(installPack(session, preview)).rejects.toThrow('blocked');
    expect(usePacks.getState().packs.map((p) => p.id)).toEqual(['a']);
    expect(usePacks.getState().preview).toBe(preview);
    expect(methods()).toEqual(['packs.install']);
  });

  it('a refused read leaves no preview; cancel forgets one', async () => {
    usePacks.getState().setPreview(preview);
    const { session } = fakeSession(() => {
      throw new Error('PACK_INVALID');
    });
    await expect(inspectPack(session, '/nope')).rejects.toThrow('PACK_INVALID');
    expect(usePacks.getState().preview).toBeNull();
    usePacks.getState().setPreview(preview);
    clearPackPreview();
    expect(usePacks.getState().preview).toBeNull();
  });
});

describe('remove and restore', () => {
  it('remove writes the list back and returns the Undo; restore brings it back; both reload templates and skills', async () => {
    usePacks.getState().succeed(list(summary('a'), summary('b')));
    usePacks.getState().setNotice({ kind: 'installed', name: 'a' });
    const removed: PackRemoveResult = { removed: { id: 'a', name: 'a' }, trashId: 'trash_1', kept: [], moved: { templates: 1, skills: 1 }, ...list(summary('b')) };
    const restored: PackChangeResult = { pack: summary('a'), skipped: [], ...list(summary('a'), summary('b')) };
    const { session, calls, methods } = fakeSession((method) => {
      if (method === 'packs.remove') return removed;
      if (method === 'packs.restore') return restored;
      throw new Error(method);
    });

    const result = await removePack(session, 'a');
    expect(result.trashId).toBe('trash_1');
    expect(usePacks.getState().packs.map((p) => p.id)).toEqual(['b']);
    expect(usePacks.getState().notice).toBeNull();

    await restorePack(session, 'trash_1');
    expect(usePacks.getState().packs.map((p) => p.id)).toEqual(['a', 'b']);
    expect(calls.find((c) => c.method === 'packs.remove')!.params).toEqual({ id: 'a' });
    expect(calls.find((c) => c.method === 'packs.restore')!.params).toEqual({ trashId: 'trash_1' });
    expect(methods().filter((m) => m === 'templates.list' || m === 'skills.list').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the pack page and the style guide', () => {
  it('get, active and choose pass their parameters through', async () => {
    const { session, calls } = fakeSession((method) => {
      if (method === 'packs.get') return { pack: summary('a') };
      if (method === 'packs.active') return { pack: null, reason: 'no-guide' };
      if (method === 'packs.choose') return { choice: 'none', active: { pack: null, reason: 'chosen-none' } };
      throw new Error(method);
    });
    await getPack(session, 'a');
    await activePackStyle(session, { conversationId: 'c1' });
    await activePackStyle(session, { projectId: 'p1' });
    const chosen = await choosePackStyle(session, 'p1', 'none');
    expect(chosen.active.reason).toBe('chosen-none');
    await choosePackStyle(session, 'p1', null);
    expect(calls.map((c) => [c.method, c.params])).toEqual([
      ['packs.get', { id: 'a' }],
      ['packs.active', { conversationId: 'c1' }],
      ['packs.active', { projectId: 'p1' }],
      ['packs.choose', { projectId: 'p1', pack: 'none' }],
      ['packs.choose', { projectId: 'p1', pack: null }],
    ]);
  });

  it('saving the guide updates that pack in the list in place', async () => {
    usePacks.getState().succeed(list(summary('a'), summary('b')));
    const detail = { pack: summary('a', { hasStyle: true }) } as PackDetail;
    const { session, calls } = fakeSession(() => detail);
    await setPackStyle(session, 'a', 'Keep it short.', 'hash_1');
    await setPackStyle(session, 'a', 'Keep it short.');
    expect(calls[0]!.params).toEqual({ id: 'a', text: 'Keep it short.', expectedHash: 'hash_1' });
    expect(calls[1]!.params).toEqual({ id: 'a', text: 'Keep it short.' });
    expect(usePacks.getState().packs.find((p) => p.id === 'a')?.hasStyle).toBe(true);
    expect(usePacks.getState().packs.find((p) => p.id === 'b')?.hasStyle).toBe(false);
  });
});

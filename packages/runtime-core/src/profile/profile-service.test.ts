import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RpcError, type ProfileEvent, type Project, type TranscriptionGlossary } from '@cuccut/protocol';
import { projectProfilePath } from '@cuccut/runtime-storage';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import { ProfileService } from './profile-service.ts';
import { profileMethods } from './profile-methods.ts';

async function rejection(promise: Promise<unknown> | (() => unknown)): Promise<RpcError> {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}
const codeOf = (error: RpcError) => (error.details as { code?: string } | undefined)?.code;

describe('ProfileService', () => {
  let dir: string;
  let file: string;
  let projectDir: string;
  let library: LibraryStore;
  let projects: Project[];
  let profile: ProfileService;
  let events: ProfileEvent[];
  let installed: Set<string>;

  async function open(): Promise<ProfileService> {
    const service = await ProfileService.open({
      home: { profileFile: file },
      library,
      projects: () => projects,
      installedTemplates: async () => installed,
      randomHex: () => '0a1b2c3d',
    });
    events = [];
    service.topic.subscribe(undefined, (e) => events.push(e.event));
    return service;
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-profile-service-'));
    file = path.join(dir, 'home', 'store', 'profile.json');
    projectDir = path.join(dir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    library = await LibraryStore.open({ dir: path.join(dir, 'home', 'library') });
    const now = new Date().toISOString();
    projects = [{ id: 'prj_1', name: 'Project', path: projectDir, createdAt: now, lastActiveAt: now, pinned: false, archived: false }];
    installed = new Set(['quote-card']);
    profile = await open();
  });

  afterEach(async () => {
    await profile.flush();
    await library.idle();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('starts pending with the reminder on and nothing written', () => {
    expect(profile.snapshot()).toEqual({
      interview: {
        status: 'pending',
        reminder: true,
        answers: {},
        remaining: ['who', 'record', 'platforms', 'annoys', 'names'],
        writtenAt: null,
        usedAgent: null,
        namesGlossaryId: null,
      },
      preferences: { own: '', interview: '' },
      hasPreferences: false,
      rules: [],
      writing: null,
      readOnly: false,
    });
  });

  describe('status semantics', () => {
    it('saving answers merges, trims, clears blanks and never changes the status', async () => {
      let state = await profile.saveAnswers({ who: '  Coding streams  ', record: 'Webcam' });
      expect(state).toMatchObject({ status: 'pending', answers: { who: 'Coding streams', record: 'Webcam' }, remaining: ['platforms', 'annoys', 'names'] });
      state = await profile.saveAnswers({ record: ' ', names: 'Deska' });
      expect(state.answers).toEqual({ who: 'Coding streams', names: 'Deska' });
      expect(state.status).toBe('pending');
    });

    it('an answer after a skip keeps the status skipped; skip keeps the answers; reopen restores them', async () => {
      await profile.saveAnswers({ who: 'me' });
      let state = await profile.skip();
      expect(state).toMatchObject({ status: 'skipped', answers: { who: 'me' } });
      state = await profile.saveAnswers({ record: 'streams' });
      expect(state.status).toBe('skipped');
      await profile.dismissReminder();
      state = await profile.reopen();
      expect(state).toMatchObject({ status: 'pending', reminder: true, answers: { who: 'me', record: 'streams' } });
      // And it survives a restart.
      await profile.flush();
      expect((await open()).interview()).toMatchObject({ status: 'pending', answers: { who: 'me', record: 'streams' } });
    });

    it('"Not now" turns the reminder off and nothing else', async () => {
      const state = await profile.dismissReminder();
      expect(state).toMatchObject({ status: 'pending', reminder: false });
    });
  });

  it('a write needs at least one answer (PROFILE_NO_ANSWERS); given answers merge over the saved ones', async () => {
    const none = await rejection(() => profile.answersForWrite());
    expect(none.code).toBe('invalid-request');
    expect(codeOf(none)).toBe('PROFILE_NO_ANSWERS');
    await profile.saveAnswers({ record: 'streams', names: 'Deska' });
    expect(profile.answersForWrite({ who: 'me', names: ' ' })).toEqual({ who: 'me', record: 'streams' });
    expect(Object.keys(profile.answersForWrite({ annoys: 'x', who: 'me' }))).toEqual(['who', 'record', 'annoys', 'names']);
  });

  it('a finished write sets done, keeps the section apart from the own text and fills the names glossary', async () => {
    await profile.setPreferences({ own: '- my own line' });
    const answers = profile.answersForWrite({ who: 'Coding streams', names: 'Deska, Claude' });
    const { snapshot, namesAdded } = await profile.completeWrite(answers, {
      preferences: '- Hooks under 3 seconds\n- Captions spell names right',
      names: [
        { term: 'Deska', misheard: [] },
        { term: 'Claude', misheard: ['clod'] },
      ],
      usedAgent: true,
    });
    expect(namesAdded).toEqual(['Deska', 'Claude']);
    expect(snapshot.interview).toMatchObject({ status: 'done', usedAgent: true, answers: { who: 'Coding streams', names: 'Deska, Claude' } });
    expect(snapshot.interview.writtenAt).not.toBeNull();
    expect(snapshot.preferences).toEqual({ own: '- my own line', interview: '- Hooks under 3 seconds\n- Captions spell names right' });
    const glossary = library.get({ library: 'glossaries', id: snapshot.interview.namesGlossaryId! }).content as TranscriptionGlossary;
    expect(glossary).toMatchObject({ kind: 'transcription', defaultEnabled: true, terms: [{ canonical: 'Deska' }, { canonical: 'Claude', misheard: ['clod'] }] });
    // Writing again merges into the same glossary.
    const again = await profile.completeWrite(answers, { preferences: '- kept as typed', names: [{ term: 'Next.js', misheard: [] }], usedAgent: false });
    expect(again.snapshot.interview.namesGlossaryId).toBe(snapshot.interview.namesGlossaryId);
    expect(again.snapshot.interview.usedAgent).toBe(false);
    expect((library.get({ library: 'glossaries', id: snapshot.interview.namesGlossaryId! }).content as TranscriptionGlossary).terms).toHaveLength(3);
  });

  it('preferences: own and the interview section are separate; removing the section keeps the own text', async () => {
    await profile.setPreferences({ own: 'mine', interview: 'section' });
    let snapshot = await profile.setPreferences({ interview: '' });
    expect(snapshot.preferences).toEqual({ own: 'mine', interview: '' });
    expect(snapshot.hasPreferences).toBe(true);
    snapshot = await profile.setPreferences({ own: '  ' });
    expect(snapshot.hasPreferences).toBe(false);
  });

  describe('rules', () => {
    it('put creates with a generated id, replaces by id, and warns about a template that is not installed', async () => {
      const created = await profile.putRule({ name: 'Gameplay stays clear', when: 'the clip is gameplay', instruction: 'Never cover the game.' });
      expect(created).toEqual({ rule: expect.objectContaining({ id: 'gameplay-stays-clear-0a1b2c3d', order: 10, stage: 'any', enabled: true }), warnings: [] });
      const second = await profile.putRule({ name: 'Quote', when: 'a strong quote', templateId: 'lower-third', stage: 'edit' });
      expect(second.rule.order).toBe(20);
      expect(second.warnings.map((w) => w.code)).toEqual(['template-missing']);
      const replaced = await profile.putRule({ id: created.rule.id, name: 'Gameplay stays clear', when: 'gameplay', enabled: false });
      expect(replaced.rule).toMatchObject({ id: created.rule.id, when: 'gameplay', enabled: false, order: 10, instruction: 'Never cover the game.' });
      expect(profile.snapshot().rules.map((r) => r.id)).toEqual([created.rule.id, second.rule.id]);
    });

    it('an incomplete rule is refused with readable problems and nothing changes', async () => {
      const error = await rejection(profile.putRule({ name: '', when: 'w' }));
      expect(error.code).toBe('invalid-request');
      expect(codeOf(error)).toBe('PROFILE_RULE_INVALID');
      expect((error.details as { problems: string[] }).problems).toHaveLength(2);
      expect(profile.snapshot().rules).toEqual([]);
      expect(events).toEqual([]);
    });

    it('remove returns the rule, and putting it back restores it at the same order', async () => {
      const a = (await profile.putRule({ name: 'A', when: 'w', instruction: 'i' })).rule;
      const b = (await profile.putRule({ name: 'B', when: 'w', instruction: 'i' })).rule;
      const c = (await profile.putRule({ name: 'C', when: 'w', instruction: 'i' })).rule;
      const { removed } = await profile.removeRule(b.id);
      expect(removed).toEqual(b);
      expect(profile.snapshot().rules.map((r) => r.id)).toEqual([a.id, c.id]);
      await profile.putRule(removed);
      expect(profile.snapshot().rules).toEqual([a, b, c]);
      const missing = await rejection(profile.removeRule('nope'));
      expect(missing.code).toBe('not-found');
      expect(codeOf(missing)).toBe('PROFILE_RULE_NOT_FOUND');
    });

    it('reorder takes a permutation, renumbers 10, 20, 30 and writes once', async () => {
      const ids = [];
      for (const name of ['A', 'B', 'C']) ids.push((await profile.putRule({ name, when: 'w', instruction: 'i' })).rule.id);
      events = [];
      const { rules } = await profile.reorderRules([ids[2]!, ids[0]!, ids[1]!]);
      expect(rules.map((r) => [r.id, r.order])).toEqual([
        [ids[2], 10],
        [ids[0], 20],
        [ids[1], 30],
      ]);
      expect(events).toHaveLength(1);
      for (const bad of [[ids[0]!, ids[1]!], [ids[0]!, ids[0]!, ids[1]!], [...ids, 'extra'], [ids[0]!, ids[1]!, 'other']]) {
        const error = await rejection(profile.reorderRules(bad));
        expect(codeOf(error)).toBe('PROFILE_RULE_ORDER');
      }
      expect(events).toHaveLength(1);
    });

    it('rulesFor gives the enabled rules of a stage, project rules after and shadowing by id', async () => {
      const clip = (await profile.putRule({ name: 'Clip', when: 'w', instruction: 'i', stage: 'clip' })).rule;
      await profile.putRule({ name: 'Edit', when: 'w', instruction: 'i', stage: 'edit' });
      await profile.putRule({ name: 'Off', when: 'w', instruction: 'i', enabled: false });
      await profile.putRule({ id: clip.id, name: 'Clip (project)', when: 'w', instruction: 'i', stage: 'clip' }, 'prj_1');
      await profile.putRule({ name: 'Any (project)', when: 'w', instruction: 'i' }, 'prj_1');
      expect((await profile.rulesFor('clip', null)).map((r) => r.name)).toEqual(['Clip']);
      expect((await profile.rulesFor('clip', projectDir)).map((r) => r.name)).toEqual(['Clip (project)', 'Any (project)']);
      expect((await profile.rulesFor('edit', projectDir)).map((r) => r.name)).toEqual(['Edit', 'Any (project)']);
    });
  });

  describe('project level', () => {
    it('text and rules live in the project folder', async () => {
      const methods = profileMethods({ profile });
      const result = await methods['profile.setPreferences']({ projectId: 'prj_1', own: '- Vertical only' }, undefined as never);
      expect(result).toEqual({ projectId: 'prj_1', preferences: '- Vertical only', rules: [], readOnly: false });
      await profile.putRule({ name: 'Project rule', when: 'w', instruction: 'i' }, 'prj_1');
      expect(JSON.parse(await fs.readFile(projectProfilePath(projectDir), 'utf8'))).toMatchObject({ preferences: '- Vertical only', rules: [{ name: 'Project rule' }] });
      expect((await profile.project('prj_1')).rules.map((r) => r.name)).toEqual(['Project rule']);
      // The workspace level is untouched.
      expect(profile.snapshot().preferences.own).toBe('');
      expect(profile.snapshot().rules).toEqual([]);
    });

    it('errors: unknown project, interview text, a folder that is gone, a newer file', async () => {
      const methods = profileMethods({ profile });
      const unknown = await rejection(() => profile.project('prj_x'));
      expect(unknown.code).toBe('not-found');
      expect(codeOf(unknown)).toBe('PROFILE_PROJECT_NOT_FOUND');
      expect(codeOf(await rejection(profile.putRule({ name: 'n', when: 'w', instruction: 'i' }, 'prj_x')))).toBe('PROFILE_PROJECT_NOT_FOUND');

      const textOnly = await rejection(() => methods['profile.setPreferences']({ projectId: 'prj_1', interview: 'x' }, undefined as never));
      expect(textOnly.code).toBe('invalid-request');
      expect(codeOf(textOnly)).toBe('PROFILE_PROJECT_TEXT_ONLY');

      await fs.mkdir(path.dirname(projectProfilePath(projectDir)), { recursive: true });
      await fs.writeFile(projectProfilePath(projectDir), JSON.stringify({ schemaVersion: 9, preferences: 'future', rules: [] }));
      expect(await profile.project('prj_1')).toMatchObject({ preferences: 'future', readOnly: true });
      const readOnly = await rejection(profile.setProjectPreferences('prj_1', 'x'));
      expect(readOnly.code).toBe('conflict');
      expect(codeOf(readOnly)).toBe('PROFILE_READ_ONLY');

      await fs.rm(projectDir, { recursive: true, force: true });
      const gone = await rejection(profile.setProjectPreferences('prj_1', 'x'));
      expect(gone.code).toBe('conflict');
      expect(codeOf(gone)).toBe('PROFILE_PROJECT_UNAVAILABLE');
      await expect(fs.stat(projectDir)).rejects.toThrow();
    });
  });

  it('a workspace file from a newer version is shown and every change is refused', async () => {
    await profile.flush();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ schemaVersion: 2, preferences: { own: 'future', interview: '' } }));
    profile = await open();
    expect(profile.snapshot()).toMatchObject({ readOnly: true, preferences: { own: 'future' }, hasPreferences: true });
    for (const attempt of [
      () => profile.saveAnswers({ who: 'x' }),
      () => profile.skip(),
      () => profile.setPreferences({ own: 'x' }),
      () => profile.putRule({ name: 'n', when: 'w', instruction: 'i' }),
    ]) {
      const error = await rejection(attempt);
      expect(codeOf(error)).toBe('PROFILE_READ_ONLY');
    }
    expect(events).toEqual([]);
  });

  it('publishes one event per write: the whole snapshot, or the project id', async () => {
    await profile.saveAnswers({ who: 'me' });
    await profile.setPreferences({ own: 'x' });
    await profile.putRule({ name: 'n', when: 'w', instruction: 'i' });
    await profile.setProjectPreferences('prj_1', 'p');
    profile.setWriting({ startedAt: new Date().toISOString(), lines: ['reading'] });
    expect(events.map((e) => e.type)).toEqual(['profile.updated', 'profile.updated', 'profile.updated', 'profile.projectUpdated', 'profile.writing']);
    const last = events[2] as Extract<ProfileEvent, { type: 'profile.updated' }>;
    expect(last.snapshot).toMatchObject({ interview: { answers: { who: 'me' } }, preferences: { own: 'x' }, rules: [{ name: 'n' }] });
    expect(profile.snapshot().writing?.lines).toEqual(['reading']);
    // A subscriber that joins now gets the snapshot.
    const sub = profile.topic.subscribe(undefined, () => {});
    expect(sub.result).toMatchObject({ mode: 'snapshot', snapshot: { preferences: { own: 'x' } } });
    sub.unsubscribe();
  });
});

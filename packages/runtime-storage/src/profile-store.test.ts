import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_LIMITS, type ProfileRule } from '@cuccut/protocol';
import { ProfileReadOnlyError, ProfileStore, defaultProfile, normalizeProfile, normalizeRules } from './profile-store.ts';
import { ProjectProfileFiles, ProjectProfileUnavailableError, projectProfilePath } from './project-profile-file.ts';
import { PROJECT_MARKER_DIR, PROJECT_MARKER_FILE } from './project-marker.ts';

const rule = (id: string, extra: Partial<ProfileRule> = {}): ProfileRule => ({
  id,
  name: `Rule ${id}`,
  when: 'the clip is gameplay',
  instruction: 'Never cover the game with pictures.',
  templateId: null,
  stage: 'any',
  order: 10,
  enabled: true,
  note: '',
  source: null,
  ...extra,
});

describe('workspace profile store', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-profile-store-'));
    file = path.join(dir, 'store', 'profile.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('starts from the defaults when there is no file', async () => {
    const store = new ProfileStore(file);
    expect(await store.load()).toEqual(defaultProfile());
    expect(defaultProfile()).toEqual({
      interview: { status: 'pending', reminder: true, answers: {}, writtenAt: null, usedAgent: null, namesGlossaryId: null },
      preferences: { own: '', interview: '' },
      rules: [],
    });
    expect(store.readOnly).toBe(false);
  });

  it('keeps what was written across a reopen', async () => {
    const store = new ProfileStore(file);
    await store.load();
    await store.update((p) => {
      p.interview.status = 'skipped';
      p.interview.answers = { who: 'Coding streams', record: 'Webcam in the corner' };
      p.preferences.own = '- Hooks under 3 seconds';
      p.preferences.interview = '- Captions spell names right';
      p.rules = [rule('gameplay-0a1b2c3d')];
    });
    const again = new ProfileStore(file);
    const loaded = await again.load();
    expect(loaded.interview).toMatchObject({ status: 'skipped', answers: { who: 'Coding streams', record: 'Webcam in the corner' } });
    expect(loaded.preferences).toEqual({ own: '- Hooks under 3 seconds', interview: '- Captions spell names right' });
    expect(loaded.rules).toEqual([rule('gameplay-0a1b2c3d')]);
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toMatchObject({ schemaVersion: 1 });
  });

  it('renames a corrupt file and starts empty', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not json');
    const store = new ProfileStore(file);
    expect(await store.load()).toEqual(defaultProfile());
    const names = await fs.readdir(path.dirname(file));
    expect(names.some((n) => n.startsWith('profile.json.corrupt-'))).toBe(true);
    // The store is writable again after a quarantine.
    await store.update((p) => {
      p.preferences.own = 'x';
    });
    expect((await new ProfileStore(file).load()).preferences.own).toBe('x');
  });

  it('reads a newer schema where it can, never rewrites it and refuses changes', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const text = JSON.stringify({ schemaVersion: 2, preferences: { own: 'kept', interview: '' }, rules: [rule('a-1')], futureField: 1 });
    await fs.writeFile(file, text);
    const store = new ProfileStore(file);
    const loaded = await store.load();
    expect(store.readOnly).toBe(true);
    expect(loaded.preferences.own).toBe('kept');
    expect(loaded.rules.map((r) => r.id)).toEqual(['a-1']);
    await expect(
      store.update((p) => {
        p.preferences.own = 'changed';
      }),
    ).rejects.toBeInstanceOf(ProfileReadOnlyError);
    expect(await fs.readFile(file, 'utf8')).toBe(text);
    expect(store.get().preferences.own).toBe('kept');
  });

  it('serialises concurrent writes: each sees the one before it', async () => {
    const store = new ProfileStore(file);
    await store.load();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.update((p) => {
          p.rules.push(rule(`r-${i}`, { order: i }));
        }),
      ),
    );
    expect(store.get().rules).toHaveLength(20);
    expect((await new ProfileStore(file).load()).rules).toHaveLength(20);
  });

  it('an update that throws changes nothing', async () => {
    const store = new ProfileStore(file);
    await store.load();
    await expect(
      store.update((p) => {
        p.preferences.own = 'half';
        throw new Error('no');
      }),
    ).rejects.toThrow('no');
    expect(store.get().preferences.own).toBe('');
  });

  it('normalize drops bad rules and duplicate ids and clips text', () => {
    const long = 'x'.repeat(PROFILE_LIMITS.preferences + 50);
    const profile = normalizeProfile({
      interview: { status: 'weird', reminder: 'yes', answers: { who: '  me  ', record: '   ', favourite: 'x' }, extra: 1 },
      preferences: { own: long, interview: 3 },
      rules: [
        rule('keep-1', { order: 20 }),
        rule('keep-1', { name: 'second copy' }),
        rule('Bad Id'),
        { ...rule('no-name'), name: '  ' },
        { ...rule('no-when'), when: '' },
        { ...rule('no-action'), instruction: '' },
        { ...rule('template-only'), instruction: '', templateId: 'quote-card', order: 5 },
        { ...rule('bad-template'), templateId: 'Quote Card' },
        { ...rule('defaults'), stage: 'later', enabled: 'no', order: 'x', note: 7, name: 'n'.repeat(PROFILE_LIMITS.name + 10), source: { pack: 'p' } },
        'not a rule',
      ],
      unknown: true,
    });
    expect(profile.interview).toEqual({ status: 'pending', reminder: true, answers: { who: 'me' }, writtenAt: null, usedAgent: null, namesGlossaryId: null });
    expect(profile.preferences.own).toHaveLength(PROFILE_LIMITS.preferences);
    expect(profile.preferences.interview).toBe('');
    expect(profile.rules.map((r) => r.id)).toEqual(['template-only', 'bad-template', 'keep-1', 'defaults']);
    expect(profile.rules.find((r) => r.id === 'keep-1')?.name).toBe('Rule keep-1');
    expect(profile.rules.find((r) => r.id === 'bad-template')?.templateId).toBeNull();
    const defaults = profile.rules.find((r) => r.id === 'defaults')!;
    expect(defaults).toMatchObject({ stage: 'any', enabled: true, note: '', source: null, order: 90 });
    expect(defaults.name).toHaveLength(PROFILE_LIMITS.name);
    expect(Object.keys(profile)).toEqual(['interview', 'preferences', 'rules']);
  });

  it('normalize keeps at most PROFILE_LIMITS.rules rules', () => {
    const many = Array.from({ length: PROFILE_LIMITS.rules + 5 }, (_, i) => rule(`r-${i}`, { order: i }));
    expect(normalizeRules(many)).toHaveLength(PROFILE_LIMITS.rules);
  });
});

describe('project profile file', () => {
  let dir: string;
  let project: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-project-profile-'));
    project = path.join(dir, 'My Project');
    await fs.mkdir(path.join(project, PROJECT_MARKER_DIR), { recursive: true });
    await fs.writeFile(path.join(project, PROJECT_MARKER_DIR, PROJECT_MARKER_FILE), '{}');
  });

  afterEach(async () => {
    await fs.chmod(project, 0o755).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('round-trips next to .ccut/project.json', async () => {
    const files = new ProjectProfileFiles();
    expect(await files.read(project)).toEqual({ preferences: '', rules: [], readOnly: false });
    await files.update(project, (p) => {
      p.preferences = '- Vertical only';
      p.rules.push(rule('project-rule-1'));
    });
    expect(projectProfilePath(project)).toBe(path.join(project, '.ccut', 'profile.json'));
    expect(JSON.parse(await fs.readFile(projectProfilePath(project), 'utf8'))).toMatchObject({ schemaVersion: 1, preferences: '- Vertical only' });
    expect(await new ProjectProfileFiles().read(project)).toEqual({ preferences: '- Vertical only', rules: [rule('project-rule-1')], readOnly: false });
    // The marker is left alone.
    expect(await fs.readFile(path.join(project, PROJECT_MARKER_DIR, PROJECT_MARKER_FILE), 'utf8')).toBe('{}');
  });

  it('reads the file again on every read (no cache)', async () => {
    const files = new ProjectProfileFiles();
    await files.update(project, (p) => {
      p.preferences = 'one';
    });
    await fs.writeFile(projectProfilePath(project), JSON.stringify({ schemaVersion: 1, preferences: 'edited by hand', rules: [] }));
    expect((await files.read(project)).preferences).toBe('edited by hand');
  });

  it('serialises writes to the same project', async () => {
    const files = new ProjectProfileFiles();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        files.update(project, (p) => {
          p.rules.push(rule(`r-${i}`, { order: i }));
        }),
      ),
    );
    expect((await files.read(project)).rules).toHaveLength(10);
  });

  it('a newer file is read but not rewritten', async () => {
    const text = JSON.stringify({ schemaVersion: 3, preferences: 'future', rules: [] });
    await fs.writeFile(projectProfilePath(project), text);
    const files = new ProjectProfileFiles();
    expect(await files.read(project)).toEqual({ preferences: 'future', rules: [], readOnly: true });
    await expect(files.update(project, () => {})).rejects.toBeInstanceOf(ProfileReadOnlyError);
    expect(await fs.readFile(projectProfilePath(project), 'utf8')).toBe(text);
  });

  it('a missing project folder is unavailable and is not created', async () => {
    const files = new ProjectProfileFiles();
    const gone = path.join(dir, 'gone');
    expect(await files.read(gone)).toEqual({ preferences: '', rules: [], readOnly: false });
    await expect(files.update(gone, () => {})).rejects.toBeInstanceOf(ProjectProfileUnavailableError);
    await expect(fs.stat(gone)).rejects.toThrow();
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('a folder that cannot be written is unavailable', async () => {
    await fs.rm(path.join(project, PROJECT_MARKER_DIR), { recursive: true });
    await fs.chmod(project, 0o555);
    const files = new ProjectProfileFiles();
    await expect(
      files.update(project, (p) => {
        p.preferences = 'x';
      }),
    ).rejects.toBeInstanceOf(ProjectProfileUnavailableError);
  });
});

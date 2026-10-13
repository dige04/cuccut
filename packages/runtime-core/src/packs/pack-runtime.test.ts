import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, until } from '../agent-tools/testing/fake-agent.ts';
import { SAMPLE_PACK_DIR, fakePackHost, readFolder } from './testing/pack-fixtures.ts';

/**
 * Packs end to end (pack spec §5, §8): inspect, install, remove and restore through the real RPC gateway, and the catalogs (templates, skills, library) seeing the pack's
 * items with their provenance. The built-in skills are a temporary directory and there are no built-in templates, so only the pack's items show.
 */

async function rejection(promise: Promise<unknown>): Promise<RpcError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RpcError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('packs end to end', () => {
  let dir: string;
  let builtin: string;
  let home: RuntimeHome;
  let driver: ToolDriver;
  let runtime: RunningRuntime;
  let client: CucCutClient;

  async function boot(packsSource?: { fetch: typeof fetch }): Promise<void> {
    driver = new ToolDriver();
    runtime = await startRuntime({ home, drivers: () => [driver], watchSpace: false, skillsDir: builtin, templatesDir: null, ...(packsSource ? { packsSource } : {}) });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-pack-runtime-'));
    builtin = path.join(dir, 'builtin-skills');
    await fs.mkdir(builtin);
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('inspect → install → the catalogs show the pack → remove → restore', async () => {
    await boot();
    expect(await client.request('packs.list', {})).toEqual({ packs: [], diagnostics: [] });

    const preview = await client.request('packs.inspect', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    expect(preview.manifest.id).toBe('news-desk');
    expect(preview.installed).toBeNull();
    expect(preview.blocked).toEqual([]);
    expect(preview.templates.map((t) => [t.id, t.state])).toEqual([['news-desk-daily', 'new']]);
    expect(preview.skills.map((s) => [s.id, s.state])).toEqual([['news-desk-headlines', 'new']]);
    // Nothing is installed by a preview.
    expect((await client.request('templates.list', {})).templates).toEqual([]);

    const installed = await client.request('packs.install', { token: preview.token, commandId: newId('cmd') });
    expect(installed.pack).toMatchObject({ id: 'news-desk', name: 'News desk', version: '1.0.0', source: { kind: 'local', path: SAMPLE_PACK_DIR } });
    expect(installed.skipped).toEqual([]);
    expect(installed.packs.map((p) => p.id)).toEqual(['news-desk']);
    // The token was used up.
    const used = await rejection(client.request('packs.install', { token: preview.token }));
    expect(used).toMatchObject({ code: 'conflict', details: { code: 'PACK_PREVIEW_EXPIRED' } });

    const { templates } = await client.request('templates.list', {});
    expect(templates.map((t) => [t.manifest.id, t.origin, t.pack])).toEqual([['news-desk-daily', 'user', { id: 'news-desk', name: 'News desk' }]]);
    const { template } = await client.request('templates.get', { id: 'news-desk-daily' });
    expect(template.pack).toEqual({ id: 'news-desk', name: 'News desk' });

    const skill = (await client.request('skills.list', {})).skills.find((s) => s.id === 'news-desk-headlines');
    expect(skill).toMatchObject({ origin: 'pack' });

    const { entries } = await client.request('library.list', {});
    expect(entries.map((e) => [e.library, e.name]).sort()).toEqual([
      ['brand', 'News desk red'],
      ['glossaries', 'News desk terms'],
    ]);

    const detail = await client.request('packs.get', { id: 'news-desk' });
    expect(detail.pack.id).toBe('news-desk');
    expect(detail.style?.text).toBe(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8'));
    expect(detail.items.templates).toEqual([expect.objectContaining({ id: 'news-desk-daily', state: 'present' })]);
    expect(detail.items.skills).toEqual([expect.objectContaining({ id: 'news-desk-headlines', state: 'present' })]);
    expect(detail.items.library).toHaveLength(2);
    expect((await rejection(client.request('packs.get', { id: 'no-such-pack' }))).details).toMatchObject({ code: 'PACK_NOT_FOUND' });

    // A scene template from the pack carries the pack on the message marker.
    const { conversation } = await client.request('conversations.create', {});
    await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'Make the daily take',
      commandId: newId('cmd'),
      template: { id: 'news-desk-daily' },
    });
    await until(() => (driver.sessions[0]?.inputs.length ?? 0) > 0);
    const message = runtime.harness.getConversation(conversation.id).items.find((i) => i.kind === 'user-message');
    expect(message).toMatchObject({ template: { id: 'news-desk-daily', origin: 'user', packId: 'news-desk' } });

    const removed = await client.request('packs.remove', { id: 'news-desk' });
    expect(removed.removed).toEqual({ id: 'news-desk', name: 'News desk' });
    expect(removed.kept).toEqual([]);
    expect(removed.moved).toEqual({ templates: 1, skills: 1 });
    expect(removed.packs).toEqual([]);
    expect((await client.request('templates.list', {})).templates).toEqual([]);
    expect((await client.request('skills.list', {})).skills.some((s) => s.id === 'news-desk-headlines')).toBe(false);
    // Library entries stay.
    expect((await client.request('library.list', {})).entries).toHaveLength(2);

    const restored = await client.request('packs.restore', { trashId: removed.trashId });
    expect(restored.pack.id).toBe('news-desk');
    expect(restored.packs.map((p) => p.id)).toEqual(['news-desk']);
    expect((await client.request('templates.list', {})).templates.map((t) => [t.manifest.id, t.pack])).toEqual([['news-desk-daily', { id: 'news-desk', name: 'News desk' }]]);
    expect((await client.request('skills.list', {})).skills.find((s) => s.id === 'news-desk-headlines')).toMatchObject({ origin: 'pack' });
    const again = await rejection(client.request('packs.restore', { trashId: removed.trashId }));
    expect(again.details).toMatchObject({ code: 'PACK_TRASH_EXPIRED' });
  });

  it("the session guidance carries the active pack's style guide; packs.active, packs.choose and packs.setStyle", async () => {
    await boot();
    await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    const { project } = await client.request('projects.create', { name: 'Evening news' });
    expect(await client.request('packs.active', { projectId: project.id })).toEqual({ pack: { id: 'news-desk', name: 'News desk' }, reason: 'only' });

    const { conversation } = await client.request('conversations.create', { projectId: project.id });
    expect(await client.request('packs.active', { conversationId: conversation.id })).toMatchObject({ reason: 'only' });
    await client.request('conversations.send', {
      conversationId: conversation.id,
      text: 'Make the daily take',
      commandId: newId('cmd'),
      template: { id: 'news-desk-daily' },
    });
    const session = await until(() => driver.sessions[0]);
    const guidance = session.options.developerInstructions ?? '';
    // After the skill index: the style block, with the guide and the still copied into the project.
    expect(guidance).toContain('<cuccut-style pack="news-desk">');
    expect(guidance.indexOf('<cuccut-skills>')).toBeLessThan(guidance.indexOf('<cuccut-style'));
    expect(guidance).toContain((await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8')).trim());
    expect(guidance).toContain('- .ccut/style/news-desk/lower-third.png — Lower third:');
    expect((await fs.stat(path.join(project.path, '.ccut', 'style', 'news-desk', 'lower-third.png'))).isFile()).toBe(true);
    // The template's block names the pack.
    await until(() => (session.inputs.length ?? 0) > 0);
    expect(session.inputs[0]).toContain('This template comes from the pack "News desk"; its style guide applies (packs_read id=news-desk).');
    // The conversation used a template from the pack, which comes before "the only pack with a guide", in the session block as well.
    expect(guidance).toContain('Why this guide: This conversation used the template "news-desk-daily" from this pack.');
    expect(await client.request('packs.active', { conversationId: conversation.id })).toMatchObject({ reason: 'template' });

    expect(await client.request('packs.choose', { projectId: project.id, pack: 'none' })).toEqual({
      choice: 'none',
      active: { pack: null, reason: 'chosen-none' },
    });
    expect(await client.request('packs.active', { conversationId: conversation.id })).toEqual({ pack: null, reason: 'chosen-none' });
    expect(await client.request('packs.choose', { projectId: project.id, pack: null })).toMatchObject({ choice: null });
    // Without a choice, the template used in this conversation decides.
    expect(await client.request('packs.active', { conversationId: conversation.id })).toMatchObject({ reason: 'template' });
    expect((await rejection(client.request('packs.choose', { projectId: project.id, pack: 'no-such-pack' }))).details).toMatchObject({ code: 'PACK_NOT_FOUND' });

    const detail = await client.request('packs.get', { id: 'news-desk' });
    const saved = await client.request('packs.setStyle', { id: 'news-desk', text: 'Calm and quick.\n', expectedHash: detail.style!.hash });
    expect(saved.style?.text).toBe('Calm and quick.\n');
    const stale = await rejection(client.request('packs.setStyle', { id: 'news-desk', text: 'x', expectedHash: detail.style!.hash }));
    expect(stale.details).toMatchObject({ code: 'PACK_STYLE_CHANGED' });
  });

  it('reference files: add, open, update, remove with Undo, and the session block lists them', async () => {
    await boot();
    await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    const picked = path.join(dir, 'picked', 'Studio Shot.png');
    await fs.mkdir(path.dirname(picked), { recursive: true });
    await fs.copyFile(path.join(SAMPLE_PACK_DIR, 'examples', 'lower-third.png'), picked);

    const added = await client.request('packs.addExample', { id: 'news-desk', path: picked, title: 'Studio', note: 'Warm key light.' });
    expect(added.examples.map((e) => e.file)).toEqual(['examples/lower-third.png', 'examples/studio-shot.png']);
    const handle = await client.request('packs.openHandle', { id: 'news-desk', path: 'examples/studio-shot.png' });
    expect(handle).toMatchObject({ mimeType: 'image/png', fileName: 'studio-shot.png' });
    expect((await rejection(client.request('packs.openHandle', { id: 'news-desk', path: 'STYLE.md' }))).details).toMatchObject({
      code: 'PACK_EXAMPLE_NOT_FOUND',
    });

    const updated = await client.request('packs.updateExample', { id: 'news-desk', file: 'examples/studio-shot.png', note: 'Warm key light, dark set.' });
    expect(updated.examples[1]).toMatchObject({ title: 'Studio', note: 'Warm key light, dark set.' });

    const { project } = await client.request('projects.create', { name: 'Studio news' });
    const { conversation } = await client.request('conversations.create', { projectId: project.id });
    await client.request('conversations.send', { conversationId: conversation.id, text: 'Go', commandId: newId('cmd') });
    const session = await until(() => driver.sessions[0]);
    expect(session.options.developerInstructions ?? '').toContain('- .ccut/style/news-desk/studio-shot.png — Studio: Warm key light, dark set.');

    const removed = await client.request('packs.removeExample', { id: 'news-desk', file: 'examples/lower-third.png' });
    expect(removed.examples.map((e) => e.file)).toEqual(['examples/studio-shot.png']);
    const restored = await client.request('packs.restoreExample', { id: 'news-desk', trashId: removed.trashId });
    expect(restored.examples.map((e) => e.file)).toEqual(['examples/lower-third.png', 'examples/studio-shot.png']);
  });

  it('install from a source in one call; installing again updates in place and reuses the library entries', async () => {
    await boot();
    const first = await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    expect(first.pack.id).toBe('news-desk');
    const second = await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    expect(second.skipped).toEqual([]);
    expect(second.packs).toHaveLength(1);
    expect((await client.request('library.list', {})).entries).toHaveLength(2);
    // Nothing is left staged.
    expect(await fs.readdir(path.join(home.packsDir, '.staging'))).toEqual([]);

    const invalid = await rejection(client.request('packs.inspect', { source: path.join(dir, 'missing') }));
    expect(invalid.details).toMatchObject({ code: 'PACK_SOURCE_NOT_FOUND' });
  });

  it('export → inspect → install into a second home, from the folder and from a static host', async () => {
    await boot();
    await client.request('packs.install', { source: SAMPLE_PACK_DIR, commandId: newId('cmd') });
    const { entries } = await client.request('library.list', {});
    const out = path.join(dir, 'exports', 'news-kit');
    const exported = await client.request('packs.export', {
      dir: out,
      manifest: { id: 'news-kit', name: 'News kit', version: '2.0.0', author: 'Me' },
      templates: ['news-desk-daily'],
      skills: ['news-desk-headlines'],
      library: entries.filter((e) => e.library !== 'voices').map((e) => ({ library: e.library as 'glossaries' | 'brand', id: e.id })),
      quickActions: [{ label: 'Tighten', text: 'Tighten {selection}.' }],
      stylePack: 'news-desk',
    });
    expect(exported.dir).toBe(out);
    expect(exported.files).toBeGreaterThan(5);
    // The folder now holds this export: another pack's export into it is refused.
    const busy = await rejection(
      client.request('packs.export', { dir: out, manifest: { id: 'other', name: 'Other' }, templates: [], skills: [], library: [], quickActions: [] }),
    );
    expect(busy).toMatchObject({ code: 'conflict', details: { code: 'PACK_EXPORT_TARGET_NOT_EMPTY' } });
    client.close();
    await runtime.close();

    // A second home reads the folder, and the same folder served from a static host (which needs the files index).
    home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home-2') });
    const host = fakePackHost('https://packs.example.test/news-kit/', await readFolder(out));
    await boot({ fetch: host.fetch });
    const fromHost = await client.request('packs.inspect', { source: 'https://packs.example.test/news-kit/' });
    expect(fromHost.manifest).toMatchObject({ id: 'news-kit', name: 'News kit', version: '2.0.0' });
    expect(fromHost.blocked).toEqual([]);
    expect(fromHost.library.map((l) => [l.library, l.duplicate]).sort()).toEqual([
      ['brand', false],
      ['glossaries', false],
    ]);
    const preview = await client.request('packs.inspect', { source: out });
    const installed = await client.request('packs.install', { token: preview.token });
    expect(installed.skipped).toEqual([]);
    expect(installed.pack).toMatchObject({ id: 'news-kit', hasStyle: true, counts: { templates: 1, skills: 1, library: 2, examples: 1, quickActions: 1 } });
    expect((await client.request('templates.list', {})).templates.map((t) => [t.manifest.id, t.pack?.id])).toEqual([['news-desk-daily', 'news-kit']]);
    expect((await client.request('library.list', {})).entries.map((e) => e.name).sort()).toEqual(['News desk red', 'News desk terms']);
    expect((await client.request('packs.get', { id: 'news-kit' })).style?.text).toBe(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8'));
  });

  it('a restart forgets previews and keeps installed packs', async () => {
    await boot();
    const preview = await client.request('packs.inspect', { source: SAMPLE_PACK_DIR });
    await client.request('packs.install', { source: SAMPLE_PACK_DIR });
    client.close();
    await runtime.close();

    await boot();
    expect((await client.request('packs.list', {})).packs.map((p) => p.id)).toEqual(['news-desk']);
    expect((await rejection(client.request('packs.install', { token: preview.token }))).details).toMatchObject({ code: 'PACK_PREVIEW_EXPIRED' });
    expect(await fs.readdir(path.join(home.packsDir, '.staging'))).toEqual([]);
  });
});

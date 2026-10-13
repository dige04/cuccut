import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { RpcError, newId } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, until } from '../agent-tools/testing/fake-agent.ts';
import { SAMPLE_PACK_DIR } from './testing/pack-fixtures.ts';

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

  async function boot(): Promise<void> {
    driver = new ToolDriver();
    runtime = await startRuntime({ home, drivers: () => [driver], watchSpace: false, skillsDir: builtin, templatesDir: null });
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

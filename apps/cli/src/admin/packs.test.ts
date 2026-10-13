import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { PACK_STYLE_MAX_CHARS } from '@cuccut/protocol';
import { resolveRuntimeHome, type RuntimeHome } from '@cuccut/runtime-storage';
import { startRuntime, type RunningRuntime } from '../../../../packages/runtime-core/src/runtime.ts';
import { SAMPLE_PACK_DIR } from '../../../../packages/runtime-core/src/packs/testing/pack-fixtures.ts';
import { CliError } from '../envelope.ts';
import { captureOutput } from '../testing/fake-client.ts';
import { AdminRun } from './context.ts';
import { packs } from './packs.ts';
import { M } from './packs-copy.ts';

/**
 * `cuccut packs` against a real Runtime in a temporary home (no built-in templates, an empty built-in skills folder): usage, inspect and install from a folder given
 * relative to the working directory, the style guide, and remove printing the Undo command that restore takes.
 */

let dir: string;
let home: RuntimeHome;
let runtime: RunningRuntime;
let client: CucCutClient;

beforeAll(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-cli-packs-')));
  const builtin = path.join(dir, 'builtin-skills');
  await fs.mkdir(builtin);
  home = resolveRuntimeHome({ CUCCUT_HOME: path.join(dir, 'home') });
  runtime = await startRuntime({ home, drivers: () => [], watchSpace: false, skillsDir: builtin, templatesDir: null, engineHost: null, modelWorker: null });
  const { endpoint, token } = runtime.discovery;
  client = new CucCutClient({ resolve: async () => ({ endpoint, token }), client: { kind: 'cli', name: 'test', version: '0' }, reconnect: false });
  await client.connect();
}, 60_000);

afterAll(async () => {
  client?.close();
  await runtime?.close();
  await fs.rm(dir, { recursive: true, force: true });
});

async function run(args: string[], options: { values?: Record<string, unknown>; json?: boolean; cwd?: string } = {}) {
  const capture = captureOutput(options.json ?? false);
  const ctx = new AdminRun({
    client,
    output: capture.output,
    cwd: options.cwd ?? path.dirname(SAMPLE_PACK_DIR),
    home: home.root,
    args,
    values: options.values ?? {},
    usage: packs.usage,
  });
  const code = await packs.run(ctx as never);
  return { code, out: capture.out(), envelope: capture.envelope };
}

describe('cuccut packs', () => {
  it('usage names every subcommand; a missing argument or a misplaced --replace is a usage error', async () => {
    for (const verb of packs.verbs!) expect(packs.usage).toContain(`cuccut packs ${verb}`);
    expect(packs.usage).toContain('--replace');
    await expect(run(['inspect'])).rejects.toBeInstanceOf(CliError);
    await expect(run(['remove', 'news-desk'], { values: { replace: true } })).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
    await expect(run(['remove', 'Not An Id'])).rejects.toMatchObject({ code: 'INVALID_ARGUMENTS' });
  });

  it('inspect a folder given relative to the working directory: everything an agent will read, in full, then how to install it', async () => {
    const { code, out } = await run(['inspect', 'news-desk']);
    expect(code).toBe(0);
    expect(out).toContain(`${M.title('News desk', 'news-desk', '1.0.0', 'CucCut')}\n${M.notInstalled}\n`);
    expect(out).toContain(M.contents(1, 1, 2, true, 3));
    expect(out).toContain(`- news-desk-daily: `);
    expect(out).toContain(`- news-desk-headlines: `);
    expect(out).toContain(M.agentReads);
    // The style guide and the quick actions in full.
    for (const line of (await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8')).split('\n').filter(Boolean)) expect(out).toContain(`    ${line}`);
    expect(out).toContain('- Tighten the take\n    Tighten {selection}: cut the stalls');
    expect(out).toContain(M.installHint(SAMPLE_PACK_DIR));
    // Nothing installed.
    expect((await client.request('packs.list', {})).packs).toEqual([]);
  });

  it('install from a folder, the style guide, remove with the Undo command, restore', async () => {
    const installed = await run(['install', SAMPLE_PACK_DIR]);
    expect(installed.code).toBe(0);
    expect(installed.out).toBe(`${M.installed('News desk', '1.0.0', M.contents(1, 1, 2, true, 3))}\n${M.takesEffect}\n`);
    expect((await client.request('packs.list', {})).packs.map((p) => p.id)).toEqual(['news-desk']);

    // Inspecting again says what is installed.
    expect((await run(['inspect', SAMPLE_PACK_DIR])).out).toContain(M.installedVersion('1.0.0'));

    // The guide: print it, save a file as the guide, then an empty one removes it.
    const printed = await run(['style', 'news-desk']);
    expect(printed.out).toBe(`${(await fs.readFile(path.join(SAMPLE_PACK_DIR, 'STYLE.md'), 'utf8')).trimEnd()}\n`);
    await fs.writeFile(path.join(dir, 'guide.md'), 'Calm and quick.\n');
    const saved = await run(['style', 'news-desk', 'guide.md'], { cwd: dir });
    expect(saved.out).toBe(`${M.styleSaved('News desk', 'Calm and quick.\n'.length, PACK_STYLE_MAX_CHARS)}\n${M.takesEffect}\n`);
    expect((await client.request('packs.get', { id: 'news-desk' })).style?.text).toBe('Calm and quick.\n');
    await fs.writeFile(path.join(dir, 'empty.md'), '');
    expect((await run(['style', 'news-desk', path.join(dir, 'empty.md')])).out).toContain(M.styleRemoved('News desk'));
    expect((await run(['style', 'news-desk'])).out).toBe(`${M.noStyle('News desk', 'news-desk')}\n`);
    await expect(run(['style', 'news-desk', path.join(dir, 'missing.md')])).rejects.toThrow(/missing\.md/);

    // Remove prints the Undo command; restore takes its trash id.
    const removed = await run(['remove', 'news-desk'], { json: true });
    const { trashId } = removed.envelope().result as { trashId: string };
    expect((await client.request('packs.list', {})).packs).toEqual([]);
    expect((await client.request('templates.list', {})).templates).toEqual([]);
    const again = await run(['remove', 'news-desk']).catch((error: unknown) => error);
    expect(again).toMatchObject({ details: { code: 'PACK_NOT_FOUND' } });
    expect((await run(['restore', trashId], { json: true })).envelope().result.pack.id).toBe('news-desk');

    const human = await run(['remove', 'news-desk']);
    const lines = human.out.trimEnd().split('\n');
    expect(lines[0]).toBe(M.removed('News desk', 1, 1));
    const undo = lines.at(-1)!;
    const humanTrashId = /cuccut packs restore (\S+)$/.exec(undo)?.[1];
    expect(undo).toBe(M.undo(humanTrashId!));

    const restored = await run(['restore', humanTrashId!]);
    expect(restored.out).toBe(`${M.restored('News desk', '1.0.0')}\n`);
    expect((await client.request('templates.list', {})).templates.map((t) => t.manifest.id)).toEqual(['news-desk-daily']);
  });
});

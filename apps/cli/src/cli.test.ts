import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminBucket } from './admin/index.ts';
import { runCli } from './cli.ts';

/** Runs `runCli` in-process: temporary CUCCUT_HOME, and the Runtime entry point is a path that does not exist (so that even if it tries to start, it cannot). */
let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-cli-home-'));
  vi.stubEnv('CUCCUT_RUNTIME_ENTRY', path.join(home, 'no-such-runtime.ts'));
  vi.stubEnv('CUCCUT_LOCALE', 'en');
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

async function cli(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const chunks = { stdout: '', stderr: '' };
  stdout.on('data', (chunk) => (chunks.stdout += String(chunk)));
  stderr.on('data', (chunk) => (chunks.stderr += String(chunk)));
  const code = await runCli(argv, adminBucket, { cwd: home, env: { ...process.env, CUCCUT_HOME: home }, stdout, stderr });
  return { code, ...chunks };
}

describe('runCli: does not start Runtime for a misspelled command or for help (Agent surface design §4.5)', () => {
  it('unknown verb after a known noun: UNKNOWN_COMMAND (exit code 4), does not start Runtime', async () => {
    const result = await cli(['videos', 'frobnicate', '--json']);
    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).error.code).toBe('UNKNOWN_COMMAND');
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it('unknown noun too', async () => {
    const result = await cli(['frobnicate', '--json']);
    expect(result.code).toBe(4);
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it('noun only: lists that group', async () => {
    const result = await cli(['videos']);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^cuccut videos <command>\n[^]*\n  inspect /);
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it('meta-command help: help runtime, runtime --help, help status, status --help, spec --help, version --help', async () => {
    for (const argv of [
      ['help', 'runtime'],
      ['runtime', '--help'],
      ['help', 'status'],
      ['status', '--help'],
      ['help', 'spec'],
      ['spec', '--help'],
      ['help', 'version'],
      ['version', '--help'],
      ['help', 'help'],
    ]) {
      const result = await cli(argv);
      expect(result.code, argv.join(' ')).toBe(0);
      expect(result.stdout, argv.join(' ')).toMatch(new RegExp(`^cuccut ${argv.find((word) => word !== 'help') ?? 'help'}`));
    }
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it('help videos delete\'s example includes --yes', async () => {
    const result = await cli(['help', 'videos', 'delete']);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/cuccut videos delete .*--yes/);
  });

  it('skill path does not connect to Runtime; help skill and help mcp show usage', async () => {
    const result = await cli(['skill', 'path', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result.hosts.map((host: { agent: string }) => host.agent)).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'gemini',
    ]);
    for (const noun of ['skill', 'mcp']) {
      const help = await cli(['help', noun]);
      expect(help.code, noun).toBe(0);
      expect(help.stdout, noun).toContain(`cuccut ${noun} install --agent`);
    }
    expect(fs.readdirSync(home)).toEqual([]);
  });
});

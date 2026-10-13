import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliError } from '../envelope.ts';
import { FakeClient, captureOutput } from '../testing/fake-client.ts';
import { AdminRun } from './context.ts';
import { installAgentSkill, skill, skillPaths } from './skill.ts';

let root: string;
let env: NodeJS.ProcessEnv;
let home: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-skill-install-'));
  home = path.join(root, 'cuccut-home');
  env = { HOME: path.join(root, 'user'), PATH: '', CUCCUT_AGENT_SKILLS_DIR: path.join(root, 'source') };
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const rendered = {
  interfaceVersion: 1,
  id: 'cuccut',
  sourceDir: '/src/skills/cuccut',
  files: [
    { path: 'SKILL.md', content: '# CucCut\n' },
    { path: 'references/start.md', content: '先 cuccut status\n' },
  ],
};

function run(args: string[], values: Record<string, unknown>, fake: FakeClient | null) {
  const capture = captureOutput();
  const ctx = new AdminRun({
    client: fake?.client ?? null,
    output: capture.output,
    cwd: root,
    home,
    env,
    args,
    values,
    usage: skill.usage,
  });
  return { capture, done: skill.run(ctx as never) };
}

describe('installAgentSkill', () => {
  it('copy: writes all files; reinstalling replaces the whole thing', () => {
    const target = path.join(root, 'skills', 'cuccut');
    expect(installAgentSkill(rendered, target, null)).toEqual({ mode: 'copy' });
    expect(fs.readFileSync(path.join(target, 'references', 'start.md'), 'utf8')).toBe('先 cuccut status\n');
    fs.writeFileSync(path.join(target, 'stale.md'), 'x');
    installAgentSkill(rendered, target, null);
    expect(fs.readdirSync(target).sort()).toEqual(['SKILL.md', 'references']);
    expect(fs.readdirSync(path.dirname(target))).toEqual(['cuccut']);
  });

  it('--link: puts the rendered output in the link directory, with the target being a link pointing to it', () => {
    const target = path.join(root, 'skills', 'cuccut');
    const linkDir = path.join(home, 'agent-skills', 'cuccut');
    expect(installAgentSkill(rendered, target, linkDir)).toEqual({ mode: 'link', linkTo: linkDir });
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# CucCut\n');
  });

  it('--link on Windows places a junction (no admin rights needed), other platforms place a directory link', () => {
    const target = path.join(root, 'skills', 'cuccut');
    const linkDir = path.join(home, 'agent-skills', 'cuccut');
    const symlink = vi.spyOn(fs, 'symlinkSync');
    try {
      // On non-Windows, Node ignores the link type, so it still gets created here; the test only checks the type passed to it.
      installAgentSkill(rendered, target, linkDir, 'win32');
      expect(symlink).toHaveBeenLastCalledWith(linkDir, expect.any(String), 'junction');
      installAgentSkill(rendered, target, linkDir, 'darwin');
      expect(symlink).toHaveBeenLastCalledWith(linkDir, expect.any(String), 'dir');
    } finally {
      symlink.mockRestore();
    }
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# CucCut\n');
  });

  it('replacing an existing link only swaps the link and leaves the directory it points to alone', () => {
    const other = path.join(root, 'v2-skill');
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'SKILL.md'), '旧的');
    const target = path.join(root, 'skills', 'cuccut');
    fs.mkdirSync(path.dirname(target));
    fs.symlinkSync(other, target, 'dir');
    installAgentSkill(rendered, target, null);
    expect(fs.lstatSync(target).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(other, 'SKILL.md'), 'utf8')).toBe('旧的');
  });

  it('an out-of-bounds path errors and the old target stays as it is', () => {
    const target = path.join(root, 'skills', 'cuccut');
    installAgentSkill(rendered, target, null);
    expect(() => installAgentSkill({ files: [{ path: '../escape.md', content: 'x' }] }, target, null)).toThrow(/越界/);
    expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('# CucCut\n');
    expect(fs.readdirSync(path.dirname(target))).toEqual(['cuccut']);
  });
});

describe('cuccut skill install', () => {
  it('installs into the host\'s skills directory (rendered output comes from catalog.agentSkill)', async () => {
    const fake = new FakeClient();
    fake.methods['catalog.agentSkill'] = () => rendered;
    const { capture, done } = run(['install'], { agent: 'codex' }, fake);
    expect(await done).toBe(0);
    const target = path.join(env.HOME!, '.codex', 'skills', 'cuccut');
    expect(capture.envelope().result).toEqual({
      agent: 'codex',
      target,
      mode: 'copy',
      replaced: false,
      sourceDir: rendered.sourceDir,
      files: 2,
    });
    expect(fs.existsSync(path.join(target, 'SKILL.md'))).toBe(true);
  });

  it('target exists, no --yes: CONFIRMATION_REQUIRED, does not connect to Runtime to fetch the manual', async () => {
    const target = path.join(env.HOME!, '.claude', 'skills', 'cuccut');
    fs.mkdirSync(target, { recursive: true });
    const fake = new FakeClient();
    const { done } = run(['install'], { agent: 'claude-code' }, fake);
    await expect(done).rejects.toSatisfy((error: unknown) => error instanceof CliError && error.code === 'CONFIRMATION_REQUIRED');
    expect(fake.calls).toEqual([]);
  });

  it('--dir works without --agent; giving neither is a usage error', async () => {
    const fake = new FakeClient();
    fake.methods['catalog.agentSkill'] = () => rendered;
    const { capture, done } = run(['install'], { dir: 'custom', link: true }, fake);
    expect(await done).toBe(0);
    expect(capture.envelope().result).toMatchObject({ agent: null, target: path.join(root, 'custom', 'cuccut'), mode: 'link' });
    await expect(run(['install'], {}, fake).done).rejects.toSatisfy(
      (error: unknown) => error instanceof CliError && error.code === 'INVALID_ARGUMENTS',
    );
  });
});

describe('cuccut skill path', () => {
  it('source and each host\'s location, and what is installed now', () => {
    const target = path.join(env.HOME!, '.gemini', 'skills', 'cuccut');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.join(root, 'elsewhere'), target);
    const paths = skillPaths(env, home);
    expect(paths.sourceDir).toBe(path.join(root, 'source', 'cuccut'));
    expect(paths.linkDir).toBe(path.join(home, 'agent-skills', 'cuccut'));
    expect(paths.hosts.map((host) => [host.agent, host.installed?.kind ?? null])).toEqual([
      ['claude-code', null],
      ['codex', null],
      ['cursor', null],
      ['gemini', 'link'],
    ]);
  });
});

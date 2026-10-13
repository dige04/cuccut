import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packagedResourceEnv as desktopResourceEnv, packagedResources } from '../../../desktop/src/main/packaged-resources.ts';
import { CliError, EXIT, exitCodeFor } from '../envelope.ts';
import {
  checkInterfaceVersion,
  ensureRuntime,
  packagedApps,
  packagedResourceEnv,
  resolveAgentSkillsDir,
  resolveRuntimeLaunch,
} from './connection.ts';

describe('Runtime entry and version gate', () => {
  it.each(['darwin', 'win32', 'linux'] as const)('%s packaged resource location matches the desktop app', (platform) => {
    const resources = path.join(os.tmpdir(), 'CucCut', 'resources');
    const env = packagedResourceEnv(resources, platform);
    expect(env).toEqual(desktopResourceEnv(packagedResources(resources), platform));
    expect(env.PMETAL_METALLIB_PATH).toBe(platform === 'darwin' ? path.join(resources, 'bin', 'mlx.metallib') : undefined);
  });

  it('manual source: CUCCUT_AGENT_SKILLS_DIR takes precedence; falls back to skills/ in the repo when unset, null when neither exists', () => {
    expect(resolveAgentSkillsDir({ CUCCUT_AGENT_SKILLS_DIR: '/x/skills' }, 'linux')).toBe('/x/skills');
    const repo = resolveAgentSkillsDir({}, 'linux');
    expect(repo).toMatch(/[/\\]skills$/);
    expect(fs.existsSync(path.join(repo!, 'cuccut', 'SKILL.md'))).toBe(true);
    expect(resolveAgentSkillsDir({}, 'linux', os.tmpdir())).toBeNull();
  });

  it('CUCCUT_RUNTIME_ENTRY takes precedence; falls back to the entry in the repo when unset', () => {
    expect(resolveRuntimeLaunch({ CUCCUT_RUNTIME_ENTRY: '/x/runtime.ts' }, 'linux')).toEqual({
      command: process.execPath,
      args: [path.resolve('/x/runtime.ts')],
      env: {},
      source: 'env',
    });
    expect(resolveRuntimeLaunch({ CUCCUT_RUNTIME_ENTRY: '/opt/cuccut-runtime' }, 'linux')).toMatchObject({
      command: path.resolve('/opt/cuccut-runtime'),
      args: [],
    });
    const repo = resolveRuntimeLaunch({}, 'linux');
    expect(repo?.source).toBe('repo');
    expect(repo?.args[0]).toMatch(/apps[/\\]runtime[/\\]src[/\\]main\.ts$/);
    expect(fs.existsSync(repo!.args[0]!)).toBe(true);
  });

  it('installed app: Windows per-user install location, macOS Applications', () => {
    const [win] = packagedApps({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32');
    expect(win).toEqual({
      executable: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\CucCut.exe',
      resources: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources',
    });
    expect(packagedApps({}, 'darwin')[0]?.executable).toBe('/Applications/CucCut.app/Contents/MacOS/CucCut');
  });

  it('different interface versions: exit code 3, states which side must be updated', () => {
    expect(() => checkInterfaceVersion('2', '2')).not.toThrow();
    const newer = catchError(() => checkInterfaceVersion('3', '2'));
    expect(newer.code).toBe('INTERFACE_VERSION_MISMATCH');
    expect(newer.extra).toMatchObject({ cli: '2', runtime: '3', update: 'cli' });
    expect(exitCodeFor(newer.code)).toBe(EXIT.runtimeUnavailable);
    expect(catchError(() => checkInterfaceVersion('1', '2')).extra.update).toBe('runtime');
  });

  it('--no-start with no Runtime: RUNTIME_UNAVAILABLE (exit code 3), does not start it', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-cli-home-'));
    try {
      const error = await ensureRuntime(home, { start: false }).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe('RUNTIME_UNAVAILABLE');
      expect(fs.existsSync(path.join(home, 'logs'))).toBe(false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

function catchError(fn: () => void): CliError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error('没有抛出');
}

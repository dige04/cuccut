import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { envValue, findOnPath, pathExtensions, windowsScriptKind } from './tool-probe.ts';

/** Finds a tool on PATH. On Windows, PATHEXT is checked against the injected platform in a temp directory (directory separators still follow the local machine). No file is executed. */

describe('finds tools on PATH', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-tool-probe-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function touch(...parts: string[]): Promise<string> {
    const file = path.join(dir, ...parts);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '', { mode: 0o755 });
    return file;
  }

  it('Windows: appends extensions in PATHEXT order within the same directory, with the bare name last', async () => {
    const cmd = await touch('a', 'yt-dlp.cmd');
    const exe = await touch('a', 'yt-dlp.exe');
    await touch('a', 'yt-dlp');
    const searchPath = path.join(dir, 'a');
    expect(await findOnPath('yt-dlp', searchPath, 'win32', '.COM;.EXE;.BAT;.CMD')).toBe(exe);
    expect(await findOnPath('yt-dlp', searchPath, 'win32', '.CMD;.EXE')).toBe(cmd);
    // Without PATHEXT, use .COM;.EXE;.BAT;.CMD.
    expect(await findOnPath('yt-dlp', searchPath, 'win32')).toBe(exe);
    // If the name already has an extension, look only for the exact name.
    expect(await findOnPath('yt-dlp.cmd', searchPath, 'win32')).toBe(cmd);
  });

  it('Windows: a .cmd in an earlier directory shadows a .exe in a later one (as on the command line); with only a bare name, the bare name is found', async () => {
    const cmd = await touch('a', 'yt-dlp.cmd');
    await touch('b', 'yt-dlp.exe');
    const bare = await touch('c', 'tool');
    const searchPath = [path.join(dir, 'a'), path.join(dir, 'b'), path.join(dir, 'c')].join(path.delimiter);
    expect(await findOnPath('yt-dlp', searchPath, 'win32', null)).toBe(cmd);
    expect(await findOnPath('tool', searchPath, 'win32', null)).toBe(bare);
  });

  it('other systems do not append extensions', async () => {
    await touch('a', 'yt-dlp.exe');
    const plain = await touch('b', 'yt-dlp');
    const searchPath = [path.join(dir, 'a'), path.join(dir, 'b')].join(path.delimiter);
    expect(await findOnPath('yt-dlp', searchPath, 'darwin', '.EXE')).toBe(plain);
  });

  it('PATHEXT splitting, case-insensitive environment variables, files on Windows that cannot be executed directly', () => {
    expect(pathExtensions('.COM;.EXE;;exe;.Cmd;.EXE')).toEqual(['.com', '.exe', '.cmd']);
    expect(pathExtensions('')).toEqual(['.com', '.exe', '.bat', '.cmd']);
    expect(envValue({ PathExt: '.EXE' }, 'PATHEXT')).toBe('.EXE');
    expect(envValue({ PATHEXT: '.CMD', PathExt: '.EXE' }, 'PATHEXT')).toBe('.CMD');
    expect(envValue({}, 'PATHEXT')).toBeUndefined();
    expect(windowsScriptKind('C:\\bin\\yt-dlp.EXE')).toBeNull();
    expect(windowsScriptKind('C:\\bin\\yt-dlp.com')).toBeNull();
    expect(windowsScriptKind('C:\\bin\\yt-dlp.cmd')).toBe('batch');
    expect(windowsScriptKind('C:\\bin\\yt-dlp.BAT')).toBe('batch');
    expect(windowsScriptKind('C:\\bin\\yt-dlp.ps1')).toBe('other');
    expect(windowsScriptKind('C:\\bin\\yt-dlp')).toBe('other');
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JobRecord, JobState } from '@cuccut/protocol';
import { silentLogger } from '@cuccut/harness';
import { activeImportStaging } from '../videos/package-import.ts';
import { sweepLeftovers } from './leftover-files.ts';

/**
 * Startup cleanup of leftovers (architecture design §5.8): deletes only export temp files and import staging directories that CucCut itself named, that are old enough, and that no in-progress job is using. User files, names that don't match, symbolic links, anything in subdirectories, and anything freshly written are never touched.
 */

describe('启动时清理导出与打开便携包的残留', () => {
  let dir: string;
  let exportsDir: string;
  let root: string;
  const hoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  beforeEach(async () => {
    dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-leftovers-')));
    exportsDir = path.join(dir, 'exports');
    root = path.join(dir, 'project');
    await fs.mkdir(exportsDir);
    await fs.mkdir(path.join(root, 'sub'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const exportJob = (state: JobState, files: string[]) =>
    ({ jobId: `job_${state}`, state, export: { destination: { dir: exportsDir, files, overwrite: false } } }) as unknown as JobRecord;

  async function file(at: string, old = true): Promise<string> {
    await fs.mkdir(path.dirname(at), { recursive: true });
    await fs.writeFile(at, 'x');
    if (old) await fs.utimes(at, hoursAgo, hoursAgo);
    return at;
  }

  async function folder(at: string, old = true): Promise<string> {
    await fs.mkdir(at, { recursive: true });
    await fs.writeFile(path.join(at, 'asset.bin'), 'x');
    if (old) await fs.utimes(at, hoursAgo, hoursAgo);
    return at;
  }

  async function exists(at: string): Promise<boolean> {
    return fs.lstat(at).then(
      () => true,
      () => false,
    );
  }

  it('只删自己命名、够旧、没在用的；其余原样留着', async () => {
    const e = (name: string) => path.join(exportsDir, name);
    const r = (name: string) => path.join(root, name);
    const gone = [
      await file(e('.成片.mp4.0a1b2c3d.tmp')),
      await file(e('.便携.cuccut.ffffffff.tmp')),
      await folder(r('.cuccut-import-0123abcd')),
    ];
    const outside = await file(path.join(dir, 'outside.txt'));
    const kept = [
      // User files and final outputs.
      await file(e('成片.mp4')),
      await file(e('.成片.mp4')),
      // Freshly written: may be an export in progress in another process.
      await file(e('.成片.mp4.12345678.tmp'), false),
      // Output names of in-progress exports.
      await file(e('.进行中.mp4.0a1b2c3d.tmp')),
      // Output names not in the ledger, and names that don't match.
      await file(e('.别人.mp4.0a1b2c3d.tmp')),
      await file(e('.成片.mp4.9A8B7C6D.tmp')),
      await file(e('.成片.mp4.0a1b2c3.tmp')),
      await file(e('.成片.mp4.0a1b2c3d.tmp.bak')),
      // Names that match but are directories.
      await folder(e('.成片.mp4.abcdef01.tmp')),
      // Freshly created, names that don't match, not directories, staging inside subdirectories.
      await folder(r('.cuccut-import-89abcdef'), false),
      await folder(r('.cuccut-import-zzzzzzzz')),
      await folder(r('cuccut-import-01234567')),
      await file(r('.cuccut-import-11111111')),
      await folder(r('sub/.cuccut-import-33333333')),
    ];
    // Symbolic links: not touched even when the name matches, and whatever they point to is not touched either.
    const linkedTemp = e('.成片.mp4.22222222.tmp');
    await fs.symlink(outside, linkedTemp);
    await fs.lutimes(linkedTemp, hoursAgo, hoursAgo);
    const linkedStaging = r('.cuccut-import-44444444');
    await fs.symlink(path.join(dir, 'exports'), linkedStaging);
    await fs.lutimes(linkedStaging, hoursAgo, hoursAgo);
    kept.push(linkedTemp, linkedStaging, outside);
    // Staging directories used by in-progress opens in this process.
    const active = await folder(r('.cuccut-import-55555555'));
    (activeImportStaging() as Set<string>).add(active);
    kept.push(active);

    try {
      const result = await sweepLeftovers({
        jobs: () => [
          exportJob('completed', ['成片.mp4']),
          exportJob('failed', ['便携.cuccut']),
          exportJob('running', ['进行中.mp4']),
          { jobId: 'job_other', state: 'completed' } as unknown as JobRecord,
        ],
        sourceRoots: () => [root, path.join(dir, 'missing')],
        log: silentLogger,
      });
      expect(result.removed.sort()).toEqual([...gone].sort());
    } finally {
      (activeImportStaging() as Set<string>).delete(active);
    }
    for (const at of gone) expect(await exists(at), at).toBe(false);
    for (const at of kept) expect(await exists(at), at).toBe(true);
    expect(await fs.readFile(outside, 'utf8')).toBe('x');
    expect(await fs.readdir(path.join(dir, 'exports'))).toContain('成片.mp4');
  });

  it('同一个目录里另一个导出还在运行时，只留它的输出名', async () => {
    const done = await file(path.join(exportsDir, '.a.mp4.0a1b2c3d.tmp'));
    const running = await file(path.join(exportsDir, '.b.mp4.0a1b2c3d.tmp'));
    const result = await sweepLeftovers({
      jobs: () => [exportJob('completed', ['a.mp4', 'b.mp4']), exportJob('queued', ['b.mp4'])],
      sourceRoots: () => [],
      log: silentLogger,
    });
    expect(result.removed).toEqual([done]);
    expect(await exists(running)).toBe(true);
  });
});

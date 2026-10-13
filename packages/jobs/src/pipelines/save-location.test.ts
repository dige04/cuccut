import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PipelineStepError } from './pipeline.ts';
import { ensureSaveDirectory, ensureSaveDirectoryForStep, readableStem, writableDirectoryProblem } from './save-location.ts';

/** Save location (architecture design §7.9): the directory is created, confirmed writable, and file names are readable. */

describe('save location directory', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-save-'));
  });
  afterEach(async () => {
    await fs.chmod(dir, 0o700).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('created level by level when absent', async () => {
    const target = path.join(dir, 'a', 'b');
    expect(await writableDirectoryProblem(target)).toBeNull();
    expect((await fs.stat(target)).isDirectory()).toBe(true);
  });

  it('is a file, or under a file: conflict at submit, step error at execution, both carry OUTPUT_DESTINATION_UNAVAILABLE', async () => {
    const file = path.join(dir, 'file');
    await fs.writeFile(file, 'x');
    for (const target of [file, path.join(file, 'sub')]) {
      await expect(ensureSaveDirectory(target)).rejects.toMatchObject({
        code: 'conflict',
        details: { code: 'OUTPUT_DESTINATION_UNAVAILABLE', dir: target },
      });
      const error = await ensureSaveDirectoryForStep(target).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PipelineStepError);
      expect(error).toMatchObject({ code: 'OUTPUT_DESTINATION_UNAVAILABLE' });
    }
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('no write permission: rejected', async () => {
    const locked = path.join(dir, 'locked');
    await fs.mkdir(locked);
    await fs.chmod(locked, 0o500);
    try {
      expect(await writableDirectoryProblem(locked)).toBe('EACCES');
    } finally {
      await fs.chmod(locked, 0o700);
    }
  });
});

describe('readable file name', () => {
  it('takes the leading segment, collapses whitespace into one space; empty text uses the fallback name', () => {
    expect(readableStem('  你好\n\t世界  ', 'speech')).toBe('你好 世界');
    expect(readableStem('   ', 'speech')).toBe('speech');
    expect([...readableStem('字'.repeat(100), 'x')]).toHaveLength(40);
  });

  it('removes path separators and reserved characters following the download file-name rules', () => {
    const stem = readableStem('a/b\\c:d*e?f"g<h>i|j', 'x');
    expect(stem).not.toMatch(/[/\\:*?"<>|]/);
  });
});

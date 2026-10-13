import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDownloadsDirectory, resolveSaveDirectory } from './downloads-directory.ts';

/** Download directory and save location (architecture design §7.9): the directory given by the call, then settings, then the host's Downloads folder, as fallbacks in that order. */

describe('保存位置', () => {
  const host = process.env.CUCCUT_DOWNLOADS_DIR;
  afterEach(() => {
    if (host === undefined) delete process.env.CUCCUT_DOWNLOADS_DIR;
    else process.env.CUCCUT_DOWNLOADS_DIR = host;
  });

  it('调用给了目录用它；否则设置；再否则主机的下载文件夹', () => {
    process.env.CUCCUT_DOWNLOADS_DIR = '/host/Downloads';
    expect(resolveSaveDirectory({ override: '/picked', settings: '/configured' })).toBe('/picked');
    expect(resolveSaveDirectory({ override: null, settings: '/configured' })).toBe('/configured');
    expect(resolveSaveDirectory({ settings: null })).toBe('/host/Downloads');
    expect(resolveSaveDirectory({ override: '', settings: null })).toBe(resolveDownloadsDirectory(null));
  });

  it('主机没有传下载文件夹时用主目录下的 Downloads', () => {
    delete process.env.CUCCUT_DOWNLOADS_DIR;
    expect(resolveSaveDirectory({ settings: null })).toBe(path.join(os.homedir(), 'Downloads'));
  });
});

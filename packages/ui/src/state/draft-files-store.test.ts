import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@cuccut/protocol';
import { COMPOSER_MENU } from '../copy.ts';
import { useDraftFiles } from './draft-files-store.ts';

describe('session file reference draft', () => {
  beforeEach(() => useDraftFiles.setState({ files: {} }));
  const file = (path: string) => ({ path, kind: 'file' as const });

  it('different sessions are isolated, the same path is deduplicated, directory type is kept', () => {
    const store = useDraftFiles.getState();
    expect(store.add('a', [file('/one'), file('/one'), { path: '/folder', kind: 'directory' }])).toBe(0);
    store.add('b', [file('/two')]);
    expect(useDraftFiles.getState().files.a).toEqual([file('/one'), { path: '/folder', kind: 'directory' }]);
    store.remove('a', '/one');
    expect(useDraftFiles.getState().files.a).toEqual([{ path: '/folder', kind: 'directory' }]);
    expect(useDraftFiles.getState().files.b).toEqual([file('/two')]);
  });

  it('at most 8 paths; duplicates do not take up a slot; references added while sending are kept', () => {
    const store = useDraftFiles.getState();
    const first = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => file(`/f${i}`));
    expect(store.add('a', [...first, first[0]!, file('/extra')])).toBe(1);
    store.sent('a', first.map(entry => entry.path));
    expect(useDraftFiles.getState().files.a).toBeUndefined();
    store.add('a', [file('/sent')]);
    store.add('a', [file('/added-later')]);
    store.sent('a', ['/sent']);
    expect(useDraftFiles.getState().files.a).toEqual([file('/added-later')]);
  });

  it('paths passed to the agent are quoted line by line, keeping spaces and backslashes; a newline in a file name does not become an extra instruction line', () => {
    expect(COMPOSER_MENU.filesMessage(['/a folder/a.txt', 'C:\\my files\\test.txt', '/name\nnew line'])).toBe(
      '文件和文件夹:\n"/a folder/a.txt"\n"C:\\\\my files\\\\test.txt"\n"/name\\nnew line"',
    );
  });
});

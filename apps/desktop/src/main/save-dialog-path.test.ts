import { describe, expect, it } from 'vitest';
import { SAVE_FILE_MAX_BYTES, saveDialogPath, saveFileData } from './save-dialog-path.ts';

describe('initial path of the system save dialog', () => {
  it('uses the chosen directory; a file name cannot bring in another directory', () => {
    expect(saveDialogPath('/other/访谈.mp4', '/Volumes/成片 disk', 'darwin')).toBe('/Volumes/成片 disk/访谈.mp4');
    expect(saveDialogPath('访谈.mp4', 'relative', 'darwin')).toBe('访谈.mp4');
    expect(saveDialogPath('访谈.mp4', '/bad\0dir', 'darwin')).toBe('访谈.mp4');
    expect(saveDialogPath(undefined, undefined, 'darwin')).toBeUndefined();
  });
  it.each([
    ['C:\\成片 disk', 'C:\\成片 disk\\访谈.mp4'],
    ['C:/成片 disk', 'C:\\成片 disk\\访谈.mp4'],
    ['\\\\server\\共享', '\\\\server\\共享\\访谈.mp4'],
    ['\\\\?\\C:\\成片', '\\\\?\\C:\\成片\\访谈.mp4'],
    ['\\\\?\\UNC\\server\\共享', '\\\\?\\UNC\\server\\共享\\访谈.mp4'],
  ])('Windows initial directory %s', (dir, expected) => {
    expect(saveDialogPath('D:/other/访谈.mp4', dir, 'win32')).toBe(expected);
  });
});

describe('content handed over by the renderer process to save', () => {
  it('accepts only Uint8Array, rejects content over the limit', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(saveFileData(bytes)).toBe(bytes);
    expect(() => saveFileData('abc')).toThrow();
    expect(() => saveFileData(new ArrayBuffer(3))).toThrow();
    expect(() => saveFileData(undefined)).toThrow();
    expect(() => saveFileData({ byteLength: 1 })).toThrow();
    expect(() => saveFileData(new Uint8Array(new ArrayBuffer(0), 0, 0))).not.toThrow();
    expect(SAVE_FILE_MAX_BYTES).toBe(512 * 1024 * 1024);
  });
});

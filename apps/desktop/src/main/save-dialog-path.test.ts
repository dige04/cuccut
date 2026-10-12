import { describe, expect, it } from 'vitest';
import { SAVE_FILE_MAX_BYTES, saveDialogPath, saveFileData } from './save-dialog-path.ts';

describe('系统保存窗口初始路径', () => {
  it('使用选定目录，文件名不能带入其他目录', () => {
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
  ])('Windows 初始目录 %s', (dir, expected) => {
    expect(saveDialogPath('D:/other/访谈.mp4', dir, 'win32')).toBe(expected);
  });
});

describe('渲染进程交来要保存的内容', () => {
  it('只收 Uint8Array，超过上限的不收', () => {
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

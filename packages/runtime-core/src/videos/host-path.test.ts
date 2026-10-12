import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hostPath } from './host-path.ts';

describe('Windows engine paths', () => {
  it('keeps reopened drive paths relative to the project', () => {
    const dir = hostPath('\\\\?\\C:\\CucCut\\Project\\Video', 'win32');
    expect(dir).toBe('C:\\CucCut\\Project\\Video');
    expect(path.win32.relative('C:\\CucCut\\Project', dir)).toBe('Video');
  });

  it('keeps network-share paths relative to the project', () => {
    const dir = hostPath('\\\\?\\UNC\\server\\share\\Project\\Video', 'win32');
    expect(dir).toBe('\\\\server\\share\\Project\\Video');
    expect(path.win32.relative('\\\\server\\share\\Project', dir)).toBe('Video');
  });

  it('preserves ordinary paths, other namespaces and non-Windows names', () => {
    for (const value of ['C:\\CucCut\\Video', '\\\\server\\share\\Video', '\\\\?\\Volume{123}\\Video']) {
      expect(hostPath(value, 'win32')).toBe(value);
    }
    expect(hostPath('\\\\?\\C:\\Video', 'linux')).toBe('\\\\?\\C:\\Video');
  });
});

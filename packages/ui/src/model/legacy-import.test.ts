import { describe, expect, it } from 'vitest';
import { displayDirectory, legacyImportDecision } from './legacy-import.ts';

describe('legacy import prompt', () => {
  it('imports, skips for this launch, or records never', () => {
    expect(legacyImportDecision('import', false)).toBe('import');
    // Ticked “don't remind again”, then clicked “import”: import as usual.
    expect(legacyImportDecision('import', true)).toBe('import');
    // Skipping sends no request: ask again on next launch.
    expect(legacyImportDecision('skip', false)).toBeNull();
    expect(legacyImportDecision('skip', true)).toBe('never');
  });

  it('shortens the home folder on macOS and Linux and keeps Windows paths as they are', () => {
    expect(displayDirectory('/Users/jim/Documents/CucCut/', 'darwin')).toBe('~/Documents/CucCut');
    expect(displayDirectory('/home/jim/Documents/CucCut', 'linux')).toBe('~/Documents/CucCut');
    expect(displayDirectory('/Volumes/ExtremeSSD/CucCut', 'darwin')).toBe('/Volumes/ExtremeSSD/CucCut');
    expect(displayDirectory('C:\\Users\\jim\\Documents\\CucCut\\', 'win32')).toBe('C:\\Users\\jim\\Documents\\CucCut');
    expect(displayDirectory('\\\\nas\\video\\CucCut', 'win32')).toBe('\\\\nas\\video\\CucCut');
    expect(displayDirectory('D:\\', 'win32')).toBe('D:\\');
    expect(displayDirectory('/', 'darwin')).toBe('/');
  });
});

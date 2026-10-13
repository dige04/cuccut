import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compilerAvailable, resolveSlidesEditorDist } from './slides-compiler.ts';

/** Lookup of the editor build output (docs/design/slides §3): the directory the environment variable points to only counts if it actually contains build output. */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cuccut-slides-dist-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveSlidesEditorDist', () => {
  it('uses index.html in the directory named by the env variable when present', async () => {
    await writeFile(path.join(dir, 'index.html'), '<!doctype html>');
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: dir })).toBe(dir);
  });

  it('null when the env-variable directory does not exist or is empty (editor not bundled at build time)', async () => {
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: path.join(dir, 'slides-editor') })).toBeNull();
    await mkdir(path.join(dir, 'empty'));
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: path.join(dir, 'empty') })).toBeNull();
  });

  it('compiler requires node/compiler.cjs in the build directory', async () => {
    expect(compilerAvailable(null)).toBe(false);
    expect(compilerAvailable(dir)).toBe(false);
    await mkdir(path.join(dir, 'node'));
    await writeFile(path.join(dir, 'node', 'compiler.cjs'), '');
    expect(compilerAvailable(dir)).toBe(true);
  });
});

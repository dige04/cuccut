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
  it('环境变量指的目录里有 index.html 时用它', async () => {
    await writeFile(path.join(dir, 'index.html'), '<!doctype html>');
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: dir })).toBe(dir);
  });

  it('环境变量指的目录不存在或是空的时为 null（打包时没带编辑器）', async () => {
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: path.join(dir, 'slides-editor') })).toBeNull();
    await mkdir(path.join(dir, 'empty'));
    expect(resolveSlidesEditorDist({ CUCCUT_SLIDES_EDITOR_DIST: path.join(dir, 'empty') })).toBeNull();
  });

  it('编译器要构建目录里有 node/compiler.cjs', async () => {
    expect(compilerAvailable(null)).toBe(false);
    expect(compilerAvailable(dir)).toBe(false);
    await mkdir(path.join(dir, 'node'));
    await writeFile(path.join(dir, 'node', 'compiler.cjs'), '');
    expect(compilerAvailable(dir)).toBe(true);
  });
});

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveDesignSystemEditorDist } from './editor-dist.ts';

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
});

describe('resolveDesignSystemEditorDist', () => {
  it('CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: uses the directory it points to when it has index.html, null otherwise (no further searching elsewhere)', async () => {
    const built = await mkdtemp(path.join(tmpdir(), 'design-system-dist-'));
    roots.push(built);
    await writeFile(path.join(built, 'index.html'), '<!doctype html>');
    expect(resolveDesignSystemEditorDist({ CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: built })).toBe(built);
    const empty = await mkdtemp(path.join(tmpdir(), 'design-system-dist-'));
    roots.push(empty);
    expect(resolveDesignSystemEditorDist({ CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: empty })).toBeNull();
  });

  it('in the packaged app it is <resources>/design-system-editor', async () => {
    const resources = await mkdtemp(path.join(tmpdir(), 'design-system-resources-'));
    roots.push(resources);
    await mkdir(path.join(resources, 'design-system-editor'));
    await writeFile(path.join(resources, 'design-system-editor', 'index.html'), '<!doctype html>');
    const proc = process as { resourcesPath?: string };
    const saved = proc.resourcesPath;
    proc.resourcesPath = resources;
    try {
      expect(resolveDesignSystemEditorDist({})).toBe(path.join(resources, 'design-system-editor'));
    } finally {
      if (saved === undefined) delete proc.resourcesPath;
      else proc.resourcesPath = saved;
    }
  });
});

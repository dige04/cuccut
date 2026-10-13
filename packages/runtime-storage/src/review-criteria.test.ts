import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewStandard } from '@cuccut/protocol';
import { ReviewCriteriaConflictError, ReviewCriteriaStore } from './review-criteria.ts';
import { resolveRuntimeHome } from './home.ts';

const standard = (max: number): ReviewStandard => ({
  schema: 'cuccut.review-criteria/1',
  checks: [{ id: 'long', metric: 'video.durationSec', max, severity: 'critical', fix: 'Trim it.' }],
  rubric: [{ id: 'opens', ask: 'Does it open on the point?', evidence: 'timestamp', severity: 'suggestion', fix: 'Start later.' }],
});

describe('review criteria store', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-review-criteria-'));
    file = path.join(dir, 'store', 'review-criteria.json');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('lives in the store folder of the Runtime Home', () => {
    expect(resolveRuntimeHome({ CUCCUT_HOME: dir }).reviewCriteriaFile).toBe(path.join(dir, 'store', 'review-criteria.json'));
  });

  it('starts empty without a file, and reads back what it wrote', async () => {
    const store = new ReviewCriteriaStore(file);
    expect(await store.load()).toEqual({ standard: { schema: 'cuccut.review-criteria/1', checks: [], rubric: [] }, revision: 0 });
    await store.set(standard(60));
    expect(store.get().revision).toBe(1);
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toMatchObject({ schemaVersion: 1, revision: 1 });
    const again = new ReviewCriteriaStore(file);
    expect(await again.load()).toEqual({ standard: standard(60), revision: 1 });
  });

  it('refuses a write against an older revision', async () => {
    const store = new ReviewCriteriaStore(file);
    await store.load();
    await store.set(standard(60), 0);
    await expect(store.set(standard(30), 0)).rejects.toBeInstanceOf(ReviewCriteriaConflictError);
    expect(store.get().standard.checks[0]!.max).toBe(60);
  });

  it('keeps what still parses, and renames a file that is not JSON', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        revision: 4,
        standard: { checks: [{ id: 'ok', metric: 'video.durationSec', max: 60 }, { id: 'Bad Id', metric: 'x' }], rubric: 'nope' },
      }),
    );
    const loaded = await new ReviewCriteriaStore(file).load();
    expect(loaded.revision).toBe(4);
    expect(loaded.standard.checks.map((c) => c.id)).toEqual(['ok']);
    expect(loaded.standard.rubric).toEqual([]);

    await fs.writeFile(file, '{ not json');
    expect((await new ReviewCriteriaStore(file).load()).standard.checks).toEqual([]);
    const names = await fs.readdir(path.dirname(file));
    expect(names.some((n) => n.startsWith('review-criteria.json.corrupt-'))).toBe(true);
  });

  it('does not rewrite a file from a newer version', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const newer = JSON.stringify({ schemaVersion: 2, standard: { future: true } });
    await fs.writeFile(file, newer);
    const store = new ReviewCriteriaStore(file);
    expect((await store.load()).standard.checks).toEqual([]);
    await store.set(standard(60));
    expect(store.get().standard.checks).toHaveLength(1);
    expect(await fs.readFile(file, 'utf8')).toBe(newer);
  });

  it('serialises writes in the order they were made', async () => {
    const store = new ReviewCriteriaStore(file);
    await store.load();
    await Promise.all([10, 20, 30, 40].map((max) => store.set(standard(max))));
    await store.flush();
    expect(store.get()).toMatchObject({ revision: 4 });
    const reread = await new ReviewCriteriaStore(file).load();
    expect(reread.revision).toBe(4);
    expect(reread.standard.checks[0]!.max).toBe(40);
  });
});

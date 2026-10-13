import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BundleDefinition } from './bundle-registry.ts';
import { INSTALL_RECORD_FILE, readInstallRecord, updateInstallRecord } from './install-record.ts';
import {
  MOVE_JOURNAL_FILE,
  MOVING_DIR,
  moveModels,
  nestedDirs,
  planMove,
  recoverMove,
  removeSources,
  scanModelsDir,
} from './models-dir.ts';
import { syntheticBytes, writeSyntheticRepo, type SyntheticRepo } from './testing/fake-model-source.ts';

const ASR: SyntheticRepo = {
  repo: 'test/asr',
  revision: 'a'.repeat(40),
  files: { 'config.json': Buffer.from('{}'), 'weights/model.safetensors': syntheticBytes(50_000, 1) },
};
const VAD: SyntheticRepo = { repo: 'test/vad', revision: 'b'.repeat(40), files: { 'model.bin': syntheticBytes(20_000, 2) } };
const OTHER: SyntheticRepo = { repo: 'someone/else', revision: 'c'.repeat(40), files: { 'x.bin': syntheticBytes(1_000, 3) } };
const BUNDLES: BundleDefinition[] = [
  {
    bundleId: 'asr@mlx',
    capability: 'transcribe',
    backend: 'mlx',
    device: 'metal',
    label: 'ASR',
    components: {
      asr: { family: 'qwen3-asr', repo: ASR.repo, revision: ASR.revision },
      vad: { family: 'silero-vad', repo: VAD.repo, revision: VAD.revision },
    },
  },
];
const size = (r: SyntheticRepo) => Object.values(r.files).reduce((n, b) => n + b.length, 0);

let tmp: string;
let from: string;
let to: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-models-dir-'));
  from = path.join(tmp, 'from');
  to = path.join(tmp, 'to');
  await fs.mkdir(from);
  await fs.mkdir(to);
  for (const repo of [ASR, VAD, OTHER]) await writeSyntheticRepo(from, repo);
  await updateInstallRecord(from, (r) => {
    r.bundles['asr@mlx'] = { installedAt: '2026-10-01T00:00:00.000Z' };
  });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const exists = (p: string) =>
  fs.stat(p).then(
    () => true,
    () => false,
  );

describe('on-disk operations of the model directory', () => {
  it('recognizes models by manifest: registered repos count toward size and model packs, other repos are only listed; a missing folder is empty', async () => {
    const scan = await scanModelsDir(from, BUNDLES);
    expect(scan.repos.map((r) => [r.repo, r.known])).toEqual([
      ['someone/else', false],
      ['test/asr', true],
      ['test/vad', true],
    ]);
    expect(scan.bundleIds).toEqual(['asr@mlx']);
    expect(scan.bytes).toBe(size(ASR) + size(VAD));
    expect(await scanModelsDir(path.join(tmp, 'nope'), BUNDLES)).toEqual({ repos: [], bundleIds: [], bytes: 0 });
  });

  it('directories that contain each other', () => {
    expect(nestedDirs('/a/b', '/a/b')).toBe('same');
    expect(nestedDirs('/a/b', '/a/b/c')).toBe('nested');
    expect(nestedDirs('/a/b/c', '/a/b')).toBe('nested');
    expect(nestedDirs('/a/b', '/a/bc')).toBeNull();
  });

  it('plan: a target that already has the same version is not moved again; a same-named other version stays where it is', async () => {
    await writeSyntheticRepo(to, VAD);
    await writeSyntheticRepo(to, { ...ASR, revision: 'd'.repeat(40) });
    const plan = await planMove(from, to, BUNDLES);
    expect(plan.move).toEqual([]);
    expect(plan.present.map((r) => r.repo)).toEqual(['test/vad']);
    expect(plan.blocked.map((r) => r.repo)).toEqual(['test/asr']);
  });

  for (const same of [true, false]) {
    const label = same ? '同一块盘（改名）' : '跨盘（复制、校验）';

    it(`${label}: moves over, merges install records, progress by bytes; deletes the original directory after switching over`, async () => {
      await updateInstallRecord(to, (r) => {
        r.bundles['other@mlx'] = { installedAt: '2026-09-01T00:00:00.000Z' };
      });
      const plan = await planMove(from, to, BUNDLES);
      const progress: number[] = [];
      await moveModels({
        from,
        to,
        repos: plan.move,
        sameVolume: same,
        signal: new AbortController().signal,
        onProgress: (p) => progress.push(p.done),
      });
      expect((await scanModelsDir(to, BUNDLES)).bundleIds).toEqual(['asr@mlx']);
      expect(Object.keys((await readInstallRecord(to)).bundles).sort()).toEqual(['asr@mlx', 'other@mlx']);
      expect(progress.at(-1)).toBe(plan.bytes);
      expect(await exists(path.join(to, MOVING_DIR))).toBe(false);
      // The log is kept until after the switch-over; unrecognised repositories are left alone.
      expect(await exists(path.join(from, MOVE_JOURNAL_FILE))).toBe(true);
      expect(await exists(path.join(from, 'someone', 'else'))).toBe(true);
      expect(await exists(path.join(from, 'test', 'asr'))).toBe(!same);
      expect(
        await removeSources(
          from,
          plan.move.map((r) => r.repo),
        ),
      ).toEqual([]);
      expect(await exists(path.join(from, 'test'))).toBe(false);
      expect(await exists(path.join(from, INSTALL_RECORD_FILE))).toBe(false);
    });

    it(`${label}: on failure midway rolls back, original directory left as is, nothing left in the target`, async () => {
      const plan = await planMove(from, to, BUNDLES);
      const failing = moveModels({
        from,
        to,
        repos: plan.move,
        sameVolume: same,
        signal: new AbortController().signal,
        beforePlace: (repo) => {
          if (repo === 'test/vad') throw new Error('注入的失败');
        },
      });
      await expect(failing).rejects.toThrow('注入的失败');
      expect((await scanModelsDir(from, BUNDLES)).bundleIds).toEqual(['asr@mlx']);
      expect((await scanModelsDir(to, BUNDLES)).repos).toEqual([]);
      expect(await exists(path.join(to, MOVING_DIR))).toBe(false);
      expect(await exists(path.join(to, INSTALL_RECORD_FILE))).toBe(false);
      expect(await exists(path.join(from, MOVE_JOURNAL_FILE))).toBe(false);
    });

    it(`${label}: rolls back on cancel`, async () => {
      const plan = await planMove(from, to, BUNDLES);
      const abort = new AbortController();
      const cancelled = moveModels({
        from,
        to,
        repos: plan.move,
        sameVolume: same,
        signal: abort.signal,
        beforePlace: (repo) => {
          if (repo === 'test/vad') abort.abort(new Error('取消'));
          abort.signal.throwIfAborted();
        },
      });
      await expect(cancelled).rejects.toThrow('取消');
      expect((await scanModelsDir(from, BUNDLES)).bundleIds).toEqual(['asr@mlx']);
      expect((await scanModelsDir(to, BUNDLES)).repos).toEqual([]);
    });
  }

  it('fails and rolls back when a file copied across disks fails verification', async () => {
    const plan = await planMove(from, to, BUNDLES);
    // A file in the original directory was corrupted (size unchanged): the copy does not match the manifest.
    const file = path.join(from, 'test', 'vad', 'model.bin');
    const bytes = await fs.readFile(file);
    bytes[0] = bytes[0]! ^ 0xff;
    await fs.writeFile(file, bytes);
    await expect(moveModels({ from, to, repos: plan.move, sameVolume: false, signal: new AbortController().signal })).rejects.toThrow(
      'Checksum of model.bin',
    );
    expect((await scanModelsDir(to, BUNDLES)).repos).toEqual([]);
    expect(await exists(path.join(to, MOVING_DIR))).toBe(false);
    expect(await exists(path.join(from, 'test', 'asr', 'config.json'))).toBe(true);
  });

  it('on startup, rolls back an unfinished move according to the log: on the same disk, renames back', async () => {
    // Crashes after pretending a repository was renamed over.
    await fs.writeFile(
      path.join(from, MOVE_JOURNAL_FILE),
      JSON.stringify({ format_version: 1, to, sameVolume: true, repos: ['test/asr', 'test/vad'] }),
    );
    await fs.mkdir(path.join(to, 'test'), { recursive: true });
    await fs.rename(path.join(from, 'test', 'asr'), path.join(to, 'test', 'asr'));
    await fs.mkdir(path.join(to, MOVING_DIR), { recursive: true });
    expect(await recoverMove(from)).toEqual({ restored: ['test/asr'] });
    expect((await scanModelsDir(from, BUNDLES)).bundleIds).toEqual(['asr@mlx']);
    expect(await exists(path.join(to, 'test', 'asr'))).toBe(false);
    expect(await exists(path.join(to, MOVING_DIR))).toBe(false);
    expect(await exists(path.join(from, MOVE_JOURNAL_FILE))).toBe(false);
    expect(await recoverMove(from)).toBeNull();
  });
});

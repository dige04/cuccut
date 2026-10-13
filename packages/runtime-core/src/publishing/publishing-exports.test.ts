import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import type { PublicationDetail } from '@cuccut/protocol';
import { PublishingExports } from './publishing-exports.ts';
import { PublishingService } from './publishing-service.ts';
import { HUMAN, codeOf, publishingFixture, type PublishingFixture } from './testing/fake-publishing.ts';

let root: string;
let fx: PublishingFixture;
let files: PublishingExports;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-exports-'));
  fx = await publishingFixture(root);
  files = fx.service.files;
});

afterEach(async () => {
  await fx.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

const EXPECT = { videoId: 'video_1', sequenceId: 'seq_1', requireCurrent: true };

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function prepared(): Promise<PublicationDetail> {
  const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
  return p!;
}

describe('pinning from an export job', () => {
  it('hard-links the artifact as a read-only file named by its hash', async () => {
    const { jobId, sha256, file } = await fx.jobs.finishedExport('finished video');
    const pinned = await files.pinJob(jobId, EXPECT);
    expect(pinned).toMatchObject({ id: `sha256:${sha256}`, sha256, videoId: 'video_1', sequenceId: 'seq_1', videoRevision: 'rev_current', jobId, bytes: 14 });
    const target = files.file(pinned);
    expect(target).toBe(path.join(fx.dir, 'exports', `${sha256}.mp4`));
    const [stat, source] = await Promise.all([fs.stat(target), fs.stat(file)]);
    expect(stat.mode & 0o777).toBe(0o444);
    expect(stat.ino).toBe(source.ino);
    await files.verify(pinned);
    // Pinning the same output again keeps the file in place.
    expect((await files.pinJob(jobId, EXPECT)).sha256).toBe(sha256);
  });

  it('copies the published file when the artifact library does not have it', async () => {
    const { jobId, sha256, file } = await fx.jobs.finishedExport('published only');
    const published = path.join(root, 'out.mp4');
    await fs.copyFile(file, published);
    fx.jobs.files.clear();
    await fs.rm(file);
    const job = fx.jobs.inspect(jobId);
    fx.jobs.set(jobId, { result: { ...job.result!, outputs: [{ ...job.result!.outputs![0]!, path: published }] } });
    const pinned = await files.pinJob(jobId, EXPECT);
    const stat = await fs.stat(files.file(pinned));
    expect(stat.ino).not.toBe((await fs.stat(published)).ino);
    expect(pinned.sha256).toBe(sha256);
  });

  it('refuses what is not a finished whole-video MP4 export of this video at its current revision', async () => {
    expect(await codeOf(files.pinJob('job_missing', EXPECT))).toBe('EXPORT_NOT_FOUND');
    const other = await fx.jobs.finishedExport('other video', { videoId: 'video_2' });
    expect(await codeOf(files.pinJob(other.jobId, EXPECT))).toBe('EXPORT_OTHER_VIDEO');
    const otherSequence = await fx.jobs.finishedExport('other sequence', { sequenceId: 'seq_2' });
    expect(await codeOf(files.pinJob(otherSequence.jobId, EXPECT))).toBe('EXPORT_OTHER_VIDEO');
    const range = await fx.jobs.finishedExport('a range', { range: true });
    expect(await codeOf(files.pinJob(range.jobId, EXPECT))).toBe('EXPORT_NOT_VIDEO');
    const stale = await fx.jobs.finishedExport('older edit', { videoRevision: 'rev_old' });
    expect(await codeOf(files.pinJob(stale.jobId, EXPECT))).toBe('EXPORT_STALE');
    // "Render and pin" pins its own output even when the video changed meanwhile.
    expect((await files.pinJob(stale.jobId, { ...EXPECT, requireCurrent: false })).videoRevision).toBe('rev_old');
    const { jobId } = await fx.jobs.exports.create({ videoId: 'video_1', settings: { kind: 'video', format: 'mp4', sequenceId: 'seq_1' } }, HUMAN.submitter);
    expect(await codeOf(files.pinJob(jobId, EXPECT))).toBe('EXPORT_NOT_FINISHED');
  });

  it('refuses a file that changed or went missing', async () => {
    const changed = await fx.jobs.finishedExport('original bytes');
    await fs.writeFile(changed.file, 'changed bytes');
    expect(await codeOf(files.pinJob(changed.jobId, EXPECT))).toBe('EXPORT_FILE_CHANGED');
    const missing = await fx.jobs.finishedExport('gone');
    await fs.rm(missing.file);
    expect(await codeOf(files.pinJob(missing.jobId, EXPECT))).toBe('EXPORT_FILE_MISSING');
  });

  it('verify notices a missing pinned file', async () => {
    const { jobId } = await fx.jobs.finishedExport('to remove');
    const pinned = await files.pinJob(jobId, EXPECT);
    await fs.chmod(files.file(pinned), 0o644);
    await fs.rm(files.file(pinned));
    expect(await codeOf(files.verify(pinned))).toBe('EXPORT_CHANGED');
  });

  it('lists pinnable exports newest first, marking the current revision', async () => {
    await fx.jobs.finishedExport('old', { videoRevision: 'rev_old', jobId: 'job_a' });
    fx.jobs.set('job_a', { endedAt: '2026-10-12T10:00:00.000Z' });
    await fx.jobs.finishedExport('new', { jobId: 'job_b' });
    await fx.jobs.finishedExport('range', { jobId: 'job_c', range: true });
    await fx.jobs.finishedExport('other', { jobId: 'job_d', videoId: 'video_2' });
    expect(fx.service.pinnable('video_1').map((e) => [e.jobId, e.current])).toEqual([
      ['job_b', true],
      ['job_a', false],
    ]);
  });

  it('cleanup removes pinned files that are not kept, and leftover temporary files', async () => {
    const a = await files.pinJob((await fx.jobs.finishedExport('keep me')).jobId, EXPECT);
    const b = await files.pinJob((await fx.jobs.finishedExport('drop me')).jobId, EXPECT);
    await fs.writeFile(path.join(files.dir, 'x.mp4.1.2.tmp'), 'partial');
    await fs.writeFile(path.join(files.dir, 'notes.txt'), 'not ours');
    const result = await files.cleanup(new Set([a.sha256]));
    expect(result).toEqual({ files: 1, bytes: 'drop me'.length + 'partial'.length });
    expect((await fs.readdir(files.dir)).sort()).toEqual([`${a.sha256}.mp4`, 'notes.txt']);
    expect(b.sha256).not.toBe(a.sha256);
  });
});

describe('pin on a publication', () => {
  it('pins a chosen export and keeps the approval with the export it named', async () => {
    let p = await prepared();
    expect(fx.service.row(p).exportPosterId).toBeUndefined();
    const first = await fx.jobs.finishedExport('first');
    p = (await fx.service.pin(p.id, p.revision, { jobId: first.jobId }, HUMAN)).publication;
    expect(p.export?.sha256).toBe(first.sha256);
    // The calendar row names the pinned export, so entries fetch a thumbnail only when there is one.
    expect(fx.service.row(p).exportPosterId).toBe(p.exportId);
    expect(p.newerEdit).toBe(false);
    p = await fx.service.approve(p.id, p.revision, HUMAN);
    expect(p.approved).toBe(true);
    const second = await fx.jobs.finishedExport('second');
    p = (await fx.service.pin(p.id, p.revision, { jobId: second.jobId }, HUMAN)).publication;
    expect(p.export?.sha256).toBe(second.sha256);
    expect(p.approved).toBe(false);
    expect(p.issues.map((issue) => issue.code)).toContain('approvalRequired');
    fx.videos.add({ videoId: 'video_1', revision: 'rev_next' });
    expect(fx.service.get(p.id).newerEdit).toBe(true);
  });

  it('render and pin: submits an MP4 export, then pins its output when it finishes', async () => {
    const p = await prepared();
    const { publication, jobId } = await fx.service.pin(p.id, p.revision, { render: true }, HUMAN);
    expect(jobId).toBeDefined();
    expect(publication.pinJob).toMatchObject({ jobId, error: null });
    expect(fx.jobs.exportRequests).toEqual([{ videoId: 'video_1', sequenceId: 'seq_1', submitter: HUMAN.submitter, jobId }]);
    expect([fx.videos.opened, fx.videos.released]).toEqual([1, 1]);

    await fx.jobs.finishExport(jobId!, 'rendered output');
    await until(() => fx.service.publication(p.id).exportId !== null);
    const saved = fx.service.get(p.id);
    expect(saved.pinJob).toBeNull();
    expect(saved.export?.jobId).toBe(jobId);
  });

  it('render and pin records a failed or cancelled export', async () => {
    const p = await prepared();
    const { jobId } = await fx.service.pin(p.id, p.revision, { render: true }, HUMAN);
    await fx.jobs.finishExport(jobId!, null, 'cancelled');
    await until(() => fx.service.publication(p.id).pinJob?.error !== null);
    expect(fx.service.publication(p.id).pinJob?.errorRef?.key).toBe('rcPublishing.renderCancelled');

    const again = fx.service.publication(p.id);
    const retry = await fx.service.pin(p.id, again.revision, { render: true }, HUMAN);
    fx.jobs.set(retry.jobId!, { state: 'failed', endedAt: '2026-10-13T10:00:00.000Z', error: null });
    await until(() => fx.service.publication(p.id).pinJob?.error !== null);
    expect(fx.service.publication(p.id).pinJob).toMatchObject({ jobId: retry.jobId, errorRef: { key: 'rcPublishing.renderFailed' } });
  });

  it('a render still running when the Runtime stops is pinned after the next start', async () => {
    const p = await prepared();
    const { jobId } = await fx.service.pin(p.id, p.revision, { render: true }, HUMAN);
    await fx.service.close();

    const service = await PublishingService.open({
      file: fx.file,
      dir: fx.dir,
      jobs: fx.jobs,
      exports: fx.jobs.exports,
      videos: fx.videos,
      log: silentLogger,
      now: fx.clock.now,
    });
    try {
      service.start();
      await fx.jobs.finishExport(jobId!, 'finished while away');
      await until(() => service.publication(p.id).exportId !== null);
      expect(service.publication(p.id).pinJob).toBeNull();
    } finally {
      await service.close();
    }
  });

  it('refuses to pin once a destination was sent', async () => {
    let p = await prepared();
    p = await fx.service.update(
      { publicationId: p.id, revision: p.revision, patch: { copy: { title: 't', description: 'd', hashtags: [] } } },
      HUMAN,
    );
    const first = await fx.jobs.finishedExport('sent one');
    p = (await fx.service.pin(p.id, p.revision, { jobId: first.jobId }, HUMAN)).publication;
    p = await fx.service.approve(p.id, p.revision, HUMAN);
    p = await fx.service.send(p.id, p.revision, HUMAN);
    const second = await fx.jobs.finishedExport('too late');
    expect(await codeOf(fx.service.pin(p.id, p.revision, { jobId: second.jobId }, HUMAN))).toBe('PUBLICATION_LOCKED');
    expect(await codeOf(fx.service.pin(p.id, p.revision, { render: true }, HUMAN))).toBe('PUBLICATION_LOCKED');
  });
});

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '@cuccut/harness';
import { RpcError, type GeneratedOutput, type Id, type JobRecord, type JobSubmitter, type Localized, type PinnableExport, type PinnedExport } from '@cuccut/protocol';
import { RcPublishing as RP } from '@cuccut/protocol/messages/runtime-core';
import type { PublishingVideos } from './publishing-videos.ts';

/**
 * Pinned exports (design `docs/cuccut/m2-publishing.md` §3.2, §4.1): an immutable copy of a finished MP4 export, kept under
 * `<runtime-home>/publishing/exports/<sha256>.mp4` (0444) so that what was approved is exactly what is sent.
 *
 * - Pinning from a job checks that the job is a finished, whole-video MP4 export of the publication's video and sequence, and (for a chosen export)
 *   that it was rendered from the video's current revision (`EXPORT_STALE`). The file is hard-linked from the artifact library (content-addressed by
 *   its sha256) when it is on the same volume, else copied to a temporary file and renamed after hashing. The hash must match the job's artifact ID.
 * - "Render and pin" submits an `exports.create` (MP4, the publication's sequence) and watches the job; the service pins the output when it finishes.
 * - `verify` re-hashes a pinned file before send (`EXPORT_CHANGED`). Pinned files live outside `artifacts/`, so the storage collector never removes
 *   them; `cleanup` removes those no publication uses.
 */

/** The artifact library, where finished exports are kept by content hash. */
export interface PublishingArtifacts {
  locate(artifactId: string): Promise<string | null>;
}

export interface PublishingExportJobs {
  create(request: { videoId: Id; settings: { kind: 'video'; format: 'mp4'; sequenceId?: Id } }, submitter: JobSubmitter): Promise<{ jobId: Id }>;
  get(jobId: Id): JobRecord;
  list(videoId?: Id): JobRecord[];
}

export interface PublishingExportsOptions {
  /** The publishing directory (`RuntimeHome.publishingDir`); pinned files go to its `exports/`. */
  dir: string;
  artifacts: PublishingArtifacts;
  exports: PublishingExportJobs;
  videos: PublishingVideos;
  log: Logger;
  now?: () => Date;
}

/** What a pin must match. `requireCurrent`: refuse an export rendered from an older revision than the video's current one. */
export interface PinExpectation {
  videoId: Id;
  sequenceId: Id;
  requireCurrent: boolean;
}

function refuse(code: string, message: Localized, status: 'conflict' | 'invalid-request' | 'not-found' = 'conflict'): RpcError {
  return new RpcError(status, message, { code });
}

/** sha256 of a file (hex), or null when it cannot be read. */
export async function hashFile(file: string): Promise<string | null> {
  const hash = createHash('sha256');
  try {
    for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  } catch {
    return null;
  }
  return hash.digest('hex');
}

/** The finished whole-video MP4 output of an export job, or null. */
function videoOutput(job: JobRecord): (GeneratedOutput & { media: Extract<GeneratedOutput['media'], { kind: 'video' }> }) | null {
  const settings = job.export?.settings;
  if (job.kind !== 'export' || !settings || settings.kind !== 'video' || settings.format !== 'mp4') return null;
  if ('range' in settings && settings.range) return null;
  if ('ranges' in settings && settings.ranges && settings.ranges.length) return null;
  const outputs = job.result?.outputs ?? [];
  if (outputs.length !== 1) return null;
  const output = outputs[0]!;
  return output.media.kind === 'video' ? (output as ReturnType<typeof videoOutput> & object) : null;
}

const SHA256_ID = /^sha256:([0-9a-f]{64})$/;

/** Pinned and temporary files younger than this are never removed by a cleanup (a pin in progress has not saved its record yet). */
export const PIN_CLEANUP_GRACE_MS = 15 * 60_000;

export class PublishingExports {
  readonly #options: PublishingExportsOptions;
  readonly #log: Logger;
  readonly #now: () => Date;

  constructor(options: PublishingExportsOptions) {
    this.#options = options;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
  }

  /** The directory pinned files live in. */
  get dir(): string {
    return path.join(this.#options.dir, 'exports');
  }

  /** The file of a pinned export. */
  file(pinned: Pick<PinnedExport, 'sha256'>): string {
    return path.join(this.dir, `${pinned.sha256}.mp4`);
  }

  /** Finished whole-video MP4 exports of a video that can be pinned, newest first. */
  pinnable(videoId: Id): PinnableExport[] {
    const current = this.#options.videos.revision(videoId);
    return this.#options.exports
      .list(videoId)
      .filter((job) => job.state === 'completed' && job.videoId === videoId)
      .flatMap((job): PinnableExport[] => {
        const output = videoOutput(job);
        if (!output || !job.export) return [];
        return [
          {
            jobId: job.jobId,
            videoId,
            sequenceId: job.export.sequenceId,
            videoRevision: job.export.videoRevision,
            current: current === null ? null : current === job.export.videoRevision,
            fileName: path.basename(output.path ?? `${job.jobId}.mp4`),
            bytes: output.byteLength,
            width: output.media.width,
            height: output.media.height,
            durationSec: output.media.durationSec,
            fps: output.media.fps ?? null,
            codec: output.media.videoCodec,
            createdAt: job.endedAt ?? job.updatedAt,
          },
        ];
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  /**
   * Pins the output of a finished export job: checks it (see the module comment) and puts an immutable copy in place. Returns the record to save; the
   * caller stores it with the publication.
   */
  async pinJob(jobId: Id, expect: PinExpectation): Promise<PinnedExport> {
    let job: JobRecord;
    try {
      job = this.#options.exports.get(jobId);
    } catch {
      throw refuse('EXPORT_NOT_FOUND', RP.exportNotVideo(), 'not-found');
    }
    if (job.videoId !== expect.videoId || (job.export && job.export.sequenceId !== expect.sequenceId)) {
      throw refuse('EXPORT_OTHER_VIDEO', RP.exportOtherVideo(), 'invalid-request');
    }
    if (job.state !== 'completed') throw refuse('EXPORT_NOT_FINISHED', RP.exportNotFinished());
    const output = videoOutput(job);
    if (!output || !job.export) throw refuse('EXPORT_NOT_VIDEO', RP.exportNotVideo(), 'invalid-request');
    if (expect.requireCurrent) {
      const current = this.#options.videos.revision(expect.videoId);
      if (current !== null && current !== job.export.videoRevision) throw refuse('EXPORT_STALE', RP.exportStale());
    }
    const match = SHA256_ID.exec(output.artifactId);
    if (!match) throw refuse('EXPORT_FILE_CHANGED', RP.exportFileChanged());
    const sha256 = match[1]!;
    const bytes = await this.#place(sha256, output);
    return {
      id: `sha256:${sha256}`,
      videoId: expect.videoId,
      sequenceId: job.export.sequenceId,
      videoRevision: job.export.videoRevision,
      sequenceRevision: null,
      jobId,
      sha256,
      bytes,
      width: output.media.width,
      height: output.media.height,
      durationSec: output.media.durationSec,
      fps: output.media.fps ?? null,
      codec: output.media.videoCodec,
      createdAt: this.#now().toISOString(),
    };
  }

  /** Puts `exports/<sha256>.mp4` in place from the artifact library (hard link, else copy) or the published file (copy). Returns its size. */
  async #place(sha256: string, output: GeneratedOutput): Promise<number> {
    await fs.mkdir(this.dir, { recursive: true });
    const target = this.file({ sha256 });
    if ((await hashFile(target)) === sha256) {
      // Mark it as just placed, so a cleanup running before the publication names it leaves it alone (see `cleanup`).
      const now = this.#now();
      await fs.utimes(target, now, now).catch(() => {});
      return (await fs.stat(target)).size;
    }
    await removeFile(target);
    const library = await this.#options.artifacts.locate(output.artifactId).catch(() => null);
    const sources = [library, output.path ?? null].filter((file): file is string => !!file);
    let found = false;
    for (const source of sources) {
      const exists = await fs.stat(source).then(
        (s) => s.isFile(),
        () => false,
      );
      if (!exists) continue;
      found = true;
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      try {
        // Same volume: share the artifact library's immutable copy. Otherwise (or for the published file, which the user may change) copy it.
        const linked = source === library && (await fs.link(source, temp).then(
          () => true,
          () => false,
        ));
        if (!linked) await fs.copyFile(source, temp);
        if ((await hashFile(temp)) !== sha256) {
          await removeFile(temp);
          continue;
        }
        await fs.chmod(temp, 0o444);
        await fs.rename(temp, target);
        this.#log.info('Pinned an export', { sha256, linked });
        return (await fs.stat(target)).size;
      } catch (error) {
        await removeFile(temp);
        this.#log.warn('Pinning an export from this source failed', { sha256, error: String(error) });
      }
    }
    throw found ? refuse('EXPORT_FILE_CHANGED', RP.exportFileChanged()) : refuse('EXPORT_FILE_MISSING', RP.exportFileMissing(), 'not-found');
  }

  /** Re-hashes a pinned file. Throws `EXPORT_CHANGED` when it is missing or differs from what was pinned. */
  async verify(pinned: Pick<PinnedExport, 'sha256'>): Promise<void> {
    if ((await hashFile(this.file(pinned))) !== pinned.sha256) throw refuse('EXPORT_CHANGED', RP.exportChanged());
  }

  /**
   * "Render and pin": opens the video, submits an MP4 export of the sequence and lets the video go again (the export freezes the video at
   * submission). Returns the export job; the service watches it and pins its output.
   */
  async render(videoId: Id, sequenceId: Id, submitter: JobSubmitter): Promise<Id> {
    const release = await this.#options.videos.open(videoId);
    try {
      const { jobId } = await this.#options.exports.create({ videoId, settings: { kind: 'video', format: 'mp4', sequenceId } }, submitter);
      return jobId;
    } finally {
      await release().catch((error: unknown) => this.#log.warn('Letting the video go after an export failed', { videoId, error: String(error) }));
    }
  }

  /**
   * Removes pinned files (and leftover temporary files) whose hash is not in `keep`. A file placed less than {@link PIN_CLEANUP_GRACE_MS} ago is
   * kept: a pin puts its file in place before the publication record names it, and a temporary file may still be being written. With `dryRun`,
   * nothing is removed and the result says what would be.
   */
  async cleanup(keep: ReadonlySet<string>, options: { dryRun?: boolean } = {}): Promise<{ files: number; bytes: number }> {
    const names = await fs.readdir(this.dir).catch(() => [] as string[]);
    const young = this.#now().getTime() - PIN_CLEANUP_GRACE_MS;
    let files = 0;
    let bytes = 0;
    for (const name of names) {
      const sha = /^([0-9a-f]{64})\.mp4$/.exec(name)?.[1];
      if (sha && keep.has(sha)) continue;
      if (!sha && !name.endsWith('.tmp')) continue;
      const file = path.join(this.dir, name);
      const stat = await fs.stat(file).catch(() => null);
      if (!stat) continue;
      // ctime moves when the file is linked, made read-only or renamed into place; mtime when an existing copy is pinned again.
      if (Math.max(stat.mtimeMs, stat.ctimeMs) > young) continue;
      const size = stat.size;
      if (options.dryRun) {
        if (sha) files++;
        bytes += size;
        continue;
      }
      if (await removeFile(file)) {
        if (sha) files++;
        bytes += size;
      }
    }
    return { files, bytes };
  }

}

/** Removes a file even when it is read-only. Returns whether it was there. */
async function removeFile(file: string): Promise<boolean> {
  try {
    await fs.chmod(file, 0o644).catch(() => {});
    await fs.rm(file);
    return true;
  } catch {
    return false;
  }
}

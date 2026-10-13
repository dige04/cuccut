import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncDir } from '@cuccut/runtime-storage';
import { sha256Hex } from './input-hash.ts';

/**
 * Minimal content-addressed artifact store (architecture design §5.1, §7.3): `<artifacts>/<sha256hex>.<ext>`, `artifactId = 'sha256:<hex>'`.
 * Transcription results are `.json`. Generated media follows its format (`.mp3`, `.wav`, `.flac`, `.png`, `.jpg`, `.webp`). Exported files follow theirs (subtitles and transcripts `.srt`, `.vtt`, `.ass`, `.md`, `.txt`, `.json`; audio `.wav`, `.mp3`, `.m4a`; finished video `.mp4`, `.webm`).
 * A write is: temp file fully written (or cloned), fsync, rename, then fsync the directory. When it is acknowledged, the content and the rename have both been handed to the disk, so the artifacts that the task ledger references are intact even after a power loss
 * (on macOS, Node's fsync is not `F_FULLFSYNC`). The same content is stored once. Once published, it is immutable.
 */

/** Extensions usable for artifact files. */
export const ARTIFACT_EXTENSIONS = [
  'json',
  'txt',
  'mp3',
  'wav',
  'flac',
  'png',
  'jpg',
  'webp',
  'm4a',
  'srt',
  'vtt',
  'ass',
  'md',
  'mp4',
  'webm',
] as const;
export type ArtifactExtension = (typeof ARTIFACT_EXTENSIONS)[number];

/** Grace period when sweeping the artifact store: files modified within this window are not deleted (just-published artifacts not yet recorded, and temp files still being written). */
export const ARTIFACT_SWEEP_GRACE_MS = 60 * 60 * 1000;

const ARTIFACT_FILE = new RegExp(`^([0-9a-f]{64})\\.(?:${ARTIFACT_EXTENSIONS.join('|')})$`);

/** Result of one sweep: artifact files examined, artifacts and temp files deleted, bytes freed, and the number that could not be deleted. */
export interface ArtifactSweepResult {
  scanned: number;
  removed: number;
  removedBytes: number;
  temporaryRemoved: number;
  failed: number;
}

/** Finds all `sha256:<hex>` in a value (task record, frozen spec, publish intent, artifact record) and adds them to `into`. */
export function collectArtifactIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  const text = JSON.stringify(value);
  if (text === undefined) return into;
  for (const match of text.matchAll(/sha256:([0-9a-f]{64})/g)) into.add(`sha256:${match[1]}`);
  return into;
}

async function touch(file: string): Promise<void> {
  const now = new Date();
  await fs.utimes(file, now, now).catch(() => {});
}

/** The artifact ID (`sha256:<hex>`) of a piece of content. It is computed before the content is written to the artifact store, so the publish intent can be recorded first (§7.3). */
export function artifactIdOf(bytes: Uint8Array): string {
  return `sha256:${sha256Hex(bytes)}`;
}

export class ArtifactStore {
  readonly dir: string;
  /** Digests written (or matched to an existing file) while a sweep is running. This round does not delete them, even if they were not in the reference set computed when it started. */
  #touched = new Set<string>();
  #sweeping = false;

  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Deletes unreferenced artifacts (architecture design §7.3). `referenced` is `sha256:<hex>` or bare hex.
   *
   * - Files named `<64 hex digits>.<known extension>`: deleted when they are not in the reference set and their modification time is earlier than the grace period (default 1 hour). An artifact is written into the store before it is recorded, so a just-published file may not have any reference yet. `put` on existing content refreshes the modification time, so the grace period also holds for re-published content.
   * - A `*.tmp` left by a write that stopped halfway: deleted when its modification time is earlier than the grace period.
   * - Other files and subdirectories are left alone.
   * - When `notBefore` is given, artifacts whose modification time is earlier than it are not deleted (artifacts from before reference retention began; there is no way to know whether anyone still uses them).
   *
   * The modification time is checked again just before deleting, so anything `put` during the sweep is not deleted. Only one round runs on the same instance at a time; a re-entrant call returns null.
   */
  async sweep(
    referenced: ReadonlySet<string>,
    options: { graceMs?: number; now?: number; notBefore?: number } = {},
  ): Promise<ArtifactSweepResult | null> {
    if (this.#sweeping) return null;
    this.#sweeping = true;
    this.#touched = new Set();
    const graceMs = options.graceMs ?? ARTIFACT_SWEEP_GRACE_MS;
    const cutoff = (options.now ?? Date.now()) - graceMs;
    const keep = new Set<string>();
    for (const id of referenced) {
      const match = /^(?:sha256:)?([0-9a-f]{64})$/.exec(id);
      if (match) keep.add(match[1]!);
    }
    const result: ArtifactSweepResult = { scanned: 0, removed: 0, removedBytes: 0, temporaryRemoved: 0, failed: 0 };
    try {
      const names = await fs.readdir(this.dir).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [] as string[];
        throw error;
      });
      for (const name of names) {
        const artifact = ARTIFACT_FILE.exec(name);
        const temporary = !artifact && name.endsWith('.tmp');
        if (!artifact && !temporary) continue;
        if (artifact) {
          result.scanned++;
          if (keep.has(artifact[1]!)) continue;
        }
        const file = path.join(this.dir, name);
        const stat = await fs.lstat(file).catch(() => null);
        if (!stat?.isFile() || stat.mtimeMs > cutoff) continue;
        if (artifact && options.notBefore !== undefined && stat.mtimeMs < options.notBefore) continue;
        if (artifact && this.#touched.has(artifact[1]!)) continue;
        try {
          await fs.unlink(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') result.failed++;
          continue;
        }
        if (artifact) {
          result.removed++;
          result.removedBytes += stat.size;
        } else {
          result.temporaryRemoved++;
          result.removedBytes += stat.size;
        }
      }
      return result;
    } finally {
      this.#sweeping = false;
      this.#touched = new Set();
    }
  }

  async put(bytes: Uint8Array, extension: ArtifactExtension = 'json'): Promise<{ artifactId: string; path: string }> {
    const hex = sha256Hex(bytes);
    const file = path.join(this.dir, `${hex}.${extension}`);
    const exists = await fs.stat(file).then(
      (s) => s.isFile() && s.size === bytes.length,
      () => false,
    );
    this.#touched.add(hex);
    if (!exists) {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${randomUUID()}.tmp`;
      await publish(tmp, file, async () => {
        const handle = await fs.open(tmp, 'w', 0o644);
        try {
          await handle.writeFile(bytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
      });
    } else await touch(file);
    return { artifactId: `sha256:${hex}`, path: file };
  }

  /** Stores a file as an artifact (the digest is computed while reading, without loading the whole file into memory; used for exported audio and video). Clones rather than copies when the filesystem supports it (APFS). */
  async putFile(source: string, extension: ArtifactExtension): Promise<{ artifactId: string; path: string; byteLength: number }> {
    const hash = createHash('sha256');
    let byteLength = 0;
    for await (const chunk of createReadStream(source)) {
      hash.update(chunk as Buffer);
      byteLength += (chunk as Buffer).length;
    }
    const hex = hash.digest('hex');
    const file = path.join(this.dir, `${hex}.${extension}`);
    const exists = await fs.stat(file).then(
      (s) => s.isFile() && s.size === byteLength,
      () => false,
    );
    this.#touched.add(hex);
    if (!exists) {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${randomUUID()}.tmp`;
      await publish(tmp, file, async () => {
        await fs.copyFile(source, tmp, constants.COPYFILE_FICLONE);
        await fs.chmod(tmp, 0o644);
        // Cloned (or copied) files must also be fsync'd. Open with r+: on Windows a read-only handle cannot be fsync'd.
        const handle = await fs.open(tmp, 'r+');
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
      });
    } else await touch(file);
    return { artifactId: `sha256:${hex}`, path: file, byteLength };
  }

  /** Path of a JSON artifact (transcription result). */
  pathOf(artifactId: string): string | null {
    const match = /^sha256:([0-9a-f]{64})$/.exec(artifactId);
    return match ? path.join(this.dir, `${match[1]}.json`) : null;
  }

  /** Path of an artifact with any extension; null if it does not exist. */
  async locate(artifactId: string): Promise<string | null> {
    const match = /^sha256:([0-9a-f]{64})$/.exec(artifactId);
    if (!match) return null;
    for (const extension of ARTIFACT_EXTENSIONS) {
      const file = path.join(this.dir, `${match[1]}.${extension}`);
      if (
        await fs.stat(file).then(
          (s) => s.isFile(),
          () => false,
        )
      )
        return file;
    }
    return null;
  }

  /**
   * Checks that the artifact exists and that its content matches its digest. Writes fsync before rename, so under normal conditions they are not truncated. This is still checked, to cover artifacts written before this change, the disk's own write cache (macOS fsync does not flush it), and external modification.
   */
  async verify(artifactId: string): Promise<boolean> {
    const file = await this.locate(artifactId);
    if (!file) return false;
    const hash = createHash('sha256');
    try {
      for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
    } catch {
      return false;
    }
    return `sha256:${hash.digest('hex')}` === artifactId;
  }

  async read(artifactId: string): Promise<Buffer | null> {
    const file = await this.locate(artifactId);
    return file ? fs.readFile(file).catch(() => null) : null;
  }
}

/** Writes the temp file (`write` is responsible for writing it fully and fsync'ing), renames it into place, and fsyncs the directory. On failure, deletes the temp file. */
async function publish(tmp: string, file: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  await syncDir(path.dirname(file));
}

/**
 * The file for a task's output (agents and external services use it by `artifactId`: `importAsset`, `artifacts_save`). If the artifact store has it, the store's copy is used.
 * Otherwise the output's recorded `path` is checked. Outputs published into the user's directory, such as imports from links or file transcodes, are not in the artifact store, and their `artifactId` is the content digest of that file.
 * It is used only if the file still exists, its size matches the recorded one, and its content digest equals `artifactId`. Otherwise null (moved, deleted or modified all count as gone).
 */
export async function locateArtifact(
  store: ArtifactStore,
  artifactId: string,
  output: { path?: string | null; byteLength?: number } | null,
): Promise<string | null> {
  const stored = await store.locate(artifactId);
  if (stored) return stored;
  const match = /^sha256:([0-9a-f]{64})$/.exec(artifactId);
  const file = output?.path;
  if (!match || typeof file !== 'string' || !path.isAbsolute(file)) return null;
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || (output?.byteLength !== undefined && stat.size !== output.byteLength)) return null;
  const hash = createHash('sha256');
  try {
    for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  } catch {
    return null;
  }
  return hash.digest('hex') === match[1] ? file : null;
}

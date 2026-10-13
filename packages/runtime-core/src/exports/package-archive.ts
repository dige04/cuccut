import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';
import { RcCommon, RcPackage } from '@cuccut/protocol/messages/runtime-core';

/**
 * The container for `.cuccut` archives (video format spec §8): an uncompressed POSIX ustar tar. Uses only Node's built-in modules. Reading and writing are both streaming, so assets never have to be read fully into memory.
 *
 * Only regular files are written. Names follow ustar's prefix + name rule, at most 255 bytes in total, and a single file must be smaller than 8 GiB (ustar's length field is 11 octal digits). Longer names and larger files need pax extension headers, which this version neither writes nor reads, so they are rejected item by item during preflight.
 *
 * Archives are not trusted when read: the header checksum must match, and only regular file and directory entries are accepted (hard links, symbolic links, devices, and pax / GNU extension headers are rejected). Paths must be relative, must not contain `..`, empty segments, or backslashes, and must fall within the package's fixed layout (`video.manifest.json`, `video.snapshot.json`, `assets/`, `documents/`). The same path may not appear twice.
 */

const BLOCK = 512;
/** The maximum value the length field of a ustar header can represent (11 octal digits). */
export const MAX_ENTRY_BYTES = 8 * 1024 ** 3 - 1;
export const MAX_PATH_BYTES = 255;
const TOP_FILES = new Set(['video.manifest.json', 'video.snapshot.json']);
const TOP_DIRS = ['assets/', 'documents/'];

export class ArchiveError extends Error {
  readonly code: 'PACKAGE_INVALID' | 'PACKAGE_PATH_UNSAFE';
  readonly path: string | undefined;
  readonly messageRef: MessageRef | undefined;
  constructor(code: 'PACKAGE_INVALID' | 'PACKAGE_PATH_UNSAFE', message: string | Localized, path?: string) {
    super(String(message));
    this.code = code;
    this.path = path;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}

/** Whether a path in the package can be written into a ustar header: split on `/` into prefix (≤155 bytes) and name (≤100 bytes). Returns the reason when it can't. */
export function ustarProblem(name: string, size: number): string | null {
  if (size > MAX_ENTRY_BYTES) return RcPackage.tarFileTooLarge().text;
  if (splitName(name) === null) return RcPackage.tarPathTooLong({ max: MAX_PATH_BYTES }).text;
  return null;
}

function splitName(name: string): { prefix: string; name: string } | null {
  const bytes = Buffer.byteLength(name);
  if (bytes <= 100) return { prefix: '', name };
  if (bytes > MAX_PATH_BYTES) return null;
  // Search backwards from the end for a `/` so that both sides fit.
  for (let i = name.length - 1; i > 0; i--) {
    if (name[i] !== '/') continue;
    const prefix = name.slice(0, i);
    const rest = name.slice(i + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100 && rest.length > 0) return { prefix, name: rest };
  }
  return null;
}

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

function header(name: string, size: number, mtime: number): Buffer {
  const split = splitName(name);
  if (!split) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archivePathTooLong({ path: name }), name);
  if (size > MAX_ENTRY_BYTES) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archiveFileTooLarge({ path: name }), name);
  const block = Buffer.alloc(BLOCK);
  block.write(split.name, 0, 100, 'utf8');
  block.write(octal(0o644, 8), 100, 8, 'ascii');
  block.write(octal(0, 8), 108, 8, 'ascii');
  block.write(octal(0, 8), 116, 8, 'ascii');
  block.write(octal(size, 12), 124, 12, 'ascii');
  block.write(octal(Math.max(0, Math.floor(mtime)), 12), 136, 12, 'ascii');
  block.fill(' ', 148, 156);
  block.write('0', 156, 1, 'ascii');
  block.write('ustar\0', 257, 6, 'ascii');
  block.write('00', 263, 2, 'ascii');
  block.write(split.prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(octal(sum, 7) + ' ', 148, 8, 'ascii');
  return block;
}

/** Writes a tar file sequentially. Computes sha256 for each entry as it is written, and returns the length and digest for the caller to put in the manifest. */
export class TarWriter {
  readonly #file: fs.FileHandle;
  readonly #mtime: number;
  #offset = 0;

  private constructor(file: fs.FileHandle, mtime: number) {
    this.#file = file;
    this.#mtime = mtime;
  }

  /** Creates a new file (`wx`: fails if it already exists). `mtime` is the modification time (seconds) written into each header. */
  static async create(target: string, mtime: number): Promise<TarWriter> {
    return new TarWriter(await fs.open(target, 'wx'), mtime);
  }

  async #write(data: Buffer): Promise<void> {
    let done = 0;
    while (done < data.length) {
      const { bytesWritten } = await this.#file.write(data, done, data.length - done, this.#offset);
      done += bytesWritten;
      this.#offset += bytesWritten;
    }
  }

  async addBuffer(name: string, data: Buffer): Promise<{ byteLength: number; sha256: string }> {
    return this.addStream(
      name,
      data.length,
      (async function* () {
        yield data;
      })(),
    );
  }

  /**
   * Writes a file entry. `size` is the expected length: throws if the source's actual length differs (the file was changed while being read). The digest is computed over the bytes actually written.
   * Stops between blocks when `signal` aborts.
   */
  async addStream(
    name: string,
    size: number,
    source: AsyncIterable<Buffer | Uint8Array>,
    signal?: AbortSignal,
  ): Promise<{ byteLength: number; sha256: string }> {
    await this.#write(header(name, size, this.#mtime));
    const hash = createHash('sha256');
    let written = 0;
    for await (const chunk of source) {
      if (signal?.aborted) throw new Error(RcCommon.cancelled().text);
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      written += buffer.length;
      if (written > size) throw new ArchiveError('PACKAGE_INVALID', RcPackage.entryLongerThanExpected({ path: name }), name);
      hash.update(buffer);
      await this.#write(buffer);
    }
    if (written !== size) throw new ArchiveError('PACKAGE_INVALID', RcPackage.entryShorterThanExpected({ path: name }), name);
    const pad = (BLOCK - (size % BLOCK)) % BLOCK;
    if (pad) await this.#write(Buffer.alloc(pad));
    return { byteLength: size, sha256: `sha256:${hash.digest('hex')}` };
  }

  /** Writes the two empty end blocks, flushes to disk, and closes. */
  async finish(): Promise<void> {
    await this.#write(Buffer.alloc(BLOCK * 2));
    await this.#file.sync();
    await this.#file.close();
  }

  /** Closes on error (the caller deletes the file). */
  async abort(): Promise<void> {
    await this.#file.close().catch(() => {});
  }
}

export interface ArchiveEntry {
  path: string;
  size: number;
  /** Where the data starts within the archive. */
  offset: number;
}

function readString(block: Buffer, start: number, length: number): string {
  const slice = block.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? length : end).toString('utf8');
}

function readOctal(block: Buffer, start: number, length: number): number {
  const text = readString(block, start, length).trim();
  if (!/^[0-7]+$/.test(text)) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archiveHeaderCorrupt());
  return parseInt(text, 8);
}

/** Whether a path in the package is safe: relative, no `..` or empty segments, and within the package's fixed layout. */
export function safePackagePath(name: string): boolean {
  if (!name || name.length > MAX_PATH_BYTES || name.startsWith('/') || /[\\\0]/.test(name) || /^[A-Za-z]:/.test(name)) return false;
  const parts = name.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return false;
  return TOP_FILES.has(name) || TOP_DIRS.some((dir) => name.startsWith(dir) && name.length > dir.length);
}

/**
 * Lists the file entries in the archive (without reading data). Checks header checksums, entry types, and paths by the rules above. Directory entries only have their paths checked and are not listed.
 * Anything after the trailing empty blocks is ignored. Without a terminator, the end of the file is used.
 */
export async function listArchive(file: string): Promise<ArchiveEntry[]> {
  const handle = await fs.open(file, 'r');
  try {
    const { size: total } = await handle.stat();
    const entries: ArchiveEntry[] = [];
    const seen = new Set<string>();
    const block = Buffer.alloc(BLOCK);
    let offset = 0;
    while (offset + BLOCK <= total) {
      const { bytesRead } = await handle.read(block, 0, BLOCK, offset);
      if (bytesRead < BLOCK) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archiveTruncated());
      if (block.every((b) => b === 0)) break;
      let sum = 0;
      for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i]!;
      if (readOctal(block, 148, 8) !== sum) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archiveChecksumMismatch());
      if (readString(block, 257, 6) !== 'ustar') throw new ArchiveError('PACKAGE_INVALID', RcPackage.notUstar());
      const name = readString(block, 0, 100);
      const prefix = readString(block, 345, 155);
      const full = prefix ? `${prefix}/${name}` : name;
      const type = String.fromCharCode(block[156]!);
      const size = readOctal(block, 124, 12);
      const dataOffset = offset + BLOCK;
      offset = dataOffset + Math.ceil(size / BLOCK) * BLOCK;
      if (type === '1' || type === '2') throw new ArchiveError('PACKAGE_PATH_UNSAFE', RcPackage.archiveHasLink({ path: full }), full);
      if (type === '5') {
        const dir = full.replace(/\/+$/, '');
        if (!safePackagePath(`${dir}/x`) && !TOP_DIRS.includes(`${dir}/`)) {
          throw new ArchiveError('PACKAGE_PATH_UNSAFE', RcPackage.unsafePath({ path: full }), full);
        }
        continue;
      }
      if (type !== '0' && type !== '\0') throw new ArchiveError('PACKAGE_INVALID', RcPackage.unsupportedEntryType({ path: full }), full);
      if (!safePackagePath(full)) throw new ArchiveError('PACKAGE_PATH_UNSAFE', RcPackage.unsafePath({ path: full }), full);
      if (seen.has(full)) throw new ArchiveError('PACKAGE_INVALID', RcPackage.duplicateEntry({ path: full }), full);
      if (dataOffset + size > total) throw new ArchiveError('PACKAGE_INVALID', RcPackage.archiveTruncated(), full);
      seen.add(full);
      entries.push({ path: full, size, offset: dataOffset });
    }
    return entries;
  } finally {
    await handle.close();
  }
}

/** The data stream of one entry. */
export function entryStream(file: string, entry: ArchiveEntry): AsyncIterable<Buffer> {
  if (entry.size === 0) return (async function* () {})();
  return createReadStream(file, { start: entry.offset, end: entry.offset + entry.size - 1 });
}

/** Reads the entire contents of one entry (small files such as the manifest and snapshot). */
export async function readEntry(file: string, entry: ArchiveEntry, limit: number): Promise<Buffer> {
  if (entry.size > limit) throw new ArchiveError('PACKAGE_INVALID', RcPackage.entryTooLarge({ path: entry.path }), entry.path);
  const chunks: Buffer[] = [];
  for await (const chunk of entryStream(file, entry)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** The sha256 of an entry (`sha256:<hex>`), optionally also written to `target`. */
export async function hashEntry(file: string, entry: ArchiveEntry, target?: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256');
  const out = target ? await fs.open(target, 'wx') : null;
  try {
    for await (const chunk of entryStream(file, entry)) {
      if (signal?.aborted) throw new Error(RcCommon.cancelled().text);
      hash.update(chunk);
      if (out) {
        let done = 0;
        while (done < chunk.length) done += (await out.write(chunk, done, chunk.length - done)).bytesWritten;
      }
    }
    if (out) await out.sync();
  } finally {
    await out?.close();
  }
  return `sha256:${hash.digest('hex')}`;
}

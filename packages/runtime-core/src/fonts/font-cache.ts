import fs from 'node:fs/promises';
import path from 'node:path';
import type { DownloadedFontFace, FontLicence } from '@cuccut/protocol';
import { JsonStoreFile, type StoreLog } from '@cuccut/runtime-storage';

/**
 * Cache for downloaded fonts (architecture design §9.1), under `fonts/` in the Runtime Home, not in the project directory:
 *
 * - `files/<family>/<family>-<weight>[i]-<first 12 characters of the digest>.ttf`: font files. The engine picks faces from this directory (for families not installed locally), and preview and export use the same file.
 * - `index.json`: one entry per face (family, weight, italic, license, sha256, size, file, download time); does not record download URLs.
 * - `.staging/`: temporary files during download (moved into `files/` only after verification).
 *
 * The file name contains a content digest: changing the content of a face produces a different file, so exports that froze the old file are not affected.
 */

const INDEX_VERSION = 1;
const INDEX_SCHEMA = `cuccut.font-cache/${INDEX_VERSION}`;

/** `cuccut.font-cache/<n>` → n; anything else → null. */
function indexVersion(value: unknown): number | null {
  const match = typeof value === 'string' ? /^cuccut\.font-cache\/(\d+)$/.exec(value) : null;
  return match ? Number(match[1]) : null;
}

export interface FontCacheEntry extends DownloadedFontFace {
  /** Path relative to `files/`. */
  file: string;
}

interface IndexFile {
  schema: string;
  faces: FontCacheEntry[];
}

const keyOf = (family: string, weight: number, italic: boolean) => `${family.toLowerCase()}\u0000${weight}\u0000${italic ? 1 : 0}`;

export function faceKey(face: { family: string; weight: number; italic: boolean }): string {
  return keyOf(face.family.trim(), face.weight, face.italic);
}

/** Family names become directory and file names: lowercase letters and digits; everything else is written as `-`. */
export function familySlug(family: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'font';
}

export class FontCache {
  readonly root: string;
  readonly filesDir: string;
  readonly stagingDir: string;
  readonly #index: JsonStoreFile;
  #faces: FontCacheEntry[] | null = null;
  #writes: Promise<void> = Promise.resolve();

  constructor(root: string, options: { log?: StoreLog } = {}) {
    this.root = root;
    this.filesDir = path.join(root, 'files');
    this.stagingDir = path.join(root, '.staging');
    this.#index = new JsonStoreFile(path.join(root, 'index.json'), options.log);
  }

  /** Reads the index (on first use): entries whose files are missing are removed. */
  async #load(): Promise<FontCacheEntry[]> {
    if (this.#faces) return this.#faces;
    await fs.mkdir(this.filesDir, { recursive: true });
    // A corrupt index is renamed and kept, and it starts empty (the files are still in `files/`, and they are downloaded and registered again when next needed). An index written by a newer version is not rewritten (`store-file.ts`).
    const { value } = await this.#index.read({
      version: { key: 'schema', known: INDEX_VERSION, parse: indexVersion },
      recognize: (raw) => (raw.schema === INDEX_SCHEMA && Array.isArray(raw.faces) ? (raw.faces as FontCacheEntry[]) : null),
      tolerateReadErrors: true,
    });
    const faces = value ?? [];
    const present: FontCacheEntry[] = [];
    for (const face of faces) {
      if (typeof face?.file !== 'string' || face.file.includes('..') || path.isAbsolute(face.file)) continue;
      const stat = await fs.stat(this.pathOf(face)).catch(() => null);
      if (stat?.isFile()) present.push(face);
    }
    this.#faces ??= present;
    return this.#faces;
  }

  /** All faces in the cache (sorted by family name, italic, then weight). */
  async list(): Promise<FontCacheEntry[]> {
    const faces = await this.#load();
    return [...faces].sort((a, b) => a.family.localeCompare(b.family) || Number(a.italic) - Number(b.italic) || a.weight - b.weight);
  }

  /** Whether this face exists (family name matched case-insensitively); treated as absent if its file was deleted externally. */
  async find(family: string, weight: number, italic: boolean): Promise<FontCacheEntry | null> {
    const key = keyOf(family.trim(), weight, italic);
    const found = (await this.#load()).find((face) => faceKey(face) === key) ?? null;
    if (found && !(await fs.stat(this.pathOf(found)).catch(() => null))) {
      await this.remove([found]);
      return null;
    }
    return found;
  }

  pathOf(face: { file: string }): string {
    return path.join(this.filesDir, face.file);
  }

  /** Moves the downloaded temp file (already verified) into `files/` and records it in the index; the existing entry for the same face is replaced (the old file is deleted). */
  async add(
    temp: string,
    face: { family: string; weight: number; italic: boolean; licence: FontLicence; sha256: string; sizeBytes: number },
  ): Promise<FontCacheEntry> {
    const slug = familySlug(face.family);
    const file = `${slug}/${slug}-${face.weight}${face.italic ? 'i' : ''}-${face.sha256.slice(0, 12)}.ttf`;
    const entry: FontCacheEntry = {
      family: face.family,
      weight: face.weight,
      italic: face.italic,
      licence: face.licence,
      sha256: face.sha256,
      sizeBytes: face.sizeBytes,
      downloadedAt: new Date().toISOString(),
      file,
    };
    await this.#write(async (faces) => {
      await fs.mkdir(path.join(this.filesDir, slug), { recursive: true });
      await fs.rename(temp, this.pathOf(entry));
      const key = faceKey(entry);
      const old = faces.filter((f) => faceKey(f) === key && f.file !== file);
      for (const f of old) await fs.rm(this.pathOf(f), { force: true });
      return [...faces.filter((f) => faceKey(f) !== key), entry];
    });
    return entry;
  }

  /** Deletes the files and entries for these faces (family directories that become empty are deleted too). */
  async remove(entries: readonly FontCacheEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const files = new Set(entries.map((e) => e.file));
    await this.#write(async (faces) => {
      for (const file of files) {
        await fs.rm(path.join(this.filesDir, file), { force: true });
        await fs.rmdir(path.dirname(path.join(this.filesDir, file))).catch(() => {});
      }
      return faces.filter((f) => !files.has(f.file));
    });
  }

  async #write(change: (faces: FontCacheEntry[]) => Promise<FontCacheEntry[]>): Promise<void> {
    const write = this.#writes.then(async () => {
      const next = await change(await this.#load());
      await this.#index.write({ schema: INDEX_SCHEMA, faces: next } satisfies IndexFile);
      this.#faces = next;
    });
    this.#writes = write.catch(() => {});
    await write;
  }
}

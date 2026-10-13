import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PACK_PREVIEW_TTL_MS, RpcError } from '@cuccut/protocol';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import type { StagedPack } from './pack-source.ts';

/**
 * Preview tokens (pack spec §4, §6): each `packs.inspect` stages the pack in `<home>/packs/.staging/<token>/`, and the token installs exactly what was staged, for 30 minutes.
 *
 * - Tokens live in memory; their folders are on disk. A token that is unknown, expired or already used answers `PACK_PREVIEW_EXPIRED`.
 * - Expired previews are swept on every access. At startup no token is known any more, so the whole staging folder is emptied (`sweepAll`).
 * - `stage` also serves installs straight from a source (`packs.install { source }`): the folder is staged the same way and released after the install.
 */

export interface PackPreviewEntry {
  token: string;
  staged: StagedPack;
  createdAt: number;
  expiresAt: number;
}

export interface PackPreviewsOptions {
  /** `<home>/packs/.staging`. */
  dir: string;
  ttlMs?: number;
  now?: () => number;
}

export class PackPreviews {
  readonly dir: string;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, PackPreviewEntry>();

  constructor(options: PackPreviewsOptions) {
    this.dir = path.resolve(options.dir);
    this.#ttlMs = options.ttlMs ?? PACK_PREVIEW_TTL_MS;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Makes an empty staging folder, lets `fill` read a pack into it, and keeps the result under a new token. On failure the folder is deleted and the error passes through.
   */
  async stage(fill: (dir: string) => Promise<StagedPack>): Promise<PackPreviewEntry> {
    await this.sweep();
    await fsp.mkdir(this.dir, { recursive: true });
    const token = crypto.randomBytes(16).toString('base64url');
    const dir = path.join(this.dir, token);
    await fsp.mkdir(dir);
    try {
      const staged = await fill(dir);
      const createdAt = this.#now();
      const entry: PackPreviewEntry = { token, staged, createdAt, expiresAt: createdAt + this.#ttlMs };
      this.#entries.set(token, entry);
      return entry;
    } catch (error) {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /** The preview for a token, or `PACK_PREVIEW_EXPIRED` (conflict). */
  async get(token: string): Promise<PackPreviewEntry> {
    await this.sweep();
    const entry = this.#entries.get(token);
    if (!entry) throw new RpcError('conflict', RcPacks.previewExpired(), { code: 'PACK_PREVIEW_EXPIRED', token });
    return entry;
  }

  /** Forgets a token and deletes its folder (after an install, or when building the preview failed). */
  async release(token: string): Promise<void> {
    this.#entries.delete(token);
    await fsp.rm(path.join(this.dir, token), { recursive: true, force: true }).catch(() => {});
  }

  /** Deletes the previews that expired. */
  async sweep(): Promise<void> {
    const now = this.#now();
    for (const [token, entry] of [...this.#entries]) {
      if (entry.expiresAt <= now) await this.release(token);
    }
  }

  /** At startup: no token survives a restart, so everything under the staging folder goes (installs in progress there were interrupted). */
  async sweepAll(): Promise<void> {
    this.#entries.clear();
    const entries = await fsp.readdir(this.dir).catch(() => [] as string[]);
    for (const name of entries) await fsp.rm(path.join(this.dir, name), { recursive: true, force: true }).catch(() => {});
  }

  /** Tokens still installable (tests). */
  tokens(): string[] {
    return [...this.#entries.keys()];
  }
}

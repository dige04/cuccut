import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { RpcError, type Id, type RpcParams, type VideoOpenResult } from '@cuccut/protocol';
import type { TrustedPrincipal } from '../gateway.ts';
import { PackageError, readPackage } from '../exports/package-reader.ts';
import { videoDirName, type VideoService } from './video-service.ts';
import { RcVideo } from '@cuccut/protocol/messages/runtime-core';

/**
 * Opening a portable package (`videos.importPackage`, video format spec §8): the package is unpacked in a hidden staging directory inside the source directory, checked as it goes (the manifest's format and packaging version, each file's length and sha256, paths and entry kinds; see `package-reader.ts`). Then the engine builds it into a new video (a new `videoId`, all assets collected into the video; the engine checks the document and asset digests and references once more). If any step fails, no video directory is left behind. The staging directory is deleted in every outcome; if the process is killed hard, leftovers are removed by the leftover cleanup at the next startup (`leftover-files.ts`).
 *
 * Exposed to the desktop UI, the CLI and the Web service (the Web service limits files to the source directory in its handler), and to the session and terminal tool catalogue (`videos_import_package`, the same entry point). The external service (MCP) has no such entry point.
 */

type Scope = { projectId: Id } | { conversationId: Id };

/** Staging directory name in the source directory: `.cuccut-import-<8 hex digits>`. */
const STAGING_NAME = /^\.cuccut-import-[0-9a-f]{8}$/;

/** Staging directories in use by opens in progress (real paths). Startup leftover cleanup skips them; the entry points in the same process share them. */
const activeStaging = new Set<string>();

export function isImportStagingName(name: string): boolean {
  return STAGING_NAME.test(name);
}

export function activeImportStaging(): ReadonlySet<string> {
  return activeStaging;
}

export class PackageImporter {
  readonly #videos: VideoService;
  readonly #commands = new Map<Id, Promise<VideoOpenResult>>();

  constructor(videos: VideoService) {
    this.#videos = videos;
  }

  /** `options.name`: the video directory uses this name (when not given, the video name from the package is used). */
  import(
    params: RpcParams<'videos.importPackage'>,
    root: string,
    scope: Scope,
    principal: TrustedPrincipal,
    options: { name?: string } = {},
  ): Promise<VideoOpenResult> {
    if (params.commandId) {
      const existing = this.#commands.get(params.commandId);
      if (existing) return existing;
    }
    const run = this.#run(params.path, root, scope, principal, options.name);
    if (params.commandId) {
      const key = params.commandId;
      this.#commands.set(key, run);
      run.catch(() => this.#commands.delete(key));
    }
    return run;
  }

  async #run(given: string, root: string, scope: Scope, principal: TrustedPrincipal, name: string | undefined): Promise<VideoOpenResult> {
    const rootReal = await fs.realpath(root).catch(() => {
      throw new RpcError('not-found', RcVideo.sourceDirNotFound());
    });
    const file = await fs.realpath(path.isAbsolute(given) ? given : path.resolve(rootReal, given)).catch(() => {
      throw new RpcError('not-found', RcVideo.packageNotFound(), { code: 'PACKAGE_NOT_FOUND' });
    });
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new RpcError('invalid-request', RcVideo.packageNotFile(), { code: 'PACKAGE_INVALID' });

    const staging = path.join(rootReal, `.cuccut-import-${randomUUID().slice(0, 8)}`);
    activeStaging.add(staging);
    try {
      await fs.mkdir(staging);
      let manifest;
      try {
        ({ manifest } = await readPackage(file, { extractTo: staging }));
      } catch (error) {
        if (error instanceof PackageError) throw new RpcError('invalid-request', error.message, { ...error.details, code: error.code }, error.messageRef);
        throw error;
      }
      const base = videoDirName(name ?? manifest.videoName);
      let dir = path.join(rootReal, base);
      for (let n = 2; await exists(dir); n++) dir = path.join(rootReal, `${base} ${n}`);
      return await this.#videos.createFromPackage(dir, staging, rootReal, scope, principal);
    } finally {
      await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
      activeStaging.delete(staging);
    }
  }
}

async function exists(file: string): Promise<boolean> {
  return fs.lstat(file).then(
    () => true,
    () => false,
  );
}

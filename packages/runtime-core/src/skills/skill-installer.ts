import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  RpcError,
  SKILL_FILE,
  SKILL_LIMITS,
  SKILL_SOURCE_FILE,
  normalizeSkillId,
  nowIso,
  type SkillChangeResult,
  type SkillRemoveResult,
  type SkillSource,
} from '@cuccut/protocol';
import { listSkillFiles, readSkillFileMeta, type SkillCatalog } from './skill-catalog.ts';
import { fetchGithubSkill, parseGithubSkillUrl, type GithubFetchOptions } from './skill-github.ts';
import { RcSkills } from '@cuccut/protocol/messages/runtime-core';

/**
 * The install actions for skills (architecture design §12.9): add from a local folder, import from GitHub, remove. Only open to the desktop UI and the CLI (not in the Web service's allowlist).
 *
 * - Only writes the skill's own directory `<Runtime Home>/skills/<id>/`: it is first assembled in `skills/.staging/`, validated, given its source record, and then renamed into place in one step;
 *   on failure the staging directory is deleted, so no half-installed skill is left behind.
 * - Rejects with `SKILL_EXISTS` when the target already exists or a skill with the same id exists; never overwrites. This check runs before any copying or network access.
 * - Executes nothing: it only copies files. Symbolic links, special files, and anything over the file-count or total-size limits are rejected.
 * - The source (folder path, or GitHub URL, ref and commit) is recorded in `SKILL_SOURCE_FILE` inside the skill directory; the user's `SKILL.md` is not changed.
 * - A retry with the same `commandId` returns the first result (if that is still in progress, waits for it).
 */

export interface SkillInstallerOptions {
  catalog: SkillCatalog;
  offlineStrict: () => boolean;
  github?: GithubFetchOptions;
  /** Time limit for a whole GitHub import (default 2 minutes). */
  importTimeoutMs?: number;
}

const STAGING = '.staging';

export class SkillInstaller {
  readonly #options: SkillInstallerOptions;
  readonly #commands = new Map<string, Promise<SkillChangeResult>>();

  constructor(options: SkillInstallerOptions) {
    this.#options = options;
  }

  add(params: { path: string; id?: string; commandId?: string }): Promise<SkillChangeResult> {
    return this.#once(params.commandId && `add:${params.commandId}`, () => this.#add(params));
  }

  importGithub(params: { url: string; id?: string; commandId?: string }): Promise<SkillChangeResult> {
    return this.#once(params.commandId && `github:${params.commandId}`, () => this.#importGithub(params));
  }

  async remove(id: string): Promise<SkillRemoveResult> {
    const { catalog } = this.#options;
    const skill = await catalog.require(id);
    if (skill.scope !== 'user') {
      throw new RpcError('invalid-request', RcSkills.builtinNotRemovable({ name: skill.name }), {
        code: 'SKILL_BUILTIN_NOT_REMOVABLE',
        skillId: id,
      });
    }
    // Only deletes this one level of subdirectory under the user directory.
    if (path.dirname(path.resolve(skill.dir)) !== catalog.userDir) {
      throw new RpcError('invalid-request', RcSkills.notInUserDir({ dir: catalog.userDir }), {
        code: 'SKILL_INVALID',
        skillId: id,
        path: skill.dir,
      });
    }
    await fsp.rm(skill.dir, { recursive: true, force: true });
    await catalog.prefs.forget(id);
    return { ...(await catalog.list()), removed: { id, path: skill.dir } };
  }

  #once(key: string | undefined | '', run: () => Promise<SkillChangeResult>): Promise<SkillChangeResult> {
    if (!key) return run();
    const done = this.#commands.get(key);
    if (done) return done;
    const pending = run();
    this.#commands.set(key, pending);
    // Failures are not recorded: the same commandId can be retried.
    pending.catch(() => this.#commands.delete(key));
    return pending;
  }

  async #add(params: { path: string; id?: string }): Promise<SkillChangeResult> {
    const sourceDir = path.resolve(params.path);
    let real: string;
    try {
      real = await fsp.realpath(sourceDir);
      if (!(await fsp.stat(real)).isDirectory()) throw new Error('not a directory');
    } catch {
      throw new RpcError('not-found', RcSkills.sourceFolderNotFound({ path: sourceDir }), { code: 'SKILL_SOURCE_NOT_FOUND', path: sourceDir });
    }
    const id = this.#idFor(params.id, path.basename(real), sourceDir);
    const target = await this.#checkFree(id, sourceDir);
    // Cannot add the skills directory itself (or its parent), or a directory already inside it, again.
    const userReal = await fsp.realpath(this.#options.catalog.userDir).catch(() => this.#options.catalog.userDir);
    if (within(userReal, real) || within(real, userReal)) {
      throw new RpcError('invalid-request', RcSkills.folderOverlapsSkills(), {
        code: 'SKILL_INVALID',
        skillId: id,
        path: target,
        source: sourceDir,
        issues: [RcSkills.foldersOverlap({ source: sourceDir, skills: this.#options.catalog.userDir }).text],
      });
    }
    const listing = await listSkillFiles(real);
    if ('problem' in listing) {
      const tooMany = listing.tooMany === true;
      throw new RpcError('invalid-request', RcSkills.notAddable({ issue: listing.problem }), {
        code: tooMany ? 'SKILL_TOO_LARGE' : 'SKILL_INVALID',
        skillId: id,
        path: target,
        source: sourceDir,
        ...(tooMany ? { limit: { files: SKILL_LIMITS.files, bytes: SKILL_LIMITS.totalBytes } } : { issues: [listing.problem.text] }),
      });
    }
    if (!listing.files.some((f) => f.path === SKILL_FILE)) {
      throw new RpcError('invalid-request', RcSkills.folderNoSkillFile({ file: SKILL_FILE }), {
        code: 'SKILL_INVALID',
        skillId: id,
        path: target,
        source: sourceDir,
        issues: [RcSkills.missingRootFile({ file: SKILL_FILE }).text],
      });
    }
    const bytes = listing.files.reduce((sum, f) => sum + f.size, 0);
    if (bytes > SKILL_LIMITS.totalBytes) {
      throw new RpcError('invalid-request', RcSkills.folderBytesTooLarge({ bytes, limit: SKILL_LIMITS.totalBytes }), {
        code: 'SKILL_TOO_LARGE',
        skillId: id,
        path: target,
        source: sourceDir,
        files: listing.files.length,
        bytes,
        limit: { files: SKILL_LIMITS.files, bytes: SKILL_LIMITS.totalBytes },
      });
    }
    const source: SkillSource = { kind: 'local', path: sourceDir, addedAt: nowIso() };
    return this.#install(id, target, source, async (staging) => {
      for (const file of listing.files) {
        const dest = path.join(staging, ...file.path.split('/'));
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        // COPYFILE_EXCL: the staging directory is newly created, so nothing can be overwritten.
        await fsp.copyFile(path.join(real, ...file.path.split('/')), dest, fsp.constants.COPYFILE_EXCL);
      }
    });
  }

  async #importGithub(params: { url: string; id?: string }): Promise<SkillChangeResult> {
    const ref = parseGithubSkillUrl(params.url);
    const id = this.#idFor(params.id, ref.path ? ref.path.split('/').pop()! : ref.repo, ref.url);
    const target = await this.#checkFree(id, ref.url);
    if (this.#options.offlineStrict()) {
      throw new RpcError('conflict', RcSkills.offlineStrictNoImport(), { code: 'OFFLINE_STRICT', url: ref.url });
    }
    const signal = AbortSignal.timeout(this.#options.importTimeoutMs ?? 120_000);
    let fetched: { ref: string; commit: string } | null = null;
    return this.#install(
      id,
      target,
      () => sourceOf(fetched),
      async (staging) => {
        try {
          fetched = await fetchGithubSkill(ref, staging, { ...this.#options.github, signal });
        } catch (error) {
          // Errors from the download stage get the target directory and source attached, so the UI and CLI can report them accurately.
          if (error instanceof RpcError) {
            throw new RpcError(
              error.code,
              error.message,
              {
                ...((error.details ?? {}) as object),
                skillId: id,
                path: target,
                url: ref.url,
              },
              error.messageRef,
            );
          }
          throw error;
        }
      },
    );

    function sourceOf(done: { ref: string; commit: string } | null): SkillSource {
      return {
        kind: 'github',
        url: ref.url,
        owner: ref.owner,
        repo: ref.repo,
        ref: done?.ref ?? ref.ref ?? '',
        commit: done?.commit ?? '',
        path: ref.path,
        importedAt: nowIso(),
      };
    }
  }

  /** The given id, or one normalized from the name; if no id can be derived, the caller must supply one. */
  #idFor(given: string | undefined, name: string, from: string): string {
    const id = given ?? normalizeSkillId(name);
    if (!id) {
      throw new RpcError('invalid-request', RcSkills.noIdFromName({ name }), {
        code: 'SKILL_INVALID',
        source: from,
        issues: [RcSkills.noSkillId().text],
      });
    }
    return id;
  }

  /** The target directory must not exist, and no skill with the same id may exist (including built-in ones); otherwise `SKILL_EXISTS`. Returns the target directory. */
  async #checkFree(id: string, from: string): Promise<string> {
    const { catalog } = this.#options;
    const target = path.join(catalog.userDir, id);
    const exists = await fsp
      .lstat(target)
      .then(() => true)
      .catch(() => false);
    const taken = (await catalog.scan()).skills.some((s) => s.id === id);
    if (exists || taken) {
      throw new RpcError('conflict', RcSkills.skillExists({ id, path: target }), {
        code: 'SKILL_EXISTS',
        skillId: id,
        path: target,
        source: from,
      });
    }
    return target;
  }

  /** Assemble in the staging directory → validate → write the source → rename to the target. If any step fails, the staging directory is deleted. */
  async #install(
    id: string,
    target: string,
    source: SkillSource | (() => SkillSource),
    fill: (staging: string) => Promise<void>,
  ): Promise<SkillChangeResult> {
    const { catalog } = this.#options;
    const stagingRoot = path.join(catalog.userDir, STAGING);
    await fsp.mkdir(stagingRoot, { recursive: true });
    const staging = path.join(stagingRoot, `${id}-${crypto.randomBytes(6).toString('hex')}`);
    await fsp.mkdir(staging);
    try {
      await fill(staging);
      const meta = await readSkillFileMeta(path.join(staging, SKILL_FILE));
      if ('problem' in meta) {
        throw new RpcError('invalid-request', RcSkills.notAddable({ issue: meta.issues[0]! }), {
          code: 'SKILL_INVALID',
          skillId: id,
          path: target,
          source: sourceLabel(typeof source === 'function' ? source() : source),
          issues: meta.issues.map((issue) => issue.text),
        });
      }
      const record = typeof source === 'function' ? source() : source;
      await fsp.writeFile(path.join(staging, SKILL_SOURCE_FILE), `${JSON.stringify({ schemaVersion: 1, ...record }, null, 2)}\n`, {
        flag: 'wx',
      });
      // Check again before renaming: a directory with the same name may have been put there in the meantime. Renaming onto an existing non-empty directory fails, and is also treated as a conflict.
      if (
        await fsp.lstat(target).then(
          () => true,
          () => false,
        )
      )
        throw existsError(id, target);
      try {
        await fsp.rename(staging, target);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'EPERM') throw existsError(id, target);
        throw error;
      }
    } catch (error) {
      await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    const list = await catalog.list();
    const skill = list.skills.find((s) => s.id === id);
    if (!skill) {
      // Installed but cannot be loaded (for example, skipped because its id matches a built-in one): report this accurately and leave the directory in place so the user can look at the diagnostics.
      throw new RpcError('conflict', RcSkills.writtenNotLoaded({ path: target }), {
        code: 'SKILL_INVALID',
        skillId: id,
        path: target,
      });
    }
    return { ...list, skill };
  }
}

function existsError(id: string, target: string): RpcError {
  return new RpcError('conflict', RcSkills.skillExists({ id, path: target }), {
    code: 'SKILL_EXISTS',
    skillId: id,
    path: target,
  });
}

function sourceLabel(source: SkillSource): string {
  return source.kind === 'local' ? source.path : source.kind === 'github' ? source.url : source.packId;
}

function within(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

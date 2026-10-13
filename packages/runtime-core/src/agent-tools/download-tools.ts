import crypto from 'node:crypto';
import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { sanitizeFileName } from '@cuccut/jobs';
import type { JobSubmitter } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { inside, refuseVideoDirectory } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * `downloads_save` (architecture design §3.5, §7.9): copies a file from the session's working directory to the downloads
 * directory to hand it to the user. The user cannot see the working directory of a session without a project, so results the
 * agent makes itself (e.g. translated subtitles) go to the downloads directory through this tool, alongside files downloaded
 * by link import.
 *
 * - Source: a path relative to the working directory, judged by real path; it cannot point outside via `..`, an absolute path
 *   or a symlink; it must be a regular file, not inside a video directory (one containing `video.db`) or `.ccut`; at most
 *   `DOWNLOAD_SAVE_MAX_BYTES`. Anything failing these checks is refused outright, with no approval generated.
 * - Target: the downloads directory (the same one link import uses, see `resolveDownloadsDirectory`), created when missing.
 *   Only new files, never overwriting: on a name clash a number is appended as link import does (`name-2.srt`). The file name
 *   is sanitized (same rules as downloaded files) and keeps the source file's extension. After writing, the real path is
 *   checked to be inside the downloads directory.
 * - Risk `command` (§3.12): it writes a new file outside the working directory, so it still asks under `autoAcceptEdits`; only
 *   into the downloads directory, never overwriting, the same risk level as link-import downloads. Only for the session agent
 *   (`surfaces` is just `agent`): external services and the CLI have no session working directory.
 * - Handed-over files are registered as Space deliverables (`register`, §5.7): the same path as files downloaded from links,
 *   into Space's artifact records, located by artifact record, with links in replies opening the entry in a file tab. A
 *   registration failure does not affect the copy's result.
 */

/**
 * Per-file limit: this tool hands over text results the agent made (subtitles, transcripts, notes) and a little generated media,
 * from a few hundred KB to tens of MB; the copy completes synchronously within the tool call, and the limit bounds both the
 * call's duration and the downloads directory usage. Larger rendered videos go through `export`.
 */
export const DOWNLOAD_SAVE_MAX_BYTES = 200 * 1024 * 1024;

/** File name length limit (including the extension), in characters: the same as for link-import downloads. */
const NAME_MAX_CHARS = 120;
const EXTENSION = /^\.[A-Za-z0-9]{1,16}$/;

export interface DownloadToolsDeps {
  scope: ToolScope;
  /** The current downloads directory (setting `downloads.directory`, otherwise the host's Downloads folder). */
  downloadsDirectory: () => string;
  /** After copying, registers the file as a Space deliverable (`SpaceCatalog.recordHandover`). Absent means no registration (tests, tool catalog). */
  register?: (handover: DownloadHandover) => Promise<void>;
}

/** A file handed over by one `downloads_save`: its real path in the downloads directory, byte count, content digest and submitter. */
export interface DownloadHandover {
  path: string;
  bytes: number;
  /** `sha256:<hex>`: computed over the content written during the copy. */
  artifactId: string;
  submitter: JobSubmitter;
  at: string;
}

const schemas = {
  downloads_save: z.strictObject({
    path: z.string().min(1).max(1000).describe('The file in the working directory to hand to the user (a path relative to the working directory)'),
    name: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. File name in the downloads directory; defaults to the source file name. The source file\'s extension is kept (added if missing); on a name clash a number is appended automatically, never overwriting'),
  }),
};

type Args = z.infer<(typeof schemas)['downloads_save']>;

const DEFINITIONS: Record<'downloads_save', ToolInfo> = {
  downloads_save: {
    title: 'Save to downloads',
    description: [
      'Copies a file from the working directory into the downloads directory. The downloads directory is the setting downloads.directory, by default the system Downloads folder. When the session belongs to no project, the user cannot see the working directory: write results you make yourself (e.g. translated SRT subtitles, transcripts) in the working directory, then use this tool to put them in the downloads directory.',
      `path is relative to the working directory; it cannot point outside with .. or a symlink, and cannot be a file inside a video directory or .ccut; it must be a regular file of at most ${formatBytes(DOWNLOAD_SAVE_MAX_BYTES)}. Only new files, never overwriting: on a name clash a number is appended automatically.`,
      'The user is asked to confirm according to the access mode. Returns the absolute path in the downloads directory (path) and the byte count (bytes): tell the user the path.',
    ].join('\n'),
    annotations: { destructiveHint: false },
    effect: 'mutation',
    examples: [{ title: 'Hand translated subtitles to the user', args: { path: 'out/demo.vi.srt', name: 'Launch event Vietnamese subtitles' } }],
    // Only for the session agent: external services and the CLI have no session working directory.
    surfaces: ['agent'],
  },
};

export class DownloadTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: DownloadToolsDeps;

  constructor(deps: DownloadToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    if (name !== 'downloads_save') return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    return this.#save(args as Args, principal);
  }

  /** Checks the source and file name first (invalid ones generate no approval); creates the directory and writes only after confirmation. */
  async #save(args: Args, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const plan = await prepareDownloadSave({
      root: scope.saveRoot(access),
      path: args.path,
      ...(args.name !== undefined ? { name: args.name } : {}),
      downloadsDir: this.#deps.downloadsDirectory(),
    });
    const planned = path.join(plan.directory, plan.name);
    const approval = await scope.confirm(access, {
      tool: 'downloads_save',
      targets: [planned],
      ...confirmSummary(RcAgentTools.downloadSaveSummary({ source: plan.source, size: formatBytes(plan.bytes), target: planned })),
    });
    const saved = await plan.commit();
    // Registration is incidental: the file has already been handed over, so a registration failure (Space not ready, record write failed) does not fail the call.
    await this.#deps
      .register?.({ path: saved.path, bytes: saved.bytes, artifactId: saved.artifactId, submitter: access.submitter, at: new Date().toISOString() })
      .catch(() => {});
    return {
      path: saved.path,
      bytes: saved.bytes,
      ...approvalField(approval),
      next: 'The file was copied to the downloads directory (path is absolute). Tell the user this path; the original in the working directory is unchanged.',
    };
  }
}

/** A checked copy plan: source (relative to the working directory), target directory and file name (`commit` appends a number on a clash), source size. */
export interface DownloadSavePlan {
  source: string;
  directory: string;
  name: string;
  bytes: number;
  commit(): Promise<SavedDownload>;
}

/** The written file: real path, byte count and content digest (`sha256:<hex>`). */
export interface SavedDownload {
  path: string;
  bytes: number;
  artifactId: string;
}

interface PrepareParams {
  /** The session's working directory. */
  root: string;
  /** Source path relative to the working directory. */
  path: string;
  name?: string;
  downloadsDir: string;
  maxBytes?: number;
}

/** Check first, write later: this step is read-only, creating no directories and writing no files; `commit` re-verifies via the open file handle and refuses a source swapped after the check. */
export async function prepareDownloadSave(params: PrepareParams): Promise<DownloadSavePlan> {
  const max = params.maxBytes ?? DOWNLOAD_SAVE_MAX_BYTES;
  const rootReal = await fs.realpath(params.root);
  const given = params.path;
  if (path.isAbsolute(given) || path.win32.isAbsolute(given) || given.split(/[\\/]+/).includes('..')) throw outsideSource();
  const resolved = path.resolve(rootReal, given);
  if (resolved === rootReal || !inside(resolved, rootReal)) throw outsideSource();

  const stat = await fs.lstat(resolved).catch(() => null);
  if (!stat) throw new ToolError('FILE_NOT_FOUND', `No such file in the working directory: ${given}`);
  if (stat.isSymbolicLink()) throw new ToolError('PATH_IS_SYMLINK', 'path is a symbolic link: give the file it points to, inside the working directory');
  if (!stat.isFile()) throw new ToolError('NOT_A_FILE', 'path must be a regular file (not a directory)');
  // The parent directory is judged by real path: going through a symlinked directory pointing elsewhere also counts as outside.
  const dirReal = await fs.realpath(path.dirname(resolved));
  if (!inside(dirReal, rootReal)) throw outsideSource();
  const base = path.basename(resolved);
  await refuseVideoDirectory(rootReal, dirReal, [base]).catch((error: unknown) => {
    if (error instanceof ToolError && error.code === 'PATH_INSIDE_VIDEO') {
      throw new ToolError('PATH_INSIDE_VIDEO', 'Files inside a video directory (one containing video.db) or .ccut cannot be copied: use export to hand over a video\'s content');
    }
    throw error;
  });
  if (stat.size > max) throw tooLarge(stat.size, max);

  const file = path.join(dirReal, base);
  const name = downloadFileName(params.name ?? base, path.extname(base));
  const directory = path.resolve(params.downloadsDir);
  return {
    source: path.relative(rootReal, file),
    directory,
    name,
    bytes: stat.size,
    commit: () => copyInto(file, stat, directory, name, max),
  };
}

/**
 * File name in the downloads directory: keeps the source file's extension (anything other than `.` plus 1-16 alphanumerics is
 * not an extension), appending it when the name does not end with it; the rest is sanitized by the same rules as downloaded file
 * names (path separators, control characters and leading `.`/`-` removed), at most 120 characters including the extension.
 */
export function downloadFileName(given: string, sourceExtension: string): string {
  const ext = EXTENSION.test(sourceExtension) ? sourceExtension : '';
  const matched = ext !== '' && given.toLowerCase().endsWith(ext.toLowerCase()) && given.length > ext.length;
  const stem = sanitizeFileName(matched ? given.slice(0, -ext.length) : given);
  const limited = [...stem]
    .slice(0, NAME_MAX_CHARS - ext.length)
    .join('')
    .replace(/[.\s]+$/, '');
  return `${limited || 'download'}${matched ? given.slice(-ext.length) : ext}`;
}

async function copyInto(
  file: string,
  checked: Stats,
  directory: string,
  name: string,
  max: number,
): Promise<SavedDownload> {
  // Open the source without following symlinks, then verify via the handle that it is still the file that was checked.
  let source: fs.FileHandle;
  try {
    source = await fs.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ELOOP') throw new ToolError('PATH_IS_SYMLINK', 'path is a symbolic link: give the file it points to, inside the working directory');
    if (code === 'ENOENT') throw new ToolError('FILE_NOT_FOUND', 'The file disappeared after it was checked');
    throw error;
  }
  try {
    const now = await source.stat();
    if (!now.isFile() || now.ino !== checked.ino || now.dev !== checked.dev) {
      throw new ToolError('SOURCE_CHANGED', 'The file was replaced after it was checked: make sure it is the file you want to hand over, then call again');
    }
    if (now.size > max) throw tooLarge(now.size, max);

    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      throw unavailable(directory, error);
    }
    const dirReal = await fs.realpath(directory);
    const ext = path.extname(name);
    const stem = ext ? name.slice(0, -ext.length) : name;
    for (let n = 1; n < 10_000; n++) {
      const target = path.join(dirReal, `${stem}${n === 1 ? '' : `-${n}`}${ext}`);
      let out: fs.FileHandle;
      try {
        // 'wx': fails if it already exists (including as a symlink), so no overwrite and no following; created with 0644, not inheriting the source's executable bit.
        out = await fs.open(target, 'wx', 0o644);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
        throw unavailable(directory, error);
      }
      let bytes = 0;
      const hash = crypto.createHash('sha256');
      try {
        // Read from and write to handles in chunks, without loading the whole file into memory; give up if the bytes read exceed the limit (the file grew after the check).
        const buffer = Buffer.allocUnsafe(1024 * 1024);
        for (;;) {
          const { bytesRead } = await source.read(buffer, 0, buffer.length, bytes);
          if (bytesRead === 0) break;
          bytes += bytesRead;
          if (bytes > max) throw tooLarge(bytes, max);
          hash.update(buffer.subarray(0, bytesRead));
          for (let written = 0; written < bytesRead;) written += (await out.write(buffer, written, bytesRead - written)).bytesWritten;
        }
      } catch (error) {
        await out.close().catch(() => {});
        await fs.rm(target, { force: true });
        throw error;
      }
      await out.close();
      if (!inside(await fs.realpath(target), dirReal)) {
        await fs.rm(target, { force: true });
        throw unavailable(directory);
      }
      return { path: target, bytes, artifactId: `sha256:${hash.digest('hex')}` };
    }
    throw new ToolError('DOWNLOAD_NAME_EXHAUSTED', `Too many files with this name in the downloads directory: use another name`);
  } finally {
    await source.close().catch(() => {});
  }
}

function outsideSource(): ToolError {
  return new ToolError('PATH_OUTSIDE_WORKSPACE', 'path must be a file in this session\'s working directory (a relative path, no .., not through a symlink pointing elsewhere)');
}

function tooLarge(size: number, max: number): ToolError {
  return new ToolError('FILE_TOO_LARGE', `The file is ${formatBytes(size)}, over the ${formatBytes(max)} limit: export rendered videos with export`, {
    bytes: size,
    limit: max,
  });
}

function unavailable(directory: string, error?: unknown): ToolError {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return new ToolError(
    'DOWNLOADS_UNAVAILABLE',
    `The downloads directory is not writable: ${directory}. Ask the user to check that the downloads directory in settings (downloads.directory) exists and is writable${code === 'ENOSPC' ? ', and whether the disk is full' : ''}`,
    code ? { reason: code } : {},
  );
}

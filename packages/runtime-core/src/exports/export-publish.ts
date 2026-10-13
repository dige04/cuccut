import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { refOf, RpcError, type Localized, type MessageRef, type VideoRef } from '@cuccut/protocol';
import { RcExport } from '@cuccut/protocol/messages/runtime-core';

/**
 * Export destination and publishing (architecture design §9.11): by default under `exports/` in the video's source directory (the project directory, or the working directory of a session that is not in a project);
 * the file name is "video name.kind suffix.extension"; a name collision appends a sequence number " (2)"; existing files are not overwritten unless overwrite is explicitly requested.
 *
 * Publishing: first copy the verified file from staging into a hidden temp file in the target directory (staging and the target may be on different volumes), then attach it to the final name with a hard link.
 * The link fails if the name already exists, so it never overwrites someone else's file, and a half-written file never appears under the final name.
 * If the target volume does not support hard links (for example exFAT), it falls back to "confirm the name does not exist, then rename"; there is a very short race window between the two steps. When overwrite is requested, it renames directly to replace the file.
 */

export class DestinationError extends Error {
  readonly code: 'EXPORT_DESTINATION_EXISTS' | 'EXPORT_DESTINATION_UNWRITABLE';
  readonly path: string;
  readonly messageRef: MessageRef | undefined;
  constructor(code: DestinationError['code'], message: string | Localized, file: string) {
    super(String(message));
    this.code = code;
    this.path = file;
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }

  toRpc(): RpcError {
    const recovery =
      this.code === 'EXPORT_DESTINATION_EXISTS' ? RcExport.destinationExistsRecovery() : RcExport.destinationUnwritableRecovery();
    return new RpcError('conflict', this.message, { code: this.code, path: this.path, recovery: recovery.text }, this.messageRef);
  }
}

/** The video's source directory: the video directory with the path relative to the source directory removed. */
export function sourceRoot(ref: VideoRef): string {
  const depth = ref.relPath.split('/').filter((s) => s && s !== '.').length;
  return depth === 0 ? path.dirname(ref.path) : path.resolve(ref.path, ...Array<string>(depth).fill('..'));
}

/** Characters not allowed in file names are replaced with `_`; an empty name becomes `video`. */
export function safeFileStem(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return cleaned || 'video';
}

/** Adds (or replaces) the correct extension on the given file name. */
export function withExtension(fileName: string, extension: string): string {
  return path.extname(fileName).toLowerCase() === `.${extension}` ? fileName : `${fileName}.${extension}`;
}

/** The nth candidate name: `a.srt`, `a (2).srt`, `a (3).srt`, and so on. */
export function candidateName(fileName: string, n: number): string {
  if (n <= 1) return fileName;
  const ext = path.extname(fileName);
  return `${fileName.slice(0, fileName.length - ext.length)} (${n})${ext}`;
}

async function exists(file: string): Promise<boolean> {
  return fs.lstat(file).then(
    () => true,
    () => false,
  );
}

/**
 * Preflights the target directory: if given, it must be an existing, writable absolute path; the default `exports/` is created as needed. Returns the absolute path of the directory.
 */
export async function prepareDirectory(dir: string, isDefault: boolean): Promise<string> {
  if (!path.isAbsolute(dir)) throw new DestinationError('EXPORT_DESTINATION_UNWRITABLE', RcExport.destinationNotAbsolute(), dir);
  if (isDefault) {
    await fs.mkdir(dir, { recursive: true }).catch((error: NodeJS.ErrnoException) => {
      throw new DestinationError('EXPORT_DESTINATION_UNWRITABLE', RcExport.destinationCreateFailed({ reason: error.code ?? error.message }), dir);
    });
  }
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) throw new DestinationError('EXPORT_DESTINATION_UNWRITABLE', RcExport.destinationNotDirectory(), dir);
  try {
    await fs.access(dir, fsConstants.W_OK);
  } catch {
    throw new DestinationError('EXPORT_DESTINATION_UNWRITABLE', RcExport.destinationNotWritable(), dir);
  }
  return dir;
}

/** Preflight: rejects a given file name that already exists when overwrite was not requested. A default name that collides gets a sequence number at publish time, so it is not rejected here. */
export async function checkFixedName(dir: string, fileName: string, overwrite: boolean): Promise<void> {
  const file = path.join(dir, fileName);
  if (!overwrite && (await exists(file))) {
    throw new DestinationError('EXPORT_DESTINATION_EXISTS', RcExport.destinationFileExists({ fileName }), file);
  }
}

/**
 * Publishes the file from staging to `dir/fileName`. With `fixed`, the name cannot change (a collision is rejected); otherwise a collision adds a sequence number.
 * Returns the final absolute path. The temp file is always cleaned up, whatever the outcome.
 */
export async function publishFile(
  staged: string,
  dir: string,
  fileName: string,
  options: { overwrite: boolean; fixed: boolean },
): Promise<string> {
  const tmp = hiddenTemp(dir, fileName);
  try {
    await fs.copyFile(staged, tmp);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw new DestinationError(
      'EXPORT_DESTINATION_UNWRITABLE',
      RcExport.destinationWriteFailed({ reason: (error as NodeJS.ErrnoException).code ?? String(error) }),
      dir,
    );
  }
  return publishInPlace(tmp, dir, fileName, options);
}

/** The hidden temp file name in the target directory: output is written here before it is published. */
export function hiddenTemp(dir: string, fileName: string): string {
  return path.join(dir, `.${fileName}.${randomUUID().slice(0, 8)}.tmp`);
}

/** Whether `name` is the temp file name that `hiddenTemp` produces for the output `fileName` (`.<fileName>.<8 hex digits>.tmp`). */
export function isHiddenTempOf(name: string, fileName: string): boolean {
  const prefix = `.${fileName}.`;
  return name.startsWith(prefix) && /^[0-9a-f]{8}\.tmp$/.test(name.slice(prefix.length));
}

/**
 * Attaches the hidden temp file `tmp`, which is already written in the target directory, to the final name (same rules as `publishFile`). A portable package is written directly in the target directory,
 * so it is not copied again through staging. The temp file is always cleaned up, whatever the outcome.
 */
export async function publishInPlace(
  tmp: string,
  dir: string,
  fileName: string,
  options: { overwrite: boolean; fixed: boolean },
): Promise<string> {
  try {
    if (options.overwrite) {
      const final = path.join(dir, fileName);
      await fs.rename(tmp, final);
      return final;
    }
    for (let n = 1; n <= 999; n++) {
      const name = candidateName(fileName, n);
      const final = path.join(dir, name);
      try {
        await fs.link(tmp, final);
        return final;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EEXIST') {
          if (options.fixed) throw new DestinationError('EXPORT_DESTINATION_EXISTS', RcExport.destinationFileExists({ fileName: name }), final);
          continue;
        }
        // Volume without hard-link support: confirm the name does not exist, then rename.
        if (await exists(final)) {
          if (options.fixed) throw new DestinationError('EXPORT_DESTINATION_EXISTS', RcExport.destinationFileExists({ fileName: name }), final);
          continue;
        }
        await fs.rename(tmp, final);
        return final;
      }
    }
    throw new DestinationError('EXPORT_DESTINATION_EXISTS', RcExport.destinationTooManyDuplicates(), path.join(dir, fileName));
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

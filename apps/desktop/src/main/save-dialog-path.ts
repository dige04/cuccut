import path from 'node:path';

/** The file name must not carry a directory; the initial directory follows the host's path rules. */
export function saveDialogPath(defaultName: unknown, defaultDir: unknown, platform = process.platform): string | undefined {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const name = typeof defaultName === 'string' ? paths.basename(defaultName).slice(0, 200) : '';
  const dir = typeof defaultDir === 'string' && !/[\u0000-\u001f\u007f]/.test(defaultDir) && paths.isAbsolute(defaultDir) ? defaultDir : '';
  return dir ? paths.join(dir, name) : name || undefined;
}

/** Maximum size in bytes of a file the renderer process hands over to save (matches the limit of the editor message `editor:save-file`). */
export const SAVE_FILE_MAX_BYTES = 512 * 1024 * 1024;

/** Content the renderer process hands over to save: only a Uint8Array is accepted (it stays one after the IPC structured clone); anything over the limit is rejected. */
export function saveFileData(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new Error('the file content is missing');
  if (value.byteLength > SAVE_FILE_MAX_BYTES) throw new Error('the file is too large to save');
  return value;
}

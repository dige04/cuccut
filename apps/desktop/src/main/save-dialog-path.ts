import path from 'node:path';

/** 文件名不能夹带目录；初始目录按宿主的路径规则处理。 */
export function saveDialogPath(defaultName: unknown, defaultDir: unknown, platform = process.platform): string | undefined {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const name = typeof defaultName === 'string' ? paths.basename(defaultName).slice(0, 200) : '';
  const dir = typeof defaultDir === 'string' && !/[\u0000-\u001f\u007f]/.test(defaultDir) && paths.isAbsolute(defaultDir) ? defaultDir : '';
  return dir ? paths.join(dir, name) : name || undefined;
}

/** 渲染进程交来要保存的文件最大多少字节（与编辑器消息 `editor:save-file` 的上限一致）。 */
export const SAVE_FILE_MAX_BYTES = 512 * 1024 * 1024;

/** 渲染进程交来要保存的内容：只收 Uint8Array（IPC 结构化克隆后仍是它），超过上限的不收。 */
export function saveFileData(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new Error('the file content is missing');
  if (value.byteLength > SAVE_FILE_MAX_BYTES) throw new Error('the file is too large to save');
  return value;
}

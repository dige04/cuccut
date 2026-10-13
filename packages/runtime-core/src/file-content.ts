import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileTypeFromBuffer } from 'file-type';
import type { FileContentKind, TextEncoding } from '@cuccut/protocol';

export const FILE_SAMPLE_BYTES = 64 * 1024;
export interface FileContentInfo { contentKind: FileContentKind; mimeType: string; textEncoding?: TextEncoding }
const ARCHIVES = new Set(['zip', 'gz', 'bz2', 'xz', '7z', 'rar', 'tar', 'zst', 'lz', 'lzh', 'cab', 'ar', 'iso']);
const binary = (): FileContentInfo => ({ contentKind: 'binary', mimeType: 'application/octet-stream' });

/** Content sniffing comes first; only after confirming the content is text does the extension decide whether to keep a text media type such as JSON or subtitles. */
export async function classifyFileContent(sample: Uint8Array, complete: boolean, name: string): Promise<FileContentInfo> {
  // Do not decompress a container to recognize its extension: archives are identified by their header first, so a small sample does not trigger large-scale decompression.
  const begins = (...signature: number[]) => signature.every((byte, i) => sample[i] === byte);
  const archiveMime = begins(0x50, 0x4b, 3, 4) || begins(0x50, 0x4b, 5, 6) || begins(0x50, 0x4b, 7, 8) ? 'application/zip'
    : begins(0x1f, 0x8b) ? 'application/gzip'
    : begins(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c) ? 'application/x-7z-compressed'
    : begins(0x52, 0x61, 0x72, 0x21) ? 'application/vnd.rar'
    : begins(0x28, 0xb5, 0x2f, 0xfd) ? 'application/zstd'
    : begins(0x42, 0x5a, 0x68) ? 'application/x-bzip2'
    : begins(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0) ? 'application/x-xz' : null;
  if (archiveMime) return { contentKind: 'archive', mimeType: archiveMime };
  let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>;
  try { detected = await fileTypeFromBuffer(sample); } catch { /* The container's index may lie beyond the sampled range; do not keep reading the whole file. */ }
  if (detected && detected.mime !== 'application/xml') {
    const contentKind: FileContentKind = detected.mime.startsWith('image/') ? 'image'
      : detected.mime.startsWith('video/') ? 'video'
      : detected.mime.startsWith('audio/') ? 'audio'
      : detected.mime === 'application/pdf' ? 'pdf'
      : ARCHIVES.has(detected.ext) ? 'archive' : 'binary';
    return { contentKind, mimeType: detected.mime };
  }
  const encoding: TextEncoding = sample[0] === 0xff && sample[1] === 0xfe ? 'utf-16le'
    : sample[0] === 0xfe && sample[1] === 0xff ? 'utf-16be' : 'utf-8';
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(sample, { stream: !complete }); }
  catch { return binary(); }
  // NUL and non-printable control characters cannot count as text; keep newline, tab, carriage return, and form feed.
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/u.test(text)) return binary();
  const start = text.trimStart().replace(/^<\?xml[\s\S]*?\?>\s*/i, '').replace(/^(?:<!--[\s\S]*?-->\s*)+/, '');
  if (/^<svg(?:[\s/>])|^<!doctype\s+svg\b/i.test(start)) return { contentKind: 'image', mimeType: 'image/svg+xml' };
  const ext = name.split('.').pop()?.toLowerCase();
  const mime = /^<!doctype\s+html\b|^<html(?:\s|>)/i.test(start) || ext === 'html' || ext === 'htm' ? 'text/html'
    : ext === 'json' ? 'application/json'
    : ext === 'md' || ext === 'markdown' ? 'text/markdown'
    : ext === 'vtt' ? 'text/vtt'
    : 'text/plain';
  return { contentKind: 'text', mimeType: `${mime}; charset=${encoding}`, textEncoding: encoding };
}

/** The caller first validates the real path against the resource scope. Reads only a bounded prefix, and rejects a final-component symbolic link that was swapped in at open time. */
export async function inspectFileContent(file: string, size: number): Promise<FileContentInfo> {
  const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const handle = await fs.open(file, flags);
  try {
    if (!(await handle.stat()).isFile()) throw new Error('FILE_NOT_REGULAR');
    const sample = Buffer.alloc(Math.min(FILE_SAMPLE_BYTES, size));
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
    return await classifyFileContent(sample.subarray(0, bytesRead), bytesRead >= size, file);
  } finally { await handle.close(); }
}

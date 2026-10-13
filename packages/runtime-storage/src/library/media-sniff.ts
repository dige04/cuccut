/**
 * Identifies a library file's type from its file header (architecture design §5.9: content only, not the extension). The extension is determined by the type,
 * and the file is stored as `<digest>.<extension>`. The engine identifies the media kind by extension when it imports assets.
 */

export type SniffCategory = 'image' | 'video' | 'audio' | 'font';

export interface SniffedType {
  mediaType: string;
  ext: string;
  category: SniffCategory;
}

/** Length of the file header read to identify the type. */
export const SNIFF_HEAD_BYTES = 4096;

export function sniffBytes(head: Uint8Array): SniffedType | null {
  const ascii = (start: number, text: string) =>
    head.length >= start + text.length && text.split('').every((c, i) => head[start + i] === c.charCodeAt(0));
  const type = (mediaType: string, ext: string, category: SniffCategory): SniffedType => ({ mediaType, ext, category });

  if (head.length >= 8 && head[0] === 0x89 && ascii(1, 'PNG\r\n\x1a\n')) return type('image/png', 'png', 'image');
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return type('image/jpeg', 'jpg', 'image');
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return type('image/gif', 'gif', 'image');
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return type('image/webp', 'webp', 'image');
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return type('audio/wav', 'wav', 'audio');
  if (ascii(0, 'fLaC')) return type('audio/flac', 'flac', 'audio');
  if (ascii(0, 'OggS')) return type('audio/ogg', 'ogg', 'audio');
  if (ascii(0, 'ID3')) return type('audio/mpeg', 'mp3', 'audio');
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return type('audio/mp4', 'm4a', 'audio');
    if (brand === 'qt  ') return type('video/quicktime', 'mov', 'video');
    return type('video/mp4', 'mp4', 'video');
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return Buffer.from(head).includes('webm') ? type('video/webm', 'webm', 'video') : type('video/x-matroska', 'mkv', 'video');
  }
  if (ascii(0, 'OTTO')) return type('font/otf', 'otf', 'font');
  if ((head.length >= 4 && head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) || ascii(0, 'true')) {
    return type('font/ttf', 'ttf', 'font');
  }
  if (ascii(0, 'wOF2')) return type('font/woff2', 'woff2', 'font');
  if (ascii(0, 'wOFF')) return type('font/woff', 'woff', 'font');
  // MPEG audio frame sync word: eleven 1 bits (placed last, so other formats are not identified as mp3).
  if (head.length >= 2 && head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) return type('audio/mpeg', 'mp3', 'audio');
  return null;
}

/** Extensions of library files, by media type. */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'video/quicktime': 'mov',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'font/otf': 'otf',
  'font/ttf': 'ttf',
  'font/woff2': 'woff2',
  'application/json': 'json',
  // `.lottie` archive: the engine identifies it as Lottie when importing assets, based on `.lottie`.
  'application/zip': 'lottie',
};

export function extensionOf(mediaType: string): string {
  return EXTENSIONS[mediaType] ?? 'bin';
}

/** Formats accepted for reference recordings: widely accepted by cloning and synthesis vendors, and decodable by ffprobe by format. */
export const VOICE_AUDIO_TYPES: readonly string[] = ['audio/wav', 'audio/mpeg', 'audio/flac'];

/** Fonts the engine recognizes (`woff` is not included). */
export const FONT_TYPES: readonly string[] = ['font/ttf', 'font/otf', 'font/woff2'];

/** Lottie animation JSON: a sticker can be this. Checks only the required fields. */
export function isLottie(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    (typeof v.v === 'string' || typeof v.v === 'number') &&
    typeof v.fr === 'number' &&
    typeof v.ip === 'number' &&
    typeof v.op === 'number' &&
    Array.isArray(v.layers)
  );
}

/** Media type of a `.lottie` archive. */
export const DOTLOTTIE_MEDIA_TYPE = 'application/zip';

/** Whether the file header is a zip (local file header `PK\x03\x04`). */
export function looksLikeZip(head: Uint8Array): boolean {
  return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/**
 * `.lottie` archive (dotLottie): the zip's central directory contains `animations/<id>.json` (version 2 uses `a/<id>.json`).
 * Only entry names are checked. Whether the animation can be opened is judged by the engine's core at import time. Archives whose central directory cannot be read do not count.
 */
export function isDotLottie(bytes: Uint8Array): boolean {
  if (!looksLikeZip(bytes)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End-of-central-directory record: 22 bytes, followed by a comment of at most 65535 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return false;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return false;
    const nameLength = view.getUint16(at + 28, true);
    const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (at + 46 + nameLength > bytes.length) return false;
    const name = Buffer.from(bytes.subarray(at + 46, at + 46 + nameLength)).toString('utf8');
    if (/^(animations|a)\/[^/]+\.json$/.test(name)) return true;
    at += 46 + skip;
  }
  return false;
}

/** The first character after removing the UTF-8 BOM and leading whitespace. null if all whitespace. */
export function firstTextChar(head: Uint8Array): string | null {
  let i = 0;
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) i = 3;
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x09 || head[i] === 0x0a || head[i] === 0x0d)) i++;
  return i < head.length ? String.fromCharCode(head[i]!) : null;
}

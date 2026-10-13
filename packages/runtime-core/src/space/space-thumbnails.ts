import fs from 'node:fs/promises';
import path from 'node:path';
import { RpcError, SPACE_EXCERPT_MAX_BYTES, SPACE_THUMBNAIL_WIDTH, type Id, type SpaceEntry, type SpaceThumbnail } from '@cuccut/protocol';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';
import type { Logger } from '@cuccut/harness';
import type { MediaAnalysis, MediaFrame } from '../media-analysis.ts';
import { resolveInside } from '../media.ts';
import type { SpaceCatalog } from '../space-catalog.ts';

/**
 * Thumbnails of Space entries (`space.thumbnail`, architecture design §5.7, product design §4.2–§4.3). The grid cards and the name column of the list fetch them on demand.
 *
 * - Video: the cover frame (`posterFrame`) of the current working draft. The asset version and time come from the content index (§5.11). If there is no index yet, the index is asked to read this one first.
 *   The asset file is found by the video directory through the engine's read-only query (`VideoService.assetFileAt`). The video is not opened and no write lock is taken. Linked assets are allowed under the media channel's rules.
 *   The image is cached by the asset's content digest. While the timeline and the cover frame are unchanged, the file is not looked up again and ffmpeg is not run again.
 * - Rendered cuts, video assets and images: a frame is taken from the entry's file (`SpaceCatalog.locateBytes`), cached by real path, size and modification time.
 * - Documents and subtitles: the opening body text. Subtitles keep only the dialogue lines. PDF, Word and RTF are not read.
 *
 * Every frame extraction goes through media analysis (`MediaAnalysis`): the same demuxer allowlist, time limit, output cap and concurrency slots apply, and failures are remembered for a while. Here, everything that cannot be read or decoded is answered as `none` rather than an error, so the UI still shows the type placeholder.
 */

const NONE: SpaceThumbnail = { kind: 'none' };

/** Time for frame extraction from rendered cuts and video assets: the earlier of 1 second and 10% of the duration. This avoids the black leader without going past very short videos. */
const VIDEO_FRAME_AT = 1;
const VIDEO_FRAME_FRACTION = 0.1;

const TEXT_EXTS = new Set(['md', 'markdown', 'txt']);
const SUBTITLE_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa']);
/** Subtitles need more text read to gather enough summary, since sequence numbers, timecodes and styles are stripped. */
const SUBTITLE_READ_BYTES = 32 * 1024;

export interface SpaceThumbnailDeps {
  catalog: SpaceCatalog;
  analysis: MediaAnalysis;
  /** Finds the asset file version by the video directory (`VideoService.assetFileAt`). */
  assetFileAt: (dir: string, assetId: Id, revision: string) => Promise<{ root: string; file: string }>;
  log: Logger;
}

export class SpaceThumbnails {
  readonly #deps: SpaceThumbnailDeps;
  readonly #log: Logger;

  constructor(deps: SpaceThumbnailDeps) {
    this.#deps = deps;
    this.#log = deps.log.child('space-thumbnails');
  }

  /** Thumbnail of an entry. The caller has already looked up the entry by principal (entries that are not visible are already `not-found`), so no error is raised here. */
  async of(entry: SpaceEntry): Promise<SpaceThumbnail> {
    if (entry.status === 'missing' || entry.status === 'generating' || entry.status === 'failed') return NONE;
    try {
      return await this.#compute(entry);
    } catch (error) {
      this.#log.debug('Item has no thumbnail', { kind: entry.kind, error: error instanceof Error ? error.message : String(error) });
      return NONE;
    }
  }

  async #compute(entry: SpaceEntry): Promise<SpaceThumbnail> {
    const { catalog, analysis } = this.#deps;
    switch (entry.kind) {
      case 'video':
        return this.#videoPoster(entry);
      case 'export':
      case 'video-file': {
        const duration = entry.media?.durationSec;
        const at = duration && duration > 0 ? Math.min(VIDEO_FRAME_AT, duration * VIDEO_FRAME_FRACTION) : VIDEO_FRAME_AT;
        return image(await analysis.fileFrame(catalog.locateBytes(entry.id), { at, width: SPACE_THUMBNAIL_WIDTH }));
      }
      case 'image':
        return image(await analysis.fileFrame(catalog.locateBytes(entry.id), { at: 0, width: SPACE_THUMBNAIL_WIDTH }));
      case 'document':
      case 'subtitle': {
        const { root, file } = catalog.locateBytes(entry.id);
        const ext = path.extname(file).slice(1).toLowerCase();
        if (!TEXT_EXTS.has(ext) && !SUBTITLE_EXTS.has(ext)) return NONE;
        const subtitle = SUBTITLE_EXTS.has(ext);
        const { realPath } = await resolveInside(root, file);
        const text = await readHead(realPath, subtitle ? SUBTITLE_READ_BYTES : SPACE_EXCERPT_MAX_BYTES * 2);
        const excerpt = text === null ? '' : excerptOf(subtitle ? subtitleDialogue(text, ext) : text);
        return excerpt ? { kind: 'text', excerpt } : NONE;
      }
      default:
        return NONE;
    }
  }

  /**
   * The main asset file of a video entry (the media channel's `media.resolve` with `entryId`, used for in-place playback of the video card in the session). It is the asset version that contains the cover frame, from the same source as the thumbnail. It does not open the video and takes no write lock. It is the asset itself, with no timeline cuts, subtitles or overlays applied. `not-found` when there is no cover.
   */
  async videoSource(entryId: Id): Promise<{ root: string; file: string }> {
    const { catalog, assetFileAt } = this.#deps;
    const dir = catalog.videoEntry(entryId).dir;
    const poster = (await catalog.index?.ensure(dir))?.facts.poster;
    if (!poster) throw new RpcError('not-found', RcSpace.noReadableFile());
    return assetFileAt(dir, poster.assetId, poster.revision);
  }

  /** Cover of a video: only for videos in a source directory (deleted videos are not in the content index). */
  async #videoPoster(entry: SpaceEntry): Promise<SpaceThumbnail> {
    const { catalog, analysis, assetFileAt } = this.#deps;
    const index = catalog.index;
    if (!index) return NONE;
    let dir: string;
    try {
      dir = catalog.videoEntry(entry.id).dir;
    } catch {
      return NONE;
    }
    const poster = (await index.ensure(dir))?.facts.poster;
    if (!poster) return NONE;
    const frame = await analysis.assetFrame(poster, poster.at, SPACE_THUMBNAIL_WIDTH, () =>
      assetFileAt(dir, poster.assetId, poster.revision),
    );
    return image(frame);
  }
}

function image(frame: MediaFrame): SpaceThumbnail {
  return { kind: 'image', mimeType: frame.mimeType, data: frame.data.toString('base64'), width: frame.width, height: frame.height };
}

/** Reads the first `limit` bytes of a file and decodes them to text. `null` if it is not text (contains NUL, is not UTF-8, and has no UTF-16 BOM). */
async function readHead(file: string, limit: number): Promise<string | null> {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    const complete = bytesRead < limit;
    return decodeText(buffer.subarray(0, bytesRead), complete);
  } finally {
    await handle.close();
  }
}

/**
 * Bytes at the start of a file → text. Recognizes UTF-8 (BOM stripped) and UTF-16 with a BOM. Other encodings are not guessed (the product does not assume any language's legacy encoding); the answer is `null`.
 * When `complete` is false, the bytes are truncated: the half character at the end is dropped.
 */
export function decodeText(bytes: Uint8Array, complete: boolean): string | null {
  let encoding = 'utf-8';
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) [encoding, start] = ['utf-16le', 2];
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) [encoding, start] = ['utf-16be', 2];
  const body = bytes.subarray(start);
  if (encoding === 'utf-8' && body.includes(0)) return null;
  try {
    const text = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(body, { stream: !complete });
    return encoding === 'utf-8' ? text : text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

/** Summary: normalizes line endings, trims leading and trailing whitespace, and truncates to within `SPACE_EXCERPT_MAX_BYTES` bytes (cut at a character boundary). */
export function excerptOf(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const bytes = Buffer.from(normalized, 'utf8');
  if (bytes.length <= SPACE_EXCERPT_MAX_BYTES) return normalized;
  // Streaming decode: an incomplete character at the end stays in the decoder and is not output.
  return new TextDecoder('utf-8').decode(bytes.subarray(0, SPACE_EXCERPT_MAX_BYTES), { stream: true }).trimEnd();
}

/** Subtitle file lines: one cue per line. SRT and WebVTT: strip the sequence number or identifier, timecodes, header and comment blocks, and tags. ASS / SSA: keep only the text of dialogue lines. */
export function subtitleDialogue(text: string, ext: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  if (ext === 'ass' || ext === 'ssa') {
    let textField = 9;
    for (const line of lines) {
      const format = /^Format:\s*(.*)$/i.exec(line);
      if (format && /\bText\b/i.test(format[1]!)) {
        textField = format[1]!.split(',').findIndex((field) => field.trim().toLowerCase() === 'text');
        continue;
      }
      const dialogue = /^Dialogue:\s*(.*)$/i.exec(line);
      if (!dialogue) continue;
      const fields = dialogue[1]!.split(',');
      const spoken = fields
        .slice(textField)
        .join(',')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\\[Nn]/g, '\n')
        .replace(/\\h/g, ' ');
      for (const part of spoken.split('\n')) if (part.trim()) out.push(part.trim());
    }
    return out.join('\n');
  }
  // SRT / WebVTT: split into blocks by blank lines. Lines before the timecode line are the sequence number or identifier. Blocks without a timecode (the WEBVTT header, NOTE, STYLE, REGION) are skipped entirely.
  let block: string[] = [];
  const flush = () => {
    const cue = block.findIndex((line) => line.includes('-->'));
    if (cue >= 0) {
      for (const line of block.slice(cue + 1)) {
        const spoken = cleanCue(line);
        if (spoken) out.push(spoken);
      }
    }
    block = [];
  };
  for (const line of lines) {
    if (line.trim() === '') flush();
    else block.push(line);
  }
  flush();
  return out.join('\n');
}

/** Strips tags from subtitle lines (`<i>`, `<v speaker>`, `<00:00:01.000>`, `{\an8}`) and common character entities. */
function cleanCue(line: string): string {
  return line
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

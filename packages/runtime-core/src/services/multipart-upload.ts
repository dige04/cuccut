import fs from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { refOf, type Localized, type MessageRef } from '@cuccut/protocol';
import { RcWeb } from '@cuccut/protocol/messages/runtime-core';

/**
 * Streams a `multipart/form-data` body (the transcription upload of the model API service, architecture design §4.8, §12.8):
 *
 * - The only file field is written to the staging file given by the caller as it is read, not held entirely in memory;
 * - Text fields stay in memory, each at most `MAX_FIELD_BYTES`, and at most `MAX_FIELDS` of them;
 * - When the total body length exceeds the limit, stop immediately and throw `UploadTooLarge` (if `Content-Length` already exceeds it, do not read a single byte);
 * - Throws `MalformedUpload` when the format is wrong. The file name is only recorded, not used to build paths.
 */

const MAX_FIELD_BYTES = 64 * 1024;
const MAX_FIELDS = 64;
const MAX_HEADER_BYTES = 16 * 1024;

export class UploadTooLarge extends Error {}
export class MalformedUpload extends Error {
  readonly messageRef: MessageRef | undefined;

  constructor(message: string | Localized) {
    super(String(message));
    this.messageRef = typeof message === 'string' ? undefined : refOf(message);
  }
}

export interface UploadedFile {
  /** Field name (the model API service only accepts `file`). */
  field: string;
  /** The file name given by the client (used only for display and format guessing). */
  filename: string | null;
  /** The media type given by the client; null if not given. */
  contentType: string | null;
  /** The staging file written. */
  path: string;
  size: number;
}

export interface MultipartResult {
  /** Text fields (the same name may repeat; in order of appearance). */
  fields: Map<string, string[]>;
  file: UploadedFile | null;
}

/** The boundary in `Content-Type`; null if it is not multipart/form-data. */
export function multipartBoundary(contentType: string | undefined): string | null {
  if (!contentType || !/^multipart\/form-data\s*(;|$)/i.test(contentType)) return null;
  const match = /;\s*boundary=(?:"([^"]{1,200})"|([^\s;]{1,200}))/i.exec(contentType);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

/**
 * Reads the whole body. The file is written to `filePath` (the directory must already exist); the caller is responsible for deleting it (including after a throw).
 * `maxBytes` is the limit for the whole body.
 */
export async function readMultipart(
  request: IncomingMessage,
  options: { boundary: string; filePath: string; maxBytes: number },
): Promise<MultipartResult> {
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > options.maxBytes) throw new UploadTooLarge();

  const delimiter = Buffer.from(`\r\n--${options.boundary}`);
  const fields = new Map<string, string[]>();
  let file: UploadedFile | null = null;
  let handle: fs.FileHandle | null = null;
  let fieldCount = 0;
  // Prepend a CRLF at the front: the first delimiter is written the same way as the later ones.
  let buffer: Buffer = Buffer.from('\r\n');
  let total = 0;
  let state: 'preamble' | 'after-delimiter' | 'headers' | 'body' | 'done' = 'preamble';
  let part: { field: string; filename: string | null; contentType: string | null; chunks: Buffer[]; size: number; isFile: boolean } | null =
    null;

  const emit = async (data: Buffer) => {
    if (!part || data.length === 0) return;
    part.size += data.length;
    if (part.isFile) {
      await handle!.write(data);
    } else {
      if (part.size > MAX_FIELD_BYTES) throw new MalformedUpload(RcWeb.fieldTooLong({ field: part.field }));
      part.chunks.push(data);
    }
  };

  const finishPart = async () => {
    if (!part) return;
    if (part.isFile) {
      await handle!.close();
      handle = null;
      file = { field: part.field, filename: part.filename, contentType: part.contentType, path: options.filePath, size: part.size };
    } else {
      const values = fields.get(part.field) ?? [];
      values.push(Buffer.concat(part.chunks).toString('utf8'));
      fields.set(part.field, values);
    }
    part = null;
  };

  /** Processes the processable part of the buffer; returns when more data is needed. */
  const drain = async () => {
    for (;;) {
      if (state === 'preamble') {
        const at = buffer.indexOf(delimiter);
        if (at < 0) {
          // The leading part is useless: keep only the tail that may begin a delimiter.
          buffer = buffer.subarray(Math.max(0, buffer.length - delimiter.length + 1));
          return;
        }
        buffer = buffer.subarray(at + delimiter.length);
        state = 'after-delimiter';
      } else if (state === 'after-delimiter') {
        if (buffer.length < 2) return;
        const next = buffer.subarray(0, 2).toString('latin1');
        if (next === '--') {
          state = 'done';
          return;
        }
        // After the delimiter there may be whitespace, then CRLF.
        const eol = buffer.indexOf('\r\n');
        if (eol < 0) {
          if (buffer.length > 256) throw new MalformedUpload(RcWeb.noNewlineAfterBoundary());
          return;
        }
        if (buffer.subarray(0, eol).toString('latin1').trim() !== '') throw new MalformedUpload(RcWeb.junkAfterBoundary());
        buffer = buffer.subarray(eol + 2);
        state = 'headers';
      } else if (state === 'headers') {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) {
          if (buffer.length > MAX_HEADER_BYTES) throw new MalformedUpload(RcWeb.partHeaderTooLong());
          return;
        }
        const headers = parseHeaders(buffer.subarray(0, end).toString('utf8'));
        buffer = buffer.subarray(end + 4);
        const disposition = parseDisposition(headers.get('content-disposition'));
        if (!disposition) throw new MalformedUpload(RcWeb.partNoDisposition());
        const isFile = disposition.filename !== null;
        if (isFile) {
          if (file || handle) throw new MalformedUpload(RcWeb.singleFileOnly());
          await fs.mkdir(path.dirname(options.filePath), { recursive: true });
          handle = await fs.open(options.filePath, 'wx', 0o600);
        } else if (++fieldCount > MAX_FIELDS) {
          throw new MalformedUpload(RcWeb.tooManyFields());
        }
        part = {
          field: disposition.name,
          filename: disposition.filename,
          contentType: headers.get('content-type') ?? null,
          chunks: [],
          size: 0,
          isFile,
        };
        state = 'body';
      } else if (state === 'body') {
        const at = buffer.indexOf(delimiter);
        if (at < 0) {
          // The tail may be the start of the next delimiter; keep it.
          const keep = delimiter.length - 1;
          if (buffer.length > keep) {
            await emit(buffer.subarray(0, buffer.length - keep));
            buffer = buffer.subarray(buffer.length - keep);
          }
          return;
        }
        await emit(buffer.subarray(0, at));
        await finishPart();
        buffer = buffer.subarray(at + delimiter.length);
        state = 'after-delimiter';
      } else {
        return;
      }
    }
  };

  try {
    await consume(request, async (chunk) => {
      total += chunk.length;
      if (total > options.maxBytes) throw new UploadTooLarge();
      if (state === 'done') return;
      buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
      await drain();
    });
    if ((state as string) !== 'done') throw new MalformedUpload(RcWeb.bodyTruncated());
    return { fields, file };
  } finally {
    await (handle as fs.FileHandle | null)?.close().catch(() => {});
  }
}

/**
 * Processes the body chunk by chunk (one chunk is processed before the next is read). On a processing error, it stops reading and discards the remaining data without destroying the connection: the caller still needs to answer
 * (e.g. 413, with `Connection: close`). Throws if the connection drops before the body is fully read.
 */
export function consume(request: IncomingMessage, onChunk: (chunk: Buffer) => Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let chain = Promise.resolve();
    let failed = false;
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      request.off('data', onData);
      request.resume();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      request.pause();
      chain = chain
        .then(() => onChunk(chunk))
        .then(() => {
          if (!failed) request.resume();
        }, fail);
    };
    request.on('data', onData);
    request.once('end', () => void chain.then(() => !failed && resolve(), fail));
    request.once('error', fail);
    request.once('close', () => {
      if (!request.complete) fail(new MalformedUpload(RcWeb.requestAborted()));
    });
  });
}

function parseHeaders(text: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of text.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) throw new MalformedUpload(RcWeb.partHeaderMalformed());
    headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return headers;
}

function parseDisposition(value: string | undefined): { name: string; filename: string | null } | null {
  if (!value || !/^form-data\s*(;|$)/i.test(value)) return null;
  const params = new Map<string, string>();
  for (const match of value.matchAll(/;\s*([A-Za-z*]+)=(?:"((?:[^"\\]|\\.)*)"|([^\s;]*))/g)) {
    params.set(match[1]!.toLowerCase(), match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : (match[3] ?? ''));
  }
  const name = params.get('name');
  if (!name) return null;
  return { name, filename: params.has('filename') ? params.get('filename')! : null };
}

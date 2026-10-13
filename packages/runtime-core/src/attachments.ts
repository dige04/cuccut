import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  ATTACHMENT_MIME_TYPES,
  ATTACHMENT_UPLOAD_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  RpcError,
  newId,
  type AttachmentMimeType,
  type AttachmentRef,
  type Id,
} from '@cuccut/protocol';
import { RcWeb } from '@cuccut/protocol/messages/runtime-core';
import type { HarnessAttachments, Logger } from '@cuccut/harness';

/**
 * Message attachments (product design §3.2.4, `attachments.prepare`): the UI first registers an image and gets a one-time upload address, then `PUT`s the raw bytes to `/attachments/<token>` on the same port as the gateway. At send time the Harness swaps the attachment ID for a local file and hands it to the Driver.
 *
 * - The token is 32 random bytes, usable once, and valid for about 10 minutes. The upload address is itself the credential; no other token header is carried.
 * - Files are stored as `<attachmentsDir>/<attachment ID>/image.<extension>`. The user's file name is not used: the file name is for display only.
 * - Bytes are written to `.part` as they arrive. If the byte count does not match, or exceeds the declared size, the upload is aborted and the half-written file is deleted. The file is renamed to its final name only once the upload completes.
 * - A registration that finished uploading but was never sent is cleared after about 24 hours. Sent ones follow the session and are deleted with it. Registrations live only in memory; after a Runtime restart, attachment directories not referenced by any session are cleared at startup.
 */

export interface AttachmentStoreOptions {
  dir: string;
  log: Logger;
  /** The same origin rules as the gateway, for CORS (the UI uploads from a web page using fetch). */
  originAllowed: (origin: string | undefined) => boolean;
  uploadTtlMs?: number;
  unsentTtlMs?: number;
  sweepMs?: number;
}

const UPLOAD_TTL_MS = 10 * 60_000;
const UNSENT_TTL_MS = 24 * 60 * 60_000;
const SWEEP_MS = 60_000;
const MAX_FILE_NAME = 255;
const PREFIX = '/attachments/';
const ATTACHMENT_ID = /^att_[0-9a-f]{32}$/;

const EXT_BY_MIME: Record<AttachmentMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

type EntryState = 'awaiting-upload' | 'uploading' | 'ready' | 'sent';

interface Entry {
  ref: AttachmentRef;
  dir: string;
  file: string;
  state: EntryState;
  /** Expiry of the upload address (if the upload is not yet finished), or of an unsent registration (after the upload). Sent attachments no longer expire. */
  expiresAt: number;
}

export class AttachmentStore implements HarnessAttachments {
  readonly #dir: string;
  readonly #log: Logger;
  readonly #originAllowed: (origin: string | undefined) => boolean;
  readonly #uploadTtlMs: number;
  readonly #unsentTtlMs: number;
  readonly #byId = new Map<Id, Entry>();
  readonly #byToken = new Map<string, Id>();
  readonly #timer: ReturnType<typeof setInterval>;
  #baseUrl = '';

  constructor(options: AttachmentStoreOptions) {
    this.#dir = options.dir;
    this.#log = options.log.child('attachments');
    this.#originAllowed = options.originAllowed;
    this.#uploadTtlMs = options.uploadTtlMs ?? UPLOAD_TTL_MS;
    this.#unsentTtlMs = options.unsentTtlMs ?? UNSENT_TTL_MS;
    this.#timer = setInterval(() => void this.sweep(), options.sweepMs ?? SWEEP_MS);
    this.#timer.unref?.();
  }

  kindOf(id:Id):AttachmentRef['kind']|undefined {return this.#byId.get(id)?.ref.kind;}

  setBaseUrl(url: string): void {
    this.#baseUrl = url;
  }

  /** Register an image: checks size, format and file name; returns the attachment and a one-time upload address. */
  async prepare(params: { fileName: string; mimeType: string; size: number }): Promise<{ attachment: AttachmentRef; uploadUrl: string }> {
    const fileName = checkFileName(params.fileName);
    if (!(ATTACHMENT_UPLOAD_MIME_TYPES as readonly string[]).includes(params.mimeType)) {
      throw new RpcError('invalid-request', RcWeb.imageTypeUnsupported({ mimeType: String(params.mimeType) }));
    }
    if (!Number.isSafeInteger(params.size) || params.size <= 0) throw new RpcError('invalid-request', RcWeb.imageSizeInvalid());
    if (params.size > MAX_ATTACHMENT_BYTES) {
      throw new RpcError('invalid-request', RcWeb.imageTooLarge({ mb: Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024) }));
    }
    const mimeType = params.mimeType;
    const id = newId('att');
    const dir = path.join(this.#dir, id);
    await fsp.mkdir(dir, { recursive: true });
    const ref: AttachmentRef = { id, kind: (ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType) ? 'image' : 'file', fileName, mimeType, size: params.size };
    const token = crypto.randomBytes(32).toString('base64url');
    this.#byId.set(id, { ref, dir, file: path.join(dir, attachmentFileName(ref)), state: 'awaiting-upload', expiresAt: Date.now() + this.#uploadTtlMs });
    this.#byToken.set(token, id);
    return { attachment: ref, uploadUrl: `${this.#baseUrl}${PREFIX}${token}` };
  }

  /** Handles `/attachments/<token>`. Returns false if it does not have this prefix. */
  handle(request: IncomingMessage, response: ServerResponse): boolean {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(PREFIX)) return false;
    const token = url.pathname.slice(PREFIX.length);
    const origin = request.headers.origin;
    if (origin !== undefined) {
      // Other web pages cannot upload here: a check on the origin sits on top of the token.
      if (!this.#originAllowed(origin)) {
        request.resume();
        response.writeHead(403, { Connection: 'close' }).end();
        return true;
      }
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'PUT', 'Access-Control-Allow-Headers': 'Content-Type' }).end();
      return true;
    }
    if (request.method !== 'PUT') {
      request.resume();
      response.writeHead(405, { Allow: 'PUT', Connection: 'close' }).end();
      return true;
    }
    void this.#receive(token, request, response).catch((error) => {
      this.#log.warn('Attachment upload failed', { error: (error as Error).name });
      if (!response.headersSent) response.writeHead(500).end();
      else response.destroy();
    });
    return true;
  }

  async #receive(token: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
    const refuse = (status: number, message: string) => {
      request.resume();
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' }).end(message);
    };
    const id = /^[A-Za-z0-9_-]{43}$/.test(token) ? this.#byToken.get(token) : undefined;
    const entry = id ? this.#byId.get(id) : undefined;
    if (!id || !entry) return refuse(404, RcWeb.uploadUrlNotFound().text);
    if (entry.state !== 'awaiting-upload') return refuse(409, RcWeb.uploadUrlUsed().text);
    if (entry.expiresAt <= Date.now()) {
      await this.#drop(id);
      return refuse(410, RcWeb.uploadUrlExpired().text);
    }
    const contentType = (request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (contentType !== entry.ref.mimeType) return refuse(415, RcWeb.contentTypeMustBe({ mimeType: entry.ref.mimeType }).text);
    const lengthHeader = request.headers['content-length'];
    if (lengthHeader === undefined) return refuse(411, RcWeb.contentLengthRequired().text);
    if (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) !== entry.ref.size) {
      return refuse(400, RcWeb.contentLengthMismatch({ size: entry.ref.size }).text);
    }

    // The token is invalidated from this point: a second upload to the same address is always rejected (409), and this failure also requires registering again.
    entry.state = 'uploading';
    entry.expiresAt = Date.now() + this.#uploadTtlMs;
    const part = `${entry.file}.part`;
    const failed = async (status: number, message: string) => {
      await fsp.rm(part, { force: true }).catch(() => {});
      await this.#drop(id);
      if (!response.headersSent && !response.destroyed && !response.socket?.destroyed) refuse(status, message);
    };

    let received = 0;
    let overflow = false;
    const limit = entry.ref.size;
    try {
      // Bytes are written as they arrive; exceeding the registered size aborts at once (the connection is dropped); the client disconnecting midway also aborts.
      await pipeline(
        request,
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            received += chunk.length;
            if (received > limit) {
              overflow = true;
              throw new Error('overflow');
            }
            yield chunk;
          }
        },
        fs.createWriteStream(part, { flags: 'wx' }),
      );
    } catch {
      return failed(overflow ? 413 : 400, (overflow ? RcWeb.uploadOverflow() : RcWeb.uploadInterrupted()).text);
    }
    if (received !== limit) return failed(400, RcWeb.uploadIncomplete({ received, size: limit }).text);
    await fsp.rename(part, entry.file);
    entry.state = 'ready';
    entry.expiresAt = Date.now() + this.#unsentTtlMs;
    response.writeHead(204).end();
  }

  /** At send time, the attachments must all be fully uploaded. An unknown one is `not-found`; one not yet fully uploaded is `invalid-request`. */
  async resolve(ids: Id[]): Promise<{ ref: AttachmentRef; path: string }[]> {
    const resolved: { ref: AttachmentRef; path: string }[] = [];
    for (const id of ids) {
      const entry = this.#byId.get(id);
      if (!entry) throw new RpcError('not-found', RcWeb.attachmentNotFoundOrExpired({ id }));
      if (entry.state !== 'ready' && entry.state !== 'sent') {
        throw new RpcError('invalid-request', RcWeb.attachmentNotUploaded({ fileName: entry.ref.fileName }), {
          attachmentId: id,
          state: entry.state,
        });
      }
      const stat = await fsp.stat(entry.file).catch(() => null);
      if (!stat?.isFile() || stat.size !== entry.ref.size) {
        await this.#drop(id);
        throw new RpcError('not-found', RcWeb.attachmentFileMissing({ fileName: entry.ref.fileName }));
      }
      resolved.push({ ref: entry.ref, path: entry.file });
    }
    return resolved;
  }

  /**
   * The location on disk of attachments already sent (the media channel reads from it): computed from the `AttachmentRef` in the session record, not looked up in memory,
   * since after a Runtime restart the registration is gone but the file stays with the session. The caller checks whether an attachment belongs to a given session; here only the shape of the attachment ID is checked.
   */
  fileOf(ref: AttachmentRef): { root: string; file: string } {
    if (!ATTACHMENT_ID.test(ref.id)) throw new RpcError('not-found', RcWeb.attachmentNotFound());
    if(ref.kind==='file') return {root:path.join(this.#dir,ref.id),file:attachmentFileName(ref)};
    const ext = EXT_BY_MIME[ref.mimeType as AttachmentMimeType];
    if (!ext) throw new RpcError('not-found', RcWeb.attachmentNotFound());
    return { root: path.join(this.#dir, ref.id), file: `image.${ext}` };
  }

  markSent(ids: Id[]): void {
    for (const id of ids) {
      const entry = this.#byId.get(id);
      if (entry && entry.state === 'ready') entry.state = 'sent';
    }
  }

  /** When a session is deleted, the attachments in its messages are deleted too (those still referenced by other sessions are excluded by the caller). */
  async discard(ids: Id[]): Promise<void> {
    // After a restart the registration is no longer in memory, so deletion goes by directory; the ID comes from the session record, and only the attachment ID shape is accepted.
    for (const id of ids) if (ATTACHMENT_ID.test(id)) await this.#drop(id, true);
  }

  /** At startup: delete attachment directories that no session references and that have no registration (left over from an upload never sent, or not fully cleaned up when its session was deleted). */
  async removeOrphans(keep: ReadonlySet<Id>): Promise<number> {
    const entries = await fsp.readdir(this.#dir, { withFileTypes: true }).catch(() => []);
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || keep.has(entry.name) || this.#byId.has(entry.name)) continue;
      if (!ATTACHMENT_ID.test(entry.name)) continue;
      await fsp.rm(path.join(this.#dir, entry.name), { recursive: true, force: true }).catch(() => {});
      removed++;
    }
    if (removed > 0) this.#log.info('Removed unreferenced attachments', { count: removed });
    return removed;
  }

  /** Expired registrations: upload addresses never used, uploads that got stuck, and uploads that finished but were never sent. */
  async sweep(): Promise<void> {
    const now = Date.now();
    for (const [id, entry] of [...this.#byId]) {
      if (entry.state !== 'sent' && entry.expiresAt <= now) await this.#drop(id);
    }
  }

  close(): void {
    clearInterval(this.#timer);
  }

  async #drop(id: Id, evenIfSent = false): Promise<void> {
    const entry = this.#byId.get(id);
    if (entry?.state === 'sent' && !evenIfSent) return;
    this.#byId.delete(id);
    for (const [token, owner] of this.#byToken) if (owner === id) this.#byToken.delete(token);
    await fsp.rm(path.join(this.#dir, id), { recursive: true, force: true }).catch(() => {});
  }
}

/** The file name is for display only: it must not contain path separators or control characters, and must not be `.` or `..`. */
function checkFileName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > MAX_FILE_NAME) throw new RpcError('invalid-request', RcWeb.fileNameLength({ max: MAX_FILE_NAME }));
  // eslint-disable-next-line no-control-regex
  if (/[\/\\\u0000-\u001f\u007f]/.test(name) || name === '.' || name === '..') {
    throw new RpcError('invalid-request', RcWeb.fileNameInvalid());
  }
  return name;
}

function attachmentFileName(ref:AttachmentRef):string {
  if(ref.kind==='image') return `image.${EXT_BY_MIME[ref.mimeType as AttachmentMimeType]}`;
  const ext=path.extname(ref.fileName).slice(1).toLowerCase();return `file.${/^[a-z0-9]{1,16}$/.test(ext)?ext:'bin'}`;
}

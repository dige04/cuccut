import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { MAX_ATTACHMENT_BYTES, RpcError } from '@cuccut/protocol';
import { AttachmentStore, type AttachmentStoreOptions } from './attachments.ts';

/** Attachment store: register → upload over local HTTP → swap for a file when sending; plus expiry, orphans, and the various rejections. */

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const ALLOWED = 'http://localhost:5173';

describe('attachment store', () => {
  let dir: string;
  let store: AttachmentStore;
  let server: http.Server;
  let base: string;

  async function open(options: Partial<AttachmentStoreOptions> = {}) {
    store?.close();
    store = new AttachmentStore({ dir, log: silentLogger, originAllowed: (origin) => origin === ALLOWED, ...options });
    store.setBaseUrl(base);
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-attachments-'));
    server = http.createServer((request, response) => {
      if (!store.handle(request, response)) response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await open();
  });

  afterEach(async () => {
    store.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  });

  const put = (url: string, body: Buffer, headers: Record<string, string> = {}) =>
    fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/png', ...headers }, body: new Uint8Array(body) });

  async function rejects(promise: Promise<unknown>): Promise<RpcError> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RpcError);
    return error as RpcError;
  }

  it('regular file keeps extension, type, and original bytes, and can be located after restart',async()=>{
    const bytes=Buffer.from('a,b\n1,2'),prepared=await store.prepare({fileName:'表格.csv',mimeType:'text/csv',size:bytes.length});
    expect(prepared.attachment.kind).toBe('file');expect(store.kindOf(prepared.attachment.id)).toBe('file');
    expect((await put(prepared.uploadUrl,bytes,{'Content-Type':'text/csv'})).status).toBe(204);
    const [resolved]=await store.resolve([prepared.attachment.id]);expect(await fs.readFile(resolved!.path)).toEqual(bytes);
    const persisted=store.fileOf(prepared.attachment);expect(persisted.file).toBe('file.csv');
    await open();expect(store.fileOf(prepared.attachment)).toEqual(persisted);
  });

  it('register, upload, send: file name only used for display, file stored in the attachment\'s own directory', async () => {
    const { attachment, uploadUrl } = await store.prepare({ fileName: '截图 1.png', mimeType: 'image/png', size: PNG.length });
    expect(attachment).toMatchObject({ kind: 'image', fileName: '截图 1.png', mimeType: 'image/png', size: PNG.length });
    expect(uploadUrl).toMatch(new RegExp(`^${base}/attachments/[A-Za-z0-9_-]{43}$`));

    // Not yet uploaded: sending waits until the upload finishes.
    expect((await rejects(store.resolve([attachment.id]))).code).toBe('invalid-request');

    const uploaded = await put(uploadUrl, PNG);
    expect(uploaded.status).toBe(204);
    const [resolved] = await store.resolve([attachment.id]);
    expect(resolved!.path).toBe(path.join(dir, attachment.id, 'image.png'));
    expect(await fs.readFile(resolved!.path)).toEqual(PNG);
    expect(await fs.readdir(path.join(dir, attachment.id))).toEqual(['image.png']);

    // The address can be used only once.
    expect((await put(uploadUrl, PNG)).status).toBe(409);
    // An unknown attachment.
    expect((await rejects(store.resolve(['att_00000000000000000000000000000000']))).code).toBe('not-found');
  });

  it('size, format, and file name checked at registration', async () => {
    expect((await rejects(store.prepare({ fileName: 'a.png', mimeType: 'image/png', size: MAX_ATTACHMENT_BYTES + 1 }))).message).toContain('太大');
    expect((await rejects(store.prepare({ fileName: 'a.png', mimeType: 'image/png', size: 0 }))).code).toBe('invalid-request');
    expect((await rejects(store.prepare({ fileName: 'a.png', mimeType: 'image/png', size: 1.5 }))).code).toBe('invalid-request');
    expect((await rejects(store.prepare({ fileName: 'a.svg', mimeType: 'image/svg+xml', size: 10 }))).message).toContain('格式');
    for (const fileName of ['../../etc/passwd', 'a\\b.png', '..', '.', '', 'a\u0000.png', 'x'.repeat(256)]) {
      expect((await rejects(store.prepare({ fileName, mimeType: 'image/png', size: 10 }))).code).toBe('invalid-request');
    }
    // No directory is left behind.
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('Content-Type, Content-Length and origin checked on upload; mismatches not written to disk', async () => {
    const prepare = () => store.prepare({ fileName: 'a.png', mimeType: 'image/png', size: PNG.length });

    const wrongType = await prepare();
    expect((await put(wrongType.uploadUrl, PNG, { 'Content-Type': 'image/jpeg' })).status).toBe(415);
    // Before the rejection the token is not invalidated: the same address can still be uploaded to with the correct format.
    expect((await put(wrongType.uploadUrl, PNG)).status).toBe(204);

    const tooLong = await prepare();
    expect((await put(tooLong.uploadUrl, Buffer.concat([PNG, PNG]))).status).toBe(400);

    const unknown = `${base}/attachments/${'A'.repeat(43)}`;
    expect((await put(unknown, PNG)).status).toBe(404);
    expect((await put(`${base}/attachments/../../etc`, PNG)).status).toBe(404);

    const foreign = await prepare();
    expect((await put(foreign.uploadUrl, PNG, { Origin: 'https://evil.example' })).status).toBe(403);
    const preflight = await fetch(foreign.uploadUrl, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'PUT' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('PUT');
    const fromUi = await put(foreign.uploadUrl, PNG, { Origin: ALLOWED });
    expect(fromUi.status).toBe(204);
    expect(fromUi.headers.get('access-control-allow-origin')).toBe(ALLOWED);
    expect((await fetch(foreign.uploadUrl)).status).toBe(405);

    // Only the two that finished uploading leave files behind.
    const files = (await fs.readdir(dir, { recursive: true })).filter((f) => f.endsWith('.png'));
    expect(files).toHaveLength(2);
    expect((await fs.readdir(dir, { recursive: true })).some((f) => f.endsWith('.part'))).toBe(false);
  });

  it('upload interrupted midway: half file deleted, this registration voided', async () => {
    const big = Buffer.alloc(256 * 1024, 7);
    const { attachment, uploadUrl } = await store.prepare({ fileName: 'big.png', mimeType: 'image/png', size: big.length });
    await new Promise<void>((resolve) => {
      const request = http.request(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png', 'Content-Length': String(big.length) },
      });
      request.on('error', () => resolve());
      request.write(big.subarray(0, 1024), () => setTimeout(() => request.destroy(), 50));
    });
    await expect
      .poll(async () => (await fs.readdir(dir)).length, { timeout: 3000 })
      .toBe(0);
    expect((await rejects(store.resolve([attachment.id]))).code).toBe('not-found');
  });

  it('expiry: upload URL valid about 10 minutes; uploaded but not sent cleared periodically, sent ones kept', async () => {
    await open({ uploadTtlMs: 30, unsentTtlMs: 30, sweepMs: 60_000 });
    const stale = await store.prepare({ fileName: 'a.png', mimeType: 'image/png', size: PNG.length });
    const unsent = await store.prepare({ fileName: 'b.png', mimeType: 'image/png', size: PNG.length });
    const sent = await store.prepare({ fileName: 'c.png', mimeType: 'image/png', size: PNG.length });
    expect((await put(unsent.uploadUrl, PNG)).status).toBe(204);
    expect((await put(sent.uploadUrl, PNG)).status).toBe(204);
    store.markSent([sent.attachment.id]);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect((await put(stale.uploadUrl, PNG)).status).toBe(410);
    await store.sweep();
    expect((await rejects(store.resolve([unsent.attachment.id]))).code).toBe('not-found');
    expect(await store.resolve([sent.attachment.id])).toHaveLength(1);
    expect(await fs.readdir(dir)).toEqual([sent.attachment.id]);

    // Removed together with the session when it is deleted.
    await store.discard([sent.attachment.id, '../escape']);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('on startup, attachment directories with no session reference are cleared; only IDs of attachment form recognized', async () => {
    const kept = 'att_11111111111111111111111111111111';
    const orphan = 'att_22222222222222222222222222222222';
    for (const name of [kept, orphan, 'notes']) await fs.mkdir(path.join(dir, name));
    expect(await store.removeOrphans(new Set([kept]))).toBe(1);
    expect((await fs.readdir(dir)).sort()).toEqual([kept, 'notes']);
  });
});

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { editorCsp, inlineScriptHashes, SlidesServer, type DeckRouteOptions } from './deck-routes.ts';
import { sha256 } from './deck-store.ts';
import type { DeckChangeEvent, FileListing, PublishResult, UploadResult } from './file-protocol.ts';

const roots: string[] = [];
async function tempDir(files: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'deck-routes-'));
  roots.push(root);
  for (const [p, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await writeFile(path.join(root, p), content);
  }
  return root;
}
afterAll(async () => {
  await Promise.all(roots.map(r => rm(r, { recursive: true, force: true })));
});

const INLINE = '(()=>{window.boot=1})();';
const INDEX = `<!doctype html><html><head><script>${INLINE}</script></head><body><div id="root"></div><script type="module" src="./assets/index-abc.js"></script></body></html>`;

describe('CSP 小工具', () => {
  it('inlineScriptHashes 只算内联脚本', () => {
    expect(inlineScriptHashes(INDEX)).toEqual([`sha256-${Buffer.from(sha256(INLINE), 'hex').toString('base64')}`]);
  });

  it('editorCsp 带上哈希；给了 frameAncestors 才限制嵌入', () => {
    const csp = editorCsp(['sha256-x']);
    expect(csp).toContain("script-src 'self' 'sha256-x'");
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(csp).not.toContain('frame-ancestors');
    expect(editorCsp([], "'self'")).toContain("frame-ancestors 'self'");
  });
});

describe('SlidesServer 路由', () => {
  let dist: string | null;
  let deckDir: string;
  let server: SlidesServer;
  let http1: http.Server;
  let base: string;
  let options: DeckRouteOptions;
  let grant: string;

  beforeAll(async () => {
    dist = await tempDir({ 'index.html': INDEX, 'assets/index-abc.js': 'console.log(1)', 'node/compiler.cjs': 'secret' });
  });

  beforeEach(async () => {
    deckDir = await tempDir({
      'deck.json': JSON.stringify({ v: 4, title: 'T', order: ['s01'] }),
      'slides/s01.html': '<section id="s01"></section>',
      'notes.md': '草稿',
    });
    options = { canEdit: true };
    server = new SlidesServer({ editorDist: () => dist });
    http1 = http.createServer((request, response) => {
      if (!server.handle(request, response, options)) response.writeHead(418).end();
    });
    await new Promise<void>(resolve => http1.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(http1.address() as AddressInfo).port}`;
    grant = await server.open(deckDir);
  });

  afterEach(async () => {
    server.close();
    http1.closeAllConnections();
    await new Promise(resolve => http1.close(resolve));
  });

  const at = (rest = '') => `${base}/slides/${grant}/${rest}`;
  const publish = (files: unknown, init: RequestInit = {}) =>
    fetch(at('__deck/publish'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }), ...init });

  it('同一个目录复用 grant；别的前缀不处理', async () => {
    expect(await server.open(deckDir)).toBe(grant);
    expect(grant).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await fetch(`${base}/media/x`)).status).toBe(418);
  });

  it('编辑器页面：缺 / 时重定向；带 CSP 与内联脚本哈希；静态资源可取，node/ 不给', async () => {
    const redirect = await fetch(`${base}/slides/${grant}?x=1`, { redirect: 'manual' });
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get('location')).toBe(`/slides/${grant}/?x=1`);

    const page = await fetch(at());
    expect(page.status).toBe(200);
    expect(await page.text()).toBe(INDEX);
    expect(page.headers.get('content-security-policy')).toContain(inlineScriptHashes(INDEX)[0]);

    const js = await fetch(at('assets/index-abc.js'));
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect(js.headers.get('cache-control')).toContain('immutable');
    for (const rest of ['node/compiler.cjs', '../index.html', '%2e%2e/x', '.hidden']) {
      expect((await fetch(at(rest))).status, rest).toBe(404);
    }
  });

  it('没构建编辑器时页面回 503；未知 grant 404', async () => {
    const saved = dist;
    dist = null;
    try {
      expect((await fetch(at())).status).toBe(503);
    } finally {
      dist = saved;
    }
    expect((await fetch(`${base}/slides/${'x'.repeat(32)}/`)).status).toBe(404);
  });

  it('清单与 deck 文件；清单外的读不到', async () => {
    const listing = (await (await fetch(at('_files.json'))).json()) as FileListing;
    expect(Object.keys(listing.files)).toEqual(['project/deck.json', 'project/slides/s01.html']);
    const slide = await fetch(at('project/slides/s01.html'));
    expect(await slide.text()).toBe('<section id="s01"></section>');
    expect(slide.headers.get('content-security-policy')).toContain('sandbox');
    expect((await fetch(at('project/notes.md'))).status).toBe(404);
  });

  it('发布写回磁盘；冲突 409；格式错 400；不是 JSON 415', async () => {
    const ok = await publish({ 'project/slides/s01.html': { base64: Buffer.from('<section>v2</section>').toString('base64'), contentType: 'text/html' } });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as PublishResult).shas).toEqual({ 'project/slides/s01.html': sha256('<section>v2</section>') });
    expect(await readFile(path.join(deckDir, 'slides/s01.html'), 'utf8')).toBe('<section>v2</section>');

    const stale = await publish({ 'project/slides/s01.html': { delete: true, ifMatch: sha256('old') } });
    expect(stale.status).toBe(409);
    expect((await publish({ 'project/x': 1 })).status).toBe(400);
    expect((await publish({ 'project/slides/s01.html': { delete: true, ifMatch: null } })).status).toBe(400);
    const createOnly = await publish({ 'project/slides/s02.html': { base64: Buffer.from('<section id="s02"></section>').toString('base64'), contentType: 'text/html', ifMatch: null } });
    expect(createOnly.status).toBe(200);
    expect(await readFile(path.join(deckDir, 'slides/s02.html'), 'utf8')).toBe('<section id="s02"></section>');
    expect((await fetch(at('__deck/publish'), { method: 'POST', body: '{}' })).status).toBe(415);
    expect((await fetch(at('__deck/publish'))).status).toBe(405);
  });

  it('只读与跨源的写请求被拒（not_writer），磁盘不动', async () => {
    const body = { 'project/slides/s01.html': null };
    const crossOrigin = await publish(body, { headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' } });
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({ code: 'not_writer' });
    expect((await publish(body, { headers: { 'Content-Type': 'application/json', Origin: base } })).status).toBe(200);

    options = { canEdit: false };
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: false });
    const readOnly = await fetch(at('__deck/assets'), { method: 'POST', body: 'x' });
    expect(readOnly.status).toBe(403);
    expect(await readOnly.json()).toMatchObject({ code: 'not_writer' });
  });

  it('上传素材后在 /slides/<grant>/_blob/<id> 与根级 /_blob/<id> 都能取到', async () => {
    const res = await fetch(at('__deck/assets'), { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array([1, 2, 3]) });
    const uploaded = (await res.json()) as UploadResult;
    expect(uploaded.url).toBe(`/_blob/${uploaded.id}`);
    for (const url of [`${base}${uploaded.url}`, at(`_blob/${uploaded.id}`)]) {
      const blob = await fetch(url);
      expect(blob.status, url).toBe(200);
      expect(blob.headers.get('content-type')).toBe('image/png');
      expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
    }
    expect((await fetch(`${base}/_blob/${'0'.repeat(32)}`)).status).toBe(404);
    expect((await fetch(at('__deck/assets'), { method: 'POST', body: '' })).status).toBe(400);
  });

  it('外部改动经 SSE 推给编辑器；编辑器自己的保存不推', async () => {
    const controller = new AbortController();
    const res = await fetch(at('__deck/events'), { signal: controller.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const events: DeckChangeEvent[] = [];
    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          text += decoder.decode(value, { stream: true });
          for (const frame of text.split('\n\n').slice(0, -1)) {
            const data = /^data: (.*)$/m.exec(frame)?.[1];
            if (data && /^event: external-change$/m.test(frame)) events.push(JSON.parse(data) as DeckChangeEvent);
          }
          text = text.slice(text.lastIndexOf('\n\n') + 2);
        }
      } catch {
        // 中止
      }
    })();
    try {
      await publish({ 'project/slides/s01.html': { base64: Buffer.from('mine').toString('base64'), contentType: 'text/html' } });
      await new Promise(resolve => setTimeout(resolve, 600));
      expect(events).toEqual([]);
      await writeFile(path.join(deckDir, 'slides/s01.html'), 'theirs');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      expect(events[0]!.paths).toEqual(['project/slides/s01.html']);
    } finally {
      controller.abort();
      await pump;
    }
  });

  it('符号链接的编辑器文件不给', async () => {
    const outside = await tempDir({ 'secret.txt': 'x' });
    await symlink(path.join(outside, 'secret.txt'), path.join(dist!, 'leak.txt'));
    expect((await fetch(at('leak.txt'))).status).toBe(404);
  });
});

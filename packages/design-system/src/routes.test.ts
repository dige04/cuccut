import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  designEditorCsp,
  designSystemEditorCsp,
  localUserName,
  SlidesServer,
  type DeckLayout,
  type DeckRouteOptions,
  type FileListing,
  type UploadResult,
} from '@cuccut/slides';
import { BLOBS_DIR, DESIGN_SYSTEM_LAYOUT } from './layout.ts';

const roots: string[] = [];
async function tempDir(files: Record<string, string | Buffer> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'design-system-routes-'));
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

const SLIDES_INDEX = '<!doctype html><html><head><script>window.slides=1</script></head><body></body></html>';
const DESIGN_INDEX = '<!doctype html><html><head><script>window.design=1</script></head><body></body></html>';
const SYSTEM_INDEX = '<!doctype html><html><head><script>window.designSystem=1</script></head><body></body></html>';
const RUN_HTML = '<!doctype html><html><head><script>window.run=1</script></head><body></body></html>';
const INDEX = JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-01-01T00:00:00.000Z' }, title: 'Acme', namespace: 'Acme' });
/** Layout of a design canvas (this package does not depend on @cuccut/design): the files in the root directory that are not under assets/. */
const CANVAS_LAYOUT: DeckLayout = {
  isFile: rel => !rel.startsWith('assets/') && rel !== 'assets',
  roots: [{ rel: '', descend: true }],
  descendInto: rel => rel !== 'assets',
  watches: () => true,
  readOnlyMessage: p => `${p}: read only`,
};
const CANVAS = JSON.stringify({ v: 3, title: 'Poster', boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 } }, order: ['Main.dc.html'] });

describe('SlidesServer 的 /design-system/ 路由（docs/design/canvas §10.4）', () => {
  let slidesDist: string;
  let designDist: string;
  let systemDist: string | null;
  let systemDir: string;
  let canvasDir: string;
  let deckDir: string;
  let userName: string | undefined;
  let server: SlidesServer;
  let http1: http.Server;
  let base: string;
  let options: DeckRouteOptions;
  let grant: string;

  beforeAll(async () => {
    slidesDist = await tempDir({ 'index.html': SLIDES_INDEX });
    designDist = await tempDir({ 'index.html': DESIGN_INDEX });
    systemDist = await tempDir({ 'index.html': SYSTEM_INDEX, 'artifact-type/run.html': RUN_HTML, 'assets/app-1.js': 'console.log(1)' });
  });

  beforeEach(async () => {
    systemDir = await tempDir({
      'design-system.json': INDEX,
      'README.md': '# Acme',
      'components/bundle.js': 'window.Acme={}',
      'components/lib/react.mjs': 'export {}',
      'components/bundle.css': 'a{}',
      'components/Button/preview.html': '<!-- @dsCard group="Buttons" height=120 -->',
      'fonts/Inter.woff2': 'wOF2',
      'assets/Logos/mark.svg': '<svg/>',
      [`${BLOBS_DIR}/0123456789abcdef0123456789abcdef.png`]: 'png',
    });
    canvasDir = await tempDir({ 'canvas.json': CANVAS, 'Main.dc.html': '<x-dc></x-dc>' });
    deckDir = await tempDir({ 'deck.json': JSON.stringify({ v: 4, title: 'T', order: [] }) });
    options = { canEdit: true };
    userName = 'tester';
    server = new SlidesServer({
      editorDist: () => slidesDist,
      design: { editorDist: () => designDist, layout: CANVAS_LAYOUT },
      designSystem: { editorDist: () => systemDist, layout: DESIGN_SYSTEM_LAYOUT, userName: () => userName },
    });
    http1 = http.createServer((request, response) => {
      if (!server.handle(request, response, options)) response.writeHead(418).end();
    });
    await new Promise<void>(resolve => http1.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(http1.address() as AddressInfo).port}`;
    grant = await server.open(systemDir, 'design-system');
  });

  afterEach(async () => {
    server.close();
    http1.closeAllConnections();
    await new Promise(resolve => http1.close(resolve));
  });

  const at = (rest = '') => `${base}/design-system/${grant}/${rest}`;
  const publish = (files: unknown) =>
    fetch(at('__deck/publish'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
  const upload = async (url: string, body: Buffer, type = 'image/png') =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body: new Uint8Array(body) });

  it('/design-system/<grant>/ 与 /design/<grant>/ 互不匹配：跨种类的 grant 一律 404；同一个目录按两种打开各有 grant', async () => {
    expect(await server.open(systemDir, 'design-system')).toBe(grant);
    const designGrant = await server.open(canvasDir, 'design');
    const slidesGrant = await server.open(deckDir);
    expect((await fetch(at())).status).toBe(200);
    for (const url of [
      `${base}/design/${grant}/`,
      `${base}/design/${grant}/_files.json`,
      `${base}/slides/${grant}/`,
      `${base}/design-system/${designGrant}/`,
      `${base}/design-system/${designGrant}/_files.json`,
      `${base}/design-system/${slidesGrant}/`,
      `${base}/design-system/not-a-grant/`,
    ]) {
      expect((await fetch(url)).status, url).toBe(404);
    }
    expect((await fetch(`${base}/design/${designGrant}/`)).status).toBe(200);
    const asDesign = await server.open(systemDir, 'design');
    expect(asDesign).not.toBe(grant);
    expect(server.storeOf(await realpath(systemDir), 'design-system')?.layout).toBe(DESIGN_SYSTEM_LAYOUT);
    expect(server.storeOf(await realpath(systemDir), 'design')?.layout).toBe(CANVAS_LAYOUT);
  });

  it('编辑器页面与 artifact-type/run.html 同源提供，都带设计系统的 CSP；缺 / 时带查询重定向', async () => {
    const redirect = await fetch(`${base}/design-system/${grant}?path=brand&lang=en`, { redirect: 'manual' });
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get('location')).toBe(`/design-system/${grant}/?path=brand&lang=en`);

    options = { canEdit: true, frameAncestors: 'http://127.0.0.1:1 http://localhost:1' };
    const page = await fetch(at());
    expect(await page.text()).toBe(SYSTEM_INDEX);
    const csp = page.headers.get('content-security-policy')!;
    expect(csp).toBe(designSystemEditorCsp('http://127.0.0.1:1 http://localhost:1'));
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:");
    expect(csp).not.toContain('sha256-');
    expect(csp).not.toMatch(/cdn|unpkg|jsdelivr/);
    expect(csp).toContain('frame-ancestors http://127.0.0.1:1 http://localhost:1');

    const run = await fetch(at('artifact-type/run.html'));
    expect(run.status).toBe(200);
    expect(run.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(run.headers.get('x-content-type-options')).toBe('nosniff');
    expect(run.headers.get('content-security-policy')).toBe(csp);
    expect(await run.text()).toBe(RUN_HTML);
    expect((await fetch(at('assets/app-1.js'))).headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect((await fetch(at('artifact-type/missing.html'))).status).toBe(404);
    // Not the same function as the design canvas editor's CSP, but likewise does not allow CDNs
    expect(designSystemEditorCsp()).toBe(designEditorCsp());
  });

  it('没构建设计系统编辑器时页面回 503，run.html 回 404', async () => {
    const saved = systemDist;
    systemDist = null;
    try {
      const page = await fetch(at());
      expect(page.status).toBe(503);
      expect(await page.text()).toBe('Design system editor is not built');
      expect((await fetch(at('artifact-type/run.html'))).status).toBe(404);
      expect(server.editorAvailable('design-system')).toBe(false);
      expect(server.editorAvailable('design')).toBe(true);
    } finally {
      systemDist = saved;
    }
  });

  it('清单不含 _blobs/；project/* 按扩展名给 Content-Type（.js 是 JavaScript），都带 nosniff 与数据 CSP', async () => {
    const listing = (await (await fetch(at('_files.json'))).json()) as FileListing;
    expect(Object.keys(listing.files)).toEqual([
      'project/README.md',
      'project/assets/Logos/mark.svg',
      'project/components/Button/preview.html',
      'project/components/bundle.css',
      'project/components/bundle.js',
      'project/components/lib/react.mjs',
      'project/design-system.json',
      'project/fonts/Inter.woff2',
    ]);
    const types: Record<string, string> = {
      'components/bundle.js': 'text/javascript',
      'components/lib/react.mjs': 'text/javascript',
      'components/bundle.css': 'text/css',
      'components/Button/preview.html': 'text/html',
      'fonts/Inter.woff2': 'font/woff2',
      'assets/Logos/mark.svg': 'image/svg+xml',
      'design-system.json': 'application/json',
      'README.md': 'text/markdown',
    };
    for (const [file, type] of Object.entries(types)) {
      const response = await fetch(at(`project/${file}`));
      expect(response.status, file).toBe(200);
      expect(response.headers.get('content-type'), file).toBe(type);
      expect(response.headers.get('x-content-type-options'), file).toBe('nosniff');
      expect(response.headers.get('content-security-policy'), file).toContain('sandbox');
    }
    expect((await fetch(at(`project/${BLOBS_DIR}/0123456789abcdef0123456789abcdef.png`))).status).toBe(404);
  });

  it('发布：assets/<组>/ 可写，project/_blobs/… 是 read_only_path', async () => {
    const write = (text: string) => ({ base64: Buffer.from(text).toString('base64'), contentType: 'image/svg+xml' });
    const ok = await publish({ 'project/assets/Icons/cup.svg': write('<svg>cup</svg>') });
    expect(ok.status).toBe(200);
    expect(await readFile(path.join(systemDir, 'assets/Icons/cup.svg'), 'utf8')).toBe('<svg>cup</svg>');
    const refused = await publish({ [`project/${BLOBS_DIR}/ffffffffffffffffffffffffffffffff.svg`]: write('x') });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { code: string }).code).toBe('read_only_path');
    expect(await readdir(path.join(systemDir, BLOBS_DIR))).not.toContain('ffffffffffffffffffffffffffffffff.svg');
  });

  it('上传写进 _blobs/；SVG 至多 2 MiB；/design-system/<grant>/_blob/<id> 取得到', async () => {
    const uploaded = (await (await upload(at('__deck/assets'), Buffer.from('system-png'))).json()) as UploadResult;
    expect(uploaded.url).toBe(`/_blob/${uploaded.id}`);
    expect(await readdir(path.join(systemDir, BLOBS_DIR))).toContain(`${uploaded.id}.png`);
    const blob = await fetch(at(`_blob/${uploaded.id}`));
    expect(blob.status).toBe(200);
    expect(blob.headers.get('content-type')).toBe('image/png');
    const svg = await upload(at('__deck/assets'), Buffer.alloc(2 * 1024 * 1024 + 1, 0x20), 'image/svg+xml');
    expect(svg.status).toBe(413);
    const smallSvg = await upload(at('__deck/assets'), Buffer.from('<svg/>'), 'image/svg+xml');
    expect(smallSvg.status).toBe(200);
  });

  it('根级 /_blob/<id> 按 blobScope 收窄：design-system 只找设计系统，isolated 找设计稿与设计系统，design 只找设计稿', async () => {
    const systemBlob = ((await (await upload(at('__deck/assets'), Buffer.from('system-png'))).json()) as UploadResult).id;
    const designGrant = await server.open(canvasDir, 'design');
    const designBlob = ((await (await upload(`${base}/design/${designGrant}/__deck/assets`, Buffer.from('design-png'))).json()) as UploadResult).id;
    const slidesGrant = await server.open(deckDir);
    const deckBlob = ((await (await upload(`${base}/slides/${slidesGrant}/__deck/assets`, Buffer.from('deck-png'))).json()) as UploadResult).id;
    const status = async (id: string) => (await fetch(`${base}/_blob/${id}`)).status;
    const expected: Record<NonNullable<DeckRouteOptions['blobScope']>, [number, number, number]> = {
      all: [200, 200, 200],
      'design-system': [200, 404, 404],
      design: [404, 200, 404],
      isolated: [200, 200, 404],
    };
    for (const [scope, [system, design, deck]] of Object.entries(expected)) {
      options = { canEdit: true, blobScope: scope as DeckRouteOptions['blobScope'] };
      expect([await status(systemBlob), await status(designBlob), await status(deckBlob)], scope).toEqual([system, design, deck]);
    }
    // Assets under a grant are looked up only in their own directory
    expect((await fetch(at(`_blob/${designBlob}`))).status).toBe(404);
  });

  it('session 另带本机用户名（user.name()）；取不到时不带；设计稿的 session 不带', async () => {
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: true, userName: 'tester' });
    userName = undefined;
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: true });
    userName = '';
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: true });
    options = { canEdit: false };
    userName = 'tester';
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: false, userName: 'tester' });
    const designGrant = await server.open(canvasDir, 'design');
    expect(await (await fetch(`${base}/design/${designGrant}/__deck/session`)).json()).toEqual({ canEdit: false });
  });

  it('没给 userName 时取本机用户名；没配置设计系统编辑器时不能打开，/design-system/ 一律 404', async () => {
    const plain = new SlidesServer({ editorDist: () => slidesDist, designSystem: { editorDist: () => systemDist, layout: DESIGN_SYSTEM_LAYOUT } });
    const plainGrant = await plain.open(systemDir, 'design-system');
    const plainHttp = http.createServer((request, response) => {
      if (!plain.handle(request, response, { canEdit: true })) response.writeHead(418).end();
    });
    await new Promise<void>(resolve => plainHttp.listen(0, '127.0.0.1', resolve));
    try {
      const plainBase = `http://127.0.0.1:${(plainHttp.address() as AddressInfo).port}`;
      const session = (await (await fetch(`${plainBase}/design-system/${plainGrant}/__deck/session`)).json()) as { userName?: string };
      expect(session.userName).toBe(localUserName());
    } finally {
      plain.close();
      plainHttp.closeAllConnections();
      await new Promise(resolve => plainHttp.close(resolve));
    }
    const bare = new SlidesServer({ editorDist: () => slidesDist });
    await expect(bare.open(systemDir, 'design-system')).rejects.toThrow('design system editor is not configured');
    expect(bare.editorAvailable('design-system')).toBe(false);
    bare.close();
  });
});

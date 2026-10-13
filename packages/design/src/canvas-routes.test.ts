import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeckStore, designEditorCsp, sha256, SlidesServer, watchExternalEdits, type DeckChangeEvent, type DeckRouteOptions, type FileListing, type UploadResult } from '@cuccut/slides';
import { CANVAS_LAYOUT, CANVAS_LIMITS } from './canvas-layout.ts';

const roots: string[] = [];
async function tempDir(files: Record<string, string | Buffer> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'canvas-routes-'));
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
const CANVAS = JSON.stringify({ v: 3, title: 'Poster', boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 } }, order: ['Main.dc.html'] });

describe('design file layout (DeckStore + CANVAS_LAYOUT)', () => {
  it('the listing includes only regular files in the whole directory tree, excluding assets/, hidden entries, symbolic links and invalid segment names', async () => {
    const dir = await tempDir({
      'canvas.json': CANVAS,
      'Main.dc.html': '<x-dc></x-dc>',
      'screens/Cart.dc.html': '<x-dc></x-dc>',
      'screens/deep/x.css': 'a{}',
      'ds/brand/tokens.json': '{}',
      'assets/0123456789abcdef0123456789abcdef.png': 'png',
      'assets/index.json': '{}',
      '.hidden/x.dc.html': 'x',
      'notes/.draft.md': 'x',
      'has space.html': 'x',
      '-dash.css': 'x',
    });
    await symlink(path.join(dir, 'Main.dc.html'), path.join(dir, 'Link.dc.html'));
    const store = new DeckStore(dir, CANVAS_LAYOUT);
    const listing = await store.listing();
    expect(Object.keys(listing.files)).toEqual([
      'project/Main.dc.html',
      'project/canvas.json',
      'project/ds/brand/tokens.json',
      'project/screens/Cart.dc.html',
      'project/screens/deep/x.css',
    ]);
    expect(await store.readProjectFile('project/screens/deep/x.css')).toEqual(Buffer.from('a{}'));
    expect(await store.readProjectFile('project/assets/index.json')).toBeNull();
    expect(await store.readProjectFile('project/Link.dc.html')).toBeNull();
  });

  it('lists only the first 512 files when there are more than 512, and records this only once', async () => {
    const files: Record<string, string> = { 'canvas.json': CANVAS };
    for (let i = 0; i < CANVAS_LIMITS.files + 5; i++) files[`parts/p${String(i).padStart(4, '0')}.css`] = String(i);
    const dir = await tempDir(files);
    const warnings: number[] = [];
    const store = new DeckStore(dir, CANVAS_LAYOUT, { onTruncated: limit => warnings.push(limit) });
    const first = await store.listing();
    await store.listing();
    expect(Object.keys(first.files)).toHaveLength(CANVAS_LIMITS.files);
    expect(first.files['project/canvas.json']).toBeDefined();
    expect(warnings).toEqual([CANVAS_LIMITS.files]);
  });

  it('publish: new files in subdirectories are writable; assets/, hidden paths and invalid segment names are read_only_path; at most 16 MB at a time', async () => {
    const dir = await tempDir({ 'canvas.json': CANVAS, 'Main.dc.html': 'v1' });
    const store = new DeckStore(dir, CANVAS_LAYOUT);
    const write = (text: string) => ({ base64: Buffer.from(text).toString('base64'), contentType: 'text/html' });
    const ok = await store.publish({ 'project/screens/Cart.dc.html': write('cart'), 'project/Main.dc.html': write('v2') });
    expect(ok.status).toBe(200);
    expect(await readFile(path.join(dir, 'screens/Cart.dc.html'), 'utf8')).toBe('cart');
    for (const p of ['project/assets/x.png', 'project/assets/index.json', 'project/.thumb.png', 'project/a/.b/c.css', 'project/has space.css', 'canvas.json']) {
      const outcome = await store.publish({ [p]: write('x') });
      expect(outcome.status, p).toBe(400);
      expect((outcome.body as { code?: string }).code, p).toBe('read_only_path');
    }
    const big = await store.publish({ 'project/big.json': { base64: Buffer.alloc(CANVAS_LIMITS.publishBytes + 1).toString('base64'), contentType: 'application/json' } });
    expect(big.status).toBe(413);
    expect((big.body as { code?: string }).code).toBe('too_large');
  });

  it('external-change watching covers newly created subdirectories', async () => {
    const dir = await tempDir({ 'canvas.json': CANVAS, 'Main.dc.html': 'v1' });
    const store = new DeckStore(dir, CANVAS_LAYOUT);
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await mkdir(path.join(dir, 'screens'));
      await new Promise(resolve => setTimeout(resolve, 500));
      await writeFile(path.join(dir, 'screens', 'Cart.dc.html'), 'cart');
      const deadline = Date.now() + 5000;
      while (!events.some(e => e.paths.includes('project/screens/Cart.dc.html')) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(events.flatMap(e => e.paths)).toContain('project/screens/Cart.dc.html');
      events.length = 0;
      await writeFile(path.join(dir, 'assets-note.txt'), 'x');
      await mkdir(path.join(dir, 'assets'), { recursive: true });
      await writeFile(path.join(dir, 'assets', 'index.json'), '{}');
      await new Promise(resolve => setTimeout(resolve, 800));
      expect(events.flatMap(e => e.paths)).not.toContain('project/assets/index.json');
    } finally {
      stop();
    }
  });
});

describe('SlidesServer /design/ route (docs/design/canvas §6.2)', () => {
  let slidesDist: string;
  let designDist: string | null;
  let canvasDir: string;
  let deckDir: string;
  let server: SlidesServer;
  let http1: http.Server;
  let base: string;
  let options: DeckRouteOptions;
  let grant: string;
  const warnings: string[] = [];

  beforeAll(async () => {
    slidesDist = await tempDir({ 'index.html': SLIDES_INDEX });
    designDist = await tempDir({ 'index.html': DESIGN_INDEX, 'assets/app-1.js': 'console.log(1)' });
  });

  beforeEach(async () => {
    canvasDir = await tempDir({ 'canvas.json': CANVAS, 'Main.dc.html': '<x-dc>v1</x-dc>', 'assets/index.json': '{}' });
    deckDir = await tempDir({ 'deck.json': JSON.stringify({ v: 4, title: 'T', order: [] }) });
    options = { canEdit: true };
    server = new SlidesServer({
      editorDist: () => slidesDist,
      design: { editorDist: () => designDist, layout: CANVAS_LAYOUT },
      onWarn: message => warnings.push(message),
    });
    http1 = http.createServer((request, response) => {
      if (!server.handle(request, response, options)) response.writeHead(418).end();
    });
    await new Promise<void>(resolve => http1.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(http1.address() as AddressInfo).port}`;
    grant = await server.open(canvasDir, 'design');
  });

  afterEach(async () => {
    server.close();
    http1.closeAllConnections();
    await new Promise(resolve => http1.close(resolve));
  });

  const at = (rest = '') => `${base}/design/${grant}/${rest}`;
  const publish = (files: unknown, init: RequestInit = {}) =>
    fetch(at('__deck/publish'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }), ...init });

  it('reuses the grant for the same directory and kind; a grant is valid only for its own kind; the same directory opened in two ways has a grant for each', async () => {
    expect(await server.open(canvasDir, 'design')).toBe(grant);
    const slidesGrant = await server.open(deckDir);
    expect((await fetch(`${base}/slides/${grant}/`)).status).toBe(404);
    expect((await fetch(`${base}/design/${slidesGrant}/`)).status).toBe(404);
    expect((await fetch(`${base}/slides/${slidesGrant}/`)).status).toBe(200);
    const asSlides = await server.open(canvasDir, 'slides');
    expect(asSlides).not.toBe(grant);
    expect(server.storeOf(await realpath(canvasDir), 'design')?.layout).toBe(CANVAS_LAYOUT);
    expect(server.storeOf(await realpath(canvasDir))?.layout).not.toBe(CANVAS_LAYOUT);
  });

  it('editor page: redirects to /design/ when / is missing; CSP allows inline scripts, eval and blob:, without hashes; frameAncestors is passed through as given', async () => {
    const redirect = await fetch(`${base}/design/${grant}?lang=en`, { redirect: 'manual' });
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get('location')).toBe(`/design/${grant}/?lang=en`);

    options = { canEdit: true, frameAncestors: 'http://127.0.0.1:1 http://localhost:1' };
    const page = await fetch(at());
    expect(await page.text()).toBe(DESIGN_INDEX);
    const csp = page.headers.get('content-security-policy')!;
    expect(csp).toBe(designEditorCsp('http://127.0.0.1:1 http://localhost:1'));
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:");
    expect(csp).not.toContain('sha256-');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain('frame-ancestors http://127.0.0.1:1 http://localhost:1');
    expect((await fetch(at('assets/app-1.js'))).status).toBe(200);

    const slidesGrant = await server.open(deckDir);
    const slidesCsp = (await fetch(`${base}/slides/${slidesGrant}/`)).headers.get('content-security-policy')!;
    expect(slidesCsp).toContain('sha256-');
    expect(slidesCsp).not.toContain('unsafe-eval');
  });

  it('returns 503 with a message naming the design editor when the design editor is not built', async () => {
    const saved = designDist;
    designDist = null;
    try {
      const page = await fetch(at());
      expect(page.status).toBe(503);
      expect(await page.text()).toBe('Design editor is not built');
      expect(server.editorAvailable('design')).toBe(false);
      expect(server.editorAvailable()).toBe(true);
    } finally {
      designDist = saved;
    }
  });

  it('listing, files, publishing and read_only_path', async () => {
    const listing = (await (await fetch(at('_files.json'))).json()) as FileListing;
    expect(Object.keys(listing.files)).toEqual(['project/Main.dc.html', 'project/canvas.json']);
    const file = await fetch(at('project/Main.dc.html'));
    expect(await file.text()).toBe('<x-dc>v1</x-dc>');
    expect(file.headers.get('content-security-policy')).toContain('sandbox');

    const write = (text: string) => ({ base64: Buffer.from(text).toString('base64'), contentType: 'text/html' });
    const ok = await publish({ 'project/Main.dc.html': { ...write('<x-dc>v2</x-dc>'), ifMatch: sha256('<x-dc>v1</x-dc>') } });
    expect(ok.status).toBe(200);
    expect(await readFile(path.join(canvasDir, 'Main.dc.html'), 'utf8')).toBe('<x-dc>v2</x-dc>');
    for (const p of ['project/assets/index.json', 'project/.cache/x.json']) {
      const refused = await publish({ [p]: write('x') });
      expect(refused.status, p).toBe(400);
      expect(((await refused.json()) as { code: string }).code).toBe('read_only_path');
    }
    expect(await readFile(path.join(canvasDir, 'assets/index.json'), 'utf8')).toBe('{}');
  });

  it('rejects read-only and cross-origin writes; session reports whether editing is allowed', async () => {
    options = { canEdit: false };
    expect(await (await fetch(at('__deck/session'))).json()).toEqual({ canEdit: false });
    const readOnly = await publish({ 'project/Main.dc.html': null });
    expect(readOnly.status).toBe(403);
    options = { canEdit: true };
    const cross = await publish({ 'project/Main.dc.html': null }, { headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:9' } });
    expect(cross.status).toBe(403);
    expect(await readFile(path.join(canvasDir, 'Main.dc.html'), 'utf8')).toBe('<x-dc>v1</x-dc>');
  });

  it('assets: uploads go into assets/; root-level /_blob/ searches all directories by default, and only design files when blobScope is design', async () => {
    const uploaded = (await (
      await fetch(at('__deck/assets'), { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('canvas-png') })
    ).json()) as UploadResult;
    expect(uploaded.url).toBe(`/_blob/${uploaded.id}`);
    expect((await fetch(`${base}/_blob/${uploaded.id}`)).status).toBe(200);
    expect((await fetch(at(`_blob/${uploaded.id}`))).status).toBe(200);

    const slidesGrant = await server.open(deckDir);
    const deckBlob = (await (
      await fetch(`${base}/slides/${slidesGrant}/__deck/assets`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.from('deck-png') })
    ).json()) as UploadResult;
    expect((await fetch(`${base}/_blob/${deckBlob.id}`)).status).toBe(200);

    options = { canEdit: true, blobScope: 'design' };
    expect((await fetch(`${base}/_blob/${deckBlob.id}`)).status).toBe(404);
    expect((await fetch(`${base}/_blob/${uploaded.id}`)).status).toBe(200);
    // Assets under a grant are looked up only in their own directory
    expect((await fetch(at(`_blob/${deckBlob.id}`))).status).toBe(404);
  });

  it('cannot open designs when no design editor is configured; /design/ always returns 404', async () => {
    const bare = new SlidesServer({ editorDist: () => slidesDist });
    await expect(bare.open(canvasDir, 'design')).rejects.toThrow();
    expect(bare.editorAvailable('design')).toBe(false);
  });
});

import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { DeckStore, watchExternalEdits, type DeckChangeEvent } from '@cuccut/slides';
import {
  BLOBS_DIR,
  DESIGN_SYSTEM_LAYOUT,
  DESIGN_SYSTEM_LIMITS,
  designSystemUploadLimit,
  explainDesignSystemPath,
  inspectDesignSystem,
  isDesignSystemFile,
  readDesignSystemInfo,
} from './layout.ts';

const roots: string[] = [];
async function tempDir(files: Record<string, string | Buffer> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'design-system-layout-'));
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

const INDEX = JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-01-01T00:00:00.000Z' }, title: 'Acme', namespace: 'Acme' });
const ID = '0123456789abcdef0123456789abcdef';

describe('模块本身', () => {
  it('能导入；源码里没有字面的行分隔符与不可见字符（写在正则里会让模块解析失败）', async () => {
    const layout = await import('./layout.ts');
    expect(layout.DESIGN_SYSTEM_LAYOUT.blobDir).toBe('_blobs');
    expect(Object.keys(await import('./index.ts'))).toEqual(expect.arrayContaining(['DESIGN_SYSTEM_LAYOUT', 'readDesignSystemInfo', 'checkDesignSystem', 'resolveDesignSystemEditorDist']));
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const name of (await readdir(dir)).filter(n => n.endsWith('.ts'))) {
      const source = await readFile(path.join(dir, name), 'utf8');
      expect(/[\u2028\u2029\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(source), name).toBe(false);
    }
  });
});

describe('路径规则（explainDesignSystemPath，照原版 isValidDesignSystemPath）', () => {
  it('合规则的路径', () => {
    for (const p of ['README.md', 'tokens.json', 'components/Button/preview.html', 'components/lib/react.js', 'assets/Logos/mark.svg', 'fonts/Inter.woff2', 'guide/colors.md', '_notes.md', 'archived/old.md', '中文/说明.md']) {
      expect(explainDesignSystemPath(p), p).toBeNull();
    }
  });

  it('不合规则的路径各有原因', () => {
    for (const p of [
      'a\u2028b.md',
      'a\u2029b.md',
      'a\u200bb.md',
      'a\u202eb.md',
      'a\u2215b.md',
      'a\uff0fb.md',
      'tab\there.md',
      'x:y.md',
      '50%.md',
      'a;b.md',
      'a\\b.md',
      '/abs.md',
      'a//b.md',
      'a/./b.md',
      'a/../b.md',
      '__proto__/x.md',
      'x.cmekshadow',
      '.hidden/x.md',
      'components/.cache/x.js',
      'node_modules/x.js',
      'package.json',
      'components/tsconfig.json',
      'AGENTS.md',
      'CLAUDE.md',
      'PROGRA~1/x.md',
      'index.html',
      'INDEX.HTML',
      'SKILL.md',
      'artifact-type/run.html',
      'Design-System.JSON',
      'design-system.json/x',
      'a'.repeat(301),
    ]) {
      expect(explainDesignSystemPath(p), JSON.stringify(p)).toEqual(expect.any(String));
    }
  });

  it('isDesignSystemFile：索引本身是文件；_blobs/ 下的不是', () => {
    expect(isDesignSystemFile('design-system.json')).toBe(true);
    expect(isDesignSystemFile('README.md')).toBe(true);
    expect(isDesignSystemFile('assets/Icons/a.svg')).toBe(true);
    expect(isDesignSystemFile(BLOBS_DIR)).toBe(false);
    expect(isDesignSystemFile(`${BLOBS_DIR}/${ID}.png`)).toBe(false);
    expect(isDesignSystemFile('index.html')).toBe(false);
  });

  it('上传上限：SVG 2 MiB，其余 20 MiB', () => {
    expect(designSystemUploadLimit('image/svg+xml')).toBe(2 * 1024 * 1024);
    expect(designSystemUploadLimit('Image/SVG+XML; charset=utf-8')).toBe(DESIGN_SYSTEM_LIMITS.svgUploadBytes);
    expect(designSystemUploadLimit('image/png')).toBe(20 * 1024 * 1024);
    expect(DESIGN_SYSTEM_LAYOUT.maxBlobBytes?.('font/woff2')).toBe(DESIGN_SYSTEM_LIMITS.uploadBytes);
  });
});

describe('识别（readDesignSystemInfo / inspectDesignSystem）', () => {
  it('v 为 3、layout 为 "files" 的索引是设计系统；标题去掉空白，没有时用目录名；namespace 不合规则时 null', async () => {
    expect(await readDesignSystemInfo(await tempDir({ 'design-system.json': INDEX }))).toEqual({ title: 'Acme', namespace: 'Acme' });
    const untitled = await tempDir({ 'design-system.json': JSON.stringify({ v: 3, layout: 'files', title: '  ', namespace: '1bad' }) });
    expect(await readDesignSystemInfo(untitled)).toEqual({ title: path.basename(untitled), namespace: null });
    expect(await readDesignSystemInfo(await tempDir({ 'design-system.json': JSON.stringify({ v: 3, layout: 'files', title: ' Brand ' }) }))).toEqual({
      title: 'Brand',
      namespace: null,
    });
  });

  it('认法同原版 isFilesIndex：带迁移标记，或 v ≥ 3 且 layout 为 files；content 是对象的不算', async () => {
    for (const index of [{ createdOnFiles: { v: 1 } }, { convertedFrom: {}, v: 2 }, { v: 4, layout: 'files' }]) {
      expect(await readDesignSystemInfo(await tempDir({ 'design-system.json': JSON.stringify(index) })), JSON.stringify(index)).not.toBeNull();
    }
    expect(await readDesignSystemInfo(await tempDir({ 'design-system.json': JSON.stringify({ v: 3, layout: 'files', content: {} }) }))).toBeNull();
  });

  it('其余都不是：没有索引、旧版本、没有 layout、不是 JSON、数组、索引是符号链接或目录', async () => {
    for (const files of [
      {},
      { 'design-system.json': JSON.stringify({ v: 2, layout: 'files' }) },
      { 'design-system.json': JSON.stringify({ v: 3 }) },
      { 'design-system.json': JSON.stringify({ v: 3, layout: 'inline' }) },
      { 'design-system.json': JSON.stringify({ v: '3', layout: 'files' }) },
      { 'design-system.json': '{ not json' },
      { 'design-system.json': '[]' },
      { 'design-system.json/x': 'x' },
    ]) {
      expect(await readDesignSystemInfo(await tempDir(files as Record<string, string>)), JSON.stringify(files)).toBeNull();
    }
    const linked = await tempDir({ 'real.json': INDEX });
    await symlink(path.join(linked, 'real.json'), path.join(linked, 'design-system.json'));
    expect(await readDesignSystemInfo(linked)).toBeNull();
    expect(await inspectDesignSystem(linked)).toBeNull();
  });

  it('inspectDesignSystem：大小算目录与第一层子目录里的普通文件（含 _blobs/），不算隐藏文件', async () => {
    const dir = await tempDir({
      'design-system.json': INDEX,
      'README.md': '12345',
      '.DS_Store': 'xxxxxxxxxx',
      [`${BLOBS_DIR}/${ID}.png`]: '123',
      'assets/Logos/deep.svg': 'not counted',
    });
    const stat = await inspectDesignSystem(dir);
    expect(stat).toMatchObject({ title: 'Acme', namespace: 'Acme', size: INDEX.length + 5 + 3 });
    expect(stat!.mtimeMs).toBeGreaterThan(0);
    expect(await inspectDesignSystem(await tempDir({ 'README.md': 'x' }))).toBeNull();
  });
});

describe('设计系统的文件布局（DeckStore + DESIGN_SYSTEM_LAYOUT）', () => {
  it('清单是整棵目录树里合路径规则的普通文件，不含 _blobs/、隐藏的、符号链接与工具配置', async () => {
    const dir = await tempDir({
      'design-system.json': INDEX,
      'README.md': '# Acme',
      'tokens.json': '{}',
      'components/Button/preview.html': '<!-- @dsCard group="Buttons" height=120 -->',
      'components/bundle.js': 'window.Acme={}',
      'assets/Logos/mark.svg': '<svg/>',
      'fonts/Inter.woff2': 'wOF2',
      [`${BLOBS_DIR}/${ID}.png`]: 'png',
      [`${BLOBS_DIR}/index.json`]: '{}',
      '.git/HEAD': 'x',
      'components/.cache/x.js': 'x',
      'package.json': '{}',
      'index.html': 'x',
      'a:b.md': 'x',
    });
    await symlink(path.join(dir, 'README.md'), path.join(dir, 'Link.md'));
    const store = new DeckStore(dir, DESIGN_SYSTEM_LAYOUT);
    expect(store.blobDir).toBe(BLOBS_DIR);
    const listing = await store.listing();
    expect(Object.keys(listing.files)).toEqual([
      'project/README.md',
      'project/assets/Logos/mark.svg',
      'project/components/Button/preview.html',
      'project/components/bundle.js',
      'project/design-system.json',
      'project/fonts/Inter.woff2',
      'project/tokens.json',
    ]);
    expect(listing.files['project/components/bundle.js']?.contentType).toBe('text/javascript');
    expect(await store.readProjectFile('project/assets/Logos/mark.svg')).toEqual(Buffer.from('<svg/>'));
    expect(await store.readProjectFile(`project/${BLOBS_DIR}/${ID}.png`)).toBeNull();
    expect(await store.readProjectFile('project/Link.md')).toBeNull();
  });

  it('发布：assets/<组>/ 与索引可写；_blobs/、保留名、隐藏路径与工具配置是 read_only_path；单个文件 ≤15 MiB，一次 ≤16 MiB', async () => {
    const dir = await tempDir({ 'design-system.json': INDEX });
    const store = new DeckStore(dir, DESIGN_SYSTEM_LAYOUT);
    const write = (text: string | Buffer, contentType = 'image/svg+xml') => ({ base64: Buffer.from(text).toString('base64'), contentType });
    const ok = await store.publish({
      'project/assets/Logos/new.svg': write('<svg/>'),
      'project/assets/My Icons/a.svg': write('<svg/>'),
      'project/design-system.json': write(INDEX, 'application/json'),
    });
    expect(ok.status).toBe(200);
    expect(await readFile(path.join(dir, 'assets/Logos/new.svg'), 'utf8')).toBe('<svg/>');
    expect(await readFile(path.join(dir, 'assets/My Icons/a.svg'), 'utf8')).toBe('<svg/>');
    const blobRefused = await store.publish({ [`project/${BLOBS_DIR}/${ID}.png`]: write('x') });
    expect(blobRefused.status).toBe(400);
    expect(blobRefused.body).toMatchObject({ code: 'read_only_path', message: expect.stringContaining(`${BLOBS_DIR}/`) });
    for (const p of ['project/index.html', 'project/SKILL.md', 'project/artifact-type/run.html', 'project/.thumb.png', 'project/package.json', 'project/x:y.md', 'design-system.json']) {
      const outcome = await store.publish({ [p]: write('x') });
      expect(outcome.status, p).toBe(400);
      expect((outcome.body as { code?: string }).code, p).toBe('read_only_path');
    }
    const tooBig = await store.publish({ 'project/assets/Big/a.png': write(Buffer.alloc(DESIGN_SYSTEM_LIMITS.fileBytes + 1), 'image/png') });
    expect(tooBig.status).toBe(413);
    expect((tooBig.body as { code?: string }).code).toBe('too_large');
    const nine = Buffer.alloc(9 * 1024 * 1024);
    const batch = await store.publish({ 'project/assets/Big/a.png': write(nine, 'image/png'), 'project/assets/Big/b.png': write(nine, 'image/png') });
    expect(batch.status).toBe(413);
  });

  it('上传写进 _blobs/（不进 assets/），不进清单', async () => {
    const dir = await tempDir({ 'design-system.json': INDEX });
    const store = new DeckStore(dir, DESIGN_SYSTEM_LAYOUT);
    const uploaded = await store.putBlob(Buffer.from('png-bytes'), 'image/png');
    expect(uploaded.url).toBe(`/_blob/${uploaded.id}`);
    expect(await readdir(path.join(dir, BLOBS_DIR))).toEqual(expect.arrayContaining([`${uploaded.id}.png`, 'index.json']));
    expect(await readdir(dir)).not.toContain('assets');
    expect((await store.getBlob(uploaded.id))?.contentType).toBe('image/png');
    expect(Object.keys((await store.listing()).files)).toEqual(['project/design-system.json']);
  });

  it('外部改动的监听覆盖 assets/<组>/，不报 _blobs/', async () => {
    const dir = await tempDir({ 'design-system.json': INDEX, 'README.md': 'v1' });
    const store = new DeckStore(dir, DESIGN_SYSTEM_LAYOUT);
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await mkdir(path.join(dir, BLOBS_DIR));
      await mkdir(path.join(dir, 'assets', 'Logos'), { recursive: true });
      await new Promise(resolve => setTimeout(resolve, 500));
      await writeFile(path.join(dir, BLOBS_DIR, `${ID}.png`), 'png');
      await writeFile(path.join(dir, 'assets', 'Logos', 'mark.svg'), '<svg/>');
      const deadline = Date.now() + 5000;
      while (!events.some(e => e.paths.includes('project/assets/Logos/mark.svg')) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      const paths = events.flatMap(e => e.paths);
      expect(paths).toContain('project/assets/Logos/mark.svg');
      expect(paths.some(p => p.includes(BLOBS_DIR))).toBe(false);
    } finally {
      stop();
    }
  });
});

import { EventEmitter } from 'node:events';
import * as fsSync from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assetExtensionOf, contentTypeOf, deckFileOf, DeckStore, isDeckFile, isIgnoredWatchPath, sha256, versionOf, watchExternalEdits } from './deck-store.ts';
import { isProjectPath, type ConflictError, type DeckChangeEvent, type GenericPublishError, type WireEntry } from './file-protocol.ts';

vi.mock('node:fs', async importOriginal => ({ ...await importOriginal<typeof import('node:fs')>() }));

const b64 = (s: string) => Buffer.from(s).toString('base64');
const write = (content: string, ifMatch?: string): WireEntry => ({ base64: b64(content), contentType: 'text/html', ...(ifMatch ? { ifMatch } : {}) });

const roots: string[] = [];
async function tempDeck(files: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'deck-store-'));
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

describe('路径和小工具', () => {
  it('isProjectPath 只放行 project/ 下的普通相对路径', () => {
    expect(isProjectPath('project/slides/s01.html')).toBe(true);
    for (const bad of ['deck.json', 'project/../x', 'project//x', 'project/./x', 'project/a\\b', 'project/', '_blob/abc', '/project/x']) {
      expect(isProjectPath(bad), bad).toBe(false);
    }
  });

  it('deckFileOf 只认 deck.json、slides/<名>.html 与 ds/**', () => {
    expect(deckFileOf('project/deck.json')).toBe('deck.json');
    expect(deckFileOf('project/slides/s01.html')).toBe('slides/s01.html');
    expect(deckFileOf('project/ds/brand/tokens.css')).toBe('ds/brand/tokens.css');
    for (const bad of ['project/slides/a/b.html', 'project/slides/s01.txt', 'project/assets/index.json', 'project/notes.md', 'project/.deck.json', 'deck.json', 'project/ds']) {
      expect(deckFileOf(bad), bad).toBe(null);
    }
    expect(isDeckFile('slides/.s01.html.tmp')).toBe(false);
  });

  it('isIgnoredWatchPath 跳过任何一段以 . 开头的路径', () => {
    expect(isIgnoredWatchPath('slides/.!40826!plan.html')).toBe(true);
    expect(isIgnoredWatchPath('.git/index')).toBe(true);
    expect(isIgnoredWatchPath('slides/s01.html')).toBe(false);
  });

  it('contentTypeOf 按扩展名，未知的用 octet-stream；素材扩展名按类型取', () => {
    expect(contentTypeOf('project/deck.json')).toBe('application/json');
    expect(contentTypeOf('a.HTML')).toBe('text/html');
    expect(contentTypeOf('noext')).toBe('application/octet-stream');
    expect(assetExtensionOf('image/png')).toBe('png');
    expect(assetExtensionOf('image/svg+xml; charset=utf-8')).toBe('svg');
    expect(assetExtensionOf('application/x-unknown')).toBe('bin');
  });

  it('versionOf 只由内容决定', () => {
    const a = { 'project/a': { sha256: '1', size: 1, contentType: 'x' } };
    expect(versionOf(a)).toBe(versionOf({ ...a }));
    expect(versionOf(a)).not.toBe(versionOf({ 'project/a': { sha256: '2', size: 1, contentType: 'x' } }));
    expect(versionOf({})).toMatch(/^local-[0-9a-f]{16}$/);
  });
});

describe('DeckStore', () => {
  let root: string;
  let store: DeckStore;

  beforeEach(async () => {
    root = await tempDeck({
      'deck.json': '{}',
      'slides/s01.html': '<section></section>',
      'slides/.hidden.html': 'x',
      'notes.md': '智能体的草稿，编辑器看不到',
      'assets/index.json': '{}',
    });
    store = new DeckStore(root);
  });

  it('listing 只列 deck.json、slides/*.html、ds/**，键带 project/ 前缀，带 sha 和类型', async () => {
    await mkdir(path.join(root, 'ds/brand'), { recursive: true });
    await writeFile(path.join(root, 'ds/brand/tokens.css'), ':root{}');
    const listing = await store.listing();
    expect(Object.keys(listing.files)).toEqual(['project/deck.json', 'project/ds/brand/tokens.css', 'project/slides/s01.html']);
    expect(listing.files['project/deck.json']).toEqual({ sha256: sha256('{}'), size: 2, contentType: 'application/json' });
    expect(listing.ver).toBe(versionOf(listing.files));
  });

  it('readProjectFile 去掉 project/ 前缀读磁盘；清单外的文件读不到', async () => {
    expect(Buffer.from((await store.readProjectFile('project/deck.json'))!).toString()).toBe('{}');
    expect(await store.readProjectFile('project/notes.md')).toBe(null);
    expect(await store.readProjectFile('project/assets/index.json')).toBe(null);
  });

  it('publish 原子地写回 deck 目录、返回 sha 和新版本，并记进 ownWrites；不留临时文件', async () => {
    const before = await store.listing();
    const outcome = await store.publish({ 'project/slides/s02.html': write('<section id="s02"></section>') });
    expect(outcome.status).toBe(200);
    if (outcome.status !== 200) return;
    const sha = sha256('<section id="s02"></section>');
    expect(outcome.body.shas).toEqual({ 'project/slides/s02.html': sha });
    expect(outcome.body.seq).toBe(1);
    expect(outcome.body.version).not.toBe(before.ver);
    expect(await readFile(path.join(root, 'slides/s02.html'), 'utf8')).toBe('<section id="s02"></section>');
    expect(store.ownWrites.get('project/slides/s02.html')).toBe(sha);
    expect((await readdir(path.join(root, 'slides'))).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });

  it('ifMatch 对得上才写；对不上整批拒绝（409），一个文件都不动', async () => {
    const current = sha256('<section></section>');
    const ok = await store.publish({ 'project/slides/s01.html': write('<section>v2</section>', current) });
    expect(ok.status).toBe(200);

    const stale = await store.publish({
      'project/slides/s01.html': write('<section>v3</section>', current),
      'project/slides/new.html': write('<section>new</section>'),
    });
    expect(stale.status).toBe(409);
    const body = stale.body as ConflictError;
    expect(body.code).toBe('conflict');
    expect(body.live).toBe((await store.listing()).ver);
    expect(body.paths).toEqual([{ path: 'project/slides/s01.html', actual: sha256('<section>v2</section>'), expected: current }]);
    expect(await readFile(path.join(root, 'slides/s01.html'), 'utf8')).toBe('<section>v2</section>');
    expect(await store.readProjectFile('project/slides/new.html')).toBe(null);
  });

  it('ifMatch 指向不存在的文件时 actual 为 null', async () => {
    const outcome = await store.publish({ 'project/slides/x.html': write('x', sha256('whatever')) });
    expect(outcome.status).toBe(409);
    expect((outcome.body as ConflictError).paths[0]!.actual).toBe(null);
  });

  it('ifMatch 为 null 只建新文件：不存在时写入，已存在时 409（expected 为 null）', async () => {
    const created = await store.publish({ 'project/slides/new.html': { base64: b64('<section>new</section>'), contentType: 'text/html', ifMatch: null } });
    expect(created.status).toBe(200);
    expect(await readFile(path.join(root, 'slides/new.html'), 'utf8')).toBe('<section>new</section>');

    const again = await store.publish({ 'project/slides/new.html': { base64: b64('<section>again</section>'), contentType: 'text/html', ifMatch: null } });
    expect(again.status).toBe(409);
    expect((again.body as ConflictError).paths).toEqual([{ path: 'project/slides/new.html', actual: sha256('<section>new</section>'), expected: null }]);
    expect(await readFile(path.join(root, 'slides/new.html'), 'utf8')).toBe('<section>new</section>');
  });

  it('删除：{delete:true} 和 null 都删，ownWrites 记为空串', async () => {
    const outcome = await store.publish({
      'project/slides/s01.html': { delete: true, ifMatch: sha256('<section></section>') },
      'project/deck.json': null,
    });
    expect(outcome.status).toBe(200);
    expect(Object.keys((await store.listing()).files)).toEqual([]);
    expect(store.ownWrites.get('project/slides/s01.html')).toBe('');
  });

  it('清单外的路径一律拒绝（400 read_only_path），磁盘上不动', async () => {
    for (const p of ['deck.json', 'project/../escape.html', '_blob/x', 'project/notes.md', 'project/assets/index.json', 'project/slides/a/b.html']) {
      const outcome = await store.publish({ [p]: write('x') });
      expect(outcome.status, p).toBe(400);
      expect((outcome.body as GenericPublishError).code).toBe('read_only_path');
    }
    expect(await readFile(path.join(root, 'notes.md'), 'utf8')).toBe('智能体的草稿，编辑器看不到');
  });

  it('符号链接（可能指到 deck 外）不进清单、读不到、不能写', async () => {
    const outside = await tempDeck({ 'secret.html': '<section>secret</section>', 'dir/x.css': 'x' });
    await symlink(path.join(outside, 'secret.html'), path.join(root, 'slides/leak.html'));
    await symlink(path.join(outside, 'dir'), path.join(root, 'ds'));
    expect(Object.keys((await store.listing()).files)).toEqual(['project/deck.json', 'project/slides/s01.html']);
    expect(await store.readProjectFile('project/slides/leak.html')).toBe(null);
    expect(await store.readProjectFile('project/ds/x.css')).toBe(null);
    for (const p of ['project/slides/leak.html', 'project/ds/x.css', 'project/ds/new/y.css']) {
      const outcome = await store.publish({ [p]: write('pwned') });
      expect(outcome.status, p).toBe(400);
    }
    expect(await readFile(path.join(outside, 'secret.html'), 'utf8')).toBe('<section>secret</section>');
    expect(await readdir(path.join(outside, 'dir'))).toEqual(['x.css']);
  });

  it('并发发布按顺序执行：同一个 ifMatch 只有第一次成功', async () => {
    const current = sha256('<section></section>');
    const [a, b] = await Promise.all([
      store.publish({ 'project/slides/s01.html': write('A', current) }),
      store.publish({ 'project/slides/s01.html': write('B', current) }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(409);
    expect(await readFile(path.join(root, 'slides/s01.html'), 'utf8')).toBe('A');
  });

  it('putBlob 按内容寻址写进 assets/<id>.<ext>，记录 Content-Type；getBlob 拒绝非法 id', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await store.putBlob(bytes, 'image/png');
    expect(result.id).toBe(sha256(bytes).slice(0, 32));
    expect(result.url).toBe(`/_blob/${result.id}`);
    expect(result.sizeBytes).toBe(3);
    expect(await readdir(path.join(root, 'assets'))).toEqual([`${result.id}.png`, 'index.json']);
    expect(JSON.parse(await readFile(path.join(root, 'assets/index.json'), 'utf8'))).toEqual({ [result.id]: 'image/png' });
    const blob = await store.getBlob(result.id);
    expect([...blob!.bytes]).toEqual([1, 2, 3]);
    expect(blob!.contentType).toBe('image/png');
    expect(await store.hasBlob(result.id)).toBe(true);
    expect(await store.getBlob('../index.json')).toBe(null);
    expect(await store.getBlob('0'.repeat(32))).toBe(null);
  });

  it('同一份素材再传一次不重复存；没有 index.json 时按扩展名给类型', async () => {
    const bytes = new Uint8Array([4, 5]);
    const first = await store.putBlob(bytes, 'image/webp');
    const again = await store.putBlob(bytes, 'image/webp');
    expect(again).toEqual(first);
    expect((await readdir(path.join(root, 'assets'))).filter(n => n.startsWith(first.id))).toHaveLength(1);
    await rm(path.join(root, 'assets/index.json'));
    expect((await store.getBlob(first.id))!.contentType).toBe('image/webp');
  });

  it('externalChanges：自己写的不算，外部改的、外部删的都算；清单外的路径忽略', async () => {
    await store.publish({ 'project/slides/s01.html': write('mine') });
    expect(await store.externalChanges(['project/slides/s01.html'])).toEqual([]);
    await writeFile(path.join(root, 'slides/s01.html'), 'theirs');
    await rm(path.join(root, 'deck.json'));
    expect(await store.externalChanges(['project/slides/s01.html', 'project/deck.json', 'project/notes.md'])).toEqual([
      'project/slides/s01.html',
      'project/deck.json',
    ]);
  });

  it('externalChanges：与调用方已知的内容一致的也不算，查过的路径记成当前内容', async () => {
    const seen = new Map(Object.entries((await store.listing()).files).map(([p, f]) => [p, f.sha256] as [string, string]));
    expect(await store.externalChanges(['project/deck.json', 'project/slides/s01.html'], seen)).toEqual([]);
    await writeFile(path.join(root, 'slides/s01.html'), 'theirs');
    expect(await store.externalChanges(['project/slides/s01.html'], seen)).toEqual(['project/slides/s01.html']);
    expect(await store.externalChanges(['project/slides/s01.html'], seen)).toEqual([]);
    await rm(path.join(root, 'deck.json'));
    expect(await store.externalChanges(['project/deck.json'], seen)).toEqual(['project/deck.json']);
  });

  it('watchExternalEdits：外部改 slide 去抖后回调一次；编辑器自己保存的不回调', async () => {
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      await store.publish({ 'project/slides/s01.html': write('mine') });
      await new Promise(resolve => setTimeout(resolve, 700));
      expect(events).toEqual([]);
      await writeFile(path.join(root, 'slides/s01.html'), 'theirs');
      await writeFile(path.join(root, 'notes.md'), '改草稿不算');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      expect(events[0]!.paths).toEqual(['project/slides/s01.html']);
      expect(events[0]!.ver).toBe((await store.listing()).ver);
    } finally {
      stop();
    }
  });

  it('watchExternalEdits：原子替换 slide 后仍能收到下一次修改', async () => {
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      // 先让监听的初始清单读完，再模拟智能体用临时文件替换页面。
      await new Promise(resolve => setTimeout(resolve, 100));
      const file = path.join(root, 'slides/s01.html');
      const temp = path.join(root, 'slides/.s01.tmp');
      await writeFile(temp, 'replacement');
      await rename(temp, file);
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      await writeFile(file, 'next edit');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(2);
      expect(events.map(event => event.paths)).toEqual([['project/slides/s01.html'], ['project/slides/s01.html']]);
    } finally {
      stop();
    }
  });

  it('watchExternalEdits：新建嵌套 ds 目录时不漏初次文件，之后的修改继续通知', async () => {
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const folder = path.join(root, 'ds/new/nested');
      await mkdir(folder, { recursive: true });
      const file = path.join(folder, 'theme.css');
      await writeFile(file, 'initial');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      expect(events[0]!.paths).toEqual(['project/ds/new/nested/theme.css']);
      await writeFile(file, 'changed');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(2);
      expect(events[1]!.paths).toEqual(['project/ds/new/nested/theme.css']);
    } finally {
      stop();
    }
  });

  it('watchExternalEdits：删除重建 slides 目录后继续监听，旧文件删除也通知', async () => {
    const events: DeckChangeEvent[] = [];
    const stop = watchExternalEdits(store, event => events.push(event));
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const folder = path.join(root, 'slides');
      await rm(folder, { recursive: true });
      await mkdir(folder);
      const file = path.join(folder, 's02.html');
      await writeFile(file, 'new slide');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      expect(events[0]!.paths).toEqual(['project/slides/s01.html', 'project/slides/s02.html']);
      await writeFile(file, 'next edit');
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(2);
      expect(events[1]!.paths).toEqual(['project/slides/s02.html']);
    } finally {
      stop();
    }
  });

  it.each(['slides', 'ds/brand'])('watchExternalEdits：%s 重建时复用 inode 也能监听后续修改', async folder => {
    const file = path.join(root, folder, 's01.html');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'initial');
    const changedDir = path.join(root, folder.split('/')[0]!);
    const errors: unknown[] = [];
    const events: DeckChangeEvent[] = [];
    const handles: { dir: string; listener: fsSync.WatchListener<string>; watcher: fsSync.FSWatcher; deleted: boolean; closed: boolean }[] = [];
    // 模拟 Linux：删除后旧 handle 不再收到事件；同名新目录可以复用 dev/ino。
    const originalStat = fsSync.lstatSync;
    const statSpy = vi.spyOn(fsSync, 'lstatSync').mockImplementation(((...args: Parameters<typeof fsSync.lstatSync>) =>
      Object.assign(originalStat(...args)!, { dev: 1, ino: 1 })) as typeof fsSync.lstatSync);
    const watchSpy = vi.spyOn(fsSync, 'watch').mockImplementation(((dir: string, listener: fsSync.WatchListener<string>) => {
      const watcher = new EventEmitter() as fsSync.FSWatcher;
      const handle = { dir, listener, watcher, deleted: false, closed: false };
      watcher.close = () => { handle.closed = true; };
      handles.push(handle);
      return watcher;
    }) as typeof fsSync.watch);
    const notify = (dir: string, event: 'rename' | 'change', name: string) => {
      for (const handle of [...handles]) {
        if (handle.dir === dir && !handle.deleted && !handle.closed) handle.listener(event, name);
      }
    };
    const stop = watchExternalEdits(store, event => events.push(event), error => errors.push(error));
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      for (const handle of handles) {
        if (handle.dir === changedDir || handle.dir.startsWith(changedDir + path.sep)) handle.deleted = true;
      }
      await rm(changedDir, { recursive: true });
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'replacement');
      notify(root, 'rename', path.basename(changedDir));
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(1);
      expect(events[0]!.paths).toEqual([`project/${folder}/s01.html`]);
      await writeFile(file, 'next edit');
      notify(path.dirname(file), 'change', path.basename(file));
      await expect.poll(() => events.length, { timeout: 3000 }).toBe(2);
      expect(events[1]!.paths).toEqual([`project/${folder}/s01.html`]);
      expect(errors).toEqual([]);
    } finally {
      stop();
      statSpy.mockRestore();
      watchSpy.mockRestore();
    }
    expect(handles.every(handle => handle.closed)).toBe(true);
  });
});

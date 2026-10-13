import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SlidesCreated } from '@cuccut/protocol';
import { compilerAvailable, DeckStore, loadSlidesCompiler, resolveSlidesEditorDist, type SlidesRuntime } from '@cuccut/slides';
import type { AgentPrincipal } from './grants.ts';
import { SlidesTools } from './slides-tools.ts';
import { ToolError } from './tool-catalog.ts';
import { toolRisk, type ToolConfirmation, type ToolScope } from './tool-scope.ts';

/**
 * `slides_check` and `slides_import_asset` (docs/design/slides §7.2): the deck must be in the session's source directory. When validation passes, the session records a `slides-created` entry; when there are problems, it does not. Imported images go into the deck's `assets/`, and the tool returns `/_blob/<id>`. Cases that need the compiler are skipped when the editor is not built.
 */

const dist = resolveSlidesEditorDist();
const rt: SlidesRuntime | null = compilerAvailable(dist) ? loadSlidesCompiler(dist) : null;

const FACE = { family: 'Source Sans 3', href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;700&display=swap' };
const SLIDE = (id: string, body = '<h1 style="font-size:96px">标题</h1>') =>
  `<section id="${id}" style="background:#ffffff;font-family:'Source Sans 3', Arial, sans-serif;color:#292929;display:flex;flex-direction:column;padding:128px">\n  ${body}\n</section>\n`;

let tmp: string;
let root: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-slides-tools-')));
  root = path.join(tmp, 'scratch');
  await fs.mkdir(root);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeDeck(rel: string, slides: Record<string, string>, title = '季度回顾'): Promise<string> {
  const dir = path.join(root, rel);
  await fs.mkdir(path.join(dir, 'slides'), { recursive: true });
  const order = Object.keys(slides);
  const deck = { v: 4, lists: 'css', title, order, sections: {}, faces: { 'source-sans-3': FACE }, designSystems: [] };
  await fs.writeFile(path.join(dir, 'deck.json'), JSON.stringify(deck));
  for (const [id, html] of Object.entries(slides)) await fs.writeFile(path.join(dir, 'slides', `${id}.html`), html);
  return dir;
}

async function rejected(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ToolError) return error.code;
    throw error;
  }
  throw new Error('应当拒绝');
}

/** What the tools use: authorization, confirmation (records the request), the source and working directories, and card recording. */
function fakeScope(write = true) {
  const confirmed: ToolConfirmation[] = [];
  const recorded: SlidesCreated[] = [];
  const scope = {
    authorize: (principal: AgentPrincipal, wants: boolean) => {
      if (wants && !write) throw new ToolError('PLAN_ONLY', '规划模式只读');
      return { principal, submitter: { kind: 'agent', id: principal.conversationId, taskId: 'task_1' } };
    },
    confirm: async (_access: unknown, request: ToolConfirmation) => {
      confirmed.push(request);
      return { mode: 'auto', risk: toolRisk(request), decidedBy: 'auto' };
    },
    createRoot: async () => ({ root, scope: { conversationId: 'conv_1' } }),
    fileBase: () => root,
    recordSlides: (_access: unknown, created: SlidesCreated) => void recorded.push(created),
  } as unknown as ToolScope;
  return { scope, confirmed, recorded };
}

const principal = { kind: 'agent', conversationId: 'conv_1' } as unknown as AgentPrincipal;

function tools(scope: ToolScope, compiler: SlidesRuntime | null = rt) {
  return new SlidesTools({ scope, slides: { compiler: () => compiler, store: (dir) => new DeckStore(dir) } });
}

describe('slides_check', () => {
  it.skipIf(!rt)('without problems, records a slides-created entry in session: source directory + relative path, title and page count', async () => {
    await writeDeck('decks/talk', { a: SLIDE('a'), b: SLIDE('b') });
    const { scope, recorded } = fakeScope(false);
    const result = (await tools(scope).dispatch('slides_check', { path: './decks/talk/' }, principal)) as Record<string, unknown>;
    expect(result).toMatchObject({ path: 'decks/talk', title: '季度回顾', slideCount: 2, problems: 0 });
    expect(result).not.toHaveProperty('slides');
    expect(recorded).toEqual([{ target: { conversationId: 'conv_1', path: 'decks/talk' }, title: '季度回顾', slideCount: 2 }]);
  });

  it.skipIf(!rt)('with problems, returns each page\'s problems, no card recorded', async () => {
    await writeDeck('talk', { a: SLIDE('a'), b: SLIDE('b', '<marquee>x</marquee>') });
    const { scope, recorded } = fakeScope();
    const result = (await tools(scope).dispatch('slides_check', { path: 'talk' }, principal)) as {
      problems: number;
      slides: { id: string; problems?: string[] }[];
    };
    expect(result.problems).toBe(1);
    expect(result.slides).toEqual([expect.objectContaining({ id: 'b', problems: [expect.stringMatching(/marquee/)] })]);
    expect(recorded).toEqual([]);
  });

  it.skipIf(!rt)('layout hints are not problems: card still recorded, next reminds to fix them', async () => {
    const overlap = [
      '<p style="position:absolute;left:100px;top:100px;width:400px;font-size:40px">Overlapping</p>',
      '<p style="position:absolute;left:120px;top:110px;width:400px;font-size:40px">Covered</p>',
    ].join('\n  ');
    await writeDeck('talk', { a: SLIDE('a', overlap) });
    const { scope, recorded } = fakeScope();
    const result = (await tools(scope).dispatch('slides_check', { path: 'talk' }, principal)) as {
      problems: number;
      slides: { id: string; notes?: string[] }[];
      next: string;
    };
    expect(result.problems).toBe(0);
    expect(result.slides[0]!.notes).toEqual(expect.arrayContaining([expect.stringMatching(/^layout .*overlaps/)]));
    expect(result.next).toMatch(/layout notes/);
    expect(recorded).toHaveLength(1);
  });

  it('when editor is not built, says unavailable; path outside bounds, nonexistent, or not a deck rejected', async () => {
    await writeDeck('talk', { a: SLIDE('a') });
    await fs.mkdir(path.join(root, 'plain'));
    await fs.mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules', 'pkg', 'deck.json'), JSON.stringify({ v: 4, order: [] }));
    const { scope, recorded } = fakeScope();
    expect(await rejected(tools(scope, null).dispatch('slides_check', { path: 'talk' }, principal))).toBe('SLIDES_COMPILER_UNAVAILABLE');
    const set = tools(scope);
    expect(await rejected(set.dispatch('slides_check', { path: '../elsewhere' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('slides_check', { path: tmp }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('slides_check', { path: 'node_modules/pkg' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('slides_check', { path: 'missing' }, principal))).toBe('DECK_NOT_FOUND');
    expect(await rejected(set.dispatch('slides_check', { path: 'plain' }, principal))).toBe('NOT_A_DECK');
    expect(recorded).toEqual([]);
  });
});

describe('slides_import_asset', () => {
  it('images copied into the deck\'s assets/, returns /_blob/<id>; same image stored once; risk edit, written only after confirmation', async () => {
    const deck = await writeDeck('talk', { a: SLIDE('a') });
    await fs.mkdir(path.join(root, 'images'));
    await fs.writeFile(path.join(root, 'images', 'cover.png'), 'png-bytes');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const first = (await set.dispatch('slides_import_asset', { deck: 'talk', path: 'images/cover.png' }, principal)) as Record<string, unknown>;
    expect(first).toMatchObject({ src: expect.stringMatching(/^\/_blob\/[0-9a-f]{32}$/), bytes: 9, contentType: 'image/png' });
    const id = (first.src as string).slice('/_blob/'.length);
    expect(await fs.readFile(path.join(deck, 'assets', `${id}.png`), 'utf8')).toBe('png-bytes');
    expect(confirmed).toEqual([expect.objectContaining({ tool: 'slides_import_asset', targets: [deck] })]);
    expect(toolRisk(confirmed[0]!)).toBe('edit');

    const again = (await set.dispatch('slides_import_asset', { deck: 'talk', path: 'images/cover.png' }, principal)) as Record<string, unknown>;
    expect(again.src).toBe(first.src);
    expect((await fs.readdir(path.join(deck, 'assets'))).filter((name) => name !== 'index.json')).toEqual([`${id}.png`]);
  });

  it('fonts also copied into assets/, next step says to register src in deck.json\'s faces', async () => {
    const deck = await writeDeck('talk', { a: SLIDE('a') });
    await fs.writeFile(path.join(root, 'Brand.woff2'), 'woff2-bytes');
    const result = (await tools(fakeScope().scope).dispatch('slides_import_asset', { deck: 'talk', path: 'Brand.woff2' }, principal)) as Record<string, unknown>;
    expect(result).toMatchObject({ src: expect.stringMatching(/^\/_blob\/[0-9a-f]{32}$/), contentType: 'font/woff2' });
    expect(result.next).toContain('faces');
    const id = (result.src as string).slice('/_blob/'.length);
    expect(await fs.readFile(path.join(deck, 'assets', `${id}.woff2`), 'utf8')).toBe('woff2-bytes');
  });

  it('only regular image and font files in the working directory accepted; plan mode read-only; checks that fail generate no approval', async () => {
    await writeDeck('talk', { a: SLIDE('a') });
    await fs.writeFile(path.join(root, 'notes.md'), '# 讲稿');
    await fs.writeFile(path.join(tmp, 'secret.png'), 'png');
    await fs.symlink(path.join(tmp, 'secret.png'), path.join(root, 'link.png'));
    await fs.writeFile(path.join(root, 'ok.png'), 'png');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const call = (args: Record<string, string>) => rejected(set.dispatch('slides_import_asset', args, principal));
    expect(await call({ deck: 'talk', path: 'notes.md' })).toBe('UNSUPPORTED_ASSET_TYPE');
    expect(await call({ deck: 'talk', path: '../secret.png' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await call({ deck: 'talk', path: path.join(tmp, 'secret.png') })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await call({ deck: 'talk', path: 'link.png' })).toBe('PATH_IS_SYMLINK');
    expect(await call({ deck: 'talk', path: 'missing.png' })).toBe('FILE_NOT_FOUND');
    expect(await call({ deck: 'nope', path: 'ok.png' })).toBe('DECK_NOT_FOUND');
    expect(confirmed).toEqual([]);
    expect(await rejected(tools(fakeScope(false).scope).dispatch('slides_import_asset', { deck: 'talk', path: 'ok.png' }, principal))).toBe('PLAN_ONLY');
  });
});

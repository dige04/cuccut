import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DesignCreated } from '@cuccut/protocol';
import { CANVAS_LAYOUT } from '@cuccut/design';
import { DeckStore } from '@cuccut/slides';
import { DesignTools } from './design-tools.ts';
import type { AgentPrincipal } from './grants.ts';
import { ToolError } from './tool-catalog.ts';
import { toolRisk, type ToolConfirmation, type ToolScope } from './tool-scope.ts';

/**
 * `design_check` and `design_import_asset` (docs/design/canvas §7.2): the design must be in the session's source directory. When there are no problems, the session records a `design-created` entry; when there are problems, it does not. Imported images and fonts go into the design's `assets/`, and the tool returns `/_blob/<id>`.
 */

let tmp: string;
let root: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-design-tools-')));
  root = path.join(tmp, 'scratch');
  await fs.mkdir(root);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const BOARD = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Poster</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>body{margin:0}</style></helmet>
<div style="width: 880px; height: 560px"><h1 style="margin: 0; color: {{accent}}">Spring Menu</h1></div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"accent":{"editor":"color","default":"#666666"},"$preview":{"width":880,"height":560}}'>
class Component extends DCLogic {
renderVals() { return { accent: this.props.accent ?? '#666666' }; }
}
</script>
</body>
</html>`;

async function writeCanvas(rel: string, files: Record<string, string> = {}, title = 'Spring Poster'): Promise<string> {
  const dir = path.join(root, rel);
  await fs.mkdir(dir, { recursive: true });
  const canvas = {
    v: 3,
    createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' },
    title,
    launch: { view: 'canvas' },
    pages: [],
    boards: { 'Main.dc.html': { x: 0, y: 0, w: 880, h: 560 } },
    order: ['Main.dc.html'],
    notes: {},
    designSystems: [],
  };
  await fs.writeFile(path.join(dir, 'canvas.json'), JSON.stringify(canvas));
  await fs.writeFile(path.join(dir, 'Main.dc.html'), BOARD);
  for (const [p, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, p)), { recursive: true });
    await fs.writeFile(path.join(dir, p), text);
  }
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
  const recorded: DesignCreated[] = [];
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
    recordDesign: (_access: unknown, created: DesignCreated) => void recorded.push(created),
  } as unknown as ToolScope;
  return { scope, confirmed, recorded };
}

const principal = { kind: 'agent', conversationId: 'conv_1' } as unknown as AgentPrincipal;

function tools(scope: ToolScope) {
  return new DesignTools({ scope, design: { designStore: (dir) => new DeckStore(dir, CANVAS_LAYOUT) } });
}

describe('design_check', () => {
  it('valid design: problems is 0, records one card (source directory + relative path), result states it is not rendered', async () => {
    await writeCanvas('designs/poster');
    const { scope, recorded } = fakeScope();
    const result = (await tools(scope).dispatch('design_check', { path: './designs/poster/' }, principal)) as Record<string, unknown>;
    expect(result).toMatchObject({ path: 'designs/poster', title: 'Spring Poster', boardCount: 1, problems: 0 });
    expect(result).not.toHaveProperty('issues');
    expect(result.notChecked).toEqual(expect.stringContaining('no rendering'));
    expect(recorded).toEqual([{ target: { conversationId: 'conv_1', path: 'designs/poster' }, title: 'Spring Poster', boardCount: 1 }]);
    expect(toolRisk({ tool: 'design_check' } as ToolConfirmation)).toBe('read');
  });

  it('when there are problems, issues are listed and no card is recorded; canvas.json missing is still validated', async () => {
    await writeCanvas('poster', { 'Extra.dc.html': BOARD.replace('{{accent}}', '{{ a + b }}') });
    const { scope, recorded } = fakeScope();
    const result = (await tools(scope).dispatch('design_check', { path: 'poster' }, principal)) as { problems: number; issues: { file: string; message: string }[] };
    expect(result.problems).toBeGreaterThan(0);
    expect(result.issues).toContainEqual({ file: 'Extra.dc.html', message: expect.stringMatching(/is not in canvas\.json boards/) });
    expect(result.issues).toContainEqual({ file: 'Extra.dc.html', message: expect.stringMatching(/\{\{ a \+ b \}\} is an expression/) });
    expect(recorded).toEqual([]);

    await fs.mkdir(path.join(root, 'empty'));
    const empty = (await tools(scope).dispatch('design_check', { path: 'empty' }, principal)) as { problems: number; issues: { file: string; message: string }[] };
    expect(empty.issues).toContainEqual({ file: 'canvas.json', message: expect.stringMatching(/^missing/) });
    expect(recorded).toEqual([]);
  });

  it('design must be inside the working directory', async () => {
    const set = tools(fakeScope().scope);
    expect(await rejected(set.dispatch('design_check', { path: '../elsewhere' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_check', { path: tmp }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_check', { path: 'node_modules/pkg' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_check', { path: 'missing' }, principal))).toBe('CANVAS_NOT_FOUND');
  });
});

describe('design_import_asset', () => {
  it('images and fonts copied into the design\'s assets/, returns /_blob/<id>; the same file is stored once; risk edit, written only after confirmation', async () => {
    const canvas = await writeCanvas('poster');
    await fs.mkdir(path.join(root, 'images'));
    await fs.writeFile(path.join(root, 'images', 'hero.jpg'), 'jpg-bytes');
    await fs.writeFile(path.join(root, 'brand.woff2'), 'font-bytes');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const first = (await set.dispatch('design_import_asset', { canvas: 'poster', path: 'images/hero.jpg' }, principal)) as Record<string, unknown>;
    expect(first).toMatchObject({ src: expect.stringMatching(/^\/_blob\/[0-9a-f]{32}$/), bytes: 9, contentType: 'image/jpeg' });
    const id = (first.src as string).slice('/_blob/'.length);
    expect(await fs.readFile(path.join(canvas, 'assets', `${id}.jpg`), 'utf8')).toBe('jpg-bytes');
    expect(confirmed).toEqual([expect.objectContaining({ tool: 'design_import_asset', targets: [canvas] })]);
    expect(toolRisk(confirmed[0]!)).toBe('edit');

    const again = (await set.dispatch('design_import_asset', { canvas: 'poster', path: 'images/hero.jpg' }, principal)) as Record<string, unknown>;
    expect(again.src).toBe(first.src);
    const font = (await set.dispatch('design_import_asset', { canvas: 'poster', path: 'brand.woff2' }, principal)) as Record<string, unknown>;
    expect(font).toMatchObject({ contentType: 'font/woff2', next: expect.stringContaining('@font-face') });
    expect((await fs.readdir(path.join(canvas, 'assets'))).filter((name) => name !== 'index.json').sort()).toHaveLength(2);
  });

  it('only regular images and fonts in the working directory are accepted; the directory must already be a design; plan mode is read-only; checks that fail generate no approval', async () => {
    await writeCanvas('poster');
    await fs.mkdir(path.join(root, 'plain'));
    await fs.writeFile(path.join(root, 'styles.css'), 'a{}');
    await fs.writeFile(path.join(tmp, 'secret.png'), 'png');
    await fs.symlink(path.join(tmp, 'secret.png'), path.join(root, 'link.png'));
    await fs.writeFile(path.join(root, 'ok.png'), 'png');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const call = (args: Record<string, string>) => rejected(set.dispatch('design_import_asset', args, principal));
    expect(await call({ canvas: 'poster', path: 'styles.css' })).toBe('UNSUPPORTED_ASSET_TYPE');
    expect(await call({ canvas: 'poster', path: '../secret.png' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await call({ canvas: 'poster', path: 'link.png' })).toBe('PATH_IS_SYMLINK');
    expect(await call({ canvas: 'poster', path: 'missing.png' })).toBe('FILE_NOT_FOUND');
    expect(await call({ canvas: 'nope', path: 'ok.png' })).toBe('CANVAS_NOT_FOUND');
    expect(await call({ canvas: 'plain', path: 'ok.png' })).toBe('NOT_A_CANVAS');
    expect(confirmed).toEqual([]);
    expect(await rejected(tools(fakeScope(false).scope).dispatch('design_import_asset', { canvas: 'poster', path: 'ok.png' }, principal))).toBe('PLAN_ONLY');
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DesignSystemCreated } from '@cuccut/protocol';
import { BLOBS_DIR, DESIGN_SYSTEM_LAYOUT } from '@cuccut/design-system';
import { DeckStore } from '@cuccut/slides';
import { DesignSystemTools } from './design-system-tools.ts';
import type { AgentPrincipal } from './grants.ts';
import { ToolError } from './tool-catalog.ts';
import { toolRisk, type ToolConfirmation, type ToolScope } from './tool-scope.ts';

/**
 * `design_system_check` 与 `design_system_import_asset`（docs/design/canvas §10.5）：设计系统必须在会话的来源目录里；没有问题时
 * 会话里记一条 `design-system-created`，有问题时不记；导入的素材进设计系统的 `_blobs/`，返回 `/_blob/<id>` 与索引记录。
 */

let tmp: string;
let root: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-design-system-tools-')));
  root = path.join(tmp, 'scratch');
  await fs.mkdir(root);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const INDEX = { v: 3, layout: 'files', createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' }, title: 'Acme', namespace: 'Acme' };

async function writeSystem(rel: string, files: Record<string, string> = {}, index: Record<string, unknown> = INDEX): Promise<string> {
  const dir = path.join(root, rel);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'design-system.json'), JSON.stringify(index));
  await fs.writeFile(path.join(dir, 'README.md'), '# Acme\n');
  for (const [p, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, p)), { recursive: true });
    await fs.writeFile(path.join(dir, p), text);
  }
  return dir;
}

async function sparse(file: string, size: number): Promise<void> {
  const handle = await fs.open(file, 'w');
  await handle.truncate(size);
  await handle.close();
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

/** 工具用到的：授权、确认（记下请求）、来源目录与工作目录、记卡片。 */
function fakeScope(write = true) {
  const confirmed: ToolConfirmation[] = [];
  const recorded: DesignSystemCreated[] = [];
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
    recordDesignSystem: (_access: unknown, created: DesignSystemCreated) => void recorded.push(created),
  } as unknown as ToolScope;
  return { scope, confirmed, recorded };
}

const principal = { kind: 'agent', conversationId: 'conv_1' } as unknown as AgentPrincipal;

function tools(scope: ToolScope) {
  return new DesignSystemTools({ scope, designSystem: { designSystemStore: (dir) => new DeckStore(dir, DESIGN_SYSTEM_LAYOUT) } });
}

describe('design_system_check', () => {
  it('合格的设计系统：problems 为 0，记一张卡片（来源目录 + 相对路径）；风险 read', async () => {
    await writeSystem('brand/acme');
    const { scope, recorded } = fakeScope();
    const result = (await tools(scope).dispatch('design_system_check', { path: './brand/acme/' }, principal)) as Record<string, unknown>;
    expect(result).toMatchObject({ path: 'brand/acme', title: 'Acme', namespace: 'Acme', problems: 0 });
    expect(result).not.toHaveProperty('issues');
    expect(result).not.toHaveProperty('notes');
    expect(result.notChecked).toEqual(expect.stringContaining('manifest.json'));
    expect(recorded).toEqual([{ target: { conversationId: 'conv_1', path: 'brand/acme' }, title: 'Acme' }]);
    expect(toolRisk({ tool: 'design_system_check' } as ToolConfirmation)).toBe('read');
  });

  it('有问题时列出 issues，不记卡片；design-system.json 缺失也照样校验；说明另列，不挡卡片', async () => {
    await writeSystem('acme', { 'package.json': '{}' });
    const { scope, recorded } = fakeScope();
    const set = tools(scope);
    const result = (await set.dispatch('design_system_check', { path: 'acme' }, principal)) as { problems: number; issues: { file: string; message: string }[] };
    expect(result.problems).toBeGreaterThan(0);
    expect(result.issues).toContainEqual({ file: 'package.json', message: expect.stringContaining("The editor can't see it") });
    expect(recorded).toEqual([]);

    await fs.mkdir(path.join(root, 'empty'));
    const empty = (await set.dispatch('design_system_check', { path: 'empty' }, principal)) as { issues: { file: string; message: string }[] };
    expect(empty.issues).toContainEqual({ file: 'design-system.json', message: expect.stringMatching(/^missing/) });
    expect(recorded).toEqual([]);

    await writeSystem('noted', { 'tokens.json': JSON.stringify({ meta: { from: 'sync' } }) });
    const noted = (await set.dispatch('design_system_check', { path: 'noted' }, principal)) as Record<string, unknown>;
    expect(noted).toMatchObject({ problems: 0, notes: [{ file: 'tokens.json', message: expect.stringContaining('"meta"') }] });
    expect(recorded).toEqual([{ target: { conversationId: 'conv_1', path: 'noted' }, title: 'Acme' }]);
  });

  it('设计系统要在工作目录里', async () => {
    const set = tools(fakeScope().scope);
    expect(await rejected(set.dispatch('design_system_check', { path: '../elsewhere' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_system_check', { path: tmp }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_system_check', { path: 'node_modules/pkg' }, principal))).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await rejected(set.dispatch('design_system_check', { path: 'missing' }, principal))).toBe('DESIGN_SYSTEM_NOT_FOUND');
  });
});

describe('design_system_import_asset', () => {
  it('素材拷进 _blobs/（不进 assets/），返回 /_blob/<id> 与索引记录；给了组时记录进 assetGroups；风险 edit，确认之后才写', async () => {
    const system = await writeSystem('acme');
    await fs.mkdir(path.join(root, 'brand'));
    await fs.writeFile(path.join(root, 'brand', 'logo.png'), 'png-bytes');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const first = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'brand/logo.png', group: 'Logos' }, principal)) as Record<string, unknown>;
    expect(first).toMatchObject({
      src: expect.stringMatching(/^\/_blob\/[0-9a-f]{32}$/),
      key: 'logo.png',
      groupKey: 'Logos',
      restoredAs: 'assets/Logos/logo.png',
      bytes: 9,
      contentType: 'image/png',
    });
    const id = (first.src as string).slice('/_blob/'.length);
    expect(first.record).toEqual({ name: 'logo.png', blob: id, size: 9, type: 'image/png' });
    expect(first.indexPath).toEqual(['assetGroups', 'Logos', 'files', 'logo.png']);
    expect(await fs.readFile(path.join(system, BLOBS_DIR, `${id}.png`), 'utf8')).toBe('png-bytes');
    expect(await fs.readdir(system)).not.toContain('assets');
    expect(confirmed).toEqual([expect.objectContaining({ tool: 'design_system_import_asset', targets: [system] })]);
    expect(toolRisk(confirmed[0]!)).toBe('edit');

    const again = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'brand/logo.png', group: 'Logos' }, principal)) as Record<string, unknown>;
    expect(again.src).toBe(first.src);

    // 组名里有空格：键按原版编码
    const spaced = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'brand/logo.png', group: 'My Icons' }, principal)) as Record<string, unknown>;
    expect(spaced).toMatchObject({ groupKey: 'My~20Icons', restoredAs: 'assets/My Icons/logo.png', indexPath: ['assetGroups', 'My~20Icons', 'files', 'logo.png'] });

    // 不给组：字体还原到 fonts/，其余到 assets/
    await fs.writeFile(path.join(root, 'Brand Sans.woff2'), 'wOF2-font');
    const font = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'Brand Sans.woff2' }, principal)) as Record<string, unknown>;
    expect(font).toMatchObject({ key: 'fonts/Brand~20Sans.woff2', restoredAs: 'fonts/Brand Sans.woff2', contentType: 'font/woff2' });
    expect(font).not.toHaveProperty('groupKey');
    expect(font.indexPath).toEqual(['blobs', 'fonts/Brand~20Sans.woff2']);
    expect(font.record).toMatchObject({ name: 'fonts/Brand Sans.woff2', type: 'font/woff2' });
    await fs.writeFile(path.join(root, 'mark.svg'), '<svg/>');
    const svg = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'mark.svg' }, principal)) as Record<string, unknown>;
    expect(svg).toMatchObject({ restoredAs: 'assets/mark.svg', contentType: 'image/svg+xml' });
  });

  it('新建的设计系统：空目录先导入素材，索引最后写，按返回的记录写进去之后 design_system_check 认得这些素材', async () => {
    const system = path.join(root, 'acme');
    await fs.mkdir(system);
    await fs.writeFile(path.join(root, 'logo.png'), 'png-bytes');
    const { scope, recorded } = fakeScope();
    const set = tools(scope);
    const imported = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'logo.png', group: 'Logos' }, principal)) as {
      record: Record<string, unknown>;
      src: string;
    };
    const index = { ...INDEX, groups: ['Logos'], assetGroups: { Logos: { name: 'Logos', order: ['logo.png'], files: { 'logo.png': imported.record } } } };
    await fs.writeFile(path.join(system, 'design-system.json'), JSON.stringify(index));
    await fs.writeFile(path.join(system, 'README.md'), `# Acme\n\n![logo](${imported.src})\n`);
    const result = (await set.dispatch('design_system_check', { path: 'acme' }, principal)) as Record<string, unknown>;
    expect(result).toMatchObject({ problems: 0 });
    expect(recorded).toHaveLength(1);
  });

  it('大小上限：SVG 2 MiB，其余 20 MiB；类型不在允许的集合里的不收；组名不合规则的不收；都不生成审批', async () => {
    await writeSystem('acme');
    await sparse(path.join(root, 'big.svg'), 2 * 1024 * 1024 + 1);
    await sparse(path.join(root, 'ok.svg'), 2 * 1024 * 1024);
    await sparse(path.join(root, 'big.png'), 20 * 1024 * 1024 + 1);
    await sparse(path.join(root, 'big.mp4'), 20 * 1024 * 1024 + 1);
    for (const name of ['styles.css', 'photo.avif', 'clip.mov', 'favicon.ico', 'README', 'tokens.json']) await fs.writeFile(path.join(root, name), 'x');
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const call = (args: Record<string, string>) => rejected(set.dispatch('design_system_import_asset', args, principal));
    expect(await call({ system: 'acme', path: 'big.svg' })).toBe('FILE_TOO_LARGE');
    expect(await call({ system: 'acme', path: 'big.png' })).toBe('FILE_TOO_LARGE');
    expect(await call({ system: 'acme', path: 'big.mp4' })).toBe('FILE_TOO_LARGE');
    for (const name of ['styles.css', 'photo.avif', 'clip.mov', 'favicon.ico', 'README', 'tokens.json']) {
      expect(await call({ system: 'acme', path: name }), name).toBe('UNSUPPORTED_ASSET_TYPE');
    }
    for (const group of ['a/b', ' Logos', 'Logos ', '..', '__proto__']) {
      expect(await call({ system: 'acme', path: 'ok.svg', group }), group).toBe('INVALID_GROUP');
    }
    expect(confirmed).toEqual([]);
    const ok = (await set.dispatch('design_system_import_asset', { system: 'acme', path: 'ok.svg' }, principal)) as Record<string, unknown>;
    expect(ok).toMatchObject({ bytes: 2 * 1024 * 1024, contentType: 'image/svg+xml' });
  });

  it('只收工作目录里的普通文件；design-system.json 不是索引的目录不收；规划模式只读', async () => {
    await writeSystem('acme');
    await fs.mkdir(path.join(root, 'plain'));
    await fs.writeFile(path.join(root, 'plain', 'design-system.json'), JSON.stringify({ title: 'Plain' }));
    await writeSystem('unmarked', {}, { v: 3, layout: 'files', title: 'Unmarked' });
    await fs.writeFile(path.join(tmp, 'secret.png'), 'png');
    await fs.symlink(path.join(tmp, 'secret.png'), path.join(root, 'link.png'));
    await fs.writeFile(path.join(root, 'ok.png'), 'png');
    await fs.mkdir(path.join(root, 'folder.png'));
    const { scope, confirmed } = fakeScope();
    const set = tools(scope);
    const call = (args: Record<string, string>) => rejected(set.dispatch('design_system_import_asset', args, principal));
    expect(await call({ system: 'acme', path: '../secret.png' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await call({ system: 'acme', path: 'link.png' })).toBe('PATH_IS_SYMLINK');
    expect(await call({ system: 'acme', path: 'missing.png' })).toBe('FILE_NOT_FOUND');
    expect(await call({ system: 'acme', path: 'folder.png' })).toBe('NOT_A_FILE');
    expect(await call({ system: 'nope', path: 'ok.png' })).toBe('DESIGN_SYSTEM_NOT_FOUND');
    expect(await call({ system: 'plain', path: 'ok.png' })).toBe('NOT_A_DESIGN_SYSTEM');
    expect(await call({ system: 'unmarked', path: 'ok.png' })).toBe('NOT_A_DESIGN_SYSTEM');
    expect(await call({ system: '../outside', path: 'ok.png' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(confirmed).toEqual([]);
    expect(await rejected(tools(fakeScope(false).scope).dispatch('design_system_import_asset', { system: 'acme', path: 'ok.png' }, principal))).toBe('PLAN_ONLY');
  });
});

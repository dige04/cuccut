import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentPrincipal } from './grants.ts';
import { DownloadTools, downloadFileName, prepareDownloadSave, type DownloadHandover } from './download-tools.ts';
import { ToolError } from './tool-catalog.ts';
import { TOOL_RISK, toolRisk, type ToolConfirmation, type ToolScope } from './tool-scope.ts';

/**
 * `downloads_save`: copies a file from the working directory into the downloads directory. Path checks (`..`, absolute paths, symlinks, directories, the video directory) reject before approval. It only creates new files; on a name clash it adds a sequence number. File names are sanitised by the same rules as downloaded files, and the extension is kept from the source file.
 */

let tmp: string;
let root: string;
let downloads: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-downloads-save-')));
  root = path.join(tmp, 'scratch');
  downloads = path.join(tmp, 'Downloads');
  await fs.mkdir(root);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function rejected(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ToolError) return error.code;
    throw error;
  }
  throw new Error('应当拒绝');
}

/** Implements only the three things this tool uses: authorization, confirmation (records the request), and the working directory. */
function fakeScope(write = true): { scope: ToolScope; confirmed: ToolConfirmation[] } {
  const confirmed: ToolConfirmation[] = [];
  const scope = {
    authorize: (principal: AgentPrincipal, wants: boolean) => {
      if (wants && !write) throw new ToolError('PLAN_ONLY', '规划模式只读');
      return { principal, submitter: { kind: 'agent', id: principal.conversationId, taskId: 'task_1' } };
    },
    confirm: async (_access: unknown, request: ToolConfirmation) => {
      confirmed.push(request);
      return { mode: 'auto', risk: toolRisk(request), decidedBy: 'auto' };
    },
    saveRoot: () => root,
  } as unknown as ToolScope;
  return { scope, confirmed };
}

const principal = { kind: 'agent', conversationId: 'conv_1' } as unknown as AgentPrincipal;

describe('downloads_save', () => {
  it('after copying, registered as a Space deliverable: real path in download directory, byte count, content digest, and submitter; registration failure does not affect the result', async () => {
    await fs.writeFile(path.join(root, 'post.md'), '# 你好\n');
    const { scope } = fakeScope();
    const handovers: DownloadHandover[] = [];
    const tools = new DownloadTools({ scope, downloadsDirectory: () => downloads, register: async (handover) => void handovers.push(handover) });
    const saved = (await tools.dispatch('downloads_save', { path: 'post.md' }, principal)) as Record<string, unknown>;
    const expected = `sha256:${createHash('sha256').update('# 你好\n').digest('hex')}`;
    expect(handovers).toEqual([
      { path: path.join(downloads, 'post.md'), bytes: saved.bytes, artifactId: expected, submitter: { kind: 'agent', id: 'conv_1', taskId: 'task_1' }, at: expect.any(String) },
    ]);

    const failing = new DownloadTools({ scope, downloadsDirectory: () => downloads, register: () => Promise.reject(new Error('space not ready')) });
    const second = (await failing.dispatch('downloads_save', { path: 'post.md' }, principal)) as Record<string, unknown>;
    expect(second.path).toBe(path.join(downloads, 'post-2.md'));
  });

  it('copy to download directory (created if missing); name collisions get a sequence number, no overwrite; risk command, written only after confirmation', async () => {
    await fs.mkdir(path.join(root, 'out'));
    await fs.writeFile(path.join(root, 'out', 'talk.zh-Hans.srt'), '1\n00:00:00,000 --> 00:00:01,000\n你好\n');
    const { scope, confirmed } = fakeScope();
    const tools = new DownloadTools({ scope, downloadsDirectory: () => downloads });

    const first = (await tools.dispatch('downloads_save', { path: 'out/talk.zh-Hans.srt' }, principal)) as Record<string, unknown>;
    const target = path.join(downloads, 'talk.zh-Hans.srt');
    expect(first).toMatchObject({ path: target, bytes: 39, approval: { risk: 'command' } });
    expect(first.next).toContain('Tell the user');
    expect(await fs.readFile(target, 'utf8')).toContain('你好');
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({ tool: 'downloads_save', targets: [target] });
    expect(TOOL_RISK.downloads_save).toBe('command');

    // A file with the same name exists: do not overwrite; add a sequence number.
    await fs.writeFile(target, 'user edited');
    const second = (await tools.dispatch('downloads_save', { path: 'out/talk.zh-Hans.srt' }, principal)) as Record<string, unknown>;
    expect(second.path).toBe(path.join(downloads, 'talk.zh-Hans-2.srt'));
    expect(await fs.readFile(target, 'utf8')).toBe('user edited');

    // name is given: sanitised; the extension is kept from the source file.
    const named = (await tools.dispatch('downloads_save', { path: 'out/talk.zh-Hans.srt', name: '../../-字幕:中文' }, principal)) as Record<
      string,
      unknown
    >;
    expect(named.path).toBe(path.join(downloads, '字幕 中文.srt'));
  });

  it('rejected without an approval: absolute paths, .., symbolic links (files and directories), directories, nonexistent, video directories and .ccut, over the limit', async () => {
    const outside = path.join(tmp, 'secret.txt');
    await fs.writeFile(outside, 'secret');
    await fs.symlink(outside, path.join(root, 'link.txt'));
    await fs.symlink(tmp, path.join(root, 'up'));
    await fs.mkdir(path.join(root, 'dir'));
    await fs.mkdir(path.join(root, 'clip', 'blobs'), { recursive: true });
    await fs.writeFile(path.join(root, 'clip', 'video.db'), '');
    await fs.writeFile(path.join(root, 'clip', 'blobs', 'a.bin'), 'x');
    await fs.mkdir(path.join(root, '.ccut'));
    await fs.writeFile(path.join(root, '.ccut', 'state.json'), '{}');
    await fs.writeFile(path.join(root, 'big.txt'), 'x'.repeat(100));

    const { scope, confirmed } = fakeScope();
    const tools = new DownloadTools({ scope, downloadsDirectory: () => downloads });
    const save = (args: Record<string, unknown>) => rejected(tools.dispatch('downloads_save', args, principal));
    expect(await save({ path: outside })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await save({ path: '../secret.txt' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await save({ path: 'dir/../../secret.txt' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await save({ path: 'link.txt' })).toBe('PATH_IS_SYMLINK');
    expect(await save({ path: 'up/secret.txt' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await save({ path: 'dir' })).toBe('NOT_A_FILE');
    expect(await save({ path: '.' })).toBe('PATH_OUTSIDE_WORKSPACE');
    expect(await save({ path: 'missing.txt' })).toBe('FILE_NOT_FOUND');
    expect(await save({ path: 'clip/video.db' })).toBe('PATH_INSIDE_VIDEO');
    expect(await save({ path: 'clip/blobs/a.bin' })).toBe('PATH_INSIDE_VIDEO');
    expect(await save({ path: '.ccut/state.json' })).toBe('PATH_INSIDE_VIDEO');
    expect(await rejected(prepareDownloadSave({ root, path: 'big.txt', downloadsDir: downloads, maxBytes: 10 }))).toBe('FILE_TOO_LARGE');
    expect(confirmed).toHaveLength(0);
    await expect(fs.stat(downloads)).rejects.toThrow();

    // Plan mode (read-only): write operations are rejected at authorization.
    const plan = new DownloadTools({ scope: fakeScope(false).scope, downloadsDirectory: () => downloads });
    expect(await rejected(plan.dispatch('downloads_save', { path: 'big.txt' }, principal))).toBe('PLAN_ONLY');
  });

  it('a symlink with the same name already in the download directory: not followed, not overwritten, next sequence number used', async () => {
    await fs.writeFile(path.join(root, 'notes.txt'), 'mine');
    await fs.mkdir(downloads);
    const victim = path.join(tmp, 'victim.txt');
    await fs.writeFile(victim, 'keep');
    await fs.symlink(victim, path.join(downloads, 'notes.txt'));
    const plan = await prepareDownloadSave({ root, path: 'notes.txt', downloadsDir: downloads });
    const saved = await plan.commit();
    expect(saved).toMatchObject({ path: path.join(downloads, 'notes-2.txt'), bytes: 4 });
    expect(await fs.readFile(victim, 'utf8')).toBe('keep');
  });

  it('source replaced with a symlink after the check: rejected', async () => {
    await fs.writeFile(path.join(root, 'notes.txt'), 'mine');
    const plan = await prepareDownloadSave({ root, path: 'notes.txt', downloadsDir: downloads });
    await fs.rm(path.join(root, 'notes.txt'));
    await fs.writeFile(path.join(tmp, 'secret.txt'), 'secret');
    await fs.symlink(path.join(tmp, 'secret.txt'), path.join(root, 'notes.txt'));
    expect(await rejected(plan.commit())).toBe('PATH_IS_SYMLINK');
  });

  it('file name: separators, control characters, and leading . and - removed; extension inherited from source; the full name including extension is at most 120 characters', () => {
    expect(downloadFileName('talk.zh-Hans', '.srt')).toBe('talk.zh-Hans.srt');
    expect(downloadFileName('talk.SRT', '.srt')).toBe('talk.SRT');
    expect(downloadFileName('.hidden', '.txt')).toBe('hidden.txt');
    expect(downloadFileName('-rf', '.txt')).toBe('rf.txt');
    expect(downloadFileName('a/b\\c\u0000d', '.txt')).toBe('a b c d.txt');
    expect(downloadFileName('..', '.txt')).toBe('download.txt');
    expect(downloadFileName('.srt', '.srt')).toBe('srt.srt');
    expect(downloadFileName('notes', '')).toBe('notes');
    expect(downloadFileName('notes', '.weird ext')).toBe('notes');
    const long = downloadFileName('长'.repeat(300), '.srt');
    expect([...long]).toHaveLength(120);
    expect(long.endsWith('.srt')).toBe(true);
  });
});

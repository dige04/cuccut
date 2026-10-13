import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { newId, type Id, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { ToolDriver, tool, until, type ToolSession } from './testing/fake-agent.ts';

/**
 * End to end: the scope of task contract protection (architecture §3.2). A fake agent reads the contract and modifies the video through the real MCP endpoint, and the checks land in the real Rust engine:
 * agent edits that touch the protection are rejected as a whole (`TASK_PROTECTED`); the user's edits are not restricted; submissions after the contract is changed are checked against the new scope.
 * Needs engine-host and ffmpeg; skipped if missing.
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!engine || !ffmpeg)('task contract tools and protection scope (real engine)', () => {
  let fixtures: string;
  let clip: string;
  let dir: string;
  let runtime: RunningRuntime;
  let driver: ToolDriver;
  let client: CucCutClient;
  let project: Project;
  let conversationId: Id;
  let videoId: Id;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-fixtures-'));
    clip = path.join(fixtures, 'clip.mp4');
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=2'],
      ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', clip],
    ]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-test-'));
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '合同测试' }));
    await fs.copyFile(clip, path.join(project.path, 'clip.mp4'));
    videoId = (await client.request('videos.create', { projectId: project.id, name: '样片' })).ref.videoId;
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
  });

  afterEach(async () => {
    client.close();
    await runtime.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  function items() {
    const video = runtime.videos.mirror(videoId)!.video;
    return video.sequences[video.rootSequenceId]!.items;
  }

  /** The agent places two clips (at 0 s and 3 s) and returns the two clips' instance IDs and the later version. */
  async function placeTwo(session: ToolSession): Promise<{ first: Id; second: Id; revision: string }> {
    const inspected = await tool(session, 'videos_inspect', { video: videoId });
    const applied = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: inspected.body.revision,
      label: '放两段',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'c' },
        { type: 'addItem', asset: { ref: 'c' }, at: 0 },
        { type: 'addItem', asset: { ref: 'c' }, at: 3 },
      ],
    });
    expect(applied.isError).toBe(false);
    const videos = items().filter((item) => item.type === 'video');
    const first = videos.find((item) => item.span.fromFrame === 0)!.id;
    const second = videos.find((item) => item.span.fromFrame === 90)!.id;
    return { first, second, revision: applied.body.revision.after };
  }

  it('agent reads its own contract; modification touching protection is rejected whole and lists protected items; user\'s modifications unrestricted; after contract change, checked against new scope', async () => {
    const { taskId } = await client.request('tasks.create', {
      conversationId,
      goal: '剪一版',
      commandId: newId('cmd'),
      accessMode: 'auto',
      contract: { acceptanceChecks: [{ kind: 'review', description: '两段都在', required: true }] },
    });
    const session = await until(() => driver.sessions[0]);
    await until(() => session.turnId);

    // Read the contract: the default contract plus the given checks.
    const read = await tool(session, 'tasks_contract', {});
    expect(read.isError).toBe(false);
    expect(read.body).toMatchObject({
      contract: { taskId, revision: 1, autonomy: 'auto', protectedRefs: [], acceptanceChecks: [{ description: '两段都在' }] },
      latestRevision: 1,
      checkResults: [],
    });

    const { first, second } = await placeTwo(session);

    // The user protects the first clip: entity protection and range protection (the 3–5 s where the second clip sits).
    const view = await client.request('tasks.getContract', { taskId });
    const sequenceId = runtime.videos.mirror(videoId)!.video.rootSequenceId;
    const { contract } = await client.request('tasks.updateContract', {
      taskId,
      expectedRevision: view.contract.revision,
      commandId: newId('cmd'),
      patch: {
        protectedRefs: [
          { videoId, target: { kind: 'entity', entityId: first }, note: '片头' },
          { videoId, target: { kind: 'interval', sequenceId, span: { fromFrame: 90, durationFrames: 60 } } },
        ],
      },
    });
    expect(contract.revision).toBe(2);
    const [entityProtection, intervalProtection] = contract.protectedRefs;

    // The agent deletes the first clip: the whole transaction is rejected; the error names the protection and entity that were touched; the video is unchanged.
    const before = items().length;
    const revision = runtime.videos.mirror(videoId)!.video.revision;
    const refused = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: revision,
      label: '删掉片头',
      operations: [{ type: 'deleteItems', itemIds: [first] }],
    });
    expect(refused.isError).toBe(true);
    expect(refused.body.error).toMatchObject({
      code: 'TASK_PROTECTED',
      entityIds: [first],
      details: {
        protections: [{ protectionId: entityProtection!.protectionId, target: { kind: 'entity', entityId: first }, entityIds: [first] }],
      },
      next: expect.stringContaining('protectedRefs'),
    });
    // Range protection: moving the second clip is rejected too.
    const moved = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: revision,
      label: '挪第二段',
      operations: [{ type: 'moveItem', itemId: second, at: 6 }],
    });
    expect(moved.body.error).toMatchObject({
      code: 'TASK_PROTECTED',
      details: { protections: [{ protectionId: intervalProtection!.protectionId }] },
    });
    // Undoing the two clips the agent placed also touches the protection.
    const undo = await tool(session, 'edits_undo', { video: videoId });
    expect(undo.body.error).toMatchObject({ code: 'TASK_PROTECTED' });
    expect(items()).toHaveLength(before);
    expect(runtime.videos.mirror(videoId)!.video.revision).toBe(revision);

    // The agent cannot remove the protection itself.
    const unprotect = await tool(session, 'tasks_update_contract', { expectedRevision: 2, patch: { protectedRefs: [] } });
    expect(unprotect.body.error).toMatchObject({ code: 'CONTRACT_FIELD_READONLY', fields: ['protectedRefs'] });

    // The user's edits are not restricted by the task protection.
    await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: revision,
      operations: [{ type: 'deleteItems', sequenceId, itemIds: [second] }],
    });
    await until(() => items().length === before - 1);

    // After the user removes the protection, the agent's later submissions are checked against the new scope.
    await client.request('tasks.updateContract', { taskId, expectedRevision: 2, commandId: newId('cmd'), patch: { protectedRefs: [] } });
    const allowed = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: runtime.videos.mirror(videoId)!.video.revision,
      label: '删掉片头',
      operations: [{ type: 'deleteItems', itemIds: [first] }],
    });
    expect(allowed.isError).toBe(false);

    // Records the check result, marked as recorded by the agent.
    const checkId = read.body.contract.acceptanceChecks[0].checkId;
    const recorded = await tool(session, 'tasks_record_check', { checkId, outcome: 'failed', note: '片头被删了' });
    expect(recorded.body.result).toMatchObject({ checkId, outcome: 'failed', recordedBy: 'agent', contractRevision: 3 });
    expect((await client.request('tasks.listChecks', { taskId })).results).toHaveLength(1);
  });

  it('modifications not in a task (UI) and tasks without protection submit as usual', async () => {
    const { taskId } = await client.request('tasks.create', {
      conversationId,
      goal: '放素材',
      commandId: newId('cmd'),
      accessMode: 'auto',
    });
    const session = await until(() => driver.sessions[0]);
    await until(() => session.turnId);
    const { first } = await placeTwo(session);
    // Protects the whole video: every agent edit is rejected.
    await client.request('tasks.updateContract', {
      taskId,
      expectedRevision: 1,
      commandId: newId('cmd'),
      patch: { protectedRefs: [{ videoId, target: { kind: 'video' } }] },
    });
    const refused = await tool(session, 'edits_apply', {
      video: videoId,
      expectedRevision: runtime.videos.mirror(videoId)!.video.revision,
      label: '删',
      operations: [{ type: 'deleteItems', itemIds: [first] }],
    });
    expect(refused.body.error.code).toBe('TASK_PROTECTED');
    // Other videos are not affected by this protection: protection is handed to the engine per video.
    const other = (await client.request('videos.create', { projectId: project.id, name: '另一个' })).ref.videoId;
    const inspected = await tool(session, 'videos_inspect', { video: other });
    const elsewhere = await tool(session, 'edits_apply', {
      video: other,
      expectedRevision: inspected.body.revision,
      label: '放',
      operations: [
        { type: 'importAsset', path: 'clip.mp4', ref: 'c' },
        { type: 'addItem', asset: { ref: 'c' }, at: 0 },
      ],
    });
    expect(elsewhere.isError).toBe(false);
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Id, PublicationDetail } from '@cuccut/protocol';
import { HUMAN, publishingFixture, type PublishingFixture } from '../publishing/testing/fake-publishing.ts';
import { PublishingTools } from './publishing-tools.ts';
import { ToolError } from './tool-catalog.ts';
import { TOOL_RISK, toolRisk, type ToolConfirmation, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Publishing tools (design m2-publishing §5, §7 "Tools"): a fake scope records confirmations and decides which videos the caller sees; the service is
 * the real `PublishingService` over a store in a temporary directory.
 */

let root: string;
let fx: PublishingFixture;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-tools-'));
  fx = await publishingFixture(root);
  fx.videos.add({ videoId: 'video_2', name: 'Other project clip', projectId: 'proj_2' });
});

afterEach(async () => {
  await fx.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

const AGENT = { kind: 'agent', conversationId: 'conv_1', connectionId: 'agent:conv_1', name: 'Claude Code' } as unknown as ToolPrincipal;
const LOCAL = { kind: 'local', connectionId: 'cli-1', name: 'cuccut', client: 'cli', cwd: '', projectDir: null } as unknown as ToolPrincipal;

interface FakeScope {
  scope: ToolScope;
  confirmed: ToolConfirmation[];
}

/** A scope that sees only `visible` videos (by id or by the path `<id>.cuccut`), allows writes unless `write` is false, and approves every call. */
function fakeScope(visible: Id[] = ['video_1'], options: { write?: boolean } = {}): FakeScope {
  const confirmed: ToolConfirmation[] = [];
  const scope = {
    authorize: (principal: ToolPrincipal, wants: boolean) => {
      if (wants && options.write === false) throw new ToolError('PLAN_ONLY', 'plan mode');
      return { principal, submitter: { kind: 'agent', id: 'conv_1', taskId: 'task_1' } };
    },
    confirm: async (_access: unknown, request: ToolConfirmation) => {
      confirmed.push(request);
      return { mode: 'auto', risk: toolRisk(request), decidedBy: 'auto' };
    },
    videoIdOf: async (video: string) => {
      const id = video.replace(/\.cuccut$/, '');
      if (!visible.includes(id)) throw new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found`);
      return id;
    },
    visibleVideoIds: async (_access: unknown, ids: readonly Id[]) => new Set(ids.filter((id) => visible.includes(id))),
    visibleJob: async (jobId: Id) => fx.jobs.inspect(jobId),
    fileBase: () => root,
  } as unknown as ToolScope;
  return { scope, confirmed };
}

function toolsFor(scope: ToolScope): PublishingTools {
  return new PublishingTools({ publishing: fx.service, scope });
}

async function call(tools: PublishingTools, name: string, args: unknown, principal: ToolPrincipal = AGENT): Promise<Record<string, unknown>> {
  const parsed = (tools.schemas as Record<string, z.ZodType>)[name]!.parse(args);
  return (await tools.dispatch(name, parsed, principal)) as Record<string, unknown>;
}

async function refused(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ToolError) return error.code;
    throw error;
  }
  throw new Error('expected a refusal');
}

/** A publication of video_1 with text, a pinned export and an owner's approval. */
async function ready(): Promise<PublicationDetail> {
  let [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
  p = await fx.service.update(
    {
      publicationId: p!.id,
      revision: p!.revision,
      patch: { copy: { title: 'Launch day', description: 'We shipped it', hashtags: ['launch'] } },
    },
    HUMAN,
  );
  const { jobId } = await fx.jobs.finishedExport(`mp4 ${p.id}`);
  p = (await fx.service.pin(p.id, p.revision, { jobId }, HUMAN)).publication;
  return fx.service.approve(p.id, p.revision, HUMAN);
}

describe('publishing tools', () => {
  it('every tool has a fixed risk: approve and send are high, reads are read', () => {
    const tools = toolsFor(fakeScope().scope);
    for (const name of Object.keys(tools.schemas)) expect(TOOL_RISK[name], name).toBeDefined();
    expect(TOOL_RISK.publications_send).toBe('high');
    expect(TOOL_RISK.publications_approve).toBe('high');
    expect(TOOL_RISK.publications_import_calendar).toBe('high');
    expect(TOOL_RISK.publications_list).toBe('read');
    expect(tools.definitions.publications_send!.surfaces).not.toContain('mcp');
    expect(tools.definitions.publications_export_calendar!.surfaces).toEqual(['cli']);
  });

  it('prepares from visible videos only, confirming with the edit risk', async () => {
    const { scope, confirmed } = fakeScope();
    const tools = toolsFor(scope);
    const result = await call(tools, 'publications_prepare', { videos: ['video_1.cuccut'], accounts: ['acc_yt'] });
    const [p] = result.publications as Array<{ publication: Id; destinations: Array<{ network: string; format: string; captionLimit: number }> }>;
    expect(p!.destinations).toEqual([expect.objectContaining({ network: 'youtube', format: 'youtube-short', captionLimit: 5000 })]);
    expect(confirmed.map((c) => [c.tool, toolRisk(c)])).toEqual([['publications_prepare', 'edit']]);
    expect(confirmed[0]!.summaryRef?.key).toBe('rcAgentTools.publicationsPrepareSummary');
    expect(fx.service.store.publication(p!.publication)?.videoId).toBe('video_1');
    expect(await refused(call(tools, 'publications_prepare', { videos: ['video_2'] }))).toBe('VIDEO_NOT_FOUND');
  });

  it('a publication of a video outside the scope is answered like a missing one and left out of lists', async () => {
    const [mine] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const [other] = await fx.service.prepare({ videoIds: ['video_2'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope(['video_1']).scope);
    const list = await call(tools, 'publications_list', { from: '2026-10-01', to: '2026-10-31' });
    expect((list.publications as Array<{ publication: Id }>).map((row) => row.publication)).toEqual([mine!.id]);
    expect(list.total).toBe(1);
    expect(list.accounts).toHaveLength(2);
    expect(list.schedule).toMatchObject({ timezone: 'UTC' });
    expect(await refused(call(tools, 'publications_inspect', { publication: other!.id }))).toBe('PUBLICATION_NOT_FOUND');
    expect(await refused(call(tools, 'publications_inspect', { publication: 'pub_missing' }))).toBe('PUBLICATION_NOT_FOUND');
    expect(await refused(call(tools, 'publications_archive', { publication: other!.id, revision: other!.revision }))).toBe('PUBLICATION_NOT_FOUND');
    const inspected = await call(tools, 'publications_inspect', { publication: mine!.id });
    expect(inspected).toMatchObject({ publication: mine!.id, status: 'draft', authorizedToSend: false, limits: { titleCharacters: 100 } });
    expect((inspected.issues as Array<{ code: string; message: string }>).map((i) => i.code)).toContain('exportRequired');
  });

  it('filters by video and paginates after the visibility filter', async () => {
    await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_yt'], repeat: true }, HUMAN);
    await fx.service.prepare({ videoIds: ['video_2'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope(['video_1', 'video_2']).scope);
    const first = await call(tools, 'publications_list', { video: 'video_1', limit: 1 });
    expect(first).toMatchObject({ total: 2, nextOffset: 1 });
    const second = await call(tools, 'publications_list', { video: 'video_1', limit: 1, offset: 1 });
    expect(second).toMatchObject({ total: 2, nextOffset: null });
  });

  it('updates text (merging fields, normalizing hashtags) and refuses a stale revision with a next step', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope().scope);
    const updated = await call(tools, 'publications_update', { publication: p!.id, revision: p!.revision, copy: { hashtags: ['#launch', 'launch', 'video'] } });
    expect(updated.copy).toEqual({ title: 'Launch clip', description: '', hashtags: ['launch', 'video'] });
    try {
      await call(tools, 'publications_update', { publication: p!.id, revision: p!.revision, label: 'Again' });
      throw new Error('expected a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).code).toBe('PUBLICATION_CONFLICT');
      expect((error as ToolError).extra).toMatchObject({ revision: updated.revision, next: expect.stringContaining('publications_inspect') });
    }
  });

  it('plans slots without writing, then reserves them', async () => {
    await fx.service.saveSettings({ ...fx.service.store.settings(), slots: [{ weekday: 2, time: '18:00' }] }, HUMAN);
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const { scope, confirmed } = fakeScope();
    const tools = toolsFor(scope);
    const plan = await call(tools, 'publications_slots', { publications: [p!.id] });
    expect(plan.placements).toEqual([{ publication: p!.id, at: '2026-10-13T18:00:00.000Z' }]);
    expect(fx.service.store.publication(p!.id)?.scheduledAt).toBeNull();
    expect(confirmed).toEqual([]);
    const reserved = await call(tools, 'publications_reserve', { publications: [p!.id], revisions: { [p!.id]: p!.revision } });
    expect((reserved.publications as Array<{ scheduledAt: string }>)[0]!.scheduledAt).toBe('2026-10-13T18:00:00.000Z');
    expect(confirmed.map((c) => c.tool)).toEqual(['publications_reserve']);
  });

  it('reschedules and maps service refusals to their codes', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope().scope);
    const moved = await call(tools, 'publications_reschedule', {
      publication: p!.id,
      revision: p!.revision,
      placements: [{ destinationId: p!.destinations[0]!.id, at: '2026-10-20T09:00:00+02:00' }],
    });
    expect((moved.destinations as Array<{ at: string }>)[0]!.at).toBe('2026-10-20T09:00:00+02:00');
    expect(
      await refused(
        call(tools, 'publications_reschedule', { publication: p!.id, revision: moved.revision, placements: [{ destinationId: 'pdest_x', at: null }] }),
      ),
    ).toBe('DESTINATION_NOT_FOUND');
  });

  it('pins a finished export of the video, or renders and pins', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const { scope, confirmed } = fakeScope();
    const tools = toolsFor(scope);
    const render = await call(tools, 'publications_pin', { publication: p!.id, revision: p!.revision });
    expect(render.jobId).toBe(fx.jobs.exportRequests[0]!.jobId);
    expect(fx.jobs.exportRequests[0]!.submitter).toEqual({ kind: 'agent', id: 'conv_1', taskId: 'task_1' });
    const { jobId } = await fx.jobs.finishedExport('mp4 bytes');
    const pinned = await call(tools, 'publications_pin', { publication: p!.id, revision: (render.publication as { revision: number }).revision, job: jobId });
    expect((pinned.publication as { export: { jobId: Id } }).export.jobId).toBe(jobId);
    expect(confirmed.map((c) => c.summaryRef?.key)).toEqual(['rcAgentTools.publicationsPinSummary', 'rcAgentTools.publicationsPinSummary']);
  });

  it('stores a text proposal without applying it', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope().scope);
    const result = await call(tools, 'publications_propose_copy', {
      publication: p!.id,
      revision: p!.revision,
      copy: { title: 'New title', description: 'New caption', hashtags: ['#tips'] },
      reason: 'From the transcript',
    });
    expect(result.proposal).toEqual({ revision: p!.revision, copy: { title: 'New title', description: 'New caption', hashtags: ['tips'] }, reason: 'From the transcript' });
    expect(result.copy).toEqual(p!.copy);
  });

  it('approves as the agent with the high risk', async () => {
    let [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const { jobId } = await fx.jobs.finishedExport('mp4 bytes');
    p = (await fx.service.pin(p!.id, p!.revision, { jobId }, HUMAN)).publication;
    const { scope, confirmed } = fakeScope();
    const result = await call(toolsFor(scope), 'publications_approve', { publication: p.id, revision: p.revision });
    expect(result).toMatchObject({ approved: true, exportApproval: { by: 'agent', actor: 'Claude Code' } });
    expect(toolRisk(confirmed[0]!)).toBe('high');
  });

  it('send without the owner\'s authorization is refused before anyone is asked; with it, the account waits for the owner', async () => {
    const p = await ready();
    const { scope, confirmed } = fakeScope();
    const tools = toolsFor(scope);
    expect(await refused(call(tools, 'publications_send', { publication: p.id, revision: p.revision, confirmed: true }))).toBe('AUTHORIZATION_REQUIRED');
    expect(confirmed).toEqual([]);
    const authorized = await fx.service.authorize(p.id, p.revision, HUMAN);
    const sent = await call(tools, 'publications_send', { publication: p.id, revision: authorized.revision, confirmed: true });
    expect((sent.destinations as Array<{ state: string }>)[0]!.state).toBe('queued');
    expect(confirmed.map((c) => [c.tool, toolRisk(c), c.summaryRef?.key])).toEqual([['publications_send', 'high', 'rcAgentTools.publicationsSendSummary']]);
    // Any change after the authorization voids it: a second send of a stale revision is refused.
    expect(await refused(call(tools, 'publications_send', { publication: p.id, revision: authorized.revision, confirmed: true }))).toBe('PUBLICATION_CONFLICT');
    const withdrawn = await call(tools, 'publications_withdraw', { publication: p.id, revision: sent.revision, destination: p.destinations[0]!.id });
    expect((withdrawn.destinations as Array<{ state: string }>)[0]!.state).toBe('not_sent');
    expect(await refused(call(tools, 'publications_send', { publication: p.id, revision: withdrawn.revision, confirmed: true }))).toBe('AUTHORIZATION_REQUIRED');
  });

  it('archives and restores through publications_update archived: false', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope().scope);
    const archived = await call(tools, 'publications_archive', { publication: p!.id, revision: p!.revision });
    expect(archived).toMatchObject({ archived: true, next: expect.stringContaining('archived: false') });
    expect(await refused(call(tools, 'publications_update', { publication: p!.id, revision: archived.revision, label: 'x' }))).toBe('PUBLICATION_ARCHIVED');
    const restored = await call(tools, 'publications_update', { publication: p!.id, revision: archived.revision, archived: false, label: 'Back' });
    expect(restored).toMatchObject({ archived: false, label: 'Back' });
  });

  it('plan mode refuses writes but allows reads', async () => {
    const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope(['video_1'], { write: false }).scope);
    await expect(call(tools, 'publications_inspect', { publication: p!.id })).resolves.toMatchObject({ publication: p!.id });
    expect(await refused(call(tools, 'publications_update', { publication: p!.id, revision: p!.revision, label: 'x' }))).toBe('PLAN_ONLY');
  });

  it('the command line exports the calendar to a file and imports one (preview first)', async () => {
    await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
    const tools = toolsFor(fakeScope().scope);
    const exported = await call(tools, 'publications_export_calendar', { file: 'calendar.json' }, LOCAL);
    expect(exported).toMatchObject({ path: path.join(root, 'calendar.json'), publications: 1 });
    expect(await refused(call(tools, 'publications_export_calendar', { file: 'calendar.json' }, LOCAL))).toBe('FILE_EXISTS');
    const preview = await call(tools, 'publications_import_calendar', { file: 'calendar.json', dryRun: true }, LOCAL);
    expect(preview.preview).toMatchObject({ total: 1, added: 0, skipped: 1 });
    // An agent is not allowed to transfer (the tools are on the command line only; the service refuses an agent too).
    expect(await refused(call(tools, 'publications_export_calendar', {}, AGENT))).toBe('TRANSFER_NOT_ALLOWED');
    await fs.writeFile(path.join(root, 'broken.json'), '{nope');
    expect(await refused(call(tools, 'publications_import_calendar', { file: 'broken.json' }, LOCAL))).toBe('CALENDAR_INVALID');
  });
});

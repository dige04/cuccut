import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WEB_DEFAULT_METHODS, WEB_READ_METHODS, WEB_TOPIC_METHODS, methodMatches, type MediaHandle, type RpcMethod } from '@cuccut/protocol';
import { methodParamSchemas } from '@cuccut/protocol/schemas';
import type { TrustedPrincipal } from '../gateway.ts';
import { publishingActor, publishingMethods } from './publishing-methods.ts';
import { codeOf, publishingFixture, type PublishingFixture } from './testing/fake-publishing.ts';

let root: string;
let fx: PublishingFixture;
let issued: Array<{ root: string; target: string }>;
let methods: ReturnType<typeof publishingMethods>;

const principal = (kind: TrustedPrincipal['kind'], name: string = kind): TrustedPrincipal => ({ connectionId: `c-${kind}`, kind, name });
const DESKTOP = principal('desktop', 'CucCut desktop');
const BROWSER = principal('web');
const AGENT = principal('agent', 'Claude Code');
const CLI = principal('cli');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-methods-'));
  fx = await publishingFixture(root);
  issued = [];
  methods = publishingMethods({
    publishing: fx.service,
    media: {
      issue: async (dir: string, target: string): Promise<MediaHandle> => {
        issued.push({ root: dir, target });
        return { url: `media://${target}`, mimeType: 'video/mp4', size: 1, fileName: target, expiresAt: '2026-10-14T00:00:00.000Z' };
      },
    },
  });
});

afterEach(async () => {
  await fx.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

const PUBLISHING_METHODS = Object.keys(methodParamSchemas).filter((m) => m.startsWith('publishing.')) as RpcMethod[];

describe('publishing methods', () => {
  it('every method has a strict param schema and a handler', () => {
    expect(PUBLISHING_METHODS.length).toBeGreaterThan(25);
    expect(Object.keys(methods).sort()).toEqual([...PUBLISHING_METHODS].sort());
    for (const method of PUBLISHING_METHODS) {
      const schema = methodParamSchemas[method] as { safeParse(value: unknown): { success: boolean } };
      expect(schema.safeParse({ unexpected: true }).success, method).toBe(false);
    }
  });

  it('checks params at the edge', () => {
    const parse = (method: RpcMethod, value: unknown) => (methodParamSchemas[method] as { safeParse(v: unknown): { success: boolean } }).safeParse(value).success;
    const reconcile = { publicationId: 'pub_1', revision: 1, destinationId: 'd', state: 'published', remoteUrl: 'https://youtu.be/x', at: null, note: 'Checked on YouTube' };
    expect(parse('publishing.reconcile', reconcile)).toBe(true);
    expect(parse('publishing.reconcile', { ...reconcile, note: '   short   ' })).toBe(false);
    expect(parse('publishing.reconcile', { ...reconcile, remoteUrl: 'javascript:alert(1)' })).toBe(false);
    expect(parse('publishing.reconcile', { ...reconcile, state: 'sending' })).toBe(false);
    expect(parse('publishing.calendar', { from: '2026-10-01', to: '2026-10-31' })).toBe(true);
    expect(parse('publishing.calendar', { from: '2026-13-01', to: '2026-10-31' })).toBe(false);
    expect(parse('publishing.pin', { publicationId: 'p', revision: 0, source: { render: true } })).toBe(true);
    expect(parse('publishing.pin', { publicationId: 'p', revision: 0, source: { render: false } })).toBe(false);
    expect(parse('publishing.transfer.apply', { archive: { anything: 1 } })).toBe(true);
    expect(parse('publishing.cleanup', {})).toBe(true);
  });

  it('turns the connection into the actor the service checks', () => {
    expect(publishingActor(DESKTOP)).toEqual({ kind: 'human', name: 'CucCut desktop', submitter: { kind: 'connection', id: 'c-desktop' } });
    expect(publishingActor(BROWSER).kind).toBe('web');
    expect(publishingActor(CLI).kind).toBe('cli');
    expect(publishingActor(principal('local')).kind).toBe('cli');
    expect(publishingActor(AGENT).kind).toBe('agent');
    expect(publishingActor(principal('service')).kind).toBe('agent');
  });

  it('runs a by-hand delivery end to end through the handlers', async () => {
    const { publications } = await methods['publishing.prepare']({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, BROWSER);
    let p = publications[0]!;
    p = await methods['publishing.update']({ publicationId: p.id, revision: p.revision, patch: { copy: { title: 't', description: 'Caption', hashtags: [] } } }, BROWSER);
    const { jobId } = await fx.jobs.finishedExport('clip');
    expect((await methods['publishing.exports']({ videoId: 'video_1' }, BROWSER)).exports.map((e) => e.jobId)).toEqual([jobId]);
    p = (await methods['publishing.pin']({ publicationId: p.id, revision: p.revision, source: { jobId } }, BROWSER)).publication;
    p = await methods['publishing.approve']({ publicationId: p.id, revision: p.revision }, AGENT);
    expect(p.approval).toMatchObject({ by: 'agent', actor: 'Claude Code' });
    expect((await methods['publishing.validate']({ publicationId: p.id }, AGENT)).issues).toEqual([]);

    expect(await codeOf(Promise.resolve().then(() => methods['publishing.authorize']({ publicationId: p.id, revision: p.revision }, AGENT)))).toBe('OWNER_REQUIRED');
    expect(await codeOf(Promise.resolve().then(() => methods['publishing.send']({ publicationId: p.id, revision: p.revision, confirmed: true }, BROWSER)))).toBe('OWNER_REQUIRED');
    expect(await codeOf(Promise.resolve().then(() => methods['publishing.send']({ publicationId: p.id, revision: p.revision, confirmed: true }, AGENT)))).toBe(
      'AUTHORIZATION_REQUIRED',
    );
    const { results } = await methods['publishing.batch']({ action: 'authorize', items: [{ publicationId: p.id, revision: p.revision }], confirmed: true }, DESKTOP);
    expect(results[0]).toMatchObject({ ok: true });
    p = results[0]!.publication!;
    p = await methods['publishing.send']({ publicationId: p.id, revision: p.revision, confirmed: true }, AGENT);
    expect(p.destinations[0]!.state).toBe('queued');

    const handle = await methods['publishing.openHandle']({ publicationId: p.id }, BROWSER);
    expect(issued).toEqual([{ root: path.join(fx.dir, 'exports'), target: `${p.export!.sha256}.mp4` }]);
    expect(handle.fileName).toBe(`${p.export!.sha256}.mp4`);

    expect(await codeOf(Promise.resolve().then(() => methods['publishing.reconcile'](
      { publicationId: p.id, revision: p.revision, destinationId: p.destinations[0]!.id, state: 'published', remoteUrl: null, at: null, note: 'Posted it myself' },
      AGENT,
    )))).toBe('OWNER_REQUIRED');
    const done = await methods['publishing.reconcile'](
      { publicationId: p.id, revision: p.revision, destinationId: p.destinations[0]!.id, state: 'published', remoteUrl: null, at: null, note: 'Posted it myself' },
      DESKTOP,
    );
    expect(done.destinations[0]!.state).toBe('published');
    expect((await methods['publishing.get']({ publicationId: p.id }, BROWSER)).revision).toBe(done.revision);
    expect((await methods['publishing.calendar']({ from: '2026-10-01', to: '2026-10-31' }, BROWSER)).total).toBe(1);
  });

  it('settings from the browser; connections, accounts and transfer from the desktop app', async () => {
    const settings = await methods['publishing.settings.save']({ settings: { ...fx.service.store.settings(), writing: 'Plain' } }, BROWSER);
    expect(settings.writing).toBe('Plain');
    expect(await codeOf(Promise.resolve().then(() => methods['publishing.connections.save']({ provider: 'manual', name: 'x' }, CLI)))).toBe('OWNER_REQUIRED');
    const { account } = await methods['publishing.accounts.save']({ connectionId: 'conn_1', network: 'tiktok', name: 'Tok', remoteId: '@tok' }, DESKTOP);
    expect((await methods['publishing.accounts.remove']({ accountId: account.id }, DESKTOP)).account.id).toBe(account.id);
    const { archive } = await methods['publishing.transfer.export']({}, CLI);
    expect((await methods['publishing.transfer.preview']({ archive }, DESKTOP)).skipped).toBe(0);
    expect(await codeOf(Promise.resolve().then(() => methods['publishing.transfer.export']({}, AGENT)))).toBe('TRANSFER_NOT_ALLOWED');
  });
});

describe('browser allowlist', () => {
  const allowed = (method: string) => WEB_DEFAULT_METHODS.some((pattern) => methodMatches(pattern, method));

  it('lets the browser read and edit the calendar but not deliver, record results, connect accounts or transfer', () => {
    for (const method of [
      'publishing.get',
      'publishing.calendar',
      'publishing.prepare',
      'publishing.update',
      'publishing.reschedule',
      'publishing.slots',
      'publishing.pin',
      'publishing.exports',
      'publishing.approve',
      'publishing.validate',
      'publishing.withdraw',
      'publishing.archive',
      'publishing.unarchive',
      'publishing.copy.propose',
      'publishing.copy.apply',
      'publishing.openHandle',
      'publishing.settings.save',
    ]) {
      expect(allowed(method), method).toBe(true);
    }
    for (const method of [
      'publishing.authorize',
      'publishing.send',
      'publishing.batch',
      'publishing.cancel',
      'publishing.reconcile',
      'publishing.cleanup',
      'publishing.connections.save',
      'publishing.connections.remove',
      'publishing.accounts.save',
      'publishing.accounts.remove',
      'publishing.accounts.link',
      'publishing.transfer.export',
      'publishing.transfer.preview',
      'publishing.transfer.apply',
    ]) {
      expect(allowed(method), method).toBe(false);
    }
    expect(WEB_READ_METHODS.filter((m) => m.startsWith('publishing.')).sort()).toEqual(
      ['publishing.calendar', 'publishing.exports', 'publishing.get', 'publishing.openHandle', 'publishing.validate'].sort(),
    );
    expect(WEB_TOPIC_METHODS.publishing).toBe('publishing.calendar');
  });
});

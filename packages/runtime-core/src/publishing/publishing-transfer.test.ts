import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CalendarArchive, PublicationDetail } from '@cuccut/protocol';
import { AGENT, CLI, HUMAN, WEB, codeOf, publishingFixture, type PublishingFixture } from './testing/fake-publishing.ts';

let root: string;
let source: PublishingFixture;
let target: PublishingFixture;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-transfer-'));
  source = await publishingFixture(path.join(root, 'a'));
  target = await publishingFixture(path.join(root, 'b'), { accounts: false });
});

afterEach(async () => {
  await source.service.close();
  await target.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

/** On the source computer: one publication sent by hand (waiting for the owner) and one draft for a video the target does not have. */
async function calendar(): Promise<{ sent: PublicationDetail; draft: PublicationDetail; archive: CalendarArchive }> {
  const fx = source;
  fx.videos.add({ videoId: 'video_2', name: 'Second clip' });
  let [sent] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_ig'] }, HUMAN);
  sent = await fx.service.update(
    { publicationId: sent!.id, revision: sent!.revision, patch: { copy: { title: 'Hi', description: 'Caption', hashtags: [] }, scheduledAt: '2026-10-20T09:00:00.000Z' } },
    HUMAN,
  );
  const { jobId } = await fx.jobs.finishedExport('the video');
  sent = (await fx.service.pin(sent.id, sent.revision, { jobId }, HUMAN)).publication;
  sent = await fx.service.approve(sent.id, sent.revision, HUMAN);
  sent = await fx.service.send(sent.id, sent.revision, HUMAN);
  const [draft] = await fx.service.prepare({ videoIds: ['video_2'], accountIds: ['acc_yt'] }, HUMAN);
  const { archive, fileName } = fx.service.transfer.export(HUMAN);
  expect(fileName).toMatch(/\.json$/);
  return { sent, draft: draft!, archive };
}

describe('calendar transfer', () => {
  it('only the owner (desktop app or command line) transfers', async () => {
    for (const actor of [AGENT, WEB]) {
      expect(await codeOf(() => source.service.transfer.export(actor))).toBe('TRANSFER_NOT_ALLOWED');
      expect(await codeOf(() => source.service.transfer.preview({}, actor))).toBe('TRANSFER_NOT_ALLOWED');
      expect(await codeOf(source.service.transfer.apply({}, actor))).toBe('TRANSFER_NOT_ALLOWED');
    }
    expect(source.service.transfer.export(CLI).archive.format).toBeTruthy();
  });

  it('exports every publication without pinned files, approvals or frozen payloads', async () => {
    const { sent, archive } = await calendar();
    expect(archive.version).toBe(1);
    expect(archive.timezone).toBe('UTC');
    expect(archive.publications).toHaveLength(2);
    const out = archive.publications.find((p) => p.id === sent.id)!;
    expect(out).toMatchObject({ exportId: null, approval: null, authorization: null, pinJob: null });
    expect(out.destinations[0]).toMatchObject({ state: 'queued', payload: null, payloadHash: null });
    expect(archive.accounts.map((a) => a.id).sort()).toEqual(['acc_ig', 'acc_yt']);
    expect(archive.connections).toEqual([{ id: 'conn_1', provider: 'manual', name: 'By hand' }]);
  });

  it('previews and imports append-only, after a backup; in-flight deliveries become unknown', async () => {
    const { sent, draft, archive } = await calendar();
    const raw = JSON.parse(JSON.stringify(archive)) as unknown;
    const preview = target.service.transfer.preview(raw, HUMAN);
    expect(preview).toMatchObject({ total: 2, added: 2, skipped: 0, reconnect: 2, missingVideos: 1, uncertain: 1, timezone: 'UTC', firstDay: '2026-10-20' });
    expect(target.service.store.publications()).toEqual([]);

    const result = await target.service.transfer.apply(raw, CLI);
    expect(result.added.sort()).toEqual([sent.id, draft.id].sort());
    const imported = target.service.publication(sent.id);
    expect(imported.destinations[0]).toMatchObject({ state: 'unknown', errorRef: { key: 'publishingIssues.importedInFlight' } });
    expect(target.service.store.accounts().every((a) => a.needsReconnect)).toBe(true);
    expect(target.service.store.connections().map((c) => [c.id, c.configured])).toEqual([['conn_1', true]]);

    const record = target.service.store.read((doc) => doc.imports);
    expect(record).toHaveLength(1);
    expect(record[0]!.added.sort()).toEqual(result.added.sort());
    const backup = path.join(target.dir, record[0]!.backup);
    expect((await fs.stat(backup)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await fs.readFile(backup, 'utf8'))).toMatchObject({ publications: [] });

    // A second import of the same file adds nothing and writes nothing.
    const again = await target.service.transfer.apply(raw, HUMAN);
    expect(again).toMatchObject({ added: [], preview: { added: 0, skipped: 2 } });
    expect(target.service.store.read((doc) => doc.imports)).toHaveLength(1);
  });

  it('refuses a file that is not a calendar, or names an account differently', async () => {
    expect(await codeOf(() => target.service.transfer.preview({ format: 'nope' }, HUMAN))).toBe('CALENDAR_INVALID');
    const { archive } = await calendar();
    await target.service.saveConnection({ id: 'conn_1', provider: 'manual', name: 'By hand' }, HUMAN);
    await target.service.saveAccount({ id: 'acc_ig', connectionId: 'conn_1', network: 'instagram', name: 'Other', remoteId: '@someone-else' }, HUMAN);
    expect(await codeOf(target.service.transfer.apply(archive, HUMAN))).toBe('CALENDAR_INVALID');
    expect(target.service.store.publications()).toEqual([]);
  });
});
